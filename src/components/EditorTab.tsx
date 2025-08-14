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
import {
  Card,
  CardBody,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
  Container,
  Row,
  Col,
  Button,
  Table,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
} from 'reactstrap'
import {
  PGN,
  Definition,
  EnumBase,
  Enumeration,
  BitEnumeration,
  updatePGN,
  updateLookup,
  updateBitLookup,
  removePGN,
  removeLookup,
  removeBitLookup,
  ManufacturerCodeValues,
  IndustryCodeValues,
  getPGNWithId,
  getEnumerationValue,
} from '@canboat/ts-pgns'
import { FromPgn } from '@canboat/canboatjs'
import { SentencePanel } from './SentencePanel'
import { PgnDefinitionTab } from './PgnDefinitionTab'
import LookupEditor from './LookupEditor'
import BitLookupEditor from './BitLookupEditor'
import { toCamelCase } from './PgnDefinitionTab'
import { ReplaySubject } from 'rxjs'
import { DeviceMap } from '../types'
import { useObservableState } from 'observable-hooks'

const PGN_DEFINITIONS_TAB = 'pgn-definitions'
const LOOKUPS_TAB = 'lookups'
const BIT_LOOKUPS_TAB = 'bit-lookups'

interface EditorTabProps {
  isEmbedded?: boolean
  deviceInfo?: ReplaySubject<DeviceMap>
}

type DefinitionMap = {
  [key: string]: Definition
}

type EnumerationMap = {
  [key: string]: Enumeration
}

type BitEnumerationMap = {
  [key: string]: BitEnumeration
}

