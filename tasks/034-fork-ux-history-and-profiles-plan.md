# 034 — Fork ownership, History evidence, profiles and small UX fixes

Status: `DONE`

## Normalized user request

Make the fork clearly owned by Cheating Helper and remove misleading routes to the
upstream maintainer. Improve History so its text can be selected and copied, and
optionally preserve the screenshot that produced each Screen answer. Clarify the
duplicate EPAM profiles before deleting anything. Make Response Style easier to edit
and bring the remaining native arrow control into the current visual style.

This is a planning task only. No application code may be changed until the user
confirms the product decisions below.

## Scope

1. Help, Website, GitHub, Discord, Feedback and update ownership.
2. Text selection and per-message copying in History.
3. Local screenshot evidence for successful Screen history entries.
4. Duplicate EPAM profile identification and safe cleanup.
5. A slightly larger multiline Response Style editor.
6. Visual refinement of the vertical scrollbar and its native up/down buttons.

## Out of scope

- Rebranding provider infrastructure or silently changing the upstream cloud API.
- Changing AI providers, model IDs, model defaults, quotas, streaming or fallbacks.
- Migrating Lit/JavaScript to React, TypeScript or shadcn.
- Automatically deleting a profile based only on a duplicate display name.
- Adding a remote update service or feedback backend without an owner-controlled URL.

## Read-only agent brief used for this planning run

```text
Analyze the requested Cheating Helper improvement strictly read-only. Read
PROJECT_PROMPT.md, AGENT_MAP.md, the relevant tasks and affected source files.
Do not edit application code. Trace the current behavior to concrete
file/function/line evidence. Recommend the smallest Lit/JavaScript solution,
preserve privacy and backward compatibility, list acceptance criteria and runnable
checks, and record every unresolved product choice instead of guessing.
```

### Agent-specific prompts used

`settings-quality`:

```text
Find every active and dormant Help/Website/Feedback/Update route that belongs to
upstream; propose a truthful fork-owned state without inventing URLs. Diagnose why
History text cannot be selected despite task 024. Inspect Response Style sizing and
the native arrow/caret controls. Return evidence, minimal work, checks and questions.
```

`prompt-runtime`:

```text
Identify the exact live profile IDs, names, origin and selected profile without
deleting anything. Trace screenshot capture through analysis, history persistence
and rendering. Compare image-storage options for privacy, disk use, cleanup and old
session compatibility; recommend one minimal design.
```

## Current-state evidence

### Fork ownership

- `src/components/app/CheatingDaddyApp.js:447-467` compares the installed fork
  version with upstream `sohzm/cheating-daddy`.
- `src/components/app/CheatingDaddyApp.js:975-993` presents that result as an
  available update and opens `https://cheatingdaddy.com/download`.
- `src/components/views/HelpView.js:163-169` labels the upstream website, repository
  and Discord as this app's Support destinations.
- `src/components/views/FeedbackView.js:4-41` embeds the upstream-owned Google Form.
- `src/components/app/AppHeader.js:161-194` contains a second, currently dormant
  upstream update check and link which could be reintroduced later.
- `src/utils/cloud.js:36` is provider/runtime infrastructure and is not part of this
  navigation cleanup.

### History selection and copy

- `src/components/views/sharedPageStyles.js:3-9` applies `user-select: none` to every
  element.
- `src/components/views/HistoryView.js:174-180` re-enables selection only on the
  parent `.message`, while the text is rendered in nested `.message-body` elements
  at `src/components/views/HistoryView.js:395-404` and `:413-420`.
- The nested universal rule therefore explains why the UI can still block selection.
- There is no Copy action or result state. Task `024-history-copy-actions.md` is
  still `TODO` and its claim that selection already works is stale.

### Screenshot history

- `src/utils/renderer.js:609-686` and `:701-786` capture a frame as compressed JPEG
  data and send it to the main process.
- `src/utils/gemini.js:1653-1739` validates and analyzes that image.
- `src/utils/gemini.js:220-246` persists only timestamp, prompt, answer and model
  metadata. The image is dropped at this boundary.
- `src/utils/renderer.js:904-911` and `src/storage.js:818-837` save only that
  text/metadata array in the session JSON.
- `src/components/views/HistoryView.js:410-422` consequently has only the answer to
  render.

### Live profiles

The current Windows profile store contains:

| ID | Display name | Finding |
|---|---|---|
| `profile_senior_java_interview` | Senior Java Interview | Current selected technical profile; keep. |
| `profile_epam_hr_call` | EPAM HR Call | Older HR profile and candidate for removal only after confirmation. |
| `profile_epam_hr_call-2` | EPAM HR Call | Newer refined import matching `profiles/epam-hr-call.json`. |

