/**
 * DOM-transform stages: the fixed, ordered vocabulary a catalog extension's
 * `stage` (extension.json) is drawn from. Installing an extension places its
 * DOM transforms by stage, so the pipeline order follows from what each
 * transform does rather than from install order. See
 * process/DOM_TRANSFORM_ORDER.md for the constraints the order satisfies.
 *
 * Plain JS so the build-time manifest generator (scripts/) and the dev
 * middleware (vite.config.ts) validate against the same list as the app.
 *
 *   blocks    — replace code blocks and markers with rendered content
 *   structure — turn authored markup into semantic elements (figures)
 *   annotate  — add to the structure that now exists (photo regions)
 *   derive    — read the chapter and project; write panels, lists, records
 *   language  — stamp lang / xml:lang attributes
 *   highlight — colour code
 *   layout    — wrap for the stylesheet (responsive)
 *
 * @typedef {'blocks' | 'structure' | 'annotate' | 'derive' | 'language' | 'highlight' | 'layout'} DomTransformStage
 */

/** @type {readonly DomTransformStage[]} */
export const DOM_TRANSFORM_STAGES = Object.freeze([
  'blocks',
  'structure',
  'annotate',
  'derive',
  'language',
  'highlight',
  'layout',
]);

/**
 * @param {unknown} value
 * @returns {value is DomTransformStage}
 */
export function isDomTransformStage(value) {
  return typeof value === 'string' && /** @type {readonly string[]} */ (DOM_TRANSFORM_STAGES).includes(value);
}
