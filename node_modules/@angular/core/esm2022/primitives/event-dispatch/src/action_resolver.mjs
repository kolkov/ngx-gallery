/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Attribute } from './attribute';
import { Char } from './char';
import { EventType } from './event_type';
import { Property } from './property';
import * as cache from './cache';
import * as eventInfoLib from './event_info';
import * as eventLib from './event';
/**
 * Since maps from event to action are immutable we can use a single map
 * to represent the empty map.
 */
const EMPTY_ACTION_MAP = {};
/**
 * This regular expression matches a semicolon.
 */
const REGEXP_SEMICOLON = /\s*;\s*/;
/** If no event type is defined, defaults to `click`. */
const DEFAULT_EVENT_TYPE = EventType.CLICK;
/** Resolves actions for Events. */
export class ActionResolver {
    constructor({ syntheticMouseEventSupport = false, } = {}) {
        this.a11yClickSupport = false;
        this.updateEventInfoForA11yClick = undefined;
        this.preventDefaultForA11yClick = undefined;
        this.populateClickOnlyAction = undefined;
        this.syntheticMouseEventSupport = syntheticMouseEventSupport;
    }
    resolveEventType(eventInfo) {
        // We distinguish modified and plain clicks in order to support the
        // default browser behavior of modified clicks on links; usually to
        // open the URL of the link in new tab or new window on ctrl/cmd
        // click. A DOM 'click' event is mapped to the jsaction 'click'
        // event iff there is no modifier present on the event. If there is
        // a modifier, it's mapped to 'clickmod' instead.
        //
        // It's allowed to omit the event in the jsaction attribute. In that
        // case, 'click' is assumed. Thus the following two are equivalent:
        //
        //   <a href="someurl" jsaction="gna.fu">
        //   <a href="someurl" jsaction="click:gna.fu">
        //
        // For unmodified clicks, EventContract invokes the jsaction
        // 'gna.fu'. For modified clicks, EventContract won't find a
        // suitable action and leave the event to be handled by the
        // browser.
        //
        // In order to also invoke a jsaction handler for a modifier click,
        // 'clickmod' needs to be used:
        //
        //   <a href="someurl" jsaction="clickmod:gna.fu">
        //
        // EventContract invokes the jsaction 'gna.fu' for modified
        // clicks. Unmodified clicks are left to the browser.
        //
        // In order to set up the event contract to handle both clickonly and
        // clickmod, only addEvent(EventType.CLICK) is necessary.
        //
        // In order to set up the event contract to handle click,
        // addEvent() is necessary for CLICK, KEYDOWN, and KEYPRESS event types.  If
        // a11y click support is enabled, addEvent() will set up the appropriate key
        // event handler automatically.
        if (eventInfoLib.getEventType(eventInfo) === EventType.CLICK &&
            eventLib.isModifiedClickEvent(eventInfoLib.getEvent(eventInfo))) {
            eventInfoLib.setEventType(eventInfo, EventType.CLICKMOD);
        }
        else if (this.a11yClickSupport) {
            this.updateEventInfoForA11yClick(eventInfo);
        }
    }
    resolveAction(eventInfo) {
        if (eventInfoLib.getResolved(eventInfo)) {
            return;
        }
        this.populateAction(eventInfo, eventInfoLib.getTargetElement(eventInfo));
        eventInfoLib.setResolved(eventInfo, true);
    }
    resolveParentAction(eventInfo) {
        const action = eventInfoLib.getAction(eventInfo);
        const actionElement = action && eventInfoLib.getActionElement(action);
        eventInfoLib.unsetAction(eventInfo);
        const parentNode = actionElement && this.getParentNode(actionElement);
        if (!parentNode) {
            return;
        }
        this.populateAction(eventInfo, parentNode);
    }
    /**
     * Searches for a jsaction that the DOM event maps to and creates an
     * object containing event information used for dispatching by
     * jsaction.Dispatcher. This method populates the `action` and `actionElement`
     * fields of the EventInfo object passed in by finding the first
     * jsaction attribute above the target Node of the event, and below
     * the container Node, that specifies a jsaction for the event
     * type. If no such jsaction is found, then action is undefined.
     *
     * @param eventInfo `EventInfo` to set `action` and `actionElement` if an
     *    action is found on any `Element` in the path of the `Event`.
     */
    populateAction(eventInfo, currentTarget) {
        let actionElement = currentTarget;
        while (actionElement && actionElement !== eventInfoLib.getContainer(eventInfo)) {
            if (actionElement.nodeType === Node.ELEMENT_NODE) {
                this.populateActionOnElement(actionElement, eventInfo);
            }
            if (eventInfoLib.getAction(eventInfo)) {
                // An event is handled by at most one jsaction. Thus we stop at the
                // first matching jsaction specified in a jsaction attribute up the
                // ancestor chain of the event target node.
                break;
            }
            actionElement = this.getParentNode(actionElement);
        }
        const action = eventInfoLib.getAction(eventInfo);
        if (!action) {
            // No action found.
            return;
        }
        if (this.a11yClickSupport) {
            this.preventDefaultForA11yClick(eventInfo);
        }
        // We attempt to handle the mouseenter/mouseleave events here by
        // detecting whether the mouseover/mouseout events correspond to
        // entering/leaving an element.
        if (this.syntheticMouseEventSupport) {
            if (eventInfoLib.getEventType(eventInfo) === EventType.MOUSEENTER ||
                eventInfoLib.getEventType(eventInfo) === EventType.MOUSELEAVE ||
                eventInfoLib.getEventType(eventInfo) === EventType.POINTERENTER ||
                eventInfoLib.getEventType(eventInfo) === EventType.POINTERLEAVE) {
                // We attempt to handle the mouseenter/mouseleave events here by
                // detecting whether the mouseover/mouseout events correspond to
                // entering/leaving an element.
                if (eventLib.isMouseSpecialEvent(eventInfoLib.getEvent(eventInfo), eventInfoLib.getEventType(eventInfo), eventInfoLib.getActionElement(action))) {
                    // If both mouseover/mouseout and mouseenter/mouseleave events are
                    // enabled, two separate handlers for mouseover/mouseout are
                    // registered. Both handlers will see the same event instance
                    // so we create a copy to avoid interfering with the dispatching of
                    // the mouseover/mouseout event.
                    const copiedEvent = eventLib.createMouseSpecialEvent(eventInfoLib.getEvent(eventInfo), eventInfoLib.getActionElement(action));
                    eventInfoLib.setEvent(eventInfo, copiedEvent);
                    // Since the mouseenter/mouseleave events do not bubble, the target
                    // of the event is technically the `actionElement` (the node with the
                    // `jsaction` attribute)
                    eventInfoLib.setTargetElement(eventInfo, eventInfoLib.getActionElement(action));
                }
                else {
                    eventInfoLib.unsetAction(eventInfo);
                }
            }
        }
    }
    /**
     * Walk to the parent node, unless the node has a different owner in
     * which case we walk to the owner. Attempt to walk to host of a
     * shadow root if needed.
     */
    getParentNode(element) {
        const owner = element[Property.OWNER];
        if (owner) {
            return owner;
        }
        const parentNode = element.parentNode;
        if (parentNode?.nodeName === '#document-fragment') {
            return parentNode?.host ?? null;
        }
        return parentNode;
    }
    /**
     * Accesses the jsaction map on a node and retrieves the name of the
     * action the given event is mapped to, if any. It parses the
     * attribute value and stores it in a property on the node for
     * subsequent retrieval without re-parsing and re-accessing the
     * attribute.
     *
     * @param actionElement The DOM node to retrieve the jsaction map from.
     * @param eventInfo `EventInfo` to set `action` and `actionElement` if an
     *    action is found on the `actionElement`.
     */
    populateActionOnElement(actionElement, eventInfo) {
        const actionMap = this.parseActions(actionElement);
        const actionName = actionMap[eventInfoLib.getEventType(eventInfo)];
        if (actionName !== undefined) {
            eventInfoLib.setAction(eventInfo, actionName, actionElement);
        }
        if (this.a11yClickSupport) {
            this.populateClickOnlyAction(actionElement, eventInfo, actionMap);
        }
    }
    /**
     * Parses and caches an element's jsaction element into a map.
     *
     * This is primarily for internal use.
     *
     * @param actionElement The DOM node to retrieve the jsaction map from.
     * @return Map from event to qualified name of the jsaction bound to it.
     */
    parseActions(actionElement) {
        let actionMap = cache.get(actionElement);
        if (!actionMap) {
            const jsactionAttribute = actionElement.getAttribute(Attribute.JSACTION);
            if (!jsactionAttribute) {
                actionMap = EMPTY_ACTION_MAP;
                cache.set(actionElement, actionMap);
            }
            else {
                actionMap = cache.getParsed(jsactionAttribute);
                if (!actionMap) {
                    actionMap = {};
                    const values = jsactionAttribute.split(REGEXP_SEMICOLON);
                    for (let idx = 0; idx < values.length; idx++) {
                        const value = values[idx];
                        if (!value) {
                            continue;
                        }
                        const colon = value.indexOf(Char.EVENT_ACTION_SEPARATOR);
                        const hasColon = colon !== -1;
                        const type = hasColon ? value.substr(0, colon).trim() : DEFAULT_EVENT_TYPE;
                        const action = hasColon ? value.substr(colon + 1).trim() : value;
                        actionMap[type] = action;
                    }
                    cache.setParsed(jsactionAttribute, actionMap);
                }
                cache.set(actionElement, actionMap);
            }
        }
        return actionMap;
    }
    addA11yClickSupport(updateEventInfoForA11yClick, preventDefaultForA11yClick, populateClickOnlyAction) {
        this.a11yClickSupport = true;
        this.updateEventInfoForA11yClick = updateEventInfoForA11yClick;
        this.preventDefaultForA11yClick = preventDefaultForA11yClick;
        this.populateClickOnlyAction = populateClickOnlyAction;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aW9uX3Jlc29sdmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9wcmltaXRpdmVzL2V2ZW50LWRpc3BhdGNoL3NyYy9hY3Rpb25fcmVzb2x2ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUN0QyxPQUFPLEVBQUMsSUFBSSxFQUFDLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFDdkMsT0FBTyxFQUFDLFFBQVEsRUFBQyxNQUFNLFlBQVksQ0FBQztBQUVwQyxPQUFPLEtBQUssS0FBSyxNQUFNLFNBQVMsQ0FBQztBQUNqQyxPQUFPLEtBQUssWUFBWSxNQUFNLGNBQWMsQ0FBQztBQUM3QyxPQUFPLEtBQUssUUFBUSxNQUFNLFNBQVMsQ0FBQztBQUVwQzs7O0dBR0c7QUFDSCxNQUFNLGdCQUFnQixHQUE0QixFQUFFLENBQUM7QUFFckQ7O0dBRUc7QUFDSCxNQUFNLGdCQUFnQixHQUFHLFNBQVMsQ0FBQztBQUVuQyx3REFBd0Q7QUFDeEQsTUFBTSxrQkFBa0IsR0FBVyxTQUFTLENBQUMsS0FBSyxDQUFDO0FBRW5ELG1DQUFtQztBQUNuQyxNQUFNLE9BQU8sY0FBYztJQWN6QixZQUFZLEVBQ1YsMEJBQTBCLEdBQUcsS0FBSyxNQUdoQyxFQUFFO1FBakJFLHFCQUFnQixHQUFZLEtBQUssQ0FBQztRQUdsQyxnQ0FBMkIsR0FBaUQsU0FBUyxDQUFDO1FBRXRGLCtCQUEwQixHQUFpRCxTQUFTLENBQUM7UUFFckYsNEJBQXVCLEdBSW5CLFNBQVMsQ0FBQztRQU9wQixJQUFJLENBQUMsMEJBQTBCLEdBQUcsMEJBQTBCLENBQUM7SUFDL0QsQ0FBQztJQUVELGdCQUFnQixDQUFDLFNBQWlDO1FBQ2hELG1FQUFtRTtRQUNuRSxt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LENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUM7d0JBQzNFLE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQzt3QkFDakUsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQztvQkFDM0IsQ0FBQztvQkFDRCxLQUFLLENBQUMsU0FBUyxDQUFDLGlCQUFpQixFQUFFLFNBQVMsQ0FBQyxDQUFDO2dCQUNoRCxDQUFDO2dCQUNELEtBQUssQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ3RDLENBQUM7UUFDSCxDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQUVELG1CQUFtQixDQUNqQiwyQkFBeUUsRUFDekUsMEJBQXVFLEVBQ3ZFLHVCQUFpRTtRQUVqRSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDO1FBQzdCLElBQUksQ0FBQywyQkFBMkIsR0FBRywyQkFBMkIsQ0FBQztRQUMvRCxJQUFJLENBQUMsMEJBQTBCLEdBQUcsMEJBQTBCLENBQUM7UUFDN0QsSUFBSSxDQUFDLHVCQUF1QixHQUFHLHVCQUF1QixDQUFDO0lBQ3pELENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0F0dHJpYnV0ZX0gZnJvbSAnLi9hdHRyaWJ1dGUnO1xuaW1wb3J0IHtDaGFyfSBmcm9tICcuL2NoYXInO1xuaW1wb3J0IHtFdmVudFR5cGV9IGZyb20gJy4vZXZlbnRfdHlwZSc7XG5pbXBvcnQge1Byb3BlcnR5fSBmcm9tICcuL3Byb3BlcnR5JztcbmltcG9ydCAqIGFzIGExMXlDbGljayBmcm9tICcuL2ExMXlfY2xpY2snO1xuaW1wb3J0ICogYXMgY2FjaGUgZnJvbSAnLi9jYWNoZSc7XG5pbXBvcnQgKiBhcyBldmVudEluZm9MaWIgZnJvbSAnLi9ldmVudF9pbmZvJztcbmltcG9ydCAqIGFzIGV2ZW50TGliIGZyb20gJy4vZXZlbnQnO1xuXG4vKipcbiAqIFNpbmNlIG1hcHMgZnJvbSBldmVudCB0byBhY3Rpb24gYXJlIGltbXV0YWJsZSB3ZSBjYW4gdXNlIGEgc2luZ2xlIG1hcFxuICogdG8gcmVwcmVzZW50IHRoZSBlbXB0eSBtYXAuXG4gKi9cbmNvbnN0IEVNUFRZX0FDVElPTl9NQVA6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG5cbi8qKlxuICogVGhpcyByZWd1bGFyIGV4cHJlc3Npb24gbWF0Y2hlcyBhIHNlbWljb2xvbi5cbiAqL1xuY29uc3QgUkVHRVhQX1NFTUlDT0xPTiA9IC9cXHMqO1xccyovO1xuXG4vKiogSWYgbm8gZXZlbnQgdHlwZSBpcyBkZWZpbmVkLCBkZWZhdWx0cyB0byBgY2xpY2tgLiAqL1xuY29uc3QgREVGQVVMVF9FVkVOVF9UWVBFOiBzdHJpbmcgPSBFdmVudFR5cGUuQ0xJQ0s7XG5cbi8qKiBSZXNvbHZlcyBhY3Rpb25zIGZvciBFdmVudHMuICovXG5leHBvcnQgY2xhc3MgQWN0aW9uUmVzb2x2ZXIge1xuICBwcml2YXRlIGExMXlDbGlja1N1cHBvcnQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSByZWFkb25seSBzeW50aGV0aWNNb3VzZUV2ZW50U3VwcG9ydDogYm9vbGVhbjtcblxuICBwcml2YXRlIHVwZGF0ZUV2ZW50SW5mb0ZvckExMXlDbGljaz86IChldmVudEluZm86IGV2ZW50SW5mb0xpYi5FdmVudEluZm8pID0+IHZvaWQgPSB1bmRlZmluZWQ7XG5cbiAgcHJpdmF0ZSBwcmV2ZW50RGVmYXVsdEZvckExMXlDbGljaz86IChldmVudEluZm86IGV2ZW50SW5mb0xpYi5FdmVudEluZm8pID0+IHZvaWQgPSB1bmRlZmluZWQ7XG5cbiAgcHJpdmF0ZSBwb3B1bGF0ZUNsaWNrT25seUFjdGlvbj86IChcbiAgICBhY3Rpb25FbGVtZW50OiBFbGVtZW50LFxuICAgIGV2ZW50SW5mbzogZXZlbnRJbmZvTGliLkV2ZW50SW5mbyxcbiAgICBhY3Rpb25NYXA6IHtba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWR9LFxuICApID0+IHZvaWQgPSB1bmRlZmluZWQ7XG5cbiAgY29uc3RydWN0b3Ioe1xuICAgIHN5bnRoZXRpY01vdXNlRXZlbnRTdXBwb3J0ID0gZmFsc2UsXG4gIH06IHtcbiAgICBzeW50aGV0aWNNb3VzZUV2ZW50U3VwcG9ydD86IGJvb2xlYW47XG4gIH0gPSB7fSkge1xuICAgIHRoaXMuc3ludGhldGljTW91c2VFdmVudFN1cHBvcnQgPSBzeW50aGV0aWNNb3VzZUV2ZW50U3VwcG9ydDtcbiAgfVxuXG4gIHJlc29sdmVFdmVudFR5cGUoZXZlbnRJbmZvOiBldmVudEluZm9MaWIuRXZlbnRJbmZvKSB7XG4gICAgLy8gV2UgZGlzdGluZ3Vpc2ggbW9kaWZpZWQgYW5kIHBsYWluIGNsaWNrcyBpbiBvcmRlciB0byBzdXBwb3J0IHRoZVxuICAgIC8vIGRlZmF1bHQgYnJvd3NlciBiZWhhdmlvciBvZiBtb2RpZmllZCBjbGlja3Mgb24gbGlua3M7IHVzdWFsbHkgdG9cbiAgICAvLyBvcGVuIHRoZSBVUkwgb2YgdGhlIGxpbmsgaW4gbmV3IHRhYiBvciBuZXcgd2luZG93IG9uIGN0cmwvY21kXG4gICAgLy8gY2xpY2suIEEgRE9NICdjbGljaycgZXZlbnQgaXMgbWFwcGVkIHRvIHRoZSBqc2FjdGlvbiAnY2xpY2snXG4gICAgLy8gZXZlbnQgaWZmIHRoZXJlIGlzIG5vIG1vZGlmaWVyIHByZXNlbnQgb24gdGhlIGV2ZW50LiBJZiB0aGVyZSBpc1xuICAgIC8vIGEgbW9kaWZpZXIsIGl0J3MgbWFwcGVkIHRvICdjbGlja21vZCcgaW5zdGVhZC5cbiAgICAvL1xuICAgIC8vIEl0J3MgYWxsb3dlZCB0byBvbWl0IHRoZSBldmVudCBpbiB0aGUganNhY3Rpb24gYXR0cmlidXRlLiBJbiB0aGF0XG4gICAgLy8gY2FzZSwgJ2NsaWNrJyBpcyBhc3N1bWVkLiBUaHVzIHRoZSBmb2xsb3dpbmcgdHdvIGFyZSBlcXVpdmFsZW50OlxuICAgIC8vXG4gICAgLy8gICA8YSBocmVmPVwic29tZXVybFwiIGpzYWN0aW9uPVwiZ25hLmZ1XCI+XG4gICAgLy8gICA8YSBocmVmPVwic29tZXVybFwiIGpzYWN0aW9uPVwiY2xpY2s6Z25hLmZ1XCI+XG4gICAgLy9cbiAgICAvLyBGb3IgdW5tb2RpZmllZCBjbGlja3MsIEV2ZW50Q29udHJhY3QgaW52b2tlcyB0aGUganNhY3Rpb25cbiAgICAvLyAnZ25hLmZ1Jy4gRm9yIG1vZGlmaWVkIGNsaWNrcywgRXZlbnRDb250cmFjdCB3b24ndCBmaW5kIGFcbiAgICAvLyBzdWl0YWJsZSBhY3Rpb24gYW5kIGxlYXZlIHRoZSBldmVudCB0byBiZSBoYW5kbGVkIGJ5IHRoZVxuICAgIC8vIGJyb3dzZXIuXG4gICAgLy9cbiAgICAvLyBJbiBvcmRlciB0byBhbHNvIGludm9rZSBhIGpzYWN0aW9uIGhhbmRsZXIgZm9yIGEgbW9kaWZpZXIgY2xpY2ssXG4gICAgLy8gJ2NsaWNrbW9kJyBuZWVkcyB0byBiZSB1c2VkOlxuICAgIC8vXG4gICAgLy8gICA8YSBocmVmPVwic29tZXVybFwiIGpzYWN0aW9uPVwiY2xpY2ttb2Q6Z25hLmZ1XCI+XG4gICAgLy9cbiAgICAvLyBFdmVudENvbnRyYWN0IGludm9rZXMgdGhlIGpzYWN0aW9uICdnbmEuZnUnIGZvciBtb2RpZmllZFxuICAgIC8vIGNsaWNrcy4gVW5tb2RpZmllZCBjbGlja3MgYXJlIGxlZnQgdG8gdGhlIGJyb3dzZXIuXG4gICAgLy9cbiAgICAvLyBJbiBvcmRlciB0byBzZXQgdXAgdGhlIGV2ZW50IGNvbnRyYWN0IHRvIGhhbmRsZSBib3RoIGNsaWNrb25seSBhbmRcbiAgICAvLyBjbGlja21vZCwgb25seSBhZGRFdmVudChFdmVudFR5cGUuQ0xJQ0spIGlzIG5lY2Vzc2FyeS5cbiAgICAvL1xuICAgIC8vIEluIG9yZGVyIHRvIHNldCB1cCB0aGUgZXZlbnQgY29udHJhY3QgdG8gaGFuZGxlIGNsaWNrLFxuICAgIC8vIGFkZEV2ZW50KCkgaXMgbmVjZXNzYXJ5IGZvciBDTElDSywgS0VZRE9XTiwgYW5kIEtFWVBSRVNTIGV2ZW50IHR5cGVzLiAgSWZcbiAgICAvLyBhMTF5IGNsaWNrIHN1cHBvcnQgaXMgZW5hYmxlZCwgYWRkRXZlbnQoKSB3aWxsIHNldCB1cCB0aGUgYXBwcm9wcmlhdGUga2V5XG4gICAgLy8gZXZlbnQgaGFuZGxlciBhdXRvbWF0aWNhbGx5LlxuICAgIGlmIChcbiAgICAgIGV2ZW50SW5mb0xpYi5nZXRFdmVudFR5cGUoZXZlbnRJbmZvKSA9PT0gRXZlbnRUeXBlLkNMSUNLICYmXG4gICAgICBldmVudExpYi5pc01vZGlmaWVkQ2xpY2tFdmVudChldmVudEluZm9MaWIuZ2V0RXZlbnQoZXZlbnRJbmZvKSlcbiAgICApIHtcbiAgICAgIGV2ZW50SW5mb0xpYi5zZXRFdmVudFR5cGUoZXZlbnRJbmZvLCBFdmVudFR5cGUuQ0xJQ0tNT0QpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5hMTF5Q2xpY2tTdXBwb3J0KSB7XG4gICAgICB0aGlzLnVwZGF0ZUV2ZW50SW5mb0ZvckExMXlDbGljayEoZXZlbnRJbmZvKTtcbiAgICB9XG4gIH1cblxuICByZXNvbHZlQWN0aW9uKGV2ZW50SW5mbzogZXZlbnRJbmZvTGliLkV2ZW50SW5mbykge1xuICAgIGlmIChldmVudEluZm9MaWIuZ2V0UmVzb2x2ZWQoZXZlbnRJbmZvKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnBvcHVsYXRlQWN0aW9uKGV2ZW50SW5mbywgZXZlbnRJbmZvTGliLmdldFRhcmdldEVsZW1lbnQoZXZlbnRJbmZvKSk7XG4gICAgZXZlbnRJbmZvTGliLnNldFJlc29sdmVkKGV2ZW50SW5mbywgdHJ1ZSk7XG4gIH1cblxuICByZXNvbHZlUGFyZW50QWN0aW9uKGV2ZW50SW5mbzogZXZlbnRJbmZvTGliLkV2ZW50SW5mbykge1xuICAgIGNvbnN0IGFjdGlvbiA9IGV2ZW50SW5mb0xpYi5nZXRBY3Rpb24oZXZlbnRJbmZvKTtcbiAgICBjb25zdCBhY3Rpb25FbGVtZW50ID0gYWN0aW9uICYmIGV2ZW50SW5mb0xpYi5nZXRBY3Rpb25FbGVtZW50KGFjdGlvbik7XG4gICAgZXZlbnRJbmZvTGliLnVuc2V0QWN0aW9uKGV2ZW50SW5mbyk7XG4gICAgY29uc3QgcGFyZW50Tm9kZSA9IGFjdGlvbkVsZW1lbnQgJiYgdGhpcy5nZXRQYXJlbnROb2RlKGFjdGlvbkVsZW1lbnQpO1xuICAgIGlmICghcGFyZW50Tm9kZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnBvcHVsYXRlQWN0aW9uKGV2ZW50SW5mbywgcGFyZW50Tm9kZSk7XG4gIH1cblxuICAvKipcbiAgICogU2VhcmNoZXMgZm9yIGEganNhY3Rpb24gdGhhdCB0aGUgRE9NIGV2ZW50IG1hcHMgdG8gYW5kIGNyZWF0ZXMgYW5cbiAgICogb2JqZWN0IGNvbnRhaW5pbmcgZXZlbnQgaW5mb3JtYXRpb24gdXNlZCBmb3IgZGlzcGF0Y2hpbmcgYnlcbiAgICoganNhY3Rpb24uRGlzcGF0Y2hlci4gVGhpcyBtZXRob2QgcG9wdWxhdGVzIHRoZSBgYWN0aW9uYCBhbmQgYGFjdGlvbkVsZW1lbnRgXG4gICAqIGZpZWxkcyBvZiB0aGUgRXZlbnRJbmZvIG9iamVjdCBwYXNzZWQgaW4gYnkgZmluZGluZyB0aGUgZmlyc3RcbiAgICoganNhY3Rpb24gYXR0cmlidXRlIGFib3ZlIHRoZSB0YXJnZXQgTm9kZSBvZiB0aGUgZXZlbnQsIGFuZCBiZWxvd1xuICAgKiB0aGUgY29udGFpbmVyIE5vZGUsIHRoYXQgc3BlY2lmaWVzIGEganNhY3Rpb24gZm9yIHRoZSBldmVudFxuICAgKiB0eXBlLiBJZiBubyBzdWNoIGpzYWN0aW9uIGlzIGZvdW5kLCB0aGVuIGFjdGlvbiBpcyB1bmRlZmluZWQuXG4gICAqXG4gICAqIEBwYXJhbSBldmVudEluZm8gYEV2ZW50SW5mb2AgdG8gc2V0IGBhY3Rpb25gIGFuZCBgYWN0aW9uRWxlbWVudGAgaWYgYW5cbiAgICogICAgYWN0aW9uIGlzIGZvdW5kIG9uIGFueSBgRWxlbWVudGAgaW4gdGhlIHBhdGggb2YgdGhlIGBFdmVudGAuXG4gICAqL1xuICBwcml2YXRlIHBvcHVsYXRlQWN0aW9uKGV2ZW50SW5mbzogZXZlbnRJbmZvTGliLkV2ZW50SW5mbywgY3VycmVudFRhcmdldDogRWxlbWVudCkge1xuICAgIGxldCBhY3Rpb25FbGVtZW50OiBFbGVtZW50IHwgbnVsbCA9IGN1cnJlbnRUYXJnZXQ7XG4gICAgd2hpbGUgKGFjdGlvbkVsZW1lbnQgJiYgYWN0aW9uRWxlbWVudCAhPT0gZXZlbnRJbmZvTGliLmdldENvbnRhaW5lcihldmVudEluZm8pKSB7XG4gICAgICBpZiAoYWN0aW9uRWxlbWVudC5ub2RlVHlwZSA9PT0gTm9kZS5FTEVNRU5UX05PREUpIHtcbiAgICAgICAgdGhpcy5wb3B1bGF0ZUFjdGlvbk9uRWxlbWVudChhY3Rpb25FbGVtZW50LCBldmVudEluZm8pO1xuICAgICAgfVxuXG4gICAgICBpZiAoZXZlbnRJbmZvTGliLmdldEFjdGlvbihldmVudEluZm8pKSB7XG4gICAgICAgIC8vIEFuIGV2ZW50IGlzIGhhbmRsZWQgYnkgYXQgbW9zdCBvbmUganNhY3Rpb24uIFRodXMgd2Ugc3RvcCBhdCB0aGVcbiAgICAgICAgLy8gZmlyc3QgbWF0Y2hpbmcganNhY3Rpb24gc3BlY2lmaWVkIGluIGEganNhY3Rpb24gYXR0cmlidXRlIHVwIHRoZVxuICAgICAgICAvLyBhbmNlc3RvciBjaGFpbiBvZiB0aGUgZXZlbnQgdGFyZ2V0IG5vZGUuXG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgYWN0aW9uRWxlbWVudCA9IHRoaXMuZ2V0UGFyZW50Tm9kZShhY3Rpb25FbGVtZW50KTtcbiAgICB9XG5cbiAgICBjb25zdCBhY3Rpb24gPSBldmVudEluZm9MaWIuZ2V0QWN0aW9uKGV2ZW50SW5mbyk7XG4gICAgaWYgKCFhY3Rpb24pIHtcbiAgICAgIC8vIE5vIGFjdGlvbiBmb3VuZC5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5hMTF5Q2xpY2tTdXBwb3J0KSB7XG4gICAgICB0aGlzLnByZXZlbnREZWZhdWx0Rm9yQTExeUNsaWNrIShldmVudEluZm8pO1xuICAgIH1cblxuICAgIC8vIFdlIGF0dGVtcHQgdG8gaGFuZGxlIHRoZSBtb3VzZWVudGVyL21vdXNlbGVhdmUgZXZlbnRzIGhlcmUgYnlcbiAgICAvLyBkZXRlY3Rpbmcgd2hldGhlciB0aGUgbW91c2VvdmVyL21vdXNlb3V0IGV2ZW50cyBjb3JyZXNwb25kIHRvXG4gICAgLy8gZW50ZXJpbmcvbGVhdmluZyBhbiBlbGVtZW50LlxuICAgIGlmICh0aGlzLnN5bnRoZXRpY01vdXNlRXZlbnRTdXBwb3J0KSB7XG4gICAgICBpZiAoXG4gICAgICAgIGV2ZW50SW5mb0xpYi5nZXRFdmVudFR5cGUoZXZlbnRJbmZvKSA9PT0gRXZlbnRUeXBlLk1PVVNFRU5URVIgfHxcbiAgICAgICAgZXZlbnRJbmZvTGliLmdldEV2ZW50VHlwZShldmVudEluZm8pID09PSBFdmVudFR5cGUuTU9VU0VMRUFWRSB8fFxuICAgICAgICBldmVudEluZm9MaWIuZ2V0RXZlbnRUeXBlKGV2ZW50SW5mbykgPT09IEV2ZW50VHlwZS5QT0lOVEVSRU5URVIgfHxcbiAgICAgICAgZXZlbnRJbmZvTGliLmdldEV2ZW50VHlwZShldmVudEluZm8pID09PSBFdmVudFR5cGUuUE9JTlRFUkxFQVZFXG4gICAgICApIHtcbiAgICAgICAgLy8gV2UgYXR0ZW1wdCB0byBoYW5kbGUgdGhlIG1vdXNlZW50ZXIvbW91c2VsZWF2ZSBldmVudHMgaGVyZSBieVxuICAgICAgICAvLyBkZXRlY3Rpbmcgd2hldGhlciB0aGUgbW91c2VvdmVyL21vdXNlb3V0IGV2ZW50cyBjb3JyZXNwb25kIHRvXG4gICAgICAgIC8vIGVudGVyaW5nL2xlYXZpbmcgYW4gZWxlbWVudC5cbiAgICAgICAgaWYgKFxuICAgICAgICAgIGV2ZW50TGliLmlzTW91c2VTcGVjaWFsRXZlbnQoXG4gICAgICAgICAgICBldmVudEluZm9MaWIuZ2V0RXZlbnQoZXZlbnRJbmZvKSxcbiAgICAgICAgICAgIGV2ZW50SW5mb0xpYi5nZXRFdmVudFR5cGUoZXZlbnRJbmZvKSxcbiAgICAgICAgICAgIGV2ZW50SW5mb0xpYi5nZXRBY3Rpb25FbGVtZW50KGFjdGlvbiksXG4gICAgICAgICAgKVxuICAgICAgICApIHtcbiAgICAgICAgICAvLyBJZiBib3RoIG1vdXNlb3Zlci9tb3VzZW91dCBhbmQgbW91c2VlbnRlci9tb3VzZWxlYXZlIGV2ZW50cyBhcmVcbiAgICAgICAgICAvLyBlbmFibGVkLCB0d28gc2VwYXJhdGUgaGFuZGxlcnMgZm9yIG1vdXNlb3Zlci9tb3VzZW91dCBhcmVcbiAgICAgICAgICAvLyByZWdpc3RlcmVkLiBCb3RoIGhhbmRsZXJzIHdpbGwgc2VlIHRoZSBzYW1lIGV2ZW50IGluc3RhbmNlXG4gICAgICAgICAgLy8gc28gd2UgY3JlYXRlIGEgY29weSB0byBhdm9pZCBpbnRlcmZlcmluZyB3aXRoIHRoZSBkaXNwYXRjaGluZyBvZlxuICAgICAgICAgIC8vIHRoZSBtb3VzZW92ZXIvbW91c2VvdXQgZXZlbnQuXG4gICAgICAgICAgY29uc3QgY29waWVkRXZlbnQgPSBldmVudExpYi5jcmVhdGVNb3VzZVNwZWNpYWxFdmVudChcbiAgICAgICAgICAgIGV2ZW50SW5mb0xpYi5nZXRFdmVudChldmVudEluZm8pLFxuICAgICAgICAgICAgZXZlbnRJbmZvTGliLmdldEFjdGlvbkVsZW1lbnQoYWN0aW9uKSxcbiAgICAgICAgICApO1xuICAgICAgICAgIGV2ZW50SW5mb0xpYi5zZXRFdmVudChldmVudEluZm8sIGNvcGllZEV2ZW50KTtcbiAgICAgICAgICAvLyBTaW5jZSB0aGUgbW91c2VlbnRlci9tb3VzZWxlYXZlIGV2ZW50cyBkbyBub3QgYnViYmxlLCB0aGUgdGFyZ2V0XG4gICAgICAgICAgLy8gb2YgdGhlIGV2ZW50IGlzIHRlY2huaWNhbGx5IHRoZSBgYWN0aW9uRWxlbWVudGAgKHRoZSBub2RlIHdpdGggdGhlXG4gICAgICAgICAgLy8gYGpzYWN0aW9uYCBhdHRyaWJ1dGUpXG4gICAgICAgICAgZXZlbnRJbmZvTGliLnNldFRhcmdldEVsZW1lbnQoZXZlbnRJbmZvLCBldmVudEluZm9MaWIuZ2V0QWN0aW9uRWxlbWVudChhY3Rpb24pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBldmVudEluZm9MaWIudW5zZXRBY3Rpb24oZXZlbnRJbmZvKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBXYWxrIHRvIHRoZSBwYXJlbnQgbm9kZSwgdW5sZXNzIHRoZSBub2RlIGhhcyBhIGRpZmZlcmVudCBvd25lciBpblxuICAgKiB3aGljaCBjYXNlIHdlIHdhbGsgdG8gdGhlIG93bmVyLiBBdHRlbXB0IHRvIHdhbGsgdG8gaG9zdCBvZiBhXG4gICAqIHNoYWRvdyByb290IGlmIG5lZWRlZC5cbiAgICovXG4gIHByaXZhdGUgZ2V0UGFyZW50Tm9kZShlbGVtZW50OiBFbGVtZW50KTogRWxlbWVudCB8IG51bGwge1xuICAgIGNvbnN0IG93bmVyID0gZWxlbWVudFtQcm9wZXJ0eS5PV05FUl07XG4gICAgaWYgKG93bmVyKSB7XG4gICAgICByZXR1cm4gb3duZXIgYXMgRWxlbWVudDtcbiAgICB9XG4gICAgY29uc3QgcGFyZW50Tm9kZSA9IGVsZW1lbnQucGFyZW50Tm9kZTtcbiAgICBpZiAocGFyZW50Tm9kZT8ubm9kZU5hbWUgPT09ICcjZG9jdW1lbnQtZnJhZ21lbnQnKSB7XG4gICAgICByZXR1cm4gKHBhcmVudE5vZGUgYXMgU2hhZG93Um9vdCB8IG51bGwpPy5ob3N0ID8/IG51bGw7XG4gICAgfVxuICAgIHJldHVybiBwYXJlbnROb2RlIGFzIEVsZW1lbnQgfCBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEFjY2Vzc2VzIHRoZSBqc2FjdGlvbiBtYXAgb24gYSBub2RlIGFuZCByZXRyaWV2ZXMgdGhlIG5hbWUgb2YgdGhlXG4gICAqIGFjdGlvbiB0aGUgZ2l2ZW4gZXZlbnQgaXMgbWFwcGVkIHRvLCBpZiBhbnkuIEl0IHBhcnNlcyB0aGVcbiAgICogYXR0cmlidXRlIHZhbHVlIGFuZCBzdG9yZXMgaXQgaW4gYSBwcm9wZXJ0eSBvbiB0aGUgbm9kZSBmb3JcbiAgICogc3Vic2VxdWVudCByZXRyaWV2YWwgd2l0aG91dCByZS1wYXJzaW5nIGFuZCByZS1hY2Nlc3NpbmcgdGhlXG4gICAqIGF0dHJpYnV0ZS5cbiAgICpcbiAgICogQHBhcmFtIGFjdGlvbkVsZW1lbnQgVGhlIERPTSBub2RlIHRvIHJldHJpZXZlIHRoZSBqc2FjdGlvbiBtYXAgZnJvbS5cbiAgICogQHBhcmFtIGV2ZW50SW5mbyBgRXZlbnRJbmZvYCB0byBzZXQgYGFjdGlvbmAgYW5kIGBhY3Rpb25FbGVtZW50YCBpZiBhblxuICAgKiAgICBhY3Rpb24gaXMgZm91bmQgb24gdGhlIGBhY3Rpb25FbGVtZW50YC5cbiAgICovXG4gIHByaXZhdGUgcG9wdWxhdGVBY3Rpb25PbkVsZW1lbnQoYWN0aW9uRWxlbWVudDogRWxlbWVudCwgZXZlbnRJbmZvOiBldmVudEluZm9MaWIuRXZlbnRJbmZvKSB7XG4gICAgY29uc3QgYWN0aW9uTWFwID0gdGhpcy5wYXJzZUFjdGlvbnMoYWN0aW9uRWxlbWVudCk7XG5cbiAgICBjb25zdCBhY3Rpb25OYW1lID0gYWN0aW9uTWFwW2V2ZW50SW5mb0xpYi5nZXRFdmVudFR5cGUoZXZlbnRJbmZvKV07XG4gICAgaWYgKGFjdGlvbk5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZXZlbnRJbmZvTGliLnNldEFjdGlvbihldmVudEluZm8sIGFjdGlvbk5hbWUsIGFjdGlvbkVsZW1lbnQpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmExMXlDbGlja1N1cHBvcnQpIHtcbiAgICAgIHRoaXMucG9wdWxhdGVDbGlja09ubHlBY3Rpb24hKGFjdGlvbkVsZW1lbnQsIGV2ZW50SW5mbywgYWN0aW9uTWFwKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUGFyc2VzIGFuZCBjYWNoZXMgYW4gZWxlbWVudCdzIGpzYWN0aW9uIGVsZW1lbnQgaW50byBhIG1hcC5cbiAgICpcbiAgICogVGhpcyBpcyBwcmltYXJpbHkgZm9yIGludGVybmFsIHVzZS5cbiAgICpcbiAgICogQHBhcmFtIGFjdGlvbkVsZW1lbnQgVGhlIERPTSBub2RlIHRvIHJldHJpZXZlIHRoZSBqc2FjdGlvbiBtYXAgZnJvbS5cbiAgICogQHJldHVybiBNYXAgZnJvbSBldmVudCB0byBxdWFsaWZpZWQgbmFtZSBvZiB0aGUganNhY3Rpb24gYm91bmQgdG8gaXQuXG4gICAqL1xuICBwcml2YXRlIHBhcnNlQWN0aW9ucyhhY3Rpb25FbGVtZW50OiBFbGVtZW50KToge1trZXk6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZH0ge1xuICAgIGxldCBhY3Rpb25NYXA6IHtba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWR9IHwgdW5kZWZpbmVkID0gY2FjaGUuZ2V0KGFjdGlvbkVsZW1lbnQpO1xuICAgIGlmICghYWN0aW9uTWFwKSB7XG4gICAgICBjb25zdCBqc2FjdGlvbkF0dHJpYnV0ZSA9IGFjdGlvbkVsZW1lbnQuZ2V0QXR0cmlidXRlKEF0dHJpYnV0ZS5KU0FDVElPTik7XG4gICAgICBpZiAoIWpzYWN0aW9uQXR0cmlidXRlKSB7XG4gICAgICAgIGFjdGlvbk1hcCA9IEVNUFRZX0FDVElPTl9NQVA7XG4gICAgICAgIGNhY2hlLnNldChhY3Rpb25FbGVtZW50LCBhY3Rpb25NYXApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWN0aW9uTWFwID0gY2FjaGUuZ2V0UGFyc2VkKGpzYWN0aW9uQXR0cmlidXRlKTtcbiAgICAgICAgaWYgKCFhY3Rpb25NYXApIHtcbiAgICAgICAgICBhY3Rpb25NYXAgPSB7fTtcbiAgICAgICAgICBjb25zdCB2YWx1ZXMgPSBqc2FjdGlvbkF0dHJpYnV0ZS5zcGxpdChSRUdFWFBfU0VNSUNPTE9OKTtcbiAgICAgICAgICBmb3IgKGxldCBpZHggPSAwOyBpZHggPCB2YWx1ZXMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSB2YWx1ZXNbaWR4XTtcbiAgICAgICAgICAgIGlmICghdmFsdWUpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBjb2xvbiA9IHZhbHVlLmluZGV4T2YoQ2hhci5FVkVOVF9BQ1RJT05fU0VQQVJBVE9SKTtcbiAgICAgICAgICAgIGNvbnN0IGhhc0NvbG9uID0gY29sb24gIT09IC0xO1xuICAgICAgICAgICAgY29uc3QgdHlwZSA9IGhhc0NvbG9uID8gdmFsdWUuc3Vic3RyKDAsIGNvbG9uKS50cmltKCkgOiBERUZBVUxUX0VWRU5UX1RZUEU7XG4gICAgICAgICAgICBjb25zdCBhY3Rpb24gPSBoYXNDb2xvbiA/IHZhbHVlLnN1YnN0cihjb2xvbiArIDEpLnRyaW0oKSA6IHZhbHVlO1xuICAgICAgICAgICAgYWN0aW9uTWFwW3R5cGVdID0gYWN0aW9uO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYWNoZS5zZXRQYXJzZWQoanNhY3Rpb25BdHRyaWJ1dGUsIGFjdGlvbk1hcCk7XG4gICAgICAgIH1cbiAgICAgICAgY2FjaGUuc2V0KGFjdGlvbkVsZW1lbnQsIGFjdGlvbk1hcCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhY3Rpb25NYXA7XG4gIH1cblxuICBhZGRBMTF5Q2xpY2tTdXBwb3J0KFxuICAgIHVwZGF0ZUV2ZW50SW5mb0ZvckExMXlDbGljazogdHlwZW9mIGExMXlDbGljay51cGRhdGVFdmVudEluZm9Gb3JBMTF5Q2xpY2ssXG4gICAgcHJldmVudERlZmF1bHRGb3JBMTF5Q2xpY2s6IHR5cGVvZiBhMTF5Q2xpY2sucHJldmVudERlZmF1bHRGb3JBMTF5Q2xpY2ssXG4gICAgcG9wdWxhdGVDbGlja09ubHlBY3Rpb246IHR5cGVvZiBhMTF5Q2xpY2sucG9wdWxhdGVDbGlja09ubHlBY3Rpb24sXG4gICkge1xuICAgIHRoaXMuYTExeUNsaWNrU3VwcG9ydCA9IHRydWU7XG4gICAgdGhpcy51cGRhdGVFdmVudEluZm9Gb3JBMTF5Q2xpY2sgPSB1cGRhdGVFdmVudEluZm9Gb3JBMTF5Q2xpY2s7XG4gICAgdGhpcy5wcmV2ZW50RGVmYXVsdEZvckExMXlDbGljayA9IHByZXZlbnREZWZhdWx0Rm9yQTExeUNsaWNrO1xuICAgIHRoaXMucG9wdWxhdGVDbGlja09ubHlBY3Rpb24gPSBwb3B1bGF0ZUNsaWNrT25seUFjdGlvbjtcbiAgfVxufVxuIl19