const fs = require('fs');
const path = require('path');
const { REALTIME_EVENT, CLIENT_EVENT, REALTIME_ACTION } = require('./realtimeEvents');

describe('realtimeEvents', () => {
  it('has no two names pointing at the same wire event', () => {
    const wireNames = Object.values(REALTIME_EVENT);
    expect(new Set(wireNames).size).toBe(wireNames.length);
  });

  it('names every event <domain>:<action>', () => {
    for (const name of [...Object.values(REALTIME_EVENT), ...Object.values(CLIENT_EVENT)]) {
      // `unauthorized` is the one exception: it predates the convention and is socket.io-level
      // rather than domain-level.
      if (name === REALTIME_EVENT.UNAUTHORIZED) continue;
      expect(name).toMatch(/^[a-zA-Z]+:[a-zA-Z]+$/);
    }
  });

  // The frontend keeps its own copy (it cannot require a CommonJS module from the app bundle),
  // and a name that drifts is a listener that silently never fires — which no other test would
  // catch, because both sides would still be internally consistent.
  it('is mirrored exactly by the frontend catalogue', () => {
    const mirrorPath = path.join(__dirname, '../../../cinema-fe/src/lib/realtimeEvents.ts');
    if (!fs.existsSync(mirrorPath)) {
      throw new Error(`Frontend realtime event mirror not found at ${mirrorPath}`);
    }

    const source = fs.readFileSync(mirrorPath, 'utf8');
    const mirrored = Object.fromEntries([...source.matchAll(/^ {2}([A-Z_]+): '([^']+)',$/gm)].map((m) => [m[1], m[2]]));

    expect(mirrored).toMatchObject({ ...REALTIME_EVENT, ...CLIENT_EVENT, ...REALTIME_ACTION });
    // And nothing the backend never emits.
    const known = { ...REALTIME_EVENT, ...CLIENT_EVENT, ...REALTIME_ACTION };
    expect(Object.keys(mirrored).filter((key) => !(key in known))).toEqual([]);
  });
});
