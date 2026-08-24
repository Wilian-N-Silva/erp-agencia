import { z } from "zod";

import { userAccessStatusEnum } from "@/lib/db/schema";

export const updateUserAccessStatusSchema = z
  .object({
    accessStatus: z.enum(userAccessStatusEnum.enumValues),
    userId: z.string().trim().min(1).max(200),
  })
  .strict();

export const updateUserEmployeeLinkSchema = z
  .object({
    employeeId: z
      .string()
      .trim()
      .transform((value) => value || null)
      .refine(
        (value) => value === null || z.string().uuid().safeParse(value).success,
        { message: "Invalid employee id." },
      ),
    userId: z.string().trim().min(1).max(200),
  })
  .strict();
