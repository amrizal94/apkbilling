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

  useEffect(() => {
    fetchDevices();
    fetchPackages();
    const interval = setInterval(fetchDevices, 10000); // Refresh every 10 seconds
    
    // Listen for real-time refresh events
    const handleRefresh = () => {
      console.log('🔄 Refreshing TV status due to real-time event');
      fetchDevices();
    };
    
    window.addEventListener('refreshTVStatus', handleRefresh);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshTVStatus', handleRefresh);
    };
  }, []);

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
      const response = await axios.get('/tv/packages');
      if (response.data.success) {
        setPackages(response.data.data);
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

  const getDeviceStatus = (device) => {
    if (device.session_id) {
      const remainingMinutes = device.remaining_minutes != null ? device.remaining_minutes : 0;
      if (remainingMinutes <= 0) {
        return { status: 'expired', color: 'error', label: 'Expired' };
      } else if (remainingMinutes <= 5) {
        return { status: 'warning', color: 'warning', label: 'Warning' };
      } else {
        return { status: 'active', color: 'success', label: 'Active' };
      }
    } else if (device.status === 'online') {
      return { status: 'available', color: 'info', label: 'Available' };
    } else {
      return { status: 'offline', color: 'default', label: 'Offline' };
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
                  border: device.session_id ? '2px solid' : '1px solid',
                  borderColor: device.session_id ? 'success.main' : 'divider',
                }}
              >
                <CardContent>
                  {/* Status Badge */}
                  <Box position="absolute" top={8} right={8}>
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
                      <>
                        <Button
                          variant="contained"
                          color="error"
                          size="small"
                          startIcon={<StopIcon />}
                          onClick={() => handleStopSession(device.session_id, device.device_name)}
                          fullWidth
                        >
                          Stop Session
                        </Button>
                        <Tooltip title="Add Time">
                          <IconButton color="primary" size="small">
                            <AddIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    ) : (
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        startIcon={<StartIcon />}
                        onClick={() => handleStartSession(device)}
                        disabled={device.status !== 'online'}
                        fullWidth
                      >
                        Start Session
                      </Button>
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
                {pkg.package_name} - {formatTime(pkg.duration_minutes)} - {formatCurrency(pkg.price)}
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
    </Box>
  );
}