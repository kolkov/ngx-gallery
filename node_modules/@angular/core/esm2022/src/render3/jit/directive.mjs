/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { getCompilerFacade, } from '../../compiler/compiler_facade';
import { resolveForwardRef } from '../../di/forward_ref';
import { getReflect, reflectDependencies } from '../../di/jit/util';
import { componentNeedsResolution, maybeQueueResolutionOfComponentResources, } from '../../metadata/resource_loading';
import { ViewEncapsulation } from '../../metadata/view';
import { flatten } from '../../util/array_utils';
import { EMPTY_ARRAY, EMPTY_OBJ } from '../../util/empty';
import { initNgDevMode } from '../../util/ng_dev_mode';
import { getComponentDef, getDirectiveDef, getNgModuleDef, getPipeDef } from '../definition';
import { depsTracker, USE_RUNTIME_DEPS_TRACKER_FOR_JIT } from '../deps_tracker/deps_tracker';
import { NG_COMP_DEF, NG_DIR_DEF, NG_FACTORY_DEF } from '../fields';
import { stringifyForError } from '../util/stringify_utils';
import { angularCoreEnv } from './environment';
import { getJitOptions } from './jit_options';
import { flushModuleScopingQueueAsMuchAsPossible, patchComponentDefWithScope, transitiveScopesFor, } from './module';
import { isComponent, verifyStandaloneImport } from './util';
/**
 * Keep track of the compilation depth to avoid reentrancy issues during JIT compilation. This
 * matters in the following scenario:
 *
 * Consider a component 'A' that extends component 'B', both declared in module 'M'. During
 * the compilation of 'A' the definition of 'B' is requested to capture the inheritance chain,
 * potentially triggering compilation of 'B'. If this nested compilation were to trigger
 * `flushModuleScopingQueueAsMuchAsPossible` it may happen that module 'M' is still pending in the
 * queue, resulting in 'A' and 'B' to be patched with the NgModule scope. As the compilation of
 * 'A' is still in progress, this would introduce a circular dependency on its compilation. To avoid
 * this issue, the module scope queue is only flushed for compilations at the depth 0, to ensure
 * all compilations have finished.
 */
let compilationDepth = 0;
/**
 * Compile an Angular component according to its decorator metadata, and patch the resulting
 * component def (ɵcmp) onto the component type.
 *
 * Compilation may be asynchronous (due to the need to resolve URLs for the component template or
 * other resources, for example). In the event that compilation is not immediate, `compileComponent`
 * will enqueue resource resolution into a global queue and will fail to return the `ɵcmp`
 * until the global queue has been resolved with a call to `resolveComponentResources`.
 */
export function compileComponent(type, metadata) {
    // Initialize ngDevMode. This must be the first statement in compileComponent.
    // See the `initNgDevMode` docstring for more information.
    (typeof ngDevMode === 'undefined' || ngDevMode) && initNgDevMode();
    let ngComponentDef = null;
    // Metadata may have resources which need to be resolved.
    maybeQueueResolutionOfComponentResources(type, metadata);
    // Note that we're using the same function as `Directive`, because that's only subset of metadata
    // that we need to create the ngFactoryDef. We're avoiding using the component metadata
    // because we'd have to resolve the asynchronous templates.
    addDirectiveFactoryDef(type, metadata);
    Object.defineProperty(type, NG_COMP_DEF, {
        get: () => {
            if (ngComponentDef === null) {
                const compiler = getCompilerFacade({
                    usage: 0 /* JitCompilerUsage.Decorator */,
                    kind: 'component',
                    type: type,
                });
                if (componentNeedsResolution(metadata)) {
                    const error = [`Component '${type.name}' is not resolved:`];
                    if (metadata.templateUrl) {
                        error.push(` - templateUrl: ${metadata.templateUrl}`);
                    }
                    if (metadata.styleUrls && metadata.styleUrls.length) {
                        error.push(` - styleUrls: ${JSON.stringify(metadata.styleUrls)}`);
                    }
                    if (metadata.styleUrl) {
                        error.push(` - styleUrl: ${metadata.styleUrl}`);
                    }
                    error.push(`Did you run and wait for 'resolveComponentResources()'?`);
                    throw new Error(error.join('\n'));
                }
                // This const was called `jitOptions` previously but had to be renamed to `options` because
                // of a bug with Terser that caused optimized JIT builds to throw a `ReferenceError`.
                // This bug was investigated in https://github.com/angular/angular-cli/issues/17264.
                // We should not rename it back until https://github.com/terser/terser/issues/615 is fixed.
                const options = getJitOptions();
                let preserveWhitespaces = metadata.preserveWhitespaces;
                if (preserveWhitespaces === undefined) {
                    if (options !== null && options.preserveWhitespaces !== undefined) {
                        preserveWhitespaces = options.preserveWhitespaces;
                    }
                    else {
                        preserveWhitespaces = false;
                    }
                }
                let encapsulation = metadata.encapsulation;
                if (encapsulation === undefined) {
                    if (options !== null && options.defaultEncapsulation !== undefined) {
                        encapsulation = options.defaultEncapsulation;
                    }
                    else {
                        encapsulation = ViewEncapsulation.Emulated;
                    }
                }
                const templateUrl = metadata.templateUrl || `ng:///${type.name}/template.html`;
                const meta = {
                    ...directiveMetadata(type, metadata),
                    typeSourceSpan: compiler.createParseSourceSpan('Component', type.name, templateUrl),
                    template: metadata.template || '',
                    preserveWhitespaces,
                    styles: typeof metadata.styles === 'string'
                        ? [metadata.styles]
                        : metadata.styles || EMPTY_ARRAY,
                    animations: metadata.animations,
                    // JIT components are always compiled against an empty set of `declarations`. Instead, the
                    // `directiveDefs` and `pipeDefs` are updated at a later point:
                    //  * for NgModule-based components, they're set when the NgModule which declares the
                    //    component resolves in the module scoping queue
                    //  * for standalone components, they're set just below, after `compileComponent`.
                    declarations: [],
                    changeDetection: metadata.changeDetection,
                    encapsulation,
                    interpolation: metadata.interpolation,
                    viewProviders: metadata.viewProviders || null,
                };
                compilationDepth++;
                try {
                    if (meta.usesInheritance) {
                        addDirectiveDefToUndecoratedParents(type);
                    }
                    ngComponentDef = compiler.compileComponent(angularCoreEnv, templateUrl, meta);
                    if (metadata.standalone) {
                        // Patch the component definition for standalone components with `directiveDefs` and
                        // `pipeDefs` functions which lazily compute the directives/pipes available in the
                        // standalone component. Also set `dependencies` to the lazily resolved list of imports.
                        const imports = flatten(metadata.imports || EMPTY_ARRAY);
                        const { directiveDefs, pipeDefs } = getStandaloneDefFunctions(type, imports);
                        ngComponentDef.directiveDefs = directiveDefs;
                        ngComponentDef.pipeDefs = pipeDefs;
                        ngComponentDef.dependencies = () => imports.map(resolveForwardRef);
                    }
                }
                finally {
                    // Ensure that the compilation depth is decremented even when the compilation failed.
                    compilationDepth--;
                }
                if (compilationDepth === 0) {
                    // When NgModule decorator executed, we enqueued the module definition such that
                    // it would only dequeue and add itself as module scope to all of its declarations,
                    // but only if  if all of its declarations had resolved. This call runs the check
                    // to see if any modules that are in the queue can be dequeued and add scope to
                    // their declarations.
                    flushModuleScopingQueueAsMuchAsPossible();
                }
                // If component compilation is async, then the @NgModule annotation which declares the
                // component may execute and set an ngSelectorScope property on the component type. This
                // allows the component to patch itself with directiveDefs from the module after it
                // finishes compiling.
                if (hasSelectorScope(type)) {
                    const scopes = transitiveScopesFor(type.ngSelectorScope);
                    patchComponentDefWithScope(ngComponentDef, scopes);
                }
                if (metadata.schemas) {
                    if (metadata.standalone) {
                        ngComponentDef.schemas = metadata.schemas;
                    }
                    else {
                        throw new Error(`The 'schemas' was specified for the ${stringifyForError(type)} but is only valid on a component that is standalone.`);
                    }
                }
                else if (metadata.standalone) {
                    ngComponentDef.schemas = [];
                }
            }
            return ngComponentDef;
        },
        // Make the property configurable in dev mode to allow overriding in tests
        configurable: !!ngDevMode,
    });
}
/**
 * Build memoized `directiveDefs` and `pipeDefs` functions for the component definition of a
 * standalone component, which process `imports` and filter out directives and pipes. The use of
 * memoized functions here allows for the delayed resolution of any `forwardRef`s present in the
 * component's `imports`.
 */
