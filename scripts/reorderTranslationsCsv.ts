import fs from 'fs';
import type { TranslationEntry } from '../src/csvFiles';
import { reorderTranslations } from '../src/reorderTranslations';

/**
 * Type-specific version of reorderTranslations for backward compatibility
 * with existing code that uses TranslationEntry.
 */
export function reorderTranslationEntries(
  input: TranslationEntry[],
  newWordsPerDay = 5,
  entriesPerWord = 1
): TranslationEntry[] {
  return reorderTranslations(input, newWordsPerDay, entriesPerWord, (entry) => entry.czechWord);
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
  const reorderedTranslations = reorderTranslationEntries(translations, newWordsPerDay, entriesPerWord);

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
