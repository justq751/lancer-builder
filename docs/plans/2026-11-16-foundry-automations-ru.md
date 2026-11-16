# План: русский перевод Lancer Automations через lancer-ru-content

Статус: в работе. Сделаны этапы 2–6: все ключи `LA.*` переведены (3303 вручную, 122 из терминов сайта, 5 совпадают с английским); в словаре механизма C 1573 записи (196 шаблонов). Аудит находит 3212 литералов, без перевода 1554 — в основном шум (id, CSS, отладочные `log()`) и файлы вне чек-листа этапа 6 (тур, подсказки CodeMirror, `seasonal/`, редактор реакций). Этапы 0–1 и ручная приёмка требуют Foundry.

## Цель и рамки

Включены `lancer-automations` 4.5.5.2 и `lancer-ru-content`, язык Foundry русский. В этих условиях весь видимый текст модуля automations должен быть на русском: интерфейс, HUD, состояния и их описания, окна автоматизаций, сообщения чата, Effect Manager, простой (downtime), Battle Log. Термины берутся из переводов этого проекта: `locales/ru/*.json` и `GLOSSARY.md`.

Ограничения:

- Изменения только локальные, для себя. Автору ничего не отправляется.
- Файлы `lancer-automations` не изменяются. Весь перевод поставляет `lancer-ru-content`, поэтому обновление automations не стирает перевод. Новые и изменённые строки находит аудит (этап 8).
- Логические ключи automations не переводятся: имена реакций, `action.name`, `title` потоков, `name` эффектов, `data-la-key`, `id` состояний. Переводится только отображаемый текст, так же как `tr()` на сайте (ADR 0001).
- Сайт и его локали не затрагиваются: исходники перевода automations лежат в `foundry/`, вне `locales/` сайта. Голдены `tests/golden/` не меняются.

## Что установлено при обследовании

### Интерфейс на ключах `LA.*`

- `automations/lang/en.json`: 3430 строк, около 119 тыс. символов, 78 пространств ключей.
- В коде около 1500 вызовов `localize('LA.…')` / `localizeFormat('LA.…')` (`scripts/tools/string-utils.js` → `game.i18n.localize/format`). Шаблоны используют `{{localize "LA.…"}}`.
- Все 3060 ключей, найденных в `scripts/` и `templates/`, есть в `en.json`.
- Объём по пространствам ключей:

  | Пространства | Строк | Символов |
  |---|---|---|
  | `tokenHud`, `actionEconomy`, `status`, `statusShort`, `altStruct`, `dialogTitle`, `notify` | ~880 | ~31 тыс. |
  | `reaction*`, `effectManager`, `measure`, `scanUi`, `downtime`, `deployables`, `battleLog`, `award`, `telemetry` | ~450 | ~11 тыс. |
  | `settings`, `settingsMenus`, `keybindings`, `compat`, `configUi` | ~1100 | ~35 тыс. |
  | `tour`, `onboarding`, `onboardingUi` | ~460 | ~27 тыс. |

- Ключи Foundry глобальные. Языковой файл другого модуля, объявленный в `languages`, дополняет `LA.*`. Отсутствующие ключи Foundry показывает по-английски.

### Ключи, в которые подставляются данные

`LA.tokenHud.label.mount` = `"{type} Mount"`; `type` — сырое значение данных (`Main`, `Flex`, `Heavy`). Именно отсюда MAIN MOUNT / FLEX MOUNT / HEAVY MOUNT в HUD (`scripts/tah/hud-categories.js:760`, `:3451`). Одним языковым файлом параметр не перевести. Полный список таких ключей составляет аудит: это вызовы `localizeFormat`, в параметр которых передаётся поле данных.

### Состояния

- **Описания базовых состояний перекрываются английским.** `statusConfigText()` и `descriptionHtml()` в `scripts/bonuses/status-tooltip.js:236` берут текст в таком порядке:
  1. `LA.status.<id>.description`;
  2. `LA.statusShort.<id>`, если включена настройка `shortStatusTexts`;
  3. собственное описание состояния.

  В `LA.statusShort` 31 запись, среди них базовые `engaged`, `exposed`, `prone`, `stunned`, `slow`, `shredded`, `lockon`, `jammed`, `impaired`, `immobilized`, `invisible`, `hidden`, `intangible`, `shutdown`, `downandout`, `dangerzone`. В `LA.status` 24 записи, среди них `dazed`, `overheated`, `destroyed`. Без русского файла эти тексты вытесняют перевод `lancer-ru-content`.
- Готовые русские тексты для 16 базовых состояний есть в `locales/ru/statuses.json` (`terse`, `effects`).
- **Собственные состояния automations** (около 30) зарегистрированы в `scripts/setup/status-effects.js` на хуке `lancer.statusesReady`: Infection, Guardian, Bulwark, Phasing, Danger Zone, Burn, Overshield, Engaged, Bolster, M.I.A., Cascading, Resist All, Immovable, Disengage, Destroyed, Grappling, Grappled, Falling, Throttled, Blinded, Climber, Hover, Terrain Immunity, Surefoot, Reactor Meltdown и др. Названия зашиты в код, описания берутся из `LA.status.*`.
- **Названия состояний — логические ключи.** `findEffectsOnToken()` (`scripts/bonuses/flagged-effects.js:1074`) ищет эффект по `effect.name === имя`, `effect.name.toLowerCase().includes(имя)`, флагам или `effect.statuses.has(имя)` с учётом регистра. Поиск по английскому имени встречается для Suppress (5), Aided (4), Flying (3), Falling (3), Soft Cover (2), Armed (2), Resist All, Invisible, Friendly Interdiction, Disengage, Dazed. Если эффект создан с русским именем, такие проверки молча перестают срабатывать. Поэтому `name` в `CONFIG.statusEffects` и у эффектов не меняется, а переводится только отображение.
- В локалях проекта есть термины Brace (Стойка), Disengage (Отход), Bolster (Усиление), Shut Down (Отключение), Grapple (Захват), Lock On (Захват цели). Нет терминов для Aided, Blinded, Bulwark, Climber, Core Power Active, Datalinked, Dazed, Destroyed, Falling, Grappled, Grappling, Guardian, Hover, Immovable, Infection, Overheated, Phasing, Reactor Meltdown, Resist All, Surefoot, Terrain Immunity, Throttled, Staggered, Stripped, Vulnerable, Burn, Cascading, Hard/Soft Cover, Overshield, Flying.

### Текст, зашитый в код

Грубый поиск строк дал около 2150 кандидатов (с шумом: CSS-классы, иконки, ключи). Основные места:

| Что | Файл | Кандидатов | Источник перевода |
|---|---|---|---|
| HUD: действия Boost, Hide, Mount, Dismount… и их правила (`_simpleItem('Boost', …, BOOST_DETAIL)`) | `scripts/tah/hud-categories.js` | ~160 | `locales/ru/actions.json` |
| Реакции: названия и сообщения (Custom Paint Job, Improvised Attack, Standing Up…) | `scripts/activations/reactions-registry.js` | ~125 | новый перевод; имена предметов — `systems.json`/`weapons.json` |
| Автоматизации предметов: заголовки, вопросы, кнопки («INTERRUPT MOVEMENT?», «Sealant Gun Save», «Reload a Loading Weapon») | `startups/itemActivations.js` | ~170 | новый перевод; имена предметов — локали проекта |
| Effect Manager, длительности («End of Turn», «Start of Round»…) | `bonuses/effect-manager-template.js`, `effectManager.js`, `duration-widget.js` | ~170 | новый перевод |
| Простой (downtime): Buy Some Time, Get Focused… и тексты книги | `scripts/tools/downtime.js` | ~110 | новый перевод (в данных проекта нет) |
| Battle Log, итоги боя | `scripts/Battelog/recap.js` | ~120 | новый перевод |
| Карточки интерактивных инструментов («Line of sight», «Selected Targets»…) | `scripts/interactive/cards.js`, `extras-dialog.js` | ~120 | новый перевод |
| Обломки, структура, захват, стресс, прочее | `tools/wreck.js`, `alt-struct/*.js`, `combat/grapple.js`, `tah/statbar/token-config-tab.js`, … | несколько сотен | новый перевод |
| Тур и подсказки CodeMirror | `setup/tour.js`, `setup/codemirror-hints.js` | ~70 | низкий приоритет |

