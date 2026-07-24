# 027 — Groq-only: качество ответов, контекст и эффективность токенов

Статус: `IN_PROGRESS`

## Нормализованное техническое задание

### Цель

Провести доказательный аудит текущего Groq-контура Cheating Helper и подготовить подробный поэтапный план его улучшения. Результат должен повысить качество и точность ответов, сохранение контекста внутри активной сессии, предсказуемость prompt design, расход токенов и устойчивость streaming — без добавления новых LLM-провайдеров и без ухудшения уже работающих сценариев.

### Рабочая гипотеза

Сейчас продукт уже решает основную задачу. Поэтому сначала требуется зафиксировать, что именно работает хорошо и должно стать регрессионной границей, затем измерить слабые места, и только после этого предлагать изменения. Любое улучшение должно проверяться на реальных пользовательских сценариях, а не только на уровне отдельных функций.

### В пределах задачи

1. Текущий hosted Groq text pipeline.
2. Groq STT и Groq vision только как отдельные роли и обязательные регрессионные границы.
3. Формирование system prompt из AI Profile.
4. Порядок сообщений в запросе: статический prompt, предыдущие пары вопрос/ответ, текущий вопрос.
5. Сохранение контекста между соседними вопросами внутри одной активной сессии.
6. Расчёт input/output budget, обрезка старых сообщений, фактическое usage и prompt caching.
7. Параметры текущих Groq-моделей, streaming, обработка ошибок, лимитов и нескольких API-ключей.
8. Набор воспроизводимых quality/regression-сценариев для typed input, микрофона, system audio и screenshot.
9. Настройки, которые действительно нужны пользователю для контроля качества, контекста и стоимости.

### Вне задачи

1. OmniRoute.
2. Новые LLM-провайдеры и универсальная provider architecture.
3. Выбор моделей «на будущее».
4. Межсессионная память, vector database и RAG.
5. Визуальный редизайн и миграция на React/Shadcn.
6. Полная переработка локального inference.

### Обязательные результаты исследования

1. Карта текущего поведения: `работает хорошо / работает с ограничениями / не подтверждено / требует исправления`.
2. Трассировка одного запроса от пользовательского ввода до streaming-ответа с точными местами формирования prompt, history и token budget.
3. Отдельный ответ на вопрос: что модель помнит через один-два связанных вопроса в той же сессии, когда и почему контекст пропадает.
4. Аудит текущих profile prompts на дублирование, конфликтующие инструкции, длину, естественность и пригодность именно для используемых Groq-моделей.
5. Проверка актуальных возможностей, ограничений, rate limits, reasoning controls, prompt caching и usage metadata по официальной документации Groq.
6. Базовая матрица качества до изменений и целевые метрики после изменений.
7. Подробный implementation plan, разбитый на независимые commit-ready блоки.

### Правила для implementation plan

Каждый блок должен:

1. Решать одну понятную проблему.
2. Иметь собственную пользовательскую ценность.
3. Содержать точный scope и перечень затрагиваемых компонентов.
4. Содержать проверяемые acceptance criteria.
5. Иметь automated checks и обязательный manual smoke.
6. Явно перечислять регрессии, которых нельзя допустить.
7. Иметь простой rollback.
8. Заканчиваться рабочим состоянием, пригодным для отдельного commit и push.
9. Не зависеть от незавершённого следующего блока.

### Исследовательские ограничения

1. До подтверждения плана пользователем application code не менять.
2. Исследовательские агенты работают только read-only.
3. Не угадывать model IDs, лимиты, defaults и fallback order.
4. Для изменяемых сведений использовать официальные источники Groq.
5. Разделять подтверждённые факты, выводы из кода, гипотезы и рекомендации.
6. Text generation, transcription, vision и local inference считать разными ролями.
7. Не оптимизировать стоимость ценой скрытой потери контекста или качества.
8. Стабильную статическую часть prompt располагать до динамического контекста, если это подтверждено официальной документацией и текущим API.
9. Не считать задачу `DONE`, пока не пройдены все критерии и записанные проверки.

## Единый бриф для исследовательских агентов

Проанализируй текущий Groq-only контур Cheating Helper в соответствии с нормализованным техническим заданием выше. Код и конфигурацию не изменяй. Используй доказательства из репозитория и официальных источников. Верни:

1. Что уже работает хорошо и должно быть сохранено.
2. Какие проблемы подтверждены, а какие пока являются только гипотезами.
3. Причины проблем с указанием конкретных файлов, функций или официальных документов.
4. Минимальные изменения с наибольшим влиянием на качество, контекст и расход токенов.
5. Риски и обязательные регрессионные проверки.
6. Предлагаемый порядок независимых commit-ready этапов.
7. Открытые вопросы, которые нельзя решать без пользователя.

## Текущее состояние исследования

- [x] Пользовательский запрос преобразован в единое техническое задание.
- [x] Зафиксирована карта уже работающих сценариев.
- [x] Проверена фактическая сборка system prompt и conversation history.
- [x] Проверены token budget, truncation и usage accounting.
- [x] Проверены актуальные официальные рекомендации Groq.
- [x] Собраны независимые отчёты исследовательских ролей.
- [x] Подготовлена базовая eval/regression matrix.
- [x] Подготовлен поэтапный commit-ready план.
- [x] Записаны открытые решения пользователя.
- [x] Пользователь подтвердил план реализации.

## Решения пользователя

- Оптимизировать только текущую интеграцию Groq.
- OmniRoute пока не использовать.
- Не проектировать будущие интеграции с другими LLM.
- Главный приоритет: качество ответов, контекст внутри активного разговора, корректные prompts и разумный расход токенов.
- План должен быть подробным, модульным и безопасным для поэтапных commit/push.
- План и рекомендованный пакет product decisions подтверждены пользователем.

## Открытые вопросы

Значения по умолчанию и fallback order не угадывать. Решения, требующие подтверждения пользователя, перечислены в конце плана.

## Итог аудита

### Краткий вывод

Приложению не требуется заново создавать память внутри разговора: она уже работает. После успешного первого вопроса и ответа второй запрос получает точную пару `user/assistant`; третий запрос по умолчанию получает две предыдущие пары. История не суммаризируется и не восстанавливается из старых сессий — в текущей задаче это правильно.

Наибольший потенциал улучшения находится в четырёх местах:

1. Устранить противоречия и вымышленные примеры во встроенных profile prompts.
2. Сделать видимыми реальные границы контекста и фактический token/cache usage.
3. Не допускать расхождения между видимым ответом, сохранённой историей и контекстом следующего запроса.
4. Изолировать завершение старых STT/text/vision-запросов после Stop или Restart.

Менять default model, default history count, temperature, reasoning effort и fallback order до появления baseline-метрик не следует.

### Что уже работает хорошо и должно быть сохранено

| Область | Подтверждённое поведение | Регрессионная граница |
|---|---|---|
| Session snapshot | При Start фиксируются profile, compiled system prompt, model, behavior и language | Изменение профиля во время активной сессии не меняет уже запущенный разговор |
| Порядок контекста | `system → последние полные user/assistant пары → текущий user` | System prompt остаётся первым и стабильным |
| Follow-up memory | Через один-два вопроса передаются точные прошлые вопросы и ответы | Связанный follow-up должен видеть предыдущие успешные пары |
| Trimming | Удаляются самые старые полные пары, текущий вопрос сохраняется | Никогда не оставлять половину пары и не удалять текущий вопрос |
| Typed/audio convergence | Typed input и успешный Groq STT входят в одну FIFO text queue | Порядок вопросов сохраняется |
| Streaming | Первый фрагмент выводится сразу, затем обновления ограничены примерно 40 мс, в конце выполняется final flush | Видимый финальный текст совпадает с сохранённым ответом |
| Reasoning GPT-OSS | `reasoning_effort: low`, `include_reasoning: false` | Chain-of-thought не должен попадать пользователю |
| Ошибки | 404 переключает text model; 429 переключает ключ; 401/403/413/5xx/network не вызывают скрытую ротацию | Повторные попытки ограничены и объяснимы |
| Роли | Text, STT и Vision — разные pipeline | Raw audio не отправляется text model; vision не использует text fallback |
| STT | `whisper-large-v3-turbo`, 16 kHz mono WAV, language hint | Один завершённый utterance создаёт не более одного STT и одного text request |
| Vision | Отдельный Qwen vision request, до двух последних text turns, ограничение размера изображения | Screenshot не загрязняет обычную text history |
| Baseline tests | Все девять существующих `node:test` файлов проходят | Базовый набор остаётся зелёным после каждого блока |

### Что работает с ограничениями

1. По умолчанию сохраняются последние 6 пар, но настройка скрыта от пользователя.
2. Input tokens оцениваются локальной эвристикой, а не tokenizer конкретной модели.
3. Budget использует текущий TPM как ограничитель одного запроса. Это консервативно для Free Plan, но TPM не равен model context window.
4. Output ограничен диапазоном 1024–2048 токенов независимо от типа вопроса.
5. Profile prompt повторяется в начале каждого запроса. Для GPT-OSS это полезно для automatic prefix caching, но приложение не измеряет cache hit.
6. Groq rate-limit headers читаются, но почти не отображаются пользователю.
7. История вопрос/ответ переписывается целиком после каждого хода.
8. Qwen text работает с неявными reasoning defaults и теми же общими sampling-настройками, хотя его официальные параметры отличаются от GPT-OSS.

### Подтверждённые проблемы

1. Ответ с `finish_reason: length` добавляется в provider history как обычный завершённый ответ. Следующий вопрос может опираться на оборванную мысль.
2. При ошибке после частичного stream пользователь уже видит текст, но текущий user turn удаляется из model history. Пользователь и модель продолжают разные версии разговора.
3. Stop или новый Start не отменяет уже выполняющийся STT/fetch/stream. Старый async result способен обновить новый экран, историю или active key.
4. Общий active Groq key меняется успешными Text, STT и Vision запросами без единого ownership/ordering rule.
5. Runtime не собирает фактические `prompt_tokens`, `completion_tokens`, `total_tokens` и `cached_tokens`.
6. Встроенные prompts содержат прямые конфликты:
   - «кратко» против 10–30 предложений;
   - plain format против обязательного Markdown/bold;
   - safety «не выдумывать» против примеров с вымышленными именами, цифрами и результатами;
   - одинаковые требования к краткости/стилю повторяются в нескольких секциях.
7. `conversationContextCount: 0` нормализуется в 6 из-за выражения `Number(value) || 6`; ноль доступен только через отдельное отключение контекста.
8. Typed IPC сообщает об успешной постановке в очередь раньше фактического завершения запроса; UI-состояние «принято» можно ошибочно понять как «выполнено».
9. Полный вопрос и ответ попадают в diagnostic log.
10. Жёсткий VAD limit 30 секунд способен разделить длинный вопрос на два независимых STT/LLM цикла.
11. Текущий automatic text fallback может без отдельного согласия перейти с GPT-OSS на Preview Qwen с другой ценой, reasoning-семантикой и отсутствием документированного prompt caching.

### Гипотезы, которые нельзя выдавать за подтверждённые проблемы

1. Что default 6 пар слишком много или слишком мало.
2. Что `temperature: 0.7` ухудшает фактическую точность.
3. Что `reasoning_effort: medium` даст полезный прирост качества.
4. Что GPT-OSS 20B достаточно хорош для большинства реальных вопросов.
5. Что сокращение system prompt автоматически улучшит ответы.
6. Что 30-секундная граница часто мешает именно текущему пользователю.
7. Что streaming Chat Completions вернёт usage в совместимом с OpenAI формате.

Эти пункты можно менять только после воспроизводимого A/B baseline.

## Что именно модель помнит в активном разговоре

### Нормальный сценарий

После:

1. `Q1 → A1`
2. `Q2 → A2`
3. `Q3`

третий Groq request содержит:

1. frozen system prompt;
2. `Q1`;
3. `A1`;
4. `Q2`;
5. `A2`;
6. текущий `Q3`.

То есть фразы «помнишь систему, о которой я говорила?» и «а что если изменить в ней X?» через один-два вопроса должны работать, если нужные факты были в последних успешных парах.

### Когда контекст пропадает

1. Пользователь нажал новый Start: runtime history очищается.
2. В профиле отключён conversation context.
3. Нужная пара старше настроенного количества пар.
4. TPM budget заставил удалить самые старые пары.
5. STT не вернул transcript.
6. Запрос завершился network/API/empty-response ошибкой: pending user turn удаляется.
7. Факт был только на screenshot: vision history отделена от text history.
8. Приложение остановили или перезапустили во время незавершённого запроса: текущее поведение недетерминировано и требует исправления.

