# 030 — Toggle-to-Talk F8/F9, длинная запись и устойчивые настройки

Статус: `IN_PROGRESS`

Дата анализа: 2026-07-24.

Зависимости: `012`, `016`, `018`, `019`, `021`.

Причина незавершённости: реализация, автоматические проверки и Windows-сборка готовы; реальный UI/audio smoke F8/F9 отложен по просьбе пользователя 2026-07-24.

## Подтверждённое требование

Удержание клавиши и глобальные события `KeyDown`/`KeyUp` не нужны.

### F8 — системный звук

```text
первое нажатие F8
  → начать непрерывную запись System Audio
  → при длинной записи заранее транскрибировать упорядоченные части
  → не отправлять части в LLM

второе нажатие F8
  → остановить запись
  → транскрибировать оставшуюся часть
  → дождаться всех частей
  → склеить единый transcript
  → показать единый вопрос
  → один раз отправить вопрос в существующий LLM pipeline
```

### F9 — микрофон

После реализации F8 тот же контракт применяется к F9, но источником является только Microphone.

## Что было изучено

- Hotkeys и окно: `src/utils/window.js`, `src/index.js`.
- Renderer capture/gating/cleanup: `src/utils/renderer.js`, `src/utils/speechCapture.js`.
- Hosted audio/STT/text: `src/utils/audioPipeline.js`, `src/utils/gemini.js`.
- Local audio/STT/text: `src/utils/localai.js`.
- Persistence/IPC: `src/storage.js`, `src/index.js`, renderer storage API.
- UI state: `CheatingDaddyApp.js`, `CustomizeView.js`, `AICustomizeView.js`, `MainView.js`.
- Тесты: `speechCapture.test.js`, `audio.test.js`, `storage.test.js`, `groq.test.js`.
- Предыдущие решения: tasks `016`, `018`, `019`, `021`, `029`.
- Локальный `upstream/master` (`3cccc36`) и связанные открытые GitHub issues.

## Текущий pipeline

```text
Electron globalShortcut F8
  → main: toggle-speech-capture
  → renderer: один общий speechCaptureGate
  → reset-speech-capture ИЛИ flush-speech-capture
  → один segmenter выбранного audioMode
  → STT
  → LLM
```

Текущая идея уже является toggle, но реализована только для одного выбранного источника и допускает автоматическую отправку отдельных utterance.

## Обнаруженные первопричины

### P0 — при текущей сохранённой настройке F8 специально игнорируется

- В фактических preferences пользователя сохранено `speechCaptureMode: always`.
- Handler `toggle-speech-capture` в `src/utils/renderer.js` немедленно выходит, если mode не равен `toggle`.
- Поэтому текущий F8 может регистрироваться успешно, но визуально «ничего не делать».
- В интерфейсе это ограничение недостаточно явно объяснено.

### P0 — двойная подписка на обновление hotkeys

- `src/utils/window.js:setupWindowIpcHandlers()` подписывается на `update-keybinds`.
- `src/index.js:setupGeneralIpcHandlers()` подписывается на тот же channel второй раз.
- Одно изменение вызывает два `unregisterAll()` и две повторные регистрации, создавая нестабильный lifecycle.

### P0 — текущий toggle допускает гонки

- Gate переключается раньше завершения async reset/flush.
- Повторное нажатие может прийти во время незавершённой операции.
- При ошибке выполняется слепой обратный `toggle()`.
- Нет session sequence, состояния `finalizing` и защиты от двойного события.
- Initial preferences загружаются fire-and-forget.

### P0 — текущая сегментация может преждевременно отправить вопрос

- Hosted segmenter завершает utterance после примерно 800 ms тишины или 30 секунд.
- Local VAD также завершает речь по тишине.
- Текущий callback сразу запускает STT, а затем LLM.
- Поэтому длинный вопрос может превратиться в несколько независимых LLM-запросов ещё до второго F8.

### P0 — один singleton не разделяет F8 и F9

- Renderer имеет один gate.
- Hosted pipeline имеет один segmenter/source state.
- Local pipeline имеет один набор speech buffers/resample state.
- `startCapture()` открывает только источник из `audioMode`.
- Для F8/F9 нужны source-scoped состояния и запрет смешивания PCM.