### Прочее

- `news.json` (20 КБ) — новости версий. По желанию: меняется с каждой версией.
- `extra/LaSossis_Npc_Deployables.lcp` — 5 развёртываемых объектов NPC. NPC проект не переводит, нужен отдельный небольшой словарь.
- `packs/macros` — компендиум макросов. Текст в LevelDB сжат, состав нужно смотреть в Foundry. Переводится через Babele, как справочники.
- `combat-telemetry-derive.js` сравнивает имена действий системы: `'SELF REPAIR'`, `'SCAN'`, `'OVERCHARGE'`, `'CORE POWER'`. Переводить их не нужно, но надо проверить, что `ru-ru` или `lancer-ru-content` не переименовывают эти действия в событиях. Иначе статистика Battle Log обнулится.
- `move-tracking.js:356` (`'Overcharge (NPC)'`), `statusFX.js:1498` (`'Flying'`, `'Hover'`), `reactions-engine.js:352` (общие реакции по имени), `reactions-engine.js:1098/1105` и `flow-steps.js:1074` (`action.name === actionName`) сравнивают английские имена. `lancer-ru-content` переводит `actions` у 38 предметов, поэтому совместимость реакций этих предметов проверяется отдельно (этап 1).

## Механизмы перевода

| Механизм | Что покрывает | Где |
|---|---|---|
| A. Языковой файл `LA.*` | весь интерфейс на ключах (3430 строк), описания состояний | `lancer-ru-content/lang/automations.ru.json` + запись в `languages` |
| B. Перевод параметров `format` | ключи с подставляемыми данными (`{type} Mount`) | обёртка `game.i18n.format` через lib-wrapper для явного списка ключей; параметры переводятся по `enums.json` |
| C. Перевод отображения по словарю | текст, зашитый в код; названия состояний и реакций | хуки `render*`, `renderChatMessageHTML`, наблюдатель за `.la-hud-*` и окнами automations; замена текстовых узлов и `title`/`data-tooltip` по точному совпадению |
| D. Babele | компендиум макросов `lancer-automations.macros` | `lancer-ru-content/compendium/` |

Правила механизма C:

- Заменяется только текстовый узел или атрибут, текст которого целиком совпадает с английским исходником. Атрибуты `data-*`, значения полей ввода и `name`/`id` не трогаются.
- Строки с подстановкой (`` `Regain ${healAmount} HP` ``) задаются шаблоном с группами (`^Regain (\d+) HP$` → `Восстановить $1 ОЗ`). Шаблон проверяется тестом на исходной строке.
- Неизвестный текст остаётся как есть: перевод никогда не ломает отображение.

## Исходники и инструменты

- `foundry/upstream/lancer-automations/` — снимок для генератора и CI, так как сам модуль в git не лежит: `lang/en.json`, `VERSION` и `literals.json` (извлечённые аудитом строки с файлом и строкой). Вручную не редактируется, обновляется командой аудита.
- `foundry/locales/ru/automations-lang.json` — `{ "LA.путь.ключа": {"en": "…", "ru": "…"} }` для механизма A. Пометка `"stale": true` ставится при изменении английского текста, как в `extract_locale_template.py`.
- `foundry/locales/ru/automations-text.json` — словарь механизма C: `{ "<английский текст или /шаблон/>": {"ru": "…", "where": ["scripts/…:строка"]} }`.
- `foundry/locales/ru/automations-format.json` — список ключей механизма B и словарь для каждого параметра (`{"LA.tokenHud.label.mount": {"type": "enums"}}`).
- `tools/audit_automations_i18n.py <путь к модулю>`:
  - обновляет снимок;
  - добавляет новые ключи с пустым `ru`, помечает изменённые `stale`, удаляет исчезнувшие;
  - извлекает строковые литералы из `scripts/`, `startups/`, `templates/` (без `console.*`, комментариев, CSS-классов, путей, иконок, ключей `LA.*`) и сверяет со словарём механизма C;
  - сверяет `id` состояний из `status-effects.js` и `LA.status*` с `statuses.json` и `GLOSSARY.md`;
  - печатает покрытие в стиле `locale_coverage.py` и всегда завершается с кодом 0.
- `tools/export_foundry_locale.py` получает новые выходные файлы:
  - `lang/automations.ru.json` (вложенный `LA`, только непустые `ru`);
  - `generated/automations-text.js`;
  - `generated/automations-format.js`.

  `--check` в CI сверяет и их.
- Автозаполнение при генерации: если английский текст ключа или литерала совпадает с термином проекта (`actions.json`, `statuses.json`, `enums.json`, `stat_labels.json`, `glossary.json`, `ui.json`, имена предметов), `ru` берётся оттуда. Ручной перевод имеет приоритет.

## Этапы

### Этап 0. Подготовка

- [x] Основная копия — `foundry/lancer-ru-content` (в git, её собирает `tools/export_foundry_locale.py`). Все изменения вносятся только в неё. Копия `foundry/module-merge/lancer-ru-content` не используется. `foundry/module-merge/automations` служит только источником для аудита.
- [ ] Отключить автообновление automations в Foundry или хотя бы фиксировать версию перед обновлением: после обновления нужно пройти этап 8.
- [ ] Проверить в Foundry 13, что запись `languages` с полем `"module": "lancer-automations"` загружается и не ломает мир без automations. Если поле не поддерживается, подключать файл без него: лишние ключи `LA.*` безвредны.

### Этап 1. Проверка совместимости до перевода

- [ ] В тестовом мире (ru, `ru-ru`, `lancer-ru-content`, automations) проверить реакции предметов, у которых `lancer-ru-content` переводит `actions` (38 предметов): срабатывают ли автоматизации и совпадает ли `action.name` с `actionName`.
- [ ] Проверить Overwatch, Boost, Stabilize и Overcharge (NPC), а также подсчёт `SELF REPAIR`/`SCAN`/`OVERCHARGE`/`CORE POWER` в Battle Log.
- [ ] Записать найденные поломки в раздел «Риски». Исправлять их только средствами `lancer-ru-content`: например, не переводить имя конкретного действия в данных и переводить его при отображении.

Готово, когда есть список того, что работает и что нет, с шагами воспроизведения.

### Этап 2. Инструменты

- [x] `tools/audit_automations_i18n.py` и снимок `foundry/upstream/lancer-automations/` (`VERSION`, `literals.json`; английский `en.json` не копируется — его тексты лежат в `automations-lang.json`).
- [x] Генерация `foundry/locales/ru/automations-*.json` с автозаполнением из локалей проекта (автозаполнение — при экспорте, в JSON остаётся пустой `ru`).
- [x] Экспорт `lang/automations.ru.json`, запись в `languages` в `module.json`.
- [x] Тесты (`tests/foundry/test_automations.py`, `tests/foundry/automations.test.mjs`, `tests/foundry-automations.spec.mjs`):
  - у каждой непустой `ru` те же плейсхолдеры `{…}` и те же HTML-теги, что у `en`;
  - нет ключей, которых нет в снимке `en.json`;
  - каждый шаблон механизма C совпадает со своей исходной строкой;
  - `--check` проходит.
- [ ] Макрос «латиница на экране» для Foundry (обратный `tests/en.spec.mjs`): собирает видимые текстовые узлы и подсказки с латинскими словами в HUD, открытых окнах и чате, с исключениями для имён собственных, единиц и обозначений вроде `d6`. Выводит список с селектором элемента.

### Этап 3. Состояния

- [x] Добавить в `GLOSSARY.md` термины для собственных состояний automations (список выше). Сверка с `ru-ru` не сделана.
- [x] `LA.statusShort.*` и `LA.status.*`: переведены тексты automations (они подробнее `terse`), термины — по `statuses.json`.
- [x] Отображение названий собственных состояний (механизм C, область `#token-hud`, `.la-*`, окна и чат): подсказки палитры состояний в Token HUD, панель состояний automations (`scripts/tah/status-panel.js`, `status-groups.js`), заголовки эффектов на листе и в Effect Manager. Механизм C, `name` не меняется.
- [ ] Проверить подсказку состояния при `shortStatusTexts` включённом и выключенном.

### Этап 4. HUD токена

- [x] Пространства ключей `tokenHud`, `actionEconomy`, `tokenStatBar`, `dialogTitle`, `common`.
- [x] Механизм B для `LA.tokenHud.label.mount`: «{type} крепление» с типом по `enums.json`. Остальные ключи с параметрами-данными (`plural`, `kind`, `hint`, `status`, `hit`) — по мере перевода их пространств.
- [x] Механизм C для действий HUD (Boost, Hide, Mount, Dismount, …) и их правил. Правила automations переписаны своими словами, поэтому переведены отдельно, а не взяты из `actions.json`. Атрибут `data-la-key` строки не меняется.

### Этап 5. Остальной интерфейс на ключах

- [x] `notify`, `altStruct`, `reaction*`, `effectManager`, `measure`, `scanUi`, `downtime`, `deployables`, `battleLog`, `award`, `telemetry` и остальные мелкие пространства.
- [x] `settings`, `settingsMenus`, `keybindings`, `compat`, `configUi`.
- [x] `tour`, `onboarding`, `onboardingUi`.

### Этап 6. Текст, зашитый в код

Порядок — по заметности в игре:

- [x] `startups/itemActivations.js`: окна и сообщения автоматизаций предметов. Имена предметов игрока — из локалей проекта; имена способностей NPC переведены своими словами (проект NPC не переводит). Имена классов NPC (Archer, Witch, Sergeant…) не переводятся, как имена шасси.
- [x] `reactions-registry.js`: отображаемые названия реакций и их сообщения в чате и окнах.
- [x] Effect Manager и длительности. «End of Turn» и подобные — только подписи `<option>`, в данных хранится `value` (`end`, `start`…). Опции без `value` не переводятся: их текст и есть значение. Исключение — окно простоя (`.la-downtime`): оно читает только `.value`, поэтому перед переводом английский текст закрепляется в атрибуте `value`.
- [x] `interactive/cards.js`, `extras-dialog.js`, `tools/wreck.js` (вкладка L.A в настройках токена), `alt-struct/*.js`, `combat/grapple.js`, `tah/statbar/token-config-tab.js`, `tah/status-panel.js`. Окно «No Equipment Available» не имеет классов `la-`, его селектор добавлен в SCOPE.
- [x] `tools/downtime.js` — действия простоя, тексты по книге. Отчёт о простое переводится и в окне, и на странице журнала (SCOPE `.journal-page-content:has(.lancer-border-primary)`).
- [x] `Battelog/recap.js`, `awards.js`, `gm-card.js`, `intro-terminal.js`, подписи из `combat-telemetry-derive.js`. Подписи с числом переведены в форме «УБИЙСТВ: 3», чтобы не склонять по числу.
- [x] Сообщения чата, которые automations создаёт с зашитым текстом: перевод при отрисовке наблюдателем (`.chat-message` в SCOPE). Сохранённый HTML сообщений не переписывается. Уведомления (`ui.notifications`) переводятся через `#notifications` в SCOPE.
- [x] Сверх чек-листа: подсказки состояний (`status-tooltip.js`: длительности, происхождение эффекта), строки карточки броска (`roll-card-rows.js`), подписи бонусов (`genericBonuses.js`), заголовки проверки заражения.

Изменения механизма C на этом этапе:

- Значения, захваченные группами шаблона, переводятся сами (рекурсивно): `/(.+) : (Success|…)/` → `$1: $2` переводит и название действия простоя, и исход. Поэтому общий шаблон вроде `/(.+) ×(\d+)/` переводит «AGILITY ×3» в «ЛОВКОСТЬ ×3».
- Аудит извлекает строки из выражений `${…}` внутри шаблонных строк (подписи `<option>`, вложенные шаблоны) и декодирует `\uXXXX`. Литерал с `{…}` считается покрытым, если шаблон словаря совпадает с ним после подстановки образца («1» или «Kai»). Вложенность `${…}` глубже двух уровней аудит по-прежнему не разбирает (часть `recap.js`), такие строки искались вручную.

### Этап 7. По желанию

- [ ] Компендиум макросов через Babele.
- [ ] Развёртываемые объекты NPC из `extra/LaSossis_Npc_Deployables.lcp`.
- [ ] `news.json`, `setup/tour.js`, подсказки CodeMirror.

### Этап 8. Обновление automations

После каждого обновления automations:

