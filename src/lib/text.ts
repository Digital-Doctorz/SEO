/** Clean mojibake / broken unicode so UI text stays readable. */
export function sanitizeText(input: unknown): string {
  if (input == null) return "";
  let s = String(input);

  // Normalize newlines
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Zero-width / BOM / soft hyphen / replacement char
  s = s.replace(/[\u200B-\u200D\uFEFF\u00AD\uFFFD]/g, "");

  // Non-breaking and odd spaces -> normal space
  s = s.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ");

  // Unicode punctuation to plain ASCII
  s = s.replace(/[\u2014\u2013\u2012\u2015]/g, "-"); // em/en dashes
  s = s.replace(/\u2022|\u00B7|\u2023/g, "-"); // bullets
  s = s.replace(/\u2026/g, "...");
  s = s.replace(/[\u2018\u2019\u201A\u2032]/g, "'");
  s = s.replace(/[\u201C\u201D\u201E\u2033]/g, '"');
  s = s.replace(/\u00B0/g, " degrees ");
  s = s.replace(/[\u2190-\u21FF]/g, "->"); // arrows
  s = s.replace(/\u20AC/g, "EUR"); // euro misused as separator
  s = s.replace(/\u00A9/g, "(c)");
  s = s.replace(/\u00AE/g, "(R)");
  s = s.replace(/\u2122/g, "(TM)");

  // Common UTF-8 mojibake sequences (Latin-1 misreads of UTF-8)
  s = s.replace(/\u00E2\u20AC[\u2122\u02DC\u0153\u009D'"-]/g, "'");
  s = s.replace(/â€™|â€˜|â€œ|â€\u009D|â€\u009C/g, "'");
  s = s.replace(/â€"|â€“|â€”/g, "-");
  s = s.replace(/â€¦/g, "...");
  s = s.replace(/â€¢/g, "-");
  s = s.replace(/Ã¢â‚¬[^\s]{0,6}/g, "");
  s = s.replace(/Ãƒ[\u0080-\u00FF]{0,4}/g, "");
  s = s.replace(/Ã¢[\u0080-\u00FF]{0,6}/g, "");
  s = s.replace(/Â/g, "");
  // Drop leftover high Latin-1 control/mojibake pairs starting with A-tilde
  s = s.replace(/\u00C3[\u00A0-\u00BF]/g, "");

  // Strip leftover control chars except tab/newline
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

  // Collapse whitespace (keep single newlines structure)
  s = s.replace(/[ \t]{2,}/g, " ");
  s = s.replace(/ *\n */g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

export function sanitizeDeep<T>(value: T): T {
  if (typeof value === "string") return sanitizeText(value) as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeDeep(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeDeep(v);
    }
    return out as T;
  }
  return value;
}
