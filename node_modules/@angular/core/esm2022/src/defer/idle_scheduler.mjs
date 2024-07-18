/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { inject, ɵɵdefineInjectable } from '../di';
import { INJECTOR } from '../render3/interfaces/view';
import { NgZone } from '../zone';
/**
 * Helper function to schedule a callback to be invoked when a browser becomes idle.
 *
 * @param callback A function to be invoked when a browser becomes idle.
 * @param lView LView that hosts an instance of a defer block.
 */
export function onIdle(callback, lView) {
    const injector = lView[INJECTOR];
    const scheduler = injector.get(IdleScheduler);
    const cleanupFn = () => scheduler.remove(callback);
    scheduler.add(callback);
    return cleanupFn;
}
/**
 * Use shims for the `requestIdleCallback` and `cancelIdleCallback` functions for
 * environments where those functions are not available (e.g. Node.js and Safari).
 *
 * Note: we wrap the `requestIdleCallback` call into a function, so that it can be
 * overridden/mocked in test environment and picked up by the runtime code.
 */
const _requestIdleCallback = () => typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : setTimeout;
const _cancelIdleCallback = () => typeof requestIdleCallback !== 'undefined' ? cancelIdleCallback : clearTimeout;
/**
 * Helper service to schedule `requestIdleCallback`s for batches of defer blocks,
 * to avoid calling `requestIdleCallback` for each defer block (e.g. if
 * defer blocks are defined inside a for loop).
 */
export class IdleScheduler {
    constructor() {
        // Indicates whether current callbacks are being invoked.
        this.executingCallbacks = false;
        // Currently scheduled idle callback id.
        this.idleId = null;
        // Set of callbacks to be invoked next.
        this.current = new Set();
        // Set of callbacks collected while invoking current set of callbacks.
        // Those callbacks are scheduled for the next idle period.
        this.deferred = new Set();
        this.ngZone = inject(NgZone);
        this.requestIdleCallbackFn = _requestIdleCallback().bind(globalThis);
        this.cancelIdleCallbackFn = _cancelIdleCallback().bind(globalThis);
    }
    add(callback) {
        const target = this.executingCallbacks ? this.deferred : this.current;
        target.add(callback);
        if (this.idleId === null) {
            this.scheduleIdleCallback();
        }
    }
    remove(callback) {
        const { current, deferred } = this;
        current.delete(callback);
        deferred.delete(callback);
        // If the last callback was removed and there is a pending
        // idle callback - cancel it.
        if (current.size === 0 && deferred.size === 0) {
            this.cancelIdleCallback();
        }
    }
    scheduleIdleCallback() {
        const callback = () => {
            this.cancelIdleCallback();
            this.executingCallbacks = true;
            for (const callback of this.current) {
                callback();
            }
            this.current.clear();
            this.executingCallbacks = false;
            // If there are any callbacks added during an invocation
            // of the current ones - make them "current" and schedule
            // a new idle callback.
            if (this.deferred.size > 0) {
                for (const callback of this.deferred) {
                    this.current.add(callback);
                }
                this.deferred.clear();
                this.scheduleIdleCallback();
            }
        };
        // Ensure that the callback runs in the NgZone since
        // the `requestIdleCallback` is not currently patched by Zone.js.
        this.idleId = this.requestIdleCallbackFn(() => this.ngZone.run(callback));
    }
    cancelIdleCallback() {
        if (this.idleId !== null) {
            this.cancelIdleCallbackFn(this.idleId);
            this.idleId = null;
        }
    }
    ngOnDestroy() {
        this.cancelIdleCallback();
        this.current.clear();
        this.deferred.clear();
    }
    /** @nocollapse */
    static { this.ɵprov = ɵɵdefineInjectable({
        token: IdleScheduler,
        providedIn: 'root',
        factory: () => new IdleScheduler(),
    }); }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRsZV9zY2hlZHVsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9kZWZlci9pZGxlX3NjaGVkdWxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsTUFBTSxFQUFFLGtCQUFrQixFQUFDLE1BQU0sT0FBTyxDQUFDO0FBQ2pELE9BQU8sRUFBQyxRQUFRLEVBQVEsTUFBTSw0QkFBNEIsQ0FBQztBQUMzRCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRS9COzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLE1BQU0sQ0FBQyxRQUFzQixFQUFFLEtBQVk7SUFDekQsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBRSxDQUFDO0lBQ2xDLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDOUMsTUFBTSxTQUFTLEdBQUcsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNuRCxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3hCLE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLG9CQUFvQixHQUFHLEdBQUcsRUFBRSxDQUNoQyxPQUFPLG1CQUFtQixLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQztBQUNoRixNQUFNLG1CQUFtQixHQUFHLEdBQUcsRUFBRSxDQUMvQixPQUFPLG1CQUFtQixLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQztBQUVqRjs7OztHQUlHO0FBQ0gsTUFBTSxPQUFPLGFBQWE7SUFBMUI7UUFDRSx5REFBeUQ7UUFDekQsdUJB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QUFDO1FBQ3JCLENBQUM7SUFDSCxDQUFDO0lBRUQsV0FBVztRQUNULElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBQzFCLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDckIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUN4QixDQUFDO0lBRUQsa0JBQWtCO2FBQ1gsVUFBSyxHQUE2QixrQkFBa0IsQ0FBQztRQUMxRCxLQUFLLEVBQUUsYUFBYTtRQUNwQixVQUFVLEVBQUUsTUFBTTtRQUNsQixPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxhQUFhLEVBQUU7S0FDbkMsQ0FBQyxBQUpVLENBSVQiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtpbmplY3QsIMm1ybVkZWZpbmVJbmplY3RhYmxlfSBmcm9tICcuLi9kaSc7XG5pbXBvcnQge0lOSkVDVE9SLCBMVmlld30gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL3ZpZXcnO1xuaW1wb3J0IHtOZ1pvbmV9IGZyb20gJy4uL3pvbmUnO1xuXG4vKipcbiAqIEhlbHBlciBmdW5jdGlvbiB0byBzY2hlZHVsZSBhIGNhbGxiYWNrIHRvIGJlIGludm9rZWQgd2hlbiBhIGJyb3dzZXIgYmVjb21lcyBpZGxlLlxuICpcbiAqIEBwYXJhbSBjYWxsYmFjayBBIGZ1bmN0aW9uIHRvIGJlIGludm9rZWQgd2hlbiBhIGJyb3dzZXIgYmVjb21lcyBpZGxlLlxuICogQHBhcmFtIGxWaWV3IExWaWV3IHRoYXQgaG9zdHMgYW4gaW5zdGFuY2Ugb2YgYSBkZWZlciBibG9jay5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG9uSWRsZShjYWxsYmFjazogVm9pZEZ1bmN0aW9uLCBsVmlldzogTFZpZXcpIHtcbiAgY29uc3QgaW5qZWN0b3IgPSBsVmlld1tJTkpFQ1RPUl0hO1xuICBjb25zdCBzY2hlZHVsZXIgPSBpbmplY3Rvci5nZXQoSWRsZVNjaGVkdWxlcik7XG4gIGNvbnN0IGNsZWFudXBGbiA9ICgpID0+IHNjaGVkdWxlci5yZW1vdmUoY2FsbGJhY2spO1xuICBzY2hlZHVsZXIuYWRkKGNhbGxiYWNrKTtcbiAgcmV0dXJuIGNsZWFudXBGbjtcbn1cblxuLyoqXG4gKiBVc2Ugc2hpbXMgZm9yIHRoZSBgcmVxdWVzdElkbGVDYWxsYmFja2AgYW5kIGBjYW5jZWxJZGxlQ2FsbGJhY2tgIGZ1bmN0aW9ucyBmb3JcbiAqIGVudmlyb25tZW50cyB3aGVyZSB0aG9zZSBmdW5jdGlvbnMgYXJlIG5vdCBhdmFpbGFibGUgKGUuZy4gTm9kZS5qcyBhbmQgU2FmYXJpKS5cbiAqXG4gKiBOb3RlOiB3ZSB3cmFwIHRoZSBgcmVxdWVzdElkbGVDYWxsYmFja2AgY2FsbCBpbnRvIGEgZnVuY3Rpb24sIHNvIHRoYXQgaXQgY2FuIGJlXG4gKiBvdmVycmlkZGVuL21vY2tlZCBpbiB0ZXN0IGVudmlyb25tZW50IGFuZCBwaWNrZWQgdXAgYnkgdGhlIHJ1bnRpbWUgY29kZS5cbiAqL1xuY29uc3QgX3JlcXVlc3RJZGxlQ2FsbGJhY2sgPSAoKSA9PlxuICB0eXBlb2YgcmVxdWVzdElkbGVDYWxsYmFjayAhPT0gJ3VuZGVmaW5lZCcgPyByZXF1ZXN0SWRsZUNhbGxiYWNrIDogc2V0VGltZW91dDtcbmNvbnN0IF9jYW5jZWxJZGxlQ2FsbGJhY2sgPSAoKSA9PlxuICB0eXBlb2YgcmVxdWVzdElkbGVDYWxsYmFjayAhPT0gJ3VuZGVmaW5lZCcgPyBjYW5jZWxJZGxlQ2FsbGJhY2sgOiBjbGVhclRpbWVvdXQ7XG5cbi8qKlxuICogSGVscGVyIHNlcnZpY2UgdG8gc2NoZWR1bGUgYHJlcXVlc3RJZGxlQ2FsbGJhY2tgcyBmb3IgYmF0Y2hlcyBvZiBkZWZlciBibG9ja3MsXG4gKiB0byBhdm9pZCBjYWxsaW5nIGByZXF1ZXN0SWRsZUNhbGxiYWNrYCBmb3IgZWFjaCBkZWZlciBibG9jayAoZS5nLiBpZlxuICogZGVmZXIgYmxvY2tzIGFyZSBkZWZpbmVkIGluc2lkZSBhIGZvciBsb29wKS5cbiAqL1xuZXhwb3J0IGNsYXNzIElkbGVTY2hlZHVsZXIge1xuICAvLyBJbmRpY2F0ZXMgd2hldGhlciBjdXJyZW50IGNhbGxiYWNrcyBhcmUgYmVpbmcgaW52b2tlZC5cbiAgZXhlY3V0aW5nQ2FsbGJhY2tzID0gZmFsc2U7XG5cbiAgLy8gQ3VycmVudGx5IHNjaGVkdWxlZCBpZGxlIGNhbGxiYWNrIGlkLlxuICBpZGxlSWQ6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIC8vIFNldCBvZiBjYWxsYmFja3MgdG8gYmUgaW52b2tlZCBuZXh0LlxuICBjdXJyZW50ID0gbmV3IFNldDxWb2lkRnVuY3Rpb24+KCk7XG5cbiAgLy8gU2V0IG9mIGNhbGxiYWNrcyBjb2xsZWN0ZWQgd2hpbGUgaW52b2tpbmcgY3VycmVudCBzZXQgb2YgY2FsbGJhY2tzLlxuICAvLyBUaG9zZSBjYWxsYmFja3MgYXJlIHNjaGVkdWxlZCBmb3IgdGhlIG5leHQgaWRsZSBwZXJpb2QuXG4gIGRlZmVycmVkID0gbmV3IFNldDxWb2lkRnVuY3Rpb24+KCk7XG5cbiAgbmdab25lID0gaW5qZWN0KE5nWm9uZSk7XG5cbiAgcmVxdWVzdElkbGVDYWxsYmFja0ZuID0gX3JlcXVlc3RJZGxlQ2FsbGJhY2soKS5iaW5kKGdsb2JhbFRoaXMpO1xuICBjYW5jZWxJZGxlQ2FsbGJhY2tGbiA9IF9jYW5jZWxJZGxlQ2FsbGJhY2soKS5iaW5kKGdsb2JhbFRoaXMpO1xuXG4gIGFkZChjYWxsYmFjazogVm9pZEZ1bmN0aW9uKSB7XG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5leGVjdXRpbmdDYWxsYmFja3MgPyB0aGlzLmRlZmVycmVkIDogdGhpcy5jdXJyZW50O1xuICAgIHRhcmdldC5hZGQoY2FsbGJhY2spO1xuICAgIGlmICh0aGlzLmlkbGVJZCA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5zY2hlZHVsZUlkbGVDYWxsYmFjaygpO1xuICAgIH1cbiAgfVxuXG4gIHJlbW92ZShjYWxsYmFjazogVm9pZEZ1bmN0aW9uKSB7XG4gICAgY29uc3Qge2N1cnJlbnQsIGRlZmVycmVkfSA9IHRoaXM7XG5cbiAgICBjdXJyZW50LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgZGVmZXJyZWQuZGVsZXRlKGNhbGxiYWNrKTtcblxuICAgIC8vIElmIHRoZSBsYXN0IGNhbGxiYWNrIHdhcyByZW1vdmVkIGFuZCB0aGVyZSBpcyBhIHBlbmRpbmdcbiAgICAvLyBpZGxlIGNhbGxiYWNrIC0gY2FuY2VsIGl0LlxuICAgIGlmIChjdXJyZW50LnNpemUgPT09IDAgJiYgZGVmZXJyZWQuc2l6ZSA9PT0gMCkge1xuICAgICAgdGhpcy5jYW5jZWxJZGxlQ2FsbGJhY2soKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHNjaGVkdWxlSWRsZUNhbGxiYWNrKCkge1xuICAgIGNvbnN0IGNhbGxiYWNrID0gKCkgPT4ge1xuICAgICAgdGhpcy5jYW5jZWxJZGxlQ2FsbGJhY2soKTtcblxuICAgICAgdGhpcy5leGVjdXRpbmdDYWxsYmFja3MgPSB0cnVlO1xuXG4gICAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuY3VycmVudCkge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfVxuICAgICAgdGhpcy5jdXJyZW50LmNsZWFyKCk7XG5cbiAgICAgIHRoaXMuZXhlY3V0aW5nQ2FsbGJhY2tzID0gZmFsc2U7XG5cbiAgICAgIC8vIElmIHRoZXJlIGFyZSBhbnkgY2FsbGJhY2tzIGFkZGVkIGR1cmluZyBhbiBpbnZvY2F0aW9uXG4gICAgICAvLyBvZiB0aGUgY3VycmVudCBvbmVzIC0gbWFrZSB0aGVtIFwiY3VycmVudFwiIGFuZCBzY2hlZHVsZVxuICAgICAgLy8gYSBuZXcgaWRsZSBjYWxsYmFjay5cbiAgICAgIGlmICh0aGlzLmRlZmVycmVkLnNpemUgPiAwKSB7XG4gICAgICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgdGhpcy5kZWZlcnJlZCkge1xuICAgICAgICAgIHRoaXMuY3VycmVudC5hZGQoY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZGVmZXJyZWQuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5zY2hlZHVsZUlkbGVDYWxsYmFjaygpO1xuICAgICAgfVxuICAgIH07XG4gICAgLy8gRW5zdXJlIHRoYXQgdGhlIGNhbGxiYWNrIHJ1bnMgaW4gdGhlIE5nWm9uZSBzaW5jZVxuICAgIC8vIHRoZSBgcmVxdWVzdElkbGVDYWxsYmFja2AgaXMgbm90IGN1cnJlbnRseSBwYXRjaGVkIGJ5IFpvbmUuanMuXG4gICAgdGhpcy5pZGxlSWQgPSB0aGlzLnJlcXVlc3RJZGxlQ2FsbGJhY2tGbigoKSA9PiB0aGlzLm5nWm9uZS5ydW4oY2FsbGJhY2spKSBhcyBudW1iZXI7XG4gIH1cblxuICBwcml2YXRlIGNhbmNlbElkbGVDYWxsYmFjaygpIHtcbiAgICBpZiAodGhpcy5pZGxlSWQgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuY2FuY2VsSWRsZUNhbGxiYWNrRm4odGhpcy5pZGxlSWQpO1xuICAgICAgdGhpcy5pZGxlSWQgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIG5nT25EZXN0cm95KCkge1xuICAgIHRoaXMuY2FuY2VsSWRsZUNhbGxiYWNrKCk7XG4gICAgdGhpcy5jdXJyZW50LmNsZWFyKCk7XG4gICAgdGhpcy5kZWZlcnJlZC5jbGVhcigpO1xuICB9XG5cbiAgLyoqIEBub2NvbGxhcHNlICovXG4gIHN0YXRpYyDJtXByb3YgPSAvKiogQHB1cmVPckJyZWFrTXlDb2RlICovIMm1ybVkZWZpbmVJbmplY3RhYmxlKHtcbiAgICB0b2tlbjogSWRsZVNjaGVkdWxlcixcbiAgICBwcm92aWRlZEluOiAncm9vdCcsXG4gICAgZmFjdG9yeTogKCkgPT4gbmV3IElkbGVTY2hlZHVsZXIoKSxcbiAgfSk7XG59XG4iXX0=