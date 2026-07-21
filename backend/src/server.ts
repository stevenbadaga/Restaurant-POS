import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { allowedOrigins, env } from './config';
import { prisma } from './database/prisma';
import { initializeSocketHandlers } from './sockets';
import { setSocketIOInstance } from './sockets/emitter';
import logger from './logging/logger';

const server = http.createServer(app);

// Socket.IO initialization
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

// Store io instance for route-level emission
setSocketIOInstance(io);

initializeSocketHandlers(io);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutdown requested');
  io.close(() => {
    logger.info('Socket.IO server closed');
  });
  await prisma.$disconnect();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force shutdown if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
server.listen(env.PORT, () => {
  console.log(`🚀 Server running on port ${env.PORT}`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
  console.log(`🔗 Client URL: ${env.CLIENT_URL}`);
});

export { io };
