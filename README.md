# Q2PRO-X BotStats

Статистика матчей людей против ботов OpenTDM-X по завершённым MVD2-записям.
Отдельные сервис и импортёр; модификация игрового мода не требуется.

Сайт: https://q2pro-x.com/botstats/?lang=ru&theme=auto

Русский и английский интерфейс, светлая/тёмная/системная тема, мобильная версия,
поиск игроков и карт, рейтинги, профили, статистика оружия, история скилла,
пинги и оригиналы MVD. Фильтры и сортировка сохраняются в URL.
Внутренние ссылки сразу наследуют текущую тему, язык и фильтры, в том числе
при открытии в новой вкладке или копировании ссылки. Ссылка на конкретную
карту, матч или период сохраняет собственную цель. Параметры общей ссылки
имеют приоритет над сохранёнными настройками браузера.

В колонке «Победы» победного рейтинга показаны дата последней обычной победы,
дата последней игры (включая forfeit и прерванные записи) и полные дни/часы
с последней победы до обновления таблицы. Даты начала матчей показываются по
Москве и учитывают выбранные фильтры; неизвестная дата обозначается прочерком.
Справочные сведения не участвуют в сортировке: она использует число побед.

Раздел «Достижения» содержит 24 награды людей и 20 наград ботов с отдельными страницами, подтверждающими
матчами и кликабельными эмблемами в профилях и возле ников. Неполученные награды
скрыты. Достижения считаются за всю историю, без изменения рейтинговых очков;
старые записи учитываются без повторного импорта. Правила и API: [ACHIEVEMENTS.md](ACHIEVEMENTS.md).
Возле ников значки занимают один ряд: до пяти по доступной ширине, остальные
открываются через «+N». В профиле полный набор показан с названиями наград.

«Жертвы бота» показывают пары бот–человек по убыванию побед бота, включая forfeit.
Процент побед и средние фраги считаются по всем матчам пары с известным результатом,
включая поражения бота и ничьи. Фраги — итоговый счёт, при forfeit — до прерывания;
отсутствующие показатели не заменяются нулями. Дата последней победы — дата начала
матча по МСК. Варианты скилла одного профиля бота объединены. Период, карта, игрок,
бот, стиль, скилл, версия и результат фильтруются до расчёта. Все колонки сортируются,
фильтры и сортировка сохраняются в URL. API: `/api/victims`.

Рядом с «Разгромами людей» находится раздел «Поражения ботов»: подтверждённые победы
людей, отсортированные по разнице фрагов человек минус бот. Forfeit, ничьи,
незавершённые записи и матчи с заменой бота исключены. Все обычные фильтры и
сортировки доступны и сохраняются в URL. Сортировка применяется до пагинации;
отрицательный итоговый счёт бота сохраняется. API: `/api/matches?botDefeats=1`.

«Динамика» сравнивает число побед ботов и людей по датам начала
матчей (МСК), включая forfeit, без коэффициентов и фильтра по скиллу. Ничьи и
записи без подтверждённого результата не считаются победами. Для периода до 62
дней используется шаг в день, до 186 — неделя, до 1098 — месяц, далее — год.
Неполные крайние интервалы ограничены выбранными датами; дни без игр дают ноль
побед, но не выдуманный процент побед. Точка графика, период и фильтры сохраняются
в URL. Из точки можно перейти к матчам за соответствующий интервал.

Head-to-head trends use one win per confirmed result. A forfeit is always a human
loss and a bot win, even if the human led on score. The view always includes all
skills and forfeits; map, player, bot, style, version and date filters apply.
`GET /botstats/api/dynamics` returns the selected range, automatic time grouping,
both win series, forfeit counts and bot win share. The chart supports pointer,
touch and keyboard selection, with a sortable data table and RU/EN labels.

«Игроки» — отдельный список всех людей в выбранных матчах, включая участников
без побед. Сортировка по алфавиту, переходы по нику в профиль
и по дате в последний матч. Поиск здесь только по нику человека; период,
карта, сортировка и прочие фильтры сохраняются в URL. Рейтинговых мест и
переключателей рейтинга в списке нет.

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

The watcher tolerates demos being renamed while it scans (for example when the
recorder adds the final score to a filename). A vanished path is deferred; the
next poll discovers the new filename. A failing subdirectory or temporary file
access error does not prevent processing other files. Watch mode also reports
cycle/queue errors and retries at the configured polling interval without
resetting the saved import state. Only a missing state file starts a new state;
unreadable or malformed state is preserved for recovery. One-shot mode still
returns a nonzero exit code on errors. Updating this watcher does not require
clearing the queue, changing the decoder or reimporting completed demos.

## Результаты и рейтинг

- Победный рейтинг людей: сумма победных очков B × K; прежние коэффициенты длительности и скилла сохранены.
- Усреднённый рейтинг: индекс силы игры от 0 до 100 по завершённым матчам от 2 минут.
  Исход (75%), нормированная разница фрагов (25%), сила бота и длительность входят
  в логистическую модель с фиксированными уровнями ботов. Оценка уменьшена на
  неопределённость малой выборки. До 10 подходящих игр — предварительная таблица.
  Шкала: `100 × sigmoid(θ − 1.2815515655 × σ)`. Это не процент побед и не
  накопленные очки. Модель сохранена; прежняя условная база 1000 удалена.
  Формула и параметры в `public/performance-rating.js` и на странице «О рейтинге».
  Forfeit исключены полностью. Рейтинг пересчитывается по текущей выборке без импорта.
- Антирейтинг forfeit: доля технических поражений среди матчей с известным результатом,
  по убыванию; при равенстве — количество forfeit, матчей, имя. Неизвестный результат
  и смена бота исключены. Фильтр результата не применяется к антирейтингу.
- «Жертвы бота»: средний скилл по активному времени в победах бота, включая forfeit
  и изменения скилла внутри игры. Неизвестные значения не заменяются нулями.
- Мобильные внутренние страницы: общая сводка и последний матч свёрнуты отдельно.
  Состояния сохраняются в URL. Главная страница и десктоп остаются развёрнутыми.

- Боты: обычная победа +0,1…+10, forfeit +0,05…+5 на максимальном скилле.
  До 2 минут включительно — минимум, с 2 до 10 минут линейный рост, после 10 — потолок.
  Награда умножается на S/M: средний скилл по активному времени / собственный максимум
  (обычные боты 200, GOD-X 250, Human-X 100). Паузы исключены, овертайм включён.
  Победа по forfeit приносит очки даже при отставании по фактическому счёту.
  Поражение: −[0,01 + 0,99 × (S − 1) / (M − 1)]; скилл 1 → −0,01, максимум → −1.
  Неизвестные скилл и полная длительность не угадываются. Правило применяется
  к старым и новым матчам без повторного импорта; формулы людей сохранены.
- 20 отдельных достижений ботов: «Скайнет», «Терминатор», «Искусственный разум»,
  «Мясной комбинат» и другие. Собственные металлические значки с красной оптикой,
  условия и подтверждающие матчи; подробности в ACHIEVEMENTS.md.
- Ничья в завершённом матче: 0 для обоих. Рейтинги людей и ботов раздельные, общий и по картам.
- Периоды: сегодня, 3/7/30/365 дней включительно по МСК, всё время и свои даты.
- Овертайм и Sudden Death: отдельные отметки, победы/поражения и реальные итоговые счёт/длительность. Настройка overtime сама по себе не доказывает дополнительное время. Forfeit в ОТ остаётся техническим результатом.
- Выбор другого бота командой opponent и через меню разрешён модом только в вармапе. Если внешнее администрирование всё же заменит бота внутри матча, запись помечается opponent_changed и исключается из рейтинга; изменение скилла того же профиля заменой не считается.
- Фильтры, период, карта, вкладка, страница, матч/профиль, язык, тема и участник таблицы оружия сохраняются в URL.
- Техническое поражение входит в общее число поражений, имеет отдельную метку.
- Счёт при forfeit — фактический до прерывания, даже если проигравший вёл.
- Подтверждённые сервером перезапуск, отмена матча, досрочная смена карты и
  окончательный выход человека из активного матча — forfeit: человек проигрывает
  при любом счёте. Сохраняется счёт до сброса.
- Прерванная игра человека с ботом считается forfeit по правилу статистики,
  даже без финального объявления: техническое поражение человека и победа бота.
  Причина указана в карточке, счёт до прерывания сохраняется. Повреждённые или
  недописанные MVD2 по-прежнему не импортируются.
- Парсер 0.1.7 сопоставляет имя победившего бота независимо от смены скилла.
  Общая нормализация исправляет старые записи при чтении, до фильтрации и
  расчётов: обновление импортёра, повторная загрузка и очистка базы не нужны.
  Реальная ничья сохраняется; смена самого бота по-прежнему исключает рейтинг.
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
- «Разгромы людей»: https://q2pro-x.com/botstats/?view=defeats&lang=ru&theme=auto — подтверждённые поражения людей по разнице счёта в пользу бота. Forfeit отмечен, счёт до прерывания сохранён. Все колонки сортируются до разбиения на страницы, фильтры и сортировка входят в URL.

