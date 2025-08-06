/**
 * Copyright 2025 Scott Bender (scott@scottbender.net)
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
 * limitations under the License.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { PGN } from '@canboat/ts-pgns'

export type Brand<K, T> = K & { __brand: T }

export type PgnNumber = Brand<number, 'PgnNumber'>

export type PGNDataMap = {
  [key: string]: PGN
}

export type DeviceInformation = {
  src: number
  info: { [key: PgnNumber]: any }
}

export type DeviceMap = {
  [key: number]: DeviceInformation
}
