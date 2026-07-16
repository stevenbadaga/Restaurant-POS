import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Receipt,
  Search,
  Printer,
  Download,
  RotateCcw,
  XCircle,
  FileText,
  Eye,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardFooter,
  Button,
  Badge,
  Loading,
  EmptyState,
  ErrorState,
} from '@/components/ui';
import {
  getReceipts,
  getReceiptDetail,
  getReceiptByOrder,
  getReceiptPdfUrl,
  reprintReceipt,
  voidReceipt,
} from '@/services/receipts';
import { formatCurrency, formatDate } from '@/lib';

export default function Receipts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') || 'list';
  const receiptId = searchParams.get('id');
  const orderId = searchParams.get('orderId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptsData, setReceiptsData] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [paperSize, setPaperSize] = useState('THERMAL_80MM');
  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;
      if (page > 1) params.page = String(page);
      const result = await getReceipts(params);
      setReceiptsData(result.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load receipts');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, page]);

  const fetchDetail = useCallback(async () => {
    if (!receiptId && !orderId) return;
    setLoading(true);
    setError(null);
    try {
      let result;
      if (receiptId) {
        result = await getReceiptDetail(receiptId);
      } else if (orderId) {
        result = await getReceiptByOrder(orderId);
      }
      setDetail(result.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load receipt');
    } finally {
      setLoading(false);
    }
  }, [receiptId, orderId]);

  useEffect(() => {
    if (view === 'list') {
      fetchList();
    } else {
      fetchDetail();
    }
  }, [view, fetchList, fetchDetail]);

  const handlePrint = () => {
    if (!detail) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print receipts');
      return;
    }

    const isThermal = paperSize === 'THERMAL_58MM' || paperSize === 'THERMAL_80MM';
    const maxWidth = paperSize === 'THERMAL_58MM' ? '58mm' : paperSize === 'THERMAL_80MM' ? '80mm' : '210mm';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt ${detail.receiptNumber}</title>
        <style>
          @page { size: ${maxWidth} auto; margin: 0; }
          body {
            font-family: ${isThermal ? 'monospace' : "'Inter', sans-serif"};
            font-size: ${isThermal ? '10px' : '12px'};
            color: #000;
            background: #fff;
            margin: 0;
            padding: ${isThermal ? '10px 5px' : '20px'};
            width: 100%;
          }
          ${isThermal ? '.no-print { display: none !important; }' : ''}
          .header { text-align: center; margin-bottom: 10px; }
          .header h1 { font-size: ${isThermal ? '14px' : '18px'}; margin: 0 0 5px; }
          .header p { margin: 2px 0; font-size: ${isThermal ? '9px' : '11px'}; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .info-row { display: flex; justify-content: space-between; font-size: ${isThermal ? '9px' : '11px'}; margin: 2px 0; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th { text-align: left; font-size: ${isThermal ? '9px' : '11px'}; border-bottom: 1px dashed #000; padding: 4px 2px; }
          td { padding: 3px 2px; font-size: ${isThermal ? '9px' : '11px'}; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .total-row { font-weight: bold; border-top: 1px dashed #000; }
          .footer { text-align: center; margin-top: 10px; font-size: ${isThermal ? '8px' : '10px'}; }
          .reprint { text-align: center; font-weight: bold; font-size: ${isThermal ? '10px' : '14px'}; margin-bottom: 8px; }
          ${!isThermal ? `
            .print-button { text-align: center; margin: 20px 0; }
            .print-button button { padding: 10px 30px; font-size: 16px; cursor: pointer; }
          ` : ''}
        </style>
      </head>
      <body>
        ${detail.reprintCount > 0 ? '<div class="reprint">*** REPRINT ***</div>' : ''}
        <div class="header">
          <h1>${detail.restaurantNameSnapshot}</h1>
          ${detail.restaurantAddressSnapshot ? `<p>${detail.restaurantAddressSnapshot}</p>` : ''}
          ${detail.restaurantPhoneSnapshot ? `<p>Tel: ${detail.restaurantPhoneSnapshot}</p>` : ''}
          ${detail.restaurantEmailSnapshot ? `<p>${detail.restaurantEmailSnapshot}</p>` : ''}
        </div>
        <div class="divider"></div>
        <div class="text-center">
          <p><strong>Receipt: ${detail.receiptNumber}</strong></p>
          <p>Date: ${formatDate(detail.issuedAt)}</p>
          <p>Order: ${detail.orderNumberSnapshot}</p>
          <p>Type: ${detail.orderTypeSnapshot}</p>
          ${detail.tableNameSnapshot ? `<p>Table: ${detail.tableNameSnapshot} (${detail.tableCodeSnapshot})</p>` : ''}
          ${detail.waiterNameSnapshot ? `<p>Waiter: ${detail.waiterNameSnapshot}</p>` : ''}
          ${detail.customerNameSnapshot ? `<p>Customer: ${detail.customerNameSnapshot}</p>` : ''}
        </div>
        <div class="divider"></div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Price</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${detail.lines.map((line: any) => `
              <tr>
                <td>${line.itemNameSnapshot}</td>
                <td class="text-center">${line.quantity}</td>
                <td class="text-right">${parseFloat(line.unitPrice).toFixed(2)}</td>
                <td class="text-right">${parseFloat(line.lineTotal).toFixed(2)}</td>
              </tr>
              ${line.specialInstructions ? `<tr><td colspan="4" style="font-size:${isThermal ? '8px' : '10px'}; font-style:italic;">  ${line.specialInstructions}</td></tr>` : ''}
            `).join('')}
          </tbody>
        </table>
        <div class="divider"></div>
        <div class="info-row"><span>Subtotal</span><span>${parseFloat(detail.subtotal).toFixed(2)}</span></div>
        <div class="info-row"><span>Tax</span><span>${parseFloat(detail.taxAmount).toFixed(2)}</span></div>
        ${parseFloat(detail.serviceChargeAmount) > 0 ? `<div class="info-row"><span>Service Charge</span><span>${parseFloat(detail.serviceChargeAmount).toFixed(2)}</span></div>` : ''}
        ${parseFloat(detail.discountAmount) > 0 ? `<div class="info-row"><span>Discount</span><span>-${parseFloat(detail.discountAmount).toFixed(2)}</span></div>` : ''}
        <div class="info-row total-row"><span>Total</span><span>${parseFloat(detail.totalAmount).toFixed(2)} ${detail.currency}</span></div>
        <div class="divider"></div>
        <p class="text-center" style="font-size:${isThermal ? '9px' : '11px'};"><strong>Payments</strong></p>
        ${detail.payments.map((p: any) => `
          <div class="info-row"><span>${p.method.replace(/_/g, ' ')}${p.referenceNumber ? ` (Ref: ${p.referenceNumber})` : ''}</span><span>${parseFloat(p.amount).toFixed(2)}</span></div>
        `).join('')}
        <div class="info-row total-row"><span>Amount Paid</span><span>${parseFloat(detail.amountPaid).toFixed(2)}</span></div>
        ${parseFloat(detail.changeAmount) > 0 ? `<div class="info-row"><span>Change</span><span>${parseFloat(detail.changeAmount).toFixed(2)}</span></div>` : ''}
        <div class="divider"></div>
        <div class="footer">
          ${detail.receiptFooterSnapshot ? `<p>${detail.receiptFooterSnapshot}</p>` : ''}
          <p>Thank you for dining with us!</p>
          <p>Currency: ${detail.currency}</p>
        </div>
        ${!isThermal ? `
          <div class="print-button no-print">
            <button onclick="window.print()">Print Receipt</button>
          </div>
        ` : ''}
        <script>
          window.onload = function() {
            ${isThermal ? 'window.print(); window.close();' : ''}
          };
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  const handleReprint = async () => {
    if (!detail) return;
    try {
      const result = await reprintReceipt(detail.id);
      setDetail({ ...detail, reprintCount: result.data.reprintCount, lastReprintedAt: result.data.lastReprintedAt });
      setSuccessMsg('Reprint count updated');
      setTimeout(() => setSuccessMsg(null), 3000);
      handlePrint();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reprint');
    }
  };

  const handleVoid = async () => {
    if (!detail) return;
    setVoiding(true);
    try {
      const result = await voidReceipt(detail.id, voidReason);
      setDetail({ ...detail, status: 'VOIDED', voidedAt: result.data.voidedAt, voidReason: result.data.voidReason });
      setShowVoidDialog(false);
      setSuccessMsg('Receipt voided');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to void receipt');
    } finally {
      setVoiding(false);
    }
  };

  // Receipt Detail View
  const renderDetail = () => {
    if (loading) return <Loading message="Loading receipt..." />;
    if (error) return <ErrorState title="Error" message={error} />;
    if (!detail) return <EmptyState icon={<Receipt className="h-12 w-12" />} title="Receipt not found" />;

    return (
      <div className="space-y-6">
        <button onClick={() => { setSearchParams({}); setDetail(null); }} className="flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline">
          <ChevronLeft className="h-4 w-4" /> Back to Receipts
        </button>

        {successMsg && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <p className="text-sm text-green-600 dark:text-green-400">{successMsg}</p>
          </div>
        )}

        {/* Receipt Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardContent>
                <div className="max-w-[302px] mx-auto bg-white text-black p-4 rounded shadow-sm" style={{ fontFamily: 'monospace', fontSize: '10px' }}>
                  {detail.reprintCount > 0 && (
                    <p className="text-center font-bold text-sm mb-2">*** REPRINT ***</p>
                  )}
                  <div className="text-center mb-2">
                    <p className="font-bold text-sm">{detail.restaurantNameSnapshot}</p>
                    {detail.restaurantAddressSnapshot && <p>{detail.restaurantAddressSnapshot}</p>}
                    {detail.restaurantPhoneSnapshot && <p>Tel: {detail.restaurantPhoneSnapshot}</p>}
                    {detail.restaurantEmailSnapshot && <p>{detail.restaurantEmailSnapshot}</p>}
                  </div>
                  <p className="text-center border-t border-dashed border-gray-400 my-1"></p>
                  <p className="text-center"><strong>Receipt: {detail.receiptNumber}</strong></p>
                  <p className="text-center">Date: {formatDate(detail.issuedAt)}</p>
                  <p className="text-center">Order: {detail.orderNumberSnapshot}</p>
                  <p className="text-center">Type: {detail.orderTypeSnapshot}</p>
                  {detail.tableNameSnapshot && <p className="text-center">Table: {detail.tableNameSnapshot}</p>}
                  {detail.waiterNameSnapshot && <p className="text-center">Waiter: {detail.waiterNameSnapshot}</p>}
                  {detail.customerNameSnapshot && <p className="text-center">Customer: {detail.customerNameSnapshot}</p>}
                  <p className="text-center border-t border-dashed border-gray-400 my-1"></p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-dashed border-gray-400">
                        <th className="text-left">Item</th>
                        <th className="text-center">Qty</th>
                        <th className="text-right">Price</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((line: any) => (
                        <tr key={line.id}>
                          <td>{line.itemNameSnapshot}</td>
                          <td className="text-center">{line.quantity}</td>
                          <td className="text-right">{parseFloat(line.unitPrice).toFixed(2)}</td>
                          <td className="text-right">{parseFloat(line.lineTotal).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-center border-t border-dashed border-gray-400 my-1"></p>
                  <div className="flex justify-between text-xs"><span>Subtotal</span><span>{parseFloat(detail.subtotal).toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs"><span>Tax</span><span>{parseFloat(detail.taxAmount).toFixed(2)}</span></div>
                  {parseFloat(detail.serviceChargeAmount) > 0 && (
                    <div className="flex justify-between text-xs"><span>Service Charge</span><span>{parseFloat(detail.serviceChargeAmount).toFixed(2)}</span></div>
                  )}
                  {parseFloat(detail.discountAmount) > 0 && (
                    <div className="flex justify-between text-xs"><span>Discount</span><span>-{parseFloat(detail.discountAmount).toFixed(2)}</span></div>
                  )}
                  <div className="flex justify-between text-xs font-bold border-t border-dashed border-gray-400 pt-1"><span>Total</span><span>{parseFloat(detail.totalAmount).toFixed(2)} {detail.currency}</span></div>
                  <p className="text-center border-t border-dashed border-gray-400 my-1"></p>
                  <p className="text-center text-xs font-bold">Payments</p>
                  {detail.payments.map((p: any) => (
                    <div key={p.id} className="flex justify-between text-xs">
                      <span>{p.method.replace(/_/g, ' ')}{p.referenceNumber ? ` (Ref: ${p.referenceNumber})` : ''}</span>
                      <span>{parseFloat(p.amount).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold border-t border-dashed border-gray-400 pt-1"><span>Amount Paid</span><span>{parseFloat(detail.amountPaid).toFixed(2)}</span></div>
                  {parseFloat(detail.changeAmount) > 0 && (
                    <div className="flex justify-between text-xs"><span>Change</span><span>{parseFloat(detail.changeAmount).toFixed(2)}</span></div>
                  )}
                  <p className="text-center border-t border-dashed border-gray-400 my-1"></p>
                  <div className="text-center text-xs">
                    {detail.receiptFooterSnapshot && <p>{detail.receiptFooterSnapshot}</p>}
                    <p>Thank you for dining with us!</p>
                    <p>Currency: {detail.currency}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-[var(--color-text-primary)]">Actions</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Paper size selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">Paper Size</label>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-sm"
                  >
                    <option value="THERMAL_80MM">80mm Thermal</option>
                    <option value="THERMAL_58MM">58mm Thermal</option>
                    <option value="A4">A4</option>
                  </select>
                </div>

                <Button onClick={handlePrint} className="w-full" leftIcon={<Printer className="h-4 w-4" />}>
                  Print Receipt
                </Button>

                <a
                  href={getReceiptPdfUrl(detail.id, paperSize)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                >
                  <Button variant="secondary" className="w-full" leftIcon={<Download className="h-4 w-4" />}>
                    Download PDF
                  </Button>
                </a>

                <Button variant="secondary" onClick={handleReprint} className="w-full" leftIcon={<RotateCcw className="h-4 w-4" />}>
                  Reprint ({detail.reprintCount})
                </Button>

                {detail.status === 'ISSUED' && (
                  <Button
                    variant="danger"
                    className="w-full"
                    leftIcon={<XCircle className="h-4 w-4" />}
                    onClick={() => setShowVoidDialog(true)}
                  >
                    Void Receipt
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Info card */}
            <Card>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Status</span>
                  <Badge variant={detail.status === 'ISSUED' ? 'success' : 'error'}>{detail.status}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Reprints</span>
                  <span>{detail.reprintCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Issued By</span>
                  <span>{detail.issuedBy?.firstName} {detail.issuedBy?.lastName}</span>
                </div>
                {detail.voidedAt && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Voided At</span>
                      <span className="text-red-500">{formatDate(detail.voidedAt)}</span>
                    </div>
                    {detail.voidReason && (
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">Reason</span>
                        <span className="text-right text-red-500">{detail.voidReason}</span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Void Dialog */}
        {showVoidDialog && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !voiding && setShowVoidDialog(false)}>
            <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-card-border)] shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-[var(--color-border)]">
                <h2 className="text-lg font-display font-bold text-[var(--color-text-primary)]">Void Receipt</h2>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-[var(--color-text-muted)]">This will void receipt {detail.receiptNumber}. This action cannot be undone.</p>
                <div>
                  <label className="block text-sm font-medium mb-1">Reason *</label>
                  <textarea
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-lg border bg-[var(--color-input-bg)] border-[var(--color-input-border)]"
                    placeholder="Why is this receipt being voided?"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-[var(--color-border)] flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowVoidDialog(false)} disabled={voiding}>Cancel</Button>
                <Button variant="danger" onClick={handleVoid} isLoading={voiding}>Void Receipt</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Receipt List View
  const renderList = () => {
    if (loading) return <Loading message="Loading receipts..." />;
    if (error) return <ErrorState title="Error" message={error} action={<Button onClick={fetchList}>Retry</Button>} />;

    const receipts = receiptsData?.receipts || [];

    if (receipts.length === 0) {
      return (
        <EmptyState
          icon={<Receipt className="h-12 w-12" />}
          title="No receipts yet"
          description="Receipts will be generated when orders are completed and payments are processed."
        />
      );
    }

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[var(--color-text-primary)]">All Receipts</h3>
            <Button variant="ghost" size="sm" onClick={fetchList} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Receipt #</th>
                  <th className="text-left px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Order</th>
                  <th className="text-left px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Table</th>
                  <th className="text-left px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Waiter</th>
                  <th className="text-left px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Total</th>
                  <th className="text-left px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Date</th>
                  <th className="text-right px-6 py-3 text-xs font-medium uppercase text-[var(--color-text-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt: any) => (
                  <tr key={receipt.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-[var(--color-text-primary)]">{receipt.receiptNumber}</span>
                    </td>
                    <td className="px-6 py-4 text-sm">#{receipt.orderNumber}</td>
                    <td className="px-6 py-4 text-sm">{receipt.table?.name || receipt.table?.code || '-'}</td>
                    <td className="px-6 py-4 text-sm">{receipt.waiter ? `${receipt.waiter.firstName} ${receipt.waiter.lastName}` : '-'}</td>
                    <td className="px-6 py-4">
                      <Badge variant={receipt.status === 'ISSUED' ? 'success' : 'error'}>{receipt.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">{formatCurrency(parseFloat(receipt.totalAmount))}</td>
                    <td className="px-6 py-4 text-sm">{formatDate(receipt.issuedAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSearchParams({ view: 'detail', id: receipt.id })}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <a
                          href={getReceiptPdfUrl(receipt.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]"
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]"
                          title="Print"
                          onClick={() => setSearchParams({ view: 'detail', id: receipt.id })}
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {receiptsData?.pagination && (
            <div className="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-between">
              <p className="text-sm text-[var(--color-text-muted)]">
                Page {receiptsData.pagination.page} of {receiptsData.pagination.totalPages} ({receiptsData.pagination.total} receipts)
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="secondary" size="sm" disabled={page >= (receiptsData.pagination.totalPages || 1)} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Receipts"
        description="View, print, and manage receipts"
      />

      {view !== 'list' && view !== 'detail' ? (
        <div>
          {renderList()}
        </div>
      ) : view === 'detail' || receiptId || orderId ? (
        renderDetail()
      ) : (
        renderList()
      )}
    </div>
  );
}
