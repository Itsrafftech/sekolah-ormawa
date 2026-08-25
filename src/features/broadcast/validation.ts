import { z } from "zod";

import { PLACEMENT_STATUS_VALUES } from "@/features/candidates/contracts";
import type { BroadcastContent, BroadcastFilter } from "@/features/broadcast/contracts";

export type FieldErrors = Record<string, string>;

const filterSchema = z.object({
  periodId: z.uuid(),
  departmentId: z.uuid().optional(),
  placementStatus: z.enum(PLACEMENT_STATUS_VALUES as [string, ...string[]]).optional(),
});

const contentSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(5000),
});

const previewRequestSchema = z.object({ filter: filterSchema, content: contentSchema });
const sendRequestSchema = z.object({
  filter: filterSchema,
  content: contentSchema,
  previewToken: z.string().min(10).max(500),
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

export function validateBroadcastPreviewRequest(input: unknown) {
  return parse(previewRequestSchema, input) as
    | { success: true; data: { filter: BroadcastFilter; content: BroadcastContent } }
    | { success: false; errors: FieldErrors };
}

export function validateBroadcastSendRequest(input: unknown) {
  return parse(sendRequestSchema, input) as
    | { success: true; data: { filter: BroadcastFilter; content: BroadcastContent; previewToken: string } }
    | { success: false; errors: FieldErrors };
}
