import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { handleGetEvent, handlePostEvent, type Event } from "../api/api.config";
import { TimeGrid } from "../Calendar/TimeGrid";
import { daysIn, rangeFor } from "./calendarLayout";

// Today's schedule: the Calendar's day view, smaller. Click an event to open it,
// the date or the title to open the full calendar.
function TodayWidget() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // shortcut: "today" is fixed when the page opens; a tab left open past midnight shows yesterday
  const [[start, end]] = useState(() => rangeFor("day", new Date()));

  useEffect(() => {
    let ignore = false;
    handleGetEvent(start, end)
      .then((data) => {
        if (ignore) return;
        setEvents(data);
        setLoaded(true);
      })
      .catch((err) => !ignore && setError(err.message));
    return () => {
      ignore = true;
    };
  }, [start, end]);

  return (
    <section className="flex flex-col w-full min-w-0 h-112 lg:flex-1 lg:h-160 p-4 rounded-xl bg-middleground-color-light dark:bg-middleground-color-dark shadow-xl dark:text-white duration-100">
      <div className="flex items-baseline justify-between mb-2">
        <button
          type="button"
          onClick={() => navigate("/calendar")}
          className="text-xl font-bold hover:cursor-pointer hover:opacity-70 duration-100"
        >
          Today
        </button>
        {!loaded && !error && (
          <span role="status" className="text-sm opacity-60">
            Loading…
          </span>
        )}
        {loaded && events.length === 0 && (
          <span className="text-sm opacity-60">Nothing scheduled</span>
        )}
      </div>
      {error ? (
        <p className="text-primary-color">{error}</p>
      ) : (
        <TimeGrid
          events={events}
          days={daysIn(start, end)}
          onPickDay={() => navigate("/calendar")}
          hourPx={32}
        />
      )}
    </section>
  );
}

// e.g. "Mon 16 Nov, 09:00" in the browser's locale
const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

// Countdown text: "2d 3h", "3h 20m", "15m", "under 1m"
function formatLeft(ms: number) {
  const min = Math.floor(ms / 60_000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return m ? `${m}m` : "under 1m";
}

// The closest event that hasn't started yet, with a live countdown.
function Nextup() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000); // tick the countdown each minute
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let ignore = false;
    const from = new Date();
    // shortcut: looks one year ahead, like EventPage's upcoming list
    const to = new Date(
      from.getFullYear() + 1,
      from.getMonth(),
      from.getDate(),
    );
    handleGetEvent(from, to)
      .then((data) => {
        if (ignore) return;
        setEvents(data);
        setLoaded(true);
      })
      .catch((err) => !ignore && setError(err.message));
    return () => {
      ignore = true;
    };
  }, []);

  // sorted by start_time by the backend; skips events already running, and rolls over as time passes
  const next = events.find((e) => new Date(e.start_time).getTime() >= now);

  return (
    <section className="max-w-md p-4 rounded-xl shadow-xl bg-middleground-color-light dark:bg-middleground-color-dark dark:text-white duration-100">
      <h1 className="text-xl font-bold">Next Up</h1>
      {error ? (
        <p className="my-5 text-primary-color">{error}</p>
      ) : !loaded ? (
        <p role="status" className="my-5 opacity-60">
          Loading…
        </p>
      ) : next ? (
        <button
          type="button"
          onClick={() => navigate(`/event/${next.id}`)}
          className="flex w-full items-center justify-between gap-4 p-4 my-5 rounded-lg text-left bg-secondary-color text-white hover:opacity-80 hover:cursor-pointer duration-100"
        >
          <div className="min-w-0">
            <h2 className="text-3xl font-bold truncate">
              {next.name || "(untitled)"}
            </h2>
            <p>{formatTime(next.start_time)}</p>
          </div>
          <p className="shrink-0 text-right">
            <span className="block text-xs opacity-80">
              {next.mcv_ref ? "due in" : "starts in"}
            </span>
            <span className="text-2xl font-bold">
              {formatLeft(new Date(next.start_time).getTime() - now)}
            </span>
          </p>
        </button>
      ) : (
        <p className="my-5 text-center opacity-70">No upcoming event</p>
      )}
    </section>
  );
}

const quickFieldClass =
  "w-full min-w-0 border-2 dark:border-background-color-dark border-background-color-light rounded-sm px-3.5 py-2.5 bg-transparent";

// Next full hour as "YYYY-MM-DDTHH:mm" in local time, the format datetime-local wants.
function nextHourInput() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

const DURATIONS: [number, string][] = [
  [30, "30 minutes"],
  [60, "1 hour"],
  [120, "2 hours"],
];

