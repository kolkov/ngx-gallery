/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { InjectFlags } from '../di/interface/injector';
import { assertDefined, assertEqual, assertGreaterThanOrEqual, assertLessThan, assertNotEqual, throwError, } from '../util/assert';
import { assertLViewOrUndefined, assertTNodeForLView, assertTNodeForTView } from './assert';
import { CONTEXT, DECLARATION_VIEW, HEADER_OFFSET, T_HOST, TVIEW, } from './interfaces/view';
import { MATH_ML_NAMESPACE, SVG_NAMESPACE } from './namespaces';
import { getTNode, walkUpViews } from './util/view_utils';
const instructionState = {
    lFrame: createLFrame(null),
    bindingsEnabled: true,
    skipHydrationRootTNode: null,
};
export var CheckNoChangesMode;
(function (CheckNoChangesMode) {
    CheckNoChangesMode[CheckNoChangesMode["Off"] = 0] = "Off";
    CheckNoChangesMode[CheckNoChangesMode["Exhaustive"] = 1] = "Exhaustive";
    CheckNoChangesMode[CheckNoChangesMode["OnlyDirtyViews"] = 2] = "OnlyDirtyViews";
})(CheckNoChangesMode || (CheckNoChangesMode = {}));
/**
 * In this mode, any changes in bindings will throw an ExpressionChangedAfterChecked error.
 *
 * Necessary to support ChangeDetectorRef.checkNoChanges().
 *
 * The `checkNoChanges` function is invoked only in ngDevMode=true and verifies that no unintended
 * changes exist in the change detector or its children.
 */
let _checkNoChangesMode = 0; /* CheckNoChangesMode.Off */
/**
 * Flag used to indicate that we are in the middle running change detection on a view
 *
 * @see detectChangesInViewWhileDirty
 */
let _isRefreshingViews = false;
/**
 * Returns true if the instruction state stack is empty.
 *
 * Intended to be called from tests only (tree shaken otherwise).
 */
export function specOnlyIsInstructionStateEmpty() {
    return instructionState.lFrame.parent === null;
}
export function getElementDepthCount() {
    return instructionState.lFrame.elementDepthCount;
}
export function increaseElementDepthCount() {
    instructionState.lFrame.elementDepthCount++;
}
export function decreaseElementDepthCount() {
    instructionState.lFrame.elementDepthCount--;
}
export function getBindingsEnabled() {
    return instructionState.bindingsEnabled;
}
/**
 * Returns true if currently inside a skip hydration block.
 * @returns boolean
 */
export function isInSkipHydrationBlock() {
    return instructionState.skipHydrationRootTNode !== null;
}
/**
 * Returns true if this is the root TNode of the skip hydration block.
 * @param tNode the current TNode
 * @returns boolean
 */
export function isSkipHydrationRootTNode(tNode) {
    return instructionState.skipHydrationRootTNode === tNode;
}
/**
 * Enables directive matching on elements.
 *
 *  * Example:
 * ```
 * <my-comp my-directive>
 *   Should match component / directive.
 * </my-comp>
 * <div ngNonBindable>
 *   <!-- ɵɵdisableBindings() -->
 *   <my-comp my-directive>
 *     Should not match component / directive because we are in ngNonBindable.
 *   </my-comp>
 *   <!-- ɵɵenableBindings() -->
 * </div>
 * ```
 *
 * @codeGenApi
 */
export function ɵɵenableBindings() {
    instructionState.bindingsEnabled = true;
}
/**
 * Sets a flag to specify that the TNode is in a skip hydration block.
 * @param tNode the current TNode
 */
export function enterSkipHydrationBlock(tNode) {
    instructionState.skipHydrationRootTNode = tNode;
}
/**
 * Disables directive matching on element.
 *
 *  * Example:
 * ```
 * <my-comp my-directive>
 *   Should match component / directive.
 * </my-comp>
 * <div ngNonBindable>
 *   <!-- ɵɵdisableBindings() -->
 *   <my-comp my-directive>
 *     Should not match component / directive because we are in ngNonBindable.
 *   </my-comp>
 *   <!-- ɵɵenableBindings() -->
 * </div>
 * ```
 *
 * @codeGenApi
 */
export function ɵɵdisableBindings() {
    instructionState.bindingsEnabled = false;
}
/**
 * Clears the root skip hydration node when leaving a skip hydration block.
 */
export function leaveSkipHydrationBlock() {
    instructionState.skipHydrationRootTNode = null;
}
/**
 * Return the current `LView`.
 */
export function getLView() {
    return instructionState.lFrame.lView;
}
/**
 * Return the current `TView`.
 */
export function getTView() {
    return instructionState.lFrame.tView;
}
/**
 * Restores `contextViewData` to the given OpaqueViewState instance.
 *
 * Used in conjunction with the getCurrentView() instruction to save a snapshot
 * of the current view and restore it when listeners are invoked. This allows
 * walking the declaration view tree in listeners to get vars from parent views.
 *
 * @param viewToRestore The OpaqueViewState instance to restore.
 * @returns Context of the restored OpaqueViewState instance.
 *
 * @codeGenApi
 */
export function ɵɵrestoreView(viewToRestore) {
    instructionState.lFrame.contextLView = viewToRestore;
    return viewToRestore[CONTEXT];
}
/**
 * Clears the view set in `ɵɵrestoreView` from memory. Returns the passed in
 * value so that it can be used as a return value of an instruction.
 *
 * @codeGenApi
 */
export function ɵɵresetView(value) {
    instructionState.lFrame.contextLView = null;
    return value;
}
export function getCurrentTNode() {
    let currentTNode = getCurrentTNodePlaceholderOk();
    while (currentTNode !== null && currentTNode.type === 64 /* TNodeType.Placeholder */) {
        currentTNode = currentTNode.parent;
    }
    return currentTNode;
}
export function getCurrentTNodePlaceholderOk() {
    return instructionState.lFrame.currentTNode;
}
export function getCurrentParentTNode() {
    const lFrame = instructionState.lFrame;
    const currentTNode = lFrame.currentTNode;
    return lFrame.isParent ? currentTNode : currentTNode.parent;
}
export function setCurrentTNode(tNode, isParent) {
    ngDevMode && tNode && assertTNodeForTView(tNode, instructionState.lFrame.tView);
    const lFrame = instructionState.lFrame;
    lFrame.currentTNode = tNode;
    lFrame.isParent = isParent;
}
export function isCurrentTNodeParent() {
    return instructionState.lFrame.isParent;
}
export function setCurrentTNodeAsNotParent() {
    instructionState.lFrame.isParent = false;
}
export function getContextLView() {
    const contextLView = instructionState.lFrame.contextLView;
    ngDevMode && assertDefined(contextLView, 'contextLView must be defined.');
    return contextLView;
}
export function isInCheckNoChangesMode() {
    !ngDevMode && throwError('Must never be called in production mode');
    return _checkNoChangesMode !== CheckNoChangesMode.Off;
}
export function isExhaustiveCheckNoChanges() {
    !ngDevMode && throwError('Must never be called in production mode');
    return _checkNoChangesMode === CheckNoChangesMode.Exhaustive;
}
export function setIsInCheckNoChangesMode(mode) {
    !ngDevMode && throwError('Must never be called in production mode');
    _checkNoChangesMode = mode;
}
export function isRefreshingViews() {
    return _isRefreshingViews;
}
export function setIsRefreshingViews(mode) {
    _isRefreshingViews = mode;
}
// top level variables should not be exported for performance reasons (PERF_NOTES.md)
export function getBindingRoot() {
    const lFrame = instructionState.lFrame;
    let index = lFrame.bindingRootIndex;
    if (index === -1) {
        index = lFrame.bindingRootIndex = lFrame.tView.bindingStartIndex;
    }
    return index;
}
export function getBindingIndex() {
    return instructionState.lFrame.bindingIndex;
}
export function setBindingIndex(value) {
    return (instructionState.lFrame.bindingIndex = value);
}
export function nextBindingIndex() {
    return instructionState.lFrame.bindingIndex++;
}
export function incrementBindingIndex(count) {
    const lFrame = instructionState.lFrame;
    const index = lFrame.bindingIndex;
    lFrame.bindingIndex = lFrame.bindingIndex + count;
    return index;
}
export function isInI18nBlock() {
    return instructionState.lFrame.inI18n;
}
export function setInI18nBlock(isInI18nBlock) {
    instructionState.lFrame.inI18n = isInI18nBlock;
}
/**
 * Set a new binding root index so that host template functions can execute.
 *
 * Bindings inside the host template are 0 index. But because we don't know ahead of time
 * how many host bindings we have we can't pre-compute them. For this reason they are all
 * 0 index and we just shift the root so that they match next available location in the LView.
 *
 * @param bindingRootIndex Root index for `hostBindings`
 * @param currentDirectiveIndex `TData[currentDirectiveIndex]` will point to the current directive
 *        whose `hostBindings` are being processed.
 */
export function setBindingRootForHostBindings(bindingRootIndex, currentDirectiveIndex) {
    const lFrame = instructionState.lFrame;
    lFrame.bindingIndex = lFrame.bindingRootIndex = bindingRootIndex;
    setCurrentDirectiveIndex(currentDirectiveIndex);
}
/**
 * When host binding is executing this points to the directive index.
 * `TView.data[getCurrentDirectiveIndex()]` is `DirectiveDef`
 * `LView[getCurrentDirectiveIndex()]` is directive instance.
 */
export function getCurrentDirectiveIndex() {
    return instructionState.lFrame.currentDirectiveIndex;
}
/**
 * Sets an index of a directive whose `hostBindings` are being processed.
 *
 * @param currentDirectiveIndex `TData` index where current directive instance can be found.
 */
export function setCurrentDirectiveIndex(currentDirectiveIndex) {
    instructionState.lFrame.currentDirectiveIndex = currentDirectiveIndex;
}
/**
 * Retrieve the current `DirectiveDef` which is active when `hostBindings` instruction is being
 * executed.
 *
 * @param tData Current `TData` where the `DirectiveDef` will be looked up at.
 */
export function getCurrentDirectiveDef(tData) {
    const currentDirectiveIndex = instructionState.lFrame.currentDirectiveIndex;
    return currentDirectiveIndex === -1 ? null : tData[currentDirectiveIndex];
}
export function getCurrentQueryIndex() {
    return instructionState.lFrame.currentQueryIndex;
}
export function setCurrentQueryIndex(value) {
    instructionState.lFrame.currentQueryIndex = value;
}
/**
 * Returns a `TNode` of the location where the current `LView` is declared at.
 *
 * @param lView an `LView` that we want to find parent `TNode` for.
 */
function getDeclarationTNode(lView) {
    const tView = lView[TVIEW];
    // Return the declaration parent for embedded views
    if (tView.type === 2 /* TViewType.Embedded */) {
        ngDevMode && assertDefined(tView.declTNode, 'Embedded TNodes should have declaration parents.');
        return tView.declTNode;
    }
    // Components don't have `TView.declTNode` because each instance of component could be
    // inserted in different location, hence `TView.declTNode` is meaningless.
    // Falling back to `T_HOST` in case we cross component boundary.
    if (tView.type === 1 /* TViewType.Component */) {
        return lView[T_HOST];
    }
    // Remaining TNode type is `TViewType.Root` which doesn't have a parent TNode.
    return null;
}
/**
 * This is a light weight version of the `enterView` which is needed by the DI system.
 *
 * @param lView `LView` location of the DI context.
 * @param tNode `TNode` for DI context
 * @param flags DI context flags. if `SkipSelf` flag is set than we walk up the declaration
 *     tree from `tNode`  until we find parent declared `TElementNode`.
 * @returns `true` if we have successfully entered DI associated with `tNode` (or with declared
 *     `TNode` if `flags` has  `SkipSelf`). Failing to enter DI implies that no associated
 *     `NodeInjector` can be found and we should instead use `ModuleInjector`.
 *     - If `true` than this call must be fallowed by `leaveDI`
 *     - If `false` than this call failed and we should NOT call `leaveDI`
 */
export function enterDI(lView, tNode, flags) {
    ngDevMode && assertLViewOrUndefined(lView);
    if (flags & InjectFlags.SkipSelf) {
        ngDevMode && assertTNodeForTView(tNode, lView[TVIEW]);
        let parentTNode = tNode;
        let parentLView = lView;
        while (true) {
            ngDevMode && assertDefined(parentTNode, 'Parent TNode should be defined');
            parentTNode = parentTNode.parent;
            if (parentTNode === null && !(flags & InjectFlags.Host)) {
                parentTNode = getDeclarationTNode(parentLView);
                if (parentTNode === null)
                    break;
                // In this case, a parent exists and is definitely an element. So it will definitely
                // have an existing lView as the declaration view, which is why we can assume it's defined.
                ngDevMode && assertDefined(parentLView, 'Parent LView should be defined');
                parentLView = parentLView[DECLARATION_VIEW];
                // In Ivy there are Comment nodes that correspond to ngIf and NgFor embedded directives
                // We want to skip those and look only at Elements and ElementContainers to ensure
                // we're looking at true parent nodes, and not content or other types.
                if (parentTNode.type & (2 /* TNodeType.Element */ | 8 /* TNodeType.ElementContainer */)) {
                    break;
                }
            }
            else {
                break;
            }
        }
        if (parentTNode === null) {
            // If we failed to find a parent TNode this means that we should use module injector.
            return false;
        }
        else {
            tNode = parentTNode;
            lView = parentLView;
        }
    }
    ngDevMode && assertTNodeForLView(tNode, lView);
    const lFrame = (instructionState.lFrame = allocLFrame());
    lFrame.currentTNode = tNode;
    lFrame.lView = lView;
    return true;
}
/**
 * Swap the current lView with a new lView.
 *
 * For performance reasons we store the lView in the top level of the module.
 * This way we minimize the number of properties to read. Whenever a new view
 * is entered we have to store the lView for later, and when the view is
 * exited the state has to be restored
 *
 * @param newView New lView to become active
 * @returns the previously active lView;
 */
export function enterView(newView) {
    ngDevMode && assertNotEqual(newView[0], newView[1], '????');
    ngDevMode && assertLViewOrUndefined(newView);
    const newLFrame = allocLFrame();
    if (ngDevMode) {
        assertEqual(newLFrame.isParent, true, 'Expected clean LFrame');
        assertEqual(newLFrame.lView, null, 'Expected clean LFrame');
        assertEqual(newLFrame.tView, null, 'Expected clean LFrame');
        assertEqual(newLFrame.selectedIndex, -1, 'Expected clean LFrame');
        assertEqual(newLFrame.elementDepthCount, 0, 'Expected clean LFrame');
        assertEqual(newLFrame.currentDirectiveIndex, -1, 'Expected clean LFrame');
        assertEqual(newLFrame.currentNamespace, null, 'Expected clean LFrame');
        assertEqual(newLFrame.bindingRootIndex, -1, 'Expected clean LFrame');
        assertEqual(newLFrame.currentQueryIndex, 0, 'Expected clean LFrame');
    }
    const tView = newView[TVIEW];
    instructionState.lFrame = newLFrame;
    ngDevMode && tView.firstChild && assertTNodeForTView(tView.firstChild, tView);
    newLFrame.currentTNode = tView.firstChild;
    newLFrame.lView = newView;
    newLFrame.tView = tView;
    newLFrame.contextLView = newView;
    newLFrame.bindingIndex = tView.bindingStartIndex;
    newLFrame.inI18n = false;
}
/**
 * Allocates next free LFrame. This function tries to reuse the `LFrame`s to lower memory pressure.
 */
function allocLFrame() {
    const currentLFrame = instructionState.lFrame;
    const childLFrame = currentLFrame === null ? null : currentLFrame.child;
    const newLFrame = childLFrame === null ? createLFrame(currentLFrame) : childLFrame;
    return newLFrame;
}
function createLFrame(parent) {
    const lFrame = {
        currentTNode: null,
        isParent: true,
        lView: null,
        tView: null,
        selectedIndex: -1,
        contextLView: null,
        elementDepthCount: 0,
        currentNamespace: null,
        currentDirectiveIndex: -1,
        bindingRootIndex: -1,
        bindingIndex: -1,
        currentQueryIndex: 0,
        parent: parent,
        child: null,
        inI18n: false,
    };
    parent !== null && (parent.child = lFrame); // link the new LFrame for reuse.
    return lFrame;
}
/**
 * A lightweight version of leave which is used with DI.
 *
 * This function only resets `currentTNode` and `LView` as those are the only properties
 * used with DI (`enterDI()`).
 *
 * NOTE: This function is reexported as `leaveDI`. However `leaveDI` has return type of `void` where
 * as `leaveViewLight` has `LFrame`. This is so that `leaveViewLight` can be used in `leaveView`.
 */
function leaveViewLight() {
    const oldLFrame = instructionState.lFrame;
    instructionState.lFrame = oldLFrame.parent;
    oldLFrame.currentTNode = null;
    oldLFrame.lView = null;
    return oldLFrame;
}
/**
 * This is a lightweight version of the `leaveView` which is needed by the DI system.
 *
 * NOTE: this function is an alias so that we can change the type of the function to have `void`
 * return type.
 */
export const leaveDI = leaveViewLight;
/**
 * Leave the current `LView`
 *
 * This pops the `LFrame` with the associated `LView` from the stack.
 *
 * IMPORTANT: We must zero out the `LFrame` values here otherwise they will be retained. This is
 * because for performance reasons we don't release `LFrame` but rather keep it for next use.
 */
export function leaveView() {
    const oldLFrame = leaveViewLight();
    oldLFrame.isParent = true;
    oldLFrame.tView = null;
    oldLFrame.selectedIndex = -1;
    oldLFrame.contextLView = null;
    oldLFrame.elementDepthCount = 0;
    oldLFrame.currentDirectiveIndex = -1;
    oldLFrame.currentNamespace = null;
    oldLFrame.bindingRootIndex = -1;
    oldLFrame.bindingIndex = -1;
    oldLFrame.currentQueryIndex = 0;
}
export function nextContextImpl(level) {
    const contextLView = (instructionState.lFrame.contextLView = walkUpViews(level, instructionState.lFrame.contextLView));
    return contextLView[CONTEXT];
}
/**
 * Gets the currently selected element index.
 *
 * Used with {@link property} instruction (and more in the future) to identify the index in the
 * current `LView` to act on.
 */
export function getSelectedIndex() {
    return instructionState.lFrame.selectedIndex;
}
/**
 * Sets the most recent index passed to {@link select}
 *
 * Used with {@link property} instruction (and more in the future) to identify the index in the
 * current `LView` to act on.
 *
 * (Note that if an "exit function" was set earlier (via `setElementExitFn()`) then that will be
 * run if and when the provided `index` value is different from the current selected index value.)
 */
export function setSelectedIndex(index) {
    ngDevMode &&
        index !== -1 &&
        assertGreaterThanOrEqual(index, HEADER_OFFSET, 'Index must be past HEADER_OFFSET (or -1).');
    ngDevMode &&
        assertLessThan(index, instructionState.lFrame.lView.length, "Can't set index passed end of LView");
    instructionState.lFrame.selectedIndex = index;
}
/**
 * Gets the `tNode` that represents currently selected element.
 */
export function getSelectedTNode() {
    const lFrame = instructionState.lFrame;
    return getTNode(lFrame.tView, lFrame.selectedIndex);
}
/**
 * Sets the namespace used to create elements to `'http://www.w3.org/2000/svg'` in global state.
 *
 * @codeGenApi
 */
export function ɵɵnamespaceSVG() {
    instructionState.lFrame.currentNamespace = SVG_NAMESPACE;
}
/**
 * Sets the namespace used to create elements to `'http://www.w3.org/1998/MathML/'` in global state.
 *
 * @codeGenApi
 */
export function ɵɵnamespaceMathML() {
    instructionState.lFrame.currentNamespace = MATH_ML_NAMESPACE;
}
/**
 * Sets the namespace used to create elements to `null`, which forces element creation to use
 * `createElement` rather than `createElementNS`.
 *
 * @codeGenApi
 */
export function ɵɵnamespaceHTML() {
    namespaceHTMLInternal();
}
/**
 * Sets the namespace used to create elements to `null`, which forces element creation to use
 * `createElement` rather than `createElementNS`.
 */
export function namespaceHTMLInternal() {
    instructionState.lFrame.currentNamespace = null;
}
export function getNamespace() {
    return instructionState.lFrame.currentNamespace;
}
let _wasLastNodeCreated = true;
/**
 * Retrieves a global flag that indicates whether the most recent DOM node
 * was created or hydrated.
 */
export function wasLastNodeCreated() {
    return _wasLastNodeCreated;
}
/**
 * Sets a global flag to indicate whether the most recent DOM node
 * was created or hydrated.
 */
export function lastNodeWasCreated(flag) {
    _wasLastNodeCreated = flag;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL3N0YXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSwwQkFBMEIsQ0FBQztBQUNyRCxPQUFPLEVBQ0wsYUFBYSxFQUNiLFdBQVcsRUFDWCx3QkFBd0IsRUFDeEIsY0FBYyxFQUNkLGNBQWMsRUFDZCxVQUFVLEdBQ1gsTUFBTSxnQkFBZ0IsQ0FBQztBQUV4QixPQUFPLEVBQUMsc0JBQXNCLEVBQUUsbUJBQW1CLEVBQUUsbUJBQW1CLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFHMUYsT0FBTyxFQUNMLE9BQU8sRUFDUCxnQkFBZ0IsRUFDaEIsYUFBYSxFQUdiLE1BQU0sRUFFTixLQUFLLEdBR04sTUFBTSxtQkFBbUIsQ0FBQztBQUMzQixPQUFPLEVBQUMsaUJBQWlCLEVBQUUsYUFBYSxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBQzlELE9BQU8sRUFBQyxRQUFRLEVBQUUsV0FBVyxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUEwS3hELE1BQU0sZ0JBQWdCLEdBQXFCO0lBQ3pDLE1BQU0sRUFBRSxZQUFZLENBQUMsSUFBSSxDQUFDO0lBQzFCLGVBQWUsRUFBRSxJQUFJO0lBQ3JCLHNCQUFzQixFQUFFLElBQUk7Q0FDN0IsQ0FBQztBQUVGLE1BQU0sQ0FBTixJQUFZLGtCQUlYO0FBSkQsV0FBWSxrQkFBa0I7SUFDNUIseURBQUcsQ0FBQTtJQUNILHVFQUFVLENBQUE7SUFDViwrRUFBYyxDQUFBO0FBQ2hCLENBQUMsRUFKVyxrQkFBa0IsS0FBbEIsa0JBQWtCLFFBSTdCO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILElBQUksbUJBQW1CLEdBQXVCLENBQUMsQ0FBQyxDQUFDLDRCQUE0QjtBQUU3RTs7OztHQUlHO0FBQ0gsSUFBSSxrQkFBa0IsR0FBRyxL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QUFVLGNBQWM7SUFDNUIsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLGdCQUFnQixHQUFHLGFBQWEsQ0FBQztBQUMzRCxDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILE1BQU0sVUFBVSxpQkFBaUI7SUFDL0IsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLGdCQUFnQixHQUFHLGlCQUFpQixDQUFDO0FBQy9ELENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sVUFBVSxlQUFlO0lBQzdCLHFCQUFxQixFQUFFLENBQUM7QUFDMUIsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxxQkFBcUI7SUFDbkMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQztBQUNsRCxDQUFDO0FBRUQsTUFBTSxVQUFVLFlBQVk7SUFDMUIsT0FBTyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7QUFDbEQsQ0FBQztBQUVELElBQUksbUJBQW1CLEdBQUcsSUFBSSxDQUFDO0FBRS9COzs7R0FHRztBQUNILE1BQU0sVUFBVSxrQkFBa0I7SUFDaEMsT0FBTyxtQkFBbUIsQ0FBQztBQUM3QixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLGtCQUFrQixDQUFDLElBQWE7SUFDOUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDO0FBQzdCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtJbmplY3RGbGFnc30gZnJvbSAnLi4vZGkvaW50ZXJmYWNlL2luamVjdG9yJztcbmltcG9ydCB7XG4gIGFzc2VydERlZmluZWQsXG4gIGFzc2VydEVxdWFsLFxuICBhc3NlcnRHcmVhdGVyVGhhbk9yRXF1YWwsXG4gIGFzc2VydExlc3NUaGFuLFxuICBhc3NlcnROb3RFcXVhbCxcbiAgdGhyb3dFcnJvcixcbn0gZnJvbSAnLi4vdXRpbC9hc3NlcnQnO1xuXG5pbXBvcnQge2Fzc2VydExWaWV3T3JVbmRlZmluZWQsIGFzc2VydFROb2RlRm9yTFZpZXcsIGFzc2VydFROb2RlRm9yVFZpZXd9IGZyb20gJy4vYXNzZXJ0JztcbmltcG9ydCB7RGlyZWN0aXZlRGVmfSBmcm9tICcuL2ludGVyZmFjZXMvZGVmaW5pdGlvbic7XG5pbXBvcnQge1ROb2RlLCBUTm9kZVR5cGV9IGZyb20gJy4vaW50ZXJmYWNlcy9ub2RlJztcbmltcG9ydCB7XG4gIENPTlRFWFQsXG4gIERFQ0xBUkFUSU9OX1ZJRVcsXG4gIEhFQURFUl9PRkZTRVQsXG4gIExWaWV3LFxuICBPcGFxdWVWaWV3U3RhdGUsXG4gIFRfSE9TVCxcbiAgVERhdGEsXG4gIFRWSUVXLFxuICBUVmlldyxcbiAgVFZpZXdUeXBlLFxufSBmcm9tICcuL2ludGVyZmFjZXMvdmlldyc7XG5pbXBvcnQge01BVEhfTUxfTkFNRVNQQUNFLCBTVkdfTkFNRVNQQUNFfSBmcm9tICcuL25hbWVzcGFjZXMnO1xuaW1wb3J0IHtnZXRUTm9kZSwgd2Fsa1VwVmlld3N9IGZyb20gJy4vdXRpbC92aWV3X3V0aWxzJztcblxuLyoqXG4gKlxuICovXG5pbnRlcmZhY2UgTEZyYW1lIHtcbiAgLyoqXG4gICAqIFBhcmVudCBMRnJhbWUuXG4gICAqXG4gICAqIFRoaXMgaXMgbmVlZGVkIHdoZW4gYGxlYXZlVmlld2AgaXMgY2FsbGVkIHRvIHJlc3RvcmUgdGhlIHByZXZpb3VzIHN0YXRlLlxuICAgKi9cbiAgcGFyZW50OiBMRnJhbWU7XG5cbiAgLyoqXG4gICAqIENoaWxkIExGcmFtZS5cbiAgICpcbiAgICogVGhpcyBpcyB1c2VkIHRvIGNhY2hlIGV4aXN0aW5nIExGcmFtZXMgdG8gcmVsaWV2ZSB0aGUgbWVtb3J5IHByZXNzdXJlLlxuICAgKi9cbiAgY2hpbGQ6IExGcmFtZSB8IG51bGw7XG5cbiAgLyoqXG4gICAqIFN0YXRlIG9mIHRoZSBjdXJyZW50IHZpZXcgYmVpbmcgcHJvY2Vzc2VkLlxuICAgKlxuICAgKiBBbiBhcnJheSBvZiBub2RlcyAodGV4dCwgZWxlbWVudCwgY29udGFpbmVyLCBldGMpLCBwaXBlcywgdGhlaXIgYmluZGluZ3MsIGFuZFxuICAgKiBhbnkgbG9jYWwgdmFyaWFibGVzIHRoYXQgbmVlZCB0byBiZSBzdG9yZWQgYmV0d2VlbiBpbnZvY2F0aW9ucy5cbiAgICovXG4gIGxWaWV3OiBMVmlldztcblxuICAvKipcbiAgICogQ3VycmVudCBgVFZpZXdgIGFzc29jaWF0ZWQgd2l0aCB0aGUgYExGcmFtZS5sVmlld2AuXG4gICAqXG4gICAqIE9uZSBjYW4gZ2V0IGBUVmlld2AgZnJvbSBgbEZyYW1lW1RWSUVXXWAgaG93ZXZlciBiZWNhdXNlIGl0IGlzIHNvIGNvbW1vbiBpdCBtYWtlcyBzZW5zZSB0b1xuICAgKiBzdG9yZSBpdCBpbiBgTEZyYW1lYCBmb3IgcGVyZiByZWFzb25zLlxuICAgKi9cbiAgdFZpZXc6IFRWaWV3O1xuXG4gIC8qKlxuICAgKiBVc2VkIHRvIHNldCB0aGUgcGFyZW50IHByb3BlcnR5IHdoZW4gbm9kZXMgYXJlIGNyZWF0ZWQgYW5kIHRyYWNrIHF1ZXJ5IHJlc3VsdHMuXG4gICAqXG4gICAqIFRoaXMgaXMgdXNlZCBpbiBjb25qdW5jdGlvbiB3aXRoIGBpc1BhcmVudGAuXG4gICAqL1xuICBjdXJyZW50VE5vZGU6IFROb2RlIHwgbnVsbDtcblxuICAvKipcbiAgICogSWYgYGlzUGFyZW50YCBpczpcbiAgICogIC0gYHRydWVgOiB0aGVuIGBjdXJyZW50VE5vZGVgIHBvaW50cyB0byBhIHBhcmVudCBub2RlLlxuICAgKiAgLSBgZmFsc2VgOiB0aGVuIGBjdXJyZW50VE5vZGVgIHBvaW50cyB0byBwcmV2aW91cyBub2RlIChzaWJsaW5nKS5cbiAgICovXG4gIGlzUGFyZW50OiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBJbmRleCBvZiBjdXJyZW50bHkgc2VsZWN0ZWQgZWxlbWVudCBpbiBMVmlldy5cbiAgICpcbiAgICogVXNlZCBieSBiaW5kaW5nIGluc3RydWN0aW9ucy4gVXBkYXRlZCBhcyBwYXJ0IG9mIGFkdmFuY2UgaW5zdHJ1Y3Rpb24uXG4gICAqL1xuICBzZWxlY3RlZEluZGV4OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIEN1cnJlbnQgcG9pbnRlciB0byB0aGUgYmluZGluZyBpbmRleC5cbiAgICovXG4gIGJpbmRpbmdJbmRleDogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBUaGUgbGFzdCB2aWV3RGF0YSByZXRyaWV2ZWQgYnkgbmV4dENvbnRleHQoKS5cbiAgICogQWxsb3dzIGJ1aWxkaW5nIG5leHRDb250ZXh0KCkgYW5kIHJlZmVyZW5jZSgpIGNhbGxzLlxuICAgKlxuICAgKiBlLmcuIGNvbnN0IGlubmVyID0geCgpLiRpbXBsaWNpdDsgY29uc3Qgb3V0ZXIgPSB4KCkuJGltcGxpY2l0O1xuICAgKi9cbiAgY29udGV4dExWaWV3OiBMVmlldyB8IG51bGw7XG5cbiAgLyoqXG4gICAqIFN0b3JlIHRoZSBlbGVtZW50IGRlcHRoIGNvdW50LiBUaGlzIGlzIHVzZWQgdG8gaWRlbnRpZnkgdGhlIHJvb3QgZWxlbWVudHMgb2YgdGhlIHRlbXBsYXRlXG4gICAqIHNvIHRoYXQgd2UgY2FuIHRoZW4gYXR0YWNoIHBhdGNoIGRhdGEgYExWaWV3YCB0byBvbmx5IHRob3NlIGVsZW1lbnRzLiBXZSBrbm93IHRoYXQgdGhvc2VcbiAgICogYXJlIHRoZSBvbmx5IHBsYWNlcyB3aGVyZSB0aGUgcGF0Y2ggZGF0YSBjb3VsZCBjaGFuZ2UsIHRoaXMgd2F5IHdlIHdpbGwgc2F2ZSBvbiBudW1iZXJcbiAgICogb2YgcGxhY2VzIHdoZXJlIHRoYSBwYXRjaGluZyBvY2N1cnMuXG4gICAqL1xuICBlbGVtZW50RGVwdGhDb3VudDogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBDdXJyZW50IG5hbWVzcGFjZSB0byBiZSB1c2VkIHdoZW4gY3JlYXRpbmcgZWxlbWVudHNcbiAgICovXG4gIGN1cnJlbnROYW1lc3BhY2U6IHN0cmluZyB8IG51bGw7XG5cbiAgLyoqXG4gICAqIFRoZSByb290IGluZGV4IGZyb20gd2hpY2ggcHVyZSBmdW5jdGlvbiBpbnN0cnVjdGlvbnMgc2hvdWxkIGNhbGN1bGF0ZSB0aGVpciBiaW5kaW5nXG4gICAqIGluZGljZXMuIEluIGNvbXBvbmVudCB2aWV3cywgdGhpcyBpcyBUVmlldy5iaW5kaW5nU3RhcnRJbmRleC4gSW4gYSBob3N0IGJpbmRpbmdcbiAgICogY29udGV4dCwgdGhpcyBpcyB0aGUgVFZpZXcuZXhwYW5kb1N0YXJ0SW5kZXggKyBhbnkgZGlycy9ob3N0VmFycyBiZWZvcmUgdGhlIGdpdmVuIGRpci5cbiAgICovXG4gIGJpbmRpbmdSb290SW5kZXg6IG51bWJlcjtcblxuICAvKipcbiAgICogQ3VycmVudCBpbmRleCBvZiBhIFZpZXcgb3IgQ29udGVudCBRdWVyeSB3aGljaCBuZWVkcyB0byBiZSBwcm9jZXNzZWQgbmV4dC5cbiAgICogV2UgaXRlcmF0ZSBvdmVyIHRoZSBsaXN0IG9mIFF1ZXJpZXMgYW5kIGluY3JlbWVudCBjdXJyZW50IHF1ZXJ5IGluZGV4IGF0IGV2ZXJ5IHN0ZXAuXG4gICAqL1xuICBjdXJyZW50UXVlcnlJbmRleDogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBXaGVuIGhvc3QgYmluZGluZyBpcyBleGVjdXRpbmcgdGhpcyBwb2ludHMgdG8gdGhlIGRpcmVjdGl2ZSBpbmRleC5cbiAgICogYFRWaWV3LmRhdGFbY3VycmVudERpcmVjdGl2ZUluZGV4XWAgaXMgYERpcmVjdGl2ZURlZmBcbiAgICogYExWaWV3W2N1cnJlbnREaXJlY3RpdmVJbmRleF1gIGlzIGRpcmVjdGl2ZSBpbnN0YW5jZS5cbiAgICovXG4gIGN1cnJlbnREaXJlY3RpdmVJbmRleDogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBBcmUgd2UgY3VycmVudGx5IGluIGkxOG4gYmxvY2sgYXMgZGVub3RlZCBieSBgybXJtWVsZW1lbnRTdGFydGAgYW5kIGDJtcm1ZWxlbWVudEVuZGAuXG4gICAqXG4gICAqIFRoaXMgaW5mb3JtYXRpb24gaXMgbmVlZGVkIGJlY2F1c2Ugd2hpbGUgd2UgYXJlIGluIGkxOG4gYmxvY2sgYWxsIGVsZW1lbnRzIG11c3QgYmUgcHJlLWRlY2xhcmVkXG4gICAqIGluIHRoZSB0cmFuc2xhdGlvbi4gKGkuZS4gYEhlbGxvIO+/vSMy77+9V29ybGTvv70vIzLvv70hYCBwcmUtZGVjbGFyZXMgZWxlbWVudCBhdCBg77+9IzLvv71gIGxvY2F0aW9uLilcbiAgICogVGhpcyBhbGxvY2F0ZXMgYFROb2RlVHlwZS5QbGFjZWhvbGRlcmAgZWxlbWVudCBhdCBsb2NhdGlvbiBgMmAuIElmIHRyYW5zbGF0b3IgcmVtb3ZlcyBg77+9IzLvv71gXG4gICAqIGZyb20gdHJhbnNsYXRpb24gdGhhbiB0aGUgcnVudGltZSBtdXN0IGFsc28gZW5zdXJlIHRoYSBlbGVtZW50IGF0IGAyYCBkb2VzIG5vdCBnZXQgaW5zZXJ0ZWRcbiAgICogaW50byB0aGUgRE9NLiBUaGUgdHJhbnNsYXRpb24gZG9lcyBub3QgY2FycnkgaW5mb3JtYXRpb24gYWJvdXQgZGVsZXRlZCBlbGVtZW50cy4gVGhlcmVmb3IgdGhlXG4gICAqIG9ubHkgd2F5IHRvIGtub3cgdGhhdCBhbiBlbGVtZW50IGlzIGRlbGV0ZWQgaXMgdGhhdCBpdCB3YXMgbm90IHByZS1kZWNsYXJlZCBpbiB0aGUgdHJhbnNsYXRpb24uXG4gICAqXG4gICAqIFRoaXMgZmxhZyB3b3JrcyBieSBlbnN1cmluZyB0aGF0IGVsZW1lbnRzIHdoaWNoIGFyZSBjcmVhdGVkIHdpdGhvdXQgcHJlLWRlY2xhcmF0aW9uXG4gICAqIChgVE5vZGVUeXBlLlBsYWNlaG9sZGVyYCkgYXJlIG5vdCBpbnNlcnRlZCBpbnRvIHRoZSBET00gcmVuZGVyIHRyZWUuIChJdCBkb2VzIG1lYW4gdGhhdCB0aGVcbiAgICogZWxlbWVudCBzdGlsbCBnZXRzIGluc3RhbnRpYXRlZCBhbG9uZyB3aXRoIGFsbCBvZiBpdHMgYmVoYXZpb3IgW2RpcmVjdGl2ZXNdKVxuICAgKi9cbiAgaW5JMThuOiBib29sZWFuO1xufVxuXG4vKipcbiAqIEFsbCBpbXBsaWNpdCBpbnN0cnVjdGlvbiBzdGF0ZSBpcyBzdG9yZWQgaGVyZS5cbiAqXG4gKiBJdCBpcyB1c2VmdWwgdG8gaGF2ZSBhIHNpbmdsZSBvYmplY3Qgd2hlcmUgYWxsIG9mIHRoZSBzdGF0ZSBpcyBzdG9yZWQgYXMgYSBtZW50YWwgbW9kZWxcbiAqIChyYXRoZXIgaXQgYmVpbmcgc3ByZWFkIGFjcm9zcyBtYW55IGRpZmZlcmVudCB2YXJpYWJsZXMuKVxuICpcbiAqIFBFUkYgTk9URTogVHVybnMgb3V0IHRoYXQgd3JpdGluZyB0byBhIHRydWUgZ2xvYmFsIHZhcmlhYmxlIGlzIHNsb3dlciB0aGFuXG4gKiBoYXZpbmcgYW4gaW50ZXJtZWRpYXRlIG9iamVjdCB3aXRoIHByb3BlcnRpZXMuXG4gKi9cbmludGVyZmFjZSBJbnN0cnVjdGlvblN0YXRlIHtcbiAgLyoqXG4gICAqIEN1cnJlbnQgYExGcmFtZWBcbiAgICpcbiAgICogYG51bGxgIGlmIHdlIGhhdmUgbm90IGNhbGxlZCBgZW50ZXJWaWV3YFxuICAgKi9cbiAgbEZyYW1lOiBMRnJhbWU7XG5cbiAgLyoqXG4gICAqIFN0b3JlcyB3aGV0aGVyIGRpcmVjdGl2ZXMgc2hvdWxkIGJlIG1hdGNoZWQgdG8gZWxlbWVudHMuXG4gICAqXG4gICAqIFdoZW4gdGVtcGxhdGUgY29udGFpbnMgYG5nTm9uQmluZGFibGVgIHRoZW4gd2UgbmVlZCB0byBwcmV2ZW50IHRoZSBydW50aW1lIGZyb20gbWF0Y2hpbmdcbiAgICogZGlyZWN0aXZlcyBvbiBjaGlsZHJlbiBvZiB0aGF0IGVsZW1lbnQuXG4gICAqXG4gICAqIEV4YW1wbGU6XG4gICAqIGBgYFxuICAgKiA8bXktY29tcCBteS1kaXJlY3RpdmU+XG4gICAqICAgU2hvdWxkIG1hdGNoIGNvbXBvbmVudCAvIGRpcmVjdGl2ZS5cbiAgICogPC9teS1jb21wPlxuICAgKiA8ZGl2IG5nTm9uQmluZGFibGU+XG4gICAqICAgPG15LWNvbXAgbXktZGlyZWN0aXZlPlxuICAgKiAgICAgU2hvdWxkIG5vdCBtYXRjaCBjb21wb25lbnQgLyBkaXJlY3RpdmUgYmVjYXVzZSB3ZSBhcmUgaW4gbmdOb25CaW5kYWJsZS5cbiAgICogICA8L215LWNvbXA+XG4gICAqIDwvZGl2PlxuICAgKiBgYGBcbiAgICovXG4gIGJpbmRpbmdzRW5hYmxlZDogYm9vbGVhbjtcblxuICAvKipcbiAgICogU3RvcmVzIHRoZSByb290IFROb2RlIHRoYXQgaGFzIHRoZSAnbmdTa2lwSHlkcmF0aW9uJyBhdHRyaWJ1dGUgb24gaXQgZm9yIGxhdGVyIHJlZmVyZW5jZS5cbiAgICpcbiAgICogRXhhbXBsZTpcbiAgICogYGBgXG4gICAqIDxteS1jb21wIG5nU2tpcEh5ZHJhdGlvbj5cbiAgICogICBTaG91bGQgcmVmZXJlbmNlIHRoaXMgcm9vdCBub2RlXG4gICAqIDwvbXktY29tcD5cbiAgICogYGBgXG4gICAqL1xuICBza2lwSHlkcmF0aW9uUm9vdFROb2RlOiBUTm9kZSB8IG51bGw7XG59XG5cbmNvbnN0IGluc3RydWN0aW9uU3RhdGU6IEluc3RydWN0aW9uU3RhdGUgPSB7XG4gIGxGcmFtZTogY3JlYXRlTEZyYW1lKG51bGwpLFxuICBiaW5kaW5nc0VuYWJsZWQ6IHRydWUsXG4gIHNraXBIeWRyYXRpb25Sb290VE5vZGU6IG51bGwsXG59O1xuXG5leHBvcnQgZW51bSBDaGVja05vQ2hhbmdlc01vZGUge1xuICBPZmYsXG4gIEV4aGF1c3RpdmUsXG4gIE9ubHlEaXJ0eVZpZXdzLFxufVxuXG4vKipcbiAqIEluIHRoaXMgbW9kZSwgYW55IGNoYW5nZXMgaW4gYmluZGluZ3Mgd2lsbCB0aHJvdyBhbiBFeHByZXNzaW9uQ2hhbmdlZEFmdGVyQ2hlY2tlZCBlcnJvci5cbiAqXG4gKiBOZWNlc3NhcnkgdG8gc3VwcG9ydCBDaGFuZ2VEZXRlY3RvclJlZi5jaGVja05vQ2hhbmdlcygpLlxuICpcbiAqIFRoZSBgY2hlY2tOb0NoYW5nZXNgIGZ1bmN0aW9uIGlzIGludm9rZWQgb25seSBpbiBuZ0Rldk1vZGU9dHJ1ZSBhbmQgdmVyaWZpZXMgdGhhdCBubyB1bmludGVuZGVkXG4gKiBjaGFuZ2VzIGV4aXN0IGluIHRoZSBjaGFuZ2UgZGV0ZWN0b3Igb3IgaXRzIGNoaWxkcmVuLlxuICovXG5sZXQgX2NoZWNrTm9DaGFuZ2VzTW9kZTogQ2hlY2tOb0NoYW5nZXNNb2RlID0gMDsgLyogQ2hlY2tOb0NoYW5nZXNNb2RlLk9mZiAqL1xuXG4vKipcbiAqIEZsYWcgdXNlZCB0byBpbmRpY2F0ZSB0aGF0IHdlIGFyZSBpbiB0aGUgbWlkZGxlIHJ1bm5pbmcgY2hhbmdlIGRldGVjdGlvbiBvbiBhIHZpZXdcbiAqXG4gKiBAc2VlIGRldGVjdENoYW5nZXNJblZpZXdXaGlsZURpcnR5XG4gKi9cbmxldCBfaXNSZWZyZXNoaW5nVmlld3MgPSBmYWxzZTtcblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGluc3RydWN0aW9uIHN0YXRlIHN0YWNrIGlzIGVtcHR5LlxuICpcbiAqIEludGVuZGVkIHRvIGJlIGNhbGxlZCBmcm9tIHRlc3RzIG9ubHkgKHRyZWUgc2hha2VuIG90aGVyd2lzZSkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzcGVjT25seUlzSW5zdHJ1Y3Rpb25TdGF0ZUVtcHR5KCk6IGJvb2xlYW4ge1xuICByZXR1cm4gaW5zdHJ1Y3Rpb25TdGF0ZS5sRnJhbWUucGFyZW50ID09PSBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RWxlbWVudERlcHRoQ291bnQoKSB7XG4gIHJldHVybiBpbnN0cnVjdGlvblN0YXRlLmxGcmFtZS5lbGVtZW50RGVwdGhDb3VudDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluY3JlYXNlRWxlbWVudERlcHRoQ291bnQoKSB7XG4gIGluc3RydWN0aW9uU3RhdGUubEZyYW1lLmVsZW1lbnREZXB0aENvdW50Kys7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWNyZWFzZUVsZW1lbnREZXB0aENvdW50KCkge1xuICBpbnN0cnVjdGlvblN0YXRlLmxGcmFtZS5lbGVtZW50RGVwdGhDb3VudC0tO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QmluZGluZ3NFbmFibGVkKCk6IGJvb2xlYW4ge1xuICByZXR1cm4gaW5zdHJ1Y3Rpb25TdGF0ZS5iaW5kaW5nc0VuYWJsZWQ7XG59XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIGN1cnJlbnRseSBpbnNpZGUgYSBza2lwIGh5ZHJhdGlvbiBibG9jay5cbiAqIEByZXR1cm5zIGJvb2xlYW5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzSW5Ta2lwSHlkcmF0aW9uQmxvY2soKTogYm9vbGVhbiB7XG4gIHJldHVybiBpbnN0cnVjdGlvblN0YXRlLnNraXBIeWRyYXRpb25Sb290VE5vZGUgIT09IG51bGw7XG59XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoaXMgaXMgdGhlIHJvb3QgVE5vZGUgb2YgdGhlIHNraXAgaHlkcmF0aW9uIGJsb2NrLlxuICogQHBhcmFtIHROb2RlIHRoZSBjdXJyZW50IFROb2RlXG4gKiBAcmV0dXJucyBib29sZWFuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1NraXBIeWRyYXRpb25Sb290VE5vZGUodE5vZGU6IFROb2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiBpbnN0cnVjdGlvblN0YXRlLnNraXBIeWRyYXRpb25Sb290VE5vZGUgPT09IHROb2RlO1xufVxuXG4vKipcbiAqIEVuYWJsZXMgZGlyZWN0aXZlIG1hdGNoaW5nIG9uIGVsZW1lbnRzLlxuICpcbiAqICAqIEV4YW1wbGU6XG4gKiBgYGBcbiAqIDxteS1jb21wIG15LWRpcmVjdGl2ZT5cbiAqICAgU2hvdWxkIG1hdGNoIGNvbXBvbmVudCAvIGRpcmVjdGl2ZS5cbiAqIDwvbXktY29tcD5cbiAqIDxkaXYgbmdOb25CaW5kYWJsZT5cbiAqICAgPCEtLSDJtcm1ZGlzYWJsZUJpbmRpbmdzKCkgLS0+XG4gKiAgIDxteS1jb21wIG15LWRpcmVjdGl2ZT5cbiAqICAgICBTaG91bGQgbm90IG1hdGNoIGNvbXBvbmVudCAvIGRpcmVjdGl2ZSBiZWNhdXNlIHdlIGFyZSBpbiBuZ05vbkJpbmRhYmxlLlxuICogICA8L215LWNvbXA+XG4gKiAgIDwhLS0gybXJtWVuYWJsZUJpbmRpbmdzKCkgLS0+XG4gKiA8L2Rpdj5cbiAqIGBgYFxuICpcbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1ZW5hYmxlQmluZGluZ3MoKTogdm9pZCB7XG4gIGluc3RydWN0aW9uU3RhdGUuYmluZGluZ3NFbmFibGVkID0gdHJ1ZTtcbn1cblxuLyoqXG4gKiBTZXRzIGEgZmxhZyB0byBzcGVjaWZ5IHRoYXQgdGhlIFROb2RlIGlzIGluIGEgc2tpcCBoeWRyYXRpb24gYmxvY2suXG4gKiBAcGFyYW0gdE5vZGUgdGhlIGN1cnJlbnQgVE5vZGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVudGVyU2tpcEh5ZHJhdGlvbkJsb2NrKHROb2RlOiBUTm9kZSk6IHZvaWQge1xuICBpbnN0cnVjdGlvblN0YXRlLnNraXBIeWRyYXRpb25Sb290VE5vZGUgPSB0Tm9kZTtcbn1cblxuLyoqXG4gKiBEaXNhYmxlcyBkaXJlY3RpdmUgbWF0Y2hpbmcgb24gZWxlbWVudC5cbiAqXG4gKiAgKiBFeGFtcGxlOlxuICogYGBgXG4gKiA8bXktY29tcCBteS1kaXJlY3RpdmU+XG4gKiAgIFNob3VsZCBtYXRjaCBjb21wb25lbnQgLyBkaXJlY3RpdmUuXG4gKiA8L215LWNvbXA+XG4gKiA8ZGl2IG5nTm9uQmluZGFibGU+XG4gKiAgIDwhLS0gybXJtWRpc2FibGVCaW5kaW5ncygpIC0tPlxuICogICA8bXktY29tcCBteS1kaXJlY3RpdmU+XG4gKiAgICAgU2hvdWxkIG5vdCBtYXRjaCBjb21wb25lbnQgLyBkaXJlY3RpdmUgYmVjYXVzZSB3ZSBhcmUgaW4gbmdOb25CaW5kYWJsZS5cbiAqICAgPC9teS1jb21wPlxuICogICA8IS0tIMm1ybVlbmFibGVCaW5kaW5ncygpIC0tPlxuICogPC9kaXY+XG4gKiBgYGBcbiAqXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtWRpc2FibGVCaW5kaW5ncygpOiB2b2lkIHtcbiAgaW5zdHJ1Y3Rpb25TdGF0ZS5iaW5kaW5nc0VuYWJsZWQgPSBmYWxzZTtcbn1cblxuLyoqXG4gKiBDbGVhcnMgdGhlIHJvb3Qgc2tpcCBoeWRyYXRpb24gbm9kZSB3aGVuIGxlYXZpbmcgYSBza2lwIGh5ZHJhdGlvbiBibG9jay5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxlYXZlU2tpcEh5ZHJhdGlvbkJsb2NrKCk6IHZvaWQge1xuICBpbnN0cnVjdGlvblN0YXRlLnNraXBIeWRyYXRpb25Sb290VE5vZGUgPSBudWxsO1xufVxuXG4vKipcbiAqIFJldHVybiB0aGUgY3VycmVudCBgTFZpZXdgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TFZpZXc8VD4oKTogTFZpZXc8VD4ge1xuICByZXR1cm4gaW5zdHJ1Y3Rpb25TdGF0ZS5sRnJhbWUubFZpZXcgYXMgTFZpZXc8VD47XG59XG5cbi8qKlxuICogUmV0dXJuIHRoZSBjdXJyZW50IGBUVmlld2AuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRUVmlldygpOiBUVmlldyB7XG4gIHJldHVybiBpbnN0cnVjdGlvblN0YXRlLmxGcmFtZS50Vmlldztcbn1cblxuLyoqXG4gKiBSZXN0b3JlcyBgY29udGV4dFZpZXdEYXRhYCB0byB0aGUgZ2l2ZW4gT3BhcXVlVmlld1N0YXRlIGluc3RhbmNlLlxuICpcbiAqIFVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCB0aGUgZ2V0Q3VycmVudFZpZXcoKSBpbnN0cnVjdGlvbiB0byBzYXZlIGEgc25hcHNob3RcbiAqIG9mIHRoZSBjdXJyZW50IHZpZXcgYW5kIHJlc3RvcmUgaXQgd2hlbiBsaXN0ZW5lcnMgYXJlIGludm9rZWQuIFRoaXMgYWxsb3dzXG4gKiB3YWxraW5nIHRoZSBkZWNsYXJhdGlvbiB2aWV3IHRyZWUgaW4gbGlzdGVuZXJzIHRvIGdldCB2YXJzIGZyb20gcGFyZW50IHZpZXdzLlxuICpcbiAqIEBwYXJhbSB2aWV3VG9SZXN0b3JlIFRoZSBPcGFxdWVWaWV3U3RhdGUgaW5zdGFuY2UgdG8gcmVzdG9yZS5cbiAqIEByZXR1cm5zIENvbnRleHQgb2YgdGhlIHJlc3RvcmVkIE9wYXF1ZVZpZXdTdGF0ZSBpbnN0YW5jZS5cbiAqXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtXJlc3RvcmVWaWV3PFQgPSBhbnk+KHZpZXdUb1Jlc3RvcmU6IE9wYXF1ZVZpZXdTdGF0ZSk6IFQge1xuICBpbnN0cnVjdGlvblN0YXRlLmxGcmFtZS5jb250ZXh0TFZpZXcgPSB2aWV3VG9SZXN0b3JlIGFzIGFueSBhcyBMVmlldztcbiAgcmV0dXJuICh2aWV3VG9SZXN0b3JlIGFzIGFueSBhcyBMVmlldylbQ09OVEVYVF0gYXMgdW5rbm93biBhcyBUO1xufVxuXG4vKipcbiAqIENsZWFycyB0aGUgdmlldyBzZXQgaW4gYMm1ybVyZXN0b3JlVmlld2AgZnJvbSBtZW1vcnkuIFJldHVybnMgdGhlIHBhc3NlZCBpblxuICogdmFsdWUgc28gdGhhdCBpdCBjYW4gYmUgdXNlZCBhcyBhIHJldHVybiB2YWx1ZSBvZiBhbiBpbnN0cnVjdGlvbi5cbiAqXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtXJlc2V0VmlldzxUPih2YWx1ZT86IFQpOiBUIHwgdW5kZWZpbmVkIHtcbiAgaW5zdHJ1Y3Rpb25TdGF0ZS5sRnJhbWUuY29udGV4dExWaWV3ID0gbnVsbDtcbiAgcmV0dXJuIHZhbHVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q3VycmVudFROb2RlKCk6IFROb2RlIHwgbnVsbCB7XG4gIGxldCBjdXJyZW50VE5vZGUgPSBnZXRDdXJyZW50VE5vZGVQbGFjZWhvbGRlck9rKCk7XG4gIHdoaWxlIChjdXJyZW50VE5vZGUgIT09IG51bGwgJiYgY3VycmVudFROb2RlLnR5cGUgPT09IFROb2RlVHlwZS5QbGFjZWhvbGRlcikge1xuICAgIGN1cnJlbnRUTm9kZSA9IGN1cnJlbnRUTm9kZS5wYXJlbnQ7XG4gIH1cbiAgcmV0dXJuIGN1cnJlbnRUTm9kZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEN1cnJlbnRUTm9kZVBsYWNlaG9sZGVyT2soKTogVE5vZGUgfCBudWxsIHtcbiAgcmV0dXJuIGluc3RydWN0aW9uU3RhdGUubEZyYW1lLmN1cnJlbnRUTm9kZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEN1cnJlbnRQYXJlbnRUTm9kZSgpOiBUTm9kZSB8IG51bGwge1xuICBjb25zdCBsRnJhbWUgPSBpbnN0cnVjdGlvblN0YXRlLmxGcmFtZTtcbiAgY29uc3QgY3VycmVudFROb2RlID0gbEZyYW1lLmN1cnJlbnRUTm9kZTtcbiAgcmV0dXJuIGxGcmFtZS5pc1BhcmVudCA/IGN1cnJlbnRUTm9kZSA6IGN1cnJlbnRUTm9kZSEucGFyZW50O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0Q3VycmVudFROb2RlKHROb2RlOiBUTm9kZSB8IG51bGwsIGlzUGFyZW50OiBib29sZWFuKSB7XG4gIG5nRGV2TW9kZSAmJiB0Tm9kZSAmJiBhc3NlcnRUTm9kZUZvclRWaWV3KHROb2RlLCBpbnN0cnVjdGlvblN0YXRlLmxGcmFtZS50Vmlldyk7XG4gIGNvbnN0IGxGcmFtZSA9IGluc3RydWN0aW9uU3RhdGUubEZyYW1lO1xuICBsRnJhbWUuY3VycmVudFROb2RlID0gdE5vZGU7XG4gIGxGcmFtZS5pc1BhcmVudCA9IGlzUGFyZW50O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNDdXJyZW50VE5vZGVQYXJlbnQoKTogYm9vbGVhbiB7XG4gIHJldHVybiBpbnN0cnVjdGlvblN0YXRlLmxGcmFtZS5pc1BhcmVudDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldEN1cnJlbnRUTm9kZUFzTm90UGFyZW50KCk6IHZvaWQge1xuICBpbnN0cnVjdGlvblN0YXRlLmxGcmFtZS5pc1BhcmVudCA9IGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q29udGV4dExWaWV3KCk6IExWaWV3IHtcbiAgY29uc3QgY29udGV4dExWaWV3ID0gaW5zdHJ1Y3Rpb25TdGF0ZS5sRnJhbWUuY29udGV4dExWaWV3O1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0RGVmaW5lZChjb250ZXh0TFZpZXcsICdjb250ZXh0TFZpZXcgbXVzdCBiZSBkZWZpbmVkLicpO1xuICByZXR1cm4gY29udGV4dExWaWV3ITtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzSW5DaGVja05vQ2hhbmdlc01vZGUoKTogYm9vbGVhbiB7XG4gICFuZ0Rldk1vZGUgJiYgdGhyb3dFcnJvcignTXVzdCBuZXZlciBiZSBjYWxsZWQgaW4gcHJvZHVjdGlvbiBtb2RlJyk7XG4gIHJldHVybiBfY2hlY2tOb0NoYW5nZXNNb2RlICE9PSBDaGVja05vQ2hhbmdlc01vZGUuT2ZmO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNFeGhhdXN0aXZlQ2hlY2tOb0NoYW5nZXMoKTogYm9vbGVhbiB7XG4gICFuZ0Rldk1vZGUgJiYgdGhyb3dFcnJvcignTXVzdCBuZXZlciBiZSBjYWxsZWQgaW4gcHJvZHVjdGlvbiBtb2RlJyk7XG4gIHJldHVybiBfY2hlY2tOb0NoYW5nZXNNb2RlID09PSBDaGVja05vQ2hhbmdlc01vZGUuRXhoYXVzdGl2ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldElzSW5DaGVja05vQ2hhbmdlc01vZGUobW9kZTogQ2hlY2tOb0NoYW5nZXNNb2RlKTogdm9pZCB7XG4gICFuZ0Rldk1vZGUgJiYgdGhyb3dFcnJvcignTXVzdCBuZXZlciBiZSBjYWxsZWQgaW4gcHJvZHVjdGlvbiBtb2RlJyk7XG4gIF9jaGVja05vQ2hhbmdlc01vZGUgPSBtb2RlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNSZWZyZXNoaW5nVmlld3MoKTogYm9vbGVhbiB7XG4gIHJldHVybiBfaXNSZWZyZXNoaW5nVmlld3M7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRJc1JlZnJlc2hpbmdWaWV3cyhtb2RlOiBib29sZWFuKTogdm9pZCB7XG4gIF9pc1JlZnJlc2hpbmdWaWV3cyA9IG1vZGU7XG59XG5cbi8vIHRvcCBsZXZlbCB2YXJpYWJsZXMgc2hvdWxkIG5vdCBiZSBleHBvcnRlZCBmb3IgcGVyZm9ybWFuY2UgcmVhc29ucyAoUEVSRl9OT1RFUy5tZClcbmV4cG9ydCBmdW5jdGlvbiBnZXRCaW5kaW5nUm9vdCgpIHtcbiAgY29uc3QgbEZyYW1lID0gaW5zdHJ1Y3Rpb25TdGF0ZS5sRnJhbWU7XG4gIGxldCBpbmRleCA9IGxGcmFtZS5iaW5kaW5nUm9vdEluZGV4O1xuICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgaW5kZXggPSBsRnJhbWUuYmluZGluZ1Jvb3RJbmRleCA9IGxGcmFtZS50Vmlldy5iaW5kaW5nU3RhcnRJbmRleDtcbiAgfVxuICByZXR1cm4gaW5kZXg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRCaW5kaW5nSW5kZXgoKTogbnVtYmVyIHtcbiAgcmV0dXJuIGluc3RydWN0aW9uU3RhdGUubEZyYW1lLmJpbmRpbmdJbmRleDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldEJpbmRpbmdJbmRleCh2YWx1ZTogbnVtYmVyKTogbnVtYmVyIHtcbiAgcmV0dXJuIChpbnN0cnVjdGlvblN0YXRlLmxGcmFtZS5iaW5kaW5nSW5kZXggPSB2YWx1ZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuZXh0QmluZGluZ0luZGV4KCk6IG51bWJlciB7XG4gIHJldHVybiBpbnN0cnVjdGlvblN0YXRlLmxGcmFtZS5iaW5kaW5nSW5kZXgrKztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluY3JlbWVudEJpbmRpbmdJbmRleChjb3VudDogbnVtYmVyKTogbnVtYmVyIHtcbiAgY29uc3QgbEZyYW1lID0gaW5zdHJ1Y3Rpb25TdGF0ZS5sRnJhbWU7XG4gIGNvbnN0IGluZGV4ID0gbEZyYW1lLmJpbmRpbmdJbmRleDtcbiAgbEZyYW1lLmJpbmRpbmdJbmRleCA9IGxGcmFtZS5iaW5kaW5nSW5kZXggKyBjb3VudDtcbiAgcmV0dXJuIGluZGV4O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNJbkkxOG5CbG9jaygpIHtcbiAgcmV0dXJuIGluc3RydWN0aW9uU3RhdGUubEZyYW1lLmluSTE4bjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldEluSTE4bkJsb2NrKGlzSW5JMThuQmxvY2s6IGJvb2xlYW4pOiB2b2lkIHtcbiAgaW5zdHJ1Y3Rpb25TdGF0ZS5sRnJhbWUuaW5JMThuID0gaXNJbkkxOG5CbG9jaztcbn1cblxuLyoqXG4gKiBTZXQgYSBuZXcgYmluZGluZyByb290IGluZGV4IHNvIHRoYXQgaG9zdCB0ZW1wbGF0ZSBmdW5jdGlvbnMgY2FuIGV4ZWN1dGUuXG4gKlxuICogQmluZGluZ3MgaW5zaWRlIHRoZSBob3N0IHRlbXBsYXRlIGFyZSAwIGluZGV4LiBCdXQgYmVjYXVzZSB3ZSBkb24ndCBrbm93IGFoZWFkIG9mIHRpbWVcbiAqIGhvdyBtYW55IGhvc3QgYmluZGluZ3Mgd2UgaGF2ZSB3ZSBjYW4ndCBwcmUtY29tcHV0ZSB0aGVtLiBGb3IgdGhpcyByZWFzb24gdGhleSBhcmUgYWxsXG4gKiAwIGluZGV4IGFuZCB3ZSBqdXN0IHNoaWZ0IHRoZSByb290IHNvIHRoYXQgdGhleSBtYXRjaCBuZXh0IGF2YWlsYWJsZSBsb2NhdGlvbiBpbiB0aGUgTFZpZXcuXG4gKlxuICogQHBhcmFtIGJpbmRpbmdSb290SW5kZXggUm9vdCBpbmRleCBmb3IgYGhvc3RCaW5kaW5nc2BcbiAqIEBwYXJhbSBjdXJyZW50RGlyZWN0aXZlSW5kZXggYFREYXRhW2N1cnJlbnREaXJlY3RpdmVJbmRleF1gIHdpbGwgcG9pbnQgdG8gdGhlIGN1cnJlbnQgZGlyZWN0aXZlXG4gKiAgICAgICAgd2hvc2UgYGhvc3RCaW5kaW5nc2AgYXJlIGJlaW5nIHByb2Nlc3NlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldEJpbmRpbmdSb290Rm9ySG9zdEJpbmRpbmdzKFxuICBiaW5kaW5nUm9vdEluZGV4OiBudW1iZXIsXG4gIGN1cnJlbnREaXJlY3RpdmVJbmRleDogbnVtYmVyLFxuKSB7XG4gIGNvbnN0IGxGcmFtZSA9IGluc3RydWN0aW9uU3RhdGUubEZyYW1lO1xuICBsRnJhbWUuYmluZGluZ0luZGV4ID0gbEZyYW1lLmJpbmRpbmdSb290SW5kZXggPSBiaW5kaW5nUm9vdEluZGV4O1xuICBzZXRDdXJyZW50RGlyZWN0aXZlSW5kZXgoY3VycmVudERpcmVjdGl2ZUluZGV4KTtcbn1cblxuLyoqXG4gKiBXaGVuIGhvc3QgYmluZGluZyBpcyBleGVjdXRpbmcgdGhpcyBwb2ludHMgdG8gdGhlIGRpcmVjdGl2ZSBpbmRleC5cbiAqIGBUVmlldy5kYXRhW2dldEN1cnJlbnREaXJlY3RpdmVJbmRleCgpXWAgaXMgYERpcmVjdGl2ZURlZmBcbiAqIGBMVmlld1tnZXRDdXJyZW50RGlyZWN0aXZlSW5kZXgoKV1gIGlzIGRpcmVjdGl2ZSBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEN1cnJlbnREaXJlY3RpdmVJbmRleCgpOiBudW1iZXIge1xuICByZXR1cm4gaW5zdHJ1Y3Rpb25TdGF0ZS5sRnJhbWUuY3VycmVudERpcmVjdGl2ZUluZGV4O1xufVxuXG4vKipcbiAqIFNldHMgYW4gaW5kZXggb2YgYSBkaXJlY3RpdmUgd2hvc2UgYGhvc3RCaW5kaW5nc2AgYXJlIGJlaW5nIHByb2Nlc3NlZC5cbiAqXG4gKiBAcGFyYW0gY3VycmVudERpcmVjdGl2ZUluZGV4IGBURGF0YWAgaW5kZXggd2hlcmUgY3VycmVudCBkaXJlY3RpdmUgaW5zdGFuY2UgY2FuIGJlIGZvdW5kLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0Q3VycmVudERpcmVjdGl2ZUluZGV4KGN1cnJlbnREaXJlY3RpdmVJbmRleDogbnVtYmVyKTogdm9pZCB7XG4gIGluc3RydWN0aW9uU3RhdGUubEZyYW1lLmN1cnJlbnREaXJlY3RpdmVJbmRleCA9IGN1cnJlbnREaXJlY3RpdmVJbmRleDtcbn1cblxuLyoqXG4gKiBSZXRyaWV2ZSB0aGUgY3VycmVudCBgRGlyZWN0aXZlRGVmYCB3aGljaCBpcyBhY3RpdmUgd2hlbiBgaG9zdEJpbmRpbmdzYCBpbnN0cnVjdGlvbiBpcyBiZWluZ1xuICogZXhlY3V0ZWQuXG4gKlxuICogQHBhcmFtIHREYXRhIEN1cnJlbnQgYFREYXRhYCB3aGVyZSB0aGUgYERpcmVjdGl2ZURlZmAgd2lsbCBiZSBsb29rZWQgdXAgYXQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRDdXJyZW50RGlyZWN0aXZlRGVmKHREYXRhOiBURGF0YSk6IERpcmVjdGl2ZURlZjxhbnk+IHwgbnVsbCB7XG4gIGNvbnN0IGN1cnJlbnREaXJlY3RpdmVJbmRleCA9IGluc3RydWN0aW9uU3RhdGUubEZyYW1lLmN1cnJlbnREaXJlY3RpdmVJbmRleDtcbiAgcmV0dXJuIGN1cnJlbnREaXJlY3RpdmVJbmRleCA9PT0gLTEgPyBudWxsIDogKHREYXRhW2N1cnJlbnREaXJlY3RpdmVJbmRleF0gYXMgRGlyZWN0aXZlRGVmPGFueT4pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q3VycmVudFF1ZXJ5SW5kZXgoKTogbnVtYmVyIHtcbiAgcmV0dXJuIGluc3RydWN0aW9uU3RhdGUubEZyYW1lLmN1cnJlbnRRdWVyeUluZGV4O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0Q3VycmVudFF1ZXJ5SW5kZXgodmFsdWU6IG51bWJlcik6IHZvaWQge1xuICBpbnN0cnVjdGlvblN0YXRlLmxGcmFtZS5jdXJyZW50UXVlcnlJbmRleCA9IHZhbHVlO1xufVxuXG4vKipcbiAqIFJldHVybnMgYSBgVE5vZGVgIG9mIHRoZSBsb2NhdGlvbiB3aGVyZSB0aGUgY3VycmVudCBgTFZpZXdgIGlzIGRlY2xhcmVkIGF0LlxuICpcbiAqIEBwYXJhbSBsVmlldyBhbiBgTFZpZXdgIHRoYXQgd2Ugd2FudCB0byBmaW5kIHBhcmVudCBgVE5vZGVgIGZvci5cbiAqL1xuZnVuY3Rpb24gZ2V0RGVjbGFyYXRpb25UTm9kZShsVmlldzogTFZpZXcpOiBUTm9kZSB8IG51bGwge1xuICBjb25zdCB0VmlldyA9IGxWaWV3W1RWSUVXXTtcblxuICAvLyBSZXR1cm4gdGhlIGRlY2xhcmF0aW9uIHBhcmVudCBmb3IgZW1iZWRkZWQgdmlld3NcbiAgaWYgKHRWaWV3LnR5cGUgPT09IFRWaWV3VHlwZS5FbWJlZGRlZCkge1xuICAgIG5nRGV2TW9kZSAmJiBhc3NlcnREZWZpbmVkKHRWaWV3LmRlY2xUTm9kZSwgJ0VtYmVkZGVkIFROb2RlcyBzaG91bGQgaGF2ZSBkZWNsYXJhdGlvbiBwYXJlbnRzLicpO1xuICAgIHJldHVybiB0Vmlldy5kZWNsVE5vZGU7XG4gIH1cblxuICAvLyBDb21wb25lbnRzIGRvbid0IGhhdmUgYFRWaWV3LmRlY2xUTm9kZWAgYmVjYXVzZSBlYWNoIGluc3RhbmNlIG9mIGNvbXBvbmVudCBjb3VsZCBiZVxuICAvLyBpbnNlcnRlZCBpbiBkaWZmZXJlbnQgbG9jYXRpb24sIGhlbmNlIGBUVmlldy5kZWNsVE5vZGVgIGlzIG1lYW5pbmdsZXNzLlxuICAvLyBGYWxsaW5nIGJhY2sgdG8gYFRfSE9TVGAgaW4gY2FzZSB3ZSBjcm9zcyBjb21wb25lbnQgYm91bmRhcnkuXG4gIGlmICh0Vmlldy50eXBlID09PSBUVmlld1R5cGUuQ29tcG9uZW50KSB7XG4gICAgcmV0dXJuIGxWaWV3W1RfSE9TVF07XG4gIH1cblxuICAvLyBSZW1haW5pbmcgVE5vZGUgdHlwZSBpcyBgVFZpZXdUeXBlLlJvb3RgIHdoaWNoIGRvZXNuJ3QgaGF2ZSBhIHBhcmVudCBUTm9kZS5cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogVGhpcyBpcyBhIGxpZ2h0IHdlaWdodCB2ZXJzaW9uIG9mIHRoZSBgZW50ZXJWaWV3YCB3aGljaCBpcyBuZWVkZWQgYnkgdGhlIERJIHN5c3RlbS5cbiAqXG4gKiBAcGFyYW0gbFZpZXcgYExWaWV3YCBsb2NhdGlvbiBvZiB0aGUgREkgY29udGV4dC5cbiAqIEBwYXJhbSB0Tm9kZSBgVE5vZGVgIGZvciBESSBjb250ZXh0XG4gKiBAcGFyYW0gZmxhZ3MgREkgY29udGV4dCBmbGFncy4gaWYgYFNraXBTZWxmYCBmbGFnIGlzIHNldCB0aGFuIHdlIHdhbGsgdXAgdGhlIGRlY2xhcmF0aW9uXG4gKiAgICAgdHJlZSBmcm9tIGB0Tm9kZWAgIHVudGlsIHdlIGZpbmQgcGFyZW50IGRlY2xhcmVkIGBURWxlbWVudE5vZGVgLlxuICogQHJldHVybnMgYHRydWVgIGlmIHdlIGhhdmUgc3VjY2Vzc2Z1bGx5IGVudGVyZWQgREkgYXNzb2NpYXRlZCB3aXRoIGB0Tm9kZWAgKG9yIHdpdGggZGVjbGFyZWRcbiAqICAgICBgVE5vZGVgIGlmIGBmbGFnc2AgaGFzICBgU2tpcFNlbGZgKS4gRmFpbGluZyB0byBlbnRlciBESSBpbXBsaWVzIHRoYXQgbm8gYXNzb2NpYXRlZFxuICogICAgIGBOb2RlSW5qZWN0b3JgIGNhbiBiZSBmb3VuZCBhbmQgd2Ugc2hvdWxkIGluc3RlYWQgdXNlIGBNb2R1bGVJbmplY3RvcmAuXG4gKiAgICAgLSBJZiBgdHJ1ZWAgdGhhbiB0aGlzIGNhbGwgbXVzdCBiZSBmYWxsb3dlZCBieSBgbGVhdmVESWBcbiAqICAgICAtIElmIGBmYWxzZWAgdGhhbiB0aGlzIGNhbGwgZmFpbGVkIGFuZCB3ZSBzaG91bGQgTk9UIGNhbGwgYGxlYXZlRElgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbnRlckRJKGxWaWV3OiBMVmlldywgdE5vZGU6IFROb2RlLCBmbGFnczogSW5qZWN0RmxhZ3MpIHtcbiAgbmdEZXZNb2RlICYmIGFzc2VydExWaWV3T3JVbmRlZmluZWQobFZpZXcpO1xuXG4gIGlmIChmbGFncyAmIEluamVjdEZsYWdzLlNraXBTZWxmKSB7XG4gICAgbmdEZXZNb2RlICYmIGFzc2VydFROb2RlRm9yVFZpZXcodE5vZGUsIGxWaWV3W1RWSUVXXSk7XG5cbiAgICBsZXQgcGFyZW50VE5vZGUgPSB0Tm9kZSBhcyBUTm9kZSB8IG51bGw7XG4gICAgbGV0IHBhcmVudExWaWV3ID0gbFZpZXc7XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgbmdEZXZNb2RlICYmIGFzc2VydERlZmluZWQocGFyZW50VE5vZGUsICdQYXJlbnQgVE5vZGUgc2hvdWxkIGJlIGRlZmluZWQnKTtcbiAgICAgIHBhcmVudFROb2RlID0gcGFyZW50VE5vZGUhLnBhcmVudCBhcyBUTm9kZSB8IG51bGw7XG4gICAgICBpZiAocGFyZW50VE5vZGUgPT09IG51bGwgJiYgIShmbGFncyAmIEluamVjdEZsYWdzLkhvc3QpKSB7XG4gICAgICAgIHBhcmVudFROb2RlID0gZ2V0RGVjbGFyYXRpb25UTm9kZShwYXJlbnRMVmlldyk7XG4gICAgICAgIGlmIChwYXJlbnRUTm9kZSA9PT0gbnVsbCkgYnJlYWs7XG5cbiAgICAgICAgLy8gSW4gdGhpcyBjYXNlLCBhIHBhcmVudCBleGlzdHMgYW5kIGlzIGRlZmluaXRlbHkgYW4gZWxlbWVudC4gU28gaXQgd2lsbCBkZWZpbml0ZWx5XG4gICAgICAgIC8vIGhhdmUgYW4gZXhpc3RpbmcgbFZpZXcgYXMgdGhlIGRlY2xhcmF0aW9uIHZpZXcsIHdoaWNoIGlzIHdoeSB3ZSBjYW4gYXNzdW1lIGl0J3MgZGVmaW5lZC5cbiAgICAgICAgbmdEZXZNb2RlICYmIGFzc2VydERlZmluZWQocGFyZW50TFZpZXcsICdQYXJlbnQgTFZpZXcgc2hvdWxkIGJlIGRlZmluZWQnKTtcbiAgICAgICAgcGFyZW50TFZpZXcgPSBwYXJlbnRMVmlld1tERUNMQVJBVElPTl9WSUVXXSE7XG5cbiAgICAgICAgLy8gSW4gSXZ5IHRoZXJlIGFyZSBDb21tZW50IG5vZGVzIHRoYXQgY29ycmVzcG9uZCB0byBuZ0lmIGFuZCBOZ0ZvciBlbWJlZGRlZCBkaXJlY3RpdmVzXG4gICAgICAgIC8vIFdlIHdhbnQgdG8gc2tpcCB0aG9zZSBhbmQgbG9vayBvbmx5IGF0IEVsZW1lbnRzIGFuZCBFbGVtZW50Q29udGFpbmVycyB0byBlbnN1cmVcbiAgICAgICAgLy8gd2UncmUgbG9va2luZyBhdCB0cnVlIHBhcmVudCBub2RlcywgYW5kIG5vdCBjb250ZW50IG9yIG90aGVyIHR5cGVzLlxuICAgICAgICBpZiAocGFyZW50VE5vZGUudHlwZSAmIChUTm9kZVR5cGUuRWxlbWVudCB8IFROb2RlVHlwZS5FbGVtZW50Q29udGFpbmVyKSkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHBhcmVudFROb2RlID09PSBudWxsKSB7XG4gICAgICAvLyBJZiB3ZSBmYWlsZWQgdG8gZmluZCBhIHBhcmVudCBUTm9kZSB0aGlzIG1lYW5zIHRoYXQgd2Ugc2hvdWxkIHVzZSBtb2R1bGUgaW5qZWN0b3IuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHROb2RlID0gcGFyZW50VE5vZGU7XG4gICAgICBsVmlldyA9IHBhcmVudExWaWV3O1xuICAgIH1cbiAgfVxuXG4gIG5nRGV2TW9kZSAmJiBhc3NlcnRUTm9kZUZvckxWaWV3KHROb2RlLCBsVmlldyk7XG4gIGNvbnN0IGxGcmFtZSA9IChpbnN0cnVjdGlvblN0YXRlLmxGcmFtZSA9IGFsbG9jTEZyYW1lKCkpO1xuICBsRnJhbWUuY3VycmVudFROb2RlID0gdE5vZGU7XG4gIGxGcmFtZS5sVmlldyA9IGxWaWV3O1xuXG4gIHJldHVybiB0cnVlO1xufVxuXG4vKipcbiAqIFN3YXAgdGhlIGN1cnJlbnQgbFZpZXcgd2l0aCBhIG5ldyBsVmlldy5cbiAqXG4gKiBGb3IgcGVyZm9ybWFuY2UgcmVhc29ucyB3ZSBzdG9yZSB0aGUgbFZpZXcgaW4gdGhlIHRvcCBsZXZlbCBvZiB0aGUgbW9kdWxlLlxuICogVGhpcyB3YXkgd2UgbWluaW1pemUgdGhlIG51bWJlciBvZiBwcm9wZXJ0aWVzIHRvIHJlYWQuIFdoZW5ldmVyIGEgbmV3IHZpZXdcbiAqIGlzIGVudGVyZWQgd2UgaGF2ZSB0byBzdG9yZSB0aGUgbFZpZXcgZm9yIGxhdGVyLCBhbmQgd2hlbiB0aGUgdmlldyBpc1xuICogZXhpdGVkIHRoZSBzdGF0ZSBoYXMgdG8gYmUgcmVzdG9yZWRcbiAqXG4gKiBAcGFyYW0gbmV3VmlldyBOZXcgbFZpZXcgdG8gYmVjb21lIGFjdGl2ZVxuICogQHJldHVybnMgdGhlIHByZXZpb3VzbHkgYWN0aXZlIGxWaWV3O1xuICovXG5leHBvcnQgZnVuY3Rpb24gZW50ZXJWaWV3KG5ld1ZpZXc6IExWaWV3KTogdm9pZCB7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnROb3RFcXVhbChuZXdWaWV3WzBdLCBuZXdWaWV3WzFdIGFzIGFueSwgJz8/Pz8nKTtcbiAgbmdEZXZNb2RlICYmIGFzc2VydExWaWV3T3JVbmRlZmluZWQobmV3Vmlldyk7XG4gIGNvbnN0IG5ld0xGcmFtZSA9IGFsbG9jTEZyYW1lKCk7XG4gIGlmIChuZ0Rldk1vZGUpIHtcbiAgICBhc3NlcnRFcXVhbChuZXdMRnJhbWUuaXNQYXJlbnQsIHRydWUsICdFeHBlY3RlZCBjbGVhbiBMRnJhbWUnKTtcbiAgICBhc3NlcnRFcXVhbChuZXdMRnJhbWUubFZpZXcsIG51bGwsICdFeHBlY3RlZCBjbGVhbiBMRnJhbWUnKTtcbiAgICBhc3NlcnRFcXVhbChuZXdMRnJhbWUudFZpZXcsIG51bGwsICdFeHBlY3RlZCBjbGVhbiBMRnJhbWUnKTtcbiAgICBhc3NlcnRFcXVhbChuZXdMRnJhbWUuc2VsZWN0ZWRJbmRleCwgLTEsICdFeHBlY3RlZCBjbGVhbiBMRnJhbWUnKTtcbiAgICBhc3NlcnRFcXVhbChuZXdMRnJhbWUuZWxlbWVudERlcHRoQ291bnQsIDAsICdFeHBlY3RlZCBjbGVhbiBMRnJhbWUnKTtcbiAgICBhc3NlcnRFcXVhbChuZXdMRnJhbWUuY3VycmVudERpcmVjdGl2ZUluZGV4LCAtMSwgJ0V4cGVjdGVkIGNsZWFuIExGcmFtZScpO1xuICAgIGFzc2VydEVxdWFsKG5ld0xGcmFtZS5jdXJyZW50TmFtZXNwYWNlLCBudWxsLCAnRXhwZWN0ZWQgY2xlYW4gTEZyYW1lJyk7XG4gICAgYXNzZXJ0RXF1YWwobmV3TEZyYW1lLmJpbmRpbmdSb290SW5kZXgsIC0xLCAnRXhwZWN0ZWQgY2xlYW4gTEZyYW1lJyk7XG4gICAgYXNzZXJ0RXF1YWwobmV3TEZyYW1lLmN1cnJlbnRRdWVyeUluZGV4LCAwLCAnRXhwZWN0ZWQgY2xlYW4gTEZyYW1lJyk7XG4gIH1cbiAgY29uc3QgdFZpZXcgPSBuZXdWaWV3W1RWSUVXXTtcbiAgaW5zdHJ1Y3Rpb25TdGF0ZS5sRnJhbWUgPSBuZXdMRnJhbWU7XG4gIG5nRGV2TW9kZSAmJiB0Vmlldy5maXJzdENoaWxkICYmIGFzc2VydFROb2RlRm9yVFZpZXcodFZpZXcuZmlyc3RDaGlsZCwgdFZpZXcpO1xuICBuZXdMRnJhbWUuY3VycmVudFROb2RlID0gdFZpZXcuZmlyc3RDaGlsZCE7XG4gIG5ld0xGcmFtZS5sVmlldyA9IG5ld1ZpZXc7XG4gIG5ld0xGcmFtZS50VmlldyA9IHRWaWV3O1xuICBuZXdMRnJhbWUuY29udGV4dExWaWV3ID0gbmV3VmlldztcbiAgbmV3TEZyYW1lLmJpbmRpbmdJbmRleCA9IHRWaWV3LmJpbmRpbmdTdGFydEluZGV4O1xuICBuZXdMRnJhbWUuaW5JMThuID0gZmFsc2U7XG59XG5cbi8qKlxuICogQWxsb2NhdGVzIG5leHQgZnJlZSBMRnJhbWUuIFRoaXMgZnVuY3Rpb24gdHJpZXMgdG8gcmV1c2UgdGhlIGBMRnJhbWVgcyB0byBsb3dlciBtZW1vcnkgcHJlc3N1cmUuXG4gKi9cbmZ1bmN0aW9uIGFsbG9jTEZyYW1lKCkge1xuICBjb25zdCBjdXJyZW50TEZyYW1lID0gaW5zdHJ1Y3Rpb25TdGF0ZS5sRnJhbWU7XG4gIGNvbnN0IGNoaWxkTEZyYW1lID0gY3VycmVudExGcmFtZSA9PT0gbnVsbCA/IG51bGwgOiBjdXJyZW50TEZyYW1lLmNoaWxkO1xuICBjb25zdCBuZXdMRnJhbWUgPSBjaGlsZExGcmFtZSA9PT0gbnVsbCA/IGNyZWF0ZUxGcmFtZShjdXJyZW50TEZyYW1lKSA6IGNoaWxkTEZyYW1lO1xuICByZXR1cm4gbmV3TEZyYW1lO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVMRnJhbWUocGFyZW50OiBMRnJhbWUgfCBudWxsKTogTEZyYW1lIHtcbiAgY29uc3QgbEZyYW1lOiBMRnJhbWUgPSB7XG4gICAgY3VycmVudFROb2RlOiBudWxsLFxuICAgIGlzUGFyZW50OiB0cnVlLFxuICAgIGxWaWV3OiBudWxsISxcbiAgICB0VmlldzogbnVsbCEsXG4gICAgc2VsZWN0ZWRJbmRleDogLTEsXG4gICAgY29udGV4dExWaWV3OiBudWxsLFxuICAgIGVsZW1lbnREZXB0aENvdW50OiAwLFxuICAgIGN1cnJlbnROYW1lc3BhY2U6IG51bGwsXG4gICAgY3VycmVudERpcmVjdGl2ZUluZGV4OiAtMSxcbiAgICBiaW5kaW5nUm9vdEluZGV4OiAtMSxcbiAgICBiaW5kaW5nSW5kZXg6IC0xLFxuICAgIGN1cnJlbnRRdWVyeUluZGV4OiAwLFxuICAgIHBhcmVudDogcGFyZW50ISxcbiAgICBjaGlsZDogbnVsbCxcbiAgICBpbkkxOG46IGZhbHNlLFxuICB9O1xuICBwYXJlbnQgIT09IG51bGwgJiYgKHBhcmVudC5jaGlsZCA9IGxGcmFtZSk7IC8vIGxpbmsgdGhlIG5ldyBMRnJhbWUgZm9yIHJldXNlLlxuICByZXR1cm4gbEZyYW1lO1xufVxuXG4vKipcbiAqIEEgbGlnaHR3ZWlnaHQgdmVyc2lvbiBvZiBsZWF2ZSB3aGljaCBpcyB1c2VkIHdpdGggREkuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBvbmx5IHJlc2V0cyBgY3VycmVudFROb2RlYCBhbmQgYExWaWV3YCBhcyB0aG9zZSBhcmUgdGhlIG9ubHkgcHJvcGVydGllc1xuICogdXNlZCB3aXRoIERJIChgZW50ZXJESSgpYCkuXG4gKlxuICogTk9URTogVGhpcyBmdW5jdGlvbiBpcyByZWV4cG9ydGVkIGFzIGBsZWF2ZURJYC4gSG93ZXZlciBgbGVhdmVESWAgaGFzIHJldHVybiB0eXBlIG9mIGB2b2lkYCB3aGVyZVxuICogYXMgYGxlYXZlVmlld0xpZ2h0YCBoYXMgYExGcmFtZWAuIFRoaXMgaXMgc28gdGhhdCBgbGVhdmVWaWV3TGlnaHRgIGNhbiBiZSB1c2VkIGluIGBsZWF2ZVZpZXdgLlxuICovXG5mdW5jdGlvbiBsZWF2ZVZpZXdMaWdodCgpOiBMRnJhbWUge1xuICBjb25zdCBvbGRMRnJhbWUgPSBpbnN0cnVjdGlvblN0YXRlLmxGcmFtZTtcbiAgaW5zdHJ1Y3Rpb25TdGF0ZS5sRnJhbWUgPSBvbGRMRnJhbWUucGFyZW50O1xuICBvbGRMRnJhbWUuY3VycmVudFROb2RlID0gbnVsbCE7XG4gIG9sZExGcmFtZS5sVmlldyA9IG51bGwhO1xuICByZXR1cm4gb2xkTEZyYW1lO1xufVxuXG4vKipcbiAqIFRoaXMgaXMgYSBsaWdodHdlaWdodCB2ZXJzaW9uIG9mIHRoZSBgbGVhdmVWaWV3YCB3aGljaCBpcyBuZWVkZWQgYnkgdGhlIERJIHN5c3RlbS5cbiAqXG4gKiBOT1RFOiB0aGlzIGZ1bmN0aW9uIGlzIGFuIGFsaWFzIHNvIHRoYXQgd2UgY2FuIGNoYW5nZSB0aGUgdHlwZSBvZiB0aGUgZnVuY3Rpb24gdG8gaGF2ZSBgdm9pZGBcbiAqIHJldHVybiB0eXBlLlxuICovXG5leHBvcnQgY29uc3QgbGVhdmVESTogKCkgPT4gdm9pZCA9IGxlYXZlVmlld0xpZ2h0O1xuXG4vKipcbiAqIExlYXZlIHRoZSBjdXJyZW50IGBMVmlld2BcbiAqXG4gKiBUaGlzIHBvcHMgdGhlIGBMRnJhbWVgIHdpdGggdGhlIGFzc29jaWF0ZWQgYExWaWV3YCBmcm9tIHRoZSBzdGFjay5cbiAqXG4gKiBJTVBPUlRBTlQ6IFdlIG11c3QgemVybyBvdXQgdGhlIGBMRnJhbWVgIHZhbHVlcyBoZXJlIG90aGVyd2lzZSB0aGV5IHdpbGwgYmUgcmV0YWluZWQuIFRoaXMgaXNcbiAqIGJlY2F1c2UgZm9yIHBlcmZvcm1hbmNlIHJlYXNvbnMgd2UgZG9uJ3QgcmVsZWFzZSBgTEZyYW1lYCBidXQgcmF0aGVyIGtlZXAgaXQgZm9yIG5leHQgdXNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbGVhdmVWaWV3KCkge1xuICBjb25zdCBvbGRMRnJhbWUgPSBsZWF2ZVZpZXdMaWdodCgpO1xuICBvbGRMRnJhbWUuaXNQYXJlbnQgPSB0cnVlO1xuICBvbGRMRnJhbWUudFZpZXcgPSBudWxsITtcbiAgb2xkTEZyYW1lLnNlbGVjdGVkSW5kZXggPSAtMTtcbiAgb2xkTEZyYW1lLmNvbnRleHRMVmlldyA9IG51bGw7XG4gIG9sZExGcmFtZS5lbGVtZW50RGVwdGhDb3VudCA9IDA7XG4gIG9sZExGcmFtZS5jdXJyZW50RGlyZWN0aXZlSW5kZXggPSAtMTtcbiAgb2xkTEZyYW1lLmN1cnJlbnROYW1lc3BhY2UgPSBudWxsO1xuICBvbGRMRnJhbWUuYmluZGluZ1Jvb3RJbmRleCA9IC0xO1xuICBvbGRMRnJhbWUuYmluZGluZ0luZGV4ID0gLTE7XG4gIG9sZExGcmFtZS5jdXJyZW50UXVlcnlJbmRleCA9IDA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuZXh0Q29udGV4dEltcGw8VCA9IGFueT4obGV2ZWw6IG51bWJlcik6IFQge1xuICBjb25zdCBjb250ZXh0TFZpZXcgPSAoaW5zdHJ1Y3Rpb25TdGF0ZS5sRnJhbWUuY29udGV4dExWaWV3ID0gd2Fsa1VwVmlld3MoXG4gICAgbGV2ZWwsXG4gICAgaW5zdHJ1Y3Rpb25TdGF0ZS5sRnJhbWUuY29udGV4dExWaWV3ISxcbiAgKSk7XG4gIHJldHVybiBjb250ZXh0TFZpZXdbQ09OVEVYVF0gYXMgdW5rbm93biBhcyBUO1xufVxuXG4vKipcbiAqIEdldHMgdGhlIGN1cnJlbnRseSBzZWxlY3RlZCBlbGVtZW50IGluZGV4LlxuICpcbiAqIFVzZWQgd2l0aCB7QGxpbmsgcHJvcGVydHl9IGluc3RydWN0aW9uIChhbmQgbW9yZSBpbiB0aGUgZnV0dXJlKSB0byBpZGVudGlmeSB0aGUgaW5kZXggaW4gdGhlXG4gKiBjdXJyZW50IGBMVmlld2AgdG8gYWN0IG9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0U2VsZWN0ZWRJbmRleCgpIHtcbiAgcmV0dXJuIGluc3RydWN0aW9uU3RhdGUubEZyYW1lLnNlbGVjdGVkSW5kZXg7XG59XG5cbi8qKlxuICogU2V0cyB0aGUgbW9zdCByZWNlbnQgaW5kZXggcGFzc2VkIHRvIHtAbGluayBzZWxlY3R9XG4gKlxuICogVXNlZCB3aXRoIHtAbGluayBwcm9wZXJ0eX0gaW5zdHJ1Y3Rpb24gKGFuZCBtb3JlIGluIHRoZSBmdXR1cmUpIHRvIGlkZW50aWZ5IHRoZSBpbmRleCBpbiB0aGVcbiAqIGN1cnJlbnQgYExWaWV3YCB0byBhY3Qgb24uXG4gKlxuICogKE5vdGUgdGhhdCBpZiBhbiBcImV4aXQgZnVuY3Rpb25cIiB3YXMgc2V0IGVhcmxpZXIgKHZpYSBgc2V0RWxlbWVudEV4aXRGbigpYCkgdGhlbiB0aGF0IHdpbGwgYmVcbiAqIHJ1biBpZiBhbmQgd2hlbiB0aGUgcHJvdmlkZWQgYGluZGV4YCB2YWx1ZSBpcyBkaWZmZXJlbnQgZnJvbSB0aGUgY3VycmVudCBzZWxlY3RlZCBpbmRleCB2YWx1ZS4pXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRTZWxlY3RlZEluZGV4KGluZGV4OiBudW1iZXIpIHtcbiAgbmdEZXZNb2RlICYmXG4gICAgaW5kZXggIT09IC0xICYmXG4gICAgYXNzZXJ0R3JlYXRlclRoYW5PckVxdWFsKGluZGV4LCBIRUFERVJfT0ZGU0VULCAnSW5kZXggbXVzdCBiZSBwYXN0IEhFQURFUl9PRkZTRVQgKG9yIC0xKS4nKTtcbiAgbmdEZXZNb2RlICYmXG4gICAgYXNzZXJ0TGVzc1RoYW4oXG4gICAgICBpbmRleCxcbiAgICAgIGluc3RydWN0aW9uU3RhdGUubEZyYW1lLmxWaWV3Lmxlbmd0aCxcbiAgICAgIFwiQ2FuJ3Qgc2V0IGluZGV4IHBhc3NlZCBlbmQgb2YgTFZpZXdcIixcbiAgICApO1xuICBpbnN0cnVjdGlvblN0YXRlLmxGcmFtZS5zZWxlY3RlZEluZGV4ID0gaW5kZXg7XG59XG5cbi8qKlxuICogR2V0cyB0aGUgYHROb2RlYCB0aGF0IHJlcHJlc2VudHMgY3VycmVudGx5IHNlbGVjdGVkIGVsZW1lbnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRTZWxlY3RlZFROb2RlKCkge1xuICBjb25zdCBsRnJhbWUgPSBpbnN0cnVjdGlvblN0YXRlLmxGcmFtZTtcbiAgcmV0dXJuIGdldFROb2RlKGxGcmFtZS50VmlldywgbEZyYW1lLnNlbGVjdGVkSW5kZXgpO1xufVxuXG4vKipcbiAqIFNldHMgdGhlIG5hbWVzcGFjZSB1c2VkIHRvIGNyZWF0ZSBlbGVtZW50cyB0byBgJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJ2AgaW4gZ2xvYmFsIHN0YXRlLlxuICpcbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1bmFtZXNwYWNlU1ZHKCkge1xuICBpbnN0cnVjdGlvblN0YXRlLmxGcmFtZS5jdXJyZW50TmFtZXNwYWNlID0gU1ZHX05BTUVTUEFDRTtcbn1cblxuLyoqXG4gKiBTZXRzIHRoZSBuYW1lc3BhY2UgdXNlZCB0byBjcmVhdGUgZWxlbWVudHMgdG8gYCdodHRwOi8vd3d3LnczLm9yZy8xOTk4L01hdGhNTC8nYCBpbiBnbG9iYWwgc3RhdGUuXG4gKlxuICogQGNvZGVHZW5BcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybVuYW1lc3BhY2VNYXRoTUwoKSB7XG4gIGluc3RydWN0aW9uU3RhdGUubEZyYW1lLmN1cnJlbnROYW1lc3BhY2UgPSBNQVRIX01MX05BTUVTUEFDRTtcbn1cblxuLyoqXG4gKiBTZXRzIHRoZSBuYW1lc3BhY2UgdXNlZCB0byBjcmVhdGUgZWxlbWVudHMgdG8gYG51bGxgLCB3aGljaCBmb3JjZXMgZWxlbWVudCBjcmVhdGlvbiB0byB1c2VcbiAqIGBjcmVhdGVFbGVtZW50YCByYXRoZXIgdGhhbiBgY3JlYXRlRWxlbWVudE5TYC5cbiAqXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtW5hbWVzcGFjZUhUTUwoKSB7XG4gIG5hbWVzcGFjZUhUTUxJbnRlcm5hbCgpO1xufVxuXG4vKipcbiAqIFNldHMgdGhlIG5hbWVzcGFjZSB1c2VkIHRvIGNyZWF0ZSBlbGVtZW50cyB0byBgbnVsbGAsIHdoaWNoIGZvcmNlcyBlbGVtZW50IGNyZWF0aW9uIHRvIHVzZVxuICogYGNyZWF0ZUVsZW1lbnRgIHJhdGhlciB0aGFuIGBjcmVhdGVFbGVtZW50TlNgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbmFtZXNwYWNlSFRNTEludGVybmFsKCkge1xuICBpbnN0cnVjdGlvblN0YXRlLmxGcmFtZS5jdXJyZW50TmFtZXNwYWNlID0gbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE5hbWVzcGFjZSgpOiBzdHJpbmcgfCBudWxsIHtcbiAgcmV0dXJuIGluc3RydWN0aW9uU3RhdGUubEZyYW1lLmN1cnJlbnROYW1lc3BhY2U7XG59XG5cbmxldCBfd2FzTGFzdE5vZGVDcmVhdGVkID0gdHJ1ZTtcblxuLyoqXG4gKiBSZXRyaWV2ZXMgYSBnbG9iYWwgZmxhZyB0aGF0IGluZGljYXRlcyB3aGV0aGVyIHRoZSBtb3N0IHJlY2VudCBET00gbm9kZVxuICogd2FzIGNyZWF0ZWQgb3IgaHlkcmF0ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3YXNMYXN0Tm9kZUNyZWF0ZWQoKTogYm9vbGVhbiB7XG4gIHJldHVybiBfd2FzTGFzdE5vZGVDcmVhdGVkO1xufVxuXG4vKipcbiAqIFNldHMgYSBnbG9iYWwgZmxhZyB0byBpbmRpY2F0ZSB3aGV0aGVyIHRoZSBtb3N0IHJlY2VudCBET00gbm9kZVxuICogd2FzIGNyZWF0ZWQgb3IgaHlkcmF0ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsYXN0Tm9kZVdhc0NyZWF0ZWQoZmxhZzogYm9vbGVhbik6IHZvaWQge1xuICBfd2FzTGFzdE5vZGVDcmVhdGVkID0gZmxhZztcbn1cbiJdfQ==