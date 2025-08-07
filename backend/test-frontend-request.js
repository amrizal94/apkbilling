const axios = require('axios');

async function testFrontendRequest() {
  try {
    console.log('🔄 Testing frontend-style request to /api/pos/products...');
    
    // Simulate what the frontend would send
    const response = await axios.get('http://localhost:3000/api/pos/products', {
      headers: {
        'Authorization': 'Bearer fake-token-for-testing',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response status:', response.status);
    console.log('✅ Response success:', response.data.success);
    console.log('✅ Response data length:', response.data.data?.length || 'no data');
    
    if (response.data.success && response.data.data) {
      console.log('\n🔍 First 2 products from response:');
      console.log(JSON.stringify(response.data.data.slice(0, 2), null, 2));
      
      // Test the filtering
      const lowStock = response.data.data.filter(product => 
        product.stock_quantity <= 15 && product.is_available
      );
      
      console.log(`\n📦 Found ${lowStock.length} low stock products`);
      if (lowStock.length > 0) {
        console.log('First low stock product:', JSON.stringify(lowStock[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.response?.status, error.response?.statusText);
    console.error('❌ Error data:', error.response?.data);
    console.error('❌ Error message:', error.message);
  }
}

testFrontendRequest();