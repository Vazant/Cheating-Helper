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

## Регрессия Analyze Screen на Habr — 2026-07-27

### Симптом

На странице с русским учебным заданием по Java кнопка `Analyze Screen` вернула длинное описание сайта, недоказанную связь с Yandex и новое решение со `Scanner`, хотя ввод размера и другие дополнительные требования на экране отсутствовали.

### Current-state evidence

- Фактические preferences выбирают `profile_senior_java_interview`, `en-US`, Groq Vision `qwen/qwen3.6-27b`, включённый conversation context и сохранённый старый default `screenAnalysisPrompt`.
- `src/components/views/AssistantView.js:503-509` запускает screenshot без разового вопроса; `src/utils/renderer.js:783-786` отправляет только JPEG.
- `src/utils/vision.js:4-27` формирует неопределённую инструкцию `Analyze ... answer directly` и просит читать не только основной текст, но также controls/layout.
- `src/utils/gemini.js:939-980` отправляет vision-модели полный активный profile prompt как `system`, а screenshot instruction и изображение как `user`.
- `src/utils/aiProfiles.js:199-213` требует от Senior Java profile распознать coding task, кратко пересказать условие и выдать полный Java-код. `src/utils/aiProfiles.js:147-150` отдельно фиксирует английский язык ответа.
- Сохранённая сессия `history/1785113905674.json` содержит пустую conversation history, один screenshot request с default prompt и полученный ответ; provider/model/pipeline записаны как Groq/Qwen/direct. Это исключает загрязнение предыдущим диалогом и text-model fallback.
- Текущий default продублирован в `src/utils/vision.js:4` и `src/components/views/CustomizeView.js:4-5`. `src/storage.js:379-382` сохраняет любое непустое старое значение, поэтому простая замена константы не исправит существующую установку.
- Upstream issues `#216` и `#366` подтверждают общий запрос на более точные ответы и распознавание основного screen task, но готового узкого исправления prompt layering в найденных PR нет.

### Capability-to-model matrix

| Роль                        | Текущий runtime             | Решение этой регрессии                                                                                          |
| --------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Hosted Vision               | Groq `qwen/qwen3.6-27b`     | Model ID и direct routing не менять                                                                             |
| Local Vision                | Ollama vision-capable model | Применить ту же Vision grounding policy                                                                         |
| Hosted Text                 | GPT-OSS 120B/20B            | Не участвует в screenshot request                                                                               |
| Active AI Profile           | Senior Java Interview       | Использовать только в явно подтверждённой роли; не позволять общим profile rules расширять невидимые требования |
| Speech-to-Text / Live Audio | отдельные pipelines         | Не менять                                                                                                       |

### Рекомендуемое поведение

1. Default intent кнопки: найти один главный видимый вопрос, задачу или ошибку в центральной области и ответить только на него.
2. Игнорировать навигацию, рекламу, sidebar и соседние материалы, если они не нужны для основного ответа.
3. Не выводить недоказанные название компании, курса, вакансии или контекст процесса.
4. Для coding task использовать только видимые требования; не добавлять ввод, ограничения и edge cases, которых нет на экране.
5. Если на экране уже есть решение, не заменять его придуманной постановкой; проверять или объяснять его только когда это требуется главным вопросом.
6. Если главного вопроса нет или важная часть обрезана, кратко сообщить об этом вместо угадывания.
7. Сохранить direct pipeline и одну модель; не добавлять extraction → text LLM.

### Предлагаемый prompt layering

- Добавить короткую неизменяемую Vision grounding policy на уровне `system` для Groq и Ollama.
- Активный профиль может задавать выбранный язык, стиль и предметный уровень только после подтверждения пользователя; Vision policy должна явно иметь приоритет над общими profile rules при определении того, что видно и что требуется решить.
- Редактируемый `screenAnalysisPrompt` оставить отдельной user-level инструкцией.
- Новый default сформулировать как task-first, grounded и concise.
- Мигрировать только точное старое default-значение. Любой пользовательский prompt сохранить byte-for-byte.

### Предлагаемая маршрутизация намерения

`Analyze Screen` не должен заранее предполагать, что каждый скриншот является полной coding task. Vision-модель сначала определяет действие по наиболее сильному видимому сигналу и затем сразу выполняет его, не выводя пользователю служебную классификацию:

1. Если видны явный вопрос или текстовое условие — ответить на вопрос или решить задачу, используя только видимые требования.
2. Если рядом с кодом видны ошибка компиляции, stack trace, failing test, неверный результат или явная просьба исправить — объяснить причину и предложить минимальное исправление; полный код давать, только когда он нужен для понятного решения.
3. Если код явно незавершён (`TODO`, пропуск, пустой метод или заготовка) — дополнить только недостающую часть, сохранив видимую структуру и стиль.
4. Если видны условие и готовое решение — проверить решение относительно видимого условия, указать ошибку или подтвердить подход; не заменять его новой постановкой.
5. Если виден только код без вопроса, ошибки и признаков незавершённости — кратко объяснить назначение, основной поток и заметные проблемы; не угадывать, что пользователь хотел переписать или оптимизировать.
6. Если главная задача обрезана или несколько целей одинаково вероятны — назвать недостающую часть и дать только безопасный частичный анализ вместо выдуманного требования.

Приоритет сигналов: явная инструкция на экране → видимая ошибка/результат → признаки незавершённости → общий анализ кода. Навигация, sidebar, реклама и соседние материалы не считаются намерением.

Активный AI Profile предлагается применять не для определения фактов и намерения на изображении, а после grounded-классификации — для языка, уровня, стиля и подходящего формата ответа. Например, подтверждённая coding task может получить решение по правилам Senior Java profile, но профиль не может добавить невидимый ввод, ограничения, API или контекст задачи.

### Подзадачи

1. `DONE` Воспроизвести фактический request shape и исключить history/fallback.
2. `DONE` Проверить актуальную Groq Vision capability и рекомендации по явному prompt role/instructions.
3. `DONE` Проверить связанные upstream issues/PR; готового точного исправления не найдено.
4. `DONE` Пользователь подтвердил 2026-07-27: grounded automatic intent routing, профиль применяется после определения задачи, язык остаётся выбранным в настройках.
5. `DONE` Обновить canonical/default/reset prompt и добавить exact-value migration старого default.
6. `DONE` Добавить общую Vision grounding policy в Groq и Ollama request builders.
7. `DONE` Расширить `test/vision.test.js` и `test/storage.test.js`.
8. `BLOCKED` Провести разрешённый live A/B на исходном Habr screenshot и трёх контрольных случаях.

### Критерии приёмки

- Ответ не утверждает связь с Yandex, курсом или вакансией без видимого доказательства.
- Ответ фокусируется на центральном задании и не пересказывает Habr sidebar/navigation.
- Решение не добавляет `Scanner`, пользовательский размер массива или другие невидимые требования.
- Groq и Ollama используют одинаковую grounding policy.
- Выбранная языковая политика соблюдается явно и одинаково.
- Точное старое default-значение обновляется; пользовательский custom prompt не изменяется.
- Отдельные text, vision, STT и audio model roles сохраняются.
- `node --check src/utils/vision.js src/utils/gemini.js src/utils/localai.js src/storage.js src/components/views/CustomizeView.js`, `node test/vision.test.js` и `node test/storage.test.js` проходят.
- Live A/B повторяет исходный скриншот и не воспроизводит недоказанные атрибуции или придуманные требования.

### Подтверждённая политика

1. `Analyze Screen` отвечает на главный видимый вопрос, задачу, кодовую проблему или ошибку, а не описывает всю страницу.
2. Vision grounding policy определяет факты и намерение по скриншоту. Активный AI Profile применяется после этого и задаёт выбранный язык, технический уровень, стиль и подходящий формат ответа, но не расширяет видимые требования.
3. Язык screenshot-ответа остаётся выбранным `Speech Language`.

### Результат реализации и проверки 2026-07-27

- `src/utils/vision.js` содержит общий `buildVisionSystemPrompt`, новый task-first default и точное старое default-значение для миграции.
- `src/utils/gemini.js` применяет один и тот же built system prompt к Groq и Ollama Vision; text/audio маршруты не изменены.
- `src/storage.js` заменяет только точное старое standard-значение; пользовательский screenshot prompt сохраняется без изменений.
- `src/components/views/CustomizeView.js` использует новый default для сохранения и Reset.
- `node --check` для всех файлов из критерия приёмки — PASS.
- `node test/vision.test.js` и `node test/storage.test.js` — PASS.
- Все 18 автономных `test/*.js`, кроме отдельного UI smoke `rendererRuntimeSmoke.js`, — PASS.
- `git diff --check` — PASS; только информационные предупреждения Git о будущей нормализации LF/CRLF.
- `npx.cmd prettier --check` для изменённых application/test files — PASS.
- Точное старое default-значение в фактических preferences мигрировано; выбранные `ru-RU`, Groq Vision и conversation context сохранены.
- `npm.cmd run package` — PASS после разрешения сетевого доступа; Windows x64 package пересобран 2026-07-27.
- Live A/B остаётся отдельной незавершённой проверкой; статус задачи сохраняется `IN_PROGRESS`.

