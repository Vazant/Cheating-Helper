# 018 — Рабочий Hosted Groq: ключи, context, latency и voice commands

Статус: `PLANNING`

Зависимости: `011`, `012`, `013`, `016`.

## Нормализованный промпт пользователя

Привести приложение в устойчиво работающий вид для Hosted Groq:

1. Проверить и исправить автоматическую смену нескольких Groq API keys при фактическом исчерпании rate limit. Один ключ нельзя пробовать повторно в рамках одного stage/request; циклы и утечка secrets запрещены.
2. Проанализировать жизненный цикл AI Profile и `About you`: определить, когда профиль компилируется, когда физически отправляется provider и как обеспечить правильный неизменный context активной сессии.
3. Уменьшить задержку до первого токена и UI latency без ухудшения качества и без удаления обязательного context.
4. Вернуть voice commands с выбором источника: системный звук компьютера либо микрофон. Законченную речь транскрибировать и ровно один раз передавать text LLM.
5. В Hosted режиме использовать Groq Whisper STT, а не отключённый Gemini. Не отправлять raw audio в GPT-OSS.
6. Изучить исходный Cheating Daddy, использовать существующий capture flow там, где он корректен, и исправить фактические дефекты.
7. Разбить работу на проверяемые этапы, назначить постоянные роли агентов и не устанавливать лишние dependencies/skills.

## Текущее состояние и доказательства

### Несколько Groq keys

- Text: `src/utils/gemini.js:271-405` проходит ordered snapshot ключей; `getNextGroqKeyIndex()` разрешает смену только на `429` и без wrap-around.
- Vision: `src/utils/gemini.js:478-535` также посещает каждый ключ максимум один раз.
- `401/403/413/5xx/network` ключ не меняют.
- `activateGroqApiKey()` вызывается **до** успешного ответа нового ключа (`gemini.js:360`, Vision около `530`). Неуспешный следующий ключ может ошибочно остаться active.
- Helper tests не проверяют реальный fetch order, persistence и concurrency.
- Groq limits применяются на уровне organization; project limit не может превышать organization ceiling. Поэтому несколько ключей одной quota scope обычно получают одинаковый `429`.

### Profile context

- На `Start` main process разрешает profile snapshot и один раз компилирует `currentSystemPrompt` (`gemini.js:1042-1050`). Network request на Start отсутствует.
- Chat Completions stateless. Поэтому system prompt правильно включается в `messages[0]` каждого HTTP request (`gemini.js:310-325`). Отправить его только один раз с текущим API нельзя: последующие запросы потеряют инструкции.
- Active context уже фактически frozen-at-start, но runtime повторно читает preferences/profile catalog для получения model на каждом вопросе.
- Groq автоматически применяет prompt caching к одинаковому prefix для GPT-OSS; специальный SDK или ручное server cache не нужны.

### Latency

- Streaming уже включён.
- Current request резервирует `4 096` completion tokens и может сам создать TPM failure.
- `sendToGroq()` синхронно читает preferences и весь profile catalog на каждом вопросе.
- История ограничена двадцатью сообщениями, но настройки профиля `conversationContextEnabled/count` не применяются.
- Каждый SSE chunk повторно обрабатывает и пересылает в UI весь накопленный ответ, вызывая лишний O(n²)-подобный client work.
- Нет блокировки/очереди одновременных text/audio requests; ответы и shared history могут перемешаться.

### Audio

- UI уже хранит `speaker_only | mic_only | both` (`CustomizeView.js:665-684`).
- Hosted Groq вызывает `startCapture(..., false)` и полностью отключает audio (`CheatingDaddyApp.js:632-634`).
- Main IPC явно возвращает `Audio is unavailable in Groq text mode` (`gemini.js:1064-1114`).
- Windows system audio использует `getDisplayMedia` + loopback; microphone использует `getUserMedia` (`renderer.js:234-490`).
- При включённом audio Windows всегда открывает loopback независимо от `audioMode`; поэтому `mic_only` фактически захватывает оба источника.
- Оба IPC канала Local направляет в один global VAD/resampler state; simultaneous streams смешиваются.
- Mic stream и его AudioContext не сохраняются для полного cleanup.
- Upstream Cheating Daddy отправлял PCM в Gemini Live, получал transcription и только затем вызывал Groq text model. Groq Whisper endpoint в upstream не реализован.
- Local уже имеет полезные части 24→16 kHz resample и energy VAD, но они связаны с Local/Ollama и имеют shared-state/ordering defects.

## Карта ролей моделей

| Stage | Default | Input → output | Примечание |
|---|---|---|---|
| Hosted STT | `whisper-large-v3-turbo` | Audio file → text | Multilingual, быстрый; multipart file request |
| Hosted answer | `openai/gpt-oss-120b` | Text → streamed text | `reasoning_effort: low`; raw audio запрещён |
| Hosted answer fallback | `openai/gpt-oss-20b` | Text → streamed text | Только существующая model fallback policy |
| Local STT | выбранный Xenova Whisper | PCM → text | Отдельный Local stage |
| Local answer | выбранная Ollama model | Text → text | Groq keys не используются |

## Целевая архитектура

```text
Start
  → resolve profile snapshot
  → compile/validate system prompt once
  → freeze session {profile, model, behavior, speechLanguage, systemPrompt}
  → start exactly one selected audio source

System loopback OR microphone PCM 24 kHz
  → source-scoped resampler + VAD + pre-roll
  → finalized utterance, serialized queue
  → WAV PCM16 mono 16 kHz
  → Groq /audio/transcriptions (Whisper Turbo)
  → non-empty transcript
  → token-budgeted Groq Chat Completions
  → system prompt + allowed history + current transcript
  → streamed answer
```

Context policy:

- Profile компилируется один раз при Start и не меняется до следующей session.
- В каждый stateless Groq request отправляется тот же exact system prefix.
- User Context/`About you` является частью system prompt, а не отдельным повторным user message.
- История добавляется только по настройке profile behavior и ограничивается estimated-token budget.
- Profile/model edits во время session применяются только после нового Start.
- `Speech Language` фиксируется при Start, передаётся Whisper как language hint и компилируется в system prompt как единственный output language.
- Язык отдельного typed/transcribed вопроса не анализируется и не меняет язык ответа.
- UI показывает фактически активный profile snapshot согласно task `016`.

Latency policy:

- Оставить streaming и `reasoning_effort: low`.
- Использовать подтверждённый ранее максимум `2 048` completion tokens с динамическим уменьшением по TPM budget; это заменяет неподтверждённое предложение `2 560` из task `016`.
- Не читать весь profile catalog на каждом запросе; использовать frozen session snapshot.
- Не добавлять timestamps/request IDs внутрь system prefix, чтобы не разрушать automatic prompt cache.
- Throttle UI updates примерно до одного раза в `40 ms`, обязательно flush final text.
- Сериализовать voice utterances; concurrent manual request либо ставить в ту же очередь, либо явно отклонять как busy.
- Логировать только durations/stage/model/key slot; prompt, transcript, audio и key запрещены.

## План реализации после ответов пользователя

### A — Groq keys и request budget

1. `TODO` Ввести общий bounded attempt policy для Text/Vision/STT: каждый stable key ID максимум один раз, без wrap-around.
2. `TODO` Не сохранять rotated key active до успешного response; при полном failure оставить исходный active.
3. `TODO` Защитить active update от concurrent requests.
4. `TODO` Добавить явную ошибку `413` без key/model rotation.
5. `TODO` Реализовать общий estimated-token request budget, completion до `2 048` и history trim полными парами.
6. `TODO` Добавить integration-style mocked-fetch tests для order, persistence, all-429 и non-rotating statuses.

### B — Session context и latency

7. `TODO` Создать frozen `currentGroqSession` на Start: profile ID/name, compiled prompt, model, behavior и `Speech Language`.
8. `TODO` Добавить чистый `buildGroqMessages()`; system message обязателен во всех requests.
9. `TODO` Применить `conversationContextEnabled/count` и hard token budget.
10. `TODO` Удалить per-request чтение полного profile catalog.
11. `TODO` Добавить безопасные latency timestamps и throttled streaming UI updates.
12. `TODO` Защитить shared history/response UI от concurrent sends.

### C — Hosted voice commands

13. `TODO` Исправить routing источника: system открывает только loopback, microphone — только `getUserMedia`.
14. `TODO` Сохранять и полностью закрывать все tracks/processors/AudioContexts при Stop/restart/error.
15. `TODO` Вынести provider-neutral source-scoped segmenter: resample, VAD, pre-roll, min/max duration, flush/reset.
16. `TODO` Добавить stdlib WAV encoder PCM16 mono 16 kHz без новой зависимости.
17. `TODO` Добавить Groq multipart STT через `fetch`; передавать ISO-639-1 из выбранного `Speech Language`; `Content-Type` для FormData вручную не задавать.
18. `TODO` После одного non-empty transcript вызвать existing text pipeline ровно один раз.
19. `TODO` Добавить bounded key rotation для STT, stage-specific status/error и utterance ID.
20. `TODO` Добавить Audio Source и Hosted STT model settings только в совместимые группы.

### D — Проверка и выпуск

21. `TODO` Dependency-free unit tests: source routing, PCM/resample, VAD, WAV, multipart, queue, key rotation, prompt lifecycle и принудительный configured language.
22. `TODO` Windows smoke: system-only, mic-only, Stop/restart, permission denied, English/Russian, две быстрые реплики.
23. `TODO` Live Groq smoke: typed HashMap, system-audio HashMap, microphone HashMap, forced/mock 429 rotation.
24. `TODO` `node --check`, все tests, `npm run make`, hash нового installer.

## Критерии приёмки

- Один request/stage не пробует один ключ больше одного раза и не зацикливается.
- Rotated key становится active только после успешного ответа.
- `413/401/403/5xx/network` не меняют ключ.
- Start не делает Groq request; каждый фактический question request содержит один идентичный system prompt.
- Profile edits не меняют active context посреди session.
- Ответ и Whisper STT всегда используют frozen `Speech Language`; язык вопроса не переопределяет настройку.
- Prompt/history/request укладываются в безопасный TPM budget.
- System mode не открывает mic; microphone mode не открывает loopback.
- Одна законченная реплика создаёт максимум один STT и один LLM request.
- GPT-OSS никогда не получает PCM/WAV.
- Stop выключает Windows microphone indicator и все tracks; restart не удваивает transcripts.
- Ответы продолжают stream-иться, финальный текст не теряется и не перемешивается.
- В логах нет API keys, prompt, transcript или audio content.

## Нужны решения пользователя

1. Первый релиз: оставить только взаимоисключающие `System audio` и `Microphone`, а небезопасный `Both` временно скрыть? Рекомендация: да; default `System audio`.
2. Решено: всегда использовать выбранный `Speech Language` и для Whisper language hint, и для языка ответа; auto-detect отсутствует.
3. После VAD автоматически отправлять каждую законченную реплику как вопрос без hotkey? Рекомендация: да, это соответствует описанному video/interview flow.
4. Максимум сохранённых Groq keys: ограничить пятью, чтобы один `429` не создавал неограниченную серию requests? Рекомендация: да.
5. Если пользователь вводит manual text во время обработки voice utterance: поставить его в общую очередь или вернуть `Busy`? Рекомендация: manual text получает приоритет, voice ждёт в очереди.

## Официальные источники

- Groq Speech to Text: https://console.groq.com/docs/speech-to-text
- Groq Whisper Turbo: https://console.groq.com/docs/model/whisper-large-v3-turbo
- Groq Rate Limits: https://console.groq.com/docs/rate-limits
- Groq Projects: https://console.groq.com/docs/projects
- Groq Prompt Caching: https://console.groq.com/docs/prompt-caching
