import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Home } from "./pages/HomePage";
import { Calendar } from "./pages/CalendarPage";
import { Event } from "./pages/EventPage";
import { EventEdit } from "./pages/EventEdit";
import { Navbar, type ThemeProps } from "./Navbar/Navbar";

export function AppRouter({ darkTheme, onThemeToggle }: ThemeProps) {
  return (
    <>
      <BrowserRouter>
        <div className="flex h-screen w-full bg-background-color-light dark:bg-background-color-dark duration-150">
          <Navbar darkTheme={darkTheme} onThemeToggle={onThemeToggle} />
          <Routes>
            <Route path="/home"       element={<Home />} />
            <Route path="/calendar"   element={<Calendar />} />
            <Route path="/event"      element={<Event />} />
            <Route path="/event/:id"  element={<EventEdit/>} />
          </Routes>
        </div>
      </BrowserRouter>
    </>
  );
}
