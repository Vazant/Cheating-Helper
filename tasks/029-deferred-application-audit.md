# 029 — Полный аудит приложения и отложенный backlog

Статус: `TODO — FUTURE`

Дата фиксации: 2026-07-24.

## Назначение

Этот файл сохраняет результаты полного аудита Cheating Helper, которые не входят в текущий Groq-first этап. Он нужен как долговременный backlog и источник доказательств, чтобы будущая работа не начиналась с повторного исследования.

Активный план качества hosted-моделей находится в `tasks/027-groq-quality-context-and-token-plan.md`.

## Решение пользователя

1. В ближайшем этапе улучшать работу с бесплатными online-моделями Groq.
2. Локальные LLM пока не развивать: на RTX 3080 Laptop 8 GB они ожидаемо проигрывают hosted Groq по качеству и скорости для основной задачи.
3. `llama.cpp`, `whisper.cpp`, native runtime и полный upstream `v0.8.0` отложить.
4. Не смешивать отложенные архитектурные изменения с Groq quality work.

## Зафиксированный snapshot

1. Рабочая ветка на момент аудита: `codex/groq-quality-context`.
2. HEAD: `bce8112`.
3. Рабочее дерево было чистым и синхронизированным с `origin/codex/groq-quality-context`.
4. `origin/master`: `998a056`, версия `0.7.0`.
5. `upstream/master`: `3cccc36`, tag `v0.8.0`.
6. `node --test "test/*.test.js"`: 37/37 passed.
7. GPU: NVIDIA GeForce RTX 3080 Laptop GPU, 8192 MiB VRAM.
8. Репозиторий `Vazant/Cheating-Helper` публичный.

## Что уже работает хорошо

1. Groq context planner сохраняет полные `user/assistant` пары и не удаляет текущий user turn.
2. По умолчанию модель получает последние 6 полных пар внутри активной сессии.
3. Session snapshot фиксирует profile, compiled prompt, model, behavior и language на Start.
4. Stop/Restart ownership для hosted text/STT/vision покрыт автоматическими проверками.
5. Partial и truncated responses больше не маскируются под обычный завершённый ответ.
6. GPT-OSS fallback ограничен семейством 120B/20B.
7. Qwen не является скрытым text fallback.
8. Несколько Groq keys активируются детерминированно и без бесконечной ротации.
9. Session metrics не должны содержать вопрос, ответ или transcript.
10. Vision и STT отделены от text model по capability.

## Карта фактических pipeline

### Hosted audio

`renderer capture → PCM16 → hosted VAD/segmenter → WAV 16 kHz mono → Groq Whisper Turbo → transcript → text queue → Groq text model → streaming UI → History`

Основные файлы:

- `src/utils/renderer.js`
- `src/utils/audioPipeline.js`
- `src/utils/gemini.js`
- `src/utils/groq.js`
- `src/storage.js`

### Local audio

`renderer capture → local VAD → Transformers.js Whisper → Ollama → UI`

Основной файл:

- `src/utils/localai.js`

### Vision

`screenshot → resize/JPEG → vision prompt + последние text turns → Groq Qwen Vision или local vision → UI`

Основные файлы:

- `src/utils/renderer.js`
- `src/utils/vision.js`
- `src/utils/gemini.js`
- `src/utils/localai.js`

## Подтверждённые проблемы вне текущего scope

### P0 — Electron trust boundary

Evidence:

- `src/utils/window.js`: `nodeIntegration: true`.
- `src/utils/window.js`: `contextIsolation: false`.

Риск:

- Успешная renderer injection получает полномочия Node/Electron процесса.

Будущее решение:

1. Перенести privileged операции в preload API.
2. Включить context isolation.
3. Убрать прямой `require` из renderer.
4. Валидировать каждый IPC payload.

Это отдельная крупная миграция, а не побочное изменение Groq prompt.

### P0 — Storage/IPC validation

Evidence:

- `src/index.js`: credentials/preferences IPC принимает renderer objects без полной схемы.
- `src/storage.js`: history path строится с переданным `sessionId`.
- `src/index.js`: `open-external` не ограничивает URL scheme.
- `src/storage.js`: `writeJsonFile` может вернуть `false`, но вызывающий IPC не всегда отражает ошибку.

Будущее решение:

