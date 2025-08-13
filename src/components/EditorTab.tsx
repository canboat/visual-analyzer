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
import { Card, CardBody, Nav, NavItem, NavLink, TabContent, TabPane, Container, Row, Col, Button, Table } from 'reactstrap'
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
  createPGN,
  Line,
} from '@canboat/ts-pgns'
import { FromPgn } from '@canboat/canboatjs'
import { SentencePanel } from './SentencePanel'
import { ReplaySubject } from 'rxjs'
import { DeviceMap } from '../types'

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
  definitions: {} as DefinitionMap,
  lookups: {} as EnumerationMap,
  bitLookups: {} as BitEnumerationMap,

  addDefinition(definition: Definition) {
    this.definitions[definition.Id] = definition
    console.log(`Tracked definition change for PGN ID ${definition.Id}. Total tracked: ${Object.keys(this.definitions).length}`)
  },

  hasDefinition(pgnId: string): boolean {
    return this.definitions.hasOwnProperty(pgnId)
  },

  getDefinition(pgnId: string): Definition | undefined {
    return this.definitions[pgnId]
  },

  clearDefinition(pgnId: string) {
    delete this.definitions[pgnId]
    console.log(`Removed tracking for PGN ID ${pgnId}. Remaining: ${Object.keys(this.definitions).length}`)
  },

  addLookup(enumeration: EnumBase) {
    if ((enumeration as Enumeration).EnumValues) {
      this.lookups[enumeration.Name] = enumeration as Enumeration
    } else {
      this.bitLookups[enumeration.Name] = enumeration as BitEnumeration
    }
    console.log(`Tracked change for ${enumeration.Name}`)
  },

  getChangedDefinitions(): Set<string> {
    return new Set(Object.keys(this.definitions))
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
      delete this.lookups[enumName]
    } else {
      this.bitLookups[enumName]
    }
  },

  clearAll() {
    this.definitions = {}
    this.lookups = {}
    this.bitLookups = {}
    console.log('Cleared all tracked changes')
  },
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

  const handleSubTabChange = (tabId: string) => {
    setActiveSubTab(tabId)
  }

  const handleDefinitionSelect = (definitionId: string, definition: Definition) => {
    setSelectedDefinitionId(definitionId)
    const input = (definition as any).sampleData as string[]

    let pgnData: PGN | undefined = undefined
    for ( const line of input) {
      pgnData = parser.parseString(line)
    }

    if (pgnData) {
      selectedPgn.next(pgnData)
      selectedPgnWithHistory.next({
        current: pgnData,
        history: []
      })
    } else {
      console.error(`Failed to parse PGN data for definition ID ${definitionId}`)
    }
  }

  const clearDefinitionSelection = () => {
    setSelectedDefinitionId(null)
    selectedPgnWithHistory.next(null)
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
              <Row>
                <Col md="4">
                  <Card>
                    <CardBody>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="mb-0">Changed PGN Definitions</h5>
                        <Button 
                          color="secondary" 
                          size="sm" 
                          onClick={() => changedDefinitionsTracker.clearAll()}
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
                            height: '400px',
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
                                        backgroundColor: selectedDefinitionId === id ? '#d1ecf1' : (isEvenRow ? '#ffffff' : 'rgba(0,0,0,.05)'),
                                        cursor: 'pointer'
                                      }}
                                      onClick={() => handleDefinitionSelect(id, definition)}
                                    >
                                      <td style={{ color: 'red', fontWeight: 'bold' }}>
                                        {definition.PGN}
                                      </td>
                                      <td style={{ fontFamily: 'monospace' }}>
                                        {definition.Description}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        <Button
                                          color="danger"
                                          size="sm"
                                          outline
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation()
                                            changedDefinitionsTracker.clearDefinition(id)
                                            if (selectedDefinitionId === id) {
                                              clearDefinitionSelection()
                                            }
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
                <Col md="8">
                  {selectedDefinitionId ? (
                    <SentencePanel
                      selectedPgn={selectedPgn}
                      selectedPgnWithHistory={selectedPgnWithHistory}
                      definition={changedDefinitionsTracker.getDefinition(selectedDefinitionId)}
                      info={deviceInfo || new ReplaySubject<DeviceMap>()}
                    />
                  ) : (
                    <Card>
                      <CardBody>
                        <div className="text-center text-muted p-4">
                          <h5>PGN Definition Details</h5>
                          <p>Select a changed PGN definition from the list to view its details here.</p>
                          <hr />
                          <div className="text-start">
                            <h6>Features Available:</h6>
                            <ul className="list-unstyled">
                              <li>✓ View PGN structure and field definitions</li>
                              <li>✓ Examine field types, units, and scaling</li>
                              <li>✓ Browse enumeration values and lookups</li>
                              <li>✓ Track changes to definitions</li>
                            </ul>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  )}
                </Col>
              </Row>
            </TabPane>

            <TabPane tabId={LOOKUPS_TAB}>
              <Card>
                <CardBody>
                  <Row>
                    <Col>
                      <h5>Lookups</h5>
                      <p className="text-muted">
                        Manage lookup tables that map numeric values to human-readable descriptions 
                        for enumerated fields in PGN definitions.
                      </p>
                      <div className="alert alert-info">
                        <h6>Features (Coming Soon):</h6>
                        <ul className="mb-0">
                          <li>Browse existing lookup tables</li>
                          <li>Create new lookup tables</li>
                          <li>Add, edit, and remove lookup entries</li>
                          <li>Associate lookups with PGN fields</li>
                          <li>Import/export lookup definitions</li>
                          <li>Validate lookup completeness</li>
                          <li>Preview lookup usage in PGN data</li>
                        </ul>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </TabPane>

            <TabPane tabId={BIT_LOOKUPS_TAB}>
              <Card>
                <CardBody>
                  <Row>
                    <Col>
                      <h5>Bit Lookups</h5>
                      <p className="text-muted">
                        Define and manage bit field lookups for interpreting individual bits or bit ranges 
                        within larger data fields.
                      </p>
                      <div className="alert alert-info">
                        <h6>Features (Coming Soon):</h6>
                        <ul className="mb-0">
                          <li>Browse existing bit lookup definitions</li>
                          <li>Create new bit field mappings</li>
                          <li>Define bit positions and meanings</li>
                          <li>Set bit field names and descriptions</li>
                          <li>Handle bit masks and ranges</li>
                          <li>Associate bit lookups with PGN fields</li>
                          <li>Validate bit field definitions</li>
                          <li>Test bit field interpretations</li>
                        </ul>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </TabPane>
          </TabContent>
        </CardBody>
      </Card>
    </Container>
  )
}

export default EditorTab
