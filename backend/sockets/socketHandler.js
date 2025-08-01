// WebSocket handler for real-time updates
const db = require('../config/database');

function socketHandler(io) {
    console.log('🔌 WebSocket server initialized');
    
    // Store connected clients
    const connectedClients = new Map();
    
    io.on('connection', (socket) => {
        console.log(`👤 Client connected: ${socket.id}`);
        connectedClients.set(socket.id, {
            id: socket.id,
            connectedAt: new Date(),
            user: null
        });
        
        // Handle user authentication
        socket.on('authenticate', (data) => {
            try {
                if (data.user) {
                    connectedClients.set(socket.id, {
                        ...connectedClients.get(socket.id),
                        user: data.user
                    });
                    
                    console.log(`🔐 User authenticated: ${data.user.username} (${socket.id})`);
                    
                    // Join user to their role room
                    socket.join(`role_${data.user.role}`);
                    socket.join(`user_${data.user.id}`);
                    
                    socket.emit('authenticated', { success: true });
                }
            } catch (error) {
                console.error('Authentication error:', error);
                socket.emit('auth_error', { message: 'Authentication failed' });
            }
        });
        
        // Handle TV status updates
        socket.on('tv_status_update', (data) => {
            try {
                console.log(`📺 TV status update from ${socket.id}:`, data);
                
                // Broadcast to all admin users
                socket.broadcast.to('role_admin').emit('tv_status_changed', data);
                socket.broadcast.to('role_manager').emit('tv_status_changed', data);
            } catch (error) {
                console.error('TV status update error:', error);
            }
        });
        
        // Handle order status updates
        socket.on('order_status_update', (data) => {
            try {
                console.log(`🛒 Order status update from ${socket.id}:`, data);
                
                // Broadcast to all users
                io.emit('order_status_changed', data);
            } catch (error) {
                console.error('Order status update error:', error);
            }
        });
        
        // Handle new order notifications
        socket.on('new_order', (data) => {
            try {
                console.log(`🆕 New order from ${socket.id}:`, data);
                
                // Broadcast to all staff
                socket.broadcast.to('role_admin').emit('new_order_notification', data);
                socket.broadcast.to('role_manager').emit('new_order_notification', data);
                socket.broadcast.to('role_cashier').emit('new_order_notification', data);
            } catch (error) {
                console.error('New order notification error:', error);
            }
        });
        
        // Handle session warnings
        socket.on('session_warning', (data) => {
            try {
                console.log(`⚠️  Session warning from ${socket.id}:`, data);
                
                // Broadcast to all admin users
                socket.broadcast.to('role_admin').emit('session_warning', data);
                socket.broadcast.to('role_manager').emit('session_warning', data);
            } catch (error) {
                console.error('Session warning error:', error);
            }
        });
        
        // Handle low stock alerts
        socket.on('low_stock_alert', (data) => {
            try {
                console.log(`📦 Low stock alert from ${socket.id}:`, data);
                
                // Broadcast to admin and manager
                socket.broadcast.to('role_admin').emit('low_stock_alert', data);
                socket.broadcast.to('role_manager').emit('low_stock_alert', data);
            } catch (error) {
                console.error('Low stock alert error:', error);
            }
        });
        
        // Handle client ping for connection health
        socket.on('ping', () => {
            socket.emit('pong');
        });
        
        // Handle disconnection
        socket.on('disconnect', (reason) => {
            const client = connectedClients.get(socket.id);
            console.log(`👋 Client disconnected: ${socket.id} (${reason})`);
            
            if (client && client.user) {
                console.log(`   User: ${client.user.username}`);
            }
            
            connectedClients.delete(socket.id);
        });
        
        // Handle connection errors
        socket.on('error', (error) => {
            console.error(`❌ Socket error for ${socket.id}:`, error);
        });
    });
    
    // Periodic updates
    setInterval(async () => {
        try {
            // Send active session updates
            const [activeSessions] = await db.execute(`
                SELECT 
                    ts.id,
                    ts.device_id,
                    ts.customer_name,
                    ts.start_time,
                    ts.duration_minutes,
                    td.device_name,
                    GREATEST(0, ts.duration_minutes - EXTRACT(EPOCH FROM (NOW() - ts.start_time))/60) as remaining_minutes
                FROM tv_sessions ts
                JOIN tv_devices td ON ts.device_id = td.id
                WHERE ts.status = 'active'
            `);
            
            if (activeSessions.length > 0) {
                io.to('role_admin').emit('active_sessions_update', activeSessions);
                io.to('role_manager').emit('active_sessions_update', activeSessions);
            }
            
            // Send pending orders update
            const [pendingOrders] = await db.execute(`
                SELECT 
                    o.id,
                    o.order_number,
                    o.customer_name,
                    o.table_number,
                    o.total_amount,
                    o.status,
                    o.created_at,
                    COUNT(oi.id) as item_count
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.status IN ('pending', 'preparing')
                GROUP BY o.id, o.order_number, o.customer_name, o.table_number, 
                         o.total_amount, o.status, o.created_at
                ORDER BY o.created_at ASC
            `);
            
            if (pendingOrders.length > 0) {
                io.to('role_admin').emit('pending_orders_update', pendingOrders);
                io.to('role_manager').emit('pending_orders_update', pendingOrders);
                io.to('role_cashier').emit('pending_orders_update', pendingOrders);
            }
            
        } catch (error) {
            console.error('Periodic update error:', error);
        }
    }, 30000); // Every 30 seconds
    
    // Return socket instance for external use
    return io;
}

module.exports = socketHandler;