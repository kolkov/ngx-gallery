/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ENVIRONMENT_INITIALIZER } from '../../di/initializer_token';
import { getInjectorDef } from '../../di/interface/defs';
import { INJECTOR_DEF_TYPES } from '../../di/internal_tokens';
import { NullInjector } from '../../di/null_injector';
import { walkProviderTree } from '../../di/provider_collection';
import { EnvironmentInjector, R3Injector } from '../../di/r3_injector';
import { NgModuleRef as viewEngine_NgModuleRef } from '../../linker/ng_module_factory';
import { deepForEach } from '../../util/array_utils';
import { throwError } from '../../util/assert';
import { assertTNode, assertTNodeForLView } from '../assert';
import { ChainedInjector } from '../chained_injector';
import { getFrameworkDIDebugData } from '../debug/framework_injector_profiler';
import { getComponentDef } from '../definition';
import { getNodeInjectorLView, getNodeInjectorTNode, getParentInjectorLocation, NodeInjector, } from '../di';
import { INJECTOR, TVIEW } from '../interfaces/view';
import { getParentInjectorIndex, getParentInjectorView, hasParentInjector, isRouterOutletInjector, } from './injector_utils';
import { getNativeByTNode } from './view_utils';
/**
 * Discovers the dependencies of an injectable instance. Provides DI information about each
 * dependency that the injectable was instantiated with, including where they were provided from.
 *
 * @param injector An injector instance
 * @param token a DI token that was constructed by the given injector instance
 * @returns an object that contains the created instance of token as well as all of the dependencies
 * that it was instantiated with OR undefined if the token was not created within the given
 * injector.
 */
export function getDependenciesFromInjectable(injector, token) {
    // First we check to see if the token given maps to an actual instance in the injector given.
    // We use `self: true` because we only want to look at the injector we were given.
    // We use `optional: true` because it's possible that the token we were given was never
    // constructed by the injector we were given.
    const instance = injector.get(token, null, { self: true, optional: true });
    if (instance === null) {
        throw new Error(`Unable to determine instance of ${token} in given injector`);
    }
    const unformattedDependencies = getDependenciesForTokenInInjector(token, injector);
    const resolutionPath = getInjectorResolutionPath(injector);
    const dependencies = unformattedDependencies.map((dep) => {
        // injectedIn contains private fields, so we omit it from the response
        const formattedDependency = {
            value: dep.value,
        };
        // convert injection flags to booleans
        const flags = dep.flags;
        formattedDependency.flags = {
            optional: (8 /* InternalInjectFlags.Optional */ & flags) === 8 /* InternalInjectFlags.Optional */,
            host: (1 /* InternalInjectFlags.Host */ & flags) === 1 /* InternalInjectFlags.Host */,
            self: (2 /* InternalInjectFlags.Self */ & flags) === 2 /* InternalInjectFlags.Self */,
            skipSelf: (4 /* InternalInjectFlags.SkipSelf */ & flags) === 4 /* InternalInjectFlags.SkipSelf */,
        };
        // find the injector that provided the dependency
        for (let i = 0; i < resolutionPath.length; i++) {
            const injectorToCheck = resolutionPath[i];
            // if skipSelf is true we skip the first injector
            if (i === 0 && formattedDependency.flags.skipSelf) {
                continue;
            }
            // host only applies to NodeInjectors
            if (formattedDependency.flags.host && injectorToCheck instanceof EnvironmentInjector) {
                break;
            }
            const instance = injectorToCheck.get(dep.token, null, {
                self: true,
                optional: true,
            });
            if (instance !== null) {
                // if host flag is true we double check that we can get the service from the first element
                // in the resolution path by using the host flag. This is done to make sure that we've found
                // the correct providing injector, and not a node injector that is connected to our path via
                // a router outlet.
                if (formattedDependency.flags.host) {
                    const firstInjector = resolutionPath[0];
                    const lookupFromFirstInjector = firstInjector.get(dep.token, null, {
                        ...formattedDependency.flags,
                        optional: true,
                    });
                    if (lookupFromFirstInjector !== null) {
                        formattedDependency.providedIn = injectorToCheck;
                    }
                    break;
                }
                formattedDependency.providedIn = injectorToCheck;
                break;
            }
            // if self is true we stop after the first injector
            if (i === 0 && formattedDependency.flags.self) {
                break;
            }
        }
        if (dep.token)
            formattedDependency.token = dep.token;
        return formattedDependency;
    });
    return { instance, dependencies };
}
function getDependenciesForTokenInInjector(token, injector) {
    const { resolverToTokenToDependencies } = getFrameworkDIDebugData();
    if (!(injector instanceof NodeInjector)) {
        return resolverToTokenToDependencies.get(injector)?.get?.(token) ?? [];
    }
    const lView = getNodeInjectorLView(injector);
    const tokenDependencyMap = resolverToTokenToDependencies.get(lView);
    const dependencies = tokenDependencyMap?.get(token) ?? [];
    // In the NodeInjector case, all injections for every node are stored in the same lView.
    // We use the injectedIn field of the dependency to filter out the dependencies that
    // do not come from the same node as the instance we're looking at.
    return dependencies.filter((dependency) => {
        const dependencyNode = dependency.injectedIn?.tNode;
        if (dependencyNode === undefined) {
            return false;
        }
        const instanceNode = getNodeInjectorTNode(injector);
        assertTNode(dependencyNode);
        assertTNode(instanceNode);
        return dependencyNode === instanceNode;
    });
}
/**
 * Gets the class associated with an injector that contains a provider `imports` array in it's
 * definition
 *
 * For Module Injectors this returns the NgModule constructor.
 *
 * For Standalone injectors this returns the standalone component constructor.
 *
 * @param injector Injector an injector instance
 * @returns the constructor where the `imports` array that configures this injector is located
 */
function getProviderImportsContainer(injector) {
    const { standaloneInjectorToComponent } = getFrameworkDIDebugData();
    // standalone components configure providers through a component def, so we have to
    // use the standalone component associated with this injector if Injector represents
    // a standalone components EnvironmentInjector
    if (standaloneInjectorToComponent.has(injector)) {
        return standaloneInjectorToComponent.get(injector);
    }
    // Module injectors configure providers through their NgModule def, so we use the
    // injector to lookup its NgModuleRef and through that grab its instance
    const defTypeRef = injector.get(viewEngine_NgModuleRef, null, { self: true, optional: true });
    // If we can't find an associated imports container, return null.
    // This could be the case if this function is called with an R3Injector that does not represent
    // a standalone component or NgModule.
    if (defTypeRef === null) {
        return null;
    }
    // In standalone applications, the root environment injector created by bootstrapApplication
    // may have no associated "instance".
    if (defTypeRef.instance === null) {
        return null;
    }
    return defTypeRef.instance.constructor;
}
/**
 * Gets the providers configured on a NodeInjector
 *
 * @param injector A NodeInjector instance
 * @returns ProviderRecord[] an array of objects representing the providers configured on this
 *     injector
 */
function getNodeInjectorProviders(injector) {
    const diResolver = getNodeInjectorTNode(injector);
    const { resolverToProviders } = getFrameworkDIDebugData();
    return resolverToProviders.get(diResolver) ?? [];
}
/**
 * Gets a mapping of providers configured on an injector to their import paths
 *
 * ModuleA -> imports ModuleB
 * ModuleB -> imports ModuleC
 * ModuleB -> provides MyServiceA
 * ModuleC -> provides MyServiceB
 *
 * getProviderImportPaths(ModuleA)
 * > Map(2) {
 *   MyServiceA => [ModuleA, ModuleB]
 *   MyServiceB => [ModuleA, ModuleB, ModuleC]
 *  }
 *
 * @param providerImportsContainer constructor of class that contains an `imports` array in it's
 *     definition
 * @returns A Map object that maps providers to an array of constructors representing it's import
 *     path
 *
 */
function getProviderImportPaths(providerImportsContainer) {
    const providerToPath = new Map();
    const visitedContainers = new Set();
    const visitor = walkProviderTreeToDiscoverImportPaths(providerToPath, visitedContainers);
    walkProviderTree(providerImportsContainer, visitor, [], new Set());
    return providerToPath;
}
/**
 *
 * Higher order function that returns a visitor for WalkProviderTree
 *
 * Takes in a Map and Set to keep track of the providers and containers
 * visited, so that we can discover the import paths of these providers
 * during the traversal.
 *
 * This visitor takes advantage of the fact that walkProviderTree performs a
 * postorder traversal of the provider tree for the passed in container. Because postorder
 * traversal recursively processes subtrees from leaf nodes until the traversal reaches the root,
 * we write a visitor that constructs provider import paths in reverse.
 *
 *
 * We use the visitedContainers set defined outside this visitor
 * because we want to run some logic only once for
 * each container in the tree. That logic can be described as:
 *
 *
 * 1. for each discovered_provider and discovered_path in the incomplete provider paths we've
 * already discovered
 * 2. get the first container in discovered_path
 * 3. if that first container is in the imports array of the container we're visiting
 *    Then the container we're visiting is also in the import path of discovered_provider, so we
 *    unshift discovered_path with the container we're currently visiting
 *
 *
 * Example Run:
 * ```
 *                 ┌──────────┐
 *                 │containerA│
 *      ┌─imports-─┤          ├──imports─┐
 *      │          │  provA   │          │
 *      │          │  provB   │          │
 *      │          └──────────┘          │
 *      │                                │
 *     ┌▼─────────┐             ┌────────▼─┐
 *     │containerB│             │containerC│
 *     │          │             │          │
 *     │  provD   │             │  provF   │
 *     │  provE   │             │  provG   │
 *     └──────────┘             └──────────┘
 * ```
 *
 * Each step of the traversal,
 *
 * ```
 * visitor(provD, containerB)
 * providerToPath === Map { provD => [containerB] }
 * visitedContainers === Set { containerB }
 *
 * visitor(provE, containerB)
 * providerToPath === Map { provD => [containerB], provE => [containerB] }
 * visitedContainers === Set { containerB }
 *
 * visitor(provF, containerC)
 * providerToPath === Map { provD => [containerB], provE => [containerB], provF => [containerC] }
 * visitedContainers === Set { containerB, containerC }
 *
 * visitor(provG, containerC)
 * providerToPath === Map {
 *   provD => [containerB], provE => [containerB], provF => [containerC], provG => [containerC]
 * }
 * visitedContainers === Set { containerB, containerC }
 *
 * visitor(provA, containerA)
 * providerToPath === Map {
 *   provD => [containerA, containerB],
 *   provE => [containerA, containerB],
 *   provF => [containerA, containerC],
 *   provG => [containerA, containerC],
 *   provA => [containerA]
 * }
 * visitedContainers === Set { containerB, containerC, containerA }
 *
 * visitor(provB, containerA)
 * providerToPath === Map {
 *   provD => [containerA, containerB],
 *   provE => [containerA, containerB],
 *   provF => [containerA, containerC],
 *   provG => [containerA, containerC],
 *   provA => [containerA]
 *   provB => [containerA]
 * }
 * visitedContainers === Set { containerB, containerC, containerA }
 * ```
 *
 * @param providerToPath Map map of providers to paths that this function fills
 * @param visitedContainers Set a set to keep track of the containers we've already visited
 * @return function(provider SingleProvider, container: Type<unknown> | InjectorType<unknown>) =>
 *     void
 */
function walkProviderTreeToDiscoverImportPaths(providerToPath, visitedContainers) {
    return (provider, container) => {
        // If the provider is not already in the providerToPath map,
        // add an entry with the provider as the key and an array containing the current container as
        // the value
        if (!providerToPath.has(provider)) {
            providerToPath.set(provider, [container]);
        }
        // This block will run exactly once for each container in the import tree.
        // This is where we run the logic to check the imports array of the current
        // container to see if it's the next container in the path for our currently
        // discovered providers.
        if (!visitedContainers.has(container)) {
            // Iterate through the providers we've already seen
            for (const prov of providerToPath.keys()) {
                const existingImportPath = providerToPath.get(prov);
                let containerDef = getInjectorDef(container);
                if (!containerDef) {
                    const ngModule = container.ngModule;
                    containerDef = getInjectorDef(ngModule);
                }
                if (!containerDef) {
                    return;
                }
                const lastContainerAddedToPath = existingImportPath[0];
                let isNextStepInPath = false;
                deepForEach(containerDef.imports, (moduleImport) => {
                    if (isNextStepInPath) {
                        return;
                    }
                    isNextStepInPath =
                        moduleImport.ngModule === lastContainerAddedToPath ||
                            moduleImport === lastContainerAddedToPath;
                    if (isNextStepInPath) {
                        providerToPath.get(prov)?.unshift(container);
                    }
                });
            }
        }
        visitedContainers.add(container);
    };
}
/**
 * Gets the providers configured on an EnvironmentInjector
 *
 * @param injector EnvironmentInjector
 * @returns an array of objects representing the providers of the given injector
 */
