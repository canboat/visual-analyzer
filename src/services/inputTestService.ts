/**
 * Centralized service for SignalK server input testing
 * Handles all POST requests to /skServer/inputTest endpoint
 */

export interface ServerRequest {
  type: 'send-n2k' | 'n2k-signalk'
  values: (string | object)[]
}

const isEmbedded = typeof window !== 'undefined' && window.location.href.includes('/admin/')

const prefix = isEmbedded ? '/plugins/canboat-visual-analyzer' : ''

const requestEndpoints = {
  'send-n2k': `${prefix}/api/send-n2k`,
  'n2k-signalk': `${prefix}/api/transform/signalk`,
}

export interface ServerResponse {
  error?: string
  [key: string]: any
}

export interface SendOptions {
  timeout?: number
  retries?: number
  onProgress?: (message: string) => void
}

/**
 * Service for communicating with SignalK server's input test endpoint
 */
class Server {
  private readonly defaultTimeout = 10000 // 10 seconds
  private readonly defaultRetries = 0

  /**
   * Send a message to the SignalK server input test endpoint
   * @param data The message data to send
   * @param options Optional configuration for the request
   * @returns Promise that resolves to the server response
   */
  async send(data: ServerRequest, options: SendOptions = {}): Promise<ServerResponse> {
    const { timeout = this.defaultTimeout, retries = this.defaultRetries, onProgress } = options

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          onProgress?.(`Retrying... (attempt ${attempt + 1}/${retries + 1})`)
          // Add exponential backoff delay for retries
          await this.delay(Math.min(1000 * Math.pow(2, attempt - 1), 5000))
        }

        onProgress?.(`Sending message to SignalK server...`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        try {
          const response = await fetch(requestEndpoints[data.type], {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            const error = await response.json()
            throw new Error(`Send failed (${response.status}): ${error.error || 'Unknown error'}`)
          }

          const result = await response.json()

          if (result.error) {
            throw new Error(result.error)
          }

          onProgress?.(`Message sent successfully`)
          return result
        } catch (error) {
          clearTimeout(timeoutId)
          throw error
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error occurred')

        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new Error(`Request timed out after ${timeout}ms`)
        }

        // Log the attempt if we're retrying
        if (attempt < retries) {
          console.warn(`Send attempt ${attempt + 1} failed:`, lastError.message)
        }
      }
    }

    // If we've exhausted all retries, throw the last error
    throw lastError || new Error('Failed to send message after all retries')
  }

  /**
   * Utility function to create a delay
   * @param ms Milliseconds to delay
   * @returns Promise that resolves after the delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const server = new Server()

export default server
