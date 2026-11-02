ALTER TABLE interventions ADD COLUMN machine_hours text NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE intervention_parts ADD COLUMN unit_cost_cents integer;
