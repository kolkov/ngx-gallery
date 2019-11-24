import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxGalleryBulletsComponent } from './ngx-gallery-bullets.component';

describe('NgxGalleryBulletsComponent', () => {
  let component: NgxGalleryBulletsComponent;
  let fixture: ComponentFixture<NgxGalleryBulletsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgxGalleryBulletsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgxGalleryBulletsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
