import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxGalleryPreviewComponent } from './ngx-gallery-preview.component';

describe('NgxGalleryPrevewComponent', () => {
  let component: NgxGalleryPreviewComponent;
  let fixture: ComponentFixture<NgxGalleryPreviewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgxGalleryPreviewComponent ]
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
