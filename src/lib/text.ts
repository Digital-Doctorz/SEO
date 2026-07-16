/** Clean mojibake / broken unicode so UI text stays readable. */
export function sanitizeText(input: unknown): string {
  if (input == null) return "";
  let s = String(input);

  // Unicode punctuation to ASCII
  s = s.replace(/\u2014|\u2013/g, "-");
  s = s.replace(/\u2022/g, "-");
  s = s.replace(/\u2026/g, "...");
  s = s.replace(/[\u2018\u2019\u201C\u201D]/g, "'");

  // Broken multi-byte UTF-8 sequences (Latin-1 misreads)
  s = s.replace(/\u00C3\u00B3[\u0080-\u00FF]{1,120}/g, "");
  // Also match common visible mojibake letters
  s = s.replace(/Ãƒ[\u0080-\u00FF]{1,120}/g, "");
  s = s.replace(/Ã¢[\u0080-\u00FF]{1,40}/g, "");
  s = s.replace(/â€[^\s"'`<>\\]{0,6}/g, "");
  s = s.replace(/Â/g, "");

  s = s.replace(/[ \t]{2,}/g, " ").trim();
  return s;
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
