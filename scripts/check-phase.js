import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const VALID_STATUSES = new Set([
  'NOT_STARTED',
  'IN_PROGRESS',
  'VERIFYING',
  'READY_FOR_REVIEW',
  'NEEDS_CHANGES',
  'BLOCKED',
  'ACCEPTED',
]);

const VALID_GATE_STATUSES = new Set(['CLOSED', 'ACCEPTED', 'STALE']);

/**
 * Validates phase-status.json structure and rules
 * @param {string} [statusPath]
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validatePhaseStatus(statusPath = path.join(ROOT_DIR, 'docs/planning/phase-status.json')) {
  const errors = [];

  if (!fs.existsSync(statusPath)) {
    return { isValid: false, errors: [`File not found: ${statusPath}`] };
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  } catch (err) {
    return { isValid: false, errors: [`Invalid JSON in phase-status: ${err.message}`] };
  }

  if (data.schema_version !== 1) {
    errors.push(`Invalid schema_version: expected 1, got ${data.schema_version}`);
  }

  if (!Array.isArray(data.phases) || data.phases.length !== 21) {
    errors.push(`Expected exactly 21 phases (P00-P20), got ${data.phases?.length || 0}`);
    return { isValid: false, errors };
  }

  let foundActive = 0;
  let hasIncompletePredecessor = false;

  for (let i = 0; i <= 20; i++) {
    const expectedId = `P${i.toString().padStart(2, '0')}`;
    const phase = data.phases[i];

    if (!phase || phase.id !== expectedId) {
      errors.push(`Phase at index ${i} has id '${phase?.id}', expected '${expectedId}'`);
      continue;
    }

    if (!VALID_STATUSES.has(phase.status)) {
      errors.push(`Phase ${phase.id} has invalid status '${phase.status}'`);
    }

    // Check dependency sequence: no phase can be IN_PROGRESS, READY_FOR_REVIEW, or ACCEPTED if a prior phase is not ACCEPTED
    if (phase.status !== 'NOT_STARTED') {
      if (hasIncompletePredecessor) {
        errors.push(`Phase ${phase.id} is '${phase.status}' but prior phase is not ACCEPTED (sequential order violated)`);
      }
    }

    if (phase.status !== 'ACCEPTED') {
      hasIncompletePredecessor = true;
    }

    // Check active phase count
    if (['IN_PROGRESS', 'VERIFYING', 'READY_FOR_REVIEW', 'NEEDS_CHANGES', 'BLOCKED'].includes(phase.status)) {
      foundActive++;
    }

    // Check report file existence if phase has started
    if (phase.status !== 'NOT_STARTED') {
      if (!phase.report) {
        errors.push(`Phase ${phase.id} is '${phase.status}' but 'report' is null`);
      } else {
        const fullReportPath = path.resolve(ROOT_DIR, phase.report);
        if (!fs.existsSync(fullReportPath)) {
          errors.push(`Phase ${phase.id} report file does not exist: ${phase.report}`);
        }
      }
    }

    // Check acceptance data
    if (phase.status === 'ACCEPTED') {
      if (!phase.accepted_by || !phase.accepted_on || !phase.accepted_revision) {
        errors.push(`Phase ${phase.id} is ACCEPTED but missing accepted_by, accepted_on, or accepted_revision`);
      }
    }
  }

  // Active phase consistency
  if (data.active_phase) {
    const activeObj = data.phases.find((p) => p.id === data.active_phase);
    if (!activeObj || !['IN_PROGRESS', 'VERIFYING', 'READY_FOR_REVIEW', 'NEEDS_CHANGES', 'BLOCKED'].includes(activeObj.status)) {
      errors.push(`active_phase '${data.active_phase}' does not match any non-ACCEPTED, non-NOT_STARTED phase`);
    }
    if (foundActive > 1) {
      errors.push(`Multiple active phases found (${foundActive}), at most 1 active phase allowed`);
    }
  } else {
    if (foundActive > 0) {
      errors.push(`active_phase is null but found ${foundActive} active phase(s) in phases array`);
    }
  }

  // Gates verification
  const beReady = data.gates?.BE_READY;
  const releaseReady = data.gates?.RELEASE_READY;

  if (!beReady || !VALID_GATE_STATUSES.has(beReady.status)) {
    errors.push(`Invalid BE_READY gate status: ${beReady?.status}`);
  }

  if (beReady?.status === 'ACCEPTED') {
    // P00-P14 must all be ACCEPTED
    for (let i = 0; i <= 14; i++) {
      const pid = `P${i.toString().padStart(2, '0')}`;
      const p = data.phases.find((item) => item.id === pid);
      if (p?.status !== 'ACCEPTED') {
        errors.push(`BE_READY gate cannot be ACCEPTED because ${pid} is not ACCEPTED (${p?.status})`);
      }
    }
  }

  if (releaseReady?.status === 'ACCEPTED') {
    if (beReady?.status !== 'ACCEPTED') {
      errors.push('RELEASE_READY gate cannot be ACCEPTED because BE_READY gate is not ACCEPTED');
    }
    for (let i = 0; i <= 20; i++) {
      const pid = `P${i.toString().padStart(2, '0')}`;
      const p = data.phases.find((item) => item.id === pid);
      if (p?.status !== 'ACCEPTED') {
        errors.push(`RELEASE_READY gate cannot be ACCEPTED because ${pid} is not ACCEPTED (${p?.status})`);
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Checks for premature frontend product code before BE_READY gate
 * @param {string} [rootDir=ROOT_DIR]
 * @returns {{ isClean: boolean, errors: string[] }}
 */
