import { describe, it, expect } from 'vitest';
import { isRtlLanguage } from './language-direction.js';

describe('isRtlLanguage', () => {
  it('detects common RTL languages by primary subtag', () => {
    for (const tag of ['ar', 'fa', 'he', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ckb']) {
      expect(isRtlLanguage(tag), tag).toBe(true);
    }
  });

  it('ignores region/case and still detects RTL', () => {
    expect(isRtlLanguage('he-IL')).toBe(true);
    expect(isRtlLanguage('AR')).toBe(true);
    expect(isRtlLanguage('fa_IR')).toBe(true);
  });

  it('uses an explicit RTL script subtag over the primary language default', () => {
    expect(isRtlLanguage('az-Arab')).toBe(true); // Azerbaijani in Arabic script
    expect(isRtlLanguage('pa-Aran')).toBe(true);
    expect(isRtlLanguage('az')).toBe(false); // Latin Azerbaijani
    expect(isRtlLanguage('uz-Latn')).toBe(false);
  });

  it('treats LTR languages and empty input as not RTL', () => {
    for (const tag of ['en', 'de', 'en-US', 'zh-Hant', 'ja', '', undefined, null]) {
      expect(isRtlLanguage(tag), String(tag)).toBe(false);
    }
  });
});
