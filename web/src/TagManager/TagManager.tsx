import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  handleCreateTag,
  handleDeleteTag,
  handleGetTag,
  handleUpdateTag,
  type Tag,
} from "../api/api.config";

type Props = { open: boolean; onClose: () => void };

const fieldClass = `
  px-3 py-1.5 rounded-lg text-sm w-full
  bg-background-color-light dark:bg-background-color-dark
  focus:outline-none focus:ring-2 focus:ring-secondary-color
`;

// Popup to create, rename and delete tags. Changes are saved right away.
export function TagManager({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // <dialog> gives Escape-to-close, focus trapping and a backdrop for free
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // fresh list every time it opens
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    handleGetTag()
      .then((all) => !ignore && setTags(all))
      .catch((err) => !ignore && setError(err.message));
    return () => {
      ignore = true;
    };
  }, [open]);

  // runs a backend call and shows its error message if it fails
  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message); // e.g. duplicate name
    }
  };

  const addTag = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      const tag = await handleCreateTag(name);
      setTags((all) => [...all, tag]);
      setNewName("");
    });
  };

  // saves when the name box loses focus (or Enter is pressed)
  const renameTag = (tag: Tag, input: HTMLInputElement) => {
    const name = input.value.trim();
    if (!name || name === tag.name) {
      input.value = tag.name; // empty or unchanged: put the old name back
      return;
    }
    run(async () => {
      try {
        const updated = await handleUpdateTag(tag.id, name);
        setTags((all) => all.map((t) => (t.id === tag.id ? updated : t)));
      } catch (err) {
        input.value = tag.name;
        throw err;
      }
    });
  };

  const deleteTag = (tag: Tag) => {
    if (!confirm(`Delete "${tag.name}"? It will be removed from every event.`))
      return;
    run(async () => {
      await handleDeleteTag(tag.id);
      setTags((all) => all.filter((t) => t.id !== tag.id));
    });
  };

  return (
    <dialog
      ref={dialogRef}
      // every way of closing (Escape, ×, backdrop) goes through dialog.close(), so onClose runs once
      onClose={onClose}
      onClick={(e) =>
        e.target === dialogRef.current && dialogRef.current.close()
      } // backdrop
      className="m-auto p-0 rounded-xl shadow-xl backdrop:bg-black/40 bg-middleground-color-light dark:bg-middleground-color-dark dark:text-white"
    >
      <div className="flex flex-col gap-4 p-6 w-80 max-h-[70vh]">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl">Manage Tags</h2>
          <button
            aria-label="Close"
            className="text-2xl leading-none opacity-70 hover:opacity-100 hover:cursor-pointer"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </div>

        <form onSubmit={addTag} className="flex gap-2">
          <input
            aria-label="New tag name"
            placeholder="New tag…"
            className={fieldClass}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="px-3 rounded-lg text-sm text-white bg-sky-500 hover:opacity-90 hover:cursor-pointer">
            Add
          </button>
        </form>

        {error && <p className="text-sm text-primary-color">{error}</p>}

        <ul className="flex flex-col gap-2 overflow-y-auto">
          {tags.map((tag) => (
            <li key={tag.id} className="flex gap-2 items-center">
              <input
                key={tag.name} // reset the box when the saved name changes
                aria-label={`Rename tag ${tag.name}`}
                defaultValue={tag.name}
                className={fieldClass}
                onBlur={(e) => renameTag(tag, e.currentTarget)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
              <button
                aria-label={`Delete tag ${tag.name}`}
                className="px-2 text-lg opacity-60 hover:opacity-100 hover:text-primary-color hover:cursor-pointer"
                onClick={() => deleteTag(tag)}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
        {tags.length === 0 && (
          <p className="text-sm opacity-60">No tags yet.</p>
        )}
      </div>
    </dialog>
  );
}
