# 016 — Лимиты AI Profile и видимость активного контекста

Статус: `IN_PROGRESS`

## Нормализованный промпт пользователя

Проанализировать и спроектировать безопасные ограничения для полей AI Profile. Ограничения должны экономить контекст Groq, не допускать повторения ошибки `413 TPM`, оставлять достаточно места для вопроса, истории и полноценного ответа и не обрезать пользовательские данные без предупреждения.

Дополнительно:

1. Определить рекомендуемый и абсолютный лимит каждого поля.
2. Объяснить, как писать короткие и однозначные инструкции; решить, на каком языке хранить управляющие prompt-инструкции.
3. Показывать пользователю размер отдельных полей и итогового compiled prompt.
4. Во время активной сессии явно показывать, какой профиль и какой зафиксированный контекст реально использует модель.
5. Не реализовывать переключение профиля во время активной сессии сейчас; оформить его отдельной будущей задачей.
6. До подтверждения плана не изменять application code.

## Почему ограничения нужны

- В зафиксированном сбое Groq запросил `8 439` токенов при TPM-лимите `8 000`.
- Runtime резервировал `4 096` completion tokens, поэтому оценочный input составлял `8 439 - 4 096 = 4 343` токена.
- Проблемный compiled prompt имел `18 507` символов, включая `15 484` символа в `About you`.
- Для этого преимущественно английского текста получилось около `4,26` символа на токен. Это нельзя переносить на русский текст, код, JSON и Unicode: они могут требовать заметно больше токенов на то же число символов.
- Поэтому счётчик символов — понятный UX-индикатор, но реальным предохранителем должен быть консервативный расчёт токенов всего outgoing request.

## Аудит присланного UI-референса

Присланный `pasted-text.txt` используется только как визуальный и структурный референс экрана `AI Configuration`: компоновка, вкладки, карточки, ширина, вертикальная иерархия и размеры полей. Тексты prompt из него не являются шаблоном для копирования. Полный HTML также позволяет измерить фактические объёмы заполненных полей:

| Поле референса               | Заполнено символов |
| ---------------------------- | -----------------: |
| System Prompt (User Context) |              1 226 |
| Intro Instruction            |              1 176 |
| Context Instruction          |              1 757 |
| Search Focus                 |                315 |
| Length instruction           |                669 |
| Format instruction           |                488 |

Это полезный benchmark, но не доказательство максимальных ограничений: HTML не содержит `maxlength`, а числа показывают только длину текущих значений. При этом они хорошо укладываются в рекомендуемые soft limits этой задачи.

Что стоит перенять из референса:

- один центральный контейнер шириной до `900px`;
- полноширинные многострочные поля в вертикальном потоке;
- визуальное разделение `Identity Config`, `Models & Fallback`, `API Keys`;
- отдельные карточки и короткие описательные labels;
- компактные Length/Format selectors вместо свободных overrides.

Что переносить не следует:

- `System Prompt` смешивает факты кандидата и инструкции поведения;
- `Intro Instruction` одновременно задаёт роль, язык, длину, структуру и правила уточнений;
- `Context Instruction` содержит большой Java-specific checklist и повторяет требования длины;
- отдельные editable Length/Format тексты возвращают уже удалённые overrides;
- `Search Focus` бесполезен, пока runtime не имеет реального search tool;
- `Memory (Messages)` нельзя использовать как единственный бюджет: три длинных сообщения могут быть больше двадцати коротких, поэтому нужен token-based history limit.

Вывод: референс подтверждает выбранную одноколоночную компоновку и примерные нормальные размеры контента, но его prompt-разделение нельзя копировать буквально. В нашей версии ответственность секций должна оставаться ортогональной.

## Рекомендуемые лимиты

Soft limit показывает предупреждение, но не удаляет данные. Hard limit блокирует сохранение профиля как валидного, импорт и запуск hosted-запроса до исправления. Существующий oversized-текст остаётся доступен для редактирования и экспорта.

| Поле                | Рекомендуется до | Абсолютный максимум | Назначение                                        |
| ------------------- | ---------------: | ------------------: | ------------------------------------------------- |
| Name                |               60 |                 120 | Только UI; не включается в prompt                 |
| Description         |              240 |                 500 | Только UI; не включается в prompt                 |
| About you           |            4 500 |               7 000 | Проверенные факты, опыт, проекты и ограничения    |
| Assistant role      |            1 200 |               2 500 | Роль, ситуация и желаемый результат               |
| Answer instructions |            2 000 |               4 000 | Что раскрывать и как работать с неопределённостью |
| Response style      |              600 |               1 200 | Только тон и голос ответа                         |

Индивидуальные максимумы не являются суммируемой квотой. Дополнительно проверяется итоговый compiled prompt:

