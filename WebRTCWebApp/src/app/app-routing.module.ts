import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { SessionCallMeshComponent } from './components/session-call-mesh/session-call-mesh.component';
import { SessionCallSFUComponent } from './components/session-call-sfu/session-call-sfu.component';
import { SessionCallStarComponent } from './components/session-call-star/session-call-star.component';
import { SessionCallComponent } from './components/session-call/session-call.component';
import { SessionCallMCUComponent } from './components/session-call-mcu/session-call-mcu.component';
import { SessionCallOpenaiComponent } from './components/session-call-openai/session-call-openai.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomeComponent },
  { path: 'session-call/:room', component: SessionCallComponent },
  { path: 'session-call/mesh/:room', component: SessionCallMeshComponent },
  { path: 'session-call/star/:room/:client-type', component: SessionCallStarComponent },
  { path: 'session-call/sfu/:room', component: SessionCallSFUComponent },
  { path: 'session-call/mcu/:room', component: SessionCallMCUComponent },
  { path: 'session-call/openai/:room', component: SessionCallOpenaiComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
