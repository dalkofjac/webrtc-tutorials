import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionCallOpenaiComponent } from './session-call-openai.component';

describe('SessionCallOpenaiComponent', () => {
  let component: SessionCallOpenaiComponent;
  let fixture: ComponentFixture<SessionCallOpenaiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SessionCallOpenaiComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SessionCallOpenaiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
