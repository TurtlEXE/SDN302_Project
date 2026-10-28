import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { validatePhaseStatus, checkFrontendGate } from '../../../scripts/check-phase.js';

describe('Phase Status & Governance Check (Integration)', () => {
  it('should pass validation for the real project phase-status.json', () => {
    const result = validatePhaseStatus();
    assert.equal(result.isValid, true, `Expected valid status, got errors: ${result.errors.join(', ')}`);
    assert.equal(result.errors.length, 0);
  });

  it('should pass frontend gate check for current backend-first state', () => {
    const result = checkFrontendGate();
    assert.equal(result.isClean, true, `Expected clean frontend gate, got errors: ${result.errors.join(', ')}`);
    assert.equal(result.errors.length, 0);
  });

  it('should detect invalid status in phase-status', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-phase-'));
    const tmpFile = path.join(tmpDir, 'phase-status.json');

    const fakeData = {
      schema_version: 1,
      active_phase: 'P01',
      gates: { BE_READY: { status: 'CLOSED' }, RELEASE_READY: { status: 'CLOSED' } },
      phases: Array.from({ length: 21 }, (_, i) => ({
        id: `P${i.toString().padStart(2, '0')}`,
        status: i === 0 ? 'ACCEPTED' : i === 1 ? 'INVALID_STATUS_XYZ' : 'NOT_STARTED',
        report: i === 0 ? 'docs/phase-reports/P00.md' : null,
        accepted_by: i === 0 ? 'Reviewer' : null,
        accepted_on: i === 0 ? '2026-10-28' : null,
        accepted_revision: i === 0 ? 'hash' : null,
      })),
    };

    fs.writeFileSync(tmpFile, JSON.stringify(fakeData), 'utf8');

    const result = validatePhaseStatus(tmpFile);
    assert.equal(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes("invalid status 'INVALID_STATUS_XYZ'")));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should detect multiple active phases', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-phase-'));
    const tmpFile = path.join(tmpDir, 'phase-status.json');

    const fakeData = {
      schema_version: 1,
      active_phase: 'P01',
      gates: { BE_READY: { status: 'CLOSED' }, RELEASE_READY: { status: 'CLOSED' } },
      phases: Array.from({ length: 21 }, (_, i) => ({
        id: `P${i.toString().padStart(2, '0')}`,
        status: i === 0 ? 'ACCEPTED' : (i === 1 || i === 2) ? 'IN_PROGRESS' : 'NOT_STARTED',
        report: i === 0 ? 'docs/phase-reports/P00.md' : null,
        accepted_by: i === 0 ? 'Reviewer' : null,
        accepted_on: i === 0 ? '2026-10-28' : null,
        accepted_revision: i === 0 ? 'hash' : null,
      })),
    };

    fs.writeFileSync(tmpFile, JSON.stringify(fakeData), 'utf8');

    const result = validatePhaseStatus(tmpFile);
    assert.equal(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes('Multiple active phases found')));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should detect premature React frontend implementation files before BE_READY', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-gate-'));
    const docsPlanning = path.join(tmpDir, 'docs/planning');
    fs.mkdirSync(docsPlanning, { recursive: true });

    // Status with BE_READY CLOSED
    fs.writeFileSync(
      path.join(docsPlanning, 'phase-status.json'),
      JSON.stringify({
        schema_version: 1,
        gates: { BE_READY: { status: 'CLOSED' } },
      })
    );

    // Create client/src with a React component
    const clientSrc = path.join(tmpDir, 'client/src');
    fs.mkdirSync(clientSrc, { recursive: true });
    fs.writeFileSync(path.join(clientSrc, 'App.jsx'), 'export default function App() {}');

    const result = checkFrontendGate(tmpDir);
    assert.equal(result.isClean, false);
    assert.ok(result.errors.some((e) => e.includes('Frontend files found in client/src before BE_READY')));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

