/** Sent by our allowlist hooks; Better Auth forwards it as `?error=` on the sign-in page. */
export const EMAIL_NOT_ALLOWED = "email_not_allowed";

/** Sent by Google when the user cancels on the consent screen. */
const GOOGLE_ACCESS_DENIED = "access_denied";

export const GENERIC_SIGN_IN_ERROR = "Something went wrong while signing in. Try again.";

export function signInErrorMessage(code: string | null | undefined): string | undefined {
  if (!code) {
    return undefined;
  }
  switch (code) {
    case EMAIL_NOT_ALLOWED:
      return "This account doesn't have access.";
    case GOOGLE_ACCESS_DENIED:
      return "Sign-in was cancelled. Try again.";
    default:
      return GENERIC_SIGN_IN_ERROR;
  }
}
