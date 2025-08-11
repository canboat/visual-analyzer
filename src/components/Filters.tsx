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

import React, { useState, useEffect } from 'react'
import { Col, Input, Label, Row, Table, Button, Collapse, Card, CardBody, CardHeader } from 'reactstrap'
import { Subject } from 'rxjs'
import { useObservableState } from 'observable-hooks'
import Creatable from 'react-select/creatable'
import { PGN, getAllPGNs, ManufacturerCode } from '@canboat/ts-pgns'
import { setupFilters, filterPGN, FilterConfig } from '@canboat/canboatjs'
import { DeviceMap, PgnNumber } from '../types'

export type Filter = {
  pgn?: string[]
  src?: number[]
  dst?: number[]
  manufacturer?: string[]
  javaScript?: string
}

export type FilterOptions = {
  //useCamelCase?: boolean
  showUnknownProprietaryPGNsOnSeparateLines?: boolean
  showPgn126208OnSeparateLines?: boolean
  showInfoPgns?: boolean
  maxHistorySize?: number
}

export const getFilterConfig = (filter?: Filter): FilterConfig => {
  const pgs: number[] | undefined = filter?.pgn
    ?.map((p) => (!isNaN(Number(p)) ? Number(p) : null))
    .filter((p) => p !== null) as number[]
  const pgn_ids: string[] | undefined = filter?.pgn
    ?.map((p) => (isNaN(Number(p)) ? p : null))
    .filter((p) => p !== null) as string[]

  return setupFilters({
    pgn: pgs,
    id: pgn_ids,
    src: filter?.src,
    dst: filter?.dst,
    manufacturer: filter?.manufacturer,
    filter: filter?.javaScript,
  })
}

export const filterFor = (doFiltering: boolean | undefined, filter?: FilterConfig) => {
  if (!doFiltering || filter === undefined) return () => true
  return (pgn: PGN) => {
    return filterPGN(pgn, filter)
  }
}

const pgnOptions = getAllPGNs()
  .filter((pgn) => pgn.Fallback === undefined || pgn.Fallback === false)
  .map((pgn) => ({ value: pgn.Id, label: `${pgn.PGN} ${pgn.Description}` }))

const pgnOptionsByPgn = pgnOptions.reduce<{
  [id: string]: {
    value: string
    label: string
  }
}>((acc, pgnOption) => {
  acc[pgnOption.value] = pgnOption
  return acc
}, {})

const manufacturerCodeOptions = Object.values(ManufacturerCode)
  .sort()
  .map((name) => ({
    value: name,
    label: name,
  }))

const toPgnOption = (i: string) =>
  pgnOptionsByPgn[i] || {
    value: i,
    label: i,
  }

const toSrcOption = (i: number, devices?: DeviceMap) => {
  const model = devices?.[i]?.info[126996 as PgnNumber]?.modelId
  const man = devices?.[i]?.info[60928 as PgnNumber]?.manufacturerCode
  return {
    value: i,
    label: `${i} ${model ? '(' + model + ')' : ''} ${man ? '[' + man + ']' : ''}`,
  }
}

const toDstOption = (i: number, devices?: DeviceMap) => {
  const model = devices?.[i]?.info[126996 as PgnNumber]?.modelId
  const man = devices?.[i]?.info[60928 as PgnNumber]?.manufacturerCode
  return {
    value: i,
    label: `${i} ${model ? '(' + model + ')' : ''} ${man ? '[' + man + ']' : ''}`,
  }
}

const toManufacturerOption = (i: string) => ({
  value: i,
  label: i,
})

interface FilterPanelProps {
  filter: Subject<Filter>
  availableSrcs: Subject<number[]>
  deviceInfo: Subject<DeviceMap>
  doFiltering: Subject<boolean>
  filterOptions: Subject<FilterOptions>
}
const FILTER_PANEL_STATE_KEY = 'visual_analyzer_filter_panel_state'
const OPTIONS_PANEL_STATE_KEY = 'visual_analyzer_options_panel_state'

interface OptionsPanelProps {
  filterOptions?: FilterOptions
  onFilterOptionsChange: Subject<FilterOptions>
}

