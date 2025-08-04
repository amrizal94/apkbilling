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
  PowerSettingsNew as PowerIcon,
  Refresh as RefreshIcon,
  VolumeOff as AlarmOffIcon,
  Warning as WarningIcon,
  Delete as DeleteIcon,
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
  const [alarmAudio] = useState(() => {
    try {
      const audio = new Audio('/alarm.mp3');
      audio.onerror = () => {
        console.warn('Alarm audio file not found - alarm will work silently');
      };
      return audio;
    } catch (error) {
      console.warn('Failed to initialize alarm audio:', error);
      return null;
    }
  });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, device: null });
  const [addTimeDialog, setAddTimeDialog] = useState({ open: false, device: null });
  const [addTimeForm, setAddTimeForm] = useState({
    additional_minutes: '',
    package_id: ''
  });

  useEffect(() => {
    fetchDevices();
    fetchPackages();
    const interval = setInterval(fetchDevices, 10000); // Refresh every 10 seconds
    
    // Listen for real-time refresh events
    const handleRefresh = () => {
      console.log('🔄 Refreshing TV status due to real-time event');
      fetchDevices();
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
    window.addEventListener('sessionExpired', handleExpiredSession);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshTVStatus', handleRefresh);
      window.removeEventListener('sessionExpired', handleExpiredSession);
    };
  }, [alarmAudio]);

  const fetchDevices = async () => {
    try {
      const response = await axios.get('/tv/devices');
      if (response.data.success) {
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
      const response = await axios.get('/packages/active');
      if (response.data.success) {
        setPackages(response.data.packages);
      }
    } catch (error) {
      console.error('Failed to fetch packages:', error);
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
        device_id: sessionDialog.device.id,
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
      const response = await axios.delete(`/tv/devices/${device.id}`);
      
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
        amount_paid: amount
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

  const getDeviceStatus = (device) => {
    const hasAlarm = expiredAlarms.has(device.id);
    
    if (device.session_id) {
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
          <Tooltip title="Refresh">
            <IconButton onClick={fetchDevices} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ ml: 1 }}
          >
            Add Device
          </Button>
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
                          Session Active
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" mb={1}>
                        <TimeIcon sx={{ mr: 1, fontSize: 16 }} />
                        <Typography 
                          variant="body2" 
                          color={device.remaining_minutes <= 5 ? 'error' : 'textPrimary'}
                        >
                          {formatTime(device.remaining_minutes)} remaining
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        Started: {new Date(device.start_time).toLocaleTimeString()}
                      </Typography>
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
                        <Tooltip title="Add Time">
                          <IconButton 
                            color="primary" 
                            size="small"
                            onClick={() => handleAddTime(device)}
                          >
                            <AddIcon />
                          </IconButton>
                        </Tooltip>
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
                    <Tooltip title="Power Control">
                      <IconButton color="secondary" size="small">
                        <PowerIcon />
                      </IconButton>
                    </Tooltip>
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
    </Box>
  );
}