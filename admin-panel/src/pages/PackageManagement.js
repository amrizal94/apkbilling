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
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Switch,
    FormControlLabel,
    Box,
    Chip,
    IconButton,
    Alert,
    Snackbar
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    ToggleOff as ToggleOffIcon,
    ToggleOn as ToggleOnIcon
} from '@mui/icons-material';
import axios from 'axios';

const PackageManagement = () => {
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingPackage, setEditingPackage] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        duration_minutes: '',
        price: '',
        is_active: true
    });

    useEffect(() => {
        fetchPackages();
    }, []);

    const fetchPackages = async () => {
        try {
            const response = await axios.get('/packages');
            if (response.data.success) {
                setPackages(response.data.packages);
            }
        } catch (error) {
            showSnackbar('Failed to fetch packages', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showSnackbar = (message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const handleOpenDialog = (pkg = null) => {
        if (pkg) {
            setEditingPackage(pkg);
            setFormData({
                name: pkg.name,
                description: pkg.description || '',
                duration_minutes: pkg.duration_minutes.toString(),
                price: pkg.price.toString(),
                is_active: pkg.is_active
            });
        } else {
            setEditingPackage(null);
            setFormData({
                name: '',
                description: '',
                duration_minutes: '',
                price: '',
                is_active: true
            });
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingPackage(null);
        setFormData({
            name: '',
            description: '',
            duration_minutes: '',
            price: '',
            is_active: true
        });
    };

    const handleInputChange = (e) => {
        const { name, value, checked, type } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };

    const handleSubmit = async () => {
        try {
            const data = {
                ...formData,
                duration_minutes: parseInt(formData.duration_minutes),
                price: parseFloat(formData.price)
            };

            if (editingPackage) {
                await axios.put(`/packages/${editingPackage.id}`, data);
                showSnackbar('Package updated successfully', 'success');
            } else {
                await axios.post('/packages', data);
                showSnackbar('Package created successfully', 'success');
            }

            handleCloseDialog();
            fetchPackages();
        } catch (error) {
            showSnackbar('Failed to save package', 'error');
        }
    };

    const handleToggleStatus = async (pkg) => {
        try {
            await axios.patch(`/api/packages/${pkg.id}/toggle`);
            showSnackbar(`Package ${pkg.is_active ? 'deactivated' : 'activated'} successfully`, 'success');
            fetchPackages();
        } catch (error) {
            showSnackbar('Failed to toggle package status', 'error');
        }
    };

    const handleDelete = async (pkg) => {
        if (window.confirm(`Are you sure you want to delete "${pkg.name}"?`)) {
            try {
                await axios.delete(`/packages/${pkg.id}`);
                showSnackbar('Package deleted successfully', 'success');
                fetchPackages();
            } catch (error) {
                showSnackbar('Failed to delete package', 'error');
            }
        }
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price);
    };

    const formatDuration = (minutes) => {
        if (minutes === 0) return 'Open Bill';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0 && mins > 0) {
            return `${hours}h ${mins}m`;
        } else if (hours > 0) {
            return `${hours}h`;
        } else {
            return `${mins}m`;
        }
    };

    if (loading) {
        return (
            <Container>
                <Typography>Loading packages...</Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" component="h1">
                    Package Management
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                >
                    Add Package
                </Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Duration</TableCell>
                            <TableCell>Price</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {packages.map((pkg) => (
                            <TableRow key={pkg.id}>
                                <TableCell>
                                    <Typography variant="subtitle2">
                                        {pkg.name}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" color="textSecondary">
                                        {pkg.description || '-'}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">
                                        {formatDuration(pkg.duration_minutes)}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" fontWeight="bold">
                                        {pkg.duration_minutes === 0 ? 
                                            `${formatPrice(pkg.price)}/min` : 
                                            formatPrice(pkg.price)
                                        }
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={pkg.is_active ? 'Active' : 'Inactive'}
                                        color={pkg.is_active ? 'success' : 'default'}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Box display="flex" gap={1}>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleOpenDialog(pkg)}
                                            title="Edit"
                                        >
                                            <EditIcon />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleToggleStatus(pkg)}
                                            title={pkg.is_active ? 'Deactivate' : 'Activate'}
                                        >
                                            {pkg.is_active ? <ToggleOnIcon color="primary" /> : <ToggleOffIcon />}
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleDelete(pkg)}
                                            title="Delete"
                                            color="error"
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Add/Edit Dialog */}
            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingPackage ? 'Edit Package' : 'Add New Package'}
                </DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={2} mt={1}>
                        <TextField
                            label="Package Name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            fullWidth
                            required
                        />
                        <TextField
                            label="Description"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            fullWidth
                            multiline
                            rows={2}
                        />
                        <TextField
                            label="Duration (minutes)"
                            name="duration_minutes"
                            type="number"
                            value={formData.duration_minutes}
                            onChange={handleInputChange}
                            fullWidth
                            required
                            helperText="Use 0 for open bill packages"
                        />
                        <TextField
                            label={formData.duration_minutes === '0' ? 'Rate per minute (IDR)' : 'Price (IDR)'}
                            name="price"
                            type="number"
                            value={formData.price}
                            onChange={handleInputChange}
                            fullWidth
                            required
                        />
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
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button onClick={handleSubmit} variant="contained">
                        {editingPackage ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default PackageManagement;