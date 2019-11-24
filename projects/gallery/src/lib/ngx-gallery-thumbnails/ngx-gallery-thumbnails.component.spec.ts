import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxGalleryThumbnailsComponent } from './ngx-gallery-thumbnails.component';
import {NgxGalleryActionComponent} from '../ngx-gallery-action/ngx-gallery-action.component';
import {NgxGalleryArrowsComponent} from '../ngx-gallery-arrows/ngx-gallery-arrows.component';
import {Renderer2} from '@angular/core';
import {NgxGalleryService} from '../ngx-gallery.service';

describe('NgxGalleryThumbnailsComponent', () => {
  let component: NgxGalleryThumbnailsComponent;
  let fixture: ComponentFixture<NgxGalleryThumbnailsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgxGalleryThumbnailsComponent, NgxGalleryActionComponent, NgxGalleryArrowsComponent ],
      imports: [],
      providers: [Renderer2, NgxGalleryService]
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
