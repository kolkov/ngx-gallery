/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { setActiveConsumer } from '@angular/core/primitives/signals';
import { assertDefined, assertEqual, assertNotEqual } from '../util/assert';
import { assertFirstCreatePass } from './assert';
import { NgOnChangesFeatureImpl } from './features/ng_onchanges_feature';
import { FLAGS, PREORDER_HOOK_FLAGS, } from './interfaces/view';
import { profiler } from './profiler';
import { isInCheckNoChangesMode } from './state';
/**
 * Adds all directive lifecycle hooks from the given `DirectiveDef` to the given `TView`.
 *
 * Must be run *only* on the first template pass.
 *
 * Sets up the pre-order hooks on the provided `tView`,
 * see {@link HookData} for details about the data structure.
 *
 * @param directiveIndex The index of the directive in LView
 * @param directiveDef The definition containing the hooks to setup in tView
 * @param tView The current TView
 */
export function registerPreOrderHooks(directiveIndex, directiveDef, tView) {
    ngDevMode && assertFirstCreatePass(tView);
    const { ngOnChanges, ngOnInit, ngDoCheck } = directiveDef.type.prototype;
    if (ngOnChanges) {
        const wrappedOnChanges = NgOnChangesFeatureImpl(directiveDef);
        (tView.preOrderHooks ??= []).push(directiveIndex, wrappedOnChanges);
        (tView.preOrderCheckHooks ??= []).push(directiveIndex, wrappedOnChanges);
    }
    if (ngOnInit) {
        (tView.preOrderHooks ??= []).push(0 - directiveIndex, ngOnInit);
    }
    if (ngDoCheck) {
        (tView.preOrderHooks ??= []).push(directiveIndex, ngDoCheck);
        (tView.preOrderCheckHooks ??= []).push(directiveIndex, ngDoCheck);
    }
}
/**
 *
 * Loops through the directives on the provided `tNode` and queues hooks to be
 * run that are not initialization hooks.
 *
 * Should be executed during `elementEnd()` and similar to
 * preserve hook execution order. Content, view, and destroy hooks for projected
 * components and directives must be called *before* their hosts.
 *
 * Sets up the content, view, and destroy hooks on the provided `tView`,
 * see {@link HookData} for details about the data structure.
 *
 * NOTE: This does not set up `onChanges`, `onInit` or `doCheck`, those are set up
 * separately at `elementStart`.
 *
 * @param tView The current TView
 * @param tNode The TNode whose directives are to be searched for hooks to queue
 */
export function registerPostOrderHooks(tView, tNode) {
    ngDevMode && assertFirstCreatePass(tView);
    // It's necessary to loop through the directives at elementEnd() (rather than processing in
    // directiveCreate) so we can preserve the current hook order. Content, view, and destroy
    // hooks for projected components and directives must be called *before* their hosts.
    for (let i = tNode.directiveStart, end = tNode.directiveEnd; i < end; i++) {
        const directiveDef = tView.data[i];
        ngDevMode && assertDefined(directiveDef, 'Expecting DirectiveDef');
        const lifecycleHooks = directiveDef.type.prototype;
        const { ngAfterContentInit, ngAfterContentChecked, ngAfterViewInit, ngAfterViewChecked, ngOnDestroy, } = lifecycleHooks;
        if (ngAfterContentInit) {
            (tView.contentHooks ??= []).push(-i, ngAfterContentInit);
        }
        if (ngAfterContentChecked) {
            (tView.contentHooks ??= []).push(i, ngAfterContentChecked);
            (tView.contentCheckHooks ??= []).push(i, ngAfterContentChecked);
        }
        if (ngAfterViewInit) {
            (tView.viewHooks ??= []).push(-i, ngAfterViewInit);
        }
        if (ngAfterViewChecked) {
            (tView.viewHooks ??= []).push(i, ngAfterViewChecked);
            (tView.viewCheckHooks ??= []).push(i, ngAfterViewChecked);
        }
        if (ngOnDestroy != null) {
            (tView.destroyHooks ??= []).push(i, ngOnDestroy);
        }
    }
}
/**
 * Executing hooks requires complex logic as we need to deal with 2 constraints.
 *
 * 1. Init hooks (ngOnInit, ngAfterContentInit, ngAfterViewInit) must all be executed once and only
 * once, across many change detection cycles. This must be true even if some hooks throw, or if
 * some recursively trigger a change detection cycle.
 * To solve that, it is required to track the state of the execution of these init hooks.
 * This is done by storing and maintaining flags in the view: the {@link InitPhaseState},
 * and the index within that phase. They can be seen as a cursor in the following structure:
 * [[onInit1, onInit2], [afterContentInit1], [afterViewInit1, afterViewInit2, afterViewInit3]]
 * They are stored as flags in LView[FLAGS].
 *
 * 2. Pre-order hooks can be executed in batches, because of the select instruction.
 * To be able to pause and resume their execution, we also need some state about the hook's array
 * that is being processed:
 * - the index of the next hook to be executed
 * - the number of init hooks already found in the processed part of the  array
 * They are stored as flags in LView[PREORDER_HOOK_FLAGS].
 */
/**
 * Executes pre-order check hooks ( OnChanges, DoChanges) given a view where all the init hooks were
 * executed once. This is a light version of executeInitAndCheckPreOrderHooks where we can skip read
 * / write of the init-hooks related flags.
 * @param lView The LView where hooks are defined
 * @param hooks Hooks to be run
 * @param nodeIndex 3 cases depending on the value:
 * - undefined: all hooks from the array should be executed (post-order case)
 * - null: execute hooks only from the saved index until the end of the array (pre-order case, when
 * flushing the remaining hooks)
 * - number: execute hooks only from the saved index until that node index exclusive (pre-order
 * case, when executing select(number))
 */
export function executeCheckHooks(lView, hooks, nodeIndex) {
    callHooks(lView, hooks, 3 /* InitPhaseState.InitPhaseCompleted */, nodeIndex);
}
/**
 * Executes post-order init and check hooks (one of AfterContentInit, AfterContentChecked,
 * AfterViewInit, AfterViewChecked) given a view where there are pending init hooks to be executed.
 * @param lView The LView where hooks are defined
 * @param hooks Hooks to be run
 * @param initPhase A phase for which hooks should be run
 * @param nodeIndex 3 cases depending on the value:
 * - undefined: all hooks from the array should be executed (post-order case)
 * - null: execute hooks only from the saved index until the end of the array (pre-order case, when
 * flushing the remaining hooks)
 * - number: execute hooks only from the saved index until that node index exclusive (pre-order
 * case, when executing select(number))
 */
