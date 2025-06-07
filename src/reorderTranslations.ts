/**
 * Reorders items in an array by grouping them based on a key and distributing them
 * to maximize variety per "day" (group of items).
 *
 * When used with translations, this function shuffles entries in a CSV file produced by the flashcard generator.
 * The original CSV has multiple entries per czech word grouped together, which would cause
 * flashcards for the same word to be scheduled together in Anki.
 *
 * This reordering ensures a more diverse learning experience by introducing a controlled
 * number of new items per group while maintaining a consistent pattern of repetition.
 *
 * @param input - The array of items to reorder
 * @param newItemsPerGroup - Number of new items to introduce per group (default: 5)
 * @param entriesPerItem - Number of entries to include per item in each group (default: 1)
 * @param getKey - Optional function to extract a key from each item. If not provided, the item itself is used as the key.
 * @returns The reordered array of items
 */
export function reorderTranslations<T, K extends string | number | symbol = string>(
  input: T[],
  newItemsPerGroup = 5,
  entriesPerItem = 1,
  getKey?: (item: T) => K
): T[] {
  // Default key extractor function if not provided
  const keyExtractor = getKey || ((item) => item as unknown as K);

  // Group entries by key
  const itemGroups: Record<string, T[]> = {};
  // Keep track of the order keys first appear in the input
  const keyOrder: K[] = [];

  for (const item of input) {
    const key = keyExtractor(item);
    const keyString = String(key);

    if (!itemGroups[keyString]) {
      itemGroups[keyString] = [];
      keyOrder.push(key); // Record the first occurrence of each key
    }
    itemGroups[keyString].push(item);
  }

  // Output container for the reordered entries
  const output: T[] = [];

  // Track which keys we've introduced
  const introducedKeys = new Set<string>();
  // Track how many entries we've used for each key
  const usedEntriesCount: Record<string, number> = {};

  // Process group by group until all entries are used
  let groupIndex = 0;
  while (output.length < input.length) {
    const currentGroup: T[] = [];

    // Introduce new items for this group
    const startIndex = groupIndex * newItemsPerGroup;
    const endIndex = Math.min(startIndex + newItemsPerGroup, keyOrder.length);

    // Add new items for this group
    for (let i = startIndex; i < endIndex; i++) {
      const key = keyOrder[i];
      const keyString = String(key);
      introducedKeys.add(keyString);
      usedEntriesCount[keyString] = 0;
    }

    // For each introduced key, add entries (up to entriesPerItem)
    // Use keyOrder to iterate through introduced keys in original order
    for (const key of keyOrder) {
      const keyString = String(key);
      if (!introducedKeys.has(keyString)) continue;

      const entries = itemGroups[keyString];
      const usedCount = usedEntriesCount[keyString] || 0;

      // Skip if we've used all entries for this key
      if (usedCount >= entries.length) continue;

      // Add up to entriesPerItem entries for this key
      const entriesToAdd = Math.min(entriesPerItem, entries.length - usedCount);
      for (let i = 0; i < entriesToAdd; i++) {
        currentGroup.push(entries[usedCount + i]);
      }

      // Update used entries count
      usedEntriesCount[keyString] = usedCount + entriesToAdd;
    }

    // Add this group's entries to the output
    output.push(...currentGroup);

    // If we've introduced all keys and this group had no entries, we're done
    if (introducedKeys.size === keyOrder.length && currentGroup.length === 0) break;

    groupIndex++;
  }

  return output;
}
