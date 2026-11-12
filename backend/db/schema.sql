-- Database schema for the calendar backend.
-- Create a fresh database: psql -d <db_name> -f db/schema.sql
-- Keep this file in sync whenever a table changes.

CREATE TABLE event (
    id              serial PRIMARY KEY,
    name            varchar(255),
    description     text,
    associate_links jsonb,
    start_time      timestamptz,
    end_time        timestamptz,
    timezone        varchar(255),
    mcv_ref         text,
    mcv_submitted   boolean
);

CREATE UNIQUE INDEX event_mcv_ref_key ON event (mcv_ref);

CREATE TABLE tag (
    id   serial PRIMARY KEY,
    name varchar(255) CONSTRAINT tag_name_key UNIQUE
);

-- Links events and tags (many-to-many). Rows vanish when either side is deleted.
CREATE TABLE junction (
    event_id integer NOT NULL CONSTRAINT fk_event REFERENCES event (id) ON DELETE CASCADE,
    tag_id   integer NOT NULL CONSTRAINT fk_tag   REFERENCES tag (id)   ON DELETE CASCADE,
    PRIMARY KEY (event_id, tag_id)
);

-- The primary key covers lookups by event_id; this covers lookups by tag_id.
CREATE INDEX junction_tag_id_idx ON junction (tag_id);

-- The app's owner, created once on the first-run setup screen.
CREATE TABLE app_user (
    id            serial PRIMARY KEY,
    username      varchar(255) NOT NULL UNIQUE,
    password_hash text NOT NULL -- "scrypt$<salt hex>$<hash hex>"
);

-- Logged-in browsers. Only a hash of the cookie token is stored.
CREATE TABLE session (
    token_hash text PRIMARY KEY, -- sha256 of the cookie token
    user_id    integer NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
);

-- Not applied yet. The API already checks these; uncomment to enforce them in the database too.
-- ALTER TABLE event ADD CONSTRAINT event_time_order CHECK (end_time >= start_time);
-- ALTER TABLE event ALTER COLUMN name SET NOT NULL;
