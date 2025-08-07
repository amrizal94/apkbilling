// Test direct database access to see what we should expect
const db = require('./config/database');

async function testDirectAccess() {
  try {
    console.log('🔄 Testing direct database access...');
    
    const [products] = await db.execute(`
      SELECT p.*, pc.category_name 
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.stock_quantity <= 15 AND p.is_available = true
      ORDER BY p.stock_quantity ASC
      LIMIT 5
    `);
    
    console.log(`📦 Found ${products.length} low stock products`);
    console.log('\n🔍 Products with field details:');
    
    products.forEach((product, index) => {
      console.log(`\nProduct ${index + 1}:`);
      console.log('  - id:', product.id);
      console.log('  - product_name:', `"${product.product_name}"`);
      console.log('  - category_name:', `"${product.category_name}"`);
      console.log('  - stock_quantity:', product.stock_quantity);
      console.log('  - price:', product.price);
      console.log('  - is_available:', product.is_available);
    });
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    process.exit(0);
  }
}

testDirectAccess();