# NgxGallery
[![npm version](https://badge.fury.io/js/%40kolkov%2Fngx-gallery.svg)](https://badge.fury.io/js/%40kolkov%2Fngx-gallery)
[![demo](https://img.shields.io/badge/demo-StackBlitz-blueviolet.svg)](https://stackblitz.com/edit/ngx-gallery)
[![Build Status](https://travis-ci.com/kolkov/ngx-gallery.svg?branch=master)](https://travis-ci.com/kolkov/ngx-gallery)
[![npm](https://img.shields.io/npm/dw/@kolkov/ngx-gallery.svg)](https://www.npmjs.com/package/@kolkov/ngx-gallery)
[![](https://data.jsdelivr.com/v1/package/npm/@kolkov/ngx-gallery/badge?style=rounded)](https://www.jsdelivr.com/package/npm/@kolkov/ngx-gallery)
[![Coverage Status](https://coveralls.io/repos/github/kolkov/ngx-gallery/badge.svg?branch=master)](https://coveralls.io/github/kolkov/ngx-gallery?branch=master)
[![dependencies Status](https://david-dm.org/kolkov/ngx-gallery/status.svg)](https://david-dm.org/kolkov/ngx-gallery)
[![devDependencies Status](https://david-dm.org/kolkov/ngx-gallery/dev-status.svg)](https://david-dm.org/kolkov/ngx-gallery?type=dev)
[![codecov](https://codecov.io/gh/kolkov/ngx-gallery/branch/master/graph/badge.svg)](https://codecov.io/gh/kolkov/ngx-gallery)

A simple native gallery component for Angular 8+.

## Demo
Demo is here [demo][demo]

Working code for this demo at stackblitz [example](https://stackblitz.com/edit/ngx-gallery-wysiwyg)

## Getting Started

### Installation

Install via [npm][npm] package manager 

```bash
npm install @kolkov/ngx-gallery --save
```
### Versions

1.x.x and above - for Angular v8.x.x

### Usage

Import `ngx-gallery` module

```typescript
import { HttpClientModule} from '@angular/common/http';
import { AngularGalleryModule } from '@kolkov/ngx-gallery'; import {NgxGalleryModule} from './ngx-gallery.module';

@NgModule({
  imports: [ HttpClientModule, NgxGalleryModule ]
})
```

Then in HTML

```html
<ngx-gallery [options]="galleryOptions" [images]="galleryImages" class="ngx-gallery"></ngx-gallery>
```

where

```typescript
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

## Documentation

The documentation for the NgxGallery is hosted at our website [NgxGallery](https://ngx-gallery.kolkov.ru/)

## Contributing

Please read through our [contributing guidelines](https://github.com/kolkov/ngx-gallery/blob/master/CONTRIBUTING.md). Included are directions for opening issues, coding standards, and notes on development.

Editor preferences are available in the [editor config](https://github.com/kolkov/ngx-gallery/blob/master/.editorconfig) for easy use in common text editors. Read more and download plugins at <http://editorconfig.org>.

## Versioning

For transparency into our release cycle and in striving to maintain backward compatibility, NgxGallery is maintained under [the Semantic Versioning guidelines](http://semver.org/).

See [the Releases section of our project](https://github.com/kolkov/ngx-gallery/releases) for changelogs for each release version.

## Creators

**Andrey Kolkov**

* <https://github.com/kolkov>

[npm]: https://www.npmjs.com/
[demo]: https://ngx-gallery-wysiwyg.stackblitz.io/
[example]: https://stackblitz.com/edit/ngx-gallery
