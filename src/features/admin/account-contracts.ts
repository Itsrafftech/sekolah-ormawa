export type AccountListItem = {
  id: string;
  name: string;
  email: string;
  // "Tambah Role Baru dan 2 Akun": KETUA_PELAKSANA muncul di listAccounts()
  // seperti role lain, tapi hanya dikelola lewat script - lihat
  // scripts/create-additional-accounts.ts, bukan form "Tambah akun PJ".
  role: "SUPER_ADMIN" | "DEPT_PJ" | "KETUA_PELAKSANA";
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
  banned: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type CreateAccountInput = {
  name: string;
  email: string;
  departmentId: string;
};

export type UpdateAccountInput = {
  name?: string;
  departmentId?: string;
};
