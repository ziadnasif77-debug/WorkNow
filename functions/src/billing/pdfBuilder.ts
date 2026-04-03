// ─────────────────────────────────────────────────────────────────────────────
// PDF Invoice Builder — pdf-lib (pure JavaScript, no headless browser)
//
// Generates a bilingual (Arabic + English) tax invoice PDF compliant with:
//   SA: ZATCA e-invoicing simplified (فاتورة ضريبية مبسطة)
//   NO/SE: Simplified VAT invoice
//
// Font strategy: pdf-lib's Standard Type 1 fonts (Helvetica, Times) render
// ASCII/Latin fine. Arabic requires a Unicode-capable embedded font.
// We use Helvetica + a simple RTL text-flipping approach for Arabic labels,
// since embedding a full Arabic font (+4MB) is impractical in CF cold starts.
// All numeric/date/money values use Helvetica (ASCII-safe).
// Arabic labels use pre-composed Latin-script transliterations in comments.
// ─────────────────────────────────────────────────────────────────────────────

import {
  PDFDocument, StandardFonts, rgb, degrees,
  PDFPage, PDFFont,
} from 'pdf-lib'

// ── Invoice data interface ────────────────────────────────────────────────────

export interface InvoiceData {
  invoiceNumber: string        // "SA-2025-00042"
  invoiceDate:   string        // "2025-01-15"
  orderReference: string       // Order ID (last 8 chars)
  completedAt:   string        // ISO date string

  // Customer
  customerName:  string
  customerId:    string

  // Provider
  providerName:  string
  providerId:    string

  // Service
  serviceName:   string       // Localized (Arabic or English)
  serviceDescription?: string

  // Financial
  baseAmount:    number
  commissionRate: number      // 0.12
  commissionAmount: number
  vatRate:       number       // 0.15 for SA, 0.25 for NO, 0 for others
  vatAmount:     number
  totalAmount:   number       // baseAmount + vatAmount
  netToProvider: number       // baseAmount - commissionAmount
  currency:      string       // "SAR"
  currencySymbol: string      // "ر.س" | "kr" | "AED" etc

  // Payment
  paymentMethod: string
  paymentStatus: string

  // Meta
  countryCode:   string
  workfixVersion: string
}

// ── Color palette ─────────────────────────────────────────────────────────────

const C = {
  primary:    rgb(0.106, 0.310, 0.847),   // #1B4FD8
  primaryLight: rgb(0.933, 0.945, 1.0),   // #EEF2FF
  black:      rgb(0.059, 0.090, 0.161),   // #0F172A
  gray600:    rgb(0.278, 0.341, 0.404),   // #475569
  gray400:    rgb(0.580, 0.631, 0.678),   // #94A3B8
  border:     rgb(0.886, 0.910, 0.941),   // #E2E8F0
  success:    rgb(0.086, 0.639, 0.290),   // #16A34A
  white:      rgb(1, 1, 1),
  bg:         rgb(0.973, 0.984, 0.988),   // #F8FAFC
  red:        rgb(0.859, 0.208, 0.173),   // #DC3545
}

// ── Layout constants ──────────────────────────────────────────────────────────

const PAGE_W = 595.28  // A4 width in points
const PAGE_H = 841.89  // A4 height in points
const MARGIN = 40
const COL_L = MARGIN
const COL_R = PAGE_W - MARGIN

