/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { resolveForwardRef } from '../../di';
import { RuntimeError } from '../../errors';
import { flatten } from '../../util/array_utils';
import { getComponentDef, getNgModuleDef, isStandalone } from '../definition';
import { isComponent, isDirective, isNgModule, isPipe, verifyStandaloneImport } from '../jit/util';
import { maybeUnwrapFn } from '../util/misc_utils';
/**
 * Indicates whether to use the runtime dependency tracker for scope calculation in JIT compilation.
 * The value "false" means the old code path based on patching scope info into the types will be
 * used.
 *
 * @deprecated For migration purposes only, to be removed soon.
 */
export const USE_RUNTIME_DEPS_TRACKER_FOR_JIT = true;
/**
 * An implementation of DepsTrackerApi which will be used for JIT and local compilation.
 */
class DepsTracker {
    constructor() {
        this.ownerNgModule = new Map();
        this.ngModulesWithSomeUnresolvedDecls = new Set();
        this.ngModulesScopeCache = new Map();
        this.standaloneComponentsScopeCache = new Map();
    }
    /**
     * Attempts to resolve ng module's forward ref declarations as much as possible and add them to
     * the `ownerNgModule` map. This method normally should be called after the initial parsing when
     * all the forward refs are resolved (e.g., when trying to render a component)
     */
    resolveNgModulesDecls() {
        if (this.ngModulesWithSomeUnresolvedDecls.size === 0) {
            return;
        }
        for (const moduleType of this.ngModulesWithSomeUnresolvedDecls) {
            const def = getNgModuleDef(moduleType);
            if (def?.declarations) {
                for (const decl of maybeUnwrapFn(def.declarations)) {
                    if (isComponent(decl)) {
                        this.ownerNgModule.set(decl, moduleType);
                    }
                }
            }
        }
        this.ngModulesWithSomeUnresolvedDecls.clear();
    }
    /** @override */
    getComponentDependencies(type, rawImports) {
        this.resolveNgModulesDecls();
        const def = getComponentDef(type);
        if (def === null) {
            throw new Error(`Attempting to get component dependencies for a type that is not a component: ${type}`);
        }
        if (def.standalone) {
            const scope = this.getStandaloneComponentScope(type, rawImports);
            if (scope.compilation.isPoisoned) {
                return { dependencies: [] };
            }
            return {
                dependencies: [
                    ...scope.compilation.directives,
                    ...scope.compilation.pipes,
                    ...scope.compilation.ngModules,
                ],
            };
        }
        else {
            if (!this.ownerNgModule.has(type)) {
                // This component is orphan! No need to handle the error since the component rendering
                // pipeline (e.g., view_container_ref) will check for this error based on configs.
                return { dependencies: [] };
            }
            const scope = this.getNgModuleScope(this.ownerNgModule.get(type));
            if (scope.compilation.isPoisoned) {
                return { dependencies: [] };
            }
            return {
                dependencies: [...scope.compilation.directives, ...scope.compilation.pipes],
            };
        }
    }
    /**
     * @override
     * This implementation does not make use of param scopeInfo since it assumes the scope info is
     * already added to the type itself through methods like {@link ɵɵsetNgModuleScope}
     */
    registerNgModule(type, scopeInfo) {
        if (!isNgModule(type)) {
            throw new Error(`Attempting to register a Type which is not NgModule as NgModule: ${type}`);
        }
        // Lazily process the NgModules later when needed.
        this.ngModulesWithSomeUnresolvedDecls.add(type);
    }
    /** @override */
    clearScopeCacheFor(type) {
        this.ngModulesScopeCache.delete(type);
        this.standaloneComponentsScopeCache.delete(type);
    }
    /** @override */
    getNgModuleScope(type) {
        if (this.ngModulesScopeCache.has(type)) {
            return this.ngModulesScopeCache.get(type);
        }
        const scope = this.computeNgModuleScope(type);
        this.ngModulesScopeCache.set(type, scope);
        return scope;
    }
    /** Compute NgModule scope afresh. */
    computeNgModuleScope(type) {
        const def = getNgModuleDef(type, true);
        const scope = {
            exported: { directives: new Set(), pipes: new Set() },
            compilation: { directives: new Set(), pipes: new Set() },
        };
        // Analyzing imports
        for (const imported of maybeUnwrapFn(def.imports)) {
            if (isNgModule(imported)) {
                const importedScope = this.getNgModuleScope(imported);
                // When this module imports another, the imported module's exported directives and pipes
                // are added to the compilation scope of this module.
                addSet(importedScope.exported.directives, scope.compilation.directives);
                addSet(importedScope.exported.pipes, scope.compilation.pipes);
            }
            else if (isStandalone(imported)) {
                if (isDirective(imported) || isComponent(imported)) {
                    scope.compilation.directives.add(imported);
                }
                else if (isPipe(imported)) {
                    scope.compilation.pipes.add(imported);
                }
                else {
                    // The standalone thing is neither a component nor a directive nor a pipe ... (what?)
                    throw new RuntimeError(1000 /* RuntimeErrorCode.RUNTIME_DEPS_INVALID_IMPORTED_TYPE */, 'The standalone imported type is neither a component nor a directive nor a pipe');
                }
            }
            else {
                // The import is neither a module nor a module-with-providers nor a standalone thing. This
                // is going to be an error. So we short circuit.
                scope.compilation.isPoisoned = true;
                break;
            }
        }
        // Analyzing declarations
        if (!scope.compilation.isPoisoned) {
            for (const decl of maybeUnwrapFn(def.declarations)) {
                // Cannot declare another NgModule or a standalone thing
                if (isNgModule(decl) || isStandalone(decl)) {
                    scope.compilation.isPoisoned = true;
                    break;
                }
                if (isPipe(decl)) {
                    scope.compilation.pipes.add(decl);
                }
                else {
                    // decl is either a directive or a component. The component may not yet have the ɵcmp due
                    // to async compilation.
                    scope.compilation.directives.add(decl);
                }
            }
        }
        // Analyzing exports
        for (const exported of maybeUnwrapFn(def.exports)) {
            if (isNgModule(exported)) {
                // When this module exports another, the exported module's exported directives and pipes
                // are added to both the compilation and exported scopes of this module.
                const exportedScope = this.getNgModuleScope(exported);
                // Based on the current logic there is no way to have poisoned exported scope. So no need to
                // check for it.
                addSet(exportedScope.exported.directives, scope.exported.directives);
                addSet(exportedScope.exported.pipes, scope.exported.pipes);
                // Some test toolings which run in JIT mode depend on this behavior that the exported scope
                // should also be present in the compilation scope, even though AoT does not support this
                // and it is also in odds with NgModule metadata definitions. Without this some tests in
                // Google will fail.
                addSet(exportedScope.exported.directives, scope.compilation.directives);
                addSet(exportedScope.exported.pipes, scope.compilation.pipes);
            }
            else if (isPipe(exported)) {
                scope.exported.pipes.add(exported);
            }
            else {
                scope.exported.directives.add(exported);
            }
        }
        return scope;
    }
    /** @override */
    getStandaloneComponentScope(type, rawImports) {
        if (this.standaloneComponentsScopeCache.has(type)) {
            return this.standaloneComponentsScopeCache.get(type);
        }
        const ans = this.computeStandaloneComponentScope(type, rawImports);
        this.standaloneComponentsScopeCache.set(type, ans);
        return ans;
    }
    computeStandaloneComponentScope(type, rawImports) {
        const ans = {
            compilation: {
                // Standalone components are always able to self-reference.
                directives: new Set([type]),
                pipes: new Set(),
                ngModules: new Set(),
            },
        };
        for (const rawImport of flatten(rawImports ?? [])) {
            const imported = resolveForwardRef(rawImport);
            try {
                verifyStandaloneImport(imported, type);
            }
            catch (e) {
                // Short-circuit if an import is not valid
                ans.compilation.isPoisoned = true;
                return ans;
            }
            if (isNgModule(imported)) {
                ans.compilation.ngModules.add(imported);
                const importedScope = this.getNgModuleScope(imported);
                // Short-circuit if an imported NgModule has corrupted exported scope.
                if (importedScope.exported.isPoisoned) {
                    ans.compilation.isPoisoned = true;
                    return ans;
                }
                addSet(importedScope.exported.directives, ans.compilation.directives);
                addSet(importedScope.exported.pipes, ans.compilation.pipes);
            }
            else if (isPipe(imported)) {
                ans.compilation.pipes.add(imported);
            }
            else if (isDirective(imported) || isComponent(imported)) {
                ans.compilation.directives.add(imported);
            }
            else {
                // The imported thing is not module/pipe/directive/component, so we error and short-circuit
                // here
                ans.compilation.isPoisoned = true;
                return ans;
            }
        }
        return ans;
    }
    /** @override */
    isOrphanComponent(cmp) {
        const def = getComponentDef(cmp);
        if (!def || def.standalone) {
            return false;
        }
        this.resolveNgModulesDecls();
        return !this.ownerNgModule.has(cmp);
    }
}
function addSet(sourceSet, targetSet) {
    for (const m of sourceSet) {
        targetSet.add(m);
    }
}
/** The deps tracker to be used in the current Angular app in dev mode. */
export const depsTracker = new DepsTracker();
export const TEST_ONLY = { DepsTracker };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwc190cmFja2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9kZXBzX3RyYWNrZXIvZGVwc190cmFja2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLFVBQVUsQ0FBQztBQUMzQyxPQUFPLEVBQUMsWUFBWSxFQUFtQixNQUFNLGNBQWMsQ0FBQztBQUc1RCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLGVBQWUsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBTTVFLE9BQU8sRUFBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsc0JBQXNCLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDakcsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBU2pEOzs7Ozs7R0FNRztBQUNILE1BQU0sQ0FBQyxNQUFNLGdDQUFnQyxHQUFHLElBQUksQ0FBQztBQUVyRDs7R0FFRztBQUNILE1BQU0sV0FBVztJQUFqQjtRQUNVLGtCQUFhLEdBQUcsSUFBSSxHQUFHLEVBQXlDLENBQUM7UUFDakUscUNBQWdDLEdBQUcsSUFBSSxHQUFHLEVBQXFCLENBQUM7UUFDaEUsd0JBQW1CLEdBQUcsSUFBSSxHQUFHLEVBQW9DLENBQUM7UUFDbEUsbUNBQThCLEdBQUcsSUFBSSxHQUFHLEVBQWdELENBQUM7SUEyUW5HLENBQUM7SUF6UUM7Ozs7T0FJRztJQUNLLHFCQUFxQjtRQUMzQixJQUFJLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDckQsT0FBTztRQUNULENBQUM7UUFFRCxLQUFLLE1BQU0sVUFBVSxJQUFJLElBQUksQ0FBQyxnQ0FBZ0MsRUFBRSxDQUFDO1lBQy9ELE1BQU0sR0FBRyxHQUFHLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUN2QyxJQUFJLEdBQUcsRUFBRSxZQUFZLEVBQUUsQ0FBQztnQkFDdEIsS0FBSyxNQUFNLElBQUksSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7b0JBQ25ELElBQUksV0FBVyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7d0JBQ3RCLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztvQkFDM0MsQ0FBQztnQkFDSCxDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7UUFFRCxJQUFJLENBQUMsZ0NBQWdDLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDaEQsQ0FBQztJQUVELGdCQUFnQjtJQUNoQix3QkFBd0IsQ0FDdEIsSUFBd0IsRUFDeEIsVUFBd0M7UUFFeEMsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFFN0IsTUFBTSxHQUFHLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xDLElBQUksR0FBRyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ2pCLE1BQU0sSUFBSSxLQUFLLENBQ2IsZ0ZBQWdGLElBQUksRUFBRSxDQUN2RixDQUFDO1FBQ0osQ0FBQztRQUVELElBQUksR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ25CLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFFakUsSUFBSSxLQUFLLENBQUMsV0FBVyxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUNqQyxPQUFPLEVBQUMsWUFBWSxFQUFFLEVBQUUsRUFBQyxDQUFDO1lBQzVCLENBQUM7WUFFRCxPQUFPO2dCQUNMLFlBQVksRUFBRTtvQkFDWixHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUMsVUFBVTtvQkFDL0IsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDLEtBQUs7b0JBQzFCLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQyxTQUFTO2lCQUMvQjthQUNGLENBQUM7UUFDSixDQUFDO2FBQU0sQ0FBQztZQUNOLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUNsQyxzRkFBc0Y7Z0JBQ3RGLGtGQUFrRjtnQkFDbEYsT0FBTyxFQUFDLFlBQVksRUFBRSxFQUFFLEVBQUMsQ0FBQztZQUM1QixDQUFDO1lBRUQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBRSxDQUFDLENBQUM7WUFFbkUsSUFBSSxLQUFLLENBQUMsV0FBVyxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUNqQyxPQUFPLEVBQUMsWUFBWSxFQUFFLEVBQUUsRUFBQyxDQUFDO1lBQzVCLENBQUM7WUFFRCxPQUFPO2dCQUNMLFlBQVksRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQyxVQUFVLEVBQUUsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQzthQUM1RSxDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsZ0JBQWdCLENBQUMsSUFBZSxFQUFFLFNBQXlDO1FBQ3pFLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUN0QixNQUFNLElBQUksS0FBSyxDQUFDLG9FQUFvRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQzlGLENBQUM7UUFFRCxrREFBa0Q7UUFDbEQsSUFBSSxDQUFDLGdDQUFnQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNsRCxDQUFDO0lBRUQsZ0JBQWdCO0lBQ2hCLGtCQUFrQixDQUFDLElBQWU7UUFDaEMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxJQUFvQixDQUFDLENBQUM7UUFDdEQsSUFBSSxDQUFDLDhCQUE4QixDQUFDLE1BQU0sQ0FBQyxJQUEwQixDQUFDLENBQUM7SUFDekUsQ0FBQztJQUVELGdCQUFnQjtJQUNoQixnQkFBZ0IsQ0FBQyxJQUF1QjtRQUN0QyxJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUN2QyxPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFFLENBQUM7UUFDN0MsQ0FBQztRQUVELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM5QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUUxQyxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFRCxxQ0FBcUM7SUFDN0Isb0JBQW9CLENBQUMsSUFBdUI7UUFDbEQsTUFBTSxHQUFHLEdBQUcsY0FBYyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN2QyxNQUFNLEtBQUssR0FBa0I7WUFDM0IsUUFBUSxFQUFFLEVBQUMsVUFBVSxFQUFFLElBQUksR0FBRyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksR0FBRyxFQUFFLEVBQUM7WUFDbkQsV0FBVyxFQUFFLEVBQUMsVUFBVSxFQUFFLElBQUksR0FBRyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksR0FBRyxFQUFFLEVBQUM7U0FDdkQsQ0FBQztRQUVGLG9CQUFvQjtRQUNwQixLQUFLLE1BQU0sUUFBUSxJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNsRCxJQUFJLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO2dCQUN6QixNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBRXRELHdGQUF3RjtnQkFDeEYscURBQXFEO2dCQUNyRCxNQUFNLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDeEUsTUFBTSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDaEUsQ0FBQztpQkFBTSxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO2dCQUNsQyxJQUFJLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxXQUFXLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztvQkFDbkQsS0FBSyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUM3QyxDQUFDO3FCQUFNLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7b0JBQzVCLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDeEMsQ0FBQztxQkFBTSxDQUFDO29CQUNOLHFGQUFxRjtvQkFDckYsTUFBTSxJQUFJLFlBQVksaUVBRXBCLGdGQUFnRixDQUNqRixDQUFDO2dCQUNKLENBQUM7WUFDSCxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sMEZBQTBGO2dCQUMxRixnREFBZ0Q7Z0JBQ2hELEtBQUssQ0FBQyxXQUFXLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztnQkFDcEMsTUFBTTtZQUNSLENBQUM7UUFDSCxDQUFDO1FBRUQseUJBQXlCO1FBQ3pCLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2xDLEtBQUssTUFBTSxJQUFJLElBQUksYUFBYSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO2dCQUNuRCx3REFBd0Q7Z0JBQ3hELElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO29CQUMzQyxLQUFLLENBQUMsV0FBVyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7b0JBQ3BDLE1BQU07Z0JBQ1IsQ0FBQztnQkFFRCxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO29CQUNqQixLQUFLLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3BDLENBQUM7cUJBQU0sQ0FBQztvQkFDTix5RkFBeUY7b0JBQ3pGLHdCQUF3QjtvQkFDeEIsS0FBSyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN6QyxDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7UUFFRCxvQkFBb0I7UUFDcEIsS0FBSyxNQUFNLFFBQVEsSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDbEQsSUFBSSxVQUFVLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztnQkFDekIsd0ZBQXdGO2dCQUN4Rix3RUFBd0U7Z0JBQ3hFLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFFdEQsNEZBQTRGO2dCQUM1RixnQkFBZ0I7Z0JBQ2hCLE1BQU0sQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUNyRSxNQUFNLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFFM0QsMkZBQTJGO2dCQUMzRix5RkFBeUY7Z0JBQ3pGLHdGQUF3RjtnQkFDeEYsb0JBQW9CO2dCQUNwQixNQUFNLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDeEUsTUFBTSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDaEUsQ0FBQztpQkFBTSxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO2dCQUM1QixLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDckMsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLEtBQUssQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMxQyxDQUFDO1FBQ0gsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVELGdCQUFnQjtJQUNoQiwyQkFBMkIsQ0FDekIsSUFBd0IsRUFDeEIsVUFBd0M7UUFFeEMsSUFBSSxJQUFJLENBQUMsOEJBQThCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDbEQsT0FBTyxJQUFJLENBQUMsOEJBQThCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBRSxDQUFDO1FBQ3hELENBQUM7UUFFRCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsK0JBQStCLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ25FLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRW5ELE9BQU8sR0FBRyxDQUFDO0lBQ2IsQ0FBQztJQUVPLCtCQUErQixDQUNyQyxJQUF3QixFQUN4QixVQUF3QztRQUV4QyxNQUFNLEdBQUcsR0FBNkI7WUFDcEMsV0FBVyxFQUFFO2dCQUNYLDJEQUEyRDtnQkFDM0QsVUFBVSxFQUFFLElBQUksR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzNCLEtBQUssRUFBRSxJQUFJLEdBQUcsRUFBRTtnQkFDaEIsU0FBUyxFQUFFLElBQUksR0FBRyxFQUFFO2FBQ3JCO1NBQ0YsQ0FBQztRQUVGLEtBQUssTUFBTSxTQUFTLElBQUksT0FBTyxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQ2xELE1BQU0sUUFBUSxHQUFHLGlCQUFpQixDQUFDLFNBQVMsQ0FBYyxDQUFDO1lBRTNELElBQUksQ0FBQztnQkFDSCxzQkFBc0IsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDekMsQ0FBQztZQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQ1gsMENBQTBDO2dCQUMxQyxHQUFHLENBQUMsV0FBVyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7Z0JBQ2xDLE9BQU8sR0FBRyxDQUFDO1lBQ2IsQ0FBQztZQUVELElBQUksVUFBVSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7Z0JBQ3pCLEdBQUcsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDeEMsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUV0RCxzRUFBc0U7Z0JBQ3RFLElBQUksYUFBYSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsQ0FBQztvQkFDdEMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO29CQUNsQyxPQUFPLEdBQUcsQ0FBQztnQkFDYixDQUFDO2dCQUVELE1BQU0sQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUN0RSxNQUFNLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM5RCxDQUFDO2lCQUFNLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7Z0JBQzVCLEdBQUcsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN0QyxDQUFDO2lCQUFNLElBQUksV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO2dCQUMxRCxHQUFHLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDM0MsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLDJGQUEyRjtnQkFDM0YsT0FBTztnQkFDUCxHQUFHLENBQUMsV0FBVyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7Z0JBQ2xDLE9BQU8sR0FBRyxDQUFDO1lBQ2IsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUM7SUFFRCxnQkFBZ0I7SUFDaEIsaUJBQWlCLENBQUMsR0FBYztRQUM5QixNQUFNLEdBQUcsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFakMsSUFBSSxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDM0IsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO1FBRUQsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFFN0IsT0FBTyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLEdBQXlCLENBQUMsQ0FBQztJQUM1RCxDQUFDO0NBQ0Y7QUFFRCxTQUFTLE1BQU0sQ0FBSSxTQUFpQixFQUFFLFNBQWlCO0lBQ3JELEtBQUssTUFBTSxDQUFDLElBQUksU0FBUyxFQUFFLENBQUM7UUFDMUIsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNuQixDQUFDO0FBQ0gsQ0FBQztBQUVELDBFQUEwRTtBQUMxRSxNQUFNLENBQUMsTUFBTSxXQUFXLEdBQUcsSUFBSSxXQUFXLEVBQUUsQ0FBQztBQUU3QyxNQUFNLENBQUMsTUFBTSxTQUFTLEdBQUcsRUFBQyxXQUFXLEVBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge3Jlc29sdmVGb3J3YXJkUmVmfSBmcm9tICcuLi8uLi9kaSc7XG5pbXBvcnQge1J1bnRpbWVFcnJvciwgUnVudGltZUVycm9yQ29kZX0gZnJvbSAnLi4vLi4vZXJyb3JzJztcbmltcG9ydCB7VHlwZX0gZnJvbSAnLi4vLi4vaW50ZXJmYWNlL3R5cGUnO1xuaW1wb3J0IHtOZ01vZHVsZVR5cGV9IGZyb20gJy4uLy4uL21ldGFkYXRhL25nX21vZHVsZV9kZWYnO1xuaW1wb3J0IHtmbGF0dGVufSBmcm9tICcuLi8uLi91dGlsL2FycmF5X3V0aWxzJztcbmltcG9ydCB7Z2V0Q29tcG9uZW50RGVmLCBnZXROZ01vZHVsZURlZiwgaXNTdGFuZGFsb25lfSBmcm9tICcuLi9kZWZpbml0aW9uJztcbmltcG9ydCB7XG4gIENvbXBvbmVudFR5cGUsXG4gIE5nTW9kdWxlU2NvcGVJbmZvRnJvbURlY29yYXRvcixcbiAgUmF3U2NvcGVJbmZvRnJvbURlY29yYXRvcixcbn0gZnJvbSAnLi4vaW50ZXJmYWNlcy9kZWZpbml0aW9uJztcbmltcG9ydCB7aXNDb21wb25lbnQsIGlzRGlyZWN0aXZlLCBpc05nTW9kdWxlLCBpc1BpcGUsIHZlcmlmeVN0YW5kYWxvbmVJbXBvcnR9IGZyb20gJy4uL2ppdC91dGlsJztcbmltcG9ydCB7bWF5YmVVbndyYXBGbn0gZnJvbSAnLi4vdXRpbC9taXNjX3V0aWxzJztcblxuaW1wb3J0IHtcbiAgQ29tcG9uZW50RGVwZW5kZW5jaWVzLFxuICBEZXBzVHJhY2tlckFwaSxcbiAgTmdNb2R1bGVTY29wZSxcbiAgU3RhbmRhbG9uZUNvbXBvbmVudFNjb3BlLFxufSBmcm9tICcuL2FwaSc7XG5cbi8qKlxuICogSW5kaWNhdGVzIHdoZXRoZXIgdG8gdXNlIHRoZSBydW50aW1lIGRlcGVuZGVuY3kgdHJhY2tlciBmb3Igc2NvcGUgY2FsY3VsYXRpb24gaW4gSklUIGNvbXBpbGF0aW9uLlxuICogVGhlIHZhbHVlIFwiZmFsc2VcIiBtZWFucyB0aGUgb2xkIGNvZGUgcGF0aCBiYXNlZCBvbiBwYXRjaGluZyBzY29wZSBpbmZvIGludG8gdGhlIHR5cGVzIHdpbGwgYmVcbiAqIHVzZWQuXG4gKlxuICogQGRlcHJlY2F0ZWQgRm9yIG1pZ3JhdGlvbiBwdXJwb3NlcyBvbmx5LCB0byBiZSByZW1vdmVkIHNvb24uXG4gKi9cbmV4cG9ydCBjb25zdCBVU0VfUlVOVElNRV9ERVBTX1RSQUNLRVJfRk9SX0pJVCA9IHRydWU7XG5cbi8qKlxuICogQW4gaW1wbGVtZW50YXRpb24gb2YgRGVwc1RyYWNrZXJBcGkgd2hpY2ggd2lsbCBiZSB1c2VkIGZvciBKSVQgYW5kIGxvY2FsIGNvbXBpbGF0aW9uLlxuICovXG5jbGFzcyBEZXBzVHJhY2tlciBpbXBsZW1lbnRzIERlcHNUcmFja2VyQXBpIHtcbiAgcHJpdmF0ZSBvd25lck5nTW9kdWxlID0gbmV3IE1hcDxDb21wb25lbnRUeXBlPGFueT4sIE5nTW9kdWxlVHlwZTxhbnk+PigpO1xuICBwcml2YXRlIG5nTW9kdWxlc1dpdGhTb21lVW5yZXNvbHZlZERlY2xzID0gbmV3IFNldDxOZ01vZHVsZVR5cGU8YW55Pj4oKTtcbiAgcHJpdmF0ZSBuZ01vZHVsZXNTY29wZUNhY2hlID0gbmV3IE1hcDxOZ01vZHVsZVR5cGU8YW55PiwgTmdNb2R1bGVTY29wZT4oKTtcbiAgcHJpdmF0ZSBzdGFuZGFsb25lQ29tcG9uZW50c1Njb3BlQ2FjaGUgPSBuZXcgTWFwPENvbXBvbmVudFR5cGU8YW55PiwgU3RhbmRhbG9uZUNvbXBvbmVudFNjb3BlPigpO1xuXG4gIC8qKlxuICAgKiBBdHRlbXB0cyB0byByZXNvbHZlIG5nIG1vZHVsZSdzIGZvcndhcmQgcmVmIGRlY2xhcmF0aW9ucyBhcyBtdWNoIGFzIHBvc3NpYmxlIGFuZCBhZGQgdGhlbSB0b1xuICAgKiB0aGUgYG93bmVyTmdNb2R1bGVgIG1hcC4gVGhpcyBtZXRob2Qgbm9ybWFsbHkgc2hvdWxkIGJlIGNhbGxlZCBhZnRlciB0aGUgaW5pdGlhbCBwYXJzaW5nIHdoZW5cbiAgICogYWxsIHRoZSBmb3J3YXJkIHJlZnMgYXJlIHJlc29sdmVkIChlLmcuLCB3aGVuIHRyeWluZyB0byByZW5kZXIgYSBjb21wb25lbnQpXG4gICAqL1xuICBwcml2YXRlIHJlc29sdmVOZ01vZHVsZXNEZWNscygpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5uZ01vZHVsZXNXaXRoU29tZVVucmVzb2x2ZWREZWNscy5zaXplID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBtb2R1bGVUeXBlIG9mIHRoaXMubmdNb2R1bGVzV2l0aFNvbWVVbnJlc29sdmVkRGVjbHMpIHtcbiAgICAgIGNvbnN0IGRlZiA9IGdldE5nTW9kdWxlRGVmKG1vZHVsZVR5cGUpO1xuICAgICAgaWYgKGRlZj8uZGVjbGFyYXRpb25zKSB7XG4gICAgICAgIGZvciAoY29uc3QgZGVjbCBvZiBtYXliZVVud3JhcEZuKGRlZi5kZWNsYXJhdGlvbnMpKSB7XG4gICAgICAgICAgaWYgKGlzQ29tcG9uZW50KGRlY2wpKSB7XG4gICAgICAgICAgICB0aGlzLm93bmVyTmdNb2R1bGUuc2V0KGRlY2wsIG1vZHVsZVR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMubmdNb2R1bGVzV2l0aFNvbWVVbnJlc29sdmVkRGVjbHMuY2xlYXIoKTtcbiAgfVxuXG4gIC8qKiBAb3ZlcnJpZGUgKi9cbiAgZ2V0Q29tcG9uZW50RGVwZW5kZW5jaWVzKFxuICAgIHR5cGU6IENvbXBvbmVudFR5cGU8YW55PixcbiAgICByYXdJbXBvcnRzPzogUmF3U2NvcGVJbmZvRnJvbURlY29yYXRvcltdLFxuICApOiBDb21wb25lbnREZXBlbmRlbmNpZXMge1xuICAgIHRoaXMucmVzb2x2ZU5nTW9kdWxlc0RlY2xzKCk7XG5cbiAgICBjb25zdCBkZWYgPSBnZXRDb21wb25lbnREZWYodHlwZSk7XG4gICAgaWYgKGRlZiA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQXR0ZW1wdGluZyB0byBnZXQgY29tcG9uZW50IGRlcGVuZGVuY2llcyBmb3IgYSB0eXBlIHRoYXQgaXMgbm90IGEgY29tcG9uZW50OiAke3R5cGV9YCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKGRlZi5zdGFuZGFsb25lKSB7XG4gICAgICBjb25zdCBzY29wZSA9IHRoaXMuZ2V0U3RhbmRhbG9uZUNvbXBvbmVudFNjb3BlKHR5cGUsIHJhd0ltcG9ydHMpO1xuXG4gICAgICBpZiAoc2NvcGUuY29tcGlsYXRpb24uaXNQb2lzb25lZCkge1xuICAgICAgICByZXR1cm4ge2RlcGVuZGVuY2llczogW119O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBkZXBlbmRlbmNpZXM6IFtcbiAgICAgICAgICAuLi5zY29wZS5jb21waWxhdGlvbi5kaXJlY3RpdmVzLFxuICAgICAgICAgIC4uLnNjb3BlLmNvbXBpbGF0aW9uLnBpcGVzLFxuICAgICAgICAgIC4uLnNjb3BlLmNvbXBpbGF0aW9uLm5nTW9kdWxlcyxcbiAgICAgICAgXSxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghdGhpcy5vd25lck5nTW9kdWxlLmhhcyh0eXBlKSkge1xuICAgICAgICAvLyBUaGlzIGNvbXBvbmVudCBpcyBvcnBoYW4hIE5vIG5lZWQgdG8gaGFuZGxlIHRoZSBlcnJvciBzaW5jZSB0aGUgY29tcG9uZW50IHJlbmRlcmluZ1xuICAgICAgICAvLyBwaXBlbGluZSAoZS5nLiwgdmlld19jb250YWluZXJfcmVmKSB3aWxsIGNoZWNrIGZvciB0aGlzIGVycm9yIGJhc2VkIG9uIGNvbmZpZ3MuXG4gICAgICAgIHJldHVybiB7ZGVwZW5kZW5jaWVzOiBbXX07XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNjb3BlID0gdGhpcy5nZXROZ01vZHVsZVNjb3BlKHRoaXMub3duZXJOZ01vZHVsZS5nZXQodHlwZSkhKTtcblxuICAgICAgaWYgKHNjb3BlLmNvbXBpbGF0aW9uLmlzUG9pc29uZWQpIHtcbiAgICAgICAgcmV0dXJuIHtkZXBlbmRlbmNpZXM6IFtdfTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZGVwZW5kZW5jaWVzOiBbLi4uc2NvcGUuY29tcGlsYXRpb24uZGlyZWN0aXZlcywgLi4uc2NvcGUuY29tcGlsYXRpb24ucGlwZXNdLFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQG92ZXJyaWRlXG4gICAqIFRoaXMgaW1wbGVtZW50YXRpb24gZG9lcyBub3QgbWFrZSB1c2Ugb2YgcGFyYW0gc2NvcGVJbmZvIHNpbmNlIGl0IGFzc3VtZXMgdGhlIHNjb3BlIGluZm8gaXNcbiAgICogYWxyZWFkeSBhZGRlZCB0byB0aGUgdHlwZSBpdHNlbGYgdGhyb3VnaCBtZXRob2RzIGxpa2Uge0BsaW5rIMm1ybVzZXROZ01vZHVsZVNjb3BlfVxuICAgKi9cbiAgcmVnaXN0ZXJOZ01vZHVsZSh0eXBlOiBUeXBlPGFueT4sIHNjb3BlSW5mbzogTmdNb2R1bGVTY29wZUluZm9Gcm9tRGVjb3JhdG9yKTogdm9pZCB7XG4gICAgaWYgKCFpc05nTW9kdWxlKHR5cGUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEF0dGVtcHRpbmcgdG8gcmVnaXN0ZXIgYSBUeXBlIHdoaWNoIGlzIG5vdCBOZ01vZHVsZSBhcyBOZ01vZHVsZTogJHt0eXBlfWApO1xuICAgIH1cblxuICAgIC8vIExhemlseSBwcm9jZXNzIHRoZSBOZ01vZHVsZXMgbGF0ZXIgd2hlbiBuZWVkZWQuXG4gICAgdGhpcy5uZ01vZHVsZXNXaXRoU29tZVVucmVzb2x2ZWREZWNscy5hZGQodHlwZSk7XG4gIH1cblxuICAvKiogQG92ZXJyaWRlICovXG4gIGNsZWFyU2NvcGVDYWNoZUZvcih0eXBlOiBUeXBlPGFueT4pOiB2b2lkIHtcbiAgICB0aGlzLm5nTW9kdWxlc1Njb3BlQ2FjaGUuZGVsZXRlKHR5cGUgYXMgTmdNb2R1bGVUeXBlKTtcbiAgICB0aGlzLnN0YW5kYWxvbmVDb21wb25lbnRzU2NvcGVDYWNoZS5kZWxldGUodHlwZSBhcyBDb21wb25lbnRUeXBlPGFueT4pO1xuICB9XG5cbiAgLyoqIEBvdmVycmlkZSAqL1xuICBnZXROZ01vZHVsZVNjb3BlKHR5cGU6IE5nTW9kdWxlVHlwZTxhbnk+KTogTmdNb2R1bGVTY29wZSB7XG4gICAgaWYgKHRoaXMubmdNb2R1bGVzU2NvcGVDYWNoZS5oYXModHlwZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLm5nTW9kdWxlc1Njb3BlQ2FjaGUuZ2V0KHR5cGUpITtcbiAgICB9XG5cbiAgICBjb25zdCBzY29wZSA9IHRoaXMuY29tcHV0ZU5nTW9kdWxlU2NvcGUodHlwZSk7XG4gICAgdGhpcy5uZ01vZHVsZXNTY29wZUNhY2hlLnNldCh0eXBlLCBzY29wZSk7XG5cbiAgICByZXR1cm4gc2NvcGU7XG4gIH1cblxuICAvKiogQ29tcHV0ZSBOZ01vZHVsZSBzY29wZSBhZnJlc2guICovXG4gIHByaXZhdGUgY29tcHV0ZU5nTW9kdWxlU2NvcGUodHlwZTogTmdNb2R1bGVUeXBlPGFueT4pOiBOZ01vZHVsZVNjb3BlIHtcbiAgICBjb25zdCBkZWYgPSBnZXROZ01vZHVsZURlZih0eXBlLCB0cnVlKTtcbiAgICBjb25zdCBzY29wZTogTmdNb2R1bGVTY29wZSA9IHtcbiAgICAgIGV4cG9ydGVkOiB7ZGlyZWN0aXZlczogbmV3IFNldCgpLCBwaXBlczogbmV3IFNldCgpfSxcbiAgICAgIGNvbXBpbGF0aW9uOiB7ZGlyZWN0aXZlczogbmV3IFNldCgpLCBwaXBlczogbmV3IFNldCgpfSxcbiAgICB9O1xuXG4gICAgLy8gQW5hbHl6aW5nIGltcG9ydHNcbiAgICBmb3IgKGNvbnN0IGltcG9ydGVkIG9mIG1heWJlVW53cmFwRm4oZGVmLmltcG9ydHMpKSB7XG4gICAgICBpZiAoaXNOZ01vZHVsZShpbXBvcnRlZCkpIHtcbiAgICAgICAgY29uc3QgaW1wb3J0ZWRTY29wZSA9IHRoaXMuZ2V0TmdNb2R1bGVTY29wZShpbXBvcnRlZCk7XG5cbiAgICAgICAgLy8gV2hlbiB0aGlzIG1vZHVsZSBpbXBvcnRzIGFub3RoZXIsIHRoZSBpbXBvcnRlZCBtb2R1bGUncyBleHBvcnRlZCBkaXJlY3RpdmVzIGFuZCBwaXBlc1xuICAgICAgICAvLyBhcmUgYWRkZWQgdG8gdGhlIGNvbXBpbGF0aW9uIHNjb3BlIG9mIHRoaXMgbW9kdWxlLlxuICAgICAgICBhZGRTZXQoaW1wb3J0ZWRTY29wZS5leHBvcnRlZC5kaXJlY3RpdmVzLCBzY29wZS5jb21waWxhdGlvbi5kaXJlY3RpdmVzKTtcbiAgICAgICAgYWRkU2V0KGltcG9ydGVkU2NvcGUuZXhwb3J0ZWQucGlwZXMsIHNjb3BlLmNvbXBpbGF0aW9uLnBpcGVzKTtcbiAgICAgIH0gZWxzZSBpZiAoaXNTdGFuZGFsb25lKGltcG9ydGVkKSkge1xuICAgICAgICBpZiAoaXNEaXJlY3RpdmUoaW1wb3J0ZWQpIHx8IGlzQ29tcG9uZW50KGltcG9ydGVkKSkge1xuICAgICAgICAgIHNjb3BlLmNvbXBpbGF0aW9uLmRpcmVjdGl2ZXMuYWRkKGltcG9ydGVkKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc1BpcGUoaW1wb3J0ZWQpKSB7XG4gICAgICAgICAgc2NvcGUuY29tcGlsYXRpb24ucGlwZXMuYWRkKGltcG9ydGVkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBUaGUgc3RhbmRhbG9uZSB0aGluZyBpcyBuZWl0aGVyIGEgY29tcG9uZW50IG5vciBhIGRpcmVjdGl2ZSBub3IgYSBwaXBlIC4uLiAod2hhdD8pXG4gICAgICAgICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgICAgIFJ1bnRpbWVFcnJvckNvZGUuUlVOVElNRV9ERVBTX0lOVkFMSURfSU1QT1JURURfVFlQRSxcbiAgICAgICAgICAgICdUaGUgc3RhbmRhbG9uZSBpbXBvcnRlZCB0eXBlIGlzIG5laXRoZXIgYSBjb21wb25lbnQgbm9yIGEgZGlyZWN0aXZlIG5vciBhIHBpcGUnLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoZSBpbXBvcnQgaXMgbmVpdGhlciBhIG1vZHVsZSBub3IgYSBtb2R1bGUtd2l0aC1wcm92aWRlcnMgbm9yIGEgc3RhbmRhbG9uZSB0aGluZy4gVGhpc1xuICAgICAgICAvLyBpcyBnb2luZyB0byBiZSBhbiBlcnJvci4gU28gd2Ugc2hvcnQgY2lyY3VpdC5cbiAgICAgICAgc2NvcGUuY29tcGlsYXRpb24uaXNQb2lzb25lZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFuYWx5emluZyBkZWNsYXJhdGlvbnNcbiAgICBpZiAoIXNjb3BlLmNvbXBpbGF0aW9uLmlzUG9pc29uZWQpIHtcbiAgICAgIGZvciAoY29uc3QgZGVjbCBvZiBtYXliZVVud3JhcEZuKGRlZi5kZWNsYXJhdGlvbnMpKSB7XG4gICAgICAgIC8vIENhbm5vdCBkZWNsYXJlIGFub3RoZXIgTmdNb2R1bGUgb3IgYSBzdGFuZGFsb25lIHRoaW5nXG4gICAgICAgIGlmIChpc05nTW9kdWxlKGRlY2wpIHx8IGlzU3RhbmRhbG9uZShkZWNsKSkge1xuICAgICAgICAgIHNjb3BlLmNvbXBpbGF0aW9uLmlzUG9pc29uZWQgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzUGlwZShkZWNsKSkge1xuICAgICAgICAgIHNjb3BlLmNvbXBpbGF0aW9uLnBpcGVzLmFkZChkZWNsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBkZWNsIGlzIGVpdGhlciBhIGRpcmVjdGl2ZSBvciBhIGNvbXBvbmVudC4gVGhlIGNvbXBvbmVudCBtYXkgbm90IHlldCBoYXZlIHRoZSDJtWNtcCBkdWVcbiAgICAgICAgICAvLyB0byBhc3luYyBjb21waWxhdGlvbi5cbiAgICAgICAgICBzY29wZS5jb21waWxhdGlvbi5kaXJlY3RpdmVzLmFkZChkZWNsKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFuYWx5emluZyBleHBvcnRzXG4gICAgZm9yIChjb25zdCBleHBvcnRlZCBvZiBtYXliZVVud3JhcEZuKGRlZi5leHBvcnRzKSkge1xuICAgICAgaWYgKGlzTmdNb2R1bGUoZXhwb3J0ZWQpKSB7XG4gICAgICAgIC8vIFdoZW4gdGhpcyBtb2R1bGUgZXhwb3J0cyBhbm90aGVyLCB0aGUgZXhwb3J0ZWQgbW9kdWxlJ3MgZXhwb3J0ZWQgZGlyZWN0aXZlcyBhbmQgcGlwZXNcbiAgICAgICAgLy8gYXJlIGFkZGVkIHRvIGJvdGggdGhlIGNvbXBpbGF0aW9uIGFuZCBleHBvcnRlZCBzY29wZXMgb2YgdGhpcyBtb2R1bGUuXG4gICAgICAgIGNvbnN0IGV4cG9ydGVkU2NvcGUgPSB0aGlzLmdldE5nTW9kdWxlU2NvcGUoZXhwb3J0ZWQpO1xuXG4gICAgICAgIC8vIEJhc2VkIG9uIHRoZSBjdXJyZW50IGxvZ2ljIHRoZXJlIGlzIG5vIHdheSB0byBoYXZlIHBvaXNvbmVkIGV4cG9ydGVkIHNjb3BlLiBTbyBubyBuZWVkIHRvXG4gICAgICAgIC8vIGNoZWNrIGZvciBpdC5cbiAgICAgICAgYWRkU2V0KGV4cG9ydGVkU2NvcGUuZXhwb3J0ZWQuZGlyZWN0aXZlcywgc2NvcGUuZXhwb3J0ZWQuZGlyZWN0aXZlcyk7XG4gICAgICAgIGFkZFNldChleHBvcnRlZFNjb3BlLmV4cG9ydGVkLnBpcGVzLCBzY29wZS5leHBvcnRlZC5waXBlcyk7XG5cbiAgICAgICAgLy8gU29tZSB0ZXN0IHRvb2xpbmdzIHdoaWNoIHJ1biBpbiBKSVQgbW9kZSBkZXBlbmQgb24gdGhpcyBiZWhhdmlvciB0aGF0IHRoZSBleHBvcnRlZCBzY29wZVxuICAgICAgICAvLyBzaG91bGQgYWxzbyBiZSBwcmVzZW50IGluIHRoZSBjb21waWxhdGlvbiBzY29wZSwgZXZlbiB0aG91Z2ggQW9UIGRvZXMgbm90IHN1cHBvcnQgdGhpc1xuICAgICAgICAvLyBhbmQgaXQgaXMgYWxzbyBpbiBvZGRzIHdpdGggTmdNb2R1bGUgbWV0YWRhdGEgZGVmaW5pdGlvbnMuIFdpdGhvdXQgdGhpcyBzb21lIHRlc3RzIGluXG4gICAgICAgIC8vIEdvb2dsZSB3aWxsIGZhaWwuXG4gICAgICAgIGFkZFNldChleHBvcnRlZFNjb3BlLmV4cG9ydGVkLmRpcmVjdGl2ZXMsIHNjb3BlLmNvbXBpbGF0aW9uLmRpcmVjdGl2ZXMpO1xuICAgICAgICBhZGRTZXQoZXhwb3J0ZWRTY29wZS5leHBvcnRlZC5waXBlcywgc2NvcGUuY29tcGlsYXRpb24ucGlwZXMpO1xuICAgICAgfSBlbHNlIGlmIChpc1BpcGUoZXhwb3J0ZWQpKSB7XG4gICAgICAgIHNjb3BlLmV4cG9ydGVkLnBpcGVzLmFkZChleHBvcnRlZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzY29wZS5leHBvcnRlZC5kaXJlY3RpdmVzLmFkZChleHBvcnRlZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNjb3BlO1xuICB9XG5cbiAgLyoqIEBvdmVycmlkZSAqL1xuICBnZXRTdGFuZGFsb25lQ29tcG9uZW50U2NvcGUoXG4gICAgdHlwZTogQ29tcG9uZW50VHlwZTxhbnk+LFxuICAgIHJhd0ltcG9ydHM/OiBSYXdTY29wZUluZm9Gcm9tRGVjb3JhdG9yW10sXG4gICk6IFN0YW5kYWxvbmVDb21wb25lbnRTY29wZSB7XG4gICAgaWYgKHRoaXMuc3RhbmRhbG9uZUNvbXBvbmVudHNTY29wZUNhY2hlLmhhcyh0eXBlKSkge1xuICAgICAgcmV0dXJuIHRoaXMuc3RhbmRhbG9uZUNvbXBvbmVudHNTY29wZUNhY2hlLmdldCh0eXBlKSE7XG4gICAgfVxuXG4gICAgY29uc3QgYW5zID0gdGhpcy5jb21wdXRlU3RhbmRhbG9uZUNvbXBvbmVudFNjb3BlKHR5cGUsIHJhd0ltcG9ydHMpO1xuICAgIHRoaXMuc3RhbmRhbG9uZUNvbXBvbmVudHNTY29wZUNhY2hlLnNldCh0eXBlLCBhbnMpO1xuXG4gICAgcmV0dXJuIGFucztcbiAgfVxuXG4gIHByaXZhdGUgY29tcHV0ZVN0YW5kYWxvbmVDb21wb25lbnRTY29wZShcbiAgICB0eXBlOiBDb21wb25lbnRUeXBlPGFueT4sXG4gICAgcmF3SW1wb3J0cz86IFJhd1Njb3BlSW5mb0Zyb21EZWNvcmF0b3JbXSxcbiAgKTogU3RhbmRhbG9uZUNvbXBvbmVudFNjb3BlIHtcbiAgICBjb25zdCBhbnM6IFN0YW5kYWxvbmVDb21wb25lbnRTY29wZSA9IHtcbiAgICAgIGNvbXBpbGF0aW9uOiB7XG4gICAgICAgIC8vIFN0YW5kYWxvbmUgY29tcG9uZW50cyBhcmUgYWx3YXlzIGFibGUgdG8gc2VsZi1yZWZlcmVuY2UuXG4gICAgICAgIGRpcmVjdGl2ZXM6IG5ldyBTZXQoW3R5cGVdKSxcbiAgICAgICAgcGlwZXM6IG5ldyBTZXQoKSxcbiAgICAgICAgbmdNb2R1bGVzOiBuZXcgU2V0KCksXG4gICAgICB9LFxuICAgIH07XG5cbiAgICBmb3IgKGNvbnN0IHJhd0ltcG9ydCBvZiBmbGF0dGVuKHJhd0ltcG9ydHMgPz8gW10pKSB7XG4gICAgICBjb25zdCBpbXBvcnRlZCA9IHJlc29sdmVGb3J3YXJkUmVmKHJhd0ltcG9ydCkgYXMgVHlwZTxhbnk+O1xuXG4gICAgICB0cnkge1xuICAgICAgICB2ZXJpZnlTdGFuZGFsb25lSW1wb3J0KGltcG9ydGVkLCB0eXBlKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gU2hvcnQtY2lyY3VpdCBpZiBhbiBpbXBvcnQgaXMgbm90IHZhbGlkXG4gICAgICAgIGFucy5jb21waWxhdGlvbi5pc1BvaXNvbmVkID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGFucztcbiAgICAgIH1cblxuICAgICAgaWYgKGlzTmdNb2R1bGUoaW1wb3J0ZWQpKSB7XG4gICAgICAgIGFucy5jb21waWxhdGlvbi5uZ01vZHVsZXMuYWRkKGltcG9ydGVkKTtcbiAgICAgICAgY29uc3QgaW1wb3J0ZWRTY29wZSA9IHRoaXMuZ2V0TmdNb2R1bGVTY29wZShpbXBvcnRlZCk7XG5cbiAgICAgICAgLy8gU2hvcnQtY2lyY3VpdCBpZiBhbiBpbXBvcnRlZCBOZ01vZHVsZSBoYXMgY29ycnVwdGVkIGV4cG9ydGVkIHNjb3BlLlxuICAgICAgICBpZiAoaW1wb3J0ZWRTY29wZS5leHBvcnRlZC5pc1BvaXNvbmVkKSB7XG4gICAgICAgICAgYW5zLmNvbXBpbGF0aW9uLmlzUG9pc29uZWQgPSB0cnVlO1xuICAgICAgICAgIHJldHVybiBhbnM7XG4gICAgICAgIH1cblxuICAgICAgICBhZGRTZXQoaW1wb3J0ZWRTY29wZS5leHBvcnRlZC5kaXJlY3RpdmVzLCBhbnMuY29tcGlsYXRpb24uZGlyZWN0aXZlcyk7XG4gICAgICAgIGFkZFNldChpbXBvcnRlZFNjb3BlLmV4cG9ydGVkLnBpcGVzLCBhbnMuY29tcGlsYXRpb24ucGlwZXMpO1xuICAgICAgfSBlbHNlIGlmIChpc1BpcGUoaW1wb3J0ZWQpKSB7XG4gICAgICAgIGFucy5jb21waWxhdGlvbi5waXBlcy5hZGQoaW1wb3J0ZWQpO1xuICAgICAgfSBlbHNlIGlmIChpc0RpcmVjdGl2ZShpbXBvcnRlZCkgfHwgaXNDb21wb25lbnQoaW1wb3J0ZWQpKSB7XG4gICAgICAgIGFucy5jb21waWxhdGlvbi5kaXJlY3RpdmVzLmFkZChpbXBvcnRlZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGUgaW1wb3J0ZWQgdGhpbmcgaXMgbm90IG1vZHVsZS9waXBlL2RpcmVjdGl2ZS9jb21wb25lbnQsIHNvIHdlIGVycm9yIGFuZCBzaG9ydC1jaXJjdWl0XG4gICAgICAgIC8vIGhlcmVcbiAgICAgICAgYW5zLmNvbXBpbGF0aW9uLmlzUG9pc29uZWQgPSB0cnVlO1xuICAgICAgICByZXR1cm4gYW5zO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBhbnM7XG4gIH1cblxuICAvKiogQG92ZXJyaWRlICovXG4gIGlzT3JwaGFuQ29tcG9uZW50KGNtcDogVHlwZTxhbnk+KTogYm9vbGVhbiB7XG4gICAgY29uc3QgZGVmID0gZ2V0Q29tcG9uZW50RGVmKGNtcCk7XG5cbiAgICBpZiAoIWRlZiB8fCBkZWYuc3RhbmRhbG9uZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRoaXMucmVzb2x2ZU5nTW9kdWxlc0RlY2xzKCk7XG5cbiAgICByZXR1cm4gIXRoaXMub3duZXJOZ01vZHVsZS5oYXMoY21wIGFzIENvbXBvbmVudFR5cGU8YW55Pik7XG4gIH1cbn1cblxuZnVuY3Rpb24gYWRkU2V0PFQ+KHNvdXJjZVNldDogU2V0PFQ+LCB0YXJnZXRTZXQ6IFNldDxUPik6IHZvaWQge1xuICBmb3IgKGNvbnN0IG0gb2Ygc291cmNlU2V0KSB7XG4gICAgdGFyZ2V0U2V0LmFkZChtKTtcbiAgfVxufVxuXG4vKiogVGhlIGRlcHMgdHJhY2tlciB0byBiZSB1c2VkIGluIHRoZSBjdXJyZW50IEFuZ3VsYXIgYXBwIGluIGRldiBtb2RlLiAqL1xuZXhwb3J0IGNvbnN0IGRlcHNUcmFja2VyID0gbmV3IERlcHNUcmFja2VyKCk7XG5cbmV4cG9ydCBjb25zdCBURVNUX09OTFkgPSB7RGVwc1RyYWNrZXJ9O1xuIl19