import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { WebRTCClientType } from 'src/app/models/webrtc-client-type';
import { SignalrService } from 'src/app/services/signalr.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  room: string;
  mode = 'Peer-to-Peer';
  clientType: WebRTCClientType = WebRTCClientType.CentralUnit;

  modes: string[] = ['Peer-to-Peer', 'Mesh Conference Call', 'Star Conference Call', 'SFU Conference Call', 'MCU Conference Call'];
  clientTypes: WebRTCClientType[] = [WebRTCClientType.CentralUnit, WebRTCClientType.SideUnit];

  constructor(
    private router: Router,
    private signaling: SignalrService
  ) { }

  ngOnInit(): void {
    this.signaling.connect('/auth', false).then(() => {
      if (this.signaling.isConnected()) {
        this.signaling.invoke('Authorize').then((token: string) => {
          if (token) {
            sessionStorage.setItem('token', token);
          }
        });
      }
    });
  }

  startSessionCall(): void {
    switch (this.mode) {
      case 'Peer-to-Peer':
        this.router.navigate(['session-call/' + this.room]);
        break;
      case 'Mesh Conference Call':
        this.router.navigate(['session-call/mesh/' + this.room]);
        break;
      case 'Star Conference Call':
        this.router.navigate(['session-call/star/' + this.room + '/' + this.clientType]);
        break;
      case 'SFU Conference Call':
        this.router.navigate(['session-call/sfu/' + this.room]);
        break;
      case 'MCU Conference Call':
        this.router.navigate(['session-call/mcu/' + this.room]);
        break;
      default:
        break;
    }
  }
}
