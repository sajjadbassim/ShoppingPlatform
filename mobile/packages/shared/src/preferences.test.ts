import { isNotifyOn } from './preferences';

describe('isNotifyOn', () => {
  it('مفعّل افتراضياً قبل وصول البيانات أو عند غياب الحقل', () => {
    expect(isNotifyOn(undefined, 'notifyOrderUpdates')).toBe(true);
    expect(isNotifyOn(null, 'notifyReminders')).toBe(true);
    expect(isNotifyOn({}, 'notifyReminders')).toBe(true);
  });
  it('يحترم القيمة المحفوظة', () => {
    expect(isNotifyOn({ notifyOrderUpdates: false }, 'notifyOrderUpdates')).toBe(false);
    expect(isNotifyOn({ notifyReminders: true, notifyOrderUpdates: false }, 'notifyReminders')).toBe(true);
  });
});
