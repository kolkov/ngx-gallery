import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxGalleryImageComponent } from './ngx-gallery-image.component';

describe('NgxGalleryImageComponent', () => {
  let component: NgxGalleryImageComponent;
  let fixture: ComponentFixture<NgxGalleryImageComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgxGalleryImageComponent ]
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