## Регрессия Medium Ping/Pong — 2026-07-27

### Наблюдаемый результат

На скриншоте видны условие задачи о последовательной печати `Ping`, затем `Pong`, объяснение варианта с `wait/notify` и общий пример ожидания в `while`. Direct Groq Vision ответ:

- добавил невидимый контекст «ответа на интервью»;
- заменил видимый подход альтернативами `Semaphore` и `Exchanger`, хотя об этом не просили;
- сослался на несуществующую на скриншоте последовательность `wait` после `notify`;
- смешал русский текст с китайскими символами;
- выдал неверный код: `pingSem = 0`, `pongSem = 1` заставляет первым печататься `Pong`, нарушая главное видимое требование.

OCR основной задачи сработал; ошибка находится в определении нужного действия и технической проверке сгенерированного решения.

### Причина

1. Текущий intent priority считает любое видимое условие достаточным для свободного решения, но не требует предпочитать явно обсуждаемый на экране механизм.
2. Grounding policy запрещает невидимые требования, но пока не запрещает невидимое обрамление вроде «на интервью» и критику кода, которого на экране нет.
3. Нет явной инструкции перед выдачей кода проверить начальное состояние и мысленно пройти первые шаги относительно видимых требований.
4. Direct pipeline оставляет OCR, определение намерения и решение задачи одной vision-модели; prompt может снизить риск, но не гарантирует техническую корректность.

### Минимальная prompt-доработка

- Если условие сопровождается объяснением рекомендуемого механизма, использовать его как контекст решения; не переключаться на несвязанные альтернативы без явного запроса.
- Отличать общий иллюстративный snippet от готового решения основной задачи.
- Не называть экран интервью, тестом, вакансией или ответом кандидата без видимого основания; активный профиль задаёт уровень и формат, а не происхождение экрана.
- Перед возвратом кода проверить каждое явное требование и мысленно выполнить начальные шаги; исправить решение, если первый наблюдаемый результат им противоречит.
- Писать полностью на выбранном языке, кроме идентификаторов и коротких цитат из исходного кода.
- Не критиковать операции или последовательности, которых нет на экране.

### Варианты качества

1. `direct + stricter prompt`: минимальная правка без новой настройки и дополнительного запроса; быстрее и дешевле, но vision-модель остаётся единственной точкой технического рассуждения.
2. `extract-then-response`: Qwen извлекает основное условие, видимый код и ошибки без решения, затем выбранная text LLM строит и проверяет ответ. Это лучше разделяет OCR и reasoning, но увеличивает задержку и расход Groq-квоты; требует явного product confirmation и реализации pipeline.

### Новый открытый вопрос

Подтвердить следующий этап: ограничиться минимальной prompt-доработкой в direct pipeline либо добавить явный режим `Quality: Vision extraction → Text LLM`.

## Подтверждённый Quality pipeline — 2026-07-27

Пользователь подтвердил замену текущего hosted direct-ответа на двухэтапную обработку и потребовал сначала отправить контрольную точку в GitHub. Контрольный commit `47b7243` (`checkpoint: improve prompts and vision grounding`) успешно отправлен в `origin/codex/groq-quality-context`.

### Проверенная модельная схема

| Этап                  | Модель/провайдер                                                            | Вход                                             | Выход                                  |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| Hosted extraction     | Groq `qwen/qwen3.6-27b`                                                     | JPEG + extraction instruction                    | Только структурированные видимые факты |
| Hosted final response | Замороженная text model активной Groq-сессии; default `openai/gpt-oss-120b` | Валидированное text extraction + profile/context | Финальный ответ пользователю           |
| Local screenshot      | Выбранная Ollama vision-capable model                                       | JPEG + direct grounding prompt                   | Полностью локальный direct-ответ       |

Официальная Groq документация на 2026-07-27 подтверждает image/text input и JSON mode для Qwen 3.6, а GPT-OSS 120B принимает только text input и поддерживает reasoning. Raw image во второй этап не передаётся.

### Подтверждённый минимальный scope

