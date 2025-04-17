import twemoji from "twemoji";

// TODO: Consider hide the details of twemoji interface from other files.

const EMOJI_ASSET_BASE = chrome.runtime.getURL("/emojis/");

/**
 * Renders text by replacing emoji characters with Twemoji SVGs/PNGs.
 * @param text - The input text containing emoji characters.
 * @param options - Configuration options for Twemoji rendering.
 * @returns The processed HTML string with Twemoji.
 */
export function renderEmoji(
  text: string,
  options?: TwemojiOptions | ParseCallback,
): string {
  return twemoji.parse(text, {...options, base: EMOJI_ASSET_BASE});
}

/**
 * Creates an HTML element for a specific emoji character using Twemoji.
 * @param emoji - The emoji character to render.
 * @param options - Configuration options for Twemoji rendering.
 * @returns An HTML element containing the Twemoji representation.
 */
export function createEmojiElement(
  emoji: string,
  options?: TwemojiOptions | ParseCallback | undefined,
): HTMLElement {
  const container = document.createElement("span");
  container.innerHTML = renderEmoji(emoji, options);
  return container;
}
