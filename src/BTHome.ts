#!/usr/bin/env node
/**
 * This file contains the class BTHome.
 *
 * @file src\BTHome.ts
 * @author Luca Liguori
 * @date 2025-04-22
 * @version 1.0.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License. *
 */

import { hasParameter, isValidNumber, isValidString } from 'matterbridge/utils';
import { AnsiLogger, LogLevel, TimestampFormat, nf, BLUE, GREEN, MAGENTA, YELLOW } from 'matterbridge/logger';

import { EventEmitter } from 'node:events';
import type { Noble, Peripheral, PeripheralAddressType, PeripheralAdvertisement, PeripheralState, Service } from '@stoprocent/noble';

import { decodeBTHome } from './BTHomeDecoder.js';
import { decodeShellyManufacturerData } from './BTHomeShellyMdDecoder.js';
import { CYAN } from 'node-ansi-logger';

const _blushellies = [
  '38:39:8f:8b:d2:29', // Shelly BLU Button
  '28:68:47:fc:9a:6b', // Shelly BLU Trv 200
  '28:db:a7:b5:d1:ca', // Shelly BLU Trv 201
  '0c:ae:5f:5a:0b:fa', // Shelly BLU Motion
  '0c:ef:f6:01:8d:b8', // Shelly BLU Wall Switch
  '0c:ef:f6:f1:d7:7b', // Shelly BLU DoorWindow
  '7c:c6:b6:58:b9:a0', // Shelly BLU RC Button
  '7c:c6:b6:65:2d:87', // Shelly BLU HT
  '7c:c6:b6:bd:7a:9a', // Shelly BLU HT
  '60:ef:ab:3f:c9:7b', // Black Shelly BLU DoorWindow
  '38:39:8f:99:58:49', // Black Shelly BLU Button
  '7c:c6:b6:2b:17:b6', // Black Shelly BLU Tough Button
  '38:39:8f:a0:9e:34', // Black Shelly BLU HT
];

const _shellies = [
  '34:cd:b0:77:bc:d6', // BLU Gateway Gen3
  'b0:b2:1c:fa:ad:1a', // ShellyBluGw-B0B21CFAAD18
  'ec:62:60:8c:9c:02', // ShellyPro2PM-EC62608C9C00
  '8c:bf:ea:9d:e2:9e', // Shelly2PMG3-8CBFEA9DE29C
  'cc:7b:5c:8a:ea:2e', // ShellyPlusI4-CC7B5C8AEA2C
  '34:b7:da:ca:c8:32', // Shelly1G3-34B7DACAC830
  '1c:69:20:44:f1:42', // ShellyPlus2PM-1C692044F140
  '42:27:b3:f0:fc:29', // WallDisplay
];

/**
 * Interface representing a Ble device.
 * @interface
 * @property {string} mac - The MAC address of the device.
 * @property {number} rssi - The Received Signal Strength Indicator (RSSI) of the device.
 * @property {string} localName - The local name of the device.
 * @property {Date} lastSeen - The last time the device was seen.
 */
export interface BleDevice {
  id: string;
  address: string;
  addressType: PeripheralAddressType;
  connectable: boolean;
  advertisement: PeripheralAdvertisement;
  rssi: number;
  mtu: number | null;
  services: Service[];
  state: PeripheralState;

  localName: string;
  lastSeen: Date;
}

/**
 * Interface representing a BTHome device.
 * @interface
 * @property {string} mac - The MAC address of the device.
 * @property {number} rssi - The Received Signal Strength Indicator (RSSI) of the device.
 * @property {string} localName - The local name of the device.
 * @property {number} version - The version of the BTHome protocol used by the device.
 * @property {boolean} encrypted - Indicates if the device is encrypted.
 * @property {boolean} trigger - Indicates if the device is a trigger.
 * @property {Record<string, boolean | number | string | object>} data - The data readings from the device.
 * @property {Date} lastSeen - The last time the device was seen.
 */
export interface BTHomeDevice {
  mac: string;
  rssi: number;
  localName: string;
  version: number;
  encrypted: boolean;
  trigger: boolean;
  data: Record<string, boolean | number | string | object>;
  packetId: number;
  modelId?: number;
  modelIdShortName?: string;
  modelIdLongName?: string;
  lastSeen: Date;
}

interface BTHomeEvents {
  discovered: [device: BTHomeDevice];
  update: [device: BTHomeDevice];
}

