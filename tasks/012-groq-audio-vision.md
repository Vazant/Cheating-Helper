# 012 — Groq STT, текстовые ответы и анализ скриншотов

Статус: `IN_PROGRESS`

Hosted STT pipeline начал реализовываться в task `018`; ручной Windows/Groq smoke остаётся обязательным.

## Нормализованное требование

Вернуть обработку аудио и скриншотов без Gemini. Для Hosted/Groq режима разделить три независимые роли: Groq Whisper преобразует аудио в текст, выбранная Groq text LLM формирует ответ, Groq vision model анализирует скриншоты.

## Карта возможностей

| Роль | Предлагаемый default | Альтернатива | Ограничения |
|---|---|---|---|
| Hosted STT | `whisper-large-v3-turbo` | `whisper-large-v3` | POST file/chunk, не Gemini-подобный continuous Live socket |
| Hosted response LLM | `openai/gpt-oss-120b` | `openai/gpt-oss-20b` | Только Text → Text; не принимает аудио или изображения |
| Hosted screenshot vision | `qwen/qwen3.6-27b` | — | Text + Images → Text; Preview; консервативно до 3 изображений |
| Local STT | текущие `Xenova/whisper-*` | — | Работает локально через `src/utils/localai.js` |
| Local response/vision | выбранные Ollama models | отдельная vision model в task 009 | Не смешивать text-only и vision capabilities |

## Текущий код

- `src/utils/renderer.js:startCapture` получает system/microphone PCM 24 kHz чанками по 0.1 секунды и создаёт скриншоты.
- `src/utils/gemini.js` в Groq text mode сейчас явно отвергает audio/image IPC.
- `src/utils/localai.js` уже содержит resample 24→16 kHz, energy VAD, накопление utterance и локальный Whisper, но затем жёстко отправляет текст в Ollama. Microphone и system audio сейчас разделяют одно VAD state и при одновременной работе могут смешиваться.
- `src/utils/gemini.js:sendToGroq` выполняет hosted text response, streaming, лимиты и ротацию ключей.
- `src/utils/localai.js:sendLocalImage` обрабатывает изображения только локальным Ollama path.
- Публичный BabyDemon (`avneez/skynet`) отделяет `screenAnalysis` от text/audio режимов и отправляет в vision request отдельный prompt, но его defaults Maverick → Scout уже отключены.
- BabyDemon хранит hardcoded `MANUAL_SCREENSHOT_PROMPT` и дописывает к нему конкретный вопрос пользователя; отдельного сохраняемого `screenAnalysisPrompt` в проверенной публичной версии не найдено.

## Предлагаемый Hosted pipeline

```text
System/Microphone PCM 24 kHz
  → resample 16 kHz mono
  → VAD + накопление законченной реплики
  → WAV utterance
  → POST /openai/v1/audio/transcriptions
  → whisper-large-v3-turbo
  → transcript
  → POST /openai/v1/chat/completions
  → openai/gpt-oss-120b
  → streamed answer

Screenshot JPEG/WebP
  + editable screenAnalysisPrompt
  + optional manual user question
  → POST /openai/v1/chat/completions with image_url
  → qwen/qwen3.6-27b
  → streamed/complete visual answer
```

## Подзадачи

- [x] Проверить актуальные STT, text и vision models по официальной документации Groq.
- [x] Найти существующие capture, VAD, transcription, response и screenshot paths.
- [x] Подтвердить отдельный редактируемый `screenAnalysisPrompt`.
- [x] Подтвердить добавление последних двух текстовых реплик разговора в vision context без повторной отправки старых изображений.
- [ ] Получить подтверждение defaults и источников аудио от пользователя.
- [ ] Вынести provider-neutral resample/VAD/utterance accumulation в `speechSegmenter`; не создавать обратный импорт Groq из Local AI.
- [ ] Использовать отдельный segmenter для каждого одновременно разрешённого audio stream либо ограничить первый этап одним выбранным stream.
- [ ] Кодировать законченную PCM-реплику в WAV 16 kHz mono без новой зависимости.
- [ ] Добавить Groq transcription fetch через multipart `FormData` и `whisper-large-v3-turbo`.
- [ ] После успешного STT передавать transcript в существующий `sendToGroq`.
- [ ] Возобновить capture только для подтверждённого Groq audio mode; не отправлять 0.1-second chunks напрямую в Whisper endpoint; сериализовать utterance requests.
- [ ] Добавить отдельный hosted STT selector и не показывать text/vision models в нём.
- [ ] Добавить отдельный hosted vision selector с `qwen/qwen3.6-27b` и Preview warning.
- [ ] Добавить отдельную preference `screenAnalysisPrompt` и textarea в настройках; пустое значение нормализовать к безопасному default.
- [ ] Разделять постоянную screen instruction и разовый вопрос пользователя; не склеивать её с общим text-response prompt.
- [ ] Отправлять screenshot как image content в отдельном vision request; GPT-OSS не использовать для изображений.
- [ ] Не использовать text-only GPT-OSS как прямой vision fallback. Возможный второй этап GPT-OSS разрешён только после успешного получения текстового vision result.
- [ ] Для первого этапа выбрать manual-only либо interval screenshots; automatic screenshots также downscale и ограничить base64 request до 4 MB.
- [ ] Применить ограниченную key rotation на фактический `429` отдельно к STT, text и vision requests.
- [ ] Не повторять STT/vision после начала частичного ответа и не создавать параллельные дубликаты одной реплики.
- [ ] Логировать stage/model/key slot без audio, transcript, image base64 и API secrets.
- [ ] Покрыть WAV encoding, VAD finalization, multipart STT, pipeline routing, vision payload и bounded rotation тестами.

