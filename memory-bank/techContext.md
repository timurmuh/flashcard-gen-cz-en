## Tech Context

### Technologies Used

- TypeScript
- Node.js
- OpenRouter API (Gemini Flash 2.0)
- XTTS-v2 (ideally hosted locally via Docker)
- Anki

### Development Setup

The development setup includes:

- VSCode as the IDE
- bun as the package manager
- Docker (for hosting XTTS-v2)

### Technical Constraints

- Cost limitations when using OpenRouter API.
- Local hosting of XTTS-v2 may require significant computational resources.
- The need to handle potential rate limits from the OpenRouter API.

### Dependencies

- axios
- @coqui/xtts
- @types/node
- bun
