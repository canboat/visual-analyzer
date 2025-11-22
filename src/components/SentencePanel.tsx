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

import React, { useState, useCallback, useRef } from 'react'

import {
  PGN,
  Definition,
  Enumeration,
  BitEnumeration,
  updateLookup,
  updateBitLookup,
  removePGN,
} from '@canboat/ts-pgns'
import { Subject } from 'rxjs'
import { useObservableState } from 'observable-hooks'
import { DeviceMap } from '../types'
import { changedDefinitionsTracker, saveDefinition } from './EditorTab'
import { Nav, NavItem, NavLink, TabContent, TabPane, Card, CardBody, CardHeader } from 'reactstrap'

// Import the separated tab components
import { HumanReadableTab } from './HumanReadableTab'
import { JsonDataTab } from './JsonDataTab'
import { InputDataTab } from './InputDataTab'
import { DeviceInfoTab } from './DeviceInfoTab'
import { PgnDefinitionTab } from './PgnDefinitionTab'
import { ByteMappingTab } from './ByteMappingTab'

type PGNDataEntry = {
  current: PGN
  history: PGN[]
}

interface SentencePanelProps {
  selectedPgn: Subject<PGN>
  selectedPgnWithHistory?: Subject<PGNDataEntry | null>
  definition?: Definition
  info: Subject<DeviceMap>
  onDefinitionsChanged?: (changedDefinitions: Set<string>) => void
  onDefinitionSave?: (definition: Definition) => void
  inEditingTab: boolean
  onEditPgn?: (definition: Definition, pgnData?: PGN) => void
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
  const pgnWithHistory = useObservableState<PGNDataEntry | null>(props.selectedPgnWithHistory || new Subject())
  const info = useObservableState<DeviceMap>(props.info, {})

  // Track when definitions change
  const notifyDefinitionsChanged = useCallback(() => {
    if (props.onDefinitionsChanged) {
      props.onDefinitionsChanged(changedDefinitionsTracker.getChangedDefinitions())
    }
  }, [props.onDefinitionsChanged])

