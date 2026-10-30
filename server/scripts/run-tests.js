import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootTestsDir = path.resolve(__dirname, '../tests');

function findTestFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(findTestFiles(fullPath));
    } else if (item.name.endsWith('.test.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

const allTestFiles = findTestFiles(rootTestsDir);
// Sort: unit tests first, then integration tests
allTestFiles.sort((a, b) => {
  const isAUnit = a.includes('unit');
  const isBUnit = b.includes('unit');
  if (isAUnit && !isBUnit) return -1;
  if (!isAUnit && isBUnit) return 1;
  return a.localeCompare(b);
});

console.log(`Starting execution of ${allTestFiles.length} test files...`);

let failedFiles = [];
let passedFiles = 0;
let totalStartTime = Date.now();

for (let i = 0; i < allTestFiles.length; i++) {
  const file = allTestFiles[i];
  const relPath = path.relative(path.resolve(__dirname, '..'), file).replace(/\\/g, '/');

  let res = spawnSync(process.execPath, ['--test', file], {
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  if (res.status !== 0) {
    // Retry once after 1s for Windows loopback TIME_WAIT socket exhaustion recovery
    console.log(`\n[Retry] Re-running ${relPath} after 1s socket clearance...`);
    spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 1000)']);
    res = spawnSync(process.execPath, ['--test', file], {
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' },
    });
  }

  if (res.status === 0) {
    passedFiles++;
  } else {
    failedFiles.push(relPath);
  }

  // Brief pause for Windows socket release if integration test
  if (!file.includes('unit')) {
    spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 150)']);
  }
}

const totalDuration = ((Date.now() - totalStartTime) / 1000).toFixed(1);
console.log(`\n========================================`);
console.log(`Test Execution Summary:`);
console.log(`Total Files:  ${allTestFiles.length}`);
console.log(`Passed Files: ${passedFiles}`);
console.log(`Failed Files: ${failedFiles.length}`);
console.log(`Duration:     ${totalDuration}s`);
console.log(`========================================\n`);

if (failedFiles.length > 0) {
  console.error(`Failed test files:`);
  for (const f of failedFiles) {
    console.error(` - ${f}`);
  }
  process.exit(1);
} else {
  console.log(`All ${passedFiles} test files PASSED successfully!`);
  process.exit(0);
}
