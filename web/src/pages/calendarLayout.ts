import type { Event } from "../api/api.config";

// Date math for CalendarPage. Weeks start on Monday, like EventPage's sections.

export type View = "day" | "week" | "month";

const DAY_MIN = 24 * 60;
const MIN_EVENT_MIN = 30; // short and zero-length events (MCV due dates) still get a clickable block

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// [start, end) of what the view shows; month view is a 6-week grid.
export function rangeFor(view: View, anchor: Date): [Date, Date] {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  if (view === "month") start.setDate(1);
  if (view !== "day")
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // back to Monday
  return [start, addDays(start, view === "day" ? 1 : view === "week" ? 7 : 42)];
}

export function shift(view: View, anchor: Date, dir: 1 | -1): Date {
  const d = new Date(anchor);
  if (view === "month")
    d.setMonth(d.getMonth() + dir, 1); // ", 1" stops Jan 31 + 1 month = Mar 3
  else d.setDate(d.getDate() + dir * (view === "week" ? 7 : 1));
  return d;
}

export function daysIn(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function titleFor(view: View, anchor: Date, start: Date, end: Date) {
  if (view === "day")
    return anchor.toLocaleDateString(undefined, { dateStyle: "full" });
  if (view === "month")
    return anchor.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatRange(start, addDays(end, -1)); // e.g. "9 – 15 Nov 2026"
}

// Events touching [day, next day). "s >= day" keeps zero-length events at exactly midnight.
export function eventsOn(events: Event[], day: Date) {
  const next = addDays(day, 1);
  return events.filter((e) => {
    const s = new Date(e.start_time);
    return s < next && (new Date(e.end_time) > day || s >= day);
  });
}

// top/height in minutes from midnight; lane of lanes = horizontal slot among overlapping events
export type Placed = {
  event: Event;
  top: number;
  height: number;
  lane: number;
  lanes: number;
};

// Splits one day's events into the all-day row and time blocks; overlapping blocks share the width.
export function layoutDay(events: Event[], day: Date) {
  const dayStart = day.getTime();
  const dayEnd = addDays(day, 1).getTime();
  const allDay: Event[] = [];
  const blocks: Omit<Placed, "lane" | "lanes">[] = [];

  for (const event of eventsOn(events, day)) {
    const s = new Date(event.start_time).getTime();
    const e = new Date(event.end_time).getTime();
    if (s <= dayStart && e >= dayEnd) {
      allDay.push(event);
      continue;
    }
    // clip to this day; events from yesterday start at the top
    const from = (Math.max(s, dayStart) - dayStart) / 60_000;
    const to = (Math.min(e, dayEnd) - dayStart) / 60_000;
    const height = Math.max(to - from, MIN_EVENT_MIN);
    blocks.push({ event, top: Math.min(from, DAY_MIN - height), height }); // a 23:59 due date stays inside the day
  }

  // Greedy lanes: each block takes the first lane that's free by its start. A cluster (blocks
  // chained by overlap) splits the width by how many lanes it needed.
  blocks.sort((a, b) => a.top - b.top || b.height - a.height);
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const closeCluster = () => {
    for (const p of cluster) p.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };
  for (const b of blocks) {
    if (b.top >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex((end) => end <= b.top);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = b.top + b.height;
    clusterEnd = Math.max(clusterEnd, b.top + b.height);
    const p = { ...b, lane, lanes: 1 };
    cluster.push(p);
    placed.push(p);
  }
  closeCluster();

  return { allDay, blocks: placed };
}
