import { useState, useEffect } from "react";
import type { Event } from "../api/api.config";
import { handleGetEvent } from "../api/api.config";
import { EventButton, TimeGrid } from "../Calendar/TimeGrid";
import {
  daysIn,
  eventsOn,
  isToday,
  rangeFor,
  shift,
  titleFor,
  type View,
} from "./calendarLayout";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// =============== sub-functions ===============

// One month cell: the date number (click -> day view), then the events on that day.
function Card({
  day,
  events,
  faded,
  onPickDay,
}: {
  day: Date;
  events: Event[];
  faded: boolean;
  onPickDay: (day: Date) => void;
}) {
  return (
    <div
      className={`flex flex-col gap-1 min-h-24 p-1.5 rounded-md bg-background-color-light dark:bg-background-color-dark dark:text-white ${faded ? "opacity-40" : ""}`}
    >
      <button
        type="button"
        onClick={() => onPickDay(day)}
        className={`self-end text-sm px-1.5 rounded-full hover:cursor-pointer hover:opacity-70 ${isToday(day) ? "bg-primary-color text-white" : ""}`}
      >
        {day.getDate()}
      </button>
      {events.map((e) => (
        <EventButton key={e.id} event={e} />
      ))}
    </div>
  );
}

// Month view
function CalendarList({
  events,
  days,
  month,
  onPickDay,
}: {
  events: Event[];
  days: Date[];
  month: number;
  onPickDay: (day: Date) => void;
}) {
  return (
    <div className="grid gap-1 grid-cols-7 h-screen">
      {WEEKDAYS.map((w) => (
        <div key={w} className="text-center text-sm opacity-60 dark:text-white">
          {w}
        </div>
      ))}
      {days.map((day) => (
        <Card
          key={day.getTime()}
          day={day}
          events={eventsOn(events, day)}
          faded={day.getMonth() !== month}
          onPickDay={onPickDay}
        />
      ))}
    </div>
  );
}

// =============== Main ===============

const VIEWS: [View, string][] = [
  ["day", "Day"],
  ["week", "Week"],
  ["month", "Month"],
];

export function Calendar() {
  // main variables
  const [view, setView] = useState<View>("month"); // view types
  const [anchor, setAnchor] = useState<Date>(() => new Date()); // date anchor
  const [events, setEvents] = useState<Event[]>([]); // event from fetching
  const [error, setError] = useState<string | null>(null); // error
  const [loadedKey, setLoadedKey] = useState<string | null>(null); // range the events on screen came from

  // range variables
  const [start, end] = rangeFor(view, anchor);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const days = daysIn(start, end);
  // loading = the events on screen aren't for this range yet (the old ones stay until then)
  const isLoading = loadedKey !== `${startMs}-${endMs}` && !error;

  const pickDay = (day: Date) => {
    setAnchor(day);
    setView("day");
  };

  // fetching
  useEffect(() => {
    let ignore = false;
    handleGetEvent(new Date(startMs), new Date(endMs))
      .then((data) => {
        if (ignore) return;
        setEvents(data);
        setLoadedKey(`${startMs}-${endMs}`);
      })
      .catch((err) => !ignore && setError(err.message));
    return () => {
      ignore = true;
    };
  }, [startMs, endMs]);

  return (
    <>
      {!error ? (
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
                aria-label="Previous"
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
                aria-label="Next"
                onClick={() => setAnchor((a) => shift(view, a, 1))}
              >
                {" "}
                {`>`}{" "}
              </button>
              <h1 className="ml-5 text-3xl mr-5 dark:text-white">
                {titleFor(view, anchor, start, end)}
                {isLoading && (
                  <span role="status" className="ml-3 text-base opacity-60">
                    Loading…
                  </span>
                )}
              </h1>
            </div>
            <div className="flex">
              {VIEWS.map(([v, label], i) => (
                <button
                  key={v}
                  aria-pressed={view === v}
                  className={`
                  ${view === v ? "bg-secondary-color text-white" : "dark:text-white bg-background-color-light dark:bg-background-color-dark dark:hover:text-primary-color hover:text-middleground-color-dark"}
                  ${i === 0 ? "rounded-l-sm" : ""} ${i === VIEWS.length - 1 ? "rounded-r-sm" : ""}
                  px-4.5 py-0.5 ml-0.5 text-lg hover:cursor-pointer hover:opacity-80 duration-100
                `}
                  onClick={() => setView(v)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {view === "month" ? (
            <CalendarList
              events={events}
              days={days}
              month={anchor.getMonth()}
              onPickDay={pickDay}
            />
          ) : (
            <TimeGrid events={events} days={days} onPickDay={pickDay} />
          )}
        </div>
      ) : (
        <div>
          {" "}
          <h1> {error} </h1>{" "}
        </div>
      )}
    </>
  );
}
