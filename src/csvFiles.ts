// Define proper type for translation entries
import fs from 'fs';

export type TranslationEntry = {
  czechWord: string;
  czechContext: string;
  englishWord: string;
  englishContext: string;
  czechWordAudio?: string;
  czechContextAudio?: string;
};

export function writeTranslationToCsv(translation: TranslationEntry[], csvPath: string) {
  // Helper function to escape CSV fields
  const escapeField = (field: string): string => {
    // Replace double quotes with two double quotes
    const escaped = field.replace(/"/g, '""');
    // Surround with double quotes
    return `"${escaped}"`;
  };

  const wrapSound = (str?: string) => {
    return str ? `[sound:${str}]` : '';
  };

  // Append translation entries
  translation.forEach(({ czechWord, czechContext, englishWord, englishContext, czechWordAudio, czechContextAudio }) => {
    const csvLine = `${escapeField(czechWord)},${escapeField(czechContext)},${escapeField(englishWord)},${escapeField(englishContext)},${escapeField(wrapSound(czechWordAudio))},${escapeField(wrapSound(czechContextAudio))}\n`;
    fs.appendFileSync(csvPath, csvLine);
  });
}