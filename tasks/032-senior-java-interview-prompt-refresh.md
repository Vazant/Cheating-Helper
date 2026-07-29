# 032 — Senior Java Interview: живые B1–B2 ответы и coding task

Статус: `IN_PROGRESS`

## Цель

Адаптировать существующий встроенный профиль `Senior Java Interview` под техническое интервью по Java Core, multithreading, Spring, cloud, microservices, testing, software engineering methodologies и databases.

Ответ должен звучать как речь практичного Senior Java разработчика, но оставаться коротким, естественным и удобным для чтения на английском уровня B1–B2. Глубокие детали нужны только после явного уточнения интервьюера. Coding task должен получать отдельный, предсказуемый формат с подходом, сложностью, полным Java-кодом и коротким объяснением.

## Решение

Переработать существующий `profile_senior_java_interview`, а не создавать ещё один похожий профиль.

Причины:

1. Профиль уже предназначен именно для live Senior Java интервью.
2. Он уже доступен в выборе профилей и проходит через общий prompt compiler.
3. Новый профиль создал бы два почти одинаковых варианта и лишний выбор перед интервью.
4. Отдельный `profiles/senior-java-developer.json` не подходит: это engineering assistant для реализации, debugging и code review, а не teleprompter.

## Текущее состояние и доказательства

- `src/utils/aiProfiles.js:183` определяет встроенный `SENIOR_JAVA_PROFILE`.
- `src/utils/aiProfiles.js:200` задаёт широкий технический checklist, из-за которого модель может превращать каждый ответ в mini deep dive.
- `src/utils/aiProfiles.js:202` использует `length: detailed`; compiler требует примерно 18–30 предложений даже для относительно простого вопроса.
- `src/utils/aiProfiles.js:130` компилирует профиль в стабильном порядке: safety boundary → persona → User Context → answer rules → response style → language → length → format.
- `src/utils/prompts.js:76` включает профиль в общий список, а `src/utils/prompts.js:80` компилирует выбранный профиль.
- `src/utils/gemini.js:69` получает snapshot профиля.
- `src/utils/gemini.js:1534` при старте Groq-сессии один раз компилирует snapshot в `currentSystemPrompt`, сохраняет его в session state и использует для следующих запросов этой сессии.
- `src/utils/groq.js:184` формирует каждый text request как system prompt + сохранённые пары history + текущий вопрос.
- `src/utils/aiProfiles.js:205` и `src/utils/groq.js:190` сохраняют до шести предыдущих пар, поэтому follow-up вида “Can you explain this part deeper?” получает предыдущий ответ.
- `src/storage.js:115` кладёт Senior Java profile в `DEFAULT_PROFILE_STORE` как сохраняемую запись. Поэтому изменение только константы обновило бы новые установки, но не уже существующий `profiles.json`.
- `test/profile.test.js` проверяет schema/compiler и наличие Spring, но пока не проверяет B1–B2, краткость, topic scope и coding-task discipline.
- `profiles/senior-java-developer.json` остаётся отдельным импортируемым рабочим профилем и не меняется.

## Upstream

Проверено 2026-07-26:

- `sohzm/cheating-daddy#38` просит улучшить prompts, но не содержит готового решения.
- `sohzm/cheating-daddy#112` сообщает, что приложение не выдаёт код для DSA-вопроса.
- `sohzm/cheating-daddy#182` и `#190` отмечают общие ответы и слабую поддержку programming interview.
- Подходящего upstream PR с готовым Senior Java interview prompt не найдено.

Следовательно, cherry-pick или перенос upstream diff не предлагается.

## Capability matrix

Проверено по официальной документации Groq 2026-07-26. Model IDs и их роли в этой задаче не меняются.

| Роль                   | Текущая модель/контур                                                                                         | Отношение к задаче                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Hosted text generation | `openai/gpt-oss-120b` default, `openai/gpt-oss-20b` same-family fallback, `qwen/qwen3.6-27b` explicit Preview | Получает обновлённый system prompt                                                                 |
| Hosted vision          | `qwen/qwen3.6-27b`                                                                                            | Не менять; после распознавания вопроса text response всё равно следует активному interview profile |
| Speech-to-text         | `whisper-large-v3-turbo`                                                                                      | Не менять; транскрипция становится текущим user message                                            |
| Live audio             | capture/VAD/STT flow                                                                                          | Не менять                                                                                          |
| Local inference        | отдельный Local AI flow                                                                                       | Не менять; тот же profile compiler применит prompt при выборе этого профиля                        |

