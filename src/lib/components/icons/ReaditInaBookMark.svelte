<script lang="ts">
  import type { IconComponentProps } from 'phosphor-svelte';

  // Read-it-in-a-book open-book mark (icon only — no wordmark). A drop-in for the
  // Phosphor icons used in the sidebar nav: it takes the same IconComponentProps, so it
  // renders through the shared `<Icon size weight aria-hidden />` path. `weight`/`mirrored`
  // don't apply to this fixed-stroke brand mark. The shapes mirror COVER_MARK in
  // src/lib/epub/cover-generator.ts (outer cover, side seams, two eyes, open page).
  let {
    size = 18,
    color = 'currentColor',
    weight: _weight,
    mirrored: _mirrored,
    ...rest
  }: IconComponentProps = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 320 320"
  fill="none"
  stroke={color}
  stroke-width="14"
  stroke-linecap="round"
  stroke-linejoin="round"
  {...rest}
>
  <path d="M 37,289 L 37,61 Q 37,39 59,39 L 261,39 Q 283,39 283,61 L 283,289 Z" />
  <line x1="62" y1="46" x2="62" y2="171" stroke-width="13" />
  <line x1="258" y1="46" x2="258" y2="155" stroke-width="13" />
  <circle cx="124" cy="103" r="20" stroke-width="13" />
  <circle cx="196" cy="103" r="20" stroke-width="13" />
  <g transform="translate(-15 5)">
    <path
      d="m 54,170 c 47.50365,-3.59124 95.66667,5.24574 121,11.91241 39.93066,-21.67518 68.91728,-30.41606 123,-34.49635"
      stroke-width="13"
    />
  </g>
</svg>
