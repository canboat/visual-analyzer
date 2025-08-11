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

import React, { useEffect, useState, useRef } from 'react'
import { Card, CardBody, Col, Row, Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap'
import { ReplaySubject, combineLatest } from 'rxjs'
// import * as pkg from '../../package.json'
import { PGNDataMap, PgnNumber, DeviceMap } from '../types'

type PGNDataEntry = {
  current: PGN
  history: PGN[]
}
import { DataList } from './DataList'
import { FilterPanel, Filter, FilterOptions } from './Filters'
import { SentencePanel } from './SentencePanel'
import { ConnectionManagerPanel } from './ConnectionManagerPanel'
import { SendTab } from './SendTab'
import TransformTab from './TransformTab'
import RecordingTab from './RecordingTab'
import { PgnBrowser } from './PgnBrowser'
import { RecordingProvider, useRecording } from '../contexts/RecordingContext'
import { FromPgn } from '@canboat/canboatjs'
import { Field, PGN, PGN_59904 } from '@canboat/ts-pgns'

interface LoginStatus {
  status: string
  readOnlyAccess: boolean
  authenticationRequired: boolean
  allowNewUserRegistration: boolean
  allowDeviceAccessRequests: boolean
  userLevel: string
  username: string
  securityWasEnabled: boolean
}

const LOCALSTORAGE_KEY = 'visual_analyzer_settings'
const ACTIVE_TAB_KEY = 'visual_analyzer_active_tab'

const saveFilterSettings = (filter: Filter, doFiltering: boolean, filterOptions: FilterOptions) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const settings = {
        filter,
        doFiltering,
        filterOptions,
        lastSaved: new Date().toISOString(),
      }
      window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(settings))
    }
  } catch (e) {
    console.warn('Failed to save filter settings to localStorage:', e)
  }
}

const saveActiveTab = (tabId: string) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ACTIVE_TAB_KEY, tabId)
    }
  } catch (e) {
    console.warn('Failed to save active tab to localStorage:', e)
  }
}

const loadActiveTab = (): string | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(ACTIVE_TAB_KEY)
    }
  } catch (e) {
    console.warn('Failed to load active tab from localStorage:', e)
  }
  return null
}

const loadFilterSettings = (): { filter: Filter; doFiltering: boolean; filterOptions: FilterOptions } | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(LOCALSTORAGE_KEY)
      if (saved) {
        const settings = JSON.parse(saved)
        return {
          filter: settings.filter || {},
          doFiltering: settings.doFiltering || false,
          filterOptions: {
            useCamelCase: true,
            showUnknownProprietaryPGNsOnSeparateLines: false,
            showPgn126208OnSeparateLines: false,
            maxHistorySize: 10,
            ...settings.filterOptions,
          },
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load filter settings from localStorage:', e)
  }
  return null
}

export const getRowKey = (pgn: PGN, options: FilterOptions | undefined): string => {
  let key = `${pgn.getDefinition().Id}-${pgn.pgn}-${pgn.src}- ${createFieldDataHash(pgn, true)}`
  if (
    (pgn.getDefinition().Fallback === true && options?.showUnknownProprietaryPGNsOnSeparateLines) ||
    (pgn.pgn === 126208 && options?.showPgn126208OnSeparateLines)
  ) {
    const fieldHash = createFieldDataHash(pgn)
    key = `${key}-${fieldHash}`
  }
  return key
}

// Simple hash function for creating consistent hashes from field data
const createFieldDataHash = (pgn: PGN, primaryKeys: boolean = false): string => {
  try {
    // Serialize the fields object to a stable string representation
    let serialized: string
    if (primaryKeys) {
      const pkeys = pgn
        .getDefinition()
        .Fields.filter((field: Field) => field.PartOfPrimaryKey === true)
        .map((field: Field) => field.Id)
      if (pkeys.length === 0) {
        return ''
      }
      serialized = JSON.stringify(pgn.fields, (key, value) => {
        // Handle root object (empty key) - always include it
        if (key === '') return value
        // Only include properties that are primary keys
        return pkeys.indexOf(key) !== -1 ? value : undefined
      })
    } else {
      serialized = JSON.stringify(pgn.fields, (key, value) =>
        key !== 'data' && key !== 'input' && key !== 'rawData' && key !== 'byteMapping' ? value : undefined,
      )
    }

    // Simple djb2 hash algorithm implementation
    let hash = 5381
    for (let i = 0; i < serialized.length; i++) {
      hash = (hash << 5) + hash + serialized.charCodeAt(i)
      hash = hash >>> 0 // Convert to 32-bit unsigned integer
    }

    return hash.toString(16) // Return as hexadecimal string
  } catch (error) {
    console.warn('Failed to create field data hash:', error)
    return 'hash-error'
  }
}

const infoPGNS: number[] = [60928, 126998, 126996]
const SEND_TAB_ID = 'send'
const ANALYZER_TAB_ID = 'analyzer'
const TRANSFORM_TAB_ID = 'transform'
const RECORDING_TAB_ID = 'recording'
const CONNECTIONS_TAB_ID = 'connections'
const PGN_BROWSER_TAB_ID = 'pgn-browser'

