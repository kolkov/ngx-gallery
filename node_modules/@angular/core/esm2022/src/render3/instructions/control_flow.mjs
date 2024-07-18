/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { setActiveConsumer } from '@angular/core/primitives/signals';
import { formatRuntimeError } from '../../errors';
import { findMatchingDehydratedView } from '../../hydration/views';
import { assertDefined, assertFunction } from '../../util/assert';
import { performanceMarkFeature } from '../../util/performance';
import { assertLContainer, assertLView, assertTNode } from '../assert';
import { bindingUpdated } from '../bindings';
import { CONTAINER_HEADER_OFFSET } from '../interfaces/container';
import { CONTEXT, DECLARATION_COMPONENT_VIEW, HEADER_OFFSET, HYDRATION, TVIEW, } from '../interfaces/view';
import { LiveCollection, reconcile } from '../list_reconciliation';
import { destroyLView, detachView } from '../node_manipulation';
import { getLView, getSelectedIndex, getTView, nextBindingIndex } from '../state';
import { NO_CHANGE } from '../tokens';
import { getConstant, getTNode } from '../util/view_utils';
import { addLViewToLContainer, createAndRenderEmbeddedLView, getLViewFromLContainer, removeLViewFromLContainer, shouldAddViewToDom, } from '../view_manipulation';
import { declareTemplate } from './template';
/**
 * The conditional instruction represents the basic building block on the runtime side to support
 * built-in "if" and "switch". On the high level this instruction is responsible for adding and
 * removing views selected by a conditional expression.
 *
 * @param matchingTemplateIndex Index of a template TNode representing a conditional view to be
 *     inserted; -1 represents a special case when there is no view to insert.
 * @param contextValue Value that should be exposed as the context of the conditional.
 * @codeGenApi
 */
export function ɵɵconditional(matchingTemplateIndex, contextValue) {
    performanceMarkFeature('NgControlFlow');
    const hostLView = getLView();
    const bindingIndex = nextBindingIndex();
    const prevMatchingTemplateIndex = hostLView[bindingIndex] !== NO_CHANGE ? hostLView[bindingIndex] : -1;
    const prevContainer = prevMatchingTemplateIndex !== -1
        ? getLContainer(hostLView, HEADER_OFFSET + prevMatchingTemplateIndex)
        : undefined;
    const viewInContainerIdx = 0;
    if (bindingUpdated(hostLView, bindingIndex, matchingTemplateIndex)) {
        const prevConsumer = setActiveConsumer(null);
        try {
            // The index of the view to show changed - remove the previously displayed one
            // (it is a noop if there are no active views in a container).
            if (prevContainer !== undefined) {
                removeLViewFromLContainer(prevContainer, viewInContainerIdx);
            }
            // Index -1 is a special case where none of the conditions evaluates to
            // a truthy value and as the consequence we've got no view to show.
            if (matchingTemplateIndex !== -1) {
                const nextLContainerIndex = HEADER_OFFSET + matchingTemplateIndex;
                const nextContainer = getLContainer(hostLView, nextLContainerIndex);
                const templateTNode = getExistingTNode(hostLView[TVIEW], nextLContainerIndex);
                const dehydratedView = findMatchingDehydratedView(nextContainer, templateTNode.tView.ssrId);
                const embeddedLView = createAndRenderEmbeddedLView(hostLView, templateTNode, contextValue, {
                    dehydratedView,
                });
                addLViewToLContainer(nextContainer, embeddedLView, viewInContainerIdx, shouldAddViewToDom(templateTNode, dehydratedView));
            }
        }
        finally {
            setActiveConsumer(prevConsumer);
        }
    }
    else if (prevContainer !== undefined) {
        // We might keep displaying the same template but the actual value of the expression could have
        // changed - re-bind in context.
        const lView = getLViewFromLContainer(prevContainer, viewInContainerIdx);
        if (lView !== undefined) {
            lView[CONTEXT] = contextValue;
        }
    }
}
export class RepeaterContext {
    constructor(lContainer, $implicit, $index) {
        this.lContainer = lContainer;
        this.$implicit = $implicit;
        this.$index = $index;
    }
    get $count() {
        return this.lContainer.length - CONTAINER_HEADER_OFFSET;
    }
}
/**
 * A built-in trackBy function used for situations where users specified collection index as a
 * tracking expression. Having this function body in the runtime avoids unnecessary code generation.
 *
 * @param index
 * @returns
 */
export function ɵɵrepeaterTrackByIndex(index) {
    return index;
}
/**
 * A built-in trackBy function used for situations where users specified collection item reference
 * as a tracking expression. Having this function body in the runtime avoids unnecessary code
 * generation.
 *
 * @param index
 * @returns
 */
export function ɵɵrepeaterTrackByIdentity(_, value) {
    return value;
}
class RepeaterMetadata {
    constructor(hasEmptyBlock, trackByFn, liveCollection) {
        this.hasEmptyBlock = hasEmptyBlock;
        this.trackByFn = trackByFn;
        this.liveCollection = liveCollection;
    }
}
/**
 * The repeaterCreate instruction runs in the creation part of the template pass and initializes
 * internal data structures required by the update pass of the built-in repeater logic. Repeater
 * metadata are allocated in the data part of LView with the following layout:
 * - LView[HEADER_OFFSET + index] - metadata
 * - LView[HEADER_OFFSET + index + 1] - reference to a template function rendering an item
 * - LView[HEADER_OFFSET + index + 2] - optional reference to a template function rendering an empty
 * block
 *
 * @param index Index at which to store the metadata of the repeater.
 * @param templateFn Reference to the template of the main repeater block.
 * @param decls The number of nodes, local refs, and pipes for the main block.
 * @param vars The number of bindings for the main block.
 * @param tagName The name of the container element, if applicable
 * @param attrsIndex Index of template attributes in the `consts` array.
 * @param trackByFn Reference to the tracking function.
 * @param trackByUsesComponentInstance Whether the tracking function has any references to the
 *  component instance. If it doesn't, we can avoid rebinding it.
 * @param emptyTemplateFn Reference to the template function of the empty block.
 * @param emptyDecls The number of nodes, local refs, and pipes for the empty block.
 * @param emptyVars The number of bindings for the empty block.
 * @param emptyTagName The name of the empty block container element, if applicable
 * @param emptyAttrsIndex Index of the empty block template attributes in the `consts` array.
 *
 * @codeGenApi
 */
export function ɵɵrepeaterCreate(index, templateFn, decls, vars, tagName, attrsIndex, trackByFn, trackByUsesComponentInstance, emptyTemplateFn, emptyDecls, emptyVars, emptyTagName, emptyAttrsIndex) {
    performanceMarkFeature('NgControlFlow');
    ngDevMode &&
        assertFunction(trackByFn, `A track expression must be a function, was ${typeof trackByFn} instead.`);
    const lView = getLView();
    const tView = getTView();
    const hasEmptyBlock = emptyTemplateFn !== undefined;
    const hostLView = getLView();
    const boundTrackBy = trackByUsesComponentInstance
        ? // We only want to bind when necessary, because it produces a
            // new function. For pure functions it's not necessary.
            trackByFn.bind(hostLView[DECLARATION_COMPONENT_VIEW][CONTEXT])
        : trackByFn;
    const metadata = new RepeaterMetadata(hasEmptyBlock, boundTrackBy);
    hostLView[HEADER_OFFSET + index] = metadata;
    declareTemplate(lView, tView, index + 1, templateFn, decls, vars, tagName, getConstant(tView.consts, attrsIndex));
    if (hasEmptyBlock) {
        ngDevMode &&
            assertDefined(emptyDecls, 'Missing number of declarations for the empty repeater block.');
        ngDevMode &&
            assertDefined(emptyVars, 'Missing number of bindings for the empty repeater block.');
        declareTemplate(lView, tView, index + 2, emptyTemplateFn, emptyDecls, emptyVars, emptyTagName, getConstant(tView.consts, emptyAttrsIndex));
    }
}
function isViewExpensiveToRecreate(lView) {
    // assumption: anything more than a text node with a binding is considered "expensive"
    return lView.length - HEADER_OFFSET > 2;
}
class OperationsCounter {
    constructor() {
        this.created = 0;
        this.destroyed = 0;
    }
    reset() {
        this.created = 0;
        this.destroyed = 0;
    }
    recordCreate() {
        this.created++;
    }
    recordDestroy() {
        this.destroyed++;
    }
    /**
     * A method indicating if the entire collection was re-created as part of the reconciliation pass.
     * Used to warn developers about the usage of a tracking function that might result in excessive
     * amount of view creation / destroy operations.
     *
     * @returns boolean value indicating if a live collection was re-created
     */
    wasReCreated(collectionLen) {
        return collectionLen > 0 && this.created === this.destroyed && this.created === collectionLen;
    }
}
class LiveCollectionLContainerImpl extends LiveCollection {
    constructor(lContainer, hostLView, templateTNode) {
        super();
        this.lContainer = lContainer;
        this.hostLView = hostLView;
        this.templateTNode = templateTNode;
        this.operationsCounter = ngDevMode ? new OperationsCounter() : undefined;
        /**
         Property indicating if indexes in the repeater context need to be updated following the live
         collection changes. Index updates are necessary if and only if views are inserted / removed in
         the middle of LContainer. Adds and removals at the end don't require index updates.
       */
        this.needsIndexUpdate = false;
    }
    get length() {
        return this.lContainer.length - CONTAINER_HEADER_OFFSET;
    }
    at(index) {
        return this.getLView(index)[CONTEXT].$implicit;
    }
    attach(index, lView) {
        const dehydratedView = lView[HYDRATION];
        this.needsIndexUpdate ||= index !== this.length;
        addLViewToLContainer(this.lContainer, lView, index, shouldAddViewToDom(this.templateTNode, dehydratedView));
    }
    detach(index) {
        this.needsIndexUpdate ||= index !== this.length - 1;
        return detachExistingView(this.lContainer, index);
    }
    create(index, value) {
        const dehydratedView = findMatchingDehydratedView(this.lContainer, this.templateTNode.tView.ssrId);
        const embeddedLView = createAndRenderEmbeddedLView(this.hostLView, this.templateTNode, new RepeaterContext(this.lContainer, value, index), { dehydratedView });
        this.operationsCounter?.recordCreate();
        return embeddedLView;
    }
    destroy(lView) {
        destroyLView(lView[TVIEW], lView);
        this.operationsCounter?.recordDestroy();
    }
    updateValue(index, value) {
        this.getLView(index)[CONTEXT].$implicit = value;
    }
    reset() {
        this.needsIndexUpdate = false;
        this.operationsCounter?.reset();
    }
    updateIndexes() {
        if (this.needsIndexUpdate) {
            for (let i = 0; i < this.length; i++) {
                this.getLView(i)[CONTEXT].$index = i;
            }
        }
    }
    getLView(index) {
        return getExistingLViewFromLContainer(this.lContainer, index);
    }
}
/**
 * The repeater instruction does update-time diffing of a provided collection (against the
 * collection seen previously) and maps changes in the collection to views structure (by adding,
 * removing or moving views as needed).
 * @param collection - the collection instance to be checked for changes
 * @codeGenApi
 */
