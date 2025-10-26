// Created according to https://platform.openai.com/docs/guides/realtime-webrtc

import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { SignalrService } from 'src/app/services/signalr.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-session-call-openai',
  templateUrl: './session-call-openai.component.html',
  styleUrl: './session-call-openai.component.scss'
})
export class SessionCallOpenaiComponent implements OnInit, OnDestroy {

  @ViewChild('localVideo') localVideo: ElementRef;
  @ViewChild('remoteAudio') remoteAudio: ElementRef;

  pageTitle = 'Chat with OpenAI';
  backgroundColor = '#ffffff';
  transcription = 'Unmute the mic and start the conversation!';

  localStream: MediaStream;
  remoteStream: MediaStream;

  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel;

  isStarted: boolean;
  isMicActive: boolean = false;

  constructor(
    private signaling: SignalrService
  ) {
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
      this.activateMic(this.isMicActive);

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
    this.remoteAudio.nativeElement.srcObject = this.remoteStream;
  }

  createDataChannel(): void {
    console.log('Creating data channel.');
    this.dataChannel = this.peerConnection.createDataChannel('openai-events');
    this.dataChannel.onopen = () => this.defineFunctions();
    this.dataChannel.addEventListener('message', (e) => this.handleMessage(e));
  }

  defineFunctions(): void {
    console.log('Defining OpenAI functions.');
    const event = {
      type: 'session.update',
      session: {
        type: "realtime",
        tools: [{
          type: 'function',
          name: 'change_page_title',
          description: 'Change the title of this HTML page.',
          parameters: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: 'The page title.'
                }
            },
            required: ['title']
          }
        }, {
          type: 'function',
          name: 'change_page_background_color',
          description: 'Change the background color of this HTML page.',
          parameters: {
            type: 'object',
            properties: {
                color: {
                    type: 'string',
                    description: 'The RGB code for HTML page background color, e.g. #ffffff for white.'
                }
            },
            required: ['color']
          }
        }],
        tool_choice: 'auto'
      }
    };
    this.dataChannel.send(JSON.stringify(event));
  }

  handleMessage(e: any): void {
    const event = JSON.parse(e.data);
    console.log('Received OpenAI event.', event);

    // Check if the response contains the transcript
    if (event?.response?.output?.[0]?.content?.[0]?.transcript) {
      const transcript = event.response.output[0].content[0].transcript;
      console.log('Transcript:', transcript);

      // Update your transcription variable
      this.transcription = transcript;
    }

    // Only handle final responses with function calls
    if (event.type === 'response.done' && event.response?.output?.length) {
      for (const item of event.response.output) {
        if (item.type === 'function_call') {
          const name = item.name;
          let args: any = {};

          try {
            args = JSON.parse(item.arguments);
          } catch (err) {
            console.error('Failed to parse function arguments:', err);
          }

          // Handle function calls
          switch (name) {
            case 'change_page_title':
              if (args.title) {
                this.pageTitle = args.title;
                this.confirmFunctionCall(item.call_id, `Title changed to "${args.title}"`);
              }
              break;

            case 'change_page_background_color':
              if (args.color) {
                this.backgroundColor = args.color;
                this.confirmFunctionCall(item.call_id, `Background color changed to "${args.color}"`);
              }
              break;

            default:
              console.warn('Unknown function call:', name, args);
          }
        }
      }
    }
  }

  confirmFunctionCall(callId: string, output: string): void {
    console.log('Confirming function call.', callId, output);
    const event = {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: output
      }
    };
    this.dataChannel.send(JSON.stringify(event));
  }

  activateMic(enabled: boolean): void {
    console.log('Setting microphone enabled: ', enabled);
    this.isMicActive = enabled;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
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
