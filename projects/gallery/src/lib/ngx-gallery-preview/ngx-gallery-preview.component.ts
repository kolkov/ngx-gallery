import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {DomSanitizer, SafeResourceUrl, SafeStyle, SafeUrl} from '@angular/platform-browser';
import {NgxGalleryService} from '../ngx-gallery.service';
import {NgxGalleryAction} from '../ngx-gallery-action';


@Component({
  selector: 'ngx-gallery-preview',
  templateUrl: './ngx-gallery-preview.component.html',
  styleUrls: ['./ngx-gallery-preview.component.scss'],
  // encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NgxGalleryPreviewComponent implements OnInit, OnDestroy, OnChanges {
  src: SafeUrl;
  srcIndex: number;
  description: string;
  type: string;
  showSpinner = false;
  positionLeft = 0;
  positionTop = 0;
  zoomValue = 1;
  loading = false;
  rotateValue = 0;
  index = 0;

  @Input() images: string[] | SafeResourceUrl[];
  @Input() descriptions: string[];
  @Input() showDescription: boolean;
  @Input() arrows: boolean;
  @Input() arrowsAutoHide: boolean;
  @Input() swipe: boolean;
  @Input() fullscreen: boolean;
  @Input() forceFullscreen: boolean;
  @Input() closeOnClick: boolean;
  @Input() closeOnEsc: boolean;
  @Input() keyboardNavigation: boolean;
  @Input() arrowPrevIcon: string;
  @Input() arrowNextIcon: string;
  @Input() closeIcon: string;
  @Input() fullscreenIcon: string;
  @Input() spinnerIcon: string;
  @Input() autoPlay: boolean;
  @Input() autoPlayInterval: number;
  @Input() autoPlayPauseOnHover: boolean;
  @Input() infinityMove: boolean;
  @Input() zoom: boolean;
  @Input() zoomStep: number;
  @Input() zoomMax: number;
  @Input() zoomMin: number;
  @Input() zoomInIcon: string;
  @Input() zoomOutIcon: string;
  @Input() animation: boolean;
  @Input() actions: NgxGalleryAction[];
  @Input() rotate: boolean;
  @Input() rotateLeftIcon: string;
  @Input() rotateRightIcon: string;
  @Input() download: boolean;
  @Input() downloadIcon: string;
  @Input() bullets: string;

  @Output() previewOpen = new EventEmitter();
  @Output() previewClose = new EventEmitter();
  @Output() activeChange = new EventEmitter<number>();

  @ViewChild('previewImage') previewImage: any;

  private isOpen = false;
  private timer;
  private initialX = 0;
  private initialY = 0;
  private initialLeft = 0;
  private initialTop = 0;
  private isMove = false;

  private keyDownListener: () => void;

  constructor(private sanitization: DomSanitizer, private elementRef: ElementRef,
              private helperService: NgxGalleryService, private renderer: Renderer2,
              private changeDetectorRef: ChangeDetectorRef) {
  }

  ngOnInit() {
    if (this.arrows && this.arrowsAutoHide) {
      this.arrows = false;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.swipe) {
      this.helperService.manageSwipe(this.swipe, this.elementRef,
        'preview', () => this.showNext(), () => this.showPrev());
    }
  }

  ngOnDestroy() {
    if (this.keyDownListener) {
      this.keyDownListener();
    }
  }

  @HostListener('mouseenter') onMouseEnter() {
    if (this.arrowsAutoHide && !this.arrows) {
      this.arrows = true;
    }
  }

  @HostListener('mouseleave') onMouseLeave() {
    if (this.arrowsAutoHide && this.arrows) {
      this.arrows = false;
    }
  }

  onKeyDown(e) {
    if (this.isOpen) {
      if (this.keyboardNavigation) {
        if (this.isKeyboardPrev(e)) {
          this.showPrev();
        } else if (this.isKeyboardNext(e)) {
          this.showNext();
        }
      }
      if (this.closeOnEsc && this.isKeyboardEsc(e)) {
        this.close();
      }
    }
  }

  open(index: number): void {
    this.previewOpen.emit();

    this.index = index;
    this.isOpen = true;
    this.show(true);

    if (this.forceFullscreen) {
      this.manageFullscreen();
    }

    this.keyDownListener = this.renderer.listen('window', 'keydown', (e) => this.onKeyDown(e));
  }

  close(): void {
    this.isOpen = false;
    const video = this.previewImage.nativeElement;
    if (
      video.currentTime > 0 &&
      !video.paused &&
      !video.ended &&
      video.readyState > 2
    ) {
      video.pause();
    }
    this.closeFullscreen();
    this.previewClose.emit();

    this.stopAutoPlay();

    if (this.keyDownListener) {
      this.keyDownListener();
    }
  }

  imageMouseEnter(): void {
    if (this.autoPlay && this.autoPlayPauseOnHover) {
      this.stopAutoPlay();
    }
  }

  imageMouseLeave(): void {
    if (this.autoPlay && this.autoPlayPauseOnHover) {
      this.startAutoPlay();
    }
  }

  startAutoPlay(): void {
    if (this.autoPlay) {
      this.stopAutoPlay();

      this.timer = setTimeout(() => {
        if (!this.showNext()) {
          this.index = -1;
          this.showNext();
        }
      }, this.autoPlayInterval);
    }
  }

  stopAutoPlay(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  showAtIndex(index: number): void {
    this.index = index;
    this.show();
  }

  showNext(): boolean {
    if (this.canShowNext()) {
      this.index++;

      if (this.index === this.images.length) {
        this.index = 0;
      }

      this.show();
      return true;
    } else {
      return false;
    }
  }

  showPrev(): void {
    if (this.canShowPrev()) {
      this.index--;

      if (this.index < 0) {
        this.index = this.images.length - 1;
      }

      this.show();
    }
  }

  canShowNext(): boolean {
    if (this.loading) {
      return false;
    } else if (this.images) {
      return this.infinityMove || this.index < this.images.length - 1;
    } else {
      return false;
    }
  }

  canShowPrev(): boolean {
    if (this.loading) {
      return false;
    } else if (this.images) {
      return this.infinityMove || this.index > 0;
    } else {
      return false;
    }
  }

  manageFullscreen(): void {
    if (this.fullscreen || this.forceFullscreen) {
      const doc = document as any;

      if (!doc.fullscreenElement && !doc.mozFullScreenElement
        && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        this.openFullscreen();
      } else {
        this.closeFullscreen();
      }
    }
  }

  getSafeUrl(image: string): SafeUrl {
    return this.sanitization.bypassSecurityTrustUrl(image);
  }

  getFileType (fileSource: string): string {
    return this.helperService.getFileType(fileSource);
  }

  zoomIn(): void {
    if (this.canZoomIn()) {
      this.zoomValue += this.zoomStep;

      if (this.zoomValue > this.zoomMax) {
        this.zoomValue = this.zoomMax;
      }
    }
  }

  zoomOut(): void {
    if (this.canZoomOut()) {
      this.zoomValue -= this.zoomStep;

      if (this.zoomValue < this.zoomMin) {
        this.zoomValue = this.zoomMin;
      }

      if (this.zoomValue <= 1) {
        this.resetPosition();
      }
    }
  }

  rotateLeft(): void {
    this.rotateValue -= 90;
  }

  rotateRight(): void {
    this.rotateValue += 90;
  }

  getTransform(): SafeStyle {
    return this.sanitization.bypassSecurityTrustStyle('scale(' + this.zoomValue + ') rotate(' + this.rotateValue + 'deg)');
  }

  canZoomIn(): boolean {
    return this.zoomValue < this.zoomMax;
  }

  canZoomOut(): boolean {
    return this.zoomValue > this.zoomMin;
  }

  canDragOnZoom() {
    return this.zoom && this.zoomValue > 1;
  }

  mouseDownHandler(e): void {
    if (this.canDragOnZoom()) {
      this.initialX = this.getClientX(e);
      this.initialY = this.getClientY(e);
      this.initialLeft = this.positionLeft;
      this.initialTop = this.positionTop;
      this.isMove = true;

      e.preventDefault();
    }
  }

  mouseUpHandler(e): void {
    this.isMove = false;
  }

  mouseMoveHandler(e) {
    if (this.isMove) {
      this.positionLeft = this.initialLeft + (this.getClientX(e) - this.initialX);
      this.positionTop = this.initialTop + (this.getClientY(e) - this.initialY);
    }
  }

  private getClientX(e): number {
    return e.touches && e.touches.length ? e.touches[0].clientX : e.clientX;
  }

  private getClientY(e): number {
    return e.touches && e.touches.length ? e.touches[0].clientY : e.clientY;
  }

  private resetPosition() {
    if (this.zoom) {
      this.positionLeft = 0;
      this.positionTop = 0;
    }
  }

  private isKeyboardNext(e): boolean {
    return e.keyCode === 39;
  }

  private isKeyboardPrev(e): boolean {
    return e.keyCode === 37;
  }

  private isKeyboardEsc(e): boolean {
    return e.keyCode === 27;
  }

  private openFullscreen(): void {
    const element = document.documentElement as any;

    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    }
  }

  private closeFullscreen(): void {
    if (this.isFullscreen()) {
      const doc = document as any;

      if (doc.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    }
  }

  private isFullscreen() {
    const doc = document as any;

    return doc.fullscreenElement || doc.webkitFullscreenElement
      || doc.mozFullScreenElement || doc.msFullscreenElement;
  }


  private show(first = false) {
    this.loading = true;
    this.stopAutoPlay();

    this.activeChange.emit(this.index);

    if (first || !this.animation) {
      this._show();
    } else {
      setTimeout(() => this._show(), 600);
    }
  }

  private _show() {
    this.zoomValue = 1;
    this.rotateValue = 0;
    this.resetPosition();

    this.src = this.getSafeUrl(this.images[this.index] as string);
    this.type = this.getFileType(this.images[this.index] as string);
    this.srcIndex = this.index;
    this.description = this.descriptions[this.index];
    this.changeDetectorRef.markForCheck();

    setTimeout(() => {
      if (this.isLoaded(this.previewImage.nativeElement) || this.type === 'video') {
        this.loading = false;
        this.startAutoPlay();
        this.changeDetectorRef.markForCheck();
      } else if (this.type === 'video') {

      }
      else {
        setTimeout(() => {
          if (this.loading) {
            this.showSpinner = true;
            this.changeDetectorRef.markForCheck();
          }
        });

        this.previewImage.nativeElement.onload = () => {
          this.loading = false;
          this.showSpinner = false;
          this.previewImage.nativeElement.onload = null;
          this.startAutoPlay();
          this.changeDetectorRef.markForCheck();
        };
      }
    });
  }

  private isLoaded(img): boolean {
    if (!img.complete) {
      return false;
    }

    return !(typeof img.naturalWidth !== 'undefined' && img.naturalWidth === 0);
  }

}
