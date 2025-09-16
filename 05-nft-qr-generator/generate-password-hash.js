const bcrypt = require('bcryptjs');

async function generatePasswordHash() {
    const password = process.argv[2];
    
    if (!password) {
        console.log('Usage: node generate-password-hash.js <password>');
        console.log('Example: node generate-password-hash.js "MySecurePassword123!"');
        process.exit(1);
    }
    
    try {
        const saltRounds = 10;
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('Password:', password);
        console.log('Hash:', hash);
        console.log('\nAdd this to your Vercel environment variables:');
        console.log('ADMIN_PASSWORD_HASH =', hash);
    } catch (error) {
        console.error('Error generating hash:', error);
    }
}

generatePasswordHash();
