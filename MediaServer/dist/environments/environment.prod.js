"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.environment = void 0;
exports.environment = {
    production: true,
    signalingServerUrl: 'http://localhost:5000/hubs',
    iceServers: [
        { urls: 'stun:stun.1.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};
//# sourceMappingURL=environment.prod.js.map