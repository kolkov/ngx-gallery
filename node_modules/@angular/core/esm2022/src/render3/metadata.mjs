/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { noSideEffects } from '../util/closure';
/**
 * The name of a field that Angular monkey-patches onto a component
 * class to store a function that loads defer-loadable dependencies
 * and applies metadata to a class.
 */
const ASYNC_COMPONENT_METADATA_FN = '__ngAsyncComponentMetadataFn__';
/**
 * If a given component has unresolved async metadata - returns a reference
 * to a function that applies component metadata after resolving defer-loadable
 * dependencies. Otherwise - this function returns `null`.
 */
export function getAsyncClassMetadataFn(type) {
    const componentClass = type; // cast to `any`, so that we can read a monkey-patched field
    return componentClass[ASYNC_COMPONENT_METADATA_FN] ?? null;
}
/**
 * Handles the process of applying metadata info to a component class in case
 * component template has defer blocks (thus some dependencies became deferrable).
 *
 * @param type Component class where metadata should be added
 * @param dependencyLoaderFn Function that loads dependencies
 * @param metadataSetterFn Function that forms a scope in which the `setClassMetadata` is invoked
 */
export function setClassMetadataAsync(type, dependencyLoaderFn, metadataSetterFn) {
    const componentClass = type; // cast to `any`, so that we can monkey-patch it
    componentClass[ASYNC_COMPONENT_METADATA_FN] = () => Promise.all(dependencyLoaderFn()).then((dependencies) => {
        metadataSetterFn(...dependencies);
        // Metadata is now set, reset field value to indicate that this component
        // can by used/compiled synchronously.
        componentClass[ASYNC_COMPONENT_METADATA_FN] = null;
        return dependencies;
    });
    return componentClass[ASYNC_COMPONENT_METADATA_FN];
}
/**
 * Adds decorator, constructor, and property metadata to a given type via static metadata fields
 * on the type.
 *
 * These metadata fields can later be read with Angular's `ReflectionCapabilities` API.
 *
 * Calls to `setClassMetadata` can be guarded by ngDevMode, resulting in the metadata assignments
 * being tree-shaken away during production builds.
 */
export function setClassMetadata(type, decorators, ctorParameters, propDecorators) {
    return noSideEffects(() => {
        const clazz = type;
        if (decorators !== null) {
            if (clazz.hasOwnProperty('decorators') && clazz.decorators !== undefined) {
                clazz.decorators.push(...decorators);
            }
            else {
                clazz.decorators = decorators;
            }
        }
        if (ctorParameters !== null) {
            // Rather than merging, clobber the existing parameters. If other projects exist which
            // use tsickle-style annotations and reflect over them in the same way, this could
            // cause issues, but that is vanishingly unlikely.
            clazz.ctorParameters = ctorParameters;
        }
        if (propDecorators !== null) {
            // The property decorator objects are merged as it is possible different fields have
            // different decorator types. Decorators on individual fields are not merged, as it's
            // also incredibly unlikely that a field will be decorated both with an Angular
            // decorator and a non-Angular decorator that's also been downleveled.
            if (clazz.hasOwnProperty('propDecorators') && clazz.propDecorators !== undefined) {
                clazz.propDecorators = { ...clazz.propDecorators, ...propDecorators };
            }
            else {
                clazz.propDecorators = propDecorators;
            }
        }
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YWRhdGEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL21ldGFkYXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxpQkFBaUIsQ0FBQztBQVE5Qzs7OztHQUlHO0FBQ0gsTUFBTSwyQkFBMkIsR0FBRyxnQ0FBZ0MsQ0FBQztBQUVyRTs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLHVCQUF1QixDQUNyQyxJQUFtQjtJQUVuQixNQUFNLGNBQWMsR0FBRyxJQUFXLENBQUMsQ0FBQyw0REFBNEQ7SUFDaEcsT0FBTyxjQUFjLENBQUMsMkJBQTJCLENBQUMsSUFBSSxJQUFJLENBQUM7QUFDN0QsQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUscUJBQXFCLENBQ25DLElBQWUsRUFDZixrQkFBdUQsRUFDdkQsZ0JBQXFEO0lBRXJELE1BQU0sY0FBYyxHQUFHLElBQVcsQ0FBQyxDQUFDLGdEQUFnRDtJQUNwRixjQUFjLENBQUMsMkJBQTJCLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FDakQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsWUFBWSxFQUFFLEVBQUU7UUFDdEQsZ0JBQWdCLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQztRQUNsQyx5RUFBeUU7UUFDekUsc0NBQXNDO1FBQ3RDLGNBQWMsQ0FBQywyQkFBMkIsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUVuRCxPQUFPLFlBQVksQ0FBQztJQUN0QixDQUFDLENBQUMsQ0FBQztJQUNMLE9BQU8sY0FBYyxDQUFDLDJCQUEyQixDQUFDLENBQUM7QUFDckQsQ0FBQztBQUVEOzs7Ozs7OztHQVFHO0FBQ0gsTUFBTSxVQUFVLGdCQUFnQixDQUM5QixJQUFlLEVBQ2YsVUFBd0IsRUFDeEIsY0FBb0MsRUFDcEMsY0FBNkM7SUFFN0MsT0FBTyxhQUFhLENBQUMsR0FBRyxFQUFFO1FBQ3hCLE1BQU0sS0FBSyxHQUFHLElBQXdCLENBQUM7UUFFdkMsSUFBSSxVQUFVLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDeEIsSUFBSSxLQUFLLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxJQUFJLEtBQUssQ0FBQyxVQUFVLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQ3pFLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUM7WUFDdkMsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLEtBQUssQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO1lBQ2hDLENBQUM7UUFDSCxDQUFDO1FBQ0QsSUFBSSxjQUFjLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDNUIsc0ZBQXNGO1lBQ3RGLGtGQUFrRjtZQUNsRixrREFBa0Q7WUFDbEQsS0FBSyxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7UUFDeEMsQ0FBQztRQUNELElBQUksY0FBYyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQzVCLG9GQUFvRjtZQUNwRixxRkFBcUY7WUFDckYsK0VBQStFO1lBQy9FLHNFQUFzRTtZQUN0RSxJQUFJLEtBQUssQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxLQUFLLENBQUMsY0FBYyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUNqRixLQUFLLENBQUMsY0FBYyxHQUFHLEVBQUMsR0FBRyxLQUFLLENBQUMsY0FBYyxFQUFFLEdBQUcsY0FBYyxFQUFDLENBQUM7WUFDdEUsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLEtBQUssQ0FBQyxjQUFjLEdBQUcsY0FBYyxDQUFDO1lBQ3hDLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQyxDQUFVLENBQUM7QUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7VHlwZX0gZnJvbSAnLi4vaW50ZXJmYWNlL3R5cGUnO1xuaW1wb3J0IHtub1NpZGVFZmZlY3RzfSBmcm9tICcuLi91dGlsL2Nsb3N1cmUnO1xuXG5pbnRlcmZhY2UgVHlwZVdpdGhNZXRhZGF0YSBleHRlbmRzIFR5cGU8YW55PiB7XG4gIGRlY29yYXRvcnM/OiBhbnlbXTtcbiAgY3RvclBhcmFtZXRlcnM/OiAoKSA9PiBhbnlbXTtcbiAgcHJvcERlY29yYXRvcnM/OiB7W2ZpZWxkOiBzdHJpbmddOiBhbnl9O1xufVxuXG4vKipcbiAqIFRoZSBuYW1lIG9mIGEgZmllbGQgdGhhdCBBbmd1bGFyIG1vbmtleS1wYXRjaGVzIG9udG8gYSBjb21wb25lbnRcbiAqIGNsYXNzIHRvIHN0b3JlIGEgZnVuY3Rpb24gdGhhdCBsb2FkcyBkZWZlci1sb2FkYWJsZSBkZXBlbmRlbmNpZXNcbiAqIGFuZCBhcHBsaWVzIG1ldGFkYXRhIHRvIGEgY2xhc3MuXG4gKi9cbmNvbnN0IEFTWU5DX0NPTVBPTkVOVF9NRVRBREFUQV9GTiA9ICdfX25nQXN5bmNDb21wb25lbnRNZXRhZGF0YUZuX18nO1xuXG4vKipcbiAqIElmIGEgZ2l2ZW4gY29tcG9uZW50IGhhcyB1bnJlc29sdmVkIGFzeW5jIG1ldGFkYXRhIC0gcmV0dXJucyBhIHJlZmVyZW5jZVxuICogdG8gYSBmdW5jdGlvbiB0aGF0IGFwcGxpZXMgY29tcG9uZW50IG1ldGFkYXRhIGFmdGVyIHJlc29sdmluZyBkZWZlci1sb2FkYWJsZVxuICogZGVwZW5kZW5jaWVzLiBPdGhlcndpc2UgLSB0aGlzIGZ1bmN0aW9uIHJldHVybnMgYG51bGxgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXN5bmNDbGFzc01ldGFkYXRhRm4oXG4gIHR5cGU6IFR5cGU8dW5rbm93bj4sXG4pOiAoKCkgPT4gUHJvbWlzZTxBcnJheTxUeXBlPHVua25vd24+Pj4pIHwgbnVsbCB7XG4gIGNvbnN0IGNvbXBvbmVudENsYXNzID0gdHlwZSBhcyBhbnk7IC8vIGNhc3QgdG8gYGFueWAsIHNvIHRoYXQgd2UgY2FuIHJlYWQgYSBtb25rZXktcGF0Y2hlZCBmaWVsZFxuICByZXR1cm4gY29tcG9uZW50Q2xhc3NbQVNZTkNfQ09NUE9ORU5UX01FVEFEQVRBX0ZOXSA/PyBudWxsO1xufVxuXG4vKipcbiAqIEhhbmRsZXMgdGhlIHByb2Nlc3Mgb2YgYXBwbHlpbmcgbWV0YWRhdGEgaW5mbyB0byBhIGNvbXBvbmVudCBjbGFzcyBpbiBjYXNlXG4gKiBjb21wb25lbnQgdGVtcGxhdGUgaGFzIGRlZmVyIGJsb2NrcyAodGh1cyBzb21lIGRlcGVuZGVuY2llcyBiZWNhbWUgZGVmZXJyYWJsZSkuXG4gKlxuICogQHBhcmFtIHR5cGUgQ29tcG9uZW50IGNsYXNzIHdoZXJlIG1ldGFkYXRhIHNob3VsZCBiZSBhZGRlZFxuICogQHBhcmFtIGRlcGVuZGVuY3lMb2FkZXJGbiBGdW5jdGlvbiB0aGF0IGxvYWRzIGRlcGVuZGVuY2llc1xuICogQHBhcmFtIG1ldGFkYXRhU2V0dGVyRm4gRnVuY3Rpb24gdGhhdCBmb3JtcyBhIHNjb3BlIGluIHdoaWNoIHRoZSBgc2V0Q2xhc3NNZXRhZGF0YWAgaXMgaW52b2tlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0Q2xhc3NNZXRhZGF0YUFzeW5jKFxuICB0eXBlOiBUeXBlPGFueT4sXG4gIGRlcGVuZGVuY3lMb2FkZXJGbjogKCkgPT4gQXJyYXk8UHJvbWlzZTxUeXBlPHVua25vd24+Pj4sXG4gIG1ldGFkYXRhU2V0dGVyRm46ICguLi50eXBlczogVHlwZTx1bmtub3duPltdKSA9PiB2b2lkLFxuKTogKCkgPT4gUHJvbWlzZTxBcnJheTxUeXBlPHVua25vd24+Pj4ge1xuICBjb25zdCBjb21wb25lbnRDbGFzcyA9IHR5cGUgYXMgYW55OyAvLyBjYXN0IHRvIGBhbnlgLCBzbyB0aGF0IHdlIGNhbiBtb25rZXktcGF0Y2ggaXRcbiAgY29tcG9uZW50Q2xhc3NbQVNZTkNfQ09NUE9ORU5UX01FVEFEQVRBX0ZOXSA9ICgpID0+XG4gICAgUHJvbWlzZS5hbGwoZGVwZW5kZW5jeUxvYWRlckZuKCkpLnRoZW4oKGRlcGVuZGVuY2llcykgPT4ge1xuICAgICAgbWV0YWRhdGFTZXR0ZXJGbiguLi5kZXBlbmRlbmNpZXMpO1xuICAgICAgLy8gTWV0YWRhdGEgaXMgbm93IHNldCwgcmVzZXQgZmllbGQgdmFsdWUgdG8gaW5kaWNhdGUgdGhhdCB0aGlzIGNvbXBvbmVudFxuICAgICAgLy8gY2FuIGJ5IHVzZWQvY29tcGlsZWQgc3luY2hyb25vdXNseS5cbiAgICAgIGNvbXBvbmVudENsYXNzW0FTWU5DX0NPTVBPTkVOVF9NRVRBREFUQV9GTl0gPSBudWxsO1xuXG4gICAgICByZXR1cm4gZGVwZW5kZW5jaWVzO1xuICAgIH0pO1xuICByZXR1cm4gY29tcG9uZW50Q2xhc3NbQVNZTkNfQ09NUE9ORU5UX01FVEFEQVRBX0ZOXTtcbn1cblxuLyoqXG4gKiBBZGRzIGRlY29yYXRvciwgY29uc3RydWN0b3IsIGFuZCBwcm9wZXJ0eSBtZXRhZGF0YSB0byBhIGdpdmVuIHR5cGUgdmlhIHN0YXRpYyBtZXRhZGF0YSBmaWVsZHNcbiAqIG9uIHRoZSB0eXBlLlxuICpcbiAqIFRoZXNlIG1ldGFkYXRhIGZpZWxkcyBjYW4gbGF0ZXIgYmUgcmVhZCB3aXRoIEFuZ3VsYXIncyBgUmVmbGVjdGlvbkNhcGFiaWxpdGllc2AgQVBJLlxuICpcbiAqIENhbGxzIHRvIGBzZXRDbGFzc01ldGFkYXRhYCBjYW4gYmUgZ3VhcmRlZCBieSBuZ0Rldk1vZGUsIHJlc3VsdGluZyBpbiB0aGUgbWV0YWRhdGEgYXNzaWdubWVudHNcbiAqIGJlaW5nIHRyZWUtc2hha2VuIGF3YXkgZHVyaW5nIHByb2R1Y3Rpb24gYnVpbGRzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0Q2xhc3NNZXRhZGF0YShcbiAgdHlwZTogVHlwZTxhbnk+LFxuICBkZWNvcmF0b3JzOiBhbnlbXSB8IG51bGwsXG4gIGN0b3JQYXJhbWV0ZXJzOiAoKCkgPT4gYW55W10pIHwgbnVsbCxcbiAgcHJvcERlY29yYXRvcnM6IHtbZmllbGQ6IHN0cmluZ106IGFueX0gfCBudWxsLFxuKTogdm9pZCB7XG4gIHJldHVybiBub1NpZGVFZmZlY3RzKCgpID0+IHtcbiAgICBjb25zdCBjbGF6eiA9IHR5cGUgYXMgVHlwZVdpdGhNZXRhZGF0YTtcblxuICAgIGlmIChkZWNvcmF0b3JzICE9PSBudWxsKSB7XG4gICAgICBpZiAoY2xhenouaGFzT3duUHJvcGVydHkoJ2RlY29yYXRvcnMnKSAmJiBjbGF6ei5kZWNvcmF0b3JzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY2xhenouZGVjb3JhdG9ycy5wdXNoKC4uLmRlY29yYXRvcnMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2xhenouZGVjb3JhdG9ycyA9IGRlY29yYXRvcnM7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjdG9yUGFyYW1ldGVycyAhPT0gbnVsbCkge1xuICAgICAgLy8gUmF0aGVyIHRoYW4gbWVyZ2luZywgY2xvYmJlciB0aGUgZXhpc3RpbmcgcGFyYW1ldGVycy4gSWYgb3RoZXIgcHJvamVjdHMgZXhpc3Qgd2hpY2hcbiAgICAgIC8vIHVzZSB0c2lja2xlLXN0eWxlIGFubm90YXRpb25zIGFuZCByZWZsZWN0IG92ZXIgdGhlbSBpbiB0aGUgc2FtZSB3YXksIHRoaXMgY291bGRcbiAgICAgIC8vIGNhdXNlIGlzc3VlcywgYnV0IHRoYXQgaXMgdmFuaXNoaW5nbHkgdW5saWtlbHkuXG4gICAgICBjbGF6ei5jdG9yUGFyYW1ldGVycyA9IGN0b3JQYXJhbWV0ZXJzO1xuICAgIH1cbiAgICBpZiAocHJvcERlY29yYXRvcnMgIT09IG51bGwpIHtcbiAgICAgIC8vIFRoZSBwcm9wZXJ0eSBkZWNvcmF0b3Igb2JqZWN0cyBhcmUgbWVyZ2VkIGFzIGl0IGlzIHBvc3NpYmxlIGRpZmZlcmVudCBmaWVsZHMgaGF2ZVxuICAgICAgLy8gZGlmZmVyZW50IGRlY29yYXRvciB0eXBlcy4gRGVjb3JhdG9ycyBvbiBpbmRpdmlkdWFsIGZpZWxkcyBhcmUgbm90IG1lcmdlZCwgYXMgaXQnc1xuICAgICAgLy8gYWxzbyBpbmNyZWRpYmx5IHVubGlrZWx5IHRoYXQgYSBmaWVsZCB3aWxsIGJlIGRlY29yYXRlZCBib3RoIHdpdGggYW4gQW5ndWxhclxuICAgICAgLy8gZGVjb3JhdG9yIGFuZCBhIG5vbi1Bbmd1bGFyIGRlY29yYXRvciB0aGF0J3MgYWxzbyBiZWVuIGRvd25sZXZlbGVkLlxuICAgICAgaWYgKGNsYXp6Lmhhc093blByb3BlcnR5KCdwcm9wRGVjb3JhdG9ycycpICYmIGNsYXp6LnByb3BEZWNvcmF0b3JzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY2xhenoucHJvcERlY29yYXRvcnMgPSB7Li4uY2xhenoucHJvcERlY29yYXRvcnMsIC4uLnByb3BEZWNvcmF0b3JzfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNsYXp6LnByb3BEZWNvcmF0b3JzID0gcHJvcERlY29yYXRvcnM7XG4gICAgICB9XG4gICAgfVxuICB9KSBhcyBuZXZlcjtcbn1cbiJdfQ==