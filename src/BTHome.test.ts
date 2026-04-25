const NAME = 'BTHome';

import { jest } from '@jest/globals';
import { log, loggerLogSpy, setDebug, setupTest } from 'matterbridge/jestutils';
import { idn, LogLevel, nf, rs } from 'matterbridge/logger';

import { BTHome } from './BTHome.js';

// Setup the test environment
await setupTest(NAME, false);

describe('TestPlatform', () => {
  beforeAll(async () => {});

  beforeEach(() => {
    // Reset the mock calls before each test
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clear debug
    await setDebug(false);
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });
});
