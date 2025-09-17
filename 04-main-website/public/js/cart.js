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

    // Get cart total
    getTotal() {
        return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
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

            const total = this.getTotal();
            cartTotal.innerHTML = `
                <div class="cart-summary">
                    <div class="summary-row">
                        <span>Subtotal:</span>
                        <span>$${total.toFixed(2)} CAD</span>
                    </div>
                    <div class="summary-row">
                        <span>Shipping:</span>
                        <span>Calculated at checkout</span>
                    </div>
                    <div class="summary-row total">
                        <span>Total:</span>
                        <span>$${total.toFixed(2)} CAD</span>
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
    proceedToCheckout() {
        if (this.items.length === 0) {
            this.showNotification('Your cart is empty', 'error');
            return;
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

        // Add to cart buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('.add-to-cart-btn')) {
                e.preventDefault();
                const button = e.target.closest('.add-to-cart-btn');
                const productId = parseInt(button.dataset.productId);
                const product = this.getProductById(productId);
                if (product) {
                    this.addItem(product);
                }
            }
        });
    }

    // Get product by ID (this will be populated from the main products data)
    getProductById(id) {
        // This will be set by the main.js file
        return window.productsData ? window.productsData.find(p => p.id === id) : null;
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
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize cart when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.cart = new ShoppingCart();
});
