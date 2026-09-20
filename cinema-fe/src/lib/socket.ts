import { io, type Socket } from 'socket.io-client';
import { CLIENT_EVENT } from './realtimeEvents';

const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/api\/?$/, '');

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
});

// Schedule rooms are the one subscription the client drives, because they are per-showtime: a
// socket joins while a seat grid is on screen and leaves when it isn't. They also have to survive
// a reconnect — socket.io drops all room membership server-side when the connection is lost — so
// the ids currently wanted are kept here and re-sent on every `connect`.
const joinedSchedules = new Set<string>();

socket.on('connect', () => {
  joinedSchedules.forEach((scheduleId) => socket.emit(CLIENT_EVENT.SCHEDULE_JOIN, scheduleId));
});

export function joinScheduleRoom(scheduleId: number | string) {
  const id = String(scheduleId);
  joinedSchedules.add(id);
  if (socket.connected) socket.emit(CLIENT_EVENT.SCHEDULE_JOIN, id);
}

export function leaveScheduleRoom(scheduleId: number | string) {
  const id = String(scheduleId);
  joinedSchedules.delete(id);
  if (socket.connected) socket.emit(CLIENT_EVENT.SCHEDULE_LEAVE, id);
}

// Test seam: the module-level set outlives a single test, so suites that assert on rejoin
// behaviour can start from a clean slate.
export function __resetScheduleRooms() {
  joinedSchedules.clear();
}
