// Shopping Cart System
class ShoppingCart {
    constructor() {
        this.config = window.CART_CONFIG || {};
        this.items = this.loadCart();
        this.updateCartDisplay();
        this.bindEvents();
        this.loadAllProducts();
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
    async addItem(product, selectedVariant = null) {
        const maxItems = this.config.maxItems || 50;
        const maxQuantityPerItem = this.config.maxQuantityPerItem || 10;
        
        // Check if cart is full
        if (this.items.length >= maxItems) {
            this.showNotification(`Cart is full! Maximum ${maxItems} items allowed.`, 'error');
            return;
        }
        
        // If product has variants, show variant selection modal
        if (product.hasVariants && product.variants && product.variants.length > 0) {
            if (!selectedVariant) {
                this.showVariantSelectionModal(product);
                return;
            }
        }
        
        // Check stock availability
        try {
            const stockCheck = await this.checkStockAvailability(product.id, 1);
            if (!stockCheck.available) {
                this.showNotification(`Only ${stockCheck.availableStock} units available`, 'error');
                return;
            }
        } catch (error) {
            console.error('🛒 Error checking stock:', error);
            this.showNotification('Error checking stock availability', 'error');
            return;
        }
        
        // Create unique item ID based on variant or product
        const itemId = selectedVariant ? `${product.id}_${selectedVariant.id}` : product.id;
        const existingItem = this.items.find(item => item.id === itemId);
        
        if (existingItem) {
            // Since each pot is unique, we can't add more than 1 of the same variant
            this.showNotification('This unique pot is already in your cart!', 'error');
            return;
        } else {
            const itemData = {
                id: itemId,
                productId: product.id,
                variantId: selectedVariant ? selectedVariant.id : null,
                name: product.name,
                price: selectedVariant ? parseFloat(selectedVariant.price) : parseFloat(product.price),
                image: product.images && product.images[0] ? product.images[0] : '/images/default-gemspot.jpg',
                crystal_type: product.crystal_type || 'Crystal',
                rarity: product.rarity || 'Common',
                quantity: 1,
                variant_code: selectedVariant ? selectedVariant.variant_code : null,
                nft_url: selectedVariant ? selectedVariant.nft_url : product.nftUrl,
                nft_image_url: selectedVariant ? selectedVariant.nft_image_url : product.nftImage
            };
            
            this.items.push(itemData);
        }
        
        // Reserve stock
        await this.reserveStock(product.id, 1);
        
        this.saveCart();
        this.updateCartDisplay();
        const itemName = selectedVariant ? `${product.name} (${selectedVariant.variant_code})` : product.name;
        this.showNotification(`${itemName} added to cart!`, 'success');
    }

    // Remove item from cart
    removeItem(productId) {
        console.log('🗑️ Removing item with ID:', productId, 'Type:', typeof productId);
        console.log('🗑️ Current items before removal:', this.items.map(item => ({ id: item.id, type: typeof item.id })));
        
        // Convert both to string for comparison to handle type mismatches
        this.items = this.items.filter(item => String(item.id) !== String(productId));
        
        console.log('🗑️ Items after removal:', this.items.length);
        
        this.saveCart();
        this.updateCartDisplay();
        this.showNotification('Item removed from cart', 'info');
    }

    // Note: updateQuantity removed since each pot is unique (quantity always 1)

    // Get cart subtotal (each item is unique, so no quantity multiplication)
    getSubtotal() {
        return this.items.reduce((total, item) => total + item.price, 0);
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

    // Get cart item count (each item is unique)
    getItemCount() {
        return this.items.length; // Each item is unique, so just count items
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
                        ${item.variant_code ? `<div class="variant-code">${item.variant_code}</div>` : ''}
                        <p class="crystal-type">${item.crystal_type}</p>
                        <p class="rarity">${item.rarity}</p>
                        <p class="price">$${item.price.toFixed(2)} CAD</p>
                    </div>
                    <div class="cart-item-controls">
                        <span class="quantity">1</span>
                        <span class="unique-badge">Unique</span>
                        <button class="remove-btn">
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
                            <button class="select-shipping-btn" onclick="window.shippingCalculator.showShippingOptions()">
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
        
        try {
            // Prepare checkout data
            const checkoutData = {
                items: this.items,
                shippingInfo: {
                    selectedOption: window.shippingCalculator.selectedOption,
                    cost: window.shippingCalculator.getSelectedShippingCost()
                },
                paymentInfo: {
                    // This would be filled by payment form
                    method: 'credit_card'
                }
            };
            
            console.log('🛒 Proceeding to checkout with data:', checkoutData);
            this.showNotification('Processing your order...', 'info');
            
            // Send checkout request
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(checkoutData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Clear cart after successful checkout
                this.items = [];
                this.saveCart();
                this.updateCartDisplay();
                this.hideCart();
                
                this.showNotification(`Order ${result.orderId} processed successfully!`, 'success');
                
                // Here you would typically redirect to a success page
                console.log('✅ Checkout successful:', result);
            } else {
                this.showNotification(result.message || 'Checkout failed', 'error');
            }
            
        } catch (error) {
            console.error('Error during checkout:', error);
            this.showNotification('Error processing checkout', 'error');
        }
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

        // Remove item buttons (using event delegation for dynamic content)
        document.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-btn');
            
            if (removeBtn) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🗑️ Remove button clicked!');
                
                // Get the cart item container
                const cartItem = removeBtn.closest('.cart-item');
                if (cartItem) {
                    const itemId = cartItem.dataset.id;
                    console.log('🗑️ Removing item with ID:', itemId);
                    this.removeItem(itemId);
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

    // Stock management functions
    async checkStockAvailability(productId, quantity) {
        try {
            const response = await fetch(`/api/stock/check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    productId: productId,
                    quantity: quantity
                })
            });

            if (!response.ok) {
                throw new Error('Failed to check stock');
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error checking stock:', error);
            return { available: false, message: 'Error checking stock' };
        }
    }

    async reserveStock(productId, quantity) {
        try {
            const sessionId = this.getSessionId();
            const response = await fetch(`/api/stock/reserve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: sessionId,
                    productId: productId,
                    quantity: quantity
                })
            });

            if (!response.ok) {
                throw new Error('Failed to reserve stock');
            }

            const result = await response.json();
            console.log('🛒 Stock reserved:', result);
            return result;
        } catch (error) {
            console.error('Error reserving stock:', error);
            return { success: false, message: 'Error reserving stock' };
        }
    }

    async releaseStock(productId, quantity) {
        try {
            const sessionId = this.getSessionId();
            const response = await fetch(`/api/stock/release`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: sessionId,
                    productId: productId,
                    quantity: quantity
                })
            });

