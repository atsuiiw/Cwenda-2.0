import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  handleMcvLogin,
  handleMcvLogout,
  handleMcvStatus,
  type McvStatus,
} from "../api/api.config";

type Props = { open: boolean; onClose: () => void };

const fieldClass = `
  px-3 py-2 rounded-lg text-sm w-full
  bg-background-color-light dark:bg-background-color-dark
  focus:outline-none focus:ring-2 focus:ring-secondary-color
`;

// Popup to log mcv-cli in to MyCourseVille from the browser (no terminal needed).
// Same <dialog> pattern as TagManager.
export function McvLogin({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<McvStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // fresh status every time it opens
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    handleMcvStatus()
      .then((s) => !ignore && setStatus(s))
      .catch((err) => !ignore && setError(err.message));
    return () => {
      ignore = true;
    };
  }, [open]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setBusy(true);
    setError(null);
    try {
      await handleMcvLogin(
        String(form.get("username") ?? ""),
        String(form.get("password") ?? ""),
      );
      formEl.reset(); // don't leave the password sitting in the field
      setStatus({ authenticated: true });
    } catch (err) {
      setError((err as Error).message); // e.g. wrong password, from mcv-cli
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    setError(null);
    try {
      await handleMcvLogout();
      setStatus({ authenticated: false });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const statusText = !status
    ? "Checking…"
    : status.authenticated
      ? "Connected. Import From MCV is ready."
      : status.session_expired
        ? "Your MCV session expired. Log in again."
        : "Not logged in yet.";

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) =>
        e.target === dialogRef.current && dialogRef.current.close()
      } // backdrop
      className="m-auto p-0 rounded-xl shadow-xl backdrop:bg-black/40 bg-middleground-color-light dark:bg-middleground-color-dark dark:text-white"
    >
      <form onSubmit={submit} className="flex flex-col gap-4 p-6 w-80">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl">MCV login</h2>
          <button
            type="button"
            aria-label="Close"
            className="text-2xl leading-none opacity-70 hover:opacity-100 hover:cursor-pointer"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </div>

        <p
          role="status"
          className={`text-sm ${status?.authenticated ? "text-green-600 dark:text-green-400" : "opacity-70"}`}
        >
          {statusText}
        </p>

        <input
          name="username"
          aria-label="Chula username"
          placeholder="Chula username (student ID)"
          required
          autoComplete="username"
          className={fieldClass}
        />
        <input
          name="password"
          type="password"
          aria-label="MyCourseVille password"
          placeholder="MyCourseVille password"
          required
          autoComplete="current-password"
          className={fieldClass}
        />

        {error && (
          <p role="alert" className="text-sm text-primary-color">
            {error}
          </p>
        )}

        <button
          disabled={busy}
          className="px-3.5 py-2 rounded-lg text-white bg-sky-500 hover:opacity-90 hover:cursor-pointer duration-150 disabled:opacity-50 disabled:cursor-wait"
        >
          {busy
            ? "Please wait…"
            : status?.authenticated
              ? "Log in again"
              : "Log in"}
        </button>
        {status?.authenticated && (
          <button
            type="button" // not a submit: the login fields can stay empty
            disabled={busy}
            onClick={logout}
            className="px-3.5 py-2 rounded-lg text-primary-color border-2 border-primary-color hover:bg-primary-color hover:text-white hover:cursor-pointer duration-150 disabled:opacity-50 disabled:cursor-wait"
          >
            Log out of MCV
          </button>
        )}
        <p className="text-xs opacity-60">
          Sent to mcv-cli on this computer. cwenda doesn't store your password.
        </p>
      </form>
    </dialog>
  );
}
