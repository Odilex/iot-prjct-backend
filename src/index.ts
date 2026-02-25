/**
 * Smart Campus Hub - Main Server Entry Point
 * Production-ready Express server with MQTT integration
 */

import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getMQTTHandler } from './mqtt/mqtt-handler';
import { webSocketService } from './services/websocket';
import { getLocalIPs } from './utils/network';

// Import routes
import adminRoutes from './routes/admin';
import parentRoutes from './routes/parent';
import staffRoutes from './routes/staff';
import authRoutes from './routes/auth';
import studentRoutes from './routes/students';
import parentsRoutesNew from './routes/parents';
import teacherRoutes from './routes/teachers';
import markRoutes from './routes/marks';
import attendanceRoutes from './routes/attendance';
import feeRoutes from './routes/fees';
import announcementRoutes from './routes/announcements';
import statsRoutes from './routes/stats';

// ============================================
// SERVER CONFIGURATION
// ============================================

const app: Express = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// MIDDLEWARE SETUP
// ============================================

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', process.env.CORS_ORIGIN].filter(Boolean) as string[],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
}));

// Rate limiting - relaxed for exhibition/dev
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (development only)
if (NODE_ENV === 'development') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

// ============================================
// API ROUTES
// ============================================

// Original routes
app.use('/api/admin', adminRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/staff', staffRoutes);

// New Dashboard routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/parents', parentsRoutesNew);
app.use('/api/teachers', teacherRoutes);
app.use('/api/marks', markRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/stats', statsRoutes);

// Base API info
app.get('/api', (req, res) => {
  res.json({
    message: 'Smart Campus Hub API is active',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      students: '/api/students',
      parents: '/api/parents',
      teachers: '/api/teachers',
      marks: '/api/marks',
      attendance: '/api/attendance',
      fees: '/api/fees',
      announcements: '/api/announcements',
      stats: '/api/stats',
      legacy: {
        admin: '/api/admin',
        parent: '/api/parent',
        staff: '/api/staff'
      }
    }
  });
});


// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

// 404 handler
app.use((req: Request, _res: Response) => {
  _res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server] Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

// ============================================
// SERVER STARTUP
// ============================================

async function startServer() {
  try {
    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize WebSocket server
    console.log('[Server] Initializing WebSocket server...');
    webSocketService.initialize(httpServer);
    console.log('[Server] WebSocket server initialized');

    // Initialize MQTT handler (non-fatal if broker is down)
    console.log('[Server] Initializing MQTT handler...');
    const mqttHandler = getMQTTHandler();
    try {
      await mqttHandler.connect();
      console.log('[Server] MQTT handler connected');
    } catch (mqttError) {
      console.error(
        '[Server] MQTT broker is not reachable. Continuing without MQTT. Error:',
        mqttError
      );
    }

    // Start HTTP server (Express + WebSocket)
    httpServer.listen(PORT, () => {
      const localIPs = getLocalIPs();
      console.log(`[Server] 🚀 Smart Campus Hub backend running on port ${PORT}`);
      console.log(`[Server] Environment: ${NODE_ENV}`);

      console.log(`[Server] Local Access: http://localhost:${PORT}/api`);
      if (localIPs.length > 0) {
        console.log(`[Server] Network Access (for other PCs/IoT):`);
        localIPs.forEach(ip => {
          console.log(`         - http://${ip}:${PORT}/api`);
          console.log(`         - mqtt://${ip}:1883 (if broker is shared)`);
        });
      }

      console.log(`[Server] Health check: http://localhost:${PORT}/health`);
      console.log(`[Server] WebSocket: ws://localhost:${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('[Server] SIGTERM received, shutting down gracefully...');
      await mqttHandler.disconnect();
      httpServer.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('[Server] SIGINT received, shutting down gracefully...');
      await mqttHandler.disconnect();
      httpServer.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('[Server] Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;
