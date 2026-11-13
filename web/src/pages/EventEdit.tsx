import { useEffect, useState, type KeyboardEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  handleCreateTag,
  handleGetEventById,
  handlePostEvent,
  handleGetTag,
  handleUpdateEvent,
  handleDeleteEvent,
  type Event as EventItem,
  type Tag,
} from "../api/api.config";

// ISO timestamp → "YYYY-MM-DDTHH:mm" in the browser's local time, the format datetime-local wants.
// new Date(thatString) turns it back into a Date (read as local time).
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

// /event/add opens this page for a new event (nothing is stored until Save).
const NEW_EVENT_ID = "add";

// A new event starts at the next full hour and lasts an hour, in the browser's time zone.
function blankEvent(): EventItem {
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  return {
    id: 0,
    name: "",
    description: null,
    associate_links: null,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    mcv_ref: null,
    mcv_submitted: null,
    tag_ids: [],
  };
}

const pickerClass = `
  px-3 py-1.5 rounded-lg text-sm
  bg-background-color-light dark:bg-background-color-dark shadow-sm
  hover:cursor-pointer hover:opacity-90 duration-150
  focus:outline-none focus:ring-2 focus:ring-secondary-color
  [&::-webkit-calendar-picker-indicator]:cursor-pointer
`;

