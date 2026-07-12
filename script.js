// ── Scroll progress bar ──────────────────────────────
window.addEventListener('scroll', () => {
  const el   = document.getElementById('scrollProgress');
  const bTop = document.getElementById('backToTop');
  const pct  = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
  if (el) el.style.width = pct + '%';
  if (bTop) bTop.classList.toggle('visible', window.scrollY > 400);
});

// ── Scroll fade-in ───────────────────────────────────
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 80);
      fadeObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

function observeFadeIns() {
  document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));
}

window.addEventListener('DOMContentLoaded', () => {
  loadSession().then(() => { initFavourites(); renderJournalCompose(); });
  loadDestinations();
  loadJournal();
  loadGallery();
  loadVoiceEntries();
});

function onLogout() {
  initFavourites();
  renderJournalCompose();
  showToast('Logged out');
}

// ── Destinations ──────────────────────────────────────
let destinationsById = {};

async function loadDestinations() {
  const grid = document.getElementById('cardsGrid');
  try {
    const res = await apiFetch('/api/destinations');
    const data = await res.json();
    const destinations = data.destinations || [];
    destinationsById = Object.fromEntries(destinations.map(d => [d.id, d]));

    grid.innerHTML = destinations.map(d => `
      <div class="card fade-in" data-name="${d.id}" onclick="openDestModal('${d.id}')">
        <button class="fav-btn" onclick="toggleFav(event,'${d.id}')" title="Favourite">♡</button>
        <div class="card-img" style="background:${d.bg};">${d.emoji}</div>
        <div class="card-body">
          <h3>${escapeHtml(d.name)}</h3>
          <p>${escapeHtml(d.cardDesc)}</p>
          ${d.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
    `).join('');

    observeFadeIns();
    initFavourites();
    populateDestinationSelect('voice-destination', destinations, d => d.name);
    populateDestinationSelect('gallery-destination', destinations, d => d.id);
    renderJournalCompose();
  } catch (err) {
    grid.innerHTML = '<p class="loading-msg">Could not load destinations.</p>';
  }
}

function populateDestinationSelect(selectId, destinations, valueFor) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const options = destinations.map(d => `<option value="${escapeHtml(valueFor(d))}">${escapeHtml(d.name)}</option>`).join('');
  select.innerHTML = '<option value="" disabled selected>Select destination</option>' + options;
}

function openDestModal(id) {
  const d = destinationsById[id];
  if (!d) return;
  const box = document.getElementById('destModalBox');
  box.innerHTML = `
    <div class="dm-header" style="background:${d.bg};">
      <span>${d.emoji}</span>
      <button class="dm-close" onclick="closeDestModal()">✕</button>
    </div>
    <div class="dm-body">
      <h2>${escapeHtml(d.name)}</h2>
      <div class="dm-tags">${d.type.split('·').map(t=>`<span class="tag">${escapeHtml(t.trim())}</span>`).join('')}</div>
      <p>${escapeHtml(d.fullDesc)}</p>
      <div class="dm-info">
        <span>📅 Best time: <strong>${escapeHtml(d.bestTime)}</strong></span>
        <span>🕐 Ideal stay: <strong>${escapeHtml(d.idealStay)}</strong></span>
      </div>
    </div>`;
  document.getElementById('destModal').classList.add('open');
}

function closeDestModal(e) {
  if (!e || e.target === document.getElementById('destModal')) {
    document.getElementById('destModal').classList.remove('open');
  }
}

// ── Destination search ───────────────────────────────
function searchDestinations(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('#cardsGrid .card').forEach(card => {
    const name = card.dataset.name || '';
    const text = card.innerText.toLowerCase();
    card.style.display = (name.includes(q) || text.includes(q)) ? '' : 'none';
  });
}

