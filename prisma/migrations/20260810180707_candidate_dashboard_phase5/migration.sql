-- Phase 5 additive: audit trail for candidate file access (Dashboard PJ).
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FILE_VIEW';
