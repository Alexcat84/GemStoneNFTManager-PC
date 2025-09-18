const { Pool } = require('pg');

class StockManager {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        // In-memory stock reservations (for development)
        // In production, you might want to use Redis or a database table
        this.reservations = new Map();
        this.reservationTimeout = 15 * 60 * 1000; // 15 minutes
    }

    // Check if product has enough stock
    async checkStock(productId, quantity) {
        try {
            const client = await this.pool.connect();
            const result = await client.query(
                'SELECT stock_quantity FROM products WHERE id = $1',
                [productId]
            );
            client.release();

            if (result.rows.length === 0) {
                return { available: false, message: 'Product not found' };
            }

            const availableStock = result.rows[0].stock_quantity;
            const reservedStock = this.getReservedStock(productId);
            const actualAvailable = availableStock - reservedStock;

            return {
                available: actualAvailable >= quantity,
                availableStock: actualAvailable,
                totalStock: availableStock,
                reservedStock: reservedStock,
                requestedQuantity: quantity
            };
        } catch (error) {
            console.error('Error checking stock:', error);
            return { available: false, message: 'Error checking stock' };
        }
    }

    // Reserve stock for a cart session
    reserveStock(sessionId, productId, quantity) {
        const reservationKey = `${sessionId}_${productId}`;
        const existingReservation = this.reservations.get(reservationKey);
        
        if (existingReservation) {
            // Update existing reservation
            existingReservation.quantity = quantity;
            existingReservation.timestamp = Date.now();
        } else {
            // Create new reservation
            this.reservations.set(reservationKey, {
                productId,
                quantity,
                timestamp: Date.now()
            });
        }

        // Set timeout to release reservation
        setTimeout(() => {
            this.releaseReservation(sessionId, productId);
        }, this.reservationTimeout);

        console.log(`📦 Stock reserved: ${quantity} units of product ${productId} for session ${sessionId}`);
    }

    // Release stock reservation
    releaseReservation(sessionId, productId) {
        const reservationKey = `${sessionId}_${productId}`;
        const reservation = this.reservations.get(reservationKey);
        
        if (reservation) {
            this.reservations.delete(reservationKey);
            console.log(`📦 Stock reservation released: ${reservation.quantity} units of product ${productId} for session ${sessionId}`);
        }
    }

    // Get reserved stock for a product
    getReservedStock(productId) {
        let totalReserved = 0;
        for (const [key, reservation] of this.reservations) {
            if (reservation.productId === productId) {
                totalReserved += reservation.quantity;
            }
        }
        return totalReserved;
    }

    // Update stock after successful purchase
    async updateStockAfterPurchase(productId, quantity) {
        try {
            const client = await this.pool.connect();
            const result = await client.query(
                'UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING stock_quantity',
                [quantity, productId]
            );
            client.release();

            if (result.rows.length === 0) {
                throw new Error('Product not found');
            }

            const newStock = result.rows[0].stock_quantity;
            console.log(`📦 Stock updated: Product ${productId} now has ${newStock} units remaining`);
            
            return { success: true, newStock };
        } catch (error) {
            console.error('Error updating stock:', error);
            return { success: false, error: error.message };
        }
    }

    // Get low stock products (less than 5 units)
    async getLowStockProducts() {
        try {
            const client = await this.pool.connect();
            const result = await client.query(
                'SELECT id, name, stock_quantity FROM products WHERE stock_quantity <= 5 AND is_archived = false ORDER BY stock_quantity ASC'
            );
            client.release();

            return result.rows;
        } catch (error) {
            console.error('Error getting low stock products:', error);
            return [];
        }
    }

    // Clean up expired reservations
    cleanupExpiredReservations() {
        const now = Date.now();
        for (const [key, reservation] of this.reservations) {
            if (now - reservation.timestamp > this.reservationTimeout) {
                this.reservations.delete(key);
                console.log(`📦 Expired reservation cleaned up: ${key}`);
            }
        }
    }

    // Get stock status for admin
    async getStockStatus() {
        try {
            const client = await this.pool.connect();
            const result = await client.query(`
                SELECT 
                    id,
                    name,
                    stock_quantity,
                    CASE 
                        WHEN stock_quantity = 0 THEN 'out_of_stock'
                        WHEN stock_quantity <= 5 THEN 'low_stock'
                        ELSE 'in_stock'
                    END as status
                FROM products 
                WHERE is_archived = false 
                ORDER BY stock_quantity ASC
            `);
            client.release();

            return result.rows;
        } catch (error) {
            console.error('Error getting stock status:', error);
            return [];
        }
    }
}

module.exports = StockManager;
