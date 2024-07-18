/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { inject, InjectionToken, makeEnvironmentProviders, } from '@angular/core';
import { HttpBackend, HttpHandler } from './backend';
import { HttpClient } from './client';
import { FetchBackend } from './fetch';
import { HTTP_INTERCEPTOR_FNS, HttpInterceptorHandler, legacyInterceptorFnFactory, } from './interceptor';
import { jsonpCallbackContext, JsonpCallbackContext, JsonpClientBackend, jsonpInterceptorFn, } from './jsonp';
import { HttpXhrBackend } from './xhr';
import { HttpXsrfCookieExtractor, HttpXsrfTokenExtractor, XSRF_COOKIE_NAME, XSRF_ENABLED, XSRF_HEADER_NAME, xsrfInterceptorFn, } from './xsrf';
/**
 * Identifies a particular kind of `HttpFeature`.
 *
 * @publicApi
 */
export var HttpFeatureKind;
(function (HttpFeatureKind) {
    HttpFeatureKind[HttpFeatureKind["Interceptors"] = 0] = "Interceptors";
    HttpFeatureKind[HttpFeatureKind["LegacyInterceptors"] = 1] = "LegacyInterceptors";
    HttpFeatureKind[HttpFeatureKind["CustomXsrfConfiguration"] = 2] = "CustomXsrfConfiguration";
    HttpFeatureKind[HttpFeatureKind["NoXsrfProtection"] = 3] = "NoXsrfProtection";
    HttpFeatureKind[HttpFeatureKind["JsonpSupport"] = 4] = "JsonpSupport";
    HttpFeatureKind[HttpFeatureKind["RequestsMadeViaParent"] = 5] = "RequestsMadeViaParent";
    HttpFeatureKind[HttpFeatureKind["Fetch"] = 6] = "Fetch";
})(HttpFeatureKind || (HttpFeatureKind = {}));
function makeHttpFeature(kind, providers) {
    return {
        ɵkind: kind,
        ɵproviders: providers,
    };
}
/**
 * Configures Angular's `HttpClient` service to be available for injection.
 *
 * By default, `HttpClient` will be configured for injection with its default options for XSRF
 * protection of outgoing requests. Additional configuration options can be provided by passing
 * feature functions to `provideHttpClient`. For example, HTTP interceptors can be added using the
 * `withInterceptors(...)` feature.
 *
 * <div class="alert is-helpful">
 *
 * It's strongly recommended to enable
 * [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) for applications that use
 * Server-Side Rendering for better performance and compatibility. To enable `fetch`, add
 * `withFetch()` feature to the `provideHttpClient()` call at the root of the application:
 *
 * ```
 * provideHttpClient(withFetch());
 * ```
 *
 * </div>
 *
 * @see {@link withInterceptors}
 * @see {@link withInterceptorsFromDi}
 * @see {@link withXsrfConfiguration}
 * @see {@link withNoXsrfProtection}
 * @see {@link withJsonpSupport}
 * @see {@link withRequestsMadeViaParent}
 * @see {@link withFetch}
 */
export function provideHttpClient(...features) {
    if (ngDevMode) {
        const featureKinds = new Set(features.map((f) => f.ɵkind));
        if (featureKinds.has(HttpFeatureKind.NoXsrfProtection) &&
            featureKinds.has(HttpFeatureKind.CustomXsrfConfiguration)) {
            throw new Error(ngDevMode
                ? `Configuration error: found both withXsrfConfiguration() and withNoXsrfProtection() in the same call to provideHttpClient(), which is a contradiction.`
                : '');
        }
    }
    const providers = [
        HttpClient,
        HttpXhrBackend,
        HttpInterceptorHandler,
        { provide: HttpHandler, useExisting: HttpInterceptorHandler },
        {
            provide: HttpBackend,
            useFactory: () => {
                return inject(FetchBackend, { optional: true }) ?? inject(HttpXhrBackend);
            },
        },
        {
            provide: HTTP_INTERCEPTOR_FNS,
            useValue: xsrfInterceptorFn,
            multi: true,
        },
        { provide: XSRF_ENABLED, useValue: true },
        { provide: HttpXsrfTokenExtractor, useClass: HttpXsrfCookieExtractor },
    ];
    for (const feature of features) {
        providers.push(...feature.ɵproviders);
    }
    return makeEnvironmentProviders(providers);
}
/**
 * Adds one or more functional-style HTTP interceptors to the configuration of the `HttpClient`
 * instance.
 *
 * @see {@link HttpInterceptorFn}
 * @see {@link provideHttpClient}
 * @publicApi
 */
export function withInterceptors(interceptorFns) {
    return makeHttpFeature(HttpFeatureKind.Interceptors, interceptorFns.map((interceptorFn) => {
        return {
            provide: HTTP_INTERCEPTOR_FNS,
            useValue: interceptorFn,
            multi: true,
        };
    }));
}
const LEGACY_INTERCEPTOR_FN = new InjectionToken(ngDevMode ? 'LEGACY_INTERCEPTOR_FN' : '');
/**
 * Includes class-based interceptors configured using a multi-provider in the current injector into
 * the configured `HttpClient` instance.
 *
 * Prefer `withInterceptors` and functional interceptors instead, as support for DI-provided
 * interceptors may be phased out in a later release.
 *
 * @see {@link HttpInterceptor}
 * @see {@link HTTP_INTERCEPTORS}
 * @see {@link provideHttpClient}
 */
export function withInterceptorsFromDi() {
    // Note: the legacy interceptor function is provided here via an intermediate token
    // (`LEGACY_INTERCEPTOR_FN`), using a pattern which guarantees that if these providers are
    // included multiple times, all of the multi-provider entries will have the same instance of the
    // interceptor function. That way, the `HttpINterceptorHandler` will dedup them and legacy
    // interceptors will not run multiple times.
    return makeHttpFeature(HttpFeatureKind.LegacyInterceptors, [
        {
            provide: LEGACY_INTERCEPTOR_FN,
            useFactory: legacyInterceptorFnFactory,
        },
        {
            provide: HTTP_INTERCEPTOR_FNS,
            useExisting: LEGACY_INTERCEPTOR_FN,
            multi: true,
        },
    ]);
}
/**
 * Customizes the XSRF protection for the configuration of the current `HttpClient` instance.
 *
 * This feature is incompatible with the `withNoXsrfProtection` feature.
 *
 * @see {@link provideHttpClient}
 */
export function withXsrfConfiguration({ cookieName, headerName, }) {
    const providers = [];
    if (cookieName !== undefined) {
        providers.push({ provide: XSRF_COOKIE_NAME, useValue: cookieName });
    }
    if (headerName !== undefined) {
        providers.push({ provide: XSRF_HEADER_NAME, useValue: headerName });
    }
    return makeHttpFeature(HttpFeatureKind.CustomXsrfConfiguration, providers);
}
/**
 * Disables XSRF protection in the configuration of the current `HttpClient` instance.
 *
 * This feature is incompatible with the `withXsrfConfiguration` feature.
 *
 * @see {@link provideHttpClient}
 */
export function withNoXsrfProtection() {
    return makeHttpFeature(HttpFeatureKind.NoXsrfProtection, [
        {
            provide: XSRF_ENABLED,
            useValue: false,
        },
    ]);
}
/**
 * Add JSONP support to the configuration of the current `HttpClient` instance.
 *
 * @see {@link provideHttpClient}
 */
export function withJsonpSupport() {
    return makeHttpFeature(HttpFeatureKind.JsonpSupport, [
        JsonpClientBackend,
        { provide: JsonpCallbackContext, useFactory: jsonpCallbackContext },
        { provide: HTTP_INTERCEPTOR_FNS, useValue: jsonpInterceptorFn, multi: true },
    ]);
}
/**
 * Configures the current `HttpClient` instance to make requests via the parent injector's
 * `HttpClient` instead of directly.
 *
 * By default, `provideHttpClient` configures `HttpClient` in its injector to be an independent
 * instance. For example, even if `HttpClient` is configured in the parent injector with
 * one or more interceptors, they will not intercept requests made via this instance.
 *
 * With this option enabled, once the request has passed through the current injector's
 * interceptors, it will be delegated to the parent injector's `HttpClient` chain instead of
 * dispatched directly, and interceptors in the parent configuration will be applied to the request.
 *
 * If there are several `HttpClient` instances in the injector hierarchy, it's possible for
 * `withRequestsMadeViaParent` to be used at multiple levels, which will cause the request to
 * "bubble up" until either reaching the root level or an `HttpClient` which was not configured with
 * this option.
 *
 * @see {@link provideHttpClient}
 * @developerPreview
 */
export function withRequestsMadeViaParent() {
    return makeHttpFeature(HttpFeatureKind.RequestsMadeViaParent, [
        {
            provide: HttpBackend,
            useFactory: () => {
                const handlerFromParent = inject(HttpHandler, { skipSelf: true, optional: true });
                if (ngDevMode && handlerFromParent === null) {
                    throw new Error('withRequestsMadeViaParent() can only be used when the parent injector also configures HttpClient');
                }
                return handlerFromParent;
            },
        },
    ]);
}
/**
 * Configures the current `HttpClient` instance to make requests using the fetch API.
 *
 * Note: The Fetch API doesn't support progress report on uploads.
 *
 * @publicApi
 */
export function withFetch() {
    return makeHttpFeature(HttpFeatureKind.Fetch, [
        FetchBackend,
        { provide: HttpBackend, useExisting: FetchBackend },
    ]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21tb24vaHR0cC9zcmMvcHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUVMLE1BQU0sRUFDTixjQUFjLEVBQ2Qsd0JBQXdCLEdBRXpCLE1BQU0sZUFBZSxDQUFDO0FBRXZCLE9BQU8sRUFBQyxXQUFXLEVBQUUsV0FBVyxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ25ELE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFDcEMsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUNyQyxPQUFPLEVBQ0wsb0JBQW9CLEVBRXBCLHNCQUFzQixFQUN0QiwwQkFBMEIsR0FDM0IsTUFBTSxlQUFlLENBQUM7QUFDdkIsT0FBTyxFQUNMLG9CQUFvQixFQUNwQixvQkFBb0IsRUFDcEIsa0JBQWtCLEVBQ2xCLGtCQUFrQixHQUNuQixNQUFNLFNBQVMsQ0FBQztBQUNqQixPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sT0FBTyxDQUFDO0FBQ3JDLE9BQU8sRUFDTCx1QkFBdUIsRUFDdkIsc0JBQXNCLEVBQ3RCLGdCQUFnQixFQUNoQixZQUFZLEVBQ1osZ0JBQWdCLEVBQ2hCLGlCQUFpQixHQUNsQixNQUFNLFFBQVEsQ0FBQztBQUVoQjs7OztHQUlHO0FBQ0gsTUFBTSxDQUFOLElBQVksZUFRWDtBQVJELFdBQVksZUFBZTtJQUN6QixxRUFBWSxDQUFBO0lBQ1osaUZBQWtCLENBQUE7SUFDbEIsMkZBQXVCLENBQUE7SUFDdkIsNkVBQWdCLENBQUE7SUFDaEIscUVBQVksQ0FBQTtJQUNaLHVGQUFxQixDQUFBO0lBQ3JCLHVEQUFLLENBQUE7QUFDUCxDQUFDLEVBUlcsZUFBZSxLQUFmLGVBQWUsUUFRMUI7QUFZRCxTQUFTLGVBQWUsQ0FDdEIsSUFBVyxFQUNYLFNB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RDtZQUNFLE9BQU8sRUFBRSxXQUFXO1lBQ3BCLFVBQVUsRUFBRSxHQUFHLEVBQUU7Z0JBQ2YsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsV0FBVyxFQUFFLEVBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQztnQkFDaEYsSUFBSSxTQUFTLElBQUksaUJBQWlCLEtBQUssSUFBSSxFQUFFLENBQUM7b0JBQzVDLE1BQU0sSUFBSSxLQUFLLENBQ2Isa0dBQWtHLENBQ25HLENBQUM7Z0JBQ0osQ0FBQztnQkFDRCxPQUFPLGlCQUFpQixDQUFDO1lBQzNCLENBQUM7U0FDRjtLQUNGLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsU0FBUztJQUN2QixPQUFPLGVBQWUsQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFO1FBQzVDLFlBQVk7UUFDWixFQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBQztLQUNsRCxDQUFDLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEVudmlyb25tZW50UHJvdmlkZXJzLFxuICBpbmplY3QsXG4gIEluamVjdGlvblRva2VuLFxuICBtYWtlRW52aXJvbm1lbnRQcm92aWRlcnMsXG4gIFByb3ZpZGVyLFxufSBmcm9tICdAYW5ndWxhci9jb3JlJztcblxuaW1wb3J0IHtIdHRwQmFja2VuZCwgSHR0cEhhbmRsZXJ9IGZyb20gJy4vYmFja2VuZCc7XG5pbXBvcnQge0h0dHBDbGllbnR9IGZyb20gJy4vY2xpZW50JztcbmltcG9ydCB7RmV0Y2hCYWNrZW5kfSBmcm9tICcuL2ZldGNoJztcbmltcG9ydCB7XG4gIEhUVFBfSU5URVJDRVBUT1JfRk5TLFxuICBIdHRwSW50ZXJjZXB0b3JGbixcbiAgSHR0cEludGVyY2VwdG9ySGFuZGxlcixcbiAgbGVnYWN5SW50ZXJjZXB0b3JGbkZhY3RvcnksXG59IGZyb20gJy4vaW50ZXJjZXB0b3InO1xuaW1wb3J0IHtcbiAganNvbnBDYWxsYmFja0NvbnRleHQsXG4gIEpzb25wQ2FsbGJhY2tDb250ZXh0LFxuICBKc29ucENsaWVudEJhY2tlbmQsXG4gIGpzb25wSW50ZXJjZXB0b3JGbixcbn0gZnJvbSAnLi9qc29ucCc7XG5pbXBvcnQge0h0dHBYaHJCYWNrZW5kfSBmcm9tICcuL3hocic7XG5pbXBvcnQge1xuICBIdHRwWHNyZkNvb2tpZUV4dHJhY3RvcixcbiAgSHR0cFhzcmZUb2tlbkV4dHJhY3RvcixcbiAgWFNSRl9DT09LSUVfTkFNRSxcbiAgWFNSRl9FTkFCTEVELFxuICBYU1JGX0hFQURFUl9OQU1FLFxuICB4c3JmSW50ZXJjZXB0b3JGbixcbn0gZnJvbSAnLi94c3JmJztcblxuLyoqXG4gKiBJZGVudGlmaWVzIGEgcGFydGljdWxhciBraW5kIG9mIGBIdHRwRmVhdHVyZWAuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgZW51bSBIdHRwRmVhdHVyZUtpbmQge1xuICBJbnRlcmNlcHRvcnMsXG4gIExlZ2FjeUludGVyY2VwdG9ycyxcbiAgQ3VzdG9tWHNyZkNvbmZpZ3VyYXRpb24sXG4gIE5vWHNyZlByb3RlY3Rpb24sXG4gIEpzb25wU3VwcG9ydCxcbiAgUmVxdWVzdHNNYWRlVmlhUGFyZW50LFxuICBGZXRjaCxcbn1cblxuLyoqXG4gKiBBIGZlYXR1cmUgZm9yIHVzZSB3aGVuIGNvbmZpZ3VyaW5nIGBwcm92aWRlSHR0cENsaWVudGAuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEh0dHBGZWF0dXJlPEtpbmRUIGV4dGVuZHMgSHR0cEZlYXR1cmVLaW5kPiB7XG4gIMm1a2luZDogS2luZFQ7XG4gIMm1cHJvdmlkZXJzOiBQcm92aWRlcltdO1xufVxuXG5mdW5jdGlvbiBtYWtlSHR0cEZlYXR1cmU8S2luZFQgZXh0ZW5kcyBIdHRwRmVhdHVyZUtpbmQ+KFxuICBraW5kOiBLaW5kVCxcbiAgcHJvdmlkZXJzOiBQcm92aWRlcltdLFxuKTogSHR0cEZlYXR1cmU8S2luZFQ+IHtcbiAgcmV0dXJuIHtcbiAgICDJtWtpbmQ6IGtpbmQsXG4gICAgybVwcm92aWRlcnM6IHByb3ZpZGVycyxcbiAgfTtcbn1cblxuLyoqXG4gKiBDb25maWd1cmVzIEFuZ3VsYXIncyBgSHR0cENsaWVudGAgc2VydmljZSB0byBiZSBhdmFpbGFibGUgZm9yIGluamVjdGlvbi5cbiAqXG4gKiBCeSBkZWZhdWx0LCBgSHR0cENsaWVudGAgd2lsbCBiZSBjb25maWd1cmVkIGZvciBpbmplY3Rpb24gd2l0aCBpdHMgZGVmYXVsdCBvcHRpb25zIGZvciBYU1JGXG4gKiBwcm90ZWN0aW9uIG9mIG91dGdvaW5nIHJlcXVlc3RzLiBBZGRpdGlvbmFsIGNvbmZpZ3VyYXRpb24gb3B0aW9ucyBjYW4gYmUgcHJvdmlkZWQgYnkgcGFzc2luZ1xuICogZmVhdHVyZSBmdW5jdGlvbnMgdG8gYHByb3ZpZGVIdHRwQ2xpZW50YC4gRm9yIGV4YW1wbGUsIEhUVFAgaW50ZXJjZXB0b3JzIGNhbiBiZSBhZGRlZCB1c2luZyB0aGVcbiAqIGB3aXRoSW50ZXJjZXB0b3JzKC4uLilgIGZlYXR1cmUuXG4gKlxuICogPGRpdiBjbGFzcz1cImFsZXJ0IGlzLWhlbHBmdWxcIj5cbiAqXG4gKiBJdCdzIHN0cm9uZ2x5IHJlY29tbWVuZGVkIHRvIGVuYWJsZVxuICogW2BmZXRjaGBdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9GZXRjaF9BUEkpIGZvciBhcHBsaWNhdGlvbnMgdGhhdCB1c2VcbiAqIFNlcnZlci1TaWRlIFJlbmRlcmluZyBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlIGFuZCBjb21wYXRpYmlsaXR5LiBUbyBlbmFibGUgYGZldGNoYCwgYWRkXG4gKiBgd2l0aEZldGNoKClgIGZlYXR1cmUgdG8gdGhlIGBwcm92aWRlSHR0cENsaWVudCgpYCBjYWxsIGF0IHRoZSByb290IG9mIHRoZSBhcHBsaWNhdGlvbjpcbiAqXG4gKiBgYGBcbiAqIHByb3ZpZGVIdHRwQ2xpZW50KHdpdGhGZXRjaCgpKTtcbiAqIGBgYFxuICpcbiAqIDwvZGl2PlxuICpcbiAqIEBzZWUge0BsaW5rIHdpdGhJbnRlcmNlcHRvcnN9XG4gKiBAc2VlIHtAbGluayB3aXRoSW50ZXJjZXB0b3JzRnJvbURpfVxuICogQHNlZSB7QGxpbmsgd2l0aFhzcmZDb25maWd1cmF0aW9ufVxuICogQHNlZSB7QGxpbmsgd2l0aE5vWHNyZlByb3RlY3Rpb259XG4gKiBAc2VlIHtAbGluayB3aXRoSnNvbnBTdXBwb3J0fVxuICogQHNlZSB7QGxpbmsgd2l0aFJlcXVlc3RzTWFkZVZpYVBhcmVudH1cbiAqIEBzZWUge0BsaW5rIHdpdGhGZXRjaH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByb3ZpZGVIdHRwQ2xpZW50KFxuICAuLi5mZWF0dXJlczogSHR0cEZlYXR1cmU8SHR0cEZlYXR1cmVLaW5kPltdXG4pOiBFbnZpcm9ubWVudFByb3ZpZGVycyB7XG4gIGlmIChuZ0Rldk1vZGUpIHtcbiAgICBjb25zdCBmZWF0dXJlS2luZHMgPSBuZXcgU2V0KGZlYXR1cmVzLm1hcCgoZikgPT4gZi7JtWtpbmQpKTtcbiAgICBpZiAoXG4gICAgICBmZWF0dXJlS2luZHMuaGFzKEh0dHBGZWF0dXJlS2luZC5Ob1hzcmZQcm90ZWN0aW9uKSAmJlxuICAgICAgZmVhdHVyZUtpbmRzLmhhcyhIdHRwRmVhdHVyZUtpbmQuQ3VzdG9tWHNyZkNvbmZpZ3VyYXRpb24pXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIG5nRGV2TW9kZVxuICAgICAgICAgID8gYENvbmZpZ3VyYXRpb24gZXJyb3I6IGZvdW5kIGJvdGggd2l0aFhzcmZDb25maWd1cmF0aW9uKCkgYW5kIHdpdGhOb1hzcmZQcm90ZWN0aW9uKCkgaW4gdGhlIHNhbWUgY2FsbCB0byBwcm92aWRlSHR0cENsaWVudCgpLCB3aGljaCBpcyBhIGNvbnRyYWRpY3Rpb24uYFxuICAgICAgICAgIDogJycsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHByb3ZpZGVyczogUHJvdmlkZXJbXSA9IFtcbiAgICBIdHRwQ2xpZW50LFxuICAgIEh0dHBYaHJCYWNrZW5kLFxuICAgIEh0dHBJbnRlcmNlcHRvckhhbmRsZXIsXG4gICAge3Byb3ZpZGU6IEh0dHBIYW5kbGVyLCB1c2VFeGlzdGluZzogSHR0cEludGVyY2VwdG9ySGFuZGxlcn0sXG4gICAge1xuICAgICAgcHJvdmlkZTogSHR0cEJhY2tlbmQsXG4gICAgICB1c2VGYWN0b3J5OiAoKSA9PiB7XG4gICAgICAgIHJldHVybiBpbmplY3QoRmV0Y2hCYWNrZW5kLCB7b3B0aW9uYWw6IHRydWV9KSA/PyBpbmplY3QoSHR0cFhockJhY2tlbmQpO1xuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIHByb3ZpZGU6IEhUVFBfSU5URVJDRVBUT1JfRk5TLFxuICAgICAgdXNlVmFsdWU6IHhzcmZJbnRlcmNlcHRvckZuLFxuICAgICAgbXVsdGk6IHRydWUsXG4gICAgfSxcbiAgICB7cHJvdmlkZTogWFNSRl9FTkFCTEVELCB1c2VWYWx1ZTogdHJ1ZX0sXG4gICAge3Byb3ZpZGU6IEh0dHBYc3JmVG9rZW5FeHRyYWN0b3IsIHVzZUNsYXNzOiBIdHRwWHNyZkNvb2tpZUV4dHJhY3Rvcn0sXG4gIF07XG5cbiAgZm9yIChjb25zdCBmZWF0dXJlIG9mIGZlYXR1cmVzKSB7XG4gICAgcHJvdmlkZXJzLnB1c2goLi4uZmVhdHVyZS7JtXByb3ZpZGVycyk7XG4gIH1cblxuICByZXR1cm4gbWFrZUVudmlyb25tZW50UHJvdmlkZXJzKHByb3ZpZGVycyk7XG59XG5cbi8qKlxuICogQWRkcyBvbmUgb3IgbW9yZSBmdW5jdGlvbmFsLXN0eWxlIEhUVFAgaW50ZXJjZXB0b3JzIHRvIHRoZSBjb25maWd1cmF0aW9uIG9mIHRoZSBgSHR0cENsaWVudGBcbiAqIGluc3RhbmNlLlxuICpcbiAqIEBzZWUge0BsaW5rIEh0dHBJbnRlcmNlcHRvckZufVxuICogQHNlZSB7QGxpbmsgcHJvdmlkZUh0dHBDbGllbnR9XG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3aXRoSW50ZXJjZXB0b3JzKFxuICBpbnRlcmNlcHRvckZuczogSHR0cEludGVyY2VwdG9yRm5bXSxcbik6IEh0dHBGZWF0dXJlPEh0dHBGZWF0dXJlS2luZC5JbnRlcmNlcHRvcnM+IHtcbiAgcmV0dXJuIG1ha2VIdHRwRmVhdHVyZShcbiAgICBIdHRwRmVhdHVyZUtpbmQuSW50ZXJjZXB0b3JzLFxuICAgIGludGVyY2VwdG9yRm5zLm1hcCgoaW50ZXJjZXB0b3JGbikgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcHJvdmlkZTogSFRUUF9JTlRFUkNFUFRPUl9GTlMsXG4gICAgICAgIHVzZVZhbHVlOiBpbnRlcmNlcHRvckZuLFxuICAgICAgICBtdWx0aTogdHJ1ZSxcbiAgICAgIH07XG4gICAgfSksXG4gICk7XG59XG5cbmNvbnN0IExFR0FDWV9JTlRFUkNFUFRPUl9GTiA9IG5ldyBJbmplY3Rpb25Ub2tlbjxIdHRwSW50ZXJjZXB0b3JGbj4oXG4gIG5nRGV2TW9kZSA/ICdMRUdBQ1lfSU5URVJDRVBUT1JfRk4nIDogJycsXG4pO1xuXG4vKipcbiAqIEluY2x1ZGVzIGNsYXNzLWJhc2VkIGludGVyY2VwdG9ycyBjb25maWd1cmVkIHVzaW5nIGEgbXVsdGktcHJvdmlkZXIgaW4gdGhlIGN1cnJlbnQgaW5qZWN0b3IgaW50b1xuICogdGhlIGNvbmZpZ3VyZWQgYEh0dHBDbGllbnRgIGluc3RhbmNlLlxuICpcbiAqIFByZWZlciBgd2l0aEludGVyY2VwdG9yc2AgYW5kIGZ1bmN0aW9uYWwgaW50ZXJjZXB0b3JzIGluc3RlYWQsIGFzIHN1cHBvcnQgZm9yIERJLXByb3ZpZGVkXG4gKiBpbnRlcmNlcHRvcnMgbWF5IGJlIHBoYXNlZCBvdXQgaW4gYSBsYXRlciByZWxlYXNlLlxuICpcbiAqIEBzZWUge0BsaW5rIEh0dHBJbnRlcmNlcHRvcn1cbiAqIEBzZWUge0BsaW5rIEhUVFBfSU5URVJDRVBUT1JTfVxuICogQHNlZSB7QGxpbmsgcHJvdmlkZUh0dHBDbGllbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3aXRoSW50ZXJjZXB0b3JzRnJvbURpKCk6IEh0dHBGZWF0dXJlPEh0dHBGZWF0dXJlS2luZC5MZWdhY3lJbnRlcmNlcHRvcnM+IHtcbiAgLy8gTm90ZTogdGhlIGxlZ2FjeSBpbnRlcmNlcHRvciBmdW5jdGlvbiBpcyBwcm92aWRlZCBoZXJlIHZpYSBhbiBpbnRlcm1lZGlhdGUgdG9rZW5cbiAgLy8gKGBMRUdBQ1lfSU5URVJDRVBUT1JfRk5gKSwgdXNpbmcgYSBwYXR0ZXJuIHdoaWNoIGd1YXJhbnRlZXMgdGhhdCBpZiB0aGVzZSBwcm92aWRlcnMgYXJlXG4gIC8vIGluY2x1ZGVkIG11bHRpcGxlIHRpbWVzLCBhbGwgb2YgdGhlIG11bHRpLXByb3ZpZGVyIGVudHJpZXMgd2lsbCBoYXZlIHRoZSBzYW1lIGluc3RhbmNlIG9mIHRoZVxuICAvLyBpbnRlcmNlcHRvciBmdW5jdGlvbi4gVGhhdCB3YXksIHRoZSBgSHR0cElOdGVyY2VwdG9ySGFuZGxlcmAgd2lsbCBkZWR1cCB0aGVtIGFuZCBsZWdhY3lcbiAgLy8gaW50ZXJjZXB0b3JzIHdpbGwgbm90IHJ1biBtdWx0aXBsZSB0aW1lcy5cbiAgcmV0dXJuIG1ha2VIdHRwRmVhdHVyZShIdHRwRmVhdHVyZUtpbmQuTGVnYWN5SW50ZXJjZXB0b3JzLCBbXG4gICAge1xuICAgICAgcHJvdmlkZTogTEVHQUNZX0lOVEVSQ0VQVE9SX0ZOLFxuICAgICAgdXNlRmFjdG9yeTogbGVnYWN5SW50ZXJjZXB0b3JGbkZhY3RvcnksXG4gICAgfSxcbiAgICB7XG4gICAgICBwcm92aWRlOiBIVFRQX0lOVEVSQ0VQVE9SX0ZOUyxcbiAgICAgIHVzZUV4aXN0aW5nOiBMRUdBQ1lfSU5URVJDRVBUT1JfRk4sXG4gICAgICBtdWx0aTogdHJ1ZSxcbiAgICB9LFxuICBdKTtcbn1cblxuLyoqXG4gKiBDdXN0b21pemVzIHRoZSBYU1JGIHByb3RlY3Rpb24gZm9yIHRoZSBjb25maWd1cmF0aW9uIG9mIHRoZSBjdXJyZW50IGBIdHRwQ2xpZW50YCBpbnN0YW5jZS5cbiAqXG4gKiBUaGlzIGZlYXR1cmUgaXMgaW5jb21wYXRpYmxlIHdpdGggdGhlIGB3aXRoTm9Yc3JmUHJvdGVjdGlvbmAgZmVhdHVyZS5cbiAqXG4gKiBAc2VlIHtAbGluayBwcm92aWRlSHR0cENsaWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdpdGhYc3JmQ29uZmlndXJhdGlvbih7XG4gIGNvb2tpZU5hbWUsXG4gIGhlYWRlck5hbWUsXG59OiB7XG4gIGNvb2tpZU5hbWU/OiBzdHJpbmc7XG4gIGhlYWRlck5hbWU/OiBzdHJpbmc7XG59KTogSHR0cEZlYXR1cmU8SHR0cEZlYXR1cmVLaW5kLkN1c3RvbVhzcmZDb25maWd1cmF0aW9uPiB7XG4gIGNvbnN0IHByb3ZpZGVyczogUHJvdmlkZXJbXSA9IFtdO1xuICBpZiAoY29va2llTmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcHJvdmlkZXJzLnB1c2goe3Byb3ZpZGU6IFhTUkZfQ09PS0lFX05BTUUsIHVzZVZhbHVlOiBjb29raWVOYW1lfSk7XG4gIH1cbiAgaWYgKGhlYWRlck5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgIHByb3ZpZGVycy5wdXNoKHtwcm92aWRlOiBYU1JGX0hFQURFUl9OQU1FLCB1c2VWYWx1ZTogaGVhZGVyTmFtZX0pO1xuICB9XG5cbiAgcmV0dXJuIG1ha2VIdHRwRmVhdHVyZShIdHRwRmVhdHVyZUtpbmQuQ3VzdG9tWHNyZkNvbmZpZ3VyYXRpb24sIHByb3ZpZGVycyk7XG59XG5cbi8qKlxuICogRGlzYWJsZXMgWFNSRiBwcm90ZWN0aW9uIGluIHRoZSBjb25maWd1cmF0aW9uIG9mIHRoZSBjdXJyZW50IGBIdHRwQ2xpZW50YCBpbnN0YW5jZS5cbiAqXG4gKiBUaGlzIGZlYXR1cmUgaXMgaW5jb21wYXRpYmxlIHdpdGggdGhlIGB3aXRoWHNyZkNvbmZpZ3VyYXRpb25gIGZlYXR1cmUuXG4gKlxuICogQHNlZSB7QGxpbmsgcHJvdmlkZUh0dHBDbGllbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3aXRoTm9Yc3JmUHJvdGVjdGlvbigpOiBIdHRwRmVhdHVyZTxIdHRwRmVhdHVyZUtpbmQuTm9Yc3JmUHJvdGVjdGlvbj4ge1xuICByZXR1cm4gbWFrZUh0dHBGZWF0dXJlKEh0dHBGZWF0dXJlS2luZC5Ob1hzcmZQcm90ZWN0aW9uLCBbXG4gICAge1xuICAgICAgcHJvdmlkZTogWFNSRl9FTkFCTEVELFxuICAgICAgdXNlVmFsdWU6IGZhbHNlLFxuICAgIH0sXG4gIF0pO1xufVxuXG4vKipcbiAqIEFkZCBKU09OUCBzdXBwb3J0IHRvIHRoZSBjb25maWd1cmF0aW9uIG9mIHRoZSBjdXJyZW50IGBIdHRwQ2xpZW50YCBpbnN0YW5jZS5cbiAqXG4gKiBAc2VlIHtAbGluayBwcm92aWRlSHR0cENsaWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdpdGhKc29ucFN1cHBvcnQoKTogSHR0cEZlYXR1cmU8SHR0cEZlYXR1cmVLaW5kLkpzb25wU3VwcG9ydD4ge1xuICByZXR1cm4gbWFrZUh0dHBGZWF0dXJlKEh0dHBGZWF0dXJlS2luZC5Kc29ucFN1cHBvcnQsIFtcbiAgICBKc29ucENsaWVudEJhY2tlbmQsXG4gICAge3Byb3ZpZGU6IEpzb25wQ2FsbGJhY2tDb250ZXh0LCB1c2VGYWN0b3J5OiBqc29ucENhbGxiYWNrQ29udGV4dH0sXG4gICAge3Byb3ZpZGU6IEhUVFBfSU5URVJDRVBUT1JfRk5TLCB1c2VWYWx1ZToganNvbnBJbnRlcmNlcHRvckZuLCBtdWx0aTogdHJ1ZX0sXG4gIF0pO1xufVxuXG4vKipcbiAqIENvbmZpZ3VyZXMgdGhlIGN1cnJlbnQgYEh0dHBDbGllbnRgIGluc3RhbmNlIHRvIG1ha2UgcmVxdWVzdHMgdmlhIHRoZSBwYXJlbnQgaW5qZWN0b3Inc1xuICogYEh0dHBDbGllbnRgIGluc3RlYWQgb2YgZGlyZWN0bHkuXG4gKlxuICogQnkgZGVmYXVsdCwgYHByb3ZpZGVIdHRwQ2xpZW50YCBjb25maWd1cmVzIGBIdHRwQ2xpZW50YCBpbiBpdHMgaW5qZWN0b3IgdG8gYmUgYW4gaW5kZXBlbmRlbnRcbiAqIGluc3RhbmNlLiBGb3IgZXhhbXBsZSwgZXZlbiBpZiBgSHR0cENsaWVudGAgaXMgY29uZmlndXJlZCBpbiB0aGUgcGFyZW50IGluamVjdG9yIHdpdGhcbiAqIG9uZSBvciBtb3JlIGludGVyY2VwdG9ycywgdGhleSB3aWxsIG5vdCBpbnRlcmNlcHQgcmVxdWVzdHMgbWFkZSB2aWEgdGhpcyBpbnN0YW5jZS5cbiAqXG4gKiBXaXRoIHRoaXMgb3B0aW9uIGVuYWJsZWQsIG9uY2UgdGhlIHJlcXVlc3QgaGFzIHBhc3NlZCB0aHJvdWdoIHRoZSBjdXJyZW50IGluamVjdG9yJ3NcbiAqIGludGVyY2VwdG9ycywgaXQgd2lsbCBiZSBkZWxlZ2F0ZWQgdG8gdGhlIHBhcmVudCBpbmplY3RvcidzIGBIdHRwQ2xpZW50YCBjaGFpbiBpbnN0ZWFkIG9mXG4gKiBkaXNwYXRjaGVkIGRpcmVjdGx5LCBhbmQgaW50ZXJjZXB0b3JzIGluIHRoZSBwYXJlbnQgY29uZmlndXJhdGlvbiB3aWxsIGJlIGFwcGxpZWQgdG8gdGhlIHJlcXVlc3QuXG4gKlxuICogSWYgdGhlcmUgYXJlIHNldmVyYWwgYEh0dHBDbGllbnRgIGluc3RhbmNlcyBpbiB0aGUgaW5qZWN0b3IgaGllcmFyY2h5LCBpdCdzIHBvc3NpYmxlIGZvclxuICogYHdpdGhSZXF1ZXN0c01hZGVWaWFQYXJlbnRgIHRvIGJlIHVzZWQgYXQgbXVsdGlwbGUgbGV2ZWxzLCB3aGljaCB3aWxsIGNhdXNlIHRoZSByZXF1ZXN0IHRvXG4gKiBcImJ1YmJsZSB1cFwiIHVudGlsIGVpdGhlciByZWFjaGluZyB0aGUgcm9vdCBsZXZlbCBvciBhbiBgSHR0cENsaWVudGAgd2hpY2ggd2FzIG5vdCBjb25maWd1cmVkIHdpdGhcbiAqIHRoaXMgb3B0aW9uLlxuICpcbiAqIEBzZWUge0BsaW5rIHByb3ZpZGVIdHRwQ2xpZW50fVxuICogQGRldmVsb3BlclByZXZpZXdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdpdGhSZXF1ZXN0c01hZGVWaWFQYXJlbnQoKTogSHR0cEZlYXR1cmU8SHR0cEZlYXR1cmVLaW5kLlJlcXVlc3RzTWFkZVZpYVBhcmVudD4ge1xuICByZXR1cm4gbWFrZUh0dHBGZWF0dXJlKEh0dHBGZWF0dXJlS2luZC5SZXF1ZXN0c01hZGVWaWFQYXJlbnQsIFtcbiAgICB7XG4gICAgICBwcm92aWRlOiBIdHRwQmFja2VuZCxcbiAgICAgIHVzZUZhY3Rvcnk6ICgpID0+IHtcbiAgICAgICAgY29uc3QgaGFuZGxlckZyb21QYXJlbnQgPSBpbmplY3QoSHR0cEhhbmRsZXIsIHtza2lwU2VsZjogdHJ1ZSwgb3B0aW9uYWw6IHRydWV9KTtcbiAgICAgICAgaWYgKG5nRGV2TW9kZSAmJiBoYW5kbGVyRnJvbVBhcmVudCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICd3aXRoUmVxdWVzdHNNYWRlVmlhUGFyZW50KCkgY2FuIG9ubHkgYmUgdXNlZCB3aGVuIHRoZSBwYXJlbnQgaW5qZWN0b3IgYWxzbyBjb25maWd1cmVzIEh0dHBDbGllbnQnLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGhhbmRsZXJGcm9tUGFyZW50O1xuICAgICAgfSxcbiAgICB9LFxuICBdKTtcbn1cblxuLyoqXG4gKiBDb25maWd1cmVzIHRoZSBjdXJyZW50IGBIdHRwQ2xpZW50YCBpbnN0YW5jZSB0byBtYWtlIHJlcXVlc3RzIHVzaW5nIHRoZSBmZXRjaCBBUEkuXG4gKlxuICogTm90ZTogVGhlIEZldGNoIEFQSSBkb2Vzbid0IHN1cHBvcnQgcHJvZ3Jlc3MgcmVwb3J0IG9uIHVwbG9hZHMuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gd2l0aEZldGNoKCk6IEh0dHBGZWF0dXJlPEh0dHBGZWF0dXJlS2luZC5GZXRjaD4ge1xuICByZXR1cm4gbWFrZUh0dHBGZWF0dXJlKEh0dHBGZWF0dXJlS2luZC5GZXRjaCwgW1xuICAgIEZldGNoQmFja2VuZCxcbiAgICB7cHJvdmlkZTogSHR0cEJhY2tlbmQsIHVzZUV4aXN0aW5nOiBGZXRjaEJhY2tlbmR9LFxuICBdKTtcbn1cbiJdfQ==