/**
 * Client-side mirror of server extractAndParseJSON.
 * Safely extracts JSON from LLM-style responses (fences, filler, bad escapes).
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

/** Extract and parse JSON from messy LLM text. Throws on total failure. */
export function extractAndParseJSON(rawResponse: unknown): unknown {
  if (rawResponse == null) throw new Error("Invalid response format");
  if (typeof rawResponse === "object") return rawResponse;
  let cleanedText = String(rawResponse || "").trim();
  if (!cleanedText) throw new Error("Invalid response format");

  cleanedText = cleanedText
    .replace(/^```(?:json|JSON)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  cleanedText = cleanedText
    .replace(/^(?:here(?:'s| is)|sure[,.]?|absolutely[,.]?)\s*/i, "")
    .replace(/^[\s\S]{0,200}?(\{[\s\S]*)$/, "$1");

  const objMatch = cleanedText.match(/\{[\s\S]*\}/);
  const arrMatch = cleanedText.match(/\[[\s\S]*\]/);
  if (objMatch && (!arrMatch || (objMatch.index ?? 0) <= (arrMatch.index ?? 0))) {
    cleanedText = objMatch[0];
  } else if (arrMatch) {
    cleanedText = arrMatch[0];
  } else {
    throw new Error("No JSON object found in the response.");
  }

  cleanedText = cleanedText.replace(/,\s*([\]}])/g, "$1");
  cleanedText = sanitizeJsonStringEscapes(cleanedText);
  cleanedText = cleanedText
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");

  const attempts = [cleanedText, repairTruncatedJson(cleanedText)];
  let lastErr: Error | null = null;
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch (e) {
      lastErr = e as Error;
    }
  }
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
