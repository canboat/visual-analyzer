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

import { ConnectionProfile } from './types'
import TcpStream from './streams/tcp'
import UdpStream from './streams/udp'
import SerialStream from './streams/serialport'
import Liner from './streams/liner'
import NullStream from './streams/nullStream'
import {
  PGN,
  PGN_126996,
  PGN_60928,
  DeviceFunction,
  DeviceClass,
  IndustryCode,
  CertificationLevel,
  YesNo,
} from '@canboat/ts-pgns'
import { canbus, Ydwg02, iKonvert, serial as ActisenseStream, W2k01 } from '@canboat/canboatjs'
import pkg from '../package.json'

const outEvent = 'n2k-device-out'

type Listener = {
  object: any
  event: string
  listener: any
}

class CanDevice {
  private options: ConnectionProfile
  private app: any
  private stream: any
  private netStream: TcpStream | UdpStream | null = null
  private serialStream: any = null
  private listeners: Listener[] = []

  constructor(app: any, options: ConnectionProfile) {
    //super()
    this.options = options
    this.app = {
      ...app,
      on: (event: string, callback: (...args: any[]) => void) => {
        this.addListener(app, event, callback)
        app.on(event, callback)
      },
    }
  }

  public async start() {
    return new Promise((resolve, reject) => {
      try {
        const n2kOptions = this.getN2kDeviceOptions(this.app)

        if (this.options.type === 'socketcan') {
          this.stream = canbus({
            ...n2kOptions,
            providerId: this.options.deviceType,
            canDevice: this.options.socketcanInterface,
          })
          this.stream.pipe(new NullStream())
          this.app.emit('connected')
        } else if (this.options.type === 'network') {
          const netOptions = {
            app: this.app,
            providerId: this.options.deviceType,
            port: this.options.networkPort!,
            host: this.options.networkHost!,
            outEvent,
          }
          if (this.options.networkProtocol === 'tcp') {
            this.netStream = new TcpStream(netOptions)
          } else {
            this.netStream = new UdpStream(netOptions)
          }

          if (this.options.deviceType === 'Yacht Devices RAW') {
            this.stream = Ydwg02(
              { ...n2kOptions, providerId: this.options.deviceType, createDevice: true, ydgwOutEvent: outEvent },
              'net',
            )
          } else if (this.options.deviceType === 'iKonvert') {
            this.stream = iKonvert({
              app: this.app,
              providerId: this.options.deviceType,
              tcp: true,
              outEvent,
            })
          } else if (this.options.deviceType === 'Actisense ASCII') {
            this.stream = W2k01(
              {
                app: this.app,
                providerId: this.options.deviceType,
              },
              'ascii',
              outEvent,
            )
          }

          const liner = new Liner({}) as any
          this.netStream.pipe(liner)
          liner.pipe(this.stream)
          this.stream.pipe(new NullStream())
        } else if (this.options.type === 'serial') {
          if (this.options.deviceType === 'Actisense') {
            this.stream = new (ActisenseStream as any)({
              providerId: this.options.deviceType,
              device: this.options.serialPort!,
              baudrate: this.options.baudRate!,
              reconnect: false,
              app: this.app,
            })
            this.app.emit('connected')
          } else if (this.options.deviceType === 'Yacht Devices RAW') {
            this.serialStream = new SerialStream({
              app: this.app,
              providerId: this.options.deviceType,
              device: this.options.serialPort!,
              baudrate: this.options.baudRate || 38400,
              reconnect: false,
              toStdout: outEvent,
            })

            this.stream = Ydwg02({ ...n2kOptions, createDevice: true, ydgwOutEvent: outEvent }, 'usb')
          } else if (this.options.deviceType === 'iKonvert') {
            this.serialStream = new SerialStream({
              app: this.app,
              providerId: this.options.deviceType,
              device: this.options.serialPort!,
              baudrate: this.options.baudRate || 230400,
              reconnect: false,
              toStdout: 'ikonvertOut',
            })

            this.stream = iKonvert({
              app: this.app,
              providerId: this.options.deviceType,
              tcp: false,
            })

            this.serialStream.pipe(this.stream)
          }
          this.stream.pipe(new NullStream())
        }
        resolve(true)
      } catch (error) {
        reject(error)
      }
    })
  }

  send(pgn: PGN) {
    if (this.stream) {
      this.stream.sendPGN(pgn)
    }
  }

  end() {
    this.removeAllListeners()
    if (this.netStream) {
      this.netStream.end()
      this.netStream = null
    }
    if (this.serialStream) {
      this.serialStream.end()
      this.serialStream = null
    }
    if (this.stream) {
      this.stream.end()
      this.stream = null
    }
  }

  private addListener(object: any, event: string, listener: (data: any) => void) {
    this.listeners.push({ object, event, listener })
  }

  private removeAllListeners() {
    this.listeners.forEach(({ object, event, listener }) => {
      object.removeListener(event, listener)
    })
    this.listeners = []
  }

  private getN2kDeviceOptions(app: any) {
    return {
      app,
      providerId: this.options.deviceType,
      preferredAddress: this.options.sourceAddress || 11,
      disableDefaultTransmitPGNs: true,
      addressClaim: new PGN_60928({
        manufacturerCode: 999,
        deviceFunction: DeviceFunction.Diagnostic,
        deviceClass: DeviceClass.SystemTools,
        deviceInstanceLower: 0,
        deviceInstanceUpper: 0,
        systemInstance: 0,
        industryGroup: IndustryCode.Marine,
        arbitraryAddressCapable: YesNo.Yes,
      }),
      productInfo: new PGN_126996({
        nmea2000Version: 2100,
        productCode: 100,
        modelId: 'N2K Visual Analyzer',
        softwareVersionCode: pkg.version,
        modelVersion: pkg.version,
        modelSerialCode: '01',
        certificationLevel: CertificationLevel.LevelA,
        loadEquivalency: 1,
      }),
    }
  }
}

export default CanDevice
