# Backend

Express + PostgreSQL API for the calendar web app.

## Requirements

- Node.js 20 or newer
- PostgreSQL (macOS: `brew install postgresql@18 && brew services start postgresql@18`)

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

You should see `Database connected` and `Connected at port : 3000`.
Check it at http://localhost:3000/.

## API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/event/getEvent?start_time=&end_time=` | Events in range, each with `tag_ids` |
| GET | `/api/event/getEvent/:id` | One event |
| GET | `/api/event/getEventByTags?start_time=&end_time=&tag_id=1,2&matchType=ANY` | `matchType` is `ANY` (default) or `ALL` |
| POST | `/api/event/postEvent` | JSON body; optional `tag_id: [1, 2]` |
| PUT | `/api/event/updateEvent/:id` | Send every field. Omit `tag_id` to keep tags, `[]` to remove all |
| DELETE | `/api/event/deleteEvent/:id` | |
| GET | `/api/tag/getTag` | `[{ id, name }]` |
| POST | `/api/tag/postTag` | `{ "name": "..." }` |
| PUT | `/api/tag/updateTag/:id` | `{ "name": "..." }` |
| DELETE | `/api/tag/deleteTag/:id` | |

Dates are ISO strings, e.g. `2026-11-08T10:00:00Z`.

## Database

`db/schema.sql` is the source of truth for the tables. When you change a table,
update that file in the same commit.
