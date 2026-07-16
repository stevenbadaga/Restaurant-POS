import { useState, useEffect } from 'react';
import { QrCode, Plus, RotateCcw, X, Download, AlertTriangle, Printer, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib';
import api from '@/services/api';

interface QrTokenData {
  id: string;
  tableId: string;
  tableName: string;
  tableCode: string;
  diningAreaName: string | null;
  tokenPrefix: string | null;
  isActive: boolean;
  createdAt: string;
  rotatedAt: string | null;
  revokedAt: string | null;
  qrUrl: string;
}

interface TableToken extends QrTokenData {
  hasToken: boolean;
}

export default function QrCodes() {
  const [tables, setTables] = useState<TableToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableToken | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTokens();
  }, []);

  async function loadTokens() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/tables/qr-codes');
      const data: QrTokenData[] = res.data.data || [];
      setTables(
        data.map((t) => ({
          ...t,
          hasToken: !!t.id && t.isActive,
        })),
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load QR tokens.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(tableId: string) {
    setGenerating(true);
    try {
      const res = await api.post(`/tables/${tableId}/qr-token`);
      const data = res.data.data;
      // Generate QR image
      generateQrImage(data.qrUrl);
      // Update the list
      await loadTokens();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate QR code.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRotate(tokenId: string) {
    if (!confirm('Rotating the QR code will invalidate the previous one. Continue?')) return;
    try {
      await api.post(`/tables/qr-tokens/${tokenId}/rotate`);
      await loadTokens();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to rotate QR code.');
    }
  }

  async function handleRevoke(tokenId: string) {
    if (!confirm('Revoking this QR code will make it unusable. Continue?')) return;
    try {
      await api.post(`/tables/qr-tokens/${tokenId}/revoke`);
      await loadTokens();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to revoke QR code.');
    }
  }

  async function generateQrImage(url: string) {
    try {
      // Dynamically import qrcode library
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      setQrImageUrl(dataUrl);
    } catch {
      // Fallback: use API-based QR generation
      setQrImageUrl(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`);
    }
  }

  async function showTablePreview(table: TableToken) {
    setSelectedTable(table);
    setShowPreview(true);

    if (table.qrUrl) {
      await generateQrImage(table.qrUrl);
    }
  }

  function handleDownload() {
    if (!qrImageUrl || !selectedTable) return;

    const link = document.createElement('a');
    link.download = `qr-${selectedTable.tableCode}.png`;
    link.href = qrImageUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrint() {
    if (!qrImageUrl || !selectedTable) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${selectedTable.tableName}</title>
          <style>
            body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; font-family: sans-serif; }
            .card { text-align: center; padding: 40px; }
            .logo { max-width: 120px; margin-bottom: 16px; }
            .name { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
            .subtitle { font-size: 14px; color: #666; margin-bottom: 32px; }
            .qr img { width: 300px; height: 300px; }
            .footer { margin-top: 24px; font-size: 11px; color: #999; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="name">${selectedTable.tableName}</div>
            <div class="subtitle">Scan to View Menu and Order</div>
            <div class="qr"><img src="${qrImageUrl}" /></div>
            <div class="footer">QR codes should be treated like keys. Do not share publicly.</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  const filteredTables = tables.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.tableName.toLowerCase().includes(q) ||
      t.tableCode.toLowerCase().includes(q) ||
      (t.diningAreaName || '').toLowerCase().includes(q)
    );
  });

  // ─── Render ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-gray-200" />
          <div className="h-4 w-48 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">QR Codes</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Generate and manage QR codes for table ordering
          </p>
        </div>
        <button
          onClick={loadTokens}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search tables..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-primary)] text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none"
        />
      </div>

      {/* Tables Grid */}
      {filteredTables.length === 0 ? (
        <div className="text-center py-16">
          <QrCode className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No tables found</p>
          <p className="text-sm text-gray-400 mt-1">
            {searchQuery ? 'Try a different search' : 'Create tables first to generate QR codes'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTables.map((table) => (
            <div
              key={table.tableId}
              className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-[var(--color-text-primary)]">{table.tableName}</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {table.diningAreaName || 'No area'} · Code: {table.tableCode}
                  </p>
                </div>
                <div className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium',
                  table.hasToken
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-50 text-gray-500',
                )}>
                  {table.hasToken ? 'Active' : 'No Token'}
                </div>
              </div>

              <div className="flex items-center justify-center h-24 bg-gray-50 rounded-lg mb-3 overflow-hidden">
                {table.hasToken && table.qrUrl ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(table.qrUrl)}`}
                    alt={`QR for ${table.tableName}`}
                    className="h-20 w-20 object-contain"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <QrCode className="h-10 w-10 text-gray-300" />
                )}
              </div>

              <div className="flex gap-2">
                {table.hasToken ? (
                  <>
                    <button
                      onClick={() => showTablePreview(table)}
                      className="flex-1 px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors"
                    >
                      <QrCode className="h-3.5 w-3.5 inline mr-1" />
                      View QR
                    </button>
                    <button
                      onClick={() => handleRotate(table.id)}
                      className="px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"
                      title="Rotate QR code"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleRevoke(table.id)}
                      className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      title="Revoke QR code"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleGenerate(table.tableId)}
                    disabled={generating}
                    className="w-full px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5 inline mr-1" />
                    Generate QR
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Preview Modal */}
      {showPreview && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-scale-in">
            {/* Restaurant header */}
            <div className="text-center mb-6">
              <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                <QrCode className="h-6 w-6 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">{selectedTable.tableName}</h2>
              <p className="text-sm text-gray-500">
                {selectedTable.diningAreaName ? `${selectedTable.diningAreaName} · ` : ''}
                Code: {selectedTable.tableCode}
              </p>
            </div>

            {/* QR Image */}
            <div className="flex justify-center mb-6">
              {qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt={`QR Code for ${selectedTable.tableName}`}
                  className="w-48 h-48 object-contain"
                />
              ) : (
                <div className="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center">
                  <div className="animate-pulse h-8 w-8 rounded-full bg-gray-200" />
                </div>
              )}
            </div>

            <p className="text-center text-xs text-gray-400 mb-6">
              Scan to view menu and order
            </p>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDownload}
                disabled={!qrImageUrl}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                onClick={handlePrint}
                disabled={!qrImageUrl}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>

            <button
              onClick={() => setShowPreview(false)}
              className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
