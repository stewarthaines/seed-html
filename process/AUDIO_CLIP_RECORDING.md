# Audio clip recording

Status: built on `feat/audio-recording` 2026-10-06 (phases 1–4 together); spike results below. Source: the author's note in the "test voice recording" book (`SOURCE/text/chapter01.txt`), 2026-10-06.

## The idea

Record a voice clip inside SEED.html, select the part to keep, and insert it as a `:clip` directive, without leaving the app or handling an audio file by hand. The recording must come out in a form the audio-clips player seeks accurately in reading systems, which today means constant bit rate.

The natural home is the audio-clip-editor plugin (`plugins/audio-clip-editor/`), which already does the second half: a waveform, clip regions per file, and Insert. Recording adds a way to get a new audio file into the project from that same panel.

## Where things stand

The insert panel is gated on the manifest already holding audio. `EditorPane.svelte` builds `availableInsertPanels` and offers "Audio Clip Editor" only when `hasAudioFiles` is true, so a book with no audio has no way in. The plugin's own empty state says "No audio files in this project." and stops there.

The plugin can read the workspace but cannot add to the manifest. It holds the workspace root handle (or walks `opfsDirPath`) and writes its own `SOURCE/plugins/audio-clip-editor/clips.json`, but a new audio file needs an OPF manifest item. Manifest changes must go through the host and `onWorkspaceUpdate`, or the next full OPF save clobbers them (the detached-copy trap in memory). The host already has the right routine: `importFileToManifest()` in `src/lib/import/import-media.ts` picks an EPUB-safe path, de-duplicates the href, adds the item, writes the bytes and rolls back on failure.

The plugin protocol has no message for this. `src/lib/plugins/contract.ts` has `insert`, `navigate`, `read-epub`, `import-epub` and `open`; `import-epub` is the nearest precedent (the plugin hands the host bytes, the host imports through its normal path).

The CBR requirement is documented in `extensions/audio-clips/clip-player.js`: VBR mp3 seeking is unreliable in iOS Books; CBR mp3 or m4a behaves. `process/READING_SYSTEM_DEBUGGING.md` records the field evidence (a VBR clip that misbehaved, a CBR re-encode that improved it).

## What the browser gives us

`MediaRecorder` records the microphone, but its output is the browser's choice of container and codec (WebM or Ogg Opus in Chromium and Firefox, MP4/AAC in Safari), with no promise of constant bit rate and no mp3. It is a capture tool, not the export format.

So the plan separates capture from encoding: record, decode the take to PCM with `AudioContext.decodeAudioData` (or capture PCM directly through an `AudioWorklet`, which avoids a lossy round trip), trim to the selection, then encode the kept PCM to the export format ourselves.

wavesurfer.js, already the plugin's one dependency, ships a Record plugin (`wavesurfer.js/plugins/record`) that wraps `MediaRecorder` and draws the live waveform while recording. It fits the existing panel without a new UI library.

## Encoding: the main decision

Three routes to a file the clip player seeks reliably:

1. **CBR mp3 through a LAME-based encoder** (lamejs, or a WASM build of LAME). This matches the guidance already in `clip-player.js`, plays everywhere, and seeks predictably. LAME is LGPL; it would ship only inside the plugin's own bundle, never the core single-file build, but the licence still needs a decision.
2. **AAC in an m4a through WebCodecs `AudioEncoder`** with `bitrateMode: 'constant'`, muxed by a small MP4 muxer. No LGPL, but AAC encoding through WebCodecs is not available in every engine the app supports, so it needs a fallback anyway.
3. **WAV (uncompressed PCM).** Trivial to write, seeks exactly, no dependency. Files are large (about 5 MB a minute at 44.1 kHz 16-bit mono, less at a lower sample rate), and WAV is not an EPUB core media type, so it is only acceptable as an intermediate, not as what goes into the book.

Recommendation: route 1, CBR mp3 at a voice-appropriate rate (mono, 64–96 kbps), in the plugin bundle. It is the one format the project's own reading-system notes already vouch for. Before building, confirm the licence position on bundling an LGPL encoder in the plugin, and measure encode time for a few minutes of speech on an iPad.

## Proposed design

**Entry point.** Offer the audio panel whenever the audio plugin is enabled, even with no audio in the manifest; keep the current `hasAudioFiles` gate for the built-in editor, which gains no recording. In the plugin, the empty state becomes a Record button instead of "No audio files in this project.", and Record also sits beside the file select once files exist.

