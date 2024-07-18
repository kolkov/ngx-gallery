/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { internalAfterNextRender } from '../render3/after_render_hooks';
import { assertLContainer, assertLView } from '../render3/assert';
import { CONTAINER_HEADER_OFFSET } from '../render3/interfaces/container';
import { isDestroyed } from '../render3/interfaces/type_checks';
import { HEADER_OFFSET, INJECTOR } from '../render3/interfaces/view';
import { getNativeByIndex, removeLViewOnDestroy, storeLViewOnDestroy, walkUpViews, } from '../render3/util/view_utils';
import { assertElement, assertEqual } from '../util/assert';
import { NgZone } from '../zone';
import { storeTriggerCleanupFn } from './cleanup';
import { DEFER_BLOCK_STATE, DeferBlockInternalState, DeferBlockState, } from './interfaces';
import { getLDeferBlockDetails } from './utils';
/** Configuration object used to register passive and capturing events. */
const eventListenerOptions = {
    passive: true,
    capture: true,
};
/** Keeps track of the currently-registered `on hover` triggers. */
const hoverTriggers = new WeakMap();
/** Keeps track of the currently-registered `on interaction` triggers. */
const interactionTriggers = new WeakMap();
/** Currently-registered `viewport` triggers. */
const viewportTriggers = new WeakMap();
/** Names of the events considered as interaction events. */
const interactionEventNames = ['click', 'keydown'];
/** Names of the events considered as hover events. */
const hoverEventNames = ['mouseenter', 'focusin'];
/** `IntersectionObserver` used to observe `viewport` triggers. */
let intersectionObserver = null;
/** Number of elements currently observed with `viewport` triggers. */
let observedViewportElements = 0;
/** Object keeping track of registered callbacks for a deferred block trigger. */
class DeferEventEntry {
    constructor() {
        this.callbacks = new Set();
        this.listener = () => {
            for (const callback of this.callbacks) {
                callback();
            }
        };
    }
}
/**
 * Registers an interaction trigger.
 * @param trigger Element that is the trigger.
 * @param callback Callback to be invoked when the trigger is interacted with.
 */
export function onInteraction(trigger, callback) {
    let entry = interactionTriggers.get(trigger);
    // If this is the first entry for this element, add the listeners.
    if (!entry) {
        // Note that managing events centrally like this lends itself well to using global
        // event delegation. It currently does delegation at the element level, rather than the
        // document level, because:
        // 1. Global delegation is the most effective when there are a lot of events being registered
        // at the same time. Deferred blocks are unlikely to be used in such a way.
        // 2. Matching events to their target isn't free. For each `click` and `keydown` event we
        // would have look through all the triggers and check if the target either is the element
        // itself or it's contained within the element. Given that `click` and `keydown` are some
        // of the most common events, this may end up introducing a lot of runtime overhead.
        // 3. We're still registering only two events per element, no matter how many deferred blocks
        // are referencing it.
        entry = new DeferEventEntry();
        interactionTriggers.set(trigger, entry);
        for (const name of interactionEventNames) {
            trigger.addEventListener(name, entry.listener, eventListenerOptions);
        }
    }
    entry.callbacks.add(callback);
    return () => {
        const { callbacks, listener } = entry;
        callbacks.delete(callback);
        if (callbacks.size === 0) {
            interactionTriggers.delete(trigger);
            for (const name of interactionEventNames) {
                trigger.removeEventListener(name, listener, eventListenerOptions);
            }
        }
    };
}
/**
 * Registers a hover trigger.
 * @param trigger Element that is the trigger.
 * @param callback Callback to be invoked when the trigger is hovered over.
 */
export function onHover(trigger, callback) {
    let entry = hoverTriggers.get(trigger);
    // If this is the first entry for this element, add the listener.
    if (!entry) {
        entry = new DeferEventEntry();
        hoverTriggers.set(trigger, entry);
        for (const name of hoverEventNames) {
            trigger.addEventListener(name, entry.listener, eventListenerOptions);
        }
    }
    entry.callbacks.add(callback);
    return () => {
        const { callbacks, listener } = entry;
        callbacks.delete(callback);
        if (callbacks.size === 0) {
            for (const name of hoverEventNames) {
                trigger.removeEventListener(name, listener, eventListenerOptions);
            }
            hoverTriggers.delete(trigger);
        }
    };
}
/**
 * Registers a viewport trigger.
 * @param trigger Element that is the trigger.
 * @param callback Callback to be invoked when the trigger comes into the viewport.
 * @param injector Injector that can be used by the trigger to resolve DI tokens.
 */
export function onViewport(trigger, callback, injector) {
    const ngZone = injector.get(NgZone);
    let entry = viewportTriggers.get(trigger);
    intersectionObserver =
        intersectionObserver ||
            ngZone.runOutsideAngular(() => {
                return new IntersectionObserver((entries) => {
                    for (const current of entries) {
                        // Only invoke the callbacks if the specific element is intersecting.
                        if (current.isIntersecting && viewportTriggers.has(current.target)) {
                            ngZone.run(viewportTriggers.get(current.target).listener);
                        }
                    }
                });
            });
    if (!entry) {
        entry = new DeferEventEntry();
        ngZone.runOutsideAngular(() => intersectionObserver.observe(trigger));
        viewportTriggers.set(trigger, entry);
        observedViewportElements++;
    }
    entry.callbacks.add(callback);
    return () => {
        // It's possible that a different cleanup callback fully removed this element already.
        if (!viewportTriggers.has(trigger)) {
            return;
        }
        entry.callbacks.delete(callback);
        if (entry.callbacks.size === 0) {
            intersectionObserver?.unobserve(trigger);
            viewportTriggers.delete(trigger);
            observedViewportElements--;
        }
        if (observedViewportElements === 0) {
            intersectionObserver?.disconnect();
            intersectionObserver = null;
        }
    };
}
/**
 * Helper function to get the LView in which a deferred block's trigger is rendered.
 * @param deferredHostLView LView in which the deferred block is defined.
 * @param deferredTNode TNode defining the deferred block.
 * @param walkUpTimes Number of times to go up in the view hierarchy to find the trigger's view.
 *   A negative value means that the trigger is inside the block's placeholder, while an undefined
 *   value means that the trigger is in the same LView as the deferred block.
 */
