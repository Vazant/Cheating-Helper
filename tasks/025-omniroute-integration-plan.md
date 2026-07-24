# 025 — Исследование интеграции OmniRoute

Статус: `BLOCKED` (нужно решение пользователя по области первого этапа и fallback)

## Цель

Подключить локально запущенный OmniRoute как опциональный OpenAI-compatible gateway, не смешивая роли text, vision и transcription и не ломая прямой Groq и локальный Ollama.

## Текущее состояние и точки изменения

- `src/utils/gemini.js:395` (`sendToGroq`) выполняет text chat через жёстко заданный `https://api.groq.com/openai/v1/chat/completions`, читает Groq rate-limit headers, перебирает Groq models и Groq keys.
- `src/utils/gemini.js:646` (`sendGroqImage`) отправляет screenshot в тот же Groq chat endpoint с отдельной vision model.
- `src/utils/gemini.js:304` (hosted transcription path) отправляет WAV в `https://api.groq.com/openai/v1/audio/transcriptions`.
- `src/utils/groq.js:1-2` содержит фиксированный каталог Groq text models; `src/utils/groq.js:12` интерпретирует Groq-specific rate-limit headers.
- `src/storage.js:29-30` хранит Groq keys и active key index; `src/storage.js:77` отдельно хранит `visionProvider`.
- `src/components/views/CustomizeView.js:758` уже разделяет vision provider, но OmniRoute provider/base URL/API token/combo пока отсутствуют.

## Проверенная поверхность OmniRoute

Официальная документация репозитория заявляет локальный OpenAI-compatible endpoint `http://localhost:20128/v1`, включая:

- `POST /v1/chat/completions` с SSE streaming;
- OpenAI-style multimodal chat для поддерживающих vision моделей;
- `POST /v1/audio/transcriptions` как отдельную роль;
- `GET /v1/models`;
- model aliases/combos и quota-aware fallback;
- локальное хранение provider credentials самим OmniRoute.

OmniRoute должен оставаться отдельным процессом/приложением. Встраивание его Next.js/Electron codebase или npm-зависимости в Cheating Helper не требуется.

## Матрица возможностей

| Роль | Текущий путь | Возможный OmniRoute путь | Ограничение |
|---|---|---|---|
| Text response | Groq chat completions | `/v1/chat/completions`, direct model или combo | На первом этапе использовать только text-capable combo |
| Screenshot vision | Groq multimodal chat | `/v1/chat/completions` с `image_url` | Combo обязан состоять только из vision-capable targets |
| Hosted STT | Groq Whisper file POST | `/v1/audio/transcriptions` | Это отдельный endpoint/model; text combo сюда неприменим |
| Live audio | Не является обычным chat completion | Не подтверждено как realtime/live transport | Не включать в первый этап |
| Local inference | Ollama | Оставить прямым либо позже маршрутизировать отдельно | Не менять без отдельного решения |

## Рекомендуемый минимальный первый этап

- Добавить provider `omniroute` только для hosted text response.
- Хранить отдельно `omnirouteBaseUrl` (default `http://127.0.0.1:20128/v1`), optional gateway token и text model/combo ID.
- Сохранить прямой Groq как самостоятельный provider; не подменять Groq URL глобально.
- Для OmniRoute не выполнять клиентскую Groq model fallback/key rotation: routing и credentials принадлежат gateway.
- Не интерпретировать ответ OmniRoute как источник Groq RPD/TPM, если gateway не проксирует документированные upstream headers без изменений.
- Сохранить текущий prompt/history/stream rendering; добавить provider-neutral SSE parsing только в необходимом объёме.
- Vision и STT подключать отдельными следующими этапами после проверки capability конкретных моделей/combos.

## Нормализованное задание для LLM-агентов

### Контекст

Cheating Helper — Electron/JavaScript приложение. Hosted text сейчас вызывается напрямую через Groq OpenAI-compatible Chat Completions API. OmniRoute должен подключаться как отдельный локальный OpenAI-compatible gateway, а не встраиваться в приложение и не заменять Groq неявно.

### Цель этапа 1

Добавить явный hosted text provider `omniroute`, который отправляет существующий compiled system prompt, conversation history и текущий user message в локальный endpoint OmniRoute и отображает SSE-ответ через существующий UI streaming contract.

### Обязательные ограничения

- Не менять поведение direct Groq, Groq key rotation, Groq model fallback, Groq rate-limit parsing и Ollama.
- Не добавлять npm SDK: существующего `fetch` достаточно.
- Не направлять audio, transcription или screenshots через OmniRoute на этапе 1.
- Не выполнять скрытый fallback между OmniRoute и Groq.
- Не применять Groq-specific model catalog, retry или quota logic к OmniRoute.
- Не логировать gateway token или upstream credentials.
- Проверять и нормализовать пользовательский base URL до построения endpoint.
- Ошибка недоступности gateway должна быть явной и завершать текущий запрос.
- Сохранить текущие profile/session/history semantics и формат renderer events.
- Не смешивать эту работу с незавершёнными изменениями других задач.

