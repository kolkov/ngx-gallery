/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Inject, Injectable, InjectionToken } from '../di';
import { NgZone } from '../zone/ng_zone';
import * as i0 from "../r3_symbols";
import * as i1 from "../zone/ng_zone";
/**
 * Internal injection token that can used to access an instance of a Testability class.
 *
 * This token acts as a bridge between the core bootstrap code and the `Testability` class. This is
 * needed to ensure that there are no direct references to the `Testability` class, so it can be
 * tree-shaken away (if not referenced). For the environments/setups when the `Testability` class
 * should be available, this token is used to add a provider that references the `Testability`
 * class. Otherwise, only this token is retained in a bundle, but the `Testability` class is not.
 */
export const TESTABILITY = new InjectionToken('');
/**
 * Internal injection token to retrieve Testability getter class instance.
 */
export const TESTABILITY_GETTER = new InjectionToken('');
/**
 * The Testability service provides testing hooks that can be accessed from
 * the browser.
 *
 * Angular applications bootstrapped using an NgModule (via `@NgModule.bootstrap` field) will also
 * instantiate Testability by default (in both development and production modes).
 *
 * For applications bootstrapped using the `bootstrapApplication` function, Testability is not
 * included by default. You can include it into your applications by getting the list of necessary
 * providers using the `provideProtractorTestingSupport()` function and adding them into the
 * `options.providers` array. Example:
 *
 * ```typescript
 * import {provideProtractorTestingSupport} from '@angular/platform-browser';
 *
 * await bootstrapApplication(RootComponent, providers: [provideProtractorTestingSupport()]);
 * ```
 *
 * @publicApi
 */
export class Testability {
    constructor(_ngZone, registry, testabilityGetter) {
        this._ngZone = _ngZone;
        this.registry = registry;
        this._isZoneStable = true;
        this._callbacks = [];
        this.taskTrackingZone = null;
        // If there was no Testability logic registered in the global scope
        // before, register the current testability getter as a global one.
        if (!_testabilityGetter) {
            setTestabilityGetter(testabilityGetter);
            testabilityGetter.addToWindow(registry);
        }
        this._watchAngularEvents();
        _ngZone.run(() => {
            this.taskTrackingZone =
                typeof Zone == 'undefined' ? null : Zone.current.get('TaskTrackingZone');
        });
    }
    _watchAngularEvents() {
        this._ngZone.onUnstable.subscribe({
            next: () => {
                this._isZoneStable = false;
            },
        });
        this._ngZone.runOutsideAngular(() => {
            this._ngZone.onStable.subscribe({
                next: () => {
                    NgZone.assertNotInAngularZone();
                    queueMicrotask(() => {
                        this._isZoneStable = true;
                        this._runCallbacksIfReady();
                    });
                },
            });
        });
    }
    /**
     * Whether an associated application is stable
     */
    isStable() {
        return this._isZoneStable && !this._ngZone.hasPendingMacrotasks;
    }
    _runCallbacksIfReady() {
        if (this.isStable()) {
            // Schedules the call backs in a new frame so that it is always async.
            queueMicrotask(() => {
                while (this._callbacks.length !== 0) {
                    let cb = this._callbacks.pop();
                    clearTimeout(cb.timeoutId);
                    cb.doneCb();
                }
            });
        }
        else {
            // Still not stable, send updates.
            let pending = this.getPendingTasks();
            this._callbacks = this._callbacks.filter((cb) => {
                if (cb.updateCb && cb.updateCb(pending)) {
                    clearTimeout(cb.timeoutId);
                    return false;
                }
                return true;
            });
        }
    }
    getPendingTasks() {
        if (!this.taskTrackingZone) {
            return [];
        }
        // Copy the tasks data so that we don't leak tasks.
        return this.taskTrackingZone.macroTasks.map((t) => {
            return {
                source: t.source,
                // From TaskTrackingZone:
                // https://github.com/angular/zone.js/blob/master/lib/zone-spec/task-tracking.ts#L40
                creationLocation: t.creationLocation,
                data: t.data,
            };
        });
    }
    addCallback(cb, timeout, updateCb) {
        let timeoutId = -1;
        if (timeout && timeout > 0) {
            timeoutId = setTimeout(() => {
                this._callbacks = this._callbacks.filter((cb) => cb.timeoutId !== timeoutId);
                cb();
            }, timeout);
        }
        this._callbacks.push({ doneCb: cb, timeoutId: timeoutId, updateCb: updateCb });
    }
    /**
     * Wait for the application to be stable with a timeout. If the timeout is reached before that
     * happens, the callback receives a list of the macro tasks that were pending, otherwise null.
     *
     * @param doneCb The callback to invoke when Angular is stable or the timeout expires
     *    whichever comes first.
     * @param timeout Optional. The maximum time to wait for Angular to become stable. If not
     *    specified, whenStable() will wait forever.
     * @param updateCb Optional. If specified, this callback will be invoked whenever the set of
     *    pending macrotasks changes. If this callback returns true doneCb will not be invoked
     *    and no further updates will be issued.
     */
    whenStable(doneCb, timeout, updateCb) {
        if (updateCb && !this.taskTrackingZone) {
            throw new Error('Task tracking zone is required when passing an update callback to ' +
                'whenStable(). Is "zone.js/plugins/task-tracking" loaded?');
        }
        this.addCallback(doneCb, timeout, updateCb);
        this._runCallbacksIfReady();
    }
    /**
     * Registers an application with a testability hook so that it can be tracked.
     * @param token token of application, root element
     *
     * @internal
     */
    registerApplication(token) {
        this.registry.registerApplication(token, this);
    }
    /**
     * Unregisters an application.
     * @param token token of application, root element
     *
     * @internal
     */
    unregisterApplication(token) {
        this.registry.unregisterApplication(token);
    }
    /**
     * Find providers by name
     * @param using The root element to search from
     * @param provider The name of binding variable
     * @param exactMatch Whether using exactMatch
     */
    findProviders(using, provider, exactMatch) {
        // TODO(juliemr): implement.
        return [];
    }
    static { this.ɵfac = function Testability_Factory(t) { return new (t || Testability)(i0.ɵɵinject(i1.NgZone), i0.ɵɵinject(TestabilityRegistry), i0.ɵɵinject(TESTABILITY_GETTER)); }; }
    static { this.ɵprov = /*@__PURE__*/ i0.ɵɵdefineInjectable({ token: Testability, factory: Testability.ɵfac }); }
}
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.setClassMetadata(Testability, [{
        type: Injectable
    }], () => [{ type: i1.NgZone }, { type: TestabilityRegistry }, { type: undefined, decorators: [{
                type: Inject,
                args: [TESTABILITY_GETTER]
            }] }], null); })();
