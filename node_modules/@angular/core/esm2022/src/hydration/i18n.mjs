/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { inject, Injector } from '../di';
import { isRootTemplateMessage } from '../render3/i18n/i18n_util';
import { createIcuIterator } from '../render3/instructions/i18n_icu_container_visitor';
import { isTNodeShape } from '../render3/interfaces/node';
import { HEADER_OFFSET, HYDRATION, RENDERER, TVIEW } from '../render3/interfaces/view';
import { getFirstNativeNode, nativeRemoveNode } from '../render3/node_manipulation';
import { unwrapRNode } from '../render3/util/view_utils';
import { assertDefined, assertNotEqual } from '../util/assert';
import { I18N_DATA } from './interfaces';
import { isDisconnectedRNode, locateNextRNode, tryLocateRNodeByPath } from './node_lookup_utils';
import { IS_I18N_HYDRATION_ENABLED } from './tokens';
import { getNgContainerSize, initDisconnectedNodes, isSerializedElementContainer, processTextNodeBeforeSerialization, } from './utils';
let _isI18nHydrationSupportEnabled = false;
let _prepareI18nBlockForHydrationImpl = () => {
    // noop unless `enablePrepareI18nBlockForHydrationImpl` is invoked.
};
export function setIsI18nHydrationSupportEnabled(enabled) {
    _isI18nHydrationSupportEnabled = enabled;
}
export function isI18nHydrationSupportEnabled() {
    return _isI18nHydrationSupportEnabled;
}
/**
 * Prepares an i18n block and its children, located at the given
 * view and instruction index, for hydration.
 *
 * @param lView lView with the i18n block
 * @param index index of the i18n block in the lView
 * @param parentTNode TNode of the parent of the i18n block
 * @param subTemplateIndex sub-template index, or -1 for the main template
 */
export function prepareI18nBlockForHydration(lView, index, parentTNode, subTemplateIndex) {
    _prepareI18nBlockForHydrationImpl(lView, index, parentTNode, subTemplateIndex);
}
export function enablePrepareI18nBlockForHydrationImpl() {
    _prepareI18nBlockForHydrationImpl = prepareI18nBlockForHydrationImpl;
}
export function isI18nHydrationEnabled(injector) {
    injector = injector ?? inject(Injector);
    return injector.get(IS_I18N_HYDRATION_ENABLED, false);
}
/**
 * Collects, if not already cached, all of the indices in the
 * given TView which are children of an i18n block.
 *
 * Since i18n blocks don't introduce a parent TNode, this is necessary
 * in order to determine which indices in a LView are translated.
 */
export function getOrComputeI18nChildren(tView, context) {
    let i18nChildren = context.i18nChildren.get(tView);
    if (i18nChildren === undefined) {
        i18nChildren = collectI18nChildren(tView);
        context.i18nChildren.set(tView, i18nChildren);
    }
    return i18nChildren;
}
function collectI18nChildren(tView) {
    const children = new Set();
    function collectI18nViews(node) {
        children.add(node.index);
        switch (node.kind) {
            case 1 /* I18nNodeKind.ELEMENT */:
            case 2 /* I18nNodeKind.PLACEHOLDER */: {
                for (const childNode of node.children) {
                    collectI18nViews(childNode);
                }
                break;
            }
            case 3 /* I18nNodeKind.ICU */: {
                for (const caseNodes of node.cases) {
                    for (const caseNode of caseNodes) {
                        collectI18nViews(caseNode);
                    }
                }
                break;
            }
        }
    }
    // Traverse through the AST of each i18n block in the LView,
    // and collect every instruction index.
    for (let i = HEADER_OFFSET; i < tView.bindingStartIndex; i++) {
        const tI18n = tView.data[i];
        if (!tI18n || !tI18n.ast) {
            continue;
        }
        for (const node of tI18n.ast) {
            collectI18nViews(node);
        }
    }
    return children.size === 0 ? null : children;
}
/**
 * Attempts to serialize i18n data for an i18n block, located at
 * the given view and instruction index.
 *
 * @param lView lView with the i18n block
 * @param index index of the i18n block in the lView
 * @param context the hydration context
 * @returns the i18n data, or null if there is no relevant data
 */
export function trySerializeI18nBlock(lView, index, context) {
    if (!context.isI18nHydrationEnabled) {
        return null;
    }
    const tView = lView[TVIEW];
    const tI18n = tView.data[index];
    if (!tI18n || !tI18n.ast) {
        return null;
    }
    const serializedI18nBlock = {
        caseQueue: [],
        disconnectedNodes: new Set(),
        disjointNodes: new Set(),
    };
    serializeI18nBlock(lView, serializedI18nBlock, context, tI18n.ast);
    return serializedI18nBlock.caseQueue.length === 0 &&
        serializedI18nBlock.disconnectedNodes.size === 0 &&
        serializedI18nBlock.disjointNodes.size === 0
        ? null
        : serializedI18nBlock;
}
function serializeI18nBlock(lView, serializedI18nBlock, context, nodes) {
    let prevRNode = null;
    for (const node of nodes) {
        const nextRNode = serializeI18nNode(lView, serializedI18nBlock, context, node);
        if (nextRNode) {
            if (isDisjointNode(prevRNode, nextRNode)) {
                serializedI18nBlock.disjointNodes.add(node.index - HEADER_OFFSET);
            }
            prevRNode = nextRNode;
        }
    }
    return prevRNode;
}
/**
 * Helper to determine whether the given nodes are "disjoint".
 *
 * The i18n hydration process walks through the DOM and i18n nodes
 * at the same time. It expects the sibling DOM node of the previous
 * i18n node to be the first node of the next i18n node.
 *
 * In cases of content projection, this won't always be the case. So
 * when we detect that, we mark the node as "disjoint", ensuring that
 * we will serialize the path to the node. This way, when we hydrate the
 * i18n node, we will be able to find the correct place to start.
 */
function isDisjointNode(prevNode, nextNode) {
    return prevNode && prevNode.nextSibling !== nextNode;
}
/**
 * Process the given i18n node for serialization.
 * Returns the first RNode for the i18n node to begin hydration.
 */
function serializeI18nNode(lView, serializedI18nBlock, context, node) {
    const maybeRNode = unwrapRNode(lView[node.index]);
    if (!maybeRNode || isDisconnectedRNode(maybeRNode)) {
        serializedI18nBlock.disconnectedNodes.add(node.index - HEADER_OFFSET);
        return null;
    }
    const rNode = maybeRNode;
    switch (node.kind) {
        case 0 /* I18nNodeKind.TEXT */: {
            processTextNodeBeforeSerialization(context, rNode);
            break;
        }
        case 1 /* I18nNodeKind.ELEMENT */:
        case 2 /* I18nNodeKind.PLACEHOLDER */: {
            serializeI18nBlock(lView, serializedI18nBlock, context, node.children);
            break;
        }
        case 3 /* I18nNodeKind.ICU */: {
            const currentCase = lView[node.currentCaseLViewIndex];
            if (currentCase != null) {
                // i18n uses a negative value to signal a change to a new case, so we
                // need to invert it to get the proper value.
                const caseIdx = currentCase < 0 ? ~currentCase : currentCase;
                serializedI18nBlock.caseQueue.push(caseIdx);
                serializeI18nBlock(lView, serializedI18nBlock, context, node.cases[caseIdx]);
            }
            break;
        }
    }
    return getFirstNativeNodeForI18nNode(lView, node);
}
/**
 * Helper function to get the first native node to begin hydrating
 * the given i18n node.
 */
function getFirstNativeNodeForI18nNode(lView, node) {
    const tView = lView[TVIEW];
    const maybeTNode = tView.data[node.index];
    if (isTNodeShape(maybeTNode)) {
        // If the node is backed by an actual TNode, we can simply delegate.
        return getFirstNativeNode(lView, maybeTNode);
    }
    else if (node.kind === 3 /* I18nNodeKind.ICU */) {
        // A nested ICU container won't have an actual TNode. In that case, we can use
        // an iterator to find the first child.
        const icuIterator = createIcuIterator(maybeTNode, lView);
        let rNode = icuIterator();
        // If the ICU container has no nodes, then we use the ICU anchor as the node.
        return rNode ?? unwrapRNode(lView[node.index]);
    }
    else {
        // Otherwise, the node is a text or trivial element in an ICU container,
        // and we can just use the RNode directly.
        return unwrapRNode(lView[node.index]) ?? null;
    }
}
function setCurrentNode(state, node) {
    state.currentNode = node;
}
/**
 * Marks the current RNode as the hydration root for the given
 * AST node.
 */
function appendI18nNodeToCollection(context, state, astNode) {
    const noOffsetIndex = astNode.index - HEADER_OFFSET;
    const { disconnectedNodes } = context;
    const currentNode = state.currentNode;
    if (state.isConnected) {
        context.i18nNodes.set(noOffsetIndex, currentNode);
        // We expect the node to be connected, so ensure that it
        // is not in the set, regardless of whether we found it,
        // so that the downstream error handling can provide the
        // proper context.
        disconnectedNodes.delete(noOffsetIndex);
    }
    else {
        disconnectedNodes.add(noOffsetIndex);
    }
    return currentNode;
}
/**
 * Skip over some sibling nodes during hydration.
 *
 * Note: we use this instead of `siblingAfter` as it's expected that
 * sometimes we might encounter null nodes. In those cases, we want to
 * defer to downstream error handling to provide proper context.
 */
function skipSiblingNodes(state, skip) {
    let currentNode = state.currentNode;
    for (let i = 0; i < skip; i++) {
        if (!currentNode) {
            break;
        }
        currentNode = currentNode?.nextSibling ?? null;
    }
    return currentNode;
}
/**
 * Fork the given state into a new state for hydrating children.
 */
