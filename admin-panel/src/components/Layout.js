import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Tv as TvIcon,
  PointOfSale as PosIcon,
  Assessment as ReportsIcon,
  Restaurant as RestaurantIcon,
  Settings as SettingsIcon,
  AccountCircle,
  Logout,
  WifiOff,
  Wifi,
  Business as BusinessIcon,
  ShoppingCart as ShoppingCartIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import BellNotification from './BellNotification';
import StockAlert from './StockAlert';

const drawerWidth = 240;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'TV Management', icon: <TvIcon />, path: '/tv-management' },
  { text: 'Package Management', icon: <PosIcon />, path: '/packages' },
  { text: 'POS System', icon: <RestaurantIcon />, path: '/pos' },
  { text: 'Suppliers', icon: <BusinessIcon />, path: '/suppliers' },
  { text: 'Purchase Orders', icon: <ShoppingCartIcon />, path: '/purchases' },
  { text: 'Stock Movements', icon: <InventoryIcon />, path: '/stock-movements' },
  { text: 'Reports', icon: <ReportsIcon />, path: '/reports' },
  { text: 'User Management', icon: <PeopleIcon />, path: '/user-management' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { connected, activeSessions, pendingOrders, pendingPurchaseOrders, lowStockItems, stockThreshold, refreshPendingOrders, clearPendingOrders, refreshLowStockItems } = useSocket();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  const handleNavigation = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const getPageTitle = () => {
    const currentItem = menuItems.find(item => item.path === location.pathname);
    return currentItem ? currentItem.text : 'APK Billing';
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
          APK Billing
        </Typography>
      </Toolbar>
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                },
              }}
            >
              <ListItemIcon>
                {item.text === 'POS System' ? (
                  <Badge badgeContent={pendingOrders.length} color="error">
                    {item.icon}
                  </Badge>
                ) : item.text === 'Purchase Orders' ? (
                  <Badge badgeContent={pendingPurchaseOrders.length} color="error">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {getPageTitle()}
          </Typography>

          {/* Connection Status */}
          <Tooltip title={connected ? 'Real-time connected' : 'Real-time disconnected'}>
            <IconButton color="inherit">
              {connected ? <Wifi /> : <WifiOff />}
            </IconButton>
          </Tooltip>

          {/* Active Sessions Badge */}
          {activeSessions.length > 0 && (
            <Tooltip title={`${activeSessions.length} active TV sessions`}>
              <IconButton color="inherit">
                <Badge badgeContent={activeSessions.length} color="secondary">
                  <TvIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          )}

          {/* Stock Alert */}
          <Tooltip title={`${lowStockItems.length} items low on stock - Click to view details`}>
            <StockAlert 
              lowStockItems={lowStockItems}
              threshold={stockThreshold}
              onRefresh={refreshLowStockItems}
            />
          </Tooltip>

          {/* Interactive Bell Notification */}
          <Tooltip title={`${pendingOrders.length + pendingPurchaseOrders.length} pending orders (${pendingOrders.length} POS, ${pendingPurchaseOrders.length} Purchase) - Click to refresh, Ctrl+Click to clear`}>
            <IconButton 
              color="inherit"
              onClick={(e) => {
                console.log('🔔 Bell clicked - Current pending orders:', pendingOrders);
                console.log('🔔 Bell clicked - Current pending purchase orders:', pendingPurchaseOrders);
                console.log('🔔 Total pending count:', pendingOrders.length + pendingPurchaseOrders.length);
                if (e.ctrlKey) {
                  console.log('🔔 Ctrl+Click detected - clearing pending orders');
                  clearPendingOrders();
                } else {
                  refreshPendingOrders();
                }
              }}
            >
              <BellNotification
                notificationCount={pendingOrders.length + pendingPurchaseOrders.length}
              />
            </IconButton>
          </Tooltip>

          {/* User Menu */}
          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenuClick}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
              {(user?.fullName || user?.full_name)?.charAt(0) || 'U'}
            </Avatar>
          </IconButton>
          
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleMenuClose} disabled>
              <AccountCircle sx={{ mr: 1 }} />
              {user?.fullName || user?.full_name}
            </MenuItem>
            <MenuItem onClick={handleMenuClose} disabled>
              <Typography variant="body2" color="text.secondary">
                {user?.role?.roleName?.toUpperCase() || user?.role_name?.toUpperCase() || user?.role?.toUpperCase?.() || 'USER'}
              </Typography>
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}