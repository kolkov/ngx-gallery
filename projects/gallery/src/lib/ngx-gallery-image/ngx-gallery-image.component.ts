import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import {DomSanitizer, SafeStyle} from '@angular/platform-browser';
import {NgxGalleryService} from '../ngx-gallery.service';
import {NgxGalleryOrderedImage} from '../ngx-gallery-ordered-image';
import {NgxGalleryAction} from '../ngx-gallery-action';
import {NgxGalleryAnimation} from '../ngx-gallery-animation';
import {animate, style, transition, trigger, state} from '@angular/animations';

type Orientation = ('slideLeft' | 'slideRight' | 'fade' | 'rotateLeft' | 'rotateRight' | 'zoom' | 'none');

@Component({
  selector: 'ngx-gallery-image',
  templateUrl: './ngx-gallery-image.component.html',
  styleUrls: ['./ngx-gallery-image.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('animation', [
      // ...
      state('slideRight', style({
      })),
      state('slideLeft', style({
      })),
      state('fade', style({
      })),
      state('rotateLeft', style({
      })),
      state('rotateRight', style({
      })),
      state('zoom', style({
      })),
      transition('slideRight => void', [
        animate('500ms ease-in-out', style({transform: 'translateX(-100%)'}))
      ]),
      transition('void => slideRight', [
        style({transform: 'translateX(100%)'}),
        animate('500ms ease-in-out', style({transform: 'translateX(0)'}))
      ]),
      transition('slideLeft => void', [
        animate('500ms ease-in-out', style({transform: 'translateX(100%)'}))
      ]),
      transition('void => slideLeft', [
        style({transform: 'translateX(-100%)'}),
        animate('500ms ease-in-out', style({transform: 'translateX(0)'}))
      ]),
      transition('fade => void', [
        animate('500ms ease-in-out', style({opacity:'0'}))
      ]),
      transition('void => fade', [
        style({opacity: '0'}),
        animate('500ms ease-in-out', style({opacity: '1'}))
      ]),
      transition('rotateLeft => void', [
        animate('500ms ease-in-out', style({transform: 'scale(1, 1) rotate(-90deg)', opacity: '0'}))
      ]),
      transition('void => rotateLeft', [
        style({transform: 'scale(1, 1) rotate(-90deg)', opacity: '0'}),
        animate('500ms ease-in-out', style({transform: 'scale(1, 1) rotate(0deg)', opacity: '1'}))
      ]),
      transition('rotateRight => void', [
        animate('500ms ease-in-out', style({transform: 'scale(1, 1) rotate(90deg)', opacity: '0'}))
      ]),
      transition('void => rotateRight', [
        style({transform: 'scale(1, 1) rotate(90deg)', opacity: '0'}),
        animate('500ms ease-in-out', style({transform: 'scale(1, 1) rotate(0deg)', opacity: '1'}))
      ]),
      transition('zoom => void', [
        animate('500ms ease-in-out', style({transform: 'scale(2.5,2.5)', opacity: '0'}))
      ]),
      transition('void => zoom', [
        style({transform: 'scale(2.5,2.5)', opacity: '0'}),
        animate('500ms ease-in-out', style({transform: 'scale(1, 1)', opacity: '1'}))
      ]),
    ]),
  ]
})
export class NgxGalleryImageComponent implements OnInit, OnChanges {
  @Input() images: NgxGalleryOrderedImage[];
  @Input() clickable: boolean;
  _selectedIndex;
  @Input()
  set selectedIndex(index: number) {
    if (index > this._selectedIndex) {
      let action;
      if (this.animation === NgxGalleryAnimation.Slide) {
        action = 'slideRight';
      }
      else if (this.animation === NgxGalleryAnimation.Fade) {
        action = 'fade';
      }
      else if (this.animation === NgxGalleryAnimation.Rotate) {
        action = 'rotateRight';
      }
      else if (this.animation === NgxGalleryAnimation.Zoom) {
        action = 'zoom';
      }
      this.setAction(action);
    } else if (index < this._selectedIndex) {
      let action;
      if (this.animation === NgxGalleryAnimation.Slide) {
        action = 'slideLeft';
      }
      else if (this.animation === NgxGalleryAnimation.Fade) {
        action = 'fade';
      }
      else if (this.animation === NgxGalleryAnimation.Rotate) {
        action = 'rotateLeft';
      }
      else if (this.animation === NgxGalleryAnimation.Zoom) {
        action = 'zoom';
      }
      this.setAction(action);
    }

    this._selectedIndex = index;
  }

