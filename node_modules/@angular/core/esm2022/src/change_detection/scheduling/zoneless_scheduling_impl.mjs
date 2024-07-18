/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Subscription } from 'rxjs';
import { ApplicationRef } from '../../application/application_ref';
import { Injectable } from '../../di/injectable';
import { inject } from '../../di/injector_compatibility';
import { makeEnvironmentProviders } from '../../di/provider_collection';
import { RuntimeError, formatRuntimeError } from '../../errors';
import { PendingTasks } from '../../pending_tasks';
import { scheduleCallbackWithMicrotask, scheduleCallbackWithRafRace, } from '../../util/callback_scheduler';
import { performanceMarkFeature } from '../../util/performance';
import { NgZone, NoopNgZone } from '../../zone/ng_zone';
import { ChangeDetectionScheduler, ZONELESS_ENABLED, PROVIDED_ZONELESS, ZONELESS_SCHEDULER_DISABLED, } from './zoneless_scheduling';
import * as i0 from "../../r3_symbols";
const CONSECUTIVE_MICROTASK_NOTIFICATION_LIMIT = 100;
let consecutiveMicrotaskNotifications = 0;
let stackFromLastFewNotifications = [];
function trackMicrotaskNotificationForDebugging() {
    consecutiveMicrotaskNotifications++;
    if (CONSECUTIVE_MICROTASK_NOTIFICATION_LIMIT - consecutiveMicrotaskNotifications < 5) {
        const stack = new Error().stack;
        if (stack) {
            stackFromLastFewNotifications.push(stack);
        }
    }
    if (consecutiveMicrotaskNotifications === CONSECUTIVE_MICROTASK_NOTIFICATION_LIMIT) {
        throw new RuntimeError(103 /* RuntimeErrorCode.INFINITE_CHANGE_DETECTION */, 'Angular could not stabilize because there were endless change notifications within the browser event loop. ' +
            'The stack from the last several notifications: \n' +
            stackFromLastFewNotifications.join('\n'));
    }
}
export class ChangeDetectionSchedulerImpl {
    constructor() {
        this.appRef = inject(ApplicationRef);
        this.taskService = inject(PendingTasks);
        this.ngZone = inject(NgZone);
        this.zonelessEnabled = inject(ZONELESS_ENABLED);
        this.disableScheduling = inject(ZONELESS_SCHEDULER_DISABLED, { optional: true }) ?? false;
        this.zoneIsDefined = typeof Zone !== 'undefined' && !!Zone.root.run;
        this.schedulerTickApplyArgs = [{ data: { '__scheduler_tick__': true } }];
        this.subscriptions = new Subscription();
        this.cancelScheduledCallback = null;
        this.shouldRefreshViews = false;
        this.useMicrotaskScheduler = false;
        this.runningTick = false;
        this.pendingRenderTaskId = null;
        this.subscriptions.add(this.appRef.afterTick.subscribe(() => {
            // If the scheduler isn't running a tick but the application ticked, that means
            // someone called ApplicationRef.tick manually. In this case, we should cancel
            // any change detections that had been scheduled so we don't run an extra one.
            if (!this.runningTick) {
                this.cleanup();
            }
        }));
        this.subscriptions.add(this.ngZone.onUnstable.subscribe(() => {
            // If the zone becomes unstable when we're not running tick (this happens from the zone.run),
            // we should cancel any scheduled change detection here because at this point we
            // know that the zone will stabilize at some point and run change detection itself.
            if (!this.runningTick) {
                this.cleanup();
            }
        }));
        // TODO(atscott): These conditions will need to change when zoneless is the default
        // Instead, they should flip to checking if ZoneJS scheduling is provided
        this.disableScheduling ||=
            !this.zonelessEnabled &&
                // NoopNgZone without enabling zoneless means no scheduling whatsoever
                (this.ngZone instanceof NoopNgZone ||
                    // The same goes for the lack of Zone without enabling zoneless scheduling
                    !this.zoneIsDefined);
    }
    notify(source) {
        if (!this.zonelessEnabled && source === 5 /* NotificationSource.Listener */) {
            // When the notification comes from a listener, we skip the notification unless the
            // application has enabled zoneless. Ideally, listeners wouldn't notify the scheduler at all
            // automatically. We do not know that a developer made a change in the listener callback that
            // requires an `ApplicationRef.tick` (synchronize templates / run render hooks). We do this
            // only for an easier migration from OnPush components to zoneless. Because listeners are
            // usually executed inside the Angular zone and listeners automatically call `markViewDirty`,
            // developers never needed to manually use `ChangeDetectorRef.markForCheck` or some other API
            // to make listener callbacks work correctly with `OnPush` components.
            return;
        }
        switch (source) {
            case 3 /* NotificationSource.DebugApplyChanges */:
            case 2 /* NotificationSource.DeferBlockStateUpdate */:
            case 0 /* NotificationSource.MarkAncestorsForTraversal */:
            case 4 /* NotificationSource.MarkForCheck */:
            case 5 /* NotificationSource.Listener */:
            case 1 /* NotificationSource.SetInput */: {
                this.shouldRefreshViews = true;
                break;
            }
            case 8 /* NotificationSource.ViewDetachedFromDOM */:
            case 7 /* NotificationSource.ViewAttached */:
            case 6 /* NotificationSource.NewRenderHook */:
            case 9 /* NotificationSource.AsyncAnimationsLoaded */:
            default: {
                // These notifications only schedule a tick but do not change whether we should refresh
                // views. Instead, we only need to run render hooks unless another notification from the
                // other set is also received before `tick` happens.
            }
        }
        if (!this.shouldScheduleTick()) {
            return;
        }
        if (typeof ngDevMode === 'undefined' || ngDevMode) {
            if (this.useMicrotaskScheduler) {
                trackMicrotaskNotificationForDebugging();
            }
            else {
                consecutiveMicrotaskNotifications = 0;
                stackFromLastFewNotifications.length = 0;
            }
        }
        const scheduleCallback = this.useMicrotaskScheduler
            ? scheduleCallbackWithMicrotask
            : scheduleCallbackWithRafRace;
        this.pendingRenderTaskId = this.taskService.add();
        if (this.zoneIsDefined) {
            Zone.root.run(() => {
                this.cancelScheduledCallback = scheduleCallback(() => {
                    this.tick(this.shouldRefreshViews);
                });
            });
        }
        else {
            this.cancelScheduledCallback = scheduleCallback(() => {
                this.tick(this.shouldRefreshViews);
            });
        }
    }
    shouldScheduleTick() {
        if (this.disableScheduling) {
            return false;
        }
        // already scheduled or running
        if (this.pendingRenderTaskId !== null || this.runningTick || this.appRef._runningTick) {
            return false;
        }
        // If we're inside the zone don't bother with scheduler. Zone will stabilize
        // eventually and run change detection.
        if (!this.zonelessEnabled && this.zoneIsDefined && NgZone.isInAngularZone()) {
            return false;
        }
        return true;
    }
    /**
     * Calls ApplicationRef._tick inside the `NgZone`.
     *
     * Calling `tick` directly runs change detection and cancels any change detection that had been
     * scheduled previously.
     *
     * @param shouldRefreshViews Passed directly to `ApplicationRef._tick` and skips straight to
     *     render hooks when `false`.
     */
    tick(shouldRefreshViews) {
        // When ngZone.run below exits, onMicrotaskEmpty may emit if the zone is
        // stable. We want to prevent double ticking so we track whether the tick is
        // already running and skip it if so.
        if (this.runningTick || this.appRef.destroyed) {
            return;
        }
        const task = this.taskService.add();
        try {
            this.ngZone.run(() => {
                this.runningTick = true;
                this.appRef._tick(shouldRefreshViews);
            }, undefined, this.schedulerTickApplyArgs);
        }
        catch (e) {
            this.taskService.remove(task);
            throw e;
        }
        finally {
            this.cleanup();
        }
        // If we're notified of a change within 1 microtask of running change
        // detection, run another round in the same event loop. This allows code
        // which uses Promise.resolve (see NgModel) to avoid
        // ExpressionChanged...Error to still be reflected in a single browser
        // paint, even if that spans multiple rounds of change detection.
        this.useMicrotaskScheduler = true;
        scheduleCallbackWithMicrotask(() => {
            this.useMicrotaskScheduler = false;
            this.taskService.remove(task);
        });
    }
    ngOnDestroy() {
        this.subscriptions.unsubscribe();
        this.cleanup();
    }
    cleanup() {
        this.shouldRefreshViews = false;
        this.runningTick = false;
        this.cancelScheduledCallback?.();
        this.cancelScheduledCallback = null;
        // If this is the last task, the service will synchronously emit a stable
        // notification. If there is a subscriber that then acts in a way that
        // tries to notify the scheduler again, we need to be able to respond to
        // schedule a new change detection. Therefore, we should clear the task ID
        // before removing it from the pending tasks (or the tasks service should
        // not synchronously emit stable, similar to how Zone stableness only
        // happens if it's still stable after a microtask).
        if (this.pendingRenderTaskId !== null) {
            const taskId = this.pendingRenderTaskId;
            this.pendingRenderTaskId = null;
            this.taskService.remove(taskId);
        }
    }
    static { this.ɵfac = function ChangeDetectionSchedulerImpl_Factory(t) { return new (t || ChangeDetectionSchedulerImpl)(); }; }
    static { this.ɵprov = /*@__PURE__*/ i0.ɵɵdefineInjectable({ token: ChangeDetectionSchedulerImpl, factory: ChangeDetectionSchedulerImpl.ɵfac, providedIn: 'root' }); }
}
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.setClassMetadata(ChangeDetectionSchedulerImpl, [{
        type: Injectable,
        args: [{ providedIn: 'root' }]
    }], () => [], null); })();
/**
 * Provides change detection without ZoneJS for the application bootstrapped using
 * `bootstrapApplication`.
 *
 * This function allows you to configure the application to not use the state/state changes of
 * ZoneJS to schedule change detection in the application. This will work when ZoneJS is not present
 * on the page at all or if it exists because something else is using it (either another Angular
 * application which uses ZoneJS for scheduling or some other library that relies on ZoneJS).
 *
 * This can also be added to the `TestBed` providers to configure the test environment to more
 * closely match production behavior. This will help give higher confidence that components are
 * compatible with zoneless change detection.
 *
 * ZoneJS uses browser events to trigger change detection. When using this provider, Angular will
 * instead use Angular APIs to schedule change detection. These APIs include:
 *
 * - `ChangeDetectorRef.markForCheck`
 * - `ComponentRef.setInput`
 * - updating a signal that is read in a template
 * - when bound host or template listeners are triggered
 * - attaching a view that was marked dirty by one of the above
 * - removing a view
 * - registering a render hook (templates are only refreshed if render hooks do one of the above)
 *
 * @usageNotes
 * ```typescript
 * bootstrapApplication(MyApp, {providers: [
 *   provideExperimentalZonelessChangeDetection(),
 * ]});
 * ```
 *
 * This API is experimental. Neither the shape, nor the underlying behavior is stable and can change
 * in patch versions. There are known feature gaps and API ergonomic considerations. We will iterate
 * on the exact API based on the feedback and our understanding of the problem and solution space.
 *
 * @publicApi
 * @experimental
 * @see [bootstrapApplication](/api/platform-browser/bootstrapApplication)
 */
