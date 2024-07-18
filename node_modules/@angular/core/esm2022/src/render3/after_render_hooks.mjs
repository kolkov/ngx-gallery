/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ChangeDetectionScheduler, } from '../change_detection/scheduling/zoneless_scheduling';
import { Injector, assertInInjectionContext, runInInjectionContext, ɵɵdefineInjectable } from '../di';
import { inject } from '../di/injector_compatibility';
import { ErrorHandler } from '../error_handler';
import { DestroyRef } from '../linker/destroy_ref';
import { assertNotInReactiveContext } from '../render3/reactivity/asserts';
import { performanceMarkFeature } from '../util/performance';
import { NgZone } from '../zone/ng_zone';
import { isPlatformBrowser } from './util/misc_utils';
/**
 * The phase to run an `afterRender` or `afterNextRender` callback in.
 *
 * Callbacks in the same phase run in the order they are registered. Phases run in the
 * following order after each render:
 *
 *   1. `AfterRenderPhase.EarlyRead`
 *   2. `AfterRenderPhase.Write`
 *   3. `AfterRenderPhase.MixedReadWrite`
 *   4. `AfterRenderPhase.Read`
 *
 * Angular is unable to verify or enforce that phases are used correctly, and instead
 * relies on each developer to follow the guidelines documented for each value and
 * carefully choose the appropriate one, refactoring their code if necessary. By doing
 * so, Angular is better able to minimize the performance degradation associated with
 * manual DOM access, ensuring the best experience for the end users of your application
 * or library.
 *
 * @deprecated Specify the phase for your callback to run in by passing a spec-object as the first
 *   parameter to `afterRender` or `afterNextRender` instead of a function.
 */
export var AfterRenderPhase;
(function (AfterRenderPhase) {
    /**
     * Use `AfterRenderPhase.EarlyRead` for callbacks that only need to **read** from the
     * DOM before a subsequent `AfterRenderPhase.Write` callback, for example to perform
     * custom layout that the browser doesn't natively support. Prefer the
     * `AfterRenderPhase.EarlyRead` phase if reading can wait until after the write phase.
     * **Never** write to the DOM in this phase.
     *
     * <div class="alert is-important">
     *
     * Using this value can degrade performance.
     * Instead, prefer using built-in browser functionality when possible.
     *
     * </div>
     */
    AfterRenderPhase[AfterRenderPhase["EarlyRead"] = 0] = "EarlyRead";
    /**
     * Use `AfterRenderPhase.Write` for callbacks that only **write** to the DOM. **Never**
     * read from the DOM in this phase.
     */
    AfterRenderPhase[AfterRenderPhase["Write"] = 1] = "Write";
    /**
     * Use `AfterRenderPhase.MixedReadWrite` for callbacks that read from or write to the
     * DOM, that haven't been refactored to use a different phase. **Never** use this phase if
     * it is possible to divide the work among the other phases instead.
     *
     * <div class="alert is-critical">
     *
     * Using this value can **significantly** degrade performance.
     * Instead, prefer dividing work into the appropriate phase callbacks.
     *
     * </div>
     */
    AfterRenderPhase[AfterRenderPhase["MixedReadWrite"] = 2] = "MixedReadWrite";
    /**
     * Use `AfterRenderPhase.Read` for callbacks that only **read** from the DOM. **Never**
     * write to the DOM in this phase.
     */
    AfterRenderPhase[AfterRenderPhase["Read"] = 3] = "Read";
})(AfterRenderPhase || (AfterRenderPhase = {}));
/** `AfterRenderRef` that does nothing. */
const NOOP_AFTER_RENDER_REF = {
    destroy() { },
};
/**
 * Register a callback to run once before any userspace `afterRender` or
 * `afterNextRender` callbacks.
 *
 * This function should almost always be used instead of `afterRender` or
 * `afterNextRender` for implementing framework functionality. Consider:
 *
 *   1.) `AfterRenderPhase.EarlyRead` is intended to be used for implementing
 *       custom layout. If the framework itself mutates the DOM after *any*
 *       `AfterRenderPhase.EarlyRead` callbacks are run, the phase can no
 *       longer reliably serve its purpose.
 *
 *   2.) Importing `afterRender` in the framework can reduce the ability for it
 *       to be tree-shaken, and the framework shouldn't need much of the behavior.
 */
export function internalAfterNextRender(callback, options) {
    const injector = options?.injector ?? inject(Injector);
    // Similarly to the public `afterNextRender` function, an internal one
    // is only invoked in a browser as long as the runOnServer option is not set.
    if (!options?.runOnServer && !isPlatformBrowser(injector))
        return;
    const afterRenderEventManager = injector.get(AfterRenderEventManager);
    afterRenderEventManager.internalCallbacks.push(callback);
}
export function afterRender(callbackOrSpec, options) {
    ngDevMode &&
        assertNotInReactiveContext(afterRender, 'Call `afterRender` outside of a reactive context. For example, schedule the render ' +
            'callback inside the component constructor`.');
    !options && assertInInjectionContext(afterRender);
    const injector = options?.injector ?? inject(Injector);
    if (!isPlatformBrowser(injector)) {
        return NOOP_AFTER_RENDER_REF;
    }
    performanceMarkFeature('NgAfterRender');
    return afterRenderImpl(callbackOrSpec, injector, 
    /* once */ false, options?.phase ?? AfterRenderPhase.MixedReadWrite);
}
export function afterNextRender(callbackOrSpec, options) {
    !options && assertInInjectionContext(afterNextRender);
    const injector = options?.injector ?? inject(Injector);
    if (!isPlatformBrowser(injector)) {
        return NOOP_AFTER_RENDER_REF;
    }
    performanceMarkFeature('NgAfterNextRender');
    return afterRenderImpl(callbackOrSpec, injector, 
    /* once */ true, options?.phase ?? AfterRenderPhase.MixedReadWrite);
}
function getSpec(callbackOrSpec, phase) {
    if (callbackOrSpec instanceof Function) {
        switch (phase) {
            case AfterRenderPhase.EarlyRead:
                return { earlyRead: callbackOrSpec };
            case AfterRenderPhase.Write:
                return { write: callbackOrSpec };
            case AfterRenderPhase.MixedReadWrite:
                return { mixedReadWrite: callbackOrSpec };
            case AfterRenderPhase.Read:
                return { read: callbackOrSpec };
        }
    }
    return callbackOrSpec;
}
/**
 * Shared implementation for `afterRender` and `afterNextRender`.
 */
function afterRenderImpl(callbackOrSpec, injector, once, phase) {
    const spec = getSpec(callbackOrSpec, phase);
    const afterRenderEventManager = injector.get(AfterRenderEventManager);
    // Lazily initialize the handler implementation, if necessary. This is so that it can be
    // tree-shaken if `afterRender` and `afterNextRender` aren't used.
    const callbackHandler = (afterRenderEventManager.handler ??=
        new AfterRenderCallbackHandlerImpl());
    const pipelinedArgs = [];
    const instances = [];
    const destroy = () => {
        for (const instance of instances) {
            callbackHandler.unregister(instance);
        }
        unregisterFn();
    };
    const unregisterFn = injector.get(DestroyRef).onDestroy(destroy);
    let callbacksLeftToRun = 0;
    const registerCallback = (phase, phaseCallback) => {
        if (!phaseCallback) {
            return;
        }
        const callback = once
            ? (...args) => {
                callbacksLeftToRun--;
                if (callbacksLeftToRun < 1) {
                    destroy();
                }
                phaseCallback(...args);
            }
            : phaseCallback;
        const instance = runInInjectionContext(injector, () => new AfterRenderCallback(phase, pipelinedArgs, callback));
        callbackHandler.register(instance);
        instances.push(instance);
        callbacksLeftToRun++;
    };
    registerCallback(AfterRenderPhase.EarlyRead, spec.earlyRead);
    registerCallback(AfterRenderPhase.Write, spec.write);
    registerCallback(AfterRenderPhase.MixedReadWrite, spec.mixedReadWrite);
    registerCallback(AfterRenderPhase.Read, spec.read);
    return { destroy };
}
/**
 * A wrapper around a function to be used as an after render callback.
 */
class AfterRenderCallback {
    constructor(phase, pipelinedArgs, callbackFn) {
        this.phase = phase;
        this.pipelinedArgs = pipelinedArgs;
        this.callbackFn = callbackFn;
        this.zone = inject(NgZone);
        this.errorHandler = inject(ErrorHandler, { optional: true });
        // Registering a callback will notify the scheduler.
        inject(ChangeDetectionScheduler, { optional: true })?.notify(6 /* NotificationSource.NewRenderHook */);
    }
    invoke() {
        try {
            const result = this.zone.runOutsideAngular(() => this.callbackFn.apply(null, this.pipelinedArgs));
            // Clear out the args and add the result which will be passed to the next phase.
            this.pipelinedArgs.splice(0, this.pipelinedArgs.length, result);
        }
        catch (err) {
            this.errorHandler?.handleError(err);
        }
    }
}
/**
 * Core functionality for `afterRender` and `afterNextRender`. Kept separate from
 * `AfterRenderEventManager` for tree-shaking.
 */
class AfterRenderCallbackHandlerImpl {
    constructor() {
        this.executingCallbacks = false;
        this.buckets = {
            // Note: the order of these keys controls the order the phases are run.
            [AfterRenderPhase.EarlyRead]: new Set(),
            [AfterRenderPhase.Write]: new Set(),
            [AfterRenderPhase.MixedReadWrite]: new Set(),
            [AfterRenderPhase.Read]: new Set(),
        };
        this.deferredCallbacks = new Set();
    }
    register(callback) {
        // If we're currently running callbacks, new callbacks should be deferred
        // until the next render operation.
        const target = this.executingCallbacks ? this.deferredCallbacks : this.buckets[callback.phase];
        target.add(callback);
    }
    unregister(callback) {
        this.buckets[callback.phase].delete(callback);
        this.deferredCallbacks.delete(callback);
    }
    execute() {
        this.executingCallbacks = true;
        for (const bucket of Object.values(this.buckets)) {
            for (const callback of bucket) {
                callback.invoke();
            }
        }
        this.executingCallbacks = false;
        for (const callback of this.deferredCallbacks) {
            this.buckets[callback.phase].add(callback);
        }
        this.deferredCallbacks.clear();
    }
    destroy() {
        for (const bucket of Object.values(this.buckets)) {
            bucket.clear();
        }
        this.deferredCallbacks.clear();
    }
}
/**
 * Implements core timing for `afterRender` and `afterNextRender` events.
 * Delegates to an optional `AfterRenderCallbackHandler` for implementation.
 */
export class AfterRenderEventManager {
    constructor() {
        /* @internal */
        this.handler = null;
        /* @internal */
        this.internalCallbacks = [];
    }
    /**
     * Executes internal and user-provided callbacks.
     */
    execute() {
        this.executeInternalCallbacks();
        this.handler?.execute();
    }
    executeInternalCallbacks() {
        // Note: internal callbacks power `internalAfterNextRender`. Since internal callbacks
        // are fairly trivial, they are kept separate so that `AfterRenderCallbackHandlerImpl`
        // can still be tree-shaken unless used by the application.
        const callbacks = [...this.internalCallbacks];
        this.internalCallbacks.length = 0;
        for (const callback of callbacks) {
            callback();
        }
    }
    ngOnDestroy() {
        this.handler?.destroy();
        this.handler = null;
        this.internalCallbacks.length = 0;
    }
    /** @nocollapse */
    static { this.ɵprov = ɵɵdefineInjectable({
        token: AfterRenderEventManager,
        providedIn: 'root',
        factory: () => new AfterRenderEventManager(),
    }); }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWZ0ZXJfcmVuZGVyX2hvb2tzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9hZnRlcl9yZW5kZXJfaG9va3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUNMLHdCQUF3QixHQUV6QixNQUFNLG9EQUFvRCxDQUFDO0FBQzVELE9BQU8sRUFBQyxRQUFRLEVBQUUsd0JBQXdCLEVBQUUscUJBQXFCLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSxPQUFPLENBQUM7QUFDcEcsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBQ3BELE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUM5QyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFDLDBCQUEwQixFQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDekUsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDM0QsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLGlCQUFpQixDQUFDO0FBRXZDLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBWXBEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW9CRztBQUNILE1BQU0sQ0FBTixJQUFZLGdCQTBDWDtBQTFDRCxXQUFZLGdCQUFnQjtJQUMxQjs7Ozs7Ozs7Ozs7OztPQWFHO0lBQ0gsaUVBQVMsQ0FBQTtJQUVUOzs7T0FHRztJQUNILHlEQUFLLENBQUE7SUFFTDs7Ozs7Ozs7Ozs7T0FXRztJQUNILDJFQUFjLENBQUE7SUFFZDs7O09BR0c7SUFDSCx1REFBSSxDQUFBO0FBQ04sQ0FBQyxFQTFDVyxnQkFBZ0IsS0FBaEIsZ0JBQWdCLFFBMEMzQjtBQTZERCwwQ0FBMEM7QUFDMUMsTUFBTSxxQkFBcUIsR0FBbUI7SUFD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QUFlO1FBQ2Ysc0JBQWlCLEdBQW1CLEVBQUUsQ0FBQztJQWlDekMsQ0FBQztJQS9CQzs7T0FFRztJQUNILE9BQU87UUFDTCxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztRQUNoQyxJQUFJLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDO0lBQzFCLENBQUM7SUFFRCx3QkFBd0I7UUFDdEIscUZBQXFGO1FBQ3JGLHNGQUFzRjtRQUN0RiwyREFBMkQ7UUFDM0QsTUFBTSxTQUFTLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQzlDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBQ2xDLEtBQUssTUFBTSxRQUFRLElBQUksU0FBUyxFQUFFLENBQUM7WUFDakMsUUFBUSxFQUFFLENBQUM7UUFDYixDQUFDO0lBQ0gsQ0FBQztJQUVELFdBQVc7UUFDVCxJQUFJLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO1FBQ3BCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxrQkFBa0I7YUFDWCxVQUFLLEdBQTZCLGtCQUFrQixDQUFDO1FBQzFELEtBQUssRUFBRSx1QkFBdUI7UUFDOUIsVUFBVSxFQUFFLE1BQU07UUFDbEIsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksdUJBQXVCLEVBQUU7S0FDN0MsQ0FBQyxBQUpVLENBSVQiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgQ2hhbmdlRGV0ZWN0aW9uU2NoZWR1bGVyLFxuICBOb3RpZmljYXRpb25Tb3VyY2UsXG59IGZyb20gJy4uL2NoYW5nZV9kZXRlY3Rpb24vc2NoZWR1bGluZy96b25lbGVzc19zY2hlZHVsaW5nJztcbmltcG9ydCB7SW5qZWN0b3IsIGFzc2VydEluSW5qZWN0aW9uQ29udGV4dCwgcnVuSW5JbmplY3Rpb25Db250ZXh0LCDJtcm1ZGVmaW5lSW5qZWN0YWJsZX0gZnJvbSAnLi4vZGknO1xuaW1wb3J0IHtpbmplY3R9IGZyb20gJy4uL2RpL2luamVjdG9yX2NvbXBhdGliaWxpdHknO1xuaW1wb3J0IHtFcnJvckhhbmRsZXJ9IGZyb20gJy4uL2Vycm9yX2hhbmRsZXInO1xuaW1wb3J0IHtEZXN0cm95UmVmfSBmcm9tICcuLi9saW5rZXIvZGVzdHJveV9yZWYnO1xuaW1wb3J0IHthc3NlcnROb3RJblJlYWN0aXZlQ29udGV4dH0gZnJvbSAnLi4vcmVuZGVyMy9yZWFjdGl2aXR5L2Fzc2VydHMnO1xuaW1wb3J0IHtwZXJmb3JtYW5jZU1hcmtGZWF0dXJlfSBmcm9tICcuLi91dGlsL3BlcmZvcm1hbmNlJztcbmltcG9ydCB7Tmdab25lfSBmcm9tICcuLi96b25lL25nX3pvbmUnO1xuXG5pbXBvcnQge2lzUGxhdGZvcm1Ccm93c2VyfSBmcm9tICcuL3V0aWwvbWlzY191dGlscyc7XG5cbi8qKlxuICogQW4gYXJndW1lbnQgbGlzdCBjb250YWluaW5nIHRoZSBmaXJzdCBub24tbmV2ZXIgdHlwZSBpbiB0aGUgZ2l2ZW4gdHlwZSBhcnJheSwgb3IgYW4gZW1wdHlcbiAqIGFyZ3VtZW50IGxpc3QgaWYgdGhlcmUgYXJlIG5vIG5vbi1uZXZlciB0eXBlcyBpbiB0aGUgdHlwZSBhcnJheS5cbiAqL1xuZXhwb3J0IHR5cGUgybVGaXJzdEF2YWlsYWJsZTxUIGV4dGVuZHMgdW5rbm93bltdPiA9IFQgZXh0ZW5kcyBbaW5mZXIgSCwgLi4uaW5mZXIgUl1cbiAgPyBbSF0gZXh0ZW5kcyBbbmV2ZXJdXG4gICAgPyDJtUZpcnN0QXZhaWxhYmxlPFI+XG4gICAgOiBbSF1cbiAgOiBbXTtcblxuLyoqXG4gKiBUaGUgcGhhc2UgdG8gcnVuIGFuIGBhZnRlclJlbmRlcmAgb3IgYGFmdGVyTmV4dFJlbmRlcmAgY2FsbGJhY2sgaW4uXG4gKlxuICogQ2FsbGJhY2tzIGluIHRoZSBzYW1lIHBoYXNlIHJ1biBpbiB0aGUgb3JkZXIgdGhleSBhcmUgcmVnaXN0ZXJlZC4gUGhhc2VzIHJ1biBpbiB0aGVcbiAqIGZvbGxvd2luZyBvcmRlciBhZnRlciBlYWNoIHJlbmRlcjpcbiAqXG4gKiAgIDEuIGBBZnRlclJlbmRlclBoYXNlLkVhcmx5UmVhZGBcbiAqICAgMi4gYEFmdGVyUmVuZGVyUGhhc2UuV3JpdGVgXG4gKiAgIDMuIGBBZnRlclJlbmRlclBoYXNlLk1peGVkUmVhZFdyaXRlYFxuICogICA0LiBgQWZ0ZXJSZW5kZXJQaGFzZS5SZWFkYFxuICpcbiAqIEFuZ3VsYXIgaXMgdW5hYmxlIHRvIHZlcmlmeSBvciBlbmZvcmNlIHRoYXQgcGhhc2VzIGFyZSB1c2VkIGNvcnJlY3RseSwgYW5kIGluc3RlYWRcbiAqIHJlbGllcyBvbiBlYWNoIGRldmVsb3BlciB0byBmb2xsb3cgdGhlIGd1aWRlbGluZXMgZG9jdW1lbnRlZCBmb3IgZWFjaCB2YWx1ZSBhbmRcbiAqIGNhcmVmdWxseSBjaG9vc2UgdGhlIGFwcHJvcHJpYXRlIG9uZSwgcmVmYWN0b3JpbmcgdGhlaXIgY29kZSBpZiBuZWNlc3NhcnkuIEJ5IGRvaW5nXG4gKiBzbywgQW5ndWxhciBpcyBiZXR0ZXIgYWJsZSB0byBtaW5pbWl6ZSB0aGUgcGVyZm9ybWFuY2UgZGVncmFkYXRpb24gYXNzb2NpYXRlZCB3aXRoXG4gKiBtYW51YWwgRE9NIGFjY2VzcywgZW5zdXJpbmcgdGhlIGJlc3QgZXhwZXJpZW5jZSBmb3IgdGhlIGVuZCB1c2VycyBvZiB5b3VyIGFwcGxpY2F0aW9uXG4gKiBvciBsaWJyYXJ5LlxuICpcbiAqIEBkZXByZWNhdGVkIFNwZWNpZnkgdGhlIHBoYXNlIGZvciB5b3VyIGNhbGxiYWNrIHRvIHJ1biBpbiBieSBwYXNzaW5nIGEgc3BlYy1vYmplY3QgYXMgdGhlIGZpcnN0XG4gKiAgIHBhcmFtZXRlciB0byBgYWZ0ZXJSZW5kZXJgIG9yIGBhZnRlck5leHRSZW5kZXJgIGluc3RlYWQgb2YgYSBmdW5jdGlvbi5cbiAqL1xuZXhwb3J0IGVudW0gQWZ0ZXJSZW5kZXJQaGFzZSB7XG4gIC8qKlxuICAgKiBVc2UgYEFmdGVyUmVuZGVyUGhhc2UuRWFybHlSZWFkYCBmb3IgY2FsbGJhY2tzIHRoYXQgb25seSBuZWVkIHRvICoqcmVhZCoqIGZyb20gdGhlXG4gICAqIERPTSBiZWZvcmUgYSBzdWJzZXF1ZW50IGBBZnRlclJlbmRlclBoYXNlLldyaXRlYCBjYWxsYmFjaywgZm9yIGV4YW1wbGUgdG8gcGVyZm9ybVxuICAgKiBjdXN0b20gbGF5b3V0IHRoYXQgdGhlIGJyb3dzZXIgZG9lc24ndCBuYXRpdmVseSBzdXBwb3J0LiBQcmVmZXIgdGhlXG4gICAqIGBBZnRlclJlbmRlclBoYXNlLkVhcmx5UmVhZGAgcGhhc2UgaWYgcmVhZGluZyBjYW4gd2FpdCB1bnRpbCBhZnRlciB0aGUgd3JpdGUgcGhhc2UuXG4gICAqICoqTmV2ZXIqKiB3cml0ZSB0byB0aGUgRE9NIGluIHRoaXMgcGhhc2UuXG4gICAqXG4gICAqIDxkaXYgY2xhc3M9XCJhbGVydCBpcy1pbXBvcnRhbnRcIj5cbiAgICpcbiAgICogVXNpbmcgdGhpcyB2YWx1ZSBjYW4gZGVncmFkZSBwZXJmb3JtYW5jZS5cbiAgICogSW5zdGVhZCwgcHJlZmVyIHVzaW5nIGJ1aWx0LWluIGJyb3dzZXIgZnVuY3Rpb25hbGl0eSB3aGVuIHBvc3NpYmxlLlxuICAgKlxuICAgKiA8L2Rpdj5cbiAgICovXG4gIEVhcmx5UmVhZCxcblxuICAvKipcbiAgICogVXNlIGBBZnRlclJlbmRlclBoYXNlLldyaXRlYCBmb3IgY2FsbGJhY2tzIHRoYXQgb25seSAqKndyaXRlKiogdG8gdGhlIERPTS4gKipOZXZlcioqXG4gICAqIHJlYWQgZnJvbSB0aGUgRE9NIGluIHRoaXMgcGhhc2UuXG4gICAqL1xuICBXcml0ZSxcblxuICAvKipcbiAgICogVXNlIGBBZnRlclJlbmRlclBoYXNlLk1peGVkUmVhZFdyaXRlYCBmb3IgY2FsbGJhY2tzIHRoYXQgcmVhZCBmcm9tIG9yIHdyaXRlIHRvIHRoZVxuICAgKiBET00sIHRoYXQgaGF2ZW4ndCBiZWVuIHJlZmFjdG9yZWQgdG8gdXNlIGEgZGlmZmVyZW50IHBoYXNlLiAqKk5ldmVyKiogdXNlIHRoaXMgcGhhc2UgaWZcbiAgICogaXQgaXMgcG9zc2libGUgdG8gZGl2aWRlIHRoZSB3b3JrIGFtb25nIHRoZSBvdGhlciBwaGFzZXMgaW5zdGVhZC5cbiAgICpcbiAgICogPGRpdiBjbGFzcz1cImFsZXJ0IGlzLWNyaXRpY2FsXCI+XG4gICAqXG4gICAqIFVzaW5nIHRoaXMgdmFsdWUgY2FuICoqc2lnbmlmaWNhbnRseSoqIGRlZ3JhZGUgcGVyZm9ybWFuY2UuXG4gICAqIEluc3RlYWQsIHByZWZlciBkaXZpZGluZyB3b3JrIGludG8gdGhlIGFwcHJvcHJpYXRlIHBoYXNlIGNhbGxiYWNrcy5cbiAgICpcbiAgICogPC9kaXY+XG4gICAqL1xuICBNaXhlZFJlYWRXcml0ZSxcblxuICAvKipcbiAgICogVXNlIGBBZnRlclJlbmRlclBoYXNlLlJlYWRgIGZvciBjYWxsYmFja3MgdGhhdCBvbmx5ICoqcmVhZCoqIGZyb20gdGhlIERPTS4gKipOZXZlcioqXG4gICAqIHdyaXRlIHRvIHRoZSBET00gaW4gdGhpcyBwaGFzZS5cbiAgICovXG4gIFJlYWQsXG59XG5cbi8qKlxuICogT3B0aW9ucyBwYXNzZWQgdG8gYGFmdGVyUmVuZGVyYCBhbmQgYGFmdGVyTmV4dFJlbmRlcmAuXG4gKlxuICogQGRldmVsb3BlclByZXZpZXdcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBZnRlclJlbmRlck9wdGlvbnMge1xuICAvKipcbiAgICogVGhlIGBJbmplY3RvcmAgdG8gdXNlIGR1cmluZyBjcmVhdGlvbi5cbiAgICpcbiAgICogSWYgdGhpcyBpcyBub3QgcHJvdmlkZWQsIHRoZSBjdXJyZW50IGluamVjdGlvbiBjb250ZXh0IHdpbGwgYmUgdXNlZCBpbnN0ZWFkICh2aWEgYGluamVjdGApLlxuICAgKi9cbiAgaW5qZWN0b3I/OiBJbmplY3RvcjtcblxuICAvKipcbiAgICogVGhlIHBoYXNlIHRoZSBjYWxsYmFjayBzaG91bGQgYmUgaW52b2tlZCBpbi5cbiAgICpcbiAgICogPGRpdiBjbGFzcz1cImFsZXJ0IGlzLWNyaXRpY2FsXCI+XG4gICAqXG4gICAqIERlZmF1bHRzIHRvIGBBZnRlclJlbmRlclBoYXNlLk1peGVkUmVhZFdyaXRlYC4gWW91IHNob3VsZCBjaG9vc2UgYSBtb3JlIHNwZWNpZmljXG4gICAqIHBoYXNlIGluc3RlYWQuIFNlZSBgQWZ0ZXJSZW5kZXJQaGFzZWAgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gICAqXG4gICAqIDwvZGl2PlxuICAgKlxuICAgKiBAZGVwcmVjYXRlZCBTcGVjaWZ5IHRoZSBwaGFzZSBmb3IgeW91ciBjYWxsYmFjayB0byBydW4gaW4gYnkgcGFzc2luZyBhIHNwZWMtb2JqZWN0IGFzIHRoZSBmaXJzdFxuICAgKiAgIHBhcmFtZXRlciB0byBgYWZ0ZXJSZW5kZXJgIG9yIGBhZnRlck5leHRSZW5kZXJgIGluc3RlYWQgb2YgYSBmdW5jdGlvbi5cbiAgICovXG4gIHBoYXNlPzogQWZ0ZXJSZW5kZXJQaGFzZTtcbn1cblxuLyoqXG4gKiBBIGNhbGxiYWNrIHRoYXQgcnVucyBhZnRlciByZW5kZXIuXG4gKlxuICogQGRldmVsb3BlclByZXZpZXdcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBZnRlclJlbmRlclJlZiB7XG4gIC8qKlxuICAgKiBTaHV0IGRvd24gdGhlIGNhbGxiYWNrLCBwcmV2ZW50aW5nIGl0IGZyb20gYmVpbmcgY2FsbGVkIGFnYWluLlxuICAgKi9cbiAgZGVzdHJveSgpOiB2b2lkO1xufVxuXG4vKipcbiAqIE9wdGlvbnMgcGFzc2VkIHRvIGBpbnRlcm5hbEFmdGVyTmV4dFJlbmRlcmAuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSW50ZXJuYWxBZnRlck5leHRSZW5kZXJPcHRpb25zIHtcbiAgLyoqXG4gICAqIFRoZSBgSW5qZWN0b3JgIHRvIHVzZSBkdXJpbmcgY3JlYXRpb24uXG4gICAqXG4gICAqIElmIHRoaXMgaXMgbm90IHByb3ZpZGVkLCB0aGUgY3VycmVudCBpbmplY3Rpb24gY29udGV4dCB3aWxsIGJlIHVzZWQgaW5zdGVhZCAodmlhIGBpbmplY3RgKS5cbiAgICovXG4gIGluamVjdG9yPzogSW5qZWN0b3I7XG4gIC8qKlxuICAgKiBXaGVuIHRydWUsIHRoZSBob29rIHdpbGwgZXhlY3V0ZSBib3RoIG9uIGNsaWVudCBhbmQgb24gdGhlIHNlcnZlci5cbiAgICpcbiAgICogV2hlbiBmYWxzZSBvciB1bmRlZmluZWQsIHRoZSBob29rIG9ubHkgZXhlY3V0ZXMgaW4gdGhlIGJyb3dzZXIuXG4gICAqL1xuICBydW5PblNlcnZlcj86IGJvb2xlYW47XG59XG5cbi8qKiBgQWZ0ZXJSZW5kZXJSZWZgIHRoYXQgZG9lcyBub3RoaW5nLiAqL1xuY29uc3QgTk9PUF9BRlRFUl9SRU5ERVJfUkVGOiBBZnRlclJlbmRlclJlZiA9IHtcbiAgZGVzdHJveSgpIHt9LFxufTtcblxuLyoqXG4gKiBSZWdpc3RlciBhIGNhbGxiYWNrIHRvIHJ1biBvbmNlIGJlZm9yZSBhbnkgdXNlcnNwYWNlIGBhZnRlclJlbmRlcmAgb3JcbiAqIGBhZnRlck5leHRSZW5kZXJgIGNhbGxiYWNrcy5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHNob3VsZCBhbG1vc3QgYWx3YXlzIGJlIHVzZWQgaW5zdGVhZCBvZiBgYWZ0ZXJSZW5kZXJgIG9yXG4gKiBgYWZ0ZXJOZXh0UmVuZGVyYCBmb3IgaW1wbGVtZW50aW5nIGZyYW1ld29yayBmdW5jdGlvbmFsaXR5LiBDb25zaWRlcjpcbiAqXG4gKiAgIDEuKSBgQWZ0ZXJSZW5kZXJQaGFzZS5FYXJseVJlYWRgIGlzIGludGVuZGVkIHRvIGJlIHVzZWQgZm9yIGltcGxlbWVudGluZ1xuICogICAgICAgY3VzdG9tIGxheW91dC4gSWYgdGhlIGZyYW1ld29yayBpdHNlbGYgbXV0YXRlcyB0aGUgRE9NIGFmdGVyICphbnkqXG4gKiAgICAgICBgQWZ0ZXJSZW5kZXJQaGFzZS5FYXJseVJlYWRgIGNhbGxiYWNrcyBhcmUgcnVuLCB0aGUgcGhhc2UgY2FuIG5vXG4gKiAgICAgICBsb25nZXIgcmVsaWFibHkgc2VydmUgaXRzIHB1cnBvc2UuXG4gKlxuICogICAyLikgSW1wb3J0aW5nIGBhZnRlclJlbmRlcmAgaW4gdGhlIGZyYW1ld29yayBjYW4gcmVkdWNlIHRoZSBhYmlsaXR5IGZvciBpdFxuICogICAgICAgdG8gYmUgdHJlZS1zaGFrZW4sIGFuZCB0aGUgZnJhbWV3b3JrIHNob3VsZG4ndCBuZWVkIG11Y2ggb2YgdGhlIGJlaGF2aW9yLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaW50ZXJuYWxBZnRlck5leHRSZW5kZXIoXG4gIGNhbGxiYWNrOiBWb2lkRnVuY3Rpb24sXG4gIG9wdGlvbnM/OiBJbnRlcm5hbEFmdGVyTmV4dFJlbmRlck9wdGlvbnMsXG4pIHtcbiAgY29uc3QgaW5qZWN0b3IgPSBvcHRpb25zPy5pbmplY3RvciA/PyBpbmplY3QoSW5qZWN0b3IpO1xuXG4gIC8vIFNpbWlsYXJseSB0byB0aGUgcHVibGljIGBhZnRlck5leHRSZW5kZXJgIGZ1bmN0aW9uLCBhbiBpbnRlcm5hbCBvbmVcbiAgLy8gaXMgb25seSBpbnZva2VkIGluIGEgYnJvd3NlciBhcyBsb25nIGFzIHRoZSBydW5PblNlcnZlciBvcHRpb24gaXMgbm90IHNldC5cbiAgaWYgKCFvcHRpb25zPy5ydW5PblNlcnZlciAmJiAhaXNQbGF0Zm9ybUJyb3dzZXIoaW5qZWN0b3IpKSByZXR1cm47XG5cbiAgY29uc3QgYWZ0ZXJSZW5kZXJFdmVudE1hbmFnZXIgPSBpbmplY3Rvci5nZXQoQWZ0ZXJSZW5kZXJFdmVudE1hbmFnZXIpO1xuICBhZnRlclJlbmRlckV2ZW50TWFuYWdlci5pbnRlcm5hbENhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcbn1cblxuLyoqXG4gKiBSZWdpc3RlciBjYWxsYmFja3MgdG8gYmUgaW52b2tlZCBlYWNoIHRpbWUgdGhlIGFwcGxpY2F0aW9uIGZpbmlzaGVzIHJlbmRlcmluZywgZHVyaW5nIHRoZVxuICogc3BlY2lmaWVkIHBoYXNlcy4gVGhlIGF2YWlsYWJsZSBwaGFzZXMgYXJlOlxuICogLSBgZWFybHlSZWFkYFxuICogICBVc2UgdGhpcyBwaGFzZSB0byAqKnJlYWQqKiBmcm9tIHRoZSBET00gYmVmb3JlIGEgc3Vic2VxdWVudCBgd3JpdGVgIGNhbGxiYWNrLCBmb3IgZXhhbXBsZSB0b1xuICogICBwZXJmb3JtIGN1c3RvbSBsYXlvdXQgdGhhdCB0aGUgYnJvd3NlciBkb2Vzbid0IG5hdGl2ZWx5IHN1cHBvcnQuIFByZWZlciB0aGUgYHJlYWRgIHBoYXNlIGlmXG4gKiAgIHJlYWRpbmcgY2FuIHdhaXQgdW50aWwgYWZ0ZXIgdGhlIHdyaXRlIHBoYXNlLiAqKk5ldmVyKiogd3JpdGUgdG8gdGhlIERPTSBpbiB0aGlzIHBoYXNlLlxuICogLSBgd3JpdGVgXG4gKiAgICBVc2UgdGhpcyBwaGFzZSB0byAqKndyaXRlKiogdG8gdGhlIERPTS4gKipOZXZlcioqIHJlYWQgZnJvbSB0aGUgRE9NIGluIHRoaXMgcGhhc2UuXG4gKiAtIGBtaXhlZFJlYWRXcml0ZWBcbiAqICAgIFVzZSB0aGlzIHBoYXNlIHRvIHJlYWQgZnJvbSBhbmQgd3JpdGUgdG8gdGhlIERPTSBzaW11bHRhbmVvdXNseS4gKipOZXZlcioqIHVzZSB0aGlzIHBoYXNlIGlmXG4gKiAgICBpdCBpcyBwb3NzaWJsZSB0byBkaXZpZGUgdGhlIHdvcmsgYW1vbmcgdGhlIG90aGVyIHBoYXNlcyBpbnN0ZWFkLlxuICogLSBgcmVhZGBcbiAqICAgIFVzZSB0aGlzIHBoYXNlIHRvICoqcmVhZCoqIGZyb20gdGhlIERPTS4gKipOZXZlcioqIHdyaXRlIHRvIHRoZSBET00gaW4gdGhpcyBwaGFzZS5cbiAqXG4gKiA8ZGl2IGNsYXNzPVwiYWxlcnQgaXMtY3JpdGljYWxcIj5cbiAqXG4gKiBZb3Ugc2hvdWxkIHByZWZlciB1c2luZyB0aGUgYHJlYWRgIGFuZCBgd3JpdGVgIHBoYXNlcyBvdmVyIHRoZSBgZWFybHlSZWFkYCBhbmQgYG1peGVkUmVhZFdyaXRlYFxuICogcGhhc2VzIHdoZW4gcG9zc2libGUsIHRvIGF2b2lkIHBlcmZvcm1hbmNlIGRlZ3JhZGF0aW9uLlxuICpcbiAqIDwvZGl2PlxuICpcbiAqIE5vdGUgdGhhdDpcbiAqIC0gQ2FsbGJhY2tzIHJ1biBpbiB0aGUgZm9sbG93aW5nIHBoYXNlIG9yZGVyICphZnRlciBlYWNoIHJlbmRlcio6XG4gKiAgIDEuIGBlYXJseVJlYWRgXG4gKiAgIDIuIGB3cml0ZWBcbiAqICAgMy4gYG1peGVkUmVhZFdyaXRlYFxuICogICA0LiBgcmVhZGBcbiAqIC0gQ2FsbGJhY2tzIGluIHRoZSBzYW1lIHBoYXNlIHJ1biBpbiB0aGUgb3JkZXIgdGhleSBhcmUgcmVnaXN0ZXJlZC5cbiAqIC0gQ2FsbGJhY2tzIHJ1biBvbiBicm93c2VyIHBsYXRmb3JtcyBvbmx5LCB0aGV5IHdpbGwgbm90IHJ1biBvbiB0aGUgc2VydmVyLlxuICpcbiAqIFRoZSBmaXJzdCBwaGFzZSBjYWxsYmFjayB0byBydW4gYXMgcGFydCBvZiB0aGlzIHNwZWMgd2lsbCByZWNlaXZlIG5vIHBhcmFtZXRlcnMuIEVhY2hcbiAqIHN1YnNlcXVlbnQgcGhhc2UgY2FsbGJhY2sgaW4gdGhpcyBzcGVjIHdpbGwgcmVjZWl2ZSB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBwcmV2aW91c2x5IHJ1blxuICogcGhhc2UgY2FsbGJhY2sgYXMgYSBwYXJhbWV0ZXIuIFRoaXMgY2FuIGJlIHVzZWQgdG8gY29vcmRpbmF0ZSB3b3JrIGFjcm9zcyBtdWx0aXBsZSBwaGFzZXMuXG4gKlxuICogQW5ndWxhciBpcyB1bmFibGUgdG8gdmVyaWZ5IG9yIGVuZm9yY2UgdGhhdCBwaGFzZXMgYXJlIHVzZWQgY29ycmVjdGx5LCBhbmQgaW5zdGVhZFxuICogcmVsaWVzIG9uIGVhY2ggZGV2ZWxvcGVyIHRvIGZvbGxvdyB0aGUgZ3VpZGVsaW5lcyBkb2N1bWVudGVkIGZvciBlYWNoIHZhbHVlIGFuZFxuICogY2FyZWZ1bGx5IGNob29zZSB0aGUgYXBwcm9wcmlhdGUgb25lLCByZWZhY3RvcmluZyB0aGVpciBjb2RlIGlmIG5lY2Vzc2FyeS4gQnkgZG9pbmdcbiAqIHNvLCBBbmd1bGFyIGlzIGJldHRlciBhYmxlIHRvIG1pbmltaXplIHRoZSBwZXJmb3JtYW5jZSBkZWdyYWRhdGlvbiBhc3NvY2lhdGVkIHdpdGhcbiAqIG1hbnVhbCBET00gYWNjZXNzLCBlbnN1cmluZyB0aGUgYmVzdCBleHBlcmllbmNlIGZvciB0aGUgZW5kIHVzZXJzIG9mIHlvdXIgYXBwbGljYXRpb25cbiAqIG9yIGxpYnJhcnkuXG4gKlxuICogPGRpdiBjbGFzcz1cImFsZXJ0IGlzLWltcG9ydGFudFwiPlxuICpcbiAqIENvbXBvbmVudHMgYXJlIG5vdCBndWFyYW50ZWVkIHRvIGJlIFtoeWRyYXRlZF0oZ3VpZGUvaHlkcmF0aW9uKSBiZWZvcmUgdGhlIGNhbGxiYWNrIHJ1bnMuXG4gKiBZb3UgbXVzdCB1c2UgY2F1dGlvbiB3aGVuIGRpcmVjdGx5IHJlYWRpbmcgb3Igd3JpdGluZyB0aGUgRE9NIGFuZCBsYXlvdXQuXG4gKlxuICogPC9kaXY+XG4gKlxuICogQHBhcmFtIHNwZWMgVGhlIGNhbGxiYWNrIGZ1bmN0aW9ucyB0byByZWdpc3RlclxuICogQHBhcmFtIG9wdGlvbnMgT3B0aW9ucyB0byBjb250cm9sIHRoZSBiZWhhdmlvciBvZiB0aGUgY2FsbGJhY2tcbiAqXG4gKiBAdXNhZ2VOb3Rlc1xuICpcbiAqIFVzZSBgYWZ0ZXJSZW5kZXJgIHRvIHJlYWQgb3Igd3JpdGUgdGhlIERPTSBhZnRlciBlYWNoIHJlbmRlci5cbiAqXG4gKiAjIyMgRXhhbXBsZVxuICogYGBgdHNcbiAqIEBDb21wb25lbnQoe1xuICogICBzZWxlY3RvcjogJ215LWNtcCcsXG4gKiAgIHRlbXBsYXRlOiBgPHNwYW4gI2NvbnRlbnQ+e3sgLi4uIH19PC9zcGFuPmAsXG4gKiB9KVxuICogZXhwb3J0IGNsYXNzIE15Q29tcG9uZW50IHtcbiAqICAgQFZpZXdDaGlsZCgnY29udGVudCcpIGNvbnRlbnRSZWY6IEVsZW1lbnRSZWY7XG4gKlxuICogICBjb25zdHJ1Y3RvcigpIHtcbiAqICAgICBhZnRlclJlbmRlcih7XG4gKiAgICAgICByZWFkOiAoKSA9PiB7XG4gKiAgICAgICAgIGNvbnNvbGUubG9nKCdjb250ZW50IGhlaWdodDogJyArIHRoaXMuY29udGVudFJlZi5uYXRpdmVFbGVtZW50LnNjcm9sbEhlaWdodCk7XG4gKiAgICAgICB9XG4gKiAgICAgfSk7XG4gKiAgIH1cbiAqIH1cbiAqIGBgYFxuICpcbiAqIEBkZXZlbG9wZXJQcmV2aWV3XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhZnRlclJlbmRlcjxFID0gbmV2ZXIsIFcgPSBuZXZlciwgTSA9IG5ldmVyPihcbiAgc3BlYzoge1xuICAgIGVhcmx5UmVhZD86ICgpID0+IEU7XG4gICAgd3JpdGU/OiAoLi4uYXJnczogybVGaXJzdEF2YWlsYWJsZTxbRV0+KSA9PiBXO1xuICAgIG1peGVkUmVhZFdyaXRlPzogKC4uLmFyZ3M6IMm1Rmlyc3RBdmFpbGFibGU8W1csIEVdPikgPT4gTTtcbiAgICByZWFkPzogKC4uLmFyZ3M6IMm1Rmlyc3RBdmFpbGFibGU8W00sIFcsIEVdPikgPT4gdm9pZDtcbiAgfSxcbiAgb3B0aW9ucz86IE9taXQ8QWZ0ZXJSZW5kZXJPcHRpb25zLCAncGhhc2UnPixcbik6IEFmdGVyUmVuZGVyUmVmO1xuXG4vKipcbiAqIFJlZ2lzdGVyIGEgY2FsbGJhY2sgdG8gYmUgaW52b2tlZCBlYWNoIHRpbWUgdGhlIGFwcGxpY2F0aW9uIGZpbmlzaGVzIHJlbmRlcmluZywgZHVyaW5nIHRoZVxuICogYG1peGVkUmVhZFdyaXRlYCBwaGFzZS5cbiAqXG4gKiA8ZGl2IGNsYXNzPVwiYWxlcnQgaXMtY3JpdGljYWxcIj5cbiAqXG4gKiBZb3Ugc2hvdWxkIHByZWZlciBzcGVjaWZ5aW5nIGFuIGV4cGxpY2l0IHBoYXNlIGZvciB0aGUgY2FsbGJhY2sgaW5zdGVhZCwgb3IgeW91IHJpc2sgc2lnbmlmaWNhbnRcbiAqIHBlcmZvcm1hbmNlIGRlZ3JhZGF0aW9uLlxuICpcbiAqIDwvZGl2PlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgY2FsbGJhY2sgd2lsbCBydW5cbiAqIC0gaW4gdGhlIG9yZGVyIGl0IHdhcyByZWdpc3RlcmVkXG4gKiAtIG9uY2UgcGVyIHJlbmRlclxuICogLSBvbiBicm93c2VyIHBsYXRmb3JtcyBvbmx5XG4gKiAtIGR1cmluZyB0aGUgYG1peGVkUmVhZFdyaXRlYCBwaGFzZVxuICpcbiAqIDxkaXYgY2xhc3M9XCJhbGVydCBpcy1pbXBvcnRhbnRcIj5cbiAqXG4gKiBDb21wb25lbnRzIGFyZSBub3QgZ3VhcmFudGVlZCB0byBiZSBbaHlkcmF0ZWRdKGd1aWRlL2h5ZHJhdGlvbikgYmVmb3JlIHRoZSBjYWxsYmFjayBydW5zLlxuICogWW91IG11c3QgdXNlIGNhdXRpb24gd2hlbiBkaXJlY3RseSByZWFkaW5nIG9yIHdyaXRpbmcgdGhlIERPTSBhbmQgbGF5b3V0LlxuICpcbiAqIDwvZGl2PlxuICpcbiAqIEBwYXJhbSBjYWxsYmFjayBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIHJlZ2lzdGVyXG4gKiBAcGFyYW0gb3B0aW9ucyBPcHRpb25zIHRvIGNvbnRyb2wgdGhlIGJlaGF2aW9yIG9mIHRoZSBjYWxsYmFja1xuICpcbiAqIEB1c2FnZU5vdGVzXG4gKlxuICogVXNlIGBhZnRlclJlbmRlcmAgdG8gcmVhZCBvciB3cml0ZSB0aGUgRE9NIGFmdGVyIGVhY2ggcmVuZGVyLlxuICpcbiAqICMjIyBFeGFtcGxlXG4gKiBgYGB0c1xuICogQENvbXBvbmVudCh7XG4gKiAgIHNlbGVjdG9yOiAnbXktY21wJyxcbiAqICAgdGVtcGxhdGU6IGA8c3BhbiAjY29udGVudD57eyAuLi4gfX08L3NwYW4+YCxcbiAqIH0pXG4gKiBleHBvcnQgY2xhc3MgTXlDb21wb25lbnQge1xuICogICBAVmlld0NoaWxkKCdjb250ZW50JykgY29udGVudFJlZjogRWxlbWVudFJlZjtcbiAqXG4gKiAgIGNvbnN0cnVjdG9yKCkge1xuICogICAgIGFmdGVyUmVuZGVyKHtcbiAqICAgICAgIHJlYWQ6ICgpID0+IHtcbiAqICAgICAgICAgY29uc29sZS5sb2coJ2NvbnRlbnQgaGVpZ2h0OiAnICsgdGhpcy5jb250ZW50UmVmLm5hdGl2ZUVsZW1lbnQuc2Nyb2xsSGVpZ2h0KTtcbiAqICAgICAgIH1cbiAqICAgICB9KTtcbiAqICAgfVxuICogfVxuICogYGBgXG4gKlxuICogQGRldmVsb3BlclByZXZpZXdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFmdGVyUmVuZGVyKGNhbGxiYWNrOiBWb2lkRnVuY3Rpb24sIG9wdGlvbnM/OiBBZnRlclJlbmRlck9wdGlvbnMpOiBBZnRlclJlbmRlclJlZjtcblxuZXhwb3J0IGZ1bmN0aW9uIGFmdGVyUmVuZGVyKFxuICBjYWxsYmFja09yU3BlYzpcbiAgICB8IFZvaWRGdW5jdGlvblxuICAgIHwge1xuICAgICAgICBlYXJseVJlYWQ/OiAoKSA9PiB1bmtub3duO1xuICAgICAgICB3cml0ZT86IChyPzogdW5rbm93bikgPT4gdW5rbm93bjtcbiAgICAgICAgbWl4ZWRSZWFkV3JpdGU/OiAocj86IHVua25vd24pID0+IHVua25vd247XG4gICAgICAgIHJlYWQ/OiAocj86IHVua25vd24pID0+IHZvaWQ7XG4gICAgICB9LFxuICBvcHRpb25zPzogQWZ0ZXJSZW5kZXJPcHRpb25zLFxuKTogQWZ0ZXJSZW5kZXJSZWYge1xuICBuZ0Rldk1vZGUgJiZcbiAgICBhc3NlcnROb3RJblJlYWN0aXZlQ29udGV4dChcbiAgICAgIGFmdGVyUmVuZGVyLFxuICAgICAgJ0NhbGwgYGFmdGVyUmVuZGVyYCBvdXRzaWRlIG9mIGEgcmVhY3RpdmUgY29udGV4dC4gRm9yIGV4YW1wbGUsIHNjaGVkdWxlIHRoZSByZW5kZXIgJyArXG4gICAgICAgICdjYWxsYmFjayBpbnNpZGUgdGhlIGNvbXBvbmVudCBjb25zdHJ1Y3RvcmAuJyxcbiAgICApO1xuXG4gICFvcHRpb25zICYmIGFzc2VydEluSW5qZWN0aW9uQ29udGV4dChhZnRlclJlbmRlcik7XG4gIGNvbnN0IGluamVjdG9yID0gb3B0aW9ucz8uaW5qZWN0b3IgPz8gaW5qZWN0KEluamVjdG9yKTtcblxuICBpZiAoIWlzUGxhdGZvcm1Ccm93c2VyKGluamVjdG9yKSkge1xuICAgIHJldHVybiBOT09QX0FGVEVSX1JFTkRFUl9SRUY7XG4gIH1cblxuICBwZXJmb3JtYW5jZU1hcmtGZWF0dXJlKCdOZ0FmdGVyUmVuZGVyJyk7XG5cbiAgcmV0dXJuIGFmdGVyUmVuZGVySW1wbChcbiAgICBjYWxsYmFja09yU3BlYyxcbiAgICBpbmplY3RvcixcbiAgICAvKiBvbmNlICovIGZhbHNlLFxuICAgIG9wdGlvbnM/LnBoYXNlID8/IEFmdGVyUmVuZGVyUGhhc2UuTWl4ZWRSZWFkV3JpdGUsXG4gICk7XG59XG5cbi8qKlxuICogUmVnaXN0ZXIgY2FsbGJhY2tzIHRvIGJlIGludm9rZWQgdGhlIG5leHQgdGltZSB0aGUgYXBwbGljYXRpb24gZmluaXNoZXMgcmVuZGVyaW5nLCBkdXJpbmcgdGhlXG4gKiBzcGVjaWZpZWQgcGhhc2VzLiBUaGUgYXZhaWxhYmxlIHBoYXNlcyBhcmU6XG4gKiAtIGBlYXJseVJlYWRgXG4gKiAgIFVzZSB0aGlzIHBoYXNlIHRvICoqcmVhZCoqIGZyb20gdGhlIERPTSBiZWZvcmUgYSBzdWJzZXF1ZW50IGB3cml0ZWAgY2FsbGJhY2ssIGZvciBleGFtcGxlIHRvXG4gKiAgIHBlcmZvcm0gY3VzdG9tIGxheW91dCB0aGF0IHRoZSBicm93c2VyIGRvZXNuJ3QgbmF0aXZlbHkgc3VwcG9ydC4gUHJlZmVyIHRoZSBgcmVhZGAgcGhhc2UgaWZcbiAqICAgcmVhZGluZyBjYW4gd2FpdCB1bnRpbCBhZnRlciB0aGUgd3JpdGUgcGhhc2UuICoqTmV2ZXIqKiB3cml0ZSB0byB0aGUgRE9NIGluIHRoaXMgcGhhc2UuXG4gKiAtIGB3cml0ZWBcbiAqICAgIFVzZSB0aGlzIHBoYXNlIHRvICoqd3JpdGUqKiB0byB0aGUgRE9NLiAqKk5ldmVyKiogcmVhZCBmcm9tIHRoZSBET00gaW4gdGhpcyBwaGFzZS5cbiAqIC0gYG1peGVkUmVhZFdyaXRlYFxuICogICAgVXNlIHRoaXMgcGhhc2UgdG8gcmVhZCBmcm9tIGFuZCB3cml0ZSB0byB0aGUgRE9NIHNpbXVsdGFuZW91c2x5LiAqKk5ldmVyKiogdXNlIHRoaXMgcGhhc2UgaWZcbiAqICAgIGl0IGlzIHBvc3NpYmxlIHRvIGRpdmlkZSB0aGUgd29yayBhbW9uZyB0aGUgb3RoZXIgcGhhc2VzIGluc3RlYWQuXG4gKiAtIGByZWFkYFxuICogICAgVXNlIHRoaXMgcGhhc2UgdG8gKipyZWFkKiogZnJvbSB0aGUgRE9NLiAqKk5ldmVyKiogd3JpdGUgdG8gdGhlIERPTSBpbiB0aGlzIHBoYXNlLlxuICpcbiAqIDxkaXYgY2xhc3M9XCJhbGVydCBpcy1jcml0aWNhbFwiPlxuICpcbiAqIFlvdSBzaG91bGQgcHJlZmVyIHVzaW5nIHRoZSBgcmVhZGAgYW5kIGB3cml0ZWAgcGhhc2VzIG92ZXIgdGhlIGBlYXJseVJlYWRgIGFuZCBgbWl4ZWRSZWFkV3JpdGVgXG4gKiBwaGFzZXMgd2hlbiBwb3NzaWJsZSwgdG8gYXZvaWQgcGVyZm9ybWFuY2UgZGVncmFkYXRpb24uXG4gKlxuICogPC9kaXY+XG4gKlxuICogTm90ZSB0aGF0OlxuICogLSBDYWxsYmFja3MgcnVuIGluIHRoZSBmb2xsb3dpbmcgcGhhc2Ugb3JkZXIgKm9uY2UsIGFmdGVyIHRoZSBuZXh0IHJlbmRlcio6XG4gKiAgIDEuIGBlYXJseVJlYWRgXG4gKiAgIDIuIGB3cml0ZWBcbiAqICAgMy4gYG1peGVkUmVhZFdyaXRlYFxuICogICA0LiBgcmVhZGBcbiAqIC0gQ2FsbGJhY2tzIGluIHRoZSBzYW1lIHBoYXNlIHJ1biBpbiB0aGUgb3JkZXIgdGhleSBhcmUgcmVnaXN0ZXJlZC5cbiAqIC0gQ2FsbGJhY2tzIHJ1biBvbiBicm93c2VyIHBsYXRmb3JtcyBvbmx5LCB0aGV5IHdpbGwgbm90IHJ1biBvbiB0aGUgc2VydmVyLlxuICpcbiAqIFRoZSBmaXJzdCBwaGFzZSBjYWxsYmFjayB0byBydW4gYXMgcGFydCBvZiB0aGlzIHNwZWMgd2lsbCByZWNlaXZlIG5vIHBhcmFtZXRlcnMuIEVhY2hcbiAqIHN1YnNlcXVlbnQgcGhhc2UgY2FsbGJhY2sgaW4gdGhpcyBzcGVjIHdpbGwgcmVjZWl2ZSB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBwcmV2aW91c2x5IHJ1blxuICogcGhhc2UgY2FsbGJhY2sgYXMgYSBwYXJhbWV0ZXIuIFRoaXMgY2FuIGJlIHVzZWQgdG8gY29vcmRpbmF0ZSB3b3JrIGFjcm9zcyBtdWx0aXBsZSBwaGFzZXMuXG4gKlxuICogQW5ndWxhciBpcyB1bmFibGUgdG8gdmVyaWZ5IG9yIGVuZm9yY2UgdGhhdCBwaGFzZXMgYXJlIHVzZWQgY29ycmVjdGx5LCBhbmQgaW5zdGVhZFxuICogcmVsaWVzIG9uIGVhY2ggZGV2ZWxvcGVyIHRvIGZvbGxvdyB0aGUgZ3VpZGVsaW5lcyBkb2N1bWVudGVkIGZvciBlYWNoIHZhbHVlIGFuZFxuICogY2FyZWZ1bGx5IGNob29zZSB0aGUgYXBwcm9wcmlhdGUgb25lLCByZWZhY3RvcmluZyB0aGVpciBjb2RlIGlmIG5lY2Vzc2FyeS4gQnkgZG9pbmdcbiAqIHNvLCBBbmd1bGFyIGlzIGJldHRlciBhYmxlIHRvIG1pbmltaXplIHRoZSBwZXJmb3JtYW5jZSBkZWdyYWRhdGlvbiBhc3NvY2lhdGVkIHdpdGhcbiAqIG1hbnVhbCBET00gYWNjZXNzLCBlbnN1cmluZyB0aGUgYmVzdCBleHBlcmllbmNlIGZvciB0aGUgZW5kIHVzZXJzIG9mIHlvdXIgYXBwbGljYXRpb25cbiAqIG9yIGxpYnJhcnkuXG4gKlxuICogPGRpdiBjbGFzcz1cImFsZXJ0IGlzLWltcG9ydGFudFwiPlxuICpcbiAqIENvbXBvbmVudHMgYXJlIG5vdCBndWFyYW50ZWVkIHRvIGJlIFtoeWRyYXRlZF0oZ3VpZGUvaHlkcmF0aW9uKSBiZWZvcmUgdGhlIGNhbGxiYWNrIHJ1bnMuXG4gKiBZb3UgbXVzdCB1c2UgY2F1dGlvbiB3aGVuIGRpcmVjdGx5IHJlYWRpbmcgb3Igd3JpdGluZyB0aGUgRE9NIGFuZCBsYXlvdXQuXG4gKlxuICogPC9kaXY+XG4gKlxuICogQHBhcmFtIHNwZWMgVGhlIGNhbGxiYWNrIGZ1bmN0aW9ucyB0byByZWdpc3RlclxuICogQHBhcmFtIG9wdGlvbnMgT3B0aW9ucyB0byBjb250cm9sIHRoZSBiZWhhdmlvciBvZiB0aGUgY2FsbGJhY2tcbiAqXG4gKiBAdXNhZ2VOb3Rlc1xuICpcbiAqIFVzZSBgYWZ0ZXJOZXh0UmVuZGVyYCB0byByZWFkIG9yIHdyaXRlIHRoZSBET00gb25jZSxcbiAqIGZvciBleGFtcGxlIHRvIGluaXRpYWxpemUgYSBub24tQW5ndWxhciBsaWJyYXJ5LlxuICpcbiAqICMjIyBFeGFtcGxlXG4gKiBgYGB0c1xuICogQENvbXBvbmVudCh7XG4gKiAgIHNlbGVjdG9yOiAnbXktY2hhcnQtY21wJyxcbiAqICAgdGVtcGxhdGU6IGA8ZGl2ICNjaGFydD57eyAuLi4gfX08L2Rpdj5gLFxuICogfSlcbiAqIGV4cG9ydCBjbGFzcyBNeUNoYXJ0Q21wIHtcbiAqICAgQFZpZXdDaGlsZCgnY2hhcnQnKSBjaGFydFJlZjogRWxlbWVudFJlZjtcbiAqICAgY2hhcnQ6IE15Q2hhcnR8bnVsbDtcbiAqXG4gKiAgIGNvbnN0cnVjdG9yKCkge1xuICogICAgIGFmdGVyTmV4dFJlbmRlcih7XG4gKiAgICAgICB3cml0ZTogKCkgPT4ge1xuICogICAgICAgICB0aGlzLmNoYXJ0ID0gbmV3IE15Q2hhcnQodGhpcy5jaGFydFJlZi5uYXRpdmVFbGVtZW50KTtcbiAqICAgICAgIH1cbiAqICAgICB9KTtcbiAqICAgfVxuICogfVxuICogYGBgXG4gKlxuICogQGRldmVsb3BlclByZXZpZXdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFmdGVyTmV4dFJlbmRlcjxFID0gbmV2ZXIsIFcgPSBuZXZlciwgTSA9IG5ldmVyPihcbiAgc3BlYzoge1xuICAgIGVhcmx5UmVhZD86ICgpID0+IEU7XG4gICAgd3JpdGU/OiAoLi4uYXJnczogybVGaXJzdEF2YWlsYWJsZTxbRV0+KSA9PiBXO1xuICAgIG1peGVkUmVhZFdyaXRlPzogKC4uLmFyZ3M6IMm1Rmlyc3RBdmFpbGFibGU8W1csIEVdPikgPT4gTTtcbiAgICByZWFkPzogKC4uLmFyZ3M6IMm1Rmlyc3RBdmFpbGFibGU8W00sIFcsIEVdPikgPT4gdm9pZDtcbiAgfSxcbiAgb3B0aW9ucz86IE9taXQ8QWZ0ZXJSZW5kZXJPcHRpb25zLCAncGhhc2UnPixcbik6IEFmdGVyUmVuZGVyUmVmO1xuXG4vKipcbiAqIFJlZ2lzdGVyIGEgY2FsbGJhY2sgdG8gYmUgaW52b2tlZCB0aGUgbmV4dCB0aW1lIHRoZSBhcHBsaWNhdGlvbiBmaW5pc2hlcyByZW5kZXJpbmcsIGR1cmluZyB0aGVcbiAqIGBtaXhlZFJlYWRXcml0ZWAgcGhhc2UuXG4gKlxuICogPGRpdiBjbGFzcz1cImFsZXJ0IGlzLWNyaXRpY2FsXCI+XG4gKlxuICogWW91IHNob3VsZCBwcmVmZXIgc3BlY2lmeWluZyBhbiBleHBsaWNpdCBwaGFzZSBmb3IgdGhlIGNhbGxiYWNrIGluc3RlYWQsIG9yIHlvdSByaXNrIHNpZ25pZmljYW50XG4gKiBwZXJmb3JtYW5jZSBkZWdyYWRhdGlvbi5cbiAqXG4gKiA8L2Rpdj5cbiAqXG4gKiBOb3RlIHRoYXQgdGhlIGNhbGxiYWNrIHdpbGwgcnVuXG4gKiAtIGluIHRoZSBvcmRlciBpdCB3YXMgcmVnaXN0ZXJlZFxuICogLSBvbiBicm93c2VyIHBsYXRmb3JtcyBvbmx5XG4gKiAtIGR1cmluZyB0aGUgYG1peGVkUmVhZFdyaXRlYCBwaGFzZVxuICpcbiAqIDxkaXYgY2xhc3M9XCJhbGVydCBpcy1pbXBvcnRhbnRcIj5cbiAqXG4gKiBDb21wb25lbnRzIGFyZSBub3QgZ3VhcmFudGVlZCB0byBiZSBbaHlkcmF0ZWRdKGd1aWRlL2h5ZHJhdGlvbikgYmVmb3JlIHRoZSBjYWxsYmFjayBydW5zLlxuICogWW91IG11c3QgdXNlIGNhdXRpb24gd2hlbiBkaXJlY3RseSByZWFkaW5nIG9yIHdyaXRpbmcgdGhlIERPTSBhbmQgbGF5b3V0LlxuICpcbiAqIDwvZGl2PlxuICpcbiAqIEBwYXJhbSBjYWxsYmFjayBBIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIHJlZ2lzdGVyXG4gKiBAcGFyYW0gb3B0aW9ucyBPcHRpb25zIHRvIGNvbnRyb2wgdGhlIGJlaGF2aW9yIG9mIHRoZSBjYWxsYmFja1xuICpcbiAqIEB1c2FnZU5vdGVzXG4gKlxuICogVXNlIGBhZnRlck5leHRSZW5kZXJgIHRvIHJlYWQgb3Igd3JpdGUgdGhlIERPTSBvbmNlLFxuICogZm9yIGV4YW1wbGUgdG8gaW5pdGlhbGl6ZSBhIG5vbi1Bbmd1bGFyIGxpYnJhcnkuXG4gKlxuICogIyMjIEV4YW1wbGVcbiAqIGBgYHRzXG4gKiBAQ29tcG9uZW50KHtcbiAqICAgc2VsZWN0b3I6ICdteS1jaGFydC1jbXAnLFxuICogICB0ZW1wbGF0ZTogYDxkaXYgI2NoYXJ0Pnt7IC4uLiB9fTwvZGl2PmAsXG4gKiB9KVxuICogZXhwb3J0IGNsYXNzIE15Q2hhcnRDbXAge1xuICogICBAVmlld0NoaWxkKCdjaGFydCcpIGNoYXJ0UmVmOiBFbGVtZW50UmVmO1xuICogICBjaGFydDogTXlDaGFydHxudWxsO1xuICpcbiAqICAgY29uc3RydWN0b3IoKSB7XG4gKiAgICAgYWZ0ZXJOZXh0UmVuZGVyKHtcbiAqICAgICAgIHdyaXRlOiAoKSA9PiB7XG4gKiAgICAgICAgIHRoaXMuY2hhcnQgPSBuZXcgTXlDaGFydCh0aGlzLmNoYXJ0UmVmLm5hdGl2ZUVsZW1lbnQpO1xuICogICAgICAgfVxuICogICAgIH0pO1xuICogICB9XG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBAZGV2ZWxvcGVyUHJldmlld1xuICovXG5leHBvcnQgZnVuY3Rpb24gYWZ0ZXJOZXh0UmVuZGVyKFxuICBjYWxsYmFjazogVm9pZEZ1bmN0aW9uLFxuICBvcHRpb25zPzogQWZ0ZXJSZW5kZXJPcHRpb25zLFxuKTogQWZ0ZXJSZW5kZXJSZWY7XG5cbmV4cG9ydCBmdW5jdGlvbiBhZnRlck5leHRSZW5kZXIoXG4gIGNhbGxiYWNrT3JTcGVjOlxuICAgIHwgVm9pZEZ1bmN0aW9uXG4gICAgfCB7XG4gICAgICAgIGVhcmx5UmVhZD86ICgpID0+IHVua25vd247XG4gICAgICAgIHdyaXRlPzogKHI/OiB1bmtub3duKSA9PiB1bmtub3duO1xuICAgICAgICBtaXhlZFJlYWRXcml0ZT86IChyPzogdW5rbm93bikgPT4gdW5rbm93bjtcbiAgICAgICAgcmVhZD86IChyPzogdW5rbm93bikgPT4gdm9pZDtcbiAgICAgIH0sXG4gIG9wdGlvbnM/OiBBZnRlclJlbmRlck9wdGlvbnMsXG4pOiBBZnRlclJlbmRlclJlZiB7XG4gICFvcHRpb25zICYmIGFzc2VydEluSW5qZWN0aW9uQ29udGV4dChhZnRlck5leHRSZW5kZXIpO1xuICBjb25zdCBpbmplY3RvciA9IG9wdGlvbnM/LmluamVjdG9yID8/IGluamVjdChJbmplY3Rvcik7XG5cbiAgaWYgKCFpc1BsYXRmb3JtQnJvd3NlcihpbmplY3RvcikpIHtcbiAgICByZXR1cm4gTk9PUF9BRlRFUl9SRU5ERVJfUkVGO1xuICB9XG5cbiAgcGVyZm9ybWFuY2VNYXJrRmVhdHVyZSgnTmdBZnRlck5leHRSZW5kZXInKTtcblxuICByZXR1cm4gYWZ0ZXJSZW5kZXJJbXBsKFxuICAgIGNhbGxiYWNrT3JTcGVjLFxuICAgIGluamVjdG9yLFxuICAgIC8qIG9uY2UgKi8gdHJ1ZSxcbiAgICBvcHRpb25zPy5waGFzZSA/PyBBZnRlclJlbmRlclBoYXNlLk1peGVkUmVhZFdyaXRlLFxuICApO1xufVxuXG5mdW5jdGlvbiBnZXRTcGVjKFxuICBjYWxsYmFja09yU3BlYzpcbiAgICB8IFZvaWRGdW5jdGlvblxuICAgIHwge1xuICAgICAgICBlYXJseVJlYWQ/OiAoKSA9PiB1bmtub3duO1xuICAgICAgICB3cml0ZT86IChyPzogdW5rbm93bikgPT4gdW5rbm93bjtcbiAgICAgICAgbWl4ZWRSZWFkV3JpdGU/OiAocj86IHVua25vd24pID0+IHVua25vd247XG4gICAgICAgIHJlYWQ/OiAocj86IHVua25vd24pID0+IHZvaWQ7XG4gICAgICB9LFxuICBwaGFzZTogQWZ0ZXJSZW5kZXJQaGFzZSxcbikge1xuICBpZiAoY2FsbGJhY2tPclNwZWMgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgIHN3aXRjaCAocGhhc2UpIHtcbiAgICAgIGNhc2UgQWZ0ZXJSZW5kZXJQaGFzZS5FYXJseVJlYWQ6XG4gICAgICAgIHJldHVybiB7ZWFybHlSZWFkOiBjYWxsYmFja09yU3BlY307XG4gICAgICBjYXNlIEFmdGVyUmVuZGVyUGhhc2UuV3JpdGU6XG4gICAgICAgIHJldHVybiB7d3JpdGU6IGNhbGxiYWNrT3JTcGVjfTtcbiAgICAgIGNhc2UgQWZ0ZXJSZW5kZXJQaGFzZS5NaXhlZFJlYWRXcml0ZTpcbiAgICAgICAgcmV0dXJuIHttaXhlZFJlYWRXcml0ZTogY2FsbGJhY2tPclNwZWN9O1xuICAgICAgY2FzZSBBZnRlclJlbmRlclBoYXNlLlJlYWQ6XG4gICAgICAgIHJldHVybiB7cmVhZDogY2FsbGJhY2tPclNwZWN9O1xuICAgIH1cbiAgfVxuICByZXR1cm4gY2FsbGJhY2tPclNwZWM7XG59XG5cbi8qKlxuICogU2hhcmVkIGltcGxlbWVudGF0aW9uIGZvciBgYWZ0ZXJSZW5kZXJgIGFuZCBgYWZ0ZXJOZXh0UmVuZGVyYC5cbiAqL1xuZnVuY3Rpb24gYWZ0ZXJSZW5kZXJJbXBsKFxuICBjYWxsYmFja09yU3BlYzpcbiAgICB8IFZvaWRGdW5jdGlvblxuICAgIHwge1xuICAgICAgICBlYXJseVJlYWQ/OiAoKSA9PiB1bmtub3duO1xuICAgICAgICB3cml0ZT86IChyPzogdW5rbm93bikgPT4gdW5rbm93bjtcbiAgICAgICAgbWl4ZWRSZWFkV3JpdGU/OiAocj86IHVua25vd24pID0+IHVua25vd247XG4gICAgICAgIHJlYWQ/OiAocj86IHVua25vd24pID0+IHZvaWQ7XG4gICAgICB9LFxuICBpbmplY3RvcjogSW5qZWN0b3IsXG4gIG9uY2U6IGJvb2xlYW4sXG4gIHBoYXNlOiBBZnRlclJlbmRlclBoYXNlLFxuKTogQWZ0ZXJSZW5kZXJSZWYge1xuICBjb25zdCBzcGVjID0gZ2V0U3BlYyhjYWxsYmFja09yU3BlYywgcGhhc2UpO1xuICBjb25zdCBhZnRlclJlbmRlckV2ZW50TWFuYWdlciA9IGluamVjdG9yLmdldChBZnRlclJlbmRlckV2ZW50TWFuYWdlcik7XG4gIC8vIExhemlseSBpbml0aWFsaXplIHRoZSBoYW5kbGVyIGltcGxlbWVudGF0aW9uLCBpZiBuZWNlc3NhcnkuIFRoaXMgaXMgc28gdGhhdCBpdCBjYW4gYmVcbiAgLy8gdHJlZS1zaGFrZW4gaWYgYGFmdGVyUmVuZGVyYCBhbmQgYGFmdGVyTmV4dFJlbmRlcmAgYXJlbid0IHVzZWQuXG4gIGNvbnN0IGNhbGxiYWNrSGFuZGxlciA9IChhZnRlclJlbmRlckV2ZW50TWFuYWdlci5oYW5kbGVyID8/PVxuICAgIG5ldyBBZnRlclJlbmRlckNhbGxiYWNrSGFuZGxlckltcGwoKSk7XG5cbiAgY29uc3QgcGlwZWxpbmVkQXJnczogW10gfCBbdW5rbm93bl0gPSBbXTtcbiAgY29uc3QgaW5zdGFuY2VzOiBBZnRlclJlbmRlckNhbGxiYWNrW10gPSBbXTtcblxuICBjb25zdCBkZXN0cm95ID0gKCkgPT4ge1xuICAgIGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgaW5zdGFuY2VzKSB7XG4gICAgICBjYWxsYmFja0hhbmRsZXIudW5yZWdpc3RlcihpbnN0YW5jZSk7XG4gICAgfVxuICAgIHVucmVnaXN0ZXJGbigpO1xuICB9O1xuICBjb25zdCB1bnJlZ2lzdGVyRm4gPSBpbmplY3Rvci5nZXQoRGVzdHJveVJlZikub25EZXN0cm95KGRlc3Ryb3kpO1xuICBsZXQgY2FsbGJhY2tzTGVmdFRvUnVuID0gMDtcblxuICBjb25zdCByZWdpc3RlckNhbGxiYWNrID0gKFxuICAgIHBoYXNlOiBBZnRlclJlbmRlclBoYXNlLFxuICAgIHBoYXNlQ2FsbGJhY2s6IHVuZGVmaW5lZCB8ICgoLi4uYXJnczogdW5rbm93bltdKSA9PiB1bmtub3duKSxcbiAgKSA9PiB7XG4gICAgaWYgKCFwaGFzZUNhbGxiYWNrKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGNhbGxiYWNrID0gb25jZVxuICAgICAgPyAoLi4uYXJnczogW3Vua25vd25dKSA9PiB7XG4gICAgICAgICAgY2FsbGJhY2tzTGVmdFRvUnVuLS07XG4gICAgICAgICAgaWYgKGNhbGxiYWNrc0xlZnRUb1J1biA8IDEpIHtcbiAgICAgICAgICAgIGRlc3Ryb3koKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcGhhc2VDYWxsYmFjayguLi5hcmdzKTtcbiAgICAgICAgfVxuICAgICAgOiBwaGFzZUNhbGxiYWNrO1xuXG4gICAgY29uc3QgaW5zdGFuY2UgPSBydW5JbkluamVjdGlvbkNvbnRleHQoXG4gICAgICBpbmplY3RvcixcbiAgICAgICgpID0+IG5ldyBBZnRlclJlbmRlckNhbGxiYWNrKHBoYXNlLCBwaXBlbGluZWRBcmdzLCBjYWxsYmFjayksXG4gICAgKTtcbiAgICBjYWxsYmFja0hhbmRsZXIucmVnaXN0ZXIoaW5zdGFuY2UpO1xuICAgIGluc3RhbmNlcy5wdXNoKGluc3RhbmNlKTtcbiAgICBjYWxsYmFja3NMZWZ0VG9SdW4rKztcbiAgfTtcblxuICByZWdpc3RlckNhbGxiYWNrKEFmdGVyUmVuZGVyUGhhc2UuRWFybHlSZWFkLCBzcGVjLmVhcmx5UmVhZCk7XG4gIHJlZ2lzdGVyQ2FsbGJhY2soQWZ0ZXJSZW5kZXJQaGFzZS5Xcml0ZSwgc3BlYy53cml0ZSk7XG4gIHJlZ2lzdGVyQ2FsbGJhY2soQWZ0ZXJSZW5kZXJQaGFzZS5NaXhlZFJlYWRXcml0ZSwgc3BlYy5taXhlZFJlYWRXcml0ZSk7XG4gIHJlZ2lzdGVyQ2FsbGJhY2soQWZ0ZXJSZW5kZXJQaGFzZS5SZWFkLCBzcGVjLnJlYWQpO1xuXG4gIHJldHVybiB7ZGVzdHJveX07XG59XG5cbi8qKlxuICogQSB3cmFwcGVyIGFyb3VuZCBhIGZ1bmN0aW9uIHRvIGJlIHVzZWQgYXMgYW4gYWZ0ZXIgcmVuZGVyIGNhbGxiYWNrLlxuICovXG5jbGFzcyBBZnRlclJlbmRlckNhbGxiYWNrIHtcbiAgcHJpdmF0ZSB6b25lID0gaW5qZWN0KE5nWm9uZSk7XG4gIHByaXZhdGUgZXJyb3JIYW5kbGVyID0gaW5qZWN0KEVycm9ySGFuZGxlciwge29wdGlvbmFsOiB0cnVlfSk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcmVhZG9ubHkgcGhhc2U6IEFmdGVyUmVuZGVyUGhhc2UsXG4gICAgcHJpdmF0ZSBwaXBlbGluZWRBcmdzOiBbXSB8IFt1bmtub3duXSxcbiAgICBwcml2YXRlIGNhbGxiYWNrRm46ICguLi5hcmdzOiB1bmtub3duW10pID0+IHVua25vd24sXG4gICkge1xuICAgIC8vIFJlZ2lzdGVyaW5nIGEgY2FsbGJhY2sgd2lsbCBub3RpZnkgdGhlIHNjaGVkdWxlci5cbiAgICBpbmplY3QoQ2hhbmdlRGV0ZWN0aW9uU2NoZWR1bGVyLCB7b3B0aW9uYWw6IHRydWV9KT8ubm90aWZ5KE5vdGlmaWNhdGlvblNvdXJjZS5OZXdSZW5kZXJIb29rKTtcbiAgfVxuXG4gIGludm9rZSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy56b25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+XG4gICAgICAgIHRoaXMuY2FsbGJhY2tGbi5hcHBseShudWxsLCB0aGlzLnBpcGVsaW5lZEFyZ3MgYXMgW3Vua25vd25dKSxcbiAgICAgICk7XG4gICAgICAvLyBDbGVhciBvdXQgdGhlIGFyZ3MgYW5kIGFkZCB0aGUgcmVzdWx0IHdoaWNoIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBuZXh0IHBoYXNlLlxuICAgICAgdGhpcy5waXBlbGluZWRBcmdzLnNwbGljZSgwLCB0aGlzLnBpcGVsaW5lZEFyZ3MubGVuZ3RoLCByZXN1bHQpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5lcnJvckhhbmRsZXI/LmhhbmRsZUVycm9yKGVycik7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogSW1wbGVtZW50cyBgYWZ0ZXJSZW5kZXJgIGFuZCBgYWZ0ZXJOZXh0UmVuZGVyYCBjYWxsYmFjayBoYW5kbGVyIGxvZ2ljLlxuICovXG5pbnRlcmZhY2UgQWZ0ZXJSZW5kZXJDYWxsYmFja0hhbmRsZXIge1xuICAvKipcbiAgICogUmVnaXN0ZXIgYSBuZXcgY2FsbGJhY2suXG4gICAqL1xuICByZWdpc3RlcihjYWxsYmFjazogQWZ0ZXJSZW5kZXJDYWxsYmFjayk6IHZvaWQ7XG5cbiAgLyoqXG4gICAqIFVucmVnaXN0ZXIgYW4gZXhpc3RpbmcgY2FsbGJhY2suXG4gICAqL1xuICB1bnJlZ2lzdGVyKGNhbGxiYWNrOiBBZnRlclJlbmRlckNhbGxiYWNrKTogdm9pZDtcblxuICAvKipcbiAgICogRXhlY3V0ZSBjYWxsYmFja3MuIFJldHVybnMgYHRydWVgIGlmIGFueSBjYWxsYmFja3Mgd2VyZSBleGVjdXRlZC5cbiAgICovXG4gIGV4ZWN1dGUoKTogdm9pZDtcblxuICAvKipcbiAgICogUGVyZm9ybSBhbnkgbmVjZXNzYXJ5IGNsZWFudXAuXG4gICAqL1xuICBkZXN0cm95KCk6IHZvaWQ7XG59XG5cbi8qKlxuICogQ29yZSBmdW5jdGlvbmFsaXR5IGZvciBgYWZ0ZXJSZW5kZXJgIGFuZCBgYWZ0ZXJOZXh0UmVuZGVyYC4gS2VwdCBzZXBhcmF0ZSBmcm9tXG4gKiBgQWZ0ZXJSZW5kZXJFdmVudE1hbmFnZXJgIGZvciB0cmVlLXNoYWtpbmcuXG4gKi9cbmNsYXNzIEFmdGVyUmVuZGVyQ2FsbGJhY2tIYW5kbGVySW1wbCBpbXBsZW1lbnRzIEFmdGVyUmVuZGVyQ2FsbGJhY2tIYW5kbGVyIHtcbiAgcHJpdmF0ZSBleGVjdXRpbmdDYWxsYmFja3MgPSBmYWxzZTtcbiAgcHJpdmF0ZSBidWNrZXRzID0ge1xuICAgIC8vIE5vdGU6IHRoZSBvcmRlciBvZiB0aGVzZSBrZXlzIGNvbnRyb2xzIHRoZSBvcmRlciB0aGUgcGhhc2VzIGFyZSBydW4uXG4gICAgW0FmdGVyUmVuZGVyUGhhc2UuRWFybHlSZWFkXTogbmV3IFNldDxBZnRlclJlbmRlckNhbGxiYWNrPigpLFxuICAgIFtBZnRlclJlbmRlclBoYXNlLldyaXRlXTogbmV3IFNldDxBZnRlclJlbmRlckNhbGxiYWNrPigpLFxuICAgIFtBZnRlclJlbmRlclBoYXNlLk1peGVkUmVhZFdyaXRlXTogbmV3IFNldDxBZnRlclJlbmRlckNhbGxiYWNrPigpLFxuICAgIFtBZnRlclJlbmRlclBoYXNlLlJlYWRdOiBuZXcgU2V0PEFmdGVyUmVuZGVyQ2FsbGJhY2s+KCksXG4gIH07XG4gIHByaXZhdGUgZGVmZXJyZWRDYWxsYmFja3MgPSBuZXcgU2V0PEFmdGVyUmVuZGVyQ2FsbGJhY2s+KCk7XG5cbiAgcmVnaXN0ZXIoY2FsbGJhY2s6IEFmdGVyUmVuZGVyQ2FsbGJhY2spOiB2b2lkIHtcbiAgICAvLyBJZiB3ZSdyZSBjdXJyZW50bHkgcnVubmluZyBjYWxsYmFja3MsIG5ldyBjYWxsYmFja3Mgc2hvdWxkIGJlIGRlZmVycmVkXG4gICAgLy8gdW50aWwgdGhlIG5leHQgcmVuZGVyIG9wZXJhdGlvbi5cbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLmV4ZWN1dGluZ0NhbGxiYWNrcyA/IHRoaXMuZGVmZXJyZWRDYWxsYmFja3MgOiB0aGlzLmJ1Y2tldHNbY2FsbGJhY2sucGhhc2VdO1xuICAgIHRhcmdldC5hZGQoY2FsbGJhY2spO1xuICB9XG5cbiAgdW5yZWdpc3RlcihjYWxsYmFjazogQWZ0ZXJSZW5kZXJDYWxsYmFjayk6IHZvaWQge1xuICAgIHRoaXMuYnVja2V0c1tjYWxsYmFjay5waGFzZV0uZGVsZXRlKGNhbGxiYWNrKTtcbiAgICB0aGlzLmRlZmVycmVkQ2FsbGJhY2tzLmRlbGV0ZShjYWxsYmFjayk7XG4gIH1cblxuICBleGVjdXRlKCk6IHZvaWQge1xuICAgIHRoaXMuZXhlY3V0aW5nQ2FsbGJhY2tzID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IGJ1Y2tldCBvZiBPYmplY3QudmFsdWVzKHRoaXMuYnVja2V0cykpIHtcbiAgICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgYnVja2V0KSB7XG4gICAgICAgIGNhbGxiYWNrLmludm9rZSgpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmV4ZWN1dGluZ0NhbGxiYWNrcyA9IGZhbHNlO1xuXG4gICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLmRlZmVycmVkQ2FsbGJhY2tzKSB7XG4gICAgICB0aGlzLmJ1Y2tldHNbY2FsbGJhY2sucGhhc2VdLmFkZChjYWxsYmFjayk7XG4gICAgfVxuICAgIHRoaXMuZGVmZXJyZWRDYWxsYmFja3MuY2xlYXIoKTtcbiAgfVxuXG4gIGRlc3Ryb3koKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBidWNrZXQgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmJ1Y2tldHMpKSB7XG4gICAgICBidWNrZXQuY2xlYXIoKTtcbiAgICB9XG4gICAgdGhpcy5kZWZlcnJlZENhbGxiYWNrcy5jbGVhcigpO1xuICB9XG59XG5cbi8qKlxuICogSW1wbGVtZW50cyBjb3JlIHRpbWluZyBmb3IgYGFmdGVyUmVuZGVyYCBhbmQgYGFmdGVyTmV4dFJlbmRlcmAgZXZlbnRzLlxuICogRGVsZWdhdGVzIHRvIGFuIG9wdGlvbmFsIGBBZnRlclJlbmRlckNhbGxiYWNrSGFuZGxlcmAgZm9yIGltcGxlbWVudGF0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgQWZ0ZXJSZW5kZXJFdmVudE1hbmFnZXIge1xuICAvKiBAaW50ZXJuYWwgKi9cbiAgaGFuZGxlcjogQWZ0ZXJSZW5kZXJDYWxsYmFja0hhbmRsZXIgfCBudWxsID0gbnVsbDtcblxuICAvKiBAaW50ZXJuYWwgKi9cbiAgaW50ZXJuYWxDYWxsYmFja3M6IFZvaWRGdW5jdGlvbltdID0gW107XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGVzIGludGVybmFsIGFuZCB1c2VyLXByb3ZpZGVkIGNhbGxiYWNrcy5cbiAgICovXG4gIGV4ZWN1dGUoKTogdm9pZCB7XG4gICAgdGhpcy5leGVjdXRlSW50ZXJuYWxDYWxsYmFja3MoKTtcbiAgICB0aGlzLmhhbmRsZXI/LmV4ZWN1dGUoKTtcbiAgfVxuXG4gIGV4ZWN1dGVJbnRlcm5hbENhbGxiYWNrcygpIHtcbiAgICAvLyBOb3RlOiBpbnRlcm5hbCBjYWxsYmFja3MgcG93ZXIgYGludGVybmFsQWZ0ZXJOZXh0UmVuZGVyYC4gU2luY2UgaW50ZXJuYWwgY2FsbGJhY2tzXG4gICAgLy8gYXJlIGZhaXJseSB0cml2aWFsLCB0aGV5IGFyZSBrZXB0IHNlcGFyYXRlIHNvIHRoYXQgYEFmdGVyUmVuZGVyQ2FsbGJhY2tIYW5kbGVySW1wbGBcbiAgICAvLyBjYW4gc3RpbGwgYmUgdHJlZS1zaGFrZW4gdW5sZXNzIHVzZWQgYnkgdGhlIGFwcGxpY2F0aW9uLlxuICAgIGNvbnN0IGNhbGxiYWNrcyA9IFsuLi50aGlzLmludGVybmFsQ2FsbGJhY2tzXTtcbiAgICB0aGlzLmludGVybmFsQ2FsbGJhY2tzLmxlbmd0aCA9IDA7XG4gICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiBjYWxsYmFja3MpIHtcbiAgICAgIGNhbGxiYWNrKCk7XG4gICAgfVxuICB9XG5cbiAgbmdPbkRlc3Ryb3koKSB7XG4gICAgdGhpcy5oYW5kbGVyPy5kZXN0cm95KCk7XG4gICAgdGhpcy5oYW5kbGVyID0gbnVsbDtcbiAgICB0aGlzLmludGVybmFsQ2FsbGJhY2tzLmxlbmd0aCA9IDA7XG4gIH1cblxuICAvKiogQG5vY29sbGFwc2UgKi9cbiAgc3RhdGljIMm1cHJvdiA9IC8qKiBAcHVyZU9yQnJlYWtNeUNvZGUgKi8gybXJtWRlZmluZUluamVjdGFibGUoe1xuICAgIHRva2VuOiBBZnRlclJlbmRlckV2ZW50TWFuYWdlcixcbiAgICBwcm92aWRlZEluOiAncm9vdCcsXG4gICAgZmFjdG9yeTogKCkgPT4gbmV3IEFmdGVyUmVuZGVyRXZlbnRNYW5hZ2VyKCksXG4gIH0pO1xufVxuIl19