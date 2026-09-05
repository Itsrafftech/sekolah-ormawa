import "server-only";

import type { SelectionStatus } from "@/generated/prisma/client";
import type { SelectionDecisionSummary } from "@/features/candidates/selection-contracts";
import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import { encryptJson, sha256 } from "@/lib/security/crypto";
import { writeAuditLog } from "@/server/auth/audit";

export class SelectionDecisionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "SelectionDecisionError";
  }
}

// P2028: the interactive transaction expired/errored at the driver level
// (queued too long for a pool connection under heavy contention on one
// candidate row). Same failure mode and same fix as lockCandidate
// (src/server/candidates/lock.ts) - deliberately NOT retried, a single
// attempt that fails fast into a clean 409 is simpler and safer than
// piling up retries that would make the contention worse. Caught
// 50-concurrent-take()-calls-on-one-candidate in testing: without this,
// the losing calls threw a raw PrismaClientKnownRequestError instead of
// a handled SelectionDecisionError.
function isTransactionApiError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2028");
}

function toCleanError(error: unknown): never {
  if (error instanceof SelectionDecisionError) throw error;
  if (isTransactionApiError(error)) {
    throw new SelectionDecisionError(
      "Permintaan mengalami konflik tinggi pada kandidat ini. Coba lagi.",
      409,
      "SELECTION_CONTENDED",
    );
  }
  throw error;
}

type ActingRole = "P1" | "P2";

function resolveActingRole(
  decision: { primaryDeptId: string; secondaryDeptId: string },
  departmentId: string,
): ActingRole | null {
  if (decision.primaryDeptId === departmentId) return "P1";
  if (decision.secondaryDeptId === departmentId) return "P2";
  return null;
}

/**
 * Idempotently creates the one-and-only SelectionDecision row for a
 * candidate (PENDING). Called both at registration time (submit.ts) so
 * every new candidate has a decision from the start, and once as a
 * backfill for candidates that existed before this feature.
 */
export async function ensureSelectionDecision(
  tx: Pick<typeof prisma, "selectionDecision">,
  input: { candidateId: string; periodId: string; primaryDeptId: string; secondaryDeptId: string },
): Promise<void> {
  await tx.selectionDecision.upsert({
    where: { candidateId: input.candidateId },
    update: {},
    create: {
      candidateId: input.candidateId,
      periodId: input.periodId,
      primaryDeptId: input.primaryDeptId,
      secondaryDeptId: input.secondaryDeptId,
      status: "PENDING",
    },
  });
}

function toSummary(decision: {
  id: string;
  candidateId: string;
  status: SelectionStatus;
  primaryDeptId: string;
  secondaryDeptId: string;
  decidedByP1UserId: string | null;
  decidedByP2UserId: string | null;
  p1DecidedAt: Date | null;
  p2DecidedAt: Date | null;
  p1Reason: string | null;
  p2Reason: string | null;
  overrideByAdminId: string | null;
  overrideReason: string | null;
  updatedAt: Date;
}): SelectionDecisionSummary {
  return {
    id: decision.id,
    candidateId: decision.candidateId,
    status: decision.status,
    primaryDeptId: decision.primaryDeptId,
    secondaryDeptId: decision.secondaryDeptId,
    decidedByP1UserId: decision.decidedByP1UserId,
    decidedByP2UserId: decision.decidedByP2UserId,
    p1DecidedAt: decision.p1DecidedAt?.toISOString() ?? null,
    p2DecidedAt: decision.p2DecidedAt?.toISOString() ?? null,
    p1Reason: decision.p1Reason,
    p2Reason: decision.p2Reason,
    overrideByAdminId: decision.overrideByAdminId,
    overrideReason: decision.overrideReason,
    updatedAt: decision.updatedAt.toISOString(),
  };
}

// ADR-042: `client` MUST be the caller's own `tx` when writing from
// inside an open prisma.$transaction() - see writeAuditLog's doc comment
// (src/server/auth/audit.ts). Every call site below already runs inside
// one; passing the default (global `prisma`) instead is what caused the
// SEL-04 race test's self-deadlock under high concurrency.
async function writeSelectionAudit(
  input: {
    action: "SELECTION_TAKE" | "SELECTION_HESITANT" | "SELECTION_FORWARD" | "SELECTION_ELIMINATE" | "SELECTION_RESET" | "SELECTION_RESTORE";
    actorUserId: string;
    decisionId: string;
    candidateId: string;
    departmentId: string | null;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    reason?: string | null;
    headers: Headers;
  },
  client: Parameters<typeof writeAuditLog>[1],
): Promise<void> {
  await writeAuditLog({
    action: input.action,
    headers: input.headers,
    actorUserId: input.actorUserId,
    entityType: "SELECTION_DECISION",
    entityId: input.decisionId,
    departmentId: input.departmentId,
    beforeJson: { candidateId: input.candidateId, ...input.before },
    afterJson: { candidateId: input.candidateId, ...input.after },
    reason: input.reason ?? undefined,
  }, client);
}

