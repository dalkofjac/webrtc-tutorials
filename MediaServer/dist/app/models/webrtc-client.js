"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebRTCClient = void 0;
const environment_1 = require("../../environments/environment");
const wrtc_1 = require("wrtc");
class WebRTCClient {
    constructor(clientId, isInitiator, sendMessageCallback, onStreamCallback, onHangupCallback, remoteStreamsCallback = () => { return null; }) {
        this.clientId = clientId;
        this.isInitiator = isInitiator;
        this.sendMessageCallback = sendMessageCallback;
        this.onStreamCallback = onStreamCallback;
        this.onHangupCallback = onHangupCallback;
        this.remoteStreamsCallback = remoteStreamsCallback;
        this.streams = [];
        this.isStarted = false;
    }
    getClientId() {
        return this.clientId;
    }
    getIsInitiator() {
        return this.isInitiator;
    }
    getIsStarted() {
        return this.isStarted;
    }
    getStreams() {
        return this.streams;
    }
    initiateCall() {
        var _a;
        console.log('Initiating a call.', this.clientId);
        if (!this.isStarted) {
            this.createPeerConnection();
            (_a = this.remoteStreamsCallback()) === null || _a === void 0 ? void 0 : _a.forEach(stream => {
                this.peerConnection.addTrack(stream.getVideoTracks()[0], stream);
                this.peerConnection.addTrack(stream.getAudioTracks()[0], stream);
            });
            this.isStarted = true;
            if (this.isInitiator) {
                this.sendOffer();
            }
        }
    }
    createPeerConnection() {
        console.log('Creating peer connection.', this.clientId);
        try {
            this.peerConnection = new wrtc_1.RTCPeerConnection({
                iceServers: environment_1.environment.iceServers,
                sdpSemantics: 'unified-plan'
            });
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.sendIceCandidate(event);
                }
                else {
                    console.log('End of candidates.', this.clientId);
                }
            };
            this.peerConnection.ontrack = (event) => {
                if (event.streams[0]) {
                    this.addRemoteStream(event.streams[0]);
                }
            };
        }
        catch (e) {
            console.log('Failed to create PeerConnection.', this.clientId, e.message);
            return;
        }
    }
    sendOffer() {
        console.log('Sending offer to peer.', this.clientId);
        this.addTransceivers();
        this.peerConnection.createOffer()
            .then((sdp) => {
            this.peerConnection.setLocalDescription(sdp);
            this.sendMessageCallback(sdp);
        });
    }
    sendAnswer() {
        console.log('Sending answer to peer.', this.clientId);
        this.addTransceivers();
        this.peerConnection.createAnswer()
            .then((sdp) => {
            this.peerConnection.setLocalDescription(sdp);
            this.sendMessageCallback(sdp);
        });
    }
    addIceCandidate(message) {
        console.log('Adding ice candidate.', this.clientId);
        const candidate = new wrtc_1.RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate,
            sdpMid: message.id
        });
        this.peerConnection.addIceCandidate(candidate);
    }
    sendIceCandidate(event) {
        console.log('Sending ice candidate to remote peer.', this.clientId);
        this.sendMessageCallback({
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
        });
    }
    setRemoteDescription(message) {
        console.log('Setting remote description.', this.clientId);
        this.peerConnection.setRemoteDescription(new wrtc_1.RTCSessionDescription(message));
    }
    addTransceivers() {
        console.log('Adding transceivers.', this.clientId);
        const init = { direction: 'recvonly', streams: [], sendEncodings: [] };
        this.peerConnection.addTransceiver('audio', init);
        this.peerConnection.addTransceiver('video', init);
    }
    addRemoteStream(stream) {
        console.log('Adding remote stream.', this.clientId);
        if (!this.streams.find(s => s.id === stream.id)) {
            this.streams.push(stream);
            this.onStreamCallback(stream);
        }
    }
    addRemoteTracks(stream) {
        console.log('Adding remote tracks.', this.clientId);
        this.peerConnection.addTrack(stream.getVideoTracks()[0], stream);
        this.peerConnection.addTrack(stream.getAudioTracks()[0], stream);
        // todo: uncomment later
        // this.peerConnection.addTrack(stream.getAudioTracks()[0], stream);
        this.sendOffer();
    }
    removeRemoteStream(streamId) {
        console.log('Removing remote stream.', this.clientId);
        const streamToRemove = this.streams.find(s => s.id === streamId);
        this.streams = this.streams.filter(s => s !== streamToRemove);
        streamToRemove.getTracks().forEach((track) => { track.stop(); });
    }
    handleRemoteHangup() {
        console.log('Session terminated by remote peer.', this.clientId);
        this.stopPeerConnection();
        this.onHangupCallback();
    }
    stopPeerConnection() {
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
exports.WebRTCClient = WebRTCClient;
//# sourceMappingURL=webrtc-client.js.map