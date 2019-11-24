import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxGalleryComponent } from './ngx-gallery.component';

describe('NgxGalleryComponent', () => {
  let component: NgxGalleryComponent;
  let fixture: ComponentFixture<NgxGalleryComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgxGalleryComponent ]
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
