import { z } from "zod";

import type {
  SelectionActionInput,
  SelectionAdminActionInput,
} from "@/features/candidates/selection-contracts";

export type FieldErrors = Record<string, string>;

const REASON_MAX_LENGTH = 500;
// Super Admin reset/restore reasons are mandatory (product decision,
// mirrors ADR-031's lock/unlock/override reason requirement); P1/P2
// take/hesitant/forward/eliminate reasons are optional (product spec:
// "p1Reason (opsional)", "p2Reason (opsional)") - the checklist
// confirmation dialog is what stands in for an explicit reason there.
const ADMIN_REASON_MIN_LENGTH = 5;

function parse<T>(
  schema: z.ZodType<T>,
  input: unknown,
): { success: true; data: T } | { success: false; errors: FieldErrors } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      errors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join(".") || "reason", issue.message]),
      ),
    };
  }
  return { success: true, data: parsed.data };
}

const actionSchema = z.object({
  reason: z.string().trim().max(REASON_MAX_LENGTH).optional(),
});

export function validateSelectionActionInput(
  input: unknown,
): { success: true; data: SelectionActionInput } | { success: false; errors: FieldErrors } {
  return parse(actionSchema, input);
}

const adminActionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(ADMIN_REASON_MIN_LENGTH, `Alasan minimal ${ADMIN_REASON_MIN_LENGTH} karakter.`)
    .max(REASON_MAX_LENGTH, `Alasan maksimum ${REASON_MAX_LENGTH} karakter.`),
});

export function validateSelectionAdminActionInput(
  input: unknown,
): { success: true; data: SelectionAdminActionInput } | { success: false; errors: FieldErrors } {
  return parse(adminActionSchema, input);
}
