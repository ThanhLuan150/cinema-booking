// Pure parking-fee calculation. Kept free of DB access so it can be unit-tested in isolation
// (mirrors services/signagePlayback's pure core) and reused by both the exit and the preview
// paths of parking.controller.
//
// Model: a flat charge for the first block, then a per-hour charge for every started hour
// after that, capped at a per-24h ceiling. Amounts are in VND (the currency the rest of the
// system uses) and always whole numbers.
const PARKING_RATES = {
  CAR: { firstBlockMinutes: 60, firstBlockFee: 30000, hourlyFee: 20000, dailyCap: 200000 },
  MOTORBIKE: { firstBlockMinutes: 60, firstBlockFee: 5000, hourlyFee: 3000, dailyCap: 30000 },
  BICYCLE: { firstBlockMinutes: 60, firstBlockFee: 2000, hourlyFee: 1000, dailyCap: 10000 },
  OTHER: { firstBlockMinutes: 60, firstBlockFee: 20000, hourlyFee: 15000, dailyCap: 150000 },
};

const MINUTE_MS = 60 * 1000;
const DAY_MINUTES = 24 * 60;

function rateFor(vehicleType) {
  return PARKING_RATES[vehicleType] || PARKING_RATES.OTHER;
}

// { entryAt, exitAt?, vehicleType } -> { fee, minutes, hours, days }.
// `exitAt` defaults to now. A non-positive stay (clock skew, instant re-exit) is billed as the
// minimum one block rather than zero. Throws on unparseable / reversed timestamps so the
// caller can turn it into a 400 instead of silently charging a wrong amount.
function calculateParkingFee({ entryAt, exitAt, vehicleType } = {}) {
  const entry = new Date(entryAt);
  if (Number.isNaN(entry.getTime())) {
    throw new Error('entryAt is not a valid date');
  }
  const exit = exitAt === undefined || exitAt === null ? new Date() : new Date(exitAt);
  if (Number.isNaN(exit.getTime())) {
    throw new Error('exitAt is not a valid date');
  }

  const rate = rateFor(vehicleType);
  const rawMs = exit.getTime() - entry.getTime();
  if (rawMs < -MINUTE_MS) {
    throw new Error('exitAt is before entryAt');
  }

  const minutes = rawMs <= 0 ? 1 : Math.ceil(rawMs / MINUTE_MS);
  const hours = Math.ceil(minutes / 60);
  const days = Math.max(1, Math.ceil(minutes / DAY_MINUTES));

  let fee;
  if (minutes <= rate.firstBlockMinutes) {
    fee = rate.firstBlockFee;
  } else {
    const extraHours = Math.ceil((minutes - rate.firstBlockMinutes) / 60);
    fee = rate.firstBlockFee + extraHours * rate.hourlyFee;
  }

  const cap = rate.dailyCap * days;
  fee = Math.min(fee, cap);

  return { fee: Math.round(fee), minutes, hours, days };
}

module.exports = { calculateParkingFee, PARKING_RATES };
