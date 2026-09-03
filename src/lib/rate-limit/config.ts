import { z } from "zod";

export const rateLimitActions = [
  "invitation",
  "upload",
  "export",
  "reconciliation",
  "common_mutation",
  "financial_transaction",
  "graphics_import",
] as const;

export type RateLimitAction = (typeof rateLimitActions)[number];

export type RateLimitRule = {
  limit: number;
  windowMs: number;
};

export type RateLimitConfig = Record<RateLimitAction, RateLimitRule> & {
  cleanup: {
    batchSize: number;
    probability: number;
  };
};

const positiveIntegerSchema = z.coerce.number().int().positive().max(1_000_000);
const probabilitySchema = z.coerce.number().min(0).max(1);

const configSchema = z.object({
  invitationLimit: positiveIntegerSchema,
  invitationWindowSeconds: positiveIntegerSchema,
  uploadLimit: positiveIntegerSchema,
  uploadWindowSeconds: positiveIntegerSchema,
  exportLimit: positiveIntegerSchema,
  exportWindowSeconds: positiveIntegerSchema,
  reconciliationLimit: positiveIntegerSchema,
  reconciliationWindowSeconds: positiveIntegerSchema,
  commonMutationLimit: positiveIntegerSchema,
  commonMutationWindowSeconds: positiveIntegerSchema,
  graphicsImportLimit: positiveIntegerSchema,
  graphicsImportWindowSeconds: positiveIntegerSchema,
  financialTransactionLimit: positiveIntegerSchema,
  financialTransactionWindowSeconds: positiveIntegerSchema,
  cleanupBatchSize: positiveIntegerSchema.max(10_000),
  cleanupProbability: probabilitySchema,
});

export function loadRateLimitConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): RateLimitConfig {
  const values = configSchema.parse({
    invitationLimit: env.RATE_LIMIT_INVITATION_LIMIT ?? 10,
    invitationWindowSeconds: env.RATE_LIMIT_INVITATION_WINDOW_SECONDS ?? 600,
    uploadLimit: env.RATE_LIMIT_UPLOAD_LIMIT ?? 20,
    uploadWindowSeconds: env.RATE_LIMIT_UPLOAD_WINDOW_SECONDS ?? 600,
    exportLimit: env.RATE_LIMIT_EXPORT_LIMIT ?? 5,
    exportWindowSeconds: env.RATE_LIMIT_EXPORT_WINDOW_SECONDS ?? 300,
    reconciliationLimit: env.RATE_LIMIT_RECONCILIATION_LIMIT ?? 30,
    reconciliationWindowSeconds:
      env.RATE_LIMIT_RECONCILIATION_WINDOW_SECONDS ?? 300,
    commonMutationLimit: env.RATE_LIMIT_COMMON_MUTATION_LIMIT ?? 120,
    commonMutationWindowSeconds:
      env.RATE_LIMIT_COMMON_MUTATION_WINDOW_SECONDS ?? 60,
    graphicsImportLimit: env.RATE_LIMIT_GRAPHICS_IMPORT_LIMIT ?? 3,
    graphicsImportWindowSeconds:
      env.RATE_LIMIT_GRAPHICS_IMPORT_WINDOW_SECONDS ?? 3600,
    financialTransactionLimit:
      env.RATE_LIMIT_FINANCIAL_TRANSACTION_LIMIT ?? 30,
    financialTransactionWindowSeconds:
      env.RATE_LIMIT_FINANCIAL_TRANSACTION_WINDOW_SECONDS ?? 300,
    cleanupBatchSize: env.RATE_LIMIT_CLEANUP_BATCH_SIZE ?? 500,
    cleanupProbability: env.RATE_LIMIT_CLEANUP_PROBABILITY ?? 0.01,
  });

  return {
    invitation: toRule(values.invitationLimit, values.invitationWindowSeconds),
    upload: toRule(values.uploadLimit, values.uploadWindowSeconds),
    export: toRule(values.exportLimit, values.exportWindowSeconds),
    reconciliation: toRule(
      values.reconciliationLimit,
      values.reconciliationWindowSeconds,
    ),
    common_mutation: toRule(
      values.commonMutationLimit,
      values.commonMutationWindowSeconds,
    ),
    graphics_import: toRule(
      values.graphicsImportLimit,
      values.graphicsImportWindowSeconds,
    ),
    financial_transaction: toRule(
      values.financialTransactionLimit,
      values.financialTransactionWindowSeconds,
    ),
    cleanup: {
      batchSize: values.cleanupBatchSize,
      probability: values.cleanupProbability,
    },
  };
}

function toRule(limit: number, windowSeconds: number): RateLimitRule {
  return { limit, windowMs: windowSeconds * 1000 };
}
