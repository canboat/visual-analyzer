import { PGN, getAllPGNs, ManufacturerCode } from '@canboat/ts-pgns'
import { useObservableState } from 'observable-hooks'
import React, { useState } from 'react'
import Select from 'react-select'
import { Col, Input, Label, Row, Table, Button, Collapse, Card, CardBody, CardHeader } from 'reactstrap'
import Creatable from 'react-select/creatable'

import { Subject } from 'rxjs'
import { PgnNumber, PGNDataMap } from '../types'
import { setupFilters, filterPGN } from '@canboat/canboatjs'

interface DataListProps {
  data: Subject<PGNDataMap>
  onRowClicked: (row: PGN) => void
  filterPgns: Subject<PgnNumber[]>
  filterSrcs: Subject<number[]>
  filterDsts: Subject<number[]>
  filterManufacturers: Subject<string[]>
  filterJavaScript: Subject<string>

  doFiltering: Subject<boolean>
}

const filterFor = (
  doFiltering: boolean | undefined,
  pgns: number[] | undefined,
  src: number[] | undefined,
  dst: number[] | undefined,
  manufacturer: string[] | undefined,
  javaScript: string | undefined,
) => {
  if (!doFiltering) return () => true
  return (pgn: PGN) => {
    return filterPGN(
      pgn,
      setupFilters({
        pgn: pgns,
        src: src,
        dst: dst,
        manufacturer: manufacturer,
        filter: javaScript,
      }),
    )
  }
}