/**
 * A global registry of {@link Testability} instances for specific elements.
 * @publicApi
 */
export class TestabilityRegistry {
    constructor() {
        /** @internal */
        this._applications = new Map();
    }
    /**
     * Registers an application with a testability hook so that it can be tracked
     * @param token token of application, root element
     * @param testability Testability hook
     */
    registerApplication(token, testability) {
        this._applications.set(token, testability);
    }
    /**
     * Unregisters an application.
     * @param token token of application, root element
     */
    unregisterApplication(token) {
        this._applications.delete(token);
    }
    /**
     * Unregisters all applications
     */
    unregisterAllApplications() {
        this._applications.clear();
    }
    /**
     * Get a testability hook associated with the application
     * @param elem root element
     */
    getTestability(elem) {
        return this._applications.get(elem) || null;
    }
    /**
     * Get all registered testabilities
     */
    getAllTestabilities() {
        return Array.from(this._applications.values());
    }
    /**
     * Get all registered applications(root elements)
     */
    getAllRootElements() {
        return Array.from(this._applications.keys());
    }
    /**
     * Find testability of a node in the Tree
     * @param elem node
     * @param findInAncestors whether finding testability in ancestors if testability was not found in
     * current node
     */
    findTestabilityInTree(elem, findInAncestors = true) {
        return _testabilityGetter?.findTestabilityInTree(this, elem, findInAncestors) ?? null;
    }
    static { this.ɵfac = function TestabilityRegistry_Factory(t) { return new (t || TestabilityRegistry)(); }; }
    static { this.ɵprov = /*@__PURE__*/ i0.ɵɵdefineInjectable({ token: TestabilityRegistry, factory: TestabilityRegistry.ɵfac, providedIn: 'platform' }); }
}
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.setClassMetadata(TestabilityRegistry, [{
        type: Injectable,
        args: [{ providedIn: 'platform' }]
    }], null, null); })();
/**
 * Set the {@link GetTestability} implementation used by the Angular testing framework.
 * @publicApi
 */
