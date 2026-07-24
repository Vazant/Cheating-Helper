# 021 — Renderer storage API bootstrap

Статус: `DONE`

## Симптом

- AI Customization: `Cannot read properties of undefined (reading 'getPreferences')`.
- Groq keys, Settings, History, Feedback и Help отображаются пустыми или не работают.
- На диске при этом сохранены 3 Groq keys, 7 profiles и 2 history sessions.

## Корневая причина

1. `src/index.html` содержит `<cheating-daddy-app id="cheatingDaddy">`; Chromium предоставляет этот элемент как named global `window.cheatingDaddy`.
2. Настоящий API-объект со свойством `storage` присваивается `window.cheatingDaddy` только в конце `src/utils/renderer.js`.
3. В начале renderer используется `require('./speechCapture')`, но classic script загружен из `src/index.html`, а модуль расположен по `src/utils/speechCapture.js`.
4. Ошибка разрешения модуля останавливает renderer до публикации API. Компоненты получают named DOM element без `.storage`.
5. Поэтому выражение `window.cheatingDaddy.storage.getPreferences()` падает именно на чтении `getPreferences` у `undefined`.

## Карта ролей моделей

Изменений моделей и provider routing нет. Text, STT, vision и local inference не затрагиваются; исправляется только renderer bootstrap до обращения к существующему storage IPC.

## Минимальный план после подтверждения

1. `DONE` Исправить renderer import на путь, корректный относительно `src/index.html`.
2. `DONE` Убрать конфликт named global: переименовать DOM id и неизменно опубликовать API через `Object.defineProperty`.
3. `DONE` Гарантировать публикацию стабильного API до выполнения deferred web-component modules.
4. `DONE` Добавить dependency-free check, подтверждающий разрешение всех локальных renderer `require(...)` относительно HTML entrypoint.
5. `DONE` Прогнать storage/profile/audio/Groq/vision tests и Electron package.
6. `DONE` Собрать в новую portable-папку `System Container 3-win32-x64`, не используя installer cache.
7. `DONE` Выполнить smoke: Main keys, Settings, AI Customization, History, Help и Feedback.

## Результат проверки 2026-07-20

- `node --check src/utils/renderer.js` — passed.
- `node test/rendererBootstrap.test.js` — passed.
- Storage, profile, speech capture, audio, Groq и vision dependency-free tests — passed.
- `git diff --check` — passed.
- `npm.cmd run package` — Windows x64 package completed.
- Создана свежая portable-папка `out/System Container 3-win32-x64`.
- Ручной dev smoke: 3 Groq keys, 7 AI Profiles, 2 History sessions, Settings, Help и Feedback отображаются без renderer exception.
- Prettier запускался, но установка/загрузка инструмента заблокирована внешним npm cache/usage limit; diff check чистый.

## Критерии приёмки

- Свежий renderer публикует API до создания/загрузки зависимых views.
- `window.cheatingDaddy.storage.getPreferences` является функцией.
- UI показывает существующие 3 Groq keys без их перезаписи.
- AI Customization показывает 7 профилей, History — 2 сохранённые сессии.
- Settings, Help и Feedback открываются без renderer exceptions.
- Stop/restart не очищает credentials или history.

## Вопрос пользователю

Подтвердить исправление и сборку отдельной portable-папки `System Container 3-win32-x64`.
