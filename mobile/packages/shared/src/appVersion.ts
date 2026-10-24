import { api } from './api';
import { API_ENDPOINTS } from './endpoints';

export interface AppVersionInfo {
  minVersion: string;
  latestVersion: string;
  storeUrl?: string | null;
}

// يقارن "1.2.10" مع "1.2.9" رقماً رقماً: سالب إن كان a أقدم، 0 متساويان، موجب إن كان a أحدث
export const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

// التحديث إجباري إن كان إصدار التطبيق أقدم من أقل إصدار يسمح به الخادم
export const isUpdateRequired = (current: string, info: Pick<AppVersionInfo, 'minVersion'> | null | undefined): boolean =>
  !!info?.minVersion && compareVersions(current, info.minVersion) < 0;

export const fetchAppVersion = async (app: 'customer' | 'driver', platform: 'android' | 'ios'): Promise<AppVersionInfo> =>
  (await api.get(API_ENDPOINTS.APP.VERSION, { params: { app, platform } })).data.data;
