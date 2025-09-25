document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    const loading = document.getElementById('loading');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    
    // Hide previous messages
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
    
    // Show loading
    loginBtn.disabled = true;
    loading.style.display = 'block';
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store token
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('sessionId', data.sessionId);
            
            successMessage.textContent = '¡Inicio de sesión exitoso!';
            successMessage.style.display = 'block';
            
            // Redirect to dashboard with token
            setTimeout(() => {
                window.location.href = `/dashboard?token=${data.token}`;
            }, 1000);
        } else {
            errorMessage.textContent = data.message || 'Error al iniciar sesión';
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Error:', error);
        errorMessage.textContent = 'Error de conexión. Intenta nuevamente.';
        errorMessage.style.display = 'block';
    } finally {
        loginBtn.disabled = false;
        loading.style.display = 'none';
    }
});
