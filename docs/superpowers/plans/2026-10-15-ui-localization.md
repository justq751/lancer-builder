# Локализация интерфейса — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** все тексты интерфейса — через `t()` и `ui.json`; две независимые
настройки языка (интерфейс / данные); при `en`/`en` на экране нет кириллицы.

**Architecture:** канонический английский в `data/ui.json`, перевод в
`locales/ru/ui.json` (пары `{en, ru}`, как у данных). `t()` и выбор языка —
чистые функции в `js/core/i18n.js`; загрузка, глобальные `UI`/`UI_LANG`,
статическая разметка и панель языка — в `js/i18n-loader.js` и `js/main.js`.
Перенос ~440 строк — файл за файлом под защитой неизменных русских
скриншотов и golden `L`.

**Tech Stack:** vanilla JS (обычные `<script src>`, без сборки), `node --test`
+ `vm` для `js/core/`, Playwright, Python-инструмент `tools/`.

**Spec:** `docs/superpowers/specs/2026-10-15-ui-localization-design.md`

## Global Constraints

- Без шага сборки; `js/core/` — без DOM, `localStorage`, `fetch`.
- Ключи `localStorage`: `lancer_ui_lang` (новый, язык интерфейса),
  `lancer_lang` (язык данных, смысл прежний).
- Файлы строк: `data/ui.json` (`{"ключ": "текст" | {"one","other"}}`),
  `locales/ru/ui.json` (`{"ключ": {"en": …, "ru": …}}`, плюралы —
  `{"en": {...}, "ru": {"one","few","many"}}`, опционально `"stale": true`).
- Ключи — только литералы в коде (`t("pilot.field.name")`). Семейство
  динамических ключей объявляется комментарием `// i18n-dynamic: a.b, a.c`
  рядом с использованием — его читает сверка ключей.
- Правила переноса — раздел 5 спецификации (значки в разметке, подстановки
  `{name}`, плюралы в `ui.json`, игровой термин со словарём в данных — по
  языку данных, `console.*` — английский без `t()`, «РЕЕСТР»/«REGISTRY»).
- Английский — терминами COMP/CON: *License Level*, *Mech Skills*,
  *Core Bonus*, *Pilot Gear*, *Loadout*, *Frame*, *Mount*, *Grit*.
- Ни golden `tests/golden/L.*.json`, ни 21 русский скриншот не должны
  меняться ни в одной задаче. Изменение = потерянная/искажённая строка →
  исправлять, а не переснимать. Единственное запланированное исключение —
  Task 3: кнопка языка в шапке десктопа меняет текст с `EN / RU` на `RU`.
- `npm test` зелёный в конце каждой задачи. Коммиты делает владелец
  проекта — в конце задачи остановиться и сообщить, что готово к коммиту.
- `APP_BUILD` в `js/i18n-loader.js` обновить в последней задаче.
- После правки `data/ui.json`: `py tools/extract_locale_template.py --lang ru`
  (на Linux `python3`), затем заполнить пустые `"ru"`.

## Review Focus

1. **Ключа нет в `UI`** (опечатка, забыли добавить) → на экране сам ключ,
   один `console.warn`, сайт работает. Тест — Task 1.
2. **Язык интерфейса переключили во время открытого модального окна или
   при открытой шторке** → окно закрывается или перерисовывается без
   смешения языков, ошибок в консоли нет. Тест — Task 3.
3. **Сборка с отброшенными элементами** восстановлена при `en` → диалог
   «что отброшено» по-английски (сообщения `js/core/build.js`). Тест —
   Task 5.
4. **Подстановка с пользовательским текстом** (позывной `<b>X</b>` в
   диалоге сброса / листе) → выводится как текст, не как разметка. Тест —
   Task 1 (экранирование) + Task 4 (диалог сброса).
5. **`locales/ru/ui.json` не загрузился** (404) при `ui=ru` → английский
   интерфейс, сайт работает, сборка не тронута. Тест — Task 2.

---

### Task 1: `t()`, плюралы, выбор языка, наложение строк (core)

**Files:**
- Modify: `js/core/i18n.js` (добавить в конец)
- Test: `tests/unit/ui-i18n.test.mjs`

**Interfaces:**
- Produces (глобальные функции, читают глобальные `UI` и `UI_LANG`,
  которые объявляет Task 2; в тестах передаются через `loadScripts(…, {UI, UI_LANG})`):
  - `t(key: string, params?: object) -> string`
  - `overlayUiStrings(en: object, ruPairs: object|null) -> object` — плоский
    `{key: string|forms}`, `ru` поверх `en`, пустой `ru` → `en`.
  - `detectLanguages(navLang: string|undefined, stored: {ui: string|null, data: string|null}) -> {ui: "ru"|"en", data: "ru"|"en"}`
  - `const UI_LANGS = ["ru", "en"]`

- [ ] **Step 1: Write the failing tests** — `tests/unit/ui-i18n.test.mjs`
  через `loadScripts(["js/core/i18n.js"], {UI, UI_LANG})`:
  - `t("a")` при `UI={a:"Alpha"}` → `"Alpha"`.
  - `t("missing.key")` → `"missing.key"`; второй вызов того же ключа не
    добавляет второго `console.warn` (подменить `console` в контексте,
    считать вызовы).
  - `t("hi", {name:"<b>X</b>"})` при `UI={hi:"Hi, <i>{name}</i>"}` →
    `"Hi, <i>&lt;b&gt;X&lt;/b&gt;</i>"`.
  - плюрал `ru`: `UI={n:{one:"{n} навык",few:"{n} навыка",many:"{n} навыков"}}`,
    `UI_LANG="ru"`: n=1 → `"1 навык"`, 2 → `"2 навыка"`, 5 → `"5 навыков"`,
    21 → `"21 навык"`.
  - плюрал `en`: `{one:"{n} skill",other:"{n} skills"}`: 1 → `"1 skill"`,
    2 → `"2 skills"`.
  - отсутствующая форма (`ru`, нет `many`) → берётся `other`, затем любая
    первая.
  - `overlayUiStrings({a:"A",b:"B"}, {a:{en:"A",ru:"А"}, b:{en:"B",ru:""}})`
    → `{a:"А", b:"B"}`; `overlayUiStrings({a:"A"}, null)` → `{a:"A"}`.
  - `detectLanguages("en-US",{ui:null,data:null})` → `{ui:"en",data:"en"}`;
    `("ru-RU",{…null})` → ru/ru; `("en-US",{ui:null,data:"en"})` →
    `{ui:"ru",data:"en"}` (пользователь до этапа 4); `("ru",{ui:"en",data:"ru"})`
    → en/ru; мусор в `stored` (`"de"`) считается отсутствующим.
- [ ] **Step 2: Run** `node --test tests/unit/ui-i18n.test.mjs` — FAIL
  (`t is not defined`).
- [ ] **Step 3: Implement** в `js/core/i18n.js`. Множество предупреждённых
  ключей — модульный `Set`. Экранирование — та же таблица, что `esc()` в
  `js/app/base.js` (`& < > "`), своя копия: `core` не зависит от `app`.
  Плюрал: `new Intl.PluralRules(UI_LANG).select(params.n)`; подстановка —
  `/\{(\w+)\}/g`, неизвестный параметр оставляет `{name}` как есть.
- [ ] **Step 4: Run** `npm run test:unit` — PASS (24 старых + новые).

### Task 2: загрузка строк, статическая разметка, сверка ключей, инструмент

**Files:**
- Create: `data/ui.json`, `locales/ru/ui.json` (генерируется),
  `tests/unit/ui-keys.test.mjs`
- Modify: `js/i18n-loader.js`, `js/main.js` (`startApp`),
  `tools/extract_locale_template.py`, `index.html` (только `<html lang>` не
  трогать — ставится кодом), `.github/workflows/deploy.yml` — не нужно
  (`data/` уже в `SITE_PATHS`)
- Test: `tests/unit/ui-keys.test.mjs`, `tests/lang.spec.mjs` (создать,
  один тест в этой задаче)

**Interfaces:**
- Consumes: `t`, `overlayUiStrings`, `detectLanguages` (Task 1).
- Produces:
  - глобальные `let UI = {}`, `let UI_LANG = "ru"` в `js/i18n-loader.js`
    (до любых функций);
  - `async loadUiStrings(lang: "ru"|"en") -> void` — грузит
    `data/ui.json`, для `ru` ещё `locales/ru/ui.json` (ошибка загрузки
    перевода → остаётся английский, `console.warn`), пишет `UI`, `UI_LANG`,
    `localStorage.lancer_ui_lang`, `document.documentElement.lang`;
  - `applyStaticStrings(root = document) -> void` — `[data-i18n]` →
    `innerHTML = t(key)`; `[data-i18n-attr="aria-label:k1;title:k2"]` →
    атрибуты;
  - `startApp()` сначала `detectLanguages(navigator.language, {ui: ls.lancer_ui_lang, data: ls.lancer_lang})`,
    затем параллельно `loadUiStrings(ui)` и `fetchAndLocalize(data)`, затем
    `applyStaticStrings()` до первого `render()`;
  - в `extract_locale_template.py` — функция `build_ui(old) -> dict` и
    вызов её в `main()` (не через `BUILDERS`, у неё другой источник);
    сообщение `ui.json: N stale` (N — число записей с `"stale": true`).

- [ ] **Step 1: Write failing tests**
  - `ui-keys.test.mjs`:
    - `used keys ⊆ data/ui.json`: собрать литералы `t("…")`/`t('…')` и
      `` t(`…`) `` без `${`, `data-i18n="…"`, ключи из
      `data-i18n-attr`, и списки из `// i18n-dynamic: …` по `js/**/*.js` и
      `index.html`; каждый есть в `data/ui.json`.
    - `no unused keys`: каждый ключ `data/ui.json` встречается в этом
      наборе.
    - `ru complete`: ключи `locales/ru/ui.json` == ключи `data/ui.json`;
      каждый `ru` непустой (для плюралов — все формы `one/few/many`);
      `en` в паре совпадает с `data/ui.json`.
    - `placeholders match`: множество `{x}` в `ru` == в `en` для каждого
      ключа (для плюралов — в каждой форме).
  - `lang.spec.mjs` → `"ui strings fall back to English when the Russian file is missing"`:
    `page.route("**/locales/ru/ui.json", r => r.fulfill({status:404}))`,
    `openApp(page, {build: FULL_BUILD})`; кнопка `#t-sheet` содержит
    английский текст (`"SHEET"`), ошибок `pageerror` нет,
    `getState(page).pilot.callsign === "ГОЛЕМ"`.
- [ ] **Step 2: Run** — FAIL (нет `data/ui.json`).
- [ ] **Step 3: Implement** загрузку, `applyStaticStrings`, изменения
  `startApp`. Засеять `data/ui.json` первыми ключами — шапка и загрузочный
  экран из `index.html` (`topbar.sheet`, `topbar.editor`, `topbar.my_build`,
  `topbar.more`, `topbar.link`, `topbar.print`, `topbar.import`,
  `topbar.export`, `topbar.reset`, `brand.name` = `"REGISTRY"`,
  `boot.init`, `a11y.skip`, `a11y.editor_h1`, `page.title`,
  `page.description`) и перевести эти элементы `index.html` на
  `data-i18n`/`data-i18n-attr` (тексты кнопок `syncModeChrome()` в
  `js/sheet.js` — через `t()` в этой же задаче, иначе их переписывает
  рендер). `build_ui` в Python: `pair()` + пометка `stale`, когда
  `old[key].en != new_en and old[key].ru`.
- [ ] **Step 4: Run** `py tools/extract_locale_template.py --lang ru`,
  заполнить `ru` в `locales/ru/ui.json`; `git diff locales/` — меняется
  только `ui.json` (остальные файлы инструмент переписывает идентично).
- [ ] **Step 5: Run** `npm test` — PASS; русские скриншоты не изменились.

### Task 3: панель языка (две настройки)

**Files:**
- Modify: `index.html` (`#t-lang`, новый `#lang-panel`), `js/main.js`
  (заменить `wireLangSwitch`), `css/app.css`, `tests/helpers.mjs`,
  `tests/persistence.spec.mjs:220-240`, `tests/smoke.spec.mjs:86`
- Test: `tests/lang.spec.mjs`

**Interfaces:**
- Consumes: `loadUiStrings`, `applyStaticStrings` (Task 2).
- Produces:
  - `async setUiLanguage(lang) -> void` — `loadUiStrings` →
    `applyStaticStrings` → закрыть модалку, если открыта (`closeModal()`)
    → `render()` → `renderLangButton()`;
  - `async setDataLanguage(lang) -> void` — прежняя логика кнопки
    (`fetchAndLocalize` → `rebuildIndexes` → `render`), строка «Данные»
    заблокирована и показывает «…» на время загрузки;
  - `renderLangButton() -> void` — текст `RU` / `EN` / `RU · EN`,
    `aria-label` = `t("lang.button_label", {ui, data})`;
  - разметка панели: `#lang-panel[popover]` > два
    `fieldset.langrow` (`legend` = `t("lang.ui")` / `t("lang.data")`) с
    `input[type=radio][name=ui-lang|data-lang][value=ru|en]` и подписями
    `RU · Русский` / `EN · English` (названия языков не переводятся), под
    ними `p.hint` = `t("lang.data_hint")`;
  - helper `setLanguage(page, {ui?, data?})` в `tests/helpers.mjs` —
    открывает `#t-lang` (на узком экране — сначала `#t-more`), щёлкает
    радио, ждёт `aria-busy` снятым, закрывает Esc.
- [ ] **Step 1: Write failing tests** в `lang.spec.mjs`:
  - `"switching the interface language keeps the build"`: `FULL_BUILD`,
    `setLanguage(page,{ui:"en"})` → `#t-sheet` = `"▤ SHEET"`,
    `document.documentElement.lang === "en"`, состояние равно исходному,
    `reload()` → всё ещё `en`.
  - `"Russian interface over English data"`: `setLanguage(page,{data:"en"})`
    → `#tab-btn-pilot` содержит `"ПИЛОТ"`, на вкладке «Шасси» имя шасси
    `"Blackbeard"`, кнопка `#t-lang` = `"RU · EN"`.
  - `"first visit in an English browser"`: `browser.newContext({locale:"en-US"})`,
    чистый `localStorage` (без `lancer_lang`) → `#tab-btn-pilot` содержит
    `"PILOT"`.
  - `"switching the interface language with a dialog open"` (Review Focus
    2): открыть сброс (`#t-reset`), затем `setUiLanguage("en")` через
    `page.evaluate` → модалка закрыта, ошибок нет.
  - обновить старые тесты переключения (`persistence.spec.mjs`
    «language switch», `smoke.spec.mjs:86`) на `setLanguage(page,{data:"en"})`.
- [ ] **Step 2: Run** `npx playwright test tests/lang.spec.mjs` — FAIL.
- [ ] **Step 3: Implement** разметку, обработчики, стили сегментов
  (существующие токены и `.chip`-шкала из `DESIGN.md`: моно 12px, радиус
  6px, выбранный — янтарь выбора; шторка ≤1020px — те же правила, что у
  `.moremenu`). Строки панели — ключи `lang.*` в `data/ui.json`.
- [ ] **Step 4: Run** `npm test`. Ожидаемо падают только десктопные
  снимки, где видна шапка (кнопка языка `EN / RU` → `RU`; на телефоне и
  планшете она в меню «⋯» и в кадр не попадает). Переснять
  `npx playwright test tests/visual.spec.mjs --update-snapshots=all`,
  просмотреть diff — изменилась только кнопка; затем `npm test` — PASS.

### Tasks 4–9: перенос строк

Общий порядок каждой задачи (шаги одинаковые, файлы разные):

- [ ] **Step 1:** выписать все кириллические строки файлов задачи
  (`grep -nP '[А-Яа-яЁё]'`, без комментариев), для каждой — ключ по
  таблице групп спецификации и английский текст.
- [ ] **Step 2:** добавить ключи в `data/ui.json`, прогнать инструмент,
  заполнить `ru` **дословно прежним текстом** (иначе изменятся скриншоты).
- [ ] **Step 3:** заменить строки в коде на `t()`; значки — снаружи.
- [ ] **Step 4:** `npm test` — PASS, golden и 21 русский скриншот без
  изменений; `grep -nP '[А-Яа-яЁё]'` по файлам задачи находит только
  комментарии.

Отдельные решения по задачам:

### Task 4: шапка, состояние, диалоги

**Files:** `js/main.js`, `js/app/state.js`, `js/app/transfer.js`,
`js/ui/modal.js`, `js/app/frame-swap.js`, `js/app/license-ui.js`,
`js/app/base.js`

- `state.js`: помощник `n()` удалить, сводка потерь —
  `t("loss.skills", {n})` и т. п. (плюралы); время —
  `new Intl.DateTimeFormat(UI_LANG, {hour:"2-digit", minute:"2-digit"}).format(lastSaveAt)`,
  строка `t("save.saved", {time})`.
- `base.js`: `STAT_RU` → ключи `term.stat.<key>.short` /
  `term.stat.<key>.long` (`// i18n-dynamic:` со всеми 14 статами); где
  уже есть `L.stat_labels[k]` — он остаётся первым.
- Тест (Review Focus 4) в `persistence.spec.mjs`: позывной
  `"<b>X</b>"` → диалог сброса содержит текст `<b>X</b>`, в DOM диалога нет
  элемента `b` с текстом `X`.

### Task 5: HUD, вкладки, core-сообщения

**Files:** `js/app/render.js`, `js/core/build.js`, `js/core/share.js`,
`js/i18n-loader.js` (сообщения об ошибке загрузки)

- `HASE` в `build.js` оставляет только `k`; названия и эффекты —
  `t("hase.<k>.name")`, `t("hase.<k>.short")`, `t("hase.<k>.effect")`
  (`// i18n-dynamic:` с 12 ключами). Потребители (`render.js`,
  `sheet.js`, `print.js`, `hase.js`, `state.js`) читают через функцию
  `haseLabel(k: string, part: "name"|"short"|"effect") -> string` в
  `js/core/build.js`.
- `dropped.push(…)` → `t("dropped.skill", {id})` и т. д.; юнит-тест
  `build.test.mjs` получает `UI` с этими ключами из `data/ui.json` +
  `locales/ru/ui.json` через `overlayUiStrings` и проверяет прежний
  русский текст.
- `share.js`: `throw new Error(…)` — английский текст без `t()` (это
  `console`-уровень: в интерфейс он не выводится — проверить по
  `consumeShareLink`; если выводится — ключ `error.share.*`).
- `TABS` в `render.js` → `[["pilot","tabs.pilot"], …]`.
- Тест (Review Focus 3) в `lang.spec.mjs`: `UNKNOWN_IDS_BUILD` при
  `ui=en` → диалог «Build partly restored» без кириллицы.

### Task 6: вкладки пилота

**Files:** `js/tabs/pilot.js`, `js/tabs/skills.js`, `js/tabs/talents.js`,
`js/tabs/hase.js`, `js/tabs/licenses.js`

- `llValueText` → `t("pilot.ll.valuetext", {ll, grit})`.

### Task 7: вкладки меха

**Files:** `js/tabs/frame.js`, `js/tabs/loadout.js`, `js/tabs/core.js`,
`js/tabs/summary.js`

### Task 8: окна выбора

**Files:** `js/ui/pickers.js`

- `DMG_SHORT`, `RNG_SHORT` → ключи `term.dmg.<Type>` / `term.rng.<Type>`
  (`// i18n-dynamic:`); `shortEnum` больше не смотрит на `currentLang`:
  сокращение берётся из `UI` всегда (правило 4: словаря в данных у
  сокращений нет).

### Task 9: лист и печать

**Files:** `js/sheet.js`, `js/print.js`

### Task 10: защитные тесты «EN без кириллицы»

**Files:**
- Create: `tests/en.spec.mjs`, `tests/unit/no-cyrillic.test.mjs`
- Modify: `tests/visual.spec.mjs`, `tests/mobile.spec.mjs`

- [ ] **Step 1: Write tests**
  - `no-cyrillic.test.mjs`: по `js/**/*.js` и `index.html`, после
    удаления комментариев (`/* … */`, `// …` до конца строки, `<!-- -->`) —
    нет `[А-Яа-яЁё]`; сообщение — файл и строка.
  - `en.spec.mjs` → `"no Cyrillic anywhere with English interface and data"`:
    `openApp(page,{build:FULL_BUILD, lang:"en", storage:{lancer_ui_lang:"en"}})`;
    функция `assertNoCyrillic(where)` собирает `document.body.innerText`
    (включая `#modal`), `title`/`aria-label`/`placeholder`/`alt` всех
    элементов; обход: 9 вкладок; на «Вооружении» — окно оружия (`[data-addw]`
    свободного крепления), систем (`#add-system`), мода (`[data-addmod]`),
    детали оружия (`[data-open="weapon"]`); на «Пилоте» — окно снаряжения
    (`[data-addpg]`); «Шасси» — детали (`[data-open="frame"]`); «Лицензии» —
    детали (`[data-open="license"]`); диалог сброса; панель языка; режим
    листа; `#print-sheet` (`buildPrintSheet(derived())`, затем текст
    элемента). Сообщение — `where` + первые 3 найденных фрагмента.
  - `visual.spec.mjs`: 2 снимка `en` — `desktop-pilot-en`,
    `mobile-loadout-en`.
  - `mobile.spec.mjs`: тест ширины — цикл по `[{ui:"ru"},{ui:"en", data:"en"}]`.
- [ ] **Step 2: Run** — если падает, найденные строки переносятся в
  `ui.json` (по правилам Tasks 4–9) до зелёного.
- [ ] **Step 3: Run** `npm test` — PASS; новые снимки просмотреть глазами.

### Task 11: `mods.json` в общий формат

**Files:** `tools/extract_locale_template.py`, `locales/ru/mods.json`

- [ ] **Step 1:** `build_mods(data, old)` по образцу `build_core_bonuses`:
  поля `name`, `effect`, `description` (+ те, что уже есть в старом
  файле, — сохранить их `ru`); добавить в `BUILDERS`.
- [ ] **Step 2: Run** инструмент; `git diff locales/ru/mods.json` — у
  каждого поля появился `"en"`, ни один `"ru"` не изменился.
- [ ] **Step 3: Run** `npx playwright test tests/data.spec.mjs` — PASS
  (golden `L` не сдвинулся).

### Task 12: глоссарий, ADR, документация

**Files:**
- Create: `GLOSSARY.md`, `docs/adr/0001-logic-keys.md`,
  `docs/adr/0002-no-build-step.md`, `docs/adr/0003-no-reserves-environments.md`,
  `docs/adr/0004-data-locale-format.md`, `docs/adr/0005-ui-localization.md`
- Modify: `CLAUDE.md`, `README.md`, `PLAN.md`, `PRODUCT.md`
  (Capabilities: две настройки языка), `js/i18n-loader.js` (`APP_BUILD`)

- [ ] **Step 1:** `GLOSSARY.md` — навык `mattpocock-skills:domain-modeling`;
  источник — `locales/ru/enums.json`, `stat_labels.json`, `data/ui.json` +
  русский; разделы по спецификации, «Открытые вопросы» — разночтения
  (минимум: «Blackbeard» → «Чёрная Борода» / «Блэкберд»; найти остальные
  поиском одного `en` с разными `ru` по `locales/ru/*.json`).
- [ ] **Step 2:** ADR 0001–0005 по-русски: «Контекст / Решение /
  Последствия», каждый ≤ 1 страницы; 0005 ссылается на спецификацию.
- [ ] **Step 3:** `CLAUDE.md` — раздел «UI strings» (правило: новый текст —
  ключ в `data/ui.json` + инструмент + `ru`; литеральные ключи или
  `// i18n-dynamic:`; две настройки языка); `README.md` — то же
  по-русски для переводчика; `PLAN.md` — этап 4 отмечен, журнал.
- [ ] **Step 4:** `APP_BUILD = "2026-10-15-ui-localization"`; `npm test` —
  PASS.
