/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { formatRuntimeError, RuntimeError } from '../../errors';
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '../../metadata/schema';
import { throwError } from '../../util/assert';
import { getComponentDef } from '../definition';
import { CONTEXT, DECLARATION_COMPONENT_VIEW } from '../interfaces/view';
import { isAnimationProp } from '../util/attrs_utils';
let shouldThrowErrorOnUnknownElement = false;
/**
 * Sets a strict mode for JIT-compiled components to throw an error on unknown elements,
 * instead of just logging the error.
 * (for AOT-compiled ones this check happens at build time).
 */
export function ɵsetUnknownElementStrictMode(shouldThrow) {
    shouldThrowErrorOnUnknownElement = shouldThrow;
}
/**
 * Gets the current value of the strict mode.
 */
export function ɵgetUnknownElementStrictMode() {
    return shouldThrowErrorOnUnknownElement;
}
let shouldThrowErrorOnUnknownProperty = false;
/**
 * Sets a strict mode for JIT-compiled components to throw an error on unknown properties,
 * instead of just logging the error.
 * (for AOT-compiled ones this check happens at build time).
 */
export function ɵsetUnknownPropertyStrictMode(shouldThrow) {
    shouldThrowErrorOnUnknownProperty = shouldThrow;
}
/**
 * Gets the current value of the strict mode.
 */
export function ɵgetUnknownPropertyStrictMode() {
    return shouldThrowErrorOnUnknownProperty;
}
/**
 * Validates that the element is known at runtime and produces
 * an error if it's not the case.
 * This check is relevant for JIT-compiled components (for AOT-compiled
 * ones this check happens at build time).
 *
 * The element is considered known if either:
 * - it's a known HTML element
 * - it's a known custom element
 * - the element matches any directive
 * - the element is allowed by one of the schemas
 *
 * @param element Element to validate
 * @param lView An `LView` that represents a current component that is being rendered
 * @param tagName Name of the tag to check
 * @param schemas Array of schemas
 * @param hasDirectives Boolean indicating that the element matches any directive
 */
export function validateElementIsKnown(element, lView, tagName, schemas, hasDirectives) {
    // If `schemas` is set to `null`, that's an indication that this Component was compiled in AOT
    // mode where this check happens at compile time. In JIT mode, `schemas` is always present and
    // defined as an array (as an empty array in case `schemas` field is not defined) and we should
    // execute the check below.
    if (schemas === null)
        return;
    // If the element matches any directive, it's considered as valid.
    if (!hasDirectives && tagName !== null) {
        // The element is unknown if it's an instance of HTMLUnknownElement, or it isn't registered
        // as a custom element. Note that unknown elements with a dash in their name won't be instances
        // of HTMLUnknownElement in browsers that support web components.
        const isUnknown = 
        // Note that we can't check for `typeof HTMLUnknownElement === 'function'` because
        // Domino doesn't expose HTMLUnknownElement globally.
        (typeof HTMLUnknownElement !== 'undefined' &&
            HTMLUnknownElement &&
            element instanceof HTMLUnknownElement) ||
            (typeof customElements !== 'undefined' &&
                tagName.indexOf('-') > -1 &&
                !customElements.get(tagName));
        if (isUnknown && !matchingSchemas(schemas, tagName)) {
            const isHostStandalone = isHostComponentStandalone(lView);
            const templateLocation = getTemplateLocationDetails(lView);
            const schemas = `'${isHostStandalone ? '@Component' : '@NgModule'}.schemas'`;
            let message = `'${tagName}' is not a known element${templateLocation}:\n`;
            message += `1. If '${tagName}' is an Angular component, then verify that it is ${isHostStandalone
                ? "included in the '@Component.imports' of this component"
                : 'a part of an @NgModule where this component is declared'}.\n`;
            if (tagName && tagName.indexOf('-') > -1) {
                message += `2. If '${tagName}' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the ${schemas} of this component to suppress this message.`;
            }
            else {
                message += `2. To allow any element add 'NO_ERRORS_SCHEMA' to the ${schemas} of this component.`;
            }
            if (shouldThrowErrorOnUnknownElement) {
                throw new RuntimeError(304 /* RuntimeErrorCode.UNKNOWN_ELEMENT */, message);
            }
            else {
                console.error(formatRuntimeError(304 /* RuntimeErrorCode.UNKNOWN_ELEMENT */, message));
            }
        }
    }
}
/**
 * Validates that the property of the element is known at runtime and returns
 * false if it's not the case.
 * This check is relevant for JIT-compiled components (for AOT-compiled
 * ones this check happens at build time).
 *
 * The property is considered known if either:
 * - it's a known property of the element
 * - the element is allowed by one of the schemas
 * - the property is used for animations
 *
 * @param element Element to validate
 * @param propName Name of the property to check
 * @param tagName Name of the tag hosting the property
 * @param schemas Array of schemas
 */
export function isPropertyValid(element, propName, tagName, schemas) {
    // If `schemas` is set to `null`, that's an indication that this Component was compiled in AOT
    // mode where this check happens at compile time. In JIT mode, `schemas` is always present and
    // defined as an array (as an empty array in case `schemas` field is not defined) and we should
    // execute the check below.
    if (schemas === null)
        return true;
    // The property is considered valid if the element matches the schema, it exists on the element,
    // or it is synthetic.
    if (matchingSchemas(schemas, tagName) || propName in element || isAnimationProp(propName)) {
        return true;
    }
    // Note: `typeof Node` returns 'function' in most browsers, but is undefined with domino.
    return typeof Node === 'undefined' || Node === null || !(element instanceof Node);
}
/**
 * Logs or throws an error that a property is not supported on an element.
 *
 * @param propName Name of the invalid property
 * @param tagName Name of the tag hosting the property
 * @param nodeType Type of the node hosting the property
 * @param lView An `LView` that represents a current component
 */
