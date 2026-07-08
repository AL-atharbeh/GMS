import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from './logger';

export const setupSocketIO = (io: Server) => {
  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      socket.data.user = decoded;
      socket.data.tenantId = decoded.tenantId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const tenantId = socket.data.tenantId;
    const userId = socket.data.user?.userId;

    logger.info(`Socket connected: ${socket.id} | User: ${userId} | Tenant: ${tenantId}`);

    // Join tenant room for isolation
    socket.join(`tenant:${tenantId}`);
    socket.join(`user:${userId}`);

    // Join branch room if applicable
    if (socket.data.user?.branchId) {
      socket.join(`branch:${socket.data.user.branchId}`);
    }

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

// Helper to emit events to specific tenant
export const emitToTenant = (io: Server, tenantId: string, event: string, data: any) => {
  io.to(`tenant:${tenantId}`).emit(event, data);
};

export const emitToUser = (io: Server, userId: string, event: string, data: any) => {
  io.to(`user:${userId}`).emit(event, data);
};

export const emitToBranch = (io: Server, branchId: string, event: string, data: any) => {
  io.to(`branch:${branchId}`).emit(event, data);
};
