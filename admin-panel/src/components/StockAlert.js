import React, { useState, forwardRef } from 'react';
import {
  IconButton,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Divider,
  Chip,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Inventory as InventoryIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

const StockAlert = forwardRef(({ lowStockItems = [], onRefresh = () => {}, threshold = 15, ...props }, ref) => {
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const getStockLevel = (quantity) => {
    if (quantity <= 5) return 'critical';
    if (quantity <= 10) return 'low';
    return 'warning';
  };

  const getStockColor = (level) => {
    switch (level) {
      case 'critical': return 'error';
      case 'low': return 'warning';
      case 'warning': return 'info';
      default: return 'default';
    }
  };

  const sortedItems = [...lowStockItems].sort((a, b) => a.stock_quantity - b.stock_quantity);

  return (
    <>
      <IconButton
        ref={ref}
        color="inherit"
        onClick={handleOpen}
        sx={{
          color: lowStockItems.length > 0 ? 'warning.main' : 'inherit',
        }}
        {...props}
      >
        <Badge 
          badgeContent={lowStockItems.length} 
          color="error"
          max={99}
        >
          <WarningIcon />
        </Badge>
      </IconButton>

      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center">
              <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
              Stock Alerts
            </Box>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {lowStockItems.length === 0 ? (
            <Box 
              display="flex" 
              flexDirection="column" 
              alignItems="center" 
              py={4}
            >
              <InventoryIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" color="success.main" gutterBottom>
                All Stock Levels Good!
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No products are currently running low on stock.
              </Typography>
            </Box>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {lowStockItems.length} product{lowStockItems.length > 1 ? 's' : ''} need restocking (threshold: ≤{threshold})
              </Typography>
              
              <List>
                {sortedItems.map((item, index) => {
                  const stockLevel = getStockLevel(item.stock_quantity);
                  return (
                    <React.Fragment key={item.id || index}>
                      <ListItem>
                        <ListItemIcon>
                          <InventoryIcon color={getStockColor(stockLevel)} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                              <Typography variant="subtitle1">
                                {item.product_name}
                              </Typography>
                              <Chip
                                label={`${item.stock_quantity} left`}
                                size="small"
                                color={getStockColor(stockLevel)}
                                variant={stockLevel === 'critical' ? 'filled' : 'outlined'}
                              />
                            </Box>
                          }
                          secondary={
                            <span style={{ display: 'block', marginTop: '4px' }}>
                              <span style={{ fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.6)' }}>
                                Category: {item.category_name || 'Unknown'} • 
                                Price: Rp {item.price?.toLocaleString('id-ID') || 'N/A'}
                              </span>
                              {stockLevel === 'critical' && (
                                <span style={{ 
                                  fontSize: '0.75rem', 
                                  color: '#d32f2f', 
                                  display: 'block' 
                                }}>
                                  ⚠️ Critical: Immediate restocking required
                                </span>
                              )}
                            </span>
                          }
                        />
                      </ListItem>
                      {index < sortedItems.length - 1 && <Divider />}
                    </React.Fragment>
                  );
                })}
              </List>
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onRefresh} variant="outlined">
            Refresh
          </Button>
          <Button onClick={handleClose} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

StockAlert.displayName = 'StockAlert';

export default StockAlert;