## Лимиты и практические ограничения

- Whisper endpoint принимает файл или URL; нативный continuous WebSocket для Whisper официально не документирован.
- Для Free tier прямой файл ограничен 25 MB; Groq рекомендует 16 kHz mono и WAV для низкой задержки.
- Минимальная учитываемая длительность — 10 секунд, поэтому отправлять каждый 0.1-second chunk невыгодно; нужен VAD/utterance batching.
- На опубликованном Free Plan для Whisper указаны 20 RPM, 2,000 RPD, 7,200 ASH и 28,800 ASD; фактические org limits проверяются в Groq Console.
- Для Qwen 3.6 опубликованы 30 RPM, 1,000 RPD, 8K TPM и 200K TPD; модель имеет статус Preview.
- Proactive ASH/ASD remaining headers официально не документированы, поэтому точное предупреждение возможно только по доступным headers/429, без выдуманного остатка аудиосекунд.

## Критерии приёмки

- В Groq mode законченная речь транскрибируется Whisper и ровно один раз отправляется выбранной text LLM.
- GPT-OSS никогда не получает raw audio или image payload.
- Скриншот обрабатывается только vision-capable моделью.
- Изменённый `screenAnalysisPrompt` сохраняется, применяется только к screenshot requests и восстанавливается после перезапуска.
- Local mode продолжает работать без Groq API.
- `429` не зацикливает запросы и не повторяет один key больше одного раза на один stage.
- Ошибки STT, LLM и Vision различаются в UI/console.
- Секреты и пользовательский audio/image content отсутствуют в логах.
- Все автоматические проверки и Electron package проходят.

## Официальные источники

- Groq Speech to Text: https://console.groq.com/docs/speech-to-text
- Whisper Large V3 Turbo: https://console.groq.com/docs/model/whisper-large-v3-turbo
- GPT-OSS 120B: https://console.groq.com/docs/model/openai/gpt-oss-120b
- Qwen 3.6 27B Vision: https://console.groq.com/docs/model/qwen/qwen3.6-27b
- Rate limits: https://console.groq.com/docs/rate-limits
- Deprecations: https://console.groq.com/docs/deprecations

## Вопросы пользователю

Подтверждено: выбранный `Speech Language` всегда передаётся Hosted STT как language hint и задаёт язык ответа text LLM. Автоматическое определение output language по тексту вопроса не используется.

1. Подтвердить default pipeline: Whisper Large V3 Turbo → GPT-OSS 120B, а для screenshot — Qwen 3.6 27B Preview.
2. Подтвердить использование существующей настройки audio source: system audio, microphone или оба.
3. Подтвердить VAD batching по завершённым репликам вместо фиксированных 10/30-секундных интервалов.
4. Подтвердить применение общей последовательности Groq keys отдельно на `429` каждого stage.
5. Подтвердить, должен ли первый этап поддерживать microphone и system audio одновременно; при ответе «да» они получат независимые segmenters.
6. Подтвердить manual-only screenshots на первом этапе либо сохранение автоматического interval capture.
7. Подтвердить отправку каждой завершённой VAD-реплики сразу; это быстрее, но короткие запросы расходуют RPM и учитываются минимум как 10 секунд.
8. Решено: отдельный редактируемый `screenAnalysisPrompt`; в screenshot request добавляются последние две текстовые реплики разговора, старые изображения не добавляются.
