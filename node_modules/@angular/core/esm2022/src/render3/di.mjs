/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { isForwardRef, resolveForwardRef } from '../di/forward_ref';
import { injectRootLimpMode, setInjectImplementation } from '../di/inject_switch';
import { convertToBitFlags } from '../di/injector_compatibility';
import { InjectFlags } from '../di/interface/injector';
import { assertDefined, assertEqual, assertIndexInRange } from '../util/assert';
import { noSideEffects } from '../util/closure';
import { assertDirectiveDef, assertNodeInjector, assertTNodeForLView } from './assert';
import { emitInstanceCreatedByInjectorEvent, runInInjectorProfilerContext, setInjectorProfilerContext, } from './debug/injector_profiler';
import { getFactoryDef } from './definition_factory';
import { throwCyclicDependencyError, throwProviderNotFoundError } from './errors_di';
import { NG_ELEMENT_ID, NG_FACTORY_DEF } from './fields';
import { registerPreOrderHooks } from './hooks';
import { isFactory, NO_PARENT_INJECTOR, } from './interfaces/injector';
import { isComponentDef, isComponentHost } from './interfaces/type_checks';
import { DECLARATION_COMPONENT_VIEW, DECLARATION_VIEW, EMBEDDED_VIEW_INJECTOR, FLAGS, INJECTOR, T_HOST, TVIEW, } from './interfaces/view';
import { assertTNodeType } from './node_assert';
import { enterDI, getCurrentTNode, getLView, leaveDI } from './state';
import { isNameOnlyAttributeMarker } from './util/attrs_utils';
import { getParentInjectorIndex, getParentInjectorView, hasParentInjector, } from './util/injector_utils';
import { stringifyForError } from './util/stringify_utils';
/**
 * Defines if the call to `inject` should include `viewProviders` in its resolution.
 *
 * This is set to true when we try to instantiate a component. This value is reset in
 * `getNodeInjectable` to a value which matches the declaration location of the token about to be
 * instantiated. This is done so that if we are injecting a token which was declared outside of
 * `viewProviders` we don't accidentally pull `viewProviders` in.
 *
 * Example:
 *
 * ```
 * @Injectable()
 * class MyService {
 *   constructor(public value: String) {}
 * }
 *
 * @Component({
 *   providers: [
 *     MyService,
 *     {provide: String, value: 'providers' }
 *   ]
 *   viewProviders: [
 *     {provide: String, value: 'viewProviders'}
 *   ]
 * })
 * class MyComponent {
 *   constructor(myService: MyService, value: String) {
 *     // We expect that Component can see into `viewProviders`.
 *     expect(value).toEqual('viewProviders');
 *     // `MyService` was not declared in `viewProviders` hence it can't see it.
 *     expect(myService.value).toEqual('providers');
 *   }
 * }
 *
 * ```
 */
let includeViewProviders = true;
export function setIncludeViewProviders(v) {
    const oldValue = includeViewProviders;
    includeViewProviders = v;
    return oldValue;
}
/**
 * The number of slots in each bloom filter (used by DI). The larger this number, the fewer
 * directives that will share slots, and thus, the fewer false positives when checking for
 * the existence of a directive.
 */
const BLOOM_SIZE = 256;
const BLOOM_MASK = BLOOM_SIZE - 1;
/**
 * The number of bits that is represented by a single bloom bucket. JS bit operations are 32 bits,
 * so each bucket represents 32 distinct tokens which accounts for log2(32) = 5 bits of a bloom hash
 * number.
 */
const BLOOM_BUCKET_BITS = 5;
/** Counter used to generate unique IDs for directives. */
let nextNgElementId = 0;
/** Value used when something wasn't found by an injector. */
const NOT_FOUND = {};
/**
 * Registers this directive as present in its node's injector by flipping the directive's
 * corresponding bit in the injector's bloom filter.
 *
 * @param injectorIndex The index of the node injector where this token should be registered
 * @param tView The TView for the injector's bloom filters
 * @param type The directive token to register
 */
export function bloomAdd(injectorIndex, tView, type) {
    ngDevMode && assertEqual(tView.firstCreatePass, true, 'expected firstCreatePass to be true');
    let id;
    if (typeof type === 'string') {
        id = type.charCodeAt(0) || 0;
    }
    else if (type.hasOwnProperty(NG_ELEMENT_ID)) {
        id = type[NG_ELEMENT_ID];
    }
    // Set a unique ID on the directive type, so if something tries to inject the directive,
    // we can easily retrieve the ID and hash it into the bloom bit that should be checked.
    if (id == null) {
        id = type[NG_ELEMENT_ID] = nextNgElementId++;
    }
    // We only have BLOOM_SIZE (256) slots in our bloom filter (8 buckets * 32 bits each),
    // so all unique IDs must be modulo-ed into a number from 0 - 255 to fit into the filter.
    const bloomHash = id & BLOOM_MASK;
    // Create a mask that targets the specific bit associated with the directive.
    // JS bit operations are 32 bits, so this will be a number between 2^0 and 2^31, corresponding
    // to bit positions 0 - 31 in a 32 bit integer.
    const mask = 1 << bloomHash;
    // Each bloom bucket in `tData` represents `BLOOM_BUCKET_BITS` number of bits of `bloomHash`.
    // Any bits in `bloomHash` beyond `BLOOM_BUCKET_BITS` indicate the bucket offset that the mask
    // should be written to.
    tView.data[injectorIndex + (bloomHash >> BLOOM_BUCKET_BITS)] |= mask;
}
/**
 * Creates (or gets an existing) injector for a given element or container.
 *
 * @param tNode for which an injector should be retrieved / created.
 * @param lView View where the node is stored
 * @returns Node injector
 */
export function getOrCreateNodeInjectorForNode(tNode, lView) {
    const existingInjectorIndex = getInjectorIndex(tNode, lView);
    if (existingInjectorIndex !== -1) {
        return existingInjectorIndex;
    }
    const tView = lView[TVIEW];
    if (tView.firstCreatePass) {
        tNode.injectorIndex = lView.length;
        insertBloom(tView.data, tNode); // foundation for node bloom
        insertBloom(lView, null); // foundation for cumulative bloom
        insertBloom(tView.blueprint, null);
    }
    const parentLoc = getParentInjectorLocation(tNode, lView);
    const injectorIndex = tNode.injectorIndex;
    // If a parent injector can't be found, its location is set to -1.
    // In that case, we don't need to set up a cumulative bloom
    if (hasParentInjector(parentLoc)) {
        const parentIndex = getParentInjectorIndex(parentLoc);
        const parentLView = getParentInjectorView(parentLoc, lView);
        const parentData = parentLView[TVIEW].data;
        // Creates a cumulative bloom filter that merges the parent's bloom filter
        // and its own cumulative bloom (which contains tokens for all ancestors)
        for (let i = 0; i < 8 /* NodeInjectorOffset.BLOOM_SIZE */; i++) {
            lView[injectorIndex + i] = parentLView[parentIndex + i] | parentData[parentIndex + i];
        }
    }
    lView[injectorIndex + 8 /* NodeInjectorOffset.PARENT */] = parentLoc;
    return injectorIndex;
}
function insertBloom(arr, footer) {
    arr.push(0, 0, 0, 0, 0, 0, 0, 0, footer);
}
export function getInjectorIndex(tNode, lView) {
    if (tNode.injectorIndex === -1 ||
        // If the injector index is the same as its parent's injector index, then the index has been
        // copied down from the parent node. No injector has been created yet on this node.
        (tNode.parent && tNode.parent.injectorIndex === tNode.injectorIndex) ||
        // After the first template pass, the injector index might exist but the parent values
        // might not have been calculated yet for this instance
        lView[tNode.injectorIndex + 8 /* NodeInjectorOffset.PARENT */] === null) {
        return -1;
    }
    else {
        ngDevMode && assertIndexInRange(lView, tNode.injectorIndex);
        return tNode.injectorIndex;
    }
}
/**
 * Finds the index of the parent injector, with a view offset if applicable. Used to set the
 * parent injector initially.
 *
 * @returns Returns a number that is the combination of the number of LViews that we have to go up
 * to find the LView containing the parent inject AND the index of the injector within that LView.
 */
export function getParentInjectorLocation(tNode, lView) {
    if (tNode.parent && tNode.parent.injectorIndex !== -1) {
        // If we have a parent `TNode` and there is an injector associated with it we are done, because
        // the parent injector is within the current `LView`.
        return tNode.parent.injectorIndex; // ViewOffset is 0
    }
    // When parent injector location is computed it may be outside of the current view. (ie it could
    // be pointing to a declared parent location). This variable stores number of declaration parents
    // we need to walk up in order to find the parent injector location.
    let declarationViewOffset = 0;
    let parentTNode = null;
    let lViewCursor = lView;
    // The parent injector is not in the current `LView`. We will have to walk the declared parent
    // `LView` hierarchy and look for it. If we walk of the top, that means that there is no parent
    // `NodeInjector`.
    while (lViewCursor !== null) {
        parentTNode = getTNodeFromLView(lViewCursor);
        if (parentTNode === null) {
            // If we have no parent, than we are done.
            return NO_PARENT_INJECTOR;
        }
        ngDevMode && parentTNode && assertTNodeForLView(parentTNode, lViewCursor[DECLARATION_VIEW]);
        // Every iteration of the loop requires that we go to the declared parent.
        declarationViewOffset++;
        lViewCursor = lViewCursor[DECLARATION_VIEW];
        if (parentTNode.injectorIndex !== -1) {
            // We found a NodeInjector which points to something.
            return (parentTNode.injectorIndex |
                (declarationViewOffset <<
                    16 /* RelativeInjectorLocationFlags.ViewOffsetShift */));
        }
    }
    return NO_PARENT_INJECTOR;
}
/**
 * Makes a type or an injection token public to the DI system by adding it to an
 * injector's bloom filter.
 *
 * @param di The node injector in which a directive will be added
 * @param token The type or the injection token to be made public
 */
export function diPublicInInjector(injectorIndex, tView, token) {
    bloomAdd(injectorIndex, tView, token);
}
/**
 * Inject static attribute value into directive constructor.
 *
 * This method is used with `factory` functions which are generated as part of
 * `defineDirective` or `defineComponent`. The method retrieves the static value
 * of an attribute. (Dynamic attributes are not supported since they are not resolved
 *  at the time of injection and can change over time.)
 *
 * # Example
 * Given:
 * ```
 * @Component(...)
 * class MyComponent {
 *   constructor(@Attribute('title') title: string) { ... }
 * }
 * ```
 * When instantiated with
 * ```
 * <my-component title="Hello"></my-component>
 * ```
 *
 * Then factory method generated is:
 * ```
 * MyComponent.ɵcmp = defineComponent({
 *   factory: () => new MyComponent(injectAttribute('title'))
 *   ...
 * })
 * ```
 *
 * @publicApi
 */
export function injectAttributeImpl(tNode, attrNameToInject) {
    ngDevMode && assertTNodeType(tNode, 12 /* TNodeType.AnyContainer */ | 3 /* TNodeType.AnyRNode */);
    ngDevMode && assertDefined(tNode, 'expecting tNode');
    if (attrNameToInject === 'class') {
        return tNode.classes;
    }
    if (attrNameToInject === 'style') {
        return tNode.styles;
    }
    const attrs = tNode.attrs;
    if (attrs) {
        const attrsLength = attrs.length;
        let i = 0;
        while (i < attrsLength) {
            const value = attrs[i];
            // If we hit a `Bindings` or `Template` marker then we are done.
            if (isNameOnlyAttributeMarker(value))
                break;
            // Skip namespaced attributes
            if (value === 0 /* AttributeMarker.NamespaceURI */) {
                // we skip the next two values
                // as namespaced attributes looks like
                // [..., AttributeMarker.NamespaceURI, 'http://someuri.com/test', 'test:exist',
                // 'existValue', ...]
                i = i + 2;
            }
            else if (typeof value === 'number') {
                // Skip to the first value of the marked attribute.
                i++;
                while (i < attrsLength && typeof attrs[i] === 'string') {
                    i++;
                }
            }
            else if (value === attrNameToInject) {
                return attrs[i + 1];
            }
            else {
                i = i + 2;
            }
        }
    }
    return null;
}
function notFoundValueOrThrow(notFoundValue, token, flags) {
    if (flags & InjectFlags.Optional || notFoundValue !== undefined) {
        return notFoundValue;
    }
    else {
        throwProviderNotFoundError(token, 'NodeInjector');
    }
}
/**
 * Returns the value associated to the given token from the ModuleInjector or throws exception
 *
 * @param lView The `LView` that contains the `tNode`
 * @param token The token to look for
 * @param flags Injection flags
 * @param notFoundValue The value to return when the injection flags is `InjectFlags.Optional`
 * @returns the value from the injector or throws an exception
 */
function lookupTokenUsingModuleInjector(lView, token, flags, notFoundValue) {
    if (flags & InjectFlags.Optional && notFoundValue === undefined) {
        // This must be set or the NullInjector will throw for optional deps
        notFoundValue = null;
    }
    if ((flags & (InjectFlags.Self | InjectFlags.Host)) === 0) {
        const moduleInjector = lView[INJECTOR];
        // switch to `injectInjectorOnly` implementation for module injector, since module injector
        // should not have access to Component/Directive DI scope (that may happen through
        // `directiveInject` implementation)
        const previousInjectImplementation = setInjectImplementation(undefined);
        try {
            if (moduleInjector) {
                return moduleInjector.get(token, notFoundValue, flags & InjectFlags.Optional);
            }
            else {
                return injectRootLimpMode(token, notFoundValue, flags & InjectFlags.Optional);
            }
        }
        finally {
            setInjectImplementation(previousInjectImplementation);
        }
    }
    return notFoundValueOrThrow(notFoundValue, token, flags);
}
/**
 * Returns the value associated to the given token from the NodeInjectors => ModuleInjector.
 *
 * Look for the injector providing the token by walking up the node injector tree and then
 * the module injector tree.
 *
 * This function patches `token` with `__NG_ELEMENT_ID__` which contains the id for the bloom
 * filter. `-1` is reserved for injecting `Injector` (implemented by `NodeInjector`)
 *
 * @param tNode The Node where the search for the injector should start
 * @param lView The `LView` that contains the `tNode`
 * @param token The token to look for
 * @param flags Injection flags
 * @param notFoundValue The value to return when the injection flags is `InjectFlags.Optional`
 * @returns the value from the injector, `null` when not found, or `notFoundValue` if provided
 */
export function getOrCreateInjectable(tNode, lView, token, flags = InjectFlags.Default, notFoundValue) {
    if (tNode !== null) {
        // If the view or any of its ancestors have an embedded
        // view injector, we have to look it up there first.
        if (lView[FLAGS] & 2048 /* LViewFlags.HasEmbeddedViewInjector */ &&
            // The token must be present on the current node injector when the `Self`
            // flag is set, so the lookup on embedded view injector(s) can be skipped.
            !(flags & InjectFlags.Self)) {
            const embeddedInjectorValue = lookupTokenUsingEmbeddedInjector(tNode, lView, token, flags, NOT_FOUND);
            if (embeddedInjectorValue !== NOT_FOUND) {
                return embeddedInjectorValue;
            }
        }
        // Otherwise try the node injector.
        const value = lookupTokenUsingNodeInjector(tNode, lView, token, flags, NOT_FOUND);
        if (value !== NOT_FOUND) {
            return value;
        }
    }
    // Finally, fall back to the module injector.
    return lookupTokenUsingModuleInjector(lView, token, flags, notFoundValue);
}
/**
 * Returns the value associated to the given token from the node injector.
 *
 * @param tNode The Node where the search for the injector should start
 * @param lView The `LView` that contains the `tNode`
 * @param token The token to look for
 * @param flags Injection flags
 * @param notFoundValue The value to return when the injection flags is `InjectFlags.Optional`
 * @returns the value from the injector, `null` when not found, or `notFoundValue` if provided
 */
