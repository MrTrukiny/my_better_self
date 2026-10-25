export function parseAllowlist(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isEmailAllowed(email: string | null | undefined, allowlist: Set<string>): boolean {
  if (!email) {
    return false;
  }
  return allowlist.has(email.trim().toLowerCase());
}
