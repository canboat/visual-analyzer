#!/usr/bin/env node

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

import VisualAnalyzerServer from './server'

const server = new VisualAnalyzerServer()
server.start()

// Graceful shutdown handling
const shutdown = (signal: string): void => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`)
  server.stop()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// Handle uncaught exceptions
/*
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error)
  server.stop()
  process.exit(1)
})

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  server.stop()
  process.exit(1)
})
  */