export function handleUnknownPropertyError(propName, tagName, nodeType, lView) {
    // Special-case a situation when a structural directive is applied to
    // an `<ng-template>` element, for example: `<ng-template *ngIf="true">`.
    // In this case the compiler generates the `ɵɵtemplate` instruction with
    // the `null` as the tagName. The directive matching logic at runtime relies
    // on this effect (see `isInlineTemplate`), thus using the 'ng-template' as
    // a default value of the `tNode.value` is not feasible at this moment.
    if (!tagName && nodeType === 4 /* TNodeType.Container */) {
        tagName = 'ng-template';
    }
    const isHostStandalone = isHostComponentStandalone(lView);
    const templateLocation = getTemplateLocationDetails(lView);
    let message = `Can't bind to '${propName}' since it isn't a known property of '${tagName}'${templateLocation}.`;
    const schemas = `'${isHostStandalone ? '@Component' : '@NgModule'}.schemas'`;
    const importLocation = isHostStandalone
        ? "included in the '@Component.imports' of this component"
        : 'a part of an @NgModule where this component is declared';
    if (KNOWN_CONTROL_FLOW_DIRECTIVES.has(propName)) {
        // Most likely this is a control flow directive (such as `*ngIf`) used in
        // a template, but the directive or the `CommonModule` is not imported.
        const correspondingImport = KNOWN_CONTROL_FLOW_DIRECTIVES.get(propName);
        message +=
            `\nIf the '${propName}' is an Angular control flow directive, ` +
                `please make sure that either the '${correspondingImport}' directive or the 'CommonModule' is ${importLocation}.`;
    }
    else {
        // May be an Angular component, which is not imported/declared?
        message +=
            `\n1. If '${tagName}' is an Angular component and it has the ` +
                `'${propName}' input, then verify that it is ${importLocation}.`;
        // May be a Web Component?
        if (tagName && tagName.indexOf('-') > -1) {
            message +=
                `\n2. If '${tagName}' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' ` +
                    `to the ${schemas} of this component to suppress this message.`;
            message +=
                `\n3. To allow any property add 'NO_ERRORS_SCHEMA' to ` +
                    `the ${schemas} of this component.`;
        }
        else {
            // If it's expected, the error can be suppressed by the `NO_ERRORS_SCHEMA` schema.
            message +=
                `\n2. To allow any property add 'NO_ERRORS_SCHEMA' to ` +
                    `the ${schemas} of this component.`;
        }
    }
    reportUnknownPropertyError(message);
}
export function reportUnknownPropertyError(message) {
    if (shouldThrowErrorOnUnknownProperty) {
        throw new RuntimeError(303 /* RuntimeErrorCode.UNKNOWN_BINDING */, message);
    }
    else {
        console.error(formatRuntimeError(303 /* RuntimeErrorCode.UNKNOWN_BINDING */, message));
    }
}
/**
 * WARNING: this is a **dev-mode only** function (thus should always be guarded by the `ngDevMode`)
 * and must **not** be used in production bundles. The function makes megamorphic reads, which might
 * be too slow for production mode and also it relies on the constructor function being available.
 *
 * Gets a reference to the host component def (where a current component is declared).
 *
 * @param lView An `LView` that represents a current component that is being rendered.
 */
export function getDeclarationComponentDef(lView) {
    !ngDevMode && throwError('Must never be called in production mode');
    const declarationLView = lView[DECLARATION_COMPONENT_VIEW];
    const context = declarationLView[CONTEXT];
    // Unable to obtain a context.
    if (!context)
        return null;
    return context.constructor ? getComponentDef(context.constructor) : null;
}
/**
 * WARNING: this is a **dev-mode only** function (thus should always be guarded by the `ngDevMode`)
 * and must **not** be used in production bundles. The function makes megamorphic reads, which might
 * be too slow for production mode.
 *
 * Checks if the current component is declared inside of a standalone component template.
 *
 * @param lView An `LView` that represents a current component that is being rendered.
 */
export function isHostComponentStandalone(lView) {
    !ngDevMode && throwError('Must never be called in production mode');
    const componentDef = getDeclarationComponentDef(lView);
    // Treat host component as non-standalone if we can't obtain the def.
    return !!componentDef?.standalone;
}
/**
 * WARNING: this is a **dev-mode only** function (thus should always be guarded by the `ngDevMode`)
 * and must **not** be used in production bundles. The function makes megamorphic reads, which might
 * be too slow for production mode.
 *
 * Constructs a string describing the location of the host component template. The function is used
 * in dev mode to produce error messages.
 *
 * @param lView An `LView` that represents a current component that is being rendered.
 */
export function getTemplateLocationDetails(lView) {
    !ngDevMode && throwError('Must never be called in production mode');
    const hostComponentDef = getDeclarationComponentDef(lView);
    const componentClassName = hostComponentDef?.type?.name;
    return componentClassName ? ` (used in the '${componentClassName}' component template)` : '';
}
/**
 * The set of known control flow directives and their corresponding imports.
 * We use this set to produce a more precises error message with a note
 * that the `CommonModule` should also be included.
 */
export const KNOWN_CONTROL_FLOW_DIRECTIVES = new Map([
    ['ngIf', 'NgIf'],
    ['ngFor', 'NgFor'],
    ['ngSwitchCase', 'NgSwitchCase'],
    ['ngSwitchDefault', 'NgSwitchDefault'],
]);
/**
 * Returns true if the tag name is allowed by specified schemas.
 * @param schemas Array of schemas
 * @param tagName Name of the tag
 */
