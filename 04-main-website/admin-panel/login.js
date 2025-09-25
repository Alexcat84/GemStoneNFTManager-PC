const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const messageContainer = document.getElementById('messageContainer');

function showMessage(message, type) {
    messageContainer.innerHTML = `<div class="message ${type}">${message}</div>`;
    setTimeout(() => {
        messageContainer.innerHTML = '';
    }, 5000);
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }
    
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            localStorage.setItem('adminToken', result.token);
            showMessage('Login successful! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = '/admin/dashboard';
            }, 1000);
        } else {
            showMessage(result.message || 'Invalid credentials', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Login failed. Please try again.', 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
});

// Check if already logged in
const token = localStorage.getItem('adminToken');
if (token) {
    // Verify token is still valid
    fetch('/api/admin/verify', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            window.location.href = '/admin/dashboard';
        } else {
            localStorage.removeItem('adminToken');
        }
    })
    .catch(() => {
        localStorage.removeItem('adminToken');
    });
}