export const changedDefinitionsTracker = {
  // Local storage keys
  _storageKeys: {
    definitions: 'changedDefinitionsTracker_definitions',
    lookups: 'changedDefinitionsTracker_lookups',
    bitLookups: 'changedDefinitionsTracker_bitLookups',
  },

  // In-memory cache
  _cache: {
    definitions: null as DefinitionMap | null,
    lookups: null as EnumerationMap | null,
    bitLookups: null as BitEnumerationMap | null,
  },

  // Load from local storage with error handling
  _loadFromStorage<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : defaultValue
    } catch (error) {
      console.warn(`Failed to load ${key} from local storage:`, error)
      return defaultValue
    }
  },

  // Save to local storage with error handling
  _saveToStorage(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.warn(`Failed to save ${key} to local storage:`, error)
    }
  },

  // Lazy getters with caching
  get definitions(): DefinitionMap {
    if (this._cache.definitions === null) {
      this._cache.definitions = this._loadFromStorage(this._storageKeys.definitions, {})
      Object.values(this._cache.definitions).forEach((def) => {
        updatePGN(def)
      })
    }
    return this._cache.definitions
  },

  get lookups(): EnumerationMap {
    if (this._cache.lookups === null) {
      this._cache.lookups = this._loadFromStorage(this._storageKeys.lookups, {})
      Object.values(this._cache.lookups).forEach((enumItem) => {
        updateLookup(enumItem)
      })
    }
    return this._cache.lookups
  },

  get bitLookups(): BitEnumerationMap {
    if (this._cache.bitLookups === null) {
      this._cache.bitLookups = this._loadFromStorage(this._storageKeys.bitLookups, {})
      Object.values(this._cache.bitLookups).forEach((bitEnumItem) => {
        updateBitLookup(bitEnumItem)
      })
    }
    return this._cache.bitLookups
  },

  addDefinition(definition: Definition) {
    this.definitions[definition.Id] = definition
    this._saveToStorage(this._storageKeys.definitions, this.definitions)
    console.log(
      `Tracked definition change for PGN ID ${definition.Id}. Total tracked: ${Object.keys(this.definitions).length}`,
    )
  },

  hasDefinition(pgnId: string): boolean {
    return this.definitions.hasOwnProperty(pgnId)
  },

  getDefinition(pgnId: string): Definition | undefined {
    return this.definitions[pgnId]
  },

  clearDefinition(pgnId: string) {
    if (!this.hasDefinition(pgnId)) {
      console.warn(`Attempted to clear non-existent PGN ID ${pgnId}`)
      return
    }
    removePGN(this.definitions[pgnId])
    delete this.definitions[pgnId]
    this._saveToStorage(this._storageKeys.definitions, this.definitions)
    console.log(`Removed tracking for PGN ID ${pgnId}. Remaining: ${Object.keys(this.definitions).length}`)
  },

  addLookup(enumeration: EnumBase) {
    if ((enumeration as Enumeration).EnumValues) {
      this.lookups[enumeration.Name] = enumeration as Enumeration
      this._saveToStorage(this._storageKeys.lookups, this.lookups)
      console.log(`Tracked change for lookup ${enumeration.Name}`)
    } else {
      this.bitLookups[enumeration.Name] = enumeration as BitEnumeration
      this._saveToStorage(this._storageKeys.bitLookups, this.bitLookups)
      console.log(`Tracked change for bit lookup ${enumeration.Name}`)
    }
  },

  hasLookup(enumName: string): boolean {
    return this.lookups.hasOwnProperty(enumName)
  },

  getLookup(enumName: string): Enumeration | undefined {
    return this.lookups[enumName]
  },

  getChangedDefinitions(): Set<string> {
    return new Set(Object.keys(this.definitions))
  },

  getLookups(): Enumeration[] {
    return Object.values(this.lookups)
  },

  getBitLookups(): BitEnumeration[] {
    return Object.values(this.bitLookups)
  },

  getChangedLookups(): { lookups: Set<string>; bitLookups: Set<string> } {
    return {
      lookups: new Set(Object.keys(this.lookups)),
      bitLookups: new Set(Object.keys(this.bitLookups)),
    }
  },

  getAllChanges() {
    return {
      definitions: this.getChangedDefinitions(),
      ...this.getChangedLookups(),
    }
  },

  clearLookup(enumName: string, type: 'lookup' | 'bitlookup') {
    if (type === 'lookup') {
      if (!this.lookups.hasOwnProperty(enumName)) {
        console.warn(`Attempted to clear non-existent lookup ${enumName}`)
        return
      }
      removeLookup(this.lookups[enumName])
      delete this.lookups[enumName]
      this._saveToStorage(this._storageKeys.lookups, this.lookups)
    } else {
      if (!this.bitLookups.hasOwnProperty(enumName)) {
        console.warn(`Attempted to clear non-existent bit lookup ${enumName}`)
        return
      }
      removeBitLookup(this.bitLookups[enumName])
      delete this.bitLookups[enumName]
      this._saveToStorage(this._storageKeys.bitLookups, this.bitLookups)
    }
  },

  clearAllDefinitions() {
    // Clear only definitions
    this._cache.definitions = {}
    this._saveToStorage(this._storageKeys.definitions, {})
    console.log('Cleared all tracked definition changes')
  },

  clearAllLookups() {
    // Clear only lookups
    this._cache.lookups = {}
    this._saveToStorage(this._storageKeys.lookups, {})
    console.log('Cleared all tracked lookup changes')
  },

  clearAllBitLookups() {
    // Clear only bit lookups
    this._cache.bitLookups = {}
    this._saveToStorage(this._storageKeys.bitLookups, {})
    console.log('Cleared all tracked bit lookup changes')
  },

  clearAll() {
    // Clear in-memory cache
    this._cache.definitions = {}
    this._cache.lookups = {}
    this._cache.bitLookups = {}

    // Clear local storage
    this._saveToStorage(this._storageKeys.definitions, {})
    this._saveToStorage(this._storageKeys.lookups, {})
    this._saveToStorage(this._storageKeys.bitLookups, {})

    console.log('Cleared all tracked changes')
  },
}

const fixupFallbackPGN = (newDef: Definition, pgnData?: PGN) => {
  if (newDef.Fallback) {
    const pgnNumber = pgnData?.pgn || newDef.PGN
    newDef.Fallback = false
    newDef.Description = `My ${pgnNumber}`
    newDef.Id = `my${pgnNumber}`
    newDef.Explanation = undefined

    if (pgnData) {
      if (newDef.Fields.length > 0 && newDef.Fields[0].Id === 'manufacturerCode') {
        newDef.Fields[0].Match = ManufacturerCodeValues[(pgnData.fields as any).manufacturerCode] || undefined
        newDef.Description = `${(pgnData.fields as any).manufacturerCode}: ${pgnNumber}`
        newDef.Id = toCamelCase(newDef.Description)
      }
      if (newDef.Fields.length > 2 && newDef.Fields[2].Id === 'industryCode') {
        newDef.Fields[2].Match = IndustryCodeValues[(pgnData.fields as any).industryCode] || undefined
      }

      const partialMatch = (pgnData as any).partialMatch as string
      if (partialMatch) {
        const partial = getPGNWithId(partialMatch)!
        const hasDataField = newDef.Fields[newDef.Fields.length - 1].Id === 'data'
        const start = hasDataField ? newDef.Fields.length - 1 : newDef.Fields.length

        if (hasDataField) {
          newDef.Fields = newDef.Fields.slice(0, start)
        }

        for (let i = start; i < partial.Fields.length; i++) {
          const field = partial.Fields[i]

          const val = (pgnData.fields as any)[field.Id]

          if (val !== undefined) {
            const newField = { ...field }
            if (field.Match !== undefined) {
              if (field.LookupEnumeration) {
                if (typeof val === 'string') {
                  newField.Match = getEnumerationValue(field.LookupEnumeration, val)
                } else {
                  newField.Match = val
                }
              }
            }
            newDef.Fields.push(newField)
          }
        }
      }
    }
  }
}

export const saveDefinition = (updatedDefinition: Definition, pgnData?: PGN) => {
  let definition = pgnData?.getDefinition()

  if (pgnData !== undefined) {
    ;(updatedDefinition as any).sampleData = pgnData.input
  }

  if (definition !== undefined && changedDefinitionsTracker.hasDefinition(definition.Id)) {
    if (definition.Id !== updatedDefinition.Id) {
      changedDefinitionsTracker.clearDefinition(definition.Id)
      removePGN(definition)
    }
    changedDefinitionsTracker.addDefinition(updatedDefinition)
  } else {
    const newDef = {
      ...JSON.parse(JSON.stringify(updatedDefinition)),
      PGN: updatedDefinition.PGN,
    }
    fixupFallbackPGN(newDef, pgnData)
    changedDefinitionsTracker.addDefinition(newDef)
    updatedDefinition = newDef
  }

  updatePGN(updatedDefinition)
  return updatedDefinition
}

const parser = new FromPgn({
  returnNulls: true,
  checkForInvalidFields: true,
  useCamel: true,
  useCamelCompat: false,
  returnNonMatches: true,
  createPGNObjects: true,
  includeInputData: true,
  includeRawData: true,
  includeByteMapping: true,
})

parser.on('error', (pgn: any, error: any) => {
  console.error(`Error parsing ${pgn.pgn} ${error}`)
  //console.error(error.stack)
})

