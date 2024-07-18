/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { RuntimeError } from '../../errors';
import { EMPTY_ARRAY, EMPTY_OBJ } from '../../util/empty';
import { fillProperties } from '../../util/property';
import { isComponentDef } from '../interfaces/type_checks';
import { mergeHostAttrs } from '../util/attrs_utils';
import { stringifyForError } from '../util/stringify_utils';
export function getSuperType(type) {
    return Object.getPrototypeOf(type.prototype).constructor;
}
/**
 * Merges the definition from a super class to a sub class.
 * @param definition The definition that is a SubClass of another directive of component
 *
 * @codeGenApi
 */
export function ɵɵInheritDefinitionFeature(definition) {
    let superType = getSuperType(definition.type);
    let shouldInheritFields = true;
    const inheritanceChain = [definition];
    while (superType) {
        let superDef = undefined;
        if (isComponentDef(definition)) {
            // Don't use getComponentDef/getDirectiveDef. This logic relies on inheritance.
            superDef = superType.ɵcmp || superType.ɵdir;
        }
        else {
            if (superType.ɵcmp) {
                throw new RuntimeError(903 /* RuntimeErrorCode.INVALID_INHERITANCE */, ngDevMode &&
                    `Directives cannot inherit Components. Directive ${stringifyForError(definition.type)} is attempting to extend component ${stringifyForError(superType)}`);
            }
            // Don't use getComponentDef/getDirectiveDef. This logic relies on inheritance.
            superDef = superType.ɵdir;
        }
        if (superDef) {
            if (shouldInheritFields) {
                inheritanceChain.push(superDef);
                // Some fields in the definition may be empty, if there were no values to put in them that
                // would've justified object creation. Unwrap them if necessary.
                const writeableDef = definition;
                writeableDef.inputs = maybeUnwrapEmpty(definition.inputs);
                writeableDef.inputTransforms = maybeUnwrapEmpty(definition.inputTransforms);
                writeableDef.declaredInputs = maybeUnwrapEmpty(definition.declaredInputs);
                writeableDef.outputs = maybeUnwrapEmpty(definition.outputs);
                // Merge hostBindings
                const superHostBindings = superDef.hostBindings;
                superHostBindings && inheritHostBindings(definition, superHostBindings);
                // Merge queries
                const superViewQuery = superDef.viewQuery;
                const superContentQueries = superDef.contentQueries;
                superViewQuery && inheritViewQuery(definition, superViewQuery);
                superContentQueries && inheritContentQueries(definition, superContentQueries);
                // Merge inputs and outputs
                mergeInputsWithTransforms(definition, superDef);
                fillProperties(definition.outputs, superDef.outputs);
                // Merge animations metadata.
                // If `superDef` is a Component, the `data` field is present (defaults to an empty object).
                if (isComponentDef(superDef) && superDef.data.animation) {
                    // If super def is a Component, the `definition` is also a Component, since Directives can
                    // not inherit Components (we throw an error above and cannot reach this code).
                    const defData = definition.data;
                    defData.animation = (defData.animation || []).concat(superDef.data.animation);
                }
            }
            // Run parent features
            const features = superDef.features;
            if (features) {
                for (let i = 0; i < features.length; i++) {
                    const feature = features[i];
                    if (feature && feature.ngInherit) {
                        feature(definition);
                    }
                    // If `InheritDefinitionFeature` is a part of the current `superDef`, it means that this
                    // def already has all the necessary information inherited from its super class(es), so we
                    // can stop merging fields from super classes. However we need to iterate through the
                    // prototype chain to look for classes that might contain other "features" (like
                    // NgOnChanges), which we should invoke for the original `definition`. We set the
                    // `shouldInheritFields` flag to indicate that, essentially skipping fields inheritance
                    // logic and only invoking functions from the "features" list.
                    if (feature === ɵɵInheritDefinitionFeature) {
                        shouldInheritFields = false;
                    }
                }
            }
        }
        superType = Object.getPrototypeOf(superType);
    }
    mergeHostAttrsAcrossInheritance(inheritanceChain);
}
function mergeInputsWithTransforms(target, source) {
    for (const key in source.inputs) {
        if (!source.inputs.hasOwnProperty(key)) {
            continue;
        }
        if (target.inputs.hasOwnProperty(key)) {
            continue;
        }
        const value = source.inputs[key];
        if (value === undefined) {
            continue;
        }
        target.inputs[key] = value;
        target.declaredInputs[key] = source.declaredInputs[key];
        // If the input is inherited, and we have a transform for it, we also inherit it.
        // Note that transforms should not be inherited if the input has its own metadata
        // in the `source` directive itself already (i.e. the input is re-declared/overridden).
        if (source.inputTransforms !== null) {
            // Note: transforms are stored with their minified names.
            // Perf: only access the minified name when there are source transforms.
            const minifiedName = Array.isArray(value) ? value[0] : value;
            if (!source.inputTransforms.hasOwnProperty(minifiedName)) {
                continue;
            }
            target.inputTransforms ??= {};
            target.inputTransforms[minifiedName] = source.inputTransforms[minifiedName];
        }
    }
}
/**
 * Merge the `hostAttrs` and `hostVars` from the inherited parent to the base class.
 *
 * @param inheritanceChain A list of `WritableDefs` starting at the top most type and listing
 * sub-types in order. For each type take the `hostAttrs` and `hostVars` and merge it with the child
 * type.
 */
