# Cheating Helper

Cheating Helper is a desktop assistant for interviews, meetings, presentations, and other live conversations. It can capture speech or a screenshot, send the relevant context to an AI model, and show the answer in a compact always-on-top Electron window.

Current version: `0.8.0`

## What it does

- Answers typed questions and captured speech in hosted or local mode.
- Captures system audio or a microphone with separate push-to-talk shortcuts.
- Analyzes screenshots through Groq or a local vision-capable Ollama model.
- Uses reusable AI Profiles for different roles, response styles, and factual context.
- Keeps conversation and screen-analysis history locally.
- Lets you select and copy individual History messages.
- Can save analyzed screenshots with their History entries. This is optional and off by default.
- Supports an always-on-top overlay, click-through mode, themes, transparency, and configurable shortcuts.

## AI configuration

Hosted mode currently separates models by capability:

- Speech-to-text: Groq Whisper.
- Text responses: a selected Groq text model.
- Screenshot extraction: a Groq vision model, followed by the selected text model for the final answer.

Local mode uses Whisper for speech-to-text and Ollama for text or screenshot responses. Local and hosted processing are separate choices; the app does not silently switch between them.

Gemini is currently disabled.

## Getting started

Requirements:

- Node.js and npm.
- A Groq API key for hosted speech, text, and screenshot processing.
- Windows audio and screen-capture permissions as needed.
- Ollama only if you want local screenshot analysis.

Install dependencies and start the development build:

```powershell
npm install
npm start
```

Create a packaged application:

```powershell
npm run package
```

The current release has been packaged and smoke-tested on Windows x64. macOS and Linux code remains in the project, but those builds are not claimed as verified.

## Basic use

1. Open Home and add your Groq API key.
2. Choose a text model, screenshot provider, audio source, and language.
3. Select or create an AI Profile.
4. Start a session.
5. Use the configured shortcuts to record speech, analyze the screen, move the window, or enable click-through mode.
6. Open History to review and copy saved answers.

The Help screen inside the app shows the active keyboard shortcuts.

## AI Profiles

Profiles control the facts the assistant may use and how it should answer. API keys and model selection remain global settings.

The repository includes profiles for a Senior Java interview and an EPAM HR call. You can create, duplicate, import, export, and edit your own profiles. Profile changes apply after starting a new session; they do not alter a session already in progress.

## History and screenshots

Conversation text and screen-analysis answers are stored locally in the application configuration directory.

If `Save analyzed screenshots in local History` is enabled, each successful screen analysis stores its JPEG separately from the session JSON. Deleting the session also deletes its screenshots. Older History entries without images remain readable.

Screenshots can contain passwords, messages, source code, personal data, and other sensitive information. Leave this setting off unless you need the visual record.

## Development checks

The project uses JavaScript and Lit with Electron Forge.

```powershell
node test/storage.test.js
node test/profile.test.js
node test/vision.test.js
npm run package
```

All autonomous checks are available under `test/*.test.js`. There is no configured linter yet.

## Project status

Cheating Helper is under active development. Remote updates and external feedback links are intentionally disabled until the fork has its own release and support infrastructure.

## Attribution and license

Cheating Helper is an independent fork of [Cheating Daddy](https://github.com/sohzm/cheating-daddy). The upstream project does not provide support, feedback, or updates for this fork.

Licensed under GPL-3.0. See [LICENSE](LICENSE).
