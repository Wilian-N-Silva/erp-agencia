import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import ExcelJS from "exceljs";
import { isIsoDate } from "@/lib/validation";
import { graphicSaleMoney } from "./sale-rules";
import { GraphicImportError, graphicImportFields, graphicImportMappingSchema, type GraphicImportRow } from "./import-rules";

const maxFile = 10 * 1024 * 1024;
const maxExpanded = 40 * 1024 * 1024;

/** Bound actual inflated ZIP entries before handing a workbook to ExcelJS. */
export function validateGraphicWorkbookArchive(buffer: Buffer) {
  if (buffer.length < 22 || buffer.length > maxFile || buffer.readUInt32LE(0) !== 0x04034b50) throw new GraphicImportError("Envie um arquivo XLSX de até 10 MB.");
  let end = buffer.length - 22;
  while (end >= Math.max(0, buffer.length - 65557) && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < Math.max(0, buffer.length - 65557)) throw new GraphicImportError("Arquivo XLSX inválido.");
  const count = buffer.readUInt16LE(end + 10);
  if (!count || count > 500 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6) || buffer.readUInt16LE(end + 8) !== count) throw new GraphicImportError("Arquivo XLSX excede os limites ou usa formato não suportado.");
  let position = buffer.readUInt32LE(end + 16), total = 0;
  const directoryEnd = position + buffer.readUInt32LE(end + 12);
  if (directoryEnd !== end) throw new GraphicImportError("Estrutura XLSX inválida.");
  const names = new Set<string>();
  try {
    for (let i = 0; i < count; i++) {
      if (position + 46 > end || buffer.readUInt32LE(position) !== 0x02014b50) throw new Error();
      const flags = buffer.readUInt16LE(position + 8), method = buffer.readUInt16LE(position + 10);
      const compressed = buffer.readUInt32LE(position + 20), expanded = buffer.readUInt32LE(position + 24);
      const nameLength = buffer.readUInt16LE(position + 28), extra = buffer.readUInt16LE(position + 30), comment = buffer.readUInt16LE(position + 32);
      const name = buffer.subarray(position + 46, position + 46 + nameLength).toString("utf8");
      if (names.has(name) || name.includes("..") || name.startsWith("/") || name.includes("\\") || /vbaProject|externalLinks/i.test(name) || flags & 1 || ![0, 8].includes(method)) throw new Error();
      names.add(name);
      const local = buffer.readUInt32LE(position + 42);
      if (local + 30 > position || buffer.readUInt32LE(local) !== 0x04034b50 || buffer.readUInt16LE(local + 8) !== method || buffer.readUInt16LE(local + 6) !== flags) throw new Error();
      const localName = buffer.subarray(local + 30, local + 30 + buffer.readUInt16LE(local + 26)).toString("utf8");
      if (localName !== name) throw new Error();
      const dataStart = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      if (dataStart + compressed > position || expanded > maxExpanded - total) throw new Error();
      const bytes = buffer.subarray(dataStart, dataStart + compressed);
      const inflated = method === 8 ? inflateRawSync(bytes, { maxOutputLength: maxExpanded - total + 1 }) : bytes;
      if (inflated.length !== expanded || inflated.length > maxExpanded - total) throw new Error();
      total += inflated.length;
      position += 46 + nameLength + extra + comment;
    }
    if (position !== directoryEnd || !names.has("xl/workbook.xml") || !names.has("[Content_Types].xml")) throw new Error();
  } catch { throw new GraphicImportError("Arquivo XLSX inválido, protegido, com conteúdo externo ou acima do limite de expansão."); }
}

export async function parseGraphicWorkbook(buffer: Buffer, rawMapping: unknown) {
  const mapping = graphicImportMappingSchema.parse(rawMapping);
  validateGraphicWorkbookArchive(buffer);
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]); }
  catch { throw new GraphicImportError("Não foi possível ler a planilha XLSX."); }
  const rows: GraphicImportRow[] = [];
  for (const block of mapping.blocks) {
    const sheet = workbook.getWorksheet(block.sheet);
    if (!sheet) throw new GraphicImportError(`A aba "${block.sheet}" não existe no arquivo.`);
    for (let number = block.firstRow; number <= block.lastRow; number++) {
      const raw: Record<string, unknown> = {}, issues: string[] = [];
      for (const field of graphicImportFields) {
        const column = block.columns[field];
        if (!column) continue;
        const value = sheet.getRow(number).getCell(column).value;
        raw[field] = value instanceof Date ? value.toISOString() : value;
        if (value && typeof value === "object" && !(value instanceof Date)) issues.push(`Campo ${field} contém fórmula ou conteúdo composto; revise o valor original.`);
        if (typeof value === "string" && value.length > 4000) issues.push(`Campo ${field} excede 4.000 caracteres.`);
      }
      if (Object.values(raw).every(value => value === null || value === undefined || value === "")) continue;
      const text = (field: string) => typeof raw[field] === "string" || typeof raw[field] === "number" ? String(raw[field]).trim() : "";
      const amountResult = graphicSaleMoney.safeParse(text("amount"));
      const date = parseGraphicImportDate(raw.date, workbook.properties.date1904 === true);
      if (!amountResult.success) issues.push("Valor ausente, inválido ou fora do limite financeiro.");
      if (!date) issues.push("Data inválida; use data do Excel, AAAA-MM-DD ou DD/MM/AAAA.");
      const row: GraphicImportRow = { kind: block.kind, sourceSheet: sheet.name, sourceRow: number, raw,
        normalized: { osNumber: text("osNumber"), date, amount: amountResult.success ? amountResult.data : null, description: text("description"), client: text("client"), supplier: text("supplier"), project: text("project"), reference: text("reference") },
        classification: issues.length ? "invalid" : "clear", issues };
      if (!issues.length && block.kind === "sales" && (!row.normalized.osNumber || /[,;\n]|\s+e\s+/i.test(row.normalized.osNumber))) {
        row.classification = "ambiguous"; row.issues.push("OS ausente ou com múltiplas referências; não é possível inferir um trabalho único.");
      }
      rows.push(row);
    }
  }
  if (!rows.length) throw new GraphicImportError("Nenhuma linha de dados encontrada nos intervalos informados.");
  const frequencies = new Map<string, number>();
  for (const row of rows.filter(row => row.kind === "sales")) {
    const key = row.normalized.osNumber.toLocaleLowerCase("pt-BR");
    if (key) frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
  }
  for (const row of rows) {
    if (row.kind === "sales" && row.classification === "clear" && (frequencies.get(row.normalized.osNumber.toLocaleLowerCase("pt-BR")) ?? 0) > 1) {
      row.classification = "ambiguous"; row.issues.push("Número de OS repetido no arquivo; revise as linhas antes de criar vínculos.");
    }
  }
  return { checksum: createHash("sha256").update(buffer).digest("hex"), mapping, rows };
}

export function parseGraphicImportDate(value: unknown, date1904 = false): string | null {
  if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0 && value < 2958466) {
    if (!date1904 && value === 60) return null;
    const origin = Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30);
    value = new Date(origin + (value < 60 && !date1904 ? value + 1 : value) * 86400000).toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  let date = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(date)) date = date.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) date = `${date.slice(6)}-${date.slice(3,5)}-${date.slice(0,2)}`;
  return isIsoDate(date) && date >= "1900-01-01" && date <= "2100-12-31" ? date : null;
}