- `src/components/views/AICustomizeView.js:354-372` groups all non-built-in entries
  under My Profiles but does not expose their IDs, so duplicate names are
  indistinguishable.
- The `-2` suffix is consistent with import collision handling in `src/storage.js`.
- `Charcola` is absent from the current profile store and source tree. It may refer
  to another running build, another screen, or a misread label; it cannot be safely
  acted on without a screenshot or clarification.

### Response Style and arrows

- `src/components/views/AICustomizeView.js:417` renders Response Style through a
  single-line input helper (`:506-510`), while the other prompt sections use
  multiline textareas (`:513-518`).
- Select controls already use a custom SVG chevron in
  `src/components/views/sharedPageStyles.js:123-131`.
- The user clarified that the disliked element is the vertical scrollbar with its
  native up/down buttons, not the number input or select chevrons.

## Capability-to-model matrix

No selector or model behavior changes in this task.

| Capability | Current role | Planned change |
|---|---|---|
| Hosted text response | Configured Groq text model | None |
| Hosted screenshot extraction | Configured Groq vision model | None |
| Hosted screenshot final answer | Frozen session text model | None |
| Local screenshot analysis | Configured Ollama vision model | None |
| Speech transcription/live audio | Existing configured pipeline | None |
| History persistence | Local session JSON; no image | Add optional local JPEG reference only |

## Recommended product design

### 1. Ownership and external routes

- Remove Website, Discord and Feedback navigation until owner-controlled
  destinations exist.
- Remove both upstream version checks and update buttons. Show the local version
  only until the fork has its own release feed and download destination.
- Keep an explicit `Based on Cheating Daddy` attribution in About/License, clearly
  separated from Cheating Helper support and updates.
- Keep provider-owned documentation links, such as the Groq console.

### 2. History text

- Explicitly enable selection on `.message-body` and nested message content inside
  History.
- Add a keyboard-accessible Copy action to every user message, AI answer and Screen
  answer.
- Copy the exact body only, without timestamp or labels, and briefly show `Copied`
  or a clear error.
- Do not change the stored history schema for this part.

### 3. Screenshot evidence

Use separate local JPEG assets, not base64 embedded in session JSON:

- Add `Save screenshots in History`, default `OFF` for privacy and backward
  behavior. Confirmed by the user.
- Save only a successfully analyzed screenshot, under a per-session directory.
- Store a safe relative `imageRef` plus byte size and dimensions in the matching
  Screen entry.
- Show a bounded thumbnail above the answer and allow deliberate enlargement.
- Old entries without `imageRef` remain answer-only.
- Failed/aborted analyses leave no asset. A failed session write rolls the asset
  back.
- Deleting one session or all history deletes the corresponding image assets.
- Resolve references only inside the configured history root and reject malformed
  or traversal paths.

This preserves the visual evidence without repeatedly rewriting multi-megabyte JSON
or keeping screenshots in memory while History loads.

### 4. Profiles

- First expose enough identity in the UI (description or short ID) to distinguish
  duplicates.
- Keep the refined `profile_epam_hr_call-2` and remove the older
  `profile_epam_hr_call`, as confirmed by the user.
- Preserve the selected Senior Java profile.

### 5. Small profile-editor polish

- Replace Response Style's single-line input with a compact 3–4 line textarea using
  the same persistence handler and schema.
- Style the vertical scrollbar track, thumb and supported native up/down buttons to
  match the current theme. Keep wheel, touchpad, drag, Page Up/Down, Home/End and
  keyboard scrolling unchanged.
- Prefer a compact themed scrollbar without inventing custom scroll logic. Where
  Chromium does not allow reliable button restyling, hide only the native buttons
  and retain the themed track/thumb.

## Ordered work

1. `DONE` Confirm external-link, screenshot-default, duplicate-profile and scrollbar
   decisions.
2. `DONE` Remove/neutralize misleading active and dormant support/update surfaces;
   retain truthful attribution.
3. `DONE` Correct History selection and complete task 024 with per-message Copy.
4. `DONE` Add opt-in screenshot asset persistence, safe reference resolution,
   rendering and deletion cleanup.
5. `DONE` Make duplicate profile identity visible, keep
   `profile_epam_hr_call-2`, and remove the confirmed older
   `profile_epam_hr_call`.
6. `DONE` Convert Response Style to a small multiline editor.
7. `DONE` Theme the vertical scrollbar and remove the visually inconsistent native
   up/down buttons where they cannot be styled reliably.