### Важное различие

История в History View и контекст модели — не одно и то же. Сохранённая сессия сейчас нужна для просмотра. Новый Start не загружает её обратно в Groq context. Межсессионная память намеренно исключена из task 027.

## Текущая сборка prompt и token budget

### Порядок compiled system prompt

1. Application safety boundary.
2. Role and persona.
3. User context как недоверенные факты/ограничения.
4. Answer rules.
5. Response style.
6. Frozen response language.
7. Length preset.
8. Format preset.

Этот порядок полезно сохранить: критические правила находятся раньше dynamic conversation, а статический prefix остаётся одинаковым в пределах сессии.

### Размеры текущих English prompts

| Профиль | Символы | Текущая эвристическая оценка |
|---|---:|---:|
| Job Interview | 3 207 | ~1 069 tokens |
| Sales Call | 2 398 | ~800 tokens |
| Business Meeting | 2 257 | ~753 tokens |
| Presentation | 2 463 | ~821 tokens |
| Negotiation | 2 504 | ~835 tokens |
| Exam Assistant | 2 544 | ~848 tokens |
| Senior Java Interview | 3 514 | ~1 172 tokens |

Сокращение само по себе не является целью. Цель — убрать только дублирование, конфликты и неподтверждённые примеры, сохранив role-specific поведение.

### Текущий planner

1. Provisional/default TPM: 8 000.
2. Рабочий budget: 95% лимита минус 128.
3. Минимальный резерв ответа: 1 024 tokens.
4. Максимальный ответ: 2 048 tokens.
5. History: до 6 последних полных пар по умолчанию, hard cap 20.
6. Если не помещается, удаляется самая старая полная пара.
7. Если system + current question не оставляют 1 024 tokens, request отклоняется до отправки.

### Почему пока нельзя просто передавать 131K

Текущие модели действительно имеют длинный model context, но опубликованный Free Plan ограничивает text models 8K TPM. Большой single request может быть допустим по архитектуре модели, но непрактичен или невозможен в текущей rate window. Поэтому context window и operational token budget должны храниться и отображаться как разные понятия.

## Актуальные факты Groq, проверенные 2026-07-24

1. `openai/gpt-oss-120b` — активная text/reasoning model, context 131 072, max output 65 536. Она остаётся разумным quality default до появления сравнительного eval.
2. `openai/gpt-oss-20b` — активная более быстрая и дешёвая text/reasoning model.
3. `qwen/qwen3.6-27b` — активная Preview multimodal model, context 131 072, max output 16 384. Она заметно дороже GPT-OSS 120B и требует другого reasoning control.
4. `whisper-large-v3-turbo` — поддерживаемая multilingual STT model, ориентированная на низкую задержку.
5. Для GPT-OSS допустимы `reasoning_effort: low|medium|high`.
6. Для Qwen допустимы `reasoning_effort: none|default`; reasoning content следует скрывать отдельным совместимым параметром.
7. Published Free Plan для GPT-OSS 120B/20B и Qwen 3.6: 30 RPM, 1K RPD, 8K TPM, 200K TPD. Реальные account/org limits могут отличаться.
8. Published Free Plan для Whisper v3/Turbo: 20 RPM, 2K RPD, 7.2K ASH, 28.8K ASD.
9. Prompt caching автоматический, exact-prefix based и документирован только для GPT-OSS 20B/120B среди текущих text choices. Cache живёт до двух часов без использования; cached input получает 50% discount.
10. Несколько ключей одной Groq organization не умножают общую org quota.
11. Groq рекомендует: must-do instructions ставить раньше, задавать явные limits, использовать простые формулировки и не перегружать context нерелевантными данными.
12. Наличие usage в streamed response необходимо подтвердить live fixture; проект не должен предполагать OpenAI-совместимость этого поля без проверки.

Официальные источники:

