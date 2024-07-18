/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { DEHYDRATED_VIEWS } from '../render3/interfaces/container';
import { removeDehydratedViews } from './cleanup';
import { MULTIPLIER, NUM_ROOT_NODES, TEMPLATE_ID, } from './interfaces';
import { siblingAfter } from './node_lookup_utils';
/**
 * Given a current DOM node and a serialized information about the views
 * in a container, walks over the DOM structure, collecting the list of
 * dehydrated views.
 */
export function locateDehydratedViewsInContainer(currentRNode, serializedViews) {
    const dehydratedViews = [];
    for (const serializedView of serializedViews) {
        // Repeats a view multiple times as needed, based on the serialized information
        // (for example, for *ngFor-produced views).
        for (let i = 0; i < (serializedView[MULTIPLIER] ?? 1); i++) {
            const view = {
                data: serializedView,
                firstChild: null,
            };
            if (serializedView[NUM_ROOT_NODES] > 0) {
                // Keep reference to the first node in this view,
                // so it can be accessed while invoking template instructions.
                view.firstChild = currentRNode;
                // Move over to the next node after this view, which can
                // either be a first node of the next view or an anchor comment
                // node after the last view in a container.
                currentRNode = siblingAfter(serializedView[NUM_ROOT_NODES], currentRNode);
            }
            dehydratedViews.push(view);
        }
    }
    return [currentRNode, dehydratedViews];
}
/**
 * Reference to a function that searches for a matching dehydrated views
 * stored on a given lContainer.
 * Returns `null` by default, when hydration is not enabled.
 */
let _findMatchingDehydratedViewImpl = () => null;
/**
 * Retrieves the next dehydrated view from the LContainer and verifies that
 * it matches a given template id (from the TView that was used to create this
 * instance of a view). If the id doesn't match, that means that we are in an
 * unexpected state and can not complete the reconciliation process. Thus,
 * all dehydrated views from this LContainer are removed (including corresponding
 * DOM nodes) and the rendering is performed as if there were no dehydrated views
 * in this container.
 */
