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
  filter: Subject<Filter>
  doFiltering: Subject<boolean>
}

export type Filter = {
  pgn?: PgnNumber[]
  src?: number[]
  dst?: number[]
  manufacturer?: string[]
  javaScript?: string
}

const filterFor = (doFiltering: boolean | undefined, filter?: Filter) => {
  if (!doFiltering || filter === undefined) return () => true
  return (pgn: PGN) => {
    return filterPGN(
      pgn,
      setupFilters({
        pgn: filter.pgn,
        src: filter.src,
        dst: filter.dst,
        manufacturer: filter.manufacturer,
        filter: filter.javaScript,
      }),
    )
  }
}

export const DataList = (props: DataListProps) => {
  const data = useObservableState<PGNDataMap>(props.data)
  const filter = useObservableState(props.filter)
  const doFiltering = useObservableState(props.doFiltering)

  const addToFilteredPgns = (i: PgnNumber) => {
    const safeFilteredPgns = filter?.pgn || []
    if (safeFilteredPgns.indexOf(i) === -1) {
      props.filter.next({ ...filter, pgn: [...safeFilteredPgns, i] })
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
            .filter(filterFor(doFiltering, filter))
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

const manufacturerCodeOptions = Object.values(ManufacturerCode)
  .sort()
  .map((name) => ({
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
  filter: Subject<Filter>
  availableSrcs: Subject<number[]>
  doFiltering: Subject<boolean>
}
export const FilterPanel = (props: FilterPanelProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const filter = useObservableState(props.filter)
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
                value={filter?.pgn?.map(toPgnOption)}
                isMulti
                name="pgns"
                options={pgnOptions}
                className="basic-multi-select"
                classNamePrefix="select"
                onChange={(values) => {
                  props.filter.next({ ...filter, pgn: values.map((v) => v.value as PgnNumber) })
                  props.doFiltering.next(true)
                }}
              />
            </Col>
            <Col xs="12" md="4" className="mb-3">
              <Label htmlFor="srcs" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                Sources
              </Label>
              <Creatable
                value={filter?.src?.map(toSrcOption)}
                isMulti
                name="srcs"
                options={availableSrcs?.map(toSrcOption)}
                className="basic-multi-select"
                classNamePrefix="select"
                onChange={(values) => {
                  props.filter.next({ ...filter, src: values.map((v) => v.value) })
                  props.doFiltering.next(true)
                }}
              />
            </Col>
            <Col xs="12" md="4" className="mb-3">
              <Label htmlFor="dsts" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                Destinations
              </Label>
              <Creatable
                value={filter?.dst?.map(toDstOption)}
                isMulti
                name="dsts"
                options={availableSrcs?.map(toDstOption)}
                className="basic-multi-select"
                classNamePrefix="select"
                onChange={(values) => {
                  props.filter.next({ ...filter, dst: values.map((v) => v.value) })
                  props.doFiltering.next(true)
                }}
              />
            </Col>
          </Row>
          <Row className="mb-4">
            <Col xs="12" md="6" className="mb-3">
              <Label htmlFor="manufacturers" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                Manufacturers
              </Label>
              <Creatable
                value={filter?.manufacturer?.map(toManufacturerOption)}
                isMulti
                name="manufacturers"
                options={manufacturerCodeOptions}
                className="basic-multi-select"
                classNamePrefix="select"
                onChange={(values) => {
                  props.filter.next({ ...filter, manufacturer: values.map((v) => v.value) })
                  props.doFiltering.next(true)
                }}
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
                value={filter?.javaScript || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  props.filter.next({ ...filter, javaScript: e.target.value })
                  props.doFiltering.next(true)
                }}
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
