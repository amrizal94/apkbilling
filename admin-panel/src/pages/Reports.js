import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from 'axios';
import toast from 'react-hot-toast';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`reports-tabpanel-${index}`}
      aria-labelledby={`reports-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Reports() {
  const [tabValue, setTabValue] = useState(0);
  const [dateRange, setDateRange] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });
  const [tvBillingData, setTvBillingData] = useState(null);
  const [posData, setPosData] = useState(null);
  const [productData, setProductData] = useState([]);
  const [financialData, setFinancialData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReports();
  }, [tabValue, dateRange]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      switch (tabValue) {
        case 0:
          await fetchTVBillingReport();
          break;
        case 1:
          await fetchPOSReport();
          break;
        case 2:
          await fetchProductReport();
          break;
        case 3:
          await fetchFinancialReport();
          break;
        default:
          break;
      }
    } catch (error) {
      toast.error('Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTVBillingReport = async () => {
    const response = await axios.get('/reports/tv-billing', { params: dateRange });
    if (response.data.success) {
      setTvBillingData(response.data.data);
    }
  };

  const fetchPOSReport = async () => {
    const response = await axios.get('/reports/pos-sales', { params: dateRange });
    if (response.data.success) {
      setPosData(response.data.data);
    }
  };

  const fetchProductReport = async () => {
    const response = await axios.get('/reports/product-performance', { params: dateRange });
    if (response.data.success) {
      setProductData(response.data.data);
    }
  };

  const fetchFinancialReport = async () => {
    const response = await axios.get('/reports/financial-summary', { params: dateRange });
    if (response.data.success) {
      setFinancialData(response.data.data);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('id-ID');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'completed':
        return 'info';
      case 'cancelled':
        return 'error';
      case 'pending':
        return 'warning';
      case 'preparing':
        return 'info';
      case 'ready':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Reports & Analytics
      </Typography>

      {/* Date Range Filter */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={dateRange.start_date}
                onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={dateRange.end_date}
                onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={fetchReports}
                disabled={loading}
              >
                Refresh
              </Button>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                disabled={loading}
              >
                Export
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Report Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="TV Billing" />
            <Tab label="POS Sales" />
            <Tab label="Product Performance" />
            <Tab label="Financial Summary" />
          </Tabs>
        </Box>

        {/* TV Billing Report */}
        <TabPanel value={tabValue} index={0}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : tvBillingData ? (
            <>
              {/* Summary Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {tvBillingData.summary.total_sessions}
                      </Typography>
                      <Typography color="textSecondary">Total Sessions</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="success.main">
                        {tvBillingData.summary.active_sessions}
                      </Typography>
                      <Typography color="textSecondary">Active Sessions</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4">
                        {formatCurrency(tvBillingData.summary.total_revenue)}
                      </Typography>
                      <Typography color="textSecondary">Total Revenue</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4">
                        {formatCurrency(tvBillingData.summary.average_session_value)}
                      </Typography>
                      <Typography color="textSecondary">Avg. Session Value</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Sessions Table */}
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Device</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell>Package</TableCell>
                      <TableCell>Start Time</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tvBillingData.sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>{session.device_name}</TableCell>
                        <TableCell>{session.customer_name}</TableCell>
                        <TableCell>{session.package_name}</TableCell>
                        <TableCell>{formatDateTime(session.start_time)}</TableCell>
                        <TableCell>{session.duration_minutes} min</TableCell>
                        <TableCell>{formatCurrency(session.amount_paid)}</TableCell>
                        <TableCell>
                          <Chip
                            label={session.status}
                            color={getStatusColor(session.status)}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <Alert severity="info">No data available for the selected date range</Alert>
          )}
        </TabPanel>

        {/* POS Sales Report */}
        <TabPanel value={tabValue} index={1}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : posData ? (
            <>
              {/* Summary Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {posData.summary.total_orders}
                      </Typography>
                      <Typography color="textSecondary">Total Orders</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="success.main">
                        {posData.summary.completed_orders}
                      </Typography>
                      <Typography color="textSecondary">Completed Orders</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4">
                        {formatCurrency(posData.summary.total_revenue)}
                      </Typography>
                      <Typography color="textSecondary">Total Revenue</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4">
                        {formatCurrency(posData.summary.average_order_value)}
                      </Typography>
                      <Typography color="textSecondary">Avg. Order Value</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Orders Table */}
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Order #</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell>Table</TableCell>
                      <TableCell>Items</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {posData.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>{order.order_number}</TableCell>
                        <TableCell>{order.customer_name || 'Walk-in'}</TableCell>
                        <TableCell>{order.table_number}</TableCell>
                        <TableCell>{order.item_count}</TableCell>
                        <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                        <TableCell>
                          <Chip
                            label={order.order_type}
                            variant="outlined"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={order.status}
                            color={getStatusColor(order.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{formatDateTime(order.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <Alert severity="info">No data available for the selected date range</Alert>
          )}
        </TabPanel>

        {/* Product Performance Report */}
        <TabPanel value={tabValue} index={2}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : productData.length > 0 ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Stock</TableCell>
                    <TableCell>Sold</TableCell>
                    <TableCell>Revenue</TableCell>
                    <TableCell>Orders</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productData.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>{product.product_name}</TableCell>
                      <TableCell>{product.category_name}</TableCell>
                      <TableCell>{formatCurrency(product.price)}</TableCell>
                      <TableCell>{product.stock_quantity}</TableCell>
                      <TableCell>{product.total_sold}</TableCell>
                      <TableCell>{formatCurrency(product.total_revenue)}</TableCell>
                      <TableCell>{product.order_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">No data available for the selected date range</Alert>
          )}
        </TabPanel>

        {/* Financial Summary Report */}
        <TabPanel value={tabValue} index={3}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : financialData ? (
            <>
              {/* Summary Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4">
                        {formatCurrency(financialData.summary.total_revenue)}
                      </Typography>
                      <Typography color="textSecondary">Total Revenue</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {formatCurrency(financialData.summary.tv_billing_revenue)}
                      </Typography>
                      <Typography color="textSecondary">TV Billing</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="success.main">
                        {formatCurrency(financialData.summary.pos_revenue)}
                      </Typography>
                      <Typography color="textSecondary">POS Sales</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4">
                        {financialData.summary.total_transactions}
                      </Typography>
                      <Typography color="textSecondary">Transactions</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Breakdown Table */}
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Transaction Type</TableCell>
                      <TableCell>Payment Method</TableCell>
                      <TableCell>Count</TableCell>
                      <TableCell>Total Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {financialData.breakdown.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Chip
                            label={item.transaction_type.replace('_', ' ').toUpperCase()}
                            color={item.transaction_type === 'tv_billing' ? 'primary' : 'success'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{item.payment_method.toUpperCase()}</TableCell>
                        <TableCell>{item.transaction_count}</TableCell>
                        <TableCell>{formatCurrency(item.total_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <Alert severity="info">No data available for the selected date range</Alert>
          )}
        </TabPanel>
      </Card>
    </Box>
  );
}