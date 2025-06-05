import { Job, Queue, Worker } from 'bullmq';
import { generateSpeechViaHttp, type SpeechGenerationResult } from './src/tts.ts';
import { rateLimitedGetFlashcardCompletion } from './src/flashcards.ts';
import { AUDIO_JOB_NAME, AUDIO_QUEUE_NAME, JOB_NAME_TRANSLATION, QUEUE_NAME_TRANSLATION } from './src/constants.ts';
import path from 'path';
import IORedis from 'ioredis';
import { parseArgs } from 'node:util';
import { writeTranslationToCsv } from './src/csvFiles.ts';

import { hashString } from './src/lib/util.ts';

// Parse command line arguments
const { values } = parseArgs({
  options: {
    'tts-backends': {
      type: 'string',
      short: 't',
      multiple: true,
      default: ['http://localhost:5002'],
    },
  },
});

const ttsBackends = values['tts-backends'] as string[];
console.log(`Using TTS backends: ${ttsBackends.join(', ')}`);

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

// Worker for translation jobs
const translationWorker = new Worker(
  QUEUE_NAME_TRANSLATION,
  async (job) => {
    // console.log('job', job.id, job.data);
    if (job.name === JOB_NAME_TRANSLATION) {
      const { word } = job.data;

      // Perform translation
      const translation = await rateLimitedGetFlashcardCompletion(word);
      // console.log('Translation result:', translation);

      // Generate hashes and enhance translation data with audio file paths
      const enhancedTranslation = translation.map((entry) => {
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
    concurrency: 50,
    limiter: { max: 10, duration: 1000 },
  }
);

// Audio worker factory that creates a worker for each TTS backend
function createAudioWorker(baseUrl: string): Worker {
  return new Worker(
    AUDIO_QUEUE_NAME,
    async (job: Job) => {
      // console.log('Audio job', job.id, job.data);
      const { word, outputFile } = job.data;
      const outPath = `audio/${outputFile}`;

      const result: SpeechGenerationResult = await generateSpeechViaHttp(word, outPath, baseUrl);

      if (result.success) {
        // console.log(`Audio generated from ${baseUrl}: ${result.outputFile}`, result);
        return result;
      } else {
        throw result;
      }
    },
    {
      connection,
      concurrency: ttsBackends.length * 10, // Concurrency 1 on macOS
    }
  );
}

// Create workers for each TTS backend
const audioWorkers = ttsBackends.map((baseUrl) => createAudioWorker(baseUrl));

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
      .map(([status, count]) => `${status.charAt(0)}:${count}`)
      .join(' ');
  };

  const translationStatus = formatStatusSummary(translationCounts);
  const audioStatus = formatStatusSummary(audioCounts);

  console.log(
    `[${timestamp}] Translation: ${translationDone}/${translationTotal} [${translationStatus}], Audio: ${audioDone}/${audioTotal} [${audioStatus}]`
  );
}

// Track when queues become empty
let emptyQueueTimestamp: number | null = null;
const WAIT_FOR_NEW_JOBS_MS = 5000; // Wait 5 seconds to confirm no new jobs

async function checkAndExitIfDone() {
  const translationCounts = await translationQueue.getJobCounts();
  const audioCounts = await audioQueue.getJobCounts();

  // Check for any active, waiting, delayed, or paused jobs
  const pendingStatuses = ['active', 'waiting', 'delayed', 'paused'];
  const anyPendingJobs = pendingStatuses.some(
    (status) => (translationCounts[status] || 0) > 0 || (audioCounts[status] || 0) > 0
  );

  const now = Date.now();

  if (!anyPendingJobs) {
    if (emptyQueueTimestamp === null) {
      // First time seeing empty queues
      emptyQueueTimestamp = now;
      console.log(`No pending jobs found. Will exit if this persists for ${WAIT_FOR_NEW_JOBS_MS / 1000} seconds...`);
    } else if (now - emptyQueueTimestamp >= WAIT_FOR_NEW_JOBS_MS) {
      // Queues remained empty for the waiting period
      console.log(`No new jobs appeared in the last ${WAIT_FOR_NEW_JOBS_MS / 1000} seconds. Shutting down...`);

      await gracefullyShutDown();
    }
  } else if (emptyQueueTimestamp !== null) {
    // Reset if pending jobs appear again
    console.log('Pending jobs detected, continuing execution...');
    emptyQueueTimestamp = null;
  }
}

async function gracefullyShutDown() {
  await translationWorker.close();

  // Close all audio workers
  for (const worker of audioWorkers) {
    await worker.close();
  }

  await connection.quit();
  console.log('Workers and connection closed.');
  process.exit(0);
}

// Update the interval to check for completion
setInterval(async () => {
  await logQueueProgress();
  await checkAndExitIfDone();
}, 2000);

// Handle application shutdown to properly close workers
process.on('SIGINT', gracefullyShutDown);

console.log('Workers and queues initialized.');

// Export workers for external use
export { translationWorker, audioWorkers };
