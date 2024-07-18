/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { DECLARATION_COMPONENT_VIEW, HEADER_OFFSET, HOST, } from '../render3/interfaces/view';
import { getFirstNativeNode } from '../render3/node_manipulation';
import { ɵɵresolveBody } from '../render3/util/misc_utils';
import { renderStringify } from '../render3/util/stringify_utils';
import { getNativeByTNode, unwrapRNode } from '../render3/util/view_utils';
import { assertDefined } from '../util/assert';
import { compressNodeLocation, decompressNodeLocation } from './compression';
import { nodeNotFoundAtPathError, nodeNotFoundError, validateSiblingNodeExists, } from './error_handling';
import { NodeNavigationStep, NODES, REFERENCE_NODE_BODY, REFERENCE_NODE_HOST, } from './interfaces';
import { calcSerializedContainerSize, getSegmentHead } from './utils';
/** Whether current TNode is a first node in an <ng-container>. */
function isFirstElementInNgContainer(tNode) {
    return !tNode.prev && tNode.parent?.type === 8 /* TNodeType.ElementContainer */;
}
/** Returns an instruction index (subtracting HEADER_OFFSET). */
function getNoOffsetIndex(tNode) {
    return tNode.index - HEADER_OFFSET;
}
/**
 * Check whether a given node exists, but is disconnected from the DOM.
 */
export function isDisconnectedNode(tNode, lView) {
    return (!(tNode.type & (16 /* TNodeType.Projection */ | 128 /* TNodeType.LetDeclaration */)) &&
        !!lView[tNode.index] &&
        isDisconnectedRNode(unwrapRNode(lView[tNode.index])));
}
/**
 * Check whether the given node exists, but is disconnected from the DOM.
 *
 * Note: we leverage the fact that we have this information available in the DOM emulation
 * layer (in Domino) for now. Longer-term solution should not rely on the DOM emulation and
 * only use internal data structures and state to compute this information.
 */
export function isDisconnectedRNode(rNode) {
    return !!rNode && !rNode.isConnected;
}
/**
 * Locate a node in an i18n tree that corresponds to a given instruction index.
 *
 * @param hydrationInfo The hydration annotation data
 * @param noOffsetIndex the instruction index
 * @returns an RNode that corresponds to the instruction index
 */
export function locateI18nRNodeByIndex(hydrationInfo, noOffsetIndex) {
    const i18nNodes = hydrationInfo.i18nNodes;
    if (i18nNodes) {
        return i18nNodes.get(noOffsetIndex);
    }
    return undefined;
}
/**
 * Attempt to locate an RNode by a path, if it exists.
 *
 * @param hydrationInfo The hydration annotation data
 * @param lView the current lView
 * @param noOffsetIndex the instruction index
 * @returns an RNode that corresponds to the instruction index or null if no path exists
 */
export function tryLocateRNodeByPath(hydrationInfo, lView, noOffsetIndex) {
    const nodes = hydrationInfo.data[NODES];
    const path = nodes?.[noOffsetIndex];
    return path ? locateRNodeByPath(path, lView) : null;
}
/**
 * Locate a node in DOM tree that corresponds to a given TNode.
 *
 * @param hydrationInfo The hydration annotation data
 * @param tView the current tView
 * @param lView the current lView
 * @param tNode the current tNode
 * @returns an RNode that represents a given tNode
 */
export function locateNextRNode(hydrationInfo, tView, lView, tNode) {
    const noOffsetIndex = getNoOffsetIndex(tNode);
    let native = locateI18nRNodeByIndex(hydrationInfo, noOffsetIndex);
    if (native === undefined) {
        const nodes = hydrationInfo.data[NODES];
        if (nodes?.[noOffsetIndex]) {
            // We know the exact location of the node.
            native = locateRNodeByPath(nodes[noOffsetIndex], lView);
        }
        else if (tView.firstChild === tNode) {
            // We create a first node in this view, so we use a reference
            // to the first child in this DOM segment.
            native = hydrationInfo.firstChild;
        }
        else {
            // Locate a node based on a previous sibling or a parent node.
            const previousTNodeParent = tNode.prev === null;
            const previousTNode = (tNode.prev ?? tNode.parent);
            ngDevMode &&
                assertDefined(previousTNode, 'Unexpected state: current TNode does not have a connection ' +
                    'to the previous node or a parent node.');
            if (isFirstElementInNgContainer(tNode)) {
                const noOffsetParentIndex = getNoOffsetIndex(tNode.parent);
                native = getSegmentHead(hydrationInfo, noOffsetParentIndex);
            }
            else {
                let previousRElement = getNativeByTNode(previousTNode, lView);
                if (previousTNodeParent) {
                    native = previousRElement.firstChild;
                }
                else {
                    // If the previous node is an element, but it also has container info,
                    // this means that we are processing a node like `<div #vcrTarget>`, which is
                    // represented in the DOM as `<div></div>...<!--container-->`.
                    // In this case, there are nodes *after* this element and we need to skip
                    // all of them to reach an element that we are looking for.
                    const noOffsetPrevSiblingIndex = getNoOffsetIndex(previousTNode);
                    const segmentHead = getSegmentHead(hydrationInfo, noOffsetPrevSiblingIndex);
                    if (previousTNode.type === 2 /* TNodeType.Element */ && segmentHead) {
                        const numRootNodesToSkip = calcSerializedContainerSize(hydrationInfo, noOffsetPrevSiblingIndex);
                        // `+1` stands for an anchor comment node after all the views in this container.
                        const nodesToSkip = numRootNodesToSkip + 1;
                        // First node after this segment.
                        native = siblingAfter(nodesToSkip, segmentHead);
                    }
                    else {
                        native = previousRElement.nextSibling;
                    }
                }
            }
        }
    }
    return native;
}
/**
 * Skips over a specified number of nodes and returns the next sibling node after that.
 */
export function siblingAfter(skip, from) {
    let currentNode = from;
    for (let i = 0; i < skip; i++) {
        ngDevMode && validateSiblingNodeExists(currentNode);
        currentNode = currentNode.nextSibling;
    }
    return currentNode;
}
/**
 * Helper function to produce a string representation of the navigation steps
 * (in terms of `nextSibling` and `firstChild` navigations). Used in error
 * messages in dev mode.
 */
function stringifyNavigationInstructions(instructions) {
    const container = [];
    for (let i = 0; i < instructions.length; i += 2) {
        const step = instructions[i];
        const repeat = instructions[i + 1];
        for (let r = 0; r < repeat; r++) {
            container.push(step === NodeNavigationStep.FirstChild ? 'firstChild' : 'nextSibling');
        }
    }
    return container.join('.');
}
/**
 * Helper function that navigates from a starting point node (the `from` node)
 * using provided set of navigation instructions (within `path` argument).
 */
function navigateToNode(from, instructions) {
    let node = from;
    for (let i = 0; i < instructions.length; i += 2) {
        const step = instructions[i];
        const repeat = instructions[i + 1];
        for (let r = 0; r < repeat; r++) {
            if (ngDevMode && !node) {
                throw nodeNotFoundAtPathError(from, stringifyNavigationInstructions(instructions));
            }
            switch (step) {
                case NodeNavigationStep.FirstChild:
                    node = node.firstChild;
                    break;
                case NodeNavigationStep.NextSibling:
                    node = node.nextSibling;
                    break;
            }
        }
    }
    if (ngDevMode && !node) {
        throw nodeNotFoundAtPathError(from, stringifyNavigationInstructions(instructions));
    }
    return node;
}
/**
 * Locates an RNode given a set of navigation instructions (which also contains
 * a starting point node info).
 */
