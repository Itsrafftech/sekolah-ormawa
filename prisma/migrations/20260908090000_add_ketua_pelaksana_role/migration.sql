-- "Tambah Role Baru dan 2 Akun": adds the KETUA_PELAKSANA role to the
-- users.role CHECK constraint. Role and Permission themselves are already
-- generic data tables (`roles`/`permissions`/`role_permissions`, see
-- prisma/schema.prisma's Role/Permission/RolePermission models) - a new
-- role code and its permission grants are pure DATA, upserted by
-- `prisma/seed.ts` (roleFixtures/permissionFixtures), not a schema change.
-- The ONLY schema-level change KETUA_PELAKSANA actually requires is this
-- constraint: `users_role_department_scope_check` (added in the initial
-- migration) is a closed enumeration of exactly two (role, departmentId)
-- shapes - SUPER_ADMIN with NULL, DEPT_PJ with NOT NULL - so any other
-- role value is rejected at the database level regardless of what the
-- application/TypeScript layer (src/lib/auth/permissions.ts) allows.
-- KETUA_PELAKSANA has no department of its own (reads across all Birdep
-- via the department switcher, same invariant as SUPER_ADMIN), so it is
-- added to the constraint with the same "departmentId IS NULL" shape as
-- SUPER_ADMIN.
--
-- No backfill needed - this only widens what is already an ALLOW-list;
-- no existing row's (role, departmentId) combination becomes invalid.
--
-- Rollback (only safe once no user has role = 'KETUA_PELAKSANA' - drop
-- those rows or reassign them first, otherwise this reinstates a
-- constraint the existing data would violate):
--   ALTER TABLE "users" DROP CONSTRAINT "users_role_department_scope_check";
--   ALTER TABLE "users"
--     ADD CONSTRAINT "users_role_department_scope_check"
--     CHECK (
--       ("role" = 'SUPER_ADMIN' AND "departmentId" IS NULL)
--       OR
--       ("role" = 'DEPT_PJ' AND "departmentId" IS NOT NULL)
--     );

ALTER TABLE "users" DROP CONSTRAINT "users_role_department_scope_check";

ALTER TABLE "users"
  ADD CONSTRAINT "users_role_department_scope_check"
  CHECK (
    ("role" = 'SUPER_ADMIN' AND "departmentId" IS NULL)
    OR
    ("role" = 'DEPT_PJ' AND "departmentId" IS NOT NULL)
    OR
    ("role" = 'KETUA_PELAKSANA' AND "departmentId" IS NULL)
  );
