export type AuthErrorCode =
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "SESSION_REVOKED"
  | "FORBIDDEN"
  | "PASSWORD_CHANGE_REQUIRED"
  | "TEMPORARY_PASSWORD_EXPIRED"
  | "INVALID_DEPARTMENT_SCOPE"
  | "RESOURCE_NOT_FOUND"
  | "RATE_LIMITED"
  | "INVALID_CSRF"
  | "INVALID_CREDENTIALS"
  | "INVALID_PASSWORD"
  | "INVALID_RESET_TOKEN"
  | "VALIDATION_ERROR";

export class AuthServiceError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

