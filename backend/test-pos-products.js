const db = require('./config/database');

async function testPosProducts() {
  try {
    // This is the exact query from the /pos/products endpoint
    const query = `
      SELECT p.*, pc.category_name 
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE 1=1
      ORDER BY pc.category_name, p.product_name
    `;
    
    console.log('Executing query:', query);
    const [products] = await db.execute(query);
    
    console.log('\n=== FIRST 3 PRODUCTS ===');
    console.log(JSON.stringify(products.slice(0, 3), null, 2));
    
    console.log('\n=== FIELD NAMES IN FIRST PRODUCT ===');
    if (products.length > 0) {
      console.log(Object.keys(products[0]));
    }
    
    console.log('\n=== LOW STOCK PRODUCTS (≤15) ===');
    const lowStock = products.filter(p => p.stock_quantity <= 15 && p.is_available);
    console.log(`Found ${lowStock.length} low stock products`);
    console.log(JSON.stringify(lowStock.slice(0, 3), null, 2));
    
    console.log('\n=== CHECKING SPECIFIC FIELD VALUES ===');
    if (lowStock.length > 0) {
      const first = lowStock[0];
      console.log('First low stock product fields:');
      console.log('- id:', first.id);
      console.log('- product_name:', first.product_name);
      console.log('- name:', first.name);
      console.log('- category_name:', first.category_name);
      console.log('- stock_quantity:', first.stock_quantity);
      console.log('- is_available:', first.is_available);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testPosProducts();