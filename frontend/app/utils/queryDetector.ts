/**
 * Detects the query type (code, name, or ambiguous) for smart reviewer addition.
 *
 * Pattern:
 * - Code: Letters (2-5) + optional space/hyphen + numeric identifier.
 *   - 2-3 char prefixes must be all uppercase or all lowercase.
 *   - 4-5 char prefixes must be all uppercase (otherwise they are treated as ambiguous/names).
 * - Name: letters and spaces only, minimum 2 characters (excluding spaces).
 * - Ambiguous: everything else.
 */
export function detectQueryType(query: string): {
  type: "code" | "name" | "ambiguous";
  normalizedValue?: string;
} {
  const trimmed = query.trim();
  if (!trimmed) return { type: "ambiguous" };

  const codeRegex = /^([A-Za-z]{2,5})[\s-]?(\d+)$/;
  const codeMatch = trimmed.match(codeRegex);

  if (codeMatch) {
    const prefix = codeMatch[1];
    const digits = codeMatch[2];

    const isAllUpper = prefix === prefix.toUpperCase();
    const isAllLower = prefix === prefix.toLowerCase();

    let isValidCode = false;
    if (prefix.length === 2 || prefix.length === 3) {
      if (isAllUpper || isAllLower) {
        isValidCode = true;
      }
    } else if (prefix.length === 4 || prefix.length === 5) {
      if (isAllUpper) {
        isValidCode = true;
      }
    }

    if (isValidCode) {
      return {
        type: "code",
        normalizedValue: `${prefix.toUpperCase()}${digits}`
      };
    }
  }

  const nameRegex = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;
  if (nameRegex.test(trimmed) && trimmed.replace(/\s+/g, "").length >= 2) {
    return {
      type: "name",
      normalizedValue: trimmed
    };
  }

  return { type: "ambiguous" };
}
