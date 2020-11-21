import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionCallComponent } from './session-call.component';

describe('SessionCallComponent', () => {
  let component: SessionCallComponent;
  let fixture: ComponentFixture<SessionCallComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SessionCallComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SessionCallComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
