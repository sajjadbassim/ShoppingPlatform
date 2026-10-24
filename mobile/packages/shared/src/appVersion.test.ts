import { compareVersions, isUpdateRequired } from './appVersion';

describe('compareVersions', () => {
  it('يقارن رقماً رقماً لا نصاً', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareVersions('2.0', '2.0.0')).toBe(0);
    expect(compareVersions('0.1.0', '1.0.0')).toBeLessThan(0);
  });
});

describe('isUpdateRequired', () => {
  it('إجباري فقط حين يكون الإصدار أقدم من الأدنى', () => {
    expect(isUpdateRequired('0.1.0', { minVersion: '1.0.0' })).toBe(true);
    expect(isUpdateRequired('1.0.0', { minVersion: '1.0.0' })).toBe(false);
    expect(isUpdateRequired('1.3.0', { minVersion: '1.0.0' })).toBe(false);
  });
  it('بلا معلومات من الخادم لا يمنع أحداً', () => {
    expect(isUpdateRequired('0.0.1', null)).toBe(false);
    expect(isUpdateRequired('0.0.1', undefined)).toBe(false);
  });
});