**Recording flow.** Record shows a live waveform and elapsed time; Stop ends the take and shows it on the main waveform. The author drags a region to keep (the whole take by default), can play it back, and can discard and record again. Nothing reaches the project until they choose to keep it.

**Keeping a take.** On Keep, the plugin trims to the region, encodes, and sends the host a new message, `add-media { filename, mediaType, bytes }`. The host runs `importFileToManifest()`, passes the result to `onWorkspaceUpdate`, and replies to the plugin with `media-added { href }` (or an error). The plugin re-reads the manifest, selects the new file, and creates one clip spanning it, so Insert works straight away.

**Naming.** The file name is generated (for example `recording-2026-10-06-1432.mp3`) and the label field is offered for the clip. Renaming the file stays a manifest task.

**Microphone permission.** The plugin iframe is same-origin, so the default `microphone` permissions policy should already allow it; add `allow="microphone"` on the plugin iframe in `PluginFrame.svelte` only if a browser proves otherwise. `getUserMedia` needs a secure context; the plugin is HTTP-only already (never in the `file:` build), and localhost and the deployed https origin both qualify.

## Contract changes

Two messages added to `src/lib/plugins/contract.ts`, mirrored by hand in the plugin's `types.ts` as with the rest:

- `add-media` (plugin → main): `{ type: 'add-media', filename: string, mediaType: string, bytes: ArrayBuffer }`, with a runtime guard like `isImportEpubMessage`. Generic on purpose: any plugin that makes a media file (a future photo crop export, say) can use it.
- `media-added` (main → plugin): `{ type: 'media-added', href: string } | { type: 'media-added', error: string }`, so the plugin knows where the file landed.

The host accepts `add-media` only from panel plugins hosted in the editor, and only for `audio/*` media types to begin with.

## Phases

1. **Gate and entry.** Offer the audio panel with no audio when the plugin is enabled; the plugin shows a Record button in its empty state. No recording yet; confirms the panel opens on an empty book.
2. **Contract and import.** `add-media` / `media-added`, host import through `importFileToManifest()` and `onWorkspaceUpdate`, plugin refreshes and selects the new file. Testable by having the plugin add a generated tone.
3. **Recording.** Record plugin, take review, trim to region, WAV output into the existing flow, so the whole path works end to end before the encoder decision lands.
4. **CBR encoder.** Swap WAV for the chosen encoder; verify seeking in Apple Books and one other reading system with the clip at least a minute into the file.

## Decisions (2026-10-06)

1. LGPL is acceptable if the plugin package meets its conditions: the licence text and attribution ship with the plugin, the encoder's source is reachable, and the encoder stays a separate file the plugin loads (not inlined into `plugin.html`), so it can be replaced.
2. Keep recording simple: record, listen back and scrub on the wavesurfer waveform, optionally crop by hand, then encode and store the result as a manifest item. The cut-away audio is not kept.
3. Recording is plugin-only; the built-in `AudioClipEditor` does not get it.
4. No recording metadata in the first cut; the clip label is enough.

## Spike (branch `spike/audio-recording`)

The spike is a dev-only page at `plugins/audio-clip-editor/spike/` (outside the plugin build), served over HTTPS on the LAN by `spike/vite.spike.config.ts` so an iPad can reach it; `frame.html` runs it inside a same-origin iframe with no `allow` attribute, the way `PluginFrame.svelte` hosts plugins. Candidates are dev dependencies of the plugin: `wasm-media-encoders` (MIT wrapper, LAME compiled to WASM, the `.wasm` loaded as its own file) and `@breezystack/lamejs` (a maintained ESM fork of lamejs, LGPL-3.0).

Desktop results from Playwright's headless engines, 2026-10-06 (3 minutes of generated speech-like audio, 64 kbps mono, 48 kHz):

| Engine   | WASM LAME | lamejs | Output                    |
| -------- | --------- | ------ | ------------------------- |
| Chromium | 1.7 s     | 6.1 s  | CBR 64 kbps, seeks to 80% |
| Firefox  | 13.8 s    | 8.7 s  | CBR 64 kbps, seeks to 80% |
| WebKit   | 1.9 s     | 5.9 s  | CBR 64 kbps, seeks to 80% |

Recording with a fake microphone in Chromium, top level and in the iframe: MediaRecorder gave `audio/webm;codecs=opus`, and the raw file's `<audio>` duration was `Infinity`, confirming the scrubbing risk. Decoding to PCM and rewriting as WAV gave the waveform and media element the true duration, and the cropped encode came out CBR. Neither encoder writes an Info/Xing header frame.

