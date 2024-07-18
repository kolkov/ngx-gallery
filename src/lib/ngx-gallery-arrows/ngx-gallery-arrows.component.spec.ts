import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxGalleryArrowsComponent } from './ngx-gallery-arrows.component';

describe('NgxGalleryArrowsComponent', () => {
  let component: NgxGalleryArrowsComponent;
  let fixture: ComponentFixture<NgxGalleryArrowsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgxGalleryArrowsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgxGalleryArrowsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
