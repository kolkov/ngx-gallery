/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ChangeDetectorRef } from '../change_detection/change_detector_ref';
/**
 * Represents an Angular view.
 *
 * @see [Change detection usage](/api/core/ChangeDetectorRef?tab=usage-notes)
 *
 * @publicApi
 */
export class ViewRef extends ChangeDetectorRef {
}
/**
 * Represents an Angular view in a view container.
 * An embedded view can be referenced from a component
 * other than the hosting component whose template defines it, or it can be defined
 * independently by a `TemplateRef`.
 *
 * Properties of elements in a view can change, but the structure (number and order) of elements in
 * a view cannot. Change the structure of elements by inserting, moving, or
 * removing nested views in a view container.
 *
 * @see {@link ViewContainerRef}
 *
 * @usageNotes
 *
 * The following template breaks down into two separate `TemplateRef` instances,
 * an outer one and an inner one.
 *
 * ```
 * Count: {{items.length}}
 * <ul>
 *   <li *ngFor="let  item of items">{{item}}</li>
 * </ul>
 * ```
 *
 * This is the outer `TemplateRef`:
 *
 * ```
 * Count: {{items.length}}
 * <ul>
 *   <ng-template ngFor let-item [ngForOf]="items"></ng-template>
 * </ul>
 * ```
 *
 * This is the inner `TemplateRef`:
 *
 * ```
 *   <li>{{item}}</li>
 * ```
 *
 * The outer and inner `TemplateRef` instances are assembled into views as follows:
 *
 * ```
 * <!-- ViewRef: outer-0 -->
 * Count: 2
 * <ul>
 *   <ng-template view-container-ref></ng-template>
 *   <!-- ViewRef: inner-1 --><li>first</li><!-- /ViewRef: inner-1 -->
 *   <!-- ViewRef: inner-2 --><li>second</li><!-- /ViewRef: inner-2 -->
 * </ul>
 * <!-- /ViewRef: outer-0 -->
 * ```
 * @publicApi
 */
