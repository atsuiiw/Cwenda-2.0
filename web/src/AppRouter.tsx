import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Home } from "./pages/HomePage";
import { Calendar } from "./pages/CalendarPage";
import { Event } from "./pages/EventPage";
import { EventEdit } from "./pages/EventEdit";
import { Navbar, type ThemeProps } from "./Navbar/Navbar";
import { Login } from "./pages/Login";
import { handleAuthStatus, type AuthStatus } from "./api/api.config";

export function AppRouter({ darkTheme, onThemeToggle }: ThemeProps) {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [check, setCheck] = useState(0); // bump to ask the backend again

  useEffect(() => {
    handleAuthStatus()
      .then(setAuth)
      .catch((err) => setAuthError(err.message));
  }, [check]);

  // no account yet -> setup; account but no session -> login; else the app
  const authMode = !auth
    ? null
    : !auth.setupDone
      ? "setup"
      : !auth.loggedIn
        ? "login"
        : null;

  return (
    <>
      <BrowserRouter>
        <div className="flex h-screen w-full bg-background-color-light dark:bg-background-color-dark duration-100">
          {!auth ? (
            authError && (
              <p className="m-auto text-primary-color">{authError}</p>
            )
          ) : authMode ? (
            <Login
              key={authMode}
              mode={authMode}
              onDone={() => setCheck((c) => c + 1)}
            />
          ) : (
            <>
              <Navbar darkTheme={darkTheme} onThemeToggle={onThemeToggle} />
              <Routes>
                <Route path="/home" element={<Home />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/event" element={<Event />} />
                <Route path="/event/:id" element={<EventEdit />} />
              </Routes>
            </>
          )}
        </div>
      </BrowserRouter>
    </>
  );
}
