/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/*
 * Names of events that are special to jsaction. These are not all
 * event types that are legal to use in either HTML or the addEvent()
 * API, but these are the ones that are treated specially. All other
 * DOM events can be used in either addEvent() or in the value of the
 * jsaction attribute. Beware of browser specific events or events
 * that don't bubble though: If they are not mentioned here, then
 * event contract doesn't work around their peculiarities.
 */
export const EventType = {
    /**
     * Mouse middle click, introduced in Chrome 55 and not yet supported on
     * other browsers.
     */
    AUXCLICK: 'auxclick',
    /**
     * The change event fired by browsers when the `value` attribute of input,
     * select, and textarea elements are changed.
     */
    CHANGE: 'change',
    /**
     * The click event. In addEvent() refers to all click events, in the
     * jsaction attribute it refers to the unmodified click and Enter/Space
     * keypress events.  In the latter case, a jsaction click will be triggered,
     * for accessibility reasons.  See clickmod and clickonly, below.
     */
    CLICK: 'click',
    /**
     * Specifies the jsaction for a modified click event (i.e. a mouse
     * click with the modifier key Cmd/Ctrl pressed). This event isn't
     * separately enabled in addEvent(), because in the DOM, it's just a
     * click event.
     */
    CLICKMOD: 'clickmod',
    /**
     * Specifies the jsaction for a click-only event.  Click-only doesn't take
     * into account the case where an element with focus receives an Enter/Space
     * keypress.  This event isn't separately enabled in addEvent().
     */
    CLICKONLY: 'clickonly',
    /**
     * The dblclick event.
     */
    DBLCLICK: 'dblclick',
    /**
     * Focus doesn't bubble, but you can use it in addEvent() and
     * jsaction anyway. EventContract does the right thing under the
     * hood.
     */
    FOCUS: 'focus',
    /**
     * This event only exists in IE. For addEvent() and jsaction, use
     * focus instead; EventContract does the right thing even though
     * focus doesn't bubble.
     */
    FOCUSIN: 'focusin',
    /**
     * Analog to focus.
     */
    BLUR: 'blur',
    /**
     * Analog to focusin.
     */
    FOCUSOUT: 'focusout',
    /**
     * Submit doesn't bubble, so it cannot be used with event
     * contract. However, the browser helpfully fires a click event on
     * the submit button of a form (even if the form is not submitted by
     * a click on the submit button). So you should handle click on the
     * submit button instead.
     */
    SUBMIT: 'submit',
    /**
     * The keydown event. In addEvent() and non-click jsaction it represents the
     * regular DOM keydown event. It represents click actions in non-Gecko
     * browsers.
     */
    KEYDOWN: 'keydown',
    /**
     * The keypress event. In addEvent() and non-click jsaction it represents the
     * regular DOM keypress event. It represents click actions in Gecko browsers.
     */
    KEYPRESS: 'keypress',
    /**
     * The keyup event. In addEvent() and non-click jsaction it represents the
     * regular DOM keyup event. It represents click actions in non-Gecko
     * browsers.
     */
    KEYUP: 'keyup',
    /**
     * The mouseup event. Can either be used directly or used implicitly to
     * capture mouseup events. In addEvent(), it represents a regular DOM
     * mouseup event.
     */
    MOUSEUP: 'mouseup',
    /**
     * The mousedown event. Can either be used directly or used implicitly to
     * capture mouseenter events. In addEvent(), it represents a regular DOM
     * mouseover event.
     */
    MOUSEDOWN: 'mousedown',
    /**
     * The mouseover event. Can either be used directly or used implicitly to
     * capture mouseenter events. In addEvent(), it represents a regular DOM
     * mouseover event.
     */
    MOUSEOVER: 'mouseover',
    /**
     * The mouseout event. Can either be used directly or used implicitly to
     * capture mouseover events. In addEvent(), it represents a regular DOM
     * mouseout event.
     */
    MOUSEOUT: 'mouseout',
    /**
     * The mouseenter event. Does not bubble and fires individually on each
     * element being entered within a DOM tree.
     */
    MOUSEENTER: 'mouseenter',
    /**
     * The mouseleave event. Does not bubble and fires individually on each
     * element being entered within a DOM tree.
     */
    MOUSELEAVE: 'mouseleave',
    /**
     * The mousemove event.
     */
    MOUSEMOVE: 'mousemove',
    /**
     * The pointerup event. Can either be used directly or used implicitly to
     * capture pointerup events. In addEvent(), it represents a regular DOM
     * pointerup event.
     */
    POINTERUP: 'pointerup',
    /**
     * The pointerdown event. Can either be used directly or used implicitly to
     * capture pointerenter events. In addEvent(), it represents a regular DOM
     * mouseover event.
     */
    POINTERDOWN: 'pointerdown',
    /**
     * The pointerover event. Can either be used directly or used implicitly to
     * capture pointerenter events. In addEvent(), it represents a regular DOM
     * pointerover event.
     */
    POINTEROVER: 'pointerover',
    /**
     * The pointerout event. Can either be used directly or used implicitly to
     * capture pointerover events. In addEvent(), it represents a regular DOM
     * pointerout event.
     */
    POINTEROUT: 'pointerout',
    /**
     * The pointerenter event. Does not bubble and fires individually on each
     * element being entered within a DOM tree.
     */
    POINTERENTER: 'pointerenter',
    /**
     * The pointerleave event. Does not bubble and fires individually on each
     * element being entered within a DOM tree.
     */
    POINTERLEAVE: 'pointerleave',
    /**
     * The pointermove event.
     */
    POINTERMOVE: 'pointermove',
    /**
     * The pointercancel event.
     */
    POINTERCANCEL: 'pointercancel',
    /**
     * The gotpointercapture event is fired when
     * Element.setPointerCapture(pointerId) is called on a mouse input, or
     * implicitly when a touch input begins.
     */
    GOTPOINTERCAPTURE: 'gotpointercapture',
    /**
     * The lostpointercapture event is fired when
     * Element.releasePointerCapture(pointerId) is called, or implicitly after a
     * touch input ends.
     */
    LOSTPOINTERCAPTURE: 'lostpointercapture',
    /**
     * The error event. The error event doesn't bubble, but you can use it in
     * addEvent() and jsaction anyway. EventContract does the right thing under
     * the hood (except in IE8 which does not use error events).
     */
    ERROR: 'error',
    /**
     * The load event. The load event doesn't bubble, but you can use it in
     * addEvent() and jsaction anyway. EventContract does the right thing
     * under the hood.
     */
    LOAD: 'load',
    /**
     * The unload event.
     */
    UNLOAD: 'unload',
    /**
     * The touchstart event. Bubbles, will only ever fire in browsers with
     * touch support.
     */
    TOUCHSTART: 'touchstart',
    /**
     * The touchend event. Bubbles, will only ever fire in browsers with
     * touch support.
     */
    TOUCHEND: 'touchend',
    /**
     * The touchmove event. Bubbles, will only ever fire in browsers with
     * touch support.
     */
    TOUCHMOVE: 'touchmove',
    /**
     * The input event.
     */
    INPUT: 'input',
    /**
     * The scroll event.
     */
    SCROLL: 'scroll',
    /**
     * The toggle event. The toggle event doesn't bubble, but you can use it in
     * addEvent() and jsaction anyway. EventContract does the right thing
     * under the hood.
     */
    TOGGLE: 'toggle',
    /**
     * A custom event. The actual custom event type is declared as the 'type'
     * field in the event details. Supported in Firefox 6+, IE 9+, and all Chrome
     * versions.
     *
     * This is an internal name. Users should use jsaction's fireCustomEvent to
     * fire custom events instead of relying on this type to create them.
     */
    CUSTOM: '_custom',
};
/** All event types that do not bubble or capture and need a polyfill. */
export const MOUSE_SPECIAL_EVENT_TYPES = [
    EventType.MOUSEENTER,
    EventType.MOUSELEAVE,
    'pointerenter',
    'pointerleave',
];
/** All event types that are registered in the bubble phase. */
export const BUBBLE_EVENT_TYPES = [
    EventType.CLICK,
    EventType.DBLCLICK,
    EventType.FOCUSIN,
    EventType.FOCUSOUT,
    EventType.KEYDOWN,
    EventType.KEYUP,
    EventType.KEYPRESS,
    EventType.MOUSEOVER,
    EventType.MOUSEOUT,
    EventType.SUBMIT,
    EventType.TOUCHSTART,
    EventType.TOUCHEND,
    EventType.TOUCHMOVE,
    'touchcancel',
    'auxclick',
    'change',
    'compositionstart',
    'compositionupdate',
    'compositionend',
    'beforeinput',
    'input',
    'select',
    'copy',
    'cut',
    'paste',
    'mousedown',
    'mouseup',
    'wheel',
    'contextmenu',
    'dragover',
    'dragenter',
    'dragleave',
    'drop',
    'dragstart',
    'dragend',
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'pointerover',
    'pointerout',
    'gotpointercapture',
    'lostpointercapture',
    // Video events.
    'ended',
    'loadedmetadata',
    // Page visibility events.
    'pagehide',
    'pageshow',
    'visibilitychange',
    // Content visibility events.
    'beforematch',
];
/** All event types that are registered in the capture phase. */
export const CAPTURE_EVENT_TYPES = [
    EventType.FOCUS,
    EventType.BLUR,
    EventType.ERROR,
    EventType.LOAD,
    EventType.TOGGLE,
];
/**
 * Whether or not an event type should be registered in the capture phase.
 * @param eventType
 * @returns bool
 */
