/**
 * The typed graphql() for the agent-cms schema — gql.tada with the live
 * introspected SDL (lib/graphql-schema.graphql). Custom scalars map to
 * their runtime JSON shapes: DAST trees are JSON blobs, ids are strings.
 */
import { initGraphQLTada } from 'gql.tada'
import type { introspection } from '../lib/graphql-env.d.ts'
import type { Json } from './cms-types.js'

export const graphql = initGraphQLTada<{
  introspection: introspection
  scalars: {
    JSON: Json
    ItemId: string
    SiteLocale: string
  }
}>()

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada'
export { readFragment } from 'gql.tada'
