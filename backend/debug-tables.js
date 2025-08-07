const db = require('./config/database');

async function checkTables() {
  try {
    console.log('=== Products table structure ===');
    const productTable = await db.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      ORDER BY ordinal_position
    `);
    console.table(productTable.rows);

    console.log('\n=== Product Categories table check ===');
    const categoriesExist = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'product_categories'
      );
    `);
    console.log('Categories table exists:', categoriesExist.rows[0].exists);
    
    if (categoriesExist.rows[0].exists) {
      const catTable = await db.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'product_categories' 
        ORDER BY ordinal_position
      `);
      console.table(catTable.rows);
    }

    console.log('\n=== Sample products data ===');
    const sampleProducts = await db.query(`
      SELECT id, product_name, category_id, category_name FROM products LIMIT 5
    `);
    console.table(sampleProducts.rows);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTables();