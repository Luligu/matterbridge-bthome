/**
 * This file contains the BTHome specs.
 *
 * @file src\BTHomeSpec.ts
 * @author Luca Liguori
 * @created 2025-04-22
 * @version 1.0.0
 * @license Apache-2.0
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

/**
 * @module BTHomeSpec
 * @description This module defines the BTHome specification for parsing sensor data.
 * It includes the specification for various sensor types, their data formats,
 * and parsing functions.
 * The specification is based on the BTHome v2 format.
 * The data is represented as a series of entries, each with a unique ID,
 * a human-readable name, the number of bytes to read, whether the integer is signed,
 * a scaling factor to apply to the raw integer, and an optional custom parser function.
 * The parser function takes a buffer and an offset as arguments and returns the decoded value.
 * The specification is exported as a constant object, which can be used to decode sensor data.
 * The specification is read-only and cannot be modified.
 * The specification is based on the BTHome v2 format, which is a standard for
 * representing sensor data in a binary format.
 * The specification includes standard sensor data, extended sensor data,
 * binary sensors, events, timestamps, and device information.
 */
export interface BTHomeSpecEntry {
  /** Human‑readable name of the field */
  name: string;
  /** Number of bytes to read (null for length‑prefixed fields) */
  bytes: number | null;
  /** Whether the integer is signed (if numeric) */
  signed?: boolean;
  /** Scaling factor to apply to raw integer */
  factor?: number;
  /**
   * Optional custom parser:
   *
   * @param buf - full payload buffer
   * @param offset - start index of this field's data
   * @returns decoded value (string, number, object, etc.)
   */

  parser?: (_buf: Buffer, _offset: number) => string | object;
}

// Full BTHome v2 (pulled from https://bthome.io/format/)
export const BTHOME_SPEC: Readonly<Record<number, BTHomeSpecEntry>> = {
  // — Packet id
  0x00: { name: 'packetId', bytes: 1, signed: false, factor: 1 },

  // — Standard sensor data
  0x01: { name: 'battery', bytes: 1, signed: false, factor: 1 },
  0x02: { name: 'temperature', bytes: 2, signed: true, factor: 0.01 },
  0x03: { name: 'humidity', bytes: 2, signed: false, factor: 0.01 },
  0x04: { name: 'pressure', bytes: 3, signed: false, factor: 0.01 },
  0x05: { name: 'illuminance', bytes: 3, signed: false, factor: 0.01 },
  0x06: { name: 'massKilograms', bytes: 2, signed: false, factor: 0.01 },
  0x07: { name: 'massPounds', bytes: 2, signed: false, factor: 0.01 },
  0x08: { name: 'dewPoint', bytes: 2, signed: true, factor: 0.01 },
  0x09: { name: 'countSmall', bytes: 1, signed: false, factor: 1 },
  0x0a: { name: 'energy_kWh', bytes: 3, signed: false, factor: 0.001 },
  0x0b: { name: 'power_W', bytes: 3, signed: false, factor: 0.01 },
  0x0c: { name: 'voltage_V', bytes: 2, signed: false, factor: 0.001 },
  0x0d: { name: 'pm2_5_ugm3', bytes: 2, signed: false, factor: 1 },
  0x0e: { name: 'pm10_ugm3', bytes: 2, signed: false, factor: 1 },
  0x13: { name: 'tvoc_ugm3', bytes: 2, signed: false, factor: 1 },
  0x14: { name: 'moisture', bytes: 2, signed: false, factor: 0.01 },
  0x2e: { name: 'humidity', bytes: 1, signed: false, factor: 1 },
  0x2f: { name: 'moisture', bytes: 1, signed: false, factor: 1 },

  // — Extended sensor data
  0x40: { name: 'distance_mm', bytes: 2, signed: false, factor: 1 },
  0x41: { name: 'distance_m', bytes: 2, signed: false, factor: 0.1 },
  0x42: { name: 'duration_s', bytes: 3, signed: false, factor: 0.001 },
  0x43: { name: 'current_A', bytes: 2, signed: false, factor: 0.001 },
  0x44: { name: 'speed_ms', bytes: 2, signed: false, factor: 0.01 },
  0x45: { name: 'temperature', bytes: 2, signed: true, factor: 0.1 },
  0x46: { name: 'uvIndex', bytes: 1, signed: false, factor: 0.1 },
  0x47: { name: 'volume_L', bytes: 2, signed: false, factor: 0.1 },
  0x48: { name: 'volume_mL', bytes: 2, signed: false, factor: 1 },
  0x49: { name: 'flowRate_m3ph', bytes: 2, signed: false, factor: 0.001 },
  0x4a: { name: 'voltage_alt_V', bytes: 2, signed: false, factor: 0.1 },
  0x4b: { name: 'gas_m3', bytes: 3, signed: false, factor: 0.001 },
  0x4c: { name: 'gas_alt_m3', bytes: 4, signed: false, factor: 0.001 },
  0x4d: { name: 'energy_alt_kWh', bytes: 4, signed: false, factor: 0.001 },
  0x4e: { name: 'volume_alt_L', bytes: 4, signed: false, factor: 0.001 },
  0x4f: { name: 'water_L', bytes: 4, signed: false, factor: 0.001 },
  0x52: { name: 'gyroscope_dps', bytes: 2, signed: false, factor: 0.001 },
  0x53: {
    // UTF‑8 text
    name: 'text',
    parser(buf: Buffer, off: number) {
      return buf.slice(off + 1, off + 1 + buf[off]).toString('utf8');
    },
    bytes: null,
  },
  0x54: {
    // raw hex blob
    name: 'raw',
    parser(buf: Buffer, off: number) {
      return buf.slice(off + 1, off + 1 + buf[off]).toString('hex');
    },
    bytes: null,
  },
  0x55: { name: 'volumeStorage_L', bytes: 4, signed: false, factor: 0.001 },
  0x57: { name: 'temperature', bytes: 1, signed: true, factor: 1 },
  0x58: { name: 'temperature', bytes: 1, signed: true, factor: 0.35 },
  0x59: { name: 'count8', bytes: 1, signed: true, factor: 1 },
  0x5a: { name: 'count16', bytes: 2, signed: true, factor: 1 },
  0x5b: { name: 'count32', bytes: 4, signed: true, factor: 1 },
  0x5c: { name: 'power_alt_W', bytes: 4, signed: true, factor: 0.01 },
  0x5d: { name: 'current_alt_A', bytes: 2, signed: true, factor: 0.001 },
  0x5e: { name: 'direction_deg', bytes: 2, signed: false, factor: 0.01 },
  0x5f: { name: 'precipitation_mm', bytes: 2, signed: false, factor: 1 },

  // — Binary sensors (uint8, 0/1)
  0x0f: { name: 'genericBoolean', bytes: 1, signed: false, factor: 1 },
  0x10: { name: 'powerState', bytes: 1, signed: false, factor: 1 },
  0x11: { name: 'openingState', bytes: 1, signed: false, factor: 1 },
  0x15: { name: 'batteryState', bytes: 1, signed: false, factor: 1 }, // 0 (False = Normal) 1 (True = Low)
  0x16: { name: 'batteryChargingState', bytes: 1, signed: false, factor: 1 }, // 0 (False = Not Charging) 1 (True = Charging)
  0x17: { name: 'carbonMonoxideState', bytes: 1, signed: false, factor: 1 },
  0x18: { name: 'coldState', bytes: 1, signed: false, factor: 1 },
  0x19: { name: 'connectivityState', bytes: 1, signed: false, factor: 1 },
  0x1a: { name: 'doorState', bytes: 1, signed: false, factor: 1 }, // 0 (False = Closed) 1 (True = Open)
  0x1b: { name: 'garageDoorState', bytes: 1, signed: false, factor: 1 }, // 0 (False = Closed) 1 (True = Open)
  0x1c: { name: 'gasState', bytes: 1, signed: false, factor: 1 },
  0x1d: { name: 'heatState', bytes: 1, signed: false, factor: 1 },
  0x1e: { name: 'lightState', bytes: 1, signed: false, factor: 1 },
  0x1f: { name: 'lockState', bytes: 1, signed: false, factor: 1 },
  0x20: { name: 'moistureState', bytes: 1, signed: false, factor: 1 },
  0x21: { name: 'motionState', bytes: 1, signed: false, factor: 1 }, // 0 (False = Clear) 1 (True = Detected)
  0x22: { name: 'movingState', bytes: 1, signed: false, factor: 1 }, // 0 (False = Not moving) 1 (True = Moving)
  0x23: { name: 'occupancyState', bytes: 1, signed: false, factor: 1 }, // 0 (False = Clear) 1 (True = Detected)
  0x24: { name: 'plugState', bytes: 1, signed: false, factor: 1 },
  0x25: { name: 'presenceState', bytes: 1, signed: false, factor: 1 },
  0x26: { name: 'problemState', bytes: 1, signed: false, factor: 1 },
  0x27: { name: 'runningState', bytes: 1, signed: false, factor: 1 },
  0x28: { name: 'safetyState', bytes: 1, signed: false, factor: 1 },
  0x29: { name: 'smokeState', bytes: 1, signed: false, factor: 1 },
  0x2a: { name: 'soundState', bytes: 1, signed: false, factor: 1 },
  0x2b: { name: 'tamperState', bytes: 1, signed: false, factor: 1 },
  0x2c: { name: 'vibrationState', bytes: 1, signed: false, factor: 1 },
  0x2d: { name: 'windowState', bytes: 1, signed: false, factor: 1 }, // 0 (False = Closed) 1 (True = Open)

  // — Events
  0x3a: {
    name: 'button',
    bytes: 1,
    signed: false,
    factor: 1,
    parser(buf: Buffer, off: number) {
      const code = buf.readUInt8(off);
      const EVENT_MAP: Record<number, string> = {
        0x00: 'none',
        0x01: 'single_press',
        0x02: 'double_press',
        0x03: 'triple_press',
        0x04: 'long_press',
        0x05: 'long_double_press',
        0x06: 'long_triple_press',
        0x80: 'hold_press',
        0xfe: 'hold_press',
      };
      return EVENT_MAP[code] ?? 'unknown';
    },
  },
  0x3c: {
    name: 'dimmerEvent',
    bytes: 2,
    signed: false,
    factor: 1,
    parser(buf: Buffer, off: number) {
      const evt = buf.readUInt8(off);
      const steps = buf.readUInt8(off + 1);
      const map = { 0x00: 'none', 0x01: 'rotateLeft', 0x02: 'rotateRight' };
      return { event: map[evt as keyof typeof map] || `evt0x${evt.toString(16)}`, steps };
    },
  },
  // — Extended sensor data
  0x3f: { name: 'rotation_deg', bytes: 2, signed: true, factor: 0.1 },

  // — Timestamp
  0x50: {
    name: 'timestamp',
    bytes: 4,
    signed: false,
    factor: 1,
    parser(buf: Buffer, off: number) {
      return new Date(buf.readUInt32LE(off) * 1000).toISOString();
    },
  },

  // - Device information
  0xf0: { name: 'deviceTypeId', bytes: 2, signed: false, factor: 1 },
  0xf1: {
    // fw v0.0.0.1 (4 bytes LE)
    name: 'firmwareVersion',
    bytes: 4,
    signed: false,
    factor: 1,
    parser(buf: Buffer, off: number) {
      const [rc, patch, minor, major] = buf.slice(off, off + 4);
      return `${major}.${minor}.${patch}.${rc}`;
    },
  },
  0xf2: {
    // fw v0.0.1 (3 bytes LE)
    name: 'firmwareVersionShort',
    bytes: 3,
    signed: false,
    factor: 1,
    parser(buf: Buffer, off: number) {
      const [minor, patch, major] = buf.slice(off, off + 3);
      return `${major}.${minor}.${patch}`;
    },
  },
};
