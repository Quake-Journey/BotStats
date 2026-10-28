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

## Structured match settings (parser 0.2.0)

OpenTDM-X schema 1 records `OTX_MATCH_SETTINGS`, `OTX_MATCH_BOT` and
`OTX_MATCH_PARAMS` JSON lines in ordinary server print messages at level 2.
The native decoder already exports these messages; no new binary opcode or
decoder rebuild is needed. The importer parses the raw text before normalizing
Quake display characters. Chat text cannot introduce settings records.

`src/match-settings.js` groups snapshots by recording, decoder segment and
match interval, then snapshot id. It preserves raw records, native frame,
decoder timestamp and sequence, unknown fields, unsupported schemas and parse
errors in `recordedSettings`. Conflicting components are not interpreted.
Parameter completeness requires contiguous parts starting at zero and the 108
schema-1 parameter names in `src/mvd-settings-schema1.json`; a partial parameter
set is never filled with defaults. Valid settings/BOT fields remain useful even
when an unrelated parameter chunk is missing.

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
still counts as Variable. RCON changes are only observable at the next snapshot;
the displayed time is observation time, not a guessed command timestamp.

Shared `public/match-modes.js` computes K = Hardcore / Training. Each enabled
constant mode uses 1.2, a confirmed change relative to the start uses 1.1, and
off/unknown uses 1. Human positive points and bot penalties multiply by K;
human penalties and bot positive points divide by K. Both constant enabled modes
cancel exactly, as do two changed modes. Zero/unscored results remain zero/null.
The human 0–100 performance model incorporates K in opponent difficulty, rather
than multiplying its final bounded index. All aggregates and match explanations
use the same policy. Old manifests without modes retain their previous scoring.

Deploy the site **and importer** for new metadata support. Parser version 0.2.0
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
