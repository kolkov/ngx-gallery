/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { isDetachedByI18n } from '../i18n/utils';
import { ViewEncapsulation } from '../metadata';
import { assertTNode } from '../render3/assert';
import { collectNativeNodes, collectNativeNodesInLContainer } from '../render3/collect_native_nodes';
import { getComponentDef } from '../render3/definition';
import { CONTAINER_HEADER_OFFSET } from '../render3/interfaces/container';
import { isTNodeShape } from '../render3/interfaces/node';
import { hasI18n, isComponentHost, isLContainer, isProjectionTNode, isRootView, } from '../render3/interfaces/type_checks';
import { CONTEXT, HEADER_OFFSET, HOST, PARENT, RENDERER, TVIEW, } from '../render3/interfaces/view';
import { unwrapLView, unwrapRNode } from '../render3/util/view_utils';
import { TransferState } from '../transfer_state';
import { unsupportedProjectionOfDomNodes } from './error_handling';
import { collectDomEventsInfo } from './event_replay';
import { setJSActionAttributes } from '../event_delegation_utils';
import { getOrComputeI18nChildren, isI18nHydrationEnabled, isI18nHydrationSupportEnabled, trySerializeI18nBlock, } from './i18n';
import { CONTAINERS, DISCONNECTED_NODES, ELEMENT_CONTAINERS, I18N_DATA, MULTIPLIER, NODES, NUM_ROOT_NODES, TEMPLATE_ID, TEMPLATES, } from './interfaces';
import { calcPathForNode, isDisconnectedNode } from './node_lookup_utils';
import { isInSkipHydrationBlock, SKIP_HYDRATION_ATTR_NAME } from './skip_hydration';
import { EVENT_REPLAY_ENABLED_DEFAULT, IS_EVENT_REPLAY_ENABLED } from './tokens';
import { getLNodeForHydration, NGH_ATTR_NAME, NGH_DATA_KEY, processTextNodeBeforeSerialization, } from './utils';
/**
 * A collection that tracks all serialized views (`ngh` DOM annotations)
 * to avoid duplication. An attempt to add a duplicate view results in the
 * collection returning the index of the previously collected serialized view.
 * This reduces the number of annotations needed for a given page.
 */
class SerializedViewCollection {
    constructor() {
        this.views = [];
        this.indexByContent = new Map();
    }
    add(serializedView) {
        const viewAsString = JSON.stringify(serializedView);
        if (!this.indexByContent.has(viewAsString)) {
            const index = this.views.length;
            this.views.push(serializedView);
            this.indexByContent.set(viewAsString, index);
            return index;
        }
        return this.indexByContent.get(viewAsString);
    }
    getAll() {
        return this.views;
    }
}
/**
 * Global counter that is used to generate a unique id for TViews
 * during the serialization process.
 */
let tViewSsrId = 0;
/**
 * Generates a unique id for a given TView and returns this id.
 * The id is also stored on this instance of a TView and reused in
 * subsequent calls.
 *
 * This id is needed to uniquely identify and pick up dehydrated views
 * at runtime.
 */
function getSsrId(tView) {
    if (!tView.ssrId) {
        tView.ssrId = `t${tViewSsrId++}`;
    }
    return tView.ssrId;
}
/**
 * Computes the number of root nodes in a given view
 * (or child nodes in a given container if a tNode is provided).
 */
function calcNumRootNodes(tView, lView, tNode) {
    const rootNodes = [];
    collectNativeNodes(tView, lView, tNode, rootNodes);
    return rootNodes.length;
}
/**
 * Computes the number of root nodes in all views in a given LContainer.
 */
function calcNumRootNodesInLContainer(lContainer) {
    const rootNodes = [];
    collectNativeNodesInLContainer(lContainer, rootNodes);
    return rootNodes.length;
}
/**
 * Annotates root level component's LView for hydration,
 * see `annotateHostElementForHydration` for additional information.
 */
function annotateComponentLViewForHydration(lView, context) {
    const hostElement = lView[HOST];
    // Root elements might also be annotated with the `ngSkipHydration` attribute,
    // check if it's present before starting the serialization process.
    if (hostElement && !hostElement.hasAttribute(SKIP_HYDRATION_ATTR_NAME)) {
        return annotateHostElementForHydration(hostElement, lView, context);
    }
    return null;
}
/**
 * Annotates root level LContainer for hydration. This happens when a root component
 * injects ViewContainerRef, thus making the component an anchor for a view container.
 * This function serializes the component itself as well as all views from the view
 * container.
 */
function annotateLContainerForHydration(lContainer, context) {
    const componentLView = unwrapLView(lContainer[HOST]);
    // Serialize the root component itself.
    const componentLViewNghIndex = annotateComponentLViewForHydration(componentLView, context);
    if (componentLViewNghIndex === null) {
        // Component was not serialized (for example, if hydration was skipped by adding
        // the `ngSkipHydration` attribute or this component uses i18n blocks in the template,
        // but `withI18nSupport()` was not added), avoid annotating host element with the `ngh`
        // attribute.
        return;
    }
    const hostElement = unwrapRNode(componentLView[HOST]);
    // Serialize all views within this view container.
    const rootLView = lContainer[PARENT];
    const rootLViewNghIndex = annotateHostElementForHydration(hostElement, rootLView, context);
    const renderer = componentLView[RENDERER];
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
    const finalIndex = `${componentLViewNghIndex}|${rootLViewNghIndex}`;
    renderer.setAttribute(hostElement, NGH_ATTR_NAME, finalIndex);
}
/**
 * Annotates all components bootstrapped in a given ApplicationRef
 * with info needed for hydration.
 *
 * @param appRef An instance of an ApplicationRef.
 * @param doc A reference to the current Document instance.
 * @return event types that need to be replayed
 */
export function annotateForHydration(appRef, doc) {
    const injector = appRef.injector;
    const isI18nHydrationEnabledVal = isI18nHydrationEnabled(injector);
    const serializedViewCollection = new SerializedViewCollection();
    const corruptedTextNodes = new Map();
    const viewRefs = appRef._views;
    const shouldReplayEvents = injector.get(IS_EVENT_REPLAY_ENABLED, EVENT_REPLAY_ENABLED_DEFAULT);
    const eventTypesToReplay = {
        regular: new Set(),
        capture: new Set(),
    };
    for (const viewRef of viewRefs) {
        const lNode = getLNodeForHydration(viewRef);
        // An `lView` might be `null` if a `ViewRef` represents
        // an embedded view (not a component view).
        if (lNode !== null) {
            const context = {
                serializedViewCollection,
                corruptedTextNodes,
                isI18nHydrationEnabled: isI18nHydrationEnabledVal,
                i18nChildren: new Map(),
                eventTypesToReplay,
                shouldReplayEvents,
            };
            if (isLContainer(lNode)) {
                annotateLContainerForHydration(lNode, context);
            }
            else {
                annotateComponentLViewForHydration(lNode, context);
            }
            insertCorruptedTextNodeMarkers(corruptedTextNodes, doc);
        }
    }
    // Note: we *always* include hydration info key and a corresponding value
    // into the TransferState, even if the list of serialized views is empty.
    // This is needed as a signal to the client that the server part of the
    // hydration logic was setup and enabled correctly. Otherwise, if a client
    // hydration doesn't find a key in the transfer state - an error is produced.
    const serializedViews = serializedViewCollection.getAll();
    const transferState = injector.get(TransferState);
    transferState.set(NGH_DATA_KEY, serializedViews);
    return eventTypesToReplay;
}
/**
 * Serializes the lContainer data into a list of SerializedView objects,
 * that represent views within this lContainer.
 *
 * @param lContainer the lContainer we are serializing
 * @param context the hydration context
 * @returns an array of the `SerializedView` objects
 */
function serializeLContainer(lContainer, context) {
    const views = [];
    let lastViewAsString = '';
    for (let i = CONTAINER_HEADER_OFFSET; i < lContainer.length; i++) {
        let childLView = lContainer[i];
        let template;
        let numRootNodes;
        let serializedView;
        if (isRootView(childLView)) {
            // If this is a root view, get an LView for the underlying component,
            // because it contains information about the view to serialize.
            childLView = childLView[HEADER_OFFSET];
            // If we have an LContainer at this position, this indicates that the
            // host element was used as a ViewContainerRef anchor (e.g. a `ViewContainerRef`
            // was injected within the component class). This case requires special handling.
            if (isLContainer(childLView)) {
                // Calculate the number of root nodes in all views in a given container
                // and increment by one to account for an anchor node itself, i.e. in this
                // scenario we'll have a layout that would look like this:
                // `<app-root /><#VIEW1><#VIEW2>...<!--container-->`
                // The `+1` is to capture the `<app-root />` element.
                numRootNodes = calcNumRootNodesInLContainer(childLView) + 1;
                annotateLContainerForHydration(childLView, context);
                const componentLView = unwrapLView(childLView[HOST]);
                serializedView = {
                    [TEMPLATE_ID]: componentLView[TVIEW].ssrId,
                    [NUM_ROOT_NODES]: numRootNodes,
                };
            }
        }
        if (!serializedView) {
            const childTView = childLView[TVIEW];
            if (childTView.type === 1 /* TViewType.Component */) {
                template = childTView.ssrId;
                // This is a component view, thus it has only 1 root node: the component
                // host node itself (other nodes would be inside that host node).
                numRootNodes = 1;
            }
            else {
                template = getSsrId(childTView);
                numRootNodes = calcNumRootNodes(childTView, childLView, childTView.firstChild);
            }
            serializedView = {
                [TEMPLATE_ID]: template,
                [NUM_ROOT_NODES]: numRootNodes,
                ...serializeLView(lContainer[i], context),
            };
        }
        // Check if the previous view has the same shape (for example, it was
        // produced by the *ngFor), in which case bump the counter on the previous
        // view instead of including the same information again.
        const currentViewAsString = JSON.stringify(serializedView);
        if (views.length > 0 && currentViewAsString === lastViewAsString) {
            const previousView = views[views.length - 1];
            previousView[MULTIPLIER] ??= 1;
            previousView[MULTIPLIER]++;
        }
        else {
            // Record this view as most recently added.
            lastViewAsString = currentViewAsString;
            views.push(serializedView);
        }
    }
    return views;
}
/**
 * Helper function to produce a node path (which navigation steps runtime logic
 * needs to take to locate a node) and stores it in the `NODES` section of the
 * current serialized view.
 */
function appendSerializedNodePath(ngh, tNode, lView, excludedParentNodes) {
    const noOffsetIndex = tNode.index - HEADER_OFFSET;
    ngh[NODES] ??= {};
    // Ensure we don't calculate the path multiple times.
    ngh[NODES][noOffsetIndex] ??= calcPathForNode(tNode, lView, excludedParentNodes);
}
/**
 * Helper function to append information about a disconnected node.
 * This info is needed at runtime to avoid DOM lookups for this element
 * and instead, the element would be created from scratch.
 */
function appendDisconnectedNodeIndex(ngh, tNodeOrNoOffsetIndex) {
    const noOffsetIndex = typeof tNodeOrNoOffsetIndex === 'number'
        ? tNodeOrNoOffsetIndex
        : tNodeOrNoOffsetIndex.index - HEADER_OFFSET;
    ngh[DISCONNECTED_NODES] ??= [];
    if (!ngh[DISCONNECTED_NODES].includes(noOffsetIndex)) {
        ngh[DISCONNECTED_NODES].push(noOffsetIndex);
    }
}
/**
 * Serializes the lView data into a SerializedView object that will later be added
 * to the TransferState storage and referenced using the `ngh` attribute on a host
 * element.
 *
 * @param lView the lView we are serializing
 * @param context the hydration context
 * @returns the `SerializedView` object containing the data to be added to the host node
 */