function lookupTokenUsingNodeInjector(tNode, lView, token, flags, notFoundValue) {
    const bloomHash = bloomHashBitOrFactory(token);
    // If the ID stored here is a function, this is a special object like ElementRef or TemplateRef
    // so just call the factory function to create it.
    if (typeof bloomHash === 'function') {
        if (!enterDI(lView, tNode, flags)) {
            // Failed to enter DI, try module injector instead. If a token is injected with the @Host
            // flag, the module injector is not searched for that token in Ivy.
            return flags & InjectFlags.Host
                ? notFoundValueOrThrow(notFoundValue, token, flags)
                : lookupTokenUsingModuleInjector(lView, token, flags, notFoundValue);
        }
        try {
            let value;
            if (ngDevMode) {
                runInInjectorProfilerContext(new NodeInjector(getCurrentTNode(), getLView()), token, () => {
                    value = bloomHash(flags);
                    if (value != null) {
                        emitInstanceCreatedByInjectorEvent(value);
                    }
                });
            }
            else {
                value = bloomHash(flags);
            }
            if (value == null && !(flags & InjectFlags.Optional)) {
                throwProviderNotFoundError(token);
            }
            else {
                return value;
            }
        }
        finally {
            leaveDI();
        }
    }
    else if (typeof bloomHash === 'number') {
        // A reference to the previous injector TView that was found while climbing the element
        // injector tree. This is used to know if viewProviders can be accessed on the current
        // injector.
        let previousTView = null;
        let injectorIndex = getInjectorIndex(tNode, lView);
        let parentLocation = NO_PARENT_INJECTOR;
        let hostTElementNode = flags & InjectFlags.Host ? lView[DECLARATION_COMPONENT_VIEW][T_HOST] : null;
        // If we should skip this injector, or if there is no injector on this node, start by
        // searching the parent injector.
        if (injectorIndex === -1 || flags & InjectFlags.SkipSelf) {
            parentLocation =
                injectorIndex === -1
                    ? getParentInjectorLocation(tNode, lView)
                    : lView[injectorIndex + 8 /* NodeInjectorOffset.PARENT */];
            if (parentLocation === NO_PARENT_INJECTOR || !shouldSearchParent(flags, false)) {
                injectorIndex = -1;
            }
            else {
                previousTView = lView[TVIEW];
                injectorIndex = getParentInjectorIndex(parentLocation);
                lView = getParentInjectorView(parentLocation, lView);
            }
        }
        // Traverse up the injector tree until we find a potential match or until we know there
        // *isn't* a match.
        while (injectorIndex !== -1) {
            ngDevMode && assertNodeInjector(lView, injectorIndex);
            // Check the current injector. If it matches, see if it contains token.
            const tView = lView[TVIEW];
            ngDevMode &&
                assertTNodeForLView(tView.data[injectorIndex + 8 /* NodeInjectorOffset.TNODE */], lView);
            if (bloomHasToken(bloomHash, injectorIndex, tView.data)) {
                // At this point, we have an injector which *may* contain the token, so we step through
                // the providers and directives associated with the injector's corresponding node to get
                // the instance.
                const instance = searchTokensOnInjector(injectorIndex, lView, token, previousTView, flags, hostTElementNode);
                if (instance !== NOT_FOUND) {
                    return instance;
                }
            }
            parentLocation = lView[injectorIndex + 8 /* NodeInjectorOffset.PARENT */];
            if (parentLocation !== NO_PARENT_INJECTOR &&
                shouldSearchParent(flags, lView[TVIEW].data[injectorIndex + 8 /* NodeInjectorOffset.TNODE */] === hostTElementNode) &&
                bloomHasToken(bloomHash, injectorIndex, lView)) {
                // The def wasn't found anywhere on this node, so it was a false positive.
                // Traverse up the tree and continue searching.
                previousTView = tView;
                injectorIndex = getParentInjectorIndex(parentLocation);
                lView = getParentInjectorView(parentLocation, lView);
            }
            else {
                // If we should not search parent OR If the ancestor bloom filter value does not have the
                // bit corresponding to the directive we can give up on traversing up to find the specific
                // injector.
                injectorIndex = -1;
            }
        }
    }
    return notFoundValue;
}
function searchTokensOnInjector(injectorIndex, lView, token, previousTView, flags, hostTElementNode) {
    const currentTView = lView[TVIEW];
    const tNode = currentTView.data[injectorIndex + 8 /* NodeInjectorOffset.TNODE */];
    // First, we need to determine if view providers can be accessed by the starting element.
    // There are two possibilities
    const canAccessViewProviders = previousTView == null
        ? // 1) This is the first invocation `previousTView == null` which means that we are at the
            // `TNode` of where injector is starting to look. In such a case the only time we are allowed
            // to look into the ViewProviders is if:
            // - we are on a component
            // - AND the injector set `includeViewProviders` to true (implying that the token can see
            // ViewProviders because it is the Component or a Service which itself was declared in
            // ViewProviders)
            isComponentHost(tNode) && includeViewProviders
        : // 2) `previousTView != null` which means that we are now walking across the parent nodes.
            // In such a case we are only allowed to look into the ViewProviders if:
            // - We just crossed from child View to Parent View `previousTView != currentTView`
            // - AND the parent TNode is an Element.
            // This means that we just came from the Component's View and therefore are allowed to see
            // into the ViewProviders.
            previousTView != currentTView && (tNode.type & 3 /* TNodeType.AnyRNode */) !== 0;
    // This special case happens when there is a @host on the inject and when we are searching
    // on the host element node.
    const isHostSpecialCase = flags & InjectFlags.Host && hostTElementNode === tNode;
    const injectableIdx = locateDirectiveOrProvider(tNode, currentTView, token, canAccessViewProviders, isHostSpecialCase);
    if (injectableIdx !== null) {
        return getNodeInjectable(lView, currentTView, injectableIdx, tNode);
    }
    else {
        return NOT_FOUND;
    }
}
/**
 * Searches for the given token among the node's directives and providers.
 *
 * @param tNode TNode on which directives are present.
 * @param tView The tView we are currently processing
 * @param token Provider token or type of a directive to look for.
 * @param canAccessViewProviders Whether view providers should be considered.
 * @param isHostSpecialCase Whether the host special case applies.
 * @returns Index of a found directive or provider, or null when none found.
 */
export function locateDirectiveOrProvider(tNode, tView, token, canAccessViewProviders, isHostSpecialCase) {
    const nodeProviderIndexes = tNode.providerIndexes;
    const tInjectables = tView.data;
    const injectablesStart = nodeProviderIndexes & 1048575 /* TNodeProviderIndexes.ProvidersStartIndexMask */;
    const directivesStart = tNode.directiveStart;
    const directiveEnd = tNode.directiveEnd;
    const cptViewProvidersCount = nodeProviderIndexes >> 20 /* TNodeProviderIndexes.CptViewProvidersCountShift */;
    const startingIndex = canAccessViewProviders
        ? injectablesStart
        : injectablesStart + cptViewProvidersCount;
    // When the host special case applies, only the viewProviders and the component are visible
    const endIndex = isHostSpecialCase ? injectablesStart + cptViewProvidersCount : directiveEnd;
    for (let i = startingIndex; i < endIndex; i++) {
        const providerTokenOrDef = tInjectables[i];
        if ((i < directivesStart && token === providerTokenOrDef) ||
            (i >= directivesStart && providerTokenOrDef.type === token)) {
            return i;
        }
    }
    if (isHostSpecialCase) {
        const dirDef = tInjectables[directivesStart];
        if (dirDef && isComponentDef(dirDef) && dirDef.type === token) {
            return directivesStart;
        }
    }
    return null;
}
/**
 * Retrieve or instantiate the injectable from the `LView` at particular `index`.
 *
 * This function checks to see if the value has already been instantiated and if so returns the
 * cached `injectable`. Otherwise if it detects that the value is still a factory it
 * instantiates the `injectable` and caches the value.
 */
export function getNodeInjectable(lView, tView, index, tNode) {
    let value = lView[index];
    const tData = tView.data;
    if (isFactory(value)) {
        const factory = value;
        if (factory.resolving) {
            throwCyclicDependencyError(stringifyForError(tData[index]));
        }
        const previousIncludeViewProviders = setIncludeViewProviders(factory.canSeeViewProviders);
        factory.resolving = true;
        let prevInjectContext;
        if (ngDevMode) {
            // tData indexes mirror the concrete instances in its corresponding LView.
            // lView[index] here is either the injectable instace itself or a factory,
            // therefore tData[index] is the constructor of that injectable or a
            // definition object that contains the constructor in a `.type` field.
            const token = tData[index].type || tData[index];
            const injector = new NodeInjector(tNode, lView);
            prevInjectContext = setInjectorProfilerContext({ injector, token });
        }
        const previousInjectImplementation = factory.injectImpl
            ? setInjectImplementation(factory.injectImpl)
            : null;
        const success = enterDI(lView, tNode, InjectFlags.Default);
        ngDevMode &&
            assertEqual(success, true, "Because flags do not contain `SkipSelf' we expect this to always succeed.");
        try {
            value = lView[index] = factory.factory(undefined, tData, lView, tNode);
            ngDevMode && emitInstanceCreatedByInjectorEvent(value);
            // This code path is hit for both directives and providers.
            // For perf reasons, we want to avoid searching for hooks on providers.
            // It does no harm to try (the hooks just won't exist), but the extra
            // checks are unnecessary and this is a hot path. So we check to see
            // if the index of the dependency is in the directive range for this
            // tNode. If it's not, we know it's a provider and skip hook registration.
            if (tView.firstCreatePass && index >= tNode.directiveStart) {
                ngDevMode && assertDirectiveDef(tData[index]);
                registerPreOrderHooks(index, tData[index], tView);
            }
        }
        finally {
            ngDevMode && setInjectorProfilerContext(prevInjectContext);
            previousInjectImplementation !== null &&
                setInjectImplementation(previousInjectImplementation);
            setIncludeViewProviders(previousIncludeViewProviders);
            factory.resolving = false;
            leaveDI();
        }
    }
    return value;
}
/**
 * Returns the bit in an injector's bloom filter that should be used to determine whether or not
 * the directive might be provided by the injector.
 *
 * When a directive is public, it is added to the bloom filter and given a unique ID that can be
 * retrieved on the Type. When the directive isn't public or the token is not a directive `null`
 * is returned as the node injector can not possibly provide that token.
 *
 * @param token the injection token
 * @returns the matching bit to check in the bloom filter or `null` if the token is not known.
 *   When the returned value is negative then it represents special values such as `Injector`.
 */
export function bloomHashBitOrFactory(token) {
    ngDevMode && assertDefined(token, 'token must be defined');
    if (typeof token === 'string') {
        return token.charCodeAt(0) || 0;
    }
    const tokenId = 
    // First check with `hasOwnProperty` so we don't get an inherited ID.
    token.hasOwnProperty(NG_ELEMENT_ID) ? token[NG_ELEMENT_ID] : undefined;
    // Negative token IDs are used for special objects such as `Injector`
    if (typeof tokenId === 'number') {
        if (tokenId >= 0) {
            return tokenId & BLOOM_MASK;
        }
        else {
            ngDevMode &&
                assertEqual(tokenId, -1 /* InjectorMarkers.Injector */, 'Expecting to get Special Injector Id');
            return createNodeInjector;
        }
    }
    else {
        return tokenId;
    }
}
export function bloomHasToken(bloomHash, injectorIndex, injectorView) {
    // Create a mask that targets the specific bit associated with the directive we're looking for.
    // JS bit operations are 32 bits, so this will be a number between 2^0 and 2^31, corresponding
    // to bit positions 0 - 31 in a 32 bit integer.
    const mask = 1 << bloomHash;
    // Each bloom bucket in `injectorView` represents `BLOOM_BUCKET_BITS` number of bits of
    // `bloomHash`. Any bits in `bloomHash` beyond `BLOOM_BUCKET_BITS` indicate the bucket offset
    // that should be used.
    const value = injectorView[injectorIndex + (bloomHash >> BLOOM_BUCKET_BITS)];
    // If the bloom filter value has the bit corresponding to the directive's bloomBit flipped on,
    // this injector is a potential match.
    return !!(value & mask);
}
/** Returns true if flags prevent parent injector from being searched for tokens */
function shouldSearchParent(flags, isFirstHostTNode) {
    return !(flags & InjectFlags.Self) && !(flags & InjectFlags.Host && isFirstHostTNode);
}
export function getNodeInjectorLView(nodeInjector) {
    return nodeInjector._lView;
}
export function getNodeInjectorTNode(nodeInjector) {
    return nodeInjector._tNode;
}
export class NodeInjector {
    constructor(_tNode, _lView) {
        this._tNode = _tNode;
        this._lView = _lView;
    }
    get(token, notFoundValue, flags) {
        return getOrCreateInjectable(this._tNode, this._lView, token, convertToBitFlags(flags), notFoundValue);
    }
}
/** Creates a `NodeInjector` for the current node. */
export function createNodeInjector() {
    return new NodeInjector(getCurrentTNode(), getLView());
}
/**
 * @codeGenApi
 */
export function ɵɵgetInheritedFactory(type) {
    return noSideEffects(() => {
        const ownConstructor = type.prototype.constructor;
        const ownFactory = ownConstructor[NG_FACTORY_DEF] || getFactoryOf(ownConstructor);
        const objectPrototype = Object.prototype;
        let parent = Object.getPrototypeOf(type.prototype).constructor;
        // Go up the prototype until we hit `Object`.
        while (parent && parent !== objectPrototype) {
            const factory = parent[NG_FACTORY_DEF] || getFactoryOf(parent);
            // If we hit something that has a factory and the factory isn't the same as the type,
            // we've found the inherited factory. Note the check that the factory isn't the type's
            // own factory is redundant in most cases, but if the user has custom decorators on the
            // class, this lookup will start one level down in the prototype chain, causing us to
            // find the own factory first and potentially triggering an infinite loop downstream.
            if (factory && factory !== ownFactory) {
                return factory;
            }
            parent = Object.getPrototypeOf(parent);
        }
        // There is no factory defined. Either this was improper usage of inheritance
        // (no Angular decorator on the superclass) or there is no constructor at all
        // in the inheritance chain. Since the two cases cannot be distinguished, the
        // latter has to be assumed.
        return (t) => new t();
    });
}
function getFactoryOf(type) {
    if (isForwardRef(type)) {
        return () => {
            const factory = getFactoryOf(resolveForwardRef(type));
            return factory && factory();
        };
    }
    return getFactoryDef(type);
}
/**
 * Returns a value from the closest embedded or node injector.
 *
 * @param tNode The Node where the search for the injector should start
 * @param lView The `LView` that contains the `tNode`
 * @param token The token to look for
 * @param flags Injection flags
 * @param notFoundValue The value to return when the injection flags is `InjectFlags.Optional`
 * @returns the value from the injector, `null` when not found, or `notFoundValue` if provided
 */