function getEnvironmentInjectorProviders(injector) {
    const providerRecordsWithoutImportPaths = getFrameworkDIDebugData().resolverToProviders.get(injector) ?? [];
    // platform injector has no provider imports container so can we skip trying to
    // find import paths
    if (isPlatformInjector(injector)) {
        return providerRecordsWithoutImportPaths;
    }
    const providerImportsContainer = getProviderImportsContainer(injector);
    if (providerImportsContainer === null) {
        // We assume that if an environment injector exists without an associated provider imports
        // container, it was created without such a container. Some examples cases where this could
        // happen:
        // - The root injector of a standalone application
        // - A router injector created by using the providers array in a lazy loaded route
        // - A manually created injector that is attached to the injector tree
        // Since each of these cases has no provider container, there is no concept of import paths,
        // so we can simply return the provider records.
        return providerRecordsWithoutImportPaths;
    }
    const providerToPath = getProviderImportPaths(providerImportsContainer);
    const providerRecords = [];
    for (const providerRecord of providerRecordsWithoutImportPaths) {
        const provider = providerRecord.provider;
        // Ignore these special providers for now until we have a cleaner way of
        // determing when they are provided by the framework vs provided by the user.
        const token = provider.provide;
        if (token === ENVIRONMENT_INITIALIZER || token === INJECTOR_DEF_TYPES) {
            continue;
        }
        let importPath = providerToPath.get(provider) ?? [];
        const def = getComponentDef(providerImportsContainer);
        const isStandaloneComponent = !!def?.standalone;
        // We prepend the component constructor in the standalone case
        // because walkProviderTree does not visit this constructor during it's traversal
        if (isStandaloneComponent) {
            importPath = [providerImportsContainer, ...importPath];
        }
        providerRecords.push({ ...providerRecord, importPath });
    }
    return providerRecords;
}
function isPlatformInjector(injector) {
    return injector instanceof R3Injector && injector.scopes.has('platform');
}
/**
 * Gets the providers configured on an injector.
 *
 * @param injector the injector to lookup the providers of
 * @returns ProviderRecord[] an array of objects representing the providers of the given injector
 */
export function getInjectorProviders(injector) {
    if (injector instanceof NodeInjector) {
        return getNodeInjectorProviders(injector);
    }
    else if (injector instanceof EnvironmentInjector) {
        return getEnvironmentInjectorProviders(injector);
    }
    throwError('getInjectorProviders only supports NodeInjector and EnvironmentInjector');
}
/**
 *
 * Given an injector, this function will return
 * an object containing the type and source of the injector.
 *
 * |              | type        | source                                                      |
 * |--------------|-------------|-------------------------------------------------------------|
 * | NodeInjector | element     | DOM element that created this injector                      |
 * | R3Injector   | environment | `injector.source`                                           |
 * | NullInjector | null        | null                                                        |
 *
 * @param injector the Injector to get metadata for
 * @returns an object containing the type and source of the given injector. If the injector metadata
 *     cannot be determined, returns null.
 */
export function getInjectorMetadata(injector) {
    if (injector instanceof NodeInjector) {
        const lView = getNodeInjectorLView(injector);
        const tNode = getNodeInjectorTNode(injector);
        assertTNodeForLView(tNode, lView);
        return { type: 'element', source: getNativeByTNode(tNode, lView) };
    }
    if (injector instanceof R3Injector) {
        return { type: 'environment', source: injector.source ?? null };
    }
    if (injector instanceof NullInjector) {
        return { type: 'null', source: null };
    }
    return null;
}
export function getInjectorResolutionPath(injector) {
    const resolutionPath = [injector];
    getInjectorResolutionPathHelper(injector, resolutionPath);
    return resolutionPath;
}
function getInjectorResolutionPathHelper(injector, resolutionPath) {
    const parent = getInjectorParent(injector);
    // if getInjectorParent can't find a parent, then we've either reached the end
    // of the path, or we need to move from the Element Injector tree to the
    // module injector tree using the first injector in our path as the connection point.
    if (parent === null) {
        if (injector instanceof NodeInjector) {
            const firstInjector = resolutionPath[0];
            if (firstInjector instanceof NodeInjector) {
                const moduleInjector = getModuleInjectorOfNodeInjector(firstInjector);
                if (moduleInjector === null) {
                    throwError('NodeInjector must have some connection to the module injector tree');
                }
                resolutionPath.push(moduleInjector);
                getInjectorResolutionPathHelper(moduleInjector, resolutionPath);
            }
            return resolutionPath;
        }
    }
    else {
        resolutionPath.push(parent);
        getInjectorResolutionPathHelper(parent, resolutionPath);
    }
    return resolutionPath;
}
/**
 * Gets the parent of an injector.
 *
 * This function is not able to make the jump from the Element Injector Tree to the Module
 * injector tree. This is because the "parent" (the next step in the reoslution path)
 * of a root NodeInjector is dependent on which NodeInjector ancestor initiated
 * the DI lookup. See getInjectorResolutionPath for a function that can make this jump.
 *
 * In the below diagram:
 * ```ts
 * getInjectorParent(NodeInjectorB)
 *  > NodeInjectorA
 * getInjectorParent(NodeInjectorA) // or getInjectorParent(getInjectorParent(NodeInjectorB))
 *  > null // cannot jump to ModuleInjector tree
 * ```
 *
 * ```
 *                ┌───────┐                ┌───────────────────┐
 *    ┌───────────┤ModuleA├───Injector────►│EnvironmentInjector│
 *    │           └───┬───┘                └───────────────────┘
 *    │               │
 *    │           bootstraps
 *    │               │
 *    │               │
 *    │          ┌────▼─────┐                 ┌─────────────┐
 * declares      │ComponentA├────Injector────►│NodeInjectorA│
 *    │          └────┬─────┘                 └─────▲───────┘
 *    │               │                             │
 *    │            renders                        parent
 *    │               │                             │
 *    │          ┌────▼─────┐                 ┌─────┴───────┐
 *    └─────────►│ComponentB├────Injector────►│NodeInjectorB│
 *               └──────────┘                 └─────────────┘
 *```
 *
 * @param injector an Injector to get the parent of
 * @returns Injector the parent of the given injector
 */
function getInjectorParent(injector) {
    if (injector instanceof R3Injector) {
        const parent = injector.parent;
        if (isRouterOutletInjector(parent)) {
            // This is a special case for a `ChainedInjector` instance, which represents
            // a combination of a Router's `OutletInjector` and an EnvironmentInjector,
            // which represents a `@defer` block. Since the `OutletInjector` doesn't store
            // any tokens itself, we point to the parent injector instead. See the
            // `OutletInjector.__ngOutletInjector` field for additional information.
            return parent.parentInjector;
        }
        return parent;
    }
    let tNode;
    let lView;
    if (injector instanceof NodeInjector) {
        tNode = getNodeInjectorTNode(injector);
        lView = getNodeInjectorLView(injector);
    }
    else if (injector instanceof NullInjector) {
        return null;
    }
    else if (injector instanceof ChainedInjector) {
        return injector.parentInjector;
    }
    else {
        throwError('getInjectorParent only support injectors of type R3Injector, NodeInjector, NullInjector');
    }
    const parentLocation = getParentInjectorLocation(tNode, lView);
    if (hasParentInjector(parentLocation)) {
        const parentInjectorIndex = getParentInjectorIndex(parentLocation);
        const parentLView = getParentInjectorView(parentLocation, lView);
        const parentTView = parentLView[TVIEW];
        const parentTNode = parentTView.data[parentInjectorIndex + 8 /* NodeInjectorOffset.TNODE */];
        return new NodeInjector(parentTNode, parentLView);
    }
    else {
        const chainedInjector = lView[INJECTOR];
        // Case where chainedInjector.injector is an OutletInjector and chainedInjector.injector.parent
        // is a NodeInjector.
        // todo(aleksanderbodurri): ideally nothing in packages/core should deal
        // directly with router concerns. Refactor this so that we can make the jump from
        // NodeInjector -> OutletInjector -> NodeInjector
        // without explicitly relying on types contracts from packages/router
        const injectorParent = chainedInjector.injector?.parent;
        if (injectorParent instanceof NodeInjector) {
            return injectorParent;
        }
    }
    return null;
}
/**
 * Gets the module injector of a NodeInjector.
 *
 * @param injector NodeInjector to get module injector of
 * @returns Injector representing module injector of the given NodeInjector
 */
