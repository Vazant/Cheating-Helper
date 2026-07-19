# 015 — AI Profiles: UX и аудит compiled prompt

Статус: `IN_PROGRESS`

## Нормализованный промпт пользователя

Провести полный UX-аудит экрана `AI Profiles / AI Customization` и аудит генерируемого system prompt. Переработать экран так, чтобы создание и редактирование профиля было понятным без знания prompt engineering.

Необходимо:

1. Найти причины неудобного расположения, разной ширины элементов, тесных двухколоночных textarea и взаимного наложения блоков внутри `Advanced`.
2. Предложить одноколоночную визуальную иерархию с полноширинными полями, предсказуемыми размерами, понятными секциями и адаптивным поведением.
3. Для каждого поля показать понятное название, объяснение влияния на ответ, пример содержимого и, где полезно, индикатор объёма.
4. Убрать или скрыть параметры, назначение которых непонятно либо которые не работают в текущем runtime.
5. Проанализировать `Expertise / Coverage`, `Advanced`, overrides, `Search Policy` и preview: нужны ли они, должны ли быть автоматизированы или удалены.
6. Проверить порядок, непротиворечивость и размер compiled prompt, риск лишнего контекста, повторов и конфликтующих инструкций.
7. Убедиться, что профиль помогает модели давать длинные и правильные ответы, но не заставляет механически перечислять нерелевантные пункты.
8. Составить план, критерии приёмки и проверки. Не менять application code до подтверждения решений пользователем.

## Причины текущих проблем

- `AICustomizeView.js:23` задаёт две равные колонки. Большие смысловые поля получают половину ширины.
- Все textarea имеют одинаковый `min-height: 110px`, хотя их назначение различается.
- `sharedPageStyles.js` задаёт `.form-group` как горизонтальный flex и `.control` шириной `200px`; локальный grid не изолирован от этих правил.
- Внутренние `.form-group` блока `<details>` не имеют отдельного вертикального layout и промежутков — причина overlap в `Advanced`.
- Названия отражают schema, а не задачу пользователя. Не объяснено отличие фактов, роли и правил ответа.
- Семь coverage checkbox показывают внутренний механизм compiler без объяснения влияния.
- `Search Policy` не попадает в Groq runtime: compiler вызывается с `false`. Поле сейчас ничего не меняет.
- Overrides дублируют presets и могут конфликтовать с ними. Bold-heavy override уже вызывал плохой формат ответа.

## Размер compiled prompt

`chars / 4` — только грубая оценка токенов.

| Профиль | Символы | Слова | Примерно токенов | Coverage |
|---|---:|---:|---:|---:|
| Job Interview | 2 975 | 436 | 744 | 0 |
| Sales | 2 166 | 326 | 542 | 0 |
| Meeting | 2 025 | 304 | 507 | 0 |
| Presentation | 2 231 | 327 | 558 | 0 |
| Negotiation | 2 272 | 340 | 568 | 0 |
| Exam | 2 183 | 349 | 546 | 0 |
| Senior Java Interview | 4 184 | 571 | 1 046 | 7 |

Вывод:

- Java-профиль не слишком велик для контекста 131K.
- Для Free Plan важнее суммарный TPM: system около 1K + история + вопрос + completion до 4096. Длинная история может приблизить запрос к 8K TPM.
- Главный риск — повторяемость и конкуренция инструкций, а не абсолютный размер.
- Built-in profiles содержат длинные примеры внутри Answer Rules; их можно сократить.

## Рекомендуемый UX v2

Один вертикальный поток шириной примерно 760–900 px. Все многострочные поля полноширинные.

1. `Profile header`: selector, New, Duplicate, Import, меню More для Export/Delete. Выноска: профиль задаёт факты и способ ответа; модель/API выбираются отдельно.
2. `About this profile`: Name и Description — компактные поля, рядом только на широком окне.
3. `Your background`: `User Context` → `About you / Facts the assistant may use`, высота 240–320 px, help text, пример, символы и примерные токены.
4. `How the assistant should answer`: `Persona` → `Assistant role` (120–160 px); `Answer Rules` → `Answer instructions` (180–240 px). Пояснить: факты находятся выше, правила — здесь.
5. `Response preferences`: Length как `Automatic / Short / Full / Deep`; Format как `Natural speech / Structured / Plain text`; короткий Response Style. Каждый preset получает описание.
6. `Specialization`: полностью убрать отдельную систему `Expertise / Coverage`. Тематика определяется самим профилем через `Assistant role`, `About you` и `Answer instructions`. Java-правила остаются содержимым только профиля `Senior Java Interview`; другие профили могут быть созданы для любого направления без изменения schema.
7. `Generated instructions`: preview свернуть, назвать `What will be sent to the AI`, показать размер и Copy.

