import { z } from "zod";

import { userAccessStatusEnum } from "@/lib/db/schema";

export const updateUserAccessStatusSchema = z
  .object({
    accessStatus: z.enum(userAccessStatusEnum.enumValues),
    userId: z.string().trim().min(1).max(200),
  })
  .strict();
