import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Event } from "../api/api.config";
import { handleGetEvent } from "../api/api.config";
type View = "day" | "week" | "month";

// =============== sub-functions ===============

function Card({
  day,
  events,
  faded,
}: {
  day: Date;
  events: Event[];
  faded: boolean;
}) {
  const isToday = day.toDateString() === new Date().toDateString();
  const navigate = useNavigate();
  return (
    <div
      className={`flex flex-col gap-1 min-h-24 p-1.5 rounded-md bg-background-color-light dark:bg-background-color-dark dark:text-white ${faded ? "opacity-40" : ""}`}
    >
      <span
        className={`self-end text-sm px-1.5 rounded-full ${isToday ? "bg-primary-color text-white" : ""}`}
      >
        {day.getDate()}
      </span>
      {events.map((e) => (
        <button
          type="button"
          key={e.id}
          title={e.name ?? ""}
          onClick={() => navigate(`/event/${e.id}`)}
          className="truncate text-left text-xs px-1.5 py-0.5 rounded bg-secondary-color text-white hover:cursor-pointer hover:opacity-80 duration-100"
        >
          {e.name || "(untitled)"}
        </button>
      ))}
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarList({
  events,
  start,
  end,
  month,
}: {
  events: Event[];
  start: Date;
  end: Date;
  month?: number;
}) {
  const days: Date[] = [];
  for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1))
    days.push(new Date(d));

  return (
    <div
      className={`grid gap-1 ${days.length === 1 ? "grid-cols-1" : "grid-cols-7"} h-screen`}
    >
      {days.length > 1 &&
        WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-center text-sm opacity-60 dark:text-white"
          >
            {w}
          </div>
        ))}
      {days.map((day) => {
        const next = new Date(day);
        next.setDate(day.getDate() + 1);
        // overlaps [day, next); "s >= day" keeps zero-length events (MCV due dates) at exactly midnight
        const dayEvents = events.filter((e) => {
          const s = new Date(e.start_time);
          return s < next && (new Date(e.end_time) > day || s >= day);
        });
        return (
          <Card
            key={day.getTime()}
            day={day}
            events={dayEvents}
            faded={month !== undefined && day.getMonth() !== month}
          />
        );
      })}
    </div>
  );
}

// =============== utilities ===============

function rangeFor(view: View, anchor: Date): [Date, Date] {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  if (view === "month") start.setDate(1);
  if (view !== "day") start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + (view === "day" ? 1 : view === "week" ? 7 : 42));
  return [start, end];
}

function shift(view: View, anchor: Date, dir: 1 | -1): Date {
  const d = new Date(anchor);
  if (view === "month") d.setMonth(d.getMonth() + dir, 1);
  else d.setDate(d.getDate() + dir * (view === "week" ? 7 : 1));
  return d;
}

// =============== Main ===============

export function Calendar() {
  // main variables
  const [view, setView] = useState<View>("month"); // view types
  const [anchor, setAnchor] = useState<Date>(() => new Date()); // date anchor
  const [events, setEvents] = useState<Event[]>([]); // event from fetching
  const [error, setError] = useState<string | null>(null); // error

  // range variables
  const [start, end] = rangeFor(view, anchor);
  const startMs = start.getTime();
  const endMs = end.getTime();

  const months: string[] = ["January", "Febuary", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // fetching
  useEffect(() => {
    let ignore = false;
    handleGetEvent(new Date(startMs), new Date(endMs))
      .then((data) => !ignore && setEvents(data))
      .catch((err) => !ignore && setError(err.message));
    return () => {
      ignore = true;
    };
  }, [startMs, endMs]);

  return (
    <>
    {
      !error ? 
      <div className="flex flex-col gap-6 m-2 bg-middleground-color-light dark:bg-middleground-color-dark w-full rounded-md px-10 py-8 overflow-y-auto duration-100">
        {/* Header */}
        <div className="flex justify-between">
          <div className="flex">
            <button
              className="
                dark:text-white bg-background-color-light dark:bg-background-color-dark rounded-l-sm px-4.5 py-0.5
                hover:cursor-pointer hover:opacity-80 duration-100 dark:hover:text-primary-color hover:text-middleground-color-dark
                mr-0.5 text-lg
              "
              onClick={() => setAnchor((a) => shift(view, a, -1))}
            >
              {" "}
              {`<`}{" "}
            </button>
            <button
              className="
              dark:text-white bg-background-color-light dark:bg-background-color-dark px-8.5 py-0.5
                hover:cursor-pointer hover:opacity-80 duration-100 dark:hover:text-primary-color hover:text-middleground-color-dark
                text-lg
              "
              onClick={() => setAnchor(new Date())}
            >
              {" "}
              Today{" "}
            </button>
            <button
              className="
                dark:text-white bg-background-color-light dark:bg-background-color-dark rounded-r-sm px-4.5 py-0.5
                hover:cursor-pointer hover:opacity-80 duration-100 dark:hover:text-primary-color hover:text-middleground-color-dark
                ml-0.5 text-lg
              "
              onClick={() => setAnchor((a) => shift(view, a, 1))}
            >
              {" "}
              {`>`}{" "}
            </button>
            <h1 className="ml-5 text-3xl mr-2 dark:text-white">
              {" "}
              {months[anchor.getMonth()]}{" "}
            </h1>
            <h1 className="text-3xl mr-5 dark:text-white">
              {" "}
              {anchor.getFullYear()}{" "}
            </h1>
          </div>
          <div className="flex">
            <button
              className="
              dark:text-white bg-background-color-light dark:bg-background-color-dark rounded-l-sm px-4.5 py-0.5
                hover:cursor-pointer hover:opacity-80 duration-100 dark:hover:text-primary-color hover:text-middleground-color-dark
                ml-0.5 text-lg
              "
              onClick={() => setView("day")}
            >
              {" "}
              Day{" "}
            </button>
            <button
              className="
              dark:text-white bg-background-color-light dark:bg-background-color-dark px-4.5 py-0.5
                hover:cursor-pointer hover:opacity-80 duration-100 dark:hover:text-primary-color hover:text-middleground-color-dark
                ml-0.5 text-lg
              "
              onClick={() => setView("week")}
            >
              {" "}
              Week{" "}
            </button>
            <button
              className="
              dark:text-white bg-background-color-light dark:bg-background-color-dark rounded-r-sm px-4.5 py-0.5
                hover:cursor-pointer hover:opacity-80 duration-100 dark:hover:text-primary-color hover:text-middleground-color-dark
                ml-0.5 text-lg
              "
              onClick={() => setView("month")}
            >
              {" "}
              Month{" "}
            </button>
          </div>
        </div>
        <CalendarList
          events={events}
          start={start}
          end={end}
          month={view === "month" ? anchor.getMonth() : undefined}
        />
      </div>
      :
      <div> <h1> {error} </h1> </div>
    }
    </>
  );
}
