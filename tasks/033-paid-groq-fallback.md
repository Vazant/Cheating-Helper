# 033 — Платный Groq fallback после бесплатной квоты

Статус: `BLOCKED`

## Цель

После исчерпания всех подтверждённых бесплатных дневных квот разрешить приложению перейти на явно настроенный платный Groq credential, не включая платные запросы из-за кратковременного RPM/TPM ограничения и не создавая неожиданных расходов.

## Текущее состояние

- `src/storage.js` хранит упорядоченный массив `groqApiKeys` и один активный индекс.
- `src/utils/groq.js:getNextGroqKeyIndex()` переключает ключ на любой HTTP `429`.
- `src/utils/gemini.js:sendToGroq()` последовательно проверяет ключи для Text; Vision использует аналогичный ограниченный цикл.
- UI не различает бесплатные и платные credentials.
- Groq rate limits действуют на уровне организации, а не отдельного пользователя или API key. Несколько ключей одной организации разделяют общий потолок.
- Переход организации на Developer включает pay-as-you-go для этой организации; это не отдельный fallback после бесплатной квоты.
- Groq Spend Limits действуют на всю платную организацию и блокируют новые запросы кодом `400 / blocked_api_access` после достижения месячного лимита.

## Capability matrix

| Роль | Текущий контур | Предлагаемое поведение |
|---|---|---|
| Text generation | Groq text model + ordered key rotation | Paid fallback только после подтверждённого исчерпания дневной request quota |
| Speech-to-text | Groq Whisper | Требует отдельного решения пользователя: включать ли тот же paid fallback |
| Vision | Groq Qwen vision | Требует отдельного решения пользователя: включать ли тот же paid fallback |
| Live audio capture | Локальный capture/VAD | Не менять |
| Local inference | Ollama | Не менять и не использовать как скрытый fallback |

## Безопасный минимальный вариант

1. Оставить обычные Groq keys в текущем бесплатном списке.
2. Добавить отдельное поле `Paid Groq fallback key`, а не полагаться только на позицию ключа в списке.
3. Добавить toggle `Use paid fallback`, default `OFF`.
4. Не переходить на платный key при любом `429`.
5. Переходить только когда headers подтверждают исчерпание дневной request quota (`x-ratelimit-remaining-requests: 0`) у каждого бесплатного billing scope.
6. При кратковременном token/minute или request/minute limit показать время reset/retry и не расходовать платный бюджет.
7. В UI явно показывать `Free`, `Paid fallback`, `Paid active` и причину переключения.
8. При `400 / blocked_api_access` остановиться и сообщить, что достигнут Groq Spend Limit.
9. Месячный hard limit и alerts настроить в Groq Console; приложение не должно угадывать стоимость по токенам.

## Acceptance criteria

- Платный fallback выключен по умолчанию.
- Обычный transient `429` не включает платный ключ.
- Платный ключ используется только после подтверждённого исчерпания бесплатной дневной квоты.
- В каждом запросе можно однозначно определить free/paid credential slot без вывода секрета.
- Достижение Groq Spend Limit прекращает запросы и показывает понятную ошибку.
- Повторные попытки ограничены и не зацикливаются.
- Text, STT и Vision не смешиваются; для каждой роли есть явно подтверждённая политика.
- Существующие keys и selected model сохраняются при миграции.

## Проверки

```powershell
node test/groqBaseline.test.js
node test/groqKeyActivation.test.js
node test/groqMetrics.test.js
node test/storage.test.js
git diff --check
```

## Официальные источники

- https://console.groq.com/docs/rate-limits
- https://console.groq.com/docs/billing-faqs
- https://console.groq.com/docs/spend-limits
- https://console.groq.com/docs/projects

## Блокирующие решения пользователя

1. Использовать paid fallback только для Text или также для STT и Vision.
2. Подтвердить, что платный key относится к отдельному платному billing scope, а не к той же бесплатной организации.
3. Выбрать месячный Groq Spend Limit в USD.
