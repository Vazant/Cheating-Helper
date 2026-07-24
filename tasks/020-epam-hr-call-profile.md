# 020 — EPAM HR Call profile

Статус: `DONE`

Зависимости: существующая схема AI Profiles и активная задача `019` для управляемой записи речи.

## Нормализованное требование

Создать отдельную импортируемую идентичность `EPAM HR Call`, которая помогает пользователю во время первичного разговора с HR: распознаёт вопрос, предлагает честный и естественный ответ, снижает когнитивную нагрузку и не выдумывает биографические факты.

Профиль не заменяет технический `Senior Java Interview`: HR-ответы должны быть короче, разговорнее и ориентированы на мотивацию, опыт, коммуникацию и организационные условия.

## Актуальные основания

- EPAM описывает путь кандидата как разговор с Talent Acquisition Specialist, затем online technical interview и general interview с hiring manager.
- В актуальном описании роли EPAM Recruiter перечислены оцениваемые признаки: technical background, motivation, communication skills и cultural fit.
- Официальные советы EPAM рекомендуют приводить личные примеры, отвечать структурированно, думать вслух и просить уточнение, если вопрос непонятен.
- Проверка подлинности: официальный последующий контакт должен идти с адреса `@epam.com` или через интервью-платформу EPAM; EPAM не требует оплаты.

Официальные источники:

- https://www.epam.com/careers/quality-engineering-careers-at-epam-hungary
- https://careers.epam.com/en/vacancy/senior-it-recruiter-blt7iyeqzbst5h3p0nv_en
- https://www.epam.com/content/dam/epam/hu/Tips_for_the_interview.pdf
- https://www.epam.com/careers/epam-recruitment-fraud-disclaimer

## Текущий runtime профиля

- `src/utils/aiProfiles.js` хранит профиль как независимые поля `systemPrompt`, `userContext`, `persona`, `introInstruction`, `contextInstruction`, `searchFocus`, `responseStyle` и presets `length`/`format`.
- `src/utils/prompts.js` компилирует выбранный профиль в единый system prompt при старте сессии.
- Snapshot активного профиля сохраняется на всю сессию; изменение профиля в Settings не должно незаметно менять уже начатый звонок.
- Текущий лимит контекста требует компактных английских инструкций; язык ответа задаётся общей настройкой Speech Language.

## Предлагаемая структура профиля

1. `System Prompt`: роль помощника на реальном HR-звонке; только фактическая помощь, без выдумывания опыта, работодателей, дат, зарплаты или права на работу.
2. `User Context`: подтверждённые данные кандидата — роль, стаж, ключевой стек, текущая ситуация, локация, право на работу, notice period, формат работы, зарплатный диапазон, английский, причины интереса к EPAM.
3. `Persona`: спокойный senior-level interview coach, формулирующий естественную устную речь от первого лица.
4. `Intro Instruction`: определить намерение HR-вопроса и сразу дать лучший произносимый ответ.
5. `Context Instruction`: опираться только на User Context; если факта нет, показывать короткий безопасный шаблон с `[уточнить]`, а не угадывать.
6. `Search Focus`: motivation, concise career summary, project impact, teamwork, conflict, strengths/weaknesses, job-change reason, EPAM interest, English, location/work authorization, availability, compensation and candidate questions.
7. `Response Style`: сначала `Say:` на 2–5 предложений; при необходимости `If asked for details:` с 2–3 пунктами; никаких вступлений и повторения вопроса.
8. Presets: `concise` + `spoken`; длинный технический ответ остаётся задачей Java-профиля.

## Ожидаемые вопросы HR

- Tell me about yourself / walk me through your background.
- Why are you considering a change? Why EPAM and this role?
- What are your strongest relevant projects and responsibilities?
- What team size, stakeholders and international communication have you handled?
- Tell me about a conflict, difficult situation, failure or feedback.
- Strengths, development areas and career goals.
- English level and experience using English at work.
- Location, relocation, remote/hybrid preference and work authorization.
- Notice period, interview availability and possible start date.
- Compensation expectations and whether the range is flexible.
- Whether the candidate is in other interview processes.
- Questions the candidate wants to ask the recruiter.

## Подзадачи после подтверждения

1. `DONE` Получить от пользователя только факты, без которых профиль будет давать шаблоны вместо персональных ответов.
2. `DONE` Составить компактные английские поля профиля в пределах существующих character limits.
3. `DONE` Подготовить импортируемый JSON для быстрого использования перед звонком.
4. `DONE` Проверить compiled prompt на противоречия, дублирование и размер.
5. `DONE` Проверить language routing через существующие English/Russian profile compiler tests; целевая настройка звонка — `en-US`.
6. `DONE` Проверить, что неизвестные gross/net/B2B, дата решения и юридические гарантии не выдумываются.
7. `DONE` Включить в профиль вопросы HR от кандидата и безопасную передачу immigration details HR/mobility.

## Результат и проверки

- Создан `profiles/epam-hr-call.json` — portable schema v2, импортируемый через AI Customization.
- Подтверждённые факты взяты из CV и уточнений пользователя; точная вакансия и employment model явно оставлены неизвестными.
- Размеры: User Context 2193 символа, Persona 290, Answer Rules 1275, Response Style 306, compiled prompt 4869 символов.
- `node test/profile.test.js` — passed, включая import, English compilation и чувствительные факты профиля.
- `git diff --check` — passed.

## Критерии приёмки

- Профиль выбирается отдельно от `Senior Java Interview` и отображается под понятным именем.
- Ответ подходит для немедленного произнесения и не выглядит как статья или AI-лекция.
- Язык ответа всегда соответствует Speech Language.
- Ни один отсутствующий личный факт не придумывается.
- Вопросы о зарплате, notice period, локации и разрешении на работу используют только подтверждённые данные.
- Компилируемый prompt укладывается в установленные лимиты полей и не создаёт TPM regression.
- Импорт/сохранение/выбор профиля покрыты существующими profile tests.

## Требуется решение пользователя

Решено: английский; Java/Senior Java; EPAM Poland, Krakow; сначала portable JSON. Точное название вакансии и тип контракта пока неизвестны и не угадываются.
