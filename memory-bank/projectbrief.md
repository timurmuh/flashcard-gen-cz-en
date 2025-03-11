# Anki Flashcard generator

This project is aimed to generate flashcards for stydying Czech language in Anki.

The idea is to create a LLM-augmented tooling that would take top N Czech words (by usage) and generate flashcards for each word, all with context and pronunciation audio. Generated flashcards would then get imported into Anki and subsequently used in studying.

## Note on generating translations and contexts

Because words between languages are not mapped 1 to 1 (a single word in one language can mean different things in another language, depending on the context), we need to account for all possible usages when generating materials. The idea is to take a Czech word and ask LLM to generate all possible translations and context (example usage) for each to better carry the meaning.

The prompt can go something like this:

```
You are an expert Czech language teacher tasked with creating flashcards for Czech-to-English vocabulary. Words will be provided in batches. For each Czech word, list all possible English translations along with a context sentence for each translation. The output must strictly follow the provided JSON format.
```

It should be improved if possible, however.

Some experimentation showed that when giving a single word, an LLM can properly generate multiple contexts (likely all possible usages), but when fed words in batches, it tends to generate only one context per word.

## Features

### Flashcard generation

Use Gemini Flash 2.0 via OpenRouter, to save costs for generation.

### Pronunciation

Add pronunciation audio using [XTTS-v2](https://huggingface.co/coqui/XTTS-v2), ideally hosted locally via Docker. There should be a docker-compose.yml with the model, of course.

Pronunciation is needed for Czech words / sentences only.

### Preparing for import into Anki

It should be importable into Anki using the "Import text file" workflow, as described here: https://docs.ankiweb.net/importing/text-files.html

The repo should also have a GUIDE.md file, which would describe the process generating the deck and importing it into Anki. Including the instructions for creating the necessary card type.

### Misc

The generation process should be interruptable / resumable. Naturally, the generated output file should carry all the context that is needed for resuming the generation. If that's not possible, then there should be an intermediary format which would allow tracking the necessary metadata, and which would get converted into the format importable by Anki at the end of the process.

We should save costs during development. Therefore, there should be an option to run the process on some small subset of the input words, so that the validation during development would be dirt cheap.

## Input

`words.txt` - top 5000 Czech words, sorted by frequency
