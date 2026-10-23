# Public source and private deployment data

This repository contains source code, public UI assets, synthetic test inputs and
configuration templates. It must not contain a running server configuration,
ingest tokens, database exports, recordings, importer queues or diagnostic logs.

Copy the example JSON files to ignored local/production files. Generate an ingest
token using `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
and configure the same token in the importer and service. Never send it in a URL.
Keep MongoDB private; expose the HTTP service through an HTTPS reverse proxy.

The importer requires HTTPS for remote ingestion. Both ingestion endpoints require
`X-Ingest-Token`. Uploads are size limited and checked against their SHA-256 before
the related manifest is published. Original recordings can contain player chat:
accepted demos are publicly downloadable from the website. The ingest token is
not used for reading the public statistics.

Check staged files before committing, even when a file is ignored: `.gitignore`
does not protect a previously tracked file. Run `python tools/check-public-tree.py`
and a secret scanner such as Gitleaks. Fixtures use test-only credentials.

The displayed player name is not an authenticated account. This service is
lightweight public match statistics, not an anti-cheat or Competition system.
