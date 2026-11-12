import { useEffect, useState } from "react";
import {
  handleGetEvent,
  handleGetTag,
  handleImportMcv,
  type Event as EventItem,
} from "../api/api.config";
import { useNavigate } from "react-router-dom";
import { TagManager } from "../TagManager/TagManager";

// Section boundaries in local time; weeks start on Monday.
// "Next month" runs from the end of next week to the end of next calendar month.
function getSections(now: Date) {
  const y = now.getFullYear(),
    m = now.getMonth();
  const monday = now.getDate() - ((now.getDay() + 6) % 7);
  return {
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
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [matchAll, setMatchAll] = useState(false); // false = Any, true = All
  const [ascending, setAscending] = useState(true);
  const [showPast, setShowPast] = useState(false); // "Past 30 days" view instead of upcoming
  const navigate = useNavigate();

  const toggleTag = (tagId: number) =>
    setSelectedTags((ids) =>
      ids.includes(tagId) ? ids.filter((x) => x !== tagId) : [...ids, tagId],
    );

  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // bump to fetch events again

  const importMcv = async () => {
    setImporting(true);
    setError(null);
    setNotice(null);
    try {
      const { added, updated } = await handleImportMcv();
      setNotice(`MCV import: ${added} added, ${updated} updated.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError((err as Error).message); // e.g. "MCV session expired. Run `mcv auth login`…"
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    // wait while the tag manager is open; closing it reloads, so renamed/deleted tags show up
    if (tagManagerOpen) return;
    let ignore = false; // drop the response if the page unmounted before it arrived

    const now = new Date();
    // past view: the last 30 days up to now.
    // upcoming view (shortcut): one year ahead only; page it when there are lots of far-off events
    const from = showPast
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
      : now;
    const to = showPast
      ? now
      : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

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
  }, [showPast, tagManagerOpen, reloadKey]);

  // console.log(data);

  // skip selected tags that were deleted in the tag manager
  const activeTags = selectedTags.filter((t) => tagNames.has(t));

  // no tag selected = show everything
  const filtered =
    activeTags.length === 0
      ? data
      : data.filter((event) => {
          const ids = event.tag_ids ?? [];
          return matchAll
            ? activeTags.every((t) => ids.includes(t))
            : activeTags.some((t) => ids.includes(t));
        });

  // the past view is one section; "before: max Date" lets every event in
  const sections = showPast
    ? [{ title: "Past 30 days", before: new Date(8.64e15) }]
    : getSections(new Date()).sections;
  const grouped = sections.map((section) => ({
    ...section,
    events: [] as EventItem[],
  }));
  for (const event of filtered) {
    grouped
      .find((s) => new Date(event.start_time) < s.before)
      ?.events.push(event);
  }

  const ordered = ascending
    ? grouped
    : grouped.map((s) => ({ ...s, events: [...s.events].reverse() })).reverse();

  const pillClass = `
    px-3 py-1 rounded-full text-xs hover:cursor-pointer hover:opacity-90 duration-150
  `;
  const unselectedPill = "bg-gray-300 dark:bg-gray-700 dark:text-white";

  const buttonClass = `
    hover:cursor-pointer hover:scale-97 hover:opacity-90
    dark:text-white
    px-3.5 py-2.5
    rounded-lg
    duration-150
  `;

  return (
    <>
      <div className="flex flex-col gap-6 m-2 bg-middleground-color-light dark:bg-middleground-color-dark w-full rounded-md px-20 py-12 overflow-y-auto">
        <div className="flex justify-between">
          <h1 className="text-4xl dark:text-white"> Events </h1>
          <div className="flex gap-4">
            <button
              aria-pressed={showPast}
              className={
                buttonClass +
                (showPast
                  ? "bg-secondary-color text-white"
                  : "dark:bg-gray-700 bg-gray-300")
              }
              onClick={() => setShowPast((p) => !p)}
            >
              {showPast ? "Upcoming" : "Past 30 days"}
            </button>
            <button
              className={buttonClass + "dark:bg-gray-700 bg-gray-300"}
              onClick={() => setTagManagerOpen(true)}
            >
              Manage Tags
            </button>
            <TagManager
              open={tagManagerOpen}
              onClose={() => setTagManagerOpen(false)}
            />
            <button
              className={
                buttonClass +
                "dark:bg-gray-700 bg-gray-300 disabled:opacity-50 disabled:cursor-wait"
              }
              onClick={importMcv}
              disabled={importing}
            >
              {importing ? "Importing…" : "Import From MCV"}
            </button>
            <button
              className={buttonClass + "bg-sky-500"}
              onClick={() => navigate(`/event/add`)}
            >
              {" "}
              New Event{" "}
            </button>
          </div>
        </div>
        {/* sort, match type, tag filters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={pillClass + unselectedPill}
            onClick={() => setAscending((a) => !a)}
          >
            {ascending ? "↑ Ascending" : "↓ Descending"}
          </button>
          <button
            className={pillClass + unselectedPill}
            onClick={() => setMatchAll((m) => !m)}
            title="Any: has at least one selected tag. All: has every selected tag."
          >
            Match: {matchAll ? "All" : "Any"}
          </button>
          <span className="w-px h-5 mx-1 bg-gray-400" aria-hidden />
          {[...tagNames].map(([tagId, name]) => {
            const selected = selectedTags.includes(tagId);
            return (
              <button
                key={tagId}
                aria-pressed={selected}
                className={
                  pillClass +
                  (selected ? "bg-secondary-color text-white" : unselectedPill)
                }
                onClick={() => toggleTag(tagId)}
              >
                {name}
              </button>
            );
          })}
        </div>

        <div>
          {error && <p className="text-primary-color">{error}</p>}
          {notice && <p className="opacity-70 dark:text-white">{notice}</p>}
          {activeTags.length > 0 && filtered.length === 0 && (
            <p className="opacity-70 dark:text-white">
              No events match these tags.
            </p>
          )}
          {ordered.map(
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
