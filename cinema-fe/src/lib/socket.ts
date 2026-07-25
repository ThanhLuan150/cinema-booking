import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/api\/?$/, '');

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
});
