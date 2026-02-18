import { io, Socket } from 'socket.io-client';

const URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

export const socket: Socket = io(URL, {
  autoConnect: false,
});
