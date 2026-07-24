// Shared across all pages: hamburger menu, dark mode, toast, and
// session/login-state rendering in the navbar.

function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
  document.getElementById('hamburger').classList.toggle('open');
}
function closeMenu() {
  document.getElementById('navLinks').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
}

function toggleDark() {
  const isDark = document.body.classList.toggle('dark');
  const btn = document.getElementById('darkToggle');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('tt-dark', isDark);
}

(function initDark() {
  if (localStorage.getItem('tt-dark') !== 'true') return;
  document.body.classList.add('dark');
  const applyIcon = () => {
    const btn = document.getElementById('darkToggle');
    if (btn) btn.textContent = '☀️';
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyIcon);
  } else {
    applyIcon();
  }
})();

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let currentUser = null;

async function loadSession() {
  try {
    const res = await apiFetch('/api/auth/me');
    const data = await res.json();
    currentUser = data.user;
  } catch (err) {
    currentUser = null;
  }
  renderAuthArea();
  return currentUser;
}

function renderAuthArea() {
  const area = document.getElementById('authArea');
  if (!area) return;
  if (currentUser) {
    const avatar = currentUser.avatarUrl
      ? `<img src="${API_BASE}${currentUser.avatarUrl}" class="nav-avatar" alt="" />`
      : '';
    area.innerHTML = `
      <a href="profile.html" class="nav-user-link">${avatar}<span class="nav-user">Hi, ${escapeHtml(currentUser.name.split(' ')[0])}</span></a>
      <button type="button" class="nav-auth-btn" onclick="logout()">Logout</button>
    `;
  } else {
    area.innerHTML = `<a href="auth.html" class="nav-auth-btn">Login / Sign Up</a>`;
  }
}

async function logout() {
  await apiFetch('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  renderAuthArea();
  if (typeof onLogout === 'function') onLogout();
}
