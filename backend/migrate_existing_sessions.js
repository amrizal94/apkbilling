const db = require('./config/database');

async function migrateExistingData() {
  try {
    console.log('🔄 Migrating existing TV sessions to session_packages...');
    
    // Get all existing sessions with their packages
    const [sessions] = await db.execute(`
      SELECT s.id, s.package_id, p.name as package_name, 
             p.duration_minutes, p.price, s.start_time
      FROM tv_sessions s
      LEFT JOIN packages p ON s.package_id = p.id
      WHERE s.package_id IS NOT NULL
    `);
    
    console.log(`Found ${sessions.length} sessions with packages to migrate`);
    
    // Insert initial packages for each session
    for (const session of sessions) {
      await db.execute(`
        INSERT INTO session_packages (session_id, package_id, package_name, duration_minutes, price, package_type, added_at)
        VALUES ($1, $2, $3, $4, $5, 'initial', $6)
        ON CONFLICT DO NOTHING
      `, [
        session.id,
        session.package_id,
        session.package_name,
        session.duration_minutes,
        session.price,
        session.start_time
      ]);
    }
    
    console.log('✅ Migration of existing data completed successfully');
  } catch (error) {
    console.error('❌ Data migration failed:', error.message);
  } finally {
    process.exit(0);
  }
}

migrateExistingData();