Официальные источники:

- https://console.groq.com/docs/model/openai/gpt-oss-120b
- https://console.groq.com/docs/model/openai/gpt-oss-20b
- https://console.groq.com/docs/model/qwen/qwen3.6-27b
- https://console.groq.com/docs/speech-to-text

## Предлагаемые настройки и defaults

- Profile ID: сохранить `profile_senior_java_interview`.
- Name: сохранить `Senior Java Interview`.
- Language: `Speech Language` является единственным источником языка ответа; профиль ограничивает сложность формулировок уровнем B1–B2 без hardcoded English.
- Length: заменить `detailed` на `concise`.
- Format: сохранить `teleprompter`.
- Conversation context: сохранить enabled, 6 пар.
- User Context: сохранить текущие подтверждённые факты без добавления новых работодателей, обязанностей, метрик или mentoring claims.
- Provider/model/reasoning/sampling/fallback: не менять.

## Черновик обновлённого prompt

### Persona

```text
Act as a live Senior Java interview assistant. Give the exact words the candidate can say in the interview. Start with the direct answer and use the response language required by the LANGUAGE section. Keep the wording at B1-B2 level. Sound calm, practical and experienced. Show seniority through clear decisions, production examples and relevant trade-offs, not through rare terminology or excessive detail. For experience questions, write in first person as Dzmitry Patapau and use only the verified User Context.
```

### Answer Rules

```text
First identify what the interviewer is asking: a short fact, technical explanation, comparison, experience example, coding task, system design question or follow-up.

For a normal technical question, give the main idea, explain how it works in practice, add one useful example, and mention one important pitfall or trade-off only when relevant. Do not turn every answer into a deep dive. Do not list every internal detail, edge case or best practice unless the interviewer asks for more detail, asks how it works under the hood, or asks a follow-up. Prefer common production knowledge over rare facts that are difficult to explain or verify.

Cover Java Core, collections, exceptions, generics, JVM basics, multithreading and the Java Memory Model when they are relevant to the question. Cover Spring Core, dependency injection, bean lifecycle, Spring AOP, Spring Security, Spring Boot and transactions at the same practical level. For cloud, microservices, testing, engineering methodologies and databases, focus on responsibilities, common design choices, failure handling and trade-offs that a Senior Java backend developer uses in real work.

For a comparison, explain both options and finish with a clear rule for choosing between them. For a follow-up, answer only the requested part and do not repeat the full previous answer. For a version-sensitive fact, explain the stable principle and do not invent an exact version or default.

For an experience question, use only facts from User Context. Never invent a project, employer, responsibility, metric, leadership role or tool. If the requested personal fact is not available, answer honestly without creating one.

For a coding task, briefly restate the problem and any necessary assumption, then give the simplest correct approach. State time and space complexity. Provide clean, complete Java code that can be typed and explained in an interview; do not apply the normal short-snippet limit. After the code, explain the key choices and important edge cases in a few sentences. Ask a clarification question only when missing input or output rules would materially change the algorithm.

For a system design question, clarify the main requirements and scale assumptions first. Then propose the simplest suitable design and explain the main data flow, storage choice, reliability risks, security concerns and trade-offs. Keep the first answer high level and expand only when asked.
```

### Response Style

```text
Write naturally in the required response language. Use B1-B2-level vocabulary, short sentences and short paragraphs. Explain an unavoidable technical term in simple words the first time it appears. Use natural phrases such as “The main idea is” or “In practice”, but avoid filler, slogans and coaching comments. Do not say “as a senior developer”. Do not announce the answer structure. For normal questions, avoid headings, tables and long bullet lists. For a coding task, short headings and one Java code block are allowed. Always give a complete final sentence.
```

## Ожидаемая длина

`length: concise` задаёт короткую базовую дисциплину:

- короткий факт или определение: 2–4 предложения;
- обычный технический вопрос: примерно 3–6 предложений, обычно 30–60 секунд речи;
- сравнение: обе стороны и один критерий выбора без полного каталога различий;
- deep dive, system design и coding task: длиннее только настолько, насколько требует задача;
- follow-up: только новая запрошенная деталь.

## План реализации

