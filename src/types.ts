import { PGN } from '@canboat/ts-pgns'

export type Brand<K, T> = K & { __brand: T }

export type PgnNumber = Brand<number, 'PgnNumber'>


export type PGNDataMap = {
  [key: string]: PGN
}

export type DeviceInformation = {
  src: number,
  info: {[key: PgnNumber]: any}
}

export type DeviceMap = {
  [key: number]: DeviceInformation
}