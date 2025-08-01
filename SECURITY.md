# 🔒 Security Policy

## 🛡️ Security Guidelines

APK Billing System menangani data sensitif bisnis dan finansial. Dokumen ini menjelaskan praktik keamanan yang harus diikuti.

## ⚠️ File Sensitif yang TIDAK BOLEH di-commit

### 🚫 Environment Files
```
.env
.env.local
.env.production
.env.development
backend/.env*
admin-panel/.env*
```

### 🚫 Credential Files
```
config/database.json
secrets/
api-keys.json
credentials.json
service-account*.json
*.keystore
*.jks
```

### 🚫 Data & Uploads
```
uploads/
backups/
logs/
*.log
*.db
*.sqlite
```

## ✅ Files yang Aman untuk di-commit

### ✅ Template Files
```
.env.example
.env.development (tanpa data sensitif)
.env.production (tanpa data sensitif)
```

### ✅ Source Code
```
*.js
*.jsx
*.java
*.kt
*.sql (schema saja, bukan data)
```

## 🔐 Best Practices

### 1. Environment Variables
```bash
# ❌ JANGAN seperti ini
DB_PASSWORD=mypassword123

# ✅ LAKUKAN seperti ini  
DB_PASSWORD=VeryStr0ng!P@ssw0rd#2024$Secure
```

### 2. JWT Secrets
```bash
# ❌ JANGAN seperti ini
JWT_SECRET=secret

# ✅ LAKUKAN seperti ini (minimum 32 karakter)
JWT_SECRET=super-secure-jwt-secret-key-32-chars-minimum-random-string
```

### 3. Admin Credentials
```bash
# ❌ JANGAN biarkan default
DEFAULT_ADMIN_PASSWORD=admin123

# ✅ GANTI segera setelah instalasi
DEFAULT_ADMIN_PASSWORD=NewSecur3P@ssw0rd!2024
```

## 🔍 Security Checklist

### Pre-deployment
- [ ] Semua `.env` files tidak ter-commit
- [ ] Password default sudah diganti
- [ ] JWT secret menggunakan random string
- [ ] Database password kuat
- [ ] API keys tidak ter-commit
- [ ] Keystore files tidak ter-commit

### Post-deployment
- [ ] Admin password sudah diganti
- [ ] Firewall dikonfigurasi dengan benar
- [ ] SSL certificate terpasang
- [ ] Backup encryption diaktifkan
- [ ] Log monitoring diaktifkan

## 🚨 Jika Terjadi Security Breach

### 1. Immediate Actions
1. **Stop semua services**
   ```bash
   docker-compose down
   ```

2. **Ganti semua credentials**
   - Database passwords
   - JWT secrets
   - API keys
   - Admin passwords

3. **Review logs**
   ```bash
   grep -i "error\|failed\|unauthorized" logs/*.log
   ```

### 2. Recovery Actions
1. **Update environment files**
2. **Restart dengan credentials baru**
3. **Monitor untuk aktivitas mencurigakan**
4. **Backup data penting**

## 🔧 Development vs Production

### Development
```bash
# Boleh menggunakan weak passwords untuk testing
DB_PASSWORD=dev_password
JWT_SECRET=dev-jwt-secret
DEBUG_MODE=true
```

### Production
```bash
# HARUS menggunakan strong passwords
DB_PASSWORD=Pr0duct10n!P@ssw0rd#2024$V3rySecur3
JWT_SECRET=production-super-secure-jwt-key-64-chars-minimum-random-string
DEBUG_MODE=false
```

## 📞 Reporting Security Issues

Jika menemukan kerentanan keamanan:

1. **JANGAN** buat public issue di GitHub
2. **LAKUKAN** report secara private
3. **SERTAKAN** detail lengkap vulnerability
4. **TUNGGU** konfirmasi sebelum public disclosure

## 🛠️ Security Tools

### Recommended Tools
- **Password Manager**: Generate & store secure passwords
- **2FA**: Enable two-factor authentication
- **SSL/TLS**: Always use HTTPS in production
- **Firewall**: Configure proper network access
- **Monitoring**: Set up intrusion detection

### Code Security
```bash
# Scan dependencies for vulnerabilities
npm audit
npm audit fix

# Check for secrets in code
git-secrets --scan
```

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [Docker Security](https://docs.docker.com/engine/security/security/)

---

**⚠️ INGAT:** Keamanan adalah tanggung jawab bersama. Selalu review kode dan konfigurasi sebelum deployment!