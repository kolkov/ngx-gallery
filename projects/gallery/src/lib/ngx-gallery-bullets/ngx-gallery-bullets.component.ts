import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';

@Component({
  selector: 'ngx-gallery-bullets',
  templateUrl: './ngx-gallery-bullets.component.html',
  styleUrls: ['./ngx-gallery-bullets.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NgxGalleryBulletsComponent implements OnInit {
  @Input() count: number;
  @Input() active = 0;

  @Output() bulletChange = new EventEmitter();

  constructor() { }

  ngOnInit() {
  }

  getBullets(): number[] {
    return Array(this.count);
  }

  handleChange(event: Event, index: number): void {
    this.bulletChange.emit(index);
  }
}
