import { inject, Injectable, InjectionToken } from '../di';
import { RuntimeError } from '../errors';
import { isPromise, isSubscribable } from '../util/lang';
import * as i0 from "../r3_symbols";
/**
 * A DI token that you can use to provide
 * one or more initialization functions.
 *
 * The provided functions are injected at application startup and executed during
 * app initialization. If any of these functions returns a Promise or an Observable, initialization
 * does not complete until the Promise is resolved or the Observable is completed.
 *
 * You can, for example, create a factory function that loads language data
 * or an external configuration, and provide that function to the `APP_INITIALIZER` token.
 * The function is executed during the application bootstrap process,
 * and the needed data is available on startup.
 *
 * @see {@link ApplicationInitStatus}
 *
 * @usageNotes
 *
 * The following example illustrates how to configure a multi-provider using `APP_INITIALIZER` token
 * and a function returning a promise.
 * ### Example with NgModule-based application
 * ```
 *  function initializeApp(): Promise<any> {
 *    return new Promise((resolve, reject) => {
 *      // Do some asynchronous stuff
 *      resolve();
 *    });
 *  }
 *
 *  @NgModule({
 *   imports: [BrowserModule],
 *   declarations: [AppComponent],
 *   bootstrap: [AppComponent],
 *   providers: [{
 *     provide: APP_INITIALIZER,
 *     useFactory: () => initializeApp,
 *     multi: true
 *    }]
 *   })
 *  export class AppModule {}
 * ```
 *
 * ### Example with standalone application
 * ```
 * export function initializeApp(http: HttpClient) {
 *   return (): Promise<any> =>
 *     firstValueFrom(
 *       http
 *         .get("https://someUrl.com/api/user")
 *         .pipe(tap(user => { ... }))
 *     );
 * }
 *
 * bootstrapApplication(App, {
 *   providers: [
 *     provideHttpClient(),
 *     {
 *       provide: APP_INITIALIZER,
 *       useFactory: initializeApp,
 *       multi: true,
 *       deps: [HttpClient],
 *     },
 *   ],
 * });

 * ```
 *
 *
 * It's also possible to configure a multi-provider using `APP_INITIALIZER` token and a function
 * returning an observable, see an example below. Note: the `HttpClient` in this example is used for
 * demo purposes to illustrate how the factory function can work with other providers available
 * through DI.
 *
 * ### Example with NgModule-based application
 * ```
 *  function initializeAppFactory(httpClient: HttpClient): () => Observable<any> {
 *   return () => httpClient.get("https://someUrl.com/api/user")
 *     .pipe(
 *        tap(user => { ... })
 *     );
 *  }
 *
 *  @NgModule({
 *    imports: [BrowserModule, HttpClientModule],
 *    declarations: [AppComponent],
 *    bootstrap: [AppComponent],
 *    providers: [{
 *      provide: APP_INITIALIZER,
 *      useFactory: initializeAppFactory,
 *      deps: [HttpClient],
 *      multi: true
 *    }]
 *  })
 *  export class AppModule {}
 * ```
 *
 * ### Example with standalone application
 * ```
 *  function initializeAppFactory(httpClient: HttpClient): () => Observable<any> {
 *   return () => httpClient.get("https://someUrl.com/api/user")
 *     .pipe(
 *        tap(user => { ... })
 *     );
 *  }
 *
 * bootstrapApplication(App, {
 *   providers: [
 *     provideHttpClient(),
 *     {
 *       provide: APP_INITIALIZER,
 *       useFactory: initializeAppFactory,
 *       multi: true,
 *       deps: [HttpClient],
 *     },
 *   ],
 * });
 * ```
 *
 * @publicApi
 */
export const APP_INITIALIZER = new InjectionToken(ngDevMode ? 'Application Initializer' : '');
/**
 * A class that reflects the state of running {@link APP_INITIALIZER} functions.
 *
 * @publicApi
 */
