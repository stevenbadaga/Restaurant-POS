import { io, Socket } from 'socket.io-client';
import { config } from '@/config';

// Derive socket URL from API URL by stripping /api suffix
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || config.apiUrl.replace(/\/api$/, '');



let socket: Socket | null = null;

export function connectSocket(restaurantId: string): Socket {
  if (socket?.connected) {
    socket.emit('join-restaurant', restaurantId);
    return socket;
  }

  socket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
    socket?.emit('join-restaurant', restaurantId);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
