#!/bin/bash

# APK Billing Production Deployment Script

echo "🚀 Deploying APK Billing to Production..."

# Check if running as root (recommended for production)
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  This script should be run as root for production deployment"
    echo "   Use: sudo ./scripts/prod-deploy.sh"
    exit 1
fi

# Check required tools
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

echo "✅ Docker tools are ready"

# Setup production environment
echo "🔧 Setting up production environment..."

# Create production .env if not exists
if [ ! -f backend/.env ]; then
    echo "❌ Production .env file not found!"
    echo "   Please create backend/.env with production settings"
    echo "   Use backend/.env.example as template"
    exit 1
fi

# Create production directories
mkdir -p /var/lib/apkbilling/postgres
mkdir -p /var/lib/apkbilling/redis
mkdir -p /var/lib/apkbilling/uploads
mkdir -p /var/lib/apkbilling/logs
mkdir -p /var/lib/apkbilling/ssl

# Set proper permissions
chown -R 999:999 /var/lib/apkbilling/postgres
chown -R 999:999 /var/lib/apkbilling/redis

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down --remove-orphans

# Pull latest images and build
echo "🏗️  Building production images..."
docker-compose build --no-cache --pull

# Start production services
echo "🚀 Starting production services..."
docker-compose up -d

# Wait for services
echo "⏳ Waiting for services to initialize..."
sleep 60

# Check service health
echo "🔍 Checking service health..."
docker-compose ps

# Show service logs
echo "📋 Recent service logs:"
docker-compose logs --tail=10

# Setup log rotation
echo "📝 Setting up log rotation..."
cat > /etc/logrotate.d/apkbilling << EOF
/var/lib/apkbilling/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    create 644 root root
    postrotate
        docker-compose restart backend
    endscript
}
EOF

# Setup systemd service for auto-start
echo "⚙️  Setting up systemd service..."
cat > /etc/systemd/system/apkbilling.service << EOF
[Unit]
Description=APK Billing System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$(pwd)
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl enable apkbilling.service
systemctl daemon-reload

# Setup UFW firewall rules (if ufw is available)
if command -v ufw &> /dev/null; then
    echo "🔒 Configuring firewall..."
    ufw allow 22/tcp    # SSH
    ufw allow 80/tcp    # HTTP
    ufw allow 443/tcp   # HTTPS
    ufw allow 8080/tcp  # Nginx proxy
    ufw --force enable
fi

# Setup SSL certificate (basic self-signed for development)
if [ ! -f /var/lib/apkbilling/ssl/cert.pem ]; then
    echo "🔐 Generating self-signed SSL certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /var/lib/apkbilling/ssl/key.pem \
        -out /var/lib/apkbilling/ssl/cert.pem \
        -subj "/C=ID/ST=Jakarta/L=Jakarta/O=APK Billing/CN=localhost"
fi

echo ""
echo "✅ Production deployment completed!"
echo ""
echo "🌐 Services:"
echo "   - Admin Panel: http://localhost:8080"
echo "   - API Health: http://localhost:8080/api/health"
echo "   - Database: localhost:5432 (internal)"
echo ""
echo "📖 Default Login:"
echo "   - Username: admin"
echo "   - Password: admin123"
echo ""
echo "🔧 Management commands:"
echo "   - View logs: docker-compose logs -f"
echo "   - Restart services: systemctl restart apkbilling"
echo "   - Stop services: systemctl stop apkbilling"
echo "   - Update system: git pull && ./scripts/prod-deploy.sh"
echo ""
echo "⚠️  IMPORTANT:"
echo "   1. Change default admin password immediately"
echo "   2. Review and update .env file with production values"
echo "   3. Setup proper SSL certificate for HTTPS"
echo "   4. Configure backup strategy for database"
echo "   5. Monitor logs regularly: tail -f /var/lib/apkbilling/logs/*.log"
echo ""