function getModuleInjectorOfNodeInjector(injector) {
    let lView;
    if (injector instanceof NodeInjector) {
        lView = getNodeInjectorLView(injector);
    }
    else {
        throwError('getModuleInjectorOfNodeInjector must be called with a NodeInjector');
    }
    const inj = lView[INJECTOR];
    const moduleInjector = inj instanceof ChainedInjector ? inj.parentInjector : inj.parent;
    if (!moduleInjector) {
        throwError('NodeInjector must have some connection to the module injector tree');
    }
    return moduleInjector;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0b3JfZGlzY292ZXJ5X3V0aWxzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy91dGlsL2luamVjdG9yX2Rpc2NvdmVyeV91dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSw0QkFBNEIsQ0FBQztBQUduRSxPQUFPLEVBQUMsY0FBYyxFQUFlLE1BQU0seUJBQXlCLENBQUM7QUFHckUsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFDNUQsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQ3BELE9BQU8sRUFBaUIsZ0JBQWdCLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUM5RSxPQUFPLEVBQUMsbUJBQW1CLEVBQUUsVUFBVSxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFFckUsT0FBTyxFQUFDLFdBQVcsSUFBSSxzQkFBc0IsRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JGLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNuRCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDN0MsT0FBTyxFQUFDLFdBQVcsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUMzRCxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDcEQsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFFN0UsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUM5QyxPQUFPLEVBQ0wsb0JBQW9CLEVBQ3BCLG9CQUFvQixFQUNwQix5QkFBeUIsRUFDekIsWUFBWSxHQUNiLE1BQU0sT0FBTyxDQUFDO0FBSWYsT0FBTyxFQUFDLFFBQVEs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QztBQUVEOzs7OztHQUtHO0FBQ0gsU0FBUywrQkFBK0IsQ0FBQyxRQUFzQjtJQUM3RCxJQUFJLEtBQXFCLENBQUM7SUFDMUIsSUFBSSxRQUFRLFlBQVksWUFBWSxFQUFFLENBQUM7UUFDckMsS0FBSyxHQUFHLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3pDLENBQUM7U0FBTSxDQUFDO1FBQ04sVUFBVSxDQUFDLG9FQUFvRSxDQUFDLENBQUM7SUFDbkYsQ0FBQztJQUVELE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQWlDLENBQUM7SUFDNUQsTUFBTSxjQUFjLEdBQUcsR0FBRyxZQUFZLGVBQWUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQztJQUN4RixJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDcEIsVUFBVSxDQUFDLG9FQUFvRSxDQUFDLENBQUM7SUFDbkYsQ0FBQztJQUVELE9BQU8sY0FBYyxDQUFDO0FBQ3hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtFTlZJUk9OTUVOVF9JTklUSUFMSVpFUn0gZnJvbSAnLi4vLi4vZGkvaW5pdGlhbGl6ZXJfdG9rZW4nO1xuaW1wb3J0IHtJbmplY3Rpb25Ub2tlbn0gZnJvbSAnLi4vLi4vZGkvaW5qZWN0aW9uX3Rva2VuJztcbmltcG9ydCB7SW5qZWN0b3J9IGZyb20gJy4uLy4uL2RpL2luamVjdG9yJztcbmltcG9ydCB7Z2V0SW5qZWN0b3JEZWYsIEluamVjdG9yVHlwZX0gZnJvbSAnLi4vLi4vZGkvaW50ZXJmYWNlL2RlZnMnO1xuaW1wb3J0IHtJbnRlcm5hbEluamVjdEZsYWdzfSBmcm9tICcuLi8uLi9kaS9pbnRlcmZhY2UvaW5qZWN0b3InO1xuaW1wb3J0IHtWYWx1ZVByb3ZpZGVyfSBmcm9tICcuLi8uLi9kaS9pbnRlcmZhY2UvcHJvdmlkZXInO1xuaW1wb3J0IHtJTkpFQ1RPUl9ERUZfVFlQRVN9IGZyb20gJy4uLy4uL2RpL2ludGVybmFsX3Rva2Vucyc7XG5pbXBvcnQge051bGxJbmplY3Rvcn0gZnJvbSAnLi4vLi4vZGkvbnVsbF9pbmplY3Rvcic7XG5pbXBvcnQge1NpbmdsZVByb3ZpZGVyLCB3YWxrUHJvdmlkZXJUcmVlfSBmcm9tICcuLi8uLi9kaS9wcm92aWRlcl9jb2xsZWN0aW9uJztcbmltcG9ydCB7RW52aXJvbm1lbnRJbmplY3RvciwgUjNJbmplY3Rvcn0gZnJvbSAnLi4vLi4vZGkvcjNfaW5qZWN0b3InO1xuaW1wb3J0IHtUeXBlfSBmcm9tICcuLi8uLi9pbnRlcmZhY2UvdHlwZSc7XG5pbXBvcnQge05nTW9kdWxlUmVmIGFzIHZpZXdFbmdpbmVfTmdNb2R1bGVSZWZ9IGZyb20gJy4uLy4uL2xpbmtlci9uZ19tb2R1bGVfZmFjdG9yeSc7XG5pbXBvcnQge2RlZXBGb3JFYWNofSBmcm9tICcuLi8uLi91dGlsL2FycmF5X3V0aWxzJztcbmltcG9ydCB7dGhyb3dFcnJvcn0gZnJvbSAnLi4vLi4vdXRpbC9hc3NlcnQnO1xuaW1wb3J0IHthc3NlcnRUTm9kZSwgYXNzZXJ0VE5vZGVGb3JMVmlld30gZnJvbSAnLi4vYXNzZXJ0JztcbmltcG9ydCB7Q2hhaW5lZEluamVjdG9yfSBmcm9tICcuLi9jaGFpbmVkX2luamVjdG9yJztcbmltcG9ydCB7Z2V0RnJhbWV3b3JrRElEZWJ1Z0RhdGF9IGZyb20gJy4uL2RlYnVnL2ZyYW1ld29ya19pbmplY3Rvcl9wcm9maWxlcic7XG5pbXBvcnQge0luamVjdGVkU2VydmljZSwgUHJvdmlkZXJSZWNvcmR9IGZyb20gJy4uL2RlYnVnL2luamVjdG9yX3Byb2ZpbGVyJztcbmltcG9ydCB7Z2V0Q29tcG9uZW50RGVmfSBmcm9tICcuLi9kZWZpbml0aW9uJztcbmltcG9ydCB7XG4gIGdldE5vZGVJbmplY3RvckxWaWV3LFxuICBnZXROb2RlSW5qZWN0b3JUTm9kZSxcbiAgZ2V0UGFyZW50SW5qZWN0b3JMb2NhdGlvbixcbiAgTm9kZUluamVjdG9yLFxufSBmcm9tICcuLi9kaSc7XG5pbXBvcnQge05vZGVJbmplY3Rvck9mZnNldH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9pbmplY3Rvcic7XG5pbXBvcnQge1RDb250YWluZXJOb2RlLCBURWxlbWVudENvbnRhaW5lck5vZGUsIFRFbGVtZW50Tm9kZSwgVE5vZGV9IGZyb20gJy4uL2ludGVyZmFjZXMvbm9kZSc7XG5pbXBvcnQge1JFbGVtZW50fSBmcm9tICcuLi9pbnRlcmZhY2VzL3JlbmRlcmVyX2RvbSc7XG5pbXBvcnQge0lOSkVDVE9SLCBMVmlldywgVFZJRVd9IGZyb20gJy4uL2ludGVyZmFjZXMvdmlldyc7XG5cbmltcG9ydCB7XG4gIGdldFBhcmVudEluamVjdG9ySW5kZXgsXG4gIGdldFBhcmVudEluamVjdG9yVmlldyxcbiAgaGFzUGFyZW50SW5qZWN0b3IsXG4gIGlzUm91dGVyT3V0bGV0SW5qZWN0b3IsXG59IGZyb20gJy4vaW5qZWN0b3JfdXRpbHMnO1xuaW1wb3J0IHtnZXROYXRpdmVCeVROb2RlfSBmcm9tICcuL3ZpZXdfdXRpbHMnO1xuXG4vKipcbiAqIERpc2NvdmVycyB0aGUgZGVwZW5kZW5jaWVzIG9mIGFuIGluamVjdGFibGUgaW5zdGFuY2UuIFByb3ZpZGVzIERJIGluZm9ybWF0aW9uIGFib3V0IGVhY2hcbiAqIGRlcGVuZGVuY3kgdGhhdCB0aGUgaW5qZWN0YWJsZSB3YXMgaW5zdGFudGlhdGVkIHdpdGgsIGluY2x1ZGluZyB3aGVyZSB0aGV5IHdlcmUgcHJvdmlkZWQgZnJvbS5cbiAqXG4gKiBAcGFyYW0gaW5qZWN0b3IgQW4gaW5qZWN0b3IgaW5zdGFuY2VcbiAqIEBwYXJhbSB0b2tlbiBhIERJIHRva2VuIHRoYXQgd2FzIGNvbnN0cnVjdGVkIGJ5IHRoZSBnaXZlbiBpbmplY3RvciBpbnN0YW5jZVxuICogQHJldHVybnMgYW4gb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIGNyZWF0ZWQgaW5zdGFuY2Ugb2YgdG9rZW4gYXMgd2VsbCBhcyBhbGwgb2YgdGhlIGRlcGVuZGVuY2llc1xuICogdGhhdCBpdCB3YXMgaW5zdGFudGlhdGVkIHdpdGggT1IgdW5kZWZpbmVkIGlmIHRoZSB0b2tlbiB3YXMgbm90IGNyZWF0ZWQgd2l0aGluIHRoZSBnaXZlblxuICogaW5qZWN0b3IuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXREZXBlbmRlbmNpZXNGcm9tSW5qZWN0YWJsZTxUPihcbiAgaW5qZWN0b3I6IEluamVjdG9yLFxuICB0b2tlbjogVHlwZTxUPiB8IEluamVjdGlvblRva2VuPFQ+LFxuKToge2luc3RhbmNlOiBUOyBkZXBlbmRlbmNpZXM6IE9taXQ8SW5qZWN0ZWRTZXJ2aWNlLCAnaW5qZWN0ZWRJbic+W119IHwgdW5kZWZpbmVkIHtcbiAgLy8gRmlyc3Qgd2UgY2hlY2sgdG8gc2VlIGlmIHRoZSB0b2tlbiBnaXZlbiBtYXBzIHRvIGFuIGFjdHVhbCBpbnN0YW5jZSBpbiB0aGUgaW5qZWN0b3IgZ2l2ZW4uXG4gIC8vIFdlIHVzZSBgc2VsZjogdHJ1ZWAgYmVjYXVzZSB3ZSBvbmx5IHdhbnQgdG8gbG9vayBhdCB0aGUgaW5qZWN0b3Igd2Ugd2VyZSBnaXZlbi5cbiAgLy8gV2UgdXNlIGBvcHRpb25hbDogdHJ1ZWAgYmVjYXVzZSBpdCdzIHBvc3NpYmxlIHRoYXQgdGhlIHRva2VuIHdlIHdlcmUgZ2l2ZW4gd2FzIG5ldmVyXG4gIC8vIGNvbnN0cnVjdGVkIGJ5IHRoZSBpbmplY3RvciB3ZSB3ZXJlIGdpdmVuLlxuICBjb25zdCBpbnN0YW5jZSA9IGluamVjdG9yLmdldCh0b2tlbiwgbnVsbCwge3NlbGY6IHRydWUsIG9wdGlvbmFsOiB0cnVlfSk7XG4gIGlmIChpbnN0YW5jZSA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIGRldGVybWluZSBpbnN0YW5jZSBvZiAke3Rva2VufSBpbiBnaXZlbiBpbmplY3RvcmApO1xuICB9XG5cbiAgY29uc3QgdW5mb3JtYXR0ZWREZXBlbmRlbmNpZXMgPSBnZXREZXBlbmRlbmNpZXNGb3JUb2tlbkluSW5qZWN0b3IodG9rZW4sIGluamVjdG9yKTtcbiAgY29uc3QgcmVzb2x1dGlvblBhdGggPSBnZXRJbmplY3RvclJlc29sdXRpb25QYXRoKGluamVjdG9yKTtcblxuICBjb25zdCBkZXBlbmRlbmNpZXMgPSB1bmZvcm1hdHRlZERlcGVuZGVuY2llcy5tYXAoKGRlcCkgPT4ge1xuICAgIC8vIGluamVjdGVkSW4gY29udGFpbnMgcHJpdmF0ZSBmaWVsZHMsIHNvIHdlIG9taXQgaXQgZnJvbSB0aGUgcmVzcG9uc2VcbiAgICBjb25zdCBmb3JtYXR0ZWREZXBlbmRlbmN5OiBPbWl0PEluamVjdGVkU2VydmljZSwgJ2luamVjdGVkSW4nPiA9IHtcbiAgICAgIHZhbHVlOiBkZXAudmFsdWUsXG4gICAgfTtcblxuICAgIC8vIGNvbnZlcnQgaW5qZWN0aW9uIGZsYWdzIHRvIGJvb2xlYW5zXG4gICAgY29uc3QgZmxhZ3MgPSBkZXAuZmxhZ3MgYXMgSW50ZXJuYWxJbmplY3RGbGFncztcbiAgICBmb3JtYXR0ZWREZXBlbmRlbmN5LmZsYWdzID0ge1xuICAgICAgb3B0aW9uYWw6IChJbnRlcm5hbEluamVjdEZsYWdzLk9wdGlvbmFsICYgZmxhZ3MpID09PSBJbnRlcm5hbEluamVjdEZsYWdzLk9wdGlvbmFsLFxuICAgICAgaG9zdDogKEludGVybmFsSW5qZWN0RmxhZ3MuSG9zdCAmIGZsYWdzKSA9PT0gSW50ZXJuYWxJbmplY3RGbGFncy5Ib3N0LFxuICAgICAgc2VsZjogKEludGVybmFsSW5qZWN0RmxhZ3MuU2VsZiAmIGZsYWdzKSA9PT0gSW50ZXJuYWxJbmplY3RGbGFncy5TZWxmLFxuICAgICAgc2tpcFNlbGY6IChJbnRlcm5hbEluamVjdEZsYWdzLlNraXBTZWxmICYgZmxhZ3MpID09PSBJbnRlcm5hbEluamVjdEZsYWdzLlNraXBTZWxmLFxuICAgIH07XG5cbiAgICAvLyBmaW5kIHRoZSBpbmplY3RvciB0aGF0IHByb3ZpZGVkIHRoZSBkZXBlbmRlbmN5XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXNvbHV0aW9uUGF0aC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaW5qZWN0b3JUb0NoZWNrID0gcmVzb2x1dGlvblBhdGhbaV07XG5cbiAgICAgIC8vIGlmIHNraXBTZWxmIGlzIHRydWUgd2Ugc2tpcCB0aGUgZmlyc3QgaW5qZWN0b3JcbiAgICAgIGlmIChpID09PSAwICYmIGZvcm1hdHRlZERlcGVuZGVuY3kuZmxhZ3Muc2tpcFNlbGYpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIGhvc3Qgb25seSBhcHBsaWVzIHRvIE5vZGVJbmplY3RvcnNcbiAgICAgIGlmIChmb3JtYXR0ZWREZXBlbmRlbmN5LmZsYWdzLmhvc3QgJiYgaW5qZWN0b3JUb0NoZWNrIGluc3RhbmNlb2YgRW52aXJvbm1lbnRJbmplY3Rvcikge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY29uc3QgaW5zdGFuY2UgPSBpbmplY3RvclRvQ2hlY2suZ2V0KGRlcC50b2tlbiBhcyBUeXBlPHVua25vd24+LCBudWxsLCB7XG4gICAgICAgIHNlbGY6IHRydWUsXG4gICAgICAgIG9wdGlvbmFsOiB0cnVlLFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChpbnN0YW5jZSAhPT0gbnVsbCkge1xuICAgICAgICAvLyBpZiBob3N0IGZsYWcgaXMgdHJ1ZSB3ZSBkb3VibGUgY2hlY2sgdGhhdCB3ZSBjYW4gZ2V0IHRoZSBzZXJ2aWNlIGZyb20gdGhlIGZpcnN0IGVsZW1lbnRcbiAgICAgICAgLy8gaW4gdGhlIHJlc29sdXRpb24gcGF0aCBieSB1c2luZyB0aGUgaG9zdCBmbGFnLiBUaGlzIGlzIGRvbmUgdG8gbWFrZSBzdXJlIHRoYXQgd2UndmUgZm91bmRcbiAgICAgICAgLy8gdGhlIGNvcnJlY3QgcHJvdmlkaW5nIGluamVjdG9yLCBhbmQgbm90IGEgbm9kZSBpbmplY3RvciB0aGF0IGlzIGNvbm5lY3RlZCB0byBvdXIgcGF0aCB2aWFcbiAgICAgICAgLy8gYSByb3V0ZXIgb3V0bGV0LlxuICAgICAgICBpZiAoZm9ybWF0dGVkRGVwZW5kZW5jeS5mbGFncy5ob3N0KSB7XG4gICAgICAgICAgY29uc3QgZmlyc3RJbmplY3RvciA9IHJlc29sdXRpb25QYXRoWzBdO1xuICAgICAgICAgIGNvbnN0IGxvb2t1cEZyb21GaXJzdEluamVjdG9yID0gZmlyc3RJbmplY3Rvci5nZXQoZGVwLnRva2VuIGFzIFR5cGU8dW5rbm93bj4sIG51bGwsIHtcbiAgICAgICAgICAgIC4uLmZvcm1hdHRlZERlcGVuZGVuY3kuZmxhZ3MsXG4gICAgICAgICAgICBvcHRpb25hbDogdHJ1ZSxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGlmIChsb29rdXBGcm9tRmlyc3RJbmplY3RvciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZm9ybWF0dGVkRGVwZW5kZW5jeS5wcm92aWRlZEluID0gaW5qZWN0b3JUb0NoZWNrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9ybWF0dGVkRGVwZW5kZW5jeS5wcm92aWRlZEluID0gaW5qZWN0b3JUb0NoZWNrO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgLy8gaWYgc2VsZiBpcyB0cnVlIHdlIHN0b3AgYWZ0ZXIgdGhlIGZpcnN0IGluamVjdG9yXG4gICAgICBpZiAoaSA9PT0gMCAmJiBmb3JtYXR0ZWREZXBlbmRlbmN5LmZsYWdzLnNlbGYpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGRlcC50b2tlbikgZm9ybWF0dGVkRGVwZW5kZW5jeS50b2tlbiA9IGRlcC50b2tlbjtcblxuICAgIHJldHVybiBmb3JtYXR0ZWREZXBlbmRlbmN5O1xuICB9KTtcblxuICByZXR1cm4ge2luc3RhbmNlLCBkZXBlbmRlbmNpZXN9O1xufVxuXG5mdW5jdGlvbiBnZXREZXBlbmRlbmNpZXNGb3JUb2tlbkluSW5qZWN0b3I8VD4oXG4gIHRva2VuOiBUeXBlPFQ+IHwgSW5qZWN0aW9uVG9rZW48VD4sXG4gIGluamVjdG9yOiBJbmplY3Rvcixcbik6IEluamVjdGVkU2VydmljZVtdIHtcbiAgY29uc3Qge3Jlc29sdmVyVG9Ub2tlblRvRGVwZW5kZW5jaWVzfSA9IGdldEZyYW1ld29ya0RJRGVidWdEYXRhKCk7XG5cbiAgaWYgKCEoaW5qZWN0b3IgaW5zdGFuY2VvZiBOb2RlSW5qZWN0b3IpKSB7XG4gICAgcmV0dXJuIHJlc29sdmVyVG9Ub2tlblRvRGVwZW5kZW5jaWVzLmdldChpbmplY3Rvcik/LmdldD8uKHRva2VuIGFzIFR5cGU8VD4pID8/IFtdO1xuICB9XG5cbiAgY29uc3QgbFZpZXcgPSBnZXROb2RlSW5qZWN0b3JMVmlldyhpbmplY3Rvcik7XG4gIGNvbnN0IHRva2VuRGVwZW5kZW5jeU1hcCA9IHJlc29sdmVyVG9Ub2tlblRvRGVwZW5kZW5jaWVzLmdldChsVmlldyk7XG4gIGNvbnN0IGRlcGVuZGVuY2llcyA9IHRva2VuRGVwZW5kZW5jeU1hcD8uZ2V0KHRva2VuIGFzIFR5cGU8VD4pID8/IFtdO1xuXG4gIC8vIEluIHRoZSBOb2RlSW5qZWN0b3IgY2FzZSwgYWxsIGluamVjdGlvbnMgZm9yIGV2ZXJ5IG5vZGUgYXJlIHN0b3JlZCBpbiB0aGUgc2FtZSBsVmlldy5cbiAgLy8gV2UgdXNlIHRoZSBpbmplY3RlZEluIGZpZWxkIG9mIHRoZSBkZXBlbmRlbmN5IHRvIGZpbHRlciBvdXQgdGhlIGRlcGVuZGVuY2llcyB0aGF0XG4gIC8vIGRvIG5vdCBjb21lIGZyb20gdGhlIHNhbWUgbm9kZSBhcyB0aGUgaW5zdGFuY2Ugd2UncmUgbG9va2luZyBhdC5cbiAgcmV0dXJuIGRlcGVuZGVuY2llcy5maWx0ZXIoKGRlcGVuZGVuY3kpID0+IHtcbiAgICBjb25zdCBkZXBlbmRlbmN5Tm9kZSA9IGRlcGVuZGVuY3kuaW5qZWN0ZWRJbj8udE5vZGU7XG4gICAgaWYgKGRlcGVuZGVuY3lOb2RlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBpbnN0YW5jZU5vZGUgPSBnZXROb2RlSW5qZWN0b3JUTm9kZShpbmplY3Rvcik7XG4gICAgYXNzZXJ0VE5vZGUoZGVwZW5kZW5jeU5vZGUpO1xuICAgIGFzc2VydFROb2RlKGluc3RhbmNlTm9kZSEpO1xuXG4gICAgcmV0dXJuIGRlcGVuZGVuY3lOb2RlID09PSBpbnN0YW5jZU5vZGU7XG4gIH0pO1xufVxuXG4vKipcbiAqIEdldHMgdGhlIGNsYXNzIGFzc29jaWF0ZWQgd2l0aCBhbiBpbmplY3RvciB0aGF0IGNvbnRhaW5zIGEgcHJvdmlkZXIgYGltcG9ydHNgIGFycmF5IGluIGl0J3NcbiAqIGRlZmluaXRpb25cbiAqXG4gKiBGb3IgTW9kdWxlIEluamVjdG9ycyB0aGlzIHJldHVybnMgdGhlIE5nTW9kdWxlIGNvbnN0cnVjdG9yLlxuICpcbiAqIEZvciBTdGFuZGFsb25lIGluamVjdG9ycyB0aGlzIHJldHVybnMgdGhlIHN0YW5kYWxvbmUgY29tcG9uZW50IGNvbnN0cnVjdG9yLlxuICpcbiAqIEBwYXJhbSBpbmplY3RvciBJbmplY3RvciBhbiBpbmplY3RvciBpbnN0YW5jZVxuICogQHJldHVybnMgdGhlIGNvbnN0cnVjdG9yIHdoZXJlIHRoZSBgaW1wb3J0c2AgYXJyYXkgdGhhdCBjb25maWd1cmVzIHRoaXMgaW5qZWN0b3IgaXMgbG9jYXRlZFxuICovXG5mdW5jdGlvbiBnZXRQcm92aWRlckltcG9ydHNDb250YWluZXIoaW5qZWN0b3I6IEluamVjdG9yKTogVHlwZTx1bmtub3duPiB8IG51bGwge1xuICBjb25zdCB7c3RhbmRhbG9uZUluamVjdG9yVG9Db21wb25lbnR9ID0gZ2V0RnJhbWV3b3JrRElEZWJ1Z0RhdGEoKTtcblxuICAvLyBzdGFuZGFsb25lIGNvbXBvbmVudHMgY29uZmlndXJlIHByb3ZpZGVycyB0aHJvdWdoIGEgY29tcG9uZW50IGRlZiwgc28gd2UgaGF2ZSB0b1xuICAvLyB1c2UgdGhlIHN0YW5kYWxvbmUgY29tcG9uZW50IGFzc29jaWF0ZWQgd2l0aCB0aGlzIGluamVjdG9yIGlmIEluamVjdG9yIHJlcHJlc2VudHNcbiAgLy8gYSBzdGFuZGFsb25lIGNvbXBvbmVudHMgRW52aXJvbm1lbnRJbmplY3RvclxuICBpZiAoc3RhbmRhbG9uZUluamVjdG9yVG9Db21wb25lbnQuaGFzKGluamVjdG9yKSkge1xuICAgIHJldHVybiBzdGFuZGFsb25lSW5qZWN0b3JUb0NvbXBvbmVudC5nZXQoaW5qZWN0b3IpITtcbiAgfVxuXG4gIC8vIE1vZHVsZSBpbmplY3RvcnMgY29uZmlndXJlIHByb3ZpZGVycyB0aHJvdWdoIHRoZWlyIE5nTW9kdWxlIGRlZiwgc28gd2UgdXNlIHRoZVxuICAvLyBpbmplY3RvciB0byBsb29rdXAgaXRzIE5nTW9kdWxlUmVmIGFuZCB0aHJvdWdoIHRoYXQgZ3JhYiBpdHMgaW5zdGFuY2VcbiAgY29uc3QgZGVmVHlwZVJlZiA9IGluamVjdG9yLmdldCh2aWV3RW5naW5lX05nTW9kdWxlUmVmLCBudWxsLCB7c2VsZjogdHJ1ZSwgb3B0aW9uYWw6IHRydWV9KSE7XG5cbiAgLy8gSWYgd2UgY2FuJ3QgZmluZCBhbiBhc3NvY2lhdGVkIGltcG9ydHMgY29udGFpbmVyLCByZXR1cm4gbnVsbC5cbiAgLy8gVGhpcyBjb3VsZCBiZSB0aGUgY2FzZSBpZiB0aGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIGFuIFIzSW5qZWN0b3IgdGhhdCBkb2VzIG5vdCByZXByZXNlbnRcbiAgLy8gYSBzdGFuZGFsb25lIGNvbXBvbmVudCBvciBOZ01vZHVsZS5cbiAgaWYgKGRlZlR5cGVSZWYgPT09IG51bGwpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIEluIHN0YW5kYWxvbmUgYXBwbGljYXRpb25zLCB0aGUgcm9vdCBlbnZpcm9ubWVudCBpbmplY3RvciBjcmVhdGVkIGJ5IGJvb3RzdHJhcEFwcGxpY2F0aW9uXG4gIC8vIG1heSBoYXZlIG5vIGFzc29jaWF0ZWQgXCJpbnN0YW5jZVwiLlxuICBpZiAoZGVmVHlwZVJlZi5pbnN0YW5jZSA9PT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIGRlZlR5cGVSZWYuaW5zdGFuY2UuY29uc3RydWN0b3I7XG59XG5cbi8qKlxuICogR2V0cyB0aGUgcHJvdmlkZXJzIGNvbmZpZ3VyZWQgb24gYSBOb2RlSW5qZWN0b3JcbiAqXG4gKiBAcGFyYW0gaW5qZWN0b3IgQSBOb2RlSW5qZWN0b3IgaW5zdGFuY2VcbiAqIEByZXR1cm5zIFByb3ZpZGVyUmVjb3JkW10gYW4gYXJyYXkgb2Ygb2JqZWN0cyByZXByZXNlbnRpbmcgdGhlIHByb3ZpZGVycyBjb25maWd1cmVkIG9uIHRoaXNcbiAqICAgICBpbmplY3RvclxuICovXG5mdW5jdGlvbiBnZXROb2RlSW5qZWN0b3JQcm92aWRlcnMoaW5qZWN0b3I6IE5vZGVJbmplY3Rvcik6IFByb3ZpZGVyUmVjb3JkW10ge1xuICBjb25zdCBkaVJlc29sdmVyID0gZ2V0Tm9kZUluamVjdG9yVE5vZGUoaW5qZWN0b3IpO1xuICBjb25zdCB7cmVzb2x2ZXJUb1Byb3ZpZGVyc30gPSBnZXRGcmFtZXdvcmtESURlYnVnRGF0YSgpO1xuICByZXR1cm4gcmVzb2x2ZXJUb1Byb3ZpZGVycy5nZXQoZGlSZXNvbHZlciBhcyBUTm9kZSkgPz8gW107XG59XG5cbi8qKlxuICogR2V0cyBhIG1hcHBpbmcgb2YgcHJvdmlkZXJzIGNvbmZpZ3VyZWQgb24gYW4gaW5qZWN0b3IgdG8gdGhlaXIgaW1wb3J0IHBhdGhzXG4gKlxuICogTW9kdWxlQSAtPiBpbXBvcnRzIE1vZHVsZUJcbiAqIE1vZHVsZUIgLT4gaW1wb3J0cyBNb2R1bGVDXG4gKiBNb2R1bGVCIC0+IHByb3ZpZGVzIE15U2VydmljZUFcbiAqIE1vZHVsZUMgLT4gcHJvdmlkZXMgTXlTZXJ2aWNlQlxuICpcbiAqIGdldFByb3ZpZGVySW1wb3J0UGF0aHMoTW9kdWxlQSlcbiAqID4gTWFwKDIpIHtcbiAqICAgTXlTZXJ2aWNlQSA9PiBbTW9kdWxlQSwgTW9kdWxlQl1cbiAqICAgTXlTZXJ2aWNlQiA9PiBbTW9kdWxlQSwgTW9kdWxlQiwgTW9kdWxlQ11cbiAqICB9XG4gKlxuICogQHBhcmFtIHByb3ZpZGVySW1wb3J0c0NvbnRhaW5lciBjb25zdHJ1Y3RvciBvZiBjbGFzcyB0aGF0IGNvbnRhaW5zIGFuIGBpbXBvcnRzYCBhcnJheSBpbiBpdCdzXG4gKiAgICAgZGVmaW5pdGlvblxuICogQHJldHVybnMgQSBNYXAgb2JqZWN0IHRoYXQgbWFwcyBwcm92aWRlcnMgdG8gYW4gYXJyYXkgb2YgY29uc3RydWN0b3JzIHJlcHJlc2VudGluZyBpdCdzIGltcG9ydFxuICogICAgIHBhdGhcbiAqXG4gKi9cbmZ1bmN0aW9uIGdldFByb3ZpZGVySW1wb3J0UGF0aHMoXG4gIHByb3ZpZGVySW1wb3J0c0NvbnRhaW5lcjogVHlwZTx1bmtub3duPixcbik6IE1hcDxTaW5nbGVQcm92aWRlciwgKFR5cGU8dW5rbm93bj4gfCBJbmplY3RvclR5cGU8dW5rbm93bj4pW10+IHtcbiAgY29uc3QgcHJvdmlkZXJUb1BhdGggPSBuZXcgTWFwPFNpbmdsZVByb3ZpZGVyLCAoVHlwZTx1bmtub3duPiB8IEluamVjdG9yVHlwZTx1bmtub3duPilbXT4oKTtcbiAgY29uc3QgdmlzaXRlZENvbnRhaW5lcnMgPSBuZXcgU2V0PFR5cGU8dW5rbm93bj4+KCk7XG4gIGNvbnN0IHZpc2l0b3IgPSB3YWxrUHJvdmlkZXJUcmVlVG9EaXNjb3ZlckltcG9ydFBhdGhzKHByb3ZpZGVyVG9QYXRoLCB2aXNpdGVkQ29udGFpbmVycyk7XG5cbiAgd2Fsa1Byb3ZpZGVyVHJlZShwcm92aWRlckltcG9ydHNDb250YWluZXIsIHZpc2l0b3IsIFtdLCBuZXcgU2V0KCkpO1xuXG4gIHJldHVybiBwcm92aWRlclRvUGF0aDtcbn1cblxuLyoqXG4gKlxuICogSGlnaGVyIG9yZGVyIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIHZpc2l0b3IgZm9yIFdhbGtQcm92aWRlclRyZWVcbiAqXG4gKiBUYWtlcyBpbiBhIE1hcCBhbmQgU2V0IHRvIGtlZXAgdHJhY2sgb2YgdGhlIHByb3ZpZGVycyBhbmQgY29udGFpbmVyc1xuICogdmlzaXRlZCwgc28gdGhhdCB3ZSBjYW4gZGlzY292ZXIgdGhlIGltcG9ydCBwYXRocyBvZiB0aGVzZSBwcm92aWRlcnNcbiAqIGR1cmluZyB0aGUgdHJhdmVyc2FsLlxuICpcbiAqIFRoaXMgdmlzaXRvciB0YWtlcyBhZHZhbnRhZ2Ugb2YgdGhlIGZhY3QgdGhhdCB3YWxrUHJvdmlkZXJUcmVlIHBlcmZvcm1zIGFcbiAqIHBvc3RvcmRlciB0cmF2ZXJzYWwgb2YgdGhlIHByb3ZpZGVyIHRyZWUgZm9yIHRoZSBwYXNzZWQgaW4gY29udGFpbmVyLiBCZWNhdXNlIHBvc3RvcmRlclxuICogdHJhdmVyc2FsIHJlY3Vyc2l2ZWx5IHByb2Nlc3NlcyBzdWJ0cmVlcyBmcm9tIGxlYWYgbm9kZXMgdW50aWwgdGhlIHRyYXZlcnNhbCByZWFjaGVzIHRoZSByb290LFxuICogd2Ugd3JpdGUgYSB2aXNpdG9yIHRoYXQgY29uc3RydWN0cyBwcm92aWRlciBpbXBvcnQgcGF0aHMgaW4gcmV2ZXJzZS5cbiAqXG4gKlxuICogV2UgdXNlIHRoZSB2aXNpdGVkQ29udGFpbmVycyBzZXQgZGVmaW5lZCBvdXRzaWRlIHRoaXMgdmlzaXRvclxuICogYmVjYXVzZSB3ZSB3YW50IHRvIHJ1biBzb21lIGxvZ2ljIG9ubHkgb25jZSBmb3JcbiAqIGVhY2ggY29udGFpbmVyIGluIHRoZSB0cmVlLiBUaGF0IGxvZ2ljIGNhbiBiZSBkZXNjcmliZWQgYXM6XG4gKlxuICpcbiAqIDEuIGZvciBlYWNoIGRpc2NvdmVyZWRfcHJvdmlkZXIgYW5kIGRpc2NvdmVyZWRfcGF0aCBpbiB0aGUgaW5jb21wbGV0ZSBwcm92aWRlciBwYXRocyB3ZSd2ZVxuICogYWxyZWFkeSBkaXNjb3ZlcmVkXG4gKiAyLiBnZXQgdGhlIGZpcnN0IGNvbnRhaW5lciBpbiBkaXNjb3ZlcmVkX3BhdGhcbiAqIDMuIGlmIHRoYXQgZmlyc3QgY29udGFpbmVyIGlzIGluIHRoZSBpbXBvcnRzIGFycmF5IG9mIHRoZSBjb250YWluZXIgd2UncmUgdmlzaXRpbmdcbiAqICAgIFRoZW4gdGhlIGNvbnRhaW5lciB3ZSdyZSB2aXNpdGluZyBpcyBhbHNvIGluIHRoZSBpbXBvcnQgcGF0aCBvZiBkaXNjb3ZlcmVkX3Byb3ZpZGVyLCBzbyB3ZVxuICogICAgdW5zaGlmdCBkaXNjb3ZlcmVkX3BhdGggd2l0aCB0aGUgY29udGFpbmVyIHdlJ3JlIGN1cnJlbnRseSB2aXNpdGluZ1xuICpcbiAqXG4gKiBFeGFtcGxlIFJ1bjpcbiAqIGBgYFxuICogICAgICAgICAgICAgICAgIOKUjOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUkFxuICogICAgICAgICAgICAgICAgIOKUgmNvbnRhaW5lckHilIJcbiAqICAgICAg4pSM4pSAaW1wb3J0cy3ilIDilKQgICAgICAgICAg4pSc4pSA4pSAaW1wb3J0c+KUgOKUkFxuICogICAgICDilIIgICAgICAgICAg4pSCICBwcm92QSAgIOKUgiAgICAgICAgICDilIJcbiAqICAgICAg4pSCICAgICAgICAgIOKUgiAgcHJvdkIgICDilIIgICAgICAgICAg4pSCXG4gKiAgICAgIOKUgiAgICAgICAgICDilJTilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilJggICAgICAgICAg4pSCXG4gKiAgICAgIOKUgiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg4pSCXG4gKiAgICAg4pSM4pa84pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSQICAgICAgICAgICAgIOKUjOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKWvOKUgOKUkFxuICogICAgIOKUgmNvbnRhaW5lckLilIIgICAgICAgICAgICAg4pSCY29udGFpbmVyQ+KUglxuICogICAgIOKUgiAgICAgICAgICDilIIgICAgICAgICAgICAg4pSCICAgICAgICAgIOKUglxuICogICAgIOKUgiAgcHJvdkQgICDilIIgICAgICAgICAgICAg4pSCICBwcm92RiAgIOKUglxuICogICAgIOKUgiAgcHJvdkUgICDilIIgICAgICAgICAgICAg4pSCICBwcm92RyAgIOKUglxuICogICAgIOKUlOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUmCAgICAgICAgICAgICDilJTilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilJhcbiAqIGBgYFxuICpcbiAqIEVhY2ggc3RlcCBvZiB0aGUgdHJhdmVyc2FsLFxuICpcbiAqIGBgYFxuICogdmlzaXRvcihwcm92RCwgY29udGFpbmVyQilcbiAqIHByb3ZpZGVyVG9QYXRoID09PSBNYXAgeyBwcm92RCA9PiBbY29udGFpbmVyQl0gfVxuICogdmlzaXRlZENvbnRhaW5lcnMgPT09IFNldCB7IGNvbnRhaW5lckIgfVxuICpcbiAqIHZpc2l0b3IocHJvdkUsIGNvbnRhaW5lckIpXG4gKiBwcm92aWRlclRvUGF0aCA9PT0gTWFwIHsgcHJvdkQgPT4gW2NvbnRhaW5lckJdLCBwcm92RSA9PiBbY29udGFpbmVyQl0gfVxuICogdmlzaXRlZENvbnRhaW5lcnMgPT09IFNldCB7IGNvbnRhaW5lckIgfVxuICpcbiAqIHZpc2l0b3IocHJvdkYsIGNvbnRhaW5lckMpXG4gKiBwcm92aWRlclRvUGF0aCA9PT0gTWFwIHsgcHJvdkQgPT4gW2NvbnRhaW5lckJdLCBwcm92RSA9PiBbY29udGFpbmVyQl0sIHByb3ZGID0+IFtjb250YWluZXJDXSB9XG4gKiB2aXNpdGVkQ29udGFpbmVycyA9PT0gU2V0IHsgY29udGFpbmVyQiwgY29udGFpbmVyQyB9XG4gKlxuICogdmlzaXRvcihwcm92RywgY29udGFpbmVyQylcbiAqIHByb3ZpZGVyVG9QYXRoID09PSBNYXAge1xuICogICBwcm92RCA9PiBbY29udGFpbmVyQl0sIHByb3ZFID0+IFtjb250YWluZXJCXSwgcHJvdkYgPT4gW2NvbnRhaW5lckNdLCBwcm92RyA9PiBbY29udGFpbmVyQ11cbiAqIH1cbiAqIHZpc2l0ZWRDb250YWluZXJzID09PSBTZXQgeyBjb250YWluZXJCLCBjb250YWluZXJDIH1cbiAqXG4gKiB2aXNpdG9yKHByb3ZBLCBjb250YWluZXJBKVxuICogcHJvdmlkZXJUb1BhdGggPT09IE1hcCB7XG4gKiAgIHByb3ZEID0+IFtjb250YWluZXJBLCBjb250YWluZXJCXSxcbiAqICAgcHJvdkUgPT4gW2NvbnRhaW5lckEsIGNvbnRhaW5lckJdLFxuICogICBwcm92RiA9PiBbY29udGFpbmVyQSwgY29udGFpbmVyQ10sXG4gKiAgIHByb3ZHID0+IFtjb250YWluZXJBLCBjb250YWluZXJDXSxcbiAqICAgcHJvdkEgPT4gW2NvbnRhaW5lckFdXG4gKiB9XG4gKiB2aXNpdGVkQ29udGFpbmVycyA9PT0gU2V0IHsgY29udGFpbmVyQiwgY29udGFpbmVyQywgY29udGFpbmVyQSB9XG4gKlxuICogdmlzaXRvcihwcm92QiwgY29udGFpbmVyQSlcbiAqIHByb3ZpZGVyVG9QYXRoID09PSBNYXAge1xuICogICBwcm92RCA9PiBbY29udGFpbmVyQSwgY29udGFpbmVyQl0sXG4gKiAgIHByb3ZFID0+IFtjb250YWluZXJBLCBjb250YWluZXJCXSxcbiAqICAgcHJvdkYgPT4gW2NvbnRhaW5lckEsIGNvbnRhaW5lckNdLFxuICogICBwcm92RyA9PiBbY29udGFpbmVyQSwgY29udGFpbmVyQ10sXG4gKiAgIHByb3ZBID0+IFtjb250YWluZXJBXVxuICogICBwcm92QiA9PiBbY29udGFpbmVyQV1cbiAqIH1cbiAqIHZpc2l0ZWRDb250YWluZXJzID09PSBTZXQgeyBjb250YWluZXJCLCBjb250YWluZXJDLCBjb250YWluZXJBIH1cbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBwcm92aWRlclRvUGF0aCBNYXAgbWFwIG9mIHByb3ZpZGVycyB0byBwYXRocyB0aGF0IHRoaXMgZnVuY3Rpb24gZmlsbHNcbiAqIEBwYXJhbSB2aXNpdGVkQ29udGFpbmVycyBTZXQgYSBzZXQgdG8ga2VlcCB0cmFjayBvZiB0aGUgY29udGFpbmVycyB3ZSd2ZSBhbHJlYWR5IHZpc2l0ZWRcbiAqIEByZXR1cm4gZnVuY3Rpb24ocHJvdmlkZXIgU2luZ2xlUHJvdmlkZXIsIGNvbnRhaW5lcjogVHlwZTx1bmtub3duPiB8IEluamVjdG9yVHlwZTx1bmtub3duPikgPT5cbiAqICAgICB2b2lkXG4gKi9cbmZ1bmN0aW9uIHdhbGtQcm92aWRlclRyZWVUb0Rpc2NvdmVySW1wb3J0UGF0aHMoXG4gIHByb3ZpZGVyVG9QYXRoOiBNYXA8U2luZ2xlUHJvdmlkZXIsIChUeXBlPHVua25vd24+IHwgSW5qZWN0b3JUeXBlPHVua25vd24+KVtdPixcbiAgdmlzaXRlZENvbnRhaW5lcnM6IFNldDxUeXBlPHVua25vd24+Pixcbik6IChwcm92aWRlcjogU2luZ2xlUHJvdmlkZXIsIGNvbnRhaW5lcjogVHlwZTx1bmtub3duPiB8IEluamVjdG9yVHlwZTx1bmtub3duPikgPT4gdm9pZCB7XG4gIHJldHVybiAocHJvdmlkZXI6IFNpbmdsZVByb3ZpZGVyLCBjb250YWluZXI6IFR5cGU8dW5rbm93bj4gfCBJbmplY3RvclR5cGU8dW5rbm93bj4pID0+IHtcbiAgICAvLyBJZiB0aGUgcHJvdmlkZXIgaXMgbm90IGFscmVhZHkgaW4gdGhlIHByb3ZpZGVyVG9QYXRoIG1hcCxcbiAgICAvLyBhZGQgYW4gZW50cnkgd2l0aCB0aGUgcHJvdmlkZXIgYXMgdGhlIGtleSBhbmQgYW4gYXJyYXkgY29udGFpbmluZyB0aGUgY3VycmVudCBjb250YWluZXIgYXNcbiAgICAvLyB0aGUgdmFsdWVcbiAgICBpZiAoIXByb3ZpZGVyVG9QYXRoLmhhcyhwcm92aWRlcikpIHtcbiAgICAgIHByb3ZpZGVyVG9QYXRoLnNldChwcm92aWRlciwgW2NvbnRhaW5lcl0pO1xuICAgIH1cblxuICAgIC8vIFRoaXMgYmxvY2sgd2lsbCBydW4gZXhhY3RseSBvbmNlIGZvciBlYWNoIGNvbnRhaW5lciBpbiB0aGUgaW1wb3J0IHRyZWUuXG4gICAgLy8gVGhpcyBpcyB3aGVyZSB3ZSBydW4gdGhlIGxvZ2ljIHRvIGNoZWNrIHRoZSBpbXBvcnRzIGFycmF5IG9mIHRoZSBjdXJyZW50XG4gICAgLy8gY29udGFpbmVyIHRvIHNlZSBpZiBpdCdzIHRoZSBuZXh0IGNvbnRhaW5lciBpbiB0aGUgcGF0aCBmb3Igb3VyIGN1cnJlbnRseVxuICAgIC8vIGRpc2NvdmVyZWQgcHJvdmlkZXJzLlxuICAgIGlmICghdmlzaXRlZENvbnRhaW5lcnMuaGFzKGNvbnRhaW5lcikpIHtcbiAgICAgIC8vIEl0ZXJhdGUgdGhyb3VnaCB0aGUgcHJvdmlkZXJzIHdlJ3ZlIGFscmVhZHkgc2VlblxuICAgICAgZm9yIChjb25zdCBwcm92IG9mIHByb3ZpZGVyVG9QYXRoLmtleXMoKSkge1xuICAgICAgICBjb25zdCBleGlzdGluZ0ltcG9ydFBhdGggPSBwcm92aWRlclRvUGF0aC5nZXQocHJvdikhO1xuXG4gICAgICAgIGxldCBjb250YWluZXJEZWYgPSBnZXRJbmplY3RvckRlZihjb250YWluZXIpO1xuICAgICAgICBpZiAoIWNvbnRhaW5lckRlZikge1xuICAgICAgICAgIGNvbnN0IG5nTW9kdWxlOiBUeXBlPHVua25vd24+IHwgdW5kZWZpbmVkID0gKGNvbnRhaW5lciBhcyBhbnkpLm5nTW9kdWxlIGFzXG4gICAgICAgICAgICB8IFR5cGU8dW5rbm93bj5cbiAgICAgICAgICAgIHwgdW5kZWZpbmVkO1xuICAgICAgICAgIGNvbnRhaW5lckRlZiA9IGdldEluamVjdG9yRGVmKG5nTW9kdWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghY29udGFpbmVyRGVmKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbGFzdENvbnRhaW5lckFkZGVkVG9QYXRoID0gZXhpc3RpbmdJbXBvcnRQYXRoWzBdO1xuXG4gICAgICAgIGxldCBpc05leHRTdGVwSW5QYXRoID0gZmFsc2U7XG4gICAgICAgIGRlZXBGb3JFYWNoKGNvbnRhaW5lckRlZi5pbXBvcnRzLCAobW9kdWxlSW1wb3J0KSA9PiB7XG4gICAgICAgICAgaWYgKGlzTmV4dFN0ZXBJblBhdGgpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpc05leHRTdGVwSW5QYXRoID1cbiAgICAgICAgICAgIChtb2R1bGVJbXBvcnQgYXMgYW55KS5uZ01vZHVsZSA9PT0gbGFzdENvbnRhaW5lckFkZGVkVG9QYXRoIHx8XG4gICAgICAgICAgICBtb2R1bGVJbXBvcnQgPT09IGxhc3RDb250YWluZXJBZGRlZFRvUGF0aDtcblxuICAgICAgICAgIGlmIChpc05leHRTdGVwSW5QYXRoKSB7XG4gICAgICAgICAgICBwcm92aWRlclRvUGF0aC5nZXQocHJvdik/LnVuc2hpZnQoY29udGFpbmVyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZpc2l0ZWRDb250YWluZXJzLmFkZChjb250YWluZXIpO1xuICB9O1xufVxuXG4vKipcbiAqIEdldHMgdGhlIHByb3ZpZGVycyBjb25maWd1cmVkIG9uIGFuIEVudmlyb25tZW50SW5qZWN0b3JcbiAqXG4gKiBAcGFyYW0gaW5qZWN0b3IgRW52aXJvbm1lbnRJbmplY3RvclxuICogQHJldHVybnMgYW4gYXJyYXkgb2Ygb2JqZWN0cyByZXByZXNlbnRpbmcgdGhlIHByb3ZpZGVycyBvZiB0aGUgZ2l2ZW4gaW5qZWN0b3JcbiAqL1xuZnVuY3Rpb24gZ2V0RW52aXJvbm1lbnRJbmplY3RvclByb3ZpZGVycyhpbmplY3RvcjogRW52aXJvbm1lbnRJbmplY3Rvcik6IFByb3ZpZGVyUmVjb3JkW10ge1xuICBjb25zdCBwcm92aWRlclJlY29yZHNXaXRob3V0SW1wb3J0UGF0aHMgPVxuICAgIGdldEZyYW1ld29ya0RJRGVidWdEYXRhKCkucmVzb2x2ZXJUb1Byb3ZpZGVycy5nZXQoaW5qZWN0b3IpID8/IFtdO1xuXG4gIC8vIHBsYXRmb3JtIGluamVjdG9yIGhhcyBubyBwcm92aWRlciBpbXBvcnRzIGNvbnRhaW5lciBzbyBjYW4gd2Ugc2tpcCB0cnlpbmcgdG9cbiAgLy8gZmluZCBpbXBvcnQgcGF0aHNcbiAgaWYgKGlzUGxhdGZvcm1JbmplY3RvcihpbmplY3RvcikpIHtcbiAgICByZXR1cm4gcHJvdmlkZXJSZWNvcmRzV2l0aG91dEltcG9ydFBhdGhzO1xuICB9XG5cbiAgY29uc3QgcHJvdmlkZXJJbXBvcnRzQ29udGFpbmVyID0gZ2V0UHJvdmlkZXJJbXBvcnRzQ29udGFpbmVyKGluamVjdG9yKTtcbiAgaWYgKHByb3ZpZGVySW1wb3J0c0NvbnRhaW5lciA9PT0gbnVsbCkge1xuICAgIC8vIFdlIGFzc3VtZSB0aGF0IGlmIGFuIGVudmlyb25tZW50IGluamVjdG9yIGV4aXN0cyB3aXRob3V0IGFuIGFzc29jaWF0ZWQgcHJvdmlkZXIgaW1wb3J0c1xuICAgIC8vIGNvbnRhaW5lciwgaXQgd2FzIGNyZWF0ZWQgd2l0aG91dCBzdWNoIGEgY29udGFpbmVyLiBTb21lIGV4YW1wbGVzIGNhc2VzIHdoZXJlIHRoaXMgY291bGRcbiAgICAvLyBoYXBwZW46XG4gICAgLy8gLSBUaGUgcm9vdCBpbmplY3RvciBvZiBhIHN0YW5kYWxvbmUgYXBwbGljYXRpb25cbiAgICAvLyAtIEEgcm91dGVyIGluamVjdG9yIGNyZWF0ZWQgYnkgdXNpbmcgdGhlIHByb3ZpZGVycyBhcnJheSBpbiBhIGxhenkgbG9hZGVkIHJvdXRlXG4gICAgLy8gLSBBIG1hbnVhbGx5IGNyZWF0ZWQgaW5qZWN0b3IgdGhhdCBpcyBhdHRhY2hlZCB0byB0aGUgaW5qZWN0b3IgdHJlZVxuICAgIC8vIFNpbmNlIGVhY2ggb2YgdGhlc2UgY2FzZXMgaGFzIG5vIHByb3ZpZGVyIGNvbnRhaW5lciwgdGhlcmUgaXMgbm8gY29uY2VwdCBvZiBpbXBvcnQgcGF0aHMsXG4gICAgLy8gc28gd2UgY2FuIHNpbXBseSByZXR1cm4gdGhlIHByb3ZpZGVyIHJlY29yZHMuXG4gICAgcmV0dXJuIHByb3ZpZGVyUmVjb3Jkc1dpdGhvdXRJbXBvcnRQYXRocztcbiAgfVxuXG4gIGNvbnN0IHByb3ZpZGVyVG9QYXRoID0gZ2V0UHJvdmlkZXJJbXBvcnRQYXRocyhwcm92aWRlckltcG9ydHNDb250YWluZXIpO1xuICBjb25zdCBwcm92aWRlclJlY29yZHMgPSBbXTtcblxuICBmb3IgKGNvbnN0IHByb3ZpZGVyUmVjb3JkIG9mIHByb3ZpZGVyUmVjb3Jkc1dpdGhvdXRJbXBvcnRQYXRocykge1xuICAgIGNvbnN0IHByb3ZpZGVyID0gcHJvdmlkZXJSZWNvcmQucHJvdmlkZXI7XG4gICAgLy8gSWdub3JlIHRoZXNlIHNwZWNpYWwgcHJvdmlkZXJzIGZvciBub3cgdW50aWwgd2UgaGF2ZSBhIGNsZWFuZXIgd2F5IG9mXG4gICAgLy8gZGV0ZXJtaW5nIHdoZW4gdGhleSBhcmUgcHJvdmlkZWQgYnkgdGhlIGZyYW1ld29yayB2cyBwcm92aWRlZCBieSB0aGUgdXNlci5cbiAgICBjb25zdCB0b2tlbiA9IChwcm92aWRlciBhcyBWYWx1ZVByb3ZpZGVyKS5wcm92aWRlO1xuICAgIGlmICh0b2tlbiA9PT0gRU5WSVJPTk1FTlRfSU5JVElBTElaRVIgfHwgdG9rZW4gPT09IElOSkVDVE9SX0RFRl9UWVBFUykge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgbGV0IGltcG9ydFBhdGggPSBwcm92aWRlclRvUGF0aC5nZXQocHJvdmlkZXIpID8/IFtdO1xuXG4gICAgY29uc3QgZGVmID0gZ2V0Q29tcG9uZW50RGVmKHByb3ZpZGVySW1wb3J0c0NvbnRhaW5lcik7XG4gICAgY29uc3QgaXNTdGFuZGFsb25lQ29tcG9uZW50ID0gISFkZWY/LnN0YW5kYWxvbmU7XG4gICAgLy8gV2UgcHJlcGVuZCB0aGUgY29tcG9uZW50IGNvbnN0cnVjdG9yIGluIHRoZSBzdGFuZGFsb25lIGNhc2VcbiAgICAvLyBiZWNhdXNlIHdhbGtQcm92aWRlclRyZWUgZG9lcyBub3QgdmlzaXQgdGhpcyBjb25zdHJ1Y3RvciBkdXJpbmcgaXQncyB0cmF2ZXJzYWxcbiAgICBpZiAoaXNTdGFuZGFsb25lQ29tcG9uZW50KSB7XG4gICAgICBpbXBvcnRQYXRoID0gW3Byb3ZpZGVySW1wb3J0c0NvbnRhaW5lciwgLi4uaW1wb3J0UGF0aF07XG4gICAgfVxuXG4gICAgcHJvdmlkZXJSZWNvcmRzLnB1c2goey4uLnByb3ZpZGVyUmVjb3JkLCBpbXBvcnRQYXRofSk7XG4gIH1cbiAgcmV0dXJuIHByb3ZpZGVyUmVjb3Jkcztcbn1cblxuZnVuY3Rpb24gaXNQbGF0Zm9ybUluamVjdG9yKGluamVjdG9yOiBJbmplY3Rvcikge1xuICByZXR1cm4gaW5qZWN0b3IgaW5zdGFuY2VvZiBSM0luamVjdG9yICYmIGluamVjdG9yLnNjb3Blcy5oYXMoJ3BsYXRmb3JtJyk7XG59XG5cbi8qKlxuICogR2V0cyB0aGUgcHJvdmlkZXJzIGNvbmZpZ3VyZWQgb24gYW4gaW5qZWN0b3IuXG4gKlxuICogQHBhcmFtIGluamVjdG9yIHRoZSBpbmplY3RvciB0byBsb29rdXAgdGhlIHByb3ZpZGVycyBvZlxuICogQHJldHVybnMgUHJvdmlkZXJSZWNvcmRbXSBhbiBhcnJheSBvZiBvYmplY3RzIHJlcHJlc2VudGluZyB0aGUgcHJvdmlkZXJzIG9mIHRoZSBnaXZlbiBpbmplY3RvclxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5qZWN0b3JQcm92aWRlcnMoaW5qZWN0b3I6IEluamVjdG9yKTogUHJvdmlkZXJSZWNvcmRbXSB7XG4gIGlmIChpbmplY3RvciBpbnN0YW5jZW9mIE5vZGVJbmplY3Rvcikge1xuICAgIHJldHVybiBnZXROb2RlSW5qZWN0b3JQcm92aWRlcnMoaW5qZWN0b3IpO1xuICB9IGVsc2UgaWYgKGluamVjdG9yIGluc3RhbmNlb2YgRW52aXJvbm1lbnRJbmplY3Rvcikge1xuICAgIHJldHVybiBnZXRFbnZpcm9ubWVudEluamVjdG9yUHJvdmlkZXJzKGluamVjdG9yIGFzIEVudmlyb25tZW50SW5qZWN0b3IpO1xuICB9XG5cbiAgdGhyb3dFcnJvcignZ2V0SW5qZWN0b3JQcm92aWRlcnMgb25seSBzdXBwb3J0cyBOb2RlSW5qZWN0b3IgYW5kIEVudmlyb25tZW50SW5qZWN0b3InKTtcbn1cblxuLyoqXG4gKlxuICogR2l2ZW4gYW4gaW5qZWN0b3IsIHRoaXMgZnVuY3Rpb24gd2lsbCByZXR1cm5cbiAqIGFuIG9iamVjdCBjb250YWluaW5nIHRoZSB0eXBlIGFuZCBzb3VyY2Ugb2YgdGhlIGluamVjdG9yLlxuICpcbiAqIHwgICAgICAgICAgICAgIHwgdHlwZSAgICAgICAgfCBzb3VyY2UgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiB8LS0tLS0tLS0tLS0tLS18LS0tLS0tLS0tLS0tLXwtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfFxuICogfCBOb2RlSW5qZWN0b3IgfCBlbGVtZW50ICAgICB8IERPTSBlbGVtZW50IHRoYXQgY3JlYXRlZCB0aGlzIGluamVjdG9yICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgUjNJbmplY3RvciAgIHwgZW52aXJvbm1lbnQgfCBgaW5qZWN0b3Iuc291cmNlYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiB8IE51bGxJbmplY3RvciB8IG51bGwgICAgICAgIHwgbnVsbCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfFxuICpcbiAqIEBwYXJhbSBpbmplY3RvciB0aGUgSW5qZWN0b3IgdG8gZ2V0IG1ldGFkYXRhIGZvclxuICogQHJldHVybnMgYW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHR5cGUgYW5kIHNvdXJjZSBvZiB0aGUgZ2l2ZW4gaW5qZWN0b3IuIElmIHRoZSBpbmplY3RvciBtZXRhZGF0YVxuICogICAgIGNhbm5vdCBiZSBkZXRlcm1pbmVkLCByZXR1cm5zIG51bGwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbmplY3Rvck1ldGFkYXRhKFxuICBpbmplY3RvcjogSW5qZWN0b3IsXG4pOlxuICB8IHt0eXBlOiAnZWxlbWVudCc7IHNvdXJjZTogUkVsZW1lbnR9XG4gIHwge3R5cGU6ICdlbnZpcm9ubWVudCc7IHNvdXJjZTogc3RyaW5nIHwgbnVsbH1cbiAgfCB7dHlwZTogJ251bGwnOyBzb3VyY2U6IG51bGx9XG4gIHwgbnVsbCB7XG4gIGlmIChpbmplY3RvciBpbnN0YW5jZW9mIE5vZGVJbmplY3Rvcikge1xuICAgIGNvbnN0IGxWaWV3ID0gZ2V0Tm9kZUluamVjdG9yTFZpZXcoaW5qZWN0b3IpO1xuICAgIGNvbnN0IHROb2RlID0gZ2V0Tm9kZUluamVjdG9yVE5vZGUoaW5qZWN0b3IpITtcbiAgICBhc3NlcnRUTm9kZUZvckxWaWV3KHROb2RlLCBsVmlldyk7XG5cbiAgICByZXR1cm4ge3R5cGU6ICdlbGVtZW50Jywgc291cmNlOiBnZXROYXRpdmVCeVROb2RlKHROb2RlLCBsVmlldykgYXMgUkVsZW1lbnR9O1xuICB9XG5cbiAgaWYgKGluamVjdG9yIGluc3RhbmNlb2YgUjNJbmplY3Rvcikge1xuICAgIHJldHVybiB7dHlwZTogJ2Vudmlyb25tZW50Jywgc291cmNlOiBpbmplY3Rvci5zb3VyY2UgPz8gbnVsbH07XG4gIH1cblxuICBpZiAoaW5qZWN0b3IgaW5zdGFuY2VvZiBOdWxsSW5qZWN0b3IpIHtcbiAgICByZXR1cm4ge3R5cGU6ICdudWxsJywgc291cmNlOiBudWxsfTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0SW5qZWN0b3JSZXNvbHV0aW9uUGF0aChpbmplY3RvcjogSW5qZWN0b3IpOiBJbmplY3RvcltdIHtcbiAgY29uc3QgcmVzb2x1dGlvblBhdGg6IEluamVjdG9yW10gPSBbaW5qZWN0b3JdO1xuICBnZXRJbmplY3RvclJlc29sdXRpb25QYXRoSGVscGVyKGluamVjdG9yLCByZXNvbHV0aW9uUGF0aCk7XG4gIHJldHVybiByZXNvbHV0aW9uUGF0aDtcbn1cblxuZnVuY3Rpb24gZ2V0SW5qZWN0b3JSZXNvbHV0aW9uUGF0aEhlbHBlcihcbiAgaW5qZWN0b3I6IEluamVjdG9yLFxuICByZXNvbHV0aW9uUGF0aDogSW5qZWN0b3JbXSxcbik6IEluamVjdG9yW10ge1xuICBjb25zdCBwYXJlbnQgPSBnZXRJbmplY3RvclBhcmVudChpbmplY3Rvcik7XG5cbiAgLy8gaWYgZ2V0SW5qZWN0b3JQYXJlbnQgY2FuJ3QgZmluZCBhIHBhcmVudCwgdGhlbiB3ZSd2ZSBlaXRoZXIgcmVhY2hlZCB0aGUgZW5kXG4gIC8vIG9mIHRoZSBwYXRoLCBvciB3ZSBuZWVkIHRvIG1vdmUgZnJvbSB0aGUgRWxlbWVudCBJbmplY3RvciB0cmVlIHRvIHRoZVxuICAvLyBtb2R1bGUgaW5qZWN0b3IgdHJlZSB1c2luZyB0aGUgZmlyc3QgaW5qZWN0b3IgaW4gb3VyIHBhdGggYXMgdGhlIGNvbm5lY3Rpb24gcG9pbnQuXG4gIGlmIChwYXJlbnQgPT09IG51bGwpIHtcbiAgICBpZiAoaW5qZWN0b3IgaW5zdGFuY2VvZiBOb2RlSW5qZWN0b3IpIHtcbiAgICAgIGNvbnN0IGZpcnN0SW5qZWN0b3IgPSByZXNvbHV0aW9uUGF0aFswXTtcbiAgICAgIGlmIChmaXJzdEluamVjdG9yIGluc3RhbmNlb2YgTm9kZUluamVjdG9yKSB7XG4gICAgICAgIGNvbnN0IG1vZHVsZUluamVjdG9yID0gZ2V0TW9kdWxlSW5qZWN0b3JPZk5vZGVJbmplY3RvcihmaXJzdEluamVjdG9yKTtcbiAgICAgICAgaWYgKG1vZHVsZUluamVjdG9yID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3dFcnJvcignTm9kZUluamVjdG9yIG11c3QgaGF2ZSBzb21lIGNvbm5lY3Rpb24gdG8gdGhlIG1vZHVsZSBpbmplY3RvciB0cmVlJyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXNvbHV0aW9uUGF0aC5wdXNoKG1vZHVsZUluamVjdG9yKTtcbiAgICAgICAgZ2V0SW5qZWN0b3JSZXNvbHV0aW9uUGF0aEhlbHBlcihtb2R1bGVJbmplY3RvciwgcmVzb2x1dGlvblBhdGgpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzb2x1dGlvblBhdGg7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHJlc29sdXRpb25QYXRoLnB1c2gocGFyZW50KTtcbiAgICBnZXRJbmplY3RvclJlc29sdXRpb25QYXRoSGVscGVyKHBhcmVudCwgcmVzb2x1dGlvblBhdGgpO1xuICB9XG5cbiAgcmV0dXJuIHJlc29sdXRpb25QYXRoO1xufVxuXG4vKipcbiAqIEdldHMgdGhlIHBhcmVudCBvZiBhbiBpbmplY3Rvci5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIG5vdCBhYmxlIHRvIG1ha2UgdGhlIGp1bXAgZnJvbSB0aGUgRWxlbWVudCBJbmplY3RvciBUcmVlIHRvIHRoZSBNb2R1bGVcbiAqIGluamVjdG9yIHRyZWUuIFRoaXMgaXMgYmVjYXVzZSB0aGUgXCJwYXJlbnRcIiAodGhlIG5leHQgc3RlcCBpbiB0aGUgcmVvc2x1dGlvbiBwYXRoKVxuICogb2YgYSByb290IE5vZGVJbmplY3RvciBpcyBkZXBlbmRlbnQgb24gd2hpY2ggTm9kZUluamVjdG9yIGFuY2VzdG9yIGluaXRpYXRlZFxuICogdGhlIERJIGxvb2t1cC4gU2VlIGdldEluamVjdG9yUmVzb2x1dGlvblBhdGggZm9yIGEgZnVuY3Rpb24gdGhhdCBjYW4gbWFrZSB0aGlzIGp1bXAuXG4gKlxuICogSW4gdGhlIGJlbG93IGRpYWdyYW06XG4gKiBgYGB0c1xuICogZ2V0SW5qZWN0b3JQYXJlbnQoTm9kZUluamVjdG9yQilcbiAqICA+IE5vZGVJbmplY3RvckFcbiAqIGdldEluamVjdG9yUGFyZW50KE5vZGVJbmplY3RvckEpIC8vIG9yIGdldEluamVjdG9yUGFyZW50KGdldEluamVjdG9yUGFyZW50KE5vZGVJbmplY3RvckIpKVxuICogID4gbnVsbCAvLyBjYW5ub3QganVtcCB0byBNb2R1bGVJbmplY3RvciB0cmVlXG4gKiBgYGBcbiAqXG4gKiBgYGBcbiAqICAgICAgICAgICAgICAgIOKUjOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUkCAgICAgICAgICAgICAgICDilIzilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilJBcbiAqICAgIOKUjOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUpE1vZHVsZUHilJzilIDilIDilIBJbmplY3RvcuKUgOKUgOKUgOKUgOKWuuKUgkVudmlyb25tZW50SW5qZWN0b3LilIJcbiAqICAgIOKUgiAgICAgICAgICAg4pSU4pSA4pSA4pSA4pSs4pSA4pSA4pSA4pSYICAgICAgICAgICAgICAgIOKUlOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUmFxuICogICAg4pSCICAgICAgICAgICAgICAg4pSCXG4gKiAgICDilIIgICAgICAgICAgIGJvb3RzdHJhcHNcbiAqICAgIOKUgiAgICAgICAgICAgICAgIOKUglxuICogICAg4pSCICAgICAgICAgICAgICAg4pSCXG4gKiAgICDilIIgICAgICAgICAg4pSM4pSA4pSA4pSA4pSA4pa84pSA4pSA4pSA4pSA4pSA4pSQICAgICAgICAgICAgICAgICDilIzilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilJBcbiAqIGRlY2xhcmVzICAgICAg4pSCQ29tcG9uZW50QeKUnOKUgOKUgOKUgOKUgEluamVjdG9y4pSA4pSA4pSA4pSA4pa64pSCTm9kZUluamVjdG9yQeKUglxuICogICAg4pSCICAgICAgICAgIOKUlOKUgOKUgOKUgOKUgOKUrOKUgOKUgOKUgOKUgOKUgOKUmCAgICAgICAgICAgICAgICAg4pSU4pSA4pSA4pSA4pSA4pSA4pay4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSYXG4gKiAgICDilIIgICAgICAgICAgICAgICDilIIgICAgICAgICAgICAgICAgICAgICAgICAgICAgIOKUglxuICogICAg4pSCICAgICAgICAgICAgcmVuZGVycyAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFxuICogICAg4pSCICAgICAgICAgICAgICAg4pSCICAgICAgICAgICAgICAgICAgICAgICAgICAgICDilIJcbiAqICAgIOKUgiAgICAgICAgICDilIzilIDilIDilIDilIDilrzilIDilIDilIDilIDilIDilJAgICAgICAgICAgICAgICAgIOKUjOKUgOKUgOKUgOKUgOKUgOKUtOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUkFxuICogICAg4pSU4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pa64pSCQ29tcG9uZW50QuKUnOKUgOKUgOKUgOKUgEluamVjdG9y4pSA4pSA4pSA4pSA4pa64pSCTm9kZUluamVjdG9yQuKUglxuICogICAgICAgICAgICAgICDilJTilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilJggICAgICAgICAgICAgICAgIOKUlOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUmFxuICpgYGBcbiAqXG4gKiBAcGFyYW0gaW5qZWN0b3IgYW4gSW5qZWN0b3IgdG8gZ2V0IHRoZSBwYXJlbnQgb2ZcbiAqIEByZXR1cm5zIEluamVjdG9yIHRoZSBwYXJlbnQgb2YgdGhlIGdpdmVuIGluamVjdG9yXG4gKi9cbmZ1bmN0aW9uIGdldEluamVjdG9yUGFyZW50KGluamVjdG9yOiBJbmplY3Rvcik6IEluamVjdG9yIHwgbnVsbCB7XG4gIGlmIChpbmplY3RvciBpbnN0YW5jZW9mIFIzSW5qZWN0b3IpIHtcbiAgICBjb25zdCBwYXJlbnQgPSBpbmplY3Rvci5wYXJlbnQ7XG4gICAgaWYgKGlzUm91dGVyT3V0bGV0SW5qZWN0b3IocGFyZW50KSkge1xuICAgICAgLy8gVGhpcyBpcyBhIHNwZWNpYWwgY2FzZSBmb3IgYSBgQ2hhaW5lZEluamVjdG9yYCBpbnN0YW5jZSwgd2hpY2ggcmVwcmVzZW50c1xuICAgICAgLy8gYSBjb21iaW5hdGlvbiBvZiBhIFJvdXRlcidzIGBPdXRsZXRJbmplY3RvcmAgYW5kIGFuIEVudmlyb25tZW50SW5qZWN0b3IsXG4gICAgICAvLyB3aGljaCByZXByZXNlbnRzIGEgYEBkZWZlcmAgYmxvY2suIFNpbmNlIHRoZSBgT3V0bGV0SW5qZWN0b3JgIGRvZXNuJ3Qgc3RvcmVcbiAgICAgIC8vIGFueSB0b2tlbnMgaXRzZWxmLCB3ZSBwb2ludCB0byB0aGUgcGFyZW50IGluamVjdG9yIGluc3RlYWQuIFNlZSB0aGVcbiAgICAgIC8vIGBPdXRsZXRJbmplY3Rvci5fX25nT3V0bGV0SW5qZWN0b3JgIGZpZWxkIGZvciBhZGRpdGlvbmFsIGluZm9ybWF0aW9uLlxuICAgICAgcmV0dXJuIChwYXJlbnQgYXMgQ2hhaW5lZEluamVjdG9yKS5wYXJlbnRJbmplY3RvcjtcbiAgICB9XG4gICAgcmV0dXJuIHBhcmVudDtcbiAgfVxuXG4gIGxldCB0Tm9kZTogVEVsZW1lbnROb2RlIHwgVENvbnRhaW5lck5vZGUgfCBURWxlbWVudENvbnRhaW5lck5vZGUgfCBudWxsO1xuICBsZXQgbFZpZXc6IExWaWV3PHVua25vd24+O1xuICBpZiAoaW5qZWN0b3IgaW5zdGFuY2VvZiBOb2RlSW5qZWN0b3IpIHtcbiAgICB0Tm9kZSA9IGdldE5vZGVJbmplY3RvclROb2RlKGluamVjdG9yKTtcbiAgICBsVmlldyA9IGdldE5vZGVJbmplY3RvckxWaWV3KGluamVjdG9yKTtcbiAgfSBlbHNlIGlmIChpbmplY3RvciBpbnN0YW5jZW9mIE51bGxJbmplY3Rvcikge1xuICAgIHJldHVybiBudWxsO1xuICB9IGVsc2UgaWYgKGluamVjdG9yIGluc3RhbmNlb2YgQ2hhaW5lZEluamVjdG9yKSB7XG4gICAgcmV0dXJuIGluamVjdG9yLnBhcmVudEluamVjdG9yO1xuICB9IGVsc2Uge1xuICAgIHRocm93RXJyb3IoXG4gICAgICAnZ2V0SW5qZWN0b3JQYXJlbnQgb25seSBzdXBwb3J0IGluamVjdG9ycyBvZiB0eXBlIFIzSW5qZWN0b3IsIE5vZGVJbmplY3RvciwgTnVsbEluamVjdG9yJyxcbiAgICApO1xuICB9XG5cbiAgY29uc3QgcGFyZW50TG9jYXRpb24gPSBnZXRQYXJlbnRJbmplY3RvckxvY2F0aW9uKFxuICAgIHROb2RlIGFzIFRFbGVtZW50Tm9kZSB8IFRDb250YWluZXJOb2RlIHwgVEVsZW1lbnRDb250YWluZXJOb2RlLFxuICAgIGxWaWV3LFxuICApO1xuXG4gIGlmIChoYXNQYXJlbnRJbmplY3RvcihwYXJlbnRMb2NhdGlvbikpIHtcbiAgICBjb25zdCBwYXJlbnRJbmplY3RvckluZGV4ID0gZ2V0UGFyZW50SW5qZWN0b3JJbmRleChwYXJlbnRMb2NhdGlvbik7XG4gICAgY29uc3QgcGFyZW50TFZpZXcgPSBnZXRQYXJlbnRJbmplY3RvclZpZXcocGFyZW50TG9jYXRpb24sIGxWaWV3KTtcbiAgICBjb25zdCBwYXJlbnRUVmlldyA9IHBhcmVudExWaWV3W1RWSUVXXTtcbiAgICBjb25zdCBwYXJlbnRUTm9kZSA9IHBhcmVudFRWaWV3LmRhdGFbcGFyZW50SW5qZWN0b3JJbmRleCArIE5vZGVJbmplY3Rvck9mZnNldC5UTk9ERV0gYXMgVE5vZGU7XG4gICAgcmV0dXJuIG5ldyBOb2RlSW5qZWN0b3IoXG4gICAgICBwYXJlbnRUTm9kZSBhcyBURWxlbWVudE5vZGUgfCBUQ29udGFpbmVyTm9kZSB8IFRFbGVtZW50Q29udGFpbmVyTm9kZSxcbiAgICAgIHBhcmVudExWaWV3LFxuICAgICk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgY2hhaW5lZEluamVjdG9yID0gbFZpZXdbSU5KRUNUT1JdIGFzIENoYWluZWRJbmplY3RvcjtcblxuICAgIC8vIENhc2Ugd2hlcmUgY2hhaW5lZEluamVjdG9yLmluamVjdG9yIGlzIGFuIE91dGxldEluamVjdG9yIGFuZCBjaGFpbmVkSW5qZWN0b3IuaW5qZWN0b3IucGFyZW50XG4gICAgLy8gaXMgYSBOb2RlSW5qZWN0b3IuXG4gICAgLy8gdG9kbyhhbGVrc2FuZGVyYm9kdXJyaSk6IGlkZWFsbHkgbm90aGluZyBpbiBwYWNrYWdlcy9jb3JlIHNob3VsZCBkZWFsXG4gICAgLy8gZGlyZWN0bHkgd2l0aCByb3V0ZXIgY29uY2VybnMuIFJlZmFjdG9yIHRoaXMgc28gdGhhdCB3ZSBjYW4gbWFrZSB0aGUganVtcCBmcm9tXG4gICAgLy8gTm9kZUluamVjdG9yIC0+IE91dGxldEluamVjdG9yIC0+IE5vZGVJbmplY3RvclxuICAgIC8vIHdpdGhvdXQgZXhwbGljaXRseSByZWx5aW5nIG9uIHR5cGVzIGNvbnRyYWN0cyBmcm9tIHBhY2thZ2VzL3JvdXRlclxuICAgIGNvbnN0IGluamVjdG9yUGFyZW50ID0gKGNoYWluZWRJbmplY3Rvci5pbmplY3RvciBhcyBhbnkpPy5wYXJlbnQgYXMgSW5qZWN0b3I7XG5cbiAgICBpZiAoaW5qZWN0b3JQYXJlbnQgaW5zdGFuY2VvZiBOb2RlSW5qZWN0b3IpIHtcbiAgICAgIHJldHVybiBpbmplY3RvclBhcmVudDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBtb2R1bGUgaW5qZWN0b3Igb2YgYSBOb2RlSW5qZWN0b3IuXG4gKlxuICogQHBhcmFtIGluamVjdG9yIE5vZGVJbmplY3RvciB0byBnZXQgbW9kdWxlIGluamVjdG9yIG9mXG4gKiBAcmV0dXJucyBJbmplY3RvciByZXByZXNlbnRpbmcgbW9kdWxlIGluamVjdG9yIG9mIHRoZSBnaXZlbiBOb2RlSW5qZWN0b3JcbiAqL1xuZnVuY3Rpb24gZ2V0TW9kdWxlSW5qZWN0b3JPZk5vZGVJbmplY3RvcihpbmplY3RvcjogTm9kZUluamVjdG9yKTogSW5qZWN0b3Ige1xuICBsZXQgbFZpZXc6IExWaWV3PHVua25vd24+O1xuICBpZiAoaW5qZWN0b3IgaW5zdGFuY2VvZiBOb2RlSW5qZWN0b3IpIHtcbiAgICBsVmlldyA9IGdldE5vZGVJbmplY3RvckxWaWV3KGluamVjdG9yKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvd0Vycm9yKCdnZXRNb2R1bGVJbmplY3Rvck9mTm9kZUluamVjdG9yIG11c3QgYmUgY2FsbGVkIHdpdGggYSBOb2RlSW5qZWN0b3InKTtcbiAgfVxuXG4gIGNvbnN0IGluaiA9IGxWaWV3W0lOSkVDVE9SXSBhcyBSM0luamVjdG9yIHwgQ2hhaW5lZEluamVjdG9yO1xuICBjb25zdCBtb2R1bGVJbmplY3RvciA9IGluaiBpbnN0YW5jZW9mIENoYWluZWRJbmplY3RvciA/IGluai5wYXJlbnRJbmplY3RvciA6IGluai5wYXJlbnQ7XG4gIGlmICghbW9kdWxlSW5qZWN0b3IpIHtcbiAgICB0aHJvd0Vycm9yKCdOb2RlSW5qZWN0b3IgbXVzdCBoYXZlIHNvbWUgY29ubmVjdGlvbiB0byB0aGUgbW9kdWxlIGluamVjdG9yIHRyZWUnKTtcbiAgfVxuXG4gIHJldHVybiBtb2R1bGVJbmplY3Rvcjtcbn1cbiJdfQ==