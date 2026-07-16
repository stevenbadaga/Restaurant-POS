import { Decimal } from '@prisma/client/runtime/library';
import PDFDocument from 'pdfkit';
import { prisma } from '../../database/prisma';
import { createAuditLog } from '../../services/audit.service';
import { toDecimal, roundMoney } from '../../services/calculation.service';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../types/app-error';

type ExportFormat = 'csv' | 'xlsx' | 'pdf';

interface ExportOptions {
  restaurantId: string;
  userId: string;
  reportType: string;
  format: ExportFormat;
  columns: string[];
  rows: Record<string, any>[];
  title: string;
  filename?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Main export function. Routes to the appropriate format handler.
 */
export async function exportReport(options: ExportOptions): Promise<Buffer> {
  const { format } = options;

  await logReportExport(
    options.restaurantId,
    options.userId,
    options.reportType,
    format,
    { title: options.title, rowCount: options.rows.length }
  );

  switch (format) {
    case 'csv':
      return generateCsv(options);
    case 'xlsx':
      return generateXlsx(options);
    case 'pdf':
      return generatePdfReport(options);
    default:
      throw new BadRequestError(`Unsupported export format: ${format}`);
  }
}

/**
 * Generate CSV export.
 * Uses UTF-8 BOM for Excel compatibility.
 * Escapes formula injection and special characters.
 */
function generateCsv(options: ExportOptions): Buffer {
  const { columns, rows } = options;
  const bom = '\uFEFF';
  const header = columns.join(',') + '\n';

  const bodyLines = rows.map((row) => {
    return columns.map((col) => {
      let val = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
      // Spreadsheet formula injection protection
      if (/^[=+\-@]/.test(val)) {
        val = "'" + val;
      }
      // Escape quotes and commas
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(',');
  }).join('\n');

  return Buffer.from(bom + header + bodyLines, 'utf-8');
}

/**
 * Generate XLSX export using a lightweight XML approach.
 * For production, consider using ExcelJS or similar.
 */
async function generateXlsx(options: ExportOptions): Promise<Buffer> {
  const { title, columns, rows } = options;

  // Use Excel-compatible XML Spreadsheet format
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="header">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#F0F0F0" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="currency">
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="number">
   <NumberFormat ss:Format="#,##0"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Report">
  <Table>
   <Row>
    <Cell ss:MergeAcross="${columns.length - 1}"><Data ss:Type="String">${escapeXml(title)}</Data></Cell>
   </Row>
   <Row/>
   <Row>
    ${columns.map((col) => `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(col)}</Data></Cell>`).join('')}
   </Row>
   ${rows.map((row) => {
     const cells = columns.map((col) => {
       const val = row[col];
       const strVal = val !== undefined && val !== null ? String(val) : '';
       if (strVal === '') return '<Cell/>';
       // Determine type
       const numVal = parseFloat(strVal);
       if (!isNaN(numVal) && strVal !== '' && strVal === String(numVal)) {
         const styleId = strVal.includes('.') ? 'currency' : 'number';
         return `<Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${numVal}</Data></Cell>`;
       }
       // Formula injection protection
       const safe = /^[=+\-@]/.test(strVal) ? "'" + strVal : strVal;
       return `<Cell><Data ss:Type="String">${escapeXml(safe)}</Data></Cell>`;
     }).join('');
     return `<Row>${cells}</Row>`;
   }).join('\n    ')}
  </Table>
 </Worksheet>
</Workbook>`;

  return Buffer.from(xml, 'utf-8');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate a PDF report.
 */
function generatePdfReport(options: ExportOptions): Promise<Buffer> {
  const { title, columns, rows } = options;

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 30, bottom: 30, left: 30, right: 30 },
    info: {
      Title: title,
      Creator: 'Restaurant POS',
    },
  });

  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  return new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Title
    doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    // Column widths
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = Math.min(pageWidth / columns.length, 120);
    const totalWidth = colWidth * columns.length;

    // Headers
    doc.font('Helvetica-Bold').fontSize(8);
    const xPos = doc.x;
    const headerY = doc.y;
    columns.forEach((col, i) => {
      doc.text(col, xPos + i * colWidth, headerY, {
        width: colWidth,
        align: 'left',
        lineBreak: false,
      });
    });
    doc.moveDown(1);

    // Draw header underline
    doc.moveTo(doc.page.margins.left, doc.y - 5)
      .lineTo(doc.page.margins.left + totalWidth, doc.y - 5)
      .stroke();

    // Rows
    doc.font('Helvetica').fontSize(7.5);
    rows.forEach((row) => {
      // Check page break
      if (doc.y > doc.page.height - doc.page.margins.bottom - 30) {
        doc.addPage();
        // Repeat headers
        doc.font('Helvetica-Bold').fontSize(8);
        columns.forEach((col, i) => {
          doc.text(col, doc.page.margins.left + i * colWidth, doc.y, {
            width: colWidth, align: 'left', lineBreak: false,
          });
        });
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(7.5);
      }

      const rowY = doc.y;
      columns.forEach((col, i) => {
        const val = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
        doc.text(val, doc.page.margins.left + i * colWidth, rowY, {
          width: colWidth, align: 'left', lineBreak: false,
        });
      });
      doc.moveDown(0.8);
    });

    // Footer
    doc.fontSize(7).font('Helvetica');
    doc.text(`Page ${doc.bufferedPageRange().count}`, doc.page.margins.left, doc.page.height - 20, {
      align: 'center',
    });

    doc.end();
  });
}

async function logReportExport(
  restaurantId: string,
  userId: string,
  reportType: string,
  format: string,
  metadata?: Record<string, any>
): Promise<void> {
  await createAuditLog({
    restaurantId,
    userId,
    action: 'Report exported',
    entityType: 'Report',
    description: `Exported ${reportType} as ${format.toUpperCase()}`,
    metadata: { reportType, format, ...metadata } as any,
  });
}

