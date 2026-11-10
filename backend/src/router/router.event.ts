import { Router } from "express";
import { type Response, type Request } from "express";
import DBPool from "../database/database.ts";
import { parseEventBody, parseIds, parseRange, sendDbError } from "./helpers.ts";

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
    const result = await DBPool.query(`SELECT * FROM event WHERE id=$1`, [id]);

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

export default eventRouter;
