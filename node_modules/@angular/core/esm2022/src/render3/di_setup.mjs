/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { resolveForwardRef } from '../di/forward_ref';
import { isClassProvider, isTypeProvider } from '../di/provider_collection';
import { providerToFactory } from '../di/r3_injector';
import { assertDefined } from '../util/assert';
import { emitProviderConfiguredEvent, runInInjectorProfilerContext } from './debug/injector_profiler';
import { diPublicInInjector, getNodeInjectable, getOrCreateNodeInjectorForNode, NodeInjector, } from './di';
import { ɵɵdirectiveInject } from './instructions/all';
import { NodeInjectorFactory } from './interfaces/injector';
import { isComponentDef } from './interfaces/type_checks';
import { TVIEW } from './interfaces/view';
import { getCurrentTNode, getLView, getTView } from './state';
/**
 * Resolves the providers which are defined in the DirectiveDef.
 *
 * When inserting the tokens and the factories in their respective arrays, we can assume that
 * this method is called first for the component (if any), and then for other directives on the same
 * node.
 * As a consequence,the providers are always processed in that order:
 * 1) The view providers of the component
 * 2) The providers of the component
 * 3) The providers of the other directives
 * This matches the structure of the injectables arrays of a view (for each node).
 * So the tokens and the factories can be pushed at the end of the arrays, except
 * in one case for multi providers.
 *
 * @param def the directive definition
 * @param providers: Array of `providers`.
 * @param viewProviders: Array of `viewProviders`.
 */
export function providersResolver(def, providers, viewProviders) {
    const tView = getTView();
    if (tView.firstCreatePass) {
        const isComponent = isComponentDef(def);
        // The list of view providers is processed first, and the flags are updated
        resolveProvider(viewProviders, tView.data, tView.blueprint, isComponent, true);
        // Then, the list of providers is processed, and the flags are updated
        resolveProvider(providers, tView.data, tView.blueprint, isComponent, false);
    }
}
/**
 * Resolves a provider and publishes it to the DI system.
 */
function resolveProvider(provider, tInjectables, lInjectablesBlueprint, isComponent, isViewProvider) {
    provider = resolveForwardRef(provider);
    if (Array.isArray(provider)) {
        // Recursively call `resolveProvider`
        // Recursion is OK in this case because this code will not be in hot-path once we implement
        // cloning of the initial state.
        for (let i = 0; i < provider.length; i++) {
            resolveProvider(provider[i], tInjectables, lInjectablesBlueprint, isComponent, isViewProvider);
        }
    }
    else {
        const tView = getTView();
        const lView = getLView();
        const tNode = getCurrentTNode();
        let token = isTypeProvider(provider) ? provider : resolveForwardRef(provider.provide);
        const providerFactory = providerToFactory(provider);
        if (ngDevMode) {
            const injector = new NodeInjector(tNode, lView);
            runInInjectorProfilerContext(injector, token, () => {
                emitProviderConfiguredEvent(provider, isViewProvider);
            });
        }
        const beginIndex = tNode.providerIndexes & 1048575 /* TNodeProviderIndexes.ProvidersStartIndexMask */;
        const endIndex = tNode.directiveStart;
        const cptViewProvidersCount = tNode.providerIndexes >> 20 /* TNodeProviderIndexes.CptViewProvidersCountShift */;
        if (isTypeProvider(provider) || !provider.multi) {
            // Single provider case: the factory is created and pushed immediately
            const factory = new NodeInjectorFactory(providerFactory, isViewProvider, ɵɵdirectiveInject);
            const existingFactoryIndex = indexOf(token, tInjectables, isViewProvider ? beginIndex : beginIndex + cptViewProvidersCount, endIndex);
            if (existingFactoryIndex === -1) {
                diPublicInInjector(getOrCreateNodeInjectorForNode(tNode, lView), tView, token);
                registerDestroyHooksIfSupported(tView, provider, tInjectables.length);
                tInjectables.push(token);
                tNode.directiveStart++;
                tNode.directiveEnd++;
                if (isViewProvider) {
                    tNode.providerIndexes += 1048576 /* TNodeProviderIndexes.CptViewProvidersCountShifter */;
                }
                lInjectablesBlueprint.push(factory);
                lView.push(factory);
            }
            else {
                lInjectablesBlueprint[existingFactoryIndex] = factory;
                lView[existingFactoryIndex] = factory;
            }
        }
        else {
            // Multi provider case:
            // We create a multi factory which is going to aggregate all the values.
            // Since the output of such a factory depends on content or view injection,
            // we create two of them, which are linked together.
            //
            // The first one (for view providers) is always in the first block of the injectables array,
            // and the second one (for providers) is always in the second block.
            // This is important because view providers have higher priority. When a multi token
            // is being looked up, the view providers should be found first.
            // Note that it is not possible to have a multi factory in the third block (directive block).
            //
            // The algorithm to process multi providers is as follows:
            // 1) If the multi provider comes from the `viewProviders` of the component:
            //   a) If the special view providers factory doesn't exist, it is created and pushed.
            //   b) Else, the multi provider is added to the existing multi factory.
            // 2) If the multi provider comes from the `providers` of the component or of another
            // directive:
            //   a) If the multi factory doesn't exist, it is created and provider pushed into it.
            //      It is also linked to the multi factory for view providers, if it exists.
            //   b) Else, the multi provider is added to the existing multi factory.
            const existingProvidersFactoryIndex = indexOf(token, tInjectables, beginIndex + cptViewProvidersCount, endIndex);
            const existingViewProvidersFactoryIndex = indexOf(token, tInjectables, beginIndex, beginIndex + cptViewProvidersCount);
            const doesProvidersFactoryExist = existingProvidersFactoryIndex >= 0 && lInjectablesBlueprint[existingProvidersFactoryIndex];
            const doesViewProvidersFactoryExist = existingViewProvidersFactoryIndex >= 0 &&
                lInjectablesBlueprint[existingViewProvidersFactoryIndex];
            if ((isViewProvider && !doesViewProvidersFactoryExist) ||
                (!isViewProvider && !doesProvidersFactoryExist)) {
                // Cases 1.a and 2.a
                diPublicInInjector(getOrCreateNodeInjectorForNode(tNode, lView), tView, token);
                const factory = multiFactory(isViewProvider ? multiViewProvidersFactoryResolver : multiProvidersFactoryResolver, lInjectablesBlueprint.length, isViewProvider, isComponent, providerFactory);
                if (!isViewProvider && doesViewProvidersFactoryExist) {
                    lInjectablesBlueprint[existingViewProvidersFactoryIndex].providerFactory = factory;
                }
                registerDestroyHooksIfSupported(tView, provider, tInjectables.length, 0);
                tInjectables.push(token);
                tNode.directiveStart++;
                tNode.directiveEnd++;
                if (isViewProvider) {
                    tNode.providerIndexes += 1048576 /* TNodeProviderIndexes.CptViewProvidersCountShifter */;
                }
                lInjectablesBlueprint.push(factory);
                lView.push(factory);
            }
            else {
                // Cases 1.b and 2.b
                const indexInFactory = multiFactoryAdd(lInjectablesBlueprint[isViewProvider ? existingViewProvidersFactoryIndex : existingProvidersFactoryIndex], providerFactory, !isViewProvider && isComponent);
                registerDestroyHooksIfSupported(tView, provider, existingProvidersFactoryIndex > -1
                    ? existingProvidersFactoryIndex
                    : existingViewProvidersFactoryIndex, indexInFactory);
            }
            if (!isViewProvider && isComponent && doesViewProvidersFactoryExist) {
                lInjectablesBlueprint[existingViewProvidersFactoryIndex].componentProviders++;
            }
        }
    }
}
/**
 * Registers the `ngOnDestroy` hook of a provider, if the provider supports destroy hooks.
 * @param tView `TView` in which to register the hook.
 * @param provider Provider whose hook should be registered.
 * @param contextIndex Index under which to find the context for the hook when it's being invoked.
 * @param indexInFactory Only required for `multi` providers. Index of the provider in the multi
 * provider factory.
 */
