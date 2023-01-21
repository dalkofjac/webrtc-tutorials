import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionCallStarComponent } from './session-call-star.component';

describe('SessionCallStarComponent', () => {
  let component: SessionCallStarComponent;
  let fixture: ComponentFixture<SessionCallStarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SessionCallStarComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SessionCallStarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
