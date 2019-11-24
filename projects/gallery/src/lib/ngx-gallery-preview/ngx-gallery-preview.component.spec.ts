import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxGalleryPreviewComponent } from './ngx-gallery-preview.component';
import {NgxGalleryArrowsComponent} from '../ngx-gallery-arrows/ngx-gallery-arrows.component';
import {NgxGalleryAction} from '../ngx-gallery-action';
import {ChangeDetectorRef, Renderer2} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import {NgxGalleryService} from '../ngx-gallery.service';
import {NgxGalleryActionComponent} from '../ngx-gallery-action/ngx-gallery-action.component';
import {NgxGalleryBulletsComponent} from '../ngx-gallery-bullets/ngx-gallery-bullets.component';

describe('NgxGalleryPrevewComponent', () => {
  let component: NgxGalleryPreviewComponent;
  let fixture: ComponentFixture<NgxGalleryPreviewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgxGalleryPreviewComponent, NgxGalleryArrowsComponent, NgxGalleryActionComponent, NgxGalleryBulletsComponent],
      imports: [],
      providers: [Renderer2, DomSanitizer, NgxGalleryService, ChangeDetectorRef]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgxGalleryPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
