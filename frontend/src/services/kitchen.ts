import api from './api';

export interface KitchenTicket {
  id: string;
  ticketNumber: string;
  status: 'NEW' | 'ACCEPTED' | 'PREPARING' | 'PARTIALLY_READY' | 'READY' | 'CANCELLED';
  createdAt: string;
  acceptedAt: string | null;
  preparationStartedAt: string | null;
  readyAt: string | null;
  kitchenStation: { id: string; name: string };
  order: {
    id: string;
    orderNumber: string;
    orderType: string;
    table: { name: string; code: string } | null;
    waiter: { firstName: string; lastName: string };
    notes: string | null;
    submittedAt: string;
  };
  assignedChef: { id: string; firstName: string; lastName: string } | null;
  items: KitchenTicketItem[];
}

export interface KitchenTicketItem {
  kitchenTicketId?: string;
  orderItem: {
    id: string;
    menuItemNameSnapshot: string;
    menuItemCodeSnapshot: string;
    quantity: number;
    specialInstructions: string | null;
    status: string;
    unitPrice: string;
  };
}

export interface KitchenStation {
  id: string;
  name: string;
}

export async function getActiveTickets(): Promise<KitchenTicket[]> {
  const response = await api.get('/kitchen');
  return response.data?.data ?? [];
}

export async function getTicketsByStation(stationId: string): Promise<KitchenTicket[]> {
  const response = await api.get(`/kitchen/stations/${stationId}`);
  return response.data?.data ?? [];
}

export async function getKitchenStations(): Promise<KitchenStation[]> {
  const response = await api.get('/menu/kitchen-stations');
  return response.data?.data ?? [];
}

export async function acceptTicket(ticketId: string): Promise<void> {
  await api.patch(`/kitchen/tickets/${ticketId}/accept`);
}

export async function startPreparing(ticketId: string): Promise<void> {
  await api.patch(`/kitchen/tickets/${ticketId}/prepare`);
}

export async function markItemsReady(ticketId: string, orderItemIds: string[]): Promise<void> {
  await api.patch(`/kitchen/tickets/${ticketId}/mark-ready`, { orderItemIds });
}
