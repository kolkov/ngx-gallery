/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ɵɵdefineInjectable } from '../di';
import { INJECTOR } from '../render3/interfaces/view';
import { arrayInsert2, arraySplice } from '../util/array_utils';
/**
 * Returns a function that captures a provided delay.
 * Invoking the returned function schedules a trigger.
 */
export function onTimer(delay) {
    return (callback, lView) => scheduleTimerTrigger(delay, callback, lView);
}
/**
 * Schedules a callback to be invoked after a given timeout.
 *
 * @param delay A number of ms to wait until firing a callback.
 * @param callback A function to be invoked after a timeout.
 * @param lView LView that hosts an instance of a defer block.
 */
export function scheduleTimerTrigger(delay, callback, lView) {
    const injector = lView[INJECTOR];
    const scheduler = injector.get(TimerScheduler);
    const cleanupFn = () => scheduler.remove(callback);
    scheduler.add(delay, callback);
    return cleanupFn;
}
/**
 * Helper service to schedule `setTimeout`s for batches of defer blocks,
 * to avoid calling `setTimeout` for each defer block (e.g. if defer blocks
 * are created inside a for loop).
 */
export class TimerScheduler {
    constructor() {
        // Indicates whether current callbacks are being invoked.
        this.executingCallbacks = false;
        // Currently scheduled `setTimeout` id.
        this.timeoutId = null;
        // When currently scheduled timer would fire.
        this.invokeTimerAt = null;
        // List of callbacks to be invoked.
        // For each callback we also store a timestamp on when the callback
        // should be invoked. We store timestamps and callback functions
        // in a flat array to avoid creating new objects for each entry.
        // [timestamp1, callback1, timestamp2, callback2, ...]
        this.current = [];
        // List of callbacks collected while invoking current set of callbacks.
        // Those callbacks are added to the "current" queue at the end of
        // the current callback invocation. The shape of this list is the same
        // as the shape of the `current` list.
        this.deferred = [];
    }
    add(delay, callback) {
        const target = this.executingCallbacks ? this.deferred : this.current;
        this.addToQueue(target, Date.now() + delay, callback);
        this.scheduleTimer();
    }
    remove(callback) {
        const { current, deferred } = this;
        const callbackIndex = this.removeFromQueue(current, callback);
        if (callbackIndex === -1) {
            // Try cleaning up deferred queue only in case
            // we didn't find a callback in the "current" queue.
            this.removeFromQueue(deferred, callback);
        }
        // If the last callback was removed and there is a pending timeout - cancel it.
        if (current.length === 0 && deferred.length === 0) {
            this.clearTimeout();
        }
    }
    addToQueue(target, invokeAt, callback) {
        let insertAtIndex = target.length;
        for (let i = 0; i < target.length; i += 2) {
            const invokeQueuedCallbackAt = target[i];
            if (invokeQueuedCallbackAt > invokeAt) {
                // We've reached a first timer that is scheduled
                // for a later time than what we are trying to insert.
                // This is the location at which we need to insert,
                // no need to iterate further.
                insertAtIndex = i;
                break;
            }
        }
        arrayInsert2(target, insertAtIndex, invokeAt, callback);
    }
    removeFromQueue(target, callback) {
        let index = -1;
        for (let i = 0; i < target.length; i += 2) {
            const queuedCallback = target[i + 1];
            if (queuedCallback === callback) {
                index = i;
                break;
            }
        }
        if (index > -1) {
            // Remove 2 elements: a timestamp slot and
            // the following slot with a callback function.
            arraySplice(target, index, 2);
        }
        return index;
    }
    scheduleTimer() {
        const callback = () => {
            this.clearTimeout();
            this.executingCallbacks = true;
            // Clone the current state of the queue, since it might be altered
            // as we invoke callbacks.
            const current = [...this.current];
            // Invoke callbacks that were scheduled to run before the current time.
            const now = Date.now();
            for (let i = 0; i < current.length; i += 2) {
                const invokeAt = current[i];
                const callback = current[i + 1];
                if (invokeAt <= now) {
                    callback();
                }
                else {
                    // We've reached a timer that should not be invoked yet.
                    break;
                }
            }
            // The state of the queue might've changed after callbacks invocation,
            // run the cleanup logic based on the *current* state of the queue.
            let lastCallbackIndex = -1;
            for (let i = 0; i < this.current.length; i += 2) {
                const invokeAt = this.current[i];
                if (invokeAt <= now) {
                    // Add +1 to account for a callback function that
                    // goes after the timestamp in events array.
                    lastCallbackIndex = i + 1;
                }
                else {
                    // We've reached a timer that should not be invoked yet.
                    break;
                }
            }
            if (lastCallbackIndex >= 0) {
                arraySplice(this.current, 0, lastCallbackIndex + 1);
            }
            this.executingCallbacks = false;
            // If there are any callbacks added during an invocation
            // of the current ones - move them over to the "current"
            // queue.
            if (this.deferred.length > 0) {
                for (let i = 0; i < this.deferred.length; i += 2) {
                    const invokeAt = this.deferred[i];
                    const callback = this.deferred[i + 1];
                    this.addToQueue(this.current, invokeAt, callback);
                }
                this.deferred.length = 0;
            }
            this.scheduleTimer();
        };
        // Avoid running timer callbacks more than once per
        // average frame duration. This is needed for better
        // batching and to avoid kicking off excessive change
        // detection cycles.
        const FRAME_DURATION_MS = 16; // 1000ms / 60fps
        if (this.current.length > 0) {
            const now = Date.now();
            // First element in the queue points at the timestamp
            // of the first (earliest) event.
            const invokeAt = this.current[0];
            if (this.timeoutId === null ||
                // Reschedule a timer in case a queue contains an item with
                // an earlier timestamp and the delta is more than an average
                // frame duration.
                (this.invokeTimerAt && this.invokeTimerAt - invokeAt > FRAME_DURATION_MS)) {
                // There was a timeout already, but an earlier event was added
                // into the queue. In this case we drop an old timer and setup
                // a new one with an updated (smaller) timeout.
                this.clearTimeout();
                const timeout = Math.max(invokeAt - now, FRAME_DURATION_MS);
                this.invokeTimerAt = invokeAt;
                this.timeoutId = setTimeout(callback, timeout);
            }
        }
    }
    clearTimeout() {
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }
    ngOnDestroy() {
        this.clearTimeout();
        this.current.length = 0;
        this.deferred.length = 0;
    }
    /** @nocollapse */
    static { this.ɵprov = ɵɵdefineInjectable({
        token: TimerScheduler,
        providedIn: 'root',
        factory: () => new TimerScheduler(),
    }); }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGltZXJfc2NoZWR1bGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvZGVmZXIvdGltZXJfc2NoZWR1bGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLE9BQU8sQ0FBQztBQUN6QyxPQUFPLEVBQUMsUUFBUSxFQUFRLE1BQU0sNEJBQTRCLENBQUM7QUFDM0QsT0FBTyxFQUFDLFlBQVksRUFBRSxXQUFXLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUU5RDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsT0FBTyxDQUFDLEtBQWE7SUFDbkMsT0FBTyxDQUFDLFFBQXNCLEVBQUUsS0FBWSxFQUFFLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ2hHLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsS0FBYSxFQUFFLFFBQXNCLEVBQUUsS0FBWTtJQUN0RixNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFFLENBQUM7SUFDbEMsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUMvQyxNQUFNLFNBQVMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ25ELFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQy9CLE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsTUFBTSxPQUFPLGNBQWM7SUFBM0I7UUFDRSx5REFBeUQ7UUFDekQsdUJBQWtCLEdBQUcsS0FBSyxDQUFDO1FBRTNCLHVDQUF1QztRQUN2QyxjQUFTLEdBQWtCLElBQUksQ0FBQztRQUVoQyw2Q0FBNkM7UUFDN0Msa0JBQWEsR0FBa0IsSUFBSSxDQUFDO1FBRXBDLG1DQUFtQztRQUNuQyxtRUFBbUU7UUFDbkUsZ0VBQWdFO1FBQ2hFLGdFQUFnRTtRQUNoRSxzREFBc0Q7UUFDdEQsWUFBTyxHQUFpQyxFQUFFLENBQUM7UUFFM0MsdUVBQXVFO1FBQ3ZFLGlFQUFpRTtRQUNqRSxzRUFBc0U7UUFDdEUsc0NBQXNDO1FBQ3RDLGFBQVEsR0FBaUMsRUFBRSxDQUFDO0lBb0s5QyxDQUFDO0lBbEtDLEdBQUcsQ0FBQyxLQUFhLEVBQUUsUUFBc0I7UUFDdkMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO1FBQ3RFLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDdEQsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxNQUFNLENBQUMsUUFBc0I7UUFDM0IsTUFBTSxFQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUMsR0FBRyxJQUFJLENBQUM7UUFDakMsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDOUQsSUFBSSxhQUFhLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUN6Qiw4Q0FBOEM7WUFDOUMsb0RBQW9EO1lBQ3BELElBQUksQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzNDLENBQUM7UUFDRCwrRUFBK0U7UUFDL0UsSUFBSSxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ2xELElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUN0QixDQUFDO0lBQ0gsQ0FBQztJQUVPLFVBQVUsQ0FDaEIsTUFBb0MsRUFDcEMsUUFBZ0IsRUFDaEIsUUFBc0I7UUFFdEIsSUFBSSxhQUFhLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUNsQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDMUMsTUFBTSxzQkFBc0IsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFXLENBQUM7WUFDbkQsSUFBSSxzQkFBc0IsR0FBRyxRQUFRLEVBQUUsQ0FBQztnQkFDdEMsZ0RBQWdEO2dCQUNoRCxzREFBc0Q7Z0JBQ3RELG1EQUFtRDtnQkFDbkQsOEJBQThCO2dCQUM5QixhQUFhLEdBQUcsQ0FBQyxDQUFDO2dCQUNsQixNQUFNO1lBQ1IsQ0FBQztRQUNILENBQUM7UUFDRCxZQUFZLENBQUMsTUFBTSxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDMUQsQ0FBQztJQUVPLGVBQWUsQ0FBQyxNQUFvQyxFQUFFLFFBQXNCO1FBQ2xGLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2YsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQzFDLE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDckMsSUFBSSxjQUFjLEtBQUssUUFBUSxFQUFFLENBQUM7Z0JBQ2hDLEtBQUssR0FBRyxDQUFDLENBQUM7Z0JBQ1YsTUFBTTtZQUNSLENBQUM7UUFDSCxDQUFDO1FBQ0QsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNmLDBDQUEwQztZQUMxQywrQ0FBK0M7WUFDL0MsV0FBVyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDaEMsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVPLGFBQWE7UUFDbkIsTUFBTSxRQUFRLEdBQUcsR0FBRyxFQUFFO1lBQ3BCLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUVwQixJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO1lBRS9CLGtFQUFrRTtZQUNsRSwwQkFBMEI7WUFDMUIsTUFBTSxPQUFPLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUVsQyx1RUFBdUU7WUFDdkUsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ3ZCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDM0MsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBVyxDQUFDO2dCQUN0QyxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBaUIsQ0FBQztnQkFDaEQsSUFBSSxRQUFRLElBQUksR0FBRyxFQUFFLENBQUM7b0JBQ3BCLFFBQVEsRUFBRSxDQUFDO2dCQUNiLENBQUM7cUJBQU0sQ0FBQztvQkFDTix3REFBd0Q7b0JBQ3hELE1BQU07Z0JBQ1IsQ0FBQztZQUNILENBQUM7WUFDRCxzRUFBc0U7WUFDdEUsbUVBQW1FO1lBQ25FLElBQUksaUJBQWlCLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDM0IsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDaEQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQVcsQ0FBQztnQkFDM0MsSUFBSSxRQUFRLElBQUksR0FBRyxFQUFFLENBQUM7b0JBQ3BCLGlEQUFpRDtvQkFDakQsNENBQTRDO29CQUM1QyxpQkFBaUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUM1QixDQUFDO3FCQUFNLENBQUM7b0JBQ04sd0RBQXdEO29CQUN4RCxNQUFNO2dCQUNSLENBQUM7WUFDSCxDQUFDO1lBQ0QsSUFBSSxpQkFBaUIsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDM0IsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxFQUFFLGlCQUFpQixHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ3RELENBQUM7WUFFRCxJQUFJLENBQUMsa0JBQWtCLEdBQUcsS0FBSyxDQUFDO1lBRWhDLHdEQUF3RDtZQUN4RCx3REFBd0Q7WUFDeEQsU0FBUztZQUNULElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQzdCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQ2pELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFXLENBQUM7b0JBQzVDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBaUIsQ0FBQztvQkFDdEQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQztnQkFDcEQsQ0FBQztnQkFDRCxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7WUFDM0IsQ0FBQztZQUNELElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUN2QixDQUFDLENBQUM7UUFFRixtREFBbUQ7UUFDbkQsb0RBQW9EO1FBQ3BELHFEQUFxRDtRQUNyRCxvQkFBb0I7UUFDcEIsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUMsQ0FBQyxpQkFBaUI7UUFFL0MsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUM1QixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDdkIscURBQXFEO1lBQ3JELGlDQUFpQztZQUNqQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBVyxDQUFDO1lBQzNDLElBQ0UsSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJO2dCQUN2QiwyREFBMkQ7Z0JBQzNELDZEQUE2RDtnQkFDN0Qsa0JBQWtCO2dCQUNsQixDQUFDLElBQUksQ0FBQyxhQUFhLElBQUksSUFBSSxDQUFDLGFBQWEsR0FBRyxRQUFRLEdBQUcsaUJBQWlCLENBQUMsRUFDekUsQ0FBQztnQkFDRCw4REFBOEQ7Z0JBQzlELDhEQUE4RDtnQkFDOUQsK0NBQStDO2dCQUMvQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBRXBCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxHQUFHLEdBQUcsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO2dCQUM1RCxJQUFJLENBQUMsYUFBYSxHQUFHLFFBQVEsQ0FBQztnQkFDOUIsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBc0IsQ0FBQztZQUN0RSxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFFTyxZQUFZO1FBQ2xCLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUM1QixZQUFZLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzdCLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1FBQ3hCLENBQUM7SUFDSCxDQUFDO0lBRUQsV0FBVztRQUNULElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNwQixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7UUFDeEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQzNCLENBQUM7SUFFRCxrQkFBa0I7YUFDWCxVQUFLLEdBQTZCLGtCQUFrQixDQUFDO1FBQzFELEtBQUssRUFBRSxjQUFjO1FBQ3JCLFVBQVUsRUFBRSxNQUFNO1FBQ2xCLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLGNBQWMsRUFBRTtLQUNwQyxDQUFDLEFBSlUsQ0FJVCIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge8m1ybVkZWZpbmVJbmplY3RhYmxlfSBmcm9tICcuLi9kaSc7XG5pbXBvcnQge0lOSkVDVE9SLCBMVmlld30gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL3ZpZXcnO1xuaW1wb3J0IHthcnJheUluc2VydDIsIGFycmF5U3BsaWNlfSBmcm9tICcuLi91dGlsL2FycmF5X3V0aWxzJztcblxuLyoqXG4gKiBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCBjYXB0dXJlcyBhIHByb3ZpZGVkIGRlbGF5LlxuICogSW52b2tpbmcgdGhlIHJldHVybmVkIGZ1bmN0aW9uIHNjaGVkdWxlcyBhIHRyaWdnZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBvblRpbWVyKGRlbGF5OiBudW1iZXIpIHtcbiAgcmV0dXJuIChjYWxsYmFjazogVm9pZEZ1bmN0aW9uLCBsVmlldzogTFZpZXcpID0+IHNjaGVkdWxlVGltZXJUcmlnZ2VyKGRlbGF5LCBjYWxsYmFjaywgbFZpZXcpO1xufVxuXG4vKipcbiAqIFNjaGVkdWxlcyBhIGNhbGxiYWNrIHRvIGJlIGludm9rZWQgYWZ0ZXIgYSBnaXZlbiB0aW1lb3V0LlxuICpcbiAqIEBwYXJhbSBkZWxheSBBIG51bWJlciBvZiBtcyB0byB3YWl0IHVudGlsIGZpcmluZyBhIGNhbGxiYWNrLlxuICogQHBhcmFtIGNhbGxiYWNrIEEgZnVuY3Rpb24gdG8gYmUgaW52b2tlZCBhZnRlciBhIHRpbWVvdXQuXG4gKiBAcGFyYW0gbFZpZXcgTFZpZXcgdGhhdCBob3N0cyBhbiBpbnN0YW5jZSBvZiBhIGRlZmVyIGJsb2NrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2NoZWR1bGVUaW1lclRyaWdnZXIoZGVsYXk6IG51bWJlciwgY2FsbGJhY2s6IFZvaWRGdW5jdGlvbiwgbFZpZXc6IExWaWV3KSB7XG4gIGNvbnN0IGluamVjdG9yID0gbFZpZXdbSU5KRUNUT1JdITtcbiAgY29uc3Qgc2NoZWR1bGVyID0gaW5qZWN0b3IuZ2V0KFRpbWVyU2NoZWR1bGVyKTtcbiAgY29uc3QgY2xlYW51cEZuID0gKCkgPT4gc2NoZWR1bGVyLnJlbW92ZShjYWxsYmFjayk7XG4gIHNjaGVkdWxlci5hZGQoZGVsYXksIGNhbGxiYWNrKTtcbiAgcmV0dXJuIGNsZWFudXBGbjtcbn1cblxuLyoqXG4gKiBIZWxwZXIgc2VydmljZSB0byBzY2hlZHVsZSBgc2V0VGltZW91dGBzIGZvciBiYXRjaGVzIG9mIGRlZmVyIGJsb2NrcyxcbiAqIHRvIGF2b2lkIGNhbGxpbmcgYHNldFRpbWVvdXRgIGZvciBlYWNoIGRlZmVyIGJsb2NrIChlLmcuIGlmIGRlZmVyIGJsb2Nrc1xuICogYXJlIGNyZWF0ZWQgaW5zaWRlIGEgZm9yIGxvb3ApLlxuICovXG5leHBvcnQgY2xhc3MgVGltZXJTY2hlZHVsZXIge1xuICAvLyBJbmRpY2F0ZXMgd2hldGhlciBjdXJyZW50IGNhbGxiYWNrcyBhcmUgYmVpbmcgaW52b2tlZC5cbiAgZXhlY3V0aW5nQ2FsbGJhY2tzID0gZmFsc2U7XG5cbiAgLy8gQ3VycmVudGx5IHNjaGVkdWxlZCBgc2V0VGltZW91dGAgaWQuXG4gIHRpbWVvdXRJZDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgLy8gV2hlbiBjdXJyZW50bHkgc2NoZWR1bGVkIHRpbWVyIHdvdWxkIGZpcmUuXG4gIGludm9rZVRpbWVyQXQ6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIC8vIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGJlIGludm9rZWQuXG4gIC8vIEZvciBlYWNoIGNhbGxiYWNrIHdlIGFsc28gc3RvcmUgYSB0aW1lc3RhbXAgb24gd2hlbiB0aGUgY2FsbGJhY2tcbiAgLy8gc2hvdWxkIGJlIGludm9rZWQuIFdlIHN0b3JlIHRpbWVzdGFtcHMgYW5kIGNhbGxiYWNrIGZ1bmN0aW9uc1xuICAvLyBpbiBhIGZsYXQgYXJyYXkgdG8gYXZvaWQgY3JlYXRpbmcgbmV3IG9iamVjdHMgZm9yIGVhY2ggZW50cnkuXG4gIC8vIFt0aW1lc3RhbXAxLCBjYWxsYmFjazEsIHRpbWVzdGFtcDIsIGNhbGxiYWNrMiwgLi4uXVxuICBjdXJyZW50OiBBcnJheTxudW1iZXIgfCBWb2lkRnVuY3Rpb24+ID0gW107XG5cbiAgLy8gTGlzdCBvZiBjYWxsYmFja3MgY29sbGVjdGVkIHdoaWxlIGludm9raW5nIGN1cnJlbnQgc2V0IG9mIGNhbGxiYWNrcy5cbiAgLy8gVGhvc2UgY2FsbGJhY2tzIGFyZSBhZGRlZCB0byB0aGUgXCJjdXJyZW50XCIgcXVldWUgYXQgdGhlIGVuZCBvZlxuICAvLyB0aGUgY3VycmVudCBjYWxsYmFjayBpbnZvY2F0aW9uLiBUaGUgc2hhcGUgb2YgdGhpcyBsaXN0IGlzIHRoZSBzYW1lXG4gIC8vIGFzIHRoZSBzaGFwZSBvZiB0aGUgYGN1cnJlbnRgIGxpc3QuXG4gIGRlZmVycmVkOiBBcnJheTxudW1iZXIgfCBWb2lkRnVuY3Rpb24+ID0gW107XG5cbiAgYWRkKGRlbGF5OiBudW1iZXIsIGNhbGxiYWNrOiBWb2lkRnVuY3Rpb24pIHtcbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLmV4ZWN1dGluZ0NhbGxiYWNrcyA/IHRoaXMuZGVmZXJyZWQgOiB0aGlzLmN1cnJlbnQ7XG4gICAgdGhpcy5hZGRUb1F1ZXVlKHRhcmdldCwgRGF0ZS5ub3coKSArIGRlbGF5LCBjYWxsYmFjayk7XG4gICAgdGhpcy5zY2hlZHVsZVRpbWVyKCk7XG4gIH1cblxuICByZW1vdmUoY2FsbGJhY2s6IFZvaWRGdW5jdGlvbikge1xuICAgIGNvbnN0IHtjdXJyZW50LCBkZWZlcnJlZH0gPSB0aGlzO1xuICAgIGNvbnN0IGNhbGxiYWNrSW5kZXggPSB0aGlzLnJlbW92ZUZyb21RdWV1ZShjdXJyZW50LCBjYWxsYmFjayk7XG4gICAgaWYgKGNhbGxiYWNrSW5kZXggPT09IC0xKSB7XG4gICAgICAvLyBUcnkgY2xlYW5pbmcgdXAgZGVmZXJyZWQgcXVldWUgb25seSBpbiBjYXNlXG4gICAgICAvLyB3ZSBkaWRuJ3QgZmluZCBhIGNhbGxiYWNrIGluIHRoZSBcImN1cnJlbnRcIiBxdWV1ZS5cbiAgICAgIHRoaXMucmVtb3ZlRnJvbVF1ZXVlKGRlZmVycmVkLCBjYWxsYmFjayk7XG4gICAgfVxuICAgIC8vIElmIHRoZSBsYXN0IGNhbGxiYWNrIHdhcyByZW1vdmVkIGFuZCB0aGVyZSBpcyBhIHBlbmRpbmcgdGltZW91dCAtIGNhbmNlbCBpdC5cbiAgICBpZiAoY3VycmVudC5sZW5ndGggPT09IDAgJiYgZGVmZXJyZWQubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLmNsZWFyVGltZW91dCgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWRkVG9RdWV1ZShcbiAgICB0YXJnZXQ6IEFycmF5PG51bWJlciB8IFZvaWRGdW5jdGlvbj4sXG4gICAgaW52b2tlQXQ6IG51bWJlcixcbiAgICBjYWxsYmFjazogVm9pZEZ1bmN0aW9uLFxuICApIHtcbiAgICBsZXQgaW5zZXJ0QXRJbmRleCA9IHRhcmdldC5sZW5ndGg7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0YXJnZXQubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgIGNvbnN0IGludm9rZVF1ZXVlZENhbGxiYWNrQXQgPSB0YXJnZXRbaV0gYXMgbnVtYmVyO1xuICAgICAgaWYgKGludm9rZVF1ZXVlZENhbGxiYWNrQXQgPiBpbnZva2VBdCkge1xuICAgICAgICAvLyBXZSd2ZSByZWFjaGVkIGEgZmlyc3QgdGltZXIgdGhhdCBpcyBzY2hlZHVsZWRcbiAgICAgICAgLy8gZm9yIGEgbGF0ZXIgdGltZSB0aGFuIHdoYXQgd2UgYXJlIHRyeWluZyB0byBpbnNlcnQuXG4gICAgICAgIC8vIFRoaXMgaXMgdGhlIGxvY2F0aW9uIGF0IHdoaWNoIHdlIG5lZWQgdG8gaW5zZXJ0LFxuICAgICAgICAvLyBubyBuZWVkIHRvIGl0ZXJhdGUgZnVydGhlci5cbiAgICAgICAgaW5zZXJ0QXRJbmRleCA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBhcnJheUluc2VydDIodGFyZ2V0LCBpbnNlcnRBdEluZGV4LCBpbnZva2VBdCwgY2FsbGJhY2spO1xuICB9XG5cbiAgcHJpdmF0ZSByZW1vdmVGcm9tUXVldWUodGFyZ2V0OiBBcnJheTxudW1iZXIgfCBWb2lkRnVuY3Rpb24+LCBjYWxsYmFjazogVm9pZEZ1bmN0aW9uKSB7XG4gICAgbGV0IGluZGV4ID0gLTE7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0YXJnZXQubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgIGNvbnN0IHF1ZXVlZENhbGxiYWNrID0gdGFyZ2V0W2kgKyAxXTtcbiAgICAgIGlmIChxdWV1ZWRDYWxsYmFjayA9PT0gY2FsbGJhY2spIHtcbiAgICAgICAgaW5kZXggPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgIC8vIFJlbW92ZSAyIGVsZW1lbnRzOiBhIHRpbWVzdGFtcCBzbG90IGFuZFxuICAgICAgLy8gdGhlIGZvbGxvd2luZyBzbG90IHdpdGggYSBjYWxsYmFjayBmdW5jdGlvbi5cbiAgICAgIGFycmF5U3BsaWNlKHRhcmdldCwgaW5kZXgsIDIpO1xuICAgIH1cbiAgICByZXR1cm4gaW5kZXg7XG4gIH1cblxuICBwcml2YXRlIHNjaGVkdWxlVGltZXIoKSB7XG4gICAgY29uc3QgY2FsbGJhY2sgPSAoKSA9PiB7XG4gICAgICB0aGlzLmNsZWFyVGltZW91dCgpO1xuXG4gICAgICB0aGlzLmV4ZWN1dGluZ0NhbGxiYWNrcyA9IHRydWU7XG5cbiAgICAgIC8vIENsb25lIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBxdWV1ZSwgc2luY2UgaXQgbWlnaHQgYmUgYWx0ZXJlZFxuICAgICAgLy8gYXMgd2UgaW52b2tlIGNhbGxiYWNrcy5cbiAgICAgIGNvbnN0IGN1cnJlbnQgPSBbLi4udGhpcy5jdXJyZW50XTtcblxuICAgICAgLy8gSW52b2tlIGNhbGxiYWNrcyB0aGF0IHdlcmUgc2NoZWR1bGVkIHRvIHJ1biBiZWZvcmUgdGhlIGN1cnJlbnQgdGltZS5cbiAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGN1cnJlbnQubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgICAgY29uc3QgaW52b2tlQXQgPSBjdXJyZW50W2ldIGFzIG51bWJlcjtcbiAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBjdXJyZW50W2kgKyAxXSBhcyBWb2lkRnVuY3Rpb247XG4gICAgICAgIGlmIChpbnZva2VBdCA8PSBub3cpIHtcbiAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFdlJ3ZlIHJlYWNoZWQgYSB0aW1lciB0aGF0IHNob3VsZCBub3QgYmUgaW52b2tlZCB5ZXQuXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIFRoZSBzdGF0ZSBvZiB0aGUgcXVldWUgbWlnaHQndmUgY2hhbmdlZCBhZnRlciBjYWxsYmFja3MgaW52b2NhdGlvbixcbiAgICAgIC8vIHJ1biB0aGUgY2xlYW51cCBsb2dpYyBiYXNlZCBvbiB0aGUgKmN1cnJlbnQqIHN0YXRlIG9mIHRoZSBxdWV1ZS5cbiAgICAgIGxldCBsYXN0Q2FsbGJhY2tJbmRleCA9IC0xO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmN1cnJlbnQubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgICAgY29uc3QgaW52b2tlQXQgPSB0aGlzLmN1cnJlbnRbaV0gYXMgbnVtYmVyO1xuICAgICAgICBpZiAoaW52b2tlQXQgPD0gbm93KSB7XG4gICAgICAgICAgLy8gQWRkICsxIHRvIGFjY291bnQgZm9yIGEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdFxuICAgICAgICAgIC8vIGdvZXMgYWZ0ZXIgdGhlIHRpbWVzdGFtcCBpbiBldmVudHMgYXJyYXkuXG4gICAgICAgICAgbGFzdENhbGxiYWNrSW5kZXggPSBpICsgMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBXZSd2ZSByZWFjaGVkIGEgdGltZXIgdGhhdCBzaG91bGQgbm90IGJlIGludm9rZWQgeWV0LlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAobGFzdENhbGxiYWNrSW5kZXggPj0gMCkge1xuICAgICAgICBhcnJheVNwbGljZSh0aGlzLmN1cnJlbnQsIDAsIGxhc3RDYWxsYmFja0luZGV4ICsgMSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZXhlY3V0aW5nQ2FsbGJhY2tzID0gZmFsc2U7XG5cbiAgICAgIC8vIElmIHRoZXJlIGFyZSBhbnkgY2FsbGJhY2tzIGFkZGVkIGR1cmluZyBhbiBpbnZvY2F0aW9uXG4gICAgICAvLyBvZiB0aGUgY3VycmVudCBvbmVzIC0gbW92ZSB0aGVtIG92ZXIgdG8gdGhlIFwiY3VycmVudFwiXG4gICAgICAvLyBxdWV1ZS5cbiAgICAgIGlmICh0aGlzLmRlZmVycmVkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmRlZmVycmVkLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgICAgY29uc3QgaW52b2tlQXQgPSB0aGlzLmRlZmVycmVkW2ldIGFzIG51bWJlcjtcbiAgICAgICAgICBjb25zdCBjYWxsYmFjayA9IHRoaXMuZGVmZXJyZWRbaSArIDFdIGFzIFZvaWRGdW5jdGlvbjtcbiAgICAgICAgICB0aGlzLmFkZFRvUXVldWUodGhpcy5jdXJyZW50LCBpbnZva2VBdCwgY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZGVmZXJyZWQubGVuZ3RoID0gMDtcbiAgICAgIH1cbiAgICAgIHRoaXMuc2NoZWR1bGVUaW1lcigpO1xuICAgIH07XG5cbiAgICAvLyBBdm9pZCBydW5uaW5nIHRpbWVyIGNhbGxiYWNrcyBtb3JlIHRoYW4gb25jZSBwZXJcbiAgICAvLyBhdmVyYWdlIGZyYW1lIGR1cmF0aW9uLiBUaGlzIGlzIG5lZWRlZCBmb3IgYmV0dGVyXG4gICAgLy8gYmF0Y2hpbmcgYW5kIHRvIGF2b2lkIGtpY2tpbmcgb2ZmIGV4Y2Vzc2l2ZSBjaGFuZ2VcbiAgICAvLyBkZXRlY3Rpb24gY3ljbGVzLlxuICAgIGNvbnN0IEZSQU1FX0RVUkFUSU9OX01TID0gMTY7IC8vIDEwMDBtcyAvIDYwZnBzXG5cbiAgICBpZiAodGhpcy5jdXJyZW50Lmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgICAvLyBGaXJzdCBlbGVtZW50IGluIHRoZSBxdWV1ZSBwb2ludHMgYXQgdGhlIHRpbWVzdGFtcFxuICAgICAgLy8gb2YgdGhlIGZpcnN0IChlYXJsaWVzdCkgZXZlbnQuXG4gICAgICBjb25zdCBpbnZva2VBdCA9IHRoaXMuY3VycmVudFswXSBhcyBudW1iZXI7XG4gICAgICBpZiAoXG4gICAgICAgIHRoaXMudGltZW91dElkID09PSBudWxsIHx8XG4gICAgICAgIC8vIFJlc2NoZWR1bGUgYSB0aW1lciBpbiBjYXNlIGEgcXVldWUgY29udGFpbnMgYW4gaXRlbSB3aXRoXG4gICAgICAgIC8vIGFuIGVhcmxpZXIgdGltZXN0YW1wIGFuZCB0aGUgZGVsdGEgaXMgbW9yZSB0aGFuIGFuIGF2ZXJhZ2VcbiAgICAgICAgLy8gZnJhbWUgZHVyYXRpb24uXG4gICAgICAgICh0aGlzLmludm9rZVRpbWVyQXQgJiYgdGhpcy5pbnZva2VUaW1lckF0IC0gaW52b2tlQXQgPiBGUkFNRV9EVVJBVElPTl9NUylcbiAgICAgICkge1xuICAgICAgICAvLyBUaGVyZSB3YXMgYSB0aW1lb3V0IGFscmVhZHksIGJ1dCBhbiBlYXJsaWVyIGV2ZW50IHdhcyBhZGRlZFxuICAgICAgICAvLyBpbnRvIHRoZSBxdWV1ZS4gSW4gdGhpcyBjYXNlIHdlIGRyb3AgYW4gb2xkIHRpbWVyIGFuZCBzZXR1cFxuICAgICAgICAvLyBhIG5ldyBvbmUgd2l0aCBhbiB1cGRhdGVkIChzbWFsbGVyKSB0aW1lb3V0LlxuICAgICAgICB0aGlzLmNsZWFyVGltZW91dCgpO1xuXG4gICAgICAgIGNvbnN0IHRpbWVvdXQgPSBNYXRoLm1heChpbnZva2VBdCAtIG5vdywgRlJBTUVfRFVSQVRJT05fTVMpO1xuICAgICAgICB0aGlzLmludm9rZVRpbWVyQXQgPSBpbnZva2VBdDtcbiAgICAgICAgdGhpcy50aW1lb3V0SWQgPSBzZXRUaW1lb3V0KGNhbGxiYWNrLCB0aW1lb3V0KSBhcyB1bmtub3duIGFzIG51bWJlcjtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNsZWFyVGltZW91dCgpIHtcbiAgICBpZiAodGhpcy50aW1lb3V0SWQgIT09IG51bGwpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXRJZCk7XG4gICAgICB0aGlzLnRpbWVvdXRJZCA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgbmdPbkRlc3Ryb3koKSB7XG4gICAgdGhpcy5jbGVhclRpbWVvdXQoKTtcbiAgICB0aGlzLmN1cnJlbnQubGVuZ3RoID0gMDtcbiAgICB0aGlzLmRlZmVycmVkLmxlbmd0aCA9IDA7XG4gIH1cblxuICAvKiogQG5vY29sbGFwc2UgKi9cbiAgc3RhdGljIMm1cHJvdiA9IC8qKiBAcHVyZU9yQnJlYWtNeUNvZGUgKi8gybXJtWRlZmluZUluamVjdGFibGUoe1xuICAgIHRva2VuOiBUaW1lclNjaGVkdWxlcixcbiAgICBwcm92aWRlZEluOiAncm9vdCcsXG4gICAgZmFjdG9yeTogKCkgPT4gbmV3IFRpbWVyU2NoZWR1bGVyKCksXG4gIH0pO1xufVxuIl19