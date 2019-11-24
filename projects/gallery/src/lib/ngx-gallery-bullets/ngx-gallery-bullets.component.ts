import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';

@Component({
  selector: 'ngx-gallery-bullets',
  templateUrl: './ngx-gallery-bullets.component.html',
  styleUrls: ['./ngx-gallery-bullets.component.scss']
})
export class NgxGalleryBulletsComponent implements OnInit {
  @Input() count: number;
  @Input() active = 0;

  // tslint:disable-next-line:no-output-native
  @Output() change = new EventEmitter();

  constructor() { }

  ngOnInit() {
  }

  getBullets(): number[] {
    return Array(this.count);
  }

  handleChange(event: Event, index: number): void {
    this.change.emit(index);
  }
}
