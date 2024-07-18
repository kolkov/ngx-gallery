/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { assertLessThan } from '../util/assert';
import { ɵɵdefineInjectable } from './interface/defs';
/**
 * Creates a token that can be used in a DI Provider.
 *
 * Use an `InjectionToken` whenever the type you are injecting is not reified (does not have a
 * runtime representation) such as when injecting an interface, callable type, array or
 * parameterized type.
 *
 * `InjectionToken` is parameterized on `T` which is the type of object which will be returned by
 * the `Injector`. This provides an additional level of type safety.
 *
 * <div class="alert is-helpful">
 *
 * **Important Note**: Ensure that you use the same instance of the `InjectionToken` in both the
 * provider and the injection call. Creating a new instance of `InjectionToken` in different places,
 * even with the same description, will be treated as different tokens by Angular's DI system,
 * leading to a `NullInjectorError`.
 *
 * </div>
 *
 * <code-example format="typescript" language="typescript" path="injection-token/src/main.ts"
 * region="InjectionToken"></code-example>
 *
 * When creating an `InjectionToken`, you can optionally specify a factory function which returns
 * (possibly by creating) a default value of the parameterized type `T`. This sets up the
 * `InjectionToken` using this factory as a provider as if it was defined explicitly in the
 * application's root injector. If the factory function, which takes zero arguments, needs to inject
 * dependencies, it can do so using the [`inject`](api/core/inject) function.
 * As you can see in the Tree-shakable InjectionToken example below.
 *
 * Additionally, if a `factory` is specified you can also specify the `providedIn` option, which
 * overrides the above behavior and marks the token as belonging to a particular `@NgModule` (note:
 * this option is now deprecated). As mentioned above, `'root'` is the default value for
 * `providedIn`.
 *
 * The `providedIn: NgModule` and `providedIn: 'any'` options are deprecated.
 *
 * @usageNotes
 * ### Basic Examples
 *
 * ### Plain InjectionToken
 *
 * {@example core/di/ts/injector_spec.ts region='InjectionToken'}
 *
 * ### Tree-shakable InjectionToken
 *
 * {@example core/di/ts/injector_spec.ts region='ShakableInjectionToken'}
 *
 * @publicApi
 */
export class InjectionToken {
    /**
     * @param _desc   Description for the token,
     *                used only for debugging purposes,
     *                it should but does not need to be unique
     * @param options Options for the token's usage, as described above
     */
    constructor(_desc, options) {
        this._desc = _desc;
        /** @internal */
        this.ngMetadataName = 'InjectionToken';
        this.ɵprov = undefined;
        if (typeof options == 'number') {
            (typeof ngDevMode === 'undefined' || ngDevMode) &&
                assertLessThan(options, 0, 'Only negative numbers are supported here');
            // This is a special hack to assign __NG_ELEMENT_ID__ to this instance.
            // See `InjectorMarkers`
            this.__NG_ELEMENT_ID__ = options;
        }
        else if (options !== undefined) {
            this.ɵprov = ɵɵdefineInjectable({
                token: this,
                providedIn: options.providedIn || 'root',
                factory: options.factory,
            });
        }
    }
    /**
     * @internal
     */
    get multi() {
        return this;
    }
    toString() {
        return `InjectionToken ${this._desc}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0aW9uX3Rva2VuLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvZGkvaW5qZWN0aW9uX3Rva2VuLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUU5QyxPQUFPLEVBQUMsa0JBQWtCLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUVwRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBZ0RHO0FBQ0gsTUFBTSxPQUFPLGNBQWM7SUFNekI7Ozs7O09BS0c7SUFDSCxZQUNZLEtBQWEsRUFDdkIsT0FHQztRQUpTLFVBQUssR0FBTCxLQUFLLENBQVE7UUFaekIsZ0JBQWdCO1FBQ1AsbUJBQWMsR0FBRyxnQkFBZ0IsQ0FBQztRQWlCekMsSUFBSSxDQUFDLEtBQUssR0FBRyxTQUFTLENBQUM7UUFDdkIsSUFBSSxPQUFPLE9BQU8sSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUMvQixDQUFDLE9BQU8sU0FBUyxLQUFLLFdBQVcsSUFBSSxTQUFTLENBQUM7Z0JBQzdDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxFQUFFLDBDQUEwQyxDQUFDLENBQUM7WUFDekUsdUVBQXVFO1lBQ3ZFLHdCQUF3QjtZQUN2QixJQUFZLENBQUMsaUJBQWlCLEdBQUcsT0FBTyxDQUFDO1FBQzVDLENBQUM7YUFBTSxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUNqQyxJQUFJLENBQUMsS0FBSyxHQUFHLGtCQUFrQixDQUFDO2dCQUM5QixLQUFLLEVBQUUsSUFBSTtnQkFDWCxVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVUsSUFBSSxNQUFNO2dCQUN4QyxPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU87YUFDekIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksS0FBSztRQUNQLE9BQU8sSUFBZ0MsQ0FBQztJQUMxQyxDQUFDO0lBRUQsUUFBUTtRQUNOLE9BQU8sa0JBQWtCLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUN4QyxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtUeXBlfSBmcm9tICcuLi9pbnRlcmZhY2UvdHlwZSc7XG5pbXBvcnQge2Fzc2VydExlc3NUaGFufSBmcm9tICcuLi91dGlsL2Fzc2VydCc7XG5cbmltcG9ydCB7ybXJtWRlZmluZUluamVjdGFibGV9IGZyb20gJy4vaW50ZXJmYWNlL2RlZnMnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSB0b2tlbiB0aGF0IGNhbiBiZSB1c2VkIGluIGEgREkgUHJvdmlkZXIuXG4gKlxuICogVXNlIGFuIGBJbmplY3Rpb25Ub2tlbmAgd2hlbmV2ZXIgdGhlIHR5cGUgeW91IGFyZSBpbmplY3RpbmcgaXMgbm90IHJlaWZpZWQgKGRvZXMgbm90IGhhdmUgYVxuICogcnVudGltZSByZXByZXNlbnRhdGlvbikgc3VjaCBhcyB3aGVuIGluamVjdGluZyBhbiBpbnRlcmZhY2UsIGNhbGxhYmxlIHR5cGUsIGFycmF5IG9yXG4gKiBwYXJhbWV0ZXJpemVkIHR5cGUuXG4gKlxuICogYEluamVjdGlvblRva2VuYCBpcyBwYXJhbWV0ZXJpemVkIG9uIGBUYCB3aGljaCBpcyB0aGUgdHlwZSBvZiBvYmplY3Qgd2hpY2ggd2lsbCBiZSByZXR1cm5lZCBieVxuICogdGhlIGBJbmplY3RvcmAuIFRoaXMgcHJvdmlkZXMgYW4gYWRkaXRpb25hbCBsZXZlbCBvZiB0eXBlIHNhZmV0eS5cbiAqXG4gKiA8ZGl2IGNsYXNzPVwiYWxlcnQgaXMtaGVscGZ1bFwiPlxuICpcbiAqICoqSW1wb3J0YW50IE5vdGUqKjogRW5zdXJlIHRoYXQgeW91IHVzZSB0aGUgc2FtZSBpbnN0YW5jZSBvZiB0aGUgYEluamVjdGlvblRva2VuYCBpbiBib3RoIHRoZVxuICogcHJvdmlkZXIgYW5kIHRoZSBpbmplY3Rpb24gY2FsbC4gQ3JlYXRpbmcgYSBuZXcgaW5zdGFuY2Ugb2YgYEluamVjdGlvblRva2VuYCBpbiBkaWZmZXJlbnQgcGxhY2VzLFxuICogZXZlbiB3aXRoIHRoZSBzYW1lIGRlc2NyaXB0aW9uLCB3aWxsIGJlIHRyZWF0ZWQgYXMgZGlmZmVyZW50IHRva2VucyBieSBBbmd1bGFyJ3MgREkgc3lzdGVtLFxuICogbGVhZGluZyB0byBhIGBOdWxsSW5qZWN0b3JFcnJvcmAuXG4gKlxuICogPC9kaXY+XG4gKlxuICogPGNvZGUtZXhhbXBsZSBmb3JtYXQ9XCJ0eXBlc2NyaXB0XCIgbGFuZ3VhZ2U9XCJ0eXBlc2NyaXB0XCIgcGF0aD1cImluamVjdGlvbi10b2tlbi9zcmMvbWFpbi50c1wiXG4gKiByZWdpb249XCJJbmplY3Rpb25Ub2tlblwiPjwvY29kZS1leGFtcGxlPlxuICpcbiAqIFdoZW4gY3JlYXRpbmcgYW4gYEluamVjdGlvblRva2VuYCwgeW91IGNhbiBvcHRpb25hbGx5IHNwZWNpZnkgYSBmYWN0b3J5IGZ1bmN0aW9uIHdoaWNoIHJldHVybnNcbiAqIChwb3NzaWJseSBieSBjcmVhdGluZykgYSBkZWZhdWx0IHZhbHVlIG9mIHRoZSBwYXJhbWV0ZXJpemVkIHR5cGUgYFRgLiBUaGlzIHNldHMgdXAgdGhlXG4gKiBgSW5qZWN0aW9uVG9rZW5gIHVzaW5nIHRoaXMgZmFjdG9yeSBhcyBhIHByb3ZpZGVyIGFzIGlmIGl0IHdhcyBkZWZpbmVkIGV4cGxpY2l0bHkgaW4gdGhlXG4gKiBhcHBsaWNhdGlvbidzIHJvb3QgaW5qZWN0b3IuIElmIHRoZSBmYWN0b3J5IGZ1bmN0aW9uLCB3aGljaCB0YWtlcyB6ZXJvIGFyZ3VtZW50cywgbmVlZHMgdG8gaW5qZWN0XG4gKiBkZXBlbmRlbmNpZXMsIGl0IGNhbiBkbyBzbyB1c2luZyB0aGUgW2BpbmplY3RgXShhcGkvY29yZS9pbmplY3QpIGZ1bmN0aW9uLlxuICogQXMgeW91IGNhbiBzZWUgaW4gdGhlIFRyZWUtc2hha2FibGUgSW5qZWN0aW9uVG9rZW4gZXhhbXBsZSBiZWxvdy5cbiAqXG4gKiBBZGRpdGlvbmFsbHksIGlmIGEgYGZhY3RvcnlgIGlzIHNwZWNpZmllZCB5b3UgY2FuIGFsc28gc3BlY2lmeSB0aGUgYHByb3ZpZGVkSW5gIG9wdGlvbiwgd2hpY2hcbiAqIG92ZXJyaWRlcyB0aGUgYWJvdmUgYmVoYXZpb3IgYW5kIG1hcmtzIHRoZSB0b2tlbiBhcyBiZWxvbmdpbmcgdG8gYSBwYXJ0aWN1bGFyIGBATmdNb2R1bGVgIChub3RlOlxuICogdGhpcyBvcHRpb24gaXMgbm93IGRlcHJlY2F0ZWQpLiBBcyBtZW50aW9uZWQgYWJvdmUsIGAncm9vdCdgIGlzIHRoZSBkZWZhdWx0IHZhbHVlIGZvclxuICogYHByb3ZpZGVkSW5gLlxuICpcbiAqIFRoZSBgcHJvdmlkZWRJbjogTmdNb2R1bGVgIGFuZCBgcHJvdmlkZWRJbjogJ2FueSdgIG9wdGlvbnMgYXJlIGRlcHJlY2F0ZWQuXG4gKlxuICogQHVzYWdlTm90ZXNcbiAqICMjIyBCYXNpYyBFeGFtcGxlc1xuICpcbiAqICMjIyBQbGFpbiBJbmplY3Rpb25Ub2tlblxuICpcbiAqIHtAZXhhbXBsZSBjb3JlL2RpL3RzL2luamVjdG9yX3NwZWMudHMgcmVnaW9uPSdJbmplY3Rpb25Ub2tlbid9XG4gKlxuICogIyMjIFRyZWUtc2hha2FibGUgSW5qZWN0aW9uVG9rZW5cbiAqXG4gKiB7QGV4YW1wbGUgY29yZS9kaS90cy9pbmplY3Rvcl9zcGVjLnRzIHJlZ2lvbj0nU2hha2FibGVJbmplY3Rpb25Ub2tlbid9XG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY2xhc3MgSW5qZWN0aW9uVG9rZW48VD4ge1xuICAvKiogQGludGVybmFsICovXG4gIHJlYWRvbmx5IG5nTWV0YWRhdGFOYW1lID0gJ0luamVjdGlvblRva2VuJztcblxuICByZWFkb25seSDJtXByb3Y6IHVua25vd247XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBfZGVzYyAgIERlc2NyaXB0aW9uIGZvciB0aGUgdG9rZW4sXG4gICAqICAgICAgICAgICAgICAgIHVzZWQgb25seSBmb3IgZGVidWdnaW5nIHB1cnBvc2VzLFxuICAgKiAgICAgICAgICAgICAgICBpdCBzaG91bGQgYnV0IGRvZXMgbm90IG5lZWQgdG8gYmUgdW5pcXVlXG4gICAqIEBwYXJhbSBvcHRpb25zIE9wdGlvbnMgZm9yIHRoZSB0b2tlbidzIHVzYWdlLCBhcyBkZXNjcmliZWQgYWJvdmVcbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBfZGVzYzogc3RyaW5nLFxuICAgIG9wdGlvbnM/OiB7XG4gICAgICBwcm92aWRlZEluPzogVHlwZTxhbnk+IHwgJ3Jvb3QnIHwgJ3BsYXRmb3JtJyB8ICdhbnknIHwgbnVsbDtcbiAgICAgIGZhY3Rvcnk6ICgpID0+IFQ7XG4gICAgfSxcbiAgKSB7XG4gICAgdGhpcy7JtXByb3YgPSB1bmRlZmluZWQ7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zID09ICdudW1iZXInKSB7XG4gICAgICAodHlwZW9mIG5nRGV2TW9kZSA9PT0gJ3VuZGVmaW5lZCcgfHwgbmdEZXZNb2RlKSAmJlxuICAgICAgICBhc3NlcnRMZXNzVGhhbihvcHRpb25zLCAwLCAnT25seSBuZWdhdGl2ZSBudW1iZXJzIGFyZSBzdXBwb3J0ZWQgaGVyZScpO1xuICAgICAgLy8gVGhpcyBpcyBhIHNwZWNpYWwgaGFjayB0byBhc3NpZ24gX19OR19FTEVNRU5UX0lEX18gdG8gdGhpcyBpbnN0YW5jZS5cbiAgICAgIC8vIFNlZSBgSW5qZWN0b3JNYXJrZXJzYFxuICAgICAgKHRoaXMgYXMgYW55KS5fX05HX0VMRU1FTlRfSURfXyA9IG9wdGlvbnM7XG4gICAgfSBlbHNlIGlmIChvcHRpb25zICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuybVwcm92ID0gybXJtWRlZmluZUluamVjdGFibGUoe1xuICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgcHJvdmlkZWRJbjogb3B0aW9ucy5wcm92aWRlZEluIHx8ICdyb290JyxcbiAgICAgICAgZmFjdG9yeTogb3B0aW9ucy5mYWN0b3J5LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgZ2V0IG11bHRpKCk6IEluamVjdGlvblRva2VuPEFycmF5PFQ+PiB7XG4gICAgcmV0dXJuIHRoaXMgYXMgSW5qZWN0aW9uVG9rZW48QXJyYXk8VD4+O1xuICB9XG5cbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYEluamVjdGlvblRva2VuICR7dGhpcy5fZGVzY31gO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5qZWN0YWJsZURlZlRva2VuPFQ+IGV4dGVuZHMgSW5qZWN0aW9uVG9rZW48VD4ge1xuICDJtXByb3Y6IHVua25vd247XG59XG4iXX0=