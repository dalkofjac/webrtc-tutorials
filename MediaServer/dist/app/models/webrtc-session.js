"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebRTCSession = exports.WebRTCClientType = void 0;
const webrtc_client_1 = require("./webrtc-client");
const mixer_1 = require("./mixer");
var WebRTCClientType;
(function (WebRTCClientType) {
    WebRTCClientType["CentralUnit"] = "central_unit";
    WebRTCClientType["SideUnit"] = "side_unit";
})(WebRTCClientType = exports.WebRTCClientType || (exports.WebRTCClientType = {}));
class WebRTCSession {
    constructor(room, signaling) {
        this.room = room;
        this.signaling = signaling;
        this.remoteStreams = [];
        this.clients = [];
        this.start();
    }
    getRoom() {
        return this.room;
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.signaling.isConnected()) {
                const otherClientsInRoom = (yield this.signaling.invoke('CreateOrJoinRoom', this.room, WebRTCClientType.CentralUnit));
                otherClientsInRoom.forEach(client => {
                    this.tryCreateClient(client, false);
                });
            }
            this.defineSignaling();
        });
    }
    defineSignaling() {
        this.signaling.define('log', (message) => {
            console.log(message);
        });
        this.signaling.define('joined', (clientId) => {
            this.tryCreateClient(clientId, true);
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.signaling.define('message', (message, clientId) => {
            const client = this.findClient(clientId);
            if (client) {
                if (message === 'got user media') {
                    client.initiateCall();
                }
                else if (message.type === 'offer') {
                    if (!client.getIsStarted()) {
                        client.initiateCall();
                    }
                    client.setRemoteDescription(message);
                    client.sendAnswer();
                }
                else if (message.type === 'answer' && client.getIsStarted()) {
                    client.setRemoteDescription(message);
                }
                else if (message.type === 'candidate' && client.getIsStarted()) {
                    client.addIceCandidate(message);
                }
                else if (message.type === 'streams removed' && client.getIsStarted()) {
                    const streamIds = message.streams;
                    streamIds.forEach((streamId) => {
                        client.removeRemoteStream(streamId);
                    });
                    this.removeRemoteStreams(client.getClientId(), streamIds);
                }
                else if (message === 'bye' && client.getIsStarted()) {
                    client.handleRemoteHangup();
                }
            }
        });
    }
    findClient(clientId) {
        var _a;
        return (_a = this.clients) === null || _a === void 0 ? void 0 : _a.filter(c => c.getClientId() === clientId)[0];
    }
    tryCreateClient(clientId, initiator) {
        if (!this.findClient(clientId)) {
            const client = new webrtc_client_1.WebRTCClient(clientId, initiator, (message) => this.sendMessage(message, clientId), (remoteStream) => this.addRemoteStream(clientId, remoteStream), () => this.removeClient(clientId), () => this.remoteStreams);
            this.clients.push(client);
        }
    }
    addRemoteStream(clientId, stream) {
        if (!this.remoteStreams.find(s => s.id === stream.id)) {
            this.remoteStreams.push(stream);
            if (this.remoteStreams.length == 2) {
                this.mixer = new mixer_1.MultiStreamsMixer(this.remoteStreams);
                this.mixer.appendStreams(this.remoteStreams);
                this.mixer.startDrawingFrames();
            }
            if (this.mixer) {
                this.clients.forEach(client => {
                    const remoteStream = this.mixer.getMixedStream();
                    if (remoteStream && remoteStream.getVideoTracks()) {
                        client.addRemoteTracks(remoteStream);
                    }
                });
            }
        }
    }
    removeRemoteStreams(clientId, streamIds) {
        this.remoteStreams = this.remoteStreams.filter(s => !streamIds.find(i => i === s.id));
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
    removeClient(clientId) {
        const clientToRemove = this.clients.find(c => c.getClientId() === clientId);
        this.clients = this.clients.filter(c => c !== clientToRemove);
        this.removeRemoteStreams(clientId, clientToRemove.getStreams().map(s => s.id));
    }
    sendMessage(message, client = null) {
        this.signaling.invoke('SendMessage', message, this.room, client);
    }
}
exports.WebRTCSession = WebRTCSession;
//# sourceMappingURL=webrtc-session.js.map