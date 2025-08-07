const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const CleanupScheduler = require('./utils/cleanup-scheduler');
require('dotenv').config();

// Set timezone to Indonesia Jakarta
process.env.TZ = process.env.TIMEZONE || 'Asia/Jakarta';
console.log(`🌍 Timezone set to: ${process.env.TZ}`);

// Initialize database and run migrations
const DatabaseMigrator = require('./migrations/migrator');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());

// Enhanced JSON parser with error handling for heartbeat issues
app.use(express.json({
    verify: (req, res, buf) => {
        // Store raw body for debugging JSON parse errors
        req.rawBody = buf;
    }
}));

// JSON parse error handler - must be after express.json()
app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        console.error('❌ JSON Parse Error:', {
            url: req.url,
            method: req.method,
            contentType: req.headers['content-type'],
            userAgent: req.headers['user-agent'],
            rawBody: req.rawBody?.toString('utf8')?.substring(0, 200),
            error: error.message
        });
        
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON format',
            error: 'Bad JSON syntax - check for control characters'
        });
    }
    next(error);
});

app.use(express.urlencoded({ extended: true }));

// Static files untuk upload
app.use('/uploads', express.static('uploads'));

// Database connection
const db = require('./config/database');

// Add health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/packages', require('./routes/packages'));

// TV routes with socket injection
const tvRoutes = require('./routes/tv');
tvRoutes.setSocketIO(io);
app.use('/api/tv', tvRoutes);
app.use('/tv', tvRoutes); // Additional route for frontend compatibility

app.use('/api/pos', require('./routes/pos'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/suppliers', require('./routes/suppliers'));

// Purchase routes with socket injection
const purchaseRoutes = require('./routes/purchases');
purchaseRoutes.setSocketIO(io);
app.use('/api/purchases', purchaseRoutes);

app.use('/api/users', require('./routes/users'));

// WebSocket handling
const socketHandler = require('./sockets/socketHandler');
socketHandler(io);

// Start heartbeat monitor
const HeartbeatMonitor = require('./services/heartbeatMonitor');
const heartbeatMonitor = new HeartbeatMonitor(io);
heartbeatMonitor.start();

// Start cleanup scheduler
const cleanupScheduler = new CleanupScheduler();
cleanupScheduler.start();

// Start device discovery cleanup service
const discoveryCleanup = tvRoutes.initCleanupService(io);
discoveryCleanup.start(5); // Run every 5 minutes

// Start session expired service
const SessionExpiredService = require('./services/sessionExpiredService');
const sessionExpiredService = new SessionExpiredService(io);
sessionExpiredService.start(1); // Check every 1 minute

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

const PORT = process.env.PORT || 3000;

// Initialize database before starting server
async function startServer() {
    try {
        // Run database migrations and seeds
        const migrator = new DatabaseMigrator();
        await migrator.initialize();
        
        // Start server
        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV}`);
            console.log(`🌐 Admin Panel: http://localhost:${PORT}`);
            console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();