/**
 * BTHome class for discovering and managing Bluetooth devices.
 * @extends EventEmitter
 */
export class BTHome extends EventEmitter<BTHomeEvents> {
  private noble: Noble | undefined;
  readonly log: AnsiLogger;
  isScanning = false;
  filterBle = false;
  filterBTHome = false;
  filterShellyBle = false;
  filterAddress: string[] = [];

  /**
   * Map to store discovered BTHome devices.
   * @type {Map<string, BTHomeDevice>}
   *
   * @remark {string} - The key is the Bluetooth device's MAC address.
   * @remark {BTHomeDevice} - The value is the BTHomeDevice object containing the device informations.
   */
  readonly bthomePeripherals: Map<string, BTHomeDevice> = new Map<string, BTHomeDevice>();
  /**
   * Map to store discovered Ble devices.
   * @type {Map<string, BTHomeDevice>}
   *
   * @remark {string} - The key is the Bluetooth device's id.
   * @remark {BTHomeDevice} - The value is the BleDevice object containing the device informations.
   */
  readonly blePeripherals: Map<string, BleDevice> = new Map<string, BleDevice>();

  /**
   * Creates an instance of the BTHome class.
   * @param {boolean} filterBle - Flag to filter BLE devices.
   * @param {boolean} filterBTHome - Flag to filter BTHome devices.
   * @param {boolean} filterShellyBle - Flag to filter Shelly BLE devices.
   * @param {string[]} filterAddress - Array of MAC addresses to filter.
   * @param {LogLevel} logLevel - The log level for the logger.
   */
  constructor(filterBle = false, filterBTHome = true, filterShellyBle = false, filterAddress: string[] = [], logLevel = LogLevel.DEBUG) {
    super();
    this.log = new AnsiLogger({ logName: 'BTHome', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel });
    this.filterBle = filterBle;
    this.filterBTHome = filterBTHome;
    this.filterShellyBle = filterShellyBle;
    this.filterAddress = filterAddress;
    for (const address of this.filterAddress) address.toLowerCase().trim();
    this.log.debug('BTHome constructor called with parameters:');
    this.log.debug(`  - filterBTHome: ${filterBTHome}`);
    this.log.debug(`  - filterShellyBle: ${filterShellyBle}`);
    this.log.debug(`  - filterAddress: ${filterAddress.join(', ')}`);

    // Bind the handleDiscovery method to the correct context
    this.handleDiscovery = this.handleDiscovery.bind(this);
  }

  /**
   * Checks if the given peripheral is a Shelly device with Ble component enabled.
   * @param {Peripheral} peripheral - The Bluetooth peripheral to check.
   * @returns {boolean} True if the peripheral is a Shelly device, false otherwise.
   */
  private isShellyBlePeripheral(peripheral: Peripheral): boolean {
    if (peripheral.advertisement.localName === undefined || peripheral.advertisement.localName === null || peripheral.advertisement.localName === '') return false;
    if (!peripheral.advertisement.localName.startsWith('Shelly') && peripheral.advertisement.localName !== 'WallDisplay') return false;
    return true;
  }

  /**
   * Checks if the given peripheral is a BTHome device.
   * @param {Peripheral} peripheral - The Bluetooth peripheral to check.
   * @returns {boolean} True if the peripheral is a BTHome device, false otherwise.
   */
  private isBTHomePeripheral(peripheral: Peripheral): boolean {
    if (Array.from(this.bthomePeripherals.values()).find((device) => device.mac === peripheral.address)) return true;
    if (peripheral.advertisement.serviceData && peripheral.advertisement.serviceData.length) {
      return peripheral.advertisement.serviceData.find((entry) => entry.uuid === 'fcd2') !== undefined;
    }
    return false;
  }

