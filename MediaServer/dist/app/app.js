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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const webrtc_session_1 = require("./models/webrtc-session");
const signalr_service_1 = require("./services/signalr.service");
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
const sessions = [];
const authSignaling = new signalr_service_1.SignalrService();
const sfuSignaling = new signalr_service_1.SignalrService();
const mcuSignaling = new signalr_service_1.SignalrService();
app.get('/', (req, res) => {
    res.send('The WebRTC media server is running.');
});
app.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
});
authSignaling.connect('/auth').then(() => {
    if (authSignaling.isConnected()) {
        authSignaling.invoke('Authorize').then((token) => {
            if (token) {
                sfuSignaling.connect('/sfu-signaling', token).then(() => __awaiter(void 0, void 0, void 0, function* () {
                    if (sfuSignaling.isConnected()) {
                        sfuSignaling.define('room created', (room) => {
                            if (!sessions.find(s => s.getRoom() === room)) {
                                const newSession = new webrtc_session_1.WebRTCSession(room, sfuSignaling);
                                sessions.push(newSession);
                            }
                        });
                    }
                }));
                mcuSignaling.connect('/mcu-signaling', token).then(() => __awaiter(void 0, void 0, void 0, function* () {
                    if (mcuSignaling.isConnected()) {
                        mcuSignaling.define('room created', (room) => {
                            if (!sessions.find(s => s.getRoom() === room)) {
                                const newSession = new webrtc_session_1.WebRTCSession(room, mcuSignaling, true);
                                sessions.push(newSession);
                            }
                        });
                    }
                }));
            }
        });
    }
});
//# sourceMappingURL=app.js.map