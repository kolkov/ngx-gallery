/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { getComponent } from '../render3/util/discovery_utils';
import { getDocument } from '../render3/interfaces/document';
import { isRootView } from '../render3/interfaces/type_checks';
import { HEADER_OFFSET, TVIEW } from '../render3/interfaces/view';
import { makeStateKey, TransferState } from '../transfer_state';
import { assertDefined } from '../util/assert';
import { CONTAINERS, DISCONNECTED_NODES, ELEMENT_CONTAINERS, MULTIPLIER, NUM_ROOT_NODES, } from './interfaces';
/**
 * The name of the key used in the TransferState collection,
 * where hydration information is located.
 */
const TRANSFER_STATE_TOKEN_ID = '__nghData__';
/**
 * Lookup key used to reference DOM hydration data (ngh) in `TransferState`.
 */
export const NGH_DATA_KEY = makeStateKey(TRANSFER_STATE_TOKEN_ID);
/**
 * The name of the attribute that would be added to host component
 * nodes and contain a reference to a particular slot in transferred
 * state that contains the necessary hydration info for this component.
 */
export const NGH_ATTR_NAME = 'ngh';
/**
 * Marker used in a comment node to ensure hydration content integrity
 */
export const SSR_CONTENT_INTEGRITY_MARKER = 'nghm';
/**
 * Reference to a function that reads `ngh` attribute value from a given RNode
 * and retrieves hydration information from the TransferState using that value
 * as an index. Returns `null` by default, when hydration is not enabled.
 *
 * @param rNode Component's host element.
 * @param injector Injector that this component has access to.
 * @param isRootView Specifies whether we trying to read hydration info for the root view.
 */
let _retrieveHydrationInfoImpl = () => null;
export function retrieveHydrationInfoImpl(rNode, injector, isRootView = false) {
    let nghAttrValue = rNode.getAttribute(NGH_ATTR_NAME);
    if (nghAttrValue == null)
        return null;
    // For cases when a root component also acts as an anchor node for a ViewContainerRef
    // (for example, when ViewContainerRef is injected in a root component), there is a need
    // to serialize information about the component itself, as well as an LContainer that
    // represents this ViewContainerRef. Effectively, we need to serialize 2 pieces of info:
    // (1) hydration info for the root component itself and (2) hydration info for the
    // ViewContainerRef instance (an LContainer). Each piece of information is included into
    // the hydration data (in the TransferState object) separately, thus we end up with 2 ids.
    // Since we only have 1 root element, we encode both bits of info into a single string:
    // ids are separated by the `|` char (e.g. `10|25`, where `10` is the ngh for a component view
    // and 25 is the `ngh` for a root view which holds LContainer).
    const [componentViewNgh, rootViewNgh] = nghAttrValue.split('|');
    nghAttrValue = isRootView ? rootViewNgh : componentViewNgh;
    if (!nghAttrValue)
        return null;
    // We've read one of the ngh ids, keep the remaining one, so that
    // we can set it back on the DOM element.
    const rootNgh = rootViewNgh ? `|${rootViewNgh}` : '';
    const remainingNgh = isRootView ? componentViewNgh : rootNgh;
    let data = {};
    // An element might have an empty `ngh` attribute value (e.g. `<comp ngh="" />`),
    // which means that no special annotations are required. Do not attempt to read
    // from the TransferState in this case.
    if (nghAttrValue !== '') {
        const transferState = injector.get(TransferState, null, { optional: true });
        if (transferState !== null) {
            const nghData = transferState.get(NGH_DATA_KEY, []);
            // The nghAttrValue is always a number referencing an index
            // in the hydration TransferState data.
            data = nghData[Number(nghAttrValue)];
            // If the `ngh` attribute exists and has a non-empty value,
            // the hydration info *must* be present in the TransferState.
            // If there is no data for some reasons, this is an error.
            ngDevMode && assertDefined(data, 'Unable to retrieve hydration info from the TransferState.');
        }
    }
    const dehydratedView = {
        data,
        firstChild: rNode.firstChild ?? null,
    };
    if (isRootView) {
        // If there is hydration info present for the root view, it means that there was
        // a ViewContainerRef injected in the root component. The root component host element
        // acted as an anchor node in this scenario. As a result, the DOM nodes that represent
        // embedded views in this ViewContainerRef are located as siblings to the host node,
        // i.e. `<app-root /><#VIEW1><#VIEW2>...<!--container-->`. In this case, the current
        // node becomes the first child of this root view and the next sibling is the first
        // element in the DOM segment.
        dehydratedView.firstChild = rNode;
        // We use `0` here, since this is the slot (right after the HEADER_OFFSET)
        // where a component LView or an LContainer is located in a root LView.
        setSegmentHead(dehydratedView, 0, rNode.nextSibling);
    }
    if (remainingNgh) {
        // If we have only used one of the ngh ids, store the remaining one
        // back on this RNode.
        rNode.setAttribute(NGH_ATTR_NAME, remainingNgh);
    }
    else {
        // The `ngh` attribute is cleared from the DOM node now
        // that the data has been retrieved for all indices.
        rNode.removeAttribute(NGH_ATTR_NAME);
    }
    // Note: don't check whether this node was claimed for hydration,
    // because this node might've been previously claimed while processing
    // template instructions.
    ngDevMode && markRNodeAsClaimedByHydration(rNode, /* checkIfAlreadyClaimed */ false);
    ngDevMode && ngDevMode.hydratedComponents++;
    return dehydratedView;
}
/**
 * Sets the implementation for the `retrieveHydrationInfo` function.
 */
export function enableRetrieveHydrationInfoImpl() {
    _retrieveHydrationInfoImpl = retrieveHydrationInfoImpl;
}
/**
 * Retrieves hydration info by reading the value from the `ngh` attribute
 * and accessing a corresponding slot in TransferState storage.
 */
export function retrieveHydrationInfo(rNode, injector, isRootView = false) {
    return _retrieveHydrationInfoImpl(rNode, injector, isRootView);
}
/**
 * Retrieves the necessary object from a given ViewRef to serialize:
 *  - an LView for component views
 *  - an LContainer for cases when component acts as a ViewContainerRef anchor
 *  - `null` in case of an embedded view
 */
export function getLNodeForHydration(viewRef) {
    // Reading an internal field from `ViewRef` instance.
    let lView = viewRef._lView;
    const tView = lView[TVIEW];
    // A registered ViewRef might represent an instance of an
    // embedded view, in which case we do not need to annotate it.
    if (tView.type === 2 /* TViewType.Embedded */) {
        return null;
    }
    // Check if it's a root view and if so, retrieve component's
    // LView from the first slot after the header.
    if (isRootView(lView)) {
        lView = lView[HEADER_OFFSET];
    }
    return lView;
}
function getTextNodeContent(node) {
    return node.textContent?.replace(/\s/gm, '');
}
/**
 * Restores text nodes and separators into the DOM that were lost during SSR
 * serialization. The hydration process replaces empty text nodes and text
 * nodes that are immediately adjacent to other text nodes with comment nodes
 * that this method filters on to restore those missing nodes that the
 * hydration process is expecting to be present.
 *
 * @param node The app's root HTML Element
 */
