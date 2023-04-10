import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionCallSFUComponent } from './session-call-sfu.component';

describe('SessionCallSfuComponent', () => {
  let component: SessionCallSFUComponent;
  let fixture: ComponentFixture<SessionCallSFUComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SessionCallSFUComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SessionCallSFUComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