1. `DONE` Пользователь подтвердил переработку существующего `Senior Java Interview`; текущий User Context сохранён, новый профиль не создаётся.
2. `DONE` В `src/utils/aiProfiles.js` заменены только `persona`, `answerRules`, `responseStyle` и `length` у `SENIOR_JAVA_PROFILE`.
3. `DONE` Добавлена одноразовая storage migration для существующего профиля; она обновляет prompt, но сохраняет личный User Context и behavior. Compiler, schema, UI, provider/model settings, streaming, STT, vision и fallback не изменены.
4. `DONE` В `test/profile.test.js` добавлены минимальные проверки:
    - ID и name не изменились;
    - `length === 'concise'`;
    - `format === 'teleprompter'`;
    - prompt требует B1–B2 spoken style в выбранном языке;
    - обычный вопрос не должен становиться deep dive;
    - coding task требует approach, complexity и complete Java code;
    - follow-up не повторяет весь предыдущий ответ;
    - User Context boundary сохранена.
5. `DONE` Локальные проверки schema/compiler и все автономные `test/*.js` пройдены.
6. `DONE` Compiled prompt проверен: B1–B2, полный topic scope, coding discipline и follow-up rule присутствуют; старые `detailed` и 10-line limit отсутствуют.
7. `DONE` Live Groq smoke/A-B исключён из текущей реализации: пользователь его отдельно не разрешал.
8. `DONE` Фактические результаты проверок записаны ниже.

## Manual evaluation set

1. Java Core: `How does HashMap work in Java?`
2. Multithreading: `What is the difference between volatile and synchronized?`
3. Spring Core/AOP: `Why does @Transactional not work on self-invocation?`
4. Spring Security: `How would you secure a stateless REST API?`
5. Spring Boot: `What does auto-configuration do?`
6. Cloud: `What should we consider when moving a Spring Boot service to the cloud?`
7. Microservices: `How do you handle a partial failure between two services?`
8. Testing: `What is the difference between a unit test and an integration test?`
9. Methodologies: `When would you choose Kanban instead of Scrum?`
10. Databases: `Why can an index make writes slower?`
11. Coding: `Given a list of intervals, merge all overlapping intervals.`
12. Follow-up: `Can you explain only the memory visibility part in more detail?`

## Acceptance criteria

- Для обычного вопроса ответ начинается непосредственно с ответа, а не с плана или coaching commentary.
- Выбранный язык читается на уровне B1–B2: короткие предложения, обычные слова, сложный термин кратко объясняется.
- Senior-level проявляется через механизм, практический пример и релевантный trade-off, а не через количество редких деталей.
- Простой вопрос не получает универсальный checklist или ответ на 18–30 предложений.
- Java/Spring/database ответ остаётся технически содержательным и не превращается в поверхностное определение.
- Deep dive появляется после явного запроса и углубляет только нужную часть.
- Coding task содержит корректный подход, complexity, полный Java-код и edge cases; обычный лимит в 10 строк на него не распространяется.
- System design сначала фиксирует требования и допущения, но первый ответ остаётся high level.
- Experience answer использует только существующий User Context.
- Profile ID, name, teleprompter format и context count не меняются.
- Provider/model, STT, vision, streaming и fallback не меняются.
- Автоматические проверки проходят, `git diff --check` не находит ошибок.

## Runnable checks

```powershell
node test/profile.test.js
npm test
git diff --check
```

## Открытые product decisions

Нет. Live Groq smoke не входит в подтверждённый scope и не выполняется.

## Подтверждённые решения

1. Обновить существующий `Senior Java Interview`, не создавать новый профиль.
2. Сохранить текущий личный User Context без изменений.
3. Не выполнять реальные Groq calls без отдельного разрешения.

## Результат реализации

- Обновлён существующий `SENIOR_JAVA_PROFILE` в `src/utils/aiProfiles.js`.
- Сохранены ID, name, User Context, `teleprompter` и context count 6.
- `length` изменён с `detailed` на `concise`.
- Добавлены B1–B2 spoken style в выбранном языке, краткий senior-level ответ, явный topic scope, follow-up discipline и отдельный coding-task формат.
- Удалён общий лимит кода в 10 строк; для coding task требуется полный объяснимый Java-код.
- Одноразовая storage migration обновляет существующую сохранённую запись с ID `profile_senior_java_interview`, сохраняя её User Context и behavior.
- Compiler, UI, models, STT, vision, streaming и fallback не менялись.

## Результаты проверок

