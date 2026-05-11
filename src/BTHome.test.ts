const NAME = 'BTHome';

import { jest } from '@jest/globals';
import type { PeripheralAdvertisement } from '@stoprocent/noble';
import { loggerLogSpy, setDebug, setupTest } from 'matterbridge/jestutils';
import { LogLevel } from 'matterbridge/logger';

import { BTHome } from './BTHome.js';
import { decodeBTHome } from './BTHomeDecoder.js';
import { decodeShellyManufacturerData, getShellyBluLongName, getShellyBluShortName } from './BTHomeShellyMdDecoder.js';
import { BTHOME_SPEC } from './BTHomeSpec.js';

// Setup the test environment
await setupTest(NAME, false);

interface InternalBTHome {
  noble?: {
    state: string;
    on: (event: string, listener: (...args: unknown[]) => void) => void;
    removeListener: (event: string, listener: (...args: unknown[]) => void) => void;
    startScanningAsync: (services: string[], allowDuplicates: boolean) => Promise<void>;
    stopScanningAsync: () => Promise<void>;
  };
  handleDiscovery: (peripheral: TestPeripheral) => Promise<void>;
  isBTHomePeripheral: (peripheral: TestPeripheral) => boolean;
  isShellyBlePeripheral: (peripheral: TestPeripheral) => boolean;
  waitForPoweredOn: () => Promise<void>;
}

interface TestPeripheral {
  id: string;
  address: string;
  addressType: 'public' | 'random';
  connectable: boolean;
  advertisement: {
    localName?: string;
    serviceData: Array<{ uuid: string; data: Buffer }>;
    serviceUuids: string[];
    manufacturerData?: Buffer;
    serviceSolicitationUuids: string[];
    txPowerLevel: number;
  };
  rssi: number;
  mtu: number | null;
  services: unknown[];
  state: 'connected' | 'disconnected';
}

function asInternal(bthome: BTHome): InternalBTHome {
  return bthome as unknown as InternalBTHome;
}

function createPeripheral(overrides: Partial<TestPeripheral> = {}): TestPeripheral {
  const { advertisement: advertisementOverrides = {}, ...peripheralOverrides } = overrides;
  const advertisement = {
    localName: 'Shelly BLU HT',
    serviceData: [],
    serviceUuids: [],
    manufacturerData: undefined,
    serviceSolicitationUuids: [],
    txPowerLevel: 0,
    ...advertisementOverrides,
  };

  return {
    id: 'peripheral-1',
    address: 'aa:bb:cc:dd:ee:ff',
    addressType: 'public',
    connectable: true,
    rssi: -55,
    mtu: null,
    services: [],
    state: 'disconnected',
    ...peripheralOverrides,
    advertisement,
  };
}

