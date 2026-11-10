# Multiple importing servers and Online

This candidate requires coordinated website and importer configuration. It does
not publish the website or modify any running game/importer installation.
Existing single-server installations continue to work with their current JSON.

## Website configuration

Add an `online.servers` registry to the private website configuration. IDs are
permanent lowercase identifiers, independent of address, hostname, NAT or demo
filename. Names and fallback connection/access metadata come from this registry.
The registry is bounded to 32 entries. Duplicate IDs or source credentials fail
startup. Never reuse an ID for another server.

Example fragment for the two public servers. The website registry uses external
connection addresses; MINIPC's importer can still poll its internal address.

```json
{
  "online": {
    "defaultServerId": "default",
    "monitorOrigin": "http://127.0.0.1:3001",
    "tournamentOrigin": "http://127.0.0.1:3000",
    "servers": [
      {
        "id": "default",
        "name": "Q2PRO-X · Public duel",
        "address": "91.227.18.67:27950",
        "access": "public",
        "transport": "monitor",
        "q2tv": true
      },
      {
        "id": "minipc",
        "name": "MINIPC · OpenTDM-X",
        "address": "para.asuscomm.com:27910",
        "access": "public",
        "transport": "report",
        "q2tv": true,
        "sourceToken": "REPLACE_WITH_A_NEW_PRIVATE_RANDOM_TOKEN",
        "staleSeconds": 45
      }
    ]
  }
}
```

This is a fragment, not a replacement production configuration. Preserve all
existing database, storage, ingest-token, host/port and proxy settings. Verify
the existing monitor and Tournament origins on the target host before rollout.
Generate a distinct private token of at least 32 characters for each source;
the website rejects placeholders, shared source tokens, and reuse of its legacy
`ingestToken`. Copy a token only through the operator's private configuration
channel. Do not put it in Git, a command line, logs, screenshots or this package.

`access` is `public`, `lan`, or `private`. `q2tv: true` permits viewing once the
server has a public endpoint (registry or `sv_public_address`). It is an explicit
operator assertion that Tournament can reach it and supports its spectator policy. No arbitrary
address is accepted from the browser. Use `access: "lan"` only for an actual
LAN-only server, not for a public server whose importer polls a private address.
Copy-connect remains available on desktop; public Play and Q2TV require public
access. The server can advertise its external endpoint as described below.
Restart BotStats after saving the website configuration; editing JSON alone
does not reload the running registry.

### Public address advertised by the game server

Set a serverinfo cvar in the **game server's** persistent config:

```text
set sv_public_address "para.asuscomm.com:27910" s
```

The `s` flag includes it in ordinary UDP status. The importer forwards this
one validated public field; no additional RCON request is needed. Both monitor
and reporter sources prefer a valid `hostname:port` in `sv_public_address` for
header/Online display, desktop connect commands and new match source metadata.
That explicit advertisement labels the endpoint public. A missing, empty or
invalid value uses the existing registry address/access unchanged. Historical
matches are not rewritten. A temporary offline/stale observation retains the
last advertised endpoint until a successful observation changes or clears it.

Polling and RCON still use their original internal addresses. The cvar does
not enable Q2TV by itself: set `q2tv: true` for that server in the website registry.
Once enabled, the player page, bridge, WebSocket and file downloads all use its
resolved public address. An internal address without a public advertisement
does not enable viewing. Browser targets cannot override the resolved endpoint.
The fixed Tournament gateway must be able to reach it. Existing servers need no new
cvar. Website code and the reporter's `src/importer-status.js` must be updated
to read the new field; preserve the importer's config, credentials and queue.

Explicit registries do not inherit a global RCON password or Tournament `.env`.
If the existing public server already uses live Hardcore/Training reporting,
privately transfer its existing read-only `online.rconPassword` (or the existing
named environment value) to that server entry's `rconPassword`. Do not change
the game RCON credential. Missing RCON produces Unknown modes, never guessed
cvar values. Each entry may override `monitorOrigin` and `tournamentOrigin`.

