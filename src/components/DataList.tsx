import { useObservableState } from 'observable-hooks'
import React, { useCallback } from 'react'
import { Table } from 'reactstrap'
import { PGN } from '@canboat/ts-pgns'

import { Subject } from 'rxjs'
import { PgnNumber, PGNDataMap } from '../types'
import { Filter, filterFor, getFilterConfig } from './Filters'

interface DataListProps {
  data: Subject<PGNDataMap>
  onRowClicked: (row: PGN) => void
  filter: Subject<Filter>
  doFiltering: Subject<boolean>
}

export const DataList = (props: DataListProps) => {
  const data = useObservableState<PGNDataMap>(props.data)
  const filter = useObservableState(props.filter)
  const doFiltering = useObservableState(props.doFiltering)

  const filterConfig = getFilterConfig(filter)

  const addToFilteredPgns = useCallback((i: string) => {
    const safeFilteredPgns = filter?.pgn || []
    if (safeFilteredPgns.indexOf(i) === -1) {
      props.filter.next({ ...filter, pgn: [...safeFilteredPgns, i] })
    }
  }, [filter, props.filter])

  const addToFilteredSrcs = useCallback((src: number) => {
    const safeFilteredSrcs = filter?.src || []
    if (safeFilteredSrcs.indexOf(src) === -1) {
      props.filter.next({ ...filter, src: [...safeFilteredSrcs, src] })
    }
  }, [filter, props.filter])

  const handleRowClick = useCallback((row: PGN) => {
    props.onRowClicked(row)
  }, [props.onRowClicked])

  const handlePgnClick = useCallback((e: React.MouseEvent, pgnString: string) => {
    e.preventDefault()
    e.stopPropagation()
    addToFilteredPgns(pgnString)
  }, [addToFilteredPgns])

  const handleSrcClick = useCallback((e: React.MouseEvent, src: number) => {
    e.preventDefault()
    e.stopPropagation()
    addToFilteredSrcs(src)
  }, [addToFilteredSrcs])

  const handleDescriptionClick = useCallback((e: React.MouseEvent, row: PGN) => {
    e.preventDefault()
    e.stopPropagation()
    handleRowClick(row)
  }, [handleRowClick])
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
            .sort((a, b) => a.src! - b.src!)
            .map((row: PGN, i: number) => {
              return (
                <tr key={`${(row as any).id}-${row.pgn}-${row.src}`}>
                  <td>{row.timestamp!.split('T')[1]}</td>
                  <td 
                    style={{ color: 'red', cursor: 'pointer' }} 
                    onMouseDown={(e) => handlePgnClick(e, row.pgn.toString())}
                  >
                    {row.pgn}
                  </td>
                  <td 
                    style={{ color: 'red', cursor: 'pointer' }} 
                    onMouseDown={(e) => handleSrcClick(e, row.src!)}
                  >
                    {row.src}
                  </td>
                  <td>{row.dst}</td>
                  <td
                    onMouseDown={(e) => handleDescriptionClick(e, row)}
                    style={{ cursor: 'pointer' }}
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
