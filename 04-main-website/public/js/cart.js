// Shopping Cart System
class ShoppingCart {
    constructor() {
        this.config = window.CART_CONFIG || {};
        this.items = this.loadCart();
        this.updateCartDisplay();
        this.bindEvents();
    }

    // Load cart from localStorage
    loadCart() {
        try {
            const storageKey = this.config.storageKey || 'gemspots_cart';
            const savedCart = localStorage.getItem(storageKey);
            return savedCart ? JSON.parse(savedCart) : [];
        } catch (error) {
            console.error('Error loading cart:', error);
            return [];
        }
    }

    // Save cart to localStorage
    saveCart() {
        try {
            const storageKey = this.config.storageKey || 'gemspots_cart';
            localStorage.setItem(storageKey, JSON.stringify(this.items));
        } catch (error) {
            console.error('Error saving cart:', error);
        }
    }

    // Add item to cart
    addItem(product) {
        const maxItems = this.config.maxItems || 50;
        const maxQuantityPerItem = this.config.maxQuantityPerItem || 10;
        
        // Check if cart is full
        if (this.items.length >= maxItems) {
            this.showNotification(`Cart is full! Maximum ${maxItems} items allowed.`, 'error');
            return;
        }
        
        const existingItem = this.items.find(item => item.id === product.id);
        
        if (existingItem) {
            // Check if quantity limit reached
            if (existingItem.quantity >= maxQuantityPerItem) {
                this.showNotification(`Maximum quantity of ${maxQuantityPerItem} reached for this item.`, 'error');
                return;
            }
            existingItem.quantity += 1;
        } else {
            this.items.push({
                id: product.id,
                name: product.name,
                price: parseFloat(product.price),
                image: product.images && product.images[0] ? product.images[0] : '/images/default-gemspot.jpg',
                crystal_type: product.crystal_type || 'Crystal',
                rarity: product.rarity || 'Common',
                quantity: 1
            });
        }
        
        this.saveCart();
        this.updateCartDisplay();
        this.showNotification(`${product.name} added to cart!`, 'success');
    }

    // Remove item from cart
    removeItem(productId) {
        this.items = this.items.filter(item => item.id !== productId);
        this.saveCart();
        this.updateCartDisplay();
        this.showNotification('Item removed from cart', 'info');
    }

    // Update item quantity
    updateQuantity(productId, quantity) {
        const maxQuantityPerItem = this.config.maxQuantityPerItem || 10;
        const item = this.items.find(item => item.id === productId);
        
        if (item) {
            if (quantity <= 0) {
                this.removeItem(productId);
            } else if (quantity > maxQuantityPerItem) {
                this.showNotification(`Maximum quantity of ${maxQuantityPerItem} allowed per item.`, 'error');
            } else {
                item.quantity = quantity;
                this.saveCart();
                this.updateCartDisplay();
            }
        }
    }