export function matchingSchemas(schemas, tagName) {
    if (schemas !== null) {
        for (let i = 0; i < schemas.length; i++) {
            const schema = schemas[i];
            if (schema === NO_ERRORS_SCHEMA ||
                (schema === CUSTOM_ELEMENTS_SCHEMA && tagName && tagName.indexOf('-') > -1)) {
                return true;
            }
        }
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWxlbWVudF92YWxpZGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9pbnN0cnVjdGlvbnMvZWxlbWVudF92YWxpZGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxrQkFBa0IsRUFBRSxZQUFZLEVBQW1CLE1BQU0sY0FBYyxDQUFDO0FBRWhGLE9BQU8sRUFBQyxzQkFBc0IsRUFBRSxnQkFBZ0IsRUFBaUIsTUFBTSx1QkFBdUIsQ0FBQztBQUMvRixPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDN0MsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUk5QyxPQUFPLEVBQUMsT0FBTyxFQUFFLDBCQUEwQixFQUFRLE1BQU0sb0JBQW9CLENBQUM7QUFDOUUsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBRXBELElBQUksZ0NBQWdDLEdBQUcsS0FBSyxDQUFDO0FBRTdDOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsNEJBQTRCLENBQUMsV0FBb0I7SUFDL0QsZ0NBQWdDLEdBQUcsV0FBVyxDQUFDO0FBQ2pELENBQUM7QUFFRDs7R0FFRztBQUNILE1BQU0sVUFBVSw0QkFBNEI7SUFDMUMsT0FBTyxnQ0FBZ0MsQ0FBQztBQUMxQyxDQUFDO0FBRUQsSUFBSSxpQ0FBaUMsR0FBRyxLQUFLLENBQUM7QUFFOUM7Ozs7R0FJRztBQUNILE1BQU0sVUFBVSw2QkFBNkIsQ0FBQyxXQUFvQjtJQUNoRSxpQ0FBaUMsR0FBRyxXQUFXLENBQUM7QUFDbEQsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLDZCQUE2QjtJQUMzQyxPQUFPLGlDQUFpQyxDQUFDO0FBQzNDLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FpQkc7QUFDSCxNQUFNLFVB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WUFDMUIsSUFDRSxNQUFNLEtBQUssZ0JBQWdCO2dCQUMzQixDQUFDLE1BQU0sS0FBSyxzQkFBc0IsSUFBSSxPQUFPLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUMzRSxDQUFDO2dCQUNELE9BQU8sSUFBSSxDQUFDO1lBQ2QsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRUQsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Zm9ybWF0UnVudGltZUVycm9yLCBSdW50aW1lRXJyb3IsIFJ1bnRpbWVFcnJvckNvZGV9IGZyb20gJy4uLy4uL2Vycm9ycyc7XG5pbXBvcnQge1R5cGV9IGZyb20gJy4uLy4uL2ludGVyZmFjZS90eXBlJztcbmltcG9ydCB7Q1VTVE9NX0VMRU1FTlRTX1NDSEVNQSwgTk9fRVJST1JTX1NDSEVNQSwgU2NoZW1hTWV0YWRhdGF9IGZyb20gJy4uLy4uL21ldGFkYXRhL3NjaGVtYSc7XG5pbXBvcnQge3Rocm93RXJyb3J9IGZyb20gJy4uLy4uL3V0aWwvYXNzZXJ0JztcbmltcG9ydCB7Z2V0Q29tcG9uZW50RGVmfSBmcm9tICcuLi9kZWZpbml0aW9uJztcbmltcG9ydCB7Q29tcG9uZW50RGVmfSBmcm9tICcuLi9pbnRlcmZhY2VzL2RlZmluaXRpb24nO1xuaW1wb3J0IHtUTm9kZVR5cGV9IGZyb20gJy4uL2ludGVyZmFjZXMvbm9kZSc7XG5pbXBvcnQge1JDb21tZW50LCBSRWxlbWVudH0gZnJvbSAnLi4vaW50ZXJmYWNlcy9yZW5kZXJlcl9kb20nO1xuaW1wb3J0IHtDT05URVhULCBERUNMQVJBVElPTl9DT01QT05FTlRfVklFVywgTFZpZXd9IGZyb20gJy4uL2ludGVyZmFjZXMvdmlldyc7XG5pbXBvcnQge2lzQW5pbWF0aW9uUHJvcH0gZnJvbSAnLi4vdXRpbC9hdHRyc191dGlscyc7XG5cbmxldCBzaG91bGRUaHJvd0Vycm9yT25Vbmtub3duRWxlbWVudCA9IGZhbHNlO1xuXG4vKipcbiAqIFNldHMgYSBzdHJpY3QgbW9kZSBmb3IgSklULWNvbXBpbGVkIGNvbXBvbmVudHMgdG8gdGhyb3cgYW4gZXJyb3Igb24gdW5rbm93biBlbGVtZW50cyxcbiAqIGluc3RlYWQgb2YganVzdCBsb2dnaW5nIHRoZSBlcnJvci5cbiAqIChmb3IgQU9ULWNvbXBpbGVkIG9uZXMgdGhpcyBjaGVjayBoYXBwZW5zIGF0IGJ1aWxkIHRpbWUpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gybVzZXRVbmtub3duRWxlbWVudFN0cmljdE1vZGUoc2hvdWxkVGhyb3c6IGJvb2xlYW4pIHtcbiAgc2hvdWxkVGhyb3dFcnJvck9uVW5rbm93bkVsZW1lbnQgPSBzaG91bGRUaHJvdztcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBjdXJyZW50IHZhbHVlIG9mIHRoZSBzdHJpY3QgbW9kZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1Z2V0VW5rbm93bkVsZW1lbnRTdHJpY3RNb2RlKCkge1xuICByZXR1cm4gc2hvdWxkVGhyb3dFcnJvck9uVW5rbm93bkVsZW1lbnQ7XG59XG5cbmxldCBzaG91bGRUaHJvd0Vycm9yT25Vbmtub3duUHJvcGVydHkgPSBmYWxzZTtcblxuLyoqXG4gKiBTZXRzIGEgc3RyaWN0IG1vZGUgZm9yIEpJVC1jb21waWxlZCBjb21wb25lbnRzIHRvIHRocm93IGFuIGVycm9yIG9uIHVua25vd24gcHJvcGVydGllcyxcbiAqIGluc3RlYWQgb2YganVzdCBsb2dnaW5nIHRoZSBlcnJvci5cbiAqIChmb3IgQU9ULWNvbXBpbGVkIG9uZXMgdGhpcyBjaGVjayBoYXBwZW5zIGF0IGJ1aWxkIHRpbWUpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gybVzZXRVbmtub3duUHJvcGVydHlTdHJpY3RNb2RlKHNob3VsZFRocm93OiBib29sZWFuKSB7XG4gIHNob3VsZFRocm93RXJyb3JPblVua25vd25Qcm9wZXJ0eSA9IHNob3VsZFRocm93O1xufVxuXG4vKipcbiAqIEdldHMgdGhlIGN1cnJlbnQgdmFsdWUgb2YgdGhlIHN0cmljdCBtb2RlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gybVnZXRVbmtub3duUHJvcGVydHlTdHJpY3RNb2RlKCkge1xuICByZXR1cm4gc2hvdWxkVGhyb3dFcnJvck9uVW5rbm93blByb3BlcnR5O1xufVxuXG4vKipcbiAqIFZhbGlkYXRlcyB0aGF0IHRoZSBlbGVtZW50IGlzIGtub3duIGF0IHJ1bnRpbWUgYW5kIHByb2R1Y2VzXG4gKiBhbiBlcnJvciBpZiBpdCdzIG5vdCB0aGUgY2FzZS5cbiAqIFRoaXMgY2hlY2sgaXMgcmVsZXZhbnQgZm9yIEpJVC1jb21waWxlZCBjb21wb25lbnRzIChmb3IgQU9ULWNvbXBpbGVkXG4gKiBvbmVzIHRoaXMgY2hlY2sgaGFwcGVucyBhdCBidWlsZCB0aW1lKS5cbiAqXG4gKiBUaGUgZWxlbWVudCBpcyBjb25zaWRlcmVkIGtub3duIGlmIGVpdGhlcjpcbiAqIC0gaXQncyBhIGtub3duIEhUTUwgZWxlbWVudFxuICogLSBpdCdzIGEga25vd24gY3VzdG9tIGVsZW1lbnRcbiAqIC0gdGhlIGVsZW1lbnQgbWF0Y2hlcyBhbnkgZGlyZWN0aXZlXG4gKiAtIHRoZSBlbGVtZW50IGlzIGFsbG93ZWQgYnkgb25lIG9mIHRoZSBzY2hlbWFzXG4gKlxuICogQHBhcmFtIGVsZW1lbnQgRWxlbWVudCB0byB2YWxpZGF0ZVxuICogQHBhcmFtIGxWaWV3IEFuIGBMVmlld2AgdGhhdCByZXByZXNlbnRzIGEgY3VycmVudCBjb21wb25lbnQgdGhhdCBpcyBiZWluZyByZW5kZXJlZFxuICogQHBhcmFtIHRhZ05hbWUgTmFtZSBvZiB0aGUgdGFnIHRvIGNoZWNrXG4gKiBAcGFyYW0gc2NoZW1hcyBBcnJheSBvZiBzY2hlbWFzXG4gKiBAcGFyYW0gaGFzRGlyZWN0aXZlcyBCb29sZWFuIGluZGljYXRpbmcgdGhhdCB0aGUgZWxlbWVudCBtYXRjaGVzIGFueSBkaXJlY3RpdmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlRWxlbWVudElzS25vd24oXG4gIGVsZW1lbnQ6IFJFbGVtZW50LFxuICBsVmlldzogTFZpZXcsXG4gIHRhZ05hbWU6IHN0cmluZyB8IG51bGwsXG4gIHNjaGVtYXM6IFNjaGVtYU1ldGFkYXRhW10gfCBudWxsLFxuICBoYXNEaXJlY3RpdmVzOiBib29sZWFuLFxuKTogdm9pZCB7XG4gIC8vIElmIGBzY2hlbWFzYCBpcyBzZXQgdG8gYG51bGxgLCB0aGF0J3MgYW4gaW5kaWNhdGlvbiB0aGF0IHRoaXMgQ29tcG9uZW50IHdhcyBjb21waWxlZCBpbiBBT1RcbiAgLy8gbW9kZSB3aGVyZSB0aGlzIGNoZWNrIGhhcHBlbnMgYXQgY29tcGlsZSB0aW1lLiBJbiBKSVQgbW9kZSwgYHNjaGVtYXNgIGlzIGFsd2F5cyBwcmVzZW50IGFuZFxuICAvLyBkZWZpbmVkIGFzIGFuIGFycmF5IChhcyBhbiBlbXB0eSBhcnJheSBpbiBjYXNlIGBzY2hlbWFzYCBmaWVsZCBpcyBub3QgZGVmaW5lZCkgYW5kIHdlIHNob3VsZFxuICAvLyBleGVjdXRlIHRoZSBjaGVjayBiZWxvdy5cbiAgaWYgKHNjaGVtYXMgPT09IG51bGwpIHJldHVybjtcblxuICAvLyBJZiB0aGUgZWxlbWVudCBtYXRjaGVzIGFueSBkaXJlY3RpdmUsIGl0J3MgY29uc2lkZXJlZCBhcyB2YWxpZC5cbiAgaWYgKCFoYXNEaXJlY3RpdmVzICYmIHRhZ05hbWUgIT09IG51bGwpIHtcbiAgICAvLyBUaGUgZWxlbWVudCBpcyB1bmtub3duIGlmIGl0J3MgYW4gaW5zdGFuY2Ugb2YgSFRNTFVua25vd25FbGVtZW50LCBvciBpdCBpc24ndCByZWdpc3RlcmVkXG4gICAgLy8gYXMgYSBjdXN0b20gZWxlbWVudC4gTm90ZSB0aGF0IHVua25vd24gZWxlbWVudHMgd2l0aCBhIGRhc2ggaW4gdGhlaXIgbmFtZSB3b24ndCBiZSBpbnN0YW5jZXNcbiAgICAvLyBvZiBIVE1MVW5rbm93bkVsZW1lbnQgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IHdlYiBjb21wb25lbnRzLlxuICAgIGNvbnN0IGlzVW5rbm93biA9XG4gICAgICAvLyBOb3RlIHRoYXQgd2UgY2FuJ3QgY2hlY2sgZm9yIGB0eXBlb2YgSFRNTFVua25vd25FbGVtZW50ID09PSAnZnVuY3Rpb24nYCBiZWNhdXNlXG4gICAgICAvLyBEb21pbm8gZG9lc24ndCBleHBvc2UgSFRNTFVua25vd25FbGVtZW50IGdsb2JhbGx5LlxuICAgICAgKHR5cGVvZiBIVE1MVW5rbm93bkVsZW1lbnQgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICAgIEhUTUxVbmtub3duRWxlbWVudCAmJlxuICAgICAgICBlbGVtZW50IGluc3RhbmNlb2YgSFRNTFVua25vd25FbGVtZW50KSB8fFxuICAgICAgKHR5cGVvZiBjdXN0b21FbGVtZW50cyAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgICAgdGFnTmFtZS5pbmRleE9mKCctJykgPiAtMSAmJlxuICAgICAgICAhY3VzdG9tRWxlbWVudHMuZ2V0KHRhZ05hbWUpKTtcblxuICAgIGlmIChpc1Vua25vd24gJiYgIW1hdGNoaW5nU2NoZW1hcyhzY2hlbWFzLCB0YWdOYW1lKSkge1xuICAgICAgY29uc3QgaXNIb3N0U3RhbmRhbG9uZSA9IGlzSG9zdENvbXBvbmVudFN0YW5kYWxvbmUobFZpZXcpO1xuICAgICAgY29uc3QgdGVtcGxhdGVMb2NhdGlvbiA9IGdldFRlbXBsYXRlTG9jYXRpb25EZXRhaWxzKGxWaWV3KTtcbiAgICAgIGNvbnN0IHNjaGVtYXMgPSBgJyR7aXNIb3N0U3RhbmRhbG9uZSA/ICdAQ29tcG9uZW50JyA6ICdATmdNb2R1bGUnfS5zY2hlbWFzJ2A7XG5cbiAgICAgIGxldCBtZXNzYWdlID0gYCcke3RhZ05hbWV9JyBpcyBub3QgYSBrbm93biBlbGVtZW50JHt0ZW1wbGF0ZUxvY2F0aW9ufTpcXG5gO1xuICAgICAgbWVzc2FnZSArPSBgMS4gSWYgJyR7dGFnTmFtZX0nIGlzIGFuIEFuZ3VsYXIgY29tcG9uZW50LCB0aGVuIHZlcmlmeSB0aGF0IGl0IGlzICR7XG4gICAgICAgIGlzSG9zdFN0YW5kYWxvbmVcbiAgICAgICAgICA/IFwiaW5jbHVkZWQgaW4gdGhlICdAQ29tcG9uZW50LmltcG9ydHMnIG9mIHRoaXMgY29tcG9uZW50XCJcbiAgICAgICAgICA6ICdhIHBhcnQgb2YgYW4gQE5nTW9kdWxlIHdoZXJlIHRoaXMgY29tcG9uZW50IGlzIGRlY2xhcmVkJ1xuICAgICAgfS5cXG5gO1xuICAgICAgaWYgKHRhZ05hbWUgJiYgdGFnTmFtZS5pbmRleE9mKCctJykgPiAtMSkge1xuICAgICAgICBtZXNzYWdlICs9IGAyLiBJZiAnJHt0YWdOYW1lfScgaXMgYSBXZWIgQ29tcG9uZW50IHRoZW4gYWRkICdDVVNUT01fRUxFTUVOVFNfU0NIRU1BJyB0byB0aGUgJHtzY2hlbWFzfSBvZiB0aGlzIGNvbXBvbmVudCB0byBzdXBwcmVzcyB0aGlzIG1lc3NhZ2UuYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1lc3NhZ2UgKz0gYDIuIFRvIGFsbG93IGFueSBlbGVtZW50IGFkZCAnTk9fRVJST1JTX1NDSEVNQScgdG8gdGhlICR7c2NoZW1hc30gb2YgdGhpcyBjb21wb25lbnQuYDtcbiAgICAgIH1cbiAgICAgIGlmIChzaG91bGRUaHJvd0Vycm9yT25Vbmtub3duRWxlbWVudCkge1xuICAgICAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFJ1bnRpbWVFcnJvckNvZGUuVU5LTk9XTl9FTEVNRU5ULCBtZXNzYWdlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZm9ybWF0UnVudGltZUVycm9yKFJ1bnRpbWVFcnJvckNvZGUuVU5LTk9XTl9FTEVNRU5ULCBtZXNzYWdlKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogVmFsaWRhdGVzIHRoYXQgdGhlIHByb3BlcnR5IG9mIHRoZSBlbGVtZW50IGlzIGtub3duIGF0IHJ1bnRpbWUgYW5kIHJldHVybnNcbiAqIGZhbHNlIGlmIGl0J3Mgbm90IHRoZSBjYXNlLlxuICogVGhpcyBjaGVjayBpcyByZWxldmFudCBmb3IgSklULWNvbXBpbGVkIGNvbXBvbmVudHMgKGZvciBBT1QtY29tcGlsZWRcbiAqIG9uZXMgdGhpcyBjaGVjayBoYXBwZW5zIGF0IGJ1aWxkIHRpbWUpLlxuICpcbiAqIFRoZSBwcm9wZXJ0eSBpcyBjb25zaWRlcmVkIGtub3duIGlmIGVpdGhlcjpcbiAqIC0gaXQncyBhIGtub3duIHByb3BlcnR5IG9mIHRoZSBlbGVtZW50XG4gKiAtIHRoZSBlbGVtZW50IGlzIGFsbG93ZWQgYnkgb25lIG9mIHRoZSBzY2hlbWFzXG4gKiAtIHRoZSBwcm9wZXJ0eSBpcyB1c2VkIGZvciBhbmltYXRpb25zXG4gKlxuICogQHBhcmFtIGVsZW1lbnQgRWxlbWVudCB0byB2YWxpZGF0ZVxuICogQHBhcmFtIHByb3BOYW1lIE5hbWUgb2YgdGhlIHByb3BlcnR5IHRvIGNoZWNrXG4gKiBAcGFyYW0gdGFnTmFtZSBOYW1lIG9mIHRoZSB0YWcgaG9zdGluZyB0aGUgcHJvcGVydHlcbiAqIEBwYXJhbSBzY2hlbWFzIEFycmF5IG9mIHNjaGVtYXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUHJvcGVydHlWYWxpZChcbiAgZWxlbWVudDogUkVsZW1lbnQgfCBSQ29tbWVudCxcbiAgcHJvcE5hbWU6IHN0cmluZyxcbiAgdGFnTmFtZTogc3RyaW5nIHwgbnVsbCxcbiAgc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXSB8IG51bGwsXG4pOiBib29sZWFuIHtcbiAgLy8gSWYgYHNjaGVtYXNgIGlzIHNldCB0byBgbnVsbGAsIHRoYXQncyBhbiBpbmRpY2F0aW9uIHRoYXQgdGhpcyBDb21wb25lbnQgd2FzIGNvbXBpbGVkIGluIEFPVFxuICAvLyBtb2RlIHdoZXJlIHRoaXMgY2hlY2sgaGFwcGVucyBhdCBjb21waWxlIHRpbWUuIEluIEpJVCBtb2RlLCBgc2NoZW1hc2AgaXMgYWx3YXlzIHByZXNlbnQgYW5kXG4gIC8vIGRlZmluZWQgYXMgYW4gYXJyYXkgKGFzIGFuIGVtcHR5IGFycmF5IGluIGNhc2UgYHNjaGVtYXNgIGZpZWxkIGlzIG5vdCBkZWZpbmVkKSBhbmQgd2Ugc2hvdWxkXG4gIC8vIGV4ZWN1dGUgdGhlIGNoZWNrIGJlbG93LlxuICBpZiAoc2NoZW1hcyA9PT0gbnVsbCkgcmV0dXJuIHRydWU7XG5cbiAgLy8gVGhlIHByb3BlcnR5IGlzIGNvbnNpZGVyZWQgdmFsaWQgaWYgdGhlIGVsZW1lbnQgbWF0Y2hlcyB0aGUgc2NoZW1hLCBpdCBleGlzdHMgb24gdGhlIGVsZW1lbnQsXG4gIC8vIG9yIGl0IGlzIHN5bnRoZXRpYy5cbiAgaWYgKG1hdGNoaW5nU2NoZW1hcyhzY2hlbWFzLCB0YWdOYW1lKSB8fCBwcm9wTmFtZSBpbiBlbGVtZW50IHx8IGlzQW5pbWF0aW9uUHJvcChwcm9wTmFtZSkpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIE5vdGU6IGB0eXBlb2YgTm9kZWAgcmV0dXJucyAnZnVuY3Rpb24nIGluIG1vc3QgYnJvd3NlcnMsIGJ1dCBpcyB1bmRlZmluZWQgd2l0aCBkb21pbm8uXG4gIHJldHVybiB0eXBlb2YgTm9kZSA9PT0gJ3VuZGVmaW5lZCcgfHwgTm9kZSA9PT0gbnVsbCB8fCAhKGVsZW1lbnQgaW5zdGFuY2VvZiBOb2RlKTtcbn1cblxuLyoqXG4gKiBMb2dzIG9yIHRocm93cyBhbiBlcnJvciB0aGF0IGEgcHJvcGVydHkgaXMgbm90IHN1cHBvcnRlZCBvbiBhbiBlbGVtZW50LlxuICpcbiAqIEBwYXJhbSBwcm9wTmFtZSBOYW1lIG9mIHRoZSBpbnZhbGlkIHByb3BlcnR5XG4gKiBAcGFyYW0gdGFnTmFtZSBOYW1lIG9mIHRoZSB0YWcgaG9zdGluZyB0aGUgcHJvcGVydHlcbiAqIEBwYXJhbSBub2RlVHlwZSBUeXBlIG9mIHRoZSBub2RlIGhvc3RpbmcgdGhlIHByb3BlcnR5XG4gKiBAcGFyYW0gbFZpZXcgQW4gYExWaWV3YCB0aGF0IHJlcHJlc2VudHMgYSBjdXJyZW50IGNvbXBvbmVudFxuICovXG5leHBvcnQgZnVuY3Rpb24gaGFuZGxlVW5rbm93blByb3BlcnR5RXJyb3IoXG4gIHByb3BOYW1lOiBzdHJpbmcsXG4gIHRhZ05hbWU6IHN0cmluZyB8IG51bGwsXG4gIG5vZGVUeXBlOiBUTm9kZVR5cGUsXG4gIGxWaWV3OiBMVmlldyxcbik6IHZvaWQge1xuICAvLyBTcGVjaWFsLWNhc2UgYSBzaXR1YXRpb24gd2hlbiBhIHN0cnVjdHVyYWwgZGlyZWN0aXZlIGlzIGFwcGxpZWQgdG9cbiAgLy8gYW4gYDxuZy10ZW1wbGF0ZT5gIGVsZW1lbnQsIGZvciBleGFtcGxlOiBgPG5nLXRlbXBsYXRlICpuZ0lmPVwidHJ1ZVwiPmAuXG4gIC8vIEluIHRoaXMgY2FzZSB0aGUgY29tcGlsZXIgZ2VuZXJhdGVzIHRoZSBgybXJtXRlbXBsYXRlYCBpbnN0cnVjdGlvbiB3aXRoXG4gIC8vIHRoZSBgbnVsbGAgYXMgdGhlIHRhZ05hbWUuIFRoZSBkaXJlY3RpdmUgbWF0Y2hpbmcgbG9naWMgYXQgcnVudGltZSByZWxpZXNcbiAgLy8gb24gdGhpcyBlZmZlY3QgKHNlZSBgaXNJbmxpbmVUZW1wbGF0ZWApLCB0aHVzIHVzaW5nIHRoZSAnbmctdGVtcGxhdGUnIGFzXG4gIC8vIGEgZGVmYXVsdCB2YWx1ZSBvZiB0aGUgYHROb2RlLnZhbHVlYCBpcyBub3QgZmVhc2libGUgYXQgdGhpcyBtb21lbnQuXG4gIGlmICghdGFnTmFtZSAmJiBub2RlVHlwZSA9PT0gVE5vZGVUeXBlLkNvbnRhaW5lcikge1xuICAgIHRhZ05hbWUgPSAnbmctdGVtcGxhdGUnO1xuICB9XG5cbiAgY29uc3QgaXNIb3N0U3RhbmRhbG9uZSA9IGlzSG9zdENvbXBvbmVudFN0YW5kYWxvbmUobFZpZXcpO1xuICBjb25zdCB0ZW1wbGF0ZUxvY2F0aW9uID0gZ2V0VGVtcGxhdGVMb2NhdGlvbkRldGFpbHMobFZpZXcpO1xuXG4gIGxldCBtZXNzYWdlID0gYENhbid0IGJpbmQgdG8gJyR7cHJvcE5hbWV9JyBzaW5jZSBpdCBpc24ndCBhIGtub3duIHByb3BlcnR5IG9mICcke3RhZ05hbWV9JyR7dGVtcGxhdGVMb2NhdGlvbn0uYDtcblxuICBjb25zdCBzY2hlbWFzID0gYCcke2lzSG9zdFN0YW5kYWxvbmUgPyAnQENvbXBvbmVudCcgOiAnQE5nTW9kdWxlJ30uc2NoZW1hcydgO1xuICBjb25zdCBpbXBvcnRMb2NhdGlvbiA9IGlzSG9zdFN0YW5kYWxvbmVcbiAgICA/IFwiaW5jbHVkZWQgaW4gdGhlICdAQ29tcG9uZW50LmltcG9ydHMnIG9mIHRoaXMgY29tcG9uZW50XCJcbiAgICA6ICdhIHBhcnQgb2YgYW4gQE5nTW9kdWxlIHdoZXJlIHRoaXMgY29tcG9uZW50IGlzIGRlY2xhcmVkJztcbiAgaWYgKEtOT1dOX0NPTlRST0xfRkxPV19ESVJFQ1RJVkVTLmhhcyhwcm9wTmFtZSkpIHtcbiAgICAvLyBNb3N0IGxpa2VseSB0aGlzIGlzIGEgY29udHJvbCBmbG93IGRpcmVjdGl2ZSAoc3VjaCBhcyBgKm5nSWZgKSB1c2VkIGluXG4gICAgLy8gYSB0ZW1wbGF0ZSwgYnV0IHRoZSBkaXJlY3RpdmUgb3IgdGhlIGBDb21tb25Nb2R1bGVgIGlzIG5vdCBpbXBvcnRlZC5cbiAgICBjb25zdCBjb3JyZXNwb25kaW5nSW1wb3J0ID0gS05PV05fQ09OVFJPTF9GTE9XX0RJUkVDVElWRVMuZ2V0KHByb3BOYW1lKTtcbiAgICBtZXNzYWdlICs9XG4gICAgICBgXFxuSWYgdGhlICcke3Byb3BOYW1lfScgaXMgYW4gQW5ndWxhciBjb250cm9sIGZsb3cgZGlyZWN0aXZlLCBgICtcbiAgICAgIGBwbGVhc2UgbWFrZSBzdXJlIHRoYXQgZWl0aGVyIHRoZSAnJHtjb3JyZXNwb25kaW5nSW1wb3J0fScgZGlyZWN0aXZlIG9yIHRoZSAnQ29tbW9uTW9kdWxlJyBpcyAke2ltcG9ydExvY2F0aW9ufS5gO1xuICB9IGVsc2Uge1xuICAgIC8vIE1heSBiZSBhbiBBbmd1bGFyIGNvbXBvbmVudCwgd2hpY2ggaXMgbm90IGltcG9ydGVkL2RlY2xhcmVkP1xuICAgIG1lc3NhZ2UgKz1cbiAgICAgIGBcXG4xLiBJZiAnJHt0YWdOYW1lfScgaXMgYW4gQW5ndWxhciBjb21wb25lbnQgYW5kIGl0IGhhcyB0aGUgYCArXG4gICAgICBgJyR7cHJvcE5hbWV9JyBpbnB1dCwgdGhlbiB2ZXJpZnkgdGhhdCBpdCBpcyAke2ltcG9ydExvY2F0aW9ufS5gO1xuICAgIC8vIE1heSBiZSBhIFdlYiBDb21wb25lbnQ/XG4gICAgaWYgKHRhZ05hbWUgJiYgdGFnTmFtZS5pbmRleE9mKCctJykgPiAtMSkge1xuICAgICAgbWVzc2FnZSArPVxuICAgICAgICBgXFxuMi4gSWYgJyR7dGFnTmFtZX0nIGlzIGEgV2ViIENvbXBvbmVudCB0aGVuIGFkZCAnQ1VTVE9NX0VMRU1FTlRTX1NDSEVNQScgYCArXG4gICAgICAgIGB0byB0aGUgJHtzY2hlbWFzfSBvZiB0aGlzIGNvbXBvbmVudCB0byBzdXBwcmVzcyB0aGlzIG1lc3NhZ2UuYDtcbiAgICAgIG1lc3NhZ2UgKz1cbiAgICAgICAgYFxcbjMuIFRvIGFsbG93IGFueSBwcm9wZXJ0eSBhZGQgJ05PX0VSUk9SU19TQ0hFTUEnIHRvIGAgK1xuICAgICAgICBgdGhlICR7c2NoZW1hc30gb2YgdGhpcyBjb21wb25lbnQuYDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSWYgaXQncyBleHBlY3RlZCwgdGhlIGVycm9yIGNhbiBiZSBzdXBwcmVzc2VkIGJ5IHRoZSBgTk9fRVJST1JTX1NDSEVNQWAgc2NoZW1hLlxuICAgICAgbWVzc2FnZSArPVxuICAgICAgICBgXFxuMi4gVG8gYWxsb3cgYW55IHByb3BlcnR5IGFkZCAnTk9fRVJST1JTX1NDSEVNQScgdG8gYCArXG4gICAgICAgIGB0aGUgJHtzY2hlbWFzfSBvZiB0aGlzIGNvbXBvbmVudC5gO1xuICAgIH1cbiAgfVxuXG4gIHJlcG9ydFVua25vd25Qcm9wZXJ0eUVycm9yKG1lc3NhZ2UpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVwb3J0VW5rbm93blByb3BlcnR5RXJyb3IobWVzc2FnZTogc3RyaW5nKSB7XG4gIGlmIChzaG91bGRUaHJvd0Vycm9yT25Vbmtub3duUHJvcGVydHkpIHtcbiAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFJ1bnRpbWVFcnJvckNvZGUuVU5LTk9XTl9CSU5ESU5HLCBtZXNzYWdlKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKGZvcm1hdFJ1bnRpbWVFcnJvcihSdW50aW1lRXJyb3JDb2RlLlVOS05PV05fQklORElORywgbWVzc2FnZSkpO1xuICB9XG59XG5cbi8qKlxuICogV0FSTklORzogdGhpcyBpcyBhICoqZGV2LW1vZGUgb25seSoqIGZ1bmN0aW9uICh0aHVzIHNob3VsZCBhbHdheXMgYmUgZ3VhcmRlZCBieSB0aGUgYG5nRGV2TW9kZWApXG4gKiBhbmQgbXVzdCAqKm5vdCoqIGJlIHVzZWQgaW4gcHJvZHVjdGlvbiBidW5kbGVzLiBUaGUgZnVuY3Rpb24gbWFrZXMgbWVnYW1vcnBoaWMgcmVhZHMsIHdoaWNoIG1pZ2h0XG4gKiBiZSB0b28gc2xvdyBmb3IgcHJvZHVjdGlvbiBtb2RlIGFuZCBhbHNvIGl0IHJlbGllcyBvbiB0aGUgY29uc3RydWN0b3IgZnVuY3Rpb24gYmVpbmcgYXZhaWxhYmxlLlxuICpcbiAqIEdldHMgYSByZWZlcmVuY2UgdG8gdGhlIGhvc3QgY29tcG9uZW50IGRlZiAod2hlcmUgYSBjdXJyZW50IGNvbXBvbmVudCBpcyBkZWNsYXJlZCkuXG4gKlxuICogQHBhcmFtIGxWaWV3IEFuIGBMVmlld2AgdGhhdCByZXByZXNlbnRzIGEgY3VycmVudCBjb21wb25lbnQgdGhhdCBpcyBiZWluZyByZW5kZXJlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldERlY2xhcmF0aW9uQ29tcG9uZW50RGVmKGxWaWV3OiBMVmlldyk6IENvbXBvbmVudERlZjx1bmtub3duPiB8IG51bGwge1xuICAhbmdEZXZNb2RlICYmIHRocm93RXJyb3IoJ011c3QgbmV2ZXIgYmUgY2FsbGVkIGluIHByb2R1Y3Rpb24gbW9kZScpO1xuXG4gIGNvbnN0IGRlY2xhcmF0aW9uTFZpZXcgPSBsVmlld1tERUNMQVJBVElPTl9DT01QT05FTlRfVklFV10gYXMgTFZpZXc8VHlwZTx1bmtub3duPj47XG4gIGNvbnN0IGNvbnRleHQgPSBkZWNsYXJhdGlvbkxWaWV3W0NPTlRFWFRdO1xuXG4gIC8vIFVuYWJsZSB0byBvYnRhaW4gYSBjb250ZXh0LlxuICBpZiAoIWNvbnRleHQpIHJldHVybiBudWxsO1xuXG4gIHJldHVybiBjb250ZXh0LmNvbnN0cnVjdG9yID8gZ2V0Q29tcG9uZW50RGVmKGNvbnRleHQuY29uc3RydWN0b3IpIDogbnVsbDtcbn1cblxuLyoqXG4gKiBXQVJOSU5HOiB0aGlzIGlzIGEgKipkZXYtbW9kZSBvbmx5KiogZnVuY3Rpb24gKHRodXMgc2hvdWxkIGFsd2F5cyBiZSBndWFyZGVkIGJ5IHRoZSBgbmdEZXZNb2RlYClcbiAqIGFuZCBtdXN0ICoqbm90KiogYmUgdXNlZCBpbiBwcm9kdWN0aW9uIGJ1bmRsZXMuIFRoZSBmdW5jdGlvbiBtYWtlcyBtZWdhbW9ycGhpYyByZWFkcywgd2hpY2ggbWlnaHRcbiAqIGJlIHRvbyBzbG93IGZvciBwcm9kdWN0aW9uIG1vZGUuXG4gKlxuICogQ2hlY2tzIGlmIHRoZSBjdXJyZW50IGNvbXBvbmVudCBpcyBkZWNsYXJlZCBpbnNpZGUgb2YgYSBzdGFuZGFsb25lIGNvbXBvbmVudCB0ZW1wbGF0ZS5cbiAqXG4gKiBAcGFyYW0gbFZpZXcgQW4gYExWaWV3YCB0aGF0IHJlcHJlc2VudHMgYSBjdXJyZW50IGNvbXBvbmVudCB0aGF0IGlzIGJlaW5nIHJlbmRlcmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNIb3N0Q29tcG9uZW50U3RhbmRhbG9uZShsVmlldzogTFZpZXcpOiBib29sZWFuIHtcbiAgIW5nRGV2TW9kZSAmJiB0aHJvd0Vycm9yKCdNdXN0IG5ldmVyIGJlIGNhbGxlZCBpbiBwcm9kdWN0aW9uIG1vZGUnKTtcblxuICBjb25zdCBjb21wb25lbnREZWYgPSBnZXREZWNsYXJhdGlvbkNvbXBvbmVudERlZihsVmlldyk7XG4gIC8vIFRyZWF0IGhvc3QgY29tcG9uZW50IGFzIG5vbi1zdGFuZGFsb25lIGlmIHdlIGNhbid0IG9idGFpbiB0aGUgZGVmLlxuICByZXR1cm4gISFjb21wb25lbnREZWY/LnN0YW5kYWxvbmU7XG59XG5cbi8qKlxuICogV0FSTklORzogdGhpcyBpcyBhICoqZGV2LW1vZGUgb25seSoqIGZ1bmN0aW9uICh0aHVzIHNob3VsZCBhbHdheXMgYmUgZ3VhcmRlZCBieSB0aGUgYG5nRGV2TW9kZWApXG4gKiBhbmQgbXVzdCAqKm5vdCoqIGJlIHVzZWQgaW4gcHJvZHVjdGlvbiBidW5kbGVzLiBUaGUgZnVuY3Rpb24gbWFrZXMgbWVnYW1vcnBoaWMgcmVhZHMsIHdoaWNoIG1pZ2h0XG4gKiBiZSB0b28gc2xvdyBmb3IgcHJvZHVjdGlvbiBtb2RlLlxuICpcbiAqIENvbnN0cnVjdHMgYSBzdHJpbmcgZGVzY3JpYmluZyB0aGUgbG9jYXRpb24gb2YgdGhlIGhvc3QgY29tcG9uZW50IHRlbXBsYXRlLiBUaGUgZnVuY3Rpb24gaXMgdXNlZFxuICogaW4gZGV2IG1vZGUgdG8gcHJvZHVjZSBlcnJvciBtZXNzYWdlcy5cbiAqXG4gKiBAcGFyYW0gbFZpZXcgQW4gYExWaWV3YCB0aGF0IHJlcHJlc2VudHMgYSBjdXJyZW50IGNvbXBvbmVudCB0aGF0IGlzIGJlaW5nIHJlbmRlcmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0VGVtcGxhdGVMb2NhdGlvbkRldGFpbHMobFZpZXc6IExWaWV3KTogc3RyaW5nIHtcbiAgIW5nRGV2TW9kZSAmJiB0aHJvd0Vycm9yKCdNdXN0IG5ldmVyIGJlIGNhbGxlZCBpbiBwcm9kdWN0aW9uIG1vZGUnKTtcblxuICBjb25zdCBob3N0Q29tcG9uZW50RGVmID0gZ2V0RGVjbGFyYXRpb25Db21wb25lbnREZWYobFZpZXcpO1xuICBjb25zdCBjb21wb25lbnRDbGFzc05hbWUgPSBob3N0Q29tcG9uZW50RGVmPy50eXBlPy5uYW1lO1xuICByZXR1cm4gY29tcG9uZW50Q2xhc3NOYW1lID8gYCAodXNlZCBpbiB0aGUgJyR7Y29tcG9uZW50Q2xhc3NOYW1lfScgY29tcG9uZW50IHRlbXBsYXRlKWAgOiAnJztcbn1cblxuLyoqXG4gKiBUaGUgc2V0IG9mIGtub3duIGNvbnRyb2wgZmxvdyBkaXJlY3RpdmVzIGFuZCB0aGVpciBjb3JyZXNwb25kaW5nIGltcG9ydHMuXG4gKiBXZSB1c2UgdGhpcyBzZXQgdG8gcHJvZHVjZSBhIG1vcmUgcHJlY2lzZXMgZXJyb3IgbWVzc2FnZSB3aXRoIGEgbm90ZVxuICogdGhhdCB0aGUgYENvbW1vbk1vZHVsZWAgc2hvdWxkIGFsc28gYmUgaW5jbHVkZWQuXG4gKi9cbmV4cG9ydCBjb25zdCBLTk9XTl9DT05UUk9MX0ZMT1dfRElSRUNUSVZFUyA9IG5ldyBNYXAoW1xuICBbJ25nSWYnLCAnTmdJZiddLFxuICBbJ25nRm9yJywgJ05nRm9yJ10sXG4gIFsnbmdTd2l0Y2hDYXNlJywgJ05nU3dpdGNoQ2FzZSddLFxuICBbJ25nU3dpdGNoRGVmYXVsdCcsICdOZ1N3aXRjaERlZmF1bHQnXSxcbl0pO1xuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIHRhZyBuYW1lIGlzIGFsbG93ZWQgYnkgc3BlY2lmaWVkIHNjaGVtYXMuXG4gKiBAcGFyYW0gc2NoZW1hcyBBcnJheSBvZiBzY2hlbWFzXG4gKiBAcGFyYW0gdGFnTmFtZSBOYW1lIG9mIHRoZSB0YWdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoaW5nU2NoZW1hcyhzY2hlbWFzOiBTY2hlbWFNZXRhZGF0YVtdIHwgbnVsbCwgdGFnTmFtZTogc3RyaW5nIHwgbnVsbCk6IGJvb2xlYW4ge1xuICBpZiAoc2NoZW1hcyAhPT0gbnVsbCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2NoZW1hcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgc2NoZW1hID0gc2NoZW1hc1tpXTtcbiAgICAgIGlmIChcbiAgICAgICAgc2NoZW1hID09PSBOT19FUlJPUlNfU0NIRU1BIHx8XG4gICAgICAgIChzY2hlbWEgPT09IENVU1RPTV9FTEVNRU5UU19TQ0hFTUEgJiYgdGFnTmFtZSAmJiB0YWdOYW1lLmluZGV4T2YoJy0nKSA+IC0xKVxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cbiJdfQ==