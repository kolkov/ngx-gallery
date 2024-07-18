/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { assertGreaterThan } from '../../util/assert';
import { assertIndexInDeclRange } from '../assert';
import { executeCheckHooks, executeInitAndCheckHooks } from '../hooks';
import { FLAGS, TVIEW } from '../interfaces/view';
import { getLView, getSelectedIndex, getTView, isInCheckNoChangesMode, setSelectedIndex, } from '../state';
/**
 * Advances to an element for later binding instructions.
 *
 * Used in conjunction with instructions like {@link property} to act on elements with specified
 * indices, for example those created with {@link element} or {@link elementStart}.
 *
 * ```ts
 * (rf: RenderFlags, ctx: any) => {
 *   if (rf & 1) {
 *     text(0, 'Hello');
 *     text(1, 'Goodbye')
 *     element(2, 'div');
 *   }
 *   if (rf & 2) {
 *     advance(2); // Advance twice to the <div>.
 *     property('title', 'test');
 *   }
 *  }
 * ```
 * @param delta Number of elements to advance forwards by.
 *
 * @codeGenApi
 */
export function ɵɵadvance(delta = 1) {
    ngDevMode && assertGreaterThan(delta, 0, 'Can only advance forward');
    selectIndexInternal(getTView(), getLView(), getSelectedIndex() + delta, !!ngDevMode && isInCheckNoChangesMode());
}
export function selectIndexInternal(tView, lView, index, checkNoChangesMode) {
    ngDevMode && assertIndexInDeclRange(lView[TVIEW], index);
    // Flush the initial hooks for elements in the view that have been added up to this point.
    // PERF WARNING: do NOT extract this to a separate function without running benchmarks
    if (!checkNoChangesMode) {
        const hooksInitPhaseCompleted = (lView[FLAGS] & 3 /* LViewFlags.InitPhaseStateMask */) === 3 /* InitPhaseState.InitPhaseCompleted */;
        if (hooksInitPhaseCompleted) {
            const preOrderCheckHooks = tView.preOrderCheckHooks;
            if (preOrderCheckHooks !== null) {
                executeCheckHooks(lView, preOrderCheckHooks, index);
            }
        }
        else {
            const preOrderHooks = tView.preOrderHooks;
            if (preOrderHooks !== null) {
                executeInitAndCheckHooks(lView, preOrderHooks, 0 /* InitPhaseState.OnInitHooksToBeRun */, index);
            }
        }
    }
    // We must set the selected index *after* running the hooks, because hooks may have side-effects
    // that cause other template functions to run, thus updating the selected index, which is global
    // state. If we run `setSelectedIndex` *before* we run the hooks, in some cases the selected index
    // will be altered by the time we leave the `ɵɵadvance` instruction.
    setSelectedIndex(index);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWR2YW5jZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3JlbmRlcjMvaW5zdHJ1Y3Rpb25zL2FkdmFuY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDcEQsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ2pELE9BQU8sRUFBQyxpQkFBaUIsRUFBRSx3QkFBd0IsRUFBQyxNQUFNLFVBQVUsQ0FBQztBQUNyRSxPQUFPLEVBQUMsS0FBSyxFQUFxQyxLQUFLLEVBQVEsTUFBTSxvQkFBb0IsQ0FBQztBQUMxRixPQUFPLEVBQ0wsUUFBUSxFQUNSLGdCQUFnQixFQUNoQixRQUFRLEVBQ1Isc0JBQXNCLEVBQ3RCLGdCQUFnQixHQUNqQixNQUFNLFVBQVUsQ0FBQztBQUVsQjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXNCRztBQUNILE1BQU0sVUFBVSxTQUFTLENBQUMsUUFBZ0IsQ0FBQztJQUN6QyxTQUFTLElBQUksaUJBQWlCLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRSwwQkFBMEIsQ0FBQyxDQUFDO0lBQ3JFLG1CQUFtQixDQUNqQixRQUFRLEVBQUUsRUFDVixRQUFRLEVBQUUsRUFDVixnQkFBZ0IsRUFBRSxHQUFHLEtBQUssRUFDMUIsQ0FBQyxDQUFDLFNBQVMsSUFBSSxzQkFBc0IsRUFBRSxDQUN4QyxDQUFDO0FBQ0osQ0FBQztBQUVELE1BQU0sVUFBVSxtQkFBbUIsQ0FDakMsS0FBWSxFQUNaLEtBQVksRUFDWixLQUFhLEVBQ2Isa0JBQTJCO0lBRTNCLFNBQVMsSUFBSSxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFFekQsMEZBQTBGO0lBQzFGLHNGQUFzRjtJQUN0RixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUN4QixNQUFNLHVCQUF1QixHQUMzQixDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsd0NBQWdDLENBQUMsOENBQXNDLENBQUM7UUFDdkYsSUFBSSx1QkFBdUIsRUFBRSxDQUFDO1lBQzVCLE1BQU0sa0JBQWtCLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDO1lBQ3BELElBQUksa0JBQWtCLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQ2hDLGlCQUFpQixDQUFDLEtBQUssRUFBRSxrQkFBa0IsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUN0RCxDQUFDO1FBQ0gsQ0FBQzthQUFNLENBQUM7WUFDTixNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsYUFBYSxDQUFDO1lBQzFDLElBQUksYUFBYSxLQUFLLElBQUksRUFBRSxDQUFDO2dCQUMzQix3QkFBd0IsQ0FBQyxLQUFLLEVBQUUsYUFBYSw2Q0FBcUMsS0FBSyxDQUFDLENBQUM7WUFDM0YsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRUQsZ0dBQWdHO0lBQ2hHLGdHQUFnRztJQUNoRyxrR0FBa0c7SUFDbEcsb0VBQW9FO0lBQ3BFLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzFCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7YXNzZXJ0R3JlYXRlclRoYW59IGZyb20gJy4uLy4uL3V0aWwvYXNzZXJ0JztcbmltcG9ydCB7YXNzZXJ0SW5kZXhJbkRlY2xSYW5nZX0gZnJvbSAnLi4vYXNzZXJ0JztcbmltcG9ydCB7ZXhlY3V0ZUNoZWNrSG9va3MsIGV4ZWN1dGVJbml0QW5kQ2hlY2tIb29rc30gZnJvbSAnLi4vaG9va3MnO1xuaW1wb3J0IHtGTEFHUywgSW5pdFBoYXNlU3RhdGUsIExWaWV3LCBMVmlld0ZsYWdzLCBUVklFVywgVFZpZXd9IGZyb20gJy4uL2ludGVyZmFjZXMvdmlldyc7XG5pbXBvcnQge1xuICBnZXRMVmlldyxcbiAgZ2V0U2VsZWN0ZWRJbmRleCxcbiAgZ2V0VFZpZXcsXG4gIGlzSW5DaGVja05vQ2hhbmdlc01vZGUsXG4gIHNldFNlbGVjdGVkSW5kZXgsXG59IGZyb20gJy4uL3N0YXRlJztcblxuLyoqXG4gKiBBZHZhbmNlcyB0byBhbiBlbGVtZW50IGZvciBsYXRlciBiaW5kaW5nIGluc3RydWN0aW9ucy5cbiAqXG4gKiBVc2VkIGluIGNvbmp1bmN0aW9uIHdpdGggaW5zdHJ1Y3Rpb25zIGxpa2Uge0BsaW5rIHByb3BlcnR5fSB0byBhY3Qgb24gZWxlbWVudHMgd2l0aCBzcGVjaWZpZWRcbiAqIGluZGljZXMsIGZvciBleGFtcGxlIHRob3NlIGNyZWF0ZWQgd2l0aCB7QGxpbmsgZWxlbWVudH0gb3Ige0BsaW5rIGVsZW1lbnRTdGFydH0uXG4gKlxuICogYGBgdHNcbiAqIChyZjogUmVuZGVyRmxhZ3MsIGN0eDogYW55KSA9PiB7XG4gKiAgIGlmIChyZiAmIDEpIHtcbiAqICAgICB0ZXh0KDAsICdIZWxsbycpO1xuICogICAgIHRleHQoMSwgJ0dvb2RieWUnKVxuICogICAgIGVsZW1lbnQoMiwgJ2RpdicpO1xuICogICB9XG4gKiAgIGlmIChyZiAmIDIpIHtcbiAqICAgICBhZHZhbmNlKDIpOyAvLyBBZHZhbmNlIHR3aWNlIHRvIHRoZSA8ZGl2Pi5cbiAqICAgICBwcm9wZXJ0eSgndGl0bGUnLCAndGVzdCcpO1xuICogICB9XG4gKiAgfVxuICogYGBgXG4gKiBAcGFyYW0gZGVsdGEgTnVtYmVyIG9mIGVsZW1lbnRzIHRvIGFkdmFuY2UgZm9yd2FyZHMgYnkuXG4gKlxuICogQGNvZGVHZW5BcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybVhZHZhbmNlKGRlbHRhOiBudW1iZXIgPSAxKTogdm9pZCB7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnRHcmVhdGVyVGhhbihkZWx0YSwgMCwgJ0NhbiBvbmx5IGFkdmFuY2UgZm9yd2FyZCcpO1xuICBzZWxlY3RJbmRleEludGVybmFsKFxuICAgIGdldFRWaWV3KCksXG4gICAgZ2V0TFZpZXcoKSxcbiAgICBnZXRTZWxlY3RlZEluZGV4KCkgKyBkZWx0YSxcbiAgICAhIW5nRGV2TW9kZSAmJiBpc0luQ2hlY2tOb0NoYW5nZXNNb2RlKCksXG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZWxlY3RJbmRleEludGVybmFsKFxuICB0VmlldzogVFZpZXcsXG4gIGxWaWV3OiBMVmlldyxcbiAgaW5kZXg6IG51bWJlcixcbiAgY2hlY2tOb0NoYW5nZXNNb2RlOiBib29sZWFuLFxuKSB7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnRJbmRleEluRGVjbFJhbmdlKGxWaWV3W1RWSUVXXSwgaW5kZXgpO1xuXG4gIC8vIEZsdXNoIHRoZSBpbml0aWFsIGhvb2tzIGZvciBlbGVtZW50cyBpbiB0aGUgdmlldyB0aGF0IGhhdmUgYmVlbiBhZGRlZCB1cCB0byB0aGlzIHBvaW50LlxuICAvLyBQRVJGIFdBUk5JTkc6IGRvIE5PVCBleHRyYWN0IHRoaXMgdG8gYSBzZXBhcmF0ZSBmdW5jdGlvbiB3aXRob3V0IHJ1bm5pbmcgYmVuY2htYXJrc1xuICBpZiAoIWNoZWNrTm9DaGFuZ2VzTW9kZSkge1xuICAgIGNvbnN0IGhvb2tzSW5pdFBoYXNlQ29tcGxldGVkID1cbiAgICAgIChsVmlld1tGTEFHU10gJiBMVmlld0ZsYWdzLkluaXRQaGFzZVN0YXRlTWFzaykgPT09IEluaXRQaGFzZVN0YXRlLkluaXRQaGFzZUNvbXBsZXRlZDtcbiAgICBpZiAoaG9va3NJbml0UGhhc2VDb21wbGV0ZWQpIHtcbiAgICAgIGNvbnN0IHByZU9yZGVyQ2hlY2tIb29rcyA9IHRWaWV3LnByZU9yZGVyQ2hlY2tIb29rcztcbiAgICAgIGlmIChwcmVPcmRlckNoZWNrSG9va3MgIT09IG51bGwpIHtcbiAgICAgICAgZXhlY3V0ZUNoZWNrSG9va3MobFZpZXcsIHByZU9yZGVyQ2hlY2tIb29rcywgaW5kZXgpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBwcmVPcmRlckhvb2tzID0gdFZpZXcucHJlT3JkZXJIb29rcztcbiAgICAgIGlmIChwcmVPcmRlckhvb2tzICE9PSBudWxsKSB7XG4gICAgICAgIGV4ZWN1dGVJbml0QW5kQ2hlY2tIb29rcyhsVmlldywgcHJlT3JkZXJIb29rcywgSW5pdFBoYXNlU3RhdGUuT25Jbml0SG9va3NUb0JlUnVuLCBpbmRleCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gV2UgbXVzdCBzZXQgdGhlIHNlbGVjdGVkIGluZGV4ICphZnRlciogcnVubmluZyB0aGUgaG9va3MsIGJlY2F1c2UgaG9va3MgbWF5IGhhdmUgc2lkZS1lZmZlY3RzXG4gIC8vIHRoYXQgY2F1c2Ugb3RoZXIgdGVtcGxhdGUgZnVuY3Rpb25zIHRvIHJ1biwgdGh1cyB1cGRhdGluZyB0aGUgc2VsZWN0ZWQgaW5kZXgsIHdoaWNoIGlzIGdsb2JhbFxuICAvLyBzdGF0ZS4gSWYgd2UgcnVuIGBzZXRTZWxlY3RlZEluZGV4YCAqYmVmb3JlKiB3ZSBydW4gdGhlIGhvb2tzLCBpbiBzb21lIGNhc2VzIHRoZSBzZWxlY3RlZCBpbmRleFxuICAvLyB3aWxsIGJlIGFsdGVyZWQgYnkgdGhlIHRpbWUgd2UgbGVhdmUgdGhlIGDJtcm1YWR2YW5jZWAgaW5zdHJ1Y3Rpb24uXG4gIHNldFNlbGVjdGVkSW5kZXgoaW5kZXgpO1xufVxuIl19