- [GPT-OSS 120B](https://console.groq.com/docs/model/openai/gpt-oss-120b)
- [GPT-OSS 20B](https://console.groq.com/docs/model/openai/gpt-oss-20b)
- [Qwen 3.6 27B](https://console.groq.com/docs/model/qwen/qwen3.6-27b)
- [Reasoning](https://console.groq.com/docs/reasoning)
- [Prompt Caching](https://console.groq.com/docs/prompt-caching)
- [Prompting](https://console.groq.com/docs/prompting)
- [Rate Limits](https://console.groq.com/docs/rate-limits)
- [Whisper Large v3 Turbo](https://console.groq.com/docs/model/whisper-large-v3-turbo)

## Upstream-сигналы

1. Upstream issue [#460](https://github.com/sohzm/cheating-daddy/issues/460) сообщает о Groq 413/403/404 и закрытии сессии после обновления. Описание короткое, поэтому это сигнал для regression matrix, а не доказательство причины в нашем fork.
2. Upstream PR [#453](https://github.com/sohzm/cheating-daddy/pull/453) исправлял retired `qwen/qwen3-32b`. Это подтверждает необходимость проверять model IDs по официальным источникам и не скрывать model fallback.
3. Upstream issue [#382](https://github.com/sohzm/cheating-daddy/issues/382) описывает проблемы с длинными и близко расположенными вопросами. Это согласуется с необходимостью измерить VAD/max-utterance/queue, но не доказывает, что именно 30 секунд являются причиной каждого случая.
4. История чатов пришла из merged PR [#86](https://github.com/sohzm/cheating-daddy/pull/86), но Resume/Continue в текущий text context не реализован и не входит в эту задачу.

## Baseline и eval matrix

### Правила измерения

1. Зафиксировать profile, model, language, key slot и application build.
2. Для недетерминированных quality-сценариев выполнять минимум 5 повторов.
3. До и после изменения использовать один и тот же набор вопросов.
4. Отдельно записывать:
   - обязательные факты;
   - неверные утверждения;
   - неподтверждённые утверждения;
   - повторения;
   - соблюдение языка/формата;
   - завершённость;
   - finish reason;
   - estimated и actual input/output tokens;
   - cached tokens;
   - TTFT и total latency;
   - retained/trimmed pair count.
5. Quality gate: изменение нельзя принимать только за экономию tokens, если ухудшился любой обязательный factual/context score.

### Сценарии text quality

| ID | Сценарий | Проверка |
|---|---|---|
| T1 | Простой factual question | Точный короткий ответ без лишнего фона |
| T2 | Технический механизм | Механизм, пример, релевантные pitfalls; без повторов |
| T3 | Сравнение | Обе стороны, критерий выбора, отсутствие выдуманных метрик |
| T4 | Неоднозначный вопрос | Уточнение вместо уверенной галлюцинации |
| T5 | Недостаточно user facts | Признание нехватки данных вместо копирования example metrics |
| T6 | Frozen language | Ответ строго на выбранном языке |
| T7 | Senior Java experience | Только факты из профиля, первое лицо, без новых инструментов/цифр |
| T8 | Version-sensitive fact | Явная оговорка о проверке вместо выдуманного exact value |

### Сценарии context

| ID | Сценарий | Pass |
|---|---|---|
| C1 | Q1 задаёт codename Birch; Q2 спрашивает codename | Birch сохранён точно |
| C2 | Q1 задаёт ограничение no Redis; Q2 unrelated; Q3 возвращается к ограничению | no Redis восстановлен через два вопроса |
| C3 | Ссылка «это/его» на предыдущую систему | Правильный antecedent |
| C4 | 8 уникально маркированных пар при limit 6 | Доступны только последние 6, пары не разделены |
| C5 | Oversized current question | Текущий вопрос не удалён; oldest pairs trimmed |
| C6 | Context disabled | Ни одна старая пара не отправлена |
| C7 | Explicit context count 0 | Значение 0 сохраняется и исполняется согласно принятой семантике |
| C8 | Failed turn | Ошибочный ход не притворяется успешной памятью |
| C9 | Truncated answer | Поведение соответствует явно выбранной incomplete policy |
| C10 | New Start | Старые пары не переносятся |

### Сценарии audio

| ID | Сценарий | Pass |
|---|---|---|
| A1 | Короткий mic question | Один transcript, один text request, один answer |
| A2 | Короткий system-audio question | То же для loopback |
| A3 | Термины, числа, acronyms | Transcript сохраняет смысл и выбранный language hint |
| A4 | Silence/noise | Нет LLM request |
| A5 | Два быстрых вопроса | Порядок детерминирован; нет дублей |
| A6 | 45–60 секунд речи | Зафиксировано фактическое splitting behavior |
| A7 | Toggle/manual flush | Последний сегмент не теряется |
| A8 | Stop во время STT | Нет ghost answer/history/key activation |

### Сценарии streaming/lifecycle

| ID | Сценарий | Pass |
|---|---|---|
| S1 | SSE разбит в середине JSON/UTF-8 | Финальный текст точный |
| S2 | Несколько events в одном chunk | Все events обработаны один раз |
| S3 | `finish_reason: length` | UI, History и next-turn context согласованы |
| S4 | Partial stream + network failure | UI, History и context следуют одной выбранной policy |
| S5 | Empty content | Нет ложного успешного turn |
| S6 | Stop до headers | Старый request не меняет новую сессию |
| S7 | Stop после first token | Нет ghost update и contamination |
| S8 | Immediate Restart | Old session result не попадает в new session |

### Сценарии models, keys и limits

| ID | Сценарий | Pass |
|---|---|---|
| K1 | 404 primary text model | Только разрешённый text fallback, видимое объяснение |
| K2 | 429 current key | Ограниченная попытка следующего key slot |
| K3 | Все keys 429 | Нет бесконечного цикла |
| K4 | 401/403/413/5xx/network | Нет скрытого key/model switch |
| K5 | Параллельные Text/STT/Vision successes | Детерминированный active key |
| K6 | Near limit | Понятные RPD/TPM remaining/reset |
| K7 | Cache supported | Cached tokens измерены, если API сообщил |
| K8 | Usage absent | UI честно пишет `not reported`, без нулевой подстановки |

### Сценарии vision

1. Screenshot меньше 4 MB.
2. Screenshot больше лимита.
3. OCR мелкого UI text.
4. Stack trace/code.
5. Diagram.
6. Prompt injection внутри screenshot.
7. Только две последние text turns.
8. Параллельный второй screenshot отклоняется.
9. Vision не переключает text model.

## Поэтапный implementation plan

План и решения, влияющие на product behavior, подтверждены пользователем. Реальные платные Groq A/B calls требуют отдельного согласования бюджета перед соответствующим этапом.

### Блок 0 — Зафиксировать решения и baseline protocol

Статус блока: `DONE`

Commit: документация, без application code.

Scope:

1. Зафиксировать выбранные ответы на открытые вопросы.
2. Заморозить model IDs и параметры на время baseline.
3. Записать eval questions и scoring rubric без реальных персональных секретов.
4. Определить, какие live Groq calls допустимы и какой бюджет используется.

Acceptance:

1. Ни один default/fallback не выбран молча.
2. Все quality-сценарии имеют ожидаемые факты и критерии.
3. Отдельно отмечены provider fact, code fact и hypothesis.

Regression:

- Нет runtime-изменений.

Rollback:

- Удалить/откатить только protocol document.

### Блок 1 — Автоматизированный Groq baseline

Статус блока: `DONE`

Предлагаемый commit: `test: lock Groq quality and context baseline`

Scope:

1. Добавить mocked fetch/SSE harness.
2. Зафиксировать exact message order.
3. Покрыть 1–2 follow-up turns.
4. Покрыть context disabled/count/budget trimming.
5. Покрыть 404 model order, 429 key order и non-rotating errors.
6. Покрыть STT multipart → ровно один text enqueue.
7. Покрыть vision payload.
8. Добавить prompt snapshots/fixtures и измерение compiled sizes.

Acceptance:

1. Тесты не обращаются к сети.
2. Текущий runtime behavior воспроизводим.
3. `node --test "test/*.test.js"` проходит.
4. Ни один production default не меняется.

Manual smoke:

- Typed, mic, system audio и screenshot на текущей версии.

Regression:

- Нулевая: tests-only.

Rollback:

- Удалить test harness и fixtures.

Evidence:

- Добавлен `test/groqBaseline.test.js`, production runtime не изменён.
- Новый baseline: 8/8 checks passed.
- Полная регрессия: 16/16 tests passed командой `node --test "test/*.test.js"`.
- Зафиксированы exact follow-up pairs, context controls, pair-safe TPM trimming, pre-fetch rejection, mocked split SSE, bounded retries, prompt sizes и известные runtime gaps.

### Блок 2 — Session ownership и отмена устаревших запросов

Статус блока: `IN_PROGRESS` — implementation и automated checks готовы; live Groq smoke заблокирован решением 9

Предлагаемый commit: `fix: isolate Groq requests from stopped sessions`

Scope:

1. Ввести session generation/request ownership.
2. Добавить отмену или ownership guard для Text, STT и Vision.
3. Запретить старому request после Stop/Restart:
   - renderer updates;
   - history writes;
   - provider history mutation;
   - active key activation.
4. Сохранить FIFO для действующей text queue.

Acceptance:

1. Stop на стадиях Transcribing, waiting headers, first token и mid-stream не создаёт ghost events.
2. Immediate Restart не загрязняется старой сессией.
3. Abort не запускает model/key fallback.
4. Все baseline tests зелёные.

Manual smoke:

- Поочерёдно остановить сессию на каждой стадии и немедленно запустить новую.

Regression:

- Обычный успешный typed/audio/vision flow не замедляется заметно.
- Cleanup audio tracks остаётся рабочим.

Rollback:

- Один изолированный commit.

Evidence:

- Text, STT и Vision получают общий session-owned AbortSignal.
- Новый Start и Stop отменяют предыдущий scope; устаревшие callbacks не меняют UI, history или active key.
- Renderer игнорирует ожидаемый screenshot abort.
- Session ownership checks: 3/3 passed.
- Полная регрессия: 19/19 tests passed.
- `npm.cmd run package`: passed для Windows x64.
- Manual Stop/Restart во время реального Groq STT/stream: `BLOCKED` до отдельного разрешения live calls.

### Блок 3 — Единая политика incomplete и failed turns

Статус блока: `IN_PROGRESS` — implementation и automated checks готовы; live forced-truncation smoke заблокирован решением 9

Предлагаемый commit: `fix: keep visible and model conversation consistent`

Scope:

1. Реализовать подтверждённую пользователем policy для `finish_reason: length`.
2. Реализовать policy для partial stream failure.
3. Явно хранить состояние turn: `complete`, `incomplete`, `failed`.
4. Не позволять UI, History и next-turn messages молча расходиться.
5. Не считать failed turn обычной успешной парой.

Acceptance:

1. S3/S4/C8/C9 проходят.
2. Статус incomplete видим пользователю.
3. Следующий request следует documented policy.
4. Полный успешный flow не меняется.

Manual smoke:

- Искусственно малый completion cap и прерывание stream.

Regression:

- Последний корректный suffix по-прежнему final-flush.
- Полные ответы сохраняются без дополнительных маркеров в тексте.

Rollback:

- Откатить turn-state commit; storage migration должна быть backward compatible.

Evidence:

- `complete`/`incomplete` status сохраняется backward-compatible в conversation history.
- Length и partial stream ответы получают явный marker только в model context.
- Live response и History показывают incomplete state; успешные ответы не получают marker.
- Incomplete-turn checks: 3/3 passed.
- Полная регрессия: 22/22 tests passed.
- `npm.cmd run package`: passed для Windows x64.
- Manual forced live truncation/stream interruption: `BLOCKED` до отдельного разрешения live calls.

### Блок 4 — Очистить и стабилизировать built-in prompts

Статус блока: `IN_PROGRESS` — prompt rewrite и automated checks готовы; live quality A/B заблокирован решением 9

Предлагаемый commit: `fix: remove conflicts from Groq profile prompts`

Scope:

1. Для каждого built-in profile определить одну persona, один length rule и один format rule.
2. Удалить вымышленные имена, метрики, ROI и результаты из examples.
3. Заменить длинные examples короткими правилами или безопасными schema examples.
4. Удалить конфликт Markdown/bold с plain format.
5. Сохранить отдельный verified User Context и follow-up behavior Senior Java.
6. Сохранить stable section ordering для cache prefix.

Целевой результат:

- Сокращение compiled built-in prompts ориентировочно на 20–35%, только если profile rubric не регрессирует.

Acceptance:

1. Нет противоречащих length/format instructions.
2. Нет неподтверждённых example facts.
3. Все 6 built-in profiles проходят T1–T6.
4. Senior Java проходит T7–T8 и связанные follow-ups.
5. Не хуже baseline factual/context score.
6. Нет роста answer truncation rate.

Manual smoke:

- По 3 вопроса на каждый built-in profile и полный Senior Java набор.

Regression:

- Профили сохраняют свою роль и пригодность для речи.
- Language freeze и profile snapshot не меняются.

Rollback:

- Prompt-only commit.

Evidence:

- Удалены вымышленные metrics, customers, deadlines, owners, guarantees и competitor claims.
- Удалены конфликты plain format с Markdown/bold и повтор вопроса в Exam.
- Compiled prompt reduction: Interview 44.8%, Sales 31.0%, Meeting 29.2%, Presentation 35.1%, Negotiation 34.3%, Exam 40.1%.
- Senior Java verified User Context и follow-up rules не изменены.
- Prompt-quality checks: 3/3 passed.
- Полная регрессия: 25/25 tests passed.
- `npm.cmd run package`: passed для Windows x64.
- Live profile-by-profile factual/context A/B: `BLOCKED` до отдельного разрешения live calls.

### Блок 5 — Безопасная Groq observability

Статус блока: `IN_PROGRESS` — implementation и mocked usage checks готовы; live streamed usage verification заблокирована решением 9

Предлагаемый commit: `feat: record Groq request and usage metrics`

Scope:

1. Создать whitelist metadata record:
   - request/session ID;
   - role: text/STT/vision;
   - selected/actual model;
   - key slot, но не ключ;
   - estimated input;
   - included/trimmed pairs;
   - planned completion cap;
   - reasoning mode;
   - status/finish reason;
   - TTFT/total timing;
   - RPD/TPM remaining/reset;
   - actual usage/cached tokens, только если API сообщает.
2. Убрать raw transcript/answer из console log.
3. Добавить parser fixture для фактической формы Groq usage.
4. Если streamed usage не подтверждён, не делать дополнительный платный запрос; показывать `not reported`.

Acceptance:

1. В logs/metrics нет API keys, prompt text, transcript, image/audio payload.
2. Estimated и provider-reported values не смешиваются.
3. Отсутствующее usage не превращается в ноль.
4. Cache hit рассчитывается только по provider-reported cached tokens.
5. Никакого изменения model output.

Manual smoke:

- Один typed request и один follow-up на GPT-OSS; проверить stable prefix и reported cache usage, если доступно.

Regression:

- Streaming cadence и final text не меняются.

Rollback:

- Удалить metadata capture; runtime request payload остаётся прежним.

Evidence:

- Text/STT/Vision используют единый whitelist metric contract.
- В памяти хранится не более 100 metrics текущей сессии; новый Start очищает их.
- Prompt, transcript, answer, audio/image payload и API key в metrics не записываются.
- SSE/JSON usage нормализуется только в `prompt/completion/total/cached` counters; неизвестные поля отбрасываются.
- Дополнительный запрос и неподтверждённый `stream_options.include_usage` не добавлены.
- Raw conversation turn удалён из console log.
- Metrics checks: 3/3 passed.
- Полная регрессия: 28/28 tests passed.
- Live streamed `usage.cached_tokens` fixture: `BLOCKED` до отдельного разрешения live calls.

### Блок 6 — Понятный active-session context control

Статус блока: `IN_PROGRESS`

Предлагаемый commit: `feat: expose Groq context budget controls`

Scope:

1. Вывести существующие `conversationContextEnabled` и `conversationContextCount`.
2. Показать до Start:
   - compiled prompt estimate;
   - выбранное количество пар;
   - текущий provisional/observed TPM;
   - planned output reserve.
3. Во время сессии показать компактно:
   - model;
   - retained/trimmed pair count;
   - estimated/actual input;
   - actual/planned output;
   - cached/prompt ratio или `not reported`;
   - TTFT/total;
   - quota remaining/reset.
4. Явно объяснить: изменения профиля вступают в силу после нового Start.
5. Исправить семантику explicit count 0.

Acceptance:

1. Настройка round-trip сохраняется.
2. Frozen current session не меняется после редактирования.
3. Новый Start использует новое значение.
4. Planner messages точно соответствуют UI.
5. Значения `estimated`, `actual` и `not reported` различимы.

Manual smoke:

- 0, 2, 6 и 20 пар; context off; edit during session; restart.

Regression:

- Default остаётся 6 до отдельного подтверждения/eval.
- UI не запускает дополнительные LLM calls.

Rollback:

- UI/settings commit; planner default не меняется.

Evidence:

- В AI Profiles доступны переключатель context и лимит `0–20` завершённых пар; default остаётся `6`.
- Explicit `0` сохраняется как `0`, а не нормализуется обратно в `6`.
- До Start показаны model, prompt estimate, provisional TPM, context limit и answer reserve без LLM-вызова.
- При Start `behavior` копируется в session snapshot; редактирование профиля не меняет активную сессию.
- Active-session diagnostics различают estimated/actual/not reported и показывают context, output, cache, TTFT/total и TPM.
- Missing provider usage больше не превращается в нулевые token counters.
- Context-control checks: 3/3 passed; полная регрессия: 31/31 tests passed.
- Manual smoke `0/2/6/20`, context off, edit/restart и provider-reported counters: `BLOCKED` до интерактивного запуска и разрешения live Groq calls.

### Блок 7 — Model-specific parameters и явный fallback

Статус блока: `IN_PROGRESS` — implementation и mocked policy checks готовы; live model matrix заблокирована решением 9

Предлагаемый commit: `fix: make Groq model behavior explicit`

Scope:

1. Вынести совместимые параметры в model capability map без универсальной provider architecture.
2. GPT-OSS:
   - сохранить текущий `low`;
   - сохранить hidden reasoning;
   - менять reasoning mode только после A/B.
3. Qwen:
   - использовать только официально совместимые `none/default`;
   - скрыть reasoning совместимым способом;
   - использовать официально рекомендованные sampling-настройки выбранного mode после eval.
4. Исключить silent cross-family fallback либо потребовать явное пользовательское разрешение.
5. Для Vision отдельно перейти с deprecated `max_tokens` на подтверждённый параметр и проверить finish/usage.

Acceptance:

1. Невалидные cross-model параметры невозможно собрать.
2. Actual model всегда видим.
3. Нет скрытого перехода на более дорогую Preview model.
4. Reasoning content не попадает в ответ.
5. Vision matrix проходит.

Manual smoke:

- GPT-OSS 120B, 20B, разрешённый Qwen text и Qwen vision.

Regression:

- Default 120B и low reasoning не меняются в первом commit этого блока.
- STT не затрагивается.

Rollback:

- Capability/parameter builder и fallback policy находятся в одном изолированном commit или двух последовательных commits.

Evidence:

- Официальные Groq model/reasoning/API/vision docs повторно проверены 2026-07-24.
- Capability map разделяет GPT-OSS и Qwen; неизвестный model ID нельзя превратить в request payload.
- GPT-OSS сохраняет `reasoning_effort: low` и `include_reasoning: false`.
- Qwen text доступен только как явный Preview choice, использует non-thinking `none` и hidden reasoning.
- Automatic fallback ограничен `GPT-OSS 120B ↔ 20B`; Qwen не участвует в fallback.
- Vision использует отдельный builder и `max_completion_tokens` вместо deprecated `max_tokens`.
- Model-policy checks: 3/3 passed; полная регрессия: 34/34 tests passed.
- Live GPT-OSS 120B/20B, Qwen text и Qwen vision matrix: `BLOCKED` до отдельного разрешения live calls.

### Блок 8 — Детерминированные multiple-key attempts

Статус блока: `IN_PROGRESS` — coordinator и delayed-order checks готовы; live parallel-role smoke заблокирован решением 9

Предлагаемый commit: `fix: make Groq key activation deterministic`

Scope:

1. Сохранить ограниченные attempts.
2. Сохранить правило 429 → следующий key slot.
3. Не вращать ключи на 401/403/413/5xx/network.
4. Не позволить более позднему completion старого/другого role перезаписать active key без ownership rule.
5. Явно сообщить, что keys одной organization не увеличивают org quota.

Acceptance:

1. K1–K5 проходят с delayed out-of-order responses.
2. Success activation выполняется один раз.
3. Нет wrap-around и бесконечных попыток.
4. Session abort запрещает позднюю activation.

Manual smoke:

- Typed + screenshot + voice с искусственно задержанными ответами.

Regression:

- Обычная single-key конфигурация не меняется.
- Role-specific request payload не унифицируется ошибочно.

Rollback:

- Отдельный key coordination commit.

Evidence:

- Text, STT и Vision используют один session-scoped activation coordinator.
- Каждый успешный request может активировать ключ не более одного раза.
- Поздний completion более старого request не перезаписывает key, активированный более новым request.
- Stop/Restart ownership запрещает позднюю activation, coordinator сбрасывается на новом Start.
- Retry сохраняется только для 429, без wrap-around; 401/403/404/413/5xx/network не вращают ключи.
- UI объясняет, что ключи одной Groq organization разделяют общую quota.
- Key-coordination checks: 3/3 passed; полная регрессия: 37/37 tests passed.
- Live delayed Text/STT/Vision parallel smoke: `BLOCKED` до отдельного разрешения live calls.

### Блок 9 — Длинные и быстрые audio questions

Статус блока: `BLOCKED` — текущая 30-секундная policy сохранена; изменение запрещено решением 8 до live A5–A7

Предлагаемый commit: `fix: harden hosted speech turn boundaries`

Scope:

1. Сначала измерить A5–A7 на текущих значениях.
2. После решения пользователя настроить max utterance/manual semantics.
3. Ограничить queue depth/age либо явно показать backlog.
4. Проверить ordering/backpressure renderer audio callbacks.
5. Не заменять `ScriptProcessorNode` только ради модернизации, если тест не показывает проблему.

Acceptance:

1. 45–60 секунд речи обрабатываются согласно выбранной policy.
2. Два близких вопроса не создают неожиданных дублей/перестановок.
3. Silence не запускает LLM.
4. Toggle/manual flush не теряет последний segment.
5. Stop/restart ownership из блока 2 соблюдается.

Manual smoke:

- Mic и system audio, разные языки, silence, rapid speech, long speech.

Regression:

- Short-question latency не ухудшается за пределами принятого порога.

Rollback:

- Только audio boundary/queue commit.

Evidence:

- Текущий segmenter подтверждён кодом: `silenceEndMs: 800`, `maxUtteranceMs: 30000`, FIFO audio → STT → text.
- Manual/toggle flush сохраняет последний распознанный segment и уже покрыт automated contract.
- Без записей 45–60 секунд и двух близких реальных вопросов нельзя доказательно выбрать новый timeout, split или backlog policy.
- Application code блока 9 намеренно не изменён до A5–A7.

### Блок 10 — Packaged Windows Groq release gate

Статус блока: `BLOCKED` — automated/package gates зелёные; live Groq matrix требует отдельного разрешения бюджета

Предлагаемый commit: `test: complete packaged Groq release evidence`

Scope:

1. Запустить полный matrix T/C/A/S/K/V.
2. Проверить packaged Windows build, а не только dev mode.
3. Зафиксировать model IDs, дату, account plan и observed limits.
4. Записать latency, completeness, factual/context score и actual usage.
5. Обновить задачи 013, 015, 016 и 018 только по реально закрытым критериям.

Acceptance:

1. Все automated tests зелёные.
2. Нет P0/P1 regression.
3. Нет reasoning leak, ghost turns и silent model switch.
4. Follow-up через два вопроса проходит.
5. Не зафиксировано ухудшение factual/context score.
6. Token/cache показатели подписаны как estimated или actual.
7. Каждый выполненный блок уже был отдельным рабочим commit.

Rollback:

- Этот блок не меняет runtime; при провале откатывается конкретный предыдущий блок.

## Предлагаемый порядок commits

1. Baseline tests.
2. Session ownership/abort.
3. Incomplete/partial turn consistency.
4. Prompt cleanup.
5. Usage/cache observability.
6. Context controls/diagnostics.
7. Model-specific parameters.
8. Explicit fallback policy.
9. Deterministic key activation.
10. Long-question audio behavior.
11. Packaged Windows release evidence.

После каждого commit:

1. `node --test "test/*.test.js"`.
2. Relevant mocked integration checks.
3. Минимальный manual smoke затронутой роли.
4. `npx prettier --write` только на изменённых файлах или безопасном scope.
5. Проверка diff.
6. Отдельный commit и push.

## Подтверждённые решения пользователя

### Решение 1 — Text fallback

Рекомендация: fallback только внутри семейства GPT-OSS (`120b ↔ 20b`) и без silent Qwen fallback. Qwen оставить явно выбираемым text model и отдельной vision model.

Подтверждено: `same-family only`; Qwen не используется как automatic fallback.

### Решение 2 — Reasoning

Рекомендация: на первом этапе сохранить GPT-OSS `low`. Добавлять `Fast/Balanced/Deep` только после baseline A/B.

Подтверждено: сохранить фиксированный GPT-OSS `low`; quality mode рассматривать только после baseline A/B.

### Решение 3 — Context count

Рекомендация: сохранить default 6 до eval. Вывести настройку, но не уменьшать её ради экономии.

Подтверждено: оставить default 6 до результатов eval.

### Решение 4 — Truncated answer

Рекомендация: сохранить видимый partial answer как `incomplete` и передавать его следующему запросу только с явным incomplete marker. Так модель понимает, что ответ оборван, а пользователь и модель не расходятся.

Подтверждено: marked incomplete передаётся в следующий context с явным marker.

### Решение 5 — Partial stream failure

Рекомендация: сохранить видимый fragment в History как failed/partial, но не считать его обычным завершённым ответом. Для следующего context применять ту же выбранную incomplete policy.

Подтверждено.

### Решение 6 — Qwen text

Рекомендация: оставить доступным только как явный Preview choice; default и automatic fallback не использовать.

Подтверждено.

### Решение 7 — Diagnostics

Рекомендация: сначала хранить metrics только в памяти активной сессии и показывать компактный diagnostics block. Не создавать долгосрочную аналитику без отдельного решения о privacy/retention.

Подтверждено.

### Решение 8 — Long audio

Рекомендация: не угадывать новый тайм-аут. Сначала выполнить A5–A7; если проблема подтверждается, использовать явный manual/toggle path для длинной речи или согласованный новый limit.

Подтверждено.

### Решение 9 — Live evaluation budget

Статус: `BLOCKED` до отдельного разрешения пользователя на реальные Groq calls.

Нужно определить перед live A/B:

1. Можно ли выполнять серию реальных Groq A/B calls.
2. Максимальное число повторов/дневной token budget.
3. Можно ли сохранять обезличенные usage/latency results в task evidence.

## Обновление приоритета от 2026-07-24 — Online Groq first

### Подтверждённое направление

1. Основной и ближайший приоритет — качество работы с бесплатными hosted-моделями Groq.
2. Локальные LLM, `llama.cpp`, `whisper.cpp`, Ollama replacement и native runtime исключены из текущего этапа.
3. Не добавлять новый LLM-провайдер, пока текущие модели Groq не сравнены на одинаковых реальных сценариях.
4. Не менять default model, reasoning, context count, sampling и fallback на основании общих benchmark или субъективного впечатления.
5. Полный аудит приложения и исключённые идеи сохранены в `tasks/029-deferred-application-audit.md`.

### Актуальная capability matrix

Проверено по официальной документации Groq 2026-07-24.

| Роль | Модель | Статус и назначение | Текущее решение |
|---|---|---|---|
| Hosted Text / качество | `openai/gpt-oss-120b` | Text, reasoning, около 500 tps, context 131072 | Default |
| Hosted Text / скорость | `openai/gpt-oss-20b` | Text, reasoning, около 1000 tps, context 131072 | Явный выбор и same-family fallback |
| Hosted Text / эксперимент | `qwen/qwen3.6-27b` | Preview, text + images, reasoning, context 131072 | Только явный выбор |
| Hosted Vision | `qwen/qwen3.6-27b` | До 3 изображений, max output 16384 | Отдельная vision role |
| Hosted STT | `whisper-large-v3-turbo` | Multilingual transcription | Отдельная STT role |

Источники:

- https://console.groq.com/docs/model/openai/gpt-oss-120b
- https://console.groq.com/docs/model/openai/gpt-oss-20b
- https://console.groq.com/docs/model/qwen/qwen3.6-27b
- https://console.groq.com/docs/speech-to-text
- https://console.groq.com/docs/rate-limits
- https://console.groq.com/docs/prompt-caching

### Что сейчас самое необходимое

Первый следующий этап — не новый prompt и не новая модель, а ограниченный live baseline. Без него нельзя доказательно ответить:

1. В каких сценариях GPT-OSS 120B действительно лучше 20B.
2. Даёт ли Qwen text полезный прирост на coding/system-design вопросах или только повышает вариативность.
3. Где длинный ответ вызван моделью, а где текущим profile prompt.
4. Сколько фактических tokens и cache hits возвращает streamed Groq response.
5. Как ведёт себя контекст через два связанных follow-up.
6. Каковы реальные TTFT, полная latency и completeness в приложении, а не в изолированном API benchmark.

### Предлагаемый минимальный live batch

Статус: `BLOCKED` до явного разрешения пользователя на Groq calls и сохранение обезличенных результатов.

Максимальный первый прогон:

1. 6 одиночных сценариев × 3 text models = 18 requests.
2. Одна трёхходовая context chain × 3 text models = 9 requests.
3. 3 заранее подготовленных audio clips через Whisper Turbo = 3 requests.
4. 2 screenshot cases через Qwen Vision = 2 requests.
5. Итого не более 32 API requests и не более 70000 total tokens.
6. Повторы в первом прогоне не выполнять.
7. Запросы выполнять последовательно, соблюдать фактические rate-limit headers и остановиться до 95% любого доступного лимита.

Набор text-сценариев:

1. Короткий Java/Spring technical question.
2. Вопрос с неоднозначным или недостаточным контекстом.
3. System-design question с trade-offs.
4. Coding/debugging scenario.
5. Behavioral/HR question.
6. Вопрос, требующий короткого и прямого ответа.
7. Context chain: описание системы → уточнение → изменение требования.

Для каждого ответа сохраняются только:

1. Model ID и зафиксированная конфигурация.
2. TTFT и полная latency.
3. `finish_reason`.
4. Provider-reported prompt/completion/total/cached tokens, если они реально присутствуют.
5. Оценки 0–5: correctness, relevance, completeness, conciseness, context fidelity.
6. Флаги hallucination, incomplete, wrong language и context loss.
7. Текст запросов и ответов не сохраняется в telemetry; эталонные тестовые формулировки хранятся отдельно без пользовательских данных.

### Acceptance для baseline

1. Все три text models получают одинаковые system/profile instructions и одинаковые тестовые вопросы.
2. Qwen не участвует в automatic fallback.
3. Follow-up через два вопроса проверен для каждой модели.
4. Отдельно записаны estimated и provider-reported tokens.
5. Rate limits читаются из response headers; публичные Free Plan числа не используются как runtime truth.
6. Нет reasoning leak.
7. Видимый финальный ответ совпадает с History и последующим context.
8. Результат позволяет выбрать конкретный следующий кодовый блок, а не заканчивается общим выводом «нужно улучшить prompt».

### Следующий кодовый блок после baseline

Выбирается только по результату измерений:

1. Если ответы избыточны, но фактически верны — model-specific length/response-discipline A/B.
2. Если теряется follow-up context — context/request lifecycle fix.
3. Если качество 20B не уступает 120B в выбранных сценариях — явный пользовательский режим `Fast`, без автоматического роутинга.
4. Если Qwen выигрывает только в vision — сохранить его только в vision role.
5. Если latency формируется до text request — исправлять STT/queue/turn boundary, а не менять LLM.
6. Если cache hits отсутствуют — проверить точное совпадение статического prefix и streamed usage, не сокращая полезный context вслепую.

### Регрессионные границы

1. Default остаётся `openai/gpt-oss-120b` до доказательного A/B.
2. GPT-OSS fallback остаётся same-family only.
3. Qwen остаётся Preview и только explicit choice.
4. Context default остаётся 6 полных пар.
5. GPT-OSS reasoning остаётся `low`, hidden.
6. Prompt caching не должен менять качество ответа; статическая часть остаётся первой.
7. Уменьшение tokens не считается успехом при падении factual/context score.

## Definition of Done

Task 027 может стать `DONE` только когда:

1. Пользователь подтвердил plan и открытые product decisions.
2. Выполнены все выбранные блоки либо явно записано, какие блоки исключены пользователем.
3. Каждый блок прошёл собственные automated и manual checks.
4. Полный packaged Windows matrix пройден.
5. Follow-up context через два вопроса подтверждён live.
6. Нет ghost turns, silent cross-family fallback и расхождения UI/History/context.
7. Prompt changes не ухудшили factual/context rubric.
8. Token/cache данные честно разделены на estimated и actual.
9. Все выполненные изменения разбиты на отдельные commits и pushed.
10. Task 013/015/016/018 обновлены по фактически подтверждённым критериям.
