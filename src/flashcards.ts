import { getEnvVar, removeUnsupportedProperties } from './lib/util.ts';
import { zodResponseFormat } from 'openai/helpers/zod';
import OpenAI from 'openai';
import flashcardPrompt from '../flashcard_prompt.txt';
import { z } from 'zod';

const OPENAI_API_KEY = getEnvVar('OPENAI_API_KEY');
const OPENAI_BASE_URL = getEnvVar('OPENAI_BASE_URL');
const MODEL_NAME = getEnvVar('MODEL_NAME');

const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: OPENAI_BASE_URL,
});

const FlashcardCompletionResponseSchema = z
  .array(
    z
      .object({
        czechWord: z.string().describe('The word in Czech'),
        czechContext: z.string().describe('A sentence in Czech that uses the word'),
        englishWord: z.string().describe('The word in English, translated from the Czech word'),
        englishContext: z
          .string()
          .describe('A sentence in English that uses the word, translated from the Czech context'),
      })
      .describe('A flashcard mapping a Czech word to an English word, along with usage context'),
  )
  .describe('A list of flashcards mapping Czech words to English words');

type FlashcardCompletionResponse = z.infer<typeof FlashcardCompletionResponseSchema>;

/**
 * Get a completion for a flashcard
 * @param czWord a word in Czech
 */
export async function getFlashcardCompletion(czWord: string): Promise<FlashcardCompletionResponse> {
  const responseFormat = removeUnsupportedProperties(
    zodResponseFormat(FlashcardCompletionResponseSchema, 'czech_english_flashcards_response'),
  );

  const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: MODEL_NAME,
    messages: [
      {
        role: 'system',
        content: flashcardPrompt,
      },
      // ...czWord.map(
      //   (czWord) =>
      //     ({
      //       role: 'user',
      //       content: czWord,
      //     } as OpenAI.Chat.Completions.ChatCompletionMessageParam)
      // ),
      {
        role: 'user',
        content: czWord,
      } as OpenAI.Chat.Completions.ChatCompletionMessageParam,
    ],
    response_format: responseFormat,
  };

  const response = await client.chat.completions.create(params);

  console.log('Completions response\n', JSON.stringify(response, null, 2));

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('No content in response');
  } else {
    return JSON.parse(content);
  }
}

type FetchOpenRouterKeyResponse = {
  data: {
    label: string;
    usage: number; // Number of credits used
    limit: number | null; // Credit limit for the key, or null if unlimited
    is_free_tier: boolean; // Whether the user has paid for credits before
    rate_limit: {
      requests: number; // Number of requests allowed...
      interval: string; // in this interval, e.g. "10s"
    };
  };
};

/**
 * Parses time interval strings like "10s", "5m", "1h" into seconds
 * @param interval String representing a time interval
 * @returns Number of seconds
 */
function parseTimeInterval(interval: string): number {
  const regex = /^(\d+)([smh])$/;
  const match = interval.match(regex);

  if (!match) {
    return 1; // Default to 1 second if format is unrecognized
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    default:
      return 1;
  }
}

/**
 * Fetches the current credit information from OpenRouter
 */
export async function fetchOpenRouterRateLimit(): Promise<number> {
  const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch auth key info: ${response.statusText}`);
  }

  const data = await response.json() as FetchOpenRouterKeyResponse;

  // Extract request rate from the response
  const requestsPerInterval = data.data.rate_limit.requests;
  const interval = data.data.rate_limit.interval;

  // Parse interval (e.g., "10s" -> 10 seconds)
  const seconds = parseTimeInterval(interval);

  // Calculate requests per second
  const rateLimit = Math.max(1, requestsPerInterval / seconds);
  return rateLimit;
}


// Module-level state to track rate limiting
let currentRateLimit = 1; // Default conservative limit (1 request per second)
let lastRateLimitCheck = 0; // Timestamp when rate limit was last checked
let lastRequestTime = 0; // Timestamp of the last API call
const RATE_LIMIT_CHECK_INTERVAL = 60 * 1000; // Minimum 60 seconds between rate limit checks

/**
 * Rate-limited version of getFlashcardCompletion
 * Automatically fetches and adjusts to the current rate limits
 * @param czWord a word in Czech
 */
export async function rateLimitedGetFlashcardCompletion(
  czWord: string,
): Promise<FlashcardCompletionResponse> {
  const now = Date.now();

  // Check if we should update the rate limit
  if (now - lastRateLimitCheck >= RATE_LIMIT_CHECK_INTERVAL) {
    try {
      currentRateLimit = await fetchOpenRouterRateLimit();
      console.log(`Updated rate limit: ${currentRateLimit} requests per second`);
      lastRateLimitCheck = now;
    } catch (error) {
      console.error('Failed to fetch rate limit:', error);
      // Continue with existing rate limit
    }
  }

  // Calculate how long to wait based on current rate limit
  const minTimeBetweenRequests = 1000 / currentRateLimit;
  const timeToWait = Math.max(0, minTimeBetweenRequests - (now - lastRequestTime));

  // Wait if needed to respect rate limit
  if (timeToWait > 0) {
    await new Promise(resolve => setTimeout(resolve, timeToWait));
  }

  // Make the actual API call
  const result = await getFlashcardCompletion(czWord);

  // Update last request time after the call completes
  lastRequestTime = Date.now();

  return result;
}