const bcrypt = require('bcryptjs');
const db = require('./config/database');

async function checkUser() {
    try {
        console.log('🔍 Checking admin user in database...');
        
        const [users] = await db.execute('SELECT id, username, password_hash, full_name, role FROM users WHERE username = $1', ['admin']);
        console.log('Users found:', users.length);
        
        if (users.length > 0) {
            const user = users[0];
            console.log('✅ User details:');
            console.log('   ID:', user.id);
            console.log('   Username:', user.username);
            console.log('   Full Name:', user.full_name);
            console.log('   Role:', user.role);
            console.log('   Password Hash:', user.password_hash);
            
            // Test hash comparison
            const testPassword = 'admin123';
            console.log('\n🔐 Testing password verification...');
            console.log('Testing password:', testPassword);
            
            const isValid = await bcrypt.compare(testPassword, user.password_hash);
            console.log('Password verification result:', isValid ? '✅ VALID' : '❌ INVALID');
            
            if (!isValid) {
                console.log('\n🔧 Generating correct hash...');
                const correctHash = await bcrypt.hash(testPassword, 12);
                console.log('Correct hash for admin123:', correctHash);
                
                console.log('\n📝 Updating user with correct hash...');
                await db.execute('UPDATE users SET password_hash = $1 WHERE username = $2', [correctHash, 'admin']);
                console.log('✅ Password updated successfully!');
            }
        } else {
            console.log('❌ No admin user found!');
            
            console.log('\n🔧 Creating admin user...');
            const adminPassword = 'admin123';
            const hashRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
            const passwordHash = await bcrypt.hash(adminPassword, hashRounds);
            
            const [result] = await db.execute(`
                INSERT INTO users (username, password_hash, full_name, role, is_active) 
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `, ['admin', passwordHash, 'Administrator', 'admin', true]);
            
            console.log('✅ Admin user created with ID:', result[0].id);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkUser();