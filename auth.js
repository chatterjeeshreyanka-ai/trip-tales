document.addEventListener('DOMContentLoaded', redirectIfLoggedIn);

function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
  document.getElementById('hamburger').classList.toggle('open');
}
function closeMenu() {
  document.getElementById('navLinks').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
}

async function redirectIfLoggedIn() {
  try {
    const res = await apiFetch('/api/auth/me');
    const data = await res.json();
    if (data.user) window.location.href = 'index.html';
  } catch (err) {
    // ignore — treat as logged out
  }
}

function switchTab(tab) {
  const loginForm  = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const loginTab   = document.getElementById('loginTab');
  const signupTab  = document.getElementById('signupTab');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
  } else {
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const msg      = document.getElementById('loginMsg');
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed.');

    msg.className = 'auth-msg success';
    msg.textContent = `Welcome back! Logged in as ${data.user.name}`;
    setTimeout(() => { window.location.href = 'index.html'; }, 1200);
  } catch (err) {
    msg.className = 'auth-msg error';
    msg.textContent = err.message;
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const msg      = document.getElementById('signupMsg');
  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm  = document.getElementById('signupConfirm').value;

  if (password !== confirm) {
    msg.className = 'auth-msg error';
    msg.textContent = 'Passwords do not match. Please try again.';
    return;
  }

  try {
    const res = await apiFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed.');

    msg.className = 'auth-msg success';
    msg.textContent = `Account created! Welcome, ${data.user.name}!`;
    setTimeout(() => { window.location.href = 'index.html'; }, 1200);
  } catch (err) {
    msg.className = 'auth-msg error';
    msg.textContent = err.message;
  }
}

function togglePassword(inputId, icon) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    icon.style.opacity = '1';
  } else {
    input.type = 'password';
    icon.style.opacity = '0.5';
  }
}

function socialLogin(provider) {
  alert(`${provider} login is not connected yet. Add OAuth credentials to enable it.`);
}

function showForgotModal(e) {
  e.preventDefault();
  document.getElementById('forgotModal').classList.add('open');
  document.getElementById('forgotMsg').textContent = '';
  document.getElementById('forgotEmail').value = '';
}

function closeForgotModal(e) {
  if (!e || e.target === document.getElementById('forgotModal')) {
    document.getElementById('forgotModal').classList.remove('open');
  }
}

async function sendResetLink(e) {
  e.preventDefault();
  const email = document.getElementById('forgotEmail').value.trim();
  const msg   = document.getElementById('forgotMsg');

  try {
    const res = await apiFetch('/api/auth/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    msg.className = 'auth-msg success';
    msg.textContent = data.message;
  } catch (err) {
    msg.className = 'auth-msg error';
    msg.textContent = 'Could not send reset link right now.';
  }

  setTimeout(() => {
    document.getElementById('forgotModal').classList.remove('open');
  }, 2500);
}

// Password strength meter
const pwInput = document.getElementById('signupPassword');
if (pwInput) {
  pwInput.addEventListener('input', () => {
    const val   = pwInput.value;
    const fill  = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');

    let score = 0;
    if (val.length >= 8)              score++;
    if (/[A-Z]/.test(val))            score++;
    if (/[0-9]/.test(val))            score++;
    if (/[^A-Za-z0-9]/.test(val))     score++;

    const levels = [
      { pct: '0%',   color: '',          text: '' },
      { pct: '25%',  color: '#e53935',   text: 'Weak' },
      { pct: '50%',  color: '#fb8c00',   text: 'Fair' },
      { pct: '75%',  color: '#fdd835',   text: 'Good' },
      { pct: '100%', color: '#43a047',   text: 'Strong' },
    ];

    fill.style.width      = levels[score].pct;
    fill.style.background = levels[score].color;
    label.textContent     = levels[score].text;
    label.style.color     = levels[score].color;
  });
}
