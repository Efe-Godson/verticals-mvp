// Payroll month export (doc section 56). Mirrors recordsExport.js: xlsx via
// json_to_sheet, PDF via jsPDF + autotable, CSV via a BOM-prefixed Blob.
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { monthLabel } from './ui'

const STATUS_LABEL = {
  draft: 'Draft', pending_approval: 'Pending Approval', approved: 'Approved',
  on_hold: 'On Hold', paid: 'Paid', failed: 'Failed', cancelled: 'Cancelled',
}

const COLUMNS = ['Employee', 'Base Salary', 'Additions', 'Deductions', 'Final Amount', 'Status']

function toRows(records, employeesById) {
  return records.map(r => [
    employeesById[r.employee_id]?.full_name || '—',
    Math.round(Number(r.base_salary) || 0),
    Math.round(Number(r.total_additions) || 0),
    Math.round(Number(r.total_deductions) || 0),
    Math.round(Number(r.final_amount) || 0),
    STATUS_LABEL[r.status] || r.status,
  ])
}

function fileStem(month) {
  return `payroll-${month}`
}

export function exportPayrollToExcel(records, employeesById, month) {
  const aoa = [COLUMNS, ...toRows(records, employeesById)]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, monthLabel(month))
  XLSX.writeFile(wb, `${fileStem(month)}.xlsx`)
}

export function exportPayrollToCSV(records, employeesById, month) {
  const csvCell = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [COLUMNS.join(',')]
  toRows(records, employeesById).forEach(row => lines.push(row.map(csvCell).join(',')))
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileStem(month)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportPayrollToPDF(records, employeesById, month) {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize?.(14)
  doc.text(`Payroll — ${monthLabel(month)}`, 14, 16)
  autoTable(doc, {
    startY: 22,
    head: [COLUMNS],
    body: toRows(records, employeesById).map(r => r.map((c, i) => (i >= 1 && i <= 4 ? `NGN ${Number(c).toLocaleString()}` : c))),
    headStyles: { fillColor: [0, 112, 243] },
  })
  const total = records.reduce((s, r) => s + (Number(r.final_amount) || 0), 0)
  const y = (doc.lastAutoTable?.finalY || 30) + 8
  doc.text(`Total payable: NGN ${Math.round(total).toLocaleString()}`, 14, y)
  doc.save(`${fileStem(month)}.pdf`)
}
