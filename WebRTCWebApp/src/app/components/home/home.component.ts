import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SignalrService } from 'src/app/services/signalr.service';
import { WebRTCClientType } from '../session-call-star/session-call-star.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  room: string;
  mode: string = 'peer-to-peer';
  clientType: WebRTCClientType = WebRTCClientType.centralUnit;

  modes: string[] = ['peer-to-peer', 'mesh conference call', 'star conference call'];
  clientTypes: WebRTCClientType[] = [WebRTCClientType.centralUnit, WebRTCClientType.sideUnit];

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
    switch(this.mode) {
      case 'peer-to-peer':
        this.router.navigate(['session-call/' + this.room]);
        break;
      case 'mesh conference call':
        this.router.navigate(['session-call/mesh/' + this.room]);
        break;
      case 'star conference call':
        this.router.navigate(['session-call/star/' + this.room + '/' + this.clientType]);
        break;
      default:
        break;
    }

  }
}