export function executeInitAndCheckHooks(lView, hooks, initPhase, nodeIndex) {
    ngDevMode &&
        assertNotEqual(initPhase, 3 /* InitPhaseState.InitPhaseCompleted */, 'Init pre-order hooks should not be called more than once');
    if ((lView[FLAGS] & 3 /* LViewFlags.InitPhaseStateMask */) === initPhase) {
        callHooks(lView, hooks, initPhase, nodeIndex);
    }
}
export function incrementInitPhaseFlags(lView, initPhase) {
    ngDevMode &&
        assertNotEqual(initPhase, 3 /* InitPhaseState.InitPhaseCompleted */, 'Init hooks phase should not be incremented after all init hooks have been run.');
    let flags = lView[FLAGS];
    if ((flags & 3 /* LViewFlags.InitPhaseStateMask */) === initPhase) {
        flags &= 16383 /* LViewFlags.IndexWithinInitPhaseReset */;
        flags += 1 /* LViewFlags.InitPhaseStateIncrementer */;
        lView[FLAGS] = flags;
    }
}
/**
 * Calls lifecycle hooks with their contexts, skipping init hooks if it's not
 * the first LView pass
 *
 * @param currentView The current view
 * @param arr The array in which the hooks are found
 * @param initPhaseState the current state of the init phase
 * @param currentNodeIndex 3 cases depending on the value:
 * - undefined: all hooks from the array should be executed (post-order case)
 * - null: execute hooks only from the saved index until the end of the array (pre-order case, when
 * flushing the remaining hooks)
 * - number: execute hooks only from the saved index until that node index exclusive (pre-order
 * case, when executing select(number))
 */
function callHooks(currentView, arr, initPhase, currentNodeIndex) {
    ngDevMode &&
        assertEqual(isInCheckNoChangesMode(), false, 'Hooks should never be run when in check no changes mode.');
    const startIndex = currentNodeIndex !== undefined
        ? currentView[PREORDER_HOOK_FLAGS] & 65535 /* PreOrderHookFlags.IndexOfTheNextPreOrderHookMaskMask */
        : 0;
    const nodeIndexLimit = currentNodeIndex != null ? currentNodeIndex : -1;
    const max = arr.length - 1; // Stop the loop at length - 1, because we look for the hook at i + 1
    let lastNodeIndexFound = 0;
    for (let i = startIndex; i < max; i++) {
        const hook = arr[i + 1];
        if (typeof hook === 'number') {
            lastNodeIndexFound = arr[i];
            if (currentNodeIndex != null && lastNodeIndexFound >= currentNodeIndex) {
                break;
            }
        }
        else {
            const isInitHook = arr[i] < 0;
            if (isInitHook) {
                currentView[PREORDER_HOOK_FLAGS] += 65536 /* PreOrderHookFlags.NumberOfInitHooksCalledIncrementer */;
            }
            if (lastNodeIndexFound < nodeIndexLimit || nodeIndexLimit == -1) {
                callHook(currentView, initPhase, arr, i);
                currentView[PREORDER_HOOK_FLAGS] =
                    (currentView[PREORDER_HOOK_FLAGS] & 4294901760 /* PreOrderHookFlags.NumberOfInitHooksCalledMask */) +
                        i +
                        2;
            }
            i++;
        }
    }
}
/**
 * Executes a single lifecycle hook, making sure that:
 * - it is called in the non-reactive context;
 * - profiling data are registered.
 */
function callHookInternal(directive, hook) {
    profiler(4 /* ProfilerEvent.LifecycleHookStart */, directive, hook);
    const prevConsumer = setActiveConsumer(null);
    try {
        hook.call(directive);
    }
    finally {
        setActiveConsumer(prevConsumer);
        profiler(5 /* ProfilerEvent.LifecycleHookEnd */, directive, hook);
    }
}
/**
 * Execute one hook against the current `LView`.
 *
 * @param currentView The current view
 * @param initPhaseState the current state of the init phase
 * @param arr The array in which the hooks are found
 * @param i The current index within the hook data array
 */
