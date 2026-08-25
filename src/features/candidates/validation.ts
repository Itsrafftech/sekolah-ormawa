import { z } from "zod";

import {
  CANDIDATE_SORT_KEYS,
  type CandidateListQuery,
  type CandidateSegment,
} from "@/features/candidates/contracts";

export const NOTE_BODY_MAX_LENGTH = 2000;

const listQuerySchema = z.object({
  segment: z.enum(["PRIMARY", "SECONDARY", "LOCKED"]),
  search: z.string().trim().max(160).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(CANDIDATE_SORT_KEYS).default("submittedAt_asc"),
  departmentId: z.uuid().optional(),
});

export type FieldErrors = Record<string, string>;

export function parseCandidateListQuery(
  searchParams: URLSearchParams,
):
  | { success: true; data: CandidateListQuery }
  | { success: false; errors: FieldErrors } {
  const raw = {
    segment: searchParams.get("segment") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    departmentId: searchParams.get("departmentId") ?? undefined,
  };
  const parsed = listQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join(".") || "query", issue.message]),
      ),
    };
  }
  const data = parsed.data;
  return {
    success: true,
    data: {
      segment: data.segment as CandidateSegment,
      search: data.search && data.search.length > 0 ? data.search : null,
      cursor: data.cursor ?? null,
      limit: data.limit,
      sort: data.sort,
      departmentId: data.departmentId ?? null,
    },
  };
}

const noteBodySchema = z.object({
  body: z.string().trim().min(1, "Catatan tidak boleh kosong.").max(
    NOTE_BODY_MAX_LENGTH,
    `Catatan maksimum ${NOTE_BODY_MAX_LENGTH} karakter.`,
  ),
});

export function validateNoteBody(
  input: unknown,
): { success: true; data: { body: string } } | { success: false; errors: FieldErrors } {
  const parsed = noteBodySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      errors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join(".") || "body", issue.message]),
      ),
    };
  }
  return { success: true, data: parsed.data };
}