## Importer configuration and rollout order

The website must accept the new contract before updating an importer. The legacy
global `ingestToken` and importers without `serverId` keep working. They cannot
claim a source ID or submit game status with that global credential.

After the website candidate is accepted and deployed, update a selected importer
with the `Importer/` payload and add the following fields to its existing private
configuration:

```json
{
  "serverId": "minipc",
  "ingestToken": "REPLACE_WITH_THE_SAME_PRIVATE_SOURCE_TOKEN",
  "status": {
    "address": "10.10.1.51:27910",
    "pollSeconds": 10
  }
}
```

Preserve `apiUrl`, `sourceDir`, decoder, queue directory, poll/settle settings,
timezone and task identity. Do not empty the queue, reimport historical demos,
or use `--force` for this migration. `status.address` is the endpoint reachable
from that importer. It may be a different internal address from the configured
display address. For modes, an optional private `status.rconPassword` enables
the fixed read-only `sv otx livestatus` query. Without it modes remain Unknown.

The existing watcher command remains unchanged. In `--watch` mode status runs on
an independent bounded timer (5–30 seconds, default 10); parsing or a missing
demo directory does not stop status observation. Each cycle performs a real UDP
`status` query (1.8-second limit), optionally reads effective modes, and sends a
report over HTTPS (7-second limit, redirects refused). Concurrent report cycles
cannot overlap. A non-watch run reports once if `status` is configured.

Restart only the selected importer through its existing owner/task after private
configuration is ready. The game service does not need a restart. This candidate
does not execute those steps on MINIPC. A website-only deployment will show
MINIPC as Missing until that separate migration is approved and completed.

## Status and identity contract

- `GET /botstats/api/online/servers` returns independent cached snapshots and
  configured public metadata for every server. No token, RCON credential or
  internal monitor/Tournament origin appears in a response.
- `GET /botstats/api/online?serverId=ID` and `/api/online/version?serverId=ID`
  select a configured server. Omitting ID keeps the configured default and old
  links working. `onlineServer=ID` persists UI selection in the page URL.
- `POST /botstats/api/ingest/status` requires both `X-BotStats-Server: ID` and
  `X-Ingest-Token` matching that source's private `sourceToken`.
- Reports have `schemaVersion: 1`, `serverId`, ISO `observedAt`, `state`, `info`,
  `players` and `modes`. `state` is `online`, `offline`, or `unavailable`.
  Player fields are `name`, integer-or-null `score`/`ping`, and optional
  boolean-or-null `spectator`. Modes are `hardcore`/`training`, each 0, 1, or null.
  Offline/unavailable reports must have empty info/players and null modes.
  Unexpected fields, private info keys, wrong ID, oversized or malformed values,
  future/expired timestamps and non-increasing observations are rejected.
- `receivedAt` is the website receipt time, separate from the observation time.
  Synchronize both hosts' clocks. More than five seconds into the future is
  rejected; delayed reports older than the freshness window are rejected.
- Monitor-backed entries poll in the background every 10 seconds, regardless of
  visitors. They have independent in-flight requests, status and mode caches.
  Readers never initiate polling. One failed source cannot block the server list.
- Freshness limits are 15–300 seconds, default 120 for monitor and 45 for report.
  Never-received and restarted reporter caches are Missing; fresh real responses
  are Online; an actual UDP timeout is Offline; query/transport errors are
  Unavailable; lost/expired observations are Stale. Stale cached players are
  labelled as old and live modes become Unknown. The importer merely running,
  a successful import, or the last recorded match is never proof of Online.
