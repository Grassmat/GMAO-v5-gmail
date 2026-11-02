CREATE TABLE purchase_line_receipts (
 id text PRIMARY KEY NOT NULL,
 order_id text NOT NULL,
 line_id text NOT NULL,
 part text NOT NULL,
 site text NOT NULL,
 quantity integer NOT NULL,
 actor text NOT NULL,
 created text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX purchase_line_receipts_order_line ON purchase_line_receipts(order_id,line_id);
