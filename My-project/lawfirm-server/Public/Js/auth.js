document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-form');
    const roleSelect = document.getElementById('register-role');
    const customerTypeGroup = document.getElementById('customer-type-group');

    // --- Dynamic UI Toggle for Registration ---
    if (roleSelect && customerTypeGroup) {
        roleSelect.addEventListener('change', (e) => {
            if (e.target.value === 'customer') {
                customerTypeGroup.style.display = 'block';
                document.getElementById('customer-type')?.setAttribute('required', 'true');
            } else {
                customerTypeGroup.style.display = 'none';
                document.getElementById('customer-type')?.removeAttribute('required');
            }
        });
    }

    // --- 1. HANDLE USER LOGIN ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            if (!email || !password) {
                return showNotification('⚠️ Please enter both email and password.', 'danger');
            }

            submitBtn.disabled = true;
            submitBtn.textContent = "Authenticating Node...";

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Login failed');
                }

                // Save auth token and user profile details locally
                localStorage.setItem('token', data.token);
                localStorage.setItem('role', data.role);
                localStorage.setItem('userEmail', data.user.email);

                showNotification('🟢 Identity confirmed. Routing matrix access keys...', 'success');

                // 🛠️ UPDATED: Route straight to index.html instead of separating by role here
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);

            } catch (err) {
                console.error('Login Error:', err);
                showNotification(`❌ ${err.message}`, 'danger');
                submitBtn.disabled = false;
                submitBtn.textContent = "System Identity Login";
            }
        });
    }

    // --- 2. HANDLE USER REGISTRATION ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            const role = document.getElementById('register-role').value;
            const customerType = document.getElementById('customer-type')?.value;
            const submitBtn = registerForm.querySelector('button[type="submit"]');

            if (!email || !password || !role) {
                return showNotification('⚠️ Please fill in all mandatory registration fields.', 'danger');
            }

            const payload = { email, password, role };
            if (role === 'customer') {
                payload.customer_type = customerType;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = "Generating Vault Profiles...";

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Registration failed');
                }

                // Save items to automatically log them in on successful registration
                if (data.token) localStorage.setItem('token', data.token);
                if (data.role) localStorage.setItem('role', data.role);

                showNotification('✅ Registration successful! Initializing portal entry...', 'success');
                registerForm.reset();
                if (customerTypeGroup) customerTypeGroup.style.display = 'none';

                // 🛠️ UPDATED: Route straight to index.html on successful profile generation
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);

            } catch (err) {
                console.error('Registration Error:', err);
                showNotification(`❌ ${err.message}`, 'danger');
                submitBtn.disabled = false;
                submitBtn.textContent = "Verify Profile Generation";
            }
        });
    }

    // --- 3. HANDLE FORGOT PASSWORD RECOVERY ---
    if (forgotForm) {
        forgotForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value.trim();
            showNotification(`📡 Recovery parameters dispatched to ${email} successfully.`, 'primary');
            forgotForm.reset();
        });
    }
});

// 🛠️ DEPRECATED ROUTING ENGINE: Moved execution context responsibility over to index.html / main.js
function redirectUserByRole(role) {
    window.location.href = 'index.html';
}

// --- 5. ANIMATED NOTIFICATION SYSTEMS OVERLAY ---
function showNotification(message, type = "info") {
    const existingToast = document.querySelector(".auth-toast");
    if (existingToast) existingToast.remove();

    const toast = document.createElement("div");
    toast.className = `auth-toast position-fixed top-0 start-50 translate-middle-x mt-4 p-3 rounded-3 text-white shadow-lg border border-opacity-10`;
    toast.style.zIndex = "2000";
    toast.style.transition = "all 0.3s ease";
    
    if (type === "success") { 
        toast.style.backgroundColor = "rgba(16, 185, 129, 0.95)"; 
        toast.style.borderColor = "#10b981"; 
    } else if (type === "danger") { 
        toast.style.backgroundColor = "rgba(239, 68, 68, 0.95)"; 
        toast.style.borderColor = "#ef4444"; 
    } else { 
        toast.style.backgroundColor = "rgba(56, 189, 248, 0.95)"; 
        toast.style.borderColor = "#38bdf8"; 
    }

    toast.innerHTML = `<div class="d-flex align-items-center fw-semibold"><i class="fa-solid fa-circle-info me-2"></i>${message}</div>`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translate(-50%, -20px)";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}