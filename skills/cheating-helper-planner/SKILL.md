---
name: cheating-helper-planner
description: Analyze and plan Cheating Helper changes involving AI providers, model roles, model selection settings, Groq quotas, rate-limit handling, streaming, transcription, vision, or local AI. Use before implementing any change that adds, removes, replaces, or reassigns a model or changes provider preferences and fallback behavior.
---

# Cheating Helper Planner

Plan before editing application code.

## Workflow

1. Read `PROJECT_PROMPT.md`, `AGENT_MAP.md`, the relevant `tasks/*.md`, and affected source files.
2. Map each current model to evidenced capabilities: live audio, transcription, text generation, vision/screen analysis, or local inference.
3. Verify external model availability, capabilities, deprecations, and limits using official provider sources.
4. Separate settings by capability. Never offer a text-only model in a transcription or vision selector.
5. Trace preference state through UI, preload/IPC, storage, and runtime consumer.
6. For Groq limits, use documented response headers. Do not infer quotas from characters or hardcoded public-tier values when headers are available.
7. Inspect related upstream issues and PRs before proposing new code.
8. Break the change into the smallest independently verifiable tasks. Record files, acceptance criteria, checks, and fallback behavior.
9. Ask the user to resolve any model, default, fallback, or UI ambiguity before implementation.

## Agent Routing

- Delegate model-flow tracing to `model-architecture`.
- Delegate current Groq models and limit semantics to `groq-limits`.
- Delegate settings persistence and minimal checks to `settings-quality`.
- Keep code edits and final decisions with the main agent after user approval.

## Required Output

Update the relevant task file with:

- current-state evidence with file/function locations;
- capability-to-model matrix;
- proposed settings and defaults;
- ordered subtasks with `TODO`, `IN_PROGRESS`, `BLOCKED`, or `DONE`;
- acceptance criteria and runnable checks;
- explicit questions for every unresolved product choice.

Do not implement application changes during the planning run.
