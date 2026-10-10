// إيصال تجهيز طلب للطباعة: القطع بمقاساتها وكمياتها، الزبون والعنوان والملاحظات.
// صفحة مستقلة في نافذة جديدة (لا تتأثر بتنسيق الموقع) ثم نافذة الطباعة مباشرة

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const money = (n) => `${Number(n ?? 0).toLocaleString('en-US')} د.ع`

export const buildPackingSlipHtml = (order, storeName = '') => {
  const rows = (order.items || [])
    .filter(it => it.quantity > 0)
    .map(it => `
      <tr>
        <td class="box"></td>
        <td>
          <div class="name">${escapeHtml(it.productNameAr || it.productName)}</div>
          ${it.variantLabel ? `<div class="variant">${escapeHtml(it.variantLabel)}</div>` : ''}
          ${it.variantSku ? `<div class="sku">${escapeHtml(it.variantSku)}</div>` : ''}
        </td>
        <td class="qty">× ${it.quantity}</td>
        <td class="num">${money(it.subtotal)}</td>
      </tr>`).join('')

  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>طلب ${escapeHtml(order.subOrderNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Tahoma, Arial, sans-serif; color: #111; margin: 24px; font-size: 14px; }
  h1 { font-size: 20px; margin: 0; }
  .muted { color: #555; font-size: 12px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
  .num-big { font-size: 18px; font-weight: bold; direction: ltr; }
  .block { border: 1px solid #ccc; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
  .notes { border-color: #d97706; background: #fffbeb; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { text-align: right; padding: 8px 6px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  th { font-size: 12px; color: #555; }
  .box { width: 22px; } .box::before { content: ''; display: inline-block; width: 14px; height: 14px; border: 1.5px solid #111; border-radius: 3px; }
  .name { font-weight: bold; } .variant { font-weight: bold; margin-top: 2px; } .sku { color: #666; font-size: 11px; direction: ltr; text-align: right; }
  .qty { white-space: nowrap; font-weight: bold; font-size: 15px; } .num { white-space: nowrap; }
  .totals td { border: 0; padding: 3px 6px; } .totals .grand td { font-weight: bold; font-size: 16px; border-top: 2px solid #111; }
  @media print { body { margin: 8mm; } }
</style></head><body>
  <div class="head">
    <div><h1>${escapeHtml(storeName || 'إيصال تجهيز')}</h1><div class="muted">إيصال تجهيز طلب</div></div>
    <div style="text-align:left"><div class="num-big">#${escapeHtml(order.subOrderNumber)}</div>
      <div class="muted">${escapeHtml(new Date(order.createdAt).toLocaleString('ar-IQ-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }))}</div></div>
  </div>
  <div class="block">
    <div><b>${escapeHtml(order.customerName)}</b> ${order.customerPhone ? `<span dir="ltr">${escapeHtml(order.customerPhone)}</span>` : ''}</div>
    ${order.deliveryAddress ? `<div class="muted" style="margin-top:4px">${escapeHtml(order.deliveryAddress)}</div>` : ''}
  </div>
  ${order.customerNotes ? `<div class="block notes"><b>ملاحظة الزبون:</b> ${escapeHtml(order.customerNotes)}</div>` : ''}
  <table>
    <thead><tr><th></th><th>المنتج</th><th>الكمية</th><th>المبلغ</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="totals" style="margin-top:10px; width: 60%; margin-right: auto;">
    <tr><td>المجموع الفرعي</td><td class="num">${money(order.subtotal)}</td></tr>
    <tr><td>التوصيل</td><td class="num">${money(order.deliveryFee)}</td></tr>
    <tr class="grand"><td>الإجمالي</td><td class="num">${money((order.subtotal ?? 0) + (order.deliveryFee ?? 0))}</td></tr>
  </table>
  <script>window.onload = () => { window.focus(); window.print(); }</script>
</body></html>`
}

export const printOrder = (order, storeName) => {
  const w = window.open('', '_blank', 'width=720,height=900')
  if (!w) return false   // منع النوافذ المنبثقة
  w.document.open()
  w.document.write(buildPackingSlipHtml(order, storeName))
  w.document.close()
  return true
}