export function EventEdit() {
  const { id } = useParams(); // the ":id" part of /event/:id
  const isNew = id === NEW_EVENT_ID;
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [tags, setTags] = useState<Tag[]>([]); // every tag that exists
  const [tagIds, setTagIds] = useState<number[]>([]); // tags on this event (saved with Save)
  const [newTag, setNewTag] = useState("");
  const [showNewTag, setShowNewTag] = useState(false);

  useEffect(() => {
    let ignore = false; // drop the response if the user left or moved to another id

    // shortcut: no reset when :id changes in place; add one if this page ever links to another event
    const load =
      id === NEW_EVENT_ID
        ? Promise.resolve(blankEvent())
        : handleGetEventById(Number(id));

    Promise.all([load, handleGetTag()])
      .then(([result, tags]) => {
        if (ignore) return;
        setEvent(result);
        setTags(tags);
        setTagIds(result.tag_ids ?? []);
        setTitle(result.name ?? ""); // name can be null in the DB
        setDescription(result.description ?? "");
        setStartTime(toLocalInput(result.start_time));
        setEndTime(toLocalInput(result.end_time));
      })
      .catch((err) => !ignore && setError(err.message));

    return () => {
      ignore = true;
    };
  }, [id]);

  const [saving, setSaving] = useState(false);
  const [deleting,setDeleting] = useState(false);

  // Cancel throws away unsaved edits: nothing was sent, so just leave.
  const handleCancel = () => navigate("/event");

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try{
      await handleDeleteEvent(Number(id));
      navigate("/event");
    }
    catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  }

  const handleSave = async () => {
    if (!event) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...event, // keeps fields this page doesn't edit (links, timezone, mcv_*)
        name: title,
        description,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        tag_id: tagIds,
      };
      // the backend ignores body.id on create; the DB picks the id
      await (isNew ? handlePostEvent(body) : handleUpdateEvent(body));
      navigate("/event");
    } catch (err) {
      setError((err as Error).message); // e.g. "name is required"
      setSaving(false);
    }
  };

  const tagName = (tagId: number) =>
    tags.find((t) => t.id === tagId)?.name ?? `#${tagId}`;
  const availableTags = tags.filter((t) => !tagIds.includes(t.id));
  const addTag = (tagId: number) =>
    setTagIds((ids) => (ids.includes(tagId) ? ids : [...ids, tagId]));
  const removeTag = (tagId: number) =>
    setTagIds((ids) => ids.filter((x) => x !== tagId));

  // Space turns the typed text into a tag on this event; Escape gives up.
  const handleNewTagKey = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setNewTag("");
      setShowNewTag(false);
      return;
    }
    if (e.key !== " ") return;
    e.preventDefault(); // the space ends the tag, it isn't part of the name
    const name = newTag.trim();
    if (!name) return;
    setNewTag(""); // clear first so a second Space can't create it twice
    setShowNewTag(false);
    try {
      // names are unique in the DB, so reuse a matching tag instead of a 409
      const existing = tags.find(
        (t) => t.name.toLowerCase() === name.toLowerCase(),
      );
      const tag = existing ?? (await handleCreateTag(name));
      if (!existing) setTags((all) => [...all, tag]);
      addTag(tag.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const links = Array.isArray(event?.associate_links)
    ? (event.associate_links as string[])
    : [];

  return (
    <div className="flex flex-col gap-4 m-2 bg-middleground-color-light dark:bg-middleground-color-dark w-full rounded-md px-20 py-12 overflow-y-auto dark:text-white">
      <button
        className="self-start hover:cursor-pointer opacity-70 hover:opacity-100"
        onClick={() => navigate("/event")}
      >
        ← Back to events
      </button>

      {error && <p className="text-primary-color">{error}</p>}
      {!event && !error && <p className="opacity-70">Loading…</p>}

      {event && (
        <>
          {/* Title */}
          <input
            className="text-4xl px-3.5 py-2.5"
            type="text"
            placeholder="Add Title..."
            value={title}
            onChange={(value) => setTitle(value.target.value)}
          />

          {/* time */}
          <div className="flex flex-wrap items-center gap-2 px-3.5 dark:scheme-dark">
            <input
              type="datetime-local"
              aria-label="Start time"
              className={pickerClass}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <span className="opacity-50">→</span>
            <input
              type="datetime-local"
              aria-label="End time"
              className={pickerClass}
              min={startTime} // picker won't offer an end before the start
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
            {event.timezone && (
              <span className="text-sm opacity-60">{event.timezone}</span>
            )}
          </div>

          {/* tags */}
          <div className="flex flex-col gap-2 px-3.5 dark:scheme-dark">
            {tagIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {tagIds.map((tagId) => (
                  <span
                    key={tagId}
                    className="group flex items-center gap-1 px-3 py-1 rounded-full text-xs text-white bg-secondary-color"
                  >
                    {tagName(tagId)}
                    <button
                      type="button"
                      aria-label={`Remove tag ${tagName(tagId)}`}
                      onClick={() => removeTag(tagId)}
                      // hidden until hover; also shown on keyboard focus
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 hover:cursor-pointer leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-2">
              {availableTags.length > 0 && (
                <select
                  aria-label="Add an existing tag"
                  className={pickerClass + " text-xs"}
                  value=""
                  onChange={(e) => addTag(Number(e.target.value))}
                >
                  <option value="" disabled>
                    + Add tag
                  </option>
                  {availableTags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}

              {showNewTag ? (
                <input
                  autoFocus
                  aria-label="New tag name"
                  placeholder="Type, then Space"
                  className={pickerClass + " text-xs w-36"}
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleNewTagKey}
                  onBlur={() => !newTag && setShowNewTag(false)}
                />
              ) : (
                <button
                  type="button"
                  className={pickerClass + " text-xs"}
                  onClick={() => setShowNewTag(true)}
                >
                  + New tag
                </button>
              )}
            </div>
          </div>

          {/* description */}
          <textarea
            // field-sizing-content grows the box with the text; rows is the fallback height (e.g. Firefox)
            className="text-base resize-none field-sizing-content px-3.5 py-2.5"
            rows={3}
            placeholder="Add Description..."
            value={description}
            onChange={(value) => setDescription(value.target.value)}
          />
          {links.length > 0 && (
            <ul className="list-disc pl-5">
              {links.map((link) => (
                <li key={link}>
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          )}

          {/* Save and Cancel */}
          <div className="flex gap-2 absolute bottom-15 right-20">
            { id !== NEW_EVENT_ID && (
              <button
                className="text-2xl px-3.5 py-2.5 bg-red-500 rounded-lg hover:cursor-pointer hover:opacity-90 hover:scale-95 duration-100"
                onClick={handleDelete}
                disabled={deleting}
              >
                {" "}
                {deleting ? "Deleting" : "Delete"}{" "}
              </button>
              )
            }
            <button
              className="text-2xl px-3.5 py-2.5 bg-slate-400 rounded-lg hover:cursor-pointer hover:opacity-90 hover:scale-95 duration-100"
              onClick={handleCancel}
            >
              {" "}
              Cancel{" "}
            </button>
            <button
              className="text-2xl px-3.5 py-2.5 bg-green-500 rounded-lg hover:cursor-pointer hover:opacity-90 hover:scale-95 duration-100 disabled:opacity-50 disabled:cursor-wait"
              onClick={handleSave}
              disabled={saving}
            >
              {" "}
              {saving ? "Saving…" : "Save"}{" "}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
