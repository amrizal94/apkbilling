const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files untuk upload
app.use('/uploads', express.static('uploads'));

// Database connection
const db = require('./config/database');

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tv', require('./routes/tv'));
app.use('/api/pos', require('./routes/pos'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));

// WebSocket handling
const socketHandler = require('./sockets/socketHandler');
socketHandler(io);

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

// Add health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

startServer();