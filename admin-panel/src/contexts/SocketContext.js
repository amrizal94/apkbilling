import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { triggerCompleteNotification, playNotificationSound, triggerBellAnimation } from '../utils/notificationUtils';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [activeSessions, setActiveSessions] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [pendingPurchaseOrders, setPendingPurchaseOrders] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [stockThreshold, setStockThreshold] = useState(15);

  const fetchInitialPendingOrders = async () => {
    try {
      const response = await axios.get('/pos/orders', { 
        params: { 
          status: 'pending',
          limit: 20 
        } 
      });
      if (response.data.success) {
        // Filter to ensure only pending orders
        const actualPendingOrders = response.data.data.filter(order => 
          order.status === 'pending' || order.status === 'preparing'
        );
        setPendingOrders(actualPendingOrders);
        console.log('📋 Initial pending orders loaded:', actualPendingOrders.length);
        console.log('📋 Pending orders data:', actualPendingOrders);
      }
    } catch (error) {
      console.error('Failed to fetch initial pending orders:', error);
      // Clear pending orders on error to avoid showing stale data
      setPendingOrders([]);
    }
  };

  const fetchInitialPendingPurchaseOrders = async () => {
    try {
      const response = await axios.get('/purchases/orders', { 
        params: { 
          status: 'pending',
          limit: 20 
        } 
      });
      if (response.data.success) {
        // Filter to ensure only pending purchase orders
        const actualPendingPurchaseOrders = response.data.data.filter(order => 
          order.status === 'pending'
        );
        setPendingPurchaseOrders(actualPendingPurchaseOrders);
        console.log('📦 Initial pending purchase orders loaded:', actualPendingPurchaseOrders.length);
        console.log('📦 Pending purchase orders data:', actualPendingPurchaseOrders);
      }
    } catch (error) {
      console.error('Failed to fetch initial pending purchase orders:', error);
      // Clear pending purchase orders on error to avoid showing stale data
      setPendingPurchaseOrders([]);
    }
  };

  useEffect(() => {
    // Request notification permission on first load
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('🔔 Notification permission:', permission);
      });
    }
    
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
        
        // Load initial data after connection
        setTimeout(() => {
          console.log('🔗 Socket connected, loading initial data...');
          fetchInitialPendingOrders();
          fetchInitialPendingPurchaseOrders();
          refreshLowStockItems();
        }, 1000);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from server:', reason);
        setConnected(false);
        // Clear pending orders when disconnected to avoid stale data
        console.log('❌ Clearing pending orders due to disconnect');
        setPendingOrders([]);
        setPendingPurchaseOrders([]);
      });

      newSocket.on('connect_error', (error) => {
        console.log('🔌 Socket connection error (backend might not have Socket.IO):', error.message);
        setConnected(false);
      });

      newSocket.on('authenticated', (data) => {
        if (data.success) {
          console.log('✅ Socket authenticated');
          // Fetch initial pending orders
          fetchInitialPendingOrders();
          fetchInitialPendingPurchaseOrders();
        }
      });

      // Listen for session expired events
      newSocket.on('sessionExpired', (data) => {
        console.log('⏰ Received session expired event:', data);
        // Dispatch custom event that components can listen to
        window.dispatchEvent(new CustomEvent('sessionExpired', { detail: data }));
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
        toast.success(`✅ Session started: ${data.customer_name}`);
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

      newSocket.on('sessionExpired', (data) => {
        console.log('⏰ Session expired:', data);
        toast(`⏰ Session Expired: ${data.customerName} on ${data.deviceName} (${data.overdueMinutes}min overdue)`, {
          icon: '⏰',
          style: {
            background: '#F44336',
            color: '#FFF',
          },
          duration: 5000,
        });
        // Trigger TV status refresh to remove expired session from UI
        window.dispatchEvent(new CustomEvent('refreshTVStatus'));
        // Also trigger specific expired session handler
        window.dispatchEvent(new CustomEvent('sessionExpired', { detail: data }));
      });

      newSocket.on('device_updated', (data) => {
        console.log('📱 Device updated:', data);
        console.log('📱 Triggering direct TV device update (no API call)');
        // Direct state update for instant UI response
        window.dispatchEvent(new CustomEvent('directDeviceUpdate', { detail: data }));
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
        // Trigger TV status refresh immediately for real-time updates
        console.log('📱 Triggering TV status refresh due to device status change');
        window.dispatchEvent(new CustomEvent('refreshTVStatus'));
      });

      newSocket.on('device_auto_registered', (data) => {
        console.log('🆕 Device auto-registered:', data);
        toast.success(`🆕 New device registered: ${data.device_name}${data.device_location ? ` @ ${data.device_location}` : ''}`);
        // Trigger TV status refresh to show new device
        window.dispatchEvent(new CustomEvent('refreshTVStatus'));
      });

      newSocket.on('device_deleted', (data) => {
        console.log('🗑️ Device deleted:', data);
        toast.success(`🗑️ Device deleted: ${data.device_name} by ${data.deleted_by}`);
        // Trigger TV status refresh to remove deleted device
        window.dispatchEvent(new CustomEvent('refreshTVStatus'));
      });

      // Order management events
      newSocket.on('new_order', (data) => {
        console.log('🆕 New order received:', data);
        setPendingOrders(prev => [...prev, data]);
        
        // Play notification sound and trigger bell animation for new orders
        playNotificationSound();
        triggerBellAnimation();
        toast.success(`🆕 New order: ${data.order_number}`);
      });

      newSocket.on('order_completed', (data) => {
        console.log('✅ Order completed:', data);
        setPendingOrders(prev => {
          const filtered = prev.filter(order => order.id !== data.order_id);
          console.log('✅ Filtered pending orders after completion:', filtered.length);
          
          // Trigger bell animation for real-time updates
          setTimeout(() => {
            triggerBellAnimation();
          }, 100);
          
          return filtered;
        });
        
        // Trigger interactive notification
        const toastMessage = triggerCompleteNotification('order_completed', {
          order_number: data.order_number
        });
        toast.success(toastMessage);
      });

      newSocket.on('order_status_changed', (data) => {
        console.log('📝 Order status changed:', data);
        setPendingOrders(prev => {
          // If status is not pending or preparing, remove from pending orders
          if (data.new_status !== 'pending' && data.new_status !== 'preparing') {
            const filtered = prev.filter(order => order.id !== data.order_id);
            console.log(`📝 Order ${data.order_id} status changed to ${data.new_status}, remaining pending: ${filtered.length}`);
            return filtered;
          }
          // Otherwise update the order
          const updated = prev.map(order => 
            order.id === data.order_id 
              ? { ...order, status: data.new_status }
              : order
          );
          console.log(`📝 Order ${data.order_id} status updated to ${data.new_status}, total pending: ${updated.length}`);
          return updated;
        });
      });

      newSocket.on('pending_orders_update', (orders) => {
        console.log('📋 Pending orders updated:', orders);
        setPendingOrders(orders);
      });

      newSocket.on('time_added', (data) => {
        console.log('⏰ Time added:', data);
        toast.success(`⏰ Added ${data.additional_minutes} minutes to ${data.device_name}`);
        // Trigger TV status refresh to update remaining time
        window.dispatchEvent(new CustomEvent('refreshTVStatus'));
      });

      newSocket.on('payment_confirmed', (data) => {
        console.log('💰 Payment confirmed:', data);
        toast.success(`💰 Payment confirmed for ${data.customer_name} by ${data.confirmed_by}`);
        // Trigger TV status refresh to update device status
        window.dispatchEvent(new CustomEvent('refreshTVStatus'));
      });

      newSocket.on('session_order_created', (data) => {
        console.log('🍽️ F&B Order created:', data);
        const amount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(data.total_amount);
        toast.success(`🍽️ Order placed for ${data.customer_name} - ${amount}`);
        // Trigger TV status refresh to update F&B totals
        window.dispatchEvent(new CustomEvent('refreshTVStatus'));
      });

      newSocket.on('session_paused', (data) => {
        console.log('⏸️ Session paused:', data);
        toast(`⏸️ Session paused: ${data.customer_name} - ${data.pause_reason}`, {
          icon: '⏸️',
          style: {
            background: '#FF9800',
            color: '#FFF',
          },
          duration: 4000,
        });
        // Trigger TV status refresh
        window.dispatchEvent(new CustomEvent('refreshTVStatus'));
      });

      newSocket.on('session_resumed', (data) => {
        console.log('▶️ Session resumed:', data);
        toast.success(`▶️ Session resumed: ${data.customer_name} (paused ${data.pause_duration}min)`);
        // Trigger TV status refresh
        window.dispatchEvent(new CustomEvent('refreshTVStatus'));
      });

      // Additional POS events
      newSocket.on('new_order_notification', (order) => {
        console.log('🆕 New order notification:', order);
        toast.success(`🆕 New Order: ${order.order_number} - ${order.customer_name}`);
        // Add to pending orders if not already there
        setPendingOrders(prev => {
          const exists = prev.find(existingOrder => existingOrder.id === order.id);
          if (!exists) {
            return [...prev, order];
          }
          return prev;
        });
      });

      newSocket.on('pending_orders_update', (orders) => {
        console.log('📋 Pending orders update received:', orders);
        setPendingOrders(orders);
      });

      // Purchase Order events
      newSocket.on('new_purchase_order', (data) => {
        console.log('🆕 New purchase order received:', data);
        setPendingPurchaseOrders(prev => [...prev, data]);
        
        // Play notification sound and trigger bell animation for new purchase orders
        playNotificationSound();
        triggerBellAnimation();
        toast.success(`🆕 New purchase order: ${data.purchase_order_number}`);
      });
        
      newSocket.on('purchase_order_received', (data) => {
        console.log('📦 Purchase order received:', data);
        setPendingPurchaseOrders(prev => {
          const filtered = prev.filter(order => order.id !== data.order_id);
          console.log('📦 Filtered pending purchase orders after received:', filtered.length);
          
          // Trigger bell animation for real-time updates
          setTimeout(() => {
            triggerBellAnimation();
          }, 100);
          
          return filtered;
        });
        
        // Trigger interactive notification for purchase received
        const toastMessage = triggerCompleteNotification('purchase_received', {
          po_number: data.po_number
        });
        toast.success(toastMessage);
      });

      newSocket.on('purchase_order_cancelled', (data) => {
        console.log('❌ Purchase order cancelled:', data);
        setPendingPurchaseOrders(prev => {
          const filtered = prev.filter(order => order.id !== data.order_id);
          console.log('❌ Filtered pending purchase orders after cancelled:', filtered.length);
          
          // Trigger bell animation for real-time updates
          setTimeout(() => {
            triggerBellAnimation();
          }, 100);
          
          return filtered;
        });
        
        toast.success(`❌ Purchase order cancelled: ${data.po_number}`);
      });

      // Stock alerts
      newSocket.on('low_stock_alert', (data) => {
        // Add/update item in low stock list
        setLowStockItems(prev => {
          const existing = prev.find(item => item.id === data.id);
          if (existing) {
            // Update existing item
            return prev.map(item => 
              item.id === data.id ? { ...item, ...data } : item
            );
          } else {
            // Add new item
            return [...prev, data];
          }
        });

        // Only show browser notification and sound, no toast
        // User can check stock alerts via the warning icon in header
        triggerCompleteNotification('low_stock', {
          product_name: data.product_name,
          stock_quantity: data.stock_quantity
        });
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

      // Debug interval to monitor pending orders state
      const debugInterval = setInterval(() => {
        setPendingOrders(current => {
          console.log('🐛 DEBUG - Current pending orders count:', current.length);
          if (current.length > 0) {
            console.log('🐛 DEBUG - Pending orders:', current.map(order => ({
              id: order.id,
              order_number: order.order_number,
              status: order.status,
              customer_name: order.customer_name
            })));
          }
          return current; // Don't change the state, just log it
        });
        
        setPendingPurchaseOrders(current => {
          console.log('🐛 DEBUG - Current pending purchase orders count:', current.length);
          if (current.length > 0) {
            console.log('🐛 DEBUG - Pending purchase orders:', current.map(order => ({
              id: order.id,
              purchase_order_number: order.purchase_order_number,
              status: order.status
            })));
          }
          return current; // Don't change the state, just log it
        });
      }, 15000); // Every 15 seconds

      setSocket(newSocket);

      return () => {
        clearInterval(pingInterval);
        clearInterval(debugInterval);
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

  const emitNewOrder = (orderData) => {
    if (socket && connected) {
      socket.emit('new_order', orderData);
    }
  };

  const emitOrderStatusUpdate = (data) => {
    if (socket && connected) {
      console.log('📤 Emitting order status update:', data);
      socket.emit('order_status_update', data);
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

  const refreshPendingOrders = () => {
    console.log('🔄 Manual refresh of pending orders triggered');
    fetchInitialPendingOrders();
    fetchInitialPendingPurchaseOrders();
  };

  const clearPendingOrders = () => {
    console.log('🧹 Manual clear of pending orders triggered');
    setPendingOrders([]);
    setPendingPurchaseOrders([]);
  };

  const refreshLowStockItems = async (threshold = null) => {
    try {
      console.log('🔄 Refreshing low stock items with threshold:', threshold);
      console.log('🔄 Making request to /pos/products...');
      
      // Temporary workaround: get all products and filter low stock on frontend
      const response = await axios.get('/pos/products');
      console.log('🔍 Full response object:', response);
      if (response.data.success) {
        console.log('🔍 Raw response data from /pos/products:', response.data.data.slice(0, 2));
        const thresholdValue = threshold || 15;
        const lowStockProducts = response.data.data.filter(product => 
          product.stock_quantity <= thresholdValue && product.is_active
        );
        console.log('🔍 Filtered low stock products:', lowStockProducts.slice(0, 2));
        
        // Convert to expected format and handle duplicates by adding category info
        const formattedProducts = lowStockProducts.map((product, index) => {
          console.log(`🔍 Processing product ${index}:`, product);
          console.log(`🔍 Product name field (name):`, product.name);
          console.log(`🔍 Product name field (product_name):`, product.product_name);
          
          // The clean architecture server returns 'name' instead of 'product_name'
          // Group products by name to detect duplicates
          const sameNameProducts = lowStockProducts.filter(p => p.name === product.name);
          const productName = sameNameProducts.length > 1 
            ? `${product.name} (${product.category_name || 'Unknown'})`
            : product.name;
          
          const formattedProduct = {
            id: product.id,
            product_name: productName,
            stock_quantity: product.stock_quantity,
            price: parseFloat(product.price) || 0,
            category_name: product.category_name || 'Unknown'
          };
          
          console.log('🔍 Formatted product result:', formattedProduct);
          return formattedProduct;
        });
        
        console.log('✅ Low stock items loaded:', formattedProducts.length);
        setLowStockItems(formattedProducts);
        setStockThreshold(thresholdValue);
        return thresholdValue;
      }
    } catch (error) {
      console.error('❌ Failed to refresh low stock items:', error.response?.data || error.message);
    }
    return null;
  };

  const clearLowStockItem = (itemId) => {
    setLowStockItems(prev => prev.filter(item => item.id !== itemId));
  };

  const value = {
    socket,
    connected,
    activeSessions,
    pendingOrders,
    pendingPurchaseOrders,
    lowStockItems,
    stockThreshold,
    setPendingOrders,
    setPendingPurchaseOrders,
    emitTVStatusUpdate,
    emitOrderStatusUpdate,
    emitNewOrder,
    emitSessionWarning,
    emitLowStockAlert,
    refreshPendingOrders,
    clearPendingOrders,
    refreshLowStockItems,
    clearLowStockItem,
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