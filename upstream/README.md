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

## Проверить, есть ли обновления

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
   сохранений (`migrateLicenseKeys()` и др.) и ссылки `?s=`.

3. **Пересобрать данные сайта** (пока — только паки; core см. ниже):

   ```bash
   py tools/normalize_pack.py upstream/<repo> data/packs/<repo>.json "<label>"
   ```

   `<label>` — только подпись в выводе (например `KTB`). Затем `git diff data/packs/` — должно совпасть по смыслу с шагом 2.
   Ручные правки, которые нормализатор затирает, всплывут здесь —
   их нужно вернуть или перенести в `normalize_pack.py`.

4. **Обновить шаблоны перевода** для затронутых категорий:

   ```bash
   py tools/extract_locale_template.py --lang ru --only weapons.json,systems.json
   py tools/locale_coverage.py --list
   ```

   Новые и изменившиеся поля получат пустой `"ru"`. Переводить по `GLOSSARY.md`.

5. **Тесты и эталоны:** `npm test` упадёт на `data.spec.mjs` — это ожидаемо.
   Просмотреть, `npm run test:update`, проверить `git diff tests/golden/`.

6. **Коммит** одним изменением: снимок + `data/` + `locales/` + эталоны,
   в сообщении — `repo old→new` из вывода `pull`.

## Известные ограничения

- `data/lancer-data.json` (core) — **в старой плоской схеме** из исходного
  монолитного конструктора, а не upstream 4.x. `normalize_pack.py` для него
  пока не проверялся; снимок `upstream/lancer-data/` на первом этапе служит
  для сверки (что исправлено в upstream и не попало к нам), а не для
  автоматической пересборки. См. этап 8 в `PLAN.md`.
- На момент первого снимка (2026-10-19) нормализация паков воспроизводит
  текущие `data/packs/` почти точно; расхождения — в `PLAN.md`, этап 8.
