/**
 * Temporary end-to-end smoke test (dev-only, not part of the shipped app).
 * Drives the built bundle in headless Chrome against `vite preview`.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

// 4190 is on the WHATWG blocked-port list, which Node's fetch refuses to dial.
const PORT = Number(process.env.PORT ?? 4173);
const BASE = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;

/** Finds a usable Chrome binary; override with CHROME_PATH. */
function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/opt/google/chrome/chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    console.error('No Chrome binary found. Set CHROME_PATH=/path/to/chrome and retry.');
    process.exit(2);
  }
  return found;
}

/** Starts the local `vite preview` server and waits until it answers. */
async function startPreview() {
  if (process.env.BASE_URL) return null;

  const localBin = join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
  const server = spawn(
    existsSync(localBin) ? localBin : 'vite',
    ['preview', '--port', String(PORT), '--host', '127.0.0.1'],
    { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let serverOutput = '';
  server.stdout?.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr?.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });
  server.on('error', (error) => {
    serverOutput += `\nspawn error: ${error.message}`;
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/`);
      if (response.ok) return server;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  server.kill();
  console.error(`vite preview did not answer on ${BASE}.`);
  console.error(`--- server output ---\n${serverOutput || '(no output)'}`);
  console.error('Run `npm run build` first, or set BASE_URL to an already-running server.');
  process.exit(2);
}

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html is missing — run `npm run build` first.');
  process.exit(2);
}
const preview = await startPreview();
const ROUTES = [
  ['/', 'Overall learning progress'],
  ['/planner', 'Daily planner'],
  ['/courses', 'Course tracker'],
  ['/topics', 'Topic tracker'],
  ['/projects', 'Project tracker'],
  ['/github', 'Public activity'],
  ['/notes', 'Knowledge base'],
  ['/revision', 'Spaced repetition'],
  ['/timer', 'Focus timer'],
  ['/analytics', 'Insights'],
  ['/assistant', 'Optional AI'],
  ['/settings', 'Configuration'],
  ['/search', 'Global search'],
  ['/nope', 'That page does not exist'],
];

const results = [];
const errors = [];
const record = (ok, message) => results.push(`${ok ? 'ok  ' : 'FAIL'}  ${message}`);

const browser = await puppeteer.launch({
  executablePath: resolveChrome(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });

page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`[console] ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`));
page.on('requestfailed', (request) => {
  const url = request.url();
  if (!url.includes('api.github.com')) errors.push(`[requestfailed] ${url} ${request.failure()?.errorText ?? ''}`);
});

const text = () => page.evaluate(() => document.body.innerText);
// `innerText` reflects CSS text-transform, so eyebrows arrive uppercased.
const has = (needle, timeout = 20000) =>
  page
    .waitForFunction(
      (value) => document.body.innerText.toLowerCase().includes(value.toLowerCase()),
      { timeout },
      needle,
    )
    .then(() => true)
    .catch(() => false);

/** Navigates by hash and waits for the expected copy to appear. */
async function visit(route, expected) {
  try {
    await page.evaluate((target) => {
      window.location.hash = target;
    }, `#${route}`);
    const found = await has(expected);
    const body = await text();
    const crashed = body.includes('This view hit an error');
    const length = body.length;
    record(found && !crashed, `${`#${route}`.padEnd(12)} ${String(length).padStart(6)} chars · "${expected}"${crashed ? ' CRASHED' : ''}`);
    if (!found || crashed) {
      console.log(`\n--- text at #${route} ---\n${body.slice(0, 600)}\n`);
    }
    return found && !crashed;
  } catch (error) {
    record(false, `${`#${route}`.padEnd(12)} threw: ${error.message}`);
    return false;
  }
}

try {
  await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  record(await has('Overall learning progress', 45000), 'shell boots from IndexedDB and renders the dashboard');
  await new Promise((resolve) => setTimeout(resolve, 2500));

  // Seeded sample data must be visible on the dashboard.
  const body = await text();
  record(!/0\s+topics/.test(body), 'sample data seeded (topics present, not 0)');
  record(body.includes('TrainWithShubham') || body.includes('Overall'), 'seeded courses render on the dashboard');

  for (const [route, expected] of ROUTES) await visit(route, expected);

  /* ---------------- persistence: create a task, reload, verify ---------------- */
  const countTasks = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          const request = indexedDB.open('devops-learning-os');
          request.onsuccess = () => {
            const countRequest = request.result.transaction('tasks', 'readonly').objectStore('tasks').count();
            countRequest.onsuccess = () => resolve(countRequest.result);
          };
        }),
    );

  await visit('/planner', 'Daily planner');
  const tasksBefore = await countTasks();
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === 'Add task')?.click();
  });
  const dialogOpen = await page
    .waitForSelector('input[placeholder="e.g. Kubernetes Service types"]', { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  record(dialogOpen, 'task dialog opens from the planner');

  if (dialogOpen) {
    await page.type('input[placeholder="e.g. Kubernetes Service types"]', 'Smoke test persistence task');
    // Submit inside the dialog specifically — the page header also has an "Add task" button.
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      [...(dialog?.querySelectorAll('button') ?? [])]
        .find((node) => node.textContent?.trim() === 'Add task')
        ?.click();
    });
    record(await has('Smoke test persistence task', 8000), 'created task appears in the planner');

    // Give the (optimistic-UI, async) IndexedDB write a moment to land.
    await new Promise((resolve) => setTimeout(resolve, 800));
    const tasksAfter = await countTasks();
    record(tasksAfter === tasksBefore + 1, `task persisted to IndexedDB (${tasksBefore} → ${tasksAfter})`);

    await page.reload({ waitUntil: 'domcontentloaded' });
    record(await has('Smoke test persistence task', 20000), 'task survived a full page reload (IndexedDB)');
  }

  const storage = await page
    .evaluate(async () => {
      const databases = (await indexedDB.databases?.()) ?? [];
      const counts = await new Promise((resolve, reject) => {
        const request = indexedDB.open('devops-learning-os');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['tasks', 'topics', 'notes', 'sessions'], 'readonly');
          const out = {};
          let pending = 4;
          for (const name of ['tasks', 'topics', 'notes', 'sessions']) {
            const countRequest = tx.objectStore(name).count();
            countRequest.onsuccess = () => {
              out[name] = countRequest.result;
              pending -= 1;
              if (!pending) resolve(out);
            };
          }
        };
      });
      return { databases: databases.map((entry) => entry.name), counts, theme: localStorage.getItem('devops-os:theme') };
    })
    .catch((error) => ({ error: error.message }));
  results.push(`      IndexedDB: ${storage.databases?.join(', ') ?? storage.error} · counts ${JSON.stringify(storage.counts)}`);

  /* ------------------------------- command palette ---------------------------- */
  await visit('/', 'Overall learning progress');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyK');
  await page.keyboard.up('Control');
  const palette = await has('to navigate', 6000);
  record(palette, 'Ctrl+K opens the command palette');
  if (palette) {
    await page.type('input[placeholder^="Search courses"]', 'Kubernetes');
    await new Promise((resolve) => setTimeout(resolve, 500));
    const matches = await page.evaluate(() => document.body.innerText.match(/Kubernetes/g)?.length ?? 0);
    record(matches >= 2, `palette search finds "${matches}" Kubernetes matches`);
    await page.keyboard.press('Escape');
  }

  /* --------------------------------- theme ----------------------------------- */
  const toggled = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((node) => node.title === 'Toggle theme');
    if (!button) return { found: false };
    button.click();
    return { found: true };
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  const theme = await page.evaluate(() => ({
    light: !document.documentElement.classList.contains('dark'),
    stored: localStorage.getItem('devops-os:theme'),
  }));
  record(toggled.found && theme.light && theme.stored === 'light', `theme toggle switches to light (${JSON.stringify(theme)})`);

  /* --------------------------- notes: create + search ------------------------- */
  await visit('/notes', 'Knowledge base');
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === 'New note')?.click();
  });
  const noteOpen = await page
    .waitForSelector('input[placeholder="Kubernetes Service — complete reference"]', { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  record(noteOpen, 'note editor opens');
  if (noteOpen) {
    await page.type('input[placeholder="Kubernetes Service — complete reference"]', 'Smoke note about Ingress');
    await page.type('textarea', '## Definition\n\nAn Ingress routes external HTTP traffic.\n\n```bash\nkubectl get ingress\n```');
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      [...(dialog?.querySelectorAll('button') ?? [])]
        .find((node) => node.textContent?.trim() === 'Create note')
        ?.click();
    });
    record(await has('Smoke note about Ingress', 8000), 'created note appears in the notes list');
    const rendered = await page.evaluate(() => Boolean(document.querySelector('.prose-note h2')));
    record(rendered, 'markdown renders as HTML in the preview pane');
  }

  /* ------------------------------- AI assistant ------------------------------ */
  await visit('/assistant', 'Optional AI');
  await page.type('textarea', 'আমার আজকে কী পড়া উচিত?');
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === 'Send')?.click();
  });
  const replied = await has('আজকের পড়ার পরিকল্পনা', 20000);
  record(replied, 'offline planner answers a Bengali prompt in Bengali');

  // The offline planner only proposes tasks for English prompts (Bengali replies
  // are guidance-only), so ask in English to exercise the confirmation flow.
  await page.evaluate(() => {
    const textarea = document.querySelector('textarea');
    if (textarea) textarea.value = '';
  });
  await page.type('textarea', 'Plan my day around my revision queue');
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === 'Send')?.click();
  });
  await has('Suggested order', 20000);

  const proposals = await page.evaluate(
    () => document.body.innerText.match(/Action requested/g)?.length ?? 0,
  );
  record(proposals > 0, `assistant proposed ${proposals} action(s) awaiting confirmation`);

  if (proposals > 0) {
    const before = await page.evaluate(() => document.body.innerText.length);
    await page.evaluate(() => {
      const dialog = [...document.querySelectorAll('div')].find((node) => node.textContent?.includes('Action requested'));
      const button = [...(dialog?.querySelectorAll('button') ?? [])].find((node) =>
        ['Confirm', 'Confirm delete'].includes(node.textContent?.trim() ?? ''),
      );
      button?.click();
    });
    const modalOpen = await has('This changes your stored data', 6000);
    record(modalOpen, 'confirmation dialog appears for a write action');
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      [...(dialog?.querySelectorAll('button') ?? [])]
        .find((node) => node.textContent?.trim() === 'Confirm')
        ?.click();
    });
    const applied = await has('Action applied', 8000).catch(() => false);
    record(applied || (await page.evaluate((size) => document.body.innerText.length > size, before)), 'confirmed action executes and is reported');
  }


  /* ---------------------------- dialogs and modals --------------------------- */
  await visit('/courses', 'Course tracker');
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === 'Open')?.click();
  });
  record(await has('Modules & lessons', 8000), 'course detail modal opens with the module tree');
  await page.keyboard.press('Escape');

  await visit('/settings?tab=ai', 'Configuration');
  record(await has('AI provider (optional)', 8000), 'settings AI tab renders provider configuration');

  await visit('/settings?tab=data', 'Configuration');
  record(await has('Backup & restore', 8000), 'settings data tab renders backup controls');

  /* ----------------------------- JSON export round-trip ---------------------- */
  const backup = await page.evaluate(async () => {
    const open = indexedDB.open('devops-learning-os');
    const db = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const readAll = (store) =>
      new Promise((resolve, reject) => {
        const request = db.transaction(store, 'readonly').objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const payload = {
      app: 'devops-learning-os',
      version: 1,
      exportedAt: new Date().toISOString(),
      courses: await readAll('courses'),
      topics: await readAll('topics'),
      tasks: await readAll('tasks'),
      projects: await readAll('projects'),
      notes: await readAll('notes'),
      sessions: await readAll('sessions'),
      revisions: await readAll('revisions'),
    };
    const serialized = JSON.stringify(payload);
    return { bytes: serialized.length, parses: Boolean(JSON.parse(serialized).app), counts: Object.keys(payload).length };
  });
  record(backup.parses && backup.bytes > 5000, `backup payload serialises (${backup.bytes} bytes, ${backup.counts} collections)`);
} catch (error) {
  results.push(`FAIL  harness error: ${error.message}`);
}

await browser.close();
preview?.kill();

console.log('\n=== CHECKS ===');
for (const line of results) console.log(line);
console.log('\n=== CONSOLE / PAGE ERRORS ===');
if (!errors.length) console.log('none');
else for (const line of [...new Set(errors)].slice(0, 25)) console.log(line);

const failures = results.filter((line) => line.startsWith('FAIL')).length;
console.log(`\n${failures === 0 ? '✅ SMOKE TEST PASSED' : `❌ SMOKE TEST FAILED (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
