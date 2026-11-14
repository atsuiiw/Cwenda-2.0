import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { type NextFunction, type Request, type Response } from "express";
import { type Pool, type PoolClient } from "pg";
import DBPool from "../database/database.ts";
import { sendDbError } from "../router/helpers.ts";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
) => Promise<Buffer>;

const COOKIE = "cwenda_session";
const SESSION_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Stored as "scrypt$<salt hex>$<hash hex>" so the format can change later.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, saltHex, hashHex] = stored.split("$");
  if (kind !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

// The DB keeps only this hash, so a leaked table can't be used to log in.
const sha256 = (token: string) => createHash("sha256").update(token).digest("hex");

function readToken(req: Request): string | null {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE) return value.join("=") || null;
  }
  return null;
}

function setCookie(res: Response, token: string, maxAge: number) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`,
  );
}

// `db` lets setup create the session inside its transaction.
export async function createSession(res: Response, userId: number, db: Pool | PoolClient = DBPool) {
  const token = randomBytes(32).toString("hex");
  await db.query(`INSERT INTO session (token_hash, user_id, expires_at) VALUES ($1, $2, $3);`, [
    sha256(token),
    userId,
    new Date(Date.now() + SESSION_SECONDS * 1000),
  ]);
  setCookie(res, token, SESSION_SECONDS);
}

export async function deleteSession(req: Request, res: Response) {
  const token = readToken(req);
  if (token) await DBPool.query(`DELETE FROM session WHERE token_hash = $1;`, [sha256(token)]);
  setCookie(res, "", 0);
}

export async function getSessionUser(
  req: Request,
): Promise<{ id: number; username: string } | null> {
  const token = readToken(req);
  if (!token) return null;
  const { rows } = await DBPool.query(
    `SELECT u.id, u.username
     FROM session s JOIN app_user u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now();`,
    [sha256(token)],
  );
  return rows[0] ?? null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (await getSessionUser(req)) return next();
    res.status(401).json({ error: "Not logged in" });
  } catch (err) {
    sendDbError(res, err);
  }
}
