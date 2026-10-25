# Достижения / Achievements

Достижения людей рассчитываются по всей доступной истории, независимо от фильтров
рейтинга. Они не меняют очки. Публичный каталог показывает только награды с хотя бы
одним текущим обладателем. Все значки игрока показываются целиком, с переносом строк.
Every award links to its rules, holders and qualifying matches. RU/EN, theme,
search, sorting, selected holder and evidence pagination are shareable through the URL.

24 достижения людей и 20 отдельных достижений ботов. Семь новых наград используют подтверждённую победу человека,
полное игровое время и неизменный скилл бота. Старые 17 условий сохранены.

| Новая награда | Условия |
| --- | --- |
| Отрицательный интеллект | Ровно 200 скилла; десятиминутный матч без овертайма; человек набрал 10+ фрагов, итоговый счёт бота ниже нуля. |
| Убийца богов | GOD-X 250; победа с перевесом минимум 15 фрагов. |
| Олдскул | 200+; 10+ фрагов у человека и явно подтверждённые 0 выстрелов из рейлгана. |
| Хирург | 200+; минимум 15 выстрелов рейлганом и точность минимум 50% по неокруглённым попаданиям/выстрелам. |
| Рельса приватизирована | 200+, q2duel5; минимум 10 подборов рейлгана человеком и явно подтверждённые 0 подборов ботом. Выпавшее оружие учитывается. |
| Личное пространство | 200+; минимум 3 телефрага по итоговой статистике. |
| Последняя минута | 200+; за минуту до конца основного времени отставание минимум 5 фрагов, затем победа без овертайма. |

Для всех семи исключены forfeit, незавершённые/неполные записи и замена бота.
Кроме «Отрицательного интеллекта», длительность — от 10 минут. Смена скилла
с последующим возвратом также исключает награду. У оружейных наград и телефрагов
нужна полная итоговая статистика; отсутствующие счётчики не превращаются в нули.
Старый процент точности без числа выстрелов не доказывает условие «Хирурга».
«Последняя минута» берёт последнее известное значение счёта на отметке до конца
основного времени минус 60 секунд, а не максимальное отставание за весь матч.

## Правила подсчёта / Counting policy

- Обычные условия используют завершённые матчи без forfeit. «Исследователь»
  считает именно технические поражения человека. Неподтверждённый конец матча
  не превращается в победу или поражение.
- Требование 200+ проверяется по минимальному скиллу за весь матч; ниже 100 — по
  максимальному. Среднее для рейтинга не заменяет эти ограничения. Human-X 100
  не считается скиллом 200. GOD-X 250 подходит для 200+.
- Ten-minute regulation requirements use the first overtime transition, not the
  total including extensions. Duration rules use active playing time. Partial
  recordings cannot establish full duration or full-match skill.
- «Человек-пушка» использует убийства из итоговой статистики, а не счёт после
  вычета самоубийств. «Курорт закрыт» требует полной статистики подборов обоих.
- Series follow chronological match order. Forfeits are skipped. An interrupted
  recording breaks a series. A different completed match breaks Cowboy if it
  does not satisfy its skill, duration and win conditions. Revenge requires the
  next completed match against the same character on the same map at no lower skill.
- Only «Груша для бота» is revoked by later results: ten-minute regulation losses
  minus wins must remain at least ten. Draws and forfeits do not change this balance.
  Other awards survive later losses. Corrections/deletions of source records can
  remove any award whose evidence no longer satisfies its rule.
- Unknown required fields are never inferred as qualifying values. Nicknames
  remain the existing lightweight player identity, not authenticated accounts.

The authoritative bilingual definitions are in `src/achievements.js` (server only).
Locked titles and conditions are not sent in the catalog API or client modules.

## API and storage

- `GET /botstats/api/achievements`: unlocked definitions and holders only.
- `GET /botstats/api/achievements/:id`: unlocked award and holder list; locked or
  unknown IDs return 404 without exposing their rule.
- `player`, `page`, `sort_award_evidence`, `dir_award_evidence`, `lang`: optional
  evidence selection, twenty matches per page. Sort runs before pagination.
- Award computation does not modify match documents. A service-local cache shares
  concurrent calculations, expires after 30 seconds and is invalidated immediately
  after an accepted import. No MongoDB migration or reimport is required.
- Awards never add rating points. Match results and rating calculations are independent
  of award ownership. This update also includes the documented bot win/loss formulas
  and parser 0.1.6 termination detection; see README and About the rating.
- Artwork: twenty-four original transparent emblems, delivered as 384px WebP plus
  80px miniatures under `public/achievements/`. No external image
  host is needed. Asset snapshots include the new CSS, modules and images.

## Verification

`node --test test/*.test.js` covers award thresholds, variable skill, overtime,
forfeits, series, revocation/restoration, evidence, cache invalidation and existing
parser/rating/API behavior. Requires the existing local test MongoDB.

`node test/achievements-browser.mjs` uses a running local preview with existing
recorded games. It checks Chromium, Firefox and WebKit at desktop/mobile widths,
RU/EN and light/dark/system themes. Expanded and empty catalogs are intercepted
only inside browser test contexts; they are never inserted into the database.
Screenshots/results use `BOTSTATS_TEST_DIR`, and browser binaries can be selected
through `PLAYWRIGHT_BROWSERS_PATH`.

`node test/bot-defeats-browser.mjs` checks the adjacent Bot Defeats ranking in
Chromium, Firefox and WebKit at desktop/mobile widths, RU/EN and light/dark themes:
human-first scores, sortable columns, shared filter URLs, reloads, forfeit exclusion
and the existing Human Defeats tab.


## Серия машин / Machine series

