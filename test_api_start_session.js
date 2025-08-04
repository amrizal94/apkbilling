const axios = require('axios');

async function testAPIStartSession() {
    try {
        console.log('🚀 Testing API start session endpoint...');
        
        // First, clear any existing sessions
        const stopResponse = await axios.post('http://localhost:3000/api/tv/stop-active-session/9077f0b0f3a1cb41');
        console.log('🧹 Stop active session result:', stopResponse.data);
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Now start a new session using the same API endpoint as admin panel
        const startResponse = await axios.post('http://localhost:3000/api/tv/start-session', {
            device_id: 1065, // Database ID as expected by backend
            customer_name: 'API WebSocket Test',
            package_id: 1
        }, {
            headers: {
                'Authorization': 'Bearer your-test-token', // This will fail auth but we can see the error
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Start session result:', startResponse.data);
        
    } catch (error) {
        if (error.response) {
            console.log('📊 API Response Status:', error.response.status);
            console.log('📋 API Response Data:', error.response.data);
            
            if (error.response.status === 401) {
                console.log('');
                console.log('🔐 Authentication required. This is expected for testing.');
                console.log('   The WebSocket event won\'t be emitted without proper auth.');
                console.log('   You need to test this through the admin panel UI instead.');
            }
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

testAPIStartSession();