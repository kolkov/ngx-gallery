/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { unwrapSafeValue } from '../../sanitization/bypass';
import { keyValueArrayGet, keyValueArraySet } from '../../util/array_utils';
import { assertDefined, assertEqual, assertLessThan, assertNotEqual, throwError, } from '../../util/assert';
import { EMPTY_ARRAY } from '../../util/empty';
import { concatStringsWithSpace, stringify } from '../../util/stringify';
import { assertFirstUpdatePass } from '../assert';
import { bindingUpdated } from '../bindings';
import { getTStylingRangeNext, getTStylingRangeNextDuplicate, getTStylingRangePrev, getTStylingRangePrevDuplicate, } from '../interfaces/styling';
import { RENDERER } from '../interfaces/view';
import { applyStyling } from '../node_manipulation';
import { getCurrentDirectiveDef, getLView, getSelectedIndex, getTView, incrementBindingIndex, } from '../state';
import { insertTStylingBinding } from '../styling/style_binding_list';
import { getLastParsedKey, getLastParsedValue, parseClassName, parseClassNameNext, parseStyle, parseStyleNext, } from '../styling/styling_parser';
import { NO_CHANGE } from '../tokens';
import { getNativeByIndex } from '../util/view_utils';
import { setDirectiveInputsWhichShadowsStyling } from './property';
/**
 * Update a style binding on an element with the provided value.
 *
 * If the style value is falsy then it will be removed from the element
 * (or assigned a different value depending if there are any styles placed
 * on the element with `styleMap` or any static styles that are
 * present from when the element was created with `styling`).
 *
 * Note that the styling element is updated as part of `stylingApply`.
 *
 * @param prop A valid CSS property.
 * @param value New value to write (`null` or an empty string to remove).
 * @param suffix Optional suffix. Used with scalar values to add unit such as `px`.
 *
 * Note that this will apply the provided style value to the host element if this function is called
 * within a host binding function.
 *
 * @codeGenApi
 */
export function ɵɵstyleProp(prop, value, suffix) {
    checkStylingProperty(prop, value, suffix, false);
    return ɵɵstyleProp;
}
/**
 * Update a class binding on an element with the provided value.
 *
 * This instruction is meant to handle the `[class.foo]="exp"` case and,
 * therefore, the class binding itself must already be allocated using
 * `styling` within the creation block.
 *
 * @param prop A valid CSS class (only one).
 * @param value A true/false value which will turn the class on or off.
 *
 * Note that this will apply the provided class value to the host element if this function
 * is called within a host binding function.
 *
 * @codeGenApi
 */
export function ɵɵclassProp(className, value) {
    checkStylingProperty(className, value, null, true);
    return ɵɵclassProp;
}
/**
 * Update style bindings using an object literal on an element.
 *
 * This instruction is meant to apply styling via the `[style]="exp"` template bindings.
 * When styles are applied to the element they will then be updated with respect to
 * any styles/classes set via `styleProp`. If any styles are set to falsy
 * then they will be removed from the element.
 *
 * Note that the styling instruction will not be applied until `stylingApply` is called.
 *
 * @param styles A key/value style map of the styles that will be applied to the given element.
 *        Any missing styles (that have already been applied to the element beforehand) will be
 *        removed (unset) from the element's styling.
 *
 * Note that this will apply the provided styleMap value to the host element if this function
 * is called within a host binding.
 *
 * @codeGenApi
 */
export function ɵɵstyleMap(styles) {
    checkStylingMap(styleKeyValueArraySet, styleStringParser, styles, false);
}
/**
 * Parse text as style and add values to KeyValueArray.
 *
 * This code is pulled out to a separate function so that it can be tree shaken away if it is not
 * needed. It is only referenced from `ɵɵstyleMap`.
 *
 * @param keyValueArray KeyValueArray to add parsed values to.
 * @param text text to parse.
 */
export function styleStringParser(keyValueArray, text) {
    for (let i = parseStyle(text); i >= 0; i = parseStyleNext(text, i)) {
        styleKeyValueArraySet(keyValueArray, getLastParsedKey(text), getLastParsedValue(text));
    }
}
/**
 * Update class bindings using an object literal or class-string on an element.
 *
 * This instruction is meant to apply styling via the `[class]="exp"` template bindings.
 * When classes are applied to the element they will then be updated with
 * respect to any styles/classes set via `classProp`. If any
 * classes are set to falsy then they will be removed from the element.
 *
 * Note that the styling instruction will not be applied until `stylingApply` is called.
 * Note that this will the provided classMap value to the host element if this function is called
 * within a host binding.
 *
 * @param classes A key/value map or string of CSS classes that will be added to the
 *        given element. Any missing classes (that have already been applied to the element
 *        beforehand) will be removed (unset) from the element's list of CSS classes.
 *
 * @codeGenApi
 */
export function ɵɵclassMap(classes) {
    checkStylingMap(classKeyValueArraySet, classStringParser, classes, true);
}
/**
 * Parse text as class and add values to KeyValueArray.
 *
 * This code is pulled out to a separate function so that it can be tree shaken away if it is not
 * needed. It is only referenced from `ɵɵclassMap`.
 *
 * @param keyValueArray KeyValueArray to add parsed values to.
 * @param text text to parse.
 */
export function classStringParser(keyValueArray, text) {
    for (let i = parseClassName(text); i >= 0; i = parseClassNameNext(text, i)) {
        keyValueArraySet(keyValueArray, getLastParsedKey(text), true);
    }
}
/**
 * Common code between `ɵɵclassProp` and `ɵɵstyleProp`.
 *
 * @param prop property name.
 * @param value binding value.
 * @param suffix suffix for the property (e.g. `em` or `px`)
 * @param isClassBased `true` if `class` change (`false` if `style`)
 */
export function checkStylingProperty(prop, value, suffix, isClassBased) {
    const lView = getLView();
    const tView = getTView();
    // Styling instructions use 2 slots per binding.
    // 1. one for the value / TStylingKey
    // 2. one for the intermittent-value / TStylingRange
    const bindingIndex = incrementBindingIndex(2);
    if (tView.firstUpdatePass) {
        stylingFirstUpdatePass(tView, prop, bindingIndex, isClassBased);
    }
    if (value !== NO_CHANGE && bindingUpdated(lView, bindingIndex, value)) {
        const tNode = tView.data[getSelectedIndex()];
        updateStyling(tView, tNode, lView, lView[RENDERER], prop, (lView[bindingIndex + 1] = normalizeSuffix(value, suffix)), isClassBased, bindingIndex);
    }
}
/**
 * Common code between `ɵɵclassMap` and `ɵɵstyleMap`.
 *
 * @param keyValueArraySet (See `keyValueArraySet` in "util/array_utils") Gets passed in as a
 *        function so that `style` can be processed. This is done for tree shaking purposes.
 * @param stringParser Parser used to parse `value` if `string`. (Passed in as `style` and `class`
 *        have different parsers.)
 * @param value bound value from application
 * @param isClassBased `true` if `class` change (`false` if `style`)
 */
export function checkStylingMap(keyValueArraySet, stringParser, value, isClassBased) {
    const tView = getTView();
    const bindingIndex = incrementBindingIndex(2);
    if (tView.firstUpdatePass) {
        stylingFirstUpdatePass(tView, null, bindingIndex, isClassBased);
    }
    const lView = getLView();
    if (value !== NO_CHANGE && bindingUpdated(lView, bindingIndex, value)) {
        // `getSelectedIndex()` should be here (rather than in instruction) so that it is guarded by the
        // if so as not to read unnecessarily.
        const tNode = tView.data[getSelectedIndex()];
        if (hasStylingInputShadow(tNode, isClassBased) && !isInHostBindings(tView, bindingIndex)) {
            if (ngDevMode) {
                // verify that if we are shadowing then `TData` is appropriately marked so that we skip
                // processing this binding in styling resolution.
                const tStylingKey = tView.data[bindingIndex];
                assertEqual(Array.isArray(tStylingKey) ? tStylingKey[1] : tStylingKey, false, "Styling linked list shadow input should be marked as 'false'");
            }
            // VE does not concatenate the static portion like we are doing here.
            // Instead VE just ignores the static completely if dynamic binding is present.
            // Because of locality we have already set the static portion because we don't know if there
            // is a dynamic portion until later. If we would ignore the static portion it would look like
            // the binding has removed it. This would confuse `[ngStyle]`/`[ngClass]` to do the wrong
            // thing as it would think that the static portion was removed. For this reason we
            // concatenate it so that `[ngStyle]`/`[ngClass]`  can continue to work on changed.
            let staticPrefix = isClassBased ? tNode.classesWithoutHost : tNode.stylesWithoutHost;
            ngDevMode &&
                isClassBased === false &&
                staticPrefix !== null &&
                assertEqual(staticPrefix.endsWith(';'), true, "Expecting static portion to end with ';'");
            if (staticPrefix !== null) {
                // We want to make sure that falsy values of `value` become empty strings.
                value = concatStringsWithSpace(staticPrefix, value ? value : '');
            }
            // Given `<div [style] my-dir>` such that `my-dir` has `@Input('style')`.
            // This takes over the `[style]` binding. (Same for `[class]`)
            setDirectiveInputsWhichShadowsStyling(tView, tNode, lView, value, isClassBased);
        }
        else {
            updateStylingMap(tView, tNode, lView, lView[RENDERER], lView[bindingIndex + 1], (lView[bindingIndex + 1] = toStylingKeyValueArray(keyValueArraySet, stringParser, value)), isClassBased, bindingIndex);
        }
    }
}
/**
 * Determines when the binding is in `hostBindings` section
 *
 * @param tView Current `TView`
 * @param bindingIndex index of binding which we would like if it is in `hostBindings`
 */
function isInHostBindings(tView, bindingIndex) {
    // All host bindings are placed after the expando section.
    return bindingIndex >= tView.expandoStartIndex;
}
/**
 * Collects the necessary information to insert the binding into a linked list of style bindings
 * using `insertTStylingBinding`.
 *
 * @param tView `TView` where the binding linked list will be stored.
 * @param tStylingKey Property/key of the binding.
 * @param bindingIndex Index of binding associated with the `prop`
 * @param isClassBased `true` if `class` change (`false` if `style`)
 */
function stylingFirstUpdatePass(tView, tStylingKey, bindingIndex, isClassBased) {
    ngDevMode && assertFirstUpdatePass(tView);
    const tData = tView.data;
    if (tData[bindingIndex + 1] === null) {
        // The above check is necessary because we don't clear first update pass until first successful
        // (no exception) template execution. This prevents the styling instruction from double adding
        // itself to the list.
        // `getSelectedIndex()` should be here (rather than in instruction) so that it is guarded by the
        // if so as not to read unnecessarily.
        const tNode = tData[getSelectedIndex()];
        ngDevMode && assertDefined(tNode, 'TNode expected');
        const isHostBindings = isInHostBindings(tView, bindingIndex);
        if (hasStylingInputShadow(tNode, isClassBased) && tStylingKey === null && !isHostBindings) {
            // `tStylingKey === null` implies that we are either `[style]` or `[class]` binding.
            // If there is a directive which uses `@Input('style')` or `@Input('class')` than
            // we need to neutralize this binding since that directive is shadowing it.
            // We turn this into a noop by setting the key to `false`
            tStylingKey = false;
        }
        tStylingKey = wrapInStaticStylingKey(tData, tNode, tStylingKey, isClassBased);
        insertTStylingBinding(tData, tNode, tStylingKey, bindingIndex, isHostBindings, isClassBased);
    }
}
/**
 * Adds static styling information to the binding if applicable.
 *
 * The linked list of styles not only stores the list and keys, but also stores static styling
 * information on some of the keys. This function determines if the key should contain the styling
 * information and computes it.
 *
 * See `TStylingStatic` for more details.
 *
 * @param tData `TData` where the linked list is stored.
 * @param tNode `TNode` for which the styling is being computed.
 * @param stylingKey `TStylingKeyPrimitive` which may need to be wrapped into `TStylingKey`
 * @param isClassBased `true` if `class` (`false` if `style`)
 */
export function wrapInStaticStylingKey(tData, tNode, stylingKey, isClassBased) {
    const hostDirectiveDef = getCurrentDirectiveDef(tData);
    let residual = isClassBased ? tNode.residualClasses : tNode.residualStyles;
    if (hostDirectiveDef === null) {
        // We are in template node.
        // If template node already had styling instruction then it has already collected the static
        // styling and there is no need to collect them again. We know that we are the first styling
        // instruction because the `TNode.*Bindings` points to 0 (nothing has been inserted yet).
        const isFirstStylingInstructionInTemplate = (isClassBased ? tNode.classBindings : tNode.styleBindings) === 0;
        if (isFirstStylingInstructionInTemplate) {
            // It would be nice to be able to get the statics from `mergeAttrs`, however, at this point
            // they are already merged and it would not be possible to figure which property belongs where
            // in the priority.
            stylingKey = collectStylingFromDirectives(null, tData, tNode, stylingKey, isClassBased);
            stylingKey = collectStylingFromTAttrs(stylingKey, tNode.attrs, isClassBased);
            // We know that if we have styling binding in template we can't have residual.
            residual = null;
        }
    }
    else {
        // We are in host binding node and there was no binding instruction in template node.
        // This means that we need to compute the residual.
        const directiveStylingLast = tNode.directiveStylingLast;
        const isFirstStylingInstructionInHostBinding = directiveStylingLast === -1 || tData[directiveStylingLast] !== hostDirectiveDef;
        if (isFirstStylingInstructionInHostBinding) {
            stylingKey = collectStylingFromDirectives(hostDirectiveDef, tData, tNode, stylingKey, isClassBased);
            if (residual === null) {
                // - If `null` than either:
                //    - Template styling instruction already ran and it has consumed the static
                //      styling into its `TStylingKey` and so there is no need to update residual. Instead
                //      we need to update the `TStylingKey` associated with the first template node
                //      instruction. OR
                //    - Some other styling instruction ran and determined that there are no residuals
                let templateStylingKey = getTemplateHeadTStylingKey(tData, tNode, isClassBased);
                if (templateStylingKey !== undefined && Array.isArray(templateStylingKey)) {
                    // Only recompute if `templateStylingKey` had static values. (If no static value found
                    // then there is nothing to do since this operation can only produce less static keys, not
                    // more.)
                    templateStylingKey = collectStylingFromDirectives(null, tData, tNode, templateStylingKey[1] /* unwrap previous statics */, isClassBased);
                    templateStylingKey = collectStylingFromTAttrs(templateStylingKey, tNode.attrs, isClassBased);
                    setTemplateHeadTStylingKey(tData, tNode, isClassBased, templateStylingKey);
                }
            }
            else {
                // We only need to recompute residual if it is not `null`.
                // - If existing residual (implies there was no template styling). This means that some of
                //   the statics may have moved from the residual to the `stylingKey` and so we have to
                //   recompute.
                // - If `undefined` this is the first time we are running.
                residual = collectResidual(tData, tNode, isClassBased);
            }
        }
    }
    if (residual !== undefined) {
        isClassBased ? (tNode.residualClasses = residual) : (tNode.residualStyles = residual);
    }
    return stylingKey;
}
/**
 * Retrieve the `TStylingKey` for the template styling instruction.
 *
 * This is needed since `hostBinding` styling instructions are inserted after the template
 * instruction. While the template instruction needs to update the residual in `TNode` the
 * `hostBinding` instructions need to update the `TStylingKey` of the template instruction because
 * the template instruction is downstream from the `hostBindings` instructions.
 *
 * @param tData `TData` where the linked list is stored.
 * @param tNode `TNode` for which the styling is being computed.
 * @param isClassBased `true` if `class` (`false` if `style`)
 * @return `TStylingKey` if found or `undefined` if not found.
 */
function getTemplateHeadTStylingKey(tData, tNode, isClassBased) {
    const bindings = isClassBased ? tNode.classBindings : tNode.styleBindings;
    if (getTStylingRangeNext(bindings) === 0) {
        // There does not seem to be a styling instruction in the `template`.
        return undefined;
    }
    return tData[getTStylingRangePrev(bindings)];
}
/**
 * Update the `TStylingKey` of the first template instruction in `TNode`.
 *
 * Logically `hostBindings` styling instructions are of lower priority than that of the template.
 * However, they execute after the template styling instructions. This means that they get inserted
 * in front of the template styling instructions.
 *
 * If we have a template styling instruction and a new `hostBindings` styling instruction is
 * executed it means that it may need to steal static fields from the template instruction. This
 * method allows us to update the first template instruction `TStylingKey` with a new value.
 *
 * Assume:
 * ```
 * <div my-dir style="color: red" [style.color]="tmplExp"></div>
 *
 * @Directive({
 *   host: {
 *     'style': 'width: 100px',
 *     '[style.color]': 'dirExp',
 *   }
 * })
 * class MyDir {}
 * ```
 *
 * when `[style.color]="tmplExp"` executes it creates this data structure.
 * ```
 *  ['', 'color', 'color', 'red', 'width', '100px'],
 * ```
 *
 * The reason for this is that the template instruction does not know if there are styling
 * instructions and must assume that there are none and must collect all of the static styling.
 * (both
 * `color' and 'width`)
 *
 * When `'[style.color]': 'dirExp',` executes we need to insert a new data into the linked list.
 * ```
 *  ['', 'color', 'width', '100px'],  // newly inserted
 *  ['', 'color', 'color', 'red', 'width', '100px'], // this is wrong
 * ```
 *
 * Notice that the template statics is now wrong as it incorrectly contains `width` so we need to
 * update it like so:
 * ```
 *  ['', 'color', 'width', '100px'],
 *  ['', 'color', 'color', 'red'],    // UPDATE
 * ```
 *
 * @param tData `TData` where the linked list is stored.
 * @param tNode `TNode` for which the styling is being computed.
 * @param isClassBased `true` if `class` (`false` if `style`)
 * @param tStylingKey New `TStylingKey` which is replacing the old one.
 */
function setTemplateHeadTStylingKey(tData, tNode, isClassBased, tStylingKey) {
    const bindings = isClassBased ? tNode.classBindings : tNode.styleBindings;
    ngDevMode &&
        assertNotEqual(getTStylingRangeNext(bindings), 0, 'Expecting to have at least one template styling binding.');
    tData[getTStylingRangePrev(bindings)] = tStylingKey;
}
/**
 * Collect all static values after the current `TNode.directiveStylingLast` index.
 *
 * Collect the remaining styling information which has not yet been collected by an existing
 * styling instruction.
 *
 * @param tData `TData` where the `DirectiveDefs` are stored.
 * @param tNode `TNode` which contains the directive range.
 * @param isClassBased `true` if `class` (`false` if `style`)
 */
function collectResidual(tData, tNode, isClassBased) {
    let residual = undefined;
    const directiveEnd = tNode.directiveEnd;
    ngDevMode &&
        assertNotEqual(tNode.directiveStylingLast, -1, 'By the time this function gets called at least one hostBindings-node styling instruction must have executed.');
    // We add `1 + tNode.directiveStart` because we need to skip the current directive (as we are
    // collecting things after the last `hostBindings` directive which had a styling instruction.)
    for (let i = 1 + tNode.directiveStylingLast; i < directiveEnd; i++) {
        const attrs = tData[i].hostAttrs;
        residual = collectStylingFromTAttrs(residual, attrs, isClassBased);
    }
    return collectStylingFromTAttrs(residual, tNode.attrs, isClassBased);
}
/**
 * Collect the static styling information with lower priority than `hostDirectiveDef`.
 *
 * (This is opposite of residual styling.)
 *
 * @param hostDirectiveDef `DirectiveDef` for which we want to collect lower priority static
 *        styling. (Or `null` if template styling)
 * @param tData `TData` where the linked list is stored.
 * @param tNode `TNode` for which the styling is being computed.
 * @param stylingKey Existing `TStylingKey` to update or wrap.
 * @param isClassBased `true` if `class` (`false` if `style`)
 */
function collectStylingFromDirectives(hostDirectiveDef, tData, tNode, stylingKey, isClassBased) {
    // We need to loop because there can be directives which have `hostAttrs` but don't have
    // `hostBindings` so this loop catches up to the current directive..
    let currentDirective = null;
    const directiveEnd = tNode.directiveEnd;
    let directiveStylingLast = tNode.directiveStylingLast;
    if (directiveStylingLast === -1) {
        directiveStylingLast = tNode.directiveStart;
    }
    else {
        directiveStylingLast++;
    }
    while (directiveStylingLast < directiveEnd) {
        currentDirective = tData[directiveStylingLast];
        ngDevMode && assertDefined(currentDirective, 'expected to be defined');
        stylingKey = collectStylingFromTAttrs(stylingKey, currentDirective.hostAttrs, isClassBased);
        if (currentDirective === hostDirectiveDef)
            break;
        directiveStylingLast++;
    }
    if (hostDirectiveDef !== null) {
        // we only advance the styling cursor if we are collecting data from host bindings.
        // Template executes before host bindings and so if we would update the index,
        // host bindings would not get their statics.
        tNode.directiveStylingLast = directiveStylingLast;
    }
    return stylingKey;
}
/**
 * Convert `TAttrs` into `TStylingStatic`.
 *
 * @param stylingKey existing `TStylingKey` to update or wrap.
 * @param attrs `TAttributes` to process.
 * @param isClassBased `true` if `class` (`false` if `style`)
 */