export const isCaptureEventType = (eventType) => CAPTURE_EVENT_TYPES.indexOf(eventType) >= 0;
/** All event types that are registered early.  */
const EARLY_EVENT_TYPES = [...BUBBLE_EVENT_TYPES, ...CAPTURE_EVENT_TYPES];
/**
 * Whether or not an event type is registered in the early contract.
 */
export const isEarlyEventType = (eventType) => EARLY_EVENT_TYPES.indexOf(eventType) >= 0;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRfdHlwZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvcHJpbWl0aXZlcy9ldmVudC1kaXNwYXRjaC9zcmMvZXZlbnRfdHlwZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSDs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sQ0FBQyxNQUFNLFNBQVMsR0FBRztJQUN2Qjs7O09BR0c7SUFDSCxRQUFRLEVBQUUsVUFBVTtJQUVwQjs7O09BR0c7SUFDSCxNQUFNLEVBQUUsUUFBUTtJQUVoQjs7Ozs7T0FLRztJQUNILEtBQUssRUFBRSxPQUFPO0lBRWQ7Ozs7O09BS0c7SUFDSCxRQUFRLEVBQUUsVUFBVTtJQUVwQjs7OztPQUlHO0lBQ0gsU0FBUyxFQUFFLFdBQVc7SUFFdEI7O09BRUc7SUFDSCxRQUFRLEVBQUUsVUFBVTtJQUVwQjs7OztPQUlHO0lBQ0gsS0FBSyxFQUFFLE9BQU87SUFFZDs7OztPQUlHO0lBQ0gsT0FBTyxFQUFFLFNBQVM7SUFFbEI7O09BRUc7SUFDSCxJQUFJLEVBQUUsTUFBTTtJQUVaOztPQUVHO0lBQ0gsUUFBUSxFQUFFLFVBQVU7SUFFcEI7Ozs7OztPQU1HO0lBQ0gsTUFBTSxFQUFFLFFBQVE7SUFFaEI7Ozs7T0FJRztJQUNILE9BQU8sRUFBRSxTQUFTO0lBRWxCOzs7T0FHRztJQUNILFFBQVEsRUFBRSxVQUFVO0lBRXBCOzs7O09BSUc7SUFDSCxLQUFLLEVBQUUsT0FBTztJQUVkOzs7O09BSUc7SUFDSCxPQUFPLEVBQUUsU0FBUztJQUVsQjs7OztPQUlHO0lBQ0gsU0FBUyxFQUFFLFdBQVc7SUFFdEI7Ozs7T0FJRztJQUNILFNBQVMsRUFBRSxXQUFXO0lBRXRCOzs7O09BSUc7SUFDSCxRQUFRLEVBQUUsVUFBVTtJQUVwQjs7O09BR0c7SUFDSCxVQUFVLEVBQUUsWUFBWTtJQUV4Qjs7O09BR0c7SUFDSCxVQUFVLEVBQUUsWUFBWTtJQUV4Qjs7T0FFRztJQUNILFNBQVMsRUFBRSxXQUFXO0lBRXRCOzs7O09BSUc7SUFDSCxTQUFTLEVBQUUsV0FBVztJQUV0Qjs7OztPQUlHO0lBQ0gsV0FBVyxFQUFFLGFBQWE7SUFFMUI7Ozs7T0FJRztJQUNILFdBQVcsRUFBRSxhQUFhO0lBRTFCOzs7O09BSUc7SUFDSCxVQUFVLEVBQUUsWUFBWTtJQUV4Qjs7O09BR0c7SUFDSCxZQUFZLEVBQUUsY0FBYztJQUU1Qjs7O09BR0c7SUFDSCxZQUFZLEVBQUUsY0FBYztJQUU1Qjs7T0FFRztJQUNILFdBQVcsRUFBRSxhQUFhO0lBRTFCOztPQUVHO0lBQ0gsYUFBYSxFQUFFLGVBQWU7SUFFOUI7Ozs7T0FJRztJQUNILGlCQUFpQixFQUFFLG1CQUFtQjtJQUV0Qzs7OztPQUlHO0lBQ0gsa0JBQWtCLEVBQUUsb0JBQW9CO0lBRXhDOzs7O09BSUc7SUFDSCxLQUFLLEVBQUUsT0FBTztJQUVkOzs7O09BSUc7SUFDSCxJQUFJLEVBQUUsTUFBTTtJQUVaOztPQUVHO0lBQ0gsTUFBTSxFQUFFLFFBQVE7SUFFaEI7OztPQUdHO0lBQ0gsVUFBVSxFQUFFLFlBQVk7SUFFeEI7OztPQUdHO0lBQ0gsUUFBUSxFQUFFLFVBQVU7SUFFcEI7OztPQUdHO0lBQ0gsU0FBUyxFQUFFLFdBQVc7SUFFdEI7O09BRUc7SUFDSCxLQUFLLEVBQUUsT0FBTztJQUVkOztPQUVHO0lBQ0gsTUFBTSxFQUFFLFFBQVE7SUFFaEI7Ozs7T0FJRztJQUNILE1BQU0sRUFBRSxRQUFRO0lBRWhCOzs7Ozs7O09BT0c7SUFDSCxNQUFNLEVBQUUsU0FBUztDQUNsQixDQUFDO0FBRUYseUVBQXlFO0FBQ3pFLE1BQU0sQ0FBQyxNQUFNLHlCQUF5QixHQUFHO0lBQ3ZDLFNBQVMsQ0FBQyxVQUFVO0lBQ3BCLFNBQVMsQ0FBQyxVQUFVO0lBQ3BCLGNBQWM7SUFDZCxjQUFjO0NBQ2YsQ0FBQztBQUVGLCtEQUErRDtBQUMvRCxNQUFNLENBQUMsTUFBTSxrQkFBa0IsR0FBRztJQUNoQyxTQUFTLENBQUMsS0FBSztJQUNmLFNBQVMsQ0FBQyxRQUFRO0lBQ2xCLFNBQVMsQ0FBQyxPQUFPO0lBQ2pCLFNBQVMsQ0FBQyxRQUFRO0lBQ2xCLFNBQVMsQ0FBQyxPQUFPO0lBQ2pCLFNBQVMsQ0FBQyxLQUFLO0lBQ2YsU0FBUyxDQUFDLFFBQVE7SUFDbEIsU0FBUyxDQUFDLFNBQVM7SUFDbkIsU0FBUyxDQUFDLFFBQVE7SUFDbEIsU0FBUyxDQUFDLE1BQU07SUFDaEIsU0FBUyxDQUFDLFVBQVU7SUFDcEIsU0FBUyxDQUFDLFFBQVE7SUFDbEIsU0FBUyxDQUFDLFNBQVM7SUFDbkIsYUFBYTtJQUViLFVBQVU7SUFDVixRQUFRO0lBQ1Isa0JBQWtCO0lBQ2xCLG1CQUFtQjtJQUNuQixnQkFBZ0I7SUFDaEIsYUFBYTtJQUNiLE9BQU87SUFDUCxRQUFRO0lBRVIsTUFBTTtJQUNOLEtBQUs7SUFDTCxPQUFPO0lBQ1AsV0FBVztJQUNYLFNBQVM7SUFDVCxPQUFPO0lBQ1AsYUFBYTtJQUViLFVBQVU7SUFDVixXQUFXO0lBQ1gsV0FBVztJQUNYLE1BQU07SUFDTixXQUFXO0lBQ1gsU0FBUztJQUVULGFBQWE7SUFDYixhQUFhO0lBQ2IsV0FBVztJQUNYLGVBQWU7SUFDZixhQUFhO0lBQ2IsWUFBWTtJQUNaLG1CQUFtQjtJQUNuQixvQkFBb0I7SUFFcEIsZ0JBQWdCO0lBQ2hCLE9BQU87SUFDUCxnQkFBZ0I7SUFFaEIsMEJBQTBCO0lBQzFCLFVBQVU7SUFDVixVQUFVO0lBQ1Ysa0JBQWtCO0lBRWxCLDZCQUE2QjtJQUM3QixhQUFhO0NBQ2QsQ0FBQztBQUVGLGdFQUFnRTtBQUNoRSxNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBRztJQUNqQyxTQUFTLENBQUMsS0FBSztJQUNmLFNBQVMsQ0FBQyxJQUFJO0lBQ2QsU0FBUyxDQUFDLEtBQUs7SUFDZixTQUFTLENBQUMsSUFBSTtJQUNkLFNBQVMsQ0FBQyxNQUFNO0NBQ2pCLENBQUM7QUFFRjs7OztHQUlHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxTQUFpQixFQUFFLEVBQUUsQ0FDdEQsbUJBQW1CLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUU5QyxrREFBa0Q7QUFDbEQsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLEdBQUcsa0JBQWtCLEVBQUUsR0FBRyxtQkFBbUIsQ0FBQyxDQUFDO0FBRTFFOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxTQUFpQixFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8qXG4gKiBOYW1lcyBvZiBldmVudHMgdGhhdCBhcmUgc3BlY2lhbCB0byBqc2FjdGlvbi4gVGhlc2UgYXJlIG5vdCBhbGxcbiAqIGV2ZW50IHR5cGVzIHRoYXQgYXJlIGxlZ2FsIHRvIHVzZSBpbiBlaXRoZXIgSFRNTCBvciB0aGUgYWRkRXZlbnQoKVxuICogQVBJLCBidXQgdGhlc2UgYXJlIHRoZSBvbmVzIHRoYXQgYXJlIHRyZWF0ZWQgc3BlY2lhbGx5LiBBbGwgb3RoZXJcbiAqIERPTSBldmVudHMgY2FuIGJlIHVzZWQgaW4gZWl0aGVyIGFkZEV2ZW50KCkgb3IgaW4gdGhlIHZhbHVlIG9mIHRoZVxuICoganNhY3Rpb24gYXR0cmlidXRlLiBCZXdhcmUgb2YgYnJvd3NlciBzcGVjaWZpYyBldmVudHMgb3IgZXZlbnRzXG4gKiB0aGF0IGRvbid0IGJ1YmJsZSB0aG91Z2g6IElmIHRoZXkgYXJlIG5vdCBtZW50aW9uZWQgaGVyZSwgdGhlblxuICogZXZlbnQgY29udHJhY3QgZG9lc24ndCB3b3JrIGFyb3VuZCB0aGVpciBwZWN1bGlhcml0aWVzLlxuICovXG5leHBvcnQgY29uc3QgRXZlbnRUeXBlID0ge1xuICAvKipcbiAgICogTW91c2UgbWlkZGxlIGNsaWNrLCBpbnRyb2R1Y2VkIGluIENocm9tZSA1NSBhbmQgbm90IHlldCBzdXBwb3J0ZWQgb25cbiAgICogb3RoZXIgYnJvd3NlcnMuXG4gICAqL1xuICBBVVhDTElDSzogJ2F1eGNsaWNrJyxcblxuICAvKipcbiAgICogVGhlIGNoYW5nZSBldmVudCBmaXJlZCBieSBicm93c2VycyB3aGVuIHRoZSBgdmFsdWVgIGF0dHJpYnV0ZSBvZiBpbnB1dCxcbiAgICogc2VsZWN0LCBhbmQgdGV4dGFyZWEgZWxlbWVudHMgYXJlIGNoYW5nZWQuXG4gICAqL1xuICBDSEFOR0U6ICdjaGFuZ2UnLFxuXG4gIC8qKlxuICAgKiBUaGUgY2xpY2sgZXZlbnQuIEluIGFkZEV2ZW50KCkgcmVmZXJzIHRvIGFsbCBjbGljayBldmVudHMsIGluIHRoZVxuICAgKiBqc2FjdGlvbiBhdHRyaWJ1dGUgaXQgcmVmZXJzIHRvIHRoZSB1bm1vZGlmaWVkIGNsaWNrIGFuZCBFbnRlci9TcGFjZVxuICAgKiBrZXlwcmVzcyBldmVudHMuICBJbiB0aGUgbGF0dGVyIGNhc2UsIGEganNhY3Rpb24gY2xpY2sgd2lsbCBiZSB0cmlnZ2VyZWQsXG4gICAqIGZvciBhY2Nlc3NpYmlsaXR5IHJlYXNvbnMuICBTZWUgY2xpY2ttb2QgYW5kIGNsaWNrb25seSwgYmVsb3cuXG4gICAqL1xuICBDTElDSzogJ2NsaWNrJyxcblxuICAvKipcbiAgICogU3BlY2lmaWVzIHRoZSBqc2FjdGlvbiBmb3IgYSBtb2RpZmllZCBjbGljayBldmVudCAoaS5lLiBhIG1vdXNlXG4gICAqIGNsaWNrIHdpdGggdGhlIG1vZGlmaWVyIGtleSBDbWQvQ3RybCBwcmVzc2VkKS4gVGhpcyBldmVudCBpc24ndFxuICAgKiBzZXBhcmF0ZWx5IGVuYWJsZWQgaW4gYWRkRXZlbnQoKSwgYmVjYXVzZSBpbiB0aGUgRE9NLCBpdCdzIGp1c3QgYVxuICAgKiBjbGljayBldmVudC5cbiAgICovXG4gIENMSUNLTU9EOiAnY2xpY2ttb2QnLFxuXG4gIC8qKlxuICAgKiBTcGVjaWZpZXMgdGhlIGpzYWN0aW9uIGZvciBhIGNsaWNrLW9ubHkgZXZlbnQuICBDbGljay1vbmx5IGRvZXNuJ3QgdGFrZVxuICAgKiBpbnRvIGFjY291bnQgdGhlIGNhc2Ugd2hlcmUgYW4gZWxlbWVudCB3aXRoIGZvY3VzIHJlY2VpdmVzIGFuIEVudGVyL1NwYWNlXG4gICAqIGtleXByZXNzLiAgVGhpcyBldmVudCBpc24ndCBzZXBhcmF0ZWx5IGVuYWJsZWQgaW4gYWRkRXZlbnQoKS5cbiAgICovXG4gIENMSUNLT05MWTogJ2NsaWNrb25seScsXG5cbiAgLyoqXG4gICAqIFRoZSBkYmxjbGljayBldmVudC5cbiAgICovXG4gIERCTENMSUNLOiAnZGJsY2xpY2snLFxuXG4gIC8qKlxuICAgKiBGb2N1cyBkb2Vzbid0IGJ1YmJsZSwgYnV0IHlvdSBjYW4gdXNlIGl0IGluIGFkZEV2ZW50KCkgYW5kXG4gICAqIGpzYWN0aW9uIGFueXdheS4gRXZlbnRDb250cmFjdCBkb2VzIHRoZSByaWdodCB0aGluZyB1bmRlciB0aGVcbiAgICogaG9vZC5cbiAgICovXG4gIEZPQ1VTOiAnZm9jdXMnLFxuXG4gIC8qKlxuICAgKiBUaGlzIGV2ZW50IG9ubHkgZXhpc3RzIGluIElFLiBGb3IgYWRkRXZlbnQoKSBhbmQganNhY3Rpb24sIHVzZVxuICAgKiBmb2N1cyBpbnN0ZWFkOyBFdmVudENvbnRyYWN0IGRvZXMgdGhlIHJpZ2h0IHRoaW5nIGV2ZW4gdGhvdWdoXG4gICAqIGZvY3VzIGRvZXNuJ3QgYnViYmxlLlxuICAgKi9cbiAgRk9DVVNJTjogJ2ZvY3VzaW4nLFxuXG4gIC8qKlxuICAgKiBBbmFsb2cgdG8gZm9jdXMuXG4gICAqL1xuICBCTFVSOiAnYmx1cicsXG5cbiAgLyoqXG4gICAqIEFuYWxvZyB0byBmb2N1c2luLlxuICAgKi9cbiAgRk9DVVNPVVQ6ICdmb2N1c291dCcsXG5cbiAgLyoqXG4gICAqIFN1Ym1pdCBkb2Vzbid0IGJ1YmJsZSwgc28gaXQgY2Fubm90IGJlIHVzZWQgd2l0aCBldmVudFxuICAgKiBjb250cmFjdC4gSG93ZXZlciwgdGhlIGJyb3dzZXIgaGVscGZ1bGx5IGZpcmVzIGEgY2xpY2sgZXZlbnQgb25cbiAgICogdGhlIHN1Ym1pdCBidXR0b24gb2YgYSBmb3JtIChldmVuIGlmIHRoZSBmb3JtIGlzIG5vdCBzdWJtaXR0ZWQgYnlcbiAgICogYSBjbGljayBvbiB0aGUgc3VibWl0IGJ1dHRvbikuIFNvIHlvdSBzaG91bGQgaGFuZGxlIGNsaWNrIG9uIHRoZVxuICAgKiBzdWJtaXQgYnV0dG9uIGluc3RlYWQuXG4gICAqL1xuICBTVUJNSVQ6ICdzdWJtaXQnLFxuXG4gIC8qKlxuICAgKiBUaGUga2V5ZG93biBldmVudC4gSW4gYWRkRXZlbnQoKSBhbmQgbm9uLWNsaWNrIGpzYWN0aW9uIGl0IHJlcHJlc2VudHMgdGhlXG4gICAqIHJlZ3VsYXIgRE9NIGtleWRvd24gZXZlbnQuIEl0IHJlcHJlc2VudHMgY2xpY2sgYWN0aW9ucyBpbiBub24tR2Vja29cbiAgICogYnJvd3NlcnMuXG4gICAqL1xuICBLRVlET1dOOiAna2V5ZG93bicsXG5cbiAgLyoqXG4gICAqIFRoZSBrZXlwcmVzcyBldmVudC4gSW4gYWRkRXZlbnQoKSBhbmQgbm9uLWNsaWNrIGpzYWN0aW9uIGl0IHJlcHJlc2VudHMgdGhlXG4gICAqIHJlZ3VsYXIgRE9NIGtleXByZXNzIGV2ZW50LiBJdCByZXByZXNlbnRzIGNsaWNrIGFjdGlvbnMgaW4gR2Vja28gYnJvd3NlcnMuXG4gICAqL1xuICBLRVlQUkVTUzogJ2tleXByZXNzJyxcblxuICAvKipcbiAgICogVGhlIGtleXVwIGV2ZW50LiBJbiBhZGRFdmVudCgpIGFuZCBub24tY2xpY2sganNhY3Rpb24gaXQgcmVwcmVzZW50cyB0aGVcbiAgICogcmVndWxhciBET00ga2V5dXAgZXZlbnQuIEl0IHJlcHJlc2VudHMgY2xpY2sgYWN0aW9ucyBpbiBub24tR2Vja29cbiAgICogYnJvd3NlcnMuXG4gICAqL1xuICBLRVlVUDogJ2tleXVwJyxcblxuICAvKipcbiAgICogVGhlIG1vdXNldXAgZXZlbnQuIENhbiBlaXRoZXIgYmUgdXNlZCBkaXJlY3RseSBvciB1c2VkIGltcGxpY2l0bHkgdG9cbiAgICogY2FwdHVyZSBtb3VzZXVwIGV2ZW50cy4gSW4gYWRkRXZlbnQoKSwgaXQgcmVwcmVzZW50cyBhIHJlZ3VsYXIgRE9NXG4gICAqIG1vdXNldXAgZXZlbnQuXG4gICAqL1xuICBNT1VTRVVQOiAnbW91c2V1cCcsXG5cbiAgLyoqXG4gICAqIFRoZSBtb3VzZWRvd24gZXZlbnQuIENhbiBlaXRoZXIgYmUgdXNlZCBkaXJlY3RseSBvciB1c2VkIGltcGxpY2l0bHkgdG9cbiAgICogY2FwdHVyZSBtb3VzZWVudGVyIGV2ZW50cy4gSW4gYWRkRXZlbnQoKSwgaXQgcmVwcmVzZW50cyBhIHJlZ3VsYXIgRE9NXG4gICAqIG1vdXNlb3ZlciBldmVudC5cbiAgICovXG4gIE1PVVNFRE9XTjogJ21vdXNlZG93bicsXG5cbiAgLyoqXG4gICAqIFRoZSBtb3VzZW92ZXIgZXZlbnQuIENhbiBlaXRoZXIgYmUgdXNlZCBkaXJlY3RseSBvciB1c2VkIGltcGxpY2l0bHkgdG9cbiAgICogY2FwdHVyZSBtb3VzZWVudGVyIGV2ZW50cy4gSW4gYWRkRXZlbnQoKSwgaXQgcmVwcmVzZW50cyBhIHJlZ3VsYXIgRE9NXG4gICAqIG1vdXNlb3ZlciBldmVudC5cbiAgICovXG4gIE1PVVNFT1ZFUjogJ21vdXNlb3ZlcicsXG5cbiAgLyoqXG4gICAqIFRoZSBtb3VzZW91dCBldmVudC4gQ2FuIGVpdGhlciBiZSB1c2VkIGRpcmVjdGx5IG9yIHVzZWQgaW1wbGljaXRseSB0b1xuICAgKiBjYXB0dXJlIG1vdXNlb3ZlciBldmVudHMuIEluIGFkZEV2ZW50KCksIGl0IHJlcHJlc2VudHMgYSByZWd1bGFyIERPTVxuICAgKiBtb3VzZW91dCBldmVudC5cbiAgICovXG4gIE1PVVNFT1VUOiAnbW91c2VvdXQnLFxuXG4gIC8qKlxuICAgKiBUaGUgbW91c2VlbnRlciBldmVudC4gRG9lcyBub3QgYnViYmxlIGFuZCBmaXJlcyBpbmRpdmlkdWFsbHkgb24gZWFjaFxuICAgKiBlbGVtZW50IGJlaW5nIGVudGVyZWQgd2l0aGluIGEgRE9NIHRyZWUuXG4gICAqL1xuICBNT1VTRUVOVEVSOiAnbW91c2VlbnRlcicsXG5cbiAgLyoqXG4gICAqIFRoZSBtb3VzZWxlYXZlIGV2ZW50LiBEb2VzIG5vdCBidWJibGUgYW5kIGZpcmVzIGluZGl2aWR1YWxseSBvbiBlYWNoXG4gICAqIGVsZW1lbnQgYmVpbmcgZW50ZXJlZCB3aXRoaW4gYSBET00gdHJlZS5cbiAgICovXG4gIE1PVVNFTEVBVkU6ICdtb3VzZWxlYXZlJyxcblxuICAvKipcbiAgICogVGhlIG1vdXNlbW92ZSBldmVudC5cbiAgICovXG4gIE1PVVNFTU9WRTogJ21vdXNlbW92ZScsXG5cbiAgLyoqXG4gICAqIFRoZSBwb2ludGVydXAgZXZlbnQuIENhbiBlaXRoZXIgYmUgdXNlZCBkaXJlY3RseSBvciB1c2VkIGltcGxpY2l0bHkgdG9cbiAgICogY2FwdHVyZSBwb2ludGVydXAgZXZlbnRzLiBJbiBhZGRFdmVudCgpLCBpdCByZXByZXNlbnRzIGEgcmVndWxhciBET01cbiAgICogcG9pbnRlcnVwIGV2ZW50LlxuICAgKi9cbiAgUE9JTlRFUlVQOiAncG9pbnRlcnVwJyxcblxuICAvKipcbiAgICogVGhlIHBvaW50ZXJkb3duIGV2ZW50LiBDYW4gZWl0aGVyIGJlIHVzZWQgZGlyZWN0bHkgb3IgdXNlZCBpbXBsaWNpdGx5IHRvXG4gICAqIGNhcHR1cmUgcG9pbnRlcmVudGVyIGV2ZW50cy4gSW4gYWRkRXZlbnQoKSwgaXQgcmVwcmVzZW50cyBhIHJlZ3VsYXIgRE9NXG4gICAqIG1vdXNlb3ZlciBldmVudC5cbiAgICovXG4gIFBPSU5URVJET1dOOiAncG9pbnRlcmRvd24nLFxuXG4gIC8qKlxuICAgKiBUaGUgcG9pbnRlcm92ZXIgZXZlbnQuIENhbiBlaXRoZXIgYmUgdXNlZCBkaXJlY3RseSBvciB1c2VkIGltcGxpY2l0bHkgdG9cbiAgICogY2FwdHVyZSBwb2ludGVyZW50ZXIgZXZlbnRzLiBJbiBhZGRFdmVudCgpLCBpdCByZXByZXNlbnRzIGEgcmVndWxhciBET01cbiAgICogcG9pbnRlcm92ZXIgZXZlbnQuXG4gICAqL1xuICBQT0lOVEVST1ZFUjogJ3BvaW50ZXJvdmVyJyxcblxuICAvKipcbiAgICogVGhlIHBvaW50ZXJvdXQgZXZlbnQuIENhbiBlaXRoZXIgYmUgdXNlZCBkaXJlY3RseSBvciB1c2VkIGltcGxpY2l0bHkgdG9cbiAgICogY2FwdHVyZSBwb2ludGVyb3ZlciBldmVudHMuIEluIGFkZEV2ZW50KCksIGl0IHJlcHJlc2VudHMgYSByZWd1bGFyIERPTVxuICAgKiBwb2ludGVyb3V0IGV2ZW50LlxuICAgKi9cbiAgUE9JTlRFUk9VVDogJ3BvaW50ZXJvdXQnLFxuXG4gIC8qKlxuICAgKiBUaGUgcG9pbnRlcmVudGVyIGV2ZW50LiBEb2VzIG5vdCBidWJibGUgYW5kIGZpcmVzIGluZGl2aWR1YWxseSBvbiBlYWNoXG4gICAqIGVsZW1lbnQgYmVpbmcgZW50ZXJlZCB3aXRoaW4gYSBET00gdHJlZS5cbiAgICovXG4gIFBPSU5URVJFTlRFUjogJ3BvaW50ZXJlbnRlcicsXG5cbiAgLyoqXG4gICAqIFRoZSBwb2ludGVybGVhdmUgZXZlbnQuIERvZXMgbm90IGJ1YmJsZSBhbmQgZmlyZXMgaW5kaXZpZHVhbGx5IG9uIGVhY2hcbiAgICogZWxlbWVudCBiZWluZyBlbnRlcmVkIHdpdGhpbiBhIERPTSB0cmVlLlxuICAgKi9cbiAgUE9JTlRFUkxFQVZFOiAncG9pbnRlcmxlYXZlJyxcblxuICAvKipcbiAgICogVGhlIHBvaW50ZXJtb3ZlIGV2ZW50LlxuICAgKi9cbiAgUE9JTlRFUk1PVkU6ICdwb2ludGVybW92ZScsXG5cbiAgLyoqXG4gICAqIFRoZSBwb2ludGVyY2FuY2VsIGV2ZW50LlxuICAgKi9cbiAgUE9JTlRFUkNBTkNFTDogJ3BvaW50ZXJjYW5jZWwnLFxuXG4gIC8qKlxuICAgKiBUaGUgZ290cG9pbnRlcmNhcHR1cmUgZXZlbnQgaXMgZmlyZWQgd2hlblxuICAgKiBFbGVtZW50LnNldFBvaW50ZXJDYXB0dXJlKHBvaW50ZXJJZCkgaXMgY2FsbGVkIG9uIGEgbW91c2UgaW5wdXQsIG9yXG4gICAqIGltcGxpY2l0bHkgd2hlbiBhIHRvdWNoIGlucHV0IGJlZ2lucy5cbiAgICovXG4gIEdPVFBPSU5URVJDQVBUVVJFOiAnZ290cG9pbnRlcmNhcHR1cmUnLFxuXG4gIC8qKlxuICAgKiBUaGUgbG9zdHBvaW50ZXJjYXB0dXJlIGV2ZW50IGlzIGZpcmVkIHdoZW5cbiAgICogRWxlbWVudC5yZWxlYXNlUG9pbnRlckNhcHR1cmUocG9pbnRlcklkKSBpcyBjYWxsZWQsIG9yIGltcGxpY2l0bHkgYWZ0ZXIgYVxuICAgKiB0b3VjaCBpbnB1dCBlbmRzLlxuICAgKi9cbiAgTE9TVFBPSU5URVJDQVBUVVJFOiAnbG9zdHBvaW50ZXJjYXB0dXJlJyxcblxuICAvKipcbiAgICogVGhlIGVycm9yIGV2ZW50LiBUaGUgZXJyb3IgZXZlbnQgZG9lc24ndCBidWJibGUsIGJ1dCB5b3UgY2FuIHVzZSBpdCBpblxuICAgKiBhZGRFdmVudCgpIGFuZCBqc2FjdGlvbiBhbnl3YXkuIEV2ZW50Q29udHJhY3QgZG9lcyB0aGUgcmlnaHQgdGhpbmcgdW5kZXJcbiAgICogdGhlIGhvb2QgKGV4Y2VwdCBpbiBJRTggd2hpY2ggZG9lcyBub3QgdXNlIGVycm9yIGV2ZW50cykuXG4gICAqL1xuICBFUlJPUjogJ2Vycm9yJyxcblxuICAvKipcbiAgICogVGhlIGxvYWQgZXZlbnQuIFRoZSBsb2FkIGV2ZW50IGRvZXNuJ3QgYnViYmxlLCBidXQgeW91IGNhbiB1c2UgaXQgaW5cbiAgICogYWRkRXZlbnQoKSBhbmQganNhY3Rpb24gYW55d2F5LiBFdmVudENvbnRyYWN0IGRvZXMgdGhlIHJpZ2h0IHRoaW5nXG4gICAqIHVuZGVyIHRoZSBob29kLlxuICAgKi9cbiAgTE9BRDogJ2xvYWQnLFxuXG4gIC8qKlxuICAgKiBUaGUgdW5sb2FkIGV2ZW50LlxuICAgKi9cbiAgVU5MT0FEOiAndW5sb2FkJyxcblxuICAvKipcbiAgICogVGhlIHRvdWNoc3RhcnQgZXZlbnQuIEJ1YmJsZXMsIHdpbGwgb25seSBldmVyIGZpcmUgaW4gYnJvd3NlcnMgd2l0aFxuICAgKiB0b3VjaCBzdXBwb3J0LlxuICAgKi9cbiAgVE9VQ0hTVEFSVDogJ3RvdWNoc3RhcnQnLFxuXG4gIC8qKlxuICAgKiBUaGUgdG91Y2hlbmQgZXZlbnQuIEJ1YmJsZXMsIHdpbGwgb25seSBldmVyIGZpcmUgaW4gYnJvd3NlcnMgd2l0aFxuICAgKiB0b3VjaCBzdXBwb3J0LlxuICAgKi9cbiAgVE9VQ0hFTkQ6ICd0b3VjaGVuZCcsXG5cbiAgLyoqXG4gICAqIFRoZSB0b3VjaG1vdmUgZXZlbnQuIEJ1YmJsZXMsIHdpbGwgb25seSBldmVyIGZpcmUgaW4gYnJvd3NlcnMgd2l0aFxuICAgKiB0b3VjaCBzdXBwb3J0LlxuICAgKi9cbiAgVE9VQ0hNT1ZFOiAndG91Y2htb3ZlJyxcblxuICAvKipcbiAgICogVGhlIGlucHV0IGV2ZW50LlxuICAgKi9cbiAgSU5QVVQ6ICdpbnB1dCcsXG5cbiAgLyoqXG4gICAqIFRoZSBzY3JvbGwgZXZlbnQuXG4gICAqL1xuICBTQ1JPTEw6ICdzY3JvbGwnLFxuXG4gIC8qKlxuICAgKiBUaGUgdG9nZ2xlIGV2ZW50LiBUaGUgdG9nZ2xlIGV2ZW50IGRvZXNuJ3QgYnViYmxlLCBidXQgeW91IGNhbiB1c2UgaXQgaW5cbiAgICogYWRkRXZlbnQoKSBhbmQganNhY3Rpb24gYW55d2F5LiBFdmVudENvbnRyYWN0IGRvZXMgdGhlIHJpZ2h0IHRoaW5nXG4gICAqIHVuZGVyIHRoZSBob29kLlxuICAgKi9cbiAgVE9HR0xFOiAndG9nZ2xlJyxcblxuICAvKipcbiAgICogQSBjdXN0b20gZXZlbnQuIFRoZSBhY3R1YWwgY3VzdG9tIGV2ZW50IHR5cGUgaXMgZGVjbGFyZWQgYXMgdGhlICd0eXBlJ1xuICAgKiBmaWVsZCBpbiB0aGUgZXZlbnQgZGV0YWlscy4gU3VwcG9ydGVkIGluIEZpcmVmb3ggNissIElFIDkrLCBhbmQgYWxsIENocm9tZVxuICAgKiB2ZXJzaW9ucy5cbiAgICpcbiAgICogVGhpcyBpcyBhbiBpbnRlcm5hbCBuYW1lLiBVc2VycyBzaG91bGQgdXNlIGpzYWN0aW9uJ3MgZmlyZUN1c3RvbUV2ZW50IHRvXG4gICAqIGZpcmUgY3VzdG9tIGV2ZW50cyBpbnN0ZWFkIG9mIHJlbHlpbmcgb24gdGhpcyB0eXBlIHRvIGNyZWF0ZSB0aGVtLlxuICAgKi9cbiAgQ1VTVE9NOiAnX2N1c3RvbScsXG59O1xuXG4vKiogQWxsIGV2ZW50IHR5cGVzIHRoYXQgZG8gbm90IGJ1YmJsZSBvciBjYXB0dXJlIGFuZCBuZWVkIGEgcG9seWZpbGwuICovXG5leHBvcnQgY29uc3QgTU9VU0VfU1BFQ0lBTF9FVkVOVF9UWVBFUyA9IFtcbiAgRXZlbnRUeXBlLk1PVVNFRU5URVIsXG4gIEV2ZW50VHlwZS5NT1VTRUxFQVZFLFxuICAncG9pbnRlcmVudGVyJyxcbiAgJ3BvaW50ZXJsZWF2ZScsXG5dO1xuXG4vKiogQWxsIGV2ZW50IHR5cGVzIHRoYXQgYXJlIHJlZ2lzdGVyZWQgaW4gdGhlIGJ1YmJsZSBwaGFzZS4gKi9cbmV4cG9ydCBjb25zdCBCVUJCTEVfRVZFTlRfVFlQRVMgPSBbXG4gIEV2ZW50VHlwZS5DTElDSyxcbiAgRXZlbnRUeXBlLkRCTENMSUNLLFxuICBFdmVudFR5cGUuRk9DVVNJTixcbiAgRXZlbnRUeXBlLkZPQ1VTT1VULFxuICBFdmVudFR5cGUuS0VZRE9XTixcbiAgRXZlbnRUeXBlLktFWVVQLFxuICBFdmVudFR5cGUuS0VZUFJFU1MsXG4gIEV2ZW50VHlwZS5NT1VTRU9WRVIsXG4gIEV2ZW50VHlwZS5NT1VTRU9VVCxcbiAgRXZlbnRUeXBlLlNVQk1JVCxcbiAgRXZlbnRUeXBlLlRPVUNIU1RBUlQsXG4gIEV2ZW50VHlwZS5UT1VDSEVORCxcbiAgRXZlbnRUeXBlLlRPVUNITU9WRSxcbiAgJ3RvdWNoY2FuY2VsJyxcblxuICAnYXV4Y2xpY2snLFxuICAnY2hhbmdlJyxcbiAgJ2NvbXBvc2l0aW9uc3RhcnQnLFxuICAnY29tcG9zaXRpb251cGRhdGUnLFxuICAnY29tcG9zaXRpb25lbmQnLFxuICAnYmVmb3JlaW5wdXQnLFxuICAnaW5wdXQnLFxuICAnc2VsZWN0JyxcblxuICAnY29weScsXG4gICdjdXQnLFxuICAncGFzdGUnLFxuICAnbW91c2Vkb3duJyxcbiAgJ21vdXNldXAnLFxuICAnd2hlZWwnLFxuICAnY29udGV4dG1lbnUnLFxuXG4gICdkcmFnb3ZlcicsXG4gICdkcmFnZW50ZXInLFxuICAnZHJhZ2xlYXZlJyxcbiAgJ2Ryb3AnLFxuICAnZHJhZ3N0YXJ0JyxcbiAgJ2RyYWdlbmQnLFxuXG4gICdwb2ludGVyZG93bicsXG4gICdwb2ludGVybW92ZScsXG4gICdwb2ludGVydXAnLFxuICAncG9pbnRlcmNhbmNlbCcsXG4gICdwb2ludGVyb3ZlcicsXG4gICdwb2ludGVyb3V0JyxcbiAgJ2dvdHBvaW50ZXJjYXB0dXJlJyxcbiAgJ2xvc3Rwb2ludGVyY2FwdHVyZScsXG5cbiAgLy8gVmlkZW8gZXZlbnRzLlxuICAnZW5kZWQnLFxuICAnbG9hZGVkbWV0YWRhdGEnLFxuXG4gIC8vIFBhZ2UgdmlzaWJpbGl0eSBldmVudHMuXG4gICdwYWdlaGlkZScsXG4gICdwYWdlc2hvdycsXG4gICd2aXNpYmlsaXR5Y2hhbmdlJyxcblxuICAvLyBDb250ZW50IHZpc2liaWxpdHkgZXZlbnRzLlxuICAnYmVmb3JlbWF0Y2gnLFxuXTtcblxuLyoqIEFsbCBldmVudCB0eXBlcyB0aGF0IGFyZSByZWdpc3RlcmVkIGluIHRoZSBjYXB0dXJlIHBoYXNlLiAqL1xuZXhwb3J0IGNvbnN0IENBUFRVUkVfRVZFTlRfVFlQRVMgPSBbXG4gIEV2ZW50VHlwZS5GT0NVUyxcbiAgRXZlbnRUeXBlLkJMVVIsXG4gIEV2ZW50VHlwZS5FUlJPUixcbiAgRXZlbnRUeXBlLkxPQUQsXG4gIEV2ZW50VHlwZS5UT0dHTEUsXG5dO1xuXG4vKipcbiAqIFdoZXRoZXIgb3Igbm90IGFuIGV2ZW50IHR5cGUgc2hvdWxkIGJlIHJlZ2lzdGVyZWQgaW4gdGhlIGNhcHR1cmUgcGhhc2UuXG4gKiBAcGFyYW0gZXZlbnRUeXBlXG4gKiBAcmV0dXJucyBib29sXG4gKi9cbmV4cG9ydCBjb25zdCBpc0NhcHR1cmVFdmVudFR5cGUgPSAoZXZlbnRUeXBlOiBzdHJpbmcpID0+XG4gIENBUFRVUkVfRVZFTlRfVFlQRVMuaW5kZXhPZihldmVudFR5cGUpID49IDA7XG5cbi8qKiBBbGwgZXZlbnQgdHlwZXMgdGhhdCBhcmUgcmVnaXN0ZXJlZCBlYXJseS4gICovXG5jb25zdCBFQVJMWV9FVkVOVF9UWVBFUyA9IFsuLi5CVUJCTEVfRVZFTlRfVFlQRVMsIC4uLkNBUFRVUkVfRVZFTlRfVFlQRVNdO1xuXG4vKipcbiAqIFdoZXRoZXIgb3Igbm90IGFuIGV2ZW50IHR5cGUgaXMgcmVnaXN0ZXJlZCBpbiB0aGUgZWFybHkgY29udHJhY3QuXG4gKi9cbmV4cG9ydCBjb25zdCBpc0Vhcmx5RXZlbnRUeXBlID0gKGV2ZW50VHlwZTogc3RyaW5nKSA9PiBFQVJMWV9FVkVOVF9UWVBFUy5pbmRleE9mKGV2ZW50VHlwZSkgPj0gMDtcbiJdfQ==