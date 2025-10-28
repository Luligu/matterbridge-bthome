/**
 * This file contains the Platform of the BTHome plugin.
 *
 * @file src\platform.ts
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

import {
  bridgedNode,
  contactSensor,
  DeviceTypeDefinition,
  genericSwitch,
  humiditySensor,
  lightSensor,
  MatterbridgeDynamicPlatform,
  MatterbridgeEndpoint,
  occupancySensor,
  PlatformConfig,
  PlatformMatterbridge,
  powerSource,
  pressureSensor,
  temperatureSensor,
} from 'matterbridge';
import { AnsiLogger, db, debugStringify, idn, rs, BLUE, LogLevel, nf } from 'matterbridge/logger';
import { NumberTag } from 'matterbridge/matter';
import { BTHome, BTHomeDevice } from './BTHome.js';

export type BTHomePlatformConfig = PlatformConfig & {
  whiteList: string[];
  blackList: string[];
};

/**
 * This is the standard interface for Matterbridge plugins.
 * Each plugin should export a default function that follows this signature.
 *
 * @param {Matterbridge} matterbridge - An instance of MatterBridge. This is the main interface for interacting with the MatterBridge system.
 * @param {AnsiLogger} log - An instance of AnsiLogger. This is used for logging messages in a format that can be displayed with ANSI color codes.
 * @param {PlatformConfig} config - The platform configuration.
 * @returns {Platform} - An instance of the SomfyTahomaPlatform. This is the main interface for interacting with the Somfy Tahoma system.
 *
 */
export default function initializePlugin(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: BTHomePlatformConfig): Platform {
  return new Platform(matterbridge, log, config);
}

export class Platform extends MatterbridgeDynamicPlatform {
  readonly btHome = new BTHome();
  readonly bridgedDevices = new Map<string, MatterbridgeEndpoint>();

  constructor(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: BTHomePlatformConfig) {
    super(matterbridge, log, config);

    // Verify that Matterbridge is the correct version
    if (this.verifyMatterbridgeVersion === undefined || typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion('3.3.0')) {
      throw new Error(`This plugin requires Matterbridge version >= "3.3.0". Please update Matterbridge to the latest version in the frontend.`);
    }

    this.log.info('Initializing platform:', this.config.name);

    this.btHome.on('discovered', async (device: BTHomeDevice) => {
      this.log.notice(`Discovered new BTHome device: ${device.mac}`);
      this.log.info('- name:', device.localName);
      this.log.info('- rssi:', device.rssi);
      this.log.info('- version:', device.version);
      this.log.info('- encrypted:', device.encrypted);
      this.log.info('- trigger:', device.trigger);
      this.log.info('- data:', debugStringify(device.data));
      this.addDevice(device);
      await this.savePeripherals();
    });

    this.btHome.on('update', async (device: BTHomeDevice) => {
      this.log.info(
        `${db}BTHome message from ${idn}${device.mac}${rs}${db} rssi ${BLUE}${device.rssi}${db} name ${BLUE}${device.localName}${db} version ${BLUE}${device.version}${db} ${BLUE}${device.encrypted ? 'encrypted ' : ''}${device.trigger ? 'trigger ' : ''}${db}data ${debugStringify(device.data)}`,
      );
      await this.updateDevice(device);
    });

    this.log.info('Finished initializing platform:', this.config.name);
  }

  override async onStart(reason?: string): Promise<void> {
    this.log.info('onStart called with reason:', reason ?? 'none');

    // Wait for the platform to be ready
    await this.ready;

    // Clear all devices select
    await this.clearSelect();

    // Load the devices from the storage
    await this.loadPeripherals();

    // Start the BTHome discovery
    await this.btHome.start();
  }

  override async onConfigure(): Promise<void> {
    await super.onConfigure();
    this.log.info('onConfigure called');
    this.btHome.bthomePeripherals.forEach(async (device) => {
      this.updateDevice(device);
    });
  }

