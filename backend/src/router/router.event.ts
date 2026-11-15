import { Router } from "express";
import { type Response, type Request } from "express";
import DBPool from "../database/database.ts";
import { parseEventBody, parseIds, parseRange, sendDbError } from "./helpers.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);
const MCV_SCRIPT = path.join(import.meta.dirname, "../../scripts/mcv_assignments.py");

type McvAssignment = {
  ref: string;
  title: string;
  course: string | null;
  due_at: string;
  submitted: boolean;
  url: string | null;
};

const eventRouter = Router();

// Events overlapping [$1, $2], each with all of its tag ids.
const EVENTS_IN_RANGE = `
  SELECT e.*,
         COALESCE(array_agg(j.tag_id) FILTER (WHERE j.tag_id IS NOT NULL), '{}') AS tag_ids
  FROM event e
  LEFT JOIN junction j ON j.event_id = e.id
  WHERE e.start_time <= $2 AND e.end_time >= $1
  GROUP BY e.id
`;

eventRouter.get("/getEvent", async (req: Request, res: Response) => {
  const range = parseRange(req.query.start_time, req.query.end_time);
  if (typeof range === "string") {
    return res.status(400).json({ error: range });
  }

  try {
    const result = await DBPool.query(`${EVENTS_IN_RANGE} ORDER BY e.start_time;`, range);
    res.status(200).json(result.rows);
  } catch (err) {
    sendDbError(res, err);
  }
});

eventRouter.get("/getEventByTags", async (req: Request, res: Response) => {
  const range = parseRange(req.query.start_time, req.query.end_time);
  if (typeof range === "string") {
    return res.status(400).json({ error: range });
  }

  const tagIds = parseIds(req.query.tag_id);
  if (!tagIds || tagIds.length === 0) {
    return res.status(400).json({ error: "tag_id must be a list of integers, e.g. tag_id=1,2" });
  }

  const matchType = String(req.query.matchType ?? "ANY").toUpperCase();
  if (matchType !== "ANY" && matchType !== "ALL") {
    return res.status(400).json({ error: "matchType must be ANY or ALL" });
  }

  // HAVING filters per event, so tag_ids still lists every tag of the event and rows never repeat.
  const having =
    matchType === "ALL"
      ? `HAVING COUNT(DISTINCT j.tag_id) FILTER (WHERE j.tag_id = ANY($3::int[])) = cardinality($3::int[])`
      : `HAVING bool_or(j.tag_id = ANY($3::int[]))`;

  try {
    const result = await DBPool.query(
      `${EVENTS_IN_RANGE} ${having} ORDER BY e.start_time;`,
      [...range, tagIds],
    );
    res.status(200).json(result.rows);
  } catch (err) {
    sendDbError(res, err);
  }
});

eventRouter.get("/getEvent/:id", async (req: Request, res: Response) => {
  
  const id = Number(req.params.id);
  if(isNaN(id)){
    return res.status(400).json({ error: "Id must be integer" });
  }
  
  try {
    // same shape as /getEvent, so the event carries its tag_ids
    const result = await DBPool.query(
      `SELECT e.*,
              COALESCE(array_agg(j.tag_id) FILTER (WHERE j.tag_id IS NOT NULL), '{}') AS tag_ids
       FROM event e
       LEFT JOIN junction j ON j.event_id = e.id
       WHERE e.id = $1
       GROUP BY e.id;`,
      [id],
    );

    if(result.rows.length===0){
      return res.status(404).json({ error: "Event not found" });
    }
    res.status(200).json(result.rows);
  }
  catch (err){
    res.status(400).json(err);
  }
})

eventRouter.post("/postEvent", async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const queryParam = parseEventBody(body);
  if (typeof queryParam === "string") {
    return res.status(400).json({ error: queryParam });
  }

  // tag_id is optional on create
  const tagIds = body.tag_id === undefined ? [] : parseIds(body.tag_id);
  if (!tagIds) {
    return res.status(400).json({ error: "tag_id must be a list of integers" });
  }

  const client = await DBPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO event (name, description, associate_links, start_time, end_time, timezone, mcv_ref, mcv_submitted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id;`,
      queryParam,
    );
    const eventId = rows[0].id;

    if (tagIds.length) {
      await client.query(
        `INSERT INTO junction (event_id, tag_id)
         SELECT $1, unnest($2::int[]);`,
        [eventId, tagIds],
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ id: eventId, tag_ids: tagIds });
  } catch (err) {
    await client.query("ROLLBACK");
    sendDbError(res, err);
  } finally {
    client.release();
  }
});

// PUT replaces the whole event: send every field, missing ones become NULL.
eventRouter.put("/updateEvent/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid event id" });
  }

  const body = req.body ?? {};
  const queryParam = parseEventBody(body);
  if (typeof queryParam === "string") {
    return res.status(400).json({ error: queryParam });
  }

  // tag_id missing = keep current tags; [] = remove all tags
  const hasTags = body.tag_id !== undefined;
  const tagIds = hasTags ? parseIds(body.tag_id) : [];
  if (!tagIds) {
    return res.status(400).json({ error: "tag_id must be a list of integers" });
  }

  const client = await DBPool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE event
       SET name = $1, description = $2, associate_links = $3,
           start_time = $4, end_time = $5, timezone = $6,
           mcv_ref = $7, mcv_submitted = $8
       WHERE id = $9;`,
      [...queryParam, id],
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Event not found" });
    }

    if (hasTags) {
      await client.query(`DELETE FROM junction WHERE event_id = $1;`, [id]);
      if (tagIds.length) {
        await client.query(
          `INSERT INTO junction (event_id, tag_id)
           SELECT $1, unnest($2::int[]);`,
          [id, tagIds],
        );
      }
    }

    await client.query("COMMIT");
    res.status(200).json({ id, tag_ids: hasTags ? tagIds : undefined });
  } catch (err) {
    await client.query("ROLLBACK");
    sendDbError(res, err);
  } finally {
    client.release();
  }
});