### Минимальная конфигурация

```text
hostedProvider: "groq" | "omniroute"
omnirouteBaseUrl: string
omnirouteApiKey: string
omnirouteTextModel: string
```

Рекомендуемые defaults:

```text
hostedProvider = "groq"
omnirouteBaseUrl = "http://127.0.0.1:20128/v1"
omnirouteApiKey = ""
omnirouteTextModel = "auto"
```

Существующие пользователи после миграции должны остаться на `groq`.

### Порядок реализации

1. До начала кода убедиться, что рабочее дерево чистое и текущая ветка опубликована.
2. Проследить текущий hosted provider state через UI → storage → IPC → runtime consumer.
3. Добавить storage defaults, нормализацию и миграцию без изменения Groq credentials.
4. Добавить минимальные настройки: явный provider select и поля OmniRoute, видимые только при выборе OmniRoute.
5. Вынести только общий OpenAI-style SSE/request transport, если это уменьшает дублирование; не создавать provider framework.
6. Подключить OmniRoute text request к существующему prompt/history/stream rendering.
7. Добавить проверку доступности через фактический text request или лёгкий `GET /v1/models`; не запускать и не устанавливать OmniRoute из приложения.
8. Добавить минимальные unit tests и выполнить package check.
9. Провести ручной smoke с работающим и остановленным локальным OmniRoute.
10. Только после отдельного подтверждения спланировать vision и STT как независимые роли.

### Ожидаемый результат

Пользователь может выбрать `Groq` или `OmniRoute` для hosted text. При выборе OmniRoute приложение использует указанный local gateway и model/combo (`auto` по умолчанию), сохраняет текущие AI Profiles и streaming UX, а при недоступности gateway сообщает понятную ошибку без скрытого переключения.

## Подзадачи

- [x] `DONE` Проверить API surface и deployment model OmniRoute по официальному репозиторию.
- [x] `DONE` Найти текущие text, vision, STT, credential и rate-limit paths проекта.
- [x] `DONE` Составить capability matrix и минимальную границу первого этапа.
- [x] `DONE` Сформулировать агентно-исполняемое задание для text-only этапа.
- [ ] `BLOCKED` Получить решение пользователя: text-only pilot или сразу text + vision + STT.
- [ ] `BLOCKED` Получить решение пользователя: OmniRoute только как явный provider или разрешён автоматический cross-provider fallback.
- [ ] `TODO` После подтверждения проверить актуальный `/v1/models` и выбранные combo targets на локальном экземпляре пользователя.
- [ ] `TODO` Спроектировать provider-neutral request adapter без новой SDK-зависимости.
- [ ] `TODO` Добавить настройки, storage migration, IPC validation и понятную health check ошибку.
- [ ] `TODO` Добавить unit checks для URL normalization, auth, SSE, provider separation и отсутствия двойного fallback.
- [ ] `TODO` Выполнить локальный smoke: text streaming; затем отдельно vision/STT только если они входят в подтверждённый scope.

## Критерии приёмки первого этапа

- При выключенном OmniRoute прямой Groq и Ollama работают без изменения поведения.
- При выбранном OmniRoute text response стримится через локальный gateway.
- Недоступный gateway даёт понятную ошибку и не вызывает скрытый переход к Groq/другому provider.
- Ни gateway token, ни upstream keys не попадают в Git или логи.
- Text selector не предлагает STT-only или vision-only model/combo.
- Нет двойной ротации: либо routing выполняет OmniRoute, либо прямой Groq path.

## Проверки

- `node test/storage.test.js`
- `node test/groq.test.js`
- Новый unit test provider adapter/SSE.
- `npm run package`
- Ручной smoke с локальным OmniRoute: `GET /v1/models`, text streaming, остановленный gateway.

## Открытые вопросы

1. Первый этап: только text (рекомендуется) или сразу text + screenshots + STT?
2. OmniRoute выбирается явно как provider (рекомендуется) или становится автоматическим fallback для Groq?
3. Использовать `auto`, отдельный пользовательский combo или фиксированную модель?
4. Управление upstream keys остаётся только в OmniRoute (рекомендуется) или Groq keys продолжают дублироваться в Cheating Helper?

## Проверка состояния репозитория перед реализацией

Проверено 2026-07-23 после `git fetch --all --prune`:

- незапушенных коммитов нет: каждый локальный commit достижим из одной из веток `origin`;
- текущая ветка `codex/question-and-hr-responses` не имеет upstream, но её HEAD `439da65` уже опубликован как `origin/codex/hosted-audio-context-keys`;
- рабочее дерево не чистое: 13 tracked files изменены и 3 файла не отслеживаются;
- изменения пересекаются с будущей интеграцией OmniRoute в `src/storage.js` и `src/utils/gemini.js`;
- все существующие `test/*.test.js` прошли;
- до реализации OmniRoute текущий checkpoint требуется отдельно закоммитить и опубликовать либо осознанно отложить в stash/другую ветку.
