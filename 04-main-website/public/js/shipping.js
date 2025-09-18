// Canada Post Shipping Calculator
class ShippingCalculator {
    constructor() {
        this.config = window.CART_CONFIG || {};
        this.shippingOptions = [];
        this.selectedOption = null;
    }

    // Calculate shipping options based on cart contents
    async calculateShipping(cartItems, destination) {
        try {
            // Get package dimensions and weight
            const packageInfo = this.calculatePackageInfo(cartItems);
            
            // Canada Post API endpoints (we'll use mock data for now)
            const shippingOptions = await this.getShippingRates(packageInfo, destination);
            
            this.shippingOptions = shippingOptions;
            return shippingOptions;
        } catch (error) {
            console.error('Error calculating shipping:', error);
            return this.getDefaultShippingOptions();
        }
    }

    // Calculate package dimensions and weight
    calculatePackageInfo(cartItems) {
        // Default package dimensions for crystal planters
        const defaultDimensions = {
            length: 12, // inches
            width: 10,
            height: 8,
            weight: 2 // lbs per item
        };

        // Calculate total weight
        const totalWeight = cartItems.reduce((total, item) => {
            return total + (defaultDimensions.weight * item.quantity);
        }, 0);

        // Calculate package dimensions (assuming items are packed efficiently)
        const itemCount = cartItems.reduce((total, item) => total + item.quantity, 0);
        
        return {
            weight: Math.max(totalWeight, 0.5), // Minimum 0.5 lbs
            length: defaultDimensions.length,
            width: defaultDimensions.width,
            height: Math.max(defaultDimensions.height * Math.ceil(itemCount / 2), defaultDimensions.height),
            itemCount: itemCount
        };
    }

    // Get shipping rates from Canada Post (mock implementation)
    async getShippingRates(packageInfo, destination) {
        // Mock shipping rates - in production, this would call Canada Post API
        const baseRates = {
            'Regular Parcel': { base: 8.50, perKg: 2.00, days: '5-7 business days' },
            'Expedited Parcel': { base: 12.00, perKg: 3.00, days: '2-3 business days' },
            'Xpresspost': { base: 15.00, perKg: 4.00, days: '1-2 business days' },
            'Priority': { base: 25.00, perKg: 6.00, days: '1 business day' }
        };

        const shippingOptions = [];
        const weightInKg = packageInfo.weight * 0.453592; // Convert lbs to kg

        for (const [service, rates] of Object.entries(baseRates)) {
            const cost = rates.base + (weightInKg * rates.perKg);
            const finalCost = Math.max(cost, 8.50); // Minimum cost

            shippingOptions.push({
                service: service,
                cost: Math.round(finalCost * 100) / 100, // Round to 2 decimals
                days: rates.days,
                description: this.getServiceDescription(service),
                icon: this.getServiceIcon(service),
                color: this.getServiceColor(service)
            });
        }

        // Sort by cost
        return shippingOptions.sort((a, b) => a.cost - b.cost);
    }

    // Get service description
    getServiceDescription(service) {
        const descriptions = {
            'Regular Parcel': 'Standard shipping with tracking',
            'Expedited Parcel': 'Faster delivery with tracking',
            'Xpresspost': 'Express delivery with tracking and signature',
            'Priority': 'Next business day delivery with tracking and signature'
        };
        return descriptions[service] || 'Standard shipping';
    }

    // Get service icon
    getServiceIcon(service) {
        const icons = {
            'Regular Parcel': 'fas fa-truck',
            'Expedited Parcel': 'fas fa-shipping-fast',
            'Xpresspost': 'fas fa-rocket',
            'Priority': 'fas fa-bolt'
        };
        return icons[service] || 'fas fa-truck';
    }

    // Get service color
    getServiceColor(service) {
        const colors = {
            'Regular Parcel': '#6c757d',
            'Expedited Parcel': '#17a2b8',
            'Xpresspost': '#ffc107',
            'Priority': '#dc3545'
        };
        return colors[service] || '#6c757d';
    }

    // Get default shipping options (fallback)
    getDefaultShippingOptions() {
        return [
            {
                service: 'Regular Parcel',
                cost: 15.00,
                days: '5-7 business days',
                description: 'Standard shipping with tracking',
                icon: 'fas fa-truck',
                color: '#6c757d'
            }
        ];
    }

    // Select shipping option
    selectShippingOption(option) {
        console.log('📦 Selecting shipping option:', option);
        
        // Update visual selection first
        const modal = document.querySelector('.shipping-modal');
        if (modal) {
            // Remove all previous selections
            modal.querySelectorAll('.shipping-option-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            // Add selection to clicked option
            const selectedCard = modal.querySelector(`[data-option="${option.service}"]`);
            if (selectedCard) {
                selectedCard.classList.add('selected');
                console.log('📦 Visual selection updated for:', option.service);
            }
        }
        
        // Update selected option and cart
        this.selectedOption = option;
        this.updateShippingDisplay();
        this.updateCartTotal();
        
        // Close modal automatically after selection
        setTimeout(() => {
            this.closeShippingModal();
        }, 500); // Small delay to show selection feedback
    }

    // Update shipping display in cart
    updateShippingDisplay() {
        const shippingDisplay = document.querySelector('.shipping-display');
        const selectShippingBtn = document.querySelector('.select-shipping-btn');
        
        if (this.selectedOption) {
            // Update shipping display
            if (shippingDisplay) {
                shippingDisplay.innerHTML = `
                    <div class="selected-shipping">
                        <div class="shipping-option">
                            <i class="${this.selectedOption.icon}" style="color: ${this.selectedOption.color}"></i>
                            <span class="shipping-service">${this.selectedOption.service}</span>
                            <span class="shipping-cost">$${this.selectedOption.cost.toFixed(2)} CAD</span>
                        </div>
                        <div class="shipping-details">
                            <small>${this.selectedOption.days}</small>
                            <button class="change-shipping-btn" onclick="shippingCalculator.showShippingOptions()">
                                Change
                            </button>
                        </div>
                    </div>
                `;
            }
            
            // Update select shipping button
            if (selectShippingBtn) {
                selectShippingBtn.innerHTML = `
                    <i class="${this.selectedOption.icon}" style="color: ${this.selectedOption.color}"></i>
                    ${this.selectedOption.service} - $${this.selectedOption.cost.toFixed(2)} CAD
                `;
                selectShippingBtn.onclick = () => this.showShippingOptions();
            }
        }
    }

    // Show shipping options modal
    showShippingOptions() {
        console.log('📦 showShippingOptions called');
        console.log('📦 Shipping options available:', this.shippingOptions);
        
        if (this.shippingOptions.length === 0) {
            console.log('📦 No shipping options available, calculating...');
            this.calculateShipping(window.cart.items, 'CA').then(() => {
                this.createShippingModal();
            }).catch(error => {
                console.error('📦 Error calculating shipping:', error);
                this.createShippingModal(); // Show modal with default options
            });
        } else {
            this.createShippingModal();
        }
    }

    // Create shipping options modal
    createShippingModal() {
        console.log('📦 createShippingModal called');
        console.log('📦 Available shipping options:', this.shippingOptions);
        
        // Remove existing modal
        const existingModal = document.querySelector('.shipping-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHTML = `
            <div class="shipping-modal">
                <div class="shipping-modal-content">
                    <div class="shipping-modal-header">
                        <h3>Choose Shipping Option</h3>
                        <button class="shipping-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="shipping-modal-body">
                        <div class="shipping-options">
                            ${this.shippingOptions.map(option => `
                                <div class="shipping-option-card" 
                                     data-option="${option.service}"
                                     onclick="shippingCalculator.selectShippingOption(${JSON.stringify(option).replace(/"/g, '&quot;')})">
                                    <div class="shipping-option-header">
                                        <i class="${option.icon}" style="color: ${option.color}"></i>
                                        <div class="shipping-option-info">
                                            <h4>${option.service}</h4>
                                            <p>${option.description}</p>
                                        </div>
                                        <div class="shipping-option-price">
                                            $${option.cost.toFixed(2)} CAD
                                        </div>
                                    </div>
                                    <div class="shipping-option-details">
                                        <span class="shipping-days">${option.days}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        console.log('📦 Modal HTML inserted into DOM');
        
        // Wait a bit for DOM to update
        setTimeout(() => {
            const modal = document.querySelector('.shipping-modal');
            if (modal) {
                console.log('📦 Modal found in DOM, showing...');
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
                
                // Force modal to be visible
                modal.style.display = 'flex';
                modal.style.opacity = '1';
                modal.style.visibility = 'visible';
                
                console.log('📦 Modal should now be visible');
                console.log('📦 Modal classes:', modal.className);
                console.log('📦 Modal styles:', {
                    display: modal.style.display,
                    opacity: modal.style.opacity,
                    visibility: modal.style.visibility
                });
            } else {
                console.error('📦 Modal not found after creation');
            }
        }, 100);
        
        this.bindShippingModalEvents();
    }

    // Bind shipping modal events
    bindShippingModalEvents() {
        const modal = document.querySelector('.shipping-modal');
        const closeBtn = document.querySelector('.shipping-close');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                console.log('📦 Closing shipping modal');
                modal.classList.remove('active');
                document.body.style.overflow = 'auto';
                setTimeout(() => modal.remove(), 300);
            });
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    console.log('📦 Closing shipping modal (clicked overlay)');
                    modal.classList.remove('active');
                    document.body.style.overflow = 'auto';
                    setTimeout(() => modal.remove(), 300);
                }
            });
        }
    }

    // Update cart total with shipping
    updateCartTotal() {
        if (window.cart && this.selectedOption) {
            // Update cart's shipping cost
            window.cart.config.defaultShippingCost = this.selectedOption.cost;
            window.cart.updateCartDisplay();
        }
    }

    // Get selected shipping cost
    getSelectedShippingCost() {
        return this.selectedOption ? this.selectedOption.cost : (this.config.defaultShippingCost || 15);
    }

    // Close shipping modal with animation
    closeShippingModal() {
        const modal = document.querySelector('.shipping-modal');
        if (modal) {
            console.log('📦 Closing shipping modal');
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
            setTimeout(() => modal.remove(), 300);
        }
    }
}

// Initialize shipping calculator
document.addEventListener('DOMContentLoaded', () => {
    console.log('📦 Initializing shipping calculator...');
    window.shippingCalculator = new ShippingCalculator();
    console.log('📦 Shipping calculator initialized:', window.shippingCalculator);
});
