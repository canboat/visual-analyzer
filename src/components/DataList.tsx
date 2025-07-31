import { useObservableState } from 'observable-hooks'
import React from 'react'
import { Table } from 'reactstrap'
import { PGN } from '@canboat/ts-pgns'

import { Subject } from 'rxjs'
import { PgnNumber, PGNDataMap } from '../types'
import { setupFilters, filterPGN } from '@canboat/canboatjs'
import { Filter } from './Filters'

interface DataListProps {
  data: Subject<PGNDataMap>
  onRowClicked: (row: PGN) => void
  filter: Subject<Filter>
  doFiltering: Subject<boolean>
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
