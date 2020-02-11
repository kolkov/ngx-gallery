import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';

@Component({
  selector: 'ngx-gallery-action',
  templateUrl: './ngx-gallery-action.component.html',
  styleUrls: ['./ngx-gallery-action.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NgxGalleryActionComponent implements OnInit/*, AfterViewInit*/ {
  @Input() icon: string;
  @Input() disabled = false;
  @Input() titleText = '';

  @Output() closeClick: EventEmitter<Event> = new EventEmitter();

  constructor() {
  }

  ngOnInit() {
  }

  handleClick(event: Event) {
    if (!this.disabled) {
      this.closeClick.emit(event);
    }

    event.stopPropagation();
    event.preventDefault();
  }
}