function locateRNodeByPath(path, lView) {
    const [referenceNode, ...navigationInstructions] = decompressNodeLocation(path);
    let ref;
    if (referenceNode === REFERENCE_NODE_HOST) {
        ref = lView[DECLARATION_COMPONENT_VIEW][HOST];
    }
    else if (referenceNode === REFERENCE_NODE_BODY) {
        ref = ɵɵresolveBody(lView[DECLARATION_COMPONENT_VIEW][HOST]);
    }
    else {
        const parentElementId = Number(referenceNode);
        ref = unwrapRNode(lView[parentElementId + HEADER_OFFSET]);
    }
    return navigateToNode(ref, navigationInstructions);
}
/**
 * Generate a list of DOM navigation operations to get from node `start` to node `finish`.
 *
 * Note: assumes that node `start` occurs before node `finish` in an in-order traversal of the DOM
 * tree. That is, we should be able to get from `start` to `finish` purely by using `.firstChild`
 * and `.nextSibling` operations.
 */
export function navigateBetween(start, finish) {
    if (start === finish) {
        return [];
    }
    else if (start.parentElement == null || finish.parentElement == null) {
        return null;
    }
    else if (start.parentElement === finish.parentElement) {
        return navigateBetweenSiblings(start, finish);
    }
    else {
        // `finish` is a child of its parent, so the parent will always have a child.
        const parent = finish.parentElement;
        const parentPath = navigateBetween(start, parent);
        const childPath = navigateBetween(parent.firstChild, finish);
        if (!parentPath || !childPath)
            return null;
        return [
            // First navigate to `finish`'s parent
            ...parentPath,
            // Then to its first child.
            NodeNavigationStep.FirstChild,
            // And finally from that node to `finish` (maybe a no-op if we're already there).
            ...childPath,
        ];
    }
}
/**
 * Calculates a path between 2 sibling nodes (generates a number of `NextSibling` navigations).
 * Returns `null` if no such path exists between the given nodes.
 */
function navigateBetweenSiblings(start, finish) {
    const nav = [];
    let node = null;
    for (node = start; node != null && node !== finish; node = node.nextSibling) {
        nav.push(NodeNavigationStep.NextSibling);
    }
    // If the `node` becomes `null` or `undefined` at the end, that means that we
    // didn't find the `end` node, thus return `null` (which would trigger serialization
    // error to be produced).
    return node == null ? null : nav;
}
/**
 * Calculates a path between 2 nodes in terms of `nextSibling` and `firstChild`
 * navigations:
 * - the `from` node is a known node, used as an starting point for the lookup
 *   (the `fromNodeName` argument is a string representation of the node).
 * - the `to` node is a node that the runtime logic would be looking up,
 *   using the path generated by this function.
 */
export function calcPathBetween(from, to, fromNodeName) {
    const path = navigateBetween(from, to);
    return path === null ? null : compressNodeLocation(fromNodeName, path);
}
/**
 * Invoked at serialization time (on the server) when a set of navigation
 * instructions needs to be generated for a TNode.
 */
