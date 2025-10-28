/**
 * This file contains the BTHome manufacturer data decoder for Shelly devices.
 *
 * @file src\BTHomeShellyMdDecoder.ts
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

/** Mapping of Shelly BLU device IDs to their long names */
const SHELLY_MODEL_LONG_NAMES: Readonly<Record<number, string>> = {
  0x0001: 'Shelly BLU Button1',
  0x0002: 'Shelly BLU DoorWindow',
  0x0003: 'Shelly BLU HT',
  0x0005: 'Shelly BLU Motion',
  0x0006: 'Shelly BLU Wall Switch 4',
  0x0007: 'Shelly BLU RC Button 4',
  0x0008: 'Shelly BLU TRV',
};

/** Mapping of Shelly BLU device IDs to their long names */
const SHELLY_MODEL_SHORT_NAMES: Readonly<Record<number, string>> = {
  0x0001: 'SBBT-002C',
  0x0002: 'SBDW-002C',
  0x0003: 'SBHT-003C',
  0x0005: 'SBMO-003Z',
  0x0006: 'SBBT-004CEU',
  0x0007: 'SBBT-004CUS',
  0x0008: 'SBTR-001AEU',
};

/**
 * Return the long name for a given Shelly BLU model ID.
 *
 * @param {number} id – the numeric ID
 * @returns {string | undefined} the long model name, or `undefined` if unknown
 */
export function getShellyBluLongName(id: number): string | undefined {
  // return the mapping (record uses numeric keys)
  return SHELLY_MODEL_LONG_NAMES[id];
}

/**
 * Return the long name for a given Shelly BLU model ID.
 *
 * @param {number} id – the numeric ID
 * @returns {string | undefined} the short model name, or `undefined` if unknown
 */
export function getShellyBluShortName(id: number): string | undefined {
  // return the mapping (record uses numeric keys)
  return SHELLY_MODEL_SHORT_NAMES[id];
}

export interface ShellyFlags {
  discoverable: boolean;
  authEnabled: boolean;
  rpcEnabled: boolean;
  buzzerEnabled: boolean;
  inPairingMode: boolean;
}

export interface ShellyManufacturerData {
  companyId: number;
  flags?: ShellyFlags;
  modelId?: number;
  modelIdShortName?: string;
  modelIdLongName?: string;
  mac?: string;
}

/**
 * Decode Shelly BLE Manufacturer Data (Allterco MFID 0x0BA9)
 *
 * @param {Buffer | string} input – raw manufacturerData as Buffer or hex string
 * @returns {ShellyManufacturerData | null} parsed fields
 */
export function decodeShellyManufacturerData(input: Buffer | string): ShellyManufacturerData | null {
  if (input.length < 10) return null;
  const buf: Buffer = Buffer.isBuffer(input) ? input : Buffer.from(input.replace(/\s+/g, ''), 'hex');

  let offset = 0;
  // 1) Company ID (uint16 LE)
  const companyId = buf.readUInt16LE(offset);
  if (companyId !== 0x0ba9) return null; // Allterco
  offset += 2;

  const result: ShellyManufacturerData = { companyId };

  // 2) Parse each TLV block
  while (offset < buf.length) {
    const blockType = buf.readUInt8(offset++);
    switch (blockType) {
      case 0x01: {
        // Flags (uint16 LE)
        const flagsRaw = buf.readUInt16LE(offset);
        offset += 2;
        result.flags = {
          discoverable: Boolean(flagsRaw & (1 << 0)), // bit 0
          authEnabled: Boolean(flagsRaw & (1 << 1)), // bit 1
          rpcEnabled: Boolean(flagsRaw & (1 << 2)), // bit 2
          buzzerEnabled: Boolean(flagsRaw & (1 << 3)), // bit 3
          inPairingMode: Boolean(flagsRaw & (1 << 4)), // bit 4
        };
        break;
      }

      case 0x0b: {
        // Model ID (uint16 LE)
        const modelId = buf.readUInt16LE(offset);
        offset += 2;
        result.modelId = modelId;
        result.modelIdShortName = getShellyBluShortName(modelId);
        result.modelIdLongName = getShellyBluLongName(modelId);
        break;
      }

      case 0x0a: {
        // MAC (6 bytes)
        const macBytes = buf.slice(offset, offset + 6);
        offset += 6;
        result.mac = macBytes.toString('hex').match(/.{2}/g)?.join(':');
        break;
      }

      default:
        // unknown block: skip its length if known, else break
        // here we just stop parsing
        offset = buf.length;
        break;
    }
  }

  return result;
}
