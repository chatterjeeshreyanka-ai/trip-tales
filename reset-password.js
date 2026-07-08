function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
  document.getElementById('hamburger').classList.toggle('open');
}
function closeMenu() {
  document.getElementById('navLinks').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
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

function getResetToken() {
  return new URLSearchParams(window.location.search).get('token');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getResetToken()) {
    const msg = document.getElementById('resetMsg');
    msg.className = 'auth-msg error';
    msg.textContent = 'This reset link is missing its token. Please request a new one from the login page.';
    document.getElementById('resetForm').querySelector('button[type="submit"]').disabled = true;
  }
});

async function handleResetPassword(e) {
  e.preventDefault();
  const msg      = document.getElementById('resetMsg');
  const password = document.getElementById('resetPassword').value;
  const confirm  = document.getElementById('resetConfirm').value;
  const token    = getResetToken();

  if (password !== confirm) {
    msg.className = 'auth-msg error';
    msg.textContent = 'Passwords do not match. Please try again.';
    return;
  }

  try {
    const res = await apiFetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not reset password.');

    msg.className = 'auth-msg success';
    msg.textContent = 'Password reset! Redirecting to login...';
    setTimeout(() => { window.location.href = 'auth.html'; }, 1500);
  } catch (err) {
    msg.className = 'auth-msg error';
    msg.textContent = err.message;
  }
}
