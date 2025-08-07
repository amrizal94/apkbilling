import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  TextField,
  Box,
  Chip,
  IconButton,
  Badge,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  ShoppingCart as CartIcon,
  Receipt as ReceiptIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
  Assignment as OrderIcon,
  CheckCircle as CompleteIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';
import { triggerCompleteNotification } from '../utils/notificationUtils';

export default function POSSystem() {
  const { emitNewOrder, emitOrderStatusUpdate, socket, connected, setPendingOrders: setGlobalPendingOrders } = useSocket();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkoutDialog, setCheckoutDialog] = useState(false);
  const [pendingOrdersDialog, setPendingOrdersDialog] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [orderForm, setOrderForm] = useState({
    customer_name: '',
    table_number: '',
    order_type: 'dine_in',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchPendingOrders();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/pos/categories');
      if (response.data.success) {
        setCategories([{ id: 0, category_name: 'All Products' }, ...response.data.data]);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const params = selectedCategory > 0 ? { category_id: selectedCategory } : {};
      const response = await axios.get('/pos/products', { params });
      if (response.data.success) {
        setProducts(response.data.data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setLoading(false);
    }
  };

  const fetchPendingOrders = async () => {
    try {
      const response = await axios.get('/pos/orders', { 
        params: { 
          status: 'pending',
          limit: 20 
        } 
      });
      if (response.data.success) {
        setPendingOrders(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch pending orders:', error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  const addToCart = (product) => {
    // Check stock quantity first
    if ((product.stock_quantity || 0) <= 0) {
      toast.error(`${product.product_name || product.name || 'Product'} is out of stock!`);
      return;
    }
    
    // Check is_available only if it exists (some products might not have this field)
    if (product.is_available !== undefined && !product.is_available) {
      toast.error(`${product.product_name || product.name || 'Product'} is not available for sale!`);
      return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    
    // Check if adding would exceed available stock
    const newQuantity = existingItem ? existingItem.quantity + 1 : 1;
    if (newQuantity > product.stock_quantity) {
      toast.error(`Only ${product.stock_quantity} ${product.product_name || product.name || 'items'} available in stock!`);
      return;
    }

    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    toast.success(`${product.product_name || product.name || 'Product'} added to cart`);
  };

  const removeFromCart = (productId) => {
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem.quantity > 1) {
      setCart(cart.map(item =>
        item.id === productId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      ));
    } else {
      setCart(cart.filter(item => item.id !== productId));
    }
  };

  const clearCart = () => {
    setCart([]);
    toast.success('Cart cleared');
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const handleCheckout = async () => {
    try {
      const orderData = {
        customer_name: orderForm.customer_name || 'Anonymous',
        table_number: orderForm.table_number || '0',
        order_type: orderForm.order_type,
        items: cart.map(item => ({
          product_id: item.id,
          product_name: item.product_name || item.name || 'Unknown Product',
          quantity: item.quantity,
          unit_price: item.price,
          notes: item.notes || '',
        })),
      };

      const response = await axios.post('/pos/orders', orderData);
      if (response.data.success) {
        toast.success(`Order ${response.data.data.order_number} created successfully!`);
        
        // Prepare new order data
        const newOrderData = {
          id: response.data.data.id,
          order_number: response.data.data.order_number,
          customer_name: orderForm.customer_name || 'Anonymous',
          table_number: orderForm.table_number || '0',
          total_amount: response.data.data.total_amount,
          item_count: getTotalItems(),
          status: 'pending',
          created_at: new Date().toISOString()
        };

        // Emit new order event
        emitNewOrder(newOrderData);

        // Immediately add to global pending orders
        setGlobalPendingOrders(prev => {
          const updated = [...prev, newOrderData];
          console.log(`🔄 Immediately added new order to global pending orders: ${updated.length} total`);
          return updated;
        });

        // Reset form and cart
        setCart([]);
        setOrderForm({ customer_name: '', table_number: '', order_type: 'dine_in' });
        setCheckoutDialog(false);
        
        // Refresh pending orders from server for consistency
        fetchPendingOrders();
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create order';
      toast.error(message);
    }
  };

  const handleCompleteOrder = async (orderId) => {
    try {
      const response = await axios.put(`/pos/orders/${orderId}/status`, { status: 'completed' });
      
      // Trigger interactive notification for order completion
      const toastMessage = triggerCompleteNotification('order_completed', {
        order_number: response.data.data?.order_number || `Order #${orderId}`
      });
      toast.success(toastMessage);
      
      // Emit order completed event for real-time updates
      if (emitOrderStatusUpdate) {
        emitOrderStatusUpdate({
          order_id: orderId,
          new_status: 'completed',
          order_number: response.data.data?.order_number || `Order #${orderId}`
        });
      }

      // Also emit generic order_completed event
      if (socket && connected) {
        socket.emit('order_completed', {
          order_id: orderId,
          order_number: response.data.data?.order_number || `Order #${orderId}`
        });
      }
      
      // Check for low stock after order completion and refresh products
      fetchProducts().then(() => {
        // Check if any products are low on stock (threshold: 10)
        const lowStockProducts = products.filter(product => 
          product.stock_quantity <= 10 && product.stock_quantity > 0
        );
        
        lowStockProducts.forEach(product => {
          if (socket && connected) {
            socket.emit('low_stock_alert', {
              product_name: product.name || product.product_name,
              stock_quantity: product.stock_quantity
            });
          }
        });
      });
      
      // Immediate global state update for bell notification (don't wait for fetch)
      setGlobalPendingOrders(prev => {
        const updated = prev.filter(order => order.id !== orderId);
        console.log(`🔄 Immediately updated global pending orders: ${updated.length} remaining`);
        return updated;
      });
      
      // Also update local state
      setPendingOrders(prev => {
        const updated = prev.filter(order => order.id !== orderId);
        console.log(`🔄 Immediately updated local pending orders: ${updated.length} remaining`);
        return updated;
      });
      
      // Also refresh from server for consistency
      fetchPendingOrders();
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to complete order';
      toast.error(message);
    }
  };

  const filteredProducts = products.filter(product => {
    const productName = (product.product_name || product.name || '').toString();
    const categoryName = (product.category_name || product.category || '').toString();
    const query = (searchQuery || '').toString().toLowerCase();
    
    return productName.toLowerCase().includes(query) ||
           categoryName.toLowerCase().includes(query);
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">
          POS System
        </Typography>
        <Button
          variant="outlined"
          startIcon={<OrderIcon />}
          onClick={() => setPendingOrdersDialog(true)}
          color="primary"
        >
          Pending Orders ({pendingOrders.length})
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Products Section */}
        <Grid item xs={12} md={8}>
          {/* Search and Categories */}
          <Box mb={2}>
            <TextField
              fullWidth
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              sx={{ mb: 2 }}
            />
            
            <Tabs
              value={selectedCategory}
              onChange={(e, newValue) => setSelectedCategory(newValue)}
              variant="scrollable"
              scrollButtons="auto"
            >
              {categories.map((category, index) => (
                <Tab
                  key={`category-${category.id || index}`}
                  label={category.category_name || category.name || category.category || 'Unknown'}
                  value={category.id}
                />
              ))}
            </Tabs>
          </Box>

          {/* Products Grid */}
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {filteredProducts.map((product, index) => (
                <Grid item xs={12} sm={6} md={4} key={`product-${product.id || index}`}>
                  <Card 
                    sx={{ 
                      cursor: product.stock_quantity > 0 && (product.is_available !== false) ? 'pointer' : 'not-allowed',
                      '&:hover': { boxShadow: product.stock_quantity > 0 && (product.is_available !== false) ? 4 : 1 },
                      opacity: product.stock_quantity > 0 && (product.is_available !== false) ? 1 : 0.6,
                    }}
                    onClick={() => addToCart(product)}
                  >
                    <CardMedia
                      component="div"
                      sx={{
                        height: 120,
                        backgroundColor: 'grey.200',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="h4" color="text.secondary">
                        {(product.product_name || product.name || 'P').charAt(0)}
                      </Typography>
                    </CardMedia>
                    <CardContent>
                      <Typography variant="h6" noWrap>
                        {product.product_name || product.name || 'Unknown Product'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {product.category_name || product.category || 'Unknown Category'}
                      </Typography>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                        <Typography variant="h6" color="primary">
                          {formatCurrency(product.price)}
                        </Typography>
                        <Chip
                          size="small"
                          label={
                            product.stock_quantity > 0 
                              ? `Stock: ${product.stock_quantity}` 
                              : 'Out of Stock'
                          }
                          color={
                            product.stock_quantity > 0 && (product.is_available !== false)
                              ? 'success' 
                              : 'error'
                          }
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Grid>

        {/* Cart Section */}
        <Grid item xs={12} md={4}>
          <Card sx={{ position: 'sticky', top: 20 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" display="flex" alignItems="center">
                  <CartIcon sx={{ mr: 1 }} />
                  Cart
                  {getTotalItems() > 0 && (
                    <Badge badgeContent={getTotalItems()} color="primary" sx={{ ml: 1 }} />
                  )}
                </Typography>
                {cart.length > 0 && (
                  <IconButton onClick={clearCart} size="small" color="error">
                    <ClearIcon />
                  </IconButton>
                )}
              </Box>

              {cart.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={2}>
                  Cart is empty
                </Typography>
              ) : (
                <>
                  <List dense>
                    {cart.map((item, index) => (
                      <ListItem key={`cart-${item.id || index}`} divider>
                        <ListItemText
                          primary={item.product_name || item.name || 'Unknown Product'}
                          secondary={`${formatCurrency(item.price)} x ${item.quantity}`}
                        />
                        <ListItemSecondaryAction>
                          <Box display="flex" alignItems="center">
                            <IconButton
                              size="small"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <RemoveIcon />
                            </IconButton>
                            <Typography sx={{ mx: 1 }}>
                              {item.quantity}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => addToCart(item)}
                            >
                              <AddIcon />
                            </IconButton>
                          </Box>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>

                  <Divider sx={{ my: 2 }} />

                  <Box display="flex" justifyContent="space-between" mb={2}>
                    <Typography variant="h6">
                      Total:
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {formatCurrency(getTotalAmount())}
                    </Typography>
                  </Box>

                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    startIcon={<ReceiptIcon />}
                    onClick={() => setCheckoutDialog(true)}
                  >
                    Checkout
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Checkout Dialog */}
      <Dialog open={checkoutDialog} onClose={() => setCheckoutDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Checkout Order</DialogTitle>
        <DialogContent>
          <Box mb={2}>
            <Typography variant="h6" gutterBottom>
              Order Summary
            </Typography>
            <List dense>
              {cart.map((item, index) => (
                <ListItem key={`checkout-${item.id || index}`}>
                  <ListItemText
                    primary={`${item.product_name || item.name || 'Unknown Product'} x ${item.quantity}`}
                    secondary={formatCurrency(item.price * item.quantity)}
                  />
                </ListItem>
              ))}
            </List>
            <Divider />
            <Box display="flex" justifyContent="space-between" mt={1}>
              <Typography variant="h6">Total:</Typography>
              <Typography variant="h6" color="primary">
                {formatCurrency(getTotalAmount())}
              </Typography>
            </Box>
          </Box>

          <TextField
            fullWidth
            label="Customer Name"
            placeholder="Leave empty for Anonymous"
            value={orderForm.customer_name}
            onChange={(e) => setOrderForm({ ...orderForm, customer_name: e.target.value })}
            margin="normal"
          />

          <TextField
            fullWidth
            label="Table Number"
            placeholder="Leave empty for Table 0"
            value={orderForm.table_number}
            onChange={(e) => setOrderForm({ ...orderForm, table_number: e.target.value })}
            margin="normal"
          />

          <TextField
            select
            fullWidth
            label="Order Type"
            value={orderForm.order_type}
            onChange={(e) => setOrderForm({ ...orderForm, order_type: e.target.value })}
            margin="normal"
            SelectProps={{ native: true }}
          >
            <option value="dine_in">Dine In</option>
            <option value="takeaway">Take Away</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCheckoutDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCheckout}
            variant="contained"
          >
            Create Order
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pending Orders Dialog */}
      <Dialog 
        open={pendingOrdersDialog} 
        onClose={() => setPendingOrdersDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            Pending Orders
            <Button
              variant="outlined"
              size="small"
              onClick={fetchPendingOrders}
              startIcon={<SearchIcon />}
            >
              Refresh
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {pendingOrders.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              No pending orders
            </Typography>
          ) : (
            <List>
              {pendingOrders.map((order, index) => (
                <ListItem key={`pending-${order.id || index}`} divider>
                  <ListItemText
                    primary={`Order #${order.order_number}`}
                    secondary={
                      <React.Fragment>
                        <span style={{ display: 'block', marginBottom: '4px' }}>
                          Customer: {order.customer_name || 'Anonymous'} | Table: {order.table_number || '0'}
                        </span>
                        {order.items && order.items.length > 0 ? (
                          <span style={{ display: 'block', marginBottom: '4px' }}>
                            Items: {order.items.map((item, idx) => (
                              <span key={idx}>
                                {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.product_name}
                                {item.quantity > 1 ? ` (@${formatCurrency(item.unit_price)})` : ` ${formatCurrency(item.unit_price)}`}
                                {idx < order.items.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span style={{ display: 'block', marginBottom: '4px' }}>
                            Items: ({order.item_count} items)
                          </span>
                        )}
                        <span style={{ display: 'block', color: '#1976d2', fontWeight: 'bold', marginBottom: '4px' }}>
                          Total: {formatCurrency(order.total_amount)}
                        </span>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.6)' }}>
                          Created: {new Date(order.created_at).toLocaleString()}
                        </span>
                      </React.Fragment>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={<CompleteIcon />}
                      onClick={() => handleCompleteOrder(order.id)}
                    >
                      Complete
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingOrdersDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}