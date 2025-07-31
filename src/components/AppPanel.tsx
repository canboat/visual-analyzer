import React, { useEffect, useState } from 'react'
import { Card, CardBody, CardHeader, Col, Row, Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap'
import { ReplaySubject } from 'rxjs'
// import * as pkg from '../../package.json'
import { PGNDataMap, PgnNumber, DeviceMap } from '../types'
import { DataList, FilterPanel, Filter } from './DataList'
import { SentencePanel } from './SentencePanel'
import { FromPgn } from '@canboat/canboatjs'
import { PGN, createNmeaGroupFunction, PGN_59904 } from '@canboat/ts-pgns'


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
                    <FilterPanel doFiltering={doFiltering} filter={filter} availableSrcs={availableSrcs} />
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
              <h4>Send Panel</h4>
              <p>This is the send tab content. You can add configuration options here.</p>
            </CardBody>
          </Card>
        </TabPane>
        <TabPane tabId={TRANSFORM_TAB_ID}>
          <Card>
            <CardBody>
              <h4>Transform Panel</h4>
              <p>This is the transform tab content. You can add transformation options here.</p>
            </CardBody>
          </Card>
        </TabPane>
        <TabPane tabId={SETTINGS_TAB_ID}>
          <Card>
            <CardBody>
              <h4>Settings Panel</h4>
              <p>This is the settings tab content. You can add configuration options here.</p>
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