8. `DONE` Run automated checks and manual Electron smoke; record evidence before
   changing any item to `DONE`.

## Acceptance criteria

- No visible Help, Feedback or Update action routes a user to the upstream owner's
  support, form, community or download page.
- The app makes no upstream package-version request.
- Upstream attribution remains truthful and is not presented as fork support.
- Conversation and Screen text can be drag-selected.
- Each message copies its exact body with keyboard access and visible success/error
  feedback.
- With screenshot saving off, no image or reference is persisted.
- With it on, each successful Screen entry restores the correct thumbnail after
  restart; failed analysis leaves no file.
- Old history remains readable; malformed image references fail closed.
- Session deletion and Delete all remove related screenshot assets.
- Response Style is visibly multiline and persists unchanged.
- Duplicate EPAM profiles are distinguishable; no profile is deleted without
  explicit confirmation; Senior Java remains selected.
- The vertical scrollbar matches the theme; native up/down buttons are themed or
  hidden without breaking wheel, touchpad, drag or keyboard scrolling.

## Runnable checks

```powershell
rg -n "cheatingdaddy.com|sohzm/cheating-daddy|forms.gle/1JPoh81mUPkJMvje7|discord.gg/GCBdubnXfJ" src/components
node --check src/components/app/CheatingDaddyApp.js
node --check src/components/views/HelpView.js
node --check src/components/views/FeedbackView.js
node --check src/components/views/HistoryView.js
node --check src/components/views/AICustomizeView.js
node --check src/storage.js
node --check src/utils/gemini.js
git diff --check
```

Add focused automated checks for selectable nested message text, exact clipboard
content, screenshot schema compatibility, safe path resolution, failed-write
cleanup, session deletion cleanup, Response Style persistence and numeric bounds.
Then run all autonomous `test/*.test.js` files and a manual Electron smoke at a
narrow window width.

## Confirmed product decisions — 2026-07-29

1. Remove Website, Discord, Feedback and remote upstream update checking. Keep only
   clearly labeled upstream attribution.
2. Screenshot history is local, opt-in and `OFF` by default. Assets live until their
   session is deleted; no separate time/size retention cap in v1.
3. Keep the refined `profile_epam_hr_call-2` and remove the older
   `profile_epam_hr_call`; preserve the selected Senior Java profile.
4. The visual complaint concerns the vertical scrollbar with native up/down
   buttons. Theme the scrollbar and hide only unsupported native buttons; do not
   build custom scrolling behavior.
5. Implement per-message Copy first, without adding Copy conversation in this task.

`Charcola` remains unconfirmed because it is absent from the current profile store
and source tree. It is not a blocker for the confirmed EPAM cleanup.

## Implementation result — 2026-07-29

- Removed the active Feedback route/view, upstream update checks and dormant header
  update implementation. Help now identifies the upstream repository only as source
  and license attribution.
- History explicitly restores selection for nested message content and provides
  per-message Copy with success/error feedback.
- Added `saveScreenshotsInHistory`, default `false`. Successful analyzed screenshots
  can be stored as separate per-session JPEG files; session JSON keeps a safe
  relative `imageRef`. Opening a session hydrates only its referenced images.
- History renders a bounded screenshot preview with an accessible enlarged view.
  Invalid/absolute/traversal references fail closed. Session and Delete all cleanup
  remove related assets.
- Added one-time `epamHrDuplicateCleanupV1`: it removes
  `profile_epam_hr_call` only when `profile_epam_hr_call-2` exists. The live store
  completed with `removed: true`; Senior Java and the refined EPAM profile remain.
- Duplicate profile display names include their IDs until only one remains.
- Response Style is now a compact multiline field using the existing persistence
  path.
- Shared vertical scrollbars use the app theme and native scrollbar buttons are
  hidden without custom scroll behavior.

## Verification result

- `node --check` passed for every changed JavaScript application file.
- All autonomous `test/*.test.js` files passed.
- Storage tests cover default-off preference, separate JPEG hydration, invalid
  session rejection, session asset cleanup and conditional EPAM cleanup.
- `git diff --check` passed; only existing LF-to-CRLF warnings were reported.
- `npm.cmd run package` passed for Windows x64. The first sandboxed attempt was
  denied network access; the approved retry completed.
- Packaged renderer smoke passed at `127.0.0.1:9223`: storage loaded without error,
  Feedback is absent, screenshot-history setting is visible and off, and Settings
  reports no overflowing elements.
- No live provider request was made; screenshot persistence was verified with local
  storage fixtures to avoid consuming an API request.
