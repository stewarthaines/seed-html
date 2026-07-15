# Reading-system ground truth: debug clip playback in Apple Books, build the durable harness

## Context

Clip playback (audio-clips extension) works in the SEED preview (Chromium — permissive autoplay, blob URLs, forgiving media stack) but not in Apple Books on macOS, even after the static-audio-element rework. The preview can no longer tell us anything: we need instrumentation inside the actual reading system, plus a reusable way to probe reading systems that have no developer tools at all.

**Recon already done (read-only):**

- The packaged OPF is clean: clip chapter has `properties="scripted svg"`, `<script src="../Scripts/clip-player.js">` linked, audio in manifest as `audio/mpeg`. Not the blocker.
- `afinfo` on the clip's mp3: **116,273 bits/sec average — a non-standard rate, i.e. almost certainly VBR**. The user's own field notes (original audio-player.js header) document VBR mp3 seeking as unreliable in Books, and this clip seeks to 2:02 deep into a 4:12 file. Prime suspect.
- Books caches imported books aggressively: re-importing a same-title EPUB can serve the stale copy. Every Books test must delete the old book, quit Books, re-import.
- Inspector enablement is Apple-documented: `defaults write com.apple.iBooksX WebKitDeveloperExtras -bool YES`, restart Books, right-click in a DRM-free book → Show Inspector. (help.apple.com Books Asset Guide; epubsecrets.com walkthrough.)

## Phase A — Ground truth: Web Inspector attached to Books (macOS)

No code changes. User-side steps (suggest `! defaults write com.apple.iBooksX WebKitDeveloperExtras -bool YES` so it lands in-session), restart Books, open the CURRENT bulletin (fresh import per cache protocol), open the clip chapter, right-click → Show Inspector. Console probes to run there, in order:

1. Did the script run at all? `document.querySelector('span.clip')?.getAttribute('role')` → `'button'` means init ran.
2. Is the static element there? `document.querySelectorAll('audio').length`, `audio.currentSrc`, `audio.readyState`, `audio.networkState`, `audio.seekable.length && audio.seekable.end(0)`.
3. Click the clip with the console open: look for the `play()` promise rejection (`NotAllowedError` = gesture policy, `NotSupportedError` = source/codec, nothing = event chain stalled — check whether `loadedmetadata`/`seeked` ever fired by attaching listeners live).
4. Network/resource errors for the mp3 load.

Deliverable: the actual failure mode, named. Everything after adapts to it.

## Phase B — Control experiment: CBR re-encode (tests the prime suspect)

- Re-encode the clip mp3 to CBR (ffmpeg `-b:a 128k` if available, else `afconvert` to CBR AAC/m4a with manifest media-type + clip src updated to match). Keep the original aside.
- Write the re-encoded file into the project via the storage API (same channel used for the player deploy), repackage in-app, lift the EPUB out via the established base64 route, fresh-import to Books (cache protocol), test.
- If CBR fixes it: record the requirement prominently (see Phase D) and consider a future in-app warning when clip audio looks VBR (out of scope now).

## Phase C — The durable harness: a self-reporting probe book (works where no inspector exists)

The user's original scripts already had the pattern — `log()` into an on-page `#log` element. Formalize it:

- **New SEED project "RS Probe"** (authored in-app, dogfooding), one or two chapters whose script writes findings INTO the page:
  - Script-execution banner: static text "JS did not run" flipped to "JS ran" by script — the zeroth capability.
  - Media probes, each rendering a pass/fail line into the page log: static-element `play()` from a tap (promise outcome + `error.name`), dynamically-created-element `play()` (the Books-refusal control), seek accuracy (request begin vs position at `seeked`, and its latency), `timeupdate` cadence, `readyState`/`networkState` timeline, `navigator.userAgent`.
  - Uses one small CBR test tone (generated, seconds long) + optionally the VBR file for A/B seek comparison.
- **Artifacts kept in `docs/rs-probe/`**: the packaged `rs-probe.epub` plus its `SEED.zip` sources (self-editing, per project ethos). One paragraph in the README of that folder: how to read the report, the Books cache protocol, the inspector setup.
- **Optional, small**: `data-debug` hook in `extensions/audio-clips/clip-player.js` — when the body carries `data-clip-debug`, the player logs its event chain into a `#clip-log` element if present. Off by default, zero cost in normal books; turns any real book into its own trace on iOS where no inspector exists.

## Phase D — Fix + field notes

- Apply whatever A/B names as the cause (player tweak, encoding requirement, or both).
- New `docs/READING_SYSTEMS.md`: the field-notes file this session keeps almost writing — inspector setup for Books/macOS, the Books re-import cache protocol, CBR requirement, static-media-element requirement, `properties="scripted"`, gesture chains. Cross-link from EPUB_EMBEDDING.md and the audio-clips extension docs.
- Changelog line if the shipped extension changes.

## Verification

1. Phase A produces a named failure (console evidence) — or, if the inspector shows the script never runs, that finding redirects the plan.
2. Phase B: the clip plays in Books on macOS from a fresh import, seeked to the correct begin position.
3. Phase C: rs-probe.epub opened in Books (macOS + iOS if available) renders its capability report on-page; results recorded in docs/READING_SYSTEMS.md.
4. `npm run validate` green; extension changes verified in the preview as before (no regression there).

## Notes

- I cannot drive the Books UI: Phase A is guided — the user opens the inspector and pastes/relays what the console shows, or runs the suggested probes.
- The bulletin EPUB the user tested must be re-verified as actually containing the static element (Books cache) before trusting any negative result.

## Findings so far (2026-07-15)

- **CBR confirmed in play**: re-encoding the clip mp3 to CBR improved Books behavior (playback "kind of works") but seeking still failed.
- **Second cause found by comparing against the author's field-proven audio-player.js**: the rework deferred `play()` to the `seeked` event; reading systems consume the media user-gesture token synchronously, so a play issued from a later media event is not gesture-blessed — Books rejects it. Fixed in `extensions/audio-clips/clip-player.js` (`9f0534d`): same-file taps set `currentTime = begin` and call `play()` directly inside the click handler; only the src-swap path stays event-chained.
- Phase A (inspector) not yet run — still the right next step if the gesture fix doesn't fully resolve Books seeking.