// ── Favourites ───────────────────────────────────────
async function initFavourites() {
  document.querySelectorAll('.fav-btn').forEach(btn => {
    btn.textContent = '♡';
    btn.classList.remove('active');
  });

  let favs = [];
  if (currentUser) {
    try {
      const res = await apiFetch('/api/favourites');
      const data = await res.json();
      favs = data.favourites || [];
    } catch (err) {
      favs = [];
    }
  } else {
    favs = JSON.parse(localStorage.getItem('tt-favs') || '[]');
  }

  favs.forEach(id => {
    const btn = document.querySelector(`.fav-btn[onclick*="'${id}'"]`);
    if (btn) { btn.textContent = '♥'; btn.classList.add('active'); }
  });
}

async function toggleFav(e, id) {
  e.stopPropagation();
  const btn = e.currentTarget;

  if (currentUser) {
    try {
      const res = await apiFetch(`/api/favourites/${encodeURIComponent(id)}`, { method: 'POST' });
      const data = await res.json();
      if (data.favourited) {
        btn.textContent = '♥'; btn.classList.add('active');
        showToast('Added to favourites ♥');
      } else {
        btn.textContent = '♡'; btn.classList.remove('active');
        showToast('Removed from favourites');
      }
    } catch (err) {
      showToast('Could not update favourites');
    }
    return;
  }

  const favs = JSON.parse(localStorage.getItem('tt-favs') || '[]');
  const idx = favs.indexOf(id);
  if (idx === -1) {
    favs.push(id);
    btn.textContent = '♥';
    btn.classList.add('active');
    showToast('Added to favourites ♥');
  } else {
    favs.splice(idx, 1);
    btn.textContent = '♡';
    btn.classList.remove('active');
    showToast('Removed from favourites');
  }
  localStorage.setItem('tt-favs', JSON.stringify(favs));
}

// ── Stories ──────────────────────────────────────────
// ── Journal ──────────────────────────────────────────
function renderJournalCompose() {
  const box = document.getElementById('journalComposeBox');
  if (!box) return;

  if (currentUser) {
    box.innerHTML = `
      <div class="journal-compose-fields">
        <select id="journal-destination">
          <option value="" disabled selected>Select destination</option>
        </select>
        <input type="text" id="journal-title" placeholder="Title (optional)" maxlength="80" />
      </div>
      <textarea id="journal-body" placeholder="Share your travel story..." rows="4" maxlength="4000"></textarea>
      <button type="button" class="btn submit-journal-btn" onclick="submitJournalEntry()">Post Entry</button>
      <p class="journal-status" id="journalStatus"></p>
    `;
    populateDestinationSelect('journal-destination', Object.values(destinationsById), d => d.id);
  } else {
    box.innerHTML = `<p class="journal-login-prompt">Please <a href="auth.html">log in</a> to share your travel journal.</p>`;
  }
}

async function loadJournal() {
  const feed = document.getElementById('journalFeed');
  try {
    const res = await apiFetch('/api/journal');
    const data = await res.json();
    renderJournalFeed(data.entries || []);
  } catch (err) {
    feed.innerHTML = '<p class="loading-msg">Could not load journal entries.</p>';
  }
}

