// Gather environment variables
import {generateSpeech, type SpeechGenerationSuccess} from "./src/tts.ts";
import {getFlashcardCompletion} from "./src/flashcards.ts";

// TODO queue for translation jobs
//  - global concurrency 100, initial interval 1000 / cap 1
//  - first job - check OpenRouter /auth/key for rate limit
//  - periodically check /auth/key and update rate limit; do it every cap*5 jobs
//  - on completion, put all text into csv for anki, and create 4 jobs for generating audio (audio name is hash of text)

// TODO queue for audio generation jobs
//  - use existing cli version for now

// TODO report progress in terminal - print pending/completed/failed/total jobs for both queues
//  - maybe get some tui / terminal logging library for this?

// TODO what is the structure of the deck for Anki? how to create it?


async function main() {
  const words = ['pak', 'musím', 'asi', 'řekl', 'budu', 'říct', 'před', 'někdo', 'hej', 'všichni', 'opravdu'];
  const response = await getFlashcardCompletion(words[0]);
  console.log(JSON.stringify(response, null, 2));

  const speechGenerationResult: SpeechGenerationSuccess = await generateSpeech(words[0], `audio/${words[0]}`);
  console.log(speechGenerationResult);
}

main();
