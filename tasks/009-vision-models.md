# 009 — Hosted и Local Vision models

Статус: `TODO` (после завершения Hosted Text)

## Решения анализа

- Текущий Google screenshot path оставить рабочим на первом этапе.
- Local Vision не должна молча использовать text-only `ollamaModel`.
- Рекомендуемый local вариант: `qwen3-vl:4b`; low-resource: `qwen3-vl:2b`; compatibility: `gemma3:4b`.
- Не выбирать модель по имени: проверять установленные модели через Ollama `/api/tags` и capability `vision` через `/api/show`.
- Не скачивать модель автоматически.
- Hosted Groq Vision может использовать `qwen/qwen3.6-27b`; это preview и не должно быть единственным/default вариантом.
- Не выполнять скрытый fallback между hosted и local из-за различий приватности, скорости и ресурсов.

## Подзадачи

- [ ] Добавить отдельный `ollamaVisionModel`.
- [ ] Получать установленные vision-capable модели из Ollama.
- [ ] Отключать screenshot analysis с понятным сообщением, если Local Vision не настроена.
- [ ] Разделить local text и vision runtime models/history.
- [ ] Добавить Hosted Vision selector Google/Groq после проверки image-size/error paths.
- [ ] Учесть объявленное отключение Gemini 2.5 Flash/Flash Lite 2026-10-16 отдельной миграцией.

## Проверка

- Text-only Ollama model не получает image request.
- Vision options основаны на `/api/show capabilities`, а не hardcoded guessing.
- Google и Groq image smoke проходят независимо.
- Результат: ожидается.
