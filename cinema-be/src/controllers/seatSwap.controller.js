const seatSwapService = require('../services/seatSwap.service');

const { SeatSwapError } = seatSwapService;

// Domain refusals carry context (the price quote, the seat codes, the policy) that the generic
// errorHandler would drop, so they are answered here; anything else goes on to errorHandler.
function withSeatSwapErrors(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (!(err instanceof SeatSwapError)) throw err;
      res.status(err.status).json({ message: err.message, code: err.code, ...err.extra });
    }
  };
}

const callerOf = (req) => ({ accountId: req.account.accountId, scope: req.permissionScope });

// GET /api/tickets/:id/seat-swap -> may this ticket change seat (and if not, why), under which policy,
// and the seat + showtime it is on now.
async function options(req, res) {
  res.json(await seatSwapService.getSwapOptions({ invoiceId: req.params.id, caller: callerOf(req) }));
}

// POST /api/tickets/:id/seat-swap/quote { seat_code } -> availability + backend-priced difference,
// without changing anything.
async function quote(req, res) {
  res.json(await seatSwapService.quoteSwap({ invoiceId: req.params.id, caller: callerOf(req), body: req.body }));
}

// POST /api/tickets/:id/seat-swap { seat_code } -> moves the ticket to the new seat.
async function swap(req, res) {
  res.json(
    await seatSwapService.swapSeat({ invoiceId: req.params.id, caller: callerOf(req), body: req.body, req }),
  );
}

module.exports = {
  options: withSeatSwapErrors(options),
  quote: withSeatSwapErrors(quote),
  swap: withSeatSwapErrors(swap),
};
