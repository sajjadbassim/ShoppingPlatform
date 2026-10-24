import { HttpTransportType, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { API_URL } from './config';
import { getFreshAccessToken } from './session';

export interface RealtimeEvent {
  event: 'Notification' | 'OrderStatusChanged';
  payload: unknown;
}

// اتصال SignalR بإشعارات المستخدم (طلباته وحالتها). يعيد دالة الإغلاق.
// WebSocket فقط بلا negotiate: الهاتف لا يحتاج بدائل المتصفح، والتوكن يُجلب محدَّثاً عند كل اتصال
export const connectNotifications = (onEvent: (e: RealtimeEvent) => void): (() => void) => {
  const connection = new HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/notifications`, {
      accessTokenFactory: getFreshAccessToken,
      transport: HttpTransportType.WebSockets,
      skipNegotiation: true,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(LogLevel.None)
    .build();

  connection.on('Notification', (payload) => onEvent({ event: 'Notification', payload }));
  connection.on('OrderStatusChanged', (payload) => onEvent({ event: 'OrderStatusChanged', payload }));

  let closed = false;
  connection.start().catch(() => {
    // فشل الاتصال لا يكسر التطبيق: الشاشات تُحدَّث بالسحب وعند الفتح
  });

  return () => {
    if (closed) return;
    closed = true;
    connection.stop().catch(() => {});
  };
};
