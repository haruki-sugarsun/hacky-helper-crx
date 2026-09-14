import { describe, expect, it } from "vitest";
import { EMBEDDING_CHUNK_SIZE, splitEmbeddingContent } from "./llm-service";

describe("splitEmbeddingContent", () => {
  it("leaves content within the safe limit unchanged", () => {
    const content = "short content";

    expect(splitEmbeddingContent(content)).toEqual([content]);
  });

  it("splits long content at whitespace and preserves all content", () => {
    const content = Array.from(
      { length: 20 },
      (_, index) => `word${index}`,
    ).join(" ");
    const chunks = splitEmbeddingContent(content, 20);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 20)).toBe(true);
    expect(chunks.join("")).toBe(content);
  });

  it("hard-splits text without whitespace", () => {
    const content = "x".repeat(EMBEDDING_CHUNK_SIZE + 3);
    const chunks = splitEmbeddingContent(content);

    expect(chunks).toEqual(["x".repeat(EMBEDDING_CHUNK_SIZE), "x".repeat(3)]);
  });

  it("rejects an invalid chunk size", () => {
    expect(() => splitEmbeddingContent("content", 0)).toThrow(
      "Embedding chunk size must be greater than zero",
    );
  });
});