function getStandaloneDefFunctions(type, imports) {
    let cachedDirectiveDefs = null;
    let cachedPipeDefs = null;
    const directiveDefs = () => {
        if (!USE_RUNTIME_DEPS_TRACKER_FOR_JIT) {
            if (cachedDirectiveDefs === null) {
                // Standalone components are always able to self-reference, so include the component's own
                // definition in its `directiveDefs`.
                cachedDirectiveDefs = [getComponentDef(type)];
                const seen = new Set([type]);
                for (const rawDep of imports) {
                    ngDevMode && verifyStandaloneImport(rawDep, type);
                    const dep = resolveForwardRef(rawDep);
                    if (seen.has(dep)) {
                        continue;
                    }
                    seen.add(dep);
                    if (!!getNgModuleDef(dep)) {
                        const scope = transitiveScopesFor(dep);
                        for (const dir of scope.exported.directives) {
                            const def = getComponentDef(dir) || getDirectiveDef(dir);
                            if (def && !seen.has(dir)) {
                                seen.add(dir);
                                cachedDirectiveDefs.push(def);
                            }
                        }
                    }
                    else {
                        const def = getComponentDef(dep) || getDirectiveDef(dep);
                        if (def) {
                            cachedDirectiveDefs.push(def);
                        }
                    }
                }
            }
            return cachedDirectiveDefs;
        }
        else {
            if (ngDevMode) {
                for (const rawDep of imports) {
                    verifyStandaloneImport(rawDep, type);
                }
            }
            if (!isComponent(type)) {
                return [];
            }
            const scope = depsTracker.getStandaloneComponentScope(type, imports);
            return [...scope.compilation.directives]
                .map((p) => (getComponentDef(p) || getDirectiveDef(p)))
                .filter((d) => d !== null);
        }
    };
    const pipeDefs = () => {
        if (!USE_RUNTIME_DEPS_TRACKER_FOR_JIT) {
            if (cachedPipeDefs === null) {
                cachedPipeDefs = [];
                const seen = new Set();
                for (const rawDep of imports) {
                    const dep = resolveForwardRef(rawDep);
                    if (seen.has(dep)) {
                        continue;
                    }
                    seen.add(dep);
                    if (!!getNgModuleDef(dep)) {
                        const scope = transitiveScopesFor(dep);
                        for (const pipe of scope.exported.pipes) {
                            const def = getPipeDef(pipe);
                            if (def && !seen.has(pipe)) {
                                seen.add(pipe);
                                cachedPipeDefs.push(def);
                            }
                        }
                    }
                    else {
                        const def = getPipeDef(dep);
                        if (def) {
                            cachedPipeDefs.push(def);
                        }
                    }
                }
            }
            return cachedPipeDefs;
        }
        else {
            if (ngDevMode) {
                for (const rawDep of imports) {
                    verifyStandaloneImport(rawDep, type);
                }
            }
            if (!isComponent(type)) {
                return [];
            }
            const scope = depsTracker.getStandaloneComponentScope(type, imports);
            return [...scope.compilation.pipes].map((p) => getPipeDef(p)).filter((d) => d !== null);
        }
    };
    return {
        directiveDefs,
        pipeDefs,
    };
}
function hasSelectorScope(component) {
    return component.ngSelectorScope !== undefined;
}
/**
 * Compile an Angular directive according to its decorator metadata, and patch the resulting
 * directive def onto the component type.
 *
 * In the event that compilation is not immediate, `compileDirective` will return a `Promise` which
 * will resolve when compilation completes and the directive becomes usable.
 */
export function compileDirective(type, directive) {
    let ngDirectiveDef = null;
    addDirectiveFactoryDef(type, directive || {});
    Object.defineProperty(type, NG_DIR_DEF, {
        get: () => {
            if (ngDirectiveDef === null) {
                // `directive` can be null in the case of abstract directives as a base class
                // that use `@Directive()` with no selector. In that case, pass empty object to the
                // `directiveMetadata` function instead of null.
                const meta = getDirectiveMetadata(type, directive || {});
                const compiler = getCompilerFacade({
                    usage: 0 /* JitCompilerUsage.Decorator */,
                    kind: 'directive',
                    type,
                });
                ngDirectiveDef = compiler.compileDirective(angularCoreEnv, meta.sourceMapUrl, meta.metadata);
            }
            return ngDirectiveDef;
        },
        // Make the property configurable in dev mode to allow overriding in tests
        configurable: !!ngDevMode,
    });
}
function getDirectiveMetadata(type, metadata) {
    const name = type && type.name;
    const sourceMapUrl = `ng:///${name}/ɵdir.js`;
    const compiler = getCompilerFacade({ usage: 0 /* JitCompilerUsage.Decorator */, kind: 'directive', type });
    const facade = directiveMetadata(type, metadata);
    facade.typeSourceSpan = compiler.createParseSourceSpan('Directive', name, sourceMapUrl);
    if (facade.usesInheritance) {
        addDirectiveDefToUndecoratedParents(type);
    }
    return { metadata: facade, sourceMapUrl };
}
function addDirectiveFactoryDef(type, metadata) {
    let ngFactoryDef = null;
    Object.defineProperty(type, NG_FACTORY_DEF, {
        get: () => {
            if (ngFactoryDef === null) {
                const meta = getDirectiveMetadata(type, metadata);
                const compiler = getCompilerFacade({
                    usage: 0 /* JitCompilerUsage.Decorator */,
                    kind: 'directive',
                    type,
                });
                ngFactoryDef = compiler.compileFactory(angularCoreEnv, `ng:///${type.name}/ɵfac.js`, {
                    name: meta.metadata.name,
                    type: meta.metadata.type,
                    typeArgumentCount: 0,
                    deps: reflectDependencies(type),
                    target: compiler.FactoryTarget.Directive,
                });
            }
            return ngFactoryDef;
        },
        // Make the property configurable in dev mode to allow overriding in tests
        configurable: !!ngDevMode,
    });
}
export function extendsDirectlyFromObject(type) {
    return Object.getPrototypeOf(type.prototype) === Object.prototype;
}
/**
 * Extract the `R3DirectiveMetadata` for a particular directive (either a `Directive` or a
 * `Component`).
 */
export function directiveMetadata(type, metadata) {
    // Reflect inputs and outputs.
    const reflect = getReflect();
    const propMetadata = reflect.ownPropMetadata(type);
    return {
        name: type.name,
        type: type,
        selector: metadata.selector !== undefined ? metadata.selector : null,
        host: metadata.host || EMPTY_OBJ,
        propMetadata: propMetadata,
        inputs: metadata.inputs || EMPTY_ARRAY,
        outputs: metadata.outputs || EMPTY_ARRAY,
        queries: extractQueriesMetadata(type, propMetadata, isContentQuery),
        lifecycle: { usesOnChanges: reflect.hasLifecycleHook(type, 'ngOnChanges') },
        typeSourceSpan: null,
        usesInheritance: !extendsDirectlyFromObject(type),
        exportAs: extractExportAs(metadata.exportAs),
        providers: metadata.providers || null,
        viewQueries: extractQueriesMetadata(type, propMetadata, isViewQuery),
        isStandalone: !!metadata.standalone,
        isSignal: !!metadata.signals,
        hostDirectives: metadata.hostDirectives?.map((directive) => typeof directive === 'function' ? { directive } : directive) || null,
    };
}
/**
 * Adds a directive definition to all parent classes of a type that don't have an Angular decorator.
 */
