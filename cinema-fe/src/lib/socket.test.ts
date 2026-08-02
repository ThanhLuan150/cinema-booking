import { describe, expect, it } from 'vitest';
import { socket } from './socket';

describe('socket', () => {
  it('does not auto-connect', () => {
    expect(socket.connected).toBe(false);
  });
});
