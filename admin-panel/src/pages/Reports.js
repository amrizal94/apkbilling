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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
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
  const [packageDetailModal, setPackageDetailModal] = useState({ open: false, session: null });
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
          await fetchFnBReport();
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

  const fetchFnBReport = async () => {
    const params = new URLSearchParams();
    if (dateRange.start_date) params.append('start_date', dateRange.start_date);
    if (dateRange.end_date) params.append('end_date', dateRange.end_date);
    
    const response = await axios.get(`/reports/fnb-unified?${params}`);
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

  const formatPackageDetail = (session) => {
    if (!session.package_name) return '-';
    
    try {
      // Check if there are multiple packages or additional time
      let packageCount = 1;
      if (session.packages_breakdown) {
        const packages = typeof session.packages_breakdown === 'string' 
          ? JSON.parse(session.packages_breakdown) 
          : session.packages_breakdown;
        packageCount = packages.length;
      }
      
      const hasAdditionalTime = session.additional_minutes > 0;
      
      if (packageCount > 1) {
        return `${session.package_name} +${packageCount - 1} lainnya`;
      } else if (hasAdditionalTime) {
        return `${session.package_name} +tambahan waktu`;
      }
      
      return session.package_name;
    } catch (error) {
      console.error('Error parsing package details:', error);
      return session.package_name;
    }
  };

  const handleViewPackageDetail = (session) => {
    setPackageDetailModal({ open: true, session });
  };

  const handleExport = () => {
    if (!tvBillingData && !posData && !productData && !financialData) {
      toast.error('No data to export');
      return;
    }

    let dataToExport = [];
    let filename = '';

    switch (tabValue) {
      case 0: // TV Billing
        if (tvBillingData && tvBillingData.sessions) {
          dataToExport = tvBillingData.sessions.map(session => ({
            'Order Number': session.id,
            'Device': session.device_name,
            'Customer': session.payment_notes || '-',
            'Package': formatPackageDetail(session),
            'Start Time': formatDateTime(session.start_time),
            'Duration (min)': session.duration_minutes,
            'Amount': session.amount_paid,
            'Status': session.status
          }));
          filename = `tv-billing-${dateRange.start_date}-${dateRange.end_date}.csv`;
        }
        break;
      case 1: // F&B Reports
        if (posData && posData.orders) {
          dataToExport = posData.orders.map(order => ({
            'Order Number': order.order_number || `#${order.id}`,
            'Customer': order.customer_name || 'Walk-in',
            'Source': order.source === 'pos' ? 'POS System' : 'Gaming Session',
            'Items': order.item_summary || `${order.item_count || 0} items`,
            'Amount': order.total_amount,
            'Status': order.status,
            'Date': formatDateTime(order.created_at),
            'Details': order.item_details || ''
          }));
          filename = `fnb-reports-${dateRange.start_date}-${dateRange.end_date}.csv`;
        }
        break;
      case 2: // Product Performance
        if (productData && productData.length > 0) {
          dataToExport = productData.map(product => ({
            'Product': product.product_name,
            'Category': product.category_name,
            'Price': product.price,
            'Stock': product.stock_quantity,
            'Sold': product.total_sold,
            'Revenue': product.total_revenue,
            'Orders': product.order_count
          }));
          filename = `product-performance-${dateRange.start_date}-${dateRange.end_date}.csv`;
        }
        break;
      case 3: // Financial Summary
        if (financialData && financialData.breakdown) {
          dataToExport = financialData.breakdown.map(item => ({
            'Transaction Type': item.transaction_type.replace('_', ' ').toUpperCase(),
            'Payment Method': item.payment_method.toUpperCase(),
            'Count': item.transaction_count,
            'Total Amount': item.total_amount
          }));
          filename = `financial-summary-${dateRange.start_date}-${dateRange.end_date}.csv`;
        }
        break;
    }

    if (dataToExport.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Convert to CSV
    const headers = Object.keys(dataToExport[0]);
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma
          const stringValue = String(value || '');
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Report exported successfully!');
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
                onClick={handleExport}
                disabled={loading}
              >
                Export CSV
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
            <Tab label="F&B Reports" />
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
                      <TableCell>Payment Notes</TableCell>
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
                        <TableCell>{session.payment_notes || '-'}</TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {formatPackageDetail(session)}
                              </Typography>
                              {(() => {
                                try {
                                  if (session.packages_breakdown) {
                                    const packages = typeof session.packages_breakdown === 'string' 
                                      ? JSON.parse(session.packages_breakdown) 
                                      : session.packages_breakdown;
                                    if (packages.length > 1) {
                                      return (
                                        <Typography variant="caption" color="text.secondary">
                                          {packages.length} packages
                                        </Typography>
                                      );
                                    }
                                  }
                                  return null;
                                } catch (error) {
                                  return null;
                                }
                              })()}
                            </Box>
                            {(session.additional_minutes > 0 || session.packages_detail || session.packages_breakdown) && (
                              <IconButton 
                                size="small" 
                                onClick={() => handleViewPackageDetail(session)}
                                color="primary"
                                sx={{ ml: 'auto' }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </TableCell>
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

        {/* F&B Reports */}
        <TabPanel value={tabValue} index={1}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : posData ? (
            <>
              {/* Summary Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {posData.summary?.total_orders || 0}
                      </Typography>
                      <Typography color="textSecondary">Total Orders</Typography>
                      <Typography variant="caption" color="textSecondary">
                        POS + Gaming Orders
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="warning.main">
                        {posData.summary?.pos_orders || 0}
                      </Typography>
                      <Typography color="textSecondary">POS Orders</Typography>
                      <Typography variant="caption" color="textSecondary">
                        Direct POS System
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="info.main">
                        {posData.summary?.gaming_orders || 0}
                      </Typography>
                      <Typography color="textSecondary">Gaming Orders</Typography>
                      <Typography variant="caption" color="textSecondary">
                        From TV Sessions
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="success.main">
                        {formatCurrency(posData.summary?.total_revenue || 0)}
                      </Typography>
                      <Typography color="textSecondary">Total Revenue</Typography>
                      <Typography variant="caption" color="textSecondary">
                        Combined F&B Sales
                      </Typography>
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
                      <TableCell>Source</TableCell>
                      <TableCell>Items</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {posData.orders?.map((order) => (
                      <TableRow key={`${order.source}-${order.id}`}>
                        <TableCell>{order.order_number || `#${order.id}`}</TableCell>
                        <TableCell>{order.customer_name || 'Walk-in'}</TableCell>
                        <TableCell>
                          <Chip
                            label={order.source === 'pos' ? 'POS System' : 'Gaming Session'}
                            color={order.source === 'pos' ? 'warning' : 'info'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{order.item_summary || `${order.item_count || 0} items`}</TableCell>
                        <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                        <TableCell>
                          <Chip
                            label={order.status}
                            color={getStatusColor(order.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{formatDateTime(order.created_at)}</TableCell>
                        <TableCell>
                          {order.item_details && (
                            <Button
                              size="small"
                              onClick={() => {
                                // Show order details in a dialog/modal
                                alert(`Order Details:\n${order.item_details}`);
                              }}
                            >
                              View Details
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )) || []}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <Alert severity="info">No F&B data available for the selected date range</Alert>
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

      {/* Package Detail Modal */}
      <Dialog
        open={packageDetailModal.open}
        onClose={() => setPackageDetailModal({ open: false, session: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            Detail Package
            <IconButton onClick={() => setPackageDetailModal({ open: false, session: null })}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {packageDetailModal.session && (
            <List>
              {packageDetailModal.session.packages_breakdown ? (
                <>
                  {/* Individual package breakdown like F&B order items */}
                  {(() => {
                    try {
                      const packages = typeof packageDetailModal.session.packages_breakdown === 'string' 
                        ? JSON.parse(packageDetailModal.session.packages_breakdown)
                        : packageDetailModal.session.packages_breakdown;
                      
                      // Group packages by name and price to show quantity
                      const groupedPackages = {};
                      packages.forEach(pkg => {
                        const key = `${pkg.package_name}-${pkg.price}`;
                        if (groupedPackages[key]) {
                          groupedPackages[key].quantity += 1;
                          groupedPackages[key].total += pkg.price;
                        } else {
                          groupedPackages[key] = {
                            package_name: pkg.package_name,
                            duration_minutes: pkg.duration_minutes,
                            price: pkg.price,
                            package_type: pkg.package_type,
                            quantity: 1,
                            total: pkg.price
                          };
                        }
                      });
                      
                      return Object.values(groupedPackages).map((pkg, index) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={`${pkg.package_name} • ${pkg.duration_minutes} menit`}
                            secondary={`${pkg.quantity} x ${formatCurrency(pkg.price)} = ${formatCurrency(pkg.total)}`}
                          />
                        </ListItem>
                      ));
                    } catch (error) {
                      console.error('Error parsing packages_breakdown:', error);
                      return (
                        <ListItem>
                          <ListItemText
                            primary="Error loading package details"
                            secondary="Please contact administrator"
                          />
                        </ListItem>
                      );
                    }
                  })()}
                  <ListItem divider>
                    <ListItemText
                      primary="Total"
                      secondary={`${packageDetailModal.session.duration_minutes} menit`}
                      primaryTypographyProps={{ fontWeight: 'bold' }}
                    />
                    <Typography variant="body2" fontWeight="bold">
                      {formatCurrency(packageDetailModal.session.amount_paid)}
                    </Typography>
                  </ListItem>
                </>
              ) : (
                <>
                  <ListItem>
                    <ListItemText
                      primary="Package Dasar"
                      secondary={`${packageDetailModal.session.package_name} - ${packageDetailModal.session.package_duration} menit`}
                    />
                    <Typography variant="body2" color="textSecondary">
                      {formatCurrency(packageDetailModal.session.package_price)}
                    </Typography>
                  </ListItem>
                  {packageDetailModal.session.additional_minutes > 0 && (
                    <ListItem>
                      <ListItemText
                        primary="Tambahan Waktu"
                        secondary={`${packageDetailModal.session.additional_minutes} menit tambahan`}
                      />
                      <Typography variant="body2" color="textSecondary">
                        {formatCurrency(packageDetailModal.session.additional_amount)}
                      </Typography>
                    </ListItem>
                  )}
                  <ListItem divider>
                    <ListItemText
                      primary="Total"
                      secondary={`${packageDetailModal.session.duration_minutes} menit`}
                      primaryTypographyProps={{ fontWeight: 'bold' }}
                    />
                    <Typography variant="body2" fontWeight="bold">
                      {formatCurrency(packageDetailModal.session.amount_paid)}
                    </Typography>
                  </ListItem>
                </>
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPackageDetailModal({ open: false, session: null })}>
            Tutup
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}