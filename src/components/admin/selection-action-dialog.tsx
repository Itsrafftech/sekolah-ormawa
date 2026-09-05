"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

export type SelectionChecklistItem = { id: string; label: string };

type SelectionActionDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  checklist: SelectionChecklistItem[];
  confirmLabel: string;
  requireReason?: boolean;
  reasonLabel?: string;
  pending: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
};

/**
 * Native <dialog> (showModal()) gives focus trapping, Escape-to-close, and
 * a backdrop for free - deliberately not a hand-rolled ARIA overlay.
 * Confirm stays disabled until every checklist item is ticked (and, for
 * admin actions, a reason of at least a few characters is given) - a
 * client-side affordance against misclicks, not a security control; every
 * transition it submits is independently re-validated server-side
 * regardless of what this dialog did or didn't require.
 */
export function SelectionActionDialog({
  open,
  title,
  description,
  checklist,
  confirmLabel,
  requireReason = false,
  reasonLabel = "Alasan (opsional)",
  pending,
  error,
  onConfirm,
  onClose,
}: SelectionActionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState("");

  // Reset the checklist/reason whenever `open` flips true, without a
  // setState-in-effect: adjusting state during render in response to a
  // prop change is the React-recommended alternative (avoids the extra
  // render an effect would cause). See selection-panel.tsx for the more
  // common case (a fresh mount per open, where this branch never fires).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setChecked({});
      setReason("");
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const allChecked = checklist.length > 0 && checklist.every((item) => checked[item.id]);
  const reasonOk = !requireReason || reason.trim().length >= 5;
  const canConfirm = allChecked && reasonOk && !pending;

  return (
    <dialog
      ref={dialogRef}
      className="selection-dialog"
      aria-labelledby="selection-dialog-title"
      onClose={onClose}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <h2 id="selection-dialog-title">{title}</h2>
      {description ? <p className="selection-dialog__description">{description}</p> : null}

      <ul className="selection-dialog__checklist">
        {checklist.map((item) => (
          <li key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={Boolean(checked[item.id])}
                onChange={(event) => setChecked((previous) => ({ ...previous, [item.id]: event.target.checked }))}
              />
              {item.label}
            </label>
          </li>
        ))}
      </ul>

      <div className="selection-dialog__reason">
        <label htmlFor="selection-dialog-reason">{reasonLabel}</label>
        <textarea
          id="selection-dialog-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
        />
      </div>

      {error ? <p className="selection-dialog__error" role="alert">{error}</p> : null}

      <div className="selection-dialog__actions">
        <button type="button" onClick={onClose} disabled={pending}>Batal</button>
        <button type="button" onClick={() => onConfirm(reason.trim())} disabled={!canConfirm}>
          {pending ? <LoaderCircle aria-hidden="true" className="spin" size={14} /> : null}
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
