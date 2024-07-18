/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { consumerAfterComputation, consumerBeforeComputation, consumerDestroy, consumerPollProducersForChange, getActiveConsumer, } from '@angular/core/primitives/signals';
import { RuntimeError } from '../../errors';
import { assertDefined, assertEqual } from '../../util/assert';
import { executeCheckHooks, executeInitAndCheckHooks, incrementInitPhaseFlags } from '../hooks';
import { CONTAINER_HEADER_OFFSET, LContainerFlags, MOVED_VIEWS } from '../interfaces/container';
import { CONTEXT, EFFECTS_TO_SCHEDULE, ENVIRONMENT, FLAGS, REACTIVE_TEMPLATE_CONSUMER, TVIEW, } from '../interfaces/view';
import { getOrCreateTemporaryConsumer, getOrBorrowReactiveLViewConsumer, maybeReturnReactiveLViewConsumer, viewShouldHaveReactiveConsumer, } from '../reactive_lview_consumer';
import { CheckNoChangesMode, enterView, isExhaustiveCheckNoChanges, isInCheckNoChangesMode, isRefreshingViews, leaveView, setBindingIndex, setIsInCheckNoChangesMode, setIsRefreshingViews, } from '../state';
import { getFirstLContainer, getNextLContainer } from '../util/view_traversal_utils';
import { getComponentLViewByIndex, isCreationMode, markAncestorsForTraversal, markViewForRefresh, requiresRefreshOrTraversal, resetPreOrderHookFlags, viewAttachedToChangeDetector, } from '../util/view_utils';
import { executeTemplate, executeViewQueryFn, handleError, processHostBindingOpCodes, refreshContentQueries, } from './shared';
/**
 * The maximum number of times the change detection traversal will rerun before throwing an error.
 */
export const MAXIMUM_REFRESH_RERUNS = 100;
export function detectChangesInternal(lView, notifyErrorHandler = true, mode = 0 /* ChangeDetectionMode.Global */) {
    const environment = lView[ENVIRONMENT];
    const rendererFactory = environment.rendererFactory;
    // Check no changes mode is a dev only mode used to verify that bindings have not changed
    // since they were assigned. We do not want to invoke renderer factory functions in that mode
    // to avoid any possible side-effects.
    const checkNoChangesMode = !!ngDevMode && isInCheckNoChangesMode();
    if (!checkNoChangesMode) {
        rendererFactory.begin?.();
    }
    try {
        detectChangesInViewWhileDirty(lView, mode);
    }
    catch (error) {
        if (notifyErrorHandler) {
            handleError(lView, error);
        }
        throw error;
    }
    finally {
        if (!checkNoChangesMode) {
            rendererFactory.end?.();
            // One final flush of the effects queue to catch any effects created in `ngAfterViewInit` or
            // other post-order hooks.
            environment.inlineEffectRunner?.flush();
        }
    }
}
function detectChangesInViewWhileDirty(lView, mode) {
    const lastIsRefreshingViewsValue = isRefreshingViews();
    try {
        setIsRefreshingViews(true);
        detectChangesInView(lView, mode);
        // We don't need or want to do any looping when in exhaustive checkNoChanges because we
        // already traverse all the views and nothing should change so we shouldn't have to do
        // another pass to pick up new changes.
        if (ngDevMode && isExhaustiveCheckNoChanges()) {
            return;
        }
        let retries = 0;
        // If after running change detection, this view still needs to be refreshed or there are
        // descendants views that need to be refreshed due to re-dirtying during the change detection
        // run, detect changes on the view again. We run change detection in `Targeted` mode to only
        // refresh views with the `RefreshView` flag.
        while (requiresRefreshOrTraversal(lView)) {
            if (retries === MAXIMUM_REFRESH_RERUNS) {
                throw new RuntimeError(103 /* RuntimeErrorCode.INFINITE_CHANGE_DETECTION */, ngDevMode &&
                    'Infinite change detection while trying to refresh views. ' +
                        'There may be components which each cause the other to require a refresh, ' +
                        'causing an infinite loop.');
            }
            retries++;
            // Even if this view is detached, we still detect changes in targeted mode because this was
            // the root of the change detection run.
            detectChangesInView(lView, 1 /* ChangeDetectionMode.Targeted */);
        }
    }
    finally {
        // restore state to what it was before entering this change detection loop
        setIsRefreshingViews(lastIsRefreshingViewsValue);
    }
}
export function checkNoChangesInternal(lView, mode, notifyErrorHandler = true) {
    setIsInCheckNoChangesMode(mode);
    try {
        detectChangesInternal(lView, notifyErrorHandler);
    }
    finally {
        setIsInCheckNoChangesMode(CheckNoChangesMode.Off);
    }
}
/**
 * Processes a view in update mode. This includes a number of steps in a specific order:
 * - executing a template function in update mode;
 * - executing hooks;
 * - refreshing queries;
 * - setting host bindings;
 * - refreshing child (embedded and component) views.
 */
export function refreshView(tView, lView, templateFn, context) {
    ngDevMode && assertEqual(isCreationMode(lView), false, 'Should be run in update mode');
    const flags = lView[FLAGS];
    if ((flags & 256 /* LViewFlags.Destroyed */) === 256 /* LViewFlags.Destroyed */)
        return;
    // Check no changes mode is a dev only mode used to verify that bindings have not changed
    // since they were assigned. We do not want to execute lifecycle hooks in that mode.
    const isInCheckNoChangesPass = ngDevMode && isInCheckNoChangesMode();
    const isInExhaustiveCheckNoChangesPass = ngDevMode && isExhaustiveCheckNoChanges();
    !isInCheckNoChangesPass && lView[ENVIRONMENT].inlineEffectRunner?.flush();
    // Start component reactive context
    // - We might already be in a reactive context if this is an embedded view of the host.
    // - We might be descending into a view that needs a consumer.
    enterView(lView);
    let returnConsumerToPool = true;
    let prevConsumer = null;
    let currentConsumer = null;
    if (!isInCheckNoChangesPass) {
        if (viewShouldHaveReactiveConsumer(tView)) {
            currentConsumer = getOrBorrowReactiveLViewConsumer(lView);
            prevConsumer = consumerBeforeComputation(currentConsumer);
        }
        else if (getActiveConsumer() === null) {
            // If the current view should not have a reactive consumer but we don't have an active consumer,
            // we still need to create a temporary consumer to track any signal reads in this template.
            // This is a rare case that can happen with `viewContainerRef.createEmbeddedView(...).detectChanges()`.
            // This temporary consumer marks the first parent that _should_ have a consumer for refresh.
            // Once that refresh happens, the signals will be tracked in the parent consumer and we can destroy
            // the temporary one.
            returnConsumerToPool = false;
            currentConsumer = getOrCreateTemporaryConsumer(lView);
            prevConsumer = consumerBeforeComputation(currentConsumer);
        }
        else if (lView[REACTIVE_TEMPLATE_CONSUMER]) {
            consumerDestroy(lView[REACTIVE_TEMPLATE_CONSUMER]);
            lView[REACTIVE_TEMPLATE_CONSUMER] = null;
        }
    }
    try {
        resetPreOrderHookFlags(lView);
        setBindingIndex(tView.bindingStartIndex);
        if (templateFn !== null) {
            executeTemplate(tView, lView, templateFn, 2 /* RenderFlags.Update */, context);
        }
        const hooksInitPhaseCompleted = (flags & 3 /* LViewFlags.InitPhaseStateMask */) === 3 /* InitPhaseState.InitPhaseCompleted */;
        // execute pre-order hooks (OnInit, OnChanges, DoCheck)
        // PERF WARNING: do NOT extract this to a separate function without running benchmarks
        if (!isInCheckNoChangesPass) {
            if (hooksInitPhaseCompleted) {
                const preOrderCheckHooks = tView.preOrderCheckHooks;
                if (preOrderCheckHooks !== null) {
                    executeCheckHooks(lView, preOrderCheckHooks, null);
                }
            }
            else {
                const preOrderHooks = tView.preOrderHooks;
                if (preOrderHooks !== null) {
                    executeInitAndCheckHooks(lView, preOrderHooks, 0 /* InitPhaseState.OnInitHooksToBeRun */, null);
                }
                incrementInitPhaseFlags(lView, 0 /* InitPhaseState.OnInitHooksToBeRun */);
            }
        }
        // We do not need to mark transplanted views for refresh when doing exhaustive checks
        // because all views will be reached anyways during the traversal.
        if (!isInExhaustiveCheckNoChangesPass) {
            // First mark transplanted views that are declared in this lView as needing a refresh at their
            // insertion points. This is needed to avoid the situation where the template is defined in this
            // `LView` but its declaration appears after the insertion component.
            markTransplantedViewsForRefresh(lView);
        }
        detectChangesInEmbeddedViews(lView, 0 /* ChangeDetectionMode.Global */);
        // Content query results must be refreshed before content hooks are called.
        if (tView.contentQueries !== null) {
            refreshContentQueries(tView, lView);
        }
        // execute content hooks (AfterContentInit, AfterContentChecked)
        // PERF WARNING: do NOT extract this to a separate function without running benchmarks
        if (!isInCheckNoChangesPass) {
            if (hooksInitPhaseCompleted) {
                const contentCheckHooks = tView.contentCheckHooks;
                if (contentCheckHooks !== null) {
                    executeCheckHooks(lView, contentCheckHooks);
                }
            }
            else {
                const contentHooks = tView.contentHooks;
                if (contentHooks !== null) {
                    executeInitAndCheckHooks(lView, contentHooks, 1 /* InitPhaseState.AfterContentInitHooksToBeRun */);
                }
                incrementInitPhaseFlags(lView, 1 /* InitPhaseState.AfterContentInitHooksToBeRun */);
            }
        }
        processHostBindingOpCodes(tView, lView);
        // Refresh child component views.
        const components = tView.components;
        if (components !== null) {
            detectChangesInChildComponents(lView, components, 0 /* ChangeDetectionMode.Global */);
        }
        // View queries must execute after refreshing child components because a template in this view
        // could be inserted in a child component. If the view query executes before child component
        // refresh, the template might not yet be inserted.
        const viewQuery = tView.viewQuery;
        if (viewQuery !== null) {
            executeViewQueryFn(2 /* RenderFlags.Update */, viewQuery, context);
        }
        // execute view hooks (AfterViewInit, AfterViewChecked)
        // PERF WARNING: do NOT extract this to a separate function without running benchmarks
        if (!isInCheckNoChangesPass) {
            if (hooksInitPhaseCompleted) {
                const viewCheckHooks = tView.viewCheckHooks;
                if (viewCheckHooks !== null) {
                    executeCheckHooks(lView, viewCheckHooks);
                }
            }
            else {
                const viewHooks = tView.viewHooks;
                if (viewHooks !== null) {
                    executeInitAndCheckHooks(lView, viewHooks, 2 /* InitPhaseState.AfterViewInitHooksToBeRun */);
                }
                incrementInitPhaseFlags(lView, 2 /* InitPhaseState.AfterViewInitHooksToBeRun */);
            }
        }
        if (tView.firstUpdatePass === true) {
            // We need to make sure that we only flip the flag on successful `refreshView` only
            // Don't do this in `finally` block.
            // If we did this in `finally` block then an exception could block the execution of styling
            // instructions which in turn would be unable to insert themselves into the styling linked
            // list. The result of this would be that if the exception would not be throw on subsequent CD
            // the styling would be unable to process it data and reflect to the DOM.
            tView.firstUpdatePass = false;
        }
        // Schedule any effects that are waiting on the update pass of this view.
        if (lView[EFFECTS_TO_SCHEDULE]) {
            for (const notifyEffect of lView[EFFECTS_TO_SCHEDULE]) {
                notifyEffect();
            }
            // Once they've been run, we can drop the array.
            lView[EFFECTS_TO_SCHEDULE] = null;
        }
        // Do not reset the dirty state when running in check no changes mode. We don't want components
        // to behave differently depending on whether check no changes is enabled or not. For example:
        // Marking an OnPush component as dirty from within the `ngAfterViewInit` hook in order to
        // refresh a `NgClass` binding should work. If we would reset the dirty state in the check
        // no changes cycle, the component would be not be dirty for the next update pass. This would
        // be different in production mode where the component dirty state is not reset.
        if (!isInCheckNoChangesPass) {
            lView[FLAGS] &= ~(64 /* LViewFlags.Dirty */ | 8 /* LViewFlags.FirstLViewPass */);
        }
    }
    catch (e) {
        if (!isInCheckNoChangesPass) {
            // If refreshing a view causes an error, we need to remark the ancestors as needing traversal
            // because the error might have caused a situation where views below the current location are
            // dirty but will be unreachable because the "has dirty children" flag in the ancestors has been
            // cleared during change detection and we failed to run to completion.
            markAncestorsForTraversal(lView);
        }
        throw e;
    }
    finally {
        if (currentConsumer !== null) {
            consumerAfterComputation(currentConsumer, prevConsumer);
            if (returnConsumerToPool) {
                maybeReturnReactiveLViewConsumer(currentConsumer);
            }
        }
        leaveView();
    }
}
/**
 * Goes over embedded views (ones created through ViewContainerRef APIs) and refreshes
 * them by executing an associated template function.
 */
