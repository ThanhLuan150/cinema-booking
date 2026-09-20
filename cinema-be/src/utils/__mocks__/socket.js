// Manual mock for utils/socket, used by any suite that calls `jest.mock('../utils/socket')`.
//
// It exists so that adding a new emit helper doesn't silently break every controller/route suite:
// the old per-file `jest.mock(..., () => ({ emitToOwner: jest.fn() }))` factories listed the
// helpers by hand, so a controller reaching for a helper the factory hadn't heard of blew up with
// "emitToBranch is not a function". Here the surface is derived from the real module, so the two
// can never drift.
const actual = jest.requireActual('../socket');

module.exports = Object.fromEntries(Object.keys(actual).map((name) => [name, jest.fn()]));
