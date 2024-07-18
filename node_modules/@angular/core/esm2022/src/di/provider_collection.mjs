/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { RuntimeError } from '../errors';
import { getComponentDef } from '../render3/definition';
import { getFactoryDef } from '../render3/definition_factory';
import { throwCyclicDependencyError, throwInvalidProviderError } from '../render3/errors_di';
import { stringifyForError } from '../render3/util/stringify_utils';
import { deepForEach } from '../util/array_utils';
import { EMPTY_ARRAY } from '../util/empty';
import { getClosureSafeProperty } from '../util/property';
import { stringify } from '../util/stringify';
import { resolveForwardRef } from './forward_ref';
import { ENVIRONMENT_INITIALIZER } from './initializer_token';
import { ɵɵinject as inject } from './injector_compatibility';
import { getInjectorDef } from './interface/defs';
import { isEnvironmentProviders, } from './interface/provider';
import { INJECTOR_DEF_TYPES } from './internal_tokens';
/**
 * Wrap an array of `Provider`s into `EnvironmentProviders`, preventing them from being accidentally
 * referenced in `@Component` in a component injector.
 */
export function makeEnvironmentProviders(providers) {
    return {
        ɵproviders: providers,
    };
}
/**
 * Collects providers from all NgModules and standalone components, including transitively imported
 * ones.
 *
 * Providers extracted via `importProvidersFrom` are only usable in an application injector or
 * another environment injector (such as a route injector). They should not be used in component
 * providers.
 *
 * More information about standalone components can be found in [this
 * guide](guide/components/importing).
 *
 * @usageNotes
 * The results of the `importProvidersFrom` call can be used in the `bootstrapApplication` call:
 *
 * ```typescript
 * await bootstrapApplication(RootComponent, {
 *   providers: [
 *     importProvidersFrom(NgModuleOne, NgModuleTwo)
 *   ]
 * });
 * ```
 *
 * You can also use the `importProvidersFrom` results in the `providers` field of a route, when a
 * standalone component is used:
 *
 * ```typescript
 * export const ROUTES: Route[] = [
 *   {
 *     path: 'foo',
 *     providers: [
 *       importProvidersFrom(NgModuleOne, NgModuleTwo)
 *     ],
 *     component: YourStandaloneComponent
 *   }
 * ];
 * ```
 *
 * @returns Collected providers from the specified list of types.
 * @publicApi
 */
export function importProvidersFrom(...sources) {
    return {
        ɵproviders: internalImportProvidersFrom(true, sources),
        ɵfromNgModule: true,
    };
}
export function internalImportProvidersFrom(checkForStandaloneCmp, ...sources) {
    const providersOut = [];
    const dedup = new Set(); // already seen types
    let injectorTypesWithProviders;
    const collectProviders = (provider) => {
        providersOut.push(provider);
    };
    deepForEach(sources, (source) => {
        if ((typeof ngDevMode === 'undefined' || ngDevMode) && checkForStandaloneCmp) {
            const cmpDef = getComponentDef(source);
            if (cmpDef?.standalone) {
                throw new RuntimeError(800 /* RuntimeErrorCode.IMPORT_PROVIDERS_FROM_STANDALONE */, `Importing providers supports NgModule or ModuleWithProviders but got a standalone component "${stringifyForError(source)}"`);
            }
        }
        // Narrow `source` to access the internal type analogue for `ModuleWithProviders`.
        const internalSource = source;
        if (walkProviderTree(internalSource, collectProviders, [], dedup)) {
            injectorTypesWithProviders ||= [];
            injectorTypesWithProviders.push(internalSource);
        }
    });
    // Collect all providers from `ModuleWithProviders` types.
    if (injectorTypesWithProviders !== undefined) {
        processInjectorTypesWithProviders(injectorTypesWithProviders, collectProviders);
    }
    return providersOut;
}
/**
 * Collects all providers from the list of `ModuleWithProviders` and appends them to the provided
 * array.
 */
function processInjectorTypesWithProviders(typesWithProviders, visitor) {
    for (let i = 0; i < typesWithProviders.length; i++) {
        const { ngModule, providers } = typesWithProviders[i];
        deepForEachProvider(providers, (provider) => {
            ngDevMode && validateProvider(provider, providers || EMPTY_ARRAY, ngModule);
            visitor(provider, ngModule);
        });
    }
}
/**
 * The logic visits an `InjectorType`, an `InjectorTypeWithProviders`, or a standalone
 * `ComponentType`, and all of its transitive providers and collects providers.
 *
 * If an `InjectorTypeWithProviders` that declares providers besides the type is specified,
 * the function will return "true" to indicate that the providers of the type definition need
 * to be processed. This allows us to process providers of injector types after all imports of
 * an injector definition are processed. (following View Engine semantics: see FW-1349)
 */
