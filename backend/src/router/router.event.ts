import { Router } from "express";
import { type Response, type Request } from "express";
import DBPool from "../database/database.ts";

const eventRouter = Router();

eventRouter.get("/getEvent", async (req: Request, res: Response) => {
  // parameters start_time and end_time
  const { start_time, end_time } = req.query;
  if (!start_time || !end_time) {
    return res.send("Bad request");
  }
  const startTimeDate: Date = new Date(String(start_time));
  const endTimeDate: Date = new Date(String(end_time));
  const queryParam: Array<Date> = [startTimeDate, endTimeDate];

  const queryText: string = `
        SELECT * FROM event
        WHERE start_time <= $2 AND end_time >= $1;
    `;

  try {
    const result = await DBPool.query(queryText, queryParam);
    res.send(result.rows);
  } catch (err) {
    res.status(404).json(err);
  }
});

eventRouter.get("/getEventByTags", async (req: Request, res: Response) => {
  const tagIds = req.query.tag_id;
  const matchType = req.query.matchType;

  if (matchType === null) {
    return res.status(400).json({ error: "No matching type set" });
  }
  const matchQuery: string = matchType as string;

  if (!tagIds) {
    return res.status(400).json({ error: "Missing tags' id" });
  }

  let tag_ids: number[] = [];
  if (typeof tagIds === "string") {
    tag_ids = tagIds.split(",").map(Number);
  } else if (Array.isArray(tagIds)) {
    tag_ids = tagIds.map(Number);
  }

  let queryText: string = `
        SELECT e.*
        FROM event e
        JOIN junction j ON e.id = j.event_id
        WHERE j.tag_id = ANY($1);
    `;
  if (matchQuery === "ALL") {
    queryText = `
            SELECT e.*
            FROM event e
            JOIN junction j ON e.id = j.event_id
            WHERE j.tag_id = ANY($1)
            GROUP BY e.id
            HAVING COUNT(DISTINCT j.tag_id) = $2;
        `;
  }

  try {
    const queryParams =
      matchType === "ALL" ? [tag_ids, tag_ids.length] : [tag_ids];
    const result = await DBPool.query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(404).json(err);
  }
});

eventRouter.post("/postEvent", async (req: Request, res: Response) => {
  let links = req.body.associate_links;
  if (typeof links === "string") {
    try {
      links = JSON.parse(links);
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON format in associate_links" });
    }
  }

  const queryParam: (string | number | Date | boolean | null)[] = [
    req.body.name,
    req.body.description,
    JSON.stringify(links),
    req.body.start_time,
    req.body.end_time,
    req.body.timezone,
    req.body.mcv_ref,
    req.body.mcv_submitted,
  ];

  const tagId: number[] = [...new Set<number>((req.body.tag_id ?? []).map(Number))];
  if(tagId.some((n) => !Number.isInteger(n))) {
    return res.status(400).json({ error: "tag_id must only contain integers" });
  }

  const client = await DBPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO event (name, description, associate_links, start_time, end_time, timezone, mcv_ref, mcv_submitted)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id;`
      , queryParam
    );
    const eventId = rows[0].id;

    if(tagId.length) {
      await client.query(
        `INSERT INTO junction (event_id, tag_id)
        SELECT $1, unnest($2::int[]);`
        , [eventId, tagId]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ id: eventId, tags: tagId});
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json(err);
  } finally {
    client.release();
  }
});

eventRouter.put("/updateEvent/:id", async (req: Request, res: Response) => {
  const id = req.params.id;

  let links = req.body.associate_links;
  if (typeof links === "string") {
    try {
      links = JSON.parse(links);
    } catch (e) {
      return res
        .status(400)
        .json({ error: "Invalid JSON format in associate_links" });
    }
  }

  // tags handling stuff
  const hasTag = Array.isArray(req.body.tag_id);
  const tagId: number[] = hasTag
    ? [...new Set<number>(req.body.tag_id.map(Number))]
    : [];
  if (tagId.some((n) => !Number.isInteger(n))) {
    return res.status(400).json({ error: "tag_id must be integers" });
  }

  const queryParam: (string | number | Date | boolean | null)[] = [
    req.body.name,
    req.body.description,
    JSON.stringify(links),
    req.body.start_time,
    req.body.end_time,
    req.body.timezone,
    req.body.mcv_ref,
    req.body.mcv_submitted,
    id
  ];


  const client = await DBPool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE event
       SET name = $1, description = $2, associate_links = $3,
           start_time = $4, end_time = $5, timezone = $6,
           mcv_ref = $7, mcv_submitted = $8
       WHERE id = $9;`,
      queryParam,
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Event not found" });
    }

    if (hasTag) {
      await client.query(`DELETE FROM junction WHERE event_id = $1;`, [id]);
      if (tagId.length) {
        await client.query(
          `INSERT INTO junction (event_id, tag_id)
           SELECT $1, unnest($2::int[]);`,
          [id, tagId],
        );
      }
    }



    await client.query("COMMIT");
    res.status(200).json({ id, tag_ids: hasTag ? tagId : undefined });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(404).json(err);
  } finally {
    client.release();
  }
});

eventRouter.delete("/deleteEvent/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  const queryText: string = `
        DELETE FROM event WHERE id=${id};
    `;

  try {
    const result = await DBPool.query(queryText);
    res.status(200).json(result);
  } catch (err) {
    res.status(404).json(err);
  }
});

export default eventRouter;
