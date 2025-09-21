const bcrypt = require('bcryptjs');

async function checkPassword() {
    const password = 'GemSpots2025!@#';
    const hash = '$2a$10$KtGWhWtpuuskGKVkj9Lq6eJEVKcNLtCop11ofxZSi.3PVyHnv3i4u';
    
    try {
        const isValid = await bcrypt.compare(password, hash);
        console.log('Password check result:', isValid);
        
        if (!isValid) {
            console.log('Generating new hash...');
            const newHash = await bcrypt.hash(password, 10);
            console.log('New hash:', newHash);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

checkPassword();
