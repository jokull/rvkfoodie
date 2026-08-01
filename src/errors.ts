/** Domain errors, declared once as namespaced maps. Keys become tags. */
import { defineErrors, wire } from 'result-rpc'

export const venueErrors = defineErrors('venue', {
  notFound: { data: wire.object({ venueId: wire.string }), httpStatus: 404 },
  nameTaken: { data: wire.object({ name: wire.string }), httpStatus: 409 },
})

export const hotelErrors = defineErrors('hotel', {
  notFound: { data: wire.object({ hotelId: wire.string }), httpStatus: 404 },
})
