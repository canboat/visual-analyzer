import React, { useEffect, useState } from 'react'
import { Card, CardBody, Col, Row, Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap'
import { ReplaySubject, combineLatest } from 'rxjs'
// import * as pkg from '../../package.json'
import { PGNDataMap, PgnNumber, DeviceMap } from '../types'
import { DataList } from './DataList'
import { FilterPanel, Filter } from './Filters'
import { SentencePanel } from './SentencePanel'
import { ConnectionManagerPanel } from './ConnectionManagerPanel'
import { FromPgn } from '@canboat/canboatjs'
import { PGN, PGN_59904 } from '@canboat/ts-pgns'

const LOCALSTORAGE_KEY = 'visual_analyzer_settings'

const saveFilterSettings = (filter: Filter, doFiltering: boolean) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const settings = {
        filter,
        doFiltering,
        lastSaved: new Date().toISOString(),
      }
      window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(settings))
    }
  } catch (e) {
    console.warn('Failed to save filter settings to localStorage:', e)
  }
}

const loadFilterSettings = (): { filter: Filter; doFiltering: boolean } | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(LOCALSTORAGE_KEY)
      if (saved) {
        const settings = JSON.parse(saved)
        return {
          filter: settings.filter || {},
          doFiltering: settings.doFiltering || false,
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load filter settings from localStorage:', e)
  }
  return null
}

export const getRowKey = (pgn: PGN): string => {
  let key = `${pgn.getDefinition().Id}-${pgn.pgn}-${pgn.src}`
  if (pgn.getDefinition().Fallback === true || pgn.pgn === 126208) {
    const fieldHash = createFieldDataHash(pgn.fields)
    key = `${key}-${fieldHash}`
  }
  return key
}

