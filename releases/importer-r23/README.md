# BotStats importer r23 — 2026-10-31

Installed and accepted by the operator. The update contains only
`src/importer.js` and Russian installation instructions. It preserves the
production configuration, queue, parser, decoder, dependencies and database.

[Download the accepted update](BotStats_Importer_Rename_Fix_2026-10-31_r23.zip).
Extract into the existing importer directory and restart it with its existing
configuration and `--watch`. Do not clear the queue or use `--force` for this fix.

## Fixed

- An MVD2 renamed after directory enumeration no longer crashes `stat()` outside
  the recording error handler. The next poll discovers the renamed recording.
- A failing subdirectory does not abort processing of other directories.
- Watch mode reports cycle/queue failures and retries at the normal poll interval.
- Only an absent state file starts empty; unreadable/corrupt state is preserved.
- Renaming after parsing but before upload no longer creates an unhandled eager
  stream error. The awaited upload iterator opens lazily and closes its handle.
- Existing settling, unfinished/invalid-file rules, completed-file skips and
  server-side content deduplication remain in place. One-shot errors remain nonzero.

## Verification

The original stat/rename failure was reproduced before the fix. Importer and
parser checks:34 passed. Extracted update checks:6 passed, on Node24.11.1.
Coverage includes disk renames at enumeration and upload boundaries, access and
subdirectory failures, local HTTP ingestion under the final filename, duplicate
skips, and a real watch process recovering from missing source/corrupt queue.
The decoder was isolated by its NDJSON contract; the operator's exact recording
was not available locally. Production parsing logic and decoder were unchanged.
Archive contents and extracted importer bytes verified; secret scan passed.

Archive SHA256: `9c6c565b5ddc06af94be5643165b363eb1f5319767a1739f443ad293f5e68bd9`.
