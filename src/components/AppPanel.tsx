import React, { useEffect, useState } from 'react'
import { Card, CardBody, CardHeader, Col, Row } from 'reactstrap'
import { ReplaySubject } from 'rxjs'
// import * as pkg from '../../package.json'
import { PGNDataMap, PgnNumber, DeviceMap } from '../types'
import { DataList, FilterPanel, Filter } from './DataList'
import { SentencePanel } from './SentencePanel'
import { FromPgn } from '@canboat/canboatjs'
import { PGN, createNmeaGroupFunction, PGN_59904 } from '@canboat/ts-pgns'
import { useObservableState } from 'observable-hooks'

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

const AppPanel = (props: any) => {
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
    <Card>
      <CardHeader>NMEA 2000 Debugging Utility</CardHeader>``
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