  const copyPgnData = async () => {
    if (!pgnData) return

    const dataToSave = JSON.stringify(
      pgnData,
      (key, value) =>
        key === 'input' || key === 'rawData' || key === 'byteMapping' || key === 'definition' ? undefined : value,
      2,
    )

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(dataToSave)
      } else {
        // Fallback for browsers that don't support clipboard API
        const textarea = document.createElement('textarea')
        textarea.value = dataToSave
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
    } catch (err) {
      console.error('Failed to copy PGN data:', err)
    }
  }

  const copyInputData = async () => {
    if (!pgnData?.input) return

    const inputDataToSave = pgnData.input.join('\n')

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inputDataToSave)
      } else {
        // Fallback for browsers that don't support clipboard API
        const textarea = document.createElement('textarea')
        textarea.value = inputDataToSave
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
    } catch (err) {
      console.error('Failed to copy input data:', err)
    }
  }

  const handleDefinitionSave = async (updatedDefinition: Definition) => {
    try {
      // Track this definition as changed us`ing the PGN Id

      if (!pgnData) {
        return
      }

      saveDefinition(updatedDefinition, pgnData)

      notifyDefinitionsChanged()

      if (props.onDefinitionSave) {
        props.onDefinitionSave(updatedDefinition)
      }
    } catch (err) {
      console.error('Failed to save definition:', err)
    }
  }

  const handleDefinitionExport = async (definition: Definition) => {
    try {
      const definitionJson = JSON.stringify(definition, null, 2)

      // Try to save as a file if possible, otherwise copy to clipboard
      if ('showSaveFilePicker' in window) {
        try {
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: `pgn_${definition.PGN}_${definition.Id}.json`,
            types: [
              {
                description: 'JSON files',
                accept: { 'application/json': ['.json'] },
              },
            ],
          })

          const writable = await fileHandle.createWritable()
          await writable.write(definitionJson)
          await writable.close()

          console.log('Definition exported to file:', definition.Id)
          return
        } catch (exportErr: any) {
          // User cancelled file picker or other error, fall back to clipboard
          if (exportErr.name !== 'AbortError') {
            console.warn('File picker failed, falling back to clipboard:', exportErr)
          }
        }
      }

      // Fallback to clipboard
      await navigator.clipboard.writeText(definitionJson)
      console.log('Definition exported to clipboard:', definition.Id)

      // You could show a toast notification here if you have a toast system
      alert('PGN definition exported to clipboard!')
    } catch (err) {
      console.error('Failed to export definition:', err)
      alert('Failed to export definition. Please try again.')
    }
  }

  const handleInputDataChange = useCallback(
    (newInput: string[]) => {
      if (pgnData && props.definition) {
        // Update the PGN data with new input
        //pgnData.input = newInput
        // Trigger any necessary updates
        //props.selectedPgn.next(pgnData)
        //(props.definition as any).sampleData = newInput
        pgnData.input = newInput
        if (props.onDefinitionSave) {
          props.onDefinitionSave(props.definition)
        }
      }
    },
    [pgnData, props.selectedPgn],
  )

  const handleLookupSave = useCallback(
    (enumName: string, lookupType: 'lookup' | 'bitlookup', lookupValues: { key: string; value: string }[]) => {
      if (!enumName) {
        console.warn('No enumeration name provided for lookup save')
        return
      }

      try {
        if (lookupType === 'lookup') {
          // Create regular enumeration from lookup values
          const enumeration: Enumeration = {
            Name: enumName,
            MaxValue: Math.max(...lookupValues.map((lv) => parseInt(lv.key, 10))),
            EnumValues: lookupValues.map((lv) => ({
              Name: lv.value,
              Value: parseInt(lv.key, 10),
            })),
          }
          changedDefinitionsTracker.addLookup(enumeration)
          updateLookup(enumeration)
        } else {
          // Create bit enumeration from lookup values
          const bitEnumeration: BitEnumeration = {
            Name: enumName,
            MaxValue: Math.max(...lookupValues.map((lv) => parseInt(lv.key, 10))),
            EnumBitValues: lookupValues.map((lv) => ({
              Name: lv.value,
              Bit: parseInt(lv.key, 10),
            })),
          }
          changedDefinitionsTracker.addLookup(bitEnumeration)
          updateBitLookup(bitEnumeration)
        }

        console.log(`Successfully updated ${lookupType} enumeration: ${enumName}`)
      } catch (error) {
        console.error(`Failed to save ${lookupType} enumeration:`, error)
      }
    },
    [],
  )

  if (pgnData === undefined || pgnData === null) {
    return <div>Select a PGN to view its data</div>
  }

  //let definition: Definition = pgnData.getDefinition()
  let definition = props.definition || pgnData.getDefinition()
  //console.debug('pgnData', pgnData)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
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
        <NavItem>
          <NavLink className={activeTab === INPUT_TAB_ID ? 'active ' : ''} onClick={() => setActiveTab(INPUT_TAB_ID)}>
            Input
          </NavLink>
        </NavItem>
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
        {!props.inEditingTab && (
          <NavItem>
            <NavLink
              className={activeTab === PGNDEF_TAB_ID ? 'active ' : ''}
              onClick={() => setActiveTab(PGNDEF_TAB_ID)}
            >
              Definition
            </NavLink>
          </NavItem>
        )}
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
              <HumanReadableTab pgnData={pgnData} definition={definition} pgnHistory={pgnWithHistory?.history || []} />
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
        <TabPane tabId={INPUT_TAB_ID}>
          <Card>
            <CardBody style={{ padding: 0 }}>
              <InputDataTab
                pgnData={pgnData}
                onCopyInput={copyInputData}
                isEditing={props.inEditingTab}
                onInputChange={handleInputDataChange}
              />
            </CardBody>
          </Card>
        </TabPane>
        {definition !== undefined && !props.inEditingTab && (
          <TabPane tabId={PGNDEF_TAB_ID}>
            <Card>
              <CardBody style={{ padding: 0 }}>
                <PgnDefinitionTab
                  key={pgnData.pgn}
                  definition={definition}
                  pgnData={pgnData}
                  onSave={handleDefinitionSave}
                  hasBeenChanged={changedDefinitionsTracker.hasDefinition(definition.Id)}
                  onExport={handleDefinitionExport}
                  onEditPgn={props.inEditingTab === false ? props.onEditPgn : undefined}
                  changedLookups={changedDefinitionsTracker.getChangedLookups()}
                />
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