  /**
   * Handles the discovery of Bluetooth peripherals.
   * @param {Peripheral} peripheral - The discovered peripheral.
   */
  private async handleDiscovery(peripheral: Peripheral) {
    if (this.filterBle) {
      let assignedNumber: string | undefined = undefined;
      let manufacturerData: string | undefined = undefined;
      if (peripheral.advertisement.manufacturerData && peripheral.advertisement.manufacturerData.length >= 2) {
        assignedNumber = '0x' + peripheral.advertisement.manufacturerData.readUInt16LE(0).toString(16).padStart(4, '0');
        manufacturerData = '0x' + peripheral.advertisement.manufacturerData.toString('hex');
      }
      let bleDevice = this.blePeripherals.get(peripheral.id);
      if (!bleDevice) {
        bleDevice = {
          id: peripheral.id,
          address: peripheral.address,
          addressType: peripheral.addressType,
          connectable: peripheral.connectable,
          advertisement: peripheral.advertisement,
          rssi: peripheral.rssi,
          mtu: null,
          services: [],
          state: 'disconnected',
          localName: peripheral.advertisement.localName ?? '',
          lastSeen: new Date(),
        };
        this.blePeripherals.set(peripheral.id, bleDevice);
        this.log.info(`[${GREEN}New${nf}] Device ${MAGENTA}${peripheral.address}${nf} Rssi: ${CYAN}${peripheral.rssi}${nf} Name: ${CYAN}${bleDevice.localName}${nf}`);
        if (assignedNumber) this.log.debug(`                                         ManufacturerData Key: ${assignedNumber} Value: ${manufacturerData}`);
      } else {
        bleDevice.address = peripheral.address;
        bleDevice.addressType = peripheral.addressType;
        bleDevice.connectable = peripheral.connectable;
        bleDevice.advertisement = peripheral.advertisement;
        bleDevice.rssi = peripheral.rssi;
        bleDevice.mtu = peripheral.mtu;
        bleDevice.services = peripheral.services;
        bleDevice.state = peripheral.state;
        bleDevice.localName = peripheral.advertisement.localName ?? '';
        bleDevice.lastSeen = new Date();
        this.log.info(`[${YELLOW}Chg${nf}] Device ${MAGENTA}${peripheral.address}${nf} Rssi: ${CYAN}${peripheral.rssi}${nf} Name: ${CYAN}${bleDevice.localName}${nf}`);
        if (assignedNumber) this.log.debug(`                                         ManufacturerData Key: ${assignedNumber} Value: ${manufacturerData}`);
      }
    }

    // Check if the peripheral is a Shelly device
    const isShelly = this.isShellyBlePeripheral(peripheral);
    // Check if the peripheral is a Shelly BTHome device
    const isBTHome = this.isBTHomePeripheral(peripheral);
    // Filter out devices based on the provided filters
    if (this.filterBTHome && !isBTHome) return;
    if (this.filterShellyBle && !isShelly) return;
    if (this.filterAddress.length > 0 && !this.filterAddress.includes(peripheral.address.toLowerCase().trim())) return;

    if (isBTHome) {
      this.log.debug(`${BLUE}Message from Shelly BLU id ${peripheral.id}:`);
    } else if (isShelly) {
      this.log.debug(`${GREEN}Message from Shelly device id ${peripheral.id}:`);
    } else {
      this.log.debug(`Message from peripheral id ${peripheral.id}:`);
    }
    this.log.debug(`    - Address: ${peripheral.address} (${peripheral.addressType})`);
    this.log.debug(`    - Connectable: ${peripheral.connectable}`);
    this.log.debug(`    - RSSI: ${peripheral.rssi}`);

    // Local Name
    if (peripheral.advertisement.localName) {
      this.log.debug(`    - Local Name: ${peripheral.advertisement.localName}`);
    }

    // Service UUIDs
    if (peripheral.advertisement.serviceUuids.length) {
      this.log.debug(`    - Advertised Services: ${peripheral.advertisement.serviceUuids.join(', ')}`);
    }

    // Service Data
    const serviceData = peripheral.advertisement.serviceData;
    if (serviceData && serviceData.length) {
      this.log.debug('    - Service Data:');
      serviceData.forEach((entry) => {
        if (entry.uuid === 'fcd2') {
          const bthome = decodeBTHome(entry.data);
          this.log.debug(`        BTHome Service Data (${entry.data.toString('hex')}): ${JSON.stringify(bthome)}`);
          let device: BTHomeDevice;
          if (this.bthomePeripherals.has(peripheral.address)) {
            device = this.bthomePeripherals.get(peripheral.address) as BTHomeDevice;
            device.rssi = peripheral.rssi ?? device.rssi;
            device.localName = peripheral.advertisement.localName ?? device.localName;
            device.version = bthome.version ?? device.version;
            device.encrypted = bthome.encrypted ?? device.encrypted;
            device.trigger = bthome.trigger ?? device.trigger;
            device.data = Object.assign(device.data, bthome.readings);
            device.packetId = isValidNumber(bthome.readings.packetId, 0) ? bthome.readings.packetId : 0;
            device.lastSeen = new Date();
            this.emit('update', device);
          } else {
            device = {
              mac: peripheral.address,
              rssi: peripheral.rssi,
              localName: isValidString(peripheral.advertisement.localName, 3) ? peripheral.advertisement.localName : 'BTHome ' + peripheral.address,
              version: bthome.version,
              encrypted: bthome.encrypted,
              trigger: bthome.trigger,
              data: bthome.readings,
              packetId: isValidNumber(bthome.readings.packetId, 0) ? bthome.readings.packetId : 0,
              lastSeen: new Date(),
            };
            this.bthomePeripherals.set(peripheral.address, device);
            this.emit('discovered', device);
          }
        } else {
          this.log.debug(`        ${entry.uuid}: ${entry.data.toString('hex')}`);
        }
      });
    }

    // Manufacturer Data
    if (peripheral.advertisement.manufacturerData && peripheral.advertisement.manufacturerData.length >= 2) {
      const assignedNumber = peripheral.advertisement.manufacturerData.readUInt16LE(0);
      // https://www.bluetooth.com/specifications/assigned-numbers/
      if (assignedNumber === 0x0ba9) {
        const data = decodeShellyManufacturerData(peripheral.advertisement.manufacturerData);
        this.log.debug(`    - Shelly Manufacturer Data:`);
        if (data) {
          this.log.debug(`        - Flags: ${JSON.stringify(data.flags)}`);
          this.log.debug(`        - Model ID: ${data.modelId} short name ${data.modelIdShortName ?? ''} long name ${data.modelIdLongName ?? ''}`);
          this.log.debug(`        - MAC: ${data.mac}`);
          if (this.bthomePeripherals.has(peripheral.address)) {
            const device = this.bthomePeripherals.get(peripheral.address) as BTHomeDevice;
            device.modelId = data.modelId;
            device.modelIdShortName = data.modelIdShortName;
            device.modelIdLongName = data.modelIdLongName;
            this.emit('update', device);
          }
        }
      } else if (assignedNumber === 0x004c) {
        this.log.debug(`    - Apple Manufacturer Data: ${peripheral.advertisement.manufacturerData.toString('hex')}`);
      } else {
        this.log.debug(`    - Manufacturer Data: ${peripheral.advertisement.manufacturerData.toString('hex')}`);
      }
    }

    // TX Power Level
    if (peripheral.advertisement.txPowerLevel) {
      this.log.debug(`    - TX Power Level: ${peripheral.advertisement.txPowerLevel}`);
    }
  }

