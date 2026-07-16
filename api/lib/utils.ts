export function cleanDomain(url: string): string {
  let domain = url.trim();
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, "");
  domain = domain.split("/")[0];
  return domain || "target-website.com";
}

export function cleanAndParseJSON(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "");
  }
  cleaned = cleaned.trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(extracted);
      } catch (innerErr) {
        throw new Error(
          `Failed to parse extracted JSON: ${(innerErr as Error).message}. Original text: ${text}`
        );
      }
    }
    throw err;
  }
}

/** Client sends targetDomain; older paths send targetUrl. Accept both. */
export function resolveDomain(
  body: { targetUrl?: string; targetDomain?: string } | undefined
): string {
  const raw = body?.targetUrl || body?.targetDomain || "";
  return cleanDomain(raw);
}
