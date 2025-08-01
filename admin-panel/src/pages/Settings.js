import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from 'axios';
import toast from 'react-hot-toast';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Settings() {
  const [tabValue, setTabValue] = useState(0);
  const [settings, setSettings] = useState({});
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchSystemInfo();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get('/settings');
      if (response.data.success) {
        setSettings(response.data.data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load settings');
      setLoading(false);
    }
  };

  const fetchSystemInfo = async () => {
    try {
      const response = await axios.get('/settings/system/info');
      if (response.data.success) {
        setSystemInfo(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch system info:', error);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings({
      ...settings,
      [key]: value,
    });
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await axios.put('/settings', settings);
      if (response.data.success) {
        toast.success('Settings saved successfully');
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to save settings';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
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
            Settings
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Configure your APK Billing system
          </Typography>
        </div>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchSettings}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={saveSettings}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>
      </Box>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Business Info" />
            <Tab label="System Config" />
            <Tab label="Network & WiFi" />
            <Tab label="System Info" />
          </Tabs>
        </Box>

        {/* Business Information */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Business Name"
                value={settings.cafe_name || ''}
                onChange={(e) => handleSettingChange('cafe_name', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Phone Number"
                value={settings.cafe_phone || ''}
                onChange={(e) => handleSettingChange('cafe_phone', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={settings.cafe_address || ''}
                onChange={(e) => handleSettingChange('cafe_address', e.target.value)}
                margin="normal"
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Currency Symbol"
                value={settings.currency_symbol || 'Rp'}
                onChange={(e) => handleSettingChange('currency_symbol', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Tax Rate (%)"
                type="number"
                value={parseFloat(settings.tax_rate || 0) * 100}
                onChange={(e) => handleSettingChange('tax_rate', (parseFloat(e.target.value) / 100).toString())}
                margin="normal"
                inputProps={{ min: 0, max: 100, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Working Hours Start"
                type="time"
                value={settings.working_hours_start || '08:00'}
                onChange={(e) => handleSettingChange('working_hours_start', e.target.value)}
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Working Hours End"
                type="time"
                value={settings.working_hours_end || '23:00'}
                onChange={(e) => handleSettingChange('working_hours_end', e.target.value)}
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Receipt Footer"
                value={settings.receipt_footer || ''}
                onChange={(e) => handleSettingChange('receipt_footer', e.target.value)}
                margin="normal"
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* System Configuration */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Maximum TV Sessions"
                type="number"
                value={settings.max_tv_sessions || 50}
                onChange={(e) => handleSettingChange('max_tv_sessions', e.target.value)}
                margin="normal"
                inputProps={{ min: 1, max: 1000 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Session Warning (minutes)"
                type="number"
                value={settings.session_warning_minutes || 5}
                onChange={(e) => handleSettingChange('session_warning_minutes', e.target.value)}
                margin="normal"
                inputProps={{ min: 1, max: 60 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.auto_power_off === 'true'}
                    onChange={(e) => handleSettingChange('auto_power_off', e.target.checked.toString())}
                  />
                }
                label="Auto Power Off TV"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Low Stock Threshold"
                type="number"
                value={settings.low_stock_threshold || 10}
                onChange={(e) => handleSettingChange('low_stock_threshold', e.target.value)}
                margin="normal"
                inputProps={{ min: 1, max: 100 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Order Number Prefix"
                value={settings.order_prefix || 'ORD'}
                onChange={(e) => handleSettingChange('order_prefix', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Timezone"
                value={settings.timezone || 'Asia/Jakarta'}
                onChange={(e) => handleSettingChange('timezone', e.target.value)}
                margin="normal"
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Network & WiFi */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Customer WiFi Information
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="WiFi Name"
                value={settings.wifi_name || ''}
                onChange={(e) => handleSettingChange('wifi_name', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="WiFi Password"
                type="password"
                value={settings.wifi_password || ''}
                onChange={(e) => handleSettingChange('wifi_password', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Guest WiFi Name"
                value={settings.wifi_guest_name || ''}
                onChange={(e) => handleSettingChange('wifi_guest_name', e.target.value)}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Guest WiFi Password"
                type="password"
                value={settings.wifi_guest_password || ''}
                onChange={(e) => handleSettingChange('wifi_guest_password', e.target.value)}
                margin="normal"
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* System Information */}
        <TabPanel value={tabValue} index={3}>
          {systemInfo ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Application Info
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Name:</strong> {systemInfo.application.name}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Version:</strong> {systemInfo.application.version}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Environment:</strong> {systemInfo.application.environment}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Platform:</strong> {systemInfo.application.platform}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Node.js:</strong> {systemInfo.application.node_version}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Uptime:</strong> {formatUptime(systemInfo.application.uptime)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Memory Usage
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>RSS:</strong> {formatBytes(systemInfo.application.memory_usage.rss)}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Heap Total:</strong> {formatBytes(systemInfo.application.memory_usage.heapTotal)}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Heap Used:</strong> {formatBytes(systemInfo.application.memory_usage.heapUsed)}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>External:</strong> {formatBytes(systemInfo.application.memory_usage.external)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Database Info
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Version:</strong> {systemInfo.database.version.split(' ').slice(0, 2).join(' ')}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Total Devices:</strong> {systemInfo.database.statistics.total_devices}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Active Sessions:</strong> {systemInfo.database.statistics.active_sessions}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Pending Orders:</strong> {systemInfo.database.statistics.pending_orders}
                    </Typography>
                    <Typography variant="body2" paragraph>
                      <strong>Low Stock Items:</strong> {systemInfo.database.statistics.low_stock_items}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          )}
        </TabPanel>
      </Card>
    </Box>
  );
}