import { useEffect, useState } from "react";
import {
  handleGetEvent,
  handleGetTag,
  type Event as EventItem,
} from "../api/api.config";
import { useNavigate } from "react-router-dom";

// Section boundaries in local time; weeks start on Monday.
// "Next month" runs from the end of next week to the end of next calendar month.
function getSections(now: Date) {
  const y = now.getFullYear(),
    m = now.getMonth();
  const monday = now.getDate() - ((now.getDay() + 6) % 7);
  return {
    weekStart: new Date(y, m, monday),
    sections: [
      { title: "This week", before: new Date(y, m, monday + 7) },
      { title: "Next week", before: new Date(y, m, monday + 14) },
      { title: "Next month", before: new Date(y, m + 2, 1) },
      { title: "Later", before: new Date(8.64e15) }, // max Date
    ],
  };
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function Event() {
  const [data, setData] = useState<EventItem[]>([]);
  const [tagNames, setTagNames] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let ignore = false; // drop the response if the page unmounted before it arrived

    // shortcut: fetches one year ahead only; page it when there are lots of far-off events
    const from = getSections(new Date()).weekStart;
    const to = new Date(
      from.getFullYear() + 1,
      from.getMonth(),
      from.getDate(),
    );

    Promise.all([handleGetEvent(from, to), handleGetTag()])
      .then(([events, tags]) => {
        if (ignore) return;
        setData(events);
        setTagNames(new Map(tags.map((tag) => [tag.id, tag.name])));
      })
      .catch((err) => !ignore && setError(err.message));

    return () => {
      ignore = true;
    };
  }, []);

  // console.log(data);

  // each event goes in the first section it starts before (ongoing ones land in "This week")
  const { sections } = getSections(new Date());
  const grouped = sections.map((section) => ({
    ...section,
    events: [] as EventItem[],
  }));
  for (const event of data) {
    grouped
      .find((s) => new Date(event.start_time) < s.before)
      ?.events.push(event);
  }

  const buttonClass = `
    hover:cursor-pointer hover:scale-97 hover:opacity-90
    dark:text-white
    px-3.5 py-2.5
    rounded-lg
    duration-150
  `

  return (
    <>
      <div className="flex flex-col gap-6 m-2 bg-middleground-color-light dark:bg-middleground-color-dark w-full rounded-md px-20 py-12 overflow-y-auto">
        <div className="flex justify-between">
          <h1 className="text-4xl dark:text-white"> Events </h1>
          <div className="flex gap-4">
            <button className={buttonClass + 'dark:bg-gray-700 bg-gray-300'}> Past 30 days </button>
            <button className={buttonClass + 'dark:bg-gray-700 bg-gray-300'}> Manage Tags </button>
            <button className={buttonClass + 'dark:bg-gray-700 bg-gray-300'}> Import From MCV</button>
            <button className={buttonClass + 'bg-sky-500'}> New Event </button>
          </div>
        </div>
        <div>
          {error && <p className="text-primary-color">{error}</p>}
          {grouped.map(
            ({ title, events }) =>
              events.length > 0 && (
                <section key={title}>
                  <h2 className="text-2xl mb-3 dark:text-white">{title}</h2>
                  <ul>
                    {events.map((event) => (
                      <li
                        key={event.id}
                        onClick={() => navigate(`/event/${event.id}`)}
                        className="hover:opacity-90 hover:cursor-pointer flex gap-2 p-4 mb-4 rounded-lg bg-background-color-light dark:bg-background-color-dark shadow-sm dark:text-white"
                      >
                        <div className="w-3/5">
                          <h3 className="text-xl">{event.name}</h3>
                          <p className="text-sm opacity-70">
                            {formatTime(event.start_time)} –{" "}
                            {formatTime(event.end_time)}
                          </p>
                        </div>
                        <div className="justify-end content-center flex flex-wrap gap-2 w-2/5">
                          {event.tag_ids?.map((id) => (
                            <span
                              key={id}
                              className="px-3 py-1 rounded-full text-xs text-white bg-secondary-color"
                            >
                              {tagNames.get(id) ?? `#${id}`}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ),
          )}
        </div>
        
      </div>
    </>
  );
}
