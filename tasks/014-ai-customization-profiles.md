# 014 — AI Customization: профили вместо одного prompt

Статус: `IN_PROGRESS`

Подтверждено пользователем 2026-07-19: разбить монолитный prompt на отдельные поля; технические ответы должны быть длинными, полноценными и покрывать важные аспекты темы. Импортировать присланный JSON как `Senior Java Interview` без model IDs; модели оставить в общих AI Settings; built-in profiles оставить неизменяемыми шаблонами, редактирование выполняется через пользовательскую копию; для Java-профиля включить все семь coverage packs.

## Нормализованное требование

Заменить непонятную связку скрытого hardcoded Job Interview/Sales/Exam prompt и одного глобального `customPrompt` на явные именованные AI-профили. Пользователь должен отдельно настраивать факты о себе, роль ассистента, правила ответа, поиск, стиль, длину и формат; приложение собирает из них итоговый system prompt в предсказуемом порядке.

## Текущее состояние

- `src/components/views/AICustomizeView.js` показывает Profile и одно поле `Custom Instructions`.
- Значение сохраняется глобально как `preferences.customPrompt`, а не отдельно для каждого Profile.
- `src/utils/prompts.js` скрыто добавляет большие встроенные prompts для `interview`, `sales`, `meeting`, `presentation`, `negotiation`, `exam`.
- Пользователь не видит итоговую инструкцию и не понимает, какая часть отвечает за persona, длину или формат.
- Встроенные prompts содержат пересекающиеся требования Markdown/bold/short output, что уже вызвало плохое форматирование GPT-OSS.

## Разбор присланного JSON

Полезная структура:

1. `systemPrompt` — факты о кандидате, CV, проекты, ограничения и traps. В UI лучше назвать `User Context`, потому что это данные пользователя, а не системные правила приложения.
2. `intro` — роль/persona и точка зрения ответа.
3. `contextInstruction` — способ рассуждения, структура и правила использования контекста.
4. `searchFocus` — когда искать и когда не искать.
5. `length` + `lengthInstruction` — preset и его точные ограничения.
6. `format` + `formatInstruction` — preset и правила отображения.
7. `models` и `behavior` — это не prompt; хранить отдельными capability/settings блоками.

Что нельзя переносить как есть:

- Default 15–25 предложений и Deep 25–45 слишком велики для live teleprompter, расходуют completion budget и увеличивают вероятность обрыва.
- `Use **BOLD** for key terms` уже показал плохой результат на GPT-OSS; default должен быть plain text.
- Модели из файла нельзя импортировать без capability/availability validation: text, vision, STT и live audio — разные роли.
- `screenAnalysis` и `audioToText` в JSON содержат text-only модели; приложение не должно принимать такую конфигурацию.

## Рекомендуемая модель профиля v1

```json
{
  "id": "profile_senior_java_interview",
  "name": "Senior Java Interview",
  "description": "Senior Java backend interview",
  "prompt": {
    "userContext": "CV, projects, verified facts and constraints",
    "persona": "Role and point of view",
    "answerRules": "How to answer and use context",
    "searchPolicy": "When external search is allowed",
    "responseStyle": "Natural, direct, senior-level teleprompter speech",
    "length": "auto",
    "lengthInstruction": "Optional advanced override",
    "format": "plain",
    "formatInstruction": "Optional advanced override"
  },
  "behavior": {
    "conversationContextEnabled": true,
    "conversationContextCount": 6
  }
}
```

Models остаются в общих AI Settings, а не дублируются внутри v1-профиля. Это не позволяет импортированному JSON скрыто включить недоступную модель или другой provider.

## Предлагаемый UI

