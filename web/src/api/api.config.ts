// Matches the `event` table in backend/db/schema.sql (timestamps arrive as ISO strings).
export type Event = {
  id: number;
  name: string | null;
  description: string | null;
  associate_links: unknown;
  start_time: string;
  end_time: string;
  timezone: string | null;
  mcv_ref: string | null;
  mcv_submitted: boolean | null;
  tag_ids?: number[]; // only sent by /getEvent
};

export type Tag = { id: number; name: string };

// "/api" is proxied to the backend by vite.config.ts
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body;
}

// Events that overlap [start, end], ordered by start_time.
export function handleGetEvent(start: Date, end: Date): Promise<Event[]> {
  const query = new URLSearchParams({
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  });
  return getJson(`/event/getEvent?${query}`);
}

export function handleGetTag(): Promise<Tag[]> {
  return getJson("/tag/getTag");
}

export async function handleGetEventById(id: number): Promise<Event> {
  // the backend sends a one-row array
  const [event] = await getJson<Event[]>(`/event/getEvent/${id}`);
  return event;
}
