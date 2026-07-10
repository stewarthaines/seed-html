/**
 * The metadata fields belonging to each Metadata view tab — the single source
 * of truth shared by MetadataEditor (publishes the active tab's fields for OPF
 * preview highlighting) and MetadataTabBar (per-tab validation error counts).
 */
export function getTabFields(tabId: string): string[] {
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
}
