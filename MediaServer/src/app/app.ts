import express from 'express';
import { WebRTCSession } from './models/webrtc-session';
import { SignalrService } from './services/signalr.service';

const app = express();
const port = 3000;
const sessions: WebRTCSession[] = [];
const authSignaling = new SignalrService();
const sfuSignaling = new SignalrService();
const mcuSignaling = new SignalrService();

app.get('/', (req, res) => {
  res.send('The WebRTC media server is running.');
});

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});

authSignaling.connect('/auth').then(() => {
  if (authSignaling.isConnected()) {
    authSignaling.invoke('Authorize').then((token: string) => {
      if (token) {
        sfuSignaling.connect('/sfu-signaling', token).then(async () => {
          if (sfuSignaling.isConnected()) {
            sfuSignaling.define('room created', (room: string) => {
              if (!sessions.find(s => s.getRoom() === room)) {
                const newSession = new WebRTCSession(room, sfuSignaling);
                sessions.push(newSession);
              }
            });
          }
        });
        mcuSignaling.connect('/mcu-signaling', token).then(async () => {
          if (mcuSignaling.isConnected()) {
            mcuSignaling.define('room created', (room: string) => {
              if (!sessions.find(s => s.getRoom() === room)) {
                const newSession = new WebRTCSession(room, mcuSignaling, true);
                sessions.push(newSession);
              }
            });
          }
        });
      }
    });
  }
});

