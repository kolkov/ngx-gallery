/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Subscription } from 'rxjs';
import { ApplicationRef } from '../../application/application_ref';
import { ENVIRONMENT_INITIALIZER, inject, Injectable, InjectionToken, makeEnvironmentProviders, } from '../../di';
import { ErrorHandler, INTERNAL_APPLICATION_ERROR_HANDLER } from '../../error_handler';
import { RuntimeError } from '../../errors';
import { PendingTasks } from '../../pending_tasks';
import { performanceMarkFeature } from '../../util/performance';
import { NgZone } from '../../zone';
import { ChangeDetectionScheduler, ZONELESS_SCHEDULER_DISABLED, ZONELESS_ENABLED, } from './zoneless_scheduling';
import * as i0 from "../../r3_symbols";
export class NgZoneChangeDetectionScheduler {
    constructor() {
        this.zone = inject(NgZone);
        this.changeDetectionScheduler = inject(ChangeDetectionScheduler);
        this.applicationRef = inject(ApplicationRef);
    }
    initialize() {
        if (this._onMicrotaskEmptySubscription) {
            return;
        }
        this._onMicrotaskEmptySubscription = this.zone.onMicrotaskEmpty.subscribe({
            next: () => {
                // `onMicroTaskEmpty` can happen _during_ the zoneless scheduler change detection because
                // zone.run(() => {}) will result in `checkStable` at the end of the `zone.run` closure
                // and emit `onMicrotaskEmpty` synchronously if run coalsecing is false.
                if (this.changeDetectionScheduler.runningTick) {
                    return;
                }
                this.zone.run(() => {
                    this.applicationRef.tick();
                });
            },
        });
    }
    ngOnDestroy() {
        this._onMicrotaskEmptySubscription?.unsubscribe();
    }
    static { this.ɵfac = function NgZoneChangeDetectionScheduler_Factory(t) { return new (t || NgZoneChangeDetectionScheduler)(); }; }
    static { this.ɵprov = /*@__PURE__*/ i0.ɵɵdefineInjectable({ token: NgZoneChangeDetectionScheduler, factory: NgZoneChangeDetectionScheduler.ɵfac, providedIn: 'root' }); }
}
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.setClassMetadata(NgZoneChangeDetectionScheduler, [{
        type: Injectable,
        args: [{ providedIn: 'root' }]
    }], null, null); })();
/**
 * Internal token used to verify that `provideZoneChangeDetection` is not used
 * with the bootstrapModule API.
 */
export const PROVIDED_NG_ZONE = new InjectionToken(typeof ngDevMode === 'undefined' || ngDevMode ? 'provideZoneChangeDetection token' : '', { factory: () => false });
export function internalProvideZoneChangeDetection({ ngZoneFactory, ignoreChangesOutsideZone, }) {
    ngZoneFactory ??= () => new NgZone(getNgZoneOptions());
    return [
        { provide: NgZone, useFactory: ngZoneFactory },
        {
            provide: ENVIRONMENT_INITIALIZER,
            multi: true,
            useFactory: () => {
                const ngZoneChangeDetectionScheduler = inject(NgZoneChangeDetectionScheduler, {
                    optional: true,
                });
                if ((typeof ngDevMode === 'undefined' || ngDevMode) &&
                    ngZoneChangeDetectionScheduler === null) {
                    throw new RuntimeError(402 /* RuntimeErrorCode.MISSING_REQUIRED_INJECTABLE_IN_BOOTSTRAP */, `A required Injectable was not found in the dependency injection tree. ` +
                        'If you are bootstrapping an NgModule, make sure that the `BrowserModule` is imported.');
                }
                return () => ngZoneChangeDetectionScheduler.initialize();
            },
        },
        {
            provide: ENVIRONMENT_INITIALIZER,
            multi: true,
            useFactory: () => {
                const service = inject(ZoneStablePendingTask);
                return () => {
                    service.initialize();
                };
            },
        },
        { provide: INTERNAL_APPLICATION_ERROR_HANDLER, useFactory: ngZoneApplicationErrorHandlerFactory },
        // Always disable scheduler whenever explicitly disabled, even if another place called
        // `provideZoneChangeDetection` without the 'ignore' option.
        ignoreChangesOutsideZone === true ? { provide: ZONELESS_SCHEDULER_DISABLED, useValue: true } : [],
    ];
}
export function ngZoneApplicationErrorHandlerFactory() {
    const zone = inject(NgZone);
    const userErrorHandler = inject(ErrorHandler);
    return (e) => zone.runOutsideAngular(() => userErrorHandler.handleError(e));
}
/**
 * Provides `NgZone`-based change detection for the application bootstrapped using
 * `bootstrapApplication`.
 *
 * `NgZone` is already provided in applications by default. This provider allows you to configure
 * options like `eventCoalescing` in the `NgZone`.
 * This provider is not available for `platformBrowser().bootstrapModule`, which uses
 * `BootstrapOptions` instead.
 *
 * @usageNotes
 * ```typescript
 * bootstrapApplication(MyApp, {providers: [
 *   provideZoneChangeDetection({eventCoalescing: true}),
 * ]});
 * ```
 *
 * @publicApi
 * @see {@link bootstrapApplication}
 * @see {@link NgZoneOptions}
 */
export function provideZoneChangeDetection(options) {
    const ignoreChangesOutsideZone = options?.ignoreChangesOutsideZone;
    const zoneProviders = internalProvideZoneChangeDetection({
        ngZoneFactory: () => {
            const ngZoneOptions = getNgZoneOptions(options);
            if (ngZoneOptions.shouldCoalesceEventChangeDetection) {
                performanceMarkFeature('NgZone_CoalesceEvent');
            }
            return new NgZone(ngZoneOptions);
        },
        ignoreChangesOutsideZone,
    });
    return makeEnvironmentProviders([
        { provide: PROVIDED_NG_ZONE, useValue: true },
        { provide: ZONELESS_ENABLED, useValue: false },
        zoneProviders,
    ]);
}
// Transforms a set of `BootstrapOptions` (supported by the NgModule-based bootstrap APIs) ->
// `NgZoneOptions` that are recognized by the NgZone constructor. Passing no options will result in
// a set of default options returned.
export function getNgZoneOptions(options) {
    return {
        enableLongStackTrace: typeof ngDevMode === 'undefined' ? false : !!ngDevMode,
        shouldCoalesceEventChangeDetection: options?.eventCoalescing ?? false,
        shouldCoalesceRunChangeDetection: options?.runCoalescing ?? false,
    };
}
export class ZoneStablePendingTask {
    constructor() {
        this.subscription = new Subscription();
        this.initialized = false;
        this.zone = inject(NgZone);
        this.pendingTasks = inject(PendingTasks);
    }
    initialize() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        let task = null;
        if (!this.zone.isStable && !this.zone.hasPendingMacrotasks && !this.zone.hasPendingMicrotasks) {
            task = this.pendingTasks.add();
        }
        this.zone.runOutsideAngular(() => {
            this.subscription.add(this.zone.onStable.subscribe(() => {
                NgZone.assertNotInAngularZone();
                // Check whether there are no pending macro/micro tasks in the next tick
                // to allow for NgZone to update the state.
                queueMicrotask(() => {
                    if (task !== null &&
                        !this.zone.hasPendingMacrotasks &&
                        !this.zone.hasPendingMicrotasks) {
                        this.pendingTasks.remove(task);
                        task = null;
                    }
                });
            }));
        });
        this.subscription.add(this.zone.onUnstable.subscribe(() => {
            NgZone.assertInAngularZone();
            task ??= this.pendingTasks.add();
        }));
    }
    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
    static { this.ɵfac = function ZoneStablePendingTask_Factory(t) { return new (t || ZoneStablePendingTask)(); }; }
    static { this.ɵprov = /*@__PURE__*/ i0.ɵɵdefineInjectable({ token: ZoneStablePendingTask, factory: ZoneStablePendingTask.ɵfac, providedIn: 'root' }); }
}
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.setClassMetadata(ZoneStablePendingTask, [{
        type: Injectable,
        args: [{ providedIn: 'root' }]
    }], null, null); })();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdfem9uZV9zY2hlZHVsaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvY2hhbmdlX2RldGVjdGlvbi9zY2hlZHVsaW5nL25nX3pvbmVfc2NoZWR1bGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sTUFBTSxDQUFDO0FBRWxDLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxtQ0FBbUMsQ0FBQztBQUNqRSxPQUFPLEVBQ0wsdUJBQXVCLEVBRXZCLE1BQU0sRUFDTixVQUFVLEVBQ1YsY0FBYyxFQUNkLHdCQUF3QixHQUV6QixNQUFNLFVBQVUsQ0FBQztBQUNsQixPQUFPLEVBQUMsWUFBWSxFQUFFLGtDQUFrQyxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDckYsT0FBTyxFQUFDLFlBQVksRUFBbUIsTUFBTSxjQUFjLENBQUM7QUFDNUQsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ2pELE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzlELE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFHbEMsT0FBTyxFQUNMLHdCQUF3QixFQUN4QiwyQkFBMkIsRUFDM0IsZ0JBQWdCLEdBQ2pCLE1BQU0sdUJBQXVCLENBQUM7O0FBRy9CLE1BQU0sT0FBTyw4QkFBOEI7SUFEM0M7UUFFbUIsU0FBSSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN0Qiw2QkFBd0IsR0FBRyxNQUFNLENBQUMsd0JBQXdCLENBQUMsQ0FBQztRQUM1RCxtQkFBYyxHQUFHLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQztLQTJCMUQ7SUF2QkMsVUFBVTtRQUNSLElBQUksSUFBSSxDQUFDLDZCQUE2QixFQUFFLENBQUM7WUFDdkMsT0FBTztRQUNU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QUFDO3dCQUNELElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO3dCQUMvQixJQUFJLEdBQUcsSUFBSSxDQUFDO29CQUNkLENBQUM7Z0JBQ0gsQ0FBQyxDQUFDLENBQUM7WUFDTCxDQUFDLENBQUMsQ0FDSCxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FDbkIsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRTtZQUNsQyxNQUFNLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztZQUM3QixJQUFJLEtBQUssSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNuQyxDQUFDLENBQUMsQ0FDSCxDQUFDO0lBQ0osQ0FBQztJQUVELFdBQVc7UUFDVCxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ2xDLENBQUM7c0ZBaERVLHFCQUFxQjt1RUFBckIscUJBQXFCLFdBQXJCLHFCQUFxQixtQkFEVCxNQUFNOztnRkFDbEIscUJBQXFCO2NBRGpDLFVBQVU7ZUFBQyxFQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTdWJzY3JpcHRpb259IGZyb20gJ3J4anMnO1xuXG5pbXBvcnQge0FwcGxpY2F0aW9uUmVmfSBmcm9tICcuLi8uLi9hcHBsaWNhdGlvbi9hcHBsaWNhdGlvbl9yZWYnO1xuaW1wb3J0IHtcbiAgRU5WSVJPTk1FTlRfSU5JVElBTElaRVIsXG4gIEVudmlyb25tZW50UHJvdmlkZXJzLFxuICBpbmplY3QsXG4gIEluamVjdGFibGUsXG4gIEluamVjdGlvblRva2VuLFxuICBtYWtlRW52aXJvbm1lbnRQcm92aWRlcnMsXG4gIFN0YXRpY1Byb3ZpZGVyLFxufSBmcm9tICcuLi8uLi9kaSc7XG5pbXBvcnQge0Vycm9ySGFuZGxlciwgSU5URVJOQUxfQVBQTElDQVRJT05fRVJST1JfSEFORExFUn0gZnJvbSAnLi4vLi4vZXJyb3JfaGFuZGxlcic7XG5pbXBvcnQge1J1bnRpbWVFcnJvciwgUnVudGltZUVycm9yQ29kZX0gZnJvbSAnLi4vLi4vZXJyb3JzJztcbmltcG9ydCB7UGVuZGluZ1Rhc2tzfSBmcm9tICcuLi8uLi9wZW5kaW5nX3Rhc2tzJztcbmltcG9ydCB7cGVyZm9ybWFuY2VNYXJrRmVhdHVyZX0gZnJvbSAnLi4vLi4vdXRpbC9wZXJmb3JtYW5jZSc7XG5pbXBvcnQge05nWm9uZX0gZnJvbSAnLi4vLi4vem9uZSc7XG5pbXBvcnQge0ludGVybmFsTmdab25lT3B0aW9uc30gZnJvbSAnLi4vLi4vem9uZS9uZ196b25lJztcblxuaW1wb3J0IHtcbiAgQ2hhbmdlRGV0ZWN0aW9uU2NoZWR1bGVyLFxuICBaT05FTEVTU19TQ0hFRFVMRVJfRElTQUJMRUQsXG4gIFpPTkVMRVNTX0VOQUJMRUQsXG59IGZyb20gJy4vem9uZWxlc3Nfc2NoZWR1bGluZyc7XG5cbkBJbmplY3RhYmxlKHtwcm92aWRlZEluOiAncm9vdCd9KVxuZXhwb3J0IGNsYXNzIE5nWm9uZUNoYW5nZURldGVjdGlvblNjaGVkdWxlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgem9uZSA9IGluamVjdChOZ1pvbmUpO1xuICBwcml2YXRlIHJlYWRvbmx5IGNoYW5nZURldGVjdGlvblNjaGVkdWxlciA9IGluamVjdChDaGFuZ2VEZXRlY3Rpb25TY2hlZHVsZXIpO1xuICBwcml2YXRlIHJlYWRvbmx5IGFwcGxpY2F0aW9uUmVmID0gaW5qZWN0KEFwcGxpY2F0aW9uUmVmKTtcblxuICBwcml2YXRlIF9vbk1pY3JvdGFza0VtcHR5U3Vic2NyaXB0aW9uPzogU3Vic2NyaXB0aW9uO1xuXG4gIGluaXRpYWxpemUoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX29uTWljcm90YXNrRW1wdHlTdWJzY3JpcHRpb24pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLl9vbk1pY3JvdGFza0VtcHR5U3Vic2NyaXB0aW9uID0gdGhpcy56b25lLm9uTWljcm90YXNrRW1wdHkuc3Vic2NyaWJlKHtcbiAgICAgIG5leHQ6ICgpID0+IHtcbiAgICAgICAgLy8gYG9uTWljcm9UYXNrRW1wdHlgIGNhbiBoYXBwZW4gX2R1cmluZ18gdGhlIHpvbmVsZXNzIHNjaGVkdWxlciBjaGFuZ2UgZGV0ZWN0aW9uIGJlY2F1c2VcbiAgICAgICAgLy8gem9uZS5ydW4oKCkgPT4ge30pIHdpbGwgcmVzdWx0IGluIGBjaGVja1N0YWJsZWAgYXQgdGhlIGVuZCBvZiB0aGUgYHpvbmUucnVuYCBjbG9zdXJlXG4gICAgICAgIC8vIGFuZCBlbWl0IGBvbk1pY3JvdGFza0VtcHR5YCBzeW5jaHJvbm91c2x5IGlmIHJ1biBjb2Fsc2VjaW5nIGlzIGZhbHNlLlxuICAgICAgICBpZiAodGhpcy5jaGFuZ2VEZXRlY3Rpb25TY2hlZHVsZXIucnVubmluZ1RpY2spIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy56b25lLnJ1bigoKSA9PiB7XG4gICAgICAgICAgdGhpcy5hcHBsaWNhdGlvblJlZi50aWNrKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIG5nT25EZXN0cm95KCkge1xuICAgIHRoaXMuX29uTWljcm90YXNrRW1wdHlTdWJzY3JpcHRpb24/LnVuc3Vic2NyaWJlKCk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbnRlcm5hbCB0b2tlbiB1c2VkIHRvIHZlcmlmeSB0aGF0IGBwcm92aWRlWm9uZUNoYW5nZURldGVjdGlvbmAgaXMgbm90IHVzZWRcbiAqIHdpdGggdGhlIGJvb3RzdHJhcE1vZHVsZSBBUEkuXG4gKi9cbmV4cG9ydCBjb25zdCBQUk9WSURFRF9OR19aT05FID0gbmV3IEluamVjdGlvblRva2VuPGJvb2xlYW4+KFxuICB0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCBuZ0Rldk1vZGUgPyAncHJvdmlkZVpvbmVDaGFuZ2VEZXRlY3Rpb24gdG9rZW4nIDogJycsXG4gIHtmYWN0b3J5OiAoKSA9PiBmYWxzZX0sXG4pO1xuXG5leHBvcnQgZnVuY3Rpb24gaW50ZXJuYWxQcm92aWRlWm9uZUNoYW5nZURldGVjdGlvbih7XG4gIG5nWm9uZUZhY3RvcnksXG4gIGlnbm9yZUNoYW5nZXNPdXRzaWRlWm9uZSxcbn06IHtcbiAgbmdab25lRmFjdG9yeT86ICgpID0+IE5nWm9uZTtcbiAgaWdub3JlQ2hhbmdlc091dHNpZGVab25lPzogYm9vbGVhbjtcbn0pOiBTdGF0aWNQcm92aWRlcltdIHtcbiAgbmdab25lRmFjdG9yeSA/Pz0gKCkgPT4gbmV3IE5nWm9uZShnZXROZ1pvbmVPcHRpb25zKCkpO1xuICByZXR1cm4gW1xuICAgIHtwcm92aWRlOiBOZ1pvbmUsIHVzZUZhY3Rvcnk6IG5nWm9uZUZhY3Rvcnl9LFxuICAgIHtcbiAgICAgIHByb3ZpZGU6IEVOVklST05NRU5UX0lOSVRJQUxJWkVSLFxuICAgICAgbXVsdGk6IHRydWUsXG4gICAgICB1c2VGYWN0b3J5OiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5nWm9uZUNoYW5nZURldGVjdGlvblNjaGVkdWxlciA9IGluamVjdChOZ1pvbmVDaGFuZ2VEZXRlY3Rpb25TY2hlZHVsZXIsIHtcbiAgICAgICAgICBvcHRpb25hbDogdHJ1ZSxcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAodHlwZW9mIG5nRGV2TW9kZSA9PT0gJ3VuZGVmaW5lZCcgfHwgbmdEZXZNb2RlKSAmJlxuICAgICAgICAgIG5nWm9uZUNoYW5nZURldGVjdGlvblNjaGVkdWxlciA9PT0gbnVsbFxuICAgICAgICApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFxuICAgICAgICAgICAgUnVudGltZUVycm9yQ29kZS5NSVNTSU5HX1JFUVVJUkVEX0lOSkVDVEFCTEVfSU5fQk9PVFNUUkFQLFxuICAgICAgICAgICAgYEEgcmVxdWlyZWQgSW5qZWN0YWJsZSB3YXMgbm90IGZvdW5kIGluIHRoZSBkZXBlbmRlbmN5IGluamVjdGlvbiB0cmVlLiBgICtcbiAgICAgICAgICAgICAgJ0lmIHlvdSBhcmUgYm9vdHN0cmFwcGluZyBhbiBOZ01vZHVsZSwgbWFrZSBzdXJlIHRoYXQgdGhlIGBCcm93c2VyTW9kdWxlYCBpcyBpbXBvcnRlZC4nLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICgpID0+IG5nWm9uZUNoYW5nZURldGVjdGlvblNjaGVkdWxlciEuaW5pdGlhbGl6ZSgpO1xuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIHByb3ZpZGU6IEVOVklST05NRU5UX0lOSVRJQUxJWkVSLFxuICAgICAgbXVsdGk6IHRydWUsXG4gICAgICB1c2VGYWN0b3J5OiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHNlcnZpY2UgPSBpbmplY3QoWm9uZVN0YWJsZVBlbmRpbmdUYXNrKTtcbiAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICBzZXJ2aWNlLmluaXRpYWxpemUoKTtcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7cHJvdmlkZTogSU5URVJOQUxfQVBQTElDQVRJT05fRVJST1JfSEFORExFUiwgdXNlRmFjdG9yeTogbmdab25lQXBwbGljYXRpb25FcnJvckhhbmRsZXJGYWN0b3J5fSxcbiAgICAvLyBBbHdheXMgZGlzYWJsZSBzY2hlZHVsZXIgd2hlbmV2ZXIgZXhwbGljaXRseSBkaXNhYmxlZCwgZXZlbiBpZiBhbm90aGVyIHBsYWNlIGNhbGxlZFxuICAgIC8vIGBwcm92aWRlWm9uZUNoYW5nZURldGVjdGlvbmAgd2l0aG91dCB0aGUgJ2lnbm9yZScgb3B0aW9uLlxuICAgIGlnbm9yZUNoYW5nZXNPdXRzaWRlWm9uZSA9PT0gdHJ1ZSA/IHtwcm92aWRlOiBaT05FTEVTU19TQ0hFRFVMRVJfRElTQUJMRUQsIHVzZVZhbHVlOiB0cnVlfSA6IFtdLFxuICBdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmdab25lQXBwbGljYXRpb25FcnJvckhhbmRsZXJGYWN0b3J5KCkge1xuICBjb25zdCB6b25lID0gaW5qZWN0KE5nWm9uZSk7XG4gIGNvbnN0IHVzZXJFcnJvckhhbmRsZXIgPSBpbmplY3QoRXJyb3JIYW5kbGVyKTtcbiAgcmV0dXJuIChlOiB1bmtub3duKSA9PiB6b25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+IHVzZXJFcnJvckhhbmRsZXIuaGFuZGxlRXJyb3IoZSkpO1xufVxuXG4vKipcbiAqIFByb3ZpZGVzIGBOZ1pvbmVgLWJhc2VkIGNoYW5nZSBkZXRlY3Rpb24gZm9yIHRoZSBhcHBsaWNhdGlvbiBib290c3RyYXBwZWQgdXNpbmdcbiAqIGBib290c3RyYXBBcHBsaWNhdGlvbmAuXG4gKlxuICogYE5nWm9uZWAgaXMgYWxyZWFkeSBwcm92aWRlZCBpbiBhcHBsaWNhdGlvbnMgYnkgZGVmYXVsdC4gVGhpcyBwcm92aWRlciBhbGxvd3MgeW91IHRvIGNvbmZpZ3VyZVxuICogb3B0aW9ucyBsaWtlIGBldmVudENvYWxlc2NpbmdgIGluIHRoZSBgTmdab25lYC5cbiAqIFRoaXMgcHJvdmlkZXIgaXMgbm90IGF2YWlsYWJsZSBmb3IgYHBsYXRmb3JtQnJvd3NlcigpLmJvb3RzdHJhcE1vZHVsZWAsIHdoaWNoIHVzZXNcbiAqIGBCb290c3RyYXBPcHRpb25zYCBpbnN0ZWFkLlxuICpcbiAqIEB1c2FnZU5vdGVzXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBib290c3RyYXBBcHBsaWNhdGlvbihNeUFwcCwge3Byb3ZpZGVyczogW1xuICogICBwcm92aWRlWm9uZUNoYW5nZURldGVjdGlvbih7ZXZlbnRDb2FsZXNjaW5nOiB0cnVlfSksXG4gKiBdfSk7XG4gKiBgYGBcbiAqXG4gKiBAcHVibGljQXBpXG4gKiBAc2VlIHtAbGluayBib290c3RyYXBBcHBsaWNhdGlvbn1cbiAqIEBzZWUge0BsaW5rIE5nWm9uZU9wdGlvbnN9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcm92aWRlWm9uZUNoYW5nZURldGVjdGlvbihvcHRpb25zPzogTmdab25lT3B0aW9ucyk6IEVudmlyb25tZW50UHJvdmlkZXJzIHtcbiAgY29uc3QgaWdub3JlQ2hhbmdlc091dHNpZGVab25lID0gb3B0aW9ucz8uaWdub3JlQ2hhbmdlc091dHNpZGVab25lO1xuICBjb25zdCB6b25lUHJvdmlkZXJzID0gaW50ZXJuYWxQcm92aWRlWm9uZUNoYW5nZURldGVjdGlvbih7XG4gICAgbmdab25lRmFjdG9yeTogKCkgPT4ge1xuICAgICAgY29uc3Qgbmdab25lT3B0aW9ucyA9IGdldE5nWm9uZU9wdGlvbnMob3B0aW9ucyk7XG4gICAgICBpZiAobmdab25lT3B0aW9ucy5zaG91bGRDb2FsZXNjZUV2ZW50Q2hhbmdlRGV0ZWN0aW9uKSB7XG4gICAgICAgIHBlcmZvcm1hbmNlTWFya0ZlYXR1cmUoJ05nWm9uZV9Db2FsZXNjZUV2ZW50Jyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IE5nWm9uZShuZ1pvbmVPcHRpb25zKTtcbiAgICB9LFxuICAgIGlnbm9yZUNoYW5nZXNPdXRzaWRlWm9uZSxcbiAgfSk7XG4gIHJldHVybiBtYWtlRW52aXJvbm1lbnRQcm92aWRlcnMoW1xuICAgIHtwcm92aWRlOiBQUk9WSURFRF9OR19aT05FLCB1c2VWYWx1ZTogdHJ1ZX0sXG4gICAge3Byb3ZpZGU6IFpPTkVMRVNTX0VOQUJMRUQsIHVzZVZhbHVlOiBmYWxzZX0sXG4gICAgem9uZVByb3ZpZGVycyxcbiAgXSk7XG59XG5cbi8qKlxuICogVXNlZCB0byBjb25maWd1cmUgZXZlbnQgYW5kIHJ1biBjb2FsZXNjaW5nIHdpdGggYHByb3ZpZGVab25lQ2hhbmdlRGV0ZWN0aW9uYC5cbiAqXG4gKiBAcHVibGljQXBpXG4gKlxuICogQHNlZSB7QGxpbmsgcHJvdmlkZVpvbmVDaGFuZ2VEZXRlY3Rpb259XG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTmdab25lT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBPcHRpb25hbGx5IHNwZWNpZnkgY29hbGVzY2luZyBldmVudCBjaGFuZ2UgZGV0ZWN0aW9ucyBvciBub3QuXG4gICAqIENvbnNpZGVyIHRoZSBmb2xsb3dpbmcgY2FzZS5cbiAgICpcbiAgICogYGBgXG4gICAqIDxkaXYgKGNsaWNrKT1cImRvU29tZXRoaW5nKClcIj5cbiAgICogICA8YnV0dG9uIChjbGljayk9XCJkb1NvbWV0aGluZ0Vsc2UoKVwiPjwvYnV0dG9uPlxuICAgKiA8L2Rpdj5cbiAgICogYGBgXG4gICAqXG4gICAqIFdoZW4gYnV0dG9uIGlzIGNsaWNrZWQsIGJlY2F1c2Ugb2YgdGhlIGV2ZW50IGJ1YmJsaW5nLCBib3RoXG4gICAqIGV2ZW50IGhhbmRsZXJzIHdpbGwgYmUgY2FsbGVkIGFuZCAyIGNoYW5nZSBkZXRlY3Rpb25zIHdpbGwgYmVcbiAgICogdHJpZ2dlcmVkLiBXZSBjYW4gY29hbGVzY2Ugc3VjaCBraW5kIG9mIGV2ZW50cyB0byBvbmx5IHRyaWdnZXJcbiAgICogY2hhbmdlIGRldGVjdGlvbiBvbmx5IG9uY2UuXG4gICAqXG4gICAqIEJ5IGRlZmF1bHQsIHRoaXMgb3B0aW9uIHdpbGwgYmUgZmFsc2UuIFNvIHRoZSBldmVudHMgd2lsbCBub3QgYmVcbiAgICogY29hbGVzY2VkIGFuZCB0aGUgY2hhbmdlIGRldGVjdGlvbiB3aWxsIGJlIHRyaWdnZXJlZCBtdWx0aXBsZSB0aW1lcy5cbiAgICogQW5kIGlmIHRoaXMgb3B0aW9uIGJlIHNldCB0byB0cnVlLCB0aGUgY2hhbmdlIGRldGVjdGlvbiB3aWxsIGJlXG4gICAqIHRyaWdnZXJlZCBhc3luYyBieSBzY2hlZHVsaW5nIGEgYW5pbWF0aW9uIGZyYW1lLiBTbyBpbiB0aGUgY2FzZSBhYm92ZSxcbiAgICogdGhlIGNoYW5nZSBkZXRlY3Rpb24gd2lsbCBvbmx5IGJlIHRyaWdnZXJlZCBvbmNlLlxuICAgKi9cbiAgZXZlbnRDb2FsZXNjaW5nPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogT3B0aW9uYWxseSBzcGVjaWZ5IGlmIGBOZ1pvbmUjcnVuKClgIG1ldGhvZCBpbnZvY2F0aW9ucyBzaG91bGQgYmUgY29hbGVzY2VkXG4gICAqIGludG8gYSBzaW5nbGUgY2hhbmdlIGRldGVjdGlvbi5cbiAgICpcbiAgICogQ29uc2lkZXIgdGhlIGZvbGxvd2luZyBjYXNlLlxuICAgKiBgYGBcbiAgICogZm9yIChsZXQgaSA9IDA7IGkgPCAxMDsgaSArKykge1xuICAgKiAgIG5nWm9uZS5ydW4oKCkgPT4ge1xuICAgKiAgICAgLy8gZG8gc29tZXRoaW5nXG4gICAqICAgfSk7XG4gICAqIH1cbiAgICogYGBgXG4gICAqXG4gICAqIFRoaXMgY2FzZSB0cmlnZ2VycyB0aGUgY2hhbmdlIGRldGVjdGlvbiBtdWx0aXBsZSB0aW1lcy5cbiAgICogV2l0aCBuZ1pvbmVSdW5Db2FsZXNjaW5nIG9wdGlvbnMsIGFsbCBjaGFuZ2UgZGV0ZWN0aW9ucyBpbiBhbiBldmVudCBsb29wIHRyaWdnZXIgb25seSBvbmNlLlxuICAgKiBJbiBhZGRpdGlvbiwgdGhlIGNoYW5nZSBkZXRlY3Rpb24gZXhlY3V0ZXMgaW4gcmVxdWVzdEFuaW1hdGlvbi5cbiAgICpcbiAgICovXG4gIHJ1bkNvYWxlc2Npbmc/OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBXaGVuIGZhbHNlLCBjaGFuZ2UgZGV0ZWN0aW9uIGlzIHNjaGVkdWxlZCB3aGVuIEFuZ3VsYXIgcmVjZWl2ZXNcbiAgICogYSBjbGVhciBpbmRpY2F0aW9uIHRoYXQgdGVtcGxhdGVzIG5lZWQgdG8gYmUgcmVmcmVzaGVkLiBUaGlzIGluY2x1ZGVzOlxuICAgKlxuICAgKiAtIGNhbGxpbmcgYENoYW5nZURldGVjdG9yUmVmLm1hcmtGb3JDaGVja2BcbiAgICogLSBjYWxsaW5nIGBDb21wb25lbnRSZWYuc2V0SW5wdXRgXG4gICAqIC0gdXBkYXRpbmcgYSBzaWduYWwgdGhhdCBpcyByZWFkIGluIGEgdGVtcGxhdGVcbiAgICogLSB3aGVuIGJvdW5kIGhvc3Qgb3IgdGVtcGxhdGUgbGlzdGVuZXJzIGFyZSB0cmlnZ2VyZWRcbiAgICogLSBhdHRhY2hpbmcgYSB2aWV3IHRoYXQgaXMgbWFya2VkIGRpcnR5XG4gICAqIC0gcmVtb3ZpbmcgYSB2aWV3XG4gICAqIC0gcmVnaXN0ZXJpbmcgYSByZW5kZXIgaG9vayAodGVtcGxhdGVzIGFyZSBvbmx5IHJlZnJlc2hlZCBpZiByZW5kZXIgaG9va3MgZG8gb25lIG9mIHRoZSBhYm92ZSlcbiAgICovXG4gIGlnbm9yZUNoYW5nZXNPdXRzaWRlWm9uZT86IGJvb2xlYW47XG59XG5cbi8vIFRyYW5zZm9ybXMgYSBzZXQgb2YgYEJvb3RzdHJhcE9wdGlvbnNgIChzdXBwb3J0ZWQgYnkgdGhlIE5nTW9kdWxlLWJhc2VkIGJvb3RzdHJhcCBBUElzKSAtPlxuLy8gYE5nWm9uZU9wdGlvbnNgIHRoYXQgYXJlIHJlY29nbml6ZWQgYnkgdGhlIE5nWm9uZSBjb25zdHJ1Y3Rvci4gUGFzc2luZyBubyBvcHRpb25zIHdpbGwgcmVzdWx0IGluXG4vLyBhIHNldCBvZiBkZWZhdWx0IG9wdGlvbnMgcmV0dXJuZWQuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Tmdab25lT3B0aW9ucyhvcHRpb25zPzogTmdab25lT3B0aW9ucyk6IEludGVybmFsTmdab25lT3B0aW9ucyB7XG4gIHJldHVybiB7XG4gICAgZW5hYmxlTG9uZ1N0YWNrVHJhY2U6IHR5cGVvZiBuZ0Rldk1vZGUgPT09ICd1bmRlZmluZWQnID8gZmFsc2UgOiAhIW5nRGV2TW9kZSxcbiAgICBzaG91bGRDb2FsZXNjZUV2ZW50Q2hhbmdlRGV0ZWN0aW9uOiBvcHRpb25zPy5ldmVudENvYWxlc2NpbmcgPz8gZmFsc2UsXG4gICAgc2hvdWxkQ29hbGVzY2VSdW5DaGFuZ2VEZXRlY3Rpb246IG9wdGlvbnM/LnJ1bkNvYWxlc2NpbmcgPz8gZmFsc2UsXG4gIH07XG59XG5cbkBJbmplY3RhYmxlKHtwcm92aWRlZEluOiAncm9vdCd9KVxuZXhwb3J0IGNsYXNzIFpvbmVTdGFibGVQZW5kaW5nVGFzayB7XG4gIHByaXZhdGUgcmVhZG9ubHkgc3Vic2NyaXB0aW9uID0gbmV3IFN1YnNjcmlwdGlvbigpO1xuICBwcml2YXRlIGluaXRpYWxpemVkID0gZmFsc2U7XG4gIHByaXZhdGUgcmVhZG9ubHkgem9uZSA9IGluamVjdChOZ1pvbmUpO1xuICBwcml2YXRlIHJlYWRvbmx5IHBlbmRpbmdUYXNrcyA9IGluamVjdChQZW5kaW5nVGFza3MpO1xuXG4gIGluaXRpYWxpemUoKSB7XG4gICAgaWYgKHRoaXMuaW5pdGlhbGl6ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5pbml0aWFsaXplZCA9IHRydWU7XG5cbiAgICBsZXQgdGFzazogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gICAgaWYgKCF0aGlzLnpvbmUuaXNTdGFibGUgJiYgIXRoaXMuem9uZS5oYXNQZW5kaW5nTWFjcm90YXNrcyAmJiAhdGhpcy56b25lLmhhc1BlbmRpbmdNaWNyb3Rhc2tzKSB7XG4gICAgICB0YXNrID0gdGhpcy5wZW5kaW5nVGFza3MuYWRkKCk7XG4gICAgfVxuXG4gICAgdGhpcy56b25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uLmFkZChcbiAgICAgICAgdGhpcy56b25lLm9uU3RhYmxlLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgICAgTmdab25lLmFzc2VydE5vdEluQW5ndWxhclpvbmUoKTtcblxuICAgICAgICAgIC8vIENoZWNrIHdoZXRoZXIgdGhlcmUgYXJlIG5vIHBlbmRpbmcgbWFjcm8vbWljcm8gdGFza3MgaW4gdGhlIG5leHQgdGlja1xuICAgICAgICAgIC8vIHRvIGFsbG93IGZvciBOZ1pvbmUgdG8gdXBkYXRlIHRoZSBzdGF0ZS5cbiAgICAgICAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiB7XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIHRhc2sgIT09IG51bGwgJiZcbiAgICAgICAgICAgICAgIXRoaXMuem9uZS5oYXNQZW5kaW5nTWFjcm90YXNrcyAmJlxuICAgICAgICAgICAgICAhdGhpcy56b25lLmhhc1BlbmRpbmdNaWNyb3Rhc2tzXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgdGhpcy5wZW5kaW5nVGFza3MucmVtb3ZlKHRhc2spO1xuICAgICAgICAgICAgICB0YXNrID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH0pO1xuXG4gICAgdGhpcy5zdWJzY3JpcHRpb24uYWRkKFxuICAgICAgdGhpcy56b25lLm9uVW5zdGFibGUuc3Vic2NyaWJlKCgpID0+IHtcbiAgICAgICAgTmdab25lLmFzc2VydEluQW5ndWxhclpvbmUoKTtcbiAgICAgICAgdGFzayA/Pz0gdGhpcy5wZW5kaW5nVGFza3MuYWRkKCk7XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgbmdPbkRlc3Ryb3koKSB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKTtcbiAgfVxufVxuIl19