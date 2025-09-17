// Main JavaScript for GemSpots Website
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initNavigation();
    initScrollEffects();
    initAnimations();
    loadGallery();
    initContactForm();
    initParticles();
    initParallax();
});

// Navigation functionality
function initNavigation() {
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    // Mobile menu toggle
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });

    // Close mobile menu when clicking on a link
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
        });
    });

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Smooth scrolling for anchor links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            
            // Only handle anchor links (starting with #)
            if (targetId && targetId.startsWith('#')) {
                const targetSection = document.querySelector(targetId);
                
                if (targetSection) {
                    const offsetTop = targetSection.offsetTop - 70; // Account for fixed navbar
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // Active link highlighting
    window.addEventListener('scroll', () => {
        let current = '';
        const sections = document.querySelectorAll('section[id]');
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.offsetHeight;
            
            if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

// Scroll effects and animations
function initScrollEffects() {
    // Intersection Observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
            }
        });
    }, observerOptions);

    // Observe elements for scroll animations
    const scrollElements = document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right');
    scrollElements.forEach(el => observer.observe(el));

    // Parallax scrolling effect
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll('.parallax');
        
        parallaxElements.forEach(element => {
            const speed = element.dataset.speed || 0.5;
            const yPos = -(scrolled * speed);
            element.style.transform = `translateY(${yPos}px)`;
        });
    });
}

// Initialize AOS (Animate On Scroll) library
function initAnimations() {
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-in-out',
            once: true,
            offset: 100
        });
    }

    // Custom animations for hero elements
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        const titleLines = heroTitle.querySelectorAll('.title-line');
        titleLines.forEach((line, index) => {
            line.style.animationDelay = `${0.2 + (index * 0.2)}s`;
        });
    }

    // Crystal showcase animation
    const crystals = document.querySelectorAll('.crystal');
    crystals.forEach((crystal, index) => {
        crystal.style.animationDelay = `${index * 2}s`;
    });
}

// Load gallery data dynamically
async function loadGallery() {
    try {
        const response = await fetch('/api/gemspots');
        const data = await response.json();
        
        if (data.success) {
            displayGallery(data.gemspots.slice(0, 4)); // Show only first 4 items on homepage
        }
    } catch (error) {
        console.error('Error loading gallery:', error);
        displayGalleryError();
    }
}

// Display gallery items
function displayGallery(gemspots) {
    const galleryGrid = document.getElementById('gallery-grid');
    if (!galleryGrid) return;

    galleryGrid.innerHTML = gemspots.map(gemspot => {
        // Get the first image or use a placeholder
        const firstImage = gemspot.images && gemspot.images.length > 0 ? gemspot.images[0] : null;
        const imageUrl = firstImage || '/images/placeholder-gem.jpg';
        
        return `
        <div class="gallery-item hover-lift" data-aos="fade-up" data-aos-delay="${Math.random() * 200}">
            <div class="gallery-image">
                <img src="${imageUrl}" alt="${gemspot.name}" loading="lazy">
                <div class="gallery-overlay">
                    <button class="btn btn-primary" onclick="viewGemspot(${gemspot.id})">
                        <span>View Details</span>
                        <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
            <div class="gallery-content">
                <h3 class="gallery-title">${gemspot.name}</h3>
                <div class="gallery-price">$${gemspot.price} CAD</div>
                <p class="gallery-description">${gemspot.description}</p>
                        <div class="gallery-meta">
                            <span class="crystal-type">
                                <i class="fas fa-gem"></i>
                                ${gemspot.crystal_type || 'Crystal'}
                            </span>
                            <div class="gallery-badges">
                                <span class="rarity ${(gemspot.rarity || 'Common').toLowerCase().replace(' ', '-')}">
                                    ${gemspot.rarity || 'Common'}
                                </span>
                                ${gemspot.nftUrl || gemspot.nftImage ? `
                                <span class="nft-badge">
                                    <i class="fas fa-certificate"></i>
                                    NFT
                                </span>
                                ` : ''}
                            </div>
                        </div>
            </div>
        </div>
        `;
    }).join('');

    // Add hover effects
    const galleryItems = document.querySelectorAll('.gallery-item');
    galleryItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.transform = 'translateY(0) scale(1)';
        });
    });
}

// Display gallery error
function displayGalleryError() {
    const galleryGrid = document.getElementById('gallery-grid');
    if (!galleryGrid) return;

    galleryGrid.innerHTML = `
        <div class="gallery-error">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Unable to load gallery. Please try again later.</p>
        </div>
    `;
}

