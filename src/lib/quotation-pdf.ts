/**
 * Quotation PDF generation.
 *
 * Uses jsPDF with the AutoTable plugin to produce a real, selectable A4
 * portrait PDF (not a screenshot), matching the on-screen preview: blue
 * headings, gold accents, category tables and cream total rows. Multi-page
 * quotations are handled by AutoTable.
 *
 * Note: the standard PDF fonts have no rupee glyph, so the PDF uses `Rs.`
 * where the on-screen preview and print view use `₹`.
 */

import { jsPDF } from 'jspdf'
import autoTable, { type RowInput } from 'jspdf-autotable'

import type { Quotation } from '@/types'
import { BUSINESS, quotationPdfFileName, quotationRateNote, quotationTableRows } from './quotations'
import { formatDate } from './dates'
import { formatNumber } from './money'

const MARGIN = 12
const PAGE_WIDTH = 210
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const BLUE: [number, number, number] = [30, 64, 175]
const GOLD: [number, number, number] = [180, 83, 9]
const SLATE: [number, number, number] = [51, 65, 85]
const MUTED: [number, number, number] = [100, 116, 139]
const BORDER: [number, number, number] = [203, 213, 225]
const LIGHT_ROW: [number, number, number] = [241, 245, 249]
const CREAM: [number, number, number] = [255, 251, 235]
const CREAM_TEXT: [number, number, number] = [120, 53, 15]

/** Last AutoTable Y position, or the supplied fallback. */
function lastY(doc: jsPDF, fallback: number): number {
  const table = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
  return table?.finalY ?? fallback
}

function drawHeader(doc: jsPDF, quotation: Quotation): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...BLUE)
  doc.text(BUSINESS.name, PAGE_WIDTH / 2, 18, { align: 'center' })

  doc.setFontSize(10)
  doc.text(BUSINESS.businessType, PAGE_WIDTH / 2, 24, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(BUSINESS.materials, PAGE_WIDTH / 2, 29, { align: 'center', maxWidth: CONTENT_WIDTH })
  doc.text(BUSINESS.address, PAGE_WIDTH / 2, 33, { align: 'center', maxWidth: CONTENT_WIDTH })
  doc.text(
    `Mobile: ${BUSINESS.mobile}   ·   Proprietor: ${BUSINESS.proprietors}   ·   GSTIN: ${BUSINESS.gstin}`,
    PAGE_WIDTH / 2,
    37,
    { align: 'center' },
  )

  doc.setFontSize(9)
  doc.setTextColor(...SLATE)
  doc.text(`Date: ${formatDate(quotation.date)}`, PAGE_WIDTH - MARGIN, 18, { align: 'right' })

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.8)
  doc.line(MARGIN, 41, PAGE_WIDTH - MARGIN, 41)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...GOLD)
  doc.text('QUOTATION', PAGE_WIDTH / 2, 49, { align: 'center' })

  return 54
}

function drawInfoTable(doc: jsPDF, quotation: Quotation, startY: number): number {
  const entries: [string, string][] = [
    ['Quotation No', quotation.quotationNumber],
    ['Customer Name', quotation.customerName],
    ['Reference No', quotation.referenceNumber || '—'],
    ['Place', quotation.place || '—'],
    ['Date', formatDate(quotation.date)],
  ]
  if (quotation.customerGstNumber) {
    entries.push(['Customer GSTIN', quotation.customerGstNumber])
  }

  const body: RowInput[] = []
  for (let i = 0; i < entries.length; i += 2) {
    const first = entries[i]
    const second = entries[i + 1]
    body.push([
      first[0],
      first[1],
      second ? second[0] : '',
      second ? second[1] : '',
    ])
  }

  autoTable(doc, {
    startY,
    body,
    theme: 'grid',
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      fontSize: 8.5,
      cellPadding: 1.8,
      lineColor: BORDER,
      lineWidth: 0.1,
      textColor: SLATE,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold', textColor: MUTED, fillColor: LIGHT_ROW },
      1: { cellWidth: CONTENT_WIDTH / 2 - 28 },
      2: { cellWidth: 28, fontStyle: 'bold', textColor: MUTED, fillColor: LIGHT_ROW },
      3: { cellWidth: CONTENT_WIDTH / 2 - 28 },
    },
  })

  return lastY(doc, startY) + 4
}

