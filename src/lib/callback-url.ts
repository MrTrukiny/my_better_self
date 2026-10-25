export const SIGN_IN_PATH = "/sign-in";

const FALLBACK = "/";
const PLACEHOLDER_ORIGIN = "http://placeholder.invalid";

/** Returns `value` only if it is a same-origin path, to prevent open redirects after sign-in. */
export function safeCallbackPath(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return FALLBACK;
  }
  const url = new URL(value, PLACEHOLDER_ORIGIN);
  if (url.origin !== PLACEHOLDER_ORIGIN || url.pathname === SIGN_IN_PATH) {
    return FALLBACK;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
