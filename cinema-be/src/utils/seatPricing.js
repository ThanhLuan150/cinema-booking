// Multiplier applied to Schedule.price for each seat type.
const SEAT_TYPE_PRICE_MULTIPLIER = {
  0: 1, // regular
  1: 1.2, // vip
  2: 1.5, // couple
};

function priceForSeatType(basePrice, seatType) {
  const multiplier = SEAT_TYPE_PRICE_MULTIPLIER[seatType] ?? 1;
  return Math.round(basePrice * multiplier);
}

module.exports = { SEAT_TYPE_PRICE_MULTIPLIER, priceForSeatType };
