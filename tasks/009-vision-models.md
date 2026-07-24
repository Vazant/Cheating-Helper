# 009 — Hosted и Local Vision

Статус: `IN_PROGRESS`

Подтверждено пользователем 2026-07-18: Groq Qwen 3.6 — default, Ollama Qwen3-VL 4B — явная локальная альтернатива, direct pipeline без скрытого fallback; загрузка необходимых локальных файлов разрешена.

## Нормализованное требование

Вернуть анализ скриншотов без Gemini и дать явный выбор между hosted Groq Vision и локальной Ollama Vision. Текстовые модели нельзя показывать как vision-модели. Переход между hosted и local не должен происходить скрыто.

## Проверенные факты на 2026-07-18

- `meta-llama/llama-4-scout-17b-16e-instruct` в Groq выведена из эксплуатации 2026-07-17 и не подходит для новой реализации.
- Текущая подтверждённая Groq-модель с image input для обычного Free Plan — `qwen/qwen3.6-27b` (Preview).
- `openai/gpt-oss-120b` принимает только текст. Название «GPT-OSS 120B OCR» может означать только двухэтапный pipeline: vision/OCR-модель извлекает данные, затем GPT-OSS рассуждает по текстовому результату.
- Enterprise-only `qwen/qwen3-vl-32b-instruct` не показывать пользователям без подтверждённого доступа аккаунта.
- На машине обнаружена NVIDIA RTX 3080 Laptop с 8 ГБ VRAM и Ollama `0.30.10`.
- В Ollama сейчас установлены `qwen3:4b` и `qwen3:8b`. Их capabilities: `completion`, `tools`, `thinking`; `vision` отсутствует. Они не могут быть использованы для скриншотов.

## Capability matrix

| Роль                  | Модель                        | Изображение | Рекомендация                                                    |
| --------------------- | ----------------------------- | ----------: | --------------------------------------------------------------- |
| Hosted direct vision  | Groq `qwen/qwen3.6-27b`       |          Да | Hosted-вариант; Preview, зависит от API-квоты                   |
| Hosted text reasoning | Groq `openai/gpt-oss-120b`    |         Нет | Только второй этап после vision extraction                      |
| Local balanced vision | Ollama `qwen3-vl:4b`          |          Да | Рекомендуемый local default; около 3.3 ГБ                       |
| Local quality vision  | Ollama `qwen3-vl:8b`          |          Да | Вероятно качественнее, около 6.1 ГБ; меньше запаса VRAM         |
| Local fast vision     | Ollama `qwen3-vl:2b`          |          Да | Быстрее, около 1.9 ГБ; слабее для мелкого текста и сложных сцен |
| Local OCR-oriented    | Ollama `minicpm-v:8b`         |          Да | Отдельный кандидат для OCR-теста; около 5.5 ГБ                  |
| Local comparison      | Ollama `gemma3:4b`            |          Да | Запасной кандидат для A/B benchmark                             |
| Installed local text  | Ollama `qwen3:4b`, `qwen3:8b` |         Нет | Не показывать в Vision selector                                 |

Точные скорость и качество на этом ноутбуке нельзя вывести из размера модели: нужен одинаковый локальный benchmark. Для 8 ГБ VRAM сначала тестировать `qwen3-vl:4b`; контекст начать с 4–8K и не держать одновременно загруженными конкурирующие модели.

## Предлагаемые настройки

- `visionProvider`: `disabled | groq | ollama`.
- `groqVisionModel`: отдельно сохранённый hosted model; на первом этапе только `qwen/qwen3.6-27b`.
- `ollamaVisionModel`: отдельно сохранённая локальная модель, выбранная только из моделей с `/api/show.capabilities` содержащим `vision`.
- `visionPipeline`: `direct | extract-then-response`.
- `screenAnalysisPrompt`: отдельное редактируемое поле с безопасным default и Reset.
- `visionIncludeConversation`: добавлять последние две текстовые реплики; старые изображения повторно не отправлять.

Рекомендуемый первый вариант — `direct`: выбранная vision-модель сразу отвечает по изображению. `extract-then-response` оставить явной дополнительной настройкой: первая vision-модель возвращает структурированные факты экрана, а выбранная text LLM (например GPT-OSS 120B) строит финальный ответ. Это два запроса, больше задержка и расход квоты, а результат extraction может потерять расположение элементов.

## Правила маршрутизации

- Никакого скрытого Groq ↔ Ollama fallback: это меняет приватность, скорость и потребление ресурсов.
- Ротация Groq API keys при фактическом `429` разрешена внутри того же provider/model и не является сменой vision-модели.
- Ошибка первого этапа двухэтапного pipeline останавливает запрос; нельзя передавать GPT-OSS пустые или старые данные.
- GPT-OSS никогда не получает raw image.
- Local Vision перепроверяется через `/api/show` перед запросом; имя модели само по себе не доказывает capability.
- Скриншот и распознанный текст считать недоверенными данными; инструкции внутри изображения не могут заменять системный prompt.

## Мелкие работы

- [x] Проверить актуальные Groq vision-модели и retirement Scout.
- [x] Проверить, может ли GPT-OSS 120B принимать изображения.
- [x] Проверить GPU, Ollama version и capabilities установленных моделей.
- [x] Составить shortlist локальных моделей под 8 ГБ VRAM.
- [x] Получить подтверждение продукта по вопросам ниже.
- [x] Загрузить и проверить `qwen3-vl:4b`.
- [ ] Подготовить небольшой benchmark: UI со мелким текстом, код/ошибка, документ, диаграмма; одинаковый prompt и разрешение.
- [ ] Зафиксировать latency, корректность OCR, понимание layout и качество ответа для hosted и local вариантов.
- [x] Добавить отдельные provider/model/context/prompt preferences и валидацию в storage; `pipeline` не добавлять, пока поддерживается только direct.
- [x] Получать `/api/tags`, затем фильтровать модели по `/api/show.capabilities.includes('vision')`.
- [x] Добавить UI `Off / Groq / Ollama`, статус Ollama и кнопку Refresh.
- [x] Заменить hardcoded screenshot prompt единым main-process request builder.
- [x] Добавить точный dispatcher без cross-provider fallback.
- [x] Добавить direct Groq и direct Ollama adapters.
- [x] Не добавлять двухэтапный extraction → response pipeline без отдельного подтверждения.
- [x] Записывать в history фактические provider, vision model и `pipeline: direct`.
- [x] Покрыть storage, capability detection, routing, prompt/context и failure paths минимальными тестами.

## Критерии приёмки

- Ни одна text-only модель не получает image payload и не появляется в Vision selector.
- Выбранный provider/model используется точно; ошибка не вызывает скрытый переход к другому provider.
- Local selector показывает только реально установленные модели с capability `vision`.
- Отдельный screenshot prompt сохраняется и применяется только к анализу скриншотов.
- В контекст попадают максимум последние две текстовые реплики и не попадают прежние изображения.
- Direct и двухэтапный режимы различимы в UI и логах.
- Секреты, base64 изображения и содержимое скриншота не пишутся в console logs.
- Automated checks и ручные smoke tests Groq/Ollama проходят независимо.

## Проверки

1. `node --check` для изменённых JavaScript-файлов.
2. Unit tests: catalog rejection GPT-OSS, Ollama capability fixtures, exact routing, no fallback, prompt/context boundaries.
3. `node test/groq.test.js` и будущий `node test/vision.test.js`.
4. Manual smoke: Groq Direct, Ollama Direct; ошибка/429; недоступная Ollama; перезапуск и восстановление настроек.
5. Benchmark четырёх одинаковых скриншотов до выбора окончательного local default.

## Фактический результат проверки 2026-07-18

- Ollama `qwen3-vl:4b` загружена: 3 295 636 135 байт; `/api/show` подтвердил `vision`.
- Реальный local smoke по `src/assets/logo.png` завершён успешно: модель описала изображение, cold run — 48 576 мс.
- `node test/storage.test.js` — PASS.
- `node test/groq.test.js` — PASS.
- `node test/vision.test.js` — PASS.
- `node --check` для всех изменённых JavaScript-файлов — PASS.
- `npm run package` — PASS, Windows x64 package собран.
- Полный UI smoke автоматизировать не удалось: bundled Computer Use runtime не инициализировался из-за отсутствующего runtime path. Нужна ручная проверка shortcut в запущенном приложении.
- Live Groq Vision smoke остаётся незавершённым до запуска с настроенным Groq key; тесты подтверждают точную модель, multimodal payload, ограниченную key rotation и отсутствие cross-provider fallback.

## Подтверждённые решения

1. Default: Groq `qwen/qwen3.6-27b`; Ollama `qwen3-vl:4b` выбирается вручную.
2. Первый этап реализует только `direct`; extraction → GPT-OSS остаётся вне реализации.
3. Автоматический fallback между Groq и Ollama запрещён.
4. Загрузка `qwen3-vl:4b` разрешена.
5. Первый минимальный этап сохраняет фактическое текущее поведение приложения: анализ по ручному screenshot shortcut; interval capture не добавляется заново без отдельного требования.

## Официальные источники

- Groq Vision: https://console.groq.com/docs/vision
- Groq Qwen 3.6 27B: https://console.groq.com/docs/model/qwen/qwen3.6-27b
- Groq GPT-OSS 120B: https://console.groq.com/docs/model/openai/gpt-oss-120b
- Groq deprecations: https://console.groq.com/docs/deprecations
- Ollama model capabilities: https://docs.ollama.com/api-reference/show-model-details
- Ollama Qwen3-VL: https://ollama.com/library/qwen3-vl
- Ollama MiniCPM-V: https://ollama.com/library/minicpm-v
- Ollama Gemma 3: https://ollama.com/library/gemma3
- Ollama Llama 3.2 Vision: https://ollama.com/library/llama3.2-vision
