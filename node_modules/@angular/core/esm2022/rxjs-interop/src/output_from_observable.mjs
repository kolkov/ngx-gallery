/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { assertInInjectionContext, DestroyRef, inject, ɵRuntimeError, } from '@angular/core';
import { takeUntilDestroyed } from './take_until_destroyed';
/**
 * Implementation of `OutputRef` that emits values from
 * an RxJS observable source.
 *
 * @internal
 */
class OutputFromObservableRef {
    constructor(source) {
        this.source = source;
        this.destroyed = false;
        this.destroyRef = inject(DestroyRef);
        this.destroyRef.onDestroy(() => {
            this.destroyed = true;
        });
    }
    subscribe(callbackFn) {
        if (this.destroyed) {
            throw new ɵRuntimeError(953 /* ɵRuntimeErrorCode.OUTPUT_REF_DESTROYED */, ngDevMode &&
                'Unexpected subscription to destroyed `OutputRef`. ' +
                    'The owning directive/component is destroyed.');
        }
        // Stop yielding more values when the directive/component is already destroyed.
        const subscription = this.source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (value) => callbackFn(value),
        });
        return {
            unsubscribe: () => subscription.unsubscribe(),
        };
    }
}
/**
 * Declares an Angular output that is using an RxJS observable as a source
 * for events dispatched to parent subscribers.
 *
 * The behavior for an observable as source is defined as followed:
 *    1. New values are forwarded to the Angular output (next notifications).
 *    2. Errors notifications are not handled by Angular. You need to handle these manually.
 *       For example by using `catchError`.
 *    3. Completion notifications stop the output from emitting new values.
 *
 * @usageNotes
 * Initialize an output in your directive by declaring a
 * class field and initializing it with the `outputFromObservable()` function.
 *
 * ```ts
 * @Directive({..})
 * export class MyDir {
 *   nameChange$ = <some-observable>;
 *   nameChange = outputFromObservable(this.nameChange$);
 * }
 * ```
 *
 * @developerPreview
 */
export function outputFromObservable(observable, opts) {
    ngDevMode && assertInInjectionContext(outputFromObservable);
    return new OutputFromObservableRef(observable);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X2Zyb21fb2JzZXJ2YWJsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvcnhqcy1pbnRlcm9wL3NyYy9vdXRwdXRfZnJvbV9vYnNlcnZhYmxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFDTCx3QkFBd0IsRUFDeEIsVUFBVSxFQUNWLE1BQU0sRUFJTixhQUFhLEdBRWQsTUFBTSxlQUFlLENBQUM7QUFHdkIsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFMUQ7Ozs7O0dBS0c7QUFDSCxNQUFNLHVCQUF1QjtJQUszQixZQUFvQixNQUFxQjtRQUFyQixXQUFNLEdBQU4sTUFBTSxDQUFlO1FBSmpDLGNBQVMsR0FBRyxLQUFLLENBQUM7UUFFMUIsZUFBVSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUc5QixJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUU7WUFDN0IsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDeEIsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsU0FBUyxDQUFDLFVBQThCO1FBQ3RDLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ25CLE1BQU0sSUFBSSxhQUFhLG1EQUVyQixTQUFTO2dCQUNQLG9EQUFvRDtvQkFDbEQsOENBQThDLENBQ25ELENBQUM7UUFDSixDQUFDO1FBRUQsK0VBQStFO1FBQy9FLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUNuRixJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUM7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsT0FBTztZQUNMLFdBQVcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFO1NBQzlDLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0F1Qkc7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQ2xDLFVBQXlCLEVBQ3pCLElBQW9CO0lBRXBCLFNBQVMsSUFBSSx3QkFBd0IsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0lBQzVELE9BQU8sSUFBSSx1QkFBdUIsQ0FBSSxVQUFVLENBQUMsQ0FBQztBQUNwRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIGFzc2VydEluSW5qZWN0aW9uQ29udGV4dCxcbiAgRGVzdHJveVJlZixcbiAgaW5qZWN0LFxuICBPdXRwdXRPcHRpb25zLFxuICBPdXRwdXRSZWYsXG4gIE91dHB1dFJlZlN1YnNjcmlwdGlvbixcbiAgybVSdW50aW1lRXJyb3IsXG4gIMm1UnVudGltZUVycm9yQ29kZSxcbn0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQge09ic2VydmFibGV9IGZyb20gJ3J4anMnO1xuXG5pbXBvcnQge3Rha2VVbnRpbERlc3Ryb3llZH0gZnJvbSAnLi90YWtlX3VudGlsX2Rlc3Ryb3llZCc7XG5cbi8qKlxuICogSW1wbGVtZW50YXRpb24gb2YgYE91dHB1dFJlZmAgdGhhdCBlbWl0cyB2YWx1ZXMgZnJvbVxuICogYW4gUnhKUyBvYnNlcnZhYmxlIHNvdXJjZS5cbiAqXG4gKiBAaW50ZXJuYWxcbiAqL1xuY2xhc3MgT3V0cHV0RnJvbU9ic2VydmFibGVSZWY8VD4gaW1wbGVtZW50cyBPdXRwdXRSZWY8VD4ge1xuICBwcml2YXRlIGRlc3Ryb3llZCA9IGZhbHNlO1xuXG4gIGRlc3Ryb3lSZWYgPSBpbmplY3QoRGVzdHJveVJlZik7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBzb3VyY2U6IE9ic2VydmFibGU8VD4pIHtcbiAgICB0aGlzLmRlc3Ryb3lSZWYub25EZXN0cm95KCgpID0+IHtcbiAgICAgIHRoaXMuZGVzdHJveWVkID0gdHJ1ZTtcbiAgICB9KTtcbiAgfVxuXG4gIHN1YnNjcmliZShjYWxsYmFja0ZuOiAodmFsdWU6IFQpID0+IHZvaWQpOiBPdXRwdXRSZWZTdWJzY3JpcHRpb24ge1xuICAgIGlmICh0aGlzLmRlc3Ryb3llZCkge1xuICAgICAgdGhyb3cgbmV3IMm1UnVudGltZUVycm9yKFxuICAgICAgICDJtVJ1bnRpbWVFcnJvckNvZGUuT1VUUFVUX1JFRl9ERVNUUk9ZRUQsXG4gICAgICAgIG5nRGV2TW9kZSAmJlxuICAgICAgICAgICdVbmV4cGVjdGVkIHN1YnNjcmlwdGlvbiB0byBkZXN0cm95ZWQgYE91dHB1dFJlZmAuICcgK1xuICAgICAgICAgICAgJ1RoZSBvd25pbmcgZGlyZWN0aXZlL2NvbXBvbmVudCBpcyBkZXN0cm95ZWQuJyxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gU3RvcCB5aWVsZGluZyBtb3JlIHZhbHVlcyB3aGVuIHRoZSBkaXJlY3RpdmUvY29tcG9uZW50IGlzIGFscmVhZHkgZGVzdHJveWVkLlxuICAgIGNvbnN0IHN1YnNjcmlwdGlvbiA9IHRoaXMuc291cmNlLnBpcGUodGFrZVVudGlsRGVzdHJveWVkKHRoaXMuZGVzdHJveVJlZikpLnN1YnNjcmliZSh7XG4gICAgICBuZXh0OiAodmFsdWUpID0+IGNhbGxiYWNrRm4odmFsdWUpLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHVuc3Vic2NyaWJlOiAoKSA9PiBzdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKSxcbiAgICB9O1xuICB9XG59XG5cbi8qKlxuICogRGVjbGFyZXMgYW4gQW5ndWxhciBvdXRwdXQgdGhhdCBpcyB1c2luZyBhbiBSeEpTIG9ic2VydmFibGUgYXMgYSBzb3VyY2VcbiAqIGZvciBldmVudHMgZGlzcGF0Y2hlZCB0byBwYXJlbnQgc3Vic2NyaWJlcnMuXG4gKlxuICogVGhlIGJlaGF2aW9yIGZvciBhbiBvYnNlcnZhYmxlIGFzIHNvdXJjZSBpcyBkZWZpbmVkIGFzIGZvbGxvd2VkOlxuICogICAgMS4gTmV3IHZhbHVlcyBhcmUgZm9yd2FyZGVkIHRvIHRoZSBBbmd1bGFyIG91dHB1dCAobmV4dCBub3RpZmljYXRpb25zKS5cbiAqICAgIDIuIEVycm9ycyBub3RpZmljYXRpb25zIGFyZSBub3QgaGFuZGxlZCBieSBBbmd1bGFyLiBZb3UgbmVlZCB0byBoYW5kbGUgdGhlc2UgbWFudWFsbHkuXG4gKiAgICAgICBGb3IgZXhhbXBsZSBieSB1c2luZyBgY2F0Y2hFcnJvcmAuXG4gKiAgICAzLiBDb21wbGV0aW9uIG5vdGlmaWNhdGlvbnMgc3RvcCB0aGUgb3V0cHV0IGZyb20gZW1pdHRpbmcgbmV3IHZhbHVlcy5cbiAqXG4gKiBAdXNhZ2VOb3Rlc1xuICogSW5pdGlhbGl6ZSBhbiBvdXRwdXQgaW4geW91ciBkaXJlY3RpdmUgYnkgZGVjbGFyaW5nIGFcbiAqIGNsYXNzIGZpZWxkIGFuZCBpbml0aWFsaXppbmcgaXQgd2l0aCB0aGUgYG91dHB1dEZyb21PYnNlcnZhYmxlKClgIGZ1bmN0aW9uLlxuICpcbiAqIGBgYHRzXG4gKiBARGlyZWN0aXZlKHsuLn0pXG4gKiBleHBvcnQgY2xhc3MgTXlEaXIge1xuICogICBuYW1lQ2hhbmdlJCA9IDxzb21lLW9ic2VydmFibGU+O1xuICogICBuYW1lQ2hhbmdlID0gb3V0cHV0RnJvbU9ic2VydmFibGUodGhpcy5uYW1lQ2hhbmdlJCk7XG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBAZGV2ZWxvcGVyUHJldmlld1xuICovXG5leHBvcnQgZnVuY3Rpb24gb3V0cHV0RnJvbU9ic2VydmFibGU8VD4oXG4gIG9ic2VydmFibGU6IE9ic2VydmFibGU8VD4sXG4gIG9wdHM/OiBPdXRwdXRPcHRpb25zLFxuKTogT3V0cHV0UmVmPFQ+IHtcbiAgbmdEZXZNb2RlICYmIGFzc2VydEluSW5qZWN0aW9uQ29udGV4dChvdXRwdXRGcm9tT2JzZXJ2YWJsZSk7XG4gIHJldHVybiBuZXcgT3V0cHV0RnJvbU9ic2VydmFibGVSZWY8VD4ob2JzZXJ2YWJsZSk7XG59XG4iXX0=