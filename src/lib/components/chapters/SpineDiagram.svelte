<script lang="ts">
  // Abstract before/after schematic for the Chapters view. Each chapter is a thin
  // bar, so the whole spine fits on screen at any length — the diagram never
  // scrolls. The left column is the current order; the right column (shown only
  // while a move is being composed) is the proposed order, with the selected
  // block in blue and curved arrows connecting each moved bar old→new. Decorative
  // (role="img"); the live-region announcements carry the meaning for AT.
  import { t } from '../../i18n';

  interface DiagramItem {
    id: string;
    linear: boolean;
  }

  interface Props {
    items: DiagramItem[];
    selectedIds: ReadonlySet<string>;
    /** Proposed order to preview, or null when nothing is being composed. */
    proposedOrder: string[] | null;
  }

  let { items, selectedIds, proposedOrder }: Props = $props();

  // Geometry (SVG units; the element scales to its container via viewBox).
  const ROW_H = 7;
  const BAR_H = 6;
  const COL_W = 44;
  const LEFT_X = 4;
  const RIGHT_X = 152;
  const WIDTH = 200;

  const height = $derived(Math.max(1, items.length) * ROW_H + 4);

  const proposedIndex = $derived.by(() => {
    const map = new Map<string, number>();
    if (proposedOrder) proposedOrder.forEach((id, i) => map.set(id, i));
    return map;
  });

  const barY = (index: number) => index * ROW_H + 2;
  const centerY = (index: number) => barY(index) + BAR_H / 2;

  // Curved connectors from a bar's current position to its proposed one. A big
  // moving block reads more clearly with just two arrows (first + last) than one
  // per bar, so past three moving items we draw only the endpoints.
  const arrows = $derived.by(() => {
    if (!proposedOrder) return [];
    const span = RIGHT_X - (LEFT_X + COL_W);
    const moved: { i: number; pj: number }[] = [];
    items.forEach((item, i) => {
      if (!selectedIds.has(item.id)) return;
      const pj = proposedIndex.get(item.id);
      if (pj != null) moved.push({ i, pj });
    });
    const endpoints = moved.length > 3 ? [moved[0], moved[moved.length - 1]] : moved;
    return endpoints.map(({ i, pj }) => {
      const x1 = LEFT_X + COL_W;
      const y1 = centerY(i);
      const x2 = RIGHT_X;
      const y2 = centerY(pj);
      const cx1 = x1 + span * 0.4;
      const cx2 = x2 - span * 0.4;
      return { d: `M${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}` };
    });
  });
</script>

<svg
  class="spine-diagram"
  viewBox={`0 0 ${WIDTH} ${height}`}
  preserveAspectRatio="xMidYMid meet"
  role="img"
  aria-label={proposedOrder
    ? $t('Current chapter order and the proposed order after the move.')
    : $t('Current chapter order.')}
>
  <defs>
    <marker
      id="chapters-arrowhead"
      viewBox="0 0 10 10"
      refX="8"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
    >
      <path class="arrowhead" d="M0 0 L10 5 L0 10 z" />
    </marker>
  </defs>

  <!-- Current order (left column) -->
  <g class="col-current">
    {#each items as item, i (item.id)}
      <rect
        class="bar"
        class:selected={selectedIds.has(item.id)}
        class:aside={!item.linear}
        x={LEFT_X}
        y={barY(i)}
        width={COL_W}
        height={BAR_H}
        rx="2"
      />
    {/each}
  </g>

  {#if proposedOrder}
    <!-- Arrows old→new -->
    <g class="g-arrows">
      {#each arrows as arrow, i (i)}
        <path d={arrow.d} marker-end="url(#chapters-arrowhead)" />
      {/each}
    </g>

    <!-- Proposed order (right column) -->
    <g class="col-proposed">
      {#each proposedOrder as id, j (id)}
        {@const item = items.find(it => it.id === id)}
        <rect
          class="bar"
          class:selected={selectedIds.has(id)}
          class:aside={item ? !item.linear : false}
          x={RIGHT_X}
          y={barY(j)}
          width={COL_W}
          height={BAR_H}
          rx="2"
        />
      {/each}
    </g>
  {/if}
</svg>

<style>
  .spine-diagram {
    display: block;
    width: 100%;
    height: 100%;
    max-height: 100%;
    color: var(--color-text-tertiary);
  }

  .bar {
    fill: var(--color-bg-tertiary);
    stroke: var(--color-border-default);
    stroke-width: 0.5;
  }
  .bar.selected {
    fill: var(--color-accent);
    stroke: none;
  }
  /* Set-aside (linear="no") chapters read as outlined, not filled. */
  .bar.aside {
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
    stroke-dasharray: 3 2;
  }
  .bar.selected.aside {
    fill: none;
    stroke: var(--color-accent);
  }

  .g-arrows path {
    fill: none;
    stroke: var(--color-accent);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .arrowhead {
    fill: var(--color-accent);
    stroke: none;
  }
</style>
