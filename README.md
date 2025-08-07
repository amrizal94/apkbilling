# APK Billing - Sistem POS & Billing TV Android

Sistem lengkap untuk manajemen billing TV Android dan POS cafe dengan panel admin web.

## Struktur Project

```
apkbilling/
├── backend/                 # API Backend (Node.js/Express)
├── admin-panel/            # Panel Admin Web (React)
├── android-tv-app/         # Aplikasi Android TV
├── database/               # Schema & Migration
└── docs/                   # Dokumentasi
```

## Fitur Utama

### Panel Admin Web
- Dashboard real-time monitoring TV
- Manajemen billing & tarif
- POS sistem cafe
- Laporan & analytics
- Customization branding
- **Role-based access control (RBAC)**
- **User management system**
- **Supplier & purchase management**

### Android TV App
- System overlay billing
- Remote power control
- Menu ordering interface
- Advertisement display

### Backend API
- RESTful API
- WebSocket real-time
- Database management
- **Advanced authentication & role-based authorization**
- **Multi-level permission system**

## Teknologi Stack

- **Backend**: Node.js, Express, Socket.io, PostgreSQL
- **Admin Panel**: React, Material-UI, Chart.js  
- **Android TV**: Java/Kotlin, System UI API
- **Database**: PostgreSQL dengan Redis cache
- **Containerization**: Docker & Docker Compose
- **Migration**: Auto database & table creation

## 🚀 Quick Start

### Option 1: Configuration Wizard (Recommended)
```bash
# Interactive setup wizard
./scripts/config-wizard.sh
```

### Option 2: Manual Setup

**Development:**
```bash
# Copy environment files
cp backend/.env.development backend/.env
cp admin-panel/.env.development admin-panel/.env

# Start development environment
./scripts/dev-setup.sh
```

**Production:**
```bash
# Copy environment files  
cp .env.production backend/.env
cp admin-panel/.env.production admin-panel/.env

# Edit with your settings
nano backend/.env
nano admin-panel/.env

# Deploy to production
sudo ./scripts/prod-deploy.sh
```

## 📱 Access URLs

**Development:**
- Admin Panel: http://localhost:3001
- Backend API: http://localhost:3000/api
- API Docs: http://localhost:3000/api-docs

**Production:**
- Admin Panel: http://localhost:8080
- Backend API: http://localhost:3000/api

**Default Login:**
- Username: `admin`
- Password: `admin123` (change after first login!)

## 🔧 Configuration Files

- `backend/.env` - Backend configuration
- `admin-panel/.env` - Frontend configuration
- `CONFIG_GUIDE.md` - Detailed configuration guide

## 📊 System Capacity

**Concurrent TV Clients:**
- **2GB RAM, 2 Core**: ~50-100 TV
- **4GB RAM, 4 Core**: ~200-300 TV  
- **8GB RAM, 8 Core**: ~500-1000 TV

## 🛠️ Management Commands

```bash
# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop services  
docker-compose down

# Update system
git pull && ./scripts/prod-deploy.sh

# Database access
docker exec -it apkbilling_postgres psql -U apkbilling_user -d apkbilling
```

## 🔐 Role-Based Access Control

Sistem ini menggunakan RBAC dengan 5 level user:

### User Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Super Admin** | Full system access | User management, system settings, all operations |
| **Manager** | Operational management | Reports, inventory, staff oversight (no user management) |
| **Cashier** | Daily operations | TV/POS operations, basic reports |
| **Kitchen Staff** | F&B operations only | Kitchen orders, menu management |
| **Viewer** | Read-only access | View reports and monitoring only |

### Permission Matrix

| Permission | Super Admin | Manager | Cashier | Kitchen Staff | Viewer |
|------------|-------------|---------|---------|---------------|---------|
| User Management | ✓ | ✗ | ✗ | ✗ | ✗ |
| System Settings | ✓ | ✗ | ✗ | ✗ | ✗ |
| TV Management | ✓ | ✓ | ✓ | ✗ | View Only |
| POS Operations | ✓ | ✓ | ✓ | ✗ | View Only |
| F&B Management | ✓ | ✓ | Basic | ✓ | View Only |
| Supplier Management | ✓ | ✓ | ✗ | ✗ | View Only |
| Purchase Orders | ✓ | ✓ | ✗ | ✗ | View Only |
| Reports | ✓ | ✓ | Basic | View Only | View Only |
| Package Management | ✓ | ✓ | ✗ | ✗ | View Only |

### Managing Users

1. **Login as Super Admin** (default: `admin` / `admin123`)
2. **Navigate to User Management** in the admin panel
3. **Create Users**: Set username, password, full name, and assign role
4. **Manage Permissions**: Each role has pre-configured permissions for security
5. **Monitor Access**: View user activity and manage active sessions

### Security Features

- **JWT-based authentication** with role verification
- **Route-level protection** with middleware
- **Session management** with automatic cleanup
- **Password security** with bcrypt hashing
- **Audit logging** for user actions
- **Automatic role inheritance** for permission checking

### API Authentication

All API endpoints require authentication:

```bash
# Login to get JWT token
POST /api/auth/login
{
  "username": "your_username",
  "password": "your_password"
}

# Use token in subsequent requests
Authorization: Bearer <your_jwt_token>
```

### Default Users

After installation, only one Super Admin account exists:
- **Username**: `admin`
- **Password**: `admin123`

**⚠️ Important**: Change the default password immediately after first login!

### Troubleshooting RBAC

1. **Access Denied Errors**: Check user role and required permissions
2. **Token Expired**: Re-login to get new JWT token
3. **Permission Issues**: Verify role assignments match job requirements
4. **User Creation Fails**: Ensure Super Admin privileges for user management

## 📚 Documentation

- `CONFIG_GUIDE.md` - Complete configuration guide
- `database/migrations/` - Database schema & migrations
- `database/seeds/` - Initial data setup