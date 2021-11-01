import { TestBed } from '@angular/core/testing';

import { WebrtcUtils } from './webrtc-utils.service';

describe('WebrtcUtils', () => {
  let service: WebrtcUtils;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WebrtcUtils);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
