# cwenda

A personal calendar web app. Keep events with tags, see what's coming up this week, next week
and later, and pull your MyCourseVille assignments in as events.

## Features

- **Events**: create, edit and browse events, grouped into This week / Next week / Next month / Later,
  or the past 30 days.
- **Tags**: add tags to events, filter the list by tags (match any or all), and manage tags in a popup.
- **Import From MCV**: imports your MyCourseVille assignments (with due dates) using
  [mcv-cli](https://github.com/Okumans/mcv-cli). Re-importing updates due dates and submitted status
  without overwriting your own edits.
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
cp .env.example .env   # fill in your Postgres user/password, and set PORT=8000
npm run dev
```

`PORT` must be `8000`: the frontend dev server forwards `/api` requests there
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

The backend runs mcv-cli on the same machine, using your MyCourseVille login.

```bash
uv tool install \
  --with 'git+https://github.com/Okumans/mcv-cli.git#subdirectory=packages/mcv-api' \
  'git+https://github.com/Okumans/mcv-cli.git'
mcv auth login
```

Then click **Import From MCV** on the Events page. If your MCV session expires, the app tells you to
run `mcv auth login` again. Works on macOS and Linux.

## Forgot your password?

Delete the account and the setup screen comes back (events and tags are kept):

```bash
psql -d cwenda -c "DELETE FROM app_user;"
```
