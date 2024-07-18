/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { isEarlyEventType, isCaptureEventType, EventContractContainer, EventContract, EventDispatcher, registerDispatcher, } from '@angular/core/primitives/event-dispatch';
import { APP_BOOTSTRAP_LISTENER, ApplicationRef, whenStable } from '../application/application_ref';
import { ENVIRONMENT_INITIALIZER, Injector } from '../di';
import { inject } from '../di/injector_compatibility';
import { setStashFn } from '../render3/instructions/listener';
import { CLEANUP } from '../render3/interfaces/view';
import { isPlatformBrowser } from '../render3/util/misc_utils';
import { unwrapRNode } from '../render3/util/view_utils';
import { EVENT_REPLAY_ENABLED_DEFAULT, IS_EVENT_REPLAY_ENABLED, IS_GLOBAL_EVENT_DELEGATION_ENABLED, } from './tokens';
import { sharedStashFunction, removeListeners, invokeRegisteredListeners, JSACTION_EVENT_CONTRACT, } from '../event_delegation_utils';
import { APP_ID } from '../application/application_tokens';
import { performanceMarkFeature } from '../util/performance';
/**
 * A set of DOM elements with `jsaction` attributes.
 */
const jsactionSet = new Set();
function isGlobalEventDelegationEnabled(injector) {
    return injector.get(IS_GLOBAL_EVENT_DELEGATION_ENABLED, false);
}
/**
 * Determines whether Event Replay feature should be activated on the client.
 */
function shouldEnableEventReplay(injector) {
    return (injector.get(IS_EVENT_REPLAY_ENABLED, EVENT_REPLAY_ENABLED_DEFAULT) &&
        !isGlobalEventDelegationEnabled(injector));
}
/**
 * Returns a set of providers required to setup support for event replay.
 * Requires hydration to be enabled separately.
 */
export function withEventReplay() {
    return [
        {
            provide: IS_EVENT_REPLAY_ENABLED,
            useFactory: () => {
                let isEnabled = true;
                if (isPlatformBrowser()) {
                    // Note: globalThis[CONTRACT_PROPERTY] may be undefined in case Event Replay feature
                    // is enabled, but there are no events configured in this application, in which case
                    // we don't activate this feature, since there are no events to replay.
                    const appId = inject(APP_ID);
                    isEnabled = !!window._ejsas?.[appId];
                }
                if (isEnabled) {
                    performanceMarkFeature('NgEventReplay');
                }
                return isEnabled;
            },
        },
        {
            provide: ENVIRONMENT_INITIALIZER,
            useValue: () => {
                const injector = inject(Injector);
                if (isPlatformBrowser(injector) && shouldEnableEventReplay(injector)) {
                    setStashFn((rEl, eventName, listenerFn) => {
                        sharedStashFunction(rEl, eventName, listenerFn);
                        jsactionSet.add(rEl);
                    });
                }
            },
            multi: true,
        },
        {
            provide: APP_BOOTSTRAP_LISTENER,
            useFactory: () => {
                if (isPlatformBrowser()) {
                    const injector = inject(Injector);
                    const appRef = inject(ApplicationRef);
                    return () => {
                        if (!shouldEnableEventReplay(injector)) {
                            return;
                        }
                        // Kick off event replay logic once hydration for the initial part
                        // of the application is completed. This timing is similar to the unclaimed
                        // dehydrated views cleanup timing.
                        whenStable(appRef).then(() => {
                            const eventContractDetails = injector.get(JSACTION_EVENT_CONTRACT);
                            initEventReplay(eventContractDetails, injector);
                            jsactionSet.forEach(removeListeners);
                            // After hydration, we shouldn't need to do anymore work related to
                            // event replay anymore.
                            setStashFn(() => { });
                        });
                    };
                }
                return () => { }; // noop for the server code
            },
            multi: true,
        },
    ];
}
const initEventReplay = (eventDelegation, injector) => {
    const appId = injector.get(APP_ID);
    // This is set in packages/platform-server/src/utils.ts
    const earlyJsactionData = window._ejsas[appId];
    const eventContract = (eventDelegation.instance = new EventContract(new EventContractContainer(earlyJsactionData.c), 
    /* useActionResolver= */ false));
    for (const et of earlyJsactionData.et) {
        eventContract.addEvent(et);
    }
    for (const et of earlyJsactionData.etc) {
        eventContract.addEvent(et);
    }
    eventContract.replayEarlyEvents(earlyJsactionData);
    window._ejsas[appId] = undefined;
    const dispatcher = new EventDispatcher(invokeRegisteredListeners);
    registerDispatcher(eventContract, dispatcher);
};
/**
 * Extracts information about all DOM events (added in a template) registered on elements in a give
 * LView. Maps collected events to a corresponding DOM element (an element is used as a key).
 */