type PjAction = "take" | "hesitant" | "forward" | "eliminate";

const PJ_ACTION_RULES: Record<PjAction, {
  role: ActingRole;
  fromStatuses: SelectionStatus[];
  toStatus: SelectionStatus;
  auditAction: "SELECTION_TAKE" | "SELECTION_HESITANT" | "SELECTION_FORWARD" | "SELECTION_ELIMINATE";
}> = {
  // P1 may act (take / mark hesitant / forward) only while the decision is
  // still theirs to make - PENDING or their own earlier HESITANT_P1.
  // FORWARDED and everything after it has passed jurisdiction to P2; the
  // literal spec text only lists TAKEN/TAKEN_P2/ELIMINATED as blocking P1,
  // but allowing P1 to act post-FORWARDED would let them silently
  // override the handoff without an explicit "recall" action - blocked
  // here as the only reading consistent with "satu keputusan aktif".
  take: { role: "P1", fromStatuses: ["PENDING", "HESITANT_P1"], toStatus: "TAKEN", auditAction: "SELECTION_TAKE" },
  hesitant: { role: "P1", fromStatuses: ["PENDING", "HESITANT_P1"], toStatus: "HESITANT_P1", auditAction: "SELECTION_HESITANT" },
  forward: { role: "P1", fromStatuses: ["PENDING", "HESITANT_P1"], toStatus: "FORWARDED", auditAction: "SELECTION_FORWARD" },
  eliminate: { role: "P2", fromStatuses: ["FORWARDED"], toStatus: "ELIMINATED", auditAction: "SELECTION_ELIMINATE" },
};

// P2's "take"/"hesitant" share the action name with P1's but resolve to a
// different target status - handled by resolveActingRole + a second rule
// table keyed the same way, applied once the role is known.
const P2_TAKE_HESITANT: Record<"take" | "hesitant", { toStatus: SelectionStatus; auditAction: "SELECTION_TAKE" | "SELECTION_HESITANT" }> = {
  take: { toStatus: "TAKEN_P2", auditAction: "SELECTION_TAKE" },
  hesitant: { toStatus: "HESITANT_P2", auditAction: "SELECTION_HESITANT" },
};

async function applyPjAction(input: {
  candidateId: string;
  departmentId: string;
  actorUserId: string;
  reason?: string;
  headers: Headers;
  action: PjAction;
}): Promise<SelectionDecisionSummary> {
  try {
    return await applyPjActionTx(input);
  } catch (error) {
    toCleanError(error);
  }
}