const EditorTab: React.FC<EditorTabProps> = ({ isEmbedded = false, deviceInfo }) => {
  const [activeSubTab, setActiveSubTab] = useState(PGN_DEFINITIONS_TAB)
  const [selectedPgn] = useState(new ReplaySubject<PGN>())
  const [selectedPgnWithHistory] = useState(new ReplaySubject<{ current: PGN; history: PGN[] } | null>())
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null)
  const [trackerVersion, setTrackerVersion] = useState(0) // Force re-renders when tracker changes

  // Lookup editing state
  const [editingLookup, setEditingLookup] = useState<{ enumName: string; type: 'lookup' | 'bitlookup' } | null>(null)
  const [lookupValues, setLookupValues] = useState<{ key: string; value: string }[]>([])
  const [newLookupName, setNewLookupName] = useState('')

  // Get the current PGN value for PgnDefinitionTab
  const currentPgn = useObservableState<PGN | undefined>(selectedPgn, undefined)

  const handleSubTabChange = (tabId: string) => {
    setActiveSubTab(tabId)
  }

  const handleDefinitionSelect = (definitionId: string, definition: Definition) => {
    setSelectedDefinitionId(definitionId)
    const input = (definition as any).sampleData as string[]

    let pgnData: PGN | undefined = undefined
    if (input && input.length > 0) {
      for (const line of input) {
        pgnData = parser.parseString(line)
      }
    } else {
      pgnData = { getDefinition: () => definition } as any as PGN
    }

    if (pgnData) {
      selectedPgn.next(pgnData)
      selectedPgnWithHistory.next({
        current: pgnData,
        history: [],
      })
    } else {
      console.error(`Failed to parse PGN data for definition ID ${definitionId}`)
    }
  }

  const handleDefinitionSave = (definition: Definition) => {
    saveDefinition(definition, currentPgn!)
    setTrackerVersion((v) => v + 1) // Force re-render when adding/updating definitions
    handleDefinitionSelect(definition.Id, definition)
  }

  const clearDefinitionSelection = () => {
    setSelectedDefinitionId(null)
    selectedPgnWithHistory.next(null)
  }

  // Helper functions that update the tracker and force re-renders
  const clearAllDefinitions = () => {
    changedDefinitionsTracker.clearAllDefinitions()
    setTrackerVersion((v) => v + 1)
    clearDefinitionSelection()
  }

  const clearSingleDefinition = (id: string) => {
    changedDefinitionsTracker.clearDefinition(id)
    setTrackerVersion((v) => v + 1)
    if (selectedDefinitionId === id) {
      clearDefinitionSelection()
    }
  }

  // Handler functions for lookups
  const handleLookupChange = (enumeration: Enumeration) => {
    changedDefinitionsTracker.addLookup(enumeration)
    setTrackerVersion((v) => v + 1) // Force re-render
  }

  const handleLookupRemove = (enumName: string) => {
    changedDefinitionsTracker.clearLookup(enumName, 'lookup')
    setTrackerVersion((v) => v + 1) // Force re-render
  }

  const clearAllLookups = () => {
    // Clear only lookups, not definitions or bit lookups
    changedDefinitionsTracker.clearAllLookups()
    setTrackerVersion((v) => v + 1)
  }

  // Lookup editing functions (similar to PgnDefinitionTab)
  const handleLookupEdit = (
    enumName: string,
    type: 'lookup' | 'bitlookup',
    lookupValues: { key: string; value: string }[],
  ) => {
    if (!enumName && lookupValues.length === 0) {
      // This is a new lookup creation request without name, initialize with default values
      setLookupValues([
        { key: '0', value: 'Unknown' },
        { key: '1', value: 'Value1' },
        { key: '2', value: 'Value2' },
      ])
      setNewLookupName('')
      setEditingLookup({ enumName: '', type })
      return
    }

    // Load existing lookup values or use provided ones
    setLookupValues(lookupValues)
    setNewLookupName(enumName || '') // Set the existing name for editing
    setEditingLookup({ enumName, type })
  }

  const closeLookupEditor = () => {
    setEditingLookup(null)
    setLookupValues([])
    setNewLookupName('')
  }

  const addLookupValue = () => {
    setLookupValues((prev) => [...prev, { key: prev.length.toString(), value: `Value${prev.length}` }])
  }

  const removeLookupValue = (index: number) => {
    setLookupValues((prev) => prev.filter((_, i) => i !== index))
  }

  const updateLookupValue = (index: number, key: string, value: string) => {
    setLookupValues((prev) => prev.map((item, i) => (i === index ? { key, value } : item)))
  }

  const saveLookupValues = () => {
    if (!editingLookup) return

    // Use the provided enumName or the entered newLookupName
    const enumName = newLookupName.trim()

    if (!enumName) {
      alert('Please enter a name for the lookup')
      return
    }

    // If this is a rename operation (original name exists and is different from new name)
    const isRename = editingLookup.enumName && editingLookup.enumName !== enumName

    if (editingLookup.type === 'lookup') {
      // If renaming, first remove the old lookup
      if (isRename) {
        changedDefinitionsTracker.clearLookup(editingLookup.enumName!, 'lookup')
      }

      // Create new enumeration
      const newEnumeration: Enumeration = {
        Name: enumName,
        MaxValue: 255, // Default max value
        EnumValues: lookupValues
          .map((item) => ({
            Value: parseInt(item.key) || 0,
            Name: item.value,
          }))
          .sort((a, b) => a.Value - b.Value),
      }

      updateLookup(newEnumeration)
      handleLookupChange(newEnumeration)
    } else if (editingLookup.type === 'bitlookup') {
      // If renaming, first remove the old bit lookup
      if (isRename) {
        changedDefinitionsTracker.clearLookup(editingLookup.enumName!, 'bitlookup')
      }

      // Create new bit enumeration
      const newBitEnumeration: BitEnumeration = {
        Name: enumName,
        MaxValue: 255, // Default max value for bit enumerations
        EnumBitValues: lookupValues
          .map((item) => ({
            Bit: parseInt(item.key) || 0,
            Name: item.value,
          }))
          .sort((a, b) => a.Bit - b.Bit),
      }

      updateBitLookup(newBitEnumeration)
      handleBitLookupChange(newBitEnumeration)
    }

    closeLookupEditor()
  }

  // Handler functions for bit lookups
  const handleBitLookupChange = (enumeration: BitEnumeration) => {
    changedDefinitionsTracker.addLookup(enumeration)
    setTrackerVersion((v) => v + 1) // Force re-render when adding/updating bit lookups
  }

  const handleBitLookupRemove = (enumName: string) => {
    changedDefinitionsTracker.clearLookup(enumName, 'bitlookup')
    setTrackerVersion((v) => v + 1)
  }

  const clearAllBitLookups = () => {
    // Clear only bit lookups, not definitions or lookups
    changedDefinitionsTracker.clearAllBitLookups()
    setTrackerVersion((v) => v + 1)
  }

  // Handler for when PgnDefinitionTab saves a lookup
  const handlePgnDefinitionLookupSave = (
    enumName: string,
    lookupType: 'lookup' | 'bitlookup',
    lookupValues: { key: string; value: string }[],
  ) => {
    // This will be called when PgnDefinitionTab saves lookup changes
    // We need to update our tracker version to force re-render of the editors
    setTrackerVersion((v) => v + 1)
  }

  return (
    <Container fluid>
      <Card>
        <CardBody>
          <div className="mb-3">
            <h4>PGN Definition Editor</h4>
            <p className="text-muted">
              Edit and manage PGN definitions, Lookups, and BitLookups for NMEA 2000 data interpretation.
            </p>
          </div>

          {/* Sub-navigation for editor sections */}
          <Nav tabs className="mb-3">
            <NavItem>
              <NavLink
                className={activeSubTab === PGN_DEFINITIONS_TAB ? 'active' : ''}
                onClick={() => handleSubTabChange(PGN_DEFINITIONS_TAB)}
                style={{ cursor: 'pointer' }}
              >
                PGN Definitions
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink
                className={activeSubTab === LOOKUPS_TAB ? 'active' : ''}
                onClick={() => handleSubTabChange(LOOKUPS_TAB)}
                style={{ cursor: 'pointer' }}
              >
                Lookups
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink
                className={activeSubTab === BIT_LOOKUPS_TAB ? 'active' : ''}
                onClick={() => handleSubTabChange(BIT_LOOKUPS_TAB)}
                style={{ cursor: 'pointer' }}
              >
                Bit Lookups
              </NavLink>
            </NavItem>
          </Nav>

          <TabContent activeTab={activeSubTab}>
            <TabPane tabId={PGN_DEFINITIONS_TAB}>
              {/* Top Section - Changed PGN Definitions List */}
              <Row className="mb-3">
                <Col md="12">
                  <Card>
                    <CardBody>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="mb-0">Changed PGN Definitions</h5>
                        <Button
                          color="secondary"
                          size="sm"
                          onClick={clearAllDefinitions}
                          disabled={Object.keys(changedDefinitionsTracker.definitions).length === 0}
                        >
                          Clear All
                        </Button>
                      </div>

                      {Object.keys(changedDefinitionsTracker.definitions).length === 0 ? (
                        <div className="text-muted text-center p-4">
                          <p>No changed definitions</p>
                          <small>Modified PGN definitions will appear here</small>
                        </div>
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '200px',
                            overflow: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                          }}
                        >
                          <Table responsive bordered size="sm">
                            <thead>
                              <tr>
                                <th>PGN</th>
                                <th>Description</th>
                                <th style={{ width: '50px' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(changedDefinitionsTracker.definitions)
                                .sort(([, a], [, b]) => a.PGN - b.PGN)
                                .map(([id, definition], index) => {
                                  const isEvenRow = index % 2 === 0
                                  return (
                                    <tr
                                      key={id}
                                      style={{
                                        backgroundColor:
                                          selectedDefinitionId === id
                                            ? '#d1ecf1'
                                            : isEvenRow
                                              ? '#ffffff'
                                              : 'rgba(0,0,0,.05)',
                                        cursor: 'pointer',
                                      }}
                                      onClick={() => handleDefinitionSelect(id, definition)}
                                    >
                                      <td style={{ color: 'red', fontWeight: 'bold' }}>{definition.PGN}</td>
                                      <td style={{ fontFamily: 'monospace' }}>{definition.Description}</td>
                                      <td style={{ textAlign: 'center' }}>
                                        <Button
                                          color="danger"
                                          size="sm"
                                          outline
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation()
                                            clearSingleDefinition(id)
                                          }}
                                          title="Remove from changed list"
                                          style={{ lineHeight: 1, padding: '0.125rem 0.375rem' }}
                                        >
                                          ×
                                        </Button>
                                      </td>
                                    </tr>
                                  )
                                })}
                            </tbody>
                          </Table>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </Col>
              </Row>

              {/* Bottom Section - Two Columns */}
              <Row>
                {/* Left Column - PGN Definition Tab */}
                <Col md="6">
                  <Card style={{ height: 'calc(100vh - 400px)', minHeight: '800px' }}>
                    <CardBody style={{ height: '100%', overflow: 'hidden', padding: 0 }}>
                      {selectedDefinitionId && currentPgn ? (
                        <PgnDefinitionTab
                          definition={changedDefinitionsTracker.getDefinition(selectedDefinitionId)!}
                          pgnData={currentPgn}
                          onSave={handleDefinitionSave}
                          hasBeenChanged={true}
                          changedLookups={changedDefinitionsTracker.getChangedLookups()}
                        />
                      ) : (
                        <div
                          className="text-center text-muted p-4"
                          style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                        >
                          <h5>PGN Definition Structure</h5>
                          <p>
                            Select a PGN definition from the list above to view its field structure and properties here.
                          </p>
                          <div className="text-start">
                            <h6>This panel will show:</h6>
                            <ul className="list-unstyled">
                              <li>✓ Field definitions and properties</li>
                              <li>✓ Data types and units</li>
                              <li>✓ Enumeration mappings</li>
                              <li>✓ Field editing capabilities</li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </Col>

                {/* Right Column - Sentence Panel */}
                <Col md="6">
                  <Card style={{ height: 'calc(100vh - 400px)', minHeight: '800px' }}>
                    <CardBody style={{ height: '100%', overflow: 'hidden', padding: 0 }}>
                      {selectedDefinitionId ? (
                        <SentencePanel
                          selectedPgn={selectedPgn}
                          selectedPgnWithHistory={selectedPgnWithHistory}
                          definition={changedDefinitionsTracker.getDefinition(selectedDefinitionId)}
                          onDefinitionSave={handleDefinitionSave}
                          info={deviceInfo || new ReplaySubject<DeviceMap>()}
                          inEditingTab={true}
                        />
                      ) : (
                        <div
                          className="text-center text-muted p-4"
                          style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                        >
                          <h5>PGN Data Analysis</h5>
                          <p>Select a PGN definition from the list above to view parsed data and analysis here.</p>
                          <div className="text-start">
                            <h6>This panel will show:</h6>
                            <ul className="list-unstyled">
                              <li>✓ Parsed PGN data values</li>
                              <li>✓ Raw data interpretation</li>
                              <li>✓ Field-by-field analysis</li>
                              <li>✓ Data validation results</li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </Col>
              </Row>
            </TabPane>

            <TabPane tabId={LOOKUPS_TAB}>
              <LookupEditor
                key={`lookups-${trackerVersion}`}
                changedLookups={changedDefinitionsTracker.lookups}
                onLookupChange={handleLookupChange}
                onLookupRemove={handleLookupRemove}
                onClearAll={clearAllLookups}
                onLookupEdit={handleLookupEdit}
              />
            </TabPane>

            <TabPane tabId={BIT_LOOKUPS_TAB}>
              <BitLookupEditor
                key={`bitlookups-${trackerVersion}`}
                changedBitLookups={changedDefinitionsTracker.bitLookups}
                onBitLookupChange={handleBitLookupChange}
                onBitLookupRemove={handleBitLookupRemove}
                onClearAll={clearAllBitLookups}
                onBitLookupEdit={handleLookupEdit}
              />
            </TabPane>
          </TabContent>
        </CardBody>
      </Card>

      {/* Lookup Editor Modal */}
      <Modal isOpen={!!editingLookup} toggle={closeLookupEditor} size="lg">
        <ModalHeader toggle={closeLookupEditor}>
          {editingLookup?.enumName ? 'Edit' : 'Create'} {editingLookup?.type === 'lookup' ? 'Lookup' : 'Bit Lookup'}{' '}
          Enumeration
          {editingLookup?.enumName && editingLookup.enumName === newLookupName && (
            <div className="small text-muted">Current lookup: {editingLookup.enumName}</div>
          )}
        </ModalHeader>
        <ModalBody>
          {/* Name input for all lookups */}
          {editingLookup && (
            <div className="mb-3">
              <label className="form-label">{editingLookup.type === 'lookup' ? 'Lookup' : 'Bit Lookup'} Name</label>
              <Input
                type="text"
                placeholder={`Enter ${editingLookup.type === 'lookup' ? 'lookup' : 'bit lookup'} name`}
                value={newLookupName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewLookupName(e.target.value)}
              />
              {editingLookup.enumName && editingLookup.enumName !== newLookupName && (
                <div className="small text-muted mt-1">Original name: {editingLookup.enumName}</div>
              )}
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6>Lookup Values</h6>
            <Button color="success" size="sm" onClick={addLookupValue}>
              <i className="fa fa-plus me-2" />
              Add Value
            </Button>
          </div>

          <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <Table size="sm" bordered>
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Key/Value</th>
                  <th>Name/Description</th>
                  <th style={{ width: '80px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lookupValues.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <Input
                        type={editingLookup?.type === 'bitlookup' ? 'text' : 'number'}
                        size="sm"
                        value={item.key}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateLookupValue(index, e.target.value, item.value)
                        }
                        placeholder={editingLookup?.type === 'bitlookup' ? '0x01' : '0'}
                      />
                    </td>
                    <td>
                      <Input
                        type="text"
                        size="sm"
                        value={item.value}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateLookupValue(index, item.key, e.target.value)
                        }
                        placeholder="Value name"
                      />
                    </td>
                    <td className="text-center">
                      <Button color="danger" size="sm" onClick={() => removeLookupValue(index)} title="Remove value">
                        <i className="fa fa-trash" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {lookupValues.length === 0 && (
            <div className="text-center text-muted p-4">
              <i className="fa fa-info-circle me-2" />
              No lookup values defined. Click "Add Value" to start.
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={saveLookupValues}>
            <i className="fa fa-save me-2" />
            Save Lookup
          </Button>
          <Button color="secondary" onClick={closeLookupEditor}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </Container>
  )
}

export default EditorTab
