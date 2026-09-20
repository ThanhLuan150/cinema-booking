import { describe, expect, it, vi, beforeEach, type MockInstance } from 'vitest';
import { socket, joinScheduleRoom, leaveScheduleRoom, __resetScheduleRooms } from './socket';

describe('socket', () => {
  it('does not auto-connect', () => {
    expect(socket.connected).toBe(false);
  });
});

// The rejoin-on-reconnect behaviour lives in socket.io's own `connect` listener, so the test
// runs the registered handlers directly rather than faking a transport round trip.
function fireConnect() {
  (socket as unknown as { listeners: (event: string) => Array<() => void> })
    .listeners('connect')
    .forEach((handler) => handler());
}

describe('schedule rooms', () => {
  let emitSpy: MockInstance<typeof socket.emit>;

  beforeEach(() => {
    __resetScheduleRooms();
    emitSpy = vi.spyOn(socket, 'emit').mockImplementation(() => socket);
    Object.defineProperty(socket, 'connected', { value: true, configurable: true });
  });

  it('asks the server to join and leave a showtime room', () => {
    joinScheduleRoom(42);
    expect(emitSpy).toHaveBeenCalledWith('schedule:join', '42');

    leaveScheduleRoom(42);
    expect(emitSpy).toHaveBeenCalledWith('schedule:leave', '42');
  });

  // A disconnected socket has nothing to emit to, but the id still has to be remembered so the
  // reconnect handler can re-join it.
  it('remembers a room joined while offline and sends it on connect', () => {
    Object.defineProperty(socket, 'connected', { value: false, configurable: true });
    joinScheduleRoom(7);
    expect(emitSpy).not.toHaveBeenCalled();

    Object.defineProperty(socket, 'connected', { value: true, configurable: true });
    fireConnect();

    expect(emitSpy).toHaveBeenCalledWith('schedule:join', '7');
  });

  // Server-side room membership is lost on every reconnect, so a room the page has since left
  // must not come back.
  it('does not re-join a room that was left', () => {
    joinScheduleRoom(7);
    leaveScheduleRoom(7);
    emitSpy.mockClear();

    fireConnect();

    expect(emitSpy).not.toHaveBeenCalledWith('schedule:join', '7');
  });
});