async function applyPjActionTx(input: {
  candidateId: string;
  departmentId: string;
  actorUserId: string;
  reason?: string;
  headers: Headers;
  action: PjAction;
}): Promise<SelectionDecisionSummary> {
  return prisma.$transaction(async (tx) => {
    const decision = await tx.selectionDecision.findUnique({
      where: { candidateId: input.candidateId },
    });
    if (!decision) {
      throw new SelectionDecisionError("Keputusan seleksi tidak ditemukan.", 404, "RESOURCE_NOT_FOUND");
    }
    const role = resolveActingRole(decision, input.departmentId);
    if (!role) {
      // Birdep this actor represents is neither Pilihan 1 nor Pilihan 2
      // for this candidate - treat as not-found, not forbidden, to avoid
      // confirming the candidate's existence/choices to an outside dept
      // (same enumeration-reduction principle as candidate scope, ADR-025).
      throw new SelectionDecisionError("Keputusan seleksi tidak ditemukan.", 404, "RESOURCE_NOT_FOUND");
    }

    let toStatus: SelectionStatus;
    let auditAction: "SELECTION_TAKE" | "SELECTION_HESITANT" | "SELECTION_FORWARD" | "SELECTION_ELIMINATE";
    let allowedFrom: SelectionStatus[];

    if (input.action === "forward" || input.action === "eliminate") {
      const rule = PJ_ACTION_RULES[input.action];
      if (role !== rule.role) {
        throw new SelectionDecisionError(
          role === "P1" ? "Aksi ini hanya untuk PJ Pilihan 2." : "Aksi ini hanya untuk PJ Pilihan 1.",
          403,
          "WRONG_SIDE",
        );
      }
      toStatus = rule.toStatus;
      auditAction = rule.auditAction;
      allowedFrom = rule.fromStatuses;
    } else {
      // take / hesitant: valid for both sides, but with role-specific
      // targets and allowed-from sets.
      allowedFrom = role === "P1" ? PJ_ACTION_RULES[input.action].fromStatuses : ["FORWARDED"];
      const target = role === "P1" ? PJ_ACTION_RULES[input.action] : P2_TAKE_HESITANT[input.action];
      toStatus = target.toStatus;
      auditAction = target.auditAction;
    }

    if (!allowedFrom.includes(decision.status)) {
      throw new SelectionDecisionError(
        `Aksi tidak dapat dilakukan pada status ${decision.status} saat ini.`,
        409,
        "INVALID_TRANSITION",
      );
    }

    const decidedAtField = role === "P1" ? "p1DecidedAt" : "p2DecidedAt";
    const decidedByField = role === "P1" ? "decidedByP1UserId" : "decidedByP2UserId";
    const reasonField = role === "P1" ? "p1Reason" : "p2Reason";
    const now = new Date();

    const updated = await tx.selectionDecision.updateMany({
      where: { id: decision.id, status: { in: allowedFrom } },
      data: {
        status: toStatus,
        [decidedAtField]: now,
        [decidedByField]: input.actorUserId,
        [reasonField]: input.reason?.trim() || null,
      },
    });
    if (updated.count !== 1) {
      // Another request changed the status between our read and write -
      // the same fail-fast-under-concurrency pattern as lockCandidate.
      throw new SelectionDecisionError(
        "Status berubah saat proses berlangsung. Muat ulang dan coba lagi.",
        409,
        "INVALID_TRANSITION",
      );
    }

    if (input.action === "eliminate") {
      await tx.candidate.update({
        where: { id: input.candidateId },
        data: { deletedAt: now },
      });
    }

    const refreshed = await tx.selectionDecision.findUniqueOrThrow({ where: { id: decision.id } });

    await writeSelectionAudit({
      action: auditAction,
      actorUserId: input.actorUserId,
      decisionId: decision.id,
      candidateId: input.candidateId,
      departmentId: input.departmentId,
      before: { status: decision.status },
      after: { status: toStatus },
      reason: input.reason,
      headers: input.headers,
    }, tx);

    return toSummary(refreshed);
  }, { timeout: getServerEnvironment().PRISMA_TRANSACTION_TIMEOUT_MS });
}

export async function takeCandidate(input: {
  candidateId: string; departmentId: string; actorUserId: string; reason?: string; headers: Headers;
}): Promise<SelectionDecisionSummary> {
  return applyPjAction({ ...input, action: "take" });
}

export async function markHesitant(input: {
  candidateId: string; departmentId: string; actorUserId: string; reason?: string; headers: Headers;
}): Promise<SelectionDecisionSummary> {
  return applyPjAction({ ...input, action: "hesitant" });
}

export async function eliminateCandidate(input: {
  candidateId: string; departmentId: string; actorUserId: string; reason?: string; headers: Headers;
}): Promise<SelectionDecisionSummary> {
  return applyPjAction({ ...input, action: "eliminate" });
}

/**
 * P1 forwards to P2. Distinct from applyPjAction's generic flow because it
 * also needs the candidate/department names to send the EmailOutbox
 * notification, and the secondary dept's PJ user(s) to notify.
 */
