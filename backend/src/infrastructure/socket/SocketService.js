const socketIo = require('socket.io');

/**
 * Socket.IO Service for Real-time Communication
 */
class SocketService {
  constructor({ logger }) {
    this.logger = logger;
    this.io = null;
    this.connectedUsers = new Map();
    this.rooms = new Map();
  }

  /**
   * Initialize Socket.IO server
   */
  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupEventHandlers();
    this.logger.info('Socket.IO service initialized successfully');

    return this.io;
  }

  /**
   * Setup Socket.IO event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.logger.info('New socket connection', { socketId: socket.id });

      // Authentication handler
      socket.on('authenticate', (data) => {
        try {
          if (data.user && data.user.id) {
            socket.userId = data.user.id;
            socket.username = data.user.username;
            socket.role = data.user.role;

            this.connectedUsers.set(data.user.id, {
              socketId: socket.id,
              user: data.user,
              connectedAt: new Date()
            });

            socket.emit('authenticated', { success: true, message: 'Socket authenticated successfully' });
            this.logger.info('Socket authenticated', { 
              userId: data.user.id, 
              username: data.user.username,
              socketId: socket.id 
            });
          } else {
            socket.emit('auth_error', { message: 'Invalid user data' });
          }
        } catch (error) {
          this.logger.error('Socket authentication error', { error: error.message });
          socket.emit('auth_error', { message: 'Authentication failed' });
        }
      });

      // Ping/Pong for connection health
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // Room management
      socket.on('join_room', (roomName) => {
        socket.join(roomName);
        this.logger.debug('Socket joined room', { socketId: socket.id, room: roomName });
      });

      socket.on('leave_room', (roomName) => {
        socket.leave(roomName);
        this.logger.debug('Socket left room', { socketId: socket.id, room: roomName });
      });

      // TV Management events
      socket.on('tv_status_update', (data) => {
        this.logger.debug('TV status update received', data);
        socket.broadcast.emit('tv_status_changed', {
          ...data,
          timestamp: new Date().toISOString()
        });
      });

      // Order Management events
      socket.on('order_status_update', (data) => {
        this.logger.debug('Order status update received', data);
        socket.broadcast.emit('order_status_changed', {
          ...data,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('new_order', (data) => {
        this.logger.debug('New order received', data);
        socket.broadcast.emit('new_order_notification', {
          ...data,
          timestamp: new Date().toISOString()
        });
      });

      // Session management events
      socket.on('session_warning', (data) => {
        this.logger.debug('Session warning received', data);
        this.io.emit('session_warning', {
          ...data,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('low_stock_alert', (data) => {
        this.logger.debug('Low stock alert received', data);
        this.io.emit('low_stock_alert', {
          ...data,
          timestamp: new Date().toISOString()
        });
      });

      // Disconnect handler
      socket.on('disconnect', (reason) => {
        this.logger.info('Socket disconnected', { 
          socketId: socket.id, 
          userId: socket.userId,
          reason: reason 
        });

        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
        }
      });

      // Error handler
      socket.on('error', (error) => {
        this.logger.error('Socket error', { 
          socketId: socket.id, 
          userId: socket.userId,
          error: error.message 
        });
      });
    });
  }

  /**
   * Broadcast TV status update
   */
  broadcastTVStatusUpdate(data) {
    if (this.io) {
      this.io.emit('tv_status_changed', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast session started event
   */
  broadcastSessionStarted(data) {
    if (this.io) {
      this.io.emit('session_started', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast session ended event
   */
  broadcastSessionEnded(data) {
    if (this.io) {
      this.io.emit('session_ended', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast session expired event
   */
  broadcastSessionExpired(data) {
    if (this.io) {
      this.io.emit('sessionExpired', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast order created event
   */
  broadcastOrderCreated(data) {
    if (this.io) {
      this.io.emit('new_order', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast order status changed event
   */
  broadcastOrderStatusChanged(data) {
    if (this.io) {
      this.io.emit('order_status_changed', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast order completed event
   */
  broadcastOrderCompleted(data) {
    if (this.io) {
      this.io.emit('order_completed', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast pending orders update
   */
  broadcastPendingOrdersUpdate(orders) {
    if (this.io) {
      this.io.emit('pending_orders_update', orders);
    }
  }

  /**
   * Broadcast device status change
   */
  broadcastDeviceStatusChange(data) {
    if (this.io) {
      this.io.emit('device_status_changed', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast device auto registration
   */
  broadcastDeviceAutoRegistered(data) {
    if (this.io) {
      this.io.emit('device_auto_registered', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast device deleted
   */
  broadcastDeviceDeleted(data) {
    if (this.io) {
      this.io.emit('device_deleted', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast time added to session
   */
  broadcastTimeAdded(data) {
    if (this.io) {
      this.io.emit('time_added', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast payment confirmed
   */
  broadcastPaymentConfirmed(data) {
    if (this.io) {
      this.io.emit('payment_confirmed', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast session order created
   */
  broadcastSessionOrderCreated(data) {
    if (this.io) {
      this.io.emit('session_order_created', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast session paused
   */
  broadcastSessionPaused(data) {
    if (this.io) {
      this.io.emit('session_paused', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast session resumed
   */
  broadcastSessionResumed(data) {
    if (this.io) {
      this.io.emit('session_resumed', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast low stock alert
   */
  broadcastLowStockAlert(data) {
    if (this.io) {
      this.io.emit('low_stock_alert', {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Send notification to specific user
   */
  sendToUser(userId, event, data) {
    const userConnection = this.connectedUsers.get(userId);
    if (userConnection && this.io) {
      this.io.to(userConnection.socketId).emit(event, {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Send notification to users with specific role
   */
  sendToRole(roleName, event, data) {
    if (this.io) {
      for (const [userId, connection] of this.connectedUsers.entries()) {
        if (connection.user.role?.roleName === roleName || connection.user.role_name === roleName) {
          this.io.to(connection.socketId).emit(event, {
            ...data,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  /**
   * Get connected users list
   */
  getConnectedUsers() {
    return Array.from(this.connectedUsers.values()).map(connection => ({
      userId: connection.user.id,
      username: connection.user.username,
      role: connection.user.role?.roleName || connection.user.role_name,
      connectedAt: connection.connectedAt
    }));
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }
}

module.exports = SocketService;