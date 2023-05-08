import { environment } from "../../environments/environment";
import { IceCandidateMessage } from "./ice-candidate-message";
import { RTCPeerConnection, MediaStream, RTCIceCandidate,
  RTCPeerConnectionIceEvent, RTCRtpTransceiver, RTCSessionDescription } from 'wrtc';

export class WebRTCClient {

  private streams: MediaStream[] = [];
  private peerConnection: RTCPeerConnection;
  private isStarted = false;

  constructor(
    private clientId: string,
    private isInitiator: boolean,
    private sendMessageCallback: (message: unknown) => void,
    private onStreamCallback: (stream: MediaStream) => void,
    private onHangupCallback: () => void,
    private remoteStreamsCallback: () => MediaStream[] = () => { return null; }) {
  }

  getClientId(): string {
    return this.clientId;
  }

  getIsInitiator(): boolean {
    return this.isInitiator;
  }

  getIsStarted(): boolean {
    return this.isStarted;
  }

  getStreams(): MediaStream[] {
    return this.streams;
  }

  initiateCall(): void {
    console.log('Initiating a call.', this.clientId);
    if (!this.isStarted) {
      this.createPeerConnection();

      this.remoteStreamsCallback()?.forEach(stream => {
        this.peerConnection.addTrack(stream.getVideoTracks()[0], stream);
        this.peerConnection.addTrack(stream.getAudioTracks()[0], stream);
      });

      this.isStarted = true;
      if (this.isInitiator) {
        this.sendOffer();
      }
    }
  }

  createPeerConnection(): void {
    console.log('Creating peer connection.', this.clientId);
    try {
      this.peerConnection = new RTCPeerConnection({
        iceServers: environment.iceServers,
        sdpSemantics: 'unified-plan'
      } as RTCConfiguration);

      this.peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          this.sendIceCandidate(event);
        } else {
          console.log('End of candidates.', this.clientId);
        }
      };

      this.peerConnection.ontrack = (event: RTCTrackEvent) => {
        if (event.streams[0]) {
          this.addRemoteStream(event.streams[0]);
        }
      };
    } catch (e) {
      console.log('Failed to create PeerConnection.', this.clientId, e.message);
      return;
    }
  }

  sendOffer(): void {
    console.log('Sending offer to peer.', this.clientId);
    this.addTransceivers();
    this.peerConnection.createOffer()
    .then((sdp: RTCSessionDescription) => {
      this.peerConnection.setLocalDescription(sdp);
      this.sendMessageCallback(sdp);
    });
  }

  sendAnswer(): void {
    console.log('Sending answer to peer.', this.clientId);
    this.addTransceivers();
    this.peerConnection.createAnswer()
    .then((sdp: RTCSessionDescription) => {
      this.peerConnection.setLocalDescription(sdp);
      this.sendMessageCallback(sdp);
    });
  }

  addIceCandidate(message: IceCandidateMessage): void {
    console.log('Adding ice candidate.', this.clientId);
    const candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate,
      sdpMid: message.id
    });
    this.peerConnection.addIceCandidate(candidate);
  }

  sendIceCandidate(event: RTCPeerConnectionIceEvent): void {
    console.log('Sending ice candidate to remote peer.', this.clientId);
    this.sendMessageCallback({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  }
  
  setRemoteDescription(message: RTCSessionDescription) {
    console.log('Setting remote description.', this.clientId);
    this.peerConnection.setRemoteDescription(new RTCSessionDescription(message));
  }

  addTransceivers(): void {
    console.log('Adding transceivers.', this.clientId);
    const init = { direction: 'recvonly', streams: [], sendEncodings: [] } as RTCRtpTransceiver;
    this.peerConnection.addTransceiver('audio', init);
    this.peerConnection.addTransceiver('video', init);
  }

  addRemoteStream(stream: MediaStream): void {
    console.log('Adding remote stream.', this.clientId);
    if (!this.streams.find(s => s.id === stream.id)) {
      this.streams.push(stream);
      this.onStreamCallback(stream);
    }
  }

  addRemoteTracks(stream: MediaStream): void {
    console.log('Adding remote tracks.', this.clientId);
    this.peerConnection.addTrack(stream.getVideoTracks()[0], stream);
    this.peerConnection.addTrack(stream.getAudioTracks()[0], stream);
    this.sendOffer();
  }

  removeRemoteStream(streamId: string): void {
    console.log('Removing remote stream.', this.clientId);
    const streamToRemove = this.streams.find(s => s.id === streamId);
    this.streams = this.streams.filter(s => s !== streamToRemove);
    streamToRemove.getTracks().forEach((track) => { track.stop(); });
  }

  handleRemoteHangup(): void {
    console.log('Session terminated by remote peer.', this.clientId);
    this.stopPeerConnection();
    this.onHangupCallback();
  }

  stopPeerConnection(): void {
    console.log('Stopping peer connection.', this.clientId);
    this.isStarted = false;
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.streams.forEach(stream => {
      if (stream && stream.active) {
        stream.getTracks().forEach((track) => { track.stop(); });
      }
    });
  }
}