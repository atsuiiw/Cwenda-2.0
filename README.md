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
  Change your password any time from the account menu (bottom of the sidebar) → **Change password**.
- **Light and dark mode.**

## Project layout

| Folder | What it is |
|--------|------------|
| [`backend/`](backend/) | Express + PostgreSQL API. Setup details, API reference and database notes in [`backend/README.md`](backend/README.md). |
| [`web/`](web/) | React + Vite + Tailwind frontend. |

## Run with Docker (recommended)

The easiest way to run cwenda on any computer (macOS, Windows or Linux). Docker brings the
database, Node, Python and mcv-cli, so you don't install any of them yourself.

**You need:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running) and git.

```bash
git clone https://github.com/atsuiiw/Cwenda-2.0.git cwenda
cd cwenda
cp .env.example .env      # then open .env and change both secrets
docker compose up --build -d
```

Open **http://localhost:8000** and create your account. The first build takes a few minutes;
after that it starts in seconds.

What's in `.env`:

| Setting | What it's for |
|---------|---------------|
| `POSTGRES_PASSWORD` | Password for the app's database (inside Docker). Pick anything. |
| `MCV_STORAGE_PASSPHRASE` | 8+ characters. Encrypts your saved MyCourseVille login. If you change it later, just log in to MCV again. |
| `APP_PORT` | Port on your computer (default `8000`). Change it if 8000 is already in use. |

The app is only reachable from your own computer, not from other devices on your network.

### Everyday commands

| Task | Command |
|------|---------|
| Start | `docker compose up -d` |
| Stop (keeps your data) | `docker compose down` |
| See logs | `docker compose logs -f app` |
| Update to the latest version | `git pull && docker compose up --build -d` |
| Back up your data | `docker compose exec -T db pg_dump -U cwenda --data-only cwenda > cwenda-backup.sql` |
| Restore a backup (into a fresh install, before creating an account) | `docker compose exec -T db psql -U cwenda -d cwenda < cwenda-backup.sql` |
| **Delete everything** (account, events, MCV login) | `docker compose down -v` |

Your data lives in Docker volumes, so it survives restarts, `down`, and updates. Only `down -v`
removes it.

> **Updating and the database:** the tables are created only the first time the database starts.
> If an update changes `backend/db/schema.sql`, its release notes will list the SQL to run, e.g.
> `docker compose exec db psql -U cwenda -d cwenda -c "ALTER TABLE …"`.

### Start automatically (no Docker Desktop window needed)

The Docker Desktop window isn't what runs the app. The engine behind it is. You can close the
window and cwenda keeps running, as long as Docker's whale icon is in the menu bar (macOS) or
system tray (Windows).

To have cwenda come up by itself every time you log in:

1. Docker Desktop → **Settings → General** → turn on **Start Docker Desktop when you sign in to
   your computer**.
2. Optional: in the same place, turn off **Open Docker Dashboard when Docker Desktop starts**, so
   the window doesn't pop up.
3. Run `docker compose up -d` once (you already did if you followed the steps above).

That's all: `compose.yaml` uses `restart: unless-stopped`, so the containers start whenever the
Docker engine does. They stay off only if you stopped them yourself (`docker compose stop` or
`down`) or quit Docker Desktop from the whale icon.

## Run without Docker (for development)

**Requirements**

- Node.js 20 or newer (24 recommended: production runs the backend with plain `node`)
- PostgreSQL (macOS: `brew install postgresql@18 && brew services start postgresql@18`)
- Optional, for Import From MCV: [uv](https://docs.astral.sh/uv/) and mcv-cli (see below)

If the Docker version is running on port 8000 too, set `APP_PORT=8080` in the root `.env`.

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

## Run in the background without Docker (pm2)

Runs the production build on your own machine, using your local Postgres (the setup from
"Run without Docker" above). [pm2](https://pm2.keymetrics.io/) keeps it running in the background,
restarts it if it crashes, and can start it when you log in.

```bash
npm install -g pm2

cd web && npm run build                  # build the frontend into web/dist
cd ../backend
PORT=8001 pm2 start npm --name cwenda -- start
pm2 save                                 # remember the app (and its port) for later
```

Open **http://localhost:8001**. The backend serves both the app and the API there.

**Why port 8001:** `npm run dev` (the dev backend) and the Docker version both use 8000. A `PORT`
set in the shell wins over `backend/.env`, so this copy can run next to them. Any free port works.

**Start at login:** run `pm2 startup`. It prints one `sudo …` command for your machine; run that
command once. Without it, the app runs until you restart the computer; bring it back with
`pm2 resurrect`.

| Task | Command |
|------|---------|
| Status | `pm2 status` |
| Logs | `pm2 logs cwenda` |
| After `git pull` or code changes | `cd web && npm run build && pm2 restart cwenda` |
| Stop / remove | `pm2 stop cwenda` / `pm2 delete cwenda` |

Notes:

- Frontend changes show up only after `npm run build` and `pm2 restart cwenda`: the backend serves
  whatever is in `web/dist`.
- Postgres must be running (macOS: `brew services start postgresql@18`). If it isn't, the app
  exits at startup; `pm2 logs cwenda` shows why.
- This copy uses your local `cwenda` database. The Docker version has its own separate database,
  so the two don't share events or accounts.

## Import From MCV (optional)

**With Docker:** mcv-cli is already inside, so skip the install and go straight to "in the app"
below. Your MCV login is saved (encrypted with `MCV_STORAGE_PASSPHRASE`) in a Docker volume.

**Without Docker:** the backend runs mcv-cli on the same machine. Install it once:

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
password; mcv-cli keeps its session in your OS keyring (or, with Docker, the encrypted volume).
Without Docker this works on macOS and Linux; with Docker, on any system.

## Forgot your password?

Delete the account and the setup screen comes back (events and tags are kept):

```bash
# with Docker
docker compose exec db psql -U cwenda -d cwenda -c "DELETE FROM app_user;"

# without Docker
psql -d cwenda -c "DELETE FROM app_user;"
```