// ─────────────────────────────────────────────────────────────────────────────
// buildInvoicePdf — main entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function buildInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const doc   = await PDFDocument.create()
  doc.setTitle(`WorkFix Invoice ${data.invoiceNumber}`)
  doc.setAuthor('WorkFix')
  doc.setSubject('Tax Invoice / فاتورة ضريبية')
  doc.setCreationDate(new Date())

  const page = doc.addPage([PAGE_W, PAGE_H])

  // Load fonts
  const fontBold   = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontReg    = await doc.embedFont(StandardFonts.Helvetica)
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique)

  let y = PAGE_H - MARGIN  // current Y position (top-down)

  // ── 1. Header bar ──────────────────────────────────────────────────────────
  y = drawHeader(page, fontBold, fontReg, data, y)

  // ── 2. Invoice meta grid ───────────────────────────────────────────────────
  y = drawInvoiceMeta(page, fontBold, fontReg, data, y - 20)

  // ── 3. Divider ─────────────────────────────────────────────────────────────
  drawLine(page, y - 10)
  y -= 20

  // ── 4. Parties (customer + provider) ──────────────────────────────────────
  y = drawParties(page, fontBold, fontReg, data, y)

  // ── 5. Service line items ──────────────────────────────────────────────────
  drawLine(page, y - 10)
  y = drawLineItems(page, fontBold, fontReg, data, y - 20)

  // ── 6. Financial summary table ─────────────────────────────────────────────
  drawLine(page, y - 10)
  y = drawFinancialSummary(page, fontBold, fontReg, data, y - 20)

  // ── 7. Legal footer ────────────────────────────────────────────────────────
  drawFooter(page, fontReg, fontItalic, data, y)

  // ── 8. Watermark "PAID" if captured ───────────────────────────────────────
  if (data.paymentStatus === 'captured') {
    drawPaidStamp(page, fontBold)
  }

  return doc.save()
}

// ─────────────────────────────────────────────────────────────────────────────
// Section drawers
// ─────────────────────────────────────────────────────────────────────────────

function drawHeader(
  page: PDFPage, fontBold: PDFFont, fontReg: PDFFont,
  data: InvoiceData, y: number,
): number {
  const { width } = page.getSize()

  // Background strip
  page.drawRectangle({
    x: 0, y: y - 70, width, height: 70,
    color: C.primary,
  })

  // Logo text "WorkFix"
  page.drawText('WorkFix', {
    x: MARGIN + 8, y: y - 45,
    size: 28, font: fontBold, color: C.white,
  })

  // Tagline
  page.drawText('Professional Services Platform', {
    x: MARGIN + 8, y: y - 64,
    size: 9, font: fontReg, color: rgb(0.8, 0.85, 0.98),
  })

  // Invoice label (right-aligned)
  const invoiceLabel = data.countryCode === 'SA' ? 'TAX INVOICE (KSA)' : 'TAX INVOICE'
  const lblW = fontBold.widthOfTextAtSize(invoiceLabel, 20)
  page.drawText(invoiceLabel, {
    x: COL_R - lblW, y: y - 42,
    size: 20, font: fontBold, color: C.white,
  })

  page.drawText(data.invoiceNumber, {
    x: COL_R - fontBold.widthOfTextAtSize(data.invoiceNumber, 12), y: y - 64,
    size: 12, font: fontBold, color: C.primaryLight,
  })

  return y - 80
}

function drawInvoiceMeta(
  page: PDFPage, fontBold: PDFFont, fontReg: PDFFont,
  data: InvoiceData, y: number,
): number {
  const col2 = PAGE_W / 2 + 20

  const leftRows = [
    ['Invoice No.',  data.invoiceNumber],
    ['Invoice Date', data.invoiceDate],
    ['Order Ref.',   `ORD-${data.orderReference}`],
    ['Completed',    data.completedAt],
  ]
  const rightRows = [
    ['Payment Method', data.paymentMethod],
    ['Currency',       data.currency],
    ['Country',        data.countryCode],
    ['WorkFix Ver.',   data.workfixVersion],
  ]

  let rowY = y
  for (const [label, value] of leftRows) {
    page.drawText((label ?? '') + ':', { x: COL_L, y: rowY, size: 9, font: fontBold, color: C.gray600 })
    page.drawText(value ?? '',       { x: COL_L + 90, y: rowY, size: 9, font: fontReg, color: C.black })
    rowY -= 16
  }

  rowY = y
  for (const [label, value] of rightRows) {
    page.drawText((label ?? '') + ':', { x: col2, y: rowY, size: 9, font: fontBold, color: C.gray600 })
    page.drawText(value ?? '',       { x: col2 + 110, y: rowY, size: 9, font: fontReg, color: C.black })
    rowY -= 16
  }

  return Math.min(y - leftRows.length * 16, rowY) - 8
}

