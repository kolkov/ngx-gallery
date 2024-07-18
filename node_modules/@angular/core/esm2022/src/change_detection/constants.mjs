/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * The strategy that the default change detector uses to detect changes.
 * When set, takes effect the next time change detection is triggered.
 *
 * @see [Change detection usage](/api/core/ChangeDetectorRef?tab=usage-notes)
 * @see [Skipping component subtrees](/best-practices/skipping-subtrees)
 *
 * @publicApi
 */
export var ChangeDetectionStrategy;
(function (ChangeDetectionStrategy) {
    /**
     * Use the `CheckOnce` strategy, meaning that automatic change detection is deactivated
     * until reactivated by setting the strategy to `Default` (`CheckAlways`).
     * Change detection can still be explicitly invoked.
     * This strategy applies to all child directives and cannot be overridden.
     */
    ChangeDetectionStrategy[ChangeDetectionStrategy["OnPush"] = 0] = "OnPush";
    /**
     * Use the default `CheckAlways` strategy, in which change detection is automatic until
     * explicitly deactivated.
     */
    ChangeDetectionStrategy[ChangeDetectionStrategy["Default"] = 1] = "Default";
})(ChangeDetectionStrategy || (ChangeDetectionStrategy = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvY2hhbmdlX2RldGVjdGlvbi9jb25zdGFudHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUg7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFNLENBQU4sSUFBWSx1QkFjWDtBQWRELFdBQVksdUJBQXVCO0lBQ2pDOzs7OztPQUtHO0lBQ0gseUVBQVUsQ0FBQTtJQUVWOzs7T0FHRztJQUNILDJFQUFXLENBQUE7QUFDYixDQUFDLEVBZFcsdUJBQXVCLEtBQXZCLHVCQUF1QixRQWNsQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vKipcbiAqIFRoZSBzdHJhdGVneSB0aGF0IHRoZSBkZWZhdWx0IGNoYW5nZSBkZXRlY3RvciB1c2VzIHRvIGRldGVjdCBjaGFuZ2VzLlxuICogV2hlbiBzZXQsIHRha2VzIGVmZmVjdCB0aGUgbmV4dCB0aW1lIGNoYW5nZSBkZXRlY3Rpb24gaXMgdHJpZ2dlcmVkLlxuICpcbiAqIEBzZWUgW0NoYW5nZSBkZXRlY3Rpb24gdXNhZ2VdKC9hcGkvY29yZS9DaGFuZ2VEZXRlY3RvclJlZj90YWI9dXNhZ2Utbm90ZXMpXG4gKiBAc2VlIFtTa2lwcGluZyBjb21wb25lbnQgc3VidHJlZXNdKC9iZXN0LXByYWN0aWNlcy9za2lwcGluZy1zdWJ0cmVlcylcbiAqXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBlbnVtIENoYW5nZURldGVjdGlvblN0cmF0ZWd5IHtcbiAgLyoqXG4gICAqIFVzZSB0aGUgYENoZWNrT25jZWAgc3RyYXRlZ3ksIG1lYW5pbmcgdGhhdCBhdXRvbWF0aWMgY2hhbmdlIGRldGVjdGlvbiBpcyBkZWFjdGl2YXRlZFxuICAgKiB1bnRpbCByZWFjdGl2YXRlZCBieSBzZXR0aW5nIHRoZSBzdHJhdGVneSB0byBgRGVmYXVsdGAgKGBDaGVja0Fsd2F5c2ApLlxuICAgKiBDaGFuZ2UgZGV0ZWN0aW9uIGNhbiBzdGlsbCBiZSBleHBsaWNpdGx5IGludm9rZWQuXG4gICAqIFRoaXMgc3RyYXRlZ3kgYXBwbGllcyB0byBhbGwgY2hpbGQgZGlyZWN0aXZlcyBhbmQgY2Fubm90IGJlIG92ZXJyaWRkZW4uXG4gICAqL1xuICBPblB1c2ggPSAwLFxuXG4gIC8qKlxuICAgKiBVc2UgdGhlIGRlZmF1bHQgYENoZWNrQWx3YXlzYCBzdHJhdGVneSwgaW4gd2hpY2ggY2hhbmdlIGRldGVjdGlvbiBpcyBhdXRvbWF0aWMgdW50aWxcbiAgICogZXhwbGljaXRseSBkZWFjdGl2YXRlZC5cbiAgICovXG4gIERlZmF1bHQgPSAxLFxufVxuIl19