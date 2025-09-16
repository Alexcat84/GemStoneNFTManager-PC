const bcrypt = require('bcryptjs');

async function generatePasswordHash() {
    const password = 'GemSpots2025!@#';
    const saltRounds = 10;
    
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('🔐 Admin Password Hash Generated:');
        console.log('Password:', password);
        console.log('Hash:', hash);
        console.log('\n📋 Add this to your Vercel environment variables:');
        console.log('ADMIN_PASSWORD_HASH=' + hash);
    } catch (error) {
        console.error('Error generating hash:', error);
    }
}

generatePasswordHash();
