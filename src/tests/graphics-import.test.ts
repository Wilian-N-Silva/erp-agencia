import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseGraphicImportDate, parseGraphicWorkbook, validateGraphicWorkbookArchive } from "@/features/graphics/import-xlsx";
import { graphicImportMappingSchema } from "@/features/graphics/import-rules";

const block = { kind: "sales", sheet: "Histórico", firstRow: 2, lastRow: 6, columns: { osNumber: 1, date: 2, amount: 3, client: 4, project: 5 } };
async function fixture() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Histórico");
  sheet.addRow(["OS", "Data", "Valor", "Cliente", "Projeto"]);
  sheet.addRow(["OS-1", "21/09/2026", "1.200,50", "Cliente A", "Cafu Camp"]);
  sheet.addRow(["OS-2", new Date("2026-09-22T00:00:00Z"), 300, "Cliente B"]);
  sheet.addRow(["OS-2", "2026-09-23", 200, "Cliente B"]);
  sheet.addRow(["859 e 856", "2026-09-23", 100]);
  sheet.addRow(["OS-6", "31/02/2026", { formula: "1+1", result: 2 }]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
describe("GRF-013 deterministic XLSX parsing", () => {
  it("preserves row provenance, original values and project without guessing duplicate or multi-OS links", async () => {
    const bytes = await fixture();
    const result = await parseGraphicWorkbook(bytes, { blocks: [block] });
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(result.rows).toHaveLength(5);
    expect(result.rows[0]).toMatchObject({ sourceSheet: "Histórico", sourceRow: 2, raw: { amount: "1.200,50" }, normalized: { amount: "1200.50", date: "2026-09-21", project: "Cafu Camp" }, classification: "clear" });
    expect(result.rows.map(row => row.classification)).toEqual(["clear", "ambiguous", "ambiguous", "ambiguous", "invalid"]);
    expect(result.rows[4].raw.amount).toMatchObject({ formula: "1+1" });
    expect((await parseGraphicWorkbook(bytes, { blocks: [block] })).checksum).toBe(result.checksum);
  });
  it("parses independent incoming and outgoing blocks without assigning any OS or sale link", async () => {
    const bytes = await fixture();
    const result = await parseGraphicWorkbook(bytes, { blocks: [{ ...block, kind: "incoming", firstRow: 2, lastRow: 2 }, { ...block, kind: "outgoing", firstRow: 3, lastRow: 3 }] });
    expect(result.rows.map(row => row.kind)).toEqual(["incoming", "outgoing"]);
    expect(result.rows.every(row => row.classification === "clear")).toBe(true);
    expect(result.rows[0].normalized).not.toHaveProperty("jobId");
  });
  it("rejects invalid archives, excessive sizes, encrypted ZIP flags and unknown sheets", async () => {
    expect(() => validateGraphicWorkbookArchive(Buffer.from("not xlsx"))).toThrow();
    expect(() => validateGraphicWorkbookArchive(Buffer.alloc(11 * 1024 * 1024))).toThrow();
    const bytes = await fixture();
    const modified = Buffer.from(bytes);
    const central = modified.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    modified.writeUInt16LE(modified.readUInt16LE(central + 8) | 1, central + 8);
    expect(() => validateGraphicWorkbookArchive(modified)).toThrow();
    await expect(parseGraphicWorkbook(bytes, { blocks: [{ ...block, sheet: "Inexistente" }] })).rejects.toThrow("não existe");
  });
  it("validates mapping limits and parses dates explicitly including Excel's fictitious leap day", () => {
    expect(graphicImportMappingSchema.safeParse({ blocks: [block, block] }).success).toBe(false);
    expect(graphicImportMappingSchema.safeParse({ blocks: [{ ...block, columns: { date: 1, amount: 1 } }] }).success).toBe(false);
    expect(parseGraphicImportDate("03/04/2026")).toBe("2026-04-03");
    expect(parseGraphicImportDate(61)).toBe("1900-03-01");
    expect(parseGraphicImportDate(60)).toBeNull();
    expect(parseGraphicImportDate(1, true)).toBe("1904-01-02");
    expect(parseGraphicImportDate("2026-02-30")).toBeNull();
  });
});