export async function forwardToSecondary(input: {
  candidateId: string; departmentId: string; actorUserId: string; reason?: string; headers: Headers;
}): Promise<SelectionDecisionSummary> {
  const result = await applyPjAction({ ...input, action: "forward" });

  const [candidate, secondaryDept, recipients] = await Promise.all([
    prisma.candidate.findUniqueOrThrow({ where: { id: input.candidateId }, select: { name: true, nim: true } }),
    prisma.department.findUniqueOrThrow({ where: { id: result.secondaryDeptId }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { role: "DEPT_PJ", departmentId: result.secondaryDeptId, isActive: true, banned: false },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const environment = getServerEnvironment();
  const appUrl = environment.NEXT_PUBLIC_APP_URL;
  await Promise.all(recipients.map((recipient) =>
    prisma.emailOutbox.create({
      data: {
        type: "SELECTION_FORWARDED",
        recipientHash: sha256(recipient.email),
        encryptedPayload: encryptJson({
          kind: "SELECTION_FORWARDED",
          recipient: recipient.email,
          recipientName: recipient.name,
          candidateName: candidate.name,
          candidateNim: candidate.nim,
          departmentName: secondaryDept.name,
          dashboardUrl: `${appUrl}/admin/dashboard`,
        }, environment.AUTH_SECRET),
        maxAttempts: environment.EMAIL_OUTBOX_MAX_ATTEMPTS,
        // One notification per (decision, recipient) - a retried/duplicate
        // forward() call (should be prevented by the status guard above,
        // but as defense-in-depth) can't double-send to the same PJ.
        idempotencyKey: `selection-forwarded:${result.id}:${recipient.id}`,
      },
    }).catch((error: unknown) => {
      // A duplicate idempotencyKey (P2002) is expected/harmless here - the
      // forward already happened, this call is a retry. Anything else
      // re-throws: an email that fails to even queue should not be
      // silently swallowed the way a delivery failure is (outbox retries
      // delivery failures; this would be a queueing failure).
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") return;
      throw error;
    }),
  ));

  return result;
}

/**
 * Super Admin only. Resets a decision to PENDING regardless of its current
 * status, clearing both sides' decision fields. Does NOT restore an
 * eliminated candidate - use restoreEliminatedCandidate for that (the two
 * are listed as distinct Super Admin capabilities in the product spec).
 */
export async function adminResetSelection(input: {
  candidateId: string; actorUserId: string; reason: string; headers: Headers;
}): Promise<SelectionDecisionSummary> {
  try {
    return await adminResetSelectionTx(input);
  } catch (error) {
    toCleanError(error);
  }
}

async function adminResetSelectionTx(input: {
  candidateId: string; actorUserId: string; reason: string; headers: Headers;
}): Promise<SelectionDecisionSummary> {
  return prisma.$transaction(async (tx) => {
    const decision = await tx.selectionDecision.findUnique({ where: { candidateId: input.candidateId } });
    if (!decision) {
      throw new SelectionDecisionError("Keputusan seleksi tidak ditemukan.", 404, "RESOURCE_NOT_FOUND");
    }

    const updated = await tx.selectionDecision.update({
      where: { id: decision.id },
      data: {
        status: "PENDING",
        decidedByP1UserId: null,
        decidedByP2UserId: null,
        p1DecidedAt: null,
        p2DecidedAt: null,
        p1Reason: null,
        p2Reason: null,
        overrideByAdminId: input.actorUserId,
        overrideReason: input.reason,
      },
    });

    await writeSelectionAudit({
      action: "SELECTION_RESET",
      actorUserId: input.actorUserId,
      decisionId: decision.id,
      candidateId: input.candidateId,
      departmentId: null,
      before: decision,
      after: updated,
      reason: input.reason,
      headers: input.headers,
    }, tx);

    return toSummary(updated);
  }, { timeout: getServerEnvironment().PRISMA_TRANSACTION_TIMEOUT_MS });
}

/**
 * Super Admin only. Restores a candidate that P2 had eliminated
 * (soft-deleted) and resets their decision back to PENDING so the process
 * can start over.
 */
export async function restoreEliminatedCandidate(input: {
  candidateId: string; actorUserId: string; reason: string; headers: Headers;
}): Promise<SelectionDecisionSummary> {
  try {
    return await restoreEliminatedCandidateTx(input);
  } catch (error) {
    toCleanError(error);
  }
}

async function restoreEliminatedCandidateTx(input: {
  candidateId: string; actorUserId: string; reason: string; headers: Headers;
}): Promise<SelectionDecisionSummary> {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.candidate.findUnique({
      where: { id: input.candidateId },
      select: { deletedAt: true },
    });
    const decision = await tx.selectionDecision.findUnique({ where: { candidateId: input.candidateId } });
    if (!candidate || !decision || candidate.deletedAt === null || decision.status !== "ELIMINATED") {
      throw new SelectionDecisionError(
        "Kandidat ini tidak dalam status tergugurkan.",
        409,
        "NOT_ELIMINATED",
      );
    }

    await tx.candidate.update({ where: { id: input.candidateId }, data: { deletedAt: null } });
    const updated = await tx.selectionDecision.update({
      where: { id: decision.id },
      data: {
        status: "PENDING",
        decidedByP1UserId: null,
        decidedByP2UserId: null,
        p1DecidedAt: null,
        p2DecidedAt: null,
        p1Reason: null,
        p2Reason: null,
        overrideByAdminId: input.actorUserId,
        overrideReason: input.reason,
      },
    });

    await writeSelectionAudit({
      action: "SELECTION_RESTORE",
      actorUserId: input.actorUserId,
      decisionId: decision.id,
      candidateId: input.candidateId,
      departmentId: null,
      before: decision,
      after: updated,
      reason: input.reason,
      headers: input.headers,
    }, tx);

    return toSummary(updated);
  }, { timeout: getServerEnvironment().PRISMA_TRANSACTION_TIMEOUT_MS });
}
