const db = require('./backend/config/database');

async function checkDevice() {
  try {
    const [devices] = await db.execute('SELECT device_id, device_name, device_location FROM tv_devices WHERE device_id = $1', ['8984ee1d834c4e9f']);
    console.log('Device data:', JSON.stringify(devices, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkDevice();