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

import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'events'
import {
  pgnToActisenseSerialFormat,
  pgnToActisenseN2KAsciiFormat,
  pgnToiKonvertSerialFormat,
  pgnToYdgwRawFormat,
  pgnToYdgwFullRawFormat,
  pgnToPCDIN,
  pgnToMXPGN,
  pgnToCandump1,
  pgnToCandump2,
  pgnToCandump3,
} from '@canboat/canboatjs'
import { PGN } from '@canboat/ts-pgns'

export interface RecordingStatus {
  isRecording: boolean
  fileName?: string
  startTime?: string
  messageCount: number
  fileSize: number
  format?: string
  error?: string
}

export interface RecordingFile {
  name: string
  size: number
  created: string
  messageCount: number
  format?: string
}

export interface RecordingOptions {
  fileName?: string
  format?: string
}

export class RecordingService extends EventEmitter {
  private isRecording: boolean = false
  private currentFileName: string | null = null
  private currentFormat: string = 'canboat-json'
  private messageCount: number = 0
  private startTime: Date | null = null
  private fileStream: fs.WriteStream | null = null
  private recordingsDir: string

  constructor(configPath: string) {
    super()

    // Create recordings directory
    this.recordingsDir = path.join(configPath, 'recordings')
    this.ensureRecordingsDirectory()
  }

