import { environment } from "src/environments/environment";

export enum WebRTCClientType {
  centralUnit = 'central_unit',
  sideUnit = 'side_unit'
}

export class WebRTCClient {

  private stream: MediaStream;
  private peerConnection: RTCPeerConnection;
  private isStarted: boolean = false;

  constructor(
    private clientId: string,
    private clientType: WebRTCClientType | null,
    private isInitiator: boolean,
    private sendMessageCallback: (message: any) => void,
    private notifyUserCallback: (message: string) => void,
    private onStreamCallback: (stream: MediaStream) => void,
    private onHangupCallback: () => void,
    private localStreamCallback: () => MediaStream) {
  }

  getClientId() {
    return this.clientId;
  }

  getClientType() {
    return this.clientType;
  }

  getIsInitiator() {
    return this.isInitiator;
  }

  getIsStarted() {
    return this.isStarted;
  }

  initiateCall(): void {
    console.log('Initiating a call.', this.clientId, this.clientType);
    if (!this.isStarted && this.localStreamCallback()) {
      this.createPeerConnection();

      const localStream = this.localStreamCallback();
      this.peerConnection.addTrack(localStream.getVideoTracks()[0], localStream);
      this.peerConnection.addTrack(localStream.getAudioTracks()[0], localStream);

      this.isStarted = true;
      if (this.isInitiator) {
        this.sendOffer();
      }
    }
  }

  createPeerConnection(): void {
    console.log('Creating peer connection.', this.clientId, this.clientType);
    try {
      this.peerConnection = new RTCPeerConnection({
        iceServers: environment.iceServers,
        sdpSemantics: 'unified-plan'
      } as RTCConfiguration);

      this.peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          this.sendIceCandidate(event);
        } else {
          console.log('End of candidates.', this.clientId, this.clientType);
        }
      };

      this.peerConnection.ontrack = (event: RTCTrackEvent) => {
        if (event.streams[0]) {
          this.addRemoteStream(event.streams[0]);
        }
      };
    } catch (e) {
      console.log('Failed to create PeerConnection.', this.clientId, this.clientType, e.message);
      return;
    }
  }

  sendOffer(): void {
    console.log('Sending offer to peer.', this.clientId, this.clientType);
    this.addTransceivers();
    this.peerConnection.createOffer()
    .then((sdp: RTCSessionDescriptionInit) => {
      this.peerConnection.setLocalDescription(sdp);
      this.sendMessageCallback(sdp);
    });
  }

  sendAnswer(): void {
    console.log('Sending answer to peer.', this.clientId, this.clientType);
    this.addTransceivers();
    this.peerConnection.createAnswer()
    .then((sdp: RTCSessionDescription) => {
      this.peerConnection.setLocalDescription(sdp);
      this.sendMessageCallback(sdp);
    });
  }

  addIceCandidate(message: any): void {
    console.log('Adding ice candidate.', this.clientId, this.clientType);
    const candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    this.peerConnection.addIceCandidate(candidate);
  }

  sendIceCandidate(event: RTCPeerConnectionIceEvent): void {
    console.log('Sending ice candidate to remote peer.', this.clientId, this.clientType);
    this.sendMessageCallback({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  }

  addTransceivers(): void {
    console.log('Adding transceivers.', this.clientId, this.clientType);
    const init = { direction: 'recvonly', streams: [], sendEncodings: [] } as RTCRtpTransceiverInit;
    this.peerConnection.addTransceiver('audio', init);
    this.peerConnection.addTransceiver('video', init);
  }

  addRemoteStream(stream: MediaStream): void {
    console.log('Remote stream added.', this.clientId, this.clientType);
    this.stream = stream;
    this.onStreamCallback(this.stream);
  }

  setRemoteDescription(message: any) {
    console.log('Setting remote description.', this.clientId, this.clientType);
    this.peerConnection.setRemoteDescription(new RTCSessionDescription(message));
  }

  handleRemoteHangup(): void {
    console.log('Session terminated by remote peer.', this.clientId, this.clientType);
    this.stopPeerConnection();
    this.onHangupCallback();
    this.notifyUserCallback('Remote client' + this.clientId + ' of type' + this.clientType + ' has left the call.');
  }

  stopPeerConnection(): void {
    console.log('Stopping peer connection.', this.clientId, this.clientType);
    this.isStarted = false;
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.stream && this.stream.active) {
      this.stream.getTracks().forEach((track) => { track.stop(); });
    }
  }
}