- предупреждение: больше `7 000` символов **или** примерно `2 300` input tokens;
- запрет hosted-запроса: больше `9 000` символов **или** примерно `3 000` input tokens;
- целевой общий запрос Groq: не больше `95%` доступного TPM;
- рекомендуемый максимальный completion: подтверждённые ранее `2 048` токенов вместо фиксированных `4 096`; значение динамически уменьшается при нехватке TPM;
- вопрос и сохранённая история: ориентир до `1 800` оценочных токенов;
- минимальный полезный completion: `1 024`; если места меньше, сначала удалить старые полные пары user/assistant, а если этого недостаточно — не отправлять запрос и показать точные значения.

Консервативная dependency-free оценка до появления точного tokenizer:

```text
ceil(asciiCodePoints / 3 + cyrillicCodePoints / 2 + otherCodePoints)
+ 12 tokens per message
+ 32 tokens request overhead
```

Фактические Groq response headers остаются авторитетным источником remaining/reset quota.

## Язык и архитектура prompt

Все application-owned и built-in prompt-инструкции переводятся на английский: управляющие заголовки, application boundary, встроенные профили и presets. Это единый компактный control language для доступных моделей. Пользовательские поля разрешены на любом языке; автоматически переводить импортированные или вручную введённые факты нельзя без отдельного подтверждения, потому что перевод может изменить смысл.

Подтверждённое решение пользователя: output language определяется **только** настройкой `Speech Language`, зафиксированной при `Start`. Язык вопроса не анализируется и не может автоматически изменить язык ответа.

Compiler добавляет одну общую инструкцию:

`Always reply in the configured response language: {LANGUAGE_NAME}. Do not infer or change the response language based on the user's message. Keep code, identifiers, class names, API and product names, acronyms, and quoted text in their conventional original form.`

Примеры обязательного поведения:

- `Speech Language = Russian`: `Расскажи про HashMap`, `What is HashMap?` и `HashMap?` → ответ на русском.
- `Speech Language = English`: те же вопросы → ответ на английском.
- `Speech Language = Polish`: те же вопросы → ответ на польском.
- `HashMap`, `Spring Boot`, код, API names и другие technical identifiers сохраняют обычное оригинальное написание независимо от языка ответа.
- Просьба внутри вопроса `answer in English` не переопределяет выбранный `Speech Language`; настройка является единственным источником истины.

Порядок секций:

1. `INSTRUCTION BOUNDARY`
2. `ASSISTANT ROLE`
3. `ABOUT YOU (REFERENCE FACTS)`
4. `ANSWER INSTRUCTIONS`
5. `RESPONSE STYLE`
6. `LANGUAGE`
7. `LENGTH`
8. `FORMAT`

Правила заполнения:

- `About you`: только факты; без `act as`, `always`, требований длины и Markdown.
- `Assistant role`: одна роль, ситуация и результат; без CV, формата и checklist.
- `Answer instructions`: требования к содержанию, релевантности и неопределённости; без тона и количества абзацев.
- `Response style`: только тон/голос; без предметных требований, длины и разметки.
- `Length` и `Format`: единственные источники требований объёма и оформления.
- Короткие imperative bullets предпочтительнее длинных примеров. Не повторять одну инструкцию в нескольких секциях.
- Preview предупреждает о вероятных конфликтах, но не переписывает и не удаляет пользовательский текст автоматически.

## Активный профиль во время работы

Текущее поведение фактически фиксирует compiled prompt при старте, но UI продолжает показывать mutable `selectedProfile`. Custom profile может отображаться как `Session`, а выбранное имя — разойтись с реально активным snapshot.

Минимальное решение текущей задачи:

- main process возвращает после успешного старта безопасный snapshot `{ sessionId, profile: { id, name }, promptSize, promptHash }` без полного приватного контекста;
- UI хранит отдельный `activeSessionProfile`, не связанный с редактируемой настройкой `selectedProfile`;
- live bar показывает `Profile: <name>` и `Context locked at session start · <size> chars`;
- пояснение сообщает: `Changes apply to the next session`;
- failed start не устанавливает snapshot, close его очищает;
- Groq и Local сохраняют одинаковую session metadata; profile object не должен случайно попадать в history;
- в активном overlay нет переключателя профиля и полного текста контекста.

## План реализации после подтверждения

1. `TODO` Вынести field/compiled limits и консервативный estimator в чистые функции.
2. `TODO` Удалить silent truncation пользовательских prompt-полей из strict save/import; возвращать все ошибки валидации вместе.
3. `TODO` Добавить counters, soft warnings, hard errors и always-visible compiled summary.
4. `TODO` Сохранить oversized legacy profiles без потери данных, но помечать их `Over limit` и блокировать hosted send.
5. `TODO` Очистить built-in v2 prompts от legacy-примеров, повторов и конфликтующих short/Markdown правил.
6. `TODO` Перевести application-owned и built-in prompt-инструкции на английский; пользовательские custom/imported поля не переводить автоматически.
7. `DONE` Добавить секцию `LANGUAGE`, скомпилированную из frozen `Speech Language`; не выполнять language detection по вопросу; сделать presets Length/Format ортогональными.
8. `DONE` Реализовать общий Groq request budget: динамический completion до `2 048`, history trim полными парами и блокировку ниже `1 024` completion.
9. `IN_PROGRESS` Возвращать resolved profile snapshot при старте и показывать реальный активный профиль в live UI. Имя frozen-профиля уже отображается; безопасные size/hash metadata ещё не добавлены.
10. `DONE` Унифицировать Groq/Local session metadata.
11. `IN_PROGRESS` Dependency-free unit/regression tests для принудительного configured language готовы; ручной Groq smoke новой сборки ожидает.

