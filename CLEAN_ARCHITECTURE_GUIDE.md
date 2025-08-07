# 🏗️ APK Billing - Clean Architecture Guide

## Overview

APK Billing system telah direfaktor menggunakan **Clean Architecture** principles untuk meningkatkan maintainability, testability, dan scalability. Struktur baru mengikuti layered architecture dengan dependency injection.

## 🏛️ Architecture Layers

### 1. Domain Layer (`src/domain/`)
**Pure business logic tanpa dependencies external**
- `entities/` - Business entities dengan business rules
- `usecases/` - Application use cases dan business workflows  
- `repositories/` - Repository interfaces (contracts)

### 2. Application Layer (`src/application/`)
**Orchestrates business logic dan koordinasi**
- `controllers/` - HTTP request handlers
- `services/` - Application services 
- `dtos/` - Data Transfer Objects

### 3. Infrastructure Layer (`src/infrastructure/`)
**External concerns dan implementations**
- `database/` - Database connections dan migrations
- `repositories/` - Repository implementations
- `services/` - External services (cache, logging, etc.)
- `http/` - HTTP utilities dan response handlers
- `container/` - Dependency injection container

## 📁 Project Structure

```
backend/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── User.js
│   │   │   ├── Role.js
│   │   │   └── ...
│   │   └── usecases/
│   │       ├── user/
│   │       │   ├── CreateUserUseCase.js
│   │       │   ├── GetAllUsersUseCase.js
│   │       │   └── ...
│   │       └── ...
│   ├── application/
│   │   ├── controllers/
│   │   │   ├── UserController.js
│   │   │   ├── AuthController.js
│   │   │   └── ...
│   │   └── services/
│   │       └── ...
│   └── infrastructure/
│       ├── container/
│       │   └── DIContainer.js
│       ├── database/
│       │   └── Database.js
│       ├── repositories/
│       │   ├── UserRepository.js
│       │   └── ...
│       ├── services/
│       │   ├── Logger.js
│       │   ├── CacheService.js
│       │   └── ...
│       └── http/
│           └── ResponseHandler.js
├── server.js (entry point)
├── Dockerfile
├── Dockerfile.dev
└── package.json
```

## 🔧 Environment Variables

### Application Configuration
```env
NODE_ENV=development
PORT=3000
FRONTEND_PORT=3001
API_VERSION=v1
APP_NAME=APK Billing System
APP_VERSION=2.0.0
```

### Database Configuration
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=apkbilling_dev
DB_USER=postgresql
DB_PASSWORD=local
DB_MAX_CONNECTIONS=10
DB_CONNECTION_TIMEOUT=2000
DB_SSL=false
DB_LOGGING=true
```

### Redis Configuration
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=1
REDIS_KEY_PREFIX=apkbilling_dev:
REDIS_TTL=3600
```

### Security Configuration
```env
JWT_SECRET=dev-jwt-secret-key-not-for-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
```

## 🐳 Docker Usage

### Development Mode
```bash
# Start with hot reload dan debugging
docker-compose -f docker-compose.dev.yml up --build

# Dengan admin tools (PgAdmin, Redis Commander)
docker-compose -f docker-compose.dev.yml --profile admin up --build
```

### Production Mode
```bash
# Production deployment
docker-compose up --build

# Dengan reverse proxy
docker-compose --profile production up --build
```

### Available Services
- **Backend API**: http://localhost:3000
- **Frontend**: http://localhost:3001
- **PgAdmin** (dev): http://localhost:5050
- **Redis Commander** (dev): http://localhost:8081

## 📝 Development Scripts

```bash
# Development
npm run dev              # Start with hot reload
npm run dev:debug        # Start with debugger

# Testing
npm run test             # Run tests with coverage
npm run test:watch       # Watch mode
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only

# Code Quality
npm run lint             # ESLint check
npm run lint:fix         # Fix linting issues

# Database
npm run migrate          # Run migrations
npm run seed             # Seed database

# Docker
npm run docker:dev       # Start development environment
npm run docker:prod      # Start production environment
```

## 🔄 Dependency Injection

Menggunakan **Awilix** untuk dependency injection:

```javascript
// DIContainer.js
const container = createContainer();

container.register({
  // Services
  logger: asClass(Logger).singleton(),
  database: asClass(Database).singleton(),
  
  // Repositories  
  userRepository: asClass(UserRepository).singleton(),
  
  // Use Cases
  createUserUseCase: asClass(CreateUserUseCase).singleton(),
  
  // Controllers
  userController: asClass(UserController).singleton()
});
```

## 🧪 Testing Strategy

### Unit Tests
- Test individual components in isolation
- Mock dependencies
- Focus on business logic

### Integration Tests
- Test component interactions
- Use real database (test container)
- Test API endpoints

### Example Test Structure
```
tests/
├── unit/
│   ├── domain/
│   │   ├── entities/
│   │   └── usecases/
│   └── infrastructure/
├── integration/
│   ├── controllers/
│   └── repositories/
└── fixtures/
    └── testData.js
```

## 📊 Logging & Monitoring

### Structured Logging
```javascript
logger.info('User created', { 
  userId: user.id, 
  username: user.username 
});

logger.error('Database error', { 
  error: error.message, 
  query: 'SELECT * FROM users' 
});
```

### Health Checks
- **Database**: Connection dan response time
- **Cache**: Redis connectivity
- **Memory**: Usage dan metrics

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-Based Access Control (RBAC)
- Password hashing dengan bcrypt
- Rate limiting

### Input Validation
- Request validation
- SQL injection prevention  
- XSS protection

## 🚀 Deployment

### Production Checklist
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database migrations applied
- [ ] Monitoring setup
- [ ] Backup strategy implemented
- [ ] Log rotation configured

### Scaling Considerations
- **Horizontal scaling**: Multiple app instances
- **Database**: Connection pooling, read replicas
- **Cache**: Redis cluster
- **Load balancing**: Nginx reverse proxy

## 📚 Migration Guide

### From Old Architecture
1. **Entities**: Business objects dengan validation rules
2. **Use Cases**: Business workflows extracted dari controllers
3. **Repositories**: Database access abstracted
4. **DI Container**: Dependencies injected, bukan hard-coded
5. **Logging**: Structured logging dengan context

### Breaking Changes
- Server entry point: `server.js` → `src/server.js`
- Controllers: Simplified, logic moved ke use cases
- Database: Pool management dengan health checks
- Environment: More granular configuration

## 🤝 Contributing

### Development Workflow
1. Create feature branch
2. Write tests first (TDD)
3. Implement feature
4. Run tests dan linting
5. Create pull request

### Code Standards
- ESLint configuration
- Business logic di domain layer
- No direct database calls di controllers
- Always use dependency injection

---

**Happy Coding! 🚀**