# Достижения / Achievements

Достижения людей рассчитываются по всей доступной истории, независимо от фильтров
рейтинга. Они не меняют очки. Публичный каталог показывает только награды с хотя бы
одним текущим обладателем. Все значки игрока показываются целиком, с переносом строк.
Every award links to its rules, holders and qualifying matches. RU/EN, theme,
search, sorting, selected holder and evidence pagination are shareable through the URL.

Всего 24 достижения. Семь новых наград используют подтверждённую победу человека,
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
- Existing parser, match results and rating formulas are unchanged.
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