export function calcPathForNode(tNode, lView, excludedParentNodes) {
    let parentTNode = tNode.parent;
    let parentIndex;
    let parentRNode;
    let referenceNodeName;
    // Skip over all parent nodes that are disconnected from the DOM, such nodes
    // can not be used as anchors.
    //
    // This might happen in certain content projection-based use-cases, where
    // a content of an element is projected and used, when a parent element
    // itself remains detached from DOM. In this scenario we try to find a parent
    // element that is attached to DOM and can act as an anchor instead.
    //
    // It can also happen that the parent node should be excluded, for example,
    // because it belongs to an i18n block, which requires paths which aren't
    // relative to other views in an i18n block.
    while (parentTNode !== null &&
        (isDisconnectedNode(parentTNode, lView) || excludedParentNodes?.has(parentTNode.index))) {
        parentTNode = parentTNode.parent;
    }
    if (parentTNode === null || !(parentTNode.type & 3 /* TNodeType.AnyRNode */)) {
        // If there is no parent TNode or a parent TNode does not represent an RNode
        // (i.e. not a DOM node), use component host element as a reference node.
        parentIndex = referenceNodeName = REFERENCE_NODE_HOST;
        parentRNode = lView[DECLARATION_COMPONENT_VIEW][HOST];
    }
    else {
        // Use parent TNode as a reference node.
        parentIndex = parentTNode.index;
        parentRNode = unwrapRNode(lView[parentIndex]);
        referenceNodeName = renderStringify(parentIndex - HEADER_OFFSET);
    }
    let rNode = unwrapRNode(lView[tNode.index]);
    if (tNode.type & (12 /* TNodeType.AnyContainer */ | 32 /* TNodeType.Icu */)) {
        // For <ng-container> nodes, instead of serializing a reference
        // to the anchor comment node, serialize a location of the first
        // DOM element. Paired with the container size (serialized as a part
        // of `ngh.containers`), it should give enough information for runtime
        // to hydrate nodes in this container.
        const firstRNode = getFirstNativeNode(lView, tNode);
        // If container is not empty, use a reference to the first element,
        // otherwise, rNode would point to an anchor comment node.
        if (firstRNode) {
            rNode = firstRNode;
        }
    }
    let path = calcPathBetween(parentRNode, rNode, referenceNodeName);
    if (path === null && parentRNode !== rNode) {
        // Searching for a path between elements within a host node failed.
        // Trying to find a path to an element starting from the `document.body` instead.
        //
        // Important note: this type of reference is relatively unstable, since Angular
        // may not be able to control parts of the page that the runtime logic navigates
        // through. This is mostly needed to cover "portals" use-case (like menus, dialog boxes,
        // etc), where nodes are content-projected (including direct DOM manipulations) outside
        // of the host node. The better solution is to provide APIs to work with "portals",
        // at which point this code path would not be needed.
        const body = parentRNode.ownerDocument.body;
        path = calcPathBetween(body, rNode, REFERENCE_NODE_BODY);
        if (path === null) {
            // If the path is still empty, it's likely that this node is detached and
            // won't be found during hydration.
            throw nodeNotFoundError(lView, tNode);
        }
    }
    return path;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZV9sb29rdXBfdXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9oeWRyYXRpb24vbm9kZV9sb29rdXBfdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBSUgsT0FBTyxFQUNMLDBCQUEwQixFQUMxQixhQUFhLEVBQ2IsSUFBSSxHQUdMLE1BQU0sNEJBQTRCLENBQUM7QUFDcEMsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDaEUsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ3pELE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxpQ0FBaUMsQ0FBQztBQUNoRSxPQUFPLEVBQUMsZ0JBQWdCLEVBQUUsV0FBVyxFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDekUsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBRTdDLE9BQU8sRUFBQyxvQkFBb0IsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUMzRSxPQUFPLEVBQ0wsdUJBQXVCLEVBQ3ZCLGlCQUFpQixFQUNqQix5QkFBeUIsR0FDMUIsTUFBTSxrQkFBa0IsQ0FBQztBQUMxQixPQUFPLEVBRUwsa0JBQWtCLEVBQ2xCLEtBQUssRUFDTCxtQkFBbUIsRUFDbkIsbUJBQW1CLEdBQ3BCLE1BQU0sY0FBYyxDQUFDO0FBQ3RCLE9BQU8sRUFBQywyQkFBMkIsRUFBRSxjQUFjLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFFcEUsa0VBQWtFO0FBQ2xFLFNBQVMsMkJBQTJCLENBQUMsS0FBWTtJQUMvQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFLElBQUksdUNBQStCLENBQUM7QUFDMUUsQ0FBQztBQUVELGdFQUFnRTtBQUNoRSxTQUFTLGdCQUFnQixDQUFDLEtBQVk7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QUFrQixDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztRQUVwRCxtRUFBbUU7UUFDbkUsMERBQTBEO1FBQzFELElBQUksVUFBVSxFQUFFLENBQUM7WUFDZixLQUFLLEdBQUcsVUFBVSxDQUFDO1FBQ3JCLENBQUM7SUFDSCxDQUFDO0lBQ0QsSUFBSSxJQUFJLEdBQWtCLGVBQWUsQ0FBQyxXQUFtQixFQUFFLEtBQWEsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0lBQ2pHLElBQUksSUFBSSxLQUFLLElBQUksSUFBSSxXQUFXLEtBQUssS0FBSyxFQUFFLENBQUM7UUFDM0MsbUVBQW1FO1FBQ25FLGlGQUFpRjtRQUNqRixFQUFFO1FBQ0YsK0VBQStFO1FBQy9FLGdGQUFnRjtRQUNoRix3RkFBd0Y7UUFDeEYsdUZBQXVGO1FBQ3ZGLG1GQUFtRjtRQUNuRixxREFBcUQ7UUFDckQsTUFBTSxJQUFJLEdBQUksV0FBb0IsQ0FBQyxhQUFjLENBQUMsSUFBWSxDQUFDO1FBQy9ELElBQUksR0FBRyxlQUFlLENBQUMsSUFBSSxFQUFFLEtBQWEsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBRWpFLElBQUksSUFBSSxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ2xCLHlFQUF5RTtZQUN6RSxtQ0FBbUM7WUFDbkMsTUFBTSxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEMsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLElBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtUTm9kZSwgVE5vZGVUeXBlfSBmcm9tICcuLi9yZW5kZXIzL2ludGVyZmFjZXMvbm9kZSc7XG5pbXBvcnQge1JFbGVtZW50LCBSTm9kZX0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL3JlbmRlcmVyX2RvbSc7XG5pbXBvcnQge1xuICBERUNMQVJBVElPTl9DT01QT05FTlRfVklFVyxcbiAgSEVBREVSX09GRlNFVCxcbiAgSE9TVCxcbiAgTFZpZXcsXG4gIFRWaWV3LFxufSBmcm9tICcuLi9yZW5kZXIzL2ludGVyZmFjZXMvdmlldyc7XG5pbXBvcnQge2dldEZpcnN0TmF0aXZlTm9kZX0gZnJvbSAnLi4vcmVuZGVyMy9ub2RlX21hbmlwdWxhdGlvbic7XG5pbXBvcnQge8m1ybVyZXNvbHZlQm9keX0gZnJvbSAnLi4vcmVuZGVyMy91dGlsL21pc2NfdXRpbHMnO1xuaW1wb3J0IHtyZW5kZXJTdHJpbmdpZnl9IGZyb20gJy4uL3JlbmRlcjMvdXRpbC9zdHJpbmdpZnlfdXRpbHMnO1xuaW1wb3J0IHtnZXROYXRpdmVCeVROb2RlLCB1bndyYXBSTm9kZX0gZnJvbSAnLi4vcmVuZGVyMy91dGlsL3ZpZXdfdXRpbHMnO1xuaW1wb3J0IHthc3NlcnREZWZpbmVkfSBmcm9tICcuLi91dGlsL2Fzc2VydCc7XG5cbmltcG9ydCB7Y29tcHJlc3NOb2RlTG9jYXRpb24sIGRlY29tcHJlc3NOb2RlTG9jYXRpb259IGZyb20gJy4vY29tcHJlc3Npb24nO1xuaW1wb3J0IHtcbiAgbm9kZU5vdEZvdW5kQXRQYXRoRXJyb3IsXG4gIG5vZGVOb3RGb3VuZEVycm9yLFxuICB2YWxpZGF0ZVNpYmxpbmdOb2RlRXhpc3RzLFxufSBmcm9tICcuL2Vycm9yX2hhbmRsaW5nJztcbmltcG9ydCB7XG4gIERlaHlkcmF0ZWRWaWV3LFxuICBOb2RlTmF2aWdhdGlvblN0ZXAsXG4gIE5PREVTLFxuICBSRUZFUkVOQ0VfTk9ERV9CT0RZLFxuICBSRUZFUkVOQ0VfTk9ERV9IT1NULFxufSBmcm9tICcuL2ludGVyZmFjZXMnO1xuaW1wb3J0IHtjYWxjU2VyaWFsaXplZENvbnRhaW5lclNpemUsIGdldFNlZ21lbnRIZWFkfSBmcm9tICcuL3V0aWxzJztcblxuLyoqIFdoZXRoZXIgY3VycmVudCBUTm9kZSBpcyBhIGZpcnN0IG5vZGUgaW4gYW4gPG5nLWNvbnRhaW5lcj4uICovXG5mdW5jdGlvbiBpc0ZpcnN0RWxlbWVudEluTmdDb250YWluZXIodE5vZGU6IFROb2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiAhdE5vZGUucHJldiAmJiB0Tm9kZS5wYXJlbnQ/LnR5cGUgPT09IFROb2RlVHlwZS5FbGVtZW50Q29udGFpbmVyO1xufVxuXG4vKiogUmV0dXJucyBhbiBpbnN0cnVjdGlvbiBpbmRleCAoc3VidHJhY3RpbmcgSEVBREVSX09GRlNFVCkuICovXG5mdW5jdGlvbiBnZXROb09mZnNldEluZGV4KHROb2RlOiBUTm9kZSk6IG51bWJlciB7XG4gIHJldHVybiB0Tm9kZS5pbmRleCAtIEhFQURFUl9PRkZTRVQ7XG59XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciBhIGdpdmVuIG5vZGUgZXhpc3RzLCBidXQgaXMgZGlzY29ubmVjdGVkIGZyb20gdGhlIERPTS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRGlzY29ubmVjdGVkTm9kZSh0Tm9kZTogVE5vZGUsIGxWaWV3OiBMVmlldykge1xuICByZXR1cm4gKFxuICAgICEodE5vZGUudHlwZSAmIChUTm9kZVR5cGUuUHJvamVjdGlvbiB8IFROb2RlVHlwZS5MZXREZWNsYXJhdGlvbikpICYmXG4gICAgISFsVmlld1t0Tm9kZS5pbmRleF0gJiZcbiAgICBpc0Rpc2Nvbm5lY3RlZFJOb2RlKHVud3JhcFJOb2RlKGxWaWV3W3ROb2RlLmluZGV4XSkpXG4gICk7XG59XG5cbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgZ2l2ZW4gbm9kZSBleGlzdHMsIGJ1dCBpcyBkaXNjb25uZWN0ZWQgZnJvbSB0aGUgRE9NLlxuICpcbiAqIE5vdGU6IHdlIGxldmVyYWdlIHRoZSBmYWN0IHRoYXQgd2UgaGF2ZSB0aGlzIGluZm9ybWF0aW9uIGF2YWlsYWJsZSBpbiB0aGUgRE9NIGVtdWxhdGlvblxuICogbGF5ZXIgKGluIERvbWlubykgZm9yIG5vdy4gTG9uZ2VyLXRlcm0gc29sdXRpb24gc2hvdWxkIG5vdCByZWx5IG9uIHRoZSBET00gZW11bGF0aW9uIGFuZFxuICogb25seSB1c2UgaW50ZXJuYWwgZGF0YSBzdHJ1Y3R1cmVzIGFuZCBzdGF0ZSB0byBjb21wdXRlIHRoaXMgaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Rpc2Nvbm5lY3RlZFJOb2RlKHJOb2RlOiBSTm9kZSB8IG51bGwpIHtcbiAgcmV0dXJuICEhck5vZGUgJiYgIShyTm9kZSBhcyBOb2RlKS5pc0Nvbm5lY3RlZDtcbn1cblxuLyoqXG4gKiBMb2NhdGUgYSBub2RlIGluIGFuIGkxOG4gdHJlZSB0aGF0IGNvcnJlc3BvbmRzIHRvIGEgZ2l2ZW4gaW5zdHJ1Y3Rpb24gaW5kZXguXG4gKlxuICogQHBhcmFtIGh5ZHJhdGlvbkluZm8gVGhlIGh5ZHJhdGlvbiBhbm5vdGF0aW9uIGRhdGFcbiAqIEBwYXJhbSBub09mZnNldEluZGV4IHRoZSBpbnN0cnVjdGlvbiBpbmRleFxuICogQHJldHVybnMgYW4gUk5vZGUgdGhhdCBjb3JyZXNwb25kcyB0byB0aGUgaW5zdHJ1Y3Rpb24gaW5kZXhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxvY2F0ZUkxOG5STm9kZUJ5SW5kZXg8VCBleHRlbmRzIFJOb2RlPihcbiAgaHlkcmF0aW9uSW5mbzogRGVoeWRyYXRlZFZpZXcsXG4gIG5vT2Zmc2V0SW5kZXg6IG51bWJlcixcbik6IFQgfCBudWxsIHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgaTE4bk5vZGVzID0gaHlkcmF0aW9uSW5mby5pMThuTm9kZXM7XG4gIGlmIChpMThuTm9kZXMpIHtcbiAgICByZXR1cm4gaTE4bk5vZGVzLmdldChub09mZnNldEluZGV4KSBhcyBUIHwgbnVsbCB8IHVuZGVmaW5lZDtcbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIEF0dGVtcHQgdG8gbG9jYXRlIGFuIFJOb2RlIGJ5IGEgcGF0aCwgaWYgaXQgZXhpc3RzLlxuICpcbiAqIEBwYXJhbSBoeWRyYXRpb25JbmZvIFRoZSBoeWRyYXRpb24gYW5ub3RhdGlvbiBkYXRhXG4gKiBAcGFyYW0gbFZpZXcgdGhlIGN1cnJlbnQgbFZpZXdcbiAqIEBwYXJhbSBub09mZnNldEluZGV4IHRoZSBpbnN0cnVjdGlvbiBpbmRleFxuICogQHJldHVybnMgYW4gUk5vZGUgdGhhdCBjb3JyZXNwb25kcyB0byB0aGUgaW5zdHJ1Y3Rpb24gaW5kZXggb3IgbnVsbCBpZiBubyBwYXRoIGV4aXN0c1xuICovXG5leHBvcnQgZnVuY3Rpb24gdHJ5TG9jYXRlUk5vZGVCeVBhdGgoXG4gIGh5ZHJhdGlvbkluZm86IERlaHlkcmF0ZWRWaWV3LFxuICBsVmlldzogTFZpZXc8dW5rbm93bj4sXG4gIG5vT2Zmc2V0SW5kZXg6IG51bWJlcixcbik6IFJOb2RlIHwgbnVsbCB7XG4gIGNvbnN0IG5vZGVzID0gaHlkcmF0aW9uSW5mby5kYXRhW05PREVTXTtcbiAgY29uc3QgcGF0aCA9IG5vZGVzPy5bbm9PZmZzZXRJbmRleF07XG4gIHJldHVybiBwYXRoID8gbG9jYXRlUk5vZGVCeVBhdGgocGF0aCwgbFZpZXcpIDogbnVsbDtcbn1cblxuLyoqXG4gKiBMb2NhdGUgYSBub2RlIGluIERPTSB0cmVlIHRoYXQgY29ycmVzcG9uZHMgdG8gYSBnaXZlbiBUTm9kZS5cbiAqXG4gKiBAcGFyYW0gaHlkcmF0aW9uSW5mbyBUaGUgaHlkcmF0aW9uIGFubm90YXRpb24gZGF0YVxuICogQHBhcmFtIHRWaWV3IHRoZSBjdXJyZW50IHRWaWV3XG4gKiBAcGFyYW0gbFZpZXcgdGhlIGN1cnJlbnQgbFZpZXdcbiAqIEBwYXJhbSB0Tm9kZSB0aGUgY3VycmVudCB0Tm9kZVxuICogQHJldHVybnMgYW4gUk5vZGUgdGhhdCByZXByZXNlbnRzIGEgZ2l2ZW4gdE5vZGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxvY2F0ZU5leHRSTm9kZTxUIGV4dGVuZHMgUk5vZGU+KFxuICBoeWRyYXRpb25JbmZvOiBEZWh5ZHJhdGVkVmlldyxcbiAgdFZpZXc6IFRWaWV3LFxuICBsVmlldzogTFZpZXc8dW5rbm93bj4sXG4gIHROb2RlOiBUTm9kZSxcbik6IFQgfCBudWxsIHtcbiAgY29uc3Qgbm9PZmZzZXRJbmRleCA9IGdldE5vT2Zmc2V0SW5kZXgodE5vZGUpO1xuICBsZXQgbmF0aXZlID0gbG9jYXRlSTE4blJOb2RlQnlJbmRleChoeWRyYXRpb25JbmZvLCBub09mZnNldEluZGV4KTtcblxuICBpZiAobmF0aXZlID09PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBub2RlcyA9IGh5ZHJhdGlvbkluZm8uZGF0YVtOT0RFU107XG4gICAgaWYgKG5vZGVzPy5bbm9PZmZzZXRJbmRleF0pIHtcbiAgICAgIC8vIFdlIGtub3cgdGhlIGV4YWN0IGxvY2F0aW9uIG9mIHRoZSBub2RlLlxuICAgICAgbmF0aXZlID0gbG9jYXRlUk5vZGVCeVBhdGgobm9kZXNbbm9PZmZzZXRJbmRleF0sIGxWaWV3KTtcbiAgICB9IGVsc2UgaWYgKHRWaWV3LmZpcnN0Q2hpbGQgPT09IHROb2RlKSB7XG4gICAgICAvLyBXZSBjcmVhdGUgYSBmaXJzdCBub2RlIGluIHRoaXMgdmlldywgc28gd2UgdXNlIGEgcmVmZXJlbmNlXG4gICAgICAvLyB0byB0aGUgZmlyc3QgY2hpbGQgaW4gdGhpcyBET00gc2VnbWVudC5cbiAgICAgIG5hdGl2ZSA9IGh5ZHJhdGlvbkluZm8uZmlyc3RDaGlsZDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTG9jYXRlIGEgbm9kZSBiYXNlZCBvbiBhIHByZXZpb3VzIHNpYmxpbmcgb3IgYSBwYXJlbnQgbm9kZS5cbiAgICAgIGNvbnN0IHByZXZpb3VzVE5vZGVQYXJlbnQgPSB0Tm9kZS5wcmV2ID09PSBudWxsO1xuICAgICAgY29uc3QgcHJldmlvdXNUTm9kZSA9ICh0Tm9kZS5wcmV2ID8/IHROb2RlLnBhcmVudCkhO1xuICAgICAgbmdEZXZNb2RlICYmXG4gICAgICAgIGFzc2VydERlZmluZWQoXG4gICAgICAgICAgcHJldmlvdXNUTm9kZSxcbiAgICAgICAgICAnVW5leHBlY3RlZCBzdGF0ZTogY3VycmVudCBUTm9kZSBkb2VzIG5vdCBoYXZlIGEgY29ubmVjdGlvbiAnICtcbiAgICAgICAgICAgICd0byB0aGUgcHJldmlvdXMgbm9kZSBvciBhIHBhcmVudCBub2RlLicsXG4gICAgICAgICk7XG4gICAgICBpZiAoaXNGaXJzdEVsZW1lbnRJbk5nQ29udGFpbmVyKHROb2RlKSkge1xuICAgICAgICBjb25zdCBub09mZnNldFBhcmVudEluZGV4ID0gZ2V0Tm9PZmZzZXRJbmRleCh0Tm9kZS5wYXJlbnQhKTtcbiAgICAgICAgbmF0aXZlID0gZ2V0U2VnbWVudEhlYWQoaHlkcmF0aW9uSW5mbywgbm9PZmZzZXRQYXJlbnRJbmRleCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgcHJldmlvdXNSRWxlbWVudCA9IGdldE5hdGl2ZUJ5VE5vZGUocHJldmlvdXNUTm9kZSwgbFZpZXcpO1xuICAgICAgICBpZiAocHJldmlvdXNUTm9kZVBhcmVudCkge1xuICAgICAgICAgIG5hdGl2ZSA9IChwcmV2aW91c1JFbGVtZW50IGFzIFJFbGVtZW50KS5maXJzdENoaWxkO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIElmIHRoZSBwcmV2aW91cyBub2RlIGlzIGFuIGVsZW1lbnQsIGJ1dCBpdCBhbHNvIGhhcyBjb250YWluZXIgaW5mbyxcbiAgICAgICAgICAvLyB0aGlzIG1lYW5zIHRoYXQgd2UgYXJlIHByb2Nlc3NpbmcgYSBub2RlIGxpa2UgYDxkaXYgI3ZjclRhcmdldD5gLCB3aGljaCBpc1xuICAgICAgICAgIC8vIHJlcHJlc2VudGVkIGluIHRoZSBET00gYXMgYDxkaXY+PC9kaXY+Li4uPCEtLWNvbnRhaW5lci0tPmAuXG4gICAgICAgICAgLy8gSW4gdGhpcyBjYXNlLCB0aGVyZSBhcmUgbm9kZXMgKmFmdGVyKiB0aGlzIGVsZW1lbnQgYW5kIHdlIG5lZWQgdG8gc2tpcFxuICAgICAgICAgIC8vIGFsbCBvZiB0aGVtIHRvIHJlYWNoIGFuIGVsZW1lbnQgdGhhdCB3ZSBhcmUgbG9va2luZyBmb3IuXG4gICAgICAgICAgY29uc3Qgbm9PZmZzZXRQcmV2U2libGluZ0luZGV4ID0gZ2V0Tm9PZmZzZXRJbmRleChwcmV2aW91c1ROb2RlKTtcbiAgICAgICAgICBjb25zdCBzZWdtZW50SGVhZCA9IGdldFNlZ21lbnRIZWFkKGh5ZHJhdGlvbkluZm8sIG5vT2Zmc2V0UHJldlNpYmxpbmdJbmRleCk7XG4gICAgICAgICAgaWYgKHByZXZpb3VzVE5vZGUudHlwZSA9PT0gVE5vZGVUeXBlLkVsZW1lbnQgJiYgc2VnbWVudEhlYWQpIHtcbiAgICAgICAgICAgIGNvbnN0IG51bVJvb3ROb2Rlc1RvU2tpcCA9IGNhbGNTZXJpYWxpemVkQ29udGFpbmVyU2l6ZShcbiAgICAgICAgICAgICAgaHlkcmF0aW9uSW5mbyxcbiAgICAgICAgICAgICAgbm9PZmZzZXRQcmV2U2libGluZ0luZGV4LFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIC8vIGArMWAgc3RhbmRzIGZvciBhbiBhbmNob3IgY29tbWVudCBub2RlIGFmdGVyIGFsbCB0aGUgdmlld3MgaW4gdGhpcyBjb250YWluZXIuXG4gICAgICAgICAgICBjb25zdCBub2Rlc1RvU2tpcCA9IG51bVJvb3ROb2Rlc1RvU2tpcCArIDE7XG4gICAgICAgICAgICAvLyBGaXJzdCBub2RlIGFmdGVyIHRoaXMgc2VnbWVudC5cbiAgICAgICAgICAgIG5hdGl2ZSA9IHNpYmxpbmdBZnRlcihub2Rlc1RvU2tpcCwgc2VnbWVudEhlYWQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBuYXRpdmUgPSBwcmV2aW91c1JFbGVtZW50Lm5leHRTaWJsaW5nO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gbmF0aXZlIGFzIFQ7XG59XG5cbi8qKlxuICogU2tpcHMgb3ZlciBhIHNwZWNpZmllZCBudW1iZXIgb2Ygbm9kZXMgYW5kIHJldHVybnMgdGhlIG5leHQgc2libGluZyBub2RlIGFmdGVyIHRoYXQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzaWJsaW5nQWZ0ZXI8VCBleHRlbmRzIFJOb2RlPihza2lwOiBudW1iZXIsIGZyb206IFJOb2RlKTogVCB8IG51bGwge1xuICBsZXQgY3VycmVudE5vZGUgPSBmcm9tO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHNraXA7IGkrKykge1xuICAgIG5nRGV2TW9kZSAmJiB2YWxpZGF0ZVNpYmxpbmdOb2RlRXhpc3RzKGN1cnJlbnROb2RlKTtcbiAgICBjdXJyZW50Tm9kZSA9IGN1cnJlbnROb2RlLm5leHRTaWJsaW5nITtcbiAgfVxuICByZXR1cm4gY3VycmVudE5vZGUgYXMgVDtcbn1cblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdG8gcHJvZHVjZSBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgbmF2aWdhdGlvbiBzdGVwc1xuICogKGluIHRlcm1zIG9mIGBuZXh0U2libGluZ2AgYW5kIGBmaXJzdENoaWxkYCBuYXZpZ2F0aW9ucykuIFVzZWQgaW4gZXJyb3JcbiAqIG1lc3NhZ2VzIGluIGRldiBtb2RlLlxuICovXG5mdW5jdGlvbiBzdHJpbmdpZnlOYXZpZ2F0aW9uSW5zdHJ1Y3Rpb25zKGluc3RydWN0aW9uczogKG51bWJlciB8IE5vZGVOYXZpZ2F0aW9uU3RlcClbXSk6IHN0cmluZyB7XG4gIGNvbnN0IGNvbnRhaW5lciA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGluc3RydWN0aW9ucy5sZW5ndGg7IGkgKz0gMikge1xuICAgIGNvbnN0IHN0ZXAgPSBpbnN0cnVjdGlvbnNbaV07XG4gICAgY29uc3QgcmVwZWF0ID0gaW5zdHJ1Y3Rpb25zW2kgKyAxXSBhcyBudW1iZXI7XG4gICAgZm9yIChsZXQgciA9IDA7IHIgPCByZXBlYXQ7IHIrKykge1xuICAgICAgY29udGFpbmVyLnB1c2goc3RlcCA9PT0gTm9kZU5hdmlnYXRpb25TdGVwLkZpcnN0Q2hpbGQgPyAnZmlyc3RDaGlsZCcgOiAnbmV4dFNpYmxpbmcnKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNvbnRhaW5lci5qb2luKCcuJyk7XG59XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHRoYXQgbmF2aWdhdGVzIGZyb20gYSBzdGFydGluZyBwb2ludCBub2RlICh0aGUgYGZyb21gIG5vZGUpXG4gKiB1c2luZyBwcm92aWRlZCBzZXQgb2YgbmF2aWdhdGlvbiBpbnN0cnVjdGlvbnMgKHdpdGhpbiBgcGF0aGAgYXJndW1lbnQpLlxuICovXG5mdW5jdGlvbiBuYXZpZ2F0ZVRvTm9kZShmcm9tOiBOb2RlLCBpbnN0cnVjdGlvbnM6IChudW1iZXIgfCBOb2RlTmF2aWdhdGlvblN0ZXApW10pOiBSTm9kZSB7XG4gIGxldCBub2RlID0gZnJvbTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnN0cnVjdGlvbnMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICBjb25zdCBzdGVwID0gaW5zdHJ1Y3Rpb25zW2ldO1xuICAgIGNvbnN0IHJlcGVhdCA9IGluc3RydWN0aW9uc1tpICsgMV0gYXMgbnVtYmVyO1xuICAgIGZvciAobGV0IHIgPSAwOyByIDwgcmVwZWF0OyByKyspIHtcbiAgICAgIGlmIChuZ0Rldk1vZGUgJiYgIW5vZGUpIHtcbiAgICAgICAgdGhyb3cgbm9kZU5vdEZvdW5kQXRQYXRoRXJyb3IoZnJvbSwgc3RyaW5naWZ5TmF2aWdhdGlvbkluc3RydWN0aW9ucyhpbnN0cnVjdGlvbnMpKTtcbiAgICAgIH1cbiAgICAgIHN3aXRjaCAoc3RlcCkge1xuICAgICAgICBjYXNlIE5vZGVOYXZpZ2F0aW9uU3RlcC5GaXJzdENoaWxkOlxuICAgICAgICAgIG5vZGUgPSBub2RlLmZpcnN0Q2hpbGQhO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIE5vZGVOYXZpZ2F0aW9uU3RlcC5OZXh0U2libGluZzpcbiAgICAgICAgICBub2RlID0gbm9kZS5uZXh0U2libGluZyE7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChuZ0Rldk1vZGUgJiYgIW5vZGUpIHtcbiAgICB0aHJvdyBub2RlTm90Rm91bmRBdFBhdGhFcnJvcihmcm9tLCBzdHJpbmdpZnlOYXZpZ2F0aW9uSW5zdHJ1Y3Rpb25zKGluc3RydWN0aW9ucykpO1xuICB9XG4gIHJldHVybiBub2RlIGFzIFJOb2RlO1xufVxuXG4vKipcbiAqIExvY2F0ZXMgYW4gUk5vZGUgZ2l2ZW4gYSBzZXQgb2YgbmF2aWdhdGlvbiBpbnN0cnVjdGlvbnMgKHdoaWNoIGFsc28gY29udGFpbnNcbiAqIGEgc3RhcnRpbmcgcG9pbnQgbm9kZSBpbmZvKS5cbiAqL1xuZnVuY3Rpb24gbG9jYXRlUk5vZGVCeVBhdGgocGF0aDogc3RyaW5nLCBsVmlldzogTFZpZXcpOiBSTm9kZSB7XG4gIGNvbnN0IFtyZWZlcmVuY2VOb2RlLCAuLi5uYXZpZ2F0aW9uSW5zdHJ1Y3Rpb25zXSA9IGRlY29tcHJlc3NOb2RlTG9jYXRpb24ocGF0aCk7XG4gIGxldCByZWY6IEVsZW1lbnQ7XG4gIGlmIChyZWZlcmVuY2VOb2RlID09PSBSRUZFUkVOQ0VfTk9ERV9IT1NUKSB7XG4gICAgcmVmID0gbFZpZXdbREVDTEFSQVRJT05fQ09NUE9ORU5UX1ZJRVddW0hPU1RdIGFzIHVua25vd24gYXMgRWxlbWVudDtcbiAgfSBlbHNlIGlmIChyZWZlcmVuY2VOb2RlID09PSBSRUZFUkVOQ0VfTk9ERV9CT0RZKSB7XG4gICAgcmVmID0gybXJtXJlc29sdmVCb2R5KFxuICAgICAgbFZpZXdbREVDTEFSQVRJT05fQ09NUE9ORU5UX1ZJRVddW0hPU1RdIGFzIFJFbGVtZW50ICYge293bmVyRG9jdW1lbnQ6IERvY3VtZW50fSxcbiAgICApO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IHBhcmVudEVsZW1lbnRJZCA9IE51bWJlcihyZWZlcmVuY2VOb2RlKTtcbiAgICByZWYgPSB1bndyYXBSTm9kZSgobFZpZXcgYXMgYW55KVtwYXJlbnRFbGVtZW50SWQgKyBIRUFERVJfT0ZGU0VUXSkgYXMgRWxlbWVudDtcbiAgfVxuICByZXR1cm4gbmF2aWdhdGVUb05vZGUocmVmLCBuYXZpZ2F0aW9uSW5zdHJ1Y3Rpb25zKTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZSBhIGxpc3Qgb2YgRE9NIG5hdmlnYXRpb24gb3BlcmF0aW9ucyB0byBnZXQgZnJvbSBub2RlIGBzdGFydGAgdG8gbm9kZSBgZmluaXNoYC5cbiAqXG4gKiBOb3RlOiBhc3N1bWVzIHRoYXQgbm9kZSBgc3RhcnRgIG9jY3VycyBiZWZvcmUgbm9kZSBgZmluaXNoYCBpbiBhbiBpbi1vcmRlciB0cmF2ZXJzYWwgb2YgdGhlIERPTVxuICogdHJlZS4gVGhhdCBpcywgd2Ugc2hvdWxkIGJlIGFibGUgdG8gZ2V0IGZyb20gYHN0YXJ0YCB0byBgZmluaXNoYCBwdXJlbHkgYnkgdXNpbmcgYC5maXJzdENoaWxkYFxuICogYW5kIGAubmV4dFNpYmxpbmdgIG9wZXJhdGlvbnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBuYXZpZ2F0ZUJldHdlZW4oc3RhcnQ6IE5vZGUsIGZpbmlzaDogTm9kZSk6IE5vZGVOYXZpZ2F0aW9uU3RlcFtdIHwgbnVsbCB7XG4gIGlmIChzdGFydCA9PT0gZmluaXNoKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9IGVsc2UgaWYgKHN0YXJ0LnBhcmVudEVsZW1lbnQgPT0gbnVsbCB8fCBmaW5pc2gucGFyZW50RWxlbWVudCA9PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gZWxzZSBpZiAoc3RhcnQucGFyZW50RWxlbWVudCA9PT0gZmluaXNoLnBhcmVudEVsZW1lbnQpIHtcbiAgICByZXR1cm4gbmF2aWdhdGVCZXR3ZWVuU2libGluZ3Moc3RhcnQsIGZpbmlzaCk7XG4gIH0gZWxzZSB7XG4gICAgLy8gYGZpbmlzaGAgaXMgYSBjaGlsZCBvZiBpdHMgcGFyZW50LCBzbyB0aGUgcGFyZW50IHdpbGwgYWx3YXlzIGhhdmUgYSBjaGlsZC5cbiAgICBjb25zdCBwYXJlbnQgPSBmaW5pc2gucGFyZW50RWxlbWVudCE7XG5cbiAgICBjb25zdCBwYXJlbnRQYXRoID0gbmF2aWdhdGVCZXR3ZWVuKHN0YXJ0LCBwYXJlbnQpO1xuICAgIGNvbnN0IGNoaWxkUGF0aCA9IG5hdmlnYXRlQmV0d2VlbihwYXJlbnQuZmlyc3RDaGlsZCEsIGZpbmlzaCk7XG4gICAgaWYgKCFwYXJlbnRQYXRoIHx8ICFjaGlsZFBhdGgpIHJldHVybiBudWxsO1xuXG4gICAgcmV0dXJuIFtcbiAgICAgIC8vIEZpcnN0IG5hdmlnYXRlIHRvIGBmaW5pc2hgJ3MgcGFyZW50XG4gICAgICAuLi5wYXJlbnRQYXRoLFxuICAgICAgLy8gVGhlbiB0byBpdHMgZmlyc3QgY2hpbGQuXG4gICAgICBOb2RlTmF2aWdhdGlvblN0ZXAuRmlyc3RDaGlsZCxcbiAgICAgIC8vIEFuZCBmaW5hbGx5IGZyb20gdGhhdCBub2RlIHRvIGBmaW5pc2hgIChtYXliZSBhIG5vLW9wIGlmIHdlJ3JlIGFscmVhZHkgdGhlcmUpLlxuICAgICAgLi4uY2hpbGRQYXRoLFxuICAgIF07XG4gIH1cbn1cblxuLyoqXG4gKiBDYWxjdWxhdGVzIGEgcGF0aCBiZXR3ZWVuIDIgc2libGluZyBub2RlcyAoZ2VuZXJhdGVzIGEgbnVtYmVyIG9mIGBOZXh0U2libGluZ2AgbmF2aWdhdGlvbnMpLlxuICogUmV0dXJucyBgbnVsbGAgaWYgbm8gc3VjaCBwYXRoIGV4aXN0cyBiZXR3ZWVuIHRoZSBnaXZlbiBub2Rlcy5cbiAqL1xuZnVuY3Rpb24gbmF2aWdhdGVCZXR3ZWVuU2libGluZ3Moc3RhcnQ6IE5vZGUsIGZpbmlzaDogTm9kZSk6IE5vZGVOYXZpZ2F0aW9uU3RlcFtdIHwgbnVsbCB7XG4gIGNvbnN0IG5hdjogTm9kZU5hdmlnYXRpb25TdGVwW10gPSBbXTtcbiAgbGV0IG5vZGU6IE5vZGUgfCBudWxsID0gbnVsbDtcbiAgZm9yIChub2RlID0gc3RhcnQ7IG5vZGUgIT0gbnVsbCAmJiBub2RlICE9PSBmaW5pc2g7IG5vZGUgPSBub2RlLm5leHRTaWJsaW5nKSB7XG4gICAgbmF2LnB1c2goTm9kZU5hdmlnYXRpb25TdGVwLk5leHRTaWJsaW5nKTtcbiAgfVxuICAvLyBJZiB0aGUgYG5vZGVgIGJlY29tZXMgYG51bGxgIG9yIGB1bmRlZmluZWRgIGF0IHRoZSBlbmQsIHRoYXQgbWVhbnMgdGhhdCB3ZVxuICAvLyBkaWRuJ3QgZmluZCB0aGUgYGVuZGAgbm9kZSwgdGh1cyByZXR1cm4gYG51bGxgICh3aGljaCB3b3VsZCB0cmlnZ2VyIHNlcmlhbGl6YXRpb25cbiAgLy8gZXJyb3IgdG8gYmUgcHJvZHVjZWQpLlxuICByZXR1cm4gbm9kZSA9PSBudWxsID8gbnVsbCA6IG5hdjtcbn1cblxuLyoqXG4gKiBDYWxjdWxhdGVzIGEgcGF0aCBiZXR3ZWVuIDIgbm9kZXMgaW4gdGVybXMgb2YgYG5leHRTaWJsaW5nYCBhbmQgYGZpcnN0Q2hpbGRgXG4gKiBuYXZpZ2F0aW9uczpcbiAqIC0gdGhlIGBmcm9tYCBub2RlIGlzIGEga25vd24gbm9kZSwgdXNlZCBhcyBhbiBzdGFydGluZyBwb2ludCBmb3IgdGhlIGxvb2t1cFxuICogICAodGhlIGBmcm9tTm9kZU5hbWVgIGFyZ3VtZW50IGlzIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBub2RlKS5cbiAqIC0gdGhlIGB0b2Agbm9kZSBpcyBhIG5vZGUgdGhhdCB0aGUgcnVudGltZSBsb2dpYyB3b3VsZCBiZSBsb29raW5nIHVwLFxuICogICB1c2luZyB0aGUgcGF0aCBnZW5lcmF0ZWQgYnkgdGhpcyBmdW5jdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNhbGNQYXRoQmV0d2Vlbihmcm9tOiBOb2RlLCB0bzogTm9kZSwgZnJvbU5vZGVOYW1lOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgcGF0aCA9IG5hdmlnYXRlQmV0d2Vlbihmcm9tLCB0byk7XG4gIHJldHVybiBwYXRoID09PSBudWxsID8gbnVsbCA6IGNvbXByZXNzTm9kZUxvY2F0aW9uKGZyb21Ob2RlTmFtZSwgcGF0aCk7XG59XG5cbi8qKlxuICogSW52b2tlZCBhdCBzZXJpYWxpemF0aW9uIHRpbWUgKG9uIHRoZSBzZXJ2ZXIpIHdoZW4gYSBzZXQgb2YgbmF2aWdhdGlvblxuICogaW5zdHJ1Y3Rpb25zIG5lZWRzIHRvIGJlIGdlbmVyYXRlZCBmb3IgYSBUTm9kZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNhbGNQYXRoRm9yTm9kZShcbiAgdE5vZGU6IFROb2RlLFxuICBsVmlldzogTFZpZXcsXG4gIGV4Y2x1ZGVkUGFyZW50Tm9kZXM6IFNldDxudW1iZXI+IHwgbnVsbCxcbik6IHN0cmluZyB7XG4gIGxldCBwYXJlbnRUTm9kZSA9IHROb2RlLnBhcmVudDtcbiAgbGV0IHBhcmVudEluZGV4OiBudW1iZXIgfCBzdHJpbmc7XG4gIGxldCBwYXJlbnRSTm9kZTogUk5vZGU7XG4gIGxldCByZWZlcmVuY2VOb2RlTmFtZTogc3RyaW5nO1xuXG4gIC8vIFNraXAgb3ZlciBhbGwgcGFyZW50IG5vZGVzIHRoYXQgYXJlIGRpc2Nvbm5lY3RlZCBmcm9tIHRoZSBET00sIHN1Y2ggbm9kZXNcbiAgLy8gY2FuIG5vdCBiZSB1c2VkIGFzIGFuY2hvcnMuXG4gIC8vXG4gIC8vIFRoaXMgbWlnaHQgaGFwcGVuIGluIGNlcnRhaW4gY29udGVudCBwcm9qZWN0aW9uLWJhc2VkIHVzZS1jYXNlcywgd2hlcmVcbiAgLy8gYSBjb250ZW50IG9mIGFuIGVsZW1lbnQgaXMgcHJvamVjdGVkIGFuZCB1c2VkLCB3aGVuIGEgcGFyZW50IGVsZW1lbnRcbiAgLy8gaXRzZWxmIHJlbWFpbnMgZGV0YWNoZWQgZnJvbSBET00uIEluIHRoaXMgc2NlbmFyaW8gd2UgdHJ5IHRvIGZpbmQgYSBwYXJlbnRcbiAgLy8gZWxlbWVudCB0aGF0IGlzIGF0dGFjaGVkIHRvIERPTSBhbmQgY2FuIGFjdCBhcyBhbiBhbmNob3IgaW5zdGVhZC5cbiAgLy9cbiAgLy8gSXQgY2FuIGFsc28gaGFwcGVuIHRoYXQgdGhlIHBhcmVudCBub2RlIHNob3VsZCBiZSBleGNsdWRlZCwgZm9yIGV4YW1wbGUsXG4gIC8vIGJlY2F1c2UgaXQgYmVsb25ncyB0byBhbiBpMThuIGJsb2NrLCB3aGljaCByZXF1aXJlcyBwYXRocyB3aGljaCBhcmVuJ3RcbiAgLy8gcmVsYXRpdmUgdG8gb3RoZXIgdmlld3MgaW4gYW4gaTE4biBibG9jay5cbiAgd2hpbGUgKFxuICAgIHBhcmVudFROb2RlICE9PSBudWxsICYmXG4gICAgKGlzRGlzY29ubmVjdGVkTm9kZShwYXJlbnRUTm9kZSwgbFZpZXcpIHx8IGV4Y2x1ZGVkUGFyZW50Tm9kZXM/LmhhcyhwYXJlbnRUTm9kZS5pbmRleCkpXG4gICkge1xuICAgIHBhcmVudFROb2RlID0gcGFyZW50VE5vZGUucGFyZW50O1xuICB9XG5cbiAgaWYgKHBhcmVudFROb2RlID09PSBudWxsIHx8ICEocGFyZW50VE5vZGUudHlwZSAmIFROb2RlVHlwZS5BbnlSTm9kZSkpIHtcbiAgICAvLyBJZiB0aGVyZSBpcyBubyBwYXJlbnQgVE5vZGUgb3IgYSBwYXJlbnQgVE5vZGUgZG9lcyBub3QgcmVwcmVzZW50IGFuIFJOb2RlXG4gICAgLy8gKGkuZS4gbm90IGEgRE9NIG5vZGUpLCB1c2UgY29tcG9uZW50IGhvc3QgZWxlbWVudCBhcyBhIHJlZmVyZW5jZSBub2RlLlxuICAgIHBhcmVudEluZGV4ID0gcmVmZXJlbmNlTm9kZU5hbWUgPSBSRUZFUkVOQ0VfTk9ERV9IT1NUO1xuICAgIHBhcmVudFJOb2RlID0gbFZpZXdbREVDTEFSQVRJT05fQ09NUE9ORU5UX1ZJRVddW0hPU1RdITtcbiAgfSBlbHNlIHtcbiAgICAvLyBVc2UgcGFyZW50IFROb2RlIGFzIGEgcmVmZXJlbmNlIG5vZGUuXG4gICAgcGFyZW50SW5kZXggPSBwYXJlbnRUTm9kZS5pbmRleDtcbiAgICBwYXJlbnRSTm9kZSA9IHVud3JhcFJOb2RlKGxWaWV3W3BhcmVudEluZGV4XSk7XG4gICAgcmVmZXJlbmNlTm9kZU5hbWUgPSByZW5kZXJTdHJpbmdpZnkocGFyZW50SW5kZXggLSBIRUFERVJfT0ZGU0VUKTtcbiAgfVxuICBsZXQgck5vZGUgPSB1bndyYXBSTm9kZShsVmlld1t0Tm9kZS5pbmRleF0pO1xuICBpZiAodE5vZGUudHlwZSAmIChUTm9kZVR5cGUuQW55Q29udGFpbmVyIHwgVE5vZGVUeXBlLkljdSkpIHtcbiAgICAvLyBGb3IgPG5nLWNvbnRhaW5lcj4gbm9kZXMsIGluc3RlYWQgb2Ygc2VyaWFsaXppbmcgYSByZWZlcmVuY2VcbiAgICAvLyB0byB0aGUgYW5jaG9yIGNvbW1lbnQgbm9kZSwgc2VyaWFsaXplIGEgbG9jYXRpb24gb2YgdGhlIGZpcnN0XG4gICAgLy8gRE9NIGVsZW1lbnQuIFBhaXJlZCB3aXRoIHRoZSBjb250YWluZXIgc2l6ZSAoc2VyaWFsaXplZCBhcyBhIHBhcnRcbiAgICAvLyBvZiBgbmdoLmNvbnRhaW5lcnNgKSwgaXQgc2hvdWxkIGdpdmUgZW5vdWdoIGluZm9ybWF0aW9uIGZvciBydW50aW1lXG4gICAgLy8gdG8gaHlkcmF0ZSBub2RlcyBpbiB0aGlzIGNvbnRhaW5lci5cbiAgICBjb25zdCBmaXJzdFJOb2RlID0gZ2V0Rmlyc3ROYXRpdmVOb2RlKGxWaWV3LCB0Tm9kZSk7XG5cbiAgICAvLyBJZiBjb250YWluZXIgaXMgbm90IGVtcHR5LCB1c2UgYSByZWZlcmVuY2UgdG8gdGhlIGZpcnN0IGVsZW1lbnQsXG4gICAgLy8gb3RoZXJ3aXNlLCByTm9kZSB3b3VsZCBwb2ludCB0byBhbiBhbmNob3IgY29tbWVudCBub2RlLlxuICAgIGlmIChmaXJzdFJOb2RlKSB7XG4gICAgICByTm9kZSA9IGZpcnN0Uk5vZGU7XG4gICAgfVxuICB9XG4gIGxldCBwYXRoOiBzdHJpbmcgfCBudWxsID0gY2FsY1BhdGhCZXR3ZWVuKHBhcmVudFJOb2RlIGFzIE5vZGUsIHJOb2RlIGFzIE5vZGUsIHJlZmVyZW5jZU5vZGVOYW1lKTtcbiAgaWYgKHBhdGggPT09IG51bGwgJiYgcGFyZW50Uk5vZGUgIT09IHJOb2RlKSB7XG4gICAgLy8gU2VhcmNoaW5nIGZvciBhIHBhdGggYmV0d2VlbiBlbGVtZW50cyB3aXRoaW4gYSBob3N0IG5vZGUgZmFpbGVkLlxuICAgIC8vIFRyeWluZyB0byBmaW5kIGEgcGF0aCB0byBhbiBlbGVtZW50IHN0YXJ0aW5nIGZyb20gdGhlIGBkb2N1bWVudC5ib2R5YCBpbnN0ZWFkLlxuICAgIC8vXG4gICAgLy8gSW1wb3J0YW50IG5vdGU6IHRoaXMgdHlwZSBvZiByZWZlcmVuY2UgaXMgcmVsYXRpdmVseSB1bnN0YWJsZSwgc2luY2UgQW5ndWxhclxuICAgIC8vIG1heSBub3QgYmUgYWJsZSB0byBjb250cm9sIHBhcnRzIG9mIHRoZSBwYWdlIHRoYXQgdGhlIHJ1bnRpbWUgbG9naWMgbmF2aWdhdGVzXG4gICAgLy8gdGhyb3VnaC4gVGhpcyBpcyBtb3N0bHkgbmVlZGVkIHRvIGNvdmVyIFwicG9ydGFsc1wiIHVzZS1jYXNlIChsaWtlIG1lbnVzLCBkaWFsb2cgYm94ZXMsXG4gICAgLy8gZXRjKSwgd2hlcmUgbm9kZXMgYXJlIGNvbnRlbnQtcHJvamVjdGVkIChpbmNsdWRpbmcgZGlyZWN0IERPTSBtYW5pcHVsYXRpb25zKSBvdXRzaWRlXG4gICAgLy8gb2YgdGhlIGhvc3Qgbm9kZS4gVGhlIGJldHRlciBzb2x1dGlvbiBpcyB0byBwcm92aWRlIEFQSXMgdG8gd29yayB3aXRoIFwicG9ydGFsc1wiLFxuICAgIC8vIGF0IHdoaWNoIHBvaW50IHRoaXMgY29kZSBwYXRoIHdvdWxkIG5vdCBiZSBuZWVkZWQuXG4gICAgY29uc3QgYm9keSA9IChwYXJlbnRSTm9kZSBhcyBOb2RlKS5vd25lckRvY3VtZW50IS5ib2R5IGFzIE5vZGU7XG4gICAgcGF0aCA9IGNhbGNQYXRoQmV0d2Vlbihib2R5LCByTm9kZSBhcyBOb2RlLCBSRUZFUkVOQ0VfTk9ERV9CT0RZKTtcblxuICAgIGlmIChwYXRoID09PSBudWxsKSB7XG4gICAgICAvLyBJZiB0aGUgcGF0aCBpcyBzdGlsbCBlbXB0eSwgaXQncyBsaWtlbHkgdGhhdCB0aGlzIG5vZGUgaXMgZGV0YWNoZWQgYW5kXG4gICAgICAvLyB3b24ndCBiZSBmb3VuZCBkdXJpbmcgaHlkcmF0aW9uLlxuICAgICAgdGhyb3cgbm9kZU5vdEZvdW5kRXJyb3IobFZpZXcsIHROb2RlKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHBhdGghO1xufVxuIl19