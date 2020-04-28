import {
  ChangeDetectionStrategy,
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
import {DomSanitizer, SafeResourceUrl, SafeStyle} from '@angular/platform-browser';
import {NgxGalleryService} from '../ngx-gallery.service';
import {NgxGalleryAction} from '../ngx-gallery-action';
import {NgxGalleryOrder} from '../ngx-gallery-order';

@Component({
  selector: 'ngx-gallery-thumbnails',
  templateUrl: './ngx-gallery-thumbnails.component.html',
  styleUrls: ['./ngx-gallery-thumbnails.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NgxGalleryThumbnailsComponent implements OnInit, OnChanges {
  thumbnailsLeft: string;
  thumbnailsMarginLeft: string;
  mouseenter: boolean;
  remainingCountValue: number;

  minStopIndex = 0;

  @Input() images: string[] | SafeResourceUrl[];
  @Input() isAnimating: boolean;
  @Input() links: string[];
  @Input() labels: string[];
  @Input() linkTarget: string;
  @Input() columns: number;
  @Input() rows: number;
  @Input() arrows: boolean;
  @Input() arrowsAutoHide: boolean;
  @Input() margin: number;
  @Input() selectedIndex: number;
  @Input() clickable: boolean;
  @Input() swipe: boolean;
  @Input() size: string;
  @Input() arrowPrevIcon: string;
  @Input() arrowNextIcon: string;
  @Input() moveSize: number;
  @Input() order: number;
  @Input() remainingCount: boolean;
  @Input() lazyLoading: boolean;
  @Input() actions: NgxGalleryAction[];

  @Output() activeChange = new EventEmitter();

  private index = 0;

  constructor(private sanitization: DomSanitizer, private elementRef: ElementRef,
              private helperService: NgxGalleryService) {
  }

  ngOnInit() {
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.selectedIndex) {
      this.validateIndex();
    }

    if (changes.swipe) {
      this.helperService.manageSwipe(this.swipe, this.elementRef,
        'thumbnails', () => this.moveRight(), () => this.moveLeft());
    }

    if (this.images) {
      this.remainingCountValue = this.images.length - (this.rows * this.columns);
    }
  }

  @HostListener('mouseenter') onMouseEnter() {
    this.mouseenter = true;
  }

  @HostListener('mouseleave') onMouseLeave() {
    this.mouseenter = false;
  }

  reset(index: number): void {
    this.selectedIndex = index;
    this.setDefaultPosition();

    this.index = 0;
    this.validateIndex();
  }

  getImages(): string[] | SafeResourceUrl[] {
    if (!this.images) {
      return [];
    }

    if (this.remainingCount) {
      return this.images.slice(0, this.rows * this.columns);
    } else if (this.lazyLoading && this.order !== NgxGalleryOrder.Row) {
      let stopIndex = 0;

      if (this.order === NgxGalleryOrder.Column) {
        stopIndex = (this.index + this.columns + this.moveSize) * this.rows;
      } else if (this.order === NgxGalleryOrder.Page) {
        stopIndex = this.index + ((this.columns * this.rows) * 2);
      }

      if (stopIndex <= this.minStopIndex) {
        stopIndex = this.minStopIndex;
      } else {
        this.minStopIndex = stopIndex;
      }

      return this.images.slice(0, stopIndex);
    } else {
      return this.images;
    }
  }

  handleClick(event: Event, index: number): void {
    if (!this.hasLink(index) && !this.isAnimating) {
      this.selectedIndex = index;
      this.activeChange.emit(index);
    }
    event.stopPropagation();
    event.preventDefault();
  }

  hasLink(index: number): boolean {
    if (this.links && this.links.length && this.links[index]) {
      return true;
    }
  }

  moveRight(): void {
    if (this.canMoveRight()) {
      this.index += this.moveSize;
      const maxIndex = this.getMaxIndex() - this.columns;

      if (this.index > maxIndex) {
        this.index = maxIndex;
      }

      this.setThumbnailsPosition();
    }
  }

  moveLeft(): void {
    if (this.canMoveLeft()) {
      this.index -= this.moveSize;

      if (this.index < 0) {
        this.index = 0;
      }

      this.setThumbnailsPosition();
    }
  }

  canMoveRight(): boolean {
    return this.index + this.columns < this.getMaxIndex();
  }

  canMoveLeft(): boolean {
    return this.index !== 0;
  }

  getThumbnailLeft(index: number): SafeStyle {
    let calculatedIndex;

    if (this.order === NgxGalleryOrder.Column) {
      calculatedIndex = Math.floor(index / this.rows);
    } else if (this.order === NgxGalleryOrder.Page) {
      calculatedIndex = (index % this.columns) + (Math.floor(index / (this.rows * this.columns)) * this.columns);
    } else if (this.order === NgxGalleryOrder.Row && this.remainingCount) {
      calculatedIndex = index % this.columns;
    } else {
      calculatedIndex = index % Math.ceil(this.images.length / this.rows);
    }

    return this.getThumbnailPosition(calculatedIndex, this.columns);
  }

  getThumbnailTop(index: number): SafeStyle {
    let calculatedIndex;

    if (this.order === NgxGalleryOrder.Column) {
      calculatedIndex = index % this.rows;
    } else if (this.order === NgxGalleryOrder.Page) {
      calculatedIndex = Math.floor(index / this.columns) - (Math.floor(index / (this.rows * this.columns)) * this.rows);
    } else if (this.order === NgxGalleryOrder.Row && this.remainingCount) {
      calculatedIndex = Math.floor(index / this.columns);
    } else {
      calculatedIndex = Math.floor(index / Math.ceil(this.images.length / this.rows));
    }

    return this.getThumbnailPosition(calculatedIndex, this.rows);
  }

  getThumbnailWidth(): SafeStyle {
    return this.getThumbnailDimension(this.columns);
  }

  getThumbnailHeight(): SafeStyle {
    return this.getThumbnailDimension(this.rows);
  }

  setThumbnailsPosition(): void {
    this.thumbnailsLeft = -((100 / this.columns) * this.index) + '%';

    this.thumbnailsMarginLeft = -((this.margin - (((this.columns - 1)
      * this.margin) / this.columns)) * this.index) + 'px';
  }

  setDefaultPosition(): void {
    this.thumbnailsLeft = '0px';
    this.thumbnailsMarginLeft = '0px';
  }

  canShowArrows(): boolean {
    if (this.remainingCount) {
      return false;
    } else {
      return this.arrows && this.images && this.images.length > this.getVisibleCount()
        && (!this.arrowsAutoHide || this.mouseenter);
    }
  }

  validateIndex(): void {
    if (this.images) {
      let newIndex;

      if (this.order === NgxGalleryOrder.Column) {
        newIndex = Math.floor(this.selectedIndex / this.rows);
      } else {
        newIndex = this.selectedIndex % Math.ceil(this.images.length / this.rows);
      }

      if (this.remainingCount) {
        newIndex = 0;
      }

      if (newIndex < this.index || newIndex >= this.index + this.columns) {
        const maxIndex = this.getMaxIndex() - this.columns;
        this.index = newIndex > maxIndex ? maxIndex : newIndex;

        this.setThumbnailsPosition();
      }
    }
  }

  getSafeUrl(image: string): SafeStyle {
    return this.sanitization.bypassSecurityTrustStyle(this.helperService.getBackgroundUrl(image));
  }

  getFileType (fileSource: string): string {
    return this.helperService.getFileType(fileSource);
  }

  private getThumbnailPosition(index: number, count: number): SafeStyle {
    return this.getSafeStyle('calc(' + ((100 / count) * index) + '% + '
      + ((this.margin - (((count - 1) * this.margin) / count)) * index) + 'px)');
  }

  private getThumbnailDimension(count: number): SafeStyle {
    if (this.margin !== 0) {
      return this.getSafeStyle('calc(' + (100 / count) + '% - '
        + (((count - 1) * this.margin) / count) + 'px)');
    } else {
      return this.getSafeStyle('calc(' + (100 / count) + '% + 1px)');
    }
  }

  private getMaxIndex(): number {
    if (this.order === NgxGalleryOrder.Page) {
      let maxIndex = (Math.floor(this.images.length / this.getVisibleCount()) * this.columns);

      if (this.images.length % this.getVisibleCount() > this.columns) {
        maxIndex += this.columns;
      } else {
        maxIndex += this.images.length % this.getVisibleCount();
      }

      return maxIndex;
    } else {
      return Math.ceil(this.images.length / this.rows);
    }
  }

  private getVisibleCount(): number {
    return this.columns * this.rows;
  }

  private getSafeStyle(value: string): SafeStyle {
    return this.sanitization.bypassSecurityTrustStyle(value);
  }
}
