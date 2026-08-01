/** Domain errors, declared once as namespaced maps. Keys become tags. */
import { defineErrors, wire } from 'result-rpc'

export const venueErrors = defineErrors('venue', {
  notFound: { data: wire.object({ venueId: wire.string }), httpStatus: 404 },
  nameTaken: { data: wire.object({ name: wire.string }), httpStatus: 409 },
})

export const venueAwardErrors = defineErrors('venue-award', {
  notFound: { data: wire.object({ awardId: wire.string }), httpStatus: 404 },
  exists: { data: wire.object({ venueId: wire.string }), httpStatus: 409 },
})

export const businessErrors = defineErrors('business', {
  notFound: { data: wire.object({ businessId: wire.string }), httpStatus: 404 },
  nameTaken: { data: wire.object({ name: wire.string }), httpStatus: 409 },
})

export const hotelErrors = defineErrors('hotel', {
  notFound: { data: wire.object({ hotelId: wire.string }), httpStatus: 404 },
})

export const contactErrors = defineErrors('contact', {
  notFound: { data: wire.object({ contactId: wire.string }), httpStatus: 404 },
})

export const dealErrors = defineErrors('deal', {
  notFound: { data: wire.object({ dealId: wire.string }), httpStatus: 404 },
})

export const guideErrors = defineErrors('guide', {
  notFound: { data: wire.object({ guideId: wire.string }), httpStatus: 404 },
  noPool: { data: wire.object({ guideId: wire.string }), httpStatus: 422 },
})
