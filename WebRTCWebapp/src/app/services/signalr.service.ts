import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, IHttpConnectionOptions } from '@microsoft/signalr';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SignalrService {

  url: string = environment.signalingServerUrl;

  hubConnection: HubConnection | undefined;

  constructor() { }

  async connect(initMessage: string, room: string): Promise<void> {
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(this.url)
      .withAutomaticReconnect()
      .build();

    this.hubConnection.start()
      .then(() => {
        if(this.isConnected()) {
          console.log('SignalR: Connected to the server: ' + this.url);
          if(initMessage && room) {
            this.invoke(initMessage, room);
          }
        }
      })
      .catch(err => {
        console.error('SignalR: Failed to start with error: ' + err.toString());
      });
  }

  async define(methodName: string, newMethod: (...args: any[]) => void): Promise<void> {
    if (this.hubConnection) {
      this.hubConnection.on(methodName, newMethod);
    }
  }

  async invoke(methodName: string, ...args: any[]): Promise<void> {
    if (this.isConnected()) {
      this.hubConnection.invoke(methodName, ...args);
    }
  }

  disconnect() {
    if (this.isConnected()) {
      this.hubConnection.stop();
    }
  }

  private isConnected() {
    return this.hubConnection && this.hubConnection.state === HubConnectionState.Connected;
  }
}
