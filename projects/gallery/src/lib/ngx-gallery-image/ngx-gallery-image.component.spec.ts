import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxGalleryImageComponent } from './ngx-gallery-image.component';
import {NgxGalleryAction} from '../ngx-gallery-action';
import {NgxGalleryBulletsComponent} from '../ngx-gallery-bullets/ngx-gallery-bullets.component';
import {NgxGalleryArrowsComponent} from '../ngx-gallery-arrows/ngx-gallery-arrows.component';
import {CommonModule} from '@angular/common';
import {NgxGalleryService} from '../ngx-gallery.service';
import {DomSanitizer} from '@angular/platform-browser';
import {NgxGalleryActionComponent} from '../ngx-gallery-action/ngx-gallery-action.component';
import {Renderer2} from '@angular/core';

describe('NgxGalleryImageComponent', () => {
  let component: NgxGalleryImageComponent;
  let fixture: ComponentFixture<NgxGalleryImageComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgxGalleryImageComponent, NgxGalleryActionComponent, NgxGalleryBulletsComponent, NgxGalleryArrowsComponent ],
      imports: [],
      providers: [Renderer2, DomSanitizer, NgxGalleryService ],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgxGalleryImageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