function lookupTokenUsingEmbeddedInjector(tNode, lView, token, flags, notFoundValue) {
    let currentTNode = tNode;
    let currentLView = lView;
    // When an LView with an embedded view injector is inserted, it'll likely be interlaced with
    // nodes who may have injectors (e.g. node injector -> embedded view injector -> node injector).
    // Since the bloom filters for the node injectors have already been constructed and we don't
    // have a way of extracting the records from an injector, the only way to maintain the correct
    // hierarchy when resolving the value is to walk it node-by-node while attempting to resolve
    // the token at each level.
    while (currentTNode !== null &&
        currentLView !== null &&
        currentLView[FLAGS] & 2048 /* LViewFlags.HasEmbeddedViewInjector */ &&
        !(currentLView[FLAGS] & 512 /* LViewFlags.IsRoot */)) {
        ngDevMode && assertTNodeForLView(currentTNode, currentLView);
        // Note that this lookup on the node injector is using the `Self` flag, because
        // we don't want the node injector to look at any parent injectors since we
        // may hit the embedded view injector first.
        const nodeInjectorValue = lookupTokenUsingNodeInjector(currentTNode, currentLView, token, flags | InjectFlags.Self, NOT_FOUND);
        if (nodeInjectorValue !== NOT_FOUND) {
            return nodeInjectorValue;
        }
        // Has an explicit type due to a TS bug: https://github.com/microsoft/TypeScript/issues/33191
        let parentTNode = currentTNode.parent;
        // `TNode.parent` includes the parent within the current view only. If it doesn't exist,
        // it means that we've hit the view boundary and we need to go up to the next view.
        if (!parentTNode) {
            // Before we go to the next LView, check if the token exists on the current embedded injector.
            const embeddedViewInjector = currentLView[EMBEDDED_VIEW_INJECTOR];
            if (embeddedViewInjector) {
                const embeddedViewInjectorValue = embeddedViewInjector.get(token, NOT_FOUND, flags);
                if (embeddedViewInjectorValue !== NOT_FOUND) {
                    return embeddedViewInjectorValue;
                }
            }
            // Otherwise keep going up the tree.
            parentTNode = getTNodeFromLView(currentLView);
            currentLView = currentLView[DECLARATION_VIEW];
        }
        currentTNode = parentTNode;
    }
    return notFoundValue;
}
/** Gets the TNode associated with an LView inside of the declaration view. */
function getTNodeFromLView(lView) {
    const tView = lView[TVIEW];
    const tViewType = tView.type;
    // The parent pointer differs based on `TView.type`.
    if (tViewType === 2 /* TViewType.Embedded */) {
        ngDevMode && assertDefined(tView.declTNode, 'Embedded TNodes should have declaration parents.');
        return tView.declTNode;
    }
    else if (tViewType === 1 /* TViewType.Component */) {
        // Components don't have `TView.declTNode` because each instance of component could be
        // inserted in different location, hence `TView.declTNode` is meaningless.
        return lView[T_HOST];
    }
    return null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL2RpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxZQUFZLEVBQUUsaUJBQWlCLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUNsRSxPQUFPLEVBQUMsa0JBQWtCLEVBQUUsdUJBQXVCLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUVoRixPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUUvRCxPQUFPLEVBQUMsV0FBVyxFQUFnQixNQUFNLDBCQUEwQixDQUFDO0FBR3BFLE9BQU8sRUFBQyxhQUFhLEVBQUUsV0FBVyxFQUFFLGtCQUFrQixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDOUUsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGlCQUFpQixDQUFDO0FBRTlDLE9BQU8sRUFBQyxrQkFBa0IsRUFBRSxrQkFBa0IsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLFVBQVUsQ0FBQztBQUNyRixPQUFPLEVBQ0wsa0NBQWtDLEVBRWxDLDRCQUE0QixFQUM1QiwwQkFBMEIsR0FDM0IsTUFBTSwyQkFBMkIsQ0FBQztBQUNuQyxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDbkQsT0FBTyxFQUFDLDBCQUEwQixFQUFFLDBCQUEwQixFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQ25GLE9BQU8sRUFBQyxhQUFhLEVBQUUsY0FBYyxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBQ3ZELE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUc5QyxPQUFPLEVBQ0wsU0FBUyxFQUNULGtCQUFrQixHQUtuQixNQUFNLHVCQUF1QixDQUFDO0FBVS9CLE9BQU8sRUFBQyxjQUFjLEVBQUUsZUFBZSxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFD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QztBQUN2QixDQUFDO0FBRUQsOEVBQThFO0FBQzlFLFNBQVMsaUJBQWlCLENBQUMsS0FBWTtJQUNyQyxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDM0IsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztJQUU3QixvREFBb0Q7SUFDcEQsSUFBSSxTQUFTLCtCQUF1QixFQUFFLENBQUM7UUFDckMsU0FBUyxJQUFJLGFBQWEsQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLGtEQUFrRCxDQUFDLENBQUM7UUFDaEcsT0FBTyxLQUFLLENBQUMsU0FBa0MsQ0FBQztJQUNsRCxDQUFDO1NBQU0sSUFBSSxTQUFTLGdDQUF3QixFQUFFLENBQUM7UUFDN0Msc0ZBQXNGO1FBQ3RGLDBFQUEwRTtRQUMxRSxPQUFPLEtBQUssQ0FBQyxNQUFNLENBQWlCLENBQUM7SUFDdkMsQ0FBQztJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2lzRm9yd2FyZFJlZiwgcmVzb2x2ZUZvcndhcmRSZWZ9IGZyb20gJy4uL2RpL2ZvcndhcmRfcmVmJztcbmltcG9ydCB7aW5qZWN0Um9vdExpbXBNb2RlLCBzZXRJbmplY3RJbXBsZW1lbnRhdGlvbn0gZnJvbSAnLi4vZGkvaW5qZWN0X3N3aXRjaCc7XG5pbXBvcnQge0luamVjdG9yfSBmcm9tICcuLi9kaS9pbmplY3Rvcic7XG5pbXBvcnQge2NvbnZlcnRUb0JpdEZsYWdzfSBmcm9tICcuLi9kaS9pbmplY3Rvcl9jb21wYXRpYmlsaXR5JztcbmltcG9ydCB7SW5qZWN0b3JNYXJrZXJzfSBmcm9tICcuLi9kaS9pbmplY3Rvcl9tYXJrZXInO1xuaW1wb3J0IHtJbmplY3RGbGFncywgSW5qZWN0T3B0aW9uc30gZnJvbSAnLi4vZGkvaW50ZXJmYWNlL2luamVjdG9yJztcbmltcG9ydCB7UHJvdmlkZXJUb2tlbn0gZnJvbSAnLi4vZGkvcHJvdmlkZXJfdG9rZW4nO1xuaW1wb3J0IHtUeXBlfSBmcm9tICcuLi9pbnRlcmZhY2UvdHlwZSc7XG5pbXBvcnQge2Fzc2VydERlZmluZWQsIGFzc2VydEVxdWFsLCBhc3NlcnRJbmRleEluUmFuZ2V9IGZyb20gJy4uL3V0aWwvYXNzZXJ0JztcbmltcG9ydCB7bm9TaWRlRWZmZWN0c30gZnJvbSAnLi4vdXRpbC9jbG9zdXJlJztcblxuaW1wb3J0IHthc3NlcnREaXJlY3RpdmVEZWYsIGFzc2VydE5vZGVJbmplY3RvciwgYXNzZXJ0VE5vZGVGb3JMVmlld30gZnJvbSAnLi9hc3NlcnQnO1xuaW1wb3J0IHtcbiAgZW1pdEluc3RhbmNlQ3JlYXRlZEJ5SW5qZWN0b3JFdmVudCxcbiAgSW5qZWN0b3JQcm9maWxlckNvbnRleHQsXG4gIHJ1bkluSW5qZWN0b3JQcm9maWxlckNvbnRleHQsXG4gIHNldEluamVjdG9yUHJvZmlsZXJDb250ZXh0LFxufSBmcm9tICcuL2RlYnVnL2luamVjdG9yX3Byb2ZpbGVyJztcbmltcG9ydCB7Z2V0RmFjdG9yeURlZn0gZnJvbSAnLi9kZWZpbml0aW9uX2ZhY3RvcnknO1xuaW1wb3J0IHt0aHJvd0N5Y2xpY0RlcGVuZGVuY3lFcnJvciwgdGhyb3dQcm92aWRlck5vdEZvdW5kRXJyb3J9IGZyb20gJy4vZXJyb3JzX2RpJztcbmltcG9ydCB7TkdfRUxFTUVOVF9JRCwgTkdfRkFDVE9SWV9ERUZ9IGZyb20gJy4vZmllbGRzJztcbmltcG9ydCB7cmVnaXN0ZXJQcmVPcmRlckhvb2tzfSBmcm9tICcuL2hvb2tzJztcbmltcG9ydCB7QXR0cmlidXRlTWFya2VyfSBmcm9tICcuL2ludGVyZmFjZXMvYXR0cmlidXRlX21hcmtlcic7XG5pbXBvcnQge0NvbXBvbmVudERlZiwgRGlyZWN0aXZlRGVmfSBmcm9tICcuL2ludGVyZmFjZXMvZGVmaW5pdGlvbic7XG5pbXBvcnQge1xuICBpc0ZhY3RvcnksXG4gIE5PX1BBUkVOVF9JTkpFQ1RPUixcbiAgTm9kZUluamVjdG9yRmFjdG9yeSxcbiAgTm9kZUluamVjdG9yT2Zmc2V0LFxuICBSZWxhdGl2ZUluamVjdG9yTG9jYXRpb24sXG4gIFJlbGF0aXZlSW5qZWN0b3JMb2NhdGlvbkZsYWdzLFxufSBmcm9tICcuL2ludGVyZmFjZXMvaW5qZWN0b3InO1xuaW1wb3J0IHtcbiAgVENvbnRhaW5lck5vZGUsXG4gIFREaXJlY3RpdmVIb3N0Tm9kZSxcbiAgVEVsZW1lbnRDb250YWluZXJOb2RlLFxuICBURWxlbWVudE5vZGUsXG4gIFROb2RlLFxuICBUTm9kZVByb3ZpZGVySW5kZXhlcyxcbiAgVE5vZGVUeXBlLFxufSBmcm9tICcuL2ludGVyZmFjZXMvbm9kZSc7XG5pbXBvcnQge2lzQ29tcG9uZW50RGVmLCBpc0NvbXBvbmVudEhvc3R9IGZyb20gJy4vaW50ZXJmYWNlcy90eXBlX2NoZWNrcyc7XG5pbXBvcnQge1xuICBERUNMQVJBVElPTl9DT01QT05FTlRfVklFVyxcbiAgREVDTEFSQVRJT05fVklFVyxcbiAgRU1CRURERURfVklFV19JTkpFQ1RPUixcbiAgRkxBR1MsXG4gIElOSkVDVE9SLFxuICBMVmlldyxcbiAgTFZpZXdGbGFncyxcbiAgVF9IT1NULFxuICBURGF0YSxcbiAgVFZJRVcsXG4gIFRWaWV3LFxuICBUVmlld1R5cGUsXG59IGZyb20gJy4vaW50ZXJmYWNlcy92aWV3JztcbmltcG9ydCB7YXNzZXJ0VE5vZGVUeXBlfSBmcm9tICcuL25vZGVfYXNzZXJ0JztcbmltcG9ydCB7ZW50ZXJESSwgZ2V0Q3VycmVudFROb2RlLCBnZXRMVmlldywgbGVhdmVESX0gZnJvbSAnLi9zdGF0ZSc7XG5pbXBvcnQge2lzTmFtZU9ubHlBdHRyaWJ1dGVNYXJrZXJ9IGZyb20gJy4vdXRpbC9hdHRyc191dGlscyc7XG5pbXBvcnQge1xuICBnZXRQYXJlbnRJbmplY3RvckluZGV4LFxuICBnZXRQYXJlbnRJbmplY3RvclZpZXcsXG4gIGhhc1BhcmVudEluamVjdG9yLFxufSBmcm9tICcuL3V0aWwvaW5qZWN0b3JfdXRpbHMnO1xuaW1wb3J0IHtzdHJpbmdpZnlGb3JFcnJvcn0gZnJvbSAnLi91dGlsL3N0cmluZ2lmeV91dGlscyc7XG5cbi8qKlxuICogRGVmaW5lcyBpZiB0aGUgY2FsbCB0byBgaW5qZWN0YCBzaG91bGQgaW5jbHVkZSBgdmlld1Byb3ZpZGVyc2AgaW4gaXRzIHJlc29sdXRpb24uXG4gKlxuICogVGhpcyBpcyBzZXQgdG8gdHJ1ZSB3aGVuIHdlIHRyeSB0byBpbnN0YW50aWF0ZSBhIGNvbXBvbmVudC4gVGhpcyB2YWx1ZSBpcyByZXNldCBpblxuICogYGdldE5vZGVJbmplY3RhYmxlYCB0byBhIHZhbHVlIHdoaWNoIG1hdGNoZXMgdGhlIGRlY2xhcmF0aW9uIGxvY2F0aW9uIG9mIHRoZSB0b2tlbiBhYm91dCB0byBiZVxuICogaW5zdGFudGlhdGVkLiBUaGlzIGlzIGRvbmUgc28gdGhhdCBpZiB3ZSBhcmUgaW5qZWN0aW5nIGEgdG9rZW4gd2hpY2ggd2FzIGRlY2xhcmVkIG91dHNpZGUgb2ZcbiAqIGB2aWV3UHJvdmlkZXJzYCB3ZSBkb24ndCBhY2NpZGVudGFsbHkgcHVsbCBgdmlld1Byb3ZpZGVyc2AgaW4uXG4gKlxuICogRXhhbXBsZTpcbiAqXG4gKiBgYGBcbiAqIEBJbmplY3RhYmxlKClcbiAqIGNsYXNzIE15U2VydmljZSB7XG4gKiAgIGNvbnN0cnVjdG9yKHB1YmxpYyB2YWx1ZTogU3RyaW5nKSB7fVxuICogfVxuICpcbiAqIEBDb21wb25lbnQoe1xuICogICBwcm92aWRlcnM6IFtcbiAqICAgICBNeVNlcnZpY2UsXG4gKiAgICAge3Byb3ZpZGU6IFN0cmluZywgdmFsdWU6ICdwcm92aWRlcnMnIH1cbiAqICAgXVxuICogICB2aWV3UHJvdmlkZXJzOiBbXG4gKiAgICAge3Byb3ZpZGU6IFN0cmluZywgdmFsdWU6ICd2aWV3UHJvdmlkZXJzJ31cbiAqICAgXVxuICogfSlcbiAqIGNsYXNzIE15Q29tcG9uZW50IHtcbiAqICAgY29uc3RydWN0b3IobXlTZXJ2aWNlOiBNeVNlcnZpY2UsIHZhbHVlOiBTdHJpbmcpIHtcbiAqICAgICAvLyBXZSBleHBlY3QgdGhhdCBDb21wb25lbnQgY2FuIHNlZSBpbnRvIGB2aWV3UHJvdmlkZXJzYC5cbiAqICAgICBleHBlY3QodmFsdWUpLnRvRXF1YWwoJ3ZpZXdQcm92aWRlcnMnKTtcbiAqICAgICAvLyBgTXlTZXJ2aWNlYCB3YXMgbm90IGRlY2xhcmVkIGluIGB2aWV3UHJvdmlkZXJzYCBoZW5jZSBpdCBjYW4ndCBzZWUgaXQuXG4gKiAgICAgZXhwZWN0KG15U2VydmljZS52YWx1ZSkudG9FcXVhbCgncHJvdmlkZXJzJyk7XG4gKiAgIH1cbiAqIH1cbiAqXG4gKiBgYGBcbiAqL1xubGV0IGluY2x1ZGVWaWV3UHJvdmlkZXJzID0gdHJ1ZTtcblxuZXhwb3J0IGZ1bmN0aW9uIHNldEluY2x1ZGVWaWV3UHJvdmlkZXJzKHY6IGJvb2xlYW4pOiBib29sZWFuIHtcbiAgY29uc3Qgb2xkVmFsdWUgPSBpbmNsdWRlVmlld1Byb3ZpZGVycztcbiAgaW5jbHVkZVZpZXdQcm92aWRlcnMgPSB2O1xuICByZXR1cm4gb2xkVmFsdWU7XG59XG5cbi8qKlxuICogVGhlIG51bWJlciBvZiBzbG90cyBpbiBlYWNoIGJsb29tIGZpbHRlciAodXNlZCBieSBESSkuIFRoZSBsYXJnZXIgdGhpcyBudW1iZXIsIHRoZSBmZXdlclxuICogZGlyZWN0aXZlcyB0aGF0IHdpbGwgc2hhcmUgc2xvdHMsIGFuZCB0aHVzLCB0aGUgZmV3ZXIgZmFsc2UgcG9zaXRpdmVzIHdoZW4gY2hlY2tpbmcgZm9yXG4gKiB0aGUgZXhpc3RlbmNlIG9mIGEgZGlyZWN0aXZlLlxuICovXG5jb25zdCBCTE9PTV9TSVpFID0gMjU2O1xuY29uc3QgQkxPT01fTUFTSyA9IEJMT09NX1NJWkUgLSAxO1xuXG4vKipcbiAqIFRoZSBudW1iZXIgb2YgYml0cyB0aGF0IGlzIHJlcHJlc2VudGVkIGJ5IGEgc2luZ2xlIGJsb29tIGJ1Y2tldC4gSlMgYml0IG9wZXJhdGlvbnMgYXJlIDMyIGJpdHMsXG4gKiBzbyBlYWNoIGJ1Y2tldCByZXByZXNlbnRzIDMyIGRpc3RpbmN0IHRva2VucyB3aGljaCBhY2NvdW50cyBmb3IgbG9nMigzMikgPSA1IGJpdHMgb2YgYSBibG9vbSBoYXNoXG4gKiBudW1iZXIuXG4gKi9cbmNvbnN0IEJMT09NX0JVQ0tFVF9CSVRTID0gNTtcblxuLyoqIENvdW50ZXIgdXNlZCB0byBnZW5lcmF0ZSB1bmlxdWUgSURzIGZvciBkaXJlY3RpdmVzLiAqL1xubGV0IG5leHROZ0VsZW1lbnRJZCA9IDA7XG5cbi8qKiBWYWx1ZSB1c2VkIHdoZW4gc29tZXRoaW5nIHdhc24ndCBmb3VuZCBieSBhbiBpbmplY3Rvci4gKi9cbmNvbnN0IE5PVF9GT1VORCA9IHt9O1xuXG4vKipcbiAqIFJlZ2lzdGVycyB0aGlzIGRpcmVjdGl2ZSBhcyBwcmVzZW50IGluIGl0cyBub2RlJ3MgaW5qZWN0b3IgYnkgZmxpcHBpbmcgdGhlIGRpcmVjdGl2ZSdzXG4gKiBjb3JyZXNwb25kaW5nIGJpdCBpbiB0aGUgaW5qZWN0b3IncyBibG9vbSBmaWx0ZXIuXG4gKlxuICogQHBhcmFtIGluamVjdG9ySW5kZXggVGhlIGluZGV4IG9mIHRoZSBub2RlIGluamVjdG9yIHdoZXJlIHRoaXMgdG9rZW4gc2hvdWxkIGJlIHJlZ2lzdGVyZWRcbiAqIEBwYXJhbSB0VmlldyBUaGUgVFZpZXcgZm9yIHRoZSBpbmplY3RvcidzIGJsb29tIGZpbHRlcnNcbiAqIEBwYXJhbSB0eXBlIFRoZSBkaXJlY3RpdmUgdG9rZW4gdG8gcmVnaXN0ZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJsb29tQWRkKFxuICBpbmplY3RvckluZGV4OiBudW1iZXIsXG4gIHRWaWV3OiBUVmlldyxcbiAgdHlwZTogUHJvdmlkZXJUb2tlbjxhbnk+IHwgc3RyaW5nLFxuKTogdm9pZCB7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnRFcXVhbCh0Vmlldy5maXJzdENyZWF0ZVBhc3MsIHRydWUsICdleHBlY3RlZCBmaXJzdENyZWF0ZVBhc3MgdG8gYmUgdHJ1ZScpO1xuICBsZXQgaWQ6IG51bWJlciB8IHVuZGVmaW5lZDtcbiAgaWYgKHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJykge1xuICAgIGlkID0gdHlwZS5jaGFyQ29kZUF0KDApIHx8IDA7XG4gIH0gZWxzZSBpZiAodHlwZS5oYXNPd25Qcm9wZXJ0eShOR19FTEVNRU5UX0lEKSkge1xuICAgIGlkID0gKHR5cGUgYXMgYW55KVtOR19FTEVNRU5UX0lEXTtcbiAgfVxuXG4gIC8vIFNldCBhIHVuaXF1ZSBJRCBvbiB0aGUgZGlyZWN0aXZlIHR5cGUsIHNvIGlmIHNvbWV0aGluZyB0cmllcyB0byBpbmplY3QgdGhlIGRpcmVjdGl2ZSxcbiAgLy8gd2UgY2FuIGVhc2lseSByZXRyaWV2ZSB0aGUgSUQgYW5kIGhhc2ggaXQgaW50byB0aGUgYmxvb20gYml0IHRoYXQgc2hvdWxkIGJlIGNoZWNrZWQuXG4gIGlmIChpZCA9PSBudWxsKSB7XG4gICAgaWQgPSAodHlwZSBhcyBhbnkpW05HX0VMRU1FTlRfSURdID0gbmV4dE5nRWxlbWVudElkKys7XG4gIH1cblxuICAvLyBXZSBvbmx5IGhhdmUgQkxPT01fU0laRSAoMjU2KSBzbG90cyBpbiBvdXIgYmxvb20gZmlsdGVyICg4IGJ1Y2tldHMgKiAzMiBiaXRzIGVhY2gpLFxuICAvLyBzbyBhbGwgdW5pcXVlIElEcyBtdXN0IGJlIG1vZHVsby1lZCBpbnRvIGEgbnVtYmVyIGZyb20gMCAtIDI1NSB0byBmaXQgaW50byB0aGUgZmlsdGVyLlxuICBjb25zdCBibG9vbUhhc2ggPSBpZCAmIEJMT09NX01BU0s7XG5cbiAgLy8gQ3JlYXRlIGEgbWFzayB0aGF0IHRhcmdldHMgdGhlIHNwZWNpZmljIGJpdCBhc3NvY2lhdGVkIHdpdGggdGhlIGRpcmVjdGl2ZS5cbiAgLy8gSlMgYml0IG9wZXJhdGlvbnMgYXJlIDMyIGJpdHMsIHNvIHRoaXMgd2lsbCBiZSBhIG51bWJlciBiZXR3ZWVuIDJeMCBhbmQgMl4zMSwgY29ycmVzcG9uZGluZ1xuICAvLyB0byBiaXQgcG9zaXRpb25zIDAgLSAzMSBpbiBhIDMyIGJpdCBpbnRlZ2VyLlxuICBjb25zdCBtYXNrID0gMSA8PCBibG9vbUhhc2g7XG5cbiAgLy8gRWFjaCBibG9vbSBidWNrZXQgaW4gYHREYXRhYCByZXByZXNlbnRzIGBCTE9PTV9CVUNLRVRfQklUU2AgbnVtYmVyIG9mIGJpdHMgb2YgYGJsb29tSGFzaGAuXG4gIC8vIEFueSBiaXRzIGluIGBibG9vbUhhc2hgIGJleW9uZCBgQkxPT01fQlVDS0VUX0JJVFNgIGluZGljYXRlIHRoZSBidWNrZXQgb2Zmc2V0IHRoYXQgdGhlIG1hc2tcbiAgLy8gc2hvdWxkIGJlIHdyaXR0ZW4gdG8uXG4gICh0Vmlldy5kYXRhIGFzIG51bWJlcltdKVtpbmplY3RvckluZGV4ICsgKGJsb29tSGFzaCA+PiBCTE9PTV9CVUNLRVRfQklUUyldIHw9IG1hc2s7XG59XG5cbi8qKlxuICogQ3JlYXRlcyAob3IgZ2V0cyBhbiBleGlzdGluZykgaW5qZWN0b3IgZm9yIGEgZ2l2ZW4gZWxlbWVudCBvciBjb250YWluZXIuXG4gKlxuICogQHBhcmFtIHROb2RlIGZvciB3aGljaCBhbiBpbmplY3RvciBzaG91bGQgYmUgcmV0cmlldmVkIC8gY3JlYXRlZC5cbiAqIEBwYXJhbSBsVmlldyBWaWV3IHdoZXJlIHRoZSBub2RlIGlzIHN0b3JlZFxuICogQHJldHVybnMgTm9kZSBpbmplY3RvclxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0T3JDcmVhdGVOb2RlSW5qZWN0b3JGb3JOb2RlKFxuICB0Tm9kZTogVEVsZW1lbnROb2RlIHwgVENvbnRhaW5lck5vZGUgfCBURWxlbWVudENvbnRhaW5lck5vZGUsXG4gIGxWaWV3OiBMVmlldyxcbik6IG51bWJlciB7XG4gIGNvbnN0IGV4aXN0aW5nSW5qZWN0b3JJbmRleCA9IGdldEluamVjdG9ySW5kZXgodE5vZGUsIGxWaWV3KTtcbiAgaWYgKGV4aXN0aW5nSW5qZWN0b3JJbmRleCAhPT0gLTEpIHtcbiAgICByZXR1cm4gZXhpc3RpbmdJbmplY3RvckluZGV4O1xuICB9XG5cbiAgY29uc3QgdFZpZXcgPSBsVmlld1tUVklFV107XG4gIGlmICh0Vmlldy5maXJzdENyZWF0ZVBhc3MpIHtcbiAgICB0Tm9kZS5pbmplY3RvckluZGV4ID0gbFZpZXcubGVuZ3RoO1xuICAgIGluc2VydEJsb29tKHRWaWV3LmRhdGEsIHROb2RlKTsgLy8gZm91bmRhdGlvbiBmb3Igbm9kZSBibG9vbVxuICAgIGluc2VydEJsb29tKGxWaWV3LCBudWxsKTsgLy8gZm91bmRhdGlvbiBmb3IgY3VtdWxhdGl2ZSBibG9vbVxuICAgIGluc2VydEJsb29tKHRWaWV3LmJsdWVwcmludCwgbnVsbCk7XG4gIH1cblxuICBjb25zdCBwYXJlbnRMb2MgPSBnZXRQYXJlbnRJbmplY3RvckxvY2F0aW9uKHROb2RlLCBsVmlldyk7XG4gIGNvbnN0IGluamVjdG9ySW5kZXggPSB0Tm9kZS5pbmplY3RvckluZGV4O1xuXG4gIC8vIElmIGEgcGFyZW50IGluamVjdG9yIGNhbid0IGJlIGZvdW5kLCBpdHMgbG9jYXRpb24gaXMgc2V0IHRvIC0xLlxuICAvLyBJbiB0aGF0IGNhc2UsIHdlIGRvbid0IG5lZWQgdG8gc2V0IHVwIGEgY3VtdWxhdGl2ZSBibG9vbVxuICBpZiAoaGFzUGFyZW50SW5qZWN0b3IocGFyZW50TG9jKSkge1xuICAgIGNvbnN0IHBhcmVudEluZGV4ID0gZ2V0UGFyZW50SW5qZWN0b3JJbmRleChwYXJlbnRMb2MpO1xuICAgIGNvbnN0IHBhcmVudExWaWV3ID0gZ2V0UGFyZW50SW5qZWN0b3JWaWV3KHBhcmVudExvYywgbFZpZXcpO1xuICAgIGNvbnN0IHBhcmVudERhdGEgPSBwYXJlbnRMVmlld1tUVklFV10uZGF0YSBhcyBhbnk7XG4gICAgLy8gQ3JlYXRlcyBhIGN1bXVsYXRpdmUgYmxvb20gZmlsdGVyIHRoYXQgbWVyZ2VzIHRoZSBwYXJlbnQncyBibG9vbSBmaWx0ZXJcbiAgICAvLyBhbmQgaXRzIG93biBjdW11bGF0aXZlIGJsb29tICh3aGljaCBjb250YWlucyB0b2tlbnMgZm9yIGFsbCBhbmNlc3RvcnMpXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBOb2RlSW5qZWN0b3JPZmZzZXQuQkxPT01fU0laRTsgaSsrKSB7XG4gICAgICBsVmlld1tpbmplY3RvckluZGV4ICsgaV0gPSBwYXJlbnRMVmlld1twYXJlbnRJbmRleCArIGldIHwgcGFyZW50RGF0YVtwYXJlbnRJbmRleCArIGldO1xuICAgIH1cbiAgfVxuXG4gIGxWaWV3W2luamVjdG9ySW5kZXggKyBOb2RlSW5qZWN0b3JPZmZzZXQuUEFSRU5UXSA9IHBhcmVudExvYztcbiAgcmV0dXJuIGluamVjdG9ySW5kZXg7XG59XG5cbmZ1bmN0aW9uIGluc2VydEJsb29tKGFycjogYW55W10sIGZvb3RlcjogVE5vZGUgfCBudWxsKTogdm9pZCB7XG4gIGFyci5wdXNoKDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIGZvb3Rlcik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbmplY3RvckluZGV4KHROb2RlOiBUTm9kZSwgbFZpZXc6IExWaWV3KTogbnVtYmVyIHtcbiAgaWYgKFxuICAgIHROb2RlLmluamVjdG9ySW5kZXggPT09IC0xIHx8XG4gICAgLy8gSWYgdGhlIGluamVjdG9yIGluZGV4IGlzIHRoZSBzYW1lIGFzIGl0cyBwYXJlbnQncyBpbmplY3RvciBpbmRleCwgdGhlbiB0aGUgaW5kZXggaGFzIGJlZW5cbiAgICAvLyBjb3BpZWQgZG93biBmcm9tIHRoZSBwYXJlbnQgbm9kZS4gTm8gaW5qZWN0b3IgaGFzIGJlZW4gY3JlYXRlZCB5ZXQgb24gdGhpcyBub2RlLlxuICAgICh0Tm9kZS5wYXJlbnQgJiYgdE5vZGUucGFyZW50LmluamVjdG9ySW5kZXggPT09IHROb2RlLmluamVjdG9ySW5kZXgpIHx8XG4gICAgLy8gQWZ0ZXIgdGhlIGZpcnN0IHRlbXBsYXRlIHBhc3MsIHRoZSBpbmplY3RvciBpbmRleCBtaWdodCBleGlzdCBidXQgdGhlIHBhcmVudCB2YWx1ZXNcbiAgICAvLyBtaWdodCBub3QgaGF2ZSBiZWVuIGNhbGN1bGF0ZWQgeWV0IGZvciB0aGlzIGluc3RhbmNlXG4gICAgbFZpZXdbdE5vZGUuaW5qZWN0b3JJbmRleCArIE5vZGVJbmplY3Rvck9mZnNldC5QQVJFTlRdID09PSBudWxsXG4gICkge1xuICAgIHJldHVybiAtMTtcbiAgfSBlbHNlIHtcbiAgICBuZ0Rldk1vZGUgJiYgYXNzZXJ0SW5kZXhJblJhbmdlKGxWaWV3LCB0Tm9kZS5pbmplY3RvckluZGV4KTtcbiAgICByZXR1cm4gdE5vZGUuaW5qZWN0b3JJbmRleDtcbiAgfVxufVxuXG4vKipcbiAqIEZpbmRzIHRoZSBpbmRleCBvZiB0aGUgcGFyZW50IGluamVjdG9yLCB3aXRoIGEgdmlldyBvZmZzZXQgaWYgYXBwbGljYWJsZS4gVXNlZCB0byBzZXQgdGhlXG4gKiBwYXJlbnQgaW5qZWN0b3IgaW5pdGlhbGx5LlxuICpcbiAqIEByZXR1cm5zIFJldHVybnMgYSBudW1iZXIgdGhhdCBpcyB0aGUgY29tYmluYXRpb24gb2YgdGhlIG51bWJlciBvZiBMVmlld3MgdGhhdCB3ZSBoYXZlIHRvIGdvIHVwXG4gKiB0byBmaW5kIHRoZSBMVmlldyBjb250YWluaW5nIHRoZSBwYXJlbnQgaW5qZWN0IEFORCB0aGUgaW5kZXggb2YgdGhlIGluamVjdG9yIHdpdGhpbiB0aGF0IExWaWV3LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0UGFyZW50SW5qZWN0b3JMb2NhdGlvbih0Tm9kZTogVE5vZGUsIGxWaWV3OiBMVmlldyk6IFJlbGF0aXZlSW5qZWN0b3JMb2NhdGlvbiB7XG4gIGlmICh0Tm9kZS5wYXJlbnQgJiYgdE5vZGUucGFyZW50LmluamVjdG9ySW5kZXggIT09IC0xKSB7XG4gICAgLy8gSWYgd2UgaGF2ZSBhIHBhcmVudCBgVE5vZGVgIGFuZCB0aGVyZSBpcyBhbiBpbmplY3RvciBhc3NvY2lhdGVkIHdpdGggaXQgd2UgYXJlIGRvbmUsIGJlY2F1c2VcbiAgICAvLyB0aGUgcGFyZW50IGluamVjdG9yIGlzIHdpdGhpbiB0aGUgY3VycmVudCBgTFZpZXdgLlxuICAgIHJldHVybiB0Tm9kZS5wYXJlbnQuaW5qZWN0b3JJbmRleCBhcyBSZWxhdGl2ZUluamVjdG9yTG9jYXRpb247IC8vIFZpZXdPZmZzZXQgaXMgMFxuICB9XG5cbiAgLy8gV2hlbiBwYXJlbnQgaW5qZWN0b3IgbG9jYXRpb24gaXMgY29tcHV0ZWQgaXQgbWF5IGJlIG91dHNpZGUgb2YgdGhlIGN1cnJlbnQgdmlldy4gKGllIGl0IGNvdWxkXG4gIC8vIGJlIHBvaW50aW5nIHRvIGEgZGVjbGFyZWQgcGFyZW50IGxvY2F0aW9uKS4gVGhpcyB2YXJpYWJsZSBzdG9yZXMgbnVtYmVyIG9mIGRlY2xhcmF0aW9uIHBhcmVudHNcbiAgLy8gd2UgbmVlZCB0byB3YWxrIHVwIGluIG9yZGVyIHRvIGZpbmQgdGhlIHBhcmVudCBpbmplY3RvciBsb2NhdGlvbi5cbiAgbGV0IGRlY2xhcmF0aW9uVmlld09mZnNldCA9IDA7XG4gIGxldCBwYXJlbnRUTm9kZTogVE5vZGUgfCBudWxsID0gbnVsbDtcbiAgbGV0IGxWaWV3Q3Vyc29yOiBMVmlldyB8IG51bGwgPSBsVmlldztcblxuICAvLyBUaGUgcGFyZW50IGluamVjdG9yIGlzIG5vdCBpbiB0aGUgY3VycmVudCBgTFZpZXdgLiBXZSB3aWxsIGhhdmUgdG8gd2FsayB0aGUgZGVjbGFyZWQgcGFyZW50XG4gIC8vIGBMVmlld2AgaGllcmFyY2h5IGFuZCBsb29rIGZvciBpdC4gSWYgd2Ugd2FsayBvZiB0aGUgdG9wLCB0aGF0IG1lYW5zIHRoYXQgdGhlcmUgaXMgbm8gcGFyZW50XG4gIC8vIGBOb2RlSW5qZWN0b3JgLlxuICB3aGlsZSAobFZpZXdDdXJzb3IgIT09IG51bGwpIHtcbiAgICBwYXJlbnRUTm9kZSA9IGdldFROb2RlRnJvbUxWaWV3KGxWaWV3Q3Vyc29yKTtcblxuICAgIGlmIChwYXJlbnRUTm9kZSA9PT0gbnVsbCkge1xuICAgICAgLy8gSWYgd2UgaGF2ZSBubyBwYXJlbnQsIHRoYW4gd2UgYXJlIGRvbmUuXG4gICAgICByZXR1cm4gTk9fUEFSRU5UX0lOSkVDVE9SO1xuICAgIH1cblxuICAgIG5nRGV2TW9kZSAmJiBwYXJlbnRUTm9kZSAmJiBhc3NlcnRUTm9kZUZvckxWaWV3KHBhcmVudFROb2RlISwgbFZpZXdDdXJzb3JbREVDTEFSQVRJT05fVklFV10hKTtcbiAgICAvLyBFdmVyeSBpdGVyYXRpb24gb2YgdGhlIGxvb3AgcmVxdWlyZXMgdGhhdCB3ZSBnbyB0byB0aGUgZGVjbGFyZWQgcGFyZW50LlxuICAgIGRlY2xhcmF0aW9uVmlld09mZnNldCsrO1xuICAgIGxWaWV3Q3Vyc29yID0gbFZpZXdDdXJzb3JbREVDTEFSQVRJT05fVklFV107XG5cbiAgICBpZiAocGFyZW50VE5vZGUuaW5qZWN0b3JJbmRleCAhPT0gLTEpIHtcbiAgICAgIC8vIFdlIGZvdW5kIGEgTm9kZUluamVjdG9yIHdoaWNoIHBvaW50cyB0byBzb21ldGhpbmcuXG4gICAgICByZXR1cm4gKHBhcmVudFROb2RlLmluamVjdG9ySW5kZXggfFxuICAgICAgICAoZGVjbGFyYXRpb25WaWV3T2Zmc2V0IDw8XG4gICAgICAgICAgUmVsYXRpdmVJbmplY3RvckxvY2F0aW9uRmxhZ3MuVmlld09mZnNldFNoaWZ0KSkgYXMgUmVsYXRpdmVJbmplY3RvckxvY2F0aW9uO1xuICAgIH1cbiAgfVxuICByZXR1cm4gTk9fUEFSRU5UX0lOSkVDVE9SO1xufVxuLyoqXG4gKiBNYWtlcyBhIHR5cGUgb3IgYW4gaW5qZWN0aW9uIHRva2VuIHB1YmxpYyB0byB0aGUgREkgc3lzdGVtIGJ5IGFkZGluZyBpdCB0byBhblxuICogaW5qZWN0b3IncyBibG9vbSBmaWx0ZXIuXG4gKlxuICogQHBhcmFtIGRpIFRoZSBub2RlIGluamVjdG9yIGluIHdoaWNoIGEgZGlyZWN0aXZlIHdpbGwgYmUgYWRkZWRcbiAqIEBwYXJhbSB0b2tlbiBUaGUgdHlwZSBvciB0aGUgaW5qZWN0aW9uIHRva2VuIHRvIGJlIG1hZGUgcHVibGljXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaVB1YmxpY0luSW5qZWN0b3IoXG4gIGluamVjdG9ySW5kZXg6IG51bWJlcixcbiAgdFZpZXc6IFRWaWV3LFxuICB0b2tlbjogUHJvdmlkZXJUb2tlbjxhbnk+LFxuKTogdm9pZCB7XG4gIGJsb29tQWRkKGluamVjdG9ySW5kZXgsIHRWaWV3LCB0b2tlbik7XG59XG5cbi8qKlxuICogSW5qZWN0IHN0YXRpYyBhdHRyaWJ1dGUgdmFsdWUgaW50byBkaXJlY3RpdmUgY29uc3RydWN0b3IuXG4gKlxuICogVGhpcyBtZXRob2QgaXMgdXNlZCB3aXRoIGBmYWN0b3J5YCBmdW5jdGlvbnMgd2hpY2ggYXJlIGdlbmVyYXRlZCBhcyBwYXJ0IG9mXG4gKiBgZGVmaW5lRGlyZWN0aXZlYCBvciBgZGVmaW5lQ29tcG9uZW50YC4gVGhlIG1ldGhvZCByZXRyaWV2ZXMgdGhlIHN0YXRpYyB2YWx1ZVxuICogb2YgYW4gYXR0cmlidXRlLiAoRHluYW1pYyBhdHRyaWJ1dGVzIGFyZSBub3Qgc3VwcG9ydGVkIHNpbmNlIHRoZXkgYXJlIG5vdCByZXNvbHZlZFxuICogIGF0IHRoZSB0aW1lIG9mIGluamVjdGlvbiBhbmQgY2FuIGNoYW5nZSBvdmVyIHRpbWUuKVxuICpcbiAqICMgRXhhbXBsZVxuICogR2l2ZW46XG4gKiBgYGBcbiAqIEBDb21wb25lbnQoLi4uKVxuICogY2xhc3MgTXlDb21wb25lbnQge1xuICogICBjb25zdHJ1Y3RvcihAQXR0cmlidXRlKCd0aXRsZScpIHRpdGxlOiBzdHJpbmcpIHsgLi4uIH1cbiAqIH1cbiAqIGBgYFxuICogV2hlbiBpbnN0YW50aWF0ZWQgd2l0aFxuICogYGBgXG4gKiA8bXktY29tcG9uZW50IHRpdGxlPVwiSGVsbG9cIj48L215LWNvbXBvbmVudD5cbiAqIGBgYFxuICpcbiAqIFRoZW4gZmFjdG9yeSBtZXRob2QgZ2VuZXJhdGVkIGlzOlxuICogYGBgXG4gKiBNeUNvbXBvbmVudC7JtWNtcCA9IGRlZmluZUNvbXBvbmVudCh7XG4gKiAgIGZhY3Rvcnk6ICgpID0+IG5ldyBNeUNvbXBvbmVudChpbmplY3RBdHRyaWJ1dGUoJ3RpdGxlJykpXG4gKiAgIC4uLlxuICogfSlcbiAqIGBgYFxuICpcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluamVjdEF0dHJpYnV0ZUltcGwodE5vZGU6IFROb2RlLCBhdHRyTmFtZVRvSW5qZWN0OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgbmdEZXZNb2RlICYmIGFzc2VydFROb2RlVHlwZSh0Tm9kZSwgVE5vZGVUeXBlLkFueUNvbnRhaW5lciB8IFROb2RlVHlwZS5BbnlSTm9kZSk7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnREZWZpbmVkKHROb2RlLCAnZXhwZWN0aW5nIHROb2RlJyk7XG4gIGlmIChhdHRyTmFtZVRvSW5qZWN0ID09PSAnY2xhc3MnKSB7XG4gICAgcmV0dXJuIHROb2RlLmNsYXNzZXM7XG4gIH1cbiAgaWYgKGF0dHJOYW1lVG9JbmplY3QgPT09ICdzdHlsZScpIHtcbiAgICByZXR1cm4gdE5vZGUuc3R5bGVzO1xuICB9XG5cbiAgY29uc3QgYXR0cnMgPSB0Tm9kZS5hdHRycztcbiAgaWYgKGF0dHJzKSB7XG4gICAgY29uc3QgYXR0cnNMZW5ndGggPSBhdHRycy5sZW5ndGg7XG4gICAgbGV0IGkgPSAwO1xuICAgIHdoaWxlIChpIDwgYXR0cnNMZW5ndGgpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXR0cnNbaV07XG5cbiAgICAgIC8vIElmIHdlIGhpdCBhIGBCaW5kaW5nc2Agb3IgYFRlbXBsYXRlYCBtYXJrZXIgdGhlbiB3ZSBhcmUgZG9uZS5cbiAgICAgIGlmIChpc05hbWVPbmx5QXR0cmlidXRlTWFya2VyKHZhbHVlKSkgYnJlYWs7XG5cbiAgICAgIC8vIFNraXAgbmFtZXNwYWNlZCBhdHRyaWJ1dGVzXG4gICAgICBpZiAodmFsdWUgPT09IEF0dHJpYnV0ZU1hcmtlci5OYW1lc3BhY2VVUkkpIHtcbiAgICAgICAgLy8gd2Ugc2tpcCB0aGUgbmV4dCB0d28gdmFsdWVzXG4gICAgICAgIC8vIGFzIG5hbWVzcGFjZWQgYXR0cmlidXRlcyBsb29rcyBsaWtlXG4gICAgICAgIC8vIFsuLi4sIEF0dHJpYnV0ZU1hcmtlci5OYW1lc3BhY2VVUkksICdodHRwOi8vc29tZXVyaS5jb20vdGVzdCcsICd0ZXN0OmV4aXN0JyxcbiAgICAgICAgLy8gJ2V4aXN0VmFsdWUnLCAuLi5dXG4gICAgICAgIGkgPSBpICsgMjtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgICAvLyBTa2lwIHRvIHRoZSBmaXJzdCB2YWx1ZSBvZiB0aGUgbWFya2VkIGF0dHJpYnV0ZS5cbiAgICAgICAgaSsrO1xuICAgICAgICB3aGlsZSAoaSA8IGF0dHJzTGVuZ3RoICYmIHR5cGVvZiBhdHRyc1tpXSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBpKys7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgPT09IGF0dHJOYW1lVG9JbmplY3QpIHtcbiAgICAgICAgcmV0dXJuIGF0dHJzW2kgKyAxXSBhcyBzdHJpbmc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpID0gaSArIDI7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBub3RGb3VuZFZhbHVlT3JUaHJvdzxUPihcbiAgbm90Rm91bmRWYWx1ZTogVCB8IG51bGwsXG4gIHRva2VuOiBQcm92aWRlclRva2VuPFQ+LFxuICBmbGFnczogSW5qZWN0RmxhZ3MsXG4pOiBUIHwgbnVsbCB7XG4gIGlmIChmbGFncyAmIEluamVjdEZsYWdzLk9wdGlvbmFsIHx8IG5vdEZvdW5kVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBub3RGb3VuZFZhbHVlO1xuICB9IGVsc2Uge1xuICAgIHRocm93UHJvdmlkZXJOb3RGb3VuZEVycm9yKHRva2VuLCAnTm9kZUluamVjdG9yJyk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSB2YWx1ZSBhc3NvY2lhdGVkIHRvIHRoZSBnaXZlbiB0b2tlbiBmcm9tIHRoZSBNb2R1bGVJbmplY3RvciBvciB0aHJvd3MgZXhjZXB0aW9uXG4gKlxuICogQHBhcmFtIGxWaWV3IFRoZSBgTFZpZXdgIHRoYXQgY29udGFpbnMgdGhlIGB0Tm9kZWBcbiAqIEBwYXJhbSB0b2tlbiBUaGUgdG9rZW4gdG8gbG9vayBmb3JcbiAqIEBwYXJhbSBmbGFncyBJbmplY3Rpb24gZmxhZ3NcbiAqIEBwYXJhbSBub3RGb3VuZFZhbHVlIFRoZSB2YWx1ZSB0byByZXR1cm4gd2hlbiB0aGUgaW5qZWN0aW9uIGZsYWdzIGlzIGBJbmplY3RGbGFncy5PcHRpb25hbGBcbiAqIEByZXR1cm5zIHRoZSB2YWx1ZSBmcm9tIHRoZSBpbmplY3RvciBvciB0aHJvd3MgYW4gZXhjZXB0aW9uXG4gKi9cbmZ1bmN0aW9uIGxvb2t1cFRva2VuVXNpbmdNb2R1bGVJbmplY3RvcjxUPihcbiAgbFZpZXc6IExWaWV3LFxuICB0b2tlbjogUHJvdmlkZXJUb2tlbjxUPixcbiAgZmxhZ3M6IEluamVjdEZsYWdzLFxuICBub3RGb3VuZFZhbHVlPzogYW55LFxuKTogVCB8IG51bGwge1xuICBpZiAoZmxhZ3MgJiBJbmplY3RGbGFncy5PcHRpb25hbCAmJiBub3RGb3VuZFZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAvLyBUaGlzIG11c3QgYmUgc2V0IG9yIHRoZSBOdWxsSW5qZWN0b3Igd2lsbCB0aHJvdyBmb3Igb3B0aW9uYWwgZGVwc1xuICAgIG5vdEZvdW5kVmFsdWUgPSBudWxsO1xuICB9XG5cbiAgaWYgKChmbGFncyAmIChJbmplY3RGbGFncy5TZWxmIHwgSW5qZWN0RmxhZ3MuSG9zdCkpID09PSAwKSB7XG4gICAgY29uc3QgbW9kdWxlSW5qZWN0b3IgPSBsVmlld1tJTkpFQ1RPUl07XG4gICAgLy8gc3dpdGNoIHRvIGBpbmplY3RJbmplY3Rvck9ubHlgIGltcGxlbWVudGF0aW9uIGZvciBtb2R1bGUgaW5qZWN0b3IsIHNpbmNlIG1vZHVsZSBpbmplY3RvclxuICAgIC8vIHNob3VsZCBub3QgaGF2ZSBhY2Nlc3MgdG8gQ29tcG9uZW50L0RpcmVjdGl2ZSBESSBzY29wZSAodGhhdCBtYXkgaGFwcGVuIHRocm91Z2hcbiAgICAvLyBgZGlyZWN0aXZlSW5qZWN0YCBpbXBsZW1lbnRhdGlvbilcbiAgICBjb25zdCBwcmV2aW91c0luamVjdEltcGxlbWVudGF0aW9uID0gc2V0SW5qZWN0SW1wbGVtZW50YXRpb24odW5kZWZpbmVkKTtcbiAgICB0cnkge1xuICAgICAgaWYgKG1vZHVsZUluamVjdG9yKSB7XG4gICAgICAgIHJldHVybiBtb2R1bGVJbmplY3Rvci5nZXQodG9rZW4sIG5vdEZvdW5kVmFsdWUsIGZsYWdzICYgSW5qZWN0RmxhZ3MuT3B0aW9uYWwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGluamVjdFJvb3RMaW1wTW9kZSh0b2tlbiwgbm90Rm91bmRWYWx1ZSwgZmxhZ3MgJiBJbmplY3RGbGFncy5PcHRpb25hbCk7XG4gICAgICB9XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldEluamVjdEltcGxlbWVudGF0aW9uKHByZXZpb3VzSW5qZWN0SW1wbGVtZW50YXRpb24pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbm90Rm91bmRWYWx1ZU9yVGhyb3c8VD4obm90Rm91bmRWYWx1ZSwgdG9rZW4sIGZsYWdzKTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSB2YWx1ZSBhc3NvY2lhdGVkIHRvIHRoZSBnaXZlbiB0b2tlbiBmcm9tIHRoZSBOb2RlSW5qZWN0b3JzID0+IE1vZHVsZUluamVjdG9yLlxuICpcbiAqIExvb2sgZm9yIHRoZSBpbmplY3RvciBwcm92aWRpbmcgdGhlIHRva2VuIGJ5IHdhbGtpbmcgdXAgdGhlIG5vZGUgaW5qZWN0b3IgdHJlZSBhbmQgdGhlblxuICogdGhlIG1vZHVsZSBpbmplY3RvciB0cmVlLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gcGF0Y2hlcyBgdG9rZW5gIHdpdGggYF9fTkdfRUxFTUVOVF9JRF9fYCB3aGljaCBjb250YWlucyB0aGUgaWQgZm9yIHRoZSBibG9vbVxuICogZmlsdGVyLiBgLTFgIGlzIHJlc2VydmVkIGZvciBpbmplY3RpbmcgYEluamVjdG9yYCAoaW1wbGVtZW50ZWQgYnkgYE5vZGVJbmplY3RvcmApXG4gKlxuICogQHBhcmFtIHROb2RlIFRoZSBOb2RlIHdoZXJlIHRoZSBzZWFyY2ggZm9yIHRoZSBpbmplY3RvciBzaG91bGQgc3RhcnRcbiAqIEBwYXJhbSBsVmlldyBUaGUgYExWaWV3YCB0aGF0IGNvbnRhaW5zIHRoZSBgdE5vZGVgXG4gKiBAcGFyYW0gdG9rZW4gVGhlIHRva2VuIHRvIGxvb2sgZm9yXG4gKiBAcGFyYW0gZmxhZ3MgSW5qZWN0aW9uIGZsYWdzXG4gKiBAcGFyYW0gbm90Rm91bmRWYWx1ZSBUaGUgdmFsdWUgdG8gcmV0dXJuIHdoZW4gdGhlIGluamVjdGlvbiBmbGFncyBpcyBgSW5qZWN0RmxhZ3MuT3B0aW9uYWxgXG4gKiBAcmV0dXJucyB0aGUgdmFsdWUgZnJvbSB0aGUgaW5qZWN0b3IsIGBudWxsYCB3aGVuIG5vdCBmb3VuZCwgb3IgYG5vdEZvdW5kVmFsdWVgIGlmIHByb3ZpZGVkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRPckNyZWF0ZUluamVjdGFibGU8VD4oXG4gIHROb2RlOiBURGlyZWN0aXZlSG9zdE5vZGUgfCBudWxsLFxuICBsVmlldzogTFZpZXcsXG4gIHRva2VuOiBQcm92aWRlclRva2VuPFQ+LFxuICBmbGFnczogSW5qZWN0RmxhZ3MgPSBJbmplY3RGbGFncy5EZWZhdWx0LFxuICBub3RGb3VuZFZhbHVlPzogYW55LFxuKTogVCB8IG51bGwge1xuICBpZiAodE5vZGUgIT09IG51bGwpIHtcbiAgICAvLyBJZiB0aGUgdmlldyBvciBhbnkgb2YgaXRzIGFuY2VzdG9ycyBoYXZlIGFuIGVtYmVkZGVkXG4gICAgLy8gdmlldyBpbmplY3Rvciwgd2UgaGF2ZSB0byBsb29rIGl0IHVwIHRoZXJlIGZpcnN0LlxuICAgIGlmIChcbiAgICAgIGxWaWV3W0ZMQUdTXSAmIExWaWV3RmxhZ3MuSGFzRW1iZWRkZWRWaWV3SW5qZWN0b3IgJiZcbiAgICAgIC8vIFRoZSB0b2tlbiBtdXN0IGJlIHByZXNlbnQgb24gdGhlIGN1cnJlbnQgbm9kZSBpbmplY3RvciB3aGVuIHRoZSBgU2VsZmBcbiAgICAgIC8vIGZsYWcgaXMgc2V0LCBzbyB0aGUgbG9va3VwIG9uIGVtYmVkZGVkIHZpZXcgaW5qZWN0b3IocykgY2FuIGJlIHNraXBwZWQuXG4gICAgICAhKGZsYWdzICYgSW5qZWN0RmxhZ3MuU2VsZilcbiAgICApIHtcbiAgICAgIGNvbnN0IGVtYmVkZGVkSW5qZWN0b3JWYWx1ZSA9IGxvb2t1cFRva2VuVXNpbmdFbWJlZGRlZEluamVjdG9yKFxuICAgICAgICB0Tm9kZSxcbiAgICAgICAgbFZpZXcsXG4gICAgICAgIHRva2VuLFxuICAgICAgICBmbGFncyxcbiAgICAgICAgTk9UX0ZPVU5ELFxuICAgICAgKTtcbiAgICAgIGlmIChlbWJlZGRlZEluamVjdG9yVmFsdWUgIT09IE5PVF9GT1VORCkge1xuICAgICAgICByZXR1cm4gZW1iZWRkZWRJbmplY3RvclZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE90aGVyd2lzZSB0cnkgdGhlIG5vZGUgaW5qZWN0b3IuXG4gICAgY29uc3QgdmFsdWUgPSBsb29rdXBUb2tlblVzaW5nTm9kZUluamVjdG9yKHROb2RlLCBsVmlldywgdG9rZW4sIGZsYWdzLCBOT1RfRk9VTkQpO1xuICAgIGlmICh2YWx1ZSAhPT0gTk9UX0ZPVU5EKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgLy8gRmluYWxseSwgZmFsbCBiYWNrIHRvIHRoZSBtb2R1bGUgaW5qZWN0b3IuXG4gIHJldHVybiBsb29rdXBUb2tlblVzaW5nTW9kdWxlSW5qZWN0b3I8VD4obFZpZXcsIHRva2VuLCBmbGFncywgbm90Rm91bmRWYWx1ZSk7XG59XG5cbi8qKlxuICogUmV0dXJucyB0aGUgdmFsdWUgYXNzb2NpYXRlZCB0byB0aGUgZ2l2ZW4gdG9rZW4gZnJvbSB0aGUgbm9kZSBpbmplY3Rvci5cbiAqXG4gKiBAcGFyYW0gdE5vZGUgVGhlIE5vZGUgd2hlcmUgdGhlIHNlYXJjaCBmb3IgdGhlIGluamVjdG9yIHNob3VsZCBzdGFydFxuICogQHBhcmFtIGxWaWV3IFRoZSBgTFZpZXdgIHRoYXQgY29udGFpbnMgdGhlIGB0Tm9kZWBcbiAqIEBwYXJhbSB0b2tlbiBUaGUgdG9rZW4gdG8gbG9vayBmb3JcbiAqIEBwYXJhbSBmbGFncyBJbmplY3Rpb24gZmxhZ3NcbiAqIEBwYXJhbSBub3RGb3VuZFZhbHVlIFRoZSB2YWx1ZSB0byByZXR1cm4gd2hlbiB0aGUgaW5qZWN0aW9uIGZsYWdzIGlzIGBJbmplY3RGbGFncy5PcHRpb25hbGBcbiAqIEByZXR1cm5zIHRoZSB2YWx1ZSBmcm9tIHRoZSBpbmplY3RvciwgYG51bGxgIHdoZW4gbm90IGZvdW5kLCBvciBgbm90Rm91bmRWYWx1ZWAgaWYgcHJvdmlkZWRcbiAqL1xuZnVuY3Rpb24gbG9va3VwVG9rZW5Vc2luZ05vZGVJbmplY3RvcjxUPihcbiAgdE5vZGU6IFREaXJlY3RpdmVIb3N0Tm9kZSxcbiAgbFZpZXc6IExWaWV3LFxuICB0b2tlbjogUHJvdmlkZXJUb2tlbjxUPixcbiAgZmxhZ3M6IEluamVjdEZsYWdzLFxuICBub3RGb3VuZFZhbHVlPzogYW55LFxuKSB7XG4gIGNvbnN0IGJsb29tSGFzaCA9IGJsb29tSGFzaEJpdE9yRmFjdG9yeSh0b2tlbik7XG4gIC8vIElmIHRoZSBJRCBzdG9yZWQgaGVyZSBpcyBhIGZ1bmN0aW9uLCB0aGlzIGlzIGEgc3BlY2lhbCBvYmplY3QgbGlrZSBFbGVtZW50UmVmIG9yIFRlbXBsYXRlUmVmXG4gIC8vIHNvIGp1c3QgY2FsbCB0aGUgZmFjdG9yeSBmdW5jdGlvbiB0byBjcmVhdGUgaXQuXG4gIGlmICh0eXBlb2YgYmxvb21IYXNoID09PSAnZnVuY3Rpb24nKSB7XG4gICAgaWYgKCFlbnRlckRJKGxWaWV3LCB0Tm9kZSwgZmxhZ3MpKSB7XG4gICAgICAvLyBGYWlsZWQgdG8gZW50ZXIgREksIHRyeSBtb2R1bGUgaW5qZWN0b3IgaW5zdGVhZC4gSWYgYSB0b2tlbiBpcyBpbmplY3RlZCB3aXRoIHRoZSBASG9zdFxuICAgICAgLy8gZmxhZywgdGhlIG1vZHVsZSBpbmplY3RvciBpcyBub3Qgc2VhcmNoZWQgZm9yIHRoYXQgdG9rZW4gaW4gSXZ5LlxuICAgICAgcmV0dXJuIGZsYWdzICYgSW5qZWN0RmxhZ3MuSG9zdFxuICAgICAgICA/IG5vdEZvdW5kVmFsdWVPclRocm93PFQ+KG5vdEZvdW5kVmFsdWUsIHRva2VuLCBmbGFncylcbiAgICAgICAgOiBsb29rdXBUb2tlblVzaW5nTW9kdWxlSW5qZWN0b3I8VD4obFZpZXcsIHRva2VuLCBmbGFncywgbm90Rm91bmRWYWx1ZSk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBsZXQgdmFsdWU6IHVua25vd247XG5cbiAgICAgIGlmIChuZ0Rldk1vZGUpIHtcbiAgICAgICAgcnVuSW5JbmplY3RvclByb2ZpbGVyQ29udGV4dChcbiAgICAgICAgICBuZXcgTm9kZUluamVjdG9yKGdldEN1cnJlbnRUTm9kZSgpIGFzIFRFbGVtZW50Tm9kZSwgZ2V0TFZpZXcoKSksXG4gICAgICAgICAgdG9rZW4gYXMgVHlwZTxUPixcbiAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICB2YWx1ZSA9IGJsb29tSGFzaChmbGFncyk7XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgIGVtaXRJbnN0YW5jZUNyZWF0ZWRCeUluamVjdG9yRXZlbnQodmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWx1ZSA9IGJsb29tSGFzaChmbGFncyk7XG4gICAgICB9XG5cbiAgICAgIGlmICh2YWx1ZSA9PSBudWxsICYmICEoZmxhZ3MgJiBJbmplY3RGbGFncy5PcHRpb25hbCkpIHtcbiAgICAgICAgdGhyb3dQcm92aWRlck5vdEZvdW5kRXJyb3IodG9rZW4pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICBsZWF2ZURJKCk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGVvZiBibG9vbUhhc2ggPT09ICdudW1iZXInKSB7XG4gICAgLy8gQSByZWZlcmVuY2UgdG8gdGhlIHByZXZpb3VzIGluamVjdG9yIFRWaWV3IHRoYXQgd2FzIGZvdW5kIHdoaWxlIGNsaW1iaW5nIHRoZSBlbGVtZW50XG4gICAgLy8gaW5qZWN0b3IgdHJlZS4gVGhpcyBpcyB1c2VkIHRvIGtub3cgaWYgdmlld1Byb3ZpZGVycyBjYW4gYmUgYWNjZXNzZWQgb24gdGhlIGN1cnJlbnRcbiAgICAvLyBpbmplY3Rvci5cbiAgICBsZXQgcHJldmlvdXNUVmlldzogVFZpZXcgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgaW5qZWN0b3JJbmRleCA9IGdldEluamVjdG9ySW5kZXgodE5vZGUsIGxWaWV3KTtcbiAgICBsZXQgcGFyZW50TG9jYXRpb24gPSBOT19QQVJFTlRfSU5KRUNUT1I7XG4gICAgbGV0IGhvc3RURWxlbWVudE5vZGU6IFROb2RlIHwgbnVsbCA9XG4gICAgICBmbGFncyAmIEluamVjdEZsYWdzLkhvc3QgPyBsVmlld1tERUNMQVJBVElPTl9DT01QT05FTlRfVklFV11bVF9IT1NUXSA6IG51bGw7XG5cbiAgICAvLyBJZiB3ZSBzaG91bGQgc2tpcCB0aGlzIGluamVjdG9yLCBvciBpZiB0aGVyZSBpcyBubyBpbmplY3RvciBvbiB0aGlzIG5vZGUsIHN0YXJ0IGJ5XG4gICAgLy8gc2VhcmNoaW5nIHRoZSBwYXJlbnQgaW5qZWN0b3IuXG4gICAgaWYgKGluamVjdG9ySW5kZXggPT09IC0xIHx8IGZsYWdzICYgSW5qZWN0RmxhZ3MuU2tpcFNlbGYpIHtcbiAgICAgIHBhcmVudExvY2F0aW9uID1cbiAgICAgICAgaW5qZWN0b3JJbmRleCA9PT0gLTFcbiAgICAgICAgICA/IGdldFBhcmVudEluamVjdG9yTG9jYXRpb24odE5vZGUsIGxWaWV3KVxuICAgICAgICAgIDogbFZpZXdbaW5qZWN0b3JJbmRleCArIE5vZGVJbmplY3Rvck9mZnNldC5QQVJFTlRdO1xuXG4gICAgICBpZiAocGFyZW50TG9jYXRpb24gPT09IE5PX1BBUkVOVF9JTkpFQ1RPUiB8fCAhc2hvdWxkU2VhcmNoUGFyZW50KGZsYWdzLCBmYWxzZSkpIHtcbiAgICAgICAgaW5qZWN0b3JJbmRleCA9IC0xO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHJldmlvdXNUVmlldyA9IGxWaWV3W1RWSUVXXTtcbiAgICAgICAgaW5qZWN0b3JJbmRleCA9IGdldFBhcmVudEluamVjdG9ySW5kZXgocGFyZW50TG9jYXRpb24pO1xuICAgICAgICBsVmlldyA9IGdldFBhcmVudEluamVjdG9yVmlldyhwYXJlbnRMb2NhdGlvbiwgbFZpZXcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFRyYXZlcnNlIHVwIHRoZSBpbmplY3RvciB0cmVlIHVudGlsIHdlIGZpbmQgYSBwb3RlbnRpYWwgbWF0Y2ggb3IgdW50aWwgd2Uga25vdyB0aGVyZVxuICAgIC8vICppc24ndCogYSBtYXRjaC5cbiAgICB3aGlsZSAoaW5qZWN0b3JJbmRleCAhPT0gLTEpIHtcbiAgICAgIG5nRGV2TW9kZSAmJiBhc3NlcnROb2RlSW5qZWN0b3IobFZpZXcsIGluamVjdG9ySW5kZXgpO1xuXG4gICAgICAvLyBDaGVjayB0aGUgY3VycmVudCBpbmplY3Rvci4gSWYgaXQgbWF0Y2hlcywgc2VlIGlmIGl0IGNvbnRhaW5zIHRva2VuLlxuICAgICAgY29uc3QgdFZpZXcgPSBsVmlld1tUVklFV107XG4gICAgICBuZ0Rldk1vZGUgJiZcbiAgICAgICAgYXNzZXJ0VE5vZGVGb3JMVmlldyh0Vmlldy5kYXRhW2luamVjdG9ySW5kZXggKyBOb2RlSW5qZWN0b3JPZmZzZXQuVE5PREVdIGFzIFROb2RlLCBsVmlldyk7XG4gICAgICBpZiAoYmxvb21IYXNUb2tlbihibG9vbUhhc2gsIGluamVjdG9ySW5kZXgsIHRWaWV3LmRhdGEpKSB7XG4gICAgICAgIC8vIEF0IHRoaXMgcG9pbnQsIHdlIGhhdmUgYW4gaW5qZWN0b3Igd2hpY2ggKm1heSogY29udGFpbiB0aGUgdG9rZW4sIHNvIHdlIHN0ZXAgdGhyb3VnaFxuICAgICAgICAvLyB0aGUgcHJvdmlkZXJzIGFuZCBkaXJlY3RpdmVzIGFzc29jaWF0ZWQgd2l0aCB0aGUgaW5qZWN0b3IncyBjb3JyZXNwb25kaW5nIG5vZGUgdG8gZ2V0XG4gICAgICAgIC8vIHRoZSBpbnN0YW5jZS5cbiAgICAgICAgY29uc3QgaW5zdGFuY2U6IFQgfCB7fSB8IG51bGwgPSBzZWFyY2hUb2tlbnNPbkluamVjdG9yPFQ+KFxuICAgICAgICAgIGluamVjdG9ySW5kZXgsXG4gICAgICAgICAgbFZpZXcsXG4gICAgICAgICAgdG9rZW4sXG4gICAgICAgICAgcHJldmlvdXNUVmlldyxcbiAgICAgICAgICBmbGFncyxcbiAgICAgICAgICBob3N0VEVsZW1lbnROb2RlLFxuICAgICAgICApO1xuICAgICAgICBpZiAoaW5zdGFuY2UgIT09IE5PVF9GT1VORCkge1xuICAgICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcGFyZW50TG9jYXRpb24gPSBsVmlld1tpbmplY3RvckluZGV4ICsgTm9kZUluamVjdG9yT2Zmc2V0LlBBUkVOVF07XG4gICAgICBpZiAoXG4gICAgICAgIHBhcmVudExvY2F0aW9uICE9PSBOT19QQVJFTlRfSU5KRUNUT1IgJiZcbiAgICAgICAgc2hvdWxkU2VhcmNoUGFyZW50KFxuICAgICAgICAgIGZsYWdzLFxuICAgICAgICAgIGxWaWV3W1RWSUVXXS5kYXRhW2luamVjdG9ySW5kZXggKyBOb2RlSW5qZWN0b3JPZmZzZXQuVE5PREVdID09PSBob3N0VEVsZW1lbnROb2RlLFxuICAgICAgICApICYmXG4gICAgICAgIGJsb29tSGFzVG9rZW4oYmxvb21IYXNoLCBpbmplY3RvckluZGV4LCBsVmlldylcbiAgICAgICkge1xuICAgICAgICAvLyBUaGUgZGVmIHdhc24ndCBmb3VuZCBhbnl3aGVyZSBvbiB0aGlzIG5vZGUsIHNvIGl0IHdhcyBhIGZhbHNlIHBvc2l0aXZlLlxuICAgICAgICAvLyBUcmF2ZXJzZSB1cCB0aGUgdHJlZSBhbmQgY29udGludWUgc2VhcmNoaW5nLlxuICAgICAgICBwcmV2aW91c1RWaWV3ID0gdFZpZXc7XG4gICAgICAgIGluamVjdG9ySW5kZXggPSBnZXRQYXJlbnRJbmplY3RvckluZGV4KHBhcmVudExvY2F0aW9uKTtcbiAgICAgICAgbFZpZXcgPSBnZXRQYXJlbnRJbmplY3RvclZpZXcocGFyZW50TG9jYXRpb24sIGxWaWV3KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIElmIHdlIHNob3VsZCBub3Qgc2VhcmNoIHBhcmVudCBPUiBJZiB0aGUgYW5jZXN0b3IgYmxvb20gZmlsdGVyIHZhbHVlIGRvZXMgbm90IGhhdmUgdGhlXG4gICAgICAgIC8vIGJpdCBjb3JyZXNwb25kaW5nIHRvIHRoZSBkaXJlY3RpdmUgd2UgY2FuIGdpdmUgdXAgb24gdHJhdmVyc2luZyB1cCB0byBmaW5kIHRoZSBzcGVjaWZpY1xuICAgICAgICAvLyBpbmplY3Rvci5cbiAgICAgICAgaW5qZWN0b3JJbmRleCA9IC0xO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBub3RGb3VuZFZhbHVlO1xufVxuXG5mdW5jdGlvbiBzZWFyY2hUb2tlbnNPbkluamVjdG9yPFQ+KFxuICBpbmplY3RvckluZGV4OiBudW1iZXIsXG4gIGxWaWV3OiBMVmlldyxcbiAgdG9rZW46IFByb3ZpZGVyVG9rZW48VD4sXG4gIHByZXZpb3VzVFZpZXc6IFRWaWV3IHwgbnVsbCxcbiAgZmxhZ3M6IEluamVjdEZsYWdzLFxuICBob3N0VEVsZW1lbnROb2RlOiBUTm9kZSB8IG51bGwsXG4pIHtcbiAgY29uc3QgY3VycmVudFRWaWV3ID0gbFZpZXdbVFZJRVddO1xuICBjb25zdCB0Tm9kZSA9IGN1cnJlbnRUVmlldy5kYXRhW2luamVjdG9ySW5kZXggKyBOb2RlSW5qZWN0b3JPZmZzZXQuVE5PREVdIGFzIFROb2RlO1xuICAvLyBGaXJzdCwgd2UgbmVlZCB0byBkZXRlcm1pbmUgaWYgdmlldyBwcm92aWRlcnMgY2FuIGJlIGFjY2Vzc2VkIGJ5IHRoZSBzdGFydGluZyBlbGVtZW50LlxuICAvLyBUaGVyZSBhcmUgdHdvIHBvc3NpYmlsaXRpZXNcbiAgY29uc3QgY2FuQWNjZXNzVmlld1Byb3ZpZGVycyA9XG4gICAgcHJldmlvdXNUVmlldyA9PSBudWxsXG4gICAgICA/IC8vIDEpIFRoaXMgaXMgdGhlIGZpcnN0IGludm9jYXRpb24gYHByZXZpb3VzVFZpZXcgPT0gbnVsbGAgd2hpY2ggbWVhbnMgdGhhdCB3ZSBhcmUgYXQgdGhlXG4gICAgICAgIC8vIGBUTm9kZWAgb2Ygd2hlcmUgaW5qZWN0b3IgaXMgc3RhcnRpbmcgdG8gbG9vay4gSW4gc3VjaCBhIGNhc2UgdGhlIG9ubHkgdGltZSB3ZSBhcmUgYWxsb3dlZFxuICAgICAgICAvLyB0byBsb29rIGludG8gdGhlIFZpZXdQcm92aWRlcnMgaXMgaWY6XG4gICAgICAgIC8vIC0gd2UgYXJlIG9uIGEgY29tcG9uZW50XG4gICAgICAgIC8vIC0gQU5EIHRoZSBpbmplY3RvciBzZXQgYGluY2x1ZGVWaWV3UHJvdmlkZXJzYCB0byB0cnVlIChpbXBseWluZyB0aGF0IHRoZSB0b2tlbiBjYW4gc2VlXG4gICAgICAgIC8vIFZpZXdQcm92aWRlcnMgYmVjYXVzZSBpdCBpcyB0aGUgQ29tcG9uZW50IG9yIGEgU2VydmljZSB3aGljaCBpdHNlbGYgd2FzIGRlY2xhcmVkIGluXG4gICAgICAgIC8vIFZpZXdQcm92aWRlcnMpXG4gICAgICAgIGlzQ29tcG9uZW50SG9zdCh0Tm9kZSkgJiYgaW5jbHVkZVZpZXdQcm92aWRlcnNcbiAgICAgIDogLy8gMikgYHByZXZpb3VzVFZpZXcgIT0gbnVsbGAgd2hpY2ggbWVhbnMgdGhhdCB3ZSBhcmUgbm93IHdhbGtpbmcgYWNyb3NzIHRoZSBwYXJlbnQgbm9kZXMuXG4gICAgICAgIC8vIEluIHN1Y2ggYSBjYXNlIHdlIGFyZSBvbmx5IGFsbG93ZWQgdG8gbG9vayBpbnRvIHRoZSBWaWV3UHJvdmlkZXJzIGlmOlxuICAgICAgICAvLyAtIFdlIGp1c3QgY3Jvc3NlZCBmcm9tIGNoaWxkIFZpZXcgdG8gUGFyZW50IFZpZXcgYHByZXZpb3VzVFZpZXcgIT0gY3VycmVudFRWaWV3YFxuICAgICAgICAvLyAtIEFORCB0aGUgcGFyZW50IFROb2RlIGlzIGFuIEVsZW1lbnQuXG4gICAgICAgIC8vIFRoaXMgbWVhbnMgdGhhdCB3ZSBqdXN0IGNhbWUgZnJvbSB0aGUgQ29tcG9uZW50J3MgVmlldyBhbmQgdGhlcmVmb3JlIGFyZSBhbGxvd2VkIHRvIHNlZVxuICAgICAgICAvLyBpbnRvIHRoZSBWaWV3UHJvdmlkZXJzLlxuICAgICAgICBwcmV2aW91c1RWaWV3ICE9IGN1cnJlbnRUVmlldyAmJiAodE5vZGUudHlwZSAmIFROb2RlVHlwZS5BbnlSTm9kZSkgIT09IDA7XG5cbiAgLy8gVGhpcyBzcGVjaWFsIGNhc2UgaGFwcGVucyB3aGVuIHRoZXJlIGlzIGEgQGhvc3Qgb24gdGhlIGluamVjdCBhbmQgd2hlbiB3ZSBhcmUgc2VhcmNoaW5nXG4gIC8vIG9uIHRoZSBob3N0IGVsZW1lbnQgbm9kZS5cbiAgY29uc3QgaXNIb3N0U3BlY2lhbENhc2UgPSBmbGFncyAmIEluamVjdEZsYWdzLkhvc3QgJiYgaG9zdFRFbGVtZW50Tm9kZSA9PT0gdE5vZGU7XG5cbiAgY29uc3QgaW5qZWN0YWJsZUlkeCA9IGxvY2F0ZURpcmVjdGl2ZU9yUHJvdmlkZXIoXG4gICAgdE5vZGUsXG4gICAgY3VycmVudFRWaWV3LFxuICAgIHRva2VuLFxuICAgIGNhbkFjY2Vzc1ZpZXdQcm92aWRlcnMsXG4gICAgaXNIb3N0U3BlY2lhbENhc2UsXG4gICk7XG4gIGlmIChpbmplY3RhYmxlSWR4ICE9PSBudWxsKSB7XG4gICAgcmV0dXJuIGdldE5vZGVJbmplY3RhYmxlKGxWaWV3LCBjdXJyZW50VFZpZXcsIGluamVjdGFibGVJZHgsIHROb2RlIGFzIFRFbGVtZW50Tm9kZSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIE5PVF9GT1VORDtcbiAgfVxufVxuXG4vKipcbiAqIFNlYXJjaGVzIGZvciB0aGUgZ2l2ZW4gdG9rZW4gYW1vbmcgdGhlIG5vZGUncyBkaXJlY3RpdmVzIGFuZCBwcm92aWRlcnMuXG4gKlxuICogQHBhcmFtIHROb2RlIFROb2RlIG9uIHdoaWNoIGRpcmVjdGl2ZXMgYXJlIHByZXNlbnQuXG4gKiBAcGFyYW0gdFZpZXcgVGhlIHRWaWV3IHdlIGFyZSBjdXJyZW50bHkgcHJvY2Vzc2luZ1xuICogQHBhcmFtIHRva2VuIFByb3ZpZGVyIHRva2VuIG9yIHR5cGUgb2YgYSBkaXJlY3RpdmUgdG8gbG9vayBmb3IuXG4gKiBAcGFyYW0gY2FuQWNjZXNzVmlld1Byb3ZpZGVycyBXaGV0aGVyIHZpZXcgcHJvdmlkZXJzIHNob3VsZCBiZSBjb25zaWRlcmVkLlxuICogQHBhcmFtIGlzSG9zdFNwZWNpYWxDYXNlIFdoZXRoZXIgdGhlIGhvc3Qgc3BlY2lhbCBjYXNlIGFwcGxpZXMuXG4gKiBAcmV0dXJucyBJbmRleCBvZiBhIGZvdW5kIGRpcmVjdGl2ZSBvciBwcm92aWRlciwgb3IgbnVsbCB3aGVuIG5vbmUgZm91bmQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsb2NhdGVEaXJlY3RpdmVPclByb3ZpZGVyPFQ+KFxuICB0Tm9kZTogVE5vZGUsXG4gIHRWaWV3OiBUVmlldyxcbiAgdG9rZW46IFByb3ZpZGVyVG9rZW48VD4gfCBzdHJpbmcsXG4gIGNhbkFjY2Vzc1ZpZXdQcm92aWRlcnM6IGJvb2xlYW4sXG4gIGlzSG9zdFNwZWNpYWxDYXNlOiBib29sZWFuIHwgbnVtYmVyLFxuKTogbnVtYmVyIHwgbnVsbCB7XG4gIGNvbnN0IG5vZGVQcm92aWRlckluZGV4ZXMgPSB0Tm9kZS5wcm92aWRlckluZGV4ZXM7XG4gIGNvbnN0IHRJbmplY3RhYmxlcyA9IHRWaWV3LmRhdGE7XG5cbiAgY29uc3QgaW5qZWN0YWJsZXNTdGFydCA9IG5vZGVQcm92aWRlckluZGV4ZXMgJiBUTm9kZVByb3ZpZGVySW5kZXhlcy5Qcm92aWRlcnNTdGFydEluZGV4TWFzaztcbiAgY29uc3QgZGlyZWN0aXZlc1N0YXJ0ID0gdE5vZGUuZGlyZWN0aXZlU3RhcnQ7XG4gIGNvbnN0IGRpcmVjdGl2ZUVuZCA9IHROb2RlLmRpcmVjdGl2ZUVuZDtcbiAgY29uc3QgY3B0Vmlld1Byb3ZpZGVyc0NvdW50ID1cbiAgICBub2RlUHJvdmlkZXJJbmRleGVzID4+IFROb2RlUHJvdmlkZXJJbmRleGVzLkNwdFZpZXdQcm92aWRlcnNDb3VudFNoaWZ0O1xuICBjb25zdCBzdGFydGluZ0luZGV4ID0gY2FuQWNjZXNzVmlld1Byb3ZpZGVyc1xuICAgID8gaW5qZWN0YWJsZXNTdGFydFxuICAgIDogaW5qZWN0YWJsZXNTdGFydCArIGNwdFZpZXdQcm92aWRlcnNDb3VudDtcbiAgLy8gV2hlbiB0aGUgaG9zdCBzcGVjaWFsIGNhc2UgYXBwbGllcywgb25seSB0aGUgdmlld1Byb3ZpZGVycyBhbmQgdGhlIGNvbXBvbmVudCBhcmUgdmlzaWJsZVxuICBjb25zdCBlbmRJbmRleCA9IGlzSG9zdFNwZWNpYWxDYXNlID8gaW5qZWN0YWJsZXNTdGFydCArIGNwdFZpZXdQcm92aWRlcnNDb3VudCA6IGRpcmVjdGl2ZUVuZDtcbiAgZm9yIChsZXQgaSA9IHN0YXJ0aW5nSW5kZXg7IGkgPCBlbmRJbmRleDsgaSsrKSB7XG4gICAgY29uc3QgcHJvdmlkZXJUb2tlbk9yRGVmID0gdEluamVjdGFibGVzW2ldIGFzIFByb3ZpZGVyVG9rZW48YW55PiB8IERpcmVjdGl2ZURlZjxhbnk+IHwgc3RyaW5nO1xuICAgIGlmIChcbiAgICAgIChpIDwgZGlyZWN0aXZlc1N0YXJ0ICYmIHRva2VuID09PSBwcm92aWRlclRva2VuT3JEZWYpIHx8XG4gICAgICAoaSA+PSBkaXJlY3RpdmVzU3RhcnQgJiYgKHByb3ZpZGVyVG9rZW5PckRlZiBhcyBEaXJlY3RpdmVEZWY8YW55PikudHlwZSA9PT0gdG9rZW4pXG4gICAgKSB7XG4gICAgICByZXR1cm4gaTtcbiAgICB9XG4gIH1cbiAgaWYgKGlzSG9zdFNwZWNpYWxDYXNlKSB7XG4gICAgY29uc3QgZGlyRGVmID0gdEluamVjdGFibGVzW2RpcmVjdGl2ZXNTdGFydF0gYXMgRGlyZWN0aXZlRGVmPGFueT47XG4gICAgaWYgKGRpckRlZiAmJiBpc0NvbXBvbmVudERlZihkaXJEZWYpICYmIGRpckRlZi50eXBlID09PSB0b2tlbikge1xuICAgICAgcmV0dXJuIGRpcmVjdGl2ZXNTdGFydDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogUmV0cmlldmUgb3IgaW5zdGFudGlhdGUgdGhlIGluamVjdGFibGUgZnJvbSB0aGUgYExWaWV3YCBhdCBwYXJ0aWN1bGFyIGBpbmRleGAuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBjaGVja3MgdG8gc2VlIGlmIHRoZSB2YWx1ZSBoYXMgYWxyZWFkeSBiZWVuIGluc3RhbnRpYXRlZCBhbmQgaWYgc28gcmV0dXJucyB0aGVcbiAqIGNhY2hlZCBgaW5qZWN0YWJsZWAuIE90aGVyd2lzZSBpZiBpdCBkZXRlY3RzIHRoYXQgdGhlIHZhbHVlIGlzIHN0aWxsIGEgZmFjdG9yeSBpdFxuICogaW5zdGFudGlhdGVzIHRoZSBgaW5qZWN0YWJsZWAgYW5kIGNhY2hlcyB0aGUgdmFsdWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXROb2RlSW5qZWN0YWJsZShcbiAgbFZpZXc6IExWaWV3LFxuICB0VmlldzogVFZpZXcsXG4gIGluZGV4OiBudW1iZXIsXG4gIHROb2RlOiBURGlyZWN0aXZlSG9zdE5vZGUsXG4pOiBhbnkge1xuICBsZXQgdmFsdWUgPSBsVmlld1tpbmRleF07XG4gIGNvbnN0IHREYXRhID0gdFZpZXcuZGF0YTtcbiAgaWYgKGlzRmFjdG9yeSh2YWx1ZSkpIHtcbiAgICBjb25zdCBmYWN0b3J5OiBOb2RlSW5qZWN0b3JGYWN0b3J5ID0gdmFsdWU7XG4gICAgaWYgKGZhY3RvcnkucmVzb2x2aW5nKSB7XG4gICAgICB0aHJvd0N5Y2xpY0RlcGVuZGVuY3lFcnJvcihzdHJpbmdpZnlGb3JFcnJvcih0RGF0YVtpbmRleF0pKTtcbiAgICB9XG4gICAgY29uc3QgcHJldmlvdXNJbmNsdWRlVmlld1Byb3ZpZGVycyA9IHNldEluY2x1ZGVWaWV3UHJvdmlkZXJzKGZhY3RvcnkuY2FuU2VlVmlld1Byb3ZpZGVycyk7XG4gICAgZmFjdG9yeS5yZXNvbHZpbmcgPSB0cnVlO1xuXG4gICAgbGV0IHByZXZJbmplY3RDb250ZXh0OiBJbmplY3RvclByb2ZpbGVyQ29udGV4dCB8IHVuZGVmaW5lZDtcbiAgICBpZiAobmdEZXZNb2RlKSB7XG4gICAgICAvLyB0RGF0YSBpbmRleGVzIG1pcnJvciB0aGUgY29uY3JldGUgaW5zdGFuY2VzIGluIGl0cyBjb3JyZXNwb25kaW5nIExWaWV3LlxuICAgICAgLy8gbFZpZXdbaW5kZXhdIGhlcmUgaXMgZWl0aGVyIHRoZSBpbmplY3RhYmxlIGluc3RhY2UgaXRzZWxmIG9yIGEgZmFjdG9yeSxcbiAgICAgIC8vIHRoZXJlZm9yZSB0RGF0YVtpbmRleF0gaXMgdGhlIGNvbnN0cnVjdG9yIG9mIHRoYXQgaW5qZWN0YWJsZSBvciBhXG4gICAgICAvLyBkZWZpbml0aW9uIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZSBjb25zdHJ1Y3RvciBpbiBhIGAudHlwZWAgZmllbGQuXG4gICAgICBjb25zdCB0b2tlbiA9XG4gICAgICAgICh0RGF0YVtpbmRleF0gYXMgRGlyZWN0aXZlRGVmPHVua25vd24+IHwgQ29tcG9uZW50RGVmPHVua25vd24+KS50eXBlIHx8IHREYXRhW2luZGV4XTtcbiAgICAgIGNvbnN0IGluamVjdG9yID0gbmV3IE5vZGVJbmplY3Rvcih0Tm9kZSwgbFZpZXcpO1xuICAgICAgcHJldkluamVjdENvbnRleHQgPSBzZXRJbmplY3RvclByb2ZpbGVyQ29udGV4dCh7aW5qZWN0b3IsIHRva2VufSk7XG4gICAgfVxuXG4gICAgY29uc3QgcHJldmlvdXNJbmplY3RJbXBsZW1lbnRhdGlvbiA9IGZhY3RvcnkuaW5qZWN0SW1wbFxuICAgICAgPyBzZXRJbmplY3RJbXBsZW1lbnRhdGlvbihmYWN0b3J5LmluamVjdEltcGwpXG4gICAgICA6IG51bGw7XG4gICAgY29uc3Qgc3VjY2VzcyA9IGVudGVyREkobFZpZXcsIHROb2RlLCBJbmplY3RGbGFncy5EZWZhdWx0KTtcbiAgICBuZ0Rldk1vZGUgJiZcbiAgICAgIGFzc2VydEVxdWFsKFxuICAgICAgICBzdWNjZXNzLFxuICAgICAgICB0cnVlLFxuICAgICAgICBcIkJlY2F1c2UgZmxhZ3MgZG8gbm90IGNvbnRhaW4gYFNraXBTZWxmJyB3ZSBleHBlY3QgdGhpcyB0byBhbHdheXMgc3VjY2VlZC5cIixcbiAgICAgICk7XG4gICAgdHJ5IHtcbiAgICAgIHZhbHVlID0gbFZpZXdbaW5kZXhdID0gZmFjdG9yeS5mYWN0b3J5KHVuZGVmaW5lZCwgdERhdGEsIGxWaWV3LCB0Tm9kZSk7XG5cbiAgICAgIG5nRGV2TW9kZSAmJiBlbWl0SW5zdGFuY2VDcmVhdGVkQnlJbmplY3RvckV2ZW50KHZhbHVlKTtcblxuICAgICAgLy8gVGhpcyBjb2RlIHBhdGggaXMgaGl0IGZvciBib3RoIGRpcmVjdGl2ZXMgYW5kIHByb3ZpZGVycy5cbiAgICAgIC8vIEZvciBwZXJmIHJlYXNvbnMsIHdlIHdhbnQgdG8gYXZvaWQgc2VhcmNoaW5nIGZvciBob29rcyBvbiBwcm92aWRlcnMuXG4gICAgICAvLyBJdCBkb2VzIG5vIGhhcm0gdG8gdHJ5ICh0aGUgaG9va3MganVzdCB3b24ndCBleGlzdCksIGJ1dCB0aGUgZXh0cmFcbiAgICAgIC8vIGNoZWNrcyBhcmUgdW5uZWNlc3NhcnkgYW5kIHRoaXMgaXMgYSBob3QgcGF0aC4gU28gd2UgY2hlY2sgdG8gc2VlXG4gICAgICAvLyBpZiB0aGUgaW5kZXggb2YgdGhlIGRlcGVuZGVuY3kgaXMgaW4gdGhlIGRpcmVjdGl2ZSByYW5nZSBmb3IgdGhpc1xuICAgICAgLy8gdE5vZGUuIElmIGl0J3Mgbm90LCB3ZSBrbm93IGl0J3MgYSBwcm92aWRlciBhbmQgc2tpcCBob29rIHJlZ2lzdHJhdGlvbi5cbiAgICAgIGlmICh0Vmlldy5maXJzdENyZWF0ZVBhc3MgJiYgaW5kZXggPj0gdE5vZGUuZGlyZWN0aXZlU3RhcnQpIHtcbiAgICAgICAgbmdEZXZNb2RlICYmIGFzc2VydERpcmVjdGl2ZURlZih0RGF0YVtpbmRleF0pO1xuICAgICAgICByZWdpc3RlclByZU9yZGVySG9va3MoaW5kZXgsIHREYXRhW2luZGV4XSBhcyBEaXJlY3RpdmVEZWY8YW55PiwgdFZpZXcpO1xuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICBuZ0Rldk1vZGUgJiYgc2V0SW5qZWN0b3JQcm9maWxlckNvbnRleHQocHJldkluamVjdENvbnRleHQhKTtcblxuICAgICAgcHJldmlvdXNJbmplY3RJbXBsZW1lbnRhdGlvbiAhPT0gbnVsbCAmJlxuICAgICAgICBzZXRJbmplY3RJbXBsZW1lbnRhdGlvbihwcmV2aW91c0luamVjdEltcGxlbWVudGF0aW9uKTtcbiAgICAgIHNldEluY2x1ZGVWaWV3UHJvdmlkZXJzKHByZXZpb3VzSW5jbHVkZVZpZXdQcm92aWRlcnMpO1xuICAgICAgZmFjdG9yeS5yZXNvbHZpbmcgPSBmYWxzZTtcbiAgICAgIGxlYXZlREkoKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGJpdCBpbiBhbiBpbmplY3RvcidzIGJsb29tIGZpbHRlciB0aGF0IHNob3VsZCBiZSB1c2VkIHRvIGRldGVybWluZSB3aGV0aGVyIG9yIG5vdFxuICogdGhlIGRpcmVjdGl2ZSBtaWdodCBiZSBwcm92aWRlZCBieSB0aGUgaW5qZWN0b3IuXG4gKlxuICogV2hlbiBhIGRpcmVjdGl2ZSBpcyBwdWJsaWMsIGl0IGlzIGFkZGVkIHRvIHRoZSBibG9vbSBmaWx0ZXIgYW5kIGdpdmVuIGEgdW5pcXVlIElEIHRoYXQgY2FuIGJlXG4gKiByZXRyaWV2ZWQgb24gdGhlIFR5cGUuIFdoZW4gdGhlIGRpcmVjdGl2ZSBpc24ndCBwdWJsaWMgb3IgdGhlIHRva2VuIGlzIG5vdCBhIGRpcmVjdGl2ZSBgbnVsbGBcbiAqIGlzIHJldHVybmVkIGFzIHRoZSBub2RlIGluamVjdG9yIGNhbiBub3QgcG9zc2libHkgcHJvdmlkZSB0aGF0IHRva2VuLlxuICpcbiAqIEBwYXJhbSB0b2tlbiB0aGUgaW5qZWN0aW9uIHRva2VuXG4gKiBAcmV0dXJucyB0aGUgbWF0Y2hpbmcgYml0IHRvIGNoZWNrIGluIHRoZSBibG9vbSBmaWx0ZXIgb3IgYG51bGxgIGlmIHRoZSB0b2tlbiBpcyBub3Qga25vd24uXG4gKiAgIFdoZW4gdGhlIHJldHVybmVkIHZhbHVlIGlzIG5lZ2F0aXZlIHRoZW4gaXQgcmVwcmVzZW50cyBzcGVjaWFsIHZhbHVlcyBzdWNoIGFzIGBJbmplY3RvcmAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBibG9vbUhhc2hCaXRPckZhY3RvcnkoXG4gIHRva2VuOiBQcm92aWRlclRva2VuPGFueT4gfCBzdHJpbmcsXG4pOiBudW1iZXIgfCBGdW5jdGlvbiB8IHVuZGVmaW5lZCB7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnREZWZpbmVkKHRva2VuLCAndG9rZW4gbXVzdCBiZSBkZWZpbmVkJyk7XG4gIGlmICh0eXBlb2YgdG9rZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIHRva2VuLmNoYXJDb2RlQXQoMCkgfHwgMDtcbiAgfVxuICBjb25zdCB0b2tlbklkOiBudW1iZXIgfCB1bmRlZmluZWQgPVxuICAgIC8vIEZpcnN0IGNoZWNrIHdpdGggYGhhc093blByb3BlcnR5YCBzbyB3ZSBkb24ndCBnZXQgYW4gaW5oZXJpdGVkIElELlxuICAgIHRva2VuLmhhc093blByb3BlcnR5KE5HX0VMRU1FTlRfSUQpID8gKHRva2VuIGFzIGFueSlbTkdfRUxFTUVOVF9JRF0gOiB1bmRlZmluZWQ7XG4gIC8vIE5lZ2F0aXZlIHRva2VuIElEcyBhcmUgdXNlZCBmb3Igc3BlY2lhbCBvYmplY3RzIHN1Y2ggYXMgYEluamVjdG9yYFxuICBpZiAodHlwZW9mIHRva2VuSWQgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKHRva2VuSWQgPj0gMCkge1xuICAgICAgcmV0dXJuIHRva2VuSWQgJiBCTE9PTV9NQVNLO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZ0Rldk1vZGUgJiZcbiAgICAgICAgYXNzZXJ0RXF1YWwodG9rZW5JZCwgSW5qZWN0b3JNYXJrZXJzLkluamVjdG9yLCAnRXhwZWN0aW5nIHRvIGdldCBTcGVjaWFsIEluamVjdG9yIElkJyk7XG4gICAgICByZXR1cm4gY3JlYXRlTm9kZUluamVjdG9yO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdG9rZW5JZDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYmxvb21IYXNUb2tlbihcbiAgYmxvb21IYXNoOiBudW1iZXIsXG4gIGluamVjdG9ySW5kZXg6IG51bWJlcixcbiAgaW5qZWN0b3JWaWV3OiBMVmlldyB8IFREYXRhLFxuKSB7XG4gIC8vIENyZWF0ZSBhIG1hc2sgdGhhdCB0YXJnZXRzIHRoZSBzcGVjaWZpYyBiaXQgYXNzb2NpYXRlZCB3aXRoIHRoZSBkaXJlY3RpdmUgd2UncmUgbG9va2luZyBmb3IuXG4gIC8vIEpTIGJpdCBvcGVyYXRpb25zIGFyZSAzMiBiaXRzLCBzbyB0aGlzIHdpbGwgYmUgYSBudW1iZXIgYmV0d2VlbiAyXjAgYW5kIDJeMzEsIGNvcnJlc3BvbmRpbmdcbiAgLy8gdG8gYml0IHBvc2l0aW9ucyAwIC0gMzEgaW4gYSAzMiBiaXQgaW50ZWdlci5cbiAgY29uc3QgbWFzayA9IDEgPDwgYmxvb21IYXNoO1xuXG4gIC8vIEVhY2ggYmxvb20gYnVja2V0IGluIGBpbmplY3RvclZpZXdgIHJlcHJlc2VudHMgYEJMT09NX0JVQ0tFVF9CSVRTYCBudW1iZXIgb2YgYml0cyBvZlxuICAvLyBgYmxvb21IYXNoYC4gQW55IGJpdHMgaW4gYGJsb29tSGFzaGAgYmV5b25kIGBCTE9PTV9CVUNLRVRfQklUU2AgaW5kaWNhdGUgdGhlIGJ1Y2tldCBvZmZzZXRcbiAgLy8gdGhhdCBzaG91bGQgYmUgdXNlZC5cbiAgY29uc3QgdmFsdWUgPSBpbmplY3RvclZpZXdbaW5qZWN0b3JJbmRleCArIChibG9vbUhhc2ggPj4gQkxPT01fQlVDS0VUX0JJVFMpXTtcblxuICAvLyBJZiB0aGUgYmxvb20gZmlsdGVyIHZhbHVlIGhhcyB0aGUgYml0IGNvcnJlc3BvbmRpbmcgdG8gdGhlIGRpcmVjdGl2ZSdzIGJsb29tQml0IGZsaXBwZWQgb24sXG4gIC8vIHRoaXMgaW5qZWN0b3IgaXMgYSBwb3RlbnRpYWwgbWF0Y2guXG4gIHJldHVybiAhISh2YWx1ZSAmIG1hc2spO1xufVxuXG4vKiogUmV0dXJucyB0cnVlIGlmIGZsYWdzIHByZXZlbnQgcGFyZW50IGluamVjdG9yIGZyb20gYmVpbmcgc2VhcmNoZWQgZm9yIHRva2VucyAqL1xuZnVuY3Rpb24gc2hvdWxkU2VhcmNoUGFyZW50KGZsYWdzOiBJbmplY3RGbGFncywgaXNGaXJzdEhvc3RUTm9kZTogYm9vbGVhbik6IGJvb2xlYW4gfCBudW1iZXIge1xuICByZXR1cm4gIShmbGFncyAmIEluamVjdEZsYWdzLlNlbGYpICYmICEoZmxhZ3MgJiBJbmplY3RGbGFncy5Ib3N0ICYmIGlzRmlyc3RIb3N0VE5vZGUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Tm9kZUluamVjdG9yTFZpZXcobm9kZUluamVjdG9yOiBOb2RlSW5qZWN0b3IpOiBMVmlldyB7XG4gIHJldHVybiAobm9kZUluamVjdG9yIGFzIGFueSkuX2xWaWV3IGFzIExWaWV3O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Tm9kZUluamVjdG9yVE5vZGUoXG4gIG5vZGVJbmplY3RvcjogTm9kZUluamVjdG9yLFxuKTogVEVsZW1lbnROb2RlIHwgVENvbnRhaW5lck5vZGUgfCBURWxlbWVudENvbnRhaW5lck5vZGUgfCBudWxsIHtcbiAgcmV0dXJuIChub2RlSW5qZWN0b3IgYXMgYW55KS5fdE5vZGUgYXNcbiAgICB8IFRFbGVtZW50Tm9kZVxuICAgIHwgVENvbnRhaW5lck5vZGVcbiAgICB8IFRFbGVtZW50Q29udGFpbmVyTm9kZVxuICAgIHwgbnVsbDtcbn1cblxuZXhwb3J0IGNsYXNzIE5vZGVJbmplY3RvciBpbXBsZW1lbnRzIEluamVjdG9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBfdE5vZGU6IFRFbGVtZW50Tm9kZSB8IFRDb250YWluZXJOb2RlIHwgVEVsZW1lbnRDb250YWluZXJOb2RlIHwgbnVsbCxcbiAgICBwcml2YXRlIF9sVmlldzogTFZpZXcsXG4gICkge31cblxuICBnZXQodG9rZW46IGFueSwgbm90Rm91bmRWYWx1ZT86IGFueSwgZmxhZ3M/OiBJbmplY3RGbGFncyB8IEluamVjdE9wdGlvbnMpOiBhbnkge1xuICAgIHJldHVybiBnZXRPckNyZWF0ZUluamVjdGFibGUoXG4gICAgICB0aGlzLl90Tm9kZSxcbiAgICAgIHRoaXMuX2xWaWV3LFxuICAgICAgdG9rZW4sXG4gICAgICBjb252ZXJ0VG9CaXRGbGFncyhmbGFncyksXG4gICAgICBub3RGb3VuZFZhbHVlLFxuICAgICk7XG4gIH1cbn1cblxuLyoqIENyZWF0ZXMgYSBgTm9kZUluamVjdG9yYCBmb3IgdGhlIGN1cnJlbnQgbm9kZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVOb2RlSW5qZWN0b3IoKTogSW5qZWN0b3Ige1xuICByZXR1cm4gbmV3IE5vZGVJbmplY3RvcihnZXRDdXJyZW50VE5vZGUoKSEgYXMgVERpcmVjdGl2ZUhvc3ROb2RlLCBnZXRMVmlldygpKSBhcyBhbnk7XG59XG5cbi8qKlxuICogQGNvZGVHZW5BcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybVnZXRJbmhlcml0ZWRGYWN0b3J5PFQ+KHR5cGU6IFR5cGU8YW55Pik6ICh0eXBlOiBUeXBlPFQ+KSA9PiBUIHtcbiAgcmV0dXJuIG5vU2lkZUVmZmVjdHMoKCkgPT4ge1xuICAgIGNvbnN0IG93bkNvbnN0cnVjdG9yID0gdHlwZS5wcm90b3R5cGUuY29uc3RydWN0b3I7XG4gICAgY29uc3Qgb3duRmFjdG9yeSA9IG93bkNvbnN0cnVjdG9yW05HX0ZBQ1RPUllfREVGXSB8fCBnZXRGYWN0b3J5T2Yob3duQ29uc3RydWN0b3IpO1xuICAgIGNvbnN0IG9iamVjdFByb3RvdHlwZSA9IE9iamVjdC5wcm90b3R5cGU7XG4gICAgbGV0IHBhcmVudCA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih0eXBlLnByb3RvdHlwZSkuY29uc3RydWN0b3I7XG5cbiAgICAvLyBHbyB1cCB0aGUgcHJvdG90eXBlIHVudGlsIHdlIGhpdCBgT2JqZWN0YC5cbiAgICB3aGlsZSAocGFyZW50ICYmIHBhcmVudCAhPT0gb2JqZWN0UHJvdG90eXBlKSB7XG4gICAgICBjb25zdCBmYWN0b3J5ID0gcGFyZW50W05HX0ZBQ1RPUllfREVGXSB8fCBnZXRGYWN0b3J5T2YocGFyZW50KTtcblxuICAgICAgLy8gSWYgd2UgaGl0IHNvbWV0aGluZyB0aGF0IGhhcyBhIGZhY3RvcnkgYW5kIHRoZSBmYWN0b3J5IGlzbid0IHRoZSBzYW1lIGFzIHRoZSB0eXBlLFxuICAgICAgLy8gd2UndmUgZm91bmQgdGhlIGluaGVyaXRlZCBmYWN0b3J5LiBOb3RlIHRoZSBjaGVjayB0aGF0IHRoZSBmYWN0b3J5IGlzbid0IHRoZSB0eXBlJ3NcbiAgICAgIC8vIG93biBmYWN0b3J5IGlzIHJlZHVuZGFudCBpbiBtb3N0IGNhc2VzLCBidXQgaWYgdGhlIHVzZXIgaGFzIGN1c3RvbSBkZWNvcmF0b3JzIG9uIHRoZVxuICAgICAgLy8gY2xhc3MsIHRoaXMgbG9va3VwIHdpbGwgc3RhcnQgb25lIGxldmVsIGRvd24gaW4gdGhlIHByb3RvdHlwZSBjaGFpbiwgY2F1c2luZyB1cyB0b1xuICAgICAgLy8gZmluZCB0aGUgb3duIGZhY3RvcnkgZmlyc3QgYW5kIHBvdGVudGlhbGx5IHRyaWdnZXJpbmcgYW4gaW5maW5pdGUgbG9vcCBkb3duc3RyZWFtLlxuICAgICAgaWYgKGZhY3RvcnkgJiYgZmFjdG9yeSAhPT0gb3duRmFjdG9yeSkge1xuICAgICAgICByZXR1cm4gZmFjdG9yeTtcbiAgICAgIH1cblxuICAgICAgcGFyZW50ID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHBhcmVudCk7XG4gICAgfVxuXG4gICAgLy8gVGhlcmUgaXMgbm8gZmFjdG9yeSBkZWZpbmVkLiBFaXRoZXIgdGhpcyB3YXMgaW1wcm9wZXIgdXNhZ2Ugb2YgaW5oZXJpdGFuY2VcbiAgICAvLyAobm8gQW5ndWxhciBkZWNvcmF0b3Igb24gdGhlIHN1cGVyY2xhc3MpIG9yIHRoZXJlIGlzIG5vIGNvbnN0cnVjdG9yIGF0IGFsbFxuICAgIC8vIGluIHRoZSBpbmhlcml0YW5jZSBjaGFpbi4gU2luY2UgdGhlIHR3byBjYXNlcyBjYW5ub3QgYmUgZGlzdGluZ3Vpc2hlZCwgdGhlXG4gICAgLy8gbGF0dGVyIGhhcyB0byBiZSBhc3N1bWVkLlxuICAgIHJldHVybiAodDogVHlwZTxUPikgPT4gbmV3IHQoKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGdldEZhY3RvcnlPZjxUPih0eXBlOiBUeXBlPGFueT4pOiAoKHR5cGU/OiBUeXBlPFQ+KSA9PiBUIHwgbnVsbCkgfCBudWxsIHtcbiAgaWYgKGlzRm9yd2FyZFJlZih0eXBlKSkge1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjb25zdCBmYWN0b3J5ID0gZ2V0RmFjdG9yeU9mPFQ+KHJlc29sdmVGb3J3YXJkUmVmKHR5cGUpKTtcbiAgICAgIHJldHVybiBmYWN0b3J5ICYmIGZhY3RvcnkoKTtcbiAgICB9O1xuICB9XG4gIHJldHVybiBnZXRGYWN0b3J5RGVmPFQ+KHR5cGUpO1xufVxuXG4vKipcbiAqIFJldHVybnMgYSB2YWx1ZSBmcm9tIHRoZSBjbG9zZXN0IGVtYmVkZGVkIG9yIG5vZGUgaW5qZWN0b3IuXG4gKlxuICogQHBhcmFtIHROb2RlIFRoZSBOb2RlIHdoZXJlIHRoZSBzZWFyY2ggZm9yIHRoZSBpbmplY3RvciBzaG91bGQgc3RhcnRcbiAqIEBwYXJhbSBsVmlldyBUaGUgYExWaWV3YCB0aGF0IGNvbnRhaW5zIHRoZSBgdE5vZGVgXG4gKiBAcGFyYW0gdG9rZW4gVGhlIHRva2VuIHRvIGxvb2sgZm9yXG4gKiBAcGFyYW0gZmxhZ3MgSW5qZWN0aW9uIGZsYWdzXG4gKiBAcGFyYW0gbm90Rm91bmRWYWx1ZSBUaGUgdmFsdWUgdG8gcmV0dXJuIHdoZW4gdGhlIGluamVjdGlvbiBmbGFncyBpcyBgSW5qZWN0RmxhZ3MuT3B0aW9uYWxgXG4gKiBAcmV0dXJucyB0aGUgdmFsdWUgZnJvbSB0aGUgaW5qZWN0b3IsIGBudWxsYCB3aGVuIG5vdCBmb3VuZCwgb3IgYG5vdEZvdW5kVmFsdWVgIGlmIHByb3ZpZGVkXG4gKi9cbmZ1bmN0aW9uIGxvb2t1cFRva2VuVXNpbmdFbWJlZGRlZEluamVjdG9yPFQ+KFxuICB0Tm9kZTogVERpcmVjdGl2ZUhvc3ROb2RlLFxuICBsVmlldzogTFZpZXcsXG4gIHRva2VuOiBQcm92aWRlclRva2VuPFQ+LFxuICBmbGFnczogSW5qZWN0RmxhZ3MsXG4gIG5vdEZvdW5kVmFsdWU/OiBhbnksXG4pIHtcbiAgbGV0IGN1cnJlbnRUTm9kZTogVERpcmVjdGl2ZUhvc3ROb2RlIHwgbnVsbCA9IHROb2RlO1xuICBsZXQgY3VycmVudExWaWV3OiBMVmlldyB8IG51bGwgPSBsVmlldztcblxuICAvLyBXaGVuIGFuIExWaWV3IHdpdGggYW4gZW1iZWRkZWQgdmlldyBpbmplY3RvciBpcyBpbnNlcnRlZCwgaXQnbGwgbGlrZWx5IGJlIGludGVybGFjZWQgd2l0aFxuICAvLyBub2RlcyB3aG8gbWF5IGhhdmUgaW5qZWN0b3JzIChlLmcuIG5vZGUgaW5qZWN0b3IgLT4gZW1iZWRkZWQgdmlldyBpbmplY3RvciAtPiBub2RlIGluamVjdG9yKS5cbiAgLy8gU2luY2UgdGhlIGJsb29tIGZpbHRlcnMgZm9yIHRoZSBub2RlIGluamVjdG9ycyBoYXZlIGFscmVhZHkgYmVlbiBjb25zdHJ1Y3RlZCBhbmQgd2UgZG9uJ3RcbiAgLy8gaGF2ZSBhIHdheSBvZiBleHRyYWN0aW5nIHRoZSByZWNvcmRzIGZyb20gYW4gaW5qZWN0b3IsIHRoZSBvbmx5IHdheSB0byBtYWludGFpbiB0aGUgY29ycmVjdFxuICAvLyBoaWVyYXJjaHkgd2hlbiByZXNvbHZpbmcgdGhlIHZhbHVlIGlzIHRvIHdhbGsgaXQgbm9kZS1ieS1ub2RlIHdoaWxlIGF0dGVtcHRpbmcgdG8gcmVzb2x2ZVxuICAvLyB0aGUgdG9rZW4gYXQgZWFjaCBsZXZlbC5cbiAgd2hpbGUgKFxuICAgIGN1cnJlbnRUTm9kZSAhPT0gbnVsbCAmJlxuICAgIGN1cnJlbnRMVmlldyAhPT0gbnVsbCAmJlxuICAgIGN1cnJlbnRMVmlld1tGTEFHU10gJiBMVmlld0ZsYWdzLkhhc0VtYmVkZGVkVmlld0luamVjdG9yICYmXG4gICAgIShjdXJyZW50TFZpZXdbRkxBR1NdICYgTFZpZXdGbGFncy5Jc1Jvb3QpXG4gICkge1xuICAgIG5nRGV2TW9kZSAmJiBhc3NlcnRUTm9kZUZvckxWaWV3KGN1cnJlbnRUTm9kZSwgY3VycmVudExWaWV3KTtcblxuICAgIC8vIE5vdGUgdGhhdCB0aGlzIGxvb2t1cCBvbiB0aGUgbm9kZSBpbmplY3RvciBpcyB1c2luZyB0aGUgYFNlbGZgIGZsYWcsIGJlY2F1c2VcbiAgICAvLyB3ZSBkb24ndCB3YW50IHRoZSBub2RlIGluamVjdG9yIHRvIGxvb2sgYXQgYW55IHBhcmVudCBpbmplY3RvcnMgc2luY2Ugd2VcbiAgICAvLyBtYXkgaGl0IHRoZSBlbWJlZGRlZCB2aWV3IGluamVjdG9yIGZpcnN0LlxuICAgIGNvbnN0IG5vZGVJbmplY3RvclZhbHVlID0gbG9va3VwVG9rZW5Vc2luZ05vZGVJbmplY3RvcihcbiAgICAgIGN1cnJlbnRUTm9kZSxcbiAgICAgIGN1cnJlbnRMVmlldyxcbiAgICAgIHRva2VuLFxuICAgICAgZmxhZ3MgfCBJbmplY3RGbGFncy5TZWxmLFxuICAgICAgTk9UX0ZPVU5ELFxuICAgICk7XG4gICAgaWYgKG5vZGVJbmplY3RvclZhbHVlICE9PSBOT1RfRk9VTkQpIHtcbiAgICAgIHJldHVybiBub2RlSW5qZWN0b3JWYWx1ZTtcbiAgICB9XG5cbiAgICAvLyBIYXMgYW4gZXhwbGljaXQgdHlwZSBkdWUgdG8gYSBUUyBidWc6IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvMzMxOTFcbiAgICBsZXQgcGFyZW50VE5vZGU6IFRFbGVtZW50Tm9kZSB8IFRDb250YWluZXJOb2RlIHwgbnVsbCA9IGN1cnJlbnRUTm9kZS5wYXJlbnQ7XG5cbiAgICAvLyBgVE5vZGUucGFyZW50YCBpbmNsdWRlcyB0aGUgcGFyZW50IHdpdGhpbiB0aGUgY3VycmVudCB2aWV3IG9ubHkuIElmIGl0IGRvZXNuJ3QgZXhpc3QsXG4gICAgLy8gaXQgbWVhbnMgdGhhdCB3ZSd2ZSBoaXQgdGhlIHZpZXcgYm91bmRhcnkgYW5kIHdlIG5lZWQgdG8gZ28gdXAgdG8gdGhlIG5leHQgdmlldy5cbiAgICBpZiAoIXBhcmVudFROb2RlKSB7XG4gICAgICAvLyBCZWZvcmUgd2UgZ28gdG8gdGhlIG5leHQgTFZpZXcsIGNoZWNrIGlmIHRoZSB0b2tlbiBleGlzdHMgb24gdGhlIGN1cnJlbnQgZW1iZWRkZWQgaW5qZWN0b3IuXG4gICAgICBjb25zdCBlbWJlZGRlZFZpZXdJbmplY3RvciA9IGN1cnJlbnRMVmlld1tFTUJFRERFRF9WSUVXX0lOSkVDVE9SXTtcbiAgICAgIGlmIChlbWJlZGRlZFZpZXdJbmplY3Rvcikge1xuICAgICAgICBjb25zdCBlbWJlZGRlZFZpZXdJbmplY3RvclZhbHVlID0gZW1iZWRkZWRWaWV3SW5qZWN0b3IuZ2V0KFxuICAgICAgICAgIHRva2VuLFxuICAgICAgICAgIE5PVF9GT1VORCBhcyBUIHwge30sXG4gICAgICAgICAgZmxhZ3MsXG4gICAgICAgICk7XG4gICAgICAgIGlmIChlbWJlZGRlZFZpZXdJbmplY3RvclZhbHVlICE9PSBOT1RfRk9VTkQpIHtcbiAgICAgICAgICByZXR1cm4gZW1iZWRkZWRWaWV3SW5qZWN0b3JWYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBPdGhlcndpc2Uga2VlcCBnb2luZyB1cCB0aGUgdHJlZS5cbiAgICAgIHBhcmVudFROb2RlID0gZ2V0VE5vZGVGcm9tTFZpZXcoY3VycmVudExWaWV3KTtcbiAgICAgIGN1cnJlbnRMVmlldyA9IGN1cnJlbnRMVmlld1tERUNMQVJBVElPTl9WSUVXXTtcbiAgICB9XG5cbiAgICBjdXJyZW50VE5vZGUgPSBwYXJlbnRUTm9kZTtcbiAgfVxuXG4gIHJldHVybiBub3RGb3VuZFZhbHVlO1xufVxuXG4vKiogR2V0cyB0aGUgVE5vZGUgYXNzb2NpYXRlZCB3aXRoIGFuIExWaWV3IGluc2lkZSBvZiB0aGUgZGVjbGFyYXRpb24gdmlldy4gKi9cbmZ1bmN0aW9uIGdldFROb2RlRnJvbUxWaWV3KGxWaWV3OiBMVmlldyk6IFRFbGVtZW50Tm9kZSB8IFRFbGVtZW50Q29udGFpbmVyTm9kZSB8IG51bGwge1xuICBjb25zdCB0VmlldyA9IGxWaWV3W1RWSUVXXTtcbiAgY29uc3QgdFZpZXdUeXBlID0gdFZpZXcudHlwZTtcblxuICAvLyBUaGUgcGFyZW50IHBvaW50ZXIgZGlmZmVycyBiYXNlZCBvbiBgVFZpZXcudHlwZWAuXG4gIGlmICh0Vmlld1R5cGUgPT09IFRWaWV3VHlwZS5FbWJlZGRlZCkge1xuICAgIG5nRGV2TW9kZSAmJiBhc3NlcnREZWZpbmVkKHRWaWV3LmRlY2xUTm9kZSwgJ0VtYmVkZGVkIFROb2RlcyBzaG91bGQgaGF2ZSBkZWNsYXJhdGlvbiBwYXJlbnRzLicpO1xuICAgIHJldHVybiB0Vmlldy5kZWNsVE5vZGUgYXMgVEVsZW1lbnRDb250YWluZXJOb2RlO1xuICB9IGVsc2UgaWYgKHRWaWV3VHlwZSA9PT0gVFZpZXdUeXBlLkNvbXBvbmVudCkge1xuICAgIC8vIENvbXBvbmVudHMgZG9uJ3QgaGF2ZSBgVFZpZXcuZGVjbFROb2RlYCBiZWNhdXNlIGVhY2ggaW5zdGFuY2Ugb2YgY29tcG9uZW50IGNvdWxkIGJlXG4gICAgLy8gaW5zZXJ0ZWQgaW4gZGlmZmVyZW50IGxvY2F0aW9uLCBoZW5jZSBgVFZpZXcuZGVjbFROb2RlYCBpcyBtZWFuaW5nbGVzcy5cbiAgICByZXR1cm4gbFZpZXdbVF9IT1NUXSBhcyBURWxlbWVudE5vZGU7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cbiJdfQ==