1. Allowlist для session ID.
2. Проверка, что resolved history path остаётся внутри sessions directory.
3. Allowlist `https:`/`http:` для внешних URL.
4. Общие schemas для IPC.
5. Ошибка записи должна доходить до UI.

### P0 — Privacy

Evidence:

- В built-in profile были зафиксированы персональные сведения.
- Local runtime логирует transcript и начало prompt.
- Credentials сохраняются обычным JSON.
- Репозиторий публичный.

Будущее решение:

1. Удалить персональные данные из исходников и проверить Git history.
2. Удалить content logs.
3. Рассмотреть Electron `safeStorage` с миграцией существующих ключей.
4. Не сохранять разговоры в telemetry.

### P1 — Local audio correctness

Evidence в `src/utils/localai.js`:

1. Local VAD не имеет pre-roll и способен потерять начало фразы.
2. Нет максимальной длины utterance.
3. Нет ограниченной FIFO и единого abort/session ownership.
4. Один Whisper pipeline кэшируется без гарантированного reload после смены модели.
5. In-flight local result может завершиться после Stop/New Start.
6. Whisper pipeline намеренно остаётся загруженным и удерживает RAM/VRAM.

Будущее решение:

1. Использовать общий проверенный segmenter contract.
2. Добавить pre-roll, hard limit, queue depth/age и abort.
3. Привязать каждый result к session ID.
4. Явно управлять жизненным циклом модели.

### P1 — Hosted audio queue и длинная речь

Evidence:

- `src/utils/audioPipeline.js`: static RMS, 800 ms silence и 30 s hard limit.
- `src/utils/gemini.js`: hosted FIFO включает STT и полный LLM response.

Риски:

1. Новые вопросы стареют, пока генерируется предыдущий ответ.
2. 30-секундная речь режется без overlap/dedup.
3. Очередь не имеет явного ограничения и backpressure UX.

Эта часть может вернуться в active Groq scope, только если live A5–A7 подтвердят проблему.

### P1 — Источник и intent

Evidence:

- Renderer выбирает `speaker_only` либо `mic_only`.
- Каждый успешный transcript немедленно запускает text LLM.
- Нет source-aware question/statement/background classification.

Будущее рекомендуемое поведение:

1. System audio и microphone имеют независимые segmenter state.
2. System audio по умолчанию инициирует ответ.
3. Речь пользователя попадает в context, но не инициирует ответ без явного question/manual action.
4. Неоднозначный transcript показывается для подтверждения.
5. Не использовать дополнительный LLM-call для каждого intent по умолчанию.

### P1 — Persistence

Evidence:

- Полный history JSON переписывается после каждого изменения.
- History View и runtime context являются разными источниками.
- Новый Start не загружает старую историю в context.

Будущее решение:

1. Append-only events или атомарная incremental persistence.
2. Явный `Continue session`, если межсессионная память будет одобрена.
3. Summary только opt-in.
4. Не добавлять vector database для обычных последних turns.

### P2 — Capture correctness

1. Renderer запрашивает 24 kHz, но требуется фиксировать фактический runtime sample rate.
2. `ScriptProcessorNode` выполняет обработку на renderer thread.
3. Cleanup не везде ожидает закрытия AudioContext.
4. macOS stereo-to-mono выбрасывает правый канал вместо усреднения.
5. Windows автоматически выбирает первый display source.
6. Нет полноценного выбора монитора и аудиоустройства.

### P2 — Vision context asymmetry

1. Vision request получает последние text turns.
2. Vision result не добавляется в обычную text history.
3. Следующий text follow-up не обязан помнить вывод из screenshot.

Будущее решение:

- Добавлять краткий vision result в text context только явно или через opt-in настройку.

### P2 — Модульность

Snapshot размеров:

- `src/utils/gemini.js`: около 1742 строк.
- `src/utils/renderer.js`: около 1212 строк.
- `src/storage.js`: около 773 строк.

Будущее минимальное разделение:

1. Session/request ownership.
2. Hosted STT pipeline.
3. Hosted text streaming.
4. Vision routing.
5. Без универсального provider framework и без миграции UI.

## Upstream v0.8.0

### Полезные идеи

