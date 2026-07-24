# 026 — Контекст между сессиями и эффективность токенов

Статус: `BLOCKED` (нужно подтвердить продуктовые решения перед реализацией)

## Цель

Позволить пользователю осознанно продолжать контекст прошлых разговоров, снизить расход входных и выходных токенов без потери релевантности и завершить наиболее важные улучшения приложения без OmniRoute.

## Текущее состояние

- `src/utils/gemini.js:116-124` (`initializeNewSession`) при каждом Start создаёт новый ID и очищает `conversationHistory` и `groqConversationHistory`.
- `src/utils/gemini.js:1326-1347` при Hosted Start компилирует и замораживает profile/system prompt/model/behavior/language, затем всегда создаёт новую сессию.
- `src/utils/gemini.js:139-158` и `src/storage.js:636-655` сохраняют полную историю сессии на диск.
- `src/components/views/HistoryView.js:281-305` читает сохранённую сессию только для просмотра; Resume/Continue и runtime hydration отсутствуют.
- `src/utils/groq.js:97-125` уже ограничивает активный контекст последними полными парами и TPM-бюджетом, сохраняя текущий вопрос и резерв ответа.
- `src/utils/aiProfiles.js:93-96` хранит `conversationContextEnabled` и `conversationContextCount` (default 6, max 20), но `AICustomizeView` не показывает эти настройки.
- `src/utils/localai.js:220-235` использует отдельную политику последних 20 сообщений и не учитывает profile behavior.
- `src/components/views/AICustomizeView.js:293-300` показывает только грубую оценку prompt chars/4; история, текущий вопрос, резерв ответа, trimming и фактическое usage не видны.
- `src/utils/aiProfiles.js:46-47` молча обрезает слишком длинные поля вместо явной ошибки.
- `src/utils/gemini.js:150-151` логирует полный вопрос и ответ.
- Каждый turn пересылает через IPC и синхронно перезаписывает весь растущий массив истории (`gemini.js:153-158`, `renderer.js:828-835`, `storage.js:636-655`).
- До добавления Resume требуется validation: `sessionId` проходит через IPC и используется при построении пути (`src/index.js:279-295`, `src/storage.js:632-655`).

## Матрица ролей

| Роль | Текущая модель/система | Контекст |
|---|---|---|
| Hosted text | Groq `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.6-27b` | System prompt + последние N полных пар + текущий вопрос |
| Hosted STT | Groq `whisper-large-v3-turbo` | Только завершённый audio chunk → transcript; память LLM не применима |
| Hosted vision | Groq `qwen/qwen3.6-27b` Preview | Отдельный vision request; старые изображения повторно не отправляются |
| Local text | Ollama model | Отдельные последние 20 сообщений; требуется унификация политики |
| Local STT | Xenova Whisper | Только audio → transcript |
| Local vision | Ollama model с проверенной capability `vision` | Отдельный request |

## Измеренный baseline

Оценка текущего built-in system prompt:

| Профиль | Символы | Консервативная оценка токенов |
|---|---:|---:|
| Job Interview | 3207 | 1069 |
| Sales Call | 2398 | 800 |
| Business Meeting | 2257 | 753 |
| Presentation | 2463 | 821 |
| Negotiation | 2504 | 835 |
| Exam Assistant | 2544 | 848 |

По официальной документации Groq, GPT-OSS 20B/120B поддерживают автоматический prompt caching. Точное совпадение стабильного prefix может снизить стоимость cached input на 50% и уменьшить latency; caching не меняет качество inference. Поэтому system prompt должен оставаться стабильным и находиться перед динамическими сообщениями.

Источники:

- https://console.groq.com/docs/prompt-caching
- https://console.groq.com/docs/prompting
- https://console.groq.com/docs/rate-limits
- https://console.groq.com/docs/model/openai/gpt-oss-120b

## Рекомендуемая архитектура памяти

### Этап 1 — явное продолжение

- New session остаётся default.
- В History добавить `Continue`.
- Продолжение создаёт новую сессию с `parentSessionId`, не изменяя исходную.
- Разрешать ровно одну выбранную source session; не смешивать последние чаты автоматически.
- Восстановить проверенные полные Q/A пары в provider-format history и затем пропустить их через существующий request planner.
- Не восстанавливать старые screenshots/images.
- По умолчанию сохранять тот же profile snapshot и language.

### Этап 2 — компактная долговременная память

- Добавить отдельное редактируемое поле `Persistent memory` на профиль: стабильные факты, решения, цели и предпочтения.
- Добавить редактируемое `Session summary / carry-over notes`.
- В запрос передавать summary + последние 2–4 полные пары, а не полную старую сессию.
- Автоматическую LLM-суммаризацию не выполнять скрыто; это отдельная opt-in функция, поскольку она расходует токены и может исказить факты.
- Vector DB, embeddings и RAG пока не добавлять.

## Снижение токенов без потери качества

