import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

const READY_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Connects to MongoDB via Mongoose
 * @param {string} uri - MongoDB connection URI
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDB(uri) {
  if (mongoose.connection.readyState === 1) {
    logger.debug('MongoDB already connected.');
    return mongoose;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: process.env.NODE_ENV !== 'production',
    });

    logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    logger.error(`MongoDB connection error: ${err.message}`, { error: err.message });
    throw err;
  }
}

/**
 * Closes MongoDB connection cleanly
 * @returns {Promise<void>}
 */
export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected.');
  }
}

/**
 * Checks connection health of MongoDB
 * @returns {{ isConnected: boolean, state: string, readyState: number }}
 */
export function checkDatabaseHealth() {
  const readyState = mongoose.connection.readyState;
  return {
    isConnected: readyState === 1,
    state: READY_STATES[readyState] || 'unknown',
    readyState,
  };
}

