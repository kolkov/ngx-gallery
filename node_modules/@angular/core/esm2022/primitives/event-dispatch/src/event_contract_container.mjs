/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as eventLib from './event';
/**
 * Whether the user agent is running on iOS.
 */
const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
/**
 * A class representing a container node and all the event handlers
 * installed on it. Used so that handlers can be cleaned up if the
 * container is removed from the contract.
 */
export class EventContractContainer {
    /**
     * @param element The container Element.
     */
    constructor(element) {
        this.element = element;
        /**
         * Array of event handlers and their corresponding event types that are
         * installed on this container.
         *
         */
        this.handlerInfos = [];
    }
    /**
     * Installs the provided installer on the element owned by this container,
     * and maintains a reference to resulting handler in order to remove it
     * later if desired.
     */
    addEventListener(eventType, getHandler) {
        // In iOS, event bubbling doesn't happen automatically in any DOM element,
        // unless it has an onclick attribute or DOM event handler attached to it.
        // This breaks JsAction in some cases. See "Making Elements Clickable"
        // section at http://goo.gl/2VoGnB.
        //
        // A workaround for this issue is to change the CSS cursor style to 'pointer'
        // for the container element, which magically turns on event bubbling. This
        // solution is described in the comments section at http://goo.gl/6pEO1z.
        //
        // We use a navigator.userAgent check here as this problem is present both
        // on Mobile Safari and thin WebKit wrappers, such as Chrome for iOS.
        if (isIos) {
            this.element.style.cursor = 'pointer';
        }
        this.handlerInfos.push(eventLib.addEventListener(this.element, eventType, getHandler(this.element)));
    }
    /**
     * Removes all the handlers installed on this container.
     */
    cleanUp() {
        for (let i = 0; i < this.handlerInfos.length; i++) {
            eventLib.removeEventListener(this.element, this.handlerInfos[i]);
        }
        this.handlerInfos = [];
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRfY29udHJhY3RfY29udGFpbmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9wcmltaXRpdmVzL2V2ZW50LWRpc3BhdGNoL3NyYy9ldmVudF9jb250cmFjdF9jb250YWluZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxLQUFLLFFBQVEsTUFBTSxTQUFTLENBQUM7QUFnQnBDOztHQUVHO0FBQ0gsTUFBTSxLQUFLLEdBQUcsT0FBTyxTQUFTLEtBQUssV0FBVyxJQUFJLGtCQUFrQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUM7QUFFL0Y7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyxzQkFBc0I7SUFRakM7O09BRUc7SUFDSCxZQUFxQixPQUFnQjtRQUFoQixZQUFPLEdBQVAsT0FBTyxDQUFTO1FBVnJDOzs7O1dBSUc7UUFDSyxpQkFBWSxHQUF1QixFQUFFLENBQUM7SUFLTixDQUFDO0lBRXpDOzs7O09BSUc7SUFDSCxnQkFBZ0IsQ0FBQyxTQUFpQixFQUFFLFVBQXdEO1FBQzFGLDBFQUEwRTtRQUMxRSwwRUFBMEU7UUFDMUUsc0VBQXNFO1FBQ3RFLG1DQUFtQztRQUNuQyxFQUFFO1FBQ0YsNkVBQTZFO1FBQzdFLDJFQUEyRTtRQUMzRSx5RUFBeUU7UUFDekUsRUFBRTtRQUNGLDBFQUEwRTtRQUMxRSxxRUFBcUU7UUFDckUsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNULElBQUksQ0FBQyxPQUF1QixDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDO1FBQ3pELENBQUM7UUFDRCxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FDcEIsUUFBUSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FDN0UsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILE9BQU87UUFDTCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNsRCxRQUFRLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkUsQ0FBQztRQUVELElBQUksQ0FBQyxZQUFZLEdBQUcsRUFBRSxDQUFDO0lBQ3pCLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBldmVudExpYiBmcm9tICcuL2V2ZW50JztcbmltcG9ydCB7RXZlbnRIYW5kbGVySW5mb30gZnJvbSAnLi9ldmVudF9oYW5kbGVyJztcblxuLyoqXG4gKiBBbiBgRXZlbnRDb250cmFjdENvbnRhaW5lck1hbmFnZXJgIHByb3ZpZGVzIHRoZSBjb21tb24gaW50ZXJmYWNlIGZvciBtYW5hZ2luZ1xuICogY29udGFpbmVycy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBFdmVudENvbnRyYWN0Q29udGFpbmVyTWFuYWdlciB7XG4gIGFkZEV2ZW50TGlzdGVuZXIoXG4gICAgZXZlbnRUeXBlOiBzdHJpbmcsXG4gICAgZ2V0SGFuZGxlcjogKGVsZW1lbnQ6IEVsZW1lbnQpID0+IChldmVudDogRXZlbnQpID0+IHZvaWQsXG4gICk6IHZvaWQ7XG5cbiAgY2xlYW5VcCgpOiB2b2lkO1xufVxuXG4vKipcbiAqIFdoZXRoZXIgdGhlIHVzZXIgYWdlbnQgaXMgcnVubmluZyBvbiBpT1MuXG4gKi9cbmNvbnN0IGlzSW9zID0gdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgL2lQaG9uZXxpUGFkfGlQb2QvLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XG5cbi8qKlxuICogQSBjbGFzcyByZXByZXNlbnRpbmcgYSBjb250YWluZXIgbm9kZSBhbmQgYWxsIHRoZSBldmVudCBoYW5kbGVyc1xuICogaW5zdGFsbGVkIG9uIGl0LiBVc2VkIHNvIHRoYXQgaGFuZGxlcnMgY2FuIGJlIGNsZWFuZWQgdXAgaWYgdGhlXG4gKiBjb250YWluZXIgaXMgcmVtb3ZlZCBmcm9tIHRoZSBjb250cmFjdC5cbiAqL1xuZXhwb3J0IGNsYXNzIEV2ZW50Q29udHJhY3RDb250YWluZXIgaW1wbGVtZW50cyBFdmVudENvbnRyYWN0Q29udGFpbmVyTWFuYWdlciB7XG4gIC8qKlxuICAgKiBBcnJheSBvZiBldmVudCBoYW5kbGVycyBhbmQgdGhlaXIgY29ycmVzcG9uZGluZyBldmVudCB0eXBlcyB0aGF0IGFyZVxuICAgKiBpbnN0YWxsZWQgb24gdGhpcyBjb250YWluZXIuXG4gICAqXG4gICAqL1xuICBwcml2YXRlIGhhbmRsZXJJbmZvczogRXZlbnRIYW5kbGVySW5mb1tdID0gW107XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBlbGVtZW50IFRoZSBjb250YWluZXIgRWxlbWVudC5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IGVsZW1lbnQ6IEVsZW1lbnQpIHt9XG5cbiAgLyoqXG4gICAqIEluc3RhbGxzIHRoZSBwcm92aWRlZCBpbnN0YWxsZXIgb24gdGhlIGVsZW1lbnQgb3duZWQgYnkgdGhpcyBjb250YWluZXIsXG4gICAqIGFuZCBtYWludGFpbnMgYSByZWZlcmVuY2UgdG8gcmVzdWx0aW5nIGhhbmRsZXIgaW4gb3JkZXIgdG8gcmVtb3ZlIGl0XG4gICAqIGxhdGVyIGlmIGRlc2lyZWQuXG4gICAqL1xuICBhZGRFdmVudExpc3RlbmVyKGV2ZW50VHlwZTogc3RyaW5nLCBnZXRIYW5kbGVyOiAoZWxlbWVudDogRWxlbWVudCkgPT4gKGV2ZW50OiBFdmVudCkgPT4gdm9pZCkge1xuICAgIC8vIEluIGlPUywgZXZlbnQgYnViYmxpbmcgZG9lc24ndCBoYXBwZW4gYXV0b21hdGljYWxseSBpbiBhbnkgRE9NIGVsZW1lbnQsXG4gICAgLy8gdW5sZXNzIGl0IGhhcyBhbiBvbmNsaWNrIGF0dHJpYnV0ZSBvciBET00gZXZlbnQgaGFuZGxlciBhdHRhY2hlZCB0byBpdC5cbiAgICAvLyBUaGlzIGJyZWFrcyBKc0FjdGlvbiBpbiBzb21lIGNhc2VzLiBTZWUgXCJNYWtpbmcgRWxlbWVudHMgQ2xpY2thYmxlXCJcbiAgICAvLyBzZWN0aW9uIGF0IGh0dHA6Ly9nb28uZ2wvMlZvR25CLlxuICAgIC8vXG4gICAgLy8gQSB3b3JrYXJvdW5kIGZvciB0aGlzIGlzc3VlIGlzIHRvIGNoYW5nZSB0aGUgQ1NTIGN1cnNvciBzdHlsZSB0byAncG9pbnRlcidcbiAgICAvLyBmb3IgdGhlIGNvbnRhaW5lciBlbGVtZW50LCB3aGljaCBtYWdpY2FsbHkgdHVybnMgb24gZXZlbnQgYnViYmxpbmcuIFRoaXNcbiAgICAvLyBzb2x1dGlvbiBpcyBkZXNjcmliZWQgaW4gdGhlIGNvbW1lbnRzIHNlY3Rpb24gYXQgaHR0cDovL2dvby5nbC82cEVPMXouXG4gICAgLy9cbiAgICAvLyBXZSB1c2UgYSBuYXZpZ2F0b3IudXNlckFnZW50IGNoZWNrIGhlcmUgYXMgdGhpcyBwcm9ibGVtIGlzIHByZXNlbnQgYm90aFxuICAgIC8vIG9uIE1vYmlsZSBTYWZhcmkgYW5kIHRoaW4gV2ViS2l0IHdyYXBwZXJzLCBzdWNoIGFzIENocm9tZSBmb3IgaU9TLlxuICAgIGlmIChpc0lvcykge1xuICAgICAgKHRoaXMuZWxlbWVudCBhcyBIVE1MRWxlbWVudCkuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuICAgIH1cbiAgICB0aGlzLmhhbmRsZXJJbmZvcy5wdXNoKFxuICAgICAgZXZlbnRMaWIuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIGV2ZW50VHlwZSwgZ2V0SGFuZGxlcih0aGlzLmVsZW1lbnQpKSxcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgYWxsIHRoZSBoYW5kbGVycyBpbnN0YWxsZWQgb24gdGhpcyBjb250YWluZXIuXG4gICAqL1xuICBjbGVhblVwKCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5oYW5kbGVySW5mb3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGV2ZW50TGliLnJlbW92ZUV2ZW50TGlzdGVuZXIodGhpcy5lbGVtZW50LCB0aGlzLmhhbmRsZXJJbmZvc1tpXSk7XG4gICAgfVxuXG4gICAgdGhpcy5oYW5kbGVySW5mb3MgPSBbXTtcbiAgfVxufVxuIl19