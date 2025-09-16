const { Pool } = require('pg');

async function checkDatabaseCapacity() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🔍 Checking PostgreSQL Database Capacity...\n');

        // Check current QR codes count
        const qrCount = await pool.query('SELECT COUNT(*) as count FROM qr_codes');
        console.log(`📊 Current QR Codes: ${qrCount.rows[0].count}`);

        // Check admin users count
        const adminCount = await pool.query('SELECT COUNT(*) as count FROM admin_users');
        console.log(`👤 Admin Users: ${adminCount.rows[0].count}`);

        // Check database size
        const dbSize = await pool.query(`
            SELECT pg_size_pretty(pg_database_size(current_database())) as size
        `);
        console.log(`💾 Database Size: ${dbSize.rows[0].size}`);

        // Check table sizes
        const tableSizes = await pool.query(`
            SELECT 
                schemaname,
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        `);
        
        console.log('\n📋 Table Sizes:');
        tableSizes.rows.forEach(row => {
            console.log(`   ${row.tablename}: ${row.size}`);
        });

        // Check QR codes table structure
        const qrStructure = await pool.query(`
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns 
            WHERE table_name = 'qr_codes'
            ORDER BY ordinal_position
        `);
        
        console.log('\n🏗️ QR Codes Table Structure:');
        qrStructure.rows.forEach(row => {
            const length = row.character_maximum_length ? `(${row.character_maximum_length})` : '';
            console.log(`   ${row.column_name}: ${row.data_type}${length}`);
        });

        // Estimate storage per QR code
        const sampleQR = await pool.query(`
            SELECT 
                LENGTH(qr_id::text) as qr_id_size,
                LENGTH(url::text) as url_size,
                LENGTH(COALESCE(nft_url::text, '')) as nft_url_size,
                LENGTH(COALESCE(notes::text, '')) as notes_size,
                LENGTH(COALESCE(qr_data::text, '')) as qr_data_size
            FROM qr_codes 
            LIMIT 1
        `);

        if (sampleQR.rows.length > 0) {
            const sample = sampleQR.rows[0];
            const totalSize = parseInt(sample.qr_id_size) + 
                            parseInt(sample.url_size) + 
                            parseInt(sample.nft_url_size) + 
                            parseInt(sample.notes_size) + 
                            parseInt(sample.qr_data_size);
            
            console.log('\n📏 Estimated Storage per QR Code:');
            console.log(`   QR ID: ${sample.qr_id_size} bytes`);
            console.log(`   URL: ${sample.url_size} bytes`);
            console.log(`   NFT URL: ${sample.nft_url_size} bytes`);
            console.log(`   Notes: ${sample.notes_size} bytes`);
            console.log(`   QR Data (Base64): ${sample.qr_data_size} bytes`);
            console.log(`   Total per QR: ~${totalSize} bytes (${(totalSize/1024).toFixed(2)} KB)`);
        }

        // Calculate capacity estimates
        const currentCount = parseInt(qrCount.rows[0].count);
        const avgSizePerQR = 50000; // ~50KB per QR (conservative estimate)
        
        console.log('\n🚀 Capacity Estimates:');
        console.log(`   Current QRs: ${currentCount.toLocaleString()}`);
        console.log(`   Estimated storage per QR: ~${(avgSizePerQR/1024).toFixed(0)} KB`);
        console.log(`   Current total QR storage: ~${((currentCount * avgSizePerQR)/1024/1024).toFixed(2)} MB`);
        
        // Vercel Postgres limits (based on free tier)
        console.log('\n📊 Vercel Postgres Capacity:');
        console.log('   Free Tier: 512 MB storage, 1 billion rows');
        console.log('   Pro Tier: 8 GB storage, unlimited rows');
        console.log('   Enterprise: Custom limits');
        
        const freeTierCapacity = Math.floor((512 * 1024 * 1024) / avgSizePerQR);
        const proTierCapacity = Math.floor((8 * 1024 * 1024 * 1024) / avgSizePerQR);
        
        console.log(`\n💡 Theoretical Capacity:`);
        console.log(`   Free Tier: ~${freeTierCapacity.toLocaleString()} QRs`);
        console.log(`   Pro Tier: ~${proTierCapacity.toLocaleString()} QRs`);
        
        if (currentCount > 0) {
            const freeTierRemaining = freeTierCapacity - currentCount;
            console.log(`\n📈 Remaining Capacity (Free Tier): ~${freeTierRemaining.toLocaleString()} QRs`);
        }

        console.log('\n✅ Database check completed successfully!');

    } catch (error) {
        console.error('❌ Error checking database:', error);
    } finally {
        await pool.end();
    }
}

// Run the check
checkDatabaseCapacity();