            if (!response.ok) {
                throw new Error('Failed to release stock');
            }

            const result = await response.json();
            console.log('🛒 Stock released:', result);
            return result;
        } catch (error) {
            console.error('Error releasing stock:', error);
            return { success: false, message: 'Error releasing stock' };
        }
    }

    getSessionId() {
        // Generate a simple session ID based on browser fingerprint
        let sessionId = localStorage.getItem('cart_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('cart_session_id', sessionId);
        }
        return sessionId;
    }

    // Show variant selection modal
    showVariantSelectionModal(product) {
        const modal = document.createElement('div');
        modal.className = 'variant-selection-modal';
        modal.innerHTML = `
            <div class="variant-modal-overlay">
                <div class="variant-modal-content">
                    <div class="variant-modal-header">
                        <h3>Select Variant - ${product.name}</h3>
                        <button class="variant-modal-close" onclick="this.closest('.variant-selection-modal').remove()">&times;</button>
                    </div>
                    <div class="variant-modal-body">
                        <p class="variant-description">This product has multiple unique variants. Please select the specific variant you want to add to your cart:</p>
                        <div class="variants-list">
                            ${product.variants.map(variant => `
                                <div class="variant-option" data-variant='${JSON.stringify(variant)}'>
                                    <div class="variant-info">
                                        <div class="variant-code"><strong>${variant.variant_code}</strong></div>
                                        <div class="variant-price">$${variant.price.toFixed(2)} CAD</div>
                                        ${variant.nft_url ? `<div class="variant-nft">NFT Available</div>` : ''}
                                    </div>
                                    <div class="variant-actions">
                                        <button class="btn btn-primary btn-select-variant">Select</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners for variant selection
        modal.querySelectorAll('.btn-select-variant').forEach(button => {
            button.addEventListener('click', (e) => {
                const variantOption = e.target.closest('.variant-option');
                const variantData = JSON.parse(variantOption.dataset.variant);
                
                // Close modal
                modal.remove();
                
                // Add item with selected variant
                this.addItem(product, variantData);
            });
        });
        
        // Close modal when clicking overlay
        modal.querySelector('.variant-modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                modal.remove();
            }
        });
    }

    // Load all available products for cart access
    async loadAllProducts() {
        try {
            console.log('🛒 Loading all available products for cart...');
            const response = await fetch('/api/gemspots?source=gallery');
            const data = await response.json();
            
            if (data.success && data.gemspots) {
                window.productsData = data.gemspots;
                console.log('🛒 All products loaded for cart:', window.productsData.length, 'products');
            } else {
                console.warn('🛒 Failed to load all products, using existing data');
            }
        } catch (error) {
            console.error('🛒 Error loading all products:', error);
        }
    }
}

// Initialize cart when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🛒 Initializing shopping cart...');
    window.cart = new ShoppingCart();
    console.log('🛒 Shopping cart initialized:', window.cart);
});
