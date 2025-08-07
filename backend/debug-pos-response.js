const express = require('express');
const app = express();
const db = require('./config/database');

// Simulate the exact /pos/products endpoint response
async function debugPosResponse() {
  try {
    const query = `
      SELECT p.*, pc.category_name 
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE 1=1
      ORDER BY pc.category_name, p.product_name
    `;
    
    const [products] = await db.execute(query);
    
    console.log('First 3 products from /pos/products:');
    console.log(JSON.stringify(products.slice(0, 3), null, 2));
    
    // Check field names
    if (products.length > 0) {
      console.log('\nAll field names:');
      console.log(Object.keys(products[0]));
      
      console.log('\nChecking product name field:');
      console.log('products[0].product_name:', products[0].product_name);
      console.log('products[0].name:', products[0].name);
    }
    
    // Simulate the filter for low stock
    const lowStockProducts = products.filter(product => 
      product.stock_quantity <= 15 && product.is_available
    );
    
    console.log('\nFirst 3 low stock products:');
    console.log(JSON.stringify(lowStockProducts.slice(0, 3), null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

debugPosResponse();