function addDirectiveDefToUndecoratedParents(type) {
    const objPrototype = Object.prototype;
    let parent = Object.getPrototypeOf(type.prototype).constructor;
    // Go up the prototype until we hit `Object`.
    while (parent && parent !== objPrototype) {
        // Since inheritance works if the class was annotated already, we only need to add
        // the def if there are no annotations and the def hasn't been created already.
        if (!getDirectiveDef(parent) &&
            !getComponentDef(parent) &&
            shouldAddAbstractDirective(parent)) {
            compileDirective(parent, null);
        }
        parent = Object.getPrototypeOf(parent);
    }
}
function convertToR3QueryPredicate(selector) {
    return typeof selector === 'string' ? splitByComma(selector) : resolveForwardRef(selector);
}
export function convertToR3QueryMetadata(propertyName, ann) {
    return {
        propertyName: propertyName,
        predicate: convertToR3QueryPredicate(ann.selector),
        descendants: ann.descendants,
        first: ann.first,
        read: ann.read ? ann.read : null,
        static: !!ann.static,
        emitDistinctChangesOnly: !!ann.emitDistinctChangesOnly,
        isSignal: !!ann.isSignal,
    };
}
function extractQueriesMetadata(type, propMetadata, isQueryAnn) {
    const queriesMeta = [];
    for (const field in propMetadata) {
        if (propMetadata.hasOwnProperty(field)) {
            const annotations = propMetadata[field];
            annotations.forEach((ann) => {
                if (isQueryAnn(ann)) {
                    if (!ann.selector) {
                        throw new Error(`Can't construct a query for the property "${field}" of ` +
                            `"${stringifyForError(type)}" since the query selector wasn't defined.`);
                    }
                    if (annotations.some(isInputAnnotation)) {
                        throw new Error(`Cannot combine @Input decorators with query decorators`);
                    }
                    queriesMeta.push(convertToR3QueryMetadata(field, ann));
                }
            });
        }
    }
    return queriesMeta;
}
function extractExportAs(exportAs) {
    return exportAs === undefined ? null : splitByComma(exportAs);
}
function isContentQuery(value) {
    const name = value.ngMetadataName;
    return name === 'ContentChild' || name === 'ContentChildren';
}
function isViewQuery(value) {
    const name = value.ngMetadataName;
    return name === 'ViewChild' || name === 'ViewChildren';
}
function isInputAnnotation(value) {
    return value.ngMetadataName === 'Input';
}
function splitByComma(value) {
    return value.split(',').map((piece) => piece.trim());
}
const LIFECYCLE_HOOKS = [
    'ngOnChanges',
    'ngOnInit',
    'ngOnDestroy',
    'ngDoCheck',
    'ngAfterViewInit',
    'ngAfterViewChecked',
    'ngAfterContentInit',
    'ngAfterContentChecked',
];
function shouldAddAbstractDirective(type) {
    const reflect = getReflect();
    if (LIFECYCLE_HOOKS.some((hookName) => reflect.hasLifecycleHook(type, hookName))) {
        return true;
    }
    const propMetadata = reflect.propMetadata(type);
    for (const field in propMetadata) {
        const annotations = propMetadata[field];
        for (let i = 0; i < annotations.length; i++) {
            const current = annotations[i];
            const metadataName = current.ngMetadataName;
            if (isInputAnnotation(current) ||
                isContentQuery(current) ||
                isViewQuery(current) ||
                metadataName === 'Output' ||
                metadataName === 'HostBinding' ||
                metadataName === 'HostListener') {
                return true;
            }
        }
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9qaXQvZGlyZWN0aXZlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFDTCxpQkFBaUIsR0FHbEIsTUFBTSxnQ0FBZ0MsQ0FBQztBQUt4QyxPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUN2RCxPQUFPLEVBQUMsVUFBVSxFQUFFLG1CQUFtQixFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFJbEUsT0FBTyxFQUNMLHdCQUF3QixFQUN4Qix3Q0FBd0MsR0FDekMsTUFBTSxpQ0FBaUMsQ0FBQztBQUN6QyxPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUN0RCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLFdBQVcsRUFBRSxTQUFTLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUN4RCxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDckQsT0FBTyxFQUFDLGVBQWUsRUFBRSxlQUFlLEVBQUUsY0FBYyxFQUFFLFVBQVUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUMzRixPQUFPLEVBQUMsV0FBVyxFQUFFLGdDQUFnQyxFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDM0YsT0FBTyxFQUFDLFdBQVcsRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBRWxFLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTFELE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDN0MsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUM1QyxPQUFPLEVBQ0wsdUNBQXVDLEVBQ3ZD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QUMvQixNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDO1lBRTVDLElBQ0UsaUJBQWlCLENBQUMsT0FBTyxDQUFDO2dCQUMxQixjQUFjLENBQUMsT0FBTyxDQUFDO2dCQUN2QixXQUFXLENBQUMsT0FBTyxDQUFDO2dCQUNwQixZQUFZLEtBQUssUUFBUTtnQkFDekIsWUFBWSxLQUFLLGFBQWE7Z0JBQzlCLFlBQVksS0FBSyxjQUFjLEVBQy9CLENBQUM7Z0JBQ0QsT0FBTyxJQUFJLENBQUM7WUFDZCxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFFRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgZ2V0Q29tcGlsZXJGYWNhZGUsXG4gIEppdENvbXBpbGVyVXNhZ2UsXG4gIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUsXG59IGZyb20gJy4uLy4uL2NvbXBpbGVyL2NvbXBpbGVyX2ZhY2FkZSc7XG5pbXBvcnQge1xuICBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlLFxuICBSM1F1ZXJ5TWV0YWRhdGFGYWNhZGUsXG59IGZyb20gJy4uLy4uL2NvbXBpbGVyL2NvbXBpbGVyX2ZhY2FkZV9pbnRlcmZhY2UnO1xuaW1wb3J0IHtyZXNvbHZlRm9yd2FyZFJlZn0gZnJvbSAnLi4vLi4vZGkvZm9yd2FyZF9yZWYnO1xuaW1wb3J0IHtnZXRSZWZsZWN0LCByZWZsZWN0RGVwZW5kZW5jaWVzfSBmcm9tICcuLi8uLi9kaS9qaXQvdXRpbCc7XG5pbXBvcnQge1R5cGV9IGZyb20gJy4uLy4uL2ludGVyZmFjZS90eXBlJztcbmltcG9ydCB7UXVlcnl9IGZyb20gJy4uLy4uL21ldGFkYXRhL2RpJztcbmltcG9ydCB7Q29tcG9uZW50LCBEaXJlY3RpdmUsIElucHV0fSBmcm9tICcuLi8uLi9tZXRhZGF0YS9kaXJlY3RpdmVzJztcbmltcG9ydCB7XG4gIGNvbXBvbmVudE5lZWRzUmVzb2x1dGlvbixcbiAgbWF5YmVRdWV1ZVJlc29sdXRpb25PZkNvbXBvbmVudFJlc291cmNlcyxcbn0gZnJvbSAnLi4vLi4vbWV0YWRhdGEvcmVzb3VyY2VfbG9hZGluZyc7XG5pbXBvcnQge1ZpZXdFbmNhcHN1bGF0aW9ufSBmcm9tICcuLi8uLi9tZXRhZGF0YS92aWV3JztcbmltcG9ydCB7ZmxhdHRlbn0gZnJvbSAnLi4vLi4vdXRpbC9hcnJheV91dGlscyc7XG5pbXBvcnQge0VNUFRZX0FSUkFZLCBFTVBUWV9PQkp9IGZyb20gJy4uLy4uL3V0aWwvZW1wdHknO1xuaW1wb3J0IHtpbml0TmdEZXZNb2RlfSBmcm9tICcuLi8uLi91dGlsL25nX2Rldl9tb2RlJztcbmltcG9ydCB7Z2V0Q29tcG9uZW50RGVmLCBnZXREaXJlY3RpdmVEZWYsIGdldE5nTW9kdWxlRGVmLCBnZXRQaXBlRGVmfSBmcm9tICcuLi9kZWZpbml0aW9uJztcbmltcG9ydCB7ZGVwc1RyYWNrZXIsIFVTRV9SVU5USU1FX0RFUFNfVFJBQ0tFUl9GT1JfSklUfSBmcm9tICcuLi9kZXBzX3RyYWNrZXIvZGVwc190cmFja2VyJztcbmltcG9ydCB7TkdfQ09NUF9ERUYsIE5HX0RJUl9ERUYsIE5HX0ZBQ1RPUllfREVGfSBmcm9tICcuLi9maWVsZHMnO1xuaW1wb3J0IHtDb21wb25lbnREZWYsIENvbXBvbmVudFR5cGUsIERpcmVjdGl2ZURlZkxpc3QsIFBpcGVEZWZMaXN0fSBmcm9tICcuLi9pbnRlcmZhY2VzL2RlZmluaXRpb24nO1xuaW1wb3J0IHtzdHJpbmdpZnlGb3JFcnJvcn0gZnJvbSAnLi4vdXRpbC9zdHJpbmdpZnlfdXRpbHMnO1xuXG5pbXBvcnQge2FuZ3VsYXJDb3JlRW52fSBmcm9tICcuL2Vudmlyb25tZW50JztcbmltcG9ydCB7Z2V0Sml0T3B0aW9uc30gZnJvbSAnLi9qaXRfb3B0aW9ucyc7XG5pbXBvcnQge1xuICBmbHVzaE1vZHVsZVNjb3BpbmdRdWV1ZUFzTXVjaEFzUG9zc2libGUsXG4gIHBhdGNoQ29tcG9uZW50RGVmV2l0aFNjb3BlLFxuICB0cmFuc2l0aXZlU2NvcGVzRm9yLFxufSBmcm9tICcuL21vZHVsZSc7XG5pbXBvcnQge2lzQ29tcG9uZW50LCB2ZXJpZnlTdGFuZGFsb25lSW1wb3J0fSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIEtlZXAgdHJhY2sgb2YgdGhlIGNvbXBpbGF0aW9uIGRlcHRoIHRvIGF2b2lkIHJlZW50cmFuY3kgaXNzdWVzIGR1cmluZyBKSVQgY29tcGlsYXRpb24uIFRoaXNcbiAqIG1hdHRlcnMgaW4gdGhlIGZvbGxvd2luZyBzY2VuYXJpbzpcbiAqXG4gKiBDb25zaWRlciBhIGNvbXBvbmVudCAnQScgdGhhdCBleHRlbmRzIGNvbXBvbmVudCAnQicsIGJvdGggZGVjbGFyZWQgaW4gbW9kdWxlICdNJy4gRHVyaW5nXG4gKiB0aGUgY29tcGlsYXRpb24gb2YgJ0EnIHRoZSBkZWZpbml0aW9uIG9mICdCJyBpcyByZXF1ZXN0ZWQgdG8gY2FwdHVyZSB0aGUgaW5oZXJpdGFuY2UgY2hhaW4sXG4gKiBwb3RlbnRpYWxseSB0cmlnZ2VyaW5nIGNvbXBpbGF0aW9uIG9mICdCJy4gSWYgdGhpcyBuZXN0ZWQgY29tcGlsYXRpb24gd2VyZSB0byB0cmlnZ2VyXG4gKiBgZmx1c2hNb2R1bGVTY29waW5nUXVldWVBc011Y2hBc1Bvc3NpYmxlYCBpdCBtYXkgaGFwcGVuIHRoYXQgbW9kdWxlICdNJyBpcyBzdGlsbCBwZW5kaW5nIGluIHRoZVxuICogcXVldWUsIHJlc3VsdGluZyBpbiAnQScgYW5kICdCJyB0byBiZSBwYXRjaGVkIHdpdGggdGhlIE5nTW9kdWxlIHNjb3BlLiBBcyB0aGUgY29tcGlsYXRpb24gb2ZcbiAqICdBJyBpcyBzdGlsbCBpbiBwcm9ncmVzcywgdGhpcyB3b3VsZCBpbnRyb2R1Y2UgYSBjaXJjdWxhciBkZXBlbmRlbmN5IG9uIGl0cyBjb21waWxhdGlvbi4gVG8gYXZvaWRcbiAqIHRoaXMgaXNzdWUsIHRoZSBtb2R1bGUgc2NvcGUgcXVldWUgaXMgb25seSBmbHVzaGVkIGZvciBjb21waWxhdGlvbnMgYXQgdGhlIGRlcHRoIDAsIHRvIGVuc3VyZVxuICogYWxsIGNvbXBpbGF0aW9ucyBoYXZlIGZpbmlzaGVkLlxuICovXG5sZXQgY29tcGlsYXRpb25EZXB0aCA9IDA7XG5cbi8qKlxuICogQ29tcGlsZSBhbiBBbmd1bGFyIGNvbXBvbmVudCBhY2NvcmRpbmcgdG8gaXRzIGRlY29yYXRvciBtZXRhZGF0YSwgYW5kIHBhdGNoIHRoZSByZXN1bHRpbmdcbiAqIGNvbXBvbmVudCBkZWYgKMm1Y21wKSBvbnRvIHRoZSBjb21wb25lbnQgdHlwZS5cbiAqXG4gKiBDb21waWxhdGlvbiBtYXkgYmUgYXN5bmNocm9ub3VzIChkdWUgdG8gdGhlIG5lZWQgdG8gcmVzb2x2ZSBVUkxzIGZvciB0aGUgY29tcG9uZW50IHRlbXBsYXRlIG9yXG4gKiBvdGhlciByZXNvdXJjZXMsIGZvciBleGFtcGxlKS4gSW4gdGhlIGV2ZW50IHRoYXQgY29tcGlsYXRpb24gaXMgbm90IGltbWVkaWF0ZSwgYGNvbXBpbGVDb21wb25lbnRgXG4gKiB3aWxsIGVucXVldWUgcmVzb3VyY2UgcmVzb2x1dGlvbiBpbnRvIGEgZ2xvYmFsIHF1ZXVlIGFuZCB3aWxsIGZhaWwgdG8gcmV0dXJuIHRoZSBgybVjbXBgXG4gKiB1bnRpbCB0aGUgZ2xvYmFsIHF1ZXVlIGhhcyBiZWVuIHJlc29sdmVkIHdpdGggYSBjYWxsIHRvIGByZXNvbHZlQ29tcG9uZW50UmVzb3VyY2VzYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVDb21wb25lbnQodHlwZTogVHlwZTxhbnk+LCBtZXRhZGF0YTogQ29tcG9uZW50KTogdm9pZCB7XG4gIC8vIEluaXRpYWxpemUgbmdEZXZNb2RlLiBUaGlzIG11c3QgYmUgdGhlIGZpcnN0IHN0YXRlbWVudCBpbiBjb21waWxlQ29tcG9uZW50LlxuICAvLyBTZWUgdGhlIGBpbml0TmdEZXZNb2RlYCBkb2NzdHJpbmcgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gICh0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCBuZ0Rldk1vZGUpICYmIGluaXROZ0Rldk1vZGUoKTtcblxuICBsZXQgbmdDb21wb25lbnREZWY6IENvbXBvbmVudERlZjx1bmtub3duPiB8IG51bGwgPSBudWxsO1xuXG4gIC8vIE1ldGFkYXRhIG1heSBoYXZlIHJlc291cmNlcyB3aGljaCBuZWVkIHRvIGJlIHJlc29sdmVkLlxuICBtYXliZVF1ZXVlUmVzb2x1dGlvbk9mQ29tcG9uZW50UmVzb3VyY2VzKHR5cGUsIG1ldGFkYXRhKTtcblxuICAvLyBOb3RlIHRoYXQgd2UncmUgdXNpbmcgdGhlIHNhbWUgZnVuY3Rpb24gYXMgYERpcmVjdGl2ZWAsIGJlY2F1c2UgdGhhdCdzIG9ubHkgc3Vic2V0IG9mIG1ldGFkYXRhXG4gIC8vIHRoYXQgd2UgbmVlZCB0byBjcmVhdGUgdGhlIG5nRmFjdG9yeURlZi4gV2UncmUgYXZvaWRpbmcgdXNpbmcgdGhlIGNvbXBvbmVudCBtZXRhZGF0YVxuICAvLyBiZWNhdXNlIHdlJ2QgaGF2ZSB0byByZXNvbHZlIHRoZSBhc3luY2hyb25vdXMgdGVtcGxhdGVzLlxuICBhZGREaXJlY3RpdmVGYWN0b3J5RGVmKHR5cGUsIG1ldGFkYXRhKTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZSwgTkdfQ09NUF9ERUYsIHtcbiAgICBnZXQ6ICgpID0+IHtcbiAgICAgIGlmIChuZ0NvbXBvbmVudERlZiA9PT0gbnVsbCkge1xuICAgICAgICBjb25zdCBjb21waWxlciA9IGdldENvbXBpbGVyRmFjYWRlKHtcbiAgICAgICAgICB1c2FnZTogSml0Q29tcGlsZXJVc2FnZS5EZWNvcmF0b3IsXG4gICAgICAgICAga2luZDogJ2NvbXBvbmVudCcsXG4gICAgICAgICAgdHlwZTogdHlwZSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKGNvbXBvbmVudE5lZWRzUmVzb2x1dGlvbihtZXRhZGF0YSkpIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IFtgQ29tcG9uZW50ICcke3R5cGUubmFtZX0nIGlzIG5vdCByZXNvbHZlZDpgXTtcbiAgICAgICAgICBpZiAobWV0YWRhdGEudGVtcGxhdGVVcmwpIHtcbiAgICAgICAgICAgIGVycm9yLnB1c2goYCAtIHRlbXBsYXRlVXJsOiAke21ldGFkYXRhLnRlbXBsYXRlVXJsfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAobWV0YWRhdGEuc3R5bGVVcmxzICYmIG1ldGFkYXRhLnN0eWxlVXJscy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGVycm9yLnB1c2goYCAtIHN0eWxlVXJsczogJHtKU09OLnN0cmluZ2lmeShtZXRhZGF0YS5zdHlsZVVybHMpfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAobWV0YWRhdGEuc3R5bGVVcmwpIHtcbiAgICAgICAgICAgIGVycm9yLnB1c2goYCAtIHN0eWxlVXJsOiAke21ldGFkYXRhLnN0eWxlVXJsfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlcnJvci5wdXNoKGBEaWQgeW91IHJ1biBhbmQgd2FpdCBmb3IgJ3Jlc29sdmVDb21wb25lbnRSZXNvdXJjZXMoKSc/YCk7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9yLmpvaW4oJ1xcbicpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoaXMgY29uc3Qgd2FzIGNhbGxlZCBgaml0T3B0aW9uc2AgcHJldmlvdXNseSBidXQgaGFkIHRvIGJlIHJlbmFtZWQgdG8gYG9wdGlvbnNgIGJlY2F1c2VcbiAgICAgICAgLy8gb2YgYSBidWcgd2l0aCBUZXJzZXIgdGhhdCBjYXVzZWQgb3B0aW1pemVkIEpJVCBidWlsZHMgdG8gdGhyb3cgYSBgUmVmZXJlbmNlRXJyb3JgLlxuICAgICAgICAvLyBUaGlzIGJ1ZyB3YXMgaW52ZXN0aWdhdGVkIGluIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyL2FuZ3VsYXItY2xpL2lzc3Vlcy8xNzI2NC5cbiAgICAgICAgLy8gV2Ugc2hvdWxkIG5vdCByZW5hbWUgaXQgYmFjayB1bnRpbCBodHRwczovL2dpdGh1Yi5jb20vdGVyc2VyL3RlcnNlci9pc3N1ZXMvNjE1IGlzIGZpeGVkLlxuICAgICAgICBjb25zdCBvcHRpb25zID0gZ2V0Sml0T3B0aW9ucygpO1xuICAgICAgICBsZXQgcHJlc2VydmVXaGl0ZXNwYWNlcyA9IG1ldGFkYXRhLnByZXNlcnZlV2hpdGVzcGFjZXM7XG4gICAgICAgIGlmIChwcmVzZXJ2ZVdoaXRlc3BhY2VzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpZiAob3B0aW9ucyAhPT0gbnVsbCAmJiBvcHRpb25zLnByZXNlcnZlV2hpdGVzcGFjZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcHJlc2VydmVXaGl0ZXNwYWNlcyA9IG9wdGlvbnMucHJlc2VydmVXaGl0ZXNwYWNlcztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJlc2VydmVXaGl0ZXNwYWNlcyA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBsZXQgZW5jYXBzdWxhdGlvbiA9IG1ldGFkYXRhLmVuY2Fwc3VsYXRpb247XG4gICAgICAgIGlmIChlbmNhcHN1bGF0aW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpZiAob3B0aW9ucyAhPT0gbnVsbCAmJiBvcHRpb25zLmRlZmF1bHRFbmNhcHN1bGF0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGVuY2Fwc3VsYXRpb24gPSBvcHRpb25zLmRlZmF1bHRFbmNhcHN1bGF0aW9uO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlbmNhcHN1bGF0aW9uID0gVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGVtcGxhdGVVcmwgPSBtZXRhZGF0YS50ZW1wbGF0ZVVybCB8fCBgbmc6Ly8vJHt0eXBlLm5hbWV9L3RlbXBsYXRlLmh0bWxgO1xuICAgICAgICBjb25zdCBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlID0ge1xuICAgICAgICAgIC4uLmRpcmVjdGl2ZU1ldGFkYXRhKHR5cGUsIG1ldGFkYXRhKSxcbiAgICAgICAgICB0eXBlU291cmNlU3BhbjogY29tcGlsZXIuY3JlYXRlUGFyc2VTb3VyY2VTcGFuKCdDb21wb25lbnQnLCB0eXBlLm5hbWUsIHRlbXBsYXRlVXJsKSxcbiAgICAgICAgICB0ZW1wbGF0ZTogbWV0YWRhdGEudGVtcGxhdGUgfHwgJycsXG4gICAgICAgICAgcHJlc2VydmVXaGl0ZXNwYWNlcyxcbiAgICAgICAgICBzdHlsZXM6XG4gICAgICAgICAgICB0eXBlb2YgbWV0YWRhdGEuc3R5bGVzID09PSAnc3RyaW5nJ1xuICAgICAgICAgICAgICA/IFttZXRhZGF0YS5zdHlsZXNdXG4gICAgICAgICAgICAgIDogbWV0YWRhdGEuc3R5bGVzIHx8IEVNUFRZX0FSUkFZLFxuICAgICAgICAgIGFuaW1hdGlvbnM6IG1ldGFkYXRhLmFuaW1hdGlvbnMsXG4gICAgICAgICAgLy8gSklUIGNvbXBvbmVudHMgYXJlIGFsd2F5cyBjb21waWxlZCBhZ2FpbnN0IGFuIGVtcHR5IHNldCBvZiBgZGVjbGFyYXRpb25zYC4gSW5zdGVhZCwgdGhlXG4gICAgICAgICAgLy8gYGRpcmVjdGl2ZURlZnNgIGFuZCBgcGlwZURlZnNgIGFyZSB1cGRhdGVkIGF0IGEgbGF0ZXIgcG9pbnQ6XG4gICAgICAgICAgLy8gICogZm9yIE5nTW9kdWxlLWJhc2VkIGNvbXBvbmVudHMsIHRoZXkncmUgc2V0IHdoZW4gdGhlIE5nTW9kdWxlIHdoaWNoIGRlY2xhcmVzIHRoZVxuICAgICAgICAgIC8vICAgIGNvbXBvbmVudCByZXNvbHZlcyBpbiB0aGUgbW9kdWxlIHNjb3BpbmcgcXVldWVcbiAgICAgICAgICAvLyAgKiBmb3Igc3RhbmRhbG9uZSBjb21wb25lbnRzLCB0aGV5J3JlIHNldCBqdXN0IGJlbG93LCBhZnRlciBgY29tcGlsZUNvbXBvbmVudGAuXG4gICAgICAgICAgZGVjbGFyYXRpb25zOiBbXSxcbiAgICAgICAgICBjaGFuZ2VEZXRlY3Rpb246IG1ldGFkYXRhLmNoYW5nZURldGVjdGlvbixcbiAgICAgICAgICBlbmNhcHN1bGF0aW9uLFxuICAgICAgICAgIGludGVycG9sYXRpb246IG1ldGFkYXRhLmludGVycG9sYXRpb24sXG4gICAgICAgICAgdmlld1Byb3ZpZGVyczogbWV0YWRhdGEudmlld1Byb3ZpZGVycyB8fCBudWxsLFxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbXBpbGF0aW9uRGVwdGgrKztcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBpZiAobWV0YS51c2VzSW5oZXJpdGFuY2UpIHtcbiAgICAgICAgICAgIGFkZERpcmVjdGl2ZURlZlRvVW5kZWNvcmF0ZWRQYXJlbnRzKHR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBuZ0NvbXBvbmVudERlZiA9IGNvbXBpbGVyLmNvbXBpbGVDb21wb25lbnQoXG4gICAgICAgICAgICBhbmd1bGFyQ29yZUVudixcbiAgICAgICAgICAgIHRlbXBsYXRlVXJsLFxuICAgICAgICAgICAgbWV0YSxcbiAgICAgICAgICApIGFzIENvbXBvbmVudERlZjx1bmtub3duPjtcblxuICAgICAgICAgIGlmIChtZXRhZGF0YS5zdGFuZGFsb25lKSB7XG4gICAgICAgICAgICAvLyBQYXRjaCB0aGUgY29tcG9uZW50IGRlZmluaXRpb24gZm9yIHN0YW5kYWxvbmUgY29tcG9uZW50cyB3aXRoIGBkaXJlY3RpdmVEZWZzYCBhbmRcbiAgICAgICAgICAgIC8vIGBwaXBlRGVmc2AgZnVuY3Rpb25zIHdoaWNoIGxhemlseSBjb21wdXRlIHRoZSBkaXJlY3RpdmVzL3BpcGVzIGF2YWlsYWJsZSBpbiB0aGVcbiAgICAgICAgICAgIC8vIHN0YW5kYWxvbmUgY29tcG9uZW50LiBBbHNvIHNldCBgZGVwZW5kZW5jaWVzYCB0byB0aGUgbGF6aWx5IHJlc29sdmVkIGxpc3Qgb2YgaW1wb3J0cy5cbiAgICAgICAgICAgIGNvbnN0IGltcG9ydHM6IFR5cGU8YW55PltdID0gZmxhdHRlbihtZXRhZGF0YS5pbXBvcnRzIHx8IEVNUFRZX0FSUkFZKTtcbiAgICAgICAgICAgIGNvbnN0IHtkaXJlY3RpdmVEZWZzLCBwaXBlRGVmc30gPSBnZXRTdGFuZGFsb25lRGVmRnVuY3Rpb25zKHR5cGUsIGltcG9ydHMpO1xuICAgICAgICAgICAgbmdDb21wb25lbnREZWYuZGlyZWN0aXZlRGVmcyA9IGRpcmVjdGl2ZURlZnM7XG4gICAgICAgICAgICBuZ0NvbXBvbmVudERlZi5waXBlRGVmcyA9IHBpcGVEZWZzO1xuICAgICAgICAgICAgbmdDb21wb25lbnREZWYuZGVwZW5kZW5jaWVzID0gKCkgPT4gaW1wb3J0cy5tYXAocmVzb2x2ZUZvcndhcmRSZWYpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAvLyBFbnN1cmUgdGhhdCB0aGUgY29tcGlsYXRpb24gZGVwdGggaXMgZGVjcmVtZW50ZWQgZXZlbiB3aGVuIHRoZSBjb21waWxhdGlvbiBmYWlsZWQuXG4gICAgICAgICAgY29tcGlsYXRpb25EZXB0aC0tO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbXBpbGF0aW9uRGVwdGggPT09IDApIHtcbiAgICAgICAgICAvLyBXaGVuIE5nTW9kdWxlIGRlY29yYXRvciBleGVjdXRlZCwgd2UgZW5xdWV1ZWQgdGhlIG1vZHVsZSBkZWZpbml0aW9uIHN1Y2ggdGhhdFxuICAgICAgICAgIC8vIGl0IHdvdWxkIG9ubHkgZGVxdWV1ZSBhbmQgYWRkIGl0c2VsZiBhcyBtb2R1bGUgc2NvcGUgdG8gYWxsIG9mIGl0cyBkZWNsYXJhdGlvbnMsXG4gICAgICAgICAgLy8gYnV0IG9ubHkgaWYgIGlmIGFsbCBvZiBpdHMgZGVjbGFyYXRpb25zIGhhZCByZXNvbHZlZC4gVGhpcyBjYWxsIHJ1bnMgdGhlIGNoZWNrXG4gICAgICAgICAgLy8gdG8gc2VlIGlmIGFueSBtb2R1bGVzIHRoYXQgYXJlIGluIHRoZSBxdWV1ZSBjYW4gYmUgZGVxdWV1ZWQgYW5kIGFkZCBzY29wZSB0b1xuICAgICAgICAgIC8vIHRoZWlyIGRlY2xhcmF0aW9ucy5cbiAgICAgICAgICBmbHVzaE1vZHVsZVNjb3BpbmdRdWV1ZUFzTXVjaEFzUG9zc2libGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIGNvbXBvbmVudCBjb21waWxhdGlvbiBpcyBhc3luYywgdGhlbiB0aGUgQE5nTW9kdWxlIGFubm90YXRpb24gd2hpY2ggZGVjbGFyZXMgdGhlXG4gICAgICAgIC8vIGNvbXBvbmVudCBtYXkgZXhlY3V0ZSBhbmQgc2V0IGFuIG5nU2VsZWN0b3JTY29wZSBwcm9wZXJ0eSBvbiB0aGUgY29tcG9uZW50IHR5cGUuIFRoaXNcbiAgICAgICAgLy8gYWxsb3dzIHRoZSBjb21wb25lbnQgdG8gcGF0Y2ggaXRzZWxmIHdpdGggZGlyZWN0aXZlRGVmcyBmcm9tIHRoZSBtb2R1bGUgYWZ0ZXIgaXRcbiAgICAgICAgLy8gZmluaXNoZXMgY29tcGlsaW5nLlxuICAgICAgICBpZiAoaGFzU2VsZWN0b3JTY29wZSh0eXBlKSkge1xuICAgICAgICAgIGNvbnN0IHNjb3BlcyA9IHRyYW5zaXRpdmVTY29wZXNGb3IodHlwZS5uZ1NlbGVjdG9yU2NvcGUpO1xuICAgICAgICAgIHBhdGNoQ29tcG9uZW50RGVmV2l0aFNjb3BlKG5nQ29tcG9uZW50RGVmLCBzY29wZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1ldGFkYXRhLnNjaGVtYXMpIHtcbiAgICAgICAgICBpZiAobWV0YWRhdGEuc3RhbmRhbG9uZSkge1xuICAgICAgICAgICAgbmdDb21wb25lbnREZWYuc2NoZW1hcyA9IG1ldGFkYXRhLnNjaGVtYXM7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgYFRoZSAnc2NoZW1hcycgd2FzIHNwZWNpZmllZCBmb3IgdGhlICR7c3RyaW5naWZ5Rm9yRXJyb3IoXG4gICAgICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgICAgKX0gYnV0IGlzIG9ubHkgdmFsaWQgb24gYSBjb21wb25lbnQgdGhhdCBpcyBzdGFuZGFsb25lLmAsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChtZXRhZGF0YS5zdGFuZGFsb25lKSB7XG4gICAgICAgICAgbmdDb21wb25lbnREZWYuc2NoZW1hcyA9IFtdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbmdDb21wb25lbnREZWY7XG4gICAgfSxcbiAgICAvLyBNYWtlIHRoZSBwcm9wZXJ0eSBjb25maWd1cmFibGUgaW4gZGV2IG1vZGUgdG8gYWxsb3cgb3ZlcnJpZGluZyBpbiB0ZXN0c1xuICAgIGNvbmZpZ3VyYWJsZTogISFuZ0Rldk1vZGUsXG4gIH0pO1xufVxuXG4vKipcbiAqIEJ1aWxkIG1lbW9pemVkIGBkaXJlY3RpdmVEZWZzYCBhbmQgYHBpcGVEZWZzYCBmdW5jdGlvbnMgZm9yIHRoZSBjb21wb25lbnQgZGVmaW5pdGlvbiBvZiBhXG4gKiBzdGFuZGFsb25lIGNvbXBvbmVudCwgd2hpY2ggcHJvY2VzcyBgaW1wb3J0c2AgYW5kIGZpbHRlciBvdXQgZGlyZWN0aXZlcyBhbmQgcGlwZXMuIFRoZSB1c2Ugb2ZcbiAqIG1lbW9pemVkIGZ1bmN0aW9ucyBoZXJlIGFsbG93cyBmb3IgdGhlIGRlbGF5ZWQgcmVzb2x1dGlvbiBvZiBhbnkgYGZvcndhcmRSZWZgcyBwcmVzZW50IGluIHRoZVxuICogY29tcG9uZW50J3MgYGltcG9ydHNgLlxuICovXG5mdW5jdGlvbiBnZXRTdGFuZGFsb25lRGVmRnVuY3Rpb25zKFxuICB0eXBlOiBUeXBlPGFueT4sXG4gIGltcG9ydHM6IFR5cGU8YW55PltdLFxuKToge1xuICBkaXJlY3RpdmVEZWZzOiAoKSA9PiBEaXJlY3RpdmVEZWZMaXN0O1xuICBwaXBlRGVmczogKCkgPT4gUGlwZURlZkxpc3Q7XG59IHtcbiAgbGV0IGNhY2hlZERpcmVjdGl2ZURlZnM6IERpcmVjdGl2ZURlZkxpc3QgfCBudWxsID0gbnVsbDtcbiAgbGV0IGNhY2hlZFBpcGVEZWZzOiBQaXBlRGVmTGlzdCB8IG51bGwgPSBudWxsO1xuICBjb25zdCBkaXJlY3RpdmVEZWZzID0gKCkgPT4ge1xuICAgIGlmICghVVNFX1JVTlRJTUVfREVQU19UUkFDS0VSX0ZPUl9KSVQpIHtcbiAgICAgIGlmIChjYWNoZWREaXJlY3RpdmVEZWZzID09PSBudWxsKSB7XG4gICAgICAgIC8vIFN0YW5kYWxvbmUgY29tcG9uZW50cyBhcmUgYWx3YXlzIGFibGUgdG8gc2VsZi1yZWZlcmVuY2UsIHNvIGluY2x1ZGUgdGhlIGNvbXBvbmVudCdzIG93blxuICAgICAgICAvLyBkZWZpbml0aW9uIGluIGl0cyBgZGlyZWN0aXZlRGVmc2AuXG4gICAgICAgIGNhY2hlZERpcmVjdGl2ZURlZnMgPSBbZ2V0Q29tcG9uZW50RGVmKHR5cGUpIV07XG4gICAgICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0PFR5cGU8dW5rbm93bj4+KFt0eXBlXSk7XG5cbiAgICAgICAgZm9yIChjb25zdCByYXdEZXAgb2YgaW1wb3J0cykge1xuICAgICAgICAgIG5nRGV2TW9kZSAmJiB2ZXJpZnlTdGFuZGFsb25lSW1wb3J0KHJhd0RlcCwgdHlwZSk7XG5cbiAgICAgICAgICBjb25zdCBkZXAgPSByZXNvbHZlRm9yd2FyZFJlZihyYXdEZXApO1xuICAgICAgICAgIGlmIChzZWVuLmhhcyhkZXApKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2Vlbi5hZGQoZGVwKTtcblxuICAgICAgICAgIGlmICghIWdldE5nTW9kdWxlRGVmKGRlcCkpIHtcbiAgICAgICAgICAgIGNvbnN0IHNjb3BlID0gdHJhbnNpdGl2ZVNjb3Blc0ZvcihkZXApO1xuICAgICAgICAgICAgZm9yIChjb25zdCBkaXIgb2Ygc2NvcGUuZXhwb3J0ZWQuZGlyZWN0aXZlcykge1xuICAgICAgICAgICAgICBjb25zdCBkZWYgPSBnZXRDb21wb25lbnREZWYoZGlyKSB8fCBnZXREaXJlY3RpdmVEZWYoZGlyKTtcbiAgICAgICAgICAgICAgaWYgKGRlZiAmJiAhc2Vlbi5oYXMoZGlyKSkge1xuICAgICAgICAgICAgICAgIHNlZW4uYWRkKGRpcik7XG4gICAgICAgICAgICAgICAgY2FjaGVkRGlyZWN0aXZlRGVmcy5wdXNoKGRlZik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgZGVmID0gZ2V0Q29tcG9uZW50RGVmKGRlcCkgfHwgZ2V0RGlyZWN0aXZlRGVmKGRlcCk7XG4gICAgICAgICAgICBpZiAoZGVmKSB7XG4gICAgICAgICAgICAgIGNhY2hlZERpcmVjdGl2ZURlZnMucHVzaChkZWYpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGNhY2hlZERpcmVjdGl2ZURlZnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChuZ0Rldk1vZGUpIHtcbiAgICAgICAgZm9yIChjb25zdCByYXdEZXAgb2YgaW1wb3J0cykge1xuICAgICAgICAgIHZlcmlmeVN0YW5kYWxvbmVJbXBvcnQocmF3RGVwLCB0eXBlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIWlzQ29tcG9uZW50KHR5cGUpKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc2NvcGUgPSBkZXBzVHJhY2tlci5nZXRTdGFuZGFsb25lQ29tcG9uZW50U2NvcGUodHlwZSwgaW1wb3J0cyk7XG5cbiAgICAgIHJldHVybiBbLi4uc2NvcGUuY29tcGlsYXRpb24uZGlyZWN0aXZlc11cbiAgICAgICAgLm1hcCgocCkgPT4gKGdldENvbXBvbmVudERlZihwKSB8fCBnZXREaXJlY3RpdmVEZWYocCkpISlcbiAgICAgICAgLmZpbHRlcigoZCkgPT4gZCAhPT0gbnVsbCk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IHBpcGVEZWZzID0gKCkgPT4ge1xuICAgIGlmICghVVNFX1JVTlRJTUVfREVQU19UUkFDS0VSX0ZPUl9KSVQpIHtcbiAgICAgIGlmIChjYWNoZWRQaXBlRGVmcyA9PT0gbnVsbCkge1xuICAgICAgICBjYWNoZWRQaXBlRGVmcyA9IFtdO1xuICAgICAgICBjb25zdCBzZWVuID0gbmV3IFNldDxUeXBlPHVua25vd24+PigpO1xuXG4gICAgICAgIGZvciAoY29uc3QgcmF3RGVwIG9mIGltcG9ydHMpIHtcbiAgICAgICAgICBjb25zdCBkZXAgPSByZXNvbHZlRm9yd2FyZFJlZihyYXdEZXApO1xuICAgICAgICAgIGlmIChzZWVuLmhhcyhkZXApKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2Vlbi5hZGQoZGVwKTtcblxuICAgICAgICAgIGlmICghIWdldE5nTW9kdWxlRGVmKGRlcCkpIHtcbiAgICAgICAgICAgIGNvbnN0IHNjb3BlID0gdHJhbnNpdGl2ZVNjb3Blc0ZvcihkZXApO1xuICAgICAgICAgICAgZm9yIChjb25zdCBwaXBlIG9mIHNjb3BlLmV4cG9ydGVkLnBpcGVzKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGRlZiA9IGdldFBpcGVEZWYocGlwZSk7XG4gICAgICAgICAgICAgIGlmIChkZWYgJiYgIXNlZW4uaGFzKHBpcGUpKSB7XG4gICAgICAgICAgICAgICAgc2Vlbi5hZGQocGlwZSk7XG4gICAgICAgICAgICAgICAgY2FjaGVkUGlwZURlZnMucHVzaChkZWYpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGRlZiA9IGdldFBpcGVEZWYoZGVwKTtcbiAgICAgICAgICAgIGlmIChkZWYpIHtcbiAgICAgICAgICAgICAgY2FjaGVkUGlwZURlZnMucHVzaChkZWYpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGNhY2hlZFBpcGVEZWZzO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAobmdEZXZNb2RlKSB7XG4gICAgICAgIGZvciAoY29uc3QgcmF3RGVwIG9mIGltcG9ydHMpIHtcbiAgICAgICAgICB2ZXJpZnlTdGFuZGFsb25lSW1wb3J0KHJhd0RlcCwgdHlwZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKCFpc0NvbXBvbmVudCh0eXBlKSkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNjb3BlID0gZGVwc1RyYWNrZXIuZ2V0U3RhbmRhbG9uZUNvbXBvbmVudFNjb3BlKHR5cGUsIGltcG9ydHMpO1xuXG4gICAgICByZXR1cm4gWy4uLnNjb3BlLmNvbXBpbGF0aW9uLnBpcGVzXS5tYXAoKHApID0+IGdldFBpcGVEZWYocCkhKS5maWx0ZXIoKGQpID0+IGQgIT09IG51bGwpO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4ge1xuICAgIGRpcmVjdGl2ZURlZnMsXG4gICAgcGlwZURlZnMsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGhhc1NlbGVjdG9yU2NvcGU8VD4oXG4gIGNvbXBvbmVudDogVHlwZTxUPixcbik6IGNvbXBvbmVudCBpcyBUeXBlPFQ+ICYge25nU2VsZWN0b3JTY29wZTogVHlwZTxhbnk+fSB7XG4gIHJldHVybiAoY29tcG9uZW50IGFzIHtuZ1NlbGVjdG9yU2NvcGU/OiBhbnl9KS5uZ1NlbGVjdG9yU2NvcGUgIT09IHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBDb21waWxlIGFuIEFuZ3VsYXIgZGlyZWN0aXZlIGFjY29yZGluZyB0byBpdHMgZGVjb3JhdG9yIG1ldGFkYXRhLCBhbmQgcGF0Y2ggdGhlIHJlc3VsdGluZ1xuICogZGlyZWN0aXZlIGRlZiBvbnRvIHRoZSBjb21wb25lbnQgdHlwZS5cbiAqXG4gKiBJbiB0aGUgZXZlbnQgdGhhdCBjb21waWxhdGlvbiBpcyBub3QgaW1tZWRpYXRlLCBgY29tcGlsZURpcmVjdGl2ZWAgd2lsbCByZXR1cm4gYSBgUHJvbWlzZWAgd2hpY2hcbiAqIHdpbGwgcmVzb2x2ZSB3aGVuIGNvbXBpbGF0aW9uIGNvbXBsZXRlcyBhbmQgdGhlIGRpcmVjdGl2ZSBiZWNvbWVzIHVzYWJsZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEaXJlY3RpdmUodHlwZTogVHlwZTxhbnk+LCBkaXJlY3RpdmU6IERpcmVjdGl2ZSB8IG51bGwpOiB2b2lkIHtcbiAgbGV0IG5nRGlyZWN0aXZlRGVmOiBhbnkgPSBudWxsO1xuXG4gIGFkZERpcmVjdGl2ZUZhY3RvcnlEZWYodHlwZSwgZGlyZWN0aXZlIHx8IHt9KTtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZSwgTkdfRElSX0RFRiwge1xuICAgIGdldDogKCkgPT4ge1xuICAgICAgaWYgKG5nRGlyZWN0aXZlRGVmID09PSBudWxsKSB7XG4gICAgICAgIC8vIGBkaXJlY3RpdmVgIGNhbiBiZSBudWxsIGluIHRoZSBjYXNlIG9mIGFic3RyYWN0IGRpcmVjdGl2ZXMgYXMgYSBiYXNlIGNsYXNzXG4gICAgICAgIC8vIHRoYXQgdXNlIGBARGlyZWN0aXZlKClgIHdpdGggbm8gc2VsZWN0b3IuIEluIHRoYXQgY2FzZSwgcGFzcyBlbXB0eSBvYmplY3QgdG8gdGhlXG4gICAgICAgIC8vIGBkaXJlY3RpdmVNZXRhZGF0YWAgZnVuY3Rpb24gaW5zdGVhZCBvZiBudWxsLlxuICAgICAgICBjb25zdCBtZXRhID0gZ2V0RGlyZWN0aXZlTWV0YWRhdGEodHlwZSwgZGlyZWN0aXZlIHx8IHt9KTtcbiAgICAgICAgY29uc3QgY29tcGlsZXIgPSBnZXRDb21waWxlckZhY2FkZSh7XG4gICAgICAgICAgdXNhZ2U6IEppdENvbXBpbGVyVXNhZ2UuRGVjb3JhdG9yLFxuICAgICAgICAgIGtpbmQ6ICdkaXJlY3RpdmUnLFxuICAgICAgICAgIHR5cGUsXG4gICAgICAgIH0pO1xuICAgICAgICBuZ0RpcmVjdGl2ZURlZiA9IGNvbXBpbGVyLmNvbXBpbGVEaXJlY3RpdmUoXG4gICAgICAgICAgYW5ndWxhckNvcmVFbnYsXG4gICAgICAgICAgbWV0YS5zb3VyY2VNYXBVcmwsXG4gICAgICAgICAgbWV0YS5tZXRhZGF0YSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZ0RpcmVjdGl2ZURlZjtcbiAgICB9LFxuICAgIC8vIE1ha2UgdGhlIHByb3BlcnR5IGNvbmZpZ3VyYWJsZSBpbiBkZXYgbW9kZSB0byBhbGxvdyBvdmVycmlkaW5nIGluIHRlc3RzXG4gICAgY29uZmlndXJhYmxlOiAhIW5nRGV2TW9kZSxcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGdldERpcmVjdGl2ZU1ldGFkYXRhKHR5cGU6IFR5cGU8YW55PiwgbWV0YWRhdGE6IERpcmVjdGl2ZSkge1xuICBjb25zdCBuYW1lID0gdHlwZSAmJiB0eXBlLm5hbWU7XG4gIGNvbnN0IHNvdXJjZU1hcFVybCA9IGBuZzovLy8ke25hbWV9L8m1ZGlyLmpzYDtcbiAgY29uc3QgY29tcGlsZXIgPSBnZXRDb21waWxlckZhY2FkZSh7dXNhZ2U6IEppdENvbXBpbGVyVXNhZ2UuRGVjb3JhdG9yLCBraW5kOiAnZGlyZWN0aXZlJywgdHlwZX0pO1xuICBjb25zdCBmYWNhZGUgPSBkaXJlY3RpdmVNZXRhZGF0YSh0eXBlIGFzIENvbXBvbmVudFR5cGU8YW55PiwgbWV0YWRhdGEpO1xuICBmYWNhZGUudHlwZVNvdXJjZVNwYW4gPSBjb21waWxlci5jcmVhdGVQYXJzZVNvdXJjZVNwYW4oJ0RpcmVjdGl2ZScsIG5hbWUsIHNvdXJjZU1hcFVybCk7XG4gIGlmIChmYWNhZGUudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgYWRkRGlyZWN0aXZlRGVmVG9VbmRlY29yYXRlZFBhcmVudHModHlwZSk7XG4gIH1cbiAgcmV0dXJuIHttZXRhZGF0YTogZmFjYWRlLCBzb3VyY2VNYXBVcmx9O1xufVxuXG5mdW5jdGlvbiBhZGREaXJlY3RpdmVGYWN0b3J5RGVmKHR5cGU6IFR5cGU8YW55PiwgbWV0YWRhdGE6IERpcmVjdGl2ZSB8IENvbXBvbmVudCkge1xuICBsZXQgbmdGYWN0b3J5RGVmOiBhbnkgPSBudWxsO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0eXBlLCBOR19GQUNUT1JZX0RFRiwge1xuICAgIGdldDogKCkgPT4ge1xuICAgICAgaWYgKG5nRmFjdG9yeURlZiA9PT0gbnVsbCkge1xuICAgICAgICBjb25zdCBtZXRhID0gZ2V0RGlyZWN0aXZlTWV0YWRhdGEodHlwZSwgbWV0YWRhdGEpO1xuICAgICAgICBjb25zdCBjb21waWxlciA9IGdldENvbXBpbGVyRmFjYWRlKHtcbiAgICAgICAgICB1c2FnZTogSml0Q29tcGlsZXJVc2FnZS5EZWNvcmF0b3IsXG4gICAgICAgICAga2luZDogJ2RpcmVjdGl2ZScsXG4gICAgICAgICAgdHlwZSxcbiAgICAgICAgfSk7XG4gICAgICAgIG5nRmFjdG9yeURlZiA9IGNvbXBpbGVyLmNvbXBpbGVGYWN0b3J5KGFuZ3VsYXJDb3JlRW52LCBgbmc6Ly8vJHt0eXBlLm5hbWV9L8m1ZmFjLmpzYCwge1xuICAgICAgICAgIG5hbWU6IG1ldGEubWV0YWRhdGEubmFtZSxcbiAgICAgICAgICB0eXBlOiBtZXRhLm1ldGFkYXRhLnR5cGUsXG4gICAgICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgICAgICAgZGVwczogcmVmbGVjdERlcGVuZGVuY2llcyh0eXBlKSxcbiAgICAgICAgICB0YXJnZXQ6IGNvbXBpbGVyLkZhY3RvcnlUYXJnZXQuRGlyZWN0aXZlLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZ0ZhY3RvcnlEZWY7XG4gICAgfSxcbiAgICAvLyBNYWtlIHRoZSBwcm9wZXJ0eSBjb25maWd1cmFibGUgaW4gZGV2IG1vZGUgdG8gYWxsb3cgb3ZlcnJpZGluZyBpbiB0ZXN0c1xuICAgIGNvbmZpZ3VyYWJsZTogISFuZ0Rldk1vZGUsXG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXh0ZW5kc0RpcmVjdGx5RnJvbU9iamVjdCh0eXBlOiBUeXBlPGFueT4pOiBib29sZWFuIHtcbiAgcmV0dXJuIE9iamVjdC5nZXRQcm90b3R5cGVPZih0eXBlLnByb3RvdHlwZSkgPT09IE9iamVjdC5wcm90b3R5cGU7XG59XG5cbi8qKlxuICogRXh0cmFjdCB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgIGZvciBhIHBhcnRpY3VsYXIgZGlyZWN0aXZlIChlaXRoZXIgYSBgRGlyZWN0aXZlYCBvciBhXG4gKiBgQ29tcG9uZW50YCkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaXJlY3RpdmVNZXRhZGF0YSh0eXBlOiBUeXBlPGFueT4sIG1ldGFkYXRhOiBEaXJlY3RpdmUpOiBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlIHtcbiAgLy8gUmVmbGVjdCBpbnB1dHMgYW5kIG91dHB1dHMuXG4gIGNvbnN0IHJlZmxlY3QgPSBnZXRSZWZsZWN0KCk7XG4gIGNvbnN0IHByb3BNZXRhZGF0YSA9IHJlZmxlY3Qub3duUHJvcE1ldGFkYXRhKHR5cGUpO1xuXG4gIHJldHVybiB7XG4gICAgbmFtZTogdHlwZS5uYW1lLFxuICAgIHR5cGU6IHR5cGUsXG4gICAgc2VsZWN0b3I6IG1ldGFkYXRhLnNlbGVjdG9yICE9PSB1bmRlZmluZWQgPyBtZXRhZGF0YS5zZWxlY3RvciA6IG51bGwsXG4gICAgaG9zdDogbWV0YWRhdGEuaG9zdCB8fCBFTVBUWV9PQkosXG4gICAgcHJvcE1ldGFkYXRhOiBwcm9wTWV0YWRhdGEsXG4gICAgaW5wdXRzOiBtZXRhZGF0YS5pbnB1dHMgfHwgRU1QVFlfQVJSQVksXG4gICAgb3V0cHV0czogbWV0YWRhdGEub3V0cHV0cyB8fCBFTVBUWV9BUlJBWSxcbiAgICBxdWVyaWVzOiBleHRyYWN0UXVlcmllc01ldGFkYXRhKHR5cGUsIHByb3BNZXRhZGF0YSwgaXNDb250ZW50UXVlcnkpLFxuICAgIGxpZmVjeWNsZToge3VzZXNPbkNoYW5nZXM6IHJlZmxlY3QuaGFzTGlmZWN5Y2xlSG9vayh0eXBlLCAnbmdPbkNoYW5nZXMnKX0sXG4gICAgdHlwZVNvdXJjZVNwYW46IG51bGwhLFxuICAgIHVzZXNJbmhlcml0YW5jZTogIWV4dGVuZHNEaXJlY3RseUZyb21PYmplY3QodHlwZSksXG4gICAgZXhwb3J0QXM6IGV4dHJhY3RFeHBvcnRBcyhtZXRhZGF0YS5leHBvcnRBcyksXG4gICAgcHJvdmlkZXJzOiBtZXRhZGF0YS5wcm92aWRlcnMgfHwgbnVsbCxcbiAgICB2aWV3UXVlcmllczogZXh0cmFjdFF1ZXJpZXNNZXRhZGF0YSh0eXBlLCBwcm9wTWV0YWRhdGEsIGlzVmlld1F1ZXJ5KSxcbiAgICBpc1N0YW5kYWxvbmU6ICEhbWV0YWRhdGEuc3RhbmRhbG9uZSxcbiAgICBpc1NpZ25hbDogISFtZXRhZGF0YS5zaWduYWxzLFxuICAgIGhvc3REaXJlY3RpdmVzOlxuICAgICAgbWV0YWRhdGEuaG9zdERpcmVjdGl2ZXM/Lm1hcCgoZGlyZWN0aXZlKSA9PlxuICAgICAgICB0eXBlb2YgZGlyZWN0aXZlID09PSAnZnVuY3Rpb24nID8ge2RpcmVjdGl2ZX0gOiBkaXJlY3RpdmUsXG4gICAgICApIHx8IG51bGwsXG4gIH07XG59XG5cbi8qKlxuICogQWRkcyBhIGRpcmVjdGl2ZSBkZWZpbml0aW9uIHRvIGFsbCBwYXJlbnQgY2xhc3NlcyBvZiBhIHR5cGUgdGhhdCBkb24ndCBoYXZlIGFuIEFuZ3VsYXIgZGVjb3JhdG9yLlxuICovXG5mdW5jdGlvbiBhZGREaXJlY3RpdmVEZWZUb1VuZGVjb3JhdGVkUGFyZW50cyh0eXBlOiBUeXBlPGFueT4pIHtcbiAgY29uc3Qgb2JqUHJvdG90eXBlID0gT2JqZWN0LnByb3RvdHlwZTtcbiAgbGV0IHBhcmVudCA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih0eXBlLnByb3RvdHlwZSkuY29uc3RydWN0b3I7XG5cbiAgLy8gR28gdXAgdGhlIHByb3RvdHlwZSB1bnRpbCB3ZSBoaXQgYE9iamVjdGAuXG4gIHdoaWxlIChwYXJlbnQgJiYgcGFyZW50ICE9PSBvYmpQcm90b3R5cGUpIHtcbiAgICAvLyBTaW5jZSBpbmhlcml0YW5jZSB3b3JrcyBpZiB0aGUgY2xhc3Mgd2FzIGFubm90YXRlZCBhbHJlYWR5LCB3ZSBvbmx5IG5lZWQgdG8gYWRkXG4gICAgLy8gdGhlIGRlZiBpZiB0aGVyZSBhcmUgbm8gYW5ub3RhdGlvbnMgYW5kIHRoZSBkZWYgaGFzbid0IGJlZW4gY3JlYXRlZCBhbHJlYWR5LlxuICAgIGlmIChcbiAgICAgICFnZXREaXJlY3RpdmVEZWYocGFyZW50KSAmJlxuICAgICAgIWdldENvbXBvbmVudERlZihwYXJlbnQpICYmXG4gICAgICBzaG91bGRBZGRBYnN0cmFjdERpcmVjdGl2ZShwYXJlbnQpXG4gICAgKSB7XG4gICAgICBjb21waWxlRGlyZWN0aXZlKHBhcmVudCwgbnVsbCk7XG4gICAgfVxuICAgIHBhcmVudCA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihwYXJlbnQpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRUb1IzUXVlcnlQcmVkaWNhdGUoc2VsZWN0b3I6IGFueSk6IGFueSB8IHN0cmluZ1tdIHtcbiAgcmV0dXJuIHR5cGVvZiBzZWxlY3RvciA9PT0gJ3N0cmluZycgPyBzcGxpdEJ5Q29tbWEoc2VsZWN0b3IpIDogcmVzb2x2ZUZvcndhcmRSZWYoc2VsZWN0b3IpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFRvUjNRdWVyeU1ldGFkYXRhKHByb3BlcnR5TmFtZTogc3RyaW5nLCBhbm46IFF1ZXJ5KTogUjNRdWVyeU1ldGFkYXRhRmFjYWRlIHtcbiAgcmV0dXJuIHtcbiAgICBwcm9wZXJ0eU5hbWU6IHByb3BlcnR5TmFtZSxcbiAgICBwcmVkaWNhdGU6IGNvbnZlcnRUb1IzUXVlcnlQcmVkaWNhdGUoYW5uLnNlbGVjdG9yKSxcbiAgICBkZXNjZW5kYW50czogYW5uLmRlc2NlbmRhbnRzLFxuICAgIGZpcnN0OiBhbm4uZmlyc3QsXG4gICAgcmVhZDogYW5uLnJlYWQgPyBhbm4ucmVhZCA6IG51bGwsXG4gICAgc3RhdGljOiAhIWFubi5zdGF0aWMsXG4gICAgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHk6ICEhYW5uLmVtaXREaXN0aW5jdENoYW5nZXNPbmx5LFxuICAgIGlzU2lnbmFsOiAhIWFubi5pc1NpZ25hbCxcbiAgfTtcbn1cbmZ1bmN0aW9uIGV4dHJhY3RRdWVyaWVzTWV0YWRhdGEoXG4gIHR5cGU6IFR5cGU8YW55PixcbiAgcHJvcE1ldGFkYXRhOiB7W2tleTogc3RyaW5nXTogYW55W119LFxuICBpc1F1ZXJ5QW5uOiAoYW5uOiBhbnkpID0+IGFubiBpcyBRdWVyeSxcbik6IFIzUXVlcnlNZXRhZGF0YUZhY2FkZVtdIHtcbiAgY29uc3QgcXVlcmllc01ldGE6IFIzUXVlcnlNZXRhZGF0YUZhY2FkZVtdID0gW107XG4gIGZvciAoY29uc3QgZmllbGQgaW4gcHJvcE1ldGFkYXRhKSB7XG4gICAgaWYgKHByb3BNZXRhZGF0YS5oYXNPd25Qcm9wZXJ0eShmaWVsZCkpIHtcbiAgICAgIGNvbnN0IGFubm90YXRpb25zID0gcHJvcE1ldGFkYXRhW2ZpZWxkXTtcbiAgICAgIGFubm90YXRpb25zLmZvckVhY2goKGFubikgPT4ge1xuICAgICAgICBpZiAoaXNRdWVyeUFubihhbm4pKSB7XG4gICAgICAgICAgaWYgKCFhbm4uc2VsZWN0b3IpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgYENhbid0IGNvbnN0cnVjdCBhIHF1ZXJ5IGZvciB0aGUgcHJvcGVydHkgXCIke2ZpZWxkfVwiIG9mIGAgK1xuICAgICAgICAgICAgICAgIGBcIiR7c3RyaW5naWZ5Rm9yRXJyb3IodHlwZSl9XCIgc2luY2UgdGhlIHF1ZXJ5IHNlbGVjdG9yIHdhc24ndCBkZWZpbmVkLmAsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoYW5ub3RhdGlvbnMuc29tZShpc0lucHV0QW5ub3RhdGlvbikpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IGNvbWJpbmUgQElucHV0IGRlY29yYXRvcnMgd2l0aCBxdWVyeSBkZWNvcmF0b3JzYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHF1ZXJpZXNNZXRhLnB1c2goY29udmVydFRvUjNRdWVyeU1ldGFkYXRhKGZpZWxkLCBhbm4pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBxdWVyaWVzTWV0YTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdEV4cG9ydEFzKGV4cG9ydEFzOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBzdHJpbmdbXSB8IG51bGwge1xuICByZXR1cm4gZXhwb3J0QXMgPT09IHVuZGVmaW5lZCA/IG51bGwgOiBzcGxpdEJ5Q29tbWEoZXhwb3J0QXMpO1xufVxuXG5mdW5jdGlvbiBpc0NvbnRlbnRRdWVyeSh2YWx1ZTogYW55KTogdmFsdWUgaXMgUXVlcnkge1xuICBjb25zdCBuYW1lID0gdmFsdWUubmdNZXRhZGF0YU5hbWU7XG4gIHJldHVybiBuYW1lID09PSAnQ29udGVudENoaWxkJyB8fCBuYW1lID09PSAnQ29udGVudENoaWxkcmVuJztcbn1cblxuZnVuY3Rpb24gaXNWaWV3UXVlcnkodmFsdWU6IGFueSk6IHZhbHVlIGlzIFF1ZXJ5IHtcbiAgY29uc3QgbmFtZSA9IHZhbHVlLm5nTWV0YWRhdGFOYW1lO1xuICByZXR1cm4gbmFtZSA9PT0gJ1ZpZXdDaGlsZCcgfHwgbmFtZSA9PT0gJ1ZpZXdDaGlsZHJlbic7XG59XG5cbmZ1bmN0aW9uIGlzSW5wdXRBbm5vdGF0aW9uKHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBJbnB1dCB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ0lucHV0Jztcbn1cblxuZnVuY3Rpb24gc3BsaXRCeUNvbW1hKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIHJldHVybiB2YWx1ZS5zcGxpdCgnLCcpLm1hcCgocGllY2UpID0+IHBpZWNlLnRyaW0oKSk7XG59XG5cbmNvbnN0IExJRkVDWUNMRV9IT09LUyA9IFtcbiAgJ25nT25DaGFuZ2VzJyxcbiAgJ25nT25Jbml0JyxcbiAgJ25nT25EZXN0cm95JyxcbiAgJ25nRG9DaGVjaycsXG4gICduZ0FmdGVyVmlld0luaXQnLFxuICAnbmdBZnRlclZpZXdDaGVja2VkJyxcbiAgJ25nQWZ0ZXJDb250ZW50SW5pdCcsXG4gICduZ0FmdGVyQ29udGVudENoZWNrZWQnLFxuXTtcblxuZnVuY3Rpb24gc2hvdWxkQWRkQWJzdHJhY3REaXJlY3RpdmUodHlwZTogVHlwZTxhbnk+KTogYm9vbGVhbiB7XG4gIGNvbnN0IHJlZmxlY3QgPSBnZXRSZWZsZWN0KCk7XG5cbiAgaWYgKExJRkVDWUNMRV9IT09LUy5zb21lKChob29rTmFtZSkgPT4gcmVmbGVjdC5oYXNMaWZlY3ljbGVIb29rKHR5cGUsIGhvb2tOYW1lKSkpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGNvbnN0IHByb3BNZXRhZGF0YSA9IHJlZmxlY3QucHJvcE1ldGFkYXRhKHR5cGUpO1xuXG4gIGZvciAoY29uc3QgZmllbGQgaW4gcHJvcE1ldGFkYXRhKSB7XG4gICAgY29uc3QgYW5ub3RhdGlvbnMgPSBwcm9wTWV0YWRhdGFbZmllbGRdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbm5vdGF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgY3VycmVudCA9IGFubm90YXRpb25zW2ldO1xuICAgICAgY29uc3QgbWV0YWRhdGFOYW1lID0gY3VycmVudC5uZ01ldGFkYXRhTmFtZTtcblxuICAgICAgaWYgKFxuICAgICAgICBpc0lucHV0QW5ub3RhdGlvbihjdXJyZW50KSB8fFxuICAgICAgICBpc0NvbnRlbnRRdWVyeShjdXJyZW50KSB8fFxuICAgICAgICBpc1ZpZXdRdWVyeShjdXJyZW50KSB8fFxuICAgICAgICBtZXRhZGF0YU5hbWUgPT09ICdPdXRwdXQnIHx8XG4gICAgICAgIG1ldGFkYXRhTmFtZSA9PT0gJ0hvc3RCaW5kaW5nJyB8fFxuICAgICAgICBtZXRhZGF0YU5hbWUgPT09ICdIb3N0TGlzdGVuZXInXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuIl19