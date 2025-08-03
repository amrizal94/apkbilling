const axios = require('axios');

async function testDiscoverEndpoint() {
  try {
    // Use same URL as Android TV emulator
    const response = await axios.post('http://10.0.2.2:3000/api/tv/discover', {
      device_id: '8984ee1d834c4e9f',
      device_name: 'Gate 2', 
      device_type: 'android_tv',
      screen_resolution: '1920x1080',
      os_version: '13',
      app_version: '1.0.0',
      location: 'Test Location'
    }, {
      timeout: 5000
    });
    
    console.log('✅ Discover endpoint success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Discover endpoint failed!');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data?.message || error.message);
    console.log('Full response:', error.response?.data);
  }
}

testDiscoverEndpoint();