1. Native processes изолированы от renderer.
2. Бинарники и модели проверяются checksum.
3. Используются localhost server processes и случайные порты.
4. Есть progress/cancel для загрузки.
5. Не требуется отдельно установленный Ollama daemon.

### Почему нельзя переносить целиком

1. Только `.en` Whisper models и `language=en`.
2. Vision projector обязателен даже для text-only local mode.
3. Windows CUDA/offload не доказан.
4. Сохранены старые VAD и async race.
5. Отсутствует новый Groq request/context contract нашей ветки.
6. Возможны небезопасные cache cleanup и port allocation race.
7. Полный merge конфликтует с более новой Groq-only архитектурой.

Решение:

- Не merge.
- В будущем заимствовать отдельные идеи только через новый подтверждённый план и benchmark.

## `llama.cpp` и `whisper.cpp`

### `llama.cpp`

1. Не является улучшением hosted Groq по качеству.
2. На 8 GB VRAM реалистичны меньшие квантованные модели, а не GPT-OSS 120B.
3. Ollama уже использует llama.cpp-compatible inference backend.
4. Ценность: offline, privacy и отсутствие API-зависимости.
5. Статус: отложено.

### `whisper.cpp`

1. CUDA build потенциально быстрее текущего Transformers.js local STT.
2. Движок сам по себе не повышает accuracy при той же модели.
3. Качество определяется checkpoint, language, quantization, VAD и audio capture.
4. Upstream English-only конфигурация непригодна для RU/PL.
5. Статус: будущий опциональный pilot после появления общего audio benchmark.

## Отложенный ordered backlog

### D1 — Security containment

Статус: `TODO — FUTURE`

Scope:

1. IPC/session/url validation.
2. Content-log removal.
3. Storage write errors.
4. Personal-data cleanup.

Acceptance:

1. Path traversal и опасные URL отклоняются.
2. В логах нет transcript/prompt/API key.
3. Ошибка записи видна UI.

### D2 — Context isolation migration

Статус: `TODO — FUTURE`

Dependency:

- D1.

Acceptance:

1. `nodeIntegration: false`.
2. `contextIsolation: true`.
3. Renderer использует только ограниченный preload API.
4. Основные capture/history/settings сценарии проходят packaged smoke.

### D3 — Source-aware dual audio

Статус: `TODO — FUTURE`

Acceptance:

1. Mic/system сегментируются независимо.
2. Источник сохраняется в turn metadata.
3. Фраза пользователя не принимается за вопрос интервьюера.
4. Нет смешанного VAD state.

### D4 — Persistence hardening

Статус: `TODO — FUTURE`

Acceptance:

1. Длинная сессия не приводит к квадратичному объёму записи.
2. Частичная запись не повреждает последнюю успешную историю.
3. Продолжение старой сессии отсутствует до отдельного opt-in решения.

### D5 — Optional native STT pilot

Статус: `TODO — FUTURE`

Dependencies:

- Общий audio benchmark.
- Multilingual requirement.
- Подтверждённая Windows CUDA build.

Acceptance:

1. WER не хуже текущего STT больше чем на 0.5 процентного пункта.
2. Critical-term accuracy не ухудшается.
3. p95 latency улучшается минимум на 15% или peak memory снижается минимум на 20%.
4. Model directory может находиться на диске `D:`.

### D6 — Optional local LLM mode

Статус: `TODO — FUTURE`

Trigger:

- Явный новый приоритет offline/privacy.

Не является заменой Groq default.

## Триггеры возврата к backlog

К этой задаче следует вернуться, если:

1. Пользователь явно меняет приоритет с Groq на local/offline.
2. Появляется требование распространять приложение шире текущего доверенного окружения.
3. Live Groq baseline подтверждает, что latency формируется в capture/STT/queue, а не в text model.
4. Появляется необходимость одновременно понимать interviewer и user audio.
5. Требуется продолжать разговор после нового Start.
6. Текущий history/storage начинает влиять на стабильность длинных сессий.

## Не делать без нового подтверждения

1. Не вливать upstream `v0.8.0` целиком.
2. Не заменять Groq локальной моделью.
3. Не добавлять native binaries и автоматические model downloads.
4. Не добавлять межсессионную память, RAG или vector database.
5. Не запускать миграцию React/TypeScript/Shadcn.
6. Не создавать универсальный provider abstraction.
