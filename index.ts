// Gather environment variables
import OpenAI from "openai";
import {z} from "zod";
import {zodResponseFormat} from "openai/helpers/zod";

function getEnvVar(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const OPENAI_API_KEY = getEnvVar("OPENAI_API_KEY");
const OPENAI_BASE_URL = getEnvVar("OPENAI_BASE_URL");
const MODEL_NAME = getEnvVar("MODEL_NAME");

const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: OPENAI_BASE_URL,
});

const FlashcardCompletionResponse = z.array(z.object({
  czechWord: z.string(),
  czechContext: z.string(),
  englishWord: z.string(),
  englishContext: z.string(),
}))

/**
 * Get a completion for a flashcard
 * @param czWord a word in Czech
 */
function getFlashcardCompletion(czWord: string) {
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
    response_format: zodResponseFormat(FlashcardCompletionResponse, 'czech_english_flashcards_response'),
  }
  return client.chat.completions.create(params);
}

function main() {
  getFlashcardCompletion("kůň")
    .then((response) => {
      console.log(response);
    })
    .catch((error) => {
      console.error(error);
    });
}

main();