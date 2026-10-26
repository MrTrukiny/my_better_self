/** Where the owner lives, so task names use their regional variant of the language. */
export type OwnerLocale = { language: string | null; timeZone: string | null };

/** The highest-ranked tag of an `Accept-Language` header, canonicalized, or null. */
export function preferredLanguage(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim(), q: q ? Number(q.slice(2)) : 1, index };
    })
    .filter(({ tag, q }) => tag && tag !== "*" && q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of ranked) {
    try {
      const [canonical] = Intl.getCanonicalLocales(tag);
      if (canonical) {
        return canonical;
      }
    } catch {
      // Not a valid BCP 47 tag; try the next one.
    }
  }
  return null;
}

const LANGUAGE_NAMES = new Intl.DisplayNames("en", {
  type: "language",
  languageDisplay: "standard",
});

export function describeLocale({ language, timeZone }: OwnerLocale): string {
  if (!language && !timeZone) {
    return "unknown";
  }
  const languagePart = language
    ? `device language ${language} (${LANGUAGE_NAMES.of(language) ?? language})`
    : "device language unknown";
  return `${languagePart}, time zone ${timeZone ?? "unknown"}`;
}
