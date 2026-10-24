import { formatDate, formatDateTime } from './dates';
import { loyaltyTierName } from './engagement';

describe('dates', () => {
  it('uses Latin digits with Arabic month names in Baghdad time', () => {
    const out = formatDateTime('2026-10-24T12:45:00Z');
    expect(out).toMatch(/^24 /);
    expect(out).toContain('2026');
    expect(out).not.toMatch(/[٠-٩]/);
    expect(formatDate('2026-10-24T12:45:00Z')).not.toContain('،');
  });
  it('returns empty for missing dates', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDateTime(undefined)).toBe('');
  });
});

describe('loyaltyTierName', () => {
  it('maps tiers to gentle Arabic names, defaulting to the first', () => {
    expect(loyaltyTierName('Bronze')).toBe('بذرة');
    expect(loyaltyTierName('GOLD')).toBe('زهرة');
    expect(loyaltyTierName('unknown')).toBe('بذرة');
  });
});