## Что убрать

- `Search Policy` скрыть до появления реального search tool.
- `Length Override` и `Format Override` убрать из UI и active compiler — подтверждено пользователем.
- `Expertise / Coverage` убрать из UI, schema v2 и active compiler — подтверждено пользователем; отдельная Java-специализация в общей модели профиля не нужна.
- После этого блок `Advanced` не нужен.

## Compiled prompt v2

Порядок: application boundary → Assistant role → About you → Answer instructions → Response style → один Length preset → один Format preset.

Правила:

- Не компилировать пустые/неработающие секции.
- Не иметь одновременно preset и свободный override для одного поведения.
- Не повторять length/format в Persona и Answer Rules.
- Не использовать отдельную coverage-систему; предметная специализация задаётся текстом конкретного профиля.
- Preview и runtime используют один compiler.

## План после подтверждения

1. `DONE` Упростить schema/compiler: убрать overrides и coverage из active compilation; перенести полезные Java-правила в `Answer instructions` Java-профиля.
2. `DONE` Перестроить `AICustomizeView` в одноколоночный layout и изолировать от shared horizontal styles.
3. `DONE` Добавить секции, help text, примеры и счётчики.
4. `DONE` Убрать Search Policy и текущий Advanced UI.
5. `DONE` Свернуть preview, добавить описание, размер и Copy.
6. `DONE` Убрать повторяющиеся override/coverage/search instructions из compiled prompts.
7. `DONE` Обновить import/export migration для старых override/coverage.
8. `DONE` Обновить dependency-free тесты.
9. `TODO` Провести UI smoke на широком и узком окне.
10. `TODO` Провести Groq smoke: HashMap, Spring Boot, system design.
11. `DONE` Собрать новый EXE и записать hash.

## Результат реализации 2026-07-19

- Profile schema/compiled prompt обновлены до v2 без повышения общего `CONFIG_VERSION`.
- Coverage, Search Policy и overrides удалены из active schema/compiler; старые импортируемые поля безопасно игнорируются.
- AI Profiles UI перестроен в одноколоночный layout с полноширинными полями, пояснениями, примерами и счётчиками размера.
- Preview свёрнут и показывает точный размер итогового prompt; добавлена кнопка Copy.
- Senior Java compiled prompt уменьшен примерно с 1 046 до 821 токена по грубой оценке `chars / 4`.
- `node test/profile.test.js`, `node test/storage.test.js`, `node test/groq.test.js`, `node test/vision.test.js` — PASS.
- `node --check` изменённых JS-файлов — PASS.
- `npm.cmd run make` — PASS.
- Установщик: `out/make/squirrel.windows/x64/Cheating Daddy-0.7.0 Setup.exe`.
- SHA-256: `36F15F97D0B8B82EE534B88ED4AC8DF7DD20180350D4DE4F2036B7BD65DC0724`.
- Ручной UI smoke в реальном окне и Groq smoke остаются невыполненными; статус задачи остаётся `IN_PROGRESS`.

## Критерии приёмки

- Ни одно textarea не делит строку с другим textarea.
- Поля имеют разумные разные высоты и читаемы при изменении окна.
- Нет overlap, horizontal overflow и конфликтов shared/local CSS.
- Назначение каждого поля понятно без документации.
- В UI нет неработающих или дублирующих настроек.
- Prompt содержит одну инструкцию длины и одну формата.
- Общая schema не привязана к Java или другой предметной области.
- Preview и runtime совпадают.
- Размер prompt виден пользователю.
- Тесты, UI smoke и Electron make проходят.

## Вопросы для подтверждения

1. Решено: `Expertise / Coverage` полностью убрать; специализация живёт в обычных полях конкретного профиля.
2. Решено: `Length Override` и `Format Override` убрать из UI/active compiler, оставив presets.
3. Решено: `Search Policy` скрыть и убрать из active compiler, пока Groq runtime не получит search tool.