export const DataList = (props: DataListProps) => {
  const data = useObservableState<PGNDataMap>(props.data)
  const filterPgns = useObservableState(props.filterPgns)
  const doFiltering = useObservableState(props.doFiltering)
  const filterSrcs = useObservableState(props.filterSrcs)
  const filterDsts = useObservableState(props.filterDsts)
  const filterManufacturers = useObservableState(props.filterManufacturers)
  const javaScriptFilter = useObservableState(props.filterJavaScript)

  const addToFilteredPgns = (i: PgnNumber) => {
    const safeFilteredPgns = filterPgns || []
    if (safeFilteredPgns.indexOf(i) === -1) {
      props.filterPgns.next([...safeFilteredPgns, i])
    }
  }
  return (
    <div
      style={{
        width: '100%',
        height: '600px',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Table responsive bordered striped size="sm">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>pgn</th>
            <th>src</th>
            <th>dst</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {(data != undefined ? Object.values(data) : [])
            .filter(filterFor(doFiltering, filterPgns, filterSrcs, filterDsts, filterManufacturers, javaScriptFilter))
            .sort((a, b) => a.src! - b.src!)
            .map((row: PGN, i: number) => {
              return (
                <tr key={row.timestamp! + i}>
                  <td>{row.timestamp!.split('T')[1]}</td>
                  <td onClick={() => addToFilteredPgns(row.pgn as PgnNumber)}>{row.pgn}</td>
                  <td>{row.src}</td>
                  <td>{row.dst}</td>
                  <td
                    onClick={() => {
                      props.onRowClicked(row)
                    }}
                  >
                    <span style={{ fontFamily: 'monospace' }}>{row.getDefinition().Description}</span>
                  </td>
                </tr>
              )
            })}
        </tbody>
      </Table>
    </div>
  )
}

const pgnRow = (
  i: number,
  timestamp: string,
  pgn: string,
  src: string,
  input: string[],
  onClick: React.MouseEventHandler,
) => (
  <tr key={i}>
    <td>{timestamp.split('T')[1]}</td>
    <td style={{ color: 'red' }} onClick={onClick}>
      {pgn}
    </td>
    <td>{src}</td>
    <td>
      <span style={{ fontFamily: 'monospace' }}>{input.join(' ')}</span>
    </td>
  </tr>
)

const pgnOptions = getAllPGNs().map((pgn) => ({ value: pgn.PGN, label: `${pgn.PGN} ${pgn.Description}` }))
const pgnOptionsByPgn = pgnOptions.reduce<{
  [pgnNumber: PgnNumber]: {
    value: number
    label: string
  }
}>((acc, pgnOption) => {
  acc[pgnOption.value as PgnNumber] = pgnOption
  return acc
}, {})

const manufacturerCodeOptions = Object.values(ManufacturerCode).map((name) => ({
  value: name,
  label: name,
}))

const toPgnOption = (i: PgnNumber) =>
  pgnOptionsByPgn[i] || {
    value: i,
    label: `${i}`,
  }

const toSrcOption = (i: number) => ({
  value: i,
  label: `${i}`,
})

const toDstOption = (i: number) => ({
  value: i,
  label: `${i}`,
})

const toManufacturerOption = (i: string) => ({
  value: i,
  label: i,
})

export interface PgnOption {
  value: number
  label: string
}
interface FilterPanelProps {
  filterPgns: Subject<PgnNumber[]>
  filterSrcs: Subject<number[]>
  filterDsts: Subject<number[]>
  filterManufacturers: Subject<string[]>
  filterJavaScript: Subject<string>
  availableSrcs: Subject<number[]>
  doFiltering: Subject<boolean>
}
export const FilterPanel = (props: FilterPanelProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const selectedPGNs = useObservableState(props.filterPgns)
  const selectedSrcs = useObservableState(props.filterSrcs)
  const selectedDsts = useObservableState(props.filterDsts)
  const selectedManufacturers = useObservableState(props.filterManufacturers)
  const javaScriptFilter = useObservableState(props.filterJavaScript)
  const availableSrcs = useObservableState(props.availableSrcs)
  const doFiltering = useObservableState(props.doFiltering)

  return (
    <Card>
      <CardHeader className="d-flex justify-content-between align-items-center py-2">
        <h6 className="mb-0" style={{ fontWeight: 'bold' }}>
          Filters
        </h6>
        <Button
          color="outline-primary"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          style={{ border: 'none', fontSize: '16px', padding: '2px 6px' }}
        >
          {isOpen ? '−' : '+'}
        </Button>
      </CardHeader>
      <Collapse isOpen={isOpen}>
        <CardBody>
          <Row className="mb-4">
            <Col xs="12" md="4" className="mb-3">
              <Label htmlFor="pgns" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                PGNs
              </Label>
              <Creatable
                value={selectedPGNs?.map(toPgnOption)}
                isMulti
                name="pgns"
                options={pgnOptions}
                className="basic-multi-select"
                classNamePrefix="select"
                onChange={(values) => props.filterPgns.next(values.map((v) => v.value as PgnNumber))}
              />
            </Col>
            <Col xs="12" md="4" className="mb-3">
              <Label htmlFor="srcs" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                Sources
              </Label>
              <Creatable
                value={selectedSrcs?.map(toSrcOption)}
                isMulti
                name="srcs"
                options={availableSrcs?.map(toSrcOption)}
                className="basic-multi-select"
                classNamePrefix="select"
                onChange={(values) => props.filterSrcs.next(values.map((v) => v.value))}
              />
            </Col>
            <Col xs="12" md="4" className="mb-3">
              <Label htmlFor="dsts" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                Destinations
              </Label>
              <Creatable
                value={selectedDsts?.map(toDstOption)}
                isMulti
                name="dsts"
                options={availableSrcs?.map(toDstOption)}
                className="basic-multi-select"
                classNamePrefix="select"
                onChange={(values) => props.filterDsts.next(values.map((v) => v.value))}
              />
            </Col>
          </Row>
          <Row className="mb-4">
            <Col xs="12" md="6" className="mb-3">
              <Label htmlFor="manufacturers" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                Manufacturers
              </Label>
              <Creatable
                value={selectedManufacturers?.map(toManufacturerOption)}
                isMulti
                name="manufacturers"
                options={manufacturerCodeOptions}
                className="basic-multi-select"
                classNamePrefix="select"
                onChange={(values) => props.filterManufacturers.next(values.map((v) => v.value))}
              />
            </Col>
            <Col xs="12" md="6" className="mb-3">
              <Label htmlFor="javascriptFilter" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                JavaScript Filter
              </Label>
              <Input
                type="textarea"
                id="javascriptFilter"
                name="javascriptFilter"
                placeholder="Enter JavaScript code to filter PGNs (e.g., pgn.src === 1 && pgn.pgn === 127251 && pgn.fields.sog > 5)"
                value={javaScriptFilter || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => props.filterJavaScript.next(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
                rows={3}
              />
            </Col>
          </Row>
          <Row>
            <Col xs="12" md="6"></Col>
            <Col xs="12" md="6" className="d-flex align-items-center justify-content-md-end">
              <Label className="switch switch-text switch-primary mb-0 me-3">
                <Input
                  type="checkbox"
                  id="Meta"
                  name="meta"
                  className="switch-input"
                  onChange={() => props.doFiltering.next(!doFiltering)}
                  checked={doFiltering}
                />
                <span className="switch-label" data-on="Yes" data-off="No" />
                <span className="switch-handle" />
              </Label>
              <span style={{ lineHeight: '24px', fontWeight: 'bold', marginLeft: '12px' }}>Enable Filtering</span>
            </Col>
          </Row>
        </CardBody>
      </Collapse>
    </Card>
  )
}