export function processTextNodeMarkersBeforeHydration(node) {
    const doc = getDocument();
    const commentNodesIterator = doc.createNodeIterator(node, NodeFilter.SHOW_COMMENT, {
        acceptNode(node) {
            const content = getTextNodeContent(node);
            const isTextNodeMarker = content === "ngetn" /* TextNodeMarker.EmptyNode */ || content === "ngtns" /* TextNodeMarker.Separator */;
            return isTextNodeMarker ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
    });
    let currentNode;
    // We cannot modify the DOM while using the commentIterator,
    // because it throws off the iterator state.
    // So we collect all marker nodes first and then follow up with
    // applying the changes to the DOM: either inserting an empty node
    // or just removing the marker if it was used as a separator.
    const nodes = [];
    while ((currentNode = commentNodesIterator.nextNode())) {
        nodes.push(currentNode);
    }
    for (const node of nodes) {
        if (node.textContent === "ngetn" /* TextNodeMarker.EmptyNode */) {
            node.replaceWith(doc.createTextNode(''));
        }
        else {
            node.remove();
        }
    }
}
/**
 * Internal type that represents a claimed node.
 * Only used in dev mode.
 */
export var HydrationStatus;
(function (HydrationStatus) {
    HydrationStatus["Hydrated"] = "hydrated";
    HydrationStatus["Skipped"] = "skipped";
    HydrationStatus["Mismatched"] = "mismatched";
})(HydrationStatus || (HydrationStatus = {}));
const HYDRATION_INFO_KEY = '__ngDebugHydrationInfo__';
function patchHydrationInfo(node, info) {
    node[HYDRATION_INFO_KEY] = info;
}
export function readHydrationInfo(node) {
    return node[HYDRATION_INFO_KEY] ?? null;
}
/**
 * Marks a node as "claimed" by hydration process.
 * This is needed to make assessments in tests whether
 * the hydration process handled all nodes.
 */
export function markRNodeAsClaimedByHydration(node, checkIfAlreadyClaimed = true) {
    if (!ngDevMode) {
        throw new Error('Calling `markRNodeAsClaimedByHydration` in prod mode ' +
            'is not supported and likely a mistake.');
    }
    if (checkIfAlreadyClaimed && isRNodeClaimedForHydration(node)) {
        throw new Error('Trying to claim a node, which was claimed already.');
    }
    patchHydrationInfo(node, { status: HydrationStatus.Hydrated });
    ngDevMode.hydratedNodes++;
}
export function markRNodeAsSkippedByHydration(node) {
    if (!ngDevMode) {
        throw new Error('Calling `markRNodeAsSkippedByHydration` in prod mode ' +
            'is not supported and likely a mistake.');
    }
    patchHydrationInfo(node, { status: HydrationStatus.Skipped });
    ngDevMode.componentsSkippedHydration++;
}
export function markRNodeAsHavingHydrationMismatch(node, expectedNodeDetails = null, actualNodeDetails = null) {
    if (!ngDevMode) {
        throw new Error('Calling `markRNodeAsMismatchedByHydration` in prod mode ' +
            'is not supported and likely a mistake.');
    }
    // The RNode can be a standard HTMLElement (not an Angular component or directive)
    // The devtools component tree only displays Angular components & directives
    // Therefore we attach the debug info to the closest component/directive
    while (node && !getComponent(node)) {
        node = node?.parentNode;
    }
    if (node) {
        patchHydrationInfo(node, {
            status: HydrationStatus.Mismatched,
            expectedNodeDetails,
            actualNodeDetails,
        });
    }
}
export function isRNodeClaimedForHydration(node) {
    return readHydrationInfo(node)?.status === HydrationStatus.Hydrated;
}
export function setSegmentHead(hydrationInfo, index, node) {
    hydrationInfo.segmentHeads ??= {};
    hydrationInfo.segmentHeads[index] = node;
}
export function getSegmentHead(hydrationInfo, index) {
    return hydrationInfo.segmentHeads?.[index] ?? null;
}
/**
 * Returns the size of an <ng-container>, using either the information
 * serialized in `ELEMENT_CONTAINERS` (element container size) or by
 * computing the sum of root nodes in all dehydrated views in a given
 * container (in case this `<ng-container>` was also used as a view
 * container host node, e.g. <ng-container *ngIf>).
 */
export function getNgContainerSize(hydrationInfo, index) {
    const data = hydrationInfo.data;
    let size = data[ELEMENT_CONTAINERS]?.[index] ?? null;
    // If there is no serialized information available in the `ELEMENT_CONTAINERS` slot,
    // check if we have info about view containers at this location (e.g.
    // `<ng-container *ngIf>`) and use container size as a number of root nodes in this
    // element container.
    if (size === null && data[CONTAINERS]?.[index]) {
        size = calcSerializedContainerSize(hydrationInfo, index);
    }
    return size;
}
export function isSerializedElementContainer(hydrationInfo, index) {
    return hydrationInfo.data[ELEMENT_CONTAINERS]?.[index] !== undefined;
}
export function getSerializedContainerViews(hydrationInfo, index) {
    return hydrationInfo.data[CONTAINERS]?.[index] ?? null;
}
/**
 * Computes the size of a serialized container (the number of root nodes)
 * by calculating the sum of root nodes in all dehydrated views in this container.
 */
export function calcSerializedContainerSize(hydrationInfo, index) {
    const views = getSerializedContainerViews(hydrationInfo, index) ?? [];
    let numNodes = 0;
    for (let view of views) {
        numNodes += view[NUM_ROOT_NODES] * (view[MULTIPLIER] ?? 1);
    }
    return numNodes;
}
/**
 * Attempt to initialize the `disconnectedNodes` field of the given
 * `DehydratedView`. Returns the initialized value.
 */
export function initDisconnectedNodes(hydrationInfo) {
    // Check if we are processing disconnected info for the first time.
    if (typeof hydrationInfo.disconnectedNodes === 'undefined') {
        const nodeIds = hydrationInfo.data[DISCONNECTED_NODES];
        hydrationInfo.disconnectedNodes = nodeIds ? new Set(nodeIds) : null;
    }
    return hydrationInfo.disconnectedNodes;
}
/**
 * Checks whether a node is annotated as "disconnected", i.e. not present
 * in the DOM at serialization time. We should not attempt hydration for
 * such nodes and instead, use a regular "creation mode".
 */
export function isDisconnectedNode(hydrationInfo, index) {
    // Check if we are processing disconnected info for the first time.
    if (typeof hydrationInfo.disconnectedNodes === 'undefined') {
        const nodeIds = hydrationInfo.data[DISCONNECTED_NODES];
        hydrationInfo.disconnectedNodes = nodeIds ? new Set(nodeIds) : null;
    }
    return !!initDisconnectedNodes(hydrationInfo)?.has(index);
}
/**
 * Helper function to prepare text nodes for serialization by ensuring
 * that seperate logical text blocks in the DOM remain separate after
 * serialization.
 */
export function processTextNodeBeforeSerialization(context, node) {
    // Handle cases where text nodes can be lost after DOM serialization:
    //  1. When there is an *empty text node* in DOM: in this case, this
    //     node would not make it into the serialized string and as a result,
    //     this node wouldn't be created in a browser. This would result in
    //     a mismatch during the hydration, where the runtime logic would expect
    //     a text node to be present in live DOM, but no text node would exist.
    //     Example: `<span>{{ name }}</span>` when the `name` is an empty string.
    //     This would result in `<span></span>` string after serialization and
    //     in a browser only the `span` element would be created. To resolve that,
    //     an extra comment node is appended in place of an empty text node and
    //     that special comment node is replaced with an empty text node *before*
    //     hydration.
    //  2. When there are 2 consecutive text nodes present in the DOM.
    //     Example: `<div>Hello <ng-container *ngIf="true">world</ng-container></div>`.
    //     In this scenario, the live DOM would look like this:
    //       <div>#text('Hello ') #text('world') #comment('container')</div>
    //     Serialized string would look like this: `<div>Hello world<!--container--></div>`.
    //     The live DOM in a browser after that would be:
    //       <div>#text('Hello world') #comment('container')</div>
    //     Notice how 2 text nodes are now "merged" into one. This would cause hydration
    //     logic to fail, since it'd expect 2 text nodes being present, not one.
    //     To fix this, we insert a special comment node in between those text nodes, so
    //     serialized representation is: `<div>Hello <!--ngtns-->world<!--container--></div>`.
    //     This forces browser to create 2 text nodes separated by a comment node.
    //     Before running a hydration process, this special comment node is removed, so the
    //     live DOM has exactly the same state as it was before serialization.
    // Collect this node as required special annotation only when its
    // contents is empty. Otherwise, such text node would be present on
    // the client after server-side rendering and no special handling needed.
    const el = node;
    const corruptedTextNodes = context.corruptedTextNodes;
    if (el.textContent === '') {
        corruptedTextNodes.set(el, "ngetn" /* TextNodeMarker.EmptyNode */);
    }
    else if (el.nextSibling?.nodeType === Node.TEXT_NODE) {
        corruptedTextNodes.set(el, "ngtns" /* TextNodeMarker.Separator */);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9oeWRyYXRpb24vdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBSUgsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBRTdELE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUUzRCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sbUNBQW1DLENBQUM7QUFDN0QsT0FBTyxFQUFDLGFBQWEsRUFBUyxLQUFLLEVBQVksTUFBTSw0QkFBNEIsQ0FBQztBQUNsRixPQUFPLEVBQUMsWUFBWSxFQUFFLGFBQWEsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQzlELE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUc3QyxPQUFPLEVBQ0wsVUFBVSxFQUVWLGtCQUFrQixFQUNsQixrQkFBa0IsRUFDbEIsVUFBVSxFQUNWLGNBQWMsR0FJZixNQUFNLGNBQWMsQ0FBQztBQUV0Qjs7O0dBR0c7QUFDSCxNQUFNLHVCQUF1QixHQUFHLGFBQWEsQ0FBQztBQUU5Qzs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLFlBQVksR0FBRyxZQUFZLENBQXdCLHVCQUF1QixDQUFDLENBQUM7QUFFekY7Ozs7R0FJRztBQUNILE1BQU0sQ0FBQyxNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUM7QUFFbkM7O0dBRUc7QUFDSCxNQUFNLENBQUMsTUFBTSw0QkFBNEIsR0FBRyxNQUFNLENBQUM7QUFzQm5EOzs7Ozs7OztHQVFHO0FBQ0gsSUFBSSwwQkFBMEIsR0FBcUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDO0FBRTlFLE1BQU0sVUFBVSx5QkFBeUIsQ0FDdkMsS0FBZSxFQUNmLFFBQWtCLEVBQ2xCLFVBQVUsR0FBRyxLQUFLO0lBRWxCLElBQUksWUFBWSxHQUFHLEtB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QUM1RSxvRkFBb0Y7SUFDcEYsMEZBQTBGO0lBQzFGLDhFQUE4RTtJQUM5RSx1RkFBdUY7SUFDdkYsMEVBQTBFO0lBRTFFLGlFQUFpRTtJQUNqRSxtRUFBbUU7SUFDbkUseUVBQXlFO0lBQ3pFLE1BQU0sRUFBRSxHQUFHLElBQW1CLENBQUM7SUFDL0IsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUM7SUFDdEQsSUFBSSxFQUFFLENBQUMsV0FBVyxLQUFLLEVBQUUsRUFBRSxDQUFDO1FBQzFCLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxFQUFFLHlDQUEyQixDQUFDO0lBQ3ZELENBQUM7U0FBTSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsUUFBUSxLQUFLLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUN2RCxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsRUFBRSx5Q0FBMkIsQ0FBQztJQUN2RCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0luamVjdG9yfSBmcm9tICcuLi9kaS9pbmplY3Rvcic7XG5pbXBvcnQgdHlwZSB7Vmlld1JlZn0gZnJvbSAnLi4vbGlua2VyL3ZpZXdfcmVmJztcbmltcG9ydCB7Z2V0Q29tcG9uZW50fSBmcm9tICcuLi9yZW5kZXIzL3V0aWwvZGlzY292ZXJ5X3V0aWxzJztcbmltcG9ydCB7TENvbnRhaW5lcn0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL2NvbnRhaW5lcic7XG5pbXBvcnQge2dldERvY3VtZW50fSBmcm9tICcuLi9yZW5kZXIzL2ludGVyZmFjZXMvZG9jdW1lbnQnO1xuaW1wb3J0IHtSRWxlbWVudCwgUk5vZGV9IGZyb20gJy4uL3JlbmRlcjMvaW50ZXJmYWNlcy9yZW5kZXJlcl9kb20nO1xuaW1wb3J0IHtpc1Jvb3RWaWV3fSBmcm9tICcuLi9yZW5kZXIzL2ludGVyZmFjZXMvdHlwZV9jaGVja3MnO1xuaW1wb3J0IHtIRUFERVJfT0ZGU0VULCBMVmlldywgVFZJRVcsIFRWaWV3VHlwZX0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL3ZpZXcnO1xuaW1wb3J0IHttYWtlU3RhdGVLZXksIFRyYW5zZmVyU3RhdGV9IGZyb20gJy4uL3RyYW5zZmVyX3N0YXRlJztcbmltcG9ydCB7YXNzZXJ0RGVmaW5lZH0gZnJvbSAnLi4vdXRpbC9hc3NlcnQnO1xuaW1wb3J0IHR5cGUge0h5ZHJhdGlvbkNvbnRleHR9IGZyb20gJy4vYW5ub3RhdGUnO1xuXG5pbXBvcnQge1xuICBDT05UQUlORVJTLFxuICBEZWh5ZHJhdGVkVmlldyxcbiAgRElTQ09OTkVDVEVEX05PREVTLFxuICBFTEVNRU5UX0NPTlRBSU5FUlMsXG4gIE1VTFRJUExJRVIsXG4gIE5VTV9ST09UX05PREVTLFxuICBTZXJpYWxpemVkQ29udGFpbmVyVmlldyxcbiAgU2VyaWFsaXplZEVsZW1lbnRDb250YWluZXJzLFxuICBTZXJpYWxpemVkVmlldyxcbn0gZnJvbSAnLi9pbnRlcmZhY2VzJztcblxuLyoqXG4gKiBUaGUgbmFtZSBvZiB0aGUga2V5IHVzZWQgaW4gdGhlIFRyYW5zZmVyU3RhdGUgY29sbGVjdGlvbixcbiAqIHdoZXJlIGh5ZHJhdGlvbiBpbmZvcm1hdGlvbiBpcyBsb2NhdGVkLlxuICovXG5jb25zdCBUUkFOU0ZFUl9TVEFURV9UT0tFTl9JRCA9ICdfX25naERhdGFfXyc7XG5cbi8qKlxuICogTG9va3VwIGtleSB1c2VkIHRvIHJlZmVyZW5jZSBET00gaHlkcmF0aW9uIGRhdGEgKG5naCkgaW4gYFRyYW5zZmVyU3RhdGVgLlxuICovXG5leHBvcnQgY29uc3QgTkdIX0RBVEFfS0VZID0gbWFrZVN0YXRlS2V5PEFycmF5PFNlcmlhbGl6ZWRWaWV3Pj4oVFJBTlNGRVJfU1RBVEVfVE9LRU5fSUQpO1xuXG4vKipcbiAqIFRoZSBuYW1lIG9mIHRoZSBhdHRyaWJ1dGUgdGhhdCB3b3VsZCBiZSBhZGRlZCB0byBob3N0IGNvbXBvbmVudFxuICogbm9kZXMgYW5kIGNvbnRhaW4gYSByZWZlcmVuY2UgdG8gYSBwYXJ0aWN1bGFyIHNsb3QgaW4gdHJhbnNmZXJyZWRcbiAqIHN0YXRlIHRoYXQgY29udGFpbnMgdGhlIG5lY2Vzc2FyeSBoeWRyYXRpb24gaW5mbyBmb3IgdGhpcyBjb21wb25lbnQuXG4gKi9cbmV4cG9ydCBjb25zdCBOR0hfQVRUUl9OQU1FID0gJ25naCc7XG5cbi8qKlxuICogTWFya2VyIHVzZWQgaW4gYSBjb21tZW50IG5vZGUgdG8gZW5zdXJlIGh5ZHJhdGlvbiBjb250ZW50IGludGVncml0eVxuICovXG5leHBvcnQgY29uc3QgU1NSX0NPTlRFTlRfSU5URUdSSVRZX01BUktFUiA9ICduZ2htJztcblxuZXhwb3J0IGNvbnN0IGVudW0gVGV4dE5vZGVNYXJrZXIge1xuICAvKipcbiAgICogVGhlIGNvbnRlbnRzIG9mIHRoZSB0ZXh0IGNvbW1lbnQgYWRkZWQgdG8gbm9kZXMgdGhhdCB3b3VsZCBvdGhlcndpc2UgYmVcbiAgICogZW1wdHkgd2hlbiBzZXJpYWxpemVkIGJ5IHRoZSBzZXJ2ZXIgYW5kIHBhc3NlZCB0byB0aGUgY2xpZW50LiBUaGUgZW1wdHlcbiAgICogbm9kZSBpcyBsb3N0IHdoZW4gdGhlIGJyb3dzZXIgcGFyc2VzIGl0IG90aGVyd2lzZS4gVGhpcyBjb21tZW50IG5vZGUgd2lsbFxuICAgKiBiZSByZXBsYWNlZCBkdXJpbmcgaHlkcmF0aW9uIGluIHRoZSBjbGllbnQgdG8gcmVzdG9yZSB0aGUgbG9zdCBlbXB0eSB0ZXh0XG4gICAqIG5vZGUuXG4gICAqL1xuICBFbXB0eU5vZGUgPSAnbmdldG4nLFxuXG4gIC8qKlxuICAgKiBUaGUgY29udGVudHMgb2YgdGhlIHRleHQgY29tbWVudCBhZGRlZCBpbiB0aGUgY2FzZSBvZiBhZGphY2VudCB0ZXh0IG5vZGVzLlxuICAgKiBXaGVuIGFkamFjZW50IHRleHQgbm9kZXMgYXJlIHNlcmlhbGl6ZWQgYnkgdGhlIHNlcnZlciBhbmQgc2VudCB0byB0aGVcbiAgICogY2xpZW50LCB0aGUgYnJvd3NlciBsb3NlcyByZWZlcmVuY2UgdG8gdGhlIGFtb3VudCBvZiBub2RlcyBhbmQgYXNzdW1lc1xuICAgKiBqdXN0IG9uZSB0ZXh0IG5vZGUuIFRoaXMgc2VwYXJhdG9yIGlzIHJlcGxhY2VkIGR1cmluZyBoeWRyYXRpb24gdG8gcmVzdG9yZVxuICAgKiB0aGUgcHJvcGVyIHNlcGFyYXRpb24gYW5kIGFtb3VudCBvZiB0ZXh0IG5vZGVzIHRoYXQgc2hvdWxkIGJlIHByZXNlbnQuXG4gICAqL1xuICBTZXBhcmF0b3IgPSAnbmd0bnMnLFxufVxuXG4vKipcbiAqIFJlZmVyZW5jZSB0byBhIGZ1bmN0aW9uIHRoYXQgcmVhZHMgYG5naGAgYXR0cmlidXRlIHZhbHVlIGZyb20gYSBnaXZlbiBSTm9kZVxuICogYW5kIHJldHJpZXZlcyBoeWRyYXRpb24gaW5mb3JtYXRpb24gZnJvbSB0aGUgVHJhbnNmZXJTdGF0ZSB1c2luZyB0aGF0IHZhbHVlXG4gKiBhcyBhbiBpbmRleC4gUmV0dXJucyBgbnVsbGAgYnkgZGVmYXVsdCwgd2hlbiBoeWRyYXRpb24gaXMgbm90IGVuYWJsZWQuXG4gKlxuICogQHBhcmFtIHJOb2RlIENvbXBvbmVudCdzIGhvc3QgZWxlbWVudC5cbiAqIEBwYXJhbSBpbmplY3RvciBJbmplY3RvciB0aGF0IHRoaXMgY29tcG9uZW50IGhhcyBhY2Nlc3MgdG8uXG4gKiBAcGFyYW0gaXNSb290VmlldyBTcGVjaWZpZXMgd2hldGhlciB3ZSB0cnlpbmcgdG8gcmVhZCBoeWRyYXRpb24gaW5mbyBmb3IgdGhlIHJvb3Qgdmlldy5cbiAqL1xubGV0IF9yZXRyaWV2ZUh5ZHJhdGlvbkluZm9JbXBsOiB0eXBlb2YgcmV0cmlldmVIeWRyYXRpb25JbmZvSW1wbCA9ICgpID0+IG51bGw7XG5cbmV4cG9ydCBmdW5jdGlvbiByZXRyaWV2ZUh5ZHJhdGlvbkluZm9JbXBsKFxuICByTm9kZTogUkVsZW1lbnQsXG4gIGluamVjdG9yOiBJbmplY3RvcixcbiAgaXNSb290VmlldyA9IGZhbHNlLFxuKTogRGVoeWRyYXRlZFZpZXcgfCBudWxsIHtcbiAgbGV0IG5naEF0dHJWYWx1ZSA9IHJOb2RlLmdldEF0dHJpYnV0ZShOR0hfQVRUUl9OQU1FKTtcbiAgaWYgKG5naEF0dHJWYWx1ZSA9PSBudWxsKSByZXR1cm4gbnVsbDtcblxuICAvLyBGb3IgY2FzZXMgd2hlbiBhIHJvb3QgY29tcG9uZW50IGFsc28gYWN0cyBhcyBhbiBhbmNob3Igbm9kZSBmb3IgYSBWaWV3Q29udGFpbmVyUmVmXG4gIC8vIChmb3IgZXhhbXBsZSwgd2hlbiBWaWV3Q29udGFpbmVyUmVmIGlzIGluamVjdGVkIGluIGEgcm9vdCBjb21wb25lbnQpLCB0aGVyZSBpcyBhIG5lZWRcbiAgLy8gdG8gc2VyaWFsaXplIGluZm9ybWF0aW9uIGFib3V0IHRoZSBjb21wb25lbnQgaXRzZWxmLCBhcyB3ZWxsIGFzIGFuIExDb250YWluZXIgdGhhdFxuICAvLyByZXByZXNlbnRzIHRoaXMgVmlld0NvbnRhaW5lclJlZi4gRWZmZWN0aXZlbHksIHdlIG5lZWQgdG8gc2VyaWFsaXplIDIgcGllY2VzIG9mIGluZm86XG4gIC8vICgxKSBoeWRyYXRpb24gaW5mbyBmb3IgdGhlIHJvb3QgY29tcG9uZW50IGl0c2VsZiBhbmQgKDIpIGh5ZHJhdGlvbiBpbmZvIGZvciB0aGVcbiAgLy8gVmlld0NvbnRhaW5lclJlZiBpbnN0YW5jZSAoYW4gTENvbnRhaW5lcikuIEVhY2ggcGllY2Ugb2YgaW5mb3JtYXRpb24gaXMgaW5jbHVkZWQgaW50b1xuICAvLyB0aGUgaHlkcmF0aW9uIGRhdGEgKGluIHRoZSBUcmFuc2ZlclN0YXRlIG9iamVjdCkgc2VwYXJhdGVseSwgdGh1cyB3ZSBlbmQgdXAgd2l0aCAyIGlkcy5cbiAgLy8gU2luY2Ugd2Ugb25seSBoYXZlIDEgcm9vdCBlbGVtZW50LCB3ZSBlbmNvZGUgYm90aCBiaXRzIG9mIGluZm8gaW50byBhIHNpbmdsZSBzdHJpbmc6XG4gIC8vIGlkcyBhcmUgc2VwYXJhdGVkIGJ5IHRoZSBgfGAgY2hhciAoZS5nLiBgMTB8MjVgLCB3aGVyZSBgMTBgIGlzIHRoZSBuZ2ggZm9yIGEgY29tcG9uZW50IHZpZXdcbiAgLy8gYW5kIDI1IGlzIHRoZSBgbmdoYCBmb3IgYSByb290IHZpZXcgd2hpY2ggaG9sZHMgTENvbnRhaW5lcikuXG4gIGNvbnN0IFtjb21wb25lbnRWaWV3TmdoLCByb290Vmlld05naF0gPSBuZ2hBdHRyVmFsdWUuc3BsaXQoJ3wnKTtcbiAgbmdoQXR0clZhbHVlID0gaXNSb290VmlldyA/IHJvb3RWaWV3TmdoIDogY29tcG9uZW50Vmlld05naDtcbiAgaWYgKCFuZ2hBdHRyVmFsdWUpIHJldHVybiBudWxsO1xuXG4gIC8vIFdlJ3ZlIHJlYWQgb25lIG9mIHRoZSBuZ2ggaWRzLCBrZWVwIHRoZSByZW1haW5pbmcgb25lLCBzbyB0aGF0XG4gIC8vIHdlIGNhbiBzZXQgaXQgYmFjayBvbiB0aGUgRE9NIGVsZW1lbnQuXG4gIGNvbnN0IHJvb3ROZ2ggPSByb290Vmlld05naCA/IGB8JHtyb290Vmlld05naH1gIDogJyc7XG4gIGNvbnN0IHJlbWFpbmluZ05naCA9IGlzUm9vdFZpZXcgPyBjb21wb25lbnRWaWV3TmdoIDogcm9vdE5naDtcblxuICBsZXQgZGF0YTogU2VyaWFsaXplZFZpZXcgPSB7fTtcbiAgLy8gQW4gZWxlbWVudCBtaWdodCBoYXZlIGFuIGVtcHR5IGBuZ2hgIGF0dHJpYnV0ZSB2YWx1ZSAoZS5nLiBgPGNvbXAgbmdoPVwiXCIgLz5gKSxcbiAgLy8gd2hpY2ggbWVhbnMgdGhhdCBubyBzcGVjaWFsIGFubm90YXRpb25zIGFyZSByZXF1aXJlZC4gRG8gbm90IGF0dGVtcHQgdG8gcmVhZFxuICAvLyBmcm9tIHRoZSBUcmFuc2ZlclN0YXRlIGluIHRoaXMgY2FzZS5cbiAgaWYgKG5naEF0dHJWYWx1ZSAhPT0gJycpIHtcbiAgICBjb25zdCB0cmFuc2ZlclN0YXRlID0gaW5qZWN0b3IuZ2V0KFRyYW5zZmVyU3RhdGUsIG51bGwsIHtvcHRpb25hbDogdHJ1ZX0pO1xuICAgIGlmICh0cmFuc2ZlclN0YXRlICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBuZ2hEYXRhID0gdHJhbnNmZXJTdGF0ZS5nZXQoTkdIX0RBVEFfS0VZLCBbXSk7XG5cbiAgICAgIC8vIFRoZSBuZ2hBdHRyVmFsdWUgaXMgYWx3YXlzIGEgbnVtYmVyIHJlZmVyZW5jaW5nIGFuIGluZGV4XG4gICAgICAvLyBpbiB0aGUgaHlkcmF0aW9uIFRyYW5zZmVyU3RhdGUgZGF0YS5cbiAgICAgIGRhdGEgPSBuZ2hEYXRhW051bWJlcihuZ2hBdHRyVmFsdWUpXTtcblxuICAgICAgLy8gSWYgdGhlIGBuZ2hgIGF0dHJpYnV0ZSBleGlzdHMgYW5kIGhhcyBhIG5vbi1lbXB0eSB2YWx1ZSxcbiAgICAgIC8vIHRoZSBoeWRyYXRpb24gaW5mbyAqbXVzdCogYmUgcHJlc2VudCBpbiB0aGUgVHJhbnNmZXJTdGF0ZS5cbiAgICAgIC8vIElmIHRoZXJlIGlzIG5vIGRhdGEgZm9yIHNvbWUgcmVhc29ucywgdGhpcyBpcyBhbiBlcnJvci5cbiAgICAgIG5nRGV2TW9kZSAmJiBhc3NlcnREZWZpbmVkKGRhdGEsICdVbmFibGUgdG8gcmV0cmlldmUgaHlkcmF0aW9uIGluZm8gZnJvbSB0aGUgVHJhbnNmZXJTdGF0ZS4nKTtcbiAgICB9XG4gIH1cbiAgY29uc3QgZGVoeWRyYXRlZFZpZXc6IERlaHlkcmF0ZWRWaWV3ID0ge1xuICAgIGRhdGEsXG4gICAgZmlyc3RDaGlsZDogck5vZGUuZmlyc3RDaGlsZCA/PyBudWxsLFxuICB9O1xuXG4gIGlmIChpc1Jvb3RWaWV3KSB7XG4gICAgLy8gSWYgdGhlcmUgaXMgaHlkcmF0aW9uIGluZm8gcHJlc2VudCBmb3IgdGhlIHJvb3QgdmlldywgaXQgbWVhbnMgdGhhdCB0aGVyZSB3YXNcbiAgICAvLyBhIFZpZXdDb250YWluZXJSZWYgaW5qZWN0ZWQgaW4gdGhlIHJvb3QgY29tcG9uZW50LiBUaGUgcm9vdCBjb21wb25lbnQgaG9zdCBlbGVtZW50XG4gICAgLy8gYWN0ZWQgYXMgYW4gYW5jaG9yIG5vZGUgaW4gdGhpcyBzY2VuYXJpby4gQXMgYSByZXN1bHQsIHRoZSBET00gbm9kZXMgdGhhdCByZXByZXNlbnRcbiAgICAvLyBlbWJlZGRlZCB2aWV3cyBpbiB0aGlzIFZpZXdDb250YWluZXJSZWYgYXJlIGxvY2F0ZWQgYXMgc2libGluZ3MgdG8gdGhlIGhvc3Qgbm9kZSxcbiAgICAvLyBpLmUuIGA8YXBwLXJvb3QgLz48I1ZJRVcxPjwjVklFVzI+Li4uPCEtLWNvbnRhaW5lci0tPmAuIEluIHRoaXMgY2FzZSwgdGhlIGN1cnJlbnRcbiAgICAvLyBub2RlIGJlY29tZXMgdGhlIGZpcnN0IGNoaWxkIG9mIHRoaXMgcm9vdCB2aWV3IGFuZCB0aGUgbmV4dCBzaWJsaW5nIGlzIHRoZSBmaXJzdFxuICAgIC8vIGVsZW1lbnQgaW4gdGhlIERPTSBzZWdtZW50LlxuICAgIGRlaHlkcmF0ZWRWaWV3LmZpcnN0Q2hpbGQgPSByTm9kZTtcblxuICAgIC8vIFdlIHVzZSBgMGAgaGVyZSwgc2luY2UgdGhpcyBpcyB0aGUgc2xvdCAocmlnaHQgYWZ0ZXIgdGhlIEhFQURFUl9PRkZTRVQpXG4gICAgLy8gd2hlcmUgYSBjb21wb25lbnQgTFZpZXcgb3IgYW4gTENvbnRhaW5lciBpcyBsb2NhdGVkIGluIGEgcm9vdCBMVmlldy5cbiAgICBzZXRTZWdtZW50SGVhZChkZWh5ZHJhdGVkVmlldywgMCwgck5vZGUubmV4dFNpYmxpbmcpO1xuICB9XG5cbiAgaWYgKHJlbWFpbmluZ05naCkge1xuICAgIC8vIElmIHdlIGhhdmUgb25seSB1c2VkIG9uZSBvZiB0aGUgbmdoIGlkcywgc3RvcmUgdGhlIHJlbWFpbmluZyBvbmVcbiAgICAvLyBiYWNrIG9uIHRoaXMgUk5vZGUuXG4gICAgck5vZGUuc2V0QXR0cmlidXRlKE5HSF9BVFRSX05BTUUsIHJlbWFpbmluZ05naCk7XG4gIH0gZWxzZSB7XG4gICAgLy8gVGhlIGBuZ2hgIGF0dHJpYnV0ZSBpcyBjbGVhcmVkIGZyb20gdGhlIERPTSBub2RlIG5vd1xuICAgIC8vIHRoYXQgdGhlIGRhdGEgaGFzIGJlZW4gcmV0cmlldmVkIGZvciBhbGwgaW5kaWNlcy5cbiAgICByTm9kZS5yZW1vdmVBdHRyaWJ1dGUoTkdIX0FUVFJfTkFNRSk7XG4gIH1cblxuICAvLyBOb3RlOiBkb24ndCBjaGVjayB3aGV0aGVyIHRoaXMgbm9kZSB3YXMgY2xhaW1lZCBmb3IgaHlkcmF0aW9uLFxuICAvLyBiZWNhdXNlIHRoaXMgbm9kZSBtaWdodCd2ZSBiZWVuIHByZXZpb3VzbHkgY2xhaW1lZCB3aGlsZSBwcm9jZXNzaW5nXG4gIC8vIHRlbXBsYXRlIGluc3RydWN0aW9ucy5cbiAgbmdEZXZNb2RlICYmIG1hcmtSTm9kZUFzQ2xhaW1lZEJ5SHlkcmF0aW9uKHJOb2RlLCAvKiBjaGVja0lmQWxyZWFkeUNsYWltZWQgKi8gZmFsc2UpO1xuICBuZ0Rldk1vZGUgJiYgbmdEZXZNb2RlLmh5ZHJhdGVkQ29tcG9uZW50cysrO1xuXG4gIHJldHVybiBkZWh5ZHJhdGVkVmlldztcbn1cblxuLyoqXG4gKiBTZXRzIHRoZSBpbXBsZW1lbnRhdGlvbiBmb3IgdGhlIGByZXRyaWV2ZUh5ZHJhdGlvbkluZm9gIGZ1bmN0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlUmV0cmlldmVIeWRyYXRpb25JbmZvSW1wbCgpIHtcbiAgX3JldHJpZXZlSHlkcmF0aW9uSW5mb0ltcGwgPSByZXRyaWV2ZUh5ZHJhdGlvbkluZm9JbXBsO1xufVxuXG4vKipcbiAqIFJldHJpZXZlcyBoeWRyYXRpb24gaW5mbyBieSByZWFkaW5nIHRoZSB2YWx1ZSBmcm9tIHRoZSBgbmdoYCBhdHRyaWJ1dGVcbiAqIGFuZCBhY2Nlc3NpbmcgYSBjb3JyZXNwb25kaW5nIHNsb3QgaW4gVHJhbnNmZXJTdGF0ZSBzdG9yYWdlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmV0cmlldmVIeWRyYXRpb25JbmZvKFxuICByTm9kZTogUkVsZW1lbnQsXG4gIGluamVjdG9yOiBJbmplY3RvcixcbiAgaXNSb290VmlldyA9IGZhbHNlLFxuKTogRGVoeWRyYXRlZFZpZXcgfCBudWxsIHtcbiAgcmV0dXJuIF9yZXRyaWV2ZUh5ZHJhdGlvbkluZm9JbXBsKHJOb2RlLCBpbmplY3RvciwgaXNSb290Vmlldyk7XG59XG5cbi8qKlxuICogUmV0cmlldmVzIHRoZSBuZWNlc3Nhcnkgb2JqZWN0IGZyb20gYSBnaXZlbiBWaWV3UmVmIHRvIHNlcmlhbGl6ZTpcbiAqICAtIGFuIExWaWV3IGZvciBjb21wb25lbnQgdmlld3NcbiAqICAtIGFuIExDb250YWluZXIgZm9yIGNhc2VzIHdoZW4gY29tcG9uZW50IGFjdHMgYXMgYSBWaWV3Q29udGFpbmVyUmVmIGFuY2hvclxuICogIC0gYG51bGxgIGluIGNhc2Ugb2YgYW4gZW1iZWRkZWQgdmlld1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TE5vZGVGb3JIeWRyYXRpb24odmlld1JlZjogVmlld1JlZik6IExWaWV3IHwgTENvbnRhaW5lciB8IG51bGwge1xuICAvLyBSZWFkaW5nIGFuIGludGVybmFsIGZpZWxkIGZyb20gYFZpZXdSZWZgIGluc3RhbmNlLlxuICBsZXQgbFZpZXcgPSAodmlld1JlZiBhcyBhbnkpLl9sVmlldyBhcyBMVmlldztcbiAgY29uc3QgdFZpZXcgPSBsVmlld1tUVklFV107XG4gIC8vIEEgcmVnaXN0ZXJlZCBWaWV3UmVmIG1pZ2h0IHJlcHJlc2VudCBhbiBpbnN0YW5jZSBvZiBhblxuICAvLyBlbWJlZGRlZCB2aWV3LCBpbiB3aGljaCBjYXNlIHdlIGRvIG5vdCBuZWVkIHRvIGFubm90YXRlIGl0LlxuICBpZiAodFZpZXcudHlwZSA9PT0gVFZpZXdUeXBlLkVtYmVkZGVkKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgLy8gQ2hlY2sgaWYgaXQncyBhIHJvb3QgdmlldyBhbmQgaWYgc28sIHJldHJpZXZlIGNvbXBvbmVudCdzXG4gIC8vIExWaWV3IGZyb20gdGhlIGZpcnN0IHNsb3QgYWZ0ZXIgdGhlIGhlYWRlci5cbiAgaWYgKGlzUm9vdFZpZXcobFZpZXcpKSB7XG4gICAgbFZpZXcgPSBsVmlld1tIRUFERVJfT0ZGU0VUXTtcbiAgfVxuXG4gIHJldHVybiBsVmlldztcbn1cblxuZnVuY3Rpb24gZ2V0VGV4dE5vZGVDb250ZW50KG5vZGU6IE5vZGUpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICByZXR1cm4gbm9kZS50ZXh0Q29udGVudD8ucmVwbGFjZSgvXFxzL2dtLCAnJyk7XG59XG5cbi8qKlxuICogUmVzdG9yZXMgdGV4dCBub2RlcyBhbmQgc2VwYXJhdG9ycyBpbnRvIHRoZSBET00gdGhhdCB3ZXJlIGxvc3QgZHVyaW5nIFNTUlxuICogc2VyaWFsaXphdGlvbi4gVGhlIGh5ZHJhdGlvbiBwcm9jZXNzIHJlcGxhY2VzIGVtcHR5IHRleHQgbm9kZXMgYW5kIHRleHRcbiAqIG5vZGVzIHRoYXQgYXJlIGltbWVkaWF0ZWx5IGFkamFjZW50IHRvIG90aGVyIHRleHQgbm9kZXMgd2l0aCBjb21tZW50IG5vZGVzXG4gKiB0aGF0IHRoaXMgbWV0aG9kIGZpbHRlcnMgb24gdG8gcmVzdG9yZSB0aG9zZSBtaXNzaW5nIG5vZGVzIHRoYXQgdGhlXG4gKiBoeWRyYXRpb24gcHJvY2VzcyBpcyBleHBlY3RpbmcgdG8gYmUgcHJlc2VudC5cbiAqXG4gKiBAcGFyYW0gbm9kZSBUaGUgYXBwJ3Mgcm9vdCBIVE1MIEVsZW1lbnRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByb2Nlc3NUZXh0Tm9kZU1hcmtlcnNCZWZvcmVIeWRyYXRpb24obm9kZTogSFRNTEVsZW1lbnQpIHtcbiAgY29uc3QgZG9jID0gZ2V0RG9jdW1lbnQoKTtcbiAgY29uc3QgY29tbWVudE5vZGVzSXRlcmF0b3IgPSBkb2MuY3JlYXRlTm9kZUl0ZXJhdG9yKG5vZGUsIE5vZGVGaWx0ZXIuU0hPV19DT01NRU5ULCB7XG4gICAgYWNjZXB0Tm9kZShub2RlKSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gZ2V0VGV4dE5vZGVDb250ZW50KG5vZGUpO1xuICAgICAgY29uc3QgaXNUZXh0Tm9kZU1hcmtlciA9XG4gICAgICAgIGNvbnRlbnQgPT09IFRleHROb2RlTWFya2VyLkVtcHR5Tm9kZSB8fCBjb250ZW50ID09PSBUZXh0Tm9kZU1hcmtlci5TZXBhcmF0b3I7XG4gICAgICByZXR1cm4gaXNUZXh0Tm9kZU1hcmtlciA/IE5vZGVGaWx0ZXIuRklMVEVSX0FDQ0VQVCA6IE5vZGVGaWx0ZXIuRklMVEVSX1JFSkVDVDtcbiAgICB9LFxuICB9KTtcbiAgbGV0IGN1cnJlbnROb2RlOiBDb21tZW50O1xuICAvLyBXZSBjYW5ub3QgbW9kaWZ5IHRoZSBET00gd2hpbGUgdXNpbmcgdGhlIGNvbW1lbnRJdGVyYXRvcixcbiAgLy8gYmVjYXVzZSBpdCB0aHJvd3Mgb2ZmIHRoZSBpdGVyYXRvciBzdGF0ZS5cbiAgLy8gU28gd2UgY29sbGVjdCBhbGwgbWFya2VyIG5vZGVzIGZpcnN0IGFuZCB0aGVuIGZvbGxvdyB1cCB3aXRoXG4gIC8vIGFwcGx5aW5nIHRoZSBjaGFuZ2VzIHRvIHRoZSBET006IGVpdGhlciBpbnNlcnRpbmcgYW4gZW1wdHkgbm9kZVxuICAvLyBvciBqdXN0IHJlbW92aW5nIHRoZSBtYXJrZXIgaWYgaXQgd2FzIHVzZWQgYXMgYSBzZXBhcmF0b3IuXG4gIGNvbnN0IG5vZGVzID0gW107XG4gIHdoaWxlICgoY3VycmVudE5vZGUgPSBjb21tZW50Tm9kZXNJdGVyYXRvci5uZXh0Tm9kZSgpIGFzIENvbW1lbnQpKSB7XG4gICAgbm9kZXMucHVzaChjdXJyZW50Tm9kZSk7XG4gIH1cbiAgZm9yIChjb25zdCBub2RlIG9mIG5vZGVzKSB7XG4gICAgaWYgKG5vZGUudGV4dENvbnRlbnQgPT09IFRleHROb2RlTWFya2VyLkVtcHR5Tm9kZSkge1xuICAgICAgbm9kZS5yZXBsYWNlV2l0aChkb2MuY3JlYXRlVGV4dE5vZGUoJycpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbm9kZS5yZW1vdmUoKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBJbnRlcm5hbCB0eXBlIHRoYXQgcmVwcmVzZW50cyBhIGNsYWltZWQgbm9kZS5cbiAqIE9ubHkgdXNlZCBpbiBkZXYgbW9kZS5cbiAqL1xuZXhwb3J0IGVudW0gSHlkcmF0aW9uU3RhdHVzIHtcbiAgSHlkcmF0ZWQgPSAnaHlkcmF0ZWQnLFxuICBTa2lwcGVkID0gJ3NraXBwZWQnLFxuICBNaXNtYXRjaGVkID0gJ21pc21hdGNoZWQnLFxufVxuXG5leHBvcnQgdHlwZSBIeWRyYXRpb25JbmZvID1cbiAgfCB7XG4gICAgICBzdGF0dXM6IEh5ZHJhdGlvblN0YXR1cy5IeWRyYXRlZCB8IEh5ZHJhdGlvblN0YXR1cy5Ta2lwcGVkO1xuICAgIH1cbiAgfCB7XG4gICAgICBzdGF0dXM6IEh5ZHJhdGlvblN0YXR1cy5NaXNtYXRjaGVkO1xuICAgICAgYWN0dWFsTm9kZURldGFpbHM6IHN0cmluZyB8IG51bGw7XG4gICAgICBleHBlY3RlZE5vZGVEZXRhaWxzOiBzdHJpbmcgfCBudWxsO1xuICAgIH07XG5cbmNvbnN0IEhZRFJBVElPTl9JTkZPX0tFWSA9ICdfX25nRGVidWdIeWRyYXRpb25JbmZvX18nO1xuXG5leHBvcnQgdHlwZSBIeWRyYXRlZE5vZGUgPSB7XG4gIFtIWURSQVRJT05fSU5GT19LRVldPzogSHlkcmF0aW9uSW5mbztcbn07XG5cbmZ1bmN0aW9uIHBhdGNoSHlkcmF0aW9uSW5mbyhub2RlOiBSTm9kZSwgaW5mbzogSHlkcmF0aW9uSW5mbykge1xuICAobm9kZSBhcyBIeWRyYXRlZE5vZGUpW0hZRFJBVElPTl9JTkZPX0tFWV0gPSBpbmZvO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZEh5ZHJhdGlvbkluZm8obm9kZTogUk5vZGUpOiBIeWRyYXRpb25JbmZvIHwgbnVsbCB7XG4gIHJldHVybiAobm9kZSBhcyBIeWRyYXRlZE5vZGUpW0hZRFJBVElPTl9JTkZPX0tFWV0gPz8gbnVsbDtcbn1cblxuLyoqXG4gKiBNYXJrcyBhIG5vZGUgYXMgXCJjbGFpbWVkXCIgYnkgaHlkcmF0aW9uIHByb2Nlc3MuXG4gKiBUaGlzIGlzIG5lZWRlZCB0byBtYWtlIGFzc2Vzc21lbnRzIGluIHRlc3RzIHdoZXRoZXJcbiAqIHRoZSBoeWRyYXRpb24gcHJvY2VzcyBoYW5kbGVkIGFsbCBub2Rlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1hcmtSTm9kZUFzQ2xhaW1lZEJ5SHlkcmF0aW9uKG5vZGU6IFJOb2RlLCBjaGVja0lmQWxyZWFkeUNsYWltZWQgPSB0cnVlKSB7XG4gIGlmICghbmdEZXZNb2RlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ0NhbGxpbmcgYG1hcmtSTm9kZUFzQ2xhaW1lZEJ5SHlkcmF0aW9uYCBpbiBwcm9kIG1vZGUgJyArXG4gICAgICAgICdpcyBub3Qgc3VwcG9ydGVkIGFuZCBsaWtlbHkgYSBtaXN0YWtlLicsXG4gICAgKTtcbiAgfVxuICBpZiAoY2hlY2tJZkFscmVhZHlDbGFpbWVkICYmIGlzUk5vZGVDbGFpbWVkRm9ySHlkcmF0aW9uKG5vZGUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUcnlpbmcgdG8gY2xhaW0gYSBub2RlLCB3aGljaCB3YXMgY2xhaW1lZCBhbHJlYWR5LicpO1xuICB9XG4gIHBhdGNoSHlkcmF0aW9uSW5mbyhub2RlLCB7c3RhdHVzOiBIeWRyYXRpb25TdGF0dXMuSHlkcmF0ZWR9KTtcbiAgbmdEZXZNb2RlLmh5ZHJhdGVkTm9kZXMrKztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hcmtSTm9kZUFzU2tpcHBlZEJ5SHlkcmF0aW9uKG5vZGU6IFJOb2RlKSB7XG4gIGlmICghbmdEZXZNb2RlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ0NhbGxpbmcgYG1hcmtSTm9kZUFzU2tpcHBlZEJ5SHlkcmF0aW9uYCBpbiBwcm9kIG1vZGUgJyArXG4gICAgICAgICdpcyBub3Qgc3VwcG9ydGVkIGFuZCBsaWtlbHkgYSBtaXN0YWtlLicsXG4gICAgKTtcbiAgfVxuICBwYXRjaEh5ZHJhdGlvbkluZm8obm9kZSwge3N0YXR1czogSHlkcmF0aW9uU3RhdHVzLlNraXBwZWR9KTtcbiAgbmdEZXZNb2RlLmNvbXBvbmVudHNTa2lwcGVkSHlkcmF0aW9uKys7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXJrUk5vZGVBc0hhdmluZ0h5ZHJhdGlvbk1pc21hdGNoKFxuICBub2RlOiBSTm9kZSxcbiAgZXhwZWN0ZWROb2RlRGV0YWlsczogc3RyaW5nIHwgbnVsbCA9IG51bGwsXG4gIGFjdHVhbE5vZGVEZXRhaWxzOiBzdHJpbmcgfCBudWxsID0gbnVsbCxcbikge1xuICBpZiAoIW5nRGV2TW9kZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdDYWxsaW5nIGBtYXJrUk5vZGVBc01pc21hdGNoZWRCeUh5ZHJhdGlvbmAgaW4gcHJvZCBtb2RlICcgK1xuICAgICAgICAnaXMgbm90IHN1cHBvcnRlZCBhbmQgbGlrZWx5IGEgbWlzdGFrZS4nLFxuICAgICk7XG4gIH1cblxuICAvLyBUaGUgUk5vZGUgY2FuIGJlIGEgc3RhbmRhcmQgSFRNTEVsZW1lbnQgKG5vdCBhbiBBbmd1bGFyIGNvbXBvbmVudCBvciBkaXJlY3RpdmUpXG4gIC8vIFRoZSBkZXZ0b29scyBjb21wb25lbnQgdHJlZSBvbmx5IGRpc3BsYXlzIEFuZ3VsYXIgY29tcG9uZW50cyAmIGRpcmVjdGl2ZXNcbiAgLy8gVGhlcmVmb3JlIHdlIGF0dGFjaCB0aGUgZGVidWcgaW5mbyB0byB0aGUgY2xvc2VzdCBjb21wb25lbnQvZGlyZWN0aXZlXG4gIHdoaWxlIChub2RlICYmICFnZXRDb21wb25lbnQobm9kZSBhcyBFbGVtZW50KSkge1xuICAgIG5vZGUgPSBub2RlPy5wYXJlbnROb2RlIGFzIFJOb2RlO1xuICB9XG5cbiAgaWYgKG5vZGUpIHtcbiAgICBwYXRjaEh5ZHJhdGlvbkluZm8obm9kZSwge1xuICAgICAgc3RhdHVzOiBIeWRyYXRpb25TdGF0dXMuTWlzbWF0Y2hlZCxcbiAgICAgIGV4cGVjdGVkTm9kZURldGFpbHMsXG4gICAgICBhY3R1YWxOb2RlRGV0YWlscyxcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNSTm9kZUNsYWltZWRGb3JIeWRyYXRpb24obm9kZTogUk5vZGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIHJlYWRIeWRyYXRpb25JbmZvKG5vZGUpPy5zdGF0dXMgPT09IEh5ZHJhdGlvblN0YXR1cy5IeWRyYXRlZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFNlZ21lbnRIZWFkKFxuICBoeWRyYXRpb25JbmZvOiBEZWh5ZHJhdGVkVmlldyxcbiAgaW5kZXg6IG51bWJlcixcbiAgbm9kZTogUk5vZGUgfCBudWxsLFxuKTogdm9pZCB7XG4gIGh5ZHJhdGlvbkluZm8uc2VnbWVudEhlYWRzID8/PSB7fTtcbiAgaHlkcmF0aW9uSW5mby5zZWdtZW50SGVhZHNbaW5kZXhdID0gbm9kZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFNlZ21lbnRIZWFkKGh5ZHJhdGlvbkluZm86IERlaHlkcmF0ZWRWaWV3LCBpbmRleDogbnVtYmVyKTogUk5vZGUgfCBudWxsIHtcbiAgcmV0dXJuIGh5ZHJhdGlvbkluZm8uc2VnbWVudEhlYWRzPy5baW5kZXhdID8/IG51bGw7XG59XG5cbi8qKlxuICogUmV0dXJucyB0aGUgc2l6ZSBvZiBhbiA8bmctY29udGFpbmVyPiwgdXNpbmcgZWl0aGVyIHRoZSBpbmZvcm1hdGlvblxuICogc2VyaWFsaXplZCBpbiBgRUxFTUVOVF9DT05UQUlORVJTYCAoZWxlbWVudCBjb250YWluZXIgc2l6ZSkgb3IgYnlcbiAqIGNvbXB1dGluZyB0aGUgc3VtIG9mIHJvb3Qgbm9kZXMgaW4gYWxsIGRlaHlkcmF0ZWQgdmlld3MgaW4gYSBnaXZlblxuICogY29udGFpbmVyIChpbiBjYXNlIHRoaXMgYDxuZy1jb250YWluZXI+YCB3YXMgYWxzbyB1c2VkIGFzIGEgdmlld1xuICogY29udGFpbmVyIGhvc3Qgbm9kZSwgZS5nLiA8bmctY29udGFpbmVyICpuZ0lmPikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXROZ0NvbnRhaW5lclNpemUoaHlkcmF0aW9uSW5mbzogRGVoeWRyYXRlZFZpZXcsIGluZGV4OiBudW1iZXIpOiBudW1iZXIgfCBudWxsIHtcbiAgY29uc3QgZGF0YSA9IGh5ZHJhdGlvbkluZm8uZGF0YTtcbiAgbGV0IHNpemUgPSBkYXRhW0VMRU1FTlRfQ09OVEFJTkVSU10/LltpbmRleF0gPz8gbnVsbDtcbiAgLy8gSWYgdGhlcmUgaXMgbm8gc2VyaWFsaXplZCBpbmZvcm1hdGlvbiBhdmFpbGFibGUgaW4gdGhlIGBFTEVNRU5UX0NPTlRBSU5FUlNgIHNsb3QsXG4gIC8vIGNoZWNrIGlmIHdlIGhhdmUgaW5mbyBhYm91dCB2aWV3IGNvbnRhaW5lcnMgYXQgdGhpcyBsb2NhdGlvbiAoZS5nLlxuICAvLyBgPG5nLWNvbnRhaW5lciAqbmdJZj5gKSBhbmQgdXNlIGNvbnRhaW5lciBzaXplIGFzIGEgbnVtYmVyIG9mIHJvb3Qgbm9kZXMgaW4gdGhpc1xuICAvLyBlbGVtZW50IGNvbnRhaW5lci5cbiAgaWYgKHNpemUgPT09IG51bGwgJiYgZGF0YVtDT05UQUlORVJTXT8uW2luZGV4XSkge1xuICAgIHNpemUgPSBjYWxjU2VyaWFsaXplZENvbnRhaW5lclNpemUoaHlkcmF0aW9uSW5mbywgaW5kZXgpO1xuICB9XG4gIHJldHVybiBzaXplO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNTZXJpYWxpemVkRWxlbWVudENvbnRhaW5lcihcbiAgaHlkcmF0aW9uSW5mbzogRGVoeWRyYXRlZFZpZXcsXG4gIGluZGV4OiBudW1iZXIsXG4pOiBib29sZWFuIHtcbiAgcmV0dXJuIGh5ZHJhdGlvbkluZm8uZGF0YVtFTEVNRU5UX0NPTlRBSU5FUlNdPy5baW5kZXhdICE9PSB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTZXJpYWxpemVkQ29udGFpbmVyVmlld3MoXG4gIGh5ZHJhdGlvbkluZm86IERlaHlkcmF0ZWRWaWV3LFxuICBpbmRleDogbnVtYmVyLFxuKTogU2VyaWFsaXplZENvbnRhaW5lclZpZXdbXSB8IG51bGwge1xuICByZXR1cm4gaHlkcmF0aW9uSW5mby5kYXRhW0NPTlRBSU5FUlNdPy5baW5kZXhdID8/IG51bGw7XG59XG5cbi8qKlxuICogQ29tcHV0ZXMgdGhlIHNpemUgb2YgYSBzZXJpYWxpemVkIGNvbnRhaW5lciAodGhlIG51bWJlciBvZiByb290IG5vZGVzKVxuICogYnkgY2FsY3VsYXRpbmcgdGhlIHN1bSBvZiByb290IG5vZGVzIGluIGFsbCBkZWh5ZHJhdGVkIHZpZXdzIGluIHRoaXMgY29udGFpbmVyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2FsY1NlcmlhbGl6ZWRDb250YWluZXJTaXplKGh5ZHJhdGlvbkluZm86IERlaHlkcmF0ZWRWaWV3LCBpbmRleDogbnVtYmVyKTogbnVtYmVyIHtcbiAgY29uc3Qgdmlld3MgPSBnZXRTZXJpYWxpemVkQ29udGFpbmVyVmlld3MoaHlkcmF0aW9uSW5mbywgaW5kZXgpID8/IFtdO1xuICBsZXQgbnVtTm9kZXMgPSAwO1xuICBmb3IgKGxldCB2aWV3IG9mIHZpZXdzKSB7XG4gICAgbnVtTm9kZXMgKz0gdmlld1tOVU1fUk9PVF9OT0RFU10gKiAodmlld1tNVUxUSVBMSUVSXSA/PyAxKTtcbiAgfVxuICByZXR1cm4gbnVtTm9kZXM7XG59XG5cbi8qKlxuICogQXR0ZW1wdCB0byBpbml0aWFsaXplIHRoZSBgZGlzY29ubmVjdGVkTm9kZXNgIGZpZWxkIG9mIHRoZSBnaXZlblxuICogYERlaHlkcmF0ZWRWaWV3YC4gUmV0dXJucyB0aGUgaW5pdGlhbGl6ZWQgdmFsdWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbml0RGlzY29ubmVjdGVkTm9kZXMoaHlkcmF0aW9uSW5mbzogRGVoeWRyYXRlZFZpZXcpOiBTZXQ8bnVtYmVyPiB8IG51bGwge1xuICAvLyBDaGVjayBpZiB3ZSBhcmUgcHJvY2Vzc2luZyBkaXNjb25uZWN0ZWQgaW5mbyBmb3IgdGhlIGZpcnN0IHRpbWUuXG4gIGlmICh0eXBlb2YgaHlkcmF0aW9uSW5mby5kaXNjb25uZWN0ZWROb2RlcyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zdCBub2RlSWRzID0gaHlkcmF0aW9uSW5mby5kYXRhW0RJU0NPTk5FQ1RFRF9OT0RFU107XG4gICAgaHlkcmF0aW9uSW5mby5kaXNjb25uZWN0ZWROb2RlcyA9IG5vZGVJZHMgPyBuZXcgU2V0KG5vZGVJZHMpIDogbnVsbDtcbiAgfVxuICByZXR1cm4gaHlkcmF0aW9uSW5mby5kaXNjb25uZWN0ZWROb2Rlcztcbn1cblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciBhIG5vZGUgaXMgYW5ub3RhdGVkIGFzIFwiZGlzY29ubmVjdGVkXCIsIGkuZS4gbm90IHByZXNlbnRcbiAqIGluIHRoZSBET00gYXQgc2VyaWFsaXphdGlvbiB0aW1lLiBXZSBzaG91bGQgbm90IGF0dGVtcHQgaHlkcmF0aW9uIGZvclxuICogc3VjaCBub2RlcyBhbmQgaW5zdGVhZCwgdXNlIGEgcmVndWxhciBcImNyZWF0aW9uIG1vZGVcIi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRGlzY29ubmVjdGVkTm9kZShoeWRyYXRpb25JbmZvOiBEZWh5ZHJhdGVkVmlldywgaW5kZXg6IG51bWJlcik6IGJvb2xlYW4ge1xuICAvLyBDaGVjayBpZiB3ZSBhcmUgcHJvY2Vzc2luZyBkaXNjb25uZWN0ZWQgaW5mbyBmb3IgdGhlIGZpcnN0IHRpbWUuXG4gIGlmICh0eXBlb2YgaHlkcmF0aW9uSW5mby5kaXNjb25uZWN0ZWROb2RlcyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zdCBub2RlSWRzID0gaHlkcmF0aW9uSW5mby5kYXRhW0RJU0NPTk5FQ1RFRF9OT0RFU107XG4gICAgaHlkcmF0aW9uSW5mby5kaXNjb25uZWN0ZWROb2RlcyA9IG5vZGVJZHMgPyBuZXcgU2V0KG5vZGVJZHMpIDogbnVsbDtcbiAgfVxuICByZXR1cm4gISFpbml0RGlzY29ubmVjdGVkTm9kZXMoaHlkcmF0aW9uSW5mbyk/LmhhcyhpbmRleCk7XG59XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHRvIHByZXBhcmUgdGV4dCBub2RlcyBmb3Igc2VyaWFsaXphdGlvbiBieSBlbnN1cmluZ1xuICogdGhhdCBzZXBlcmF0ZSBsb2dpY2FsIHRleHQgYmxvY2tzIGluIHRoZSBET00gcmVtYWluIHNlcGFyYXRlIGFmdGVyXG4gKiBzZXJpYWxpemF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcHJvY2Vzc1RleHROb2RlQmVmb3JlU2VyaWFsaXphdGlvbihjb250ZXh0OiBIeWRyYXRpb25Db250ZXh0LCBub2RlOiBSTm9kZSkge1xuICAvLyBIYW5kbGUgY2FzZXMgd2hlcmUgdGV4dCBub2RlcyBjYW4gYmUgbG9zdCBhZnRlciBET00gc2VyaWFsaXphdGlvbjpcbiAgLy8gIDEuIFdoZW4gdGhlcmUgaXMgYW4gKmVtcHR5IHRleHQgbm9kZSogaW4gRE9NOiBpbiB0aGlzIGNhc2UsIHRoaXNcbiAgLy8gICAgIG5vZGUgd291bGQgbm90IG1ha2UgaXQgaW50byB0aGUgc2VyaWFsaXplZCBzdHJpbmcgYW5kIGFzIGEgcmVzdWx0LFxuICAvLyAgICAgdGhpcyBub2RlIHdvdWxkbid0IGJlIGNyZWF0ZWQgaW4gYSBicm93c2VyLiBUaGlzIHdvdWxkIHJlc3VsdCBpblxuICAvLyAgICAgYSBtaXNtYXRjaCBkdXJpbmcgdGhlIGh5ZHJhdGlvbiwgd2hlcmUgdGhlIHJ1bnRpbWUgbG9naWMgd291bGQgZXhwZWN0XG4gIC8vICAgICBhIHRleHQgbm9kZSB0byBiZSBwcmVzZW50IGluIGxpdmUgRE9NLCBidXQgbm8gdGV4dCBub2RlIHdvdWxkIGV4aXN0LlxuICAvLyAgICAgRXhhbXBsZTogYDxzcGFuPnt7IG5hbWUgfX08L3NwYW4+YCB3aGVuIHRoZSBgbmFtZWAgaXMgYW4gZW1wdHkgc3RyaW5nLlxuICAvLyAgICAgVGhpcyB3b3VsZCByZXN1bHQgaW4gYDxzcGFuPjwvc3Bhbj5gIHN0cmluZyBhZnRlciBzZXJpYWxpemF0aW9uIGFuZFxuICAvLyAgICAgaW4gYSBicm93c2VyIG9ubHkgdGhlIGBzcGFuYCBlbGVtZW50IHdvdWxkIGJlIGNyZWF0ZWQuIFRvIHJlc29sdmUgdGhhdCxcbiAgLy8gICAgIGFuIGV4dHJhIGNvbW1lbnQgbm9kZSBpcyBhcHBlbmRlZCBpbiBwbGFjZSBvZiBhbiBlbXB0eSB0ZXh0IG5vZGUgYW5kXG4gIC8vICAgICB0aGF0IHNwZWNpYWwgY29tbWVudCBub2RlIGlzIHJlcGxhY2VkIHdpdGggYW4gZW1wdHkgdGV4dCBub2RlICpiZWZvcmUqXG4gIC8vICAgICBoeWRyYXRpb24uXG4gIC8vICAyLiBXaGVuIHRoZXJlIGFyZSAyIGNvbnNlY3V0aXZlIHRleHQgbm9kZXMgcHJlc2VudCBpbiB0aGUgRE9NLlxuICAvLyAgICAgRXhhbXBsZTogYDxkaXY+SGVsbG8gPG5nLWNvbnRhaW5lciAqbmdJZj1cInRydWVcIj53b3JsZDwvbmctY29udGFpbmVyPjwvZGl2PmAuXG4gIC8vICAgICBJbiB0aGlzIHNjZW5hcmlvLCB0aGUgbGl2ZSBET00gd291bGQgbG9vayBsaWtlIHRoaXM6XG4gIC8vICAgICAgIDxkaXY+I3RleHQoJ0hlbGxvICcpICN0ZXh0KCd3b3JsZCcpICNjb21tZW50KCdjb250YWluZXInKTwvZGl2PlxuICAvLyAgICAgU2VyaWFsaXplZCBzdHJpbmcgd291bGQgbG9vayBsaWtlIHRoaXM6IGA8ZGl2PkhlbGxvIHdvcmxkPCEtLWNvbnRhaW5lci0tPjwvZGl2PmAuXG4gIC8vICAgICBUaGUgbGl2ZSBET00gaW4gYSBicm93c2VyIGFmdGVyIHRoYXQgd291bGQgYmU6XG4gIC8vICAgICAgIDxkaXY+I3RleHQoJ0hlbGxvIHdvcmxkJykgI2NvbW1lbnQoJ2NvbnRhaW5lcicpPC9kaXY+XG4gIC8vICAgICBOb3RpY2UgaG93IDIgdGV4dCBub2RlcyBhcmUgbm93IFwibWVyZ2VkXCIgaW50byBvbmUuIFRoaXMgd291bGQgY2F1c2UgaHlkcmF0aW9uXG4gIC8vICAgICBsb2dpYyB0byBmYWlsLCBzaW5jZSBpdCdkIGV4cGVjdCAyIHRleHQgbm9kZXMgYmVpbmcgcHJlc2VudCwgbm90IG9uZS5cbiAgLy8gICAgIFRvIGZpeCB0aGlzLCB3ZSBpbnNlcnQgYSBzcGVjaWFsIGNvbW1lbnQgbm9kZSBpbiBiZXR3ZWVuIHRob3NlIHRleHQgbm9kZXMsIHNvXG4gIC8vICAgICBzZXJpYWxpemVkIHJlcHJlc2VudGF0aW9uIGlzOiBgPGRpdj5IZWxsbyA8IS0tbmd0bnMtLT53b3JsZDwhLS1jb250YWluZXItLT48L2Rpdj5gLlxuICAvLyAgICAgVGhpcyBmb3JjZXMgYnJvd3NlciB0byBjcmVhdGUgMiB0ZXh0IG5vZGVzIHNlcGFyYXRlZCBieSBhIGNvbW1lbnQgbm9kZS5cbiAgLy8gICAgIEJlZm9yZSBydW5uaW5nIGEgaHlkcmF0aW9uIHByb2Nlc3MsIHRoaXMgc3BlY2lhbCBjb21tZW50IG5vZGUgaXMgcmVtb3ZlZCwgc28gdGhlXG4gIC8vICAgICBsaXZlIERPTSBoYXMgZXhhY3RseSB0aGUgc2FtZSBzdGF0ZSBhcyBpdCB3YXMgYmVmb3JlIHNlcmlhbGl6YXRpb24uXG5cbiAgLy8gQ29sbGVjdCB0aGlzIG5vZGUgYXMgcmVxdWlyZWQgc3BlY2lhbCBhbm5vdGF0aW9uIG9ubHkgd2hlbiBpdHNcbiAgLy8gY29udGVudHMgaXMgZW1wdHkuIE90aGVyd2lzZSwgc3VjaCB0ZXh0IG5vZGUgd291bGQgYmUgcHJlc2VudCBvblxuICAvLyB0aGUgY2xpZW50IGFmdGVyIHNlcnZlci1zaWRlIHJlbmRlcmluZyBhbmQgbm8gc3BlY2lhbCBoYW5kbGluZyBuZWVkZWQuXG4gIGNvbnN0IGVsID0gbm9kZSBhcyBIVE1MRWxlbWVudDtcbiAgY29uc3QgY29ycnVwdGVkVGV4dE5vZGVzID0gY29udGV4dC5jb3JydXB0ZWRUZXh0Tm9kZXM7XG4gIGlmIChlbC50ZXh0Q29udGVudCA9PT0gJycpIHtcbiAgICBjb3JydXB0ZWRUZXh0Tm9kZXMuc2V0KGVsLCBUZXh0Tm9kZU1hcmtlci5FbXB0eU5vZGUpO1xuICB9IGVsc2UgaWYgKGVsLm5leHRTaWJsaW5nPy5ub2RlVHlwZSA9PT0gTm9kZS5URVhUX05PREUpIHtcbiAgICBjb3JydXB0ZWRUZXh0Tm9kZXMuc2V0KGVsLCBUZXh0Tm9kZU1hcmtlci5TZXBhcmF0b3IpO1xuICB9XG59XG4iXX0=