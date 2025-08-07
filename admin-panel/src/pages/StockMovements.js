import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Grid,
  TextField,
  MenuItem,
  Button,
  Alert,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Inventory as InventoryIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function StockMovements() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    product_id: '',
    movement_type: '',
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [movementsResponse, productsResponse] = await Promise.all([
        axios.get('/purchases/stock-movements', { params: filters }),
        axios.get('/pos/products')
      ]);

      if (movementsResponse.data.success) {
        setMovements(movementsResponse.data.data);
      }
      if (productsResponse.data.success) {
        setProducts(productsResponse.data.data);
      }
    } catch (error) {
      toast.error('Failed to fetch stock movements');
      console.error('Error fetching stock movements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };

  const applyFilters = () => {
    setLoading(true);
    fetchData();
  };

  const clearFilters = () => {
    setFilters({
      product_id: '',
      movement_type: '',
      start_date: '',
      end_date: '',
    });
    setTimeout(() => {
      setLoading(true);
      fetchData();
    }, 100);
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('id-ID');
  };

  const getMovementColor = (type) => {
    switch (type) {
      case 'purchase': return 'success';
      case 'sale': return 'primary';
      case 'adjustment': return 'warning';
      case 'waste': return 'error';
      default: return 'default';
    }
  };

  const getMovementIcon = (quantityChange) => {
    return quantityChange > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading stock movements...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" display="flex" alignItems="center" gap={1}>
          <InventoryIcon />
          Stock Movements
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchData}
        >
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                label="Product"
                name="product_id"
                value={filters.product_id}
                onChange={handleFilterChange}
              >
                <MenuItem value="">All Products</MenuItem>
                {products.map((product) => (
                  <MenuItem key={product.id} value={product.id}>
                    {product.product_name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                label="Movement Type"
                name="movement_type"
                value={filters.movement_type}
                onChange={handleFilterChange}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="purchase">Purchase</MenuItem>
                <MenuItem value="sale">Sale</MenuItem>
                <MenuItem value="adjustment">Adjustment</MenuItem>
                <MenuItem value="waste">Waste</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Start Date"
                name="start_date"
                type="date"
                value={filters.start_date}
                onChange={handleFilterChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="End Date"
                name="end_date"
                type="date"
                value={filters.end_date}
                onChange={handleFilterChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" gap={1}>
                <Button variant="contained" onClick={applyFilters}>
                  Apply Filters
                </Button>
                <Button variant="outlined" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {movements.length}
              </Typography>
              <Typography color="textSecondary">Total Movements</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {movements.filter(m => m.movement_type === 'purchase').length}
              </Typography>
              <Typography color="textSecondary">Purchases</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {movements.filter(m => m.movement_type === 'sale').length}
              </Typography>
              <Typography color="textSecondary">Sales</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {movements.filter(m => m.movement_type === 'adjustment').length}
              </Typography>
              <Typography color="textSecondary">Adjustments</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Stock Movements Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date & Time</TableCell>
              <TableCell>Product</TableCell>
              <TableCell>Movement Type</TableCell>
              <TableCell>Quantity Change</TableCell>
              <TableCell>Stock Before</TableCell>
              <TableCell>Stock After</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell>Created By</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Alert severity="info" sx={{ mt: 2 }}>
                    No stock movements found for the selected filters.
                  </Alert>
                </TableCell>
              </TableRow>
            ) : (
              movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDateTime(movement.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2">
                      {movement.product_name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={movement.movement_type}
                      color={getMovementColor(movement.movement_type)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getMovementIcon(movement.quantity_change)}
                      <Typography
                        variant="subtitle2"
                        color={movement.quantity_change > 0 ? 'success.main' : 'error.main'}
                      >
                        {movement.quantity_change > 0 ? '+' : ''}{movement.quantity_change}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{movement.stock_before}</TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {movement.stock_after}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="textSecondary">
                      {movement.reference_type}
                      {movement.reference_id && ` #${movement.reference_id}`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="textSecondary">
                      {movement.notes || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {movement.created_by_name || 'System'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}