Проверено 2026-07-26:

1. `node test/profile.test.js` — PASS.
2. Все 17 автономных файлов `test/*.js` — PASS, включая migration существующего Senior Java profile с сохранением User Context.
3. `test/rendererRuntimeSmoke.js` — не применялся: это live UI smoke, которому требуется отдельно запущенное Electron-приложение на `127.0.0.1:9223`.
4. `npm test` — в `package.json` отсутствует script `test`; проверки запущены напрямую через Node.
5. Compiled profile contract — PASS:
    - ID `profile_senior_java_interview`;
    - `length: concise`;
    - `format: teleprompter`;
    - context count 6;
    - B1–B2, все заявленные темы, coding task и follow-up rules присутствуют;
    - старые `18–30 sentences` и `10 lines` отсутствуют.
6. `git diff --check` — PASS; только предупреждения Git о будущем LF→CRLF.
7. `npx prettier --write ...` — не выполнен: Prettier не установлен локально, а загрузка из npm registry запрещена текущей сетью. `git diff --check` и существующий четырёхпробельный стиль соблюдены.
8. Реальные Groq calls не выполнялись согласно подтверждённому scope.

## Регрессия языка — 2026-07-26

### Симптом

Пользователь выбирает Russian вместо English и воспринимает настройку как несохранённую.

### Диагностика

- Фактический `C:\Users\Potap\AppData\Roaming\cheating-daddy-config\preferences.json` содержит `"selectedLanguage": "ru-RU"`; backup содержит то же значение. Запись на диск успешна.
- `CustomizeView.handleLanguageSelect()` передаёт выбранное значение root-компоненту.
- `CheatingDaddyApp.handleLanguageChange()` сохраняет `selectedLanguage` через storage и обновляет root state.
- `CheatingDaddyApp.handleStart()` повторно читает сохранённый язык и передаёт его Groq/Local session.
- `compileProfile()` добавляет финальную секцию `LANGUAGE` с `Always reply in Russian`.
- Новый `SENIOR_JAVA_PROFILE` одновременно дважды требует `natural spoken English at B1-B2 level`. Это конфликт инструкций, из-за которого Russian может выглядеть проигнорированным.
- Поиск upstream issues/PR по language persistence не нашёл готового исправления.

### Capability matrix

| Роль            | Изменение                                                                        |
| --------------- | -------------------------------------------------------------------------------- |
| Text generation | Убрать hardcoded English из Senior Java profile; язык задаёт compiled `LANGUAGE` |
| Speech-to-text  | Не менять; использует выбранный language hint                                    |
| Vision          | Не менять                                                                        |
| Live audio      | Не менять                                                                        |
| Local inference | Не менять; получает тот же compiled profile                                      |

### Предлагаемый минимальный fix

1. `DONE` Пользователь подтвердил, что `Speech Language` всегда определяет язык ответа, а B1–B2 описывает только простоту речи.
2. `DONE` В `SENIOR_JAVA_PROFILE.persona` hardcoded English заменён на ссылку на compiled `LANGUAGE`.
3. `DONE` В `responseStyle` применена language-neutral формулировка; topic scope, краткость и coding rules не менялись.
4. `DONE` Добавлен regression test:
    - English compile содержит `Always reply in English`;
    - Russian compile содержит `Always reply in Russian`;
    - Senior Java profile больше нигде не требует English;
    - B1–B2/simple spoken style сохраняется.
5. `DONE` Profile, storage, Groq baseline и все автономные tests пройдены.
6. `DONE` Результаты записаны, задача возвращена в `DONE`.

### Acceptance

- Сохранённый `ru-RU` компилируется без конфликтующей English-инструкции.
- `en-US` по-прежнему даёт English.
- Смена языка не меняет профиль, User Context, модели, context count или fallback.
- Новая сессия замораживает выбранный язык; активная сессия не меняется задним числом.

### Открытый вопрос

Нет. Многоязычный Senior Java profile подтверждён пользователем.

### Результат исправления

- Hardcoded English удалён из `persona` и `responseStyle`.
- `Speech Language` через compiled `LANGUAGE` является единственным источником языка ответа.
- B1–B2, краткость, topic scope, coding rules и User Context не изменены.
- English compile содержит `Always reply in English`.
- Russian compile содержит `Always reply in Russian` и не содержит `Always reply in English`.
- Все 17 автономных `test/*.js` прошли.
- `git diff --check` прошёл; реальные Groq calls не выполнялись.