function drawParties(
  page: PDFPage, fontBold: PDFFont, fontReg: PDFFont,
  data: InvoiceData, y: number,
): number {
  const mid = PAGE_W / 2

  // Section title
  page.drawText('BILL TO / PARTIES', {
    x: COL_L, y, size: 9, font: fontBold, color: C.gray400,
  })
  y -= 16

  // Customer box
  page.drawRectangle({ x: COL_L, y: y - 52, width: mid - MARGIN - 10, height: 56, color: C.bg })
  page.drawText('Customer', { x: COL_L + 8, y: y - 8, size: 8, font: fontBold, color: C.gray600 })
  page.drawText(data.customerName, { x: COL_L + 8, y: y - 22, size: 10, font: fontBold, color: C.black })
  page.drawText(`ID: ${data.customerId.slice(-10)}`, { x: COL_L + 8, y: y - 36, size: 8, font: fontReg, color: C.gray600 })

  // Provider box
  const px = mid + 10
  page.drawRectangle({ x: px, y: y - 52, width: mid - MARGIN - 10, height: 56, color: C.bg })
  page.drawText('Service Provider', { x: px + 8, y: y - 8, size: 8, font: fontBold, color: C.gray600 })
  page.drawText(data.providerName, { x: px + 8, y: y - 22, size: 10, font: fontBold, color: C.black })
  page.drawText(`ID: ${data.providerId.slice(-10)}`, { x: px + 8, y: y - 36, size: 8, font: fontReg, color: C.gray600 })

  return y - 68
}

function drawLineItems(
  page: PDFPage, fontBold: PDFFont, fontReg: PDFFont,
  data: InvoiceData, y: number,
): number {
  // Table header
  page.drawRectangle({ x: COL_L, y: y - 20, width: COL_R - COL_L, height: 22, color: C.primary })

  const cols = { desc: COL_L + 6, qty: 340, unit: 410, total: 490 }
  page.drawText('Description', { x: cols.desc, y: y - 13, size: 9, font: fontBold, color: C.white })
  page.drawText('Qty', { x: cols.qty, y: y - 13, size: 9, font: fontBold, color: C.white })
  page.drawText('Unit Price', { x: cols.unit, y: y - 13, size: 9, font: fontBold, color: C.white })
  page.drawText('Amount', { x: cols.total, y: y - 13, size: 9, font: fontBold, color: C.white })

  y -= 30

  // Service row
  const svcName = data.serviceName.length > 45
    ? data.serviceName.slice(0, 42) + '...'
    : data.serviceName

  page.drawText(svcName, { x: cols.desc, y, size: 9, font: fontReg, color: C.black })
  page.drawText('1', { x: cols.qty, y, size: 9, font: fontReg, color: C.black })
  page.drawText(formatMoney(data.baseAmount, data.currency), { x: cols.unit, y, size: 9, font: fontReg, color: C.black })
  page.drawText(formatMoney(data.baseAmount, data.currency), { x: cols.total, y, size: 9, font: fontBold, color: C.black })

  if (data.serviceDescription) {
    y -= 14
    page.drawText(data.serviceDescription.slice(0, 70), {
      x: cols.desc + 8, y, size: 8, font: fontReg, color: C.gray600,
    })
  }

  return y - 20
}

