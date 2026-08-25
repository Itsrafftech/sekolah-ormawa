export type AccountListItem = {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "DEPT_PJ";
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
