import { z } from "zod";

export const graphicImportKinds = ["sales", "outgoing", "incoming"] as const;
export const graphicImportFields = ["osNumber", "date", "amount", "description", "client", "supplier", "project", "reference"] as const;
const column = z.number().int().min(1).max(100);
export const graphicImportMappingSchema = z.strictObject({
  blocks: z.array(z.strictObject({
    kind: z.enum(graphicImportKinds), sheet: z.string().trim().min(1).max(100),
    firstRow: z.number().int().min(1).max(10001), lastRow: z.number().int().min(1).max(10001),
    columns: z.strictObject({ osNumber: column.optional(), date: column, amount: column, description: column.optional(), client: column.optional(), supplier: column.optional(), project: column.optional(), reference: column.optional() }),
  }).superRefine((block, ctx) => {
    if (block.lastRow < block.firstRow) ctx.addIssue({ code: "custom", message: "A última linha deve ser posterior à primeira." });
    const columns = Object.values(block.columns);
    if (new Set(columns).size !== columns.length) ctx.addIssue({ code: "custom", message: "Cada campo deve usar uma coluna distinta dentro do bloco." });
  })).min(1).max(3),
}).superRefine((mapping, ctx) => {
  if (new Set(mapping.blocks.map(block => block.kind)).size !== mapping.blocks.length) ctx.addIssue({ code: "custom", message: "Mapeie cada bloco apenas uma vez." });
  if (mapping.blocks.reduce((sum, block) => sum + block.lastRow - block.firstRow + 1, 0) > 10000) ctx.addIssue({ code: "custom", message: "Importe até 10.000 linhas por arquivo." });
  for (let i = 0; i < mapping.blocks.length; i++) for (const other of mapping.blocks.slice(i + 1)) {
    const block = mapping.blocks[i];
    if (block.sheet === other.sheet && block.firstRow <= other.lastRow && other.firstRow <= block.lastRow && Object.values(block.columns).some(value => Object.values(other.columns).includes(value))) ctx.addIssue({ code: "custom", message: "Os blocos não podem compartilhar as mesmas células de origem." });
  }
});
export type GraphicImportMapping = z.infer<typeof graphicImportMappingSchema>;
export type GraphicImportRow = {
  kind: (typeof graphicImportKinds)[number]; sourceSheet: string; sourceRow: number;
  raw: Record<string, unknown>;
  normalized: { osNumber: string; date: string | null; amount: string | null; description: string; client: string; supplier: string; project: string; reference: string };
  classification: "clear" | "ambiguous" | "invalid";
  issues: string[];
};
export class GraphicImportError extends Error {}
