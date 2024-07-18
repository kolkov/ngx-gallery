/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { internalProvideZoneChangeDetection, PROVIDED_NG_ZONE, } from '../change_detection/scheduling/ng_zone_scheduling';
import { ErrorHandler } from '../error_handler';
import { RuntimeError } from '../errors';
import { DEFAULT_LOCALE_ID } from '../i18n/localization';
import { LOCALE_ID } from '../i18n/tokens';
import { ImagePerformanceWarning } from '../image_performance_warning';
import { createOrReusePlatformInjector } from '../platform/platform';
import { PLATFORM_DESTROY_LISTENERS } from '../platform/platform_ref';
import { assertStandaloneComponentType } from '../render3/errors';
import { setLocaleId } from '../render3/i18n/i18n_locale_id';
import { EnvironmentNgModuleRefAdapter } from '../render3/ng_module_ref';
import { NgZone } from '../zone/ng_zone';
import { ApplicationInitStatus } from './application_init';
import { _callAndReportToErrorHandler, ApplicationRef } from './application_ref';
import { PROVIDED_ZONELESS, ChangeDetectionScheduler, } from '../change_detection/scheduling/zoneless_scheduling';
import { ChangeDetectionSchedulerImpl } from '../change_detection/scheduling/zoneless_scheduling_impl';
/**
 * Internal create application API that implements the core application creation logic and optional
 * bootstrap logic.
 *
 * Platforms (such as `platform-browser`) may require different set of application and platform
 * providers for an application to function correctly. As a result, platforms may use this function
 * internally and supply the necessary providers during the bootstrap, while exposing
 * platform-specific APIs as a part of their public API.
 *
 * @returns A promise that returns an `ApplicationRef` instance once resolved.
 */
export function internalCreateApplication(config) {
    try {
        const { rootComponent, appProviders, platformProviders } = config;
        if ((typeof ngDevMode === 'undefined' || ngDevMode) && rootComponent !== undefined) {
            assertStandaloneComponentType(rootComponent);
        }
        const platformInjector = createOrReusePlatformInjector(platformProviders);
        // Create root application injector based on a set of providers configured at the platform
        // bootstrap level as well as providers passed to the bootstrap call by a user.
        const allAppProviders = [
            internalProvideZoneChangeDetection({}),
            { provide: ChangeDetectionScheduler, useExisting: ChangeDetectionSchedulerImpl },
            ...(appProviders || []),
        ];
        const adapter = new EnvironmentNgModuleRefAdapter({
            providers: allAppProviders,
            parent: platformInjector,
            debugName: typeof ngDevMode === 'undefined' || ngDevMode ? 'Environment Injector' : '',
            // We skip environment initializers because we need to run them inside the NgZone, which
            // happens after we get the NgZone instance from the Injector.
            runEnvironmentInitializers: false,
        });
        const envInjector = adapter.injector;
        const ngZone = envInjector.get(NgZone);
        return ngZone.run(() => {
            envInjector.resolveInjectorInitializers();
            const exceptionHandler = envInjector.get(ErrorHandler, null);
            if (typeof ngDevMode === 'undefined' || ngDevMode) {
                if (!exceptionHandler) {
                    throw new RuntimeError(402 /* RuntimeErrorCode.MISSING_REQUIRED_INJECTABLE_IN_BOOTSTRAP */, 'No `ErrorHandler` found in the Dependency Injection tree.');
                }
                if (envInjector.get(PROVIDED_ZONELESS) && envInjector.get(PROVIDED_NG_ZONE)) {
                    throw new RuntimeError(408 /* RuntimeErrorCode.PROVIDED_BOTH_ZONE_AND_ZONELESS */, 'Invalid change detection configuration: ' +
                        'provideZoneChangeDetection and provideExperimentalZonelessChangeDetection cannot be used together.');
                }
            }
            let onErrorSubscription;
            ngZone.runOutsideAngular(() => {
                onErrorSubscription = ngZone.onError.subscribe({
                    next: (error) => {
                        exceptionHandler.handleError(error);
                    },
                });
            });
            // If the whole platform is destroyed, invoke the `destroy` method
            // for all bootstrapped applications as well.
            const destroyListener = () => envInjector.destroy();
            const onPlatformDestroyListeners = platformInjector.get(PLATFORM_DESTROY_LISTENERS);
            onPlatformDestroyListeners.add(destroyListener);
            envInjector.onDestroy(() => {
                onErrorSubscription.unsubscribe();
                onPlatformDestroyListeners.delete(destroyListener);
            });
            return _callAndReportToErrorHandler(exceptionHandler, ngZone, () => {
                const initStatus = envInjector.get(ApplicationInitStatus);
                initStatus.runInitializers();
                return initStatus.donePromise.then(() => {
                    const localeId = envInjector.get(LOCALE_ID, DEFAULT_LOCALE_ID);
                    setLocaleId(localeId || DEFAULT_LOCALE_ID);
                    const appRef = envInjector.get(ApplicationRef);
                    if (rootComponent !== undefined) {
                        appRef.bootstrap(rootComponent);
                    }
                    if (typeof ngDevMode === 'undefined' || ngDevMode) {
                        const imagePerformanceService = envInjector.get(ImagePerformanceWarning);
                        imagePerformanceService.start();
                    }
                    return appRef;
                });
            });
        });
    }
    catch (e) {
        return Promise.reject(e);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlX2FwcGxpY2F0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvYXBwbGljYXRpb24vY3JlYXRlX2FwcGxpY2F0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFDTCxrQ0FBa0MsRUFDbEMsZ0JBQWdCLEdBQ2pCLE1BQU0sbURBQW1ELENBQUM7QUFHM0QsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQzlDLE9BQU8sRUFBQyxZQUFZLEVBQW1CLE1BQU0sV0FBVyxDQUFDO0FBQ3pELE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQ3ZELE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUN6QyxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUVyRSxPQUFPLEVBQUMsNkJBQTZCLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUNuRSxPQUFPLEVBQUMsMEJBQTBCLEVBQUMsTUFBTSwwQkFBMEIsQ0FBQztBQUNwRSxPQUFPLEVBQUMsNkJBQTZCLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUNoRSxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFDM0QsT0FBTyxFQUFDLDZCQUE2QixFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFDdkUsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLGlCQUFpQixDQUFDO0FBRXZDLE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQ3pELE9BQU8sRUFBQyw0QkFBNEIsRUFBRSxjQUFjLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUMvRSxPQUFPLEVBQ0wsaUJBQWlCLEVBQ2pCLHdCQUF3QixHQUN6QixNQUFNLG9EQUFvRCxDQUFDO0FBQzVELE9BQU8sRUFB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c2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1N1YnNjcmlwdGlvbn0gZnJvbSAncnhqcyc7XG5cbmltcG9ydCB7XG4gIGludGVybmFsUHJvdmlkZVpvbmVDaGFuZ2VEZXRlY3Rpb24sXG4gIFBST1ZJREVEX05HX1pPTkUsXG59IGZyb20gJy4uL2NoYW5nZV9kZXRlY3Rpb24vc2NoZWR1bGluZy9uZ196b25lX3NjaGVkdWxpbmcnO1xuaW1wb3J0IHtFbnZpcm9ubWVudFByb3ZpZGVycywgUHJvdmlkZXIsIFN0YXRpY1Byb3ZpZGVyfSBmcm9tICcuLi9kaS9pbnRlcmZhY2UvcHJvdmlkZXInO1xuaW1wb3J0IHtFbnZpcm9ubWVudEluamVjdG9yfSBmcm9tICcuLi9kaS9yM19pbmplY3Rvcic7XG5pbXBvcnQge0Vycm9ySGFuZGxlcn0gZnJvbSAnLi4vZXJyb3JfaGFuZGxlcic7XG5pbXBvcnQge1J1bnRpbWVFcnJvciwgUnVudGltZUVycm9yQ29kZX0gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCB7REVGQVVMVF9MT0NBTEVfSUR9IGZyb20gJy4uL2kxOG4vbG9jYWxpemF0aW9uJztcbmltcG9ydCB7TE9DQUxFX0lEfSBmcm9tICcuLi9pMThuL3Rva2Vucyc7XG5pbXBvcnQge0ltYWdlUGVyZm9ybWFuY2VXYXJuaW5nfSBmcm9tICcuLi9pbWFnZV9wZXJmb3JtYW5jZV93YXJuaW5nJztcbmltcG9ydCB7VHlwZX0gZnJvbSAnLi4vaW50ZXJmYWNlL3R5cGUnO1xuaW1wb3J0IHtjcmVhdGVPclJldXNlUGxhdGZvcm1JbmplY3Rvcn0gZnJvbSAnLi4vcGxhdGZvcm0vcGxhdGZvcm0nO1xuaW1wb3J0IHtQTEFURk9STV9ERVNUUk9ZX0xJU1RFTkVSU30gZnJvbSAnLi4vcGxhdGZvcm0vcGxhdGZvcm1fcmVmJztcbmltcG9ydCB7YXNzZXJ0U3RhbmRhbG9uZUNvbXBvbmVudFR5cGV9IGZyb20gJy4uL3JlbmRlcjMvZXJyb3JzJztcbmltcG9ydCB7c2V0TG9jYWxlSWR9IGZyb20gJy4uL3JlbmRlcjMvaTE4bi9pMThuX2xvY2FsZV9pZCc7XG5pbXBvcnQge0Vudmlyb25tZW50TmdNb2R1bGVSZWZBZGFwdGVyfSBmcm9tICcuLi9yZW5kZXIzL25nX21vZHVsZV9yZWYnO1xuaW1wb3J0IHtOZ1pvbmV9IGZyb20gJy4uL3pvbmUvbmdfem9uZSc7XG5cbmltcG9ydCB7QXBwbGljYXRpb25Jbml0U3RhdHVzfSBmcm9tICcuL2FwcGxpY2F0aW9uX2luaXQnO1xuaW1wb3J0IHtfY2FsbEFuZFJlcG9ydFRvRXJyb3JIYW5kbGVyLCBBcHBsaWNhdGlvblJlZn0gZnJvbSAnLi9hcHBsaWNhdGlvbl9yZWYnO1xuaW1wb3J0IHtcbiAgUFJPVklERURfWk9ORUxFU1MsXG4gIENoYW5nZURldGVjdGlvblNjaGVkdWxlcixcbn0gZnJvbSAnLi4vY2hhbmdlX2RldGVjdGlvbi9zY2hlZHVsaW5nL3pvbmVsZXNzX3NjaGVkdWxpbmcnO1xuaW1wb3J0IHtDaGFuZ2VEZXRlY3Rpb25TY2hlZHVsZXJJbXBsfSBmcm9tICcuLi9jaGFuZ2VfZGV0ZWN0aW9uL3NjaGVkdWxpbmcvem9uZWxlc3Nfc2NoZWR1bGluZ19pbXBsJztcblxuLyoqXG4gKiBJbnRlcm5hbCBjcmVhdGUgYXBwbGljYXRpb24gQVBJIHRoYXQgaW1wbGVtZW50cyB0aGUgY29yZSBhcHBsaWNhdGlvbiBjcmVhdGlvbiBsb2dpYyBhbmQgb3B0aW9uYWxcbiAqIGJvb3RzdHJhcCBsb2dpYy5cbiAqXG4gKiBQbGF0Zm9ybXMgKHN1Y2ggYXMgYHBsYXRmb3JtLWJyb3dzZXJgKSBtYXkgcmVxdWlyZSBkaWZmZXJlbnQgc2V0IG9mIGFwcGxpY2F0aW9uIGFuZCBwbGF0Zm9ybVxuICogcHJvdmlkZXJzIGZvciBhbiBhcHBsaWNhdGlvbiB0byBmdW5jdGlvbiBjb3JyZWN0bHkuIEFzIGEgcmVzdWx0LCBwbGF0Zm9ybXMgbWF5IHVzZSB0aGlzIGZ1bmN0aW9uXG4gKiBpbnRlcm5hbGx5IGFuZCBzdXBwbHkgdGhlIG5lY2Vzc2FyeSBwcm92aWRlcnMgZHVyaW5nIHRoZSBib290c3RyYXAsIHdoaWxlIGV4cG9zaW5nXG4gKiBwbGF0Zm9ybS1zcGVjaWZpYyBBUElzIGFzIGEgcGFydCBvZiB0aGVpciBwdWJsaWMgQVBJLlxuICpcbiAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJldHVybnMgYW4gYEFwcGxpY2F0aW9uUmVmYCBpbnN0YW5jZSBvbmNlIHJlc29sdmVkLlxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBpbnRlcm5hbENyZWF0ZUFwcGxpY2F0aW9uKGNvbmZpZzoge1xuICByb290Q29tcG9uZW50PzogVHlwZTx1bmtub3duPjtcbiAgYXBwUHJvdmlkZXJzPzogQXJyYXk8UHJvdmlkZXIgfCBFbnZpcm9ubWVudFByb3ZpZGVycz47XG4gIHBsYXRmb3JtUHJvdmlkZXJzPzogUHJvdmlkZXJbXTtcbn0pOiBQcm9taXNlPEFwcGxpY2F0aW9uUmVmPiB7XG4gIHRyeSB7XG4gICAgY29uc3Qge3Jvb3RDb21wb25lbnQsIGFwcFByb3ZpZGVycywgcGxhdGZvcm1Qcm92aWRlcnN9ID0gY29uZmlnO1xuXG4gICAgaWYgKCh0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCBuZ0Rldk1vZGUpICYmIHJvb3RDb21wb25lbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgYXNzZXJ0U3RhbmRhbG9uZUNvbXBvbmVudFR5cGUocm9vdENvbXBvbmVudCk7XG4gICAgfVxuXG4gICAgY29uc3QgcGxhdGZvcm1JbmplY3RvciA9IGNyZWF0ZU9yUmV1c2VQbGF0Zm9ybUluamVjdG9yKHBsYXRmb3JtUHJvdmlkZXJzIGFzIFN0YXRpY1Byb3ZpZGVyW10pO1xuXG4gICAgLy8gQ3JlYXRlIHJvb3QgYXBwbGljYXRpb24gaW5qZWN0b3IgYmFzZWQgb24gYSBzZXQgb2YgcHJvdmlkZXJzIGNvbmZpZ3VyZWQgYXQgdGhlIHBsYXRmb3JtXG4gICAgLy8gYm9vdHN0cmFwIGxldmVsIGFzIHdlbGwgYXMgcHJvdmlkZXJzIHBhc3NlZCB0byB0aGUgYm9vdHN0cmFwIGNhbGwgYnkgYSB1c2VyLlxuICAgIGNvbnN0IGFsbEFwcFByb3ZpZGVycyA9IFtcbiAgICAgIGludGVybmFsUHJvdmlkZVpvbmVDaGFuZ2VEZXRlY3Rpb24oe30pLFxuICAgICAge3Byb3ZpZGU6IENoYW5nZURldGVjdGlvblNjaGVkdWxlciwgdXNlRXhpc3Rpbmc6IENoYW5nZURldGVjdGlvblNjaGVkdWxlckltcGx9LFxuICAgICAgLi4uKGFwcFByb3ZpZGVycyB8fCBbXSksXG4gICAgXTtcbiAgICBjb25zdCBhZGFwdGVyID0gbmV3IEVudmlyb25tZW50TmdNb2R1bGVSZWZBZGFwdGVyKHtcbiAgICAgIHByb3ZpZGVyczogYWxsQXBwUHJvdmlkZXJzLFxuICAgICAgcGFyZW50OiBwbGF0Zm9ybUluamVjdG9yIGFzIEVudmlyb25tZW50SW5qZWN0b3IsXG4gICAgICBkZWJ1Z05hbWU6IHR5cGVvZiBuZ0Rldk1vZGUgPT09ICd1bmRlZmluZWQnIHx8IG5nRGV2TW9kZSA/ICdFbnZpcm9ubWVudCBJbmplY3RvcicgOiAnJyxcbiAgICAgIC8vIFdlIHNraXAgZW52aXJvbm1lbnQgaW5pdGlhbGl6ZXJzIGJlY2F1c2Ugd2UgbmVlZCB0byBydW4gdGhlbSBpbnNpZGUgdGhlIE5nWm9uZSwgd2hpY2hcbiAgICAgIC8vIGhhcHBlbnMgYWZ0ZXIgd2UgZ2V0IHRoZSBOZ1pvbmUgaW5zdGFuY2UgZnJvbSB0aGUgSW5qZWN0b3IuXG4gICAgICBydW5FbnZpcm9ubWVudEluaXRpYWxpemVyczogZmFsc2UsXG4gICAgfSk7XG4gICAgY29uc3QgZW52SW5qZWN0b3IgPSBhZGFwdGVyLmluamVjdG9yO1xuICAgIGNvbnN0IG5nWm9uZSA9IGVudkluamVjdG9yLmdldChOZ1pvbmUpO1xuXG4gICAgcmV0dXJuIG5nWm9uZS5ydW4oKCkgPT4ge1xuICAgICAgZW52SW5qZWN0b3IucmVzb2x2ZUluamVjdG9ySW5pdGlhbGl6ZXJzKCk7XG4gICAgICBjb25zdCBleGNlcHRpb25IYW5kbGVyOiBFcnJvckhhbmRsZXIgfCBudWxsID0gZW52SW5qZWN0b3IuZ2V0KEVycm9ySGFuZGxlciwgbnVsbCk7XG4gICAgICBpZiAodHlwZW9mIG5nRGV2TW9kZSA9PT0gJ3VuZGVmaW5lZCcgfHwgbmdEZXZNb2RlKSB7XG4gICAgICAgIGlmICghZXhjZXB0aW9uSGFuZGxlcikge1xuICAgICAgICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgICAgICBSdW50aW1lRXJyb3JDb2RlLk1JU1NJTkdfUkVRVUlSRURfSU5KRUNUQUJMRV9JTl9CT09UU1RSQVAsXG4gICAgICAgICAgICAnTm8gYEVycm9ySGFuZGxlcmAgZm91bmQgaW4gdGhlIERlcGVuZGVuY3kgSW5qZWN0aW9uIHRyZWUuJyxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChlbnZJbmplY3Rvci5nZXQoUFJPVklERURfWk9ORUxFU1MpICYmIGVudkluamVjdG9yLmdldChQUk9WSURFRF9OR19aT05FKSkge1xuICAgICAgICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgICAgICBSdW50aW1lRXJyb3JDb2RlLlBST1ZJREVEX0JPVEhfWk9ORV9BTkRfWk9ORUxFU1MsXG4gICAgICAgICAgICAnSW52YWxpZCBjaGFuZ2UgZGV0ZWN0aW9uIGNvbmZpZ3VyYXRpb246ICcgK1xuICAgICAgICAgICAgICAncHJvdmlkZVpvbmVDaGFuZ2VEZXRlY3Rpb24gYW5kIHByb3ZpZGVFeHBlcmltZW50YWxab25lbGVzc0NoYW5nZURldGVjdGlvbiBjYW5ub3QgYmUgdXNlZCB0b2dldGhlci4nLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbGV0IG9uRXJyb3JTdWJzY3JpcHRpb246IFN1YnNjcmlwdGlvbjtcbiAgICAgIG5nWm9uZS5ydW5PdXRzaWRlQW5ndWxhcigoKSA9PiB7XG4gICAgICAgIG9uRXJyb3JTdWJzY3JpcHRpb24gPSBuZ1pvbmUub25FcnJvci5zdWJzY3JpYmUoe1xuICAgICAgICAgIG5leHQ6IChlcnJvcjogYW55KSA9PiB7XG4gICAgICAgICAgICBleGNlcHRpb25IYW5kbGVyIS5oYW5kbGVFcnJvcihlcnJvcik7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgLy8gSWYgdGhlIHdob2xlIHBsYXRmb3JtIGlzIGRlc3Ryb3llZCwgaW52b2tlIHRoZSBgZGVzdHJveWAgbWV0aG9kXG4gICAgICAvLyBmb3IgYWxsIGJvb3RzdHJhcHBlZCBhcHBsaWNhdGlvbnMgYXMgd2VsbC5cbiAgICAgIGNvbnN0IGRlc3Ryb3lMaXN0ZW5lciA9ICgpID0+IGVudkluamVjdG9yLmRlc3Ryb3koKTtcbiAgICAgIGNvbnN0IG9uUGxhdGZvcm1EZXN0cm95TGlzdGVuZXJzID0gcGxhdGZvcm1JbmplY3Rvci5nZXQoUExBVEZPUk1fREVTVFJPWV9MSVNURU5FUlMpO1xuICAgICAgb25QbGF0Zm9ybURlc3Ryb3lMaXN0ZW5lcnMuYWRkKGRlc3Ryb3lMaXN0ZW5lcik7XG5cbiAgICAgIGVudkluamVjdG9yLm9uRGVzdHJveSgoKSA9PiB7XG4gICAgICAgIG9uRXJyb3JTdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTtcbiAgICAgICAgb25QbGF0Zm9ybURlc3Ryb3lMaXN0ZW5lcnMuZGVsZXRlKGRlc3Ryb3lMaXN0ZW5lcik7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIF9jYWxsQW5kUmVwb3J0VG9FcnJvckhhbmRsZXIoZXhjZXB0aW9uSGFuZGxlciEsIG5nWm9uZSwgKCkgPT4ge1xuICAgICAgICBjb25zdCBpbml0U3RhdHVzID0gZW52SW5qZWN0b3IuZ2V0KEFwcGxpY2F0aW9uSW5pdFN0YXR1cyk7XG4gICAgICAgIGluaXRTdGF0dXMucnVuSW5pdGlhbGl6ZXJzKCk7XG5cbiAgICAgICAgcmV0dXJuIGluaXRTdGF0dXMuZG9uZVByb21pc2UudGhlbigoKSA9PiB7XG4gICAgICAgICAgY29uc3QgbG9jYWxlSWQgPSBlbnZJbmplY3Rvci5nZXQoTE9DQUxFX0lELCBERUZBVUxUX0xPQ0FMRV9JRCk7XG4gICAgICAgICAgc2V0TG9jYWxlSWQobG9jYWxlSWQgfHwgREVGQVVMVF9MT0NBTEVfSUQpO1xuXG4gICAgICAgICAgY29uc3QgYXBwUmVmID0gZW52SW5qZWN0b3IuZ2V0KEFwcGxpY2F0aW9uUmVmKTtcbiAgICAgICAgICBpZiAocm9vdENvbXBvbmVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBhcHBSZWYuYm9vdHN0cmFwKHJvb3RDb21wb25lbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodHlwZW9mIG5nRGV2TW9kZSA9PT0gJ3VuZGVmaW5lZCcgfHwgbmdEZXZNb2RlKSB7XG4gICAgICAgICAgICBjb25zdCBpbWFnZVBlcmZvcm1hbmNlU2VydmljZSA9IGVudkluamVjdG9yLmdldChJbWFnZVBlcmZvcm1hbmNlV2FybmluZyk7XG4gICAgICAgICAgICBpbWFnZVBlcmZvcm1hbmNlU2VydmljZS5zdGFydCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gYXBwUmVmO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGUpO1xuICB9XG59XG4iXX0=