// Simple hash function for creating consistent hashes from field data
const createFieldDataHash = (fields: any): string => {
  try {
    // Serialize the fields object to a stable string representation
    const serialized = JSON.stringify(fields, (key, value) => (key !== 'data' ? value : undefined))

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
const CONNECTIONS_TAB_ID = 'connections'

const AppPanel = (props: any) => {
  const [activeTab, setActiveTab] = useState(ANALYZER_TAB_ID)
  const [ws, setWs] = useState(null)
  const [data] = useState(new ReplaySubject<PGNDataMap>())
  const [list, setList] = useState<any>({})
  const [selectedPgn] = useState(new ReplaySubject<PGN>())
  const [doFiltering] = useState(new ReplaySubject<boolean>())
  const [filter] = useState(new ReplaySubject<Filter>())
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
  const sentInfoReq: number[] = []

  // Debug function to test error display
  const testErrorDisplay = () => {
    console.log('Testing error display...')
    setConnectionStatus({
      isConnected: false,
      lastUpdate: new Date().toISOString(),
      error: 'Test connection error: Connection refused to localhost:60002 (ECONNREFUSED)',
    })
  }

  // Make it available globally for testing
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).testErrorDisplay = testErrorDisplay
    }
  }, [])

  // Check if we're in embedded mode (SignalK plugin) vs standalone mode
  const isEmbedded = typeof window !== 'undefined' && window.location.href.includes('/admin/')

  const parser = new FromPgn({
    returnNulls: true,
    checkForInvalidFields: true,
    useCamel: true,
    useCamelCompat: false,
    returnNonMatches: true,
    createPGNObjects: true,
    includeInputData: true,
  })

  parser.on('error', (pgn: any, error: any) => {
    console.error(`Error parsing ${pgn.pgn} ${error}`)
    console.error(error.stack)
  })

  // Load initial connection status from server
  useEffect(() => {
    const loadInitialStatus = async () => {
      try {
        console.log('Loading initial connection status...')
        const response = await fetch('/api/config')
        if (response.ok) {
          const config = await response.json()
          console.log('Received config:', config)
          const initialStatus = {
            isConnected: config.connection?.isConnected || false,
            lastUpdate: config.connection?.lastUpdate || new Date().toISOString(),
            error: config.connection?.error || undefined, // Include any persisted error
          }
          console.log('Initial connection status loaded:', initialStatus)
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
    // Create a dedicated WebSocket connection for monitoring connection status and errors
    let statusWebSocket: WebSocket | null = null

    const connectStatusWebSocket = () => {
      try {
        statusWebSocket = new WebSocket(`ws://${window.location.host}`)

        statusWebSocket.onopen = () => {
          console.log('Status WebSocket connected')
          // Subscribe to connection events
          statusWebSocket?.send(
            JSON.stringify({
              type: 'subscribe',
              subscription: 'status',
            }),
          )
        }

        statusWebSocket.onmessage = (event) => {
          //console.log('=== STATUS WEBSOCKET MESSAGE ===')
          //console.log('Raw message:', event.data)
          try {
            const data = JSON.parse(event.data)
            //console.log('Parsed data:', data)
            //console.log('Event type:', data.event)

            if (data.event === 'nmea:connected') {
              setConnectionStatus((prev) => {
                //console.log('>>> STATUS WS: Processing nmea:connected event')
                const newStatus = {
                  ...prev,
                  isConnected: true,
                  lastUpdate: new Date().toISOString(),
                  error: undefined,
                }
                //console.log('>>> STATUS WS: Setting connected status:', newStatus)
                return newStatus
              })
            } else if (data.event === 'nmea:disconnected') {
              //console.log('>>> STATUS WS: Processing nmea:disconnected event')
              setConnectionStatus((prev) => {
                const newStatus = {
                  ...prev,
                  isConnected: false,
                  lastUpdate: new Date().toISOString(),
                }
                console.log('>>> STATUS WS: Setting disconnected status:', newStatus)
                return newStatus
              })
            } else if (data.event === 'error') {
              console.log('>>> STATUS WS: Processing ERROR event:', data.error)
              console.log('>>> STATUS WS: Current connectionStatus before update:', connectionStatus)
              setConnectionStatus((prev) => {
                const newStatus = {
                  ...prev,
                  isConnected: false,
                  error: data.error,
                  lastUpdate: new Date().toISOString(),
                }
                console.log('>>> STATUS WS: Setting ERROR status:', newStatus)
                return newStatus
              })
            } else {
              //console.log('>>> STATUS WS: Ignoring event type:', data.event)
            }
          } catch (error) {
            console.error('Error parsing status WebSocket message:', error)
          }
        }

        statusWebSocket.onclose = () => {
          console.log('Status WebSocket disconnected')
          // Attempt to reconnect after a delay
          setTimeout(connectStatusWebSocket, 3000)
        }

        statusWebSocket.onerror = (error) => {
          console.error('Status WebSocket error:', error)
        }
      } catch (error) {
        console.error('Failed to create status WebSocket:', error)
        setTimeout(connectStatusWebSocket, 3000)
      }
    }

    // Only create status WebSocket in standalone mode
    if (!isEmbedded) {
      connectStatusWebSocket()
    }

    return () => {
      if (statusWebSocket) {
        statusWebSocket.close()
      }
    }
  }, [isEmbedded])

  useEffect(() => {
    const ws = props.adminUI.openWebsocket({
      subscribe: 'none',
      events: 'canboatjs:rawoutput',
    })

    ws.onmessage = (x: any) => {
      // console.log('Received WebSocket message:', x.data)

      const parsed = JSON.parse(x.data)
      //console.log('Parsed WebSocket event:', parsed.event, parsed)

      // Handle connection status events (keep as backup)
      if (parsed.event === 'nmea:connected') {
        //console.log('NMEA connection established')
        setConnectionStatus({
          isConnected: true,
          lastUpdate: new Date().toISOString(),
          error: undefined, // Clear any previous errors
        })
        return
      }

      if (parsed.event === 'nmea:disconnected') {
        console.log('NMEA connection lost')
        setConnectionStatus({
          isConnected: false,
          lastUpdate: new Date().toISOString(),
          error: undefined, // Disconnection isn't necessarily an error
        })
        return
      }

      // Also handle error events that might affect connection status
      if (parsed.event === 'error') {
        console.error('NMEA connection error received via WebSocket:', parsed.error)
        setConnectionStatus((prev) => ({
          ...prev,
          error: parsed.error || 'Unknown connection error',
          lastUpdate: new Date().toISOString(),
        }))
        return
      }

      // Handle NMEA data events
      if (parsed.event !== 'canboatjs:rawoutput') {
        return
      }
      let pgn: PGN | undefined = undefined
      pgn = parser.parse(parsed.data)
      if (pgn !== undefined) {
        //console.log('pgn', pgn)
        if (infoPGNS.indexOf(pgn!.pgn) === -1) {
          setList((prev: any) => {
            prev[getRowKey(pgn!)] = pgn
            data.next({ ...prev })
            return prev
          })
        }

        if (!currentSrcs.includes(pgn.src!)) {
          setCurrentSrcs((prev) => {
            prev.push(pgn!.src!)
            availableSrcs.next([...prev.sort((a, b) => a - b)])
            return prev
          })
        }

        if (infoPGNS.indexOf(pgn!.pgn) !== -1) {
          setCurrentInfo((prev) => {
            prev[pgn!.src!] = prev[pgn!.src!] || { src: pgn!.src!, info: {} }
            prev[pgn!.src!].info[pgn!.pgn! as PgnNumber] = {
              description: pgn!.description,
              ...pgn!.fields,
            }
            deviceInfo.next({ ...prev })
            return prev
          })
        }

        if (sentInfoReq.indexOf(pgn!.src!) === -1) {
          sentInfoReq.push(pgn!.src!)
          requestMetaData(pgn!.src!)
        }
      }
    }
    setWs(ws)
  }, [])

  // Initialize filter settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = loadFilterSettings()
    if (savedSettings) {
      filter.next(savedSettings.filter)
      doFiltering.next(savedSettings.doFiltering)
    } else {
      // Set default values if no saved settings
      filter.next({})
      doFiltering.next(false)
    }
  }, [])

  // Save filter settings to localStorage when they change
  useEffect(() => {
    const subscription = combineLatest([filter, doFiltering]).subscribe(([filterValue, doFilteringValue]) => {
      saveFilterSettings(filterValue, doFilteringValue)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  /*
  const dinfo = useObservableState<DeviceMap>(deviceInfo, {})
  const selectedPgnValue = useObservableState<PGN | undefined>(selectedPgn, undefined)
  const info = selectedPgnValue ? dinfo[selectedPgnValue.src!] : { src: 0, info: {} }
*/

  return (
    <div>
      <Nav tabs>
        <NavItem>
          <NavLink
            className={activeTab === ANALYZER_TAB_ID ? 'active' : ''}
            onClick={() => setActiveTab(ANALYZER_TAB_ID)}
            style={{ cursor: 'pointer' }}
          >
            NMEA 2000 Analyzer
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={activeTab === SEND_TAB_ID ? 'active' : ''}
            onClick={() => setActiveTab(SEND_TAB_ID)}
            style={{ cursor: 'pointer' }}
          >
            Send
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={activeTab === TRANSFORM_TAB_ID ? 'active' : ''}
            onClick={() => setActiveTab(TRANSFORM_TAB_ID)}
            style={{ cursor: 'pointer' }}
          >
            Transform
          </NavLink>
        </NavItem>
        {!isEmbedded && (
          <NavItem>
            <NavLink
              className={activeTab === CONNECTIONS_TAB_ID ? 'active' : ''}
              onClick={() => setActiveTab(CONNECTIONS_TAB_ID)}
              style={{ cursor: 'pointer' }}
            >
              Connections
            </NavLink>
          </NavItem>
        )}
      </Nav>
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
          <Card>
            <CardBody>
              <h4 className="text-sk-primary">Send NMEA 2000 Messages</h4>
              <p className="mb-3">Send custom NMEA 2000 messages to the network for testing and debugging purposes.</p>

              <div className="alert alert-info" role="alert">
                <strong>Coming Soon:</strong> PGN composition and transmission interface will be available in a future
                version.
              </div>

              <div className="row">
                <div className="col-md-6">
                  <div className="card bg-sk-light">
                    <div className="card-body">
                      <h6 className="card-title">Quick Send</h6>
                      <p className="card-text small">Send predefined PGNs with custom data fields.</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card bg-sk-light">
                    <div className="card-body">
                      <h6 className="card-title">Custom PGN</h6>
                      <p className="card-text small">Compose and send custom PGN messages.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </TabPane>
        <TabPane tabId={TRANSFORM_TAB_ID}>
          <Card>
            <CardBody>
              <h4 className="text-sk-primary">Data Transformation</h4>
              <p className="mb-3">Transform and convert NMEA 2000 data between different formats and protocols.</p>

              <div className="alert alert-info" role="alert">
                <strong>Coming Soon:</strong> Data transformation tools and protocol converters will be available in a
                future version.
              </div>

              <div className="row">
                <div className="col-md-4">
                  <div className="card bg-sk-light">
                    <div className="card-body">
                      <h6 className="card-title">Actisense → YDRAW</h6>
                      <p className="card-text small">Convert Actisense messages to YDRAW format.</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card bg-sk-light">
                    <div className="card-body">
                      <h6 className="card-title">N2K → Signal K</h6>
                      <p className="card-text small">Transform to Signal K JSON format.</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card bg-sk-light">
                    <div className="card-body">
                      <h6 className="card-title">Custom Format</h6>
                      <p className="card-text small">Export to custom data formats.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </TabPane>
        {!isEmbedded && (
          <TabPane tabId={CONNECTIONS_TAB_ID}>
            <ConnectionManagerPanel connectionStatus={connectionStatus} onStatusUpdate={setConnectionStatus} />
          </TabPane>
        )}
      </TabContent>
    </div>
  )
}

function requestMetaData(src: number) {
  infoPGNS.forEach((num) => {
    const pgn = new PGN_59904({ pgn: num })

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

export default AppPanel