export function provideExperimentalZonelessChangeDetection() {
    performanceMarkFeature('NgZoneless');
    if ((typeof ngDevMode === 'undefined' || ngDevMode) && typeof Zone !== 'undefined' && Zone) {
        const message = formatRuntimeError(914 /* RuntimeErrorCode.UNEXPECTED_ZONEJS_PRESENT_IN_ZONELESS_MODE */, `The application is using zoneless change detection, but is still loading Zone.js. ` +
            `Consider removing Zone.js to get the full benefits of zoneless. ` +
            `In applications using the Angular CLI, Zone.js is typically included in the "polyfills" section of the angular.json file.`);
        console.warn(message);
    }
    return makeEnvironmentProviders([
        { provide: ChangeDetectionScheduler, useExisting: ChangeDetectionSchedulerImpl },
        { provide: NgZone, useClass: NoopNgZone },
        { provide: ZONELESS_ENABLED, useValue: true },
        typeof ngDevMode === 'undefined' || ngDevMode
            ? [{ provide: PROVIDED_ZONELESS, useValue: true }]
            : [],
    ]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiem9uZWxlc3Nfc2NoZWR1bGluZ19pbXBsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvY2hhbmdlX2RldGVjdGlvbi9zY2hlZHVsaW5nL3pvbmVsZXNzX3NjaGVkdWxpbmdfaW1wbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sTUFBTSxDQUFDO0FBRWxDLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxtQ0FBbUMsQ0FBQztBQUNqRSxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDL0MsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBRXZELE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBQ3RFLE9BQU8sRUFBQyxZQUFZLEVBQW9CLGtCQUFrQixFQUFDLE1BQU0sY0FBYyxDQUFDO0FBQ2hGLE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUNqRCxPQUFPLEVBQ0wsNkJBQTZCLEVBQzdCLDJCQUEyQixHQUM1QixNQUFNLCtCQUErQixDQUFDO0FBQ3ZDLE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzlELE9BQU8sRUFBQyxNQUFNLEVBQUUsVUFBVSxFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFFdEQsT0FBTyxFQUNMLHdCQUF3QixFQUV4QixnQkFBZ0IsRUFDaEIsaUJBQWlCLEVBQ2pCLDJCQUEyQixHQUM1QixNQUFNLHVCQUF1QixDQUFDOztBQUUvQixNQUFNLHdDQUF3QyxHQUFHLEdBQUcsQ0FBQztBQUNyRCxJQUFJLGlDQUFpQyxHQUFHLENBQUMsQ0FBQztBQUMxQyxJQUFJLDZCQUE2QixHQUFhLEVBQUUsQ0FBQztBQUVqRCxTQUFTLHNDQUFzQztJQUM3QyxpQ0FBaUMs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QyxPQUFPLFNBQVMsS0FBSyxXQUFXLElBQUksU0FBUztZQUMzQyxDQUFDLENBQUMsQ0FBQyxFQUFDLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFDLENBQUM7WUFDaEQsQ0FBQyxDQUFDLEVBQUU7S0FDUCxDQUFDLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U3Vic2NyaXB0aW9ufSBmcm9tICdyeGpzJztcblxuaW1wb3J0IHtBcHBsaWNhdGlvblJlZn0gZnJvbSAnLi4vLi4vYXBwbGljYXRpb24vYXBwbGljYXRpb25fcmVmJztcbmltcG9ydCB7SW5qZWN0YWJsZX0gZnJvbSAnLi4vLi4vZGkvaW5qZWN0YWJsZSc7XG5pbXBvcnQge2luamVjdH0gZnJvbSAnLi4vLi4vZGkvaW5qZWN0b3JfY29tcGF0aWJpbGl0eSc7XG5pbXBvcnQge0Vudmlyb25tZW50UHJvdmlkZXJzfSBmcm9tICcuLi8uLi9kaS9pbnRlcmZhY2UvcHJvdmlkZXInO1xuaW1wb3J0IHttYWtlRW52aXJvbm1lbnRQcm92aWRlcnN9IGZyb20gJy4uLy4uL2RpL3Byb3ZpZGVyX2NvbGxlY3Rpb24nO1xuaW1wb3J0IHtSdW50aW1lRXJyb3IsIFJ1bnRpbWVFcnJvckNvZGUsIGZvcm1hdFJ1bnRpbWVFcnJvcn0gZnJvbSAnLi4vLi4vZXJyb3JzJztcbmltcG9ydCB7UGVuZGluZ1Rhc2tzfSBmcm9tICcuLi8uLi9wZW5kaW5nX3Rhc2tzJztcbmltcG9ydCB7XG4gIHNjaGVkdWxlQ2FsbGJhY2tXaXRoTWljcm90YXNrLFxuICBzY2hlZHVsZUNhbGxiYWNrV2l0aFJhZlJhY2UsXG59IGZyb20gJy4uLy4uL3V0aWwvY2FsbGJhY2tfc2NoZWR1bGVyJztcbmltcG9ydCB7cGVyZm9ybWFuY2VNYXJrRmVhdHVyZX0gZnJvbSAnLi4vLi4vdXRpbC9wZXJmb3JtYW5jZSc7XG5pbXBvcnQge05nWm9uZSwgTm9vcE5nWm9uZX0gZnJvbSAnLi4vLi4vem9uZS9uZ196b25lJztcblxuaW1wb3J0IHtcbiAgQ2hhbmdlRGV0ZWN0aW9uU2NoZWR1bGVyLFxuICBOb3RpZmljYXRpb25Tb3VyY2UsXG4gIFpPTkVMRVNTX0VOQUJMRUQsXG4gIFBST1ZJREVEX1pPTkVMRVNTLFxuICBaT05FTEVTU19TQ0hFRFVMRVJfRElTQUJMRUQsXG59IGZyb20gJy4vem9uZWxlc3Nfc2NoZWR1bGluZyc7XG5cbmNvbnN0IENPTlNFQ1VUSVZFX01JQ1JPVEFTS19OT1RJRklDQVRJT05fTElNSVQgPSAxMDA7XG5sZXQgY29uc2VjdXRpdmVNaWNyb3Rhc2tOb3RpZmljYXRpb25zID0gMDtcbmxldCBzdGFja0Zyb21MYXN0RmV3Tm90aWZpY2F0aW9uczogc3RyaW5nW10gPSBbXTtcblxuZnVuY3Rpb24gdHJhY2tNaWNyb3Rhc2tOb3RpZmljYXRpb25Gb3JEZWJ1Z2dpbmcoKSB7XG4gIGNvbnNlY3V0aXZlTWljcm90YXNrTm90aWZpY2F0aW9ucysrO1xuICBpZiAoQ09OU0VDVVRJVkVfTUlDUk9UQVNLX05PVElGSUNBVElPTl9MSU1JVCAtIGNvbnNlY3V0aXZlTWljcm90YXNrTm90aWZpY2F0aW9ucyA8IDUpIHtcbiAgICBjb25zdCBzdGFjayA9IG5ldyBFcnJvcigpLnN0YWNrO1xuICAgIGlmIChzdGFjaykge1xuICAgICAgc3RhY2tGcm9tTGFzdEZld05vdGlmaWNhdGlvbnMucHVzaChzdGFjayk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGNvbnNlY3V0aXZlTWljcm90YXNrTm90aWZpY2F0aW9ucyA9PT0gQ09OU0VDVVRJVkVfTUlDUk9UQVNLX05PVElGSUNBVElPTl9MSU1JVCkge1xuICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICBSdW50aW1lRXJyb3JDb2RlLklORklOSVRFX0NIQU5HRV9ERVRFQ1RJT04sXG4gICAgICAnQW5ndWxhciBjb3VsZCBub3Qgc3RhYmlsaXplIGJlY2F1c2UgdGhlcmUgd2VyZSBlbmRsZXNzIGNoYW5nZSBub3RpZmljYXRpb25zIHdpdGhpbiB0aGUgYnJvd3NlciBldmVudCBsb29wLiAnICtcbiAgICAgICAgJ1RoZSBzdGFjayBmcm9tIHRoZSBsYXN0IHNldmVyYWwgbm90aWZpY2F0aW9uczogXFxuJyArXG4gICAgICAgIHN0YWNrRnJvbUxhc3RGZXdOb3RpZmljYXRpb25zLmpvaW4oJ1xcbicpLFxuICAgICk7XG4gIH1cbn1cblxuQEluamVjdGFibGUoe3Byb3ZpZGVkSW46ICdyb290J30pXG5leHBvcnQgY2xhc3MgQ2hhbmdlRGV0ZWN0aW9uU2NoZWR1bGVySW1wbCBpbXBsZW1lbnRzIENoYW5nZURldGVjdGlvblNjaGVkdWxlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgYXBwUmVmID0gaW5qZWN0KEFwcGxpY2F0aW9uUmVmKTtcbiAgcHJpdmF0ZSByZWFkb25seSB0YXNrU2VydmljZSA9IGluamVjdChQZW5kaW5nVGFza3MpO1xuICBwcml2YXRlIHJlYWRvbmx5IG5nWm9uZSA9IGluamVjdChOZ1pvbmUpO1xuICBwcml2YXRlIHJlYWRvbmx5IHpvbmVsZXNzRW5hYmxlZCA9IGluamVjdChaT05FTEVTU19FTkFCTEVEKTtcbiAgcHJpdmF0ZSByZWFkb25seSBkaXNhYmxlU2NoZWR1bGluZyA9XG4gICAgaW5qZWN0KFpPTkVMRVNTX1NDSEVEVUxFUl9ESVNBQkxFRCwge29wdGlvbmFsOiB0cnVlfSkgPz8gZmFsc2U7XG4gIHByaXZhdGUgcmVhZG9ubHkgem9uZUlzRGVmaW5lZCA9IHR5cGVvZiBab25lICE9PSAndW5kZWZpbmVkJyAmJiAhIVpvbmUucm9vdC5ydW47XG4gIHByaXZhdGUgcmVhZG9ubHkgc2NoZWR1bGVyVGlja0FwcGx5QXJncyA9IFt7ZGF0YTogeydfX3NjaGVkdWxlcl90aWNrX18nOiB0cnVlfX1dO1xuICBwcml2YXRlIHJlYWRvbmx5IHN1YnNjcmlwdGlvbnMgPSBuZXcgU3Vic2NyaXB0aW9uKCk7XG5cbiAgcHJpdmF0ZSBjYW5jZWxTY2hlZHVsZWRDYWxsYmFjazogbnVsbCB8ICgoKSA9PiB2b2lkKSA9IG51bGw7XG4gIHByaXZhdGUgc2hvdWxkUmVmcmVzaFZpZXdzID0gZmFsc2U7XG4gIHByaXZhdGUgdXNlTWljcm90YXNrU2NoZWR1bGVyID0gZmFsc2U7XG4gIHJ1bm5pbmdUaWNrID0gZmFsc2U7XG4gIHBlbmRpbmdSZW5kZXJUYXNrSWQ6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5hZGQoXG4gICAgICB0aGlzLmFwcFJlZi5hZnRlclRpY2suc3Vic2NyaWJlKCgpID0+IHtcbiAgICAgICAgLy8gSWYgdGhlIHNjaGVkdWxlciBpc24ndCBydW5uaW5nIGEgdGljayBidXQgdGhlIGFwcGxpY2F0aW9uIHRpY2tlZCwgdGhhdCBtZWFuc1xuICAgICAgICAvLyBzb21lb25lIGNhbGxlZCBBcHBsaWNhdGlvblJlZi50aWNrIG1hbnVhbGx5LiBJbiB0aGlzIGNhc2UsIHdlIHNob3VsZCBjYW5jZWxcbiAgICAgICAgLy8gYW55IGNoYW5nZSBkZXRlY3Rpb25zIHRoYXQgaGFkIGJlZW4gc2NoZWR1bGVkIHNvIHdlIGRvbid0IHJ1biBhbiBleHRyYSBvbmUuXG4gICAgICAgIGlmICghdGhpcy5ydW5uaW5nVGljaykge1xuICAgICAgICAgIHRoaXMuY2xlYW51cCgpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApO1xuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5hZGQoXG4gICAgICB0aGlzLm5nWm9uZS5vblVuc3RhYmxlLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgIC8vIElmIHRoZSB6b25lIGJlY29tZXMgdW5zdGFibGUgd2hlbiB3ZSdyZSBub3QgcnVubmluZyB0aWNrICh0aGlzIGhhcHBlbnMgZnJvbSB0aGUgem9uZS5ydW4pLFxuICAgICAgICAvLyB3ZSBzaG91bGQgY2FuY2VsIGFueSBzY2hlZHVsZWQgY2hhbmdlIGRldGVjdGlvbiBoZXJlIGJlY2F1c2UgYXQgdGhpcyBwb2ludCB3ZVxuICAgICAgICAvLyBrbm93IHRoYXQgdGhlIHpvbmUgd2lsbCBzdGFiaWxpemUgYXQgc29tZSBwb2ludCBhbmQgcnVuIGNoYW5nZSBkZXRlY3Rpb24gaXRzZWxmLlxuICAgICAgICBpZiAoIXRoaXMucnVubmluZ1RpY2spIHtcbiAgICAgICAgICB0aGlzLmNsZWFudXAoKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKTtcblxuICAgIC8vIFRPRE8oYXRzY290dCk6IFRoZXNlIGNvbmRpdGlvbnMgd2lsbCBuZWVkIHRvIGNoYW5nZSB3aGVuIHpvbmVsZXNzIGlzIHRoZSBkZWZhdWx0XG4gICAgLy8gSW5zdGVhZCwgdGhleSBzaG91bGQgZmxpcCB0byBjaGVja2luZyBpZiBab25lSlMgc2NoZWR1bGluZyBpcyBwcm92aWRlZFxuICAgIHRoaXMuZGlzYWJsZVNjaGVkdWxpbmcgfHw9XG4gICAgICAhdGhpcy56b25lbGVzc0VuYWJsZWQgJiZcbiAgICAgIC8vIE5vb3BOZ1pvbmUgd2l0aG91dCBlbmFibGluZyB6b25lbGVzcyBtZWFucyBubyBzY2hlZHVsaW5nIHdoYXRzb2V2ZXJcbiAgICAgICh0aGlzLm5nWm9uZSBpbnN0YW5jZW9mIE5vb3BOZ1pvbmUgfHxcbiAgICAgICAgLy8gVGhlIHNhbWUgZ29lcyBmb3IgdGhlIGxhY2sgb2YgWm9uZSB3aXRob3V0IGVuYWJsaW5nIHpvbmVsZXNzIHNjaGVkdWxpbmdcbiAgICAgICAgIXRoaXMuem9uZUlzRGVmaW5lZCk7XG4gIH1cblxuICBub3RpZnkoc291cmNlOiBOb3RpZmljYXRpb25Tb3VyY2UpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuem9uZWxlc3NFbmFibGVkICYmIHNvdXJjZSA9PT0gTm90aWZpY2F0aW9uU291cmNlLkxpc3RlbmVyKSB7XG4gICAgICAvLyBXaGVuIHRoZSBub3RpZmljYXRpb24gY29tZXMgZnJvbSBhIGxpc3RlbmVyLCB3ZSBza2lwIHRoZSBub3RpZmljYXRpb24gdW5sZXNzIHRoZVxuICAgICAgLy8gYXBwbGljYXRpb24gaGFzIGVuYWJsZWQgem9uZWxlc3MuIElkZWFsbHksIGxpc3RlbmVycyB3b3VsZG4ndCBub3RpZnkgdGhlIHNjaGVkdWxlciBhdCBhbGxcbiAgICAgIC8vIGF1dG9tYXRpY2FsbHkuIFdlIGRvIG5vdCBrbm93IHRoYXQgYSBkZXZlbG9wZXIgbWFkZSBhIGNoYW5nZSBpbiB0aGUgbGlzdGVuZXIgY2FsbGJhY2sgdGhhdFxuICAgICAgLy8gcmVxdWlyZXMgYW4gYEFwcGxpY2F0aW9uUmVmLnRpY2tgIChzeW5jaHJvbml6ZSB0ZW1wbGF0ZXMgLyBydW4gcmVuZGVyIGhvb2tzKS4gV2UgZG8gdGhpc1xuICAgICAgLy8gb25seSBmb3IgYW4gZWFzaWVyIG1pZ3JhdGlvbiBmcm9tIE9uUHVzaCBjb21wb25lbnRzIHRvIHpvbmVsZXNzLiBCZWNhdXNlIGxpc3RlbmVycyBhcmVcbiAgICAgIC8vIHVzdWFsbHkgZXhlY3V0ZWQgaW5zaWRlIHRoZSBBbmd1bGFyIHpvbmUgYW5kIGxpc3RlbmVycyBhdXRvbWF0aWNhbGx5IGNhbGwgYG1hcmtWaWV3RGlydHlgLFxuICAgICAgLy8gZGV2ZWxvcGVycyBuZXZlciBuZWVkZWQgdG8gbWFudWFsbHkgdXNlIGBDaGFuZ2VEZXRlY3RvclJlZi5tYXJrRm9yQ2hlY2tgIG9yIHNvbWUgb3RoZXIgQVBJXG4gICAgICAvLyB0byBtYWtlIGxpc3RlbmVyIGNhbGxiYWNrcyB3b3JrIGNvcnJlY3RseSB3aXRoIGBPblB1c2hgIGNvbXBvbmVudHMuXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHN3aXRjaCAoc291cmNlKSB7XG4gICAgICBjYXNlIE5vdGlmaWNhdGlvblNvdXJjZS5EZWJ1Z0FwcGx5Q2hhbmdlczpcbiAgICAgIGNhc2UgTm90aWZpY2F0aW9uU291cmNlLkRlZmVyQmxvY2tTdGF0ZVVwZGF0ZTpcbiAgICAgIGNhc2UgTm90aWZpY2F0aW9uU291cmNlLk1hcmtBbmNlc3RvcnNGb3JUcmF2ZXJzYWw6XG4gICAgICBjYXNlIE5vdGlmaWNhdGlvblNvdXJjZS5NYXJrRm9yQ2hlY2s6XG4gICAgICBjYXNlIE5vdGlmaWNhdGlvblNvdXJjZS5MaXN0ZW5lcjpcbiAgICAgIGNhc2UgTm90aWZpY2F0aW9uU291cmNlLlNldElucHV0OiB7XG4gICAgICAgIHRoaXMuc2hvdWxkUmVmcmVzaFZpZXdzID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIE5vdGlmaWNhdGlvblNvdXJjZS5WaWV3RGV0YWNoZWRGcm9tRE9NOlxuICAgICAgY2FzZSBOb3RpZmljYXRpb25Tb3VyY2UuVmlld0F0dGFjaGVkOlxuICAgICAgY2FzZSBOb3RpZmljYXRpb25Tb3VyY2UuTmV3UmVuZGVySG9vazpcbiAgICAgIGNhc2UgTm90aWZpY2F0aW9uU291cmNlLkFzeW5jQW5pbWF0aW9uc0xvYWRlZDpcbiAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgLy8gVGhlc2Ugbm90aWZpY2F0aW9ucyBvbmx5IHNjaGVkdWxlIGEgdGljayBidXQgZG8gbm90IGNoYW5nZSB3aGV0aGVyIHdlIHNob3VsZCByZWZyZXNoXG4gICAgICAgIC8vIHZpZXdzLiBJbnN0ZWFkLCB3ZSBvbmx5IG5lZWQgdG8gcnVuIHJlbmRlciBob29rcyB1bmxlc3MgYW5vdGhlciBub3RpZmljYXRpb24gZnJvbSB0aGVcbiAgICAgICAgLy8gb3RoZXIgc2V0IGlzIGFsc28gcmVjZWl2ZWQgYmVmb3JlIGB0aWNrYCBoYXBwZW5zLlxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghdGhpcy5zaG91bGRTY2hlZHVsZVRpY2soKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCBuZ0Rldk1vZGUpIHtcbiAgICAgIGlmICh0aGlzLnVzZU1pY3JvdGFza1NjaGVkdWxlcikge1xuICAgICAgICB0cmFja01pY3JvdGFza05vdGlmaWNhdGlvbkZvckRlYnVnZ2luZygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc2VjdXRpdmVNaWNyb3Rhc2tOb3RpZmljYXRpb25zID0gMDtcbiAgICAgICAgc3RhY2tGcm9tTGFzdEZld05vdGlmaWNhdGlvbnMubGVuZ3RoID0gMDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBzY2hlZHVsZUNhbGxiYWNrID0gdGhpcy51c2VNaWNyb3Rhc2tTY2hlZHVsZXJcbiAgICAgID8gc2NoZWR1bGVDYWxsYmFja1dpdGhNaWNyb3Rhc2tcbiAgICAgIDogc2NoZWR1bGVDYWxsYmFja1dpdGhSYWZSYWNlO1xuICAgIHRoaXMucGVuZGluZ1JlbmRlclRhc2tJZCA9IHRoaXMudGFza1NlcnZpY2UuYWRkKCk7XG4gICAgaWYgKHRoaXMuem9uZUlzRGVmaW5lZCkge1xuICAgICAgWm9uZS5yb290LnJ1bigoKSA9PiB7XG4gICAgICAgIHRoaXMuY2FuY2VsU2NoZWR1bGVkQ2FsbGJhY2sgPSBzY2hlZHVsZUNhbGxiYWNrKCgpID0+IHtcbiAgICAgICAgICB0aGlzLnRpY2sodGhpcy5zaG91bGRSZWZyZXNoVmlld3MpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNhbmNlbFNjaGVkdWxlZENhbGxiYWNrID0gc2NoZWR1bGVDYWxsYmFjaygoKSA9PiB7XG4gICAgICAgIHRoaXMudGljayh0aGlzLnNob3VsZFJlZnJlc2hWaWV3cyk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHNob3VsZFNjaGVkdWxlVGljaygpOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5kaXNhYmxlU2NoZWR1bGluZykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBhbHJlYWR5IHNjaGVkdWxlZCBvciBydW5uaW5nXG4gICAgaWYgKHRoaXMucGVuZGluZ1JlbmRlclRhc2tJZCAhPT0gbnVsbCB8fCB0aGlzLnJ1bm5pbmdUaWNrIHx8IHRoaXMuYXBwUmVmLl9ydW5uaW5nVGljaykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBJZiB3ZSdyZSBpbnNpZGUgdGhlIHpvbmUgZG9uJ3QgYm90aGVyIHdpdGggc2NoZWR1bGVyLiBab25lIHdpbGwgc3RhYmlsaXplXG4gICAgLy8gZXZlbnR1YWxseSBhbmQgcnVuIGNoYW5nZSBkZXRlY3Rpb24uXG4gICAgaWYgKCF0aGlzLnpvbmVsZXNzRW5hYmxlZCAmJiB0aGlzLnpvbmVJc0RlZmluZWQgJiYgTmdab25lLmlzSW5Bbmd1bGFyWm9uZSgpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbHMgQXBwbGljYXRpb25SZWYuX3RpY2sgaW5zaWRlIHRoZSBgTmdab25lYC5cbiAgICpcbiAgICogQ2FsbGluZyBgdGlja2AgZGlyZWN0bHkgcnVucyBjaGFuZ2UgZGV0ZWN0aW9uIGFuZCBjYW5jZWxzIGFueSBjaGFuZ2UgZGV0ZWN0aW9uIHRoYXQgaGFkIGJlZW5cbiAgICogc2NoZWR1bGVkIHByZXZpb3VzbHkuXG4gICAqXG4gICAqIEBwYXJhbSBzaG91bGRSZWZyZXNoVmlld3MgUGFzc2VkIGRpcmVjdGx5IHRvIGBBcHBsaWNhdGlvblJlZi5fdGlja2AgYW5kIHNraXBzIHN0cmFpZ2h0IHRvXG4gICAqICAgICByZW5kZXIgaG9va3Mgd2hlbiBgZmFsc2VgLlxuICAgKi9cbiAgcHJpdmF0ZSB0aWNrKHNob3VsZFJlZnJlc2hWaWV3czogYm9vbGVhbik6IHZvaWQge1xuICAgIC8vIFdoZW4gbmdab25lLnJ1biBiZWxvdyBleGl0cywgb25NaWNyb3Rhc2tFbXB0eSBtYXkgZW1pdCBpZiB0aGUgem9uZSBpc1xuICAgIC8vIHN0YWJsZS4gV2Ugd2FudCB0byBwcmV2ZW50IGRvdWJsZSB0aWNraW5nIHNvIHdlIHRyYWNrIHdoZXRoZXIgdGhlIHRpY2sgaXNcbiAgICAvLyBhbHJlYWR5IHJ1bm5pbmcgYW5kIHNraXAgaXQgaWYgc28uXG4gICAgaWYgKHRoaXMucnVubmluZ1RpY2sgfHwgdGhpcy5hcHBSZWYuZGVzdHJveWVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGFzayA9IHRoaXMudGFza1NlcnZpY2UuYWRkKCk7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMubmdab25lLnJ1bihcbiAgICAgICAgKCkgPT4ge1xuICAgICAgICAgIHRoaXMucnVubmluZ1RpY2sgPSB0cnVlO1xuICAgICAgICAgIHRoaXMuYXBwUmVmLl90aWNrKHNob3VsZFJlZnJlc2hWaWV3cyk7XG4gICAgICAgIH0sXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgdGhpcy5zY2hlZHVsZXJUaWNrQXBwbHlBcmdzLFxuICAgICAgKTtcbiAgICB9IGNhdGNoIChlOiB1bmtub3duKSB7XG4gICAgICB0aGlzLnRhc2tTZXJ2aWNlLnJlbW92ZSh0YXNrKTtcbiAgICAgIHRocm93IGU7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuY2xlYW51cCgpO1xuICAgIH1cbiAgICAvLyBJZiB3ZSdyZSBub3RpZmllZCBvZiBhIGNoYW5nZSB3aXRoaW4gMSBtaWNyb3Rhc2sgb2YgcnVubmluZyBjaGFuZ2VcbiAgICAvLyBkZXRlY3Rpb24sIHJ1biBhbm90aGVyIHJvdW5kIGluIHRoZSBzYW1lIGV2ZW50IGxvb3AuIFRoaXMgYWxsb3dzIGNvZGVcbiAgICAvLyB3aGljaCB1c2VzIFByb21pc2UucmVzb2x2ZSAoc2VlIE5nTW9kZWwpIHRvIGF2b2lkXG4gICAgLy8gRXhwcmVzc2lvbkNoYW5nZWQuLi5FcnJvciB0byBzdGlsbCBiZSByZWZsZWN0ZWQgaW4gYSBzaW5nbGUgYnJvd3NlclxuICAgIC8vIHBhaW50LCBldmVuIGlmIHRoYXQgc3BhbnMgbXVsdGlwbGUgcm91bmRzIG9mIGNoYW5nZSBkZXRlY3Rpb24uXG4gICAgdGhpcy51c2VNaWNyb3Rhc2tTY2hlZHVsZXIgPSB0cnVlO1xuICAgIHNjaGVkdWxlQ2FsbGJhY2tXaXRoTWljcm90YXNrKCgpID0+IHtcbiAgICAgIHRoaXMudXNlTWljcm90YXNrU2NoZWR1bGVyID0gZmFsc2U7XG4gICAgICB0aGlzLnRhc2tTZXJ2aWNlLnJlbW92ZSh0YXNrKTtcbiAgICB9KTtcbiAgfVxuXG4gIG5nT25EZXN0cm95KCkge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy51bnN1YnNjcmliZSgpO1xuICAgIHRoaXMuY2xlYW51cCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBjbGVhbnVwKCkge1xuICAgIHRoaXMuc2hvdWxkUmVmcmVzaFZpZXdzID0gZmFsc2U7XG4gICAgdGhpcy5ydW5uaW5nVGljayA9IGZhbHNlO1xuICAgIHRoaXMuY2FuY2VsU2NoZWR1bGVkQ2FsbGJhY2s/LigpO1xuICAgIHRoaXMuY2FuY2VsU2NoZWR1bGVkQ2FsbGJhY2sgPSBudWxsO1xuICAgIC8vIElmIHRoaXMgaXMgdGhlIGxhc3QgdGFzaywgdGhlIHNlcnZpY2Ugd2lsbCBzeW5jaHJvbm91c2x5IGVtaXQgYSBzdGFibGVcbiAgICAvLyBub3RpZmljYXRpb24uIElmIHRoZXJlIGlzIGEgc3Vic2NyaWJlciB0aGF0IHRoZW4gYWN0cyBpbiBhIHdheSB0aGF0XG4gICAgLy8gdHJpZXMgdG8gbm90aWZ5IHRoZSBzY2hlZHVsZXIgYWdhaW4sIHdlIG5lZWQgdG8gYmUgYWJsZSB0byByZXNwb25kIHRvXG4gICAgLy8gc2NoZWR1bGUgYSBuZXcgY2hhbmdlIGRldGVjdGlvbi4gVGhlcmVmb3JlLCB3ZSBzaG91bGQgY2xlYXIgdGhlIHRhc2sgSURcbiAgICAvLyBiZWZvcmUgcmVtb3ZpbmcgaXQgZnJvbSB0aGUgcGVuZGluZyB0YXNrcyAob3IgdGhlIHRhc2tzIHNlcnZpY2Ugc2hvdWxkXG4gICAgLy8gbm90IHN5bmNocm9ub3VzbHkgZW1pdCBzdGFibGUsIHNpbWlsYXIgdG8gaG93IFpvbmUgc3RhYmxlbmVzcyBvbmx5XG4gICAgLy8gaGFwcGVucyBpZiBpdCdzIHN0aWxsIHN0YWJsZSBhZnRlciBhIG1pY3JvdGFzaykuXG4gICAgaWYgKHRoaXMucGVuZGluZ1JlbmRlclRhc2tJZCAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgdGFza0lkID0gdGhpcy5wZW5kaW5nUmVuZGVyVGFza0lkO1xuICAgICAgdGhpcy5wZW5kaW5nUmVuZGVyVGFza0lkID0gbnVsbDtcbiAgICAgIHRoaXMudGFza1NlcnZpY2UucmVtb3ZlKHRhc2tJZCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogUHJvdmlkZXMgY2hhbmdlIGRldGVjdGlvbiB3aXRob3V0IFpvbmVKUyBmb3IgdGhlIGFwcGxpY2F0aW9uIGJvb3RzdHJhcHBlZCB1c2luZ1xuICogYGJvb3RzdHJhcEFwcGxpY2F0aW9uYC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGFsbG93cyB5b3UgdG8gY29uZmlndXJlIHRoZSBhcHBsaWNhdGlvbiB0byBub3QgdXNlIHRoZSBzdGF0ZS9zdGF0ZSBjaGFuZ2VzIG9mXG4gKiBab25lSlMgdG8gc2NoZWR1bGUgY2hhbmdlIGRldGVjdGlvbiBpbiB0aGUgYXBwbGljYXRpb24uIFRoaXMgd2lsbCB3b3JrIHdoZW4gWm9uZUpTIGlzIG5vdCBwcmVzZW50XG4gKiBvbiB0aGUgcGFnZSBhdCBhbGwgb3IgaWYgaXQgZXhpc3RzIGJlY2F1c2Ugc29tZXRoaW5nIGVsc2UgaXMgdXNpbmcgaXQgKGVpdGhlciBhbm90aGVyIEFuZ3VsYXJcbiAqIGFwcGxpY2F0aW9uIHdoaWNoIHVzZXMgWm9uZUpTIGZvciBzY2hlZHVsaW5nIG9yIHNvbWUgb3RoZXIgbGlicmFyeSB0aGF0IHJlbGllcyBvbiBab25lSlMpLlxuICpcbiAqIFRoaXMgY2FuIGFsc28gYmUgYWRkZWQgdG8gdGhlIGBUZXN0QmVkYCBwcm92aWRlcnMgdG8gY29uZmlndXJlIHRoZSB0ZXN0IGVudmlyb25tZW50IHRvIG1vcmVcbiAqIGNsb3NlbHkgbWF0Y2ggcHJvZHVjdGlvbiBiZWhhdmlvci4gVGhpcyB3aWxsIGhlbHAgZ2l2ZSBoaWdoZXIgY29uZmlkZW5jZSB0aGF0IGNvbXBvbmVudHMgYXJlXG4gKiBjb21wYXRpYmxlIHdpdGggem9uZWxlc3MgY2hhbmdlIGRldGVjdGlvbi5cbiAqXG4gKiBab25lSlMgdXNlcyBicm93c2VyIGV2ZW50cyB0byB0cmlnZ2VyIGNoYW5nZSBkZXRlY3Rpb24uIFdoZW4gdXNpbmcgdGhpcyBwcm92aWRlciwgQW5ndWxhciB3aWxsXG4gKiBpbnN0ZWFkIHVzZSBBbmd1bGFyIEFQSXMgdG8gc2NoZWR1bGUgY2hhbmdlIGRldGVjdGlvbi4gVGhlc2UgQVBJcyBpbmNsdWRlOlxuICpcbiAqIC0gYENoYW5nZURldGVjdG9yUmVmLm1hcmtGb3JDaGVja2BcbiAqIC0gYENvbXBvbmVudFJlZi5zZXRJbnB1dGBcbiAqIC0gdXBkYXRpbmcgYSBzaWduYWwgdGhhdCBpcyByZWFkIGluIGEgdGVtcGxhdGVcbiAqIC0gd2hlbiBib3VuZCBob3N0IG9yIHRlbXBsYXRlIGxpc3RlbmVycyBhcmUgdHJpZ2dlcmVkXG4gKiAtIGF0dGFjaGluZyBhIHZpZXcgdGhhdCB3YXMgbWFya2VkIGRpcnR5IGJ5IG9uZSBvZiB0aGUgYWJvdmVcbiAqIC0gcmVtb3ZpbmcgYSB2aWV3XG4gKiAtIHJlZ2lzdGVyaW5nIGEgcmVuZGVyIGhvb2sgKHRlbXBsYXRlcyBhcmUgb25seSByZWZyZXNoZWQgaWYgcmVuZGVyIGhvb2tzIGRvIG9uZSBvZiB0aGUgYWJvdmUpXG4gKlxuICogQHVzYWdlTm90ZXNcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGJvb3RzdHJhcEFwcGxpY2F0aW9uKE15QXBwLCB7cHJvdmlkZXJzOiBbXG4gKiAgIHByb3ZpZGVFeHBlcmltZW50YWxab25lbGVzc0NoYW5nZURldGVjdGlvbigpLFxuICogXX0pO1xuICogYGBgXG4gKlxuICogVGhpcyBBUEkgaXMgZXhwZXJpbWVudGFsLiBOZWl0aGVyIHRoZSBzaGFwZSwgbm9yIHRoZSB1bmRlcmx5aW5nIGJlaGF2aW9yIGlzIHN0YWJsZSBhbmQgY2FuIGNoYW5nZVxuICogaW4gcGF0Y2ggdmVyc2lvbnMuIFRoZXJlIGFyZSBrbm93biBmZWF0dXJlIGdhcHMgYW5kIEFQSSBlcmdvbm9taWMgY29uc2lkZXJhdGlvbnMuIFdlIHdpbGwgaXRlcmF0ZVxuICogb24gdGhlIGV4YWN0IEFQSSBiYXNlZCBvbiB0aGUgZmVlZGJhY2sgYW5kIG91ciB1bmRlcnN0YW5kaW5nIG9mIHRoZSBwcm9ibGVtIGFuZCBzb2x1dGlvbiBzcGFjZS5cbiAqXG4gKiBAcHVibGljQXBpXG4gKiBAZXhwZXJpbWVudGFsXG4gKiBAc2VlIFtib290c3RyYXBBcHBsaWNhdGlvbl0oL2FwaS9wbGF0Zm9ybS1icm93c2VyL2Jvb3RzdHJhcEFwcGxpY2F0aW9uKVxuICovXG5leHBvcnQgZnVuY3Rpb24gcHJvdmlkZUV4cGVyaW1lbnRhbFpvbmVsZXNzQ2hhbmdlRGV0ZWN0aW9uKCk6IEVudmlyb25tZW50UHJvdmlkZXJzIHtcbiAgcGVyZm9ybWFuY2VNYXJrRmVhdHVyZSgnTmdab25lbGVzcycpO1xuXG4gIGlmICgodHlwZW9mIG5nRGV2TW9kZSA9PT0gJ3VuZGVmaW5lZCcgfHwgbmdEZXZNb2RlKSAmJiB0eXBlb2YgWm9uZSAhPT0gJ3VuZGVmaW5lZCcgJiYgWm9uZSkge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBmb3JtYXRSdW50aW1lRXJyb3IoXG4gICAgICBSdW50aW1lRXJyb3JDb2RlLlVORVhQRUNURURfWk9ORUpTX1BSRVNFTlRfSU5fWk9ORUxFU1NfTU9ERSxcbiAgICAgIGBUaGUgYXBwbGljYXRpb24gaXMgdXNpbmcgem9uZWxlc3MgY2hhbmdlIGRldGVjdGlvbiwgYnV0IGlzIHN0aWxsIGxvYWRpbmcgWm9uZS5qcy4gYCArXG4gICAgICAgIGBDb25zaWRlciByZW1vdmluZyBab25lLmpzIHRvIGdldCB0aGUgZnVsbCBiZW5lZml0cyBvZiB6b25lbGVzcy4gYCArXG4gICAgICAgIGBJbiBhcHBsaWNhdGlvbnMgdXNpbmcgdGhlIEFuZ3VsYXIgQ0xJLCBab25lLmpzIGlzIHR5cGljYWxseSBpbmNsdWRlZCBpbiB0aGUgXCJwb2x5ZmlsbHNcIiBzZWN0aW9uIG9mIHRoZSBhbmd1bGFyLmpzb24gZmlsZS5gLFxuICAgICk7XG4gICAgY29uc29sZS53YXJuKG1lc3NhZ2UpO1xuICB9XG5cbiAgcmV0dXJuIG1ha2VFbnZpcm9ubWVudFByb3ZpZGVycyhbXG4gICAge3Byb3ZpZGU6IENoYW5nZURldGVjdGlvblNjaGVkdWxlciwgdXNlRXhpc3Rpbmc6IENoYW5nZURldGVjdGlvblNjaGVkdWxlckltcGx9LFxuICAgIHtwcm92aWRlOiBOZ1pvbmUsIHVzZUNsYXNzOiBOb29wTmdab25lfSxcbiAgICB7cHJvdmlkZTogWk9ORUxFU1NfRU5BQkxFRCwgdXNlVmFsdWU6IHRydWV9LFxuICAgIHR5cGVvZiBuZ0Rldk1vZGUgPT09ICd1bmRlZmluZWQnIHx8IG5nRGV2TW9kZVxuICAgICAgPyBbe3Byb3ZpZGU6IFBST1ZJREVEX1pPTkVMRVNTLCB1c2VWYWx1ZTogdHJ1ZX1dXG4gICAgICA6IFtdLFxuICBdKTtcbn1cbiJdfQ==