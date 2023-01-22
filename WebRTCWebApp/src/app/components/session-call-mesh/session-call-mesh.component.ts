import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { WebRTCClient } from 'src/app/models/webrtc-client';
import { SignalrService } from 'src/app/services/signalr.service';

@Component({
  selector: 'app-session-call-mesh',
  templateUrl: './session-call-mesh.component.html',
  styleUrls: ['./session-call-mesh.component.scss']
})
export class SessionCallMeshComponent implements OnInit, OnDestroy {

  @ViewChild('localVideo') localVideo: ElementRef;

  localStream: MediaStream;
  room: string;
  clients: WebRTCClient[] = [];

  constructor(
    private snack: MatSnackBar,
    private route: ActivatedRoute,
    private signaling: SignalrService
  ) {
    this.route.paramMap.subscribe(async param => {
      this.room = param['params']['room'];
    });
  }

  ngOnInit(): void {
    this.start();
  }

  async start(): Promise<void> {
    // #1 connect to signaling server
    this.signaling.connect('/mesh-signaling', true).then(async () => {
      if (this.signaling.isConnected()) {
        const otherClientsInRoom = (await this.signaling.invoke('CreateOrJoinRoom', this.room)) as string[];
        otherClientsInRoom.forEach(client => {
          this.tryCreateClient(client, false);
        });
      }
    });

    // #2 define signaling communication
    this.defineSignaling();

    // #3 get media from current client
    this.getUserMedia();
  }

  defineSignaling(): void {
    this.signaling.define('log', (message: any) => {
      console.log(message);
    });

    this.signaling.define('joined', (clientId: string) => {
      this.tryCreateClient(clientId, true);
    });

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
  
        } else if (message === 'bye' && client.getIsStarted()) {
          client.handleRemoteHangup();
        }
      }
    });
  }

  getUserMedia(): void {
    navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    })
    .then((stream: MediaStream) => {
      this.addLocalStream(stream);
      this.sendMessage('got user media');
      this.clients.forEach(client => {
        if (client.getIsInitiator()) {
          client.initiateCall();
        }
      });
    })
    .catch((e) => {
      alert('getUserMedia() error: ' + e.name + ': ' + e.message);
    });
  }

  findClient(clientId: string): WebRTCClient {
    return this.clients?.filter(c => c.getClientId() === clientId)[0];
  }

  tryCreateClient(clientId: string, initiator: boolean): void {
    if (!this.findClient(clientId)) {
      const client = new WebRTCClient(clientId, initiator,
        (message: any) => this.sendMessage(message, clientId),
        (message: string) => this.snack.open(message, 'Dismiss', { duration: 5000 }),
        (remoteStream: MediaStream) => this.addRemoteStream(clientId, remoteStream),
        () => this.removeClient(clientId),
        () => { return this.localStream });

      this.clients.push(client);
    }
  }

  removeClient(clientId: string): void {
    this.clients = this.clients.filter(c => c.getClientId() !== clientId);
    this.removeRemoteStream(clientId);
  }

  sendMessage(message: any, client: string = null): void {
    this.signaling.invoke('SendMessage', message, this.room, client);
  }

  addLocalStream(stream: MediaStream): void {
    console.log('Local stream added.');
    this.localStream = stream;
    this.localVideo.nativeElement.srcObject = this.localStream;
    this.localVideo.nativeElement.muted = 'muted';
  }

  addRemoteStream(clientId: string, stream: MediaStream): void {
    console.log('Remote stream added.');
    const videoElementId = "remoteVideo-" + clientId;
    if (!document.getElementById(videoElementId)) {
      const videosDiv = document.getElementById('all-videos');
      const remoteVideo = document.createElement('video');
      remoteVideo.id = videoElementId;
      remoteVideo.srcObject = stream;
      remoteVideo.autoplay = true;
      remoteVideo.controls = true;
      remoteVideo.muted = true;
      videosDiv.appendChild(remoteVideo);
    }
  }

  removeRemoteStream(clientId: string): void {
    console.log('Remote stream removed.');
    const videoElement = document.getElementById("remoteVideo-" + clientId)
    if (videoElement) {
      videoElement.parentNode.removeChild(videoElement);
    }
  }

  hangup(): void {
    console.log('Hanging up.');
    this.clients.forEach(client => {
      client.stopPeerConnection();
    });
    this.sendMessage('bye');
    this.signaling.invoke('LeaveRoom', this.room);
    setTimeout(() => {
      this.signaling.disconnect();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.hangup();
    if (this.localStream && this.localStream.active) {
      this.localStream.getTracks().forEach((track) => { track.stop(); });
    }
  }
}
