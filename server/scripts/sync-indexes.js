import { fileURLToPath } from 'url';
import path from 'path';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';
import * as models from '../src/models/index.js';

/**
 * Synchronizes indexes for all Mongoose models
 * @param {string} [uri]
 * @returns {Promise<Record<string, any>>}
 */
export async function syncAllIndexes(uri = env.MONGODB_URI) {
  logger.info(`Starting index synchronization on ${uri}...`);
  await connectDB(uri);

  const results = {};
  const modelEntries = Object.entries(models);

  for (const [modelName, Model] of modelEntries) {
    if (Model && typeof Model.syncIndexes === 'function') {
      try {
        await Model.syncIndexes();
        const indexes = await Model.collection.indexes();
        results[modelName] = {
          success: true,
          indexes: indexes.map((idx) => idx.name),
        };
        logger.info(`Indexes synchronized for model [${modelName}]: ${indexes.length} indexes`);
      } catch (err) {
        results[modelName] = {
          success: false,
          error: err.message,
        };
        logger.error(`Failed to sync indexes for [${modelName}]: ${err.message}`);
        throw err;
      }
    }
  }

  logger.info(`Index synchronization completed successfully for ${modelEntries.length} models.`);
  return results;
}

// Execute if run directly from CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  syncAllIndexes()
    .then(() => {
      console.log('All MongoDB indexes synchronized successfully.');
      return disconnectDB().then(() => process.exit(0));
    })
    .catch(async (err) => {
      console.error('Index sync failed:', err.message);
      await disconnectDB();
      process.exit(1);
    });
}
