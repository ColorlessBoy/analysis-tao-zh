#!/usr/bin/env node
/**
 * Translate sections from EN to ZH using MiniMax mmx
 * With retry on network errors
 */
const fs = require('fs');
const { execSync, spawn } = require('child_process');

const DATA_FILE = './data/sections.json';
const MAX_CHUNK = 17000;

const SYSTEM_LINES = [
  '你是一个数学教科书翻译专家。请将以下英文内容翻译为中文，保持：',
  '1. 数学公式和LaTeX格式完全不变（保留 $...$, $$...$$, \\(, \\), \\[, \\] 等）',
  '2. 数学术语使用标准中文译名（convergence→收敛，limit→极限，sequence→序列，continuous→连续，differentiable→可微，integral→积分，等等）',
  '3. 段落结构保持一致',
  '4. 严谨的数学教材风格',
  '5. 仅输出翻译后的中文内容，不要有任何解释、备注、或翻译说明'
];
const SYSTEM = SYSTEM_LINES.join('\n');

const MAX_RETRIES = 5;
const INITIAL_DELAY = 5000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function mmx_chat(text, retries = MAX_RETRIES) {
  return new Promise((resolve, reject) => {
    const child = spawn('mmx', [
      'text', 'chat',
      '--non-interactive',
      '--output', 'json',
      '--system', SYSTEM,
      '--message', 'user:' + text
    ], { encoding: 'utf8', stderr: 'pipe' });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    child.on('close', (code) => {
      if (code !== 0) {
        const errMsg = stderr || stdout;
        // Check if it's a network error that warrants retry
        const isNetworkError = stderr.includes('Network request failed') ||
                               stderr.includes('ECONNREFUSED') ||
                               stderr.includes('ETIMEDOUT') ||
                               stderr.includes('socket hang up');

        if (isNetworkError && retries > 0) {
          const delay = INITIAL_DELAY * Math.pow(2, MAX_RETRIES - retries);
          console.log(`  Network error, retrying in ${delay/1000}s... (${retries} retries left)`);
          setTimeout(() => {
            mmx_chat(text, retries - 1).then(resolve).catch(reject);
          }, delay);
          return;
        }
        reject(new Error('mmx exit ' + code + ': ' + errMsg.slice(0, 200)));
        return;
      }
      try {
        const obj = JSON.parse(stdout);
        const content = obj.content || [];
        let textContent = '';
        for (let i = content.length - 1; i >= 0; i--) {
          if (content[i].type === 'text') {
            textContent = content[i].text;
            break;
          }
        }
        resolve(textContent);
      } catch (e) {
        reject(new Error('JSON parse error for: ' + stdout.slice(0, 300)));
      }
    });
    child.on('error', (err) => {
      if (retries > 0) {
        const delay = INITIAL_DELAY * Math.pow(2, MAX_RETRIES - retries);
        console.log(`  Spawn error, retrying in ${delay/1000}s... (${retries} retries left)`);
        setTimeout(() => {
          mmx_chat(text, retries - 1).then(resolve).catch(reject);
        }, delay);
      } else {
        reject(err);
      }
    });
  });
}

async function translateText(enText) {
  if (enText.length <= MAX_CHUNK) {
    return await mmx_chat(enText);
  }

  const chunks = [];
  let remaining = enText;

  while (remaining.length > MAX_CHUNK) {
    let splitPos = remaining.indexOf('\n\n', Math.floor(MAX_CHUNK * 0.7));
    if (splitPos === -1) splitPos = remaining.lastIndexOf('. ', MAX_CHUNK);
    if (splitPos === -1) splitPos = remaining.lastIndexOf(' ', MAX_CHUNK);
    if (splitPos === -1 || splitPos < MAX_CHUNK * 0.5) splitPos = MAX_CHUNK;

    chunks.push(remaining.slice(0, splitPos + 1));
    remaining = remaining.slice(splitPos + 1);
  }
  if (remaining.length > 0) chunks.push(remaining);

  let result = '';
  for (let i = 0; i < chunks.length; i++) {
    console.log(`  Chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);
    const zh = await mmx_chat(chunks[i]);
    result += zh;
    if (i < chunks.length - 1) result += '\n\n';
  }
  return result;
}

async function main() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const data = JSON.parse(raw);

  let translatedCount = 0;
  const now = new Date().toISOString();

  for (const chapter of data.chapters) {
    if (chapter.number < 3) continue;

    for (const section of chapter.sections) {
      if (section.content_zh) continue;

      const secId = chapter.number + '.' + section.number;
      let success = false;

      for (let attempt = 1; attempt <= 3 && !success; attempt++) {
        try {
          console.log(`Translating ${secId} "${section.title_en}" (${section.content_en.length} chars EN) [attempt ${attempt}]`);
          const content_zh = await translateText(section.content_en);
          section.content_zh = content_zh;
          section.translated_at = now;
          translatedCount++;

          fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
          console.log(`  ✓ ${secId} done (${content_zh.length} chars ZH)`);
          success = true;
        } catch (err) {
          if (attempt < 3) {
            console.error(`  ! ${secId} attempt ${attempt} failed (${err.message}), retrying...`);
            await sleep(5000);
          } else {
            console.error(`  ✗ ${secId} failed after 3 attempts:`, err.message);
            process.exit(1);
          }
        }
      }
    }

    try {
      execSync(`git add data/sections.json && git commit -m "translate: Ch${chapter.number} ${chapter.title_en} content EN→ZH"`, { cwd: '/home/peng/.openclaw/workspace/analysis-tao-zh' });
      console.log(`\n✓ Chapter ${chapter.number} committed\n`);
    } catch (e) {
      // ignore empty commit
    }
  }

  console.log(`\n=== Done: ${translatedCount} sections translated ===`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});