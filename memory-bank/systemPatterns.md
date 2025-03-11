## System Patterns

### System Architecture

The system will consist of several components:

1.  **Flashcard Generator:** This component will use an LLM (Gemini Flash 2.0 via OpenRouter) to generate flashcards for Czech words.
2.  **Pronunciation Generator:** This component will use XTTS-v2 to generate pronunciation audio for Czech words and sentences.
3.  **Anki Importer:** This component will format the generated flashcards into a format that can be imported into Anki.

### Key Technical Decisions

1.  Using Gemini Flash 2.0 via OpenRouter for flashcard generation to save costs.
2.  Using XTTS-v2 for pronunciation audio generation, ideally hosted locally via Docker.
3.  Using the "Import text file" workflow in Anki for importing flashcards.

### Design Patterns in Use

The project will likely use the following design patterns:

1.  **Facade:** To provide a simplified interface for generating and importing flashcards.
2.  **Factory:** To create different types of flashcards based on the input word.

### Component Relationships

1.  The Flashcard Generator will take a Czech word as input and generate translations, context sentences, and other relevant information.
2.  The Pronunciation Generator will take a Czech word or sentence as input and generate pronunciation audio.
3.  The Anki Importer will take the generated flashcard data and format it into a format that can be imported into Anki.
