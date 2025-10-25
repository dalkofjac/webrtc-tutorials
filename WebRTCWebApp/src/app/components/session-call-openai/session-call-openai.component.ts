// Created according to https://platform.openai.com/docs/guides/realtime-webrtc

import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { SignalrService } from 'src/app/services/signalr.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-session-call-openai',
  templateUrl: './session-call-openai.component.html',
  styleUrl: './session-call-openai.component.scss'
})
export class SessionCallOpenaiComponent implements OnInit, OnDestroy {

  @ViewChild('localVideo') localVideo: ElementRef;
  @ViewChild('remoteVideo') remoteVideo: ElementRef;

  localStream: MediaStream;
  remoteStream: MediaStream;

  room: string;
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel;

  isStarted: boolean;

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

  start(): void {
    // #1 connect to signaling server
    this.signaling.connect('/openai', true);

    // #2 get media from current client
    this.getUserMedia();
  }

  getUserMedia(): void {
    navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    })
    .then((stream: MediaStream) => {
      this.addLocalStream(stream);
      this.initiateCall();
    })
    .catch((e) => {
      alert('getUserMedia() error: ' + e.name + ': ' + e.message);
    });
  }

  initiateCall(): void {
    console.log('Initiating a call.');
    if (!this.isStarted && this.localStream) {
      this.createPeerConnection();

      this.peerConnection.addTrack(this.localStream.getAudioTracks()[0], this.localStream);

      this.isStarted = true;
      this.createDataChannel();
      this.sendOffer();
    }
  }

  createPeerConnection(): void {
    console.log('Creating peer connection.');
    try {
      this.peerConnection = new RTCPeerConnection({
        iceServers: environment.iceServers,
        sdpSemantics: 'unified-plan'
      } as RTCConfiguration);

      this.peerConnection.ontrack = (event: RTCTrackEvent) => {
        if (event.streams[0]) {
          this.addRemoteStream(event.streams[0]);
        }
      };
    } catch (e) {
      console.log('Failed to create PeerConnection.', e.message);
      return;
    }
  }

  sendOffer(): void {
    console.log('Sending offer to peer.');
    this.peerConnection.createOffer()
    .then((sdp: RTCSessionDescriptionInit) => {
      this.peerConnection.setLocalDescription(sdp);
      
      this.signaling.invoke('GenerateSDP', sdp.sdp).then((remoteSdp: string) => {
        if (remoteSdp) {
          this.setAnswer(remoteSdp);
        }
      });
    });
  }

  setAnswer(remoteSdp: string): void {
    console.log('Setting remote peer answer.');
    const answer = {
      type: 'answer',
      sdp: remoteSdp,
    } as RTCSessionDescriptionInit;
    this.peerConnection.setRemoteDescription(answer);
  }

  addLocalStream(stream: MediaStream): void {
    console.log('Local stream added.');
    this.localStream = stream;
    this.localVideo.nativeElement.srcObject = this.localStream;
    this.localVideo.nativeElement.muted = 'muted';
  }

  addRemoteStream(stream: MediaStream): void {
    console.log('Remote stream added.');
    this.remoteStream = stream;
    this.remoteVideo.nativeElement.srcObject = this.remoteStream;
  }

  createDataChannel(): void {
    console.log('Creating data channel.');
    this.dataChannel = this.peerConnection.createDataChannel('openai-events');
    this.dataChannel.addEventListener('message', (e) => {
      const event = JSON.parse(e.data);
      console.log('Received OpenAI event.', event);
    });
  }

  sendDataChannelMessage(message: string): void {
    // Send client events
    const event = {
      type: "conversation.item.create",
      item: {
          type: "message",
          role: "user",
          content: [
              {
                  type: "input_text",
                  text: message,
              },
          ],
      },
    };
    this.dataChannel.send(JSON.stringify(event));
  }

  hangup(): void {
    console.log('Hanging up.');
    this.stopPeerConnection();
    setTimeout(() => {
      this.signaling.disconnect();
    }, 1000);
  }

  stopPeerConnection(): void {
    this.isStarted = false;
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  ngOnDestroy(): void {
    this.hangup();
    if (this.localStream && this.localStream.active) {
      this.localStream.getTracks().forEach((track) => { track.stop(); });
    }
    if (this.remoteStream && this.remoteStream.active) {
      this.remoteStream.getTracks().forEach((track) => { track.stop(); });
    }
  }
}