export function collectDomEventsInfo(tView, lView, eventTypesToReplay) {
    const domEventsInfo = new Map();
    const lCleanup = lView[CLEANUP];
    const tCleanup = tView.cleanup;
    if (!tCleanup || !lCleanup) {
        return domEventsInfo;
    }
    for (let i = 0; i < tCleanup.length;) {
        const firstParam = tCleanup[i++];
        const secondParam = tCleanup[i++];
        if (typeof firstParam !== 'string') {
            continue;
        }
        const eventType = firstParam;
        if (!isEarlyEventType(eventType)) {
            continue;
        }
        if (isCaptureEventType(eventType)) {
            eventTypesToReplay.capture.add(eventType);
        }
        else {
            eventTypesToReplay.regular.add(eventType);
        }
        const listenerElement = unwrapRNode(lView[secondParam]);
        i++; // move the cursor to the next position (location of the listener idx)
        const useCaptureOrIndx = tCleanup[i++];
        // if useCaptureOrIndx is boolean then report it as is.
        // if useCaptureOrIndx is positive number then it in unsubscribe method
        // if useCaptureOrIndx is negative number then it is a Subscription
        const isDomEvent = typeof useCaptureOrIndx === 'boolean' || useCaptureOrIndx >= 0;
        if (!isDomEvent) {
            continue;
        }
        if (!domEventsInfo.has(listenerElement)) {
            domEventsInfo.set(listenerElement, [eventType]);
        }
        else {
            domEventsInfo.get(listenerElement).push(eventType);
        }
    }
    return domEventsInfo;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRfcmVwbGF5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvaHlkcmF0aW9uL2V2ZW50X3JlcGxheS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQ0wsZ0JBQWdCLEVBQ2hCLGtCQUFrQixFQUNsQixzQkFBc0IsRUFDdEIsYUFBYSxFQUNiLGVBQWUsRUFDZixrQkFBa0IsR0FDbkIsTUFBTSx5Q0FBeUMsQ0FBQztBQUVqRCxPQUFPLEVBQUMsc0JBQXNCLEVBQUUsY0FBYyxFQUFFLFVBQVUsRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ2xHLE9BQU8sRUFBQyx1QkFBdUIsRUFBRSxRQUFRLEVBQUMsTUFBTSxPQUFPLENBQUM7QUFDeEQsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBRXBELE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUU1RCxPQUFPLEVBQUMsT0FBTyxFQUFlLE1BQU0sNEJBQTRCLENBQUM7QUFDakUsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDN0QsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBRXZELE9BQU8sRUFDTCw0QkFBNEIsRUFDNUIsdUJBQXVCLEVBQ3ZCLGtDQUFrQyxHQUNuQyxNQUFNLFVBQVUsQ0FBQztBQUNsQixPQUFPLEVBQ0wsbUJBQW1CLEVBQ25CLGVBQWUsRUFDZix5QkFBeUIsRUFFekIsdUJBQXVCLEdBQ3hCLE1BQU0sMkJBQTJCLENBQUM7QUFDbkMsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLG1DQUFtQyxDQUFDO0FBQ3pELE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBRTNEOztHQUVHO0FBQ0gsTUFBTSxXQUFXLEdBQUcsSUFBSSxHQUFHLEVBQVcsQ0FB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O1FBQ2xGLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNoQixTQUFTO1FBQ1gsQ0FBQztRQUNELElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUM7WUFDeEMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ2xELENBQUM7YUFBTSxDQUFDO1lBQ04sYUFBYSxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDdEQsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLGFBQWEsQ0FBQztBQUN2QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIGlzRWFybHlFdmVudFR5cGUsXG4gIGlzQ2FwdHVyZUV2ZW50VHlwZSxcbiAgRXZlbnRDb250cmFjdENvbnRhaW5lcixcbiAgRXZlbnRDb250cmFjdCxcbiAgRXZlbnREaXNwYXRjaGVyLFxuICByZWdpc3RlckRpc3BhdGNoZXIsXG59IGZyb20gJ0Bhbmd1bGFyL2NvcmUvcHJpbWl0aXZlcy9ldmVudC1kaXNwYXRjaCc7XG5cbmltcG9ydCB7QVBQX0JPT1RTVFJBUF9MSVNURU5FUiwgQXBwbGljYXRpb25SZWYsIHdoZW5TdGFibGV9IGZyb20gJy4uL2FwcGxpY2F0aW9uL2FwcGxpY2F0aW9uX3JlZic7XG5pbXBvcnQge0VOVklST05NRU5UX0lOSVRJQUxJWkVSLCBJbmplY3Rvcn0gZnJvbSAnLi4vZGknO1xuaW1wb3J0IHtpbmplY3R9IGZyb20gJy4uL2RpL2luamVjdG9yX2NvbXBhdGliaWxpdHknO1xuaW1wb3J0IHtQcm92aWRlcn0gZnJvbSAnLi4vZGkvaW50ZXJmYWNlL3Byb3ZpZGVyJztcbmltcG9ydCB7c2V0U3Rhc2hGbn0gZnJvbSAnLi4vcmVuZGVyMy9pbnN0cnVjdGlvbnMvbGlzdGVuZXInO1xuaW1wb3J0IHtSRWxlbWVudH0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL3JlbmRlcmVyX2RvbSc7XG5pbXBvcnQge0NMRUFOVVAsIExWaWV3LCBUVmlld30gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL3ZpZXcnO1xuaW1wb3J0IHtpc1BsYXRmb3JtQnJvd3Nlcn0gZnJvbSAnLi4vcmVuZGVyMy91dGlsL21pc2NfdXRpbHMnO1xuaW1wb3J0IHt1bndyYXBSTm9kZX0gZnJvbSAnLi4vcmVuZGVyMy91dGlsL3ZpZXdfdXRpbHMnO1xuXG5pbXBvcnQge1xuICBFVkVOVF9SRVBMQVlfRU5BQkxFRF9ERUZBVUxULFxuICBJU19FVkVOVF9SRVBMQVlfRU5BQkxFRCxcbiAgSVNfR0xPQkFMX0VWRU5UX0RFTEVHQVRJT05fRU5BQkxFRCxcbn0gZnJvbSAnLi90b2tlbnMnO1xuaW1wb3J0IHtcbiAgc2hhcmVkU3Rhc2hGdW5jdGlvbixcbiAgcmVtb3ZlTGlzdGVuZXJzLFxuICBpbnZva2VSZWdpc3RlcmVkTGlzdGVuZXJzLFxuICBFdmVudENvbnRyYWN0RGV0YWlscyxcbiAgSlNBQ1RJT05fRVZFTlRfQ09OVFJBQ1QsXG59IGZyb20gJy4uL2V2ZW50X2RlbGVnYXRpb25fdXRpbHMnO1xuaW1wb3J0IHtBUFBfSUR9IGZyb20gJy4uL2FwcGxpY2F0aW9uL2FwcGxpY2F0aW9uX3Rva2Vucyc7XG5pbXBvcnQge3BlcmZvcm1hbmNlTWFya0ZlYXR1cmV9IGZyb20gJy4uL3V0aWwvcGVyZm9ybWFuY2UnO1xuXG4vKipcbiAqIEEgc2V0IG9mIERPTSBlbGVtZW50cyB3aXRoIGBqc2FjdGlvbmAgYXR0cmlidXRlcy5cbiAqL1xuY29uc3QganNhY3Rpb25TZXQgPSBuZXcgU2V0PEVsZW1lbnQ+KCk7XG5cbmZ1bmN0aW9uIGlzR2xvYmFsRXZlbnREZWxlZ2F0aW9uRW5hYmxlZChpbmplY3RvcjogSW5qZWN0b3IpIHtcbiAgcmV0dXJuIGluamVjdG9yLmdldChJU19HTE9CQUxfRVZFTlRfREVMRUdBVElPTl9FTkFCTEVELCBmYWxzZSk7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lcyB3aGV0aGVyIEV2ZW50IFJlcGxheSBmZWF0dXJlIHNob3VsZCBiZSBhY3RpdmF0ZWQgb24gdGhlIGNsaWVudC5cbiAqL1xuZnVuY3Rpb24gc2hvdWxkRW5hYmxlRXZlbnRSZXBsYXkoaW5qZWN0b3I6IEluamVjdG9yKSB7XG4gIHJldHVybiAoXG4gICAgaW5qZWN0b3IuZ2V0KElTX0VWRU5UX1JFUExBWV9FTkFCTEVELCBFVkVOVF9SRVBMQVlfRU5BQkxFRF9ERUZBVUxUKSAmJlxuICAgICFpc0dsb2JhbEV2ZW50RGVsZWdhdGlvbkVuYWJsZWQoaW5qZWN0b3IpXG4gICk7XG59XG5cbi8qKlxuICogUmV0dXJucyBhIHNldCBvZiBwcm92aWRlcnMgcmVxdWlyZWQgdG8gc2V0dXAgc3VwcG9ydCBmb3IgZXZlbnQgcmVwbGF5LlxuICogUmVxdWlyZXMgaHlkcmF0aW9uIHRvIGJlIGVuYWJsZWQgc2VwYXJhdGVseS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdpdGhFdmVudFJlcGxheSgpOiBQcm92aWRlcltdIHtcbiAgcmV0dXJuIFtcbiAgICB7XG4gICAgICBwcm92aWRlOiBJU19FVkVOVF9SRVBMQVlfRU5BQkxFRCxcbiAgICAgIHVzZUZhY3Rvcnk6ICgpID0+IHtcbiAgICAgICAgbGV0IGlzRW5hYmxlZCA9IHRydWU7XG4gICAgICAgIGlmIChpc1BsYXRmb3JtQnJvd3NlcigpKSB7XG4gICAgICAgICAgLy8gTm90ZTogZ2xvYmFsVGhpc1tDT05UUkFDVF9QUk9QRVJUWV0gbWF5IGJlIHVuZGVmaW5lZCBpbiBjYXNlIEV2ZW50IFJlcGxheSBmZWF0dXJlXG4gICAgICAgICAgLy8gaXMgZW5hYmxlZCwgYnV0IHRoZXJlIGFyZSBubyBldmVudHMgY29uZmlndXJlZCBpbiB0aGlzIGFwcGxpY2F0aW9uLCBpbiB3aGljaCBjYXNlXG4gICAgICAgICAgLy8gd2UgZG9uJ3QgYWN0aXZhdGUgdGhpcyBmZWF0dXJlLCBzaW5jZSB0aGVyZSBhcmUgbm8gZXZlbnRzIHRvIHJlcGxheS5cbiAgICAgICAgICBjb25zdCBhcHBJZCA9IGluamVjdChBUFBfSUQpO1xuICAgICAgICAgIGlzRW5hYmxlZCA9ICEhd2luZG93Ll9lanNhcz8uW2FwcElkXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNFbmFibGVkKSB7XG4gICAgICAgICAgcGVyZm9ybWFuY2VNYXJrRmVhdHVyZSgnTmdFdmVudFJlcGxheScpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpc0VuYWJsZWQ7XG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgcHJvdmlkZTogRU5WSVJPTk1FTlRfSU5JVElBTElaRVIsXG4gICAgICB1c2VWYWx1ZTogKCkgPT4ge1xuICAgICAgICBjb25zdCBpbmplY3RvciA9IGluamVjdChJbmplY3Rvcik7XG4gICAgICAgIGlmIChpc1BsYXRmb3JtQnJvd3NlcihpbmplY3RvcikgJiYgc2hvdWxkRW5hYmxlRXZlbnRSZXBsYXkoaW5qZWN0b3IpKSB7XG4gICAgICAgICAgc2V0U3Rhc2hGbigockVsOiBSRWxlbWVudCwgZXZlbnROYW1lOiBzdHJpbmcsIGxpc3RlbmVyRm46IFZvaWRGdW5jdGlvbikgPT4ge1xuICAgICAgICAgICAgc2hhcmVkU3Rhc2hGdW5jdGlvbihyRWwsIGV2ZW50TmFtZSwgbGlzdGVuZXJGbik7XG4gICAgICAgICAgICBqc2FjdGlvblNldC5hZGQockVsIGFzIHVua25vd24gYXMgRWxlbWVudCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBtdWx0aTogdHJ1ZSxcbiAgICB9LFxuICAgIHtcbiAgICAgIHByb3ZpZGU6IEFQUF9CT09UU1RSQVBfTElTVEVORVIsXG4gICAgICB1c2VGYWN0b3J5OiAoKSA9PiB7XG4gICAgICAgIGlmIChpc1BsYXRmb3JtQnJvd3NlcigpKSB7XG4gICAgICAgICAgY29uc3QgaW5qZWN0b3IgPSBpbmplY3QoSW5qZWN0b3IpO1xuICAgICAgICAgIGNvbnN0IGFwcFJlZiA9IGluamVjdChBcHBsaWNhdGlvblJlZik7XG4gICAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICAgIGlmICghc2hvdWxkRW5hYmxlRXZlbnRSZXBsYXkoaW5qZWN0b3IpKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gS2ljayBvZmYgZXZlbnQgcmVwbGF5IGxvZ2ljIG9uY2UgaHlkcmF0aW9uIGZvciB0aGUgaW5pdGlhbCBwYXJ0XG4gICAgICAgICAgICAvLyBvZiB0aGUgYXBwbGljYXRpb24gaXMgY29tcGxldGVkLiBUaGlzIHRpbWluZyBpcyBzaW1pbGFyIHRvIHRoZSB1bmNsYWltZWRcbiAgICAgICAgICAgIC8vIGRlaHlkcmF0ZWQgdmlld3MgY2xlYW51cCB0aW1pbmcuXG4gICAgICAgICAgICB3aGVuU3RhYmxlKGFwcFJlZikudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IGV2ZW50Q29udHJhY3REZXRhaWxzID0gaW5qZWN0b3IuZ2V0KEpTQUNUSU9OX0VWRU5UX0NPTlRSQUNUKTtcbiAgICAgICAgICAgICAgaW5pdEV2ZW50UmVwbGF5KGV2ZW50Q29udHJhY3REZXRhaWxzLCBpbmplY3Rvcik7XG4gICAgICAgICAgICAgIGpzYWN0aW9uU2V0LmZvckVhY2gocmVtb3ZlTGlzdGVuZXJzKTtcbiAgICAgICAgICAgICAgLy8gQWZ0ZXIgaHlkcmF0aW9uLCB3ZSBzaG91bGRuJ3QgbmVlZCB0byBkbyBhbnltb3JlIHdvcmsgcmVsYXRlZCB0b1xuICAgICAgICAgICAgICAvLyBldmVudCByZXBsYXkgYW55bW9yZS5cbiAgICAgICAgICAgICAgc2V0U3Rhc2hGbigoKSA9PiB7fSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAoKSA9PiB7fTsgLy8gbm9vcCBmb3IgdGhlIHNlcnZlciBjb2RlXG4gICAgICB9LFxuICAgICAgbXVsdGk6IHRydWUsXG4gICAgfSxcbiAgXTtcbn1cblxuY29uc3QgaW5pdEV2ZW50UmVwbGF5ID0gKGV2ZW50RGVsZWdhdGlvbjogRXZlbnRDb250cmFjdERldGFpbHMsIGluamVjdG9yOiBJbmplY3RvcikgPT4ge1xuICBjb25zdCBhcHBJZCA9IGluamVjdG9yLmdldChBUFBfSUQpO1xuICAvLyBUaGlzIGlzIHNldCBpbiBwYWNrYWdlcy9wbGF0Zm9ybS1zZXJ2ZXIvc3JjL3V0aWxzLnRzXG4gIGNvbnN0IGVhcmx5SnNhY3Rpb25EYXRhID0gd2luZG93Ll9lanNhcyFbYXBwSWRdITtcbiAgY29uc3QgZXZlbnRDb250cmFjdCA9IChldmVudERlbGVnYXRpb24uaW5zdGFuY2UgPSBuZXcgRXZlbnRDb250cmFjdChcbiAgICBuZXcgRXZlbnRDb250cmFjdENvbnRhaW5lcihlYXJseUpzYWN0aW9uRGF0YS5jKSxcbiAgICAvKiB1c2VBY3Rpb25SZXNvbHZlcj0gKi8gZmFsc2UsXG4gICkpO1xuICBmb3IgKGNvbnN0IGV0IG9mIGVhcmx5SnNhY3Rpb25EYXRhLmV0KSB7XG4gICAgZXZlbnRDb250cmFjdC5hZGRFdmVudChldCk7XG4gIH1cbiAgZm9yIChjb25zdCBldCBvZiBlYXJseUpzYWN0aW9uRGF0YS5ldGMpIHtcbiAgICBldmVudENvbnRyYWN0LmFkZEV2ZW50KGV0KTtcbiAgfVxuICBldmVudENvbnRyYWN0LnJlcGxheUVhcmx5RXZlbnRzKGVhcmx5SnNhY3Rpb25EYXRhKTtcbiAgd2luZG93Ll9lanNhcyFbYXBwSWRdID0gdW5kZWZpbmVkO1xuICBjb25zdCBkaXNwYXRjaGVyID0gbmV3IEV2ZW50RGlzcGF0Y2hlcihpbnZva2VSZWdpc3RlcmVkTGlzdGVuZXJzKTtcbiAgcmVnaXN0ZXJEaXNwYXRjaGVyKGV2ZW50Q29udHJhY3QsIGRpc3BhdGNoZXIpO1xufTtcblxuLyoqXG4gKiBFeHRyYWN0cyBpbmZvcm1hdGlvbiBhYm91dCBhbGwgRE9NIGV2ZW50cyAoYWRkZWQgaW4gYSB0ZW1wbGF0ZSkgcmVnaXN0ZXJlZCBvbiBlbGVtZW50cyBpbiBhIGdpdmVcbiAqIExWaWV3LiBNYXBzIGNvbGxlY3RlZCBldmVudHMgdG8gYSBjb3JyZXNwb25kaW5nIERPTSBlbGVtZW50IChhbiBlbGVtZW50IGlzIHVzZWQgYXMgYSBrZXkpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29sbGVjdERvbUV2ZW50c0luZm8oXG4gIHRWaWV3OiBUVmlldyxcbiAgbFZpZXc6IExWaWV3LFxuICBldmVudFR5cGVzVG9SZXBsYXk6IHtyZWd1bGFyOiBTZXQ8c3RyaW5nPjsgY2FwdHVyZTogU2V0PHN0cmluZz59LFxuKTogTWFwPEVsZW1lbnQsIHN0cmluZ1tdPiB7XG4gIGNvbnN0IGRvbUV2ZW50c0luZm8gPSBuZXcgTWFwPEVsZW1lbnQsIHN0cmluZ1tdPigpO1xuICBjb25zdCBsQ2xlYW51cCA9IGxWaWV3W0NMRUFOVVBdO1xuICBjb25zdCB0Q2xlYW51cCA9IHRWaWV3LmNsZWFudXA7XG4gIGlmICghdENsZWFudXAgfHwgIWxDbGVhbnVwKSB7XG4gICAgcmV0dXJuIGRvbUV2ZW50c0luZm87XG4gIH1cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0Q2xlYW51cC5sZW5ndGg7ICkge1xuICAgIGNvbnN0IGZpcnN0UGFyYW0gPSB0Q2xlYW51cFtpKytdO1xuICAgIGNvbnN0IHNlY29uZFBhcmFtID0gdENsZWFudXBbaSsrXTtcbiAgICBpZiAodHlwZW9mIGZpcnN0UGFyYW0gIT09ICdzdHJpbmcnKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgZXZlbnRUeXBlID0gZmlyc3RQYXJhbTtcbiAgICBpZiAoIWlzRWFybHlFdmVudFR5cGUoZXZlbnRUeXBlKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChpc0NhcHR1cmVFdmVudFR5cGUoZXZlbnRUeXBlKSkge1xuICAgICAgZXZlbnRUeXBlc1RvUmVwbGF5LmNhcHR1cmUuYWRkKGV2ZW50VHlwZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGV2ZW50VHlwZXNUb1JlcGxheS5yZWd1bGFyLmFkZChldmVudFR5cGUpO1xuICAgIH1cbiAgICBjb25zdCBsaXN0ZW5lckVsZW1lbnQgPSB1bndyYXBSTm9kZShsVmlld1tzZWNvbmRQYXJhbV0pIGFzIGFueSBhcyBFbGVtZW50O1xuICAgIGkrKzsgLy8gbW92ZSB0aGUgY3Vyc29yIHRvIHRoZSBuZXh0IHBvc2l0aW9uIChsb2NhdGlvbiBvZiB0aGUgbGlzdGVuZXIgaWR4KVxuICAgIGNvbnN0IHVzZUNhcHR1cmVPckluZHggPSB0Q2xlYW51cFtpKytdO1xuICAgIC8vIGlmIHVzZUNhcHR1cmVPckluZHggaXMgYm9vbGVhbiB0aGVuIHJlcG9ydCBpdCBhcyBpcy5cbiAgICAvLyBpZiB1c2VDYXB0dXJlT3JJbmR4IGlzIHBvc2l0aXZlIG51bWJlciB0aGVuIGl0IGluIHVuc3Vic2NyaWJlIG1ldGhvZFxuICAgIC8vIGlmIHVzZUNhcHR1cmVPckluZHggaXMgbmVnYXRpdmUgbnVtYmVyIHRoZW4gaXQgaXMgYSBTdWJzY3JpcHRpb25cbiAgICBjb25zdCBpc0RvbUV2ZW50ID0gdHlwZW9mIHVzZUNhcHR1cmVPckluZHggPT09ICdib29sZWFuJyB8fCB1c2VDYXB0dXJlT3JJbmR4ID49IDA7XG4gICAgaWYgKCFpc0RvbUV2ZW50KSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKCFkb21FdmVudHNJbmZvLmhhcyhsaXN0ZW5lckVsZW1lbnQpKSB7XG4gICAgICBkb21FdmVudHNJbmZvLnNldChsaXN0ZW5lckVsZW1lbnQsIFtldmVudFR5cGVdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZG9tRXZlbnRzSW5mby5nZXQobGlzdGVuZXJFbGVtZW50KSEucHVzaChldmVudFR5cGUpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZG9tRXZlbnRzSW5mbztcbn1cbiJdfQ==