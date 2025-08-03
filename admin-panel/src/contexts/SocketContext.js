import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [activeSessions, setActiveSessions] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);

  useEffect(() => {
    if (isAuthenticated && user) {
      const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';
      const newSocket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
      });

      // Connection events
      newSocket.on('connect', () => {
        console.log('🔌 Connected to server');
        setConnected(true);
        
        // Authenticate with server
        newSocket.emit('authenticate', { user });
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from server:', reason);
        setConnected(false);
      });

      newSocket.on('authenticated', (data) => {
        if (data.success) {
          console.log('✅ Socket authenticated');
        }
      });

      newSocket.on('auth_error', (error) => {
        console.error('❌ Socket auth error:', error);
        toast.error('Real-time connection authentication failed');
      });

      // TV Management events
      newSocket.on('tv_status_changed', (data) => {
        console.log('📺 TV status changed:', data);
        // Handle TV status updates
      });

      newSocket.on('active_sessions_update', (sessions) => {
        setActiveSessions(sessions);
      });

      newSocket.on('session_warning', (data) => {
        toast(`⚠️ Session Warning: ${data.customer_name} on ${data.device_name} - ${data.remaining_minutes} minutes left`, {
          icon: '⚠️',
          style: {
            background: '#FF9800',
            color: '#FFF',
          },
          duration: 5000,
        });
      });

      newSocket.on('session_started', (data) => {
        console.log('🎯 Session started:', data);
        toast.success(`✅ Session started on ${data.customer_name}`);
        // Trigger TV status refresh
        window.dispatchEvent(new CustomEvent('refreshTVStatus'));
      });

      newSocket.on('session_ended', (data) => {
        console.log('🛑 Session ended:', data);
        toast(`ℹ️ Session ended on ${data.customer_name}`, {
          icon: 'ℹ️',
          style: {
            background: '#2196F3',
            color: '#FFF',
          },
          duration: 4000,
        });
        // Trigger TV status refresh
        window.dispatchEvent(new CustomEvent('refreshTVStatus'));
      });

      newSocket.on('device_updated', (data) => {
        console.log('📱 Device updated:', data);
        // Trigger TV status refresh to show updated device info
        window.dispatchEvent(new CustomEvent('refreshTVStatus'));
      });

      newSocket.on('device_status_changed', (data) => {
        console.log('📱 Device status changed:', data);
        if (data.new_status === 'offline') {
          toast(`📶 ${data.device_name} went offline`, { 
            icon: '⚠️',
            style: {
              background: '#FFA726',
              color: '#FFF',
            },
          });
        } else if (data.new_status === 'online') {
          toast.success(`📶 ${data.device_name} is back online`);
        }
        // Trigger TV status refresh
        window.dispatchEvent(new CustomEvent('refreshTVStatus'));
      });

      newSocket.on('device_auto_registered', (data) => {
        console.log('🆕 Device auto-registered:', data);
        toast.success(`🆕 New device registered: ${data.device_name}${data.device_location ? ` @ ${data.device_location}` : ''}`);
        // Trigger TV status refresh to show new device
        window.dispatchEvent(new CustomEvent('refreshTVStatus'));
      });

      // POS events
      newSocket.on('order_status_changed', (data) => {
        console.log('🛒 Order status changed:', data);
        // Handle order status updates
      });

      newSocket.on('new_order_notification', (order) => {
        toast.success(`🆕 New Order: ${order.order_number} - ${order.customer_name}`);
      });

      newSocket.on('pending_orders_update', (orders) => {
        setPendingOrders(orders);
      });

      // Stock alerts
      newSocket.on('low_stock_alert', (data) => {
        toast.error(`📦 Low Stock Alert: ${data.product_name} (${data.stock_quantity} left)`);
      });

      // Connection health check
      const pingInterval = setInterval(() => {
        if (newSocket.connected) {
          newSocket.emit('ping');
        }
      }, 30000);

      newSocket.on('pong', () => {
        // Connection is healthy
      });

      setSocket(newSocket);

      return () => {
        clearInterval(pingInterval);
        newSocket.disconnect();
      };
    }
  }, [isAuthenticated, user]);

  // Socket utility functions
  const emitTVStatusUpdate = (deviceId, status) => {
    if (socket && connected) {
      socket.emit('tv_status_update', { deviceId, status });
    }
  };

  const emitOrderStatusUpdate = (orderId, status) => {
    if (socket && connected) {
      socket.emit('order_status_update', { orderId, status });
    }
  };

  const emitNewOrder = (orderData) => {
    if (socket && connected) {
      socket.emit('new_order', orderData);
    }
  };

  const emitSessionWarning = (sessionData) => {
    if (socket && connected) {
      socket.emit('session_warning', sessionData);
    }
  };

  const emitLowStockAlert = (productData) => {
    if (socket && connected) {
      socket.emit('low_stock_alert', productData);
    }
  };

  const value = {
    socket,
    connected,
    activeSessions,
    pendingOrders,
    emitTVStatusUpdate,
    emitOrderStatusUpdate,
    emitNewOrder,
    emitSessionWarning,
    emitLowStockAlert,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}