function createShellyManufacturerData(modelId = 0x0003): Buffer {
  return Buffer.from([0xa9, 0x0b, 0x01, 0x15, 0x00, 0x0b, modelId & 0xff, modelId >> 8, 0x0a, 0xa1, 0xb2, 0xc3, 0xd4, 0xe5, 0xf6]);
}

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

  test('should initialize scanner flags when constructed with explicit filters', () => {
    const bthome = new BTHome(true, false, true, ['aa:bb:cc:dd:ee:ff'], LogLevel.INFO);

    expect(bthome.filterBle).toBe(true);
    expect(bthome.filterBTHome).toBe(false);
    expect(bthome.filterShellyBle).toBe(true);
    expect(bthome.filterAddress).toEqual(['aa:bb:cc:dd:ee:ff']);
    expect(bthome.isScanning).toBe(false);
  });

  test('should identify Shelly BLE and BTHome peripherals through the private helpers', () => {
    const bthome = new BTHome();
    const internal = asInternal(bthome);
    const genericPeripheral = createPeripheral({
      advertisement: { localName: 'Sensor', serviceData: [], serviceUuids: [], manufacturerData: undefined, serviceSolicitationUuids: [], txPowerLevel: 0 },
    });
    const shellyPeripheral = createPeripheral();
    const wallDisplayPeripheral = createPeripheral({
      advertisement: { localName: 'WallDisplay', serviceData: [], serviceUuids: [], manufacturerData: undefined, serviceSolicitationUuids: [], txPowerLevel: 0 },
    });
    const bthomePeripheral = createPeripheral({
      advertisement: {
        localName: 'Any Device',
        serviceData: [{ uuid: 'fcd2', data: Buffer.from([0x40, 0x01, 0x64]) }],
        serviceUuids: [],
        manufacturerData: undefined,
        serviceSolicitationUuids: [],
        txPowerLevel: 0,
      },
    });

    expect(
      internal.isShellyBlePeripheral(
        createPeripheral({
          advertisement: { localName: undefined, serviceData: [], serviceUuids: [], manufacturerData: undefined, serviceSolicitationUuids: [], txPowerLevel: 0 },
        }),
      ),
    ).toBe(false);
    expect(
      internal.isShellyBlePeripheral(
        createPeripheral({
          advertisement: { localName: '', serviceData: [], serviceUuids: [], manufacturerData: undefined, serviceSolicitationUuids: [], txPowerLevel: 0 },
        }),
      ),
    ).toBe(false);
    expect(internal.isShellyBlePeripheral(genericPeripheral)).toBe(false);
    expect(internal.isShellyBlePeripheral(shellyPeripheral)).toBe(true);
    expect(internal.isShellyBlePeripheral(wallDisplayPeripheral)).toBe(true);
    expect(internal.isBTHomePeripheral(genericPeripheral)).toBe(false);
    expect(internal.isBTHomePeripheral(bthomePeripheral)).toBe(true);

    bthome.bthomePeripherals.set('11:22:33:44:55:66', {
      mac: '11:22:33:44:55:66',
      rssi: -50,
      localName: 'Cached BTHome',
      version: 2,
      encrypted: false,
      trigger: false,
      data: {},
      packetId: 0,
      lastSeen: new Date('2026-04-25T10:00:00.000Z'),
    });

    expect(
      internal.isBTHomePeripheral(
        createPeripheral({
          address: '11:22:33:44:55:66',
          advertisement: { localName: 'Cached BTHome', serviceData: [], serviceUuids: [], manufacturerData: undefined, serviceSolicitationUuids: [], txPowerLevel: 0 },
        }),
      ),
    ).toBe(true);
  });

  test('should discover a new Shelly BTHome device and enrich it with manufacturer data', async () => {
    const bthome = new BTHome(true, true, false, [], LogLevel.DEBUG);
    const internal = asInternal(bthome);
    const discoveredListener = jest.fn();
    const updatedListener = jest.fn();
    const peripheral = createPeripheral({
      advertisement: {
        localName: 'Shelly BLU HT',
        serviceData: [
          { uuid: 'fcd2', data: Buffer.from([0x44, 0x00, 0x09, 0x02, 0xc4, 0x09]) },
          { uuid: '180f', data: Buffer.from([0x64]) },
        ],
        serviceUuids: ['fcd2', '180f'],
        manufacturerData: createShellyManufacturerData(),
        serviceSolicitationUuids: [],
        txPowerLevel: 5,
      },
    });

    bthome.on('discovered', discoveredListener);
    bthome.on('update', updatedListener);

    await internal.handleDiscovery(peripheral);

    expect(bthome.blePeripherals.get(peripheral.id)?.localName).toBe('Shelly BLU HT');
    expect(bthome.bthomePeripherals.get(peripheral.address)).toMatchObject({
      mac: peripheral.address,
      localName: 'Shelly BLU HT',
      packetId: 9,
      modelId: 0x0003,
      modelIdShortName: 'SBHT-003C',
      modelIdLongName: 'Shelly BLU HT',
      data: {
        packetId: 9,
        temperature: 25,
      },
    });
    expect(discoveredListener).toHaveBeenCalledTimes(1);
    expect(updatedListener).toHaveBeenCalledTimes(1);
  });

  test('should store an empty BLE local name when filterBle is enabled and the advertisement name is missing', async () => {
    const bthome = new BTHome(true, false, false, [], LogLevel.DEBUG);

    await asInternal(bthome).handleDiscovery(
      createPeripheral({
        advertisement: {
          localName: undefined,
          serviceData: [],
          serviceUuids: [],
          manufacturerData: undefined,
          serviceSolicitationUuids: [],
          txPowerLevel: 0,
        },
      }),
    );

    expect(bthome.blePeripherals.get('peripheral-1')?.localName).toBe('');
  });

  test('should update cached BLE and BTHome devices when another BTHome advertisement arrives', async () => {
    const bthome = new BTHome(true, true, false, [], LogLevel.DEBUG);
    const internal = asInternal(bthome);
    const updatedListener = jest.fn();
    const peripheral = createPeripheral({
      rssi: -44,
      advertisement: {
        localName: undefined,
        serviceData: [{ uuid: 'fcd2', data: Buffer.from([0x40, 0x01, 0x55]) }],
        serviceUuids: [],
        manufacturerData: Buffer.from([0x4c, 0x00, 0x02, 0x15]),
        serviceSolicitationUuids: [],
        txPowerLevel: 0,
      },
      mtu: 247,
      services: [{ uuid: '180f' }],
      state: 'connected',
    });

    bthome.on('update', updatedListener);
    bthome.blePeripherals.set(peripheral.id, {
      id: peripheral.id,
      address: peripheral.address,
      addressType: peripheral.addressType,
      connectable: peripheral.connectable,
      advertisement: {
        localName: 'Existing device',
        serviceData: [],
        serviceUuids: [],
        manufacturerData: undefined,
        serviceSolicitationUuids: [],
        txPowerLevel: 0,
      } as unknown as PeripheralAdvertisement,
      rssi: -60,
      mtu: null,
      services: [],
      state: 'disconnected',
      localName: 'Existing device',
      lastSeen: new Date('2026-04-25T10:00:00.000Z'),
    });
    bthome.bthomePeripherals.set(peripheral.address, {
      mac: peripheral.address,
      rssi: -60,
      localName: 'Existing device',
      version: 1,
      encrypted: false,
      trigger: false,
      data: { battery: 10 },
      packetId: 42,
      lastSeen: new Date('2026-04-25T10:00:00.000Z'),
    });

    await internal.handleDiscovery(peripheral);

    expect(bthome.blePeripherals.get(peripheral.id)).toMatchObject({
      rssi: -44,
      mtu: 247,
      services: [{ uuid: '180f' }],
      state: 'connected',
      localName: '',
    });
    expect(bthome.bthomePeripherals.get(peripheral.address)).toMatchObject({
      rssi: -44,
      localName: 'Existing device',
      version: 2,
      data: { battery: 85 },
      packetId: 0,
    });
    expect(updatedListener).toHaveBeenCalledTimes(1);
  });

  test('should update cached BLE data without manufacturer debug details when manufacturer data is missing', async () => {
    const bthome = new BTHome(true, false, false, [], LogLevel.DEBUG);
    const peripheral = createPeripheral({
      advertisement: {
        localName: undefined,
        serviceData: [],
        serviceUuids: [],
        manufacturerData: undefined,
        serviceSolicitationUuids: [],
        txPowerLevel: 0,
      },
      mtu: 185,
      services: [{ uuid: '180a' }],
      state: 'connected',
    });

    bthome.blePeripherals.set(peripheral.id, {
      id: peripheral.id,
      address: peripheral.address,
      addressType: peripheral.addressType,
      connectable: peripheral.connectable,
      advertisement: {
        localName: 'Existing device',
        serviceData: [],
        serviceUuids: [],
        manufacturerData: undefined,
        serviceSolicitationUuids: [],
        txPowerLevel: 0,
      } as unknown as PeripheralAdvertisement,
      rssi: -60,
      mtu: null,
      services: [],
      state: 'disconnected',
      localName: 'Existing device',
      lastSeen: new Date('2026-04-25T10:00:00.000Z'),
    });

    await asInternal(bthome).handleDiscovery(peripheral);

    expect(bthome.blePeripherals.get(peripheral.id)).toMatchObject({
      localName: '',
      mtu: 185,
      services: [{ uuid: '180a' }],
      state: 'connected',
    });
  });

  test('should log generic manufacturer data for non Shelly non Apple peripherals when filters allow them', async () => {
    const bthome = new BTHome(false, false, false, [], LogLevel.DEBUG);
    const internal = asInternal(bthome);

    await internal.handleDiscovery(
      createPeripheral({
        advertisement: {
          localName: 'Generic Sensor',
          serviceData: [{ uuid: '180f', data: Buffer.from([0x01]) }],
          serviceUuids: ['180f'],
          manufacturerData: Buffer.from([0x34, 0x12, 0xaa]),
          serviceSolicitationUuids: [],
          txPowerLevel: 7,
        },
      }),
    );

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '    - Manufacturer Data: 3412aa');
  });

  test('should treat a Shelly BLE peripheral without BTHome service data as Shelly only', async () => {
    const bthome = new BTHome(false, false, false, [], LogLevel.DEBUG);

    await asInternal(bthome).handleDiscovery(
      createPeripheral({
        advertisement: {
          localName: 'Shelly Plus Plug',
          serviceData: [],
          serviceUuids: [],
          manufacturerData: undefined,
          serviceSolicitationUuids: [],
          txPowerLevel: 0,
        },
      }),
    );

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Message from Shelly device id'));
  });

  test('should return early from discovery when BTHome, Shelly, or address filters reject a peripheral', async () => {
    const nonBTHomePeripheral = createPeripheral({
      advertisement: { localName: 'Generic Sensor', serviceData: [], serviceUuids: [], manufacturerData: undefined, serviceSolicitationUuids: [], txPowerLevel: 0 },
    });
    const nonShellyBTHomePeripheral = createPeripheral({
      advertisement: {
        localName: 'Generic Sensor',
        serviceData: [{ uuid: 'fcd2', data: Buffer.from([0x40, 0x01, 0x01]) }],
        serviceUuids: [],
        manufacturerData: undefined,
        serviceSolicitationUuids: [],
        txPowerLevel: 0,
      },
    });
    const addressFilteredPeripheral = createPeripheral({
      address: '11:22:33:44:55:66',
      advertisement: {
        localName: 'Shelly BLU HT',
        serviceData: [{ uuid: 'fcd2', data: Buffer.from([0x40, 0x01, 0x01]) }],
        serviceUuids: [],
        manufacturerData: undefined,
        serviceSolicitationUuids: [],
        txPowerLevel: 0,
      },
    });

    await asInternal(new BTHome(false, true, false, [], LogLevel.DEBUG)).handleDiscovery(nonBTHomePeripheral);
    await asInternal(new BTHome(false, false, true, [], LogLevel.DEBUG)).handleDiscovery(nonShellyBTHomePeripheral);
    await asInternal(new BTHome(false, false, false, ['aa:bb:cc:dd:ee:ff'], LogLevel.DEBUG)).handleDiscovery(addressFilteredPeripheral);

    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Message from'));
  });

  test('should reject or resolve while waiting for the Bluetooth adapter based on noble state changes', async () => {
    const bthome = new BTHome();
    const internal = asInternal(bthome);
    let stateChangeListener: ((state: string) => void) | undefined;
    const removeListener = jest.fn();

    await expect(internal.waitForPoweredOn()).rejects.toThrow('Noble is not loaded');

    internal.noble = {
      state: 'poweredOn',
      on: jest.fn(),
      removeListener,
      startScanningAsync: jest.fn<(_services: string[], _allowDuplicates: boolean) => Promise<void>>().mockResolvedValue(),
      stopScanningAsync: jest.fn<() => Promise<void>>().mockResolvedValue(),
    };
    await expect(internal.waitForPoweredOn()).resolves.toBeUndefined();

    internal.noble.state = 'unsupported';
    await expect(internal.waitForPoweredOn()).rejects.toThrow('Bluetooth adapter not usable (state=unsupported)');

    internal.noble.state = 'unknown';
    internal.noble.on = jest.fn((event: string, listener: (state: string) => void) => {
      if (event === 'stateChange') stateChangeListener = listener;
    });

    const waitPromise = internal.waitForPoweredOn();
    stateChangeListener?.('poweredOn');
    await expect(waitPromise).resolves.toBeUndefined();
    expect(removeListener).toHaveBeenCalledWith('stateChange', expect.any(Function));

    const rejectPromise = internal.waitForPoweredOn();
    stateChangeListener?.('unauthorized');
    await expect(rejectPromise).rejects.toThrow('Bluetooth adapter is not usable (state=unauthorized)');

    const unsupportedPromise = internal.waitForPoweredOn();
    stateChangeListener?.('unsupported');
    await expect(unsupportedPromise).rejects.toThrow('Bluetooth adapter is not usable (state=unsupported)');
  });

  test('should time out while waiting for the Bluetooth adapter to power on', async () => {
    jest.useFakeTimers();

    const bthome = new BTHome();
    const internal = asInternal(bthome);
    const removeListener = jest.fn();
    let stateChangeListener: ((state: string) => void) | undefined;

    internal.noble = {
      state: 'unknown',
      on: jest.fn((event: string, listener: (state: string) => void) => {
        if (event === 'stateChange') stateChangeListener = listener;
      }),
      removeListener,
      startScanningAsync: jest.fn<(_services: string[], _allowDuplicates: boolean) => Promise<void>>().mockResolvedValue(),
      stopScanningAsync: jest.fn<() => Promise<void>>().mockResolvedValue(),
    };

    const waitPromise = internal.waitForPoweredOn();
    stateChangeListener?.('resetting');
    jest.advanceTimersByTime(30000);
    await expect(waitPromise).rejects.toThrow('Timeout waiting for the Bluetooth adapter to be powered on (state=unknown)');
    expect(removeListener).toHaveBeenCalledWith('stateChange', expect.any(Function));

    jest.useRealTimers();
  });

  test('should warn when start is called while a BLE scan is already running', async () => {
    const bthome = new BTHome();
    bthome.isScanning = true;

    await bthome.start();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, 'BLE scan already started');
  });

  test('should log a warning when stop is called while scanning is already stopped', async () => {
    const bthome = new BTHome();

    await bthome.stop();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, 'BLE scan already stopped');
  });

  test('should stop scanning and clear cached peripherals when noble is loaded', async () => {
    const bthome = new BTHome();
    const fakeNoble = {
      removeListener: jest.fn(),
      stopScanningAsync: jest.fn<() => Promise<void>>().mockResolvedValue(),
    };

    bthome.isScanning = true;
    (bthome as unknown as { noble: typeof fakeNoble }).noble = fakeNoble;
    bthome.blePeripherals.set('ble-1', {
      id: 'ble-1',
      address: 'aa:bb:cc:dd:ee:ff',
      addressType: 'public',
      connectable: true,
      advertisement: {
        localName: 'Shelly BLU',
        serviceData: [],
        serviceUuids: [],
        manufacturerData: Buffer.alloc(0),
        serviceSolicitationUuids: [],
        txPowerLevel: 0,
      },
      rssi: -60,
      mtu: null,
      services: [],
      state: 'disconnected',
      localName: 'Shelly BLU',
      lastSeen: new Date('2026-04-25T10:00:00.000Z'),
    });
    bthome.bthomePeripherals.set('aa:bb:cc:dd:ee:ff', {
      mac: 'aa:bb:cc:dd:ee:ff',
      rssi: -60,
      localName: 'Shelly BLU',
      version: 2,
      encrypted: false,
      trigger: false,
      data: { battery: 100 },
      packetId: 1,
      lastSeen: new Date('2026-04-25T10:00:00.000Z'),
    });

    await bthome.stop();

    expect(fakeNoble.removeListener).toHaveBeenCalledWith('discover', expect.any(Function));
    expect(fakeNoble.stopScanningAsync).toHaveBeenCalledTimes(1);
    expect(bthome.isScanning).toBe(false);
    expect(bthome.blePeripherals.size).toBe(0);
    expect(bthome.bthomePeripherals.size).toBe(0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Stopping BLE scan…');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'BLE scan stopped');
  });

  test('should warn when noble is missing during stop and log an error when stop scanning fails', async () => {
    const missingNoble = new BTHome();
    missingNoble.isScanning = true;

    await missingNoble.stop();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, 'Noble is not loaded');

    const failingStop = new BTHome();
    failingStop.isScanning = true;
    (failingStop as unknown as { noble: { removeListener: () => void; stopScanningAsync: () => Promise<void> } }).noble = {
      removeListener: jest.fn(),
      stopScanningAsync: jest.fn<() => Promise<void>>().mockRejectedValue(new Error('stop failed')),
    };

    await failingStop.stop();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'Error stopping BLE scan: stop failed');
    expect(failingStop.blePeripherals.size).toBe(0);
    expect(failingStop.bthomePeripherals.size).toBe(0);

    const failingStopWithString = new BTHome();
    failingStopWithString.isScanning = true;
    (failingStopWithString as unknown as { noble: { removeListener: () => void; stopScanningAsync: () => Promise<void> } }).noble = {
      removeListener: jest.fn(),
      stopScanningAsync: jest.fn<() => Promise<void>>().mockRejectedValue('stop failed as string'),
    };

    await failingStopWithString.stop();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'Error stopping BLE scan: stop failed as string');
  });

  test('should log discovered devices when logDevices is called', () => {
    const bthome = new BTHome();
    bthome.bthomePeripherals.set('aa:bb:cc:dd:ee:ff', {
      mac: 'aa:bb:cc:dd:ee:ff',
      rssi: -65,
      localName: 'Shelly BLU HT',
      version: 2,
      encrypted: false,
      trigger: true,
      data: { temperature: 21.5 },
      packetId: 7,
      modelId: 0x0003,
      modelIdShortName: 'SBHT-003C',
      modelIdLongName: 'Shelly BLU HT',
      lastSeen: new Date('2026-04-25T10:00:00.000Z'),
    });

    bthome.logDevices();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Discovered 1 BTHome devices:');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '- aa:bb:cc:dd:ee:ff:');
  });

  test('should decode standard BTHome readings when the payload contains known ids', () => {
    const decoded = decodeBTHome(Buffer.from([0x40, 0x02, 0xc4, 0x09, 0x01, 0x64]));

    expect(decoded).toEqual({
      version: 2,
      encrypted: false,
      trigger: false,
      readings: {
        temperature: 25,
        battery: 100,
      },
      unknown: [],
    });
  });

  test('should decode parser based BTHome fields and throw when a spec entry has no parser and no byte length', () => {
    const specBackup = BTHOME_SPEC[0xfe];
    const defaultFactorSpecBackup = BTHOME_SPEC[0xfd];
    const textDecoded = decodeBTHome(Buffer.from([0x40, 0x53, 0x02, 0x48, 0x69]));
    const buttonDecoded = decodeBTHome(Buffer.from([0x40, 0x3a, 0x02]));

    expect(textDecoded.readings).toEqual({ text: 'Hi' });
    expect(buttonDecoded.readings).toEqual({ button: 'double_press' });

    (BTHOME_SPEC as Record<number, { name: string; bytes: number; signed?: boolean }>)[0xfd] = { name: 'defaultFactor', bytes: 1 };
    expect(decodeBTHome(Buffer.from([0x40, 0xfd, 0x07])).readings).toEqual({ defaultFactor: 7 });

    (BTHOME_SPEC as Record<number, { name: string; bytes: number | null }>)[0xfe] = { name: 'brokenField', bytes: null };
    expect(() => decodeBTHome(Buffer.from([0x40, 0xfe]))).toThrow("BTHome spec for brokenField is missing 'bytes'");

    if (defaultFactorSpecBackup) {
      (BTHOME_SPEC as Record<number, unknown>)[0xfd] = defaultFactorSpecBackup;
    } else {
      delete (BTHOME_SPEC as Record<number, unknown>)[0xfd];
    }

    if (specBackup) {
      (BTHOME_SPEC as Record<number, unknown>)[0xfe] = specBackup;
    } else {
      delete (BTHOME_SPEC as Record<number, unknown>)[0xfe];
    }
  });

  test('should keep duplicate reading ids distinct and stop at the first unknown id', () => {
    const decoded = decodeBTHome(Buffer.from([0x44, 0x57, 0x14, 0x57, 0x15, 0xff, 0x01]));

    expect(decoded.version).toBe(2);
    expect(decoded.encrypted).toBe(false);
    expect(decoded.trigger).toBe(true);
    expect(decoded.readings).toEqual({
      'temperature:1': 20,
      'temperature:2': 21,
    });
    expect(decoded.unknown).toEqual(['0xff → 0xff01']);
  });

  test('should keep numbering stable when the same reading id appears more than twice', () => {
    const decoded = decodeBTHome(Buffer.from([0x40, 0x01, 0x01, 0x01, 0x02, 0x01, 0x03]));

    expect(decoded.readings).toEqual({
      'battery:1': 1,
      'battery:2': 2,
      'battery:3': 3,
    });
  });

  test('should fallback to a generated name and packet id zero for new BTHome devices without a valid local name or packet id', async () => {
    const bthome = new BTHome(false, true, false, [], LogLevel.DEBUG);

    await asInternal(bthome).handleDiscovery(
      createPeripheral({
        address: '22:33:44:55:66:77',
        advertisement: {
          localName: 'x',
          serviceData: [{ uuid: 'fcd2', data: Buffer.from([0x40, 0x01, 0x64]) }],
          serviceUuids: [],
          manufacturerData: undefined,
          serviceSolicitationUuids: [],
          txPowerLevel: 0,
        },
      }),
    );

    expect(bthome.bthomePeripherals.get('22:33:44:55:66:77')).toMatchObject({
      localName: 'BTHome 22:33:44:55:66:77',
      packetId: 0,
      data: { battery: 100 },
    });
  });

  test('should keep a valid packet id when updating an existing BTHome device', async () => {
    const bthome = new BTHome(false, true, false, [], LogLevel.DEBUG);

    bthome.bthomePeripherals.set('33:44:55:66:77:88', {
      mac: '33:44:55:66:77:88',
      rssi: -55,
      localName: 'Existing device',
      version: 2,
      encrypted: false,
      trigger: false,
      data: {},
      packetId: 0,
      lastSeen: new Date('2026-04-25T10:00:00.000Z'),
    });

    await asInternal(bthome).handleDiscovery(
      createPeripheral({
        address: '33:44:55:66:77:88',
        advertisement: {
          localName: 'Existing device',
          serviceData: [{ uuid: 'fcd2', data: Buffer.from([0x40, 0x00, 0x07, 0x01, 0x64]) }],
          serviceUuids: [],
          manufacturerData: undefined,
          serviceSolicitationUuids: [],
          txPowerLevel: 0,
        },
      }),
    );

    expect(bthome.bthomePeripherals.get('33:44:55:66:77:88')).toMatchObject({
      packetId: 7,
      data: { packetId: 7, battery: 100 },
    });
  });

  test('should decode Shelly manufacturer data and resolve model names when the payload is valid', () => {
    const decoded = decodeShellyManufacturerData(Buffer.from([0xa9, 0x0b, 0x01, 0x15, 0x00, 0x0b, 0x02, 0x00, 0x0a, 0xa1, 0xb2, 0xc3, 0xd4, 0xe5, 0xf6]));
    const decodedFromHex = decodeShellyManufacturerData('a90b0115000b02000aa1b2c3d4e5f6');

    expect(decoded).toEqual({
      companyId: 0x0ba9,
      flags: {
        discoverable: true,
        authEnabled: false,
        rpcEnabled: true,
        buzzerEnabled: false,
        inPairingMode: true,
      },
      modelId: 0x0002,
      modelIdShortName: 'SBDW-002C',
      modelIdLongName: 'Shelly BLU DoorWindow',
      mac: 'a1:b2:c3:d4:e5:f6',
    });
    expect(decodedFromHex).toEqual(decoded);
    expect(getShellyBluShortName(0x0002)).toBe('SBDW-002C');
    expect(getShellyBluLongName(0x0002)).toBe('Shelly BLU DoorWindow');
    expect(decodeShellyManufacturerData(Buffer.from([0x01, 0x02, 0x03]))).toBeNull();
    expect(decodeShellyManufacturerData(Buffer.from([0x4c, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))).toBeNull();
  });

  test('should stop parsing Shelly manufacturer data when an unknown block type is encountered', () => {
    expect(decodeShellyManufacturerData(Buffer.from([0xa9, 0x0b, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))).toEqual({ companyId: 0x0ba9 });
  });

  test('should expose representative BTHome spec metadata and parser outputs', () => {
    const timestampBuffer = Buffer.alloc(4);
    timestampBuffer.writeUInt32LE(1710000000, 0);

    expect(BTHOME_SPEC[0x02]).toMatchObject({ name: 'temperature', bytes: 2, signed: true, factor: 0.01 });
    expect(BTHOME_SPEC[0x3a].parser?.(Buffer.from([0x02]), 0)).toBe('double_press');
    expect(BTHOME_SPEC[0x3a].parser?.(Buffer.from([0x7f]), 0)).toBe('unknown');
    expect(BTHOME_SPEC[0x3c].parser?.(Buffer.from([0x05, 0x03]), 0)).toEqual({ event: 'evt0x5', steps: 3 });
    expect(BTHOME_SPEC[0x53].parser?.(Buffer.from([0x02, 0x48, 0x69]), 0)).toBe('Hi');
    expect(BTHOME_SPEC[0x54].parser?.(Buffer.from([0x02, 0xab, 0xcd]), 0)).toBe('abcd');
    expect(BTHOME_SPEC[0x50].parser?.(timestampBuffer, 0)).toBe('2024-03-09T16:00:00.000Z');
    expect(BTHOME_SPEC[0xf1].parser?.(Buffer.from([0x01, 0x02, 0x03, 0x04]), 0)).toBe('4.3.2.1');
    expect(BTHOME_SPEC[0xf2].parser?.(Buffer.from([0x02, 0x03, 0x04]), 0)).toBe('4.2.3');
  });
});
