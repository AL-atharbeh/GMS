import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { tenantMiddleware } from './middleware/tenantMiddleware';
import { setupSocketIO } from './utils/socket';

// Routes
import authRoutes from './modules/auth/auth.routes';
import tenantRoutes from './modules/tenants/tenants.routes';
import branchRoutes from './modules/garages/garages.routes';
import vehicleRoutes from './modules/vehicles/vehicles.routes';
import workOrderRoutes from './modules/work-orders/workOrder.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import customerRoutes from './modules/customers/customers.routes';
import invoiceRoutes from './modules/invoicing/invoicing.routes';
import technicianRoutes from './modules/technicians/technicians.routes';
import appointmentRoutes from './modules/appointments/appointments.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import reportRoutes from './modules/reports/reports.routes';
import superAdminRoutes from './modules/super-admin/super_admin.routes';
import qualityRoutes from './modules/quality/quality.routes';
import subscriptionRoutes from './modules/subscriptions/subscriptions.routes';
import trackingRoutes from './modules/tracking/tracking.routes';
import equipmentRoutes from './modules/equipment/equipment.routes';
import insuranceRoutes from './modules/insurance/insurance.routes';
import suppliersRoutes from './modules/inventory/suppliers.routes';
import usersRoutes from './modules/users/users.routes';
import supportRoutes from './modules/tenants/support.routes';
import { initStatementScheduler } from './modules/customers/statement.scheduler';

const app = express();
const httpServer = createServer(app);

// Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [
      env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3005'
    ].filter(Boolean) as string[],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setupSocketIO(io);

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: [
    env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3005'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(compression());

// Logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// Static files for photo uploads
import path from 'path';
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rate Limiting
app.use('/api/', rateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: env.NODE_ENV,
  });
});

// Public routes (no auth needed)
app.use('/api/auth', authRoutes);
app.use('/api/track', trackingRoutes); // Customer tracking - no auth

// Super Admin routes
app.use('/api/super-admin', superAdminRoutes);

// Tenant-scoped routes (require auth + tenant)
app.use('/api', tenantMiddleware);
app.use('/api/tenants', tenantRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/support', supportRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Global error handler
app.use(errorHandler);

// Start server
const PORT = env.PORT || 3001;

httpServer.listen(PORT, () => {
  logger.info(`🚀 GMS API Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${env.NODE_ENV}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  initStatementScheduler();
});

export { io };
export default app;
