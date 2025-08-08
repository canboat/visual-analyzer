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

import React, { useState, useMemo, ChangeEvent, useCallback, useEffect } from 'react'
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
} from 'reactstrap'
import { getAllPGNs, Definition } from '@canboat/ts-pgns'

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
  }: {
    pgn: Definition
    isExpanded: boolean
    onToggle: (id: string) => void
    formatPgnNumber: (num: number) => string
    formatFieldType: (type?: string) => string
    getFieldSize: (field: any) => string
  }) => (
    <React.Fragment>
      <tr style={{ cursor: 'pointer' }} onClick={() => onToggle(pgn.Id)}>
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
                      {pgn.Fields.map((field, index) => (
                        <tr key={index}>
                          <td>
                            <code>{field.Name}</code>
                          </td>
                          <td>
                            <Badge color="light" className="text-dark" style={{ fontSize: '0.7em' }}>
                              {formatFieldType(field.FieldType)}
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
                      ))}
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
      setExpandedPgn(expandedPgn === pgnId ? null : pgnId)
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

        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
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
    </Card>
  )
}

export default PgnBrowser
