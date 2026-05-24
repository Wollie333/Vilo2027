export class AdminAccessDenied extends Error {
  readonly code = "ADMIN_ACCESS_DENIED";
  constructor(reason: string) {
    super(reason);
    this.name = "AdminAccessDenied";
  }
}

export class AdminMfaRequired extends Error {
  readonly code = "ADMIN_MFA_REQUIRED";
  constructor() {
    super("MFA (AAL2) enrolment required for admin access.");
    this.name = "AdminMfaRequired";
  }
}

export class AdminPermissionDenied extends Error {
  readonly code = "ADMIN_PERMISSION_DENIED";
  constructor(public readonly permissionKey: string) {
    super(`Missing admin permission: ${permissionKey}`);
    this.name = "AdminPermissionDenied";
  }
}

export class AdminReasonRequired extends Error {
  readonly code = "ADMIN_REASON_REQUIRED";
  constructor() {
    super("A reason is required for this admin action.");
    this.name = "AdminReasonRequired";
  }
}
