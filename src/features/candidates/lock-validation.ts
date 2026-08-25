import { z } from "zod";

import { PLACEMENT_STATUS_VALUES } from "@/features/candidates/contracts";
import type {
  LockActionInput,
  PlacementUpdateInput,
  UnlockActionInput,
} from "@/features/candidates/lock-contracts";

export const REASON_MIN_LENGTH = 5;
export const REASON_MAX_LENGTH = 500;

export type FieldErrors = Record<string, string>;

// ADR-031: lockReason/unlockReason/overrideReason are all mandatory.
const reasonSchema = z
  .string()
  .trim()
  .min(REASON_MIN_LENGTH, `Alasan minimal ${REASON_MIN_LENGTH} karakter.`)
  .max(REASON_MAX_LENGTH, `Alasan maksimum ${REASON_MAX_LENGTH} karakter.`);

const lockSchema = z.object({ reason: reasonSchema });
const unlockSchema = z.object({ reason: reasonSchema });

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

export function validateLockInput(
  input: unknown,
): { success: true; data: LockActionInput } | { success: false; errors: FieldErrors } {
  return parse(lockSchema, input);
}

export function validateUnlockInput(
  input: unknown,
): { success: true; data: UnlockActionInput } | { success: false; errors: FieldErrors } {
  return parse(unlockSchema, input);
}

const placementSchema = z.object({
  status: z.enum(PLACEMENT_STATUS_VALUES as [string, ...string[]]),
  mentorLabel: z.string().trim().max(160).optional(),
  reason: z.string().trim().max(REASON_MAX_LENGTH).optional(),
});

export function validatePlacementInput(
  input: unknown,
): { success: true; data: PlacementUpdateInput } | { success: false; errors: FieldErrors } {
  return parse(placementSchema, input) as
    | { success: true; data: PlacementUpdateInput }
    | { success: false; errors: FieldErrors };
}
