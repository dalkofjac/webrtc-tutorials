import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, IHttpConnectionOptions } from '@microsoft/signalr';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SignalrService {

  private baseUrl: string = environment.signalingServerUrl;

  private hubConnection: HubConnection | undefined;

  constructor() { }

  getConnectionId(): string {
    return this.hubConnection.connectionId;
  }

  async connect(path: string, withToken: boolean): Promise<void> {
    const url = this.baseUrl + path;

    const builder = new HubConnectionBuilder();
    if (!withToken) {
      builder.withUrl(url);
    } else {
      builder.withUrl(url, {
        accessTokenFactory: () => {
          return sessionStorage.getItem('token');
        }
      } as IHttpConnectionOptions);
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
  }

  async define(methodName: string, newMethod: (...args: any[]) => void): Promise<void> {
    if (this.hubConnection) {
      this.hubConnection.on(methodName, newMethod);
    }
  }

  async invoke(methodName: string, ...args: any[]): Promise<any> {
    if (this.isConnected()) {
      return this.hubConnection.invoke(methodName, ...args);
    }
  }

  disconnect(): void {
    if (this.isConnected()) {
      this.hubConnection.stop();
    }
  }

  isConnected(): boolean {
    return this.hubConnection && this.hubConnection.state === HubConnectionState.Connected;
  }
}