function registerDestroyHooksIfSupported(tView, provider, contextIndex, indexInFactory) {
    const providerIsTypeProvider = isTypeProvider(provider);
    const providerIsClassProvider = isClassProvider(provider);
    if (providerIsTypeProvider || providerIsClassProvider) {
        // Resolve forward references as `useClass` can hold a forward reference.
        const classToken = providerIsClassProvider ? resolveForwardRef(provider.useClass) : provider;
        const prototype = classToken.prototype;
        const ngOnDestroy = prototype.ngOnDestroy;
        if (ngOnDestroy) {
            const hooks = tView.destroyHooks || (tView.destroyHooks = []);
            if (!providerIsTypeProvider && provider.multi) {
                ngDevMode &&
                    assertDefined(indexInFactory, 'indexInFactory when registering multi factory destroy hook');
                const existingCallbacksIndex = hooks.indexOf(contextIndex);
                if (existingCallbacksIndex === -1) {
                    hooks.push(contextIndex, [indexInFactory, ngOnDestroy]);
                }
                else {
                    hooks[existingCallbacksIndex + 1].push(indexInFactory, ngOnDestroy);
                }
            }
            else {
                hooks.push(contextIndex, ngOnDestroy);
            }
        }
    }
}
/**
 * Add a factory in a multi factory.
 * @returns Index at which the factory was inserted.
 */
function multiFactoryAdd(multiFactory, factory, isComponentProvider) {
    if (isComponentProvider) {
        multiFactory.componentProviders++;
    }
    return multiFactory.multi.push(factory) - 1;
}
/**
 * Returns the index of item in the array, but only in the begin to end range.
 */
function indexOf(item, arr, begin, end) {
    for (let i = begin; i < end; i++) {
        if (arr[i] === item)
            return i;
    }
    return -1;
}
/**
 * Use this with `multi` `providers`.
 */
function multiProvidersFactoryResolver(_, tData, lData, tNode) {
    return multiResolve(this.multi, []);
}
/**
 * Use this with `multi` `viewProviders`.
 *
 * This factory knows how to concatenate itself with the existing `multi` `providers`.
 */
function multiViewProvidersFactoryResolver(_, tData, lView, tNode) {
    const factories = this.multi;
    let result;
    if (this.providerFactory) {
        const componentCount = this.providerFactory.componentProviders;
        const multiProviders = getNodeInjectable(lView, lView[TVIEW], this.providerFactory.index, tNode);
        // Copy the section of the array which contains `multi` `providers` from the component
        result = multiProviders.slice(0, componentCount);
        // Insert the `viewProvider` instances.
        multiResolve(factories, result);
        // Copy the section of the array which contains `multi` `providers` from other directives
        for (let i = componentCount; i < multiProviders.length; i++) {
            result.push(multiProviders[i]);
        }
    }
    else {
        result = [];
        // Insert the `viewProvider` instances.
        multiResolve(factories, result);
    }
    return result;
}
/**
 * Maps an array of factories into an array of values.
 */
function multiResolve(factories, result) {
    for (let i = 0; i < factories.length; i++) {
        const factory = factories[i];
        result.push(factory());
    }
    return result;
}
/**
 * Creates a multi factory.
 */
