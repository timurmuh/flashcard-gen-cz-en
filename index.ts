// Gather environment variables
import OpenAI from "openai";
import {z} from "zod";
import {zodResponseFormat} from "openai/helpers/zod";
import {getEnvVar, removeUnsupportedProperties} from "./util.ts";

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
 * @param czWord a word in Czech
 */
async function getFlashcardCompletion(czWord: string) {
  const responseFormat = removeUnsupportedProperties(zodResponseFormat(FlashcardCompletionResponse, 'czech_english_flashcards_response'));

  const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: MODEL_NAME,
    messages: [
      {
        role: 'system',
        content: `
You are a Czech language teacher. You will be given words in Czech. You will be creating text for flashcards that map English words to Czech words. Since words don’t always map 1 to 1 between languages, you will be listing all possible translations within different usage contexts. For each Czech word and each possible translation / usage context you must output the following the following in a strict json format: word in Czech, context sentence in Czech, word in English, context sentence in English.`
      },
      {
        role: 'user',
        content: czWord
      }
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
  getFlashcardCompletion("kůň")
    .then((response) => {
      console.log(JSON.stringify(response, null, 2));
    })
    .catch((error) => {
      console.error(error);
    });
}

main();