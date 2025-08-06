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

import { useEffect, useRef } from 'react'

interface WebSocketMessage {
  event: string
  data?: any
  timestamp?: string
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
  reconnect?: boolean
  reconnectInterval?: number
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const webSocketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isConnectedRef = useRef(false)

  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnect = true,
    reconnectInterval = 5000
  } = options

  const connectWebSocket = () => {
    try {
      // Clean up any existing connection
      if (webSocketRef.current) {
        webSocketRef.current.close()
      }

      // Create new WebSocket connection
      webSocketRef.current = new WebSocket(`ws://${window.location.host}`)

      webSocketRef.current.onopen = () => {
        console.log('WebSocket connected')
        isConnectedRef.current = true
        onConnect?.()

        // Send initial connection message
        webSocketRef.current?.send(
          JSON.stringify({
            event: 'subscribe',
            data: { type: 'all' }
          })
        )
      }

      webSocketRef.current.onmessage = (event: MessageEvent) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          onMessage?.(message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      webSocketRef.current.onclose = () => {
        console.log('WebSocket disconnected')
        isConnectedRef.current = false
        onDisconnect?.()

        // Attempt to reconnect if enabled
        if (reconnect) {
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, reconnectInterval)
        }
      }

      webSocketRef.current.onerror = (error: Event) => {
        console.error('WebSocket error:', error)
        onError?.(error)
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
    }
  }

  const sendMessage = (message: any) => {
    if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
      webSocketRef.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, cannot send message')
    }
  }

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (webSocketRef.current) {
      webSocketRef.current.close()
      webSocketRef.current = null
    }
    isConnectedRef.current = false
  }

  // Connect on mount
  useEffect(() => {
    connectWebSocket()

    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, [])

  return {
    sendMessage,
    disconnect,
    isConnected: isConnectedRef.current
  }
}
