import { z } from "zod";

import { userAccessStatusEnum } from "@/lib/db/schema";
import { roleKeys } from "@/lib/rbac";

export const updateUserRolesSchema = z
  .strictObject({
    roleKeys: z.array(z.enum(roleKeys)).min(1).max(roleKeys.length),
    userId: z.string().trim().min(1).max(200),
  });

export const updateUserAccessStatusSchema = z
  .strictObject({
    accessStatus: z.enum(userAccessStatusEnum.enumValues),
    userId: z.string().trim().min(1).max(200),
  });

export const updateUserEmployeeLinkSchema = z
  .strictObject({
    employeeId: z
      .string()
      .trim()
      .transform((value) => value || null)
      .refine(
        (value) => value === null || z.string().uuid().safeParse(value).success,
        { message: "Invalid employee id." },
      ),
    userId: z.string().trim().min(1).max(200),
  });
