// Cart Configuration
const CART_CONFIG = {
    // Cart settings
    maxItems: 50,
    maxQuantityPerItem: 10,
    
    // Currency settings
    currency: 'CAD',
    currencySymbol: '$',
    
    // Tax settings (Ontario, Canada)
    taxRate: 0.13, // 13% HST
    
    // Shipping settings
    freeShippingThreshold: 100, // Free shipping over $100 CAD
    defaultShippingCost: 15, // Default shipping cost in CAD
    
    // Notification settings
    notificationDuration: 3000, // 3 seconds
    
    // Local storage key
    storageKey: 'gemspots_cart',
    
    // API endpoints (for future use)
    endpoints: {
        calculateShipping: '/api/shipping/calculate',
        processPayment: '/api/payment/process',
        createOrder: '/api/orders/create'
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CART_CONFIG;
} else {
    window.CART_CONFIG = CART_CONFIG;
}
