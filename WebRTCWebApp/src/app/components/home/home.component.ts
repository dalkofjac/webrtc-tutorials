import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SignalrService } from 'src/app/services/signalr.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  room: string;

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
    this.router.navigate(['session-call/' + this.room]);
  }
}