export function walkProviderTree(container, visitor, parents, dedup) {
    container = resolveForwardRef(container);
    if (!container)
        return false;
    // The actual type which had the definition. Usually `container`, but may be an unwrapped type
    // from `InjectorTypeWithProviders`.
    let defType = null;
    let injDef = getInjectorDef(container);
    const cmpDef = !injDef && getComponentDef(container);
    if (!injDef && !cmpDef) {
        // `container` is not an injector type or a component type. It might be:
        //  * An `InjectorTypeWithProviders` that wraps an injector type.
        //  * A standalone directive or pipe that got pulled in from a standalone component's
        //    dependencies.
        // Try to unwrap it as an `InjectorTypeWithProviders` first.
        const ngModule = container
            .ngModule;
        injDef = getInjectorDef(ngModule);
        if (injDef) {
            defType = ngModule;
        }
        else {
            // Not a component or injector type, so ignore it.
            return false;
        }
    }
    else if (cmpDef && !cmpDef.standalone) {
        return false;
    }
    else {
        defType = container;
    }
    // Check for circular dependencies.
    if (ngDevMode && parents.indexOf(defType) !== -1) {
        const defName = stringify(defType);
        const path = parents.map(stringify);
        throwCyclicDependencyError(defName, path);
    }
    // Check for multiple imports of the same module
    const isDuplicate = dedup.has(defType);
    if (cmpDef) {
        if (isDuplicate) {
            // This component definition has already been processed.
            return false;
        }
        dedup.add(defType);
        if (cmpDef.dependencies) {
            const deps = typeof cmpDef.dependencies === 'function' ? cmpDef.dependencies() : cmpDef.dependencies;
            for (const dep of deps) {
                walkProviderTree(dep, visitor, parents, dedup);
            }
        }
    }
    else if (injDef) {
        // First, include providers from any imports.
        if (injDef.imports != null && !isDuplicate) {
            // Before processing defType's imports, add it to the set of parents. This way, if it ends
            // up deeply importing itself, this can be detected.
            ngDevMode && parents.push(defType);
            // Add it to the set of dedups. This way we can detect multiple imports of the same module
            dedup.add(defType);
            let importTypesWithProviders;
            try {
                deepForEach(injDef.imports, (imported) => {
                    if (walkProviderTree(imported, visitor, parents, dedup)) {
                        importTypesWithProviders ||= [];
                        // If the processed import is an injector type with providers, we store it in the
                        // list of import types with providers, so that we can process those afterwards.
                        importTypesWithProviders.push(imported);
                    }
                });
            }
            finally {
                // Remove it from the parents set when finished.
                ngDevMode && parents.pop();
            }
            // Imports which are declared with providers (TypeWithProviders) need to be processed
            // after all imported modules are processed. This is similar to how View Engine
            // processes/merges module imports in the metadata resolver. See: FW-1349.
            if (importTypesWithProviders !== undefined) {
                processInjectorTypesWithProviders(importTypesWithProviders, visitor);
            }
        }
        if (!isDuplicate) {
            // Track the InjectorType and add a provider for it.
            // It's important that this is done after the def's imports.
            const factory = getFactoryDef(defType) || (() => new defType());
            // Append extra providers to make more info available for consumers (to retrieve an injector
            // type), as well as internally (to calculate an injection scope correctly and eagerly
            // instantiate a `defType` when an injector is created).
            // Provider to create `defType` using its factory.
            visitor({ provide: defType, useFactory: factory, deps: EMPTY_ARRAY }, defType);
            // Make this `defType` available to an internal logic that calculates injector scope.
            visitor({ provide: INJECTOR_DEF_TYPES, useValue: defType, multi: true }, defType);
            // Provider to eagerly instantiate `defType` via `INJECTOR_INITIALIZER`.
            visitor({ provide: ENVIRONMENT_INITIALIZER, useValue: () => inject(defType), multi: true }, defType);
        }
        // Next, include providers listed on the definition itself.
        const defProviders = injDef.providers;
        if (defProviders != null && !isDuplicate) {
            const injectorType = container;
            deepForEachProvider(defProviders, (provider) => {
                ngDevMode && validateProvider(provider, defProviders, injectorType);
                visitor(provider, injectorType);
            });
        }
    }
    else {
        // Should not happen, but just in case.
        return false;
    }
    return (defType !== container && container.providers !== undefined);
}
function validateProvider(provider, providers, containerType) {
    if (isTypeProvider(provider) ||
        isValueProvider(provider) ||
        isFactoryProvider(provider) ||
        isExistingProvider(provider)) {
        return;
    }
    // Here we expect the provider to be a `useClass` provider (by elimination).
    const classRef = resolveForwardRef(provider && (provider.useClass || provider.provide));
    if (!classRef) {
        throwInvalidProviderError(containerType, providers, provider);
    }
}
function deepForEachProvider(providers, fn) {
    for (let provider of providers) {
        if (isEnvironmentProviders(provider)) {
            provider = provider.ɵproviders;
        }
        if (Array.isArray(provider)) {
            deepForEachProvider(provider, fn);
        }
        else {
            fn(provider);
        }
    }
}
export const USE_VALUE = getClosureSafeProperty({
    provide: String,
    useValue: getClosureSafeProperty,
});
export function isValueProvider(value) {
    return value !== null && typeof value == 'object' && USE_VALUE in value;
}
export function isExistingProvider(value) {
    return !!(value && value.useExisting);
}
export function isFactoryProvider(value) {
    return !!(value && value.useFactory);
}
export function isTypeProvider(value) {
    return typeof value === 'function';
}
export function isClassProvider(value) {
    return !!value.useClass;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvdmlkZXJfY29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2RpL3Byb3ZpZGVyX2NvbGxlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFlBQVksRUFBbUIsTUFBTSxXQUFXLENBQUM7QUFFekQsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ3RELE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUM1RCxPQUFPLEVBQUMsMEJBQTBCLEVBQUUseUJBQXlCLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUMzRixPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSxpQ0FBaUMsQ0FBQztBQUNsRSxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDaEQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUMxQyxPQUFPLEVBQUMsc0JBQXNCLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUN4RCxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFNUMsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQ2hELE9BQU8sRUFBQyx1QkFBdUIsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQzVELE9BQU8sRUFBQyxRQUFRLElBQUksTUFBTSxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFDNUQsT0FBTyxFQUFDLGNBQWMsRUFBMEMsTUFBTSxrQkFBa0IsQ0FBQztBQUN6RixPQUFPLEVBUUwsc0JBQXNCLEdBTXZCLE1BQU0sc0JBQXNCLENBQUM7QUFDOUIsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFckQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLHdCQUF3QixDQUN0QyxTQUE4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eXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7UnVudGltZUVycm9yLCBSdW50aW1lRXJyb3JDb2RlfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IHtUeXBlfSBmcm9tICcuLi9pbnRlcmZhY2UvdHlwZSc7XG5pbXBvcnQge2dldENvbXBvbmVudERlZn0gZnJvbSAnLi4vcmVuZGVyMy9kZWZpbml0aW9uJztcbmltcG9ydCB7Z2V0RmFjdG9yeURlZn0gZnJvbSAnLi4vcmVuZGVyMy9kZWZpbml0aW9uX2ZhY3RvcnknO1xuaW1wb3J0IHt0aHJvd0N5Y2xpY0RlcGVuZGVuY3lFcnJvciwgdGhyb3dJbnZhbGlkUHJvdmlkZXJFcnJvcn0gZnJvbSAnLi4vcmVuZGVyMy9lcnJvcnNfZGknO1xuaW1wb3J0IHtzdHJpbmdpZnlGb3JFcnJvcn0gZnJvbSAnLi4vcmVuZGVyMy91dGlsL3N0cmluZ2lmeV91dGlscyc7XG5pbXBvcnQge2RlZXBGb3JFYWNofSBmcm9tICcuLi91dGlsL2FycmF5X3V0aWxzJztcbmltcG9ydCB7RU1QVFlfQVJSQVl9IGZyb20gJy4uL3V0aWwvZW1wdHknO1xuaW1wb3J0IHtnZXRDbG9zdXJlU2FmZVByb3BlcnR5fSBmcm9tICcuLi91dGlsL3Byb3BlcnR5JztcbmltcG9ydCB7c3RyaW5naWZ5fSBmcm9tICcuLi91dGlsL3N0cmluZ2lmeSc7XG5cbmltcG9ydCB7cmVzb2x2ZUZvcndhcmRSZWZ9IGZyb20gJy4vZm9yd2FyZF9yZWYnO1xuaW1wb3J0IHtFTlZJUk9OTUVOVF9JTklUSUFMSVpFUn0gZnJvbSAnLi9pbml0aWFsaXplcl90b2tlbic7XG5pbXBvcnQge8m1ybVpbmplY3QgYXMgaW5qZWN0fSBmcm9tICcuL2luamVjdG9yX2NvbXBhdGliaWxpdHknO1xuaW1wb3J0IHtnZXRJbmplY3RvckRlZiwgSW5qZWN0b3JUeXBlLCBJbmplY3RvclR5cGVXaXRoUHJvdmlkZXJzfSBmcm9tICcuL2ludGVyZmFjZS9kZWZzJztcbmltcG9ydCB7XG4gIENsYXNzUHJvdmlkZXIsXG4gIENvbnN0cnVjdG9yUHJvdmlkZXIsXG4gIEVudmlyb25tZW50UHJvdmlkZXJzLFxuICBFeGlzdGluZ1Byb3ZpZGVyLFxuICBGYWN0b3J5UHJvdmlkZXIsXG4gIEltcG9ydGVkTmdNb2R1bGVQcm92aWRlcnMsXG4gIEludGVybmFsRW52aXJvbm1lbnRQcm92aWRlcnMsXG4gIGlzRW52aXJvbm1lbnRQcm92aWRlcnMsXG4gIE1vZHVsZVdpdGhQcm92aWRlcnMsXG4gIFByb3ZpZGVyLFxuICBTdGF0aWNDbGFzc1Byb3ZpZGVyLFxuICBUeXBlUHJvdmlkZXIsXG4gIFZhbHVlUHJvdmlkZXIsXG59IGZyb20gJy4vaW50ZXJmYWNlL3Byb3ZpZGVyJztcbmltcG9ydCB7SU5KRUNUT1JfREVGX1RZUEVTfSBmcm9tICcuL2ludGVybmFsX3Rva2Vucyc7XG5cbi8qKlxuICogV3JhcCBhbiBhcnJheSBvZiBgUHJvdmlkZXJgcyBpbnRvIGBFbnZpcm9ubWVudFByb3ZpZGVyc2AsIHByZXZlbnRpbmcgdGhlbSBmcm9tIGJlaW5nIGFjY2lkZW50YWxseVxuICogcmVmZXJlbmNlZCBpbiBgQENvbXBvbmVudGAgaW4gYSBjb21wb25lbnQgaW5qZWN0b3IuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYWtlRW52aXJvbm1lbnRQcm92aWRlcnMoXG4gIHByb3ZpZGVyczogKFByb3ZpZGVyIHwgRW52aXJvbm1lbnRQcm92aWRlcnMpW10sXG4pOiBFbnZpcm9ubWVudFByb3ZpZGVycyB7XG4gIHJldHVybiB7XG4gICAgybVwcm92aWRlcnM6IHByb3ZpZGVycyxcbiAgfSBhcyB1bmtub3duIGFzIEVudmlyb25tZW50UHJvdmlkZXJzO1xufVxuXG4vKipcbiAqIEEgc291cmNlIG9mIHByb3ZpZGVycyBmb3IgdGhlIGBpbXBvcnRQcm92aWRlcnNGcm9tYCBmdW5jdGlvbi5cbiAqXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCB0eXBlIEltcG9ydFByb3ZpZGVyc1NvdXJjZSA9XG4gIHwgVHlwZTx1bmtub3duPlxuICB8IE1vZHVsZVdpdGhQcm92aWRlcnM8dW5rbm93bj5cbiAgfCBBcnJheTxJbXBvcnRQcm92aWRlcnNTb3VyY2U+O1xuXG50eXBlIFdhbGtQcm92aWRlclRyZWVWaXNpdG9yID0gKFxuICBwcm92aWRlcjogU2luZ2xlUHJvdmlkZXIsXG4gIGNvbnRhaW5lcjogVHlwZTx1bmtub3duPiB8IEluamVjdG9yVHlwZTx1bmtub3duPixcbikgPT4gdm9pZDtcblxuLyoqXG4gKiBDb2xsZWN0cyBwcm92aWRlcnMgZnJvbSBhbGwgTmdNb2R1bGVzIGFuZCBzdGFuZGFsb25lIGNvbXBvbmVudHMsIGluY2x1ZGluZyB0cmFuc2l0aXZlbHkgaW1wb3J0ZWRcbiAqIG9uZXMuXG4gKlxuICogUHJvdmlkZXJzIGV4dHJhY3RlZCB2aWEgYGltcG9ydFByb3ZpZGVyc0Zyb21gIGFyZSBvbmx5IHVzYWJsZSBpbiBhbiBhcHBsaWNhdGlvbiBpbmplY3RvciBvclxuICogYW5vdGhlciBlbnZpcm9ubWVudCBpbmplY3RvciAoc3VjaCBhcyBhIHJvdXRlIGluamVjdG9yKS4gVGhleSBzaG91bGQgbm90IGJlIHVzZWQgaW4gY29tcG9uZW50XG4gKiBwcm92aWRlcnMuXG4gKlxuICogTW9yZSBpbmZvcm1hdGlvbiBhYm91dCBzdGFuZGFsb25lIGNvbXBvbmVudHMgY2FuIGJlIGZvdW5kIGluIFt0aGlzXG4gKiBndWlkZV0oZ3VpZGUvY29tcG9uZW50cy9pbXBvcnRpbmcpLlxuICpcbiAqIEB1c2FnZU5vdGVzXG4gKiBUaGUgcmVzdWx0cyBvZiB0aGUgYGltcG9ydFByb3ZpZGVyc0Zyb21gIGNhbGwgY2FuIGJlIHVzZWQgaW4gdGhlIGBib290c3RyYXBBcHBsaWNhdGlvbmAgY2FsbDpcbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBhd2FpdCBib290c3RyYXBBcHBsaWNhdGlvbihSb290Q29tcG9uZW50LCB7XG4gKiAgIHByb3ZpZGVyczogW1xuICogICAgIGltcG9ydFByb3ZpZGVyc0Zyb20oTmdNb2R1bGVPbmUsIE5nTW9kdWxlVHdvKVxuICogICBdXG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIFlvdSBjYW4gYWxzbyB1c2UgdGhlIGBpbXBvcnRQcm92aWRlcnNGcm9tYCByZXN1bHRzIGluIHRoZSBgcHJvdmlkZXJzYCBmaWVsZCBvZiBhIHJvdXRlLCB3aGVuIGFcbiAqIHN0YW5kYWxvbmUgY29tcG9uZW50IGlzIHVzZWQ6XG4gKlxuICogYGBgdHlwZXNjcmlwdFxuICogZXhwb3J0IGNvbnN0IFJPVVRFUzogUm91dGVbXSA9IFtcbiAqICAge1xuICogICAgIHBhdGg6ICdmb28nLFxuICogICAgIHByb3ZpZGVyczogW1xuICogICAgICAgaW1wb3J0UHJvdmlkZXJzRnJvbShOZ01vZHVsZU9uZSwgTmdNb2R1bGVUd28pXG4gKiAgICAgXSxcbiAqICAgICBjb21wb25lbnQ6IFlvdXJTdGFuZGFsb25lQ29tcG9uZW50XG4gKiAgIH1cbiAqIF07XG4gKiBgYGBcbiAqXG4gKiBAcmV0dXJucyBDb2xsZWN0ZWQgcHJvdmlkZXJzIGZyb20gdGhlIHNwZWNpZmllZCBsaXN0IG9mIHR5cGVzLlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gaW1wb3J0UHJvdmlkZXJzRnJvbSguLi5zb3VyY2VzOiBJbXBvcnRQcm92aWRlcnNTb3VyY2VbXSk6IEVudmlyb25tZW50UHJvdmlkZXJzIHtcbiAgcmV0dXJuIHtcbiAgICDJtXByb3ZpZGVyczogaW50ZXJuYWxJbXBvcnRQcm92aWRlcnNGcm9tKHRydWUsIHNvdXJjZXMpLFxuICAgIMm1ZnJvbU5nTW9kdWxlOiB0cnVlLFxuICB9IGFzIEludGVybmFsRW52aXJvbm1lbnRQcm92aWRlcnM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbnRlcm5hbEltcG9ydFByb3ZpZGVyc0Zyb20oXG4gIGNoZWNrRm9yU3RhbmRhbG9uZUNtcDogYm9vbGVhbixcbiAgLi4uc291cmNlczogSW1wb3J0UHJvdmlkZXJzU291cmNlW11cbik6IFByb3ZpZGVyW10ge1xuICBjb25zdCBwcm92aWRlcnNPdXQ6IFNpbmdsZVByb3ZpZGVyW10gPSBbXTtcbiAgY29uc3QgZGVkdXAgPSBuZXcgU2V0PFR5cGU8dW5rbm93bj4+KCk7IC8vIGFscmVhZHkgc2VlbiB0eXBlc1xuICBsZXQgaW5qZWN0b3JUeXBlc1dpdGhQcm92aWRlcnM6IEluamVjdG9yVHlwZVdpdGhQcm92aWRlcnM8dW5rbm93bj5bXSB8IHVuZGVmaW5lZDtcblxuICBjb25zdCBjb2xsZWN0UHJvdmlkZXJzOiBXYWxrUHJvdmlkZXJUcmVlVmlzaXRvciA9IChwcm92aWRlcikgPT4ge1xuICAgIHByb3ZpZGVyc091dC5wdXNoKHByb3ZpZGVyKTtcbiAgfTtcblxuICBkZWVwRm9yRWFjaChzb3VyY2VzLCAoc291cmNlKSA9PiB7XG4gICAgaWYgKCh0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCBuZ0Rldk1vZGUpICYmIGNoZWNrRm9yU3RhbmRhbG9uZUNtcCkge1xuICAgICAgY29uc3QgY21wRGVmID0gZ2V0Q29tcG9uZW50RGVmKHNvdXJjZSk7XG4gICAgICBpZiAoY21wRGVmPy5zdGFuZGFsb25lKSB7XG4gICAgICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgICAgUnVudGltZUVycm9yQ29kZS5JTVBPUlRfUFJPVklERVJTX0ZST01fU1RBTkRBTE9ORSxcbiAgICAgICAgICBgSW1wb3J0aW5nIHByb3ZpZGVycyBzdXBwb3J0cyBOZ01vZHVsZSBvciBNb2R1bGVXaXRoUHJvdmlkZXJzIGJ1dCBnb3QgYSBzdGFuZGFsb25lIGNvbXBvbmVudCBcIiR7c3RyaW5naWZ5Rm9yRXJyb3IoXG4gICAgICAgICAgICBzb3VyY2UsXG4gICAgICAgICAgKX1cImAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTmFycm93IGBzb3VyY2VgIHRvIGFjY2VzcyB0aGUgaW50ZXJuYWwgdHlwZSBhbmFsb2d1ZSBmb3IgYE1vZHVsZVdpdGhQcm92aWRlcnNgLlxuICAgIGNvbnN0IGludGVybmFsU291cmNlID0gc291cmNlIGFzIFR5cGU8dW5rbm93bj4gfCBJbmplY3RvclR5cGVXaXRoUHJvdmlkZXJzPHVua25vd24+O1xuICAgIGlmICh3YWxrUHJvdmlkZXJUcmVlKGludGVybmFsU291cmNlLCBjb2xsZWN0UHJvdmlkZXJzLCBbXSwgZGVkdXApKSB7XG4gICAgICBpbmplY3RvclR5cGVzV2l0aFByb3ZpZGVycyB8fD0gW107XG4gICAgICBpbmplY3RvclR5cGVzV2l0aFByb3ZpZGVycy5wdXNoKGludGVybmFsU291cmNlKTtcbiAgICB9XG4gIH0pO1xuICAvLyBDb2xsZWN0IGFsbCBwcm92aWRlcnMgZnJvbSBgTW9kdWxlV2l0aFByb3ZpZGVyc2AgdHlwZXMuXG4gIGlmIChpbmplY3RvclR5cGVzV2l0aFByb3ZpZGVycyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcHJvY2Vzc0luamVjdG9yVHlwZXNXaXRoUHJvdmlkZXJzKGluamVjdG9yVHlwZXNXaXRoUHJvdmlkZXJzLCBjb2xsZWN0UHJvdmlkZXJzKTtcbiAgfVxuXG4gIHJldHVybiBwcm92aWRlcnNPdXQ7XG59XG5cbi8qKlxuICogQ29sbGVjdHMgYWxsIHByb3ZpZGVycyBmcm9tIHRoZSBsaXN0IG9mIGBNb2R1bGVXaXRoUHJvdmlkZXJzYCBhbmQgYXBwZW5kcyB0aGVtIHRvIHRoZSBwcm92aWRlZFxuICogYXJyYXkuXG4gKi9cbmZ1bmN0aW9uIHByb2Nlc3NJbmplY3RvclR5cGVzV2l0aFByb3ZpZGVycyhcbiAgdHlwZXNXaXRoUHJvdmlkZXJzOiBJbmplY3RvclR5cGVXaXRoUHJvdmlkZXJzPHVua25vd24+W10sXG4gIHZpc2l0b3I6IFdhbGtQcm92aWRlclRyZWVWaXNpdG9yLFxuKTogdm9pZCB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdHlwZXNXaXRoUHJvdmlkZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3Qge25nTW9kdWxlLCBwcm92aWRlcnN9ID0gdHlwZXNXaXRoUHJvdmlkZXJzW2ldO1xuICAgIGRlZXBGb3JFYWNoUHJvdmlkZXIoXG4gICAgICBwcm92aWRlcnMhIGFzIEFycmF5PFByb3ZpZGVyIHwgSW50ZXJuYWxFbnZpcm9ubWVudFByb3ZpZGVycz4sXG4gICAgICAocHJvdmlkZXIpID0+IHtcbiAgICAgICAgbmdEZXZNb2RlICYmIHZhbGlkYXRlUHJvdmlkZXIocHJvdmlkZXIsIHByb3ZpZGVycyB8fCBFTVBUWV9BUlJBWSwgbmdNb2R1bGUpO1xuICAgICAgICB2aXNpdG9yKHByb3ZpZGVyLCBuZ01vZHVsZSk7XG4gICAgICB9LFxuICAgICk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbnRlcm5hbCB0eXBlIGZvciBhIHNpbmdsZSBwcm92aWRlciBpbiBhIGRlZXAgcHJvdmlkZXIgYXJyYXkuXG4gKi9cbmV4cG9ydCB0eXBlIFNpbmdsZVByb3ZpZGVyID1cbiAgfCBUeXBlUHJvdmlkZXJcbiAgfCBWYWx1ZVByb3ZpZGVyXG4gIHwgQ2xhc3NQcm92aWRlclxuICB8IENvbnN0cnVjdG9yUHJvdmlkZXJcbiAgfCBFeGlzdGluZ1Byb3ZpZGVyXG4gIHwgRmFjdG9yeVByb3ZpZGVyXG4gIHwgU3RhdGljQ2xhc3NQcm92aWRlcjtcblxuLyoqXG4gKiBUaGUgbG9naWMgdmlzaXRzIGFuIGBJbmplY3RvclR5cGVgLCBhbiBgSW5qZWN0b3JUeXBlV2l0aFByb3ZpZGVyc2AsIG9yIGEgc3RhbmRhbG9uZVxuICogYENvbXBvbmVudFR5cGVgLCBhbmQgYWxsIG9mIGl0cyB0cmFuc2l0aXZlIHByb3ZpZGVycyBhbmQgY29sbGVjdHMgcHJvdmlkZXJzLlxuICpcbiAqIElmIGFuIGBJbmplY3RvclR5cGVXaXRoUHJvdmlkZXJzYCB0aGF0IGRlY2xhcmVzIHByb3ZpZGVycyBiZXNpZGVzIHRoZSB0eXBlIGlzIHNwZWNpZmllZCxcbiAqIHRoZSBmdW5jdGlvbiB3aWxsIHJldHVybiBcInRydWVcIiB0byBpbmRpY2F0ZSB0aGF0IHRoZSBwcm92aWRlcnMgb2YgdGhlIHR5cGUgZGVmaW5pdGlvbiBuZWVkXG4gKiB0byBiZSBwcm9jZXNzZWQuIFRoaXMgYWxsb3dzIHVzIHRvIHByb2Nlc3MgcHJvdmlkZXJzIG9mIGluamVjdG9yIHR5cGVzIGFmdGVyIGFsbCBpbXBvcnRzIG9mXG4gKiBhbiBpbmplY3RvciBkZWZpbml0aW9uIGFyZSBwcm9jZXNzZWQuIChmb2xsb3dpbmcgVmlldyBFbmdpbmUgc2VtYW50aWNzOiBzZWUgRlctMTM0OSlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdhbGtQcm92aWRlclRyZWUoXG4gIGNvbnRhaW5lcjogVHlwZTx1bmtub3duPiB8IEluamVjdG9yVHlwZVdpdGhQcm92aWRlcnM8dW5rbm93bj4sXG4gIHZpc2l0b3I6IFdhbGtQcm92aWRlclRyZWVWaXNpdG9yLFxuICBwYXJlbnRzOiBUeXBlPHVua25vd24+W10sXG4gIGRlZHVwOiBTZXQ8VHlwZTx1bmtub3duPj4sXG4pOiBjb250YWluZXIgaXMgSW5qZWN0b3JUeXBlV2l0aFByb3ZpZGVyczx1bmtub3duPiB7XG4gIGNvbnRhaW5lciA9IHJlc29sdmVGb3J3YXJkUmVmKGNvbnRhaW5lcik7XG4gIGlmICghY29udGFpbmVyKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gVGhlIGFjdHVhbCB0eXBlIHdoaWNoIGhhZCB0aGUgZGVmaW5pdGlvbi4gVXN1YWxseSBgY29udGFpbmVyYCwgYnV0IG1heSBiZSBhbiB1bndyYXBwZWQgdHlwZVxuICAvLyBmcm9tIGBJbmplY3RvclR5cGVXaXRoUHJvdmlkZXJzYC5cbiAgbGV0IGRlZlR5cGU6IFR5cGU8dW5rbm93bj4gfCBudWxsID0gbnVsbDtcblxuICBsZXQgaW5qRGVmID0gZ2V0SW5qZWN0b3JEZWYoY29udGFpbmVyKTtcbiAgY29uc3QgY21wRGVmID0gIWluakRlZiAmJiBnZXRDb21wb25lbnREZWYoY29udGFpbmVyKTtcbiAgaWYgKCFpbmpEZWYgJiYgIWNtcERlZikge1xuICAgIC8vIGBjb250YWluZXJgIGlzIG5vdCBhbiBpbmplY3RvciB0eXBlIG9yIGEgY29tcG9uZW50IHR5cGUuIEl0IG1pZ2h0IGJlOlxuICAgIC8vICAqIEFuIGBJbmplY3RvclR5cGVXaXRoUHJvdmlkZXJzYCB0aGF0IHdyYXBzIGFuIGluamVjdG9yIHR5cGUuXG4gICAgLy8gICogQSBzdGFuZGFsb25lIGRpcmVjdGl2ZSBvciBwaXBlIHRoYXQgZ290IHB1bGxlZCBpbiBmcm9tIGEgc3RhbmRhbG9uZSBjb21wb25lbnQnc1xuICAgIC8vICAgIGRlcGVuZGVuY2llcy5cbiAgICAvLyBUcnkgdG8gdW53cmFwIGl0IGFzIGFuIGBJbmplY3RvclR5cGVXaXRoUHJvdmlkZXJzYCBmaXJzdC5cbiAgICBjb25zdCBuZ01vZHVsZTogVHlwZTx1bmtub3duPiB8IHVuZGVmaW5lZCA9IChjb250YWluZXIgYXMgSW5qZWN0b3JUeXBlV2l0aFByb3ZpZGVyczxhbnk+KVxuICAgICAgLm5nTW9kdWxlIGFzIFR5cGU8dW5rbm93bj4gfCB1bmRlZmluZWQ7XG4gICAgaW5qRGVmID0gZ2V0SW5qZWN0b3JEZWYobmdNb2R1bGUpO1xuICAgIGlmIChpbmpEZWYpIHtcbiAgICAgIGRlZlR5cGUgPSBuZ01vZHVsZSE7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vdCBhIGNvbXBvbmVudCBvciBpbmplY3RvciB0eXBlLCBzbyBpZ25vcmUgaXQuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9IGVsc2UgaWYgKGNtcERlZiAmJiAhY21wRGVmLnN0YW5kYWxvbmUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0gZWxzZSB7XG4gICAgZGVmVHlwZSA9IGNvbnRhaW5lciBhcyBUeXBlPHVua25vd24+O1xuICB9XG5cbiAgLy8gQ2hlY2sgZm9yIGNpcmN1bGFyIGRlcGVuZGVuY2llcy5cbiAgaWYgKG5nRGV2TW9kZSAmJiBwYXJlbnRzLmluZGV4T2YoZGVmVHlwZSkgIT09IC0xKSB7XG4gICAgY29uc3QgZGVmTmFtZSA9IHN0cmluZ2lmeShkZWZUeXBlKTtcbiAgICBjb25zdCBwYXRoID0gcGFyZW50cy5tYXAoc3RyaW5naWZ5KTtcbiAgICB0aHJvd0N5Y2xpY0RlcGVuZGVuY3lFcnJvcihkZWZOYW1lLCBwYXRoKTtcbiAgfVxuXG4gIC8vIENoZWNrIGZvciBtdWx0aXBsZSBpbXBvcnRzIG9mIHRoZSBzYW1lIG1vZHVsZVxuICBjb25zdCBpc0R1cGxpY2F0ZSA9IGRlZHVwLmhhcyhkZWZUeXBlKTtcblxuICBpZiAoY21wRGVmKSB7XG4gICAgaWYgKGlzRHVwbGljYXRlKSB7XG4gICAgICAvLyBUaGlzIGNvbXBvbmVudCBkZWZpbml0aW9uIGhhcyBhbHJlYWR5IGJlZW4gcHJvY2Vzc2VkLlxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBkZWR1cC5hZGQoZGVmVHlwZSk7XG5cbiAgICBpZiAoY21wRGVmLmRlcGVuZGVuY2llcykge1xuICAgICAgY29uc3QgZGVwcyA9XG4gICAgICAgIHR5cGVvZiBjbXBEZWYuZGVwZW5kZW5jaWVzID09PSAnZnVuY3Rpb24nID8gY21wRGVmLmRlcGVuZGVuY2llcygpIDogY21wRGVmLmRlcGVuZGVuY2llcztcbiAgICAgIGZvciAoY29uc3QgZGVwIG9mIGRlcHMpIHtcbiAgICAgICAgd2Fsa1Byb3ZpZGVyVHJlZShkZXAsIHZpc2l0b3IsIHBhcmVudHMsIGRlZHVwKTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAoaW5qRGVmKSB7XG4gICAgLy8gRmlyc3QsIGluY2x1ZGUgcHJvdmlkZXJzIGZyb20gYW55IGltcG9ydHMuXG4gICAgaWYgKGluakRlZi5pbXBvcnRzICE9IG51bGwgJiYgIWlzRHVwbGljYXRlKSB7XG4gICAgICAvLyBCZWZvcmUgcHJvY2Vzc2luZyBkZWZUeXBlJ3MgaW1wb3J0cywgYWRkIGl0IHRvIHRoZSBzZXQgb2YgcGFyZW50cy4gVGhpcyB3YXksIGlmIGl0IGVuZHNcbiAgICAgIC8vIHVwIGRlZXBseSBpbXBvcnRpbmcgaXRzZWxmLCB0aGlzIGNhbiBiZSBkZXRlY3RlZC5cbiAgICAgIG5nRGV2TW9kZSAmJiBwYXJlbnRzLnB1c2goZGVmVHlwZSk7XG4gICAgICAvLyBBZGQgaXQgdG8gdGhlIHNldCBvZiBkZWR1cHMuIFRoaXMgd2F5IHdlIGNhbiBkZXRlY3QgbXVsdGlwbGUgaW1wb3J0cyBvZiB0aGUgc2FtZSBtb2R1bGVcbiAgICAgIGRlZHVwLmFkZChkZWZUeXBlKTtcblxuICAgICAgbGV0IGltcG9ydFR5cGVzV2l0aFByb3ZpZGVyczogSW5qZWN0b3JUeXBlV2l0aFByb3ZpZGVyczxhbnk+W10gfCB1bmRlZmluZWQ7XG4gICAgICB0cnkge1xuICAgICAgICBkZWVwRm9yRWFjaChpbmpEZWYuaW1wb3J0cywgKGltcG9ydGVkKSA9PiB7XG4gICAgICAgICAgaWYgKHdhbGtQcm92aWRlclRyZWUoaW1wb3J0ZWQsIHZpc2l0b3IsIHBhcmVudHMsIGRlZHVwKSkge1xuICAgICAgICAgICAgaW1wb3J0VHlwZXNXaXRoUHJvdmlkZXJzIHx8PSBbXTtcbiAgICAgICAgICAgIC8vIElmIHRoZSBwcm9jZXNzZWQgaW1wb3J0IGlzIGFuIGluamVjdG9yIHR5cGUgd2l0aCBwcm92aWRlcnMsIHdlIHN0b3JlIGl0IGluIHRoZVxuICAgICAgICAgICAgLy8gbGlzdCBvZiBpbXBvcnQgdHlwZXMgd2l0aCBwcm92aWRlcnMsIHNvIHRoYXQgd2UgY2FuIHByb2Nlc3MgdGhvc2UgYWZ0ZXJ3YXJkcy5cbiAgICAgICAgICAgIGltcG9ydFR5cGVzV2l0aFByb3ZpZGVycy5wdXNoKGltcG9ydGVkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgLy8gUmVtb3ZlIGl0IGZyb20gdGhlIHBhcmVudHMgc2V0IHdoZW4gZmluaXNoZWQuXG4gICAgICAgIG5nRGV2TW9kZSAmJiBwYXJlbnRzLnBvcCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBJbXBvcnRzIHdoaWNoIGFyZSBkZWNsYXJlZCB3aXRoIHByb3ZpZGVycyAoVHlwZVdpdGhQcm92aWRlcnMpIG5lZWQgdG8gYmUgcHJvY2Vzc2VkXG4gICAgICAvLyBhZnRlciBhbGwgaW1wb3J0ZWQgbW9kdWxlcyBhcmUgcHJvY2Vzc2VkLiBUaGlzIGlzIHNpbWlsYXIgdG8gaG93IFZpZXcgRW5naW5lXG4gICAgICAvLyBwcm9jZXNzZXMvbWVyZ2VzIG1vZHVsZSBpbXBvcnRzIGluIHRoZSBtZXRhZGF0YSByZXNvbHZlci4gU2VlOiBGVy0xMzQ5LlxuICAgICAgaWYgKGltcG9ydFR5cGVzV2l0aFByb3ZpZGVycyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHByb2Nlc3NJbmplY3RvclR5cGVzV2l0aFByb3ZpZGVycyhpbXBvcnRUeXBlc1dpdGhQcm92aWRlcnMsIHZpc2l0b3IpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghaXNEdXBsaWNhdGUpIHtcbiAgICAgIC8vIFRyYWNrIHRoZSBJbmplY3RvclR5cGUgYW5kIGFkZCBhIHByb3ZpZGVyIGZvciBpdC5cbiAgICAgIC8vIEl0J3MgaW1wb3J0YW50IHRoYXQgdGhpcyBpcyBkb25lIGFmdGVyIHRoZSBkZWYncyBpbXBvcnRzLlxuICAgICAgY29uc3QgZmFjdG9yeSA9IGdldEZhY3RvcnlEZWYoZGVmVHlwZSkgfHwgKCgpID0+IG5ldyBkZWZUeXBlISgpKTtcblxuICAgICAgLy8gQXBwZW5kIGV4dHJhIHByb3ZpZGVycyB0byBtYWtlIG1vcmUgaW5mbyBhdmFpbGFibGUgZm9yIGNvbnN1bWVycyAodG8gcmV0cmlldmUgYW4gaW5qZWN0b3JcbiAgICAgIC8vIHR5cGUpLCBhcyB3ZWxsIGFzIGludGVybmFsbHkgKHRvIGNhbGN1bGF0ZSBhbiBpbmplY3Rpb24gc2NvcGUgY29ycmVjdGx5IGFuZCBlYWdlcmx5XG4gICAgICAvLyBpbnN0YW50aWF0ZSBhIGBkZWZUeXBlYCB3aGVuIGFuIGluamVjdG9yIGlzIGNyZWF0ZWQpLlxuXG4gICAgICAvLyBQcm92aWRlciB0byBjcmVhdGUgYGRlZlR5cGVgIHVzaW5nIGl0cyBmYWN0b3J5LlxuICAgICAgdmlzaXRvcih7cHJvdmlkZTogZGVmVHlwZSwgdXNlRmFjdG9yeTogZmFjdG9yeSwgZGVwczogRU1QVFlfQVJSQVl9LCBkZWZUeXBlKTtcblxuICAgICAgLy8gTWFrZSB0aGlzIGBkZWZUeXBlYCBhdmFpbGFibGUgdG8gYW4gaW50ZXJuYWwgbG9naWMgdGhhdCBjYWxjdWxhdGVzIGluamVjdG9yIHNjb3BlLlxuICAgICAgdmlzaXRvcih7cHJvdmlkZTogSU5KRUNUT1JfREVGX1RZUEVTLCB1c2VWYWx1ZTogZGVmVHlwZSwgbXVsdGk6IHRydWV9LCBkZWZUeXBlKTtcblxuICAgICAgLy8gUHJvdmlkZXIgdG8gZWFnZXJseSBpbnN0YW50aWF0ZSBgZGVmVHlwZWAgdmlhIGBJTkpFQ1RPUl9JTklUSUFMSVpFUmAuXG4gICAgICB2aXNpdG9yKFxuICAgICAgICB7cHJvdmlkZTogRU5WSVJPTk1FTlRfSU5JVElBTElaRVIsIHVzZVZhbHVlOiAoKSA9PiBpbmplY3QoZGVmVHlwZSEpLCBtdWx0aTogdHJ1ZX0sXG4gICAgICAgIGRlZlR5cGUsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIE5leHQsIGluY2x1ZGUgcHJvdmlkZXJzIGxpc3RlZCBvbiB0aGUgZGVmaW5pdGlvbiBpdHNlbGYuXG4gICAgY29uc3QgZGVmUHJvdmlkZXJzID0gaW5qRGVmLnByb3ZpZGVycyBhcyBBcnJheTxTaW5nbGVQcm92aWRlciB8IEludGVybmFsRW52aXJvbm1lbnRQcm92aWRlcnM+O1xuICAgIGlmIChkZWZQcm92aWRlcnMgIT0gbnVsbCAmJiAhaXNEdXBsaWNhdGUpIHtcbiAgICAgIGNvbnN0IGluamVjdG9yVHlwZSA9IGNvbnRhaW5lciBhcyBJbmplY3RvclR5cGU8YW55PjtcbiAgICAgIGRlZXBGb3JFYWNoUHJvdmlkZXIoZGVmUHJvdmlkZXJzLCAocHJvdmlkZXIpID0+IHtcbiAgICAgICAgbmdEZXZNb2RlICYmIHZhbGlkYXRlUHJvdmlkZXIocHJvdmlkZXIgYXMgU2luZ2xlUHJvdmlkZXIsIGRlZlByb3ZpZGVycywgaW5qZWN0b3JUeXBlKTtcbiAgICAgICAgdmlzaXRvcihwcm92aWRlciwgaW5qZWN0b3JUeXBlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBTaG91bGQgbm90IGhhcHBlbiwgYnV0IGp1c3QgaW4gY2FzZS5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gKFxuICAgIGRlZlR5cGUgIT09IGNvbnRhaW5lciAmJiAoY29udGFpbmVyIGFzIEluamVjdG9yVHlwZVdpdGhQcm92aWRlcnM8YW55PikucHJvdmlkZXJzICE9PSB1bmRlZmluZWRcbiAgKTtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVQcm92aWRlcihcbiAgcHJvdmlkZXI6IFNpbmdsZVByb3ZpZGVyLFxuICBwcm92aWRlcnM6IEFycmF5PFNpbmdsZVByb3ZpZGVyIHwgSW50ZXJuYWxFbnZpcm9ubWVudFByb3ZpZGVycz4sXG4gIGNvbnRhaW5lclR5cGU6IFR5cGU8dW5rbm93bj4sXG4pOiB2b2lkIHtcbiAgaWYgKFxuICAgIGlzVHlwZVByb3ZpZGVyKHByb3ZpZGVyKSB8fFxuICAgIGlzVmFsdWVQcm92aWRlcihwcm92aWRlcikgfHxcbiAgICBpc0ZhY3RvcnlQcm92aWRlcihwcm92aWRlcikgfHxcbiAgICBpc0V4aXN0aW5nUHJvdmlkZXIocHJvdmlkZXIpXG4gICkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEhlcmUgd2UgZXhwZWN0IHRoZSBwcm92aWRlciB0byBiZSBhIGB1c2VDbGFzc2AgcHJvdmlkZXIgKGJ5IGVsaW1pbmF0aW9uKS5cbiAgY29uc3QgY2xhc3NSZWYgPSByZXNvbHZlRm9yd2FyZFJlZihcbiAgICBwcm92aWRlciAmJiAoKHByb3ZpZGVyIGFzIFN0YXRpY0NsYXNzUHJvdmlkZXIgfCBDbGFzc1Byb3ZpZGVyKS51c2VDbGFzcyB8fCBwcm92aWRlci5wcm92aWRlKSxcbiAgKTtcbiAgaWYgKCFjbGFzc1JlZikge1xuICAgIHRocm93SW52YWxpZFByb3ZpZGVyRXJyb3IoY29udGFpbmVyVHlwZSwgcHJvdmlkZXJzLCBwcm92aWRlcik7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVlcEZvckVhY2hQcm92aWRlcihcbiAgcHJvdmlkZXJzOiBBcnJheTxQcm92aWRlciB8IEludGVybmFsRW52aXJvbm1lbnRQcm92aWRlcnM+LFxuICBmbjogKHByb3ZpZGVyOiBTaW5nbGVQcm92aWRlcikgPT4gdm9pZCxcbik6IHZvaWQge1xuICBmb3IgKGxldCBwcm92aWRlciBvZiBwcm92aWRlcnMpIHtcbiAgICBpZiAoaXNFbnZpcm9ubWVudFByb3ZpZGVycyhwcm92aWRlcikpIHtcbiAgICAgIHByb3ZpZGVyID0gcHJvdmlkZXIuybVwcm92aWRlcnM7XG4gICAgfVxuICAgIGlmIChBcnJheS5pc0FycmF5KHByb3ZpZGVyKSkge1xuICAgICAgZGVlcEZvckVhY2hQcm92aWRlcihwcm92aWRlciwgZm4pO1xuICAgIH0gZWxzZSB7XG4gICAgICBmbihwcm92aWRlcik7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjb25zdCBVU0VfVkFMVUUgPSBnZXRDbG9zdXJlU2FmZVByb3BlcnR5PFZhbHVlUHJvdmlkZXI+KHtcbiAgcHJvdmlkZTogU3RyaW5nLFxuICB1c2VWYWx1ZTogZ2V0Q2xvc3VyZVNhZmVQcm9wZXJ0eSxcbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNWYWx1ZVByb3ZpZGVyKHZhbHVlOiBTaW5nbGVQcm92aWRlcik6IHZhbHVlIGlzIFZhbHVlUHJvdmlkZXIge1xuICByZXR1cm4gdmFsdWUgIT09IG51bGwgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnICYmIFVTRV9WQUxVRSBpbiB2YWx1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRXhpc3RpbmdQcm92aWRlcih2YWx1ZTogU2luZ2xlUHJvdmlkZXIpOiB2YWx1ZSBpcyBFeGlzdGluZ1Byb3ZpZGVyIHtcbiAgcmV0dXJuICEhKHZhbHVlICYmICh2YWx1ZSBhcyBFeGlzdGluZ1Byb3ZpZGVyKS51c2VFeGlzdGluZyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0ZhY3RvcnlQcm92aWRlcih2YWx1ZTogU2luZ2xlUHJvdmlkZXIpOiB2YWx1ZSBpcyBGYWN0b3J5UHJvdmlkZXIge1xuICByZXR1cm4gISEodmFsdWUgJiYgKHZhbHVlIGFzIEZhY3RvcnlQcm92aWRlcikudXNlRmFjdG9yeSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1R5cGVQcm92aWRlcih2YWx1ZTogU2luZ2xlUHJvdmlkZXIpOiB2YWx1ZSBpcyBUeXBlUHJvdmlkZXIge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNDbGFzc1Byb3ZpZGVyKHZhbHVlOiBTaW5nbGVQcm92aWRlcik6IHZhbHVlIGlzIENsYXNzUHJvdmlkZXIge1xuICByZXR1cm4gISEodmFsdWUgYXMgU3RhdGljQ2xhc3NQcm92aWRlciB8IENsYXNzUHJvdmlkZXIpLnVzZUNsYXNzO1xufVxuIl19