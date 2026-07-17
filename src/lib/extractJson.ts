/**
 * Client-side mirror of server extractAndParseJSON.
 * Safely extracts JSON from LLM-style responses (fences, dual JSON, bad escapes).
 */

function sanitizeJsonStringEscapes(input: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (!inString) {
      if (c === '"') inString = true;
      out += c;
      continue;
    }
    if (c === "\\") {
      const next = input[i + 1];
      if (next === undefined) {
        out += "\\\\";
        continue;
      }
      if ('"\\/bfnrt'.includes(next)) {
        out += "\\" + next;
        i++;
        continue;
      }
      if (next === "u") {
        const hex = input.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += "\\u" + hex;
          i += 5;
          continue;
        }
        out += "\\\\u";
        i++;
        continue;
      }
      out += next === "'" ? "'" : next;
      i++;
      continue;
    }
    if (c === '"') {
      inString = false;
      out += c;
      continue;
    }
    if (c === "\n") {
      out += "\\n";
      continue;
    }
    if (c === "\r") {
      out += "\\r";
      continue;
    }
    if (c === "\t") {
      out += "\\t";
      continue;
    }
    if (c.charCodeAt(0) < 32) continue;
    out += c;
  }
  return out;
}

function repairTruncatedJson(s: string): string {
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  let result = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      result += c;
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      result += c;
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      result += c;
      continue;
    }
    if (!inString) {
      if (c === "{") stack.push("}");
      else if (c === "[") stack.push("]");
      else if ((c === "}" || c === "]") && stack.length && stack[stack.length - 1] === c) {
        stack.pop();
      }
    }
    result += c;
  }
  if (inString) result += '"';
  result = result.replace(/,\s*([}\]])/g, "$1").replace(/,\s*$/, "");
  while (stack.length) result += stack.pop();
  return result;
}

function extractBalancedJsonSlice(text: string, fromIndex = 0): string | null {
  const rel = text.slice(fromIndex).search(/[\[{]/);
  if (rel < 0) return null;
  const absStart = fromIndex + rel;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = absStart; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{" || c === "[") {
      depth++;
      continue;
    }
    if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return text.slice(absStart, i + 1);
    }
  }
  return text.slice(absStart);
}

function preprocessLlmJsonText(raw: string): string {
  let s = String(raw || "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!s) return s;
  s = s
    .replace(/^```(?:json|JSON|js|javascript)?\s*/i, "")
    .replace(/\s*```[\s\w]*$/i, "")
    .replace(/```(?:json|JSON)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  s = s.replace(/^(?:json|JSON)\s*/i, "").trim();
  s = s
    .replace(
      /^(?:here(?:'s| is)|sure[,.]?|absolutely[,.]?|of course[,.]?|okay[,.]?|ok[,.]?)\s*/i,
      ""
    )
    .trim();
  return s;
}

function prepareJsonCandidate(input: string): string {
  let s = input.replace(/,\s*([\]}])/g, "$1");
  s = sanitizeJsonStringEscapes(s);
  s = s
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  return s;
}

function parseJsonWithTrailingRecovery(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const m = msg.match(/after JSON at position\s+(\d+)/i);
    if (!m) throw e;
    const pos = Number(m[1]);
    if (!Number.isFinite(pos) || pos <= 0 || pos > text.length) throw e;

    const head = text.slice(0, pos).trimEnd();
    let headVal: unknown;
    try {
      headVal = JSON.parse(head);
    } catch {
      throw e;
    }

    const rest = text.slice(pos);
    const braceAt = rest.search(/[\[{]/);
    if (
      braceAt >= 0 &&
      (headVal === null ||
        typeof headVal === "boolean" ||
        typeof headVal === "number" ||
        typeof headVal === "string")
    ) {
      const balanced = extractBalancedJsonSlice(rest, braceAt);
      if (balanced) {
        try {
          return JSON.parse(prepareJsonCandidate(balanced));
        } catch {
          try {
            return JSON.parse(repairTruncatedJson(prepareJsonCandidate(balanced)));
          } catch {
            /* fall through */
          }
        }
      }
    }
    return headVal;
  }
}

/** Extract and parse JSON from messy LLM text. Throws on total failure. */
export function extractAndParseJSON(rawResponse: unknown): unknown {
  if (rawResponse == null) throw new Error("Invalid response format");
  if (typeof rawResponse === "object") return rawResponse;
  let cleanedText = preprocessLlmJsonText(String(rawResponse || ""));
  if (!cleanedText) throw new Error("Invalid response format");

  const candidates: string[] = [];
  const pushUnique = (c: string | null | undefined) => {
    if (!c || !c.trim()) return;
    const t = c.trim();
    if (!candidates.includes(t)) candidates.push(t);
  };

  const balanced = extractBalancedJsonSlice(cleanedText, 0);
  pushUnique(balanced);

  const firstBrace = cleanedText.search(/[\[{]/);
  if (firstBrace >= 0) {
    pushUnique(cleanedText.slice(firstBrace));
    const fromBrace = cleanedText.slice(firstBrace);
    const greedyObj = fromBrace.match(/\{[\s\S]*\}/);
    const greedyArr = fromBrace.match(/\[[\s\S]*\]/);
    if (greedyObj) pushUnique(greedyObj[0]);
    if (greedyArr) pushUnique(greedyArr[0]);
  }
  pushUnique(cleanedText);

  if (balanced && balanced.length < cleanedText.length) {
    const after = cleanedText.indexOf(balanced) + balanced.length;
    pushUnique(extractBalancedJsonSlice(cleanedText, after));
  }

  if (!candidates.length) {
    throw new Error("No JSON object found in the response.");
  }

  let lastErr: Error | null = null;
  const parsedValues: unknown[] = [];

  for (const candidate of candidates) {
    const prepared = prepareJsonCandidate(candidate);
    const attempts = [
      prepared,
      repairTruncatedJson(prepared),
      repairTruncatedJson(
        prepareJsonCandidate(
          prepared
            .replace(/\u2028/g, "\\n")
            .replace(/\u2029/g, "\\n")
            .replace(/[\x00-\x1F]/g, (ch) => {
              if (ch === "\n") return "\\n";
              if (ch === "\r") return "\\r";
              if (ch === "\t") return "\\t";
              return "";
            })
        )
      ),
    ];

    for (const attempt of attempts) {
      try {
        const val = parseJsonWithTrailingRecovery(attempt);
        parsedValues.push(val);
        if (val !== null && typeof val === "object") {
          return val;
        }
      } catch (e) {
        lastErr = e as Error;
      }
    }
  }

  for (const val of parsedValues) {
    if (val !== null && val !== undefined) return val;
  }
  if (parsedValues.includes(null)) return null;

  throw new Error(`Failed to parse JSON: ${lastErr?.message || "unknown"}`);
}

export function tryParseJsonLoose(text: unknown): unknown | null {
  try {
    return extractAndParseJSON(text);
  } catch {
    return null;
  }
}

/**
 * TASK 2 public name: sanitizeAndParseJSON
 * Strips ```json fences, trailing commas, and literal newlines before JSON.parse.
 */
export function sanitizeAndParseJSON(rawResponse: unknown): unknown {
  return extractAndParseJSON(rawResponse);
}
