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

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));
  initFavourites();
});

// ── Dark mode ────────────────────────────────────────
function toggleDark() {
  const isDark = document.body.classList.toggle('dark');
  document.getElementById('darkToggle').textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('tt-dark', isDark);
}

(function initDark() {
  if (localStorage.getItem('tt-dark') === 'true') {
    document.body.classList.add('dark');
    const btn = document.getElementById('darkToggle');
    if (btn) btn.textContent = '☀️';
  }
})();

// ── Hamburger menu ───────────────────────────────────
function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
  document.getElementById('hamburger').classList.toggle('open');
}
function closeMenu() {
  document.getElementById('navLinks').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
}

// ── Toast ────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

// ── Favourites ───────────────────────────────────────
function initFavourites() {
  const favs = JSON.parse(localStorage.getItem('tt-favs') || '[]');
  favs.forEach(id => {
    const btn = document.querySelector(`.fav-btn[onclick*="${id}"]`);
    if (btn) { btn.textContent = '♥'; btn.classList.add('active'); }
  });
}

function toggleFav(e, id) {
  e.stopPropagation();
  const btn  = e.currentTarget;
  const favs = JSON.parse(localStorage.getItem('tt-favs') || '[]');
  const idx  = favs.indexOf(id);
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

// ── Destination search ───────────────────────────────
function searchDestinations(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('#cardsGrid .card').forEach(card => {
    const name = card.dataset.name || '';
    const text = card.innerText.toLowerCase();
    card.style.display = (name.includes(q) || text.includes(q)) ? '' : 'none';
  });
}

// ── Destination detail modal ─────────────────────────
const DEST_DATA = {
  haridwar:  { emoji:'🕉️', bg:'#ffe0b2', name:'Haridwar, India',
    desc:'One of the seven holiest cities in Hinduism, Haridwar sits at the point where the Ganges leaves the Himalayan foothills. The evening Ganga Aarti at Har Ki Pauri is a mesmerising ritual of fire, chants, and flowing diyas.',
    best:'October – March', type:'Spiritual · Pilgrimage', time:'2–3 days' },
  rishikesh: { emoji:'🏞️', bg:'#c8e6c9', name:'Rishikesh, India',
    desc:'Nestled between forested hills and the turquoise Ganges, Rishikesh is the yoga capital of the world. It offers thrilling white-water rafting, bungee jumping, suspension bridges, and tranquil ashrams side by side.',
    best:'September – April', type:'Adventure · Wellness', time:'3–4 days' },
  varanasi:  { emoji:'🪔', bg:'#ffe8cc', name:'Varanasi, India',
    desc:'One of the oldest continuously inhabited cities on earth. The ancient ghats, dawn boat rides on the Ganges, and the hypnotic nightly Aarti create an experience unlike anywhere else in the world.',
    best:'October – March', type:'Spiritual · History', time:'2–3 days' },
  vizag:     { emoji:'🌊', bg:'#b3e5fc', name:'Vizag, India',
    desc:'Visakhapatnam blends mountains, beaches, and city life. Visit the submarine museum, relax on Rushikonda Beach, and take a scenic train to the misty Araku Valley coffee estates.',
    best:'October – February', type:'Beach · Nature', time:'3–5 days' },
  lucknow:   { emoji:'🍢', bg:'#f8bbd0', name:'Lucknow, India',
    desc:'The city of Nawabs carries an unparalleled grace. Explore the Bara Imambara labyrinth, savour world-famous Tunday Kababs, and browse the intricate chikankari embroidery markets.',
    best:'November – February', type:'Culture · Food', time:'2–3 days' },
  agra:      { emoji:'🕌', bg:'#e1f5fe', name:'Agra, India',
    desc:'Home to the Taj Mahal — a UNESCO World Heritage marvel built by Emperor Shah Jahan. Beyond the Taj, Agra Fort and Fatehpur Sikri reveal layers of Mughal grandeur.',
    best:'October – March', type:'History · Architecture', time:'1–2 days' },
  mussoorie: { emoji:'⛰️', bg:'#dcedc8', name:'Mussoorie, India',
    desc:'The Queen of Hills offers panoramic Himalayan views, colonial-era charm on Mall Road, and the roar of Kempty Falls. A perfect escape from the summer plains.',
    best:'March – June, Sept – Nov', type:'Mountains · Nature', time:'2–3 days' },
};

function openDestModal(id) {
  const d   = DEST_DATA[id];
  if (!d) return;
  const box = document.getElementById('destModalBox');
  box.innerHTML = `
    <div class="dm-header" style="background:${d.bg};">
      <span>${d.emoji}</span>
      <button class="dm-close" onclick="closeDestModal()">✕</button>
    </div>
    <div class="dm-body">
      <h2>${d.name}</h2>
      <div class="dm-tags">${d.type.split('·').map(t=>`<span class="tag">${t.trim()}</span>`).join('')}</div>
      <p>${d.desc}</p>
      <div class="dm-info">
        <span>📅 Best time: <strong>${d.best}</strong></span>
        <span>🕐 Ideal stay: <strong>${d.time}</strong></span>
      </div>
    </div>`;
  document.getElementById('destModal').classList.add('open');
}

function closeDestModal(e) {
  if (!e || e.target === document.getElementById('destModal')) {
    document.getElementById('destModal').classList.remove('open');
  }
}

// Gallery filter
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

// Lightbox
function openLightbox(thumbHtml, caption) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightboxThumb').innerHTML = thumbHtml;
  document.getElementById('lightboxCaption').textContent = caption;
  lb.classList.add('open');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      const thumbHtml = item.querySelector('.gallery-thumb').outerHTML;
      const caption   = item.querySelector('.gallery-overlay p').textContent
                      + ' — ' + item.querySelector('.gallery-overlay span').textContent;
      openLightbox(thumbHtml, caption);
    });
  });
});

