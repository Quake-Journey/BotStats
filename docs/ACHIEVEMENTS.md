# Achievement calculation

Achievements are calculated by the website from stored match manifests. The importer, native decoder and game server require no update for the November 2026 cumulative achievement set. No rating points are added by achievements. Locked achievements remain absent from the public catalog.

## Cumulative set: 20 human and 20 bot awards

`src/progress-definitions.js` contains the bilingual definitions and thresholds; `src/progress-achievements.js` owns their calculation. Human identity is the recorded nickname; bot identity is its existing profile. The previous 24 human and 20 bot achievements retain their original rules.

- Count only normally completed human-versus-bot games. Forfeits, interruptions and excluded results never contribute.
- Most conditions require a confirmed duration of at least 600 seconds. Five map-specific conditions use 120 seconds. Use `victoryDuration`, including overtime; never substitute the recording fragment length.
- Wins use the normalized result. Kills use explicit kill statistics rather than net frags. Weapon, accuracy and pickup conditions require complete statistics and known counters. Legacy control pickups are a fallback, not an additional copy of pickup counts.
- Maximum skill means 200 for regular bots, 250 for GOD-X and 100 for Human-X, throughout the covered match timeline. Unknown or variable Hardcore/Training cannot satisfy constant-mode conditions.
- Unique calendar days are counted in Europe/Moscow. Unique maps are taken from qualifying games rather than a frozen map pool.

## Activation and existing history

At the website's first startup, `achievement_sets` gets one document with `_id: "completed-matches-2026-11"` and an ISO `activatedAt`. Atomic `$setOnInsert` preserves that timestamp across restarts and simultaneous process starts. Keep this collection in database backups; do not reset it when replacing website files.

Past qualifying progress is retained. An award requires crossing its threshold in a qualifying match whose known end time is after activation. Historical crossings, including late imports of old games, do not create retroactive awards. Missing dates cannot unlock these awards. As with existing achievements, source corrections or deletions cause recalculation.

Before releasing a changed set, verify that its thresholds have no already-qualified participants in a fresh public completed-match snapshot:

```text
node tools/audit-progress-achievements.mjs snapshot.json audit.json
```

The input is an object containing a `matches` array, optionally with `finishedAt`. The audit returns a nonzero exit status if an existing participant already meets a threshold. Do not move an established activation date forward to conceal such a conflict.

## Assets and checks

The 40 SVG icons are stored under `public/achievements/progress`. Reproduce them using `node tools/build-progress-icons.mjs`. Each has a distinct central symbol; human and bot frames also differ. The existing resource revision/cache and achievement index cache are reused.

Run the related tests with:

```text
node --test test/progress-achievements.test.js test/achievements.test.js test/bot-achievements.test.js test/home.test.js
```

The optional `test/progress-store.test.js` uses local MongoDB only when `BOTSTATS_TEST_MONGO=1`. It owns the isolated `q2pro_botstats_test_progress_20261114` database and verifies concurrent activation, reopening, and catalog invalidation after saving a qualifying match. It does not delete the database automatically.
