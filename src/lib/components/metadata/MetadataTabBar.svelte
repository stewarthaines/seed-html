<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../i18n';
  import MetadataTab from './MetadataTab.svelte';
  import type { ValidationResult } from '../../metadata/MetadataValidator';

  const dispatch = createEventDispatcher();

  export let activeTab = 'basic';
  export let validationErrors: ValidationResult[] = [];
  export let tabs = [
    { id: 'basic', label: $t('metadata.tab.basic') },
    { id: 'advanced', label: $t('metadata.tab.advanced') },
    { id: 'accessibility', label: $t('metadata.tab.accessibility') },
  ];

  const getTabErrorCount = (tabId: string) => {
    const tabFields = getTabFields(tabId);
    return validationErrors.filter(error => tabFields.includes(error.field)).length;
  };

  const getTabFields = (tabId: any) => {
    switch (tabId) {
      case 'basic':
        return ['title', 'language', 'identifier', 'creator'];
      case 'advanced':
        return [
          'publisher',
          'date',
          'description',
          'subject',
          'rights',
          'source',
          'relation',
          'coverage',
          'type',
          'format',
          'contributor',
          'collections',
        ];
      case 'accessibility':
        return [
          'accessMode',
          'accessModeSufficient',
          'accessibilityFeature',
          'accessibilityHazard',
          'accessibilityControl',
          'accessibilityAPI',
          'accessibilitySummary',
          'accessibilityConformance',
          'accessibilityCertifiedBy',
          'accessibilityCertifierCredential',
        ];
      default:
        return [];
    }
  };

  const handleTabClick = (event: { detail: any }) => {
    dispatch('tabClick', event.detail);
  };
</script>

<div class="metadata-tab-bar" tabindex="-1">
  {#each tabs as tab}
    <MetadataTab
      id={tab.id}
      label={tab.label}
      active={activeTab === tab.id}
      errorCount={getTabErrorCount(tab.id)}
      on:click={handleTabClick}
    />
  {/each}
</div>

<style>
  .metadata-tab-bar {
    display: flex;
    border-block-end: 1px solid var(--color-border-default);
    background-color: var(--color-surface-primary);
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .metadata-tab-bar::-webkit-scrollbar {
    display: none;
  }

  /* Responsive design - stack tabs on very small screens */
  @media (max-width: 480px) {
    .metadata-tab-bar {
      flex-wrap: wrap;
    }
  }
</style>
