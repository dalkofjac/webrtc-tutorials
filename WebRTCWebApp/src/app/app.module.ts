import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { HomeComponent } from './components/home/home.component';
import { SessionCallComponent } from './components/session-call/session-call.component';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { SessionCallMeshComponent } from './components/session-call-mesh/session-call-mesh.component';
import { MatSelectModule } from '@angular/material/select';
import { SessionCallStarComponent } from './components/session-call-star/session-call-star.component';
import { SessionCallSFUComponent } from './components/session-call-sfu/session-call-sfu.component';


@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    SessionCallComponent,
    SessionCallMeshComponent,
    SessionCallStarComponent,
    SessionCallSFUComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    FormsModule,
    HttpClientModule,

    // Angular Material
    MatButtonModule,
    MatInputModule,
    MatToolbarModule,
    MatFormFieldModule,
    MatIconModule,
    MatSnackBarModule,
    MatSelectModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