Found along the way: `wasm-media-encoders` 0.7.0's `./wasm/mp3.wasm` export points at a missing file (`wasm.mp3.wasm`); import `wasm-media-encoders/wasm/mp3?url` instead.

iPad, Safari, top level, 2026-10-06: the microphone works; MediaRecorder gave `audio/mp4; codecs=mp4a.40.2` (AAC) with a correct raw duration, so the raw file scrubbed correctly too (Safari does not share Chrome's `Infinity` problem). Takes decoded at 44.1 kHz even when the mic reported 48 kHz. The 3-minute bench took 1.2 s with WASM LAME and 3.2 s with lamejs; crops encoded CBR at 64 kbps and seeked accurately.

Real browsers, 2026-10-06, all inside `frame.html` (same-origin iframe, no `allow` attribute), real microphone, 3-minute bench at 64 kbps mono, 44.1 kHz:

| Browser      | Recorder output | Raw duration | WASM LAME | lamejs |
| ------------ | --------------- | ------------ | --------- | ------ |
| Safari, iPad | AAC in MP4      | correct      | 1.2 s     | 3.2 s  |
| Safari, Mac  | AAC in MP4      | correct      | 1.6 s     | 5.4 s  |
| Chrome, Mac  | Opus in WebM    | `Infinity`   | 1.5 s     | 5.3 s  |
| Firefox, Mac | Opus in Ogg     | correct      | 1.7 s     | 6.2 s  |

Every encode was CBR at 64 kbps and seeked accurately. The microphone works in the iframe without `allow="microphone"` in all four, the iPad included. The headless Firefox WASM time (13.8 s) was an artefact; real Firefox matches the others.

## Spike conclusions

1. Encoder: `wasm-media-encoders` (LAME in WASM). It is 3–4× faster than lamejs in every browser, about 1.5 s for three minutes of speech, and its `.wasm` is naturally a separate file, which is what the LGPL decision asks for.
2. Always decode the take to PCM and give wavesurfer a WAV built from it. Only Chrome needs it (its WebM has no duration), but one path for every browser is simpler and the decode costs tens of milliseconds.
3. No `allow` attribute is needed on the plugin iframe: the microphone works in a same-origin frame in every browser tested, the iPad included.
4. Expect 44.1 kHz input on Apple devices whatever the mic reports; LAME takes it as is.

## Built (2026-10-06, `feat/audio-recording`)

Phases 1–4 landed together, since the encoder was settled by the spike. Host: `add-media` / `media-added` in `src/lib/plugins/contract.ts`, `src/lib/plugins/add-media.ts` (audio only, file name reduced to its last segment, through `importFileToManifest`), `PluginPanel.svelte` answering `add-media` when given `onAddMedia`, and `EditorPane.svelte` offering the audio panel whenever the plugin is enabled. Plugin: `Recorder.svelte` (record, listen, crop, keep), `recording/capture.ts`, `recording/pcm.ts`, `recording/mp3.ts`, `host.ts`. Build: the plugin's `mp3-*.wasm` and `THIRD_PARTY_NOTICES.txt` sit beside `plugin.html`, and `scripts/generate-plugin-manifest.js` now copies each plugin's whole build folder.

Tests: PCM, mp3 (CBR frames, duration, resampling) and the `add-media` round trip as plugin unit tests; the message guards in the contract browser test; the host's `addPluginMedia`; and `Recorder.browser.test.ts`, which records an oscillator in Chromium and checks Keep hands over a CBR mp3 of the take's length. An ad hoc Playwright run against the dev server with Chromium's fake microphone covered the whole app: the panel opens on a book with no audio, the kept take lands in `OEBPS/Audio/` with its manifest item, and Insert puts the clip directive at the caret.

Offline (2026-10-06, `fix/recorder-offline-keep`): plugins are cached on use, not precached, so the recorder works offline only if the panel has been opened online before. The encoder's `.wasm` is now fetched and compiled as the recorder opens (`compileMp3Wasm`), so it is cached with the plugin page rather than first at Keep. A failed Keep returns to the take with the error beneath it, so a take is never lost; the error screen is kept for failures with no take (no microphone, an undecodable recording). Precaching plugins at install was considered and not done: it would reverse the cache-on-use choice for every plugin to cover a first-ever use while offline.

A recorded clip, packaged and checked with EPUBCheck, plays in Apple Books (verified by the author 2026-10-06).
