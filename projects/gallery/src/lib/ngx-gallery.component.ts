import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DoCheck,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnInit,
  Output,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import {NgxGalleryPreviewComponent} from './ngx-gallery-preview/ngx-gallery-preview.component';
import {NgxGalleryImageComponent} from './ngx-gallery-image/ngx-gallery-image.component';
import {NgxGalleryThumbnailsComponent} from './ngx-gallery-thumbnails/ngx-gallery-thumbnails.component';
import {SafeResourceUrl} from '@angular/platform-browser';
import {NgxGalleryService} from './ngx-gallery.service';
import {NgxGalleryOptions} from './ngx-gallery-options';
import {NgxGalleryImage} from './ngx-gallery-image';
import {NgxGalleryOrderedImage} from './ngx-gallery-ordered-image';
import {NgxGalleryLayout} from './ngx-gallery-layout';

@Component({
  selector: 'ngx-gallery',
  templateUrl: './ngx-gallery.component.html',
  styleUrls: ['./ngx-gallery.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [NgxGalleryService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NgxGalleryComponent implements OnInit, DoCheck, AfterViewInit {
  @Input() options: NgxGalleryOptions[] = [{}];
  @Input() images: NgxGalleryImage[];

  @Output() imagesReady = new EventEmitter();
  // tslint:disable-next-line:no-output-native
  @Output() change = new EventEmitter<{ index: number; image: NgxGalleryImage; }>();
  @Output() previewOpen = new EventEmitter();
  @Output() previewClose = new EventEmitter();
  @Output() previewChange = new EventEmitter<{ index: number; image: NgxGalleryImage; }>();

  smallImages: string[] | SafeResourceUrl[];
  mediumImages: NgxGalleryOrderedImage[];
  bigImages: string[] | SafeResourceUrl[];
  descriptions: string[];
  links: string[];
  labels: string[];

  oldImages: NgxGalleryImage[];
  oldImagesLength = 0;

  selectedIndex = 0;
  isAnimating: boolean;
  previewEnabled: boolean;

  currentOptions: NgxGalleryOptions;

  private breakpoint: number | undefined = undefined;
  private prevBreakpoint: number | undefined = undefined;
  private fullWidthTimeout: any;

  @ViewChild(NgxGalleryPreviewComponent) preview: NgxGalleryPreviewComponent;
  @ViewChild(NgxGalleryImageComponent) image: NgxGalleryImageComponent;
  @ViewChild(NgxGalleryThumbnailsComponent) thumbnails: NgxGalleryThumbnailsComponent;

  @HostBinding('style.width') width: string;
  @HostBinding('style.height') height: string;
  @HostBinding('style.transform') left: string;

  constructor(private myElement: ElementRef, private helperService: NgxGalleryService) {
  }

  ngOnInit() {
    this.options = this.options.map((opt) => new NgxGalleryOptions(opt));
    this.sortOptions();
    this.setBreakpoint();
    this.setOptions();
    this.checkFullWidth();
    if (this.currentOptions) {
      this.selectedIndex = this.currentOptions.startIndex as number;
    }
  }

  ngDoCheck(): void {
    if (this.images !== undefined && (this.images.length !== this.oldImagesLength)
      || (this.images !== this.oldImages)) {
      this.oldImagesLength = this.images.length;
      this.oldImages = this.images;
      this.setOptions();
      this.setImages();

      if (this.images && this.images.length) {
        this.imagesReady.emit();
      }

      if (this.image) {
        this.image.reset(this.currentOptions.startIndex as number);
      }

      if (this.currentOptions.thumbnailsAutoHide && this.currentOptions.thumbnails
        && this.images.length <= 1) {
        this.currentOptions.thumbnails = false;
        this.currentOptions.imageArrows = false;
      }

      this.resetThumbnails();
    }
  }

  ngAfterViewInit(): void {
    this.checkFullWidth();
  }

  @HostListener('window:resize') onResize() {
    this.setBreakpoint();

    if (this.prevBreakpoint !== this.breakpoint) {
      this.setOptions();
      this.resetThumbnails();
    }

    if (this.currentOptions && this.currentOptions.fullWidth) {

      if (this.fullWidthTimeout) {
        clearTimeout(this.fullWidthTimeout);
      }

      this.fullWidthTimeout = setTimeout(() => {
        this.checkFullWidth();
      }, 200);
    }
  }

  getImageHeight(): string {
    return (this.currentOptions && this.currentOptions.thumbnails) ?
      this.currentOptions.imagePercent + '%' : '100%';
  }

  getThumbnailsHeight(): string {
    if (this.currentOptions && this.currentOptions.image) {
      return 'calc(' + this.currentOptions.thumbnailsPercent + '% - '
        + this.currentOptions.thumbnailsMargin + 'px)';
    } else {
      return '100%';
    }
  }

  getThumbnailsMarginTop(): string {
    if (this.currentOptions && this.currentOptions.layout === NgxGalleryLayout.ThumbnailsBottom) {
      return this.currentOptions.thumbnailsMargin + 'px';
    } else {
      return '0px';
    }
  }

  getThumbnailsMarginBottom(): string {
    if (this.currentOptions && this.currentOptions.layout === NgxGalleryLayout.ThumbnailsTop) {
      return this.currentOptions.thumbnailsMargin + 'px';
    } else {
      return '0px';
    }
  }

  openPreview(index: number): void {
    if (this.currentOptions.previewCustom) {
      this.currentOptions.previewCustom(index);
    } else {
      this.previewEnabled = true;
      this.preview.open(index);
    }
  }

  onPreviewOpen(): void {
    this.previewOpen.emit();

    if (this.image && this.image.autoPlay) {
      this.image.stopAutoPlay();
    }
  }

  onPreviewClose(): void {
    this.previewEnabled = false;
    this.previewClose.emit();

    if (this.image && this.image.autoPlay) {
      this.image.startAutoPlay();
    }
  }

  selectFromImage(index: number) {
    this.select(index);
  }

  selectFromThumbnails(index: number) {
    this.select(index);

    if (this.currentOptions && this.currentOptions.thumbnails && this.currentOptions.preview
      && (!this.currentOptions.image || this.currentOptions.thumbnailsRemainingCount)) {
      this.openPreview(this.selectedIndex);
    }
  }

  show(index: number): void {
    this.select(index);
  }

  showNext(): void {
    this.image.showNext();
  }

  showPrev(): void {
    this.image.showPrev();
  }

  canShowNext(): boolean {
    if (this.images && this.currentOptions) {
      return !!(this.currentOptions.imageInfinityMove || this.selectedIndex < this.images.length - 1);
    } else {
      return false;
    }
  }

  canShowPrev(): boolean {
    if (this.images && this.currentOptions) {
      return !!(this.currentOptions.imageInfinityMove || this.selectedIndex > 0);
    } else {
      return false;
    }
  }

  previewSelect(index: number) {
    this.previewChange.emit({index, image: this.images[index]});
  }

  moveThumbnailsRight() {
    this.thumbnails.moveRight();
  }

  moveThumbnailsLeft() {
    this.thumbnails.moveLeft();
  }

  canMoveThumbnailsRight() {
    return this.thumbnails.canMoveRight();
  }

  canMoveThumbnailsLeft() {
    return this.thumbnails.canMoveLeft();
  }

  private resetThumbnails() {
    if (this.thumbnails) {
      this.thumbnails.reset(this.currentOptions.startIndex as number);
    }
  }

  private select(index: number) {
    this.selectedIndex = index;

    this.change.emit({
      index,
      image: this.images[index]
    });
  }

  private checkFullWidth(): void {
    if (this.currentOptions && this.currentOptions.fullWidth) {
      this.width = document.body.clientWidth + 'px';
      this.left = 'translateX(' + (-(document.body.clientWidth -
        this.myElement.nativeElement.parentNode.innerWidth) / 2) + 'px)';
    }
  }

  private setImages(): void {
    this.images.forEach((img) =>
        img.type = this.helperService.getFileType(img.url as string || img.big as string || img.medium as string || img.small as string || '')
    );
    this.smallImages = this.images.map((img) => img.small as string);
    this.mediumImages = this.images.map((img, i) => new NgxGalleryOrderedImage({
      src: img.medium,
      type: img.type,
      index: i
    }));
    this.bigImages = this.images.map((img) => img.big as string);
    this.descriptions = this.images.map((img) => img.description as string);
    this.links = this.images.map((img) => img.url as string);
    this.labels = this.images.map((img) => img.label as string);
  }

  private setBreakpoint(): void {
    this.prevBreakpoint = this.breakpoint;
    let breakpoints;

    if (typeof window !== 'undefined') {
      breakpoints = this.options.filter((opt) => opt.breakpoint >= window.innerWidth)
        .map((opt) => opt.breakpoint);
    }

    if (breakpoints && breakpoints.length) {
      this.breakpoint = breakpoints.pop();
    } else {
      this.breakpoint = undefined;
    }
  }

  private sortOptions(): void {
    this.options = [
      ...this.options.filter((a) => a.breakpoint === undefined),
      ...this.options
        .filter((a) => a.breakpoint !== undefined)
        .sort((a, b) => b.breakpoint - a.breakpoint)
    ];
  }

  private setOptions(): void {
    this.currentOptions = new NgxGalleryOptions({});

    this.options
      .filter((opt) => opt.breakpoint === undefined || opt.breakpoint >= this.breakpoint)
      .map((opt) => this.combineOptions(this.currentOptions, opt));

    this.width = this.currentOptions.width as string;
    this.height = this.currentOptions.height as string;
  }

  private combineOptions(first: NgxGalleryOptions, second: NgxGalleryOptions) {
    Object.keys(second).map((val) => first[val] = second[val] !== undefined ? second[val] : first[val]);
  }

  setAnimating(event: boolean) {
    this.isAnimating = event;
  }
}
