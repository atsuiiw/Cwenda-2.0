import { Router } from "express";
import { type Response, type Request } from "express";
import DBPool from "../database/database.ts";
import { sendDbError } from "./helpers.ts";

const tagRouter = Router();

function readName(body: any): string | null {
  const name = body?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

tagRouter.get("/getTag", async (req: Request, res: Response) => {
  try {
    const result = await DBPool.query(`SELECT id, name FROM tag ORDER BY name;`);
    res.status(200).json(result.rows);
  } catch (err) {
    sendDbError(res, err);
  }
});

tagRouter.post("/postTag", async (req: Request, res: Response) => {
  const name = readName(req.body);
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const result = await DBPool.query(
      `INSERT INTO tag (name) VALUES ($1) RETURNING id, name;`,
      [name],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    sendDbError(res, err); // duplicate name -> 409 once tag.name is UNIQUE
  }
});

tagRouter.put("/updateTag/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid tag id" });
  }
  const name = readName(req.body);
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const result = await DBPool.query(
      `UPDATE tag SET name = $1 WHERE id = $2 RETURNING id, name;`,
      [name, id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Tag not found" });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    sendDbError(res, err);
  }
});

tagRouter.delete("/deleteTag/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid tag id" });
  }

  try {
    const result = await DBPool.query(`DELETE FROM tag WHERE id = $1;`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Tag not found" });
    }
    res.status(200).json({ id });
  } catch (err) {
    sendDbError(res, err);
  }
});

export default tagRouter;