function tableStyles() {
  return {
    theme: 'grid' as const,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8, cellPadding: 1.6, lineColor: BORDER, lineWidth: 0.1, textColor: SLATE },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: LIGHT_ROW },
  }
}

function drawCategoryHeading(doc: jsPDF, title: string, startY: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...BLUE)
  doc.text(title, MARGIN, startY)
  return startY + 2
}

function drawItemsTable(doc: jsPDF, quotation: Quotation, startY: number): number {
  const rows = quotationTableRows(quotation)
  if (rows.length === 0) return startY

  startY = drawCategoryHeading(doc, 'Items', startY)

  autoTable(doc, {
    ...tableStyles(),
    startY,
    head: [
      [
        'S.No',
        'Category',
        'Item / Type',
        'Size',
        'Length (Ft)',
        'Weight (Kg)',
        'Qty / Pieces',
        'Rate',
        'Amount (Rs.)',
      ],
    ],
    body: rows,
    styles: { ...tableStyles().styles, overflow: 'linebreak' as const },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 18 },
      2: { cellWidth: 38 },
      3: { cellWidth: 30 },
      4: { cellWidth: 15, halign: 'right' },
      5: { cellWidth: 19, halign: 'right' },
      6: { cellWidth: 15, halign: 'right' },
      7: { cellWidth: 19, halign: 'right' },
      8: { halign: 'right' },
    },
  })

  return lastY(doc, startY) + 4
}

function drawGrandTotal(doc: jsPDF, quotation: Quotation, startY: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = startY
  if (y > pageHeight - 60) {
    doc.addPage()
    y = MARGIN + 4
  }

  const width = 95
  autoTable(doc, {
    startY: y,
    body: [['Grand Total', `Rs. ${formatNumber(quotation.grandTotal)}`]],
    theme: 'grid',
    tableWidth: width,
    margin: { left: PAGE_WIDTH - MARGIN - width, right: MARGIN },
    styles: { fontSize: 11, fontStyle: 'bold', cellPadding: 2.6, lineColor: BORDER, lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: 55, fillColor: BLUE, textColor: [255, 255, 255] as [number, number, number] },
      1: { halign: 'right', fillColor: CREAM, textColor: CREAM_TEXT },
    },
  })

  y = lastY(doc, y) + 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...SLATE)
  doc.text('Amount in Words:', MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.text(quotation.amountInWords, MARGIN + 28, y, { maxWidth: CONTENT_WIDTH - 28 })

  y += 8
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(quotationRateNote(quotation.items), MARGIN, y, { maxWidth: CONTENT_WIDTH })
  y += 10

  return y
}

function drawSignature(doc: jsPDF, startY: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = startY
  if (y > pageHeight - 45) {
    doc.addPage()
    y = MARGIN + 10
  }

  const rightX = PAGE_WIDTH - MARGIN

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...SLATE)
  doc.text(`For ${BUSINESS.name}`, rightX, y, { align: 'right' })

  y += 18
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.2)
  doc.line(rightX - 45, y, rightX, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Authorized Signature', rightX, y + 4, { align: 'right' })

  y += 14
  doc.setFontSize(7.5)
  doc.setTextColor(...BLUE)
  doc.text(BUSINESS.address, PAGE_WIDTH / 2, y, { align: 'center', maxWidth: CONTENT_WIDTH })
  doc.text(
    `${BUSINESS.name}   ·   Mobile: ${BUSINESS.mobile}   ·   GSTIN: ${BUSINESS.gstin}`,
    PAGE_WIDTH / 2,
    y + 4,
    { align: 'center' },
  )

  return y + 8
}

/** Build the quotation as an A4 PDF document. */
export function buildQuotationPdf(quotation: Quotation): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  let y = drawHeader(doc, quotation)
  y = drawInfoTable(doc, quotation, y)
  y = drawItemsTable(doc, quotation, y)
  y = drawGrandTotal(doc, quotation, y)
  drawSignature(doc, y)

  return doc
}

/** The generated quotation PDF as a Blob, e.g. to share or upload. */
export function quotationPdfBlob(quotation: Quotation): Blob {
  return buildQuotationPdf(quotation).output('blob')
}

/** Build and download the quotation as an A4 PDF. */
export function downloadQuotationPdf(quotation: Quotation): void {
  buildQuotationPdf(quotation).save(quotationPdfFileName(quotation))
}
