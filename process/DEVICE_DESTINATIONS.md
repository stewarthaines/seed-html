# Device destinations: sending packaged EPUBs to USB e-readers from the browser

Investigation into pushing a packaged EPUB straight onto a reader (e.g. a Kobo) over USB, browser-side. Conclusion up front: **WebUSB is a dead end for this; the File System Access API on the mounted volume is the workable path**, it supports meaningful persistence, and it slots into the publish-to-remote plugin as a new destination type behind a Chromium-only feature gate.

## Why not WebUSB

Kobo — and every other reader worth targeting this way — presents over USB as a **Mass Storage Class (MSC)** device. WebUSB deliberately cannot touch it:

- Mass storage is a [protected interface class](https://groups.google.com/a/chromium.org/g/blink-dev/c/LZXocaeCwDw) in the WebUSB spec: the OS already owns it (it's mounted as a disk), and Chromium refuses to let a page claim it. The only bypass is the `usb-unrestricted` permission for [Isolated Web Apps](https://groups.google.com/a/chromium.org/g/blink-dev/c/hXgwRCYta-k) — enterprise-installed applications, not a website like SEED.html.
- WebUSB is Chromium-only anyway (Firefox and Safari both decline it), so it buys no reach over the alternative below.

So "WebUSB → Kobo" is not implementable, full stop. What WebUSB _could_ reach is MTP devices on hosts without a native MTP driver — see category B below.

## The workable path: File System Access API

An MSC reader mounts as an ordinary drive. `showDirectoryPicker()` opens it, the app sniffs device markers to know what it's talking to, and writes the `.epub` with the same handle API the app already uses for OPFS.

**Browser support** (acceptable per the "doesn't need to be universal" brief):

- Chromium desktop (Chrome/Edge 86+): full support, including directory pickers and writable streams.
- Firefox: pickers rejected as harmful in their standards position — will not ship.
- Safari: ships only the Origin Private File System, no local-disk pickers, no commitment to add them.
- Feature gate: `'showDirectoryPicker' in window` — the device option simply doesn't render elsewhere.

**Persistence — yes, and it's meaningful.** `FileSystemDirectoryHandle` is structured-serialisable: it can be stored in IndexedDB and revived next session. Chrome 122+ adds persistent permissions (the "Allow on every visit" prompt option), so a configured device survives reload and re-plug with at most a one-click re-grant:

- On revival: `handle.queryPermission({ mode: 'readwrite' })` → `'granted'` (write immediately), `'prompt'` (show a Reconnect button that calls `requestPermission()` — must be a user gesture), or the handle errors because the drive isn't mounted (show "plug in your device").
- Open question for the hardware spike: how stable the persisted handle + permission is for a _removable_ volume across unplug/replug cycles and across OS remount-point changes. This is the one behaviour that needs a real Kobo to answer; the spike below exercises it.

## Device categories

| Category                              | Devices                                                                                                                                                                                                                                                                                                                                                                             | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. USB Mass Storage, renders EPUB** | **Kobo (entire current line)**, Tolino, PocketBook, and any generic MSC reader with EPUB support                                                                                                                                                                                                                                                                                    | **Supported.** This is the target.                                                                                                                                                                                                                                                                                                                                                                                             |
| **B. MTP**                            | Kindle 2024 models and Scribe ([firmware ≥ 5.16.3 switched from MSC to MTP](https://blog.the-ebook-reader.com/2023/09/01/kindle-scribe-now-supports-mtp-instead-of-usb-mass-storage-after-update/), [confirmed for the 2024 line](https://goodereader.com/blog/kindle/connecting-2024-kindle-e-readers-to-pc-using-usb-all-doubts-cleared)); Android-based readers (Boox, Meebook…) | **Out of scope.** WebUSB _can_ claim an MTP interface where the OS has no driver — macOS has none, which is why Mac users need OpenMTP — but Windows' WPD driver owns it there, and it would mean implementing an MTP initiator over bulk transfers from scratch. On top of that, Kindle won't render a sideloaded EPUB, so the biggest MTP population gains little. Parked as a possible future spike (macOS+Chromium niche). |
| **C. Cloud-native**                   | Kindle (Send-to-Kindle), **Kobo's built-in Dropbox / Google Drive linking**, PocketBook Cloud                                                                                                                                                                                                                                                                                       | **Already served** by the existing remote-storage providers. A Kobo user can link Dropbox on the device today and publish through the plugin's Dropbox remote — worth stating in the user manual when device destinations ship.                                                                                                                                                                                                |

### Kobo specifics (category A reference device)

- Detection: a `.kobo/` directory at the volume root; `.kobo/version` is a comma-separated line containing serial, firmware version, and model id — enough to label the destination ("Kobo Libra 2") in the UI.
- Writing: a plain `.epub` at the root (or any user-chosen folder) is indexed by the device **when it is ejected/unplugged** — the UI copy after a send should say "Eject the device to finish adding the book."
- Leave `.kobo/` strictly alone (device database).
- kepub conversion (Kobo's enhanced format, kepubify-style) is an explicit **non-goal** for now; plain EPUB renders fine.

## Integration design (follow-up work, pending spike results)

Home: the **publish-to-remote plugin** — this is a publishing destination, and the plugin already owns destination config, listing, and upload flows.

- `plugins/publish-to-remote/src/types.ts`: the `RemoteConfig` union gains `DeviceRemoteConfig` — `{ id, name, type: 'device', deviceKind: 'kobo' | 'generic', volumeLabel, targetFolder }`. JSON-safe fields only: the config persists in the existing OPFS remotes store (`opfs.ts` `readRemotes`/`writeRemotes`).
- The **handle** is not JSON-serialisable: a small plugin-side IndexedDB store (`device-handles`, keyed by remote id) holds the `FileSystemDirectoryHandle`. Config without a revivable handle renders as "Reconnect device".
- `ConfigureForm.svelte`: the "Add Remote Storage" heading is reframed to **"Add Destination"**, with two clusters — _Remote storage_ (the existing four providers) and _Device_ (a single "USB e-reader (browse…)" action; the directory picker IS the configuration, followed by a name/folder confirm step showing what was detected).
- Publish path: device destinations copy the packaged EPUB via `createWritable()`; they **skip OPDS catalog generation** (meaningless on a reader's filesystem) and skip public-URL rendering.
- Gate the whole cluster on `'showDirectoryPicker' in window`.

## Hardware validation spike

`src/spikes/device-destination-spike.html` — self-contained page to run in Chrome with a Kobo attached:

1. **Pick device** → `showDirectoryPicker({ mode: 'readwrite' })`, sniff `.kobo/version` and report model/firmware/serial (or "generic volume").
2. **Write test book** → writes a tiny valid EPUB, re-lists the directory to confirm, reports elapsed time.
3. **Persist** → stores the handle in IndexedDB; **Reconnect** revives it, showing `queryPermission` state and exercising `requestPermission`.
4. The questions it answers: does "Allow on every visit" stick for a removable volume; does the handle survive unplug/replug (same session and across reloads); write latency for a ~1MB file.

Results from the spike decide whether the plugin integration proceeds as designed or needs a "re-pick each session" fallback posture.
