import { z } from "zod";

import {
  CONFIG_STATUS_VALUES,
  PERIOD_STATUS_VALUES,
  type UpdatePeriodInput,
} from "@/features/admin/period-contracts";

export type FieldErrors = Record<string, string>;

const isoDateOrNull = z.union([z.iso.datetime({ offset: true }), z.iso.date(), z.null()]).optional();

const updatePeriodSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  status: z.enum(PERIOD_STATUS_VALUES as [string, ...string[]]).optional(),
  configStatus: z.enum(CONFIG_STATUS_VALUES as [string, ...string[]]).optional(),
  entryYear: z.union([z.number().int().min(1900).max(2200), z.null()]).optional(),
  registrationPrefix: z.union([z.string().trim().min(1).max(20), z.null()]).optional(),
  opensAt: isoDateOrNull,
  closesAt: isoDateOrNull,
  choice2Required: z.boolean().optional(),
  allowUnlock: z.boolean().optional(),
  consentVersion: z.union([z.string().trim().min(1).max(100), z.null()]).optional(),
  retentionDays: z.union([z.number().int().min(1).max(3650), z.null()]).optional(),
});

const updatePeriodDepartmentSchema = z.object({
  acceptsApplications: z.boolean().optional(),
  quota: z.union([z.number().int().min(0).max(10000), z.null()]).optional(),
});

function parse<T>(
  schema: z.ZodType<T>,
  input: unknown,
): { success: true; data: T } | { success: false; errors: FieldErrors } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      errors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join(".") || "field", issue.message]),
      ),
    };
  }
  return { success: true, data: parsed.data };
}

export function validateUpdatePeriod(input: unknown) {
  return parse(updatePeriodSchema, input) as
    | { success: true; data: UpdatePeriodInput }
    | { success: false; errors: FieldErrors };
}

export function validateUpdatePeriodDepartment(input: unknown) {
  return parse(updatePeriodDepartmentSchema, input);
}
