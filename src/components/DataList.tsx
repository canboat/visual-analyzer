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
import React, { useCallback } from 'react'
import { Table } from 'reactstrap'
import { PGN } from '@canboat/ts-pgns'

import { Subject } from 'rxjs'
import { PgnNumber, PGNDataMap } from '../types'
import { Filter, filterFor, getFilterConfig, FilterOptions } from './Filters'
import { getRowKey } from './AppPanel'

interface DataListProps {
  data: Subject<PGNDataMap>
  onRowClicked: (row: PGN) => void
  filter: Subject<Filter>
  doFiltering: Subject<boolean>
  filterOptions: Subject<FilterOptions>
}

export const DataList = (props: DataListProps) => {
  const data = useObservableState<PGNDataMap>(props.data)
  const filter = useObservableState(props.filter)
  const doFiltering = useObservableState(props.doFiltering)
  const filterOptions = useObservableState(props.filterOptions)

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
            .filter(filterFor(doFiltering, filterConfig))
            .sort((a, b) => {
              // Sort by PGN first, then by src
              if (a.src !== b.src) {
                return a.src! - b.src!
              }
              return a.pgn - b.pgn
            })
            .map((row: PGN, i: number) => {
              return (
                <tr key={getRowKey(row, filterOptions)} onClick={() => handleRowClick(row)}>
                  <td style={{ fontFamily: 'monospace' }}>
                    {new Date(row.timestamp!).toLocaleTimeString([], { hour12: false })}
                  </td>
                  <td
                    style={{ color: 'red', cursor: 'pointer' }}
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
              )
            })}
        </tbody>
      </Table>
    </div>
  )
}
