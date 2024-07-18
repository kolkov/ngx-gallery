/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import '../util/ng_dev_mode';
import { assertDefined, assertEqual, assertNotEqual } from '../util/assert';
import { classIndexOf } from './styling/class_differ';
import { isNameOnlyAttributeMarker } from './util/attrs_utils';
const NG_TEMPLATE_SELECTOR = 'ng-template';
/**
 * Search the `TAttributes` to see if it contains `cssClassToMatch` (case insensitive)
 *
 * @param tNode static data of the node to match
 * @param attrs `TAttributes` to search through.
 * @param cssClassToMatch class to match (lowercase)
 * @param isProjectionMode Whether or not class matching should look into the attribute `class` in
 *    addition to the `AttributeMarker.Classes`.
 */
function isCssClassMatching(tNode, attrs, cssClassToMatch, isProjectionMode) {
    ngDevMode &&
        assertEqual(cssClassToMatch, cssClassToMatch.toLowerCase(), 'Class name expected to be lowercase.');
    let i = 0;
    if (isProjectionMode) {
        for (; i < attrs.length && typeof attrs[i] === 'string'; i += 2) {
            // Search for an implicit `class` attribute and check if its value matches `cssClassToMatch`.
            if (attrs[i] === 'class' &&
                classIndexOf(attrs[i + 1].toLowerCase(), cssClassToMatch, 0) !== -1) {
                return true;
            }
        }
    }
    else if (isInlineTemplate(tNode)) {
        // Matching directives (i.e. when not matching for projection mode) should not consider the
        // class bindings that are present on inline templates, as those class bindings only target
        // the root node of the template, not the template itself.
        return false;
    }
    // Resume the search for classes after the `Classes` marker.
    i = attrs.indexOf(1 /* AttributeMarker.Classes */, i);
    if (i > -1) {
        // We found the classes section. Start searching for the class.
        let item;
        while (++i < attrs.length && typeof (item = attrs[i]) === 'string') {
            if (item.toLowerCase() === cssClassToMatch) {
                return true;
            }
        }
    }
    return false;
}
/**
 * Checks whether the `tNode` represents an inline template (e.g. `*ngFor`).
 *
 * @param tNode current TNode
 */
export function isInlineTemplate(tNode) {
    return tNode.type === 4 /* TNodeType.Container */ && tNode.value !== NG_TEMPLATE_SELECTOR;
}
/**
 * Function that checks whether a given tNode matches tag-based selector and has a valid type.
 *
 * Matching can be performed in 2 modes: projection mode (when we project nodes) and regular
 * directive matching mode:
 * - in the "directive matching" mode we do _not_ take TContainer's tagName into account if it is
 * different from NG_TEMPLATE_SELECTOR (value different from NG_TEMPLATE_SELECTOR indicates that a
 * tag name was extracted from * syntax so we would match the same directive twice);
 * - in the "projection" mode, we use a tag name potentially extracted from the * syntax processing
 * (applicable to TNodeType.Container only).
 */
function hasTagAndTypeMatch(tNode, currentSelector, isProjectionMode) {
    const tagNameToCompare = tNode.type === 4 /* TNodeType.Container */ && !isProjectionMode ? NG_TEMPLATE_SELECTOR : tNode.value;
    return currentSelector === tagNameToCompare;
}
/**
 * A utility function to match an Ivy node static data against a simple CSS selector
 *
 * @param tNode static data of the node to match
 * @param selector The selector to try matching against the node.
 * @param isProjectionMode if `true` we are matching for content projection, otherwise we are doing
 * directive matching.
 * @returns true if node matches the selector.
 */
export function isNodeMatchingSelector(tNode, selector, isProjectionMode) {
    ngDevMode && assertDefined(selector[0], 'Selector should have a tag name');
    let mode = 4 /* SelectorFlags.ELEMENT */;
    const nodeAttrs = tNode.attrs;
    // Find the index of first attribute that has no value, only a name.
    const nameOnlyMarkerIdx = nodeAttrs !== null ? getNameOnlyMarkerIndex(nodeAttrs) : 0;
    // When processing ":not" selectors, we skip to the next ":not" if the
    // current one doesn't match
    let skipToNextSelector = false;
    for (let i = 0; i < selector.length; i++) {
        const current = selector[i];
        if (typeof current === 'number') {
            // If we finish processing a :not selector and it hasn't failed, return false
            if (!skipToNextSelector && !isPositive(mode) && !isPositive(current)) {
                return false;
            }
            // If we are skipping to the next :not() and this mode flag is positive,
            // it's a part of the current :not() selector, and we should keep skipping
            if (skipToNextSelector && isPositive(current))
                continue;
            skipToNextSelector = false;
            mode = current | (mode & 1 /* SelectorFlags.NOT */);
            continue;
        }
        if (skipToNextSelector)
            continue;
        if (mode & 4 /* SelectorFlags.ELEMENT */) {
            mode = 2 /* SelectorFlags.ATTRIBUTE */ | (mode & 1 /* SelectorFlags.NOT */);
            if ((current !== '' && !hasTagAndTypeMatch(tNode, current, isProjectionMode)) ||
                (current === '' && selector.length === 1)) {
                if (isPositive(mode))
                    return false;
                skipToNextSelector = true;
            }
        }
        else if (mode & 8 /* SelectorFlags.CLASS */) {
            if (nodeAttrs === null || !isCssClassMatching(tNode, nodeAttrs, current, isProjectionMode)) {
                if (isPositive(mode))
                    return false;
                skipToNextSelector = true;
            }
        }
        else {
            const selectorAttrValue = selector[++i];
            const attrIndexInNode = findAttrIndexInNode(current, nodeAttrs, isInlineTemplate(tNode), isProjectionMode);
            if (attrIndexInNode === -1) {
                if (isPositive(mode))
                    return false;
                skipToNextSelector = true;
                continue;
            }
            if (selectorAttrValue !== '') {
                let nodeAttrValue;
                if (attrIndexInNode > nameOnlyMarkerIdx) {
                    nodeAttrValue = '';
                }
                else {
                    ngDevMode &&
                        assertNotEqual(nodeAttrs[attrIndexInNode], 0 /* AttributeMarker.NamespaceURI */, 'We do not match directives on namespaced attributes');
                    // we lowercase the attribute value to be able to match
                    // selectors without case-sensitivity
                    // (selectors are already in lowercase when generated)
                    nodeAttrValue = nodeAttrs[attrIndexInNode + 1].toLowerCase();
                }
                if (mode & 2 /* SelectorFlags.ATTRIBUTE */ && selectorAttrValue !== nodeAttrValue) {
                    if (isPositive(mode))
                        return false;
                    skipToNextSelector = true;
                }
            }
        }
    }
    return isPositive(mode) || skipToNextSelector;
}
function isPositive(mode) {
    return (mode & 1 /* SelectorFlags.NOT */) === 0;
}
/**
 * Examines the attribute's definition array for a node to find the index of the
 * attribute that matches the given `name`.
 *
 * NOTE: This will not match namespaced attributes.
 *
 * Attribute matching depends upon `isInlineTemplate` and `isProjectionMode`.
 * The following table summarizes which types of attributes we attempt to match:
 *
 * ===========================================================================================================
 * Modes                   | Normal Attributes | Bindings Attributes | Template Attributes | I18n
 * Attributes
 * ===========================================================================================================
 * Inline + Projection     | YES               | YES                 | NO                  | YES
 * -----------------------------------------------------------------------------------------------------------
 * Inline + Directive      | NO                | NO                  | YES                 | NO
 * -----------------------------------------------------------------------------------------------------------
 * Non-inline + Projection | YES               | YES                 | NO                  | YES
 * -----------------------------------------------------------------------------------------------------------
 * Non-inline + Directive  | YES               | YES                 | NO                  | YES
 * ===========================================================================================================
 *
 * @param name the name of the attribute to find
 * @param attrs the attribute array to examine
 * @param isInlineTemplate true if the node being matched is an inline template (e.g. `*ngFor`)
 * rather than a manually expanded template node (e.g `<ng-template>`).
 * @param isProjectionMode true if we are matching against content projection otherwise we are
 * matching against directives.
 */