export function ɵɵrepeater(collection) {
    const prevConsumer = setActiveConsumer(null);
    const metadataSlotIdx = getSelectedIndex();
    try {
        const hostLView = getLView();
        const hostTView = hostLView[TVIEW];
        const metadata = hostLView[metadataSlotIdx];
        const containerIndex = metadataSlotIdx + 1;
        const lContainer = getLContainer(hostLView, containerIndex);
        if (metadata.liveCollection === undefined) {
            const itemTemplateTNode = getExistingTNode(hostTView, containerIndex);
            metadata.liveCollection = new LiveCollectionLContainerImpl(lContainer, hostLView, itemTemplateTNode);
        }
        else {
            metadata.liveCollection.reset();
        }
        const liveCollection = metadata.liveCollection;
        reconcile(liveCollection, collection, metadata.trackByFn);
        // Warn developers about situations where the entire collection was re-created as part of the
        // reconciliation pass. Note that this warning might be "overreacting" and report cases where
        // the collection re-creation is the intended behavior. Still, the assumption is that most of
        // the time it is undesired.
        if (ngDevMode &&
            metadata.trackByFn === ɵɵrepeaterTrackByIdentity &&
            liveCollection.operationsCounter?.wasReCreated(liveCollection.length) &&
            isViewExpensiveToRecreate(getExistingLViewFromLContainer(lContainer, 0))) {
            const message = formatRuntimeError(-956 /* RuntimeErrorCode.LOOP_TRACK_RECREATE */, `The configured tracking expression (track by identity) caused re-creation of the entire collection of size ${liveCollection.length}. ` +
                'This is an expensive operation requiring destruction and subsequent creation of DOM nodes, directives, components etc. ' +
                'Please review the "track expression" and make sure that it uniquely identifies items in a collection.');
            console.warn(message);
        }
        // moves in the container might caused context's index to get out of order, re-adjust if needed
        liveCollection.updateIndexes();
        // handle empty blocks
        if (metadata.hasEmptyBlock) {
            const bindingIndex = nextBindingIndex();
            const isCollectionEmpty = liveCollection.length === 0;
            if (bindingUpdated(hostLView, bindingIndex, isCollectionEmpty)) {
                const emptyTemplateIndex = metadataSlotIdx + 2;
                const lContainerForEmpty = getLContainer(hostLView, emptyTemplateIndex);
                if (isCollectionEmpty) {
                    const emptyTemplateTNode = getExistingTNode(hostTView, emptyTemplateIndex);
                    const dehydratedView = findMatchingDehydratedView(lContainerForEmpty, emptyTemplateTNode.tView.ssrId);
                    const embeddedLView = createAndRenderEmbeddedLView(hostLView, emptyTemplateTNode, undefined, { dehydratedView });
                    addLViewToLContainer(lContainerForEmpty, embeddedLView, 0, shouldAddViewToDom(emptyTemplateTNode, dehydratedView));
                }
                else {
                    removeLViewFromLContainer(lContainerForEmpty, 0);
                }
            }
        }
    }
    finally {
        setActiveConsumer(prevConsumer);
    }
}
function getLContainer(lView, index) {
    const lContainer = lView[index];
    ngDevMode && assertLContainer(lContainer);
    return lContainer;
}
function detachExistingView(lContainer, index) {
    const existingLView = detachView(lContainer, index);
    ngDevMode && assertLView(existingLView);
    return existingLView;
}
function getExistingLViewFromLContainer(lContainer, index) {
    const existingLView = getLViewFromLContainer(lContainer, index);
    ngDevMode && assertLView(existingLView);
    return existingLView;
}
function getExistingTNode(tView, index) {
    const tNode = getTNode(tView, index);
    ngDevMode && assertTNode(tNode);
    return tNode;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udHJvbF9mbG93LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9pbnN0cnVjdGlvbnMvY29udHJvbF9mbG93LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBR25FLE9BQU8sRUFBQyxrQkFBa0IsRUFBbUIsTUFBTSxjQUFjLENBQUM7QUFFbEUsT0FBTyxFQUFDLDBCQUEwQixFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDakUsT0FBTyxFQUFDLGFBQWEsRUFBRSxjQUFjLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUNoRSxPQUFPLEVBQUMsc0JBQXNCLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUM5RCxPQUFPLEVBQUMsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUNyRSxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQzNDLE9BQU8sRUFBQyx1QkFBdUIsRUFBYSxNQUFNLHlCQUF5QixDQUFDO0FBRzVFLE9BQU8sRUFDTCxPQUFPLEVBQ1AsMEJBQTBCLEVBQzFCLGFBQWEsRUFDYixTQUFTLEVBRVQsS0FBSyxHQUVOLE1BQU0sb0JBQW9CLENBQUM7QUFDNUIsT0FBTyxFQUFDLGNBQWMsRUFBRSxTQUFTLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNqRSxPQUFPLEVBQUMsWUFBWSxFQUFFLFVBQVUsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQzlELE9BQU8sRUFBQyxRQUFRLEVBQUUsZ0JBQWdCLEVBQUUsUUFBUSxFQUFFLGdCQUFnQixFQUFDLE1BQU0sVUFBVSxDQUFDO0FBQ2hGLE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFDcEMsT0FBTyxFQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUN6RCxPQUFPLEVBQ0wsb0JBQW9CLEVBQ3BCLDRCQUE0QixFQUM1QixzQkFBc0IsRUFDdEIseUJBQXlCLEVBQ3pCLGtCQUFrQixHQUNuQixNQUFNLHNCQUFzQixDQUFDO0FBRTlCLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFFM0M7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBTSxVQUFVLGFBQWEsQ0FBSSxxQkFBNkIsRUFBRSxZQUFnQjtJQUM5RSxzQkFBc0IsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUV4QyxNQUFNLFNBQVMsR0FBRyxRQUFRLEVBQUUsQ0FBQztJQUM3QixNQUFNLFlBQVksR0FBRyxnQkFBZ0IsRUFBRSxDQUFDO0lBQ3hDLE1BQU0seUJBQXlCLEdBQzdCLFNBQVMsQ0FBQyxZQUFZLENBQUMsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdkUsTUFBTSxhQUFhLEdBQ2pCLHlCQUF5QixLQUFLLENBQUMsQ0FBQztRQUM5QixDQUFDLENBQUMsYUFBYSxDQUFDLFNBQVMsRUFBRSxhQUFhLEdBQUcseUJBQXlCLENBQUM7UUFDckUsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUNoQixNQUFNLGtCQUFrQixHQUFHLENBQUMsQ0FBQztJQUU3QixJQUFJLGNBQWMsQ0FBQyxTQUFTLEVBQUUsWUFBWSxFQUFFLHFCQUFxQixDQUFDLEVBQUUsQ0FBQztRQUNuRSxNQUFNLFlBQVksR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QyxJQUFJLENBQUM7WUFDSCw4RUFBOEU7WUFDOUUsOERBQThEO1lBQzlELElBQUksYUFBYSxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUNoQyx5QkFBeUIsQ0FBQyxhQUFhLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUMvRCxDQUFDO1lBRUQsdUVBQXVFO1lBQ3ZFLG1FQUFtRTtZQUNuRSxJQUFJLHFCQUFxQixLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ2pDLE1BQU0sbUJBQW1CLEdBQUcsYUFBYSxHQUFHLHFCQUFxQixDQUFDO2dCQUNsRSxNQUFNLGFBQWEsR0FBRyxhQUFhLENBQUMsU0FBUyxFQUFFLG1CQUFtQixDQUFDLENBQUM7Z0JBQ3BFLE1BQU0sYUFBYSxHQUFHLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO2dCQUU5RSxNQUFNLGNBQWMsR0FBRywwQkFBMEIsQ0FDL0MsYUFBYSxFQUNiLGFBQWEsQ0FBQyxLQUFNLENBQUMsS0FBSyxDQUMzQixDQUFDO2dCQUNGLE1BQU0sYUFBYSxHQUFHLDRCQUE0QixDQUFDLFNBQVMsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFO29CQUN6RixjQUFjO2lCQUNmLENBQUMsQ0FBQztnQkFFSCxvQkFBb0IsQ0FDbEIsYUFBYSxFQUNiLGFBQWEsRUFDYixrQkFBa0IsRUFDbEIsa0JBQWtCLENBQUMsYUFBYSxFQUFFLGNBQWMsQ0FBQyxDQUNsRCxDQUFDO1lBQ0osQ0FBQztRQUNILENBQUM7Z0JBQVMsQ0FBQztZQUNULGlCQUFpQixDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ2xDLENBQUM7SUFDSCxDQUFDO1NBQU0sSUFBSSxhQUFhLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDdkMsK0ZBQStGO1FBQy9GLGdDQUFnQztRQUNoQyxNQUFNLEtBQUssR0FBRyxzQkFBc0IsQ0FBZ0IsYUFBYSxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDdkYsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDeEIsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLFlBQVksQ0FBQztRQUNoQyxDQUFDO0lBQ0gsQ0FBQztBQUNILENBQUM7QUFFRCxNQUFNLE9BQU8sZUFBZTtJQUMxQixZQUNVLFVBQXNCLEVBQ3ZCLFNBQVksRUFDWixNQUFjO1FBRmIsZUFBVSxHQUFWLFVBQVUsQ0FBWTtRQUN2QixjQUFTLEdBQVQsU0FBUyxDQUFHO1FBQ1osV0FBTSxHQUFOLE1BQU0sQ0FBUTtJQUNwQixDQUFDO0lBRUosSUFBSSxNQUFNO1FBQ1IsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyx1QkFBdUIsQ0FBQztJQUMxRCxDQUFDO0NBQ0Y7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsc0JBQXNCLENBQUMsS0FBYTtJQUNsRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRDs7Ozs7OztHQU9HO0FBQ0gsTUFBTSxVQUFVLHlCQUF5QixDQUFJLENBQVMsRUFBRSxLQUFRO0lBQzlELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVELE1BQU0sZ0JBQWdCO0lBQ3BCLFlBQ1MsYUFBc0IsRUFDdEIsU0FBbUMsRUFDbkMsY0FBNkM7UUFGN0Msa0JBQWEsR0FBYixhQUFhLENBQVM7UUFDdEIsY0FBUyxHQUFULFNBQVMsQ0FBMEI7UUFDbkMsbUJBQWMsR0FBZCxjQUFjLENBQStCO0lBQ25ELENBQUM7Q0FDTDtBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBeUJHO0FBQ0gsTUFBTSxVQUFVLGdCQUFnQixDQUM5QixLQUFhLEVBQ2IsVUFBc0MsRUFDdEMsS0FBYSxFQUNiLElBQVksRUFDWixPQUFzQixFQUN0QixVQUF5QixFQUN6QixTQUFtQyxFQUNuQyw0QkFBc0MsRUFDdEMsZUFBNEMsRUFDNUMsVUFBbUIsRUFDbkIsU0FBa0IsRUFDbEIsWUFBNEIsRUFDNUIsZUFBK0I7SUFFL0Isc0JBQXNCLENBQUMsZUFBZSxDQUFDLENBQUM7SUFFeEMsU0FBUztRQUNQLGNBQWMsQ0FDWixTQUFTLEVBQ1QsOENBQThDLE9BQU8sU0FBUyxXQUFXLENBQzFFLENBQUM7SUFFSixNQUFNLEtBQUssR0FBRyxRQUFRLEVBQUUsQ0FBQztJQUN6QixNQUFNLEtBQUssR0FBRyxRQUFRLEVBQUUsQ0FBQztJQUN6QixNQUFNLGFBQWEsR0FBRyxlQUFlLEtBQUssU0FBUyxDQUFDO0lBQ3BELE1BQU0sU0FBUyxHQUFHLFFBQVEsRUFBRSxDQUFDO0lBQzdCLE1BQU0sWUFBWSxHQUFHLDRCQUE0QjtRQUMvQyxDQUFDLENBQUMsNkRBQTZEO1lBQzdELHVEQUF1RDtZQUN2RCxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2hFLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDZCxNQUFNLFFBQVEsR0FBRyxJQUFJLGdCQUFnQixDQUFDLGFBQWEsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUNuRSxTQUFTLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQyxHQUFHLFFBQVEsQ0FBQztJQUU1QyxlQUFlLENBQ2IsS0FBSyxFQUNMLEtBQUssRUFDTCxLQUFLLEdBQUcsQ0FBQyxFQUNULFVBQVUsRUFDVixLQUFLLEVBQ0wsSUFBSSxFQUNKLE9BQU8sRUFDUCxXQUFXLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FDdEMsQ0FBQztJQUVGLElBQUksYUFBYSxFQUFFLENBQUM7UUFDbEIsU0FBUztZQUNQLGFBQWEsQ0FBQyxVQUFVLEVBQUUsOERBQThELENBQUMsQ0FBQztRQUM1RixTQUFTO1lBQ1AsYUFBYSxDQUFDLFNBQVMsRUFBRSwwREFBMEQsQ0FBQyxDQUFDO1FBRXZGLGVBQWUsQ0FDYixLQUFLLEVBQ0wsS0FBSyxFQUNMLEtBQUssR0FBRyxDQUFDLEVBQ1QsZUFBZSxFQUNmLFVBQVcsRUFDWCxTQUFVLEVBQ1YsWUFBWSxFQUNaLFdBQVcsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLGVBQWUsQ0FBQyxDQUMzQyxDQUFDO0lBQ0osQ0FBQztBQUNILENBQUM7QUFFRCxTQUFTLHlCQUF5QixDQUFDLEtBQVk7SUFDN0Msc0ZBQXNGO0lBQ3RGLE9BQU8sS0FBSyxDQUFDLE1BQU0sR0FBRyxhQUFhLEdBQUcsQ0FBQyxDQUFDO0FBQzFDLENBQUM7QUFFRCxNQUFNLGlCQUFpQjtJQUF2QjtRQUNFLFlBQU8sR0FBRyxDQUFDLENBQUM7UUFDWixjQUFTLEdBQUcsQ0FBQyxDQUFDO0lBeUJoQixDQUFDO0lBdkJDLEtBQUs7UUFDSCxJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQztRQUNqQixJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztJQUNyQixDQUFDO0lBRUQsWUFBWTtRQUNWLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNqQixDQUFDO0lBRUQsYUFBYTtRQUNYLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUNuQixDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ0gsWUFBWSxDQUFDLGFBQXFCO1FBQ2hDLE9BQU8sYUFBYSxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsT0FBTyxLQUFLLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLE9BQU8sS0FBSyxhQUFhLENBQUM7SUFDaEcsQ0FBQztDQUNGO0FBRUQsTUFBTSw0QkFBNkIsU0FBUSxjQUcxQztJQVNDLFlBQ1UsVUFBc0IsRUFDdEIsU0FBZ0IsRUFDaEIsYUFBb0I7UUFFNUIsS0FBSyxFQUFFLENBQUM7UUFKQSxlQUFVLEdBQVYsVUFBVSxDQUFZO1FBQ3RCLGNBQVMsR0FBVCxTQUFTLENBQU87UUFDaEIsa0JBQWEsR0FBYixhQUFhLENBQU87UUFYOUIsc0JBQWlCLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUVwRTs7OztTQUlDO1FBQ08scUJBQWdCLEdBQUcsS0FBSyxDQUFDO0lBT2pDLENBQUM7SUFFRCxJQUFhLE1BQU07UUFDakIsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyx1QkFBdUIsQ0FBQztJQUMxRCxDQUFDO0lBQ1EsRUFBRSxDQUFDLEtBQWE7UUFDdkIsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUNqRCxDQUFDO0lBQ1EsTUFBTSxDQUFDLEtBQWEsRUFBRSxLQUFzQztRQUNuRSxNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUE0QixDQUFDO1FBQ25FLElBQUksQ0FBQyxnQkFBZ0IsS0FBSyxLQUFLLEtBQUssSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUNoRCxvQkFBb0IsQ0FDbEIsSUFBSSxDQUFDLFVBQVUsRUFDZixLQUFLLEVBQ0wsS0FBSyxFQUNMLGtCQUFrQixDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsY0FBYyxDQUFDLENBQ3ZELENBQUM7SUFDSixDQUFDO0lBQ1EsTUFBTSxDQUFDLEtBQWE7UUFDM0IsSUFBSSxDQUFDLGdCQUFnQixLQUFLLEtBQUssS0FBSyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNwRCxPQUFPLGtCQUFrQixDQUEyQixJQUFJLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFDUSxNQUFNLENBQUMsS0FBYSxFQUFFLEtBQWM7UUFDM0MsTUFBTSxjQUFjLEdBQUcsMEJBQTBCLENBQy9DLElBQUksQ0FBQyxVQUFVLEVBQ2YsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFNLENBQUMsS0FBSyxDQUNoQyxDQUFDO1FBQ0YsTUFBTSxhQUFhLEdBQUcsNEJBQTRCLENBQ2hELElBQUksQ0FBQyxTQUFTLEVBQ2QsSUFBSSxDQUFDLGFBQWEsRUFDbEIsSUFBSSxlQUFlLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLEVBQ2xELEVBQUMsY0FBYyxFQUFDLENBQ2pCLENBQUM7UUFDRixJQUFJLENBQUMsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLENBQUM7UUFFdkMsT0FBTyxhQUFhLENBQUM7SUFDdkIsQ0FBQztJQUNRLE9BQU8sQ0FBQyxLQUFzQztRQUNyRCxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2xDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxhQUFhLEVBQUUsQ0FBQztJQUMxQyxDQUFDO0lBQ1EsV0FBVyxDQUFDLEtBQWEsRUFBRSxLQUFjO1FBQ2hELElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztJQUNsRCxDQUFDO0lBRUQsS0FBSztRQUNILElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxLQUFLLENBQUM7UUFDOUIsSUFBSSxDQUFDLGlCQUFpQixFQUFFLEtBQUssRUFBRSxDQUFDO0lBQ2xDLENBQUM7SUFFRCxhQUFhO1FBQ1gsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUMxQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUNyQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7WUFDdkMsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRU8sUUFBUSxDQUFDLEtBQWE7UUFDNUIsT0FBTyw4QkFBOEIsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2hFLENBQUM7Q0FDRjtBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sVUFBVSxVQUFVLENBQUMsVUFBZ0Q7SUFDekUsTUFBTSxZQUFZLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDN0MsTUFBTSxlQUFlLEdBQUcsZ0JBQWdCLEVBQUUsQ0FBQztJQUMzQyxJQUFJLENBQUM7UUFDSCxNQUFNLFNBQVMsR0FBRyxRQUFRLEVBQUUsQ0FBQztRQUM3QixNQUFNLFNBQVMsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbkMsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLGVBQWUsQ0FBcUIsQ0FBQztRQUNoRSxNQUFNLGNBQWMsR0FBRyxlQUFlLEdBQUcsQ0FBQyxDQUFDO1FBQzNDLE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxTQUFTLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFFNUQsSUFBSSxRQUFRLENBQUMsY0FBYyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzFDLE1BQU0saUJBQWlCLEdBQUcsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1lBQ3RFLFFBQVEsQ0FBQyxjQUFjLEdBQUcsSUFBSSw0QkFBNEIsQ0FDeEQsVUFBVSxFQUNWLFNBQVMsRUFDVCxpQkFBaUIsQ0FDbEIsQ0FBQztRQUNKLENBQUM7YUFBTSxDQUFDO1lBQ04sUUFBUSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNsQyxDQUFDO1FBRUQsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQztRQUMvQyxTQUFTLENBQUMsY0FBYyxFQUFFLFVBQVUsRUFBRSxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFMUQsNkZBQTZGO1FBQzdGLDZGQUE2RjtRQUM3Riw2RkFBNkY7UUFDN0YsNEJBQTRCO1FBQzVCLElBQ0UsU0FBUztZQUNULFFBQVEsQ0FBQyxTQUFTLEtBQUsseUJBQXlCO1lBQ2hELGNBQWMsQ0FBQyxpQkFBaUIsRUFBRSxZQUFZLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQztZQUNyRSx5QkFBeUIsQ0FBQyw4QkFBOEIsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFDeEUsQ0FBQztZQUNELE1BQU0sT0FBTyxHQUFHLGtCQUFrQixrREFFaEMsOEdBQThHLGNBQWMsQ0FBQyxNQUFNLElBQUk7Z0JBQ3JJLHlIQUF5SDtnQkFDekgsdUdBQXVHLENBQzFHLENBQUM7WUFDRixPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3hCLENBQUM7UUFFRCwrRkFBK0Y7UUFDL0YsY0FBYyxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBRS9CLHNCQUFzQjtRQUN0QixJQUFJLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUMzQixNQUFNLFlBQVksR0FBRyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ3hDLE1BQU0saUJBQWlCLEdBQUcsY0FBYyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUM7WUFDdEQsSUFBSSxjQUFjLENBQUMsU0FBUyxFQUFFLFlBQVksRUFBRSxpQkFBaUIsQ0FBQyxFQUFFLENBQUM7Z0JBQy9ELE1BQU0sa0JBQWtCLEdBQUcsZUFBZSxHQUFHLENBQUMsQ0FBQztnQkFDL0MsTUFBTSxrQkFBa0IsR0FBRyxhQUFhLENBQUMsU0FBUyxFQUFFLGtCQUFrQixDQUFDLENBQUM7Z0JBQ3hFLElBQUksaUJBQWlCLEVBQUUsQ0FBQztvQkFDdEIsTUFBTSxrQkFBa0IsR0FBRyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztvQkFDM0UsTUFBTSxjQUFjLEdBQUcsMEJBQTBCLENBQy9DLGtCQUFrQixFQUNsQixrQkFBa0IsQ0FBQyxLQUFNLENBQUMsS0FBSyxDQUNoQyxDQUFDO29CQUNGLE1BQU0sYUFBYSxHQUFHLDRCQUE0QixDQUNoRCxTQUFTLEVBQ1Qsa0JBQWtCLEVBQ2xCLFNBQVMsRUFDVCxFQUFDLGNBQWMsRUFBQyxDQUNqQixDQUFDO29CQUNGLG9CQUFvQixDQUNsQixrQkFBa0IsRUFDbEIsYUFBYSxFQUNiLENBQUMsRUFDRCxrQkFBa0IsQ0FBQyxrQkFBa0IsRUFBRSxjQUFjLENBQUMsQ0FDdkQsQ0FBQztnQkFDSixDQUFDO3FCQUFNLENBQUM7b0JBQ04seUJBQXlCLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ25ELENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7WUFBUyxDQUFDO1FBQ1QsaUJBQWlCLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDbEMsQ0FBQztBQUNILENBQUM7QUFFRCxTQUFTLGFBQWEsQ0FBQyxLQUFZLEVBQUUsS0FBYTtJQUNoRCxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDaEMsU0FBUyxJQUFJLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBRTFDLE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUM7QUFFRCxTQUFTLGtCQUFrQixDQUFJLFVBQXNCLEVBQUUsS0FBYTtJQUNsRSxNQUFNLGFBQWEsR0FBRyxVQUFVLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3BELFNBQVMsSUFBSSxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUM7SUFFeEMsT0FBTyxhQUF5QixDQUFDO0FBQ25DLENBQUM7QUFFRCxTQUFTLDhCQUE4QixDQUFJLFVBQXNCLEVBQUUsS0FBYTtJQUM5RSxNQUFNLGFBQWEsR0FBRyxzQkFBc0IsQ0FBSSxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDbkUsU0FBUyxJQUFJLFdBQVcsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUV4QyxPQUFPLGFBQWMsQ0FBQztBQUN4QixDQUFDO0FBRUQsU0FBUyxnQkFBZ0IsQ0FBQyxLQUFZLEVBQUUsS0FBYTtJQUNuRCxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3JDLFNBQVMsSUFBSSxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7SUFFaEMsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7c2V0QWN0aXZlQ29uc3VtZXJ9IGZyb20gJ0Bhbmd1bGFyL2NvcmUvcHJpbWl0aXZlcy9zaWduYWxzJztcblxuaW1wb3J0IHtUcmFja0J5RnVuY3Rpb259IGZyb20gJy4uLy4uL2NoYW5nZV9kZXRlY3Rpb24nO1xuaW1wb3J0IHtmb3JtYXRSdW50aW1lRXJyb3IsIFJ1bnRpbWVFcnJvckNvZGV9IGZyb20gJy4uLy4uL2Vycm9ycyc7XG5pbXBvcnQge0RlaHlkcmF0ZWRDb250YWluZXJWaWV3fSBmcm9tICcuLi8uLi9oeWRyYXRpb24vaW50ZXJmYWNlcyc7XG5pbXBvcnQge2ZpbmRNYXRjaGluZ0RlaHlkcmF0ZWRWaWV3fSBmcm9tICcuLi8uLi9oeWRyYXRpb24vdmlld3MnO1xuaW1wb3J0IHthc3NlcnREZWZpbmVkLCBhc3NlcnRGdW5jdGlvbn0gZnJvbSAnLi4vLi4vdXRpbC9hc3NlcnQnO1xuaW1wb3J0IHtwZXJmb3JtYW5jZU1hcmtGZWF0dXJlfSBmcm9tICcuLi8uLi91dGlsL3BlcmZvcm1hbmNlJztcbmltcG9ydCB7YXNzZXJ0TENvbnRhaW5lciwgYXNzZXJ0TFZpZXcsIGFzc2VydFROb2RlfSBmcm9tICcuLi9hc3NlcnQnO1xuaW1wb3J0IHtiaW5kaW5nVXBkYXRlZH0gZnJvbSAnLi4vYmluZGluZ3MnO1xuaW1wb3J0IHtDT05UQUlORVJfSEVBREVSX09GRlNFVCwgTENvbnRhaW5lcn0gZnJvbSAnLi4vaW50ZXJmYWNlcy9jb250YWluZXInO1xuaW1wb3J0IHtDb21wb25lbnRUZW1wbGF0ZX0gZnJvbSAnLi4vaW50ZXJmYWNlcy9kZWZpbml0aW9uJztcbmltcG9ydCB7VE5vZGV9IGZyb20gJy4uL2ludGVyZmFjZXMvbm9kZSc7XG5pbXBvcnQge1xuICBDT05URVhULFxuICBERUNMQVJBVElPTl9DT01QT05FTlRfVklFVyxcbiAgSEVBREVSX09GRlNFVCxcbiAgSFlEUkFUSU9OLFxuICBMVmlldyxcbiAgVFZJRVcsXG4gIFRWaWV3LFxufSBmcm9tICcuLi9pbnRlcmZhY2VzL3ZpZXcnO1xuaW1wb3J0IHtMaXZlQ29sbGVjdGlvbiwgcmVjb25jaWxlfSBmcm9tICcuLi9saXN0X3JlY29uY2lsaWF0aW9uJztcbmltcG9ydCB7ZGVzdHJveUxWaWV3LCBkZXRhY2hWaWV3fSBmcm9tICcuLi9ub2RlX21hbmlwdWxhdGlvbic7XG5pbXBvcnQge2dldExWaWV3LCBnZXRTZWxlY3RlZEluZGV4LCBnZXRUVmlldywgbmV4dEJpbmRpbmdJbmRleH0gZnJvbSAnLi4vc3RhdGUnO1xuaW1wb3J0IHtOT19DSEFOR0V9IGZyb20gJy4uL3Rva2Vucyc7XG5pbXBvcnQge2dldENvbnN0YW50LCBnZXRUTm9kZX0gZnJvbSAnLi4vdXRpbC92aWV3X3V0aWxzJztcbmltcG9ydCB7XG4gIGFkZExWaWV3VG9MQ29udGFpbmVyLFxuICBjcmVhdGVBbmRSZW5kZXJFbWJlZGRlZExWaWV3LFxuICBnZXRMVmlld0Zyb21MQ29udGFpbmVyLFxuICByZW1vdmVMVmlld0Zyb21MQ29udGFpbmVyLFxuICBzaG91bGRBZGRWaWV3VG9Eb20sXG59IGZyb20gJy4uL3ZpZXdfbWFuaXB1bGF0aW9uJztcblxuaW1wb3J0IHtkZWNsYXJlVGVtcGxhdGV9IGZyb20gJy4vdGVtcGxhdGUnO1xuXG4vKipcbiAqIFRoZSBjb25kaXRpb25hbCBpbnN0cnVjdGlvbiByZXByZXNlbnRzIHRoZSBiYXNpYyBidWlsZGluZyBibG9jayBvbiB0aGUgcnVudGltZSBzaWRlIHRvIHN1cHBvcnRcbiAqIGJ1aWx0LWluIFwiaWZcIiBhbmQgXCJzd2l0Y2hcIi4gT24gdGhlIGhpZ2ggbGV2ZWwgdGhpcyBpbnN0cnVjdGlvbiBpcyByZXNwb25zaWJsZSBmb3IgYWRkaW5nIGFuZFxuICogcmVtb3Zpbmcgdmlld3Mgc2VsZWN0ZWQgYnkgYSBjb25kaXRpb25hbCBleHByZXNzaW9uLlxuICpcbiAqIEBwYXJhbSBtYXRjaGluZ1RlbXBsYXRlSW5kZXggSW5kZXggb2YgYSB0ZW1wbGF0ZSBUTm9kZSByZXByZXNlbnRpbmcgYSBjb25kaXRpb25hbCB2aWV3IHRvIGJlXG4gKiAgICAgaW5zZXJ0ZWQ7IC0xIHJlcHJlc2VudHMgYSBzcGVjaWFsIGNhc2Ugd2hlbiB0aGVyZSBpcyBubyB2aWV3IHRvIGluc2VydC5cbiAqIEBwYXJhbSBjb250ZXh0VmFsdWUgVmFsdWUgdGhhdCBzaG91bGQgYmUgZXhwb3NlZCBhcyB0aGUgY29udGV4dCBvZiB0aGUgY29uZGl0aW9uYWwuXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtWNvbmRpdGlvbmFsPFQ+KG1hdGNoaW5nVGVtcGxhdGVJbmRleDogbnVtYmVyLCBjb250ZXh0VmFsdWU/OiBUKSB7XG4gIHBlcmZvcm1hbmNlTWFya0ZlYXR1cmUoJ05nQ29udHJvbEZsb3cnKTtcblxuICBjb25zdCBob3N0TFZpZXcgPSBnZXRMVmlldygpO1xuICBjb25zdCBiaW5kaW5nSW5kZXggPSBuZXh0QmluZGluZ0luZGV4KCk7XG4gIGNvbnN0IHByZXZNYXRjaGluZ1RlbXBsYXRlSW5kZXg6IG51bWJlciA9XG4gICAgaG9zdExWaWV3W2JpbmRpbmdJbmRleF0gIT09IE5PX0NIQU5HRSA/IGhvc3RMVmlld1tiaW5kaW5nSW5kZXhdIDogLTE7XG4gIGNvbnN0IHByZXZDb250YWluZXIgPVxuICAgIHByZXZNYXRjaGluZ1RlbXBsYXRlSW5kZXggIT09IC0xXG4gICAgICA/IGdldExDb250YWluZXIoaG9zdExWaWV3LCBIRUFERVJfT0ZGU0VUICsgcHJldk1hdGNoaW5nVGVtcGxhdGVJbmRleClcbiAgICAgIDogdW5kZWZpbmVkO1xuICBjb25zdCB2aWV3SW5Db250YWluZXJJZHggPSAwO1xuXG4gIGlmIChiaW5kaW5nVXBkYXRlZChob3N0TFZpZXcsIGJpbmRpbmdJbmRleCwgbWF0Y2hpbmdUZW1wbGF0ZUluZGV4KSkge1xuICAgIGNvbnN0IHByZXZDb25zdW1lciA9IHNldEFjdGl2ZUNvbnN1bWVyKG51bGwpO1xuICAgIHRyeSB7XG4gICAgICAvLyBUaGUgaW5kZXggb2YgdGhlIHZpZXcgdG8gc2hvdyBjaGFuZ2VkIC0gcmVtb3ZlIHRoZSBwcmV2aW91c2x5IGRpc3BsYXllZCBvbmVcbiAgICAgIC8vIChpdCBpcyBhIG5vb3AgaWYgdGhlcmUgYXJlIG5vIGFjdGl2ZSB2aWV3cyBpbiBhIGNvbnRhaW5lcikuXG4gICAgICBpZiAocHJldkNvbnRhaW5lciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJlbW92ZUxWaWV3RnJvbUxDb250YWluZXIocHJldkNvbnRhaW5lciwgdmlld0luQ29udGFpbmVySWR4KTtcbiAgICAgIH1cblxuICAgICAgLy8gSW5kZXggLTEgaXMgYSBzcGVjaWFsIGNhc2Ugd2hlcmUgbm9uZSBvZiB0aGUgY29uZGl0aW9ucyBldmFsdWF0ZXMgdG9cbiAgICAgIC8vIGEgdHJ1dGh5IHZhbHVlIGFuZCBhcyB0aGUgY29uc2VxdWVuY2Ugd2UndmUgZ290IG5vIHZpZXcgdG8gc2hvdy5cbiAgICAgIGlmIChtYXRjaGluZ1RlbXBsYXRlSW5kZXggIT09IC0xKSB7XG4gICAgICAgIGNvbnN0IG5leHRMQ29udGFpbmVySW5kZXggPSBIRUFERVJfT0ZGU0VUICsgbWF0Y2hpbmdUZW1wbGF0ZUluZGV4O1xuICAgICAgICBjb25zdCBuZXh0Q29udGFpbmVyID0gZ2V0TENvbnRhaW5lcihob3N0TFZpZXcsIG5leHRMQ29udGFpbmVySW5kZXgpO1xuICAgICAgICBjb25zdCB0ZW1wbGF0ZVROb2RlID0gZ2V0RXhpc3RpbmdUTm9kZShob3N0TFZpZXdbVFZJRVddLCBuZXh0TENvbnRhaW5lckluZGV4KTtcblxuICAgICAgICBjb25zdCBkZWh5ZHJhdGVkVmlldyA9IGZpbmRNYXRjaGluZ0RlaHlkcmF0ZWRWaWV3KFxuICAgICAgICAgIG5leHRDb250YWluZXIsXG4gICAgICAgICAgdGVtcGxhdGVUTm9kZS50VmlldyEuc3NySWQsXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IGVtYmVkZGVkTFZpZXcgPSBjcmVhdGVBbmRSZW5kZXJFbWJlZGRlZExWaWV3KGhvc3RMVmlldywgdGVtcGxhdGVUTm9kZSwgY29udGV4dFZhbHVlLCB7XG4gICAgICAgICAgZGVoeWRyYXRlZFZpZXcsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGFkZExWaWV3VG9MQ29udGFpbmVyKFxuICAgICAgICAgIG5leHRDb250YWluZXIsXG4gICAgICAgICAgZW1iZWRkZWRMVmlldyxcbiAgICAgICAgICB2aWV3SW5Db250YWluZXJJZHgsXG4gICAgICAgICAgc2hvdWxkQWRkVmlld1RvRG9tKHRlbXBsYXRlVE5vZGUsIGRlaHlkcmF0ZWRWaWV3KSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0QWN0aXZlQ29uc3VtZXIocHJldkNvbnN1bWVyKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAocHJldkNvbnRhaW5lciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgLy8gV2UgbWlnaHQga2VlcCBkaXNwbGF5aW5nIHRoZSBzYW1lIHRlbXBsYXRlIGJ1dCB0aGUgYWN0dWFsIHZhbHVlIG9mIHRoZSBleHByZXNzaW9uIGNvdWxkIGhhdmVcbiAgICAvLyBjaGFuZ2VkIC0gcmUtYmluZCBpbiBjb250ZXh0LlxuICAgIGNvbnN0IGxWaWV3ID0gZ2V0TFZpZXdGcm9tTENvbnRhaW5lcjxUIHwgdW5kZWZpbmVkPihwcmV2Q29udGFpbmVyLCB2aWV3SW5Db250YWluZXJJZHgpO1xuICAgIGlmIChsVmlldyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsVmlld1tDT05URVhUXSA9IGNvbnRleHRWYWx1ZTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFJlcGVhdGVyQ29udGV4dDxUPiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgbENvbnRhaW5lcjogTENvbnRhaW5lcixcbiAgICBwdWJsaWMgJGltcGxpY2l0OiBULFxuICAgIHB1YmxpYyAkaW5kZXg6IG51bWJlcixcbiAgKSB7fVxuXG4gIGdldCAkY291bnQoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5sQ29udGFpbmVyLmxlbmd0aCAtIENPTlRBSU5FUl9IRUFERVJfT0ZGU0VUO1xuICB9XG59XG5cbi8qKlxuICogQSBidWlsdC1pbiB0cmFja0J5IGZ1bmN0aW9uIHVzZWQgZm9yIHNpdHVhdGlvbnMgd2hlcmUgdXNlcnMgc3BlY2lmaWVkIGNvbGxlY3Rpb24gaW5kZXggYXMgYVxuICogdHJhY2tpbmcgZXhwcmVzc2lvbi4gSGF2aW5nIHRoaXMgZnVuY3Rpb24gYm9keSBpbiB0aGUgcnVudGltZSBhdm9pZHMgdW5uZWNlc3NhcnkgY29kZSBnZW5lcmF0aW9uLlxuICpcbiAqIEBwYXJhbSBpbmRleFxuICogQHJldHVybnNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybVyZXBlYXRlclRyYWNrQnlJbmRleChpbmRleDogbnVtYmVyKSB7XG4gIHJldHVybiBpbmRleDtcbn1cblxuLyoqXG4gKiBBIGJ1aWx0LWluIHRyYWNrQnkgZnVuY3Rpb24gdXNlZCBmb3Igc2l0dWF0aW9ucyB3aGVyZSB1c2VycyBzcGVjaWZpZWQgY29sbGVjdGlvbiBpdGVtIHJlZmVyZW5jZVxuICogYXMgYSB0cmFja2luZyBleHByZXNzaW9uLiBIYXZpbmcgdGhpcyBmdW5jdGlvbiBib2R5IGluIHRoZSBydW50aW1lIGF2b2lkcyB1bm5lY2Vzc2FyeSBjb2RlXG4gKiBnZW5lcmF0aW9uLlxuICpcbiAqIEBwYXJhbSBpbmRleFxuICogQHJldHVybnNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybVyZXBlYXRlclRyYWNrQnlJZGVudGl0eTxUPihfOiBudW1iZXIsIHZhbHVlOiBUKSB7XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuY2xhc3MgUmVwZWF0ZXJNZXRhZGF0YSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyBoYXNFbXB0eUJsb2NrOiBib29sZWFuLFxuICAgIHB1YmxpYyB0cmFja0J5Rm46IFRyYWNrQnlGdW5jdGlvbjx1bmtub3duPixcbiAgICBwdWJsaWMgbGl2ZUNvbGxlY3Rpb24/OiBMaXZlQ29sbGVjdGlvbkxDb250YWluZXJJbXBsLFxuICApIHt9XG59XG5cbi8qKlxuICogVGhlIHJlcGVhdGVyQ3JlYXRlIGluc3RydWN0aW9uIHJ1bnMgaW4gdGhlIGNyZWF0aW9uIHBhcnQgb2YgdGhlIHRlbXBsYXRlIHBhc3MgYW5kIGluaXRpYWxpemVzXG4gKiBpbnRlcm5hbCBkYXRhIHN0cnVjdHVyZXMgcmVxdWlyZWQgYnkgdGhlIHVwZGF0ZSBwYXNzIG9mIHRoZSBidWlsdC1pbiByZXBlYXRlciBsb2dpYy4gUmVwZWF0ZXJcbiAqIG1ldGFkYXRhIGFyZSBhbGxvY2F0ZWQgaW4gdGhlIGRhdGEgcGFydCBvZiBMVmlldyB3aXRoIHRoZSBmb2xsb3dpbmcgbGF5b3V0OlxuICogLSBMVmlld1tIRUFERVJfT0ZGU0VUICsgaW5kZXhdIC0gbWV0YWRhdGFcbiAqIC0gTFZpZXdbSEVBREVSX09GRlNFVCArIGluZGV4ICsgMV0gLSByZWZlcmVuY2UgdG8gYSB0ZW1wbGF0ZSBmdW5jdGlvbiByZW5kZXJpbmcgYW4gaXRlbVxuICogLSBMVmlld1tIRUFERVJfT0ZGU0VUICsgaW5kZXggKyAyXSAtIG9wdGlvbmFsIHJlZmVyZW5jZSB0byBhIHRlbXBsYXRlIGZ1bmN0aW9uIHJlbmRlcmluZyBhbiBlbXB0eVxuICogYmxvY2tcbiAqXG4gKiBAcGFyYW0gaW5kZXggSW5kZXggYXQgd2hpY2ggdG8gc3RvcmUgdGhlIG1ldGFkYXRhIG9mIHRoZSByZXBlYXRlci5cbiAqIEBwYXJhbSB0ZW1wbGF0ZUZuIFJlZmVyZW5jZSB0byB0aGUgdGVtcGxhdGUgb2YgdGhlIG1haW4gcmVwZWF0ZXIgYmxvY2suXG4gKiBAcGFyYW0gZGVjbHMgVGhlIG51bWJlciBvZiBub2RlcywgbG9jYWwgcmVmcywgYW5kIHBpcGVzIGZvciB0aGUgbWFpbiBibG9jay5cbiAqIEBwYXJhbSB2YXJzIFRoZSBudW1iZXIgb2YgYmluZGluZ3MgZm9yIHRoZSBtYWluIGJsb2NrLlxuICogQHBhcmFtIHRhZ05hbWUgVGhlIG5hbWUgb2YgdGhlIGNvbnRhaW5lciBlbGVtZW50LCBpZiBhcHBsaWNhYmxlXG4gKiBAcGFyYW0gYXR0cnNJbmRleCBJbmRleCBvZiB0ZW1wbGF0ZSBhdHRyaWJ1dGVzIGluIHRoZSBgY29uc3RzYCBhcnJheS5cbiAqIEBwYXJhbSB0cmFja0J5Rm4gUmVmZXJlbmNlIHRvIHRoZSB0cmFja2luZyBmdW5jdGlvbi5cbiAqIEBwYXJhbSB0cmFja0J5VXNlc0NvbXBvbmVudEluc3RhbmNlIFdoZXRoZXIgdGhlIHRyYWNraW5nIGZ1bmN0aW9uIGhhcyBhbnkgcmVmZXJlbmNlcyB0byB0aGVcbiAqICBjb21wb25lbnQgaW5zdGFuY2UuIElmIGl0IGRvZXNuJ3QsIHdlIGNhbiBhdm9pZCByZWJpbmRpbmcgaXQuXG4gKiBAcGFyYW0gZW1wdHlUZW1wbGF0ZUZuIFJlZmVyZW5jZSB0byB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gb2YgdGhlIGVtcHR5IGJsb2NrLlxuICogQHBhcmFtIGVtcHR5RGVjbHMgVGhlIG51bWJlciBvZiBub2RlcywgbG9jYWwgcmVmcywgYW5kIHBpcGVzIGZvciB0aGUgZW1wdHkgYmxvY2suXG4gKiBAcGFyYW0gZW1wdHlWYXJzIFRoZSBudW1iZXIgb2YgYmluZGluZ3MgZm9yIHRoZSBlbXB0eSBibG9jay5cbiAqIEBwYXJhbSBlbXB0eVRhZ05hbWUgVGhlIG5hbWUgb2YgdGhlIGVtcHR5IGJsb2NrIGNvbnRhaW5lciBlbGVtZW50LCBpZiBhcHBsaWNhYmxlXG4gKiBAcGFyYW0gZW1wdHlBdHRyc0luZGV4IEluZGV4IG9mIHRoZSBlbXB0eSBibG9jayB0ZW1wbGF0ZSBhdHRyaWJ1dGVzIGluIHRoZSBgY29uc3RzYCBhcnJheS5cbiAqXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtXJlcGVhdGVyQ3JlYXRlKFxuICBpbmRleDogbnVtYmVyLFxuICB0ZW1wbGF0ZUZuOiBDb21wb25lbnRUZW1wbGF0ZTx1bmtub3duPixcbiAgZGVjbHM6IG51bWJlcixcbiAgdmFyczogbnVtYmVyLFxuICB0YWdOYW1lOiBzdHJpbmcgfCBudWxsLFxuICBhdHRyc0luZGV4OiBudW1iZXIgfCBudWxsLFxuICB0cmFja0J5Rm46IFRyYWNrQnlGdW5jdGlvbjx1bmtub3duPixcbiAgdHJhY2tCeVVzZXNDb21wb25lbnRJbnN0YW5jZT86IGJvb2xlYW4sXG4gIGVtcHR5VGVtcGxhdGVGbj86IENvbXBvbmVudFRlbXBsYXRlPHVua25vd24+LFxuICBlbXB0eURlY2xzPzogbnVtYmVyLFxuICBlbXB0eVZhcnM/OiBudW1iZXIsXG4gIGVtcHR5VGFnTmFtZT86IHN0cmluZyB8IG51bGwsXG4gIGVtcHR5QXR0cnNJbmRleD86IG51bWJlciB8IG51bGwsXG4pOiB2b2lkIHtcbiAgcGVyZm9ybWFuY2VNYXJrRmVhdHVyZSgnTmdDb250cm9sRmxvdycpO1xuXG4gIG5nRGV2TW9kZSAmJlxuICAgIGFzc2VydEZ1bmN0aW9uKFxuICAgICAgdHJhY2tCeUZuLFxuICAgICAgYEEgdHJhY2sgZXhwcmVzc2lvbiBtdXN0IGJlIGEgZnVuY3Rpb24sIHdhcyAke3R5cGVvZiB0cmFja0J5Rm59IGluc3RlYWQuYCxcbiAgICApO1xuXG4gIGNvbnN0IGxWaWV3ID0gZ2V0TFZpZXcoKTtcbiAgY29uc3QgdFZpZXcgPSBnZXRUVmlldygpO1xuICBjb25zdCBoYXNFbXB0eUJsb2NrID0gZW1wdHlUZW1wbGF0ZUZuICE9PSB1bmRlZmluZWQ7XG4gIGNvbnN0IGhvc3RMVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGJvdW5kVHJhY2tCeSA9IHRyYWNrQnlVc2VzQ29tcG9uZW50SW5zdGFuY2VcbiAgICA/IC8vIFdlIG9ubHkgd2FudCB0byBiaW5kIHdoZW4gbmVjZXNzYXJ5LCBiZWNhdXNlIGl0IHByb2R1Y2VzIGFcbiAgICAgIC8vIG5ldyBmdW5jdGlvbi4gRm9yIHB1cmUgZnVuY3Rpb25zIGl0J3Mgbm90IG5lY2Vzc2FyeS5cbiAgICAgIHRyYWNrQnlGbi5iaW5kKGhvc3RMVmlld1tERUNMQVJBVElPTl9DT01QT05FTlRfVklFV11bQ09OVEVYVF0pXG4gICAgOiB0cmFja0J5Rm47XG4gIGNvbnN0IG1ldGFkYXRhID0gbmV3IFJlcGVhdGVyTWV0YWRhdGEoaGFzRW1wdHlCbG9jaywgYm91bmRUcmFja0J5KTtcbiAgaG9zdExWaWV3W0hFQURFUl9PRkZTRVQgKyBpbmRleF0gPSBtZXRhZGF0YTtcblxuICBkZWNsYXJlVGVtcGxhdGUoXG4gICAgbFZpZXcsXG4gICAgdFZpZXcsXG4gICAgaW5kZXggKyAxLFxuICAgIHRlbXBsYXRlRm4sXG4gICAgZGVjbHMsXG4gICAgdmFycyxcbiAgICB0YWdOYW1lLFxuICAgIGdldENvbnN0YW50KHRWaWV3LmNvbnN0cywgYXR0cnNJbmRleCksXG4gICk7XG5cbiAgaWYgKGhhc0VtcHR5QmxvY2spIHtcbiAgICBuZ0Rldk1vZGUgJiZcbiAgICAgIGFzc2VydERlZmluZWQoZW1wdHlEZWNscywgJ01pc3NpbmcgbnVtYmVyIG9mIGRlY2xhcmF0aW9ucyBmb3IgdGhlIGVtcHR5IHJlcGVhdGVyIGJsb2NrLicpO1xuICAgIG5nRGV2TW9kZSAmJlxuICAgICAgYXNzZXJ0RGVmaW5lZChlbXB0eVZhcnMsICdNaXNzaW5nIG51bWJlciBvZiBiaW5kaW5ncyBmb3IgdGhlIGVtcHR5IHJlcGVhdGVyIGJsb2NrLicpO1xuXG4gICAgZGVjbGFyZVRlbXBsYXRlKFxuICAgICAgbFZpZXcsXG4gICAgICB0VmlldyxcbiAgICAgIGluZGV4ICsgMixcbiAgICAgIGVtcHR5VGVtcGxhdGVGbixcbiAgICAgIGVtcHR5RGVjbHMhLFxuICAgICAgZW1wdHlWYXJzISxcbiAgICAgIGVtcHR5VGFnTmFtZSxcbiAgICAgIGdldENvbnN0YW50KHRWaWV3LmNvbnN0cywgZW1wdHlBdHRyc0luZGV4KSxcbiAgICApO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzVmlld0V4cGVuc2l2ZVRvUmVjcmVhdGUobFZpZXc6IExWaWV3KTogYm9vbGVhbiB7XG4gIC8vIGFzc3VtcHRpb246IGFueXRoaW5nIG1vcmUgdGhhbiBhIHRleHQgbm9kZSB3aXRoIGEgYmluZGluZyBpcyBjb25zaWRlcmVkIFwiZXhwZW5zaXZlXCJcbiAgcmV0dXJuIGxWaWV3Lmxlbmd0aCAtIEhFQURFUl9PRkZTRVQgPiAyO1xufVxuXG5jbGFzcyBPcGVyYXRpb25zQ291bnRlciB7XG4gIGNyZWF0ZWQgPSAwO1xuICBkZXN0cm95ZWQgPSAwO1xuXG4gIHJlc2V0KCkge1xuICAgIHRoaXMuY3JlYXRlZCA9IDA7XG4gICAgdGhpcy5kZXN0cm95ZWQgPSAwO1xuICB9XG5cbiAgcmVjb3JkQ3JlYXRlKCkge1xuICAgIHRoaXMuY3JlYXRlZCsrO1xuICB9XG5cbiAgcmVjb3JkRGVzdHJveSgpIHtcbiAgICB0aGlzLmRlc3Ryb3llZCsrO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgbWV0aG9kIGluZGljYXRpbmcgaWYgdGhlIGVudGlyZSBjb2xsZWN0aW9uIHdhcyByZS1jcmVhdGVkIGFzIHBhcnQgb2YgdGhlIHJlY29uY2lsaWF0aW9uIHBhc3MuXG4gICAqIFVzZWQgdG8gd2FybiBkZXZlbG9wZXJzIGFib3V0IHRoZSB1c2FnZSBvZiBhIHRyYWNraW5nIGZ1bmN0aW9uIHRoYXQgbWlnaHQgcmVzdWx0IGluIGV4Y2Vzc2l2ZVxuICAgKiBhbW91bnQgb2YgdmlldyBjcmVhdGlvbiAvIGRlc3Ryb3kgb3BlcmF0aW9ucy5cbiAgICpcbiAgICogQHJldHVybnMgYm9vbGVhbiB2YWx1ZSBpbmRpY2F0aW5nIGlmIGEgbGl2ZSBjb2xsZWN0aW9uIHdhcyByZS1jcmVhdGVkXG4gICAqL1xuICB3YXNSZUNyZWF0ZWQoY29sbGVjdGlvbkxlbjogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGNvbGxlY3Rpb25MZW4gPiAwICYmIHRoaXMuY3JlYXRlZCA9PT0gdGhpcy5kZXN0cm95ZWQgJiYgdGhpcy5jcmVhdGVkID09PSBjb2xsZWN0aW9uTGVuO1xuICB9XG59XG5cbmNsYXNzIExpdmVDb2xsZWN0aW9uTENvbnRhaW5lckltcGwgZXh0ZW5kcyBMaXZlQ29sbGVjdGlvbjxcbiAgTFZpZXc8UmVwZWF0ZXJDb250ZXh0PHVua25vd24+PixcbiAgdW5rbm93blxuPiB7XG4gIG9wZXJhdGlvbnNDb3VudGVyID0gbmdEZXZNb2RlID8gbmV3IE9wZXJhdGlvbnNDb3VudGVyKCkgOiB1bmRlZmluZWQ7XG5cbiAgLyoqXG4gICBQcm9wZXJ0eSBpbmRpY2F0aW5nIGlmIGluZGV4ZXMgaW4gdGhlIHJlcGVhdGVyIGNvbnRleHQgbmVlZCB0byBiZSB1cGRhdGVkIGZvbGxvd2luZyB0aGUgbGl2ZVxuICAgY29sbGVjdGlvbiBjaGFuZ2VzLiBJbmRleCB1cGRhdGVzIGFyZSBuZWNlc3NhcnkgaWYgYW5kIG9ubHkgaWYgdmlld3MgYXJlIGluc2VydGVkIC8gcmVtb3ZlZCBpblxuICAgdGhlIG1pZGRsZSBvZiBMQ29udGFpbmVyLiBBZGRzIGFuZCByZW1vdmFscyBhdCB0aGUgZW5kIGRvbid0IHJlcXVpcmUgaW5kZXggdXBkYXRlcy5cbiAqL1xuICBwcml2YXRlIG5lZWRzSW5kZXhVcGRhdGUgPSBmYWxzZTtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBsQ29udGFpbmVyOiBMQ29udGFpbmVyLFxuICAgIHByaXZhdGUgaG9zdExWaWV3OiBMVmlldyxcbiAgICBwcml2YXRlIHRlbXBsYXRlVE5vZGU6IFROb2RlLFxuICApIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgb3ZlcnJpZGUgZ2V0IGxlbmd0aCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmxDb250YWluZXIubGVuZ3RoIC0gQ09OVEFJTkVSX0hFQURFUl9PRkZTRVQ7XG4gIH1cbiAgb3ZlcnJpZGUgYXQoaW5kZXg6IG51bWJlcik6IHVua25vd24ge1xuICAgIHJldHVybiB0aGlzLmdldExWaWV3KGluZGV4KVtDT05URVhUXS4kaW1wbGljaXQ7XG4gIH1cbiAgb3ZlcnJpZGUgYXR0YWNoKGluZGV4OiBudW1iZXIsIGxWaWV3OiBMVmlldzxSZXBlYXRlckNvbnRleHQ8dW5rbm93bj4+KTogdm9pZCB7XG4gICAgY29uc3QgZGVoeWRyYXRlZFZpZXcgPSBsVmlld1tIWURSQVRJT05dIGFzIERlaHlkcmF0ZWRDb250YWluZXJWaWV3O1xuICAgIHRoaXMubmVlZHNJbmRleFVwZGF0ZSB8fD0gaW5kZXggIT09IHRoaXMubGVuZ3RoO1xuICAgIGFkZExWaWV3VG9MQ29udGFpbmVyKFxuICAgICAgdGhpcy5sQ29udGFpbmVyLFxuICAgICAgbFZpZXcsXG4gICAgICBpbmRleCxcbiAgICAgIHNob3VsZEFkZFZpZXdUb0RvbSh0aGlzLnRlbXBsYXRlVE5vZGUsIGRlaHlkcmF0ZWRWaWV3KSxcbiAgICApO1xuICB9XG4gIG92ZXJyaWRlIGRldGFjaChpbmRleDogbnVtYmVyKTogTFZpZXc8UmVwZWF0ZXJDb250ZXh0PHVua25vd24+PiB7XG4gICAgdGhpcy5uZWVkc0luZGV4VXBkYXRlIHx8PSBpbmRleCAhPT0gdGhpcy5sZW5ndGggLSAxO1xuICAgIHJldHVybiBkZXRhY2hFeGlzdGluZ1ZpZXc8UmVwZWF0ZXJDb250ZXh0PHVua25vd24+Pih0aGlzLmxDb250YWluZXIsIGluZGV4KTtcbiAgfVxuICBvdmVycmlkZSBjcmVhdGUoaW5kZXg6IG51bWJlciwgdmFsdWU6IHVua25vd24pOiBMVmlldzxSZXBlYXRlckNvbnRleHQ8dW5rbm93bj4+IHtcbiAgICBjb25zdCBkZWh5ZHJhdGVkVmlldyA9IGZpbmRNYXRjaGluZ0RlaHlkcmF0ZWRWaWV3KFxuICAgICAgdGhpcy5sQ29udGFpbmVyLFxuICAgICAgdGhpcy50ZW1wbGF0ZVROb2RlLnRWaWV3IS5zc3JJZCxcbiAgICApO1xuICAgIGNvbnN0IGVtYmVkZGVkTFZpZXcgPSBjcmVhdGVBbmRSZW5kZXJFbWJlZGRlZExWaWV3KFxuICAgICAgdGhpcy5ob3N0TFZpZXcsXG4gICAgICB0aGlzLnRlbXBsYXRlVE5vZGUsXG4gICAgICBuZXcgUmVwZWF0ZXJDb250ZXh0KHRoaXMubENvbnRhaW5lciwgdmFsdWUsIGluZGV4KSxcbiAgICAgIHtkZWh5ZHJhdGVkVmlld30sXG4gICAgKTtcbiAgICB0aGlzLm9wZXJhdGlvbnNDb3VudGVyPy5yZWNvcmRDcmVhdGUoKTtcblxuICAgIHJldHVybiBlbWJlZGRlZExWaWV3O1xuICB9XG4gIG92ZXJyaWRlIGRlc3Ryb3kobFZpZXc6IExWaWV3PFJlcGVhdGVyQ29udGV4dDx1bmtub3duPj4pOiB2b2lkIHtcbiAgICBkZXN0cm95TFZpZXcobFZpZXdbVFZJRVddLCBsVmlldyk7XG4gICAgdGhpcy5vcGVyYXRpb25zQ291bnRlcj8ucmVjb3JkRGVzdHJveSgpO1xuICB9XG4gIG92ZXJyaWRlIHVwZGF0ZVZhbHVlKGluZGV4OiBudW1iZXIsIHZhbHVlOiB1bmtub3duKTogdm9pZCB7XG4gICAgdGhpcy5nZXRMVmlldyhpbmRleClbQ09OVEVYVF0uJGltcGxpY2l0ID0gdmFsdWU7XG4gIH1cblxuICByZXNldCgpOiB2b2lkIHtcbiAgICB0aGlzLm5lZWRzSW5kZXhVcGRhdGUgPSBmYWxzZTtcbiAgICB0aGlzLm9wZXJhdGlvbnNDb3VudGVyPy5yZXNldCgpO1xuICB9XG5cbiAgdXBkYXRlSW5kZXhlcygpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5uZWVkc0luZGV4VXBkYXRlKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGhpcy5nZXRMVmlldyhpKVtDT05URVhUXS4kaW5kZXggPSBpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0TFZpZXcoaW5kZXg6IG51bWJlcik6IExWaWV3PFJlcGVhdGVyQ29udGV4dDx1bmtub3duPj4ge1xuICAgIHJldHVybiBnZXRFeGlzdGluZ0xWaWV3RnJvbUxDb250YWluZXIodGhpcy5sQ29udGFpbmVyLCBpbmRleCk7XG4gIH1cbn1cblxuLyoqXG4gKiBUaGUgcmVwZWF0ZXIgaW5zdHJ1Y3Rpb24gZG9lcyB1cGRhdGUtdGltZSBkaWZmaW5nIG9mIGEgcHJvdmlkZWQgY29sbGVjdGlvbiAoYWdhaW5zdCB0aGVcbiAqIGNvbGxlY3Rpb24gc2VlbiBwcmV2aW91c2x5KSBhbmQgbWFwcyBjaGFuZ2VzIGluIHRoZSBjb2xsZWN0aW9uIHRvIHZpZXdzIHN0cnVjdHVyZSAoYnkgYWRkaW5nLFxuICogcmVtb3Zpbmcgb3IgbW92aW5nIHZpZXdzIGFzIG5lZWRlZCkuXG4gKiBAcGFyYW0gY29sbGVjdGlvbiAtIHRoZSBjb2xsZWN0aW9uIGluc3RhbmNlIHRvIGJlIGNoZWNrZWQgZm9yIGNoYW5nZXNcbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1cmVwZWF0ZXIoY29sbGVjdGlvbjogSXRlcmFibGU8dW5rbm93bj4gfCB1bmRlZmluZWQgfCBudWxsKTogdm9pZCB7XG4gIGNvbnN0IHByZXZDb25zdW1lciA9IHNldEFjdGl2ZUNvbnN1bWVyKG51bGwpO1xuICBjb25zdCBtZXRhZGF0YVNsb3RJZHggPSBnZXRTZWxlY3RlZEluZGV4KCk7XG4gIHRyeSB7XG4gICAgY29uc3QgaG9zdExWaWV3ID0gZ2V0TFZpZXcoKTtcbiAgICBjb25zdCBob3N0VFZpZXcgPSBob3N0TFZpZXdbVFZJRVddO1xuICAgIGNvbnN0IG1ldGFkYXRhID0gaG9zdExWaWV3W21ldGFkYXRhU2xvdElkeF0gYXMgUmVwZWF0ZXJNZXRhZGF0YTtcbiAgICBjb25zdCBjb250YWluZXJJbmRleCA9IG1ldGFkYXRhU2xvdElkeCArIDE7XG4gICAgY29uc3QgbENvbnRhaW5lciA9IGdldExDb250YWluZXIoaG9zdExWaWV3LCBjb250YWluZXJJbmRleCk7XG5cbiAgICBpZiAobWV0YWRhdGEubGl2ZUNvbGxlY3Rpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgaXRlbVRlbXBsYXRlVE5vZGUgPSBnZXRFeGlzdGluZ1ROb2RlKGhvc3RUVmlldywgY29udGFpbmVySW5kZXgpO1xuICAgICAgbWV0YWRhdGEubGl2ZUNvbGxlY3Rpb24gPSBuZXcgTGl2ZUNvbGxlY3Rpb25MQ29udGFpbmVySW1wbChcbiAgICAgICAgbENvbnRhaW5lcixcbiAgICAgICAgaG9zdExWaWV3LFxuICAgICAgICBpdGVtVGVtcGxhdGVUTm9kZSxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1ldGFkYXRhLmxpdmVDb2xsZWN0aW9uLnJlc2V0KCk7XG4gICAgfVxuXG4gICAgY29uc3QgbGl2ZUNvbGxlY3Rpb24gPSBtZXRhZGF0YS5saXZlQ29sbGVjdGlvbjtcbiAgICByZWNvbmNpbGUobGl2ZUNvbGxlY3Rpb24sIGNvbGxlY3Rpb24sIG1ldGFkYXRhLnRyYWNrQnlGbik7XG5cbiAgICAvLyBXYXJuIGRldmVsb3BlcnMgYWJvdXQgc2l0dWF0aW9ucyB3aGVyZSB0aGUgZW50aXJlIGNvbGxlY3Rpb24gd2FzIHJlLWNyZWF0ZWQgYXMgcGFydCBvZiB0aGVcbiAgICAvLyByZWNvbmNpbGlhdGlvbiBwYXNzLiBOb3RlIHRoYXQgdGhpcyB3YXJuaW5nIG1pZ2h0IGJlIFwib3ZlcnJlYWN0aW5nXCIgYW5kIHJlcG9ydCBjYXNlcyB3aGVyZVxuICAgIC8vIHRoZSBjb2xsZWN0aW9uIHJlLWNyZWF0aW9uIGlzIHRoZSBpbnRlbmRlZCBiZWhhdmlvci4gU3RpbGwsIHRoZSBhc3N1bXB0aW9uIGlzIHRoYXQgbW9zdCBvZlxuICAgIC8vIHRoZSB0aW1lIGl0IGlzIHVuZGVzaXJlZC5cbiAgICBpZiAoXG4gICAgICBuZ0Rldk1vZGUgJiZcbiAgICAgIG1ldGFkYXRhLnRyYWNrQnlGbiA9PT0gybXJtXJlcGVhdGVyVHJhY2tCeUlkZW50aXR5ICYmXG4gICAgICBsaXZlQ29sbGVjdGlvbi5vcGVyYXRpb25zQ291bnRlcj8ud2FzUmVDcmVhdGVkKGxpdmVDb2xsZWN0aW9uLmxlbmd0aCkgJiZcbiAgICAgIGlzVmlld0V4cGVuc2l2ZVRvUmVjcmVhdGUoZ2V0RXhpc3RpbmdMVmlld0Zyb21MQ29udGFpbmVyKGxDb250YWluZXIsIDApKVxuICAgICkge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IGZvcm1hdFJ1bnRpbWVFcnJvcihcbiAgICAgICAgUnVudGltZUVycm9yQ29kZS5MT09QX1RSQUNLX1JFQ1JFQVRFLFxuICAgICAgICBgVGhlIGNvbmZpZ3VyZWQgdHJhY2tpbmcgZXhwcmVzc2lvbiAodHJhY2sgYnkgaWRlbnRpdHkpIGNhdXNlZCByZS1jcmVhdGlvbiBvZiB0aGUgZW50aXJlIGNvbGxlY3Rpb24gb2Ygc2l6ZSAke2xpdmVDb2xsZWN0aW9uLmxlbmd0aH0uIGAgK1xuICAgICAgICAgICdUaGlzIGlzIGFuIGV4cGVuc2l2ZSBvcGVyYXRpb24gcmVxdWlyaW5nIGRlc3RydWN0aW9uIGFuZCBzdWJzZXF1ZW50IGNyZWF0aW9uIG9mIERPTSBub2RlcywgZGlyZWN0aXZlcywgY29tcG9uZW50cyBldGMuICcgK1xuICAgICAgICAgICdQbGVhc2UgcmV2aWV3IHRoZSBcInRyYWNrIGV4cHJlc3Npb25cIiBhbmQgbWFrZSBzdXJlIHRoYXQgaXQgdW5pcXVlbHkgaWRlbnRpZmllcyBpdGVtcyBpbiBhIGNvbGxlY3Rpb24uJyxcbiAgICAgICk7XG4gICAgICBjb25zb2xlLndhcm4obWVzc2FnZSk7XG4gICAgfVxuXG4gICAgLy8gbW92ZXMgaW4gdGhlIGNvbnRhaW5lciBtaWdodCBjYXVzZWQgY29udGV4dCdzIGluZGV4IHRvIGdldCBvdXQgb2Ygb3JkZXIsIHJlLWFkanVzdCBpZiBuZWVkZWRcbiAgICBsaXZlQ29sbGVjdGlvbi51cGRhdGVJbmRleGVzKCk7XG5cbiAgICAvLyBoYW5kbGUgZW1wdHkgYmxvY2tzXG4gICAgaWYgKG1ldGFkYXRhLmhhc0VtcHR5QmxvY2spIHtcbiAgICAgIGNvbnN0IGJpbmRpbmdJbmRleCA9IG5leHRCaW5kaW5nSW5kZXgoKTtcbiAgICAgIGNvbnN0IGlzQ29sbGVjdGlvbkVtcHR5ID0gbGl2ZUNvbGxlY3Rpb24ubGVuZ3RoID09PSAwO1xuICAgICAgaWYgKGJpbmRpbmdVcGRhdGVkKGhvc3RMVmlldywgYmluZGluZ0luZGV4LCBpc0NvbGxlY3Rpb25FbXB0eSkpIHtcbiAgICAgICAgY29uc3QgZW1wdHlUZW1wbGF0ZUluZGV4ID0gbWV0YWRhdGFTbG90SWR4ICsgMjtcbiAgICAgICAgY29uc3QgbENvbnRhaW5lckZvckVtcHR5ID0gZ2V0TENvbnRhaW5lcihob3N0TFZpZXcsIGVtcHR5VGVtcGxhdGVJbmRleCk7XG4gICAgICAgIGlmIChpc0NvbGxlY3Rpb25FbXB0eSkge1xuICAgICAgICAgIGNvbnN0IGVtcHR5VGVtcGxhdGVUTm9kZSA9IGdldEV4aXN0aW5nVE5vZGUoaG9zdFRWaWV3LCBlbXB0eVRlbXBsYXRlSW5kZXgpO1xuICAgICAgICAgIGNvbnN0IGRlaHlkcmF0ZWRWaWV3ID0gZmluZE1hdGNoaW5nRGVoeWRyYXRlZFZpZXcoXG4gICAgICAgICAgICBsQ29udGFpbmVyRm9yRW1wdHksXG4gICAgICAgICAgICBlbXB0eVRlbXBsYXRlVE5vZGUudFZpZXchLnNzcklkLFxuICAgICAgICAgICk7XG4gICAgICAgICAgY29uc3QgZW1iZWRkZWRMVmlldyA9IGNyZWF0ZUFuZFJlbmRlckVtYmVkZGVkTFZpZXcoXG4gICAgICAgICAgICBob3N0TFZpZXcsXG4gICAgICAgICAgICBlbXB0eVRlbXBsYXRlVE5vZGUsXG4gICAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgICB7ZGVoeWRyYXRlZFZpZXd9LFxuICAgICAgICAgICk7XG4gICAgICAgICAgYWRkTFZpZXdUb0xDb250YWluZXIoXG4gICAgICAgICAgICBsQ29udGFpbmVyRm9yRW1wdHksXG4gICAgICAgICAgICBlbWJlZGRlZExWaWV3LFxuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIHNob3VsZEFkZFZpZXdUb0RvbShlbXB0eVRlbXBsYXRlVE5vZGUsIGRlaHlkcmF0ZWRWaWV3KSxcbiAgICAgICAgICApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlbW92ZUxWaWV3RnJvbUxDb250YWluZXIobENvbnRhaW5lckZvckVtcHR5LCAwKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICBzZXRBY3RpdmVDb25zdW1lcihwcmV2Q29uc3VtZXIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldExDb250YWluZXIobFZpZXc6IExWaWV3LCBpbmRleDogbnVtYmVyKTogTENvbnRhaW5lciB7XG4gIGNvbnN0IGxDb250YWluZXIgPSBsVmlld1tpbmRleF07XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnRMQ29udGFpbmVyKGxDb250YWluZXIpO1xuXG4gIHJldHVybiBsQ29udGFpbmVyO1xufVxuXG5mdW5jdGlvbiBkZXRhY2hFeGlzdGluZ1ZpZXc8VD4obENvbnRhaW5lcjogTENvbnRhaW5lciwgaW5kZXg6IG51bWJlcik6IExWaWV3PFQ+IHtcbiAgY29uc3QgZXhpc3RpbmdMVmlldyA9IGRldGFjaFZpZXcobENvbnRhaW5lciwgaW5kZXgpO1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0TFZpZXcoZXhpc3RpbmdMVmlldyk7XG5cbiAgcmV0dXJuIGV4aXN0aW5nTFZpZXcgYXMgTFZpZXc8VD47XG59XG5cbmZ1bmN0aW9uIGdldEV4aXN0aW5nTFZpZXdGcm9tTENvbnRhaW5lcjxUPihsQ29udGFpbmVyOiBMQ29udGFpbmVyLCBpbmRleDogbnVtYmVyKTogTFZpZXc8VD4ge1xuICBjb25zdCBleGlzdGluZ0xWaWV3ID0gZ2V0TFZpZXdGcm9tTENvbnRhaW5lcjxUPihsQ29udGFpbmVyLCBpbmRleCk7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnRMVmlldyhleGlzdGluZ0xWaWV3KTtcblxuICByZXR1cm4gZXhpc3RpbmdMVmlldyE7XG59XG5cbmZ1bmN0aW9uIGdldEV4aXN0aW5nVE5vZGUodFZpZXc6IFRWaWV3LCBpbmRleDogbnVtYmVyKTogVE5vZGUge1xuICBjb25zdCB0Tm9kZSA9IGdldFROb2RlKHRWaWV3LCBpbmRleCk7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnRUTm9kZSh0Tm9kZSk7XG5cbiAgcmV0dXJuIHROb2RlO1xufVxuIl19