1. Сохранить стабильный system prefix для Groq prompt caching.
2. Удалить повторы и конфликтующие инструкции из built-in/profile prompts; факты пользователя не сокращать автоматически.
3. Вывести существующие controls: context on/off и recent pair count.
4. Для продолжения использовать summary + 2–4 последних пар.
5. Добавить adaptive completion target по профилю/типу ответа, оставляя 10–20% запас сверх желаемой длины; конкретные defaults требуют решения пользователя.
6. Показывать estimated system/history/current/completion tokens и количество отброшенных пар перед запросом.
7. Парсить фактический provider usage/cached tokens, когда оно присутствует в streaming response; не выдавать estimator за точный tokenizer.
8. Не отправлять старые изображения; текущую границу vision-context сохранить.
9. Убрать полные transcript/answer из логов.
10. Перестать переписывать всю историю после каждого turn: использовать append/debounce с обязательным final flush.

## Другие незавершённые улучшения по приоритету

### P0 — надёжность и безопасность

- Валидировать `sessionId`, preference keys и payload IPC до Resume.
- Включить `contextIsolation` вместо текущего `false` в `src/utils/window.js:26` отдельной задачей с preload migration.
- Завершить bounded Groq key-attempt policy и mocked-fetch tests для параллельных Text/Vision/STT запросов (task 018).

### P1 — качество основного сценария

- Закрыть Windows/Groq smoke для microphone/system audio, restart, permissions, быстрых реплик и toggle shortcut (tasks 018/019).
- Завершить profile limits: без silent truncation, с counters/errors и legacy preservation (task 016).
- Провести реальные model/UI smoke для response quality, профилей, исходного вопроса и EPAM HR ответов (tasks 013–016, 022–023).
- Сравнить Hosted/Local Vision на OCR, layout, code и latency (task 009).

### P2 — UX

- History: Continue, Copy message (task 024), поиск по тексту, provider/model/language metadata, retention controls.
- Live profile switching оставить после безопасной session snapshot/memory модели (task 017).

## Подзадачи

1. `DONE` Выполнить read-only trace profile → session snapshot → request → persistence → History.
2. `DONE` Проверить текущую token budgeting и официальные возможности Groq caching/limits.
3. `DONE` Составить capability matrix и измерить built-in prompt baseline.
4. `BLOCKED` Подтвердить поведение Continue, scope памяти, summary и defaults context/completion.
5. `TODO` Добавить validation sessionId/preferences/session payload.
6. `TODO` Добавить storage metadata `parentSessionId`, summary и безопасный round-trip.
7. `TODO` Добавить runtime hydration выбранной сессии без изменения source history.
8. `TODO` Добавить History `Continue` и profile context controls.
9. `TODO` Добавить request-budget breakdown и trimming notice.
10. `TODO` Добавить manual persistent memory per profile.
11. `TODO` Оптимизировать persistence/logging.
12. `TODO` Унифицировать hosted/local context selection.
13. `TODO` Добавить автоматические тесты и ручной restart/resume/live-model smoke.

## Критерии приёмки первого этапа

- После перезапуска приложения пользователь явно выбирает одну прошлую сессию и продолжает её в новой linked session.
- Первый запрос содержит ровно один system prompt, разрешённые последние полные пары, optional summary и текущий вопрос.
- Исходная сессия не изменяется.
- New session без Continue стартует чисто.
- Context off отправляет только system + current user.
- Context count N включает не более N полных пар и никогда не разделяет пару.
- Budget trimming удаляет самые старые пары и показывает это пользователю.
- Старые images не отправляются повторно.
- Invalid/path-traversal session IDs отклоняются.
- В логах нет текста transcript/answer.
- Поля профиля не обрезаются молча.

## Проверки

- Unit: context off, exact N pairs, pair-safe trimming, current question retained, Cyrillic estimator.
- Storage: behavior/memory/summary/parentSessionId round-trip; invalid sessionId rejected.
- Mocked runtime: Continue → first request payload → new linked session; source history unchanged.
- UI contract: controls persist, Continue explicit, budget/trimming visible.
- Regression: existing `test/*.test.js`.
- `npm.cmd run package`.
- Manual: restart → Continue → factual follow-up; New session → no carry-over; long history → no 413.

## Требуется решение пользователя

1. Continue: явная кнопка в History (рекомендуется) или автоматическое продолжение последнего чата?
2. Продолжение: создавать новую linked session (рекомендуется) или дописывать исходную?
3. Scope: одна выбранная сессия (рекомендуется) или несколько последних чатов?
4. Persistent memory: отдельная для каждого профиля (рекомендуется), глобальная или обе?
5. Summary: сначала только ручное редактирование (рекомендуется) или сразу opt-in автоматическая LLM-суммаризация?
6. Default recent pairs: оставить 6 или снизить до 4 (рекомендуется)?
7. Completion budget: adaptive presets (рекомендуется) или оставить единый ceiling 2048?
8. Полный compiled prompt в History: скрыть по умолчанию (рекомендуется) или оставить видимым?
