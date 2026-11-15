# Backend

Express + PostgreSQL API for the calendar web app.

## Requirements

- Node.js 20 or newer
- PostgreSQL (macOS: `brew install postgresql@18 && brew services start postgresql@18`)
- Optional, for the MCV routes: mcv-cli installed with `uv tool install` (see the root
  [README](../README.md#import-from-mcv-optional)). macOS/Linux only.

## Setup

```bash
cd backend
npm install

# create the database and its tables
createdb cwenda
psql -d cwenda -f db/schema.sql

# configure
cp .env.example .env   # then edit .env with your Postgres user/password
```

Every value in `.env` is required; the server stops at startup if one is missing or empty.
With Homebrew Postgres the user is usually your macOS username, and any non-empty password works locally.

## Run

```bash
npm run dev
```

You should see `Database connected` and `Connected at port : 8000`.
Check it at http://localhost:8000/. Keep `PORT=8000`: the frontend dev server forwards `/api` there.

## API

Everything under `/api/event` and `/api/tag` needs a logged-in session (else `401`).

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/auth/status` | `{ setupDone, loggedIn, username? }` |
| POST | `/api/auth/setup` | `{ "username", "password" }` (8+ chars). First run only; `409` once an account exists. Logs in |
| POST | `/api/auth/login` | `{ "username", "password" }`; sets an HttpOnly session cookie (30 days) |
| POST | `/api/auth/logout` | |
| POST | `/api/auth/password` | `{ "currentPassword", "newPassword" }` (8+ chars, must differ). Needs a session. Wrong current password → `400`. Logs out every other browser; this one stays logged in |
| GET | `/api/event/getEvent?start_time=&end_time=` | Events in range, each with `tag_ids` |
| GET | `/api/event/getEvent/:id` | One event |
| GET | `/api/event/getEventByTags?start_time=&end_time=&tag_id=1,2&matchType=ANY` | `matchType` is `ANY` (default) or `ALL` |
| POST | `/api/event/postEvent` | JSON body; optional `tag_id: [1, 2]` |
| PUT | `/api/event/updateEvent/:id` | Send every field. Omit `tag_id` to keep tags, `[]` to remove all |
| DELETE | `/api/event/deleteEvent/:id` | |
| POST | `/api/event/importMcv` | Imports MyCourseVille assignments via mcv-cli → `{ added, updated }`. `502` with a readable `error` if mcv-cli fails (e.g. session expired) |
| GET | `/api/event/mcvStatus` | `{ authenticated, session_expired? }` for mcv-cli on this machine |
| POST | `/api/event/mcvLogin` | `{ "username", "password" }` (Chula username, MyCourseVille password). Password goes to mcv-cli over stdin and isn't stored by cwenda. Wrong login → `400` (not `401`, which the frontend reads as "cwenda session expired") |
| POST | `/api/event/mcvLogout` | Removes mcv-cli's saved session |
| GET | `/api/tag/getTag` | `[{ id, name }]` |
| POST | `/api/tag/postTag` | `{ "name": "..." }` |
| PUT | `/api/tag/updateTag/:id` | `{ "name": "..." }` |
| DELETE | `/api/tag/deleteTag/:id` | |

Dates are ISO strings, e.g. `2026-11-08T10:00:00Z`.

## Database

`db/schema.sql` is the source of truth for the tables. When you change a table,
update that file in the same commit.

Database created before login existed? Run the `app_user` and `session` `CREATE TABLE`
statements from `db/schema.sql` once.

## Login

The first time the web app opens it asks you to create a username and password; after that it
shows a login screen. Forgot the password? Remove the account and the setup screen comes back
(events and tags are kept):

```bash
psql -d cwenda -c "DELETE FROM app_user;"
```