## Визуальная регрессия language/profile dropdown — 2026-07-26

### Причина

- Persistence исправен: фактический `preferences.json` содержит `selectedLanguage: ru-RU`.
- Root state читает это значение при startup и ещё раз перед `Start`.
- В `CustomizeView.renderLanguageSection()` свойство `<select .value=${this.selectedLanguage}>` обновляется раньше, чем динамические `<option value=${language.value}>` получают свои значения.
- На первом render matching option ещё отсутствует, поэтому native select показывает первый пункт `English (US)`.
- Lit считает `.value` уже применённым и может не записать то же `ru-RU` повторно после заполнения options.
- Результат: storage и будущая session содержат Russian, но вновь созданный Settings view визуально показывает English.
- В `AICustomizeView.render()` профиль строится тем же способом: `.value=${this._draft.id}` задаётся до динамических option из Built-in/My profiles. Поэтому визуально мог показываться первый профиль вместо сохранённого.

### Минимальный fix

1. `DONE` Пользователь явно запросил исправить визуальное отображение сохранённых языка и профиля.
2. `DONE` Matching language `<option>` отмечается через `?selected=${this.selectedLanguage === language.value}` вместо ранней `.value` привязки select.
3. `DONE` Matching profile `<option>` отмечается через `?selected=${this._draft.id === x.id}` для Built-in и My profiles.
4. `DONE` Добавлен regression contract test для обоих dropdown.
5. `IN_PROGRESS` Запустить автономные tests и записать результат проверки.

### Границы

- Storage, `Speech Language`, prompt compiler, STT hint и session freeze не менять.
- Provider/model/fallback не менять.

## Регрессия точности HashMap-ответов — 2026-07-27

### Симптом и оценка

Пользователь проверил профиль цепочкой:

1. `How does HashMap work in Java?`
2. `Why does HashMap require correct equals() and hashCode()? What if only equals() is overridden?`
3. `What if two different objects have the same hashCode()?`

Ответы имеют подходящую краткость, но недостаточную точность для Senior Java interview:

- первый ответ уходит в `null`, синхронизацию и выбор `ConcurrentHashMap`, хотя вопрос прежде всего требует механизма `HashMap`; утверждение о деградации до `O(n)` не отделяет list bin от tree bin;
- второй неверно обещает разный `Object.hashCode()` каждому экземпляру и приписывает нарушению `equals/hashCode` потерю записей при resize и memory leak; реальные прямые последствия — failed lookup/remove equal-экземпляром и логически дублирующиеся equal keys;
- третий правильно объясняет допустимую коллизию и роль `equals`, но после упоминания дерева снова описывает только линейный обход и не отделяет типичную tree-bin стоимость от патологического worst case.

Официальная база:

- Object `hashCode` требует одинаковый hash для equal objects, но не требует разных hash для unequal objects: https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Object.html#hashCode()
- HashMap допускает `null`, не синхронизирован, даёт ожидаемое constant-time поведение при хорошем распределении и предупреждает, что одинаковые hash замедляют таблицу: https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html
- текущий OpenJDK использует list bins и tree bins; `TREEIFY_THRESHOLD = 8`, `UNTREEIFY_THRESHOLD = 6`, `MIN_TREEIFY_CAPACITY = 64`: https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/HashMap.java

### Current-state evidence

- Фактические preferences выбирают `profile_senior_java_interview`, `en-US` и `openai/gpt-oss-120b`.
- Фактический сохранённый профиль имеет `length: concise`, `format: teleprompter`, context count 6 и уже применённые `seniorJavaInterviewV2`/`V3`.
- `src/utils/aiProfiles.js:200-206` требует для каждого normal technical answer фиксированную последовательность definition → mechanism → contract/guarantee → performance/failure → production choice и верхнюю границу в пять-шесть предложений.
- Первый HashMap-ответ буквально повторяет этот checklist; обязательные failure behavior и production choice создают давление добавлять правдоподобно звучащие, но не вытекающие из механизма последствия.
- `src/utils/aiProfiles.js:130-153` корректно компилирует профиль; `src/utils/gemini.js:1534-1554` замораживает snapshot на новую Groq-сессию.
- `src/utils/groq.js:184-212` и `src/utils/gemini.js:626-685` передают system prompt, до шести полных предыдущих пар и текущий вопрос. Follow-up context не теряется.
- `src/utils/gemini.js:802-899` только собирает SSE content и не переписывает смысл ответа.
- `src/utils/groq.js:18-27` отправляет GPT-OSS с `temperature: 0.7`, `reasoning_effort: low`, скрытым reasoning и динамическим completion budget 1024–2048.
- Fallback остаётся внутри GPT-OSS family и срабатывает только после 404; Qwen не является скрытым fallback для этих ответов.

