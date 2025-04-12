import { NamedSession, NamedSessionTab } from "../../lib/types";

/**
 * Encodes session title using session data.
 */
export function encodeSessionTitle(session: NamedSession): string {
  // TODO: lastModified should be a part of data managed by session-management.ts.
  return `${session.name} ${JSON.stringify({ id: session.id, lastModified: Date.now() })}`;
}

/**
 * Decodes session title to extract name, id, and lastModified.
 */
export function decodeSessionTitle(
  title: string,
): { sessionName: string; sessionId: string; lastModified?: number } | null {
  let match = title.match(/^(.+?) (\{.*\})$/);
  if (match) {
    try {
      const metadata = JSON.parse(match[2]);
      if (metadata && metadata.id) {
        return {
          sessionName: match[1],
          sessionId: metadata.id,
          lastModified: metadata.lastModified,
        };
      }
    } catch (e) {
      console.error("Failed to parse session metadata:", e);
    }
  }
  // Fallback to old logic for backward compatibility
  match = title.match(/^(.+) \(([a-f0-9-]+)\)$/i);
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
  metadata?: any;
} {
  let match = title.match(/^(.+?) (\{.*\})$/);
  if (match) {
    try {
      const metadata = JSON.parse(match[2]);
      return { title: match[1].trim(), metadata };
    } catch (e) {
      console.error("Failed to parse tab metadata:", e);
    }
  }
  return { title: title };
}
