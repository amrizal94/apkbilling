#!/bin/bash

# APK Billing Development Setup Script

echo "🚀 Setting up APK Billing Development Environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are available"

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p backend/uploads
mkdir -p backend/logs
mkdir -p admin-panel/build

# Copy environment file if not exists
if [ ! -f backend/.env ]; then
    echo "📝 Creating backend .env file..."
    cp backend/.env.example backend/.env
    echo "⚠️  Please review and update the .env file with your settings"
fi

# Build and start development environment
echo "🐳 Starting Docker containers for development..."
docker-compose -f docker-compose.dev.yml down --remove-orphans
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check service status
echo "🔍 Checking service status..."
docker-compose -f docker-compose.dev.yml ps

# Show logs
echo "📋 Showing recent logs..."
docker-compose -f docker-compose.dev.yml logs --tail=20

echo ""
echo "✅ Development environment is ready!"
echo ""
echo "🌐 Services:"
echo "   - Backend API: http://localhost:3000"
echo "   - Admin Panel: http://localhost:3001"
echo "   - PostgreSQL: localhost:5432"
echo "   - Redis: localhost:6379"
echo ""
echo "📖 Default Login:"
echo "   - Username: admin"
echo "   - Password: admin123"
echo ""
echo "🔧 Useful commands:"
echo "   - View logs: docker-compose -f docker-compose.dev.yml logs -f"
echo "   - Stop services: docker-compose -f docker-compose.dev.yml down"
echo "   - Restart backend: docker-compose -f docker-compose.dev.yml restart backend"
echo "   - Access database: docker exec -it apkbilling_postgres_dev psql -U apkbilling_user -d apkbilling"
echo ""