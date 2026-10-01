// src/hooks/useFinance.js
// مستحقات المتاجر (الإدارة) و«أرباحي» (البائع)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut } from '../api/axios'
import { API_ENDPOINTS } from '../api/endpoints'

const unwrap = (r) => r.data?.data ?? r.data

export const useVendorBalances = () => useQuery({
  queryKey: ['finance', 'balances'],
  queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.FINANCE.BALANCES)) || [],
})

export const useVendorStatement = (vendorId) => useQuery({
  queryKey: ['finance', 'statement', vendorId],
  queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.FINANCE.STATEMENT(vendorId))),
  enabled: !!vendorId,
})

export const useMyEarnings = () => useQuery({
  queryKey: ['finance', 'me'],
  queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.FINANCE.ME)),
})

export const useDefaultCommission = () => useQuery({
  queryKey: ['finance', 'commission'],
  queryFn: async () => unwrap(await apiGet(API_ENDPOINTS.FINANCE.COMMISSION)),
})

const useFinanceMutation = (fn) => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }) })
}

export const useRecordPayout = () =>
  useFinanceMutation(async ({ vendorId, ...body }) => unwrap(await apiPost(API_ENDPOINTS.FINANCE.PAYOUT(vendorId), body)))

export const useRecordAdjustment = () =>
  useFinanceMutation(async ({ vendorId, ...body }) => unwrap(await apiPost(API_ENDPOINTS.FINANCE.ADJUST(vendorId), body)))

export const useSetVendorCommission = () =>
  useFinanceMutation(async ({ vendorId, ...body }) => unwrap(await apiPut(API_ENDPOINTS.FINANCE.VENDOR_COMMISSION(vendorId), body)))

export const useSetDefaultCommission = () =>
  useFinanceMutation(async (body) => unwrap(await apiPut(API_ENDPOINTS.FINANCE.COMMISSION, body)))

export const useBackfill = () =>
  useFinanceMutation(async () => unwrap(await apiPost(API_ENDPOINTS.FINANCE.BACKFILL)))

// كشف حساب CSV (يفتح في Excel بالعربية)
export const downloadStatementCsv = (name, entries) => {
  const rows = [['التاريخ', 'النوع', 'الطلب', 'الوصف', 'المرجع', 'المبلغ', 'الرصيد']]
  ;[...entries].reverse().forEach(e => rows.push([
    new Date(e.createdAt).toLocaleString('en-GB'), e.typeAr, e.orderNumber || '', e.description || '', e.reference || '', e.amount, e.runningBalance,
  ]))
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `كشف-حساب-${name}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
