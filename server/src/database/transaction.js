import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

/**
 * Executes a callback within a MongoDB multi-document ACID transaction.
 * If an existingSession is provided, reuses that session instead of creating a nested transaction.
 *
 * @template T
 * @param {(session: import('mongoose').ClientSession) => Promise<T>} workFn - Business logic function receiving session
 * @param {import('mongoose').ClientSession} [existingSession] - Optional outer session to support nested service calls
 * @returns {Promise<T>} Result of workFn
 */
export async function withTransaction(workFn, existingSession = null) {
  if (existingSession) {
    logger.debug('Reusing existing MongoDB transaction session.');
    return workFn(existingSession);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async (activeSession) => {
      result = await workFn(activeSession);
    });
    return result;
  } catch (err) {
    logger.warn(`Transaction aborted or failed: ${err.message}`, {
      error: err.message,
    });
    throw err;
  } finally {
    await session.endSession();
  }
}

export default withTransaction;
