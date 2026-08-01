/**
 * Entity models, checked against the Drizzle row types, plus the one-off
 * aggregate around them. The Venue entity is the payoff: every feed row is
 * the SAME entity, so a mutation that returns a Venue (add, setStatus)
 * patches every cached occurrence in place — no refetch, no page splicing.
 */
import { defineModel, wire, type InputOf, type ModelValue } from 'result-rpc'
import type { hotels, venues } from './schema.js'

export const Venue = defineModel('venue', {
  key: 'id',
  shape: {
    id: wire.string,
    name: wire.string,
    category: wire.string,
    neighborhood: wire.string,
    status: wire.string,
  },
}).$satisfies<typeof venues.$inferSelect>()
export type VenueRow = ModelValue<typeof Venue>

export const Hotel = defineModel('hotel', {
  key: 'id',
  shape: {
    id: wire.string,
    name: wire.string,
    roomCount: wire.number,
    pipelineStage: wire.string,
  },
}).$satisfies<typeof hotels.$inferSelect>()
export type HotelRow = ModelValue<typeof Hotel>

/** One-off aggregate — no entity identity, kept fresh via `.affects()`. */
export const OverviewCodec = wire.object({
  venueCount: wire.number,
  liveVenueCount: wire.number,
  hotelCount: wire.number,
})
export type Overview = InputOf<typeof OverviewCodec>
