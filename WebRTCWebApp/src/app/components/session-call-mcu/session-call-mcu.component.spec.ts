import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionCallMCUComponent } from './session-call-mcu.component';

describe('SessionCallMcuComponent', () => {
  let component: SessionCallMCUComponent;
  let fixture: ComponentFixture<SessionCallMCUComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SessionCallMCUComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SessionCallMCUComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