  @Input() arrows: boolean;
  @Input() arrowsAutoHide: boolean;
  @Input() swipe: boolean;
  @Input() animation: string;
  @Input() size: string;
  @Input() arrowPrevIcon: string;
  @Input() arrowNextIcon: string;
  @Input() autoPlay: boolean;
  @Input() autoPlayInterval: number;
  @Input() autoPlayPauseOnHover: boolean;
  @Input() infinityMove: boolean;
  @Input() lazyLoading: boolean;
  @Input() actions: NgxGalleryAction[];
  @Input() descriptions: string[];
  @Input() showDescription: boolean;
  @Input() bullets: boolean;

  @Output() imageClick = new EventEmitter();
  @Output() activeChange = new EventEmitter();
  @Output() animating = new EventEmitter();

  canChangeImage = true;
  public action: Orientation;

  isAnimating = false;

  private timer;

  constructor(private sanitization: DomSanitizer, private changeDetectorRef: ChangeDetectorRef,
              private elementRef: ElementRef, private helperService: NgxGalleryService) {
    this.changeDetectorRef = changeDetectorRef;
    this.action = 'none';
  }

  // @HostBinding('style.display') public display = 'inline-block';
  // @HostBinding('style.background-color') public color = 'lime';

  ngOnInit() {
    if (this.arrows && this.arrowsAutoHide) {
      this.arrows = false;
    }

    if (this.autoPlay) {
      this.startAutoPlay();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.swipe) {
      this.helperService.manageSwipe(this.swipe, this.elementRef, 'image', () => this.showNext(), () => this.showPrev());
    }
  }

  @HostListener('mouseenter') onMouseEnter() {
    if (this.arrowsAutoHide && !this.arrows) {
      this.arrows = true;
    }

    if (this.autoPlay && this.autoPlayPauseOnHover) {
      this.stopAutoPlay();
    }
  }

  @HostListener('mouseleave') onMouseLeave() {
    if (this.arrowsAutoHide && this.arrows) {
      this.arrows = false;
    }

    if (this.autoPlay && this.autoPlayPauseOnHover) {
      this.startAutoPlay();
    }
  }

  reset(index: number): void {
    this._selectedIndex = index;
    this.action = 'none';
  }

  getImages(): NgxGalleryOrderedImage[] {
    if (!this.images) {
      return [];
    }

    if (this.lazyLoading) {
      const indexes = [this._selectedIndex];
      const prevIndex = this._selectedIndex - 1;

      if (prevIndex === -1 && this.infinityMove) {
        indexes.push(this.images.length - 1);
      } else if (prevIndex >= 0) {
        indexes.push(prevIndex);
      }

      const nextIndex = this._selectedIndex + 1;

      if (nextIndex === this.images.length && this.infinityMove) {
        indexes.push(0);
      } else if (nextIndex < this.images.length) {
        indexes.push(nextIndex);
      }

      return this.images.filter((img, i) => indexes.indexOf(i) !== -1);
    } else {
      return this.images;
    }
  }

  startAutoPlay(): void {
    this.stopAutoPlay();

    this.timer = setInterval(() => {
      if (!this.showNext()) {
        this._selectedIndex = -1;
        this.showNext();
      }
    }, this.autoPlayInterval);
  }

  stopAutoPlay() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  handleClick(event: Event, index: number): void {
    if (this.clickable) {
      this.imageClick.emit(index);

      event.stopPropagation();
      event.preventDefault();
    }
  }

