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
