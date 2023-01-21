import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { SessionCallMeshComponent } from './components/session-call-mesh/session-call-mesh.component';
import { SessionCallStarComponent } from './components/session-call-star/session-call-star.component';
import { SessionCallComponent } from './components/session-call/session-call.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomeComponent },
  { path: 'session-call/:room', component: SessionCallComponent },
  { path: 'session-call/mesh/:room', component: SessionCallMeshComponent },
  { path: 'session-call/star/:room/:client-type', component: SessionCallStarComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