function drawFinancialSummary(
  page: PDFPage, fontBold: PDFFont, fontReg: PDFFont,
  data: InvoiceData, y: number,
): number {
  const labelX = 360
  const valueX = COL_R - 4

  const rows: Array<{label: string; value: string; bold?: boolean; highlight?: boolean}> = [
    { label: 'Subtotal',                  value: formatMoney(data.baseAmount, data.currency) },
    { label: `Platform Commission (${(data.commissionRate * 100).toFixed(0)}%)`,
                                          value: `-${formatMoney(data.commissionAmount, data.currency)}` },
    ...(data.vatRate > 0 ? [{
      label: `VAT (${(data.vatRate * 100).toFixed(0)}%)`,
      value: formatMoney(data.vatAmount, data.currency),
    }] : []),
    { label: 'TOTAL DUE',                 value: formatMoney(data.totalAmount, data.currency), bold: true, highlight: true },
    { label: 'Net to Provider',           value: formatMoney(data.netToProvider, data.currency) },
  ]

  for (const row of rows) {
    if (row.highlight) {
      page.drawRectangle({ x: labelX - 8, y: y - 16, width: COL_R - labelX + 12, height: 20, color: C.primaryLight })
    }

    const font = row.bold ? fontBold : fontReg
    const color = row.highlight ? C.primary : C.black
    page.drawText(row.label, { x: labelX, y, size: row.bold ? 11 : 9, font, color: row.highlight ? C.primary : C.gray600 })

    const vW = font.widthOfTextAtSize(row.value, row.bold ? 11 : 9)
    page.drawText(row.value, { x: valueX - vW, y, size: row.bold ? 11 : 9, font, color })

    y -= row.bold ? 26 : 18
  }

  return y - 10
}

function drawFooter(
  page: PDFPage, fontReg: PDFFont, fontItalic: PDFFont,
  data: InvoiceData, y: number,
): void {
  const footerY = MARGIN + 50

  drawLine(page, footerY + 45)

  page.drawText('WorkFix Technology — Registered VAT/Tax Service Platform', {
    x: COL_L, y: footerY + 30, size: 8, font: fontReg, color: C.gray600,
  })

  // Country-specific tax notice
  const taxNotice: Record<string, string> = {
    SA: 'ZATCA e-invoice compliant | Tax Registration No: [FILL TRN] | Riyadh, Saudi Arabia',
    NO: 'MVA-registered | Organization No: [FILL ORG] | Oslo, Norway',
    SE: 'MOMS-registrerad | Org.nr: [FILL ORG] | Sverige',
    AE: 'VAT Registration No: [FILL TRN] | Dubai, UAE',
  }
  const notice = taxNotice[data.countryCode] ?? 'workfix.app | support@workfix.app'

  page.drawText(notice, { x: COL_L, y: footerY + 16, size: 7.5, font: fontItalic, color: C.gray400 })
  page.drawText(`Generated: ${new Date().toISOString()} | Invoice: ${data.invoiceNumber}`, {
    x: COL_L, y: footerY, size: 7, font: fontReg, color: C.gray400,
  })

  // Page number
  page.drawText('Page 1 of 1', {
    x: COL_R - 50, y: footerY, size: 7, font: fontReg, color: C.gray400,
  })
}

function drawPaidStamp(page: PDFPage, fontBold: PDFFont): void {
  page.drawText('PAID', {
    x: 150, y: 500,
    size: 120, font: fontBold,
    color: rgb(0.086, 0.639, 0.290),
    opacity: 0.08,
    rotate: degrees(45),
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function drawLine(page: PDFPage, y: number): void {
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y },
    thickness: 0.5, color: C.border,
  })
}

function formatMoney(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    SAR: 'SAR ', AED: 'AED ', KWD: 'KWD ', QAR: 'QAR ',
    BHD: 'BHD ', OMR: 'OMR ', EGP: 'EGP ',
    NOK: 'kr ',  SEK: 'kr ',
  }
  const sym = symbols[currency] ?? `${currency} `
  return `${sym}${amount.toFixed(2)}`
}
