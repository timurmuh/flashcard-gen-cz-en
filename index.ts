import { Queue, Worker } from 'bullmq';
import { generateSpeechViaCli, type SpeechGenerationSuccess } from './src/tts.ts';
import { getFlashcardCompletion } from './src/flashcards.ts';
import {
  QUEUE_NAME_TRANSLATION,
  AUDIO_QUEUE_NAME,
  JOB_NAME_TRANSLATION,
  AUDIO_JOB_NAME,
} from './src/constants.ts';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import IORedis from 'ioredis';

const connection = new IORedis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
});

// Translation queue setup
const translationQueue = new Queue(QUEUE_NAME_TRANSLATION, {
  connection,
});

// Audio generation queue setup
const audioQueue = new Queue(AUDIO_QUEUE_NAME, {
  connection,
});

// Define proper type for translation entries
type TranslationEntry = {
  czechWord: string;
  czechContext: string;
  englishWord: string;
  englishContext: string;
  czechWordAudio?: string;
  czechContextAudio?: string;
}

function writeTranslationToCsv(translation: TranslationEntry[], csvPath: string) {
  // Ensure CSV file exists with header
  // if (!fs.existsSync(csvPath)) {
  //   fs.writeFileSync(csvPath, 'czechWord,czechContext,englishWord,englishContext,czechWordAudio,czechContextAudio\n');
  // }

  // TODO handle newlines in the data; check the docs for Anki or simply cut out the newlines, replacing them with
  //  spaces and ensuring that there is only at most a single space at once

  const wrapSound = (str?: string) => {
    return str ? `[sound:${str}]` : '';
  };

  // Append translation entries
  translation.forEach(({ czechWord, czechContext, englishWord, englishContext, czechWordAudio, czechContextAudio }) => {
    const csvLine = `${czechWord},${czechContext},${englishWord},${englishContext},${wrapSound(czechWordAudio)},${wrapSound(czechContextAudio)}\n`;
    fs.appendFileSync(csvPath, csvLine);
  });
}

function hashString(str: string): string {
  return createHash('sha256').update(str).digest('hex');
}

// Worker for translation jobs
const translationWorker = new Worker(
  QUEUE_NAME_TRANSLATION,
  async (job) => {
    console.log('job', job.id, job.data);
    if (job.name === JOB_NAME_TRANSLATION) {
      const { word } = job.data;

      // Perform translation
      const translation = await getFlashcardCompletion(word);
      console.log('Translation result:', translation);

      // Generate hashes and enhance translation data with audio file paths
      const enhancedTranslation = translation.map(entry => {
        const czechWordHash = hashString(entry.czechWord);
        const czechContextHash = hashString(entry.czechContext);

        return {
          ...entry,
          czechWordAudio: `${czechWordHash}.wav`,
          czechContextAudio: `${czechContextHash}.wav`,
        };
      });

      // Save translation to CSV
      const csvPath = path.resolve('translations.csv');
      writeTranslationToCsv(enhancedTranslation, csvPath);

      // Generate audio for czechWord and czechContext in all results
      for (const { czechWord, czechContext, czechWordAudio, czechContextAudio } of enhancedTranslation) {
        await audioQueue.add(AUDIO_JOB_NAME, {
          word: czechWord,
          outputFile: czechWordAudio,
        });

        await audioQueue.add(AUDIO_JOB_NAME, {
          word: czechContext,
          outputFile: czechContextAudio,
        });
      }
    }
  },
  {
    connection,
    limiter: { max: 10, duration: 1000 },
  },
);

// Worker for audio generation jobs
const audioWorker = new Worker(
  AUDIO_QUEUE_NAME,
  async (job) => {
    const { word, outputPath } = job.data;

    // Generate audio using CLI
    // TODO use server for audio generation
    const result: SpeechGenerationSuccess = await generateSpeechViaCli(word, `audio/${outputPath}`);
    console.log(`Audio generated: ${result.outputFile}`, result);
  },
  {
    connection,
    concurrency: process.platform === 'darwin' ? 1 : 10, // Concurrency 1 on macOS
  },
);

async function logQueueProgress() {
  const translationCounts = await translationQueue.getJobCounts();
  const audioCounts = await audioQueue.getJobCounts();

  const translationTotal = Object.values(translationCounts).reduce((a, b) => a + b, 0);
  const translationDone = translationCounts.completed || 0;

  const audioTotal = Object.values(audioCounts).reduce((a, b) => a + b, 0);
  const audioDone = audioCounts.completed || 0;

  // Format timestamp as HH:MM:SS
  const now = new Date();
  const timestamp = now.toTimeString().split(' ')[0];

  // Create concise status summary
  const formatStatusSummary = (counts: Record<string, number>) => {
    return Object.entries(counts)
      // .filter(([_, count]) => count > 0)
      .map(([status, count]) => `${status.charAt(0)}:${count}`)
      .join(' ');
  };

  const translationStatus = formatStatusSummary(translationCounts);
  const audioStatus = formatStatusSummary(audioCounts);

  console.log(`[${timestamp}] Translation: ${translationDone}/${translationTotal} [${translationStatus}], Audio: ${audioDone}/${audioTotal} [${audioStatus}]`);
}

setInterval(logQueueProgress, 2000);

// Handle application shutdown to properly close workers
process.on('SIGINT', async () => {
  await translationWorker.close();
  await audioWorker.close();
  await connection.quit();
  console.log('Workers and connection closed.');
  process.exit(0);
});

console.log('Workers and queues initialized.');

// Export workers for external use (fixes unused variable warnings)
export { translationWorker, audioWorker };