- Profile selector: встроенные шаблоны и пользовательские профили.
- `New`, `Duplicate`, `Rename`, `Delete`, `Import JSON`, `Export JSON`.
- Basic fields: Name, Description, User Context, Persona, Answer Rules.
- Response: Style, Length (`Auto / Concise / Standard / Detailed`), Format (`Plain / Teleprompter / Structured`).
- Advanced accordion: Search Policy, custom length instruction, custom format instruction.
- Read-only `Compiled Prompt Preview`, чтобы скрытые инструкции были видны.
- Built-in profile не редактировать напрямую: при первом изменении создавать копию.

## Подтверждённое направление длины

- `Auto`: простой нетехнический вопрос 4–6 предложений; техническое понятие 10–18; comparison/under-the-hood/system design 15–30.
- `Concise`: 4–6 предложений.
- `Standard`: 10–18 предложений.
- `Detailed`: 18–30 предложений с несколькими смысловыми блоками.

Формат по умолчанию — `Plain`: без декоративного bold; списки только когда они действительно улучшают ответ, code fence только для кода.

Количество предложений — ориентир, а не механическое требование. Completion должен завершать все релевантные блоки и не повторять материал ради длины.

## Модель для длинных технических ответов

- Recommended default: Groq `openai/gpt-oss-120b`. Он стабилен, имеет context 131K, max output 65K и подходит для general reasoning/multilingual technical answers.
- Selectable alternative: `qwen/qwen3.6-27b` для coding/agentic reasoning и vision; модель Preview, max output 32K.
- Обе модели имеют опубликованный Free Plan 30 RPM, 1K RPD, 8K TPM и 200K TPD. Поэтому обычный лимит запроса следует поднять до 4096 completion tokens, но prompt должен целиться примерно в 800–1800 видимых токенов для полноценного технического ответа.
- GPT-OSS использовать с `reasoning_effort: low` для обычной теории и `medium` только как явную будущую настройку `Deep reasoning`; скрыто повышать reasoning нельзя.
- Автоматически менять модель из-за типа Java-вопроса не нужно. Выбор остаётся видимым в AI Settings; 404/429 обрабатываются по уже подтверждённым правилам.

## Expertise / Coverage Packs

Codex skills нельзя подключить к packaged Electron runtime напрямую. Их практичный аналог — короткие встроенные coverage packs, выбираемые в AI-профиле:

- `Java Core & Collections`: contracts, internals, complexity, edge cases, mutability, concurrency, alternatives.
- `JVM & Concurrency`: memory model, happens-before, locks/atomics, pools, GC, diagnostics, failure modes.
- `Spring & Spring Boot`: lifecycle, IoC/proxies, auto-configuration, transactions, security, observability, production caveats.
- `JPA/Hibernate & SQL`: persistence context, fetching/N+1, transactions, locking, indexes, query plans.
- `REST & Microservices`: contracts, idempotency, resilience, consistency, messaging, observability, trade-offs.
- `Testing`: test pyramid, JUnit/Mockito, integration/Testcontainers, determinism and coverage boundaries.
- `System Design`: requirements, scale, data model, APIs, consistency, bottlenecks, reliability, security and trade-offs.

Pack — не база знаний и не гигантский prompt. Он добавляет компактный checklist только для релевантного вопроса. Модель должна выбрать применимые пункты, а не перечислять все механически.

### Пример coverage для HashMap

Ответ должен охватить: назначение и контракт `Map`; bucket array и вычисление индекса; `hashCode`/`equals`; collision chains и treeification; load factor/threshold/resize; average/worst-case complexity; null key/value; mutable keys; iteration order; отсутствие thread safety; `ConcurrentHashMap`/`LinkedHashMap`/`TreeMap`; практический пример и типичные ошибки.

Этот checklist хранится в pack, а не в User Context кандидата.

## Сборка итогового prompt

Порядок должен быть фиксированным и тестируемым:

1. Application safety/role boundary.
2. Persona.
3. User Context как недоверенные факты/данные.
4. Answer Rules.
5. Search Policy, только если search включён и реально поддерживается provider.
6. Response Style.
7. Length preset + optional override.
8. Format preset + optional override последним, чтобы не было конфликтов форматирования.

