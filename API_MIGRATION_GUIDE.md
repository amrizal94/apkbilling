# API Migration Guide: Old Backend → Clean Architecture

## 🎯 Overview
This guide documents the API endpoint changes when migrating from old backend to Clean Architecture.

## 📊 Endpoint Mapping

### **Session Management**
| Function | Old Backend | Clean Architecture | Status |
|----------|-------------|-------------------|---------|
| Start Session | `POST /tv/start-session` | `POST /tv/sessions` | ✅ Migrated |
| Stop Session | `POST /tv/stop-session/:id` | `PUT /tv/sessions/:id/end` | ✅ Migrated |
| Add Time | `POST /tv/add-time/:id` | `POST /tv/sessions/:id/add-time` | ✅ Migrated |
| Pause Session | `POST /tv/pause-session/:id` | `POST /tv/sessions/:id/pause` | ✅ Migrated |
| Resume Session | `POST /tv/resume-session/:id` | `POST /tv/sessions/:id/resume` | ✅ Migrated |
| Confirm Payment | `POST /tv/confirm-payment/:id` | `POST /tv/sessions/:id/confirm-payment` | ✅ Migrated |
| F&B Order | `POST /tv/session-order/:id` | `POST /tv/sessions/:id/order` | ✅ Migrated |
| Stop by Device | `POST /tv/stop-active-session/:deviceId` | `POST /tv/devices/:deviceId/stop-session` | ✅ Added |

### **Device Management**
| Function | Old Backend | Clean Architecture | Status |
|----------|-------------|-------------------|---------|
| Get Devices | `GET /tv/devices` | `GET /tv/devices` | ✅ Same |
| Device Discovery | `POST /tv/discover` | `POST /tv/discover` | ✅ Same |
| Get Discoveries | `GET /tv/discoveries` | `GET /tv/discoveries` | ✅ Added |
| Active Session | `GET /tv/active-session/:deviceId` | `GET /tv/active-session/:deviceId` | ✅ Same |
| Heartbeat | `POST /tv/heartbeat/:deviceId` | `POST /tv/heartbeat/:deviceId` | ✅ Same |
| Delete Device | `DELETE /tv/devices/:id` | `DELETE /tv/devices/:deviceId` | ✅ Same |

### **F&B Integration**
| Function | Old Backend | Clean Architecture | Status |
|----------|-------------|-------------------|---------|
| Products for Order | `GET /tv/products-for-order` | `GET /tv/products-for-order` | ✅ Added |
| Session Orders | `GET /tv/session-orders/:sessionId` | `GET /tv/sessions/:sessionId/orders` | ✅ Added |

### **Package Management**
| Function | Old Backend | Clean Architecture | Status |
|----------|-------------|-------------------|---------|
| Get Packages | `GET /tv/packages` | `GET /api/packages` | ✅ Different route |

## 🔧 Frontend Changes Required

### **TVManagement.js Updates (Already Applied)**
```javascript
// Start Session
- axios.post('/tv/start-session', data)
+ axios.post('/tv/sessions', data)

// Stop Session  
- axios.post(`/tv/stop-session/${sessionId}`)
+ axios.put(`/tv/sessions/${sessionId}/end`)

// Add Time
- axios.post(`/tv/add-time/${sessionId}`, data)
+ axios.post(`/tv/sessions/${sessionId}/add-time`, data)

// Other session operations follow same pattern
```

## 🚀 Clean Architecture Benefits

### **Improved Structure**
- ✅ **RESTful Design** - Proper HTTP methods (GET, POST, PUT, DELETE)
- ✅ **Resource-based URLs** - `/sessions/:id/action` vs `/action/:id`
- ✅ **Consistent Response Format** - Standardized success/error responses
- ✅ **RBAC Integration** - Role-based access control on all endpoints

### **Better Security**
- ✅ **Authentication Middleware** - JWT token validation
- ✅ **Permission Checks** - Granular RBAC permissions
- ✅ **Input Validation** - Proper request validation
- ✅ **Error Handling** - Consistent error responses

### **Enhanced Monitoring**
- ✅ **Structured Logging** - Winston logger with context
- ✅ **Request Tracking** - User ID tracking on all operations
- ✅ **Performance Metrics** - Built-in monitoring hooks

## 📋 Testing Checklist

### **Core Functionality**
- [ ] Start new TV session
- [ ] Stop active session  
- [ ] Add time to session
- [ ] Pause/Resume session
- [ ] Confirm payment
- [ ] Create F&B order
- [ ] View order history

### **Device Management**
- [ ] View all devices
- [ ] Device discovery
- [ ] Heartbeat system
- [ ] Real-time status updates

### **Integration**
- [ ] Package selection
- [ ] Product catalog
- [ ] WebSocket events
- [ ] Authentication/RBAC

## 🗑️ Safe Cleanup Plan

### **Phase 1: Verification**
1. Test all critical functionality
2. Verify WebSocket events work
3. Check admin panel operations
4. Test Android TV app integration

### **Phase 2: Backup & Archive**
```bash
# Create backup of old backend
mkdir -p backups/$(date +%Y%m%d)
cp -r backend/routes backend/server.js backups/$(date +%Y%m%d)/
```

### **Phase 3: Cleanup**
```bash
# Remove old files (after verification)
rm -f backend/server.js
rm -f backend/routes/tv.js
rm -f backend/routes/auth.js
# Keep: backend/config/, backend/utils/, backend/migrations/
```

## ⚠️ Important Notes

1. **Database Schema** - No changes required, same tables used
2. **Environment Variables** - Same .env configuration
3. **WebSocket Events** - Same event names and payloads
4. **Android TV App** - No changes required (uses same endpoints)
5. **Admin Panel** - Endpoints updated, functionality same

## 🆘 Rollback Plan

If issues occur:
```bash
# Restore old backend
cp backups/YYYYMMDD/server.js backend/
cp backups/YYYYMMDD/routes/* backend/routes/

# Update package.json
"main": "server.js"  # instead of "src/server.js"
```

---
**Migration completed:** ✅ All critical features implemented  
**Status:** Ready for testing and cleanup