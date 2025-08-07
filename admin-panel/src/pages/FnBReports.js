import React, { useState, useEffect } from 'react';
import {
    Container,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Box,
    Grid,
    Card,
    CardContent,
    TextField,
    Button,
    Chip,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    IconButton
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';

const FnBReports = () => {
    const [orders, setOrders] = useState([]);
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedOrderItems, setSelectedOrderItems] = useState('');

    const fetchReports = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            
            const response = await fetch(`/api/reports/fnb-unified?${params}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to fetch reports');
            
            const data = await response.json();
            setOrders(data.data.orders);
            setSummary(data.data.summary);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR'
        }).format(amount);
    };

    const formatDateTime = (dateTime) => {
        return new Date(dateTime).toLocaleString('id-ID', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };


    const handleViewDetails = (itemsDetail) => {
        setSelectedOrderItems(itemsDetail);
        setDetailModalOpen(true);
    };

    const parseItemsDetail = (itemsDetail) => {
        if (!itemsDetail || itemsDetail === '-') return [];
        
        // If it's already an array, return it
        if (Array.isArray(itemsDetail)) return itemsDetail;
        
        // If it's an object, wrap it in array
        if (typeof itemsDetail === 'object') return [itemsDetail];
        
        // If it's a string, try to parse
        if (typeof itemsDetail === 'string') {
            try {
                // Try to parse as JSON first
                const parsed = JSON.parse(itemsDetail);
                if (Array.isArray(parsed)) return parsed;
                if (typeof parsed === 'object') return [parsed];
                return [];
            } catch {
                // If not JSON, treat as comma-separated string
                return itemsDetail.split(', ').map(item => ({ name: item }));
            }
        }
        
        return [];
    };

    return (
        <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
                <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
                    Laporan F&B Terpadu
                </Typography>

                {/* Summary Cards */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={4}>
                        <Card>
                            <CardContent>
                                <Box display="flex" alignItems="center">
                                    <RestaurantIcon color="primary" sx={{ mr: 1 }} />
                                    <Box>
                                        <Typography color="textSecondary" gutterBottom>
                                            Total Pesanan
                                        </Typography>
                                        <Typography variant="h5">
                                            {summary.total_orders || 0}
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={4}>
                        <Card>
                            <CardContent>
                                <Box display="flex" alignItems="center">
                                    <TrendingUpIcon color="success" sx={{ mr: 1 }} />
                                    <Box>
                                        <Typography color="textSecondary" gutterBottom>
                                            Total Pendapatan
                                        </Typography>
                                        <Typography variant="h5" color="success.main">
                                            {formatCurrency(summary.total_revenue || 0)}
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={4}>
                        <Card>
                            <CardContent>
                                <Box display="flex" alignItems="center">
                                    <TrendingUpIcon color="info" sx={{ mr: 1 }} />
                                    <Box>
                                        <Typography color="textSecondary" gutterBottom>
                                            Rata-rata per Order
                                        </Typography>
                                        <Typography variant="h5" color="info.main">
                                            {formatCurrency(summary.total_orders > 0 ? summary.total_revenue / summary.total_orders : 0)}
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Filters */}
                <Paper sx={{ p: 2, mb: 3 }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={4}>
                            <TextField
                                label="Tanggal Mulai"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                fullWidth
                                InputLabelProps={{
                                    shrink: true,
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                label="Tanggal Akhir"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                fullWidth
                                InputLabelProps={{
                                    shrink: true,
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Button
                                variant="contained"
                                onClick={fetchReports}
                                disabled={loading}
                                fullWidth
                            >
                                {loading ? 'Loading...' : 'Filter'}
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Orders Table */}
                <Paper>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Tanggal</TableCell>
                                    <TableCell>Referensi</TableCell>
                                    <TableCell>Device/Customer</TableCell>
                                    <TableCell>Items</TableCell>
                                    <TableCell align="right">Total</TableCell>
                                    <TableCell>Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {orders.map((order) => (
                                    <TableRow key={`${order.id}`}>
                                        <TableCell>
                                            {formatDateTime(order.created_at)}
                                        </TableCell>
                                        <TableCell>{order.reference}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight="bold">
                                                {order.device_name || order.customer_name || (order.table_number ? `Meja ${order.table_number}` : '-')}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <Typography variant="body2" sx={{ maxWidth: 200, wordBreak: 'break-word' }}>
                                                    {(() => {
                                                        try {
                                                            const items = parseItemsDetail(order.items_detail);
                                                            if (items.length === 0) return '-';
                                                            
                                                            const firstItem = items[0];
                                                            const itemName = firstItem.product_name || firstItem.name || 'Item';
                                                            const itemQty = firstItem.quantity || 1;
                                                            
                                                            if (items.length === 1) {
                                                                return `${itemName} x${itemQty}`;
                                                            } else {
                                                                return `${itemName} x${itemQty} +${items.length - 1} lainnya`;
                                                            }
                                                        } catch (error) {
                                                            console.error('Error parsing items:', error);
                                                            return 'Error loading items';
                                                        }
                                                    })()}
                                                </Typography>
                                                {(() => {
                                                    try {
                                                        return order.items_detail && order.items_detail !== '-' && parseItemsDetail(order.items_detail).length > 0;
                                                    } catch {
                                                        return false;
                                                    }
                                                })() && (
                                                    <IconButton 
                                                        size="small" 
                                                        onClick={() => handleViewDetails(order.items_detail)}
                                                        color="primary"
                                                    >
                                                        <VisibilityIcon fontSize="small" />
                                                    </IconButton>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography variant="body2" fontWeight="bold">
                                                {formatCurrency(order.total_amount)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip 
                                                label={order.status === 'completed' ? 'Selesai' : 
                                                      order.status === 'pending' ? 'Pending' :
                                                      order.status === 'preparing' ? 'Diproses' :
                                                      order.status === 'ready' ? 'Siap' : order.status}
                                                color={order.status === 'completed' ? 'success' : 'default'}
                                                size="small"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {orders.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={8} align="center">
                                            <Typography color="textSecondary">
                                                Tidak ada data pesanan
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>

                {/* Detail Modal */}
                <Dialog
                    open={detailModalOpen}
                    onClose={() => setDetailModalOpen(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                            Detail Pesanan
                            <IconButton onClick={() => setDetailModalOpen(false)}>
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    </DialogTitle>
                    <DialogContent>
                        <List>
                            {parseItemsDetail(selectedOrderItems).map((item, index) => (
                                <ListItem key={index} divider>
                                    <ListItemText
                                        primary={item.product_name || item.name}
                                        secondary={
                                            item.quantity && item.price ? (
                                                `${item.quantity} x ${formatCurrency(item.price)} = ${formatCurrency(item.subtotal || (item.quantity * item.price))}`
                                            ) : null
                                        }
                                    />
                                </ListItem>
                            ))}
                            {parseItemsDetail(selectedOrderItems).length === 0 && (
                                <ListItem>
                                    <ListItemText primary="Tidak ada detail item" />
                                </ListItem>
                            )}
                        </List>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDetailModalOpen(false)}>
                            Tutup
                        </Button>
                    </DialogActions>
                </Dialog>
        </Container>
    );
};

export default FnBReports;