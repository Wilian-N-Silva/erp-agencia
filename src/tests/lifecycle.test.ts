import { describe, expect, it } from "vitest";

import {
  canReadLifecycle,
  canWriteLifecycle,
  getLifecycleChecklistProgress,
  getLifecycleChecklistState,
} from "@/features/lifecycle/rules";
import { createAccessContext } from "@/lib/dal";

describe("lifecycle checklist rules", () => {
  it("allows RH and IT governance to write lifecycle checklists", () => {
    const hr = createAccessContext({
      userId: "hr_1",
      roles: ["hr_admin"],
    });
    const it = createAccessContext({
      userId: "it_1",
      roles: ["it_governance"],
    });
    const employee = createAccessContext({
      userId: "employee_1",
      roles: ["employee"],
    });

    expect(canReadLifecycle(hr)).toBe(true);
    expect(canWriteLifecycle(hr)).toBe(true);
    expect(canWriteLifecycle(it)).toBe(true);
    expect(canReadLifecycle(employee)).toBe(false);
  });

  it("blocks checklist completion until required items are resolved", () => {
    const pending = getLifecycleChecklistProgress({
      status: "open",
      items: [
        { required: true, status: "done" },
        { required: true, status: "pending" },
        { required: false, status: "pending" },
      ],
    });
    const resolved = getLifecycleChecklistProgress({
      status: "open",
      items: [
        { required: true, status: "done" },
        { required: true, status: "not_applicable" },
        { required: false, status: "pending" },
      ],
    });

    expect(pending.canComplete).toBe(false);
    expect(pending.requiredResolved).toBe(1);
    expect(resolved.canComplete).toBe(true);
    expect(resolved.requiredResolved).toBe(2);
  });

  it("flags open checklists past due", () => {
    expect(
      getLifecycleChecklistState(
        {
          dueDate: "2026-05-01",
          status: "open",
        },
        "2026-05-14",
      ),
    ).toBe("overdue");
    expect(
      getLifecycleChecklistState(
        {
          dueDate: "2026-05-01",
          status: "completed",
        },
        "2026-05-14",
      ),
    ).toBe("completed");
  });
});
