import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Alert,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  CheckCircle as ReceiveIcon,
  Cancel as CancelIcon,
  ShoppingCart as PurchaseIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
// Removed DatePicker imports due to compatibility issues
import axios from 'axios';
import toast from 'react-hot-toast';
import { useSocket } from '../contexts/SocketContext';
import { triggerCompleteNotification } from '../utils/notificationUtils';

export default function PurchaseOrders() {
  const { socket, connected, setPendingPurchaseOrders } = useSocket();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  
  const [formData, setFormData] = useState({
    supplier_id: '',
    purchase_date: new Date(),
    notes: '',
    items: []
  });

  const [newItem, setNewItem] = useState({
    product_id: '',
    quantity: '',
    unit_price: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [purchaseResponse, suppliersResponse, productsResponse] = await Promise.all([
        axios.get('/purchases/orders'),
        axios.get('/suppliers?active_only=true'),
        axios.get('/pos/products')
      ]);

      if (purchaseResponse.data.success) {
        setPurchaseOrders(purchaseResponse.data.data);
      }
      if (suppliersResponse.data.success) {
        setSuppliers(suppliersResponse.data.data);
      }
      if (productsResponse.data.success) {
        setProducts(productsResponse.data.data);
      }
    } catch (error) {
      toast.error('Failed to fetch data');
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setFormData({
      supplier_id: '',
      purchase_date: new Date(),
      notes: '',
      items: []
    });
    setNewItem({
      product_id: '',
      quantity: '',
      unit_price: ''
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem({
      ...newItem,
      [name]: value
    });
  };

  const addItemToOrder = () => {
    if (!newItem.product_id || !newItem.quantity || !newItem.unit_price) {
      toast.error('Please fill all item fields');
      return;
    }

    const product = products.find(p => p.id === parseInt(newItem.product_id));
    if (!product) {
      toast.error('Product not found');
      return;
    }

    const item = {
      product_id: parseInt(newItem.product_id),
      product_name: product.name || product.product_name,
      quantity: parseInt(newItem.quantity),
      unit_price: parseFloat(newItem.unit_price),
      total_price: parseInt(newItem.quantity) * parseFloat(newItem.unit_price)
    };

    setFormData({
      ...formData,
      items: [...formData.items, item]
    });

    setNewItem({
      product_id: '',
      quantity: '',
      unit_price: ''
    });
  };

  const removeItemFromOrder = (index) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      items: updatedItems
    });
  };

  const handleSubmit = async () => {
    try {
      if (!formData.supplier_id || formData.items.length === 0) {
        toast.error('Please select a supplier and add at least one item');
        return;
      }

      const response = await axios.post('/purchases/orders', formData);
      if (response.data.success) {
        const newPOData = {
          id: response.data.data.id,
          purchase_order_number: response.data.data.purchase_order_number,
          supplier_id: formData.supplier_id,
          total_amount: response.data.data.total_amount,
          status: 'pending',
          created_at: new Date().toISOString(),
          item_count: formData.items.length
        };

        // Emit new purchase order event for real-time notifications
        if (socket && connected) {
          socket.emit('new_purchase_order', newPOData);
        }

        // Immediately add to global pending purchase orders
        setPendingPurchaseOrders(prev => {
          const updated = [...prev, newPOData];
          console.log(`🔄 Immediately added new purchase order to global pending: ${updated.length} total`);
          return updated;
        });

        toast.success('Purchase order created successfully');
        handleCloseDialog();
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to create purchase order');
      console.error('Error creating purchase order:', error);
    }
  };

  const handleViewPO = async (poId) => {
    try {
      const response = await axios.get(`/purchases/orders/${poId}`);
      if (response.data.success) {
        setSelectedPO(response.data.data);
        setViewDialogOpen(true);
      }
    } catch (error) {
      toast.error('Failed to fetch purchase order details');
      console.error('Error fetching PO details:', error);
    }
  };

  const handleReceivePO = async (po) => {
    try {
      const response = await axios.get(`/purchases/orders/${po.id}`);
      if (response.data.success) {
        setSelectedPO(response.data.data);
        setReceiveDialogOpen(true);
      }
    } catch (error) {
      toast.error('Failed to fetch purchase order details');
      console.error('Error fetching PO details:', error);
    }
  };

  const handleConfirmReceive = async () => {
    try {
      const response = await axios.patch(`/purchases/orders/${selectedPO.id}/receive`, {
        received_items: selectedPO.items.map(item => ({
          product_id: item.product_id,
          received_quantity: item.quantity
        }))
      });
      
      if (response.data.success) {
        // Trigger interactive notification
        const toastMessage = triggerCompleteNotification('purchase_received', {
          po_number: selectedPO.purchase_order_number
        });
        toast.success(toastMessage);
        
        // Emit socket event if connected
        if (socket && connected) {
          socket.emit('purchase_order_received', {
            order_id: selectedPO.id,
            po_number: selectedPO.purchase_order_number
          });
        }
        
        // Immediate local state update for bell notification
        setPendingPurchaseOrders(prev => {
          const updated = prev.filter(order => order.id !== selectedPO.id);
          console.log(`🔄 Immediately updated local pending purchase orders: ${updated.length} remaining`);
          return updated;
        });
        
        setReceiveDialogOpen(false);
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to receive purchase order');
      console.error('Error receiving PO:', error);
    }
  };

  const handleCancelPO = async (po) => {
    const reason = prompt('Please enter cancellation reason:');
    if (!reason) return;

    try {
      const response = await axios.patch(`/purchases/orders/${po.id}/cancel`, {
        cancel_reason: reason
      });
      
      if (response.data.success) {
        // Emit cancel event for real-time updates
        if (socket && connected) {
          socket.emit('purchase_order_cancelled', {
            order_id: po.id,
            po_number: po.purchase_order_number
          });
        }

        // Immediately remove from global pending purchase orders
        setPendingPurchaseOrders(prev => {
          const updated = prev.filter(order => order.id !== po.id);
          console.log(`🔄 Immediately removed cancelled purchase order: ${updated.length} remaining`);
          return updated;
        });

        toast.success('Purchase order cancelled successfully');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to cancel purchase order');
      console.error('Error cancelling PO:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'received': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getTotalAmount = () => {
    return formData.items.reduce((sum, item) => sum + item.total_price, 0);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading purchase orders...</Typography>
      </Box>
    );
  }

  return (
    <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" display="flex" alignItems="center" gap={1}>
            <PurchaseIcon />
            Purchase Orders
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
          >
            Create Purchase Order
          </Button>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {purchaseOrders.length}
                </Typography>
                <Typography color="textSecondary">Total Orders</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {purchaseOrders.filter(po => po.status === 'pending').length}
                </Typography>
                <Typography color="textSecondary">Pending</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {purchaseOrders.filter(po => po.status === 'received').length}
                </Typography>
                <Typography color="textSecondary">Received</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Purchase Orders Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>PO Number</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Purchase Date</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Total Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {purchaseOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Alert severity="info" sx={{ mt: 2 }}>
                      No purchase orders found. Create your first purchase order to get started.
                    </Alert>
                  </TableCell>
                </TableRow>
              ) : (
                purchaseOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {po.purchase_order_number}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        by {po.created_by_name}
                      </Typography>
                    </TableCell>
                    <TableCell>{po.supplier_name || 'Unknown Supplier'}</TableCell>
                    <TableCell>{formatDate(po.purchase_date)}</TableCell>
                    <TableCell>{po.item_count} items</TableCell>
                    <TableCell>{formatCurrency(po.total_amount)}</TableCell>
                    <TableCell>
                      <Chip
                        label={po.status}
                        color={getStatusColor(po.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <IconButton
                          size="small"
                          onClick={() => handleViewPO(po.id)}
                          title="View Details"
                        >
                          <ViewIcon />
                        </IconButton>
                        {po.status === 'pending' && (
                          <>
                            <IconButton
                              size="small"
                              onClick={() => handleReceivePO(po)}
                              title="Receive Order"
                              color="success"
                            >
                              <ReceiveIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleCancelPO(po)}
                              title="Cancel Order"
                              color="error"
                            >
                              <CancelIcon />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Create Purchase Order Dialog */}
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
          <DialogTitle>Create New Purchase Order</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Supplier"
                  name="supplier_id"
                  value={formData.supplier_id}
                  onChange={handleInputChange}
                  required
                >
                  {suppliers.map((supplier) => (
                    <MenuItem key={supplier.id} value={supplier.id}>
                      {supplier.supplier_name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Purchase Date"
                  name="purchase_date"
                  type="date"
                  value={formData.purchase_date ? formData.purchase_date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormData({ ...formData, purchase_date: new Date(e.target.value) })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  name="notes"
                  multiline
                  rows={2}
                  value={formData.notes}
                  onChange={handleInputChange}
                />
              </Grid>
              
              {/* Add Items Section */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Add Items
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      select
                      fullWidth
                      label="Product"
                      name="product_id"
                      value={newItem.product_id}
                      onChange={handleNewItemChange}
                    >
                      {products.map((product) => (
                        <MenuItem key={product.id} value={product.id}>
                          {product.name || product.product_name} - Current Stock: {product.stock_quantity}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <TextField
                      fullWidth
                      label="Quantity"
                      name="quantity"
                      type="number"
                      value={newItem.quantity}
                      onChange={handleNewItemChange}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      label="Unit Price"
                      name="unit_price"
                      type="number"
                      value={newItem.unit_price}
                      onChange={handleNewItemChange}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={addItemToOrder}
                      sx={{ height: '56px' }}
                    >
                      Add Item
                    </Button>
                  </Grid>
                </Grid>
              </Grid>

              {/* Items List */}
              {formData.items.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Order Items
                  </Typography>
                  <List>
                    {formData.items.map((item, index) => (
                      <ListItem key={index} divider>
                        <ListItemText
                          primary={item.product_name}
                          secondary={`Quantity: ${item.quantity} × ${formatCurrency(item.unit_price)} = ${formatCurrency(item.total_price)}`}
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={() => removeItemFromOrder(index)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary={<Typography variant="h6">Total: {formatCurrency(getTotalAmount())}</Typography>}
                      />
                    </ListItem>
                  </List>
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained">
              Create Purchase Order
            </Button>
          </DialogActions>
        </Dialog>

        {/* View PO Dialog */}
        <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Purchase Order Details</DialogTitle>
          <DialogContent>
            {selectedPO && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">PO Number</Typography>
                  <Typography variant="body1">{selectedPO.purchase_order_number}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Supplier</Typography>
                  <Typography variant="body1">{selectedPO.supplier_name}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Purchase Date</Typography>
                  <Typography variant="body1">{formatDate(selectedPO.purchase_date)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Status</Typography>
                  <Chip label={selectedPO.status} color={getStatusColor(selectedPO.status)} size="small" />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Items</Typography>
                  <List>
                    {selectedPO.items?.map((item, index) => (
                      <ListItem key={index} divider>
                        <ListItemText
                          primary={item.product_name}
                          secondary={`${item.quantity} × ${formatCurrency(item.unit_price)} = ${formatCurrency(item.total_price)}`}
                        />
                      </ListItem>
                    ))}
                    <ListItem>
                      <ListItemText
                        primary={<Typography variant="h6">Total: {formatCurrency(selectedPO.total_amount)}</Typography>}
                      />
                    </ListItem>
                  </List>
                </Grid>
                {selectedPO.notes && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2">Notes</Typography>
                    <Typography variant="body1">{selectedPO.notes}</Typography>
                  </Grid>
                )}
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Receive PO Dialog */}
        <Dialog open={receiveDialogOpen} onClose={() => setReceiveDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Receive Purchase Order</DialogTitle>
          <DialogContent>
            {selectedPO && (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Receiving this order will update your inventory stock levels.
                </Alert>
                <Typography variant="h6" gutterBottom>
                  {selectedPO.purchase_order_number}
                </Typography>
                <List>
                  {selectedPO.items?.map((item, index) => (
                    <ListItem key={index} divider>
                      <ListItemText
                        primary={item.product_name}
                        secondary={`Quantity: ${item.quantity}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReceiveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmReceive} variant="contained" color="success">
              Confirm Receive
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
}