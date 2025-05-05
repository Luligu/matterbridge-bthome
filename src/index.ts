/**
 * This file contains the main entry point of the BTHome plugin.
 *
 * @file src\index.ts
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

import { Matterbridge, PlatformConfig } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';
import { Platform } from './platform.js';

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
export default function initializePlugin(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig): Platform {
  return new Platform(matterbridge, log, config);
}