## API and storage

All paths are under `/botstats` by default:

- `PUT /api/ingest/demos/<sha256>` uploads an original MVD; `X-Ingest-Token` required.
- `POST /api/ingest/manifests` publishes its validated JSON manifest; same token.
- `GET /api/matches`, `/api/matches/<id>`, `/api/summary`, `/api/victims`, `/api/facets`,
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

## Online game server and shared Q2TV

The `Online` / `Онлайн` tab monitors `91.227.18.67:27950`. It uses the same
`/api/servers?game=q2&not_empty=0&ignore_bots=0` feed as Tournament's `servers.js`.
The backend coalesces requests for five seconds; the page refreshes every ten
seconds by default and pauses polling in a hidden tab. Stale data is labelled.
Refresh interval, player variant and roster sorting are shareable URL state.

When both applications are on the website server, no player copies are needed.
BotStats reads only `SERVERS_API` and `SITE_PORT` from
`C:\nodejs\Tournament\.env`. Q2TV HTML, WASM, data and WebSocket transport remain
owned by the running Tournament service. BotStats exposes them through its own
`/botstats/q2tv/`, `/botstats/q2tv-mobile/` and fixed-target WebSocket route so
the embedded player uses one origin and correct isolation headers. Existing
Caddy `/botstats` proxying must forward WebSocket upgrades (Caddy's normal
`reverse_proxy` does); no new public root routes are needed for the Online page.
The browser never receives the environment file or internal service addresses.

Current Hardcore/Training are read with the fixed read-only RCON command
`sv otx livestatus`: its `effective` fields include live vote overrides. Public
`sv_bots_training_mode` is only the server default and cannot replace this data.
Set `BOTSTATS_ONLINE_RCON_PASSWORD` in the existing Tournament `.env` (or in the
BotStats process environment); a private `online.rconPassword` JSON setting is
also supported. Never put the credential in browser assets or update archives.
Each Online refresh reads the effective modes, with simultaneous viewers sharing
one request and a maximum one-second cache. Failed reads show Unknown instead of
old on/off values. Only the two mode values and check time reach the browser;
the raw RCON response is neither exposed nor logged. No gameplay cvars are changed.

Optional overrides in the website JSON (omit for the existing Windows setup):

```json
"online": {
  "tournamentEnv": "C:/nodejs/Tournament/.env",
  "monitorOrigin": "http://127.0.0.1:3001",
  "tournamentOrigin": "http://127.0.0.1:3000",
  "server": "91.227.18.67:27950"
}
```

Deploy the accompanying Tournament spectator-policy update too. It restricts
**all** Q2TV sessions through the existing shared gateway, including sessions
opened from `servers.js`: forced spectator userinfo, blocked join/team/ready,
blocked inventory menu activation and unsupported commands. Camera movement,
chase controls, scores and connection/download handshakes remain available.
This restriction belongs to Tournament, not to the BotStats iframe or a hidden
Join button. Restart both website processes after the source update. Preserve
their `.env`, JSON configurations, MongoDB, demos and player resource directories.

The accompanying native Q2TV update supplies the requested map pack, two HTTP
download slots, native UDP fallback and launch `rate 250000`. Its assets remain
in Tournament's existing Q2TV roots; BotStats forwards the same HTTP-resource
endpoint only for its configured game server. See Tournament's `PUBLICATION.md`
for the matched JS/WASM/data deployment. If a server auto-joins spectators,
Q2TV detects the actual native playerstate and automatically exits to spectator
mode. It does not keep toggling an existing spectator/chase camera. No mod
changes are required for the tested OpenFFA and OpenTDM-X servers.

Player and bot profiles now page through all their matches, with `profilePage`
in the URL. Period/sort changes reset it, and opening another profile starts at
its first page. The totals and rating calculations still use all filtered games.

Q2TV's shared loader now keeps complete static resources in browser Cache Storage.
BotStats preserves Tournament's per-file SHA-256 versions, validators and cache
headers; HEAD requests remain HEAD upstream. Updating UI helpers does not require
downloading the map package again. Cache refusal/eviction falls back to normal
network loading. This is a website-code update; existing Q2TV native assets and
the importer do not need replacement. The origin's live status is never cached.

## Source and license

JavaScript and native decoder sources are included; dependency installs, native
binaries and local deployment tooling are excluded. The native decoder derives
from Q2PRO-X/Q2PRO and id Software code; upstream copyright notices are preserved.
Distributed under GPL-2.0-or-later; see `LICENSE` and `native/LICENSE`.
