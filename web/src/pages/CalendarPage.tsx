import { useState, useEffect, useRef, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import type { Event } from "../api/api.config";
import { handleGetEvent } from "../api/api.config";
import {
  daysIn,
  eventsOn,
  layoutDay,
  rangeFor,
  shift,
  titleFor,
  type View,
} from "./calendarLayout";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_PX = 48; // height of one hour in day/week view
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const isToday = (day: Date) => day.toDateString() === new Date().toDateString();

// =============== sub-functions ===============

function EventButton({
  event,
  className = "",
  style,
}: {
  event: Event;
  className?: string;
  style?: CSSProperties;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      title={event.name ?? ""}
      style={style}
      onClick={() => navigate(`/event/${event.id}`)}
      className={`flex items-start min-w-0 text-left text-xs px-1.5 py-0.5 rounded bg-secondary-color text-white hover:cursor-pointer hover:opacity-80 duration-100 ${className}`}
    >
      <span className="truncate">{event.name || "(untitled)"}</span>
    </button>
  );
}

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

// Day and week view: one column per day, events placed by time.
function TimeGrid({
  events,
  days,
  onPickDay,
}: {
  events: Event[];
  days: Date[];
  onPickDay: (day: Date) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // open around 08:00, or just before now if that's later
    const hour = Math.max(8, new Date().getHours() - 1);
    scrollRef.current?.scrollTo({ top: hour * HOUR_PX });
  }, []);

  const layouts = days.map((day) => layoutDay(events, day));
  const hasAllDay = layouts.some((l) => l.allDay.length > 0);
  const cols = {
    gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`,
  };
  const now = new Date();
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX;
  // a faint line every hour, in both themes
  const hourLines = `repeating-linear-gradient(to bottom, transparent 0 ${HOUR_PX - 1}px, rgb(128 128 128 / 0.2) ${HOUR_PX - 1}px ${HOUR_PX}px)`;

  return (
    <div className="flex flex-col flex-1 min-h-0 dark:text-white">
      {/* date headers (click -> day view) and the all-day row */}
      <div className="grid gap-1" style={cols}>
        <div />
        {days.map((day) => (
          <button
            key={day.getTime()}
            type="button"
            onClick={() => onPickDay(day)}
            className="flex flex-col items-center py-1 rounded-md hover:cursor-pointer hover:bg-background-color-light dark:hover:bg-background-color-dark duration-100"
          >
            <span className="text-sm opacity-60">
              {day.toLocaleDateString(undefined, { weekday: "short" })}
            </span>
            <span
              className={`text-lg px-2 rounded-full ${isToday(day) ? "bg-primary-color text-white" : ""}`}
            >
              {day.getDate()}
            </span>
          </button>
        ))}
        {hasAllDay && (
          <>
            <div className="text-xs opacity-60 text-right pr-2 self-center">
              all-day
            </div>
            {layouts.map(({ allDay }, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                {allDay.map((e) => (
                  <EventButton key={e.id} event={e} />
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      {/* 24-hour grid; scrolls on its own so the headers stay put */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto mt-1">
        <div className="grid gap-1" style={cols}>
          <div className="relative" style={{ height: 24 * HOUR_PX }}>
            {HOURS.slice(1).map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-xs opacity-60"
                style={{ top: h * HOUR_PX }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {days.map((day, i) => (
            <div
              key={day.getTime()}
              className="relative rounded-md bg-background-color-light dark:bg-background-color-dark"
              style={{ height: 24 * HOUR_PX, backgroundImage: hourLines }}
            >
              {layouts[i].blocks.map(({ event, top, height, lane, lanes }) => (
                <EventButton
                  key={event.id}
                  event={event}
                  className="absolute"
                  style={{
                    top: (top / 60) * HOUR_PX,
                    height: (height / 60) * HOUR_PX - 2,
                    left: `${(lane / lanes) * 100}%`,
                    width: `calc(${100 / lanes}% - 2px)`,
                  }}
                />
              ))}
              {/* shortcut: the now line only moves when the page re-renders; add a 1-min timer if that bugs you */}
              {isToday(day) && (
                <div
                  className="absolute inset-x-0 border-t-2 border-primary-color pointer-events-none"
                  style={{ top: nowTop }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
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

  // range variables
  const [start, end] = rangeFor(view, anchor);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const days = daysIn(start, end);

  const pickDay = (day: Date) => {
    setAnchor(day);
    setView("day");
  };

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
