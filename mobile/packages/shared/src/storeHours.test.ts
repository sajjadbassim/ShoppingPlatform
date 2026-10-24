import { describeDay, formatTime, fullSchedule } from './storeHours';

describe('أوقات العمل', () => {
  it('يبدأ الأسبوع بالسبت ويغلق الأيام الناقصة', () => {
    const days = fullSchedule([{ day: 0, open: '08:00', close: '20:00' }]);
    expect(days.map((d) => d.day)).toEqual([6, 0, 1, 2, 3, 4, 5]);
    expect(days[0].closed).toBe(true);
    expect(days[1].closed).toBe(false);
  });

  it('تنسيق الوقت بنظام 12 ساعة', () => {
    expect(formatTime('21:30')).toBe('9:30 م');
    expect(formatTime('00:00')).toBe('12:00 ص');
    expect(formatTime('09:05')).toBe('9:05 ص');
  });

  it('وصف اليوم: مغلق / 24 ساعة / مدة', () => {
    expect(describeDay({ day: 5, closed: true, open: '09:00', close: '22:00' })).toBe('مغلق');
    expect(describeDay({ day: 1, closed: false, open: '00:00', close: '00:00' })).toBe('24 ساعة');
    expect(describeDay({ day: 1, closed: false, open: '09:00', close: '22:00' })).toBe('9:00 ص – 10:00 م');
  });
});
