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
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ToggleOff as ToggleOffIcon,
  ToggleOn as ToggleOnIcon,
  People as PeopleIcon,
  Security as SecurityIcon,
  Key as KeyIcon,
} from '@mui/icons-material';
import axios from 'axios';
import toast from 'react-hot-toast';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`user-tabpanel-${index}`}
      aria-labelledby={`user-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function UserManagement() {
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userDialog, setUserDialog] = useState({ open: false, user: null, mode: 'create' });
  const [passwordDialog, setPasswordDialog] = useState({ open: false, user: null });
  
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    full_name: '',
    role_id: '',
    is_active: true,
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersResponse, rolesResponse] = await Promise.all([
        axios.get('/users'),
        axios.get('/users/roles')
      ]);

      if (usersResponse.data.success) {
        // Handle nested response structure from clean architecture
        const userData = usersResponse.data.data;
        if (userData && userData.data && userData.data.users) {
          setUsers(userData.data.users);
        } else if (Array.isArray(userData)) {
          setUsers(userData);
        } else {
          setUsers([]);
        }
      }
      if (rolesResponse.data.success) {
        setRoles(rolesResponse.data.data || []);
      }
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Access denied. Super Admin permission required.');
      } else {
        toast.error('Failed to fetch data');
      }
      console.error('Error fetching data:', error);
      // Ensure arrays are set even on error
      setUsers([]);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUserDialog = (user = null, mode = 'create') => {
    if (user) {
      setUserForm({
        username: user.username || '',
        password: '', // Never populate password
        full_name: user.full_name || '',
        role_id: user.role_id || '',
        is_active: user.is_active ?? true,
      });
    } else {
      setUserForm({
        username: '',
        password: '',
        full_name: '',
        role_id: '',
        is_active: true,
      });
    }
    setUserDialog({ open: true, user, mode });
  };

  const handleCloseUserDialog = () => {
    setUserDialog({ open: false, user: null, mode: 'create' });
    setUserForm({
      username: '',
      password: '',
      full_name: '',
      role_id: '',
      is_active: true,
    });
  };

  const handleUserFormChange = (e) => {
    const { name, value, checked, type } = e.target;
    setUserForm({
      ...userForm,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleUserSubmit = async () => {
    try {
      const { mode, user } = userDialog;
      
      if (!userForm.username || !userForm.full_name) {
        toast.error('Username and full name are required');
        return;
      }

      if (mode === 'create' && !userForm.password) {
        toast.error('Password is required for new users');
        return;
      }

      const payload = { ...userForm };
      if (mode === 'edit' && !payload.password) {
        delete payload.password; // Don't send empty password on edit
      }

      let response;
      if (mode === 'create') {
        response = await axios.post('/users', payload);
      } else {
        response = await axios.put(`/users/${user.id}`, payload);
      }

      if (response.data.success) {
        toast.success(`User ${mode === 'create' ? 'created' : 'updated'} successfully`);
        handleCloseUserDialog();
        fetchData();
      }
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error(error.response.data.message || 'Invalid data provided');
      } else if (error.response?.status === 403) {
        toast.error('Access denied. Super Admin permission required.');
      } else {
        toast.error(`Failed to ${userDialog.mode} user`);
      }
      console.error('Error saving user:', error);
    }
  };

  const handleToggleUserStatus = async (user) => {
    try {
      const response = await axios.patch(`/users/${user.id}/toggle`);
      if (response.data.success) {
        toast.success(response.data.message);
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to toggle user status');
      console.error('Error toggling user status:', error);
    }
  };

  const handleDeleteUser = async (user) => {
    if (window.confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      try {
        const response = await axios.delete(`/users/${user.id}`);
        if (response.data.success) {
          toast.success(response.data.message);
          fetchData();
        }
      } catch (error) {
        if (error.response?.status === 400) {
          toast.error(error.response.data.message);
        } else {
          toast.error('Failed to delete user');
        }
        console.error('Error deleting user:', error);
      }
    }
  };

  const handleOpenPasswordDialog = (user) => {
    setPasswordDialog({ open: true, user });
    setPasswordForm({
      current_password: '',
      new_password: '',
      confirm_password: '',
    });
  };

  const handleClosePasswordDialog = () => {
    setPasswordDialog({ open: false, user: null });
    setPasswordForm({
      current_password: '',
      new_password: '',
      confirm_password: '',
    });
  };

  const handlePasswordChange = async () => {
    try {
      if (passwordForm.new_password !== passwordForm.confirm_password) {
        toast.error('New passwords do not match');
        return;
      }

      if (passwordForm.new_password.length < 6) {
        toast.error('Password must be at least 6 characters long');
        return;
      }

      const response = await axios.patch(`/users/${passwordDialog.user.id}/password`, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });

      if (response.data.success) {
        toast.success('Password updated successfully');
        handleClosePasswordDialog();
      }
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to update password');
      }
      console.error('Error updating password:', error);
    }
  };

  const getRoleColor = (roleName) => {
    switch (roleName) {
      case 'super_admin': return 'error';
      case 'manager': return 'warning';
      case 'cashier': return 'primary';
      case 'kitchen_staff': return 'info';
      case 'viewer': return 'default';
      default: return 'default';
    }
  };

  const getRoleDisplayName = (roleName) => {
    const roleMap = {
      'super_admin': 'Super Admin',
      'manager': 'Manager',
      'cashier': 'Cashier',
      'kitchen_staff': 'Kitchen Staff',
      'viewer': 'Viewer',
    };
    return roleMap[roleName] || roleName;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading user management...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" display="flex" alignItems="center" gap={1}>
          <PeopleIcon />
          User Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenUserDialog()}
        >
          Add User
        </Button>
      </Box>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Users" icon={<PeopleIcon />} />
            <Tab label="Roles & Permissions" icon={<SecurityIcon />} />
          </Tabs>
        </Box>

        {/* Users Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {Array.isArray(users) ? users.length : 0}
                  </Typography>
                  <Typography color="textSecondary">Total Users</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {Array.isArray(users) ? users.filter(u => u.is_active || u.isActive).length : 0}
                  </Typography>
                  <Typography color="textSecondary">Active Users</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Username</TableCell>
                  <TableCell>Full Name</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!Array.isArray(users) || users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Alert severity="info">No users found.</Alert>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {user.username}
                        </Typography>
                      </TableCell>
                      <TableCell>{user.full_name || user.fullName}</TableCell>
                      <TableCell>
                        <Chip
                          label={getRoleDisplayName(user.role_name || user.role?.roleName)}
                          color={getRoleColor(user.role_name || user.role?.roleName)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={(user.is_active || user.isActive) ? 'Active' : 'Inactive'}
                          color={(user.is_active || user.isActive) ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at || user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={1}>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenUserDialog(user, 'edit')}
                            title="Edit User"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenPasswordDialog(user)}
                            title="Change Password"
                            color="info"
                          >
                            <KeyIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleToggleUserStatus(user)}
                            title={(user.is_active || user.isActive) ? 'Deactivate' : 'Activate'}
                          >
                            {(user.is_active || user.isActive) ? (
                              <ToggleOnIcon color="primary" />
                            ) : (
                              <ToggleOffIcon />
                            )}
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteUser(user)}
                            title="Delete User"
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Roles Tab */}
        <TabPanel value={tabValue} index={1}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Role permissions are pre-configured for security. Contact system administrator for custom roles.
          </Alert>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Role Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Key Permissions</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Array.isArray(roles) ? roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <Chip
                        label={getRoleDisplayName(role.role_name)}
                        color={getRoleColor(role.role_name)}
                      />
                    </TableCell>
                    <TableCell>{role.role_description}</TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {role.permissions && typeof role.permissions === 'object' ? 
                          Object.entries(role.permissions).filter(([key, value]) => value === true).slice(0, 3).map(([key, value]) => (
                            <Chip
                              key={key}
                              label={key.replace('_', ' ')}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          )) : null}
                        {role.permissions && typeof role.permissions === 'object' && 
                         Object.entries(role.permissions).filter(([key, value]) => value === true).length > 3 && (
                          <Chip label="..." size="small" variant="outlined" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={role.is_active ? 'Active' : 'Inactive'}
                        color={role.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Alert severity="info">No roles found.</Alert>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Card>

      {/* Add/Edit User Dialog */}
      <Dialog open={userDialog.open} onClose={handleCloseUserDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {userDialog.mode === 'create' ? 'Add New User' : 'Edit User'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Username"
                name="username"
                value={userForm.username}
                onChange={handleUserFormChange}
                required
              />
            </Grid>
            {userDialog.mode === 'create' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Password"
                  name="password"
                  type="password"
                  value={userForm.password}
                  onChange={handleUserFormChange}
                  required
                  helperText="Minimum 6 characters"
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Full Name"
                name="full_name"
                value={userForm.full_name}
                onChange={handleUserFormChange}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Role"
                name="role_id"
                value={userForm.role_id}
                onChange={handleUserFormChange}
                required
              >
                {Array.isArray(roles) ? roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {getRoleDisplayName(role.role_name)} - {role.role_description}
                  </MenuItem>
                )) : null}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={userForm.is_active}
                    onChange={handleUserFormChange}
                    name="is_active"
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUserDialog}>Cancel</Button>
          <Button onClick={handleUserSubmit} variant="contained">
            {userDialog.mode === 'create' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialog.open} onClose={handleClosePasswordDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password - {passwordDialog.user?.username}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Current Password"
                name="current_password"
                type="password"
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})}
                helperText="Required for security verification"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="New Password"
                name="new_password"
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
                helperText="Minimum 6 characters"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Confirm New Password"
                name="confirm_password"
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePasswordDialog}>Cancel</Button>
          <Button onClick={handlePasswordChange} variant="contained" color="primary">
            Change Password
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}