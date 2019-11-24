import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {NgxGalleryComponent} from './ngx-gallery.component';
import {NgxGalleryImageComponent} from './ngx-gallery-image/ngx-gallery-image.component';
import {NgxGalleryThumbnailsComponent} from './ngx-gallery-thumbnails/ngx-gallery-thumbnails.component';
import {NgxGalleryPreviewComponent} from './ngx-gallery-preview/ngx-gallery-preview.component';
import {NgxGalleryActionComponent} from './ngx-gallery-action/ngx-gallery-action.component';
import {NgxGalleryBulletsComponent} from './ngx-gallery-bullets/ngx-gallery-bullets.component';
import {NgxGalleryArrowsComponent} from './ngx-gallery-arrows/ngx-gallery-arrows.component';

describe('NgxGalleryComponent', () => {
  let component: NgxGalleryComponent;
  let fixture: ComponentFixture<NgxGalleryComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [NgxGalleryComponent,
        NgxGalleryImageComponent,
        NgxGalleryThumbnailsComponent,
        NgxGalleryPreviewComponent,
        NgxGalleryActionComponent,
        NgxGalleryBulletsComponent,
        NgxGalleryArrowsComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgxGalleryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