eventRouter.delete("/deleteEvent/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid event id" });
  }

  try {
    const result = await DBPool.query(`DELETE FROM event WHERE id = $1;`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.status(200).json({ id });
  } catch (err) {
    sendDbError(res, err);
  }
});

// Imports MyCourseVille assignments (through mcv-cli) as events, matched by mcv_ref.
// Re-importing updates the due time and submitted flag but keeps the user's name/description edits.
eventRouter.post("/importMcv", async (req: Request, res: Response) => {
  let assignments: McvAssignment[];
  try {
    // shortcut: expects mcv-cli installed with `uv tool install` on the backend's machine (macOS/Linux layout)
    const { stdout: toolDir } = await run("uv", ["tool", "dir"]);
    const python = path.join(toolDir.trim(), "mcv-cli", "bin", "python");
    const { stdout } = await run(python, ["-I", MCV_SCRIPT], {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    assignments = JSON.parse(stdout);
  } catch (err) {
    // the script's stderr is a readable message, e.g. "MCV session expired. Run `mcv auth login`..."
    const message = (err as { stderr?: string }).stderr?.trim() || (err as Error).message;
    return res.status(502).json({ error: message });
  }

  const client = await DBPool.connect();
  try {
    await client.query("BEGIN");
    let added = 0;
    for (const a of assignments) {
      const { rows } = await client.query(
        `INSERT INTO event (name, description, associate_links, start_time, end_time, timezone, mcv_ref, mcv_submitted)
         VALUES ($1, $2, $3, $4, $4, 'Asia/Bangkok', $5, $6)
         ON CONFLICT (mcv_ref) DO UPDATE
           SET start_time = EXCLUDED.start_time,
               end_time = EXCLUDED.end_time,
               mcv_submitted = EXCLUDED.mcv_submitted
         RETURNING (xmax = 0) AS inserted;`, // xmax = 0 only on freshly inserted rows
        [
          a.title,
          a.course ? `Course ${a.course}` : null,
          JSON.stringify(a.url ? [a.url] : []),
          a.due_at,
          a.ref,
          a.submitted,
        ],
      );
      if (rows[0].inserted) added++;
    }
    await client.query("COMMIT");
    res.status(200).json({ added, updated: assignments.length - added });
  } catch (err) {
    await client.query("ROLLBACK");
    sendDbError(res, err);
  } finally {
    client.release();
  }
});

// shortcut: same uv tool layout as /importMcv (macOS/Linux); the `mcv` executable sits next to its python
async function mcvExecutable() {
  const { stdout } = await run("uv", ["tool", "dir"]);
  return path.join(stdout.trim(), "mcv-cli", "bin", "mcv");
}

// mcv --json prints errors to stderr as {"code": ..., "message": ...}
function mcvError(err: unknown): { code?: string; message: string } {
  const stderr = (err as { stderr?: string }).stderr?.trim();
  try {
    const parsed = JSON.parse(stderr ?? "");
    if (typeof parsed?.message === "string") return parsed;
  } catch {
    // not JSON: fall through to the raw text
  }
  return { message: stderr || (err as Error).message };
}

// Whether the backend's machine has a working MCV session: { authenticated, session_expired? }
eventRouter.get("/mcvStatus", async (_req: Request, res: Response) => {
  try {
    const { stdout } = await run(await mcvExecutable(), ["--json", "--quiet", "auth", "status"], {
      timeout: 30_000,
    });
    res.status(200).json(JSON.parse(stdout));
  } catch (err) {
    res.status(502).json({ error: mcvError(err).message });
  }
});

// Logs mcv-cli in to MyCourseVille, so /importMcv works without a terminal.
// The password goes to mcv over stdin (never argv, which other local users can see in `ps`)
// and is not stored by cwenda; mcv-cli keeps its own session in the OS keyring.
eventRouter.post("/mcvLogin", async (req: Request, res: Response) => {
  const { username, password } = req.body ?? {};
  // starts with a letter/digit so it can't be read as an mcv option like "--help"
  if (typeof username !== "string" || !/^[A-Za-z0-9][\w.@-]*$/.test(username.trim())) {
    return res.status(400).json({ error: "Enter your Chula username." });
  }
  if (typeof password !== "string" || !password || /[\r\n]/.test(password)) {
    return res.status(400).json({ error: "Enter your MyCourseVille password." });
  }
  try {
    const login = run(
      await mcvExecutable(),
      ["--json", "--quiet", "auth", "login", "--username", username.trim(), "--password-stdin"],
      { timeout: 60_000 },
    );
    login.child.stdin?.end(password + "\n");
    await login;
    res.status(200).json({ authenticated: true });
  } catch (err) {
    const { code, message } = mcvError(err);
    const wrongLogin = code === "authentication_failed" || code === "not_authenticated";
    // 400, not 401: the frontend treats 401 as "cwenda session expired" and reloads
    res.status(wrongLogin ? 400 : 502).json({ error: message });
  }
});

// Forgets mcv-cli's saved MyCourseVille session (Import From MCV needs a new login afterwards).
eventRouter.post("/mcvLogout", async (_req: Request, res: Response) => {
  try {
    await run(await mcvExecutable(), ["--json", "--quiet", "auth", "logout"], { timeout: 30_000 });
    res.status(200).json({ authenticated: false });
  } catch (err) {
    res.status(502).json({ error: mcvError(err).message });
  }
});

export default eventRouter;
