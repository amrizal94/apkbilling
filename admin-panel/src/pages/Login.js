import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  AccountCircle,
  Lock,
  Computer,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, loading } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      setError('Please enter both username and password');
      return;
    }

    const result = await login(formData.username, formData.password);
    if (!result.success) {
      setError(result.message);
    }
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: '100vh',
          justifyContent: 'center',
        }}
      >
        <Paper
          elevation={6}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            maxWidth: 400,
          }}
        >
          {/* Logo/Icon */}
          <Box
            sx={{
              backgroundColor: 'primary.main',
              borderRadius: '50%',
              p: 2,
              mb: 2,
            }}
          >
            <Computer sx={{ fontSize: 40, color: 'white' }} />
          </Box>

          <Typography component="h1" variant="h4" gutterBottom align="center">
            APK Billing
          </Typography>
          
          <Typography variant="subtitle1" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Admin Panel
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="Username"
              name="username"
              autoComplete="username"
              autoFocus
              value={formData.username}
              onChange={handleChange}
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <AccountCircle />
                  </InputAdornment>
                ),
              }}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleTogglePassword}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </Box>

          {/* Development Info */}
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Default Login:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Username: <strong>admin</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Password: <strong>admin123</strong>
            </Typography>
          </Box>

          {/* Version Info */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 2, textAlign: 'center' }}
          >
            APK Billing System v1.0.0
            <br />
            {process.env.REACT_APP_ENV === 'development' && 'Development Mode'}
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}