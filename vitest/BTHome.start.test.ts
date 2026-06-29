const NAME = 'BTHomeStart';

import { jest } from '@jest/globals';
import { setDebug, setupTest } from 'matterbridge/jestutils';
import { LogLevel } from 'matterbridge/logger';

await setupTest(NAME, false);

interface InternalBTHome {
  waitForPoweredOn: () => Promise<void>;
}

interface NobleDouble {
  state: string;
  on: jest.Mock;
  removeListener: jest.Mock;
  startScanningAsync: jest.Mock<(_services: string[], _allowDuplicates: boolean) => Promise<void>>;
  stopScanningAsync: jest.Mock<() => Promise<void>>;
}

type BTHomeModule = typeof import('./BTHome.js');

function asInternal(value: object): InternalBTHome {
  return value as InternalBTHome;
}

function createFakeNoble(state = 'poweredOn'): NobleDouble {
  return {
    state,
    on: jest.fn(),
    removeListener: jest.fn(),
    startScanningAsync: jest.fn<(_services: string[], _allowDuplicates: boolean) => Promise<void>>().mockResolvedValue(),
    stopScanningAsync: jest.fn<() => Promise<void>>().mockResolvedValue(),
  };
}

function overrideNobleProperty<T extends object, K extends keyof T>(target: T, key: K, value: T[K]): void {
  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value,
  });
}

async function importFreshBTHome(tag: string): Promise<BTHomeModule> {
  return import(`./BTHome.js?${tag}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

async function getMutableNoble(): Promise<NobleDouble> {
  const nobleModule = await import('@stoprocent/noble');

  return nobleModule.default as unknown as NobleDouble;
}

async function configureNoble(state = 'poweredOn'): Promise<NobleDouble> {
  const noble = await getMutableNoble();

  overrideNobleProperty(noble, 'state', state);
  overrideNobleProperty(noble, 'on', jest.fn());
  overrideNobleProperty(noble, 'removeListener', jest.fn());
  overrideNobleProperty(noble, 'startScanningAsync', jest.fn<(_services: string[], _allowDuplicates: boolean) => Promise<void>>().mockResolvedValue());
  overrideNobleProperty(noble, 'stopScanningAsync', jest.fn<() => Promise<void>>().mockResolvedValue());

  return noble;
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

describe('BTHomeStart', () => {
  const originalArgv = [...process.argv];

  beforeEach(() => {
    jest.clearAllMocks();
    process.argv = [...originalArgv];
  });

  afterEach(async () => {
    process.argv = [...originalArgv];
    jest.unstable_unmockModule('@stoprocent/noble');
    jest.unstable_unmockModule('./BTHomeDecoder.js');
    jest.unstable_unmockModule('./BTHomeShellyMdDecoder.js');
    await setDebug(false);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  test('should reject when noble cannot be loaded during start', async () => {
    jest.unstable_mockModule('@stoprocent/noble', () => {
      throw new Error('load failed');
    });

    const module = await importFreshBTHome('import-error');

    await expect(new module.BTHome().start()).rejects.toThrow('load failed');
  });

  test('should stringify non Error failures during start', async () => {
    jest.unstable_mockModule('@stoprocent/noble', () => {
      throw 'load failed as string';
    });

    const importFailureModule = await importFreshBTHome('import-error-string');
    await expect(new importFailureModule.BTHome().start()).rejects.toBe('load failed as string');
    jest.unstable_unmockModule('@stoprocent/noble');

    await configureNoble('unknown');
    const adapterModule = await importFreshBTHome('adapter-fail-string');
    const adapterBTHome = new adapterModule.BTHome();
    jest.spyOn(asInternal(adapterBTHome), 'waitForPoweredOn').mockRejectedValueOnce('adapter failed as string');
    await expect(adapterBTHome.start()).rejects.toBe('adapter failed as string');

    const noble = await configureNoble();
    noble.startScanningAsync.mockRejectedValueOnce('scan failed as string');
    const scanModule = await importFreshBTHome('scan-fail-string');
    const scanBTHome = new scanModule.BTHome();
    jest.spyOn(asInternal(scanBTHome), 'waitForPoweredOn').mockResolvedValueOnce();
    await expect(scanBTHome.start()).rejects.toBe('scan failed as string');
  });

  test('should reject when waiting for the adapter fails during start', async () => {
    await configureNoble('unknown');

    const module = await importFreshBTHome('adapter-fail');
    const bthome = new module.BTHome();
    jest.spyOn(asInternal(bthome), 'waitForPoweredOn').mockRejectedValueOnce(new Error('adapter failed'));

    await expect(bthome.start()).rejects.toThrow('adapter failed');
  });

  test('should reject when scan start fails after the adapter is ready', async () => {
    const noble = await configureNoble();
    noble.startScanningAsync.mockRejectedValueOnce(new Error('scan failed'));

    const module = await importFreshBTHome('scan-fail');
    const bthome = new module.BTHome();
    jest.spyOn(asInternal(bthome), 'waitForPoweredOn').mockResolvedValueOnce();

    await expect(bthome.start()).rejects.toThrow('scan failed');
  });

  test('should start scanning when noble loads and the adapter is ready', async () => {
    const noble = await configureNoble();

    const module = await importFreshBTHome('start-success');
    const bthome = new module.BTHome();

    await bthome.start();

    expect(bthome.isScanning).toBe(true);
    expect(noble.startScanningAsync).toHaveBeenCalledWith([], true);
    expect(noble.on).toHaveBeenCalledWith('discover', expect.any(Function));
  });

  test('should execute the scan CLI path and its registered process handlers', async () => {
    const handlers: Partial<Record<'SIGINT' | 'SIGTERM' | 'uncaughtException' | 'unhandledRejection', (...args: unknown[]) => Promise<void>>> = {};
    const processOnSpy = jest.spyOn(process, 'on').mockImplementation(((event: string, handler: (...args: unknown[]) => Promise<void>) => {
      if (event === 'SIGINT' || event === 'SIGTERM' || event === 'uncaughtException' || event === 'unhandledRejection') {
        handlers[event] = handler;
      }
      return process;
    }) as typeof process.on);
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => code as never) as typeof process.exit);
    await configureNoble();

    process.argv = ['node', 'BTHome.js', '--scan', '--ble', '--bthome', '--shellyble', '--address', 'aa:bb:cc:dd:ee:ff', '11:22:33:44:55:66', '--logger', LogLevel.INFO];

    const module = await importFreshBTHome('cli-success');
    const logDevicesSpy = jest.spyOn(module.BTHome.prototype, 'logDevices').mockImplementation(() => undefined);
    const stopSpy = jest.spyOn(module.BTHome.prototype, 'stop').mockResolvedValue();

    await flushMicrotasks();
    await handlers.SIGINT?.();
    await handlers.SIGTERM?.();
    await handlers.uncaughtException?.(new Error('boom'));
    await handlers.unhandledRejection?.('reason');

    expect(processOnSpy).toHaveBeenCalled();
    expect(logDevicesSpy).toHaveBeenCalledTimes(2);
    expect(stopSpy).toHaveBeenCalledTimes(4);
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  test('should log and exit when the scan CLI path cannot start discovery', async () => {
    const processOnSpy = jest.spyOn(process, 'on').mockImplementation(((event: string, handler: (...args: unknown[]) => Promise<void>) => {
      void event;
      void handler;
      return process;
    }) as typeof process.on);
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => code as never) as typeof process.exit);
    const noble = await configureNoble();

    noble.startScanningAsync.mockRejectedValueOnce(new Error('cli scan failed'));
    process.argv = ['node', 'BTHome.js', '--scan'];

    await importFreshBTHome('cli-fail');
    await flushMicrotasks();

    expect(processOnSpy).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  test('should execute the scan CLI path when short options are used', async () => {
    const handlers: Partial<Record<'SIGINT', (...args: unknown[]) => Promise<void>>> = {};
    const processOnSpy = jest.spyOn(process, 'on').mockImplementation(((event: string, handler: (...args: unknown[]) => Promise<void>) => {
      if (event === 'SIGINT') handlers.SIGINT = handler;
      return process;
    }) as typeof process.on);
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => code as never) as typeof process.exit);

    await configureNoble();
    process.argv = ['node', 'BTHome.js', '--scan', '-address', 'aa:bb:cc:dd:ee:ff', '-logger', LogLevel.INFO];

    const module = await importFreshBTHome('cli-short-options');
    const stopSpy = jest.spyOn(module.BTHome.prototype, 'stop').mockResolvedValue();

    await flushMicrotasks();
    await handlers.SIGINT?.();

    expect(processOnSpy).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  test('should execute the scan CLI path when the address option appears before scan', async () => {
    const handlers: Partial<Record<'SIGINT', (...args: unknown[]) => Promise<void>>> = {};
    const processOnSpy = jest.spyOn(process, 'on').mockImplementation(((event: string, handler: (...args: unknown[]) => Promise<void>) => {
      if (event === 'SIGINT') handlers.SIGINT = handler;
      return process;
    }) as typeof process.on);
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => code as never) as typeof process.exit);

    await configureNoble();
    process.argv = ['node', 'BTHome.js', '--address', 'aa:bb:cc:dd:ee:ff', '--scan'];

    const module = await importFreshBTHome('cli-address-first');
    const stopSpy = jest.spyOn(module.BTHome.prototype, 'stop').mockResolvedValue();

    await flushMicrotasks();
    await handlers.SIGINT?.();

    expect(processOnSpy).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  test('should preserve existing device fields when a mocked decoder returns undefined values', async () => {
    jest.unstable_mockModule('./BTHomeDecoder.js', () => ({
      decodeBTHome: jest.fn(() => ({ version: undefined, encrypted: undefined, trigger: undefined, readings: {} })),
    }));

    const module = await importFreshBTHome('decoder-nullish-branches');
    const bthome = new module.BTHome(false, true, false, [], LogLevel.DEBUG);
    const internal = bthome as unknown as { handleDiscovery: (peripheral: object) => Promise<void> };

    bthome.bthomePeripherals.set('aa:bb:cc:dd:ee:ff', {
      mac: 'aa:bb:cc:dd:ee:ff',
      rssi: -50,
      localName: 'Existing device',
      version: 9,
      encrypted: true,
      trigger: true,
      data: { battery: 10 },
      packetId: 7,
      lastSeen: new Date('2026-04-25T10:00:00.000Z'),
    });

    await internal.handleDiscovery({
      id: 'peripheral-1',
      address: 'aa:bb:cc:dd:ee:ff',
      addressType: 'public',
      connectable: true,
      advertisement: {
        localName: undefined,
        serviceData: [{ uuid: 'fcd2', data: Buffer.from([0x40, 0x01, 0x01]) }],
        serviceUuids: [],
        manufacturerData: undefined,
        serviceSolicitationUuids: [],
        txPowerLevel: 0,
      },
      rssi: undefined,
      mtu: null,
      services: [],
      state: 'disconnected',
    });

    expect(bthome.bthomePeripherals.get('aa:bb:cc:dd:ee:ff')).toMatchObject({
      rssi: -50,
      localName: 'Existing device',
      version: 9,
      encrypted: true,
      trigger: true,
      packetId: 0,
      data: { battery: 10 },
    });
  });

  test('should keep handling Shelly manufacturer data when the mocked decoder returns null or missing model names', async () => {
    const decodeShellyManufacturerData = jest
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ companyId: 0x0ba9, modelId: 1, modelIdShortName: undefined, modelIdLongName: undefined, mac: 'aa:bb:cc:dd:ee:ff' });

    jest.unstable_mockModule('./BTHomeShellyMdDecoder.js', () => ({
      decodeShellyManufacturerData,
    }));

    const module = await importFreshBTHome('shelly-nullish-branches');
    const bthome = new module.BTHome(false, false, false, [], LogLevel.DEBUG);
    const internal = bthome as unknown as { handleDiscovery: (peripheral: object) => Promise<void> };
    const manufacturerData = Buffer.from([0xa9, 0x0b, 0x01, 0x00]);

    await internal.handleDiscovery({
      id: 'peripheral-1',
      address: 'aa:bb:cc:dd:ee:ff',
      addressType: 'public',
      connectable: true,
      advertisement: {
        localName: 'Shelly BLU',
        serviceData: [],
        serviceUuids: [],
        manufacturerData,
        serviceSolicitationUuids: [],
        txPowerLevel: 0,
      },
      rssi: -40,
      mtu: null,
      services: [],
      state: 'disconnected',
    });

    await internal.handleDiscovery({
      id: 'peripheral-2',
      address: '11:22:33:44:55:66',
      addressType: 'public',
      connectable: true,
      advertisement: {
        localName: 'Shelly BLU',
        serviceData: [],
        serviceUuids: [],
        manufacturerData,
        serviceSolicitationUuids: [],
        txPowerLevel: 0,
      },
      rssi: -42,
      mtu: null,
      services: [],
      state: 'disconnected',
    });

    expect(decodeShellyManufacturerData).toHaveBeenCalledTimes(2);
    expect(bthome.bthomePeripherals.size).toBe(0);
  });
});
