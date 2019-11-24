import {AfterViewInit, ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';

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

  // tslint:disable-next-line:no-output-native
  @Output() click: EventEmitter<Event> = new EventEmitter();

  constructor() { }

  ngOnInit() {
  }

  handleClick(event: Event) {
    if (!this.disabled) {
      this.click.emit(event);
    }

    event.stopPropagation();
    event.preventDefault();
  }

  /*ngAfterViewInit(): void {
    this.icon = 'fa fa-times-circle';
  }*/
}
