/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as eventLib from './event';
import { MOUSE_SPECIAL_SUPPORT } from './event_contract_defines';
import * as eventInfoLib from './event_info';
import { MOUSE_SPECIAL_EVENT_TYPES } from './event_type';
/**
 * EventContract intercepts events in the bubbling phase at the
 * boundary of a container element, and maps them to generic actions
 * which are specified using the custom jsaction attribute in
 * HTML. Behavior of the application is then specified in terms of
 * handler for such actions, cf. jsaction.Dispatcher in dispatcher.js.
 *
 * This has several benefits: (1) No DOM event handlers need to be
 * registered on the specific elements in the UI. (2) The set of
 * events that the application has to handle can be specified in terms
 * of the semantics of the application, rather than in terms of DOM
 * events. (3) Invocation of handlers can be delayed and handlers can
 * be delay loaded in a generic way.
 */
export class EventContract {
    static { this.MOUSE_SPECIAL_SUPPORT = MOUSE_SPECIAL_SUPPORT; }
    constructor(containerManager, useActionResolver) {
        this.useActionResolver = useActionResolver;
        /**
         * The DOM events which this contract covers. Used to prevent double
         * registration of event types. The value of the map is the
         * internally created DOM event handler function that handles the
         * DOM events. See addEvent().
         *
         */
        this.eventHandlers = {};
        this.browserEventTypeToExtraEventTypes = {};
        /**
         * The dispatcher function. Events are passed to this function for
         * handling once it was set using the registerDispatcher() method. This is
         * done because the function is passed from another jsbinary, so passing the
         * instance and invoking the method here would require to leave the method
         * unobfuscated.
         */
        this.dispatcher = null;
        /**
         * The list of suspended `EventInfo` that will be dispatched
         * as soon as the `Dispatcher` is registered.
         */
        this.queuedEventInfos = [];
        this.containerManager = containerManager;
    }
    handleEvent(eventType, event, container) {
        const eventInfo = eventInfoLib.createEventInfoFromParameters(
        /* eventType= */ eventType, 
        /* event= */ event, 
        /* targetElement= */ event.target, 
        /* container= */ container, 
        /* timestamp= */ Date.now());
        this.handleEventInfo(eventInfo);
    }
    /**
     * Handle an `EventInfo`.
     */
    handleEventInfo(eventInfo) {
        if (!this.dispatcher) {
            // All events are queued when the dispatcher isn't yet loaded.
            eventInfoLib.setIsReplay(eventInfo, true);
            this.queuedEventInfos?.push(eventInfo);
            return;
        }
        this.dispatcher(eventInfo);
    }
    /**
     * Enables jsaction handlers to be called for the event type given by
     * name.
     *
     * If the event is already registered, this does nothing.
     *
     * @param prefixedEventType If supplied, this event is used in
     *     the actual browser event registration instead of the name that is
     *     exposed to jsaction. Use this if you e.g. want users to be able
     *     to subscribe to jsaction="transitionEnd:foo" while the underlying
     *     event is webkitTransitionEnd in one browser and mozTransitionEnd
     *     in another.
     */
    addEvent(eventType, prefixedEventType) {
        if (eventType in this.eventHandlers || !this.containerManager) {
            return;
        }
        if (!EventContract.MOUSE_SPECIAL_SUPPORT && MOUSE_SPECIAL_EVENT_TYPES.indexOf(eventType) >= 0) {
            return;
        }
        const eventHandler = (eventType, event, container) => {
            this.handleEvent(eventType, event, container);
        };
        // Store the callback to allow us to replay events.
        this.eventHandlers[eventType] = eventHandler;
        const browserEventType = eventLib.getBrowserEventType(prefixedEventType || eventType);
        if (browserEventType !== eventType) {
            const eventTypes = this.browserEventTypeToExtraEventTypes[browserEventType] || [];
            eventTypes.push(eventType);
            this.browserEventTypeToExtraEventTypes[browserEventType] = eventTypes;
        }
        this.containerManager.addEventListener(browserEventType, (element) => {
            return (event) => {
                eventHandler(eventType, event, element);
            };
        });
    }
    /**
     * Gets the queued early events and replay them using the appropriate handler
     * in the provided event contract. Once all the events are replayed, it cleans
     * up the early contract.
     */
    replayEarlyEvents(earlyJsactionData = window._ejsa) {
        // Check if the early contract is present and prevent calling this function
        // more than once.
        if (!earlyJsactionData) {
            return;
        }
        // Replay the early contract events.
        const earlyEventInfos = earlyJsactionData.q;
        for (let idx = 0; idx < earlyEventInfos.length; idx++) {
            const earlyEventInfo = earlyEventInfos[idx];
            const eventTypes = this.getEventTypesForBrowserEventType(earlyEventInfo.eventType);
            for (let i = 0; i < eventTypes.length; i++) {
                const eventInfo = eventInfoLib.cloneEventInfo(earlyEventInfo);
                // EventInfo eventType maps to JSAction's internal event type,
                // rather than the browser event type.
                eventInfoLib.setEventType(eventInfo, eventTypes[i]);
                this.handleEventInfo(eventInfo);
            }
        }
        // Clean up the early contract.
        const earlyEventHandler = earlyJsactionData.h;
        removeEventListeners(earlyJsactionData.c, earlyJsactionData.et, earlyEventHandler);
        removeEventListeners(earlyJsactionData.c, earlyJsactionData.etc, earlyEventHandler, true);
        delete window._ejsa;
    }
    /**
     * Returns all JSAction event types that have been registered for a given
     * browser event type.
     */
    getEventTypesForBrowserEventType(browserEventType) {
        const eventTypes = [];
        if (this.eventHandlers[browserEventType]) {
            eventTypes.push(browserEventType);
        }
        if (this.browserEventTypeToExtraEventTypes[browserEventType]) {
            eventTypes.push(...this.browserEventTypeToExtraEventTypes[browserEventType]);
        }
        return eventTypes;
    }
    /**
     * Returns the event handler function for a given event type.
     */
    handler(eventType) {
        return this.eventHandlers[eventType];
    }
    /**
     * Cleans up the event contract. This resets all of the `EventContract`'s
     * internal state. Users are responsible for not using this `EventContract`
     * after it has been cleaned up.
     */
    cleanUp() {
        this.containerManager.cleanUp();
        this.containerManager = null;
        this.eventHandlers = {};
        this.browserEventTypeToExtraEventTypes = {};
        this.dispatcher = null;
        this.queuedEventInfos = [];
    }
    /**
     * Register a dispatcher function. Event info of each event mapped to
     * a jsaction is passed for handling to this callback. The queued
     * events are passed as well to the dispatcher for later replaying
     * once the dispatcher is registered. Clears the event queue to null.
     *
     * @param dispatcher The dispatcher function.
     * @param restriction
     */
    registerDispatcher(dispatcher, restriction) {
        this.ecrd(dispatcher, restriction);
    }
    /**
     * Unrenamed alias for registerDispatcher. Necessary for any codebases that
     * split the `EventContract` and `Dispatcher` code into different compilation
     * units.
     */
    ecrd(dispatcher, restriction) {
        this.dispatcher = dispatcher;
        if (this.queuedEventInfos?.length) {
            for (let i = 0; i < this.queuedEventInfos.length; i++) {
                this.handleEventInfo(this.queuedEventInfos[i]);
            }
            this.queuedEventInfos = null;
        }
    }
    /**
     * Adds a11y click support to the given `EventContract`. Meant to be called in
     * the same compilation unit as the `EventContract`.
     */
    addA11yClickSupport() { }
    /**
     * Enables a11y click support to be deferred. Meant to be called in the same
     * compilation unit as the `EventContract`.
     */
    exportAddA11yClickSupport() { }
}
function removeEventListeners(container, eventTypes, earlyEventHandler, capture) {
    for (let idx = 0; idx < eventTypes.length; idx++) {
        container.removeEventListener(eventTypes[idx], earlyEventHandler, /* useCapture */ capture);
    }
}
/**
 * Adds a11y click support to the given `EventContract`. Meant to be called
 * in a different compilation unit from the `EventContract`. The `EventContract`
 * must have called `exportAddA11yClickSupport` in its compilation unit for this
 * to have any effect.
 */
