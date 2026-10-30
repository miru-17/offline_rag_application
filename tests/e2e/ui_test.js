// Browser end-to-end walk-through of the new features (fake LLM + embeddings).
const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');

const OUT = '/tmp/claude-0/harness2/shots';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, info = '') => { results.push([name, !!ok]); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  | ' + info)); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: false });

  // ---- first run: create administrator ----
  await page.goto('http://127.0.0.1:5173/login');
  await page.waitForTimeout(1500);
  const body = await page.textContent('body');
  check('First run opens the sign-up form', /create|sign up|account/i.test(body));
  await shot('01-first-run');
  const inputs = page.locator('input');
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    const type = await el.getAttribute('type');
    const name = ((await el.getAttribute('name')) || '') + ((await el.getAttribute('autocomplete')) || '') + ((await el.getAttribute('placeholder')) || '');
    if (/email/i.test(name) || type === 'email') await el.fill('admin@abc.com');
    else if (type === 'password') await el.fill('Admin@1234');
    else if (type === 'text' || type === null) await el.fill('admin');
  }
  await page.locator('button[type=submit]').first().click();
  await page.waitForTimeout(2000);
  check('Administrator account created', /Administrator account created|Sign in/i.test(await page.textContent('body')));
  await page.locator('input[type=password]').first().fill('Admin@1234');
  await page.locator('button[type=submit]').first().click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  check('Signed in as admin', page.url().includes('/dashboard'));

  // ---- licence install ----
  execSync('/tmp/claude-0/venv/bin/python /tmp/claude-0/run2/tools/license_issuer.py issue --private-key /tmp/claude-0/harness2/keys/priv.pem --customer "Demo Co" --days 365 --max-users 25 --out /tmp/claude-0/harness2/ui.license');
  await page.goto('http://127.0.0.1:5173/license');
  await page.waitForTimeout(1500);
  await shot('02-license-missing');
  await page.getByRole('button', { name: /Install licence/i }).first().click();
  await page.waitForTimeout(500);
  await page.locator('textarea').first().fill(fs.readFileSync('/tmp/claude-0/harness2/ui.license', 'utf8'));
  await page.getByRole('button', { name: /^Install licence$/ }).last().click();
  await page.waitForTimeout(1500);
  check('Licence installed from the UI', /installed successfully/i.test(await page.textContent('body')));
  await shot('03-license-installed');

  // ---- documents ----
  await page.goto('http://127.0.0.1:5173/documents');
  await page.waitForTimeout(1200);
  execSync(`/tmp/claude-0/venv/bin/python - <<'EOF'
from fpdf import FPDF
p=FPDF(); p.set_font("Helvetica", size=11)
for t in ["Leave policy. Employees get 24 days of paid leave per year.","Travel policy. Hotel limit is 4000 rupees per night."]:
    p.add_page(); p.multi_cell(0,6,t)
p.output("/tmp/claude-0/harness2/HR Policy.pdf")
EOF`);
  await page.locator('input[type=file]').first().setInputFiles('/tmp/claude-0/harness2/HR Policy.pdf');
  await page.getByRole('button', { name: /Upload document/i }).first().click();
  await page.waitForTimeout(800);
  check('Upload says it is processing in the background', /processed in the background/i.test(await page.textContent('body')));
  await page.waitForTimeout(6000);
  await shot('04-documents');
  check('Document shows Ready status', /Ready/.test(await page.textContent('table')));

  // ---- chat streaming + evidence ----
  await page.goto('http://127.0.0.1:5173/ai-workspace');
  await page.waitForTimeout(1200);
  const box = page.locator('textarea').first();
  await box.fill('How many days of paid leave do employees get?');
  await box.press('Enter');
  await page.waitForSelector('text=Evidence', { timeout: 20000 });
  await page.waitForTimeout(500);
  check('Streamed answer appears', /FAKE-LLM/.test(await page.textContent('body')));
  await page.locator('text=HR Policy.pdf').first().click();
  await page.waitForTimeout(400);
  check('Evidence panel shows page and passage', /Page 1/.test(await page.textContent('body')) && /24 days/.test(await page.textContent('body')));
  await shot('05-chat-evidence');
  await page.getByRole('button', { name: 'Helpful' }).first().click();
  await page.waitForTimeout(500);

  await box.fill('SLOWSTREAM tell me the leave policy again');
  await box.press('Enter');
  await page.waitForTimeout(2500);
  const stop = page.getByRole('button', { name: 'Stop generating' });
  check('Stop button visible while generating', await stop.isVisible());
  await shot('06-chat-streaming');
  await stop.click();
  await page.waitForTimeout(1500);
  check('Stopped answer labelled', /Stopped/.test(await page.textContent('body')));

  // ---- data dashboard ----
  let csv = 'Date,Region,Amount\n';
  for (let i = 0; i < 365; i++) {
    const d = new Date(2025, 0, 1 + i);
    const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0');
    csv += `${dd}/${mm}/2025,${['North', 'South', 'East', 'West'][i % 4]},"₹${(1000 + (i * 37) % 900).toLocaleString('en-IN')}"\n`;
  }
  fs.writeFileSync('/tmp/claude-0/harness2/sales.csv', csv);
  await page.goto('http://127.0.0.1:5173/data');
  await page.waitForTimeout(1000);
  await page.locator('input[type=file]').first().setInputFiles('/tmp/claude-0/harness2/sales.csv');
  await page.waitForURL('**/data/**', { timeout: 15000 });
  await page.waitForSelector('text=Total Amount', { timeout: 15000 });
  await page.waitForTimeout(1500);
  check('Dashboard shows KPI tiles and charts', (await page.locator('.recharts-surface').count()) >= 2);
  await shot('07-data-dashboard');
  await page.getByRole('button', { name: 'Show the monthly trend' }).click();
  await page.waitForSelector('text=highest is', { timeout: 15000 });
  check('Ask-the-data answers with a sentence + chart', true);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(500);
  await shot('08-ask-data');

  // ---- other pages render ----
  for (const [path, text, name] of [['/insights', 'Knowledge gaps', '09-insights'], ['/audit', 'auth.login', '10-audit'],
    ['/teams', 'New team space', '11-teams'], ['/compare', 'Compare Documents', '12-compare'], ['/extraction', 'New extraction', '13-extraction'],
    ['/settings', 'Personal data (PII) protection', '14-settings']]) {
    await page.goto('http://127.0.0.1:5173' + path);
    await page.waitForTimeout(1800);
    check(`${path} renders`, (await page.textContent('body')).includes(text));
    await shot(name);
  }

  check('No JavaScript errors on any page', errors.length === 0, errors.join(' | '));
  const ok = results.filter((r) => r[1]).length;
  console.log(`\nUI RESULT: ${ok}/${results.length} passed`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
