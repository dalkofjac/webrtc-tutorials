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
exports.SignalrService = void 0;
const signalr_1 = require("@microsoft/signalr");
const environment_1 = require("../../environments/environment");
class SignalrService {
    constructor() {
        this.baseUrl = environment_1.environment.signalingServerUrl;
    }
    getConnectionId() {
        return this.hubConnection.connectionId;
    }
    connect(path, token = null) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = this.baseUrl + path;
            const builder = new signalr_1.HubConnectionBuilder();
            if (!token) {
                builder.withUrl(url);
            }
            else {
                builder.withUrl(url, {
                    accessTokenFactory: () => {
                        return token;
                    }
                });
            }
            this.hubConnection = builder.withAutomaticReconnect().build();
            return this.hubConnection.start()
                .then(() => {
                if (this.isConnected()) {
                    console.log('SignalR: Connected to the server: ' + url);
                }
            })
                .catch(err => {
                console.error('SignalR: Failed to start with error: ' + err.toString());
            });
        });
    }
    define(methodName, newMethod) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.hubConnection) {
                this.hubConnection.on(methodName, newMethod);
            }
        });
    }
    invoke(methodName, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isConnected()) {
                return this.hubConnection.invoke(methodName, ...args);
            }
        });
    }
    disconnect() {
        if (this.isConnected()) {
            this.hubConnection.stop();
        }
    }
    isConnected() {
        return this.hubConnection && this.hubConnection.state === signalr_1.HubConnectionState.Connected;
    }
}
exports.SignalrService = SignalrService;
//# sourceMappingURL=signalr.service.js.map