export class ApplicationInitStatus {
    constructor() {
        this.initialized = false;
        this.done = false;
        this.donePromise = new Promise((res, rej) => {
            this.resolve = res;
            this.reject = rej;
        });
        this.appInits = inject(APP_INITIALIZER, { optional: true }) ?? [];
        if ((typeof ngDevMode === 'undefined' || ngDevMode) && !Array.isArray(this.appInits)) {
            throw new RuntimeError(-209 /* RuntimeErrorCode.INVALID_MULTI_PROVIDER */, 'Unexpected type of the `APP_INITIALIZER` token value ' +
                `(expected an array, but got ${typeof this.appInits}). ` +
                'Please check that the `APP_INITIALIZER` token is configured as a ' +
                '`multi: true` provider.');
        }
    }
    /** @internal */
    runInitializers() {
        if (this.initialized) {
            return;
        }
        const asyncInitPromises = [];
        for (const appInits of this.appInits) {
            const initResult = appInits();
            if (isPromise(initResult)) {
                asyncInitPromises.push(initResult);
            }
            else if (isSubscribable(initResult)) {
                const observableAsPromise = new Promise((resolve, reject) => {
                    initResult.subscribe({ complete: resolve, error: reject });
                });
                asyncInitPromises.push(observableAsPromise);
            }
        }
        const complete = () => {
            // @ts-expect-error overwriting a readonly
            this.done = true;
            this.resolve();
        };
        Promise.all(asyncInitPromises)
            .then(() => {
            complete();
        })
            .catch((e) => {
            this.reject(e);
        });
        if (asyncInitPromises.length === 0) {
            complete();
        }
        this.initialized = true;
    }
    static { this.ɵfac = function ApplicationInitStatus_Factory(t) { return new (t || ApplicationInitStatus)(); }; }
    static { this.ɵprov = /*@__PURE__*/ i0.ɵɵdefineInjectable({ token: ApplicationInitStatus, factory: ApplicationInitStatus.ɵfac, providedIn: 'root' }); }
}
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.setClassMetadata(ApplicationInitStatus, [{
        type: Injectable,
        args: [{ providedIn: 'root' }]
    }], () => [], null); })();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb25faW5pdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2FwcGxpY2F0aW9uL2FwcGxpY2F0aW9uX2luaXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBVUEsT0FBTyxFQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFDLE1BQU0sT0FBTyxDQUFDO0FBQ3pELE9BQU8sRUFBQyxZQUFZLEVBQW1CLE1BQU0sV0FBVyxDQUFDO0FBQ3pELE9BQU8sRUFBQyxTQUFTLEVBQUUsY0FBYyxFQUFDLE1BQU0sY0FBYyxDQUFDOztBQUV2RDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXNIRztBQUNILE1BQU0sQ0FBQyxNQUFNLGVBQWUsR0FBRyxJQUFJLGNBQWMsQ0FFL0MsU0FBUyxDQUFDLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7QUFFOUM7Ozs7R0FJRztBQUVILE1BQU0sT0FBTyxxQkFBcUI7SUFlaEM7UUFUUSxnQkFBVyxHQUFHLEtBQUssQ0FBQztRQUNaLFNBQUksR0FBRyxLQUFLLENBQUM7UUFDYixnQkFBVyxHQUFpQixJQUFJLE9BQU8sQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRTtZQUNuRSxJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQztZQUNuQixJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQztRQUNwQixDQUFDLENBQUMsQ0FBQztRQUVjLGFBQVEsR0FBRyxNQUFNLENBQUMsZUFBZSxFQUFFLEVBQUMsUUFBUSxFQUFFLElBQUksRUFBQyxDQUFDLElBQUksRUFBRSxDQUFDO1FBRzFFLElBQUksQ0FBQyxPQUFPLFNBQVMsS0FBSyxXQUFXLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQ3JGLE1BQU0sSUFBSSxZQUFZLHFEQUVwQix1REFBdUQ7Z0JBQ3JELCtCQUErQixPQUFPLElBQUksQ0FBQyxRQUFRLEtBQUs7Z0JBQ3hELG1FQUFtRTtnQkFDbkUseUJBQXlCLENBQzVCLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztJQUVELGdCQUFnQjtJQUNoQixlQUFlO1FBQ2IsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDckIsT0FBTztRQUNULENBQUM7UUFFRCxNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztRQUM3QixLQUFLLE1BQU0sUUFBUSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNyQyxNQUFNLFVBQVUsR0FBRyxRQUFRLEVBQUUsQ0FBQztZQUM5QixJQUFJLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO2dCQUMxQixpQkFBaUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDckMsQ0FBQztpQkFBTSxJQUFJLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO2dCQUN0QyxNQUFNLG1CQUFtQixHQUFHLElBQUksT0FBTyxDQUFPLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO29CQUNoRSxVQUFVLENBQUMsU0FBUyxDQUFDLEVBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFDLENBQUMsQ0FBQztnQkFDM0QsQ0FBQyxDQUFDLENBQUM7Z0JBQ0gsaUJBQWlCLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFDOUMsQ0FBQztRQUNILENBQUM7UUFFRCxNQUFNLFFBQVEsR0FBRyxHQUFHLEVBQUU7WUFDcEIsMENBQTBDO1lBQzFDLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1lBQ2pCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNqQixDQUFDLENBQUM7UUFFRixPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDO2FBQzNCLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDVCxRQUFRLEVBQUUsQ0FBQztRQUNiLENBQUMsQ0FBQzthQUNELEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO1lBQ1gsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNqQixDQUFDLENBQUMsQ0FBQztRQUVMLElBQUksaUJBQWlCLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ25DLFFBQVEsRUFBRSxDQUFDO1FBQ2IsQ0FBQztRQUNELElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO0lBQzFCLENBQUM7c0ZBaEVVLHFCQUFxQjt1RUFBckIscUJBQXFCLFdBQXJCLHFCQUFxQixtQkFEVCxNQUFNOztnRkFDbEIscUJBQXFCO2NBRGpDLFVBQVU7ZUFBQyxFQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtPYnNlcnZhYmxlfSBmcm9tICdyeGpzJztcblxuaW1wb3J0IHtpbmplY3QsIEluamVjdGFibGUsIEluamVjdGlvblRva2VufSBmcm9tICcuLi9kaSc7XG5pbXBvcnQge1J1bnRpbWVFcnJvciwgUnVudGltZUVycm9yQ29kZX0gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCB7aXNQcm9taXNlLCBpc1N1YnNjcmliYWJsZX0gZnJvbSAnLi4vdXRpbC9sYW5nJztcblxuLyoqXG4gKiBBIERJIHRva2VuIHRoYXQgeW91IGNhbiB1c2UgdG8gcHJvdmlkZVxuICogb25lIG9yIG1vcmUgaW5pdGlhbGl6YXRpb24gZnVuY3Rpb25zLlxuICpcbiAqIFRoZSBwcm92aWRlZCBmdW5jdGlvbnMgYXJlIGluamVjdGVkIGF0IGFwcGxpY2F0aW9uIHN0YXJ0dXAgYW5kIGV4ZWN1dGVkIGR1cmluZ1xuICogYXBwIGluaXRpYWxpemF0aW9uLiBJZiBhbnkgb2YgdGhlc2UgZnVuY3Rpb25zIHJldHVybnMgYSBQcm9taXNlIG9yIGFuIE9ic2VydmFibGUsIGluaXRpYWxpemF0aW9uXG4gKiBkb2VzIG5vdCBjb21wbGV0ZSB1bnRpbCB0aGUgUHJvbWlzZSBpcyByZXNvbHZlZCBvciB0aGUgT2JzZXJ2YWJsZSBpcyBjb21wbGV0ZWQuXG4gKlxuICogWW91IGNhbiwgZm9yIGV4YW1wbGUsIGNyZWF0ZSBhIGZhY3RvcnkgZnVuY3Rpb24gdGhhdCBsb2FkcyBsYW5ndWFnZSBkYXRhXG4gKiBvciBhbiBleHRlcm5hbCBjb25maWd1cmF0aW9uLCBhbmQgcHJvdmlkZSB0aGF0IGZ1bmN0aW9uIHRvIHRoZSBgQVBQX0lOSVRJQUxJWkVSYCB0b2tlbi5cbiAqIFRoZSBmdW5jdGlvbiBpcyBleGVjdXRlZCBkdXJpbmcgdGhlIGFwcGxpY2F0aW9uIGJvb3RzdHJhcCBwcm9jZXNzLFxuICogYW5kIHRoZSBuZWVkZWQgZGF0YSBpcyBhdmFpbGFibGUgb24gc3RhcnR1cC5cbiAqXG4gKiBAc2VlIHtAbGluayBBcHBsaWNhdGlvbkluaXRTdGF0dXN9XG4gKlxuICogQHVzYWdlTm90ZXNcbiAqXG4gKiBUaGUgZm9sbG93aW5nIGV4YW1wbGUgaWxsdXN0cmF0ZXMgaG93IHRvIGNvbmZpZ3VyZSBhIG11bHRpLXByb3ZpZGVyIHVzaW5nIGBBUFBfSU5JVElBTElaRVJgIHRva2VuXG4gKiBhbmQgYSBmdW5jdGlvbiByZXR1cm5pbmcgYSBwcm9taXNlLlxuICogIyMjIEV4YW1wbGUgd2l0aCBOZ01vZHVsZS1iYXNlZCBhcHBsaWNhdGlvblxuICogYGBgXG4gKiAgZnVuY3Rpb24gaW5pdGlhbGl6ZUFwcCgpOiBQcm9taXNlPGFueT4ge1xuICogICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAqICAgICAgLy8gRG8gc29tZSBhc3luY2hyb25vdXMgc3R1ZmZcbiAqICAgICAgcmVzb2x2ZSgpO1xuICogICAgfSk7XG4gKiAgfVxuICpcbiAqICBATmdNb2R1bGUoe1xuICogICBpbXBvcnRzOiBbQnJvd3Nlck1vZHVsZV0sXG4gKiAgIGRlY2xhcmF0aW9uczogW0FwcENvbXBvbmVudF0sXG4gKiAgIGJvb3RzdHJhcDogW0FwcENvbXBvbmVudF0sXG4gKiAgIHByb3ZpZGVyczogW3tcbiAqICAgICBwcm92aWRlOiBBUFBfSU5JVElBTElaRVIsXG4gKiAgICAgdXNlRmFjdG9yeTogKCkgPT4gaW5pdGlhbGl6ZUFwcCxcbiAqICAgICBtdWx0aTogdHJ1ZVxuICogICAgfV1cbiAqICAgfSlcbiAqICBleHBvcnQgY2xhc3MgQXBwTW9kdWxlIHt9XG4gKiBgYGBcbiAqXG4gKiAjIyMgRXhhbXBsZSB3aXRoIHN0YW5kYWxvbmUgYXBwbGljYXRpb25cbiAqIGBgYFxuICogZXhwb3J0IGZ1bmN0aW9uIGluaXRpYWxpemVBcHAoaHR0cDogSHR0cENsaWVudCkge1xuICogICByZXR1cm4gKCk6IFByb21pc2U8YW55PiA9PlxuICogICAgIGZpcnN0VmFsdWVGcm9tKFxuICogICAgICAgaHR0cFxuICogICAgICAgICAuZ2V0KFwiaHR0cHM6Ly9zb21lVXJsLmNvbS9hcGkvdXNlclwiKVxuICogICAgICAgICAucGlwZSh0YXAodXNlciA9PiB7IC4uLiB9KSlcbiAqICAgICApO1xuICogfVxuICpcbiAqIGJvb3RzdHJhcEFwcGxpY2F0aW9uKEFwcCwge1xuICogICBwcm92aWRlcnM6IFtcbiAqICAgICBwcm92aWRlSHR0cENsaWVudCgpLFxuICogICAgIHtcbiAqICAgICAgIHByb3ZpZGU6IEFQUF9JTklUSUFMSVpFUixcbiAqICAgICAgIHVzZUZhY3Rvcnk6IGluaXRpYWxpemVBcHAsXG4gKiAgICAgICBtdWx0aTogdHJ1ZSxcbiAqICAgICAgIGRlcHM6IFtIdHRwQ2xpZW50XSxcbiAqICAgICB9LFxuICogICBdLFxuICogfSk7XG5cbiAqIGBgYFxuICpcbiAqXG4gKiBJdCdzIGFsc28gcG9zc2libGUgdG8gY29uZmlndXJlIGEgbXVsdGktcHJvdmlkZXIgdXNpbmcgYEFQUF9JTklUSUFMSVpFUmAgdG9rZW4gYW5kIGEgZnVuY3Rpb25cbiAqIHJldHVybmluZyBhbiBvYnNlcnZhYmxlLCBzZWUgYW4gZXhhbXBsZSBiZWxvdy4gTm90ZTogdGhlIGBIdHRwQ2xpZW50YCBpbiB0aGlzIGV4YW1wbGUgaXMgdXNlZCBmb3JcbiAqIGRlbW8gcHVycG9zZXMgdG8gaWxsdXN0cmF0ZSBob3cgdGhlIGZhY3RvcnkgZnVuY3Rpb24gY2FuIHdvcmsgd2l0aCBvdGhlciBwcm92aWRlcnMgYXZhaWxhYmxlXG4gKiB0aHJvdWdoIERJLlxuICpcbiAqICMjIyBFeGFtcGxlIHdpdGggTmdNb2R1bGUtYmFzZWQgYXBwbGljYXRpb25cbiAqIGBgYFxuICogIGZ1bmN0aW9uIGluaXRpYWxpemVBcHBGYWN0b3J5KGh0dHBDbGllbnQ6IEh0dHBDbGllbnQpOiAoKSA9PiBPYnNlcnZhYmxlPGFueT4ge1xuICogICByZXR1cm4gKCkgPT4gaHR0cENsaWVudC5nZXQoXCJodHRwczovL3NvbWVVcmwuY29tL2FwaS91c2VyXCIpXG4gKiAgICAgLnBpcGUoXG4gKiAgICAgICAgdGFwKHVzZXIgPT4geyAuLi4gfSlcbiAqICAgICApO1xuICogIH1cbiAqXG4gKiAgQE5nTW9kdWxlKHtcbiAqICAgIGltcG9ydHM6IFtCcm93c2VyTW9kdWxlLCBIdHRwQ2xpZW50TW9kdWxlXSxcbiAqICAgIGRlY2xhcmF0aW9uczogW0FwcENvbXBvbmVudF0sXG4gKiAgICBib290c3RyYXA6IFtBcHBDb21wb25lbnRdLFxuICogICAgcHJvdmlkZXJzOiBbe1xuICogICAgICBwcm92aWRlOiBBUFBfSU5JVElBTElaRVIsXG4gKiAgICAgIHVzZUZhY3Rvcnk6IGluaXRpYWxpemVBcHBGYWN0b3J5LFxuICogICAgICBkZXBzOiBbSHR0cENsaWVudF0sXG4gKiAgICAgIG11bHRpOiB0cnVlXG4gKiAgICB9XVxuICogIH0pXG4gKiAgZXhwb3J0IGNsYXNzIEFwcE1vZHVsZSB7fVxuICogYGBgXG4gKlxuICogIyMjIEV4YW1wbGUgd2l0aCBzdGFuZGFsb25lIGFwcGxpY2F0aW9uXG4gKiBgYGBcbiAqICBmdW5jdGlvbiBpbml0aWFsaXplQXBwRmFjdG9yeShodHRwQ2xpZW50OiBIdHRwQ2xpZW50KTogKCkgPT4gT2JzZXJ2YWJsZTxhbnk+IHtcbiAqICAgcmV0dXJuICgpID0+IGh0dHBDbGllbnQuZ2V0KFwiaHR0cHM6Ly9zb21lVXJsLmNvbS9hcGkvdXNlclwiKVxuICogICAgIC5waXBlKFxuICogICAgICAgIHRhcCh1c2VyID0+IHsgLi4uIH0pXG4gKiAgICAgKTtcbiAqICB9XG4gKlxuICogYm9vdHN0cmFwQXBwbGljYXRpb24oQXBwLCB7XG4gKiAgIHByb3ZpZGVyczogW1xuICogICAgIHByb3ZpZGVIdHRwQ2xpZW50KCksXG4gKiAgICAge1xuICogICAgICAgcHJvdmlkZTogQVBQX0lOSVRJQUxJWkVSLFxuICogICAgICAgdXNlRmFjdG9yeTogaW5pdGlhbGl6ZUFwcEZhY3RvcnksXG4gKiAgICAgICBtdWx0aTogdHJ1ZSxcbiAqICAgICAgIGRlcHM6IFtIdHRwQ2xpZW50XSxcbiAqICAgICB9LFxuICogICBdLFxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBjb25zdCBBUFBfSU5JVElBTElaRVIgPSBuZXcgSW5qZWN0aW9uVG9rZW48XG4gIFJlYWRvbmx5QXJyYXk8KCkgPT4gT2JzZXJ2YWJsZTx1bmtub3duPiB8IFByb21pc2U8dW5rbm93bj4gfCB2b2lkPlxuPihuZ0Rldk1vZGUgPyAnQXBwbGljYXRpb24gSW5pdGlhbGl6ZXInIDogJycpO1xuXG4vKipcbiAqIEEgY2xhc3MgdGhhdCByZWZsZWN0cyB0aGUgc3RhdGUgb2YgcnVubmluZyB7QGxpbmsgQVBQX0lOSVRJQUxJWkVSfSBmdW5jdGlvbnMuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5ASW5qZWN0YWJsZSh7cHJvdmlkZWRJbjogJ3Jvb3QnfSlcbmV4cG9ydCBjbGFzcyBBcHBsaWNhdGlvbkluaXRTdGF0dXMge1xuICAvLyBVc2luZyBub24gbnVsbCBhc3NlcnRpb24sIHRoZXNlIGZpZWxkcyBhcmUgZGVmaW5lZCBiZWxvd1xuICAvLyB3aXRoaW4gdGhlIGBuZXcgUHJvbWlzZWAgY2FsbGJhY2sgKHN5bmNocm9ub3VzbHkpLlxuICBwcml2YXRlIHJlc29sdmUhOiAoLi4uYXJnczogYW55W10pID0+IHZvaWQ7XG4gIHByaXZhdGUgcmVqZWN0ITogKC4uLmFyZ3M6IGFueVtdKSA9PiB2b2lkO1xuXG4gIHByaXZhdGUgaW5pdGlhbGl6ZWQgPSBmYWxzZTtcbiAgcHVibGljIHJlYWRvbmx5IGRvbmUgPSBmYWxzZTtcbiAgcHVibGljIHJlYWRvbmx5IGRvbmVQcm9taXNlOiBQcm9taXNlPGFueT4gPSBuZXcgUHJvbWlzZSgocmVzLCByZWopID0+IHtcbiAgICB0aGlzLnJlc29sdmUgPSByZXM7XG4gICAgdGhpcy5yZWplY3QgPSByZWo7XG4gIH0pO1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgYXBwSW5pdHMgPSBpbmplY3QoQVBQX0lOSVRJQUxJWkVSLCB7b3B0aW9uYWw6IHRydWV9KSA/PyBbXTtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBpZiAoKHR5cGVvZiBuZ0Rldk1vZGUgPT09ICd1bmRlZmluZWQnIHx8IG5nRGV2TW9kZSkgJiYgIUFycmF5LmlzQXJyYXkodGhpcy5hcHBJbml0cykpIHtcbiAgICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgIFJ1bnRpbWVFcnJvckNvZGUuSU5WQUxJRF9NVUxUSV9QUk9WSURFUixcbiAgICAgICAgJ1VuZXhwZWN0ZWQgdHlwZSBvZiB0aGUgYEFQUF9JTklUSUFMSVpFUmAgdG9rZW4gdmFsdWUgJyArXG4gICAgICAgICAgYChleHBlY3RlZCBhbiBhcnJheSwgYnV0IGdvdCAke3R5cGVvZiB0aGlzLmFwcEluaXRzfSkuIGAgK1xuICAgICAgICAgICdQbGVhc2UgY2hlY2sgdGhhdCB0aGUgYEFQUF9JTklUSUFMSVpFUmAgdG9rZW4gaXMgY29uZmlndXJlZCBhcyBhICcgK1xuICAgICAgICAgICdgbXVsdGk6IHRydWVgIHByb3ZpZGVyLicsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgcnVuSW5pdGlhbGl6ZXJzKCkge1xuICAgIGlmICh0aGlzLmluaXRpYWxpemVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYXN5bmNJbml0UHJvbWlzZXMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGFwcEluaXRzIG9mIHRoaXMuYXBwSW5pdHMpIHtcbiAgICAgIGNvbnN0IGluaXRSZXN1bHQgPSBhcHBJbml0cygpO1xuICAgICAgaWYgKGlzUHJvbWlzZShpbml0UmVzdWx0KSkge1xuICAgICAgICBhc3luY0luaXRQcm9taXNlcy5wdXNoKGluaXRSZXN1bHQpO1xuICAgICAgfSBlbHNlIGlmIChpc1N1YnNjcmliYWJsZShpbml0UmVzdWx0KSkge1xuICAgICAgICBjb25zdCBvYnNlcnZhYmxlQXNQcm9taXNlID0gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgIGluaXRSZXN1bHQuc3Vic2NyaWJlKHtjb21wbGV0ZTogcmVzb2x2ZSwgZXJyb3I6IHJlamVjdH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgYXN5bmNJbml0UHJvbWlzZXMucHVzaChvYnNlcnZhYmxlQXNQcm9taXNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjb21wbGV0ZSA9ICgpID0+IHtcbiAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3Igb3ZlcndyaXRpbmcgYSByZWFkb25seVxuICAgICAgdGhpcy5kb25lID0gdHJ1ZTtcbiAgICAgIHRoaXMucmVzb2x2ZSgpO1xuICAgIH07XG5cbiAgICBQcm9taXNlLmFsbChhc3luY0luaXRQcm9taXNlcylcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgY29tcGxldGUoKTtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgdGhpcy5yZWplY3QoZSk7XG4gICAgICB9KTtcblxuICAgIGlmIChhc3luY0luaXRQcm9taXNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbXBsZXRlKCk7XG4gICAgfVxuICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuICB9XG59XG4iXX0=