function multiFactory(factoryFn, index, isViewProvider, isComponent, f) {
    const factory = new NodeInjectorFactory(factoryFn, isViewProvider, ɵɵdirectiveInject);
    factory.multi = [];
    factory.index = index;
    factory.componentProviders = 0;
    multiFactoryAdd(factory, f, isComponent && !isViewProvider);
    return factory;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlfc2V0dXAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL2RpX3NldHVwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRXBELE9BQU8sRUFBQyxlQUFlLEVBQUUsY0FBYyxFQUFpQixNQUFNLDJCQUEyQixDQUFDO0FBQzFGLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3BELE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUU3QyxPQUFPLEVBQUMsMkJBQTJCLEVBQUUsNEJBQTRCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUNwRyxPQUFPLEVBQ0wsa0JBQWtCLEVBQ2xCLGlCQUFpQixFQUNqQiw4QkFBOEIsRUFDOUIsWUFBWSxHQUNiLE1BQU0sTUFBTSxDQUFDO0FBQ2QsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFFckQsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFRMUQsT0FBTyxFQUFDLGNBQWMsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBQ3hELE9BQU8sRUFBZ0MsS0FBSyxFQUFRLE1BQU0sbUJBQW1CLENBQUM7QUFDOUUsT0FBTyxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRTVEOzs7Ozs7Ozs7Ozs7Ozs7OztHQWlCRztBQUNILE1BQU0sVUFBVSxpQkFBaUIsQ0FDL0IsR0FBb0IsRUFDcEIsU0FBcUIsRUFDckIsYUFBeUI7SUFFekIsTUFBTSxLQUFLLEdBQUcsUUFBUSxFQUFFLENBQUM7SUFDekIsSUFBSSxLQUFLLENBQUMsZUFBZSxFQUFFLENBQUM7UUFDMUIsTUFBTSxXQUFXLEdBQUcs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UUFDTixNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ1osdUNBQXVDO1FBQ3ZDLFlBQVksQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDbEMsQ0FBQztJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsWUFBWSxDQUFDLFNBQTJCLEVBQUUsTUFBYTtJQUM5RCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQzFDLE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQWdCLENBQUM7UUFDNUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQ3pCLENBQUM7SUFDRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLFlBQVksQ0FDbkIsU0FNUSxFQUNSLEtBQWEsRUFDYixjQUF1QixFQUN2QixXQUFvQixFQUNwQixDQUFZO0lBRVosTUFBTSxPQUFPLEdBQUcsSUFBSSxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsY0FBYyxFQUFFLGlCQUFpQixDQUFDLENBQUM7SUFDdEYsT0FBTyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUM7SUFDbkIsT0FBTyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDdEIsT0FBTyxDQUFDLGtCQUFrQixHQUFHLENBQUMsQ0FBQztJQUMvQixlQUFlLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxXQUFXLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUM1RCxPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7cmVzb2x2ZUZvcndhcmRSZWZ9IGZyb20gJy4uL2RpL2ZvcndhcmRfcmVmJztcbmltcG9ydCB7Q2xhc3NQcm92aWRlciwgUHJvdmlkZXJ9IGZyb20gJy4uL2RpL2ludGVyZmFjZS9wcm92aWRlcic7XG5pbXBvcnQge2lzQ2xhc3NQcm92aWRlciwgaXNUeXBlUHJvdmlkZXIsIFNpbmdsZVByb3ZpZGVyfSBmcm9tICcuLi9kaS9wcm92aWRlcl9jb2xsZWN0aW9uJztcbmltcG9ydCB7cHJvdmlkZXJUb0ZhY3Rvcnl9IGZyb20gJy4uL2RpL3IzX2luamVjdG9yJztcbmltcG9ydCB7YXNzZXJ0RGVmaW5lZH0gZnJvbSAnLi4vdXRpbC9hc3NlcnQnO1xuXG5pbXBvcnQge2VtaXRQcm92aWRlckNvbmZpZ3VyZWRFdmVudCwgcnVuSW5JbmplY3RvclByb2ZpbGVyQ29udGV4dH0gZnJvbSAnLi9kZWJ1Zy9pbmplY3Rvcl9wcm9maWxlcic7XG5pbXBvcnQge1xuICBkaVB1YmxpY0luSW5qZWN0b3IsXG4gIGdldE5vZGVJbmplY3RhYmxlLFxuICBnZXRPckNyZWF0ZU5vZGVJbmplY3RvckZvck5vZGUsXG4gIE5vZGVJbmplY3Rvcixcbn0gZnJvbSAnLi9kaSc7XG5pbXBvcnQge8m1ybVkaXJlY3RpdmVJbmplY3R9IGZyb20gJy4vaW5zdHJ1Y3Rpb25zL2FsbCc7XG5pbXBvcnQge0RpcmVjdGl2ZURlZn0gZnJvbSAnLi9pbnRlcmZhY2VzL2RlZmluaXRpb24nO1xuaW1wb3J0IHtOb2RlSW5qZWN0b3JGYWN0b3J5fSBmcm9tICcuL2ludGVyZmFjZXMvaW5qZWN0b3InO1xuaW1wb3J0IHtcbiAgVENvbnRhaW5lck5vZGUsXG4gIFREaXJlY3RpdmVIb3N0Tm9kZSxcbiAgVEVsZW1lbnRDb250YWluZXJOb2RlLFxuICBURWxlbWVudE5vZGUsXG4gIFROb2RlUHJvdmlkZXJJbmRleGVzLFxufSBmcm9tICcuL2ludGVyZmFjZXMvbm9kZSc7XG5pbXBvcnQge2lzQ29tcG9uZW50RGVmfSBmcm9tICcuL2ludGVyZmFjZXMvdHlwZV9jaGVja3MnO1xuaW1wb3J0IHtEZXN0cm95SG9va0RhdGEsIExWaWV3LCBURGF0YSwgVFZJRVcsIFRWaWV3fSBmcm9tICcuL2ludGVyZmFjZXMvdmlldyc7XG5pbXBvcnQge2dldEN1cnJlbnRUTm9kZSwgZ2V0TFZpZXcsIGdldFRWaWV3fSBmcm9tICcuL3N0YXRlJztcblxuLyoqXG4gKiBSZXNvbHZlcyB0aGUgcHJvdmlkZXJzIHdoaWNoIGFyZSBkZWZpbmVkIGluIHRoZSBEaXJlY3RpdmVEZWYuXG4gKlxuICogV2hlbiBpbnNlcnRpbmcgdGhlIHRva2VucyBhbmQgdGhlIGZhY3RvcmllcyBpbiB0aGVpciByZXNwZWN0aXZlIGFycmF5cywgd2UgY2FuIGFzc3VtZSB0aGF0XG4gKiB0aGlzIG1ldGhvZCBpcyBjYWxsZWQgZmlyc3QgZm9yIHRoZSBjb21wb25lbnQgKGlmIGFueSksIGFuZCB0aGVuIGZvciBvdGhlciBkaXJlY3RpdmVzIG9uIHRoZSBzYW1lXG4gKiBub2RlLlxuICogQXMgYSBjb25zZXF1ZW5jZSx0aGUgcHJvdmlkZXJzIGFyZSBhbHdheXMgcHJvY2Vzc2VkIGluIHRoYXQgb3JkZXI6XG4gKiAxKSBUaGUgdmlldyBwcm92aWRlcnMgb2YgdGhlIGNvbXBvbmVudFxuICogMikgVGhlIHByb3ZpZGVycyBvZiB0aGUgY29tcG9uZW50XG4gKiAzKSBUaGUgcHJvdmlkZXJzIG9mIHRoZSBvdGhlciBkaXJlY3RpdmVzXG4gKiBUaGlzIG1hdGNoZXMgdGhlIHN0cnVjdHVyZSBvZiB0aGUgaW5qZWN0YWJsZXMgYXJyYXlzIG9mIGEgdmlldyAoZm9yIGVhY2ggbm9kZSkuXG4gKiBTbyB0aGUgdG9rZW5zIGFuZCB0aGUgZmFjdG9yaWVzIGNhbiBiZSBwdXNoZWQgYXQgdGhlIGVuZCBvZiB0aGUgYXJyYXlzLCBleGNlcHRcbiAqIGluIG9uZSBjYXNlIGZvciBtdWx0aSBwcm92aWRlcnMuXG4gKlxuICogQHBhcmFtIGRlZiB0aGUgZGlyZWN0aXZlIGRlZmluaXRpb25cbiAqIEBwYXJhbSBwcm92aWRlcnM6IEFycmF5IG9mIGBwcm92aWRlcnNgLlxuICogQHBhcmFtIHZpZXdQcm92aWRlcnM6IEFycmF5IG9mIGB2aWV3UHJvdmlkZXJzYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByb3ZpZGVyc1Jlc29sdmVyPFQ+KFxuICBkZWY6IERpcmVjdGl2ZURlZjxUPixcbiAgcHJvdmlkZXJzOiBQcm92aWRlcltdLFxuICB2aWV3UHJvdmlkZXJzOiBQcm92aWRlcltdLFxuKTogdm9pZCB7XG4gIGNvbnN0IHRWaWV3ID0gZ2V0VFZpZXcoKTtcbiAgaWYgKHRWaWV3LmZpcnN0Q3JlYXRlUGFzcykge1xuICAgIGNvbnN0IGlzQ29tcG9uZW50ID0gaXNDb21wb25lbnREZWYoZGVmKTtcblxuICAgIC8vIFRoZSBsaXN0IG9mIHZpZXcgcHJvdmlkZXJzIGlzIHByb2Nlc3NlZCBmaXJzdCwgYW5kIHRoZSBmbGFncyBhcmUgdXBkYXRlZFxuICAgIHJlc29sdmVQcm92aWRlcih2aWV3UHJvdmlkZXJzLCB0Vmlldy5kYXRhLCB0Vmlldy5ibHVlcHJpbnQsIGlzQ29tcG9uZW50LCB0cnVlKTtcblxuICAgIC8vIFRoZW4sIHRoZSBsaXN0IG9mIHByb3ZpZGVycyBpcyBwcm9jZXNzZWQsIGFuZCB0aGUgZmxhZ3MgYXJlIHVwZGF0ZWRcbiAgICByZXNvbHZlUHJvdmlkZXIocHJvdmlkZXJzLCB0Vmlldy5kYXRhLCB0Vmlldy5ibHVlcHJpbnQsIGlzQ29tcG9uZW50LCBmYWxzZSk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXNvbHZlcyBhIHByb3ZpZGVyIGFuZCBwdWJsaXNoZXMgaXQgdG8gdGhlIERJIHN5c3RlbS5cbiAqL1xuZnVuY3Rpb24gcmVzb2x2ZVByb3ZpZGVyKFxuICBwcm92aWRlcjogUHJvdmlkZXIsXG4gIHRJbmplY3RhYmxlczogVERhdGEsXG4gIGxJbmplY3RhYmxlc0JsdWVwcmludDogTm9kZUluamVjdG9yRmFjdG9yeVtdLFxuICBpc0NvbXBvbmVudDogYm9vbGVhbixcbiAgaXNWaWV3UHJvdmlkZXI6IGJvb2xlYW4sXG4pOiB2b2lkIHtcbiAgcHJvdmlkZXIgPSByZXNvbHZlRm9yd2FyZFJlZihwcm92aWRlcik7XG4gIGlmIChBcnJheS5pc0FycmF5KHByb3ZpZGVyKSkge1xuICAgIC8vIFJlY3Vyc2l2ZWx5IGNhbGwgYHJlc29sdmVQcm92aWRlcmBcbiAgICAvLyBSZWN1cnNpb24gaXMgT0sgaW4gdGhpcyBjYXNlIGJlY2F1c2UgdGhpcyBjb2RlIHdpbGwgbm90IGJlIGluIGhvdC1wYXRoIG9uY2Ugd2UgaW1wbGVtZW50XG4gICAgLy8gY2xvbmluZyBvZiB0aGUgaW5pdGlhbCBzdGF0ZS5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByb3ZpZGVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICByZXNvbHZlUHJvdmlkZXIoXG4gICAgICAgIHByb3ZpZGVyW2ldLFxuICAgICAgICB0SW5qZWN0YWJsZXMsXG4gICAgICAgIGxJbmplY3RhYmxlc0JsdWVwcmludCxcbiAgICAgICAgaXNDb21wb25lbnQsXG4gICAgICAgIGlzVmlld1Byb3ZpZGVyLFxuICAgICAgKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgdFZpZXcgPSBnZXRUVmlldygpO1xuICAgIGNvbnN0IGxWaWV3ID0gZ2V0TFZpZXcoKTtcbiAgICBjb25zdCB0Tm9kZSA9IGdldEN1cnJlbnRUTm9kZSgpITtcbiAgICBsZXQgdG9rZW46IGFueSA9IGlzVHlwZVByb3ZpZGVyKHByb3ZpZGVyKSA/IHByb3ZpZGVyIDogcmVzb2x2ZUZvcndhcmRSZWYocHJvdmlkZXIucHJvdmlkZSk7XG5cbiAgICBjb25zdCBwcm92aWRlckZhY3RvcnkgPSBwcm92aWRlclRvRmFjdG9yeShwcm92aWRlcik7XG4gICAgaWYgKG5nRGV2TW9kZSkge1xuICAgICAgY29uc3QgaW5qZWN0b3IgPSBuZXcgTm9kZUluamVjdG9yKFxuICAgICAgICB0Tm9kZSBhcyBURWxlbWVudE5vZGUgfCBUQ29udGFpbmVyTm9kZSB8IFRFbGVtZW50Q29udGFpbmVyTm9kZSxcbiAgICAgICAgbFZpZXcsXG4gICAgICApO1xuICAgICAgcnVuSW5JbmplY3RvclByb2ZpbGVyQ29udGV4dChpbmplY3RvciwgdG9rZW4sICgpID0+IHtcbiAgICAgICAgZW1pdFByb3ZpZGVyQ29uZmlndXJlZEV2ZW50KHByb3ZpZGVyIGFzIFNpbmdsZVByb3ZpZGVyLCBpc1ZpZXdQcm92aWRlcik7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBiZWdpbkluZGV4ID0gdE5vZGUucHJvdmlkZXJJbmRleGVzICYgVE5vZGVQcm92aWRlckluZGV4ZXMuUHJvdmlkZXJzU3RhcnRJbmRleE1hc2s7XG4gICAgY29uc3QgZW5kSW5kZXggPSB0Tm9kZS5kaXJlY3RpdmVTdGFydDtcbiAgICBjb25zdCBjcHRWaWV3UHJvdmlkZXJzQ291bnQgPVxuICAgICAgdE5vZGUucHJvdmlkZXJJbmRleGVzID4+IFROb2RlUHJvdmlkZXJJbmRleGVzLkNwdFZpZXdQcm92aWRlcnNDb3VudFNoaWZ0O1xuXG4gICAgaWYgKGlzVHlwZVByb3ZpZGVyKHByb3ZpZGVyKSB8fCAhcHJvdmlkZXIubXVsdGkpIHtcbiAgICAgIC8vIFNpbmdsZSBwcm92aWRlciBjYXNlOiB0aGUgZmFjdG9yeSBpcyBjcmVhdGVkIGFuZCBwdXNoZWQgaW1tZWRpYXRlbHlcbiAgICAgIGNvbnN0IGZhY3RvcnkgPSBuZXcgTm9kZUluamVjdG9yRmFjdG9yeShwcm92aWRlckZhY3RvcnksIGlzVmlld1Byb3ZpZGVyLCDJtcm1ZGlyZWN0aXZlSW5qZWN0KTtcbiAgICAgIGNvbnN0IGV4aXN0aW5nRmFjdG9yeUluZGV4ID0gaW5kZXhPZihcbiAgICAgICAgdG9rZW4sXG4gICAgICAgIHRJbmplY3RhYmxlcyxcbiAgICAgICAgaXNWaWV3UHJvdmlkZXIgPyBiZWdpbkluZGV4IDogYmVnaW5JbmRleCArIGNwdFZpZXdQcm92aWRlcnNDb3VudCxcbiAgICAgICAgZW5kSW5kZXgsXG4gICAgICApO1xuICAgICAgaWYgKGV4aXN0aW5nRmFjdG9yeUluZGV4ID09PSAtMSkge1xuICAgICAgICBkaVB1YmxpY0luSW5qZWN0b3IoXG4gICAgICAgICAgZ2V0T3JDcmVhdGVOb2RlSW5qZWN0b3JGb3JOb2RlKFxuICAgICAgICAgICAgdE5vZGUgYXMgVEVsZW1lbnROb2RlIHwgVENvbnRhaW5lck5vZGUgfCBURWxlbWVudENvbnRhaW5lck5vZGUsXG4gICAgICAgICAgICBsVmlldyxcbiAgICAgICAgICApLFxuICAgICAgICAgIHRWaWV3LFxuICAgICAgICAgIHRva2VuLFxuICAgICAgICApO1xuICAgICAgICByZWdpc3RlckRlc3Ryb3lIb29rc0lmU3VwcG9ydGVkKHRWaWV3LCBwcm92aWRlciwgdEluamVjdGFibGVzLmxlbmd0aCk7XG4gICAgICAgIHRJbmplY3RhYmxlcy5wdXNoKHRva2VuKTtcbiAgICAgICAgdE5vZGUuZGlyZWN0aXZlU3RhcnQrKztcbiAgICAgICAgdE5vZGUuZGlyZWN0aXZlRW5kKys7XG4gICAgICAgIGlmIChpc1ZpZXdQcm92aWRlcikge1xuICAgICAgICAgIHROb2RlLnByb3ZpZGVySW5kZXhlcyArPSBUTm9kZVByb3ZpZGVySW5kZXhlcy5DcHRWaWV3UHJvdmlkZXJzQ291bnRTaGlmdGVyO1xuICAgICAgICB9XG4gICAgICAgIGxJbmplY3RhYmxlc0JsdWVwcmludC5wdXNoKGZhY3RvcnkpO1xuICAgICAgICBsVmlldy5wdXNoKGZhY3RvcnkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbEluamVjdGFibGVzQmx1ZXByaW50W2V4aXN0aW5nRmFjdG9yeUluZGV4XSA9IGZhY3Rvcnk7XG4gICAgICAgIGxWaWV3W2V4aXN0aW5nRmFjdG9yeUluZGV4XSA9IGZhY3Rvcnk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE11bHRpIHByb3ZpZGVyIGNhc2U6XG4gICAgICAvLyBXZSBjcmVhdGUgYSBtdWx0aSBmYWN0b3J5IHdoaWNoIGlzIGdvaW5nIHRvIGFnZ3JlZ2F0ZSBhbGwgdGhlIHZhbHVlcy5cbiAgICAgIC8vIFNpbmNlIHRoZSBvdXRwdXQgb2Ygc3VjaCBhIGZhY3RvcnkgZGVwZW5kcyBvbiBjb250ZW50IG9yIHZpZXcgaW5qZWN0aW9uLFxuICAgICAgLy8gd2UgY3JlYXRlIHR3byBvZiB0aGVtLCB3aGljaCBhcmUgbGlua2VkIHRvZ2V0aGVyLlxuICAgICAgLy9cbiAgICAgIC8vIFRoZSBmaXJzdCBvbmUgKGZvciB2aWV3IHByb3ZpZGVycykgaXMgYWx3YXlzIGluIHRoZSBmaXJzdCBibG9jayBvZiB0aGUgaW5qZWN0YWJsZXMgYXJyYXksXG4gICAgICAvLyBhbmQgdGhlIHNlY29uZCBvbmUgKGZvciBwcm92aWRlcnMpIGlzIGFsd2F5cyBpbiB0aGUgc2Vjb25kIGJsb2NrLlxuICAgICAgLy8gVGhpcyBpcyBpbXBvcnRhbnQgYmVjYXVzZSB2aWV3IHByb3ZpZGVycyBoYXZlIGhpZ2hlciBwcmlvcml0eS4gV2hlbiBhIG11bHRpIHRva2VuXG4gICAgICAvLyBpcyBiZWluZyBsb29rZWQgdXAsIHRoZSB2aWV3IHByb3ZpZGVycyBzaG91bGQgYmUgZm91bmQgZmlyc3QuXG4gICAgICAvLyBOb3RlIHRoYXQgaXQgaXMgbm90IHBvc3NpYmxlIHRvIGhhdmUgYSBtdWx0aSBmYWN0b3J5IGluIHRoZSB0aGlyZCBibG9jayAoZGlyZWN0aXZlIGJsb2NrKS5cbiAgICAgIC8vXG4gICAgICAvLyBUaGUgYWxnb3JpdGhtIHRvIHByb2Nlc3MgbXVsdGkgcHJvdmlkZXJzIGlzIGFzIGZvbGxvd3M6XG4gICAgICAvLyAxKSBJZiB0aGUgbXVsdGkgcHJvdmlkZXIgY29tZXMgZnJvbSB0aGUgYHZpZXdQcm92aWRlcnNgIG9mIHRoZSBjb21wb25lbnQ6XG4gICAgICAvLyAgIGEpIElmIHRoZSBzcGVjaWFsIHZpZXcgcHJvdmlkZXJzIGZhY3RvcnkgZG9lc24ndCBleGlzdCwgaXQgaXMgY3JlYXRlZCBhbmQgcHVzaGVkLlxuICAgICAgLy8gICBiKSBFbHNlLCB0aGUgbXVsdGkgcHJvdmlkZXIgaXMgYWRkZWQgdG8gdGhlIGV4aXN0aW5nIG11bHRpIGZhY3RvcnkuXG4gICAgICAvLyAyKSBJZiB0aGUgbXVsdGkgcHJvdmlkZXIgY29tZXMgZnJvbSB0aGUgYHByb3ZpZGVyc2Agb2YgdGhlIGNvbXBvbmVudCBvciBvZiBhbm90aGVyXG4gICAgICAvLyBkaXJlY3RpdmU6XG4gICAgICAvLyAgIGEpIElmIHRoZSBtdWx0aSBmYWN0b3J5IGRvZXNuJ3QgZXhpc3QsIGl0IGlzIGNyZWF0ZWQgYW5kIHByb3ZpZGVyIHB1c2hlZCBpbnRvIGl0LlxuICAgICAgLy8gICAgICBJdCBpcyBhbHNvIGxpbmtlZCB0byB0aGUgbXVsdGkgZmFjdG9yeSBmb3IgdmlldyBwcm92aWRlcnMsIGlmIGl0IGV4aXN0cy5cbiAgICAgIC8vICAgYikgRWxzZSwgdGhlIG11bHRpIHByb3ZpZGVyIGlzIGFkZGVkIHRvIHRoZSBleGlzdGluZyBtdWx0aSBmYWN0b3J5LlxuXG4gICAgICBjb25zdCBleGlzdGluZ1Byb3ZpZGVyc0ZhY3RvcnlJbmRleCA9IGluZGV4T2YoXG4gICAgICAgIHRva2VuLFxuICAgICAgICB0SW5qZWN0YWJsZXMsXG4gICAgICAgIGJlZ2luSW5kZXggKyBjcHRWaWV3UHJvdmlkZXJzQ291bnQsXG4gICAgICAgIGVuZEluZGV4LFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGV4aXN0aW5nVmlld1Byb3ZpZGVyc0ZhY3RvcnlJbmRleCA9IGluZGV4T2YoXG4gICAgICAgIHRva2VuLFxuICAgICAgICB0SW5qZWN0YWJsZXMsXG4gICAgICAgIGJlZ2luSW5kZXgsXG4gICAgICAgIGJlZ2luSW5kZXggKyBjcHRWaWV3UHJvdmlkZXJzQ291bnQsXG4gICAgICApO1xuICAgICAgY29uc3QgZG9lc1Byb3ZpZGVyc0ZhY3RvcnlFeGlzdCA9XG4gICAgICAgIGV4aXN0aW5nUHJvdmlkZXJzRmFjdG9yeUluZGV4ID49IDAgJiYgbEluamVjdGFibGVzQmx1ZXByaW50W2V4aXN0aW5nUHJvdmlkZXJzRmFjdG9yeUluZGV4XTtcbiAgICAgIGNvbnN0IGRvZXNWaWV3UHJvdmlkZXJzRmFjdG9yeUV4aXN0ID1cbiAgICAgICAgZXhpc3RpbmdWaWV3UHJvdmlkZXJzRmFjdG9yeUluZGV4ID49IDAgJiZcbiAgICAgICAgbEluamVjdGFibGVzQmx1ZXByaW50W2V4aXN0aW5nVmlld1Byb3ZpZGVyc0ZhY3RvcnlJbmRleF07XG5cbiAgICAgIGlmIChcbiAgICAgICAgKGlzVmlld1Byb3ZpZGVyICYmICFkb2VzVmlld1Byb3ZpZGVyc0ZhY3RvcnlFeGlzdCkgfHxcbiAgICAgICAgKCFpc1ZpZXdQcm92aWRlciAmJiAhZG9lc1Byb3ZpZGVyc0ZhY3RvcnlFeGlzdClcbiAgICAgICkge1xuICAgICAgICAvLyBDYXNlcyAxLmEgYW5kIDIuYVxuICAgICAgICBkaVB1YmxpY0luSW5qZWN0b3IoXG4gICAgICAgICAgZ2V0T3JDcmVhdGVOb2RlSW5qZWN0b3JGb3JOb2RlKFxuICAgICAgICAgICAgdE5vZGUgYXMgVEVsZW1lbnROb2RlIHwgVENvbnRhaW5lck5vZGUgfCBURWxlbWVudENvbnRhaW5lck5vZGUsXG4gICAgICAgICAgICBsVmlldyxcbiAgICAgICAgICApLFxuICAgICAgICAgIHRWaWV3LFxuICAgICAgICAgIHRva2VuLFxuICAgICAgICApO1xuICAgICAgICBjb25zdCBmYWN0b3J5ID0gbXVsdGlGYWN0b3J5KFxuICAgICAgICAgIGlzVmlld1Byb3ZpZGVyID8gbXVsdGlWaWV3UHJvdmlkZXJzRmFjdG9yeVJlc29sdmVyIDogbXVsdGlQcm92aWRlcnNGYWN0b3J5UmVzb2x2ZXIsXG4gICAgICAgICAgbEluamVjdGFibGVzQmx1ZXByaW50Lmxlbmd0aCxcbiAgICAgICAgICBpc1ZpZXdQcm92aWRlcixcbiAgICAgICAgICBpc0NvbXBvbmVudCxcbiAgICAgICAgICBwcm92aWRlckZhY3RvcnksXG4gICAgICAgICk7XG4gICAgICAgIGlmICghaXNWaWV3UHJvdmlkZXIgJiYgZG9lc1ZpZXdQcm92aWRlcnNGYWN0b3J5RXhpc3QpIHtcbiAgICAgICAgICBsSW5qZWN0YWJsZXNCbHVlcHJpbnRbZXhpc3RpbmdWaWV3UHJvdmlkZXJzRmFjdG9yeUluZGV4XS5wcm92aWRlckZhY3RvcnkgPSBmYWN0b3J5O1xuICAgICAgICB9XG4gICAgICAgIHJlZ2lzdGVyRGVzdHJveUhvb2tzSWZTdXBwb3J0ZWQodFZpZXcsIHByb3ZpZGVyLCB0SW5qZWN0YWJsZXMubGVuZ3RoLCAwKTtcbiAgICAgICAgdEluamVjdGFibGVzLnB1c2godG9rZW4pO1xuICAgICAgICB0Tm9kZS5kaXJlY3RpdmVTdGFydCsrO1xuICAgICAgICB0Tm9kZS5kaXJlY3RpdmVFbmQrKztcbiAgICAgICAgaWYgKGlzVmlld1Byb3ZpZGVyKSB7XG4gICAgICAgICAgdE5vZGUucHJvdmlkZXJJbmRleGVzICs9IFROb2RlUHJvdmlkZXJJbmRleGVzLkNwdFZpZXdQcm92aWRlcnNDb3VudFNoaWZ0ZXI7XG4gICAgICAgIH1cbiAgICAgICAgbEluamVjdGFibGVzQmx1ZXByaW50LnB1c2goZmFjdG9yeSk7XG4gICAgICAgIGxWaWV3LnB1c2goZmFjdG9yeSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBDYXNlcyAxLmIgYW5kIDIuYlxuICAgICAgICBjb25zdCBpbmRleEluRmFjdG9yeSA9IG11bHRpRmFjdG9yeUFkZChcbiAgICAgICAgICBsSW5qZWN0YWJsZXNCbHVlcHJpbnQhW1xuICAgICAgICAgICAgaXNWaWV3UHJvdmlkZXIgPyBleGlzdGluZ1ZpZXdQcm92aWRlcnNGYWN0b3J5SW5kZXggOiBleGlzdGluZ1Byb3ZpZGVyc0ZhY3RvcnlJbmRleFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcHJvdmlkZXJGYWN0b3J5LFxuICAgICAgICAgICFpc1ZpZXdQcm92aWRlciAmJiBpc0NvbXBvbmVudCxcbiAgICAgICAgKTtcbiAgICAgICAgcmVnaXN0ZXJEZXN0cm95SG9va3NJZlN1cHBvcnRlZChcbiAgICAgICAgICB0VmlldyxcbiAgICAgICAgICBwcm92aWRlcixcbiAgICAgICAgICBleGlzdGluZ1Byb3ZpZGVyc0ZhY3RvcnlJbmRleCA+IC0xXG4gICAgICAgICAgICA/IGV4aXN0aW5nUHJvdmlkZXJzRmFjdG9yeUluZGV4XG4gICAgICAgICAgICA6IGV4aXN0aW5nVmlld1Byb3ZpZGVyc0ZhY3RvcnlJbmRleCxcbiAgICAgICAgICBpbmRleEluRmFjdG9yeSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmICghaXNWaWV3UHJvdmlkZXIgJiYgaXNDb21wb25lbnQgJiYgZG9lc1ZpZXdQcm92aWRlcnNGYWN0b3J5RXhpc3QpIHtcbiAgICAgICAgbEluamVjdGFibGVzQmx1ZXByaW50W2V4aXN0aW5nVmlld1Byb3ZpZGVyc0ZhY3RvcnlJbmRleF0uY29tcG9uZW50UHJvdmlkZXJzISsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFJlZ2lzdGVycyB0aGUgYG5nT25EZXN0cm95YCBob29rIG9mIGEgcHJvdmlkZXIsIGlmIHRoZSBwcm92aWRlciBzdXBwb3J0cyBkZXN0cm95IGhvb2tzLlxuICogQHBhcmFtIHRWaWV3IGBUVmlld2AgaW4gd2hpY2ggdG8gcmVnaXN0ZXIgdGhlIGhvb2suXG4gKiBAcGFyYW0gcHJvdmlkZXIgUHJvdmlkZXIgd2hvc2UgaG9vayBzaG91bGQgYmUgcmVnaXN0ZXJlZC5cbiAqIEBwYXJhbSBjb250ZXh0SW5kZXggSW5kZXggdW5kZXIgd2hpY2ggdG8gZmluZCB0aGUgY29udGV4dCBmb3IgdGhlIGhvb2sgd2hlbiBpdCdzIGJlaW5nIGludm9rZWQuXG4gKiBAcGFyYW0gaW5kZXhJbkZhY3RvcnkgT25seSByZXF1aXJlZCBmb3IgYG11bHRpYCBwcm92aWRlcnMuIEluZGV4IG9mIHRoZSBwcm92aWRlciBpbiB0aGUgbXVsdGlcbiAqIHByb3ZpZGVyIGZhY3RvcnkuXG4gKi9cbmZ1bmN0aW9uIHJlZ2lzdGVyRGVzdHJveUhvb2tzSWZTdXBwb3J0ZWQoXG4gIHRWaWV3OiBUVmlldyxcbiAgcHJvdmlkZXI6IEV4Y2x1ZGU8UHJvdmlkZXIsIGFueVtdPixcbiAgY29udGV4dEluZGV4OiBudW1iZXIsXG4gIGluZGV4SW5GYWN0b3J5PzogbnVtYmVyLFxuKSB7XG4gIGNvbnN0IHByb3ZpZGVySXNUeXBlUHJvdmlkZXIgPSBpc1R5cGVQcm92aWRlcihwcm92aWRlcik7XG4gIGNvbnN0IHByb3ZpZGVySXNDbGFzc1Byb3ZpZGVyID0gaXNDbGFzc1Byb3ZpZGVyKHByb3ZpZGVyKTtcblxuICBpZiAocHJvdmlkZXJJc1R5cGVQcm92aWRlciB8fCBwcm92aWRlcklzQ2xhc3NQcm92aWRlcikge1xuICAgIC8vIFJlc29sdmUgZm9yd2FyZCByZWZlcmVuY2VzIGFzIGB1c2VDbGFzc2AgY2FuIGhvbGQgYSBmb3J3YXJkIHJlZmVyZW5jZS5cbiAgICBjb25zdCBjbGFzc1Rva2VuID0gcHJvdmlkZXJJc0NsYXNzUHJvdmlkZXIgPyByZXNvbHZlRm9yd2FyZFJlZihwcm92aWRlci51c2VDbGFzcykgOiBwcm92aWRlcjtcbiAgICBjb25zdCBwcm90b3R5cGUgPSBjbGFzc1Rva2VuLnByb3RvdHlwZTtcbiAgICBjb25zdCBuZ09uRGVzdHJveSA9IHByb3RvdHlwZS5uZ09uRGVzdHJveTtcblxuICAgIGlmIChuZ09uRGVzdHJveSkge1xuICAgICAgY29uc3QgaG9va3MgPSB0Vmlldy5kZXN0cm95SG9va3MgfHwgKHRWaWV3LmRlc3Ryb3lIb29rcyA9IFtdKTtcblxuICAgICAgaWYgKCFwcm92aWRlcklzVHlwZVByb3ZpZGVyICYmIChwcm92aWRlciBhcyBDbGFzc1Byb3ZpZGVyKS5tdWx0aSkge1xuICAgICAgICBuZ0Rldk1vZGUgJiZcbiAgICAgICAgICBhc3NlcnREZWZpbmVkKFxuICAgICAgICAgICAgaW5kZXhJbkZhY3RvcnksXG4gICAgICAgICAgICAnaW5kZXhJbkZhY3Rvcnkgd2hlbiByZWdpc3RlcmluZyBtdWx0aSBmYWN0b3J5IGRlc3Ryb3kgaG9vaycsXG4gICAgICAgICAgKTtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdDYWxsYmFja3NJbmRleCA9IGhvb2tzLmluZGV4T2YoY29udGV4dEluZGV4KTtcblxuICAgICAgICBpZiAoZXhpc3RpbmdDYWxsYmFja3NJbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICBob29rcy5wdXNoKGNvbnRleHRJbmRleCwgW2luZGV4SW5GYWN0b3J5LCBuZ09uRGVzdHJveV0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIChob29rc1tleGlzdGluZ0NhbGxiYWNrc0luZGV4ICsgMV0gYXMgRGVzdHJveUhvb2tEYXRhKS5wdXNoKGluZGV4SW5GYWN0b3J5ISwgbmdPbkRlc3Ryb3kpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBob29rcy5wdXNoKGNvbnRleHRJbmRleCwgbmdPbkRlc3Ryb3kpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEFkZCBhIGZhY3RvcnkgaW4gYSBtdWx0aSBmYWN0b3J5LlxuICogQHJldHVybnMgSW5kZXggYXQgd2hpY2ggdGhlIGZhY3Rvcnkgd2FzIGluc2VydGVkLlxuICovXG5mdW5jdGlvbiBtdWx0aUZhY3RvcnlBZGQoXG4gIG11bHRpRmFjdG9yeTogTm9kZUluamVjdG9yRmFjdG9yeSxcbiAgZmFjdG9yeTogKCkgPT4gYW55LFxuICBpc0NvbXBvbmVudFByb3ZpZGVyOiBib29sZWFuLFxuKTogbnVtYmVyIHtcbiAgaWYgKGlzQ29tcG9uZW50UHJvdmlkZXIpIHtcbiAgICBtdWx0aUZhY3RvcnkuY29tcG9uZW50UHJvdmlkZXJzISsrO1xuICB9XG4gIHJldHVybiBtdWx0aUZhY3RvcnkubXVsdGkhLnB1c2goZmFjdG9yeSkgLSAxO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGluZGV4IG9mIGl0ZW0gaW4gdGhlIGFycmF5LCBidXQgb25seSBpbiB0aGUgYmVnaW4gdG8gZW5kIHJhbmdlLlxuICovXG5mdW5jdGlvbiBpbmRleE9mKGl0ZW06IGFueSwgYXJyOiBhbnlbXSwgYmVnaW46IG51bWJlciwgZW5kOiBudW1iZXIpIHtcbiAgZm9yIChsZXQgaSA9IGJlZ2luOyBpIDwgZW5kOyBpKyspIHtcbiAgICBpZiAoYXJyW2ldID09PSBpdGVtKSByZXR1cm4gaTtcbiAgfVxuICByZXR1cm4gLTE7XG59XG5cbi8qKlxuICogVXNlIHRoaXMgd2l0aCBgbXVsdGlgIGBwcm92aWRlcnNgLlxuICovXG5mdW5jdGlvbiBtdWx0aVByb3ZpZGVyc0ZhY3RvcnlSZXNvbHZlcihcbiAgdGhpczogTm9kZUluamVjdG9yRmFjdG9yeSxcbiAgXzogdW5kZWZpbmVkLFxuICB0RGF0YTogVERhdGEsXG4gIGxEYXRhOiBMVmlldyxcbiAgdE5vZGU6IFREaXJlY3RpdmVIb3N0Tm9kZSxcbik6IGFueVtdIHtcbiAgcmV0dXJuIG11bHRpUmVzb2x2ZSh0aGlzLm11bHRpISwgW10pO1xufVxuXG4vKipcbiAqIFVzZSB0aGlzIHdpdGggYG11bHRpYCBgdmlld1Byb3ZpZGVyc2AuXG4gKlxuICogVGhpcyBmYWN0b3J5IGtub3dzIGhvdyB0byBjb25jYXRlbmF0ZSBpdHNlbGYgd2l0aCB0aGUgZXhpc3RpbmcgYG11bHRpYCBgcHJvdmlkZXJzYC5cbiAqL1xuZnVuY3Rpb24gbXVsdGlWaWV3UHJvdmlkZXJzRmFjdG9yeVJlc29sdmVyKFxuICB0aGlzOiBOb2RlSW5qZWN0b3JGYWN0b3J5LFxuICBfOiB1bmRlZmluZWQsXG4gIHREYXRhOiBURGF0YSxcbiAgbFZpZXc6IExWaWV3LFxuICB0Tm9kZTogVERpcmVjdGl2ZUhvc3ROb2RlLFxuKTogYW55W10ge1xuICBjb25zdCBmYWN0b3JpZXMgPSB0aGlzLm11bHRpITtcbiAgbGV0IHJlc3VsdDogYW55W107XG4gIGlmICh0aGlzLnByb3ZpZGVyRmFjdG9yeSkge1xuICAgIGNvbnN0IGNvbXBvbmVudENvdW50ID0gdGhpcy5wcm92aWRlckZhY3RvcnkuY29tcG9uZW50UHJvdmlkZXJzITtcbiAgICBjb25zdCBtdWx0aVByb3ZpZGVycyA9IGdldE5vZGVJbmplY3RhYmxlKFxuICAgICAgbFZpZXcsXG4gICAgICBsVmlld1tUVklFV10sXG4gICAgICB0aGlzLnByb3ZpZGVyRmFjdG9yeSEuaW5kZXghLFxuICAgICAgdE5vZGUsXG4gICAgKTtcbiAgICAvLyBDb3B5IHRoZSBzZWN0aW9uIG9mIHRoZSBhcnJheSB3aGljaCBjb250YWlucyBgbXVsdGlgIGBwcm92aWRlcnNgIGZyb20gdGhlIGNvbXBvbmVudFxuICAgIHJlc3VsdCA9IG11bHRpUHJvdmlkZXJzLnNsaWNlKDAsIGNvbXBvbmVudENvdW50KTtcbiAgICAvLyBJbnNlcnQgdGhlIGB2aWV3UHJvdmlkZXJgIGluc3RhbmNlcy5cbiAgICBtdWx0aVJlc29sdmUoZmFjdG9yaWVzLCByZXN1bHQpO1xuICAgIC8vIENvcHkgdGhlIHNlY3Rpb24gb2YgdGhlIGFycmF5IHdoaWNoIGNvbnRhaW5zIGBtdWx0aWAgYHByb3ZpZGVyc2AgZnJvbSBvdGhlciBkaXJlY3RpdmVzXG4gICAgZm9yIChsZXQgaSA9IGNvbXBvbmVudENvdW50OyBpIDwgbXVsdGlQcm92aWRlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdC5wdXNoKG11bHRpUHJvdmlkZXJzW2ldKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgcmVzdWx0ID0gW107XG4gICAgLy8gSW5zZXJ0IHRoZSBgdmlld1Byb3ZpZGVyYCBpbnN0YW5jZXMuXG4gICAgbXVsdGlSZXNvbHZlKGZhY3RvcmllcywgcmVzdWx0KTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIE1hcHMgYW4gYXJyYXkgb2YgZmFjdG9yaWVzIGludG8gYW4gYXJyYXkgb2YgdmFsdWVzLlxuICovXG5mdW5jdGlvbiBtdWx0aVJlc29sdmUoZmFjdG9yaWVzOiBBcnJheTwoKSA9PiBhbnk+LCByZXN1bHQ6IGFueVtdKTogYW55W10ge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGZhY3Rvcmllcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGZhY3RvcnkgPSBmYWN0b3JpZXNbaV0hIGFzICgpID0+IG51bGw7XG4gICAgcmVzdWx0LnB1c2goZmFjdG9yeSgpKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBtdWx0aSBmYWN0b3J5LlxuICovXG5mdW5jdGlvbiBtdWx0aUZhY3RvcnkoXG4gIGZhY3RvcnlGbjogKFxuICAgIHRoaXM6IE5vZGVJbmplY3RvckZhY3RvcnksXG4gICAgXzogdW5kZWZpbmVkLFxuICAgIHREYXRhOiBURGF0YSxcbiAgICBsRGF0YTogTFZpZXcsXG4gICAgdE5vZGU6IFREaXJlY3RpdmVIb3N0Tm9kZSxcbiAgKSA9PiBhbnksXG4gIGluZGV4OiBudW1iZXIsXG4gIGlzVmlld1Byb3ZpZGVyOiBib29sZWFuLFxuICBpc0NvbXBvbmVudDogYm9vbGVhbixcbiAgZjogKCkgPT4gYW55LFxuKTogTm9kZUluamVjdG9yRmFjdG9yeSB7XG4gIGNvbnN0IGZhY3RvcnkgPSBuZXcgTm9kZUluamVjdG9yRmFjdG9yeShmYWN0b3J5Rm4sIGlzVmlld1Byb3ZpZGVyLCDJtcm1ZGlyZWN0aXZlSW5qZWN0KTtcbiAgZmFjdG9yeS5tdWx0aSA9IFtdO1xuICBmYWN0b3J5LmluZGV4ID0gaW5kZXg7XG4gIGZhY3RvcnkuY29tcG9uZW50UHJvdmlkZXJzID0gMDtcbiAgbXVsdGlGYWN0b3J5QWRkKGZhY3RvcnksIGYsIGlzQ29tcG9uZW50ICYmICFpc1ZpZXdQcm92aWRlcik7XG4gIHJldHVybiBmYWN0b3J5O1xufVxuIl19