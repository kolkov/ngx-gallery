import {inject, TestBed} from '@angular/core/testing';

import { NgxGalleryService } from './ngx-gallery.service';
import {HttpClientModule} from '@angular/common/http';
import {Renderer2} from '@angular/core';

describe('NgxGalleryService', () => {
 beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ HttpClientModule ],
      providers: [NgxGalleryService, Renderer2]
    });
  });

 it('should be created', inject([NgxGalleryService], (service: NgxGalleryService) => {
    expect(service).toBeTruthy();
  }));

  describe('getFileType group', () => {
    it('png files should return image type', inject([NgxGalleryService], (service: NgxGalleryService) => {
      const url = 'https://www.pngfind.com/pngs/b/676-6764065_default-image-png.png';
      const actual = service.getFileType(url);
      expect(actual).toEqual('image');
    }));

    it('video files should return video type', inject([NgxGalleryService], (service: NgxGalleryService) => {
      const url = 'https://www.pngfind.com/pngs/b/676-6764065_default-image-png.mp4';
      const actual = service.getFileType(url);
      expect(actual).toEqual('video');
    }));

    it('video files should return video type with query params', inject([NgxGalleryService], (service: NgxGalleryService) => {
      const url = 'https://www.pngfind.com/pngs/b/676-6764065_default-image-png.mp4?size=100';
      const actual = service.getFileType(url);
      expect(actual).toEqual('video');
    }));
  });
});