export function setTestabilityGetter(getter) {
    _testabilityGetter = getter;
}
let _testabilityGetter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGFiaWxpdHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy90ZXN0YWJpbGl0eS90ZXN0YWJpbGl0eS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUMsTUFBTSxPQUFPLENBQUM7QUFDekQsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLGlCQUFpQixDQUFDOzs7QUFvQ3ZDOzs7Ozs7OztHQVFHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sV0FBVyxHQUFHLElBQUksY0FBYyxDQUFjLEVBQUUsQ0FBQyxDQUFDO0FBRS9EOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxjQUFjLENBQWlCLEVBQUUsQ0FBQyxDQUFDO0FBRXpFOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBbUJHO0FBRUgsTUFBTSxPQUFPLFdBQVc7SUFNdEIsWUFDVSxPQUFlLEVBQ2YsUUFBNkIsRUFDVCxpQkFBaUM7UUFGckQsWUFBTyxHQUFQLE9BQU8sQ0FBUTtRQUNmLGFBQVEsR0FBUixRQUFRLENBQXFCO1FBUC9CLGtCQUFhLEdBQVksSUFBSSxDQUFDO1FBQzlCLGVBQVUsR0FBbUIsRUFBRSxDQUFDO1FBRWhDLHFCQUFnQixHQUFnQyxJQUFJLENBQUM7UUFPM0QsbUVBQW1FO1FBQ25FLG1FQUFtRTtRQUNuRSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUN4QixvQkFBb0IsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQ3hDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMxQyxDQUFDO1FBQ0QsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7UUFDM0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUU7WUFDZixJQUFJLENBQUMsZ0JBQWdCO2dCQUNuQixP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RztJQUNILHFCQUFxQixDQUFDLElBQVUsRUFBRSxrQkFBMkIsSUFBSTtRQUMvRCxPQUFPLGtCQUFrQixFQUFFLHFCQUFxQixDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsZUFBZSxDQUFDLElBQUksSUFBSSxDQUFDO0lBQ3hGLENBQUM7b0ZBMURVLG1CQUFtQjt1RUFBbkIsbUJBQW1CLFdBQW5CLG1CQUFtQixtQkFEUCxVQUFVOztnRkFDdEIsbUJBQW1CO2NBRC9CLFVBQVU7ZUFBQyxFQUFDLFVBQVUsRUFBRSxVQUFVLEVBQUM7O0FBNkVwQzs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsTUFBc0I7SUFDekQsa0JBQWtCLEdBQUcsTUFBTSxDQUFDO0FBQzlCLENBQUM7QUFFRCxJQUFJLGtCQUE4QyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7SW5qZWN0LCBJbmplY3RhYmxlLCBJbmplY3Rpb25Ub2tlbn0gZnJvbSAnLi4vZGknO1xuaW1wb3J0IHtOZ1pvbmV9IGZyb20gJy4uL3pvbmUvbmdfem9uZSc7XG5cbi8qKlxuICogVGVzdGFiaWxpdHkgQVBJLlxuICogYGRlY2xhcmVgIGtleXdvcmQgY2F1c2VzIHRzaWNrbGUgdG8gZ2VuZXJhdGUgZXh0ZXJucywgc28gdGhlc2UgbWV0aG9kcyBhcmVcbiAqIG5vdCByZW5hbWVkIGJ5IENsb3N1cmUgQ29tcGlsZXIuXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBkZWNsYXJlIGludGVyZmFjZSBQdWJsaWNUZXN0YWJpbGl0eSB7XG4gIGlzU3RhYmxlKCk6IGJvb2xlYW47XG4gIHdoZW5TdGFibGUoY2FsbGJhY2s6IEZ1bmN0aW9uLCB0aW1lb3V0PzogbnVtYmVyLCB1cGRhdGVDYWxsYmFjaz86IEZ1bmN0aW9uKTogdm9pZDtcbiAgZmluZFByb3ZpZGVycyh1c2luZzogYW55LCBwcm92aWRlcjogc3RyaW5nLCBleGFjdE1hdGNoOiBib29sZWFuKTogYW55W107XG59XG5cbi8vIEFuZ3VsYXIgaW50ZXJuYWwsIG5vdCBpbnRlbmRlZCBmb3IgcHVibGljIEFQSS5cbmV4cG9ydCBpbnRlcmZhY2UgUGVuZGluZ01hY3JvdGFzayB7XG4gIHNvdXJjZTogc3RyaW5nO1xuICBjcmVhdGlvbkxvY2F0aW9uOiBFcnJvcjtcbiAgcnVuQ291bnQ/OiBudW1iZXI7XG4gIGRhdGE/OiBUYXNrRGF0YTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYXNrRGF0YSB7XG4gIHRhcmdldD86IFhNTEh0dHBSZXF1ZXN0O1xuICBkZWxheT86IG51bWJlcjtcbiAgaXNQZXJpb2RpYz86IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBXYWl0Q2FsbGJhY2sge1xuICAvLyBOZWVkcyB0byBiZSAnYW55JyAtIHNldFRpbWVvdXQgcmV0dXJucyBhIG51bWJlciBhY2NvcmRpbmcgdG8gRVM2LCBidXRcbiAgLy8gb24gTm9kZUpTIGl0IHJldHVybnMgYSBUaW1lci5cbiAgdGltZW91dElkOiBhbnk7XG4gIGRvbmVDYjogRnVuY3Rpb247XG4gIHVwZGF0ZUNiPzogRnVuY3Rpb247XG59XG5cbi8qKlxuICogSW50ZXJuYWwgaW5qZWN0aW9uIHRva2VuIHRoYXQgY2FuIHVzZWQgdG8gYWNjZXNzIGFuIGluc3RhbmNlIG9mIGEgVGVzdGFiaWxpdHkgY2xhc3MuXG4gKlxuICogVGhpcyB0b2tlbiBhY3RzIGFzIGEgYnJpZGdlIGJldHdlZW4gdGhlIGNvcmUgYm9vdHN0cmFwIGNvZGUgYW5kIHRoZSBgVGVzdGFiaWxpdHlgIGNsYXNzLiBUaGlzIGlzXG4gKiBuZWVkZWQgdG8gZW5zdXJlIHRoYXQgdGhlcmUgYXJlIG5vIGRpcmVjdCByZWZlcmVuY2VzIHRvIHRoZSBgVGVzdGFiaWxpdHlgIGNsYXNzLCBzbyBpdCBjYW4gYmVcbiAqIHRyZWUtc2hha2VuIGF3YXkgKGlmIG5vdCByZWZlcmVuY2VkKS4gRm9yIHRoZSBlbnZpcm9ubWVudHMvc2V0dXBzIHdoZW4gdGhlIGBUZXN0YWJpbGl0eWAgY2xhc3NcbiAqIHNob3VsZCBiZSBhdmFpbGFibGUsIHRoaXMgdG9rZW4gaXMgdXNlZCB0byBhZGQgYSBwcm92aWRlciB0aGF0IHJlZmVyZW5jZXMgdGhlIGBUZXN0YWJpbGl0eWBcbiAqIGNsYXNzLiBPdGhlcndpc2UsIG9ubHkgdGhpcyB0b2tlbiBpcyByZXRhaW5lZCBpbiBhIGJ1bmRsZSwgYnV0IHRoZSBgVGVzdGFiaWxpdHlgIGNsYXNzIGlzIG5vdC5cbiAqL1xuZXhwb3J0IGNvbnN0IFRFU1RBQklMSVRZID0gbmV3IEluamVjdGlvblRva2VuPFRlc3RhYmlsaXR5PignJyk7XG5cbi8qKlxuICogSW50ZXJuYWwgaW5qZWN0aW9uIHRva2VuIHRvIHJldHJpZXZlIFRlc3RhYmlsaXR5IGdldHRlciBjbGFzcyBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGNvbnN0IFRFU1RBQklMSVRZX0dFVFRFUiA9IG5ldyBJbmplY3Rpb25Ub2tlbjxHZXRUZXN0YWJpbGl0eT4oJycpO1xuXG4vKipcbiAqIFRoZSBUZXN0YWJpbGl0eSBzZXJ2aWNlIHByb3ZpZGVzIHRlc3RpbmcgaG9va3MgdGhhdCBjYW4gYmUgYWNjZXNzZWQgZnJvbVxuICogdGhlIGJyb3dzZXIuXG4gKlxuICogQW5ndWxhciBhcHBsaWNhdGlvbnMgYm9vdHN0cmFwcGVkIHVzaW5nIGFuIE5nTW9kdWxlICh2aWEgYEBOZ01vZHVsZS5ib290c3RyYXBgIGZpZWxkKSB3aWxsIGFsc29cbiAqIGluc3RhbnRpYXRlIFRlc3RhYmlsaXR5IGJ5IGRlZmF1bHQgKGluIGJvdGggZGV2ZWxvcG1lbnQgYW5kIHByb2R1Y3Rpb24gbW9kZXMpLlxuICpcbiAqIEZvciBhcHBsaWNhdGlvbnMgYm9vdHN0cmFwcGVkIHVzaW5nIHRoZSBgYm9vdHN0cmFwQXBwbGljYXRpb25gIGZ1bmN0aW9uLCBUZXN0YWJpbGl0eSBpcyBub3RcbiAqIGluY2x1ZGVkIGJ5IGRlZmF1bHQuIFlvdSBjYW4gaW5jbHVkZSBpdCBpbnRvIHlvdXIgYXBwbGljYXRpb25zIGJ5IGdldHRpbmcgdGhlIGxpc3Qgb2YgbmVjZXNzYXJ5XG4gKiBwcm92aWRlcnMgdXNpbmcgdGhlIGBwcm92aWRlUHJvdHJhY3RvclRlc3RpbmdTdXBwb3J0KClgIGZ1bmN0aW9uIGFuZCBhZGRpbmcgdGhlbSBpbnRvIHRoZVxuICogYG9wdGlvbnMucHJvdmlkZXJzYCBhcnJheS4gRXhhbXBsZTpcbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQge3Byb3ZpZGVQcm90cmFjdG9yVGVzdGluZ1N1cHBvcnR9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLWJyb3dzZXInO1xuICpcbiAqIGF3YWl0IGJvb3RzdHJhcEFwcGxpY2F0aW9uKFJvb3RDb21wb25lbnQsIHByb3ZpZGVyczogW3Byb3ZpZGVQcm90cmFjdG9yVGVzdGluZ1N1cHBvcnQoKV0pO1xuICogYGBgXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5ASW5qZWN0YWJsZSgpXG5leHBvcnQgY2xhc3MgVGVzdGFiaWxpdHkgaW1wbGVtZW50cyBQdWJsaWNUZXN0YWJpbGl0eSB7XG4gIHByaXZhdGUgX2lzWm9uZVN0YWJsZTogYm9vbGVhbiA9IHRydWU7XG4gIHByaXZhdGUgX2NhbGxiYWNrczogV2FpdENhbGxiYWNrW10gPSBbXTtcblxuICBwcml2YXRlIHRhc2tUcmFja2luZ1pvbmU6IHttYWNyb1Rhc2tzOiBUYXNrW119IHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBfbmdab25lOiBOZ1pvbmUsXG4gICAgcHJpdmF0ZSByZWdpc3RyeTogVGVzdGFiaWxpdHlSZWdpc3RyeSxcbiAgICBASW5qZWN0KFRFU1RBQklMSVRZX0dFVFRFUikgdGVzdGFiaWxpdHlHZXR0ZXI6IEdldFRlc3RhYmlsaXR5LFxuICApIHtcbiAgICAvLyBJZiB0aGVyZSB3YXMgbm8gVGVzdGFiaWxpdHkgbG9naWMgcmVnaXN0ZXJlZCBpbiB0aGUgZ2xvYmFsIHNjb3BlXG4gICAgLy8gYmVmb3JlLCByZWdpc3RlciB0aGUgY3VycmVudCB0ZXN0YWJpbGl0eSBnZXR0ZXIgYXMgYSBnbG9iYWwgb25lLlxuICAgIGlmICghX3Rlc3RhYmlsaXR5R2V0dGVyKSB7XG4gICAgICBzZXRUZXN0YWJpbGl0eUdldHRlcih0ZXN0YWJpbGl0eUdldHRlcik7XG4gICAgICB0ZXN0YWJpbGl0eUdldHRlci5hZGRUb1dpbmRvdyhyZWdpc3RyeSk7XG4gICAgfVxuICAgIHRoaXMuX3dhdGNoQW5ndWxhckV2ZW50cygpO1xuICAgIF9uZ1pvbmUucnVuKCgpID0+IHtcbiAgICAgIHRoaXMudGFza1RyYWNraW5nWm9uZSA9XG4gICAgICAgIHR5cGVvZiBab25lID09ICd1bmRlZmluZWQnID8gbnVsbCA6IFpvbmUuY3VycmVudC5nZXQoJ1Rhc2tUcmFja2luZ1pvbmUnKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX3dhdGNoQW5ndWxhckV2ZW50cygpOiB2b2lkIHtcbiAgICB0aGlzLl9uZ1pvbmUub25VbnN0YWJsZS5zdWJzY3JpYmUoe1xuICAgICAgbmV4dDogKCkgPT4ge1xuICAgICAgICB0aGlzLl9pc1pvbmVTdGFibGUgPSBmYWxzZTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLl9uZ1pvbmUucnVuT3V0c2lkZUFuZ3VsYXIoKCkgPT4ge1xuICAgICAgdGhpcy5fbmdab25lLm9uU3RhYmxlLnN1YnNjcmliZSh7XG4gICAgICAgIG5leHQ6ICgpID0+IHtcbiAgICAgICAgICBOZ1pvbmUuYXNzZXJ0Tm90SW5Bbmd1bGFyWm9uZSgpO1xuICAgICAgICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX2lzWm9uZVN0YWJsZSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9ydW5DYWxsYmFja3NJZlJlYWR5KCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXaGV0aGVyIGFuIGFzc29jaWF0ZWQgYXBwbGljYXRpb24gaXMgc3RhYmxlXG4gICAqL1xuICBpc1N0YWJsZSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5faXNab25lU3RhYmxlICYmICF0aGlzLl9uZ1pvbmUuaGFzUGVuZGluZ01hY3JvdGFza3M7XG4gIH1cblxuICBwcml2YXRlIF9ydW5DYWxsYmFja3NJZlJlYWR5KCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmlzU3RhYmxlKCkpIHtcbiAgICAgIC8vIFNjaGVkdWxlcyB0aGUgY2FsbCBiYWNrcyBpbiBhIG5ldyBmcmFtZSBzbyB0aGF0IGl0IGlzIGFsd2F5cyBhc3luYy5cbiAgICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IHtcbiAgICAgICAgd2hpbGUgKHRoaXMuX2NhbGxiYWNrcy5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICBsZXQgY2IgPSB0aGlzLl9jYWxsYmFja3MucG9wKCkhO1xuICAgICAgICAgIGNsZWFyVGltZW91dChjYi50aW1lb3V0SWQpO1xuICAgICAgICAgIGNiLmRvbmVDYigpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gU3RpbGwgbm90IHN0YWJsZSwgc2VuZCB1cGRhdGVzLlxuICAgICAgbGV0IHBlbmRpbmcgPSB0aGlzLmdldFBlbmRpbmdUYXNrcygpO1xuICAgICAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzLmZpbHRlcigoY2IpID0+IHtcbiAgICAgICAgaWYgKGNiLnVwZGF0ZUNiICYmIGNiLnVwZGF0ZUNiKHBlbmRpbmcpKSB7XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KGNiLnRpbWVvdXRJZCk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldFBlbmRpbmdUYXNrcygpOiBQZW5kaW5nTWFjcm90YXNrW10ge1xuICAgIGlmICghdGhpcy50YXNrVHJhY2tpbmdab25lKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgLy8gQ29weSB0aGUgdGFza3MgZGF0YSBzbyB0aGF0IHdlIGRvbid0IGxlYWsgdGFza3MuXG4gICAgcmV0dXJuIHRoaXMudGFza1RyYWNraW5nWm9uZS5tYWNyb1Rhc2tzLm1hcCgodDogVGFzaykgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlOiB0LnNvdXJjZSxcbiAgICAgICAgLy8gRnJvbSBUYXNrVHJhY2tpbmdab25lOlxuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci96b25lLmpzL2Jsb2IvbWFzdGVyL2xpYi96b25lLXNwZWMvdGFzay10cmFja2luZy50cyNMNDBcbiAgICAgICAgY3JlYXRpb25Mb2NhdGlvbjogKHQgYXMgYW55KS5jcmVhdGlvbkxvY2F0aW9uIGFzIEVycm9yLFxuICAgICAgICBkYXRhOiB0LmRhdGEsXG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhZGRDYWxsYmFjayhjYjogRnVuY3Rpb24sIHRpbWVvdXQ/OiBudW1iZXIsIHVwZGF0ZUNiPzogRnVuY3Rpb24pIHtcbiAgICBsZXQgdGltZW91dElkOiBhbnkgPSAtMTtcbiAgICBpZiAodGltZW91dCAmJiB0aW1lb3V0ID4gMCkge1xuICAgICAgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcy5maWx0ZXIoKGNiKSA9PiBjYi50aW1lb3V0SWQgIT09IHRpbWVvdXRJZCk7XG4gICAgICAgIGNiKCk7XG4gICAgICB9LCB0aW1lb3V0KTtcbiAgICB9XG4gICAgdGhpcy5fY2FsbGJhY2tzLnB1c2goPFdhaXRDYWxsYmFjaz57ZG9uZUNiOiBjYiwgdGltZW91dElkOiB0aW1lb3V0SWQsIHVwZGF0ZUNiOiB1cGRhdGVDYn0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFdhaXQgZm9yIHRoZSBhcHBsaWNhdGlvbiB0byBiZSBzdGFibGUgd2l0aCBhIHRpbWVvdXQuIElmIHRoZSB0aW1lb3V0IGlzIHJlYWNoZWQgYmVmb3JlIHRoYXRcbiAgICogaGFwcGVucywgdGhlIGNhbGxiYWNrIHJlY2VpdmVzIGEgbGlzdCBvZiB0aGUgbWFjcm8gdGFza3MgdGhhdCB3ZXJlIHBlbmRpbmcsIG90aGVyd2lzZSBudWxsLlxuICAgKlxuICAgKiBAcGFyYW0gZG9uZUNiIFRoZSBjYWxsYmFjayB0byBpbnZva2Ugd2hlbiBBbmd1bGFyIGlzIHN0YWJsZSBvciB0aGUgdGltZW91dCBleHBpcmVzXG4gICAqICAgIHdoaWNoZXZlciBjb21lcyBmaXJzdC5cbiAgICogQHBhcmFtIHRpbWVvdXQgT3B0aW9uYWwuIFRoZSBtYXhpbXVtIHRpbWUgdG8gd2FpdCBmb3IgQW5ndWxhciB0byBiZWNvbWUgc3RhYmxlLiBJZiBub3RcbiAgICogICAgc3BlY2lmaWVkLCB3aGVuU3RhYmxlKCkgd2lsbCB3YWl0IGZvcmV2ZXIuXG4gICAqIEBwYXJhbSB1cGRhdGVDYiBPcHRpb25hbC4gSWYgc3BlY2lmaWVkLCB0aGlzIGNhbGxiYWNrIHdpbGwgYmUgaW52b2tlZCB3aGVuZXZlciB0aGUgc2V0IG9mXG4gICAqICAgIHBlbmRpbmcgbWFjcm90YXNrcyBjaGFuZ2VzLiBJZiB0aGlzIGNhbGxiYWNrIHJldHVybnMgdHJ1ZSBkb25lQ2Igd2lsbCBub3QgYmUgaW52b2tlZFxuICAgKiAgICBhbmQgbm8gZnVydGhlciB1cGRhdGVzIHdpbGwgYmUgaXNzdWVkLlxuICAgKi9cbiAgd2hlblN0YWJsZShkb25lQ2I6IEZ1bmN0aW9uLCB0aW1lb3V0PzogbnVtYmVyLCB1cGRhdGVDYj86IEZ1bmN0aW9uKTogdm9pZCB7XG4gICAgaWYgKHVwZGF0ZUNiICYmICF0aGlzLnRhc2tUcmFja2luZ1pvbmUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ1Rhc2sgdHJhY2tpbmcgem9uZSBpcyByZXF1aXJlZCB3aGVuIHBhc3NpbmcgYW4gdXBkYXRlIGNhbGxiYWNrIHRvICcgK1xuICAgICAgICAgICd3aGVuU3RhYmxlKCkuIElzIFwiem9uZS5qcy9wbHVnaW5zL3Rhc2stdHJhY2tpbmdcIiBsb2FkZWQ/JyxcbiAgICAgICk7XG4gICAgfVxuICAgIHRoaXMuYWRkQ2FsbGJhY2soZG9uZUNiLCB0aW1lb3V0LCB1cGRhdGVDYik7XG4gICAgdGhpcy5fcnVuQ2FsbGJhY2tzSWZSZWFkeSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBhbiBhcHBsaWNhdGlvbiB3aXRoIGEgdGVzdGFiaWxpdHkgaG9vayBzbyB0aGF0IGl0IGNhbiBiZSB0cmFja2VkLlxuICAgKiBAcGFyYW0gdG9rZW4gdG9rZW4gb2YgYXBwbGljYXRpb24sIHJvb3QgZWxlbWVudFxuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIHJlZ2lzdGVyQXBwbGljYXRpb24odG9rZW46IGFueSkge1xuICAgIHRoaXMucmVnaXN0cnkucmVnaXN0ZXJBcHBsaWNhdGlvbih0b2tlbiwgdGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogVW5yZWdpc3RlcnMgYW4gYXBwbGljYXRpb24uXG4gICAqIEBwYXJhbSB0b2tlbiB0b2tlbiBvZiBhcHBsaWNhdGlvbiwgcm9vdCBlbGVtZW50XG4gICAqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgdW5yZWdpc3RlckFwcGxpY2F0aW9uKHRva2VuOiBhbnkpIHtcbiAgICB0aGlzLnJlZ2lzdHJ5LnVucmVnaXN0ZXJBcHBsaWNhdGlvbih0b2tlbik7XG4gIH1cblxuICAvKipcbiAgICogRmluZCBwcm92aWRlcnMgYnkgbmFtZVxuICAgKiBAcGFyYW0gdXNpbmcgVGhlIHJvb3QgZWxlbWVudCB0byBzZWFyY2ggZnJvbVxuICAgKiBAcGFyYW0gcHJvdmlkZXIgVGhlIG5hbWUgb2YgYmluZGluZyB2YXJpYWJsZVxuICAgKiBAcGFyYW0gZXhhY3RNYXRjaCBXaGV0aGVyIHVzaW5nIGV4YWN0TWF0Y2hcbiAgICovXG4gIGZpbmRQcm92aWRlcnModXNpbmc6IGFueSwgcHJvdmlkZXI6IHN0cmluZywgZXhhY3RNYXRjaDogYm9vbGVhbik6IGFueVtdIHtcbiAgICAvLyBUT0RPKGp1bGllbXIpOiBpbXBsZW1lbnQuXG4gICAgcmV0dXJuIFtdO1xuICB9XG59XG5cbi8qKlxuICogQSBnbG9iYWwgcmVnaXN0cnkgb2Yge0BsaW5rIFRlc3RhYmlsaXR5fSBpbnN0YW5jZXMgZm9yIHNwZWNpZmljIGVsZW1lbnRzLlxuICogQHB1YmxpY0FwaVxuICovXG5ASW5qZWN0YWJsZSh7cHJvdmlkZWRJbjogJ3BsYXRmb3JtJ30pXG5leHBvcnQgY2xhc3MgVGVzdGFiaWxpdHlSZWdpc3RyeSB7XG4gIC8qKiBAaW50ZXJuYWwgKi9cbiAgX2FwcGxpY2F0aW9ucyA9IG5ldyBNYXA8YW55LCBUZXN0YWJpbGl0eT4oKTtcblxuICAvKipcbiAgICogUmVnaXN0ZXJzIGFuIGFwcGxpY2F0aW9uIHdpdGggYSB0ZXN0YWJpbGl0eSBob29rIHNvIHRoYXQgaXQgY2FuIGJlIHRyYWNrZWRcbiAgICogQHBhcmFtIHRva2VuIHRva2VuIG9mIGFwcGxpY2F0aW9uLCByb290IGVsZW1lbnRcbiAgICogQHBhcmFtIHRlc3RhYmlsaXR5IFRlc3RhYmlsaXR5IGhvb2tcbiAgICovXG4gIHJlZ2lzdGVyQXBwbGljYXRpb24odG9rZW46IGFueSwgdGVzdGFiaWxpdHk6IFRlc3RhYmlsaXR5KSB7XG4gICAgdGhpcy5fYXBwbGljYXRpb25zLnNldCh0b2tlbiwgdGVzdGFiaWxpdHkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVucmVnaXN0ZXJzIGFuIGFwcGxpY2F0aW9uLlxuICAgKiBAcGFyYW0gdG9rZW4gdG9rZW4gb2YgYXBwbGljYXRpb24sIHJvb3QgZWxlbWVudFxuICAgKi9cbiAgdW5yZWdpc3RlckFwcGxpY2F0aW9uKHRva2VuOiBhbnkpIHtcbiAgICB0aGlzLl9hcHBsaWNhdGlvbnMuZGVsZXRlKHRva2VuKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVbnJlZ2lzdGVycyBhbGwgYXBwbGljYXRpb25zXG4gICAqL1xuICB1bnJlZ2lzdGVyQWxsQXBwbGljYXRpb25zKCkge1xuICAgIHRoaXMuX2FwcGxpY2F0aW9ucy5jbGVhcigpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHRlc3RhYmlsaXR5IGhvb2sgYXNzb2NpYXRlZCB3aXRoIHRoZSBhcHBsaWNhdGlvblxuICAgKiBAcGFyYW0gZWxlbSByb290IGVsZW1lbnRcbiAgICovXG4gIGdldFRlc3RhYmlsaXR5KGVsZW06IGFueSk6IFRlc3RhYmlsaXR5IHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX2FwcGxpY2F0aW9ucy5nZXQoZWxlbSkgfHwgbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYWxsIHJlZ2lzdGVyZWQgdGVzdGFiaWxpdGllc1xuICAgKi9cbiAgZ2V0QWxsVGVzdGFiaWxpdGllcygpOiBUZXN0YWJpbGl0eVtdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLl9hcHBsaWNhdGlvbnMudmFsdWVzKCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhbGwgcmVnaXN0ZXJlZCBhcHBsaWNhdGlvbnMocm9vdCBlbGVtZW50cylcbiAgICovXG4gIGdldEFsbFJvb3RFbGVtZW50cygpOiBhbnlbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5fYXBwbGljYXRpb25zLmtleXMoKSk7XG4gIH1cblxuICAvKipcbiAgICogRmluZCB0ZXN0YWJpbGl0eSBvZiBhIG5vZGUgaW4gdGhlIFRyZWVcbiAgICogQHBhcmFtIGVsZW0gbm9kZVxuICAgKiBAcGFyYW0gZmluZEluQW5jZXN0b3JzIHdoZXRoZXIgZmluZGluZyB0ZXN0YWJpbGl0eSBpbiBhbmNlc3RvcnMgaWYgdGVzdGFiaWxpdHkgd2FzIG5vdCBmb3VuZCBpblxuICAgKiBjdXJyZW50IG5vZGVcbiAgICovXG4gIGZpbmRUZXN0YWJpbGl0eUluVHJlZShlbGVtOiBOb2RlLCBmaW5kSW5BbmNlc3RvcnM6IGJvb2xlYW4gPSB0cnVlKTogVGVzdGFiaWxpdHkgfCBudWxsIHtcbiAgICByZXR1cm4gX3Rlc3RhYmlsaXR5R2V0dGVyPy5maW5kVGVzdGFiaWxpdHlJblRyZWUodGhpcywgZWxlbSwgZmluZEluQW5jZXN0b3JzKSA/PyBudWxsO1xuICB9XG59XG5cbi8qKlxuICogQWRhcHRlciBpbnRlcmZhY2UgZm9yIHJldHJpZXZpbmcgdGhlIGBUZXN0YWJpbGl0eWAgc2VydmljZSBhc3NvY2lhdGVkIGZvciBhXG4gKiBwYXJ0aWN1bGFyIGNvbnRleHQuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEdldFRlc3RhYmlsaXR5IHtcbiAgYWRkVG9XaW5kb3cocmVnaXN0cnk6IFRlc3RhYmlsaXR5UmVnaXN0cnkpOiB2b2lkO1xuICBmaW5kVGVzdGFiaWxpdHlJblRyZWUoXG4gICAgcmVnaXN0cnk6IFRlc3RhYmlsaXR5UmVnaXN0cnksXG4gICAgZWxlbTogYW55LFxuICAgIGZpbmRJbkFuY2VzdG9yczogYm9vbGVhbixcbiAgKTogVGVzdGFiaWxpdHkgfCBudWxsO1xufVxuXG4vKipcbiAqIFNldCB0aGUge0BsaW5rIEdldFRlc3RhYmlsaXR5fSBpbXBsZW1lbnRhdGlvbiB1c2VkIGJ5IHRoZSBBbmd1bGFyIHRlc3RpbmcgZnJhbWV3b3JrLlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0VGVzdGFiaWxpdHlHZXR0ZXIoZ2V0dGVyOiBHZXRUZXN0YWJpbGl0eSk6IHZvaWQge1xuICBfdGVzdGFiaWxpdHlHZXR0ZXIgPSBnZXR0ZXI7XG59XG5cbmxldCBfdGVzdGFiaWxpdHlHZXR0ZXI6IEdldFRlc3RhYmlsaXR5IHwgdW5kZWZpbmVkO1xuIl19