export function getTriggerLView(deferredHostLView, deferredTNode, walkUpTimes) {
    // The trigger is in the same view, we don't need to traverse.
    if (walkUpTimes == null) {
        return deferredHostLView;
    }
    // A positive value or zero means that the trigger is in a parent view.
    if (walkUpTimes >= 0) {
        return walkUpViews(walkUpTimes, deferredHostLView);
    }
    // If the value is negative, it means that the trigger is inside the placeholder.
    const deferredContainer = deferredHostLView[deferredTNode.index];
    ngDevMode && assertLContainer(deferredContainer);
    const triggerLView = deferredContainer[CONTAINER_HEADER_OFFSET] ?? null;
    // We need to null check, because the placeholder might not have been rendered yet.
    if (ngDevMode && triggerLView !== null) {
        const lDetails = getLDeferBlockDetails(deferredHostLView, deferredTNode);
        const renderedState = lDetails[DEFER_BLOCK_STATE];
        assertEqual(renderedState, DeferBlockState.Placeholder, 'Expected a placeholder to be rendered in this defer block.');
        assertLView(triggerLView);
    }
    return triggerLView;
}
/**
 * Gets the element that a deferred block's trigger is pointing to.
 * @param triggerLView LView in which the trigger is defined.
 * @param triggerIndex Index at which the trigger element should've been rendered.
 */
export function getTriggerElement(triggerLView, triggerIndex) {
    const element = getNativeByIndex(HEADER_OFFSET + triggerIndex, triggerLView);
    ngDevMode && assertElement(element);
    return element;
}
/**
 * Registers a DOM-node based trigger.
 * @param initialLView LView in which the defer block is rendered.
 * @param tNode TNode representing the defer block.
 * @param triggerIndex Index at which to find the trigger element.
 * @param walkUpTimes Number of times to go up/down in the view hierarchy to find the trigger.
 * @param registerFn Function that will register the DOM events.
 * @param callback Callback to be invoked when the trigger receives the event that should render
 *     the deferred block.
 * @param type Trigger type to distinguish between regular and prefetch triggers.
 */
export function registerDomTrigger(initialLView, tNode, triggerIndex, walkUpTimes, registerFn, callback, type) {
    const injector = initialLView[INJECTOR];
    function pollDomTrigger() {
        // If the initial view was destroyed, we don't need to do anything.
        if (isDestroyed(initialLView)) {
            return;
        }
        const lDetails = getLDeferBlockDetails(initialLView, tNode);
        const renderedState = lDetails[DEFER_BLOCK_STATE];
        // If the block was loaded before the trigger was resolved, we don't need to do anything.
        if (renderedState !== DeferBlockInternalState.Initial &&
            renderedState !== DeferBlockState.Placeholder) {
            return;
        }
        const triggerLView = getTriggerLView(initialLView, tNode, walkUpTimes);
        // Keep polling until we resolve the trigger's LView.
        if (!triggerLView) {
            internalAfterNextRender(pollDomTrigger, { injector });
            return;
        }
        // It's possible that the trigger's view was destroyed before we resolved the trigger element.
        if (isDestroyed(triggerLView)) {
            return;
        }
        const element = getTriggerElement(triggerLView, triggerIndex);
        const cleanup = registerFn(element, () => {
            if (initialLView !== triggerLView) {
                removeLViewOnDestroy(triggerLView, cleanup);
            }
            callback();
        }, injector);
        // The trigger and deferred block might be in different LViews.
        // For the main LView the cleanup would happen as a part of
        // `storeTriggerCleanupFn` logic. For trigger LView we register
        // a cleanup function there to remove event handlers in case an
        // LView gets destroyed before a trigger is invoked.
        if (initialLView !== triggerLView) {
            storeLViewOnDestroy(triggerLView, cleanup);
        }
        storeTriggerCleanupFn(type, lDetails, cleanup);
    }
    // Begin polling for the trigger.
    internalAfterNextRender(pollDomTrigger, { injector });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9tX3RyaWdnZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvZGVmZXIvZG9tX3RyaWdnZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQyx1QkFBdUIsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ3RFLE9BQU8sRUFBQyxnQkFBZ0IsRUFBRSxXQUFXLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUNoRSxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSxpQ0FBaUMsQ0FBQztBQUV4RSxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sbUNBQW1DLENBQUM7QUFDOUQsT0FBTyxFQUFDLGFBQWEsRUFBRSxRQUFRLEVBQVEsTUFBTSw0QkFBNEIsQ0FBQztBQUMxRSxPQUFPLEVBQ0wsZ0JBQWdCLEVBQ2hCLG9CQUFvQixFQUNwQixtQkFBbUIsRUFDbkIsV0FBVyxHQUNaLE1BQU0sNEJBQTRCLENBQUM7QUFDcEMsT0FBTyxFQUFDLGFBQWEsRUFBRSxXQUFXLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUMxRCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBQy9CLE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUVoRCxPQUFPLEVBQ0wsaUJBQWlCLEVBQ2pCLHVCQUF1QixFQUN2QixlQUFlLEdBRWhCLE1BQU0sY0FBYyxDQUFDO0FBQ3RCLE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUU5QywwRUFBMEU7QUFDMUUsTUFBTSxvQkFBb0IsR0FBNEI7SUFDcEQsT0FBTyxFQUFFLElBQUk7SUFDYixPQUFPLEVBQUUsSUFBSTtDQUNkLENBQUM7QUFFRixtRUFBbUU7QUFDbkUsTUFBTSxhQUFhLEdBQUcsSUFBSSxPQUFPLEVBQTRCLENBQUM7QUFFOUQseUVBQXlFO0FBQ3pFLE1B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QUFFLENBQUM7Z0JBQ2xDLG9CQUFvQixDQUFDLFlBQVksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUM5QyxDQUFDO1lBQ0QsUUFBUSxFQUFFLENBQUM7UUFDYixDQUFDLEVBQ0QsUUFBUSxDQUNULENBQUM7UUFFRiwrREFBK0Q7UUFDL0QsMkRBQTJEO1FBQzNELCtEQUErRDtRQUMvRCwrREFBK0Q7UUFDL0Qsb0RBQW9EO1FBQ3BELElBQUksWUFBWSxLQUFLLFlBQVksRUFBRSxDQUFDO1lBQ2xDLG1CQUFtQixDQUFDLFlBQVksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM3QyxDQUFDO1FBRUQscUJBQXFCLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBRUQsaUNBQWlDO0lBQ2pDLHVCQUF1QixDQUFDLGNBQWMsRUFBRSxFQUFDLFFBQVEsRUFBQyxDQUFDLENBQUM7QUFDdEQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qIVxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7SW5qZWN0b3J9IGZyb20gJy4uL2RpJztcbmltcG9ydCB7aW50ZXJuYWxBZnRlck5leHRSZW5kZXJ9IGZyb20gJy4uL3JlbmRlcjMvYWZ0ZXJfcmVuZGVyX2hvb2tzJztcbmltcG9ydCB7YXNzZXJ0TENvbnRhaW5lciwgYXNzZXJ0TFZpZXd9IGZyb20gJy4uL3JlbmRlcjMvYXNzZXJ0JztcbmltcG9ydCB7Q09OVEFJTkVSX0hFQURFUl9PRkZTRVR9IGZyb20gJy4uL3JlbmRlcjMvaW50ZXJmYWNlcy9jb250YWluZXInO1xuaW1wb3J0IHtUTm9kZX0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL25vZGUnO1xuaW1wb3J0IHtpc0Rlc3Ryb3llZH0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL3R5cGVfY2hlY2tzJztcbmltcG9ydCB7SEVBREVSX09GRlNFVCwgSU5KRUNUT1IsIExWaWV3fSBmcm9tICcuLi9yZW5kZXIzL2ludGVyZmFjZXMvdmlldyc7XG5pbXBvcnQge1xuICBnZXROYXRpdmVCeUluZGV4LFxuICByZW1vdmVMVmlld09uRGVzdHJveSxcbiAgc3RvcmVMVmlld09uRGVzdHJveSxcbiAgd2Fsa1VwVmlld3MsXG59IGZyb20gJy4uL3JlbmRlcjMvdXRpbC92aWV3X3V0aWxzJztcbmltcG9ydCB7YXNzZXJ0RWxlbWVudCwgYXNzZXJ0RXF1YWx9IGZyb20gJy4uL3V0aWwvYXNzZXJ0JztcbmltcG9ydCB7Tmdab25lfSBmcm9tICcuLi96b25lJztcbmltcG9ydCB7c3RvcmVUcmlnZ2VyQ2xlYW51cEZufSBmcm9tICcuL2NsZWFudXAnO1xuXG5pbXBvcnQge1xuICBERUZFUl9CTE9DS19TVEFURSxcbiAgRGVmZXJCbG9ja0ludGVybmFsU3RhdGUsXG4gIERlZmVyQmxvY2tTdGF0ZSxcbiAgVHJpZ2dlclR5cGUsXG59IGZyb20gJy4vaW50ZXJmYWNlcyc7XG5pbXBvcnQge2dldExEZWZlckJsb2NrRGV0YWlsc30gZnJvbSAnLi91dGlscyc7XG5cbi8qKiBDb25maWd1cmF0aW9uIG9iamVjdCB1c2VkIHRvIHJlZ2lzdGVyIHBhc3NpdmUgYW5kIGNhcHR1cmluZyBldmVudHMuICovXG5jb25zdCBldmVudExpc3RlbmVyT3B0aW9uczogQWRkRXZlbnRMaXN0ZW5lck9wdGlvbnMgPSB7XG4gIHBhc3NpdmU6IHRydWUsXG4gIGNhcHR1cmU6IHRydWUsXG59O1xuXG4vKiogS2VlcHMgdHJhY2sgb2YgdGhlIGN1cnJlbnRseS1yZWdpc3RlcmVkIGBvbiBob3ZlcmAgdHJpZ2dlcnMuICovXG5jb25zdCBob3ZlclRyaWdnZXJzID0gbmV3IFdlYWtNYXA8RWxlbWVudCwgRGVmZXJFdmVudEVudHJ5PigpO1xuXG4vKiogS2VlcHMgdHJhY2sgb2YgdGhlIGN1cnJlbnRseS1yZWdpc3RlcmVkIGBvbiBpbnRlcmFjdGlvbmAgdHJpZ2dlcnMuICovXG5jb25zdCBpbnRlcmFjdGlvblRyaWdnZXJzID0gbmV3IFdlYWtNYXA8RWxlbWVudCwgRGVmZXJFdmVudEVudHJ5PigpO1xuXG4vKiogQ3VycmVudGx5LXJlZ2lzdGVyZWQgYHZpZXdwb3J0YCB0cmlnZ2Vycy4gKi9cbmNvbnN0IHZpZXdwb3J0VHJpZ2dlcnMgPSBuZXcgV2Vha01hcDxFbGVtZW50LCBEZWZlckV2ZW50RW50cnk+KCk7XG5cbi8qKiBOYW1lcyBvZiB0aGUgZXZlbnRzIGNvbnNpZGVyZWQgYXMgaW50ZXJhY3Rpb24gZXZlbnRzLiAqL1xuY29uc3QgaW50ZXJhY3Rpb25FdmVudE5hbWVzID0gWydjbGljaycsICdrZXlkb3duJ10gYXMgY29uc3Q7XG5cbi8qKiBOYW1lcyBvZiB0aGUgZXZlbnRzIGNvbnNpZGVyZWQgYXMgaG92ZXIgZXZlbnRzLiAqL1xuY29uc3QgaG92ZXJFdmVudE5hbWVzID0gWydtb3VzZWVudGVyJywgJ2ZvY3VzaW4nXSBhcyBjb25zdDtcblxuLyoqIGBJbnRlcnNlY3Rpb25PYnNlcnZlcmAgdXNlZCB0byBvYnNlcnZlIGB2aWV3cG9ydGAgdHJpZ2dlcnMuICovXG5sZXQgaW50ZXJzZWN0aW9uT2JzZXJ2ZXI6IEludGVyc2VjdGlvbk9ic2VydmVyIHwgbnVsbCA9IG51bGw7XG5cbi8qKiBOdW1iZXIgb2YgZWxlbWVudHMgY3VycmVudGx5IG9ic2VydmVkIHdpdGggYHZpZXdwb3J0YCB0cmlnZ2Vycy4gKi9cbmxldCBvYnNlcnZlZFZpZXdwb3J0RWxlbWVudHMgPSAwO1xuXG4vKiogT2JqZWN0IGtlZXBpbmcgdHJhY2sgb2YgcmVnaXN0ZXJlZCBjYWxsYmFja3MgZm9yIGEgZGVmZXJyZWQgYmxvY2sgdHJpZ2dlci4gKi9cbmNsYXNzIERlZmVyRXZlbnRFbnRyeSB7XG4gIGNhbGxiYWNrcyA9IG5ldyBTZXQ8Vm9pZEZ1bmN0aW9uPigpO1xuXG4gIGxpc3RlbmVyID0gKCkgPT4ge1xuICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgdGhpcy5jYWxsYmFja3MpIHtcbiAgICAgIGNhbGxiYWNrKCk7XG4gICAgfVxuICB9O1xufVxuXG4vKipcbiAqIFJlZ2lzdGVycyBhbiBpbnRlcmFjdGlvbiB0cmlnZ2VyLlxuICogQHBhcmFtIHRyaWdnZXIgRWxlbWVudCB0aGF0IGlzIHRoZSB0cmlnZ2VyLlxuICogQHBhcmFtIGNhbGxiYWNrIENhbGxiYWNrIHRvIGJlIGludm9rZWQgd2hlbiB0aGUgdHJpZ2dlciBpcyBpbnRlcmFjdGVkIHdpdGguXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBvbkludGVyYWN0aW9uKHRyaWdnZXI6IEVsZW1lbnQsIGNhbGxiYWNrOiBWb2lkRnVuY3Rpb24pOiBWb2lkRnVuY3Rpb24ge1xuICBsZXQgZW50cnkgPSBpbnRlcmFjdGlvblRyaWdnZXJzLmdldCh0cmlnZ2VyKTtcblxuICAvLyBJZiB0aGlzIGlzIHRoZSBmaXJzdCBlbnRyeSBmb3IgdGhpcyBlbGVtZW50LCBhZGQgdGhlIGxpc3RlbmVycy5cbiAgaWYgKCFlbnRyeSkge1xuICAgIC8vIE5vdGUgdGhhdCBtYW5hZ2luZyBldmVudHMgY2VudHJhbGx5IGxpa2UgdGhpcyBsZW5kcyBpdHNlbGYgd2VsbCB0byB1c2luZyBnbG9iYWxcbiAgICAvLyBldmVudCBkZWxlZ2F0aW9uLiBJdCBjdXJyZW50bHkgZG9lcyBkZWxlZ2F0aW9uIGF0IHRoZSBlbGVtZW50IGxldmVsLCByYXRoZXIgdGhhbiB0aGVcbiAgICAvLyBkb2N1bWVudCBsZXZlbCwgYmVjYXVzZTpcbiAgICAvLyAxLiBHbG9iYWwgZGVsZWdhdGlvbiBpcyB0aGUgbW9zdCBlZmZlY3RpdmUgd2hlbiB0aGVyZSBhcmUgYSBsb3Qgb2YgZXZlbnRzIGJlaW5nIHJlZ2lzdGVyZWRcbiAgICAvLyBhdCB0aGUgc2FtZSB0aW1lLiBEZWZlcnJlZCBibG9ja3MgYXJlIHVubGlrZWx5IHRvIGJlIHVzZWQgaW4gc3VjaCBhIHdheS5cbiAgICAvLyAyLiBNYXRjaGluZyBldmVudHMgdG8gdGhlaXIgdGFyZ2V0IGlzbid0IGZyZWUuIEZvciBlYWNoIGBjbGlja2AgYW5kIGBrZXlkb3duYCBldmVudCB3ZVxuICAgIC8vIHdvdWxkIGhhdmUgbG9vayB0aHJvdWdoIGFsbCB0aGUgdHJpZ2dlcnMgYW5kIGNoZWNrIGlmIHRoZSB0YXJnZXQgZWl0aGVyIGlzIHRoZSBlbGVtZW50XG4gICAgLy8gaXRzZWxmIG9yIGl0J3MgY29udGFpbmVkIHdpdGhpbiB0aGUgZWxlbWVudC4gR2l2ZW4gdGhhdCBgY2xpY2tgIGFuZCBga2V5ZG93bmAgYXJlIHNvbWVcbiAgICAvLyBvZiB0aGUgbW9zdCBjb21tb24gZXZlbnRzLCB0aGlzIG1heSBlbmQgdXAgaW50cm9kdWNpbmcgYSBsb3Qgb2YgcnVudGltZSBvdmVyaGVhZC5cbiAgICAvLyAzLiBXZSdyZSBzdGlsbCByZWdpc3RlcmluZyBvbmx5IHR3byBldmVudHMgcGVyIGVsZW1lbnQsIG5vIG1hdHRlciBob3cgbWFueSBkZWZlcnJlZCBibG9ja3NcbiAgICAvLyBhcmUgcmVmZXJlbmNpbmcgaXQuXG4gICAgZW50cnkgPSBuZXcgRGVmZXJFdmVudEVudHJ5KCk7XG4gICAgaW50ZXJhY3Rpb25UcmlnZ2Vycy5zZXQodHJpZ2dlciwgZW50cnkpO1xuXG4gICAgZm9yIChjb25zdCBuYW1lIG9mIGludGVyYWN0aW9uRXZlbnROYW1lcykge1xuICAgICAgdHJpZ2dlci5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGVudHJ5IS5saXN0ZW5lciwgZXZlbnRMaXN0ZW5lck9wdGlvbnMpO1xuICAgIH1cbiAgfVxuXG4gIGVudHJ5LmNhbGxiYWNrcy5hZGQoY2FsbGJhY2spO1xuXG4gIHJldHVybiAoKSA9PiB7XG4gICAgY29uc3Qge2NhbGxiYWNrcywgbGlzdGVuZXJ9ID0gZW50cnkhO1xuICAgIGNhbGxiYWNrcy5kZWxldGUoY2FsbGJhY2spO1xuXG4gICAgaWYgKGNhbGxiYWNrcy5zaXplID09PSAwKSB7XG4gICAgICBpbnRlcmFjdGlvblRyaWdnZXJzLmRlbGV0ZSh0cmlnZ2VyKTtcblxuICAgICAgZm9yIChjb25zdCBuYW1lIG9mIGludGVyYWN0aW9uRXZlbnROYW1lcykge1xuICAgICAgICB0cmlnZ2VyLnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgbGlzdGVuZXIsIGV2ZW50TGlzdGVuZXJPcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbi8qKlxuICogUmVnaXN0ZXJzIGEgaG92ZXIgdHJpZ2dlci5cbiAqIEBwYXJhbSB0cmlnZ2VyIEVsZW1lbnQgdGhhdCBpcyB0aGUgdHJpZ2dlci5cbiAqIEBwYXJhbSBjYWxsYmFjayBDYWxsYmFjayB0byBiZSBpbnZva2VkIHdoZW4gdGhlIHRyaWdnZXIgaXMgaG92ZXJlZCBvdmVyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gb25Ib3Zlcih0cmlnZ2VyOiBFbGVtZW50LCBjYWxsYmFjazogVm9pZEZ1bmN0aW9uKTogVm9pZEZ1bmN0aW9uIHtcbiAgbGV0IGVudHJ5ID0gaG92ZXJUcmlnZ2Vycy5nZXQodHJpZ2dlcik7XG5cbiAgLy8gSWYgdGhpcyBpcyB0aGUgZmlyc3QgZW50cnkgZm9yIHRoaXMgZWxlbWVudCwgYWRkIHRoZSBsaXN0ZW5lci5cbiAgaWYgKCFlbnRyeSkge1xuICAgIGVudHJ5ID0gbmV3IERlZmVyRXZlbnRFbnRyeSgpO1xuICAgIGhvdmVyVHJpZ2dlcnMuc2V0KHRyaWdnZXIsIGVudHJ5KTtcblxuICAgIGZvciAoY29uc3QgbmFtZSBvZiBob3ZlckV2ZW50TmFtZXMpIHtcbiAgICAgIHRyaWdnZXIuYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBlbnRyeSEubGlzdGVuZXIsIGV2ZW50TGlzdGVuZXJPcHRpb25zKTtcbiAgICB9XG4gIH1cblxuICBlbnRyeS5jYWxsYmFja3MuYWRkKGNhbGxiYWNrKTtcblxuICByZXR1cm4gKCkgPT4ge1xuICAgIGNvbnN0IHtjYWxsYmFja3MsIGxpc3RlbmVyfSA9IGVudHJ5ITtcbiAgICBjYWxsYmFja3MuZGVsZXRlKGNhbGxiYWNrKTtcblxuICAgIGlmIChjYWxsYmFja3Muc2l6ZSA9PT0gMCkge1xuICAgICAgZm9yIChjb25zdCBuYW1lIG9mIGhvdmVyRXZlbnROYW1lcykge1xuICAgICAgICB0cmlnZ2VyLnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgbGlzdGVuZXIsIGV2ZW50TGlzdGVuZXJPcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIGhvdmVyVHJpZ2dlcnMuZGVsZXRlKHRyaWdnZXIpO1xuICAgIH1cbiAgfTtcbn1cblxuLyoqXG4gKiBSZWdpc3RlcnMgYSB2aWV3cG9ydCB0cmlnZ2VyLlxuICogQHBhcmFtIHRyaWdnZXIgRWxlbWVudCB0aGF0IGlzIHRoZSB0cmlnZ2VyLlxuICogQHBhcmFtIGNhbGxiYWNrIENhbGxiYWNrIHRvIGJlIGludm9rZWQgd2hlbiB0aGUgdHJpZ2dlciBjb21lcyBpbnRvIHRoZSB2aWV3cG9ydC5cbiAqIEBwYXJhbSBpbmplY3RvciBJbmplY3RvciB0aGF0IGNhbiBiZSB1c2VkIGJ5IHRoZSB0cmlnZ2VyIHRvIHJlc29sdmUgREkgdG9rZW5zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gb25WaWV3cG9ydChcbiAgdHJpZ2dlcjogRWxlbWVudCxcbiAgY2FsbGJhY2s6IFZvaWRGdW5jdGlvbixcbiAgaW5qZWN0b3I6IEluamVjdG9yLFxuKTogVm9pZEZ1bmN0aW9uIHtcbiAgY29uc3Qgbmdab25lID0gaW5qZWN0b3IuZ2V0KE5nWm9uZSk7XG4gIGxldCBlbnRyeSA9IHZpZXdwb3J0VHJpZ2dlcnMuZ2V0KHRyaWdnZXIpO1xuXG4gIGludGVyc2VjdGlvbk9ic2VydmVyID1cbiAgICBpbnRlcnNlY3Rpb25PYnNlcnZlciB8fFxuICAgIG5nWm9uZS5ydW5PdXRzaWRlQW5ndWxhcigoKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IEludGVyc2VjdGlvbk9ic2VydmVyKChlbnRyaWVzKSA9PiB7XG4gICAgICAgIGZvciAoY29uc3QgY3VycmVudCBvZiBlbnRyaWVzKSB7XG4gICAgICAgICAgLy8gT25seSBpbnZva2UgdGhlIGNhbGxiYWNrcyBpZiB0aGUgc3BlY2lmaWMgZWxlbWVudCBpcyBpbnRlcnNlY3RpbmcuXG4gICAgICAgICAgaWYgKGN1cnJlbnQuaXNJbnRlcnNlY3RpbmcgJiYgdmlld3BvcnRUcmlnZ2Vycy5oYXMoY3VycmVudC50YXJnZXQpKSB7XG4gICAgICAgICAgICBuZ1pvbmUucnVuKHZpZXdwb3J0VHJpZ2dlcnMuZ2V0KGN1cnJlbnQudGFyZ2V0KSEubGlzdGVuZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgaWYgKCFlbnRyeSkge1xuICAgIGVudHJ5ID0gbmV3IERlZmVyRXZlbnRFbnRyeSgpO1xuICAgIG5nWm9uZS5ydW5PdXRzaWRlQW5ndWxhcigoKSA9PiBpbnRlcnNlY3Rpb25PYnNlcnZlciEub2JzZXJ2ZSh0cmlnZ2VyKSk7XG4gICAgdmlld3BvcnRUcmlnZ2Vycy5zZXQodHJpZ2dlciwgZW50cnkpO1xuICAgIG9ic2VydmVkVmlld3BvcnRFbGVtZW50cysrO1xuICB9XG5cbiAgZW50cnkuY2FsbGJhY2tzLmFkZChjYWxsYmFjayk7XG5cbiAgcmV0dXJuICgpID0+IHtcbiAgICAvLyBJdCdzIHBvc3NpYmxlIHRoYXQgYSBkaWZmZXJlbnQgY2xlYW51cCBjYWxsYmFjayBmdWxseSByZW1vdmVkIHRoaXMgZWxlbWVudCBhbHJlYWR5LlxuICAgIGlmICghdmlld3BvcnRUcmlnZ2Vycy5oYXModHJpZ2dlcikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBlbnRyeSEuY2FsbGJhY2tzLmRlbGV0ZShjYWxsYmFjayk7XG5cbiAgICBpZiAoZW50cnkhLmNhbGxiYWNrcy5zaXplID09PSAwKSB7XG4gICAgICBpbnRlcnNlY3Rpb25PYnNlcnZlcj8udW5vYnNlcnZlKHRyaWdnZXIpO1xuICAgICAgdmlld3BvcnRUcmlnZ2Vycy5kZWxldGUodHJpZ2dlcik7XG4gICAgICBvYnNlcnZlZFZpZXdwb3J0RWxlbWVudHMtLTtcbiAgICB9XG5cbiAgICBpZiAob2JzZXJ2ZWRWaWV3cG9ydEVsZW1lbnRzID09PSAwKSB7XG4gICAgICBpbnRlcnNlY3Rpb25PYnNlcnZlcj8uZGlzY29ubmVjdCgpO1xuICAgICAgaW50ZXJzZWN0aW9uT2JzZXJ2ZXIgPSBudWxsO1xuICAgIH1cbiAgfTtcbn1cblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdG8gZ2V0IHRoZSBMVmlldyBpbiB3aGljaCBhIGRlZmVycmVkIGJsb2NrJ3MgdHJpZ2dlciBpcyByZW5kZXJlZC5cbiAqIEBwYXJhbSBkZWZlcnJlZEhvc3RMVmlldyBMVmlldyBpbiB3aGljaCB0aGUgZGVmZXJyZWQgYmxvY2sgaXMgZGVmaW5lZC5cbiAqIEBwYXJhbSBkZWZlcnJlZFROb2RlIFROb2RlIGRlZmluaW5nIHRoZSBkZWZlcnJlZCBibG9jay5cbiAqIEBwYXJhbSB3YWxrVXBUaW1lcyBOdW1iZXIgb2YgdGltZXMgdG8gZ28gdXAgaW4gdGhlIHZpZXcgaGllcmFyY2h5IHRvIGZpbmQgdGhlIHRyaWdnZXIncyB2aWV3LlxuICogICBBIG5lZ2F0aXZlIHZhbHVlIG1lYW5zIHRoYXQgdGhlIHRyaWdnZXIgaXMgaW5zaWRlIHRoZSBibG9jaydzIHBsYWNlaG9sZGVyLCB3aGlsZSBhbiB1bmRlZmluZWRcbiAqICAgdmFsdWUgbWVhbnMgdGhhdCB0aGUgdHJpZ2dlciBpcyBpbiB0aGUgc2FtZSBMVmlldyBhcyB0aGUgZGVmZXJyZWQgYmxvY2suXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRUcmlnZ2VyTFZpZXcoXG4gIGRlZmVycmVkSG9zdExWaWV3OiBMVmlldyxcbiAgZGVmZXJyZWRUTm9kZTogVE5vZGUsXG4gIHdhbGtVcFRpbWVzOiBudW1iZXIgfCB1bmRlZmluZWQsXG4pOiBMVmlldyB8IG51bGwge1xuICAvLyBUaGUgdHJpZ2dlciBpcyBpbiB0aGUgc2FtZSB2aWV3LCB3ZSBkb24ndCBuZWVkIHRvIHRyYXZlcnNlLlxuICBpZiAod2Fsa1VwVGltZXMgPT0gbnVsbCkge1xuICAgIHJldHVybiBkZWZlcnJlZEhvc3RMVmlldztcbiAgfVxuXG4gIC8vIEEgcG9zaXRpdmUgdmFsdWUgb3IgemVybyBtZWFucyB0aGF0IHRoZSB0cmlnZ2VyIGlzIGluIGEgcGFyZW50IHZpZXcuXG4gIGlmICh3YWxrVXBUaW1lcyA+PSAwKSB7XG4gICAgcmV0dXJuIHdhbGtVcFZpZXdzKHdhbGtVcFRpbWVzLCBkZWZlcnJlZEhvc3RMVmlldyk7XG4gIH1cblxuICAvLyBJZiB0aGUgdmFsdWUgaXMgbmVnYXRpdmUsIGl0IG1lYW5zIHRoYXQgdGhlIHRyaWdnZXIgaXMgaW5zaWRlIHRoZSBwbGFjZWhvbGRlci5cbiAgY29uc3QgZGVmZXJyZWRDb250YWluZXIgPSBkZWZlcnJlZEhvc3RMVmlld1tkZWZlcnJlZFROb2RlLmluZGV4XTtcbiAgbmdEZXZNb2RlICYmIGFzc2VydExDb250YWluZXIoZGVmZXJyZWRDb250YWluZXIpO1xuICBjb25zdCB0cmlnZ2VyTFZpZXcgPSBkZWZlcnJlZENvbnRhaW5lcltDT05UQUlORVJfSEVBREVSX09GRlNFVF0gPz8gbnVsbDtcblxuICAvLyBXZSBuZWVkIHRvIG51bGwgY2hlY2ssIGJlY2F1c2UgdGhlIHBsYWNlaG9sZGVyIG1pZ2h0IG5vdCBoYXZlIGJlZW4gcmVuZGVyZWQgeWV0LlxuICBpZiAobmdEZXZNb2RlICYmIHRyaWdnZXJMVmlldyAhPT0gbnVsbCkge1xuICAgIGNvbnN0IGxEZXRhaWxzID0gZ2V0TERlZmVyQmxvY2tEZXRhaWxzKGRlZmVycmVkSG9zdExWaWV3LCBkZWZlcnJlZFROb2RlKTtcbiAgICBjb25zdCByZW5kZXJlZFN0YXRlID0gbERldGFpbHNbREVGRVJfQkxPQ0tfU1RBVEVdO1xuICAgIGFzc2VydEVxdWFsKFxuICAgICAgcmVuZGVyZWRTdGF0ZSxcbiAgICAgIERlZmVyQmxvY2tTdGF0ZS5QbGFjZWhvbGRlcixcbiAgICAgICdFeHBlY3RlZCBhIHBsYWNlaG9sZGVyIHRvIGJlIHJlbmRlcmVkIGluIHRoaXMgZGVmZXIgYmxvY2suJyxcbiAgICApO1xuICAgIGFzc2VydExWaWV3KHRyaWdnZXJMVmlldyk7XG4gIH1cblxuICByZXR1cm4gdHJpZ2dlckxWaWV3O1xufVxuXG4vKipcbiAqIEdldHMgdGhlIGVsZW1lbnQgdGhhdCBhIGRlZmVycmVkIGJsb2NrJ3MgdHJpZ2dlciBpcyBwb2ludGluZyB0by5cbiAqIEBwYXJhbSB0cmlnZ2VyTFZpZXcgTFZpZXcgaW4gd2hpY2ggdGhlIHRyaWdnZXIgaXMgZGVmaW5lZC5cbiAqIEBwYXJhbSB0cmlnZ2VySW5kZXggSW5kZXggYXQgd2hpY2ggdGhlIHRyaWdnZXIgZWxlbWVudCBzaG91bGQndmUgYmVlbiByZW5kZXJlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFRyaWdnZXJFbGVtZW50KHRyaWdnZXJMVmlldzogTFZpZXcsIHRyaWdnZXJJbmRleDogbnVtYmVyKTogRWxlbWVudCB7XG4gIGNvbnN0IGVsZW1lbnQgPSBnZXROYXRpdmVCeUluZGV4KEhFQURFUl9PRkZTRVQgKyB0cmlnZ2VySW5kZXgsIHRyaWdnZXJMVmlldyk7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnRFbGVtZW50KGVsZW1lbnQpO1xuICByZXR1cm4gZWxlbWVudCBhcyBFbGVtZW50O1xufVxuXG4vKipcbiAqIFJlZ2lzdGVycyBhIERPTS1ub2RlIGJhc2VkIHRyaWdnZXIuXG4gKiBAcGFyYW0gaW5pdGlhbExWaWV3IExWaWV3IGluIHdoaWNoIHRoZSBkZWZlciBibG9jayBpcyByZW5kZXJlZC5cbiAqIEBwYXJhbSB0Tm9kZSBUTm9kZSByZXByZXNlbnRpbmcgdGhlIGRlZmVyIGJsb2NrLlxuICogQHBhcmFtIHRyaWdnZXJJbmRleCBJbmRleCBhdCB3aGljaCB0byBmaW5kIHRoZSB0cmlnZ2VyIGVsZW1lbnQuXG4gKiBAcGFyYW0gd2Fsa1VwVGltZXMgTnVtYmVyIG9mIHRpbWVzIHRvIGdvIHVwL2Rvd24gaW4gdGhlIHZpZXcgaGllcmFyY2h5IHRvIGZpbmQgdGhlIHRyaWdnZXIuXG4gKiBAcGFyYW0gcmVnaXN0ZXJGbiBGdW5jdGlvbiB0aGF0IHdpbGwgcmVnaXN0ZXIgdGhlIERPTSBldmVudHMuXG4gKiBAcGFyYW0gY2FsbGJhY2sgQ2FsbGJhY2sgdG8gYmUgaW52b2tlZCB3aGVuIHRoZSB0cmlnZ2VyIHJlY2VpdmVzIHRoZSBldmVudCB0aGF0IHNob3VsZCByZW5kZXJcbiAqICAgICB0aGUgZGVmZXJyZWQgYmxvY2suXG4gKiBAcGFyYW0gdHlwZSBUcmlnZ2VyIHR5cGUgdG8gZGlzdGluZ3Vpc2ggYmV0d2VlbiByZWd1bGFyIGFuZCBwcmVmZXRjaCB0cmlnZ2Vycy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyRG9tVHJpZ2dlcihcbiAgaW5pdGlhbExWaWV3OiBMVmlldyxcbiAgdE5vZGU6IFROb2RlLFxuICB0cmlnZ2VySW5kZXg6IG51bWJlcixcbiAgd2Fsa1VwVGltZXM6IG51bWJlciB8IHVuZGVmaW5lZCxcbiAgcmVnaXN0ZXJGbjogKGVsZW1lbnQ6IEVsZW1lbnQsIGNhbGxiYWNrOiBWb2lkRnVuY3Rpb24sIGluamVjdG9yOiBJbmplY3RvcikgPT4gVm9pZEZ1bmN0aW9uLFxuICBjYWxsYmFjazogVm9pZEZ1bmN0aW9uLFxuICB0eXBlOiBUcmlnZ2VyVHlwZSxcbikge1xuICBjb25zdCBpbmplY3RvciA9IGluaXRpYWxMVmlld1tJTkpFQ1RPUl0hO1xuICBmdW5jdGlvbiBwb2xsRG9tVHJpZ2dlcigpIHtcbiAgICAvLyBJZiB0aGUgaW5pdGlhbCB2aWV3IHdhcyBkZXN0cm95ZWQsIHdlIGRvbid0IG5lZWQgdG8gZG8gYW55dGhpbmcuXG4gICAgaWYgKGlzRGVzdHJveWVkKGluaXRpYWxMVmlldykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsRGV0YWlscyA9IGdldExEZWZlckJsb2NrRGV0YWlscyhpbml0aWFsTFZpZXcsIHROb2RlKTtcbiAgICBjb25zdCByZW5kZXJlZFN0YXRlID0gbERldGFpbHNbREVGRVJfQkxPQ0tfU1RBVEVdO1xuXG4gICAgLy8gSWYgdGhlIGJsb2NrIHdhcyBsb2FkZWQgYmVmb3JlIHRoZSB0cmlnZ2VyIHdhcyByZXNvbHZlZCwgd2UgZG9uJ3QgbmVlZCB0byBkbyBhbnl0aGluZy5cbiAgICBpZiAoXG4gICAgICByZW5kZXJlZFN0YXRlICE9PSBEZWZlckJsb2NrSW50ZXJuYWxTdGF0ZS5Jbml0aWFsICYmXG4gICAgICByZW5kZXJlZFN0YXRlICE9PSBEZWZlckJsb2NrU3RhdGUuUGxhY2Vob2xkZXJcbiAgICApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0cmlnZ2VyTFZpZXcgPSBnZXRUcmlnZ2VyTFZpZXcoaW5pdGlhbExWaWV3LCB0Tm9kZSwgd2Fsa1VwVGltZXMpO1xuXG4gICAgLy8gS2VlcCBwb2xsaW5nIHVudGlsIHdlIHJlc29sdmUgdGhlIHRyaWdnZXIncyBMVmlldy5cbiAgICBpZiAoIXRyaWdnZXJMVmlldykge1xuICAgICAgaW50ZXJuYWxBZnRlck5leHRSZW5kZXIocG9sbERvbVRyaWdnZXIsIHtpbmplY3Rvcn0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEl0J3MgcG9zc2libGUgdGhhdCB0aGUgdHJpZ2dlcidzIHZpZXcgd2FzIGRlc3Ryb3llZCBiZWZvcmUgd2UgcmVzb2x2ZWQgdGhlIHRyaWdnZXIgZWxlbWVudC5cbiAgICBpZiAoaXNEZXN0cm95ZWQodHJpZ2dlckxWaWV3KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGVsZW1lbnQgPSBnZXRUcmlnZ2VyRWxlbWVudCh0cmlnZ2VyTFZpZXcsIHRyaWdnZXJJbmRleCk7XG4gICAgY29uc3QgY2xlYW51cCA9IHJlZ2lzdGVyRm4oXG4gICAgICBlbGVtZW50LFxuICAgICAgKCkgPT4ge1xuICAgICAgICBpZiAoaW5pdGlhbExWaWV3ICE9PSB0cmlnZ2VyTFZpZXcpIHtcbiAgICAgICAgICByZW1vdmVMVmlld09uRGVzdHJveSh0cmlnZ2VyTFZpZXcsIGNsZWFudXApO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICB9LFxuICAgICAgaW5qZWN0b3IsXG4gICAgKTtcblxuICAgIC8vIFRoZSB0cmlnZ2VyIGFuZCBkZWZlcnJlZCBibG9jayBtaWdodCBiZSBpbiBkaWZmZXJlbnQgTFZpZXdzLlxuICAgIC8vIEZvciB0aGUgbWFpbiBMVmlldyB0aGUgY2xlYW51cCB3b3VsZCBoYXBwZW4gYXMgYSBwYXJ0IG9mXG4gICAgLy8gYHN0b3JlVHJpZ2dlckNsZWFudXBGbmAgbG9naWMuIEZvciB0cmlnZ2VyIExWaWV3IHdlIHJlZ2lzdGVyXG4gICAgLy8gYSBjbGVhbnVwIGZ1bmN0aW9uIHRoZXJlIHRvIHJlbW92ZSBldmVudCBoYW5kbGVycyBpbiBjYXNlIGFuXG4gICAgLy8gTFZpZXcgZ2V0cyBkZXN0cm95ZWQgYmVmb3JlIGEgdHJpZ2dlciBpcyBpbnZva2VkLlxuICAgIGlmIChpbml0aWFsTFZpZXcgIT09IHRyaWdnZXJMVmlldykge1xuICAgICAgc3RvcmVMVmlld09uRGVzdHJveSh0cmlnZ2VyTFZpZXcsIGNsZWFudXApO1xuICAgIH1cblxuICAgIHN0b3JlVHJpZ2dlckNsZWFudXBGbih0eXBlLCBsRGV0YWlscywgY2xlYW51cCk7XG4gIH1cblxuICAvLyBCZWdpbiBwb2xsaW5nIGZvciB0aGUgdHJpZ2dlci5cbiAgaW50ZXJuYWxBZnRlck5leHRSZW5kZXIocG9sbERvbVRyaWdnZXIsIHtpbmplY3Rvcn0pO1xufVxuIl19