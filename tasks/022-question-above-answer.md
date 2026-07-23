# 022 — Показывать исходный вопрос над ответом

Статус: `IN_PROGRESS`

Зависимости: `012`, `018`, `019`, `021`.

## Нормализованный запрос пользователя

В активной сессии показывать над каждым ответом модели исходный вопрос, который вызвал этот ответ. Для ручного ввода это введённый текст, для голосового ввода — итоговая расшифровка речи. При переходе между ответами должна отображаться соответствующая пара «вопрос → ответ».

## Текущее состояние и доказательства

- Hosted audio уже получает итоговую расшифровку в `processHostedUtterance()` и передаёт её в `queueGroqText()` (`src/utils/gemini.js:341-355`).
- Hosted text сохраняет точную пару через `saveConversationTurn(transcription, cleanedResponse)` (`src/utils/gemini.js:394-619`).
- Local audio и ручной Local text сходятся в `sendToOllama(transcription)` и также сохраняют пару (`src/utils/localai.js:187-256`, `src/utils/localai.js:375-384`).
- Cloud path уже держит `currentTranscription` до окончания ответа (`src/utils/cloud.js:95-117`).
- В live UI события `new-response` и `update-response` несут только строку ответа (`src/components/app/CheatingDaddyApp.js:463-469`), а `responses` является массивом строк (`src/components/app/CheatingDaddyApp.js:531-547`). Поэтому вопрос теряется только при отображении, но не при сохранении истории.
- `AssistantView` показывает один элемент `responses[currentResponseIndex]` и навигацию по ответам (`src/components/views/AssistantView.js:333-337`, `src/components/views/AssistantView.js:667-687`). Это естественное место для связанной пары.
- История уже показывает `turn.transcription` как сообщение пользователя (`src/components/views/HistoryView.js:376`); её формат хранения менять не требуется.
- Поиск связанных upstream issue/PR не выявил готового изменения, которое можно безопасно перенести; текущий fork уже заметно отличается в hosted STT и профилях.

## Карта ролей моделей

Модели и маршрутизация не меняются.

| Источник | Этап получения вопроса | Этап ответа | Изменение |
|---|---|---|---|
| Hosted voice | Groq `whisper-large-v3-turbo` | выбранная Groq text LLM | только передать готовый transcript в live UI |
| Local voice | локальный Whisper | выбранная Ollama text model | только передать готовый transcript в live UI |
| Ручной текст | готовый пользовательский текст | текущий text provider | только передать введённый текст в live UI |
| Screenshot | `screenAnalysisPrompt` + изображение | выбранная vision model | продуктовый выбор пока открыт |

## Рекомендуемый минимальный дизайн

1. Хранить каждый live-элемент как `{ question, answer }`, а не вести два параллельных массива.
2. В первом `new-response` передавать объект с нормализованным вопросом и первым текстом ответа; дальнейшие `update-response` обновляют только `answer` последнего элемента.
3. Сохранить обратную совместимость: строковые системные сообщения и ошибки отображать как ответ без блока вопроса.
4. Над ответом показывать компактный, выделяемый мышью блок `Question` с полным текстом без искусственного ограничения или дублирования transcript.
5. При навигации назад/вперёд показывать вопрос того же элемента, что и ответ.
6. Показывать только финальную расшифровку Whisper. Частичный live transcript не добавлять: текущие STT-маршруты его не предоставляют, а отдельная реализация увеличит задержки и объём изменений.
7. Не добавлять настройки, зависимости, новую схему хранения или повторное сохранение вопроса.

## Подзадачи после подтверждения

1. `DONE` Расширить payload первого streamed response для Hosted Groq, Local Ollama и Cloud так, чтобы он содержал `question` и `answer`.
2. `DONE` Нормализовать старые строковые payload в `CheatingDaddyApp`, сохранив корректное отображение ошибок и служебных сообщений.
3. `DONE` Перевести live `responses` на связанные элементы с `id`; streaming обновляет свой ответ, а не случайный последний элемент.
4. `DONE` Добавить в `AssistantView` компактный выделяемый блок вопроса над ответом.
5. `DONE` Покрыть контракт ручного текста, voice transcript, streaming ID и отсутствие question у vision payload статическими и dependency-free проверками.
6. `DONE` Добавить `test/responsePresentation.test.js`.
7. `IN_PROGRESS` Syntax/tests/diff/package прошли; ручной Windows smoke не выполнен из-за timeout системного разрешения на запуск свежего EXE.

## Результат проверки 2026-07-20

- `node test/responsePresentation.test.js` — passed.
- Profile, storage, speech capture, audio, Groq, vision и renderer bootstrap tests — passed.
- Syntax checks затронутых app/view/provider/storage файлов — passed.
- `git diff --check` — passed.
- `npm.cmd run package` — Windows x64 package completed.
- `BLOCKED` Prettier отсутствует локально, а `npx` не смог создать системный npm cache (`EPERM`); `git diff --check` чистый.
- `BLOCKED` Только ручной smoke реального typed/voice turn: системное разрешение Computer Use на запуск EXE истекло; API-квота без пользовательского запроса не расходовалась.

## Критерии приёмки

- После ручного текстового запроса его точный текст виден над соответствующим ответом.
- После voice/STT запроса итоговая расшифровка видна над соответствующим ответом.
- Вопрос появляется вместе с первым фрагментом ответа и не дублируется при streaming updates.
- Переключение между ответами никогда не смешивает вопрос одного turn с ответом другого.
- Вопрос и ответ можно выделить и скопировать.
- Старые строковые ошибки и служебные ответы не падают и показываются без пустого блока `Question`.
- Существующая History продолжает отображать сохранённые пары без миграции данных.
- Provider/model selection, prompts, context budget, quotas и key rotation не изменяются.

## Проверки

- `node --check src/components/app/CheatingDaddyApp.js`
- `node --check src/components/views/AssistantView.js`
- `node --check src/utils/gemini.js`
- `node --check src/utils/localai.js`
- `node --check src/utils/cloud.js`
- новый dependency-free test контракта question/answer
- существующие storage/profile/audio/Groq/vision/bootstrap tests
- `git diff --check`
- `npm.cmd run package`
- ручной smoke: typed → streamed answer; microphone → transcript → answer; два turn → навигация назад/вперёд

## Требуется решение пользователя

Решено: vision-ответ остаётся без строки вопроса, потому что пользователь не вводил внутренний `screenAnalysisPrompt` и его показ загромождал бы окно.
