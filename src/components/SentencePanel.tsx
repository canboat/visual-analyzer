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

import React, { useState } from 'react'

import { PGN, Definition } from '@canboat/ts-pgns'
import { Subject } from 'rxjs'
import { useObservableState } from 'observable-hooks'
import { DeviceMap } from '../types'
import { Nav, NavItem, NavLink, TabContent, TabPane, Card, CardBody, CardHeader } from 'reactstrap'

// Import the separated tab components
import { HumanReadableTab } from './HumanReadableTab'
import { JsonDataTab } from './JsonDataTab'
import { InputDataTab } from './InputDataTab'
import { DeviceInfoTab } from './DeviceInfoTab'
import { PgnDefinitionTab } from './PgnDefinitionTab'
import { ByteMappingTab } from './ByteMappingTab'

interface PGNWithHistory {
  current: PGN
  history: PGN[]
}

interface SentencePanelProps {
  selectedPgn: Subject<PGN>
  selectedPgnWithHistory?: Subject<PGNWithHistory | null>
  info: Subject<DeviceMap>
}

const DATA_TAB_ID = 'data'
const PGNDEF_TAB_ID = 'pgndef'
const DEVICE_TAB_ID = 'device'
const INPUT_TAB_ID = 'input'
const MAPPING_TAB_ID = 'mapping'
const READABLE_TAB_ID = 'readable'

export const SentencePanel = (props: SentencePanelProps) => {
  const [activeTab, setActiveTab] = useState(READABLE_TAB_ID)
  const pgnData = useObservableState<PGN>(props.selectedPgn)
  const pgnWithHistory = useObservableState<PGNWithHistory | null>(props.selectedPgnWithHistory || new Subject())
  const info = useObservableState<DeviceMap>(props.info, {})

  const copyPgnData = async () => {
    if (pgnData) {
      try {
        const dataToSave = JSON.stringify(
          pgnData,
          (key, value) => (key === 'input' || key === 'rawData' || key === 'byteMapping' ? undefined : value),
          2,
        )
        await navigator.clipboard.writeText(dataToSave)
        // You could add a toast notification here if desired
      } catch (err) {
        console.error('Failed to copy PGN data:', err)
      }
    }
  }

  const copyInputData = async () => {
    if (pgnData?.input) {
      try {
        const inputDataToSave = pgnData.input.join('\n')
        await navigator.clipboard.writeText(inputDataToSave)
        // You could add a toast notification here if desired
      } catch (err) {
        console.error('Failed to copy input data:', err)
      }
    }
  }

  if (pgnData === undefined || pgnData === null) {
    return <div>Select a PGN to view its data</div>
  }

  let definition: Definition = pgnData.getDefinition()
  //console.debug('pgnData', pgnData)
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
      <Nav tabs>
        <NavItem>
          <NavLink
            className={activeTab === READABLE_TAB_ID ? 'active ' : ''}
            onClick={() => setActiveTab(READABLE_TAB_ID)}
          >
            Data
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink className={activeTab === DATA_TAB_ID ? 'active ' : ''} onClick={() => setActiveTab(DATA_TAB_ID)}>
            JSON
          </NavLink>
        </NavItem>
        {pgnData.input && pgnData.input.length > 0 && (
          <NavItem>
            <NavLink className={activeTab === INPUT_TAB_ID ? 'active ' : ''} onClick={() => setActiveTab(INPUT_TAB_ID)}>
              Input
            </NavLink>
          </NavItem>
        )}
        {info[pgnData.src!]?.info && (
          <NavItem>
            <NavLink
              className={activeTab === DEVICE_TAB_ID ? 'active ' : ''}
              onClick={() => setActiveTab(DEVICE_TAB_ID)}
            >
              Device Info
            </NavLink>
          </NavItem>
        )}
        <NavItem>
          <NavLink className={activeTab === PGNDEF_TAB_ID ? 'active ' : ''} onClick={() => setActiveTab(PGNDEF_TAB_ID)}>
            Definition
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={activeTab === MAPPING_TAB_ID ? 'active ' : ''}
            onClick={() => setActiveTab(MAPPING_TAB_ID)}
          >
            Byte Mapping
          </NavLink>
        </NavItem>
      </Nav>
      <TabContent activeTab={activeTab} style={{ flex: 1, overflow: 'auto' }}>
        <TabPane tabId={READABLE_TAB_ID}>
          <Card>
            <CardBody>
              <HumanReadableTab pgnData={pgnData} definition={definition} />
            </CardBody>
          </Card>
        </TabPane>
        <TabPane tabId={DATA_TAB_ID}>
          <Card>
            <CardBody style={{ padding: 0 }}>
              <JsonDataTab pgnData={pgnData} pgnHistory={pgnWithHistory?.history || []} onCopyData={copyPgnData} />
            </CardBody>
          </Card>
        </TabPane>
        {pgnData.input && pgnData.input.length > 0 && (
          <TabPane tabId={INPUT_TAB_ID}>
            <Card>
              <CardBody style={{ padding: 0 }}>
                <InputDataTab pgnData={pgnData} onCopyInput={copyInputData} />
              </CardBody>
            </Card>
          </TabPane>
        )}
        {definition !== undefined && (
          <TabPane tabId={PGNDEF_TAB_ID}>
            <Card>
              <CardBody style={{ padding: 0 }}>
                <PgnDefinitionTab definition={definition} />
              </CardBody>
            </Card>
          </TabPane>
        )}
        {info[pgnData.src!]?.info && (
          <TabPane tabId={DEVICE_TAB_ID}>
            <Card>
              <CardBody style={{ padding: 0 }}>
                <DeviceInfoTab pgnData={pgnData} info={info} />
              </CardBody>
            </Card>
          </TabPane>
        )}
        <TabPane tabId={MAPPING_TAB_ID}>
          <Card>
            <CardHeader>
              <small>
                <strong>PGN:</strong> {pgnData.pgn} |<strong> Source:</strong> {pgnData.src} |
                <strong> Destination:</strong> {pgnData.dst}
                <br />
                <strong>Description:</strong> {pgnData.description || 'N/A'}
              </small>
            </CardHeader>
            <CardBody>
              <ByteMappingTab pgnData={pgnData} definition={definition} />
            </CardBody>
          </Card>
        </TabPane>
      </TabContent>
    </div>
  )
}