### Capability matrix

| Роль                   | Текущий контур                                 | Решение                                                                  |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| Hosted text generation | `openai/gpt-oss-120b`, 20B только 404 fallback | Получит уточнённый Senior Java prompt; модель и параметры пока не менять |
| Hosted vision          | `qwen/qwen3.6-27b`                             | Не менять                                                                |
| Hosted STT             | `whisper-large-v3-turbo`                       | Не менять                                                                |
| Live audio             | capture/VAD/STT → hosted text                  | Не менять                                                                |
| Local inference        | отдельный Ollama/HF flow                       | Получит тот же обновлённый compiled profile; модели не менять            |

Актуальность ролей подтверждена официальными страницами Groq:

- https://console.groq.com/docs/model/openai/gpt-oss-120b
- https://console.groq.com/docs/model/openai/gpt-oss-20b
- https://console.groq.com/docs/model/qwen/qwen3.6-27b
- https://console.groq.com/docs/speech-to-text
- https://console.groq.com/docs/reasoning

### Предлагаемый минимальный fix

Заменить только paragraph normal technical question и усилить приоритет follow-up:

```text
For a normal technical question, start with the direct answer and explain only the mechanism needed for this question. Add a contract, complexity note, pitfall, or production choice only when it directly changes the answer; do not force all of them into every response. Clearly distinguish API contracts, typical current-JDK implementation details, and worst-case behavior. Never add speculative consequences or absolute claims to sound senior. Stop when the question is fully answered; do not pad it to a target sentence count.

For a follow-up, this rule overrides the normal-question template: answer only the requested point and do not repeat or extend the previous answer with unrelated consequences.
```

Не менять provider/model, `temperature`, reasoning effort, completion budget, fallback, history, streaming, STT, vision, language, `length`, `format`, User Context или behavior. Наблюдаемый структурный дефект уже объясняется prompt; изменение sampling/reasoning без одинакового live A/B не обосновано.

Для существующей установки нужна новая one-shot migration `seniorJavaInterviewV4`: V2/V3 уже отмечены выполненными. V4 должна обновить только содержимое стандартного профиля с точным ID, сохранив пользовательские `prompt.userContext` и весь `behavior`. `PROFILE_SCHEMA_VERSION` не меняется.

### Ordered subtasks

1. `DONE` Проследить профиль → compiler → session snapshot → Groq payload → history → SSE/UI.
2. `DONE` Проверить фактические preferences и persisted migration state.
3. `DONE` Сверить HashMap/equals/hashCode с Oracle/OpenJDK и актуальные model roles с Groq.
4. `DONE` Записать минимальный prompt diff, capability matrix, границы и вопросы.
5. `DONE` Пользователь подтвердил written plan и уточнил требуемую глубину.
6. `DONE` Заменены normal-question и follow-up rules в `SENIOR_JAVA_PROFILE`.
7. `DONE` Добавлена `seniorJavaInterviewV4` по существующему migration pattern.
8. `DONE` Обновлены `test/profile.test.js`, `test/storage.test.js` и deterministic compiled-prompt baseline.
9. `DONE` Автономные tests и `git diff --check` прошли.
10. `DONE` Live Groq smoke не выполнялся: отдельного разрешения на расход quota нет.

### Acceptance criteria

- Обычный технический вопрос не получает обязательный универсальный checklist.
- Accuracy имеет приоритет над демонстративной «senior» полнотой и целевым числом предложений.
- Contract, current-JDK implementation и worst case явно не смешиваются.
- Ответ не придумывает вторичные последствия, которые не следуют из описанного механизма.
- В equals-only кейсе нет гарантии уникального `Object.hashCode`, resize-based lost entries или memory leak.
- В same-hash кейсе коллизия не объявляется нарушением корректности; list bin, tree bin и worst case не смешиваются.
- Follow-up отвечает только на запрошенную связь и не дополняется нерелевантным production advice.
- V4 обновляет существующий точный Senior Java profile и сохраняет личный User Context и behavior.
- Остальные profiles, модели, fallback и runtime flows не меняются.

