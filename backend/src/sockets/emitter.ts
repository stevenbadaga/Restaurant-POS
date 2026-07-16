import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function setSocketIOInstance(socketIO: SocketIOServer): void {
  io = socketIO;
}

export function getSocketIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO instance not initialized');
  }
  return io;
}

export function emitToRestaurant(restaurantId: string, event: string, data: any): void {
  const instance = getSocketIO();
  instance.to(`restaurant:${restaurantId}`).emit(event, data);
}

export function emitToUser(userId: string, event: string, data: any): void {
  const instance = getSocketIO();
  instance.to(`user:${userId}`).emit(event, data);
}
