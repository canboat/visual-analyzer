import React, { useState } from 'react'

import { PGN } from '@canboat/ts-pgns'
import { Subject } from 'rxjs'
import { useObservableState } from 'observable-hooks'
//import { pgnsById } from '../types'
import { Definition, findMatchingDefinition } from '@canboat/ts-pgns'
import { Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap'

interface SentencePanelProps {
  selectedPgn: Subject<PGN>
}

const DATA_TAB_ID = 'data'
const PGNDEF_TAB_ID = 'pgndef'

export const SentencePanel = (props: SentencePanelProps) => {
  const [activeTab, setActiveTab] = useState(DATA_TAB_ID)
  const pgnData = useObservableState<PGN>(props.selectedPgn)
  if (pgnData === undefined || pgnData === null) {
    return <div>Select a PGN to view its data</div>
  }
  let definition: Definition = pgnData.getDefinition()
  //console.log('pgnData', pgnData)
  return (
    <>
      <Nav tabs>
        <NavItem>
          <NavLink className={activeTab === DATA_TAB_ID ? 'active ' : ''} onClick={() => setActiveTab(DATA_TAB_ID)}>
            Data
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink className={activeTab === PGNDEF_TAB_ID ? 'active ' : ''} onClick={() => setActiveTab(PGNDEF_TAB_ID)}>
            PGN Definition
          </NavLink>
        </NavItem>
      </Nav>
      <TabContent activeTab={activeTab}>
        <TabPane tabId={DATA_TAB_ID}>
          <h5>{definition?.Description}</h5>
          <pre>{JSON.stringify(pgnData, null, 2)}</pre>
        </TabPane>
        {definition !== undefined && (
          <TabPane tabId={PGNDEF_TAB_ID}>
            <pre>{JSON.stringify(definition, null, 2)}</pre>
          </TabPane>
        )}
      </TabContent>
    </>
  )
}
