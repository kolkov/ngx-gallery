/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { inject, InjectionToken } from './di';
import { getOriginalError } from './util/errors';
/**
 * Provides a hook for centralized exception handling.
 *
 * The default implementation of `ErrorHandler` prints error messages to the `console`. To
 * intercept error handling, write a custom exception handler that replaces this default as
 * appropriate for your app.
 *
 * @usageNotes
 * ### Example
 *
 * ```
 * class MyErrorHandler implements ErrorHandler {
 *   handleError(error) {
 *     // do something with the exception
 *   }
 * }
 *
 * @NgModule({
 *   providers: [{provide: ErrorHandler, useClass: MyErrorHandler}]
 * })
 * class MyModule {}
 * ```
 *
 * @publicApi
 */
export class ErrorHandler {
    constructor() {
        /**
         * @internal
         */
        this._console = console;
    }
    handleError(error) {
        const originalError = this._findOriginalError(error);
        this._console.error('ERROR', error);
        if (originalError) {
            this._console.error('ORIGINAL ERROR', originalError);
        }
    }
    /** @internal */
    _findOriginalError(error) {
        let e = error && getOriginalError(error);
        while (e && getOriginalError(e)) {
            e = getOriginalError(e);
        }
        return e || null;
    }
}
/**
 * `InjectionToken` used to configure how to call the `ErrorHandler`.
 *
 * `NgZone` is provided by default today so the default (and only) implementation for this
 * is calling `ErrorHandler.handleError` outside of the Angular zone.
 */
