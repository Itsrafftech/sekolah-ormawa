import { z } from "zod";

import { emailInputSchema } from "@/features/auth/contracts";

export type FieldErrors = Record<string, string>;

const createAccountSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: emailInputSchema,
  departmentId: z.uuid(),
});

const updateAccountSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  departmentId: z.uuid().optional(),
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

export function validateCreateAccount(input: unknown) {
  return parse(createAccountSchema, input);
}

export function validateUpdateAccount(input: unknown) {
  return parse(updateAccountSchema, input);
}
