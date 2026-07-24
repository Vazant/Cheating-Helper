# 019 — Управление Speech-to-Text горячей клавишей

Статус: `IN_PROGRESS`

Зависимости: `012`, `018`.

## Нормализованное требование

Добавить в Settings режим работы Speech-to-Text:

1. `Always listen` — существующий VAD постоянно принимает выбранный источник во время активной сессии.
2. Управляемая запись — аудио принимается только после горячей клавиши; завершение записи немедленно финализирует реплику и запускает существующую цепочку Whisper → text LLM.
3. Рассмотреть два UX-варианта: повторное нажатие (`Toggle-to-talk`) и удержание (`Push-to-talk`).
4. Горячая клавиша должна настраиваться, работать при скрытом/неактивном окне и не конфликтовать с существующими shortcut.
5. UI должен явно показывать `Paused`, `Recording`, `Transcribing`, `Answering`.

## Текущее состояние

- `src/utils/renderer.js:startCapture()` открывает выбранный system/microphone source на весь срок сессии и постоянно отправляет PCM chunks.
- `src/utils/gemini.js:configureHostedAudio()` создаёт один source-scoped segmenter; завершённая VAD-реплика автоматически идёт в Hosted STT.
- `src/utils/audioPipeline.js:createSpeechSegmenter()` уже имеет `flush()`: текущую речь можно безопасно финализировать по команде без нового encoder/VAD.
- `src/utils/window.js:updateGlobalShortcuts()` использует Electron `globalShortcut`, поэтому shortcut работает вне фокуса приложения.
- Settings уже сохраняет редактируемые keybinds, но не имеет speech capture mode/action и не проверяет результат фактической регистрации.

## Ограничения Electron

- `globalShortcut.register()` вызывает callback при нажатии глобального accelerator, но не предоставляет отдельный release callback.
- `webContents.before-input-event` предоставляет `keyDown`/`keyUp`, но относится к вводу данного WebContents и не является глобальным keyboard hook для неактивного окна.
- Официальный список Electron Accelerator не содержит `Pause/Break`; надёжный штатный global binding этой клавиши не подтверждён.
- Фактическая проверка Windows + используемого Electron 30 подтвердила ограничение: `globalShortcut.register()` для `Pause`, `PauseBreak` и `Break` синхронно возвращает conversion failure до регистрации. Shortcut не был занят — Electron не принимает эти accelerator names.
- `Shift+Z` является допустимым accelerator, но глобально перехватывает обычный ввод заглавной `Z`, поэтому не подходит как default.
- Настоящий global hold/release требует OS-specific keyboard hook/native helper и отдельного security/cross-platform этапа.

Официальные источники:

- https://www.electronjs.org/docs/latest/api/global-shortcut
- https://www.electronjs.org/docs/latest/api/accelerator
- https://www.electronjs.org/docs/latest/api/web-contents/#event-before-input-event

## Карта ролей моделей

Изменений моделей нет:

| Этап | Модель | Изменение |
|---|---|---|
| Hosted STT | `whisper-large-v3-turbo` | Получает только завершённую вручную/VAD WAV-реплику |
| Hosted answer | выбранная text LLM | Без изменений; получает transcript |
| Local STT | выбранный Xenova Whisper | Должен получить тот же capture gate отдельным проверяемым маршрутом |
| Vision | Groq/Ollama vision | Не затрагивается |

## Рекомендуемый первый этап

- Режимы: `Always listen` и `Toggle-to-talk`.
- Backward-compatible default: `Always listen`; пользователь явно выбирает управляемый режим.
- Default shortcut для Toggle: `F8` (одна поддерживаемая Electron клавиша); shortcut редактируется в существующем Keybinds UI.
- Первое нажатие в активной сессии: очистить старый segmenter state, открыть audio gate, показать `Recording`.
- Второе нажатие: закрыть gate, вызвать `flush()`, показать `Transcribing`; если речи меньше минимального порога или она пуста — не делать API request и показать `No speech detected`.
- В `Toggle-to-talk` PCM вне активного recording window не отправляется main process и не сохраняется.
- Stop/close/error всегда закрывает gate и очищает незавершённый буфер; повторный Start не наследует состояние.
- Регистрация shortcut проверяется через boolean результата `globalShortcut.register`; конфликт показывается пользователю, а не игнорируется.
- Никаких новых dependencies для первого этапа.