// Newsletter
function handleSubscribe(event) {
  event.preventDefault();
  const msg = document.getElementById('confirm-msg');
  msg.textContent = 'Thanks for subscribing! Adventure awaits. ✈️';
}

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

// Voice Recorder
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

function submitVoiceEntry() {
  const name = document.getElementById('voice-name').value.trim() || 'Anonymous';
  const destination = document.getElementById('voice-destination').value;
  const status = document.getElementById('recStatus');

  if (!destination) {
    status.textContent = 'Please select a destination before sharing.';
    return;
  }

  if (!recordedBlob) {
    status.textContent = 'No recording found. Please record first.';
    return;
  }

  const url = URL.createObjectURL(recordedBlob);
  addVoiceEntryToFeed(name, destination, url);

  // Reset
  discardRecording();
  document.getElementById('voice-name').value = '';
  document.getElementById('voice-destination').value = '';
  document.getElementById('recTimer').textContent = '00:00';
  status.textContent = 'Your voice entry has been shared!';
}

function discardRecording() {
  recordedBlob = null;
  const preview = document.getElementById('previewAudio');
  preview.src = '';
  document.getElementById('recorderPreview').style.display = 'none';
  document.getElementById('recStatus').textContent = '';
  document.getElementById('recTimer').textContent = '00:00';
}

function addVoiceEntryToFeed(name, destination, audioUrl) {
  const feed = document.getElementById('voiceFeed');

  const noEntries = feed.querySelector('.no-entries');
  if (noEntries) noEntries.remove();

  const now = new Date();
  const timeStr = now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  const entry = document.createElement('div');
  entry.className = 'voice-entry';
  entry.innerHTML = `
    <div class="voice-entry-header">
      <strong>🎙️ ${escapeHtml(name)}</strong>
      <span class="ve-destination">${escapeHtml(destination)}</span>
      <span class="ve-time">${timeStr}</span>
    </div>
    <audio controls src="${audioUrl}"></audio>
  `;
  feed.prepend(entry);
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Show placeholder when feed is empty
window.addEventListener('DOMContentLoaded', () => {
  const feed = document.getElementById('voiceFeed');
  if (feed && feed.children.length === 0) {
    feed.innerHTML = '<p class="no-entries">No voice entries yet — be the first to share yours!</p>';
  }
});
