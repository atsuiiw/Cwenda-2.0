import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { handleGetEventById, type Event as EventItem } from "../api/api.config";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function EventEdit() {
  const { id } = useParams(); // the ":id" part of /event/:id
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false; // drop the response if the user left or moved to another id

    // shortcut: no reset when :id changes in place; add one if this page ever links to another event
    handleGetEventById(Number(id))
      .then((result) => !ignore && setEvent(result))
      .catch((err) => !ignore && setError(err.message));

    return () => {
      ignore = true;
    };
  }, [id]);

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
          <h1 className="text-4xl">{event.name}</h1>
          <p className="opacity-70">
            {formatTime(event.start_time)} – {formatTime(event.end_time)}
            {event.timezone && ` (${event.timezone})`}
          </p>
          {event.description && (
            <p className="whitespace-pre-line">{event.description}</p>
          )}
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
        </>
      )}
    </div>
  );
}