## Миграция

- Существующий `selectedProfile` сохранить.
- Текущий `customPrompt` однократно перенести в `userContext` мигрированного профиля; данные не терять.
- Встроенные hardcoded profiles преобразовать в read-only templates.
- При отсутствии новых данных продолжать читать старые preferences; после успешного сохранения писать schema version.
- Импорт проверяет schema/types/размеры и игнорирует `models` из чужого JSON до явного отдельного подтверждения.

## Мелкие работы

- [x] Разобрать присланный `profile_senior_java_interview.json`.
- [x] Проследить текущий `AICustomizeView` → storage → `getSystemPrompt`.
- [x] Составить минимальную schema v1 и порядок prompt compilation.
- [x] Подтвердить разбиение монолитного prompt и необходимость полноценных длинных ответов.
- [x] Проанализировать применимость Codex skills и спроектировать runtime coverage packs.
- [x] Выбрать recommended hosted text model и token budget по официальной документации Groq.
- [x] Получить оставшиеся ответы на вопросы ниже.
- [x] Добавить versioned profile storage и безопасную миграцию `customPrompt`.
- [x] Перенести built-in prompts в profile templates без изменения смысла.
- [x] Реализовать deterministic prompt compiler.
- [x] Перестроить AI Customization UI.
- [x] Добавить import/export с validation; модели из импортируемого файла не применять.
- [x] Добавить compiled prompt preview.
- [x] Покрыть migration, compilation, import validation и per-profile persistence тестами.
- [ ] Выполнить smoke test с Senior Java Interview profile.
- [x] Собрать новый EXE после завершения.

## Результат проверки 2026-07-19

- `node test/profile.test.js` — PASS.
- `node test/storage.test.js` — PASS.
- `node test/groq.test.js` — PASS.
- `node test/vision.test.js` — PASS.
- `node --check` для изменённых JS/CJS-файлов — PASS.
- `npm.cmd run make` — PASS.
- Установщик: `out/make/squirrel.windows/x64/Cheating Daddy-0.7.0 Setup.exe`, SHA-256 `1E62F988BAB5A0AFADA975068B4731328F38FC21AF3B5316199B52B39ED80E59`.
- Ручной live smoke с реальным Groq (`HashMap` и system-design вопрос) ещё не выполнен; поэтому общий статус остаётся `IN_PROGRESS`.

## Критерии приёмки

- Каждый профиль хранит собственные prompt fields; переключение не смешивает контекст.
- Пользователь видит все влияющие на ответ секции и compiled preview.
- Старый `customPrompt` не теряется при миграции.
- Plain/length defaults не противоречат друг другу.
- Импорт не может назначить text-only модель для vision/STT.
- Неизвестные/повреждённые JSON поля дают понятную ошибку и не портят существующие профили.
- Все автоматические проверки и Electron package/make проходят.

## Подтверждённые продуктовые решения

1. Schema/UI выше приняты; модели хранятся отдельно от профилей.
2. Default `Auto` выдаёт полноценный технический ответ 10–18 предложений, а сложный deep dive — до 30 без искусственных повторов.
3. Присланный JSON импортируется как новый `Senior Java Interview`: `systemPrompt` преобразуется в `User Context`, model IDs игнорируются.
4. Built-in Job Interview/Sales/Exam остаются шаблонами; редактирование создаёт пользовательскую копию.
5. Для импортируемого Senior Java profile включаются все семь coverage packs.

## Распределение реализации

- `profile-data`: versioned schema, нормализация/import/export, built-in templates и миграция legacy `customPrompt`.
- `profile-ui`: минимальный Lit UI для выбора/создания/копирования/удаления профилей, секций prompt, coverage packs и preview.
- `profile-quality`: read-only аудит runtime-потока, сценарии тестов и проверка, что profile models не вмешиваются в capability settings.
- главный агент: runtime-интеграция, объединение изменений, тесты, smoke и Electron make.
