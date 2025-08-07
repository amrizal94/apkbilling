const db = require('./config/database');

async function debugProductsResponse() {
  try {
    // This is the same query used in the /pos/products endpoint
    const query = `
      SELECT p.*, pc.category_name 
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE 1=1
      ORDER BY pc.category_name, p.product_name
    `;
    
    const [products] = await db.execute(query);
    
    // Filter for Ayam Penyet products
    const ayamPenyet = products.filter(p => p.product_name && p.product_name.includes('Ayam Penyet'));
    
    console.log('Ayam Penyet products from /pos/products query:');
    console.log(JSON.stringify(ayamPenyet, null, 2));
    
    // Also check the exact field names
    if (ayamPenyet.length > 0) {
      console.log('\nField names in first product:');
      console.log(Object.keys(ayamPenyet[0]));
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

debugProductsResponse();