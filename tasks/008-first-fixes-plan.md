# 008 — План первых исправлений моделей и квот

Статус: `DONE` (Hosted Text этап выполнен и проверен)

## Требуемые блоки плана

- [x] Карта текущего назначения Gemini, Gemma, Groq, Ollama и Whisper.
- [x] Схема настроек выбора моделей по функциям.
- [x] Замена отключённого `qwen/qwen3-32b` спроектирована, но default требует подтверждения.
- [x] Актуальные варианты бесплатных Groq-моделей и fallback-вопросы записаны.
- [x] Чтение и хранение снимка RPD/TPM headers спроектировано.
- [x] Консольное предупреждение на 95% каждого лимита спроектировано.
- [x] Корректная обработка 404/429 и streaming chunks включена в план.
- [x] Минимальные автоматические проверки без тяжёлого test framework определены.
- [x] Порядок маленьких, независимо проверяемых изменений определён.

## Критерии приёмки

- Для каждого изменения названы файлы, подзадачи, проверка и условие `DONE`.
- План не смешивает transcription/audio, text-generation и vision модели.
- План представлен пользователю и подтверждён до реализации.

## Карта фактических функций

| Функция | Текущая модель/система | Где используется | Нужен selector |
|---|---|---|---|
| Hosted live audio + transcription | `gemini-3.1-flash-live-preview` | `src/utils/gemini.js:initializeGeminiSession` | Да, только live-audio capable модели; транскрипция пока часть Live-сессии |
| Hosted text response | Groq: Qwen 3 32B → GPT-OSS 120B → 20B → Kimi | `sendToGroq` + `storage.getModelForToday` | Да: Groq text models |
| Hosted text без Groq key | `gemma-4-26b-a4b-it` | `sendToGemma` | Решить, оставлять ли selectable Google fallback |
| Hosted screen/vision | Gemini 2.5 Flash/Flash Lite | `sendImageToGeminiHttp` | Да, только vision capable модели |
| Local transcription | `Xenova/whisper-small` | `localai.loadWhisperPipeline/transcribeAudio` | Уже отдельная роль; сохранить/улучшить позже |
| Local text | выбранная Ollama model | `localai.sendToOllama` | Уже есть, переименовать по роли |
| Local vision | та же Ollama model без проверки | `localai.sendLocalImage` | Нужна отдельная модель либо явное отключение |
| Cloud | удалённый сервис | `src/utils/cloud.js` | Модель локально не контролируется |

`qwen/qwen3-32b` не распознаёт речь и не анализирует экран в этом приложении: он используется только для hosted text response после транскрипции и ручного текста.

## Минимальная схема preferences

- `hostedTextModel`: provider-qualified text model.
- `hostedVisionModel`: только подтверждённая vision model.
- `hostedLiveAudioModel`: только live-audio model; hosted transcription описывается как часть этой роли.
- Сохранить `ollamaModel` и `whisperModel` для совместимости.
- Добавить `ollamaVisionModel`, если пользователь подтверждает отдельную local vision модель.
- Fallback-порядок не хранить до явного решения пользователя.

Один capability catalog валидирует model IDs в main process. UI фильтрует options по роли, но renderer не считается доверенным источником.

## План первых исправлений

### 008.1 — Каталог моделей и миграция preferences

Статус: `DONE`

- [x] Утвердить defaults и доступные options.
- [x] Добавить компактный Groq model catalog без нового SDK/зависимости.
- [x] Добавить `hostedTextModel` с совместимостью старых preferences.
- [x] Валидировать неизвестные/устаревшие IDs и писать понятный warning.
- [x] Обновить Reset Settings.

Проверка: dependency-free `node -e` для допустимых/недопустимых capability-model сочетаний и smoke persistence с временной конфигурацией.

### 008.2 — Hosted model selectors

Статус: `DONE` (Hosted Text; Vision/Live Audio вынесены в следующие задачи)

- [x] Добавить в текущий Lit `CustomizeView` секцию AI Models для активного Hosted-режима.
- [x] Добавить Hosted Text selector с тремя подтверждёнными моделями.
- [x] Оставить Vision/Live Audio неизменными и не показывать фиктивный Hosted Transcription selector.
- [x] Читать валидированный выбор непосредственно перед каждым Groq request.
- [x] Явно сообщать об отсутствующем Groq key без скрытого Google fallback.

Проверка: смена каждого selector, restart, persistence, запуск и подтверждение фактической model ID в console/network log.

### 008.3 — Замена отключённого Groq Qwen 3 32B

Статус: `DONE`

- [x] Удалить `getModelForToday()` и весь Groq char-based quota path.
- [x] Удалить отключённые Qwen 3 32B и Kimi из `src`.
- [x] Использовать выбранную `hostedTextModel`.
- [x] Добавить `openai/gpt-oss-120b`, `openai/gpt-oss-20b` и `qwen/qwen3.6-27b`.
- [x] Реализовать подтверждённый bounded fallback с structured logging.

Проверка: каждый разрешённый text ID попадает в Groq request; retired/vision/audio ID отвергается до сети.

### 008.4 — Реальные Groq RPD/TPM и 95% warnings

Статус: `DONE`

- [x] Считать `limit/remaining requests` как RPD и `limit/remaining tokens` как TPM из headers.
- [x] Вычислять `usedRatio=(limit-clamp(remaining))/limit` отдельно для каждой метрики.
- [x] Предупреждать при `usedRatio >= 0.95`; 94.99% не предупреждает.
- [x] Добавлять reset duration в сообщение, когда header валиден.
- [x] Обрабатывать headers и на non-2xx до чтения error body.
- [x] Missing/NaN/negative/zero значения пропускать без падения и без char estimate.
- [x] Добавить session-level anti-spam с re-arm после возврата ниже порога.

Проверка: pure-function проверки 94.99%, 95%, 100%, missing, malformed, remaining>limit и reset/re-arm.

### 008.5 — Ошибки и streaming

Статус: `DONE`

- [x] Буферизовать незавершённую SSE-строку между network chunks.
- [x] 404: показать model unavailable/inaccessible и пройти оставшихся кандидатов без повторов.
- [x] 401/403: показать проблему ключа/permission; не выполнять model fallback.
- [x] 429: показать retry/reset/quota details; разрешить максимум одну fallback-попытку.
- [x] 5xx/network отделить от model fallback.
- [x] Не выполнять fallback после начала stream; пустой/повреждённый stream считать protocol error.

Проверка: разрезанные SSE events, несколько events в chunk, `[DONE]`, malformed event, 401/403/404/429/5xx.

### 008.6 — Local model roles

Статус: `DONE` (перенесено в задачу 009 без реализации в этом этапе)

- [ ] Решить, нужна ли отдельная `ollamaVisionModel`.
- [ ] Не отправлять image text-only Ollama model без проверки capability.
- [ ] Сохранить Whisper как отдельную transcription роль; Groq Whisper — второй этап.

## Общие проверки этапа

- `node --check` для всех изменённых JS-файлов.
- `npx prettier --check` только изменённых файлов.
- Dependency-free проверки каталога, rate-limit расчёта и SSE parser.
- `npm start` smoke: persistence selectors, live transcription, text response и screenshot analysis.
- Не использовать `npm run lint` как доказательство: сейчас это заглушка.

## Фактический результат проверки

- `node --check` всех изменённых JS-файлов: PASS.
- `node test/groq.test.js`: `Groq helpers: OK`.
- Module load smoke для `storage` и `groq`: PASS.
- `git diff --check`: PASS (только уведомления LF→CRLF рабочей среды).
- `npm.cmd ci`: PASS, 579 packages; npm сообщил о 46 уязвимостях существующего dependency tree.
- `npm.cmd run package`: PASS, Electron package для win32/x64 создан.
- Два read-only code review: первый нашёл 1 blocker и 3 замечания; после исправлений повторный review — no blockers/no actionable findings.

## Вопросы, блокирующие код

Закрыты 2026-07-18:

1. Default — `openai/gpt-oss-120b`; 20B и Qwen 3.6 доступны в selector.
2. Google Gemma не показывается в первом Groq-selector и не используется как скрытый fallback.
3. Группы настроек показываются только для активного режима.
4. Первый этап — Hosted Text + limits/fallback/errors/SSE.
5. При отсутствии Groq key показывается явное предупреждение; скрытого переключения провайдера нет.
6. Local/Hosted Vision вынесены в задачу 009.

## Подтверждённый fallback

- Primary — сохранённый выбор пользователя.
- Затем оставшиеся Groq-модели без повторов в порядке `120B → 20B → Qwen 3.6`.
- 404: можно последовательно проверить оставшиеся кандидаты до начала выдачи текста.
- 429: максимум одна fallback-попытка.
- 401/403, 5xx и network: без model fallback.
- Каждая попытка пишет structured console log без API key, prompt и содержимого ответа.
