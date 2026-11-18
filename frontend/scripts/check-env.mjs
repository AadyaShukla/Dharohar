/**
 * Pre-dev environment check for Dharohar frontend.
 * Warns if any VITE_ variables from frontend/.env.example are missing in frontend/.env.
 * Does NOT error out or block development.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

const envExamplePath = path.join(frontendRoot, '.env.example');
const envPath = path.join(frontendRoot, '.env');

function parseViteKeys(filePath) {
  if (!fs.existsSync(filePath)) {
    return new Set();
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const keys = new Set();
  const regex = /^\s*(VITE_[A-Za-z0-9_]+)\s*=/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

function checkFrontendEnv() {
  if (!fs.existsSync(envExamplePath)) {
    // No example file to validate against
    process.exit(0);
  }

  const exampleKeys = parseViteKeys(envExamplePath);
  if (exampleKeys.size === 0) {
    process.exit(0);
  }

  const actualKeys = parseViteKeys(envPath);
  const missingKeys = [];

  for (const key of exampleKeys) {
    if (!actualKeys.has(key)) {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    console.warn('\n' + '='.repeat(70));
    console.warn('⚠️  [Dharohar Frontend] Notice: Missing environment variable(s) in frontend/.env:');
    for (const k of missingKeys) {
      console.warn(`    - ${k}`);
    }
    console.warn('👉 Tip: Run "python -m backend.scripts.setup_env" from the project root');
    console.warn('   or copy frontend/.env.example to frontend/.env.');
    console.warn('='.repeat(70) + '\n');
  } else {
    console.log('✓ [Dharohar Frontend] Environment variables verified.');
  }

  // Non-blocking exit
  process.exit(0);
}

checkFrontendEnv();