function detectChangesInEmbeddedViews(lView, mode) {
    for (let lContainer = getFirstLContainer(lView); lContainer !== null; lContainer = getNextLContainer(lContainer)) {
        for (let i = CONTAINER_HEADER_OFFSET; i < lContainer.length; i++) {
            const embeddedLView = lContainer[i];
            detectChangesInViewIfAttached(embeddedLView, mode);
        }
    }
}
/**
 * Mark transplanted views as needing to be refreshed at their attachment points.
 *
 * @param lView The `LView` that may have transplanted views.
 */
function markTransplantedViewsForRefresh(lView) {
    for (let lContainer = getFirstLContainer(lView); lContainer !== null; lContainer = getNextLContainer(lContainer)) {
        if (!(lContainer[FLAGS] & LContainerFlags.HasTransplantedViews))
            continue;
        const movedViews = lContainer[MOVED_VIEWS];
        ngDevMode && assertDefined(movedViews, 'Transplanted View flags set but missing MOVED_VIEWS');
        for (let i = 0; i < movedViews.length; i++) {
            const movedLView = movedViews[i];
            markViewForRefresh(movedLView);
        }
    }
}
/**
 * Detects changes in a component by entering the component view and processing its bindings,
 * queries, etc. if it is CheckAlways, OnPush and Dirty, etc.
 *
 * @param componentHostIdx  Element index in LView[] (adjusted for HEADER_OFFSET)
 */
function detectChangesInComponent(hostLView, componentHostIdx, mode) {
    ngDevMode && assertEqual(isCreationMode(hostLView), false, 'Should be run in update mode');
    const componentView = getComponentLViewByIndex(componentHostIdx, hostLView);
    detectChangesInViewIfAttached(componentView, mode);
}
/**
 * Visits a view as part of change detection traversal.
 *
 * If the view is detached, no additional traversal happens.
 */
function detectChangesInViewIfAttached(lView, mode) {
    if (!viewAttachedToChangeDetector(lView)) {
        return;
    }
    detectChangesInView(lView, mode);
}
/**
 * Visits a view as part of change detection traversal.
 *
 * The view is refreshed if:
 * - If the view is CheckAlways or Dirty and ChangeDetectionMode is `Global`
 * - If the view has the `RefreshView` flag
 *
 * The view is not refreshed, but descendants are traversed in `ChangeDetectionMode.Targeted` if the
 * view HasChildViewsToRefresh flag is set.
 */
