const db = require('./config/database');

async function checkProducts() {
  try {
    const [rows] = await db.execute(`
      SELECT p.id, p.product_name, p.category_id, pc.category_name, p.stock_quantity, p.price 
      FROM products p 
      LEFT JOIN product_categories pc ON p.category_id = pc.id 
      WHERE p.product_name LIKE '%Ayam Penyet%' 
      ORDER BY p.id
    `);
    console.log('Ayam Penyet products:');
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkProducts();