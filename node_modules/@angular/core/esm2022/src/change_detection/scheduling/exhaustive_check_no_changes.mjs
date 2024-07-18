/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ApplicationRef } from '../../application/application_ref';
import { ChangeDetectionSchedulerImpl } from './zoneless_scheduling_impl';
import { inject } from '../../di/injector_compatibility';
import { makeEnvironmentProviders } from '../../di/provider_collection';
import { NgZone } from '../../zone/ng_zone';
import { EnvironmentInjector } from '../../di/r3_injector';
import { ENVIRONMENT_INITIALIZER } from '../../di/initializer_token';
import { CheckNoChangesMode } from '../../render3/state';
import { ErrorHandler } from '../../error_handler';
import { checkNoChangesInternal } from '../../render3/instructions/change_detection';
import { ZONELESS_ENABLED } from './zoneless_scheduling';
/**
 * Used to periodically verify no expressions have changed after they were checked.
 *
 * @param options Used to configure when the check will execute.
 *   - `interval` will periodically run exhaustive `checkNoChanges` on application views
 *   - `useNgZoneOnStable` will use ZoneJS to determine when change detection might have run
 *      in an application using ZoneJS to drive change detection. When the `NgZone.onStable` would
 *      have emitted, all views attached to the `ApplicationRef` are checked for changes.
 *   - 'exhaustive' means that all views attached to `ApplicationRef` and all the descendants of those views will be
 *     checked for changes (excluding those subtrees which are detached via `ChangeDetectorRef.detach()`).
 *     This is useful because the check that runs after regular change detection does not work for components using `ChangeDetectionStrategy.OnPush`.
 *     This check is will surface any existing errors hidden by `OnPush` components. By default, this check is exhaustive
 *     and will always check all views, regardless of their "dirty" state and `ChangeDetectionStrategy`.
 *
 * When the `useNgZoneOnStable` option is `true`, this function will provide its own `NgZone` implementation and needs
 * to come after any other `NgZone` provider, including `provideZoneChangeDetection()` and `provideExperimentalZonelessChangeDetection()`.
 *
 * @experimental
 * @publicApi
 */
