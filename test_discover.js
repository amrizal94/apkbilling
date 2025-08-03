const axios = require('axios');

async function testDiscoverEndpoint() {
  try {
    const response = await axios.post('http://localhost:3000/api/tv/discover', {
      device_id: '8984ee1d834c4e9f',
      device_name: 'Gate 1', 
      device_type: 'android_tv',
      screen_resolution: '1920x1080',
      os_version: '13',
      app_version: '1.0.0',
      location: 'Reguler PS 2'
    });
    
    console.log('✅ Discover endpoint success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Discover endpoint failed!');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data?.message || error.message);
  }
}

testDiscoverEndpoint();