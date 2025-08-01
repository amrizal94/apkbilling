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
} from '@mui/icons-material';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';

export default function POSSystem() {
  const { emitNewOrder } = useSocket();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkoutDialog, setCheckoutDialog] = useState(false);
  const [orderForm, setOrderForm] = useState({
    customer_name: '',
    table_number: '',
    order_type: 'dine_in',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
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

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    toast.success(`${product.product_name} added to cart`);
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
        customer_name: orderForm.customer_name,
        table_number: orderForm.table_number,
        order_type: orderForm.order_type,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          notes: item.notes || '',
        })),
      };

      const response = await axios.post('/pos/orders', orderData);
      if (response.data.success) {
        toast.success(`Order ${response.data.data.order_number} created successfully!`);
        
        // Emit new order event
        emitNewOrder({
          order_number: response.data.data.order_number,
          customer_name: orderForm.customer_name,
          table_number: orderForm.table_number,
          total_amount: response.data.data.total_amount,
          item_count: getTotalItems(),
        });

        // Reset form and cart
        setCart([]);
        setOrderForm({ customer_name: '', table_number: '', order_type: 'dine_in' });
        setCheckoutDialog(false);
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create order';
      toast.error(message);
    }
  };

  const filteredProducts = products.filter(product =>
    product.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        POS System
      </Typography>

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
              {categories.map((category) => (
                <Tab
                  key={category.id}
                  label={category.category_name}
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
              {filteredProducts.map((product) => (
                <Grid item xs={12} sm={6} md={4} key={product.id}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': { boxShadow: 4 },
                      opacity: product.is_available ? 1 : 0.6,
                    }}
                    onClick={() => product.is_available && addToCart(product)}
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
                        {product.product_name.charAt(0)}
                      </Typography>
                    </CardMedia>
                    <CardContent>
                      <Typography variant="h6" noWrap>
                        {product.product_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {product.category_name}
                      </Typography>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                        <Typography variant="h6" color="primary">
                          {formatCurrency(product.price)}
                        </Typography>
                        <Chip
                          size="small"
                          label={product.stock_quantity > 0 ? `Stock: ${product.stock_quantity}` : 'Out of Stock'}
                          color={product.stock_quantity > 0 ? 'success' : 'error'}
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
                    {cart.map((item) => (
                      <ListItem key={item.id} divider>
                        <ListItemText
                          primary={item.product_name}
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
              {cart.map((item) => (
                <ListItem key={item.id}>
                  <ListItemText
                    primary={`${item.product_name} x ${item.quantity}`}
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
            value={orderForm.customer_name}
            onChange={(e) => setOrderForm({ ...orderForm, customer_name: e.target.value })}
            margin="normal"
          />

          <TextField
            fullWidth
            label="Table Number"
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
            disabled={!orderForm.customer_name || !orderForm.table_number}
          >
            Create Order
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}