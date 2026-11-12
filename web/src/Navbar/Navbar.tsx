import { useNavigate } from "react-router-dom";
import { handleLogout } from "../api/api.config";

import home from "../assets/dynnamitt_home.svg";
import calendar from "../assets/bridging-day-icon.svg";
import event from "../assets/1515717027.svg";
import account from "../assets/abstract-user-flat-1.svg";
import sun from "../assets/1340277498.svg";
import moon from "../assets/moon.svg";

export type ThemeProps = { darkTheme: boolean; onThemeToggle: () => void };

export function Navbar({ darkTheme, onThemeToggle }: ThemeProps) {
  const navigate = useNavigate();
  // [label, path, icon?] — icon replaces the text; label stays as alt text
  const links: string[][] = [
    ["HOME", "/home", home],
    ["CALENDAR", "/calendar", calendar],
    ["EVENT", "/event", event],
  ];

  const buttonClass: string = `
    hover:cursor-pointer hover:bg-secondary-color
    text-black dark:text-white rounded-lg p-2
    duration-150
  `;

  return (
    <>
      <div
        className={`bg-middleground-color-light dark:bg-middleground-color-dark w-20 shrink-0 m-2 py-4 rounded-md flex flex-col justify-between items-center`}
      >
        <div className="flex flex-col items-center gap-4">
          {links.map(([label, path, icon]) => {
            return (
              <button
                key={label}
                className={buttonClass}
                onClick={() => {
                  navigate(path);
                }}
              >
                {icon ? (
                  <img src={icon} alt={label} className="w-8 h-8 dark:invert" />
                ) : (
                  label
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col items-center gap-2">
          <button className={buttonClass} onClick={onThemeToggle}>
            <img src={darkTheme ? moon : sun} className="w-8 h-8 dark:invert" />
          </button>
          <button
            className={buttonClass}
            title="Log out"
            // reload so AppRouter asks the backend again and shows the login screen
            onClick={() =>
              handleLogout().finally(() => window.location.reload())
            }
          >
            <img src={account} alt="Log out" className="w-8 h-8 dark:invert" />
          </button>
        </div>
      </div>
    </>
  );
}