const OptionsPanel: React.FC<OptionsPanelProps> = ({ filterOptions, onFilterOptionsChange }) => {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(OPTIONS_PANEL_STATE_KEY)
        return saved !== null ? JSON.parse(saved) : false // Default to collapsed
      }
    } catch (e) {
      console.warn('Failed to load options panel state from localStorage:', e)
    }
    return false // Default to collapsed
  })

  // Save panel state to localStorage when it changes
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(OPTIONS_PANEL_STATE_KEY, JSON.stringify(isOpen))
      }
    } catch (e) {
      console.warn('Failed to save options panel state to localStorage:', e)
    }
  }, [isOpen])

  return (
    <Card>
      <CardHeader className="d-flex justify-content-between align-items-center py-2" style={{ cursor: 'pointer' }}>
        <div className="d-flex align-items-center flex-grow-1" onClick={() => setIsOpen(!isOpen)}>
          <h6 className="mb-0" style={{ fontWeight: 'bold' }}>
            Options
          </h6>
        </div>
        <Button
          color="outline-primary"
          size="sm"
          style={{ border: 'none', fontSize: '16px', padding: '2px 6px' }}
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation()
            setIsOpen(!isOpen)
          }}
        >
          {isOpen ? '−' : '+'}
        </Button>
      </CardHeader>
      <Collapse isOpen={isOpen}>
        <CardBody>
          <Row>
{/*
            <Col xs="12" md="6" className="mb-2">
              <Label className="d-flex align-items-center" style={{ cursor: 'pointer' }}>
                <Input
                  type="checkbox"
                  className="me-2"
                  checked={filterOptions?.useCamelCase ?? true}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    onFilterOptionsChange.next({
                      ...filterOptions,
                      useCamelCase: e.target.checked,
                    })
                  }}
                />
                <span>Use CamelCase Field Names</span>
              </Label>
            </Col>
*/}
            <Col xs="12" md="6" className="mb-2">
              <Label className="d-flex align-items-center" style={{ cursor: 'pointer' }}>
                <Input
                  type="checkbox"
                  className="me-2"
                  checked={filterOptions?.showInfoPgns ?? false}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    onFilterOptionsChange.next({
                      ...filterOptions,
                      showInfoPgns: e.target.checked,
                    })
                  }}
                />
                <span>Show Info PGNs</span>
              </Label>
            </Col>
            <Col xs="12" md="6" className="mb-2">
              <Label className="d-flex align-items-center" style={{ cursor: 'pointer' }}>
                <Input
                  type="checkbox"
                  className="me-2"
                  checked={filterOptions?.showUnknownProprietaryPGNsOnSeparateLines ?? false}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    onFilterOptionsChange.next({
                      ...filterOptions,
                      showUnknownProprietaryPGNsOnSeparateLines: e.target.checked,
                    })
                  }}
                />
                <span>Show Unknown Proprietary PGNs On Separate Lines</span>
              </Label>
            </Col>
            <Col xs="12" md="6" className="mb-2">
              <Label className="d-flex align-items-center" style={{ cursor: 'pointer' }}>
                <Input
                  type="checkbox"
                  className="me-2"
                  checked={filterOptions?.showPgn126208OnSeparateLines ?? false}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    onFilterOptionsChange.next({
                      ...filterOptions,
                      showPgn126208OnSeparateLines: e.target.checked,
                    })
                  }}
                />
                <span>Show PGN 126208 On Separate Lines</span>
              </Label>
            </Col>
            </Row>
            <Row>
            <Col xs="12" md="6" className="mb-2">
              <Label className="d-block" style={{ cursor: 'default' }}>
                <span className="mb-2 d-block">Max History Size per PGN</span>
                <Input
                  type="number"
                  min="0"
                  max="1000"
                  value={filterOptions?.maxHistorySize ?? 10}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const value = parseInt(e.target.value, 10)
                    onFilterOptionsChange.next({
                      ...filterOptions,
                      maxHistorySize: isNaN(value) ? 10 : Math.max(0, Math.min(1000, value)),
                    })
                  }}
                  style={{ width: '100px' }}
                />
                <small className="text-muted d-block mt-1">
                  Set to 0 to disable history tracking. History stores previous values of each PGN allowing you to see
                  changes over time by expanding rows with the chevron icon.
                </small>
              </Label>
            </Col>
          </Row>
        </CardBody>
      </Collapse>
    </Card>
  )
}

export const FilterPanel = (props: FilterPanelProps) => {
  // Load initial collapse state from localStorage
  const [isOpen, setIsOpen] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(FILTER_PANEL_STATE_KEY)
        return saved ? JSON.parse(saved) : false
      }
    } catch (e) {
      return false
    }
    return false
  })

  const filter = useObservableState(props.filter)
  const availableSrcs = useObservableState(props.availableSrcs)
  const deviceInfo = useObservableState(props.deviceInfo)
  const doFiltering = useObservableState(props.doFiltering)
  const filterOptions = useObservableState(props.filterOptions)

  // Save collapse state to localStorage when it changes
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(FILTER_PANEL_STATE_KEY, JSON.stringify(isOpen))
      }
    } catch (e) {
      console.warn('Failed to save filter panel state to localStorage:', e)
    }
  }, [isOpen])

  return (
    <>
      <Card className="mb-3">
        <CardHeader className="d-flex justify-content-between align-items-center py-2" style={{ cursor: 'pointer' }}>
          <div className="d-flex align-items-center flex-grow-1" onClick={() => setIsOpen(!isOpen)}>
            <h6 className="mb-0" style={{ fontWeight: 'bold' }}>
              Filters
            </h6>
          </div>
          <div className="d-flex align-items-center">
            <span style={{ fontSize: '14px', fontWeight: '500', marginRight: '8px' }}>Enable Filtering</span>
            <Label className="switch switch-text switch-primary mb-0 me-3">
              <Input
                type="checkbox"
                id="enableFiltering"
                name="enableFiltering"
                className="switch-input"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  e.stopPropagation()
                  props.doFiltering.next(!doFiltering)
                }}
                checked={doFiltering}
                onClick={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()}
              />
              <span className="switch-label" data-on="On" data-off="Off" />
              <span className="switch-handle" />
            </Label>
            <Button
              color="outline-primary"
              size="sm"
              style={{ border: 'none', fontSize: '16px', padding: '2px 6px' }}
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation()
                setIsOpen(!isOpen)
              }}
            >
              {isOpen ? '−' : '+'}
            </Button>
          </div>
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
                    props.filter.next({ ...filter, pgn: values.map((v) => v.value) })
                    props.doFiltering.next(true)
                  }}
                />
              </Col>
              <Col xs="12" md="4" className="mb-3">
                <Label htmlFor="srcs" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                  Sources
                </Label>
                <Creatable
                  value={filter?.src?.map((src) => toSrcOption(src, deviceInfo))}
                  isMulti
                  name="srcs"
                  options={availableSrcs?.map((s) => toSrcOption(s, deviceInfo))}
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
                  value={filter?.dst?.map((src) => toDstOption(src, deviceInfo))}
                  isMulti
                  name="dsts"
                  options={availableSrcs?.map((s) => toDstOption(s, deviceInfo))}
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
          </CardBody>
        </Collapse>
      </Card>
      <OptionsPanel filterOptions={filterOptions} onFilterOptionsChange={props.filterOptions} />
    </>
  )
}