function serializeLView(lView, context) {
    const ngh = {};
    const tView = lView[TVIEW];
    const i18nChildren = getOrComputeI18nChildren(tView, context);
    const nativeElementsToEventTypes = context.shouldReplayEvents
        ? collectDomEventsInfo(tView, lView, context.eventTypesToReplay)
        : null;
    // Iterate over DOM element references in an LView.
    for (let i = HEADER_OFFSET; i < tView.bindingStartIndex; i++) {
        const tNode = tView.data[i];
        const noOffsetIndex = i - HEADER_OFFSET;
        // Attempt to serialize any i18n data for the given slot. We do this first, as i18n
        // has its own process for serialization.
        const i18nData = trySerializeI18nBlock(lView, i, context);
        if (i18nData) {
            ngh[I18N_DATA] ??= {};
            ngh[I18N_DATA][noOffsetIndex] = i18nData.caseQueue;
            for (const nodeNoOffsetIndex of i18nData.disconnectedNodes) {
                appendDisconnectedNodeIndex(ngh, nodeNoOffsetIndex);
            }
            for (const nodeNoOffsetIndex of i18nData.disjointNodes) {
                const tNode = tView.data[nodeNoOffsetIndex + HEADER_OFFSET];
                ngDevMode && assertTNode(tNode);
                appendSerializedNodePath(ngh, tNode, lView, i18nChildren);
            }
            continue;
        }
        // Skip processing of a given slot in the following cases:
        // - Local refs (e.g. <div #localRef>) take up an extra slot in LViews
        //   to store the same element. In this case, there is no information in
        //   a corresponding slot in TNode data structure.
        // - When a slot contains something other than a TNode. For example, there
        //   might be some metadata information about a defer block or a control flow block.
        if (!isTNodeShape(tNode)) {
            continue;
        }
        // Skip any nodes that are in an i18n block but are considered detached (i.e. not
        // present in the template). These nodes are disconnected from the DOM tree, and
        // so we don't want to serialize any information about them.
        if (isDetachedByI18n(tNode)) {
            continue;
        }
        // Check if a native node that represents a given TNode is disconnected from the DOM tree.
        // Such nodes must be excluded from the hydration (since the hydration won't be able to
        // find them), so the TNode ids are collected and used at runtime to skip the hydration.
        //
        // This situation may happen during the content projection, when some nodes don't make it
        // into one of the content projection slots (for example, when there is no default
        // <ng-content /> slot in projector component's template).
        if (isDisconnectedNode(tNode, lView) && isContentProjectedNode(tNode)) {
            appendDisconnectedNodeIndex(ngh, tNode);
            continue;
        }
        // Attach `jsaction` attribute to elements that have registered listeners,
        // thus potentially having a need to do an event replay.
        if (nativeElementsToEventTypes && tNode.type & 2 /* TNodeType.Element */) {
            const nativeElement = unwrapRNode(lView[i]);
            if (nativeElementsToEventTypes.has(nativeElement)) {
                setJSActionAttributes(nativeElement, nativeElementsToEventTypes.get(nativeElement));
            }
        }
        if (Array.isArray(tNode.projection)) {
            for (const projectionHeadTNode of tNode.projection) {
                // We may have `null`s in slots with no projected content.
                if (!projectionHeadTNode)
                    continue;
                if (!Array.isArray(projectionHeadTNode)) {
                    // If we process re-projected content (i.e. `<ng-content>`
                    // appears at projection location), skip annotations for this content
                    // since all DOM nodes in this projection were handled while processing
                    // a parent lView, which contains those nodes.
                    if (!isProjectionTNode(projectionHeadTNode) &&
                        !isInSkipHydrationBlock(projectionHeadTNode)) {
                        if (isDisconnectedNode(projectionHeadTNode, lView)) {
                            // Check whether this node is connected, since we may have a TNode
                            // in the data structure as a projection segment head, but the
                            // content projection slot might be disabled (e.g.
                            // <ng-content *ngIf="false" />).
                            appendDisconnectedNodeIndex(ngh, projectionHeadTNode);
                        }
                        else {
                            appendSerializedNodePath(ngh, projectionHeadTNode, lView, i18nChildren);
                        }
                    }
                }
                else {
                    // If a value is an array, it means that we are processing a projection
                    // where projectable nodes were passed in as DOM nodes (for example, when
                    // calling `ViewContainerRef.createComponent(CmpA, {projectableNodes: [...]})`).
                    //
                    // In this scenario, nodes can come from anywhere (either created manually,
                    // accessed via `document.querySelector`, etc) and may be in any state
                    // (attached or detached from the DOM tree). As a result, we can not reliably
                    // restore the state for such cases during hydration.
                    throw unsupportedProjectionOfDomNodes(unwrapRNode(lView[i]));
                }
            }
        }
        conditionallyAnnotateNodePath(ngh, tNode, lView, i18nChildren);
        if (isLContainer(lView[i])) {
            // Serialize information about a template.
            const embeddedTView = tNode.tView;
            if (embeddedTView !== null) {
                ngh[TEMPLATES] ??= {};
                ngh[TEMPLATES][noOffsetIndex] = getSsrId(embeddedTView);
            }
            // Serialize views within this LContainer.
            const hostNode = lView[i][HOST]; // host node of this container
            // LView[i][HOST] can be of 2 different types:
            // - either a DOM node
            // - or an array that represents an LView of a component
            if (Array.isArray(hostNode)) {
                // This is a component, serialize info about it.
                const targetNode = unwrapRNode(hostNode);
                if (!targetNode.hasAttribute(SKIP_HYDRATION_ATTR_NAME)) {
                    annotateHostElementForHydration(targetNode, hostNode, context);
                }
            }
            ngh[CONTAINERS] ??= {};
            ngh[CONTAINERS][noOffsetIndex] = serializeLContainer(lView[i], context);
        }
        else if (Array.isArray(lView[i])) {
            // This is a component, annotate the host node with an `ngh` attribute.
            const targetNode = unwrapRNode(lView[i][HOST]);
            if (!targetNode.hasAttribute(SKIP_HYDRATION_ATTR_NAME)) {
                annotateHostElementForHydration(targetNode, lView[i], context);
            }
        }
        else {
            // <ng-container> case
            if (tNode.type & 8 /* TNodeType.ElementContainer */) {
                // An <ng-container> is represented by the number of
                // top-level nodes. This information is needed to skip over
                // those nodes to reach a corresponding anchor node (comment node).
                ngh[ELEMENT_CONTAINERS] ??= {};
                ngh[ELEMENT_CONTAINERS][noOffsetIndex] = calcNumRootNodes(tView, lView, tNode.child);
            }
            else if (tNode.type & (16 /* TNodeType.Projection */ | 128 /* TNodeType.LetDeclaration */)) {
                // Current TNode represents an `<ng-content>` slot or `@let` declaration,
                // thus it has no DOM elements associated with it, so the **next sibling**
                // node would not be able to find an anchor. In this case, use full path instead.
                let nextTNode = tNode.next;
                // Skip over all `<ng-content>` slots and `@let` declarations in a row.
                while (nextTNode !== null &&
                    nextTNode.type & (16 /* TNodeType.Projection */ | 128 /* TNodeType.LetDeclaration */)) {
                    nextTNode = nextTNode.next;
                }
                if (nextTNode && !isInSkipHydrationBlock(nextTNode)) {
                    // Handle a tNode after the `<ng-content>` slot.
                    appendSerializedNodePath(ngh, nextTNode, lView, i18nChildren);
                }
            }
            else if (tNode.type & 1 /* TNodeType.Text */) {
                const rNode = unwrapRNode(lView[i]);
                processTextNodeBeforeSerialization(context, rNode);
            }
        }
    }
    return ngh;
}
/**
 * Serializes node location in cases when it's needed, specifically:
 *
 *  1. If `tNode.projectionNext` is different from `tNode.next` - it means that
 *     the next `tNode` after projection is different from the one in the original
 *     template. Since hydration relies on `tNode.next`, this serialized info
 *     is required to help runtime code find the node at the correct location.
 *  2. In certain content projection-based use-cases, it's possible that only
 *     a content of a projected element is rendered. In this case, content nodes
 *     require an extra annotation, since runtime logic can't rely on parent-child
 *     connection to identify the location of a node.
 */
function conditionallyAnnotateNodePath(ngh, tNode, lView, excludedParentNodes) {
    // Handle case #1 described above.
    if (tNode.projectionNext &&
        tNode.projectionNext !== tNode.next &&
        !isInSkipHydrationBlock(tNode.projectionNext)) {
        appendSerializedNodePath(ngh, tNode.projectionNext, lView, excludedParentNodes);
    }
    // Handle case #2 described above.
    // Note: we only do that for the first node (i.e. when `tNode.prev === null`),
    // the rest of the nodes would rely on the current node location, so no extra
    // annotation is needed.
    if (tNode.prev === null &&
        tNode.parent !== null &&
        isDisconnectedNode(tNode.parent, lView) &&
        !isDisconnectedNode(tNode, lView)) {
        appendSerializedNodePath(ngh, tNode, lView, excludedParentNodes);
    }
}
/**
 * Determines whether a component instance that is represented
 * by a given LView uses `ViewEncapsulation.ShadowDom`.
 */
function componentUsesShadowDomEncapsulation(lView) {
    const instance = lView[CONTEXT];
    return instance?.constructor
        ? getComponentDef(instance.constructor)?.encapsulation === ViewEncapsulation.ShadowDom
        : false;
}
/**
 * Annotates component host element for hydration:
 * - by either adding the `ngh` attribute and collecting hydration-related info
 *   for the serialization and transferring to the client
 * - or by adding the `ngSkipHydration` attribute in case Angular detects that
 *   component contents is not compatible with hydration.
 *
 * @param element The Host element to be annotated
 * @param lView The associated LView
 * @param context The hydration context
 * @returns An index of serialized view from the transfer state object
 *          or `null` when a given component can not be serialized.
 */
function annotateHostElementForHydration(element, lView, context) {
    const renderer = lView[RENDERER];
    if ((hasI18n(lView) && !isI18nHydrationSupportEnabled()) ||
        componentUsesShadowDomEncapsulation(lView)) {
        // Attach the skip hydration attribute if this component:
        // - either has i18n blocks, since hydrating such blocks is not yet supported
        // - or uses ShadowDom view encapsulation, since Domino doesn't support
        //   shadow DOM, so we can not guarantee that client and server representations
        //   would exactly match
        renderer.setAttribute(element, SKIP_HYDRATION_ATTR_NAME, '');
        return null;
    }
    else {
        const ngh = serializeLView(lView, context);
        const index = context.serializedViewCollection.add(ngh);
        renderer.setAttribute(element, NGH_ATTR_NAME, index.toString());
        return index;
    }
}
/**
 * Physically inserts the comment nodes to ensure empty text nodes and adjacent
 * text node separators are preserved after server serialization of the DOM.
 * These get swapped back for empty text nodes or separators once hydration happens
 * on the client.
 *
 * @param corruptedTextNodes The Map of text nodes to be replaced with comments
 * @param doc The document
 */
function insertCorruptedTextNodeMarkers(corruptedTextNodes, doc) {
    for (const [textNode, marker] of corruptedTextNodes) {
        textNode.after(doc.createComment(marker));
    }
}
/**
 * Detects whether a given TNode represents a node that
 * is being content projected.
 */
