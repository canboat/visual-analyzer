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

import { useObservableState } from 'observable-hooks'
import React, { useCallback, useState } from 'react'
import { Table, Collapse, Badge } from 'reactstrap'
import { PGN } from '@canboat/ts-pgns'

import { Subject } from 'rxjs'
import { PgnNumber, PGNDataMap } from '../types'
import { Filter, filterFor, getFilterConfig, FilterOptions } from './Filters'
import { getRowKey } from './AppPanel'

type SortColumn = 'timestamp' | 'pgn' | 'src' | 'dst' | 'description'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  column: SortColumn
  direction: SortDirection
}

type PGNDataEntry = {
  current: PGN
  history: PGN[]
}

interface DataListProps {
  data: Subject<{ [key: string]: PGNDataEntry }>
  onRowClicked: (row: PGN) => void
  filter: Subject<Filter>
  doFiltering: Subject<boolean>
  filterOptions: Subject<FilterOptions>
}

export const DataList = (props: DataListProps) => {
  const data = useObservableState<{ [key: string]: PGNDataEntry }>(props.data)
  const filter = useObservableState(props.filter)
  const doFiltering = useObservableState(props.doFiltering)
  const filterOptions = useObservableState(props.filterOptions)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: 'src', direction: 'asc' })

  const filterConfig = getFilterConfig(filter)

  const addToFilteredPgns = useCallback(
    (i: string) => {
      const safeFilteredPgns = filter?.pgn || []
      if (safeFilteredPgns.indexOf(i) === -1) {
        props.filter.next({ ...filter, pgn: [...safeFilteredPgns, i] })
      }
    },
    [filter, props.filter],
  )

  const addToFilteredSrcs = useCallback(
    (src: number) => {
      const safeFilteredSrcs = filter?.src || []
      if (safeFilteredSrcs.indexOf(src) === -1) {
        props.filter.next({ ...filter, src: [...safeFilteredSrcs, src] })
      }
    },
    [filter, props.filter],
  )

  const toggleRowExpansion = useCallback((rowKey: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(rowKey)) {
        newSet.delete(rowKey)
      } else {
        newSet.add(rowKey)
      }
      return newSet
    })
  }, [])

  const handleSort = useCallback((column: SortColumn) => {
    setSortConfig((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }, [])

  const getSortedEntries = useCallback(
    (entries: [string, PGNDataEntry][]) => {
      return entries.sort(([, a], [, b]) => {
        let comparison = 0
        
        switch (sortConfig.column) {
          case 'timestamp':
            const timeA = new Date(a.current.timestamp || 0).getTime()
            const timeB = new Date(b.current.timestamp || 0).getTime()
            comparison = timeA - timeB
            break
          case 'pgn':
            comparison = a.current.pgn - b.current.pgn
            break
          case 'src':
            comparison = (a.current.src || 0) - (b.current.src || 0)
            break
          case 'dst':
            comparison = (a.current.dst || 0) - (b.current.dst || 0)
            break
          case 'description':
            const descA = a.current.getDefinition().Description.toLowerCase()
            const descB = b.current.getDefinition().Description.toLowerCase()
            comparison = descA.localeCompare(descB)
            break
        }
        
        return sortConfig.direction === 'asc' ? comparison : -comparison
      })
    },
    [sortConfig]
  )

  const getSortIcon = useCallback(
    (column: SortColumn) => {
      if (sortConfig.column !== column) {
        return <i className="fas fa-sort" style={{ color: '#ccc', marginLeft: '4px' }} />
      }
      return (
        <i
          className={`fas fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}
          style={{ marginLeft: '4px' }}
        />
      )
    },
    [sortConfig]
  )

  const handleRowClick = useCallback(
    (row: PGN) => {
      props.onRowClicked(row)
    },
    [props.onRowClicked],
  )

  const handlePgnClick = useCallback(
    (e: React.MouseEvent, pgnString: string) => {
      e.preventDefault()
      e.stopPropagation()
      addToFilteredPgns(pgnString)
    },
    [addToFilteredPgns],
  )

  const handleSrcClick = useCallback(
    (e: React.MouseEvent, src: number) => {
      e.preventDefault()
      e.stopPropagation()
      addToFilteredSrcs(src)
    },
    [addToFilteredSrcs],
  )

  const handleDescriptionClick = useCallback(
    (e: React.MouseEvent, row: PGN) => {
      e.preventDefault()
      e.stopPropagation()
      handleRowClick(row)
    },
    [handleRowClick],
  )
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
      <Table responsive bordered size="sm">
        <thead>
          <tr>
            <th style={{ width: '55px' }}></th>
            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('timestamp')}>
              Timestamp{getSortIcon('timestamp')}
            </th>
            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('pgn')}>
              pgn{getSortIcon('pgn')}
            </th>
            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('src')}>
              src{getSortIcon('src')}
            </th>
            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('dst')}>
              dst{getSortIcon('dst')}
            </th>
            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('description')}>
              Description{getSortIcon('description')}
            </th>
          </tr>
        </thead>
        <tbody>
          {getSortedEntries(
            (data != undefined ? Object.entries(data) : [])
              .filter(([, entry]) => filterFor(doFiltering, filterConfig)(entry.current))
          ).map(([rowKey, entry], index) => {
              const row = entry.current
              const isExpanded = expandedRows.has(rowKey)
              const hasHistory = entry.history.length > 0
              const isEvenRow = index % 2 === 0

              return (
                <React.Fragment key={rowKey}>
                  <tr style={{ backgroundColor: isEvenRow ? '#ffffff' : 'rgba(0,0,0,.05)' }}>
                    <td>
                      {hasHistory && (
                        <i
                          className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggleRowExpansion(rowKey)}
                        />
                      )}
                      {hasHistory && (
                        <Badge
                          color="info"
                          size="sm"
                          className="ms-1"
                          title={`${entry.history.length} previous entries`}
                        >
                          {entry.history.length}
                        </Badge>
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', cursor: 'pointer' }} onClick={() => handleRowClick(row)}>
                      {new Date(row.timestamp!).toLocaleTimeString([], { hour12: false })}
                    </td>
                    <td
                      style={{
                        color: 'red',
                        cursor: 'pointer',
                        fontWeight: hasHistory ? 'bold' : 'normal',
                      }}
                      onMouseDown={(e) => handlePgnClick(e, row.pgn.toString())}
                    >
                      {row.pgn}
                    </td>
                    <td style={{ color: 'red', cursor: 'pointer' }} onMouseDown={(e) => handleSrcClick(e, row.src!)}>
                      {row.src}
                    </td>
                    <td>{row.dst}</td>
                    <td onMouseDown={(e) => handleDescriptionClick(e, row)} style={{ cursor: 'pointer' }}>
                      <span style={{ fontFamily: 'monospace' }}>{row.getDefinition().Description}</span>
                    </td>
                  </tr>
                  {hasHistory && (
                    <tr style={{ backgroundColor: 'transparent' }}>
                      <td colSpan={6} style={{ padding: 0, borderTop: 'none', backgroundColor: 'transparent' }}>
                        <Collapse isOpen={isExpanded}>
                          <div style={{ backgroundColor: '#f8f9fa', padding: '8px' }}>
                            <div style={{ marginBottom: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>
                              History ({entry.history.length} previous entries):
                            </div>
                            <Table size="sm" bordered style={{ marginBottom: 0 }}>
                              <thead>
                                <tr style={{ backgroundColor: '#e9ecef' }}>
                                  <th>Timestamp</th>
                                  <th>pgn</th>
                                  <th>src</th>
                                  <th>dst</th>
                                  <th>Description</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.history.map((historicalRow: PGN, index: number) => (
                                  <tr
                                    key={`${rowKey}-history-${index}`}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handleRowClick(historicalRow)}
                                  >
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                      {new Date(historicalRow.timestamp!).toLocaleTimeString([], { hour12: false })}
                                    </td>
                                    <td style={{ fontSize: '0.8rem' }}>{historicalRow.pgn}</td>
                                    <td style={{ fontSize: '0.8rem' }}>{historicalRow.src}</td>
                                    <td style={{ fontSize: '0.8rem' }}>{historicalRow.dst}</td>
                                    <td style={{ fontSize: '0.8rem' }}>
                                      <span style={{ fontFamily: 'monospace' }}>
                                        {historicalRow.getDefinition().Description}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        </Collapse>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
        </tbody>
      </Table>
    </div>
  )
}
