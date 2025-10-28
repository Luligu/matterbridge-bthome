const MATTER_PORT = 6000;
const NAME = 'Platform';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { idn, LogLevel, nf, rs } from 'matterbridge/logger';

import initializePlugin, { BTHomePlatformConfig, Platform } from './module.js';
import { BTHome } from './BTHome.js';
import {
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  log,
  loggerLogSpy,
  matterbridge,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from './utils/jestHelpers.js';

// Setup the test environment
setupTest(NAME, false);

describe('TestPlatform', () => {
  let platform: Platform;

  jest.spyOn(BTHome.prototype, 'start').mockImplementation(async () => {
    // Mock implementation of BTHome.start
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 1000);
    });
  });

  const config: BTHomePlatformConfig = {
    name: 'matterbridge-bthome',
    type: 'DynamicPlatform',
    version: '0.0.1',
    whiteList: [],
    blackList: [],
    debug: true,
    unregisterOnShutdown: false,
  };

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment(NAME);
    await startMatterbridgeEnvironment(MATTER_PORT);
  });

  beforeEach(() => {
    // Reset the mock calls before each test
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup after each test
  });

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment();
    await destroyMatterbridgeEnvironment();

    // Restore all mocks
    jest.restoreAllMocks();
  });

  it('should return an instance of Platform', async () => {
    platform = initializePlugin(matterbridge, log, config);
    expect(platform).toBeInstanceOf(Platform);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Initializing platform:', config.name);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Finished initializing platform:', config.name);
    await platform.ready;
    await platform.onShutdown();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onShutdown called with reason:', 'none');
  });

  it('should throw error in load when version is not valid', () => {
    matterbridge.matterbridgeVersion = '1.5.0';
    expect(() => new Platform(matterbridge, log, config)).toThrow(
      'This plugin requires Matterbridge version >= "3.3.0". Please update Matterbridge to the latest version in the frontend.',
    );
    matterbridge.matterbridgeVersion = '3.3.0';
  });

  it('should initialize platform with config name', () => {
    platform = new Platform(matterbridge, log, config);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Initializing platform:', config.name);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Finished initializing platform:', config.name);
  });

  it('should call onStart with reason', async () => {
    await platform.onStart('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onStart called with reason:', 'Test reason');
  });

  it('should call onConfigure', async () => {
    await platform.onConfigure();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onConfigure called');
  });

  it('should call onChangeLoggerLevel', async () => {
    await platform.onChangeLoggerLevel(LogLevel.DEBUG);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing logger level for platform ${idn}${config.name}${rs}${nf} to ${LogLevel.DEBUG}`);
  });

  // eslint-disable-next-line jest/no-commented-out-tests
  /*
  it('should call onAction', async () => {
    jest.useFakeTimers();
    await platform.onAction('test', undefined, 'Turn off shelly bulb');
    expect(mockLog.info).toHaveBeenCalledWith('onAction called with action:', 'test', 'and value:', 'none', 'and id:', 'Turn off shelly bulb');
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('Testing webhook'));
    jest.runAllTimers();
    jest.useRealTimers();
    await wait(1000);
  });
  */

  it('should call onShutdown with reason', async () => {
    await platform.onShutdown('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onShutdown called with reason:', 'Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onShutdown finished');
    // await wait(5000);
  });
});