function isContentProjectedNode(tNode) {
    let currentTNode = tNode;
    while (currentTNode != null) {
        // If we come across a component host node in parent nodes -
        // this TNode is in the content projection section.
        if (isComponentHost(currentTNode)) {
            return true;
        }
        currentTNode = currentTNode.parent;
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5ub3RhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9oeWRyYXRpb24vYW5ub3RhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBSUgsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQy9DLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUU5QyxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDOUMsT0FBTyxFQUFDLGtCQUFrQixFQUFFLDhCQUE4QixFQUFDLE1BQU0saUNBQWlDLENBQUM7QUFDbkcsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ3RELE9BQU8sRUFBQyx1QkFBdUIsRUFBYSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3BGLE9BQU8sRUFBQyxZQUFZLEVBQW1CLE1BQU0sNEJBQTRCLENBQUM7QUFFMUUsT0FBTyxFQUNMLE9BQU8sRUFDUCxlQUFlLEVBQ2YsWUFBWSxFQUNaLGlCQUFpQixFQUNqQixVQUFVLEdBQ1gsTUFBTSxtQ0FBbUMsQ0FBQztBQUMzQyxPQUFPLEVBQ0wsT0FBTyxFQUNQLGFBQWEsRUFDYixJQUFJLEVBRUosTUFBTSxFQUNOLFFBQVEsRUFFUixLQUFLLEdBRU4sTUFBTSw0QkFBNEIsQ0FBQztBQUNwQyxPQUFPLEVBQUMsV0FBVyxFQUFFLFdBQVcsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ3BFLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUVoRCxPQUFPLEVBQUMsK0JBQStCLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNqRSxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUNwRCxPQUFPLEVBQUMscUJBQXFCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUNoRSxPQUFP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QyxPQUFPLEVBQUUsYUFBYSxFQUFFLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQ2hFLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztBQUNILENBQUM7QUFFRDs7Ozs7Ozs7R0FRRztBQUNILFNBQVMsOEJBQThCLENBQ3JDLGtCQUE0QyxFQUM1QyxHQUFhO0lBRWIsS0FBSyxNQUFNLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxJQUFJLGtCQUFrQixFQUFFLENBQUM7UUFDcEQsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDNUMsQ0FBQztBQUNILENBQUM7QUFFRDs7O0dBR0c7QUFDSCxTQUFTLHNCQUFzQixDQUFDLEtBQVk7SUFDMUMsSUFBSSxZQUFZLEdBQUcsS0FBSyxDQUFDO0lBQ3pCLE9BQU8sWUFBWSxJQUFJLElBQUksRUFBRSxDQUFDO1FBQzVCLDREQUE0RDtRQUM1RCxtREFBbUQ7UUFDbkQsSUFBSSxlQUFlLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztZQUNsQyxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDRCxZQUFZLEdBQUcsWUFBWSxDQUFDLE1BQWUsQ0FBQztJQUM5QyxDQUFDO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QXBwbGljYXRpb25SZWZ9IGZyb20gJy4uL2FwcGxpY2F0aW9uL2FwcGxpY2F0aW9uX3JlZic7XG5pbXBvcnQge0FQUF9JRH0gZnJvbSAnLi4vYXBwbGljYXRpb24vYXBwbGljYXRpb25fdG9rZW5zJztcbmltcG9ydCB7aXNEZXRhY2hlZEJ5STE4bn0gZnJvbSAnLi4vaTE4bi91dGlscyc7XG5pbXBvcnQge1ZpZXdFbmNhcHN1bGF0aW9ufSBmcm9tICcuLi9tZXRhZGF0YSc7XG5pbXBvcnQge1JlbmRlcmVyMn0gZnJvbSAnLi4vcmVuZGVyJztcbmltcG9ydCB7YXNzZXJ0VE5vZGV9IGZyb20gJy4uL3JlbmRlcjMvYXNzZXJ0JztcbmltcG9ydCB7Y29sbGVjdE5hdGl2ZU5vZGVzLCBjb2xsZWN0TmF0aXZlTm9kZXNJbkxDb250YWluZXJ9IGZyb20gJy4uL3JlbmRlcjMvY29sbGVjdF9uYXRpdmVfbm9kZXMnO1xuaW1wb3J0IHtnZXRDb21wb25lbnREZWZ9IGZyb20gJy4uL3JlbmRlcjMvZGVmaW5pdGlvbic7XG5pbXBvcnQge0NPTlRBSU5FUl9IRUFERVJfT0ZGU0VULCBMQ29udGFpbmVyfSBmcm9tICcuLi9yZW5kZXIzL2ludGVyZmFjZXMvY29udGFpbmVyJztcbmltcG9ydCB7aXNUTm9kZVNoYXBlLCBUTm9kZSwgVE5vZGVUeXBlfSBmcm9tICcuLi9yZW5kZXIzL2ludGVyZmFjZXMvbm9kZSc7XG5pbXBvcnQge1JFbGVtZW50fSBmcm9tICcuLi9yZW5kZXIzL2ludGVyZmFjZXMvcmVuZGVyZXJfZG9tJztcbmltcG9ydCB7XG4gIGhhc0kxOG4sXG4gIGlzQ29tcG9uZW50SG9zdCxcbiAgaXNMQ29udGFpbmVyLFxuICBpc1Byb2plY3Rpb25UTm9kZSxcbiAgaXNSb290Vmlldyxcbn0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL3R5cGVfY2hlY2tzJztcbmltcG9ydCB7XG4gIENPTlRFWFQsXG4gIEhFQURFUl9PRkZTRVQsXG4gIEhPU1QsXG4gIExWaWV3LFxuICBQQVJFTlQsXG4gIFJFTkRFUkVSLFxuICBUVmlldyxcbiAgVFZJRVcsXG4gIFRWaWV3VHlwZSxcbn0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL3ZpZXcnO1xuaW1wb3J0IHt1bndyYXBMVmlldywgdW53cmFwUk5vZGV9IGZyb20gJy4uL3JlbmRlcjMvdXRpbC92aWV3X3V0aWxzJztcbmltcG9ydCB7VHJhbnNmZXJTdGF0ZX0gZnJvbSAnLi4vdHJhbnNmZXJfc3RhdGUnO1xuXG5pbXBvcnQge3Vuc3VwcG9ydGVkUHJvamVjdGlvbk9mRG9tTm9kZXN9IGZyb20gJy4vZXJyb3JfaGFuZGxpbmcnO1xuaW1wb3J0IHtjb2xsZWN0RG9tRXZlbnRzSW5mb30gZnJvbSAnLi9ldmVudF9yZXBsYXknO1xuaW1wb3J0IHtzZXRKU0FjdGlvbkF0dHJpYnV0ZXN9IGZyb20gJy4uL2V2ZW50X2RlbGVnYXRpb25fdXRpbHMnO1xuaW1wb3J0IHtcbiAgZ2V0T3JDb21wdXRlSTE4bkNoaWxkcmVuLFxuICBpc0kxOG5IeWRyYXRpb25FbmFibGVkLFxuICBpc0kxOG5IeWRyYXRpb25TdXBwb3J0RW5hYmxlZCxcbiAgdHJ5U2VyaWFsaXplSTE4bkJsb2NrLFxufSBmcm9tICcuL2kxOG4nO1xuaW1wb3J0IHtcbiAgQ09OVEFJTkVSUyxcbiAgRElTQ09OTkVDVEVEX05PREVTLFxuICBFTEVNRU5UX0NPTlRBSU5FUlMsXG4gIEkxOE5fREFUQSxcbiAgTVVMVElQTElFUixcbiAgTk9ERVMsXG4gIE5VTV9ST09UX05PREVTLFxuICBTZXJpYWxpemVkQ29udGFpbmVyVmlldyxcbiAgU2VyaWFsaXplZFZpZXcsXG4gIFRFTVBMQVRFX0lELFxuICBURU1QTEFURVMsXG59IGZyb20gJy4vaW50ZXJmYWNlcyc7XG5pbXBvcnQge2NhbGNQYXRoRm9yTm9kZSwgaXNEaXNjb25uZWN0ZWROb2RlfSBmcm9tICcuL25vZGVfbG9va3VwX3V0aWxzJztcbmltcG9ydCB7aXNJblNraXBIeWRyYXRpb25CbG9jaywgU0tJUF9IWURSQVRJT05fQVRUUl9OQU1FfSBmcm9tICcuL3NraXBfaHlkcmF0aW9uJztcbmltcG9ydCB7RVZFTlRfUkVQTEFZX0VOQUJMRURfREVGQVVMVCwgSVNfRVZFTlRfUkVQTEFZX0VOQUJMRUR9IGZyb20gJy4vdG9rZW5zJztcbmltcG9ydCB7XG4gIGdldExOb2RlRm9ySHlkcmF0aW9uLFxuICBOR0hfQVRUUl9OQU1FLFxuICBOR0hfREFUQV9LRVksXG4gIHByb2Nlc3NUZXh0Tm9kZUJlZm9yZVNlcmlhbGl6YXRpb24sXG4gIFRleHROb2RlTWFya2VyLFxufSBmcm9tICcuL3V0aWxzJztcblxuLyoqXG4gKiBBIGNvbGxlY3Rpb24gdGhhdCB0cmFja3MgYWxsIHNlcmlhbGl6ZWQgdmlld3MgKGBuZ2hgIERPTSBhbm5vdGF0aW9ucylcbiAqIHRvIGF2b2lkIGR1cGxpY2F0aW9uLiBBbiBhdHRlbXB0IHRvIGFkZCBhIGR1cGxpY2F0ZSB2aWV3IHJlc3VsdHMgaW4gdGhlXG4gKiBjb2xsZWN0aW9uIHJldHVybmluZyB0aGUgaW5kZXggb2YgdGhlIHByZXZpb3VzbHkgY29sbGVjdGVkIHNlcmlhbGl6ZWQgdmlldy5cbiAqIFRoaXMgcmVkdWNlcyB0aGUgbnVtYmVyIG9mIGFubm90YXRpb25zIG5lZWRlZCBmb3IgYSBnaXZlbiBwYWdlLlxuICovXG5jbGFzcyBTZXJpYWxpemVkVmlld0NvbGxlY3Rpb24ge1xuICBwcml2YXRlIHZpZXdzOiBTZXJpYWxpemVkVmlld1tdID0gW107XG4gIHByaXZhdGUgaW5kZXhCeUNvbnRlbnQgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuXG4gIGFkZChzZXJpYWxpemVkVmlldzogU2VyaWFsaXplZFZpZXcpOiBudW1iZXIge1xuICAgIGNvbnN0IHZpZXdBc1N0cmluZyA9IEpTT04uc3RyaW5naWZ5KHNlcmlhbGl6ZWRWaWV3KTtcbiAgICBpZiAoIXRoaXMuaW5kZXhCeUNvbnRlbnQuaGFzKHZpZXdBc1N0cmluZykpIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy52aWV3cy5sZW5ndGg7XG4gICAgICB0aGlzLnZpZXdzLnB1c2goc2VyaWFsaXplZFZpZXcpO1xuICAgICAgdGhpcy5pbmRleEJ5Q29udGVudC5zZXQodmlld0FzU3RyaW5nLCBpbmRleCk7XG4gICAgICByZXR1cm4gaW5kZXg7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmluZGV4QnlDb250ZW50LmdldCh2aWV3QXNTdHJpbmcpITtcbiAgfVxuXG4gIGdldEFsbCgpOiBTZXJpYWxpemVkVmlld1tdIHtcbiAgICByZXR1cm4gdGhpcy52aWV3cztcbiAgfVxufVxuXG4vKipcbiAqIEdsb2JhbCBjb3VudGVyIHRoYXQgaXMgdXNlZCB0byBnZW5lcmF0ZSBhIHVuaXF1ZSBpZCBmb3IgVFZpZXdzXG4gKiBkdXJpbmcgdGhlIHNlcmlhbGl6YXRpb24gcHJvY2Vzcy5cbiAqL1xubGV0IHRWaWV3U3NySWQgPSAwO1xuXG4vKipcbiAqIEdlbmVyYXRlcyBhIHVuaXF1ZSBpZCBmb3IgYSBnaXZlbiBUVmlldyBhbmQgcmV0dXJucyB0aGlzIGlkLlxuICogVGhlIGlkIGlzIGFsc28gc3RvcmVkIG9uIHRoaXMgaW5zdGFuY2Ugb2YgYSBUVmlldyBhbmQgcmV1c2VkIGluXG4gKiBzdWJzZXF1ZW50IGNhbGxzLlxuICpcbiAqIFRoaXMgaWQgaXMgbmVlZGVkIHRvIHVuaXF1ZWx5IGlkZW50aWZ5IGFuZCBwaWNrIHVwIGRlaHlkcmF0ZWQgdmlld3NcbiAqIGF0IHJ1bnRpbWUuXG4gKi9cbmZ1bmN0aW9uIGdldFNzcklkKHRWaWV3OiBUVmlldyk6IHN0cmluZyB7XG4gIGlmICghdFZpZXcuc3NySWQpIHtcbiAgICB0Vmlldy5zc3JJZCA9IGB0JHt0Vmlld1NzcklkKyt9YDtcbiAgfVxuICByZXR1cm4gdFZpZXcuc3NySWQ7XG59XG5cbi8qKlxuICogRGVzY3JpYmVzIGEgY29udGV4dCBhdmFpbGFibGUgZHVyaW5nIHRoZSBzZXJpYWxpemF0aW9uXG4gKiBwcm9jZXNzLiBUaGUgY29udGV4dCBpcyB1c2VkIHRvIHNoYXJlIGFuZCBjb2xsZWN0IGluZm9ybWF0aW9uXG4gKiBkdXJpbmcgdGhlIHNlcmlhbGl6YXRpb24uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSHlkcmF0aW9uQ29udGV4dCB7XG4gIHNlcmlhbGl6ZWRWaWV3Q29sbGVjdGlvbjogU2VyaWFsaXplZFZpZXdDb2xsZWN0aW9uO1xuICBjb3JydXB0ZWRUZXh0Tm9kZXM6IE1hcDxIVE1MRWxlbWVudCwgVGV4dE5vZGVNYXJrZXI+O1xuICBpc0kxOG5IeWRyYXRpb25FbmFibGVkOiBib29sZWFuO1xuICBpMThuQ2hpbGRyZW46IE1hcDxUVmlldywgU2V0PG51bWJlcj4gfCBudWxsPjtcbiAgZXZlbnRUeXBlc1RvUmVwbGF5OiB7cmVndWxhcjogU2V0PHN0cmluZz47IGNhcHR1cmU6IFNldDxzdHJpbmc+fTtcbiAgc2hvdWxkUmVwbGF5RXZlbnRzOiBib29sZWFuO1xufVxuXG4vKipcbiAqIENvbXB1dGVzIHRoZSBudW1iZXIgb2Ygcm9vdCBub2RlcyBpbiBhIGdpdmVuIHZpZXdcbiAqIChvciBjaGlsZCBub2RlcyBpbiBhIGdpdmVuIGNvbnRhaW5lciBpZiBhIHROb2RlIGlzIHByb3ZpZGVkKS5cbiAqL1xuZnVuY3Rpb24gY2FsY051bVJvb3ROb2Rlcyh0VmlldzogVFZpZXcsIGxWaWV3OiBMVmlldywgdE5vZGU6IFROb2RlIHwgbnVsbCk6IG51bWJlciB7XG4gIGNvbnN0IHJvb3ROb2RlczogdW5rbm93bltdID0gW107XG4gIGNvbGxlY3ROYXRpdmVOb2Rlcyh0VmlldywgbFZpZXcsIHROb2RlLCByb290Tm9kZXMpO1xuICByZXR1cm4gcm9vdE5vZGVzLmxlbmd0aDtcbn1cblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgbnVtYmVyIG9mIHJvb3Qgbm9kZXMgaW4gYWxsIHZpZXdzIGluIGEgZ2l2ZW4gTENvbnRhaW5lci5cbiAqL1xuZnVuY3Rpb24gY2FsY051bVJvb3ROb2Rlc0luTENvbnRhaW5lcihsQ29udGFpbmVyOiBMQ29udGFpbmVyKTogbnVtYmVyIHtcbiAgY29uc3Qgcm9vdE5vZGVzOiB1bmtub3duW10gPSBbXTtcbiAgY29sbGVjdE5hdGl2ZU5vZGVzSW5MQ29udGFpbmVyKGxDb250YWluZXIsIHJvb3ROb2Rlcyk7XG4gIHJldHVybiByb290Tm9kZXMubGVuZ3RoO1xufVxuXG4vKipcbiAqIEFubm90YXRlcyByb290IGxldmVsIGNvbXBvbmVudCdzIExWaWV3IGZvciBoeWRyYXRpb24sXG4gKiBzZWUgYGFubm90YXRlSG9zdEVsZW1lbnRGb3JIeWRyYXRpb25gIGZvciBhZGRpdGlvbmFsIGluZm9ybWF0aW9uLlxuICovXG5mdW5jdGlvbiBhbm5vdGF0ZUNvbXBvbmVudExWaWV3Rm9ySHlkcmF0aW9uKFxuICBsVmlldzogTFZpZXcsXG4gIGNvbnRleHQ6IEh5ZHJhdGlvbkNvbnRleHQsXG4pOiBudW1iZXIgfCBudWxsIHtcbiAgY29uc3QgaG9zdEVsZW1lbnQgPSBsVmlld1tIT1NUXTtcbiAgLy8gUm9vdCBlbGVtZW50cyBtaWdodCBhbHNvIGJlIGFubm90YXRlZCB3aXRoIHRoZSBgbmdTa2lwSHlkcmF0aW9uYCBhdHRyaWJ1dGUsXG4gIC8vIGNoZWNrIGlmIGl0J3MgcHJlc2VudCBiZWZvcmUgc3RhcnRpbmcgdGhlIHNlcmlhbGl6YXRpb24gcHJvY2Vzcy5cbiAgaWYgKGhvc3RFbGVtZW50ICYmICEoaG9zdEVsZW1lbnQgYXMgSFRNTEVsZW1lbnQpLmhhc0F0dHJpYnV0ZShTS0lQX0hZRFJBVElPTl9BVFRSX05BTUUpKSB7XG4gICAgcmV0dXJuIGFubm90YXRlSG9zdEVsZW1lbnRGb3JIeWRyYXRpb24oaG9zdEVsZW1lbnQgYXMgSFRNTEVsZW1lbnQsIGxWaWV3LCBjb250ZXh0KTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBBbm5vdGF0ZXMgcm9vdCBsZXZlbCBMQ29udGFpbmVyIGZvciBoeWRyYXRpb24uIFRoaXMgaGFwcGVucyB3aGVuIGEgcm9vdCBjb21wb25lbnRcbiAqIGluamVjdHMgVmlld0NvbnRhaW5lclJlZiwgdGh1cyBtYWtpbmcgdGhlIGNvbXBvbmVudCBhbiBhbmNob3IgZm9yIGEgdmlldyBjb250YWluZXIuXG4gKiBUaGlzIGZ1bmN0aW9uIHNlcmlhbGl6ZXMgdGhlIGNvbXBvbmVudCBpdHNlbGYgYXMgd2VsbCBhcyBhbGwgdmlld3MgZnJvbSB0aGUgdmlld1xuICogY29udGFpbmVyLlxuICovXG5mdW5jdGlvbiBhbm5vdGF0ZUxDb250YWluZXJGb3JIeWRyYXRpb24obENvbnRhaW5lcjogTENvbnRhaW5lciwgY29udGV4dDogSHlkcmF0aW9uQ29udGV4dCkge1xuICBjb25zdCBjb21wb25lbnRMVmlldyA9IHVud3JhcExWaWV3KGxDb250YWluZXJbSE9TVF0pIGFzIExWaWV3PHVua25vd24+O1xuXG4gIC8vIFNlcmlhbGl6ZSB0aGUgcm9vdCBjb21wb25lbnQgaXRzZWxmLlxuICBjb25zdCBjb21wb25lbnRMVmlld05naEluZGV4ID0gYW5ub3RhdGVDb21wb25lbnRMVmlld0Zvckh5ZHJhdGlvbihjb21wb25lbnRMVmlldywgY29udGV4dCk7XG5cbiAgaWYgKGNvbXBvbmVudExWaWV3TmdoSW5kZXggPT09IG51bGwpIHtcbiAgICAvLyBDb21wb25lbnQgd2FzIG5vdCBzZXJpYWxpemVkIChmb3IgZXhhbXBsZSwgaWYgaHlkcmF0aW9uIHdhcyBza2lwcGVkIGJ5IGFkZGluZ1xuICAgIC8vIHRoZSBgbmdTa2lwSHlkcmF0aW9uYCBhdHRyaWJ1dGUgb3IgdGhpcyBjb21wb25lbnQgdXNlcyBpMThuIGJsb2NrcyBpbiB0aGUgdGVtcGxhdGUsXG4gICAgLy8gYnV0IGB3aXRoSTE4blN1cHBvcnQoKWAgd2FzIG5vdCBhZGRlZCksIGF2b2lkIGFubm90YXRpbmcgaG9zdCBlbGVtZW50IHdpdGggdGhlIGBuZ2hgXG4gICAgLy8gYXR0cmlidXRlLlxuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGhvc3RFbGVtZW50ID0gdW53cmFwUk5vZGUoY29tcG9uZW50TFZpZXdbSE9TVF0hKSBhcyBIVE1MRWxlbWVudDtcblxuICAvLyBTZXJpYWxpemUgYWxsIHZpZXdzIHdpdGhpbiB0aGlzIHZpZXcgY29udGFpbmVyLlxuICBjb25zdCByb290TFZpZXcgPSBsQ29udGFpbmVyW1BBUkVOVF07XG4gIGNvbnN0IHJvb3RMVmlld05naEluZGV4ID0gYW5ub3RhdGVIb3N0RWxlbWVudEZvckh5ZHJhdGlvbihob3N0RWxlbWVudCwgcm9vdExWaWV3LCBjb250ZXh0KTtcblxuICBjb25zdCByZW5kZXJlciA9IGNvbXBvbmVudExWaWV3W1JFTkRFUkVSXSBhcyBSZW5kZXJlcjI7XG5cbiAgLy8gRm9yIGNhc2VzIHdoZW4gYSByb290IGNvbXBvbmVudCBhbHNvIGFjdHMgYXMgYW4gYW5jaG9yIG5vZGUgZm9yIGEgVmlld0NvbnRhaW5lclJlZlxuICAvLyAoZm9yIGV4YW1wbGUsIHdoZW4gVmlld0NvbnRhaW5lclJlZiBpcyBpbmplY3RlZCBpbiBhIHJvb3QgY29tcG9uZW50KSwgdGhlcmUgaXMgYSBuZWVkXG4gIC8vIHRvIHNlcmlhbGl6ZSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgY29tcG9uZW50IGl0c2VsZiwgYXMgd2VsbCBhcyBhbiBMQ29udGFpbmVyIHRoYXRcbiAgLy8gcmVwcmVzZW50cyB0aGlzIFZpZXdDb250YWluZXJSZWYuIEVmZmVjdGl2ZWx5LCB3ZSBuZWVkIHRvIHNlcmlhbGl6ZSAyIHBpZWNlcyBvZiBpbmZvOlxuICAvLyAoMSkgaHlkcmF0aW9uIGluZm8gZm9yIHRoZSByb290IGNvbXBvbmVudCBpdHNlbGYgYW5kICgyKSBoeWRyYXRpb24gaW5mbyBmb3IgdGhlXG4gIC8vIFZpZXdDb250YWluZXJSZWYgaW5zdGFuY2UgKGFuIExDb250YWluZXIpLiBFYWNoIHBpZWNlIG9mIGluZm9ybWF0aW9uIGlzIGluY2x1ZGVkIGludG9cbiAgLy8gdGhlIGh5ZHJhdGlvbiBkYXRhIChpbiB0aGUgVHJhbnNmZXJTdGF0ZSBvYmplY3QpIHNlcGFyYXRlbHksIHRodXMgd2UgZW5kIHVwIHdpdGggMiBpZHMuXG4gIC8vIFNpbmNlIHdlIG9ubHkgaGF2ZSAxIHJvb3QgZWxlbWVudCwgd2UgZW5jb2RlIGJvdGggYml0cyBvZiBpbmZvIGludG8gYSBzaW5nbGUgc3RyaW5nOlxuICAvLyBpZHMgYXJlIHNlcGFyYXRlZCBieSB0aGUgYHxgIGNoYXIgKGUuZy4gYDEwfDI1YCwgd2hlcmUgYDEwYCBpcyB0aGUgbmdoIGZvciBhIGNvbXBvbmVudCB2aWV3XG4gIC8vIGFuZCAyNSBpcyB0aGUgYG5naGAgZm9yIGEgcm9vdCB2aWV3IHdoaWNoIGhvbGRzIExDb250YWluZXIpLlxuICBjb25zdCBmaW5hbEluZGV4ID0gYCR7Y29tcG9uZW50TFZpZXdOZ2hJbmRleH18JHtyb290TFZpZXdOZ2hJbmRleH1gO1xuICByZW5kZXJlci5zZXRBdHRyaWJ1dGUoaG9zdEVsZW1lbnQsIE5HSF9BVFRSX05BTUUsIGZpbmFsSW5kZXgpO1xufVxuXG4vKipcbiAqIEFubm90YXRlcyBhbGwgY29tcG9uZW50cyBib290c3RyYXBwZWQgaW4gYSBnaXZlbiBBcHBsaWNhdGlvblJlZlxuICogd2l0aCBpbmZvIG5lZWRlZCBmb3IgaHlkcmF0aW9uLlxuICpcbiAqIEBwYXJhbSBhcHBSZWYgQW4gaW5zdGFuY2Ugb2YgYW4gQXBwbGljYXRpb25SZWYuXG4gKiBAcGFyYW0gZG9jIEEgcmVmZXJlbmNlIHRvIHRoZSBjdXJyZW50IERvY3VtZW50IGluc3RhbmNlLlxuICogQHJldHVybiBldmVudCB0eXBlcyB0aGF0IG5lZWQgdG8gYmUgcmVwbGF5ZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFubm90YXRlRm9ySHlkcmF0aW9uKGFwcFJlZjogQXBwbGljYXRpb25SZWYsIGRvYzogRG9jdW1lbnQpIHtcbiAgY29uc3QgaW5qZWN0b3IgPSBhcHBSZWYuaW5qZWN0b3I7XG4gIGNvbnN0IGlzSTE4bkh5ZHJhdGlvbkVuYWJsZWRWYWwgPSBpc0kxOG5IeWRyYXRpb25FbmFibGVkKGluamVjdG9yKTtcbiAgY29uc3Qgc2VyaWFsaXplZFZpZXdDb2xsZWN0aW9uID0gbmV3IFNlcmlhbGl6ZWRWaWV3Q29sbGVjdGlvbigpO1xuICBjb25zdCBjb3JydXB0ZWRUZXh0Tm9kZXMgPSBuZXcgTWFwPEhUTUxFbGVtZW50LCBUZXh0Tm9kZU1hcmtlcj4oKTtcbiAgY29uc3Qgdmlld1JlZnMgPSBhcHBSZWYuX3ZpZXdzO1xuICBjb25zdCBzaG91bGRSZXBsYXlFdmVudHMgPSBpbmplY3Rvci5nZXQoSVNfRVZFTlRfUkVQTEFZX0VOQUJMRUQsIEVWRU5UX1JFUExBWV9FTkFCTEVEX0RFRkFVTFQpO1xuICBjb25zdCBldmVudFR5cGVzVG9SZXBsYXkgPSB7XG4gICAgcmVndWxhcjogbmV3IFNldDxzdHJpbmc+KCksXG4gICAgY2FwdHVyZTogbmV3IFNldDxzdHJpbmc+KCksXG4gIH07XG4gIGZvciAoY29uc3Qgdmlld1JlZiBvZiB2aWV3UmVmcykge1xuICAgIGNvbnN0IGxOb2RlID0gZ2V0TE5vZGVGb3JIeWRyYXRpb24odmlld1JlZik7XG5cbiAgICAvLyBBbiBgbFZpZXdgIG1pZ2h0IGJlIGBudWxsYCBpZiBhIGBWaWV3UmVmYCByZXByZXNlbnRzXG4gICAgLy8gYW4gZW1iZWRkZWQgdmlldyAobm90IGEgY29tcG9uZW50IHZpZXcpLlxuICAgIGlmIChsTm9kZSAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgY29udGV4dDogSHlkcmF0aW9uQ29udGV4dCA9IHtcbiAgICAgICAgc2VyaWFsaXplZFZpZXdDb2xsZWN0aW9uLFxuICAgICAgICBjb3JydXB0ZWRUZXh0Tm9kZXMsXG4gICAgICAgIGlzSTE4bkh5ZHJhdGlvbkVuYWJsZWQ6IGlzSTE4bkh5ZHJhdGlvbkVuYWJsZWRWYWwsXG4gICAgICAgIGkxOG5DaGlsZHJlbjogbmV3IE1hcCgpLFxuICAgICAgICBldmVudFR5cGVzVG9SZXBsYXksXG4gICAgICAgIHNob3VsZFJlcGxheUV2ZW50cyxcbiAgICAgIH07XG4gICAgICBpZiAoaXNMQ29udGFpbmVyKGxOb2RlKSkge1xuICAgICAgICBhbm5vdGF0ZUxDb250YWluZXJGb3JIeWRyYXRpb24obE5vZGUsIGNvbnRleHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYW5ub3RhdGVDb21wb25lbnRMVmlld0Zvckh5ZHJhdGlvbihsTm9kZSwgY29udGV4dCk7XG4gICAgICB9XG4gICAgICBpbnNlcnRDb3JydXB0ZWRUZXh0Tm9kZU1hcmtlcnMoY29ycnVwdGVkVGV4dE5vZGVzLCBkb2MpO1xuICAgIH1cbiAgfVxuXG4gIC8vIE5vdGU6IHdlICphbHdheXMqIGluY2x1ZGUgaHlkcmF0aW9uIGluZm8ga2V5IGFuZCBhIGNvcnJlc3BvbmRpbmcgdmFsdWVcbiAgLy8gaW50byB0aGUgVHJhbnNmZXJTdGF0ZSwgZXZlbiBpZiB0aGUgbGlzdCBvZiBzZXJpYWxpemVkIHZpZXdzIGlzIGVtcHR5LlxuICAvLyBUaGlzIGlzIG5lZWRlZCBhcyBhIHNpZ25hbCB0byB0aGUgY2xpZW50IHRoYXQgdGhlIHNlcnZlciBwYXJ0IG9mIHRoZVxuICAvLyBoeWRyYXRpb24gbG9naWMgd2FzIHNldHVwIGFuZCBlbmFibGVkIGNvcnJlY3RseS4gT3RoZXJ3aXNlLCBpZiBhIGNsaWVudFxuICAvLyBoeWRyYXRpb24gZG9lc24ndCBmaW5kIGEga2V5IGluIHRoZSB0cmFuc2ZlciBzdGF0ZSAtIGFuIGVycm9yIGlzIHByb2R1Y2VkLlxuICBjb25zdCBzZXJpYWxpemVkVmlld3MgPSBzZXJpYWxpemVkVmlld0NvbGxlY3Rpb24uZ2V0QWxsKCk7XG4gIGNvbnN0IHRyYW5zZmVyU3RhdGUgPSBpbmplY3Rvci5nZXQoVHJhbnNmZXJTdGF0ZSk7XG4gIHRyYW5zZmVyU3RhdGUuc2V0KE5HSF9EQVRBX0tFWSwgc2VyaWFsaXplZFZpZXdzKTtcbiAgcmV0dXJuIGV2ZW50VHlwZXNUb1JlcGxheTtcbn1cblxuLyoqXG4gKiBTZXJpYWxpemVzIHRoZSBsQ29udGFpbmVyIGRhdGEgaW50byBhIGxpc3Qgb2YgU2VyaWFsaXplZFZpZXcgb2JqZWN0cyxcbiAqIHRoYXQgcmVwcmVzZW50IHZpZXdzIHdpdGhpbiB0aGlzIGxDb250YWluZXIuXG4gKlxuICogQHBhcmFtIGxDb250YWluZXIgdGhlIGxDb250YWluZXIgd2UgYXJlIHNlcmlhbGl6aW5nXG4gKiBAcGFyYW0gY29udGV4dCB0aGUgaHlkcmF0aW9uIGNvbnRleHRcbiAqIEByZXR1cm5zIGFuIGFycmF5IG9mIHRoZSBgU2VyaWFsaXplZFZpZXdgIG9iamVjdHNcbiAqL1xuZnVuY3Rpb24gc2VyaWFsaXplTENvbnRhaW5lcihcbiAgbENvbnRhaW5lcjogTENvbnRhaW5lcixcbiAgY29udGV4dDogSHlkcmF0aW9uQ29udGV4dCxcbik6IFNlcmlhbGl6ZWRDb250YWluZXJWaWV3W10ge1xuICBjb25zdCB2aWV3czogU2VyaWFsaXplZENvbnRhaW5lclZpZXdbXSA9IFtdO1xuICBsZXQgbGFzdFZpZXdBc1N0cmluZyA9ICcnO1xuXG4gIGZvciAobGV0IGkgPSBDT05UQUlORVJfSEVBREVSX09GRlNFVDsgaSA8IGxDb250YWluZXIubGVuZ3RoOyBpKyspIHtcbiAgICBsZXQgY2hpbGRMVmlldyA9IGxDb250YWluZXJbaV0gYXMgTFZpZXc7XG5cbiAgICBsZXQgdGVtcGxhdGU6IHN0cmluZztcbiAgICBsZXQgbnVtUm9vdE5vZGVzOiBudW1iZXI7XG4gICAgbGV0IHNlcmlhbGl6ZWRWaWV3OiBTZXJpYWxpemVkQ29udGFpbmVyVmlldyB8IHVuZGVmaW5lZDtcblxuICAgIGlmIChpc1Jvb3RWaWV3KGNoaWxkTFZpZXcpKSB7XG4gICAgICAvLyBJZiB0aGlzIGlzIGEgcm9vdCB2aWV3LCBnZXQgYW4gTFZpZXcgZm9yIHRoZSB1bmRlcmx5aW5nIGNvbXBvbmVudCxcbiAgICAgIC8vIGJlY2F1c2UgaXQgY29udGFpbnMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIHZpZXcgdG8gc2VyaWFsaXplLlxuICAgICAgY2hpbGRMVmlldyA9IGNoaWxkTFZpZXdbSEVBREVSX09GRlNFVF07XG5cbiAgICAgIC8vIElmIHdlIGhhdmUgYW4gTENvbnRhaW5lciBhdCB0aGlzIHBvc2l0aW9uLCB0aGlzIGluZGljYXRlcyB0aGF0IHRoZVxuICAgICAgLy8gaG9zdCBlbGVtZW50IHdhcyB1c2VkIGFzIGEgVmlld0NvbnRhaW5lclJlZiBhbmNob3IgKGUuZy4gYSBgVmlld0NvbnRhaW5lclJlZmBcbiAgICAgIC8vIHdhcyBpbmplY3RlZCB3aXRoaW4gdGhlIGNvbXBvbmVudCBjbGFzcykuIFRoaXMgY2FzZSByZXF1aXJlcyBzcGVjaWFsIGhhbmRsaW5nLlxuICAgICAgaWYgKGlzTENvbnRhaW5lcihjaGlsZExWaWV3KSkge1xuICAgICAgICAvLyBDYWxjdWxhdGUgdGhlIG51bWJlciBvZiByb290IG5vZGVzIGluIGFsbCB2aWV3cyBpbiBhIGdpdmVuIGNvbnRhaW5lclxuICAgICAgICAvLyBhbmQgaW5jcmVtZW50IGJ5IG9uZSB0byBhY2NvdW50IGZvciBhbiBhbmNob3Igbm9kZSBpdHNlbGYsIGkuZS4gaW4gdGhpc1xuICAgICAgICAvLyBzY2VuYXJpbyB3ZSdsbCBoYXZlIGEgbGF5b3V0IHRoYXQgd291bGQgbG9vayBsaWtlIHRoaXM6XG4gICAgICAgIC8vIGA8YXBwLXJvb3QgLz48I1ZJRVcxPjwjVklFVzI+Li4uPCEtLWNvbnRhaW5lci0tPmBcbiAgICAgICAgLy8gVGhlIGArMWAgaXMgdG8gY2FwdHVyZSB0aGUgYDxhcHAtcm9vdCAvPmAgZWxlbWVudC5cbiAgICAgICAgbnVtUm9vdE5vZGVzID0gY2FsY051bVJvb3ROb2Rlc0luTENvbnRhaW5lcihjaGlsZExWaWV3KSArIDE7XG5cbiAgICAgICAgYW5ub3RhdGVMQ29udGFpbmVyRm9ySHlkcmF0aW9uKGNoaWxkTFZpZXcsIGNvbnRleHQpO1xuXG4gICAgICAgIGNvbnN0IGNvbXBvbmVudExWaWV3ID0gdW53cmFwTFZpZXcoY2hpbGRMVmlld1tIT1NUXSkgYXMgTFZpZXc8dW5rbm93bj47XG5cbiAgICAgICAgc2VyaWFsaXplZFZpZXcgPSB7XG4gICAgICAgICAgW1RFTVBMQVRFX0lEXTogY29tcG9uZW50TFZpZXdbVFZJRVddLnNzcklkISxcbiAgICAgICAgICBbTlVNX1JPT1RfTk9ERVNdOiBudW1Sb290Tm9kZXMsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFzZXJpYWxpemVkVmlldykge1xuICAgICAgY29uc3QgY2hpbGRUVmlldyA9IGNoaWxkTFZpZXdbVFZJRVddO1xuXG4gICAgICBpZiAoY2hpbGRUVmlldy50eXBlID09PSBUVmlld1R5cGUuQ29tcG9uZW50KSB7XG4gICAgICAgIHRlbXBsYXRlID0gY2hpbGRUVmlldy5zc3JJZCE7XG5cbiAgICAgICAgLy8gVGhpcyBpcyBhIGNvbXBvbmVudCB2aWV3LCB0aHVzIGl0IGhhcyBvbmx5IDEgcm9vdCBub2RlOiB0aGUgY29tcG9uZW50XG4gICAgICAgIC8vIGhvc3Qgbm9kZSBpdHNlbGYgKG90aGVyIG5vZGVzIHdvdWxkIGJlIGluc2lkZSB0aGF0IGhvc3Qgbm9kZSkuXG4gICAgICAgIG51bVJvb3ROb2RlcyA9IDE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZW1wbGF0ZSA9IGdldFNzcklkKGNoaWxkVFZpZXcpO1xuICAgICAgICBudW1Sb290Tm9kZXMgPSBjYWxjTnVtUm9vdE5vZGVzKGNoaWxkVFZpZXcsIGNoaWxkTFZpZXcsIGNoaWxkVFZpZXcuZmlyc3RDaGlsZCk7XG4gICAgICB9XG5cbiAgICAgIHNlcmlhbGl6ZWRWaWV3ID0ge1xuICAgICAgICBbVEVNUExBVEVfSURdOiB0ZW1wbGF0ZSxcbiAgICAgICAgW05VTV9ST09UX05PREVTXTogbnVtUm9vdE5vZGVzLFxuICAgICAgICAuLi5zZXJpYWxpemVMVmlldyhsQ29udGFpbmVyW2ldIGFzIExWaWV3LCBjb250ZXh0KSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgaWYgdGhlIHByZXZpb3VzIHZpZXcgaGFzIHRoZSBzYW1lIHNoYXBlIChmb3IgZXhhbXBsZSwgaXQgd2FzXG4gICAgLy8gcHJvZHVjZWQgYnkgdGhlICpuZ0ZvciksIGluIHdoaWNoIGNhc2UgYnVtcCB0aGUgY291bnRlciBvbiB0aGUgcHJldmlvdXNcbiAgICAvLyB2aWV3IGluc3RlYWQgb2YgaW5jbHVkaW5nIHRoZSBzYW1lIGluZm9ybWF0aW9uIGFnYWluLlxuICAgIGNvbnN0IGN1cnJlbnRWaWV3QXNTdHJpbmcgPSBKU09OLnN0cmluZ2lmeShzZXJpYWxpemVkVmlldyk7XG4gICAgaWYgKHZpZXdzLmxlbmd0aCA+IDAgJiYgY3VycmVudFZpZXdBc1N0cmluZyA9PT0gbGFzdFZpZXdBc1N0cmluZykge1xuICAgICAgY29uc3QgcHJldmlvdXNWaWV3ID0gdmlld3Nbdmlld3MubGVuZ3RoIC0gMV07XG4gICAgICBwcmV2aW91c1ZpZXdbTVVMVElQTElFUl0gPz89IDE7XG4gICAgICBwcmV2aW91c1ZpZXdbTVVMVElQTElFUl0rKztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gUmVjb3JkIHRoaXMgdmlldyBhcyBtb3N0IHJlY2VudGx5IGFkZGVkLlxuICAgICAgbGFzdFZpZXdBc1N0cmluZyA9IGN1cnJlbnRWaWV3QXNTdHJpbmc7XG4gICAgICB2aWV3cy5wdXNoKHNlcmlhbGl6ZWRWaWV3KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHZpZXdzO1xufVxuXG4vKipcbiAqIEhlbHBlciBmdW5jdGlvbiB0byBwcm9kdWNlIGEgbm9kZSBwYXRoICh3aGljaCBuYXZpZ2F0aW9uIHN0ZXBzIHJ1bnRpbWUgbG9naWNcbiAqIG5lZWRzIHRvIHRha2UgdG8gbG9jYXRlIGEgbm9kZSkgYW5kIHN0b3JlcyBpdCBpbiB0aGUgYE5PREVTYCBzZWN0aW9uIG9mIHRoZVxuICogY3VycmVudCBzZXJpYWxpemVkIHZpZXcuXG4gKi9cbmZ1bmN0aW9uIGFwcGVuZFNlcmlhbGl6ZWROb2RlUGF0aChcbiAgbmdoOiBTZXJpYWxpemVkVmlldyxcbiAgdE5vZGU6IFROb2RlLFxuICBsVmlldzogTFZpZXcsXG4gIGV4Y2x1ZGVkUGFyZW50Tm9kZXM6IFNldDxudW1iZXI+IHwgbnVsbCxcbikge1xuICBjb25zdCBub09mZnNldEluZGV4ID0gdE5vZGUuaW5kZXggLSBIRUFERVJfT0ZGU0VUO1xuICBuZ2hbTk9ERVNdID8/PSB7fTtcbiAgLy8gRW5zdXJlIHdlIGRvbid0IGNhbGN1bGF0ZSB0aGUgcGF0aCBtdWx0aXBsZSB0aW1lcy5cbiAgbmdoW05PREVTXVtub09mZnNldEluZGV4XSA/Pz0gY2FsY1BhdGhGb3JOb2RlKHROb2RlLCBsVmlldywgZXhjbHVkZWRQYXJlbnROb2Rlcyk7XG59XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHRvIGFwcGVuZCBpbmZvcm1hdGlvbiBhYm91dCBhIGRpc2Nvbm5lY3RlZCBub2RlLlxuICogVGhpcyBpbmZvIGlzIG5lZWRlZCBhdCBydW50aW1lIHRvIGF2b2lkIERPTSBsb29rdXBzIGZvciB0aGlzIGVsZW1lbnRcbiAqIGFuZCBpbnN0ZWFkLCB0aGUgZWxlbWVudCB3b3VsZCBiZSBjcmVhdGVkIGZyb20gc2NyYXRjaC5cbiAqL1xuZnVuY3Rpb24gYXBwZW5kRGlzY29ubmVjdGVkTm9kZUluZGV4KG5naDogU2VyaWFsaXplZFZpZXcsIHROb2RlT3JOb09mZnNldEluZGV4OiBUTm9kZSB8IG51bWJlcikge1xuICBjb25zdCBub09mZnNldEluZGV4ID1cbiAgICB0eXBlb2YgdE5vZGVPck5vT2Zmc2V0SW5kZXggPT09ICdudW1iZXInXG4gICAgICA/IHROb2RlT3JOb09mZnNldEluZGV4XG4gICAgICA6IHROb2RlT3JOb09mZnNldEluZGV4LmluZGV4IC0gSEVBREVSX09GRlNFVDtcbiAgbmdoW0RJU0NPTk5FQ1RFRF9OT0RFU10gPz89IFtdO1xuICBpZiAoIW5naFtESVNDT05ORUNURURfTk9ERVNdLmluY2x1ZGVzKG5vT2Zmc2V0SW5kZXgpKSB7XG4gICAgbmdoW0RJU0NPTk5FQ1RFRF9OT0RFU10ucHVzaChub09mZnNldEluZGV4KTtcbiAgfVxufVxuXG4vKipcbiAqIFNlcmlhbGl6ZXMgdGhlIGxWaWV3IGRhdGEgaW50byBhIFNlcmlhbGl6ZWRWaWV3IG9iamVjdCB0aGF0IHdpbGwgbGF0ZXIgYmUgYWRkZWRcbiAqIHRvIHRoZSBUcmFuc2ZlclN0YXRlIHN0b3JhZ2UgYW5kIHJlZmVyZW5jZWQgdXNpbmcgdGhlIGBuZ2hgIGF0dHJpYnV0ZSBvbiBhIGhvc3RcbiAqIGVsZW1lbnQuXG4gKlxuICogQHBhcmFtIGxWaWV3IHRoZSBsVmlldyB3ZSBhcmUgc2VyaWFsaXppbmdcbiAqIEBwYXJhbSBjb250ZXh0IHRoZSBoeWRyYXRpb24gY29udGV4dFxuICogQHJldHVybnMgdGhlIGBTZXJpYWxpemVkVmlld2Agb2JqZWN0IGNvbnRhaW5pbmcgdGhlIGRhdGEgdG8gYmUgYWRkZWQgdG8gdGhlIGhvc3Qgbm9kZVxuICovXG5mdW5jdGlvbiBzZXJpYWxpemVMVmlldyhsVmlldzogTFZpZXcsIGNvbnRleHQ6IEh5ZHJhdGlvbkNvbnRleHQpOiBTZXJpYWxpemVkVmlldyB7XG4gIGNvbnN0IG5naDogU2VyaWFsaXplZFZpZXcgPSB7fTtcbiAgY29uc3QgdFZpZXcgPSBsVmlld1tUVklFV107XG4gIGNvbnN0IGkxOG5DaGlsZHJlbiA9IGdldE9yQ29tcHV0ZUkxOG5DaGlsZHJlbih0VmlldywgY29udGV4dCk7XG4gIGNvbnN0IG5hdGl2ZUVsZW1lbnRzVG9FdmVudFR5cGVzID0gY29udGV4dC5zaG91bGRSZXBsYXlFdmVudHNcbiAgICA/IGNvbGxlY3REb21FdmVudHNJbmZvKHRWaWV3LCBsVmlldywgY29udGV4dC5ldmVudFR5cGVzVG9SZXBsYXkpXG4gICAgOiBudWxsO1xuICAvLyBJdGVyYXRlIG92ZXIgRE9NIGVsZW1lbnQgcmVmZXJlbmNlcyBpbiBhbiBMVmlldy5cbiAgZm9yIChsZXQgaSA9IEhFQURFUl9PRkZTRVQ7IGkgPCB0Vmlldy5iaW5kaW5nU3RhcnRJbmRleDsgaSsrKSB7XG4gICAgY29uc3QgdE5vZGUgPSB0Vmlldy5kYXRhW2ldIGFzIFROb2RlO1xuICAgIGNvbnN0IG5vT2Zmc2V0SW5kZXggPSBpIC0gSEVBREVSX09GRlNFVDtcblxuICAgIC8vIEF0dGVtcHQgdG8gc2VyaWFsaXplIGFueSBpMThuIGRhdGEgZm9yIHRoZSBnaXZlbiBzbG90LiBXZSBkbyB0aGlzIGZpcnN0LCBhcyBpMThuXG4gICAgLy8gaGFzIGl0cyBvd24gcHJvY2VzcyBmb3Igc2VyaWFsaXphdGlvbi5cbiAgICBjb25zdCBpMThuRGF0YSA9IHRyeVNlcmlhbGl6ZUkxOG5CbG9jayhsVmlldywgaSwgY29udGV4dCk7XG4gICAgaWYgKGkxOG5EYXRhKSB7XG4gICAgICBuZ2hbSTE4Tl9EQVRBXSA/Pz0ge307XG4gICAgICBuZ2hbSTE4Tl9EQVRBXVtub09mZnNldEluZGV4XSA9IGkxOG5EYXRhLmNhc2VRdWV1ZTtcblxuICAgICAgZm9yIChjb25zdCBub2RlTm9PZmZzZXRJbmRleCBvZiBpMThuRGF0YS5kaXNjb25uZWN0ZWROb2Rlcykge1xuICAgICAgICBhcHBlbmREaXNjb25uZWN0ZWROb2RlSW5kZXgobmdoLCBub2RlTm9PZmZzZXRJbmRleCk7XG4gICAgICB9XG5cbiAgICAgIGZvciAoY29uc3Qgbm9kZU5vT2Zmc2V0SW5kZXggb2YgaTE4bkRhdGEuZGlzam9pbnROb2Rlcykge1xuICAgICAgICBjb25zdCB0Tm9kZSA9IHRWaWV3LmRhdGFbbm9kZU5vT2Zmc2V0SW5kZXggKyBIRUFERVJfT0ZGU0VUXSBhcyBUTm9kZTtcbiAgICAgICAgbmdEZXZNb2RlICYmIGFzc2VydFROb2RlKHROb2RlKTtcbiAgICAgICAgYXBwZW5kU2VyaWFsaXplZE5vZGVQYXRoKG5naCwgdE5vZGUsIGxWaWV3LCBpMThuQ2hpbGRyZW4pO1xuICAgICAgfVxuXG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBTa2lwIHByb2Nlc3Npbmcgb2YgYSBnaXZlbiBzbG90IGluIHRoZSBmb2xsb3dpbmcgY2FzZXM6XG4gICAgLy8gLSBMb2NhbCByZWZzIChlLmcuIDxkaXYgI2xvY2FsUmVmPikgdGFrZSB1cCBhbiBleHRyYSBzbG90IGluIExWaWV3c1xuICAgIC8vICAgdG8gc3RvcmUgdGhlIHNhbWUgZWxlbWVudC4gSW4gdGhpcyBjYXNlLCB0aGVyZSBpcyBubyBpbmZvcm1hdGlvbiBpblxuICAgIC8vICAgYSBjb3JyZXNwb25kaW5nIHNsb3QgaW4gVE5vZGUgZGF0YSBzdHJ1Y3R1cmUuXG4gICAgLy8gLSBXaGVuIGEgc2xvdCBjb250YWlucyBzb21ldGhpbmcgb3RoZXIgdGhhbiBhIFROb2RlLiBGb3IgZXhhbXBsZSwgdGhlcmVcbiAgICAvLyAgIG1pZ2h0IGJlIHNvbWUgbWV0YWRhdGEgaW5mb3JtYXRpb24gYWJvdXQgYSBkZWZlciBibG9jayBvciBhIGNvbnRyb2wgZmxvdyBibG9jay5cbiAgICBpZiAoIWlzVE5vZGVTaGFwZSh0Tm9kZSkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFNraXAgYW55IG5vZGVzIHRoYXQgYXJlIGluIGFuIGkxOG4gYmxvY2sgYnV0IGFyZSBjb25zaWRlcmVkIGRldGFjaGVkIChpLmUuIG5vdFxuICAgIC8vIHByZXNlbnQgaW4gdGhlIHRlbXBsYXRlKS4gVGhlc2Ugbm9kZXMgYXJlIGRpc2Nvbm5lY3RlZCBmcm9tIHRoZSBET00gdHJlZSwgYW5kXG4gICAgLy8gc28gd2UgZG9uJ3Qgd2FudCB0byBzZXJpYWxpemUgYW55IGluZm9ybWF0aW9uIGFib3V0IHRoZW0uXG4gICAgaWYgKGlzRGV0YWNoZWRCeUkxOG4odE5vZGUpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBpZiBhIG5hdGl2ZSBub2RlIHRoYXQgcmVwcmVzZW50cyBhIGdpdmVuIFROb2RlIGlzIGRpc2Nvbm5lY3RlZCBmcm9tIHRoZSBET00gdHJlZS5cbiAgICAvLyBTdWNoIG5vZGVzIG11c3QgYmUgZXhjbHVkZWQgZnJvbSB0aGUgaHlkcmF0aW9uIChzaW5jZSB0aGUgaHlkcmF0aW9uIHdvbid0IGJlIGFibGUgdG9cbiAgICAvLyBmaW5kIHRoZW0pLCBzbyB0aGUgVE5vZGUgaWRzIGFyZSBjb2xsZWN0ZWQgYW5kIHVzZWQgYXQgcnVudGltZSB0byBza2lwIHRoZSBoeWRyYXRpb24uXG4gICAgLy9cbiAgICAvLyBUaGlzIHNpdHVhdGlvbiBtYXkgaGFwcGVuIGR1cmluZyB0aGUgY29udGVudCBwcm9qZWN0aW9uLCB3aGVuIHNvbWUgbm9kZXMgZG9uJ3QgbWFrZSBpdFxuICAgIC8vIGludG8gb25lIG9mIHRoZSBjb250ZW50IHByb2plY3Rpb24gc2xvdHMgKGZvciBleGFtcGxlLCB3aGVuIHRoZXJlIGlzIG5vIGRlZmF1bHRcbiAgICAvLyA8bmctY29udGVudCAvPiBzbG90IGluIHByb2plY3RvciBjb21wb25lbnQncyB0ZW1wbGF0ZSkuXG4gICAgaWYgKGlzRGlzY29ubmVjdGVkTm9kZSh0Tm9kZSwgbFZpZXcpICYmIGlzQ29udGVudFByb2plY3RlZE5vZGUodE5vZGUpKSB7XG4gICAgICBhcHBlbmREaXNjb25uZWN0ZWROb2RlSW5kZXgobmdoLCB0Tm9kZSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBBdHRhY2ggYGpzYWN0aW9uYCBhdHRyaWJ1dGUgdG8gZWxlbWVudHMgdGhhdCBoYXZlIHJlZ2lzdGVyZWQgbGlzdGVuZXJzLFxuICAgIC8vIHRodXMgcG90ZW50aWFsbHkgaGF2aW5nIGEgbmVlZCB0byBkbyBhbiBldmVudCByZXBsYXkuXG4gICAgaWYgKG5hdGl2ZUVsZW1lbnRzVG9FdmVudFR5cGVzICYmIHROb2RlLnR5cGUgJiBUTm9kZVR5cGUuRWxlbWVudCkge1xuICAgICAgY29uc3QgbmF0aXZlRWxlbWVudCA9IHVud3JhcFJOb2RlKGxWaWV3W2ldKSBhcyBFbGVtZW50O1xuICAgICAgaWYgKG5hdGl2ZUVsZW1lbnRzVG9FdmVudFR5cGVzLmhhcyhuYXRpdmVFbGVtZW50KSkge1xuICAgICAgICBzZXRKU0FjdGlvbkF0dHJpYnV0ZXMobmF0aXZlRWxlbWVudCwgbmF0aXZlRWxlbWVudHNUb0V2ZW50VHlwZXMuZ2V0KG5hdGl2ZUVsZW1lbnQpISk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodE5vZGUucHJvamVjdGlvbikpIHtcbiAgICAgIGZvciAoY29uc3QgcHJvamVjdGlvbkhlYWRUTm9kZSBvZiB0Tm9kZS5wcm9qZWN0aW9uKSB7XG4gICAgICAgIC8vIFdlIG1heSBoYXZlIGBudWxsYHMgaW4gc2xvdHMgd2l0aCBubyBwcm9qZWN0ZWQgY29udGVudC5cbiAgICAgICAgaWYgKCFwcm9qZWN0aW9uSGVhZFROb2RlKSBjb250aW51ZTtcblxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocHJvamVjdGlvbkhlYWRUTm9kZSkpIHtcbiAgICAgICAgICAvLyBJZiB3ZSBwcm9jZXNzIHJlLXByb2plY3RlZCBjb250ZW50IChpLmUuIGA8bmctY29udGVudD5gXG4gICAgICAgICAgLy8gYXBwZWFycyBhdCBwcm9qZWN0aW9uIGxvY2F0aW9uKSwgc2tpcCBhbm5vdGF0aW9ucyBmb3IgdGhpcyBjb250ZW50XG4gICAgICAgICAgLy8gc2luY2UgYWxsIERPTSBub2RlcyBpbiB0aGlzIHByb2plY3Rpb24gd2VyZSBoYW5kbGVkIHdoaWxlIHByb2Nlc3NpbmdcbiAgICAgICAgICAvLyBhIHBhcmVudCBsVmlldywgd2hpY2ggY29udGFpbnMgdGhvc2Ugbm9kZXMuXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgIWlzUHJvamVjdGlvblROb2RlKHByb2plY3Rpb25IZWFkVE5vZGUpICYmXG4gICAgICAgICAgICAhaXNJblNraXBIeWRyYXRpb25CbG9jayhwcm9qZWN0aW9uSGVhZFROb2RlKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgaWYgKGlzRGlzY29ubmVjdGVkTm9kZShwcm9qZWN0aW9uSGVhZFROb2RlLCBsVmlldykpIHtcbiAgICAgICAgICAgICAgLy8gQ2hlY2sgd2hldGhlciB0aGlzIG5vZGUgaXMgY29ubmVjdGVkLCBzaW5jZSB3ZSBtYXkgaGF2ZSBhIFROb2RlXG4gICAgICAgICAgICAgIC8vIGluIHRoZSBkYXRhIHN0cnVjdHVyZSBhcyBhIHByb2plY3Rpb24gc2VnbWVudCBoZWFkLCBidXQgdGhlXG4gICAgICAgICAgICAgIC8vIGNvbnRlbnQgcHJvamVjdGlvbiBzbG90IG1pZ2h0IGJlIGRpc2FibGVkIChlLmcuXG4gICAgICAgICAgICAgIC8vIDxuZy1jb250ZW50ICpuZ0lmPVwiZmFsc2VcIiAvPikuXG4gICAgICAgICAgICAgIGFwcGVuZERpc2Nvbm5lY3RlZE5vZGVJbmRleChuZ2gsIHByb2plY3Rpb25IZWFkVE5vZGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYXBwZW5kU2VyaWFsaXplZE5vZGVQYXRoKG5naCwgcHJvamVjdGlvbkhlYWRUTm9kZSwgbFZpZXcsIGkxOG5DaGlsZHJlbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIElmIGEgdmFsdWUgaXMgYW4gYXJyYXksIGl0IG1lYW5zIHRoYXQgd2UgYXJlIHByb2Nlc3NpbmcgYSBwcm9qZWN0aW9uXG4gICAgICAgICAgLy8gd2hlcmUgcHJvamVjdGFibGUgbm9kZXMgd2VyZSBwYXNzZWQgaW4gYXMgRE9NIG5vZGVzIChmb3IgZXhhbXBsZSwgd2hlblxuICAgICAgICAgIC8vIGNhbGxpbmcgYFZpZXdDb250YWluZXJSZWYuY3JlYXRlQ29tcG9uZW50KENtcEEsIHtwcm9qZWN0YWJsZU5vZGVzOiBbLi4uXX0pYCkuXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBJbiB0aGlzIHNjZW5hcmlvLCBub2RlcyBjYW4gY29tZSBmcm9tIGFueXdoZXJlIChlaXRoZXIgY3JlYXRlZCBtYW51YWxseSxcbiAgICAgICAgICAvLyBhY2Nlc3NlZCB2aWEgYGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JgLCBldGMpIGFuZCBtYXkgYmUgaW4gYW55IHN0YXRlXG4gICAgICAgICAgLy8gKGF0dGFjaGVkIG9yIGRldGFjaGVkIGZyb20gdGhlIERPTSB0cmVlKS4gQXMgYSByZXN1bHQsIHdlIGNhbiBub3QgcmVsaWFibHlcbiAgICAgICAgICAvLyByZXN0b3JlIHRoZSBzdGF0ZSBmb3Igc3VjaCBjYXNlcyBkdXJpbmcgaHlkcmF0aW9uLlxuXG4gICAgICAgICAgdGhyb3cgdW5zdXBwb3J0ZWRQcm9qZWN0aW9uT2ZEb21Ob2Rlcyh1bndyYXBSTm9kZShsVmlld1tpXSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uZGl0aW9uYWxseUFubm90YXRlTm9kZVBhdGgobmdoLCB0Tm9kZSwgbFZpZXcsIGkxOG5DaGlsZHJlbik7XG5cbiAgICBpZiAoaXNMQ29udGFpbmVyKGxWaWV3W2ldKSkge1xuICAgICAgLy8gU2VyaWFsaXplIGluZm9ybWF0aW9uIGFib3V0IGEgdGVtcGxhdGUuXG4gICAgICBjb25zdCBlbWJlZGRlZFRWaWV3ID0gdE5vZGUudFZpZXc7XG4gICAgICBpZiAoZW1iZWRkZWRUVmlldyAhPT0gbnVsbCkge1xuICAgICAgICBuZ2hbVEVNUExBVEVTXSA/Pz0ge307XG4gICAgICAgIG5naFtURU1QTEFURVNdW25vT2Zmc2V0SW5kZXhdID0gZ2V0U3NySWQoZW1iZWRkZWRUVmlldyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFNlcmlhbGl6ZSB2aWV3cyB3aXRoaW4gdGhpcyBMQ29udGFpbmVyLlxuICAgICAgY29uc3QgaG9zdE5vZGUgPSBsVmlld1tpXVtIT1NUXSE7IC8vIGhvc3Qgbm9kZSBvZiB0aGlzIGNvbnRhaW5lclxuXG4gICAgICAvLyBMVmlld1tpXVtIT1NUXSBjYW4gYmUgb2YgMiBkaWZmZXJlbnQgdHlwZXM6XG4gICAgICAvLyAtIGVpdGhlciBhIERPTSBub2RlXG4gICAgICAvLyAtIG9yIGFuIGFycmF5IHRoYXQgcmVwcmVzZW50cyBhbiBMVmlldyBvZiBhIGNvbXBvbmVudFxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaG9zdE5vZGUpKSB7XG4gICAgICAgIC8vIFRoaXMgaXMgYSBjb21wb25lbnQsIHNlcmlhbGl6ZSBpbmZvIGFib3V0IGl0LlxuICAgICAgICBjb25zdCB0YXJnZXROb2RlID0gdW53cmFwUk5vZGUoaG9zdE5vZGUgYXMgTFZpZXcpIGFzIFJFbGVtZW50O1xuICAgICAgICBpZiAoISh0YXJnZXROb2RlIGFzIEhUTUxFbGVtZW50KS5oYXNBdHRyaWJ1dGUoU0tJUF9IWURSQVRJT05fQVRUUl9OQU1FKSkge1xuICAgICAgICAgIGFubm90YXRlSG9zdEVsZW1lbnRGb3JIeWRyYXRpb24odGFyZ2V0Tm9kZSwgaG9zdE5vZGUgYXMgTFZpZXcsIGNvbnRleHQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIG5naFtDT05UQUlORVJTXSA/Pz0ge307XG4gICAgICBuZ2hbQ09OVEFJTkVSU11bbm9PZmZzZXRJbmRleF0gPSBzZXJpYWxpemVMQ29udGFpbmVyKGxWaWV3W2ldLCBjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkobFZpZXdbaV0pKSB7XG4gICAgICAvLyBUaGlzIGlzIGEgY29tcG9uZW50LCBhbm5vdGF0ZSB0aGUgaG9zdCBub2RlIHdpdGggYW4gYG5naGAgYXR0cmlidXRlLlxuICAgICAgY29uc3QgdGFyZ2V0Tm9kZSA9IHVud3JhcFJOb2RlKGxWaWV3W2ldW0hPU1RdISk7XG4gICAgICBpZiAoISh0YXJnZXROb2RlIGFzIEhUTUxFbGVtZW50KS5oYXNBdHRyaWJ1dGUoU0tJUF9IWURSQVRJT05fQVRUUl9OQU1FKSkge1xuICAgICAgICBhbm5vdGF0ZUhvc3RFbGVtZW50Rm9ySHlkcmF0aW9uKHRhcmdldE5vZGUgYXMgUkVsZW1lbnQsIGxWaWV3W2ldLCBjb250ZXh0KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gPG5nLWNvbnRhaW5lcj4gY2FzZVxuICAgICAgaWYgKHROb2RlLnR5cGUgJiBUTm9kZVR5cGUuRWxlbWVudENvbnRhaW5lcikge1xuICAgICAgICAvLyBBbiA8bmctY29udGFpbmVyPiBpcyByZXByZXNlbnRlZCBieSB0aGUgbnVtYmVyIG9mXG4gICAgICAgIC8vIHRvcC1sZXZlbCBub2Rlcy4gVGhpcyBpbmZvcm1hdGlvbiBpcyBuZWVkZWQgdG8gc2tpcCBvdmVyXG4gICAgICAgIC8vIHRob3NlIG5vZGVzIHRvIHJlYWNoIGEgY29ycmVzcG9uZGluZyBhbmNob3Igbm9kZSAoY29tbWVudCBub2RlKS5cbiAgICAgICAgbmdoW0VMRU1FTlRfQ09OVEFJTkVSU10gPz89IHt9O1xuICAgICAgICBuZ2hbRUxFTUVOVF9DT05UQUlORVJTXVtub09mZnNldEluZGV4XSA9IGNhbGNOdW1Sb290Tm9kZXModFZpZXcsIGxWaWV3LCB0Tm9kZS5jaGlsZCk7XG4gICAgICB9IGVsc2UgaWYgKHROb2RlLnR5cGUgJiAoVE5vZGVUeXBlLlByb2plY3Rpb24gfCBUTm9kZVR5cGUuTGV0RGVjbGFyYXRpb24pKSB7XG4gICAgICAgIC8vIEN1cnJlbnQgVE5vZGUgcmVwcmVzZW50cyBhbiBgPG5nLWNvbnRlbnQ+YCBzbG90IG9yIGBAbGV0YCBkZWNsYXJhdGlvbixcbiAgICAgICAgLy8gdGh1cyBpdCBoYXMgbm8gRE9NIGVsZW1lbnRzIGFzc29jaWF0ZWQgd2l0aCBpdCwgc28gdGhlICoqbmV4dCBzaWJsaW5nKipcbiAgICAgICAgLy8gbm9kZSB3b3VsZCBub3QgYmUgYWJsZSB0byBmaW5kIGFuIGFuY2hvci4gSW4gdGhpcyBjYXNlLCB1c2UgZnVsbCBwYXRoIGluc3RlYWQuXG4gICAgICAgIGxldCBuZXh0VE5vZGUgPSB0Tm9kZS5uZXh0O1xuICAgICAgICAvLyBTa2lwIG92ZXIgYWxsIGA8bmctY29udGVudD5gIHNsb3RzIGFuZCBgQGxldGAgZGVjbGFyYXRpb25zIGluIGEgcm93LlxuICAgICAgICB3aGlsZSAoXG4gICAgICAgICAgbmV4dFROb2RlICE9PSBudWxsICYmXG4gICAgICAgICAgbmV4dFROb2RlLnR5cGUgJiAoVE5vZGVUeXBlLlByb2plY3Rpb24gfCBUTm9kZVR5cGUuTGV0RGVjbGFyYXRpb24pXG4gICAgICAgICkge1xuICAgICAgICAgIG5leHRUTm9kZSA9IG5leHRUTm9kZS5uZXh0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChuZXh0VE5vZGUgJiYgIWlzSW5Ta2lwSHlkcmF0aW9uQmxvY2sobmV4dFROb2RlKSkge1xuICAgICAgICAgIC8vIEhhbmRsZSBhIHROb2RlIGFmdGVyIHRoZSBgPG5nLWNvbnRlbnQ+YCBzbG90LlxuICAgICAgICAgIGFwcGVuZFNlcmlhbGl6ZWROb2RlUGF0aChuZ2gsIG5leHRUTm9kZSwgbFZpZXcsIGkxOG5DaGlsZHJlbik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodE5vZGUudHlwZSAmIFROb2RlVHlwZS5UZXh0KSB7XG4gICAgICAgIGNvbnN0IHJOb2RlID0gdW53cmFwUk5vZGUobFZpZXdbaV0pO1xuICAgICAgICBwcm9jZXNzVGV4dE5vZGVCZWZvcmVTZXJpYWxpemF0aW9uKGNvbnRleHQsIHJOb2RlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIG5naDtcbn1cblxuLyoqXG4gKiBTZXJpYWxpemVzIG5vZGUgbG9jYXRpb24gaW4gY2FzZXMgd2hlbiBpdCdzIG5lZWRlZCwgc3BlY2lmaWNhbGx5OlxuICpcbiAqICAxLiBJZiBgdE5vZGUucHJvamVjdGlvbk5leHRgIGlzIGRpZmZlcmVudCBmcm9tIGB0Tm9kZS5uZXh0YCAtIGl0IG1lYW5zIHRoYXRcbiAqICAgICB0aGUgbmV4dCBgdE5vZGVgIGFmdGVyIHByb2plY3Rpb24gaXMgZGlmZmVyZW50IGZyb20gdGhlIG9uZSBpbiB0aGUgb3JpZ2luYWxcbiAqICAgICB0ZW1wbGF0ZS4gU2luY2UgaHlkcmF0aW9uIHJlbGllcyBvbiBgdE5vZGUubmV4dGAsIHRoaXMgc2VyaWFsaXplZCBpbmZvXG4gKiAgICAgaXMgcmVxdWlyZWQgdG8gaGVscCBydW50aW1lIGNvZGUgZmluZCB0aGUgbm9kZSBhdCB0aGUgY29ycmVjdCBsb2NhdGlvbi5cbiAqICAyLiBJbiBjZXJ0YWluIGNvbnRlbnQgcHJvamVjdGlvbi1iYXNlZCB1c2UtY2FzZXMsIGl0J3MgcG9zc2libGUgdGhhdCBvbmx5XG4gKiAgICAgYSBjb250ZW50IG9mIGEgcHJvamVjdGVkIGVsZW1lbnQgaXMgcmVuZGVyZWQuIEluIHRoaXMgY2FzZSwgY29udGVudCBub2Rlc1xuICogICAgIHJlcXVpcmUgYW4gZXh0cmEgYW5ub3RhdGlvbiwgc2luY2UgcnVudGltZSBsb2dpYyBjYW4ndCByZWx5IG9uIHBhcmVudC1jaGlsZFxuICogICAgIGNvbm5lY3Rpb24gdG8gaWRlbnRpZnkgdGhlIGxvY2F0aW9uIG9mIGEgbm9kZS5cbiAqL1xuZnVuY3Rpb24gY29uZGl0aW9uYWxseUFubm90YXRlTm9kZVBhdGgoXG4gIG5naDogU2VyaWFsaXplZFZpZXcsXG4gIHROb2RlOiBUTm9kZSxcbiAgbFZpZXc6IExWaWV3PHVua25vd24+LFxuICBleGNsdWRlZFBhcmVudE5vZGVzOiBTZXQ8bnVtYmVyPiB8IG51bGwsXG4pIHtcbiAgLy8gSGFuZGxlIGNhc2UgIzEgZGVzY3JpYmVkIGFib3ZlLlxuICBpZiAoXG4gICAgdE5vZGUucHJvamVjdGlvbk5leHQgJiZcbiAgICB0Tm9kZS5wcm9qZWN0aW9uTmV4dCAhPT0gdE5vZGUubmV4dCAmJlxuICAgICFpc0luU2tpcEh5ZHJhdGlvbkJsb2NrKHROb2RlLnByb2plY3Rpb25OZXh0KVxuICApIHtcbiAgICBhcHBlbmRTZXJpYWxpemVkTm9kZVBhdGgobmdoLCB0Tm9kZS5wcm9qZWN0aW9uTmV4dCwgbFZpZXcsIGV4Y2x1ZGVkUGFyZW50Tm9kZXMpO1xuICB9XG5cbiAgLy8gSGFuZGxlIGNhc2UgIzIgZGVzY3JpYmVkIGFib3ZlLlxuICAvLyBOb3RlOiB3ZSBvbmx5IGRvIHRoYXQgZm9yIHRoZSBmaXJzdCBub2RlIChpLmUuIHdoZW4gYHROb2RlLnByZXYgPT09IG51bGxgKSxcbiAgLy8gdGhlIHJlc3Qgb2YgdGhlIG5vZGVzIHdvdWxkIHJlbHkgb24gdGhlIGN1cnJlbnQgbm9kZSBsb2NhdGlvbiwgc28gbm8gZXh0cmFcbiAgLy8gYW5ub3RhdGlvbiBpcyBuZWVkZWQuXG4gIGlmIChcbiAgICB0Tm9kZS5wcmV2ID09PSBudWxsICYmXG4gICAgdE5vZGUucGFyZW50ICE9PSBudWxsICYmXG4gICAgaXNEaXNjb25uZWN0ZWROb2RlKHROb2RlLnBhcmVudCwgbFZpZXcpICYmXG4gICAgIWlzRGlzY29ubmVjdGVkTm9kZSh0Tm9kZSwgbFZpZXcpXG4gICkge1xuICAgIGFwcGVuZFNlcmlhbGl6ZWROb2RlUGF0aChuZ2gsIHROb2RlLCBsVmlldywgZXhjbHVkZWRQYXJlbnROb2Rlcyk7XG4gIH1cbn1cblxuLyoqXG4gKiBEZXRlcm1pbmVzIHdoZXRoZXIgYSBjb21wb25lbnQgaW5zdGFuY2UgdGhhdCBpcyByZXByZXNlbnRlZFxuICogYnkgYSBnaXZlbiBMVmlldyB1c2VzIGBWaWV3RW5jYXBzdWxhdGlvbi5TaGFkb3dEb21gLlxuICovXG5mdW5jdGlvbiBjb21wb25lbnRVc2VzU2hhZG93RG9tRW5jYXBzdWxhdGlvbihsVmlldzogTFZpZXcpOiBib29sZWFuIHtcbiAgY29uc3QgaW5zdGFuY2UgPSBsVmlld1tDT05URVhUXTtcbiAgcmV0dXJuIGluc3RhbmNlPy5jb25zdHJ1Y3RvclxuICAgID8gZ2V0Q29tcG9uZW50RGVmKGluc3RhbmNlLmNvbnN0cnVjdG9yKT8uZW5jYXBzdWxhdGlvbiA9PT0gVmlld0VuY2Fwc3VsYXRpb24uU2hhZG93RG9tXG4gICAgOiBmYWxzZTtcbn1cblxuLyoqXG4gKiBBbm5vdGF0ZXMgY29tcG9uZW50IGhvc3QgZWxlbWVudCBmb3IgaHlkcmF0aW9uOlxuICogLSBieSBlaXRoZXIgYWRkaW5nIHRoZSBgbmdoYCBhdHRyaWJ1dGUgYW5kIGNvbGxlY3RpbmcgaHlkcmF0aW9uLXJlbGF0ZWQgaW5mb1xuICogICBmb3IgdGhlIHNlcmlhbGl6YXRpb24gYW5kIHRyYW5zZmVycmluZyB0byB0aGUgY2xpZW50XG4gKiAtIG9yIGJ5IGFkZGluZyB0aGUgYG5nU2tpcEh5ZHJhdGlvbmAgYXR0cmlidXRlIGluIGNhc2UgQW5ndWxhciBkZXRlY3RzIHRoYXRcbiAqICAgY29tcG9uZW50IGNvbnRlbnRzIGlzIG5vdCBjb21wYXRpYmxlIHdpdGggaHlkcmF0aW9uLlxuICpcbiAqIEBwYXJhbSBlbGVtZW50IFRoZSBIb3N0IGVsZW1lbnQgdG8gYmUgYW5ub3RhdGVkXG4gKiBAcGFyYW0gbFZpZXcgVGhlIGFzc29jaWF0ZWQgTFZpZXdcbiAqIEBwYXJhbSBjb250ZXh0IFRoZSBoeWRyYXRpb24gY29udGV4dFxuICogQHJldHVybnMgQW4gaW5kZXggb2Ygc2VyaWFsaXplZCB2aWV3IGZyb20gdGhlIHRyYW5zZmVyIHN0YXRlIG9iamVjdFxuICogICAgICAgICAgb3IgYG51bGxgIHdoZW4gYSBnaXZlbiBjb21wb25lbnQgY2FuIG5vdCBiZSBzZXJpYWxpemVkLlxuICovXG5mdW5jdGlvbiBhbm5vdGF0ZUhvc3RFbGVtZW50Rm9ySHlkcmF0aW9uKFxuICBlbGVtZW50OiBSRWxlbWVudCxcbiAgbFZpZXc6IExWaWV3LFxuICBjb250ZXh0OiBIeWRyYXRpb25Db250ZXh0LFxuKTogbnVtYmVyIHwgbnVsbCB7XG4gIGNvbnN0IHJlbmRlcmVyID0gbFZpZXdbUkVOREVSRVJdO1xuICBpZiAoXG4gICAgKGhhc0kxOG4obFZpZXcpICYmICFpc0kxOG5IeWRyYXRpb25TdXBwb3J0RW5hYmxlZCgpKSB8fFxuICAgIGNvbXBvbmVudFVzZXNTaGFkb3dEb21FbmNhcHN1bGF0aW9uKGxWaWV3KVxuICApIHtcbiAgICAvLyBBdHRhY2ggdGhlIHNraXAgaHlkcmF0aW9uIGF0dHJpYnV0ZSBpZiB0aGlzIGNvbXBvbmVudDpcbiAgICAvLyAtIGVpdGhlciBoYXMgaTE4biBibG9ja3MsIHNpbmNlIGh5ZHJhdGluZyBzdWNoIGJsb2NrcyBpcyBub3QgeWV0IHN1cHBvcnRlZFxuICAgIC8vIC0gb3IgdXNlcyBTaGFkb3dEb20gdmlldyBlbmNhcHN1bGF0aW9uLCBzaW5jZSBEb21pbm8gZG9lc24ndCBzdXBwb3J0XG4gICAgLy8gICBzaGFkb3cgRE9NLCBzbyB3ZSBjYW4gbm90IGd1YXJhbnRlZSB0aGF0IGNsaWVudCBhbmQgc2VydmVyIHJlcHJlc2VudGF0aW9uc1xuICAgIC8vICAgd291bGQgZXhhY3RseSBtYXRjaFxuICAgIHJlbmRlcmVyLnNldEF0dHJpYnV0ZShlbGVtZW50LCBTS0lQX0hZRFJBVElPTl9BVFRSX05BTUUsICcnKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBuZ2ggPSBzZXJpYWxpemVMVmlldyhsVmlldywgY29udGV4dCk7XG4gICAgY29uc3QgaW5kZXggPSBjb250ZXh0LnNlcmlhbGl6ZWRWaWV3Q29sbGVjdGlvbi5hZGQobmdoKTtcbiAgICByZW5kZXJlci5zZXRBdHRyaWJ1dGUoZWxlbWVudCwgTkdIX0FUVFJfTkFNRSwgaW5kZXgudG9TdHJpbmcoKSk7XG4gICAgcmV0dXJuIGluZGV4O1xuICB9XG59XG5cbi8qKlxuICogUGh5c2ljYWxseSBpbnNlcnRzIHRoZSBjb21tZW50IG5vZGVzIHRvIGVuc3VyZSBlbXB0eSB0ZXh0IG5vZGVzIGFuZCBhZGphY2VudFxuICogdGV4dCBub2RlIHNlcGFyYXRvcnMgYXJlIHByZXNlcnZlZCBhZnRlciBzZXJ2ZXIgc2VyaWFsaXphdGlvbiBvZiB0aGUgRE9NLlxuICogVGhlc2UgZ2V0IHN3YXBwZWQgYmFjayBmb3IgZW1wdHkgdGV4dCBub2RlcyBvciBzZXBhcmF0b3JzIG9uY2UgaHlkcmF0aW9uIGhhcHBlbnNcbiAqIG9uIHRoZSBjbGllbnQuXG4gKlxuICogQHBhcmFtIGNvcnJ1cHRlZFRleHROb2RlcyBUaGUgTWFwIG9mIHRleHQgbm9kZXMgdG8gYmUgcmVwbGFjZWQgd2l0aCBjb21tZW50c1xuICogQHBhcmFtIGRvYyBUaGUgZG9jdW1lbnRcbiAqL1xuZnVuY3Rpb24gaW5zZXJ0Q29ycnVwdGVkVGV4dE5vZGVNYXJrZXJzKFxuICBjb3JydXB0ZWRUZXh0Tm9kZXM6IE1hcDxIVE1MRWxlbWVudCwgc3RyaW5nPixcbiAgZG9jOiBEb2N1bWVudCxcbikge1xuICBmb3IgKGNvbnN0IFt0ZXh0Tm9kZSwgbWFya2VyXSBvZiBjb3JydXB0ZWRUZXh0Tm9kZXMpIHtcbiAgICB0ZXh0Tm9kZS5hZnRlcihkb2MuY3JlYXRlQ29tbWVudChtYXJrZXIpKTtcbiAgfVxufVxuXG4vKipcbiAqIERldGVjdHMgd2hldGhlciBhIGdpdmVuIFROb2RlIHJlcHJlc2VudHMgYSBub2RlIHRoYXRcbiAqIGlzIGJlaW5nIGNvbnRlbnQgcHJvamVjdGVkLlxuICovXG5mdW5jdGlvbiBpc0NvbnRlbnRQcm9qZWN0ZWROb2RlKHROb2RlOiBUTm9kZSk6IGJvb2xlYW4ge1xuICBsZXQgY3VycmVudFROb2RlID0gdE5vZGU7XG4gIHdoaWxlIChjdXJyZW50VE5vZGUgIT0gbnVsbCkge1xuICAgIC8vIElmIHdlIGNvbWUgYWNyb3NzIGEgY29tcG9uZW50IGhvc3Qgbm9kZSBpbiBwYXJlbnQgbm9kZXMgLVxuICAgIC8vIHRoaXMgVE5vZGUgaXMgaW4gdGhlIGNvbnRlbnQgcHJvamVjdGlvbiBzZWN0aW9uLlxuICAgIGlmIChpc0NvbXBvbmVudEhvc3QoY3VycmVudFROb2RlKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGN1cnJlbnRUTm9kZSA9IGN1cnJlbnRUTm9kZS5wYXJlbnQgYXMgVE5vZGU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuIl19