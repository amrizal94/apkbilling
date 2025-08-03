const axios = require('axios');

async function testDevicesAPI() {
  try {
    const response = await axios.get('http://localhost:3000/api/tv/devices');
    
    if (response.data.success) {
      const devices = response.data.data;
      const testDevice = devices.find(d => d.device_id === '8984ee1d834c4e9f');
      
      if (testDevice) {
        console.log('Test device found:');
        console.log(`- Device ID: ${testDevice.device_id}`);
        console.log(`- Device Name: ${testDevice.device_name}`);
        console.log(`- Device Location: ${testDevice.device_location}`);
        console.log(`- Status: ${testDevice.status}`);
      } else {
        console.log('Test device not found');
        console.log('Available devices:', devices.map(d => ({id: d.device_id, name: d.device_name})));
      }
    } else {
      console.log('API Error:', response.data.message);
    }
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

testDevicesAPI();