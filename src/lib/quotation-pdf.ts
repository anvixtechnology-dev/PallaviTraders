
import { jsPDF } from 'jspdf'
import autoTable, { type RowInput } from 'jspdf-autotable'

import type { Quotation } from '@/types'
import { BUSINESS, quotationPdfFileName, GST_NOTE, quotationTableRows } from './quotations'
import { formatDate } from './dates'
import { formatNumber } from './money'

const MARGIN = 8
const PAGE_WIDTH = 148
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

function drawHeader(doc: jsPDF): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...BLUE)
  doc.text(BUSINESS.name, PAGE_WIDTH / 2, 12, { align: 'center' })

  doc.setFontSize(8.5)
  doc.text(BUSINESS.businessType, PAGE_WIDTH / 2, 17, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  doc.text(BUSINESS.materials, PAGE_WIDTH / 2, 21, { align: 'center', maxWidth: CONTENT_WIDTH })
  doc.text(BUSINESS.address, PAGE_WIDTH / 2, 24.5, { align: 'center', maxWidth: CONTENT_WIDTH })
  doc.text(
    `Mobile: ${BUSINESS.mobile}   ·   Proprietor: ${BUSINESS.proprietors}   ·   GSTIN: ${BUSINESS.gstin}`,
    PAGE_WIDTH / 2,
    28,
    { align: 'center' },
  )

  doc.setFontSize(7)
  doc.setTextColor(...SLATE)
  doc.text(`Ph No: ${BUSINESS.phone}`, PAGE_WIDTH - MARGIN, 7, { align: 'right' })

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, 31, PAGE_WIDTH - MARGIN, 31)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...GOLD)
  doc.text('QUOTATION', PAGE_WIDTH / 2, 37.5, { align: 'center' })

  return 41
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
      fontSize: 7,
      cellPadding: 1.3,
      lineColor: BORDER,
      lineWidth: 0.1,
      textColor: SLATE,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold', textColor: MUTED, fillColor: LIGHT_ROW },
      1: { cellWidth: CONTENT_WIDTH / 2 - 22 },
      2: { cellWidth: 22, fontStyle: 'bold', textColor: MUTED, fillColor: LIGHT_ROW },
      3: { cellWidth: CONTENT_WIDTH / 2 - 22 },
    },
  })

  return lastY(doc, startY) + 3
}

function tableStyles() {
  return {
    theme: 'grid' as const,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 6, cellPadding: 1, lineColor: BORDER, lineWidth: 0.1, textColor: SLATE },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: LIGHT_ROW },
  }
}

function drawCategoryHeading(doc: jsPDF, title: string, startY: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...BLUE)
  doc.text(title, MARGIN, startY + 1)
  return startY + 2.5
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
    foot: [
      [
        { content: 'GRAND TOTAL', colSpan: 8, styles: { halign: 'right', fillColor: BLUE, textColor: [255, 255, 255] as [number, number, number] } },
        { content: formatNumber(quotation.grandTotal), styles: { halign: 'right', fillColor: CREAM, textColor: CREAM_TEXT } },
      ],
    ],
    showFoot: 'lastPage',
    footStyles: { fontSize: 7, fontStyle: 'bold' },
    styles: { ...tableStyles().styles, overflow: 'linebreak' as const },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 13 },
      2: { cellWidth: 18 },
      3: { cellWidth: 20 },
      4: { cellWidth: 11, halign: 'right' },
      5: { cellWidth: 15, halign: 'right' },
      6: { cellWidth: 11, halign: 'right' },
      7: { cellWidth: 14, halign: 'right' },
      8: { halign: 'right' },
    },
  })

  return lastY(doc, startY) + 3
}

function drawAmountInWords(doc: jsPDF, quotation: Quotation, startY: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = startY + 2
  if (y > pageHeight - 20) {
    doc.addPage()
    y = MARGIN + 4
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...SLATE)
  doc.text('Amount in Words:', MARGIN, y)
  doc.setFont('helvetica', 'normal')
  doc.text(quotation.amountInWords, MARGIN + 21, y, { maxWidth: CONTENT_WIDTH - 21 })

  y += 6
  doc.setFontSize(6)
  doc.setTextColor(...MUTED)
  doc.text(GST_NOTE, MARGIN, y, { maxWidth: CONTENT_WIDTH })
  y += 7

  return y
}

function drawSignature(doc: jsPDF, startY: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = startY
  if (y > pageHeight - 32) {
    doc.addPage()
    y = MARGIN + 10
  }

  const rightX = PAGE_WIDTH - MARGIN

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...SLATE)
  doc.text(`For ${BUSINESS.name}`, rightX, y, { align: 'right' })

  y += 12
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.2)
  doc.line(rightX - 38, y, rightX, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(...MUTED)
  doc.text('Authorized Signature', rightX, y + 3.5, { align: 'right' })

  y += 9
  doc.setFontSize(5.5)
  doc.setTextColor(...BLUE)
  doc.text(BUSINESS.address, PAGE_WIDTH / 2, y, { align: 'center', maxWidth: CONTENT_WIDTH })
  doc.text(
    `${BUSINESS.name}   ·   Mobile: ${BUSINESS.mobile}   ·   GSTIN: ${BUSINESS.gstin}`,
    PAGE_WIDTH / 2,
    y + 3.5,
    { align: 'center' },
  )

  return y + 8
}

/** Build the quotation as an A5 PDF document. */
export function buildQuotationPdf(quotation: Quotation): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' })

  let y = drawHeader(doc)
  y = drawInfoTable(doc, quotation, y)
  y = drawItemsTable(doc, quotation, y)
  y = drawAmountInWords(doc, quotation, y)
  drawSignature(doc, y)

  return doc
}

/** The generated quotation PDF as a Blob, e.g. to share or upload. */
export function quotationPdfBlob(quotation: Quotation): Blob {
  return buildQuotationPdf(quotation).output('blob')
}

/** Build and download the quotation as an A5 PDF. */
export function downloadQuotationPdf(quotation: Quotation): void {
  buildQuotationPdf(quotation).save(quotationPdfFileName(quotation))
}
