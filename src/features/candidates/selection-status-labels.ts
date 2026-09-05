import type { SelectionStatusValue } from "@/features/candidates/selection-contracts";

// Shared label/tone map for the selection decision status - used anywhere a
// status needs to render as a badge (dashboard list rows, candidate detail
// panel). Keep this the single source of truth for status copy so the list
// and detail views can't drift.
export const SELECTION_STATUS_LABEL: Record<SelectionStatusValue, string> = {
  PENDING: "Menunggu Pilihan 1",
  TAKEN: "Diambil Pilihan 1",
  HESITANT_P1: "Pilihan 1 ragu-ragu",
  FORWARDED: "Dialihkan ke Anda",
  TAKEN_P2: "Diambil Pilihan 2",
  HESITANT_P2: "Pilihan 2 ragu-ragu",
  ELIMINATED: "Digugurkan",
};

export type SelectionStatusTone = "neutral" | "success" | "warning" | "danger";

export const SELECTION_STATUS_TONE: Record<SelectionStatusValue, SelectionStatusTone> = {
  PENDING: "neutral",
  TAKEN: "success",
  HESITANT_P1: "warning",
  FORWARDED: "success",
  TAKEN_P2: "success",
  HESITANT_P2: "warning",
  ELIMINATED: "danger",
};
