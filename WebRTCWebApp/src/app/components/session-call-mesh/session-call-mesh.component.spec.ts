import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionCallMeshComponent } from './session-call-mesh.component';

describe('SessionCallMeshComponent', () => {
  let component: SessionCallMeshComponent;
  let fixture: ComponentFixture<SessionCallMeshComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SessionCallMeshComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SessionCallMeshComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
