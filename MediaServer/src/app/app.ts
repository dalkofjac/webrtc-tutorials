import express from 'express';
import { WebRTCSession } from './models/webrtc-session';
import { SignalrService } from './services/signalr.service';

const app = express();
const port = 3000;
const sessions: WebRTCSession[] = [];
const signaling = new SignalrService();

app.get('/', (req, res) => {
  res.send('The WebRTC media server is running.');
});

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});

signaling.connect('/auth').then(() => {
  if (signaling.isConnected()) {
    signaling.invoke('Authorize').then((token: string) => {
      if (token) {
        signaling.connect('/sfu-signaling', token).then(async () => {
          if (signaling.isConnected()) {
            signaling.define('room created', (room: string) => {
              if (!sessions.find(s => s.getRoom() === room)) {
                const newSession = new WebRTCSession(room, signaling);
                sessions.push(newSession);
              }
            });
          }
        });
      }
    });
  }
});

