/**
 * Platform package entry — Advisor Operating System shared engines.
 * - Module Registry (Sprint 4B.2)
 * - Activity Engine (Sprint 4B.3)
 * - Case Engine (Sprint 4B.4 foundation — TypeScript only, no DB table)
 * - Workflow Engine (Sprint 4B.5 foundation — TypeScript only, no execution)
 * - Document Engine (Sprint 4B.6 foundation — TypeScript only, no storage)
 */

export * from './registry'
export * as activities from './activities'
export * as cases from './cases'
export * as workflows from './workflows'
export * as documents from './documents'
