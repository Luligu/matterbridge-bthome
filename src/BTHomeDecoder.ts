/**
 * This file contains the BTHome decoder.
 *
 * @file src\BTHomeDecoder.ts
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

import { BTHOME_SPEC } from './BTHomeSpec.js';

/**
 * DecodedBTHome interface
 *
 * @property {number} version - BTHome version. Currently only BTHome version 1 or 2 are allowed, where 2 is the latest version (bit 5-7 = 010).
 * @property {boolean} encrypted - The Encryption flag is telling the receiver whether the device is sending non-encrypted data (bit 0 = 0) or encrypted data (bit 0 = 1)
 * @property {boolean} trigger - The trigger based device flag is telling the receiver that it should expect that the device is sending BLE advertisements
 * at a regular interval (bit 2 = 0) or at an irregular interval (bit 2 = 1), e.g. only when someone pushes a button.
 * @property {object} readings - Sensor readings
 * @property {string[]} unknown - Unknown fields
 */
export interface DecodedBTHome {
  version: number;
  encrypted: boolean;
  trigger: boolean;
  readings: Record<string, boolean | number | string | object>;
  unknown: string[];
}

/**
 * Decode a BTHome v2 service-data Buffer into a JS object.
 *
 * @param {Buffer} buf – payload bytes (excluding the 0x16+UUID header)
 * @returns {DecodedBTHome} Decoded BTHome data
 */
export function decodeBTHome(buf: Buffer): DecodedBTHome {
  const info = buf.readUInt8(0);
  const version = (info >> 5) & 0b00000111;
  const encrypted = Boolean(info & 0b00000001);
  const trigger = Boolean(info & 0b00000100); // The trigger based device flag is telling the receiver that it should expect that the device is sending BLE advertisements at a regular interval (bit 2 = 0) or at an irregular interval (bit 2 = 1), e.g. only when someone pushes a button.

  const readings: Record<string, boolean | number | string | object> = {};
  const unknown: string[] = [];
  let offset = 1;
  const ids: number[] = [];

  while (offset < buf.length) {
    const id = buf.readUInt8(offset++);
    ids.push(id);
    const spec = BTHOME_SPEC[id as keyof typeof BTHOME_SPEC];

    if (!spec) {
      // First unknown: dump remainder and stop cause we don't know how to handle the length of the unknown field
      unknown.push(`0x${id.toString(16)} → 0x${buf.slice(offset - 1).toString('hex')}`);
      break;
    }

    let value: boolean | number | string | object;

    if (spec.parser) {
      // custom‐parser always takes precedence
      value = spec.parser(buf, offset);

      // advance by either spec.bytes or (1 + length prefix) for text/raw
      if (spec.bytes != null) {
        offset += spec.bytes;
      } else {
        // length‐prefixed: first byte is the length
        const len = buf.readUInt8(offset);
        offset += 1 + len;
      }
    } else {
      // numeric field: bytes must be a number
      if (spec.bytes == null) {
        throw new Error(`BTHome spec for ${spec.name} is missing 'bytes'`);
      }
      const bytes = spec.bytes;
      const factor = spec.factor ?? 1;
      const raw = spec.signed ? buf.readIntLE(offset, bytes) : buf.readUIntLE(offset, bytes);

      // value = raw * factor;
      // Keep the decimal precision based on factor
      value = parseFloat((raw * factor).toFixed(Math.log10(1 / factor)));
      offset += bytes;
    }

    const count = ids.filter((existingId) => existingId === id).length;
    let name = spec.name;
    if (count > 1) {
      // If the same ID appears multiple times, append the count to the name
      name = spec.name + `:${count}`;
      if (spec.name in readings) {
        // If the same name appears multiple times, append the count to the name
        readings[spec.name + ':1'] = readings[spec.name];
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete readings[spec.name];
      }
    }
    readings[name] = value;
  }

  return { version, encrypted, trigger, readings, unknown };
}
