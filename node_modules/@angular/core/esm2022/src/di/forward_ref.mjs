/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { getClosureSafeProperty } from '../util/property';
import { stringify } from '../util/stringify';
const __forward_ref__ = getClosureSafeProperty({ __forward_ref__: getClosureSafeProperty });
/**
 * Allows to refer to references which are not yet defined.
 *
 * For instance, `forwardRef` is used when the `token` which we need to refer to for the purposes of
 * DI is declared, but not yet defined. It is also used when the `token` which we use when creating
 * a query is not yet defined.
 *
 * `forwardRef` is also used to break circularities in standalone components imports.
 *
 * @usageNotes
 * ### Circular dependency example
 * {@example core/di/ts/forward_ref/forward_ref_spec.ts region='forward_ref'}
 *
 * ### Circular standalone reference import example
 * ```ts
 * @Component({
 *   standalone: true,
 *   imports: [ChildComponent],
 *   selector: 'app-parent',
 *   template: `<app-child [hideParent]="hideParent"></app-child>`,
 * })
 * export class ParentComponent {
 *   @Input() hideParent: boolean;
 * }
 *
 *
 * @Component({
 *   standalone: true,
 *   imports: [CommonModule, forwardRef(() => ParentComponent)],
 *   selector: 'app-child',
 *   template: `<app-parent *ngIf="!hideParent"></app-parent>`,
 * })
 * export class ChildComponent {
 *   @Input() hideParent: boolean;
 * }
 * ```
 *
 * @publicApi
 */
export function forwardRef(forwardRefFn) {
    forwardRefFn.__forward_ref__ = forwardRef;
    forwardRefFn.toString = function () {
        return stringify(this());
    };
    return forwardRefFn;
}
/**
 * Lazily retrieves the reference value from a forwardRef.
 *
 * Acts as the identity function when given a non-forward-ref value.
 *
 * @usageNotes
 * ### Example
 *
 * {@example core/di/ts/forward_ref/forward_ref_spec.ts region='resolve_forward_ref'}
 *
 * @see {@link forwardRef}
 * @publicApi
 */
export function resolveForwardRef(type) {
    return isForwardRef(type) ? type() : type;
}
/** Checks whether a function is wrapped by a `forwardRef`. */
export function isForwardRef(fn) {
    return (typeof fn === 'function' &&
        fn.hasOwnProperty(__forward_ref__) &&
        fn.__forward_ref__ === forwardRef);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9yd2FyZF9yZWYuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9kaS9mb3J3YXJkX3JlZi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEVBQUMsc0JBQXNCLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUN4RCxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFlNUMsTUFBTSxlQUFlLEdBQUcsc0JBQXNCLENBQUMsRUFBQyxlQUFlLEVBQUUsc0JBQXNCLEVBQUMsQ0FBQyxDQUFDO0FBRTFGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXNDRztBQUNILE1BQU0sVUFBVSxVQUFVLENBQUMsWUFBMEI7SUFDN0MsWUFBYSxDQUFDLGVBQWUsR0FBRyxVQUFVLENBQUM7SUFDM0MsWUFBYSxDQUFDLFFBQVEsR0FBRztRQUM3QixPQUFPLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQzNCLENBQUMsQ0FBQztJQUNGLE9BQXdCLFlBQWEsQ0FBQztBQUN4QyxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7OztHQVlHO0FBQ0gsTUFBTSxVQUFVLGlCQUFpQixDQUFJLElBQU87SUFDMUMsT0FBTyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDNUMsQ0FBQztBQUVELDhEQUE4RDtBQUM5RCxNQUFNLFVBQVUsWUFBWSxDQUFDLEVBQU87SUFDbEMsT0FBTyxDQUNMLE9BQU8sRUFBRSxLQUFLLFVBQVU7UUFDeEIsRUFBRSxDQUFDLGNBQWMsQ0FBQyxlQUFlLENBQUM7UUFDbEMsRUFBRSxDQUFDLGVBQWUsS0FBSyxVQUFVLENBQ2xDLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7VHlwZX0gZnJvbSAnLi4vaW50ZXJmYWNlL3R5cGUnO1xuaW1wb3J0IHtnZXRDbG9zdXJlU2FmZVByb3BlcnR5fSBmcm9tICcuLi91dGlsL3Byb3BlcnR5JztcbmltcG9ydCB7c3RyaW5naWZ5fSBmcm9tICcuLi91dGlsL3N0cmluZ2lmeSc7XG5cbi8qKlxuICogQW4gaW50ZXJmYWNlIHRoYXQgYSBmdW5jdGlvbiBwYXNzZWQgaW50byBgZm9yd2FyZFJlZmAgaGFzIHRvIGltcGxlbWVudC5cbiAqXG4gKiBAdXNhZ2VOb3Rlc1xuICogIyMjIEV4YW1wbGVcbiAqXG4gKiB7QGV4YW1wbGUgY29yZS9kaS90cy9mb3J3YXJkX3JlZi9mb3J3YXJkX3JlZl9zcGVjLnRzIHJlZ2lvbj0nZm9yd2FyZF9yZWZfZm4nfVxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEZvcndhcmRSZWZGbiB7XG4gICgpOiBhbnk7XG59XG5cbmNvbnN0IF9fZm9yd2FyZF9yZWZfXyA9IGdldENsb3N1cmVTYWZlUHJvcGVydHkoe19fZm9yd2FyZF9yZWZfXzogZ2V0Q2xvc3VyZVNhZmVQcm9wZXJ0eX0pO1xuXG4vKipcbiAqIEFsbG93cyB0byByZWZlciB0byByZWZlcmVuY2VzIHdoaWNoIGFyZSBub3QgeWV0IGRlZmluZWQuXG4gKlxuICogRm9yIGluc3RhbmNlLCBgZm9yd2FyZFJlZmAgaXMgdXNlZCB3aGVuIHRoZSBgdG9rZW5gIHdoaWNoIHdlIG5lZWQgdG8gcmVmZXIgdG8gZm9yIHRoZSBwdXJwb3NlcyBvZlxuICogREkgaXMgZGVjbGFyZWQsIGJ1dCBub3QgeWV0IGRlZmluZWQuIEl0IGlzIGFsc28gdXNlZCB3aGVuIHRoZSBgdG9rZW5gIHdoaWNoIHdlIHVzZSB3aGVuIGNyZWF0aW5nXG4gKiBhIHF1ZXJ5IGlzIG5vdCB5ZXQgZGVmaW5lZC5cbiAqXG4gKiBgZm9yd2FyZFJlZmAgaXMgYWxzbyB1c2VkIHRvIGJyZWFrIGNpcmN1bGFyaXRpZXMgaW4gc3RhbmRhbG9uZSBjb21wb25lbnRzIGltcG9ydHMuXG4gKlxuICogQHVzYWdlTm90ZXNcbiAqICMjIyBDaXJjdWxhciBkZXBlbmRlbmN5IGV4YW1wbGVcbiAqIHtAZXhhbXBsZSBjb3JlL2RpL3RzL2ZvcndhcmRfcmVmL2ZvcndhcmRfcmVmX3NwZWMudHMgcmVnaW9uPSdmb3J3YXJkX3JlZid9XG4gKlxuICogIyMjIENpcmN1bGFyIHN0YW5kYWxvbmUgcmVmZXJlbmNlIGltcG9ydCBleGFtcGxlXG4gKiBgYGB0c1xuICogQENvbXBvbmVudCh7XG4gKiAgIHN0YW5kYWxvbmU6IHRydWUsXG4gKiAgIGltcG9ydHM6IFtDaGlsZENvbXBvbmVudF0sXG4gKiAgIHNlbGVjdG9yOiAnYXBwLXBhcmVudCcsXG4gKiAgIHRlbXBsYXRlOiBgPGFwcC1jaGlsZCBbaGlkZVBhcmVudF09XCJoaWRlUGFyZW50XCI+PC9hcHAtY2hpbGQ+YCxcbiAqIH0pXG4gKiBleHBvcnQgY2xhc3MgUGFyZW50Q29tcG9uZW50IHtcbiAqICAgQElucHV0KCkgaGlkZVBhcmVudDogYm9vbGVhbjtcbiAqIH1cbiAqXG4gKlxuICogQENvbXBvbmVudCh7XG4gKiAgIHN0YW5kYWxvbmU6IHRydWUsXG4gKiAgIGltcG9ydHM6IFtDb21tb25Nb2R1bGUsIGZvcndhcmRSZWYoKCkgPT4gUGFyZW50Q29tcG9uZW50KV0sXG4gKiAgIHNlbGVjdG9yOiAnYXBwLWNoaWxkJyxcbiAqICAgdGVtcGxhdGU6IGA8YXBwLXBhcmVudCAqbmdJZj1cIiFoaWRlUGFyZW50XCI+PC9hcHAtcGFyZW50PmAsXG4gKiB9KVxuICogZXhwb3J0IGNsYXNzIENoaWxkQ29tcG9uZW50IHtcbiAqICAgQElucHV0KCkgaGlkZVBhcmVudDogYm9vbGVhbjtcbiAqIH1cbiAqIGBgYFxuICpcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZvcndhcmRSZWYoZm9yd2FyZFJlZkZuOiBGb3J3YXJkUmVmRm4pOiBUeXBlPGFueT4ge1xuICAoPGFueT5mb3J3YXJkUmVmRm4pLl9fZm9yd2FyZF9yZWZfXyA9IGZvcndhcmRSZWY7XG4gICg8YW55PmZvcndhcmRSZWZGbikudG9TdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHN0cmluZ2lmeSh0aGlzKCkpO1xuICB9O1xuICByZXR1cm4gPFR5cGU8YW55Pj4oPGFueT5mb3J3YXJkUmVmRm4pO1xufVxuXG4vKipcbiAqIExhemlseSByZXRyaWV2ZXMgdGhlIHJlZmVyZW5jZSB2YWx1ZSBmcm9tIGEgZm9yd2FyZFJlZi5cbiAqXG4gKiBBY3RzIGFzIHRoZSBpZGVudGl0eSBmdW5jdGlvbiB3aGVuIGdpdmVuIGEgbm9uLWZvcndhcmQtcmVmIHZhbHVlLlxuICpcbiAqIEB1c2FnZU5vdGVzXG4gKiAjIyMgRXhhbXBsZVxuICpcbiAqIHtAZXhhbXBsZSBjb3JlL2RpL3RzL2ZvcndhcmRfcmVmL2ZvcndhcmRfcmVmX3NwZWMudHMgcmVnaW9uPSdyZXNvbHZlX2ZvcndhcmRfcmVmJ31cbiAqXG4gKiBAc2VlIHtAbGluayBmb3J3YXJkUmVmfVxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUZvcndhcmRSZWY8VD4odHlwZTogVCk6IFQge1xuICByZXR1cm4gaXNGb3J3YXJkUmVmKHR5cGUpID8gdHlwZSgpIDogdHlwZTtcbn1cblxuLyoqIENoZWNrcyB3aGV0aGVyIGEgZnVuY3Rpb24gaXMgd3JhcHBlZCBieSBhIGBmb3J3YXJkUmVmYC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0ZvcndhcmRSZWYoZm46IGFueSk6IGZuIGlzICgpID0+IGFueSB7XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIGZuID09PSAnZnVuY3Rpb24nICYmXG4gICAgZm4uaGFzT3duUHJvcGVydHkoX19mb3J3YXJkX3JlZl9fKSAmJlxuICAgIGZuLl9fZm9yd2FyZF9yZWZfXyA9PT0gZm9yd2FyZFJlZlxuICApO1xufVxuIl19