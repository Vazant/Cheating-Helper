# 013 — Качество форматирования и обрыв Groq-ответов

Статус: `IN_PROGRESS`

Подтверждено пользователем 2026-07-19: обычный plain text, Markdown только для списков/кода; GPT-OSS low reasoning и completion budget 2048; явное предупреждение при `finish_reason: length` без автоматического повтора.

## Проблема

На простой вопрос «Что такое Spring Boot?» приложение показало ответ, где почти каждое слово выделено Markdown-жирным, и текст оборвался после слова «Он».

Дополнительный подтверждённый live-результат 2026-07-19: Groq вернул `413 Request too large` для `openai/gpt-oss-120b`: TPM limit `8000`, requested `8439`.

Первоначальная гипотеза об истории не подтвердилась для этого случая: пользователь получил 413 на первом коротком вопросе после запуска.

Фактическая локальная проверка без чтения содержимого профиля показала:

- selected profile: `profile_job-interview-my-profile_1784418217692`;
- сохранённый `User Context`: 15 484 символа;
- итоговый compiled system prompt: 18 507 символов, грубо около 4 627 токенов;
- `max_completion_tokens`: 4096.

Таким образом, system prompt + резерв ответа уже превышают Free Plan TPM 8000 даже без предыдущей истории. Значение Groq `Requested 8439` согласуется с этим измерением. История остаётся будущим фактором роста, но не является причиной данного первого запроса.

## Текущие причины

1. `src/utils/prompts.js` для interview и остальных профилей прямо требует Markdown и `Use bold for key points and emphasis`. GPT-OSS гиперболизирует эту инструкцию и может выделять почти каждое слово. Markdown renderer лишь отображает полученные `**`; он не добавляет их.
2. `src/utils/gemini.js:sendToGroq` использует GPT-OSS с default reasoning effort (`medium`) и `max_tokens: 1024`. По документации Groq reasoning расходует completion budget; default может быть недостаточен.
3. Потоковый parser читает только `delta.content` и отбрасывает `finish_reason`, поэтому приложение не различает нормальный `stop` и обрыв `length`.
4. UI хранит и показывает полный накопленный текст; CSS использует vertical scrolling и не обрезает его. Доказательств UI-truncation нет.

## Предлагаемое исправление

- Для обычных ответов заменить требование Markdown/bold на plain readable text: без декоративного жирного, Markdown только для настоящего списка или кода.
- Для GPT-OSS text requests явно задать `reasoning_effort: low`, `include_reasoning: false` и `max_completion_tokens: 2048`.
- Для Qwen не отправлять GPT-OSS-only параметры; сохранить model-specific payload.
- Расширить SSE parser: сохранять `finish_reason` и после потока явно сообщать об `length` вместо молчаливого неполного ответа.
- Не делать автоматический retry после частично показанного ответа, чтобы не создавать дубликаты и лишний расход квоты.
- Показывать в AI Profile предупреждение, когда compiled prompt становится слишком большим для Free Plan с выбранным completion budget.
- Перед Groq-запросом рассчитывать безопасный completion budget относительно размера system prompt и текущего вопроса. Для текущего профиля около 3200–3500 completion tokens должно помещаться, но нужен запас на tokenizer и историю.
- Дополнительно ограничивать историю по budget, удаляя самые старые полные пары user/assistant; это предотвращает 413 в последующих вопросах, но не заменяет контроль размера system prompt.
- При `413` до начала streaming один раз автоматически повторить запрос после дополнительного удаления старейших пар. Это безопасно: частичный ответ ещё не был показан.
- Если system prompt + текущий вопрос сами не помещаются, уменьшить completion budget до доступного значения, но не ниже 1024, и явно показать предупреждение.
- Не переключать Groq key или модель из-за `413`: размер запроса от этого не уменьшается, а TPM обычно применяется на уровне организации/проекта.

## Мелкие работы

- [x] Проследить system prompt → Groq payload → SSE → UI Markdown.
- [x] Проверить официальные параметры reasoning GPT-OSS.
- [x] Получить подтверждение предлагаемого поведения.
- [x] Добавить финальное plain-text format override без декоративного bold.
- [x] Добавить model-specific generation parameters.
- [x] Сохранить и проверить `finish_reason`.
- [x] Добавить tests для payload/finish reason и plain-text override.
- [ ] Повторить вопрос «Что такое Spring Boot?» в GPT-OSS 120B.
- [ ] Получить подтверждение политики dynamic completion budget, profile-size warning, automatic history trimming и одноразового retry для 413.
- [ ] Добавить budget-aware trimming полных пар conversation history.
- [ ] Добавить обработку 413 без key/model rotation и тесты.
- [x] Собрать новый установочный EXE.

## Фактическая проверка 2026-07-19

- `node test/groq.test.js` — PASS.
- `node test/storage.test.js` — PASS.
- `node test/vision.test.js` — PASS.
- `node --check` для `groq.js`, `gemini.js`, `prompts.js` — PASS.
- `npm run make` — PASS.
- Live smoke с реальным Groq key остаётся за пользователем; после результата задача может быть переведена в `DONE` либо возвращена на исправление.

## Критерии приёмки

- Обычный ответ не содержит `**` вокруг каждого слова.
- Ответ заканчивается завершённым предложением либо UI явно сообщает, что достигнут лимит.
- GPT-OSS получает low reasoning без вывода reasoning-текста.
- Qwen не получает несовместимые GPT-OSS parameters.
- Частичный streamed response не запускается повторно автоматически.
- Automated tests и Windows package/make проходят.

## Проверки

1. `node test/groq.test.js`.
2. Новый regression test для prompt и `finish_reason: length`.
3. `node --check` изменённых файлов.
4. Live smoke с вопросом о Spring Boot.
5. `npm run make`.

## Официальные источники

- Groq Reasoning: https://console.groq.com/docs/reasoning
- Groq API Reference: https://console.groq.com/docs/api-reference
- GPT-OSS 120B: https://console.groq.com/docs/model/openai/gpt-oss-120b

## Вопрос пользователю

Подтвердить recommended behavior: обычные ответы преимущественно plain text, Markdown только для списков/кода; GPT-OSS low reasoning и completion budget 2048; при `finish_reason: length` показывать явное предупреждение без автоматического повтора.
