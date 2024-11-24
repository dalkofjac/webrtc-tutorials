import { SignalrService } from "../services/signalr.service";
import { WebRTCClient } from "./webrtc-client";
import { MediaStream } from 'wrtc';
import { MediaStreamMixer } from "./media-stream-mixer";

export enum WebRTCClientType {
  CentralUnit = 'central_unit',
  SideUnit = 'side_unit'
}

export class WebRTCSession {

  remoteStreams: MediaStream[] = [];
  clients: WebRTCClient[] = [];
  mixer: MediaStreamMixer;

  constructor(
    private room: string,
    private signaling: SignalrService,
    private mixStreams = false) {
      if (this.mixStreams) {
        this.mixer = new MediaStreamMixer();
      }
      this.start();
  }

  getRoom(): string {
    return this.room;
  }

  async start(): Promise<void> {
    if (this.signaling.isConnected()) {
      const otherClientsInRoom = (await this.signaling.invoke('CreateOrJoinRoom', this.room, WebRTCClientType.CentralUnit)) as string[];
      otherClientsInRoom.forEach(client => {
        this.tryCreateClient(client, false);
      });
    }

    this.defineSignaling();
  }

  defineSignaling(): void {
    this.signaling.define('log', (message: unknown) => {
      console.log(message);
    });

    this.signaling.define('joined', (clientId: string) => {
      this.tryCreateClient(clientId, true);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.signaling.define('message', (message: any, clientId: string) => {
      const client = this.findClient(clientId);
      if (client) {
        if (message === 'got user media') {
          client.initiateCall();
  
        } else if (message.type === 'offer') {
          if (!client.getIsStarted()) {
            client.initiateCall();
          }
          client.setRemoteDescription(message);
          client.sendAnswer();
  
        } else if (message.type === 'answer' && client.getIsStarted()) {
          client.setRemoteDescription(message);
  
        } else if (message.type === 'candidate' && client.getIsStarted()) {
          client.addIceCandidate(message);
        
        } else if (message.type === 'streams removed' && client.getIsStarted()) {
          const streamIds = message.streams;
          streamIds.forEach((streamId: string) => {
            client.removeRemoteStream(streamId);
          });
          this.removeRemoteStreams(client.getClientId(), streamIds);

        } else if (message === 'bye' && client.getIsStarted()) {
          client.handleRemoteHangup();
        }
      }
    });
  }

  findClient(clientId: string): WebRTCClient {
    return this.clients?.filter(c => c.getClientId() === clientId)[0];
  }

  tryCreateClient(clientId: string, initiator: boolean): void {
    if (!this.findClient(clientId)) {
      const client = new WebRTCClient(clientId, initiator,
        (message: unknown) => this.sendMessage(message, clientId),
        (remoteStream: MediaStream) => this.addRemoteStream(clientId, remoteStream),
        () => this.removeClient(clientId),
        () => this.remoteStreams);

      this.clients.push(client);

      setTimeout(() => {
        if (!client.getIsStarted()) {
          client.initiateCall();
        }
      }, 3000);
    }
  }

  addRemoteStream(clientId: string, stream: MediaStream): void {
    if (!this.remoteStreams.find(s => s.id === stream.id)) {
      this.remoteStreams.push(stream);
      if (this.mixStreams) {
        this.mixer.appendStreams(stream);
        if (this.remoteStreams.length === 1) {
          return;
        } else if (this.remoteStreams.length === 2) {
          this.clients.forEach(client => {
            const mixedStream = this.mixer.getMixedStream();
            if (mixedStream) {
              client.addRemoteTracks(mixedStream);
            }
          });
        } else {
          const client = this.findClient(clientId);
          const mixedStream = this.mixer.getMixedStream();
          if (mixedStream) {
            client.addRemoteTracks(mixedStream);
          }
        }
      } else {
        this.clients.forEach(client => {
          if (clientId !== client.getClientId()) {
            client.addRemoteTracks(stream);
          }
        });
      }
    } else {
      this.clients.forEach(client => {
        if (clientId !== client.getClientId()) {
          client.addRemoteTracks(stream);
        }
      });
    }
  }

  removeRemoteStreams(clientId: string, streamIds: string[]): void {
    this.remoteStreams = this.remoteStreams.filter(s => !streamIds.find(i => i === s.id));
    if (this.mixStreams) {
      this.mixer.removeStreams(streamIds);
    } else {
      this.clients.forEach(client => {
        if (client.getClientId() !== clientId) {
          const message = {
            type: 'streams removed',
            streams: streamIds
          };
          this.sendMessage(message, client.getClientId());
        }
      });
    }

  }

  removeClient(clientId: string): void {
    const clientToRemove = this.clients.find(c => c.getClientId() === clientId);
    this.clients = this.clients.filter(c => c !== clientToRemove);
    this.removeRemoteStreams(clientId, clientToRemove.getStreams().map(s => s.id));
  }

  sendMessage(message: unknown, client: string = null): void {
    this.signaling.invoke('SendMessage', message, this.room, client);
  }
}