const AppPanelInner = (props: any) => {
  const { dispatch } = useRecording()
  // Check if we're in embedded mode (SignalK plugin) vs standalone mode
  const isEmbedded = typeof window !== 'undefined' && window.location.href.includes('/admin/')

  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = loadActiveTab()
    // Validate the saved tab - if in embedded mode, don't allow connections tab
    if (savedTab && (savedTab !== CONNECTIONS_TAB_ID || !isEmbedded)) {
      const validTabs = [ANALYZER_TAB_ID, SEND_TAB_ID, TRANSFORM_TAB_ID, RECORDING_TAB_ID, PGN_BROWSER_TAB_ID]
      if (!isEmbedded) {
        validTabs.push(CONNECTIONS_TAB_ID)
      }
      return validTabs.includes(savedTab) ? savedTab : ANALYZER_TAB_ID
    }
    return ANALYZER_TAB_ID
  })
  const [ws, setWs] = useState(null)
  const [data] = useState(new ReplaySubject<{ [key: string]: PGNDataEntry }>())
  const [list, setList] = useState<any>({})
  const [selectedPgn] = useState(new ReplaySubject<PGN>())
  const [doFiltering] = useState(new ReplaySubject<boolean>())
  const [filter] = useState(new ReplaySubject<Filter>())
  const [filterOptions] = useState(new ReplaySubject<FilterOptions>())
  const [availableSrcs] = useState(new ReplaySubject<number[]>())
  const [currentSrcs, setCurrentSrcs] = useState<number[]>([])
  const [deviceInfo] = useState(new ReplaySubject<DeviceMap>())
  const [currentInfo, setCurrentInfo] = useState<DeviceMap>({})
  const [connectionStatus, setConnectionStatus] = useState<{
    isConnected: boolean
    lastUpdate: string
    error?: string
  }>({
    isConnected: false,
    lastUpdate: new Date().toISOString(),
    error: undefined,
  })
  const [authStatus, setAuthStatus] = useState<{
    isAuthenticated: boolean
    isAdmin: boolean
    username?: string
    error?: string
    loading: boolean
  }>({
    isAuthenticated: false,
    isAdmin: false,
    loading: true,
  })
  const sentInfoReq: number[] = []
  const [outAvailable, setOutAvailable] = useState(false)
  const outAvailableRef = useRef(false)
  let sentReqAll = false

  // Handler for tab changes with persistence
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    saveActiveTab(tabId)
  }

  // Make debugging functions available globally
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // Also make authentication status available for debugging
      ;(window as any).getAuthStatus = () => authStatus
      ;(window as any).forceAuthCheck = () => {
        if (isEmbedded) {
          // Force re-check authentication
          setAuthStatus((prev) => ({ ...prev, loading: true }))
          // The useEffect will re-run the authentication check
        }
      }
    }
  }, [authStatus, isEmbedded])

  // Check authentication status when in embedded mode
  useEffect(() => {
    const checkAuthentication = async () => {
      if (!isEmbedded) {
        // In standalone mode, skip authentication check
        setAuthStatus({
          isAuthenticated: true,
          isAdmin: true,
          loading: false,
        })
        return
      }

      try {
        console.log('Checking authentication status...')
        const response = await fetch('/skServer/loginStatus')
        if (response.ok) {
          const loginStatus: LoginStatus = await response.json()
          console.log('Login status received:', loginStatus)

          const isAuthenticated = loginStatus.status === 'loggedIn'
          const isAdmin = loginStatus.userLevel === 'admin'

          setAuthStatus({
            isAuthenticated,
            isAdmin,
            username: loginStatus.username,
            loading: false,
            error: !isAuthenticated ? 'Not logged in' : !isAdmin ? 'Admin access required' : undefined,
          })

          if (!isAuthenticated) {
            console.warn('User is not logged in')
          } else if (!isAdmin) {
            console.warn('User does not have admin privileges')
          } else {
            console.log('User authenticated with admin privileges')
          }
        } else {
          throw new Error(`Authentication check failed: ${response.status}`)
        }
      } catch (error) {
        console.error('Failed to check authentication:', error)
        setAuthStatus({
          isAuthenticated: false,
          isAdmin: false,
          loading: false,
          error: `Authentication check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }
    }

    checkAuthentication()
  }, [isEmbedded])

  const [parser, setParser] = useState<FromPgn | null>(null)
  const parserRef = useRef<FromPgn | null>(null)
  const filterOptionsRef = useRef<FilterOptions | null>(null)

  // Initialize parser once
  useEffect(() => {
    if (!parser) {
      const initialParser = new FromPgn({
        returnNulls: true,
        checkForInvalidFields: true,
        useCamel: true, // Default value
        useCamelCompat: false,
        returnNonMatches: true,
        createPGNObjects: true,
        includeInputData: true,
        includeRawData: true,
        includeByteMapping: true,
      })

      initialParser.on('error', (pgn: any, error: any) => {
        console.error(`Error parsing ${pgn.pgn} ${error}`)
        console.error(error.stack)
      })

      setParser(initialParser)
      parserRef.current = initialParser
    }
  }, [parser])

  // Update parser options when filterOptions change
  useEffect(() => {
    const subscription = filterOptions.subscribe((options) => {
      if (parserRef.current) {
        // Update parser options instead of recreating the parser
        //parserRef.current.options.useCamel = options?.useCamelCase ?? true
        filterOptionsRef.current = options
      }
    })

    return () => subscription.unsubscribe()
  }, [filterOptions])

  const deleteAllKeys = (obj: any) => {
    Object.keys(obj).forEach((key) => {
      delete obj[key]
    })
  }

  // Load initial connection status from server
  useEffect(() => {
    const loadInitialStatus = async () => {
      try {
        const response = await fetch('/api/config')
        if (response.ok) {
          const config = await response.json()
          const initialStatus = {
            isConnected: config.connection?.isConnected || false,
            lastUpdate: config.connection?.lastUpdate || new Date().toISOString(),
            error: config.connection?.error || undefined, // Include any persisted error
          }
          setConnectionStatus(initialStatus)
        }
      } catch (error) {
        console.error('Failed to load initial connection status:', error)
        setConnectionStatus((prev) => ({
          ...prev,
          error: `Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
          lastUpdate: new Date().toISOString(),
        }))
      }
    }

    // Only load initial status in standalone mode (not embedded)
    if (!isEmbedded) {
      loadInitialStatus()
    }
  }, [isEmbedded])

  useEffect(() => {
    let webSocket: WebSocket | any = null
    let reconnectTimeout: NodeJS.Timeout | null = null

    const handleWebSocketMessage = (messageData: string) => {
      try {
        const parsed = JSON.parse(messageData)
        //console.log('Parsed WebSocket event:', parsed.event, parsed)

        if (isEmbedded && sentReqAll === false) {
          sentReqAll = true
          setOutAvailable(true)
          outAvailableRef.current = true
          requestMetaData(255)
        }

        // Handle connection status events
        if (parsed.event === 'nmea:connected') {
          // Clear all data when reconnecting
          console.log('NMEA connection established')

          setList((prev: any) => {
            data.next({})
            deleteAllKeys(prev)
            return prev
          })

          setCurrentSrcs((prev) => {
            availableSrcs.next([])
            prev.length = 0
            return prev
          })

          setCurrentInfo((prev) => {
            deviceInfo.next([])
            deleteAllKeys(prev)
            return prev
          })

          sentInfoReq.length = 0
          // Reset out available when reconnecting
          setOutAvailable(false)
          outAvailableRef.current = false

          setConnectionStatus({
            isConnected: true,
            lastUpdate: new Date().toISOString(),
            error: undefined, // Clear any previous errors
          })
          return
        }

        if (parsed.event === 'nmea:out-available') {
          console.log('NMEA output available - can now request metadata')
          setOutAvailable(true)
          outAvailableRef.current = true
          requestMetaData(255)
          return
        }

        if (parsed.event === 'nmea:disconnected') {
          console.log('NMEA connection lost')
          setOutAvailable(false)
          outAvailableRef.current = false
          setConnectionStatus((prev) => ({
            isConnected: false,
            lastUpdate: new Date().toISOString(),
            error: undefined, // Disconnection isn't necessarily an error
          }))
          return
        }

        // Handle error events that might affect connection status
        if (parsed.event === 'error') {
          console.error('NMEA connection error received via WebSocket:', parsed.error)
          setConnectionStatus((prev) => ({
            ...prev,
            isConnected: false,
            error: parsed.error || 'Unknown connection error',
            lastUpdate: new Date().toISOString(),
          }))
          return
        }

        // Handle recording events
        if (parsed.event === 'recording:started') {
          // Recording started event
          console.log('Recording started:', parsed.data)
          dispatch({ type: 'RECORDING_STARTED', payload: parsed.data })
          return
        }

        if (parsed.event === 'recording:stopped') {
          // Recording stopped event
          console.log('Recording stopped:', parsed.data)
          dispatch({ type: 'RECORDING_STOPPED', payload: parsed.data })
          return
        }

        if (parsed.event === 'recording:progress') {
          // Recording progress event
          console.log('Recording progress:', parsed.data)
          dispatch({ type: 'RECORDING_PROGRESS', payload: parsed.data })
          return
        }

        if (parsed.event === 'recording:error') {
          // Recording error event
          console.error('Recording error:', parsed.data)
          dispatch({ type: 'RECORDING_ERROR', payload: parsed.data })
          return
        }

        // Handle NMEA data events
        if (parsed.event !== 'canboatjs:rawoutput') {
          return
        }

        // Don't process data if parser is not ready yet
        if (!parserRef.current) {
          return
        }

        let pgn: PGN | undefined = undefined
        if (parserRef.current) {
          pgn = parserRef.current.parse(parsed.data)
        }
        if (pgn !== undefined) {
          //console.log('pgn', pgn)
          if (infoPGNS.indexOf(pgn!.pgn) === -1 || filterOptionsRef.current?.showInfoPgns) {
            setList((prev: any) => {
              const rowKey = getRowKey(pgn!, filterOptionsRef.current || undefined)
              const maxHistorySize = filterOptionsRef.current?.maxHistorySize ?? 10

              if (prev[rowKey]) {
                // Move current to history and update current
                let newHistory = [prev[rowKey].current, ...prev[rowKey].history]

                // Limit history size if maxHistorySize > 0, otherwise disable history
                if (maxHistorySize === 0) {
                  newHistory = []
                } else if (newHistory.length > maxHistorySize) {
                  newHistory = newHistory.slice(0, maxHistorySize)
                }

                prev[rowKey] = {
                  current: pgn,
                  history: newHistory,
                }
              } else {
                // New entry
                prev[rowKey] = {
                  current: pgn,
                  history: [],
                }
              }

              data.next({ ...prev })
              return prev
            })
          }

          if (currentSrcs.indexOf(pgn!.src!) === -1) {
            setCurrentSrcs((prev) => {
              prev.push(pgn!.src!)
              availableSrcs.next([...prev.sort((a, b) => a - b)])
              return prev
            })
          }

          if (infoPGNS.indexOf(pgn!.pgn) !== -1) {
            setCurrentInfo((prev) => {
              prev[pgn!.src!] = prev[pgn!.src!] || { src: pgn!.src!, info: {} }
              prev[pgn!.src!].info[pgn!.pgn! as PgnNumber] = pgn
              deviceInfo.next({ ...prev })
              return prev
            })
          }

          if (sentInfoReq.indexOf(pgn!.src!) === -1) {
            if (outAvailableRef.current) {
              sentInfoReq.push(pgn!.src!)
              // NMEA output is available, can request metadata immediately
              requestMetaData(pgn!.src!)
            }
            // If outAvailable is false, we simply don't request metadata yet
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    const connectWebSocket = () => {
      try {
        if (isEmbedded) {
          // Use SignalK admin UI WebSocket in embedded mode
          webSocket = props.adminUI.openWebsocket({
            subscribe: 'none',
            events: 'canboatjs:rawoutput',
          })

          // Set connection status for embedded mode - assume connected if websocket was created
          setConnectionStatus({
            isConnected: true,
            lastUpdate: new Date().toISOString(),
            error: undefined,
          })

          webSocket.onmessage = (x: any) => {
            handleWebSocketMessage(x.data)
          }

          // Add error handling for embedded WebSocket if possible
          if (webSocket.onerror) {
            webSocket.onerror = (error: any) => {
              console.error('Embedded WebSocket error:', error)
              setConnectionStatus((prev) => ({
                isConnected: false,
                lastUpdate: new Date().toISOString(),
                error: 'SignalK WebSocket connection error',
              }))
            }
          }

          if (webSocket.onclose) {
            webSocket.onclose = () => {
              console.log('Embedded WebSocket disconnected')
              setConnectionStatus((prev) => ({
                isConnected: false,
                lastUpdate: new Date().toISOString(),
                error: 'SignalK WebSocket connection closed',
              }))
            }
          }
        } else {
          // Use direct WebSocket connection in standalone mode
          webSocket = new WebSocket(`ws://${window.location.host}`)

          webSocket.onopen = () => {
            console.log('WebSocket connection established')
            setConnectionStatus({
              isConnected: true,
              lastUpdate: new Date().toISOString(),
              error: undefined,
            })
            // Subscribe to connection events
            webSocket?.send(
              JSON.stringify({
                type: 'subscribe',
                subscription: 'status',
              }),
            )
          }

          webSocket.onmessage = (event: MessageEvent) => {
            handleWebSocketMessage(event.data)
          }

          webSocket.onclose = () => {
            console.log('WebSocket disconnected')
            setConnectionStatus((prev) => ({
              isConnected: false,
              lastUpdate: new Date().toISOString(),
              error: 'WebSocket connection closed',
            }))
            // Attempt to reconnect after a delay in standalone mode
            if (reconnectTimeout) {
              clearTimeout(reconnectTimeout)
            }
            reconnectTimeout = setTimeout(connectWebSocket, 3000)
          }

          webSocket.onerror = (error: Event) => {
            console.error('WebSocket error:', error)
            setConnectionStatus((prev) => ({
              isConnected: false,
              lastUpdate: new Date().toISOString(),
              error: 'WebSocket connection error occurred',
            }))
          }
        }
      } catch (error) {
        console.error('Failed to create WebSocket:', error)
        setConnectionStatus((prev) => ({
          isConnected: false,
          lastUpdate: new Date().toISOString(),
          error: `Failed to create WebSocket connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }))
        if (!isEmbedded && reconnectTimeout) {
          clearTimeout(reconnectTimeout)
        }
        if (!isEmbedded) {
          reconnectTimeout = setTimeout(connectWebSocket, 3000)
        }
      }
    }

    connectWebSocket()
    setWs(webSocket)

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
      if (webSocket) {
        if (isEmbedded) {
          // SignalK WebSocket might have a different close method
          try {
            webSocket.close?.()
          } catch (e) {
            console.warn('Failed to close SignalK WebSocket:', e)
          }
        } else {
          webSocket.close()
        }
      }
    }
  }, [isEmbedded])

  // Initialize filter settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = loadFilterSettings()
    if (savedSettings) {
      filter.next(savedSettings.filter)
      doFiltering.next(savedSettings.doFiltering)
      filterOptions.next(savedSettings.filterOptions)
    } else {
      // Set default values if no saved settings
      filter.next({})
      doFiltering.next(false)
      filterOptions.next({
        //useCamelCase: true,
        showUnknownProprietaryPGNsOnSeparateLines: false,
        showPgn126208OnSeparateLines: false,
        showInfoPgns: false,
        maxHistorySize: 10,
      })
    }
  }, [])

  // Save filter settings to localStorage when they change
  useEffect(() => {
    const subscription = combineLatest([filter, doFiltering, filterOptions]).subscribe(
      ([filterValue, doFilteringValue, filterOptionsValue]) => {
        saveFilterSettings(filterValue, doFilteringValue, filterOptionsValue)
      },
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  /*
  const dinfo = useObservableState<DeviceMap>(deviceInfo, {})
  const selectedPgnValue = useObservableState<PGN | undefined>(selectedPgn, undefined)
  const info = selectedPgnValue ? dinfo[selectedPgnValue.src!] : { src: 0, info: {} }
*/

  // Show loading spinner while checking authentication in embedded mode
  if (isEmbedded && authStatus.loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p>Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Show error message if authentication failed in embedded mode
  if (isEmbedded && !authStatus.isAuthenticated) {
    return (
      <div className="container-fluid mt-4">
        <div className="alert alert-danger" role="alert">
          <h4 className="alert-heading">
            <i className="fas fa-exclamation-triangle"></i> Access Denied
          </h4>
          <p className="mb-0">
            {!authStatus.isAuthenticated
              ? 'You must be logged in to access the Visual Analyzer.'
              : 'Admin privileges are required to access the Visual Analyzer.'}
          </p>
          {authStatus.error && (
            <>
              <hr />
              <p className="mb-0 small text-muted">Error: {authStatus.error}</p>
            </>
          )}
          <hr />
          <p className="mb-0">
            Please {!authStatus.isAuthenticated ? 'log in' : 'contact your system administrator'} and try again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Connection Status Error Banner */}
      {!connectionStatus.isConnected && (
        <div className="alert alert-danger mb-3" role="alert">
          <div className="d-flex align-items-center">
            <i className="fas fa-exclamation-triangle me-2"></i>
            <div className="flex-grow-1">
              <strong>Connection Error</strong>
              {connectionStatus.error && (
                <div className="mt-1 small">
                  <strong>Details:</strong> {connectionStatus.error}
                </div>
              )}
              <div className="mt-1 small text-muted">
                Last update: {new Date(connectionStatus.lastUpdate).toLocaleString()}
              </div>
            </div>
            <div className="ms-2">
              <span className="badge bg-danger">Disconnected</span>
            </div>
          </div>
        </div>
      )}

      <div className="d-flex align-items-center justify-content-between mb-2">
        <Nav tabs>
          <NavItem>
            <NavLink
              className={activeTab === ANALYZER_TAB_ID ? 'active' : ''}
              onClick={() => handleTabChange(ANALYZER_TAB_ID)}
              style={{ cursor: 'pointer' }}
            >
              NMEA 2000 Analyzer
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink
              className={activeTab === SEND_TAB_ID ? 'active' : ''}
              onClick={() => handleTabChange(SEND_TAB_ID)}
              style={{ cursor: 'pointer' }}
            >
              Send
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink
              className={activeTab === TRANSFORM_TAB_ID ? 'active' : ''}
              onClick={() => handleTabChange(TRANSFORM_TAB_ID)}
              style={{ cursor: 'pointer' }}
            >
              Transform
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink
              className={activeTab === PGN_BROWSER_TAB_ID ? 'active' : ''}
              onClick={() => handleTabChange(PGN_BROWSER_TAB_ID)}
              style={{ cursor: 'pointer' }}
            >
              PGN Browser
            </NavLink>
          </NavItem>
          {!isEmbedded && (
            <NavItem>
              <NavLink
                className={activeTab === RECORDING_TAB_ID ? 'active' : ''}
                onClick={() => handleTabChange(RECORDING_TAB_ID)}
                style={{ cursor: 'pointer' }}
              >
                Recording
              </NavLink>
            </NavItem>
          )}
          {!isEmbedded && (
            <NavItem>
              <NavLink
                className={activeTab === CONNECTIONS_TAB_ID ? 'active' : ''}
                onClick={() => handleTabChange(CONNECTIONS_TAB_ID)}
                style={{ cursor: 'pointer' }}
              >
                Connections
              </NavLink>
            </NavItem>
          )}
        </Nav>

        {/* Small connection status indicator */}
        <div className="d-flex align-items-center">
          <span
            className={`badge ${connectionStatus.isConnected ? 'bg-success' : 'bg-danger'}`}
            title={connectionStatus.error || 'Connection status'}
          >
            {connectionStatus.isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      <TabContent activeTab={activeTab}>
        <TabPane tabId={ANALYZER_TAB_ID}>
          <Card>
            <CardBody>
              <div id="content">
                <Row>
                  <Col xs="24" md="12">
                    <FilterPanel
                      doFiltering={doFiltering}
                      filter={filter}
                      filterOptions={filterOptions}
                      availableSrcs={availableSrcs}
                      deviceInfo={deviceInfo}
                    />
                  </Col>
                </Row>
                <Row>
                  <Col xs="12" md="6">
                    <DataList
                      data={data}
                      filter={filter}
                      doFiltering={doFiltering}
                      filterOptions={filterOptions}
                      onRowClicked={(row: PGN) => {
                        selectedPgn.next(row)
                      }}
                    />
                  </Col>
                  <Col xs="12" md="6">
                    <SentencePanel selectedPgn={selectedPgn} info={deviceInfo}></SentencePanel>
                  </Col>
                </Row>
              </div>
            </CardBody>
          </Card>
        </TabPane>
        <TabPane tabId={SEND_TAB_ID}>
          <SendTab />
        </TabPane>
        <TabPane tabId={TRANSFORM_TAB_ID}>
          <TransformTab isEmbedded={isEmbedded} />
        </TabPane>
        <TabPane tabId={PGN_BROWSER_TAB_ID}>
          <PgnBrowser />
        </TabPane>
        {!isEmbedded && (
          <TabPane tabId={RECORDING_TAB_ID}>
            <RecordingTab />
          </TabPane>
        )}
        {!isEmbedded && (
          <TabPane tabId={CONNECTIONS_TAB_ID}>
            <ConnectionManagerPanel connectionStatus={connectionStatus} onStatusUpdate={setConnectionStatus} />
          </TabPane>
        )}
      </TabContent>
    </div>
  )
}

function requestMetaData(dst: number) {
  console.log(`Requesting metadata for source ${dst}`)
  infoPGNS.forEach((num) => {
    const pgn = new PGN_59904({ pgn: num }, dst)

    const body = { value: JSON.stringify(pgn), sendToN2K: true }
    fetch(`/skServer/inputTest`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
      .then((response) => response.json())
      .then((data) => {
        //console.log(`Metadata for PGN ${num} received:`, data)
        if (data.error) {
          console.error(`Error requesting metadata for PGN ${num}:`, data.error)
        }
      })
      .catch((error) => {
        console.error(`Error requesting metadata for PGN ${num}:`, error)
      })
  })
}

const AppPanel = (props: any) => {
  return (
    <RecordingProvider>
      <AppPanelInner {...props} />
    </RecordingProvider>
  )
}

export default AppPanel
