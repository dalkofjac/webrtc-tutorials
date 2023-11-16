export const environment = {
  production: true,
  signalingServerUrl: 'https://az204webapi.azurewebsites.net/hubs',
  iceServers: [
    {urls: 'stun:stun.1.google.com:19302'},
    {urls: 'stun:stun1.l.google.com:19302'}
  ]
};