### Runnable checks

```powershell
node test/profile.test.js
node test/storage.test.js
node test/groqBaseline.test.js
git diff --check
```

Manual smoke chain:

1. `How does HashMap work in Java?`
2. `Why does HashMap require correct equals() and hashCode()? What if only equals() is overridden?`
3. `What if two different objects have the same hashCode()?`

### Открытые product decisions

1. `DONE` Пользователь подтвердил prompt-only fix и migration V4.
2. Реальный Groq A/B/smoke с расходом quota отдельно не разрешён; по умолчанию не выполнять.

### Уточнённый критерий пользователя — 2026-07-27

- Количество предложений не является целью или ограничением. Ответ заканчивается, когда вопрос корректно раскрыт на удобной для речи глубине.
- Обычный обзор даёт назначение, главный механизм и только действительно важное ограничение. Он намеренно оставляет глубокие детали для follow-up.
- Не перечислять точные internal field/variable names, private helper methods/classes, wire-format segments, configuration properties, cipher terminology или низкоуровневые framework internals, если интервьюер прямо не спросил structure, implementation, security details или under the hood.
- Если точное имя API не нужно для объяснения, описывать его роль. Если интервьюер запросил точное имя, не угадывать «примерно так называется»: либо назвать уверенно, либо честно отметить, что точный identifier нужно проверить.
- Лучше дать корректный и достаточный overview, который допускает следующий вопрос, чем исчерпывающий deep dive. Нельзя ради краткости опускать факт, без которого ответ станет неверным или вводящим в заблуждение.
- Максимальная точность имеет приоритет над полнотой, демонстративной senior-терминологией и длиной.

### Скорректированный implementation scope

1. `DONE` Заменены rigid normal-question/follow-up rules в `SENIOR_JAVA_PROFILE`.
2. `DONE` Числовые sentence targets удалены из общего `concise` instruction; UI-описание синхронизировано.
3. `DONE` Добавлена `seniorJavaInterviewV4`, сохраняющая User Context и behavior.
4. `DONE` Обновлены минимальные profile/storage regression checks.
5. `DONE` Локальные tests и `git diff --check` прошли; live Groq не вызывался.

### Результат реализации и проверки

- Normal answer больше не обязан включать contract, performance/failure, production choice или заданное число предложений.
- Overview использует plain-language responsibilities/data flow и не перечисляет wire format, internal identifiers, cipher/framework internals без прямого запроса.
- Prompt требует отличать API contract, typical current-version implementation и worst case, исправлять ложную предпосылку и не придумывать последствия.
- Follow-up rule имеет приоритет и раскрывает только запрошенную часть.
- Общий `concise` preset теперь означает shortest complete and accurate answer без числового sentence target; UI показывает ту же семантику.
- V4 one-shot migration обновляет точный Senior Java profile, сохраняя персональный `userContext` и весь `behavior`.
- 18 автономных `test/*.js` прошли; `rendererRuntimeSmoke.js` исключён, потому что требует отдельно запущенный Electron на `127.0.0.1:9223`.
- `node --check` изменённых application files — PASS.
- `git diff --check` — PASS; присутствуют только предупреждения о будущем LF→CRLF.
- Реальные Groq calls не выполнялись.

### Проверка persisted V4 после пользовательского smoke — 2026-07-27

- Первый повторный HashMap-ответ всё ещё следовал старому checklist.
- Фактический `profiles.json` подтвердил причину: `seniorJavaInterviewV4` отсутствовала, а сохранённый profile всё ещё содержал `important contract or guarantee` и `five or six compact sentences`.
- Найденная packaged build в `out` датирована 2026-07-25 и не содержит новую startup migration.
- V4 применена один раз через текущий `storage.initializeStorage()`.
- Повторная проверка persisted profile: `V4.done=true`, `updated=true`; старые checklist/5–6 rules отсутствуют; `do not force a checklist` и `Never invent speculative consequences` присутствуют.
- Персональный User Context сохранён (1328 символов), context count остался 6.
- Для следующего smoke требуется полностью закрыть старый процесс приложения и создать новую сессию, потому что session prompt замораживается при `Start`.

## Коррекция глубины после V4 smoke — 2026-07-27

### Симптом

