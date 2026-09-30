import { expect, it } from "vitest";
import { getPjReferenceToday, getPjTenureReference } from "@/features/timeoff/pj-reference-rules";

it("counts completed calendar years, months and days and keeps both annual references", () => {
  expect(getPjTenureReference("2023-10-10", null, "2026-09-30")).toMatchObject({
    years: 2, months: 11, days: 20, lastReference: "2025-10-10", nextReference: "2026-10-10",
  });
});
it("advances the reference on the anniversary without implying a vacation request", () => {
  expect(getPjTenureReference("2025-10-10", null, "2026-10-10")).toMatchObject({
    years: 1, months: 0, days: 0, lastReference: "2026-10-10", nextReference: "2027-10-10",
  });
});
it("shows the first cycle and future starts without negative tenure", () => {
  expect(getPjTenureReference("2026-01-01", null, "2026-09-30")).toMatchObject({ years: 0, months: 8, days: 29, lastReference: null, nextReference: "2027-01-01" });
  expect(getPjTenureReference("2027-01-01", null, "2026-09-30")).toMatchObject({ years: 0, months: 0, days: 0, future: true, nextReference: "2028-01-01" });
});
it("clamps February 29 references to February 28 in non-leap years", () => {
  expect(getPjTenureReference("2024-02-29", null, "2025-02-28")).toMatchObject({ years: 1, days: 0, lastReference: "2025-02-28", nextReference: "2026-02-28" });
  expect(getPjTenureReference("2024-02-29", null, "2027-03-01").nextReference).toBe("2028-02-29");
});
it("stops at termination and does not assign a new vacation reference", () => {
  expect(getPjTenureReference("2024-01-31", "2025-02-28", "2026-09-30", true)).toMatchObject({ years: 1, months: 1, days: 0, nextReference: null, ended: true });
  expect(getPjTenureReference("2024-01-31", null, "2026-09-30", true).nextReference).toBeNull();
});
it("uses the Sao Paulo calendar day instead of advancing at UTC midnight", () => {
  expect(getPjReferenceToday(new Date("2026-10-01T01:00:00Z"))).toBe("2026-09-30");
});
