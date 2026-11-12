import { useState, type FormEvent } from "react";
import { handleAuth } from "../api/api.config";

const fieldClass = `
  px-3.5 py-2.5 rounded-lg
  bg-background-color-light dark:bg-background-color-dark dark:text-white
  focus:outline-none focus:ring-2 focus:ring-secondary-color
`;

type Props = {
  mode: "setup" | "login"; // setup = first run, creates the account
  onDone: () => void;
};

export function Login({ mode, onDone }: Props) {
  const isSetup = mode === "setup";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    if (isSetup && password !== form.get("confirm")) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await handleAuth(mode, username, password);
      onDone();
    } catch (err) {
      setError((err as Error).message); // e.g. "Wrong username or password"
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-center m-2 w-full rounded-md bg-middleground-color-light dark:bg-middleground-color-dark overflow-y-auto">
      <form
        onSubmit={submit}
        className="flex flex-col gap-5 w-full max-w-sm p-8 rounded-xl bg-middleground-color-light shadow-xl dark:bg-middleground-color-dark dark:text-white"
      >
        <h1 className="font-bold text-4xl text-center mb-2">
          {isSetup ? "Create your account" : "Login"}
        </h1>
        {isSetup && (
          <p className="text-sm opacity-70 text-center -mt-4">
            Set the username and password you'll use to log in.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="login-username" className="font-semibold">
            Username
          </label>
          <input
            id="login-username"
            name="username"
            required
            autoComplete="username"
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="login-password" className="font-semibold">
            Password
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            required
            minLength={isSetup ? 8 : undefined}
            autoComplete={isSetup ? "new-password" : "current-password"}
            className={fieldClass}
          />
        </div>

        {isSetup && (
          <div className="flex flex-col gap-2">
            <label htmlFor="login-confirm" className="font-semibold">
              Confirm password
            </label>
            <input
              id="login-confirm"
              name="confirm"
              type="password"
              required
              autoComplete="new-password"
              className={fieldClass}
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-primary-color">
            {error}
          </p>
        )}

        <button
          disabled={busy}
          className="mt-2 px-3.5 py-2.5 rounded-lg text-white bg-sky-500 hover:opacity-90 hover:cursor-pointer duration-150 disabled:opacity-50 disabled:cursor-wait"
        >
          {busy ? "Please wait…" : isSetup ? "Create account" : "Login"}
        </button>
      </form>
    </div>
  );
}