export const INTERNAL_APPLICATION_ERROR_HANDLER = new InjectionToken(typeof ngDevMode === 'undefined' || ngDevMode ? 'internal error handler' : '', {
    providedIn: 'root',
    factory: () => {
        const userErrorHandler = inject(ErrorHandler);
        return userErrorHandler.handleError.bind(this);
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXJyb3JfaGFuZGxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2Vycm9yX2hhbmRsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLE1BQU0sRUFBRSxjQUFjLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFDNUMsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRS9DOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0F3Qkc7QUFDSCxNQUFNLE9BQU8sWUFBWTtJQUF6QjtRQUNFOztXQUVHO1FBQ0gsYUFBUSxHQUFZLE9BQU8sQ0FBQztJQW9COUIsQ0FBQztJQWxCQyxXQUFXLENBQUMsS0FBVTtRQUNwQixNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFckQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3BDLElBQUksYUFBYSxFQUFFLENBQUM7WUFDbEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDdkQsQ0FBQztJQUNILENBQUM7SUFFRCxnQkFBZ0I7SUFDaEIsa0JBQWtCLENBQUMsS0FBVTtRQUMzQixJQUFJLENBQUMsR0FBRyxLQUFLLElBQUksZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDekMsT0FBTyxDQUFDLElBQUksZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNoQyxDQUFDLEdBQUcsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDMUIsQ0FBQztRQUVELE9BQU8sQ0FBQyxJQUFJLElBQUksQ0FBQztJQUNuQixDQUFDO0NBQ0Y7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sQ0FBQyxNQUFNLGtDQUFrQyxHQUFHLElBQUksY0FBYyxDQUNsRSxPQUFPLFNBQVMsS0FBSyxXQUFXLElBQUksU0FBUyxDQUFDLENBQUMsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUM3RTtJQUNFLFVBQVUsRUFBRSxNQUFNO0lBQ2xCLE9BQU8sRUFBRSxHQUFHLEVBQUU7UUFDWixNQUFNLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUM5QyxPQUFPLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDakQsQ0FBQztDQUNGLENBQ0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2luamVjdCwgSW5qZWN0aW9uVG9rZW59IGZyb20gJy4vZGknO1xuaW1wb3J0IHtnZXRPcmlnaW5hbEVycm9yfSBmcm9tICcuL3V0aWwvZXJyb3JzJztcblxuLyoqXG4gKiBQcm92aWRlcyBhIGhvb2sgZm9yIGNlbnRyYWxpemVkIGV4Y2VwdGlvbiBoYW5kbGluZy5cbiAqXG4gKiBUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiBvZiBgRXJyb3JIYW5kbGVyYCBwcmludHMgZXJyb3IgbWVzc2FnZXMgdG8gdGhlIGBjb25zb2xlYC4gVG9cbiAqIGludGVyY2VwdCBlcnJvciBoYW5kbGluZywgd3JpdGUgYSBjdXN0b20gZXhjZXB0aW9uIGhhbmRsZXIgdGhhdCByZXBsYWNlcyB0aGlzIGRlZmF1bHQgYXNcbiAqIGFwcHJvcHJpYXRlIGZvciB5b3VyIGFwcC5cbiAqXG4gKiBAdXNhZ2VOb3Rlc1xuICogIyMjIEV4YW1wbGVcbiAqXG4gKiBgYGBcbiAqIGNsYXNzIE15RXJyb3JIYW5kbGVyIGltcGxlbWVudHMgRXJyb3JIYW5kbGVyIHtcbiAqICAgaGFuZGxlRXJyb3IoZXJyb3IpIHtcbiAqICAgICAvLyBkbyBzb21ldGhpbmcgd2l0aCB0aGUgZXhjZXB0aW9uXG4gKiAgIH1cbiAqIH1cbiAqXG4gKiBATmdNb2R1bGUoe1xuICogICBwcm92aWRlcnM6IFt7cHJvdmlkZTogRXJyb3JIYW5kbGVyLCB1c2VDbGFzczogTXlFcnJvckhhbmRsZXJ9XVxuICogfSlcbiAqIGNsYXNzIE15TW9kdWxlIHt9XG4gKiBgYGBcbiAqXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBjbGFzcyBFcnJvckhhbmRsZXIge1xuICAvKipcbiAgICogQGludGVybmFsXG4gICAqL1xuICBfY29uc29sZTogQ29uc29sZSA9IGNvbnNvbGU7XG5cbiAgaGFuZGxlRXJyb3IoZXJyb3I6IGFueSk6IHZvaWQge1xuICAgIGNvbnN0IG9yaWdpbmFsRXJyb3IgPSB0aGlzLl9maW5kT3JpZ2luYWxFcnJvcihlcnJvcik7XG5cbiAgICB0aGlzLl9jb25zb2xlLmVycm9yKCdFUlJPUicsIGVycm9yKTtcbiAgICBpZiAob3JpZ2luYWxFcnJvcikge1xuICAgICAgdGhpcy5fY29uc29sZS5lcnJvcignT1JJR0lOQUwgRVJST1InLCBvcmlnaW5hbEVycm9yKTtcbiAgICB9XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIF9maW5kT3JpZ2luYWxFcnJvcihlcnJvcjogYW55KTogRXJyb3IgfCBudWxsIHtcbiAgICBsZXQgZSA9IGVycm9yICYmIGdldE9yaWdpbmFsRXJyb3IoZXJyb3IpO1xuICAgIHdoaWxlIChlICYmIGdldE9yaWdpbmFsRXJyb3IoZSkpIHtcbiAgICAgIGUgPSBnZXRPcmlnaW5hbEVycm9yKGUpO1xuICAgIH1cblxuICAgIHJldHVybiBlIHx8IG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBgSW5qZWN0aW9uVG9rZW5gIHVzZWQgdG8gY29uZmlndXJlIGhvdyB0byBjYWxsIHRoZSBgRXJyb3JIYW5kbGVyYC5cbiAqXG4gKiBgTmdab25lYCBpcyBwcm92aWRlZCBieSBkZWZhdWx0IHRvZGF5IHNvIHRoZSBkZWZhdWx0IChhbmQgb25seSkgaW1wbGVtZW50YXRpb24gZm9yIHRoaXNcbiAqIGlzIGNhbGxpbmcgYEVycm9ySGFuZGxlci5oYW5kbGVFcnJvcmAgb3V0c2lkZSBvZiB0aGUgQW5ndWxhciB6b25lLlxuICovXG5leHBvcnQgY29uc3QgSU5URVJOQUxfQVBQTElDQVRJT05fRVJST1JfSEFORExFUiA9IG5ldyBJbmplY3Rpb25Ub2tlbjwoZTogYW55KSA9PiB2b2lkPihcbiAgdHlwZW9mIG5nRGV2TW9kZSA9PT0gJ3VuZGVmaW5lZCcgfHwgbmdEZXZNb2RlID8gJ2ludGVybmFsIGVycm9yIGhhbmRsZXInIDogJycsXG4gIHtcbiAgICBwcm92aWRlZEluOiAncm9vdCcsXG4gICAgZmFjdG9yeTogKCkgPT4ge1xuICAgICAgY29uc3QgdXNlckVycm9ySGFuZGxlciA9IGluamVjdChFcnJvckhhbmRsZXIpO1xuICAgICAgcmV0dXJuIHVzZXJFcnJvckhhbmRsZXIuaGFuZGxlRXJyb3IuYmluZCh0aGlzKTtcbiAgICB9LFxuICB9LFxuKTtcbiJdfQ==