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

import React, { createContext, useContext, useReducer, ReactNode } from 'react'

interface RecordingStatus {
  isRecording: boolean
  fileName?: string
  startTime?: string
  messageCount: number
  fileSize: number
  format?: string
  error?: string
}

interface RecordingContextState {
  status: RecordingStatus
  lastUpdate?: string
}

type RecordingAction =
  | { type: 'RECORDING_STARTED'; payload: RecordingStatus }
  | { type: 'RECORDING_STOPPED'; payload: RecordingStatus }
  | { type: 'RECORDING_PROGRESS'; payload: RecordingStatus }
  | { type: 'RECORDING_ERROR'; payload: { error: string } }
  | { type: 'SET_STATUS'; payload: RecordingStatus }

interface RecordingContextValue {
  state: RecordingContextState
  dispatch: React.Dispatch<RecordingAction>
}

const RecordingContext = createContext<RecordingContextValue | undefined>(undefined)

const recordingReducer = (state: RecordingContextState, action: RecordingAction): RecordingContextState => {
  console.log('RecordingReducer state:', state)
  switch (action.type) {
    case 'RECORDING_STARTED':
      return {
        ...state,
        status: {
          ...action.payload,
          isRecording: true,
        },
        lastUpdate: new Date().toISOString(),
      }

    case 'RECORDING_STOPPED':
      return {
        ...state,
        status: {
          ...action.payload,
          isRecording: false,
        },
        lastUpdate: new Date().toISOString(),
      }

    case 'RECORDING_PROGRESS':
      return {
        ...state,
        status: {
          ...state.status,
          ...action.payload,
        },
        lastUpdate: new Date().toISOString(),
      }

    case 'RECORDING_ERROR':
      return {
        ...state,
        status: {
          ...state.status,
          error: action.payload.error,
        },
        lastUpdate: new Date().toISOString(),
      }

    case 'SET_STATUS':
      return {
        ...state,
        status: action.payload,
        lastUpdate: new Date().toISOString(),
      }

    default:
      return state
  }
}

const initialState: RecordingContextState = {
  status: {
    isRecording: false,
    messageCount: 0,
    fileSize: 0,
  },
}

export const RecordingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(recordingReducer, initialState)

  return <RecordingContext.Provider value={{ state, dispatch }}>{children}</RecordingContext.Provider>
}

export const useRecording = (): RecordingContextValue => {
  const context = useContext(RecordingContext)
  if (context === undefined) {
    throw new Error('useRecording must be used within a RecordingProvider')
  }
  return context
}