function findAttrIndexInNode(name, attrs, isInlineTemplate, isProjectionMode) {
    if (attrs === null)
        return -1;
    let i = 0;
    if (isProjectionMode || !isInlineTemplate) {
        let bindingsMode = false;
        while (i < attrs.length) {
            const maybeAttrName = attrs[i];
            if (maybeAttrName === name) {
                return i;
            }
            else if (maybeAttrName === 3 /* AttributeMarker.Bindings */ ||
                maybeAttrName === 6 /* AttributeMarker.I18n */) {
                bindingsMode = true;
            }
            else if (maybeAttrName === 1 /* AttributeMarker.Classes */ ||
                maybeAttrName === 2 /* AttributeMarker.Styles */) {
                let value = attrs[++i];
                // We should skip classes here because we have a separate mechanism for
                // matching classes in projection mode.
                while (typeof value === 'string') {
                    value = attrs[++i];
                }
                continue;
            }
            else if (maybeAttrName === 4 /* AttributeMarker.Template */) {
                // We do not care about Template attributes in this scenario.
                break;
            }
            else if (maybeAttrName === 0 /* AttributeMarker.NamespaceURI */) {
                // Skip the whole namespaced attribute and value. This is by design.
                i += 4;
                continue;
            }
            // In binding mode there are only names, rather than name-value pairs.
            i += bindingsMode ? 1 : 2;
        }
        // We did not match the attribute
        return -1;
    }
    else {
        return matchTemplateAttribute(attrs, name);
    }
}
export function isNodeMatchingSelectorList(tNode, selector, isProjectionMode = false) {
    for (let i = 0; i < selector.length; i++) {
        if (isNodeMatchingSelector(tNode, selector[i], isProjectionMode)) {
            return true;
        }
    }
    return false;
}
export function getProjectAsAttrValue(tNode) {
    const nodeAttrs = tNode.attrs;
    if (nodeAttrs != null) {
        const ngProjectAsAttrIdx = nodeAttrs.indexOf(5 /* AttributeMarker.ProjectAs */);
        // only check for ngProjectAs in attribute names, don't accidentally match attribute's value
        // (attribute names are stored at even indexes)
        if ((ngProjectAsAttrIdx & 1) === 0) {
            return nodeAttrs[ngProjectAsAttrIdx + 1];
        }
    }
    return null;
}
function getNameOnlyMarkerIndex(nodeAttrs) {
    for (let i = 0; i < nodeAttrs.length; i++) {
        const nodeAttr = nodeAttrs[i];
        if (isNameOnlyAttributeMarker(nodeAttr)) {
            return i;
        }
    }
    return nodeAttrs.length;
}
function matchTemplateAttribute(attrs, name) {
    let i = attrs.indexOf(4 /* AttributeMarker.Template */);
    if (i > -1) {
        i++;
        while (i < attrs.length) {
            const attr = attrs[i];
            // Return in case we checked all template attrs and are switching to the next section in the
            // attrs array (that starts with a number that represents an attribute marker).
            if (typeof attr === 'number')
                return -1;
            if (attr === name)
                return i;
            i++;
        }
    }
    return -1;
}
/**
 * Checks whether a selector is inside a CssSelectorList
 * @param selector Selector to be checked.
 * @param list List in which to look for the selector.
 */
export function isSelectorInSelectorList(selector, list) {
    selectorListLoop: for (let i = 0; i < list.length; i++) {
        const currentSelectorInList = list[i];
        if (selector.length !== currentSelectorInList.length) {
            continue;
        }
        for (let j = 0; j < selector.length; j++) {
            if (selector[j] !== currentSelectorInList[j]) {
                continue selectorListLoop;
            }
        }
        return true;
    }
    return false;
}
function maybeWrapInNotSelector(isNegativeMode, chunk) {
    return isNegativeMode ? ':not(' + chunk.trim() + ')' : chunk;
}
function stringifyCSSSelector(selector) {
    let result = selector[0];
    let i = 1;
    let mode = 2 /* SelectorFlags.ATTRIBUTE */;
    let currentChunk = '';
    let isNegativeMode = false;
    while (i < selector.length) {
        let valueOrMarker = selector[i];
        if (typeof valueOrMarker === 'string') {
            if (mode & 2 /* SelectorFlags.ATTRIBUTE */) {
                const attrValue = selector[++i];
                currentChunk +=
                    '[' + valueOrMarker + (attrValue.length > 0 ? '="' + attrValue + '"' : '') + ']';
            }
            else if (mode & 8 /* SelectorFlags.CLASS */) {
                currentChunk += '.' + valueOrMarker;
            }
            else if (mode & 4 /* SelectorFlags.ELEMENT */) {
                currentChunk += ' ' + valueOrMarker;
            }
        }
        else {
            //
            // Append current chunk to the final result in case we come across SelectorFlag, which
            // indicates that the previous section of a selector is over. We need to accumulate content
            // between flags to make sure we wrap the chunk later in :not() selector if needed, e.g.
            // ```
            //  ['', Flags.CLASS, '.classA', Flags.CLASS | Flags.NOT, '.classB', '.classC']
            // ```
            // should be transformed to `.classA :not(.classB .classC)`.
            //
            // Note: for negative selector part, we accumulate content between flags until we find the
            // next negative flag. This is needed to support a case where `:not()` rule contains more than
            // one chunk, e.g. the following selector:
            // ```
            //  ['', Flags.ELEMENT | Flags.NOT, 'p', Flags.CLASS, 'foo', Flags.CLASS | Flags.NOT, 'bar']
            // ```
            // should be stringified to `:not(p.foo) :not(.bar)`
            //
            if (currentChunk !== '' && !isPositive(valueOrMarker)) {
                result += maybeWrapInNotSelector(isNegativeMode, currentChunk);
                currentChunk = '';
            }
            mode = valueOrMarker;
            // According to CssSelector spec, once we come across `SelectorFlags.NOT` flag, the negative
            // mode is maintained for remaining chunks of a selector.
            isNegativeMode = isNegativeMode || !isPositive(mode);
        }
        i++;
    }
    if (currentChunk !== '') {
        result += maybeWrapInNotSelector(isNegativeMode, currentChunk);
    }
    return result;
}
/**
 * Generates string representation of CSS selector in parsed form.
 *
 * ComponentDef and DirectiveDef are generated with the selector in parsed form to avoid doing
 * additional parsing at runtime (for example, for directive matching). However in some cases (for
 * example, while bootstrapping a component), a string version of the selector is required to query
 * for the host element on the page. This function takes the parsed form of a selector and returns
 * its string representation.
 *
 * @param selectorList selector in parsed form
 * @returns string representation of a given selector
 */
export function stringifyCSSSelectorList(selectorList) {
    return selectorList.map(stringifyCSSSelector).join(',');
}
/**
 * Extracts attributes and classes information from a given CSS selector.
 *
 * This function is used while creating a component dynamically. In this case, the host element
 * (that is created dynamically) should contain attributes and classes specified in component's CSS
 * selector.
 *
 * @param selector CSS selector in parsed form (in a form of array)
 * @returns object with `attrs` and `classes` fields that contain extracted information
 */
