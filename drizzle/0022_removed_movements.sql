CREATE TABLE removed_movements (
 id text PRIMARY KEY NOT NULL,
 part text NOT NULL,
 site text NOT NULL,
 quantity integer NOT NULL,
 deleted_by text NOT NULL,
 deleted_at text NOT NULL
);
