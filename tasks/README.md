# Реестр работ

Допустимые статусы: `BLOCKED`, `TODO`, `IN_PROGRESS`, `DONE`.

Правило `DONE`: отмечены все подзадачи, выполнены все критерии приёмки, записаны команды/способ проверки и их успешный результат. Частичное выполнение не считается завершением.

| ID   | Работа                                                         | Статус        | Зависимость                                                               |
| ---- | -------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------- |
| 001  | Подтвердить требования                                         | DONE          | —                                                                         |
| 002  | Создать и получить форк                                        | DONE          | 001                                                                       |
| 003  | Изучить существующие API-интеграции                            | DONE          | 002                                                                       |
| 003A | Исследовать актуальные бесплатные модели Groq                  | DONE          | —                                                                         |
| 003B | Проанализировать свежие issues Cheating Daddy                  | DONE          | —                                                                         |
| 004  | Исправить и расширить существующую Groq-интеграцию             | BLOCKED       | Выбор пользователя после 003/003A/003B                                    |
| 005  | Реальные лимиты Groq и предупреждение                          | BLOCKED       | 004 и выбор пользователя                                                  |
| 006  | Итоговая сквозная проверка этапа                               | BLOCKED       | 002–005                                                                   |
| 007  | Основа агентов и проектных правил                              | DONE          | 003/003A/003B                                                             |
| 008  | Первые исправления Hosted Text и квот                          | DONE          | —                                                                         |
| 009  | Hosted и Local Vision models                                   | TODO          | 008                                                                       |
| 010  | Временно отключить Gemini                                      | DONE          | —                                                                         |
| 011  | Управление несколькими Groq API keys                           | DONE          | 010                                                                       |
| 012  | Groq STT, text response и screenshots                          | IN_PROGRESS   | 018 и Windows/Groq smoke                                                  |
| 013  | Response quality and truncation                                | IN_PROGRESS   | 008                                                                       |
| 014  | AI Customization profiles                                      | IN_PROGRESS   | 013                                                                       |
| 015  | AI Profiles UX and prompt audit                                | PLANNING      | 014                                                                       |
| 016  | Profile field limits and active context visibility             | IN_PROGRESS   | 013, 015                                                                  |
| 017  | Live AI Profile switching                                      | TODO — FUTURE | 016                                                                       |
| 018  | Working Hosted Groq: keys, context, latency and voice commands | IN_PROGRESS   | 011, 012, 013, 016                                                        |
| 019  | Speech-to-Text capture shortcut and toggle mode                | PLANNING      | 012, 018                                                                  |
| 020  | EPAM HR Call profile                                           | DONE          | —                                                                         |
| 021  | Renderer storage API bootstrap                                 | DONE          | 019                                                                       |
| 022  | Показывать исходный вопрос над ответом                         | IN_PROGRESS   | 012, 018, 019, 021                                                        |
| 023  | Естественные и стабильные ответы EPAM HR Call                  | IN_PROGRESS   | 020                                                                       |
| 024  | Копирование текста из History                                  | TODO — FUTURE | —                                                                         |
| 026  | Контекст между сессиями и эффективность токенов                | BLOCKED       | Межсессионная память исключена из текущего scope                          |
| 027  | Groq-only: качество ответов, контекст и эффективность токенов  | IN_PROGRESS   | План и рекомендованные решения подтверждены                               |
| 029  | Полный аудит приложения и отложенный backlog                   | TODO — FUTURE | Активный приоритет перенесён в 027                                        |
| 030  | Toggle-to-Talk F8/F9, длинная запись и устойчивые настройки    | IN_PROGRESS   | Код, тесты и сборка готовы; реальный UI/audio smoke отложен пользователем |
| 031  | Settings UI redesign                                           | DONE          | Renderer-verified at normal and narrow widths                             |