## Критерии приёмки

- Ни сохранение, ни импорт, ни миграция не обрезают prompt незаметно.
- Каждый counter различает normal/soft/hard состояния.
- Русский текст оценивается консервативнее английского одинаковой длины.
- Итоговый gate проверяет и символы, и оценочные токены.
- Outgoing Groq request целится максимум в `95%` доступного TPM.
- Текущий вопрос никогда не удаляется; history сокращается только старыми полными парами.
- Пользователь видит точное имя profile snapshot, реально активного в session.
- Изменение профиля в настройках не меняет активный label/context до новой сессии.
- Groq и Local сохраняют одинаковую форму profile metadata.
- Регрессия `8 439 > 8 000` покрыта тестом.
- Русский `Speech Language` всегда даёт русский ответ, включая полный английский вопрос; английский всегда даёт английский.
- Technical identifiers, code и API names не меняют configured response language и сохраняют оригинальное написание.

## Требуется подтверждение пользователя

1. Утвердить таблицу soft/hard limits и общий compiled gate `7 000/9 000 chars`, `2 300/3 000 estimated tokens`.
2. Решено в task `013`: максимум completion для Groq Free Plan — `2 048` с динамическим уменьшением при нехватке TPM.
3. Решено: `Speech Language` — единственный источник output language; language detection по вопросу отсутствует.
4. Утвердить English для compiler-owned instructions при сохранении любого языка в пользовательских полях.
5. Решить, нужно ли один раз автоматически переводить уже сохранённые custom profiles с русского на английский, либо переводить только наши built-in prompts, оставив пользовательские данные без изменений.

## Результат первого ручного microphone smoke

Наблюдения пользователя:

- при видимом `Speech Language = English (US)` фраза `nice to meet you` получила русский ответ;
- AI Customization показывал `Job Interview`, а active session и History — `profile_senior_java_interview` / `Senior Java Interview`;
- History отображает технический profile ID с подчёркиваниями вместо имени.

Фактические причины:

- сохранённое значение `preferences.json` на момент диагностики — `selectedLanguage: ru-RU`; Groq корректно заморозил именно его при Start, поэтому русский ответ не является language detection по вопросу;
- renderer запускает Groq только с profile ID, а main process повторно читает язык из storage; видимое состояние UI и фактический snapshot могут разойтись при несохранённом/позднем изменении;
- History session сохраняет только `profile` ID; `HistoryView.getProfileNames()` знает лишь старые built-in IDs и поэтому показывает custom ID как текст;
- active session должна оставаться frozen, а AI Customization отражает профиль следующей сессии; сейчас UI не объясняет эту разницу.

План после подтверждения:

12. `DONE` Передавать выбранный UI language в `initializeGroq` и замораживать его вместе с profile snapshot; storage остаётся persistence, но не может незаметно переопределить видимое значение при Start.
13. `DONE` Возвращать из Groq start `{ profile: { id, name }, language, promptCharacters }` и показывать `Active profile`/`Answer language` отдельно от настроек следующей сессии.
14. `DONE` Сохранять в History безопасные `profileName` и `language`; отображать имя snapshot, оставляя ID только fallback для старых записей.
15. `DONE` Подписать выбор AI Customization как профиль следующей сессии и добавить пояснение `Changes apply after a new Start`.
16. `DONE` Добавить проверки `English UI → English frozen prompt`, custom profile ID/name history mapping и рассинхронизации active/next profile.

Критерии дополнительной приёмки:

- Start использует ровно язык, видимый пользователю в момент нажатия.
- `English (US)` компилирует `Always reply in English` и передаёт Whisper hint `en`.
- Live bar показывает snapshot активной сессии; изменение AI Customization не переименовывает уже активную сессию.
- Новые записи History показывают `Senior Java Interview`, а не `profile_senior_java_interview`.
- Старые записи без `profileName` продолжают открываться.

Результат проверки реализации:

- `node test/groq.test.js`, `audio.test.js`, `profile.test.js`, `storage.test.js`, `vision.test.js` — PASS.
- `node --check` всех изменённых runtime/UI файлов — PASS.
- `git diff --check` — PASS.
- Фактическое сохранённое значение `selectedLanguage` исправлено на подтверждённое `en-US`; profile `interview`, audio `mic_only`, provider `byok` и три Groq keys сохранены без изменения.
- Ручная проверка новой packaged-сборки остаётся обязательной перед переводом всей задачи `016` в `DONE`, поскольку пункты 1–6 по limits/counters всё ещё не реализованы.
