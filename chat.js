let currentThread = 'public'; // 'public' or a user id (number)
let chatUsers = [];
let pollTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadSession();
  if (!currentUser) {
    document.getElementById('chatLoginGate').style.display = 'flex';
    document.getElementById('chatPage').style.display = 'none';
    return;
  }
  document.getElementById('chatLoginGate').style.display = 'none';
  document.getElementById('chatPage').style.display = 'flex';

  await loadChatUsers();
  await loadMessages();

  pollTimer = setInterval(loadMessages, 4000);
});

async function loadChatUsers() {
  const list = document.getElementById('chatUsersList');
  try {
    const res = await apiFetch('/api/chat/users');
    const data = await res.json();
    chatUsers = data.users || [];

    if (!chatUsers.length) {
      list.innerHTML = '<p class="no-entries">No other users yet.</p>';
      return;
    }
    list.innerHTML = chatUsers.map(u => `
      <button class="chat-thread-btn" data-user-id="${u.id}" onclick="switchThread(${u.id})">
        👤 ${escapeHtml(u.name)}
      </button>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p class="no-entries">Could not load users.</p>';
  }
}

function switchThread(thread) {
  currentThread = thread;

  document.querySelectorAll('.chat-thread-btn').forEach(btn => btn.classList.remove('active'));
  if (thread === 'public') {
    document.getElementById('publicThreadBtn').classList.add('active');
    document.getElementById('chatHeader').textContent = 'Public Chat';
  } else {
    const btn = document.querySelector(`.chat-thread-btn[data-user-id="${thread}"]`);
    if (btn) btn.classList.add('active');
    const user = chatUsers.find(u => u.id === thread);
    document.getElementById('chatHeader').textContent = user ? user.name : 'Direct Message';
  }

  document.getElementById('chatMessages').innerHTML = '<p class="loading-msg">Loading messages...</p>';
  loadMessages();
}

async function loadMessages() {
  const container = document.getElementById('chatMessages');
  const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;

  try {
    const url = currentThread === 'public' ? '/api/chat/public' : `/api/chat/private/${currentThread}`;
    const res = await apiFetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load messages.');

    renderMessages(data.messages || []);
    if (nearBottom) container.scrollTop = container.scrollHeight;
  } catch (err) {
    container.innerHTML = `<p class="no-entries">${escapeHtml(err.message || 'Could not load messages.')}</p>`;
  }
}

function renderMessages(messages) {
  const container = document.getElementById('chatMessages');
  if (!messages.length) {
    container.innerHTML = '<p class="no-entries">No messages yet — say hello!</p>';
    return;
  }
  container.innerHTML = messages.map(m => {
    const timeStr = new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="chat-bubble-row ${m.mine ? 'mine' : ''}">
        <div class="chat-bubble">
          ${!m.mine ? `<span class="chat-bubble-sender">${escapeHtml(m.senderName)}</span>` : ''}
          <span class="chat-bubble-body">${escapeHtml(m.body)}</span>
          <span class="chat-bubble-time">${timeStr}</span>
        </div>
      </div>`;
  }).join('');
}

async function sendChatMessage(e) {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const body = input.value.trim();
  if (!body) return;

  try {
    const url = currentThread === 'public' ? '/api/chat/public' : `/api/chat/private/${currentThread}`;
    const res = await apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not send message.');

    input.value = '';
    await loadMessages();
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
  } catch (err) {
    showToast(err.message || 'Could not send message.');
  }
}