  private ensureRecordingsDirectory(): void {
    try {
      if (!fs.existsSync(this.recordingsDir)) {
        fs.mkdirSync(this.recordingsDir, { recursive: true })
        console.log(`Created recordings directory: ${this.recordingsDir}`)
      }
    } catch (error) {
      console.error('Failed to create recordings directory:', error)
      throw new Error(
        `Failed to create recordings directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  public getStatus(): RecordingStatus {
    let fileSize = 0
    if (this.isRecording && this.currentFileName) {
      try {
        const filePath = path.join(this.recordingsDir, this.currentFileName)
        const stats = fs.statSync(filePath)
        fileSize = stats.size
      } catch (error) {
        console.warn('Failed to get file size:', error)
      }
    }

    return {
      isRecording: this.isRecording,
      fileName: this.currentFileName || undefined,
      startTime: this.startTime?.toISOString(),
      messageCount: this.messageCount,
      fileSize,
      format: this.currentFormat,
    }
  }

  public startRecording(options: RecordingOptions = {}): RecordingStatus {
    if (this.isRecording) {
      throw new Error('Recording is already in progress')
    }

    try {
      // Generate filename if not provided
      let fileName = options.fileName
      if (!fileName) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const format = options.format || 'passthrough'
        const extension = this.getFileExtension(format)
        fileName = `recording_${timestamp}.${extension}`
      }

      // Ensure filename has correct extension
      if (!fileName.includes('.')) {
        const extension = this.getFileExtension(options.format || 'passthrough')
        fileName += `.${extension}`
      }

      const filePath = path.join(this.recordingsDir, fileName)

      // Check if file already exists
      if (fs.existsSync(filePath)) {
        throw new Error(`File ${fileName} already exists`)
      }

      // Create file stream
      this.fileStream = fs.createWriteStream(filePath, { flags: 'w' })

      // Handle stream errors
      this.fileStream.on('error', (error) => {
        console.error('Recording file stream error:', error)
        this.stopRecording()
        this.emit('error', error)
      })

      // Set recording state
      this.isRecording = true
      this.currentFileName = fileName
      this.currentFormat = options.format || 'passthrough'
      this.messageCount = 0
      this.startTime = new Date()

      if (this.currentFormat === 'canboat-json-pretty') {
        this.fileStream.write('[\n') // Start JSON array for canboat-json format
      }

      console.log(`Started recording to ${fileName} in ${this.currentFormat} format`)
      this.emit('started', this.getStatus())

      return this.getStatus()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to start recording:', errorMessage)
      throw error
    }
  }

  public stopRecording(): RecordingStatus {
    if (!this.isRecording) {
      throw new Error('No recording in progress')
    }

    try {
      // Close file stream
      if (this.fileStream) {
        if (this.currentFormat === 'canboat-json-pretty') {
          this.fileStream.write('\n]\n') // End JSON array for canboat-json format
        }

        this.fileStream.end()
        this.fileStream = null
      }

      const status = this.getStatus()

      // Reset recording state
      this.isRecording = false
      const fileName = this.currentFileName
      this.currentFileName = null
      this.currentFormat = 'passthrough'
      this.messageCount = 0
      this.startTime = null

      console.log(`Stopped recording. Recorded ${status.messageCount} messages to ${fileName}`)
      this.emit('stopped', status)

      return {
        isRecording: false,
        messageCount: 0,
        fileSize: 0,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to stop recording:', errorMessage)
      throw error
    }
  }

  public recordMessage(raw: string | undefined, pgn: PGN | undefined): void {
    if (!this.isRecording || !this.fileStream) {
      return
    }

    try {
      let formattedMessage: string | undefined = undefined

      if (this.currentFormat === 'passthrough') {
        formattedMessage = raw
      } else if (pgn !== undefined) {
        switch (this.currentFormat) {
          case 'canboat-json':
            formattedMessage = JSON.stringify(pgn)
            break

          case 'canboat-json-pretty':
            formattedMessage = JSON.stringify(pgn, null, 2) + ','
            break

          case 'actisense': {
            const actisenseResult = pgnToActisenseSerialFormat(pgn)
            if (!actisenseResult) {
              console.error(`Failed to convert PGN ${pgn.pgn} to Actisense format`)
              return
            }
            formattedMessage = actisenseResult
            break
          }

          case 'actisense-n2k-ascii': {
            const n2kAsciiResult = pgnToActisenseN2KAsciiFormat(pgn)
            if (!n2kAsciiResult) {
              console.error(`Failed to convert PGN ${pgn.pgn} to Actisense N2K ASCII format`)
              return
            }
            formattedMessage = n2kAsciiResult
            break
          }

          case 'ikonvert': {
            const ikonvertResult = pgnToiKonvertSerialFormat(pgn)
            if (!ikonvertResult) {
              console.error(`Failed to convert PGN ${pgn.pgn} to iKonvert format`)
              return
            }
            formattedMessage = ikonvertResult
            break
          }

          case 'ydwg-raw': {
            const ydwgResult = pgnToYdgwRawFormat(pgn)
            if (!ydwgResult) {
              console.error(`Failed to convert PGN ${pgn.pgn} to YDWG RAW format`)
              return
            }
            formattedMessage = Array.isArray(ydwgResult) ? ydwgResult.join('\n') : ydwgResult
            break
          }

          case 'ydwg-full-raw': {
            const ydwgFullResult = pgnToYdgwFullRawFormat(pgn)
            if (!ydwgFullResult) {
              console.error(`Failed to convert PGN ${pgn.pgn} to YDWG Full RAW format`)
              return
            }
            formattedMessage = Array.isArray(ydwgFullResult) ? ydwgFullResult.join('\n') : ydwgFullResult
            break
          }

          case 'pcdin': {
            const pcdinResult = pgnToPCDIN(pgn)
            if (!pcdinResult) {
              console.error(`Failed to convert PGN ${pgn.pgn} to PCDIN format`)
              return
            }
            formattedMessage = pcdinResult
            break
          }

          case 'mxpgn': {
            const mxpgnResult = pgnToMXPGN(pgn)
            if (!mxpgnResult) {
              console.error(`Failed to convert PGN ${pgn.pgn} to MXPGN format`)
              return
            }
            formattedMessage = mxpgnResult
            break
          }

          case 'candump1': {
            const candump1Result = pgnToCandump1(pgn)
            if (!candump1Result) {
              console.error(`Failed to convert PGN ${pgn.pgn} to candump1 format`)
              return
            }
            formattedMessage = Array.isArray(candump1Result) ? candump1Result.join('\n') : candump1Result
            break
          }

          case 'candump2': {
            const candump2Result = pgnToCandump2(pgn)
            if (!candump2Result) {
              console.error(`Failed to convert PGN ${pgn.pgn} to candump2 format`)
              return
            }
            formattedMessage = Array.isArray(candump2Result) ? candump2Result.join('\n') : candump2Result
            break
          }

          case 'candump3': {
            const candump3Result = pgnToCandump3(pgn)
            if (!candump3Result) {
              console.error(`Failed to convert PGN ${pgn.pgn} to candump3 format`)
              return
            }
            formattedMessage = Array.isArray(candump3Result) ? candump3Result.join('\n') : candump3Result
            break
          }
        }
      }

      if (formattedMessage !== undefined) {
        // Write message to file
        this.fileStream.write(formattedMessage + '\n')
        this.messageCount++

        // Emit progress update every 100 messages
        if (this.messageCount % 10 === 0) {
          this.emit('progress', this.getStatus())
        }
      }
    } catch (error) {
      console.error('Failed to record message:', error)
      this.emit('error', error)
    }
  }

  public getRecordedFiles(): RecordingFile[] {
    try {
      if (!fs.existsSync(this.recordingsDir)) {
        return []
      }

      const files = fs.readdirSync(this.recordingsDir)
      const recordingFiles: RecordingFile[] = []

      for (const file of files) {
        const filePath = path.join(this.recordingsDir, file)

        try {
          const stats = fs.statSync(filePath)
          if (stats.isFile()) {
            // Try to determine format from file extension or content
            const format = this.guessFileFormat(file)

            // Count messages (rough estimate based on file size and format)
            const messageCount = this.estimateMessageCount(filePath)

            recordingFiles.push({
              name: file,
              size: stats.size,
              created: stats.birthtime.toISOString(),
              messageCount,
              format,
            })
          }
        } catch (error) {
          console.warn(`Failed to get stats for file ${file}:`, error)
        }
      }

      // Sort by creation date (newest first)
      return recordingFiles.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
    } catch (error) {
      console.error('Failed to get recorded files:', error)
      return []
    }
  }

  public deleteRecordedFile(fileName: string): void {
    const filePath = path.join(this.recordingsDir, fileName)

    // Prevent path traversal attacks
    if (!filePath.startsWith(this.recordingsDir)) {
      throw new Error('Invalid file path')
    }

    if (!fs.existsSync(filePath)) {
      throw new Error('File not found')
    }

    try {
      fs.unlinkSync(filePath)
      console.log(`Deleted recording file: ${fileName}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Failed to delete file ${fileName}:`, errorMessage)
      throw error
    }
  }

  public getRecordedFilePath(fileName: string): string {
    const filePath = path.join(this.recordingsDir, fileName)

    // Prevent path traversal attacks
    if (!filePath.startsWith(this.recordingsDir)) {
      throw new Error('Invalid file path')
    }

    if (!fs.existsSync(filePath)) {
      throw new Error('File not found')
    }

    return filePath
  }

  private getFileExtension(format: string): string {
    switch (format) {
      case 'canboat-json':
        return 'json'
      case 'actisense':
      case 'actisense-n2k-ascii':
        return 'n2k'
      case 'ikonvert':
        return 'iko'
      case 'ydwg-full-raw':
      case 'ydwg-raw':
        return 'ydwg'
      case 'pcdin':
        return 'pcd'
      case 'mxpgn':
        return 'mxp'
      case 'candump1':
      case 'candump2':
      case 'candump3':
        return 'log'
      default:
        return 'txt'
    }
  }

  private guessFileFormat(fileName: string): string {
    const extension = path.extname(fileName).toLowerCase().substring(1)

    switch (extension) {
      case 'json':
        return 'canboat-json'
      case 'n2k':
        return 'actisense'
      case 'iko':
        return 'ikonvert'
      case 'ydwg':
        return 'ydwg-raw'
      case 'pcd':
        return 'pcdin'
      case 'mxp':
        return 'mxpgn'
      case 'log':
        return 'candump1'
      default:
        return 'unknown'
    }
  }

  private estimateMessageCount(filePath: string): number {
    try {
      const stats = fs.statSync(filePath)
      const fileSize = stats.size

      if (fileSize === 0) return 0

      // Read a small sample to estimate average line length
      const sampleSize = Math.min(4096, fileSize)
      const buffer = Buffer.alloc(sampleSize)
      const fd = fs.openSync(filePath, 'r')
      fs.readSync(fd, buffer, 0, sampleSize, 0)
      fs.closeSync(fd)

      const sample = buffer.toString('utf8')
      const lines = sample.split('\n').filter((line) => line.trim().length > 0)

      if (lines.length === 0) return 0

      const avgLineLength = sample.length / lines.length
      const estimatedLines = Math.floor(fileSize / avgLineLength)

      return estimatedLines
    } catch (error) {
      console.warn('Failed to estimate message count:', error)
      return 0
    }
  }
}