export function checkFrontendGate(rootDir = ROOT_DIR) {
  const errors = [];
  const statusPath = path.join(rootDir, 'docs/planning/phase-status.json');

  let beReadyAccepted = false;
  if (fs.existsSync(statusPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      // ACCEPTED or STALE with valid historical acceptance indicates BE_READY was reached
      beReadyAccepted =
        data.gates?.BE_READY?.status === 'ACCEPTED' ||
        (data.gates?.BE_READY?.status === 'STALE' && Boolean(data.gates?.BE_READY?.accepted_on));
    } catch {
      // JSON error handled elsewhere
    }
  }

  if (!beReadyAccepted) {
    // Check client/src - must not contain frontend implementation files before BE_READY
    const clientSrc = path.join(rootDir, 'client/src');
    if (fs.existsSync(clientSrc)) {
      const files = fs.readdirSync(clientSrc, { recursive: true });
      const codeFiles = files.filter((f) => /\.(jsx|tsx|vue|svelte|css|html)$/i.test(f));
      if (codeFiles.length > 0) {
        errors.push(`Frontend files found in client/src before BE_READY gate is ACCEPTED: ${codeFiles.slice(0, 5).join(', ')}`);
      }
    }

    // Check client/package.json - must not have React production dependencies installed before P15
    const clientPkgPath = path.join(rootDir, 'client/package.json');
    if (fs.existsSync(clientPkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.react || deps['react-dom'] || deps['@vitejs/plugin-react']) {
          errors.push('React dependencies found in client/package.json before BE_READY gate is ACCEPTED');
        }
      } catch {
        // Ignored
      }
    }
  }

  return { isClean: errors.length === 0, errors };
}

export function runChecks() {
  console.log('--- Kiểm tra trạng thái phase và cấu trúc dự án (check-phase) ---');

  const statusCheck = validatePhaseStatus();
  if (!statusCheck.isValid) {
    console.error('❌ Lỗi kiểm tra docs/planning/phase-status.json:');
    statusCheck.errors.forEach((e) => console.error(`  - ${e}`));
  } else {
    console.log('✅ Cấu trúc docs/planning/phase-status.json hợp lệ và tuân thủ thứ tự tuần tự.');
  }

  const frontendCheck = checkFrontendGate();
  if (!frontendCheck.isClean) {
    console.error('❌ Lỗi vi phạm cổng frontend trước BE_READY:');
    frontendCheck.errors.forEach((e) => console.error(`  - ${e}`));
  } else {
    console.log('✅ Kiểm tra cổng frontend: Tuân thủ quy định không triển khai React trước gate BE_READY.');
  }

  if (!statusCheck.isValid || !frontendCheck.isClean) {
    process.exit(1);
  }

  console.log('🎉 Toàn bộ kiểm tra phase và ranh giới hệ thống: ĐẠT CHUẨN.');
}

// Run CLI if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runChecks();
}

