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

import { EventEmitter } from 'events'

// Connection Profile Types
export interface ConnectionProfile {
  id?: string
  name: string
  type: 'serial' | 'network' | 'signalk' | 'socketcan' | 'file'

  // Serial connection specific
  serialPort?: string
  baudRate?: number
  deviceType?: 'Actisense' | 'Actisense ASCII' | 'iKonvert' | 'Yacht Devices RAW' | 'NavLink2' | 'SocketCAN'

  // Network connection specific
  networkHost?: string
  networkPort?: number
  networkProtocol?: 'tcp' | 'udp'

  // SignalK specific
  signalkUrl?: string
  signalkUsername?: string
  signalkPassword?: string

  // SocketCAN specific
  socketcanInterface?: string

  // File playback specific
  filePath?: string
  playbackSpeed?: number

  // Additional properties
  [key: string]: any
}

export interface ConnectionsConfig {
  activeConnection: string | null
  profiles: Record<string, ConnectionProfile>
}

export interface ServerConfig {
  port?: number
}

export interface Config {
  port: number
  connections: ConnectionsConfig
  server?: ServerConfig
}

export interface FileConfig {
  server?: ServerConfig
  connections?: ConnectionsConfig
}

// Connection State
export interface ConnectionState {
  isConnected: boolean
  lastUpdate: string
  error: string | null
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: string
  subscription?: string
  [key: string]: any
}

export interface BroadcastMessage {
  event: string
  data?: any
  timestamp: string
  error?: string
  auth?: any
}

// NMEA Provider Options
export interface NMEAProviderOptions extends ConnectionProfile {
  type: 'serial' | 'network' | 'signalk' | 'socketcan' | 'file'
}

// API Response Types
export interface ApiResponse {
  success: boolean
  message?: string
  error?: string
  messagesProcessed?: number
  transmitted?: number
  results?: any[]
}

export interface ConfigurationResponse {
  server: {
    port: number
  }
  connections: ConnectionsConfig
  connection: {
    isConnected: boolean
    error: string | null
    lastUpdate: string
    activeProfile: ConnectionProfile | null
  }
}

// SignalK Authentication Types
export interface SignalKLoginMessage {
  requestId: string
  login: {
    username: string
    password: string
  }
}

export interface SignalKLoginResponse {
  requestId: string
  statusCode: number
  login?: {
    token: string
  }
}

export interface SignalKMessage {
  event?: string
  data?: any
  requestId?: string
  statusCode?: number
  login?: {
    token: string
  }
}

// Express Request Extensions
export interface InputTestRequest {
  value: string | object
  sendToN2K?: boolean
}

// NMEA Provider Interface
export interface INMEAProvider extends EventEmitter {
  options: NMEAProviderOptions
  isConnected: boolean
  authToken: string | null

  connect(): Promise<void>
  disconnect(): void
  sendMessage?(data: any): void
  isConnectionActive?(): boolean
  getAuthStatus?(): any
}
