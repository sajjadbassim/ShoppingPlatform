import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_ENDPOINTS, API_URL, getFreshAccessToken } from '@wasit/shared';
import { toast } from './toast';

// ينزّل فاتورة الطلب PDF ويفتحها عبر قائمة المشاركة (عرض/حفظ/إرسال) — الفاتورة للطلبات المسلّمة فقط
export async function openInvoice(orderId: string, orderNumber: string): Promise<void> {
  try {
    const token = await getFreshAccessToken();
    const target = new File(Paths.cache, `invoice-${orderNumber}.pdf`);
    const file = await File.downloadFileAsync(`${API_URL}${API_ENDPOINTS.INVOICE.PREVIEW(orderId)}`, target, {
      headers: { Authorization: `Bearer ${token}` },
      idempotent: true,
    });
    if (!(await Sharing.isAvailableAsync())) {
      toast.error('لا يوجد تطبيق على هاتفك لعرض ملفات PDF');
      return;
    }
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: `فاتورة الطلب ${orderNumber}`, UTI: 'com.adobe.pdf' });
  } catch {
    toast.error('الفاتورة متاحة فقط للطلبات المسلّمة. حاول مرة أخرى', { title: 'تعذّر فتح الفاتورة' });
  }
}
