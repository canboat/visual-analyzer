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

import React, { useState, useMemo, ChangeEvent, useCallback, useEffect, useRef } from 'react'
import {
  Card,
  CardBody,
  Row,
  Col,
  Input,
  Table,
  Badge,
  Collapse,
  Pagination,
  PaginationItem,
  PaginationLink,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  ListGroup,
  ListGroupItem,
  InputGroup,
  InputGroupText,
} from 'reactstrap'
import { getAllPGNs, Definition, getEnumeration, getBitEnumeration, getFieldTypeEnumeration } from '@canboat/ts-pgns'

interface PgnBrowserProps {}

// Debounce hook for search performance
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Memoized PGN row component to prevent unnecessary re-renders
const PgnRow = React.memo(
  ({
    pgn,
    isExpanded,
    onToggle,
    formatPgnNumber,
    formatFieldType,
    getFieldSize,
    hasLookupValues,
    showLookupPopup,
  }: {
    pgn: Definition
    isExpanded: boolean
    onToggle: (id: string) => void
    formatPgnNumber: (num: number) => string
    formatFieldType: (type?: string) => string
    getFieldSize: (field: any) => string
    hasLookupValues: (field: any) => boolean
    showLookupPopup: (field: any) => void
  }) => (
    <React.Fragment>
      <tr style={{ cursor: 'pointer' }} onClick={() => onToggle(pgn.Id)} data-pgn-id={pgn.Id}>
        <td>
          <code>{formatPgnNumber(pgn.PGN)}</code>
        </td>
        <td>
          <strong>{pgn.Description}</strong>
          {pgn.Explanation && (
            <div>
              <small className="text-muted">
                {pgn.Explanation.length > 100 ? `${pgn.Explanation.substring(0, 100)}...` : pgn.Explanation}
              </small>
            </div>
          )}
        </td>
        <td>
          <Badge color={pgn.Type === 'Fast' ? 'primary' : 'secondary'}>{pgn.Type}</Badge>
        </td>
        <td>
          <Badge color={pgn.Complete ? 'success' : 'warning'}>{pgn.Complete ? 'Complete' : 'Incomplete'}</Badge>
          {pgn.Fallback && (
            <div>
              <Badge color="info" size="sm">
                Fallback
              </Badge>
            </div>
          )}
        </td>
        <td>{pgn.Fields.length}</td>
        <td>
          <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`} />
        </td>
      </tr>
      <tr>
        <td colSpan={6} style={{ padding: 0 }}>
          <Collapse isOpen={isExpanded}>
            <div className="p-3 bg-light">
              <Row>
                <Col md={6}>
                  <h6>PGN Details</h6>
                  <dl className="row">
                    <dt className="col-sm-4">ID:</dt>
                    <dd className="col-sm-8">
                      <code>{pgn.Id}</code>
                    </dd>
                    <dt className="col-sm-4">PGN:</dt>
                    <dd className="col-sm-8">
                      <code>{pgn.PGN}</code>
                    </dd>
                    <dt className="col-sm-4">Type:</dt>
                    <dd className="col-sm-8">{pgn.Type}</dd>
                    <dt className="col-sm-4">Priority:</dt>
                    <dd className="col-sm-8">{pgn.Priority}</dd>
                    {pgn.Length && (
                      <>
                        <dt className="col-sm-4">Length:</dt>
                        <dd className="col-sm-8">{pgn.Length} bytes</dd>
                      </>
                    )}
                    {pgn.TransmissionInterval && (
                      <>
                        <dt className="col-sm-4">Interval:</dt>
                        <dd className="col-sm-8">{pgn.TransmissionInterval}ms</dd>
                      </>
                    )}
                    {pgn.RepeatingFieldSet1Size && (
                      <>
                        <dt className="col-sm-4">Repeating Set 1:</dt>
                        <dd className="col-sm-8">
                          <Badge color="info" className="me-2">
                            {pgn.RepeatingFieldSet1Size} field{pgn.RepeatingFieldSet1Size > 1 ? 's' : ''}
                          </Badge>
                          <small className="text-muted">
                            Starting at field {pgn.RepeatingFieldSet1StartField || 'unknown'}
                            {pgn.RepeatingFieldSet1CountField && (
                              <span>, count from field {pgn.RepeatingFieldSet1CountField}</span>
                            )}
                          </small>
                        </dd>
                      </>
                    )}
                    {pgn.RepeatingFieldSet2Size && (
                      <>
                        <dt className="col-sm-4">Repeating Set 2:</dt>
                        <dd className="col-sm-8">
                          <Badge color="info" className="me-2">
                            {pgn.RepeatingFieldSet2Size} field{pgn.RepeatingFieldSet2Size > 1 ? 's' : ''}
                          </Badge>
                          <small className="text-muted">
                            Starting at field {pgn.RepeatingFieldSet2StartField || 'unknown'}
                            {pgn.RepeatingFieldSet2CountField && (
                              <span>, count from field {pgn.RepeatingFieldSet2CountField}</span>
                            )}
                          </small>
                        </dd>
                      </>
                    )}
                    {pgn.URL && (
                      <>
                        <dt className="col-sm-4">Reference:</dt>
                        <dd className="col-sm-8">
                          <a href={pgn.URL} target="_blank" rel="noopener noreferrer">
                            Documentation
                          </a>
                        </dd>
                      </>
                    )}
                  </dl>
                </Col>
                <Col md={6}>
                  {pgn.Explanation && (
                    <div>
                      <h6>Explanation</h6>
                      <p className="small">{pgn.Explanation}</p>
                    </div>
                  )}
                </Col>
              </Row>

              {pgn.Fields.length > 0 && (
                <div className="mt-3">
                  <h6>Fields ({pgn.Fields.length})</h6>
                  {(pgn.RepeatingFieldSet1Size || pgn.RepeatingFieldSet2Size) && (
                    <div className="mb-2">
                      <small className="text-muted">
                        <strong>Legend:</strong>{' '}
                        {pgn.RepeatingFieldSet1Size && (
                          <>
                            <Badge color="info" size="sm" className="me-1">
                              R1
                            </Badge>
                            Repeating Set 1{' '}
                          </>
                        )}
                        {pgn.RepeatingFieldSet2Size && (
                          <>
                            <Badge color="warning" size="sm" className="me-1">
                              R2
                            </Badge>
                            Repeating Set 2{' '}
                          </>
                        )}
                        {(pgn.RepeatingFieldSet1CountField || pgn.RepeatingFieldSet2CountField) && (
                          <>
                            <Badge color="secondary" size="sm" className="me-1">
                              COUNT
                            </Badge>
                            Count field
                          </>
                        )}
                      </small>
                    </div>
                  )}
                  <Table size="sm" bordered>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Size</th>
                        <th>Unit</th>
                        <th>Resolution</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pgn.Fields.map((field, index) => {
                        const fieldIndex = index + 1
                        const isInRepeatingSet1 =
                          pgn.RepeatingFieldSet1Size &&
                          pgn.RepeatingFieldSet1StartField &&
                          fieldIndex >= pgn.RepeatingFieldSet1StartField &&
                          fieldIndex < pgn.RepeatingFieldSet1StartField + pgn.RepeatingFieldSet1Size
                        const isInRepeatingSet2 =
                          pgn.RepeatingFieldSet2Size &&
                          pgn.RepeatingFieldSet2StartField &&
                          fieldIndex >= pgn.RepeatingFieldSet2StartField &&
                          fieldIndex < pgn.RepeatingFieldSet2StartField + pgn.RepeatingFieldSet2Size
                        const isCountField =
                          pgn.RepeatingFieldSet1CountField === fieldIndex ||
                          pgn.RepeatingFieldSet2CountField === fieldIndex

                        return (
                          <tr
                            key={index}
                            className={isInRepeatingSet1 ? 'table-info' : isInRepeatingSet2 ? 'table-warning' : ''}
                          >
                            <td>
                              <div className="d-flex align-items-center">
                                <code>{field.Name}</code>
                                {isInRepeatingSet1 && (
                                  <Badge color="info" size="sm" className="ms-2" title="Part of Repeating Set 1">
                                    R1
                                  </Badge>
                                )}
                                {isInRepeatingSet2 && (
                                  <Badge color="warning" size="sm" className="ms-2" title="Part of Repeating Set 2">
                                    R2
                                  </Badge>
                                )}
                                {isCountField && (
                                  <Badge
                                    color="secondary"
                                    size="sm"
                                    className="ms-2"
                                    title="Count field for repeating set"
                                  >
                                    COUNT
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td>
                              <Badge
                                color={hasLookupValues(field) ? 'primary' : 'light'}
                                className={hasLookupValues(field) ? 'text-white' : 'text-dark'}
                                style={{
                                  fontSize: '0.7em',
                                  cursor: hasLookupValues(field) ? 'pointer' : 'default',
                                }}
                                onClick={hasLookupValues(field) ? () => showLookupPopup(field) : undefined}
                                title={hasLookupValues(field) ? 'Click to view lookup values' : undefined}
                              >
                                {formatFieldType(field.FieldType)}
                                {hasLookupValues(field) && (
                                  <i className="fas fa-external-link-alt ms-1" style={{ fontSize: '0.6em' }} />
                                )}
                              </Badge>
                            </td>
                            <td>{getFieldSize(field)}</td>
                            <td>{field.Unit && <code className="small">{field.Unit}</code>}</td>
                            <td>
                              {field.Resolution && field.Resolution !== 1 && (
                                <code className="small">{field.Resolution}</code>
                              )}
                            </td>
                            <td>
                              <small>{field.Description}</small>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>
          </Collapse>
        </td>
      </tr>
    </React.Fragment>
  ),
)

interface PgnBrowserProps {}

export const PgnBrowser: React.FC<PgnBrowserProps> = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [expandedPgn, setExpandedPgn] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Ref for the scrollable table container
  const tableContainerRef = useRef<HTMLDivElement>(null)

  // Modal state for lookup values
  const [lookupModal, setLookupModal] = useState<{
    isOpen: boolean
    field: any | null
    enumValues: Array<{ name: string; value: number | string; description?: string }> | null
    title: string
  }>({
    isOpen: false,
    field: null,
    enumValues: null,
    title: '',
  })

  // Search state for modal
  const [modalSearchTerm, setModalSearchTerm] = useState('')

  // Debounce search term to improve performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Get all PGN definitions (memoized)
  const allPgns = useMemo(() => getAllPGNs(), [])

  // Memoized categories to avoid recalculation
  const categories = useMemo(
    () => [
      { value: 'all', label: 'All PGNs', count: allPgns.length },
      { value: 'complete', label: 'Complete', count: allPgns.filter((p) => p.Complete).length },
      { value: 'incomplete', label: 'Incomplete', count: allPgns.filter((p) => !p.Complete).length },
      { value: 'fast', label: 'Fast Frame', count: allPgns.filter((p) => p.Type === 'Fast').length },
      { value: 'single', label: 'Single Frame', count: allPgns.filter((p) => p.Type === 'Single').length },
      { value: 'fallback', label: 'Fallback', count: allPgns.filter((p) => p.Fallback).length },
    ],
    [allPgns],
  )

  // Filter and search PGNs (only when debounced search changes)
  const filteredPgns = useMemo(() => {
    if (!debouncedSearchTerm && selectedCategory === 'all') {
      return allPgns
    }

    return allPgns.filter((pgn) => {
      const searchLower = debouncedSearchTerm.toLowerCase()
      const matchesSearch =
        debouncedSearchTerm === '' ||
        pgn.Description.toLowerCase().includes(searchLower) ||
        pgn.PGN.toString().includes(debouncedSearchTerm) ||
        pgn.Id.toLowerCase().includes(searchLower) ||
        (pgn.Explanation && pgn.Explanation.toLowerCase().includes(searchLower)) ||
        // Only search field names if there's a search term (expensive operation)
        (debouncedSearchTerm.length > 2 &&
          pgn.Fields.some(
            (field) =>
              field.Name?.toLowerCase().includes(searchLower) || field.Description?.toLowerCase().includes(searchLower),
          ))

      const matchesCategory =
        selectedCategory === 'all' ||
        (selectedCategory === 'complete' && pgn.Complete) ||
        (selectedCategory === 'incomplete' && !pgn.Complete) ||
        (selectedCategory === 'fast' && pgn.Type === 'Fast') ||
        (selectedCategory === 'single' && pgn.Type === 'Single') ||
        (selectedCategory === 'fallback' && pgn.Fallback)

      return matchesSearch && matchesCategory
    })
  }, [allPgns, debouncedSearchTerm, selectedCategory])

  // Paginated results
  const paginatedPgns = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredPgns.slice(startIndex, startIndex + pageSize)
  }, [filteredPgns, currentPage, pageSize])

  const totalPages = Math.ceil(filteredPgns.length / pageSize)

  // Reset to first page when search/filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, selectedCategory])

  const togglePgnExpansion = useCallback(
    (pgnId: string) => {
      const wasExpanded = expandedPgn === pgnId
      const hadPreviouslyExpanded = expandedPgn !== null && expandedPgn !== pgnId
      setExpandedPgn(expandedPgn === pgnId ? null : pgnId)

      // Only scroll when expanding a row, not when collapsing
      if (!wasExpanded) {
        // If there was a previously expanded row, wait longer for the collapse animation
        const delay = hadPreviouslyExpanded ? 300 : 50

        // Scroll the clicked row to the top after a delay to allow state update
        setTimeout(() => {
          if (tableContainerRef.current) {
            // Find the row element by data attribute
            const rowElement = tableContainerRef.current.querySelector(`[data-pgn-id="${pgnId}"]`) as HTMLElement
            if (rowElement) {
              // Get the row's offset position within the scrollable container
              const rowTop = rowElement.offsetTop
              const headerHeight = 50 // Account for sticky header

              // Scroll to position the row at the top (accounting for header)
              tableContainerRef.current.scrollTop = rowTop - headerHeight
            }
          }
        }, delay)
      }
    },
    [expandedPgn],
  )

  const formatFieldType = useCallback((fieldType?: string) => {
    if (!fieldType) return 'Unknown'
    return fieldType
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }, [])

  const formatPgnNumber = useCallback((pgn: number) => {
    return pgn.toString()
  }, [])

  const getFieldSize = useCallback((field: any) => {
    if (field.BitLength) {
      if (typeof field.BitLength === 'number') {
        return field.BitLength % 8 === 0 ? `${field.BitLength / 8} bytes` : `${field.BitLength} bits`
      }
    }
    return ''
  }, [])

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  // Function to get lookup values for a field
  const getLookupValues = useCallback((field: any) => {
    let enumValues: Array<{ name: string; value: number | string; description?: string }> = []
    let title = ''

    if (field.LookupEnumeration) {
      const enumeration = getEnumeration(field.LookupEnumeration)
      if (enumeration) {
        title = `${field.LookupEnumeration} Values`
        enumValues = enumeration.EnumValues.map((v) => ({
          name: v.Name,
          value: v.Value,
        }))
      }
    } else if (field.LookupBitEnumeration) {
      const bitEnumeration = getBitEnumeration(field.LookupBitEnumeration)
      if (bitEnumeration) {
        title = `${field.LookupBitEnumeration} Bit Values`
        enumValues = bitEnumeration.EnumBitValues.map((v) => ({
          name: v.Name,
          value: `Bit ${v.Bit}`,
          description: `Bit position ${v.Bit}`,
        }))
      }
    } else if (field.LookupFieldTypeEnumeration) {
      const fieldTypeEnum = getFieldTypeEnumeration(field.LookupFieldTypeEnumeration)
      if (fieldTypeEnum) {
        title = `${field.LookupFieldTypeEnumeration} Field Type Values`
        enumValues = fieldTypeEnum.EnumFieldTypeValues.map((v) => ({
          name: v.name,
          value: v.value,
          description: `${v.FieldType}${v.Unit ? ` (${v.Unit})` : ''}${v.Resolution ? ` - Resolution: ${v.Resolution}` : ''}`,
        }))
      }
    }

    return { enumValues, title }
  }, [])

  // Function to show lookup popup
  const showLookupPopup = useCallback(
    (field: any) => {
      const { enumValues, title } = getLookupValues(field)
      if (enumValues.length > 0) {
        setLookupModal({
          isOpen: true,
          field,
          enumValues,
          title,
        })
      }
    },
    [getLookupValues],
  )

  // Function to close lookup popup
  const closeLookupPopup = useCallback(() => {
    setLookupModal({
      isOpen: false,
      field: null,
      enumValues: null,
      title: '',
    })
    setModalSearchTerm('') // Reset search when closing
  }, [])

  // Filter enum values based on search term
  const filteredEnumValues = useMemo(() => {
    if (!lookupModal.enumValues || !modalSearchTerm) {
      return lookupModal.enumValues || []
    }

    const searchLower = modalSearchTerm.toLowerCase()
    return lookupModal.enumValues.filter(
      (enumValue) =>
        enumValue.name.toLowerCase().includes(searchLower) ||
        enumValue.value.toString().toLowerCase().includes(searchLower) ||
        (enumValue.description && enumValue.description.toLowerCase().includes(searchLower)),
    )
  }, [lookupModal.enumValues, modalSearchTerm])

  // Function to check if field has lookup values
  const hasLookupValues = useCallback((field: any) => {
    return !!(field.LookupEnumeration || field.LookupBitEnumeration || field.LookupFieldTypeEnumeration)
  }, [])

  return (
    <Card>
      <CardBody>
        <Row className="mb-3">
          <Col md={6}>
            <Input
              type="text"
              placeholder="Search PGNs by number, name, description, or fields..."
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            />
          </Col>
          <Col md={6}>
            <Input
              type="select"
              value={selectedCategory}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSelectedCategory(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label} ({cat.count})
                </option>
              ))}
            </Input>
          </Col>
        </Row>

        <Row className="mb-3 align-items-center">
          <Col md={6}>
            <small className="text-muted">
              Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredPgns.length)} of{' '}
              {filteredPgns.length} PGNs
              {filteredPgns.length !== allPgns.length && ` (filtered from ${allPgns.length} total)`}
            </small>
          </Col>
          <Col md={6} className="text-end">
            <div className="d-flex align-items-center justify-content-end">
              <small className="text-muted me-2">Per page:</small>
              <Input
                type="select"
                value={pageSize}
                onChange={(e: ChangeEvent<HTMLInputElement>) => handlePageSizeChange(Number(e.target.value))}
                style={{ width: 'auto', display: 'inline-block' }}
                size="sm"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </Input>
            </div>
          </Col>
        </Row>

        <div ref={tableContainerRef} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <Table striped hover size="sm">
            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
              <tr>
                <th style={{ width: '80px' }}>PGN</th>
                <th>Description</th>
                <th style={{ width: '80px' }}>Type</th>
                <th style={{ width: '80px' }}>Status</th>
                <th style={{ width: '80px' }}>Fields</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {paginatedPgns.map((pgn) => (
                <PgnRow
                  key={pgn.Id}
                  pgn={pgn}
                  isExpanded={expandedPgn === pgn.Id}
                  onToggle={togglePgnExpansion}
                  formatPgnNumber={formatPgnNumber}
                  formatFieldType={formatFieldType}
                  getFieldSize={getFieldSize}
                  hasLookupValues={hasLookupValues}
                  showLookupPopup={showLookupPopup}
                />
              ))}
            </tbody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="d-flex justify-content-center mt-3">
            <Pagination>
              <PaginationItem disabled={currentPage === 1}>
                <PaginationLink first onClick={() => setCurrentPage(1)} />
              </PaginationItem>
              <PaginationItem disabled={currentPage === 1}>
                <PaginationLink previous onClick={() => setCurrentPage(currentPage - 1)} />
              </PaginationItem>

              {/* Show page numbers around current page */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startPage = Math.max(1, currentPage - 2)
                const pageNum = startPage + i
                if (pageNum <= totalPages) {
                  return (
                    <PaginationItem key={pageNum} active={currentPage === pageNum}>
                      <PaginationLink onClick={() => setCurrentPage(pageNum)}>{pageNum}</PaginationLink>
                    </PaginationItem>
                  )
                }
                return null
              })}

              <PaginationItem disabled={currentPage === totalPages}>
                <PaginationLink next onClick={() => setCurrentPage(currentPage + 1)} />
              </PaginationItem>
              <PaginationItem disabled={currentPage === totalPages}>
                <PaginationLink last onClick={() => setCurrentPage(totalPages)} />
              </PaginationItem>
            </Pagination>
          </div>
        )}
      </CardBody>

      {/* Lookup Values Modal - Modern Design */}
      <Modal isOpen={lookupModal.isOpen} toggle={closeLookupPopup} size="lg" className="modern-modal">
        <ModalHeader
          className="border-0 pb-2"
          style={{
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            borderRadius: '0.5rem 0.5rem 0 0',
          }}
        >
          <div className="d-flex flex-column w-100">
            <h5 className="mb-2 text-primary">{lookupModal.title}</h5>
            <div className="d-flex align-items-center">
              <Badge color="light" className="text-dark me-2 px-3 py-2" style={{ fontSize: '0.85em' }}>
                Field: {lookupModal.field?.Name}
              </Badge>
              {filteredEnumValues.length !== lookupModal.enumValues?.length && (
                <Badge color="info" className="text-white" style={{ fontSize: '0.75em' }}>
                  {filteredEnumValues.length} of {lookupModal.enumValues?.length} values
                </Badge>
              )}
            </div>
          </div>
        </ModalHeader>
        <ModalBody className="px-4 py-3">
          {lookupModal.enumValues && lookupModal.enumValues.length > 0 ? (
            <>
              {/* Search Bar */}
              {lookupModal.enumValues.length > 5 && (
                <div className="mb-3">
                  <InputGroup size="sm">
                    <InputGroupText className="bg-light border-end-0">
                      <i className="fas fa-search text-muted" style={{ fontSize: '0.8em' }} />
                    </InputGroupText>
                    <Input
                      type="text"
                      placeholder="Search values..."
                      value={modalSearchTerm}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setModalSearchTerm(e.target.value)}
                      className="border-start-0"
                      style={{ fontSize: '0.9em' }}
                    />
                  </InputGroup>
                </div>
              )}

              {/* Values List */}
              <div
                style={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#c1c1c1 #f1f1f1',
                }}
              >
                {filteredEnumValues.length > 0 ? (
                  <div className="d-flex flex-column gap-1">
                    {filteredEnumValues.map((enumValue, index) => (
                      <div
                        key={index}
                        className="d-flex justify-content-between align-items-center px-3 py-2 border rounded"
                        style={{
                          transition: 'all 0.15s ease-in-out',
                          backgroundColor: '#f8f9fa',
                          borderColor: '#e9ecef !important',
                          cursor: 'default',
                          minHeight: '40px',
                        }}
                        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                          const item = e.currentTarget
                          item.style.backgroundColor = '#e3f2fd'
                          item.style.borderColor = '#2196f3'
                          item.style.transform = 'translateX(2px)'
                        }}
                        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                          const item = e.currentTarget
                          item.style.backgroundColor = '#f8f9fa'
                          item.style.borderColor = '#e9ecef'
                          item.style.transform = 'translateX(0)'
                        }}
                      >
                        <div className="flex-grow-1 me-3 min-width-0">
                          <div className="d-flex align-items-center">
                            <span className="fw-medium text-dark me-2" style={{ fontSize: '0.9em' }}>
                              {enumValue.name}
                            </span>
                            {enumValue.description && (
                              <small className="text-muted text-truncate" style={{ fontSize: '0.75em' }}>
                                - {enumValue.description}
                              </small>
                            )}
                          </div>
                        </div>
                        <Badge
                          color="primary"
                          className="text-white fw-medium px-2 py-1 flex-shrink-0"
                          style={{ fontSize: '0.75em', minWidth: '50px' }}
                        >
                          {enumValue.value}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <div className="mb-3">
                      <i className="fas fa-search text-muted" style={{ fontSize: '3em', opacity: 0.3 }} />
                    </div>
                    <h6 className="text-muted mb-2">No values found</h6>
                    <p className="text-muted small mb-0">Try adjusting your search term or clearing the filter</p>
                    {modalSearchTerm && (
                      <Button
                        color="link"
                        size="sm"
                        className="mt-2 text-primary"
                        onClick={() => setModalSearchTerm('')}
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-5">
              <div className="mb-3">
                <i className="fas fa-info-circle text-muted" style={{ fontSize: '3em', opacity: 0.3 }} />
              </div>
              <h6 className="text-muted mb-2">No lookup values available</h6>
              <p className="text-muted small mb-0">This field doesn't have any predefined lookup values.</p>
            </div>
          )}
        </ModalBody>
        <ModalFooter className="border-0 pt-2">
          <div className="d-flex justify-content-between w-100 align-items-center">
            <small className="text-muted">
              {lookupModal.enumValues && lookupModal.enumValues.length > 0 && (
                <>
                  <i className="fas fa-list me-1" />
                  {lookupModal.enumValues.length} total value{lookupModal.enumValues.length !== 1 ? 's' : ''}
                </>
              )}
            </small>
            <Button color="primary" onClick={closeLookupPopup} className="px-4">
              Close
            </Button>
          </div>
        </ModalFooter>
      </Modal>
    </Card>
  )
}

export default PgnBrowser