### P1 — cleanup и ownership неполные

- `stopCapture()` не async и не ожидает закрытие `AudioContext`.
- Старый STT callback может завершиться после Stop/New Start.
- Local VAD/STT не имеют строгой очереди и session ownership.
- Нужны `AbortController` и монотонный session generation token.

### P1 — persistence может сообщать ложный успех

- `writeJsonFile()` возвращает `false` при ошибке.
- IPC handlers игнорируют `false` и отвечают `{ success: true }`.
- UI показывает несохранённое значение, которое исчезает после нового чтения.
- JSON пишется прямо в целевой файл, а повреждение молча маскируется defaults.
- При несовпадении `configVersion` сейчас может удаляться весь config directory.

### P1 — startup/UI race

- Root app начинает async load, но не блокирует Start и интерактивный UI.
- Child views запускают конкурирующие reads.
- Поздний load может перезаписать более новое действие.
- Ошибка сохранения языка/profile не отображается и не вызывает rollback.

### P1 — «Senior/Middle» не существует как отдельная настройка

- В schema есть `selectedProfile`, но нет `interviewType` или `seniority`.
- AI Customization сохраняет ID реального профиля.
- Нужно либо считать AI Profile единственным источником, либо отдельно проектировать seniority.

### P1 — выбирается класс источника, а не физическое устройство

- Microphone вызывается без `deviceId` и использует Windows default input.
- System Audio зависит от display/system capture.
- Dropdown конкретного микрофона отсутствует.

## Алгоритм длинной записи

### Почему нельзя просто резать ровно по 30 секунд

Жёсткий разрез может попасть в середину слова или фразы. Параллельно отправленные части могут вернуться в другом порядке. Простая конкатенация с overlap может продублировать слова. Поэтому длительность chunk, порядок и склейка должны контролироваться одной recording session.

### Предлагаемый chunking

1. Первое F8 создаёт `RecordingSession` с уникальным `sessionId`, source=`system`, sequence=0 и состоянием `recording`.
2. PCM поступает непрерывно в rolling buffer. Тишина не завершает весь вопрос и не вызывает LLM.
3. После 20 секунд chunker начинает искать удобную границу по низкой аудиоэнергии.
4. Предпочтительная граница — пауза между 20 и 27 секундами.
5. Если паузы нет, выполняется hard split около 28 секунд, чтобы не упираться ровно в внутренний 30-секундный предел.
6. При hard split сохраняется небольшой overlap около 500–800 ms. Он уменьшает риск потери слова на границе.
7. Закрытая часть получает `{sessionId, sequence, startMs, endMs}` и ставится в STT queue.
8. Результаты разрешено получать параллельно, но хранить и склеивать только по `sequence`.
9. Пока запись продолжается, transcript частей является промежуточным: он не добавляется в History и не отправляется text LLM.
10. Второе F8 атомарно переводит session в `finalizing`, запрещает новый PCM и закрывает последнюю часть.
11. Pipeline дожидается всех STT jobs этой session.
12. Overlap удаляется по совпадающим нормализованным словам на границах. Если надёжного совпадения нет, текст не удаляется эвристически.
13. Части соединяются с нормализацией пробелов, но без LLM-переписывания transcript.
14. Только итоговый непустой transcript показывается как один вопрос, один раз сохраняется в History и один раз отправляется в LLM.
15. После постановки единственного LLM request session переходит в `completed`.

### Очередь и скорость

- STT частей начинается во время записи, поэтому после второго F8 обычно остаётся дождаться только последнего chunk.
- Для Free Plan безопаснее ограничить STT concurrency небольшим значением и использовать существующую обработку rate-limit/ротацию собственных Groq keys.
- Порядок ответа provider не влияет на порядок transcript: сборка всегда идёт по `sequence`.
- Text LLM не получает промежуточные части, поэтому история и контекст не раздуваются.

### Ошибки и отмена