function mergeHostAttrsAcrossInheritance(inheritanceChain) {
    let hostVars = 0;
    let hostAttrs = null;
    // We process the inheritance order from the base to the leaves here.
    for (let i = inheritanceChain.length - 1; i >= 0; i--) {
        const def = inheritanceChain[i];
        // For each `hostVars`, we need to add the superclass amount.
        def.hostVars = hostVars += def.hostVars;
        // for each `hostAttrs` we need to merge it with superclass.
        def.hostAttrs = mergeHostAttrs(def.hostAttrs, (hostAttrs = mergeHostAttrs(hostAttrs, def.hostAttrs)));
    }
}
function maybeUnwrapEmpty(value) {
    if (value === EMPTY_OBJ) {
        return {};
    }
    else if (value === EMPTY_ARRAY) {
        return [];
    }
    else {
        return value;
    }
}
function inheritViewQuery(definition, superViewQuery) {
    const prevViewQuery = definition.viewQuery;
    if (prevViewQuery) {
        definition.viewQuery = (rf, ctx) => {
            superViewQuery(rf, ctx);
            prevViewQuery(rf, ctx);
        };
    }
    else {
        definition.viewQuery = superViewQuery;
    }
}
function inheritContentQueries(definition, superContentQueries) {
    const prevContentQueries = definition.contentQueries;
    if (prevContentQueries) {
        definition.contentQueries = (rf, ctx, directiveIndex) => {
            superContentQueries(rf, ctx, directiveIndex);
            prevContentQueries(rf, ctx, directiveIndex);
        };
    }
    else {
        definition.contentQueries = superContentQueries;
    }
}
function inheritHostBindings(definition, superHostBindings) {
    const prevHostBindings = definition.hostBindings;
    if (prevHostBindings) {
        definition.hostBindings = (rf, ctx) => {
            superHostBindings(rf, ctx);
            prevHostBindings(rf, ctx);
        };
    }
    else {
        definition.hostBindings = superHostBindings;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5oZXJpdF9kZWZpbml0aW9uX2ZlYXR1cmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL2ZlYXR1cmVzL2luaGVyaXRfZGVmaW5pdGlvbl9mZWF0dXJlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxZQUFZLEVBQW1CLE1BQU0sY0FBYyxDQUFDO0FBRTVELE9BQU8sRUFBQyxXQUFXLEVBQUUsU0FBUyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDeEQsT0FBTyxFQUFDLGNBQWMsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBV25ELE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUN6RCxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDbkQsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFMUQsTUFBTSxVQUFVLFlBQVksQ0FDMUIsSUFBZTtJQUVmLE9BQU8sTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsV0FBVyxDQUFDO0FBQzNELENBQUM7QUFJRDs7Ozs7R0FLRztBQUNILE1BQU0sVUFBVSwwQkFBMEIsQ0FDeEMsVUFBaUQ7SUFFakQsSUFBSSxTQUFTLEdBQUcsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QyxJQUFJLG1CQUFtQixHQUFHLElBQUksQ0FBQztJQUMvQixNQUFNLGdCQUFnQixHQUFrQixDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBRXJELE9BQU8sU0FBUyxFQUFFLENBQUM7UUFDakIsSUFBSSxRQUFRLEdBQXNELFNBQVMsQ0FBQztRQUM1RSxJQUFJLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO1lBQy9CLCtFQUErRTtZQUMvRSxRQUFRLEdBQUcsU0FBUyxD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QUcsVUFBVSxDQUFDLFlBQVksQ0FBQztJQUNqRCxJQUFJLGdCQUFnQixFQUFFLENBQUM7UUFDckIsVUFBVSxDQUFDLFlBQVksR0FBRyxDQUFDLEVBQWUsRUFBRSxHQUFRLEVBQUUsRUFBRTtZQUN0RCxpQkFBaUIsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDM0IsZ0JBQWdCLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzVCLENBQUMsQ0FBQztJQUNKLENBQUM7U0FBTSxDQUFDO1FBQ04sVUFBVSxDQUFDLFlBQVksR0FBRyxpQkFBaUIsQ0FBQztJQUM5QyxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1J1bnRpbWVFcnJvciwgUnVudGltZUVycm9yQ29kZX0gZnJvbSAnLi4vLi4vZXJyb3JzJztcbmltcG9ydCB7VHlwZSwgV3JpdGFibGV9IGZyb20gJy4uLy4uL2ludGVyZmFjZS90eXBlJztcbmltcG9ydCB7RU1QVFlfQVJSQVksIEVNUFRZX09CSn0gZnJvbSAnLi4vLi4vdXRpbC9lbXB0eSc7XG5pbXBvcnQge2ZpbGxQcm9wZXJ0aWVzfSBmcm9tICcuLi8uLi91dGlsL3Byb3BlcnR5JztcbmltcG9ydCB7XG4gIENvbXBvbmVudERlZixcbiAgQ29udGVudFF1ZXJpZXNGdW5jdGlvbixcbiAgRGlyZWN0aXZlRGVmLFxuICBEaXJlY3RpdmVEZWZGZWF0dXJlLFxuICBIb3N0QmluZGluZ3NGdW5jdGlvbixcbiAgUmVuZGVyRmxhZ3MsXG4gIFZpZXdRdWVyaWVzRnVuY3Rpb24sXG59IGZyb20gJy4uL2ludGVyZmFjZXMvZGVmaW5pdGlvbic7XG5pbXBvcnQge1RBdHRyaWJ1dGVzfSBmcm9tICcuLi9pbnRlcmZhY2VzL25vZGUnO1xuaW1wb3J0IHtpc0NvbXBvbmVudERlZn0gZnJvbSAnLi4vaW50ZXJmYWNlcy90eXBlX2NoZWNrcyc7XG5pbXBvcnQge21lcmdlSG9zdEF0dHJzfSBmcm9tICcuLi91dGlsL2F0dHJzX3V0aWxzJztcbmltcG9ydCB7c3RyaW5naWZ5Rm9yRXJyb3J9IGZyb20gJy4uL3V0aWwvc3RyaW5naWZ5X3V0aWxzJztcblxuZXhwb3J0IGZ1bmN0aW9uIGdldFN1cGVyVHlwZShcbiAgdHlwZTogVHlwZTxhbnk+LFxuKTogVHlwZTxhbnk+ICYge8m1Y21wPzogQ29tcG9uZW50RGVmPGFueT47IMm1ZGlyPzogRGlyZWN0aXZlRGVmPGFueT59IHtcbiAgcmV0dXJuIE9iamVjdC5nZXRQcm90b3R5cGVPZih0eXBlLnByb3RvdHlwZSkuY29uc3RydWN0b3I7XG59XG5cbnR5cGUgV3JpdGFibGVEZWYgPSBXcml0YWJsZTxEaXJlY3RpdmVEZWY8YW55PiB8IENvbXBvbmVudERlZjxhbnk+PjtcblxuLyoqXG4gKiBNZXJnZXMgdGhlIGRlZmluaXRpb24gZnJvbSBhIHN1cGVyIGNsYXNzIHRvIGEgc3ViIGNsYXNzLlxuICogQHBhcmFtIGRlZmluaXRpb24gVGhlIGRlZmluaXRpb24gdGhhdCBpcyBhIFN1YkNsYXNzIG9mIGFub3RoZXIgZGlyZWN0aXZlIG9mIGNvbXBvbmVudFxuICpcbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1SW5oZXJpdERlZmluaXRpb25GZWF0dXJlKFxuICBkZWZpbml0aW9uOiBEaXJlY3RpdmVEZWY8YW55PiB8IENvbXBvbmVudERlZjxhbnk+LFxuKTogdm9pZCB7XG4gIGxldCBzdXBlclR5cGUgPSBnZXRTdXBlclR5cGUoZGVmaW5pdGlvbi50eXBlKTtcbiAgbGV0IHNob3VsZEluaGVyaXRGaWVsZHMgPSB0cnVlO1xuICBjb25zdCBpbmhlcml0YW5jZUNoYWluOiBXcml0YWJsZURlZltdID0gW2RlZmluaXRpb25dO1xuXG4gIHdoaWxlIChzdXBlclR5cGUpIHtcbiAgICBsZXQgc3VwZXJEZWY6IERpcmVjdGl2ZURlZjxhbnk+IHwgQ29tcG9uZW50RGVmPGFueT4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgaWYgKGlzQ29tcG9uZW50RGVmKGRlZmluaXRpb24pKSB7XG4gICAgICAvLyBEb24ndCB1c2UgZ2V0Q29tcG9uZW50RGVmL2dldERpcmVjdGl2ZURlZi4gVGhpcyBsb2dpYyByZWxpZXMgb24gaW5oZXJpdGFuY2UuXG4gICAgICBzdXBlckRlZiA9IHN1cGVyVHlwZS7JtWNtcCB8fCBzdXBlclR5cGUuybVkaXI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChzdXBlclR5cGUuybVjbXApIHtcbiAgICAgICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgICAgICBSdW50aW1lRXJyb3JDb2RlLklOVkFMSURfSU5IRVJJVEFOQ0UsXG4gICAgICAgICAgbmdEZXZNb2RlICYmXG4gICAgICAgICAgICBgRGlyZWN0aXZlcyBjYW5ub3QgaW5oZXJpdCBDb21wb25lbnRzLiBEaXJlY3RpdmUgJHtzdHJpbmdpZnlGb3JFcnJvcihcbiAgICAgICAgICAgICAgZGVmaW5pdGlvbi50eXBlLFxuICAgICAgICAgICAgKX0gaXMgYXR0ZW1wdGluZyB0byBleHRlbmQgY29tcG9uZW50ICR7c3RyaW5naWZ5Rm9yRXJyb3Ioc3VwZXJUeXBlKX1gLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgLy8gRG9uJ3QgdXNlIGdldENvbXBvbmVudERlZi9nZXREaXJlY3RpdmVEZWYuIFRoaXMgbG9naWMgcmVsaWVzIG9uIGluaGVyaXRhbmNlLlxuICAgICAgc3VwZXJEZWYgPSBzdXBlclR5cGUuybVkaXI7XG4gICAgfVxuXG4gICAgaWYgKHN1cGVyRGVmKSB7XG4gICAgICBpZiAoc2hvdWxkSW5oZXJpdEZpZWxkcykge1xuICAgICAgICBpbmhlcml0YW5jZUNoYWluLnB1c2goc3VwZXJEZWYpO1xuICAgICAgICAvLyBTb21lIGZpZWxkcyBpbiB0aGUgZGVmaW5pdGlvbiBtYXkgYmUgZW1wdHksIGlmIHRoZXJlIHdlcmUgbm8gdmFsdWVzIHRvIHB1dCBpbiB0aGVtIHRoYXRcbiAgICAgICAgLy8gd291bGQndmUganVzdGlmaWVkIG9iamVjdCBjcmVhdGlvbi4gVW53cmFwIHRoZW0gaWYgbmVjZXNzYXJ5LlxuICAgICAgICBjb25zdCB3cml0ZWFibGVEZWYgPSBkZWZpbml0aW9uIGFzIFdyaXRhYmxlRGVmO1xuICAgICAgICB3cml0ZWFibGVEZWYuaW5wdXRzID0gbWF5YmVVbndyYXBFbXB0eShkZWZpbml0aW9uLmlucHV0cyk7XG4gICAgICAgIHdyaXRlYWJsZURlZi5pbnB1dFRyYW5zZm9ybXMgPSBtYXliZVVud3JhcEVtcHR5KGRlZmluaXRpb24uaW5wdXRUcmFuc2Zvcm1zKTtcbiAgICAgICAgd3JpdGVhYmxlRGVmLmRlY2xhcmVkSW5wdXRzID0gbWF5YmVVbndyYXBFbXB0eShkZWZpbml0aW9uLmRlY2xhcmVkSW5wdXRzKTtcbiAgICAgICAgd3JpdGVhYmxlRGVmLm91dHB1dHMgPSBtYXliZVVud3JhcEVtcHR5KGRlZmluaXRpb24ub3V0cHV0cyk7XG5cbiAgICAgICAgLy8gTWVyZ2UgaG9zdEJpbmRpbmdzXG4gICAgICAgIGNvbnN0IHN1cGVySG9zdEJpbmRpbmdzID0gc3VwZXJEZWYuaG9zdEJpbmRpbmdzO1xuICAgICAgICBzdXBlckhvc3RCaW5kaW5ncyAmJiBpbmhlcml0SG9zdEJpbmRpbmdzKGRlZmluaXRpb24sIHN1cGVySG9zdEJpbmRpbmdzKTtcblxuICAgICAgICAvLyBNZXJnZSBxdWVyaWVzXG4gICAgICAgIGNvbnN0IHN1cGVyVmlld1F1ZXJ5ID0gc3VwZXJEZWYudmlld1F1ZXJ5O1xuICAgICAgICBjb25zdCBzdXBlckNvbnRlbnRRdWVyaWVzID0gc3VwZXJEZWYuY29udGVudFF1ZXJpZXM7XG4gICAgICAgIHN1cGVyVmlld1F1ZXJ5ICYmIGluaGVyaXRWaWV3UXVlcnkoZGVmaW5pdGlvbiwgc3VwZXJWaWV3UXVlcnkpO1xuICAgICAgICBzdXBlckNvbnRlbnRRdWVyaWVzICYmIGluaGVyaXRDb250ZW50UXVlcmllcyhkZWZpbml0aW9uLCBzdXBlckNvbnRlbnRRdWVyaWVzKTtcblxuICAgICAgICAvLyBNZXJnZSBpbnB1dHMgYW5kIG91dHB1dHNcbiAgICAgICAgbWVyZ2VJbnB1dHNXaXRoVHJhbnNmb3JtcyhkZWZpbml0aW9uLCBzdXBlckRlZik7XG4gICAgICAgIGZpbGxQcm9wZXJ0aWVzKGRlZmluaXRpb24ub3V0cHV0cywgc3VwZXJEZWYub3V0cHV0cyk7XG5cbiAgICAgICAgLy8gTWVyZ2UgYW5pbWF0aW9ucyBtZXRhZGF0YS5cbiAgICAgICAgLy8gSWYgYHN1cGVyRGVmYCBpcyBhIENvbXBvbmVudCwgdGhlIGBkYXRhYCBmaWVsZCBpcyBwcmVzZW50IChkZWZhdWx0cyB0byBhbiBlbXB0eSBvYmplY3QpLlxuICAgICAgICBpZiAoaXNDb21wb25lbnREZWYoc3VwZXJEZWYpICYmIHN1cGVyRGVmLmRhdGEuYW5pbWF0aW9uKSB7XG4gICAgICAgICAgLy8gSWYgc3VwZXIgZGVmIGlzIGEgQ29tcG9uZW50LCB0aGUgYGRlZmluaXRpb25gIGlzIGFsc28gYSBDb21wb25lbnQsIHNpbmNlIERpcmVjdGl2ZXMgY2FuXG4gICAgICAgICAgLy8gbm90IGluaGVyaXQgQ29tcG9uZW50cyAod2UgdGhyb3cgYW4gZXJyb3IgYWJvdmUgYW5kIGNhbm5vdCByZWFjaCB0aGlzIGNvZGUpLlxuICAgICAgICAgIGNvbnN0IGRlZkRhdGEgPSAoZGVmaW5pdGlvbiBhcyBDb21wb25lbnREZWY8YW55PikuZGF0YTtcbiAgICAgICAgICBkZWZEYXRhLmFuaW1hdGlvbiA9IChkZWZEYXRhLmFuaW1hdGlvbiB8fCBbXSkuY29uY2F0KHN1cGVyRGVmLmRhdGEuYW5pbWF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBSdW4gcGFyZW50IGZlYXR1cmVzXG4gICAgICBjb25zdCBmZWF0dXJlcyA9IHN1cGVyRGVmLmZlYXR1cmVzO1xuICAgICAgaWYgKGZlYXR1cmVzKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZmVhdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBmZWF0dXJlID0gZmVhdHVyZXNbaV07XG4gICAgICAgICAgaWYgKGZlYXR1cmUgJiYgZmVhdHVyZS5uZ0luaGVyaXQpIHtcbiAgICAgICAgICAgIChmZWF0dXJlIGFzIERpcmVjdGl2ZURlZkZlYXR1cmUpKGRlZmluaXRpb24pO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBJZiBgSW5oZXJpdERlZmluaXRpb25GZWF0dXJlYCBpcyBhIHBhcnQgb2YgdGhlIGN1cnJlbnQgYHN1cGVyRGVmYCwgaXQgbWVhbnMgdGhhdCB0aGlzXG4gICAgICAgICAgLy8gZGVmIGFscmVhZHkgaGFzIGFsbCB0aGUgbmVjZXNzYXJ5IGluZm9ybWF0aW9uIGluaGVyaXRlZCBmcm9tIGl0cyBzdXBlciBjbGFzcyhlcyksIHNvIHdlXG4gICAgICAgICAgLy8gY2FuIHN0b3AgbWVyZ2luZyBmaWVsZHMgZnJvbSBzdXBlciBjbGFzc2VzLiBIb3dldmVyIHdlIG5lZWQgdG8gaXRlcmF0ZSB0aHJvdWdoIHRoZVxuICAgICAgICAgIC8vIHByb3RvdHlwZSBjaGFpbiB0byBsb29rIGZvciBjbGFzc2VzIHRoYXQgbWlnaHQgY29udGFpbiBvdGhlciBcImZlYXR1cmVzXCIgKGxpa2VcbiAgICAgICAgICAvLyBOZ09uQ2hhbmdlcyksIHdoaWNoIHdlIHNob3VsZCBpbnZva2UgZm9yIHRoZSBvcmlnaW5hbCBgZGVmaW5pdGlvbmAuIFdlIHNldCB0aGVcbiAgICAgICAgICAvLyBgc2hvdWxkSW5oZXJpdEZpZWxkc2AgZmxhZyB0byBpbmRpY2F0ZSB0aGF0LCBlc3NlbnRpYWxseSBza2lwcGluZyBmaWVsZHMgaW5oZXJpdGFuY2VcbiAgICAgICAgICAvLyBsb2dpYyBhbmQgb25seSBpbnZva2luZyBmdW5jdGlvbnMgZnJvbSB0aGUgXCJmZWF0dXJlc1wiIGxpc3QuXG4gICAgICAgICAgaWYgKGZlYXR1cmUgPT09IMm1ybVJbmhlcml0RGVmaW5pdGlvbkZlYXR1cmUpIHtcbiAgICAgICAgICAgIHNob3VsZEluaGVyaXRGaWVsZHMgPSBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBzdXBlclR5cGUgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2Yoc3VwZXJUeXBlKTtcbiAgfVxuICBtZXJnZUhvc3RBdHRyc0Fjcm9zc0luaGVyaXRhbmNlKGluaGVyaXRhbmNlQ2hhaW4pO1xufVxuXG5mdW5jdGlvbiBtZXJnZUlucHV0c1dpdGhUcmFuc2Zvcm1zPFQ+KHRhcmdldDogV3JpdGFibGVEZWYsIHNvdXJjZTogRGlyZWN0aXZlRGVmPGFueT4pIHtcbiAgZm9yIChjb25zdCBrZXkgaW4gc291cmNlLmlucHV0cykge1xuICAgIGlmICghc291cmNlLmlucHV0cy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHRhcmdldC5pbnB1dHMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gc291cmNlLmlucHV0c1trZXldO1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICB0YXJnZXQuaW5wdXRzW2tleV0gPSB2YWx1ZTtcbiAgICB0YXJnZXQuZGVjbGFyZWRJbnB1dHNba2V5XSA9IHNvdXJjZS5kZWNsYXJlZElucHV0c1trZXldO1xuXG4gICAgLy8gSWYgdGhlIGlucHV0IGlzIGluaGVyaXRlZCwgYW5kIHdlIGhhdmUgYSB0cmFuc2Zvcm0gZm9yIGl0LCB3ZSBhbHNvIGluaGVyaXQgaXQuXG4gICAgLy8gTm90ZSB0aGF0IHRyYW5zZm9ybXMgc2hvdWxkIG5vdCBiZSBpbmhlcml0ZWQgaWYgdGhlIGlucHV0IGhhcyBpdHMgb3duIG1ldGFkYXRhXG4gICAgLy8gaW4gdGhlIGBzb3VyY2VgIGRpcmVjdGl2ZSBpdHNlbGYgYWxyZWFkeSAoaS5lLiB0aGUgaW5wdXQgaXMgcmUtZGVjbGFyZWQvb3ZlcnJpZGRlbikuXG4gICAgaWYgKHNvdXJjZS5pbnB1dFRyYW5zZm9ybXMgIT09IG51bGwpIHtcbiAgICAgIC8vIE5vdGU6IHRyYW5zZm9ybXMgYXJlIHN0b3JlZCB3aXRoIHRoZWlyIG1pbmlmaWVkIG5hbWVzLlxuICAgICAgLy8gUGVyZjogb25seSBhY2Nlc3MgdGhlIG1pbmlmaWVkIG5hbWUgd2hlbiB0aGVyZSBhcmUgc291cmNlIHRyYW5zZm9ybXMuXG4gICAgICBjb25zdCBtaW5pZmllZE5hbWUgPSBBcnJheS5pc0FycmF5KHZhbHVlKSA/IHZhbHVlWzBdIDogdmFsdWU7XG4gICAgICBpZiAoIXNvdXJjZS5pbnB1dFRyYW5zZm9ybXMuaGFzT3duUHJvcGVydHkobWluaWZpZWROYW1lKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHRhcmdldC5pbnB1dFRyYW5zZm9ybXMgPz89IHt9O1xuICAgICAgdGFyZ2V0LmlucHV0VHJhbnNmb3Jtc1ttaW5pZmllZE5hbWVdID0gc291cmNlLmlucHV0VHJhbnNmb3Jtc1ttaW5pZmllZE5hbWVdO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIE1lcmdlIHRoZSBgaG9zdEF0dHJzYCBhbmQgYGhvc3RWYXJzYCBmcm9tIHRoZSBpbmhlcml0ZWQgcGFyZW50IHRvIHRoZSBiYXNlIGNsYXNzLlxuICpcbiAqIEBwYXJhbSBpbmhlcml0YW5jZUNoYWluIEEgbGlzdCBvZiBgV3JpdGFibGVEZWZzYCBzdGFydGluZyBhdCB0aGUgdG9wIG1vc3QgdHlwZSBhbmQgbGlzdGluZ1xuICogc3ViLXR5cGVzIGluIG9yZGVyLiBGb3IgZWFjaCB0eXBlIHRha2UgdGhlIGBob3N0QXR0cnNgIGFuZCBgaG9zdFZhcnNgIGFuZCBtZXJnZSBpdCB3aXRoIHRoZSBjaGlsZFxuICogdHlwZS5cbiAqL1xuZnVuY3Rpb24gbWVyZ2VIb3N0QXR0cnNBY3Jvc3NJbmhlcml0YW5jZShpbmhlcml0YW5jZUNoYWluOiBXcml0YWJsZURlZltdKSB7XG4gIGxldCBob3N0VmFyczogbnVtYmVyID0gMDtcbiAgbGV0IGhvc3RBdHRyczogVEF0dHJpYnV0ZXMgfCBudWxsID0gbnVsbDtcbiAgLy8gV2UgcHJvY2VzcyB0aGUgaW5oZXJpdGFuY2Ugb3JkZXIgZnJvbSB0aGUgYmFzZSB0byB0aGUgbGVhdmVzIGhlcmUuXG4gIGZvciAobGV0IGkgPSBpbmhlcml0YW5jZUNoYWluLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3QgZGVmID0gaW5oZXJpdGFuY2VDaGFpbltpXTtcbiAgICAvLyBGb3IgZWFjaCBgaG9zdFZhcnNgLCB3ZSBuZWVkIHRvIGFkZCB0aGUgc3VwZXJjbGFzcyBhbW91bnQuXG4gICAgZGVmLmhvc3RWYXJzID0gaG9zdFZhcnMgKz0gZGVmLmhvc3RWYXJzO1xuICAgIC8vIGZvciBlYWNoIGBob3N0QXR0cnNgIHdlIG5lZWQgdG8gbWVyZ2UgaXQgd2l0aCBzdXBlcmNsYXNzLlxuICAgIGRlZi5ob3N0QXR0cnMgPSBtZXJnZUhvc3RBdHRycyhcbiAgICAgIGRlZi5ob3N0QXR0cnMsXG4gICAgICAoaG9zdEF0dHJzID0gbWVyZ2VIb3N0QXR0cnMoaG9zdEF0dHJzLCBkZWYuaG9zdEF0dHJzKSksXG4gICAgKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBtYXliZVVud3JhcEVtcHR5PFQ+KHZhbHVlOiBUW10pOiBUW107XG5mdW5jdGlvbiBtYXliZVVud3JhcEVtcHR5PFQ+KHZhbHVlOiBUKTogVDtcbmZ1bmN0aW9uIG1heWJlVW53cmFwRW1wdHkodmFsdWU6IGFueSk6IGFueSB7XG4gIGlmICh2YWx1ZSA9PT0gRU1QVFlfT0JKKSB7XG4gICAgcmV0dXJuIHt9O1xuICB9IGVsc2UgaWYgKHZhbHVlID09PSBFTVBUWV9BUlJBWSkge1xuICAgIHJldHVybiBbXTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW5oZXJpdFZpZXdRdWVyeShkZWZpbml0aW9uOiBXcml0YWJsZURlZiwgc3VwZXJWaWV3UXVlcnk6IFZpZXdRdWVyaWVzRnVuY3Rpb248YW55Pikge1xuICBjb25zdCBwcmV2Vmlld1F1ZXJ5ID0gZGVmaW5pdGlvbi52aWV3UXVlcnk7XG4gIGlmIChwcmV2Vmlld1F1ZXJ5KSB7XG4gICAgZGVmaW5pdGlvbi52aWV3UXVlcnkgPSAocmYsIGN0eCkgPT4ge1xuICAgICAgc3VwZXJWaWV3UXVlcnkocmYsIGN0eCk7XG4gICAgICBwcmV2Vmlld1F1ZXJ5KHJmLCBjdHgpO1xuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgZGVmaW5pdGlvbi52aWV3UXVlcnkgPSBzdXBlclZpZXdRdWVyeTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpbmhlcml0Q29udGVudFF1ZXJpZXMoXG4gIGRlZmluaXRpb246IFdyaXRhYmxlRGVmLFxuICBzdXBlckNvbnRlbnRRdWVyaWVzOiBDb250ZW50UXVlcmllc0Z1bmN0aW9uPGFueT4sXG4pIHtcbiAgY29uc3QgcHJldkNvbnRlbnRRdWVyaWVzID0gZGVmaW5pdGlvbi5jb250ZW50UXVlcmllcztcbiAgaWYgKHByZXZDb250ZW50UXVlcmllcykge1xuICAgIGRlZmluaXRpb24uY29udGVudFF1ZXJpZXMgPSAocmYsIGN0eCwgZGlyZWN0aXZlSW5kZXgpID0+IHtcbiAgICAgIHN1cGVyQ29udGVudFF1ZXJpZXMocmYsIGN0eCwgZGlyZWN0aXZlSW5kZXgpO1xuICAgICAgcHJldkNvbnRlbnRRdWVyaWVzKHJmLCBjdHgsIGRpcmVjdGl2ZUluZGV4KTtcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIGRlZmluaXRpb24uY29udGVudFF1ZXJpZXMgPSBzdXBlckNvbnRlbnRRdWVyaWVzO1xuICB9XG59XG5cbmZ1bmN0aW9uIGluaGVyaXRIb3N0QmluZGluZ3MoXG4gIGRlZmluaXRpb246IFdyaXRhYmxlRGVmLFxuICBzdXBlckhvc3RCaW5kaW5nczogSG9zdEJpbmRpbmdzRnVuY3Rpb248YW55Pixcbikge1xuICBjb25zdCBwcmV2SG9zdEJpbmRpbmdzID0gZGVmaW5pdGlvbi5ob3N0QmluZGluZ3M7XG4gIGlmIChwcmV2SG9zdEJpbmRpbmdzKSB7XG4gICAgZGVmaW5pdGlvbi5ob3N0QmluZGluZ3MgPSAocmY6IFJlbmRlckZsYWdzLCBjdHg6IGFueSkgPT4ge1xuICAgICAgc3VwZXJIb3N0QmluZGluZ3MocmYsIGN0eCk7XG4gICAgICBwcmV2SG9zdEJpbmRpbmdzKHJmLCBjdHgpO1xuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgZGVmaW5pdGlvbi5ob3N0QmluZGluZ3MgPSBzdXBlckhvc3RCaW5kaW5ncztcbiAgfVxufVxuIl19