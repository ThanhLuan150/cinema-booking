const { calculateParkingFee, PARKING_RATES } = require('./parkingFee');

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

function at(base, ms) {
  return new Date(base.getTime() + ms);
}

describe('calculateParkingFee', () => {
  const entry = new Date('2026-09-10T08:00:00Z');

  it('charges the first block for any stay within the first hour', () => {
    expect(calculateParkingFee({ entryAt: entry, exitAt: at(entry, 10 * MIN), vehicleType: 'CAR' }).fee).toBe(
      PARKING_RATES.CAR.firstBlockFee,
    );
    expect(calculateParkingFee({ entryAt: entry, exitAt: at(entry, 60 * MIN), vehicleType: 'CAR' }).fee).toBe(
      PARKING_RATES.CAR.firstBlockFee,
    );
  });

  it('adds one hourly charge per started hour after the first', () => {
    const { CAR } = PARKING_RATES;
    // 1h01m -> first block + 1 started hour
    expect(calculateParkingFee({ entryAt: entry, exitAt: at(entry, 61 * MIN), vehicleType: 'CAR' }).fee).toBe(
      CAR.firstBlockFee + CAR.hourlyFee,
    );
    // exactly 3h -> first block + 2 hours
    expect(calculateParkingFee({ entryAt: entry, exitAt: at(entry, 3 * HOUR), vehicleType: 'CAR' }).fee).toBe(
      CAR.firstBlockFee + 2 * CAR.hourlyFee,
    );
  });

  it('applies the per-24h cap', () => {
    // A very long single-day-ish stay must not exceed dailyCap * ceil(days).
    const { MOTORBIKE } = PARKING_RATES;
    const result = calculateParkingFee({ entryAt: entry, exitAt: at(entry, 20 * HOUR), vehicleType: 'MOTORBIKE' });
    expect(result.fee).toBe(MOTORBIKE.dailyCap);
    expect(result.days).toBe(1);
  });

  it('caps a multi-day stay at dailyCap per started day', () => {
    const { CAR } = PARKING_RATES;
    const result = calculateParkingFee({ entryAt: entry, exitAt: at(entry, 25 * HOUR), vehicleType: 'CAR' });
    expect(result.days).toBe(2);
    expect(result.fee).toBe(CAR.dailyCap * 2);
  });

  it('bills a non-positive stay as the minimum one block', () => {
    expect(calculateParkingFee({ entryAt: entry, exitAt: entry, vehicleType: 'CAR' }).fee).toBe(
      PARKING_RATES.CAR.firstBlockFee,
    );
    // small clock skew (exit a few seconds before entry) is tolerated
    expect(calculateParkingFee({ entryAt: entry, exitAt: at(entry, -5000), vehicleType: 'CAR' }).fee).toBe(
      PARKING_RATES.CAR.firstBlockFee,
    );
  });

  it('falls back to the OTHER rate for an unknown vehicle type', () => {
    expect(calculateParkingFee({ entryAt: entry, exitAt: at(entry, 30 * MIN), vehicleType: 'SPACESHIP' }).fee).toBe(
      PARKING_RATES.OTHER.firstBlockFee,
    );
  });

  it('defaults exitAt to now when omitted', () => {
    const recent = new Date(Date.now() - 20 * MIN);
    const result = calculateParkingFee({ entryAt: recent, vehicleType: 'CAR' });
    expect(result.fee).toBe(PARKING_RATES.CAR.firstBlockFee);
  });

  it('throws on unparseable or badly reversed timestamps', () => {
    expect(() => calculateParkingFee({ entryAt: 'nope', vehicleType: 'CAR' })).toThrow();
    expect(() => calculateParkingFee({ entryAt: entry, exitAt: 'nope', vehicleType: 'CAR' })).toThrow();
    expect(() => calculateParkingFee({ entryAt: entry, exitAt: at(entry, -10 * MIN), vehicleType: 'CAR' })).toThrow();
  });
});