export function provideExperimentalCheckNoChangesForDebug(options) {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
        if (options.interval === undefined && !options.useNgZoneOnStable) {
            throw new Error('Must provide one of `useNgZoneOnStable` or `interval`');
        }
        const checkNoChangesMode = options?.exhaustive === false
            ? CheckNoChangesMode.OnlyDirtyViews
            : CheckNoChangesMode.Exhaustive;
        return makeEnvironmentProviders([
            options?.useNgZoneOnStable
                ? { provide: NgZone, useFactory: () => new DebugNgZoneForCheckNoChanges(checkNoChangesMode) }
                : [],
            options?.interval !== undefined
                ? exhaustiveCheckNoChangesInterval(options.interval, checkNoChangesMode)
                : [],
            {
                provide: ENVIRONMENT_INITIALIZER,
                multi: true,
                useValue: () => {
                    if (options?.useNgZoneOnStable &&
                        !(inject(NgZone) instanceof DebugNgZoneForCheckNoChanges)) {
                        throw new Error('`provideExperimentalCheckNoChangesForDebug` with `useNgZoneOnStable` must be after any other provider for `NgZone`.');
                    }
                },
            },
        ]);
    }
    else {
        return makeEnvironmentProviders([]);
    }
}
export class DebugNgZoneForCheckNoChanges extends NgZone {
    constructor(checkNoChangesMode) {
        const zonelessEnabled = inject(ZONELESS_ENABLED);
        // Use coalescing to ensure we aren't ever running this check synchronously
        super({
            shouldCoalesceEventChangeDetection: true,
            shouldCoalesceRunChangeDetection: zonelessEnabled,
        });
        this.checkNoChangesMode = checkNoChangesMode;
        this.injector = inject(EnvironmentInjector);
        if (zonelessEnabled) {
            // prevent emits to ensure code doesn't rely on these
            this.onMicrotaskEmpty.emit = () => { };
            this.onStable.emit = () => {
                this.scheduler ||= this.injector.get(ChangeDetectionSchedulerImpl);
                if (this.scheduler.pendingRenderTaskId || this.scheduler.runningTick) {
                    return;
                }
                this.checkApplicationViews();
            };
            this.onUnstable.emit = () => { };
        }
        else {
            this.runOutsideAngular(() => {
                this.onStable.subscribe(() => {
                    this.checkApplicationViews();
                });
            });
        }
    }
    checkApplicationViews() {
        this.applicationRef ||= this.injector.get(ApplicationRef);
        for (const view of this.applicationRef.allViews) {
            try {
                checkNoChangesInternal(view._lView, this.checkNoChangesMode, view.notifyErrorHandler);
            }
            catch (e) {
                this.errorHandler ||= this.injector.get(ErrorHandler);
                this.errorHandler.handleError(e);
            }
        }
    }
}
function exhaustiveCheckNoChangesInterval(interval, checkNoChangesMode) {
    return {
        provide: ENVIRONMENT_INITIALIZER,
        multi: true,
        useFactory: () => {
            const applicationRef = inject(ApplicationRef);
            const errorHandler = inject(ErrorHandler);
            const scheduler = inject(ChangeDetectionSchedulerImpl);
            const ngZone = inject(NgZone);
            return () => {
                function scheduleCheckNoChanges() {
                    ngZone.runOutsideAngular(() => {
                        setTimeout(() => {
                            if (applicationRef.destroyed) {
                                return;
                            }
                            if (scheduler.pendingRenderTaskId || scheduler.runningTick) {
                                scheduleCheckNoChanges();
                                return;
                            }
                            for (const view of applicationRef.allViews) {
                                try {
                                    checkNoChangesInternal(view._lView, checkNoChangesMode, view.notifyErrorHandler);
                                }
                                catch (e) {
                                    errorHandler.handleError(e);
                                }
                            }
                            scheduleCheckNoChanges();
                        }, interval);
                    });
                }
                scheduleCheckNoChanges();
            };
        },
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhoYXVzdGl2ZV9jaGVja19ub19jaGFuZ2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvY2hhbmdlX2RldGVjdGlvbi9zY2hlZHVsaW5nL2V4aGF1c3RpdmVfY2hlY2tfbm9fY2hhbmdlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sbUNBQW1DLENBQUM7QUFDakUsT0FBTyxFQUFDLDRCQUE0QixFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDeEUsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBQ3RFLE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUUxQyxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUN6RCxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSw0QkFBNEIsQ0FBQztBQUNuRSxPQUFPLEVBQUMsa0JBQWtCLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUN2RCxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDakQsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFDbkYsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFFdkQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FtQkc7QUFDSCxNQUFNLFVBQVUseUNBQXlDLENBQUMsT0FJekQ7SUFDQyxJQUFJLE9BQU8sU0FBUyxLQUFLLFdBQVcsSUFBSSxTQUFTLEVBQUUsQ0FBQztRQUNsRCxJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssU0FBUyxJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDakUs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RUQsS0FBSyxNQUFNLElBQUksSUFBSSxjQUFjLENBQUMsUUFBUSxFQUFFLENBQUM7Z0NBQzNDLElBQUksQ0FBQztvQ0FDSCxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLGtCQUFrQixFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO2dDQUNuRixDQUFDO2dDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7b0NBQ1gsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQ0FDOUIsQ0FBQzs0QkFDSCxDQUFDOzRCQUVELHNCQUFzQixFQUFFLENBQUM7d0JBQzNCLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFDZixDQUFDLENBQUMsQ0FBQztnQkFDTCxDQUFDO2dCQUNELHNCQUFzQixFQUFFLENBQUM7WUFDM0IsQ0FBQyxDQUFDO1FBQ0osQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QXBwbGljYXRpb25SZWZ9IGZyb20gJy4uLy4uL2FwcGxpY2F0aW9uL2FwcGxpY2F0aW9uX3JlZic7XG5pbXBvcnQge0NoYW5nZURldGVjdGlvblNjaGVkdWxlckltcGx9IGZyb20gJy4vem9uZWxlc3Nfc2NoZWR1bGluZ19pbXBsJztcbmltcG9ydCB7aW5qZWN0fSBmcm9tICcuLi8uLi9kaS9pbmplY3Rvcl9jb21wYXRpYmlsaXR5JztcbmltcG9ydCB7bWFrZUVudmlyb25tZW50UHJvdmlkZXJzfSBmcm9tICcuLi8uLi9kaS9wcm92aWRlcl9jb2xsZWN0aW9uJztcbmltcG9ydCB7Tmdab25lfSBmcm9tICcuLi8uLi96b25lL25nX3pvbmUnO1xuXG5pbXBvcnQge0Vudmlyb25tZW50SW5qZWN0b3J9IGZyb20gJy4uLy4uL2RpL3IzX2luamVjdG9yJztcbmltcG9ydCB7RU5WSVJPTk1FTlRfSU5JVElBTElaRVJ9IGZyb20gJy4uLy4uL2RpL2luaXRpYWxpemVyX3Rva2VuJztcbmltcG9ydCB7Q2hlY2tOb0NoYW5nZXNNb2RlfSBmcm9tICcuLi8uLi9yZW5kZXIzL3N0YXRlJztcbmltcG9ydCB7RXJyb3JIYW5kbGVyfSBmcm9tICcuLi8uLi9lcnJvcl9oYW5kbGVyJztcbmltcG9ydCB7Y2hlY2tOb0NoYW5nZXNJbnRlcm5hbH0gZnJvbSAnLi4vLi4vcmVuZGVyMy9pbnN0cnVjdGlvbnMvY2hhbmdlX2RldGVjdGlvbic7XG5pbXBvcnQge1pPTkVMRVNTX0VOQUJMRUR9IGZyb20gJy4vem9uZWxlc3Nfc2NoZWR1bGluZyc7XG5cbi8qKlxuICogVXNlZCB0byBwZXJpb2RpY2FsbHkgdmVyaWZ5IG5vIGV4cHJlc3Npb25zIGhhdmUgY2hhbmdlZCBhZnRlciB0aGV5IHdlcmUgY2hlY2tlZC5cbiAqXG4gKiBAcGFyYW0gb3B0aW9ucyBVc2VkIHRvIGNvbmZpZ3VyZSB3aGVuIHRoZSBjaGVjayB3aWxsIGV4ZWN1dGUuXG4gKiAgIC0gYGludGVydmFsYCB3aWxsIHBlcmlvZGljYWxseSBydW4gZXhoYXVzdGl2ZSBgY2hlY2tOb0NoYW5nZXNgIG9uIGFwcGxpY2F0aW9uIHZpZXdzXG4gKiAgIC0gYHVzZU5nWm9uZU9uU3RhYmxlYCB3aWxsIHVzZSBab25lSlMgdG8gZGV0ZXJtaW5lIHdoZW4gY2hhbmdlIGRldGVjdGlvbiBtaWdodCBoYXZlIHJ1blxuICogICAgICBpbiBhbiBhcHBsaWNhdGlvbiB1c2luZyBab25lSlMgdG8gZHJpdmUgY2hhbmdlIGRldGVjdGlvbi4gV2hlbiB0aGUgYE5nWm9uZS5vblN0YWJsZWAgd291bGRcbiAqICAgICAgaGF2ZSBlbWl0dGVkLCBhbGwgdmlld3MgYXR0YWNoZWQgdG8gdGhlIGBBcHBsaWNhdGlvblJlZmAgYXJlIGNoZWNrZWQgZm9yIGNoYW5nZXMuXG4gKiAgIC0gJ2V4aGF1c3RpdmUnIG1lYW5zIHRoYXQgYWxsIHZpZXdzIGF0dGFjaGVkIHRvIGBBcHBsaWNhdGlvblJlZmAgYW5kIGFsbCB0aGUgZGVzY2VuZGFudHMgb2YgdGhvc2Ugdmlld3Mgd2lsbCBiZVxuICogICAgIGNoZWNrZWQgZm9yIGNoYW5nZXMgKGV4Y2x1ZGluZyB0aG9zZSBzdWJ0cmVlcyB3aGljaCBhcmUgZGV0YWNoZWQgdmlhIGBDaGFuZ2VEZXRlY3RvclJlZi5kZXRhY2goKWApLlxuICogICAgIFRoaXMgaXMgdXNlZnVsIGJlY2F1c2UgdGhlIGNoZWNrIHRoYXQgcnVucyBhZnRlciByZWd1bGFyIGNoYW5nZSBkZXRlY3Rpb24gZG9lcyBub3Qgd29yayBmb3IgY29tcG9uZW50cyB1c2luZyBgQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kuT25QdXNoYC5cbiAqICAgICBUaGlzIGNoZWNrIGlzIHdpbGwgc3VyZmFjZSBhbnkgZXhpc3RpbmcgZXJyb3JzIGhpZGRlbiBieSBgT25QdXNoYCBjb21wb25lbnRzLiBCeSBkZWZhdWx0LCB0aGlzIGNoZWNrIGlzIGV4aGF1c3RpdmVcbiAqICAgICBhbmQgd2lsbCBhbHdheXMgY2hlY2sgYWxsIHZpZXdzLCByZWdhcmRsZXNzIG9mIHRoZWlyIFwiZGlydHlcIiBzdGF0ZSBhbmQgYENoYW5nZURldGVjdGlvblN0cmF0ZWd5YC5cbiAqXG4gKiBXaGVuIHRoZSBgdXNlTmdab25lT25TdGFibGVgIG9wdGlvbiBpcyBgdHJ1ZWAsIHRoaXMgZnVuY3Rpb24gd2lsbCBwcm92aWRlIGl0cyBvd24gYE5nWm9uZWAgaW1wbGVtZW50YXRpb24gYW5kIG5lZWRzXG4gKiB0byBjb21lIGFmdGVyIGFueSBvdGhlciBgTmdab25lYCBwcm92aWRlciwgaW5jbHVkaW5nIGBwcm92aWRlWm9uZUNoYW5nZURldGVjdGlvbigpYCBhbmQgYHByb3ZpZGVFeHBlcmltZW50YWxab25lbGVzc0NoYW5nZURldGVjdGlvbigpYC5cbiAqXG4gKiBAZXhwZXJpbWVudGFsXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcm92aWRlRXhwZXJpbWVudGFsQ2hlY2tOb0NoYW5nZXNGb3JEZWJ1ZyhvcHRpb25zOiB7XG4gIGludGVydmFsPzogbnVtYmVyO1xuICB1c2VOZ1pvbmVPblN0YWJsZT86IGJvb2xlYW47XG4gIGV4aGF1c3RpdmU/OiBib29sZWFuO1xufSkge1xuICBpZiAodHlwZW9mIG5nRGV2TW9kZSA9PT0gJ3VuZGVmaW5lZCcgfHwgbmdEZXZNb2RlKSB7XG4gICAgaWYgKG9wdGlvbnMuaW50ZXJ2YWwgPT09IHVuZGVmaW5lZCAmJiAhb3B0aW9ucy51c2VOZ1pvbmVPblN0YWJsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNdXN0IHByb3ZpZGUgb25lIG9mIGB1c2VOZ1pvbmVPblN0YWJsZWAgb3IgYGludGVydmFsYCcpO1xuICAgIH1cbiAgICBjb25zdCBjaGVja05vQ2hhbmdlc01vZGUgPVxuICAgICAgb3B0aW9ucz8uZXhoYXVzdGl2ZSA9PT0gZmFsc2VcbiAgICAgICAgPyBDaGVja05vQ2hhbmdlc01vZGUuT25seURpcnR5Vmlld3NcbiAgICAgICAgOiBDaGVja05vQ2hhbmdlc01vZGUuRXhoYXVzdGl2ZTtcbiAgICByZXR1cm4gbWFrZUVudmlyb25tZW50UHJvdmlkZXJzKFtcbiAgICAgIG9wdGlvbnM/LnVzZU5nWm9uZU9uU3RhYmxlXG4gICAgICAgID8ge3Byb3ZpZGU6IE5nWm9uZSwgdXNlRmFjdG9yeTogKCkgPT4gbmV3IERlYnVnTmdab25lRm9yQ2hlY2tOb0NoYW5nZXMoY2hlY2tOb0NoYW5nZXNNb2RlKX1cbiAgICAgICAgOiBbXSxcbiAgICAgIG9wdGlvbnM/LmludGVydmFsICE9PSB1bmRlZmluZWRcbiAgICAgICAgPyBleGhhdXN0aXZlQ2hlY2tOb0NoYW5nZXNJbnRlcnZhbChvcHRpb25zLmludGVydmFsLCBjaGVja05vQ2hhbmdlc01vZGUpXG4gICAgICAgIDogW10sXG4gICAgICB7XG4gICAgICAgIHByb3ZpZGU6IEVOVklST05NRU5UX0lOSVRJQUxJWkVSLFxuICAgICAgICBtdWx0aTogdHJ1ZSxcbiAgICAgICAgdXNlVmFsdWU6ICgpID0+IHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBvcHRpb25zPy51c2VOZ1pvbmVPblN0YWJsZSAmJlxuICAgICAgICAgICAgIShpbmplY3QoTmdab25lKSBpbnN0YW5jZW9mIERlYnVnTmdab25lRm9yQ2hlY2tOb0NoYW5nZXMpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICdgcHJvdmlkZUV4cGVyaW1lbnRhbENoZWNrTm9DaGFuZ2VzRm9yRGVidWdgIHdpdGggYHVzZU5nWm9uZU9uU3RhYmxlYCBtdXN0IGJlIGFmdGVyIGFueSBvdGhlciBwcm92aWRlciBmb3IgYE5nWm9uZWAuJyxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbWFrZUVudmlyb25tZW50UHJvdmlkZXJzKFtdKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRGVidWdOZ1pvbmVGb3JDaGVja05vQ2hhbmdlcyBleHRlbmRzIE5nWm9uZSB7XG4gIHByaXZhdGUgYXBwbGljYXRpb25SZWY/OiBBcHBsaWNhdGlvblJlZjtcbiAgcHJpdmF0ZSBzY2hlZHVsZXI/OiBDaGFuZ2VEZXRlY3Rpb25TY2hlZHVsZXJJbXBsO1xuICBwcml2YXRlIGVycm9ySGFuZGxlcj86IEVycm9ySGFuZGxlcjtcbiAgcHJpdmF0ZSByZWFkb25seSBpbmplY3RvciA9IGluamVjdChFbnZpcm9ubWVudEluamVjdG9yKTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGNoZWNrTm9DaGFuZ2VzTW9kZTogQ2hlY2tOb0NoYW5nZXNNb2RlKSB7XG4gICAgY29uc3Qgem9uZWxlc3NFbmFibGVkID0gaW5qZWN0KFpPTkVMRVNTX0VOQUJMRUQpO1xuICAgIC8vIFVzZSBjb2FsZXNjaW5nIHRvIGVuc3VyZSB3ZSBhcmVuJ3QgZXZlciBydW5uaW5nIHRoaXMgY2hlY2sgc3luY2hyb25vdXNseVxuICAgIHN1cGVyKHtcbiAgICAgIHNob3VsZENvYWxlc2NlRXZlbnRDaGFuZ2VEZXRlY3Rpb246IHRydWUsXG4gICAgICBzaG91bGRDb2FsZXNjZVJ1bkNoYW5nZURldGVjdGlvbjogem9uZWxlc3NFbmFibGVkLFxuICAgIH0pO1xuXG4gICAgaWYgKHpvbmVsZXNzRW5hYmxlZCkge1xuICAgICAgLy8gcHJldmVudCBlbWl0cyB0byBlbnN1cmUgY29kZSBkb2Vzbid0IHJlbHkgb24gdGhlc2VcbiAgICAgIHRoaXMub25NaWNyb3Rhc2tFbXB0eS5lbWl0ID0gKCkgPT4ge307XG4gICAgICB0aGlzLm9uU3RhYmxlLmVtaXQgPSAoKSA9PiB7XG4gICAgICAgIHRoaXMuc2NoZWR1bGVyIHx8PSB0aGlzLmluamVjdG9yLmdldChDaGFuZ2VEZXRlY3Rpb25TY2hlZHVsZXJJbXBsKTtcbiAgICAgICAgaWYgKHRoaXMuc2NoZWR1bGVyLnBlbmRpbmdSZW5kZXJUYXNrSWQgfHwgdGhpcy5zY2hlZHVsZXIucnVubmluZ1RpY2spIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jaGVja0FwcGxpY2F0aW9uVmlld3MoKTtcbiAgICAgIH07XG4gICAgICB0aGlzLm9uVW5zdGFibGUuZW1pdCA9ICgpID0+IHt9O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+IHtcbiAgICAgICAgdGhpcy5vblN0YWJsZS5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgICAgIHRoaXMuY2hlY2tBcHBsaWNhdGlvblZpZXdzKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjaGVja0FwcGxpY2F0aW9uVmlld3MoKSB7XG4gICAgdGhpcy5hcHBsaWNhdGlvblJlZiB8fD0gdGhpcy5pbmplY3Rvci5nZXQoQXBwbGljYXRpb25SZWYpO1xuICAgIGZvciAoY29uc3QgdmlldyBvZiB0aGlzLmFwcGxpY2F0aW9uUmVmLmFsbFZpZXdzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjaGVja05vQ2hhbmdlc0ludGVybmFsKHZpZXcuX2xWaWV3LCB0aGlzLmNoZWNrTm9DaGFuZ2VzTW9kZSwgdmlldy5ub3RpZnlFcnJvckhhbmRsZXIpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB0aGlzLmVycm9ySGFuZGxlciB8fD0gdGhpcy5pbmplY3Rvci5nZXQoRXJyb3JIYW5kbGVyKTtcbiAgICAgICAgdGhpcy5lcnJvckhhbmRsZXIuaGFuZGxlRXJyb3IoZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGV4aGF1c3RpdmVDaGVja05vQ2hhbmdlc0ludGVydmFsKFxuICBpbnRlcnZhbDogbnVtYmVyLFxuICBjaGVja05vQ2hhbmdlc01vZGU6IENoZWNrTm9DaGFuZ2VzTW9kZSxcbikge1xuICByZXR1cm4ge1xuICAgIHByb3ZpZGU6IEVOVklST05NRU5UX0lOSVRJQUxJWkVSLFxuICAgIG11bHRpOiB0cnVlLFxuICAgIHVzZUZhY3Rvcnk6ICgpID0+IHtcbiAgICAgIGNvbnN0IGFwcGxpY2F0aW9uUmVmID0gaW5qZWN0KEFwcGxpY2F0aW9uUmVmKTtcbiAgICAgIGNvbnN0IGVycm9ySGFuZGxlciA9IGluamVjdChFcnJvckhhbmRsZXIpO1xuICAgICAgY29uc3Qgc2NoZWR1bGVyID0gaW5qZWN0KENoYW5nZURldGVjdGlvblNjaGVkdWxlckltcGwpO1xuICAgICAgY29uc3Qgbmdab25lID0gaW5qZWN0KE5nWm9uZSk7XG5cbiAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgIGZ1bmN0aW9uIHNjaGVkdWxlQ2hlY2tOb0NoYW5nZXMoKSB7XG4gICAgICAgICAgbmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+IHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICBpZiAoYXBwbGljYXRpb25SZWYuZGVzdHJveWVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzY2hlZHVsZXIucGVuZGluZ1JlbmRlclRhc2tJZCB8fCBzY2hlZHVsZXIucnVubmluZ1RpY2spIHtcbiAgICAgICAgICAgICAgICBzY2hlZHVsZUNoZWNrTm9DaGFuZ2VzKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgZm9yIChjb25zdCB2aWV3IG9mIGFwcGxpY2F0aW9uUmVmLmFsbFZpZXdzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGNoZWNrTm9DaGFuZ2VzSW50ZXJuYWwodmlldy5fbFZpZXcsIGNoZWNrTm9DaGFuZ2VzTW9kZSwgdmlldy5ub3RpZnlFcnJvckhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgIGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBzY2hlZHVsZUNoZWNrTm9DaGFuZ2VzKCk7XG4gICAgICAgICAgICB9LCBpbnRlcnZhbCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgc2NoZWR1bGVDaGVja05vQ2hhbmdlcygpO1xuICAgICAgfTtcbiAgICB9LFxuICB9O1xufVxuIl19