- Новый preference/toggle не добавлять: hosted Groq screenshot всегда использует `extract-then-response`.
- Второй этап использует `currentGroqSession.model`, профиль, язык, behavior, text history budget, key rotation и same-family 404 fallback активной сессии.
- Extraction не получает Senior Java profile, User Context, выбранный язык или conversation history и не показывается в UI.
- Один hosted request context и один vision lock охватывают оба этапа; ошибка/abort/empty/invalid extraction останавливает цепочку.
- Сохранять только итоговый screenshot-ответ и metadata `pipeline`, `visionModel`, `responseModel`; raw extraction не сохранять.
- Screenshot-ответ, как и раньше, не добавлять молча в обычную text/audio conversation history.
- `Ollama — Local/private` пока остаётся direct/local. Скрытая передача extracted screen text в Groq запрещена; local two-stage или mixed provider потребуют отдельного явного решения.
- UI явно сообщает, что Groq screenshot использует два запроса и выбранную Text Response Model; ложное `Text model used only for typed/transcripts` удалить.

### Extraction contract

Stage 1 возвращает один ограниченный JSON object с `status`, `primaryKind`, `primaryText`, `visibleRequirements`, `requestedMechanisms`, `visibleCode`, `visibleErrors`, `visibleExamples` и `missingOrUnreadable`. Он не отвечает, не решает, не объясняет и не критикует задачу. Invalid enum/shape/oversize/empty critical evidence останавливают pipeline без повторного запроса и без старых данных.

### Final-answer safeguards

- Профиль задаёт язык, уровень, стиль и формат, но не доказывает, что экран относится к интервью, тесту, вакансии или компании.
- Предпочитать явно видимый requested mechanism.
- Не добавлять невидимые input/constraints/code/errors/operations/expected output.
- Перед возвратом кода сверить каждое видимое требование и мысленно пройти начальное состояние.
- Не раскрывать extraction process и не смешивать языки, кроме идентификаторов/цитат кода.

### Подзадачи Quality pipeline

1. `DONE` Создать и отправить контрольный commit перед изменением pipeline.
2. `DONE` Проверить официальные capabilities Qwen Vision/JSON и GPT-OSS Text/Reasoning.
3. `DONE` Провести read-only audits model architecture, prompt runtime и settings/storage.
4. `DONE` Добавить extraction builders/parser и final evidence boundary.
5. `DONE` Сделать Groq vision stage внутренним и передать валидированное extraction в существующий text runner.
6. `DONE` Обновить screenshot history metadata и Settings descriptions; Ollama direct/private не менять.
7. `DONE` Добавить unit/regression checks и пересобрать Windows package.
8. `BLOCKED` Live A/B на Medium Ping/Pong и контрольных скриншотах требует отдельного разрешения на два Groq-запроса.

### Фактический результат Quality pipeline

- Hosted Groq screenshot теперь проходит через `qwen/qwen3.6-27b` extraction и выбранную Text Response Model; для текущей `openai/gpt-oss-120b` финальный этап использует `medium` reasoning.
- Кнопка `Analyze Screen` и настраиваемая горячая клавиша используют один `captureManualScreenshot()` и один IPC/pipeline: новый снимок → extraction → финальный ответ.
- Stage 1 возвращает JSON и не получает профиль, User Context, выбранный язык или историю. Stage 2 не получает изображение и строит ответ только по валидированным видимым данным.
- Успешная запись History хранит итоговый ответ и metadata `pipeline`, `visionModel`, `responseModel`; сырой extraction не сохраняется.
- Ollama сохранила прямой локальный pipeline без скрытой передачи данных в Groq.
- Старый стандартный screen prompt автоматически заменён новым extraction-focused default; пользовательские prompt-значения не перезаписываются.
- Все 18 автономных JavaScript test files прошли; `node --check`, Prettier check и `git diff --check` прошли.
- `npm run package` прошёл; Windows x64 package пересобран.
- Текущие локальные настройки проверены после миграции: `ru-RU`, Groq Vision, `openai/gpt-oss-120b`, screenshot conversation context включён.
- Live Groq A/B не запускался: он расходует два API-запроса и остаётся отдельной разрешаемой проверкой.

### Критерии приёмки Quality pipeline

- Stage 1 payload содержит Qwen + image; Stage 2 содержит выбранную text model и не содержит image/base64.
- Extraction stage не получает profile/User Context/language/history и не создаёт response card.
- Invalid/empty extraction не запускает Stage 2.
- Final stage использует frozen profile/language и существующий bounded text context, но не добавляет screenshot turn в обычную conversation history.
- Один abort context предотвращает stale final answer после смены/закрытия сессии.
- History успешного Groq screenshot содержит `pipeline: extract-then-response`, vision model и фактическую response model; extraction не сохраняется.
- Ollama остаётся local/direct и не отправляет extracted content в Groq.
- Ping/Pong regression не добавляет interview framing, сохраняет видимый `wait/notify` и проверяет, что первый фактический вывод — `Ping`.
- Кнопка `Analyze Screen` и shortcut запускают один и тот же ручной screenshot flow.

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