1. Запустить `py tools/audit_automations_i18n.py <путь к модулю>`.
2. Просмотреть `git diff foundry/upstream/lancer-automations/`.
3. Перевести новые пустые `ru` и перепроверить `stale`.
4. Проверить строки, исчезнувшие из словаря механизма C: их текст в коде изменился.
5. Повторить этап 1 для изменённых реакций.
6. Пересобрать модуль: `npm run foundry:build`.

## Риски и открытые вопросы

- **Поиск эффектов по английскому имени.** Исправлено в 0.1.15 для известных состояний: `lancer.statusesReady` восстанавливает английские имена в `CONFIG.statusEffects` после сборки из переведённых справочников; `preCreateActiveEffect` сохраняет английское имя при создании эффекта с известным ID. Подписи переводятся на экране, включая `.lancer .effect-name`. Регрессионные тесты проверяют поиск `Invisible`, повторную сборку списка, сохранение механики и пользовательских имён. Существующие эффекты не мигрируются — проблемные нужно снять и наложить заново. Проверка боя в Foundry остаётся ручной.
- **Перевод `actions` у 38 предметов** может нарушить сопоставление `action.name === actionName` (этап 1).
- **Тур automations** ищет строки HUD по английскому тексту (`setup/tour.js:540`) и при переводе HUD может их не находить.
- **Механизм C хрупкий.** Он зависит от вёрстки automations и точного английского текста. Аудит (этап 8) и макрос «латиница на экране» нужны, чтобы видеть, что отвалилось после обновления.
- **Длина русских строк.** В HUD фиксированная ширина колонок, и названия уже обрезаются («ТЕРМИЧЕСКАЯ ВИНТ…»). Возможны правки CSS в `styles/sheets.css` в рамках `.la-hud-*`.
- **Уже сохранённые данные мира** (эффекты, сообщения чата, предметы `downtime`) не переписываются; часть переводится только при отображении.
- **Колонки в подробном виде меха в Battle Log.** `recap.js` раскладывает панели по колонкам «нападение/защита/операции», сравнивая заголовок панели в DOM с английским списком (`PANEL_GROUPS`, `recap.js:313`). Заголовки приходят из `LA.recap.panel.*` и уже русские (этап 5), поэтому все панели попадают в последнюю колонку. Работе не мешает, вид хуже. Исправить можно только своим кодом, который после построения вида переносит панели по русским заголовкам.
- **Текст на холсте не переводится.** Всплывающие надписи над токенами (`Resisted`, `Vulnerable`, `Gained`/`Loss`, «+N Infection») рисуются PIXI, а не в DOM. Имя папки «Downtime Journal» — логический ключ (`game.folders.getName`), остаётся английским.
- **Заражение в сообщении об уроне.** `infection.js` дописывает заражение в сообщение системы, ища английское «damage!»; при русской системе сообщение не дополняется. Это не зависит от перевода automations.
- **Короткие фрагменты между тегами** (`for`, `against`, `takes`, `Give`, `Does`…) переводятся шаблоном по точному совпадению всего текстового узла. Узел с тем же словом в другом окне automations получит тот же перевод.
- Не проверено: состав `packs/macros`; поддержка поля `module` в `languages` в Foundry 13; сохраняются ли названия длительностей в эффектах.

## Ручная приёмка

Тестовый мир: Foundry 13, LANCER 3.1.3, `ru-ru`, `lancer-ru-content`, `lancer-automations` и его зависимости; язык русский.

- [ ] HUD токена: меню, категории, крепления, действия и их подсказки по правому клику.
- [ ] Палитра состояний и подсказки для базовых и собственных состояний при `shortStatusTexts` включённом и выключенном.
- [ ] Атака, урон, структура, перегрев, стабилизация: окна automations и сообщения чата.
- [ ] Реакция предмета с переведёнными `actions`, Overwatch, захват, падение, Aided — механика срабатывает.
- [ ] Effect Manager: создание эффекта с длительностью, отображение и снятие.
- [ ] Простой, сканирование, обломки, развёртываемые объекты.
- [ ] Battle Log и итоги боя, включая подсчёт ремонтов, сканов и форсажей.
- [ ] Настройки модуля, онбординг, тур.
- [ ] Макрос «латиница на экране» на каждом шаге выдаёт только известные исключения.
