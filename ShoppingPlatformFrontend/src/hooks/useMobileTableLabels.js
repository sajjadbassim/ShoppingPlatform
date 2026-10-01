// src/hooks/useMobileTableLabels.js
// على الهاتف تتحول جداول لوحات التحكم إلى بطاقات (CSS في index.css: .dashboard-main table).
// هذا الـ hook ينسخ عنوان كل عمود إلى خلاياه (data-label) ليظهر بجانب القيمة داخل البطاقة،
// ويعلّم خلية العنوان الرئيسية وخانة التحديد والإجراءات — دون تعديل أي صفحة.
import { useEffect } from 'react'

const labelTable = (table) => {
  const headers = [...(table.tHead?.rows[0]?.cells || [])].map(th => ({
    text: th.textContent.trim(),
    isCheck: !!th.querySelector('input[type="checkbox"]'),
  }))
  if (!headers.length) return

  for (const body of table.tBodies) {
    for (const row of body.rows) {
      let col = 0
      let primaryDone = false
      for (const cell of row.cells) {
        const header = headers[col] || { text: '' }
        col += cell.colSpan || 1

        cell.removeAttribute('data-cell')
        if (cell.colSpan > 1) { cell.setAttribute('data-cell', 'full'); cell.removeAttribute('data-label'); continue }
        if (header.isCheck || (!header.text && cell.querySelector('input[type="checkbox"]'))) {
          cell.setAttribute('data-cell', 'check'); cell.removeAttribute('data-label'); continue
        }
        // أول عمود له عنوان = عنوان البطاقة (المستخدم، رقم الطلب، المتجر...)
        if (!primaryDone && header.text) {
          primaryDone = true
          cell.setAttribute('data-cell', 'primary'); cell.removeAttribute('data-label'); continue
        }
        if (!header.text) { cell.setAttribute('data-cell', 'actions'); cell.removeAttribute('data-label'); continue }
        if (cell.getAttribute('data-label') !== header.text) cell.setAttribute('data-label', header.text)
      }
    }
  }
}

export const useMobileTableLabels = (ref) => {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    let frame = 0
    const run = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => root.querySelectorAll('table').forEach(labelTable))
    }
    run()
    const observer = new MutationObserver(run)
    observer.observe(root, { childList: true, subtree: true })
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [ref])
}