function detectChangesInView(lView, mode) {
    const isInCheckNoChangesPass = ngDevMode && isInCheckNoChangesMode();
    const tView = lView[TVIEW];
    const flags = lView[FLAGS];
    const consumer = lView[REACTIVE_TEMPLATE_CONSUMER];
    // Refresh CheckAlways views in Global mode.
    let shouldRefreshView = !!(mode === 0 /* ChangeDetectionMode.Global */ && flags & 16 /* LViewFlags.CheckAlways */);
    // Refresh Dirty views in Global mode, as long as we're not in checkNoChanges.
    // CheckNoChanges never worked with `OnPush` components because the `Dirty` flag was
    // cleared before checkNoChanges ran. Because there is now a loop for to check for
    // backwards views, it gives an opportunity for `OnPush` components to be marked `Dirty`
    // before the CheckNoChanges pass. We don't want existing errors that are hidden by the
    // current CheckNoChanges bug to surface when making unrelated changes.
    shouldRefreshView ||= !!(flags & 64 /* LViewFlags.Dirty */ &&
        mode === 0 /* ChangeDetectionMode.Global */ &&
        !isInCheckNoChangesPass);
    // Always refresh views marked for refresh, regardless of mode.
    shouldRefreshView ||= !!(flags & 1024 /* LViewFlags.RefreshView */);
    // Refresh views when they have a dirty reactive consumer, regardless of mode.
    shouldRefreshView ||= !!(consumer?.dirty && consumerPollProducersForChange(consumer));
    shouldRefreshView ||= !!(ngDevMode && isExhaustiveCheckNoChanges());
    // Mark the Flags and `ReactiveNode` as not dirty before refreshing the component, so that they
    // can be re-dirtied during the refresh process.
    if (consumer) {
        consumer.dirty = false;
    }
    lView[FLAGS] &= ~(8192 /* LViewFlags.HasChildViewsToRefresh */ | 1024 /* LViewFlags.RefreshView */);
    if (shouldRefreshView) {
        refreshView(tView, lView, tView.template, lView[CONTEXT]);
    }
    else if (flags & 8192 /* LViewFlags.HasChildViewsToRefresh */) {
        detectChangesInEmbeddedViews(lView, 1 /* ChangeDetectionMode.Targeted */);
        const components = tView.components;
        if (components !== null) {
            detectChangesInChildComponents(lView, components, 1 /* ChangeDetectionMode.Targeted */);
        }
    }
}
/** Refreshes child components in the current view (update mode). */
function detectChangesInChildComponents(hostLView, components, mode) {
    for (let i = 0; i < components.length; i++) {
        detectChangesInComponent(hostLView, components[i], mode);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhbmdlX2RldGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3JlbmRlcjMvaW5zdHJ1Y3Rpb25zL2NoYW5nZV9kZXRlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUNMLHdCQUF3QixFQUN4Qix5QkFBeUIsRUFDekIsZUFBZSxFQUNmLDhCQUE4QixFQUM5QixpQkFBaUIsR0FFbEIsTUFBTSxrQ0FBa0MsQ0FBQztBQUUxQyxPQUFPLEVBQUMsWUFBWSxFQUFtQixNQUFNLGNBQWMsQ0FBQztBQUM1RCxPQUFPLEVBQUMsYUFBYSxFQUFFLFdBQVcsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQzdELE9BQU8sRUFBQyxpQkFBaUIsRUFBRSx3QkFBd0IsRUFBRSx1QkFBdUIsRUFBQyxNQUFNLFVBQVUsQ0FBQztBQUM5RixPQUFPLEVBQUMsdUJBQXVCLEVBQUUsZUFBZSxFQUFFLFdBQVcsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTlGLE9BQU8sRUFDTCxPQUFPLEVBQ1AsbUJBQW1CLEVBQ25CLFdBQVcsRUFDWCxLQUFLLEVBSUwsMEJBQTBCLEVBQzFCLEtBQUssR0FFTixNQUFNLG9CQUFvQixDQUFDO0FBQzVCLE9BQU8sRUFDTCw0QkFBNEIsRUFDNUIsZ0NBQWdDLEVBQ2hDLGdDQUFnQyxFQUVoQyw4QkFBOEIsR0FDL0IsTUFBTSw0QkFBNEIsQ0FBQztBQUNwQyxPQUFPLEVBQ0wsa0JBQWtCLEVBQ2xCLFNBQVMsRUFDVCwwQkFBMEIsRUFDMUIsc0JBQXNCLEVBQ3RCLGlCQUFpQixFQUNqQixTQUFTLEVBQ1QsZUFBZSxFQUNmLHlCQUF5QixFQUN6QixvQkFBb0IsR0FDckIsTUFBTSxVQUFVLENBQUM7QUFDbEIsT0FBTyxFQUFDLGtCQUFrQixFQUFFLGlCQUFpQixFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDbkYs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QUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7UUFDM0Msd0JBQXdCLENBQUMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMzRCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBjb25zdW1lckFmdGVyQ29tcHV0YXRpb24sXG4gIGNvbnN1bWVyQmVmb3JlQ29tcHV0YXRpb24sXG4gIGNvbnN1bWVyRGVzdHJveSxcbiAgY29uc3VtZXJQb2xsUHJvZHVjZXJzRm9yQ2hhbmdlLFxuICBnZXRBY3RpdmVDb25zdW1lcixcbiAgUmVhY3RpdmVOb2RlLFxufSBmcm9tICdAYW5ndWxhci9jb3JlL3ByaW1pdGl2ZXMvc2lnbmFscyc7XG5cbmltcG9ydCB7UnVudGltZUVycm9yLCBSdW50aW1lRXJyb3JDb2RlfSBmcm9tICcuLi8uLi9lcnJvcnMnO1xuaW1wb3J0IHthc3NlcnREZWZpbmVkLCBhc3NlcnRFcXVhbH0gZnJvbSAnLi4vLi4vdXRpbC9hc3NlcnQnO1xuaW1wb3J0IHtleGVjdXRlQ2hlY2tIb29rcywgZXhlY3V0ZUluaXRBbmRDaGVja0hvb2tzLCBpbmNyZW1lbnRJbml0UGhhc2VGbGFnc30gZnJvbSAnLi4vaG9va3MnO1xuaW1wb3J0IHtDT05UQUlORVJfSEVBREVSX09GRlNFVCwgTENvbnRhaW5lckZsYWdzLCBNT1ZFRF9WSUVXU30gZnJvbSAnLi4vaW50ZXJmYWNlcy9jb250YWluZXInO1xuaW1wb3J0IHtDb21wb25lbnRUZW1wbGF0ZSwgUmVuZGVyRmxhZ3N9IGZyb20gJy4uL2ludGVyZmFjZXMvZGVmaW5pdGlvbic7XG5pbXBvcnQge1xuICBDT05URVhULFxuICBFRkZFQ1RTX1RPX1NDSEVEVUxFLFxuICBFTlZJUk9OTUVOVCxcbiAgRkxBR1MsXG4gIEluaXRQaGFzZVN0YXRlLFxuICBMVmlldyxcbiAgTFZpZXdGbGFncyxcbiAgUkVBQ1RJVkVfVEVNUExBVEVfQ09OU1VNRVIsXG4gIFRWSUVXLFxuICBUVmlldyxcbn0gZnJvbSAnLi4vaW50ZXJmYWNlcy92aWV3JztcbmltcG9ydCB7XG4gIGdldE9yQ3JlYXRlVGVtcG9yYXJ5Q29uc3VtZXIsXG4gIGdldE9yQm9ycm93UmVhY3RpdmVMVmlld0NvbnN1bWVyLFxuICBtYXliZVJldHVyblJlYWN0aXZlTFZpZXdDb25zdW1lcixcbiAgUmVhY3RpdmVMVmlld0NvbnN1bWVyLFxuICB2aWV3U2hvdWxkSGF2ZVJlYWN0aXZlQ29uc3VtZXIsXG59IGZyb20gJy4uL3JlYWN0aXZlX2x2aWV3X2NvbnN1bWVyJztcbmltcG9ydCB7XG4gIENoZWNrTm9DaGFuZ2VzTW9kZSxcbiAgZW50ZXJWaWV3LFxuICBpc0V4aGF1c3RpdmVDaGVja05vQ2hhbmdlcyxcbiAgaXNJbkNoZWNrTm9DaGFuZ2VzTW9kZSxcbiAgaXNSZWZyZXNoaW5nVmlld3MsXG4gIGxlYXZlVmlldyxcbiAgc2V0QmluZGluZ0luZGV4LFxuICBzZXRJc0luQ2hlY2tOb0NoYW5nZXNNb2RlLFxuICBzZXRJc1JlZnJlc2hpbmdWaWV3cyxcbn0gZnJvbSAnLi4vc3RhdGUnO1xuaW1wb3J0IHtnZXRGaXJzdExDb250YWluZXIsIGdldE5leHRMQ29udGFpbmVyfSBmcm9tICcuLi91dGlsL3ZpZXdfdHJhdmVyc2FsX3V0aWxzJztcbmltcG9ydCB7XG4gIGdldENvbXBvbmVudExWaWV3QnlJbmRleCxcbiAgaXNDcmVhdGlvbk1vZGUsXG4gIG1hcmtBbmNlc3RvcnNGb3JUcmF2ZXJzYWwsXG4gIG1hcmtWaWV3Rm9yUmVmcmVzaCxcbiAgcmVxdWlyZXNSZWZyZXNoT3JUcmF2ZXJzYWwsXG4gIHJlc2V0UHJlT3JkZXJIb29rRmxhZ3MsXG4gIHZpZXdBdHRhY2hlZFRvQ2hhbmdlRGV0ZWN0b3IsXG59IGZyb20gJy4uL3V0aWwvdmlld191dGlscyc7XG5cbmltcG9ydCB7XG4gIGV4ZWN1dGVUZW1wbGF0ZSxcbiAgZXhlY3V0ZVZpZXdRdWVyeUZuLFxuICBoYW5kbGVFcnJvcixcbiAgcHJvY2Vzc0hvc3RCaW5kaW5nT3BDb2RlcyxcbiAgcmVmcmVzaENvbnRlbnRRdWVyaWVzLFxufSBmcm9tICcuL3NoYXJlZCc7XG5cbi8qKlxuICogVGhlIG1heGltdW0gbnVtYmVyIG9mIHRpbWVzIHRoZSBjaGFuZ2UgZGV0ZWN0aW9uIHRyYXZlcnNhbCB3aWxsIHJlcnVuIGJlZm9yZSB0aHJvd2luZyBhbiBlcnJvci5cbiAqL1xuZXhwb3J0IGNvbnN0IE1BWElNVU1fUkVGUkVTSF9SRVJVTlMgPSAxMDA7XG5cbmV4cG9ydCBmdW5jdGlvbiBkZXRlY3RDaGFuZ2VzSW50ZXJuYWwoXG4gIGxWaWV3OiBMVmlldyxcbiAgbm90aWZ5RXJyb3JIYW5kbGVyID0gdHJ1ZSxcbiAgbW9kZSA9IENoYW5nZURldGVjdGlvbk1vZGUuR2xvYmFsLFxuKSB7XG4gIGNvbnN0IGVudmlyb25tZW50ID0gbFZpZXdbRU5WSVJPTk1FTlRdO1xuICBjb25zdCByZW5kZXJlckZhY3RvcnkgPSBlbnZpcm9ubWVudC5yZW5kZXJlckZhY3Rvcnk7XG5cbiAgLy8gQ2hlY2sgbm8gY2hhbmdlcyBtb2RlIGlzIGEgZGV2IG9ubHkgbW9kZSB1c2VkIHRvIHZlcmlmeSB0aGF0IGJpbmRpbmdzIGhhdmUgbm90IGNoYW5nZWRcbiAgLy8gc2luY2UgdGhleSB3ZXJlIGFzc2lnbmVkLiBXZSBkbyBub3Qgd2FudCB0byBpbnZva2UgcmVuZGVyZXIgZmFjdG9yeSBmdW5jdGlvbnMgaW4gdGhhdCBtb2RlXG4gIC8vIHRvIGF2b2lkIGFueSBwb3NzaWJsZSBzaWRlLWVmZmVjdHMuXG4gIGNvbnN0IGNoZWNrTm9DaGFuZ2VzTW9kZSA9ICEhbmdEZXZNb2RlICYmIGlzSW5DaGVja05vQ2hhbmdlc01vZGUoKTtcblxuICBpZiAoIWNoZWNrTm9DaGFuZ2VzTW9kZSkge1xuICAgIHJlbmRlcmVyRmFjdG9yeS5iZWdpbj8uKCk7XG4gIH1cblxuICB0cnkge1xuICAgIGRldGVjdENoYW5nZXNJblZpZXdXaGlsZURpcnR5KGxWaWV3LCBtb2RlKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAobm90aWZ5RXJyb3JIYW5kbGVyKSB7XG4gICAgICBoYW5kbGVFcnJvcihsVmlldywgZXJyb3IpO1xuICAgIH1cbiAgICB0aHJvdyBlcnJvcjtcbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoIWNoZWNrTm9DaGFuZ2VzTW9kZSkge1xuICAgICAgcmVuZGVyZXJGYWN0b3J5LmVuZD8uKCk7XG5cbiAgICAgIC8vIE9uZSBmaW5hbCBmbHVzaCBvZiB0aGUgZWZmZWN0cyBxdWV1ZSB0byBjYXRjaCBhbnkgZWZmZWN0cyBjcmVhdGVkIGluIGBuZ0FmdGVyVmlld0luaXRgIG9yXG4gICAgICAvLyBvdGhlciBwb3N0LW9yZGVyIGhvb2tzLlxuICAgICAgZW52aXJvbm1lbnQuaW5saW5lRWZmZWN0UnVubmVyPy5mbHVzaCgpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBkZXRlY3RDaGFuZ2VzSW5WaWV3V2hpbGVEaXJ0eShsVmlldzogTFZpZXcsIG1vZGU6IENoYW5nZURldGVjdGlvbk1vZGUpIHtcbiAgY29uc3QgbGFzdElzUmVmcmVzaGluZ1ZpZXdzVmFsdWUgPSBpc1JlZnJlc2hpbmdWaWV3cygpO1xuICB0cnkge1xuICAgIHNldElzUmVmcmVzaGluZ1ZpZXdzKHRydWUpO1xuICAgIGRldGVjdENoYW5nZXNJblZpZXcobFZpZXcsIG1vZGUpO1xuXG4gICAgLy8gV2UgZG9uJ3QgbmVlZCBvciB3YW50IHRvIGRvIGFueSBsb29waW5nIHdoZW4gaW4gZXhoYXVzdGl2ZSBjaGVja05vQ2hhbmdlcyBiZWNhdXNlIHdlXG4gICAgLy8gYWxyZWFkeSB0cmF2ZXJzZSBhbGwgdGhlIHZpZXdzIGFuZCBub3RoaW5nIHNob3VsZCBjaGFuZ2Ugc28gd2Ugc2hvdWxkbid0IGhhdmUgdG8gZG9cbiAgICAvLyBhbm90aGVyIHBhc3MgdG8gcGljayB1cCBuZXcgY2hhbmdlcy5cbiAgICBpZiAobmdEZXZNb2RlICYmIGlzRXhoYXVzdGl2ZUNoZWNrTm9DaGFuZ2VzKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsZXQgcmV0cmllcyA9IDA7XG4gICAgLy8gSWYgYWZ0ZXIgcnVubmluZyBjaGFuZ2UgZGV0ZWN0aW9uLCB0aGlzIHZpZXcgc3RpbGwgbmVlZHMgdG8gYmUgcmVmcmVzaGVkIG9yIHRoZXJlIGFyZVxuICAgIC8vIGRlc2NlbmRhbnRzIHZpZXdzIHRoYXQgbmVlZCB0byBiZSByZWZyZXNoZWQgZHVlIHRvIHJlLWRpcnR5aW5nIGR1cmluZyB0aGUgY2hhbmdlIGRldGVjdGlvblxuICAgIC8vIHJ1biwgZGV0ZWN0IGNoYW5nZXMgb24gdGhlIHZpZXcgYWdhaW4uIFdlIHJ1biBjaGFuZ2UgZGV0ZWN0aW9uIGluIGBUYXJnZXRlZGAgbW9kZSB0byBvbmx5XG4gICAgLy8gcmVmcmVzaCB2aWV3cyB3aXRoIHRoZSBgUmVmcmVzaFZpZXdgIGZsYWcuXG4gICAgd2hpbGUgKHJlcXVpcmVzUmVmcmVzaE9yVHJhdmVyc2FsKGxWaWV3KSkge1xuICAgICAgaWYgKHJldHJpZXMgPT09IE1BWElNVU1fUkVGUkVTSF9SRVJVTlMpIHtcbiAgICAgICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgICBSdW50aW1lRXJyb3JDb2RlLklORklOSVRFX0NIQU5HRV9ERVRFQ1RJT04sXG4gICAgICAgICAgbmdEZXZNb2RlICYmXG4gICAgICAgICAgICAnSW5maW5pdGUgY2hhbmdlIGRldGVjdGlvbiB3aGlsZSB0cnlpbmcgdG8gcmVmcmVzaCB2aWV3cy4gJyArXG4gICAgICAgICAgICAgICdUaGVyZSBtYXkgYmUgY29tcG9uZW50cyB3aGljaCBlYWNoIGNhdXNlIHRoZSBvdGhlciB0byByZXF1aXJlIGEgcmVmcmVzaCwgJyArXG4gICAgICAgICAgICAgICdjYXVzaW5nIGFuIGluZmluaXRlIGxvb3AuJyxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHJldHJpZXMrKztcbiAgICAgIC8vIEV2ZW4gaWYgdGhpcyB2aWV3IGlzIGRldGFjaGVkLCB3ZSBzdGlsbCBkZXRlY3QgY2hhbmdlcyBpbiB0YXJnZXRlZCBtb2RlIGJlY2F1c2UgdGhpcyB3YXNcbiAgICAgIC8vIHRoZSByb290IG9mIHRoZSBjaGFuZ2UgZGV0ZWN0aW9uIHJ1bi5cbiAgICAgIGRldGVjdENoYW5nZXNJblZpZXcobFZpZXcsIENoYW5nZURldGVjdGlvbk1vZGUuVGFyZ2V0ZWQpO1xuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICAvLyByZXN0b3JlIHN0YXRlIHRvIHdoYXQgaXQgd2FzIGJlZm9yZSBlbnRlcmluZyB0aGlzIGNoYW5nZSBkZXRlY3Rpb24gbG9vcFxuICAgIHNldElzUmVmcmVzaGluZ1ZpZXdzKGxhc3RJc1JlZnJlc2hpbmdWaWV3c1ZhbHVlKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tOb0NoYW5nZXNJbnRlcm5hbChcbiAgbFZpZXc6IExWaWV3LFxuICBtb2RlOiBDaGVja05vQ2hhbmdlc01vZGUsXG4gIG5vdGlmeUVycm9ySGFuZGxlciA9IHRydWUsXG4pIHtcbiAgc2V0SXNJbkNoZWNrTm9DaGFuZ2VzTW9kZShtb2RlKTtcbiAgdHJ5IHtcbiAgICBkZXRlY3RDaGFuZ2VzSW50ZXJuYWwobFZpZXcsIG5vdGlmeUVycm9ySGFuZGxlcik7XG4gIH0gZmluYWxseSB7XG4gICAgc2V0SXNJbkNoZWNrTm9DaGFuZ2VzTW9kZShDaGVja05vQ2hhbmdlc01vZGUuT2ZmKTtcbiAgfVxufVxuXG4vKipcbiAqIERpZmZlcmVudCBtb2RlcyBvZiB0cmF2ZXJzaW5nIHRoZSBsb2dpY2FsIHZpZXcgdHJlZSBkdXJpbmcgY2hhbmdlIGRldGVjdGlvbi5cbiAqXG4gKlxuICogVGhlIGNoYW5nZSBkZXRlY3Rpb24gdHJhdmVyc2FsIGFsZ29yaXRobSBzd2l0Y2hlcyBiZXR3ZWVuIHRoZXNlIG1vZGVzIGJhc2VkIG9uIHZhcmlvdXNcbiAqIGNvbmRpdGlvbnMuXG4gKi9cbmV4cG9ydCBjb25zdCBlbnVtIENoYW5nZURldGVjdGlvbk1vZGUge1xuICAvKipcbiAgICogSW4gYEdsb2JhbGAgbW9kZSwgYERpcnR5YCBhbmQgYENoZWNrQWx3YXlzYCB2aWV3cyBhcmUgcmVmcmVzaGVkIGFzIHdlbGwgYXMgdmlld3Mgd2l0aCB0aGVcbiAgICogYFJlZnJlc2hWaWV3YCBmbGFnLlxuICAgKi9cbiAgR2xvYmFsLFxuICAvKipcbiAgICogSW4gYFRhcmdldGVkYCBtb2RlLCBvbmx5IHZpZXdzIHdpdGggdGhlIGBSZWZyZXNoVmlld2AgZmxhZyBvciB1cGRhdGVkIHNpZ25hbHMgYXJlIHJlZnJlc2hlZC5cbiAgICovXG4gIFRhcmdldGVkLFxufVxuXG4vKipcbiAqIFByb2Nlc3NlcyBhIHZpZXcgaW4gdXBkYXRlIG1vZGUuIFRoaXMgaW5jbHVkZXMgYSBudW1iZXIgb2Ygc3RlcHMgaW4gYSBzcGVjaWZpYyBvcmRlcjpcbiAqIC0gZXhlY3V0aW5nIGEgdGVtcGxhdGUgZnVuY3Rpb24gaW4gdXBkYXRlIG1vZGU7XG4gKiAtIGV4ZWN1dGluZyBob29rcztcbiAqIC0gcmVmcmVzaGluZyBxdWVyaWVzO1xuICogLSBzZXR0aW5nIGhvc3QgYmluZGluZ3M7XG4gKiAtIHJlZnJlc2hpbmcgY2hpbGQgKGVtYmVkZGVkIGFuZCBjb21wb25lbnQpIHZpZXdzLlxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiByZWZyZXNoVmlldzxUPihcbiAgdFZpZXc6IFRWaWV3LFxuICBsVmlldzogTFZpZXcsXG4gIHRlbXBsYXRlRm46IENvbXBvbmVudFRlbXBsYXRlPHt9PiB8IG51bGwsXG4gIGNvbnRleHQ6IFQsXG4pIHtcbiAgbmdEZXZNb2RlICYmIGFzc2VydEVxdWFsKGlzQ3JlYXRpb25Nb2RlKGxWaWV3KSwgZmFsc2UsICdTaG91bGQgYmUgcnVuIGluIHVwZGF0ZSBtb2RlJyk7XG4gIGNvbnN0IGZsYWdzID0gbFZpZXdbRkxBR1NdO1xuICBpZiAoKGZsYWdzICYgTFZpZXdGbGFncy5EZXN0cm95ZWQpID09PSBMVmlld0ZsYWdzLkRlc3Ryb3llZCkgcmV0dXJuO1xuXG4gIC8vIENoZWNrIG5vIGNoYW5nZXMgbW9kZSBpcyBhIGRldiBvbmx5IG1vZGUgdXNlZCB0byB2ZXJpZnkgdGhhdCBiaW5kaW5ncyBoYXZlIG5vdCBjaGFuZ2VkXG4gIC8vIHNpbmNlIHRoZXkgd2VyZSBhc3NpZ25lZC4gV2UgZG8gbm90IHdhbnQgdG8gZXhlY3V0ZSBsaWZlY3ljbGUgaG9va3MgaW4gdGhhdCBtb2RlLlxuICBjb25zdCBpc0luQ2hlY2tOb0NoYW5nZXNQYXNzID0gbmdEZXZNb2RlICYmIGlzSW5DaGVja05vQ2hhbmdlc01vZGUoKTtcbiAgY29uc3QgaXNJbkV4aGF1c3RpdmVDaGVja05vQ2hhbmdlc1Bhc3MgPSBuZ0Rldk1vZGUgJiYgaXNFeGhhdXN0aXZlQ2hlY2tOb0NoYW5nZXMoKTtcblxuICAhaXNJbkNoZWNrTm9DaGFuZ2VzUGFzcyAmJiBsVmlld1tFTlZJUk9OTUVOVF0uaW5saW5lRWZmZWN0UnVubmVyPy5mbHVzaCgpO1xuXG4gIC8vIFN0YXJ0IGNvbXBvbmVudCByZWFjdGl2ZSBjb250ZXh0XG4gIC8vIC0gV2UgbWlnaHQgYWxyZWFkeSBiZSBpbiBhIHJlYWN0aXZlIGNvbnRleHQgaWYgdGhpcyBpcyBhbiBlbWJlZGRlZCB2aWV3IG9mIHRoZSBob3N0LlxuICAvLyAtIFdlIG1pZ2h0IGJlIGRlc2NlbmRpbmcgaW50byBhIHZpZXcgdGhhdCBuZWVkcyBhIGNvbnN1bWVyLlxuICBlbnRlclZpZXcobFZpZXcpO1xuICBsZXQgcmV0dXJuQ29uc3VtZXJUb1Bvb2wgPSB0cnVlO1xuICBsZXQgcHJldkNvbnN1bWVyOiBSZWFjdGl2ZU5vZGUgfCBudWxsID0gbnVsbDtcbiAgbGV0IGN1cnJlbnRDb25zdW1lcjogUmVhY3RpdmVMVmlld0NvbnN1bWVyIHwgbnVsbCA9IG51bGw7XG4gIGlmICghaXNJbkNoZWNrTm9DaGFuZ2VzUGFzcykge1xuICAgIGlmICh2aWV3U2hvdWxkSGF2ZVJlYWN0aXZlQ29uc3VtZXIodFZpZXcpKSB7XG4gICAgICBjdXJyZW50Q29uc3VtZXIgPSBnZXRPckJvcnJvd1JlYWN0aXZlTFZpZXdDb25zdW1lcihsVmlldyk7XG4gICAgICBwcmV2Q29uc3VtZXIgPSBjb25zdW1lckJlZm9yZUNvbXB1dGF0aW9uKGN1cnJlbnRDb25zdW1lcik7XG4gICAgfSBlbHNlIGlmIChnZXRBY3RpdmVDb25zdW1lcigpID09PSBudWxsKSB7XG4gICAgICAvLyBJZiB0aGUgY3VycmVudCB2aWV3IHNob3VsZCBub3QgaGF2ZSBhIHJlYWN0aXZlIGNvbnN1bWVyIGJ1dCB3ZSBkb24ndCBoYXZlIGFuIGFjdGl2ZSBjb25zdW1lcixcbiAgICAgIC8vIHdlIHN0aWxsIG5lZWQgdG8gY3JlYXRlIGEgdGVtcG9yYXJ5IGNvbnN1bWVyIHRvIHRyYWNrIGFueSBzaWduYWwgcmVhZHMgaW4gdGhpcyB0ZW1wbGF0ZS5cbiAgICAgIC8vIFRoaXMgaXMgYSByYXJlIGNhc2UgdGhhdCBjYW4gaGFwcGVuIHdpdGggYHZpZXdDb250YWluZXJSZWYuY3JlYXRlRW1iZWRkZWRWaWV3KC4uLikuZGV0ZWN0Q2hhbmdlcygpYC5cbiAgICAgIC8vIFRoaXMgdGVtcG9yYXJ5IGNvbnN1bWVyIG1hcmtzIHRoZSBmaXJzdCBwYXJlbnQgdGhhdCBfc2hvdWxkXyBoYXZlIGEgY29uc3VtZXIgZm9yIHJlZnJlc2guXG4gICAgICAvLyBPbmNlIHRoYXQgcmVmcmVzaCBoYXBwZW5zLCB0aGUgc2lnbmFscyB3aWxsIGJlIHRyYWNrZWQgaW4gdGhlIHBhcmVudCBjb25zdW1lciBhbmQgd2UgY2FuIGRlc3Ryb3lcbiAgICAgIC8vIHRoZSB0ZW1wb3Jhcnkgb25lLlxuICAgICAgcmV0dXJuQ29uc3VtZXJUb1Bvb2wgPSBmYWxzZTtcbiAgICAgIGN1cnJlbnRDb25zdW1lciA9IGdldE9yQ3JlYXRlVGVtcG9yYXJ5Q29uc3VtZXIobFZpZXcpO1xuICAgICAgcHJldkNvbnN1bWVyID0gY29uc3VtZXJCZWZvcmVDb21wdXRhdGlvbihjdXJyZW50Q29uc3VtZXIpO1xuICAgIH0gZWxzZSBpZiAobFZpZXdbUkVBQ1RJVkVfVEVNUExBVEVfQ09OU1VNRVJdKSB7XG4gICAgICBjb25zdW1lckRlc3Ryb3kobFZpZXdbUkVBQ1RJVkVfVEVNUExBVEVfQ09OU1VNRVJdKTtcbiAgICAgIGxWaWV3W1JFQUNUSVZFX1RFTVBMQVRFX0NPTlNVTUVSXSA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgdHJ5IHtcbiAgICByZXNldFByZU9yZGVySG9va0ZsYWdzKGxWaWV3KTtcblxuICAgIHNldEJpbmRpbmdJbmRleCh0Vmlldy5iaW5kaW5nU3RhcnRJbmRleCk7XG4gICAgaWYgKHRlbXBsYXRlRm4gIT09IG51bGwpIHtcbiAgICAgIGV4ZWN1dGVUZW1wbGF0ZSh0VmlldywgbFZpZXcsIHRlbXBsYXRlRm4sIFJlbmRlckZsYWdzLlVwZGF0ZSwgY29udGV4dCk7XG4gICAgfVxuXG4gICAgY29uc3QgaG9va3NJbml0UGhhc2VDb21wbGV0ZWQgPVxuICAgICAgKGZsYWdzICYgTFZpZXdGbGFncy5Jbml0UGhhc2VTdGF0ZU1hc2spID09PSBJbml0UGhhc2VTdGF0ZS5Jbml0UGhhc2VDb21wbGV0ZWQ7XG5cbiAgICAvLyBleGVjdXRlIHByZS1vcmRlciBob29rcyAoT25Jbml0LCBPbkNoYW5nZXMsIERvQ2hlY2spXG4gICAgLy8gUEVSRiBXQVJOSU5HOiBkbyBOT1QgZXh0cmFjdCB0aGlzIHRvIGEgc2VwYXJhdGUgZnVuY3Rpb24gd2l0aG91dCBydW5uaW5nIGJlbmNobWFya3NcbiAgICBpZiAoIWlzSW5DaGVja05vQ2hhbmdlc1Bhc3MpIHtcbiAgICAgIGlmIChob29rc0luaXRQaGFzZUNvbXBsZXRlZCkge1xuICAgICAgICBjb25zdCBwcmVPcmRlckNoZWNrSG9va3MgPSB0Vmlldy5wcmVPcmRlckNoZWNrSG9va3M7XG4gICAgICAgIGlmIChwcmVPcmRlckNoZWNrSG9va3MgIT09IG51bGwpIHtcbiAgICAgICAgICBleGVjdXRlQ2hlY2tIb29rcyhsVmlldywgcHJlT3JkZXJDaGVja0hvb2tzLCBudWxsKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcHJlT3JkZXJIb29rcyA9IHRWaWV3LnByZU9yZGVySG9va3M7XG4gICAgICAgIGlmIChwcmVPcmRlckhvb2tzICE9PSBudWxsKSB7XG4gICAgICAgICAgZXhlY3V0ZUluaXRBbmRDaGVja0hvb2tzKGxWaWV3LCBwcmVPcmRlckhvb2tzLCBJbml0UGhhc2VTdGF0ZS5PbkluaXRIb29rc1RvQmVSdW4sIG51bGwpO1xuICAgICAgICB9XG4gICAgICAgIGluY3JlbWVudEluaXRQaGFzZUZsYWdzKGxWaWV3LCBJbml0UGhhc2VTdGF0ZS5PbkluaXRIb29rc1RvQmVSdW4pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdlIGRvIG5vdCBuZWVkIHRvIG1hcmsgdHJhbnNwbGFudGVkIHZpZXdzIGZvciByZWZyZXNoIHdoZW4gZG9pbmcgZXhoYXVzdGl2ZSBjaGVja3NcbiAgICAvLyBiZWNhdXNlIGFsbCB2aWV3cyB3aWxsIGJlIHJlYWNoZWQgYW55d2F5cyBkdXJpbmcgdGhlIHRyYXZlcnNhbC5cbiAgICBpZiAoIWlzSW5FeGhhdXN0aXZlQ2hlY2tOb0NoYW5nZXNQYXNzKSB7XG4gICAgICAvLyBGaXJzdCBtYXJrIHRyYW5zcGxhbnRlZCB2aWV3cyB0aGF0IGFyZSBkZWNsYXJlZCBpbiB0aGlzIGxWaWV3IGFzIG5lZWRpbmcgYSByZWZyZXNoIGF0IHRoZWlyXG4gICAgICAvLyBpbnNlcnRpb24gcG9pbnRzLiBUaGlzIGlzIG5lZWRlZCB0byBhdm9pZCB0aGUgc2l0dWF0aW9uIHdoZXJlIHRoZSB0ZW1wbGF0ZSBpcyBkZWZpbmVkIGluIHRoaXNcbiAgICAgIC8vIGBMVmlld2AgYnV0IGl0cyBkZWNsYXJhdGlvbiBhcHBlYXJzIGFmdGVyIHRoZSBpbnNlcnRpb24gY29tcG9uZW50LlxuICAgICAgbWFya1RyYW5zcGxhbnRlZFZpZXdzRm9yUmVmcmVzaChsVmlldyk7XG4gICAgfVxuICAgIGRldGVjdENoYW5nZXNJbkVtYmVkZGVkVmlld3MobFZpZXcsIENoYW5nZURldGVjdGlvbk1vZGUuR2xvYmFsKTtcblxuICAgIC8vIENvbnRlbnQgcXVlcnkgcmVzdWx0cyBtdXN0IGJlIHJlZnJlc2hlZCBiZWZvcmUgY29udGVudCBob29rcyBhcmUgY2FsbGVkLlxuICAgIGlmICh0Vmlldy5jb250ZW50UXVlcmllcyAhPT0gbnVsbCkge1xuICAgICAgcmVmcmVzaENvbnRlbnRRdWVyaWVzKHRWaWV3LCBsVmlldyk7XG4gICAgfVxuXG4gICAgLy8gZXhlY3V0ZSBjb250ZW50IGhvb2tzIChBZnRlckNvbnRlbnRJbml0LCBBZnRlckNvbnRlbnRDaGVja2VkKVxuICAgIC8vIFBFUkYgV0FSTklORzogZG8gTk9UIGV4dHJhY3QgdGhpcyB0byBhIHNlcGFyYXRlIGZ1bmN0aW9uIHdpdGhvdXQgcnVubmluZyBiZW5jaG1hcmtzXG4gICAgaWYgKCFpc0luQ2hlY2tOb0NoYW5nZXNQYXNzKSB7XG4gICAgICBpZiAoaG9va3NJbml0UGhhc2VDb21wbGV0ZWQpIHtcbiAgICAgICAgY29uc3QgY29udGVudENoZWNrSG9va3MgPSB0Vmlldy5jb250ZW50Q2hlY2tIb29rcztcbiAgICAgICAgaWYgKGNvbnRlbnRDaGVja0hvb2tzICE9PSBudWxsKSB7XG4gICAgICAgICAgZXhlY3V0ZUNoZWNrSG9va3MobFZpZXcsIGNvbnRlbnRDaGVja0hvb2tzKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgY29udGVudEhvb2tzID0gdFZpZXcuY29udGVudEhvb2tzO1xuICAgICAgICBpZiAoY29udGVudEhvb2tzICE9PSBudWxsKSB7XG4gICAgICAgICAgZXhlY3V0ZUluaXRBbmRDaGVja0hvb2tzKFxuICAgICAgICAgICAgbFZpZXcsXG4gICAgICAgICAgICBjb250ZW50SG9va3MsXG4gICAgICAgICAgICBJbml0UGhhc2VTdGF0ZS5BZnRlckNvbnRlbnRJbml0SG9va3NUb0JlUnVuLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgaW5jcmVtZW50SW5pdFBoYXNlRmxhZ3MobFZpZXcsIEluaXRQaGFzZVN0YXRlLkFmdGVyQ29udGVudEluaXRIb29rc1RvQmVSdW4pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHByb2Nlc3NIb3N0QmluZGluZ09wQ29kZXModFZpZXcsIGxWaWV3KTtcblxuICAgIC8vIFJlZnJlc2ggY2hpbGQgY29tcG9uZW50IHZpZXdzLlxuICAgIGNvbnN0IGNvbXBvbmVudHMgPSB0Vmlldy5jb21wb25lbnRzO1xuICAgIGlmIChjb21wb25lbnRzICE9PSBudWxsKSB7XG4gICAgICBkZXRlY3RDaGFuZ2VzSW5DaGlsZENvbXBvbmVudHMobFZpZXcsIGNvbXBvbmVudHMsIENoYW5nZURldGVjdGlvbk1vZGUuR2xvYmFsKTtcbiAgICB9XG5cbiAgICAvLyBWaWV3IHF1ZXJpZXMgbXVzdCBleGVjdXRlIGFmdGVyIHJlZnJlc2hpbmcgY2hpbGQgY29tcG9uZW50cyBiZWNhdXNlIGEgdGVtcGxhdGUgaW4gdGhpcyB2aWV3XG4gICAgLy8gY291bGQgYmUgaW5zZXJ0ZWQgaW4gYSBjaGlsZCBjb21wb25lbnQuIElmIHRoZSB2aWV3IHF1ZXJ5IGV4ZWN1dGVzIGJlZm9yZSBjaGlsZCBjb21wb25lbnRcbiAgICAvLyByZWZyZXNoLCB0aGUgdGVtcGxhdGUgbWlnaHQgbm90IHlldCBiZSBpbnNlcnRlZC5cbiAgICBjb25zdCB2aWV3UXVlcnkgPSB0Vmlldy52aWV3UXVlcnk7XG4gICAgaWYgKHZpZXdRdWVyeSAhPT0gbnVsbCkge1xuICAgICAgZXhlY3V0ZVZpZXdRdWVyeUZuPFQ+KFJlbmRlckZsYWdzLlVwZGF0ZSwgdmlld1F1ZXJ5LCBjb250ZXh0KTtcbiAgICB9XG5cbiAgICAvLyBleGVjdXRlIHZpZXcgaG9va3MgKEFmdGVyVmlld0luaXQsIEFmdGVyVmlld0NoZWNrZWQpXG4gICAgLy8gUEVSRiBXQVJOSU5HOiBkbyBOT1QgZXh0cmFjdCB0aGlzIHRvIGEgc2VwYXJhdGUgZnVuY3Rpb24gd2l0aG91dCBydW5uaW5nIGJlbmNobWFya3NcbiAgICBpZiAoIWlzSW5DaGVja05vQ2hhbmdlc1Bhc3MpIHtcbiAgICAgIGlmIChob29rc0luaXRQaGFzZUNvbXBsZXRlZCkge1xuICAgICAgICBjb25zdCB2aWV3Q2hlY2tIb29rcyA9IHRWaWV3LnZpZXdDaGVja0hvb2tzO1xuICAgICAgICBpZiAodmlld0NoZWNrSG9va3MgIT09IG51bGwpIHtcbiAgICAgICAgICBleGVjdXRlQ2hlY2tIb29rcyhsVmlldywgdmlld0NoZWNrSG9va3MpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB2aWV3SG9va3MgPSB0Vmlldy52aWV3SG9va3M7XG4gICAgICAgIGlmICh2aWV3SG9va3MgIT09IG51bGwpIHtcbiAgICAgICAgICBleGVjdXRlSW5pdEFuZENoZWNrSG9va3MobFZpZXcsIHZpZXdIb29rcywgSW5pdFBoYXNlU3RhdGUuQWZ0ZXJWaWV3SW5pdEhvb2tzVG9CZVJ1bik7XG4gICAgICAgIH1cbiAgICAgICAgaW5jcmVtZW50SW5pdFBoYXNlRmxhZ3MobFZpZXcsIEluaXRQaGFzZVN0YXRlLkFmdGVyVmlld0luaXRIb29rc1RvQmVSdW4pO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodFZpZXcuZmlyc3RVcGRhdGVQYXNzID09PSB0cnVlKSB7XG4gICAgICAvLyBXZSBuZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IHdlIG9ubHkgZmxpcCB0aGUgZmxhZyBvbiBzdWNjZXNzZnVsIGByZWZyZXNoVmlld2Agb25seVxuICAgICAgLy8gRG9uJ3QgZG8gdGhpcyBpbiBgZmluYWxseWAgYmxvY2suXG4gICAgICAvLyBJZiB3ZSBkaWQgdGhpcyBpbiBgZmluYWxseWAgYmxvY2sgdGhlbiBhbiBleGNlcHRpb24gY291bGQgYmxvY2sgdGhlIGV4ZWN1dGlvbiBvZiBzdHlsaW5nXG4gICAgICAvLyBpbnN0cnVjdGlvbnMgd2hpY2ggaW4gdHVybiB3b3VsZCBiZSB1bmFibGUgdG8gaW5zZXJ0IHRoZW1zZWx2ZXMgaW50byB0aGUgc3R5bGluZyBsaW5rZWRcbiAgICAgIC8vIGxpc3QuIFRoZSByZXN1bHQgb2YgdGhpcyB3b3VsZCBiZSB0aGF0IGlmIHRoZSBleGNlcHRpb24gd291bGQgbm90IGJlIHRocm93IG9uIHN1YnNlcXVlbnQgQ0RcbiAgICAgIC8vIHRoZSBzdHlsaW5nIHdvdWxkIGJlIHVuYWJsZSB0byBwcm9jZXNzIGl0IGRhdGEgYW5kIHJlZmxlY3QgdG8gdGhlIERPTS5cbiAgICAgIHRWaWV3LmZpcnN0VXBkYXRlUGFzcyA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFNjaGVkdWxlIGFueSBlZmZlY3RzIHRoYXQgYXJlIHdhaXRpbmcgb24gdGhlIHVwZGF0ZSBwYXNzIG9mIHRoaXMgdmlldy5cbiAgICBpZiAobFZpZXdbRUZGRUNUU19UT19TQ0hFRFVMRV0pIHtcbiAgICAgIGZvciAoY29uc3Qgbm90aWZ5RWZmZWN0IG9mIGxWaWV3W0VGRkVDVFNfVE9fU0NIRURVTEVdKSB7XG4gICAgICAgIG5vdGlmeUVmZmVjdCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBPbmNlIHRoZXkndmUgYmVlbiBydW4sIHdlIGNhbiBkcm9wIHRoZSBhcnJheS5cbiAgICAgIGxWaWV3W0VGRkVDVFNfVE9fU0NIRURVTEVdID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBEbyBub3QgcmVzZXQgdGhlIGRpcnR5IHN0YXRlIHdoZW4gcnVubmluZyBpbiBjaGVjayBubyBjaGFuZ2VzIG1vZGUuIFdlIGRvbid0IHdhbnQgY29tcG9uZW50c1xuICAgIC8vIHRvIGJlaGF2ZSBkaWZmZXJlbnRseSBkZXBlbmRpbmcgb24gd2hldGhlciBjaGVjayBubyBjaGFuZ2VzIGlzIGVuYWJsZWQgb3Igbm90LiBGb3IgZXhhbXBsZTpcbiAgICAvLyBNYXJraW5nIGFuIE9uUHVzaCBjb21wb25lbnQgYXMgZGlydHkgZnJvbSB3aXRoaW4gdGhlIGBuZ0FmdGVyVmlld0luaXRgIGhvb2sgaW4gb3JkZXIgdG9cbiAgICAvLyByZWZyZXNoIGEgYE5nQ2xhc3NgIGJpbmRpbmcgc2hvdWxkIHdvcmsuIElmIHdlIHdvdWxkIHJlc2V0IHRoZSBkaXJ0eSBzdGF0ZSBpbiB0aGUgY2hlY2tcbiAgICAvLyBubyBjaGFuZ2VzIGN5Y2xlLCB0aGUgY29tcG9uZW50IHdvdWxkIGJlIG5vdCBiZSBkaXJ0eSBmb3IgdGhlIG5leHQgdXBkYXRlIHBhc3MuIFRoaXMgd291bGRcbiAgICAvLyBiZSBkaWZmZXJlbnQgaW4gcHJvZHVjdGlvbiBtb2RlIHdoZXJlIHRoZSBjb21wb25lbnQgZGlydHkgc3RhdGUgaXMgbm90IHJlc2V0LlxuICAgIGlmICghaXNJbkNoZWNrTm9DaGFuZ2VzUGFzcykge1xuICAgICAgbFZpZXdbRkxBR1NdICY9IH4oTFZpZXdGbGFncy5EaXJ0eSB8IExWaWV3RmxhZ3MuRmlyc3RMVmlld1Bhc3MpO1xuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICAgIGlmICghaXNJbkNoZWNrTm9DaGFuZ2VzUGFzcykge1xuICAgICAgLy8gSWYgcmVmcmVzaGluZyBhIHZpZXcgY2F1c2VzIGFuIGVycm9yLCB3ZSBuZWVkIHRvIHJlbWFyayB0aGUgYW5jZXN0b3JzIGFzIG5lZWRpbmcgdHJhdmVyc2FsXG4gICAgICAvLyBiZWNhdXNlIHRoZSBlcnJvciBtaWdodCBoYXZlIGNhdXNlZCBhIHNpdHVhdGlvbiB3aGVyZSB2aWV3cyBiZWxvdyB0aGUgY3VycmVudCBsb2NhdGlvbiBhcmVcbiAgICAgIC8vIGRpcnR5IGJ1dCB3aWxsIGJlIHVucmVhY2hhYmxlIGJlY2F1c2UgdGhlIFwiaGFzIGRpcnR5IGNoaWxkcmVuXCIgZmxhZyBpbiB0aGUgYW5jZXN0b3JzIGhhcyBiZWVuXG4gICAgICAvLyBjbGVhcmVkIGR1cmluZyBjaGFuZ2UgZGV0ZWN0aW9uIGFuZCB3ZSBmYWlsZWQgdG8gcnVuIHRvIGNvbXBsZXRpb24uXG4gICAgICBtYXJrQW5jZXN0b3JzRm9yVHJhdmVyc2FsKGxWaWV3KTtcbiAgICB9XG4gICAgdGhyb3cgZTtcbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoY3VycmVudENvbnN1bWVyICE9PSBudWxsKSB7XG4gICAgICBjb25zdW1lckFmdGVyQ29tcHV0YXRpb24oY3VycmVudENvbnN1bWVyLCBwcmV2Q29uc3VtZXIpO1xuICAgICAgaWYgKHJldHVybkNvbnN1bWVyVG9Qb29sKSB7XG4gICAgICAgIG1heWJlUmV0dXJuUmVhY3RpdmVMVmlld0NvbnN1bWVyKGN1cnJlbnRDb25zdW1lcik7XG4gICAgICB9XG4gICAgfVxuICAgIGxlYXZlVmlldygpO1xuICB9XG59XG5cbi8qKlxuICogR29lcyBvdmVyIGVtYmVkZGVkIHZpZXdzIChvbmVzIGNyZWF0ZWQgdGhyb3VnaCBWaWV3Q29udGFpbmVyUmVmIEFQSXMpIGFuZCByZWZyZXNoZXNcbiAqIHRoZW0gYnkgZXhlY3V0aW5nIGFuIGFzc29jaWF0ZWQgdGVtcGxhdGUgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGRldGVjdENoYW5nZXNJbkVtYmVkZGVkVmlld3MobFZpZXc6IExWaWV3LCBtb2RlOiBDaGFuZ2VEZXRlY3Rpb25Nb2RlKSB7XG4gIGZvciAoXG4gICAgbGV0IGxDb250YWluZXIgPSBnZXRGaXJzdExDb250YWluZXIobFZpZXcpO1xuICAgIGxDb250YWluZXIgIT09IG51bGw7XG4gICAgbENvbnRhaW5lciA9IGdldE5leHRMQ29udGFpbmVyKGxDb250YWluZXIpXG4gICkge1xuICAgIGZvciAobGV0IGkgPSBDT05UQUlORVJfSEVBREVSX09GRlNFVDsgaSA8IGxDb250YWluZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGVtYmVkZGVkTFZpZXcgPSBsQ29udGFpbmVyW2ldO1xuICAgICAgZGV0ZWN0Q2hhbmdlc0luVmlld0lmQXR0YWNoZWQoZW1iZWRkZWRMVmlldywgbW9kZSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogTWFyayB0cmFuc3BsYW50ZWQgdmlld3MgYXMgbmVlZGluZyB0byBiZSByZWZyZXNoZWQgYXQgdGhlaXIgYXR0YWNobWVudCBwb2ludHMuXG4gKlxuICogQHBhcmFtIGxWaWV3IFRoZSBgTFZpZXdgIHRoYXQgbWF5IGhhdmUgdHJhbnNwbGFudGVkIHZpZXdzLlxuICovXG5mdW5jdGlvbiBtYXJrVHJhbnNwbGFudGVkVmlld3NGb3JSZWZyZXNoKGxWaWV3OiBMVmlldykge1xuICBmb3IgKFxuICAgIGxldCBsQ29udGFpbmVyID0gZ2V0Rmlyc3RMQ29udGFpbmVyKGxWaWV3KTtcbiAgICBsQ29udGFpbmVyICE9PSBudWxsO1xuICAgIGxDb250YWluZXIgPSBnZXROZXh0TENvbnRhaW5lcihsQ29udGFpbmVyKVxuICApIHtcbiAgICBpZiAoIShsQ29udGFpbmVyW0ZMQUdTXSAmIExDb250YWluZXJGbGFncy5IYXNUcmFuc3BsYW50ZWRWaWV3cykpIGNvbnRpbnVlO1xuXG4gICAgY29uc3QgbW92ZWRWaWV3cyA9IGxDb250YWluZXJbTU9WRURfVklFV1NdITtcbiAgICBuZ0Rldk1vZGUgJiYgYXNzZXJ0RGVmaW5lZChtb3ZlZFZpZXdzLCAnVHJhbnNwbGFudGVkIFZpZXcgZmxhZ3Mgc2V0IGJ1dCBtaXNzaW5nIE1PVkVEX1ZJRVdTJyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtb3ZlZFZpZXdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBtb3ZlZExWaWV3ID0gbW92ZWRWaWV3c1tpXSE7XG4gICAgICBtYXJrVmlld0ZvclJlZnJlc2gobW92ZWRMVmlldyk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRGV0ZWN0cyBjaGFuZ2VzIGluIGEgY29tcG9uZW50IGJ5IGVudGVyaW5nIHRoZSBjb21wb25lbnQgdmlldyBhbmQgcHJvY2Vzc2luZyBpdHMgYmluZGluZ3MsXG4gKiBxdWVyaWVzLCBldGMuIGlmIGl0IGlzIENoZWNrQWx3YXlzLCBPblB1c2ggYW5kIERpcnR5LCBldGMuXG4gKlxuICogQHBhcmFtIGNvbXBvbmVudEhvc3RJZHggIEVsZW1lbnQgaW5kZXggaW4gTFZpZXdbXSAoYWRqdXN0ZWQgZm9yIEhFQURFUl9PRkZTRVQpXG4gKi9cbmZ1bmN0aW9uIGRldGVjdENoYW5nZXNJbkNvbXBvbmVudChcbiAgaG9zdExWaWV3OiBMVmlldyxcbiAgY29tcG9uZW50SG9zdElkeDogbnVtYmVyLFxuICBtb2RlOiBDaGFuZ2VEZXRlY3Rpb25Nb2RlLFxuKTogdm9pZCB7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnRFcXVhbChpc0NyZWF0aW9uTW9kZShob3N0TFZpZXcpLCBmYWxzZSwgJ1Nob3VsZCBiZSBydW4gaW4gdXBkYXRlIG1vZGUnKTtcbiAgY29uc3QgY29tcG9uZW50VmlldyA9IGdldENvbXBvbmVudExWaWV3QnlJbmRleChjb21wb25lbnRIb3N0SWR4LCBob3N0TFZpZXcpO1xuICBkZXRlY3RDaGFuZ2VzSW5WaWV3SWZBdHRhY2hlZChjb21wb25lbnRWaWV3LCBtb2RlKTtcbn1cblxuLyoqXG4gKiBWaXNpdHMgYSB2aWV3IGFzIHBhcnQgb2YgY2hhbmdlIGRldGVjdGlvbiB0cmF2ZXJzYWwuXG4gKlxuICogSWYgdGhlIHZpZXcgaXMgZGV0YWNoZWQsIG5vIGFkZGl0aW9uYWwgdHJhdmVyc2FsIGhhcHBlbnMuXG4gKi9cbmZ1bmN0aW9uIGRldGVjdENoYW5nZXNJblZpZXdJZkF0dGFjaGVkKGxWaWV3OiBMVmlldywgbW9kZTogQ2hhbmdlRGV0ZWN0aW9uTW9kZSkge1xuICBpZiAoIXZpZXdBdHRhY2hlZFRvQ2hhbmdlRGV0ZWN0b3IobFZpZXcpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGRldGVjdENoYW5nZXNJblZpZXcobFZpZXcsIG1vZGUpO1xufVxuXG4vKipcbiAqIFZpc2l0cyBhIHZpZXcgYXMgcGFydCBvZiBjaGFuZ2UgZGV0ZWN0aW9uIHRyYXZlcnNhbC5cbiAqXG4gKiBUaGUgdmlldyBpcyByZWZyZXNoZWQgaWY6XG4gKiAtIElmIHRoZSB2aWV3IGlzIENoZWNrQWx3YXlzIG9yIERpcnR5IGFuZCBDaGFuZ2VEZXRlY3Rpb25Nb2RlIGlzIGBHbG9iYWxgXG4gKiAtIElmIHRoZSB2aWV3IGhhcyB0aGUgYFJlZnJlc2hWaWV3YCBmbGFnXG4gKlxuICogVGhlIHZpZXcgaXMgbm90IHJlZnJlc2hlZCwgYnV0IGRlc2NlbmRhbnRzIGFyZSB0cmF2ZXJzZWQgaW4gYENoYW5nZURldGVjdGlvbk1vZGUuVGFyZ2V0ZWRgIGlmIHRoZVxuICogdmlldyBIYXNDaGlsZFZpZXdzVG9SZWZyZXNoIGZsYWcgaXMgc2V0LlxuICovXG5mdW5jdGlvbiBkZXRlY3RDaGFuZ2VzSW5WaWV3KGxWaWV3OiBMVmlldywgbW9kZTogQ2hhbmdlRGV0ZWN0aW9uTW9kZSkge1xuICBjb25zdCBpc0luQ2hlY2tOb0NoYW5nZXNQYXNzID0gbmdEZXZNb2RlICYmIGlzSW5DaGVja05vQ2hhbmdlc01vZGUoKTtcbiAgY29uc3QgdFZpZXcgPSBsVmlld1tUVklFV107XG4gIGNvbnN0IGZsYWdzID0gbFZpZXdbRkxBR1NdO1xuICBjb25zdCBjb25zdW1lciA9IGxWaWV3W1JFQUNUSVZFX1RFTVBMQVRFX0NPTlNVTUVSXTtcblxuICAvLyBSZWZyZXNoIENoZWNrQWx3YXlzIHZpZXdzIGluIEdsb2JhbCBtb2RlLlxuICBsZXQgc2hvdWxkUmVmcmVzaFZpZXc6IGJvb2xlYW4gPSAhIShcbiAgICBtb2RlID09PSBDaGFuZ2VEZXRlY3Rpb25Nb2RlLkdsb2JhbCAmJiBmbGFncyAmIExWaWV3RmxhZ3MuQ2hlY2tBbHdheXNcbiAgKTtcblxuICAvLyBSZWZyZXNoIERpcnR5IHZpZXdzIGluIEdsb2JhbCBtb2RlLCBhcyBsb25nIGFzIHdlJ3JlIG5vdCBpbiBjaGVja05vQ2hhbmdlcy5cbiAgLy8gQ2hlY2tOb0NoYW5nZXMgbmV2ZXIgd29ya2VkIHdpdGggYE9uUHVzaGAgY29tcG9uZW50cyBiZWNhdXNlIHRoZSBgRGlydHlgIGZsYWcgd2FzXG4gIC8vIGNsZWFyZWQgYmVmb3JlIGNoZWNrTm9DaGFuZ2VzIHJhbi4gQmVjYXVzZSB0aGVyZSBpcyBub3cgYSBsb29wIGZvciB0byBjaGVjayBmb3JcbiAgLy8gYmFja3dhcmRzIHZpZXdzLCBpdCBnaXZlcyBhbiBvcHBvcnR1bml0eSBmb3IgYE9uUHVzaGAgY29tcG9uZW50cyB0byBiZSBtYXJrZWQgYERpcnR5YFxuICAvLyBiZWZvcmUgdGhlIENoZWNrTm9DaGFuZ2VzIHBhc3MuIFdlIGRvbid0IHdhbnQgZXhpc3RpbmcgZXJyb3JzIHRoYXQgYXJlIGhpZGRlbiBieSB0aGVcbiAgLy8gY3VycmVudCBDaGVja05vQ2hhbmdlcyBidWcgdG8gc3VyZmFjZSB3aGVuIG1ha2luZyB1bnJlbGF0ZWQgY2hhbmdlcy5cbiAgc2hvdWxkUmVmcmVzaFZpZXcgfHw9ICEhKFxuICAgIGZsYWdzICYgTFZpZXdGbGFncy5EaXJ0eSAmJlxuICAgIG1vZGUgPT09IENoYW5nZURldGVjdGlvbk1vZGUuR2xvYmFsICYmXG4gICAgIWlzSW5DaGVja05vQ2hhbmdlc1Bhc3NcbiAgKTtcblxuICAvLyBBbHdheXMgcmVmcmVzaCB2aWV3cyBtYXJrZWQgZm9yIHJlZnJlc2gsIHJlZ2FyZGxlc3Mgb2YgbW9kZS5cbiAgc2hvdWxkUmVmcmVzaFZpZXcgfHw9ICEhKGZsYWdzICYgTFZpZXdGbGFncy5SZWZyZXNoVmlldyk7XG5cbiAgLy8gUmVmcmVzaCB2aWV3cyB3aGVuIHRoZXkgaGF2ZSBhIGRpcnR5IHJlYWN0aXZlIGNvbnN1bWVyLCByZWdhcmRsZXNzIG9mIG1vZGUuXG4gIHNob3VsZFJlZnJlc2hWaWV3IHx8PSAhIShjb25zdW1lcj8uZGlydHkgJiYgY29uc3VtZXJQb2xsUHJvZHVjZXJzRm9yQ2hhbmdlKGNvbnN1bWVyKSk7XG5cbiAgc2hvdWxkUmVmcmVzaFZpZXcgfHw9ICEhKG5nRGV2TW9kZSAmJiBpc0V4aGF1c3RpdmVDaGVja05vQ2hhbmdlcygpKTtcblxuICAvLyBNYXJrIHRoZSBGbGFncyBhbmQgYFJlYWN0aXZlTm9kZWAgYXMgbm90IGRpcnR5IGJlZm9yZSByZWZyZXNoaW5nIHRoZSBjb21wb25lbnQsIHNvIHRoYXQgdGhleVxuICAvLyBjYW4gYmUgcmUtZGlydGllZCBkdXJpbmcgdGhlIHJlZnJlc2ggcHJvY2Vzcy5cbiAgaWYgKGNvbnN1bWVyKSB7XG4gICAgY29uc3VtZXIuZGlydHkgPSBmYWxzZTtcbiAgfVxuICBsVmlld1tGTEFHU10gJj0gfihMVmlld0ZsYWdzLkhhc0NoaWxkVmlld3NUb1JlZnJlc2ggfCBMVmlld0ZsYWdzLlJlZnJlc2hWaWV3KTtcblxuICBpZiAoc2hvdWxkUmVmcmVzaFZpZXcpIHtcbiAgICByZWZyZXNoVmlldyh0VmlldywgbFZpZXcsIHRWaWV3LnRlbXBsYXRlLCBsVmlld1tDT05URVhUXSk7XG4gIH0gZWxzZSBpZiAoZmxhZ3MgJiBMVmlld0ZsYWdzLkhhc0NoaWxkVmlld3NUb1JlZnJlc2gpIHtcbiAgICBkZXRlY3RDaGFuZ2VzSW5FbWJlZGRlZFZpZXdzKGxWaWV3LCBDaGFuZ2VEZXRlY3Rpb25Nb2RlLlRhcmdldGVkKTtcbiAgICBjb25zdCBjb21wb25lbnRzID0gdFZpZXcuY29tcG9uZW50cztcbiAgICBpZiAoY29tcG9uZW50cyAhPT0gbnVsbCkge1xuICAgICAgZGV0ZWN0Q2hhbmdlc0luQ2hpbGRDb21wb25lbnRzKGxWaWV3LCBjb21wb25lbnRzLCBDaGFuZ2VEZXRlY3Rpb25Nb2RlLlRhcmdldGVkKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqIFJlZnJlc2hlcyBjaGlsZCBjb21wb25lbnRzIGluIHRoZSBjdXJyZW50IHZpZXcgKHVwZGF0ZSBtb2RlKS4gKi9cbmZ1bmN0aW9uIGRldGVjdENoYW5nZXNJbkNoaWxkQ29tcG9uZW50cyhcbiAgaG9zdExWaWV3OiBMVmlldyxcbiAgY29tcG9uZW50czogbnVtYmVyW10sXG4gIG1vZGU6IENoYW5nZURldGVjdGlvbk1vZGUsXG4pOiB2b2lkIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb21wb25lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgZGV0ZWN0Q2hhbmdlc0luQ29tcG9uZW50KGhvc3RMVmlldywgY29tcG9uZW50c1tpXSwgbW9kZSk7XG4gIH1cbn1cbiJdfQ==