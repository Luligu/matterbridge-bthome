const NAME = 'Platform';
const MATTER_PORT = 6000;

// Warning: the tests in this file are supposed to run sequentially.

import { jest } from '@jest/globals';
import {
  addMatterbridgePlatform,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  log,
  loggerLogSpy,
  matterbridge,
  setDebug,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from 'matterbridge/jestutils';
import { idn, LogLevel, nf, rs } from 'matterbridge/logger';

import { BTHome, type BTHomeDevice } from './BTHome.js';
import initializePlugin, { BTHomePlatformConfig, Platform } from './module.js';

// Setup the test environment
await setupTest(NAME, false);

describe('TestPlatform', () => {
  let platform: Platform;

  const device: BTHomeDevice = {
    mac: 'aa:bb:cc:dd:ee:ff',
    rssi: -42,
    localName: 'Test Sensor',
    version: 2,
    encrypted: false,
    trigger: false,
    data: { temperature: 21.5 },
    packetId: 1,
    lastSeen: new Date('2026-04-25T00:00:00.000Z'),
  };

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
    await createMatterbridgeEnvironment();
    await startMatterbridgeEnvironment(MATTER_PORT);
  });

  beforeEach(() => {
    // Reset the mock calls before each test
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clear debug
    await setDebug(false);
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
    expect(() => new Platform({ ...matterbridge, matterbridgeVersion: '1.0.0' }, log, config)).toThrow(
      'This plugin requires Matterbridge version >= "3.8.0". Please update Matterbridge to the latest version in the frontend.',
    );
  });

  it('should initialize platform with config name', () => {
    platform = new Platform(matterbridge, log, config);
    addMatterbridgePlatform(platform);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Initializing platform:', config.name);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Finished initializing platform:', config.name);
  });

  it('should call onStart with reason', async () => {
    await platform.onStart('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onStart called with reason:', 'Test reason');
  });

  it('should call onConfigure', async () => {
    const platformWithUpdateDevice = platform as unknown as { updateDevice: (device: BTHomeDevice) => Promise<void> };
    const updateDeviceSpy = jest.spyOn(platformWithUpdateDevice, 'updateDevice').mockImplementation(async () => undefined);

    platform.btHome.bthomePeripherals.clear();
    platform.btHome.bthomePeripherals.set(device.mac, { ...device });
    await platform.onConfigure();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onConfigure called');
    expect(updateDeviceSpy).toHaveBeenCalledWith(expect.objectContaining({ mac: device.mac }));

    platform.btHome.bthomePeripherals.clear();
    updateDeviceSpy.mockRestore();
  });

  it('should call onChangeLoggerLevel', async () => {
    await platform.onChangeLoggerLevel(LogLevel.DEBUG);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing logger level for platform ${idn}${config.name}${rs}${nf} to ${LogLevel.DEBUG}`);
  });

  it('should call onAction', async () => {
    await platform.onAction('test-action', 'test-value', 'test-id');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onAction called with action:', 'test-action', 'and value:', 'test-value', 'and id:', 'test-id');
  });

  it('should log error when onAction deletes an unknown device', async () => {
    const stopSpy = jest.spyOn(platform.btHome, 'stop').mockResolvedValue(undefined);
    const platformWithSavePeripherals = platform as unknown as { savePeripherals: () => Promise<void> };
    const savePeripheralsSpy = jest.spyOn(platformWithSavePeripherals, 'savePeripherals').mockImplementation(async () => undefined);

    await platform.onAction('delete', ' 11:22:33:44:55:66 ');

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'The device 11:22:33:44:55:66 is not registered. Please check the MAC address.');
    expect(stopSpy).not.toHaveBeenCalled();
    expect(savePeripheralsSpy).not.toHaveBeenCalled();

    stopSpy.mockRestore();
    savePeripheralsSpy.mockRestore();
  });

  it('should delete a registered device when onAction receives delete', async () => {
    const mac = device.mac;
    const bridgedDevice = {};
    const stopSpy = jest.spyOn(platform.btHome, 'stop').mockResolvedValue(undefined);
    const unregisterDeviceSpy = jest.spyOn(platform, 'unregisterDevice').mockImplementation(async () => undefined);
    const platformWithSavePeripherals = platform as unknown as { savePeripherals: () => Promise<void> };
    const savePeripheralsSpy = jest.spyOn(platformWithSavePeripherals, 'savePeripherals').mockImplementation(async () => undefined);

    platform.btHome.bthomePeripherals.set(mac, { ...device });
    platform.bridgedDevices.set(mac, bridgedDevice as never);

    await platform.onAction('delete', ` ${mac.toUpperCase()} `);

    expect(stopSpy).toHaveBeenCalled();
    expect(savePeripheralsSpy).toHaveBeenCalled();
    expect(unregisterDeviceSpy).toHaveBeenCalledWith(bridgedDevice);
    expect(platform.btHome.bthomePeripherals.has(mac)).toBe(false);
    expect(platform.bridgedDevices.has(mac)).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `The device ${mac} has been deleted. Please restart the plugin.`);

    stopSpy.mockRestore();
    unregisterDeviceSpy.mockRestore();
    savePeripheralsSpy.mockRestore();
  });

  it('should reset storage when onAction receives reset', async () => {
    const mac = device.mac;
    const stopSpy = jest.spyOn(platform.btHome, 'stop').mockResolvedValue(undefined);
    const unregisterAllDevicesSpy = jest.spyOn(platform, 'unregisterAllDevices').mockImplementation(async () => undefined);
    const platformWithSavePeripherals = platform as unknown as { savePeripherals: () => Promise<void> };
    const savePeripheralsSpy = jest.spyOn(platformWithSavePeripherals, 'savePeripherals').mockImplementation(async () => undefined);

    platform.btHome.bthomePeripherals.set(mac, { ...device });
    platform.bridgedDevices.set(mac, {} as never);

    await platform.onAction('reset');

    expect(stopSpy).toHaveBeenCalled();
    expect(savePeripheralsSpy).toHaveBeenCalled();
    expect(unregisterAllDevicesSpy).toHaveBeenCalled();
    expect(platform.btHome.bthomePeripherals.size).toBe(0);
    expect(platform.bridgedDevices.size).toBe(0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, 'The storage has been reset');

    stopSpy.mockRestore();
    unregisterAllDevicesSpy.mockRestore();
    savePeripheralsSpy.mockRestore();
  });

  it('should add and save peripherals when btHome emits discovered', async () => {
    const platformWithAddDevice = platform as unknown as { addDevice: (device: BTHomeDevice) => Promise<void> };
    const platformWithSavePeripherals = platform as unknown as { savePeripherals: () => Promise<void> };
    const addDeviceSpy = jest.spyOn(platformWithAddDevice, 'addDevice').mockImplementation(async () => undefined);
    const savePeripheralsSpy = jest.spyOn(platformWithSavePeripherals, 'savePeripherals').mockImplementation(async () => undefined);

    platform.btHome.emit('discovered', device);
    await Promise.resolve();

    expect(addDeviceSpy).toHaveBeenCalledWith(device);
    expect(savePeripheralsSpy).toHaveBeenCalled();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Discovered new BTHome device: ${device.mac}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, '- name:', device.localName);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, '- rssi:', device.rssi);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, '- version:', device.version);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, '- encrypted:', device.encrypted);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, '- trigger:', device.trigger);

    addDeviceSpy.mockRestore();
    savePeripheralsSpy.mockRestore();
  });

  it('should update device when btHome emits update', () => {
    const platformWithUpdateDevice = platform as unknown as { updateDevice: (device: BTHomeDevice) => Promise<void> };
    const updateDeviceSpy = jest.spyOn(platformWithUpdateDevice, 'updateDevice').mockImplementation(async () => undefined);

    platform.btHome.emit('update', device);

    expect(updateDeviceSpy).toHaveBeenCalledWith(device);

    updateDeviceSpy.mockRestore();
  });

  it('should load peripherals from storage', async () => {
    const platformWithLoadPeripherals = platform as unknown as { loadPeripherals: () => Promise<void> };
    const platformWithAddDevice = platform as unknown as { addDevice: (device: BTHomeDevice) => Promise<void> };
    const platformWithContext = platform as unknown as {
      context: {
        get: <T>(key: string, defaultValue: T) => Promise<T>;
      };
    };
    const addDeviceSpy = jest.spyOn(platformWithAddDevice, 'addDevice').mockImplementation(async () => undefined);
    const contextGetSpy = jest.spyOn(platformWithContext.context, 'get').mockResolvedValue([device]);

    platform.btHome.bthomePeripherals.clear();
    await platformWithLoadPeripherals.loadPeripherals();

    expect(contextGetSpy).toHaveBeenCalledWith('bthomePeripherals', []);
    expect(addDeviceSpy).toHaveBeenCalledWith(device);
    expect(platform.btHome.bthomePeripherals.get(device.mac)).toEqual(device);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Loading 1 BTHome devices from the storage...');

    platform.btHome.bthomePeripherals.clear();
    addDeviceSpy.mockRestore();
    contextGetSpy.mockRestore();
  });

  it('should save peripherals to storage', async () => {
    const platformWithSavePeripherals = platform as unknown as { savePeripherals: () => Promise<void> };
    const platformWithContext = platform as unknown as {
      context: {
        set: (key: string, value: unknown) => Promise<void>;
      };
    };
    const contextSetSpy = jest.spyOn(platformWithContext.context, 'set').mockResolvedValue(undefined);

    platform.btHome.bthomePeripherals.clear();
    platform.btHome.bthomePeripherals.set(device.mac, { ...device });
    await platformWithSavePeripherals.savePeripherals();

    expect(contextSetSpy).toHaveBeenCalledWith('bthomePeripherals', [{ ...device }]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Saved 1 BTHome devices in the storage');

    platform.btHome.bthomePeripherals.clear();
    contextSetSpy.mockRestore();
  });

  it('should add a bridged device and update it', async () => {
    const platformWithAddDevice = platform as unknown as { addDevice: (device: BTHomeDevice) => Promise<void> };
    const platformWithUpdateDevice = platform as unknown as { updateDevice: (device: BTHomeDevice) => Promise<void> };
    const platformWithValidateDevice = platform as unknown as { validateDevice: (id: string, add: boolean) => boolean };
    const validateDeviceSpy = jest.spyOn(platformWithValidateDevice, 'validateDevice').mockReturnValue(true);
    const registerDeviceSpy = jest.spyOn(platform, 'registerDevice').mockImplementation(async () => undefined);
    const updateDeviceSpy = jest.spyOn(platformWithUpdateDevice, 'updateDevice').mockImplementation(async () => undefined);

    platform.bridgedDevices.clear();
    await platformWithAddDevice.addDevice(device);

    expect(validateDeviceSpy).toHaveBeenCalledWith(device.mac, true);
    expect(registerDeviceSpy).toHaveBeenCalledTimes(1);
    expect(platform.bridgedDevices.has(device.mac)).toBe(true);
    expect(updateDeviceSpy).toHaveBeenCalledWith(device);

    platform.bridgedDevices.clear();
    validateDeviceSpy.mockRestore();
    registerDeviceSpy.mockRestore();
    updateDeviceSpy.mockRestore();
  });

  it('should ignore known raw readings and warn on unknown readings when adding device', async () => {
    const deviceToAdd: BTHomeDevice = {
      ...device,
      data: { raw: 'payload', unknownReading: 1 },
    };
    const platformWithAddDevice = platform as unknown as { addDevice: (device: BTHomeDevice) => Promise<void> };
    const platformWithUpdateDevice = platform as unknown as { updateDevice: (device: BTHomeDevice) => Promise<void> };
    const platformWithValidateDevice = platform as unknown as { validateDevice: (id: string, add: boolean) => boolean };
    const validateDeviceSpy = jest.spyOn(platformWithValidateDevice, 'validateDevice').mockReturnValue(true);
    const registerDeviceSpy = jest.spyOn(platform, 'registerDevice').mockImplementation(async () => undefined);
    const updateDeviceSpy = jest.spyOn(platformWithUpdateDevice, 'updateDevice').mockImplementation(async () => undefined);

    platform.bridgedDevices.clear();
    await platformWithAddDevice.addDevice(deviceToAdd);

    expect(validateDeviceSpy).toHaveBeenCalledWith(deviceToAdd.mac, true);
    expect(registerDeviceSpy).toHaveBeenCalledTimes(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, `No converter found for property unknownReading in device ${deviceToAdd.mac}`);
    expect(platform.bridgedDevices.has(deviceToAdd.mac)).toBe(true);
    expect(updateDeviceSpy).toHaveBeenCalledWith(deviceToAdd);

    platform.bridgedDevices.clear();
    validateDeviceSpy.mockRestore();
    registerDeviceSpy.mockRestore();
    updateDeviceSpy.mockRestore();
  });

  it('should update attribute and switch state when updating device', async () => {
    const deviceToUpdate: BTHomeDevice = {
      ...device,
      data: { temperature: 21.5, button: 'double_press' },
    };
    const platformWithUpdateDevice = platform as unknown as { updateDevice: (device: BTHomeDevice) => Promise<void> };
    const platformWithValidateDevice = platform as unknown as { validateDevice: (id: string, add: boolean) => boolean };
    const validateDeviceSpy = jest.spyOn(platformWithValidateDevice, 'validateDevice').mockReturnValue(true);
    const temperatureChild = {
      log: {},
      updateAttribute: jest.fn(async () => undefined),
    };
    const buttonChild = {
      log: {},
      triggerSwitchEvent: jest.fn(async () => undefined),
    };
    const matterbridgeDevice = {
      getChildEndpointById: jest.fn((name: string) => {
        if (name === 'temperature') return temperatureChild;
        if (name === 'button') return buttonChild;
        return undefined;
      }),
    };

    platform.bridgedDevices.set(deviceToUpdate.mac, matterbridgeDevice as never);
    await platformWithUpdateDevice.updateDevice(deviceToUpdate);

    expect(validateDeviceSpy).toHaveBeenCalledWith(deviceToUpdate.mac, false);
    expect(matterbridgeDevice.getChildEndpointById).toHaveBeenCalledWith('temperature');
    expect(temperatureChild.updateAttribute).toHaveBeenCalledWith('TemperatureMeasurement', 'measuredValue', 2150, temperatureChild.log);
    expect(matterbridgeDevice.getChildEndpointById).toHaveBeenCalledWith('button');
    expect(buttonChild.triggerSwitchEvent).toHaveBeenCalledWith('Double', buttonChild.log);
    expect(deviceToUpdate.data.button).toBe('none');

    platform.bridgedDevices.clear();
    validateDeviceSpy.mockRestore();
  });

  it('should handle property updates, long press, and unknown readings when updating device', async () => {
    const deviceToUpdate: BTHomeDevice = {
      ...device,
      data: { occupancyState: 1, unknownReading: 99, button: 'long_press' },
    };
    const platformWithUpdateDevice = platform as unknown as { updateDevice: (device: BTHomeDevice) => Promise<void> };
    const platformWithValidateDevice = platform as unknown as { validateDevice: (id: string, add: boolean) => boolean };
    const validateDeviceSpy = jest.spyOn(platformWithValidateDevice, 'validateDevice').mockReturnValue(true);
    const occupancyChild = {
      log: {},
      updateAttribute: jest.fn(async () => undefined),
    };
    const buttonChild = {
      log: {},
      triggerSwitchEvent: jest.fn(async () => undefined),
    };
    const matterbridgeDevice = {
      getChildEndpointById: jest.fn((id: string) => {
        if (id === 'occupancyState') return occupancyChild;
        if (id === 'button') return buttonChild;
        return undefined;
      }),
    };

    platform.bridgedDevices.set(deviceToUpdate.mac, matterbridgeDevice as never);
    await platformWithUpdateDevice.updateDevice(deviceToUpdate);

    expect(validateDeviceSpy).toHaveBeenCalledWith(deviceToUpdate.mac, false);
    expect(matterbridgeDevice.getChildEndpointById).toHaveBeenCalledWith('occupancyState');
    expect(occupancyChild.updateAttribute).toHaveBeenCalledWith('OccupancySensing', 'occupancy', { occupied: true }, occupancyChild.log);
    expect(buttonChild.triggerSwitchEvent).toHaveBeenCalledWith('Long', buttonChild.log);
    expect(deviceToUpdate.data.button).toBe('none');
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `***No converter found for property unknownReading in device mac ${deviceToUpdate.mac} model ${deviceToUpdate.localName}`,
    );

    platform.bridgedDevices.clear();
    validateDeviceSpy.mockRestore();
  });

  it('should log debug for unknown readings, update with converter.property, and trigger long press', async () => {
    const deviceToUpdate: BTHomeDevice = {
      ...device,
      data: { occupancyState: 1, unknownReading: 99, button: 'long_press' },
    };
    const platformWithUpdateDevice = platform as unknown as { updateDevice: (device: BTHomeDevice) => Promise<void> };
    const platformWithValidateDevice = platform as unknown as { validateDevice: (id: string, add: boolean) => boolean };
    const validateDeviceSpy = jest.spyOn(platformWithValidateDevice, 'validateDevice').mockReturnValue(true);
    const occupancyChild = {
      log: {},
      updateAttribute: jest.fn(async () => undefined),
    };
    const buttonChild = {
      log: {},
      triggerSwitchEvent: jest.fn(async () => undefined),
    };
    const matterbridgeDevice = {
      getChildEndpointById: jest.fn((id: string) => {
        if (id === 'occupancyState') return occupancyChild;
        if (id === 'button') return buttonChild;
        return undefined;
      }),
    };

    platform.bridgedDevices.set(deviceToUpdate.mac, matterbridgeDevice as never);
    await platformWithUpdateDevice.updateDevice(deviceToUpdate);

    // lines 252-253: no converter → debug log and continue
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `***No converter found for property unknownReading in device mac ${deviceToUpdate.mac} model ${deviceToUpdate.localName}`,
    );
    // line 263: converter.property present → value wrapped in object
    expect(occupancyChild.updateAttribute).toHaveBeenCalledWith('OccupancySensing', 'occupancy', { occupied: true }, occupancyChild.log);
    // line 274: long_press branch
    expect(buttonChild.triggerSwitchEvent).toHaveBeenCalledWith('Long', buttonChild.log);
    expect(deviceToUpdate.data.button).toBe('none');

    platform.bridgedDevices.clear();
    validateDeviceSpy.mockRestore();
  });

  it('should call onShutdown with reason', async () => {
    await platform.onShutdown('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onShutdown called with reason:', 'Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onShutdown finished');
  });
});
