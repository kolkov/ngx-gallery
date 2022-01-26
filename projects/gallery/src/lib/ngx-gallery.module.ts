import { NgModule, Injectable } from '@angular/core';
import {NgxGalleryComponent} from './ngx-gallery.component';
import {NgxGalleryImageComponent} from './ngx-gallery-image/ngx-gallery-image.component';
import {NgxGalleryArrowsComponent} from './ngx-gallery-arrows/ngx-gallery-arrows.component';
import {NgxGalleryThumbnailsComponent} from './ngx-gallery-thumbnails/ngx-gallery-thumbnails.component';
import {NgxGalleryPreviewComponent} from './ngx-gallery-preview/ngx-gallery-preview.component';
import {NgxGalleryActionComponent} from './ngx-gallery-action/ngx-gallery-action.component';
import {NgxGalleryBulletsComponent} from './ngx-gallery-bullets/ngx-gallery-bullets.component';
import {CommonModule} from '@angular/common';
import {HAMMER_GESTURE_CONFIG, HammerGestureConfig} from '@angular/platform-browser';

@Injectable()
export class CustomHammerConfig extends HammerGestureConfig  {
  override overrides = {
    pinch: { enable: false },
    rotate: { enable: false }
  } as any;
}


@NgModule({
  declarations: [
    NgxGalleryComponent,
    NgxGalleryImageComponent,
    NgxGalleryArrowsComponent,
    NgxGalleryThumbnailsComponent,
    NgxGalleryPreviewComponent,
    NgxGalleryActionComponent,
    NgxGalleryBulletsComponent
  ],
  imports: [ CommonModule ],
  exports: [NgxGalleryComponent],
  providers: [
    { provide: HAMMER_GESTURE_CONFIG, useClass: CustomHammerConfig }
  ]
})
export class NgxGalleryModule {
}
