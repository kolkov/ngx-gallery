import { TestBed } from '@angular/core/testing';

import { NgxGalleryService } from './ngx-gallery.service';

describe('NgxGalleryService', () => {
  let service: NgxGalleryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NgxGalleryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
