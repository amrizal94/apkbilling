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
  Box,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  Check as ApproveIcon,
  Close as RejectIcon,
  QrCode as QrIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  CleaningServices as CleanupIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';

export default function DeviceDiscovery() {
  const { socket } = useSocket();
  const [discoveries, setDiscoveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approveDialog, setApproveDialog] = useState({ open: false, device: null });
  const [rejectDialog, setRejectDialog] = useState({ open: false, device: null });
  const [approveForm, setApproveForm] = useState({
    custom_name: '',
    location: '',
  });
  const [rejectForm, setRejectForm] = useState({
    reason: '',
  });
  const [cleanupStats, setCleanupStats] = useState(null);
  const [cleanupDialog, setCleanupDialog] = useState({ open: false, type: '' });

  useEffect(() => {
    fetchDiscoveries();
    fetchCleanupStats();
    
    // Listen for real-time device discovery notifications
    if (socket) {
      socket.on('device_discovered', (data) => {
        toast.success(`🔍 New device discovered: ${data.device_name}`);
        fetchDiscoveries();
      });
      
      socket.on('device_approved', (data) => {
        toast.success(`✅ Device approved: ${data.device_name}`);
        fetchDiscoveries();
      });

      socket.on('discoveries_cleaned', (data) => {
        toast(`🧹 Auto-cleanup: ${data.cleaned_count} disconnected devices removed`, {
          icon: 'ℹ️',
          style: {
            background: '#2196F3',
            color: '#FFF',
          },
        });
        fetchDiscoveries();
        fetchCleanupStats();
      });

      socket.on('scan_cleanup_completed', (data) => {
        const mode = data.aggressive_mode ? 'Quick' : 'Standard';
        toast.success(`🚀 ${mode} scan cleanup: ${data.total_cleaned} devices cleaned`);
        fetchDiscoveries();
        fetchCleanupStats();
      });

      socket.on('auto_cleanup_completed', (data) => {
        if (data.total_cleaned > 0) {
          toast(`🤖 Auto cleanup: ${data.total_cleaned} stale devices removed`, {
            icon: 'ℹ️',
            style: {
              background: '#2196F3',
              color: '#FFF',
            },
          });
          fetchDiscoveries();
          fetchCleanupStats();
        }
      });

      socket.on('aggressive_cleanup_completed', (data) => {
        if (data.cleaned_count > 0) {
          toast(`⚡ Quick cleanup: ${data.cleaned_count} devices removed`, {
            icon: '⚡',
            style: {
              background: '#FF5722',
              color: '#FFF',
            },
          });
          fetchDiscoveries();
          fetchCleanupStats();
        }
      });
    }
    
    return () => {
      if (socket) {
        socket.off('device_discovered');
        socket.off('device_approved');
        socket.off('discoveries_cleaned');
        socket.off('scan_cleanup_completed');
        socket.off('auto_cleanup_completed');
        socket.off('aggressive_cleanup_completed');
      }
    };
  }, [socket]);

  const fetchDiscoveries = async () => {
    try {
      const response = await axios.get('/tv/discoveries');
      if (response.data.success) {
        setDiscoveries(response.data.data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch discoveries:', error);
      toast.error('Failed to load device discoveries');
      setLoading(false);
    }
  };

  const fetchCleanupStats = async () => {
    try {
      const response = await axios.get('/tv/cleanup-stats');
      if (response.data.success) {
        setCleanupStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch cleanup stats:', error);
    }
  };

  const handleApprove = (device) => {
    setApproveDialog({ open: true, device });
    setApproveForm({
      custom_name: device.device_name,
      location: device.location || '',
    });
  };

  const handleReject = (device) => {
    setRejectDialog({ open: true, device });
    setRejectForm({ reason: '' });
  };

  const submitApproval = async () => {
    try {
      const response = await axios.post(`/tv/approve-device/${approveDialog.device.id}`, {
        custom_name: approveForm.custom_name,
        location: approveForm.location,
      });

      if (response.data.success) {
        toast.success(`Device "${approveForm.custom_name}" approved successfully!`);
        setApproveDialog({ open: false, device: null });
        fetchDiscoveries();
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to approve device';
      toast.error(message);
    }
  };

  const submitRejection = async () => {
    try {
      const response = await axios.post(`/tv/reject-device/${rejectDialog.device.id}`, {
        reason: rejectForm.reason,
      });

      if (response.data.success) {
        toast.success('Device discovery rejected');
        setRejectDialog({ open: false, device: null });
        fetchDiscoveries();
      }
    } catch (error) {
      toast.error('Failed to reject device');
    }
  };

  const handleCleanup = (type) => {
    setCleanupDialog({ open: true, type });
  };

  const submitCleanup = async () => {
    try {
      const response = await axios.post('/tv/cleanup-discoveries', {
        cleanup_type: cleanupDialog.type,
        hours_threshold: 24
      });

      if (response.data.success) {
        toast.success(`Cleanup completed: ${response.data.records_removed} records removed`);
        setCleanupDialog({ open: false, type: '' });
        fetchDiscoveries();
        fetchCleanupStats();
      }
    } catch (error) {
      toast.error('Failed to cleanup discoveries');
    }
  };

  const scheduleCleanup = async () => {
    try {
      const response = await axios.post('/tv/schedule-cleanup');
      if (response.data.success) {
        toast.success(`Auto cleanup completed: ${response.data.total_removed} records removed`);
        fetchDiscoveries();
        fetchCleanupStats();
      }
    } catch (error) {
      toast.error('Failed to run scheduled cleanup');
    }
  };

  const runScanCleanup = async (aggressive = false) => {
    try {
      const response = await axios.post('/tv/scan-cleanup', { aggressive });
      if (response.data.success) {
        toast.success(`Scan cleanup completed: ${response.data.total_cleaned} records removed`);
        fetchDiscoveries();
        fetchCleanupStats();
      }
    } catch (error) {
      toast.error('Failed to run scan cleanup');
    }
  };

  const cleanupDisconnected = async () => {
    try {
      const response = await axios.post('/tv/cleanup-disconnected', { timeout_minutes: 5 });
      if (response.data.success) {
        toast.success(`Disconnected cleanup: ${response.data.cleaned_count} devices removed`);
        fetchDiscoveries();
        fetchCleanupStats();
      }
    } catch (error) {
      toast.error('Failed to cleanup disconnected devices');
    }
  };

  const getStatusChip = (device) => {
    if (device.is_registered) {
      return <Chip label="Registered" color="success" size="small" />;
    } else if (device.approved_at) {
      return <Chip label="Approved" color="primary" size="small" />;
    } else if (device.rejected_at) {
      return <Chip label="Rejected" color="error" size="small" />;
    } else {
      return <Chip label="Pending" color="warning" size="small" />;
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const pendingDiscoveries = discoveries.filter(d => !d.approved_at && !d.rejected_at && !d.is_registered);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <div>
          <Typography variant="h4" gutterBottom>
            Device Discovery
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Manage Android TV device discovery and approval
          </Typography>
        </div>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchDiscoveries} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<QrIcon />}
            sx={{ ml: 1 }}
          >
            Generate QR Setup
          </Button>
          <Button
            variant="outlined"
            startIcon={<CleanupIcon />}
            color="warning"
            onClick={scheduleCleanup}
            sx={{ ml: 1 }}
          >
            Auto Cleanup
          </Button>
          <Button
            variant="outlined"
            startIcon={<DeleteIcon />}
            color="secondary"
            onClick={() => runScanCleanup(false)}
            sx={{ ml: 1 }}
          >
            Scan Cleanup
          </Button>
          <Button
            variant="contained"
            startIcon={<DeleteIcon />}
            color="error"
            onClick={() => runScanCleanup(true)}
            sx={{ ml: 1 }}
            size="small"
          >
            Quick Clean
          </Button>
        </Box>
      </Box>

      {/* Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {pendingDiscoveries.length}
              </Typography>
              <Typography color="textSecondary">Pending Approval</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {discoveries.filter(d => d.approved_at).length}
              </Typography>
              <Typography color="textSecondary">Approved</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {discoveries.filter(d => d.is_registered).length}
              </Typography>
              <Typography color="textSecondary">Registered</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="error">
                {discoveries.filter(d => d.rejected_at).length}
              </Typography>
              <Typography color="textSecondary">Rejected</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Cleanup Statistics */}
      {cleanupStats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Cleanup Management</Typography>
                  <Box>
                    <Button
                      size="small"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleCleanup('auto')}
                      disabled={cleanupStats.stale_pending === 0}
                      sx={{ mr: 1 }}
                    >
                      Clean Stale ({cleanupStats.stale_pending})
                    </Button>
                    <Button
                      size="small"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleCleanup('rejected')}
                      disabled={cleanupStats.old_rejected === 0}
                      sx={{ mr: 1 }}
                    >
                      Clean Rejected ({cleanupStats.old_rejected})
                    </Button>
                    <Button
                      size="small"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleCleanup('approved')}
                      disabled={cleanupStats.old_approved_registered === 0}
                      sx={{ mr: 1 }}
                    >
                      Clean Registered ({cleanupStats.old_approved_registered})
                    </Button>
                    <Button
                      size="small"
                      startIcon={<CleanupIcon />}
                      onClick={cleanupDisconnected}
                      color="warning"
                    >
                      Clean Disconnected (5min)
                    </Button>
                  </Box>
                </Box>
                <Typography variant="body2" color="textSecondary">
                  • Stale Pending: Devices not seen for 24+ hours and not approved/rejected
                  <br />
                  • Old Rejected: Rejected discoveries older than 7 days
                  <br />
                  • Old Registered: Approved discoveries that are already registered (1+ day old)
                  <br />
                  • Clean Disconnected: Removes pending devices not seen for 5+ minutes
                  <br />
                  • Scan Cleanup: Standard (10min) or Quick (2min) cleanup with duplicate removal
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Pending Approvals Alert */}
      {pendingDiscoveries.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You have {pendingDiscoveries.length} device(s) waiting for approval
        </Alert>
      )}

      {/* Discoveries Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Discovered Devices
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Device Name</TableCell>
                  <TableCell>Device ID</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Last Seen</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {discoveries.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {device.device_name}
                      </Typography>
                      {device.screen_resolution && (
                        <Typography variant="caption" color="textSecondary">
                          {device.screen_resolution}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {device.device_id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {device.location || 'Not specified'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {device.device_type || 'Android TV'}
                      </Typography>
                      {device.os_version && (
                        <Typography variant="caption" color="textSecondary">
                          Android {device.os_version}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{device.ip_address}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatTime(device.last_seen)}
                      </Typography>
                    </TableCell>
                    <TableCell>{getStatusChip(device)}</TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        {!device.approved_at && !device.rejected_at && !device.is_registered && (
                          <>
                            <Tooltip title="Approve Device">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleApprove(device)}
                              >
                                <ApproveIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject Device">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleReject(device)}
                              >
                                <RejectIcon />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        <Tooltip title="View Details">
                          <IconButton size="small" color="primary">
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Approve Device Dialog */}
      <Dialog
        open={approveDialog.open}
        onClose={() => setApproveDialog({ open: false, device: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Approve Device - {approveDialog.device?.device_name}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Device Name"
            fullWidth
            variant="outlined"
            value={approveForm.custom_name}
            onChange={(e) => setApproveForm({ ...approveForm, custom_name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Location"
            fullWidth
            variant="outlined"
            value={approveForm.location}
            onChange={(e) => setApproveForm({ ...approveForm, location: e.target.value })}
            placeholder="e.g., Lantai 1 - Area Gaming"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialog({ open: false, device: null })}>
            Cancel
          </Button>
          <Button
            onClick={submitApproval}
            variant="contained"
            color="success"
            disabled={!approveForm.custom_name}
          >
            Approve Device
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Device Dialog */}
      <Dialog
        open={rejectDialog.open}
        onClose={() => setRejectDialog({ open: false, device: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Reject Device - {rejectDialog.device?.device_name}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Rejection Reason"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={rejectForm.reason}
            onChange={(e) => setRejectForm({ ...rejectForm, reason: e.target.value })}
            placeholder="Please provide a reason for rejection..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog({ open: false, device: null })}>
            Cancel
          </Button>
          <Button
            onClick={submitRejection}
            variant="contained"
            color="error"
            disabled={!rejectForm.reason}
          >
            Reject Device
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cleanup Confirmation Dialog */}
      <Dialog
        open={cleanupDialog.open}
        onClose={() => setCleanupDialog({ open: false, type: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Confirm Cleanup - {cleanupDialog.type === 'auto' ? 'Stale Pending' : 
                           cleanupDialog.type === 'rejected' ? 'Old Rejected' : 'Old Registered'} Discoveries
        </DialogTitle>
        <DialogContent>
          <Typography>
            {cleanupDialog.type === 'auto' && 
              'This will remove device discoveries that have not been seen for 24+ hours and are not approved or rejected.'}
            {cleanupDialog.type === 'rejected' && 
              'This will remove rejected device discoveries that are older than 7 days.'}
            {cleanupDialog.type === 'approved' && 
              'This will remove approved device discoveries that are already registered and older than 1 day.'}
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. Are you sure you want to proceed?
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCleanupDialog({ open: false, type: '' })}>
            Cancel
          </Button>
          <Button
            onClick={submitCleanup}
            variant="contained"
            color="warning"
            startIcon={<DeleteIcon />}
          >
            Confirm Cleanup
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}