# 🔧 APK Billing System - Configuration Guide

Panduan lengkap untuk konfigurasi sistem APK Billing dengan berbagai environment dan kebutuhan bisnis.

## 📁 File Konfigurasi

### Backend Environment Files
- `.env.example` - Template konfigurasi dengan semua opsi tersedia
- `.env.development` - Konfigurasi untuk development/testing
- `.env.production` - Konfigurasi untuk production/live system

### Admin Panel Environment Files
- `admin-panel/.env.example` - Template konfigurasi frontend
- `admin-panel/.env.development` - Konfigurasi development frontend
- `admin-panel/.env.production` - Konfigurasi production frontend

## 🚀 Quick Setup

### 1. Setup Development Environment
```bash
# Copy dan edit file konfigurasi
cp backend/.env.development backend/.env
cp admin-panel/.env.development admin-panel/.env

# Edit sesuai kebutuhan
nano backend/.env
nano admin-panel/.env

# Jalankan development
./scripts/dev-setup.sh
```

### 2. Setup Production Environment
```bash
# Copy dan edit file konfigurasi
cp .env.production backend/.env
cp admin-panel/.env.production admin-panel/.env

# Edit dengan data production
nano backend/.env
nano admin-panel/.env

# Deploy ke production
sudo ./scripts/prod-deploy.sh
```

## ⚙️ Konfigurasi Utama

### 🗄️ Database Configuration
```env
# PostgreSQL Database
DB_HOST=localhost                    # Database host
DB_PORT=5432                        # Database port
DB_NAME=apkbilling                  # Nama database
DB_USER=apkbilling_user             # Username database
DB_PASSWORD=strong_password         # Password database
DB_MAX_CONNECTIONS=20               # Max koneksi pool
```

### 🏢 Business Configuration
```env
# Informasi Bisnis
BUSINESS_NAME=Warnet & Cafe Anda
BUSINESS_ADDRESS=Jl. Utama No. 123, Jakarta
BUSINESS_PHONE=021-12345678
BUSINESS_EMAIL=info@warnetanda.com

# Mata Uang & Harga
CURRENCY=IDR                        # Mata uang
CURRENCY_SYMBOL=Rp                  # Simbol mata uang
TAX_RATE=0.11                       # Pajak (11%)
SERVICE_CHARGE=0.05                 # Biaya layanan (5%)

# Jam Operasional  
WORKING_HOURS_START=08:00
WORKING_HOURS_END=23:00
TIMEZONE=Asia/Jakarta
```

### 📺 TV Billing Configuration
```env
# Kapasitas & Performance
MAX_TV_SESSIONS=100                 # Max TV bersamaan
SESSION_WARNING_MINUTES=5           # Warning sebelum habis
AUTO_POWER_OFF=true                 # Auto matikan TV
MIN_BILLING_TIME=30                 # Minimum billing (menit)
TV_MONITOR_INTERVAL=10              # Interval monitoring (detik)
```

### 🛒 POS System Configuration  
```env
# Order Management
ORDER_PREFIX=ORD                    # Prefix nomor order
ORDER_NUMBER_LENGTH=8               # Panjang nomor order

# Stock Management
LOW_STOCK_THRESHOLD=10              # Threshold stok rendah
AUTO_REORDER=false                  # Auto reorder stok

# Receipt Settings
RECEIPT_FOOTER=Terima kasih!        # Footer struk
PRINT_LOGO=true                     # Print logo di struk
```

### 🔐 Security Configuration
```env
# JWT Security
JWT_SECRET=super-secret-key-32-chars-minimum
JWT_EXPIRES_IN=7d                   # Token expire
BCRYPT_ROUNDS=12                    # Hash rounds

# Admin Default (GANTI SETELAH INSTALL!)
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
```

### 📡 Network Configuration
```env
# WiFi untuk Customer
WIFI_NAME=Warnet_WiFi
WIFI_PASSWORD=password123
WIFI_GUEST_NAME=Guest_WiFi
WIFI_GUEST_PASSWORD=guest123

# TV Network
TV_NETWORK_RANGE=192.168.1.0/24     # Range IP TV
TV_DISCOVERY_PORT=8888              # Port discovery
TV_COMMAND_PORT=8889                # Port command
```

## 🎛️ Feature Flags

### Backend Features
```env
# Backup & Monitoring
BACKUP_ENABLED=true                 # Enable auto backup
ENABLE_METRICS=true                 # Enable monitoring
LOG_LEVEL=info                      # Log level (debug/info/warn/error)

# Development Features
DEV_ENABLE_SEED_DATA=true           # Auto seed data
DEV_MOCK_TV_RESPONSES=false         # Mock TV responses
ENABLE_API_DOCS=true                # Enable API docs
```

### Frontend Features
```env
# UI Features
REACT_APP_ENABLE_TV_MANAGEMENT=true
REACT_APP_ENABLE_POS_SYSTEM=true
REACT_APP_ENABLE_REPORTS=true
REACT_APP_ENABLE_DARK_MODE=true
REACT_APP_ENABLE_REALTIME=true

# Security
REACT_APP_SESSION_TIMEOUT=60        # Session timeout (menit)
REACT_APP_MIN_PASSWORD_LENGTH=8     # Min password length
```

## 📊 Performance Tuning

### Database Optimization
```env
# Connection Pool
DB_MAX_CONNECTIONS=50               # Untuk high traffic
DB_CONNECTION_TIMEOUT=5000          # Connection timeout

# Logging
LOG_DATABASE_QUERIES=false          # Disable di production
LOG_LEVEL=warn                      # Warn level di production
```

### Redis Optimization  
```env
# Redis Settings
REDIS_PASSWORD=strong_redis_pass    # Password Redis
REDIS_KEY_PREFIX=apkbilling:        # Key prefix
REDIS_DB=0                          # Database number
```

### Real-time Updates
```env
# WebSocket Settings
REACT_APP_DASHBOARD_REFRESH_INTERVAL=5000     # Dashboard refresh
REACT_APP_TV_STATUS_REFRESH_INTERVAL=3000     # TV status refresh
REACT_APP_WS_RECONNECT_INTERVAL=5000          # Reconnect interval
```

## 🔧 Customization untuk Berbagai Bisnis

### 1. Warnet Gaming
```env
BUSINESS_NAME=Gaming Zone Pro
MAX_TV_SESSIONS=50
MIN_BILLING_TIME=60
SESSION_WARNING_MINUTES=10
AUTO_POWER_OFF=false                # Manual shutdown
```

### 2. Cafe dengan TV
```env
BUSINESS_NAME=Cafe Santai TV
MAX_TV_SESSIONS=20
MIN_BILLING_TIME=30
TAX_RATE=0.11
SERVICE_CHARGE=0.10                 # 10% service charge
```

### 3. Internet Cafe 24 Jam
```env
BUSINESS_NAME=Net 24 Hours
WORKING_HOURS_START=00:00
WORKING_HOURS_END=23:59
MAX_TV_SESSIONS=100
TV_MONITOR_INTERVAL=5               # Monitoring ketat
```

## 📱 Notifikasi & Integrasi

### Email Notifications
```env
# SMTP Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### SMS Notifications
```env
# SMS Gateway
SMS_PROVIDER=twilio
SMS_API_KEY=your-api-key
SMS_FROM_NUMBER=+6281234567890
```

### Push Notifications
```env
# Firebase Cloud Messaging
FCM_SERVER_KEY=your-fcm-key
FCM_SENDER_ID=your-sender-id
```

## 🛡️ Security Best Practices

### Production Security
```env
# Strong Passwords
JWT_SECRET=very-long-random-string-minimum-32-characters
DB_PASSWORD=VeryStr0ng!Pa$$w0rd
REDIS_PASSWORD=An0th3rStr0ng!Pa$$w0rd

# Disable Debug
DEBUG_MODE=false
DEV_SKIP_AUTH=false
ENABLE_API_DOCS=false               # Disable di production
```

### Network Security
```env
# CORS Settings
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com

# API URLs
REACT_APP_API_URL=https://api.yourdomain.com/api
REACT_APP_SOCKET_URL=https://api.yourdomain.com
```

## 📝 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Periksa `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`
   - Pastikan PostgreSQL running
   - Cek firewall settings

2. **TV Not Connecting**
   - Periksa `TV_NETWORK_RANGE`
   - Cek `TV_DISCOVERY_PORT` dan `TV_COMMAND_PORT`
   - Pastikan TV dalam network yang sama

3. **Real-time Updates Not Working**
   - Periksa `REACT_APP_SOCKET_URL`
   - Cek WebSocket connection
   - Periksa firewall untuk WebSocket ports

4. **Performance Issues**
   - Tingkatkan `DB_MAX_CONNECTIONS`
   - Turunkan refresh intervals
   - Enable Redis caching

### Debug Mode
```env
# Enable untuk troubleshooting
DEBUG_MODE=true
VERBOSE_LOGGING=true
LOG_LEVEL=debug
LOG_DATABASE_QUERIES=true
```

## 🔄 Environment Switching

### Switch ke Development
```bash
cp .env.development backend/.env
cp admin-panel/.env.development admin-panel/.env
docker-compose -f docker-compose.dev.yml up -d
```

### Switch ke Production  
```bash
cp .env.production backend/.env
cp admin-panel/.env.production admin-panel/.env
docker-compose up -d
```

## 📞 Support

Jika mengalami kesulitan konfigurasi:
1. Periksa log files di `./logs/`
2. Cek Docker container status: `docker-compose ps`
3. Review konfigurasi dengan `.env.example`
4. Pastikan semua required environment variables terisi

---

**⚠️ PENTING:** Selalu backup file `.env` sebelum melakukan perubahan dan jangan commit file `.env` ke repository!