export function extractAttrsAndClassesFromSelector(selector) {
    const attrs = [];
    const classes = [];
    let i = 1;
    let mode = 2 /* SelectorFlags.ATTRIBUTE */;
    while (i < selector.length) {
        let valueOrMarker = selector[i];
        if (typeof valueOrMarker === 'string') {
            if (mode === 2 /* SelectorFlags.ATTRIBUTE */) {
                if (valueOrMarker !== '') {
                    attrs.push(valueOrMarker, selector[++i]);
                }
            }
            else if (mode === 8 /* SelectorFlags.CLASS */) {
                classes.push(valueOrMarker);
            }
        }
        else {
            // According to CssSelector spec, once we come across `SelectorFlags.NOT` flag, the negative
            // mode is maintained for remaining chunks of a selector. Since attributes and classes are
            // extracted only for "positive" part of the selector, we can stop here.
            if (!isPositive(mode))
                break;
            mode = valueOrMarker;
        }
        i++;
    }
    return { attrs, classes };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZV9zZWxlY3Rvcl9tYXRjaGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9ub2RlX3NlbGVjdG9yX21hdGNoZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxxQkFBcUIsQ0FBQztBQUU3QixPQUFPLEVBQUMsYUFBYSxFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUsxRSxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDcEQsT0FBTyxFQUFDLHlCQUF5QixFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFFN0QsTUFBTSxvQkFBb0IsR0FBRyxhQUFhLENBQUM7QUFFM0M7Ozs7Ozs7O0dBUUc7QUFDSCxTQUFTLGtCQUFrQixDQUN6QixLQUFZLEVBQ1osS0FBa0IsRUFDbEIsZUFBdUIsRUFDdkIsZ0JBQXlCO0lBRXpCLFNBQVM7UUFDUCxXQUFXLENBQ1QsZUFBZSxFQUNmLGVBQWUsQ0FBQyxXQUFXLEVBQUUsRUFDN0Isc0NBQXNDLENBQ3ZDLENBQUM7SUFDSixJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDVixJQUFJLGdCQUFnQixFQUFFLENBQUM7UUFDckIsT0FBTyxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sSUFBSSxPQUFPLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ2hFLDZGQUE2RjtZQUM3RixJQUNFLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxPQUFPO2dCQUNwQixZQUFZLENBQUUsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQVksQ0FBQyxXQUFXLEVBQUUsRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQy9FLENBQUM7Z0JBQ0QsT0FBTyxJQUFJ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VUFBVSxrQ0FBa0MsQ0FBQyxRQUFxQjtJQUl0RSxNQUFNLEtBQUssR0FBYSxFQUFFLENBQUM7SUFDM0IsTUFBTSxPQUFPLEdBQWEsRUFBRSxDQUFDO0lBQzdCLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNWLElBQUksSUFBSSxrQ0FBMEIsQ0FBQztJQUNuQyxPQUFPLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDM0IsSUFBSSxhQUFhLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2hDLElBQUksT0FBTyxhQUFhLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDdEMsSUFBSSxJQUFJLG9DQUE0QixFQUFFLENBQUM7Z0JBQ3JDLElBQUksYUFBYSxLQUFLLEVBQUUsRUFBRSxDQUFDO29CQUN6QixLQUFLLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxRQUFRLENBQUMsRUFBRSxDQUFDLENBQVcsQ0FBQyxDQUFDO2dCQUNyRCxDQUFDO1lBQ0gsQ0FBQztpQkFBTSxJQUFJLElBQUksZ0NBQXdCLEVBQUUsQ0FBQztnQkFDeEMsT0FBTyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUM5QixDQUFDO1FBQ0gsQ0FBQzthQUFNLENBQUM7WUFDTiw0RkFBNEY7WUFDNUYsMEZBQTBGO1lBQzFGLHdFQUF3RTtZQUN4RSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQztnQkFBRSxNQUFNO1lBQzdCLElBQUksR0FBRyxhQUFhLENBQUM7UUFDdkIsQ0FBQztRQUNELENBQUMsRUFBRSxDQUFDO0lBQ04sQ0FBQztJQUNELE9BQU8sRUFBQyxLQUFLLEVBQUUsT0FBTyxFQUFDLENBQUM7QUFDMUIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgJy4uL3V0aWwvbmdfZGV2X21vZGUnO1xuXG5pbXBvcnQge2Fzc2VydERlZmluZWQsIGFzc2VydEVxdWFsLCBhc3NlcnROb3RFcXVhbH0gZnJvbSAnLi4vdXRpbC9hc3NlcnQnO1xuXG5pbXBvcnQge0F0dHJpYnV0ZU1hcmtlcn0gZnJvbSAnLi9pbnRlcmZhY2VzL2F0dHJpYnV0ZV9tYXJrZXInO1xuaW1wb3J0IHtUQXR0cmlidXRlcywgVE5vZGUsIFROb2RlVHlwZX0gZnJvbSAnLi9pbnRlcmZhY2VzL25vZGUnO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgQ3NzU2VsZWN0b3JMaXN0LCBTZWxlY3RvckZsYWdzfSBmcm9tICcuL2ludGVyZmFjZXMvcHJvamVjdGlvbic7XG5pbXBvcnQge2NsYXNzSW5kZXhPZn0gZnJvbSAnLi9zdHlsaW5nL2NsYXNzX2RpZmZlcic7XG5pbXBvcnQge2lzTmFtZU9ubHlBdHRyaWJ1dGVNYXJrZXJ9IGZyb20gJy4vdXRpbC9hdHRyc191dGlscyc7XG5cbmNvbnN0IE5HX1RFTVBMQVRFX1NFTEVDVE9SID0gJ25nLXRlbXBsYXRlJztcblxuLyoqXG4gKiBTZWFyY2ggdGhlIGBUQXR0cmlidXRlc2AgdG8gc2VlIGlmIGl0IGNvbnRhaW5zIGBjc3NDbGFzc1RvTWF0Y2hgIChjYXNlIGluc2Vuc2l0aXZlKVxuICpcbiAqIEBwYXJhbSB0Tm9kZSBzdGF0aWMgZGF0YSBvZiB0aGUgbm9kZSB0byBtYXRjaFxuICogQHBhcmFtIGF0dHJzIGBUQXR0cmlidXRlc2AgdG8gc2VhcmNoIHRocm91Z2guXG4gKiBAcGFyYW0gY3NzQ2xhc3NUb01hdGNoIGNsYXNzIHRvIG1hdGNoIChsb3dlcmNhc2UpXG4gKiBAcGFyYW0gaXNQcm9qZWN0aW9uTW9kZSBXaGV0aGVyIG9yIG5vdCBjbGFzcyBtYXRjaGluZyBzaG91bGQgbG9vayBpbnRvIHRoZSBhdHRyaWJ1dGUgYGNsYXNzYCBpblxuICogICAgYWRkaXRpb24gdG8gdGhlIGBBdHRyaWJ1dGVNYXJrZXIuQ2xhc3Nlc2AuXG4gKi9cbmZ1bmN0aW9uIGlzQ3NzQ2xhc3NNYXRjaGluZyhcbiAgdE5vZGU6IFROb2RlLFxuICBhdHRyczogVEF0dHJpYnV0ZXMsXG4gIGNzc0NsYXNzVG9NYXRjaDogc3RyaW5nLFxuICBpc1Byb2plY3Rpb25Nb2RlOiBib29sZWFuLFxuKTogYm9vbGVhbiB7XG4gIG5nRGV2TW9kZSAmJlxuICAgIGFzc2VydEVxdWFsKFxuICAgICAgY3NzQ2xhc3NUb01hdGNoLFxuICAgICAgY3NzQ2xhc3NUb01hdGNoLnRvTG93ZXJDYXNlKCksXG4gICAgICAnQ2xhc3MgbmFtZSBleHBlY3RlZCB0byBiZSBsb3dlcmNhc2UuJyxcbiAgICApO1xuICBsZXQgaSA9IDA7XG4gIGlmIChpc1Byb2plY3Rpb25Nb2RlKSB7XG4gICAgZm9yICg7IGkgPCBhdHRycy5sZW5ndGggJiYgdHlwZW9mIGF0dHJzW2ldID09PSAnc3RyaW5nJzsgaSArPSAyKSB7XG4gICAgICAvLyBTZWFyY2ggZm9yIGFuIGltcGxpY2l0IGBjbGFzc2AgYXR0cmlidXRlIGFuZCBjaGVjayBpZiBpdHMgdmFsdWUgbWF0Y2hlcyBgY3NzQ2xhc3NUb01hdGNoYC5cbiAgICAgIGlmIChcbiAgICAgICAgYXR0cnNbaV0gPT09ICdjbGFzcycgJiZcbiAgICAgICAgY2xhc3NJbmRleE9mKChhdHRyc1tpICsgMV0gYXMgc3RyaW5nKS50b0xvd2VyQ2FzZSgpLCBjc3NDbGFzc1RvTWF0Y2gsIDApICE9PSAtMVxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmIChpc0lubGluZVRlbXBsYXRlKHROb2RlKSkge1xuICAgIC8vIE1hdGNoaW5nIGRpcmVjdGl2ZXMgKGkuZS4gd2hlbiBub3QgbWF0Y2hpbmcgZm9yIHByb2plY3Rpb24gbW9kZSkgc2hvdWxkIG5vdCBjb25zaWRlciB0aGVcbiAgICAvLyBjbGFzcyBiaW5kaW5ncyB0aGF0IGFyZSBwcmVzZW50IG9uIGlubGluZSB0ZW1wbGF0ZXMsIGFzIHRob3NlIGNsYXNzIGJpbmRpbmdzIG9ubHkgdGFyZ2V0XG4gICAgLy8gdGhlIHJvb3Qgbm9kZSBvZiB0aGUgdGVtcGxhdGUsIG5vdCB0aGUgdGVtcGxhdGUgaXRzZWxmLlxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIFJlc3VtZSB0aGUgc2VhcmNoIGZvciBjbGFzc2VzIGFmdGVyIHRoZSBgQ2xhc3Nlc2AgbWFya2VyLlxuICBpID0gYXR0cnMuaW5kZXhPZihBdHRyaWJ1dGVNYXJrZXIuQ2xhc3NlcywgaSk7XG4gIGlmIChpID4gLTEpIHtcbiAgICAvLyBXZSBmb3VuZCB0aGUgY2xhc3NlcyBzZWN0aW9uLiBTdGFydCBzZWFyY2hpbmcgZm9yIHRoZSBjbGFzcy5cbiAgICBsZXQgaXRlbTogVEF0dHJpYnV0ZXNbbnVtYmVyXTtcbiAgICB3aGlsZSAoKytpIDwgYXR0cnMubGVuZ3RoICYmIHR5cGVvZiAoaXRlbSA9IGF0dHJzW2ldKSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGlmIChpdGVtLnRvTG93ZXJDYXNlKCkgPT09IGNzc0NsYXNzVG9NYXRjaCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIHRoZSBgdE5vZGVgIHJlcHJlc2VudHMgYW4gaW5saW5lIHRlbXBsYXRlIChlLmcuIGAqbmdGb3JgKS5cbiAqXG4gKiBAcGFyYW0gdE5vZGUgY3VycmVudCBUTm9kZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNJbmxpbmVUZW1wbGF0ZSh0Tm9kZTogVE5vZGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIHROb2RlLnR5cGUgPT09IFROb2RlVHlwZS5Db250YWluZXIgJiYgdE5vZGUudmFsdWUgIT09IE5HX1RFTVBMQVRFX1NFTEVDVE9SO1xufVxuXG4vKipcbiAqIEZ1bmN0aW9uIHRoYXQgY2hlY2tzIHdoZXRoZXIgYSBnaXZlbiB0Tm9kZSBtYXRjaGVzIHRhZy1iYXNlZCBzZWxlY3RvciBhbmQgaGFzIGEgdmFsaWQgdHlwZS5cbiAqXG4gKiBNYXRjaGluZyBjYW4gYmUgcGVyZm9ybWVkIGluIDIgbW9kZXM6IHByb2plY3Rpb24gbW9kZSAod2hlbiB3ZSBwcm9qZWN0IG5vZGVzKSBhbmQgcmVndWxhclxuICogZGlyZWN0aXZlIG1hdGNoaW5nIG1vZGU6XG4gKiAtIGluIHRoZSBcImRpcmVjdGl2ZSBtYXRjaGluZ1wiIG1vZGUgd2UgZG8gX25vdF8gdGFrZSBUQ29udGFpbmVyJ3MgdGFnTmFtZSBpbnRvIGFjY291bnQgaWYgaXQgaXNcbiAqIGRpZmZlcmVudCBmcm9tIE5HX1RFTVBMQVRFX1NFTEVDVE9SICh2YWx1ZSBkaWZmZXJlbnQgZnJvbSBOR19URU1QTEFURV9TRUxFQ1RPUiBpbmRpY2F0ZXMgdGhhdCBhXG4gKiB0YWcgbmFtZSB3YXMgZXh0cmFjdGVkIGZyb20gKiBzeW50YXggc28gd2Ugd291bGQgbWF0Y2ggdGhlIHNhbWUgZGlyZWN0aXZlIHR3aWNlKTtcbiAqIC0gaW4gdGhlIFwicHJvamVjdGlvblwiIG1vZGUsIHdlIHVzZSBhIHRhZyBuYW1lIHBvdGVudGlhbGx5IGV4dHJhY3RlZCBmcm9tIHRoZSAqIHN5bnRheCBwcm9jZXNzaW5nXG4gKiAoYXBwbGljYWJsZSB0byBUTm9kZVR5cGUuQ29udGFpbmVyIG9ubHkpLlxuICovXG5mdW5jdGlvbiBoYXNUYWdBbmRUeXBlTWF0Y2goXG4gIHROb2RlOiBUTm9kZSxcbiAgY3VycmVudFNlbGVjdG9yOiBzdHJpbmcsXG4gIGlzUHJvamVjdGlvbk1vZGU6IGJvb2xlYW4sXG4pOiBib29sZWFuIHtcbiAgY29uc3QgdGFnTmFtZVRvQ29tcGFyZSA9XG4gICAgdE5vZGUudHlwZSA9PT0gVE5vZGVUeXBlLkNvbnRhaW5lciAmJiAhaXNQcm9qZWN0aW9uTW9kZSA/IE5HX1RFTVBMQVRFX1NFTEVDVE9SIDogdE5vZGUudmFsdWU7XG4gIHJldHVybiBjdXJyZW50U2VsZWN0b3IgPT09IHRhZ05hbWVUb0NvbXBhcmU7XG59XG5cbi8qKlxuICogQSB1dGlsaXR5IGZ1bmN0aW9uIHRvIG1hdGNoIGFuIEl2eSBub2RlIHN0YXRpYyBkYXRhIGFnYWluc3QgYSBzaW1wbGUgQ1NTIHNlbGVjdG9yXG4gKlxuICogQHBhcmFtIHROb2RlIHN0YXRpYyBkYXRhIG9mIHRoZSBub2RlIHRvIG1hdGNoXG4gKiBAcGFyYW0gc2VsZWN0b3IgVGhlIHNlbGVjdG9yIHRvIHRyeSBtYXRjaGluZyBhZ2FpbnN0IHRoZSBub2RlLlxuICogQHBhcmFtIGlzUHJvamVjdGlvbk1vZGUgaWYgYHRydWVgIHdlIGFyZSBtYXRjaGluZyBmb3IgY29udGVudCBwcm9qZWN0aW9uLCBvdGhlcndpc2Ugd2UgYXJlIGRvaW5nXG4gKiBkaXJlY3RpdmUgbWF0Y2hpbmcuXG4gKiBAcmV0dXJucyB0cnVlIGlmIG5vZGUgbWF0Y2hlcyB0aGUgc2VsZWN0b3IuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc05vZGVNYXRjaGluZ1NlbGVjdG9yKFxuICB0Tm9kZTogVE5vZGUsXG4gIHNlbGVjdG9yOiBDc3NTZWxlY3RvcixcbiAgaXNQcm9qZWN0aW9uTW9kZTogYm9vbGVhbixcbik6IGJvb2xlYW4ge1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0RGVmaW5lZChzZWxlY3RvclswXSwgJ1NlbGVjdG9yIHNob3VsZCBoYXZlIGEgdGFnIG5hbWUnKTtcbiAgbGV0IG1vZGU6IFNlbGVjdG9yRmxhZ3MgPSBTZWxlY3RvckZsYWdzLkVMRU1FTlQ7XG4gIGNvbnN0IG5vZGVBdHRycyA9IHROb2RlLmF0dHJzO1xuXG4gIC8vIEZpbmQgdGhlIGluZGV4IG9mIGZpcnN0IGF0dHJpYnV0ZSB0aGF0IGhhcyBubyB2YWx1ZSwgb25seSBhIG5hbWUuXG4gIGNvbnN0IG5hbWVPbmx5TWFya2VySWR4ID0gbm9kZUF0dHJzICE9PSBudWxsID8gZ2V0TmFtZU9ubHlNYXJrZXJJbmRleChub2RlQXR0cnMpIDogMDtcblxuICAvLyBXaGVuIHByb2Nlc3NpbmcgXCI6bm90XCIgc2VsZWN0b3JzLCB3ZSBza2lwIHRvIHRoZSBuZXh0IFwiOm5vdFwiIGlmIHRoZVxuICAvLyBjdXJyZW50IG9uZSBkb2Vzbid0IG1hdGNoXG4gIGxldCBza2lwVG9OZXh0U2VsZWN0b3IgPSBmYWxzZTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHNlbGVjdG9yLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY3VycmVudCA9IHNlbGVjdG9yW2ldO1xuICAgIGlmICh0eXBlb2YgY3VycmVudCA9PT0gJ251bWJlcicpIHtcbiAgICAgIC8vIElmIHdlIGZpbmlzaCBwcm9jZXNzaW5nIGEgOm5vdCBzZWxlY3RvciBhbmQgaXQgaGFzbid0IGZhaWxlZCwgcmV0dXJuIGZhbHNlXG4gICAgICBpZiAoIXNraXBUb05leHRTZWxlY3RvciAmJiAhaXNQb3NpdGl2ZShtb2RlKSAmJiAhaXNQb3NpdGl2ZShjdXJyZW50KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICAvLyBJZiB3ZSBhcmUgc2tpcHBpbmcgdG8gdGhlIG5leHQgOm5vdCgpIGFuZCB0aGlzIG1vZGUgZmxhZyBpcyBwb3NpdGl2ZSxcbiAgICAgIC8vIGl0J3MgYSBwYXJ0IG9mIHRoZSBjdXJyZW50IDpub3QoKSBzZWxlY3RvciwgYW5kIHdlIHNob3VsZCBrZWVwIHNraXBwaW5nXG4gICAgICBpZiAoc2tpcFRvTmV4dFNlbGVjdG9yICYmIGlzUG9zaXRpdmUoY3VycmVudCkpIGNvbnRpbnVlO1xuICAgICAgc2tpcFRvTmV4dFNlbGVjdG9yID0gZmFsc2U7XG4gICAgICBtb2RlID0gKGN1cnJlbnQgYXMgbnVtYmVyKSB8IChtb2RlICYgU2VsZWN0b3JGbGFncy5OT1QpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKHNraXBUb05leHRTZWxlY3RvcikgY29udGludWU7XG5cbiAgICBpZiAobW9kZSAmIFNlbGVjdG9yRmxhZ3MuRUxFTUVOVCkge1xuICAgICAgbW9kZSA9IFNlbGVjdG9yRmxhZ3MuQVRUUklCVVRFIHwgKG1vZGUgJiBTZWxlY3RvckZsYWdzLk5PVCk7XG4gICAgICBpZiAoXG4gICAgICAgIChjdXJyZW50ICE9PSAnJyAmJiAhaGFzVGFnQW5kVHlwZU1hdGNoKHROb2RlLCBjdXJyZW50LCBpc1Byb2plY3Rpb25Nb2RlKSkgfHxcbiAgICAgICAgKGN1cnJlbnQgPT09ICcnICYmIHNlbGVjdG9yLmxlbmd0aCA9PT0gMSlcbiAgICAgICkge1xuICAgICAgICBpZiAoaXNQb3NpdGl2ZShtb2RlKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBza2lwVG9OZXh0U2VsZWN0b3IgPSB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobW9kZSAmIFNlbGVjdG9yRmxhZ3MuQ0xBU1MpIHtcbiAgICAgIGlmIChub2RlQXR0cnMgPT09IG51bGwgfHwgIWlzQ3NzQ2xhc3NNYXRjaGluZyh0Tm9kZSwgbm9kZUF0dHJzLCBjdXJyZW50LCBpc1Byb2plY3Rpb25Nb2RlKSkge1xuICAgICAgICBpZiAoaXNQb3NpdGl2ZShtb2RlKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBza2lwVG9OZXh0U2VsZWN0b3IgPSB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBzZWxlY3RvckF0dHJWYWx1ZSA9IHNlbGVjdG9yWysraV07XG4gICAgICBjb25zdCBhdHRySW5kZXhJbk5vZGUgPSBmaW5kQXR0ckluZGV4SW5Ob2RlKFxuICAgICAgICBjdXJyZW50LFxuICAgICAgICBub2RlQXR0cnMsXG4gICAgICAgIGlzSW5saW5lVGVtcGxhdGUodE5vZGUpLFxuICAgICAgICBpc1Byb2plY3Rpb25Nb2RlLFxuICAgICAgKTtcblxuICAgICAgaWYgKGF0dHJJbmRleEluTm9kZSA9PT0gLTEpIHtcbiAgICAgICAgaWYgKGlzUG9zaXRpdmUobW9kZSkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgc2tpcFRvTmV4dFNlbGVjdG9yID0gdHJ1ZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChzZWxlY3RvckF0dHJWYWx1ZSAhPT0gJycpIHtcbiAgICAgICAgbGV0IG5vZGVBdHRyVmFsdWU6IHN0cmluZztcbiAgICAgICAgaWYgKGF0dHJJbmRleEluTm9kZSA+IG5hbWVPbmx5TWFya2VySWR4KSB7XG4gICAgICAgICAgbm9kZUF0dHJWYWx1ZSA9ICcnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5nRGV2TW9kZSAmJlxuICAgICAgICAgICAgYXNzZXJ0Tm90RXF1YWwoXG4gICAgICAgICAgICAgIG5vZGVBdHRycyFbYXR0ckluZGV4SW5Ob2RlXSxcbiAgICAgICAgICAgICAgQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSxcbiAgICAgICAgICAgICAgJ1dlIGRvIG5vdCBtYXRjaCBkaXJlY3RpdmVzIG9uIG5hbWVzcGFjZWQgYXR0cmlidXRlcycsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIC8vIHdlIGxvd2VyY2FzZSB0aGUgYXR0cmlidXRlIHZhbHVlIHRvIGJlIGFibGUgdG8gbWF0Y2hcbiAgICAgICAgICAvLyBzZWxlY3RvcnMgd2l0aG91dCBjYXNlLXNlbnNpdGl2aXR5XG4gICAgICAgICAgLy8gKHNlbGVjdG9ycyBhcmUgYWxyZWFkeSBpbiBsb3dlcmNhc2Ugd2hlbiBnZW5lcmF0ZWQpXG4gICAgICAgICAgbm9kZUF0dHJWYWx1ZSA9IChub2RlQXR0cnMhW2F0dHJJbmRleEluTm9kZSArIDFdIGFzIHN0cmluZykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtb2RlICYgU2VsZWN0b3JGbGFncy5BVFRSSUJVVEUgJiYgc2VsZWN0b3JBdHRyVmFsdWUgIT09IG5vZGVBdHRyVmFsdWUpIHtcbiAgICAgICAgICBpZiAoaXNQb3NpdGl2ZShtb2RlKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIHNraXBUb05leHRTZWxlY3RvciA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gaXNQb3NpdGl2ZShtb2RlKSB8fCBza2lwVG9OZXh0U2VsZWN0b3I7XG59XG5cbmZ1bmN0aW9uIGlzUG9zaXRpdmUobW9kZTogU2VsZWN0b3JGbGFncyk6IGJvb2xlYW4ge1xuICByZXR1cm4gKG1vZGUgJiBTZWxlY3RvckZsYWdzLk5PVCkgPT09IDA7XG59XG5cbi8qKlxuICogRXhhbWluZXMgdGhlIGF0dHJpYnV0ZSdzIGRlZmluaXRpb24gYXJyYXkgZm9yIGEgbm9kZSB0byBmaW5kIHRoZSBpbmRleCBvZiB0aGVcbiAqIGF0dHJpYnV0ZSB0aGF0IG1hdGNoZXMgdGhlIGdpdmVuIGBuYW1lYC5cbiAqXG4gKiBOT1RFOiBUaGlzIHdpbGwgbm90IG1hdGNoIG5hbWVzcGFjZWQgYXR0cmlidXRlcy5cbiAqXG4gKiBBdHRyaWJ1dGUgbWF0Y2hpbmcgZGVwZW5kcyB1cG9uIGBpc0lubGluZVRlbXBsYXRlYCBhbmQgYGlzUHJvamVjdGlvbk1vZGVgLlxuICogVGhlIGZvbGxvd2luZyB0YWJsZSBzdW1tYXJpemVzIHdoaWNoIHR5cGVzIG9mIGF0dHJpYnV0ZXMgd2UgYXR0ZW1wdCB0byBtYXRjaDpcbiAqXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogTW9kZXMgICAgICAgICAgICAgICAgICAgfCBOb3JtYWwgQXR0cmlidXRlcyB8IEJpbmRpbmdzIEF0dHJpYnV0ZXMgfCBUZW1wbGF0ZSBBdHRyaWJ1dGVzIHwgSTE4blxuICogQXR0cmlidXRlc1xuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIElubGluZSArIFByb2plY3Rpb24gICAgIHwgWUVTICAgICAgICAgICAgICAgfCBZRVMgICAgICAgICAgICAgICAgIHwgTk8gICAgICAgICAgICAgICAgICB8IFlFU1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIElubGluZSArIERpcmVjdGl2ZSAgICAgIHwgTk8gICAgICAgICAgICAgICAgfCBOTyAgICAgICAgICAgICAgICAgIHwgWUVTICAgICAgICAgICAgICAgICB8IE5PXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogTm9uLWlubGluZSArIFByb2plY3Rpb24gfCBZRVMgICAgICAgICAgICAgICB8IFlFUyAgICAgICAgICAgICAgICAgfCBOTyAgICAgICAgICAgICAgICAgIHwgWUVTXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogTm9uLWlubGluZSArIERpcmVjdGl2ZSAgfCBZRVMgICAgICAgICAgICAgICB8IFlFUyAgICAgICAgICAgICAgICAgfCBOTyAgICAgICAgICAgICAgICAgIHwgWUVTXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICpcbiAqIEBwYXJhbSBuYW1lIHRoZSBuYW1lIG9mIHRoZSBhdHRyaWJ1dGUgdG8gZmluZFxuICogQHBhcmFtIGF0dHJzIHRoZSBhdHRyaWJ1dGUgYXJyYXkgdG8gZXhhbWluZVxuICogQHBhcmFtIGlzSW5saW5lVGVtcGxhdGUgdHJ1ZSBpZiB0aGUgbm9kZSBiZWluZyBtYXRjaGVkIGlzIGFuIGlubGluZSB0ZW1wbGF0ZSAoZS5nLiBgKm5nRm9yYClcbiAqIHJhdGhlciB0aGFuIGEgbWFudWFsbHkgZXhwYW5kZWQgdGVtcGxhdGUgbm9kZSAoZS5nIGA8bmctdGVtcGxhdGU+YCkuXG4gKiBAcGFyYW0gaXNQcm9qZWN0aW9uTW9kZSB0cnVlIGlmIHdlIGFyZSBtYXRjaGluZyBhZ2FpbnN0IGNvbnRlbnQgcHJvamVjdGlvbiBvdGhlcndpc2Ugd2UgYXJlXG4gKiBtYXRjaGluZyBhZ2FpbnN0IGRpcmVjdGl2ZXMuXG4gKi9cbmZ1bmN0aW9uIGZpbmRBdHRySW5kZXhJbk5vZGUoXG4gIG5hbWU6IHN0cmluZyxcbiAgYXR0cnM6IFRBdHRyaWJ1dGVzIHwgbnVsbCxcbiAgaXNJbmxpbmVUZW1wbGF0ZTogYm9vbGVhbixcbiAgaXNQcm9qZWN0aW9uTW9kZTogYm9vbGVhbixcbik6IG51bWJlciB7XG4gIGlmIChhdHRycyA9PT0gbnVsbCkgcmV0dXJuIC0xO1xuXG4gIGxldCBpID0gMDtcblxuICBpZiAoaXNQcm9qZWN0aW9uTW9kZSB8fCAhaXNJbmxpbmVUZW1wbGF0ZSkge1xuICAgIGxldCBiaW5kaW5nc01vZGUgPSBmYWxzZTtcbiAgICB3aGlsZSAoaSA8IGF0dHJzLmxlbmd0aCkge1xuICAgICAgY29uc3QgbWF5YmVBdHRyTmFtZSA9IGF0dHJzW2ldO1xuICAgICAgaWYgKG1heWJlQXR0ck5hbWUgPT09IG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGk7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICBtYXliZUF0dHJOYW1lID09PSBBdHRyaWJ1dGVNYXJrZXIuQmluZGluZ3MgfHxcbiAgICAgICAgbWF5YmVBdHRyTmFtZSA9PT0gQXR0cmlidXRlTWFya2VyLkkxOG5cbiAgICAgICkge1xuICAgICAgICBiaW5kaW5nc01vZGUgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgbWF5YmVBdHRyTmFtZSA9PT0gQXR0cmlidXRlTWFya2VyLkNsYXNzZXMgfHxcbiAgICAgICAgbWF5YmVBdHRyTmFtZSA9PT0gQXR0cmlidXRlTWFya2VyLlN0eWxlc1xuICAgICAgKSB7XG4gICAgICAgIGxldCB2YWx1ZSA9IGF0dHJzWysraV07XG4gICAgICAgIC8vIFdlIHNob3VsZCBza2lwIGNsYXNzZXMgaGVyZSBiZWNhdXNlIHdlIGhhdmUgYSBzZXBhcmF0ZSBtZWNoYW5pc20gZm9yXG4gICAgICAgIC8vIG1hdGNoaW5nIGNsYXNzZXMgaW4gcHJvamVjdGlvbiBtb2RlLlxuICAgICAgICB3aGlsZSAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHZhbHVlID0gYXR0cnNbKytpXTtcbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH0gZWxzZSBpZiAobWF5YmVBdHRyTmFtZSA9PT0gQXR0cmlidXRlTWFya2VyLlRlbXBsYXRlKSB7XG4gICAgICAgIC8vIFdlIGRvIG5vdCBjYXJlIGFib3V0IFRlbXBsYXRlIGF0dHJpYnV0ZXMgaW4gdGhpcyBzY2VuYXJpby5cbiAgICAgICAgYnJlYWs7XG4gICAgICB9IGVsc2UgaWYgKG1heWJlQXR0ck5hbWUgPT09IEF0dHJpYnV0ZU1hcmtlci5OYW1lc3BhY2VVUkkpIHtcbiAgICAgICAgLy8gU2tpcCB0aGUgd2hvbGUgbmFtZXNwYWNlZCBhdHRyaWJ1dGUgYW5kIHZhbHVlLiBUaGlzIGlzIGJ5IGRlc2lnbi5cbiAgICAgICAgaSArPSA0O1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIEluIGJpbmRpbmcgbW9kZSB0aGVyZSBhcmUgb25seSBuYW1lcywgcmF0aGVyIHRoYW4gbmFtZS12YWx1ZSBwYWlycy5cbiAgICAgIGkgKz0gYmluZGluZ3NNb2RlID8gMSA6IDI7XG4gICAgfVxuICAgIC8vIFdlIGRpZCBub3QgbWF0Y2ggdGhlIGF0dHJpYnV0ZVxuICAgIHJldHVybiAtMTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbWF0Y2hUZW1wbGF0ZUF0dHJpYnV0ZShhdHRycywgbmFtZSk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTm9kZU1hdGNoaW5nU2VsZWN0b3JMaXN0KFxuICB0Tm9kZTogVE5vZGUsXG4gIHNlbGVjdG9yOiBDc3NTZWxlY3Rvckxpc3QsXG4gIGlzUHJvamVjdGlvbk1vZGU6IGJvb2xlYW4gPSBmYWxzZSxcbik6IGJvb2xlYW4ge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHNlbGVjdG9yLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGlzTm9kZU1hdGNoaW5nU2VsZWN0b3IodE5vZGUsIHNlbGVjdG9yW2ldLCBpc1Byb2plY3Rpb25Nb2RlKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UHJvamVjdEFzQXR0clZhbHVlKHROb2RlOiBUTm9kZSk6IENzc1NlbGVjdG9yIHwgbnVsbCB7XG4gIGNvbnN0IG5vZGVBdHRycyA9IHROb2RlLmF0dHJzO1xuICBpZiAobm9kZUF0dHJzICE9IG51bGwpIHtcbiAgICBjb25zdCBuZ1Byb2plY3RBc0F0dHJJZHggPSBub2RlQXR0cnMuaW5kZXhPZihBdHRyaWJ1dGVNYXJrZXIuUHJvamVjdEFzKTtcbiAgICAvLyBvbmx5IGNoZWNrIGZvciBuZ1Byb2plY3RBcyBpbiBhdHRyaWJ1dGUgbmFtZXMsIGRvbid0IGFjY2lkZW50YWxseSBtYXRjaCBhdHRyaWJ1dGUncyB2YWx1ZVxuICAgIC8vIChhdHRyaWJ1dGUgbmFtZXMgYXJlIHN0b3JlZCBhdCBldmVuIGluZGV4ZXMpXG4gICAgaWYgKChuZ1Byb2plY3RBc0F0dHJJZHggJiAxKSA9PT0gMCkge1xuICAgICAgcmV0dXJuIG5vZGVBdHRyc1tuZ1Byb2plY3RBc0F0dHJJZHggKyAxXSBhcyBDc3NTZWxlY3RvcjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGdldE5hbWVPbmx5TWFya2VySW5kZXgobm9kZUF0dHJzOiBUQXR0cmlidXRlcykge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVBdHRycy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IG5vZGVBdHRyID0gbm9kZUF0dHJzW2ldO1xuICAgIGlmIChpc05hbWVPbmx5QXR0cmlidXRlTWFya2VyKG5vZGVBdHRyKSkge1xuICAgICAgcmV0dXJuIGk7XG4gICAgfVxuICB9XG4gIHJldHVybiBub2RlQXR0cnMubGVuZ3RoO1xufVxuXG5mdW5jdGlvbiBtYXRjaFRlbXBsYXRlQXR0cmlidXRlKGF0dHJzOiBUQXR0cmlidXRlcywgbmFtZTogc3RyaW5nKTogbnVtYmVyIHtcbiAgbGV0IGkgPSBhdHRycy5pbmRleE9mKEF0dHJpYnV0ZU1hcmtlci5UZW1wbGF0ZSk7XG4gIGlmIChpID4gLTEpIHtcbiAgICBpKys7XG4gICAgd2hpbGUgKGkgPCBhdHRycy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGF0dHIgPSBhdHRyc1tpXTtcbiAgICAgIC8vIFJldHVybiBpbiBjYXNlIHdlIGNoZWNrZWQgYWxsIHRlbXBsYXRlIGF0dHJzIGFuZCBhcmUgc3dpdGNoaW5nIHRvIHRoZSBuZXh0IHNlY3Rpb24gaW4gdGhlXG4gICAgICAvLyBhdHRycyBhcnJheSAodGhhdCBzdGFydHMgd2l0aCBhIG51bWJlciB0aGF0IHJlcHJlc2VudHMgYW4gYXR0cmlidXRlIG1hcmtlcikuXG4gICAgICBpZiAodHlwZW9mIGF0dHIgPT09ICdudW1iZXInKSByZXR1cm4gLTE7XG4gICAgICBpZiAoYXR0ciA9PT0gbmFtZSkgcmV0dXJuIGk7XG4gICAgICBpKys7XG4gICAgfVxuICB9XG4gIHJldHVybiAtMTtcbn1cblxuLyoqXG4gKiBDaGVja3Mgd2hldGhlciBhIHNlbGVjdG9yIGlzIGluc2lkZSBhIENzc1NlbGVjdG9yTGlzdFxuICogQHBhcmFtIHNlbGVjdG9yIFNlbGVjdG9yIHRvIGJlIGNoZWNrZWQuXG4gKiBAcGFyYW0gbGlzdCBMaXN0IGluIHdoaWNoIHRvIGxvb2sgZm9yIHRoZSBzZWxlY3Rvci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzU2VsZWN0b3JJblNlbGVjdG9yTGlzdChzZWxlY3RvcjogQ3NzU2VsZWN0b3IsIGxpc3Q6IENzc1NlbGVjdG9yTGlzdCk6IGJvb2xlYW4ge1xuICBzZWxlY3Rvckxpc3RMb29wOiBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjdXJyZW50U2VsZWN0b3JJbkxpc3QgPSBsaXN0W2ldO1xuICAgIGlmIChzZWxlY3Rvci5sZW5ndGggIT09IGN1cnJlbnRTZWxlY3RvckluTGlzdC5sZW5ndGgpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBmb3IgKGxldCBqID0gMDsgaiA8IHNlbGVjdG9yLmxlbmd0aDsgaisrKSB7XG4gICAgICBpZiAoc2VsZWN0b3Jbal0gIT09IGN1cnJlbnRTZWxlY3RvckluTGlzdFtqXSkge1xuICAgICAgICBjb250aW51ZSBzZWxlY3Rvckxpc3RMb29wO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIG1heWJlV3JhcEluTm90U2VsZWN0b3IoaXNOZWdhdGl2ZU1vZGU6IGJvb2xlYW4sIGNodW5rOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gaXNOZWdhdGl2ZU1vZGUgPyAnOm5vdCgnICsgY2h1bmsudHJpbSgpICsgJyknIDogY2h1bms7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeUNTU1NlbGVjdG9yKHNlbGVjdG9yOiBDc3NTZWxlY3Rvcik6IHN0cmluZyB7XG4gIGxldCByZXN1bHQgPSBzZWxlY3RvclswXSBhcyBzdHJpbmc7XG4gIGxldCBpID0gMTtcbiAgbGV0IG1vZGUgPSBTZWxlY3RvckZsYWdzLkFUVFJJQlVURTtcbiAgbGV0IGN1cnJlbnRDaHVuayA9ICcnO1xuICBsZXQgaXNOZWdhdGl2ZU1vZGUgPSBmYWxzZTtcbiAgd2hpbGUgKGkgPCBzZWxlY3Rvci5sZW5ndGgpIHtcbiAgICBsZXQgdmFsdWVPck1hcmtlciA9IHNlbGVjdG9yW2ldO1xuICAgIGlmICh0eXBlb2YgdmFsdWVPck1hcmtlciA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGlmIChtb2RlICYgU2VsZWN0b3JGbGFncy5BVFRSSUJVVEUpIHtcbiAgICAgICAgY29uc3QgYXR0clZhbHVlID0gc2VsZWN0b3JbKytpXSBhcyBzdHJpbmc7XG4gICAgICAgIGN1cnJlbnRDaHVuayArPVxuICAgICAgICAgICdbJyArIHZhbHVlT3JNYXJrZXIgKyAoYXR0clZhbHVlLmxlbmd0aCA+IDAgPyAnPVwiJyArIGF0dHJWYWx1ZSArICdcIicgOiAnJykgKyAnXSc7XG4gICAgICB9IGVsc2UgaWYgKG1vZGUgJiBTZWxlY3RvckZsYWdzLkNMQVNTKSB7XG4gICAgICAgIGN1cnJlbnRDaHVuayArPSAnLicgKyB2YWx1ZU9yTWFya2VyO1xuICAgICAgfSBlbHNlIGlmIChtb2RlICYgU2VsZWN0b3JGbGFncy5FTEVNRU5UKSB7XG4gICAgICAgIGN1cnJlbnRDaHVuayArPSAnICcgKyB2YWx1ZU9yTWFya2VyO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvL1xuICAgICAgLy8gQXBwZW5kIGN1cnJlbnQgY2h1bmsgdG8gdGhlIGZpbmFsIHJlc3VsdCBpbiBjYXNlIHdlIGNvbWUgYWNyb3NzIFNlbGVjdG9yRmxhZywgd2hpY2hcbiAgICAgIC8vIGluZGljYXRlcyB0aGF0IHRoZSBwcmV2aW91cyBzZWN0aW9uIG9mIGEgc2VsZWN0b3IgaXMgb3Zlci4gV2UgbmVlZCB0byBhY2N1bXVsYXRlIGNvbnRlbnRcbiAgICAgIC8vIGJldHdlZW4gZmxhZ3MgdG8gbWFrZSBzdXJlIHdlIHdyYXAgdGhlIGNodW5rIGxhdGVyIGluIDpub3QoKSBzZWxlY3RvciBpZiBuZWVkZWQsIGUuZy5cbiAgICAgIC8vIGBgYFxuICAgICAgLy8gIFsnJywgRmxhZ3MuQ0xBU1MsICcuY2xhc3NBJywgRmxhZ3MuQ0xBU1MgfCBGbGFncy5OT1QsICcuY2xhc3NCJywgJy5jbGFzc0MnXVxuICAgICAgLy8gYGBgXG4gICAgICAvLyBzaG91bGQgYmUgdHJhbnNmb3JtZWQgdG8gYC5jbGFzc0EgOm5vdCguY2xhc3NCIC5jbGFzc0MpYC5cbiAgICAgIC8vXG4gICAgICAvLyBOb3RlOiBmb3IgbmVnYXRpdmUgc2VsZWN0b3IgcGFydCwgd2UgYWNjdW11bGF0ZSBjb250ZW50IGJldHdlZW4gZmxhZ3MgdW50aWwgd2UgZmluZCB0aGVcbiAgICAgIC8vIG5leHQgbmVnYXRpdmUgZmxhZy4gVGhpcyBpcyBuZWVkZWQgdG8gc3VwcG9ydCBhIGNhc2Ugd2hlcmUgYDpub3QoKWAgcnVsZSBjb250YWlucyBtb3JlIHRoYW5cbiAgICAgIC8vIG9uZSBjaHVuaywgZS5nLiB0aGUgZm9sbG93aW5nIHNlbGVjdG9yOlxuICAgICAgLy8gYGBgXG4gICAgICAvLyAgWycnLCBGbGFncy5FTEVNRU5UIHwgRmxhZ3MuTk9ULCAncCcsIEZsYWdzLkNMQVNTLCAnZm9vJywgRmxhZ3MuQ0xBU1MgfCBGbGFncy5OT1QsICdiYXInXVxuICAgICAgLy8gYGBgXG4gICAgICAvLyBzaG91bGQgYmUgc3RyaW5naWZpZWQgdG8gYDpub3QocC5mb28pIDpub3QoLmJhcilgXG4gICAgICAvL1xuICAgICAgaWYgKGN1cnJlbnRDaHVuayAhPT0gJycgJiYgIWlzUG9zaXRpdmUodmFsdWVPck1hcmtlcikpIHtcbiAgICAgICAgcmVzdWx0ICs9IG1heWJlV3JhcEluTm90U2VsZWN0b3IoaXNOZWdhdGl2ZU1vZGUsIGN1cnJlbnRDaHVuayk7XG4gICAgICAgIGN1cnJlbnRDaHVuayA9ICcnO1xuICAgICAgfVxuICAgICAgbW9kZSA9IHZhbHVlT3JNYXJrZXI7XG4gICAgICAvLyBBY2NvcmRpbmcgdG8gQ3NzU2VsZWN0b3Igc3BlYywgb25jZSB3ZSBjb21lIGFjcm9zcyBgU2VsZWN0b3JGbGFncy5OT1RgIGZsYWcsIHRoZSBuZWdhdGl2ZVxuICAgICAgLy8gbW9kZSBpcyBtYWludGFpbmVkIGZvciByZW1haW5pbmcgY2h1bmtzIG9mIGEgc2VsZWN0b3IuXG4gICAgICBpc05lZ2F0aXZlTW9kZSA9IGlzTmVnYXRpdmVNb2RlIHx8ICFpc1Bvc2l0aXZlKG1vZGUpO1xuICAgIH1cbiAgICBpKys7XG4gIH1cbiAgaWYgKGN1cnJlbnRDaHVuayAhPT0gJycpIHtcbiAgICByZXN1bHQgKz0gbWF5YmVXcmFwSW5Ob3RTZWxlY3Rvcihpc05lZ2F0aXZlTW9kZSwgY3VycmVudENodW5rKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIEdlbmVyYXRlcyBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgQ1NTIHNlbGVjdG9yIGluIHBhcnNlZCBmb3JtLlxuICpcbiAqIENvbXBvbmVudERlZiBhbmQgRGlyZWN0aXZlRGVmIGFyZSBnZW5lcmF0ZWQgd2l0aCB0aGUgc2VsZWN0b3IgaW4gcGFyc2VkIGZvcm0gdG8gYXZvaWQgZG9pbmdcbiAqIGFkZGl0aW9uYWwgcGFyc2luZyBhdCBydW50aW1lIChmb3IgZXhhbXBsZSwgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZykuIEhvd2V2ZXIgaW4gc29tZSBjYXNlcyAoZm9yXG4gKiBleGFtcGxlLCB3aGlsZSBib290c3RyYXBwaW5nIGEgY29tcG9uZW50KSwgYSBzdHJpbmcgdmVyc2lvbiBvZiB0aGUgc2VsZWN0b3IgaXMgcmVxdWlyZWQgdG8gcXVlcnlcbiAqIGZvciB0aGUgaG9zdCBlbGVtZW50IG9uIHRoZSBwYWdlLiBUaGlzIGZ1bmN0aW9uIHRha2VzIHRoZSBwYXJzZWQgZm9ybSBvZiBhIHNlbGVjdG9yIGFuZCByZXR1cm5zXG4gKiBpdHMgc3RyaW5nIHJlcHJlc2VudGF0aW9uLlxuICpcbiAqIEBwYXJhbSBzZWxlY3Rvckxpc3Qgc2VsZWN0b3IgaW4gcGFyc2VkIGZvcm1cbiAqIEByZXR1cm5zIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiBhIGdpdmVuIHNlbGVjdG9yXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdHJpbmdpZnlDU1NTZWxlY3Rvckxpc3Qoc2VsZWN0b3JMaXN0OiBDc3NTZWxlY3Rvckxpc3QpOiBzdHJpbmcge1xuICByZXR1cm4gc2VsZWN0b3JMaXN0Lm1hcChzdHJpbmdpZnlDU1NTZWxlY3Rvcikuam9pbignLCcpO1xufVxuXG4vKipcbiAqIEV4dHJhY3RzIGF0dHJpYnV0ZXMgYW5kIGNsYXNzZXMgaW5mb3JtYXRpb24gZnJvbSBhIGdpdmVuIENTUyBzZWxlY3Rvci5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgd2hpbGUgY3JlYXRpbmcgYSBjb21wb25lbnQgZHluYW1pY2FsbHkuIEluIHRoaXMgY2FzZSwgdGhlIGhvc3QgZWxlbWVudFxuICogKHRoYXQgaXMgY3JlYXRlZCBkeW5hbWljYWxseSkgc2hvdWxkIGNvbnRhaW4gYXR0cmlidXRlcyBhbmQgY2xhc3NlcyBzcGVjaWZpZWQgaW4gY29tcG9uZW50J3MgQ1NTXG4gKiBzZWxlY3Rvci5cbiAqXG4gKiBAcGFyYW0gc2VsZWN0b3IgQ1NTIHNlbGVjdG9yIGluIHBhcnNlZCBmb3JtIChpbiBhIGZvcm0gb2YgYXJyYXkpXG4gKiBAcmV0dXJucyBvYmplY3Qgd2l0aCBgYXR0cnNgIGFuZCBgY2xhc3Nlc2AgZmllbGRzIHRoYXQgY29udGFpbiBleHRyYWN0ZWQgaW5mb3JtYXRpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RBdHRyc0FuZENsYXNzZXNGcm9tU2VsZWN0b3Ioc2VsZWN0b3I6IENzc1NlbGVjdG9yKToge1xuICBhdHRyczogc3RyaW5nW107XG4gIGNsYXNzZXM6IHN0cmluZ1tdO1xufSB7XG4gIGNvbnN0IGF0dHJzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBjbGFzc2VzOiBzdHJpbmdbXSA9IFtdO1xuICBsZXQgaSA9IDE7XG4gIGxldCBtb2RlID0gU2VsZWN0b3JGbGFncy5BVFRSSUJVVEU7XG4gIHdoaWxlIChpIDwgc2VsZWN0b3IubGVuZ3RoKSB7XG4gICAgbGV0IHZhbHVlT3JNYXJrZXIgPSBzZWxlY3RvcltpXTtcbiAgICBpZiAodHlwZW9mIHZhbHVlT3JNYXJrZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICBpZiAobW9kZSA9PT0gU2VsZWN0b3JGbGFncy5BVFRSSUJVVEUpIHtcbiAgICAgICAgaWYgKHZhbHVlT3JNYXJrZXIgIT09ICcnKSB7XG4gICAgICAgICAgYXR0cnMucHVzaCh2YWx1ZU9yTWFya2VyLCBzZWxlY3RvclsrK2ldIGFzIHN0cmluZyk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAobW9kZSA9PT0gU2VsZWN0b3JGbGFncy5DTEFTUykge1xuICAgICAgICBjbGFzc2VzLnB1c2godmFsdWVPck1hcmtlcik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEFjY29yZGluZyB0byBDc3NTZWxlY3RvciBzcGVjLCBvbmNlIHdlIGNvbWUgYWNyb3NzIGBTZWxlY3RvckZsYWdzLk5PVGAgZmxhZywgdGhlIG5lZ2F0aXZlXG4gICAgICAvLyBtb2RlIGlzIG1haW50YWluZWQgZm9yIHJlbWFpbmluZyBjaHVua3Mgb2YgYSBzZWxlY3Rvci4gU2luY2UgYXR0cmlidXRlcyBhbmQgY2xhc3NlcyBhcmVcbiAgICAgIC8vIGV4dHJhY3RlZCBvbmx5IGZvciBcInBvc2l0aXZlXCIgcGFydCBvZiB0aGUgc2VsZWN0b3IsIHdlIGNhbiBzdG9wIGhlcmUuXG4gICAgICBpZiAoIWlzUG9zaXRpdmUobW9kZSkpIGJyZWFrO1xuICAgICAgbW9kZSA9IHZhbHVlT3JNYXJrZXI7XG4gICAgfVxuICAgIGkrKztcbiAgfVxuICByZXR1cm4ge2F0dHJzLCBjbGFzc2VzfTtcbn1cbiJdfQ==