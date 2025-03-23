// Gather environment variables
import {generateSpeech, type SpeechGenerationSuccess} from "./src/tts.ts";
import {getFlashcardCompletion} from "./src/flashcards.ts";

async function main() {
  const words = ['pak', 'musím', 'asi', 'řekl', 'budu', 'říct', 'před', 'někdo', 'hej', 'všichni', 'opravdu'];
  const response = await getFlashcardCompletion(words[0]);
  console.log(JSON.stringify(response, null, 2));

  const speechGenerationResult: SpeechGenerationSuccess = await generateSpeech(words[0], `audio/${words[0]}`);
  console.log(speechGenerationResult);
}

main();