    // Get cart subtotal
    getSubtotal() {
        return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    // Get tax amount
    getTax() {
        const taxRate = this.config.taxRate || 0.13; // 13% HST for Ontario
        return this.getSubtotal() * taxRate;
    }

    // Get shipping cost
    getShipping() {
        const subtotal = this.getSubtotal();
        const freeShippingThreshold = this.config.freeShippingThreshold || 100;
        
        // Check if shipping calculator has a selected option
        if (window.shippingCalculator && window.shippingCalculator.selectedOption) {
            return subtotal >= freeShippingThreshold ? 0 : window.shippingCalculator.selectedOption.cost;
        }
        
        // Fallback to default shipping cost
        const defaultShippingCost = this.config.defaultShippingCost || 15;
        return subtotal >= freeShippingThreshold ? 0 : defaultShippingCost;
    }

    // Get cart total (subtotal + tax + shipping)
    getTotal() {
        return this.getSubtotal() + this.getTax() + this.getShipping();
    }

    // Get cart item count
    getItemCount() {
        return this.items.reduce((count, item) => count + item.quantity, 0);
    }

    // Clear cart
    clearCart() {
        this.items = [];
        this.saveCart();
        this.updateCartDisplay();
        this.showNotification('Cart cleared', 'info');
    }

    // Update cart display
    updateCartDisplay() {
        this.updateCartIcon();
        this.updateCartModal();
    }

    // Update cart icon in header
    updateCartIcon() {
        const cartIcon = document.querySelector('.cart-icon');
        const cartCount = document.querySelector('.cart-count');
        
        if (cartIcon && cartCount) {
            const count = this.getItemCount();
            cartCount.textContent = count;
            cartCount.style.display = count > 0 ? 'block' : 'none';
            
            // Add total amount as title attribute for hover
            if (count > 0) {
                const total = this.getTotal();
                const currencySymbol = this.config.currencySymbol || '$';
                cartIcon.title = `Cart Total: ${currencySymbol}${total.toFixed(2)} CAD`;
            } else {
                cartIcon.title = 'Shopping Cart';
            }
        }
    }

    // Update cart modal content
    updateCartModal() {
        const cartModal = document.querySelector('.cart-modal');
        if (!cartModal) return;

        const cartItems = cartModal.querySelector('.cart-items');
        const cartTotal = cartModal.querySelector('.cart-total');
        const cartEmpty = cartModal.querySelector('.cart-empty');

        if (this.items.length === 0) {
            cartItems.innerHTML = '';
            cartTotal.style.display = 'none';
            cartEmpty.style.display = 'block';
        } else {
            cartEmpty.style.display = 'none';
            cartTotal.style.display = 'block';
            
            cartItems.innerHTML = this.items.map(item => `
                <div class="cart-item" data-id="${item.id}">
                    <div class="cart-item-image">
                        <img src="${item.image}" alt="${item.name}" loading="lazy">
                    </div>
                    <div class="cart-item-details">
                        <h4>${item.name}</h4>
                        <p class="crystal-type">${item.crystal_type}</p>
                        <p class="rarity">${item.rarity}</p>
                        <p class="price">$${item.price.toFixed(2)} CAD</p>
                    </div>
                    <div class="cart-item-controls">
                        <button class="quantity-btn" onclick="cart.updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
                        <span class="quantity">${item.quantity}</span>
                        <button class="quantity-btn" onclick="cart.updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
                        <button class="remove-btn" onclick="cart.removeItem(${item.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');

            const subtotal = this.getSubtotal();
            const tax = this.getTax();
            const shipping = this.getShipping();
            const total = this.getTotal();
            const currencySymbol = this.config.currencySymbol || '$';
            
            const freeShippingThreshold = this.config.freeShippingThreshold || 100;
            const remainingForFreeShipping = freeShippingThreshold - subtotal;
            
            cartTotal.innerHTML = `
                ${remainingForFreeShipping > 0 && remainingForFreeShipping <= freeShippingThreshold ? `
                <div class="free-shipping-indicator">
                    <i class="fas fa-truck"></i>
                    Add ${currencySymbol}${remainingForFreeShipping.toFixed(2)} more for FREE shipping!
                </div>
                ` : ''}
                <div class="cart-summary">
                    <div class="summary-row">
                        <span>Subtotal:</span>
                        <span>${currencySymbol}${subtotal.toFixed(2)} CAD</span>
                    </div>
                    <div class="summary-row">
                        <span>Tax (HST 13%):</span>
                        <span>${currencySymbol}${tax.toFixed(2)} CAD</span>
                    </div>
                    <div class="summary-row">
                        <span>Shipping:</span>
                        <span>${shipping === 0 ? 'FREE' : `${currencySymbol}${shipping.toFixed(2)} CAD`}</span>
                    </div>
                    <div class="shipping-display">
                        ${shipping === 0 ? `
                            <div class="free-shipping-badge">
                                <i class="fas fa-truck"></i>
                                FREE Shipping
                            </div>
                        ` : `
                            <button class="select-shipping-btn" onclick="shippingCalculator.showShippingOptions()">
                                <i class="fas fa-shipping-fast"></i>
                                Select Shipping Option
                            </button>
                        `}
                    </div>
                    <div class="summary-row total">
                        <span>Total:</span>
                        <span>${currencySymbol}${total.toFixed(2)} CAD</span>
                    </div>
                </div>
                <button class="btn btn-primary checkout-btn" onclick="cart.proceedToCheckout()">
                    <i class="fas fa-credit-card"></i>
                    Proceed to Checkout
                </button>
            `;
        }
    }

    // Show cart modal
    showCart() {
        const cartModal = document.querySelector('.cart-modal');
        if (cartModal) {
            cartModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    // Hide cart modal
    hideCart() {
        const cartModal = document.querySelector('.cart-modal');
        if (cartModal) {
            cartModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }

    // Proceed to checkout
    async proceedToCheckout() {
        if (this.items.length === 0) {
            this.showNotification('Your cart is empty', 'error');
            return;
        }
        
        // Calculate shipping options if not already done
        if (window.shippingCalculator && !window.shippingCalculator.selectedOption) {
            try {
                await window.shippingCalculator.calculateShipping(this.items, 'CA');
                window.shippingCalculator.showShippingOptions();
                return;
            } catch (error) {
                console.error('Error calculating shipping:', error);
            }
        }
        
        // For now, show a message. Later we'll integrate with Stripe
        this.showNotification('Checkout functionality coming soon!', 'info');
        this.hideCart();
    }

    // Bind events
    bindEvents() {
        // Cart icon click
        document.addEventListener('click', (e) => {
            if (e.target.closest('.cart-icon')) {
                e.preventDefault();
                this.showCart();
            }
        });

        // Close cart modal
        document.addEventListener('click', (e) => {
            if (e.target.closest('.cart-modal-overlay') || e.target.closest('.cart-close')) {
                this.hideCart();
            }
        });

        // Add to cart buttons (using event delegation for dynamic content)
        document.addEventListener('click', (e) => {
            console.log('🛒 Click detected on:', e.target);
            console.log('🛒 Target class:', e.target.className);
            console.log('🛒 Closest add-to-cart-btn:', e.target.closest('.add-to-cart-btn'));
            
            const addToCartBtn = e.target.closest('.add-to-cart-btn');
            
            if (addToCartBtn) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🛒 Add to Cart button clicked!');
                console.log('🛒 Button element:', addToCartBtn);
                console.log('🛒 Button dataset:', addToCartBtn.dataset);
                
                const productId = parseInt(addToCartBtn.dataset.productId);
                console.log('🛒 Product ID:', productId);
                
                const product = this.getProductById(productId);
                console.log('🛒 Product found:', product);
                
                if (product) {
                    this.addItem(product);
                } else {
                    console.error('🛒 Product not found for ID:', productId);
                    this.showNotification('Product not found. Please try again.', 'error');
                }
            }
        });
    }

    // Get product by ID (this will be populated from the main products data)
    getProductById(id) {
        // This will be set by the main.js file
        console.log('🛒 Looking for product ID:', id);
        console.log('🛒 Available products:', window.productsData);
        
        if (!window.productsData) {
            console.error('🛒 No products data available');
            return null;
        }
        
        const product = window.productsData.find(p => p.id === id);
        console.log('🛒 Found product:', product);
        return product;
    }

    // Show notification
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);

        // Remove notification
        const duration = this.config.notificationDuration || 3000;
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

// Initialize cart when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🛒 Initializing shopping cart...');
    window.cart = new ShoppingCart();
    console.log('🛒 Shopping cart initialized:', window.cart);
});