  /**
   * Waits for the Bluetooth adapter to be powered on.
   * @returns {Promise<void>} A promise that resolves when the adapter is powered on.
   * @throws {Error} If the Bluetooth adapter is unsupported or unauthorized or timed out.
   */
  private async waitForPoweredOn(): Promise<void> {
    if (!this.noble) throw new Error('Noble is not loaded');
    if (this.noble.state === 'poweredOn') return;
    if (this.noble.state === 'unsupported' || this.noble.state === 'unauthorized') throw new Error(`Bluetooth adapter not usable (state=${this.noble.state})`);
    this.log.info(`Bluetooth adapter state is ${this.noble.state}`);
    this.log.info('Waiting 30 seconds for the Bluetooth adapter state to be poweredOn…');

    return new Promise((resolve, reject) => {
      const onStateChange = (state: string) => {
        this.log.info(`Bluetooth adapter changed state to ${state}`);
        if (state === 'poweredOn') {
          clearTimeout(timeout);
          this.noble?.removeListener('stateChange', onStateChange);
          resolve();
        } else if (state === 'unsupported' || state === 'unauthorized') {
          clearTimeout(timeout);
          this.noble?.removeListener('stateChange', onStateChange);
          reject(new Error(`Bluetooth adapter is not usable (state=${state})`));
        }
      };

      const timeout = setTimeout(() => {
        this.noble?.removeListener('stateChange', onStateChange);
        reject(new Error(`Timeout waiting for the Bluetooth adapter to be powered on (state=${this.noble?.state})`));
      }, 30000);

      this.noble?.on('stateChange', onStateChange);
    });
  }