function forkHydrationState(state, nextNode) {
    return { currentNode: nextNode, isConnected: state.isConnected };
}
function prepareI18nBlockForHydrationImpl(lView, index, parentTNode, subTemplateIndex) {
    if (!isI18nHydrationSupportEnabled()) {
        return;
    }
    const hydrationInfo = lView[HYDRATION];
    if (!hydrationInfo) {
        return;
    }
    const tView = lView[TVIEW];
    const tI18n = tView.data[index];
    ngDevMode &&
        assertDefined(tI18n, 'Expected i18n data to be present in a given TView slot during hydration');
    function findHydrationRoot() {
        if (isRootTemplateMessage(subTemplateIndex)) {
            // This is the root of an i18n block. In this case, our hydration root will
            // depend on where our parent TNode (i.e. the block with i18n applied) is
            // in the DOM.
            ngDevMode && assertDefined(parentTNode, 'Expected parent TNode while hydrating i18n root');
            const rootNode = locateNextRNode(hydrationInfo, tView, lView, parentTNode);
            // If this i18n block is attached to an <ng-container>, then we want to begin
            // hydrating directly with the RNode. Otherwise, for a TNode with a physical DOM
            // element, we want to recurse into the first child and begin there.
            return parentTNode.type & 8 /* TNodeType.ElementContainer */ ? rootNode : rootNode.firstChild;
        }
        // This is a nested template in an i18n block. In this case, the entire view
        // is translated, and part of a dehydrated view in a container. This means that
        // we can simply begin hydration with the first dehydrated child.
        return hydrationInfo?.firstChild;
    }
    const currentNode = findHydrationRoot();
    ngDevMode && assertDefined(currentNode, 'Expected root i18n node during hydration');
    const disconnectedNodes = initDisconnectedNodes(hydrationInfo) ?? new Set();
    const i18nNodes = (hydrationInfo.i18nNodes ??= new Map());
    const caseQueue = hydrationInfo.data[I18N_DATA]?.[index - HEADER_OFFSET] ?? [];
    const dehydratedIcuData = (hydrationInfo.dehydratedIcuData ??= new Map());
    collectI18nNodesFromDom({ hydrationInfo, lView, i18nNodes, disconnectedNodes, caseQueue, dehydratedIcuData }, { currentNode, isConnected: true }, tI18n.ast);
    // Nodes from inactive ICU cases should be considered disconnected. We track them above
    // because they aren't (and shouldn't be) serialized. Since we may mutate or create a
    // new set, we need to be sure to write the expected value back to the DehydratedView.
    hydrationInfo.disconnectedNodes = disconnectedNodes.size === 0 ? null : disconnectedNodes;
}
function collectI18nNodesFromDom(context, state, nodeOrNodes) {
    if (Array.isArray(nodeOrNodes)) {
        let nextState = state;
        for (const node of nodeOrNodes) {
            // Whenever a node doesn't directly follow the previous RNode, it
            // is given a path. We need to resume collecting nodes from that location
            // until and unless we find another disjoint node.
            const targetNode = tryLocateRNodeByPath(context.hydrationInfo, context.lView, node.index - HEADER_OFFSET);
            if (targetNode) {
                nextState = forkHydrationState(state, targetNode);
            }
            collectI18nNodesFromDom(context, nextState, node);
        }
    }
    else {
        if (context.disconnectedNodes.has(nodeOrNodes.index - HEADER_OFFSET)) {
            // i18n nodes can be considered disconnected if e.g. they were projected.
            // In that case, we have to make sure to skip over them.
            return;
        }
        switch (nodeOrNodes.kind) {
            case 0 /* I18nNodeKind.TEXT */: {
                // Claim a text node for hydration
                const currentNode = appendI18nNodeToCollection(context, state, nodeOrNodes);
                setCurrentNode(state, currentNode?.nextSibling ?? null);
                break;
            }
            case 1 /* I18nNodeKind.ELEMENT */: {
                // Recurse into the current element's children...
                collectI18nNodesFromDom(context, forkHydrationState(state, state.currentNode?.firstChild ?? null), nodeOrNodes.children);
                // And claim the parent element itself.
                const currentNode = appendI18nNodeToCollection(context, state, nodeOrNodes);
                setCurrentNode(state, currentNode?.nextSibling ?? null);
                break;
            }
            case 2 /* I18nNodeKind.PLACEHOLDER */: {
                const noOffsetIndex = nodeOrNodes.index - HEADER_OFFSET;
                const { hydrationInfo } = context;
                const containerSize = getNgContainerSize(hydrationInfo, noOffsetIndex);
                switch (nodeOrNodes.type) {
                    case 0 /* I18nPlaceholderType.ELEMENT */: {
                        // Hydration expects to find the head of the element.
                        const currentNode = appendI18nNodeToCollection(context, state, nodeOrNodes);
                        // A TNode for the node may not yet if we're hydrating during the first pass,
                        // so use the serialized data to determine if this is an <ng-container>.
                        if (isSerializedElementContainer(hydrationInfo, noOffsetIndex)) {
                            // An <ng-container> doesn't have a physical DOM node, so we need to
                            // continue hydrating from siblings.
                            collectI18nNodesFromDom(context, state, nodeOrNodes.children);
                            // Skip over the anchor element. It will be claimed by the
                            // downstream container hydration.
                            const nextNode = skipSiblingNodes(state, 1);
                            setCurrentNode(state, nextNode);
                        }
                        else {
                            // Non-container elements represent an actual node in the DOM, so we
                            // need to continue hydration with the children, and claim the node.
                            collectI18nNodesFromDom(context, forkHydrationState(state, state.currentNode?.firstChild ?? null), nodeOrNodes.children);
                            setCurrentNode(state, currentNode?.nextSibling ?? null);
                            // Elements can also be the anchor of a view container, so there may
                            // be elements after this node that we need to skip.
                            if (containerSize !== null) {
                                // `+1` stands for an anchor node after all of the views in the container.
                                const nextNode = skipSiblingNodes(state, containerSize + 1);
                                setCurrentNode(state, nextNode);
                            }
                        }
                        break;
                    }
                    case 1 /* I18nPlaceholderType.SUBTEMPLATE */: {
                        ngDevMode &&
                            assertNotEqual(containerSize, null, 'Expected a container size while hydrating i18n subtemplate');
                        // Hydration expects to find the head of the template.
                        appendI18nNodeToCollection(context, state, nodeOrNodes);
                        // Skip over all of the template children, as well as the anchor
                        // node, since the template itself will handle them instead.
                        const nextNode = skipSiblingNodes(state, containerSize + 1);
                        setCurrentNode(state, nextNode);
                        break;
                    }
                }
                break;
            }
            case 3 /* I18nNodeKind.ICU */: {
                // If the current node is connected, we need to pop the next case from the
                // queue, so that the active case is also considered connected.
                const selectedCase = state.isConnected ? context.caseQueue.shift() : null;
                const childState = { currentNode: null, isConnected: false };
                // We traverse through each case, even if it's not active,
                // so that we correctly populate disconnected nodes.
                for (let i = 0; i < nodeOrNodes.cases.length; i++) {
                    collectI18nNodesFromDom(context, i === selectedCase ? state : childState, nodeOrNodes.cases[i]);
                }
                if (selectedCase !== null) {
                    // ICUs represent a branching state, and the selected case could be different
                    // than what it was on the server. In that case, we need to be able to clean
                    // up the nodes from the original case. To do that, we store the selected case.
                    context.dehydratedIcuData.set(nodeOrNodes.index, { case: selectedCase, node: nodeOrNodes });
                }
                // Hydration expects to find the ICU anchor element.
                const currentNode = appendI18nNodeToCollection(context, state, nodeOrNodes);
                setCurrentNode(state, currentNode?.nextSibling ?? null);
                break;
            }
        }
    }
}
let _claimDehydratedIcuCaseImpl = () => {
    // noop unless `enableClaimDehydratedIcuCaseImpl` is invoked
};
/**
 * Mark the case for the ICU node at the given index in the view as claimed,
 * allowing its nodes to be hydrated and not cleaned up.
 */
export function claimDehydratedIcuCase(lView, icuIndex, caseIndex) {
    _claimDehydratedIcuCaseImpl(lView, icuIndex, caseIndex);
}
export function enableClaimDehydratedIcuCaseImpl() {
    _claimDehydratedIcuCaseImpl = claimDehydratedIcuCaseImpl;
}
function claimDehydratedIcuCaseImpl(lView, icuIndex, caseIndex) {
    const dehydratedIcuDataMap = lView[HYDRATION]?.dehydratedIcuData;
    if (dehydratedIcuDataMap) {
        const dehydratedIcuData = dehydratedIcuDataMap.get(icuIndex);
        if (dehydratedIcuData?.case === caseIndex) {
            // If the case we're attempting to claim matches the dehydrated one,
            // we remove it from the map to mark it as "claimed."
            dehydratedIcuDataMap.delete(icuIndex);
        }
    }
}
/**
 * Clean up all i18n hydration data associated with the given view.
 */
export function cleanupI18nHydrationData(lView) {
    const hydrationInfo = lView[HYDRATION];
    if (hydrationInfo) {
        const { i18nNodes, dehydratedIcuData: dehydratedIcuDataMap } = hydrationInfo;
        if (i18nNodes && dehydratedIcuDataMap) {
            const renderer = lView[RENDERER];
            for (const dehydratedIcuData of dehydratedIcuDataMap.values()) {
                cleanupDehydratedIcuData(renderer, i18nNodes, dehydratedIcuData);
            }
        }
        hydrationInfo.i18nNodes = undefined;
        hydrationInfo.dehydratedIcuData = undefined;
    }
}
function cleanupDehydratedIcuData(renderer, i18nNodes, dehydratedIcuData) {
    for (const node of dehydratedIcuData.node.cases[dehydratedIcuData.case]) {
        const rNode = i18nNodes.get(node.index - HEADER_OFFSET);
        if (rNode) {
            nativeRemoveNode(renderer, rNode, false);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2h5ZHJhdGlvbi9pMThuLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxNQUFNLEVBQUUsUUFBUSxFQUFDLE1BQU0sT0FBTyxDQUFDO0FBQ3ZDLE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBQ2hFLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLG9EQUFvRCxDQUFDO0FBRXJGLE9BQU8sRUFBQyxZQUFZLEVBQW1CLE1BQU0sNEJBQTRCLENBQUM7QUFHMUUsT0FBTyxFQUFDLGFBQWEsRUFBRSxTQUFTLEVBQVMsUUFBUSxFQUFTLEtBQUssRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ25HLE9BQU8sRUFBQyxrQkFBa0IsRUFBRSxnQkFBZ0IsRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBQ2xGLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSw0QkFBNEIsQ0FBQztBQUN2RCxPQUFPLEVBQUMsYUFBYSxFQUFFLGNBQWMsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBRzdELE9BQU8sRUFBb0MsU0FBUyxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBQzFFLE9BQU8sRUFBQyxtQkFBbUIsRUFBRSxlQUFlLEVBQUUsb0JBQW9CLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUMvRixPQUFPLEVBQUMseUJBQXlCLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFDbkQsT0FBTyxFQUNMLGtCQUFrQixFQUNsQixxQkFBcUIsRUFDckIsNEJBQTRCLEVBQzVCLGtDQUFrQyxHQUNuQyxNQUFNLFNBQVMsQ0FBQztBQUVqQixJQUFJLDhCQUE4QixHQUFHLEtBQUssQ0FBQztBQUUzQyxJQUFJLGlDQUFpQyxHQUE0QyxHQUFHLEVBQUU7SUFDcEYsbUVBQW1FO0FBQ3JFLENBQUMsQ0FBQztBQUVG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aUIsRUFBRSxvQkFBb0IsRUFBQyxHQUFHLGFBQWEsQ0FBQztRQUMzRSxJQUFJLFNBQVMsSUFBSSxvQkFBb0IsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNqQyxLQUFLLE1BQU0saUJBQWlCLElBQUksb0JBQW9CLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztnQkFDOUQsd0JBQXdCLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1lBQ25FLENBQUM7UUFDSCxDQUFDO1FBRUQsYUFBYSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDcEMsYUFBYSxDQUFDLGlCQUFpQixHQUFHLFNBQVMsQ0FBQztJQUM5QyxDQUFDO0FBQ0gsQ0FBQztBQUVELFNBQVMsd0JBQXdCLENBQy9CLFFBQWtCLEVBQ2xCLFNBQW9DLEVBQ3BDLGlCQUFvQztJQUVwQyxLQUFLLE1BQU0sSUFBSSxJQUFJLGlCQUFpQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUN4RSxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsYUFBYSxDQUFDLENBQUM7UUFDeEQsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNWLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDM0MsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7aW5qZWN0LCBJbmplY3Rvcn0gZnJvbSAnLi4vZGknO1xuaW1wb3J0IHtpc1Jvb3RUZW1wbGF0ZU1lc3NhZ2V9IGZyb20gJy4uL3JlbmRlcjMvaTE4bi9pMThuX3V0aWwnO1xuaW1wb3J0IHtjcmVhdGVJY3VJdGVyYXRvcn0gZnJvbSAnLi4vcmVuZGVyMy9pbnN0cnVjdGlvbnMvaTE4bl9pY3VfY29udGFpbmVyX3Zpc2l0b3InO1xuaW1wb3J0IHtJMThuTm9kZSwgSTE4bk5vZGVLaW5kLCBJMThuUGxhY2Vob2xkZXJUeXBlLCBUSTE4biwgVEljdX0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL2kxOG4nO1xuaW1wb3J0IHtpc1ROb2RlU2hhcGUsIFROb2RlLCBUTm9kZVR5cGV9IGZyb20gJy4uL3JlbmRlcjMvaW50ZXJmYWNlcy9ub2RlJztcbmltcG9ydCB0eXBlIHtSZW5kZXJlcn0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL3JlbmRlcmVyJztcbmltcG9ydCB0eXBlIHtSTm9kZX0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL3JlbmRlcmVyX2RvbSc7XG5pbXBvcnQge0hFQURFUl9PRkZTRVQsIEhZRFJBVElPTiwgTFZpZXcsIFJFTkRFUkVSLCBUVmlldywgVFZJRVd9IGZyb20gJy4uL3JlbmRlcjMvaW50ZXJmYWNlcy92aWV3JztcbmltcG9ydCB7Z2V0Rmlyc3ROYXRpdmVOb2RlLCBuYXRpdmVSZW1vdmVOb2RlfSBmcm9tICcuLi9yZW5kZXIzL25vZGVfbWFuaXB1bGF0aW9uJztcbmltcG9ydCB7dW53cmFwUk5vZGV9IGZyb20gJy4uL3JlbmRlcjMvdXRpbC92aWV3X3V0aWxzJztcbmltcG9ydCB7YXNzZXJ0RGVmaW5lZCwgYXNzZXJ0Tm90RXF1YWx9IGZyb20gJy4uL3V0aWwvYXNzZXJ0JztcblxuaW1wb3J0IHR5cGUge0h5ZHJhdGlvbkNvbnRleHR9IGZyb20gJy4vYW5ub3RhdGUnO1xuaW1wb3J0IHtEZWh5ZHJhdGVkSWN1RGF0YSwgRGVoeWRyYXRlZFZpZXcsIEkxOE5fREFUQX0gZnJvbSAnLi9pbnRlcmZhY2VzJztcbmltcG9ydCB7aXNEaXNjb25uZWN0ZWRSTm9kZSwgbG9jYXRlTmV4dFJOb2RlLCB0cnlMb2NhdGVSTm9kZUJ5UGF0aH0gZnJvbSAnLi9ub2RlX2xvb2t1cF91dGlscyc7XG5pbXBvcnQge0lTX0kxOE5fSFlEUkFUSU9OX0VOQUJMRUR9IGZyb20gJy4vdG9rZW5zJztcbmltcG9ydCB7XG4gIGdldE5nQ29udGFpbmVyU2l6ZSxcbiAgaW5pdERpc2Nvbm5lY3RlZE5vZGVzLFxuICBpc1NlcmlhbGl6ZWRFbGVtZW50Q29udGFpbmVyLFxuICBwcm9jZXNzVGV4dE5vZGVCZWZvcmVTZXJpYWxpemF0aW9uLFxufSBmcm9tICcuL3V0aWxzJztcblxubGV0IF9pc0kxOG5IeWRyYXRpb25TdXBwb3J0RW5hYmxlZCA9IGZhbHNlO1xuXG5sZXQgX3ByZXBhcmVJMThuQmxvY2tGb3JIeWRyYXRpb25JbXBsOiB0eXBlb2YgcHJlcGFyZUkxOG5CbG9ja0Zvckh5ZHJhdGlvbkltcGwgPSAoKSA9PiB7XG4gIC8vIG5vb3AgdW5sZXNzIGBlbmFibGVQcmVwYXJlSTE4bkJsb2NrRm9ySHlkcmF0aW9uSW1wbGAgaXMgaW52b2tlZC5cbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRJc0kxOG5IeWRyYXRpb25TdXBwb3J0RW5hYmxlZChlbmFibGVkOiBib29sZWFuKSB7XG4gIF9pc0kxOG5IeWRyYXRpb25TdXBwb3J0RW5hYmxlZCA9IGVuYWJsZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0kxOG5IeWRyYXRpb25TdXBwb3J0RW5hYmxlZCgpIHtcbiAgcmV0dXJuIF9pc0kxOG5IeWRyYXRpb25TdXBwb3J0RW5hYmxlZDtcbn1cblxuLyoqXG4gKiBQcmVwYXJlcyBhbiBpMThuIGJsb2NrIGFuZCBpdHMgY2hpbGRyZW4sIGxvY2F0ZWQgYXQgdGhlIGdpdmVuXG4gKiB2aWV3IGFuZCBpbnN0cnVjdGlvbiBpbmRleCwgZm9yIGh5ZHJhdGlvbi5cbiAqXG4gKiBAcGFyYW0gbFZpZXcgbFZpZXcgd2l0aCB0aGUgaTE4biBibG9ja1xuICogQHBhcmFtIGluZGV4IGluZGV4IG9mIHRoZSBpMThuIGJsb2NrIGluIHRoZSBsVmlld1xuICogQHBhcmFtIHBhcmVudFROb2RlIFROb2RlIG9mIHRoZSBwYXJlbnQgb2YgdGhlIGkxOG4gYmxvY2tcbiAqIEBwYXJhbSBzdWJUZW1wbGF0ZUluZGV4IHN1Yi10ZW1wbGF0ZSBpbmRleCwgb3IgLTEgZm9yIHRoZSBtYWluIHRlbXBsYXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcmVwYXJlSTE4bkJsb2NrRm9ySHlkcmF0aW9uKFxuICBsVmlldzogTFZpZXcsXG4gIGluZGV4OiBudW1iZXIsXG4gIHBhcmVudFROb2RlOiBUTm9kZSB8IG51bGwsXG4gIHN1YlRlbXBsYXRlSW5kZXg6IG51bWJlcixcbik6IHZvaWQge1xuICBfcHJlcGFyZUkxOG5CbG9ja0Zvckh5ZHJhdGlvbkltcGwobFZpZXcsIGluZGV4LCBwYXJlbnRUTm9kZSwgc3ViVGVtcGxhdGVJbmRleCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbmFibGVQcmVwYXJlSTE4bkJsb2NrRm9ySHlkcmF0aW9uSW1wbCgpIHtcbiAgX3ByZXBhcmVJMThuQmxvY2tGb3JIeWRyYXRpb25JbXBsID0gcHJlcGFyZUkxOG5CbG9ja0Zvckh5ZHJhdGlvbkltcGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0kxOG5IeWRyYXRpb25FbmFibGVkKGluamVjdG9yPzogSW5qZWN0b3IpIHtcbiAgaW5qZWN0b3IgPSBpbmplY3RvciA/PyBpbmplY3QoSW5qZWN0b3IpO1xuICByZXR1cm4gaW5qZWN0b3IuZ2V0KElTX0kxOE5fSFlEUkFUSU9OX0VOQUJMRUQsIGZhbHNlKTtcbn1cblxuLyoqXG4gKiBDb2xsZWN0cywgaWYgbm90IGFscmVhZHkgY2FjaGVkLCBhbGwgb2YgdGhlIGluZGljZXMgaW4gdGhlXG4gKiBnaXZlbiBUVmlldyB3aGljaCBhcmUgY2hpbGRyZW4gb2YgYW4gaTE4biBibG9jay5cbiAqXG4gKiBTaW5jZSBpMThuIGJsb2NrcyBkb24ndCBpbnRyb2R1Y2UgYSBwYXJlbnQgVE5vZGUsIHRoaXMgaXMgbmVjZXNzYXJ5XG4gKiBpbiBvcmRlciB0byBkZXRlcm1pbmUgd2hpY2ggaW5kaWNlcyBpbiBhIExWaWV3IGFyZSB0cmFuc2xhdGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0T3JDb21wdXRlSTE4bkNoaWxkcmVuKFxuICB0VmlldzogVFZpZXcsXG4gIGNvbnRleHQ6IEh5ZHJhdGlvbkNvbnRleHQsXG4pOiBTZXQ8bnVtYmVyPiB8IG51bGwge1xuICBsZXQgaTE4bkNoaWxkcmVuID0gY29udGV4dC5pMThuQ2hpbGRyZW4uZ2V0KHRWaWV3KTtcbiAgaWYgKGkxOG5DaGlsZHJlbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgaTE4bkNoaWxkcmVuID0gY29sbGVjdEkxOG5DaGlsZHJlbih0Vmlldyk7XG4gICAgY29udGV4dC5pMThuQ2hpbGRyZW4uc2V0KHRWaWV3LCBpMThuQ2hpbGRyZW4pO1xuICB9XG4gIHJldHVybiBpMThuQ2hpbGRyZW47XG59XG5cbmZ1bmN0aW9uIGNvbGxlY3RJMThuQ2hpbGRyZW4odFZpZXc6IFRWaWV3KTogU2V0PG51bWJlcj4gfCBudWxsIHtcbiAgY29uc3QgY2hpbGRyZW4gPSBuZXcgU2V0PG51bWJlcj4oKTtcblxuICBmdW5jdGlvbiBjb2xsZWN0STE4blZpZXdzKG5vZGU6IEkxOG5Ob2RlKSB7XG4gICAgY2hpbGRyZW4uYWRkKG5vZGUuaW5kZXgpO1xuXG4gICAgc3dpdGNoIChub2RlLmtpbmQpIHtcbiAgICAgIGNhc2UgSTE4bk5vZGVLaW5kLkVMRU1FTlQ6XG4gICAgICBjYXNlIEkxOG5Ob2RlS2luZC5QTEFDRUhPTERFUjoge1xuICAgICAgICBmb3IgKGNvbnN0IGNoaWxkTm9kZSBvZiBub2RlLmNoaWxkcmVuKSB7XG4gICAgICAgICAgY29sbGVjdEkxOG5WaWV3cyhjaGlsZE5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjYXNlIEkxOG5Ob2RlS2luZC5JQ1U6IHtcbiAgICAgICAgZm9yIChjb25zdCBjYXNlTm9kZXMgb2Ygbm9kZS5jYXNlcykge1xuICAgICAgICAgIGZvciAoY29uc3QgY2FzZU5vZGUgb2YgY2FzZU5vZGVzKSB7XG4gICAgICAgICAgICBjb2xsZWN0STE4blZpZXdzKGNhc2VOb2RlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gVHJhdmVyc2UgdGhyb3VnaCB0aGUgQVNUIG9mIGVhY2ggaTE4biBibG9jayBpbiB0aGUgTFZpZXcsXG4gIC8vIGFuZCBjb2xsZWN0IGV2ZXJ5IGluc3RydWN0aW9uIGluZGV4LlxuICBmb3IgKGxldCBpID0gSEVBREVSX09GRlNFVDsgaSA8IHRWaWV3LmJpbmRpbmdTdGFydEluZGV4OyBpKyspIHtcbiAgICBjb25zdCB0STE4biA9IHRWaWV3LmRhdGFbaV0gYXMgVEkxOG4gfCB1bmRlZmluZWQ7XG4gICAgaWYgKCF0STE4biB8fCAhdEkxOG4uYXN0KSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IG5vZGUgb2YgdEkxOG4uYXN0KSB7XG4gICAgICBjb2xsZWN0STE4blZpZXdzKG5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBjaGlsZHJlbi5zaXplID09PSAwID8gbnVsbCA6IGNoaWxkcmVuO1xufVxuXG4vKipcbiAqIFJlc3VsdGluZyBkYXRhIGZyb20gc2VyaWFsaXppbmcgYW4gaTE4biBibG9jay5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTZXJpYWxpemVkSTE4bkJsb2NrIHtcbiAgLyoqXG4gICAqIEEgcXVldWUgb2YgYWN0aXZlIElDVSBjYXNlcyBmcm9tIGEgZGVwdGgtZmlyc3QgdHJhdmVyc2FsXG4gICAqIG9mIHRoZSBpMThuIEFTVC4gVGhpcyBpcyBzZXJpYWxpemVkIHRvIHRoZSBjbGllbnQgaW4gb3JkZXJcbiAgICogdG8gY29ycmVjdGx5IGFzc29jaWF0ZSBET00gbm9kZXMgd2l0aCBpMThuIG5vZGVzIGR1cmluZ1xuICAgKiBoeWRyYXRpb24uXG4gICAqL1xuICBjYXNlUXVldWU6IEFycmF5PG51bWJlcj47XG5cbiAgLyoqXG4gICAqIEEgc2V0IG9mIGluZGljZXMgaW4gdGhlIGxWaWV3IG9mIHRoZSBibG9jayBmb3Igbm9kZXNcbiAgICogdGhhdCBhcmUgZGlzY29ubmVjdGVkIGZyb20gdGhlIERPTS4gSW4gaTE4biwgdGhpcyBjYW5cbiAgICogaGFwcGVuIHdoZW4gdXNpbmcgY29udGVudCBwcm9qZWN0aW9uIGJ1dCBzb21lIG5vZGVzIGFyZVxuICAgKiBub3Qgc2VsZWN0ZWQgYnkgYW4gPG5nLWNvbnRlbnQgLz4uXG4gICAqL1xuICBkaXNjb25uZWN0ZWROb2RlczogU2V0PG51bWJlcj47XG5cbiAgLyoqXG4gICAqIEEgc2V0IG9mIGluZGljZXMgaW4gdGhlIGxWaWV3IG9mIHRoZSBibG9jayBmb3Igbm9kZXNcbiAgICogY29uc2lkZXJlZCBcImRpc2pvaW50XCIsIGluZGljYXRpbmcgdGhhdCB3ZSBuZWVkIHRvIHNlcmlhbGl6ZVxuICAgKiBhIHBhdGggdG8gdGhlIG5vZGUgaW4gb3JkZXIgdG8gaHlkcmF0ZSBpdC5cbiAgICpcbiAgICogQSBub2RlIGlzIGNvbnNpZGVyZWQgZGlzam9pbnQgd2hlbiBpdHMgUk5vZGUgZG9lcyBub3RcbiAgICogZGlyZWN0bHkgZm9sbG93IHRoZSBSTm9kZSBvZiB0aGUgcHJldmlvdXMgaTE4biBub2RlLCBmb3JcbiAgICogZXhhbXBsZSwgYmVjYXVzZSBvZiBjb250ZW50IHByb2plY3Rpb24uXG4gICAqL1xuICBkaXNqb2ludE5vZGVzOiBTZXQ8bnVtYmVyPjtcbn1cblxuLyoqXG4gKiBBdHRlbXB0cyB0byBzZXJpYWxpemUgaTE4biBkYXRhIGZvciBhbiBpMThuIGJsb2NrLCBsb2NhdGVkIGF0XG4gKiB0aGUgZ2l2ZW4gdmlldyBhbmQgaW5zdHJ1Y3Rpb24gaW5kZXguXG4gKlxuICogQHBhcmFtIGxWaWV3IGxWaWV3IHdpdGggdGhlIGkxOG4gYmxvY2tcbiAqIEBwYXJhbSBpbmRleCBpbmRleCBvZiB0aGUgaTE4biBibG9jayBpbiB0aGUgbFZpZXdcbiAqIEBwYXJhbSBjb250ZXh0IHRoZSBoeWRyYXRpb24gY29udGV4dFxuICogQHJldHVybnMgdGhlIGkxOG4gZGF0YSwgb3IgbnVsbCBpZiB0aGVyZSBpcyBubyByZWxldmFudCBkYXRhXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cnlTZXJpYWxpemVJMThuQmxvY2soXG4gIGxWaWV3OiBMVmlldyxcbiAgaW5kZXg6IG51bWJlcixcbiAgY29udGV4dDogSHlkcmF0aW9uQ29udGV4dCxcbik6IFNlcmlhbGl6ZWRJMThuQmxvY2sgfCBudWxsIHtcbiAgaWYgKCFjb250ZXh0LmlzSTE4bkh5ZHJhdGlvbkVuYWJsZWQpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IHRWaWV3ID0gbFZpZXdbVFZJRVddO1xuICBjb25zdCB0STE4biA9IHRWaWV3LmRhdGFbaW5kZXhdIGFzIFRJMThuIHwgdW5kZWZpbmVkO1xuICBpZiAoIXRJMThuIHx8ICF0STE4bi5hc3QpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IHNlcmlhbGl6ZWRJMThuQmxvY2s6IFNlcmlhbGl6ZWRJMThuQmxvY2sgPSB7XG4gICAgY2FzZVF1ZXVlOiBbXSxcbiAgICBkaXNjb25uZWN0ZWROb2RlczogbmV3IFNldCgpLFxuICAgIGRpc2pvaW50Tm9kZXM6IG5ldyBTZXQoKSxcbiAgfTtcbiAgc2VyaWFsaXplSTE4bkJsb2NrKGxWaWV3LCBzZXJpYWxpemVkSTE4bkJsb2NrLCBjb250ZXh0LCB0STE4bi5hc3QpO1xuXG4gIHJldHVybiBzZXJpYWxpemVkSTE4bkJsb2NrLmNhc2VRdWV1ZS5sZW5ndGggPT09IDAgJiZcbiAgICBzZXJpYWxpemVkSTE4bkJsb2NrLmRpc2Nvbm5lY3RlZE5vZGVzLnNpemUgPT09IDAgJiZcbiAgICBzZXJpYWxpemVkSTE4bkJsb2NrLmRpc2pvaW50Tm9kZXMuc2l6ZSA9PT0gMFxuICAgID8gbnVsbFxuICAgIDogc2VyaWFsaXplZEkxOG5CbG9jaztcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplSTE4bkJsb2NrKFxuICBsVmlldzogTFZpZXcsXG4gIHNlcmlhbGl6ZWRJMThuQmxvY2s6IFNlcmlhbGl6ZWRJMThuQmxvY2ssXG4gIGNvbnRleHQ6IEh5ZHJhdGlvbkNvbnRleHQsXG4gIG5vZGVzOiBJMThuTm9kZVtdLFxuKTogTm9kZSB8IG51bGwge1xuICBsZXQgcHJldlJOb2RlID0gbnVsbDtcbiAgZm9yIChjb25zdCBub2RlIG9mIG5vZGVzKSB7XG4gICAgY29uc3QgbmV4dFJOb2RlID0gc2VyaWFsaXplSTE4bk5vZGUobFZpZXcsIHNlcmlhbGl6ZWRJMThuQmxvY2ssIGNvbnRleHQsIG5vZGUpO1xuICAgIGlmIChuZXh0Uk5vZGUpIHtcbiAgICAgIGlmIChpc0Rpc2pvaW50Tm9kZShwcmV2Uk5vZGUsIG5leHRSTm9kZSkpIHtcbiAgICAgICAgc2VyaWFsaXplZEkxOG5CbG9jay5kaXNqb2ludE5vZGVzLmFkZChub2RlLmluZGV4IC0gSEVBREVSX09GRlNFVCk7XG4gICAgICB9XG4gICAgICBwcmV2Uk5vZGUgPSBuZXh0Uk5vZGU7XG4gICAgfVxuICB9XG4gIHJldHVybiBwcmV2Uk5vZGU7XG59XG5cbi8qKlxuICogSGVscGVyIHRvIGRldGVybWluZSB3aGV0aGVyIHRoZSBnaXZlbiBub2RlcyBhcmUgXCJkaXNqb2ludFwiLlxuICpcbiAqIFRoZSBpMThuIGh5ZHJhdGlvbiBwcm9jZXNzIHdhbGtzIHRocm91Z2ggdGhlIERPTSBhbmQgaTE4biBub2Rlc1xuICogYXQgdGhlIHNhbWUgdGltZS4gSXQgZXhwZWN0cyB0aGUgc2libGluZyBET00gbm9kZSBvZiB0aGUgcHJldmlvdXNcbiAqIGkxOG4gbm9kZSB0byBiZSB0aGUgZmlyc3Qgbm9kZSBvZiB0aGUgbmV4dCBpMThuIG5vZGUuXG4gKlxuICogSW4gY2FzZXMgb2YgY29udGVudCBwcm9qZWN0aW9uLCB0aGlzIHdvbid0IGFsd2F5cyBiZSB0aGUgY2FzZS4gU29cbiAqIHdoZW4gd2UgZGV0ZWN0IHRoYXQsIHdlIG1hcmsgdGhlIG5vZGUgYXMgXCJkaXNqb2ludFwiLCBlbnN1cmluZyB0aGF0XG4gKiB3ZSB3aWxsIHNlcmlhbGl6ZSB0aGUgcGF0aCB0byB0aGUgbm9kZS4gVGhpcyB3YXksIHdoZW4gd2UgaHlkcmF0ZSB0aGVcbiAqIGkxOG4gbm9kZSwgd2Ugd2lsbCBiZSBhYmxlIHRvIGZpbmQgdGhlIGNvcnJlY3QgcGxhY2UgdG8gc3RhcnQuXG4gKi9cbmZ1bmN0aW9uIGlzRGlzam9pbnROb2RlKHByZXZOb2RlOiBOb2RlIHwgbnVsbCwgbmV4dE5vZGU6IE5vZGUpIHtcbiAgcmV0dXJuIHByZXZOb2RlICYmIHByZXZOb2RlLm5leHRTaWJsaW5nICE9PSBuZXh0Tm9kZTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIHRoZSBnaXZlbiBpMThuIG5vZGUgZm9yIHNlcmlhbGl6YXRpb24uXG4gKiBSZXR1cm5zIHRoZSBmaXJzdCBSTm9kZSBmb3IgdGhlIGkxOG4gbm9kZSB0byBiZWdpbiBoeWRyYXRpb24uXG4gKi9cbmZ1bmN0aW9uIHNlcmlhbGl6ZUkxOG5Ob2RlKFxuICBsVmlldzogTFZpZXcsXG4gIHNlcmlhbGl6ZWRJMThuQmxvY2s6IFNlcmlhbGl6ZWRJMThuQmxvY2ssXG4gIGNvbnRleHQ6IEh5ZHJhdGlvbkNvbnRleHQsXG4gIG5vZGU6IEkxOG5Ob2RlLFxuKTogTm9kZSB8IG51bGwge1xuICBjb25zdCBtYXliZVJOb2RlID0gdW53cmFwUk5vZGUobFZpZXdbbm9kZS5pbmRleF0hKTtcbiAgaWYgKCFtYXliZVJOb2RlIHx8IGlzRGlzY29ubmVjdGVkUk5vZGUobWF5YmVSTm9kZSkpIHtcbiAgICBzZXJpYWxpemVkSTE4bkJsb2NrLmRpc2Nvbm5lY3RlZE5vZGVzLmFkZChub2RlLmluZGV4IC0gSEVBREVSX09GRlNFVCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCByTm9kZSA9IG1heWJlUk5vZGUgYXMgTm9kZTtcbiAgc3dpdGNoIChub2RlLmtpbmQpIHtcbiAgICBjYXNlIEkxOG5Ob2RlS2luZC5URVhUOiB7XG4gICAgICBwcm9jZXNzVGV4dE5vZGVCZWZvcmVTZXJpYWxpemF0aW9uKGNvbnRleHQsIHJOb2RlKTtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGNhc2UgSTE4bk5vZGVLaW5kLkVMRU1FTlQ6XG4gICAgY2FzZSBJMThuTm9kZUtpbmQuUExBQ0VIT0xERVI6IHtcbiAgICAgIHNlcmlhbGl6ZUkxOG5CbG9jayhsVmlldywgc2VyaWFsaXplZEkxOG5CbG9jaywgY29udGV4dCwgbm9kZS5jaGlsZHJlbik7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjYXNlIEkxOG5Ob2RlS2luZC5JQ1U6IHtcbiAgICAgIGNvbnN0IGN1cnJlbnRDYXNlID0gbFZpZXdbbm9kZS5jdXJyZW50Q2FzZUxWaWV3SW5kZXhdIGFzIG51bWJlciB8IG51bGw7XG4gICAgICBpZiAoY3VycmVudENhc2UgIT0gbnVsbCkge1xuICAgICAgICAvLyBpMThuIHVzZXMgYSBuZWdhdGl2ZSB2YWx1ZSB0byBzaWduYWwgYSBjaGFuZ2UgdG8gYSBuZXcgY2FzZSwgc28gd2VcbiAgICAgICAgLy8gbmVlZCB0byBpbnZlcnQgaXQgdG8gZ2V0IHRoZSBwcm9wZXIgdmFsdWUuXG4gICAgICAgIGNvbnN0IGNhc2VJZHggPSBjdXJyZW50Q2FzZSA8IDAgPyB+Y3VycmVudENhc2UgOiBjdXJyZW50Q2FzZTtcbiAgICAgICAgc2VyaWFsaXplZEkxOG5CbG9jay5jYXNlUXVldWUucHVzaChjYXNlSWR4KTtcbiAgICAgICAgc2VyaWFsaXplSTE4bkJsb2NrKGxWaWV3LCBzZXJpYWxpemVkSTE4bkJsb2NrLCBjb250ZXh0LCBub2RlLmNhc2VzW2Nhc2VJZHhdKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBnZXRGaXJzdE5hdGl2ZU5vZGVGb3JJMThuTm9kZShsVmlldywgbm9kZSkgYXMgTm9kZSB8IG51bGw7XG59XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHRvIGdldCB0aGUgZmlyc3QgbmF0aXZlIG5vZGUgdG8gYmVnaW4gaHlkcmF0aW5nXG4gKiB0aGUgZ2l2ZW4gaTE4biBub2RlLlxuICovXG5mdW5jdGlvbiBnZXRGaXJzdE5hdGl2ZU5vZGVGb3JJMThuTm9kZShsVmlldzogTFZpZXcsIG5vZGU6IEkxOG5Ob2RlKSB7XG4gIGNvbnN0IHRWaWV3ID0gbFZpZXdbVFZJRVddO1xuICBjb25zdCBtYXliZVROb2RlID0gdFZpZXcuZGF0YVtub2RlLmluZGV4XTtcblxuICBpZiAoaXNUTm9kZVNoYXBlKG1heWJlVE5vZGUpKSB7XG4gICAgLy8gSWYgdGhlIG5vZGUgaXMgYmFja2VkIGJ5IGFuIGFjdHVhbCBUTm9kZSwgd2UgY2FuIHNpbXBseSBkZWxlZ2F0ZS5cbiAgICByZXR1cm4gZ2V0Rmlyc3ROYXRpdmVOb2RlKGxWaWV3LCBtYXliZVROb2RlKTtcbiAgfSBlbHNlIGlmIChub2RlLmtpbmQgPT09IEkxOG5Ob2RlS2luZC5JQ1UpIHtcbiAgICAvLyBBIG5lc3RlZCBJQ1UgY29udGFpbmVyIHdvbid0IGhhdmUgYW4gYWN0dWFsIFROb2RlLiBJbiB0aGF0IGNhc2UsIHdlIGNhbiB1c2VcbiAgICAvLyBhbiBpdGVyYXRvciB0byBmaW5kIHRoZSBmaXJzdCBjaGlsZC5cbiAgICBjb25zdCBpY3VJdGVyYXRvciA9IGNyZWF0ZUljdUl0ZXJhdG9yKG1heWJlVE5vZGUgYXMgVEljdSwgbFZpZXcpO1xuICAgIGxldCByTm9kZTogUk5vZGUgfCBudWxsID0gaWN1SXRlcmF0b3IoKTtcblxuICAgIC8vIElmIHRoZSBJQ1UgY29udGFpbmVyIGhhcyBubyBub2RlcywgdGhlbiB3ZSB1c2UgdGhlIElDVSBhbmNob3IgYXMgdGhlIG5vZGUuXG4gICAgcmV0dXJuIHJOb2RlID8/IHVud3JhcFJOb2RlKGxWaWV3W25vZGUuaW5kZXhdKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBPdGhlcndpc2UsIHRoZSBub2RlIGlzIGEgdGV4dCBvciB0cml2aWFsIGVsZW1lbnQgaW4gYW4gSUNVIGNvbnRhaW5lcixcbiAgICAvLyBhbmQgd2UgY2FuIGp1c3QgdXNlIHRoZSBSTm9kZSBkaXJlY3RseS5cbiAgICByZXR1cm4gdW53cmFwUk5vZGUobFZpZXdbbm9kZS5pbmRleF0pID8/IG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBEZXNjcmliZXMgc2hhcmVkIGRhdGEgYXZhaWxhYmxlIGR1cmluZyB0aGUgaHlkcmF0aW9uIHByb2Nlc3MuXG4gKi9cbmludGVyZmFjZSBJMThuSHlkcmF0aW9uQ29udGV4dCB7XG4gIGh5ZHJhdGlvbkluZm86IERlaHlkcmF0ZWRWaWV3O1xuICBsVmlldzogTFZpZXc7XG4gIGkxOG5Ob2RlczogTWFwPG51bWJlciwgUk5vZGUgfCBudWxsPjtcbiAgZGlzY29ubmVjdGVkTm9kZXM6IFNldDxudW1iZXI+O1xuICBjYXNlUXVldWU6IG51bWJlcltdO1xuICBkZWh5ZHJhdGVkSWN1RGF0YTogTWFwPG51bWJlciwgRGVoeWRyYXRlZEljdURhdGE+O1xufVxuXG4vKipcbiAqIERlc2NyaWJlcyBjdXJyZW50IGh5ZHJhdGlvbiBzdGF0ZS5cbiAqL1xuaW50ZXJmYWNlIEkxOG5IeWRyYXRpb25TdGF0ZSB7XG4gIC8vIFRoZSBjdXJyZW50IG5vZGVcbiAgY3VycmVudE5vZGU6IE5vZGUgfCBudWxsO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSB0cmVlIHNob3VsZCBiZSBjb25uZWN0ZWQuXG4gICAqXG4gICAqIER1cmluZyBoeWRyYXRpb24sIGl0IGNhbiBoYXBwZW4gdGhhdCB3ZSBleHBlY3QgdG8gaGF2ZSBhXG4gICAqIGN1cnJlbnQgUk5vZGUsIGJ1dCB3ZSBkb24ndC4gSW4gc3VjaCBjYXNlcywgd2Ugc3RpbGwgbmVlZFxuICAgKiB0byBwcm9wYWdhdGUgdGhlIGV4cGVjdGF0aW9uIHRvIHRoZSBjb3JyZXNwb25kaW5nIExWaWV3cyxcbiAgICogc28gdGhhdCB0aGUgcHJvcGVyIGRvd25zdHJlYW0gZXJyb3IgaGFuZGxpbmcgY2FuIHByb3ZpZGVcbiAgICogdGhlIGNvcnJlY3QgY29udGV4dCBmb3IgdGhlIGVycm9yLlxuICAgKi9cbiAgaXNDb25uZWN0ZWQ6IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIHNldEN1cnJlbnROb2RlKHN0YXRlOiBJMThuSHlkcmF0aW9uU3RhdGUsIG5vZGU6IE5vZGUgfCBudWxsKSB7XG4gIHN0YXRlLmN1cnJlbnROb2RlID0gbm9kZTtcbn1cblxuLyoqXG4gKiBNYXJrcyB0aGUgY3VycmVudCBSTm9kZSBhcyB0aGUgaHlkcmF0aW9uIHJvb3QgZm9yIHRoZSBnaXZlblxuICogQVNUIG5vZGUuXG4gKi9cbmZ1bmN0aW9uIGFwcGVuZEkxOG5Ob2RlVG9Db2xsZWN0aW9uKFxuICBjb250ZXh0OiBJMThuSHlkcmF0aW9uQ29udGV4dCxcbiAgc3RhdGU6IEkxOG5IeWRyYXRpb25TdGF0ZSxcbiAgYXN0Tm9kZTogSTE4bk5vZGUsXG4pIHtcbiAgY29uc3Qgbm9PZmZzZXRJbmRleCA9IGFzdE5vZGUuaW5kZXggLSBIRUFERVJfT0ZGU0VUO1xuICBjb25zdCB7ZGlzY29ubmVjdGVkTm9kZXN9ID0gY29udGV4dDtcbiAgY29uc3QgY3VycmVudE5vZGUgPSBzdGF0ZS5jdXJyZW50Tm9kZTtcblxuICBpZiAoc3RhdGUuaXNDb25uZWN0ZWQpIHtcbiAgICBjb250ZXh0LmkxOG5Ob2Rlcy5zZXQobm9PZmZzZXRJbmRleCwgY3VycmVudE5vZGUpO1xuXG4gICAgLy8gV2UgZXhwZWN0IHRoZSBub2RlIHRvIGJlIGNvbm5lY3RlZCwgc28gZW5zdXJlIHRoYXQgaXRcbiAgICAvLyBpcyBub3QgaW4gdGhlIHNldCwgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHdlIGZvdW5kIGl0LFxuICAgIC8vIHNvIHRoYXQgdGhlIGRvd25zdHJlYW0gZXJyb3IgaGFuZGxpbmcgY2FuIHByb3ZpZGUgdGhlXG4gICAgLy8gcHJvcGVyIGNvbnRleHQuXG4gICAgZGlzY29ubmVjdGVkTm9kZXMuZGVsZXRlKG5vT2Zmc2V0SW5kZXgpO1xuICB9IGVsc2Uge1xuICAgIGRpc2Nvbm5lY3RlZE5vZGVzLmFkZChub09mZnNldEluZGV4KTtcbiAgfVxuXG4gIHJldHVybiBjdXJyZW50Tm9kZTtcbn1cblxuLyoqXG4gKiBTa2lwIG92ZXIgc29tZSBzaWJsaW5nIG5vZGVzIGR1cmluZyBoeWRyYXRpb24uXG4gKlxuICogTm90ZTogd2UgdXNlIHRoaXMgaW5zdGVhZCBvZiBgc2libGluZ0FmdGVyYCBhcyBpdCdzIGV4cGVjdGVkIHRoYXRcbiAqIHNvbWV0aW1lcyB3ZSBtaWdodCBlbmNvdW50ZXIgbnVsbCBub2Rlcy4gSW4gdGhvc2UgY2FzZXMsIHdlIHdhbnQgdG9cbiAqIGRlZmVyIHRvIGRvd25zdHJlYW0gZXJyb3IgaGFuZGxpbmcgdG8gcHJvdmlkZSBwcm9wZXIgY29udGV4dC5cbiAqL1xuZnVuY3Rpb24gc2tpcFNpYmxpbmdOb2RlcyhzdGF0ZTogSTE4bkh5ZHJhdGlvblN0YXRlLCBza2lwOiBudW1iZXIpIHtcbiAgbGV0IGN1cnJlbnROb2RlID0gc3RhdGUuY3VycmVudE5vZGU7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc2tpcDsgaSsrKSB7XG4gICAgaWYgKCFjdXJyZW50Tm9kZSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGN1cnJlbnROb2RlID0gY3VycmVudE5vZGU/Lm5leHRTaWJsaW5nID8/IG51bGw7XG4gIH1cbiAgcmV0dXJuIGN1cnJlbnROb2RlO1xufVxuXG4vKipcbiAqIEZvcmsgdGhlIGdpdmVuIHN0YXRlIGludG8gYSBuZXcgc3RhdGUgZm9yIGh5ZHJhdGluZyBjaGlsZHJlbi5cbiAqL1xuZnVuY3Rpb24gZm9ya0h5ZHJhdGlvblN0YXRlKHN0YXRlOiBJMThuSHlkcmF0aW9uU3RhdGUsIG5leHROb2RlOiBOb2RlIHwgbnVsbCkge1xuICByZXR1cm4ge2N1cnJlbnROb2RlOiBuZXh0Tm9kZSwgaXNDb25uZWN0ZWQ6IHN0YXRlLmlzQ29ubmVjdGVkfTtcbn1cblxuZnVuY3Rpb24gcHJlcGFyZUkxOG5CbG9ja0Zvckh5ZHJhdGlvbkltcGwoXG4gIGxWaWV3OiBMVmlldyxcbiAgaW5kZXg6IG51bWJlcixcbiAgcGFyZW50VE5vZGU6IFROb2RlIHwgbnVsbCxcbiAgc3ViVGVtcGxhdGVJbmRleDogbnVtYmVyLFxuKSB7XG4gIGlmICghaXNJMThuSHlkcmF0aW9uU3VwcG9ydEVuYWJsZWQoKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGh5ZHJhdGlvbkluZm8gPSBsVmlld1tIWURSQVRJT05dO1xuICBpZiAoIWh5ZHJhdGlvbkluZm8pIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB0VmlldyA9IGxWaWV3W1RWSUVXXTtcbiAgY29uc3QgdEkxOG4gPSB0Vmlldy5kYXRhW2luZGV4XSBhcyBUSTE4bjtcbiAgbmdEZXZNb2RlICYmXG4gICAgYXNzZXJ0RGVmaW5lZCh0STE4biwgJ0V4cGVjdGVkIGkxOG4gZGF0YSB0byBiZSBwcmVzZW50IGluIGEgZ2l2ZW4gVFZpZXcgc2xvdCBkdXJpbmcgaHlkcmF0aW9uJyk7XG5cbiAgZnVuY3Rpb24gZmluZEh5ZHJhdGlvblJvb3QoKSB7XG4gICAgaWYgKGlzUm9vdFRlbXBsYXRlTWVzc2FnZShzdWJUZW1wbGF0ZUluZGV4KSkge1xuICAgICAgLy8gVGhpcyBpcyB0aGUgcm9vdCBvZiBhbiBpMThuIGJsb2NrLiBJbiB0aGlzIGNhc2UsIG91ciBoeWRyYXRpb24gcm9vdCB3aWxsXG4gICAgICAvLyBkZXBlbmQgb24gd2hlcmUgb3VyIHBhcmVudCBUTm9kZSAoaS5lLiB0aGUgYmxvY2sgd2l0aCBpMThuIGFwcGxpZWQpIGlzXG4gICAgICAvLyBpbiB0aGUgRE9NLlxuICAgICAgbmdEZXZNb2RlICYmIGFzc2VydERlZmluZWQocGFyZW50VE5vZGUsICdFeHBlY3RlZCBwYXJlbnQgVE5vZGUgd2hpbGUgaHlkcmF0aW5nIGkxOG4gcm9vdCcpO1xuICAgICAgY29uc3Qgcm9vdE5vZGUgPSBsb2NhdGVOZXh0Uk5vZGUoaHlkcmF0aW9uSW5mbyEsIHRWaWV3LCBsVmlldywgcGFyZW50VE5vZGUhKSBhcyBOb2RlO1xuXG4gICAgICAvLyBJZiB0aGlzIGkxOG4gYmxvY2sgaXMgYXR0YWNoZWQgdG8gYW4gPG5nLWNvbnRhaW5lcj4sIHRoZW4gd2Ugd2FudCB0byBiZWdpblxuICAgICAgLy8gaHlkcmF0aW5nIGRpcmVjdGx5IHdpdGggdGhlIFJOb2RlLiBPdGhlcndpc2UsIGZvciBhIFROb2RlIHdpdGggYSBwaHlzaWNhbCBET01cbiAgICAgIC8vIGVsZW1lbnQsIHdlIHdhbnQgdG8gcmVjdXJzZSBpbnRvIHRoZSBmaXJzdCBjaGlsZCBhbmQgYmVnaW4gdGhlcmUuXG4gICAgICByZXR1cm4gcGFyZW50VE5vZGUhLnR5cGUgJiBUTm9kZVR5cGUuRWxlbWVudENvbnRhaW5lciA/IHJvb3ROb2RlIDogcm9vdE5vZGUuZmlyc3RDaGlsZDtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGlzIGEgbmVzdGVkIHRlbXBsYXRlIGluIGFuIGkxOG4gYmxvY2suIEluIHRoaXMgY2FzZSwgdGhlIGVudGlyZSB2aWV3XG4gICAgLy8gaXMgdHJhbnNsYXRlZCwgYW5kIHBhcnQgb2YgYSBkZWh5ZHJhdGVkIHZpZXcgaW4gYSBjb250YWluZXIuIFRoaXMgbWVhbnMgdGhhdFxuICAgIC8vIHdlIGNhbiBzaW1wbHkgYmVnaW4gaHlkcmF0aW9uIHdpdGggdGhlIGZpcnN0IGRlaHlkcmF0ZWQgY2hpbGQuXG4gICAgcmV0dXJuIGh5ZHJhdGlvbkluZm8/LmZpcnN0Q2hpbGQgYXMgTm9kZTtcbiAgfVxuXG4gIGNvbnN0IGN1cnJlbnROb2RlID0gZmluZEh5ZHJhdGlvblJvb3QoKTtcbiAgbmdEZXZNb2RlICYmIGFzc2VydERlZmluZWQoY3VycmVudE5vZGUsICdFeHBlY3RlZCByb290IGkxOG4gbm9kZSBkdXJpbmcgaHlkcmF0aW9uJyk7XG5cbiAgY29uc3QgZGlzY29ubmVjdGVkTm9kZXMgPSBpbml0RGlzY29ubmVjdGVkTm9kZXMoaHlkcmF0aW9uSW5mbykgPz8gbmV3IFNldCgpO1xuICBjb25zdCBpMThuTm9kZXMgPSAoaHlkcmF0aW9uSW5mby5pMThuTm9kZXMgPz89IG5ldyBNYXA8bnVtYmVyLCBSTm9kZSB8IG51bGw+KCkpO1xuICBjb25zdCBjYXNlUXVldWUgPSBoeWRyYXRpb25JbmZvLmRhdGFbSTE4Tl9EQVRBXT8uW2luZGV4IC0gSEVBREVSX09GRlNFVF0gPz8gW107XG4gIGNvbnN0IGRlaHlkcmF0ZWRJY3VEYXRhID0gKGh5ZHJhdGlvbkluZm8uZGVoeWRyYXRlZEljdURhdGEgPz89IG5ldyBNYXA8XG4gICAgbnVtYmVyLFxuICAgIERlaHlkcmF0ZWRJY3VEYXRhXG4gID4oKSk7XG5cbiAgY29sbGVjdEkxOG5Ob2Rlc0Zyb21Eb20oXG4gICAge2h5ZHJhdGlvbkluZm8sIGxWaWV3LCBpMThuTm9kZXMsIGRpc2Nvbm5lY3RlZE5vZGVzLCBjYXNlUXVldWUsIGRlaHlkcmF0ZWRJY3VEYXRhfSxcbiAgICB7Y3VycmVudE5vZGUsIGlzQ29ubmVjdGVkOiB0cnVlfSxcbiAgICB0STE4bi5hc3QsXG4gICk7XG5cbiAgLy8gTm9kZXMgZnJvbSBpbmFjdGl2ZSBJQ1UgY2FzZXMgc2hvdWxkIGJlIGNvbnNpZGVyZWQgZGlzY29ubmVjdGVkLiBXZSB0cmFjayB0aGVtIGFib3ZlXG4gIC8vIGJlY2F1c2UgdGhleSBhcmVuJ3QgKGFuZCBzaG91bGRuJ3QgYmUpIHNlcmlhbGl6ZWQuIFNpbmNlIHdlIG1heSBtdXRhdGUgb3IgY3JlYXRlIGFcbiAgLy8gbmV3IHNldCwgd2UgbmVlZCB0byBiZSBzdXJlIHRvIHdyaXRlIHRoZSBleHBlY3RlZCB2YWx1ZSBiYWNrIHRvIHRoZSBEZWh5ZHJhdGVkVmlldy5cbiAgaHlkcmF0aW9uSW5mby5kaXNjb25uZWN0ZWROb2RlcyA9IGRpc2Nvbm5lY3RlZE5vZGVzLnNpemUgPT09IDAgPyBudWxsIDogZGlzY29ubmVjdGVkTm9kZXM7XG59XG5cbmZ1bmN0aW9uIGNvbGxlY3RJMThuTm9kZXNGcm9tRG9tKFxuICBjb250ZXh0OiBJMThuSHlkcmF0aW9uQ29udGV4dCxcbiAgc3RhdGU6IEkxOG5IeWRyYXRpb25TdGF0ZSxcbiAgbm9kZU9yTm9kZXM6IEkxOG5Ob2RlIHwgSTE4bk5vZGVbXSxcbikge1xuICBpZiAoQXJyYXkuaXNBcnJheShub2RlT3JOb2RlcykpIHtcbiAgICBsZXQgbmV4dFN0YXRlID0gc3RhdGU7XG4gICAgZm9yIChjb25zdCBub2RlIG9mIG5vZGVPck5vZGVzKSB7XG4gICAgICAvLyBXaGVuZXZlciBhIG5vZGUgZG9lc24ndCBkaXJlY3RseSBmb2xsb3cgdGhlIHByZXZpb3VzIFJOb2RlLCBpdFxuICAgICAgLy8gaXMgZ2l2ZW4gYSBwYXRoLiBXZSBuZWVkIHRvIHJlc3VtZSBjb2xsZWN0aW5nIG5vZGVzIGZyb20gdGhhdCBsb2NhdGlvblxuICAgICAgLy8gdW50aWwgYW5kIHVubGVzcyB3ZSBmaW5kIGFub3RoZXIgZGlzam9pbnQgbm9kZS5cbiAgICAgIGNvbnN0IHRhcmdldE5vZGUgPSB0cnlMb2NhdGVSTm9kZUJ5UGF0aChcbiAgICAgICAgY29udGV4dC5oeWRyYXRpb25JbmZvLFxuICAgICAgICBjb250ZXh0LmxWaWV3LFxuICAgICAgICBub2RlLmluZGV4IC0gSEVBREVSX09GRlNFVCxcbiAgICAgICk7XG4gICAgICBpZiAodGFyZ2V0Tm9kZSkge1xuICAgICAgICBuZXh0U3RhdGUgPSBmb3JrSHlkcmF0aW9uU3RhdGUoc3RhdGUsIHRhcmdldE5vZGUgYXMgTm9kZSk7XG4gICAgICB9XG4gICAgICBjb2xsZWN0STE4bk5vZGVzRnJvbURvbShjb250ZXh0LCBuZXh0U3RhdGUsIG5vZGUpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoY29udGV4dC5kaXNjb25uZWN0ZWROb2Rlcy5oYXMobm9kZU9yTm9kZXMuaW5kZXggLSBIRUFERVJfT0ZGU0VUKSkge1xuICAgICAgLy8gaTE4biBub2RlcyBjYW4gYmUgY29uc2lkZXJlZCBkaXNjb25uZWN0ZWQgaWYgZS5nLiB0aGV5IHdlcmUgcHJvamVjdGVkLlxuICAgICAgLy8gSW4gdGhhdCBjYXNlLCB3ZSBoYXZlIHRvIG1ha2Ugc3VyZSB0byBza2lwIG92ZXIgdGhlbS5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzd2l0Y2ggKG5vZGVPck5vZGVzLmtpbmQpIHtcbiAgICAgIGNhc2UgSTE4bk5vZGVLaW5kLlRFWFQ6IHtcbiAgICAgICAgLy8gQ2xhaW0gYSB0ZXh0IG5vZGUgZm9yIGh5ZHJhdGlvblxuICAgICAgICBjb25zdCBjdXJyZW50Tm9kZSA9IGFwcGVuZEkxOG5Ob2RlVG9Db2xsZWN0aW9uKGNvbnRleHQsIHN0YXRlLCBub2RlT3JOb2Rlcyk7XG4gICAgICAgIHNldEN1cnJlbnROb2RlKHN0YXRlLCBjdXJyZW50Tm9kZT8ubmV4dFNpYmxpbmcgPz8gbnVsbCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjYXNlIEkxOG5Ob2RlS2luZC5FTEVNRU5UOiB7XG4gICAgICAgIC8vIFJlY3Vyc2UgaW50byB0aGUgY3VycmVudCBlbGVtZW50J3MgY2hpbGRyZW4uLi5cbiAgICAgICAgY29sbGVjdEkxOG5Ob2Rlc0Zyb21Eb20oXG4gICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICBmb3JrSHlkcmF0aW9uU3RhdGUoc3RhdGUsIHN0YXRlLmN1cnJlbnROb2RlPy5maXJzdENoaWxkID8/IG51bGwpLFxuICAgICAgICAgIG5vZGVPck5vZGVzLmNoaWxkcmVuLFxuICAgICAgICApO1xuXG4gICAgICAgIC8vIEFuZCBjbGFpbSB0aGUgcGFyZW50IGVsZW1lbnQgaXRzZWxmLlxuICAgICAgICBjb25zdCBjdXJyZW50Tm9kZSA9IGFwcGVuZEkxOG5Ob2RlVG9Db2xsZWN0aW9uKGNvbnRleHQsIHN0YXRlLCBub2RlT3JOb2Rlcyk7XG4gICAgICAgIHNldEN1cnJlbnROb2RlKHN0YXRlLCBjdXJyZW50Tm9kZT8ubmV4dFNpYmxpbmcgPz8gbnVsbCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjYXNlIEkxOG5Ob2RlS2luZC5QTEFDRUhPTERFUjoge1xuICAgICAgICBjb25zdCBub09mZnNldEluZGV4ID0gbm9kZU9yTm9kZXMuaW5kZXggLSBIRUFERVJfT0ZGU0VUO1xuICAgICAgICBjb25zdCB7aHlkcmF0aW9uSW5mb30gPSBjb250ZXh0O1xuICAgICAgICBjb25zdCBjb250YWluZXJTaXplID0gZ2V0TmdDb250YWluZXJTaXplKGh5ZHJhdGlvbkluZm8sIG5vT2Zmc2V0SW5kZXgpO1xuXG4gICAgICAgIHN3aXRjaCAobm9kZU9yTm9kZXMudHlwZSkge1xuICAgICAgICAgIGNhc2UgSTE4blBsYWNlaG9sZGVyVHlwZS5FTEVNRU5UOiB7XG4gICAgICAgICAgICAvLyBIeWRyYXRpb24gZXhwZWN0cyB0byBmaW5kIHRoZSBoZWFkIG9mIHRoZSBlbGVtZW50LlxuICAgICAgICAgICAgY29uc3QgY3VycmVudE5vZGUgPSBhcHBlbmRJMThuTm9kZVRvQ29sbGVjdGlvbihjb250ZXh0LCBzdGF0ZSwgbm9kZU9yTm9kZXMpO1xuXG4gICAgICAgICAgICAvLyBBIFROb2RlIGZvciB0aGUgbm9kZSBtYXkgbm90IHlldCBpZiB3ZSdyZSBoeWRyYXRpbmcgZHVyaW5nIHRoZSBmaXJzdCBwYXNzLFxuICAgICAgICAgICAgLy8gc28gdXNlIHRoZSBzZXJpYWxpemVkIGRhdGEgdG8gZGV0ZXJtaW5lIGlmIHRoaXMgaXMgYW4gPG5nLWNvbnRhaW5lcj4uXG4gICAgICAgICAgICBpZiAoaXNTZXJpYWxpemVkRWxlbWVudENvbnRhaW5lcihoeWRyYXRpb25JbmZvLCBub09mZnNldEluZGV4KSkge1xuICAgICAgICAgICAgICAvLyBBbiA8bmctY29udGFpbmVyPiBkb2Vzbid0IGhhdmUgYSBwaHlzaWNhbCBET00gbm9kZSwgc28gd2UgbmVlZCB0b1xuICAgICAgICAgICAgICAvLyBjb250aW51ZSBoeWRyYXRpbmcgZnJvbSBzaWJsaW5ncy5cbiAgICAgICAgICAgICAgY29sbGVjdEkxOG5Ob2Rlc0Zyb21Eb20oY29udGV4dCwgc3RhdGUsIG5vZGVPck5vZGVzLmNoaWxkcmVuKTtcblxuICAgICAgICAgICAgICAvLyBTa2lwIG92ZXIgdGhlIGFuY2hvciBlbGVtZW50LiBJdCB3aWxsIGJlIGNsYWltZWQgYnkgdGhlXG4gICAgICAgICAgICAgIC8vIGRvd25zdHJlYW0gY29udGFpbmVyIGh5ZHJhdGlvbi5cbiAgICAgICAgICAgICAgY29uc3QgbmV4dE5vZGUgPSBza2lwU2libGluZ05vZGVzKHN0YXRlLCAxKTtcbiAgICAgICAgICAgICAgc2V0Q3VycmVudE5vZGUoc3RhdGUsIG5leHROb2RlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIE5vbi1jb250YWluZXIgZWxlbWVudHMgcmVwcmVzZW50IGFuIGFjdHVhbCBub2RlIGluIHRoZSBET00sIHNvIHdlXG4gICAgICAgICAgICAgIC8vIG5lZWQgdG8gY29udGludWUgaHlkcmF0aW9uIHdpdGggdGhlIGNoaWxkcmVuLCBhbmQgY2xhaW0gdGhlIG5vZGUuXG4gICAgICAgICAgICAgIGNvbGxlY3RJMThuTm9kZXNGcm9tRG9tKFxuICAgICAgICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAgICAgICAgZm9ya0h5ZHJhdGlvblN0YXRlKHN0YXRlLCBzdGF0ZS5jdXJyZW50Tm9kZT8uZmlyc3RDaGlsZCA/PyBudWxsKSxcbiAgICAgICAgICAgICAgICBub2RlT3JOb2Rlcy5jaGlsZHJlbixcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgc2V0Q3VycmVudE5vZGUoc3RhdGUsIGN1cnJlbnROb2RlPy5uZXh0U2libGluZyA/PyBudWxsKTtcblxuICAgICAgICAgICAgICAvLyBFbGVtZW50cyBjYW4gYWxzbyBiZSB0aGUgYW5jaG9yIG9mIGEgdmlldyBjb250YWluZXIsIHNvIHRoZXJlIG1heVxuICAgICAgICAgICAgICAvLyBiZSBlbGVtZW50cyBhZnRlciB0aGlzIG5vZGUgdGhhdCB3ZSBuZWVkIHRvIHNraXAuXG4gICAgICAgICAgICAgIGlmIChjb250YWluZXJTaXplICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gYCsxYCBzdGFuZHMgZm9yIGFuIGFuY2hvciBub2RlIGFmdGVyIGFsbCBvZiB0aGUgdmlld3MgaW4gdGhlIGNvbnRhaW5lci5cbiAgICAgICAgICAgICAgICBjb25zdCBuZXh0Tm9kZSA9IHNraXBTaWJsaW5nTm9kZXMoc3RhdGUsIGNvbnRhaW5lclNpemUgKyAxKTtcbiAgICAgICAgICAgICAgICBzZXRDdXJyZW50Tm9kZShzdGF0ZSwgbmV4dE5vZGUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjYXNlIEkxOG5QbGFjZWhvbGRlclR5cGUuU1VCVEVNUExBVEU6IHtcbiAgICAgICAgICAgIG5nRGV2TW9kZSAmJlxuICAgICAgICAgICAgICBhc3NlcnROb3RFcXVhbChcbiAgICAgICAgICAgICAgICBjb250YWluZXJTaXplLFxuICAgICAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICAgICAgJ0V4cGVjdGVkIGEgY29udGFpbmVyIHNpemUgd2hpbGUgaHlkcmF0aW5nIGkxOG4gc3VidGVtcGxhdGUnLFxuICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAvLyBIeWRyYXRpb24gZXhwZWN0cyB0byBmaW5kIHRoZSBoZWFkIG9mIHRoZSB0ZW1wbGF0ZS5cbiAgICAgICAgICAgIGFwcGVuZEkxOG5Ob2RlVG9Db2xsZWN0aW9uKGNvbnRleHQsIHN0YXRlLCBub2RlT3JOb2Rlcyk7XG5cbiAgICAgICAgICAgIC8vIFNraXAgb3ZlciBhbGwgb2YgdGhlIHRlbXBsYXRlIGNoaWxkcmVuLCBhcyB3ZWxsIGFzIHRoZSBhbmNob3JcbiAgICAgICAgICAgIC8vIG5vZGUsIHNpbmNlIHRoZSB0ZW1wbGF0ZSBpdHNlbGYgd2lsbCBoYW5kbGUgdGhlbSBpbnN0ZWFkLlxuICAgICAgICAgICAgY29uc3QgbmV4dE5vZGUgPSBza2lwU2libGluZ05vZGVzKHN0YXRlLCBjb250YWluZXJTaXplISArIDEpO1xuICAgICAgICAgICAgc2V0Q3VycmVudE5vZGUoc3RhdGUsIG5leHROb2RlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY2FzZSBJMThuTm9kZUtpbmQuSUNVOiB7XG4gICAgICAgIC8vIElmIHRoZSBjdXJyZW50IG5vZGUgaXMgY29ubmVjdGVkLCB3ZSBuZWVkIHRvIHBvcCB0aGUgbmV4dCBjYXNlIGZyb20gdGhlXG4gICAgICAgIC8vIHF1ZXVlLCBzbyB0aGF0IHRoZSBhY3RpdmUgY2FzZSBpcyBhbHNvIGNvbnNpZGVyZWQgY29ubmVjdGVkLlxuICAgICAgICBjb25zdCBzZWxlY3RlZENhc2UgPSBzdGF0ZS5pc0Nvbm5lY3RlZCA/IGNvbnRleHQuY2FzZVF1ZXVlLnNoaWZ0KCkhIDogbnVsbDtcbiAgICAgICAgY29uc3QgY2hpbGRTdGF0ZSA9IHtjdXJyZW50Tm9kZTogbnVsbCwgaXNDb25uZWN0ZWQ6IGZhbHNlfTtcblxuICAgICAgICAvLyBXZSB0cmF2ZXJzZSB0aHJvdWdoIGVhY2ggY2FzZSwgZXZlbiBpZiBpdCdzIG5vdCBhY3RpdmUsXG4gICAgICAgIC8vIHNvIHRoYXQgd2UgY29ycmVjdGx5IHBvcHVsYXRlIGRpc2Nvbm5lY3RlZCBub2Rlcy5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlT3JOb2Rlcy5jYXNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGNvbGxlY3RJMThuTm9kZXNGcm9tRG9tKFxuICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgIGkgPT09IHNlbGVjdGVkQ2FzZSA/IHN0YXRlIDogY2hpbGRTdGF0ZSxcbiAgICAgICAgICAgIG5vZGVPck5vZGVzLmNhc2VzW2ldLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2VsZWN0ZWRDYXNlICE9PSBudWxsKSB7XG4gICAgICAgICAgLy8gSUNVcyByZXByZXNlbnQgYSBicmFuY2hpbmcgc3RhdGUsIGFuZCB0aGUgc2VsZWN0ZWQgY2FzZSBjb3VsZCBiZSBkaWZmZXJlbnRcbiAgICAgICAgICAvLyB0aGFuIHdoYXQgaXQgd2FzIG9uIHRoZSBzZXJ2ZXIuIEluIHRoYXQgY2FzZSwgd2UgbmVlZCB0byBiZSBhYmxlIHRvIGNsZWFuXG4gICAgICAgICAgLy8gdXAgdGhlIG5vZGVzIGZyb20gdGhlIG9yaWdpbmFsIGNhc2UuIFRvIGRvIHRoYXQsIHdlIHN0b3JlIHRoZSBzZWxlY3RlZCBjYXNlLlxuICAgICAgICAgIGNvbnRleHQuZGVoeWRyYXRlZEljdURhdGEuc2V0KG5vZGVPck5vZGVzLmluZGV4LCB7Y2FzZTogc2VsZWN0ZWRDYXNlLCBub2RlOiBub2RlT3JOb2Rlc30pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSHlkcmF0aW9uIGV4cGVjdHMgdG8gZmluZCB0aGUgSUNVIGFuY2hvciBlbGVtZW50LlxuICAgICAgICBjb25zdCBjdXJyZW50Tm9kZSA9IGFwcGVuZEkxOG5Ob2RlVG9Db2xsZWN0aW9uKGNvbnRleHQsIHN0YXRlLCBub2RlT3JOb2Rlcyk7XG4gICAgICAgIHNldEN1cnJlbnROb2RlKHN0YXRlLCBjdXJyZW50Tm9kZT8ubmV4dFNpYmxpbmcgPz8gbnVsbCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5sZXQgX2NsYWltRGVoeWRyYXRlZEljdUNhc2VJbXBsOiB0eXBlb2YgY2xhaW1EZWh5ZHJhdGVkSWN1Q2FzZUltcGwgPSAoKSA9PiB7XG4gIC8vIG5vb3AgdW5sZXNzIGBlbmFibGVDbGFpbURlaHlkcmF0ZWRJY3VDYXNlSW1wbGAgaXMgaW52b2tlZFxufTtcblxuLyoqXG4gKiBNYXJrIHRoZSBjYXNlIGZvciB0aGUgSUNVIG5vZGUgYXQgdGhlIGdpdmVuIGluZGV4IGluIHRoZSB2aWV3IGFzIGNsYWltZWQsXG4gKiBhbGxvd2luZyBpdHMgbm9kZXMgdG8gYmUgaHlkcmF0ZWQgYW5kIG5vdCBjbGVhbmVkIHVwLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2xhaW1EZWh5ZHJhdGVkSWN1Q2FzZShsVmlldzogTFZpZXcsIGljdUluZGV4OiBudW1iZXIsIGNhc2VJbmRleDogbnVtYmVyKSB7XG4gIF9jbGFpbURlaHlkcmF0ZWRJY3VDYXNlSW1wbChsVmlldywgaWN1SW5kZXgsIGNhc2VJbmRleCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbmFibGVDbGFpbURlaHlkcmF0ZWRJY3VDYXNlSW1wbCgpIHtcbiAgX2NsYWltRGVoeWRyYXRlZEljdUNhc2VJbXBsID0gY2xhaW1EZWh5ZHJhdGVkSWN1Q2FzZUltcGw7XG59XG5cbmZ1bmN0aW9uIGNsYWltRGVoeWRyYXRlZEljdUNhc2VJbXBsKGxWaWV3OiBMVmlldywgaWN1SW5kZXg6IG51bWJlciwgY2FzZUluZGV4OiBudW1iZXIpIHtcbiAgY29uc3QgZGVoeWRyYXRlZEljdURhdGFNYXAgPSBsVmlld1tIWURSQVRJT05dPy5kZWh5ZHJhdGVkSWN1RGF0YTtcbiAgaWYgKGRlaHlkcmF0ZWRJY3VEYXRhTWFwKSB7XG4gICAgY29uc3QgZGVoeWRyYXRlZEljdURhdGEgPSBkZWh5ZHJhdGVkSWN1RGF0YU1hcC5nZXQoaWN1SW5kZXgpO1xuICAgIGlmIChkZWh5ZHJhdGVkSWN1RGF0YT8uY2FzZSA9PT0gY2FzZUluZGV4KSB7XG4gICAgICAvLyBJZiB0aGUgY2FzZSB3ZSdyZSBhdHRlbXB0aW5nIHRvIGNsYWltIG1hdGNoZXMgdGhlIGRlaHlkcmF0ZWQgb25lLFxuICAgICAgLy8gd2UgcmVtb3ZlIGl0IGZyb20gdGhlIG1hcCB0byBtYXJrIGl0IGFzIFwiY2xhaW1lZC5cIlxuICAgICAgZGVoeWRyYXRlZEljdURhdGFNYXAuZGVsZXRlKGljdUluZGV4KTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDbGVhbiB1cCBhbGwgaTE4biBoeWRyYXRpb24gZGF0YSBhc3NvY2lhdGVkIHdpdGggdGhlIGdpdmVuIHZpZXcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbGVhbnVwSTE4bkh5ZHJhdGlvbkRhdGEobFZpZXc6IExWaWV3KSB7XG4gIGNvbnN0IGh5ZHJhdGlvbkluZm8gPSBsVmlld1tIWURSQVRJT05dO1xuICBpZiAoaHlkcmF0aW9uSW5mbykge1xuICAgIGNvbnN0IHtpMThuTm9kZXMsIGRlaHlkcmF0ZWRJY3VEYXRhOiBkZWh5ZHJhdGVkSWN1RGF0YU1hcH0gPSBoeWRyYXRpb25JbmZvO1xuICAgIGlmIChpMThuTm9kZXMgJiYgZGVoeWRyYXRlZEljdURhdGFNYXApIHtcbiAgICAgIGNvbnN0IHJlbmRlcmVyID0gbFZpZXdbUkVOREVSRVJdO1xuICAgICAgZm9yIChjb25zdCBkZWh5ZHJhdGVkSWN1RGF0YSBvZiBkZWh5ZHJhdGVkSWN1RGF0YU1hcC52YWx1ZXMoKSkge1xuICAgICAgICBjbGVhbnVwRGVoeWRyYXRlZEljdURhdGEocmVuZGVyZXIsIGkxOG5Ob2RlcywgZGVoeWRyYXRlZEljdURhdGEpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGh5ZHJhdGlvbkluZm8uaTE4bk5vZGVzID0gdW5kZWZpbmVkO1xuICAgIGh5ZHJhdGlvbkluZm8uZGVoeWRyYXRlZEljdURhdGEgPSB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2xlYW51cERlaHlkcmF0ZWRJY3VEYXRhKFxuICByZW5kZXJlcjogUmVuZGVyZXIsXG4gIGkxOG5Ob2RlczogTWFwPG51bWJlciwgUk5vZGUgfCBudWxsPixcbiAgZGVoeWRyYXRlZEljdURhdGE6IERlaHlkcmF0ZWRJY3VEYXRhLFxuKSB7XG4gIGZvciAoY29uc3Qgbm9kZSBvZiBkZWh5ZHJhdGVkSWN1RGF0YS5ub2RlLmNhc2VzW2RlaHlkcmF0ZWRJY3VEYXRhLmNhc2VdKSB7XG4gICAgY29uc3Qgck5vZGUgPSBpMThuTm9kZXMuZ2V0KG5vZGUuaW5kZXggLSBIRUFERVJfT0ZGU0VUKTtcbiAgICBpZiAock5vZGUpIHtcbiAgICAgIG5hdGl2ZVJlbW92ZU5vZGUocmVuZGVyZXIsIHJOb2RlLCBmYWxzZSk7XG4gICAgfVxuICB9XG59XG4iXX0=