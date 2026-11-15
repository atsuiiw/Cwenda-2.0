# cwenda

A personal calendar web app. Keep events with tags, see your day and week at a glance, and pull
your MyCourseVille assignments in as events.

## Features

- **Home**: a dashboard with
  - **Today**: today's schedule on an hour grid, with a line for the current time.
  - **Next Up**: the closest upcoming event, with a live countdown.
  - **Quick Add**: create an event from a name, start time and duration (30 min / 1 h / 2 h).
  - **MCV Due Soon**: unsubmitted MyCourseVille assignments due in the next 7 days.
- **Calendar**: Month, Week and Day views (weeks start on Monday). Week and Day place events on an
  hour grid; overlapping events sit side by side. Click a date to open that day, or an event to edit it.
- **Events**: create, edit and delete events, grouped into This week / Next week / Next month / Later,
  or the past 30 days.
- **Tags**: add tags to events, filter the list by tags (match any or all), and manage tags in a popup.
- **Import From MCV**: imports your MyCourseVille assignments (with due dates) using
  [mcv-cli](https://github.com/Okumans/mcv-cli). Re-importing updates due dates and submitted status
  without overwriting your own edits. Log in and out of MCV from inside the app.
- **Login**: on first start you create a username and password; after that the app asks you to log in.
- **Light and dark mode.**

## Project layout

| Folder | What it is |
|--------|------------|
| [`backend/`](backend/) | Express + PostgreSQL API. Setup details, API reference and database notes in [`backend/README.md`](backend/README.md). |
| [`web/`](web/) | React + Vite + Tailwind frontend. |

## Requirements

- Node.js 20 or newer
- PostgreSQL (macOS: `brew install postgresql@18 && brew services start postgresql@18`)
- Optional, for Import From MCV: [uv](https://docs.astral.sh/uv/) and mcv-cli (see below)

## Run it locally

**1. Backend** (first time: database and config)

```bash
cd backend
npm install
createdb cwenda
psql -d cwenda -f db/schema.sql
cp .env.example .env   # fill in your Postgres user/password
npm run dev
```

Keep `PORT=8000` in `.env`: the frontend dev server forwards `/api` requests there
(`web/vite.config.ts`).

**2. Frontend** (in a second terminal)

```bash
cd web
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173). The first visit asks you to create
your account.

## Import From MCV (optional)

The backend runs mcv-cli on the same machine, using your MyCourseVille login. Install it once:

```bash
uv tool install \
  --with 'git+https://github.com/Okumans/mcv-cli.git#subdirectory=packages/mcv-api' \
  'git+https://github.com/Okumans/mcv-cli.git'
```

Then, in the app:

1. Click the account icon at the bottom of the sidebar → **MCV login**.
2. Enter your Chula username and MyCourseVille password. The popup shows whether you're connected.
3. Click **Import From MCV** on the Events page.

If your MCV session expires, log in again from the same popup (`mcv auth login` in a terminal also
works). **Log out of MCV** in that popup removes the saved session. cwenda doesn't store your MCV
password; mcv-cli keeps its session in your OS keyring. Works on macOS and Linux.

## Forgot your password?

Delete the account and the setup screen comes back (events and tags are kept):

```bash
psql -d cwenda -c "DELETE FROM app_user;"
```
