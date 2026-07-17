/**
 * @file vitest/BTHome.start.test.ts
 * @description This file contains the tests for the BTHome class start behavior.
 * @author Luca Liguori
 */

const NAME = 'BTHomeStart';

import { LogLevel } from 'matterbridge/logger';
import { setDebug, setupTest } from 'matterbridge/vitest-utils';
import type { Mock } from 'vitest';

await setupTest(NAME, false);

interface InternalBTHome {
  waitForPoweredOn: () => Promise<void>;
}

interface NobleDouble {
  state: string;
  on: Mock;
  removeListener: Mock;
  startScanningAsync: Mock<(_services: string[], _allowDuplicates: boolean) => Promise<void>>;
  stopScanningAsync: Mock<() => Promise<void>>;
}

type BTHomeModule = typeof import('../src/BTHome.js');
type ProcessExitCode = Parameters<typeof process.exit>[0];

function asInternal(value: object): InternalBTHome {
  return value as InternalBTHome;
}

function mockProcessExit(code?: ProcessExitCode): never {
  return code as never;
}

function createFakeNoble(state = 'poweredOn'): NobleDouble {
  return {
    state,
    on: vi.fn(),
    removeListener: vi.fn(),
    startScanningAsync: vi.fn<(_services: string[], _allowDuplicates: boolean) => Promise<void>>().mockResolvedValue(),
    stopScanningAsync: vi.fn<() => Promise<void>>().mockResolvedValue(),
  };
}

async function importFreshBTHome(_tag: string): Promise<BTHomeModule> {
  // Reset the module registry so BTHome.js (and its module-level CLI block) is re-evaluated on the next import.
  vi.resetModules();
  return await import('../src/BTHome.js');
}

