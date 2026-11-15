import { useEffect, useRef, useState, type FormEvent } from "react";
import { handleChangePassword } from "../api/api.config";

type Props = { open: boolean; onClose: () => void };

const fieldClass = `
  px-3 py-2 rounded-lg text-sm w-full
  bg-background-color-light dark:bg-background-color-dark
  focus:outline-none focus:ring-2 focus:ring-secondary-color
`;

// Popup to change the cwenda password. Same <dialog> pattern as TagManager / McvLogin.
export function ChangePassword({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const current = String(form.get("current") ?? "");
    const next = String(form.get("next") ?? "");
    if (next !== form.get("confirm")) {
      setError("New passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await handleChangePassword(current, next);
      formEl.reset(); // don't leave passwords sitting in the fields
      setDone(true);
    } catch (err) {
      setError((err as Error).message); // e.g. "Current password is wrong"
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={() => {
        setError(null);
        setDone(false);
        onClose();
      }}
      onClick={(e) =>
        e.target === dialogRef.current && dialogRef.current.close()
      } // backdrop
      className="m-auto p-0 rounded-xl shadow-xl backdrop:bg-black/40 bg-middleground-color-light dark:bg-middleground-color-dark dark:text-white"
    >
      <form onSubmit={submit} className="flex flex-col gap-4 p-6 w-80">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl">Change password</h2>
          <button
            type="button"
            aria-label="Close"
            className="text-2xl leading-none opacity-70 hover:opacity-100 hover:cursor-pointer"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </div>

        <input
          name="current"
          type="password"
          aria-label="Current password"
          placeholder="Current password"
          required
          autoComplete="current-password"
          className={fieldClass}
        />
        <input
          name="next"
          type="password"
          aria-label="New password"
          placeholder="New password (8+ characters)"
          required
          minLength={8}
          autoComplete="new-password"
          className={fieldClass}
        />
        <input
          name="confirm"
          type="password"
          aria-label="Confirm new password"
          placeholder="Confirm new password"
          required
          autoComplete="new-password"
          className={fieldClass}
        />

        {error && (
          <p role="alert" className="text-sm text-primary-color">
            {error}
          </p>
        )}
        {done && (
          <p
            role="status"
            className="text-sm text-green-600 dark:text-green-400"
          >
            Password changed. Other browsers have been logged out.
          </p>
        )}

        <button
          disabled={busy}
          className="px-3.5 py-2 rounded-lg text-white bg-sky-500 hover:opacity-90 hover:cursor-pointer duration-150 disabled:opacity-50 disabled:cursor-wait"
        >
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </dialog>
  );
}
