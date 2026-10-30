import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Polyfill BroadcastChannel if not available in jsdom
if (typeof window !== 'undefined' && !window.BroadcastChannel) {
  class MockBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
    }
    postMessage() {}
    close() {}
  }
  window.BroadcastChannel = MockBroadcastChannel;
}

