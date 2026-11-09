import { type Response } from "express";

// Postgres error codes caused by bad client input -> HTTP status
const PG_CLIENT_ERRORS: Record<string, number> = {
  "23505": 409, // unique violation (e.g. duplicate tag name)
  "23503": 400, // foreign key violation (e.g. tag id that doesn't exist)
  "23514": 400, // check violation
  "23502": 400, // not null violation
  "22P02": 400, // invalid text representation (e.g. "abc" as an int)
  "22007": 400, // invalid datetime format
  "22008": 400, // datetime out of range
};

// Log the real error, send the client a short message without schema details.
export function sendDbError(res: Response, err: unknown) {
  console.error(err);
  const status = PG_CLIENT_ERRORS[(err as { code?: string })?.code ?? ""];
  if (status) {
    return res.status(status).json({ error: (err as Error).message });
  }
  return res.status(500).json({ error: "Internal server error" });
}

// Accepts [1, 2], ["1", "2"], [] or "1,2". Returns unique ids, or null if invalid.
export function parseIds(value: unknown): number[] | null {
  const list =
    typeof value === "string" ? value.split(",") : Array.isArray(value) ? value : null;
  if (!list) return null;
  const ids = [...new Set(list.map(Number))];
  return ids.every((n) => Number.isInteger(n) && n > 0) ? ids : null;
}

export function parseDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
}

// Returns [start, end] or an error message.
export function parseRange(start: unknown, end: unknown): [Date, Date] | string {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return "start_time and end_time must be valid dates";
  if (endDate < startDate) return "end_time must not be before start_time";
  return [startDate, endDate];
}

// Validates an event body and builds the 8 query params used by INSERT/UPDATE.
export function parseEventBody(body: any): unknown[] | string {
  let links = body.associate_links;
  if (typeof links === "string") {
    try {
      links = JSON.parse(links);
    } catch {
      return "Invalid JSON format in associate_links";
    }
  }
  if (typeof body.name !== "string" || !body.name.trim()) return "name is required";

  const range = parseRange(body.start_time, body.end_time);
  if (typeof range === "string") return range;

  return [
    body.name.trim(),
    body.description,
    JSON.stringify(links ?? null),
    range[0],
    range[1],
    body.timezone,
    body.mcv_ref,
    body.mcv_submitted,
  ];
}
