import { NamedSession, TabSummary } from "../lib/types";
import { getNamedSessions } from "./session_management";

/**
 * Calculates the cosine similarity between two embedding vectors
 * @param embeddings1 First embedding vector
 * @param embeddings2 Second embedding vector
 * @returns Similarity score between 0 and 1, where 1 is most similar
 */
export function calculateCosineSimilarity(
  embeddings1: number[],
  embeddings2: number[],
): number {
  if (embeddings1.length !== embeddings2.length) {
    console.error("Embedding vectors must have the same length");
    return 0;
  }

  // Calculate dot product
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < embeddings1.length; i++) {
    dotProduct += embeddings1[i] * embeddings2[i];
    magnitude1 += embeddings1[i] * embeddings1[i];
    magnitude2 += embeddings2[i] * embeddings2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  // Avoid division by zero
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  // Calculate cosine similarity
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Finds the most similar tabs to a given tab based on embedding similarity
 * @param tabUrl URL of the tab to find similar tabs for
 * @param tabSummaries Array of tab summaries with embeddings
 * @param threshold Minimum similarity score to consider (0-1)
 * @param maxResults Maximum number of similar tabs to return
 * @returns Array of similar tabs with their similarity scores
 */
export function findSimilarTabs(
  tabUrl: string,
  tabSummaries: TabSummary[],
  threshold: number = 0.7,
  maxResults: number = 5,
): { url: string; similarity: number }[] {
  // Find the source tab's embeddings
  const sourceTab = tabSummaries.find((summary) => summary.url === tabUrl);
  if (
    !sourceTab ||
    !sourceTab.summaries.length ||
    !sourceTab.summaries[0].embeddings
  ) {
    console.error("Source tab has no embeddings");
    return [];
  }

  const sourceEmbeddings = sourceTab.summaries[0].embeddings;
  const results: { url: string; similarity: number }[] = [];

  // Calculate similarity with all other tabs
  for (const targetTab of tabSummaries) {
    // Skip the source tab itself
    if (targetTab.url === tabUrl) continue;

    // Skip tabs without embeddings
    if (!targetTab.summaries.length || !targetTab.summaries[0].embeddings)
      continue;

    const targetEmbeddings = targetTab.summaries[0].embeddings;
    const similarity = calculateCosineSimilarity(
      sourceEmbeddings,
      targetEmbeddings,
    );

    // Only include results above the threshold
    if (similarity >= threshold) {
      results.push({
        url: targetTab.url,
        similarity,
      });
    }
  }

  // Sort by similarity (highest first) and limit to maxResults
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
}

/**
 * Suggests possible session destinations for a tab based on content similarity
 * @param tabUrl URL of the tab to find destinations for
 * @param tabSummaries Array of tab summaries with embeddings
 * @returns Promise that resolves with array of session suggestions with similarity scores
 */
export async function suggestTabDestinations(
  tabUrl: string,
  tabSummaries: TabSummary[],
): Promise<{ session: NamedSession; averageSimilarity: number }[]> {
  // Get all named sessions
  // TODO: Consider Prioritizing Named Sessions. For now we don't distinguish named or not.
  const sessions = await getNamedSessions();
  if (!sessions.length) {
    return [];
  }

  // Find the source tab's embeddings
  const sourceTab = tabSummaries.find((summary) => summary.url === tabUrl);
  if (
    !sourceTab ||
    !sourceTab.summaries.length ||
    !sourceTab.summaries[0].embeddings
  ) {
    console.error("Source tab has no embeddings");
    return [];
  }

  const sourceEmbeddings = sourceTab.summaries[0].embeddings;
  const results: { session: NamedSession; averageSimilarity: number }[] = [];

  // Calculate average similarity with tabs in each session
  for (const session of sessions) {
    // Skip sessions without tabs or with only the source tab
    if (!session.tabs.length) continue;

    let totalSimilarity = 0;
    let validTabCount = 0;

    // Calculate similarity with each tab in the session
    for (const sessionTab of session.tabs) {
      // Skip the source tab itself
      if (sessionTab.url === tabUrl) continue;

      // Find the tab summary for this session tab
      const tabSummary = tabSummaries.find(
        (summary) => summary.url === sessionTab.url,
      );
      if (
        !tabSummary ||
        !tabSummary.summaries.length ||
        !tabSummary.summaries[0].embeddings
      )
        continue;

      const targetEmbeddings = tabSummary.summaries[0].embeddings;
      const similarity = calculateCosineSimilarity(
        sourceEmbeddings,
        targetEmbeddings,
      );

      totalSimilarity += similarity;
      validTabCount++;
    }

    // Only include sessions with at least one valid tab for comparison
    if (validTabCount > 0) {
      const averageSimilarity = totalSimilarity / validTabCount;
      results.push({
        session,
        averageSimilarity,
      });
    }
  }

  // Sort by average similarity (highest first)
  return results.sort((a, b) => b.averageSimilarity - a.averageSimilarity);
}

/**
 * Categorizes tabs based on their content similarity
 * @param tabSummaries Array of tab summaries with embeddings
 * @param similarityThreshold Minimum similarity score to consider tabs related (0-1)
 * @returns Array of tab categories, each containing related tabs
 */
export function categorizeTabsBySimilarity(
  tabSummaries: TabSummary[],
  similarityThreshold: number = 0.7,
): { category: string; tabs: string[] }[] {
  // Filter tabs that have embeddings
  const tabsWithEmbeddings = tabSummaries.filter(
    (tab) => tab.summaries.length > 0 && tab.summaries[0].embeddings,
  );

  if (tabsWithEmbeddings.length === 0) {
    return [];
  }

  // Track which tabs have been assigned to categories
  const assignedTabs = new Set<string>();
  const categories: { category: string; tabs: string[] }[] = [];

  // Process each tab that hasn't been assigned yet
  for (const sourceTab of tabsWithEmbeddings) {
    // Skip if this tab is already in a category
    if (assignedTabs.has(sourceTab.url)) continue;

    // Start a new category with this tab
    const relatedTabs = [sourceTab.url];
    assignedTabs.add(sourceTab.url);

    // Find similar tabs for this category
    for (const targetTab of tabsWithEmbeddings) {
      // Skip if this tab is already assigned or it's the source tab
      if (assignedTabs.has(targetTab.url) || targetTab.url === sourceTab.url)
        continue;

      const similarity = calculateCosineSimilarity(
        sourceTab.summaries[0].embeddings,
        targetTab.summaries[0].embeddings,
      );

      // If similarity is above threshold, add to this category
      if (similarity >= similarityThreshold) {
        relatedTabs.push(targetTab.url);
        assignedTabs.add(targetTab.url);
      }
    }

    // Only create a category if it has more than one tab
    if (relatedTabs.length > 1) {
      // Use the keywords from the first tab as the category name
      const categoryKeywords = sourceTab.summaries[0].keywords || [];
      const categoryName =
        categoryKeywords.length > 0
          ? categoryKeywords.slice(0, 3).join(", ")
          : `Category ${categories.length + 1}`;

      categories.push({
        category: categoryName,
        tabs: relatedTabs,
      });
    } else {
      // If no similar tabs were found, remove from assigned set
      // so it can potentially be included in another category
      assignedTabs.delete(sourceTab.url);
    }
  }

  // Handle uncategorized tabs
  const uncategorizedTabs = tabsWithEmbeddings
    .filter((tab) => !assignedTabs.has(tab.url))
    .map((tab) => tab.url);

  if (uncategorizedTabs.length > 0) {
    categories.push({
      category: "Uncategorized",
      tabs: uncategorizedTabs,
    });
  }

  return categories;
}

/**
 * Migrates a tab to a different window/session
 * @param tabId ID of the tab to migrate
 * @param windowId ID of the destination window
 * @returns Promise that resolves when the tab has been migrated
 */
export async function migrateTabToWindow(
  tabId: number,
  windowId: number,
): Promise<chrome.tabs.Tab> {
  return chrome.tabs.move(tabId, { windowId, index: -1 });
}