После фактического применения V4 ответ на `What is HashMap in Java?` стал точным и чистым, но слишком похожим на краткое словарное определение. Он не показывает ожидаемое от Senior понимание назначения, механизма и поведения под капотом.

### Подтверждённый критерий

- Не ограничиваться определением.
- Для широкого вопроса `What is X?` / `How does X work?` дать компактное инженерное объяснение:
    - какую проблему решает и где используется;
    - как работает основной механизм;
    - какую одну действительно полезную идею под капотом стоит знать;
    - какой один нюанс, ограничение или trade-off важен на практике.
- Это ориентиры, а не обязательный checklist: нерелевантный пункт нужно пропустить.
- Дать достаточно материала, чтобы показать Senior-level понимание и оставить интервьюеру несколько естественных follow-up, но не перечислять private identifiers, wire format и редкие implementation details без прямого запроса.
- Accuracy и удобство произнесения остаются обязательными; числового sentence target нет.

### Минимальный implementation plan

1. `DONE` `shortest answer` заменён на `compact, self-contained engineering answer`.
2. `DONE` Normal technical rule переписан вокруг problem/use → mechanism → useful under-the-hood idea → relevant limitation; это явно не rigid checklist.
3. `DONE` Добавлена `seniorJavaInterviewV5`, сохраняющая User Context и behavior.
4. `DONE` Обновлены profile/storage/baseline checks.
5. `DONE` Локальные tests прошли, V5 применена к persisted profile; live Groq не вызывался.

### Capability and runtime boundaries

- Hosted Text остаётся `openai/gpt-oss-120b`; 20B fallback, reasoning, sampling и completion budget не меняются.
- Vision, STT, audio, Local AI, conversation history и session snapshot не меняются.
- V5 обновляет только точный `profile_senior_java_interview`; пользовательские копии профиля не затрагиваются.

### Результат V5

- Compiled prompt больше не содержит `Give the shortest answer`.
- Широкий технический вопрос не останавливается на definition и связывает назначение, использование, основной механизм, одну полезную under-the-hood идею и один релевантный нюанс.
- Narrow follow-up остаётся сфокусированным только на запрошенной части.
- 18 автономных `test/*.js` прошли; live `rendererRuntimeSmoke.js` не запускался.
- `node --check` и `git diff --check` прошли.
- Persisted profile подтверждён: `seniorJavaInterviewV5.done=true`, `updated=true`; новые Senior-level rules присутствуют.
- User Context сохранён (1328 символов), context count остался 6.
- Для фактического smoke нужна новая сессия после полного закрытия старого экземпляра приложения.

## Универсальная проверка coding-ответа — 2026-07-27

Пользователь подтвердил минимальное prompt-only усиление после проверки Ping/Pong-ответа и отдельно запретил переносить детали тестовой задачи в общий профиль.

### Scope

1. `DONE` В coding-правило добавлена только универсальная проверка: идиоматичная обработка ошибок, отсутствие молчаливого игнорирования сбоев, проверка начального состояния, основного пути, завершения и релевантных edge cases.
2. `DONE` Добавлена граница: не добавлять обработку, не относящуюся к видимой задаче.
3. `DONE` Конкретные `InterruptedException`, `wait/notify`, `Ping` и `Pong` в prompt не добавлены.
4. `DONE` Добавлена миграция `seniorJavaInterviewV6`, обновляющая только точный стандартный профиль и сохраняющая User Context и behavior.
5. `DONE` Запустить profile/storage/baseline checks, применить миграцию к текущему профилю и записать результат.

### Границы

- Vision extraction, screenshot pipeline, модели, reasoning, fallback, история и настройки не меняются.
- Пользовательские копии профиля не обновляются.
- Реальный Groq-запрос не выполняется.

### Проверки

```powershell
node test/profile.test.js
node test/storage.test.js
node test/groqBaseline.test.js
git diff --check
```

### Результат

- Все 18 автономных `test/*.js` прошли; live `rendererRuntimeSmoke.js` не запускался.
- `seniorJavaInterviewV6` применена к текущему сохранённому профилю: `done=true`, `updated=true`.
- User Context сохранён без изменений (1328 символов), context count остался 6.
- Универсальное правило и граница релевантности присутствуют; `InterruptedException`, `wait/notify`, `Ping` и `Pong` отсутствуют.
- `npm run package` прошёл; Windows x64 package пересобран.
- Реальные Groq-запросы не выполнялись.
