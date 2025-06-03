// backend/src/server.ts
import * as express from 'express';
import * as cors from 'cors';
import helmet from 'helmet';
import * as compression from 'compression';
import * as dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Import routes
import authRoutes from './routes/auth';
import studentRoutes from './routes/student';
import schoolRoutes from './routes/school';
import newsRoutes from './routes/news';
// Import database
import { initDatabase } from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration - FIX UNTUK CRA
app.use(cors({
      origin: [
            'http://localhost:3000',  // CRA default port
            'http://localhost:3001',  // Alternative port
            process.env.FRONTEND_URL || 'http://localhost:3000'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
}));

// Handle preflight requests
app.options('*', cors());

// Rate limiting - LEBIH LONGGAR UNTUK DEVELOPMENT
const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Increase limit untuk development
      message: 'Terlalu banyak request dari IP ini, coba lagi nanti.',
      standardHeaders: true,
      legacyHeaders: false,
});

const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50, // Increase dari 5 ke 50 untuk development
      message: 'Terlalu banyak percobaan login, coba lagi dalam 15 menit.',
      standardHeaders: true,
      legacyHeaders: false,
});

// Apply rate limiting
app.use(limiter);
app.use('/api/auth', authLimiter);

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/news', newsRoutes);
// Health check
app.get('/api/health', (req, res) => {
      res.json({
            status: 'OK',
            message: 'Server is running',
            cors: 'enabled',
            timestamp: new Date().toISOString()
      });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error(err.stack);
      res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server'
      });
});

// 404 handler
app.use('*', (req, res) => {
      res.status(404).json({
            success: false,
            message: 'Endpoint tidak ditemukan'
      });
});

async function startServer() {
      try {
            // Initialize database
            await initDatabase();
            console.log('✅ Database connected successfully');

            app.listen(PORT, () => {
                  console.log(`🚀 Server running on port ${PORT}`);
                  console.log(`🌐 CORS enabled for: http://localhost:3000`);
                  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
                  console.log(`🔒 Auth endpoint: http://localhost:${PORT}/api/auth/login`);
                  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            });
      } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
      }
}

startServer();