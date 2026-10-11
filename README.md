# Glyph Lab / Eira edition

A complete static, privacy-first Accelerando-8192 encoder/decoder. No model, backend, build step, package install, or runtime external requests. Text and images are processed in the browser only; no message history is persisted. Downloaded exports contain the glyphs (not plaintext).

## Run on desktop

Use Python 3: `python -m http.server 8766 --bind 127.0.0.1 --directory .` from this project directory, then open http://localhost:8766/. On Windows, double-click `Start-Glyph-Lab.cmd` (requires the `python` command). Do not open index.html via file://; module/fetch security blocks it.

## Home Wi-Fi / iPhone

Serve with `python -m http.server 8766 --bind 0.0.0.0 --directory .`. In Safari open `http://<PC-LAN-IP>:8766/` on the same Wi-Fi. Allow Python through the Windows firewall on Private networks only if needed. The PC must remain awake and serving; guest-network isolation may block access. Plain LAN HTTP is not a secure-context offline PWA: no service worker or dependable offline installation. Clipboard buttons fall back to selecting text; tap Copy in the selection menu. iOS downloads may open a preview: use Share → Save to Files.

## HTTPS / installable offline app

The app supports relative-path static HTTPS hosting, including a GitHub Pages subdirectory. Publishing is a separate operator decision: first review THIRD_PARTY_NOTICES.txt because upstream glyph/site code has no explicit reuse license. Publish only index.html, style.css, app.mjs, sw.js, manifest.webmanifest, icons, README.md, THIRD_PARTY_NOTICES.txt, and assets/. Exclude private source/package/report/launcher files. No user text or photos are bundled.

Open the HTTPS URL in Safari, wait for “Offline assets cached”, then Share → Add to Home Screen. Open the installed app once online before relying on it offline. The service worker caches the app, local dictionary and modules. Safari may evict website storage; offline availability cannot be guaranteed after eviction. To deploy updates increment CACHE in sw.js; close old app windows and reopen after the update activates. Browser cache remains until cleared; no plaintext/image inputs are cached.

## Features and exactness

- Encode UTF-8 text using the actual custom 8,192-rank BPE tokenizer; SVG preview and exports, tightly cropped glyph-only PNG exports (no labels, footer, or checksum strip), token IDs, and supplementary private-use Unicode U+F0000–U+F1FFF.
- IDs and Unicode recover exact UTF-8 bytes including BOM, whitespace and partial-token byte sequences. HTML textareas normalize CRLF/CR line endings to LF before encoding and when showing decoded output; the underlying codec preserves raw CRLF bytes. Invalid UTF-8 or out-of-range/nonseparator input produces explicit errors.
- SVG decoding matches path geometry, never trusts hidden text or token metadata, never renders uploaded SVG. It accepts only the exact Glyph Lab / eacc.world exported M/L layout (16 columns, 62-pixel cells). Arbitrary SVG transformations/font-based SVGs are deliberately rejected.
- PNG/JPG recognition is deterministic: official transmission layout uses shape templates plus CRC. Plain-background crops use conservative geometric matching with agreement at multiple thresholds. No language guessing. Screenshots must be straight, separated, sharp glyphs; rotations, merged glyphs, perspective, complex backgrounds, lossy JPEGs or incomplete crops may reject. A CRC is error detection, not authentication. Cropped reads lack a checksum and cannot establish that the source was not modified.
- Image decoder uses module workers/OffscreenCanvas where available, with ordinary HTML canvas and HTML Image fallback for Safari without those APIs. The fallback can temporarily block the UI on large crops.
- Encode/decode at most 2,000 tokens; text input at most 12,000 UTF-16 code units; PNG export at most 600 tokens; cropped-image reader at most 256 glyphs. Upload at most 12 MB, dimensions at most 6,000×12,000 and 16 million pixels; raster aspect ratio at most 8. Huge/complex text can be slower because BPE is performed locally.
- No glyph font is required: preview uses geometry. Copied Unicode may display as empty boxes in other applications without the Accelerando font. This is an alphabet/encoding, not encryption.

## Provenance

Alphabet shapes, token bytes and tokenizer pattern are structurally identical to gillverd/accelerando-8192 main revision b1e789d50ce92af0ce142675d38da451d0c8d078. The eacc.world copy omits the upstream song payload; no song lyrics are included here. Vendored alphabet SHA-256: c082627790771a2e57a004d0d83a604831a55f431858fb0c24b456b1252f7703.

Unmodified eacc.world modules are preserved in assets/; raster-reader.mjs is an adaptation of its image-reader-worker.mjs to expose an async API and add Safari canvas/image fallbacks. reader-worker.mjs bridges it to workers. Original tokenizer, codec, transmission and cropped geometry matching remain unchanged. Credit to gillverd, eacc.world, and OpenAI tiktoken. See notices and UPSTREAM-README.md. No blanket license is asserted for these materials.

No tests were authored. Actual browser verification is recorded separately in VERIFICATION.md.