Боты получают отдельные 20 наград. Все уровни скилла одного профиля объединяются;
человек с таким же ником не получает награды бота. Условия человеческих наград
сохранены. Награды рассчитываются по всей истории; фильтры рейтинга их не меняют.
Награды скрыты, пока их никто не получил. Ни одна награда не добавляет очков.

| Награда / Award | Условия |
| --- | --- |
| Скайнет / Skynet | Победить человека с преимуществом минимум 50 фрагов. Победа без forfeit, матч от 10 минут. |
| Терминатор / Terminator | Выиграть у людей 10 матчей подряд, включая forfeit. Любая длительность. Поражение, ничья или запись без результата прерывают серию. |
| Искусственный разум / Artificial Mind | Выиграть у людей не менее 10 матчей без forfeit. Любая длительность. |
| Мясной комбинат / Meat Factory | Выиграть 20 матчей с преимуществом минимум 20 фрагов, включая forfeit. Любая длительность; учитывается фактический счёт до сдачи. |
| Судный день / Judgment Day | Победить человека с преимуществом минимум 30 фрагов. Победа без forfeit, матч от 10 минут. |
| Эндоскелет / Endoskeleton | Выиграть со счётом 20:0 или выше; у человека ровно 0 фрагов. Победа без forfeit, матч от 10 минут. |
| Красный глаз / Red Eye | Точность рейлгана от 60% при минимум 20 выстрелах. Нужны полные счётчики попаданий и выстрелов. Победа без forfeit, матч от 10 минут. |
| Без промаха / Perfect Sight | Попасть каждым из минимум 10 выстрелов рейлгана. Нужны полные счётчики попаданий и выстрелов. Победа без forfeit, матч от 10 минут. |
| Осадная машина / Siege Engine | Сделать минимум 15 убийств ракетницей. Нужна полная статистика оружия. Победа без forfeit, матч от 10 минут. |
| Стальной ливень / Steel Storm | Нанести минимум 2000 урона чейнганом. Нужна полная статистика оружия. Победа без forfeit, матч от 10 минут. |
| Плазменное ядро / Plasma Core | Сделать минимум 10 убийств гипербластером. Нужна полная статистика оружия. Победа без forfeit, матч от 10 минут. |
| Рельсовый протокол / Rail Protocol | На q2duel5 подобрать рейлган минимум 10 раз, не оставив человеку ни одного подбора. Выпавшие пушки тоже считаются. Нужна полная статистика подборов. Победа без forfeit, матч от 10 минут. |
| Реактор под охраной / Reactor Lock | На ztn2dm3 взять минимум 3 меги, не отдав человеку ни одной. Нужна полная статистика подборов. Победа без forfeit, матч от 10 минут. |
| Броневой завод / Armour Foundry | Взять минимум 10 красных арморов, человек берёт не больше 2. Нужна полная статистика подборов. Победа без forfeit, матч от 10 минут. |
| Железная дисциплина / Iron Discipline | Сделать минимум 30 убийств без единого самоубийства. Нужна полная итоговая статистика. Победа без forfeit, матч от 10 минут. |
| Перезагрузка / Reboot | Победить, уступая по ходу матча минимум 10 фрагов. Нужна подтверждённая история счёта. Победа без forfeit, матч от 10 минут. |
| Последняя директива / Final Directive | Выиграть 5 матчей в овертайме без forfeit. Основное время каждого — не менее 10 минут. |
| Все сектора захвачены / All Sectors Captured | Победить без forfeit на каждой из карт q2duel5, ztn2dm3, q2duel1 и q3t2. Каждый матч от 10 минут. |
| Охотничья сеть / Hunter Network | Победить 5 людей с разными никами без forfeit. Каждый матч от 10 минут; разные ники не доказывают разные личности. |
| Легион / Legion | Выиграть 100 матчей у людей без forfeit. Каждый матч от 10 минут. |

Forfait/forfeit: техническая победа принадлежит боту, даже когда он уступал по
счёту. «Мясной комбинат» проверяет реальный перевес перед сдачей, а не сам факт
технической победы. «Терминатор», «Искусственный разум» и «Мясной комбинат» не
имеют минимальной длительности; правила остальных указаны в таблице.

Each award links to its bot owner and qualifying human-versus-bot matches.
Evidence always displays the human : bot score order. Forfeit wins count only
where the rule explicitly allows them. Missing dates prevent a confirmed
chronological Terminator streak for that profile; cumulative awards still work.
Missing weapon or pickup counters are never treated as zero. Repeated match IDs
count once. Later losses do not revoke bot awards; corrected source data does.

Artwork: 20 original 384×384 SVG emblems with distinct full-size subjects and
silhouettes: a neural core, mechanical skull, explosion, sensor, weapons, armor,
shield and other machine imagery. Shared steel and red accents unify the series.
Checked at 32, 36, 80 and 152 px in both themes. Assets are under `public/achievements/bots/`. The reproducible generator is
`tools/generate-bot-awards.mjs`. Existing 24 human WebP emblems and miniatures
are unchanged. Nested assets are served with their actual image MIME type.

The All / Humans / Machines filter is stored as `awardKind` in the URL. Bot
badges appear in ratings, match cards and bot profiles; all link to the award.
The catalog and profile identity maps remain separate for humans and bots.

`node test/bot-awards-browser.mjs` starts an isolated ephemeral loopback service
using the real app/assets and in-memory fixtures. It checks all 44 awards,
all 20 machine icons, filters/URL/reload/Back, bot and human profiles, paginated
evidence and match links, very small point awards and About the rating.
Chromium/Firefox/WebKit, desktop/mobile, RU/EN, light/dark plus system switching;
fixtures never enter MongoDB. `BOTSTATS_TEST_DIR` selects screenshots/results.