function callHook(currentView, initPhase, arr, i) {
    const isInitHook = arr[i] < 0;
    const hook = arr[i + 1];
    const directiveIndex = isInitHook ? -arr[i] : arr[i];
    const directive = currentView[directiveIndex];
    if (isInitHook) {
        const indexWithintInitPhase = currentView[FLAGS] >> 14 /* LViewFlags.IndexWithinInitPhaseShift */;
        // The init phase state must be always checked here as it may have been recursively updated.
        if (indexWithintInitPhase <
            currentView[PREORDER_HOOK_FLAGS] >> 16 /* PreOrderHookFlags.NumberOfInitHooksCalledShift */ &&
            (currentView[FLAGS] & 3 /* LViewFlags.InitPhaseStateMask */) === initPhase) {
            currentView[FLAGS] += 16384 /* LViewFlags.IndexWithinInitPhaseIncrementer */;
            callHookInternal(directive, hook);
        }
    }
    else {
        callHookInternal(directive, hook);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG9va3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL2hvb2tzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBWW5FLE9BQU8sRUFBQyxhQUFhLEVBQUUsV0FBVyxFQUFFLGNBQWMsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBRTFFLE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLFVBQVUsQ0FBQztBQUMvQyxPQUFPLEVBQUMsc0JBQXNCLEVBQUMsTUFBTSxpQ0FBaUMsQ0FBQztBQUd2RSxPQUFPLEVBQ0wsS0FBSyxFQUtMLG1CQUFtQixHQUdwQixNQUFNLG1CQUFtQixDQUFDO0FBQzNCLE9BQU8sRUFBQyxRQUFRLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFFcEMsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRS9DOzs7Ozs7Ozs7OztHQVdHO0FBQ0gsTUFBTSxVQUFVLHFCQUFxQixDQUNuQyxjQUFzQixFQUN0QixZQUErQixFQUMvQixLQUFZO0lBRVosU0FBUyxJQUFJLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzFDLE1BQU0sRUFBQyxXQUFXLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBQyxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUMsU0FFcEQsQ0FBQztJQUVWLElBQUksV0FBbUMsRUFBRSxDQUFDO1FBQ3hDLE1BQU0sZ0JBQWdCLEdBQUcsc0JBQXNCLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDOUQsQ0FBQyxLQUFLLENBQUMsYUFBYSxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUNwRSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLGdCQUFnQixDQUFDLENBQUM7SUFDM0UsQ0FBQztJQUVELElBQUksUUFBUSxFQUFFLENBQUM7UUFDYixDQUFDLEtBQUssQ0FBQyxhQUFhLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxjQUFjLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDbEUsQ0FBQztJQUVELElBQUksU0FBUyxFQUFFLENBQUM7UUFDZCxDQUFDLEtBQUssQ0FBQyxhQUFhLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM3RCxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7QUFDSCxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBaUJHO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQixDQUFDLEtBQVksRUFBRSxLQUFZO0lBQy9ELFNBQVMsSUFBSSxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMxQywyRkFBMkY7SUFDM0YseUZBQXlGO0lBQ3pGLHFGQUFxRjtJQUNyRixLQUFLLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxjQUFjLEVBQUUsR0FBRyxHQUFHLEtBQUssQ0FBQyxZQUFZLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQzFFLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFzQixDQUFDO1FBQ3hELFNBQVMsSUFBSSxhQUFhLENBQUMsWUFBWSxFQUFFLHdCQUF3QixDQUFDLENBQUM7UUFDbkUsTUFBTSxjQUFjLEdBSU4sWUFBWSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDMUMsTUFBTSxFQUNKLGtCQUFrQixFQUNsQixxQkFBcUIsRUFDckIsZUFBZSxFQUNmLGtCQUFrQixFQUNsQixXQUFXLEdBQ1osR0FBRyxjQUFjLENBQUM7UUFFbkIsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO1lBQ3ZCLENBQUMsS0FBSyxDQUFDLFlBQVksS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUMzRCxDQUFDO1FBRUQsSUFBSSxxQkFBcUIsRUFBRSxDQUFDO1lBQzFCLENBQUMsS0FBSyxDQUFDLFlBQVksS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLHFCQUFxQixDQUFDLENBQUM7WUFDM0QsQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO1FBQ2xFLENBQUM7UUFFRCxJQUFJLGVBQWUsRUFBRSxDQUFDO1lBQ3BCLENBQUMsS0FBSyxDQUFDLFNBQVMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDckQsQ0FBQztRQUVELElBQUksa0JBQWtCLEVBQUUsQ0FBQztZQUN2QixDQUFDLEtBQUssQ0FBQyxTQUFTLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBQ3JELENBQUMsS0FBSyxDQUFDLGNBQWMsS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDNUQsQ0FBQztRQUVELElBQUksV0FBVyxJQUFJLElBQUksRUFBRSxDQUFDO1lBQ3hCLENBQUMsS0FBSyxDQUFDLFlBQVksS0FBSyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ25ELENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FrQkc7QUFFSDs7Ozs7Ozs7Ozs7O0dBWUc7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsS0FBWSxFQUFFLEtBQWUsRUFBRSxTQUF5QjtJQUN4RixTQUFTLENBQUMsS0FBSyxFQUFFLEtBQUssNkNBQXFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3hFLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7O0dBWUc7QUFDSCxNQUFNLFVBQVUsd0JBQXdCLENBQ3RDLEtBQVksRUFDWixLQUFlLEVBQ2YsU0FBeUIsRUFDekIsU0FBeUI7SUFFekIsU0FBUztRQUNQLGNBQWMsQ0FDWixTQUFTLDZDQUVULDBEQUEwRCxDQUMzRCxDQUFDO0lBQ0osSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsd0NBQWdDLENBQUMsS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUNqRSxTQUFTLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDaEQsQ0FBQztBQUNILENBQUM7QUFFRCxNQUFNLFVBQVUsdUJBQXVCLENBQUMsS0FBWSxFQUFFLFNBQXlCO0lBQzdFLFNBQVM7UUFDUCxjQUFjLENBQ1osU0FBUyw2Q0FFVCxnRkFBZ0YsQ0FDakYsQ0FBQztJQUNKLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN6QixJQUFJLENBQUMsS0FBSyx3Q0FBZ0MsQ0FBQyxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQzFELEtBQUssb0RBQXdDLENBQUM7UUFDOUMsS0FBSyxnREFBd0MsQ0FBQztRQUM5QyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDO0lBQ3ZCLENBQUM7QUFDSCxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILFNBQVMsU0FBUyxDQUNoQixXQUFrQixFQUNsQixHQUFhLEVBQ2IsU0FBeUIsRUFDekIsZ0JBQTJDO0lBRTNDLFNBQVM7UUFDUCxXQUFXLENBQ1Qsc0JBQXNCLEVBQUUsRUFDeEIsS0FBSyxFQUNMLDBEQUEwRCxDQUMzRCxDQUFDO0lBQ0osTUFBTSxVQUFVLEdBQ2QsZ0JBQWdCLEtBQUssU0FBUztRQUM1QixDQUFDLENBQUMsV0FBVyxDQUFDLG1CQUFtQixDQUFDLG1FQUF1RDtRQUN6RixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ1IsTUFBTSxjQUFjLEdBQUcsZ0JBQWdCLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDeEUsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxxRUFBcUU7SUFDakcsSUFBSSxrQkFBa0IsR0FBRyxDQUFDLENBQUM7SUFDM0IsS0FBSyxJQUFJLENBQUMsR0FBRyxVQUFVLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ3RDLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUEwQixDQUFDO1FBQ2pELElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDN0Isa0JBQWtCLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBVyxDQUFDO1lBQ3RDLElBQUksZ0JBQWdCLElBQUksSUFBSSxJQUFJLGtCQUFrQixJQUFJLGdCQUFnQixFQUFFLENBQUM7Z0JBQ3ZFLE1BQU07WUFDUixDQUFDO1FBQ0gsQ0FBQzthQUFNLENBQUM7WUFDTixNQUFNLFVBQVUsR0FBSSxHQUFHLENBQUMsQ0FBQyxDQUFZLEdBQUcsQ0FBQyxDQUFDO1lBQzFDLElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQ2YsV0FBVyxDQUFDLG1CQUFtQixDQUFDLG9FQUF3RCxDQUFDO1lBQzNGLENBQUM7WUFDRCxJQUFJLGtCQUFrQixHQUFHLGNBQWMsSUFBSSxjQUFjLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDaEUsUUFBUSxDQUFDLFdBQVcsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN6QyxXQUFXLENBQUMsbUJBQW1CLENBQUM7b0JBQzlCLENBQUMsV0FBVyxDQUFDLG1CQUFtQixDQUFDLGlFQUFnRCxDQUFDO3dCQUNsRixDQUFDO3dCQUNELENBQUMsQ0FBQztZQUNOLENBQUM7WUFDRCxDQUFDLEVBQUUsQ0FBQztRQUNOLENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxTQUFTLGdCQUFnQixDQUFDLFNBQWMsRUFBRSxJQUFnQjtJQUN4RCxRQUFRLDJDQUFtQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDNUQsTUFBTSxZQUFZLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDN0MsSUFBSSxDQUFDO1FBQ0gsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUN2QixDQUFDO1lBQVMsQ0FBQztRQUNULGlCQUFpQixDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ2hDLFFBQVEseUNBQWlDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM1RCxDQUFDO0FBQ0gsQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLFFBQVEsQ0FBQyxXQUFrQixFQUFFLFNBQXlCLEVBQUUsR0FBYSxFQUFFLENBQVM7SUFDdkYsTUFBTSxVQUFVLEdBQUksR0FBRyxDQUFDLENBQUMsQ0FBWSxHQUFHLENBQUMsQ0FBQztJQUMxQyxNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBZSxDQUFDO0lBQ3RDLE1BQU0sY0FBYyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFFLEdBQUcsQ0FBQyxDQUFDLENBQVksQ0FBQztJQUNqRSxNQUFNLFNBQVMsR0FBRyxXQUFXLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDOUMsSUFBSSxVQUFVLEVBQUUsQ0FBQztRQUNmLE1BQU0scUJBQXFCLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxpREFBd0MsQ0FBQztRQUN6Riw0RkFBNEY7UUFDNUYsSUFDRSxxQkFBcUI7WUFDbkIsV0FBVyxDQUFDLG1CQUFtQixDQUFDLDJEQUFrRDtZQUNwRixDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsd0NBQWdDLENBQUMsS0FBSyxTQUFTLEVBQ2xFLENBQUM7WUFDRCxXQUFXLENBQUMsS0FBSyxDQUFDLDBEQUE4QyxDQUFDO1lBQ2pFLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNwQyxDQUFDO0lBQ0gsQ0FBQztTQUFNLENBQUM7UUFDTixnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDcEMsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtzZXRBY3RpdmVDb25zdW1lcn0gZnJvbSAnQGFuZ3VsYXIvY29yZS9wcmltaXRpdmVzL3NpZ25hbHMnO1xuXG5pbXBvcnQge1xuICBBZnRlckNvbnRlbnRDaGVja2VkLFxuICBBZnRlckNvbnRlbnRJbml0LFxuICBBZnRlclZpZXdDaGVja2VkLFxuICBBZnRlclZpZXdJbml0LFxuICBEb0NoZWNrLFxuICBPbkNoYW5nZXMsXG4gIE9uRGVzdHJveSxcbiAgT25Jbml0LFxufSBmcm9tICcuLi9pbnRlcmZhY2UvbGlmZWN5Y2xlX2hvb2tzJztcbmltcG9ydCB7YXNzZXJ0RGVmaW5lZCwgYXNzZXJ0RXF1YWwsIGFzc2VydE5vdEVxdWFsfSBmcm9tICcuLi91dGlsL2Fzc2VydCc7XG5cbmltcG9ydCB7YXNzZXJ0Rmlyc3RDcmVhdGVQYXNzfSBmcm9tICcuL2Fzc2VydCc7XG5pbXBvcnQge05nT25DaGFuZ2VzRmVhdHVyZUltcGx9IGZyb20gJy4vZmVhdHVyZXMvbmdfb25jaGFuZ2VzX2ZlYXR1cmUnO1xuaW1wb3J0IHtEaXJlY3RpdmVEZWZ9IGZyb20gJy4vaW50ZXJmYWNlcy9kZWZpbml0aW9uJztcbmltcG9ydCB7VE5vZGV9IGZyb20gJy4vaW50ZXJmYWNlcy9ub2RlJztcbmltcG9ydCB7XG4gIEZMQUdTLFxuICBIb29rRGF0YSxcbiAgSW5pdFBoYXNlU3RhdGUsXG4gIExWaWV3LFxuICBMVmlld0ZsYWdzLFxuICBQUkVPUkRFUl9IT09LX0ZMQUdTLFxuICBQcmVPcmRlckhvb2tGbGFncyxcbiAgVFZpZXcsXG59IGZyb20gJy4vaW50ZXJmYWNlcy92aWV3JztcbmltcG9ydCB7cHJvZmlsZXJ9IGZyb20gJy4vcHJvZmlsZXInO1xuaW1wb3J0IHtQcm9maWxlckV2ZW50fSBmcm9tICcuL3Byb2ZpbGVyX3R5cGVzJztcbmltcG9ydCB7aXNJbkNoZWNrTm9DaGFuZ2VzTW9kZX0gZnJvbSAnLi9zdGF0ZSc7XG5cbi8qKlxuICogQWRkcyBhbGwgZGlyZWN0aXZlIGxpZmVjeWNsZSBob29rcyBmcm9tIHRoZSBnaXZlbiBgRGlyZWN0aXZlRGVmYCB0byB0aGUgZ2l2ZW4gYFRWaWV3YC5cbiAqXG4gKiBNdXN0IGJlIHJ1biAqb25seSogb24gdGhlIGZpcnN0IHRlbXBsYXRlIHBhc3MuXG4gKlxuICogU2V0cyB1cCB0aGUgcHJlLW9yZGVyIGhvb2tzIG9uIHRoZSBwcm92aWRlZCBgdFZpZXdgLFxuICogc2VlIHtAbGluayBIb29rRGF0YX0gZm9yIGRldGFpbHMgYWJvdXQgdGhlIGRhdGEgc3RydWN0dXJlLlxuICpcbiAqIEBwYXJhbSBkaXJlY3RpdmVJbmRleCBUaGUgaW5kZXggb2YgdGhlIGRpcmVjdGl2ZSBpbiBMVmlld1xuICogQHBhcmFtIGRpcmVjdGl2ZURlZiBUaGUgZGVmaW5pdGlvbiBjb250YWluaW5nIHRoZSBob29rcyB0byBzZXR1cCBpbiB0Vmlld1xuICogQHBhcmFtIHRWaWV3IFRoZSBjdXJyZW50IFRWaWV3XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclByZU9yZGVySG9va3MoXG4gIGRpcmVjdGl2ZUluZGV4OiBudW1iZXIsXG4gIGRpcmVjdGl2ZURlZjogRGlyZWN0aXZlRGVmPGFueT4sXG4gIHRWaWV3OiBUVmlldyxcbik6IHZvaWQge1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0Rmlyc3RDcmVhdGVQYXNzKHRWaWV3KTtcbiAgY29uc3Qge25nT25DaGFuZ2VzLCBuZ09uSW5pdCwgbmdEb0NoZWNrfSA9IGRpcmVjdGl2ZURlZi50eXBlLnByb3RvdHlwZSBhcyBPbkNoYW5nZXMgJlxuICAgIE9uSW5pdCAmXG4gICAgRG9DaGVjaztcblxuICBpZiAobmdPbkNoYW5nZXMgYXMgRnVuY3Rpb24gfCB1bmRlZmluZWQpIHtcbiAgICBjb25zdCB3cmFwcGVkT25DaGFuZ2VzID0gTmdPbkNoYW5nZXNGZWF0dXJlSW1wbChkaXJlY3RpdmVEZWYpO1xuICAgICh0Vmlldy5wcmVPcmRlckhvb2tzID8/PSBbXSkucHVzaChkaXJlY3RpdmVJbmRleCwgd3JhcHBlZE9uQ2hhbmdlcyk7XG4gICAgKHRWaWV3LnByZU9yZGVyQ2hlY2tIb29rcyA/Pz0gW10pLnB1c2goZGlyZWN0aXZlSW5kZXgsIHdyYXBwZWRPbkNoYW5nZXMpO1xuICB9XG5cbiAgaWYgKG5nT25Jbml0KSB7XG4gICAgKHRWaWV3LnByZU9yZGVySG9va3MgPz89IFtdKS5wdXNoKDAgLSBkaXJlY3RpdmVJbmRleCwgbmdPbkluaXQpO1xuICB9XG5cbiAgaWYgKG5nRG9DaGVjaykge1xuICAgICh0Vmlldy5wcmVPcmRlckhvb2tzID8/PSBbXSkucHVzaChkaXJlY3RpdmVJbmRleCwgbmdEb0NoZWNrKTtcbiAgICAodFZpZXcucHJlT3JkZXJDaGVja0hvb2tzID8/PSBbXSkucHVzaChkaXJlY3RpdmVJbmRleCwgbmdEb0NoZWNrKTtcbiAgfVxufVxuXG4vKipcbiAqXG4gKiBMb29wcyB0aHJvdWdoIHRoZSBkaXJlY3RpdmVzIG9uIHRoZSBwcm92aWRlZCBgdE5vZGVgIGFuZCBxdWV1ZXMgaG9va3MgdG8gYmVcbiAqIHJ1biB0aGF0IGFyZSBub3QgaW5pdGlhbGl6YXRpb24gaG9va3MuXG4gKlxuICogU2hvdWxkIGJlIGV4ZWN1dGVkIGR1cmluZyBgZWxlbWVudEVuZCgpYCBhbmQgc2ltaWxhciB0b1xuICogcHJlc2VydmUgaG9vayBleGVjdXRpb24gb3JkZXIuIENvbnRlbnQsIHZpZXcsIGFuZCBkZXN0cm95IGhvb2tzIGZvciBwcm9qZWN0ZWRcbiAqIGNvbXBvbmVudHMgYW5kIGRpcmVjdGl2ZXMgbXVzdCBiZSBjYWxsZWQgKmJlZm9yZSogdGhlaXIgaG9zdHMuXG4gKlxuICogU2V0cyB1cCB0aGUgY29udGVudCwgdmlldywgYW5kIGRlc3Ryb3kgaG9va3Mgb24gdGhlIHByb3ZpZGVkIGB0Vmlld2AsXG4gKiBzZWUge0BsaW5rIEhvb2tEYXRhfSBmb3IgZGV0YWlscyBhYm91dCB0aGUgZGF0YSBzdHJ1Y3R1cmUuXG4gKlxuICogTk9URTogVGhpcyBkb2VzIG5vdCBzZXQgdXAgYG9uQ2hhbmdlc2AsIGBvbkluaXRgIG9yIGBkb0NoZWNrYCwgdGhvc2UgYXJlIHNldCB1cFxuICogc2VwYXJhdGVseSBhdCBgZWxlbWVudFN0YXJ0YC5cbiAqXG4gKiBAcGFyYW0gdFZpZXcgVGhlIGN1cnJlbnQgVFZpZXdcbiAqIEBwYXJhbSB0Tm9kZSBUaGUgVE5vZGUgd2hvc2UgZGlyZWN0aXZlcyBhcmUgdG8gYmUgc2VhcmNoZWQgZm9yIGhvb2tzIHRvIHF1ZXVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclBvc3RPcmRlckhvb2tzKHRWaWV3OiBUVmlldywgdE5vZGU6IFROb2RlKTogdm9pZCB7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnRGaXJzdENyZWF0ZVBhc3ModFZpZXcpO1xuICAvLyBJdCdzIG5lY2Vzc2FyeSB0byBsb29wIHRocm91Z2ggdGhlIGRpcmVjdGl2ZXMgYXQgZWxlbWVudEVuZCgpIChyYXRoZXIgdGhhbiBwcm9jZXNzaW5nIGluXG4gIC8vIGRpcmVjdGl2ZUNyZWF0ZSkgc28gd2UgY2FuIHByZXNlcnZlIHRoZSBjdXJyZW50IGhvb2sgb3JkZXIuIENvbnRlbnQsIHZpZXcsIGFuZCBkZXN0cm95XG4gIC8vIGhvb2tzIGZvciBwcm9qZWN0ZWQgY29tcG9uZW50cyBhbmQgZGlyZWN0aXZlcyBtdXN0IGJlIGNhbGxlZCAqYmVmb3JlKiB0aGVpciBob3N0cy5cbiAgZm9yIChsZXQgaSA9IHROb2RlLmRpcmVjdGl2ZVN0YXJ0LCBlbmQgPSB0Tm9kZS5kaXJlY3RpdmVFbmQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIGNvbnN0IGRpcmVjdGl2ZURlZiA9IHRWaWV3LmRhdGFbaV0gYXMgRGlyZWN0aXZlRGVmPGFueT47XG4gICAgbmdEZXZNb2RlICYmIGFzc2VydERlZmluZWQoZGlyZWN0aXZlRGVmLCAnRXhwZWN0aW5nIERpcmVjdGl2ZURlZicpO1xuICAgIGNvbnN0IGxpZmVjeWNsZUhvb2tzOiBBZnRlckNvbnRlbnRJbml0ICZcbiAgICAgIEFmdGVyQ29udGVudENoZWNrZWQgJlxuICAgICAgQWZ0ZXJWaWV3SW5pdCAmXG4gICAgICBBZnRlclZpZXdDaGVja2VkICZcbiAgICAgIE9uRGVzdHJveSA9IGRpcmVjdGl2ZURlZi50eXBlLnByb3RvdHlwZTtcbiAgICBjb25zdCB7XG4gICAgICBuZ0FmdGVyQ29udGVudEluaXQsXG4gICAgICBuZ0FmdGVyQ29udGVudENoZWNrZWQsXG4gICAgICBuZ0FmdGVyVmlld0luaXQsXG4gICAgICBuZ0FmdGVyVmlld0NoZWNrZWQsXG4gICAgICBuZ09uRGVzdHJveSxcbiAgICB9ID0gbGlmZWN5Y2xlSG9va3M7XG5cbiAgICBpZiAobmdBZnRlckNvbnRlbnRJbml0KSB7XG4gICAgICAodFZpZXcuY29udGVudEhvb2tzID8/PSBbXSkucHVzaCgtaSwgbmdBZnRlckNvbnRlbnRJbml0KTtcbiAgICB9XG5cbiAgICBpZiAobmdBZnRlckNvbnRlbnRDaGVja2VkKSB7XG4gICAgICAodFZpZXcuY29udGVudEhvb2tzID8/PSBbXSkucHVzaChpLCBuZ0FmdGVyQ29udGVudENoZWNrZWQpO1xuICAgICAgKHRWaWV3LmNvbnRlbnRDaGVja0hvb2tzID8/PSBbXSkucHVzaChpLCBuZ0FmdGVyQ29udGVudENoZWNrZWQpO1xuICAgIH1cblxuICAgIGlmIChuZ0FmdGVyVmlld0luaXQpIHtcbiAgICAgICh0Vmlldy52aWV3SG9va3MgPz89IFtdKS5wdXNoKC1pLCBuZ0FmdGVyVmlld0luaXQpO1xuICAgIH1cblxuICAgIGlmIChuZ0FmdGVyVmlld0NoZWNrZWQpIHtcbiAgICAgICh0Vmlldy52aWV3SG9va3MgPz89IFtdKS5wdXNoKGksIG5nQWZ0ZXJWaWV3Q2hlY2tlZCk7XG4gICAgICAodFZpZXcudmlld0NoZWNrSG9va3MgPz89IFtdKS5wdXNoKGksIG5nQWZ0ZXJWaWV3Q2hlY2tlZCk7XG4gICAgfVxuXG4gICAgaWYgKG5nT25EZXN0cm95ICE9IG51bGwpIHtcbiAgICAgICh0Vmlldy5kZXN0cm95SG9va3MgPz89IFtdKS5wdXNoKGksIG5nT25EZXN0cm95KTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBFeGVjdXRpbmcgaG9va3MgcmVxdWlyZXMgY29tcGxleCBsb2dpYyBhcyB3ZSBuZWVkIHRvIGRlYWwgd2l0aCAyIGNvbnN0cmFpbnRzLlxuICpcbiAqIDEuIEluaXQgaG9va3MgKG5nT25Jbml0LCBuZ0FmdGVyQ29udGVudEluaXQsIG5nQWZ0ZXJWaWV3SW5pdCkgbXVzdCBhbGwgYmUgZXhlY3V0ZWQgb25jZSBhbmQgb25seVxuICogb25jZSwgYWNyb3NzIG1hbnkgY2hhbmdlIGRldGVjdGlvbiBjeWNsZXMuIFRoaXMgbXVzdCBiZSB0cnVlIGV2ZW4gaWYgc29tZSBob29rcyB0aHJvdywgb3IgaWZcbiAqIHNvbWUgcmVjdXJzaXZlbHkgdHJpZ2dlciBhIGNoYW5nZSBkZXRlY3Rpb24gY3ljbGUuXG4gKiBUbyBzb2x2ZSB0aGF0LCBpdCBpcyByZXF1aXJlZCB0byB0cmFjayB0aGUgc3RhdGUgb2YgdGhlIGV4ZWN1dGlvbiBvZiB0aGVzZSBpbml0IGhvb2tzLlxuICogVGhpcyBpcyBkb25lIGJ5IHN0b3JpbmcgYW5kIG1haW50YWluaW5nIGZsYWdzIGluIHRoZSB2aWV3OiB0aGUge0BsaW5rIEluaXRQaGFzZVN0YXRlfSxcbiAqIGFuZCB0aGUgaW5kZXggd2l0aGluIHRoYXQgcGhhc2UuIFRoZXkgY2FuIGJlIHNlZW4gYXMgYSBjdXJzb3IgaW4gdGhlIGZvbGxvd2luZyBzdHJ1Y3R1cmU6XG4gKiBbW29uSW5pdDEsIG9uSW5pdDJdLCBbYWZ0ZXJDb250ZW50SW5pdDFdLCBbYWZ0ZXJWaWV3SW5pdDEsIGFmdGVyVmlld0luaXQyLCBhZnRlclZpZXdJbml0M11dXG4gKiBUaGV5IGFyZSBzdG9yZWQgYXMgZmxhZ3MgaW4gTFZpZXdbRkxBR1NdLlxuICpcbiAqIDIuIFByZS1vcmRlciBob29rcyBjYW4gYmUgZXhlY3V0ZWQgaW4gYmF0Y2hlcywgYmVjYXVzZSBvZiB0aGUgc2VsZWN0IGluc3RydWN0aW9uLlxuICogVG8gYmUgYWJsZSB0byBwYXVzZSBhbmQgcmVzdW1lIHRoZWlyIGV4ZWN1dGlvbiwgd2UgYWxzbyBuZWVkIHNvbWUgc3RhdGUgYWJvdXQgdGhlIGhvb2sncyBhcnJheVxuICogdGhhdCBpcyBiZWluZyBwcm9jZXNzZWQ6XG4gKiAtIHRoZSBpbmRleCBvZiB0aGUgbmV4dCBob29rIHRvIGJlIGV4ZWN1dGVkXG4gKiAtIHRoZSBudW1iZXIgb2YgaW5pdCBob29rcyBhbHJlYWR5IGZvdW5kIGluIHRoZSBwcm9jZXNzZWQgcGFydCBvZiB0aGUgIGFycmF5XG4gKiBUaGV5IGFyZSBzdG9yZWQgYXMgZmxhZ3MgaW4gTFZpZXdbUFJFT1JERVJfSE9PS19GTEFHU10uXG4gKi9cblxuLyoqXG4gKiBFeGVjdXRlcyBwcmUtb3JkZXIgY2hlY2sgaG9va3MgKCBPbkNoYW5nZXMsIERvQ2hhbmdlcykgZ2l2ZW4gYSB2aWV3IHdoZXJlIGFsbCB0aGUgaW5pdCBob29rcyB3ZXJlXG4gKiBleGVjdXRlZCBvbmNlLiBUaGlzIGlzIGEgbGlnaHQgdmVyc2lvbiBvZiBleGVjdXRlSW5pdEFuZENoZWNrUHJlT3JkZXJIb29rcyB3aGVyZSB3ZSBjYW4gc2tpcCByZWFkXG4gKiAvIHdyaXRlIG9mIHRoZSBpbml0LWhvb2tzIHJlbGF0ZWQgZmxhZ3MuXG4gKiBAcGFyYW0gbFZpZXcgVGhlIExWaWV3IHdoZXJlIGhvb2tzIGFyZSBkZWZpbmVkXG4gKiBAcGFyYW0gaG9va3MgSG9va3MgdG8gYmUgcnVuXG4gKiBAcGFyYW0gbm9kZUluZGV4IDMgY2FzZXMgZGVwZW5kaW5nIG9uIHRoZSB2YWx1ZTpcbiAqIC0gdW5kZWZpbmVkOiBhbGwgaG9va3MgZnJvbSB0aGUgYXJyYXkgc2hvdWxkIGJlIGV4ZWN1dGVkIChwb3N0LW9yZGVyIGNhc2UpXG4gKiAtIG51bGw6IGV4ZWN1dGUgaG9va3Mgb25seSBmcm9tIHRoZSBzYXZlZCBpbmRleCB1bnRpbCB0aGUgZW5kIG9mIHRoZSBhcnJheSAocHJlLW9yZGVyIGNhc2UsIHdoZW5cbiAqIGZsdXNoaW5nIHRoZSByZW1haW5pbmcgaG9va3MpXG4gKiAtIG51bWJlcjogZXhlY3V0ZSBob29rcyBvbmx5IGZyb20gdGhlIHNhdmVkIGluZGV4IHVudGlsIHRoYXQgbm9kZSBpbmRleCBleGNsdXNpdmUgKHByZS1vcmRlclxuICogY2FzZSwgd2hlbiBleGVjdXRpbmcgc2VsZWN0KG51bWJlcikpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleGVjdXRlQ2hlY2tIb29rcyhsVmlldzogTFZpZXcsIGhvb2tzOiBIb29rRGF0YSwgbm9kZUluZGV4PzogbnVtYmVyIHwgbnVsbCkge1xuICBjYWxsSG9va3MobFZpZXcsIGhvb2tzLCBJbml0UGhhc2VTdGF0ZS5Jbml0UGhhc2VDb21wbGV0ZWQsIG5vZGVJbmRleCk7XG59XG5cbi8qKlxuICogRXhlY3V0ZXMgcG9zdC1vcmRlciBpbml0IGFuZCBjaGVjayBob29rcyAob25lIG9mIEFmdGVyQ29udGVudEluaXQsIEFmdGVyQ29udGVudENoZWNrZWQsXG4gKiBBZnRlclZpZXdJbml0LCBBZnRlclZpZXdDaGVja2VkKSBnaXZlbiBhIHZpZXcgd2hlcmUgdGhlcmUgYXJlIHBlbmRpbmcgaW5pdCBob29rcyB0byBiZSBleGVjdXRlZC5cbiAqIEBwYXJhbSBsVmlldyBUaGUgTFZpZXcgd2hlcmUgaG9va3MgYXJlIGRlZmluZWRcbiAqIEBwYXJhbSBob29rcyBIb29rcyB0byBiZSBydW5cbiAqIEBwYXJhbSBpbml0UGhhc2UgQSBwaGFzZSBmb3Igd2hpY2ggaG9va3Mgc2hvdWxkIGJlIHJ1blxuICogQHBhcmFtIG5vZGVJbmRleCAzIGNhc2VzIGRlcGVuZGluZyBvbiB0aGUgdmFsdWU6XG4gKiAtIHVuZGVmaW5lZDogYWxsIGhvb2tzIGZyb20gdGhlIGFycmF5IHNob3VsZCBiZSBleGVjdXRlZCAocG9zdC1vcmRlciBjYXNlKVxuICogLSBudWxsOiBleGVjdXRlIGhvb2tzIG9ubHkgZnJvbSB0aGUgc2F2ZWQgaW5kZXggdW50aWwgdGhlIGVuZCBvZiB0aGUgYXJyYXkgKHByZS1vcmRlciBjYXNlLCB3aGVuXG4gKiBmbHVzaGluZyB0aGUgcmVtYWluaW5nIGhvb2tzKVxuICogLSBudW1iZXI6IGV4ZWN1dGUgaG9va3Mgb25seSBmcm9tIHRoZSBzYXZlZCBpbmRleCB1bnRpbCB0aGF0IG5vZGUgaW5kZXggZXhjbHVzaXZlIChwcmUtb3JkZXJcbiAqIGNhc2UsIHdoZW4gZXhlY3V0aW5nIHNlbGVjdChudW1iZXIpKVxuICovXG5leHBvcnQgZnVuY3Rpb24gZXhlY3V0ZUluaXRBbmRDaGVja0hvb2tzKFxuICBsVmlldzogTFZpZXcsXG4gIGhvb2tzOiBIb29rRGF0YSxcbiAgaW5pdFBoYXNlOiBJbml0UGhhc2VTdGF0ZSxcbiAgbm9kZUluZGV4PzogbnVtYmVyIHwgbnVsbCxcbikge1xuICBuZ0Rldk1vZGUgJiZcbiAgICBhc3NlcnROb3RFcXVhbChcbiAgICAgIGluaXRQaGFzZSxcbiAgICAgIEluaXRQaGFzZVN0YXRlLkluaXRQaGFzZUNvbXBsZXRlZCxcbiAgICAgICdJbml0IHByZS1vcmRlciBob29rcyBzaG91bGQgbm90IGJlIGNhbGxlZCBtb3JlIHRoYW4gb25jZScsXG4gICAgKTtcbiAgaWYgKChsVmlld1tGTEFHU10gJiBMVmlld0ZsYWdzLkluaXRQaGFzZVN0YXRlTWFzaykgPT09IGluaXRQaGFzZSkge1xuICAgIGNhbGxIb29rcyhsVmlldywgaG9va3MsIGluaXRQaGFzZSwgbm9kZUluZGV4KTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5jcmVtZW50SW5pdFBoYXNlRmxhZ3MobFZpZXc6IExWaWV3LCBpbml0UGhhc2U6IEluaXRQaGFzZVN0YXRlKTogdm9pZCB7XG4gIG5nRGV2TW9kZSAmJlxuICAgIGFzc2VydE5vdEVxdWFsKFxuICAgICAgaW5pdFBoYXNlLFxuICAgICAgSW5pdFBoYXNlU3RhdGUuSW5pdFBoYXNlQ29tcGxldGVkLFxuICAgICAgJ0luaXQgaG9va3MgcGhhc2Ugc2hvdWxkIG5vdCBiZSBpbmNyZW1lbnRlZCBhZnRlciBhbGwgaW5pdCBob29rcyBoYXZlIGJlZW4gcnVuLicsXG4gICAgKTtcbiAgbGV0IGZsYWdzID0gbFZpZXdbRkxBR1NdO1xuICBpZiAoKGZsYWdzICYgTFZpZXdGbGFncy5Jbml0UGhhc2VTdGF0ZU1hc2spID09PSBpbml0UGhhc2UpIHtcbiAgICBmbGFncyAmPSBMVmlld0ZsYWdzLkluZGV4V2l0aGluSW5pdFBoYXNlUmVzZXQ7XG4gICAgZmxhZ3MgKz0gTFZpZXdGbGFncy5Jbml0UGhhc2VTdGF0ZUluY3JlbWVudGVyO1xuICAgIGxWaWV3W0ZMQUdTXSA9IGZsYWdzO1xuICB9XG59XG5cbi8qKlxuICogQ2FsbHMgbGlmZWN5Y2xlIGhvb2tzIHdpdGggdGhlaXIgY29udGV4dHMsIHNraXBwaW5nIGluaXQgaG9va3MgaWYgaXQncyBub3RcbiAqIHRoZSBmaXJzdCBMVmlldyBwYXNzXG4gKlxuICogQHBhcmFtIGN1cnJlbnRWaWV3IFRoZSBjdXJyZW50IHZpZXdcbiAqIEBwYXJhbSBhcnIgVGhlIGFycmF5IGluIHdoaWNoIHRoZSBob29rcyBhcmUgZm91bmRcbiAqIEBwYXJhbSBpbml0UGhhc2VTdGF0ZSB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgaW5pdCBwaGFzZVxuICogQHBhcmFtIGN1cnJlbnROb2RlSW5kZXggMyBjYXNlcyBkZXBlbmRpbmcgb24gdGhlIHZhbHVlOlxuICogLSB1bmRlZmluZWQ6IGFsbCBob29rcyBmcm9tIHRoZSBhcnJheSBzaG91bGQgYmUgZXhlY3V0ZWQgKHBvc3Qtb3JkZXIgY2FzZSlcbiAqIC0gbnVsbDogZXhlY3V0ZSBob29rcyBvbmx5IGZyb20gdGhlIHNhdmVkIGluZGV4IHVudGlsIHRoZSBlbmQgb2YgdGhlIGFycmF5IChwcmUtb3JkZXIgY2FzZSwgd2hlblxuICogZmx1c2hpbmcgdGhlIHJlbWFpbmluZyBob29rcylcbiAqIC0gbnVtYmVyOiBleGVjdXRlIGhvb2tzIG9ubHkgZnJvbSB0aGUgc2F2ZWQgaW5kZXggdW50aWwgdGhhdCBub2RlIGluZGV4IGV4Y2x1c2l2ZSAocHJlLW9yZGVyXG4gKiBjYXNlLCB3aGVuIGV4ZWN1dGluZyBzZWxlY3QobnVtYmVyKSlcbiAqL1xuZnVuY3Rpb24gY2FsbEhvb2tzKFxuICBjdXJyZW50VmlldzogTFZpZXcsXG4gIGFycjogSG9va0RhdGEsXG4gIGluaXRQaGFzZTogSW5pdFBoYXNlU3RhdGUsXG4gIGN1cnJlbnROb2RlSW5kZXg6IG51bWJlciB8IG51bGwgfCB1bmRlZmluZWQsXG4pOiB2b2lkIHtcbiAgbmdEZXZNb2RlICYmXG4gICAgYXNzZXJ0RXF1YWwoXG4gICAgICBpc0luQ2hlY2tOb0NoYW5nZXNNb2RlKCksXG4gICAgICBmYWxzZSxcbiAgICAgICdIb29rcyBzaG91bGQgbmV2ZXIgYmUgcnVuIHdoZW4gaW4gY2hlY2sgbm8gY2hhbmdlcyBtb2RlLicsXG4gICAgKTtcbiAgY29uc3Qgc3RhcnRJbmRleCA9XG4gICAgY3VycmVudE5vZGVJbmRleCAhPT0gdW5kZWZpbmVkXG4gICAgICA/IGN1cnJlbnRWaWV3W1BSRU9SREVSX0hPT0tfRkxBR1NdICYgUHJlT3JkZXJIb29rRmxhZ3MuSW5kZXhPZlRoZU5leHRQcmVPcmRlckhvb2tNYXNrTWFza1xuICAgICAgOiAwO1xuICBjb25zdCBub2RlSW5kZXhMaW1pdCA9IGN1cnJlbnROb2RlSW5kZXggIT0gbnVsbCA/IGN1cnJlbnROb2RlSW5kZXggOiAtMTtcbiAgY29uc3QgbWF4ID0gYXJyLmxlbmd0aCAtIDE7IC8vIFN0b3AgdGhlIGxvb3AgYXQgbGVuZ3RoIC0gMSwgYmVjYXVzZSB3ZSBsb29rIGZvciB0aGUgaG9vayBhdCBpICsgMVxuICBsZXQgbGFzdE5vZGVJbmRleEZvdW5kID0gMDtcbiAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPCBtYXg7IGkrKykge1xuICAgIGNvbnN0IGhvb2sgPSBhcnJbaSArIDFdIGFzIG51bWJlciB8ICgoKSA9PiB2b2lkKTtcbiAgICBpZiAodHlwZW9mIGhvb2sgPT09ICdudW1iZXInKSB7XG4gICAgICBsYXN0Tm9kZUluZGV4Rm91bmQgPSBhcnJbaV0gYXMgbnVtYmVyO1xuICAgICAgaWYgKGN1cnJlbnROb2RlSW5kZXggIT0gbnVsbCAmJiBsYXN0Tm9kZUluZGV4Rm91bmQgPj0gY3VycmVudE5vZGVJbmRleCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgaXNJbml0SG9vayA9IChhcnJbaV0gYXMgbnVtYmVyKSA8IDA7XG4gICAgICBpZiAoaXNJbml0SG9vaykge1xuICAgICAgICBjdXJyZW50Vmlld1tQUkVPUkRFUl9IT09LX0ZMQUdTXSArPSBQcmVPcmRlckhvb2tGbGFncy5OdW1iZXJPZkluaXRIb29rc0NhbGxlZEluY3JlbWVudGVyO1xuICAgICAgfVxuICAgICAgaWYgKGxhc3ROb2RlSW5kZXhGb3VuZCA8IG5vZGVJbmRleExpbWl0IHx8IG5vZGVJbmRleExpbWl0ID09IC0xKSB7XG4gICAgICAgIGNhbGxIb29rKGN1cnJlbnRWaWV3LCBpbml0UGhhc2UsIGFyciwgaSk7XG4gICAgICAgIGN1cnJlbnRWaWV3W1BSRU9SREVSX0hPT0tfRkxBR1NdID1cbiAgICAgICAgICAoY3VycmVudFZpZXdbUFJFT1JERVJfSE9PS19GTEFHU10gJiBQcmVPcmRlckhvb2tGbGFncy5OdW1iZXJPZkluaXRIb29rc0NhbGxlZE1hc2spICtcbiAgICAgICAgICBpICtcbiAgICAgICAgICAyO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEV4ZWN1dGVzIGEgc2luZ2xlIGxpZmVjeWNsZSBob29rLCBtYWtpbmcgc3VyZSB0aGF0OlxuICogLSBpdCBpcyBjYWxsZWQgaW4gdGhlIG5vbi1yZWFjdGl2ZSBjb250ZXh0O1xuICogLSBwcm9maWxpbmcgZGF0YSBhcmUgcmVnaXN0ZXJlZC5cbiAqL1xuZnVuY3Rpb24gY2FsbEhvb2tJbnRlcm5hbChkaXJlY3RpdmU6IGFueSwgaG9vazogKCkgPT4gdm9pZCkge1xuICBwcm9maWxlcihQcm9maWxlckV2ZW50LkxpZmVjeWNsZUhvb2tTdGFydCwgZGlyZWN0aXZlLCBob29rKTtcbiAgY29uc3QgcHJldkNvbnN1bWVyID0gc2V0QWN0aXZlQ29uc3VtZXIobnVsbCk7XG4gIHRyeSB7XG4gICAgaG9vay5jYWxsKGRpcmVjdGl2ZSk7XG4gIH0gZmluYWxseSB7XG4gICAgc2V0QWN0aXZlQ29uc3VtZXIocHJldkNvbnN1bWVyKTtcbiAgICBwcm9maWxlcihQcm9maWxlckV2ZW50LkxpZmVjeWNsZUhvb2tFbmQsIGRpcmVjdGl2ZSwgaG9vayk7XG4gIH1cbn1cblxuLyoqXG4gKiBFeGVjdXRlIG9uZSBob29rIGFnYWluc3QgdGhlIGN1cnJlbnQgYExWaWV3YC5cbiAqXG4gKiBAcGFyYW0gY3VycmVudFZpZXcgVGhlIGN1cnJlbnQgdmlld1xuICogQHBhcmFtIGluaXRQaGFzZVN0YXRlIHRoZSBjdXJyZW50IHN0YXRlIG9mIHRoZSBpbml0IHBoYXNlXG4gKiBAcGFyYW0gYXJyIFRoZSBhcnJheSBpbiB3aGljaCB0aGUgaG9va3MgYXJlIGZvdW5kXG4gKiBAcGFyYW0gaSBUaGUgY3VycmVudCBpbmRleCB3aXRoaW4gdGhlIGhvb2sgZGF0YSBhcnJheVxuICovXG5mdW5jdGlvbiBjYWxsSG9vayhjdXJyZW50VmlldzogTFZpZXcsIGluaXRQaGFzZTogSW5pdFBoYXNlU3RhdGUsIGFycjogSG9va0RhdGEsIGk6IG51bWJlcikge1xuICBjb25zdCBpc0luaXRIb29rID0gKGFycltpXSBhcyBudW1iZXIpIDwgMDtcbiAgY29uc3QgaG9vayA9IGFycltpICsgMV0gYXMgKCkgPT4gdm9pZDtcbiAgY29uc3QgZGlyZWN0aXZlSW5kZXggPSBpc0luaXRIb29rID8gLWFycltpXSA6IChhcnJbaV0gYXMgbnVtYmVyKTtcbiAgY29uc3QgZGlyZWN0aXZlID0gY3VycmVudFZpZXdbZGlyZWN0aXZlSW5kZXhdO1xuICBpZiAoaXNJbml0SG9vaykge1xuICAgIGNvbnN0IGluZGV4V2l0aGludEluaXRQaGFzZSA9IGN1cnJlbnRWaWV3W0ZMQUdTXSA+PiBMVmlld0ZsYWdzLkluZGV4V2l0aGluSW5pdFBoYXNlU2hpZnQ7XG4gICAgLy8gVGhlIGluaXQgcGhhc2Ugc3RhdGUgbXVzdCBiZSBhbHdheXMgY2hlY2tlZCBoZXJlIGFzIGl0IG1heSBoYXZlIGJlZW4gcmVjdXJzaXZlbHkgdXBkYXRlZC5cbiAgICBpZiAoXG4gICAgICBpbmRleFdpdGhpbnRJbml0UGhhc2UgPFxuICAgICAgICBjdXJyZW50Vmlld1tQUkVPUkRFUl9IT09LX0ZMQUdTXSA+PiBQcmVPcmRlckhvb2tGbGFncy5OdW1iZXJPZkluaXRIb29rc0NhbGxlZFNoaWZ0ICYmXG4gICAgICAoY3VycmVudFZpZXdbRkxBR1NdICYgTFZpZXdGbGFncy5Jbml0UGhhc2VTdGF0ZU1hc2spID09PSBpbml0UGhhc2VcbiAgICApIHtcbiAgICAgIGN1cnJlbnRWaWV3W0ZMQUdTXSArPSBMVmlld0ZsYWdzLkluZGV4V2l0aGluSW5pdFBoYXNlSW5jcmVtZW50ZXI7XG4gICAgICBjYWxsSG9va0ludGVybmFsKGRpcmVjdGl2ZSwgaG9vayk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGNhbGxIb29rSW50ZXJuYWwoZGlyZWN0aXZlLCBob29rKTtcbiAgfVxufVxuIl19