export class EmbeddedViewRef extends ViewRef {
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld19yZWYuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9saW5rZXIvdmlld19yZWYudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0seUNBQXlDLENBQUM7QUFFMUU7Ozs7OztHQU1HO0FBQ0gsTUFBTSxPQUFnQixPQUFRLFNBQVEsaUJBQWlCO0NBbUJ0RDtBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBb0RHO0FBQ0gsTUFBTSxPQUFnQixlQUFtQixTQUFRLE9BQU87Q0FVdkQiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDaGFuZ2VEZXRlY3RvclJlZn0gZnJvbSAnLi4vY2hhbmdlX2RldGVjdGlvbi9jaGFuZ2VfZGV0ZWN0b3JfcmVmJztcblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIEFuZ3VsYXIgdmlldy5cbiAqXG4gKiBAc2VlIFtDaGFuZ2UgZGV0ZWN0aW9uIHVzYWdlXSgvYXBpL2NvcmUvQ2hhbmdlRGV0ZWN0b3JSZWY/dGFiPXVzYWdlLW5vdGVzKVxuICpcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFZpZXdSZWYgZXh0ZW5kcyBDaGFuZ2VEZXRlY3RvclJlZiB7XG4gIC8qKlxuICAgKiBEZXN0cm95cyB0aGlzIHZpZXcgYW5kIGFsbCBvZiB0aGUgZGF0YSBzdHJ1Y3R1cmVzIGFzc29jaWF0ZWQgd2l0aCBpdC5cbiAgICovXG4gIGFic3RyYWN0IGRlc3Ryb3koKTogdm9pZDtcblxuICAvKipcbiAgICogUmVwb3J0cyB3aGV0aGVyIHRoaXMgdmlldyBoYXMgYmVlbiBkZXN0cm95ZWQuXG4gICAqIEByZXR1cm5zIFRydWUgYWZ0ZXIgdGhlIGBkZXN0cm95KClgIG1ldGhvZCBoYXMgYmVlbiBjYWxsZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICovXG4gIGFic3RyYWN0IGdldCBkZXN0cm95ZWQoKTogYm9vbGVhbjtcblxuICAvKipcbiAgICogQSBsaWZlY3ljbGUgaG9vayB0aGF0IHByb3ZpZGVzIGFkZGl0aW9uYWwgZGV2ZWxvcGVyLWRlZmluZWQgY2xlYW51cFxuICAgKiBmdW5jdGlvbmFsaXR5IGZvciB2aWV3cy5cbiAgICogQHBhcmFtIGNhbGxiYWNrIEEgaGFuZGxlciBmdW5jdGlvbiB0aGF0IGNsZWFucyB1cCBkZXZlbG9wZXItZGVmaW5lZCBkYXRhXG4gICAqIGFzc29jaWF0ZWQgd2l0aCBhIHZpZXcuIENhbGxlZCB3aGVuIHRoZSBgZGVzdHJveSgpYCBtZXRob2QgaXMgaW52b2tlZC5cbiAgICovXG4gIGFic3RyYWN0IG9uRGVzdHJveShjYWxsYmFjazogRnVuY3Rpb24pOiB2b2lkO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gQW5ndWxhciB2aWV3IGluIGEgdmlldyBjb250YWluZXIuXG4gKiBBbiBlbWJlZGRlZCB2aWV3IGNhbiBiZSByZWZlcmVuY2VkIGZyb20gYSBjb21wb25lbnRcbiAqIG90aGVyIHRoYW4gdGhlIGhvc3RpbmcgY29tcG9uZW50IHdob3NlIHRlbXBsYXRlIGRlZmluZXMgaXQsIG9yIGl0IGNhbiBiZSBkZWZpbmVkXG4gKiBpbmRlcGVuZGVudGx5IGJ5IGEgYFRlbXBsYXRlUmVmYC5cbiAqXG4gKiBQcm9wZXJ0aWVzIG9mIGVsZW1lbnRzIGluIGEgdmlldyBjYW4gY2hhbmdlLCBidXQgdGhlIHN0cnVjdHVyZSAobnVtYmVyIGFuZCBvcmRlcikgb2YgZWxlbWVudHMgaW5cbiAqIGEgdmlldyBjYW5ub3QuIENoYW5nZSB0aGUgc3RydWN0dXJlIG9mIGVsZW1lbnRzIGJ5IGluc2VydGluZywgbW92aW5nLCBvclxuICogcmVtb3ZpbmcgbmVzdGVkIHZpZXdzIGluIGEgdmlldyBjb250YWluZXIuXG4gKlxuICogQHNlZSB7QGxpbmsgVmlld0NvbnRhaW5lclJlZn1cbiAqXG4gKiBAdXNhZ2VOb3Rlc1xuICpcbiAqIFRoZSBmb2xsb3dpbmcgdGVtcGxhdGUgYnJlYWtzIGRvd24gaW50byB0d28gc2VwYXJhdGUgYFRlbXBsYXRlUmVmYCBpbnN0YW5jZXMsXG4gKiBhbiBvdXRlciBvbmUgYW5kIGFuIGlubmVyIG9uZS5cbiAqXG4gKiBgYGBcbiAqIENvdW50OiB7e2l0ZW1zLmxlbmd0aH19XG4gKiA8dWw+XG4gKiAgIDxsaSAqbmdGb3I9XCJsZXQgIGl0ZW0gb2YgaXRlbXNcIj57e2l0ZW19fTwvbGk+XG4gKiA8L3VsPlxuICogYGBgXG4gKlxuICogVGhpcyBpcyB0aGUgb3V0ZXIgYFRlbXBsYXRlUmVmYDpcbiAqXG4gKiBgYGBcbiAqIENvdW50OiB7e2l0ZW1zLmxlbmd0aH19XG4gKiA8dWw+XG4gKiAgIDxuZy10ZW1wbGF0ZSBuZ0ZvciBsZXQtaXRlbSBbbmdGb3JPZl09XCJpdGVtc1wiPjwvbmctdGVtcGxhdGU+XG4gKiA8L3VsPlxuICogYGBgXG4gKlxuICogVGhpcyBpcyB0aGUgaW5uZXIgYFRlbXBsYXRlUmVmYDpcbiAqXG4gKiBgYGBcbiAqICAgPGxpPnt7aXRlbX19PC9saT5cbiAqIGBgYFxuICpcbiAqIFRoZSBvdXRlciBhbmQgaW5uZXIgYFRlbXBsYXRlUmVmYCBpbnN0YW5jZXMgYXJlIGFzc2VtYmxlZCBpbnRvIHZpZXdzIGFzIGZvbGxvd3M6XG4gKlxuICogYGBgXG4gKiA8IS0tIFZpZXdSZWY6IG91dGVyLTAgLS0+XG4gKiBDb3VudDogMlxuICogPHVsPlxuICogICA8bmctdGVtcGxhdGUgdmlldy1jb250YWluZXItcmVmPjwvbmctdGVtcGxhdGU+XG4gKiAgIDwhLS0gVmlld1JlZjogaW5uZXItMSAtLT48bGk+Zmlyc3Q8L2xpPjwhLS0gL1ZpZXdSZWY6IGlubmVyLTEgLS0+XG4gKiAgIDwhLS0gVmlld1JlZjogaW5uZXItMiAtLT48bGk+c2Vjb25kPC9saT48IS0tIC9WaWV3UmVmOiBpbm5lci0yIC0tPlxuICogPC91bD5cbiAqIDwhLS0gL1ZpZXdSZWY6IG91dGVyLTAgLS0+XG4gKiBgYGBcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEVtYmVkZGVkVmlld1JlZjxDPiBleHRlbmRzIFZpZXdSZWYge1xuICAvKipcbiAgICogVGhlIGNvbnRleHQgZm9yIHRoaXMgdmlldywgaW5oZXJpdGVkIGZyb20gdGhlIGFuY2hvciBlbGVtZW50LlxuICAgKi9cbiAgYWJzdHJhY3QgY29udGV4dDogQztcblxuICAvKipcbiAgICogVGhlIHJvb3Qgbm9kZXMgZm9yIHRoaXMgZW1iZWRkZWQgdmlldy5cbiAgICovXG4gIGFic3RyYWN0IGdldCByb290Tm9kZXMoKTogYW55W107XG59XG5cbi8qKlxuICogSW50ZXJmYWNlIGZvciB0cmFja2luZyByb290IGBWaWV3UmVmYHMgaW4gYEFwcGxpY2F0aW9uUmVmYC5cbiAqXG4gKiBOT1RFOiBJbXBvcnRpbmcgYEFwcGxpY2F0aW9uUmVmYCBoZXJlIGRpcmVjdGx5IGNyZWF0ZXMgY2lyY3VsYXIgZGVwZW5kZW5jeSwgd2hpY2ggaXMgd2h5IHdlIGhhdmVcbiAqIGEgc3Vic2V0IG9mIHRoZSBgQXBwbGljYXRpb25SZWZgIGludGVyZmFjZSBgVmlld1JlZlRyYWNrZXJgIGhlcmUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVmlld1JlZlRyYWNrZXIge1xuICBkZXRhY2hWaWV3KHZpZXdSZWY6IFZpZXdSZWYpOiB2b2lkO1xufVxuIl19