import { useState, useCallback, useEffect } from 'react';
import api from '@/services/api';

export interface Printer {
  id: string;
  name: string;
  description: string | null;
  connectionType: 'USB' | 'NETWORK' | 'BLUETOOTH' | 'BROWSER';
  ipAddress: string | null;
  port: number | null;
  paperSize: 'THERMAL_58MM' | 'THERMAL_80MM' | 'A4';
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'DISABLED';
  isDefault: boolean;
  autoPrintReceipt: boolean;
  autoPrintTicket: boolean;
  kitchenStationId: string | null;
  kitchenStation?: { id: string; name: string } | null;
  isActive: boolean;
  displayOrder: number;
  config: any;
  lastUsedAt: string | null;
  _count?: { printJobs: number };
}

export interface PrintJob {
  id: string;
  jobType: string;
  status: string;
  title: string;
  paperSize: string;
  entityType: string | null;
  entityId: string | null;
  orderId: string | null;
  ticketId: string | null;
  receiptId: string | null;
  requestedBy: { firstName: string; lastName: string };
  printer?: { name: string; connectionType: string } | null;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export function usePrinter() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPrinters = useCallback(async () => {
    try {
      const response = await api.get('/printers');
      setPrinters(response.data?.data || []);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrinters(); }, [fetchPrinters]);

  const createPrinter = useCallback(async (data: Partial<Printer> & { name: string }) => {
    const response = await api.post('/printers', data);
    await fetchPrinters();
    return response.data?.data;
  }, [fetchPrinters]);

  const updatePrinter = useCallback(async (id: string, data: Partial<Printer>) => {
    const response = await api.put(`/printers/${id}`, data);
    await fetchPrinters();
    return response.data?.data;
  }, [fetchPrinters]);

  const deletePrinter = useCallback(async (id: string) => {
    await api.delete(`/printers/${id}`);
    await fetchPrinters();
  }, [fetchPrinters]);

  const getDefaultPrinter = useCallback((): Printer | undefined => {
    return printers.find(p => p.isDefault && p.isActive) || printers.find(p => p.isActive);
  }, [printers]);

  return {
    printers,
    loading,
    fetchPrinters,
    createPrinter,
    updatePrinter,
    deletePrinter,
    getDefaultPrinter,
  };
}

// ==========================================
// PRINTING ACTIONS
// ==========================================

export async function printKitchenTicket(ticketId: string, printerId?: string): Promise<PrintJob> {
  const params: Record<string, string> = {};
  if (printerId) params.printerId = printerId;
  const response = await api.post(`/printers/print-kitchen-ticket/${ticketId}`, {}, { params });
  // Open print window with the HTML content
  const html = response.data?.data?.html;
  if (html) {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      alert('Please allow pop-ups to print kitchen tickets');
    }
  }
  return response.data?.data?.job;
}

export async function printReceipt(receiptId: string, paperSize: string = 'THERMAL_80MM', printerId?: string): Promise<PrintJob> {
  const params: Record<string, string> = { paperSize };
  if (printerId) params.printerId = printerId;
  const response = await api.post(`/printers/print-receipt/${receiptId}`, {}, { params });
  const html = response.data?.data?.html;
  if (html) {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      alert('Please allow pop-ups to print');
    }
  }
  return response.data?.data?.job;
}
