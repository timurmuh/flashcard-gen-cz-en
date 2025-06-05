import fs from 'fs';
import type { TranslationEntry } from '../src/csvFiles';

/**
 * Shuffle translations in a CSV file produced by the flashcard generator.
 *
 * CSV file doesn't have a header row. The columns are, in order:
 * - czechWord
 * - czechContext
 * - englishWord
 * - englishContext
 * - czechWordAudio
 * - czechContextAudio
 *
 * The generator produces multiple entries per each czech word, and they are written in continuous batches,
 * with all entries for a czech word grouped together. Because of this, when the file is imported into Anki,
 * the flashcards for each czech word will be scheduled together, causing the user to review one-two new words
 * per day, with the contexts being the only variable thing.
 *
 * To avoid this, we need to reorder the entries in the CSV file to maximize the amount of new words per day.
 * We can do it in a round-robin fashion, where we define a window size (e.g. 20 entries, as in 20 new words
 * per day),
 *
 * @param input
 */

function reorderTranslations(input: TranslationEntry[], newWordsPerDay = 5, entriesPerWord = 1): TranslationEntry[] {
  // Group entries by Czech word
  const wordGroups: Record<string, TranslationEntry[]> = {};
  // Keep track of the order words first appear in the input
  const wordOrder: string[] = [];

  for (const entry of input) {
    if (!wordGroups[entry.czechWord]) {
      wordGroups[entry.czechWord] = [];
      wordOrder.push(entry.czechWord); // Record the first occurrence of each word
    }
    wordGroups[entry.czechWord].push(entry);
  }

  // Output container for the reordered entries
  const output: TranslationEntry[] = [];

  // Track which words we've introduced
  const introducedWords = new Set<string>();
  // Track how many entries we've used for each word
  const usedEntriesCount: Record<string, number> = {};

  // Process day by day until all entries are used
  let dayIndex = 0;
  while (output.length < input.length) {
    const day: TranslationEntry[] = [];

    // Introduce new words for this day
    const startIndex = dayIndex * newWordsPerDay;
    const endIndex = Math.min(startIndex + newWordsPerDay, wordOrder.length);

    // Add new words for this day
    for (let i = startIndex; i < endIndex; i++) {
      const word = wordOrder[i];
      introducedWords.add(word);
      usedEntriesCount[word] = 0;
    }

    // For each introduced word, add entries (up to entriesPerWord)
    // Use wordOrder to iterate through introduced words in original order
    for (const word of wordOrder.filter((w) => introducedWords.has(w))) {
      const entries = wordGroups[word];
      const usedCount = usedEntriesCount[word] || 0;

      // Skip if we've used all entries for this word
      if (usedCount >= entries.length) continue;

      // Add up to entriesPerWord entries for this word
      const entriesToAdd = Math.min(entriesPerWord, entries.length - usedCount);
      for (let i = 0; i < entriesToAdd; i++) {
        day.push(entries[usedCount + i]);
      }

      // Update used entries count
      usedEntriesCount[word] = usedCount + entriesToAdd;
    }

    // Add this day's entries to the output
    output.push(...day);

    // If we've introduced all words and this day had no entries, we're done
    if (introducedWords.size === wordOrder.length && day.length === 0) break;

    dayIndex++;
  }

  return output;
}

function main() {
  const inputFilePath = process.argv[2];
  const outputFilePath = process.argv[3];

  if (!inputFilePath || !outputFilePath) {
    console.error('Usage: bun reorderTranslationsCsv.ts <input-file> <output-file>');
    process.exit(1);
  }

  // Read the input CSV file
  const inputData = fs.readFileSync(inputFilePath, 'utf-8');
  const lines = inputData.split('\n').filter((line) => line.trim() !== '');

  // Parse the CSV lines into TranslationEntry objects
  const translations: TranslationEntry[] = lines.map((line) => {
    const [czechWord, czechContext, englishWord, englishContext, czechWordAudio, czechContextAudio] = line.split(',');
    return {
      czechWord,
      czechContext,
      englishWord,
      englishContext,
      czechWordAudio,
      czechContextAudio,
    };
  });

  // Reorder translations
  const newWordsPerDay = 10;
  const entriesPerWord = 1;
  const reorderedTranslations = reorderTranslations(translations, newWordsPerDay, entriesPerWord);

  // Write the reordered translations to the output file
  const outputData = reorderedTranslations
    .map(
      (entry) =>
        `${entry.czechWord},${entry.czechContext},${entry.englishWord},${entry.englishContext},${entry.czechWordAudio},${entry.czechContextAudio}`
    )
    .join('\n');

  fs.writeFileSync(outputFilePath, outputData);

  const wordPositionMap = new Map<string, number>();
  reorderedTranslations.forEach((entry, index) => {
    if (!wordPositionMap.has(entry.czechWord)) {
      wordPositionMap.set(entry.czechWord, index);
    }
  });
  const wordsSequence = reorderedTranslations.map((entry) => wordPositionMap.get(entry.czechWord));
  fs.writeFileSync('words_sequence.json', JSON.stringify({ wordsSequence, newWordsPerDay, entriesPerWord }), 'utf-8');
}

main();