  override async onAction(action: string, value?: string, id?: string): Promise<void> {
    this.log.info('onAction called with action:', action, 'and value:', value ?? 'none', 'and id:', id ?? 'none');
    if (action === 'delete' && value) {
      value = value.toLowerCase().trimStart().trimEnd();
      if (!this.btHome.bthomePeripherals.has(value)) {
        this.log.error(`The device ${value} is not registered. Please check the MAC address.`);
        return;
      }
      await this.btHome.stop();
      this.btHome.bthomePeripherals.delete(value);
      await this.savePeripherals();
      const device = this.bridgedDevices.get(value);
      if (device) this.unregisterDevice(device);
      this.bridgedDevices.delete(value);
      this.log.notice(`The device ${value} has been deleted. Please restart the plugin.`);
    }
    if (action === 'reset') {
      await this.btHome.stop();
      this.btHome.bthomePeripherals.clear();
      await this.savePeripherals();
      this.unregisterAllDevices();
      this.bridgedDevices.clear();
      this.log.notice('The storage has been reset');
    }
  }

  override async onChangeLoggerLevel(logLevel: LogLevel) {
    this.log.info(`Changing logger level for platform ${idn}${this.config.name}${rs}${nf} to ${logLevel}`);
    this.bridgedDevices.forEach((device) => (device.log.logLevel = logLevel));
  }

  override async onShutdown(reason?: string): Promise<void> {
    this.log.info('onShutdown called with reason:', reason ?? 'none');

    // Save all devices to the storage
    await this.savePeripherals();

    // Stop the BTHome discovery
    this.btHome.logDevices();
    await this.btHome.stop();

    await super.onShutdown(reason);

    if (this.config.unregisterOnShutdown === true) await this.unregisterAllDevices();
    this.bridgedDevices.clear();
    this.log.info('onShutdown finished');
  }

  private converter: { reading: string; deviceType?: DeviceTypeDefinition; cluster?: string; attribute?: string; property?: string; type?: string; factor?: number }[] = [
    { reading: 'battery', deviceType: powerSource, cluster: 'PowerSource', attribute: 'batPercentRemaining', factor: 2 },
    { reading: 'temperature', deviceType: temperatureSensor, cluster: 'TemperatureMeasurement', attribute: 'measuredValue', factor: 100 },
    { reading: 'humidity', deviceType: humiditySensor, cluster: 'RelativeHumidityMeasurement', attribute: 'measuredValue', factor: 100 },
    { reading: 'pressure', deviceType: pressureSensor, cluster: 'PressureMeasurement', attribute: 'measuredValue', factor: 100 },
    { reading: 'motionState', deviceType: occupancySensor, cluster: 'OccupancySensing', attribute: 'occupancy', property: 'occupied', type: 'boolean' },
    { reading: 'movingState', deviceType: occupancySensor, cluster: 'OccupancySensing', attribute: 'occupancy', property: 'occupied', type: 'boolean' },
    { reading: 'occupancyState', deviceType: occupancySensor, cluster: 'OccupancySensing', attribute: 'occupancy', property: 'occupied', type: 'boolean' },
    { reading: 'illuminance', deviceType: lightSensor, cluster: 'IlluminanceMeasurement', attribute: 'measuredValue', type: 'lux' },
    { reading: 'doorState', deviceType: contactSensor, cluster: 'BooleanState', attribute: 'stateValue', type: 'boolean_inverted' },
    { reading: 'garageDoorState', deviceType: contactSensor, cluster: 'BooleanState', attribute: 'stateValue', type: 'boolean_inverted' },
    { reading: 'windowState', deviceType: contactSensor, cluster: 'BooleanState', attribute: 'stateValue', type: 'boolean_inverted' },
    { reading: 'button', deviceType: genericSwitch, cluster: 'Switch' },
    { reading: 'rotation_deg' },
    { reading: 'packetId' },
    { reading: 'deviceTypeId' },
    { reading: 'firmwareVersion' },
    { reading: 'firmwareVersionShort' },
    { reading: 'text' },
    { reading: 'raw' },
  ];

