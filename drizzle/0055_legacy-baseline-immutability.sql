-- Include the new immutable baseline column in the existing title guards.
DROP TRIGGER financial_entries_allocated_title_guard ON financial_entries;
--> statement-breakpoint
CREATE TRIGGER financial_entries_allocated_title_guard
BEFORE UPDATE OF amount, status, deleted_at, legacy_settled_amount ON financial_entries
FOR EACH ROW EXECUTE FUNCTION fin_004_guard_allocated_title_update();
--> statement-breakpoint
DROP TRIGGER financial_expenses_allocated_title_guard ON financial_expenses;
--> statement-breakpoint
CREATE TRIGGER financial_expenses_allocated_title_guard
BEFORE UPDATE OF amount, status, deleted_at, legacy_settled_amount ON financial_expenses
FOR EACH ROW EXECUTE FUNCTION fin_004_guard_allocated_title_update();
