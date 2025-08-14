/* eslint-disable @typescript-eslint/no-explicit-any */

import { ServerAPI, Plugin, Delta, Path } from '@signalk/server-api'

const PLUGIN_ID = 'canboat-visual-analyzer'
const PLUGIN_NAME = 'Canboat Visual Analyzer'

module.exports = function (app: ServerAPI) {
  let onStop: any[] = []
  //let dbusSetValue: any

  const plugin: Plugin = {
    id: PLUGIN_ID,
    name: PLUGIN_NAME,
    description: 'Canboat Visual Analyzer',

    schema: () => {
      return {
        title: PLUGIN_NAME,
        type: 'object',
        properties: {
          installType: {
            type: 'string',
            title: 'How to connect to Venus D-Bus',
            enum: ['mqtt', 'mqtts', 'local', 'remote', 'vrm'],
            enumNames: [
              'Connect to remote Venus installation via MQTT (Plain text)',
              'Connect to remote Venus installation via MQTT (SSL)',
              'Connect to localhost via dbus (signalk-server is running on a Venus device)',
              'Connect to remote Venus installation via dbus',
              'Connect to remote Venus installation via VRM'
            ],
            default: 'mqtt'
          }
        }
      }
    },

    stop: () => {
      onStop.forEach((f) => f())
      onStop = []
    },

    start: (options: any) => {
    }
  }

  return plugin
}