function collectStylingFromTAttrs(stylingKey, attrs, isClassBased) {
    const desiredMarker = isClassBased ? 1 /* AttributeMarker.Classes */ : 2 /* AttributeMarker.Styles */;
    let currentMarker = -1 /* AttributeMarker.ImplicitAttributes */;
    if (attrs !== null) {
        for (let i = 0; i < attrs.length; i++) {
            const item = attrs[i];
            if (typeof item === 'number') {
                currentMarker = item;
            }
            else {
                if (currentMarker === desiredMarker) {
                    if (!Array.isArray(stylingKey)) {
                        stylingKey = stylingKey === undefined ? [] : ['', stylingKey];
                    }
                    keyValueArraySet(stylingKey, item, isClassBased ? true : attrs[++i]);
                }
            }
        }
    }
    return stylingKey === undefined ? null : stylingKey;
}
/**
 * Convert user input to `KeyValueArray`.
 *
 * This function takes user input which could be `string`, Object literal, or iterable and converts
 * it into a consistent representation. The output of this is `KeyValueArray` (which is an array
 * where
 * even indexes contain keys and odd indexes contain values for those keys).
 *
 * The advantage of converting to `KeyValueArray` is that we can perform diff in an input
 * independent
 * way.
 * (ie we can compare `foo bar` to `['bar', 'baz'] and determine a set of changes which need to be
 * applied)
 *
 * The fact that `KeyValueArray` is sorted is very important because it allows us to compute the
 * difference in linear fashion without the need to allocate any additional data.
 *
 * For example if we kept this as a `Map` we would have to iterate over previous `Map` to determine
 * which values need to be deleted, over the new `Map` to determine additions, and we would have to
 * keep additional `Map` to keep track of duplicates or items which have not yet been visited.
 *
 * @param keyValueArraySet (See `keyValueArraySet` in "util/array_utils") Gets passed in as a
 *        function so that `style` can be processed. This is done
 *        for tree shaking purposes.
 * @param stringParser The parser is passed in so that it will be tree shakable. See
 *        `styleStringParser` and `classStringParser`
 * @param value The value to parse/convert to `KeyValueArray`
 */
export function toStylingKeyValueArray(keyValueArraySet, stringParser, value) {
    if (value == null /*|| value === undefined */ || value === '')
        return EMPTY_ARRAY;
    const styleKeyValueArray = [];
    const unwrappedValue = unwrapSafeValue(value);
    if (Array.isArray(unwrappedValue)) {
        for (let i = 0; i < unwrappedValue.length; i++) {
            keyValueArraySet(styleKeyValueArray, unwrappedValue[i], true);
        }
    }
    else if (typeof unwrappedValue === 'object') {
        for (const key in unwrappedValue) {
            if (unwrappedValue.hasOwnProperty(key)) {
                keyValueArraySet(styleKeyValueArray, key, unwrappedValue[key]);
            }
        }
    }
    else if (typeof unwrappedValue === 'string') {
        stringParser(styleKeyValueArray, unwrappedValue);
    }
    else {
        ngDevMode &&
            throwError('Unsupported styling type ' + typeof unwrappedValue + ': ' + unwrappedValue);
    }
    return styleKeyValueArray;
}
/**
 * Set a `value` for a `key`.
 *
 * See: `keyValueArraySet` for details
 *
 * @param keyValueArray KeyValueArray to add to.
 * @param key Style key to add.
 * @param value The value to set.
 */
export function styleKeyValueArraySet(keyValueArray, key, value) {
    keyValueArraySet(keyValueArray, key, unwrapSafeValue(value));
}
/**
 * Class-binding-specific function for setting the `value` for a `key`.
 *
 * See: `keyValueArraySet` for details
 *
 * @param keyValueArray KeyValueArray to add to.
 * @param key Style key to add.
 * @param value The value to set.
 */
export function classKeyValueArraySet(keyValueArray, key, value) {
    // We use `classList.add` to eventually add the CSS classes to the DOM node. Any value passed into
    // `add` is stringified and added to the `class` attribute, e.g. even null, undefined or numbers
    // will be added. Stringify the key here so that our internal data structure matches the value in
    // the DOM. The only exceptions are empty strings and strings that contain spaces for which
    // the browser throws an error. We ignore such values, because the error is somewhat cryptic.
    const stringKey = String(key);
    if (stringKey !== '' && !stringKey.includes(' ')) {
        keyValueArraySet(keyValueArray, stringKey, value);
    }
}
/**
 * Update map based styling.
 *
 * Map based styling could be anything which contains more than one binding. For example `string`,
 * or object literal. Dealing with all of these types would complicate the logic so
 * instead this function expects that the complex input is first converted into normalized
 * `KeyValueArray`. The advantage of normalization is that we get the values sorted, which makes it
 * very cheap to compute deltas between the previous and current value.
 *
 * @param tView Associated `TView.data` contains the linked list of binding priorities.
 * @param tNode `TNode` where the binding is located.
 * @param lView `LView` contains the values associated with other styling binding at this `TNode`.
 * @param renderer Renderer to use if any updates.
 * @param oldKeyValueArray Previous value represented as `KeyValueArray`
 * @param newKeyValueArray Current value represented as `KeyValueArray`
 * @param isClassBased `true` if `class` (`false` if `style`)
 * @param bindingIndex Binding index of the binding.
 */
function updateStylingMap(tView, tNode, lView, renderer, oldKeyValueArray, newKeyValueArray, isClassBased, bindingIndex) {
    if (oldKeyValueArray === NO_CHANGE) {
        // On first execution the oldKeyValueArray is NO_CHANGE => treat it as empty KeyValueArray.
        oldKeyValueArray = EMPTY_ARRAY;
    }
    let oldIndex = 0;
    let newIndex = 0;
    let oldKey = 0 < oldKeyValueArray.length ? oldKeyValueArray[0] : null;
    let newKey = 0 < newKeyValueArray.length ? newKeyValueArray[0] : null;
    while (oldKey !== null || newKey !== null) {
        ngDevMode && assertLessThan(oldIndex, 999, 'Are we stuck in infinite loop?');
        ngDevMode && assertLessThan(newIndex, 999, 'Are we stuck in infinite loop?');
        const oldValue = oldIndex < oldKeyValueArray.length ? oldKeyValueArray[oldIndex + 1] : undefined;
        const newValue = newIndex < newKeyValueArray.length ? newKeyValueArray[newIndex + 1] : undefined;
        let setKey = null;
        let setValue = undefined;
        if (oldKey === newKey) {
            // UPDATE: Keys are equal => new value is overwriting old value.
            oldIndex += 2;
            newIndex += 2;
            if (oldValue !== newValue) {
                setKey = newKey;
                setValue = newValue;
            }
        }
        else if (newKey === null || (oldKey !== null && oldKey < newKey)) {
            // DELETE: oldKey key is missing or we did not find the oldKey in the newValue
            // (because the keyValueArray is sorted and `newKey` is found later alphabetically).
            // `"background" < "color"` so we need to delete `"background"` because it is not found in the
            // new array.
            oldIndex += 2;
            setKey = oldKey;
        }
        else {
            // CREATE: newKey's is earlier alphabetically than oldKey's (or no oldKey) => we have new key.
            // `"color" > "background"` so we need to add `color` because it is in new array but not in
            // old array.
            ngDevMode && assertDefined(newKey, 'Expecting to have a valid key');
            newIndex += 2;
            setKey = newKey;
            setValue = newValue;
        }
        if (setKey !== null) {
            updateStyling(tView, tNode, lView, renderer, setKey, setValue, isClassBased, bindingIndex);
        }
        oldKey = oldIndex < oldKeyValueArray.length ? oldKeyValueArray[oldIndex] : null;
        newKey = newIndex < newKeyValueArray.length ? newKeyValueArray[newIndex] : null;
    }
}
/**
 * Update a simple (property name) styling.
 *
 * This function takes `prop` and updates the DOM to that value. The function takes the binding
 * value as well as binding priority into consideration to determine which value should be written
 * to DOM. (For example it may be determined that there is a higher priority overwrite which blocks
 * the DOM write, or if the value goes to `undefined` a lower priority overwrite may be consulted.)
 *
 * @param tView Associated `TView.data` contains the linked list of binding priorities.
 * @param tNode `TNode` where the binding is located.
 * @param lView `LView` contains the values associated with other styling binding at this `TNode`.
 * @param renderer Renderer to use if any updates.
 * @param prop Either style property name or a class name.
 * @param value Either style value for `prop` or `true`/`false` if `prop` is class.
 * @param isClassBased `true` if `class` (`false` if `style`)
 * @param bindingIndex Binding index of the binding.
 */
function updateStyling(tView, tNode, lView, renderer, prop, value, isClassBased, bindingIndex) {
    if (!(tNode.type & 3 /* TNodeType.AnyRNode */)) {
        // It is possible to have styling on non-elements (such as ng-container).
        // This is rare, but it does happen. In such a case, just ignore the binding.
        return;
    }
    const tData = tView.data;
    const tRange = tData[bindingIndex + 1];
    const higherPriorityValue = getTStylingRangeNextDuplicate(tRange)
        ? findStylingValue(tData, tNode, lView, prop, getTStylingRangeNext(tRange), isClassBased)
        : undefined;
    if (!isStylingValuePresent(higherPriorityValue)) {
        // We don't have a next duplicate, or we did not find a duplicate value.
        if (!isStylingValuePresent(value)) {
            // We should delete current value or restore to lower priority value.
            if (getTStylingRangePrevDuplicate(tRange)) {
                // We have a possible prev duplicate, let's retrieve it.
                value = findStylingValue(tData, null, lView, prop, bindingIndex, isClassBased);
            }
        }
        const rNode = getNativeByIndex(getSelectedIndex(), lView);
        applyStyling(renderer, isClassBased, rNode, prop, value);
    }
}
/**
 * Search for styling value with higher priority which is overwriting current value, or a
 * value of lower priority to which we should fall back if the value is `undefined`.
 *
 * When value is being applied at a location, related values need to be consulted.
 * - If there is a higher priority binding, we should be using that one instead.
 *   For example `<div  [style]="{color:exp1}" [style.color]="exp2">` change to `exp1`
 *   requires that we check `exp2` to see if it is set to value other than `undefined`.
 * - If there is a lower priority binding and we are changing to `undefined`
 *   For example `<div  [style]="{color:exp1}" [style.color]="exp2">` change to `exp2` to
 *   `undefined` requires that we check `exp1` (and static values) and use that as new value.
 *
 * NOTE: The styling stores two values.
 * 1. The raw value which came from the application is stored at `index + 0` location. (This value
 *    is used for dirty checking).
 * 2. The normalized value is stored at `index + 1`.
 *
 * @param tData `TData` used for traversing the priority.
 * @param tNode `TNode` to use for resolving static styling. Also controls search direction.
 *   - `TNode` search next and quit as soon as `isStylingValuePresent(value)` is true.
 *      If no value found consult `tNode.residualStyle`/`tNode.residualClass` for default value.
 *   - `null` search prev and go all the way to end. Return last value where
 *     `isStylingValuePresent(value)` is true.
 * @param lView `LView` used for retrieving the actual values.
 * @param prop Property which we are interested in.
 * @param index Starting index in the linked list of styling bindings where the search should start.
 * @param isClassBased `true` if `class` (`false` if `style`)
 */
function findStylingValue(tData, tNode, lView, prop, index, isClassBased) {
    // `TNode` to use for resolving static styling. Also controls search direction.
    //   - `TNode` search next and quit as soon as `isStylingValuePresent(value)` is true.
    //      If no value found consult `tNode.residualStyle`/`tNode.residualClass` for default value.
    //   - `null` search prev and go all the way to end. Return last value where
    //     `isStylingValuePresent(value)` is true.
    const isPrevDirection = tNode === null;
    let value = undefined;
    while (index > 0) {
        const rawKey = tData[index];
        const containsStatics = Array.isArray(rawKey);
        // Unwrap the key if we contain static values.
        const key = containsStatics ? rawKey[1] : rawKey;
        const isStylingMap = key === null;
        let valueAtLViewIndex = lView[index + 1];
        if (valueAtLViewIndex === NO_CHANGE) {
            // In firstUpdatePass the styling instructions create a linked list of styling.
            // On subsequent passes it is possible for a styling instruction to try to read a binding
            // which
            // has not yet executed. In that case we will find `NO_CHANGE` and we should assume that
            // we have `undefined` (or empty array in case of styling-map instruction) instead. This
            // allows the resolution to apply the value (which may later be overwritten when the
            // binding actually executes.)
            valueAtLViewIndex = isStylingMap ? EMPTY_ARRAY : undefined;
        }
        let currentValue = isStylingMap
            ? keyValueArrayGet(valueAtLViewIndex, prop)
            : key === prop
                ? valueAtLViewIndex
                : undefined;
        if (containsStatics && !isStylingValuePresent(currentValue)) {
            currentValue = keyValueArrayGet(rawKey, prop);
        }
        if (isStylingValuePresent(currentValue)) {
            value = currentValue;
            if (isPrevDirection) {
                return value;
            }
        }
        const tRange = tData[index + 1];
        index = isPrevDirection ? getTStylingRangePrev(tRange) : getTStylingRangeNext(tRange);
    }
    if (tNode !== null) {
        // in case where we are going in next direction AND we did not find anything, we need to
        // consult residual styling
        let residual = isClassBased ? tNode.residualClasses : tNode.residualStyles;
        if (residual != null /** OR residual !=== undefined */) {
            value = keyValueArrayGet(residual, prop);
        }
    }
    return value;
}
/**
 * Determines if the binding value should be used (or if the value is 'undefined' and hence priority
 * resolution should be used.)
 *
 * @param value Binding style value.
 */
function isStylingValuePresent(value) {
    // Currently only `undefined` value is considered non-binding. That is `undefined` says I don't
    // have an opinion as to what this binding should be and you should consult other bindings by
    // priority to determine the valid value.
    // This is extracted into a single function so that we have a single place to control this.
    return value !== undefined;
}
/**
 * Normalizes and/or adds a suffix to the value.
 *
 * If value is `null`/`undefined` no suffix is added
 * @param value
 * @param suffix
 */
function normalizeSuffix(value, suffix) {
    if (value == null || value === '') {
        // do nothing
        // Do not add the suffix if the value is going to be empty.
        // As it produce invalid CSS, which the browsers will automatically omit but Domino will not.
        // Example: `"left": "px;"` instead of `"left": ""`.
    }
    else if (typeof suffix === 'string') {
        value = value + suffix;
    }
    else if (typeof value === 'object') {
        value = stringify(unwrapSafeValue(value));
    }
    return value;
}
/**
 * Tests if the `TNode` has input shadow.
 *
 * An input shadow is when a directive steals (shadows) the input by using `@Input('style')` or
 * `@Input('class')` as input.
 *
 * @param tNode `TNode` which we would like to see if it has shadow.
 * @param isClassBased `true` if `class` (`false` if `style`)
 */
