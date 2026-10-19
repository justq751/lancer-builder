# upstream/ — снимки официальных данных Massif Press

Здесь лежат **сырые** `lib/*.json` из официальных репозиториев, байт в байт,
без нормализации. Сайт эту папку не читает и не публикует (исключена из
деплоя: allowlist `SITE_PATHS` в `deploy.yml` и `.assetsignore`).

Зачем: когда Massif что-то исправляет, `git diff upstream/` показывает
ровно их правки — что поменялось в тексте, какие id появились или пропали.
Без снимка это видно только как шум в нормализованных `data/`.

| Папка | Репозиторий | Что питает на сайте |
|---|---|---|
| `lancer-data/` | [massif-press/lancer-data](https://github.com/massif-press/lancer-data) | `data/lancer-data.json` (core book) |
| `ktb-data/` | [massif-press/ktb-data](https://github.com/massif-press/ktb-data) | `data/packs/ktb-data.json` |
| `dustgrave-data/` | [massif-press/dustgrave-data](https://github.com/massif-press/dustgrave-data) | `data/packs/dustgrave-data.json` |
| `long-rim-data/` | [massif-press/long-rim-data](https://github.com/massif-press/long-rim-data) | `data/packs/long-rim-data.json` |
| `osr-data/` | [massif-press/osr-data](https://github.com/massif-press/osr-data) | `data/packs/osr-data.json` |
| `ssmr-data/` | [massif-press/ssmr-data](https://github.com/massif-press/ssmr-data) | `data/packs/ssmr-data.json` |
| `sotw-data/` | [massif-press/sotw-data](https://github.com/massif-press/sotw-data) | `data/packs/sotw-data.json` |
| `wallflower-data/` | [massif-press/wallflower-data](https://github.com/massif-press/wallflower-data) | `data/packs/wallflower-data.json` |
| `ows-data/` | [massif-press/ows-data](https://github.com/massif-press/ows-data) | `data/packs/ows-data.json` |

`upstream.lock.json` — на каком коммите (и какой версии из
`lcp_manifest.json`/`package.json`) снят каждый снимок. Файлы снимков
руками не правим — только `tools/sync_upstream.py`.

**`data/lancer-data.json` и `data/packs/*.json` — чистый выход
`tools/normalize_pack.py`** из этих снимков. Руками их не правим: правка
пропадёт при следующей пересборке. Нужно иначе показать данные —
меняем нормализатор.

## Проверить, есть ли обновления

Обновляемся вручную, по необходимости:

```bash
py tools/sync_upstream.py status     # без скачивания; exit 1, если что-то отстало
```

## Процедура обновления

1. **Снять свежий снимок** (все репозитории или только отставшие):

   ```bash
   py tools/sync_upstream.py pull                 # или: pull ktb-data osr-data
   py tools/sync_upstream.py pull ktb-data --ref 2.0.2   # закрепить тег/коммит
   ```

2. **Прочитать правки Massif:** `git diff --stat upstream/`, затем
   `git diff upstream/<repo>/`. Отметить: новые/удалённые id, правки
   текста, изменения схемы (новые поля, другой формат тегов/действий).
   Удалённый или переименованный id — сигнал проверить миграции
   сохранений (`migrateLicenseKeys()` и др.) и ссылки `?s=`. Новый id
   тега — проверить, что он есть в `data/tags.json` (иначе тег получит
   название-заглушку из id).

3. **Пересобрать данные сайта** (можно все разом — без изменений в
   upstream выход тот же):

   ```bash
   py tools/normalize_pack.py upstream/lancer-data data/lancer-data.json core
   for r in ktb dustgrave long-rim osr ssmr sotw wallflower ows; do
     py tools/normalize_pack.py upstream/$r-data data/packs/$r-data.json $r
   done
   ```

   Затем `git diff data/` — должно совпасть по смыслу с шагом 2. Если
   upstream поменял схему (новое поле с текстом, другой формат), это
   видно здесь: доработать `normalize_pack.py` и пересобрать.

4. **Обновить шаблоны перевода и перевести:**

   ```bash
   py tools/extract_locale_template.py --lang ru
   py tools/locale_coverage.py --list
   ```

   Новые поля получат пустой `"ru"`. Если английский текст поля
   изменился, старый перевод остаётся и помечается `"stale": true` —
   его нужно сверить с новым английским, поправить и удалить пометку.
   `--list` выводит оба списка. Переводить по `GLOSSARY.md`.

5. **Тесты и эталоны:** `npm test` упадёт на `data.spec.mjs` — это ожидаемо.
   Просмотреть, `npm run test:update`, проверить `git diff tests/golden/`.
   Если менялся код (нормализатор не в счёт), поднять `APP_BUILD`.

6. **Коммит** одним изменением: снимок + `data/` + `locales/` + эталоны,
   в сообщении — `repo old→new` из вывода `pull`.

## Что нормализатор делает со схемой upstream

- Теги-объекты `{"id": "tg_heat_self", "val": 2}` → строки из
  `data/tags.json` (`"Heat 2 (Self)"`) — по ним сравнивает логика и
  переводит `trTag()`.
- `actions`/`deployables` систем, оружия, снаряжения, core bonuses и рангов
  талантов → дописываются в `effect`/`description` строками
  `<br><b>Имя</b> — …`. Действие пропускается, если его текст уже есть в
  прозе (`already_described()`); у реакций сохраняется триггер
  (`<i>Trigger:</i> …`), у рангов талантов — ещё тип и частота
  (`(Reaction, 1/round)`).
- У фреймов `passive_actions`/`active_actions` остаются структурными —
  их рисует `actionBlockHTML()`.
- Служебные поля для автоматизации (COMP/CON), которые сайт не читает,
  выбрасываются (`HOOKS`). `description` у оружия и core bonuses
  сохраняется, но сайт его пока не показывает и не переводит.