export function addDeferredA11yClickSupport(eventContract) { }
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRjb250cmFjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvcHJpbWl0aXZlcy9ldmVudC1kaXNwYXRjaC9zcmMvZXZlbnRjb250cmFjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUEyQkgsT0FBTyxLQUFLLFFBQVEsTUFBTSxTQUFTLENBQUM7QUFFcEMsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFDL0QsT0FBTyxLQUFLLFlBQVksTUFBTSxjQUFjLENBQUM7QUFDN0MsT0FBTyxFQUFDLHlCQUF5QixFQUFDLE1BQU0sY0FBYyxDQUFDO0FBeUJ2RDs7Ozs7Ozs7Ozs7OztHQWFHO0FBQ0gsTUFBTSxPQUFPLGFBQWE7YUFDakIsMEJBQXFCLEdBQUcscUJBQXFCLEFBQXhCLENBQXlCO0lBOEJyRCxZQUNFLGdCQUErQyxFQUM5QixpQkFBeUI7UUFBekIsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFRO1FBNUI1Qzs7Ozs7O1dBTUc7UUFDSyxrQkFBYSxHQUFrQyxFQUFFLENBQUM7UUFFbEQsc0NBQWlDLEdBQThCLEVBQUUsQ0FBQztRQUUxRTs7Ozs7O1dBTUc7UUFDSyxlQUFVLEdBQXNCLElBQUksQ0FBQztRQUU3Qzs7O1dBR0c7UUFDSyxxQkFBZ0IsR0FBb0MsRUFBRSxDQUFDO1FBTTdELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxnQkFBZ0IsQ0FBQztJQUMzQyxDQUFDO0lBRU8sV0FBVyxDQUFDLFNBQWlCLEVBQUUsS0FBWSxFQUFFLFNBQWtCO1FBQ3JFLE1BQU0sU0FBUyxHQUFHLFlBQVksQ0FBQyw2QkFBNkI7UUFDMUQsZ0JBQWdCLENBQUMsU0FBUztRQUMxQixZQUFZLENBQUMsS0FBSztRQUNsQixvQkFBb0IsQ0FBQyxLQUFLLENBQUMsTUFBaUI7UUFDNUMsZ0JBQWdCLENBQUMsU0FBUztRQUMxQixnQkFBZ0IsQ0FB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QUFHLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDO1FBQ2pELFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDOUYsQ0FBQztBQUNILENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sVUFBVSwyQkFBMkIsQ0FBQyxhQUE0QixJQUFHLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLyoqXG4gKiBAZmlsZW92ZXJ2aWV3IEltcGxlbWVudHMgdGhlIGxvY2FsIGV2ZW50IGhhbmRsaW5nIGNvbnRyYWN0LiBUaGlzXG4gKiBhbGxvd3MgRE9NIG9iamVjdHMgaW4gYSBjb250YWluZXIgdGhhdCBlbnRlcnMgaW50byB0aGlzIGNvbnRyYWN0IHRvXG4gKiBkZWZpbmUgZXZlbnQgaGFuZGxlcnMgd2hpY2ggYXJlIGV4ZWN1dGVkIGluIGEgbG9jYWwgY29udGV4dC5cbiAqXG4gKiBPbmUgRXZlbnRDb250cmFjdCBpbnN0YW5jZSBjYW4gbWFuYWdlIHRoZSBjb250cmFjdCBmb3IgbXVsdGlwbGVcbiAqIGNvbnRhaW5lcnMsIHdoaWNoIGFyZSBhZGRlZCB1c2luZyB0aGUgYWRkQ29udGFpbmVyKCkgbWV0aG9kLlxuICpcbiAqIEV2ZW50cyBjYW4gYmUgcmVnaXN0ZXJlZCB1c2luZyB0aGUgYWRkRXZlbnQoKSBtZXRob2QuXG4gKlxuICogQSBEaXNwYXRjaGVyIGlzIGFkZGVkIHVzaW5nIHRoZSByZWdpc3RlckRpc3BhdGNoZXIoKSBtZXRob2QuIFVudGlsIHRoZXJlIGlzXG4gKiBhIGRpc3BhdGNoZXIsIGV2ZW50cyBhcmUgcXVldWVkLiBUaGUgaWRlYSBpcyB0aGF0IHRoZSBFdmVudENvbnRyYWN0XG4gKiBjbGFzcyBpcyBpbmxpbmVkIGluIHRoZSBIVE1MIG9mIHRoZSB0b3AgbGV2ZWwgcGFnZSBhbmQgaW5zdGFudGlhdGVkXG4gKiByaWdodCBhZnRlciB0aGUgc3RhcnQgb2YgPGJvZHk+LiBUaGUgRGlzcGF0Y2hlciBjbGFzcyBpcyBjb250YWluZWRcbiAqIGluIHRoZSBleHRlcm5hbCBkZWZlcnJlZCBqcywgYW5kIGluc3RhbnRpYXRlZCBhbmQgcmVnaXN0ZXJlZCB3aXRoXG4gKiBFdmVudENvbnRyYWN0IHdoZW4gdGhlIGV4dGVybmFsIGphdmFzY3JpcHQgaW4gdGhlIHBhZ2UgbG9hZHMuIFRoZVxuICogZXh0ZXJuYWwgamF2YXNjcmlwdCB3aWxsIGFsc28gcmVnaXN0ZXIgdGhlIGpzYWN0aW9uIGhhbmRsZXJzLCB3aGljaFxuICogdGhlbiBwaWNrIHVwIHRoZSBxdWV1ZWQgZXZlbnRzIGF0IHRoZSB0aW1lIG9mIHJlZ2lzdHJhdGlvbi5cbiAqXG4gKiBTaW5jZSB0aGlzIGNsYXNzIGlzIG1lYW50IHRvIGJlIGlubGluZWQgaW4gdGhlIG1haW4gcGFnZSBIVE1MLCB0aGVcbiAqIHNpemUgb2YgdGhlIGJpbmFyeSBjb21waWxlZCBmcm9tIHRoaXMgZmlsZSBNVVNUIGJlIGtlcHQgYXMgc21hbGwgYXNcbiAqIHBvc3NpYmxlIGFuZCB0aHVzIGl0cyBkZXBlbmRlbmNpZXMgdG8gYSBtaW5pbXVtLlxuICovXG5cbmltcG9ydCB7RWFybHlKc2FjdGlvbkRhdGEsIEVhcmx5SnNhY3Rpb25EYXRhQ29udGFpbmVyfSBmcm9tICcuL2Vhcmx5ZXZlbnRjb250cmFjdCc7XG5pbXBvcnQgKiBhcyBldmVudExpYiBmcm9tICcuL2V2ZW50JztcbmltcG9ydCB7RXZlbnRDb250cmFjdENvbnRhaW5lck1hbmFnZXJ9IGZyb20gJy4vZXZlbnRfY29udHJhY3RfY29udGFpbmVyJztcbmltcG9ydCB7TU9VU0VfU1BFQ0lBTF9TVVBQT1JUfSBmcm9tICcuL2V2ZW50X2NvbnRyYWN0X2RlZmluZXMnO1xuaW1wb3J0ICogYXMgZXZlbnRJbmZvTGliIGZyb20gJy4vZXZlbnRfaW5mbyc7XG5pbXBvcnQge01PVVNFX1NQRUNJQUxfRVZFTlRfVFlQRVN9IGZyb20gJy4vZXZlbnRfdHlwZSc7XG5pbXBvcnQge1Jlc3RyaWN0aW9ufSBmcm9tICcuL3Jlc3RyaWN0aW9uJztcblxuLyoqXG4gKiBUaGUgQVBJIG9mIGFuIEV2ZW50Q29udHJhY3QgdGhhdCBpcyBzYWZlIHRvIGNhbGwgZnJvbSBhbnkgY29tcGlsYXRpb24gdW5pdC5cbiAqL1xuZXhwb3J0IGRlY2xhcmUgaW50ZXJmYWNlIFVucmVuYW1lZEV2ZW50Q29udHJhY3Qge1xuICAvLyBBbGlhcyBmb3IgSnNjdGlvbiBFdmVudENvbnRyYWN0IHJlZ2lzdGVyRGlzcGF0Y2hlci5cbiAgZWNyZChkaXNwYXRjaGVyOiBEaXNwYXRjaGVyLCByZXN0cmljdGlvbjogUmVzdHJpY3Rpb24pOiB2b2lkO1xufVxuXG4vKiogQSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCB0byBoYW5kbGUgZXZlbnRzIGNhcHR1cmVkIGJ5IHRoZSBFdmVudENvbnRyYWN0LiAqL1xuZXhwb3J0IHR5cGUgRGlzcGF0Y2hlciA9IChldmVudEluZm86IGV2ZW50SW5mb0xpYi5FdmVudEluZm8sIGdsb2JhbERpc3BhdGNoPzogYm9vbGVhbikgPT4gdm9pZDtcblxuLyoqXG4gKiBBIGZ1bmN0aW9uIHRoYXQgaGFuZGxlcyBhbiBldmVudCBkaXNwYXRjaGVkIGZyb20gdGhlIGJyb3dzZXIuXG4gKlxuICogZXZlbnRUeXBlOiBNYXkgZGlmZmVyIGZyb20gYGV2ZW50LnR5cGVgIGlmIEpTQWN0aW9uIHVzZXMgYVxuICogc2hvcnQtaGFuZCBuYW1lIG9yIGlzIHBhdGNoaW5nIG92ZXIgYW4gbm9uLWJ1YmJsaW5nIGV2ZW50IHdpdGggYSBidWJibGluZ1xuICogdmFyaWFudC5cbiAqIGV2ZW50OiBUaGUgbmF0aXZlIGJyb3dzZXIgZXZlbnQuXG4gKiBjb250YWluZXI6IFRoZSBjb250YWluZXIgZm9yIHRoaXMgZGlzcGF0Y2guXG4gKi9cbnR5cGUgRXZlbnRIYW5kbGVyID0gKGV2ZW50VHlwZTogc3RyaW5nLCBldmVudDogRXZlbnQsIGNvbnRhaW5lcjogRWxlbWVudCkgPT4gdm9pZDtcblxuLyoqXG4gKiBFdmVudENvbnRyYWN0IGludGVyY2VwdHMgZXZlbnRzIGluIHRoZSBidWJibGluZyBwaGFzZSBhdCB0aGVcbiAqIGJvdW5kYXJ5IG9mIGEgY29udGFpbmVyIGVsZW1lbnQsIGFuZCBtYXBzIHRoZW0gdG8gZ2VuZXJpYyBhY3Rpb25zXG4gKiB3aGljaCBhcmUgc3BlY2lmaWVkIHVzaW5nIHRoZSBjdXN0b20ganNhY3Rpb24gYXR0cmlidXRlIGluXG4gKiBIVE1MLiBCZWhhdmlvciBvZiB0aGUgYXBwbGljYXRpb24gaXMgdGhlbiBzcGVjaWZpZWQgaW4gdGVybXMgb2ZcbiAqIGhhbmRsZXIgZm9yIHN1Y2ggYWN0aW9ucywgY2YuIGpzYWN0aW9uLkRpc3BhdGNoZXIgaW4gZGlzcGF0Y2hlci5qcy5cbiAqXG4gKiBUaGlzIGhhcyBzZXZlcmFsIGJlbmVmaXRzOiAoMSkgTm8gRE9NIGV2ZW50IGhhbmRsZXJzIG5lZWQgdG8gYmVcbiAqIHJlZ2lzdGVyZWQgb24gdGhlIHNwZWNpZmljIGVsZW1lbnRzIGluIHRoZSBVSS4gKDIpIFRoZSBzZXQgb2ZcbiAqIGV2ZW50cyB0aGF0IHRoZSBhcHBsaWNhdGlvbiBoYXMgdG8gaGFuZGxlIGNhbiBiZSBzcGVjaWZpZWQgaW4gdGVybXNcbiAqIG9mIHRoZSBzZW1hbnRpY3Mgb2YgdGhlIGFwcGxpY2F0aW9uLCByYXRoZXIgdGhhbiBpbiB0ZXJtcyBvZiBET01cbiAqIGV2ZW50cy4gKDMpIEludm9jYXRpb24gb2YgaGFuZGxlcnMgY2FuIGJlIGRlbGF5ZWQgYW5kIGhhbmRsZXJzIGNhblxuICogYmUgZGVsYXkgbG9hZGVkIGluIGEgZ2VuZXJpYyB3YXkuXG4gKi9cbmV4cG9ydCBjbGFzcyBFdmVudENvbnRyYWN0IGltcGxlbWVudHMgVW5yZW5hbWVkRXZlbnRDb250cmFjdCB7XG4gIHN0YXRpYyBNT1VTRV9TUEVDSUFMX1NVUFBPUlQgPSBNT1VTRV9TUEVDSUFMX1NVUFBPUlQ7XG5cbiAgcHJpdmF0ZSBjb250YWluZXJNYW5hZ2VyOiBFdmVudENvbnRyYWN0Q29udGFpbmVyTWFuYWdlciB8IG51bGw7XG5cbiAgLyoqXG4gICAqIFRoZSBET00gZXZlbnRzIHdoaWNoIHRoaXMgY29udHJhY3QgY292ZXJzLiBVc2VkIHRvIHByZXZlbnQgZG91YmxlXG4gICAqIHJlZ2lzdHJhdGlvbiBvZiBldmVudCB0eXBlcy4gVGhlIHZhbHVlIG9mIHRoZSBtYXAgaXMgdGhlXG4gICAqIGludGVybmFsbHkgY3JlYXRlZCBET00gZXZlbnQgaGFuZGxlciBmdW5jdGlvbiB0aGF0IGhhbmRsZXMgdGhlXG4gICAqIERPTSBldmVudHMuIFNlZSBhZGRFdmVudCgpLlxuICAgKlxuICAgKi9cbiAgcHJpdmF0ZSBldmVudEhhbmRsZXJzOiB7W2tleTogc3RyaW5nXTogRXZlbnRIYW5kbGVyfSA9IHt9O1xuXG4gIHByaXZhdGUgYnJvd3NlckV2ZW50VHlwZVRvRXh0cmFFdmVudFR5cGVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nW119ID0ge307XG5cbiAgLyoqXG4gICAqIFRoZSBkaXNwYXRjaGVyIGZ1bmN0aW9uLiBFdmVudHMgYXJlIHBhc3NlZCB0byB0aGlzIGZ1bmN0aW9uIGZvclxuICAgKiBoYW5kbGluZyBvbmNlIGl0IHdhcyBzZXQgdXNpbmcgdGhlIHJlZ2lzdGVyRGlzcGF0Y2hlcigpIG1ldGhvZC4gVGhpcyBpc1xuICAgKiBkb25lIGJlY2F1c2UgdGhlIGZ1bmN0aW9uIGlzIHBhc3NlZCBmcm9tIGFub3RoZXIganNiaW5hcnksIHNvIHBhc3NpbmcgdGhlXG4gICAqIGluc3RhbmNlIGFuZCBpbnZva2luZyB0aGUgbWV0aG9kIGhlcmUgd291bGQgcmVxdWlyZSB0byBsZWF2ZSB0aGUgbWV0aG9kXG4gICAqIHVub2JmdXNjYXRlZC5cbiAgICovXG4gIHByaXZhdGUgZGlzcGF0Y2hlcjogRGlzcGF0Y2hlciB8IG51bGwgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBUaGUgbGlzdCBvZiBzdXNwZW5kZWQgYEV2ZW50SW5mb2AgdGhhdCB3aWxsIGJlIGRpc3BhdGNoZWRcbiAgICogYXMgc29vbiBhcyB0aGUgYERpc3BhdGNoZXJgIGlzIHJlZ2lzdGVyZWQuXG4gICAqL1xuICBwcml2YXRlIHF1ZXVlZEV2ZW50SW5mb3M6IGV2ZW50SW5mb0xpYi5FdmVudEluZm9bXSB8IG51bGwgPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBjb250YWluZXJNYW5hZ2VyOiBFdmVudENvbnRyYWN0Q29udGFpbmVyTWFuYWdlcixcbiAgICBwcml2YXRlIHJlYWRvbmx5IHVzZUFjdGlvblJlc29sdmVyPzogZmFsc2UsXG4gICkge1xuICAgIHRoaXMuY29udGFpbmVyTWFuYWdlciA9IGNvbnRhaW5lck1hbmFnZXI7XG4gIH1cblxuICBwcml2YXRlIGhhbmRsZUV2ZW50KGV2ZW50VHlwZTogc3RyaW5nLCBldmVudDogRXZlbnQsIGNvbnRhaW5lcjogRWxlbWVudCkge1xuICAgIGNvbnN0IGV2ZW50SW5mbyA9IGV2ZW50SW5mb0xpYi5jcmVhdGVFdmVudEluZm9Gcm9tUGFyYW1ldGVycyhcbiAgICAgIC8qIGV2ZW50VHlwZT0gKi8gZXZlbnRUeXBlLFxuICAgICAgLyogZXZlbnQ9ICovIGV2ZW50LFxuICAgICAgLyogdGFyZ2V0RWxlbWVudD0gKi8gZXZlbnQudGFyZ2V0IGFzIEVsZW1lbnQsXG4gICAgICAvKiBjb250YWluZXI9ICovIGNvbnRhaW5lcixcbiAgICAgIC8qIHRpbWVzdGFtcD0gKi8gRGF0ZS5ub3coKSxcbiAgICApO1xuICAgIHRoaXMuaGFuZGxlRXZlbnRJbmZvKGV2ZW50SW5mbyk7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIGFuIGBFdmVudEluZm9gLlxuICAgKi9cbiAgcHJpdmF0ZSBoYW5kbGVFdmVudEluZm8oZXZlbnRJbmZvOiBldmVudEluZm9MaWIuRXZlbnRJbmZvKSB7XG4gICAgaWYgKCF0aGlzLmRpc3BhdGNoZXIpIHtcbiAgICAgIC8vIEFsbCBldmVudHMgYXJlIHF1ZXVlZCB3aGVuIHRoZSBkaXNwYXRjaGVyIGlzbid0IHlldCBsb2FkZWQuXG4gICAgICBldmVudEluZm9MaWIuc2V0SXNSZXBsYXkoZXZlbnRJbmZvLCB0cnVlKTtcbiAgICAgIHRoaXMucXVldWVkRXZlbnRJbmZvcz8ucHVzaChldmVudEluZm8pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLmRpc3BhdGNoZXIoZXZlbnRJbmZvKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFbmFibGVzIGpzYWN0aW9uIGhhbmRsZXJzIHRvIGJlIGNhbGxlZCBmb3IgdGhlIGV2ZW50IHR5cGUgZ2l2ZW4gYnlcbiAgICogbmFtZS5cbiAgICpcbiAgICogSWYgdGhlIGV2ZW50IGlzIGFscmVhZHkgcmVnaXN0ZXJlZCwgdGhpcyBkb2VzIG5vdGhpbmcuXG4gICAqXG4gICAqIEBwYXJhbSBwcmVmaXhlZEV2ZW50VHlwZSBJZiBzdXBwbGllZCwgdGhpcyBldmVudCBpcyB1c2VkIGluXG4gICAqICAgICB0aGUgYWN0dWFsIGJyb3dzZXIgZXZlbnQgcmVnaXN0cmF0aW9uIGluc3RlYWQgb2YgdGhlIG5hbWUgdGhhdCBpc1xuICAgKiAgICAgZXhwb3NlZCB0byBqc2FjdGlvbi4gVXNlIHRoaXMgaWYgeW91IGUuZy4gd2FudCB1c2VycyB0byBiZSBhYmxlXG4gICAqICAgICB0byBzdWJzY3JpYmUgdG8ganNhY3Rpb249XCJ0cmFuc2l0aW9uRW5kOmZvb1wiIHdoaWxlIHRoZSB1bmRlcmx5aW5nXG4gICAqICAgICBldmVudCBpcyB3ZWJraXRUcmFuc2l0aW9uRW5kIGluIG9uZSBicm93c2VyIGFuZCBtb3pUcmFuc2l0aW9uRW5kXG4gICAqICAgICBpbiBhbm90aGVyLlxuICAgKi9cbiAgYWRkRXZlbnQoZXZlbnRUeXBlOiBzdHJpbmcsIHByZWZpeGVkRXZlbnRUeXBlPzogc3RyaW5nKSB7XG4gICAgaWYgKGV2ZW50VHlwZSBpbiB0aGlzLmV2ZW50SGFuZGxlcnMgfHwgIXRoaXMuY29udGFpbmVyTWFuYWdlcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghRXZlbnRDb250cmFjdC5NT1VTRV9TUEVDSUFMX1NVUFBPUlQgJiYgTU9VU0VfU1BFQ0lBTF9FVkVOVF9UWVBFUy5pbmRleE9mKGV2ZW50VHlwZSkgPj0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGV2ZW50SGFuZGxlciA9IChldmVudFR5cGU6IHN0cmluZywgZXZlbnQ6IEV2ZW50LCBjb250YWluZXI6IEVsZW1lbnQpID0+IHtcbiAgICAgIHRoaXMuaGFuZGxlRXZlbnQoZXZlbnRUeXBlLCBldmVudCwgY29udGFpbmVyKTtcbiAgICB9O1xuXG4gICAgLy8gU3RvcmUgdGhlIGNhbGxiYWNrIHRvIGFsbG93IHVzIHRvIHJlcGxheSBldmVudHMuXG4gICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50VHlwZV0gPSBldmVudEhhbmRsZXI7XG5cbiAgICBjb25zdCBicm93c2VyRXZlbnRUeXBlID0gZXZlbnRMaWIuZ2V0QnJvd3NlckV2ZW50VHlwZShwcmVmaXhlZEV2ZW50VHlwZSB8fCBldmVudFR5cGUpO1xuXG4gICAgaWYgKGJyb3dzZXJFdmVudFR5cGUgIT09IGV2ZW50VHlwZSkge1xuICAgICAgY29uc3QgZXZlbnRUeXBlcyA9IHRoaXMuYnJvd3NlckV2ZW50VHlwZVRvRXh0cmFFdmVudFR5cGVzW2Jyb3dzZXJFdmVudFR5cGVdIHx8IFtdO1xuICAgICAgZXZlbnRUeXBlcy5wdXNoKGV2ZW50VHlwZSk7XG4gICAgICB0aGlzLmJyb3dzZXJFdmVudFR5cGVUb0V4dHJhRXZlbnRUeXBlc1ticm93c2VyRXZlbnRUeXBlXSA9IGV2ZW50VHlwZXM7XG4gICAgfVxuXG4gICAgdGhpcy5jb250YWluZXJNYW5hZ2VyLmFkZEV2ZW50TGlzdGVuZXIoYnJvd3NlckV2ZW50VHlwZSwgKGVsZW1lbnQ6IEVsZW1lbnQpID0+IHtcbiAgICAgIHJldHVybiAoZXZlbnQ6IEV2ZW50KSA9PiB7XG4gICAgICAgIGV2ZW50SGFuZGxlcihldmVudFR5cGUsIGV2ZW50LCBlbGVtZW50KTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgcXVldWVkIGVhcmx5IGV2ZW50cyBhbmQgcmVwbGF5IHRoZW0gdXNpbmcgdGhlIGFwcHJvcHJpYXRlIGhhbmRsZXJcbiAgICogaW4gdGhlIHByb3ZpZGVkIGV2ZW50IGNvbnRyYWN0LiBPbmNlIGFsbCB0aGUgZXZlbnRzIGFyZSByZXBsYXllZCwgaXQgY2xlYW5zXG4gICAqIHVwIHRoZSBlYXJseSBjb250cmFjdC5cbiAgICovXG4gIHJlcGxheUVhcmx5RXZlbnRzKGVhcmx5SnNhY3Rpb25EYXRhOiBFYXJseUpzYWN0aW9uRGF0YSB8IHVuZGVmaW5lZCA9IHdpbmRvdy5fZWpzYSkge1xuICAgIC8vIENoZWNrIGlmIHRoZSBlYXJseSBjb250cmFjdCBpcyBwcmVzZW50IGFuZCBwcmV2ZW50IGNhbGxpbmcgdGhpcyBmdW5jdGlvblxuICAgIC8vIG1vcmUgdGhhbiBvbmNlLlxuICAgIGlmICghZWFybHlKc2FjdGlvbkRhdGEpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBSZXBsYXkgdGhlIGVhcmx5IGNvbnRyYWN0IGV2ZW50cy5cbiAgICBjb25zdCBlYXJseUV2ZW50SW5mb3M6IGV2ZW50SW5mb0xpYi5FdmVudEluZm9bXSA9IGVhcmx5SnNhY3Rpb25EYXRhLnE7XG4gICAgZm9yIChsZXQgaWR4ID0gMDsgaWR4IDwgZWFybHlFdmVudEluZm9zLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgIGNvbnN0IGVhcmx5RXZlbnRJbmZvOiBldmVudEluZm9MaWIuRXZlbnRJbmZvID0gZWFybHlFdmVudEluZm9zW2lkeF07XG4gICAgICBjb25zdCBldmVudFR5cGVzID0gdGhpcy5nZXRFdmVudFR5cGVzRm9yQnJvd3NlckV2ZW50VHlwZShlYXJseUV2ZW50SW5mby5ldmVudFR5cGUpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBldmVudFR5cGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGV2ZW50SW5mbyA9IGV2ZW50SW5mb0xpYi5jbG9uZUV2ZW50SW5mbyhlYXJseUV2ZW50SW5mbyk7XG4gICAgICAgIC8vIEV2ZW50SW5mbyBldmVudFR5cGUgbWFwcyB0byBKU0FjdGlvbidzIGludGVybmFsIGV2ZW50IHR5cGUsXG4gICAgICAgIC8vIHJhdGhlciB0aGFuIHRoZSBicm93c2VyIGV2ZW50IHR5cGUuXG4gICAgICAgIGV2ZW50SW5mb0xpYi5zZXRFdmVudFR5cGUoZXZlbnRJbmZvLCBldmVudFR5cGVzW2ldKTtcbiAgICAgICAgdGhpcy5oYW5kbGVFdmVudEluZm8oZXZlbnRJbmZvKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDbGVhbiB1cCB0aGUgZWFybHkgY29udHJhY3QuXG4gICAgY29uc3QgZWFybHlFdmVudEhhbmRsZXI6IChldmVudDogRXZlbnQpID0+IHZvaWQgPSBlYXJseUpzYWN0aW9uRGF0YS5oO1xuICAgIHJlbW92ZUV2ZW50TGlzdGVuZXJzKGVhcmx5SnNhY3Rpb25EYXRhLmMsIGVhcmx5SnNhY3Rpb25EYXRhLmV0LCBlYXJseUV2ZW50SGFuZGxlcik7XG4gICAgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMoZWFybHlKc2FjdGlvbkRhdGEuYywgZWFybHlKc2FjdGlvbkRhdGEuZXRjLCBlYXJseUV2ZW50SGFuZGxlciwgdHJ1ZSk7XG4gICAgZGVsZXRlIHdpbmRvdy5fZWpzYTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFsbCBKU0FjdGlvbiBldmVudCB0eXBlcyB0aGF0IGhhdmUgYmVlbiByZWdpc3RlcmVkIGZvciBhIGdpdmVuXG4gICAqIGJyb3dzZXIgZXZlbnQgdHlwZS5cbiAgICovXG4gIHByaXZhdGUgZ2V0RXZlbnRUeXBlc0ZvckJyb3dzZXJFdmVudFR5cGUoYnJvd3NlckV2ZW50VHlwZTogc3RyaW5nKSB7XG4gICAgY29uc3QgZXZlbnRUeXBlcyA9IFtdO1xuICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbYnJvd3NlckV2ZW50VHlwZV0pIHtcbiAgICAgIGV2ZW50VHlwZXMucHVzaChicm93c2VyRXZlbnRUeXBlKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuYnJvd3NlckV2ZW50VHlwZVRvRXh0cmFFdmVudFR5cGVzW2Jyb3dzZXJFdmVudFR5cGVdKSB7XG4gICAgICBldmVudFR5cGVzLnB1c2goLi4udGhpcy5icm93c2VyRXZlbnRUeXBlVG9FeHRyYUV2ZW50VHlwZXNbYnJvd3NlckV2ZW50VHlwZV0pO1xuICAgIH1cbiAgICByZXR1cm4gZXZlbnRUeXBlcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBldmVudCBoYW5kbGVyIGZ1bmN0aW9uIGZvciBhIGdpdmVuIGV2ZW50IHR5cGUuXG4gICAqL1xuICBoYW5kbGVyKGV2ZW50VHlwZTogc3RyaW5nKTogRXZlbnRIYW5kbGVyIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50VHlwZV07XG4gIH1cblxuICAvKipcbiAgICogQ2xlYW5zIHVwIHRoZSBldmVudCBjb250cmFjdC4gVGhpcyByZXNldHMgYWxsIG9mIHRoZSBgRXZlbnRDb250cmFjdGAnc1xuICAgKiBpbnRlcm5hbCBzdGF0ZS4gVXNlcnMgYXJlIHJlc3BvbnNpYmxlIGZvciBub3QgdXNpbmcgdGhpcyBgRXZlbnRDb250cmFjdGBcbiAgICogYWZ0ZXIgaXQgaGFzIGJlZW4gY2xlYW5lZCB1cC5cbiAgICovXG4gIGNsZWFuVXAoKSB7XG4gICAgdGhpcy5jb250YWluZXJNYW5hZ2VyIS5jbGVhblVwKCk7XG4gICAgdGhpcy5jb250YWluZXJNYW5hZ2VyID0gbnVsbDtcbiAgICB0aGlzLmV2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICB0aGlzLmJyb3dzZXJFdmVudFR5cGVUb0V4dHJhRXZlbnRUeXBlcyA9IHt9O1xuICAgIHRoaXMuZGlzcGF0Y2hlciA9IG51bGw7XG4gICAgdGhpcy5xdWV1ZWRFdmVudEluZm9zID0gW107XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBkaXNwYXRjaGVyIGZ1bmN0aW9uLiBFdmVudCBpbmZvIG9mIGVhY2ggZXZlbnQgbWFwcGVkIHRvXG4gICAqIGEganNhY3Rpb24gaXMgcGFzc2VkIGZvciBoYW5kbGluZyB0byB0aGlzIGNhbGxiYWNrLiBUaGUgcXVldWVkXG4gICAqIGV2ZW50cyBhcmUgcGFzc2VkIGFzIHdlbGwgdG8gdGhlIGRpc3BhdGNoZXIgZm9yIGxhdGVyIHJlcGxheWluZ1xuICAgKiBvbmNlIHRoZSBkaXNwYXRjaGVyIGlzIHJlZ2lzdGVyZWQuIENsZWFycyB0aGUgZXZlbnQgcXVldWUgdG8gbnVsbC5cbiAgICpcbiAgICogQHBhcmFtIGRpc3BhdGNoZXIgVGhlIGRpc3BhdGNoZXIgZnVuY3Rpb24uXG4gICAqIEBwYXJhbSByZXN0cmljdGlvblxuICAgKi9cbiAgcmVnaXN0ZXJEaXNwYXRjaGVyKGRpc3BhdGNoZXI6IERpc3BhdGNoZXIsIHJlc3RyaWN0aW9uOiBSZXN0cmljdGlvbikge1xuICAgIHRoaXMuZWNyZChkaXNwYXRjaGVyLCByZXN0cmljdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogVW5yZW5hbWVkIGFsaWFzIGZvciByZWdpc3RlckRpc3BhdGNoZXIuIE5lY2Vzc2FyeSBmb3IgYW55IGNvZGViYXNlcyB0aGF0XG4gICAqIHNwbGl0IHRoZSBgRXZlbnRDb250cmFjdGAgYW5kIGBEaXNwYXRjaGVyYCBjb2RlIGludG8gZGlmZmVyZW50IGNvbXBpbGF0aW9uXG4gICAqIHVuaXRzLlxuICAgKi9cbiAgZWNyZChkaXNwYXRjaGVyOiBEaXNwYXRjaGVyLCByZXN0cmljdGlvbjogUmVzdHJpY3Rpb24pIHtcbiAgICB0aGlzLmRpc3BhdGNoZXIgPSBkaXNwYXRjaGVyO1xuXG4gICAgaWYgKHRoaXMucXVldWVkRXZlbnRJbmZvcz8ubGVuZ3RoKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucXVldWVkRXZlbnRJbmZvcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB0aGlzLmhhbmRsZUV2ZW50SW5mbyh0aGlzLnF1ZXVlZEV2ZW50SW5mb3NbaV0pO1xuICAgICAgfVxuICAgICAgdGhpcy5xdWV1ZWRFdmVudEluZm9zID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhMTF5IGNsaWNrIHN1cHBvcnQgdG8gdGhlIGdpdmVuIGBFdmVudENvbnRyYWN0YC4gTWVhbnQgdG8gYmUgY2FsbGVkIGluXG4gICAqIHRoZSBzYW1lIGNvbXBpbGF0aW9uIHVuaXQgYXMgdGhlIGBFdmVudENvbnRyYWN0YC5cbiAgICovXG4gIGFkZEExMXlDbGlja1N1cHBvcnQoKSB7fVxuXG4gIC8qKlxuICAgKiBFbmFibGVzIGExMXkgY2xpY2sgc3VwcG9ydCB0byBiZSBkZWZlcnJlZC4gTWVhbnQgdG8gYmUgY2FsbGVkIGluIHRoZSBzYW1lXG4gICAqIGNvbXBpbGF0aW9uIHVuaXQgYXMgdGhlIGBFdmVudENvbnRyYWN0YC5cbiAgICovXG4gIGV4cG9ydEFkZEExMXlDbGlja1N1cHBvcnQoKSB7fVxufVxuXG5mdW5jdGlvbiByZW1vdmVFdmVudExpc3RlbmVycyhcbiAgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcbiAgZXZlbnRUeXBlczogc3RyaW5nW10sXG4gIGVhcmx5RXZlbnRIYW5kbGVyOiAoZTogRXZlbnQpID0+IHZvaWQsXG4gIGNhcHR1cmU/OiBib29sZWFuLFxuKSB7XG4gIGZvciAobGV0IGlkeCA9IDA7IGlkeCA8IGV2ZW50VHlwZXMubGVuZ3RoOyBpZHgrKykge1xuICAgIGNvbnRhaW5lci5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50VHlwZXNbaWR4XSwgZWFybHlFdmVudEhhbmRsZXIsIC8qIHVzZUNhcHR1cmUgKi8gY2FwdHVyZSk7XG4gIH1cbn1cblxuLyoqXG4gKiBBZGRzIGExMXkgY2xpY2sgc3VwcG9ydCB0byB0aGUgZ2l2ZW4gYEV2ZW50Q29udHJhY3RgLiBNZWFudCB0byBiZSBjYWxsZWRcbiAqIGluIGEgZGlmZmVyZW50IGNvbXBpbGF0aW9uIHVuaXQgZnJvbSB0aGUgYEV2ZW50Q29udHJhY3RgLiBUaGUgYEV2ZW50Q29udHJhY3RgXG4gKiBtdXN0IGhhdmUgY2FsbGVkIGBleHBvcnRBZGRBMTF5Q2xpY2tTdXBwb3J0YCBpbiBpdHMgY29tcGlsYXRpb24gdW5pdCBmb3IgdGhpc1xuICogdG8gaGF2ZSBhbnkgZWZmZWN0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYWRkRGVmZXJyZWRBMTF5Q2xpY2tTdXBwb3J0KGV2ZW50Q29udHJhY3Q6IEV2ZW50Q29udHJhY3QpIHt9XG4iXX0=