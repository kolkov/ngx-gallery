import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxGalleryThumbnailsComponent } from './ngx-gallery-thumbnails.component';

describe('NgxGalleryTrumbnailsComponent', () => {
  let component: NgxGalleryThumbnailsComponent;
  let fixture: ComponentFixture<NgxGalleryThumbnailsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgxGalleryThumbnailsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgxGalleryThumbnailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
