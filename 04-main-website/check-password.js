/**
 * LOCAL DEV ONLY — compare a bcrypt hash to a password from env (no secrets in repo).
 *
 * Usage:
 *   ADMIN_PASSWORD_TEST=yourpass ADMIN_HASH_TEST='$2a$10$...' node check-password.js
 */
const bcrypt = require('bcryptjs');

async function checkPassword() {
    const password = process.env.ADMIN_PASSWORD_TEST;
    const hash = process.env.ADMIN_HASH_TEST;
    if (!password || !hash) {
        console.error('Set ADMIN_PASSWORD_TEST and ADMIN_HASH_TEST (local use only). Do not commit real values.');
        process.exit(1);
    }

    try {
        const isValid = await bcrypt.compare(password, hash);
        console.log('Password check result:', isValid);
        if (!isValid) {
            console.log('Generating new hash for ADMIN_PASSWORD_TEST...');
            const newHash = await bcrypt.hash(password, 10);
            console.log('New hash:', newHash);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

checkPassword();
