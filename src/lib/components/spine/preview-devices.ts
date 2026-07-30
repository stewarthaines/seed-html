/**
 * Device presets and engine-routing helpers shared by PreviewPane (header,
 * options bar, checks) and PreviewSurface (rendering) — split out so both
 * sides classify a device id identically (process/SPLIT_PREVIEW.md).
 */
import { previewTypeForDevice } from '$lib/services/settings/settings.service.js';

export const DEVICE_PRESETS = [
  { id: 'desktop', name: 'Fill', width: '100%', height: '100%', category: 'responsive' },
  // Foliate reader preview — fills the pane; the renderer paginates itself.
  { id: 'read', name: 'READ.html', width: '100%', height: '100%', category: 'read' },
  { id: 'iphone', name: 'Standard', width: '375px', height: '667px', category: 'commute' },
  { id: 'iphone-plus', name: 'Plus', width: '414px', height: '736px', category: 'commute' },
  { id: 'ipad', name: 'Compact', width: '768px', height: '1024px', category: 'home' },
  { id: 'ipad-air', name: 'Extra Large', width: '820px', height: '1180px', category: 'home' },
  { id: 'kindle', name: 'Standard', width: '600px', height: '800px', category: 'travel' },
  {
    // Paginated print preview (Paged.js). Dimensions are placeholders — print
    // fills the pane and Paged.js sizes its own A4 pages (see isFillDevice).
    id: 'print',
    name: 'Print',
    width: '794px',
    height: '1123px',
    category: 'print',
  },
  {
    // Chapter proofs: the same Paged.js render laid out as a wrapping grid of
    // page thumbnails — a flatplan for judging rhythm, breaks, and figure
    // placement across the whole chapter. Dimensions are placeholders too.
    id: 'proofs',
    name: 'Proofs',
    width: '794px',
    height: '1123px',
    category: 'print',
  },
] as const;

export type DevicePreset = (typeof DEVICE_PRESETS)[number];
export type DeviceId = DevicePreset['id'];

/** Devices that fill the pane rather than rendering a scaled device frame. */
export const isFillDevice = (id: string): boolean =>
  id === 'desktop' || id === 'print' || id === 'proofs' || id === 'read';

/** The preview type of a device preset id (falls back to responsive). */
export function typeOfDeviceId(id: string): ReturnType<typeof previewTypeForDevice> {
  const category = DEVICE_PRESETS.find(d => d.id === id)?.category ?? 'responsive';
  return previewTypeForDevice(category);
}

/** Flags both sides derive from their own props/context; passed explicitly so
 *  the routing stays a pure function. */
export interface EngineFlags {
  /** http(s) context — foliate modules are fetched from the app origin. */
  httpOk: boolean;
  isFixedLayout: boolean;
  /** The app-level "Paged device previews" setting. */
  devicePresetsPaged: boolean;
}

/**
 * Whether a device id renders through the foliate engine: the READ.html entry
 * AND the device presets (Commute/Home/Travel), on http, reflowable chapters
 * only (process/FOLIATE_UNIFIED_PREVIEW.md). Everything else — Responsive
 * (deliberately raw), file://, fixed layout — uses the built-in preview; Print
 * stays Paged.js. The device presets additionally honour the app-level "Paged
 * device previews" opt-out and fall back to the built-in preview when off;
 * READ.html is unaffected (no built-in equivalent).
 */
export function usesFoliateDevice(id: string, flags: EngineFlags): boolean {
  if (!flags.httpOk || flags.isFixedLayout) return false;
  const type = typeOfDeviceId(id);
  if (type === 'read') return true;
  return type === 'device' && flags.devicePresetsPaged;
}

/** The engine a device id renders with, for re-render bookkeeping. */
export const engineOfDeviceId = (id: string, flags: EngineFlags): 'paged' | 'foliate' | 'raw' =>
  id === 'print' || id === 'proofs' ? 'paged' : usesFoliateDevice(id, flags) ? 'foliate' : 'raw';

// Five relative font steps; the middle (index 2) is the device's base size.
// Shared: the reader panel (parent) shows the readout, the surface applies it.
export const FONT_STEPS = [0.85, 0.92, 1.0, 1.15, 1.3] as const;

/**
 * Render events a PreviewSurface reports to its parent (which reacts by
 * re-running open checks against the surface's fresh document):
 * 'will-rewrite'   — the current document is about to be paved (stop SR walks)
 * 'rewrite'        — a raw preview rewrite completed
 * 'frame-load'     — the iframe fired load (device re-key / fresh document)
 * 'section-ready'  — a foliate render finished (fresh section document)
 * 'section-reflow' — the live foliate renderer re-laid-out (same view)
 */
export type SurfaceContentEvent =
  | 'will-rewrite'
  | 'rewrite'
  | 'frame-load'
  | 'section-ready'
  | 'section-reflow';
