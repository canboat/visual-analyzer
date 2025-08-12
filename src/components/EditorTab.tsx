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
import { Card, CardBody, Nav, NavItem, NavLink, TabContent, TabPane, Container, Row, Col } from 'reactstrap'
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
} from '@canboat/ts-pgns'

const PGN_DEFINITIONS_TAB = 'pgn-definitions'
const LOOKUPS_TAB = 'lookups'
const BIT_LOOKUPS_TAB = 'bit-lookups'

interface EditorTabProps {
  isEmbedded?: boolean
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

const EditorTab: React.FC<EditorTabProps> = ({ isEmbedded = false }) => {
  const [activeSubTab, setActiveSubTab] = useState(PGN_DEFINITIONS_TAB)

  const handleSubTabChange = (tabId: string) => {
    setActiveSubTab(tabId)
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
              <Card>
                <CardBody>
                  <Row>
                    <Col>
                      <h5>PGN Definitions</h5>
                      <p className="text-muted">
                        Create and edit Parameter Group Number (PGN) definitions that describe the structure and 
                        interpretation of NMEA 2000 messages.
                      </p>
                      <div className="alert alert-info">
                        <h6>Features (Coming Soon):</h6>
                        <ul className="mb-0">
                          <li>Browse existing PGN definitions</li>
                          <li>Create new PGN definitions</li>
                          <li>Edit field definitions and properties</li>
                          <li>Set data types, units, and scaling factors</li>
                          <li>Define repeating field groups</li>
                          <li>Validate PGN structure and syntax</li>
                          <li>Export definitions in various formats</li>
                        </ul>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
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
