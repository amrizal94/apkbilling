const axios = require('axios');

async function testAuth() {
  try {
    console.log('Testing authentication endpoint...');
    
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Login successful!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.log('❌ Login failed');
    console.log('Status:', error.response?.status);
    console.log('Response:', error.response?.data);
    console.log('Error message:', error.message);
  }
}

testAuth();