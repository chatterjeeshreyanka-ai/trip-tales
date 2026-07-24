document.addEventListener('DOMContentLoaded', async () => {
  await loadSession();
  if (!currentUser) {
    document.getElementById('profileLoginGate').style.display = 'flex';
    document.getElementById('profilePage').style.display = 'none';
    return;
  }
  document.getElementById('profileLoginGate').style.display = 'none';
  document.getElementById('profilePage').style.display = 'flex';
  fillProfileForm(currentUser);
});

function fillProfileForm(user) {
  document.getElementById('profileName').value = user.name || '';
  document.getElementById('profileEmail').value = user.email || '';
  document.getElementById('profileLocation').value = user.location || '';
  renderProfilePhoto(user.avatarUrl);
}

function renderProfilePhoto(avatarUrl) {
  const img = document.getElementById('profilePhotoPreview');
  const placeholder = document.getElementById('profilePhotoPlaceholder');
  const removeBtn = document.getElementById('removePhotoBtn');
  if (avatarUrl) {
    img.src = API_BASE + avatarUrl;
    img.style.display = 'block';
    placeholder.style.display = 'none';
    removeBtn.style.display = 'inline-block';
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'flex';
    removeBtn.style.display = 'none';
  }
}

async function saveProfile(e) {
  e.preventDefault();
  const msg = document.getElementById('profileMsg');
  const name = document.getElementById('profileName').value.trim();
  const email = document.getElementById('profileEmail').value.trim();
  const location = document.getElementById('profileLocation').value.trim();

  try {
    const res = await apiFetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, location }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save profile.');

    currentUser = data.user;
    renderAuthArea();
    msg.className = 'auth-msg success';
    msg.textContent = 'Profile updated!';
  } catch (err) {
    msg.className = 'auth-msg error';
    msg.textContent = err.message;
  }
}

async function uploadProfilePhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const msg = document.getElementById('profileMsg');

  const formData = new FormData();
  formData.append('photo', file);

  try {
    const res = await apiFetch('/api/profile/photo', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not upload photo.');

    currentUser.avatarUrl = data.avatarUrl;
    renderProfilePhoto(data.avatarUrl);
    renderAuthArea();
    msg.className = 'auth-msg success';
    msg.textContent = 'Photo updated!';
  } catch (err) {
    msg.className = 'auth-msg error';
    msg.textContent = err.message;
  } finally {
    e.target.value = '';
  }
}

async function removeProfilePhoto() {
  const msg = document.getElementById('profileMsg');
  try {
    const res = await apiFetch('/api/profile/photo', { method: 'DELETE' });
    if (!res.ok) throw new Error('Could not remove photo.');
    currentUser.avatarUrl = null;
    renderProfilePhoto(null);
    renderAuthArea();
    msg.className = 'auth-msg success';
    msg.textContent = 'Photo removed.';
  } catch (err) {
    msg.className = 'auth-msg error';
    msg.textContent = err.message;
  }
}
