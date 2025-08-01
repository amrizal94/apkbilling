import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  Tv as TvIcon,
  PointOfSale as PosIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';

const StatCard = ({ title, value, icon, color = 'primary', subtitle, loading }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography color="textSecondary" gutterBottom variant="body2">
            {title}
          </Typography>
          <Typography variant="h4" component="h2">
            {loading ? <CircularProgress size={24} /> : value}
          </Typography>
          {subtitle && (
            <Typography color="textSecondary" variant="body2">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            backgroundColor: `${color}.main`,
            borderRadius: '50%',
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {React.cloneElement(icon, { sx: { color: 'white', fontSize: 24 } })}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

export default function Dashboard() {
  const { activeSessions, pendingOrders } = useSocket();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    // Refresh data every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get('/reports/dashboard');
      if (response.data.success) {
        setDashboardData(response.data.data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to load dashboard data');
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Typography variant="body1" color="textSecondary" gutterBottom>
        Real-time overview of your business operations
      </Typography>

      {/* Main Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active TV Sessions"
            value={activeSessions.length}
            subtitle={`${dashboardData?.tv_billing?.total_sessions || 0} total today`}
            icon={<TvIcon />}
            color="primary"
            loading={loading}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending Orders"
            value={pendingOrders.length}
            subtitle={`${dashboardData?.pos_system?.total_orders || 0} total today`}
            icon={<PosIcon />}
            color="warning"
            loading={loading}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Today's Revenue"
            value={formatCurrency((dashboardData?.tv_billing?.revenue || 0) + (dashboardData?.pos_system?.revenue || 0))}
            subtitle="TV + POS Combined"
            icon={<MoneyIcon />}
            color="success"
            loading={loading}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="TV Devices"
            value={`${dashboardData?.devices?.online || 0}/${dashboardData?.devices?.total || 0}`}
            subtitle="Online / Total"
            icon={<PeopleIcon />}
            color="info"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* Revenue Breakdown */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <TvIcon sx={{ mr: 1 }} />
                TV Billing Today
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h4" color="primary">
                  {formatCurrency(dashboardData?.tv_billing?.revenue || 0)}
                </Typography>
                <Typography color="textSecondary">
                  From {dashboardData?.tv_billing?.total_sessions || 0} sessions
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={75}
                sx={{ mb: 1 }}
              />
              <Typography variant="body2" color="textSecondary">
                75% of daily target
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <PosIcon sx={{ mr: 1 }} />
                POS Sales Today
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h4" color="success.main">
                  {formatCurrency(dashboardData?.pos_system?.revenue || 0)}
                </Typography>
                <Typography color="textSecondary">
                  From {dashboardData?.pos_system?.total_orders || 0} orders
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={60}
                color="success"
                sx={{ mb: 1 }}
              />
              <Typography variant="body2" color="textSecondary">
                60% of daily target
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Active Sessions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <ScheduleIcon sx={{ mr: 1 }} />
                Active TV Sessions
              </Typography>
              {activeSessions.length === 0 ? (
                <Typography color="textSecondary">
                  No active sessions
                </Typography>
              ) : (
                <List dense>
                  {activeSessions.slice(0, 5).map((session) => (
                    <ListItem key={session.id} divider>
                      <ListItemIcon>
                        <TvIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${session.device_name} - ${session.customer_name}`}
                        secondary={`${Math.round(session.remaining_minutes)} minutes left`}
                      />
                      <Chip
                        size="small"
                        label={session.remaining_minutes < 10 ? 'Warning' : 'Active'}
                        color={session.remaining_minutes < 10 ? 'warning' : 'success'}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Alerts & Notifications */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <WarningIcon sx={{ mr: 1 }} />
                Alerts & Notifications
              </Typography>
              
              {/* Low Stock Alert */}
              {dashboardData?.alerts?.low_stock_products?.length > 0 && (
                <>
                  <Typography variant="subtitle2" color="error" gutterBottom>
                    Low Stock Items:
                  </Typography>
                  <List dense>
                    {dashboardData.alerts.low_stock_products.map((product, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <InventoryIcon color="error" />
                        </ListItemIcon>
                        <ListItemText
                          primary={product.product_name}
                          secondary={`${product.stock_quantity} left`}
                        />
                      </ListItem>
                    ))}
                  </List>
                  <Divider sx={{ my: 1 }} />
                </>
              )}

              {/* Pending Orders */}
              {pendingOrders.length > 0 && (
                <>
                  <Typography variant="subtitle2" color="warning.main" gutterBottom>
                    Pending Orders:
                  </Typography>
                  <List dense>
                    {pendingOrders.slice(0, 3).map((order) => (
                      <ListItem key={order.id}>
                        <ListItemIcon>
                          <PosIcon color="warning" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`${order.order_number} - ${order.customer_name || 'Walk-in'}`}
                          secondary={`Table ${order.table_number} - ${order.item_count} items`}
                        />
                        <Chip
                          size="small"
                          label={order.status}
                          color="warning"
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {dashboardData?.alerts?.low_stock_products?.length === 0 && pendingOrders.length === 0 && (
                <Typography color="textSecondary">
                  No alerts at this time
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}