function findMatchingDehydratedViewImpl(lContainer, template) {
    const views = lContainer[DEHYDRATED_VIEWS];
    if (!template || views === null || views.length === 0) {
        return null;
    }
    const view = views[0];
    // Verify whether the first dehydrated view in the container matches
    // the template id passed to this function (that originated from a TView
    // that was used to create an instance of an embedded or component views.
    if (view.data[TEMPLATE_ID] === template) {
        // If the template id matches - extract the first view and return it.
        return views.shift();
    }
    else {
        // Otherwise, we are at the state when reconciliation can not be completed,
        // thus we remove all dehydrated views within this container (remove them
        // from internal data structures as well as delete associated elements from
        // the DOM tree).
        removeDehydratedViews(lContainer);
        return null;
    }
}
export function enableFindMatchingDehydratedViewImpl() {
    _findMatchingDehydratedViewImpl = findMatchingDehydratedViewImpl;
}
export function findMatchingDehydratedView(lContainer, template) {
    return _findMatchingDehydratedViewImpl(lContainer, template);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9oeWRyYXRpb24vdmlld3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGdCQUFnQixFQUFhLE1BQU0saUNBQWlDLENBQUM7QUFHN0UsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ2hELE9BQU8sRUFFTCxVQUFVLEVBQ1YsY0FBYyxFQUVkLFdBQVcsR0FDWixNQUFNLGNBQWMsQ0FBQztBQUN0QixPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFFakQ7Ozs7R0FJRztBQUNILE1BQU0sVUFBVSxnQ0FBZ0MsQ0FDOUMsWUFBbUIsRUFDbkIsZUFBMEM7SUFFMUMsTUFBTSxlQUFlLEdBQThCLEVBQUUsQ0FBQztJQUN0RCxLQUFLLE1BQU0sY0FBYyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQzdDLCtFQUErRTtRQUMvRSw0Q0FBNEM7UUFDNUMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDM0QsTUFBTSxJQUFJLEdBQTRCO2dCQUNwQyxJQUFJLEVBQUUsY0FBYztnQkFDcEIsVUFBVSxFQUFFLElBQUk7YUFDakIsQ0FBQztZQUNGLElBQUksY0FBYyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUN2QyxpREFBaUQ7Z0JBQ2pELDhEQUE4RDtnQkFDOUQsSUFBSSxDQUFDLFVBQVUsR0FBRyxZQUEyQixDQUFDO2dCQUU5Qyx3REFBd0Q7Z0JBQ3hELCtEQUErRDtnQkFDL0QsMkNBQTJDO2dCQUMzQyxZQUFZLEdBQUcsWUFBWSxDQUFDLGNBQWMsQ0FBQyxjQUFjLENBQUMsRUFBRSxZQUFZLENBQUUsQ0FBQztZQUM3RSxDQUFDO1lBQ0QsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QixDQUFDO0lBQ0gsQ0FBQztJQUVELE9BQU8sQ0FBQyxZQUFZLEVBQUUsZUFBZSxDQUFDLENBQUM7QUFDekMsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxJQUFJLCtCQUErQixHQUEwQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUM7QUFFeEY7Ozs7Ozs7O0dBUUc7QUFDSCxTQUFTLDhCQUE4QixDQUNyQyxVQUFzQixFQUN0QixRQUF1QjtJQUV2QixNQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztJQUMzQyxJQUFJLENBQUMsUUFBUSxJQUFJLEtBQUssS0FBSyxJQUFJLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUN0RCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFDRCxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdEIsb0VBQW9FO0lBQ3BFLHdFQUF3RTtJQUN4RSx5RUFBeUU7SUFDekUsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQ3hDLHFFQUFxRTtRQUNyRSxPQUFPLEtBQUssQ0FBQyxLQUFLLEVBQUcsQ0FBQztJQUN4QixDQUFDO1NBQU0sQ0FBQztRQUNOLDJFQUEyRTtRQUMzRSx5RUFBeUU7UUFDekUsMkVBQTJFO1FBQzNFLGlCQUFpQjtRQUNqQixxQkFBcUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNsQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7QUFDSCxDQUFDO0FBRUQsTUFBTSxVQUFVLG9DQUFvQztJQUNsRCwrQkFBK0IsR0FBRyw4QkFBOEIsQ0FBQztBQUNuRSxDQUFDO0FBRUQsTUFBTSxVQUFVLDBCQUEwQixDQUN4QyxVQUFzQixFQUN0QixRQUF1QjtJQUV2QixPQUFPLCtCQUErQixDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUMvRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7REVIWURSQVRFRF9WSUVXUywgTENvbnRhaW5lcn0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL2NvbnRhaW5lcic7XG5pbXBvcnQge1JOb2RlfSBmcm9tICcuLi9yZW5kZXIzL2ludGVyZmFjZXMvcmVuZGVyZXJfZG9tJztcblxuaW1wb3J0IHtyZW1vdmVEZWh5ZHJhdGVkVmlld3N9IGZyb20gJy4vY2xlYW51cCc7XG5pbXBvcnQge1xuICBEZWh5ZHJhdGVkQ29udGFpbmVyVmlldyxcbiAgTVVMVElQTElFUixcbiAgTlVNX1JPT1RfTk9ERVMsXG4gIFNlcmlhbGl6ZWRDb250YWluZXJWaWV3LFxuICBURU1QTEFURV9JRCxcbn0gZnJvbSAnLi9pbnRlcmZhY2VzJztcbmltcG9ydCB7c2libGluZ0FmdGVyfSBmcm9tICcuL25vZGVfbG9va3VwX3V0aWxzJztcblxuLyoqXG4gKiBHaXZlbiBhIGN1cnJlbnQgRE9NIG5vZGUgYW5kIGEgc2VyaWFsaXplZCBpbmZvcm1hdGlvbiBhYm91dCB0aGUgdmlld3NcbiAqIGluIGEgY29udGFpbmVyLCB3YWxrcyBvdmVyIHRoZSBET00gc3RydWN0dXJlLCBjb2xsZWN0aW5nIHRoZSBsaXN0IG9mXG4gKiBkZWh5ZHJhdGVkIHZpZXdzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbG9jYXRlRGVoeWRyYXRlZFZpZXdzSW5Db250YWluZXIoXG4gIGN1cnJlbnRSTm9kZTogUk5vZGUsXG4gIHNlcmlhbGl6ZWRWaWV3czogU2VyaWFsaXplZENvbnRhaW5lclZpZXdbXSxcbik6IFtSTm9kZSwgRGVoeWRyYXRlZENvbnRhaW5lclZpZXdbXV0ge1xuICBjb25zdCBkZWh5ZHJhdGVkVmlld3M6IERlaHlkcmF0ZWRDb250YWluZXJWaWV3W10gPSBbXTtcbiAgZm9yIChjb25zdCBzZXJpYWxpemVkVmlldyBvZiBzZXJpYWxpemVkVmlld3MpIHtcbiAgICAvLyBSZXBlYXRzIGEgdmlldyBtdWx0aXBsZSB0aW1lcyBhcyBuZWVkZWQsIGJhc2VkIG9uIHRoZSBzZXJpYWxpemVkIGluZm9ybWF0aW9uXG4gICAgLy8gKGZvciBleGFtcGxlLCBmb3IgKm5nRm9yLXByb2R1Y2VkIHZpZXdzKS5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IChzZXJpYWxpemVkVmlld1tNVUxUSVBMSUVSXSA/PyAxKTsgaSsrKSB7XG4gICAgICBjb25zdCB2aWV3OiBEZWh5ZHJhdGVkQ29udGFpbmVyVmlldyA9IHtcbiAgICAgICAgZGF0YTogc2VyaWFsaXplZFZpZXcsXG4gICAgICAgIGZpcnN0Q2hpbGQ6IG51bGwsXG4gICAgICB9O1xuICAgICAgaWYgKHNlcmlhbGl6ZWRWaWV3W05VTV9ST09UX05PREVTXSA+IDApIHtcbiAgICAgICAgLy8gS2VlcCByZWZlcmVuY2UgdG8gdGhlIGZpcnN0IG5vZGUgaW4gdGhpcyB2aWV3LFxuICAgICAgICAvLyBzbyBpdCBjYW4gYmUgYWNjZXNzZWQgd2hpbGUgaW52b2tpbmcgdGVtcGxhdGUgaW5zdHJ1Y3Rpb25zLlxuICAgICAgICB2aWV3LmZpcnN0Q2hpbGQgPSBjdXJyZW50Uk5vZGUgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICAgICAgLy8gTW92ZSBvdmVyIHRvIHRoZSBuZXh0IG5vZGUgYWZ0ZXIgdGhpcyB2aWV3LCB3aGljaCBjYW5cbiAgICAgICAgLy8gZWl0aGVyIGJlIGEgZmlyc3Qgbm9kZSBvZiB0aGUgbmV4dCB2aWV3IG9yIGFuIGFuY2hvciBjb21tZW50XG4gICAgICAgIC8vIG5vZGUgYWZ0ZXIgdGhlIGxhc3QgdmlldyBpbiBhIGNvbnRhaW5lci5cbiAgICAgICAgY3VycmVudFJOb2RlID0gc2libGluZ0FmdGVyKHNlcmlhbGl6ZWRWaWV3W05VTV9ST09UX05PREVTXSwgY3VycmVudFJOb2RlKSE7XG4gICAgICB9XG4gICAgICBkZWh5ZHJhdGVkVmlld3MucHVzaCh2aWV3KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gW2N1cnJlbnRSTm9kZSwgZGVoeWRyYXRlZFZpZXdzXTtcbn1cblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gYSBmdW5jdGlvbiB0aGF0IHNlYXJjaGVzIGZvciBhIG1hdGNoaW5nIGRlaHlkcmF0ZWQgdmlld3NcbiAqIHN0b3JlZCBvbiBhIGdpdmVuIGxDb250YWluZXIuXG4gKiBSZXR1cm5zIGBudWxsYCBieSBkZWZhdWx0LCB3aGVuIGh5ZHJhdGlvbiBpcyBub3QgZW5hYmxlZC5cbiAqL1xubGV0IF9maW5kTWF0Y2hpbmdEZWh5ZHJhdGVkVmlld0ltcGw6IHR5cGVvZiBmaW5kTWF0Y2hpbmdEZWh5ZHJhdGVkVmlld0ltcGwgPSAoKSA9PiBudWxsO1xuXG4vKipcbiAqIFJldHJpZXZlcyB0aGUgbmV4dCBkZWh5ZHJhdGVkIHZpZXcgZnJvbSB0aGUgTENvbnRhaW5lciBhbmQgdmVyaWZpZXMgdGhhdFxuICogaXQgbWF0Y2hlcyBhIGdpdmVuIHRlbXBsYXRlIGlkIChmcm9tIHRoZSBUVmlldyB0aGF0IHdhcyB1c2VkIHRvIGNyZWF0ZSB0aGlzXG4gKiBpbnN0YW5jZSBvZiBhIHZpZXcpLiBJZiB0aGUgaWQgZG9lc24ndCBtYXRjaCwgdGhhdCBtZWFucyB0aGF0IHdlIGFyZSBpbiBhblxuICogdW5leHBlY3RlZCBzdGF0ZSBhbmQgY2FuIG5vdCBjb21wbGV0ZSB0aGUgcmVjb25jaWxpYXRpb24gcHJvY2Vzcy4gVGh1cyxcbiAqIGFsbCBkZWh5ZHJhdGVkIHZpZXdzIGZyb20gdGhpcyBMQ29udGFpbmVyIGFyZSByZW1vdmVkIChpbmNsdWRpbmcgY29ycmVzcG9uZGluZ1xuICogRE9NIG5vZGVzKSBhbmQgdGhlIHJlbmRlcmluZyBpcyBwZXJmb3JtZWQgYXMgaWYgdGhlcmUgd2VyZSBubyBkZWh5ZHJhdGVkIHZpZXdzXG4gKiBpbiB0aGlzIGNvbnRhaW5lci5cbiAqL1xuZnVuY3Rpb24gZmluZE1hdGNoaW5nRGVoeWRyYXRlZFZpZXdJbXBsKFxuICBsQ29udGFpbmVyOiBMQ29udGFpbmVyLFxuICB0ZW1wbGF0ZTogc3RyaW5nIHwgbnVsbCxcbik6IERlaHlkcmF0ZWRDb250YWluZXJWaWV3IHwgbnVsbCB7XG4gIGNvbnN0IHZpZXdzID0gbENvbnRhaW5lcltERUhZRFJBVEVEX1ZJRVdTXTtcbiAgaWYgKCF0ZW1wbGF0ZSB8fCB2aWV3cyA9PT0gbnVsbCB8fCB2aWV3cy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCB2aWV3ID0gdmlld3NbMF07XG4gIC8vIFZlcmlmeSB3aGV0aGVyIHRoZSBmaXJzdCBkZWh5ZHJhdGVkIHZpZXcgaW4gdGhlIGNvbnRhaW5lciBtYXRjaGVzXG4gIC8vIHRoZSB0ZW1wbGF0ZSBpZCBwYXNzZWQgdG8gdGhpcyBmdW5jdGlvbiAodGhhdCBvcmlnaW5hdGVkIGZyb20gYSBUVmlld1xuICAvLyB0aGF0IHdhcyB1c2VkIHRvIGNyZWF0ZSBhbiBpbnN0YW5jZSBvZiBhbiBlbWJlZGRlZCBvciBjb21wb25lbnQgdmlld3MuXG4gIGlmICh2aWV3LmRhdGFbVEVNUExBVEVfSURdID09PSB0ZW1wbGF0ZSkge1xuICAgIC8vIElmIHRoZSB0ZW1wbGF0ZSBpZCBtYXRjaGVzIC0gZXh0cmFjdCB0aGUgZmlyc3QgdmlldyBhbmQgcmV0dXJuIGl0LlxuICAgIHJldHVybiB2aWV3cy5zaGlmdCgpITtcbiAgfSBlbHNlIHtcbiAgICAvLyBPdGhlcndpc2UsIHdlIGFyZSBhdCB0aGUgc3RhdGUgd2hlbiByZWNvbmNpbGlhdGlvbiBjYW4gbm90IGJlIGNvbXBsZXRlZCxcbiAgICAvLyB0aHVzIHdlIHJlbW92ZSBhbGwgZGVoeWRyYXRlZCB2aWV3cyB3aXRoaW4gdGhpcyBjb250YWluZXIgKHJlbW92ZSB0aGVtXG4gICAgLy8gZnJvbSBpbnRlcm5hbCBkYXRhIHN0cnVjdHVyZXMgYXMgd2VsbCBhcyBkZWxldGUgYXNzb2NpYXRlZCBlbGVtZW50cyBmcm9tXG4gICAgLy8gdGhlIERPTSB0cmVlKS5cbiAgICByZW1vdmVEZWh5ZHJhdGVkVmlld3MobENvbnRhaW5lcik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVuYWJsZUZpbmRNYXRjaGluZ0RlaHlkcmF0ZWRWaWV3SW1wbCgpIHtcbiAgX2ZpbmRNYXRjaGluZ0RlaHlkcmF0ZWRWaWV3SW1wbCA9IGZpbmRNYXRjaGluZ0RlaHlkcmF0ZWRWaWV3SW1wbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbmRNYXRjaGluZ0RlaHlkcmF0ZWRWaWV3KFxuICBsQ29udGFpbmVyOiBMQ29udGFpbmVyLFxuICB0ZW1wbGF0ZTogc3RyaW5nIHwgbnVsbCxcbik6IERlaHlkcmF0ZWRDb250YWluZXJWaWV3IHwgbnVsbCB7XG4gIHJldHVybiBfZmluZE1hdGNoaW5nRGVoeWRyYXRlZFZpZXdJbXBsKGxDb250YWluZXIsIHRlbXBsYXRlKTtcbn1cbiJdfQ==