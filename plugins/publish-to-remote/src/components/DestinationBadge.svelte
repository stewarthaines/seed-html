<script lang="ts">
  import { typeLabel } from '../remote-status.js';
  import type { RemoteConfig } from '../types.js';

  let { remote }: { remote: RemoteConfig } = $props();
</script>

<span class="badge" aria-hidden="true">{typeLabel(remote)}</span>

<style>
  .badge {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 44px;
    block-size: 36px;
    border: 1px solid var(--color-border-strong);
    border-radius: 2px;
    background: var(--color-surface-secondary);
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }
</style>
