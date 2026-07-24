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

  CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    destination TEXT NOT NULL,
    title TEXT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_chat_public ON chat_messages(recipient_id, id);
  CREATE INDEX IF NOT EXISTS idx_chat_private ON chat_messages(sender_id, recipient_id, id);
`);

// Migrate gallery_items to support user-uploaded photos alongside the
// illustrated seed entries, without breaking the already-populated disk.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('gallery_items', 'image_filename', 'TEXT');
ensureColumn('gallery_items', 'uploader_name', 'TEXT');
ensureColumn('gallery_items', 'user_id', 'INTEGER');
ensureColumn('gallery_items', 'delete_token_hash', 'TEXT');
ensureColumn('voice_entries', 'user_id', 'INTEGER');

// One-off cleanup: remove test photos uploaded while verifying the upload
// feature, before ownership tracking existed.
db.prepare("DELETE FROM gallery_items WHERE image_filename IS NOT NULL AND user_id IS NULL AND delete_token_hash IS NULL")
  .run();

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
  { id: 'puri', name: 'Puri, India', emoji: '🛕', bg: '#fff59d',
    cardDesc: 'Home to the sacred Jagannath Temple and the spectacular Rath Yatra chariot festival, with golden beaches along the Bay of Bengal.',
    fullDesc: "One of Hinduism's Char Dham pilgrimage sites, Puri is anchored by the magnificent Jagannath Temple and comes alive each year during the thunderous Rath Yatra chariot festival. Beyond its spiritual pull, Puri's golden beach on the Bay of Bengal offers a relaxed coastal counterpoint.",
    bestTime: 'October – February', type: 'Spiritual · Beach', idealStay: '2–3 days', tags: ['Spiritual', 'Beach'] },
  { id: 'mayapur', name: 'Mayapur, India', emoji: '🪷', bg: '#ce93d8',
    cardDesc: 'The spiritual headquarters of the Hare Krishna movement, crowned by the awe-inspiring Chandrodaya Mandir on the banks of the Ganges.',
    fullDesc: 'Mayapur is revered as the birthplace of Sri Chaitanya Mahaprabhu and serves as the global headquarters of ISKCON. Pilgrims and visitors are drawn to the soaring Chandrodaya Mandir, serene riverside ghats, and the town\'s deeply devotional atmosphere.',
    bestTime: 'November – March', type: 'Spiritual · Culture', idealStay: '1–2 days', tags: ['Spiritual', 'Culture'] },
  { id: 'kashmir', name: 'Kashmir, India', emoji: '🏔️', bg: '#b3e5fc',
    cardDesc: 'Paradise on Earth — snow-capped peaks, houseboats on Dal Lake, and endless Mughal gardens in the Kashmir Valley.',
    fullDesc: 'Often called "Paradise on Earth," Kashmir enchants with the serene waters of Dal Lake dotted with houseboats and shikaras, the Mughal terraced gardens of Srinagar, and the snow-draped peaks of Gulmarg and Pahalgam. A land of saffron fields, apple orchards, and timeless beauty.',
    bestTime: 'March – October', type: 'Mountains · Nature', idealStay: '4–6 days', tags: ['Mountains', 'Nature'] },
  { id: 'sikkim', name: 'Sikkim, India', emoji: '🏞️', bg: '#c8e6c9',
    cardDesc: 'A Himalayan gem of monasteries, alpine lakes, and views of Kangchenjunga, the world\'s third-highest peak.',
    fullDesc: 'Tucked into the Eastern Himalayas, Sikkim offers pristine monasteries like Rumtek and Pemayangtse, the turquoise waters of Tsomgo Lake, and sweeping views of Kangchenjunga. Gangtok\'s laid-back charm and Yumthang Valley\'s spring blooms make it a haven for nature lovers and pilgrims alike.',
    bestTime: 'March – June, Sept – Dec', type: 'Mountains · Culture', idealStay: '4–5 days', tags: ['Mountains', 'Culture'] },
  { id: 'ladakh', name: 'Ladakh, India', emoji: '🏜️', bg: '#e1f5fe',
    cardDesc: 'A high-altitude desert of dramatic monasteries, turquoise lakes, and some of the world\'s highest motorable passes.',
    fullDesc: 'Ladakh\'s stark Himalayan desert landscape is home to ancient Buddhist monasteries like Thiksey and Hemis, the mesmerising blue of Pangong Tso, and death-defying mountain passes like Khardung La. A land of cold deserts, prayer flags, and unmatched high-altitude adventure.',
    bestTime: 'May – September', type: 'Mountains · Adventure', idealStay: '5–7 days', tags: ['Mountains', 'Adventure'] },
];

const storySeed = [
  { author: 'Ananya S.', destination: 'Haridwar, India', avatar: '👩‍🦱', text: 'Watching the Ganga Aarti at Har Ki Pauri was the most soul-stirring experience of my life. The chants, the flames, the river — pure divinity.', stars: 5 },
  { author: 'Rohan M.', destination: 'Rishikesh, India', avatar: '👨‍🦳', text: 'River rafting on the Ganges in Rishikesh was an absolute thrill! And the evenings doing yoga by the river brought a peace I never knew I needed.', stars: 5 },
  { author: 'Priya R.', destination: 'Varanasi, India', avatar: '👩‍🦰', text: 'Varanasi is like no place on earth. The ancient ghats at sunrise, the floating diyas, the sounds of prayers — it touches something deep in your soul.', stars: 5 },
  { author: 'Karthik V.', destination: 'Vizag, India', avatar: '👨‍🦱', text: "Vizag surprised me completely — the RK Beach at sunset, the Araku Valley coffee, the submarine museum. It's a destination that has it all!", stars: 5 },
  { author: 'Debjani M.', destination: 'Purulia, India', avatar: '👩‍🎨', text: "Watching a live Chhau performance under the open sky in Purulia was unlike anything I'd seen — the masks, the drums, the sheer athleticism. It felt ancient and electric at once.", stars: 5 },
  { author: 'Arjun T.', destination: 'Darjeeling, India', avatar: '👨‍🦰', text: 'Waking up at 4am for the Tiger Hill sunrise over Kangchenjunga was worth every shiver. A cup of fresh Darjeeling tea on the foggy toy train ride afterward sealed it as my favourite hill trip ever.', stars: 5 },
  { author: 'Sanjana K.', destination: 'Puri, India', avatar: '👩‍🦳', text: 'Watching the Rath Yatra chariots roll through Puri amid thousands of chanting devotees was overwhelming in the best way — pure devotion in motion.', stars: 5 },
  { author: 'Gaurav D.', destination: 'Mayapur, India', avatar: '👨‍🦲', text: 'The evening aarti at the Chandrodaya Mandir in Mayapur, with the Ganges flowing right beside it, gave me a sense of peace I still carry with me.', stars: 5 },
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

// Gallery seeding intentionally removed: the illustrated placeholder photos
// have been replaced by real guest uploads, and re-seeding on every restart
// was silently resurrecting them after an admin deleted them.

module.exports = db;
