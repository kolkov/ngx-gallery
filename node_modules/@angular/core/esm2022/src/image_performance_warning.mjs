/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { IMAGE_CONFIG } from './application/application_tokens';
import { Injectable } from './di';
import { inject } from './di/injector_compatibility';
import { formatRuntimeError } from './errors';
import { getDocument } from './render3/interfaces/document';
import { NgZone } from './zone';
import * as i0 from "./r3_symbols";
// A delay in milliseconds before the scan is run after onLoad, to avoid any
// potential race conditions with other LCP-related functions. This delay
// happens outside of the main JavaScript execution and will only effect the timing
// on when the warning becomes visible in the console.
const SCAN_DELAY = 200;
const OVERSIZED_IMAGE_TOLERANCE = 1200;
export class ImagePerformanceWarning {
    constructor() {
        // Map of full image URLs -> original `ngSrc` values.
        this.window = null;
        this.observer = null;
        this.options = inject(IMAGE_CONFIG);
        this.ngZone = inject(NgZone);
    }
    start() {
        if (typeof PerformanceObserver === 'undefined' ||
            (this.options?.disableImageSizeWarning && this.options?.disableImageLazyLoadWarning)) {
            return;
        }
        this.observer = this.initPerformanceObserver();
        const doc = getDocument();
        const win = doc.defaultView;
        if (typeof win !== 'undefined') {
            this.window = win;
            // Wait to avoid race conditions where LCP image triggers
            // load event before it's recorded by the performance observer
            const waitToScan = () => {
                setTimeout(this.scanImages.bind(this), SCAN_DELAY);
            };
            // Angular doesn't have to run change detection whenever any asynchronous tasks are invoked in
            // the scope of this functionality.
            this.ngZone.runOutsideAngular(() => {
                // Consider the case when the application is created and destroyed multiple times.
                // Typically, applications are created instantly once the page is loaded, and the
                // `window.load` listener is always triggered. However, the `window.load` event will never
                // be fired if the page is loaded, and the application is created later. Checking for
                // `readyState` is the easiest way to determine whether the page has been loaded or not.
                if (doc.readyState === 'complete') {
                    waitToScan();
                }
                else {
                    this.window?.addEventListener('load', waitToScan, { once: true });
                }
            });
        }
    }
    ngOnDestroy() {
        this.observer?.disconnect();
    }
    initPerformanceObserver() {
        if (typeof PerformanceObserver === 'undefined') {
            return null;
        }
        const observer = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            if (entries.length === 0)
                return;
            // We use the latest entry produced by the `PerformanceObserver` as the best
            // signal on which element is actually an LCP one. As an example, the first image to load on
            // a page, by virtue of being the only thing on the page so far, is often a LCP candidate
            // and gets reported by PerformanceObserver, but isn't necessarily the LCP element.
            const lcpElement = entries[entries.length - 1];
            // Cast to `any` due to missing `element` on the `LargestContentfulPaint` type of entry.
            // See https://developer.mozilla.org/en-US/docs/Web/API/LargestContentfulPaint
            const imgSrc = lcpElement.element?.src ?? '';
            // Exclude `data:` and `blob:` URLs, since they are fetched resources.
            if (imgSrc.startsWith('data:') || imgSrc.startsWith('blob:'))
                return;
            this.lcpImageUrl = imgSrc;
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
        return observer;
    }
    scanImages() {
        const images = getDocument().querySelectorAll('img');
        let lcpElementFound, lcpElementLoadedCorrectly = false;
        images.forEach((image) => {
            if (!this.options?.disableImageSizeWarning) {
                for (const image of images) {
                    // Image elements using the NgOptimizedImage directive are excluded,
                    // as that directive has its own version of this check.
                    if (!image.getAttribute('ng-img') && this.isOversized(image)) {
                        logOversizedImageWarning(image.src);
                    }
                }
            }
            if (!this.options?.disableImageLazyLoadWarning && this.lcpImageUrl) {
                if (image.src === this.lcpImageUrl) {
                    lcpElementFound = true;
                    if (image.loading !== 'lazy' || image.getAttribute('ng-img')) {
                        // This variable is set to true and never goes back to false to account
                        // for the case where multiple images have the same src url, and some
                        // have lazy loading while others don't.
                        // Also ignore NgOptimizedImage because there's a different warning for that.
                        lcpElementLoadedCorrectly = true;
                    }
                }
            }
        });
        if (lcpElementFound &&
            !lcpElementLoadedCorrectly &&
            this.lcpImageUrl &&
            !this.options?.disableImageLazyLoadWarning) {
            logLazyLCPWarning(this.lcpImageUrl);
        }
    }
    isOversized(image) {
        if (!this.window) {
            return false;
        }
        const computedStyle = this.window.getComputedStyle(image);
        let renderedWidth = parseFloat(computedStyle.getPropertyValue('width'));
        let renderedHeight = parseFloat(computedStyle.getPropertyValue('height'));
        const boxSizing = computedStyle.getPropertyValue('box-sizing');
        const objectFit = computedStyle.getPropertyValue('object-fit');
        if (objectFit === `cover`) {
            // Object fit cover may indicate a use case such as a sprite sheet where
            // this warning does not apply.
            return false;
        }
        if (boxSizing === 'border-box') {
            const paddingTop = computedStyle.getPropertyValue('padding-top');
            const paddingRight = computedStyle.getPropertyValue('padding-right');
            const paddingBottom = computedStyle.getPropertyValue('padding-bottom');
            const paddingLeft = computedStyle.getPropertyValue('padding-left');
            renderedWidth -= parseFloat(paddingRight) + parseFloat(paddingLeft);
            renderedHeight -= parseFloat(paddingTop) + parseFloat(paddingBottom);
        }
        const intrinsicWidth = image.naturalWidth;
        const intrinsicHeight = image.naturalHeight;
        const recommendedWidth = this.window.devicePixelRatio * renderedWidth;
        const recommendedHeight = this.window.devicePixelRatio * renderedHeight;
        const oversizedWidth = intrinsicWidth - recommendedWidth >= OVERSIZED_IMAGE_TOLERANCE;
        const oversizedHeight = intrinsicHeight - recommendedHeight >= OVERSIZED_IMAGE_TOLERANCE;
        return oversizedWidth || oversizedHeight;
    }
    static { this.ɵfac = function ImagePerformanceWarning_Factory(t) { return new (t || ImagePerformanceWarning)(); }; }
    static { this.ɵprov = /*@__PURE__*/ i0.ɵɵdefineInjectable({ token: ImagePerformanceWarning, factory: ImagePerformanceWarning.ɵfac, providedIn: 'root' }); }
}
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.setClassMetadata(ImagePerformanceWarning, [{
        type: Injectable,
        args: [{ providedIn: 'root' }]
    }], null, null); })();
function logLazyLCPWarning(src) {
    console.warn(formatRuntimeError(-913 /* RuntimeErrorCode.IMAGE_PERFORMANCE_WARNING */, `An image with src ${src} is the Largest Contentful Paint (LCP) element ` +
        `but was given a "loading" value of "lazy", which can negatively impact ` +
        `application loading performance. This warning can be addressed by ` +
        `changing the loading value of the LCP image to "eager", or by using the ` +
        `NgOptimizedImage directive's prioritization utilities. For more ` +
        `information about addressing or disabling this warning, see ` +
        `https://angular.dev/errors/NG0913`));
}
function logOversizedImageWarning(src) {
    console.warn(formatRuntimeError(-913 /* RuntimeErrorCode.IMAGE_PERFORMANCE_WARNING */, `An image with src ${src} has intrinsic file dimensions much larger than its ` +
        `rendered size. This can negatively impact application loading performance. ` +
        `For more information about addressing or disabling this warning, see ` +
        `https://angular.dev/errors/NG0913`));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2VfcGVyZm9ybWFuY2Vfd2FybmluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2ltYWdlX3BlcmZvcm1hbmNlX3dhcm5pbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFlBQVksRUFBYyxNQUFNLGtDQUFrQyxDQUFDO0FBQzNFLE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFDaEMsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ25ELE9BQU8sRUFBQyxrQkFBa0IsRUFBbUIsTUFBTSxVQUFVLENBQUM7QUFFOUQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQzFELE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxRQUFRLENBQUM7O0FBRTlCLDRFQUE0RTtBQUM1RSx5RUFBeUU7QUFDekUsbUZBQW1GO0FBQ25GLHNEQUFzRDtBQUN0RCxNQUFNLFVBQVUsR0FBRyxHQUFHLENBQUM7QUFFdkIsTUFBTSx5QkFBeUIsR0FBRyxJQUFJLENBQUM7QUFHdkMsTUFBTSxPQUFPLHVCQUF1QjtJQURwQztRQUVFLHFEQUFxRDtRQUM3QyxXQUFNLEdBQWtCLElBQUksQ0FBQztRQUM3QixhQUFRLEdBQStCLElBQUksQ0FBQztRQUM1QyxZQUFPLEdBQWdCLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUM1QyxXQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBeUlqQztJQXRJUSxLQUFLO1FBQ1YsSUFDRSxPQUFPLG1CQUFtQixLQUFLLFdBQVc7WUFDMUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLHVCQUF1QixJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsMkJBQTJCLENBQUMsRUFDcEYsQ0FBQztZQUNELE9BQU87UUFDVCxDQUFDO1FBQ0QsSUFBSSxD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TUFBTSxDQUFDLGdCQUFnQixHQUFHLGNBQWMsQ0FBQztRQUN4RSxNQUFNLGNBQWMsR0FBRyxjQUFjLEdBQUcsZ0JBQWdCLElBQUkseUJBQXlCLENBQUM7UUFDdEYsTUFBTSxlQUFlLEdBQUcsZUFBZSxHQUFHLGlCQUFpQixJQUFJLHlCQUF5QixDQUFDO1FBQ3pGLE9BQU8sY0FBYyxJQUFJLGVBQWUsQ0FBQztJQUMzQyxDQUFDO3dGQTdJVSx1QkFBdUI7dUVBQXZCLHVCQUF1QixXQUF2Qix1QkFBdUIsbUJBRFgsTUFBTTs7Z0ZBQ2xCLHVCQUF1QjtjQURuQyxVQUFVO2VBQUMsRUFBQyxVQUFVLEVBQUUsTUFBTSxFQUFDOztBQWlKaEMsU0FBUyxpQkFBaUIsQ0FBQyxHQUFXO0lBQ3BDLE9BQU8sQ0FBQyxJQUFJLENBQ1Ysa0JBQWtCLHdEQUVoQixxQkFBcUIsR0FBRyxpREFBaUQ7UUFDdkUseUVBQXlFO1FBQ3pFLG9FQUFvRTtRQUNwRSwwRUFBMEU7UUFDMUUsa0VBQWtFO1FBQ2xFLDhEQUE4RDtRQUM5RCxtQ0FBbUMsQ0FDdEMsQ0FDRixDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMsd0JBQXdCLENBQUMsR0FBVztJQUMzQyxPQUFPLENBQUMsSUFBSSxDQUNWLGtCQUFrQix3REFFaEIscUJBQXFCLEdBQUcsc0RBQXNEO1FBQzVFLDZFQUE2RTtRQUM3RSx1RUFBdUU7UUFDdkUsbUNBQW1DLENBQ3RDLENBQ0YsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtJTUFHRV9DT05GSUcsIEltYWdlQ29uZmlnfSBmcm9tICcuL2FwcGxpY2F0aW9uL2FwcGxpY2F0aW9uX3Rva2Vucyc7XG5pbXBvcnQge0luamVjdGFibGV9IGZyb20gJy4vZGknO1xuaW1wb3J0IHtpbmplY3R9IGZyb20gJy4vZGkvaW5qZWN0b3JfY29tcGF0aWJpbGl0eSc7XG5pbXBvcnQge2Zvcm1hdFJ1bnRpbWVFcnJvciwgUnVudGltZUVycm9yQ29kZX0gZnJvbSAnLi9lcnJvcnMnO1xuaW1wb3J0IHtPbkRlc3Ryb3l9IGZyb20gJy4vaW50ZXJmYWNlL2xpZmVjeWNsZV9ob29rcyc7XG5pbXBvcnQge2dldERvY3VtZW50fSBmcm9tICcuL3JlbmRlcjMvaW50ZXJmYWNlcy9kb2N1bWVudCc7XG5pbXBvcnQge05nWm9uZX0gZnJvbSAnLi96b25lJztcblxuLy8gQSBkZWxheSBpbiBtaWxsaXNlY29uZHMgYmVmb3JlIHRoZSBzY2FuIGlzIHJ1biBhZnRlciBvbkxvYWQsIHRvIGF2b2lkIGFueVxuLy8gcG90ZW50aWFsIHJhY2UgY29uZGl0aW9ucyB3aXRoIG90aGVyIExDUC1yZWxhdGVkIGZ1bmN0aW9ucy4gVGhpcyBkZWxheVxuLy8gaGFwcGVucyBvdXRzaWRlIG9mIHRoZSBtYWluIEphdmFTY3JpcHQgZXhlY3V0aW9uIGFuZCB3aWxsIG9ubHkgZWZmZWN0IHRoZSB0aW1pbmdcbi8vIG9uIHdoZW4gdGhlIHdhcm5pbmcgYmVjb21lcyB2aXNpYmxlIGluIHRoZSBjb25zb2xlLlxuY29uc3QgU0NBTl9ERUxBWSA9IDIwMDtcblxuY29uc3QgT1ZFUlNJWkVEX0lNQUdFX1RPTEVSQU5DRSA9IDEyMDA7XG5cbkBJbmplY3RhYmxlKHtwcm92aWRlZEluOiAncm9vdCd9KVxuZXhwb3J0IGNsYXNzIEltYWdlUGVyZm9ybWFuY2VXYXJuaW5nIGltcGxlbWVudHMgT25EZXN0cm95IHtcbiAgLy8gTWFwIG9mIGZ1bGwgaW1hZ2UgVVJMcyAtPiBvcmlnaW5hbCBgbmdTcmNgIHZhbHVlcy5cbiAgcHJpdmF0ZSB3aW5kb3c6IFdpbmRvdyB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIG9ic2VydmVyOiBQZXJmb3JtYW5jZU9ic2VydmVyIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgb3B0aW9uczogSW1hZ2VDb25maWcgPSBpbmplY3QoSU1BR0VfQ09ORklHKTtcbiAgcHJpdmF0ZSBuZ1pvbmUgPSBpbmplY3QoTmdab25lKTtcbiAgcHJpdmF0ZSBsY3BJbWFnZVVybD86IHN0cmluZztcblxuICBwdWJsaWMgc3RhcnQoKSB7XG4gICAgaWYgKFxuICAgICAgdHlwZW9mIFBlcmZvcm1hbmNlT2JzZXJ2ZXIgPT09ICd1bmRlZmluZWQnIHx8XG4gICAgICAodGhpcy5vcHRpb25zPy5kaXNhYmxlSW1hZ2VTaXplV2FybmluZyAmJiB0aGlzLm9wdGlvbnM/LmRpc2FibGVJbWFnZUxhenlMb2FkV2FybmluZylcbiAgICApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5vYnNlcnZlciA9IHRoaXMuaW5pdFBlcmZvcm1hbmNlT2JzZXJ2ZXIoKTtcbiAgICBjb25zdCBkb2MgPSBnZXREb2N1bWVudCgpO1xuICAgIGNvbnN0IHdpbiA9IGRvYy5kZWZhdWx0VmlldztcbiAgICBpZiAodHlwZW9mIHdpbiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMud2luZG93ID0gd2luO1xuICAgICAgLy8gV2FpdCB0byBhdm9pZCByYWNlIGNvbmRpdGlvbnMgd2hlcmUgTENQIGltYWdlIHRyaWdnZXJzXG4gICAgICAvLyBsb2FkIGV2ZW50IGJlZm9yZSBpdCdzIHJlY29yZGVkIGJ5IHRoZSBwZXJmb3JtYW5jZSBvYnNlcnZlclxuICAgICAgY29uc3Qgd2FpdFRvU2NhbiA9ICgpID0+IHtcbiAgICAgICAgc2V0VGltZW91dCh0aGlzLnNjYW5JbWFnZXMuYmluZCh0aGlzKSwgU0NBTl9ERUxBWSk7XG4gICAgICB9O1xuICAgICAgLy8gQW5ndWxhciBkb2Vzbid0IGhhdmUgdG8gcnVuIGNoYW5nZSBkZXRlY3Rpb24gd2hlbmV2ZXIgYW55IGFzeW5jaHJvbm91cyB0YXNrcyBhcmUgaW52b2tlZCBpblxuICAgICAgLy8gdGhlIHNjb3BlIG9mIHRoaXMgZnVuY3Rpb25hbGl0eS5cbiAgICAgIHRoaXMubmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+IHtcbiAgICAgICAgLy8gQ29uc2lkZXIgdGhlIGNhc2Ugd2hlbiB0aGUgYXBwbGljYXRpb24gaXMgY3JlYXRlZCBhbmQgZGVzdHJveWVkIG11bHRpcGxlIHRpbWVzLlxuICAgICAgICAvLyBUeXBpY2FsbHksIGFwcGxpY2F0aW9ucyBhcmUgY3JlYXRlZCBpbnN0YW50bHkgb25jZSB0aGUgcGFnZSBpcyBsb2FkZWQsIGFuZCB0aGVcbiAgICAgICAgLy8gYHdpbmRvdy5sb2FkYCBsaXN0ZW5lciBpcyBhbHdheXMgdHJpZ2dlcmVkLiBIb3dldmVyLCB0aGUgYHdpbmRvdy5sb2FkYCBldmVudCB3aWxsIG5ldmVyXG4gICAgICAgIC8vIGJlIGZpcmVkIGlmIHRoZSBwYWdlIGlzIGxvYWRlZCwgYW5kIHRoZSBhcHBsaWNhdGlvbiBpcyBjcmVhdGVkIGxhdGVyLiBDaGVja2luZyBmb3JcbiAgICAgICAgLy8gYHJlYWR5U3RhdGVgIGlzIHRoZSBlYXNpZXN0IHdheSB0byBkZXRlcm1pbmUgd2hldGhlciB0aGUgcGFnZSBoYXMgYmVlbiBsb2FkZWQgb3Igbm90LlxuICAgICAgICBpZiAoZG9jLnJlYWR5U3RhdGUgPT09ICdjb21wbGV0ZScpIHtcbiAgICAgICAgICB3YWl0VG9TY2FuKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy53aW5kb3c/LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCB3YWl0VG9TY2FuLCB7b25jZTogdHJ1ZX0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBuZ09uRGVzdHJveSgpIHtcbiAgICB0aGlzLm9ic2VydmVyPy5kaXNjb25uZWN0KCk7XG4gIH1cblxuICBwcml2YXRlIGluaXRQZXJmb3JtYW5jZU9ic2VydmVyKCk6IFBlcmZvcm1hbmNlT2JzZXJ2ZXIgfCBudWxsIHtcbiAgICBpZiAodHlwZW9mIFBlcmZvcm1hbmNlT2JzZXJ2ZXIgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgUGVyZm9ybWFuY2VPYnNlcnZlcigoZW50cnlMaXN0KSA9PiB7XG4gICAgICBjb25zdCBlbnRyaWVzID0gZW50cnlMaXN0LmdldEVudHJpZXMoKTtcbiAgICAgIGlmIChlbnRyaWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgICAgLy8gV2UgdXNlIHRoZSBsYXRlc3QgZW50cnkgcHJvZHVjZWQgYnkgdGhlIGBQZXJmb3JtYW5jZU9ic2VydmVyYCBhcyB0aGUgYmVzdFxuICAgICAgLy8gc2lnbmFsIG9uIHdoaWNoIGVsZW1lbnQgaXMgYWN0dWFsbHkgYW4gTENQIG9uZS4gQXMgYW4gZXhhbXBsZSwgdGhlIGZpcnN0IGltYWdlIHRvIGxvYWQgb25cbiAgICAgIC8vIGEgcGFnZSwgYnkgdmlydHVlIG9mIGJlaW5nIHRoZSBvbmx5IHRoaW5nIG9uIHRoZSBwYWdlIHNvIGZhciwgaXMgb2Z0ZW4gYSBMQ1AgY2FuZGlkYXRlXG4gICAgICAvLyBhbmQgZ2V0cyByZXBvcnRlZCBieSBQZXJmb3JtYW5jZU9ic2VydmVyLCBidXQgaXNuJ3QgbmVjZXNzYXJpbHkgdGhlIExDUCBlbGVtZW50LlxuICAgICAgY29uc3QgbGNwRWxlbWVudCA9IGVudHJpZXNbZW50cmllcy5sZW5ndGggLSAxXTtcblxuICAgICAgLy8gQ2FzdCB0byBgYW55YCBkdWUgdG8gbWlzc2luZyBgZWxlbWVudGAgb24gdGhlIGBMYXJnZXN0Q29udGVudGZ1bFBhaW50YCB0eXBlIG9mIGVudHJ5LlxuICAgICAgLy8gU2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9MYXJnZXN0Q29udGVudGZ1bFBhaW50XG4gICAgICBjb25zdCBpbWdTcmMgPSAobGNwRWxlbWVudCBhcyBhbnkpLmVsZW1lbnQ/LnNyYyA/PyAnJztcblxuICAgICAgLy8gRXhjbHVkZSBgZGF0YTpgIGFuZCBgYmxvYjpgIFVSTHMsIHNpbmNlIHRoZXkgYXJlIGZldGNoZWQgcmVzb3VyY2VzLlxuICAgICAgaWYgKGltZ1NyYy5zdGFydHNXaXRoKCdkYXRhOicpIHx8IGltZ1NyYy5zdGFydHNXaXRoKCdibG9iOicpKSByZXR1cm47XG4gICAgICB0aGlzLmxjcEltYWdlVXJsID0gaW1nU3JjO1xuICAgIH0pO1xuICAgIG9ic2VydmVyLm9ic2VydmUoe3R5cGU6ICdsYXJnZXN0LWNvbnRlbnRmdWwtcGFpbnQnLCBidWZmZXJlZDogdHJ1ZX0pO1xuICAgIHJldHVybiBvYnNlcnZlcjtcbiAgfVxuXG4gIHByaXZhdGUgc2NhbkltYWdlcygpOiB2b2lkIHtcbiAgICBjb25zdCBpbWFnZXMgPSBnZXREb2N1bWVudCgpLnF1ZXJ5U2VsZWN0b3JBbGwoJ2ltZycpO1xuICAgIGxldCBsY3BFbGVtZW50Rm91bmQsXG4gICAgICBsY3BFbGVtZW50TG9hZGVkQ29ycmVjdGx5ID0gZmFsc2U7XG4gICAgaW1hZ2VzLmZvckVhY2goKGltYWdlKSA9PiB7XG4gICAgICBpZiAoIXRoaXMub3B0aW9ucz8uZGlzYWJsZUltYWdlU2l6ZVdhcm5pbmcpIHtcbiAgICAgICAgZm9yIChjb25zdCBpbWFnZSBvZiBpbWFnZXMpIHtcbiAgICAgICAgICAvLyBJbWFnZSBlbGVtZW50cyB1c2luZyB0aGUgTmdPcHRpbWl6ZWRJbWFnZSBkaXJlY3RpdmUgYXJlIGV4Y2x1ZGVkLFxuICAgICAgICAgIC8vIGFzIHRoYXQgZGlyZWN0aXZlIGhhcyBpdHMgb3duIHZlcnNpb24gb2YgdGhpcyBjaGVjay5cbiAgICAgICAgICBpZiAoIWltYWdlLmdldEF0dHJpYnV0ZSgnbmctaW1nJykgJiYgdGhpcy5pc092ZXJzaXplZChpbWFnZSkpIHtcbiAgICAgICAgICAgIGxvZ092ZXJzaXplZEltYWdlV2FybmluZyhpbWFnZS5zcmMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLm9wdGlvbnM/LmRpc2FibGVJbWFnZUxhenlMb2FkV2FybmluZyAmJiB0aGlzLmxjcEltYWdlVXJsKSB7XG4gICAgICAgIGlmIChpbWFnZS5zcmMgPT09IHRoaXMubGNwSW1hZ2VVcmwpIHtcbiAgICAgICAgICBsY3BFbGVtZW50Rm91bmQgPSB0cnVlO1xuICAgICAgICAgIGlmIChpbWFnZS5sb2FkaW5nICE9PSAnbGF6eScgfHwgaW1hZ2UuZ2V0QXR0cmlidXRlKCduZy1pbWcnKSkge1xuICAgICAgICAgICAgLy8gVGhpcyB2YXJpYWJsZSBpcyBzZXQgdG8gdHJ1ZSBhbmQgbmV2ZXIgZ29lcyBiYWNrIHRvIGZhbHNlIHRvIGFjY291bnRcbiAgICAgICAgICAgIC8vIGZvciB0aGUgY2FzZSB3aGVyZSBtdWx0aXBsZSBpbWFnZXMgaGF2ZSB0aGUgc2FtZSBzcmMgdXJsLCBhbmQgc29tZVxuICAgICAgICAgICAgLy8gaGF2ZSBsYXp5IGxvYWRpbmcgd2hpbGUgb3RoZXJzIGRvbid0LlxuICAgICAgICAgICAgLy8gQWxzbyBpZ25vcmUgTmdPcHRpbWl6ZWRJbWFnZSBiZWNhdXNlIHRoZXJlJ3MgYSBkaWZmZXJlbnQgd2FybmluZyBmb3IgdGhhdC5cbiAgICAgICAgICAgIGxjcEVsZW1lbnRMb2FkZWRDb3JyZWN0bHkgPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIGlmIChcbiAgICAgIGxjcEVsZW1lbnRGb3VuZCAmJlxuICAgICAgIWxjcEVsZW1lbnRMb2FkZWRDb3JyZWN0bHkgJiZcbiAgICAgIHRoaXMubGNwSW1hZ2VVcmwgJiZcbiAgICAgICF0aGlzLm9wdGlvbnM/LmRpc2FibGVJbWFnZUxhenlMb2FkV2FybmluZ1xuICAgICkge1xuICAgICAgbG9nTGF6eUxDUFdhcm5pbmcodGhpcy5sY3BJbWFnZVVybCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBpc092ZXJzaXplZChpbWFnZTogSFRNTEltYWdlRWxlbWVudCk6IGJvb2xlYW4ge1xuICAgIGlmICghdGhpcy53aW5kb3cpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgY29tcHV0ZWRTdHlsZSA9IHRoaXMud2luZG93LmdldENvbXB1dGVkU3R5bGUoaW1hZ2UpO1xuICAgIGxldCByZW5kZXJlZFdpZHRoID0gcGFyc2VGbG9hdChjb21wdXRlZFN0eWxlLmdldFByb3BlcnR5VmFsdWUoJ3dpZHRoJykpO1xuICAgIGxldCByZW5kZXJlZEhlaWdodCA9IHBhcnNlRmxvYXQoY29tcHV0ZWRTdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCdoZWlnaHQnKSk7XG4gICAgY29uc3QgYm94U2l6aW5nID0gY29tcHV0ZWRTdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCdib3gtc2l6aW5nJyk7XG4gICAgY29uc3Qgb2JqZWN0Rml0ID0gY29tcHV0ZWRTdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCdvYmplY3QtZml0Jyk7XG5cbiAgICBpZiAob2JqZWN0Rml0ID09PSBgY292ZXJgKSB7XG4gICAgICAvLyBPYmplY3QgZml0IGNvdmVyIG1heSBpbmRpY2F0ZSBhIHVzZSBjYXNlIHN1Y2ggYXMgYSBzcHJpdGUgc2hlZXQgd2hlcmVcbiAgICAgIC8vIHRoaXMgd2FybmluZyBkb2VzIG5vdCBhcHBseS5cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoYm94U2l6aW5nID09PSAnYm9yZGVyLWJveCcpIHtcbiAgICAgIGNvbnN0IHBhZGRpbmdUb3AgPSBjb21wdXRlZFN0eWxlLmdldFByb3BlcnR5VmFsdWUoJ3BhZGRpbmctdG9wJyk7XG4gICAgICBjb25zdCBwYWRkaW5nUmlnaHQgPSBjb21wdXRlZFN0eWxlLmdldFByb3BlcnR5VmFsdWUoJ3BhZGRpbmctcmlnaHQnKTtcbiAgICAgIGNvbnN0IHBhZGRpbmdCb3R0b20gPSBjb21wdXRlZFN0eWxlLmdldFByb3BlcnR5VmFsdWUoJ3BhZGRpbmctYm90dG9tJyk7XG4gICAgICBjb25zdCBwYWRkaW5nTGVmdCA9IGNvbXB1dGVkU3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgncGFkZGluZy1sZWZ0Jyk7XG4gICAgICByZW5kZXJlZFdpZHRoIC09IHBhcnNlRmxvYXQocGFkZGluZ1JpZ2h0KSArIHBhcnNlRmxvYXQocGFkZGluZ0xlZnQpO1xuICAgICAgcmVuZGVyZWRIZWlnaHQgLT0gcGFyc2VGbG9hdChwYWRkaW5nVG9wKSArIHBhcnNlRmxvYXQocGFkZGluZ0JvdHRvbSk7XG4gICAgfVxuXG4gICAgY29uc3QgaW50cmluc2ljV2lkdGggPSBpbWFnZS5uYXR1cmFsV2lkdGg7XG4gICAgY29uc3QgaW50cmluc2ljSGVpZ2h0ID0gaW1hZ2UubmF0dXJhbEhlaWdodDtcblxuICAgIGNvbnN0IHJlY29tbWVuZGVkV2lkdGggPSB0aGlzLndpbmRvdy5kZXZpY2VQaXhlbFJhdGlvICogcmVuZGVyZWRXaWR0aDtcbiAgICBjb25zdCByZWNvbW1lbmRlZEhlaWdodCA9IHRoaXMud2luZG93LmRldmljZVBpeGVsUmF0aW8gKiByZW5kZXJlZEhlaWdodDtcbiAgICBjb25zdCBvdmVyc2l6ZWRXaWR0aCA9IGludHJpbnNpY1dpZHRoIC0gcmVjb21tZW5kZWRXaWR0aCA+PSBPVkVSU0laRURfSU1BR0VfVE9MRVJBTkNFO1xuICAgIGNvbnN0IG92ZXJzaXplZEhlaWdodCA9IGludHJpbnNpY0hlaWdodCAtIHJlY29tbWVuZGVkSGVpZ2h0ID49IE9WRVJTSVpFRF9JTUFHRV9UT0xFUkFOQ0U7XG4gICAgcmV0dXJuIG92ZXJzaXplZFdpZHRoIHx8IG92ZXJzaXplZEhlaWdodDtcbiAgfVxufVxuXG5mdW5jdGlvbiBsb2dMYXp5TENQV2FybmluZyhzcmM6IHN0cmluZykge1xuICBjb25zb2xlLndhcm4oXG4gICAgZm9ybWF0UnVudGltZUVycm9yKFxuICAgICAgUnVudGltZUVycm9yQ29kZS5JTUFHRV9QRVJGT1JNQU5DRV9XQVJOSU5HLFxuICAgICAgYEFuIGltYWdlIHdpdGggc3JjICR7c3JjfSBpcyB0aGUgTGFyZ2VzdCBDb250ZW50ZnVsIFBhaW50IChMQ1ApIGVsZW1lbnQgYCArXG4gICAgICAgIGBidXQgd2FzIGdpdmVuIGEgXCJsb2FkaW5nXCIgdmFsdWUgb2YgXCJsYXp5XCIsIHdoaWNoIGNhbiBuZWdhdGl2ZWx5IGltcGFjdCBgICtcbiAgICAgICAgYGFwcGxpY2F0aW9uIGxvYWRpbmcgcGVyZm9ybWFuY2UuIFRoaXMgd2FybmluZyBjYW4gYmUgYWRkcmVzc2VkIGJ5IGAgK1xuICAgICAgICBgY2hhbmdpbmcgdGhlIGxvYWRpbmcgdmFsdWUgb2YgdGhlIExDUCBpbWFnZSB0byBcImVhZ2VyXCIsIG9yIGJ5IHVzaW5nIHRoZSBgICtcbiAgICAgICAgYE5nT3B0aW1pemVkSW1hZ2UgZGlyZWN0aXZlJ3MgcHJpb3JpdGl6YXRpb24gdXRpbGl0aWVzLiBGb3IgbW9yZSBgICtcbiAgICAgICAgYGluZm9ybWF0aW9uIGFib3V0IGFkZHJlc3Npbmcgb3IgZGlzYWJsaW5nIHRoaXMgd2FybmluZywgc2VlIGAgK1xuICAgICAgICBgaHR0cHM6Ly9hbmd1bGFyLmRldi9lcnJvcnMvTkcwOTEzYCxcbiAgICApLFxuICApO1xufVxuXG5mdW5jdGlvbiBsb2dPdmVyc2l6ZWRJbWFnZVdhcm5pbmcoc3JjOiBzdHJpbmcpIHtcbiAgY29uc29sZS53YXJuKFxuICAgIGZvcm1hdFJ1bnRpbWVFcnJvcihcbiAgICAgIFJ1bnRpbWVFcnJvckNvZGUuSU1BR0VfUEVSRk9STUFOQ0VfV0FSTklORyxcbiAgICAgIGBBbiBpbWFnZSB3aXRoIHNyYyAke3NyY30gaGFzIGludHJpbnNpYyBmaWxlIGRpbWVuc2lvbnMgbXVjaCBsYXJnZXIgdGhhbiBpdHMgYCArXG4gICAgICAgIGByZW5kZXJlZCBzaXplLiBUaGlzIGNhbiBuZWdhdGl2ZWx5IGltcGFjdCBhcHBsaWNhdGlvbiBsb2FkaW5nIHBlcmZvcm1hbmNlLiBgICtcbiAgICAgICAgYEZvciBtb3JlIGluZm9ybWF0aW9uIGFib3V0IGFkZHJlc3Npbmcgb3IgZGlzYWJsaW5nIHRoaXMgd2FybmluZywgc2VlIGAgK1xuICAgICAgICBgaHR0cHM6Ly9hbmd1bGFyLmRldi9lcnJvcnMvTkcwOTEzYCxcbiAgICApLFxuICApO1xufVxuIl19