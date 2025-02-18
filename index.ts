// Gather environment variables
import OpenAI from "openai";
import {z} from "zod";
import {zodResponseFormat} from "openai/helpers/zod";
import {getEnvVar, removeUnsupportedProperties} from "./util.ts";
import flashcardPrompt from "./flashcard_prompt.txt";

const OPENAI_API_KEY = getEnvVar("OPENAI_API_KEY");
const OPENAI_BASE_URL = getEnvVar("OPENAI_BASE_URL");
const MODEL_NAME = getEnvVar("MODEL_NAME");

const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: OPENAI_BASE_URL,
});

const FlashcardCompletionResponse = z.array(
  z.object({
    czechWord: z.string().describe('The word in Czech'),
    czechContext: z.string().describe('A sentence in Czech that uses the word'),
    englishWord: z.string().describe('The word in English, translated from the Czech word'),
    englishContext: z.string().describe('A sentence in English that uses the word, translated from the Czech context'),
  }).describe('A flashcard mapping a Czech word to an English word, along with usage context')
).describe('A list of flashcards mapping Czech words to English words');

/**
 * Get a completion for a flashcard
 * @param czWords a list of words in Czech
 */
async function getFlashcardCompletion(czWords: string[]) {
  const responseFormat = removeUnsupportedProperties(zodResponseFormat(FlashcardCompletionResponse, 'czech_english_flashcards_response'));

  const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: MODEL_NAME,
    messages: [
      {
        role: 'system',
        content: flashcardPrompt,
      },
      ...czWords.map(czWord => ({
        role: 'user',
        content: czWord
      }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
    ],
    response_format: responseFormat,
  }

  const response = await client.chat.completions.create(params);

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('No content in response');
  } else {
    return JSON.parse(content);
  }
}

function main() {
  getFlashcardCompletion([
    "pak",
    "musím",
    "asi",
    "řekl",
    "budu",
    "říct",
    "před",
    "někdo",
    "hej",
    "všichni",
    "opravdu",
  ])
    .then((response) => {
      console.log(JSON.stringify(response, null, 2));
    })
    .catch((error) => {
      console.error(error);
    });
}

main();