// View gemspot details
async function viewGemspot(id) {
    try {
        // Fetch product details from API
        const response = await fetch(`/api/gemspots/${id}`);
        const data = await response.json();
        
        if (data.success) {
            showProductModal(data.product);
        } else {
            showNotification('Product not found', 'error');
        }
    } catch (error) {
        console.error('Error fetching product details:', error);
        showNotification('Error loading product details', 'error');
    }
}

// Show product details modal
function showProductModal(product) {
    // Debug: Log product data
    console.log('🔍 Product data for modal:', product);
    console.log('🔍 NFT URL:', product.nftUrl);
    
    // Create modal HTML
    const modalHTML = `
        <div class="product-modal-overlay" onclick="closeProductModal()">
            <div class="product-modal" onclick="event.stopPropagation()">
                <div class="product-modal-header">
                    <h2>${product.name}</h2>
                    <button class="modal-close" onclick="closeProductModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="product-modal-content">
                    <div class="product-modal-images">
                        ${product.images && product.images.length > 0 ? 
                            product.images.map(img => `<img src="${img}" alt="${product.name}" loading="lazy">`).join('') :
                            '<img src="/images/placeholder-gem.jpg" alt="No image available">'
                        }
                    </div>
                    <div class="product-modal-details">
                        <div class="product-price">$${product.price} CAD</div>
                        <p class="product-description">${product.description}</p>
                        <div class="product-specs">
                            <div class="spec-item">
                                <strong>Crystal Type:</strong> ${product.crystal_type || 'N/A'}
                            </div>
                            <div class="spec-item">
                                <strong>Rarity:</strong> ${product.rarity || 'Common'}
                            </div>
                            <div class="spec-item">
                                <strong>Dimensions:</strong> ${product.dimensions || 'N/A'}
                            </div>
                            <div class="spec-item">
                                <strong>Weight:</strong> ${product.weight || 'N/A'}
                            </div>
                            ${product.energy_properties ? `
                            <div class="spec-item">
                                <strong>Energy Properties:</strong> ${product.energy_properties}
                            </div>
                            ` : ''}
                            ${product.personality_target ? `
                            <div class="spec-item">
                                <strong>Target Personality:</strong> ${product.personality_target}
                            </div>
                            ` : ''}
                        </div>
                        <div class="nft-section">
                            <h3 class="nft-title">
                                <i class="fas fa-certificate"></i>
                                NFT Certificate
                            </h3>
                            <div class="nft-content">
                                ${product.nftImage ? `
                                <div class="nft-image">
                                    <img src="${product.nftImage}" alt="NFT Certificate" loading="lazy">
                                </div>
                                ` : `
                                <div class="nft-image">
                                    <div class="nft-placeholder">
                                        <i class="fas fa-image"></i>
                                        <p>No NFT image available</p>
                                    </div>
                                </div>
                                `}
                                <div class="nft-link">
                                    ${product.nftUrl ? `
                                    <a href="${product.nftUrl}" target="_blank" class="btn btn-secondary">
                                        <i class="fas fa-external-link-alt"></i>
                                        View NFT on Blockchain
                                    </a>
                                    ` : `
                                    <div class="nft-link-placeholder">
                                        <i class="fas fa-link"></i>
                                        <p>No blockchain link available</p>
                                    </div>
                                    `}
                                </div>
                            </div>
                        </div>
                        <div class="product-actions">
                            <button class="btn btn-primary" onclick="contactAboutProduct(${product.id})">
                                <i class="fas fa-envelope"></i>
                                Contact About This Product
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add modal styles
    const modalStyles = `
        <style>
        .product-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .product-modal {
            background: white;
            border-radius: 12px;
            max-width: 800px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        
        .product-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #eee;
        }
        
        .product-modal-header h2 {
            margin: 0;
            color: #333;
        }
        
        .modal-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
            padding: 5px;
        }
        
        .modal-close:hover {
            color: #333;
        }
        
        .product-modal-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            padding: 20px;
        }
        
        .product-modal-images {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .product-modal-images img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            border-radius: 8px;
        }
        
        .product-modal-details {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        
        .product-price {
            font-size: 24px;
            font-weight: bold;
            color: #10b981;
        }
        
        .product-specs {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .spec-item {
            padding: 10px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        
        .product-actions {
            margin-top: auto;
        }
        
        .nft-section {
            margin-top: 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 2px solid #e9ecef;
        }
        
        .nft-title {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
            color: #495057;
            font-size: 1.2rem;
        }
        
        .nft-title i {
            color: #6f42c1;
        }
        
        .nft-content {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .nft-image img {
            max-width: 150px;
            height: auto;
            border-radius: 8px;
            border: 2px solid #dee2e6;
            display: block;
            margin: 0 auto;
        }
        
        
        .nft-link {
            text-align: center;
        }
        
        .nft-placeholder,
        .nft-link-placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: #f8f9fa;
            border: 2px dashed #dee2e6;
            border-radius: 8px;
            color: #6c757d;
            min-height: 120px;
        }
        
        .nft-placeholder i,
        .nft-link-placeholder i {
            font-size: 2rem;
            margin-bottom: 8px;
            opacity: 0.5;
        }
        
        .nft-placeholder p,
        .nft-link-placeholder p {
            margin: 0;
            font-size: 0.9rem;
            text-align: center;
        }
        
        @media (max-width: 768px) {
            .product-modal-content {
                grid-template-columns: 1fr;
            }
            
            .nft-content {
                align-items: center;
            }
        }
        </style>
    `;
    
    // Add styles if not already added
    if (!document.querySelector('#product-modal-styles')) {
        const styleElement = document.createElement('div');
        styleElement.id = 'product-modal-styles';
        styleElement.innerHTML = modalStyles;
        document.head.appendChild(styleElement);
    }
}

// Close product modal
function closeProductModal() {
    const modal = document.querySelector('.product-modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// Contact about product
function contactAboutProduct(productId) {
    closeProductModal();
    // Scroll to contact section
    const contactSection = document.querySelector('#contact');
    if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
    }
    showNotification('Please use the contact form below to inquire about this product', 'info');
}

// Contact form functionality
function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) return;

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(contactForm);
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            message: formData.get('message')
        };

        // Show loading state
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span>Sending...</span><i class="fas fa-spinner animate-rotate"></i>';
        submitBtn.disabled = true;

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Show success message
            showNotification('Message sent successfully!', 'success');
            contactForm.reset();
            
        } catch (error) {
            showNotification('Error sending message. Please try again.', 'error');
        } finally {
            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
    `;

    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 5000);
}

// Initialize particle effects
function initParticles() {
    const heroParticles = document.querySelector('.hero-particles');
    if (!heroParticles) return;

    // Create floating particles
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 4 + 2}px;
            height: ${Math.random() * 4 + 2}px;
            background: rgba(255, 255, 255, ${Math.random() * 0.3 + 0.1});
            border-radius: 50%;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation: float ${Math.random() * 10 + 5}s ease-in-out infinite;
            animation-delay: ${Math.random() * 5}s;
        `;
        heroParticles.appendChild(particle);
    }
}

// Initialize parallax effects
function initParallax() {
    const parallaxElements = document.querySelectorAll('[data-parallax]');
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        
        parallaxElements.forEach(element => {
            const speed = parseFloat(element.dataset.parallax) || 0.5;
            const yPos = -(scrolled * speed);
            element.style.transform = `translateY(${yPos}px)`;
        });
    });
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Performance optimizations
const debouncedScroll = debounce(() => {
    // Handle scroll events
}, 16);

const throttledResize = throttle(() => {
    // Handle resize events
}, 250);

window.addEventListener('scroll', debouncedScroll);
window.addEventListener('resize', throttledResize);

// Lazy loading for images
function initLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
}

// Initialize lazy loading when DOM is ready
document.addEventListener('DOMContentLoaded', initLazyLoading);

// Add smooth scrolling to all anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add loading states to buttons
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function() {
        if (this.type === 'submit' || this.classList.contains('loading-btn')) {
            this.classList.add('loading');
            this.disabled = true;
            
            setTimeout(() => {
                this.classList.remove('loading');
                this.disabled = false;
            }, 2000);
        }
    });
});

// Add ripple effect to buttons
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
        `;
        
        this.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
});

// Add CSS for ripple animation
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .btn {
        position: relative;
        overflow: hidden;
    }
    
    .btn.loading {
        opacity: 0.7;
        cursor: not-allowed;
    }
    
    .btn.loading::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 20px;
        height: 20px;
        margin: -10px 0 0 -10px;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