function configureNoble(state = 'poweredOn'): NobleDouble {
  // Mock @stoprocent/noble with a stable fake so the dynamic import inside BTHome.start() resolves to it.
  const noble = createFakeNoble(state);
  vi.doMock('@stoprocent/noble', () => ({ default: noble }));
  return noble;
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

describe('BTHomeStart', () => {
  const originalArgv = [...process.argv];

  beforeEach(() => {
    vi.clearAllMocks();
    process.argv = [...originalArgv];
  });

  afterEach(async () => {
    process.argv = [...originalArgv];
    vi.doUnmock('@stoprocent/noble');
    vi.doUnmock('../src/BTHomeDecoder.js');
    vi.doUnmock('../src/BTHomeShellyMdDecoder.js');
    await setDebug(false);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  test('should reject when noble cannot be loaded during start', async () => {
    vi.doMock('@stoprocent/noble', () => ({
      get default(): never {
        throw new Error('load failed');
      },
    }));

    const module = await importFreshBTHome('import-error');

    await expect(new module.BTHome().start()).rejects.toThrow('load failed');
  });

  test('should stringify non Error failures during start', async () => {
    vi.doMock('@stoprocent/noble', () => ({
      get default(): never {
        // oxlint-disable-next-line typescript/only-throw-error -- exercising the non-Error (String(err)) rejection branch in BTHome.start()
        throw 'load failed as string';
      },
    }));

    const importFailureModule = await importFreshBTHome('import-error-string');
    await expect(new importFailureModule.BTHome().start()).rejects.toBe('load failed as string');
    vi.doUnmock('@stoprocent/noble');

    configureNoble('unknown');
    const adapterModule = await importFreshBTHome('adapter-fail-string');
    const adapterBTHome = new adapterModule.BTHome();
    vi.spyOn(asInternal(adapterBTHome), 'waitForPoweredOn').mockRejectedValueOnce('adapter failed as string');
    await expect(adapterBTHome.start()).rejects.toBe('adapter failed as string');

    const noble = configureNoble();
    noble.startScanningAsync.mockRejectedValueOnce('scan failed as string');
    const scanModule = await importFreshBTHome('scan-fail-string');
    const scanBTHome = new scanModule.BTHome();
    vi.spyOn(asInternal(scanBTHome), 'waitForPoweredOn').mockResolvedValueOnce();
    await expect(scanBTHome.start()).rejects.toBe('scan failed as string');
  });

  test('should reject when waiting for the adapter fails during start', async () => {
    configureNoble('unknown');

    const module = await importFreshBTHome('adapter-fail');
    const bthome = new module.BTHome();
    vi.spyOn(asInternal(bthome), 'waitForPoweredOn').mockRejectedValueOnce(new Error('adapter failed'));

    await expect(bthome.start()).rejects.toThrow('adapter failed');
  });

  test('should reject when scan start fails after the adapter is ready', async () => {
    const noble = configureNoble();
    noble.startScanningAsync.mockRejectedValueOnce(new Error('scan failed'));

    const module = await importFreshBTHome('scan-fail');
    const bthome = new module.BTHome();
    vi.spyOn(asInternal(bthome), 'waitForPoweredOn').mockResolvedValueOnce();

    await expect(bthome.start()).rejects.toThrow('scan failed');
  });

  test('should start scanning when noble loads and the adapter is ready', async () => {
    const noble = configureNoble();

    const module = await importFreshBTHome('start-success');
    const bthome = new module.BTHome();

    await bthome.start();

    expect(bthome.isScanning).toBe(true);
    expect(noble.startScanningAsync).toHaveBeenCalledWith([], true);
    expect(noble.on).toHaveBeenCalledWith('discover', expect.any(Function));
  });

  test('should execute the scan CLI path and its registered process handlers', async () => {
    const handlers: Partial<Record<'SIGINT' | 'SIGTERM' | 'uncaughtException' | 'unhandledRejection', (...args: unknown[]) => Promise<void>>> = {};
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(((event: string, handler: (...args: unknown[]) => Promise<void>) => {
      if (event === 'SIGINT' || event === 'SIGTERM' || event === 'uncaughtException' || event === 'unhandledRejection') {
        handlers[event] = handler;
      }
      return process;
    }) as typeof process.on);
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(mockProcessExit);
    configureNoble();

    process.argv = ['node', 'BTHome.js', '--scan', '--ble', '--bthome', '--shellyble', '--address', 'aa:bb:cc:dd:ee:ff', '11:22:33:44:55:66', '--logger', LogLevel.INFO];

    const module = await importFreshBTHome('cli-success');
    const logDevicesSpy = vi.spyOn(module.BTHome.prototype, 'logDevices').mockImplementation(() => {});
    const stopSpy = vi.spyOn(module.BTHome.prototype, 'stop').mockResolvedValue();

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
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(((event: string, handler: (...args: unknown[]) => Promise<void>) => {
      void event;
      void handler;
      return process;
    }) as typeof process.on);
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(mockProcessExit);
    const noble = configureNoble();

    noble.startScanningAsync.mockRejectedValueOnce(new Error('cli scan failed'));
    process.argv = ['node', 'BTHome.js', '--scan'];

    await importFreshBTHome('cli-fail');
    await flushMicrotasks();

    expect(processOnSpy).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  test('should execute the scan CLI path when short options are used', async () => {
    const handlers: Partial<Record<'SIGINT', (...args: unknown[]) => Promise<void>>> = {};
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(((event: string, handler: (...args: unknown[]) => Promise<void>) => {
      if (event === 'SIGINT') handlers.SIGINT = handler;
      return process;
    }) as typeof process.on);
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(mockProcessExit);

    configureNoble();
    process.argv = ['node', 'BTHome.js', '--scan', '-address', 'aa:bb:cc:dd:ee:ff', '-logger', LogLevel.INFO];

    const module = await importFreshBTHome('cli-short-options');
    const stopSpy = vi.spyOn(module.BTHome.prototype, 'stop').mockResolvedValue();

    await flushMicrotasks();
    await handlers.SIGINT?.();

    expect(processOnSpy).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  test('should execute the scan CLI path when the address option appears before scan', async () => {
    const handlers: Partial<Record<'SIGINT', (...args: unknown[]) => Promise<void>>> = {};
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(((event: string, handler: (...args: unknown[]) => Promise<void>) => {
      if (event === 'SIGINT') handlers.SIGINT = handler;
      return process;
    }) as typeof process.on);
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(mockProcessExit);

    configureNoble();
    process.argv = ['node', 'BTHome.js', '--address', 'aa:bb:cc:dd:ee:ff', '--scan'];

    const module = await importFreshBTHome('cli-address-first');
    const stopSpy = vi.spyOn(module.BTHome.prototype, 'stop').mockResolvedValue();

    await flushMicrotasks();
    await handlers.SIGINT?.();

    expect(processOnSpy).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  test('should preserve existing device fields when a mocked decoder returns undefined values', async () => {
    vi.doMock('../src/BTHomeDecoder.js', () => ({
      decodeBTHome: vi.fn(() => ({ version: undefined, encrypted: undefined, trigger: undefined, readings: {} })),
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
    const decodeShellyManufacturerData = vi
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ companyId: 0x0ba9, modelId: 1, modelIdShortName: undefined, modelIdLongName: undefined, mac: 'aa:bb:cc:dd:ee:ff' });

    vi.doMock('../src/BTHomeShellyMdDecoder.js', () => ({
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
