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

### Android TV App
- System overlay billing
- Remote power control
- Menu ordering interface
- Advertisement display

### Backend API
- RESTful API
- WebSocket real-time
- Database management
- Authentication & authorization

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

## 📚 Documentation

- `CONFIG_GUIDE.md` - Complete configuration guide
- `database/migrations/` - Database schema & migrations
- `database/seeds/` - Initial data setup