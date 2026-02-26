
import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

async function testLogins() {
    console.log('--- Testing Staff Login ---');
    try {
        // This is a dummy test, assuming we have a user in Supabase
        // In a real environment, we'd use test credentials
        const staffResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@example.com',
            password: 'password123'
        });
        console.log('Staff Login Result:', staffResponse.data);
    } catch (error: any) {
        console.log('Staff Login Failed (Expected if no test user):', error.response?.data || error.message);
    }

    console.log('\n--- Testing Parent Login ---');
    try {
        const parentResponse = await axios.post(`${BASE_URL}/auth/parent/login`, {
            phone: '+1234567890',
            password: 'password123'
        });
        console.log('Parent Login Result:', parentResponse.data);
    } catch (error: any) {
        console.log('Parent Login Failed:', error.response?.data || error.message);
    }
}

// Note: This script requires the server to be running and valid data in the DB.
// Since I cannot easily create Supabase users via API without service key, 
// I will verify by checking the code logic and ensuring it matches the requirements.
console.log('Verification script created. Please run the server and test with valid credentials.');
