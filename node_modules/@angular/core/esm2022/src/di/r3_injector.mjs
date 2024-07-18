/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import '../util/ng_dev_mode';
import { RuntimeError } from '../errors';
import { emitInstanceCreatedByInjectorEvent, emitProviderConfiguredEvent, runInInjectorProfilerContext, setInjectorProfilerContext, } from '../render3/debug/injector_profiler';
import { getFactoryDef } from '../render3/definition_factory';
import { throwCyclicDependencyError, throwInvalidProviderError, throwMixedMultiProviderError, } from '../render3/errors_di';
import { NG_ENV_ID } from '../render3/fields';
import { newArray } from '../util/array_utils';
import { EMPTY_ARRAY } from '../util/empty';
import { stringify } from '../util/stringify';
import { resolveForwardRef } from './forward_ref';
import { ENVIRONMENT_INITIALIZER } from './initializer_token';
import { setInjectImplementation } from './inject_switch';
import { InjectionToken } from './injection_token';
import { catchInjectorError, convertToBitFlags, injectArgs, NG_TEMP_TOKEN_PATH, setCurrentInjector, THROW_IF_NOT_FOUND, ɵɵinject, } from './injector_compatibility';
import { INJECTOR } from './injector_token';
import { getInheritedInjectableDef, getInjectableDef, } from './interface/defs';
import { InjectFlags } from './interface/injector';
import { isEnvironmentProviders, } from './interface/provider';
import { INJECTOR_DEF_TYPES } from './internal_tokens';
import { NullInjector } from './null_injector';
import { isExistingProvider, isFactoryProvider, isTypeProvider, isValueProvider, } from './provider_collection';
import { INJECTOR_SCOPE } from './scope';
import { setActiveConsumer } from '@angular/core/primitives/signals';
/**
 * Marker which indicates that a value has not yet been created from the factory function.
 */
const NOT_YET = {};
/**
 * Marker which indicates that the factory function for a token is in the process of being called.
 *
 * If the injector is asked to inject a token with its value set to CIRCULAR, that indicates
 * injection of a dependency has recursively attempted to inject the original token, and there is
 * a circular dependency among the providers.
 */
const CIRCULAR = {};
/**
 * A lazily initialized NullInjector.
 */
let NULL_INJECTOR = undefined;
export function getNullInjector() {
    if (NULL_INJECTOR === undefined) {
        NULL_INJECTOR = new NullInjector();
    }
    return NULL_INJECTOR;
}
/**
 * An `Injector` that's part of the environment injector hierarchy, which exists outside of the
 * component tree.
 */
export class EnvironmentInjector {
}
export class R3Injector extends EnvironmentInjector {
    /**
     * Flag indicating that this injector was previously destroyed.
     */
    get destroyed() {
        return this._destroyed;
    }
    constructor(providers, parent, source, scopes) {
        super();
        this.parent = parent;
        this.source = source;
        this.scopes = scopes;
        /**
         * Map of tokens to records which contain the instances of those tokens.
         * - `null` value implies that we don't have the record. Used by tree-shakable injectors
         * to prevent further searches.
         */
        this.records = new Map();
        /**
         * Set of values instantiated by this injector which contain `ngOnDestroy` lifecycle hooks.
         */
        this._ngOnDestroyHooks = new Set();
        this._onDestroyHooks = [];
        this._destroyed = false;
        // Start off by creating Records for every provider.
        forEachSingleProvider(providers, (provider) => this.processProvider(provider));
        // Make sure the INJECTOR token provides this injector.
        this.records.set(INJECTOR, makeRecord(undefined, this));
        // And `EnvironmentInjector` if the current injector is supposed to be env-scoped.
        if (scopes.has('environment')) {
            this.records.set(EnvironmentInjector, makeRecord(undefined, this));
        }
        // Detect whether this injector has the APP_ROOT_SCOPE token and thus should provide
        // any injectable scoped to APP_ROOT_SCOPE.
        const record = this.records.get(INJECTOR_SCOPE);
        if (record != null && typeof record.value === 'string') {
            this.scopes.add(record.value);
        }
        this.injectorDefTypes = new Set(this.get(INJECTOR_DEF_TYPES, EMPTY_ARRAY, InjectFlags.Self));
    }
    /**
     * Destroy the injector and release references to every instance or provider associated with it.
     *
     * Also calls the `OnDestroy` lifecycle hooks of every instance that was created for which a
     * hook was found.
     */
    destroy() {
        this.assertNotDestroyed();
        // Set destroyed = true first, in case lifecycle hooks re-enter destroy().
        this._destroyed = true;
        const prevConsumer = setActiveConsumer(null);
        try {
            // Call all the lifecycle hooks.
            for (const service of this._ngOnDestroyHooks) {
                service.ngOnDestroy();
            }
            const onDestroyHooks = this._onDestroyHooks;
            // Reset the _onDestroyHooks array before iterating over it to prevent hooks that unregister
            // themselves from mutating the array during iteration.
            this._onDestroyHooks = [];
            for (const hook of onDestroyHooks) {
                hook();
            }
        }
        finally {
            // Release all references.
            this.records.clear();
            this._ngOnDestroyHooks.clear();
            this.injectorDefTypes.clear();
            setActiveConsumer(prevConsumer);
        }
    }
    onDestroy(callback) {
        this.assertNotDestroyed();
        this._onDestroyHooks.push(callback);
        return () => this.removeOnDestroy(callback);
    }
    runInContext(fn) {
        this.assertNotDestroyed();
        const previousInjector = setCurrentInjector(this);
        const previousInjectImplementation = setInjectImplementation(undefined);
        let prevInjectContext;
        if (ngDevMode) {
            prevInjectContext = setInjectorProfilerContext({ injector: this, token: null });
        }
        try {
            return fn();
        }
        finally {
            setCurrentInjector(previousInjector);
            setInjectImplementation(previousInjectImplementation);
            ngDevMode && setInjectorProfilerContext(prevInjectContext);
        }
    }
    get(token, notFoundValue = THROW_IF_NOT_FOUND, flags = InjectFlags.Default) {
        this.assertNotDestroyed();
        if (token.hasOwnProperty(NG_ENV_ID)) {
            return token[NG_ENV_ID](this);
        }
        flags = convertToBitFlags(flags);
        // Set the injection context.
        let prevInjectContext;
        if (ngDevMode) {
            prevInjectContext = setInjectorProfilerContext({ injector: this, token: token });
        }
        const previousInjector = setCurrentInjector(this);
        const previousInjectImplementation = setInjectImplementation(undefined);
        try {
            // Check for the SkipSelf flag.
            if (!(flags & InjectFlags.SkipSelf)) {
                // SkipSelf isn't set, check if the record belongs to this injector.
                let record = this.records.get(token);
                if (record === undefined) {
                    // No record, but maybe the token is scoped to this injector. Look for an injectable
                    // def with a scope matching this injector.
                    const def = couldBeInjectableType(token) && getInjectableDef(token);
                    if (def && this.injectableDefInScope(def)) {
                        // Found an injectable def and it's scoped to this injector. Pretend as if it was here
                        // all along.
                        if (ngDevMode) {
                            runInInjectorProfilerContext(this, token, () => {
                                emitProviderConfiguredEvent(token);
                            });
                        }
                        record = makeRecord(injectableDefOrInjectorDefFactory(token), NOT_YET);
                    }
                    else {
                        record = null;
                    }
                    this.records.set(token, record);
                }
                // If a record was found, get the instance for it and return it.
                if (record != null /* NOT null || undefined */) {
                    return this.hydrate(token, record);
                }
            }
            // Select the next injector based on the Self flag - if self is set, the next injector is
            // the NullInjector, otherwise it's the parent.
            const nextInjector = !(flags & InjectFlags.Self) ? this.parent : getNullInjector();
            // Set the notFoundValue based on the Optional flag - if optional is set and notFoundValue
            // is undefined, the value is null, otherwise it's the notFoundValue.
            notFoundValue =
                flags & InjectFlags.Optional && notFoundValue === THROW_IF_NOT_FOUND ? null : notFoundValue;
            return nextInjector.get(token, notFoundValue);
        }
        catch (e) {
            if (e.name === 'NullInjectorError') {
                const path = (e[NG_TEMP_TOKEN_PATH] = e[NG_TEMP_TOKEN_PATH] || []);
                path.unshift(stringify(token));
                if (previousInjector) {
                    // We still have a parent injector, keep throwing
                    throw e;
                }
                else {
                    // Format & throw the final error message when we don't have any previous injector
                    return catchInjectorError(e, token, 'R3InjectorError', this.source);
                }
            }
            else {
                throw e;
            }
        }
        finally {
            // Lastly, restore the previous injection context.
            setInjectImplementation(previousInjectImplementation);
            setCurrentInjector(previousInjector);
            ngDevMode && setInjectorProfilerContext(prevInjectContext);
        }
    }
    /** @internal */
    resolveInjectorInitializers() {
        const prevConsumer = setActiveConsumer(null);
        const previousInjector = setCurrentInjector(this);
        const previousInjectImplementation = setInjectImplementation(undefined);
        let prevInjectContext;
        if (ngDevMode) {
            prevInjectContext = setInjectorProfilerContext({ injector: this, token: null });
        }
        try {
            const initializers = this.get(ENVIRONMENT_INITIALIZER, EMPTY_ARRAY, InjectFlags.Self);
            if (ngDevMode && !Array.isArray(initializers)) {
                throw new RuntimeError(-209 /* RuntimeErrorCode.INVALID_MULTI_PROVIDER */, 'Unexpected type of the `ENVIRONMENT_INITIALIZER` token value ' +
                    `(expected an array, but got ${typeof initializers}). ` +
                    'Please check that the `ENVIRONMENT_INITIALIZER` token is configured as a ' +
                    '`multi: true` provider.');
            }
            for (const initializer of initializers) {
                initializer();
            }
        }
        finally {
            setCurrentInjector(previousInjector);
            setInjectImplementation(previousInjectImplementation);
            ngDevMode && setInjectorProfilerContext(prevInjectContext);
            setActiveConsumer(prevConsumer);
        }
    }
    toString() {
        const tokens = [];
        const records = this.records;
        for (const token of records.keys()) {
            tokens.push(stringify(token));
        }
        return `R3Injector[${tokens.join(', ')}]`;
    }
    assertNotDestroyed() {
        if (this._destroyed) {
            throw new RuntimeError(205 /* RuntimeErrorCode.INJECTOR_ALREADY_DESTROYED */, ngDevMode && 'Injector has already been destroyed.');
        }
    }
    /**
     * Process a `SingleProvider` and add it.
     */
    processProvider(provider) {
        // Determine the token from the provider. Either it's its own token, or has a {provide: ...}
        // property.
        provider = resolveForwardRef(provider);
        let token = isTypeProvider(provider)
            ? provider
            : resolveForwardRef(provider && provider.provide);
        // Construct a `Record` for the provider.
        const record = providerToRecord(provider);
        if (ngDevMode) {
            runInInjectorProfilerContext(this, token, () => {
                // Emit InjectorProfilerEventType.Create if provider is a value provider because
                // these are the only providers that do not go through the value hydration logic
                // where this event would normally be emitted from.
                if (isValueProvider(provider)) {
                    emitInstanceCreatedByInjectorEvent(provider.useValue);
                }
                emitProviderConfiguredEvent(provider);
            });
        }
        if (!isTypeProvider(provider) && provider.multi === true) {
            // If the provider indicates that it's a multi-provider, process it specially.
            // First check whether it's been defined already.
            let multiRecord = this.records.get(token);
            if (multiRecord) {
                // It has. Throw a nice error if
                if (ngDevMode && multiRecord.multi === undefined) {
                    throwMixedMultiProviderError();
                }
            }
            else {
                multiRecord = makeRecord(undefined, NOT_YET, true);
                multiRecord.factory = () => injectArgs(multiRecord.multi);
                this.records.set(token, multiRecord);
            }
            token = provider;
            multiRecord.multi.push(provider);
        }
        else {
            if (ngDevMode) {
                const existing = this.records.get(token);
                if (existing && existing.multi !== undefined) {
                    throwMixedMultiProviderError();
                }
            }
        }
        this.records.set(token, record);
    }
    hydrate(token, record) {
        const prevConsumer = setActiveConsumer(null);
        try {
            if (ngDevMode && record.value === CIRCULAR) {
                throwCyclicDependencyError(stringify(token));
            }
            else if (record.value === NOT_YET) {
                record.value = CIRCULAR;
                if (ngDevMode) {
                    runInInjectorProfilerContext(this, token, () => {
                        record.value = record.factory();
                        emitInstanceCreatedByInjectorEvent(record.value);
                    });
                }
                else {
                    record.value = record.factory();
                }
            }
            if (typeof record.value === 'object' && record.value && hasOnDestroy(record.value)) {
                this._ngOnDestroyHooks.add(record.value);
            }
            return record.value;
        }
        finally {
            setActiveConsumer(prevConsumer);
        }
    }
    injectableDefInScope(def) {
        if (!def.providedIn) {
            return false;
        }
        const providedIn = resolveForwardRef(def.providedIn);
        if (typeof providedIn === 'string') {
            return providedIn === 'any' || this.scopes.has(providedIn);
        }
        else {
            return this.injectorDefTypes.has(providedIn);
        }
    }
    removeOnDestroy(callback) {
        const destroyCBIdx = this._onDestroyHooks.indexOf(callback);
        if (destroyCBIdx !== -1) {
            this._onDestroyHooks.splice(destroyCBIdx, 1);
        }
    }
}
function injectableDefOrInjectorDefFactory(token) {
    // Most tokens will have an injectable def directly on them, which specifies a factory directly.
    const injectableDef = getInjectableDef(token);
    const factory = injectableDef !== null ? injectableDef.factory : getFactoryDef(token);
    if (factory !== null) {
        return factory;
    }
    // InjectionTokens should have an injectable def (ɵprov) and thus should be handled above.
    // If it's missing that, it's an error.
    if (token instanceof InjectionToken) {
        throw new RuntimeError(204 /* RuntimeErrorCode.INVALID_INJECTION_TOKEN */, ngDevMode && `Token ${stringify(token)} is missing a ɵprov definition.`);
    }
    // Undecorated types can sometimes be created if they have no constructor arguments.
    if (token instanceof Function) {
        return getUndecoratedInjectableFactory(token);
    }
    // There was no way to resolve a factory for this token.
    throw new RuntimeError(204 /* RuntimeErrorCode.INVALID_INJECTION_TOKEN */, ngDevMode && 'unreachable');
}
function getUndecoratedInjectableFactory(token) {
    // If the token has parameters then it has dependencies that we cannot resolve implicitly.
    const paramLength = token.length;
    if (paramLength > 0) {
        throw new RuntimeError(204 /* RuntimeErrorCode.INVALID_INJECTION_TOKEN */, ngDevMode &&
            `Can't resolve all parameters for ${stringify(token)}: (${newArray(paramLength, '?').join(', ')}).`);
    }
    // The constructor function appears to have no parameters.
    // This might be because it inherits from a super-class. In which case, use an injectable
    // def from an ancestor if there is one.
    // Otherwise this really is a simple class with no dependencies, so return a factory that
    // just instantiates the zero-arg constructor.
    const inheritedInjectableDef = getInheritedInjectableDef(token);
    if (inheritedInjectableDef !== null) {
        return () => inheritedInjectableDef.factory(token);
    }
    else {
        return () => new token();
    }
}
function providerToRecord(provider) {
    if (isValueProvider(provider)) {
        return makeRecord(undefined, provider.useValue);
    }
    else {
        const factory = providerToFactory(provider);
        return makeRecord(factory, NOT_YET);
    }
}
/**
 * Converts a `SingleProvider` into a factory function.
 *
 * @param provider provider to convert to factory
 */
export function providerToFactory(provider, ngModuleType, providers) {
    let factory = undefined;
    if (ngDevMode && isEnvironmentProviders(provider)) {
        throwInvalidProviderError(undefined, providers, provider);
    }
    if (isTypeProvider(provider)) {
        const unwrappedProvider = resolveForwardRef(provider);
        return getFactoryDef(unwrappedProvider) || injectableDefOrInjectorDefFactory(unwrappedProvider);
    }
    else {
        if (isValueProvider(provider)) {
            factory = () => resolveForwardRef(provider.useValue);
        }
        else if (isFactoryProvider(provider)) {
            factory = () => provider.useFactory(...injectArgs(provider.deps || []));
        }
        else if (isExistingProvider(provider)) {
            factory = () => ɵɵinject(resolveForwardRef(provider.useExisting));
        }
        else {
            const classRef = resolveForwardRef(provider &&
                (provider.useClass || provider.provide));
            if (ngDevMode && !classRef) {
                throwInvalidProviderError(ngModuleType, providers, provider);
            }
            if (hasDeps(provider)) {
                factory = () => new classRef(...injectArgs(provider.deps));
            }
            else {
                return getFactoryDef(classRef) || injectableDefOrInjectorDefFactory(classRef);
            }
        }
    }
    return factory;
}
function makeRecord(factory, value, multi = false) {
    return {
        factory: factory,
        value: value,
        multi: multi ? [] : undefined,
    };
}
function hasDeps(value) {
    return !!value.deps;
}
function hasOnDestroy(value) {
    return (value !== null &&
        typeof value === 'object' &&
        typeof value.ngOnDestroy === 'function');
}
function couldBeInjectableType(value) {
    return (typeof value === 'function' || (typeof value === 'object' && value instanceof InjectionToken));
}
function forEachSingleProvider(providers, fn) {
    for (const provider of providers) {
        if (Array.isArray(provider)) {
            forEachSingleProvider(provider, fn);
        }
        else if (provider && isEnvironmentProviders(provider)) {
            forEachSingleProvider(provider.ɵproviders, fn);
        }
        else {
            fn(provider);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfaW5qZWN0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9kaS9yM19pbmplY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLHFCQUFxQixDQUFDO0FBRTdCLE9BQU8sRUFBQyxZQUFZLEVBQW1CLE1BQU0sV0FBVyxDQUFDO0FBR3pELE9BQU8sRUFDTCxrQ0FBa0MsRUFDbEMsMkJBQTJCLEVBRTNCLDRCQUE0QixFQUM1QiwwQkFBMEIsR0FDM0IsTUFBTSxvQ0FBb0MsQ0FBQztBQUM1QyxPQUFPLEVBQVksYUFBYSxFQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDdkUsT0FBTyxFQUNMLDBCQUEwQixFQUMxQix5QkFBeUIsRUFDekIsNEJBQTRCLEdBQzdCLE1BQU0sc0JBQXNCLENBQUM7QUFDOUIsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQzVDLE9BQU8sRUFBQyxRQUFRLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQzFDLE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUU1QyxPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDaEQsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDNUQsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0saUJBQWlCLENBQUM7QUFDeEQsT0FBTyxFQUFDLGNBQWMsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRWpELE9BQU8sRUFDTCxrQkFBa0IsRUFDbEIsaUJBQWlCLEVBQ2pCLFVBQVUsRUFDVixrQkFBa0IsRUFDbEIsa0JBQWtCLEVBQ2xCLGtCQUFrQixFQUNsQixRQUFRLEdBQ1QsTUFBTSwwQkFBMEIsQ0FBQztBQUNsQyxPQUFP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SyxFQUFFLEtBQUs7UUFDWixLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVM7S0FDOUIsQ0FBQztBQUNKLENBQUM7QUFFRCxTQUFTLE9BQU8sQ0FDZCxLQUFnRTtJQUVoRSxPQUFPLENBQUMsQ0FBRSxLQUFhLENBQUMsSUFBSSxDQUFDO0FBQy9CLENBQUM7QUFFRCxTQUFTLFlBQVksQ0FBQyxLQUFVO0lBQzlCLE9BQU8sQ0FDTCxLQUFLLEtBQUssSUFBSTtRQUNkLE9BQU8sS0FBSyxLQUFLLFFBQVE7UUFDekIsT0FBUSxLQUFtQixDQUFDLFdBQVcsS0FBSyxVQUFVLENBQ3ZELENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyxxQkFBcUIsQ0FBQyxLQUFVO0lBQ3ZDLE9BQU8sQ0FDTCxPQUFPLEtBQUssS0FBSyxVQUFVLElBQUksQ0FBQyxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksS0FBSyxZQUFZLGNBQWMsQ0FBQyxDQUM5RixDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQzVCLFNBQWlELEVBQ2pELEVBQXNDO0lBRXRDLEtBQUssTUFBTSxRQUFRLElBQUksU0FBUyxFQUFFLENBQUM7UUFDakMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDNUIscUJBQXFCLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ3RDLENBQUM7YUFBTSxJQUFJLFFBQVEsSUFBSSxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQ3hELHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDakQsQ0FBQzthQUFNLENBQUM7WUFDTixFQUFFLENBQUMsUUFBMEIsQ0FBQyxDQUFDO1FBQ2pDLENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgJy4uL3V0aWwvbmdfZGV2X21vZGUnO1xuXG5pbXBvcnQge1J1bnRpbWVFcnJvciwgUnVudGltZUVycm9yQ29kZX0gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCB7T25EZXN0cm95fSBmcm9tICcuLi9pbnRlcmZhY2UvbGlmZWN5Y2xlX2hvb2tzJztcbmltcG9ydCB7VHlwZX0gZnJvbSAnLi4vaW50ZXJmYWNlL3R5cGUnO1xuaW1wb3J0IHtcbiAgZW1pdEluc3RhbmNlQ3JlYXRlZEJ5SW5qZWN0b3JFdmVudCxcbiAgZW1pdFByb3ZpZGVyQ29uZmlndXJlZEV2ZW50LFxuICBJbmplY3RvclByb2ZpbGVyQ29udGV4dCxcbiAgcnVuSW5JbmplY3RvclByb2ZpbGVyQ29udGV4dCxcbiAgc2V0SW5qZWN0b3JQcm9maWxlckNvbnRleHQsXG59IGZyb20gJy4uL3JlbmRlcjMvZGVidWcvaW5qZWN0b3JfcHJvZmlsZXInO1xuaW1wb3J0IHtGYWN0b3J5Rm4sIGdldEZhY3RvcnlEZWZ9IGZyb20gJy4uL3JlbmRlcjMvZGVmaW5pdGlvbl9mYWN0b3J5JztcbmltcG9ydCB7XG4gIHRocm93Q3ljbGljRGVwZW5kZW5jeUVycm9yLFxuICB0aHJvd0ludmFsaWRQcm92aWRlckVycm9yLFxuICB0aHJvd01peGVkTXVsdGlQcm92aWRlckVycm9yLFxufSBmcm9tICcuLi9yZW5kZXIzL2Vycm9yc19kaSc7XG5pbXBvcnQge05HX0VOVl9JRH0gZnJvbSAnLi4vcmVuZGVyMy9maWVsZHMnO1xuaW1wb3J0IHtuZXdBcnJheX0gZnJvbSAnLi4vdXRpbC9hcnJheV91dGlscyc7XG5pbXBvcnQge0VNUFRZX0FSUkFZfSBmcm9tICcuLi91dGlsL2VtcHR5JztcbmltcG9ydCB7c3RyaW5naWZ5fSBmcm9tICcuLi91dGlsL3N0cmluZ2lmeSc7XG5cbmltcG9ydCB7cmVzb2x2ZUZvcndhcmRSZWZ9IGZyb20gJy4vZm9yd2FyZF9yZWYnO1xuaW1wb3J0IHtFTlZJUk9OTUVOVF9JTklUSUFMSVpFUn0gZnJvbSAnLi9pbml0aWFsaXplcl90b2tlbic7XG5pbXBvcnQge3NldEluamVjdEltcGxlbWVudGF0aW9ufSBmcm9tICcuL2luamVjdF9zd2l0Y2gnO1xuaW1wb3J0IHtJbmplY3Rpb25Ub2tlbn0gZnJvbSAnLi9pbmplY3Rpb25fdG9rZW4nO1xuaW1wb3J0IHR5cGUge0luamVjdG9yfSBmcm9tICcuL2luamVjdG9yJztcbmltcG9ydCB7XG4gIGNhdGNoSW5qZWN0b3JFcnJvcixcbiAgY29udmVydFRvQml0RmxhZ3MsXG4gIGluamVjdEFyZ3MsXG4gIE5HX1RFTVBfVE9LRU5fUEFUSCxcbiAgc2V0Q3VycmVudEluamVjdG9yLFxuICBUSFJPV19JRl9OT1RfRk9VTkQsXG4gIMm1ybVpbmplY3QsXG59IGZyb20gJy4vaW5qZWN0b3JfY29tcGF0aWJpbGl0eSc7XG5pbXBvcnQge0lOSkVDVE9SfSBmcm9tICcuL2luamVjdG9yX3Rva2VuJztcbmltcG9ydCB7XG4gIGdldEluaGVyaXRlZEluamVjdGFibGVEZWYsXG4gIGdldEluamVjdGFibGVEZWYsXG4gIEluamVjdG9yVHlwZSxcbiAgybXJtUluamVjdGFibGVEZWNsYXJhdGlvbixcbn0gZnJvbSAnLi9pbnRlcmZhY2UvZGVmcyc7XG5pbXBvcnQge0luamVjdEZsYWdzLCBJbmplY3RPcHRpb25zfSBmcm9tICcuL2ludGVyZmFjZS9pbmplY3Rvcic7XG5pbXBvcnQge1xuICBDbGFzc1Byb3ZpZGVyLFxuICBDb25zdHJ1Y3RvclByb3ZpZGVyLFxuICBFbnZpcm9ubWVudFByb3ZpZGVycyxcbiAgSW50ZXJuYWxFbnZpcm9ubWVudFByb3ZpZGVycyxcbiAgaXNFbnZpcm9ubWVudFByb3ZpZGVycyxcbiAgUHJvdmlkZXIsXG4gIFN0YXRpY0NsYXNzUHJvdmlkZXIsXG4gIFR5cGVQcm92aWRlcixcbn0gZnJvbSAnLi9pbnRlcmZhY2UvcHJvdmlkZXInO1xuaW1wb3J0IHtJTkpFQ1RPUl9ERUZfVFlQRVN9IGZyb20gJy4vaW50ZXJuYWxfdG9rZW5zJztcbmltcG9ydCB7TnVsbEluamVjdG9yfSBmcm9tICcuL251bGxfaW5qZWN0b3InO1xuaW1wb3J0IHtcbiAgaXNFeGlzdGluZ1Byb3ZpZGVyLFxuICBpc0ZhY3RvcnlQcm92aWRlcixcbiAgaXNUeXBlUHJvdmlkZXIsXG4gIGlzVmFsdWVQcm92aWRlcixcbiAgU2luZ2xlUHJvdmlkZXIsXG59IGZyb20gJy4vcHJvdmlkZXJfY29sbGVjdGlvbic7XG5pbXBvcnQge1Byb3ZpZGVyVG9rZW59IGZyb20gJy4vcHJvdmlkZXJfdG9rZW4nO1xuaW1wb3J0IHtJTkpFQ1RPUl9TQ09QRSwgSW5qZWN0b3JTY29wZX0gZnJvbSAnLi9zY29wZSc7XG5pbXBvcnQge3NldEFjdGl2ZUNvbnN1bWVyfSBmcm9tICdAYW5ndWxhci9jb3JlL3ByaW1pdGl2ZXMvc2lnbmFscyc7XG5cbi8qKlxuICogTWFya2VyIHdoaWNoIGluZGljYXRlcyB0aGF0IGEgdmFsdWUgaGFzIG5vdCB5ZXQgYmVlbiBjcmVhdGVkIGZyb20gdGhlIGZhY3RvcnkgZnVuY3Rpb24uXG4gKi9cbmNvbnN0IE5PVF9ZRVQgPSB7fTtcblxuLyoqXG4gKiBNYXJrZXIgd2hpY2ggaW5kaWNhdGVzIHRoYXQgdGhlIGZhY3RvcnkgZnVuY3Rpb24gZm9yIGEgdG9rZW4gaXMgaW4gdGhlIHByb2Nlc3Mgb2YgYmVpbmcgY2FsbGVkLlxuICpcbiAqIElmIHRoZSBpbmplY3RvciBpcyBhc2tlZCB0byBpbmplY3QgYSB0b2tlbiB3aXRoIGl0cyB2YWx1ZSBzZXQgdG8gQ0lSQ1VMQVIsIHRoYXQgaW5kaWNhdGVzXG4gKiBpbmplY3Rpb24gb2YgYSBkZXBlbmRlbmN5IGhhcyByZWN1cnNpdmVseSBhdHRlbXB0ZWQgdG8gaW5qZWN0IHRoZSBvcmlnaW5hbCB0b2tlbiwgYW5kIHRoZXJlIGlzXG4gKiBhIGNpcmN1bGFyIGRlcGVuZGVuY3kgYW1vbmcgdGhlIHByb3ZpZGVycy5cbiAqL1xuY29uc3QgQ0lSQ1VMQVIgPSB7fTtcblxuLyoqXG4gKiBBIGxhemlseSBpbml0aWFsaXplZCBOdWxsSW5qZWN0b3IuXG4gKi9cbmxldCBOVUxMX0lOSkVDVE9SOiBJbmplY3RvciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldE51bGxJbmplY3RvcigpOiBJbmplY3RvciB7XG4gIGlmIChOVUxMX0lOSkVDVE9SID09PSB1bmRlZmluZWQpIHtcbiAgICBOVUxMX0lOSkVDVE9SID0gbmV3IE51bGxJbmplY3RvcigpO1xuICB9XG4gIHJldHVybiBOVUxMX0lOSkVDVE9SO1xufVxuXG4vKipcbiAqIEFuIGVudHJ5IGluIHRoZSBpbmplY3RvciB3aGljaCB0cmFja3MgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGdpdmVuIHRva2VuLCBpbmNsdWRpbmcgYSBwb3NzaWJsZVxuICogY3VycmVudCB2YWx1ZS5cbiAqL1xuaW50ZXJmYWNlIFJlY29yZDxUPiB7XG4gIGZhY3Rvcnk6ICgoKSA9PiBUKSB8IHVuZGVmaW5lZDtcbiAgdmFsdWU6IFQgfCB7fTtcbiAgbXVsdGk6IGFueVtdIHwgdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIEFuIGBJbmplY3RvcmAgdGhhdCdzIHBhcnQgb2YgdGhlIGVudmlyb25tZW50IGluamVjdG9yIGhpZXJhcmNoeSwgd2hpY2ggZXhpc3RzIG91dHNpZGUgb2YgdGhlXG4gKiBjb21wb25lbnQgdHJlZS5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEVudmlyb25tZW50SW5qZWN0b3IgaW1wbGVtZW50cyBJbmplY3RvciB7XG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgYW4gaW5zdGFuY2UgZnJvbSB0aGUgaW5qZWN0b3IgYmFzZWQgb24gdGhlIHByb3ZpZGVkIHRva2VuLlxuICAgKiBAcmV0dXJucyBUaGUgaW5zdGFuY2UgZnJvbSB0aGUgaW5qZWN0b3IgaWYgZGVmaW5lZCwgb3RoZXJ3aXNlIHRoZSBgbm90Rm91bmRWYWx1ZWAuXG4gICAqIEB0aHJvd3MgV2hlbiB0aGUgYG5vdEZvdW5kVmFsdWVgIGlzIGB1bmRlZmluZWRgIG9yIGBJbmplY3Rvci5USFJPV19JRl9OT1RfRk9VTkRgLlxuICAgKi9cbiAgYWJzdHJhY3QgZ2V0PFQ+KFxuICAgIHRva2VuOiBQcm92aWRlclRva2VuPFQ+LFxuICAgIG5vdEZvdW5kVmFsdWU6IHVuZGVmaW5lZCxcbiAgICBvcHRpb25zOiBJbmplY3RPcHRpb25zICYge1xuICAgICAgb3B0aW9uYWw/OiBmYWxzZTtcbiAgICB9LFxuICApOiBUO1xuICAvKipcbiAgICogUmV0cmlldmVzIGFuIGluc3RhbmNlIGZyb20gdGhlIGluamVjdG9yIGJhc2VkIG9uIHRoZSBwcm92aWRlZCB0b2tlbi5cbiAgICogQHJldHVybnMgVGhlIGluc3RhbmNlIGZyb20gdGhlIGluamVjdG9yIGlmIGRlZmluZWQsIG90aGVyd2lzZSB0aGUgYG5vdEZvdW5kVmFsdWVgLlxuICAgKiBAdGhyb3dzIFdoZW4gdGhlIGBub3RGb3VuZFZhbHVlYCBpcyBgdW5kZWZpbmVkYCBvciBgSW5qZWN0b3IuVEhST1dfSUZfTk9UX0ZPVU5EYC5cbiAgICovXG4gIGFic3RyYWN0IGdldDxUPihcbiAgICB0b2tlbjogUHJvdmlkZXJUb2tlbjxUPixcbiAgICBub3RGb3VuZFZhbHVlOiBudWxsIHwgdW5kZWZpbmVkLFxuICAgIG9wdGlvbnM6IEluamVjdE9wdGlvbnMsXG4gICk6IFQgfCBudWxsO1xuICAvKipcbiAgICogUmV0cmlldmVzIGFuIGluc3RhbmNlIGZyb20gdGhlIGluamVjdG9yIGJhc2VkIG9uIHRoZSBwcm92aWRlZCB0b2tlbi5cbiAgICogQHJldHVybnMgVGhlIGluc3RhbmNlIGZyb20gdGhlIGluamVjdG9yIGlmIGRlZmluZWQsIG90aGVyd2lzZSB0aGUgYG5vdEZvdW5kVmFsdWVgLlxuICAgKiBAdGhyb3dzIFdoZW4gdGhlIGBub3RGb3VuZFZhbHVlYCBpcyBgdW5kZWZpbmVkYCBvciBgSW5qZWN0b3IuVEhST1dfSUZfTk9UX0ZPVU5EYC5cbiAgICovXG4gIGFic3RyYWN0IGdldDxUPih0b2tlbjogUHJvdmlkZXJUb2tlbjxUPiwgbm90Rm91bmRWYWx1ZT86IFQsIG9wdGlvbnM/OiBJbmplY3RPcHRpb25zKTogVDtcbiAgLyoqXG4gICAqIFJldHJpZXZlcyBhbiBpbnN0YW5jZSBmcm9tIHRoZSBpbmplY3RvciBiYXNlZCBvbiB0aGUgcHJvdmlkZWQgdG9rZW4uXG4gICAqIEByZXR1cm5zIFRoZSBpbnN0YW5jZSBmcm9tIHRoZSBpbmplY3RvciBpZiBkZWZpbmVkLCBvdGhlcndpc2UgdGhlIGBub3RGb3VuZFZhbHVlYC5cbiAgICogQHRocm93cyBXaGVuIHRoZSBgbm90Rm91bmRWYWx1ZWAgaXMgYHVuZGVmaW5lZGAgb3IgYEluamVjdG9yLlRIUk9XX0lGX05PVF9GT1VORGAuXG4gICAqIEBkZXByZWNhdGVkIHVzZSBvYmplY3QtYmFzZWQgZmxhZ3MgKGBJbmplY3RPcHRpb25zYCkgaW5zdGVhZC5cbiAgICovXG4gIGFic3RyYWN0IGdldDxUPih0b2tlbjogUHJvdmlkZXJUb2tlbjxUPiwgbm90Rm91bmRWYWx1ZT86IFQsIGZsYWdzPzogSW5qZWN0RmxhZ3MpOiBUO1xuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgZnJvbSB2NC4wLjAgdXNlIFByb3ZpZGVyVG9rZW48VD5cbiAgICogQHN1cHByZXNzIHtkdXBsaWNhdGV9XG4gICAqL1xuICBhYnN0cmFjdCBnZXQodG9rZW46IGFueSwgbm90Rm91bmRWYWx1ZT86IGFueSk6IGFueTtcblxuICAvKipcbiAgICogUnVucyB0aGUgZ2l2ZW4gZnVuY3Rpb24gaW4gdGhlIGNvbnRleHQgb2YgdGhpcyBgRW52aXJvbm1lbnRJbmplY3RvcmAuXG4gICAqXG4gICAqIFdpdGhpbiB0aGUgZnVuY3Rpb24ncyBzdGFjayBmcmFtZSwgW2BpbmplY3RgXShhcGkvY29yZS9pbmplY3QpIGNhbiBiZSB1c2VkIHRvIGluamVjdFxuICAgKiBkZXBlbmRlbmNpZXMgZnJvbSB0aGlzIGluamVjdG9yLiBOb3RlIHRoYXQgYGluamVjdGAgaXMgb25seSB1c2FibGUgc3luY2hyb25vdXNseSwgYW5kIGNhbm5vdCBiZVxuICAgKiB1c2VkIGluIGFueSBhc3luY2hyb25vdXMgY2FsbGJhY2tzIG9yIGFmdGVyIGFueSBgYXdhaXRgIHBvaW50cy5cbiAgICpcbiAgICogQHBhcmFtIGZuIHRoZSBjbG9zdXJlIHRvIGJlIHJ1biBpbiB0aGUgY29udGV4dCBvZiB0aGlzIGluamVjdG9yXG4gICAqIEByZXR1cm5zIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZ1bmN0aW9uLCBpZiBhbnlcbiAgICogQGRlcHJlY2F0ZWQgdXNlIHRoZSBzdGFuZGFsb25lIGZ1bmN0aW9uIGBydW5JbkluamVjdGlvbkNvbnRleHRgIGluc3RlYWRcbiAgICovXG4gIGFic3RyYWN0IHJ1bkluQ29udGV4dDxSZXR1cm5UPihmbjogKCkgPT4gUmV0dXJuVCk6IFJldHVyblQ7XG5cbiAgYWJzdHJhY3QgZGVzdHJveSgpOiB2b2lkO1xuXG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGFic3RyYWN0IG9uRGVzdHJveShjYWxsYmFjazogKCkgPT4gdm9pZCk6ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBSM0luamVjdG9yIGV4dGVuZHMgRW52aXJvbm1lbnRJbmplY3RvciB7XG4gIC8qKlxuICAgKiBNYXAgb2YgdG9rZW5zIHRvIHJlY29yZHMgd2hpY2ggY29udGFpbiB0aGUgaW5zdGFuY2VzIG9mIHRob3NlIHRva2Vucy5cbiAgICogLSBgbnVsbGAgdmFsdWUgaW1wbGllcyB0aGF0IHdlIGRvbid0IGhhdmUgdGhlIHJlY29yZC4gVXNlZCBieSB0cmVlLXNoYWthYmxlIGluamVjdG9yc1xuICAgKiB0byBwcmV2ZW50IGZ1cnRoZXIgc2VhcmNoZXMuXG4gICAqL1xuICBwcml2YXRlIHJlY29yZHMgPSBuZXcgTWFwPFByb3ZpZGVyVG9rZW48YW55PiwgUmVjb3JkPGFueT4gfCBudWxsPigpO1xuXG4gIC8qKlxuICAgKiBTZXQgb2YgdmFsdWVzIGluc3RhbnRpYXRlZCBieSB0aGlzIGluamVjdG9yIHdoaWNoIGNvbnRhaW4gYG5nT25EZXN0cm95YCBsaWZlY3ljbGUgaG9va3MuXG4gICAqL1xuICBwcml2YXRlIF9uZ09uRGVzdHJveUhvb2tzID0gbmV3IFNldDxPbkRlc3Ryb3k+KCk7XG5cbiAgcHJpdmF0ZSBfb25EZXN0cm95SG9va3M6IEFycmF5PCgpID0+IHZvaWQ+ID0gW107XG5cbiAgLyoqXG4gICAqIEZsYWcgaW5kaWNhdGluZyB0aGF0IHRoaXMgaW5qZWN0b3Igd2FzIHByZXZpb3VzbHkgZGVzdHJveWVkLlxuICAgKi9cbiAgZ2V0IGRlc3Ryb3llZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5fZGVzdHJveWVkO1xuICB9XG4gIHByaXZhdGUgX2Rlc3Ryb3llZCA9IGZhbHNlO1xuXG4gIHByaXZhdGUgaW5qZWN0b3JEZWZUeXBlczogU2V0PFR5cGU8dW5rbm93bj4+O1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3ZpZGVyczogQXJyYXk8UHJvdmlkZXIgfCBFbnZpcm9ubWVudFByb3ZpZGVycz4sXG4gICAgcmVhZG9ubHkgcGFyZW50OiBJbmplY3RvcixcbiAgICByZWFkb25seSBzb3VyY2U6IHN0cmluZyB8IG51bGwsXG4gICAgcmVhZG9ubHkgc2NvcGVzOiBTZXQ8SW5qZWN0b3JTY29wZT4sXG4gICkge1xuICAgIHN1cGVyKCk7XG4gICAgLy8gU3RhcnQgb2ZmIGJ5IGNyZWF0aW5nIFJlY29yZHMgZm9yIGV2ZXJ5IHByb3ZpZGVyLlxuICAgIGZvckVhY2hTaW5nbGVQcm92aWRlcihwcm92aWRlcnMgYXMgQXJyYXk8UHJvdmlkZXIgfCBJbnRlcm5hbEVudmlyb25tZW50UHJvdmlkZXJzPiwgKHByb3ZpZGVyKSA9PlxuICAgICAgdGhpcy5wcm9jZXNzUHJvdmlkZXIocHJvdmlkZXIpLFxuICAgICk7XG5cbiAgICAvLyBNYWtlIHN1cmUgdGhlIElOSkVDVE9SIHRva2VuIHByb3ZpZGVzIHRoaXMgaW5qZWN0b3IuXG4gICAgdGhpcy5yZWNvcmRzLnNldChJTkpFQ1RPUiwgbWFrZVJlY29yZCh1bmRlZmluZWQsIHRoaXMpKTtcblxuICAgIC8vIEFuZCBgRW52aXJvbm1lbnRJbmplY3RvcmAgaWYgdGhlIGN1cnJlbnQgaW5qZWN0b3IgaXMgc3VwcG9zZWQgdG8gYmUgZW52LXNjb3BlZC5cbiAgICBpZiAoc2NvcGVzLmhhcygnZW52aXJvbm1lbnQnKSkge1xuICAgICAgdGhpcy5yZWNvcmRzLnNldChFbnZpcm9ubWVudEluamVjdG9yLCBtYWtlUmVjb3JkKHVuZGVmaW5lZCwgdGhpcykpO1xuICAgIH1cblxuICAgIC8vIERldGVjdCB3aGV0aGVyIHRoaXMgaW5qZWN0b3IgaGFzIHRoZSBBUFBfUk9PVF9TQ09QRSB0b2tlbiBhbmQgdGh1cyBzaG91bGQgcHJvdmlkZVxuICAgIC8vIGFueSBpbmplY3RhYmxlIHNjb3BlZCB0byBBUFBfUk9PVF9TQ09QRS5cbiAgICBjb25zdCByZWNvcmQgPSB0aGlzLnJlY29yZHMuZ2V0KElOSkVDVE9SX1NDT1BFKSBhcyBSZWNvcmQ8SW5qZWN0b3JTY29wZSB8IG51bGw+O1xuICAgIGlmIChyZWNvcmQgIT0gbnVsbCAmJiB0eXBlb2YgcmVjb3JkLnZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5zY29wZXMuYWRkKHJlY29yZC52YWx1ZSBhcyBJbmplY3RvclNjb3BlKTtcbiAgICB9XG5cbiAgICB0aGlzLmluamVjdG9yRGVmVHlwZXMgPSBuZXcgU2V0KHRoaXMuZ2V0KElOSkVDVE9SX0RFRl9UWVBFUywgRU1QVFlfQVJSQVksIEluamVjdEZsYWdzLlNlbGYpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXN0cm95IHRoZSBpbmplY3RvciBhbmQgcmVsZWFzZSByZWZlcmVuY2VzIHRvIGV2ZXJ5IGluc3RhbmNlIG9yIHByb3ZpZGVyIGFzc29jaWF0ZWQgd2l0aCBpdC5cbiAgICpcbiAgICogQWxzbyBjYWxscyB0aGUgYE9uRGVzdHJveWAgbGlmZWN5Y2xlIGhvb2tzIG9mIGV2ZXJ5IGluc3RhbmNlIHRoYXQgd2FzIGNyZWF0ZWQgZm9yIHdoaWNoIGFcbiAgICogaG9vayB3YXMgZm91bmQuXG4gICAqL1xuICBvdmVycmlkZSBkZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuYXNzZXJ0Tm90RGVzdHJveWVkKCk7XG5cbiAgICAvLyBTZXQgZGVzdHJveWVkID0gdHJ1ZSBmaXJzdCwgaW4gY2FzZSBsaWZlY3ljbGUgaG9va3MgcmUtZW50ZXIgZGVzdHJveSgpLlxuICAgIHRoaXMuX2Rlc3Ryb3llZCA9IHRydWU7XG4gICAgY29uc3QgcHJldkNvbnN1bWVyID0gc2V0QWN0aXZlQ29uc3VtZXIobnVsbCk7XG4gICAgdHJ5IHtcbiAgICAgIC8vIENhbGwgYWxsIHRoZSBsaWZlY3ljbGUgaG9va3MuXG4gICAgICBmb3IgKGNvbnN0IHNlcnZpY2Ugb2YgdGhpcy5fbmdPbkRlc3Ryb3lIb29rcykge1xuICAgICAgICBzZXJ2aWNlLm5nT25EZXN0cm95KCk7XG4gICAgICB9XG4gICAgICBjb25zdCBvbkRlc3Ryb3lIb29rcyA9IHRoaXMuX29uRGVzdHJveUhvb2tzO1xuICAgICAgLy8gUmVzZXQgdGhlIF9vbkRlc3Ryb3lIb29rcyBhcnJheSBiZWZvcmUgaXRlcmF0aW5nIG92ZXIgaXQgdG8gcHJldmVudCBob29rcyB0aGF0IHVucmVnaXN0ZXJcbiAgICAgIC8vIHRoZW1zZWx2ZXMgZnJvbSBtdXRhdGluZyB0aGUgYXJyYXkgZHVyaW5nIGl0ZXJhdGlvbi5cbiAgICAgIHRoaXMuX29uRGVzdHJveUhvb2tzID0gW107XG4gICAgICBmb3IgKGNvbnN0IGhvb2sgb2Ygb25EZXN0cm95SG9va3MpIHtcbiAgICAgICAgaG9vaygpO1xuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICAvLyBSZWxlYXNlIGFsbCByZWZlcmVuY2VzLlxuICAgICAgdGhpcy5yZWNvcmRzLmNsZWFyKCk7XG4gICAgICB0aGlzLl9uZ09uRGVzdHJveUhvb2tzLmNsZWFyKCk7XG4gICAgICB0aGlzLmluamVjdG9yRGVmVHlwZXMuY2xlYXIoKTtcbiAgICAgIHNldEFjdGl2ZUNvbnN1bWVyKHByZXZDb25zdW1lcik7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgb25EZXN0cm95KGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5hc3NlcnROb3REZXN0cm95ZWQoKTtcbiAgICB0aGlzLl9vbkRlc3Ryb3lIb29rcy5wdXNoKGNhbGxiYWNrKTtcbiAgICByZXR1cm4gKCkgPT4gdGhpcy5yZW1vdmVPbkRlc3Ryb3koY2FsbGJhY2spO1xuICB9XG5cbiAgb3ZlcnJpZGUgcnVuSW5Db250ZXh0PFJldHVyblQ+KGZuOiAoKSA9PiBSZXR1cm5UKTogUmV0dXJuVCB7XG4gICAgdGhpcy5hc3NlcnROb3REZXN0cm95ZWQoKTtcblxuICAgIGNvbnN0IHByZXZpb3VzSW5qZWN0b3IgPSBzZXRDdXJyZW50SW5qZWN0b3IodGhpcyk7XG4gICAgY29uc3QgcHJldmlvdXNJbmplY3RJbXBsZW1lbnRhdGlvbiA9IHNldEluamVjdEltcGxlbWVudGF0aW9uKHVuZGVmaW5lZCk7XG5cbiAgICBsZXQgcHJldkluamVjdENvbnRleHQ6IEluamVjdG9yUHJvZmlsZXJDb250ZXh0IHwgdW5kZWZpbmVkO1xuICAgIGlmIChuZ0Rldk1vZGUpIHtcbiAgICAgIHByZXZJbmplY3RDb250ZXh0ID0gc2V0SW5qZWN0b3JQcm9maWxlckNvbnRleHQoe2luamVjdG9yOiB0aGlzLCB0b2tlbjogbnVsbH0pO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICByZXR1cm4gZm4oKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0Q3VycmVudEluamVjdG9yKHByZXZpb3VzSW5qZWN0b3IpO1xuICAgICAgc2V0SW5qZWN0SW1wbGVtZW50YXRpb24ocHJldmlvdXNJbmplY3RJbXBsZW1lbnRhdGlvbik7XG4gICAgICBuZ0Rldk1vZGUgJiYgc2V0SW5qZWN0b3JQcm9maWxlckNvbnRleHQocHJldkluamVjdENvbnRleHQhKTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBnZXQ8VD4oXG4gICAgdG9rZW46IFByb3ZpZGVyVG9rZW48VD4sXG4gICAgbm90Rm91bmRWYWx1ZTogYW55ID0gVEhST1dfSUZfTk9UX0ZPVU5ELFxuICAgIGZsYWdzOiBJbmplY3RGbGFncyB8IEluamVjdE9wdGlvbnMgPSBJbmplY3RGbGFncy5EZWZhdWx0LFxuICApOiBUIHtcbiAgICB0aGlzLmFzc2VydE5vdERlc3Ryb3llZCgpO1xuXG4gICAgaWYgKHRva2VuLmhhc093blByb3BlcnR5KE5HX0VOVl9JRCkpIHtcbiAgICAgIHJldHVybiAodG9rZW4gYXMgYW55KVtOR19FTlZfSURdKHRoaXMpO1xuICAgIH1cblxuICAgIGZsYWdzID0gY29udmVydFRvQml0RmxhZ3MoZmxhZ3MpIGFzIEluamVjdEZsYWdzO1xuXG4gICAgLy8gU2V0IHRoZSBpbmplY3Rpb24gY29udGV4dC5cbiAgICBsZXQgcHJldkluamVjdENvbnRleHQ6IEluamVjdG9yUHJvZmlsZXJDb250ZXh0O1xuICAgIGlmIChuZ0Rldk1vZGUpIHtcbiAgICAgIHByZXZJbmplY3RDb250ZXh0ID0gc2V0SW5qZWN0b3JQcm9maWxlckNvbnRleHQoe2luamVjdG9yOiB0aGlzLCB0b2tlbjogdG9rZW4gYXMgVHlwZTxUPn0pO1xuICAgIH1cbiAgICBjb25zdCBwcmV2aW91c0luamVjdG9yID0gc2V0Q3VycmVudEluamVjdG9yKHRoaXMpO1xuICAgIGNvbnN0IHByZXZpb3VzSW5qZWN0SW1wbGVtZW50YXRpb24gPSBzZXRJbmplY3RJbXBsZW1lbnRhdGlvbih1bmRlZmluZWQpO1xuICAgIHRyeSB7XG4gICAgICAvLyBDaGVjayBmb3IgdGhlIFNraXBTZWxmIGZsYWcuXG4gICAgICBpZiAoIShmbGFncyAmIEluamVjdEZsYWdzLlNraXBTZWxmKSkge1xuICAgICAgICAvLyBTa2lwU2VsZiBpc24ndCBzZXQsIGNoZWNrIGlmIHRoZSByZWNvcmQgYmVsb25ncyB0byB0aGlzIGluamVjdG9yLlxuICAgICAgICBsZXQgcmVjb3JkOiBSZWNvcmQ8VD4gfCB1bmRlZmluZWQgfCBudWxsID0gdGhpcy5yZWNvcmRzLmdldCh0b2tlbik7XG4gICAgICAgIGlmIChyZWNvcmQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIE5vIHJlY29yZCwgYnV0IG1heWJlIHRoZSB0b2tlbiBpcyBzY29wZWQgdG8gdGhpcyBpbmplY3Rvci4gTG9vayBmb3IgYW4gaW5qZWN0YWJsZVxuICAgICAgICAgIC8vIGRlZiB3aXRoIGEgc2NvcGUgbWF0Y2hpbmcgdGhpcyBpbmplY3Rvci5cbiAgICAgICAgICBjb25zdCBkZWYgPSBjb3VsZEJlSW5qZWN0YWJsZVR5cGUodG9rZW4pICYmIGdldEluamVjdGFibGVEZWYodG9rZW4pO1xuICAgICAgICAgIGlmIChkZWYgJiYgdGhpcy5pbmplY3RhYmxlRGVmSW5TY29wZShkZWYpKSB7XG4gICAgICAgICAgICAvLyBGb3VuZCBhbiBpbmplY3RhYmxlIGRlZiBhbmQgaXQncyBzY29wZWQgdG8gdGhpcyBpbmplY3Rvci4gUHJldGVuZCBhcyBpZiBpdCB3YXMgaGVyZVxuICAgICAgICAgICAgLy8gYWxsIGFsb25nLlxuXG4gICAgICAgICAgICBpZiAobmdEZXZNb2RlKSB7XG4gICAgICAgICAgICAgIHJ1bkluSW5qZWN0b3JQcm9maWxlckNvbnRleHQodGhpcywgdG9rZW4gYXMgVHlwZTxUPiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGVtaXRQcm92aWRlckNvbmZpZ3VyZWRFdmVudCh0b2tlbiBhcyBUeXBlUHJvdmlkZXIpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmVjb3JkID0gbWFrZVJlY29yZChpbmplY3RhYmxlRGVmT3JJbmplY3RvckRlZkZhY3RvcnkodG9rZW4pLCBOT1RfWUVUKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVjb3JkID0gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5yZWNvcmRzLnNldCh0b2tlbiwgcmVjb3JkKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBJZiBhIHJlY29yZCB3YXMgZm91bmQsIGdldCB0aGUgaW5zdGFuY2UgZm9yIGl0IGFuZCByZXR1cm4gaXQuXG4gICAgICAgIGlmIChyZWNvcmQgIT0gbnVsbCAvKiBOT1QgbnVsbCB8fCB1bmRlZmluZWQgKi8pIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5oeWRyYXRlKHRva2VuLCByZWNvcmQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFNlbGVjdCB0aGUgbmV4dCBpbmplY3RvciBiYXNlZCBvbiB0aGUgU2VsZiBmbGFnIC0gaWYgc2VsZiBpcyBzZXQsIHRoZSBuZXh0IGluamVjdG9yIGlzXG4gICAgICAvLyB0aGUgTnVsbEluamVjdG9yLCBvdGhlcndpc2UgaXQncyB0aGUgcGFyZW50LlxuICAgICAgY29uc3QgbmV4dEluamVjdG9yID0gIShmbGFncyAmIEluamVjdEZsYWdzLlNlbGYpID8gdGhpcy5wYXJlbnQgOiBnZXROdWxsSW5qZWN0b3IoKTtcbiAgICAgIC8vIFNldCB0aGUgbm90Rm91bmRWYWx1ZSBiYXNlZCBvbiB0aGUgT3B0aW9uYWwgZmxhZyAtIGlmIG9wdGlvbmFsIGlzIHNldCBhbmQgbm90Rm91bmRWYWx1ZVxuICAgICAgLy8gaXMgdW5kZWZpbmVkLCB0aGUgdmFsdWUgaXMgbnVsbCwgb3RoZXJ3aXNlIGl0J3MgdGhlIG5vdEZvdW5kVmFsdWUuXG4gICAgICBub3RGb3VuZFZhbHVlID1cbiAgICAgICAgZmxhZ3MgJiBJbmplY3RGbGFncy5PcHRpb25hbCAmJiBub3RGb3VuZFZhbHVlID09PSBUSFJPV19JRl9OT1RfRk9VTkQgPyBudWxsIDogbm90Rm91bmRWYWx1ZTtcbiAgICAgIHJldHVybiBuZXh0SW5qZWN0b3IuZ2V0KHRva2VuLCBub3RGb3VuZFZhbHVlKTtcbiAgICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICAgIGlmIChlLm5hbWUgPT09ICdOdWxsSW5qZWN0b3JFcnJvcicpIHtcbiAgICAgICAgY29uc3QgcGF0aDogYW55W10gPSAoZVtOR19URU1QX1RPS0VOX1BBVEhdID0gZVtOR19URU1QX1RPS0VOX1BBVEhdIHx8IFtdKTtcbiAgICAgICAgcGF0aC51bnNoaWZ0KHN0cmluZ2lmeSh0b2tlbikpO1xuICAgICAgICBpZiAocHJldmlvdXNJbmplY3Rvcikge1xuICAgICAgICAgIC8vIFdlIHN0aWxsIGhhdmUgYSBwYXJlbnQgaW5qZWN0b3IsIGtlZXAgdGhyb3dpbmdcbiAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEZvcm1hdCAmIHRocm93IHRoZSBmaW5hbCBlcnJvciBtZXNzYWdlIHdoZW4gd2UgZG9uJ3QgaGF2ZSBhbnkgcHJldmlvdXMgaW5qZWN0b3JcbiAgICAgICAgICByZXR1cm4gY2F0Y2hJbmplY3RvckVycm9yKGUsIHRva2VuLCAnUjNJbmplY3RvckVycm9yJywgdGhpcy5zb3VyY2UpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICAvLyBMYXN0bHksIHJlc3RvcmUgdGhlIHByZXZpb3VzIGluamVjdGlvbiBjb250ZXh0LlxuICAgICAgc2V0SW5qZWN0SW1wbGVtZW50YXRpb24ocHJldmlvdXNJbmplY3RJbXBsZW1lbnRhdGlvbik7XG4gICAgICBzZXRDdXJyZW50SW5qZWN0b3IocHJldmlvdXNJbmplY3Rvcik7XG4gICAgICBuZ0Rldk1vZGUgJiYgc2V0SW5qZWN0b3JQcm9maWxlckNvbnRleHQocHJldkluamVjdENvbnRleHQhKTtcbiAgICB9XG4gIH1cblxuICAvKiogQGludGVybmFsICovXG4gIHJlc29sdmVJbmplY3RvckluaXRpYWxpemVycygpIHtcbiAgICBjb25zdCBwcmV2Q29uc3VtZXIgPSBzZXRBY3RpdmVDb25zdW1lcihudWxsKTtcbiAgICBjb25zdCBwcmV2aW91c0luamVjdG9yID0gc2V0Q3VycmVudEluamVjdG9yKHRoaXMpO1xuICAgIGNvbnN0IHByZXZpb3VzSW5qZWN0SW1wbGVtZW50YXRpb24gPSBzZXRJbmplY3RJbXBsZW1lbnRhdGlvbih1bmRlZmluZWQpO1xuICAgIGxldCBwcmV2SW5qZWN0Q29udGV4dDogSW5qZWN0b3JQcm9maWxlckNvbnRleHQgfCB1bmRlZmluZWQ7XG4gICAgaWYgKG5nRGV2TW9kZSkge1xuICAgICAgcHJldkluamVjdENvbnRleHQgPSBzZXRJbmplY3RvclByb2ZpbGVyQ29udGV4dCh7aW5qZWN0b3I6IHRoaXMsIHRva2VuOiBudWxsfSk7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGluaXRpYWxpemVycyA9IHRoaXMuZ2V0KEVOVklST05NRU5UX0lOSVRJQUxJWkVSLCBFTVBUWV9BUlJBWSwgSW5qZWN0RmxhZ3MuU2VsZik7XG4gICAgICBpZiAobmdEZXZNb2RlICYmICFBcnJheS5pc0FycmF5KGluaXRpYWxpemVycykpIHtcbiAgICAgICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgICBSdW50aW1lRXJyb3JDb2RlLklOVkFMSURfTVVMVElfUFJPVklERVIsXG4gICAgICAgICAgJ1VuZXhwZWN0ZWQgdHlwZSBvZiB0aGUgYEVOVklST05NRU5UX0lOSVRJQUxJWkVSYCB0b2tlbiB2YWx1ZSAnICtcbiAgICAgICAgICAgIGAoZXhwZWN0ZWQgYW4gYXJyYXksIGJ1dCBnb3QgJHt0eXBlb2YgaW5pdGlhbGl6ZXJzfSkuIGAgK1xuICAgICAgICAgICAgJ1BsZWFzZSBjaGVjayB0aGF0IHRoZSBgRU5WSVJPTk1FTlRfSU5JVElBTElaRVJgIHRva2VuIGlzIGNvbmZpZ3VyZWQgYXMgYSAnICtcbiAgICAgICAgICAgICdgbXVsdGk6IHRydWVgIHByb3ZpZGVyLicsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGluaXRpYWxpemVyIG9mIGluaXRpYWxpemVycykge1xuICAgICAgICBpbml0aWFsaXplcigpO1xuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRDdXJyZW50SW5qZWN0b3IocHJldmlvdXNJbmplY3Rvcik7XG4gICAgICBzZXRJbmplY3RJbXBsZW1lbnRhdGlvbihwcmV2aW91c0luamVjdEltcGxlbWVudGF0aW9uKTtcbiAgICAgIG5nRGV2TW9kZSAmJiBzZXRJbmplY3RvclByb2ZpbGVyQ29udGV4dChwcmV2SW5qZWN0Q29udGV4dCEpO1xuICAgICAgc2V0QWN0aXZlQ29uc3VtZXIocHJldkNvbnN1bWVyKTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSB0b1N0cmluZygpIHtcbiAgICBjb25zdCB0b2tlbnM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgcmVjb3JkcyA9IHRoaXMucmVjb3JkcztcbiAgICBmb3IgKGNvbnN0IHRva2VuIG9mIHJlY29yZHMua2V5cygpKSB7XG4gICAgICB0b2tlbnMucHVzaChzdHJpbmdpZnkodG9rZW4pKTtcbiAgICB9XG4gICAgcmV0dXJuIGBSM0luamVjdG9yWyR7dG9rZW5zLmpvaW4oJywgJyl9XWA7XG4gIH1cblxuICBhc3NlcnROb3REZXN0cm95ZWQoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2Rlc3Ryb3llZCkge1xuICAgICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgUnVudGltZUVycm9yQ29kZS5JTkpFQ1RPUl9BTFJFQURZX0RFU1RST1lFRCxcbiAgICAgICAgbmdEZXZNb2RlICYmICdJbmplY3RvciBoYXMgYWxyZWFkeSBiZWVuIGRlc3Ryb3llZC4nLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyBhIGBTaW5nbGVQcm92aWRlcmAgYW5kIGFkZCBpdC5cbiAgICovXG4gIHByaXZhdGUgcHJvY2Vzc1Byb3ZpZGVyKHByb3ZpZGVyOiBTaW5nbGVQcm92aWRlcik6IHZvaWQge1xuICAgIC8vIERldGVybWluZSB0aGUgdG9rZW4gZnJvbSB0aGUgcHJvdmlkZXIuIEVpdGhlciBpdCdzIGl0cyBvd24gdG9rZW4sIG9yIGhhcyBhIHtwcm92aWRlOiAuLi59XG4gICAgLy8gcHJvcGVydHkuXG4gICAgcHJvdmlkZXIgPSByZXNvbHZlRm9yd2FyZFJlZihwcm92aWRlcik7XG4gICAgbGV0IHRva2VuOiBhbnkgPSBpc1R5cGVQcm92aWRlcihwcm92aWRlcilcbiAgICAgID8gcHJvdmlkZXJcbiAgICAgIDogcmVzb2x2ZUZvcndhcmRSZWYocHJvdmlkZXIgJiYgcHJvdmlkZXIucHJvdmlkZSk7XG5cbiAgICAvLyBDb25zdHJ1Y3QgYSBgUmVjb3JkYCBmb3IgdGhlIHByb3ZpZGVyLlxuICAgIGNvbnN0IHJlY29yZCA9IHByb3ZpZGVyVG9SZWNvcmQocHJvdmlkZXIpO1xuICAgIGlmIChuZ0Rldk1vZGUpIHtcbiAgICAgIHJ1bkluSW5qZWN0b3JQcm9maWxlckNvbnRleHQodGhpcywgdG9rZW4sICgpID0+IHtcbiAgICAgICAgLy8gRW1pdCBJbmplY3RvclByb2ZpbGVyRXZlbnRUeXBlLkNyZWF0ZSBpZiBwcm92aWRlciBpcyBhIHZhbHVlIHByb3ZpZGVyIGJlY2F1c2VcbiAgICAgICAgLy8gdGhlc2UgYXJlIHRoZSBvbmx5IHByb3ZpZGVycyB0aGF0IGRvIG5vdCBnbyB0aHJvdWdoIHRoZSB2YWx1ZSBoeWRyYXRpb24gbG9naWNcbiAgICAgICAgLy8gd2hlcmUgdGhpcyBldmVudCB3b3VsZCBub3JtYWxseSBiZSBlbWl0dGVkIGZyb20uXG4gICAgICAgIGlmIChpc1ZhbHVlUHJvdmlkZXIocHJvdmlkZXIpKSB7XG4gICAgICAgICAgZW1pdEluc3RhbmNlQ3JlYXRlZEJ5SW5qZWN0b3JFdmVudChwcm92aWRlci51c2VWYWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBlbWl0UHJvdmlkZXJDb25maWd1cmVkRXZlbnQocHJvdmlkZXIpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKCFpc1R5cGVQcm92aWRlcihwcm92aWRlcikgJiYgcHJvdmlkZXIubXVsdGkgPT09IHRydWUpIHtcbiAgICAgIC8vIElmIHRoZSBwcm92aWRlciBpbmRpY2F0ZXMgdGhhdCBpdCdzIGEgbXVsdGktcHJvdmlkZXIsIHByb2Nlc3MgaXQgc3BlY2lhbGx5LlxuICAgICAgLy8gRmlyc3QgY2hlY2sgd2hldGhlciBpdCdzIGJlZW4gZGVmaW5lZCBhbHJlYWR5LlxuICAgICAgbGV0IG11bHRpUmVjb3JkID0gdGhpcy5yZWNvcmRzLmdldCh0b2tlbik7XG4gICAgICBpZiAobXVsdGlSZWNvcmQpIHtcbiAgICAgICAgLy8gSXQgaGFzLiBUaHJvdyBhIG5pY2UgZXJyb3IgaWZcbiAgICAgICAgaWYgKG5nRGV2TW9kZSAmJiBtdWx0aVJlY29yZC5tdWx0aSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdGhyb3dNaXhlZE11bHRpUHJvdmlkZXJFcnJvcigpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtdWx0aVJlY29yZCA9IG1ha2VSZWNvcmQodW5kZWZpbmVkLCBOT1RfWUVULCB0cnVlKTtcbiAgICAgICAgbXVsdGlSZWNvcmQuZmFjdG9yeSA9ICgpID0+IGluamVjdEFyZ3MobXVsdGlSZWNvcmQhLm11bHRpISk7XG4gICAgICAgIHRoaXMucmVjb3Jkcy5zZXQodG9rZW4sIG11bHRpUmVjb3JkKTtcbiAgICAgIH1cbiAgICAgIHRva2VuID0gcHJvdmlkZXI7XG4gICAgICBtdWx0aVJlY29yZC5tdWx0aSEucHVzaChwcm92aWRlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChuZ0Rldk1vZGUpIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLnJlY29yZHMuZ2V0KHRva2VuKTtcbiAgICAgICAgaWYgKGV4aXN0aW5nICYmIGV4aXN0aW5nLm11bHRpICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvd01peGVkTXVsdGlQcm92aWRlckVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5yZWNvcmRzLnNldCh0b2tlbiwgcmVjb3JkKTtcbiAgfVxuXG4gIHByaXZhdGUgaHlkcmF0ZTxUPih0b2tlbjogUHJvdmlkZXJUb2tlbjxUPiwgcmVjb3JkOiBSZWNvcmQ8VD4pOiBUIHtcbiAgICBjb25zdCBwcmV2Q29uc3VtZXIgPSBzZXRBY3RpdmVDb25zdW1lcihudWxsKTtcbiAgICB0cnkge1xuICAgICAgaWYgKG5nRGV2TW9kZSAmJiByZWNvcmQudmFsdWUgPT09IENJUkNVTEFSKSB7XG4gICAgICAgIHRocm93Q3ljbGljRGVwZW5kZW5jeUVycm9yKHN0cmluZ2lmeSh0b2tlbikpO1xuICAgICAgfSBlbHNlIGlmIChyZWNvcmQudmFsdWUgPT09IE5PVF9ZRVQpIHtcbiAgICAgICAgcmVjb3JkLnZhbHVlID0gQ0lSQ1VMQVI7XG5cbiAgICAgICAgaWYgKG5nRGV2TW9kZSkge1xuICAgICAgICAgIHJ1bkluSW5qZWN0b3JQcm9maWxlckNvbnRleHQodGhpcywgdG9rZW4gYXMgVHlwZTxUPiwgKCkgPT4ge1xuICAgICAgICAgICAgcmVjb3JkLnZhbHVlID0gcmVjb3JkLmZhY3RvcnkhKCk7XG4gICAgICAgICAgICBlbWl0SW5zdGFuY2VDcmVhdGVkQnlJbmplY3RvckV2ZW50KHJlY29yZC52YWx1ZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVjb3JkLnZhbHVlID0gcmVjb3JkLmZhY3RvcnkhKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgcmVjb3JkLnZhbHVlID09PSAnb2JqZWN0JyAmJiByZWNvcmQudmFsdWUgJiYgaGFzT25EZXN0cm95KHJlY29yZC52YWx1ZSkpIHtcbiAgICAgICAgdGhpcy5fbmdPbkRlc3Ryb3lIb29rcy5hZGQocmVjb3JkLnZhbHVlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZWNvcmQudmFsdWUgYXMgVDtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0QWN0aXZlQ29uc3VtZXIocHJldkNvbnN1bWVyKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGluamVjdGFibGVEZWZJblNjb3BlKGRlZjogybXJtUluamVjdGFibGVEZWNsYXJhdGlvbjxhbnk+KTogYm9vbGVhbiB7XG4gICAgaWYgKCFkZWYucHJvdmlkZWRJbikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBwcm92aWRlZEluID0gcmVzb2x2ZUZvcndhcmRSZWYoZGVmLnByb3ZpZGVkSW4pO1xuICAgIGlmICh0eXBlb2YgcHJvdmlkZWRJbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBwcm92aWRlZEluID09PSAnYW55JyB8fCB0aGlzLnNjb3Blcy5oYXMocHJvdmlkZWRJbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLmluamVjdG9yRGVmVHlwZXMuaGFzKHByb3ZpZGVkSW4pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVtb3ZlT25EZXN0cm95KGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgY29uc3QgZGVzdHJveUNCSWR4ID0gdGhpcy5fb25EZXN0cm95SG9va3MuaW5kZXhPZihjYWxsYmFjayk7XG4gICAgaWYgKGRlc3Ryb3lDQklkeCAhPT0gLTEpIHtcbiAgICAgIHRoaXMuX29uRGVzdHJveUhvb2tzLnNwbGljZShkZXN0cm95Q0JJZHgsIDEpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBpbmplY3RhYmxlRGVmT3JJbmplY3RvckRlZkZhY3RvcnkodG9rZW46IFByb3ZpZGVyVG9rZW48YW55Pik6IEZhY3RvcnlGbjxhbnk+IHtcbiAgLy8gTW9zdCB0b2tlbnMgd2lsbCBoYXZlIGFuIGluamVjdGFibGUgZGVmIGRpcmVjdGx5IG9uIHRoZW0sIHdoaWNoIHNwZWNpZmllcyBhIGZhY3RvcnkgZGlyZWN0bHkuXG4gIGNvbnN0IGluamVjdGFibGVEZWYgPSBnZXRJbmplY3RhYmxlRGVmKHRva2VuKTtcbiAgY29uc3QgZmFjdG9yeSA9IGluamVjdGFibGVEZWYgIT09IG51bGwgPyBpbmplY3RhYmxlRGVmLmZhY3RvcnkgOiBnZXRGYWN0b3J5RGVmKHRva2VuKTtcblxuICBpZiAoZmFjdG9yeSAhPT0gbnVsbCkge1xuICAgIHJldHVybiBmYWN0b3J5O1xuICB9XG5cbiAgLy8gSW5qZWN0aW9uVG9rZW5zIHNob3VsZCBoYXZlIGFuIGluamVjdGFibGUgZGVmICjJtXByb3YpIGFuZCB0aHVzIHNob3VsZCBiZSBoYW5kbGVkIGFib3ZlLlxuICAvLyBJZiBpdCdzIG1pc3NpbmcgdGhhdCwgaXQncyBhbiBlcnJvci5cbiAgaWYgKHRva2VuIGluc3RhbmNlb2YgSW5qZWN0aW9uVG9rZW4pIHtcbiAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFxuICAgICAgUnVudGltZUVycm9yQ29kZS5JTlZBTElEX0lOSkVDVElPTl9UT0tFTixcbiAgICAgIG5nRGV2TW9kZSAmJiBgVG9rZW4gJHtzdHJpbmdpZnkodG9rZW4pfSBpcyBtaXNzaW5nIGEgybVwcm92IGRlZmluaXRpb24uYCxcbiAgICApO1xuICB9XG5cbiAgLy8gVW5kZWNvcmF0ZWQgdHlwZXMgY2FuIHNvbWV0aW1lcyBiZSBjcmVhdGVkIGlmIHRoZXkgaGF2ZSBubyBjb25zdHJ1Y3RvciBhcmd1bWVudHMuXG4gIGlmICh0b2tlbiBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgcmV0dXJuIGdldFVuZGVjb3JhdGVkSW5qZWN0YWJsZUZhY3RvcnkodG9rZW4pO1xuICB9XG5cbiAgLy8gVGhlcmUgd2FzIG5vIHdheSB0byByZXNvbHZlIGEgZmFjdG9yeSBmb3IgdGhpcyB0b2tlbi5cbiAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihSdW50aW1lRXJyb3JDb2RlLklOVkFMSURfSU5KRUNUSU9OX1RPS0VOLCBuZ0Rldk1vZGUgJiYgJ3VucmVhY2hhYmxlJyk7XG59XG5cbmZ1bmN0aW9uIGdldFVuZGVjb3JhdGVkSW5qZWN0YWJsZUZhY3RvcnkodG9rZW46IEZ1bmN0aW9uKSB7XG4gIC8vIElmIHRoZSB0b2tlbiBoYXMgcGFyYW1ldGVycyB0aGVuIGl0IGhhcyBkZXBlbmRlbmNpZXMgdGhhdCB3ZSBjYW5ub3QgcmVzb2x2ZSBpbXBsaWNpdGx5LlxuICBjb25zdCBwYXJhbUxlbmd0aCA9IHRva2VuLmxlbmd0aDtcbiAgaWYgKHBhcmFtTGVuZ3RoID4gMCkge1xuICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICBSdW50aW1lRXJyb3JDb2RlLklOVkFMSURfSU5KRUNUSU9OX1RPS0VOLFxuICAgICAgbmdEZXZNb2RlICYmXG4gICAgICAgIGBDYW4ndCByZXNvbHZlIGFsbCBwYXJhbWV0ZXJzIGZvciAke3N0cmluZ2lmeSh0b2tlbil9OiAoJHtuZXdBcnJheShwYXJhbUxlbmd0aCwgJz8nKS5qb2luKFxuICAgICAgICAgICcsICcsXG4gICAgICAgICl9KS5gLFxuICAgICk7XG4gIH1cblxuICAvLyBUaGUgY29uc3RydWN0b3IgZnVuY3Rpb24gYXBwZWFycyB0byBoYXZlIG5vIHBhcmFtZXRlcnMuXG4gIC8vIFRoaXMgbWlnaHQgYmUgYmVjYXVzZSBpdCBpbmhlcml0cyBmcm9tIGEgc3VwZXItY2xhc3MuIEluIHdoaWNoIGNhc2UsIHVzZSBhbiBpbmplY3RhYmxlXG4gIC8vIGRlZiBmcm9tIGFuIGFuY2VzdG9yIGlmIHRoZXJlIGlzIG9uZS5cbiAgLy8gT3RoZXJ3aXNlIHRoaXMgcmVhbGx5IGlzIGEgc2ltcGxlIGNsYXNzIHdpdGggbm8gZGVwZW5kZW5jaWVzLCBzbyByZXR1cm4gYSBmYWN0b3J5IHRoYXRcbiAgLy8ganVzdCBpbnN0YW50aWF0ZXMgdGhlIHplcm8tYXJnIGNvbnN0cnVjdG9yLlxuICBjb25zdCBpbmhlcml0ZWRJbmplY3RhYmxlRGVmID0gZ2V0SW5oZXJpdGVkSW5qZWN0YWJsZURlZih0b2tlbik7XG4gIGlmIChpbmhlcml0ZWRJbmplY3RhYmxlRGVmICE9PSBudWxsKSB7XG4gICAgcmV0dXJuICgpID0+IGluaGVyaXRlZEluamVjdGFibGVEZWYuZmFjdG9yeSh0b2tlbiBhcyBUeXBlPGFueT4pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiAoKSA9PiBuZXcgKHRva2VuIGFzIFR5cGU8YW55PikoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcm92aWRlclRvUmVjb3JkKHByb3ZpZGVyOiBTaW5nbGVQcm92aWRlcik6IFJlY29yZDxhbnk+IHtcbiAgaWYgKGlzVmFsdWVQcm92aWRlcihwcm92aWRlcikpIHtcbiAgICByZXR1cm4gbWFrZVJlY29yZCh1bmRlZmluZWQsIHByb3ZpZGVyLnVzZVZhbHVlKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBmYWN0b3J5OiAoKCkgPT4gYW55KSB8IHVuZGVmaW5lZCA9IHByb3ZpZGVyVG9GYWN0b3J5KHByb3ZpZGVyKTtcbiAgICByZXR1cm4gbWFrZVJlY29yZChmYWN0b3J5LCBOT1RfWUVUKTtcbiAgfVxufVxuXG4vKipcbiAqIENvbnZlcnRzIGEgYFNpbmdsZVByb3ZpZGVyYCBpbnRvIGEgZmFjdG9yeSBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0gcHJvdmlkZXIgcHJvdmlkZXIgdG8gY29udmVydCB0byBmYWN0b3J5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcm92aWRlclRvRmFjdG9yeShcbiAgcHJvdmlkZXI6IFNpbmdsZVByb3ZpZGVyLFxuICBuZ01vZHVsZVR5cGU/OiBJbmplY3RvclR5cGU8YW55PixcbiAgcHJvdmlkZXJzPzogYW55W10sXG4pOiAoKSA9PiBhbnkge1xuICBsZXQgZmFjdG9yeTogKCgpID0+IGFueSkgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gIGlmIChuZ0Rldk1vZGUgJiYgaXNFbnZpcm9ubWVudFByb3ZpZGVycyhwcm92aWRlcikpIHtcbiAgICB0aHJvd0ludmFsaWRQcm92aWRlckVycm9yKHVuZGVmaW5lZCwgcHJvdmlkZXJzLCBwcm92aWRlcik7XG4gIH1cblxuICBpZiAoaXNUeXBlUHJvdmlkZXIocHJvdmlkZXIpKSB7XG4gICAgY29uc3QgdW53cmFwcGVkUHJvdmlkZXIgPSByZXNvbHZlRm9yd2FyZFJlZihwcm92aWRlcik7XG4gICAgcmV0dXJuIGdldEZhY3RvcnlEZWYodW53cmFwcGVkUHJvdmlkZXIpIHx8IGluamVjdGFibGVEZWZPckluamVjdG9yRGVmRmFjdG9yeSh1bndyYXBwZWRQcm92aWRlcik7XG4gIH0gZWxzZSB7XG4gICAgaWYgKGlzVmFsdWVQcm92aWRlcihwcm92aWRlcikpIHtcbiAgICAgIGZhY3RvcnkgPSAoKSA9PiByZXNvbHZlRm9yd2FyZFJlZihwcm92aWRlci51c2VWYWx1ZSk7XG4gICAgfSBlbHNlIGlmIChpc0ZhY3RvcnlQcm92aWRlcihwcm92aWRlcikpIHtcbiAgICAgIGZhY3RvcnkgPSAoKSA9PiBwcm92aWRlci51c2VGYWN0b3J5KC4uLmluamVjdEFyZ3MocHJvdmlkZXIuZGVwcyB8fCBbXSkpO1xuICAgIH0gZWxzZSBpZiAoaXNFeGlzdGluZ1Byb3ZpZGVyKHByb3ZpZGVyKSkge1xuICAgICAgZmFjdG9yeSA9ICgpID0+IMm1ybVpbmplY3QocmVzb2x2ZUZvcndhcmRSZWYocHJvdmlkZXIudXNlRXhpc3RpbmcpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgY2xhc3NSZWYgPSByZXNvbHZlRm9yd2FyZFJlZihcbiAgICAgICAgcHJvdmlkZXIgJiZcbiAgICAgICAgICAoKHByb3ZpZGVyIGFzIFN0YXRpY0NsYXNzUHJvdmlkZXIgfCBDbGFzc1Byb3ZpZGVyKS51c2VDbGFzcyB8fCBwcm92aWRlci5wcm92aWRlKSxcbiAgICAgICk7XG4gICAgICBpZiAobmdEZXZNb2RlICYmICFjbGFzc1JlZikge1xuICAgICAgICB0aHJvd0ludmFsaWRQcm92aWRlckVycm9yKG5nTW9kdWxlVHlwZSwgcHJvdmlkZXJzLCBwcm92aWRlcik7XG4gICAgICB9XG4gICAgICBpZiAoaGFzRGVwcyhwcm92aWRlcikpIHtcbiAgICAgICAgZmFjdG9yeSA9ICgpID0+IG5ldyBjbGFzc1JlZiguLi5pbmplY3RBcmdzKHByb3ZpZGVyLmRlcHMpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBnZXRGYWN0b3J5RGVmKGNsYXNzUmVmKSB8fCBpbmplY3RhYmxlRGVmT3JJbmplY3RvckRlZkZhY3RvcnkoY2xhc3NSZWYpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gZmFjdG9yeTtcbn1cblxuZnVuY3Rpb24gbWFrZVJlY29yZDxUPihcbiAgZmFjdG9yeTogKCgpID0+IFQpIHwgdW5kZWZpbmVkLFxuICB2YWx1ZTogVCB8IHt9LFxuICBtdWx0aTogYm9vbGVhbiA9IGZhbHNlLFxuKTogUmVjb3JkPFQ+IHtcbiAgcmV0dXJuIHtcbiAgICBmYWN0b3J5OiBmYWN0b3J5LFxuICAgIHZhbHVlOiB2YWx1ZSxcbiAgICBtdWx0aTogbXVsdGkgPyBbXSA6IHVuZGVmaW5lZCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gaGFzRGVwcyhcbiAgdmFsdWU6IENsYXNzUHJvdmlkZXIgfCBDb25zdHJ1Y3RvclByb3ZpZGVyIHwgU3RhdGljQ2xhc3NQcm92aWRlcixcbik6IHZhbHVlIGlzIENsYXNzUHJvdmlkZXIgJiB7ZGVwczogYW55W119IHtcbiAgcmV0dXJuICEhKHZhbHVlIGFzIGFueSkuZGVwcztcbn1cblxuZnVuY3Rpb24gaGFzT25EZXN0cm95KHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBPbkRlc3Ryb3kge1xuICByZXR1cm4gKFxuICAgIHZhbHVlICE9PSBudWxsICYmXG4gICAgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJlxuICAgIHR5cGVvZiAodmFsdWUgYXMgT25EZXN0cm95KS5uZ09uRGVzdHJveSA9PT0gJ2Z1bmN0aW9uJ1xuICApO1xufVxuXG5mdW5jdGlvbiBjb3VsZEJlSW5qZWN0YWJsZVR5cGUodmFsdWU6IGFueSk6IHZhbHVlIGlzIFByb3ZpZGVyVG9rZW48YW55PiB7XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nIHx8ICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlIGluc3RhbmNlb2YgSW5qZWN0aW9uVG9rZW4pXG4gICk7XG59XG5cbmZ1bmN0aW9uIGZvckVhY2hTaW5nbGVQcm92aWRlcihcbiAgcHJvdmlkZXJzOiBBcnJheTxQcm92aWRlciB8IEVudmlyb25tZW50UHJvdmlkZXJzPixcbiAgZm46IChwcm92aWRlcjogU2luZ2xlUHJvdmlkZXIpID0+IHZvaWQsXG4pOiB2b2lkIHtcbiAgZm9yIChjb25zdCBwcm92aWRlciBvZiBwcm92aWRlcnMpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShwcm92aWRlcikpIHtcbiAgICAgIGZvckVhY2hTaW5nbGVQcm92aWRlcihwcm92aWRlciwgZm4pO1xuICAgIH0gZWxzZSBpZiAocHJvdmlkZXIgJiYgaXNFbnZpcm9ubWVudFByb3ZpZGVycyhwcm92aWRlcikpIHtcbiAgICAgIGZvckVhY2hTaW5nbGVQcm92aWRlcihwcm92aWRlci7JtXByb3ZpZGVycywgZm4pO1xuICAgIH0gZWxzZSB7XG4gICAgICBmbihwcm92aWRlciBhcyBTaW5nbGVQcm92aWRlcik7XG4gICAgfVxuICB9XG59XG4iXX0=