function renderJournalFeed(entries) {
  const feed = document.getElementById('journalFeed');
  if (!entries.length) {
    feed.innerHTML = '<p class="no-entries">No journal entries yet — be the first to share your story!</p>';
    return;
  }
  feed.innerHTML = entries.map(e => {
    const timeStr = new Date(e.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    return `
      <div class="journal-entry">
        ${e.mine ? `<button class="journal-delete-btn" onclick="deleteJournalEntry(event, ${e.id})" title="Delete entry">✕</button>` : ''}
        <div class="journal-entry-header">
          <strong>${escapeHtml(e.authorName)}</strong>
          <span class="je-destination">${escapeHtml(e.destination)}</span>
          <span class="je-time">${timeStr}</span>
        </div>
        ${e.title ? `<h4 class="journal-entry-title">${escapeHtml(e.title)}</h4>` : ''}
        <p class="journal-entry-body">${escapeHtml(e.body)}</p>
      </div>`;
  }).join('');
}

async function submitJournalEntry() {
  const destination = document.getElementById('journal-destination').value;
  const title       = document.getElementById('journal-title').value.trim();
  const body        = document.getElementById('journal-body').value.trim();
  const status      = document.getElementById('journalStatus');

  if (!destination) { status.textContent = 'Please select a destination.'; return; }
  if (!body) { status.textContent = 'Please write something before posting.'; return; }

  try {
    const res = await apiFetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, title, body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not post your entry.');

    document.getElementById('journal-destination').value = '';
    document.getElementById('journal-title').value = '';
    document.getElementById('journal-body').value = '';
    status.textContent = 'Your journal entry has been posted!';
    loadJournal();
  } catch (err) {
    status.textContent = err.message || 'Could not post your entry.';
  }
}

async function deleteJournalEntry(e, id) {
  e.stopPropagation();
  if (!confirm('Delete this journal entry? This cannot be undone.')) return;

  try {
    const res = await apiFetch(`/api/journal/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not delete entry.');
    showToast('Journal entry deleted');
    loadJournal();
  } catch (err) {
    showToast(err.message || 'Could not delete entry.');
  }
}

// ── Gallery ──────────────────────────────────────────
function getGalleryTokens() {
  return JSON.parse(localStorage.getItem('tt-gallery-tokens') || '{}');
}
function saveGalleryToken(id, token) {
  const tokens = getGalleryTokens();
  tokens[id] = token;
  localStorage.setItem('tt-gallery-tokens', JSON.stringify(tokens));
}
function clearGalleryToken(id) {
  const tokens = getGalleryTokens();
  delete tokens[id];
  localStorage.setItem('tt-gallery-tokens', JSON.stringify(tokens));
}

let galleryItemsCache = [];

async function loadGallery() {
  const grid = document.getElementById('galleryGrid');
  try {
    const res = await apiFetch('/api/gallery');
    const data = await res.json();
    const items = data.items || [];
    galleryItemsCache = items;

    renderGalleryFilters(items);

    const tokens = getGalleryTokens();
    grid.innerHTML = items.map(item => {
      const canDelete = item.mine || Object.prototype.hasOwnProperty.call(tokens, item.id);
      return `
      <div class="gallery-item${item.large ? ' large' : ''}" data-place="${item.place}" data-id="${item.id}">
        ${canDelete ? `<button class="gallery-edit-btn" onclick="editGalleryPhoto(event, ${item.id})" title="Edit caption">✎</button>` : ''}
        ${canDelete ? `<button class="gallery-delete-btn" onclick="deleteGalleryPhoto(event, ${item.id})" title="Delete photo">✕</button>` : ''}
        <div class="gallery-thumb" ${item.imageUrl ? '' : `style="background:linear-gradient(${item.gradient});"`}>
          ${item.imageUrl ? `<img src="${API_BASE}${item.imageUrl}" alt="${escapeHtml(item.caption)}" class="gallery-photo" />` : `<span>${item.emoji}</span>`}
        </div>
        <div class="gallery-overlay">
          <p>${escapeHtml(item.caption)}</p>
          <span>${escapeHtml(item.place.charAt(0).toUpperCase() + item.place.slice(1))}</span>
        </div>
      </div>
    `;
    }).join('');

    document.querySelectorAll('.gallery-item').forEach(item => {
      item.addEventListener('click', () => {
        const galleryItem = galleryItemsCache.find(i => i.id === Number(item.dataset.id));
        if (galleryItem) openLightbox(galleryItem);
      });
    });
  } catch (err) {
    grid.innerHTML = '<p class="loading-msg">Could not load gallery.</p>';
  }
}

function renderGalleryFilters(items) {
  const container = document.getElementById('galleryFilters');
  if (!container) return;
  const places = [...new Set(items.map(i => i.place))];
  const label = place => place.charAt(0).toUpperCase() + place.slice(1);

  container.innerHTML = `<button class="gf-btn active" onclick="filterGallery('all', this)">All</button>`
    + places.map(p => `<button class="gf-btn" onclick="filterGallery('${p}', this)">${escapeHtml(label(p))}</button>`).join('');
}

async function submitGalleryPhoto() {
  const name        = document.getElementById('gallery-name').value.trim();
  const place       = document.getElementById('gallery-destination').value;
  const caption     = document.getElementById('gallery-caption').value.trim();
  const fileInput   = document.getElementById('gallery-photo-input');
  const status      = document.getElementById('galleryUploadStatus');
  const file        = fileInput.files[0];

  if (!place) {
    status.textContent = 'Please select a destination before adding a photo.';
    return;
  }
  if (!file) {
    status.textContent = 'Please choose a photo to upload.';
    return;
  }

  status.textContent = 'Uploading your photo...';

  const formData = new FormData();
  formData.append('image', file);
  formData.append('place', place);
  if (caption) formData.append('caption', caption);
  if (name) formData.append('name', name);

  try {
    const res = await apiFetch('/api/gallery', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed.');

    if (data.item.deleteToken) saveGalleryToken(data.item.id, data.item.deleteToken);

    document.getElementById('gallery-name').value = '';
    document.getElementById('gallery-destination').value = '';
    document.getElementById('gallery-caption').value = '';
    fileInput.value = '';
    status.textContent = 'Photo added to the gallery!';
    loadGallery();
  } catch (err) {
    status.textContent = err.message || 'Could not upload your photo. Please try again.';
  }
}

async function editGalleryPhoto(e, id) {
  e.stopPropagation();

  const item = galleryItemsCache.find(i => i.id === id);
  const newCaption = prompt('Edit caption:', item ? item.caption : '');
  if (newCaption === null) return;

  const tokens = getGalleryTokens();
  try {
    const res = await apiFetch(`/api/gallery/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: newCaption.trim(), deleteToken: tokens[id] || null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not update caption.');

    showToast('Caption updated');
    loadGallery();
  } catch (err) {
    showToast(err.message || 'Could not update caption.');
  }
}

async function deleteGalleryPhoto(e, id) {
  e.stopPropagation();
  if (!confirm('Delete this photo? This cannot be undone.')) return;

  const tokens = getGalleryTokens();
  try {
    const res = await apiFetch(`/api/gallery/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteToken: tokens[id] || null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not delete photo.');

    clearGalleryToken(id);
    showToast('Photo deleted');
    loadGallery();
  } catch (err) {
    showToast(err.message || 'Could not delete photo.');
  }
}

function filterGallery(place, btn) {
  document.querySelectorAll('.gf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.querySelectorAll('.gallery-item').forEach(item => {
    if (place === 'all' || item.dataset.place === place) {
      item.classList.remove('hidden-item');
    } else {
      item.classList.add('hidden-item');
    }
  });
}

const LIGHTBOX_ZOOM_MIN = 1;
const LIGHTBOX_ZOOM_MAX = 4;
const LIGHTBOX_ZOOM_STEP = 0.5;
let lightboxZoomLevel = 1;
let lightboxPanX = 0;
let lightboxPanY = 0;
let lightboxDragging = false;
let lightboxDragStart = { x: 0, y: 0 };
let lightboxPanStart = { x: 0, y: 0 };

function openLightbox(item) {
  const lb = document.getElementById('lightbox');
  const thumb = document.getElementById('lightboxThumb');
  const zoomControls = document.getElementById('lightboxZoomControls');
  const place = item.place.charAt(0).toUpperCase() + item.place.slice(1);

  lightboxZoomLevel = 1;
  lightboxPanX = 0;
  lightboxPanY = 0;

  thumb.innerHTML = item.imageUrl
    ? `<img src="${API_BASE}${item.imageUrl}" alt="${escapeHtml(item.caption)}" class="lightbox-photo" />`
    : `<div class="lightbox-thumb-placeholder" style="background:linear-gradient(${item.gradient});"><span>${item.emoji}</span></div>`;
  document.getElementById('lightboxCaption').textContent = `${item.caption} — ${place}`;

  const img = thumb.querySelector('.lightbox-photo');
  if (img) {
    zoomControls.style.display = 'flex';
    img.addEventListener('wheel', onLightboxWheel, { passive: false });
    img.addEventListener('dblclick', onLightboxDblClick);
    img.addEventListener('pointerdown', onLightboxPointerDown);
    img.addEventListener('pointermove', onLightboxPointerMove);
    img.addEventListener('pointerup', onLightboxPointerUp);
    img.addEventListener('pointerleave', onLightboxPointerUp);
  } else {
    zoomControls.style.display = 'none';
  }

  lb.classList.add('open');
  document.addEventListener('keydown', handleLightboxKeydown);
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.removeEventListener('keydown', handleLightboxKeydown);
}

function handleLightboxKeydown(e) {
  if (e.key === 'Escape') closeLightbox();
}

function setLightboxZoom(newZoom) {
  lightboxZoomLevel = Math.min(LIGHTBOX_ZOOM_MAX, Math.max(LIGHTBOX_ZOOM_MIN, newZoom));
  if (lightboxZoomLevel === 1) {
    lightboxPanX = 0;
    lightboxPanY = 0;
  }
  clampLightboxPan();
  applyLightboxTransform();
}

function zoomLightbox(direction) {
  setLightboxZoom(lightboxZoomLevel + direction * LIGHTBOX_ZOOM_STEP);
}

function resetLightboxZoom() {
  setLightboxZoom(1);
}

function clampLightboxPan() {
  const img = document.querySelector('.lightbox-photo');
  const wrap = document.querySelector('.lightbox-photo-wrap');
  if (!img || !wrap) return;
  const wrapRect = wrap.getBoundingClientRect();
  const maxX = Math.max((img.offsetWidth * lightboxZoomLevel - wrapRect.width) / 2, 0);
  const maxY = Math.max((img.offsetHeight * lightboxZoomLevel - wrapRect.height) / 2, 0);
  lightboxPanX = Math.min(maxX, Math.max(-maxX, lightboxPanX));
  lightboxPanY = Math.min(maxY, Math.max(-maxY, lightboxPanY));
}

function applyLightboxTransform() {
  const img = document.querySelector('.lightbox-photo');
  if (!img) return;
  img.style.transform = `translate(${lightboxPanX}px, ${lightboxPanY}px) scale(${lightboxZoomLevel})`;
  img.classList.toggle('zoomed', lightboxZoomLevel > 1);
}

function onLightboxWheel(e) {
  e.preventDefault();
  setLightboxZoom(lightboxZoomLevel + (e.deltaY < 0 ? LIGHTBOX_ZOOM_STEP : -LIGHTBOX_ZOOM_STEP));
}

function onLightboxDblClick() {
  setLightboxZoom(lightboxZoomLevel > 1 ? 1 : 2);
}

function onLightboxPointerDown(e) {
  if (lightboxZoomLevel <= 1) return;
  lightboxDragging = true;
  e.currentTarget.classList.add('dragging');
  lightboxDragStart = { x: e.clientX, y: e.clientY };
  lightboxPanStart = { x: lightboxPanX, y: lightboxPanY };
  e.currentTarget.setPointerCapture(e.pointerId);
}

function onLightboxPointerMove(e) {
  if (!lightboxDragging) return;
  lightboxPanX = lightboxPanStart.x + (e.clientX - lightboxDragStart.x);
  lightboxPanY = lightboxPanStart.y + (e.clientY - lightboxDragStart.y);
  clampLightboxPan();
  applyLightboxTransform();
}

function onLightboxPointerUp(e) {
  if (!lightboxDragging) return;
  lightboxDragging = false;
  e.currentTarget.classList.remove('dragging');
}

// ── Newsletter ───────────────────────────────────────
async function handleSubscribe(event) {
  event.preventDefault();
  const form  = event.target;
  const email = form.querySelector('input[type="email"]').value.trim();
  const msg   = document.getElementById('confirm-msg');

  try {
    const res = await apiFetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    msg.textContent = data.message || (res.ok ? 'Subscribed!' : 'Something went wrong.');
    if (res.ok) form.reset();
  } catch (err) {
    msg.textContent = 'Could not subscribe right now. Please try again later.';
  }
}

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

// ── Voice Recorder ───────────────────────────────────
let mediaRecorder = null;
let audioChunks = [];
let recordedBlob = null;
let timerInterval = null;
let secondsElapsed = 0;
let isRecording = false;

function toggleRecording() {
  isRecording ? stopRecording() : startRecording();
}

async function startRecording() {
  const status = document.getElementById('recStatus');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      recordedBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(recordedBlob);
      const preview = document.getElementById('previewAudio');
      preview.src = url;
      document.getElementById('recorderPreview').style.display = 'flex';
      stream.getTracks().forEach(t => t.stop());
      status.textContent = 'Recording ready — listen back and share!';
    };

    mediaRecorder.start();
    isRecording = true;

    const btn = document.getElementById('recordBtn');
    btn.innerHTML = '<span class="rec-icon">⏹️</span> Stop Recording';
    btn.classList.add('recording');

    secondsElapsed = 0;
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
    status.textContent = 'Recording in progress...';

  } catch (err) {
    status.textContent = 'Microphone access denied. Please allow microphone permission.';
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  isRecording = false;
  clearInterval(timerInterval);

  const btn = document.getElementById('recordBtn');
  btn.innerHTML = '<span class="rec-icon">🎙️</span> Start Recording';
  btn.classList.remove('recording');
}

function updateTimer() {
  secondsElapsed++;
  const mm = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
  const ss = String(secondsElapsed % 60).padStart(2, '0');
  document.getElementById('recTimer').textContent = `${mm}:${ss}`;
}

async function submitVoiceEntry() {
  const name        = document.getElementById('voice-name').value.trim();
  const destination = document.getElementById('voice-destination').value;
  const status      = document.getElementById('recStatus');

  if (!destination) {
    status.textContent = 'Please select a destination before sharing.';
    return;
  }
  if (!recordedBlob) {
    status.textContent = 'No recording found. Please record first.';
    return;
  }

  status.textContent = 'Uploading your voice entry...';

  const formData = new FormData();
  formData.append('audio', recordedBlob, 'entry.webm');
  formData.append('destination', destination);
  if (name) formData.append('name', name);

  try {
    const res = await apiFetch('/api/voice-entries', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed.');

    discardRecording();
    document.getElementById('voice-name').value = '';
    document.getElementById('voice-destination').value = '';
    document.getElementById('recTimer').textContent = '00:00';
    status.textContent = 'Your voice entry has been shared!';
    loadVoiceEntries();
  } catch (err) {
    status.textContent = err.message || 'Could not share your entry. Please try again.';
  }
}

function discardRecording() {
  recordedBlob = null;
  const preview = document.getElementById('previewAudio');
  preview.src = '';
  document.getElementById('recorderPreview').style.display = 'none';
  document.getElementById('recStatus').textContent = '';
  document.getElementById('recTimer').textContent = '00:00';
}

async function loadVoiceEntries() {
  const feed = document.getElementById('voiceFeed');
  if (!feed) return;
  try {
    const res = await apiFetch('/api/voice-entries');
    const data = await res.json();
    renderVoiceFeed(data.entries || []);
  } catch (err) {
    feed.innerHTML = '<p class="no-entries">Could not load voice entries.</p>';
  }
}

function renderVoiceFeed(entries) {
  const feed = document.getElementById('voiceFeed');
  if (!entries.length) {
    feed.innerHTML = '<p class="no-entries">No voice entries yet — be the first to share yours!</p>';
    return;
  }
  feed.innerHTML = entries.map(entry => {
    const timeStr = new Date(entry.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    return `
      <div class="voice-entry">
        <div class="voice-entry-header">
          <strong>🎙️ ${escapeHtml(entry.name)}</strong>
          <span class="ve-destination">${escapeHtml(entry.destination)}</span>
          <span class="ve-time">${timeStr}</span>
        </div>
        <audio controls src="${API_BASE}${entry.audioUrl}"></audio>
      </div>`;
  }).join('');
}
