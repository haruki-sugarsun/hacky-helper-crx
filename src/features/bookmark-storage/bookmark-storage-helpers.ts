import { NamedSession, NamedSessionTab } from "../../lib/types";

/**
 * Extracts the last valid JSON object from a string.
 * @param text The string to extract JSON from
 * @returns An object with the extracted JSON and the text before it, or null if no valid JSON found
 */
export function extractLastJsonFromString(
  text: string,
): { beforeText: string; json: any } | null {
  const lastOpenBraceIndex = text.lastIndexOf("{");
  const lastCloseBraceIndex = text.lastIndexOf("}");

  if (lastOpenBraceIndex !== -1 && lastCloseBraceIndex > lastOpenBraceIndex) {
    // Extract what appears to be the last JSON object
    const potentialJson = text.substring(
      lastOpenBraceIndex,
      lastCloseBraceIndex + 1,
    );
    const beforeText = text.substring(0, lastOpenBraceIndex).trim();

    try {
      // Verify it's valid JSON
      const parsedJson = JSON.parse(potentialJson);
      return { beforeText, json: parsedJson };
    } catch (e) {
      // Not valid JSON
      console.debug("Failed to parse potential JSON in text", e);
    }
  }

  return null;
}

/**
 * Encodes session title using session data.
 */
export function encodeSessionTitle(session: NamedSession): string {
  // TODO: lastModified should be a part of data managed by session-management.ts.
  return `${session.name} ${JSON.stringify({ id: session.id, updatedAt: session.updatedAt })}`;
}

/**
 * Decodes session title to extract name, id, and lastModified.
 */
export function decodeSessionTitle(
  title: string,
): { sessionName: string; sessionId: string; updatedAt?: number } | null {
  const extracted = extractLastJsonFromString(title);

  if (extracted && extracted.json.id) {
    return {
      sessionName: extracted.beforeText,
      sessionId: extracted.json.id,
      updatedAt: extracted.json.updatedAt,
    };
  }

  // Fallback to old logic for backward compatibility
  const match = title.match(/^(.+) \(([a-f0-9-]+)\)$/i);
  if (match) {
    return {
      sessionName: match[1],
      sessionId: match[2],
    };
  }
  return null;
}

/**
 * Encodes tab title using tab data.
 */
export function encodeTabTitle(tab: NamedSessionTab): string {
  return `${tab.title} ${JSON.stringify({ lastModified: tab.updatedAt, owner: tab.owner })}`;
}

/**
 * Decodes tab title to extract title and metadata.
 */
export function decodeTabTitle(title: string): {
  title: string;
  metadata?: any; // TODO: Define a proper type for metadata.
} {
  const extracted = extractLastJsonFromString(title);

  if (extracted) {
    return {
      title: extracted.beforeText,
      metadata: extracted.json,
    };
  }
  return { title: title };
}