- Ordinary Quake II UDP status does not identify spectator membership reliably.
  With the existing private RCON credential, both the website monitor and the
  importer now read actual membership using `status`, `sv otx intermission`,
  then `status` again. The middle command is an existing **read-only** state dump;
  despite its name it never starts intermission or changes a match. Its explicit
  `team` field distinguishes playing clients (including dead clients awaiting
  respawn) from spectators. Slot numbers are converted from the mod's one-based
  edict IDs to the engine's zero-based client IDs. Both surrounding status reads
  must agree on map and slot identity. Ambiguous truncated names, reconnects,
  missing role rows, unsupported commands and failures remain Unknown.
  Polling is bounded and runs once per source cycle, not per site visitor. Raw
  RCON responses, addresses and credentials never enter the public report. The
  parser does not infer spectators from zero score, names or ping. Existing
  explicitly reported roles remain supported when RCON is unavailable.
  The same rule applies to monitor responses: numeric, absent, invalid or
  sentinel scores do not establish a role. A boolean `spectator` is authoritative;
  the monitor's exact `score: "Spectator"` marker is accepted when that field is
  absent. An explicit `spectator: null` stays Unknown unless the live membership
  read resolves it. No game/mod changes or new RCON commands are required.
- Each available `server` snapshot includes `counts` with `clients`, `players`,
  `spectators`, and `unknown`. The last three add up to `clients`. The UI labels
  the overall total Connected and separately labels each role count, including
  zero players when only spectators are connected. Unknown roles appear in
  their own group, never silently counted as players or spectators. Scores are
  preserved; spectator score changes and role transitions do not create frag
  trend arrows. Cached roster counts have the same freshness as their snapshot.

New attributed imports use the same two authenticated headers. Optional manifest
`sourceServerId` must match those credentials. Source metadata is stamped by the
website, never trusted from a demo or manifest. Stored `source` is included in
match API detail/list data and shown on the match page. Aggregate statistics and
SHA-256 demo/match IDs are unchanged. Source attribution is immutable after the
first import, including Unknown legacy data. A different source reusing an
already attributed SHA receives HTTP 409. Re-parsing may refresh statistics but
cannot move a demo between servers. No database migration or history rewrite is
required. In particular the previously imported MINIPC match remains Unknown;
this release does not invent provenance for that historical record.

## Q2TV and browser isolation

Explicit registries use `/q2tv/servers/ID/` and `/q2tv-mobile/servers/ID/` for
server-specific HTML, assets and relative downloads. The injected bridge binds
the iframe WebSocket to the same ID/address. The HTTP download address, encoded
player target and WebSocket target must match that configured entry; LAN/unknown
targets are rejected. Existing legacy default routes remain supported.
Switching servers destroys the previous iframe and clears score deltas and mode
state. A stale/offline server has a disabled start-viewing action. Static Q2TV
resources and spectator enforcement remain owned by Tournament; no native
JS/WASM/data rebuild is included in this update.

## Candidate verification and rollback

Run `node --test test/*.test.js` with an isolated test MongoDB. The new
`test/servers.test.js` exercises identities, validation/auth, real local UDP,
status expiry/recovery/restart, independent visitor-free polling, concurrent
readers, source storage/deduplication and real local HTTP/WebSocket selection.
`node test/servers-browser.mjs` starts and closes its own loopback services and
unique disposable test database; it checks RU/EN geometry, selection, player
closure, mode separation, stale/offline/recovery and match attribution. It uses
the repository's Playwright browsers. `BOTSTATS_BROWSER_EVIDENCE` selects only
the output directory for its screenshots/JSON. No public data is used.

Copy only the approved payloads after comparing their SHA-256 inventory. Keep
production databases, demo storage, queues, credentials and dependencies intact.
The website and importer payloads are separate rollout units. Before reverting
the website to the old schema, revert migrated importers to their original
private credentials and remove `serverId`/`status`. Restore only the prior source
and private configuration backups, never restore/reset the database or queue.
Do not reimport attributed demos using the old writer, which did not preserve
source metadata. Publication and live acceptance require separate operator/PO
evidence; local candidate tests do not establish either.
