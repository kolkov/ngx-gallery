# NgxGallery
[![npm version](https://badge.fury.io/js/%40kolkov%2Fngx-gallery.svg)](https://badge.fury.io/js/%40kolkov%2Fngx-gallery)
[![demo](https://img.shields.io/badge/demo-StackBlitz-blueviolet.svg)](https://stackblitz.com/edit/kolkov-ngx-gallery)
[![Build Status](https://travis-ci.com/kolkov/ngx-gallery.svg?branch=master)](https://travis-ci.com/kolkov/ngx-gallery)
[![npm](https://img.shields.io/npm/dw/@kolkov/ngx-gallery.svg)](https://www.npmjs.com/package/@kolkov/ngx-gallery)
[![](https://data.jsdelivr.com/v1/package/npm/@kolkov/ngx-gallery/badge?style=rounded)](https://www.jsdelivr.com/package/npm/@kolkov/ngx-gallery)
[![Coverage Status](https://coveralls.io/repos/github/kolkov/ngx-gallery/badge.svg?branch=master)](https://coveralls.io/github/kolkov/ngx-gallery?branch=master)
[![dependencies Status](https://david-dm.org/kolkov/ngx-gallery/status.svg)](https://david-dm.org/kolkov/ngx-gallery)
[![devDependencies Status](https://david-dm.org/kolkov/ngx-gallery/dev-status.svg)](https://david-dm.org/kolkov/ngx-gallery?type=dev)
[![codecov](https://codecov.io/gh/kolkov/ngx-gallery/branch/master/graph/badge.svg)](https://codecov.io/gh/kolkov/ngx-gallery)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/AndreyKolkov)

A simple native gallery component for Angular 8+.

## Demo
Demo is here [demo][demo]

Working code for this demo at stackblitz [example](https://stackblitz.com/edit/kolkov-ngx-gallery)

## Getting Started

### Installation

Install via [npm][npm] package manager 

```bash
npm install @kolkov/ngx-gallery --save
```
### Versions

1.x.x and above - for Angular v8+

### Usage

Import `ngx-gallery` module

```js
import { HttpClientModule} from '@angular/common/http';
import { NgxGalleryModule } from '@kolkov/ngx-gallery';

@NgModule({
  imports: [ HttpClientModule, NgxGalleryModule ]
})
```

Then in HTML

```html
<ngx-gallery [options]="galleryOptions" [images]="galleryImages" class="ngx-gallery"></ngx-gallery>
```

where

```
import {Component, OnInit} from '@angular/core';
import {NgxGalleryOptions} from '@kolkov/ngx-gallery';
import {NgxGalleryImage} from '@kolkov/ngx-gallery';
import {NgxGalleryAnimation} from '@kolkov/ngx-gallery';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit{
  galleryOptions: NgxGalleryOptions[];
  galleryImages: NgxGalleryImage[];

  constructor() { }

  ngOnInit() {
    this.galleryOptions = [
      {
        width: '600px',
        height: '400px',
        thumbnailsColumns: 4,
        imageAnimation: NgxGalleryAnimation.Slide
      },
      // max-width 800
      {
        breakpoint: 800,
        width: '100%',
        height: '600px',
        imagePercent: 80,
        thumbnailsPercent: 20,
        thumbnailsMargin: 20,
        thumbnailMargin: 20
      },
      // max-width 400
      {
        breakpoint: 400,
        preview: false
      }
    ];

    this.galleryImages = [
      {
        small: 'assets/img/gallery/1-small.jpeg',
        medium: 'assets/img/gallery/1-medium.jpeg',
        big: 'assets/img/gallery/1-big.jpeg'
      },
      {
        small: 'assets/img/gallery/2-small.jpeg',
        medium: 'assets/img/gallery/2-medium.jpeg',
        big: 'assets/img/gallery/2-big.jpeg'
      },
      {
        small: 'assets/img/gallery/3-small.jpeg',
        medium: 'assets/img/gallery/3-medium.jpeg',
        big: 'assets/img/gallery/3-big.jpeg'
      },{
        small: 'assets/img/gallery/4-small.jpeg',
        medium: 'assets/img/gallery/4-medium.jpeg',
        big: 'assets/img/gallery/4-big.jpeg'
      },
      {
        small: 'assets/img/gallery/5-small.jpeg',
        medium: 'assets/img/gallery/5-medium.jpeg',
        big: 'assets/img/gallery/5-big.jpeg'
      }
    ];
  }
}
```
add this class to app CSS `.ngx-gallery { display: inline-block; margin-bottom: 20px; }`

## API
### Inputs
| Input  | Type | Default | Required | Description |
| ------------- | ------------- | ------------- | ------------- | ------------- |
| [options] | `NgxGalleryOptions[]` | `-` | no | Config options for the Gallery |
| [images] | `NgxGalleryImage[]` | `-` | no | Images array |

### Outputs

| Output  | Description |
| ------------- | ------------- |
| (change)  | Triggered on image change |
| (imagesReady)  | Triggered when images length > 0 |
| (previewOpen)  |  Triggered on preview open |
| (previewClose)  |  Triggered on preview close |
| (previewChange)  |  Triggered on preview image change |

### Methods

 Name  | Description |
| ------------- | ------------- |
| show(index: number): void  | Shows image at index |
| showNext(): void  | Shows next image |
| showPrev(): void  | Shows prev image |
| canShowNext(): boolean  | Returns true if there is next image |
| canShowPrev(): boolean  | Returns true if there is prev image |
| openPreview(index: number): void  | Opens preview at index |
| moveThumbnailsLeft(): void  | Moves thumbnails to left |
| moveThumbnailsRight(): void  | Moves thumbnails to right |
| canMoveThumbnailsLeft(): boolean  | Returns true if you can move thumbnails to left |
| canMoveThumbnailsRight(): boolean  | Returns true if you can move thumbnails to right |

### NgxGalleryOptions
#### Layout options
| Input  | Type | Default | Required | Description |
| ------------- | ------------- | ------------- | ------------- | ------------- |
| width  | `string` | `500px` | no | Gallery width |
| height  | `string` | `400px` | no | Gallery height |
| breakpoint  | `number` | `undefined` | no | Responsive breakpoint, works like media query max-width |
| fullWidth  | `bolean` | `false` | no | Sets the same width as browser |
| layout  | `string` | `NgxGalleryLayout.Bottom` | no | Sets thumbnails position |
| startIndex  | `number` | `0` | no | Sets index of selected image on start |
| linkTarget  | `string` | `_blank` | no | Sets target attribute of link |
| lazyLoading  | `boolean` | `true` | no | Enables/disables lazy loading for images |

#### Image options
| Input  | Type | Default | Required | Description |
| ------------- | ------------- | ------------- | ------------- | ------------- |
| image  | `boolean` | `true` | no | Enables or disables image |
| imageDescription  | `boolean` | `true` | no | Enables or disables description for images |
| imagePercent  | `number` | `75` | no | Percentage height |
| imageArrows  | `boolean` | `true` | no | Enables or disables arrows |
| imageArrowsAutoHide  | `boolean` | `false` | no | Enables or disables arrows auto hide |
| imageSwipe  | `boolean` | `false` | no | Enables or disables swipe |
| imageAnimation  | `string` | `NgxGalleryAnimation.Fade` | no | Animation type |
| imageSize  | `string` | `NgxGalleryImageSize.Cover` | no | Image size |
| imageAutoPlay  | `boolean` | `false` | no | Enables or disables auto play |
| imageAutoPlayInterval  | `number` | `2000` | no | Interval for auto play (ms) |
| imageAutoPlayPauseOnHover  | `boolean` | `false` | no | Enables or disables pause auto play on hover |
| imageInfinityMove  | `boolean` | `false` | no | Enables or disables infinity move by arrows |
| imageActions  | `NgxGalleryAction[]` | `[]` | no | Enables or disables navigation bullets |

#### Thumbnails options
| Input  | Type | Default | Required | Description |
| ------------- | ------------- | ------------- | ------------- | ------------- |
| thumbnails  | `boolean` | `true` | no | Enables or disables thumbnails |
| thumbnailsColumns  | `number` | `4` | no | Columns count |
| thumbnailsRows  | `number` | `1` | no | Rows count |
| thumbnailsPercent  | `number` | `25` | no | Percentage height |
| thumbnailsMargin  | `number` | `10` | no | Margin between thumbnails and image |
| thumbnailsArrows  | `boolean` | `true` | no | Enables or disables arrows |
| thumbnailsArrowsAutoHide  | `boolean` | `false` | no | Enables or disables arrows auto hide |
| thumbnailsSwipe  | `boolean` | `false` | no | Enables or disables swipe |
| thumbnailsMoveSize  | `number` | `1` | no | Number of items to move on arrow click |
| thumbnailsOrder  | `number` | `NgxGalleryOrder.Column` | no | Images order |
| thumbnailsRemainingCount  | `boolean` | `false` | no | If true arrows are disabled and last item has label with remaining count |
| thumbnailsAsLinks  | `boolean` | `false` | no | Enables or disables links on thumbnails |
| thumbnailsAutoHide  | `boolean` | `false` | no | Hides thumbnails if there is only one image |
| thumbnailMargin  | `number` | `10` | no | Margin between images in thumbnails |
| thumbnailSize  | `string` | `NgxGalleryImageSize.Cover` | no | Thumbnail size |
| thumbnailActions  | `NgxGalleryAction[]` | `[]` | no | Array of custom actions |
| thumbnailClasses  | `string[]` | `[]` | no | Custom classes to add to thumbnail component |


#### Preview options
| Input  | Type | Default | Required | Description |
| ------------- | ------------- | ------------- | ------------- | ------------- |
| preview  | `boolean` | `true` | no | Enables or disables preview |
| previewDescription  | `boolean` | `true` | no | Enables or disables description for images |
| previewArrows  | `boolean` | `true` | no | Enables or disables arrows |
| previewArrowsAutoHide  | boolean: `string` | `false` | no | Enables or disables arrows auto hide |
| previewSwipe  | `boolean` | `false` | no | Enables or disables swipe |
| previewFullscreen  | `boolean` | `false` | no | Enables or disables fullscreen icon |
| previewForceFullscreen  | `boolean` | `false` | no | Enables or disables opening preview in fullscreen mode |
| previewCloseOnClick  | `boolean` | `false` | no | Enables or disables closing preview by click |
| previewCloseOnEsc  | `boolean` | `false` | no | Enables or disables closing preview by esc keyboard |
| previewKeyboardNavigation  | `boolean` | `false` | no | Enables or disables navigation by keyboard |
| previewAnimation  | `boolean` | `true` | no | Enables or disables image loading animation |
| previewAutoPlay  | `boolean` | `false` | no | Enables or disables auto play |
| previewAutoPlayInterval  | `number` | `2000` | no | Interval for auto play (ms) |
| previewAutoPlayPauseOnHover  | `boolean` | `false` | no | Enables or disables pouse auto play on hover |
| previewInfinityMove  | `boolean` | `false` | no | Enables or disables infinity move by arrows |
| previewZoom  | `boolean` | `false` | no | Enables or disables zoom in and zoom out |
| previewZoomStep  | `number` | `0.1` | no | Step for zoom change |
| previewZoomMax  | `number` | `2` | no | Max value for zoom |
| previewZoomMin  | `number` | `0.5` | no | Min value for zoom |
| previewRotate  | `boolean` | `false` | no | Enables or disables rotate buttons |
| previewDownload  | `boolean` | `false` | no | Enables or disables download button |
| previewBullets  | `boolean` | `false` | no | Enables or disables navigation bullets |

#### Icons options

| Input  | Type | Default | Required | Description |
| ------------- | ------------- | ------------- | ------------- | ------------- |
| arrowPrevIcon  | `string` | `'fa fa-arrow-circle-left'` | no | Icon for prev arrow |
| arrowNextIcon  | `string` | `'fa fa-arrow-circle-right'` | no | Icon for next arrow |
| closeIcon  | `string` | `'fa fa-times-circle'` | no | Icon for close button |
| fullscreenIcon  | `string` | `'fa fa-arrows-alt'` | no | Icon for fullscreen button |
| spinnerIcon  | `string` | `'fa fa-spinner fa-pulse fa-3x fa-fw'` | no | Icon for spinner |
| zoomInIcon  | `string` | `'fa fa-search-plus'` | no | Icon for zoom in |
| zoomOutIcon  | `string` | `'fa fa-search-minus'` | no | Icon for zoom out |
| rotateLeftIcon  | `string` | `'fa fa-undo'` | no | Icon for rotate left |
| rotateRightIcon  | `string` | `'fa fa-repeat'` | no | Icon for rotate right |
| downloadIcon  | `string` | `'fa fa-arrow-circle-down'` | no | Icon for download |
| actions  | `NgxGalleryAction[]` | `[]` | no | Array of new custom actions that will be added to the left of the current close/zoom/fullscreen icons |

### NgxGalleryImage

| Input  | Type | Default | Required | Description |
| ------------- | ------------- | ------------- | ------------- | ------------- |
| small  | `string/SafeResourceUrl` | `-` | no | Url used in thumbnails |
| medium  | `string/SafeResourceUrl` | `-` | no | Url used in image |
| big  | `string/SafeResourceUrl` | `-` | yes | Url used in preview |
| description  | `string` | `-` | no | Description used in preview |
| url  | `string` | `-` | no | Url used in link |
| label  | `string` | `-` | no | Label used for aria-label when thumbnail is a link |

### NgxGalleryAnimation
- `Fade` (default)
- `Slide`
- `Rotate`
- `Zoom`

### NgxGalleryImageSize
- `Cover` (default)
- `Contain`

### NgxGalleryLayout
- `Top`
- `Bottom` (default)

### NgxGalleryOrder
- `Column` (default)
- `Row`
- `Page`

### NgxGalleryAction
- `icon` | Type: `string` - icon for custom action
- `disabled` | Type: `boolean` | Default value: `false` - if the icon should be disabled
- `titleText` | Type: `string` | Default value: `''` - text to set the title attribute to
- `onClick` | Type: `(event: Event, index: number) => void` - Output function to call when custom action icon is clicked

## What's included

Within the download you'll find the following directories and files. You'll see something like this:

```
ngx-gallery/
└── projects/
    ├── gallery/
    └── gallery-app/
```
`gallery/` - library

`gallery-app/` - demo application


## Contributing

Please read through our [contributing guidelines](https://github.com/kolkov/ngx-gallery/blob/master/CONTRIBUTING.md). Included are directions for opening issues, coding standards, and notes on development.

Editor preferences are available in the [editor config](https://github.com/kolkov/ngx-gallery/blob/master/.editorconfig) for easy use in common text editors. Read more and download plugins at <http://editorconfig.org>.

## Versioning

For transparency into our release cycle and in striving to maintain backward compatibility, NgxGallery is maintained under [the Semantic Versioning guidelines](http://semver.org/).

See [the Releases section of our project](https://github.com/kolkov/ngx-gallery/releases) for changelogs for each release version.

## Creators

**Andrey Kolkov**

* <https://github.com/kolkov>

## Credits

This library is being fully rewritten for next Angular versions from original abandoned library written by Łukasz Gałka. I maintained full compatibility with the original library at the api level.
<https://github.com/lukasz-galka/ngx-gallery>

## Donate

If you like my work, and I save your time you can buy me a :beer: or :pizza: [![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/AndreyKolkov)

[npm]: https://www.npmjs.com/
[demo]: https://kolkov-ngx-gallery.stackblitz.io/
[example]: https://stackblitz.com/edit/kolkov-ngx-gallery
