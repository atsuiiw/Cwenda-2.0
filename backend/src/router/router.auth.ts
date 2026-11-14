import { Router, type Request, type Response } from "express";
import DBPool from "../database/database.ts";
import { sendDbError } from "./helpers.ts";
import {
  createSession,
  deleteSession,
  getSessionUser,
  hashPassword,
  verifyPassword,
} from "../auth/auth.ts";

const authRouter = Router();
const MIN_PASSWORD_LENGTH = 8;

const text = (value: unknown) => (typeof value === "string" ? value : "");

// Is there an account yet, and is this browser logged in?
authRouter.get("/status", async (req: Request, res: Response) => {
  try {
    const { rows } = await DBPool.query(`SELECT EXISTS (SELECT 1 FROM app_user) AS setup_done;`);
    const user = await getSessionUser(req);
    res.status(200).json({
      setupDone: rows[0].setup_done,
      loggedIn: user !== null,
      username: user?.username,
    });
  } catch (err) {
    sendDbError(res, err);
  }
});

// First run only: create the owner's account and log in.
authRouter.post("/setup", async (req: Request, res: Response) => {
  const username = text(req.body?.username).trim();
  const password = text(req.body?.password);
  if (!username) return res.status(400).json({ error: "username is required" });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  const passwordHash = await hashPassword(password);
  const client = await DBPool.connect();
  try {
    await client.query("BEGIN");
    // two tabs submitting setup at once can't both create an account
    await client.query("LOCK TABLE app_user IN EXCLUSIVE MODE;");
    const { rows } = await client.query(`SELECT EXISTS (SELECT 1 FROM app_user) AS done;`);
    if (rows[0].done) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Setup is already done. Log in instead." });
    }
    const user = await client.query(
      `INSERT INTO app_user (username, password_hash) VALUES ($1, $2) RETURNING id;`,
      [username, passwordHash],
    );
    await createSession(res, user.rows[0].id, client);
    await client.query("COMMIT");
    res.status(201).json({ username });
  } catch (err) {
    await client.query("ROLLBACK");
    sendDbError(res, err);
  } finally {
    client.release();
  }
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const username = text(req.body?.username).trim();
  const password = text(req.body?.password);
  try {
    const { rows } = await DBPool.query(
      `SELECT id, password_hash FROM app_user WHERE username = $1;`,
      [username],
    );
    // shortcut: no rate limiting on failed logins; add it if the app is ever reachable beyond localhost
    if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) {
      return res.status(401).json({ error: "Wrong username or password" });
    }
    await createSession(res, rows[0].id);
    res.status(200).json({ username });
  } catch (err) {
    sendDbError(res, err);
  }
});

authRouter.post("/logout", async (req: Request, res: Response) => {
  try {
    await deleteSession(req, res);
    res.status(200).json({ ok: true });
  } catch (err) {
    sendDbError(res, err);
  }
});

export default authRouter;
