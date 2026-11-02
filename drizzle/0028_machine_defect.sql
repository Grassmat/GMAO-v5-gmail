ALTER TABLE interventions ADD defect_note TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE interventions ADD defect_resolved INTEGER NOT NULL DEFAULT 0;
