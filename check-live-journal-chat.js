const { chromium } = require('playwright');
const SITE = 'https://creative-palmier-f29a9c.netlify.app';

async function signupViaUI(page, name, email) {
  await page.goto(`${SITE}/auth.html`, { waitUntil: 'load' });
  await page.click('#signupTab');
  await page.fill('#signupName', name);
  await page.fill('#signupEmail', email);
  await page.fill('#signupPassword', 'password123');
  await page.fill('#signupConfirm', 'password123');
  await page.check('#agreeTerms');
  await page.click('#signupForm button[type="submit"]');
  await page.waitForURL('**/index.html', { timeout: 8000, waitUntil: 'domcontentloaded' });
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  console.log('=== Journal on live site ===');
  const jPage = await browser.newPage();
  jPage.on('pageerror', err => errors.push('journal: ' + err.message));
  await signupViaUI(jPage, 'Live Journal', `livejournal${Date.now()}@example.com`);
  await jPage.waitForSelector('#cardsGrid .card', { timeout: 20000 });
  await jPage.locator('#journal').scrollIntoViewIfNeeded();
  await jPage.waitForFunction(() => document.querySelectorAll('#journal-destination option').length > 1, { timeout: 15000 });
  await jPage.selectOption('#journal-destination', 'mayapur');
  await jPage.fill('#journal-title', 'Live check entry');
  await jPage.fill('#journal-body', 'Verifying the journal feature end to end on production.');
  await jPage.click('.submit-journal-btn');
  await jPage.waitForFunction(() => document.getElementById('journalStatus').textContent.includes('posted'), { timeout: 10000 });
  const journalStatus = await jPage.locator('#journalStatus').textContent();
  await jPage.waitForSelector('.journal-entry-title:has-text("Live check entry")', { timeout: 10000 });
  const hasEntry = await jPage.locator('.journal-entry-title', { hasText: 'Live check entry' }).count();
  await jPage.locator('.journal-delete-btn').first().click({ force: true });
  await jPage.waitForTimeout(1000);
  console.log(JSON.stringify({ journalStatus, hasEntry }));

  console.log('=== Chat on live site (two users) ===');
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  [pageA, pageB].forEach(p => p.on('pageerror', err => errors.push(err.message)));

  const stamp = Date.now();
  await signupViaUI(pageA, 'Live Chat Alice', `livechatalice${stamp}@example.com`);
  await signupViaUI(pageB, 'Live Chat Bob', `livechatbob${stamp}@example.com`);

  await pageA.goto(`${SITE}/chat.html`, { waitUntil: 'load' });
  await pageB.goto(`${SITE}/chat.html`, { waitUntil: 'load' });
  await pageA.waitForSelector('#chatPage[style*="flex"]', { timeout: 8000 });
  await pageB.waitForSelector('#chatPage[style*="flex"]', { timeout: 8000 });

  await pageA.fill('#chatInput', 'Live public hello from Alice');
  await pageA.click('#chatForm button[type="submit"]');
  await pageB.waitForTimeout(5000);
  const bobSeesPublic = await pageB.locator('.chat-bubble-body', { hasText: 'Live public hello from Alice' }).count();

  await pageB.waitForFunction(() => document.querySelectorAll('.chat-thread-btn[data-user-id]').length > 0, { timeout: 8000 });
  await pageB.locator('.chat-thread-btn', { hasText: 'Live Chat Alice' }).click();
  await pageB.waitForTimeout(500);
  await pageB.fill('#chatInput', 'Live private hello to Alice');
  await pageB.click('#chatForm button[type="submit"]');
  await pageB.waitForTimeout(500);

  await pageA.waitForFunction(() => document.querySelectorAll('.chat-thread-btn[data-user-id]').length > 0, { timeout: 8000 });
  await pageA.locator('.chat-thread-btn', { hasText: 'Live Chat Bob' }).click();
  await pageA.waitForTimeout(1000);
  const aliceSeesPrivate = await pageA.locator('.chat-bubble-body', { hasText: 'Live private hello to Alice' }).count();

  console.log(JSON.stringify({ bobSeesPublic: bobSeesPublic > 0, aliceSeesPrivate: aliceSeesPrivate > 0, errors }));

  await browser.close();
})().catch(err => { console.error('FAILED', err.message); process.exit(1); });