function AddEvent({ onAdded }: { onAdded: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const name = String(form.get("name") ?? "").trim();
    const start = new Date(String(form.get("start_time")));
    if (!name || isNaN(start.getTime())) {
      setError("Give the event a name and a start time.");
      return;
    }
    const end = new Date(
      start.getTime() + Number(form.get("duration")) * 60_000,
    );

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await handlePostEvent({
        name,
        description: null,
        associate_links: null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      formEl.reset(); // back to the defaults for the next one
      setNotice(`Added "${name}".`);
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="max-w-md p-4 rounded-xl shadow-xl bg-middleground-color-light dark:bg-middleground-color-dark dark:text-white duration-100">
        <h1 className="text-xl font-bold mb-5"> Quick Add </h1>
        <form onSubmit={submit}>
          {/* row 1: name across the full width; row 2: start (3/4) + duration (1/4) */}
          <div className="grid grid-cols-4 gap-2 mb-5 dark:scheme-dark">
            <input
              type="text"
              name="name"
              aria-label="Event name"
              required
              placeholder="Add event..."
              className={`${quickFieldClass} col-span-4`}
            />
            <input
              type="datetime-local"
              name="start_time"
              aria-label="Start time"
              required
              defaultValue={nextHourInput()}
              className={`${quickFieldClass} col-span-3 hover:cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
            />
            <select
              name="duration"
              aria-label="Duration"
              defaultValue={60}
              className={`${quickFieldClass} col-span-1 px-2 hover:cursor-pointer`}
            >
              {DURATIONS.map(([minutes, label]) => (
                <option key={minutes} value={minutes}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p role="alert" className="mb-3 text-sm text-primary-color">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mb-3 text-sm opacity-70">
              {notice}
            </p>
          )}
          <button
            disabled={saving}
            className="px-3.5 py-2.5 bg-sky-500 rounded-lg hover:cursor-pointer hover:opacity-90 hover:scale-95 duration-100 disabled:opacity-50 disabled:cursor-wait"
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </form>
      </section>
    </>
  );
}

const DUE_SOON_DAYS = 7;

// Imported MyCourseVille assignments not submitted yet, due in the next week, soonest first.
function McvDueSoon() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000); // tick the countdowns each minute
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let ignore = false;
    const from = new Date();
    const to = new Date(from.getTime() + DUE_SOON_DAYS * 24 * 60 * 60_000);
    handleGetEvent(from, to)
      .then((data) => {
        if (ignore) return;
        setEvents(data);
        setLoaded(true);
      })
      .catch((err) => !ignore && setError(err.message));
    return () => {
      ignore = true;
    };
  }, []);

  // MCV events are zero-length: start_time is the due time
  const due = events.filter(
    (e) =>
      e.mcv_ref && !e.mcv_submitted && new Date(e.start_time).getTime() >= now,
  );

  return (
    <section className="max-w-md p-4 rounded-xl shadow-xl bg-middleground-color-light dark:bg-middleground-color-dark dark:text-white duration-100">
      <div className="flex items-baseline justify-between mb-3">
        <h1 className="text-xl font-bold">MCV Due Soon</h1>
        {loaded && (
          <span className="text-sm opacity-60">{due.length} this week</span>
        )}
      </div>
      {error ? (
        <p className="text-primary-color">{error}</p>
      ) : !loaded ? (
        <p role="status" className="opacity-60">
          Loading…
        </p>
      ) : due.length === 0 ? (
        <p className="text-center opacity-70">
          Nothing due in the next {DUE_SOON_DAYS} days
        </p>
      ) : (
        <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {due.map((e) => {
            const left = new Date(e.start_time).getTime() - now;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/event/${e.id}`)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 rounded-lg text-left bg-background-color-light dark:bg-background-color-dark hover:opacity-80 hover:cursor-pointer duration-100"
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate" title={e.name ?? ""}>
                      {e.name || "(untitled)"}
                    </p>
                    <p className="text-xs opacity-60">
                      {formatTime(e.start_time)}
                    </p>
                  </div>
                  {/* red when under a day left */}
                  <span
                    className={`shrink-0 text-sm font-bold ${left < 24 * 60 * 60_000 ? "text-primary-color" : ""}`}
                  >
                    {formatLeft(left)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function Home() {
  const [reloadKey, setReloadKey] = useState(0); // bump after Quick Add so the other widgets refetch

  return (
    <>
      <div className="flex flex-col gap-8 m-2 bg-middleground-color-light dark:bg-middleground-color-dark w-full rounded-md px-20 py-12 overflow-y-auto duration-100">
        <h1 className="text-4xl dark:text-white font-bold"> Welcome back!</h1>
        {/* a new key remounts the widget, which fetches again */}
        {/* Today fills the left; the rest stack in a fixed-width column on the right (one column on narrow screens) */}
        <div className="flex flex-col lg:flex-row items-start gap-4">
          <TodayWidget key={`today-${reloadKey}`} />
          <div className="flex flex-col gap-4 w-full lg:w-96 shrink-0 [&>section]:max-w-none">
            <Nextup key={`next-${reloadKey}`} />
            <AddEvent onAdded={() => setReloadKey((k) => k + 1)} />
            <McvDueSoon />
          </div>
        </div>
      </div>
    </>
  );
}