- Если один chunk окончательно не транскрибирован, частичный вопрос автоматически в LLM не отправляется.
- UI показывает номер проблемной части и позволяет повторить транскрибацию, пока PCM этой session ещё сохранён в памяти.
- Stop/New Start инвалидирует callbacks старого `sessionId`.
- Нажатие F8 в состоянии `finalizing` не начинает новую запись; показывается «предыдущая запись обрабатывается».
- Нажатие другой source-key во время активной записи не смешивает источники.
- PCM хранится только в памяти текущей session и освобождается после success/cancel/error.

## Карта ролей моделей

| Этап          | Текущая роль                  | Вход → выход                                | Решение                                    |
| ------------- | ----------------------------- | ------------------------------------------- | ------------------------------------------ |
| Hosted STT    | Groq `whisper-large-v3-turbo` | WAV chunk → transcript part                 | Оставить; использовать ordered chunk queue |
| Hosted answer | выбранная Groq text model     | единый transcript + prompt/history → answer | Ровно один request после final merge       |
| Local STT     | выбранная Xenova Whisper      | PCM 16 kHz chunk → transcript part          | Тот же session/chunk contract              |
| Local answer  | выбранная Ollama model        | единый transcript + prompt/history → answer | Ровно один request                         |
| Vision        | Groq/Ollama vision            | screenshot → text                           | Не затрагивать                             |

Модели text, vision, transcription и local inference не взаимозаменяются. Изменение model IDs этой задачей не требуется.

## Предлагаемая архитектура

### Один hotkey coordinator

```text
Electron globalShortcut F8 pressed
  idle       → start(system)
  recording  → stop(system), если активен system
  finalizing → показать status, ничего не переключать

Electron globalShortcut F9 pressed
  idle       → start(microphone)
  recording  → stop(microphone), если активен microphone
  finalizing → показать status
```

- Native keyboard hook и новая native dependency не нужны.
- Должна остаться одна точка регистрации `update-keybinds`.
- State machine: `idle → recording(source) → finalizing → completed/failed → idle`.
- Каждая операция проверяет `sessionId`; повторное событие не создаёт второй start/flush.
- При активном другом source второе нажатие отклоняется с понятным статусом.

### Source-scoped audio

```text
system PCM     → RecordingSession(system)     → ordered STT chunks
microphone PCM → RecordingSession(microphone) → ordered STT chunks
```

- PCM двух источников никогда не находится в одном buffer/resampler.
- В toggle mode source определяет клавиша, а не `audioMode`.
- В Always Listen mode `audioMode` продолжает выбирать один постоянный источник.
- `stopCapture()` становится async и ожидает processors, contexts, tracks и provider reset.

### Settings source of truth

```text
main PreferencesStore
  → validate
  → safe write
  → read-back
  → IPC success
  → root UI commit
```

- Start недоступен до первого завершённого load.
- Ошибка записи видна UI; старое подтверждённое значение сохраняется.
- Config migration не удаляет credentials/history/profiles.
- Язык, profile, mode и hotkeys применяются к следующей session после Start.

## Предлагаемые настройки

1. Сохранить два режима: `Always listen` и `Toggle-to-talk`.
2. Не переименовывать сохранённое значение `toggle`, чтобы не делать ненужную migration.
3. `toggleSpeechSystem`: default `F8`.
4. `toggleSpeechMicrophone`: default `F9`.
5. В Toggle-to-talk `audioMode` не определяет source: его определяет клавиша.
6. Одинаковые F8/F9 и конфликты с другими shortcuts нельзя сохранить.
7. `selectedLanguage` остаётся единым output language и STT language hint.
8. `selectedProfile` остаётся активным AI Profile.

## План реализации после подтверждения

### A — Hotkey lifecycle

1. `DONE` Ввести toggle state machine с source и session generation.
2. `DONE` Оставить один main-process `update-keybinds` listener.
3. `DONE` Реализовать F8 system и F9 microphone как независимые toggle actions.
4. `DONE` Защитить start/stop/finalize от повторного события и reentrancy.
5. `DONE` Корректно освобождать shortcuts при rebind/window close/app quit.
6. `DONE` Добавить редактируемые F8/F9 controls и validation конфликтов.

### B — Recording session и chunked STT

