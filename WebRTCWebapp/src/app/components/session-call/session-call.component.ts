import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-session-call',
  templateUrl: './session-call.component.html',
  styleUrls: ['./session-call.component.scss']
})
export class SessionCallComponent implements OnInit {

  @ViewChild('remoteVideo') remoteVideo: ElementRef;

  room: string;

  constructor(
    private snack: MatSnackBar,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(async param => {
      this.room = param['params']['room'];
    });
    if (!this.room) {
      this.room = 'testroom';
    }

    this.start();
  }

  start() {
    // todo...
  }

}