  /**
   * Starts the Bluetooth scanning process.
   * @returns {Promise<void>} A promise that resolves when the scanning process starts.
   * @throws {Error} If an error occurs during the scanning process.
   */
  async start(): Promise<void> {
    if (this.isScanning) {
      this.log.warn('BLE scan already started');
      return;
    }
    this.noble = await import('@stoprocent/noble')
      .then((noble) => noble.default)
      .catch((err) => {
        this.log.error(`Error loading noble: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      });

    this.log.info('Checking the Bluetooth adapter state…');
    try {
      await this.waitForPoweredOn();
    } catch (err) {
      this.log.error(`Adapter error: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
    this.log.info(`Bluetooth adapter state is ${this.noble.state}`);

    this.log.info('Starting BLE scan…');
    try {
      await this.noble.startScanningAsync([], true);
    } catch (err) {
      this.log.error(`Scan start failed: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
    this.noble.on('discover', this.handleDiscovery);
    this.isScanning = true;
    this.log.info('BLE scan started');
  }

  /**
   * Stops the Bluetooth scanning process.
   * @returns {Promise<void>} A promise that resolves when the scanning process stops.
   */
  async stop(): Promise<void> {
    if (!this.isScanning) {
      this.log.warn('BLE scan already stopped');
      return;
    }
    if (!this.noble) {
      this.log.warn('Noble is not loaded');
      return;
    }
    try {
      this.log.info('Stopping BLE scan…');
      this.noble.removeListener('discover', this.handleDiscovery);
      await this.noble.stopScanningAsync();
      this.isScanning = false;
      this.log.info('BLE scan stopped');
    } catch (err) {
      this.log.error(`Error stopping BLE scan: ${err instanceof Error ? err.message : String(err)}`);
    }
    this.noble = undefined;
    this.blePeripherals.clear();
    this.bthomePeripherals.clear();
  }

  /**
   * Logs all discovered BTHome devices.
   * @returns {void}
   */
  logDevices(): void {
    this.log.debug(`Discovered ${this.bthomePeripherals.size} BTHome devices:`);
    this.bthomePeripherals.forEach((device) => {
      this.log.debug(`- ${device.mac}:`);
      this.log.debug(`  - RSSI: ${device.rssi}`);
      this.log.debug(`  - Local Name: ${device.localName}`);
      this.log.debug(`  - Version: ${device.version}`);
      this.log.debug(`  - Encrypted: ${device.encrypted}`);
      this.log.debug(`  - Trigger: ${device.trigger}`);
      this.log.debug(`  - Packet ID: ${device.packetId}`);
      this.log.debug(`  - Last Seen: ${device.lastSeen.toLocaleString()}`);
      this.log.debug(`  - Model ID: ${device.modelId} short name ${device.modelIdShortName} long name ${device.modelIdLongName}`);
      this.log.debug(`  - Data: ${JSON.stringify(device.data, null, 2)}`);
    });
  }
}

function getStringArrayParameter(name: string): string[] {
  const args = process.argv.slice(2);
  const idx = args.indexOf(`--${name}`) || args.indexOf(`-${name}`);
  if (idx < 0) return [];
  const values: string[] = [];
  for (let i = idx + 1; i < args.length && !args[i].startsWith('-'); i++) {
    values.push(args[i]);
  }
  return values;
}

if (process.argv.includes('--scan')) {
  const bthome = new BTHome(
    hasParameter('ble'),
    hasParameter('bthome'),
    hasParameter('shellyble'),
    hasParameter('address') ? getStringArrayParameter('address') : [],
    hasParameter('logger') ? (process.argv[process.argv.indexOf('--logger') + 1] as LogLevel) : LogLevel.DEBUG,
  );

  process.on('SIGINT', async () => {
    bthome.logDevices();
    await bthome.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    bthome.logDevices();
    await bthome.stop();
    process.exit(0);
  });

  process.on('uncaughtException', async (error) => {
    bthome.log.error('BTHome uncaught Exception:', error);
    await bthome.stop();
  });

  process.on('unhandledRejection', async (reason) => {
    bthome.log.error('BTHome unhandled Rejection:', reason);
    await bthome.stop();
  });

  bthome.start().catch((error) => {
    bthome.log.error('BTHome error starting BTHome discovery:', error);
    process.exit(1);
  });
}
