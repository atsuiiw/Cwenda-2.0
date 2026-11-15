import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { handleLogout } from "../api/api.config";
import { McvLogin } from "../McvLogin/McvLogin";
import { ChangePassword } from "../ChangePassword/ChangePassword";

import home from "../assets/dynnamitt_home.svg";
import calendar from "../assets/bridging-day-icon.svg";
import event from "../assets/1515717027.svg";
import account from "../assets/abstract-user-flat-1.svg";
import sun from "../assets/1340277498.svg";
import moon from "../assets/moon.svg";

const menuItemClass =
  "w-full text-left px-3 py-2 rounded-md hover:bg-secondary-color hover:text-white hover:cursor-pointer duration-100";

export type ThemeProps = { darkTheme: boolean; onThemeToggle: () => void };

export function Navbar({ darkTheme, onThemeToggle }: ThemeProps) {
  // first URL segment, e.g. /event/5 -> "EVENT"; read every render so it follows navigation
  const active = useLocation().pathname.split("/")[1].toUpperCase();
  const [mcvOpen, setMcvOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

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
    duration-100
  `;

  return (
    <>
      <div
        className={`bg-middleground-color-light dark:bg-middleground-color-dark w-20 shrink-0 m-2 py-4 rounded-md flex flex-col justify-between items-center duration-100`}
      >
        <div className="flex flex-col items-center gap-4">
          {links.map(([label, path, icon]) => {
            return (
              <button
                key={label}
                aria-current={active === label ? "page" : undefined}
                className={`${buttonClass} ${active === label ? "bg-secondary-color" : ""}`}
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
          {/* native popover: opens on click, closes on outside click or Escape */}
          <button
            className={buttonClass}
            title="Account"
            popoverTarget="account-menu"
          >
            <img src={account} alt="Account" className="w-8 h-8 dark:invert" />
          </button>
          <div
            id="account-menu"
            popover="auto"
            // popovers are centred by default; pin this one beside the account button
            className="fixed inset-auto left-24 bottom-4 m-0 p-1 w-40 rounded-lg shadow-xl bg-middleground-color-light dark:bg-middleground-color-dark dark:text-white"
          >
            <ul className="flex flex-col">
              <li>
                <button
                  className={`${menuItemClass}`}
                  popoverTarget="account-menu"
                  popoverTargetAction="hide"
                  onClick={() => setMcvOpen(true)}
                >
                  MCV login
                </button>
              </li>
              <li>
                <button
                  className={menuItemClass}
                  popoverTarget="account-menu"
                  popoverTargetAction="hide"
                  onClick={() => setPasswordOpen(true)}
                >
                  Change password
                </button>
              </li>
              <li>
                <button
                  className={`${menuItemClass} text-primary-color`}
                  // reload so AppRouter asks the backend again and shows the login screen
                  onClick={() =>
                    handleLogout().finally(() => window.location.reload())
                  }
                >
                  Log out
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <McvLogin open={mcvOpen} onClose={() => setMcvOpen(false)} />
      <ChangePassword
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />
    </>
  );
}