export function hasStylingInputShadow(tNode, isClassBased) {
    return (tNode.flags & (isClassBased ? 8 /* TNodeFlags.hasClassInput */ : 16 /* TNodeFlags.hasStyleInput */)) !== 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3JlbmRlcjMvaW5zdHJ1Y3Rpb25zL3N0eWxpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFZLGVBQWUsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBQ3JFLE9BQU8sRUFBZ0IsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUN6RixPQUFPLEVBQ0wsYUFBYSxFQUNiLFdBQVcsRUFDWCxjQUFjLEVBQ2QsY0FBYyxFQUNkLFVBQVUsR0FDWCxNQUFNLG1CQUFtQixDQUFDO0FBQzNCLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUM3QyxPQUFPLEVBQUMsc0JBQXNCLEVBQUUsU0FBUyxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDdkUsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ2hELE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFNM0MsT0FBTyxFQUNMLG9CQUFvQixFQUNwQiw2QkFBNkIsRUFDN0Isb0JBQW9CLEVBQ3BCLDZCQUE2QixHQUc5QixNQUFNLHVCQUF1QixDQUFDO0FBQy9CLE9BQU8sRUFBUSxRQUFRLEVBQWUsTUFBTSxvQkFBb0IsQ0FBQztBQUNqRSxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDbEQsT0FBTyxFQUNMLHNCQUFzQixFQUN0QixRQUFRLEVBQ1IsZ0JBQWdCLEVBQ2hCLFFBQVEsRUFDUixxQkFBcUIsR0FDdEIsTUFBTSxVQUFVLENBQUM7QUFDbEIsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDcEUsT0FBTyxFQUNMLGdCQUFnQixFQUNoQixrQkFBa0IsRUFDbEIsY0FBYyxFQUNkLGtC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LENBQUMsa0NBQTBCLENBQUMsa0NBQXlCLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNwRyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U2FmZVZhbHVlLCB1bndyYXBTYWZlVmFsdWV9IGZyb20gJy4uLy4uL3Nhbml0aXphdGlvbi9ieXBhc3MnO1xuaW1wb3J0IHtLZXlWYWx1ZUFycmF5LCBrZXlWYWx1ZUFycmF5R2V0LCBrZXlWYWx1ZUFycmF5U2V0fSBmcm9tICcuLi8uLi91dGlsL2FycmF5X3V0aWxzJztcbmltcG9ydCB7XG4gIGFzc2VydERlZmluZWQsXG4gIGFzc2VydEVxdWFsLFxuICBhc3NlcnRMZXNzVGhhbixcbiAgYXNzZXJ0Tm90RXF1YWwsXG4gIHRocm93RXJyb3IsXG59IGZyb20gJy4uLy4uL3V0aWwvYXNzZXJ0JztcbmltcG9ydCB7RU1QVFlfQVJSQVl9IGZyb20gJy4uLy4uL3V0aWwvZW1wdHknO1xuaW1wb3J0IHtjb25jYXRTdHJpbmdzV2l0aFNwYWNlLCBzdHJpbmdpZnl9IGZyb20gJy4uLy4uL3V0aWwvc3RyaW5naWZ5JztcbmltcG9ydCB7YXNzZXJ0Rmlyc3RVcGRhdGVQYXNzfSBmcm9tICcuLi9hc3NlcnQnO1xuaW1wb3J0IHtiaW5kaW5nVXBkYXRlZH0gZnJvbSAnLi4vYmluZGluZ3MnO1xuaW1wb3J0IHtBdHRyaWJ1dGVNYXJrZXJ9IGZyb20gJy4uL2ludGVyZmFjZXMvYXR0cmlidXRlX21hcmtlcic7XG5pbXBvcnQge0RpcmVjdGl2ZURlZn0gZnJvbSAnLi4vaW50ZXJmYWNlcy9kZWZpbml0aW9uJztcbmltcG9ydCB7VEF0dHJpYnV0ZXMsIFROb2RlLCBUTm9kZUZsYWdzLCBUTm9kZVR5cGV9IGZyb20gJy4uL2ludGVyZmFjZXMvbm9kZSc7XG5pbXBvcnQge1JlbmRlcmVyfSBmcm9tICcuLi9pbnRlcmZhY2VzL3JlbmRlcmVyJztcbmltcG9ydCB7UkVsZW1lbnR9IGZyb20gJy4uL2ludGVyZmFjZXMvcmVuZGVyZXJfZG9tJztcbmltcG9ydCB7XG4gIGdldFRTdHlsaW5nUmFuZ2VOZXh0LFxuICBnZXRUU3R5bGluZ1JhbmdlTmV4dER1cGxpY2F0ZSxcbiAgZ2V0VFN0eWxpbmdSYW5nZVByZXYsXG4gIGdldFRTdHlsaW5nUmFuZ2VQcmV2RHVwbGljYXRlLFxuICBUU3R5bGluZ0tleSxcbiAgVFN0eWxpbmdSYW5nZSxcbn0gZnJvbSAnLi4vaW50ZXJmYWNlcy9zdHlsaW5nJztcbmltcG9ydCB7TFZpZXcsIFJFTkRFUkVSLCBURGF0YSwgVFZpZXd9IGZyb20gJy4uL2ludGVyZmFjZXMvdmlldyc7XG5pbXBvcnQge2FwcGx5U3R5bGluZ30gZnJvbSAnLi4vbm9kZV9tYW5pcHVsYXRpb24nO1xuaW1wb3J0IHtcbiAgZ2V0Q3VycmVudERpcmVjdGl2ZURlZixcbiAgZ2V0TFZpZXcsXG4gIGdldFNlbGVjdGVkSW5kZXgsXG4gIGdldFRWaWV3LFxuICBpbmNyZW1lbnRCaW5kaW5nSW5kZXgsXG59IGZyb20gJy4uL3N0YXRlJztcbmltcG9ydCB7aW5zZXJ0VFN0eWxpbmdCaW5kaW5nfSBmcm9tICcuLi9zdHlsaW5nL3N0eWxlX2JpbmRpbmdfbGlzdCc7XG5pbXBvcnQge1xuICBnZXRMYXN0UGFyc2VkS2V5LFxuICBnZXRMYXN0UGFyc2VkVmFsdWUsXG4gIHBhcnNlQ2xhc3NOYW1lLFxuICBwYXJzZUNsYXNzTmFtZU5leHQsXG4gIHBhcnNlU3R5bGUsXG4gIHBhcnNlU3R5bGVOZXh0LFxufSBmcm9tICcuLi9zdHlsaW5nL3N0eWxpbmdfcGFyc2VyJztcbmltcG9ydCB7Tk9fQ0hBTkdFfSBmcm9tICcuLi90b2tlbnMnO1xuaW1wb3J0IHtnZXROYXRpdmVCeUluZGV4fSBmcm9tICcuLi91dGlsL3ZpZXdfdXRpbHMnO1xuXG5pbXBvcnQge3NldERpcmVjdGl2ZUlucHV0c1doaWNoU2hhZG93c1N0eWxpbmd9IGZyb20gJy4vcHJvcGVydHknO1xuXG4vKipcbiAqIFVwZGF0ZSBhIHN0eWxlIGJpbmRpbmcgb24gYW4gZWxlbWVudCB3aXRoIHRoZSBwcm92aWRlZCB2YWx1ZS5cbiAqXG4gKiBJZiB0aGUgc3R5bGUgdmFsdWUgaXMgZmFsc3kgdGhlbiBpdCB3aWxsIGJlIHJlbW92ZWQgZnJvbSB0aGUgZWxlbWVudFxuICogKG9yIGFzc2lnbmVkIGEgZGlmZmVyZW50IHZhbHVlIGRlcGVuZGluZyBpZiB0aGVyZSBhcmUgYW55IHN0eWxlcyBwbGFjZWRcbiAqIG9uIHRoZSBlbGVtZW50IHdpdGggYHN0eWxlTWFwYCBvciBhbnkgc3RhdGljIHN0eWxlcyB0aGF0IGFyZVxuICogcHJlc2VudCBmcm9tIHdoZW4gdGhlIGVsZW1lbnQgd2FzIGNyZWF0ZWQgd2l0aCBgc3R5bGluZ2ApLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgc3R5bGluZyBlbGVtZW50IGlzIHVwZGF0ZWQgYXMgcGFydCBvZiBgc3R5bGluZ0FwcGx5YC5cbiAqXG4gKiBAcGFyYW0gcHJvcCBBIHZhbGlkIENTUyBwcm9wZXJ0eS5cbiAqIEBwYXJhbSB2YWx1ZSBOZXcgdmFsdWUgdG8gd3JpdGUgKGBudWxsYCBvciBhbiBlbXB0eSBzdHJpbmcgdG8gcmVtb3ZlKS5cbiAqIEBwYXJhbSBzdWZmaXggT3B0aW9uYWwgc3VmZml4LiBVc2VkIHdpdGggc2NhbGFyIHZhbHVlcyB0byBhZGQgdW5pdCBzdWNoIGFzIGBweGAuXG4gKlxuICogTm90ZSB0aGF0IHRoaXMgd2lsbCBhcHBseSB0aGUgcHJvdmlkZWQgc3R5bGUgdmFsdWUgdG8gdGhlIGhvc3QgZWxlbWVudCBpZiB0aGlzIGZ1bmN0aW9uIGlzIGNhbGxlZFxuICogd2l0aGluIGEgaG9zdCBiaW5kaW5nIGZ1bmN0aW9uLlxuICpcbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1c3R5bGVQcm9wKFxuICBwcm9wOiBzdHJpbmcsXG4gIHZhbHVlOiBzdHJpbmcgfCBudW1iZXIgfCBTYWZlVmFsdWUgfCB1bmRlZmluZWQgfCBudWxsLFxuICBzdWZmaXg/OiBzdHJpbmcgfCBudWxsLFxuKTogdHlwZW9mIMm1ybVzdHlsZVByb3Age1xuICBjaGVja1N0eWxpbmdQcm9wZXJ0eShwcm9wLCB2YWx1ZSwgc3VmZml4LCBmYWxzZSk7XG4gIHJldHVybiDJtcm1c3R5bGVQcm9wO1xufVxuXG4vKipcbiAqIFVwZGF0ZSBhIGNsYXNzIGJpbmRpbmcgb24gYW4gZWxlbWVudCB3aXRoIHRoZSBwcm92aWRlZCB2YWx1ZS5cbiAqXG4gKiBUaGlzIGluc3RydWN0aW9uIGlzIG1lYW50IHRvIGhhbmRsZSB0aGUgYFtjbGFzcy5mb29dPVwiZXhwXCJgIGNhc2UgYW5kLFxuICogdGhlcmVmb3JlLCB0aGUgY2xhc3MgYmluZGluZyBpdHNlbGYgbXVzdCBhbHJlYWR5IGJlIGFsbG9jYXRlZCB1c2luZ1xuICogYHN0eWxpbmdgIHdpdGhpbiB0aGUgY3JlYXRpb24gYmxvY2suXG4gKlxuICogQHBhcmFtIHByb3AgQSB2YWxpZCBDU1MgY2xhc3MgKG9ubHkgb25lKS5cbiAqIEBwYXJhbSB2YWx1ZSBBIHRydWUvZmFsc2UgdmFsdWUgd2hpY2ggd2lsbCB0dXJuIHRoZSBjbGFzcyBvbiBvciBvZmYuXG4gKlxuICogTm90ZSB0aGF0IHRoaXMgd2lsbCBhcHBseSB0aGUgcHJvdmlkZWQgY2xhc3MgdmFsdWUgdG8gdGhlIGhvc3QgZWxlbWVudCBpZiB0aGlzIGZ1bmN0aW9uXG4gKiBpcyBjYWxsZWQgd2l0aGluIGEgaG9zdCBiaW5kaW5nIGZ1bmN0aW9uLlxuICpcbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1Y2xhc3NQcm9wKFxuICBjbGFzc05hbWU6IHN0cmluZyxcbiAgdmFsdWU6IGJvb2xlYW4gfCB1bmRlZmluZWQgfCBudWxsLFxuKTogdHlwZW9mIMm1ybVjbGFzc1Byb3Age1xuICBjaGVja1N0eWxpbmdQcm9wZXJ0eShjbGFzc05hbWUsIHZhbHVlLCBudWxsLCB0cnVlKTtcbiAgcmV0dXJuIMm1ybVjbGFzc1Byb3A7XG59XG5cbi8qKlxuICogVXBkYXRlIHN0eWxlIGJpbmRpbmdzIHVzaW5nIGFuIG9iamVjdCBsaXRlcmFsIG9uIGFuIGVsZW1lbnQuXG4gKlxuICogVGhpcyBpbnN0cnVjdGlvbiBpcyBtZWFudCB0byBhcHBseSBzdHlsaW5nIHZpYSB0aGUgYFtzdHlsZV09XCJleHBcImAgdGVtcGxhdGUgYmluZGluZ3MuXG4gKiBXaGVuIHN0eWxlcyBhcmUgYXBwbGllZCB0byB0aGUgZWxlbWVudCB0aGV5IHdpbGwgdGhlbiBiZSB1cGRhdGVkIHdpdGggcmVzcGVjdCB0b1xuICogYW55IHN0eWxlcy9jbGFzc2VzIHNldCB2aWEgYHN0eWxlUHJvcGAuIElmIGFueSBzdHlsZXMgYXJlIHNldCB0byBmYWxzeVxuICogdGhlbiB0aGV5IHdpbGwgYmUgcmVtb3ZlZCBmcm9tIHRoZSBlbGVtZW50LlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgc3R5bGluZyBpbnN0cnVjdGlvbiB3aWxsIG5vdCBiZSBhcHBsaWVkIHVudGlsIGBzdHlsaW5nQXBwbHlgIGlzIGNhbGxlZC5cbiAqXG4gKiBAcGFyYW0gc3R5bGVzIEEga2V5L3ZhbHVlIHN0eWxlIG1hcCBvZiB0aGUgc3R5bGVzIHRoYXQgd2lsbCBiZSBhcHBsaWVkIHRvIHRoZSBnaXZlbiBlbGVtZW50LlxuICogICAgICAgIEFueSBtaXNzaW5nIHN0eWxlcyAodGhhdCBoYXZlIGFscmVhZHkgYmVlbiBhcHBsaWVkIHRvIHRoZSBlbGVtZW50IGJlZm9yZWhhbmQpIHdpbGwgYmVcbiAqICAgICAgICByZW1vdmVkICh1bnNldCkgZnJvbSB0aGUgZWxlbWVudCdzIHN0eWxpbmcuXG4gKlxuICogTm90ZSB0aGF0IHRoaXMgd2lsbCBhcHBseSB0aGUgcHJvdmlkZWQgc3R5bGVNYXAgdmFsdWUgdG8gdGhlIGhvc3QgZWxlbWVudCBpZiB0aGlzIGZ1bmN0aW9uXG4gKiBpcyBjYWxsZWQgd2l0aGluIGEgaG9zdCBiaW5kaW5nLlxuICpcbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1c3R5bGVNYXAoc3R5bGVzOiB7W3N0eWxlTmFtZTogc3RyaW5nXTogYW55fSB8IHN0cmluZyB8IHVuZGVmaW5lZCB8IG51bGwpOiB2b2lkIHtcbiAgY2hlY2tTdHlsaW5nTWFwKHN0eWxlS2V5VmFsdWVBcnJheVNldCwgc3R5bGVTdHJpbmdQYXJzZXIsIHN0eWxlcywgZmFsc2UpO1xufVxuXG4vKipcbiAqIFBhcnNlIHRleHQgYXMgc3R5bGUgYW5kIGFkZCB2YWx1ZXMgdG8gS2V5VmFsdWVBcnJheS5cbiAqXG4gKiBUaGlzIGNvZGUgaXMgcHVsbGVkIG91dCB0byBhIHNlcGFyYXRlIGZ1bmN0aW9uIHNvIHRoYXQgaXQgY2FuIGJlIHRyZWUgc2hha2VuIGF3YXkgaWYgaXQgaXMgbm90XG4gKiBuZWVkZWQuIEl0IGlzIG9ubHkgcmVmZXJlbmNlZCBmcm9tIGDJtcm1c3R5bGVNYXBgLlxuICpcbiAqIEBwYXJhbSBrZXlWYWx1ZUFycmF5IEtleVZhbHVlQXJyYXkgdG8gYWRkIHBhcnNlZCB2YWx1ZXMgdG8uXG4gKiBAcGFyYW0gdGV4dCB0ZXh0IHRvIHBhcnNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc3R5bGVTdHJpbmdQYXJzZXIoa2V5VmFsdWVBcnJheTogS2V5VmFsdWVBcnJheTxhbnk+LCB0ZXh0OiBzdHJpbmcpOiB2b2lkIHtcbiAgZm9yIChsZXQgaSA9IHBhcnNlU3R5bGUodGV4dCk7IGkgPj0gMDsgaSA9IHBhcnNlU3R5bGVOZXh0KHRleHQsIGkpKSB7XG4gICAgc3R5bGVLZXlWYWx1ZUFycmF5U2V0KGtleVZhbHVlQXJyYXksIGdldExhc3RQYXJzZWRLZXkodGV4dCksIGdldExhc3RQYXJzZWRWYWx1ZSh0ZXh0KSk7XG4gIH1cbn1cblxuLyoqXG4gKiBVcGRhdGUgY2xhc3MgYmluZGluZ3MgdXNpbmcgYW4gb2JqZWN0IGxpdGVyYWwgb3IgY2xhc3Mtc3RyaW5nIG9uIGFuIGVsZW1lbnQuXG4gKlxuICogVGhpcyBpbnN0cnVjdGlvbiBpcyBtZWFudCB0byBhcHBseSBzdHlsaW5nIHZpYSB0aGUgYFtjbGFzc109XCJleHBcImAgdGVtcGxhdGUgYmluZGluZ3MuXG4gKiBXaGVuIGNsYXNzZXMgYXJlIGFwcGxpZWQgdG8gdGhlIGVsZW1lbnQgdGhleSB3aWxsIHRoZW4gYmUgdXBkYXRlZCB3aXRoXG4gKiByZXNwZWN0IHRvIGFueSBzdHlsZXMvY2xhc3NlcyBzZXQgdmlhIGBjbGFzc1Byb3BgLiBJZiBhbnlcbiAqIGNsYXNzZXMgYXJlIHNldCB0byBmYWxzeSB0aGVuIHRoZXkgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIGVsZW1lbnQuXG4gKlxuICogTm90ZSB0aGF0IHRoZSBzdHlsaW5nIGluc3RydWN0aW9uIHdpbGwgbm90IGJlIGFwcGxpZWQgdW50aWwgYHN0eWxpbmdBcHBseWAgaXMgY2FsbGVkLlxuICogTm90ZSB0aGF0IHRoaXMgd2lsbCB0aGUgcHJvdmlkZWQgY2xhc3NNYXAgdmFsdWUgdG8gdGhlIGhvc3QgZWxlbWVudCBpZiB0aGlzIGZ1bmN0aW9uIGlzIGNhbGxlZFxuICogd2l0aGluIGEgaG9zdCBiaW5kaW5nLlxuICpcbiAqIEBwYXJhbSBjbGFzc2VzIEEga2V5L3ZhbHVlIG1hcCBvciBzdHJpbmcgb2YgQ1NTIGNsYXNzZXMgdGhhdCB3aWxsIGJlIGFkZGVkIHRvIHRoZVxuICogICAgICAgIGdpdmVuIGVsZW1lbnQuIEFueSBtaXNzaW5nIGNsYXNzZXMgKHRoYXQgaGF2ZSBhbHJlYWR5IGJlZW4gYXBwbGllZCB0byB0aGUgZWxlbWVudFxuICogICAgICAgIGJlZm9yZWhhbmQpIHdpbGwgYmUgcmVtb3ZlZCAodW5zZXQpIGZyb20gdGhlIGVsZW1lbnQncyBsaXN0IG9mIENTUyBjbGFzc2VzLlxuICpcbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1Y2xhc3NNYXAoXG4gIGNsYXNzZXM6IHtbY2xhc3NOYW1lOiBzdHJpbmddOiBib29sZWFuIHwgdW5kZWZpbmVkIHwgbnVsbH0gfCBzdHJpbmcgfCB1bmRlZmluZWQgfCBudWxsLFxuKTogdm9pZCB7XG4gIGNoZWNrU3R5bGluZ01hcChjbGFzc0tleVZhbHVlQXJyYXlTZXQsIGNsYXNzU3RyaW5nUGFyc2VyLCBjbGFzc2VzLCB0cnVlKTtcbn1cblxuLyoqXG4gKiBQYXJzZSB0ZXh0IGFzIGNsYXNzIGFuZCBhZGQgdmFsdWVzIHRvIEtleVZhbHVlQXJyYXkuXG4gKlxuICogVGhpcyBjb2RlIGlzIHB1bGxlZCBvdXQgdG8gYSBzZXBhcmF0ZSBmdW5jdGlvbiBzbyB0aGF0IGl0IGNhbiBiZSB0cmVlIHNoYWtlbiBhd2F5IGlmIGl0IGlzIG5vdFxuICogbmVlZGVkLiBJdCBpcyBvbmx5IHJlZmVyZW5jZWQgZnJvbSBgybXJtWNsYXNzTWFwYC5cbiAqXG4gKiBAcGFyYW0ga2V5VmFsdWVBcnJheSBLZXlWYWx1ZUFycmF5IHRvIGFkZCBwYXJzZWQgdmFsdWVzIHRvLlxuICogQHBhcmFtIHRleHQgdGV4dCB0byBwYXJzZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsYXNzU3RyaW5nUGFyc2VyKGtleVZhbHVlQXJyYXk6IEtleVZhbHVlQXJyYXk8YW55PiwgdGV4dDogc3RyaW5nKTogdm9pZCB7XG4gIGZvciAobGV0IGkgPSBwYXJzZUNsYXNzTmFtZSh0ZXh0KTsgaSA+PSAwOyBpID0gcGFyc2VDbGFzc05hbWVOZXh0KHRleHQsIGkpKSB7XG4gICAga2V5VmFsdWVBcnJheVNldChrZXlWYWx1ZUFycmF5LCBnZXRMYXN0UGFyc2VkS2V5KHRleHQpLCB0cnVlKTtcbiAgfVxufVxuXG4vKipcbiAqIENvbW1vbiBjb2RlIGJldHdlZW4gYMm1ybVjbGFzc1Byb3BgIGFuZCBgybXJtXN0eWxlUHJvcGAuXG4gKlxuICogQHBhcmFtIHByb3AgcHJvcGVydHkgbmFtZS5cbiAqIEBwYXJhbSB2YWx1ZSBiaW5kaW5nIHZhbHVlLlxuICogQHBhcmFtIHN1ZmZpeCBzdWZmaXggZm9yIHRoZSBwcm9wZXJ0eSAoZS5nLiBgZW1gIG9yIGBweGApXG4gKiBAcGFyYW0gaXNDbGFzc0Jhc2VkIGB0cnVlYCBpZiBgY2xhc3NgIGNoYW5nZSAoYGZhbHNlYCBpZiBgc3R5bGVgKVxuICovXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tTdHlsaW5nUHJvcGVydHkoXG4gIHByb3A6IHN0cmluZyxcbiAgdmFsdWU6IGFueSB8IE5PX0NIQU5HRSxcbiAgc3VmZml4OiBzdHJpbmcgfCB1bmRlZmluZWQgfCBudWxsLFxuICBpc0NsYXNzQmFzZWQ6IGJvb2xlYW4sXG4pOiB2b2lkIHtcbiAgY29uc3QgbFZpZXcgPSBnZXRMVmlldygpO1xuICBjb25zdCB0VmlldyA9IGdldFRWaWV3KCk7XG4gIC8vIFN0eWxpbmcgaW5zdHJ1Y3Rpb25zIHVzZSAyIHNsb3RzIHBlciBiaW5kaW5nLlxuICAvLyAxLiBvbmUgZm9yIHRoZSB2YWx1ZSAvIFRTdHlsaW5nS2V5XG4gIC8vIDIuIG9uZSBmb3IgdGhlIGludGVybWl0dGVudC12YWx1ZSAvIFRTdHlsaW5nUmFuZ2VcbiAgY29uc3QgYmluZGluZ0luZGV4ID0gaW5jcmVtZW50QmluZGluZ0luZGV4KDIpO1xuICBpZiAodFZpZXcuZmlyc3RVcGRhdGVQYXNzKSB7XG4gICAgc3R5bGluZ0ZpcnN0VXBkYXRlUGFzcyh0VmlldywgcHJvcCwgYmluZGluZ0luZGV4LCBpc0NsYXNzQmFzZWQpO1xuICB9XG4gIGlmICh2YWx1ZSAhPT0gTk9fQ0hBTkdFICYmIGJpbmRpbmdVcGRhdGVkKGxWaWV3LCBiaW5kaW5nSW5kZXgsIHZhbHVlKSkge1xuICAgIGNvbnN0IHROb2RlID0gdFZpZXcuZGF0YVtnZXRTZWxlY3RlZEluZGV4KCldIGFzIFROb2RlO1xuICAgIHVwZGF0ZVN0eWxpbmcoXG4gICAgICB0VmlldyxcbiAgICAgIHROb2RlLFxuICAgICAgbFZpZXcsXG4gICAgICBsVmlld1tSRU5ERVJFUl0sXG4gICAgICBwcm9wLFxuICAgICAgKGxWaWV3W2JpbmRpbmdJbmRleCArIDFdID0gbm9ybWFsaXplU3VmZml4KHZhbHVlLCBzdWZmaXgpKSxcbiAgICAgIGlzQ2xhc3NCYXNlZCxcbiAgICAgIGJpbmRpbmdJbmRleCxcbiAgICApO1xuICB9XG59XG5cbi8qKlxuICogQ29tbW9uIGNvZGUgYmV0d2VlbiBgybXJtWNsYXNzTWFwYCBhbmQgYMm1ybVzdHlsZU1hcGAuXG4gKlxuICogQHBhcmFtIGtleVZhbHVlQXJyYXlTZXQgKFNlZSBga2V5VmFsdWVBcnJheVNldGAgaW4gXCJ1dGlsL2FycmF5X3V0aWxzXCIpIEdldHMgcGFzc2VkIGluIGFzIGFcbiAqICAgICAgICBmdW5jdGlvbiBzbyB0aGF0IGBzdHlsZWAgY2FuIGJlIHByb2Nlc3NlZC4gVGhpcyBpcyBkb25lIGZvciB0cmVlIHNoYWtpbmcgcHVycG9zZXMuXG4gKiBAcGFyYW0gc3RyaW5nUGFyc2VyIFBhcnNlciB1c2VkIHRvIHBhcnNlIGB2YWx1ZWAgaWYgYHN0cmluZ2AuIChQYXNzZWQgaW4gYXMgYHN0eWxlYCBhbmQgYGNsYXNzYFxuICogICAgICAgIGhhdmUgZGlmZmVyZW50IHBhcnNlcnMuKVxuICogQHBhcmFtIHZhbHVlIGJvdW5kIHZhbHVlIGZyb20gYXBwbGljYXRpb25cbiAqIEBwYXJhbSBpc0NsYXNzQmFzZWQgYHRydWVgIGlmIGBjbGFzc2AgY2hhbmdlIChgZmFsc2VgIGlmIGBzdHlsZWApXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjaGVja1N0eWxpbmdNYXAoXG4gIGtleVZhbHVlQXJyYXlTZXQ6IChrZXlWYWx1ZUFycmF5OiBLZXlWYWx1ZUFycmF5PGFueT4sIGtleTogc3RyaW5nLCB2YWx1ZTogYW55KSA9PiB2b2lkLFxuICBzdHJpbmdQYXJzZXI6IChzdHlsZUtleVZhbHVlQXJyYXk6IEtleVZhbHVlQXJyYXk8YW55PiwgdGV4dDogc3RyaW5nKSA9PiB2b2lkLFxuICB2YWx1ZTogYW55IHwgTk9fQ0hBTkdFLFxuICBpc0NsYXNzQmFzZWQ6IGJvb2xlYW4sXG4pOiB2b2lkIHtcbiAgY29uc3QgdFZpZXcgPSBnZXRUVmlldygpO1xuICBjb25zdCBiaW5kaW5nSW5kZXggPSBpbmNyZW1lbnRCaW5kaW5nSW5kZXgoMik7XG4gIGlmICh0Vmlldy5maXJzdFVwZGF0ZVBhc3MpIHtcbiAgICBzdHlsaW5nRmlyc3RVcGRhdGVQYXNzKHRWaWV3LCBudWxsLCBiaW5kaW5nSW5kZXgsIGlzQ2xhc3NCYXNlZCk7XG4gIH1cbiAgY29uc3QgbFZpZXcgPSBnZXRMVmlldygpO1xuICBpZiAodmFsdWUgIT09IE5PX0NIQU5HRSAmJiBiaW5kaW5nVXBkYXRlZChsVmlldywgYmluZGluZ0luZGV4LCB2YWx1ZSkpIHtcbiAgICAvLyBgZ2V0U2VsZWN0ZWRJbmRleCgpYCBzaG91bGQgYmUgaGVyZSAocmF0aGVyIHRoYW4gaW4gaW5zdHJ1Y3Rpb24pIHNvIHRoYXQgaXQgaXMgZ3VhcmRlZCBieSB0aGVcbiAgICAvLyBpZiBzbyBhcyBub3QgdG8gcmVhZCB1bm5lY2Vzc2FyaWx5LlxuICAgIGNvbnN0IHROb2RlID0gdFZpZXcuZGF0YVtnZXRTZWxlY3RlZEluZGV4KCldIGFzIFROb2RlO1xuICAgIGlmIChoYXNTdHlsaW5nSW5wdXRTaGFkb3codE5vZGUsIGlzQ2xhc3NCYXNlZCkgJiYgIWlzSW5Ib3N0QmluZGluZ3ModFZpZXcsIGJpbmRpbmdJbmRleCkpIHtcbiAgICAgIGlmIChuZ0Rldk1vZGUpIHtcbiAgICAgICAgLy8gdmVyaWZ5IHRoYXQgaWYgd2UgYXJlIHNoYWRvd2luZyB0aGVuIGBURGF0YWAgaXMgYXBwcm9wcmlhdGVseSBtYXJrZWQgc28gdGhhdCB3ZSBza2lwXG4gICAgICAgIC8vIHByb2Nlc3NpbmcgdGhpcyBiaW5kaW5nIGluIHN0eWxpbmcgcmVzb2x1dGlvbi5cbiAgICAgICAgY29uc3QgdFN0eWxpbmdLZXkgPSB0Vmlldy5kYXRhW2JpbmRpbmdJbmRleF07XG4gICAgICAgIGFzc2VydEVxdWFsKFxuICAgICAgICAgIEFycmF5LmlzQXJyYXkodFN0eWxpbmdLZXkpID8gdFN0eWxpbmdLZXlbMV0gOiB0U3R5bGluZ0tleSxcbiAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICBcIlN0eWxpbmcgbGlua2VkIGxpc3Qgc2hhZG93IGlucHV0IHNob3VsZCBiZSBtYXJrZWQgYXMgJ2ZhbHNlJ1wiLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgLy8gVkUgZG9lcyBub3QgY29uY2F0ZW5hdGUgdGhlIHN0YXRpYyBwb3J0aW9uIGxpa2Ugd2UgYXJlIGRvaW5nIGhlcmUuXG4gICAgICAvLyBJbnN0ZWFkIFZFIGp1c3QgaWdub3JlcyB0aGUgc3RhdGljIGNvbXBsZXRlbHkgaWYgZHluYW1pYyBiaW5kaW5nIGlzIHByZXNlbnQuXG4gICAgICAvLyBCZWNhdXNlIG9mIGxvY2FsaXR5IHdlIGhhdmUgYWxyZWFkeSBzZXQgdGhlIHN0YXRpYyBwb3J0aW9uIGJlY2F1c2Ugd2UgZG9uJ3Qga25vdyBpZiB0aGVyZVxuICAgICAgLy8gaXMgYSBkeW5hbWljIHBvcnRpb24gdW50aWwgbGF0ZXIuIElmIHdlIHdvdWxkIGlnbm9yZSB0aGUgc3RhdGljIHBvcnRpb24gaXQgd291bGQgbG9vayBsaWtlXG4gICAgICAvLyB0aGUgYmluZGluZyBoYXMgcmVtb3ZlZCBpdC4gVGhpcyB3b3VsZCBjb25mdXNlIGBbbmdTdHlsZV1gL2BbbmdDbGFzc11gIHRvIGRvIHRoZSB3cm9uZ1xuICAgICAgLy8gdGhpbmcgYXMgaXQgd291bGQgdGhpbmsgdGhhdCB0aGUgc3RhdGljIHBvcnRpb24gd2FzIHJlbW92ZWQuIEZvciB0aGlzIHJlYXNvbiB3ZVxuICAgICAgLy8gY29uY2F0ZW5hdGUgaXQgc28gdGhhdCBgW25nU3R5bGVdYC9gW25nQ2xhc3NdYCAgY2FuIGNvbnRpbnVlIHRvIHdvcmsgb24gY2hhbmdlZC5cbiAgICAgIGxldCBzdGF0aWNQcmVmaXggPSBpc0NsYXNzQmFzZWQgPyB0Tm9kZS5jbGFzc2VzV2l0aG91dEhvc3QgOiB0Tm9kZS5zdHlsZXNXaXRob3V0SG9zdDtcbiAgICAgIG5nRGV2TW9kZSAmJlxuICAgICAgICBpc0NsYXNzQmFzZWQgPT09IGZhbHNlICYmXG4gICAgICAgIHN0YXRpY1ByZWZpeCAhPT0gbnVsbCAmJlxuICAgICAgICBhc3NlcnRFcXVhbChzdGF0aWNQcmVmaXguZW5kc1dpdGgoJzsnKSwgdHJ1ZSwgXCJFeHBlY3Rpbmcgc3RhdGljIHBvcnRpb24gdG8gZW5kIHdpdGggJzsnXCIpO1xuICAgICAgaWYgKHN0YXRpY1ByZWZpeCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBXZSB3YW50IHRvIG1ha2Ugc3VyZSB0aGF0IGZhbHN5IHZhbHVlcyBvZiBgdmFsdWVgIGJlY29tZSBlbXB0eSBzdHJpbmdzLlxuICAgICAgICB2YWx1ZSA9IGNvbmNhdFN0cmluZ3NXaXRoU3BhY2Uoc3RhdGljUHJlZml4LCB2YWx1ZSA/IHZhbHVlIDogJycpO1xuICAgICAgfVxuICAgICAgLy8gR2l2ZW4gYDxkaXYgW3N0eWxlXSBteS1kaXI+YCBzdWNoIHRoYXQgYG15LWRpcmAgaGFzIGBASW5wdXQoJ3N0eWxlJylgLlxuICAgICAgLy8gVGhpcyB0YWtlcyBvdmVyIHRoZSBgW3N0eWxlXWAgYmluZGluZy4gKFNhbWUgZm9yIGBbY2xhc3NdYClcbiAgICAgIHNldERpcmVjdGl2ZUlucHV0c1doaWNoU2hhZG93c1N0eWxpbmcodFZpZXcsIHROb2RlLCBsVmlldywgdmFsdWUsIGlzQ2xhc3NCYXNlZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHVwZGF0ZVN0eWxpbmdNYXAoXG4gICAgICAgIHRWaWV3LFxuICAgICAgICB0Tm9kZSxcbiAgICAgICAgbFZpZXcsXG4gICAgICAgIGxWaWV3W1JFTkRFUkVSXSxcbiAgICAgICAgbFZpZXdbYmluZGluZ0luZGV4ICsgMV0sXG4gICAgICAgIChsVmlld1tiaW5kaW5nSW5kZXggKyAxXSA9IHRvU3R5bGluZ0tleVZhbHVlQXJyYXkoa2V5VmFsdWVBcnJheVNldCwgc3RyaW5nUGFyc2VyLCB2YWx1ZSkpLFxuICAgICAgICBpc0NsYXNzQmFzZWQsXG4gICAgICAgIGJpbmRpbmdJbmRleCxcbiAgICAgICk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lcyB3aGVuIHRoZSBiaW5kaW5nIGlzIGluIGBob3N0QmluZGluZ3NgIHNlY3Rpb25cbiAqXG4gKiBAcGFyYW0gdFZpZXcgQ3VycmVudCBgVFZpZXdgXG4gKiBAcGFyYW0gYmluZGluZ0luZGV4IGluZGV4IG9mIGJpbmRpbmcgd2hpY2ggd2Ugd291bGQgbGlrZSBpZiBpdCBpcyBpbiBgaG9zdEJpbmRpbmdzYFxuICovXG5mdW5jdGlvbiBpc0luSG9zdEJpbmRpbmdzKHRWaWV3OiBUVmlldywgYmluZGluZ0luZGV4OiBudW1iZXIpOiBib29sZWFuIHtcbiAgLy8gQWxsIGhvc3QgYmluZGluZ3MgYXJlIHBsYWNlZCBhZnRlciB0aGUgZXhwYW5kbyBzZWN0aW9uLlxuICByZXR1cm4gYmluZGluZ0luZGV4ID49IHRWaWV3LmV4cGFuZG9TdGFydEluZGV4O1xufVxuXG4vKipcbiAqIENvbGxlY3RzIHRoZSBuZWNlc3NhcnkgaW5mb3JtYXRpb24gdG8gaW5zZXJ0IHRoZSBiaW5kaW5nIGludG8gYSBsaW5rZWQgbGlzdCBvZiBzdHlsZSBiaW5kaW5nc1xuICogdXNpbmcgYGluc2VydFRTdHlsaW5nQmluZGluZ2AuXG4gKlxuICogQHBhcmFtIHRWaWV3IGBUVmlld2Agd2hlcmUgdGhlIGJpbmRpbmcgbGlua2VkIGxpc3Qgd2lsbCBiZSBzdG9yZWQuXG4gKiBAcGFyYW0gdFN0eWxpbmdLZXkgUHJvcGVydHkva2V5IG9mIHRoZSBiaW5kaW5nLlxuICogQHBhcmFtIGJpbmRpbmdJbmRleCBJbmRleCBvZiBiaW5kaW5nIGFzc29jaWF0ZWQgd2l0aCB0aGUgYHByb3BgXG4gKiBAcGFyYW0gaXNDbGFzc0Jhc2VkIGB0cnVlYCBpZiBgY2xhc3NgIGNoYW5nZSAoYGZhbHNlYCBpZiBgc3R5bGVgKVxuICovXG5mdW5jdGlvbiBzdHlsaW5nRmlyc3RVcGRhdGVQYXNzKFxuICB0VmlldzogVFZpZXcsXG4gIHRTdHlsaW5nS2V5OiBUU3R5bGluZ0tleSxcbiAgYmluZGluZ0luZGV4OiBudW1iZXIsXG4gIGlzQ2xhc3NCYXNlZDogYm9vbGVhbixcbik6IHZvaWQge1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0Rmlyc3RVcGRhdGVQYXNzKHRWaWV3KTtcbiAgY29uc3QgdERhdGEgPSB0Vmlldy5kYXRhO1xuICBpZiAodERhdGFbYmluZGluZ0luZGV4ICsgMV0gPT09IG51bGwpIHtcbiAgICAvLyBUaGUgYWJvdmUgY2hlY2sgaXMgbmVjZXNzYXJ5IGJlY2F1c2Ugd2UgZG9uJ3QgY2xlYXIgZmlyc3QgdXBkYXRlIHBhc3MgdW50aWwgZmlyc3Qgc3VjY2Vzc2Z1bFxuICAgIC8vIChubyBleGNlcHRpb24pIHRlbXBsYXRlIGV4ZWN1dGlvbi4gVGhpcyBwcmV2ZW50cyB0aGUgc3R5bGluZyBpbnN0cnVjdGlvbiBmcm9tIGRvdWJsZSBhZGRpbmdcbiAgICAvLyBpdHNlbGYgdG8gdGhlIGxpc3QuXG4gICAgLy8gYGdldFNlbGVjdGVkSW5kZXgoKWAgc2hvdWxkIGJlIGhlcmUgKHJhdGhlciB0aGFuIGluIGluc3RydWN0aW9uKSBzbyB0aGF0IGl0IGlzIGd1YXJkZWQgYnkgdGhlXG4gICAgLy8gaWYgc28gYXMgbm90IHRvIHJlYWQgdW5uZWNlc3NhcmlseS5cbiAgICBjb25zdCB0Tm9kZSA9IHREYXRhW2dldFNlbGVjdGVkSW5kZXgoKV0gYXMgVE5vZGU7XG4gICAgbmdEZXZNb2RlICYmIGFzc2VydERlZmluZWQodE5vZGUsICdUTm9kZSBleHBlY3RlZCcpO1xuICAgIGNvbnN0IGlzSG9zdEJpbmRpbmdzID0gaXNJbkhvc3RCaW5kaW5ncyh0VmlldywgYmluZGluZ0luZGV4KTtcbiAgICBpZiAoaGFzU3R5bGluZ0lucHV0U2hhZG93KHROb2RlLCBpc0NsYXNzQmFzZWQpICYmIHRTdHlsaW5nS2V5ID09PSBudWxsICYmICFpc0hvc3RCaW5kaW5ncykge1xuICAgICAgLy8gYHRTdHlsaW5nS2V5ID09PSBudWxsYCBpbXBsaWVzIHRoYXQgd2UgYXJlIGVpdGhlciBgW3N0eWxlXWAgb3IgYFtjbGFzc11gIGJpbmRpbmcuXG4gICAgICAvLyBJZiB0aGVyZSBpcyBhIGRpcmVjdGl2ZSB3aGljaCB1c2VzIGBASW5wdXQoJ3N0eWxlJylgIG9yIGBASW5wdXQoJ2NsYXNzJylgIHRoYW5cbiAgICAgIC8vIHdlIG5lZWQgdG8gbmV1dHJhbGl6ZSB0aGlzIGJpbmRpbmcgc2luY2UgdGhhdCBkaXJlY3RpdmUgaXMgc2hhZG93aW5nIGl0LlxuICAgICAgLy8gV2UgdHVybiB0aGlzIGludG8gYSBub29wIGJ5IHNldHRpbmcgdGhlIGtleSB0byBgZmFsc2VgXG4gICAgICB0U3R5bGluZ0tleSA9IGZhbHNlO1xuICAgIH1cbiAgICB0U3R5bGluZ0tleSA9IHdyYXBJblN0YXRpY1N0eWxpbmdLZXkodERhdGEsIHROb2RlLCB0U3R5bGluZ0tleSwgaXNDbGFzc0Jhc2VkKTtcbiAgICBpbnNlcnRUU3R5bGluZ0JpbmRpbmcodERhdGEsIHROb2RlLCB0U3R5bGluZ0tleSwgYmluZGluZ0luZGV4LCBpc0hvc3RCaW5kaW5ncywgaXNDbGFzc0Jhc2VkKTtcbiAgfVxufVxuXG4vKipcbiAqIEFkZHMgc3RhdGljIHN0eWxpbmcgaW5mb3JtYXRpb24gdG8gdGhlIGJpbmRpbmcgaWYgYXBwbGljYWJsZS5cbiAqXG4gKiBUaGUgbGlua2VkIGxpc3Qgb2Ygc3R5bGVzIG5vdCBvbmx5IHN0b3JlcyB0aGUgbGlzdCBhbmQga2V5cywgYnV0IGFsc28gc3RvcmVzIHN0YXRpYyBzdHlsaW5nXG4gKiBpbmZvcm1hdGlvbiBvbiBzb21lIG9mIHRoZSBrZXlzLiBUaGlzIGZ1bmN0aW9uIGRldGVybWluZXMgaWYgdGhlIGtleSBzaG91bGQgY29udGFpbiB0aGUgc3R5bGluZ1xuICogaW5mb3JtYXRpb24gYW5kIGNvbXB1dGVzIGl0LlxuICpcbiAqIFNlZSBgVFN0eWxpbmdTdGF0aWNgIGZvciBtb3JlIGRldGFpbHMuXG4gKlxuICogQHBhcmFtIHREYXRhIGBURGF0YWAgd2hlcmUgdGhlIGxpbmtlZCBsaXN0IGlzIHN0b3JlZC5cbiAqIEBwYXJhbSB0Tm9kZSBgVE5vZGVgIGZvciB3aGljaCB0aGUgc3R5bGluZyBpcyBiZWluZyBjb21wdXRlZC5cbiAqIEBwYXJhbSBzdHlsaW5nS2V5IGBUU3R5bGluZ0tleVByaW1pdGl2ZWAgd2hpY2ggbWF5IG5lZWQgdG8gYmUgd3JhcHBlZCBpbnRvIGBUU3R5bGluZ0tleWBcbiAqIEBwYXJhbSBpc0NsYXNzQmFzZWQgYHRydWVgIGlmIGBjbGFzc2AgKGBmYWxzZWAgaWYgYHN0eWxlYClcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdyYXBJblN0YXRpY1N0eWxpbmdLZXkoXG4gIHREYXRhOiBURGF0YSxcbiAgdE5vZGU6IFROb2RlLFxuICBzdHlsaW5nS2V5OiBUU3R5bGluZ0tleSxcbiAgaXNDbGFzc0Jhc2VkOiBib29sZWFuLFxuKTogVFN0eWxpbmdLZXkge1xuICBjb25zdCBob3N0RGlyZWN0aXZlRGVmID0gZ2V0Q3VycmVudERpcmVjdGl2ZURlZih0RGF0YSk7XG4gIGxldCByZXNpZHVhbCA9IGlzQ2xhc3NCYXNlZCA/IHROb2RlLnJlc2lkdWFsQ2xhc3NlcyA6IHROb2RlLnJlc2lkdWFsU3R5bGVzO1xuICBpZiAoaG9zdERpcmVjdGl2ZURlZiA9PT0gbnVsbCkge1xuICAgIC8vIFdlIGFyZSBpbiB0ZW1wbGF0ZSBub2RlLlxuICAgIC8vIElmIHRlbXBsYXRlIG5vZGUgYWxyZWFkeSBoYWQgc3R5bGluZyBpbnN0cnVjdGlvbiB0aGVuIGl0IGhhcyBhbHJlYWR5IGNvbGxlY3RlZCB0aGUgc3RhdGljXG4gICAgLy8gc3R5bGluZyBhbmQgdGhlcmUgaXMgbm8gbmVlZCB0byBjb2xsZWN0IHRoZW0gYWdhaW4uIFdlIGtub3cgdGhhdCB3ZSBhcmUgdGhlIGZpcnN0IHN0eWxpbmdcbiAgICAvLyBpbnN0cnVjdGlvbiBiZWNhdXNlIHRoZSBgVE5vZGUuKkJpbmRpbmdzYCBwb2ludHMgdG8gMCAobm90aGluZyBoYXMgYmVlbiBpbnNlcnRlZCB5ZXQpLlxuICAgIGNvbnN0IGlzRmlyc3RTdHlsaW5nSW5zdHJ1Y3Rpb25JblRlbXBsYXRlID1cbiAgICAgICgoaXNDbGFzc0Jhc2VkID8gdE5vZGUuY2xhc3NCaW5kaW5ncyA6IHROb2RlLnN0eWxlQmluZGluZ3MpIGFzIGFueSBhcyBudW1iZXIpID09PSAwO1xuICAgIGlmIChpc0ZpcnN0U3R5bGluZ0luc3RydWN0aW9uSW5UZW1wbGF0ZSkge1xuICAgICAgLy8gSXQgd291bGQgYmUgbmljZSB0byBiZSBhYmxlIHRvIGdldCB0aGUgc3RhdGljcyBmcm9tIGBtZXJnZUF0dHJzYCwgaG93ZXZlciwgYXQgdGhpcyBwb2ludFxuICAgICAgLy8gdGhleSBhcmUgYWxyZWFkeSBtZXJnZWQgYW5kIGl0IHdvdWxkIG5vdCBiZSBwb3NzaWJsZSB0byBmaWd1cmUgd2hpY2ggcHJvcGVydHkgYmVsb25ncyB3aGVyZVxuICAgICAgLy8gaW4gdGhlIHByaW9yaXR5LlxuICAgICAgc3R5bGluZ0tleSA9IGNvbGxlY3RTdHlsaW5nRnJvbURpcmVjdGl2ZXMobnVsbCwgdERhdGEsIHROb2RlLCBzdHlsaW5nS2V5LCBpc0NsYXNzQmFzZWQpO1xuICAgICAgc3R5bGluZ0tleSA9IGNvbGxlY3RTdHlsaW5nRnJvbVRBdHRycyhzdHlsaW5nS2V5LCB0Tm9kZS5hdHRycywgaXNDbGFzc0Jhc2VkKTtcbiAgICAgIC8vIFdlIGtub3cgdGhhdCBpZiB3ZSBoYXZlIHN0eWxpbmcgYmluZGluZyBpbiB0ZW1wbGF0ZSB3ZSBjYW4ndCBoYXZlIHJlc2lkdWFsLlxuICAgICAgcmVzaWR1YWwgPSBudWxsO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBXZSBhcmUgaW4gaG9zdCBiaW5kaW5nIG5vZGUgYW5kIHRoZXJlIHdhcyBubyBiaW5kaW5nIGluc3RydWN0aW9uIGluIHRlbXBsYXRlIG5vZGUuXG4gICAgLy8gVGhpcyBtZWFucyB0aGF0IHdlIG5lZWQgdG8gY29tcHV0ZSB0aGUgcmVzaWR1YWwuXG4gICAgY29uc3QgZGlyZWN0aXZlU3R5bGluZ0xhc3QgPSB0Tm9kZS5kaXJlY3RpdmVTdHlsaW5nTGFzdDtcbiAgICBjb25zdCBpc0ZpcnN0U3R5bGluZ0luc3RydWN0aW9uSW5Ib3N0QmluZGluZyA9XG4gICAgICBkaXJlY3RpdmVTdHlsaW5nTGFzdCA9PT0gLTEgfHwgdERhdGFbZGlyZWN0aXZlU3R5bGluZ0xhc3RdICE9PSBob3N0RGlyZWN0aXZlRGVmO1xuICAgIGlmIChpc0ZpcnN0U3R5bGluZ0luc3RydWN0aW9uSW5Ib3N0QmluZGluZykge1xuICAgICAgc3R5bGluZ0tleSA9IGNvbGxlY3RTdHlsaW5nRnJvbURpcmVjdGl2ZXMoXG4gICAgICAgIGhvc3REaXJlY3RpdmVEZWYsXG4gICAgICAgIHREYXRhLFxuICAgICAgICB0Tm9kZSxcbiAgICAgICAgc3R5bGluZ0tleSxcbiAgICAgICAgaXNDbGFzc0Jhc2VkLFxuICAgICAgKTtcbiAgICAgIGlmIChyZXNpZHVhbCA9PT0gbnVsbCkge1xuICAgICAgICAvLyAtIElmIGBudWxsYCB0aGFuIGVpdGhlcjpcbiAgICAgICAgLy8gICAgLSBUZW1wbGF0ZSBzdHlsaW5nIGluc3RydWN0aW9uIGFscmVhZHkgcmFuIGFuZCBpdCBoYXMgY29uc3VtZWQgdGhlIHN0YXRpY1xuICAgICAgICAvLyAgICAgIHN0eWxpbmcgaW50byBpdHMgYFRTdHlsaW5nS2V5YCBhbmQgc28gdGhlcmUgaXMgbm8gbmVlZCB0byB1cGRhdGUgcmVzaWR1YWwuIEluc3RlYWRcbiAgICAgICAgLy8gICAgICB3ZSBuZWVkIHRvIHVwZGF0ZSB0aGUgYFRTdHlsaW5nS2V5YCBhc3NvY2lhdGVkIHdpdGggdGhlIGZpcnN0IHRlbXBsYXRlIG5vZGVcbiAgICAgICAgLy8gICAgICBpbnN0cnVjdGlvbi4gT1JcbiAgICAgICAgLy8gICAgLSBTb21lIG90aGVyIHN0eWxpbmcgaW5zdHJ1Y3Rpb24gcmFuIGFuZCBkZXRlcm1pbmVkIHRoYXQgdGhlcmUgYXJlIG5vIHJlc2lkdWFsc1xuICAgICAgICBsZXQgdGVtcGxhdGVTdHlsaW5nS2V5ID0gZ2V0VGVtcGxhdGVIZWFkVFN0eWxpbmdLZXkodERhdGEsIHROb2RlLCBpc0NsYXNzQmFzZWQpO1xuICAgICAgICBpZiAodGVtcGxhdGVTdHlsaW5nS2V5ICE9PSB1bmRlZmluZWQgJiYgQXJyYXkuaXNBcnJheSh0ZW1wbGF0ZVN0eWxpbmdLZXkpKSB7XG4gICAgICAgICAgLy8gT25seSByZWNvbXB1dGUgaWYgYHRlbXBsYXRlU3R5bGluZ0tleWAgaGFkIHN0YXRpYyB2YWx1ZXMuIChJZiBubyBzdGF0aWMgdmFsdWUgZm91bmRcbiAgICAgICAgICAvLyB0aGVuIHRoZXJlIGlzIG5vdGhpbmcgdG8gZG8gc2luY2UgdGhpcyBvcGVyYXRpb24gY2FuIG9ubHkgcHJvZHVjZSBsZXNzIHN0YXRpYyBrZXlzLCBub3RcbiAgICAgICAgICAvLyBtb3JlLilcbiAgICAgICAgICB0ZW1wbGF0ZVN0eWxpbmdLZXkgPSBjb2xsZWN0U3R5bGluZ0Zyb21EaXJlY3RpdmVzKFxuICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgIHREYXRhLFxuICAgICAgICAgICAgdE5vZGUsXG4gICAgICAgICAgICB0ZW1wbGF0ZVN0eWxpbmdLZXlbMV0gLyogdW53cmFwIHByZXZpb3VzIHN0YXRpY3MgKi8sXG4gICAgICAgICAgICBpc0NsYXNzQmFzZWQsXG4gICAgICAgICAgKTtcbiAgICAgICAgICB0ZW1wbGF0ZVN0eWxpbmdLZXkgPSBjb2xsZWN0U3R5bGluZ0Zyb21UQXR0cnMoXG4gICAgICAgICAgICB0ZW1wbGF0ZVN0eWxpbmdLZXksXG4gICAgICAgICAgICB0Tm9kZS5hdHRycyxcbiAgICAgICAgICAgIGlzQ2xhc3NCYXNlZCxcbiAgICAgICAgICApO1xuICAgICAgICAgIHNldFRlbXBsYXRlSGVhZFRTdHlsaW5nS2V5KHREYXRhLCB0Tm9kZSwgaXNDbGFzc0Jhc2VkLCB0ZW1wbGF0ZVN0eWxpbmdLZXkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBXZSBvbmx5IG5lZWQgdG8gcmVjb21wdXRlIHJlc2lkdWFsIGlmIGl0IGlzIG5vdCBgbnVsbGAuXG4gICAgICAgIC8vIC0gSWYgZXhpc3RpbmcgcmVzaWR1YWwgKGltcGxpZXMgdGhlcmUgd2FzIG5vIHRlbXBsYXRlIHN0eWxpbmcpLiBUaGlzIG1lYW5zIHRoYXQgc29tZSBvZlxuICAgICAgICAvLyAgIHRoZSBzdGF0aWNzIG1heSBoYXZlIG1vdmVkIGZyb20gdGhlIHJlc2lkdWFsIHRvIHRoZSBgc3R5bGluZ0tleWAgYW5kIHNvIHdlIGhhdmUgdG9cbiAgICAgICAgLy8gICByZWNvbXB1dGUuXG4gICAgICAgIC8vIC0gSWYgYHVuZGVmaW5lZGAgdGhpcyBpcyB0aGUgZmlyc3QgdGltZSB3ZSBhcmUgcnVubmluZy5cbiAgICAgICAgcmVzaWR1YWwgPSBjb2xsZWN0UmVzaWR1YWwodERhdGEsIHROb2RlLCBpc0NsYXNzQmFzZWQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAocmVzaWR1YWwgIT09IHVuZGVmaW5lZCkge1xuICAgIGlzQ2xhc3NCYXNlZCA/ICh0Tm9kZS5yZXNpZHVhbENsYXNzZXMgPSByZXNpZHVhbCkgOiAodE5vZGUucmVzaWR1YWxTdHlsZXMgPSByZXNpZHVhbCk7XG4gIH1cbiAgcmV0dXJuIHN0eWxpbmdLZXk7XG59XG5cbi8qKlxuICogUmV0cmlldmUgdGhlIGBUU3R5bGluZ0tleWAgZm9yIHRoZSB0ZW1wbGF0ZSBzdHlsaW5nIGluc3RydWN0aW9uLlxuICpcbiAqIFRoaXMgaXMgbmVlZGVkIHNpbmNlIGBob3N0QmluZGluZ2Agc3R5bGluZyBpbnN0cnVjdGlvbnMgYXJlIGluc2VydGVkIGFmdGVyIHRoZSB0ZW1wbGF0ZVxuICogaW5zdHJ1Y3Rpb24uIFdoaWxlIHRoZSB0ZW1wbGF0ZSBpbnN0cnVjdGlvbiBuZWVkcyB0byB1cGRhdGUgdGhlIHJlc2lkdWFsIGluIGBUTm9kZWAgdGhlXG4gKiBgaG9zdEJpbmRpbmdgIGluc3RydWN0aW9ucyBuZWVkIHRvIHVwZGF0ZSB0aGUgYFRTdHlsaW5nS2V5YCBvZiB0aGUgdGVtcGxhdGUgaW5zdHJ1Y3Rpb24gYmVjYXVzZVxuICogdGhlIHRlbXBsYXRlIGluc3RydWN0aW9uIGlzIGRvd25zdHJlYW0gZnJvbSB0aGUgYGhvc3RCaW5kaW5nc2AgaW5zdHJ1Y3Rpb25zLlxuICpcbiAqIEBwYXJhbSB0RGF0YSBgVERhdGFgIHdoZXJlIHRoZSBsaW5rZWQgbGlzdCBpcyBzdG9yZWQuXG4gKiBAcGFyYW0gdE5vZGUgYFROb2RlYCBmb3Igd2hpY2ggdGhlIHN0eWxpbmcgaXMgYmVpbmcgY29tcHV0ZWQuXG4gKiBAcGFyYW0gaXNDbGFzc0Jhc2VkIGB0cnVlYCBpZiBgY2xhc3NgIChgZmFsc2VgIGlmIGBzdHlsZWApXG4gKiBAcmV0dXJuIGBUU3R5bGluZ0tleWAgaWYgZm91bmQgb3IgYHVuZGVmaW5lZGAgaWYgbm90IGZvdW5kLlxuICovXG5mdW5jdGlvbiBnZXRUZW1wbGF0ZUhlYWRUU3R5bGluZ0tleShcbiAgdERhdGE6IFREYXRhLFxuICB0Tm9kZTogVE5vZGUsXG4gIGlzQ2xhc3NCYXNlZDogYm9vbGVhbixcbik6IFRTdHlsaW5nS2V5IHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgYmluZGluZ3MgPSBpc0NsYXNzQmFzZWQgPyB0Tm9kZS5jbGFzc0JpbmRpbmdzIDogdE5vZGUuc3R5bGVCaW5kaW5ncztcbiAgaWYgKGdldFRTdHlsaW5nUmFuZ2VOZXh0KGJpbmRpbmdzKSA9PT0gMCkge1xuICAgIC8vIFRoZXJlIGRvZXMgbm90IHNlZW0gdG8gYmUgYSBzdHlsaW5nIGluc3RydWN0aW9uIGluIHRoZSBgdGVtcGxhdGVgLlxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbiAgcmV0dXJuIHREYXRhW2dldFRTdHlsaW5nUmFuZ2VQcmV2KGJpbmRpbmdzKV0gYXMgVFN0eWxpbmdLZXk7XG59XG5cbi8qKlxuICogVXBkYXRlIHRoZSBgVFN0eWxpbmdLZXlgIG9mIHRoZSBmaXJzdCB0ZW1wbGF0ZSBpbnN0cnVjdGlvbiBpbiBgVE5vZGVgLlxuICpcbiAqIExvZ2ljYWxseSBgaG9zdEJpbmRpbmdzYCBzdHlsaW5nIGluc3RydWN0aW9ucyBhcmUgb2YgbG93ZXIgcHJpb3JpdHkgdGhhbiB0aGF0IG9mIHRoZSB0ZW1wbGF0ZS5cbiAqIEhvd2V2ZXIsIHRoZXkgZXhlY3V0ZSBhZnRlciB0aGUgdGVtcGxhdGUgc3R5bGluZyBpbnN0cnVjdGlvbnMuIFRoaXMgbWVhbnMgdGhhdCB0aGV5IGdldCBpbnNlcnRlZFxuICogaW4gZnJvbnQgb2YgdGhlIHRlbXBsYXRlIHN0eWxpbmcgaW5zdHJ1Y3Rpb25zLlxuICpcbiAqIElmIHdlIGhhdmUgYSB0ZW1wbGF0ZSBzdHlsaW5nIGluc3RydWN0aW9uIGFuZCBhIG5ldyBgaG9zdEJpbmRpbmdzYCBzdHlsaW5nIGluc3RydWN0aW9uIGlzXG4gKiBleGVjdXRlZCBpdCBtZWFucyB0aGF0IGl0IG1heSBuZWVkIHRvIHN0ZWFsIHN0YXRpYyBmaWVsZHMgZnJvbSB0aGUgdGVtcGxhdGUgaW5zdHJ1Y3Rpb24uIFRoaXNcbiAqIG1ldGhvZCBhbGxvd3MgdXMgdG8gdXBkYXRlIHRoZSBmaXJzdCB0ZW1wbGF0ZSBpbnN0cnVjdGlvbiBgVFN0eWxpbmdLZXlgIHdpdGggYSBuZXcgdmFsdWUuXG4gKlxuICogQXNzdW1lOlxuICogYGBgXG4gKiA8ZGl2IG15LWRpciBzdHlsZT1cImNvbG9yOiByZWRcIiBbc3R5bGUuY29sb3JdPVwidG1wbEV4cFwiPjwvZGl2PlxuICpcbiAqIEBEaXJlY3RpdmUoe1xuICogICBob3N0OiB7XG4gKiAgICAgJ3N0eWxlJzogJ3dpZHRoOiAxMDBweCcsXG4gKiAgICAgJ1tzdHlsZS5jb2xvcl0nOiAnZGlyRXhwJyxcbiAqICAgfVxuICogfSlcbiAqIGNsYXNzIE15RGlyIHt9XG4gKiBgYGBcbiAqXG4gKiB3aGVuIGBbc3R5bGUuY29sb3JdPVwidG1wbEV4cFwiYCBleGVjdXRlcyBpdCBjcmVhdGVzIHRoaXMgZGF0YSBzdHJ1Y3R1cmUuXG4gKiBgYGBcbiAqICBbJycsICdjb2xvcicsICdjb2xvcicsICdyZWQnLCAnd2lkdGgnLCAnMTAwcHgnXSxcbiAqIGBgYFxuICpcbiAqIFRoZSByZWFzb24gZm9yIHRoaXMgaXMgdGhhdCB0aGUgdGVtcGxhdGUgaW5zdHJ1Y3Rpb24gZG9lcyBub3Qga25vdyBpZiB0aGVyZSBhcmUgc3R5bGluZ1xuICogaW5zdHJ1Y3Rpb25zIGFuZCBtdXN0IGFzc3VtZSB0aGF0IHRoZXJlIGFyZSBub25lIGFuZCBtdXN0IGNvbGxlY3QgYWxsIG9mIHRoZSBzdGF0aWMgc3R5bGluZy5cbiAqIChib3RoXG4gKiBgY29sb3InIGFuZCAnd2lkdGhgKVxuICpcbiAqIFdoZW4gYCdbc3R5bGUuY29sb3JdJzogJ2RpckV4cCcsYCBleGVjdXRlcyB3ZSBuZWVkIHRvIGluc2VydCBhIG5ldyBkYXRhIGludG8gdGhlIGxpbmtlZCBsaXN0LlxuICogYGBgXG4gKiAgWycnLCAnY29sb3InLCAnd2lkdGgnLCAnMTAwcHgnXSwgIC8vIG5ld2x5IGluc2VydGVkXG4gKiAgWycnLCAnY29sb3InLCAnY29sb3InLCAncmVkJywgJ3dpZHRoJywgJzEwMHB4J10sIC8vIHRoaXMgaXMgd3JvbmdcbiAqIGBgYFxuICpcbiAqIE5vdGljZSB0aGF0IHRoZSB0ZW1wbGF0ZSBzdGF0aWNzIGlzIG5vdyB3cm9uZyBhcyBpdCBpbmNvcnJlY3RseSBjb250YWlucyBgd2lkdGhgIHNvIHdlIG5lZWQgdG9cbiAqIHVwZGF0ZSBpdCBsaWtlIHNvOlxuICogYGBgXG4gKiAgWycnLCAnY29sb3InLCAnd2lkdGgnLCAnMTAwcHgnXSxcbiAqICBbJycsICdjb2xvcicsICdjb2xvcicsICdyZWQnXSwgICAgLy8gVVBEQVRFXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdERhdGEgYFREYXRhYCB3aGVyZSB0aGUgbGlua2VkIGxpc3QgaXMgc3RvcmVkLlxuICogQHBhcmFtIHROb2RlIGBUTm9kZWAgZm9yIHdoaWNoIHRoZSBzdHlsaW5nIGlzIGJlaW5nIGNvbXB1dGVkLlxuICogQHBhcmFtIGlzQ2xhc3NCYXNlZCBgdHJ1ZWAgaWYgYGNsYXNzYCAoYGZhbHNlYCBpZiBgc3R5bGVgKVxuICogQHBhcmFtIHRTdHlsaW5nS2V5IE5ldyBgVFN0eWxpbmdLZXlgIHdoaWNoIGlzIHJlcGxhY2luZyB0aGUgb2xkIG9uZS5cbiAqL1xuZnVuY3Rpb24gc2V0VGVtcGxhdGVIZWFkVFN0eWxpbmdLZXkoXG4gIHREYXRhOiBURGF0YSxcbiAgdE5vZGU6IFROb2RlLFxuICBpc0NsYXNzQmFzZWQ6IGJvb2xlYW4sXG4gIHRTdHlsaW5nS2V5OiBUU3R5bGluZ0tleSxcbik6IHZvaWQge1xuICBjb25zdCBiaW5kaW5ncyA9IGlzQ2xhc3NCYXNlZCA/IHROb2RlLmNsYXNzQmluZGluZ3MgOiB0Tm9kZS5zdHlsZUJpbmRpbmdzO1xuICBuZ0Rldk1vZGUgJiZcbiAgICBhc3NlcnROb3RFcXVhbChcbiAgICAgIGdldFRTdHlsaW5nUmFuZ2VOZXh0KGJpbmRpbmdzKSxcbiAgICAgIDAsXG4gICAgICAnRXhwZWN0aW5nIHRvIGhhdmUgYXQgbGVhc3Qgb25lIHRlbXBsYXRlIHN0eWxpbmcgYmluZGluZy4nLFxuICAgICk7XG4gIHREYXRhW2dldFRTdHlsaW5nUmFuZ2VQcmV2KGJpbmRpbmdzKV0gPSB0U3R5bGluZ0tleTtcbn1cblxuLyoqXG4gKiBDb2xsZWN0IGFsbCBzdGF0aWMgdmFsdWVzIGFmdGVyIHRoZSBjdXJyZW50IGBUTm9kZS5kaXJlY3RpdmVTdHlsaW5nTGFzdGAgaW5kZXguXG4gKlxuICogQ29sbGVjdCB0aGUgcmVtYWluaW5nIHN0eWxpbmcgaW5mb3JtYXRpb24gd2hpY2ggaGFzIG5vdCB5ZXQgYmVlbiBjb2xsZWN0ZWQgYnkgYW4gZXhpc3RpbmdcbiAqIHN0eWxpbmcgaW5zdHJ1Y3Rpb24uXG4gKlxuICogQHBhcmFtIHREYXRhIGBURGF0YWAgd2hlcmUgdGhlIGBEaXJlY3RpdmVEZWZzYCBhcmUgc3RvcmVkLlxuICogQHBhcmFtIHROb2RlIGBUTm9kZWAgd2hpY2ggY29udGFpbnMgdGhlIGRpcmVjdGl2ZSByYW5nZS5cbiAqIEBwYXJhbSBpc0NsYXNzQmFzZWQgYHRydWVgIGlmIGBjbGFzc2AgKGBmYWxzZWAgaWYgYHN0eWxlYClcbiAqL1xuZnVuY3Rpb24gY29sbGVjdFJlc2lkdWFsKFxuICB0RGF0YTogVERhdGEsXG4gIHROb2RlOiBUTm9kZSxcbiAgaXNDbGFzc0Jhc2VkOiBib29sZWFuLFxuKTogS2V5VmFsdWVBcnJheTxhbnk+IHwgbnVsbCB7XG4gIGxldCByZXNpZHVhbDogS2V5VmFsdWVBcnJheTxhbnk+IHwgbnVsbCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgY29uc3QgZGlyZWN0aXZlRW5kID0gdE5vZGUuZGlyZWN0aXZlRW5kO1xuICBuZ0Rldk1vZGUgJiZcbiAgICBhc3NlcnROb3RFcXVhbChcbiAgICAgIHROb2RlLmRpcmVjdGl2ZVN0eWxpbmdMYXN0LFxuICAgICAgLTEsXG4gICAgICAnQnkgdGhlIHRpbWUgdGhpcyBmdW5jdGlvbiBnZXRzIGNhbGxlZCBhdCBsZWFzdCBvbmUgaG9zdEJpbmRpbmdzLW5vZGUgc3R5bGluZyBpbnN0cnVjdGlvbiBtdXN0IGhhdmUgZXhlY3V0ZWQuJyxcbiAgICApO1xuICAvLyBXZSBhZGQgYDEgKyB0Tm9kZS5kaXJlY3RpdmVTdGFydGAgYmVjYXVzZSB3ZSBuZWVkIHRvIHNraXAgdGhlIGN1cnJlbnQgZGlyZWN0aXZlIChhcyB3ZSBhcmVcbiAgLy8gY29sbGVjdGluZyB0aGluZ3MgYWZ0ZXIgdGhlIGxhc3QgYGhvc3RCaW5kaW5nc2AgZGlyZWN0aXZlIHdoaWNoIGhhZCBhIHN0eWxpbmcgaW5zdHJ1Y3Rpb24uKVxuICBmb3IgKGxldCBpID0gMSArIHROb2RlLmRpcmVjdGl2ZVN0eWxpbmdMYXN0OyBpIDwgZGlyZWN0aXZlRW5kOyBpKyspIHtcbiAgICBjb25zdCBhdHRycyA9ICh0RGF0YVtpXSBhcyBEaXJlY3RpdmVEZWY8YW55PikuaG9zdEF0dHJzO1xuICAgIHJlc2lkdWFsID0gY29sbGVjdFN0eWxpbmdGcm9tVEF0dHJzKHJlc2lkdWFsLCBhdHRycywgaXNDbGFzc0Jhc2VkKSBhcyBLZXlWYWx1ZUFycmF5PGFueT4gfCBudWxsO1xuICB9XG4gIHJldHVybiBjb2xsZWN0U3R5bGluZ0Zyb21UQXR0cnMocmVzaWR1YWwsIHROb2RlLmF0dHJzLCBpc0NsYXNzQmFzZWQpIGFzIEtleVZhbHVlQXJyYXk8YW55PiB8IG51bGw7XG59XG5cbi8qKlxuICogQ29sbGVjdCB0aGUgc3RhdGljIHN0eWxpbmcgaW5mb3JtYXRpb24gd2l0aCBsb3dlciBwcmlvcml0eSB0aGFuIGBob3N0RGlyZWN0aXZlRGVmYC5cbiAqXG4gKiAoVGhpcyBpcyBvcHBvc2l0ZSBvZiByZXNpZHVhbCBzdHlsaW5nLilcbiAqXG4gKiBAcGFyYW0gaG9zdERpcmVjdGl2ZURlZiBgRGlyZWN0aXZlRGVmYCBmb3Igd2hpY2ggd2Ugd2FudCB0byBjb2xsZWN0IGxvd2VyIHByaW9yaXR5IHN0YXRpY1xuICogICAgICAgIHN0eWxpbmcuIChPciBgbnVsbGAgaWYgdGVtcGxhdGUgc3R5bGluZylcbiAqIEBwYXJhbSB0RGF0YSBgVERhdGFgIHdoZXJlIHRoZSBsaW5rZWQgbGlzdCBpcyBzdG9yZWQuXG4gKiBAcGFyYW0gdE5vZGUgYFROb2RlYCBmb3Igd2hpY2ggdGhlIHN0eWxpbmcgaXMgYmVpbmcgY29tcHV0ZWQuXG4gKiBAcGFyYW0gc3R5bGluZ0tleSBFeGlzdGluZyBgVFN0eWxpbmdLZXlgIHRvIHVwZGF0ZSBvciB3cmFwLlxuICogQHBhcmFtIGlzQ2xhc3NCYXNlZCBgdHJ1ZWAgaWYgYGNsYXNzYCAoYGZhbHNlYCBpZiBgc3R5bGVgKVxuICovXG5mdW5jdGlvbiBjb2xsZWN0U3R5bGluZ0Zyb21EaXJlY3RpdmVzKFxuICBob3N0RGlyZWN0aXZlRGVmOiBEaXJlY3RpdmVEZWY8YW55PiB8IG51bGwsXG4gIHREYXRhOiBURGF0YSxcbiAgdE5vZGU6IFROb2RlLFxuICBzdHlsaW5nS2V5OiBUU3R5bGluZ0tleSxcbiAgaXNDbGFzc0Jhc2VkOiBib29sZWFuLFxuKTogVFN0eWxpbmdLZXkge1xuICAvLyBXZSBuZWVkIHRvIGxvb3AgYmVjYXVzZSB0aGVyZSBjYW4gYmUgZGlyZWN0aXZlcyB3aGljaCBoYXZlIGBob3N0QXR0cnNgIGJ1dCBkb24ndCBoYXZlXG4gIC8vIGBob3N0QmluZGluZ3NgIHNvIHRoaXMgbG9vcCBjYXRjaGVzIHVwIHRvIHRoZSBjdXJyZW50IGRpcmVjdGl2ZS4uXG4gIGxldCBjdXJyZW50RGlyZWN0aXZlOiBEaXJlY3RpdmVEZWY8YW55PiB8IG51bGwgPSBudWxsO1xuICBjb25zdCBkaXJlY3RpdmVFbmQgPSB0Tm9kZS5kaXJlY3RpdmVFbmQ7XG4gIGxldCBkaXJlY3RpdmVTdHlsaW5nTGFzdCA9IHROb2RlLmRpcmVjdGl2ZVN0eWxpbmdMYXN0O1xuICBpZiAoZGlyZWN0aXZlU3R5bGluZ0xhc3QgPT09IC0xKSB7XG4gICAgZGlyZWN0aXZlU3R5bGluZ0xhc3QgPSB0Tm9kZS5kaXJlY3RpdmVTdGFydDtcbiAgfSBlbHNlIHtcbiAgICBkaXJlY3RpdmVTdHlsaW5nTGFzdCsrO1xuICB9XG4gIHdoaWxlIChkaXJlY3RpdmVTdHlsaW5nTGFzdCA8IGRpcmVjdGl2ZUVuZCkge1xuICAgIGN1cnJlbnREaXJlY3RpdmUgPSB0RGF0YVtkaXJlY3RpdmVTdHlsaW5nTGFzdF0gYXMgRGlyZWN0aXZlRGVmPGFueT47XG4gICAgbmdEZXZNb2RlICYmIGFzc2VydERlZmluZWQoY3VycmVudERpcmVjdGl2ZSwgJ2V4cGVjdGVkIHRvIGJlIGRlZmluZWQnKTtcbiAgICBzdHlsaW5nS2V5ID0gY29sbGVjdFN0eWxpbmdGcm9tVEF0dHJzKHN0eWxpbmdLZXksIGN1cnJlbnREaXJlY3RpdmUuaG9zdEF0dHJzLCBpc0NsYXNzQmFzZWQpO1xuICAgIGlmIChjdXJyZW50RGlyZWN0aXZlID09PSBob3N0RGlyZWN0aXZlRGVmKSBicmVhaztcbiAgICBkaXJlY3RpdmVTdHlsaW5nTGFzdCsrO1xuICB9XG4gIGlmIChob3N0RGlyZWN0aXZlRGVmICE9PSBudWxsKSB7XG4gICAgLy8gd2Ugb25seSBhZHZhbmNlIHRoZSBzdHlsaW5nIGN1cnNvciBpZiB3ZSBhcmUgY29sbGVjdGluZyBkYXRhIGZyb20gaG9zdCBiaW5kaW5ncy5cbiAgICAvLyBUZW1wbGF0ZSBleGVjdXRlcyBiZWZvcmUgaG9zdCBiaW5kaW5ncyBhbmQgc28gaWYgd2Ugd291bGQgdXBkYXRlIHRoZSBpbmRleCxcbiAgICAvLyBob3N0IGJpbmRpbmdzIHdvdWxkIG5vdCBnZXQgdGhlaXIgc3RhdGljcy5cbiAgICB0Tm9kZS5kaXJlY3RpdmVTdHlsaW5nTGFzdCA9IGRpcmVjdGl2ZVN0eWxpbmdMYXN0O1xuICB9XG4gIHJldHVybiBzdHlsaW5nS2V5O1xufVxuXG4vKipcbiAqIENvbnZlcnQgYFRBdHRyc2AgaW50byBgVFN0eWxpbmdTdGF0aWNgLlxuICpcbiAqIEBwYXJhbSBzdHlsaW5nS2V5IGV4aXN0aW5nIGBUU3R5bGluZ0tleWAgdG8gdXBkYXRlIG9yIHdyYXAuXG4gKiBAcGFyYW0gYXR0cnMgYFRBdHRyaWJ1dGVzYCB0byBwcm9jZXNzLlxuICogQHBhcmFtIGlzQ2xhc3NCYXNlZCBgdHJ1ZWAgaWYgYGNsYXNzYCAoYGZhbHNlYCBpZiBgc3R5bGVgKVxuICovXG5mdW5jdGlvbiBjb2xsZWN0U3R5bGluZ0Zyb21UQXR0cnMoXG4gIHN0eWxpbmdLZXk6IFRTdHlsaW5nS2V5IHwgdW5kZWZpbmVkLFxuICBhdHRyczogVEF0dHJpYnV0ZXMgfCBudWxsLFxuICBpc0NsYXNzQmFzZWQ6IGJvb2xlYW4sXG4pOiBUU3R5bGluZ0tleSB7XG4gIGNvbnN0IGRlc2lyZWRNYXJrZXIgPSBpc0NsYXNzQmFzZWQgPyBBdHRyaWJ1dGVNYXJrZXIuQ2xhc3NlcyA6IEF0dHJpYnV0ZU1hcmtlci5TdHlsZXM7XG4gIGxldCBjdXJyZW50TWFya2VyID0gQXR0cmlidXRlTWFya2VyLkltcGxpY2l0QXR0cmlidXRlcztcbiAgaWYgKGF0dHJzICE9PSBudWxsKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhdHRycy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaXRlbSA9IGF0dHJzW2ldIGFzIG51bWJlciB8IHN0cmluZztcbiAgICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgY3VycmVudE1hcmtlciA9IGl0ZW07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoY3VycmVudE1hcmtlciA9PT0gZGVzaXJlZE1hcmtlcikge1xuICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShzdHlsaW5nS2V5KSkge1xuICAgICAgICAgICAgc3R5bGluZ0tleSA9IHN0eWxpbmdLZXkgPT09IHVuZGVmaW5lZCA/IFtdIDogKFsnJywgc3R5bGluZ0tleV0gYXMgYW55KTtcbiAgICAgICAgICB9XG4gICAgICAgICAga2V5VmFsdWVBcnJheVNldChcbiAgICAgICAgICAgIHN0eWxpbmdLZXkgYXMgS2V5VmFsdWVBcnJheTxhbnk+LFxuICAgICAgICAgICAgaXRlbSxcbiAgICAgICAgICAgIGlzQ2xhc3NCYXNlZCA/IHRydWUgOiBhdHRyc1srK2ldLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHN0eWxpbmdLZXkgPT09IHVuZGVmaW5lZCA/IG51bGwgOiBzdHlsaW5nS2V5O1xufVxuXG4vKipcbiAqIENvbnZlcnQgdXNlciBpbnB1dCB0byBgS2V5VmFsdWVBcnJheWAuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyB1c2VyIGlucHV0IHdoaWNoIGNvdWxkIGJlIGBzdHJpbmdgLCBPYmplY3QgbGl0ZXJhbCwgb3IgaXRlcmFibGUgYW5kIGNvbnZlcnRzXG4gKiBpdCBpbnRvIGEgY29uc2lzdGVudCByZXByZXNlbnRhdGlvbi4gVGhlIG91dHB1dCBvZiB0aGlzIGlzIGBLZXlWYWx1ZUFycmF5YCAod2hpY2ggaXMgYW4gYXJyYXlcbiAqIHdoZXJlXG4gKiBldmVuIGluZGV4ZXMgY29udGFpbiBrZXlzIGFuZCBvZGQgaW5kZXhlcyBjb250YWluIHZhbHVlcyBmb3IgdGhvc2Uga2V5cykuXG4gKlxuICogVGhlIGFkdmFudGFnZSBvZiBjb252ZXJ0aW5nIHRvIGBLZXlWYWx1ZUFycmF5YCBpcyB0aGF0IHdlIGNhbiBwZXJmb3JtIGRpZmYgaW4gYW4gaW5wdXRcbiAqIGluZGVwZW5kZW50XG4gKiB3YXkuXG4gKiAoaWUgd2UgY2FuIGNvbXBhcmUgYGZvbyBiYXJgIHRvIGBbJ2JhcicsICdiYXonXSBhbmQgZGV0ZXJtaW5lIGEgc2V0IG9mIGNoYW5nZXMgd2hpY2ggbmVlZCB0byBiZVxuICogYXBwbGllZClcbiAqXG4gKiBUaGUgZmFjdCB0aGF0IGBLZXlWYWx1ZUFycmF5YCBpcyBzb3J0ZWQgaXMgdmVyeSBpbXBvcnRhbnQgYmVjYXVzZSBpdCBhbGxvd3MgdXMgdG8gY29tcHV0ZSB0aGVcbiAqIGRpZmZlcmVuY2UgaW4gbGluZWFyIGZhc2hpb24gd2l0aG91dCB0aGUgbmVlZCB0byBhbGxvY2F0ZSBhbnkgYWRkaXRpb25hbCBkYXRhLlxuICpcbiAqIEZvciBleGFtcGxlIGlmIHdlIGtlcHQgdGhpcyBhcyBhIGBNYXBgIHdlIHdvdWxkIGhhdmUgdG8gaXRlcmF0ZSBvdmVyIHByZXZpb3VzIGBNYXBgIHRvIGRldGVybWluZVxuICogd2hpY2ggdmFsdWVzIG5lZWQgdG8gYmUgZGVsZXRlZCwgb3ZlciB0aGUgbmV3IGBNYXBgIHRvIGRldGVybWluZSBhZGRpdGlvbnMsIGFuZCB3ZSB3b3VsZCBoYXZlIHRvXG4gKiBrZWVwIGFkZGl0aW9uYWwgYE1hcGAgdG8ga2VlcCB0cmFjayBvZiBkdXBsaWNhdGVzIG9yIGl0ZW1zIHdoaWNoIGhhdmUgbm90IHlldCBiZWVuIHZpc2l0ZWQuXG4gKlxuICogQHBhcmFtIGtleVZhbHVlQXJyYXlTZXQgKFNlZSBga2V5VmFsdWVBcnJheVNldGAgaW4gXCJ1dGlsL2FycmF5X3V0aWxzXCIpIEdldHMgcGFzc2VkIGluIGFzIGFcbiAqICAgICAgICBmdW5jdGlvbiBzbyB0aGF0IGBzdHlsZWAgY2FuIGJlIHByb2Nlc3NlZC4gVGhpcyBpcyBkb25lXG4gKiAgICAgICAgZm9yIHRyZWUgc2hha2luZyBwdXJwb3Nlcy5cbiAqIEBwYXJhbSBzdHJpbmdQYXJzZXIgVGhlIHBhcnNlciBpcyBwYXNzZWQgaW4gc28gdGhhdCBpdCB3aWxsIGJlIHRyZWUgc2hha2FibGUuIFNlZVxuICogICAgICAgIGBzdHlsZVN0cmluZ1BhcnNlcmAgYW5kIGBjbGFzc1N0cmluZ1BhcnNlcmBcbiAqIEBwYXJhbSB2YWx1ZSBUaGUgdmFsdWUgdG8gcGFyc2UvY29udmVydCB0byBgS2V5VmFsdWVBcnJheWBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvU3R5bGluZ0tleVZhbHVlQXJyYXkoXG4gIGtleVZhbHVlQXJyYXlTZXQ6IChrZXlWYWx1ZUFycmF5OiBLZXlWYWx1ZUFycmF5PGFueT4sIGtleTogc3RyaW5nLCB2YWx1ZTogYW55KSA9PiB2b2lkLFxuICBzdHJpbmdQYXJzZXI6IChzdHlsZUtleVZhbHVlQXJyYXk6IEtleVZhbHVlQXJyYXk8YW55PiwgdGV4dDogc3RyaW5nKSA9PiB2b2lkLFxuICB2YWx1ZTogc3RyaW5nIHwgc3RyaW5nW10gfCB7W2tleTogc3RyaW5nXTogYW55fSB8IFNhZmVWYWx1ZSB8IG51bGwgfCB1bmRlZmluZWQsXG4pOiBLZXlWYWx1ZUFycmF5PGFueT4ge1xuICBpZiAodmFsdWUgPT0gbnVsbCAvKnx8IHZhbHVlID09PSB1bmRlZmluZWQgKi8gfHwgdmFsdWUgPT09ICcnKSByZXR1cm4gRU1QVFlfQVJSQVkgYXMgYW55O1xuICBjb25zdCBzdHlsZUtleVZhbHVlQXJyYXk6IEtleVZhbHVlQXJyYXk8YW55PiA9IFtdIGFzIGFueTtcbiAgY29uc3QgdW53cmFwcGVkVmFsdWUgPSB1bndyYXBTYWZlVmFsdWUodmFsdWUpIGFzIHN0cmluZyB8IHN0cmluZ1tdIHwge1trZXk6IHN0cmluZ106IGFueX07XG4gIGlmIChBcnJheS5pc0FycmF5KHVud3JhcHBlZFZhbHVlKSkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdW53cmFwcGVkVmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgIGtleVZhbHVlQXJyYXlTZXQoc3R5bGVLZXlWYWx1ZUFycmF5LCB1bndyYXBwZWRWYWx1ZVtpXSwgdHJ1ZSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGVvZiB1bndyYXBwZWRWYWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICBmb3IgKGNvbnN0IGtleSBpbiB1bndyYXBwZWRWYWx1ZSkge1xuICAgICAgaWYgKHVud3JhcHBlZFZhbHVlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAga2V5VmFsdWVBcnJheVNldChzdHlsZUtleVZhbHVlQXJyYXksIGtleSwgdW53cmFwcGVkVmFsdWVba2V5XSk7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGVvZiB1bndyYXBwZWRWYWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICBzdHJpbmdQYXJzZXIoc3R5bGVLZXlWYWx1ZUFycmF5LCB1bndyYXBwZWRWYWx1ZSk7XG4gIH0gZWxzZSB7XG4gICAgbmdEZXZNb2RlICYmXG4gICAgICB0aHJvd0Vycm9yKCdVbnN1cHBvcnRlZCBzdHlsaW5nIHR5cGUgJyArIHR5cGVvZiB1bndyYXBwZWRWYWx1ZSArICc6ICcgKyB1bndyYXBwZWRWYWx1ZSk7XG4gIH1cbiAgcmV0dXJuIHN0eWxlS2V5VmFsdWVBcnJheTtcbn1cblxuLyoqXG4gKiBTZXQgYSBgdmFsdWVgIGZvciBhIGBrZXlgLlxuICpcbiAqIFNlZTogYGtleVZhbHVlQXJyYXlTZXRgIGZvciBkZXRhaWxzXG4gKlxuICogQHBhcmFtIGtleVZhbHVlQXJyYXkgS2V5VmFsdWVBcnJheSB0byBhZGQgdG8uXG4gKiBAcGFyYW0ga2V5IFN0eWxlIGtleSB0byBhZGQuXG4gKiBAcGFyYW0gdmFsdWUgVGhlIHZhbHVlIHRvIHNldC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN0eWxlS2V5VmFsdWVBcnJheVNldChrZXlWYWx1ZUFycmF5OiBLZXlWYWx1ZUFycmF5PGFueT4sIGtleTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gIGtleVZhbHVlQXJyYXlTZXQoa2V5VmFsdWVBcnJheSwga2V5LCB1bndyYXBTYWZlVmFsdWUodmFsdWUpKTtcbn1cblxuLyoqXG4gKiBDbGFzcy1iaW5kaW5nLXNwZWNpZmljIGZ1bmN0aW9uIGZvciBzZXR0aW5nIHRoZSBgdmFsdWVgIGZvciBhIGBrZXlgLlxuICpcbiAqIFNlZTogYGtleVZhbHVlQXJyYXlTZXRgIGZvciBkZXRhaWxzXG4gKlxuICogQHBhcmFtIGtleVZhbHVlQXJyYXkgS2V5VmFsdWVBcnJheSB0byBhZGQgdG8uXG4gKiBAcGFyYW0ga2V5IFN0eWxlIGtleSB0byBhZGQuXG4gKiBAcGFyYW0gdmFsdWUgVGhlIHZhbHVlIHRvIHNldC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsYXNzS2V5VmFsdWVBcnJheVNldChrZXlWYWx1ZUFycmF5OiBLZXlWYWx1ZUFycmF5PGFueT4sIGtleTogdW5rbm93biwgdmFsdWU6IGFueSkge1xuICAvLyBXZSB1c2UgYGNsYXNzTGlzdC5hZGRgIHRvIGV2ZW50dWFsbHkgYWRkIHRoZSBDU1MgY2xhc3NlcyB0byB0aGUgRE9NIG5vZGUuIEFueSB2YWx1ZSBwYXNzZWQgaW50b1xuICAvLyBgYWRkYCBpcyBzdHJpbmdpZmllZCBhbmQgYWRkZWQgdG8gdGhlIGBjbGFzc2AgYXR0cmlidXRlLCBlLmcuIGV2ZW4gbnVsbCwgdW5kZWZpbmVkIG9yIG51bWJlcnNcbiAgLy8gd2lsbCBiZSBhZGRlZC4gU3RyaW5naWZ5IHRoZSBrZXkgaGVyZSBzbyB0aGF0IG91ciBpbnRlcm5hbCBkYXRhIHN0cnVjdHVyZSBtYXRjaGVzIHRoZSB2YWx1ZSBpblxuICAvLyB0aGUgRE9NLiBUaGUgb25seSBleGNlcHRpb25zIGFyZSBlbXB0eSBzdHJpbmdzIGFuZCBzdHJpbmdzIHRoYXQgY29udGFpbiBzcGFjZXMgZm9yIHdoaWNoXG4gIC8vIHRoZSBicm93c2VyIHRocm93cyBhbiBlcnJvci4gV2UgaWdub3JlIHN1Y2ggdmFsdWVzLCBiZWNhdXNlIHRoZSBlcnJvciBpcyBzb21ld2hhdCBjcnlwdGljLlxuICBjb25zdCBzdHJpbmdLZXkgPSBTdHJpbmcoa2V5KTtcbiAgaWYgKHN0cmluZ0tleSAhPT0gJycgJiYgIXN0cmluZ0tleS5pbmNsdWRlcygnICcpKSB7XG4gICAga2V5VmFsdWVBcnJheVNldChrZXlWYWx1ZUFycmF5LCBzdHJpbmdLZXksIHZhbHVlKTtcbiAgfVxufVxuXG4vKipcbiAqIFVwZGF0ZSBtYXAgYmFzZWQgc3R5bGluZy5cbiAqXG4gKiBNYXAgYmFzZWQgc3R5bGluZyBjb3VsZCBiZSBhbnl0aGluZyB3aGljaCBjb250YWlucyBtb3JlIHRoYW4gb25lIGJpbmRpbmcuIEZvciBleGFtcGxlIGBzdHJpbmdgLFxuICogb3Igb2JqZWN0IGxpdGVyYWwuIERlYWxpbmcgd2l0aCBhbGwgb2YgdGhlc2UgdHlwZXMgd291bGQgY29tcGxpY2F0ZSB0aGUgbG9naWMgc29cbiAqIGluc3RlYWQgdGhpcyBmdW5jdGlvbiBleHBlY3RzIHRoYXQgdGhlIGNvbXBsZXggaW5wdXQgaXMgZmlyc3QgY29udmVydGVkIGludG8gbm9ybWFsaXplZFxuICogYEtleVZhbHVlQXJyYXlgLiBUaGUgYWR2YW50YWdlIG9mIG5vcm1hbGl6YXRpb24gaXMgdGhhdCB3ZSBnZXQgdGhlIHZhbHVlcyBzb3J0ZWQsIHdoaWNoIG1ha2VzIGl0XG4gKiB2ZXJ5IGNoZWFwIHRvIGNvbXB1dGUgZGVsdGFzIGJldHdlZW4gdGhlIHByZXZpb3VzIGFuZCBjdXJyZW50IHZhbHVlLlxuICpcbiAqIEBwYXJhbSB0VmlldyBBc3NvY2lhdGVkIGBUVmlldy5kYXRhYCBjb250YWlucyB0aGUgbGlua2VkIGxpc3Qgb2YgYmluZGluZyBwcmlvcml0aWVzLlxuICogQHBhcmFtIHROb2RlIGBUTm9kZWAgd2hlcmUgdGhlIGJpbmRpbmcgaXMgbG9jYXRlZC5cbiAqIEBwYXJhbSBsVmlldyBgTFZpZXdgIGNvbnRhaW5zIHRoZSB2YWx1ZXMgYXNzb2NpYXRlZCB3aXRoIG90aGVyIHN0eWxpbmcgYmluZGluZyBhdCB0aGlzIGBUTm9kZWAuXG4gKiBAcGFyYW0gcmVuZGVyZXIgUmVuZGVyZXIgdG8gdXNlIGlmIGFueSB1cGRhdGVzLlxuICogQHBhcmFtIG9sZEtleVZhbHVlQXJyYXkgUHJldmlvdXMgdmFsdWUgcmVwcmVzZW50ZWQgYXMgYEtleVZhbHVlQXJyYXlgXG4gKiBAcGFyYW0gbmV3S2V5VmFsdWVBcnJheSBDdXJyZW50IHZhbHVlIHJlcHJlc2VudGVkIGFzIGBLZXlWYWx1ZUFycmF5YFxuICogQHBhcmFtIGlzQ2xhc3NCYXNlZCBgdHJ1ZWAgaWYgYGNsYXNzYCAoYGZhbHNlYCBpZiBgc3R5bGVgKVxuICogQHBhcmFtIGJpbmRpbmdJbmRleCBCaW5kaW5nIGluZGV4IG9mIHRoZSBiaW5kaW5nLlxuICovXG5mdW5jdGlvbiB1cGRhdGVTdHlsaW5nTWFwKFxuICB0VmlldzogVFZpZXcsXG4gIHROb2RlOiBUTm9kZSxcbiAgbFZpZXc6IExWaWV3LFxuICByZW5kZXJlcjogUmVuZGVyZXIsXG4gIG9sZEtleVZhbHVlQXJyYXk6IEtleVZhbHVlQXJyYXk8YW55PixcbiAgbmV3S2V5VmFsdWVBcnJheTogS2V5VmFsdWVBcnJheTxhbnk+LFxuICBpc0NsYXNzQmFzZWQ6IGJvb2xlYW4sXG4gIGJpbmRpbmdJbmRleDogbnVtYmVyLFxuKSB7XG4gIGlmICgob2xkS2V5VmFsdWVBcnJheSBhcyBLZXlWYWx1ZUFycmF5PGFueT4gfCBOT19DSEFOR0UpID09PSBOT19DSEFOR0UpIHtcbiAgICAvLyBPbiBmaXJzdCBleGVjdXRpb24gdGhlIG9sZEtleVZhbHVlQXJyYXkgaXMgTk9fQ0hBTkdFID0+IHRyZWF0IGl0IGFzIGVtcHR5IEtleVZhbHVlQXJyYXkuXG4gICAgb2xkS2V5VmFsdWVBcnJheSA9IEVNUFRZX0FSUkFZIGFzIGFueTtcbiAgfVxuICBsZXQgb2xkSW5kZXggPSAwO1xuICBsZXQgbmV3SW5kZXggPSAwO1xuICBsZXQgb2xkS2V5OiBzdHJpbmcgfCBudWxsID0gMCA8IG9sZEtleVZhbHVlQXJyYXkubGVuZ3RoID8gb2xkS2V5VmFsdWVBcnJheVswXSA6IG51bGw7XG4gIGxldCBuZXdLZXk6IHN0cmluZyB8IG51bGwgPSAwIDwgbmV3S2V5VmFsdWVBcnJheS5sZW5ndGggPyBuZXdLZXlWYWx1ZUFycmF5WzBdIDogbnVsbDtcbiAgd2hpbGUgKG9sZEtleSAhPT0gbnVsbCB8fCBuZXdLZXkgIT09IG51bGwpIHtcbiAgICBuZ0Rldk1vZGUgJiYgYXNzZXJ0TGVzc1RoYW4ob2xkSW5kZXgsIDk5OSwgJ0FyZSB3ZSBzdHVjayBpbiBpbmZpbml0ZSBsb29wPycpO1xuICAgIG5nRGV2TW9kZSAmJiBhc3NlcnRMZXNzVGhhbihuZXdJbmRleCwgOTk5LCAnQXJlIHdlIHN0dWNrIGluIGluZmluaXRlIGxvb3A/Jyk7XG4gICAgY29uc3Qgb2xkVmFsdWUgPVxuICAgICAgb2xkSW5kZXggPCBvbGRLZXlWYWx1ZUFycmF5Lmxlbmd0aCA/IG9sZEtleVZhbHVlQXJyYXlbb2xkSW5kZXggKyAxXSA6IHVuZGVmaW5lZDtcbiAgICBjb25zdCBuZXdWYWx1ZSA9XG4gICAgICBuZXdJbmRleCA8IG5ld0tleVZhbHVlQXJyYXkubGVuZ3RoID8gbmV3S2V5VmFsdWVBcnJheVtuZXdJbmRleCArIDFdIDogdW5kZWZpbmVkO1xuICAgIGxldCBzZXRLZXk6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgIGxldCBzZXRWYWx1ZTogYW55ID0gdW5kZWZpbmVkO1xuICAgIGlmIChvbGRLZXkgPT09IG5ld0tleSkge1xuICAgICAgLy8gVVBEQVRFOiBLZXlzIGFyZSBlcXVhbCA9PiBuZXcgdmFsdWUgaXMgb3ZlcndyaXRpbmcgb2xkIHZhbHVlLlxuICAgICAgb2xkSW5kZXggKz0gMjtcbiAgICAgIG5ld0luZGV4ICs9IDI7XG4gICAgICBpZiAob2xkVmFsdWUgIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgIHNldEtleSA9IG5ld0tleTtcbiAgICAgICAgc2V0VmFsdWUgPSBuZXdWYWx1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG5ld0tleSA9PT0gbnVsbCB8fCAob2xkS2V5ICE9PSBudWxsICYmIG9sZEtleSA8IG5ld0tleSEpKSB7XG4gICAgICAvLyBERUxFVEU6IG9sZEtleSBrZXkgaXMgbWlzc2luZyBvciB3ZSBkaWQgbm90IGZpbmQgdGhlIG9sZEtleSBpbiB0aGUgbmV3VmFsdWVcbiAgICAgIC8vIChiZWNhdXNlIHRoZSBrZXlWYWx1ZUFycmF5IGlzIHNvcnRlZCBhbmQgYG5ld0tleWAgaXMgZm91bmQgbGF0ZXIgYWxwaGFiZXRpY2FsbHkpLlxuICAgICAgLy8gYFwiYmFja2dyb3VuZFwiIDwgXCJjb2xvclwiYCBzbyB3ZSBuZWVkIHRvIGRlbGV0ZSBgXCJiYWNrZ3JvdW5kXCJgIGJlY2F1c2UgaXQgaXMgbm90IGZvdW5kIGluIHRoZVxuICAgICAgLy8gbmV3IGFycmF5LlxuICAgICAgb2xkSW5kZXggKz0gMjtcbiAgICAgIHNldEtleSA9IG9sZEtleTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQ1JFQVRFOiBuZXdLZXkncyBpcyBlYXJsaWVyIGFscGhhYmV0aWNhbGx5IHRoYW4gb2xkS2V5J3MgKG9yIG5vIG9sZEtleSkgPT4gd2UgaGF2ZSBuZXcga2V5LlxuICAgICAgLy8gYFwiY29sb3JcIiA+IFwiYmFja2dyb3VuZFwiYCBzbyB3ZSBuZWVkIHRvIGFkZCBgY29sb3JgIGJlY2F1c2UgaXQgaXMgaW4gbmV3IGFycmF5IGJ1dCBub3QgaW5cbiAgICAgIC8vIG9sZCBhcnJheS5cbiAgICAgIG5nRGV2TW9kZSAmJiBhc3NlcnREZWZpbmVkKG5ld0tleSwgJ0V4cGVjdGluZyB0byBoYXZlIGEgdmFsaWQga2V5Jyk7XG4gICAgICBuZXdJbmRleCArPSAyO1xuICAgICAgc2V0S2V5ID0gbmV3S2V5O1xuICAgICAgc2V0VmFsdWUgPSBuZXdWYWx1ZTtcbiAgICB9XG4gICAgaWYgKHNldEtleSAhPT0gbnVsbCkge1xuICAgICAgdXBkYXRlU3R5bGluZyh0VmlldywgdE5vZGUsIGxWaWV3LCByZW5kZXJlciwgc2V0S2V5LCBzZXRWYWx1ZSwgaXNDbGFzc0Jhc2VkLCBiaW5kaW5nSW5kZXgpO1xuICAgIH1cbiAgICBvbGRLZXkgPSBvbGRJbmRleCA8IG9sZEtleVZhbHVlQXJyYXkubGVuZ3RoID8gb2xkS2V5VmFsdWVBcnJheVtvbGRJbmRleF0gOiBudWxsO1xuICAgIG5ld0tleSA9IG5ld0luZGV4IDwgbmV3S2V5VmFsdWVBcnJheS5sZW5ndGggPyBuZXdLZXlWYWx1ZUFycmF5W25ld0luZGV4XSA6IG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBVcGRhdGUgYSBzaW1wbGUgKHByb3BlcnR5IG5hbWUpIHN0eWxpbmcuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBgcHJvcGAgYW5kIHVwZGF0ZXMgdGhlIERPTSB0byB0aGF0IHZhbHVlLiBUaGUgZnVuY3Rpb24gdGFrZXMgdGhlIGJpbmRpbmdcbiAqIHZhbHVlIGFzIHdlbGwgYXMgYmluZGluZyBwcmlvcml0eSBpbnRvIGNvbnNpZGVyYXRpb24gdG8gZGV0ZXJtaW5lIHdoaWNoIHZhbHVlIHNob3VsZCBiZSB3cml0dGVuXG4gKiB0byBET00uIChGb3IgZXhhbXBsZSBpdCBtYXkgYmUgZGV0ZXJtaW5lZCB0aGF0IHRoZXJlIGlzIGEgaGlnaGVyIHByaW9yaXR5IG92ZXJ3cml0ZSB3aGljaCBibG9ja3NcbiAqIHRoZSBET00gd3JpdGUsIG9yIGlmIHRoZSB2YWx1ZSBnb2VzIHRvIGB1bmRlZmluZWRgIGEgbG93ZXIgcHJpb3JpdHkgb3ZlcndyaXRlIG1heSBiZSBjb25zdWx0ZWQuKVxuICpcbiAqIEBwYXJhbSB0VmlldyBBc3NvY2lhdGVkIGBUVmlldy5kYXRhYCBjb250YWlucyB0aGUgbGlua2VkIGxpc3Qgb2YgYmluZGluZyBwcmlvcml0aWVzLlxuICogQHBhcmFtIHROb2RlIGBUTm9kZWAgd2hlcmUgdGhlIGJpbmRpbmcgaXMgbG9jYXRlZC5cbiAqIEBwYXJhbSBsVmlldyBgTFZpZXdgIGNvbnRhaW5zIHRoZSB2YWx1ZXMgYXNzb2NpYXRlZCB3aXRoIG90aGVyIHN0eWxpbmcgYmluZGluZyBhdCB0aGlzIGBUTm9kZWAuXG4gKiBAcGFyYW0gcmVuZGVyZXIgUmVuZGVyZXIgdG8gdXNlIGlmIGFueSB1cGRhdGVzLlxuICogQHBhcmFtIHByb3AgRWl0aGVyIHN0eWxlIHByb3BlcnR5IG5hbWUgb3IgYSBjbGFzcyBuYW1lLlxuICogQHBhcmFtIHZhbHVlIEVpdGhlciBzdHlsZSB2YWx1ZSBmb3IgYHByb3BgIG9yIGB0cnVlYC9gZmFsc2VgIGlmIGBwcm9wYCBpcyBjbGFzcy5cbiAqIEBwYXJhbSBpc0NsYXNzQmFzZWQgYHRydWVgIGlmIGBjbGFzc2AgKGBmYWxzZWAgaWYgYHN0eWxlYClcbiAqIEBwYXJhbSBiaW5kaW5nSW5kZXggQmluZGluZyBpbmRleCBvZiB0aGUgYmluZGluZy5cbiAqL1xuZnVuY3Rpb24gdXBkYXRlU3R5bGluZyhcbiAgdFZpZXc6IFRWaWV3LFxuICB0Tm9kZTogVE5vZGUsXG4gIGxWaWV3OiBMVmlldyxcbiAgcmVuZGVyZXI6IFJlbmRlcmVyLFxuICBwcm9wOiBzdHJpbmcsXG4gIHZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQgfCBudWxsIHwgYm9vbGVhbixcbiAgaXNDbGFzc0Jhc2VkOiBib29sZWFuLFxuICBiaW5kaW5nSW5kZXg6IG51bWJlcixcbikge1xuICBpZiAoISh0Tm9kZS50eXBlICYgVE5vZGVUeXBlLkFueVJOb2RlKSkge1xuICAgIC8vIEl0IGlzIHBvc3NpYmxlIHRvIGhhdmUgc3R5bGluZyBvbiBub24tZWxlbWVudHMgKHN1Y2ggYXMgbmctY29udGFpbmVyKS5cbiAgICAvLyBUaGlzIGlzIHJhcmUsIGJ1dCBpdCBkb2VzIGhhcHBlbi4gSW4gc3VjaCBhIGNhc2UsIGp1c3QgaWdub3JlIHRoZSBiaW5kaW5nLlxuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCB0RGF0YSA9IHRWaWV3LmRhdGE7XG4gIGNvbnN0IHRSYW5nZSA9IHREYXRhW2JpbmRpbmdJbmRleCArIDFdIGFzIFRTdHlsaW5nUmFuZ2U7XG4gIGNvbnN0IGhpZ2hlclByaW9yaXR5VmFsdWUgPSBnZXRUU3R5bGluZ1JhbmdlTmV4dER1cGxpY2F0ZSh0UmFuZ2UpXG4gICAgPyBmaW5kU3R5bGluZ1ZhbHVlKHREYXRhLCB0Tm9kZSwgbFZpZXcsIHByb3AsIGdldFRTdHlsaW5nUmFuZ2VOZXh0KHRSYW5nZSksIGlzQ2xhc3NCYXNlZClcbiAgICA6IHVuZGVmaW5lZDtcbiAgaWYgKCFpc1N0eWxpbmdWYWx1ZVByZXNlbnQoaGlnaGVyUHJpb3JpdHlWYWx1ZSkpIHtcbiAgICAvLyBXZSBkb24ndCBoYXZlIGEgbmV4dCBkdXBsaWNhdGUsIG9yIHdlIGRpZCBub3QgZmluZCBhIGR1cGxpY2F0ZSB2YWx1ZS5cbiAgICBpZiAoIWlzU3R5bGluZ1ZhbHVlUHJlc2VudCh2YWx1ZSkpIHtcbiAgICAgIC8vIFdlIHNob3VsZCBkZWxldGUgY3VycmVudCB2YWx1ZSBvciByZXN0b3JlIHRvIGxvd2VyIHByaW9yaXR5IHZhbHVlLlxuICAgICAgaWYgKGdldFRTdHlsaW5nUmFuZ2VQcmV2RHVwbGljYXRlKHRSYW5nZSkpIHtcbiAgICAgICAgLy8gV2UgaGF2ZSBhIHBvc3NpYmxlIHByZXYgZHVwbGljYXRlLCBsZXQncyByZXRyaWV2ZSBpdC5cbiAgICAgICAgdmFsdWUgPSBmaW5kU3R5bGluZ1ZhbHVlKHREYXRhLCBudWxsLCBsVmlldywgcHJvcCwgYmluZGluZ0luZGV4LCBpc0NsYXNzQmFzZWQpO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCByTm9kZSA9IGdldE5hdGl2ZUJ5SW5kZXgoZ2V0U2VsZWN0ZWRJbmRleCgpLCBsVmlldykgYXMgUkVsZW1lbnQ7XG4gICAgYXBwbHlTdHlsaW5nKHJlbmRlcmVyLCBpc0NsYXNzQmFzZWQsIHJOb2RlLCBwcm9wLCB2YWx1ZSk7XG4gIH1cbn1cblxuLyoqXG4gKiBTZWFyY2ggZm9yIHN0eWxpbmcgdmFsdWUgd2l0aCBoaWdoZXIgcHJpb3JpdHkgd2hpY2ggaXMgb3ZlcndyaXRpbmcgY3VycmVudCB2YWx1ZSwgb3IgYVxuICogdmFsdWUgb2YgbG93ZXIgcHJpb3JpdHkgdG8gd2hpY2ggd2Ugc2hvdWxkIGZhbGwgYmFjayBpZiB0aGUgdmFsdWUgaXMgYHVuZGVmaW5lZGAuXG4gKlxuICogV2hlbiB2YWx1ZSBpcyBiZWluZyBhcHBsaWVkIGF0IGEgbG9jYXRpb24sIHJlbGF0ZWQgdmFsdWVzIG5lZWQgdG8gYmUgY29uc3VsdGVkLlxuICogLSBJZiB0aGVyZSBpcyBhIGhpZ2hlciBwcmlvcml0eSBiaW5kaW5nLCB3ZSBzaG91bGQgYmUgdXNpbmcgdGhhdCBvbmUgaW5zdGVhZC5cbiAqICAgRm9yIGV4YW1wbGUgYDxkaXYgIFtzdHlsZV09XCJ7Y29sb3I6ZXhwMX1cIiBbc3R5bGUuY29sb3JdPVwiZXhwMlwiPmAgY2hhbmdlIHRvIGBleHAxYFxuICogICByZXF1aXJlcyB0aGF0IHdlIGNoZWNrIGBleHAyYCB0byBzZWUgaWYgaXQgaXMgc2V0IHRvIHZhbHVlIG90aGVyIHRoYW4gYHVuZGVmaW5lZGAuXG4gKiAtIElmIHRoZXJlIGlzIGEgbG93ZXIgcHJpb3JpdHkgYmluZGluZyBhbmQgd2UgYXJlIGNoYW5naW5nIHRvIGB1bmRlZmluZWRgXG4gKiAgIEZvciBleGFtcGxlIGA8ZGl2ICBbc3R5bGVdPVwie2NvbG9yOmV4cDF9XCIgW3N0eWxlLmNvbG9yXT1cImV4cDJcIj5gIGNoYW5nZSB0byBgZXhwMmAgdG9cbiAqICAgYHVuZGVmaW5lZGAgcmVxdWlyZXMgdGhhdCB3ZSBjaGVjayBgZXhwMWAgKGFuZCBzdGF0aWMgdmFsdWVzKSBhbmQgdXNlIHRoYXQgYXMgbmV3IHZhbHVlLlxuICpcbiAqIE5PVEU6IFRoZSBzdHlsaW5nIHN0b3JlcyB0d28gdmFsdWVzLlxuICogMS4gVGhlIHJhdyB2YWx1ZSB3aGljaCBjYW1lIGZyb20gdGhlIGFwcGxpY2F0aW9uIGlzIHN0b3JlZCBhdCBgaW5kZXggKyAwYCBsb2NhdGlvbi4gKFRoaXMgdmFsdWVcbiAqICAgIGlzIHVzZWQgZm9yIGRpcnR5IGNoZWNraW5nKS5cbiAqIDIuIFRoZSBub3JtYWxpemVkIHZhbHVlIGlzIHN0b3JlZCBhdCBgaW5kZXggKyAxYC5cbiAqXG4gKiBAcGFyYW0gdERhdGEgYFREYXRhYCB1c2VkIGZvciB0cmF2ZXJzaW5nIHRoZSBwcmlvcml0eS5cbiAqIEBwYXJhbSB0Tm9kZSBgVE5vZGVgIHRvIHVzZSBmb3IgcmVzb2x2aW5nIHN0YXRpYyBzdHlsaW5nLiBBbHNvIGNvbnRyb2xzIHNlYXJjaCBkaXJlY3Rpb24uXG4gKiAgIC0gYFROb2RlYCBzZWFyY2ggbmV4dCBhbmQgcXVpdCBhcyBzb29uIGFzIGBpc1N0eWxpbmdWYWx1ZVByZXNlbnQodmFsdWUpYCBpcyB0cnVlLlxuICogICAgICBJZiBubyB2YWx1ZSBmb3VuZCBjb25zdWx0IGB0Tm9kZS5yZXNpZHVhbFN0eWxlYC9gdE5vZGUucmVzaWR1YWxDbGFzc2AgZm9yIGRlZmF1bHQgdmFsdWUuXG4gKiAgIC0gYG51bGxgIHNlYXJjaCBwcmV2IGFuZCBnbyBhbGwgdGhlIHdheSB0byBlbmQuIFJldHVybiBsYXN0IHZhbHVlIHdoZXJlXG4gKiAgICAgYGlzU3R5bGluZ1ZhbHVlUHJlc2VudCh2YWx1ZSlgIGlzIHRydWUuXG4gKiBAcGFyYW0gbFZpZXcgYExWaWV3YCB1c2VkIGZvciByZXRyaWV2aW5nIHRoZSBhY3R1YWwgdmFsdWVzLlxuICogQHBhcmFtIHByb3AgUHJvcGVydHkgd2hpY2ggd2UgYXJlIGludGVyZXN0ZWQgaW4uXG4gKiBAcGFyYW0gaW5kZXggU3RhcnRpbmcgaW5kZXggaW4gdGhlIGxpbmtlZCBsaXN0IG9mIHN0eWxpbmcgYmluZGluZ3Mgd2hlcmUgdGhlIHNlYXJjaCBzaG91bGQgc3RhcnQuXG4gKiBAcGFyYW0gaXNDbGFzc0Jhc2VkIGB0cnVlYCBpZiBgY2xhc3NgIChgZmFsc2VgIGlmIGBzdHlsZWApXG4gKi9cbmZ1bmN0aW9uIGZpbmRTdHlsaW5nVmFsdWUoXG4gIHREYXRhOiBURGF0YSxcbiAgdE5vZGU6IFROb2RlIHwgbnVsbCxcbiAgbFZpZXc6IExWaWV3LFxuICBwcm9wOiBzdHJpbmcsXG4gIGluZGV4OiBudW1iZXIsXG4gIGlzQ2xhc3NCYXNlZDogYm9vbGVhbixcbik6IGFueSB7XG4gIC8vIGBUTm9kZWAgdG8gdXNlIGZvciByZXNvbHZpbmcgc3RhdGljIHN0eWxpbmcuIEFsc28gY29udHJvbHMgc2VhcmNoIGRpcmVjdGlvbi5cbiAgLy8gICAtIGBUTm9kZWAgc2VhcmNoIG5leHQgYW5kIHF1aXQgYXMgc29vbiBhcyBgaXNTdHlsaW5nVmFsdWVQcmVzZW50KHZhbHVlKWAgaXMgdHJ1ZS5cbiAgLy8gICAgICBJZiBubyB2YWx1ZSBmb3VuZCBjb25zdWx0IGB0Tm9kZS5yZXNpZHVhbFN0eWxlYC9gdE5vZGUucmVzaWR1YWxDbGFzc2AgZm9yIGRlZmF1bHQgdmFsdWUuXG4gIC8vICAgLSBgbnVsbGAgc2VhcmNoIHByZXYgYW5kIGdvIGFsbCB0aGUgd2F5IHRvIGVuZC4gUmV0dXJuIGxhc3QgdmFsdWUgd2hlcmVcbiAgLy8gICAgIGBpc1N0eWxpbmdWYWx1ZVByZXNlbnQodmFsdWUpYCBpcyB0cnVlLlxuICBjb25zdCBpc1ByZXZEaXJlY3Rpb24gPSB0Tm9kZSA9PT0gbnVsbDtcbiAgbGV0IHZhbHVlOiBhbnkgPSB1bmRlZmluZWQ7XG4gIHdoaWxlIChpbmRleCA+IDApIHtcbiAgICBjb25zdCByYXdLZXkgPSB0RGF0YVtpbmRleF0gYXMgVFN0eWxpbmdLZXk7XG4gICAgY29uc3QgY29udGFpbnNTdGF0aWNzID0gQXJyYXkuaXNBcnJheShyYXdLZXkpO1xuICAgIC8vIFVud3JhcCB0aGUga2V5IGlmIHdlIGNvbnRhaW4gc3RhdGljIHZhbHVlcy5cbiAgICBjb25zdCBrZXkgPSBjb250YWluc1N0YXRpY3MgPyAocmF3S2V5IGFzIHN0cmluZ1tdKVsxXSA6IHJhd0tleTtcbiAgICBjb25zdCBpc1N0eWxpbmdNYXAgPSBrZXkgPT09IG51bGw7XG4gICAgbGV0IHZhbHVlQXRMVmlld0luZGV4ID0gbFZpZXdbaW5kZXggKyAxXTtcbiAgICBpZiAodmFsdWVBdExWaWV3SW5kZXggPT09IE5PX0NIQU5HRSkge1xuICAgICAgLy8gSW4gZmlyc3RVcGRhdGVQYXNzIHRoZSBzdHlsaW5nIGluc3RydWN0aW9ucyBjcmVhdGUgYSBsaW5rZWQgbGlzdCBvZiBzdHlsaW5nLlxuICAgICAgLy8gT24gc3Vic2VxdWVudCBwYXNzZXMgaXQgaXMgcG9zc2libGUgZm9yIGEgc3R5bGluZyBpbnN0cnVjdGlvbiB0byB0cnkgdG8gcmVhZCBhIGJpbmRpbmdcbiAgICAgIC8vIHdoaWNoXG4gICAgICAvLyBoYXMgbm90IHlldCBleGVjdXRlZC4gSW4gdGhhdCBjYXNlIHdlIHdpbGwgZmluZCBgTk9fQ0hBTkdFYCBhbmQgd2Ugc2hvdWxkIGFzc3VtZSB0aGF0XG4gICAgICAvLyB3ZSBoYXZlIGB1bmRlZmluZWRgIChvciBlbXB0eSBhcnJheSBpbiBjYXNlIG9mIHN0eWxpbmctbWFwIGluc3RydWN0aW9uKSBpbnN0ZWFkLiBUaGlzXG4gICAgICAvLyBhbGxvd3MgdGhlIHJlc29sdXRpb24gdG8gYXBwbHkgdGhlIHZhbHVlICh3aGljaCBtYXkgbGF0ZXIgYmUgb3ZlcndyaXR0ZW4gd2hlbiB0aGVcbiAgICAgIC8vIGJpbmRpbmcgYWN0dWFsbHkgZXhlY3V0ZXMuKVxuICAgICAgdmFsdWVBdExWaWV3SW5kZXggPSBpc1N0eWxpbmdNYXAgPyBFTVBUWV9BUlJBWSA6IHVuZGVmaW5lZDtcbiAgICB9XG4gICAgbGV0IGN1cnJlbnRWYWx1ZSA9IGlzU3R5bGluZ01hcFxuICAgICAgPyBrZXlWYWx1ZUFycmF5R2V0KHZhbHVlQXRMVmlld0luZGV4LCBwcm9wKVxuICAgICAgOiBrZXkgPT09IHByb3BcbiAgICAgICAgPyB2YWx1ZUF0TFZpZXdJbmRleFxuICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICBpZiAoY29udGFpbnNTdGF0aWNzICYmICFpc1N0eWxpbmdWYWx1ZVByZXNlbnQoY3VycmVudFZhbHVlKSkge1xuICAgICAgY3VycmVudFZhbHVlID0ga2V5VmFsdWVBcnJheUdldChyYXdLZXkgYXMgS2V5VmFsdWVBcnJheTxhbnk+LCBwcm9wKTtcbiAgICB9XG4gICAgaWYgKGlzU3R5bGluZ1ZhbHVlUHJlc2VudChjdXJyZW50VmFsdWUpKSB7XG4gICAgICB2YWx1ZSA9IGN1cnJlbnRWYWx1ZTtcbiAgICAgIGlmIChpc1ByZXZEaXJlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCB0UmFuZ2UgPSB0RGF0YVtpbmRleCArIDFdIGFzIFRTdHlsaW5nUmFuZ2U7XG4gICAgaW5kZXggPSBpc1ByZXZEaXJlY3Rpb24gPyBnZXRUU3R5bGluZ1JhbmdlUHJldih0UmFuZ2UpIDogZ2V0VFN0eWxpbmdSYW5nZU5leHQodFJhbmdlKTtcbiAgfVxuICBpZiAodE5vZGUgIT09IG51bGwpIHtcbiAgICAvLyBpbiBjYXNlIHdoZXJlIHdlIGFyZSBnb2luZyBpbiBuZXh0IGRpcmVjdGlvbiBBTkQgd2UgZGlkIG5vdCBmaW5kIGFueXRoaW5nLCB3ZSBuZWVkIHRvXG4gICAgLy8gY29uc3VsdCByZXNpZHVhbCBzdHlsaW5nXG4gICAgbGV0IHJlc2lkdWFsID0gaXNDbGFzc0Jhc2VkID8gdE5vZGUucmVzaWR1YWxDbGFzc2VzIDogdE5vZGUucmVzaWR1YWxTdHlsZXM7XG4gICAgaWYgKHJlc2lkdWFsICE9IG51bGwgLyoqIE9SIHJlc2lkdWFsICE9PT0gdW5kZWZpbmVkICovKSB7XG4gICAgICB2YWx1ZSA9IGtleVZhbHVlQXJyYXlHZXQocmVzaWR1YWwhLCBwcm9wKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuXG4vKipcbiAqIERldGVybWluZXMgaWYgdGhlIGJpbmRpbmcgdmFsdWUgc2hvdWxkIGJlIHVzZWQgKG9yIGlmIHRoZSB2YWx1ZSBpcyAndW5kZWZpbmVkJyBhbmQgaGVuY2UgcHJpb3JpdHlcbiAqIHJlc29sdXRpb24gc2hvdWxkIGJlIHVzZWQuKVxuICpcbiAqIEBwYXJhbSB2YWx1ZSBCaW5kaW5nIHN0eWxlIHZhbHVlLlxuICovXG5mdW5jdGlvbiBpc1N0eWxpbmdWYWx1ZVByZXNlbnQodmFsdWU6IGFueSk6IGJvb2xlYW4ge1xuICAvLyBDdXJyZW50bHkgb25seSBgdW5kZWZpbmVkYCB2YWx1ZSBpcyBjb25zaWRlcmVkIG5vbi1iaW5kaW5nLiBUaGF0IGlzIGB1bmRlZmluZWRgIHNheXMgSSBkb24ndFxuICAvLyBoYXZlIGFuIG9waW5pb24gYXMgdG8gd2hhdCB0aGlzIGJpbmRpbmcgc2hvdWxkIGJlIGFuZCB5b3Ugc2hvdWxkIGNvbnN1bHQgb3RoZXIgYmluZGluZ3MgYnlcbiAgLy8gcHJpb3JpdHkgdG8gZGV0ZXJtaW5lIHRoZSB2YWxpZCB2YWx1ZS5cbiAgLy8gVGhpcyBpcyBleHRyYWN0ZWQgaW50byBhIHNpbmdsZSBmdW5jdGlvbiBzbyB0aGF0IHdlIGhhdmUgYSBzaW5nbGUgcGxhY2UgdG8gY29udHJvbCB0aGlzLlxuICByZXR1cm4gdmFsdWUgIT09IHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBOb3JtYWxpemVzIGFuZC9vciBhZGRzIGEgc3VmZml4IHRvIHRoZSB2YWx1ZS5cbiAqXG4gKiBJZiB2YWx1ZSBpcyBgbnVsbGAvYHVuZGVmaW5lZGAgbm8gc3VmZml4IGlzIGFkZGVkXG4gKiBAcGFyYW0gdmFsdWVcbiAqIEBwYXJhbSBzdWZmaXhcbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplU3VmZml4KFxuICB2YWx1ZTogYW55LFxuICBzdWZmaXg6IHN0cmluZyB8IHVuZGVmaW5lZCB8IG51bGwsXG4pOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkIHwgYm9vbGVhbiB7XG4gIGlmICh2YWx1ZSA9PSBudWxsIHx8IHZhbHVlID09PSAnJykge1xuICAgIC8vIGRvIG5vdGhpbmdcbiAgICAvLyBEbyBub3QgYWRkIHRoZSBzdWZmaXggaWYgdGhlIHZhbHVlIGlzIGdvaW5nIHRvIGJlIGVtcHR5LlxuICAgIC8vIEFzIGl0IHByb2R1Y2UgaW52YWxpZCBDU1MsIHdoaWNoIHRoZSBicm93c2VycyB3aWxsIGF1dG9tYXRpY2FsbHkgb21pdCBidXQgRG9taW5vIHdpbGwgbm90LlxuICAgIC8vIEV4YW1wbGU6IGBcImxlZnRcIjogXCJweDtcImAgaW5zdGVhZCBvZiBgXCJsZWZ0XCI6IFwiXCJgLlxuICB9IGVsc2UgaWYgKHR5cGVvZiBzdWZmaXggPT09ICdzdHJpbmcnKSB7XG4gICAgdmFsdWUgPSB2YWx1ZSArIHN1ZmZpeDtcbiAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgdmFsdWUgPSBzdHJpbmdpZnkodW53cmFwU2FmZVZhbHVlKHZhbHVlKSk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuXG4vKipcbiAqIFRlc3RzIGlmIHRoZSBgVE5vZGVgIGhhcyBpbnB1dCBzaGFkb3cuXG4gKlxuICogQW4gaW5wdXQgc2hhZG93IGlzIHdoZW4gYSBkaXJlY3RpdmUgc3RlYWxzIChzaGFkb3dzKSB0aGUgaW5wdXQgYnkgdXNpbmcgYEBJbnB1dCgnc3R5bGUnKWAgb3JcbiAqIGBASW5wdXQoJ2NsYXNzJylgIGFzIGlucHV0LlxuICpcbiAqIEBwYXJhbSB0Tm9kZSBgVE5vZGVgIHdoaWNoIHdlIHdvdWxkIGxpa2UgdG8gc2VlIGlmIGl0IGhhcyBzaGFkb3cuXG4gKiBAcGFyYW0gaXNDbGFzc0Jhc2VkIGB0cnVlYCBpZiBgY2xhc3NgIChgZmFsc2VgIGlmIGBzdHlsZWApXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoYXNTdHlsaW5nSW5wdXRTaGFkb3codE5vZGU6IFROb2RlLCBpc0NsYXNzQmFzZWQ6IGJvb2xlYW4pIHtcbiAgcmV0dXJuICh0Tm9kZS5mbGFncyAmIChpc0NsYXNzQmFzZWQgPyBUTm9kZUZsYWdzLmhhc0NsYXNzSW5wdXQgOiBUTm9kZUZsYWdzLmhhc1N0eWxlSW5wdXQpKSAhPT0gMDtcbn1cbiJdfQ==