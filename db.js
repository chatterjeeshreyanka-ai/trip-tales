const Database = require('better-sqlite3');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || __dirname;
const db = new Database(path.join(DATA_DIR, 'data.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS destinations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    bg TEXT NOT NULL,
    card_desc TEXT NOT NULL,
    full_desc TEXT NOT NULL,
    best_time TEXT NOT NULL,
    type TEXT NOT NULL,
    ideal_stay TEXT NOT NULL,
    tags TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT NOT NULL,
    destination TEXT NOT NULL,
    avatar TEXT NOT NULL,
    text TEXT NOT NULL,
    stars INTEGER NOT NULL DEFAULT 5,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gallery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    place TEXT NOT NULL,
    caption TEXT NOT NULL,
    emoji TEXT NOT NULL,
    gradient TEXT NOT NULL,
    large INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS voice_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    destination TEXT NOT NULL,
    filename TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS favourites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    destination TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, destination)
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const destinationSeed = [
  { id: 'haridwar', name: 'Haridwar, India', emoji: '🕉️', bg: '#ffe0b2',
    cardDesc: 'One of the holiest cities in India, where the Ganges descends from the Himalayas — witness the divine Ganga Aarti at dusk.',
    fullDesc: 'One of the seven holiest cities in Hinduism, Haridwar sits at the point where the Ganges leaves the Himalayan foothills. The evening Ganga Aarti at Har Ki Pauri is a mesmerising ritual of fire, chants, and flowing diyas.',
    bestTime: 'October – March', type: 'Spiritual · Pilgrimage', idealStay: '2–3 days', tags: ['Spiritual', 'Culture'] },
  { id: 'rishikesh', name: 'Rishikesh, India', emoji: '🏞️', bg: '#c8e6c9',
    cardDesc: 'The yoga capital of the world, nestled in the Himalayan foothills with thrilling river rafting on the Ganges.',
    fullDesc: 'Nestled between forested hills and the turquoise Ganges, Rishikesh is the yoga capital of the world. It offers thrilling white-water rafting, bungee jumping, suspension bridges, and tranquil ashrams side by side.',
    bestTime: 'September – April', type: 'Adventure · Wellness', idealStay: '3–4 days', tags: ['Adventure', 'Wellness'] },
  { id: 'varanasi', name: 'Varanasi, India', emoji: '🪔', bg: '#ffe8cc',
    cardDesc: 'The eternal city on the Ganges — ancient ghats, glowing diyas, and centuries of spiritual heritage await.',
    fullDesc: 'One of the oldest continuously inhabited cities on earth. The ancient ghats, dawn boat rides on the Ganges, and the hypnotic nightly Aarti create an experience unlike anywhere else in the world.',
    bestTime: 'October – March', type: 'Spiritual · History', idealStay: '2–3 days', tags: ['Spiritual', 'History'] },
  { id: 'vizag', name: 'Vizag, India', emoji: '🌊', bg: '#b3e5fc',
    cardDesc: "Visakhapatnam's pristine beaches, scenic valleys of Araku, and vibrant coastal charm make it a hidden gem of Andhra Pradesh.",
    fullDesc: 'Visakhapatnam blends mountains, beaches, and city life. Visit the submarine museum, relax on Rushikonda Beach, and take a scenic train to the misty Araku Valley coffee estates.',
    bestTime: 'October – February', type: 'Beach · Nature', idealStay: '3–5 days', tags: ['Beach', 'Nature'] },
  { id: 'lucknow', name: 'Lucknow, India', emoji: '🍢', bg: '#f8bbd0',
    cardDesc: 'The city of Nawabs — famous for its Mughal architecture, fragrant biryanis, delicate chikankari craft, and gracious tehzeeb.',
    fullDesc: 'The city of Nawabs carries an unparalleled grace. Explore the Bara Imambara labyrinth, savour world-famous Tunday Kababs, and browse the intricate chikankari embroidery markets.',
    bestTime: 'November – February', type: 'Culture · Food', idealStay: '2–3 days', tags: ['Culture', 'Food'] },
  { id: 'agra', name: 'Agra, India', emoji: '🕌', bg: '#e1f5fe',
    cardDesc: 'Home to the iconic Taj Mahal — a UNESCO World Heritage Site and an eternal symbol of love set on the banks of the Yamuna.',
    fullDesc: 'Home to the Taj Mahal — a UNESCO World Heritage marvel built by Emperor Shah Jahan. Beyond the Taj, Agra Fort and Fatehpur Sikri reveal layers of Mughal grandeur.',
    bestTime: 'October – March', type: 'History · Architecture', idealStay: '1–2 days', tags: ['History', 'Culture'] },
  { id: 'mussoorie', name: 'Mussoorie, India', emoji: '⛰️', bg: '#dcedc8',
    cardDesc: 'The Queen of Hills — misty Himalayan valleys, cascading Kempty Falls, and a charming Mall Road make it a perfect mountain escape.',
    fullDesc: 'The Queen of Hills offers panoramic Himalayan views, colonial-era charm on Mall Road, and the roar of Kempty Falls. A perfect escape from the summer plains.',
    bestTime: 'March – June, Sept – Nov', type: 'Mountains · Nature', idealStay: '2–3 days', tags: ['Mountains', 'Nature'] },
  { id: 'purulia', name: 'Purulia, India', emoji: '🎭', bg: '#ffab91',
    cardDesc: 'A rugged land of red laterite hills and the electrifying Chhau dance — home to the Ajodhya Hills and the ruins of Garpanchakot.',
    fullDesc: "Purulia is West Bengal's rugged frontier — dry deciduous forests, the rolling Ajodhya Hills, and the haunting ruins of Garpanchakot fort. It's best known as the birthplace of the vigorous, mask-clad Chhau dance, a UNESCO-recognised martial art performed under open skies.",
    bestTime: 'November – February', type: 'Culture · Nature', idealStay: '2–3 days', tags: ['Culture', 'Nature'] },
  { id: 'darjeeling', name: 'Darjeeling, India', emoji: '🍃', bg: '#b2dfdb',
    cardDesc: 'Rolling tea gardens, misty peaks, and the UNESCO toy train — the Queen of Hill Stations, crowned by views of Kangchenjunga.',
    fullDesc: 'Perched in the Himalayan foothills, Darjeeling is famous worldwide for its aromatic tea gardens, the heritage narrow-gauge Darjeeling Himalayan Railway ("Toy Train"), and sweeping views of Kangchenjunga, the world\'s third-highest peak, best seen at sunrise from Tiger Hill.',
    bestTime: 'March – May, Oct – Dec', type: 'Mountains · Culture', idealStay: '3–4 days', tags: ['Mountains', 'Culture'] },
];

const storySeed = [
  { author: 'Ananya S.', destination: 'Haridwar, India', avatar: '👩‍🦱', text: 'Watching the Ganga Aarti at Har Ki Pauri was the most soul-stirring experience of my life. The chants, the flames, the river — pure divinity.', stars: 5 },
  { author: 'Rohan M.', destination: 'Rishikesh, India', avatar: '👨‍🦳', text: 'River rafting on the Ganges in Rishikesh was an absolute thrill! And the evenings doing yoga by the river brought a peace I never knew I needed.', stars: 5 },
  { author: 'Priya R.', destination: 'Varanasi, India', avatar: '👩‍🦰', text: 'Varanasi is like no place on earth. The ancient ghats at sunrise, the floating diyas, the sounds of prayers — it touches something deep in your soul.', stars: 5 },
  { author: 'Karthik V.', destination: 'Vizag, India', avatar: '👨‍🦱', text: "Vizag surprised me completely — the RK Beach at sunset, the Araku Valley coffee, the submarine museum. It's a destination that has it all!", stars: 5 },
  { author: 'Debjani M.', destination: 'Purulia, India', avatar: '👩‍🎨', text: "Watching a live Chhau performance under the open sky in Purulia was unlike anything I'd seen — the masks, the drums, the sheer athleticism. It felt ancient and electric at once.", stars: 5 },
  { author: 'Arjun T.', destination: 'Darjeeling, India', avatar: '👨‍🦰', text: 'Waking up at 4am for the Tiger Hill sunrise over Kangchenjunga was worth every shiver. A cup of fresh Darjeeling tea on the foggy toy train ride afterward sealed it as my favourite hill trip ever.', stars: 5 },
];

const gallerySeed = [
  { place: 'haridwar', caption: 'Ganga Aarti', emoji: '🕉️', gradient: '135deg,#ffe0b2,#ffb74d', large: 0 },
  { place: 'haridwar', caption: 'Har Ki Pauri', emoji: '🌊', gradient: '135deg,#ffcc80,#ff8a65', large: 1 },
  { place: 'rishikesh', caption: 'River Rafting', emoji: '🏞️', gradient: '135deg,#c8e6c9,#66bb6a', large: 0 },
  { place: 'rishikesh', caption: 'Yoga Retreat', emoji: '🧘', gradient: '135deg,#a5d6a7,#43a047', large: 0 },
  { place: 'varanasi', caption: 'Evening Aarti', emoji: '🪔', gradient: '135deg,#ffe8cc,#ffab40', large: 1 },
  { place: 'varanasi', caption: 'Boat Ride on Ganges', emoji: '🛶', gradient: '135deg,#ffd180,#ff6d00', large: 0 },
  { place: 'vizag', caption: 'RK Beach', emoji: '🌊', gradient: '135deg,#b3e5fc,#0288d1', large: 0 },
  { place: 'vizag', caption: 'Araku Valley', emoji: '🐚', gradient: '135deg,#81d4fa,#0277bd', large: 1 },
  { place: 'lucknow', caption: 'Bara Imambara', emoji: '🏰', gradient: '135deg,#f8bbd0,#e91e63', large: 0 },
  { place: 'lucknow', caption: 'Tunday Kababs', emoji: '🍢', gradient: '135deg,#f48fb1,#c2185b', large: 0 },
  { place: 'agra', caption: 'Taj Mahal at Sunrise', emoji: '🕌', gradient: '135deg,#e1f5fe,#0288d1', large: 1 },
  { place: 'agra', caption: 'Agra Fort', emoji: '🏯', gradient: '135deg,#bbdefb,#1976d2', large: 0 },
  { place: 'mussoorie', caption: 'Mall Road', emoji: '⛰️', gradient: '135deg,#dcedc8,#558b2f', large: 0 },
  { place: 'mussoorie', caption: 'Kempty Falls', emoji: '💧', gradient: '135deg,#c5e1a5,#33691e', large: 1 },
  { place: 'purulia', caption: 'Chhau Dance', emoji: '🎭', gradient: '135deg,#ffab91,#ff7043', large: 0 },
  { place: 'purulia', caption: 'Ajodhya Hills', emoji: '🏞️', gradient: '135deg,#ffccbc,#d84315', large: 1 },
  { place: 'darjeeling', caption: 'Tea Gardens', emoji: '🍃', gradient: '135deg,#b2dfdb,#00796b', large: 1 },
  { place: 'darjeeling', caption: 'Toy Train', emoji: '🚂', gradient: '135deg,#c8e6c9,#33691e', large: 0 },
];

// INSERT OR IGNORE (keyed on the id primary key) so newly added seed entries
// reach an already-populated database — e.g. after the disk holding
// destinations from a previous deploy is already seeded.
{
  const insert = db.prepare(`
    INSERT OR IGNORE INTO destinations (id, name, emoji, bg, card_desc, full_desc, best_time, type, ideal_stay, tags)
    VALUES (@id, @name, @emoji, @bg, @cardDesc, @fullDesc, @bestTime, @type, @idealStay, @tags)
  `);
  const tx = db.transaction((rows) => {
    for (const r of rows) insert.run({ ...r, tags: JSON.stringify(r.tags) });
  });
  tx(destinationSeed);
}

// Neither table has a natural unique key to hang INSERT OR IGNORE off of, so
// check existence per row instead — keeps this idempotent as more seed
// entries are added later, the same way destinations is handled above.
{
  const insert = db.prepare(`
    INSERT INTO stories (author, destination, avatar, text, stars)
    VALUES (@author, @destination, @avatar, @text, @stars)
  `);
  const exists = db.prepare('SELECT 1 FROM stories WHERE author = ? AND destination = ?');
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      if (!exists.get(r.author, r.destination)) insert.run(r);
    }
  });
  tx(storySeed);
}

{
  const insert = db.prepare(`
    INSERT INTO gallery_items (place, caption, emoji, gradient, large)
    VALUES (@place, @caption, @emoji, @gradient, @large)
  `);
  const exists = db.prepare('SELECT 1 FROM gallery_items WHERE place = ? AND caption = ?');
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      if (!exists.get(r.place, r.caption)) insert.run(r);
    }
  });
  tx(gallerySeed);
}

module.exports = db;
