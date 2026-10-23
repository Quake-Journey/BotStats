# Q2PRO-X BotStats

Статистика матчей людей против ботов OpenTDM-X по завершённым MVD2-записям.
Отдельные сервис и импортёр; модификация игрового мода не требуется.

Сайт: https://q2pro-x.com/botstats/?lang=ru&theme=auto

Русский и английский интерфейс, светлая/тёмная/системная тема, мобильная версия,
поиск игроков и карт, рейтинги, профили, статистика оружия, история скилла,
пинги и оригиналы MVD. Фильтры и сортировка сохраняются в URL.

## Запуск / Quick start

Node.js 22.17+ and MongoDB are required on the website host. The importer needs
Node.js and the native decoder, but does not need MongoDB or PM2. Both processes
can run on separate machines. No real recordings or production configs are bundled.

```sh
npm ci
```

1. Copy `config.example.json` to `server.production.json` and set the MongoDB URI,
   a dedicated database name and an absolute storage directory.
2. Generate a random ingest token (32 bytes or more); set it in the server config.
   See `docs/SECURITY.md`. The examples contain placeholders, not working secrets.
3. Start the website: `node src/server.js server.production.json`.
4. Build the decoder with `python native/build.py` (Python 3 + GCC/MinGW-w64).
   See `docs/DECODER.md`.
5. Copy `importer.example.json` to `importer.production.json`. Set the real MVD
   directory, decoder path, HTTPS API URL and the same ingest token.
6. Start the importer from the repository root:
   `node src/importer.js importer.production.json --watch`.

Local website: http://127.0.0.1:3085/botstats/
On Linux set the decoder path to `./bin/mvd-decoder`; on Windows use the `.exe`.
A bundled Node runtime can be used instead of a system installation.

Optional PM2, on each host that actually has it installed:

```sh
pm2 start ecosystem.config.cjs --only q2pro-botstats-server
# On the importer host, if PM2 is installed there:
pm2 start ecosystem.config.cjs --only q2pro-botstats-importer
```

Caddy routing inside the existing domain block (preserve `/botstats`):

```caddyfile
@botstats path /botstats /botstats/*
handle @botstats {
    reverse_proxy 127.0.0.1:3085
}
```

The importer ignores `.dm2`, waits for files to settle and validates the MVD2
end marker before ingestion. Uploads are authenticated and deduplicated by SHA-256.
Invalid files are not added to the rankings. Names are not authenticated accounts.
This is lightweight statistics, separate from Competition mode.

## Результаты и рейтинг

- Люди: обычная победа +B × K, поражение −min(4; 1/K); победа по forfeit 0, техническое поражение −5 **всего**. B зависит от игрового времени t в минутах: t < 2 → 0; 2 ≤ t < 10 → 1 + 9 × (t − 2) / 8; t ≥ 10 → 10. Паузы и разминка исключены, овертайм включён. K — средний по активному времени скилл / 200; для Human-X делитель 100. GOD-X 250 получает K = 1,25. При недостаточных данных о полном времени или необходимом скилле очки не выдумываются; короткая победа до 2 минут даёт подтверждённый 0 даже при неизвестном скилле. Формула общая для API и браузера, действует на старые и новые записи без повторного импорта.
- Боты: без коэффициентов и бонусов за низкий скилл, обычная победа +2, поражение −1; при forfeit +1, если бот вёл по фактическому счёту, иначе 0 (включая ничью).
- Ничья в завершённом матче: 0 для обоих. Рейтинги людей и ботов раздельные, общий и по картам.
- Периоды: сегодня, 3/7/30/365 дней включительно по МСК, всё время и свои даты.
- Овертайм и Sudden Death: отдельные отметки, победы/поражения и реальные итоговые счёт/длительность. Настройка overtime сама по себе не доказывает дополнительное время. Forfeit в ОТ остаётся техническим результатом.
- Выбор другого бота командой opponent и через меню разрешён модом только в вармапе. Если внешнее администрирование всё же заменит бота внутри матча, запись помечается opponent_changed и исключается из рейтинга; изменение скилла того же профиля заменой не считается.
- Фильтры, период, карта, вкладка, страница, матч/профиль, язык, тема и участник таблицы оружия сохраняются в URL.
- Техническое поражение входит в общее число поражений, имеет отдельную метку.
- Счёт при forfeit — фактический до прерывания, даже если проигравший вёл.
- Просто обрезанная запись или перезапуск без подтверждённого forfeit сохраняет
  последний счёт, но не создаёт выдуманную победу/поражение и очки.
- Очки/матч используют игры с рассчитанными очками, процент побед — игры с известным результатом. Средний
  счёт и его разница — все записи. Убийства, смерти и урон — только записи с
  итоговой серверной статистикой; количество таких игр хранится отдельно.
- Общие лидеры и лидеры по картам, профили с разрезом по картам; фильтры по нику,
  боту, карте, скиллу, стилю, версии, датам и результату.
- Переменный скилл берётся из истории имён и серверных объявлений, отображается Variable/Переменный с
  интервалами. Время интервалов исключает подтверждённые паузы.
- Пинги берутся из таблиц счёта, повтор на том же времени не умножает выборку.
  Среднее взвешивается по времени, значение держится максимум 5 секунд. Хранятся
  min/max, число наблюдений и покрытие. Нулевой пинг бота — показание сервера,
  а не измерение задержки его принятия решений.
- Версия мода используется только если она действительно найдена в данных MVD.
  Имя каталога и произвольный заголовок сервера её не доказывают.

- «О рейтинге»: https://q2pro-x.com/botstats/about?lang=ru&theme=auto — формулы, примеры, средние, периоды, технические исходы и переменный скилл; доступен английский перевод.
- «Разгромы»: https://q2pro-x.com/botstats/?view=defeats&lang=ru&theme=auto — подтверждённые поражения людей по разнице счёта в пользу бота. Forfeit отмечен, счёт до прерывания сохранён. Все колонки сортируются до разбиения на страницы, фильтры и сортировка входят в URL.

## API and storage

All paths are under `/botstats` by default:

- `PUT /api/ingest/demos/<sha256>` uploads an original MVD; `X-Ingest-Token` required.
- `POST /api/ingest/manifests` publishes its validated JSON manifest; same token.
- `GET /api/matches`, `/api/matches/<id>`, `/api/summary`, `/api/facets`,
  `/api/demos/<sha256>` and `/api/health` expose public data.

A manifest is only published after the matching file is stored and hash-verified.
All matches in a recording are replaced atomically as one MongoDB document.
Repeated uploads do not duplicate matches. Do not commit `data/`, queues, recordings,
logs, local/production JSON or signing keys. See `docs/SECURITY.md`.

## Tests

```sh
npm test
python tools/check-public-tree.py
```

The API test needs MongoDB on localhost and uses the separate database
`q2pro_botstats_test`. Other tests use synthetic inputs. Test output defaults to
`q2pro-botstats-tests` in the OS temporary directory; `BOTSTATS_TEST_DIR` overrides it.
Browser checks need a running local website and Playwright browsers:

```sh
npx playwright install
npm run test:browser
node test/ux.mjs
node test/cache-upgrade.mjs
```

## UI updates

At startup the service snapshots `public/` and computes a content-addressed asset
version. Restart the website process after updating UI files. The browser then
loads one coherent asset revision. UI or ranking formula updates do not require
clearing the database or re-importing recordings.

## Source and license

JavaScript and native decoder sources are included; dependency installs, native
binaries and local deployment tooling are excluded. The native decoder derives
from Q2PRO-X/Q2PRO and id Software code; upstream copyright notices are preserved.
Distributed under GPL-2.0-or-later; see `LICENSE` and `native/LICENSE`.
