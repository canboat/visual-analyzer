import React, { useEffect, useState } from 'react'
import { Card, CardBody, Col, Row, Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap'
import { ReplaySubject } from 'rxjs'
// import * as pkg from '../../package.json'
import { PGNDataMap, PgnNumber, DeviceMap } from '../types'
import { DataList } from './DataList'
import { FilterPanel, Filter } from './Filters'
import { SentencePanel } from './SentencePanel'
import { FromPgn } from '@canboat/canboatjs'
import { PGN, PGN_59904 } from '@canboat/ts-pgns'

// const SAFEPLUGINID = pkg.name.replace(/[-@/]/g, '_')
// const saveSettingsItems = (items: any) => {
//   let settings
//   try {
//     settings = JSON.parse(window.localStorage.getItem(SAFEPLUGINID) || '')
//   } catch (e) {
//     settings = {}
//   }
//   window.localStorage.setItem(SAFEPLUGINID, JSON.stringify({ ...settings, ...items }))
// }

const infoPGNS: number[] = [60928, 126998, 126996]
const SEND_TAB_ID = 'send'
const ANALYZER_TAB_ID = 'analyzer'
const TRANSFORM_TAB_ID = 'transform'
const SETTINGS_TAB_ID = 'settings'

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
  const sentInfoReq: number[] = []

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

  useEffect(() => {
    const ws = props.adminUI.openWebsocket({
      subscribe: 'none',
      events: 'canboatjs:rawoutput',
    })

    ws.onmessage = (x: any) => {
      //console.log('Received dataX', x)

      const parsed = JSON.parse(x.data)
      if (parsed.event !== 'canboatjs:rawoutput') {
        return
      }
      let pgn: PGN | undefined = undefined
      pgn = parser.parse(parsed.data)
      if (pgn !== undefined) {
        //console.log('pgn', pgn)
        if (infoPGNS.indexOf(pgn!.pgn) === -1) {
          setList((prev: any) => {
            prev[`${pgn!.getDefinition().Id}-${pgn!.pgn}-${pgn!.src}`] = pgn
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
        <NavItem>
          <NavLink
            className={activeTab === SETTINGS_TAB_ID ? 'active' : ''}
            onClick={() => setActiveTab(SETTINGS_TAB_ID)}
            style={{ cursor: 'pointer' }}
          >
            Settings
          </NavLink>
        </NavItem>
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
                <strong>Coming Soon:</strong> PGN composition and transmission interface will be available in a future version.
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
                <strong>Coming Soon:</strong> Data transformation tools and protocol converters will be available in a future version.
              </div>
              
              <div className="row">
                <div className="col-md-4">
                  <div className="card bg-sk-light">
                    <div className="card-body">
                      <h6 className="card-title">N2K → NMEA 0183</h6>
                      <p className="card-text small">Convert NMEA 2000 messages to NMEA 0183 format.</p>
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
        <TabPane tabId={SETTINGS_TAB_ID}>
          <Card>
            <CardBody>
              <h4 className="text-sk-primary">Configuration Settings</h4>
              <p className="mb-3">Configure the visual analyzer behavior and display preferences.</p>
              
              <div className="row">
                <div className="col-md-6">
                  <div className="card">
                    <div className="card-header">
                      <strong>Display Options</strong>
                    </div>
                    <div className="card-body">
                      <div className="form-group">
                        <label>Refresh Rate</label>
                        <select className="form-control" defaultValue="1000">
                          <option value="500">500ms</option>
                          <option value="1000">1 second</option>
                          <option value="2000">2 seconds</option>
                          <option value="5000">5 seconds</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <div className="form-check">
                          <input className="form-check-input" type="checkbox" id="autoScroll" defaultChecked />
                          <label className="form-check-label" htmlFor="autoScroll">
                            Auto-scroll to new messages
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card">
                    <div className="card-header">
                      <strong>Data Options</strong>
                    </div>
                    <div className="card-body">
                      <div className="form-group">
                        <label>Maximum Messages</label>
                        <select className="form-control" defaultValue="1000">
                          <option value="100">100</option>
                          <option value="500">500</option>
                          <option value="1000">1000</option>
                          <option value="5000">5000</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <div className="form-check">
                          <input className="form-check-input" type="checkbox" id="showRaw" />
                          <label className="form-check-label" htmlFor="showRaw">
                            Show raw data
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </TabPane>
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