7. `DONE` Создать source-scoped `RecordingSession` contract.
8. `DONE` Разделить gates/buffers/resamplers по source.
9. `DONE` Реализовать rolling PCM buffer и границы 20–28 секунд.
10. `DONE` Добавить silence-aware split и ограниченный overlap для hard split.
11. `DONE` Транскрибировать закрытые chunks во время продолжающейся записи.
12. `DONE` Хранить результаты по sequence независимо от порядка завершения.
13. `DONE` На втором нажатии закрыть tail и дождаться всей STT queue.
14. `DONE` Добавить консервативную дедупликацию overlap и final transcript join.
15. `DONE` Гарантировать один UI question, одну History entry и один text LLM request.
16. `DONE` Не отправлять partial transcript при failed chunk; дать retry/status.
17. `DONE` Привязать callbacks к AbortController/session generation.
18. `DONE` Сделать cleanup async и освобождать PCM после terminal state.
19. `DONE` Применить тот же contract к Hosted и Local STT без смешивания моделей.

### C — Persistence и применение

20. `DONE` Пробросить storage write failure в IPC/UI.
21. `DONE` Добавить safe write и восстановление последнего валидного JSON.
22. `DONE` Заменить destructive config reset на non-destructive migration.
23. `DONE` Дождаться initial preferences load до Start.
24. `DONE` Устранить competing child loads для shared profile/language state.
25. `DONE` Проверять round-trip языка, profile, audio/capture modes и hotkeys.
26. `DONE` Проверить фактическое применение language/profile в session prompt и STT.
27. `DONE` Senior/Middle представлен выбранным AI Profile без дублирующей preference.

### D — Тесты и выпуск

28. `DONE` Unit tests state machine: start/stop, competing source, duplicate/finalizing.
29. `DONE` Chunk tests: короткая запись, silence split, hard split и несколько частей.
30. `DONE` Tests: ordered join, overlap dedupe, failed/retry state и stale sequence.
31. `DONE` Source contract tests: F8 только system, F9 только microphone, gates не смешиваются.
32. `DONE` Contract test: промежуточные chunks не вызывают LLM, final dispatch ровно один.
33. `DONE` Storage tests: migration, round-trip, validation и corrupted JSON recovery.
34. `DONE` Существующие prompt tests подтверждают language/profile request plan.
35. `DONE` `node --check`, полный набор `*.test.js`, Prettier, `git diff --check`, Forge package/make.
36. `BLOCKED` Реальный Windows UI/audio smoke отложен по прямой просьбе пользователя.
37. `DONE` Результаты команд и artifact hashes записаны ниже.

## Фактический результат реализации

- F8 и F9 регистрируются отдельными Electron `globalShortcut`: F8 отправляет source=`system`, F9 — source=`microphone`.
- Первое нажатие создаёт recording session, второе атомарно закрывает source и запускает finalization; удержание не используется.
- В Toggle-to-talk открываются доступные System Audio и Microphone streams, но активным может быть только один source.
- Запись режется внутри STT pipeline: предпочтительно по паузе после 20 секунд, принудительно около 28 секунд с overlap 600 ms.
- STT chunks обрабатываются последовательно, сохраняются по sequence и не попадают в text LLM по отдельности.
- После второго нажатия transcript parts консервативно объединяются; LLM, UI и History получают один final question.
- Ошибка части не отправляет partial question. PCM остаётся в памяти failed session, а повторное нажатие той же клавиши повторяет только неуспешные части.
- Старый `toggleSpeechCapture` мигрируется в `toggleSystemAudio`; F9 добавляется отдельно. Toggle-to-talk мигрируется как default.
- Добавлен выбор `Windows default microphone` или конкретного input device; список обновляется явной кнопкой.
- Удалён второй listener `update-keybinds`; shortcuts освобождаются при quit.
- Preferences и keybinds валидируются; write failure больше не выдаётся за success.
- JSON записывается через проверенный temporary file и `.bak`; повреждённый primary читается из последней валидной backup.
- Config version обновляется без удаления credentials, profiles, history и остальных пользовательских данных.
- Root UI ждёт initial storage load и показывает Retry вместо пустого экрана при IPC/storage error.
- Active profile и language сохраняются до изменения root state и повторно читаются непосредственно перед Start.