## Подзадачи после подтверждения

1. `DONE` Добавить и нормализовать preference `speechCaptureMode: always | toggle`.
2. `DONE` Добавить `toggleSpeechCapture` в main/Settings defaults и редактируемый Keybinds UI; запретить дубликаты и показать registration failure.
3. `DONE` Провести состояние `inactive | recording | processing` через main/renderer IPC только во время активной сессии.
4. `DONE` В renderer не отправлять PCM вне recording window в toggle mode; always mode оставить без регрессий.
5. `DONE` На stop-recording вызвать main segmenter `flush()` ровно один раз; пустой/короткий input не отправлять в Groq.
6. `DONE` Полностью сбрасывать gate/segmenter при Stop, restart, source error и смене сессии.
7. `DONE` Добавить live status/indicator и понятное описание режима в Settings.
8. `DONE` Покрыть state transitions, empty speech, preference normalization и существующий audio pipeline dependency-free тестами.
9. `IN_PROGRESS` Выполнить Windows smoke: скрытое окно, другая программа в фокусе, два toggle, silence, быстрый restart, Always regression.

## Проверки 2026-07-20

- `DONE` Node syntax checks: storage, window, renderer, Gemini/Groq, Local AI, speech gate, Settings view.
- `DONE` `node test/speechCapture.test.js`.
- `DONE` `node test/audio.test.js`.
- `DONE` `node test/storage.test.js`.
- `DONE` Existing Groq, profile and vision tests.
- `DONE` `git diff --check`.
- `DONE` `npm.cmd run package` — Electron package for Windows x64 completed.
- `BLOCKED` Prettier could not be downloaded because the external tool runner reported its usage limit; formatting command was attempted and the diff check is clean.
- `IN_PROGRESS` Manual Windows audio/shortcut smoke requires an interactive microphone or system-audio session.

## Критерии приёмки

- В `Always listen` существующий VAD flow не меняется.
- В `Toggle-to-talk` до первого нажатия audio chunks не достигают STT segmenter.
- Одна пара нажатий создаёт максимум одну завершённую utterance, один STT и один LLM request.
- Второе нажатие немедленно финализирует речь, не ожидая VAD silence timeout.
- Silence/слишком короткая речь не расходует Groq request.
- Shortcut работает при неактивном/скрытом окне или UI сообщает, что registration failed.
- Stop/restart не отправляет старый буфер и не удваивает callbacks.
- Ключи, PCM, transcript и prompt не попадают в логи.

## Требуется решение пользователя

Решения подтверждены 2026-07-20:

- Первый этап — `Toggle-to-talk`, без native keyboard hook.
- Горячая клавиша по умолчанию — `F8`; пользователь может изменить её в Settings → Keyboard Shortcuts.
- В режиме ожидания stream остаётся открытым для быстрого старта, но PCM не буферизуется и не отправляется.
- Gate применяется к выбранному источнику (`Microphone` или `System Audio`).
- `Always listen` остаётся backward-compatible default.

1. Первый этап: реализовать рекомендованный `Toggle-to-talk`, а настоящий hold/release Push-to-talk оставить отдельной будущей задачей?
2. Default shortcut: `F8` (рекомендация) или другая поддерживаемая комбинация? `Pause/Break` штатно не поддерживается Electron, `Shift+Z` конфликтует с обычным вводом.
3. В toggle-idle для микрофона: полностью освобождать устройство (приватнее, но медленнее старт) или держать stream открытым и отбрасывать PCM до нажатия (быстрее)? Рекомендация для интервью: держать stream открытым, но не отправлять/не буферизовать PCM; UI честно показывает `Microphone ready · not recording`.
4. Применять toggle только к `Microphone` в первом этапе или также к `System Audio`? Рекомендация: одинаково gate-ить выбранный источник, не закрывая screen/loopback stream между нажатиями.
5. Если физическая `Pause/Break` обязательна: разрешить отдельный Windows-only native keyboard hook/helper (больше кода, отдельная упаковка и security/antivirus проверка) или оставить приложение dependency-free и использовать поддерживаемую клавишу?
