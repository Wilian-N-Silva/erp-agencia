import { z } from "zod";

export const workItemPriorities = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const workItemStatuses = [
  "open",
  "in_progress",
  "resolved",
  "dismissed",
] as const;

const optionalUserIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const optionalEmployeeIdSchema = z
  .string()
  .uuid()
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const generateWorkItemInputSchema = z
  .strictObject({
    kind: z.string().trim().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/),
    sourceType: z.string().trim().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/),
    sourceId: z.string().trim().min(1).max(160),
    occurrenceKey: z.string().trim().min(1).max(240),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(2_000),
    assignedUserId: optionalUserIdSchema,
    assignedEmployeeId: optionalEmployeeIdSchema,
    dueAt: z.date().nullable().optional().transform((value) => value ?? null),
    priority: z.enum(workItemPriorities).default("medium"),
  })
  .superRefine((input, context) => {
    if (input.assignedUserId && input.assignedEmployeeId) {
      context.addIssue({
        code: "custom",
        message: "A work item can have only one owner.",
        path: ["assignedEmployeeId"],
      });
    }
  });

export const resolveWorkItemInputSchema = z.strictObject({
  id: z.string().uuid(),
  resolution: z.string().trim().min(3).max(2_000),
});

export type GenerateWorkItemInput = z.input<
  typeof generateWorkItemInputSchema
>;
export type ParsedGenerateWorkItemInput = z.output<
  typeof generateWorkItemInputSchema
>;
export type ResolveWorkItemInput = z.input<typeof resolveWorkItemInputSchema>;
export type WorkItemPriority = (typeof workItemPriorities)[number];
export type WorkItemStatus = (typeof workItemStatuses)[number];

export function getWorkItemDedupeKey(
  input: Pick<
    ParsedGenerateWorkItemInput,
    "kind" | "occurrenceKey" | "sourceId" | "sourceType"
  >,
) {
  return [input.kind, input.sourceType, input.sourceId, input.occurrenceKey].join(
    ":",
  );
}

export function canResolveWorkItem(status: WorkItemStatus) {
  return status === "open" || status === "in_progress";
}