## Выполненные проверки

- `node --check` для всех `src/**/*.js`: `PASS`.
- Все `test/*.test.js`: `PASS`.
- Новые проверки: toggle state machine, F8/F9 routing, один final LLM dispatch, long-audio chunking, overlap join, keybind migration/validation, preferences migration/backup recovery.
- Prettier для изменённых файлов: `PASS`.
- `git diff --check`: `PASS`.
- `npm run package`: `PASS`.
- `npm run make`: `PASS`.
- Packaged renderer runtime: storage loaded, error empty, language `ru-RU`, profile `profile_senior_java_interview`, mode `toggle`, System shortcut `F8`, Microphone shortcut `F9`.
- Визуальное/UI и реальное audio/STT взаимодействие не проверялись далее после просьбы пользователя прекратить UI-тестирование.

Artifacts:

- `out/System Container-win32-x64/System Container.exe`
    - SHA-256: `9A997BDE59855559DCC612BDC357A3583077E4D757538466445DC89803B15468`
- `out/make/squirrel.windows/x64/System Container-0.7.0 Setup.exe`
    - SHA-256: `0148200034B13BDB2FE4AE7620A93A0ED9480951A76B6371F9E01A4E980676F1`

## Windows smoke matrix

- F8: первое нажатие начинает System Audio, второе завершает.
- F9: первое нажатие начинает Microphone, второе завершает.
- Записи 2, 29, 31, 65 и 125 секунд.
- Пауза дольше 800 ms не отправляет вопрос до второго нажатия.
- При длинной записи parts транскрибируются заранее, но в LLM не уходят.
- Parts, вернувшиеся не по порядку, собираются правильно.
- Граница внутри слова не теряет слово и не создаёт явный дубль.
- Пять последовательных recordings, rapid double press, silence, Stop/New Start.
- F8/F9 работают при другом приложении в фокусе.
- Ошибка microphone не ломает F8; ошибка system capture не ломает F9.
- Language/profile/modes/hotkeys переживают navigation, exit и restart.

## Критерии приёмки

- Удержание клавиши не требуется.
- Первое F8 начинает только system recording; второе F8 завершает её.
- Первое F9 начинает только microphone recording; второе F9 завершает её.
- Тишина и внутренний chunk boundary не запускают text LLM.
- Запись любой поддерживаемой длины создаёт максимум один final question и один text LLM request.
- Длинная запись транскрибируется частями с сохранением порядка.
- Failed chunk не приводит к отправке неполного вопроса.
- PCM system/microphone и разных session не смешивается.
- Stop/restart не допускает stale result и освобождает устройства.
- Persistence считается успешной только после фактической записи.
- Language/profile после restart совпадают с последним подтверждённым выбором и реально применяются.
- Always Listen и typed-text pipeline не регрессируют.
- В логах нет API keys, PCM, полного prompt или персонального context.

## Upstream и официальные источники

Связанные upstream reports:

- `#404` — language selection resets/not persisted.
- `#382` — manual capture long questions.
- `#207` — unreliable/partial audio capture.
- `#190` — unreliable custom shortcuts.
- `#161` — Windows audio devices cannot be selected.
- `#83`/`#32` — separate microphone/system streams.

В локальном `upstream/master` готового решения для F8/F9 toggle и одного final transcript не найдено.

Официальные источники:

- Electron globalShortcut: https://www.electronjs.org/docs/latest/api/global-shortcut
- Groq Speech to Text: https://console.groq.com/docs/speech-to-text
- Groq Whisper Turbo: https://console.groq.com/docs/model/whisper-large-v3-turbo
- Groq Rate Limits: https://console.groq.com/docs/rate-limits

## Подтверждённые решения пользователя

1. `Toggle-to-talk` является default; `Always listen` сохранён отдельным вариантом.
2. Одновременная запись F8/F9 запрещена с понятным status.
3. Partial question при failed STT chunk не отправляется; та же клавиша повторяет failed chunks.
4. Senior/Middle определяется выбранным AI Profile без отдельной seniority preference.
5. Добавлены `Windows default microphone` и список microphone inputs; system output selector остаётся отдельной будущей задачей.
