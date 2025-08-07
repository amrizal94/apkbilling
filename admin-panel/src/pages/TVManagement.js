import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Box,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Add as AddIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Computer as ComputerIcon,
  Refresh as RefreshIcon,
  VolumeOff as AlarmOffIcon,
  Warning as WarningIcon,
  Delete as DeleteIcon,
  Payment as PaymentIcon,
  AttachMoney as MoneyIcon,
  Restaurant as RestaurantIcon,
  ShoppingCart as CartIcon,
  Pause as PauseIcon,
  PlayArrow as ResumeIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';

export default function TVManagement() {
  const { activeSessions, emitTVStatusUpdate } = useSocket();
  const [devices, setDevices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionDialog, setSessionDialog] = useState({ open: false, device: null });
  const [sessionForm, setSessionForm] = useState({
    package_id: '',
  });
  const [expiredAlarms, setExpiredAlarms] = useState(new Set()); // Track devices with expired alarms
  const [alarmAudio] = useState(() => null); // Disabled alarm audio to prevent 404 errors
  const [deleteDialog, setDeleteDialog] = useState({ open: false, device: null });
  const [addTimeDialog, setAddTimeDialog] = useState({ open: false, device: null });
  const [addTimeForm, setAddTimeForm] = useState({
    additional_minutes: '',
    package_id: ''
  });
  const [paymentDialog, setPaymentDialog] = useState({ open: false, device: null });
  const [paymentForm, setPaymentForm] = useState({
    payment_notes: ''
  });
  const [orderDialog, setOrderDialog] = useState({ open: false, device: null });
  const [products, setProducts] = useState([]);
  const [orderForm, setOrderForm] = useState({
    items: [],
    notes: ''
  });
  const [pauseDialog, setPauseDialog] = useState({ open: false, device: null });
  const [pauseForm, setPauseForm] = useState({
    pause_reason: 'other',
    pause_notes: ''
  });
  
  // Debounce timer for device updates
  const [updateTimer, setUpdateTimer] = useState(null);

  useEffect(() => {
    fetchDevices();
    fetchPackages();
    // Reduce polling interval to 60 seconds since we rely on WebSocket for real-time updates
    const interval = setInterval(fetchDevices, 60000); // Refresh every 60 seconds as backup
    
    // Listen for real-time refresh events  
    const handleRefresh = () => {
      console.log('🔄 Refreshing TV status due to real-time event');
      console.log('🔄 Calling fetchDevices() now...');
      fetchDevices();
    };

    // Listen for direct device updates (instant, no API call) with debouncing
    const handleDirectDeviceUpdate = (event) => {
      const updatedDevice = event.detail;
      console.log('⚡ Direct device update:', updatedDevice);
      
      // Clear any existing timer
      if (updateTimer) {
        clearTimeout(updateTimer);
      }
      
      // Immediate optimistic update
      setDevices(prevDevices => 
        prevDevices.map(device => 
          device.device_id === updatedDevice.device_id
            ? { ...device, device_name: updatedDevice.device_name, device_location: updatedDevice.device_location }
            : device
        )
      );
      
      console.log('⚡ UI updated instantly without API call');
      
      // Set timer for background sync (fallback)
      const timer = setTimeout(() => {
        console.log('🔄 Background sync after optimistic update');
        fetchDevices();
      }, 2000);
      
      setUpdateTimer(timer);
    };
    
    // Listen for expired session alerts
    const handleExpiredSession = (event) => {
      const data = event.detail;
      console.log('⏰ Session expired:', data);
      setExpiredAlarms(prev => new Set([...prev, data.deviceId]));
      toast.error(`⏰ Session Expired: ${data.deviceName} (${data.customerName}) - ${data.overdueMinutes}min overdue`, {
        duration: 10000, // Show for 10 seconds
        icon: '🚨',
      });
      
      // Optional: Play alarm sound
      try {
        alarmAudio?.play().catch(e => console.log('Audio play failed:', e));
      } catch (error) {
        console.log('Audio not available');
      }
      
      // Refresh devices to get updated status
      fetchDevices();
    };
    
    window.addEventListener('refreshTVStatus', handleRefresh);
    window.addEventListener('directDeviceUpdate', handleDirectDeviceUpdate);
    window.addEventListener('sessionExpired', handleExpiredSession);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshTVStatus', handleRefresh);
      window.removeEventListener('directDeviceUpdate', handleDirectDeviceUpdate);
      window.removeEventListener('sessionExpired', handleExpiredSession);
    };
  }, [alarmAudio]);

  const fetchDevices = async () => {
    try {
      console.log('🔄 Fetching devices from API...');
      const response = await axios.get('/tv/devices');
      if (response.data.success) {
        console.log('📱 Received device data:', response.data.data);
        setDevices(response.data.data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      toast.error('Failed to load TV devices');
      setLoading(false);
    }
  };

  const fetchPackages = async () => {
    try {
      const response = await axios.get('/packages');
      if (response.data.success) {
        setPackages(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch packages:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get('/pos/products');
      if (response.data.success) {
        setProducts(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const handleStartSession = (device) => {
    setSessionDialog({ open: true, device });
    setSessionForm({ package_id: '' });
  };

  const handleStopSession = async (sessionId, deviceName) => {
    try {
      const response = await axios.post(`/tv/stop-session/${sessionId}`);
      if (response.data.success) {
        toast.success(`Session stopped for ${deviceName}`);
        fetchDevices();
        emitTVStatusUpdate(sessionId, 'stopped');
      }
    } catch (error) {
      toast.error('Failed to stop session');
    }
  };

  const handleSessionSubmit = async () => {
    try {
      const response = await axios.post('/tv/start-session', {
        device_id: sessionDialog.device.device_id,
        customer_name: sessionDialog.device.device_name, // Auto-use device name
        package_id: sessionForm.package_id,
      });

      if (response.data.success) {
        toast.success(`Session started for ${sessionDialog.device.device_name}`);
        setSessionDialog({ open: false, device: null });
        fetchDevices();
        emitTVStatusUpdate(sessionDialog.device.id, 'started');
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to start session';
      toast.error(message);
    }
  };

  const handleStopAlarm = (deviceId) => {
    setExpiredAlarms(prev => {
      const newSet = new Set(prev);
      newSet.delete(deviceId);
      return newSet;
    });
    toast.success('Alarm stopped');
  };

  const handleDeleteDevice = (device) => {
    if (device.session_id) {
      toast.error('Cannot delete device with active session. Please stop the session first.');
      return;
    }
    
    setDeleteDialog({ open: true, device });
  };

  const handleConfirmDelete = async () => {
    const device = deleteDialog.device;
    if (!device) return;

    try {
      const response = await axios.delete(`/tv/devices/${device.device_id}`);
      
      if (response.data.success) {
        toast.success(response.data.message);
        fetchDevices(); // Refresh device list
        setDeleteDialog({ open: false, device: null });
      } else {
        toast.error(response.data.message || 'Failed to delete device');
      }
    } catch (error) {
      console.error('Delete device error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete device');
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialog({ open: false, device: null });
  };

  const handleAddTime = (device) => {
    setAddTimeDialog({ open: true, device });
    setAddTimeForm({ additional_minutes: '', package_id: '' });
  };

  const handleAddTimeSubmit = async () => {
    const device = addTimeDialog.device;
    if (!device || !device.session_id) return;

    let additionalMinutes = 0;
    let amount = 0;

    if (addTimeForm.package_id) {
      // Adding time via package
      const selectedPackage = packages.find(p => p.id === parseInt(addTimeForm.package_id));
      if (!selectedPackage) {
        toast.error('Package not found');
        return;
      }
      additionalMinutes = selectedPackage.duration_minutes;
      amount = selectedPackage.price;
    } else if (addTimeForm.additional_minutes) {
      // Adding custom minutes
      additionalMinutes = parseInt(addTimeForm.additional_minutes);
      if (isNaN(additionalMinutes) || additionalMinutes <= 0) {
        toast.error('Please enter valid minutes');
        return;
      }
      // For custom minutes, calculate price based on existing package rate or default rate
      const basePrice = packages.length > 0 ? packages[0].price : 1000; // Default 1000 per hour
      const baseMinutes = packages.length > 0 ? packages[0].duration_minutes : 60;
      amount = (additionalMinutes / baseMinutes) * basePrice;
    } else {
      toast.error('Please select a package or enter custom minutes');
      return;
    }

    try {
      const response = await axios.post(`/tv/add-time/${device.session_id}`, {
        additional_minutes: additionalMinutes,
        additional_amount: amount
      });

      if (response.data.success) {
        toast.success(`Added ${additionalMinutes} minutes to ${device.device_name}`);
        fetchDevices(); // Refresh device list
        setAddTimeDialog({ open: false, device: null });
        setAddTimeForm({ additional_minutes: '', package_id: '' });
      } else {
        toast.error(response.data.message || 'Failed to add time');
      }
    } catch (error) {
      console.error('Add time error:', error);
      toast.error(error.response?.data?.message || 'Failed to add time');
    }
  };

  const handleCancelAddTime = () => {
    setAddTimeDialog({ open: false, device: null });
    setAddTimeForm({ additional_minutes: '', package_id: '' });
  };

  const handleConfirmPayment = (device) => {
    setPaymentDialog({ open: true, device });
    setPaymentForm({ payment_notes: '' });
  };

  const handlePaymentSubmit = async () => {
    const device = paymentDialog.device;
    if (!device || !device.session_id) return;

    try {
      const response = await axios.post(`/tv/confirm-payment/${device.session_id}`, {
        payment_notes: paymentForm.payment_notes
      });

      if (response.data.success) {
        toast.success(`💰 Payment confirmed for ${device.device_name}`);
        fetchDevices(); // Refresh device list
        setPaymentDialog({ open: false, device: null });
        setPaymentForm({ payment_notes: '' });
      } else {
        toast.error(response.data.message || 'Failed to confirm payment');
      }
    } catch (error) {
      console.error('Confirm payment error:', error);
      toast.error(error.response?.data?.message || 'Failed to confirm payment');
    }
  };

  const handleCancelPayment = () => {
    setPaymentDialog({ open: false, device: null });
    setPaymentForm({ payment_notes: '' });
  };

  const handleOrderFood = (device) => {
    setOrderDialog({ open: true, device });
    setOrderForm({ items: [], notes: '' });
    fetchProducts(); // Load products when opening dialog
  };

  const handleAddOrderItem = (product) => {
    const existingItem = orderForm.items.find(item => item.product_id === product.id);
    
    if (existingItem) {
      // Increase quantity
      setOrderForm(prev => ({
        ...prev,
        items: prev.items.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * parseFloat(item.price) }
            : item
        )
      }));
    } else {
      // Add new item
      setOrderForm(prev => ({
        ...prev,
        items: [...prev.items, {
          product_id: product.id,
          product_name: product.name,
          price: parseFloat(product.price),
          quantity: 1,
          subtotal: parseFloat(product.price)
        }]
      }));
    }
  };

  const handleRemoveOrderItem = (productId) => {
    setOrderForm(prev => ({
      ...prev,
      items: prev.items.filter(item => item.product_id !== productId)
    }));
  };

  const handleOrderSubmit = async () => {
    const device = orderDialog.device;
    if (!device || !device.session_id || orderForm.items.length === 0) {
      toast.error('Please add items to order');
      return;
    }

    try {
      const response = await axios.post(`/tv/session-order/${device.session_id}`, {
        order_items: orderForm.items,
        order_notes: orderForm.notes
      });

      if (response.data.success) {
        toast.success(`🍽️ Order placed - ${formatCurrency(response.data.data.total_amount)}`);
        fetchDevices(); // Refresh device list
        setOrderDialog({ open: false, device: null });
        setOrderForm({ items: [], notes: '' });
      } else {
        toast.error(response.data.message || 'Failed to place order');
      }
    } catch (error) {
      console.error('Place order error:', error);
      toast.error(error.response?.data?.message || 'Failed to place order');
    }
  };

  const handleCancelOrder = () => {
    setOrderDialog({ open: false, device: null });
    setOrderForm({ items: [], notes: '' });
  };

  const handlePauseSession = (device) => {
    setPauseDialog({ open: true, device });
    setPauseForm({ pause_reason: 'other', pause_notes: '' });
  };

  const handlePauseSubmit = async () => {
    const device = pauseDialog.device;
    if (!device || !device.session_id) return;

    try {
      const response = await axios.post(`/tv/pause-session/${device.session_id}`, {
        pause_reason: pauseForm.pause_reason,
        pause_notes: pauseForm.pause_notes
      });

      if (response.data.success) {
        toast.success(`⏸️ Session paused for ${device.device_name}`);
        fetchDevices(); // Refresh device list
        setPauseDialog({ open: false, device: null });
        setPauseForm({ pause_reason: 'other', pause_notes: '' });
      } else {
        toast.error(response.data.message || 'Failed to pause session');
      }
    } catch (error) {
      console.error('Pause session error:', error);
      toast.error(error.response?.data?.message || 'Failed to pause session');
    }
  };

  const handleCancelPause = () => {
    setPauseDialog({ open: false, device: null });
    setPauseForm({ pause_reason: 'other', pause_notes: '' });
  };

  const handleResumeSession = async (device) => {
    if (!device || !device.session_id) return;

    try {
      const response = await axios.post(`/tv/resume-session/${device.session_id}`, {
        resume_notes: `Resumed by operator`
      });

      if (response.data.success) {
        toast.success(`▶️ Session resumed for ${device.device_name} (was paused ${response.data.data.pause_duration || 0}min)`);
        fetchDevices(); // Refresh device list
      } else {
        toast.error(response.data.message || 'Failed to resume session');
      }
    } catch (error) {
      console.error('Resume session error:', error);
      toast.error(error.response?.data?.message || 'Failed to resume session');
    }
  };

  const getDeviceStatus = (device) => {
    const hasAlarm = expiredAlarms.has(device.id);
    
    if (device.session_id) {
      // Check session status first
      if (device.session_status === 'pending_payment') {
        return {
          status: 'pending_payment',
          color: 'warning',
          label: 'Pending Payment',
          hasAlarm: false
        };
      }
      
      // Check if session is paused
      if (device.paused_at) {
        return {
          status: 'paused',
          color: 'info',
          label: 'Paused',
          hasAlarm: false
        };
      }
      
      const remainingMinutes = device.remaining_minutes != null ? device.remaining_minutes : 0;
      if (remainingMinutes <= 0 || hasAlarm) {
        return { 
          status: 'expired', 
          color: 'error', 
          label: 'Expired',
          hasAlarm: hasAlarm
        };
      } else if (remainingMinutes <= 5) {
        return { 
          status: 'warning', 
          color: 'warning', 
          label: `${Math.ceil(remainingMinutes)}min left`,
          hasAlarm: false
        };
      } else {
        return { 
          status: 'active', 
          color: 'success', 
          label: 'Active',
          hasAlarm: false
        };
      }
    } else if (device.status === 'online') {
      return { 
        status: 'available', 
        color: 'info', 
        label: 'Available',
        hasAlarm: false
      };
    } else {
      return { 
        status: 'offline', 
        color: 'default', 
        label: 'Offline',
        hasAlarm: false
      };
    }
  };

  const formatTime = (minutes) => {
    if (minutes == null || isNaN(minutes) || minutes < 0) {
      return '0m';
    }
    const totalMinutes = Math.floor(minutes);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <div>
          <Typography variant="h4" gutterBottom>
            TV Management
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Monitor and control all TV devices
          </Typography>
        </div>
        <Box>
          <Tooltip title="Force Refresh (Debug)">
            <IconButton 
              onClick={() => {
                console.log('🔄 Manual refresh clicked');
                fetchDevices();
              }} 
              color="primary"
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {devices.filter(d => d.session_id).length}
              </Typography>
              <Typography color="textSecondary">Active Sessions</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {devices.filter(d => d.status === 'online' && !d.session_id).length}
              </Typography>
              <Typography color="textSecondary">Available</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="error">
                {devices.filter(d => d.status === 'offline').length}
              </Typography>
              <Typography color="textSecondary">Offline</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4">
                {devices.length}
              </Typography>
              <Typography color="textSecondary">Total Devices</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* TV Devices Grid */}
      <Grid container spacing={3}>
        {devices.map((device) => {
          const deviceStatus = getDeviceStatus(device);
          
          return (
            <Grid item xs={12} sm={6} md={4} key={device.id}>
              <Card 
                sx={{ 
                  position: 'relative',
                  border: deviceStatus.hasAlarm ? '3px solid' : (device.session_id ? '2px solid' : '1px solid'),
                  borderColor: deviceStatus.hasAlarm ? 'error.main' : (
                    deviceStatus.status === 'expired' ? 'error.main' :
                    deviceStatus.status === 'warning' ? 'warning.main' :
                    deviceStatus.status === 'active' ? 'success.main' : 'divider'
                  ),
                  boxShadow: deviceStatus.hasAlarm ? '0 0 20px rgba(244, 67, 54, 0.3)' : 'inherit',
                  animation: deviceStatus.hasAlarm ? 'pulse 2s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { boxShadow: '0 0 20px rgba(244, 67, 54, 0.3)' },
                    '50%': { boxShadow: '0 0 30px rgba(244, 67, 54, 0.6)' },
                    '100%': { boxShadow: '0 0 20px rgba(244, 67, 54, 0.3)' }
                  }
                }}
              >
                <CardContent>
                  {/* Status Badge and Alarm */}
                  <Box position="absolute" top={8} right={8} display="flex" gap={1}>
                    {deviceStatus.hasAlarm && (
                      <Tooltip title="Session Expired - Click to stop alarm">
                        <Chip
                          size="small"
                          label="🚨 ALARM"
                          color="error"
                          onClick={() => handleStopAlarm(device.id)}
                          sx={{ cursor: 'pointer', animation: 'blink 1s infinite' }}
                        />
                      </Tooltip>
                    )}
                    <Chip
                      size="small"
                      label={deviceStatus.label}
                      color={deviceStatus.color}
                    />
                  </Box>

                  {/* Device Info */}
                  <Box display="flex" alignItems="center" mb={2}>
                    <ComputerIcon sx={{ mr: 1, fontSize: 32 }} />
                    <div>
                      <Typography variant="h6">
                        {device.device_name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {device.device_location || 'No location set'}
                      </Typography>
                    </div>
                  </Box>

                  {/* Session Info */}
                  {device.session_id ? (
                    <Box mb={2}>
                      <Box display="flex" alignItems="center" mb={1}>
                        <PersonIcon sx={{ mr: 1, fontSize: 16 }} />
                        <Typography variant="body2">
                          {device.customer_name || 'Session Active'}
                        </Typography>
                      </Box>
                      
                      {device.session_status === 'pending_payment' ? (
                        <>
                          <Box display="flex" alignItems="center" mb={1}>
                            <MoneyIcon sx={{ mr: 1, fontSize: 16, color: 'warning.main' }} />
                            <Typography variant="body2" color="warning.main">
                              Session: {formatCurrency(device.amount_paid)}
                            </Typography>
                          </Box>
                          {parseFloat(device.fb_total_amount || 0) > 0 && (
                            <Box display="flex" alignItems="center" mb={1}>
                              <RestaurantIcon sx={{ mr: 1, fontSize: 16, color: 'warning.main' }} />
                              <Typography variant="body2" color="warning.main">
                                F&B: {formatCurrency(device.fb_total_amount)} ({device.fb_order_count} orders)
                              </Typography>
                            </Box>
                          )}
                          <Box display="flex" alignItems="center" mb={1}>
                            <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                              Total: {formatCurrency(parseFloat(device.amount_paid || 0) + parseFloat(device.fb_total_amount || 0))}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" mb={1}>
                            <TimeIcon sx={{ mr: 1, fontSize: 16 }} />
                            <Typography variant="body2" color="textSecondary">
                              Duration: {formatTime(device.duration_minutes)}
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="textSecondary">
                            Ended: {new Date(device.end_time).toLocaleTimeString()}
                          </Typography>
                        </>
                      ) : (
                        <>
                          {device.paused_at ? (
                            <>
                              <Box display="flex" alignItems="center" mb={1}>
                                <PauseIcon sx={{ mr: 1, fontSize: 16, color: 'info.main' }} />
                                <Typography variant="body2" color="info.main">
                                  Session Paused - {formatTime(device.remaining_minutes)} remaining
                                </Typography>
                              </Box>
                              <Box display="flex" alignItems="center" mb={1}>
                                <Typography variant="body2" color="textSecondary">
                                  Reason: {device.pause_reason?.replace('_', ' ') || 'Other'}
                                </Typography>
                              </Box>
                              <Typography variant="body2" color="textSecondary">
                                Paused: {new Date(device.paused_at).toLocaleTimeString()} by {device.paused_by_name || 'System'}
                              </Typography>
                            </>
                          ) : (
                            <Box display="flex" alignItems="center" mb={1}>
                              <TimeIcon sx={{ mr: 1, fontSize: 16 }} />
                              <Typography 
                                variant="body2" 
                                color={device.remaining_minutes <= 5 ? 'error' : 'textPrimary'}
                              >
                                {formatTime(device.remaining_minutes)} remaining
                              </Typography>
                            </Box>
                          )}
                          <Box display="flex" alignItems="center" mb={1}>
                            <MoneyIcon sx={{ mr: 1, fontSize: 16 }} />
                            <Typography variant="body2" color="textSecondary">
                              Session: {formatCurrency(device.amount_paid)}
                            </Typography>
                          </Box>
                          {parseFloat(device.fb_total_amount || 0) > 0 && (
                            <Box display="flex" alignItems="center" mb={1}>
                              <RestaurantIcon sx={{ mr: 1, fontSize: 16 }} />
                              <Typography variant="body2" color="textSecondary">
                                F&B: {formatCurrency(device.fb_total_amount)} ({device.fb_order_count} orders)
                              </Typography>
                            </Box>
                          )}
                          <Typography variant="body2" color="textSecondary">
                            Started: {new Date(device.start_time).toLocaleTimeString()}
                          </Typography>
                        </>
                      )}
                    </Box>
                  ) : (
                    <Box mb={2}>
                      <Typography variant="body2" color="textSecondary">
                        No active session
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        IP: {device.ip_address || 'Not set'}
                      </Typography>
                    </Box>
                  )}

                  {/* Action Buttons */}
                  <Box display="flex" gap={1}>
                    {device.session_id ? (
                      <Box display="flex" gap={1} width="100%">
                        {device.session_status === 'pending_payment' ? (
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            startIcon={<PaymentIcon />}
                            onClick={() => handleConfirmPayment(device)}
                            sx={{ flexGrow: 1 }}
                          >
                            Confirm Payment
                          </Button>
                        ) : device.paused_at ? (
                          // Paused session buttons
                          <>
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              startIcon={<ResumeIcon />}
                              onClick={() => handleResumeSession(device)}
                              sx={{ flexGrow: 1 }}
                            >
                              Resume Session
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              startIcon={<StopIcon />}
                              onClick={() => handleStopSession(device.session_id, device.device_name)}
                            >
                              Stop
                            </Button>
                          </>
                        ) : (
                          // Active session buttons
                          <>
                            <Button
                              variant="contained"
                              color="error"
                              size="small"
                              startIcon={<StopIcon />}
                              onClick={() => handleStopSession(device.session_id, device.device_name)}
                              sx={{ flexGrow: 1 }}
                            >
                              Stop Session
                            </Button>
                            <Tooltip title="Pause Session">
                              <IconButton 
                                color="info" 
                                size="small"
                                onClick={() => handlePauseSession(device)}
                              >
                                <PauseIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Add Time">
                              <IconButton 
                                color="primary" 
                                size="small"
                                onClick={() => handleAddTime(device)}
                              >
                                <AddIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Order Food & Beverage">
                              <IconButton 
                                color="secondary" 
                                size="small"
                                onClick={() => handleOrderFood(device)}
                              >
                                <RestaurantIcon />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    ) : (
                      <Box display="flex" gap={1} width="100%">
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          startIcon={<StartIcon />}
                          onClick={() => handleStartSession(device)}
                          disabled={device.status !== 'online'}
                          sx={{ flexGrow: 1 }}
                        >
                          Start Session
                        </Button>
                        <Tooltip title="Delete Device">
                          <IconButton 
                            color="error" 
                            size="small"
                            onClick={() => handleDeleteDevice(device)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Start Session Dialog */}
      <Dialog 
        open={sessionDialog.open} 
        onClose={() => setSessionDialog({ open: false, device: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Start Session - {sessionDialog.device?.device_name}
        </DialogTitle>
        <DialogContent>
          <TextField
            select
            margin="dense"
            label="Billing Package"
            fullWidth
            variant="outlined"
            value={sessionForm.package_id}
            onChange={(e) => setSessionForm({ ...sessionForm, package_id: e.target.value })}
          >
            {packages.map((pkg) => (
              <MenuItem key={pkg.id} value={pkg.id}>
                {pkg.name} - {formatTime(pkg.duration_minutes)} - {formatCurrency(pkg.price)}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSessionDialog({ open: false, device: null })}>
            Cancel
          </Button>
          <Button 
            onClick={handleSessionSubmit}
            variant="contained"
            disabled={!sessionForm.package_id}
          >
            Start Session
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialog.open} 
        onClose={handleCancelDelete}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{ 
          color: 'error.main',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <DeleteIcon />
          Confirm Delete Device
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete the following device?
          </Typography>
          <Box sx={{ 
            p: 2, 
            bgcolor: 'grey.100', 
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'grey.300'
          }}>
            <Typography variant="h6" color="error.main">
              {deleteDialog.device?.device_name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              ID: {deleteDialog.device?.device_id}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Location: {deleteDialog.device?.device_location || deleteDialog.device?.location || 'No location set'}
            </Typography>
          </Box>
          <Typography variant="body2" color="error.main" sx={{ mt: 2, fontWeight: 'bold' }}>
            ⚠️ This action cannot be undone. All associated session history will also be deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleCancelDelete}
            variant="outlined"
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
          >
            Delete Device
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Time Dialog */}
      <Dialog 
        open={addTimeDialog.open} 
        onClose={handleCancelAddTime}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{ 
          color: 'primary.main',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <AddIcon />
          Add Time - {addTimeDialog.device?.device_name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Add additional time to the current session
          </Typography>
          
          {/* Current Session Info */}
          <Box sx={{ 
            p: 2, 
            bgcolor: 'primary.50', 
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'primary.200',
            mb: 3
          }}>
            <Typography variant="body2" color="textSecondary">
              Current Session: {addTimeDialog.device?.customer_name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Time Remaining: {formatTime(addTimeDialog.device?.remaining_minutes)}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Started: {addTimeDialog.device?.start_time ? new Date(addTimeDialog.device.start_time).toLocaleTimeString() : 'N/A'}
            </Typography>
          </Box>

          {/* Package Selection */}
          <TextField
            select
            margin="dense"
            label="Add Time Package (Optional)"
            fullWidth
            variant="outlined"
            value={addTimeForm.package_id}
            onChange={(e) => setAddTimeForm({ ...addTimeForm, package_id: e.target.value, additional_minutes: '' })}
            sx={{ mb: 2 }}
          >
            <MenuItem value="">
              <em>Select a package to add</em>
            </MenuItem>
            {packages.map((pkg) => (
              <MenuItem key={pkg.id} value={pkg.id}>
                {pkg.name} - {formatTime(pkg.duration_minutes)} - {formatCurrency(pkg.price)}
              </MenuItem>
            ))}
          </TextField>

          <Typography variant="body2" sx={{ mb: 2, textAlign: 'center', color: 'textSecondary' }}>
            OR
          </Typography>

          {/* Custom Minutes Input */}
          <TextField
            type="number"
            margin="dense"
            label="Custom Minutes"
            fullWidth
            variant="outlined"
            value={addTimeForm.additional_minutes}
            onChange={(e) => setAddTimeForm({ ...addTimeForm, additional_minutes: e.target.value, package_id: '' })}
            disabled={!!addTimeForm.package_id}
            helperText={
              addTimeForm.additional_minutes && !addTimeForm.package_id 
                ? `Estimated cost: ${formatCurrency((parseInt(addTimeForm.additional_minutes) || 0) / 60 * (packages[0]?.price || 1000))}`
                : 'Enter custom minutes to add'
            }
            inputProps={{ min: 1, max: 480 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleCancelAddTime}
            variant="outlined"
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAddTimeSubmit}
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            disabled={!addTimeForm.package_id && !addTimeForm.additional_minutes}
          >
            Add Time
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pause Session Dialog */}
      <Dialog 
        open={pauseDialog.open} 
        onClose={handleCancelPause}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{ 
          color: 'info.main',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <PauseIcon />
          Pause Session - {pauseDialog.device?.device_name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Pause the billing session for {pauseDialog.device?.customer_name}
          </Typography>
          
          {/* Current Session Info */}
          <Box sx={{ 
            p: 2, 
            bgcolor: 'info.50', 
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'info.200',
            mb: 3
          }}>
            <Typography variant="h6" color="info.main" sx={{ mb: 1 }}>
              Session Details
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Customer: {pauseDialog.device?.customer_name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Time Remaining: {formatTime(pauseDialog.device?.remaining_minutes)}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Started: {pauseDialog.device?.start_time ? new Date(pauseDialog.device.start_time).toLocaleTimeString() : 'N/A'}
            </Typography>
          </Box>

          {/* Pause Reason */}
          <TextField
            select
            margin="dense"
            label="Pause Reason"
            fullWidth
            variant="outlined"
            value={pauseForm.pause_reason}
            onChange={(e) => setPauseForm({ ...pauseForm, pause_reason: e.target.value })}
            sx={{ mb: 2 }}
          >
            <MenuItem value="prayer_time">Prayer Time / Ibadah</MenuItem>
            <MenuItem value="power_outage">Power Outage / Mati Lampu</MenuItem>
            <MenuItem value="customer_request">Customer Request</MenuItem>
            <MenuItem value="technical_issue">Technical Issue</MenuItem>
            <MenuItem value="maintenance">Maintenance</MenuItem>
            <MenuItem value="emergency">Emergency</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </TextField>

          {/* Pause Notes */}
          <TextField
            margin="dense"
            label="Notes (Optional)"
            fullWidth
            variant="outlined"
            value={pauseForm.pause_notes}
            onChange={(e) => setPauseForm({ ...pauseForm, pause_notes: e.target.value })}
            placeholder="Additional details about the pause..."
            multiline
            rows={3}
            helperText="Timer will be paused - customer won't be charged for paused time"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleCancelPause}
            variant="outlined"
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            onClick={handlePauseSubmit}
            variant="contained"
            color="info"
            startIcon={<PauseIcon />}
          >
            Pause Session
          </Button>
        </DialogActions>
      </Dialog>

      {/* F&B Order Dialog */}
      <Dialog 
        open={orderDialog.open} 
        onClose={handleCancelOrder}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ 
          color: 'secondary.main',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <RestaurantIcon />
          Order Food & Beverage - {orderDialog.device?.device_name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Add food and beverage orders for {orderDialog.device?.customer_name}
          </Typography>
          
          {/* Current Order Summary */}
          {orderForm.items.length > 0 && (
            <Box sx={{ 
              p: 2, 
              bgcolor: 'secondary.50', 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'secondary.200',
              mb: 3
            }}>
              <Typography variant="h6" color="secondary.main" sx={{ mb: 1 }}>
                Current Order
              </Typography>
              {orderForm.items.map((item, index) => (
                <Box key={index} display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="body2">
                    {item.quantity}x {item.product_name}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2">
                      {formatCurrency(item.subtotal)}
                    </Typography>
                    <IconButton size="small" color="error" onClick={() => handleRemoveOrderItem(item.product_id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ))}
              <Box display="flex" justifyContent="space-between" sx={{ mt: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  Total:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {(() => {
                    const total = orderForm.items.reduce((total, item) => {
                      console.log('Debug item:', item);
                      return total + (parseFloat(item.subtotal) || 0);
                    }, 0);
                    console.log('Debug total:', total);
                    return formatCurrency(total);
                  })()}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Product Categories */}
          <Typography variant="h6" sx={{ mb: 2 }}>
            Available Products
          </Typography>
          
          {/* Group products by category */}
          {Object.entries(
            products.reduce((groups, product) => {
              const category = product.category || 'Other';
              if (!groups[category]) groups[category] = [];
              groups[category].push(product);
              return groups;
            }, {})
          ).map(([category, categoryProducts]) => (
            <Box key={category} sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: 'primary.main' }}>
                {category}
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {categoryProducts.map((product) => (
                  <Button
                    key={product.id}
                    variant="outlined"
                    size="small"
                    onClick={() => handleAddOrderItem(product)}
                    sx={{ 
                      minWidth: 'auto',
                      flexDirection: 'column',
                      p: 1,
                      textAlign: 'center'
                    }}
                  >
                    <Typography variant="caption" noWrap sx={{ maxWidth: 100 }}>
                      {product.name}
                    </Typography>
                    <Typography variant="caption" color="primary">
                      {formatCurrency(product.price)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Stock: {product.stock_quantity || 'N/A'}
                    </Typography>
                  </Button>
                ))}
              </Box>
            </Box>
          ))}

          {/* Order Notes */}
          <TextField
            margin="dense"
            label="Order Notes (Optional)"
            fullWidth
            variant="outlined"
            value={orderForm.notes}
            onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
            placeholder="Special instructions, allergies, etc."
            multiline
            rows={2}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleCancelOrder}
            variant="outlined"
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleOrderSubmit}
            variant="contained"
            color="secondary"
            startIcon={<CartIcon />}
            disabled={orderForm.items.length === 0}
          >
            Place Order ({formatCurrency(orderForm.items.reduce((total, item) => total + (parseFloat(item.subtotal) || 0), 0))})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Confirmation Dialog */}
      <Dialog 
        open={paymentDialog.open} 
        onClose={handleCancelPayment}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{ 
          color: 'success.main',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <PaymentIcon />
          Confirm Payment - {paymentDialog.device?.device_name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Confirm that payment has been received for this session
          </Typography>
          
          {/* Session Payment Details */}
          <Box sx={{ 
            p: 2, 
            bgcolor: 'success.50', 
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'success.200',
            mb: 3
          }}>
            <Typography variant="h6" color="success.main" sx={{ mb: 1 }}>
              Payment Details
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Customer: {paymentDialog.device?.customer_name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Package: {paymentDialog.device?.package_name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Duration: {formatTime(paymentDialog.device?.duration_minutes)}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Session: {formatCurrency(paymentDialog.device?.amount_paid)}
            </Typography>
            {parseFloat(paymentDialog.device?.fb_total_amount || 0) > 0 && (
              <Typography variant="body2" color="textSecondary">
                F&B Orders: {formatCurrency(paymentDialog.device?.fb_total_amount)} ({paymentDialog.device?.fb_order_count} orders)
              </Typography>
            )}
            <Typography variant="body1" sx={{ mt: 1, fontWeight: 'bold', color: 'success.main' }}>
              Total Amount: {formatCurrency(parseFloat(paymentDialog.device?.amount_paid || 0) + parseFloat(paymentDialog.device?.fb_total_amount || 0))}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Session ended: {paymentDialog.device?.end_time ? new Date(paymentDialog.device.end_time).toLocaleString() : 'N/A'}
            </Typography>
          </Box>

          {/* Payment Notes */}
          <TextField
            margin="dense"
            label="Payment Notes (Optional)"
            fullWidth
            variant="outlined"
            value={paymentForm.payment_notes}
            onChange={(e) => setPaymentForm({ ...paymentForm, payment_notes: e.target.value })}
            placeholder="e.g., Cash payment received, Change given: Rp 5,000"
            multiline
            rows={3}
            helperText="Add any notes about the payment (cash, change given, etc.)"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleCancelPayment}
            variant="outlined"
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            onClick={handlePaymentSubmit}
            variant="contained"
            color="success"
            startIcon={<PaymentIcon />}
          >
            Confirm Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}