  show(index: number) {
    if (this.isAnimating) {
      return;
    }
    if (index > this._selectedIndex) {
      let action;
      if (this.animation === NgxGalleryAnimation.Slide) {
        action = 'slideRight';
      }
      else if (this.animation === NgxGalleryAnimation.Fade) {
        action = 'fade';
      }
      else if (this.animation === NgxGalleryAnimation.Rotate) {
        action = 'rotateRight';
      }
      else if (this.animation === NgxGalleryAnimation.Zoom) {
        action = 'zoom';
      }
      this.setAction(action);
    } else {
      let action;
      if (this.animation === NgxGalleryAnimation.Slide) {
        action = 'slideLeft';
      }
      else if (this.animation === NgxGalleryAnimation.Fade) {
        action = 'fade';
      }
      else if (this.animation === NgxGalleryAnimation.Rotate) {
        action = 'rotateLeft';
      }
      else if (this.animation === NgxGalleryAnimation.Zoom) {
        action = 'zoom';
      }
      this.setAction(action);
    }

    this._selectedIndex = index;
    this.activeChange.emit(this._selectedIndex);
    this.setChangeTimeout();
  }

  setAction(action: Orientation) {
    this.action = action;
    this.changeDetectorRef.detectChanges();
  }

  showNext(): boolean {
    if (this.isAnimating) {
      return;
    }
    if (this.canShowNext() && this.canChangeImage) {
      let action;
      if (this.animation === NgxGalleryAnimation.Slide) {
        action = 'slideRight';
      }
      else if (this.animation === NgxGalleryAnimation.Fade) {
        action = 'fade';
      }
      else if (this.animation === NgxGalleryAnimation.Rotate) {
        action = 'rotateRight';
      }
      else if (this.animation === NgxGalleryAnimation.Zoom) {
        action = 'zoom';
      }
      this.setAction(action);
      this._selectedIndex++;
      if (this._selectedIndex === this.images.length) {
        this._selectedIndex = 0;
      }

      this.activeChange.emit(this._selectedIndex);
      this.setChangeTimeout();

      return true;
    } else {
      return false;
    }
  }

  showPrev(): void {
    if (this.isAnimating) {
      return;
    }
    if (this.canShowPrev() && this.canChangeImage) {
      let action;
      if (this.animation === NgxGalleryAnimation.Slide) {
        action = 'slideLeft';
      }
      else if (this.animation === NgxGalleryAnimation.Fade) {
        action = 'fade';
      }
      else if (this.animation === NgxGalleryAnimation.Rotate) {
        action = 'rotateLeft';
      }
      else if (this.animation === NgxGalleryAnimation.Zoom) {
        action = 'zoom';
      }
      this.setAction(action);
      this._selectedIndex--;
      if (this._selectedIndex < 0) {
        this._selectedIndex = this.images.length - 1;
      }

      this.activeChange.emit(this._selectedIndex);
      this.setChangeTimeout();
    }
  }

  setChangeTimeout() {
    this.canChangeImage = false;
    let timeout = 1000;

    if (this.animation === NgxGalleryAnimation.Slide
      || this.animation === NgxGalleryAnimation.Fade) {
      timeout = 500;
    }

    setTimeout(() => {
      this.canChangeImage = true;
    }, timeout);
  }

  canShowNext(): boolean {
    if (this.images) {
      return this.infinityMove || this._selectedIndex < this.images.length - 1;
    } else {
      return false;
    }
  }

  canShowPrev(): boolean {
    if (this.images) {
      return this.infinityMove || this._selectedIndex > 0;
    } else {
      return false;
    }
  }

  getSafeUrl(image: string): SafeStyle {
    return this.sanitization.bypassSecurityTrustStyle(this.helperService.getBackgroundUrl(image));
  }

  getFileType(fileSource: string) {
    return this.helperService.getFileType(fileSource);
  }

  onStart(event: AnimationEvent) {
    this.isAnimating = true;
    this.animating.emit(true)
  }

  onDone(event: AnimationEvent) {
    this.isAnimating = false;
    this.animating.emit(false)
  }
}
