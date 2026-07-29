# 028 — Senior Java Developer prompt rewrite

Статус: `DONE`

## Цель

Создать для System Container отдельный импортируемый профиль `Senior Java Developer` для реализации, debugging, code review и архитектурной работы. Существующий `Senior Java Interview` не изменять.

## Текущее состояние и доказательства

- `src/utils/aiProfiles.js` хранит профиль в `SENIOR_JAVA_PROFILE` и компилирует его в порядке safety boundary → persona → User Context → answer rules → response style → language → length → format.
- `src/storage.js` добавляет профиль в `DEFAULT_PROFILE_STORE`; изменение константы влияет на новые установки, но само по себе не обновляет уже сохранённую пользовательскую копию.
- `src/utils/aiProfiles.js` использует `length: detailed`, поэтому глобальная инструкция требует примерно 18–30 предложений независимо от того, насколько прост вопрос.
- Текущий `answerRules` перечисляет много возможных аспектов ответа, но недостаточно явно запрещает проходить по ним как по обязательному шаблону.
- Текущий Java User Context говорит `6+ years` и `Mentor via code review`.
- Более свежий `profiles/epam-hr-call.json` говорит `Nearly 7 years` и запрещает выдумывать mentoring. Это фактический конфликт, который нельзя разрешить без решения пользователя.
- `tasks/027-groq-quality-context-and-token-plan.md` требует сохранить verified User Context, follow-up semantics, stable section ordering и пройти сценарии T7–T8.
- `test/profile.test.js` сейчас проверяет только наличие Spring в правилах Senior Java; отдельной factual/intent rubric для этого профиля нет.

## Capability matrix

| Роль | Текущий runtime | Отношение к этой задаче |
|---|---|---|
| Text generation | Groq hosted text models | Выполняет system prompt профиля |
| Vision/screen analysis | Отдельный vision flow | Не менять |
| Speech transcription | Отдельный STT flow | Не менять |
| Live audio | Отдельный capture/transcription flow | Не менять |
| Local inference | Отдельный Local AI flow | Не менять |

Эта задача меняет только text prompt и его проверки. Model IDs, providers, quotas, streaming и fallback не меняются.

## Предлагаемая структура

1. **User Context**: только проверенные факты; разделить краткую идентичность, опыт по проектам и явные отрицательные ограничения.
2. **Persona**: live interview teleprompter, первое лицо, прямой ответ без coaching commentary.
3. **Answer Rules**:
   - сначала классифицировать intent: короткий факт, теория, сравнение, coding, experience, system design или follow-up;
   - выбирать только релевантные измерения ответа;
   - для personal experience использовать только User Context;
   - для неизвестного личного факта честно обозначать отсутствие подтверждения;
   - для version-sensitive факта отделять устойчивый принцип от детали, которую нужно проверить;
   - follow-up углубляет только запрошенную часть;
   - system design начинается с требований и допущений, затем API/data/consistency/scaling/reliability/security/trade-offs;
   - код короткий и только когда он действительно помогает ответу.
4. **Response Style**: естественный spoken English, короткие абзацы, без заголовков и markdown по умолчанию.
5. **Length**: сменить `detailed` на `auto`, чтобы простые вопросы были короткими, а deep-dive оставался полным.

## План реализации

1. `DONE` Подтвердить область применения: отдельный рабочий Senior Java профиль, не interview-профиль.
2. `DONE` Создать переносимый `profiles/senior-java-developer.json` без изменения compiler/runtime и старого профиля.
3. `DONE` Добавить проверки импорта и ключевых engineering boundaries.
4. `DONE` Не добавлять storage migration: новый профиль импортируется отдельно и не заменяет существующие данные.
5. `DONE` Выполнить profile test и `git diff --check`.
6. `DONE` Не выполнять live Groq A/B: prompt не требует внешнего вызова для проверки схемы и импорта.

## Критерии приёмки

- Простой вопрос не превращается в ответ на 18–30 предложений.
- Технический ответ объясняет релевантный механизм, production implications и trade-offs, но не перечисляет универсальный checklist.
- Experience answer не добавляет работодателей, обязанности, метрики, технологии, leadership или mentoring.
- Follow-up не повторяет весь предыдущий ответ.
- Сравнение содержит обе стороны и ясный критерий выбора.
- System design явно фиксирует требования и допущения до предложения архитектуры.
- Version-sensitive вопрос не получает выдуманную точную версию или default.
- Ответ остаётся первым лицом и готовым для произнесения.
- Stable compiled section order, language freeze, context count, provider/model settings и streaming не меняются.
- Все автоматические проверки проходят; задача не получает `DONE` без manual/live gates, если они остаются обязательными.

## Принятые решения

1. Профиль не содержит биографию кандидата, годы опыта или непроверенные личные факты.
2. Существующий `profile_senior_java_interview` не изменяется.
3. Новый профиль имеет отдельный ID `profile_senior_java_developer`.
4. Профиль поставляется как переносимый JSON для явного импорта пользователем; скрытая миграция не нужна.
