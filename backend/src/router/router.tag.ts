import { Router } from "express";
import { type Response, type Request } from "express";
import DBPool from "../database/database.ts";

const tagRouter = Router();

tagRouter.get("/getTag", async (req: Request, res: Response) => {
  const queryText = `
        SELECT t.name FROM tag t;
    `;

  try {
    const result = await DBPool.query(queryText);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(404).json(err);
  }
});

tagRouter.post("/postTag", async (req: Request, res: Response) => {
  const queryText: string = `
        INSERT INTO tag (name)
        VALUES ($1);
    `;

  try {
    const result = await DBPool.query(queryText, [req.body.name]);
    res.status(200).json(result);
  } catch (err) {
    res.status(404).json(err);
  }
});

tagRouter.put("/updateTag/:id", async (req: Request, res: Response) => {
  const name = req.body.name;
  const id = req.params.id;

  if (!name) {
    return res.status(404).json({ error: "Missing valid name input" });
  }

  const queryText: string = `
        UPDATE tag
        SET name = $1
        WHERE id = $2;
    `;

  try {
    const result = await DBPool.query(queryText, [name, id]);
    res.status(200).json(result);
  } catch (err) {
    res.status(404).json(err);
  }
});

tagRouter.delete("/deleteTag/:id", async (req: Request, res: Response) => {
  const id = req.params.id;

  const queryText = `
        DELETE FROM tag
        WHERE tag.id = $1;
    `;

  try {
    const result = await DBPool.query(queryText, [id]);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json(err);
  }
});

export default tagRouter;
