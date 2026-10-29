import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DEFAULT_PORT = 27018;
const DEFAULT_REPL_SET = 'rs0';
const DEFAULT_DATA_DIR = path.resolve(projectRoot, '.mongodb-rs', 'data');
const DEFAULT_ADMIN_URI = `mongodb://127.0.0.1:${DEFAULT_PORT}/admin?directConnection=true`;

/**
 * Checks if MongoDB is accessible and running as a replica set
 * @param {string} uri
 * @returns {Promise<boolean>}
 */
async function checkReplicaSet(uri = DEFAULT_ADMIN_URI) {
  let conn = null;
  try {
    conn = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000,
      directConnection: true,
    }).asPromise();

    const admin = conn.db.admin();
    const status = await admin.command({ replSetGetStatus: 1 });
    await conn.close();
    return status && (status.ok === 1 || status.set === DEFAULT_REPL_SET);
  } catch (err) {
    if (conn) {
      try { await conn.close(); } catch { /* ignore */ }
    }
    return false;
  }
}

/**
 * Initiates replica set if MongoDB is running but uninitiated
 * @param {string} uri
 * @returns {Promise<boolean>}
 */
async function initiateReplicaSet(uri = DEFAULT_ADMIN_URI) {
  let conn = null;
  try {
    conn = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 3000,
      directConnection: true,
    }).asPromise();

    const admin = conn.db.admin();
    const result = await admin.command({
      replSetInitiate: {
        _id: DEFAULT_REPL_SET,
        members: [{ _id: 0, host: `127.0.0.1:${DEFAULT_PORT}` }],
      },
    });
    await conn.close();
    return result && result.ok === 1;
  } catch (err) {
    if (conn) {
      try { await conn.close(); } catch { /* ignore */ }
    }
    if (err.message && err.message.includes('already initialized')) {
      return true;
    }
    throw err;
  }
}

/**
 * Finds mongod executable path
 * @returns {string}
 */
function findMongodPath() {
  const possiblePaths = [
    'mongod',
    'C:\\Program Files\\MongoDB\\Server\\9.0\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe',
  ];

  for (const p of possiblePaths) {
    if (p === 'mongod') continue;
    if (fs.existsSync(p)) return p;
  }
  return 'mongod';
}

/**
 * Ensures MongoDB Replica Set is running
 * @param {object} options
 * @returns {Promise<boolean>}
 */
export async function ensureMongoReplicaSet(options = {}) {
  const port = options.port || DEFAULT_PORT;
  const replSet = options.replSet || DEFAULT_REPL_SET;
  const dataDir = options.dataDir || DEFAULT_DATA_DIR;
  const adminUri = `mongodb://127.0.0.1:${port}/admin?directConnection=true`;

  const isAlreadyActive = await checkReplicaSet(adminUri);
  if (isAlreadyActive) {
    return true;
  }

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const mongodPath = findMongodPath();
  const args = [
    '--dbpath', dataDir,
    '--port', String(port),
    '--replSet', replSet,
    '--bind_ip', '127.0.0.1',
  ];

  const child = spawn(mongodPath, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  // Poll until mongod responds
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const active = await checkReplicaSet(adminUri);
      if (active) return true;

      // Try initiate if running but not yet initiated
      try {
        await initiateReplicaSet(adminUri);
        return true;
      } catch {
        // Continue waiting
      }
    } catch {
      // Continue polling
    }
  }

  throw new Error(`Failed to ensure MongoDB Replica Set on port ${port} after ${maxAttempts} attempts.`);
}

// Execute CLI directly if run as main
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  ensureMongoReplicaSet()
    .then(() => {
      console.log(`MongoDB Replica Set is active on port ${DEFAULT_PORT} (${DEFAULT_REPL_SET}).`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error ensuring MongoDB replica set:', err.message);
      process.exit(1);
    });
}
