# Native MVD decoder

The website does not execute native code. The importer invokes a separate decoder
after the MVD2 file has closed. `native/` contains the standalone exporter and the
38 source/header files it needs from Q2PRO-X, including upstream Q2PRO/id Software
copyright notices. It contains no bot gameplay code or game server configuration.
The decoder's license is in `native/LICENSE`; preserve the notices in each file.

Build with Python 3 and GCC (MinGW-w64 on Windows):

```sh
python native/build.py
```

The default output is `bin/mvd-decoder.exe` on Windows and `bin/mvd-decoder` on
Linux. Set `decoder` in the importer JSON to the resulting absolute path, or run
the importer from the repository root with that relative path. `--cc` selects a
compiler; `--output` selects another output location. Build artifacts are ignored.

Invocation: `mvd-decoder FILE`. The output is newline-delimited
JSON with segment metadata, configstrings, print/layout messages, player states
and match facts. `src/parser.js` derives the match manifest from that stream.
The original MVD remains unchanged. This decoder supports OpenTDM-X/Q2PRO MVD2;
the importer ignores `.dm2` and rejects unsupported or incomplete recordings.

`native/sources.json` records the published native source hashes. The initial
snapshot matches the source inputs used for the deployed BotStats decoder.

## Structured match settings (parser 0.3.0)

OpenTDM-X schema 1 records `OTX_MATCH_SETTINGS`, `OTX_MATCH_BOT` and
`OTX_MATCH_PARAMS` JSON lines in ordinary server print messages at level 2.
The native decoder already exports these messages; no new binary opcode or
decoder rebuild is needed. The importer parses the raw text before normalizing
Quake display characters. Chat text cannot introduce settings records.

`src/match-settings.js` groups snapshots by recording, decoder segment and
match interval, then snapshot id. It preserves raw records, native frame,
decoder timestamp and sequence, unknown fields, unsupported schemas and parse
errors in `recordedSettings`. Conflicting components are not interpreted.
Legacy parameter completeness requires contiguous parts starting at zero and
the 108 names in `src/mvd-settings-schema1.json`. Extended snapshots use the
component inventory described below. A partial set is never filled with defaults.
Valid settings/BOT fields remain useful when an unrelated parameter chunk is missing.

Effective Hardcore comes from SETTINGS.hardcore; effective Training comes from
the participating BOT.training, not training_server. Spectator bots do not
describe the duel. BOT rows are bound to slot identity history, so a disconnected
slot or same-named spectator cannot overwrite participant settings. Effective
numeric skill and style override legacy estimates at the recorded observation;
legacy information fills gaps. Fractional skill is retained. PA target delay is
preserved as metadata and never substituted for a measured scoreboard ping.

A `start` snapshot means recording started, and alone does not prove a full
match. Initial HUD score/time or Fight must corroborate the match opening.
`duration_seconds` is the configured limit, never elapsed playing time. An `end`
snapshot supplies final settings but does not prove completion or a winner.
Snapshots after the result do not extend playing time. The schema-1 reference
does not carry a version field: the scoreboard supplies the recorded version.
Optional explicit `mod_version`, when present and valid, fills a missing version;
no build label is inferred from a filename or an external report.

Matches expose `modes.hardcore` and `modes.training`, with initial/final values,
observations, active-time timelines, observed variation and change relative to
the initial state. Unknown initial values are null, never false. A switch back
still counts as Variable. The displayed time is observation time, not a guessed
command timestamp or command channel.

Shared `public/match-modes.js` computes K = Hardcore / Training. Each enabled
constant mode uses 1.2, a confirmed change relative to the start uses 1.1, and
off/unknown uses 1. Human positive points and bot penalties multiply by K;
human penalties and bot positive points divide by K. Both constant enabled modes
cancel exactly, as do two changed modes. Zero/unscored results remain zero/null.
The human 0–100 performance model incorporates K in opponent difficulty, rather
than multiplying its final bounded index. All aggregates and match explanations
use the same policy. Old manifests without modes retain their previous scoring.

Deploy the site **and importer** for new metadata support. Parser version 0.3.0
causes the watch importer to revisit files previously handled by an older parser.
SHA-256 match identities remain stable: ingestion upserts existing manifests and
does not create duplicate matches. No database reset is required. The website
cannot recover absent metadata from an old JSON without the corresponding demo
being reprocessed by the importer.

Optional native-reference check (Windows PowerShell, use your own paths):

```powershell
$env:BOTSTATS_SETTINGS_REFERENCE = 'C:\path\to\preview2-settings-reference.mvd2'
node --test test/match-settings.test.js
```

The reference is a controlled two-bot recording, not a real human match. It is
used to check all eight snapshots and 108 parameters per snapshot and must not
be published as a human-versus-bot rating result.

## Preview 4 gameplay extension (still schema 1)

Three additive print prefixes are recognized at level 2, anchored at the start
of the line and JSON-decoded before Quake text normalization:

- `OTX_MATCH_GAMEPLAY`: selected `id`, `modified`, `generation`, `pending`,
  roster `opponent`, `factory_sha256`, plus schema/snapshot/event/native frame.
- `OTX_MATCH_BASE_PARAMS`: configured server values, separately from effective
  `OTX_MATCH_PARAMS`. Both use independently numbered `part` values starting
  at zero. Neither has a final-part marker or declared part count.
- `OTX_MATCH_PARAM_TEXT`: `source` (effective/configured), `cvar`, `part`,
  `last` (0/1), and decoded string `value`. Fragments are joined without a
  separator; exactly one final marker must be on the last contiguous part.

Identical duplicates are harmless. Conflicting parts/values are retained as
evidence and are not interpreted. A broken fragment sequence invalidates its
value, not unrelated valid components. Event/frame disagreements invalidate the
snapshot's interpretation. Unknown fields, unknown IDs, unsupported schemas and
parse failures remain available in raw records/unparsed records. Snapshots are
assembled separately per input recording, decoder segment and match boundary.

`src/mvd-gameplay-inventory.json` is a declaration, not bot code or preset defaults.
It records source revision `cf86003230da1607855693753b7e1b82064cf4ab`, the known
factory-set fingerprint, all 145 projected names and the 228 observed recording
parameters. `completeness` separates settings, bots, gameplay, effective and
configured sources, with missing/unknown keys and fragment errors. Unknown
fingerprints or additional unrecognized parameters cannot claim inventory
completeness. The fingerprint identifies all seven factory objects, not one
preset, a mod version or an eternal schema revision. Matching this known inventory
does not identify a future producer revision which emits exactly the same data.
228 is a fixture/revision check, not a universal requirement. Legacy records
retain their independent 108-name contract; absent extensions are not corrupt.

`match.gameplay` contains initial/final values and timelines for preset,
Modified, pending count, behaviour model and aggression policy. It also contains
observations and a change history grouped into gameplay/effective/configured/bot
scopes, with before/after values, original native frame, decoder time and active
match time. Raw snapshot values stay strings; aggression is displayed as -1 =
profile, otherwise 0..100 percent (1 means 1%). Model means behaviour, not skin.
The opponent uses BOT roster/slot/connection history, never a spectator's cvars.
Slot reuse across a disconnect cannot supply the earlier participant's settings.

`server` is Server configuration, not Regular. Preset selection, Modified,
effective changes, base-only changes and pending count changes are independent.
Pending cannot reveal which fields are waiting, nor grant unobserved defaults.
An identical end snapshot does not create a change; A -> B -> A remains Variable.
Missing initial observations stay null. Invalid/missing final components stay
null rather than presenting an earlier value as a confirmed final observation.
Pauses and match bounds use the existing parser clock, never native frame / 10.
An end snapshot following the result does not add playing time or prove a result.
Existing modes/forfeits/skill weighting/ratings are unchanged; there is no new
preset or aggression rating factor.

The match API persists all metadata. Match lists and achievement aggregation
exclude large raw snapshots and gameplay histories. The RU/EN match page shows
the key initial/final states, expandable changes, and lazy-rendered snapshot
details with effective/configured sets kept separate. Older manifests remain
readable and show Not recorded rather than invented presets.

Bounds: 128 KiB per record, 1,024 ordinary parts, 1,024 entries in an ordinary
part, 256 text fragments per value, 65,536 decoded characters per value, 2 MiB
of raw structured metadata per recording and the existing 8 MiB ingest manifest
limit. Over-limit recordings fail with `MVD_METADATA_LIMIT`, are reported in the
local importer state and are not partially uploaded. Originals and any previous
database entry remain intact. Increasing a future supported limit requires a
parser-version change (or an explicit importer `--force` after that fix).

### Reprocessing and verification

Update the website and importer source together; keep the existing native decoder,
Node runtime, configs, ingest secret, queue/state, MongoDB and MVD storage. On its
next scan, the importer revisits files whose stored parser version is older than
0.3.0. The same MVD keeps its SHA and match IDs; ingestion replaces its manifest
without duplicate matches. No database reset or state deletion is required.
Files no longer present at the importer cannot be reprocessed automatically.
Old MVDs which never recorded the extension cannot acquire it retroactively.

Tests: `test/gameplay-settings.test.js` uses explicitly synthetic text scenarios;
`test/gameplay-native.mjs` compares every effective/configured field, all gameplay
headers and all BOT rows with a private producer reference. Set
`BOTSTATS_GAMEPLAY_REFERENCE` to its `recording-check.json`; optionally set
`BOTSTATS_GAMEPLAY_PROJECTION` to the producer's `gameplay_projection.json` to
verify the declaration against its source. The same reference enables
`test/gameplay-service.test.js`: real native parse and importer upgrade through
authenticated ingest, reload from isolated MongoDB, stable IDs, unchanged rating
and no duplicate. `test/gameplay-browser.mjs` checks the isolated preview in
Chromium/Firefox/WebKit, RU/EN, light/dark and 320/390/1440 px.
Technical/synthetic recordings must never be sent to public rankings.
