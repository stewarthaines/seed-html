// Types for stages.js (plain JS so the Node-side manifest builders can import
// it; tsconfig.node.json does not allow JS). Keep in step with stages.js.

export type DomTransformStage =
  | 'blocks'
  | 'structure'
  | 'annotate'
  | 'derive'
  | 'language'
  | 'highlight'
  | 'layout';

export const DOM_TRANSFORM_STAGES: readonly DomTransformStage[];

export function isDomTransformStage(value: unknown): value is DomTransformStage;