  private async addDevice(device: BTHomeDevice): Promise<void> {
    this.setSelectDevice(device.mac, device.localName, undefined, 'ble');
    if (!this.validateDevice(device.mac, true)) return;
    const matterbridgeDevice = new MatterbridgeEndpoint(
      [bridgedNode],
      { uniqueStorageKey: 'BTHome ' + device.mac },
      this.config.debug as boolean,
    ).createDefaultBridgedDeviceBasicInformationClusterServer(
      'BTHome ' + device.mac,
      device.mac,
      this.matterbridge.aggregatorVendorId,
      this.matterbridge.aggregatorVendorName,
      'BTHomeDevice',
    );

    for (const property in device.data) {
      const [name, index] = property.split(':');
      const converter = this.converter.find((converter) => converter.reading === name);
      if (converter && converter.deviceType) {
        this.setSelectDeviceEntity(device.mac, property, `${name}${index ? ' n. ' + index : ''}`, 'ble');
        const child = matterbridgeDevice.addChildDeviceType(
          property,
          converter.deviceType,
          index
            ? {
                uniqueStorageKey: property,
                tagList: [{ mfgCode: null, namespaceId: NumberTag.Zero.namespaceId, tag: parseInt(index), label: null }],
              }
            : {
                uniqueStorageKey: property,
              },
        );
        if (converter.cluster === 'PowerSource') child.createDefaultPowerSourceReplaceableBatteryClusterServer();
        child.addRequiredClusterServers();
      } else if (converter && !converter.deviceType) {
        //
      } else {
        this.log.warn(`No converter found for property ${name} in device ${device.mac}`);
      }
    }

    await this.registerDevice(matterbridgeDevice);
    this.bridgedDevices.set(device.mac, matterbridgeDevice);
    await this.updateDevice(device);
  }

  private async updateDevice(device: BTHomeDevice): Promise<void> {
    if (!this.validateDevice(device.mac, false)) return;
    const matterbridgeDevice = this.bridgedDevices.get(device.mac);
    if (!matterbridgeDevice) return;
    for (const property in device.data) {
      const [name, _index] = property.split(':');
      const converter = this.converter.find((converter) => converter.reading === name);
      if (!converter) {
        this.log.debug(`***No converter found for property ${property} in device mac ${device.mac} model ${device.localName}`);
        continue;
      }
      if (converter && converter.deviceType && converter.cluster && converter.attribute) {
        const child = matterbridgeDevice.getChildEndpointByName(property);
        let value = device.data[property];
        if (converter.factor && typeof value === 'number') value = value * converter.factor;
        if (converter.type === 'boolean' && typeof value === 'number') value = device.data[property] !== 0;
        if (converter.type === 'boolean_inverted' && typeof value === 'number') value = device.data[property] === 0;
        if (converter.type === 'lux' && typeof value === 'number') value = Math.round(Math.max(Math.min(10000 * Math.log10(value), 0xfffe), 0));
        if (converter.property) {
          await child?.updateAttribute(converter.cluster, converter.attribute, { [converter.property]: value }, child.log);
        } else {
          await child?.updateAttribute(converter.cluster, converter.attribute, value, child.log);
        }
      }
      if (converter && converter.deviceType && converter.cluster === 'Switch') {
        const child = matterbridgeDevice.getChildEndpointByName(property);
        const value = device.data[property];
        if (child) {
          if (value === 'single_press') await child.triggerSwitchEvent('Single', child.log);
          else if (value === 'double_press') await child.triggerSwitchEvent('Double', child.log);
          else if (value === 'long_press') await child.triggerSwitchEvent('Long', child.log);
        }
        device.data[property] = 'none';
      }
    }
  }

  private async loadPeripherals(): Promise<void> {
    if (!this.context) throw new Error('Plugin context is not available');
    const bthomePeripherals = await this.context.get<BTHomeDevice[]>('bthomePeripherals', []);
    this.log.info(`Loading ${bthomePeripherals.length} BTHome devices from the storage...`);
    for (const peripheral of bthomePeripherals) {
      await this.addDevice(peripheral);
      this.btHome.bthomePeripherals.set(peripheral.mac, peripheral);
      this.log.debug(`Loaded BTHome device ${idn}${peripheral.mac}${rs}${db} ${peripheral.localName} from the storage`);
    }
  }

  private async savePeripherals(): Promise<void> {
    if (!this.context) throw new Error('Plugin context is not available');
    await this.context.set('bthomePeripherals', Array.from(this.btHome.bthomePeripherals.values()));
    this.log.info(`Saved ${this.btHome.bthomePeripherals.size} BTHome devices in the storage`);
  }
}
