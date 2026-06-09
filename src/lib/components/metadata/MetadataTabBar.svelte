<script lang="ts">
  import { t } from '../../i18n';
  import MetadataTab from './MetadataTab.svelte';
  import type { ValidationResult } from '../../metadata/MetadataValidator';

  let {
    activeTab = 'basic',
    validationErrors = [],
    tabs = [
      { id: 'basic', label: $t('metadata.tab.basic') },
      { id: 'advanced', label: $t('metadata.tab.advanced') },
      { id: 'accessibility', label: $t('metadata.tab.accessibility') },
    ],
    onTabClick,
  }: {
    activeTab?: string;
    validationErrors?: ValidationResult[];
    tabs?: Array<{ id: string; label: string }>;
    onTabClick?: (detail: { tabId: string }) => void;
  } = $props();

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
          'ibooksSpecifiedFonts',
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
          'accessibilityCertifierReport',
        ];
      default:
        return [];
    }
  };

  const handleTabClick = (detail: { tabId: string }) => {
    onTabClick?.(detail);
  };
</script>

<div class="metadata-tab-bar" tabindex="-1">
  {#each tabs as tab}
    <MetadataTab
      id={tab.id}
      label={tab.label}
      active={activeTab === tab.id}
      errorCount={getTabErrorCount(tab.id)}
      onSelect={handleTabClick}
    />
  {/each}
</div>

<style>
  /* Sits inside a PaneHeader, which supplies the grey bar + bottom border. */
  .metadata-tab-bar {
    display: flex;
    flex: 1;
    min-width: 0;
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
