export const environment = {
  production: true,
  signalingServerUrl: 'http://localhost:5000/hubs',
  iceServers: [
    {urls: 'stun:stun.1.google.com:19302'},
    {urls: 'stun:stun1.l.google.com:19302'}
  ]
};
