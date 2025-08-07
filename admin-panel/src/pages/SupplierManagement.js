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
  Switch,
  FormControlLabel,
  Grid,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ToggleOff as ToggleOffIcon,
  ToggleOn as ToggleOnIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function SupplierManagement() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    supplier_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    is_active: true,
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get('/suppliers');
      if (response.data.success) {
        setSuppliers(response.data.data);
      }
    } catch (error) {
      toast.error('Failed to fetch suppliers');
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({ ...supplier });
    } else {
      setEditingSupplier(null);
      setFormData({
        supplier_name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSupplier(null);
  };

  const handleInputChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async () => {
    try {
      if (!formData.supplier_name.trim()) {
        toast.error('Supplier name is required');
        return;
      }

      if (editingSupplier) {
        const response = await axios.put(`/suppliers/${editingSupplier.id}`, formData);
        if (response.data.success) {
          toast.success('Supplier updated successfully');
        }
      } else {
        const response = await axios.post('/suppliers', formData);
        if (response.data.success) {
          toast.success('Supplier created successfully');
        }
      }

      handleCloseDialog();
      fetchSuppliers();
    } catch (error) {
      toast.error('Failed to save supplier');
      console.error('Error saving supplier:', error);
    }
  };

  const handleToggleStatus = async (supplier) => {
    try {
      const response = await axios.patch(`/suppliers/${supplier.id}/toggle`);
      if (response.data.success) {
        toast.success(`Supplier ${supplier.is_active ? 'deactivated' : 'activated'} successfully`);
        fetchSuppliers();
      }
    } catch (error) {
      toast.error('Failed to toggle supplier status');
      console.error('Error toggling supplier status:', error);
    }
  };

  const handleDelete = async (supplier) => {
    if (window.confirm(`Are you sure you want to delete "${supplier.supplier_name}"?`)) {
      try {
        const response = await axios.delete(`/suppliers/${supplier.id}`);
        if (response.data.success) {
          toast.success('Supplier deleted successfully');
          fetchSuppliers();
        }
      } catch (error) {
        if (error.response?.status === 400) {
          toast.error(error.response.data.message || 'Cannot delete supplier with existing purchase orders');
        } else {
          toast.error('Failed to delete supplier');
        }
        console.error('Error deleting supplier:', error);
      }
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading suppliers...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" display="flex" alignItems="center" gap={1}>
          <BusinessIcon />
          Supplier Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Supplier
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {suppliers.length}
              </Typography>
              <Typography color="textSecondary">Total Suppliers</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {suppliers.filter(s => s.is_active).length}
              </Typography>
              <Typography color="textSecondary">Active Suppliers</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Suppliers Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Supplier Name</TableCell>
              <TableCell>Contact Person</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Alert severity="info" sx={{ mt: 2 }}>
                    No suppliers found. Add your first supplier to get started.
                  </Alert>
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {supplier.supplier_name}
                    </Typography>
                    {supplier.address && (
                      <Typography variant="caption" color="textSecondary" display="block">
                        {supplier.address}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{supplier.contact_person || '-'}</TableCell>
                  <TableCell>{supplier.phone || '-'}</TableCell>
                  <TableCell>{supplier.email || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={supplier.is_active ? 'Active' : 'Inactive'}
                      color={supplier.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(supplier)}
                        title="Edit"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleStatus(supplier)}
                        title={supplier.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {supplier.is_active ? (
                          <ToggleOnIcon color="primary" />
                        ) : (
                          <ToggleOffIcon />
                        )}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(supplier)}
                        title="Delete"
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Supplier Name"
                name="supplier_name"
                value={formData.supplier_name}
                onChange={handleInputChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contact Person"
                name="contact_person"
                value={formData.contact_person}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                name="address"
                multiline
                rows={2}
                value={formData.address}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                name="notes"
                multiline
                rows={3}
                value={formData.notes}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    name="is_active"
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingSupplier ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}