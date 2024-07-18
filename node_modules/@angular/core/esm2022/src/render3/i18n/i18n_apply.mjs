/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { RuntimeError } from '../../errors';
import { claimDehydratedIcuCase, isI18nHydrationSupportEnabled } from '../../hydration/i18n';
import { locateI18nRNodeByIndex } from '../../hydration/node_lookup_utils';
import { isDisconnectedNode, markRNodeAsClaimedByHydration } from '../../hydration/utils';
import { getPluralCase } from '../../i18n/localization';
import { assertDefined, assertDomNode, assertEqual, assertGreaterThan, assertIndexInRange, throwError, } from '../../util/assert';
import { assertIndexInExpandoRange, assertTIcu } from '../assert';
import { attachPatchData } from '../context_discovery';
import { elementPropertyInternal, setElementAttribute } from '../instructions/shared';
import { ELEMENT_MARKER, I18nCreateOpCode, ICU_MARKER, } from '../interfaces/i18n';
import { HEADER_OFFSET, HYDRATION, RENDERER } from '../interfaces/view';
import { createCommentNode, createElementNode, createTextNode, nativeInsertBefore, nativeParentNode, nativeRemoveNode, updateTextNode, } from '../node_manipulation';
import { getBindingIndex, isInSkipHydrationBlock, lastNodeWasCreated, wasLastNodeCreated, } from '../state';
import { renderStringify } from '../util/stringify_utils';
import { getNativeByIndex, unwrapRNode } from '../util/view_utils';
import { getLocaleId } from './i18n_locale_id';
import { getCurrentICUCaseIndex, getParentFromIcuCreateOpCode, getRefFromIcuCreateOpCode, getTIcu, } from './i18n_util';
/**
 * Keep track of which input bindings in `ɵɵi18nExp` have changed.
 *
 * This is used to efficiently update expressions in i18n only when the corresponding input has
 * changed.
 *
 * 1) Each bit represents which of the `ɵɵi18nExp` has changed.
 * 2) There are 32 bits allowed in JS.
 * 3) Bit 32 is special as it is shared for all changes past 32. (In other words if you have more
 * than 32 `ɵɵi18nExp` then all changes past 32nd `ɵɵi18nExp` will be mapped to same bit. This means
 * that we may end up changing more than we need to. But i18n expressions with 32 bindings is rare
 * so in practice it should not be an issue.)
 */
let changeMask = 0b0;
/**
 * Keeps track of which bit needs to be updated in `changeMask`
 *
 * This value gets incremented on every call to `ɵɵi18nExp`
 */
let changeMaskCounter = 0;
/**
 * Keep track of which input bindings in `ɵɵi18nExp` have changed.
 *
 * `setMaskBit` gets invoked by each call to `ɵɵi18nExp`.
 *
 * @param hasChange did `ɵɵi18nExp` detect a change.
 */
export function setMaskBit(hasChange) {
    if (hasChange) {
        changeMask = changeMask | (1 << Math.min(changeMaskCounter, 31));
    }
    changeMaskCounter++;
}
export function applyI18n(tView, lView, index) {
    if (changeMaskCounter > 0) {
        ngDevMode && assertDefined(tView, `tView should be defined`);
        const tI18n = tView.data[index];
        // When `index` points to an `ɵɵi18nAttributes` then we have an array otherwise `TI18n`
        const updateOpCodes = Array.isArray(tI18n)
            ? tI18n
            : tI18n.update;
        const bindingsStartIndex = getBindingIndex() - changeMaskCounter - 1;
        applyUpdateOpCodes(tView, lView, updateOpCodes, bindingsStartIndex, changeMask);
    }
    // Reset changeMask & maskBit to default for the next update cycle
    changeMask = 0b0;
    changeMaskCounter = 0;
}
function createNodeWithoutHydration(lView, textOrName, nodeType) {
    const renderer = lView[RENDERER];
    switch (nodeType) {
        case Node.COMMENT_NODE:
            return createCommentNode(renderer, textOrName);
        case Node.TEXT_NODE:
            return createTextNode(renderer, textOrName);
        case Node.ELEMENT_NODE:
            return createElementNode(renderer, textOrName, null);
    }
}
let _locateOrCreateNode = (lView, index, textOrName, nodeType) => {
    lastNodeWasCreated(true);
    return createNodeWithoutHydration(lView, textOrName, nodeType);
};
function locateOrCreateNodeImpl(lView, index, textOrName, nodeType) {
    const hydrationInfo = lView[HYDRATION];
    const noOffsetIndex = index - HEADER_OFFSET;
    const isNodeCreationMode = !isI18nHydrationSupportEnabled() ||
        !hydrationInfo ||
        isInSkipHydrationBlock() ||
        isDisconnectedNode(hydrationInfo, noOffsetIndex);
    lastNodeWasCreated(isNodeCreationMode);
    if (isNodeCreationMode) {
        return createNodeWithoutHydration(lView, textOrName, nodeType);
    }
    const native = locateI18nRNodeByIndex(hydrationInfo, noOffsetIndex);
    // TODO: Improve error handling
    //
    // Other hydration paths use validateMatchingNode() in order to provide
    // detailed information in development mode about the expected DOM.
    // However, not every node in an i18n block has a TNode. Instead, we
    // need to be able to use the AST to generate a similar message.
    ngDevMode && assertDefined(native, 'expected native element');
    ngDevMode && assertEqual(native.nodeType, nodeType, 'expected matching nodeType');
    ngDevMode &&
        nodeType === Node.ELEMENT_NODE &&
        assertEqual(native.tagName.toLowerCase(), textOrName.toLowerCase(), 'expecting matching tagName');
    ngDevMode && markRNodeAsClaimedByHydration(native);
    return native;
}
export function enableLocateOrCreateI18nNodeImpl() {
    _locateOrCreateNode = locateOrCreateNodeImpl;
}
/**
 * Apply `I18nCreateOpCodes` op-codes as stored in `TI18n.create`.
 *
 * Creates text (and comment) nodes which are internationalized.
 *
 * @param lView Current lView
 * @param createOpCodes Set of op-codes to apply
 * @param parentRNode Parent node (so that direct children can be added eagerly) or `null` if it is
 *     a root node.
 * @param insertInFrontOf DOM node that should be used as an anchor.
 */
export function applyCreateOpCodes(lView, createOpCodes, parentRNode, insertInFrontOf) {
    const renderer = lView[RENDERER];
    for (let i = 0; i < createOpCodes.length; i++) {
        const opCode = createOpCodes[i++];
        const text = createOpCodes[i];
        const isComment = (opCode & I18nCreateOpCode.COMMENT) === I18nCreateOpCode.COMMENT;
        const appendNow = (opCode & I18nCreateOpCode.APPEND_EAGERLY) === I18nCreateOpCode.APPEND_EAGERLY;
        const index = opCode >>> I18nCreateOpCode.SHIFT;
        let rNode = lView[index];
        let lastNodeWasCreated = false;
        if (rNode === null) {
            // We only create new DOM nodes if they don't already exist: If ICU switches case back to a
            // case which was already instantiated, no need to create new DOM nodes.
            rNode = lView[index] = _locateOrCreateNode(lView, index, text, isComment ? Node.COMMENT_NODE : Node.TEXT_NODE);
            lastNodeWasCreated = wasLastNodeCreated();
        }
        if (appendNow && parentRNode !== null && lastNodeWasCreated) {
            nativeInsertBefore(renderer, parentRNode, rNode, insertInFrontOf, false);
        }
    }
}
/**
 * Apply `I18nMutateOpCodes` OpCodes.
 *
 * @param tView Current `TView`
 * @param mutableOpCodes Mutable OpCodes to process
 * @param lView Current `LView`
 * @param anchorRNode place where the i18n node should be inserted.
 */
export function applyMutableOpCodes(tView, mutableOpCodes, lView, anchorRNode) {
    ngDevMode && assertDomNode(anchorRNode);
    const renderer = lView[RENDERER];
    // `rootIdx` represents the node into which all inserts happen.
    let rootIdx = null;
    // `rootRNode` represents the real node into which we insert. This can be different from
    // `lView[rootIdx]` if we have projection.
    //  - null we don't have a parent (as can be the case in when we are inserting into a root of
    //    LView which has no parent.)
    //  - `RElement` The element representing the root after taking projection into account.
    let rootRNode;
    for (let i = 0; i < mutableOpCodes.length; i++) {
        const opCode = mutableOpCodes[i];
        if (typeof opCode == 'string') {
            const textNodeIndex = mutableOpCodes[++i];
            if (lView[textNodeIndex] === null) {
                ngDevMode && ngDevMode.rendererCreateTextNode++;
                ngDevMode && assertIndexInRange(lView, textNodeIndex);
                lView[textNodeIndex] = _locateOrCreateNode(lView, textNodeIndex, opCode, Node.TEXT_NODE);
            }
        }
        else if (typeof opCode == 'number') {
            switch (opCode & 1 /* IcuCreateOpCode.MASK_INSTRUCTION */) {
                case 0 /* IcuCreateOpCode.AppendChild */:
                    const parentIdx = getParentFromIcuCreateOpCode(opCode);
                    if (rootIdx === null) {
                        // The first operation should save the `rootIdx` because the first operation
                        // must insert into the root. (Only subsequent operations can insert into a dynamic
                        // parent)
                        rootIdx = parentIdx;
                        rootRNode = nativeParentNode(renderer, anchorRNode);
                    }
                    let insertInFrontOf;
                    let parentRNode;
                    if (parentIdx === rootIdx) {
                        insertInFrontOf = anchorRNode;
                        parentRNode = rootRNode;
                    }
                    else {
                        insertInFrontOf = null;
                        parentRNode = unwrapRNode(lView[parentIdx]);
                    }
                    // FIXME(misko): Refactor with `processI18nText`
                    if (parentRNode !== null) {
                        // This can happen if the `LView` we are adding to is not attached to a parent `LView`.
                        // In such a case there is no "root" we can attach to. This is fine, as we still need to
                        // create the elements. When the `LView` gets later added to a parent these "root" nodes
                        // get picked up and added.
                        ngDevMode && assertDomNode(parentRNode);
                        const refIdx = getRefFromIcuCreateOpCode(opCode);
                        ngDevMode && assertGreaterThan(refIdx, HEADER_OFFSET, 'Missing ref');
                        // `unwrapRNode` is not needed here as all of these point to RNodes as part of the i18n
                        // which can't have components.
                        const child = lView[refIdx];
                        ngDevMode && assertDomNode(child);
                        nativeInsertBefore(renderer, parentRNode, child, insertInFrontOf, false);
                        const tIcu = getTIcu(tView, refIdx);
                        if (tIcu !== null && typeof tIcu === 'object') {
                            // If we just added a comment node which has ICU then that ICU may have already been
                            // rendered and therefore we need to re-add it here.
                            ngDevMode && assertTIcu(tIcu);
                            const caseIndex = getCurrentICUCaseIndex(tIcu, lView);
                            if (caseIndex !== null) {
                                applyMutableOpCodes(tView, tIcu.create[caseIndex], lView, lView[tIcu.anchorIdx]);
                            }
                        }
                    }
                    break;
                case 1 /* IcuCreateOpCode.Attr */:
                    const elementNodeIndex = opCode >>> 1 /* IcuCreateOpCode.SHIFT_REF */;
                    const attrName = mutableOpCodes[++i];
                    const attrValue = mutableOpCodes[++i];
                    // This code is used for ICU expressions only, since we don't support
                    // directives/components in ICUs, we don't need to worry about inputs here
                    setElementAttribute(renderer, getNativeByIndex(elementNodeIndex, lView), null, null, attrName, attrValue, null);
                    break;
                default:
                    if (ngDevMode) {
                        throw new RuntimeError(700 /* RuntimeErrorCode.INVALID_I18N_STRUCTURE */, `Unable to determine the type of mutate operation for "${opCode}"`);
                    }
            }
        }
        else {
            switch (opCode) {
                case ICU_MARKER:
                    const commentValue = mutableOpCodes[++i];
                    const commentNodeIndex = mutableOpCodes[++i];
                    if (lView[commentNodeIndex] === null) {
                        ngDevMode &&
                            assertEqual(typeof commentValue, 'string', `Expected "${commentValue}" to be a comment node value`);
                        ngDevMode && ngDevMode.rendererCreateComment++;
                        ngDevMode && assertIndexInExpandoRange(lView, commentNodeIndex);
                        const commentRNode = (lView[commentNodeIndex] = _locateOrCreateNode(lView, commentNodeIndex, commentValue, Node.COMMENT_NODE));
                        // FIXME(misko): Attaching patch data is only needed for the root (Also add tests)
                        attachPatchData(commentRNode, lView);
                    }
                    break;
                case ELEMENT_MARKER:
                    const tagName = mutableOpCodes[++i];
                    const elementNodeIndex = mutableOpCodes[++i];
                    if (lView[elementNodeIndex] === null) {
                        ngDevMode &&
                            assertEqual(typeof tagName, 'string', `Expected "${tagName}" to be an element node tag name`);
                        ngDevMode && ngDevMode.rendererCreateElement++;
                        ngDevMode && assertIndexInExpandoRange(lView, elementNodeIndex);
                        const elementRNode = (lView[elementNodeIndex] = _locateOrCreateNode(lView, elementNodeIndex, tagName, Node.ELEMENT_NODE));
                        // FIXME(misko): Attaching patch data is only needed for the root (Also add tests)
                        attachPatchData(elementRNode, lView);
                    }
                    break;
                default:
                    ngDevMode &&
                        throwError(`Unable to determine the type of mutate operation for "${opCode}"`);
            }
        }
    }
}
/**
 * Apply `I18nUpdateOpCodes` OpCodes
 *
 * @param tView Current `TView`
 * @param lView Current `LView`
 * @param updateOpCodes OpCodes to process
 * @param bindingsStartIndex Location of the first `ɵɵi18nApply`
 * @param changeMask Each bit corresponds to a `ɵɵi18nExp` (Counting backwards from
 *     `bindingsStartIndex`)
 */
export function applyUpdateOpCodes(tView, lView, updateOpCodes, bindingsStartIndex, changeMask) {
    for (let i = 0; i < updateOpCodes.length; i++) {
        // bit code to check if we should apply the next update
        const checkBit = updateOpCodes[i];
        // Number of opCodes to skip until next set of update codes
        const skipCodes = updateOpCodes[++i];
        if (checkBit & changeMask) {
            // The value has been updated since last checked
            let value = '';
            for (let j = i + 1; j <= i + skipCodes; j++) {
                const opCode = updateOpCodes[j];
                if (typeof opCode == 'string') {
                    value += opCode;
                }
                else if (typeof opCode == 'number') {
                    if (opCode < 0) {
                        // Negative opCode represent `i18nExp` values offset.
                        value += renderStringify(lView[bindingsStartIndex - opCode]);
                    }
                    else {
                        const nodeIndex = opCode >>> 2 /* I18nUpdateOpCode.SHIFT_REF */;
                        switch (opCode & 3 /* I18nUpdateOpCode.MASK_OPCODE */) {
                            case 1 /* I18nUpdateOpCode.Attr */:
                                const propName = updateOpCodes[++j];
                                const sanitizeFn = updateOpCodes[++j];
                                const tNodeOrTagName = tView.data[nodeIndex];
                                ngDevMode && assertDefined(tNodeOrTagName, 'Experting TNode or string');
                                if (typeof tNodeOrTagName === 'string') {
                                    // IF we don't have a `TNode`, then we are an element in ICU (as ICU content does
                                    // not have TNode), in which case we know that there are no directives, and hence
                                    // we use attribute setting.
                                    setElementAttribute(lView[RENDERER], lView[nodeIndex], null, tNodeOrTagName, propName, value, sanitizeFn);
                                }
                                else {
                                    elementPropertyInternal(tView, tNodeOrTagName, lView, propName, value, lView[RENDERER], sanitizeFn, false);
                                }
                                break;
                            case 0 /* I18nUpdateOpCode.Text */:
                                const rText = lView[nodeIndex];
                                rText !== null && updateTextNode(lView[RENDERER], rText, value);
                                break;
                            case 2 /* I18nUpdateOpCode.IcuSwitch */:
                                applyIcuSwitchCase(tView, getTIcu(tView, nodeIndex), lView, value);
                                break;
                            case 3 /* I18nUpdateOpCode.IcuUpdate */:
                                applyIcuUpdateCase(tView, getTIcu(tView, nodeIndex), bindingsStartIndex, lView);
                                break;
                        }
                    }
                }
            }
        }
        else {
            const opCode = updateOpCodes[i + 1];
            if (opCode > 0 && (opCode & 3 /* I18nUpdateOpCode.MASK_OPCODE */) === 3 /* I18nUpdateOpCode.IcuUpdate */) {
                // Special case for the `icuUpdateCase`. It could be that the mask did not match, but
                // we still need to execute `icuUpdateCase` because the case has changed recently due to
                // previous `icuSwitchCase` instruction. (`icuSwitchCase` and `icuUpdateCase` always come in
                // pairs.)
                const nodeIndex = opCode >>> 2 /* I18nUpdateOpCode.SHIFT_REF */;
                const tIcu = getTIcu(tView, nodeIndex);
                const currentIndex = lView[tIcu.currentCaseLViewIndex];
                if (currentIndex < 0) {
                    applyIcuUpdateCase(tView, tIcu, bindingsStartIndex, lView);
                }
            }
        }
        i += skipCodes;
    }
}
/**
 * Apply OpCodes associated with updating an existing ICU.
 *
 * @param tView Current `TView`
 * @param tIcu Current `TIcu`
 * @param bindingsStartIndex Location of the first `ɵɵi18nApply`
 * @param lView Current `LView`
 */
function applyIcuUpdateCase(tView, tIcu, bindingsStartIndex, lView) {
    ngDevMode && assertIndexInRange(lView, tIcu.currentCaseLViewIndex);
    let activeCaseIndex = lView[tIcu.currentCaseLViewIndex];
    if (activeCaseIndex !== null) {
        let mask = changeMask;
        if (activeCaseIndex < 0) {
            // Clear the flag.
            // Negative number means that the ICU was freshly created and we need to force the update.
            activeCaseIndex = lView[tIcu.currentCaseLViewIndex] = ~activeCaseIndex;
            // -1 is same as all bits on, which simulates creation since it marks all bits dirty
            mask = -1;
        }
        applyUpdateOpCodes(tView, lView, tIcu.update[activeCaseIndex], bindingsStartIndex, mask);
    }
}
/**
 * Apply OpCodes associated with switching a case on ICU.
 *
 * This involves tearing down existing case and than building up a new case.
 *
 * @param tView Current `TView`
 * @param tIcu Current `TIcu`
 * @param lView Current `LView`
 * @param value Value of the case to update to.
 */
function applyIcuSwitchCase(tView, tIcu, lView, value) {
    // Rebuild a new case for this ICU
    const caseIndex = getCaseIndex(tIcu, value);
    let activeCaseIndex = getCurrentICUCaseIndex(tIcu, lView);
    if (activeCaseIndex !== caseIndex) {
        applyIcuSwitchCaseRemove(tView, tIcu, lView);
        lView[tIcu.currentCaseLViewIndex] = caseIndex === null ? null : ~caseIndex;
        if (caseIndex !== null) {
            // Add the nodes for the new case
            const anchorRNode = lView[tIcu.anchorIdx];
            if (anchorRNode) {
                ngDevMode && assertDomNode(anchorRNode);
                applyMutableOpCodes(tView, tIcu.create[caseIndex], lView, anchorRNode);
            }
            claimDehydratedIcuCase(lView, tIcu.anchorIdx, caseIndex);
        }
    }
}
/**
 * Apply OpCodes associated with tearing ICU case.
 *
 * This involves tearing down existing case and than building up a new case.
 *
 * @param tView Current `TView`
 * @param tIcu Current `TIcu`
 * @param lView Current `LView`
 */
function applyIcuSwitchCaseRemove(tView, tIcu, lView) {
    let activeCaseIndex = getCurrentICUCaseIndex(tIcu, lView);
    if (activeCaseIndex !== null) {
        const removeCodes = tIcu.remove[activeCaseIndex];
        for (let i = 0; i < removeCodes.length; i++) {
            const nodeOrIcuIndex = removeCodes[i];
            if (nodeOrIcuIndex > 0) {
                // Positive numbers are `RNode`s.
                const rNode = getNativeByIndex(nodeOrIcuIndex, lView);
                rNode !== null && nativeRemoveNode(lView[RENDERER], rNode);
            }
            else {
                // Negative numbers are ICUs
                applyIcuSwitchCaseRemove(tView, getTIcu(tView, ~nodeOrIcuIndex), lView);
            }
        }
    }
}
/**
 * Returns the index of the current case of an ICU expression depending on the main binding value
 *
 * @param icuExpression
 * @param bindingValue The value of the main binding used by this ICU expression
 */
function getCaseIndex(icuExpression, bindingValue) {
    let index = icuExpression.cases.indexOf(bindingValue);
    if (index === -1) {
        switch (icuExpression.type) {
            case 1 /* IcuType.plural */: {
                const resolvedCase = getPluralCase(bindingValue, getLocaleId());
                index = icuExpression.cases.indexOf(resolvedCase);
                if (index === -1 && resolvedCase !== 'other') {
                    index = icuExpression.cases.indexOf('other');
                }
                break;
            }
            case 0 /* IcuType.select */: {
                index = icuExpression.cases.indexOf('other');
                break;
            }
        }
    }
    return index === -1 ? null : index;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9hcHBseS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3JlbmRlcjMvaTE4bi9pMThuX2FwcGx5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxZQUFZLEVBQW1CLE1BQU0sY0FBYyxDQUFDO0FBQzVELE9BQU8sRUFBQyxzQkFBc0IsRUFBRSw2QkFBNkIsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQzNGLE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLG1DQUFtQyxDQUFDO0FBQ3pFLE9BQU8sRUFBQyxrQkFBa0IsRUFBRSw2QkFBNkIsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ3hGLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RCxPQUFPLEVBQ0wsYUFBYSxFQUNiLGFBQWEsRUFDYixXQUFXLEVBQ1gsaUJBQWlCLEVBQ2pCLGtCQUFrQixFQUNsQixVQUFVLEdBQ1gsTUFBTSxtQkFBbUIsQ0FBQztBQUMzQixPQUFPLEVBQUMseUJBQXlCLEVBQUUsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ2hFLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUNyRCxPQUFPLEVBQUMsdUJBQXVCLEVBQUUsbUJBQW1CLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNwRixPQUFPLEVBQ0wsY0FBYyxFQUNkLGdCQUFnQixFQUloQixVQUFVLEdBTVgsTUFBTSxvQkFBb0IsQ0FBQztBQUk1QixPQUFPLEVBQUMsYUFBYSxFQUFFLFNBQVMsRUFBUyxRQUFRLEVBQVEsTUFBTSxvQkFBb0IsQ0FBQztBQUNwRixPQUFPLEVBQ0wsaUJBQWlCLEVBQ2pCLGlCQUFpQixFQUNqQixjQUFjLEVBQ2Qsa0JBQWtCLEVBQ2xCLGdCQUFnQixFQUNoQixnQkFBZ0IsRUFDaEIsY0FBYyxHQUNmLE1B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QUNwQixLQUFLLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQzdDLE1BQU07WUFDUixDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDckMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1J1bnRpbWVFcnJvciwgUnVudGltZUVycm9yQ29kZX0gZnJvbSAnLi4vLi4vZXJyb3JzJztcbmltcG9ydCB7Y2xhaW1EZWh5ZHJhdGVkSWN1Q2FzZSwgaXNJMThuSHlkcmF0aW9uU3VwcG9ydEVuYWJsZWR9IGZyb20gJy4uLy4uL2h5ZHJhdGlvbi9pMThuJztcbmltcG9ydCB7bG9jYXRlSTE4blJOb2RlQnlJbmRleH0gZnJvbSAnLi4vLi4vaHlkcmF0aW9uL25vZGVfbG9va3VwX3V0aWxzJztcbmltcG9ydCB7aXNEaXNjb25uZWN0ZWROb2RlLCBtYXJrUk5vZGVBc0NsYWltZWRCeUh5ZHJhdGlvbn0gZnJvbSAnLi4vLi4vaHlkcmF0aW9uL3V0aWxzJztcbmltcG9ydCB7Z2V0UGx1cmFsQ2FzZX0gZnJvbSAnLi4vLi4vaTE4bi9sb2NhbGl6YXRpb24nO1xuaW1wb3J0IHtcbiAgYXNzZXJ0RGVmaW5lZCxcbiAgYXNzZXJ0RG9tTm9kZSxcbiAgYXNzZXJ0RXF1YWwsXG4gIGFzc2VydEdyZWF0ZXJUaGFuLFxuICBhc3NlcnRJbmRleEluUmFuZ2UsXG4gIHRocm93RXJyb3IsXG59IGZyb20gJy4uLy4uL3V0aWwvYXNzZXJ0JztcbmltcG9ydCB7YXNzZXJ0SW5kZXhJbkV4cGFuZG9SYW5nZSwgYXNzZXJ0VEljdX0gZnJvbSAnLi4vYXNzZXJ0JztcbmltcG9ydCB7YXR0YWNoUGF0Y2hEYXRhfSBmcm9tICcuLi9jb250ZXh0X2Rpc2NvdmVyeSc7XG5pbXBvcnQge2VsZW1lbnRQcm9wZXJ0eUludGVybmFsLCBzZXRFbGVtZW50QXR0cmlidXRlfSBmcm9tICcuLi9pbnN0cnVjdGlvbnMvc2hhcmVkJztcbmltcG9ydCB7XG4gIEVMRU1FTlRfTUFSS0VSLFxuICBJMThuQ3JlYXRlT3BDb2RlLFxuICBJMThuQ3JlYXRlT3BDb2RlcyxcbiAgSTE4blVwZGF0ZU9wQ29kZSxcbiAgSTE4blVwZGF0ZU9wQ29kZXMsXG4gIElDVV9NQVJLRVIsXG4gIEljdUNyZWF0ZU9wQ29kZSxcbiAgSWN1Q3JlYXRlT3BDb2RlcyxcbiAgSWN1VHlwZSxcbiAgVEkxOG4sXG4gIFRJY3UsXG59IGZyb20gJy4uL2ludGVyZmFjZXMvaTE4bic7XG5pbXBvcnQge1ROb2RlfSBmcm9tICcuLi9pbnRlcmZhY2VzL25vZGUnO1xuaW1wb3J0IHtSRWxlbWVudCwgUk5vZGUsIFJUZXh0fSBmcm9tICcuLi9pbnRlcmZhY2VzL3JlbmRlcmVyX2RvbSc7XG5pbXBvcnQge1Nhbml0aXplckZufSBmcm9tICcuLi9pbnRlcmZhY2VzL3Nhbml0aXphdGlvbic7XG5pbXBvcnQge0hFQURFUl9PRkZTRVQsIEhZRFJBVElPTiwgTFZpZXcsIFJFTkRFUkVSLCBUVmlld30gZnJvbSAnLi4vaW50ZXJmYWNlcy92aWV3JztcbmltcG9ydCB7XG4gIGNyZWF0ZUNvbW1lbnROb2RlLFxuICBjcmVhdGVFbGVtZW50Tm9kZSxcbiAgY3JlYXRlVGV4dE5vZGUsXG4gIG5hdGl2ZUluc2VydEJlZm9yZSxcbiAgbmF0aXZlUGFyZW50Tm9kZSxcbiAgbmF0aXZlUmVtb3ZlTm9kZSxcbiAgdXBkYXRlVGV4dE5vZGUsXG59IGZyb20gJy4uL25vZGVfbWFuaXB1bGF0aW9uJztcbmltcG9ydCB7XG4gIGdldEJpbmRpbmdJbmRleCxcbiAgaXNJblNraXBIeWRyYXRpb25CbG9jayxcbiAgbGFzdE5vZGVXYXNDcmVhdGVkLFxuICB3YXNMYXN0Tm9kZUNyZWF0ZWQsXG59IGZyb20gJy4uL3N0YXRlJztcbmltcG9ydCB7cmVuZGVyU3RyaW5naWZ5fSBmcm9tICcuLi91dGlsL3N0cmluZ2lmeV91dGlscyc7XG5pbXBvcnQge2dldE5hdGl2ZUJ5SW5kZXgsIHVud3JhcFJOb2RlfSBmcm9tICcuLi91dGlsL3ZpZXdfdXRpbHMnO1xuXG5pbXBvcnQge2dldExvY2FsZUlkfSBmcm9tICcuL2kxOG5fbG9jYWxlX2lkJztcbmltcG9ydCB7XG4gIGdldEN1cnJlbnRJQ1VDYXNlSW5kZXgsXG4gIGdldFBhcmVudEZyb21JY3VDcmVhdGVPcENvZGUsXG4gIGdldFJlZkZyb21JY3VDcmVhdGVPcENvZGUsXG4gIGdldFRJY3UsXG59IGZyb20gJy4vaTE4bl91dGlsJztcblxuLyoqXG4gKiBLZWVwIHRyYWNrIG9mIHdoaWNoIGlucHV0IGJpbmRpbmdzIGluIGDJtcm1aTE4bkV4cGAgaGF2ZSBjaGFuZ2VkLlxuICpcbiAqIFRoaXMgaXMgdXNlZCB0byBlZmZpY2llbnRseSB1cGRhdGUgZXhwcmVzc2lvbnMgaW4gaTE4biBvbmx5IHdoZW4gdGhlIGNvcnJlc3BvbmRpbmcgaW5wdXQgaGFzXG4gKiBjaGFuZ2VkLlxuICpcbiAqIDEpIEVhY2ggYml0IHJlcHJlc2VudHMgd2hpY2ggb2YgdGhlIGDJtcm1aTE4bkV4cGAgaGFzIGNoYW5nZWQuXG4gKiAyKSBUaGVyZSBhcmUgMzIgYml0cyBhbGxvd2VkIGluIEpTLlxuICogMykgQml0IDMyIGlzIHNwZWNpYWwgYXMgaXQgaXMgc2hhcmVkIGZvciBhbGwgY2hhbmdlcyBwYXN0IDMyLiAoSW4gb3RoZXIgd29yZHMgaWYgeW91IGhhdmUgbW9yZVxuICogdGhhbiAzMiBgybXJtWkxOG5FeHBgIHRoZW4gYWxsIGNoYW5nZXMgcGFzdCAzMm5kIGDJtcm1aTE4bkV4cGAgd2lsbCBiZSBtYXBwZWQgdG8gc2FtZSBiaXQuIFRoaXMgbWVhbnNcbiAqIHRoYXQgd2UgbWF5IGVuZCB1cCBjaGFuZ2luZyBtb3JlIHRoYW4gd2UgbmVlZCB0by4gQnV0IGkxOG4gZXhwcmVzc2lvbnMgd2l0aCAzMiBiaW5kaW5ncyBpcyByYXJlXG4gKiBzbyBpbiBwcmFjdGljZSBpdCBzaG91bGQgbm90IGJlIGFuIGlzc3VlLilcbiAqL1xubGV0IGNoYW5nZU1hc2sgPSAwYjA7XG5cbi8qKlxuICogS2VlcHMgdHJhY2sgb2Ygd2hpY2ggYml0IG5lZWRzIHRvIGJlIHVwZGF0ZWQgaW4gYGNoYW5nZU1hc2tgXG4gKlxuICogVGhpcyB2YWx1ZSBnZXRzIGluY3JlbWVudGVkIG9uIGV2ZXJ5IGNhbGwgdG8gYMm1ybVpMThuRXhwYFxuICovXG5sZXQgY2hhbmdlTWFza0NvdW50ZXIgPSAwO1xuXG4vKipcbiAqIEtlZXAgdHJhY2sgb2Ygd2hpY2ggaW5wdXQgYmluZGluZ3MgaW4gYMm1ybVpMThuRXhwYCBoYXZlIGNoYW5nZWQuXG4gKlxuICogYHNldE1hc2tCaXRgIGdldHMgaW52b2tlZCBieSBlYWNoIGNhbGwgdG8gYMm1ybVpMThuRXhwYC5cbiAqXG4gKiBAcGFyYW0gaGFzQ2hhbmdlIGRpZCBgybXJtWkxOG5FeHBgIGRldGVjdCBhIGNoYW5nZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldE1hc2tCaXQoaGFzQ2hhbmdlOiBib29sZWFuKSB7XG4gIGlmIChoYXNDaGFuZ2UpIHtcbiAgICBjaGFuZ2VNYXNrID0gY2hhbmdlTWFzayB8ICgxIDw8IE1hdGgubWluKGNoYW5nZU1hc2tDb3VudGVyLCAzMSkpO1xuICB9XG4gIGNoYW5nZU1hc2tDb3VudGVyKys7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseUkxOG4odFZpZXc6IFRWaWV3LCBsVmlldzogTFZpZXcsIGluZGV4OiBudW1iZXIpIHtcbiAgaWYgKGNoYW5nZU1hc2tDb3VudGVyID4gMCkge1xuICAgIG5nRGV2TW9kZSAmJiBhc3NlcnREZWZpbmVkKHRWaWV3LCBgdFZpZXcgc2hvdWxkIGJlIGRlZmluZWRgKTtcbiAgICBjb25zdCB0STE4biA9IHRWaWV3LmRhdGFbaW5kZXhdIGFzIFRJMThuIHwgSTE4blVwZGF0ZU9wQ29kZXM7XG4gICAgLy8gV2hlbiBgaW5kZXhgIHBvaW50cyB0byBhbiBgybXJtWkxOG5BdHRyaWJ1dGVzYCB0aGVuIHdlIGhhdmUgYW4gYXJyYXkgb3RoZXJ3aXNlIGBUSTE4bmBcbiAgICBjb25zdCB1cGRhdGVPcENvZGVzOiBJMThuVXBkYXRlT3BDb2RlcyA9IEFycmF5LmlzQXJyYXkodEkxOG4pXG4gICAgICA/ICh0STE4biBhcyBJMThuVXBkYXRlT3BDb2RlcylcbiAgICAgIDogKHRJMThuIGFzIFRJMThuKS51cGRhdGU7XG4gICAgY29uc3QgYmluZGluZ3NTdGFydEluZGV4ID0gZ2V0QmluZGluZ0luZGV4KCkgLSBjaGFuZ2VNYXNrQ291bnRlciAtIDE7XG4gICAgYXBwbHlVcGRhdGVPcENvZGVzKHRWaWV3LCBsVmlldywgdXBkYXRlT3BDb2RlcywgYmluZGluZ3NTdGFydEluZGV4LCBjaGFuZ2VNYXNrKTtcbiAgfVxuICAvLyBSZXNldCBjaGFuZ2VNYXNrICYgbWFza0JpdCB0byBkZWZhdWx0IGZvciB0aGUgbmV4dCB1cGRhdGUgY3ljbGVcbiAgY2hhbmdlTWFzayA9IDBiMDtcbiAgY2hhbmdlTWFza0NvdW50ZXIgPSAwO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVOb2RlV2l0aG91dEh5ZHJhdGlvbihcbiAgbFZpZXc6IExWaWV3LFxuICB0ZXh0T3JOYW1lOiBzdHJpbmcsXG4gIG5vZGVUeXBlOiB0eXBlb2YgTm9kZS5DT01NRU5UX05PREUgfCB0eXBlb2YgTm9kZS5URVhUX05PREUgfCB0eXBlb2YgTm9kZS5FTEVNRU5UX05PREUsXG4pIHtcbiAgY29uc3QgcmVuZGVyZXIgPSBsVmlld1tSRU5ERVJFUl07XG5cbiAgc3dpdGNoIChub2RlVHlwZSkge1xuICAgIGNhc2UgTm9kZS5DT01NRU5UX05PREU6XG4gICAgICByZXR1cm4gY3JlYXRlQ29tbWVudE5vZGUocmVuZGVyZXIsIHRleHRPck5hbWUpO1xuXG4gICAgY2FzZSBOb2RlLlRFWFRfTk9ERTpcbiAgICAgIHJldHVybiBjcmVhdGVUZXh0Tm9kZShyZW5kZXJlciwgdGV4dE9yTmFtZSk7XG5cbiAgICBjYXNlIE5vZGUuRUxFTUVOVF9OT0RFOlxuICAgICAgcmV0dXJuIGNyZWF0ZUVsZW1lbnROb2RlKHJlbmRlcmVyLCB0ZXh0T3JOYW1lLCBudWxsKTtcbiAgfVxufVxuXG5sZXQgX2xvY2F0ZU9yQ3JlYXRlTm9kZTogdHlwZW9mIGxvY2F0ZU9yQ3JlYXRlTm9kZUltcGwgPSAobFZpZXcsIGluZGV4LCB0ZXh0T3JOYW1lLCBub2RlVHlwZSkgPT4ge1xuICBsYXN0Tm9kZVdhc0NyZWF0ZWQodHJ1ZSk7XG4gIHJldHVybiBjcmVhdGVOb2RlV2l0aG91dEh5ZHJhdGlvbihsVmlldywgdGV4dE9yTmFtZSwgbm9kZVR5cGUpO1xufTtcblxuZnVuY3Rpb24gbG9jYXRlT3JDcmVhdGVOb2RlSW1wbChcbiAgbFZpZXc6IExWaWV3LFxuICBpbmRleDogbnVtYmVyLFxuICB0ZXh0T3JOYW1lOiBzdHJpbmcsXG4gIG5vZGVUeXBlOiB0eXBlb2YgTm9kZS5DT01NRU5UX05PREUgfCB0eXBlb2YgTm9kZS5URVhUX05PREUgfCB0eXBlb2YgTm9kZS5FTEVNRU5UX05PREUsXG4pIHtcbiAgY29uc3QgaHlkcmF0aW9uSW5mbyA9IGxWaWV3W0hZRFJBVElPTl07XG4gIGNvbnN0IG5vT2Zmc2V0SW5kZXggPSBpbmRleCAtIEhFQURFUl9PRkZTRVQ7XG4gIGNvbnN0IGlzTm9kZUNyZWF0aW9uTW9kZSA9XG4gICAgIWlzSTE4bkh5ZHJhdGlvblN1cHBvcnRFbmFibGVkKCkgfHxcbiAgICAhaHlkcmF0aW9uSW5mbyB8fFxuICAgIGlzSW5Ta2lwSHlkcmF0aW9uQmxvY2soKSB8fFxuICAgIGlzRGlzY29ubmVjdGVkTm9kZShoeWRyYXRpb25JbmZvLCBub09mZnNldEluZGV4KTtcblxuICBsYXN0Tm9kZVdhc0NyZWF0ZWQoaXNOb2RlQ3JlYXRpb25Nb2RlKTtcbiAgaWYgKGlzTm9kZUNyZWF0aW9uTW9kZSkge1xuICAgIHJldHVybiBjcmVhdGVOb2RlV2l0aG91dEh5ZHJhdGlvbihsVmlldywgdGV4dE9yTmFtZSwgbm9kZVR5cGUpO1xuICB9XG5cbiAgY29uc3QgbmF0aXZlID0gbG9jYXRlSTE4blJOb2RlQnlJbmRleChoeWRyYXRpb25JbmZvISwgbm9PZmZzZXRJbmRleCkgYXMgUk5vZGU7XG5cbiAgLy8gVE9ETzogSW1wcm92ZSBlcnJvciBoYW5kbGluZ1xuICAvL1xuICAvLyBPdGhlciBoeWRyYXRpb24gcGF0aHMgdXNlIHZhbGlkYXRlTWF0Y2hpbmdOb2RlKCkgaW4gb3JkZXIgdG8gcHJvdmlkZVxuICAvLyBkZXRhaWxlZCBpbmZvcm1hdGlvbiBpbiBkZXZlbG9wbWVudCBtb2RlIGFib3V0IHRoZSBleHBlY3RlZCBET00uXG4gIC8vIEhvd2V2ZXIsIG5vdCBldmVyeSBub2RlIGluIGFuIGkxOG4gYmxvY2sgaGFzIGEgVE5vZGUuIEluc3RlYWQsIHdlXG4gIC8vIG5lZWQgdG8gYmUgYWJsZSB0byB1c2UgdGhlIEFTVCB0byBnZW5lcmF0ZSBhIHNpbWlsYXIgbWVzc2FnZS5cbiAgbmdEZXZNb2RlICYmIGFzc2VydERlZmluZWQobmF0aXZlLCAnZXhwZWN0ZWQgbmF0aXZlIGVsZW1lbnQnKTtcbiAgbmdEZXZNb2RlICYmIGFzc2VydEVxdWFsKChuYXRpdmUgYXMgTm9kZSkubm9kZVR5cGUsIG5vZGVUeXBlLCAnZXhwZWN0ZWQgbWF0Y2hpbmcgbm9kZVR5cGUnKTtcbiAgbmdEZXZNb2RlICYmXG4gICAgbm9kZVR5cGUgPT09IE5vZGUuRUxFTUVOVF9OT0RFICYmXG4gICAgYXNzZXJ0RXF1YWwoXG4gICAgICAobmF0aXZlIGFzIEhUTUxFbGVtZW50KS50YWdOYW1lLnRvTG93ZXJDYXNlKCksXG4gICAgICB0ZXh0T3JOYW1lLnRvTG93ZXJDYXNlKCksXG4gICAgICAnZXhwZWN0aW5nIG1hdGNoaW5nIHRhZ05hbWUnLFxuICAgICk7XG4gIG5nRGV2TW9kZSAmJiBtYXJrUk5vZGVBc0NsYWltZWRCeUh5ZHJhdGlvbihuYXRpdmUpO1xuXG4gIHJldHVybiBuYXRpdmU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbmFibGVMb2NhdGVPckNyZWF0ZUkxOG5Ob2RlSW1wbCgpIHtcbiAgX2xvY2F0ZU9yQ3JlYXRlTm9kZSA9IGxvY2F0ZU9yQ3JlYXRlTm9kZUltcGw7XG59XG5cbi8qKlxuICogQXBwbHkgYEkxOG5DcmVhdGVPcENvZGVzYCBvcC1jb2RlcyBhcyBzdG9yZWQgaW4gYFRJMThuLmNyZWF0ZWAuXG4gKlxuICogQ3JlYXRlcyB0ZXh0IChhbmQgY29tbWVudCkgbm9kZXMgd2hpY2ggYXJlIGludGVybmF0aW9uYWxpemVkLlxuICpcbiAqIEBwYXJhbSBsVmlldyBDdXJyZW50IGxWaWV3XG4gKiBAcGFyYW0gY3JlYXRlT3BDb2RlcyBTZXQgb2Ygb3AtY29kZXMgdG8gYXBwbHlcbiAqIEBwYXJhbSBwYXJlbnRSTm9kZSBQYXJlbnQgbm9kZSAoc28gdGhhdCBkaXJlY3QgY2hpbGRyZW4gY2FuIGJlIGFkZGVkIGVhZ2VybHkpIG9yIGBudWxsYCBpZiBpdCBpc1xuICogICAgIGEgcm9vdCBub2RlLlxuICogQHBhcmFtIGluc2VydEluRnJvbnRPZiBET00gbm9kZSB0aGF0IHNob3VsZCBiZSB1c2VkIGFzIGFuIGFuY2hvci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5Q3JlYXRlT3BDb2RlcyhcbiAgbFZpZXc6IExWaWV3LFxuICBjcmVhdGVPcENvZGVzOiBJMThuQ3JlYXRlT3BDb2RlcyxcbiAgcGFyZW50Uk5vZGU6IFJFbGVtZW50IHwgbnVsbCxcbiAgaW5zZXJ0SW5Gcm9udE9mOiBSRWxlbWVudCB8IG51bGwsXG4pOiB2b2lkIHtcbiAgY29uc3QgcmVuZGVyZXIgPSBsVmlld1tSRU5ERVJFUl07XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgY3JlYXRlT3BDb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IG9wQ29kZSA9IGNyZWF0ZU9wQ29kZXNbaSsrXSBhcyBhbnk7XG4gICAgY29uc3QgdGV4dCA9IGNyZWF0ZU9wQ29kZXNbaV0gYXMgc3RyaW5nO1xuICAgIGNvbnN0IGlzQ29tbWVudCA9IChvcENvZGUgJiBJMThuQ3JlYXRlT3BDb2RlLkNPTU1FTlQpID09PSBJMThuQ3JlYXRlT3BDb2RlLkNPTU1FTlQ7XG4gICAgY29uc3QgYXBwZW5kTm93ID1cbiAgICAgIChvcENvZGUgJiBJMThuQ3JlYXRlT3BDb2RlLkFQUEVORF9FQUdFUkxZKSA9PT0gSTE4bkNyZWF0ZU9wQ29kZS5BUFBFTkRfRUFHRVJMWTtcbiAgICBjb25zdCBpbmRleCA9IG9wQ29kZSA+Pj4gSTE4bkNyZWF0ZU9wQ29kZS5TSElGVDtcbiAgICBsZXQgck5vZGUgPSBsVmlld1tpbmRleF07XG4gICAgbGV0IGxhc3ROb2RlV2FzQ3JlYXRlZCA9IGZhbHNlO1xuICAgIGlmIChyTm9kZSA9PT0gbnVsbCkge1xuICAgICAgLy8gV2Ugb25seSBjcmVhdGUgbmV3IERPTSBub2RlcyBpZiB0aGV5IGRvbid0IGFscmVhZHkgZXhpc3Q6IElmIElDVSBzd2l0Y2hlcyBjYXNlIGJhY2sgdG8gYVxuICAgICAgLy8gY2FzZSB3aGljaCB3YXMgYWxyZWFkeSBpbnN0YW50aWF0ZWQsIG5vIG5lZWQgdG8gY3JlYXRlIG5ldyBET00gbm9kZXMuXG4gICAgICByTm9kZSA9IGxWaWV3W2luZGV4XSA9IF9sb2NhdGVPckNyZWF0ZU5vZGUoXG4gICAgICAgIGxWaWV3LFxuICAgICAgICBpbmRleCxcbiAgICAgICAgdGV4dCxcbiAgICAgICAgaXNDb21tZW50ID8gTm9kZS5DT01NRU5UX05PREUgOiBOb2RlLlRFWFRfTk9ERSxcbiAgICAgICk7XG4gICAgICBsYXN0Tm9kZVdhc0NyZWF0ZWQgPSB3YXNMYXN0Tm9kZUNyZWF0ZWQoKTtcbiAgICB9XG4gICAgaWYgKGFwcGVuZE5vdyAmJiBwYXJlbnRSTm9kZSAhPT0gbnVsbCAmJiBsYXN0Tm9kZVdhc0NyZWF0ZWQpIHtcbiAgICAgIG5hdGl2ZUluc2VydEJlZm9yZShyZW5kZXJlciwgcGFyZW50Uk5vZGUsIHJOb2RlLCBpbnNlcnRJbkZyb250T2YsIGZhbHNlKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBBcHBseSBgSTE4bk11dGF0ZU9wQ29kZXNgIE9wQ29kZXMuXG4gKlxuICogQHBhcmFtIHRWaWV3IEN1cnJlbnQgYFRWaWV3YFxuICogQHBhcmFtIG11dGFibGVPcENvZGVzIE11dGFibGUgT3BDb2RlcyB0byBwcm9jZXNzXG4gKiBAcGFyYW0gbFZpZXcgQ3VycmVudCBgTFZpZXdgXG4gKiBAcGFyYW0gYW5jaG9yUk5vZGUgcGxhY2Ugd2hlcmUgdGhlIGkxOG4gbm9kZSBzaG91bGQgYmUgaW5zZXJ0ZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcHBseU11dGFibGVPcENvZGVzKFxuICB0VmlldzogVFZpZXcsXG4gIG11dGFibGVPcENvZGVzOiBJY3VDcmVhdGVPcENvZGVzLFxuICBsVmlldzogTFZpZXcsXG4gIGFuY2hvclJOb2RlOiBSTm9kZSxcbik6IHZvaWQge1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0RG9tTm9kZShhbmNob3JSTm9kZSk7XG4gIGNvbnN0IHJlbmRlcmVyID0gbFZpZXdbUkVOREVSRVJdO1xuICAvLyBgcm9vdElkeGAgcmVwcmVzZW50cyB0aGUgbm9kZSBpbnRvIHdoaWNoIGFsbCBpbnNlcnRzIGhhcHBlbi5cbiAgbGV0IHJvb3RJZHg6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICAvLyBgcm9vdFJOb2RlYCByZXByZXNlbnRzIHRoZSByZWFsIG5vZGUgaW50byB3aGljaCB3ZSBpbnNlcnQuIFRoaXMgY2FuIGJlIGRpZmZlcmVudCBmcm9tXG4gIC8vIGBsVmlld1tyb290SWR4XWAgaWYgd2UgaGF2ZSBwcm9qZWN0aW9uLlxuICAvLyAgLSBudWxsIHdlIGRvbid0IGhhdmUgYSBwYXJlbnQgKGFzIGNhbiBiZSB0aGUgY2FzZSBpbiB3aGVuIHdlIGFyZSBpbnNlcnRpbmcgaW50byBhIHJvb3Qgb2ZcbiAgLy8gICAgTFZpZXcgd2hpY2ggaGFzIG5vIHBhcmVudC4pXG4gIC8vICAtIGBSRWxlbWVudGAgVGhlIGVsZW1lbnQgcmVwcmVzZW50aW5nIHRoZSByb290IGFmdGVyIHRha2luZyBwcm9qZWN0aW9uIGludG8gYWNjb3VudC5cbiAgbGV0IHJvb3RSTm9kZSE6IFJFbGVtZW50IHwgbnVsbDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBtdXRhYmxlT3BDb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IG9wQ29kZSA9IG11dGFibGVPcENvZGVzW2ldO1xuICAgIGlmICh0eXBlb2Ygb3BDb2RlID09ICdzdHJpbmcnKSB7XG4gICAgICBjb25zdCB0ZXh0Tm9kZUluZGV4ID0gbXV0YWJsZU9wQ29kZXNbKytpXSBhcyBudW1iZXI7XG4gICAgICBpZiAobFZpZXdbdGV4dE5vZGVJbmRleF0gPT09IG51bGwpIHtcbiAgICAgICAgbmdEZXZNb2RlICYmIG5nRGV2TW9kZS5yZW5kZXJlckNyZWF0ZVRleHROb2RlKys7XG4gICAgICAgIG5nRGV2TW9kZSAmJiBhc3NlcnRJbmRleEluUmFuZ2UobFZpZXcsIHRleHROb2RlSW5kZXgpO1xuICAgICAgICBsVmlld1t0ZXh0Tm9kZUluZGV4XSA9IF9sb2NhdGVPckNyZWF0ZU5vZGUobFZpZXcsIHRleHROb2RlSW5kZXgsIG9wQ29kZSwgTm9kZS5URVhUX05PREUpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIG9wQ29kZSA9PSAnbnVtYmVyJykge1xuICAgICAgc3dpdGNoIChvcENvZGUgJiBJY3VDcmVhdGVPcENvZGUuTUFTS19JTlNUUlVDVElPTikge1xuICAgICAgICBjYXNlIEljdUNyZWF0ZU9wQ29kZS5BcHBlbmRDaGlsZDpcbiAgICAgICAgICBjb25zdCBwYXJlbnRJZHggPSBnZXRQYXJlbnRGcm9tSWN1Q3JlYXRlT3BDb2RlKG9wQ29kZSk7XG4gICAgICAgICAgaWYgKHJvb3RJZHggPT09IG51bGwpIHtcbiAgICAgICAgICAgIC8vIFRoZSBmaXJzdCBvcGVyYXRpb24gc2hvdWxkIHNhdmUgdGhlIGByb290SWR4YCBiZWNhdXNlIHRoZSBmaXJzdCBvcGVyYXRpb25cbiAgICAgICAgICAgIC8vIG11c3QgaW5zZXJ0IGludG8gdGhlIHJvb3QuIChPbmx5IHN1YnNlcXVlbnQgb3BlcmF0aW9ucyBjYW4gaW5zZXJ0IGludG8gYSBkeW5hbWljXG4gICAgICAgICAgICAvLyBwYXJlbnQpXG4gICAgICAgICAgICByb290SWR4ID0gcGFyZW50SWR4O1xuICAgICAgICAgICAgcm9vdFJOb2RlID0gbmF0aXZlUGFyZW50Tm9kZShyZW5kZXJlciwgYW5jaG9yUk5vZGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBsZXQgaW5zZXJ0SW5Gcm9udE9mOiBSTm9kZSB8IG51bGw7XG4gICAgICAgICAgbGV0IHBhcmVudFJOb2RlOiBSRWxlbWVudCB8IG51bGw7XG4gICAgICAgICAgaWYgKHBhcmVudElkeCA9PT0gcm9vdElkeCkge1xuICAgICAgICAgICAgaW5zZXJ0SW5Gcm9udE9mID0gYW5jaG9yUk5vZGU7XG4gICAgICAgICAgICBwYXJlbnRSTm9kZSA9IHJvb3RSTm9kZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaW5zZXJ0SW5Gcm9udE9mID0gbnVsbDtcbiAgICAgICAgICAgIHBhcmVudFJOb2RlID0gdW53cmFwUk5vZGUobFZpZXdbcGFyZW50SWR4XSkgYXMgUkVsZW1lbnQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIEZJWE1FKG1pc2tvKTogUmVmYWN0b3Igd2l0aCBgcHJvY2Vzc0kxOG5UZXh0YFxuICAgICAgICAgIGlmIChwYXJlbnRSTm9kZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gVGhpcyBjYW4gaGFwcGVuIGlmIHRoZSBgTFZpZXdgIHdlIGFyZSBhZGRpbmcgdG8gaXMgbm90IGF0dGFjaGVkIHRvIGEgcGFyZW50IGBMVmlld2AuXG4gICAgICAgICAgICAvLyBJbiBzdWNoIGEgY2FzZSB0aGVyZSBpcyBubyBcInJvb3RcIiB3ZSBjYW4gYXR0YWNoIHRvLiBUaGlzIGlzIGZpbmUsIGFzIHdlIHN0aWxsIG5lZWQgdG9cbiAgICAgICAgICAgIC8vIGNyZWF0ZSB0aGUgZWxlbWVudHMuIFdoZW4gdGhlIGBMVmlld2AgZ2V0cyBsYXRlciBhZGRlZCB0byBhIHBhcmVudCB0aGVzZSBcInJvb3RcIiBub2Rlc1xuICAgICAgICAgICAgLy8gZ2V0IHBpY2tlZCB1cCBhbmQgYWRkZWQuXG4gICAgICAgICAgICBuZ0Rldk1vZGUgJiYgYXNzZXJ0RG9tTm9kZShwYXJlbnRSTm9kZSk7XG4gICAgICAgICAgICBjb25zdCByZWZJZHggPSBnZXRSZWZGcm9tSWN1Q3JlYXRlT3BDb2RlKG9wQ29kZSk7XG4gICAgICAgICAgICBuZ0Rldk1vZGUgJiYgYXNzZXJ0R3JlYXRlclRoYW4ocmVmSWR4LCBIRUFERVJfT0ZGU0VULCAnTWlzc2luZyByZWYnKTtcbiAgICAgICAgICAgIC8vIGB1bndyYXBSTm9kZWAgaXMgbm90IG5lZWRlZCBoZXJlIGFzIGFsbCBvZiB0aGVzZSBwb2ludCB0byBSTm9kZXMgYXMgcGFydCBvZiB0aGUgaTE4blxuICAgICAgICAgICAgLy8gd2hpY2ggY2FuJ3QgaGF2ZSBjb21wb25lbnRzLlxuICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBsVmlld1tyZWZJZHhdIGFzIFJFbGVtZW50O1xuICAgICAgICAgICAgbmdEZXZNb2RlICYmIGFzc2VydERvbU5vZGUoY2hpbGQpO1xuICAgICAgICAgICAgbmF0aXZlSW5zZXJ0QmVmb3JlKHJlbmRlcmVyLCBwYXJlbnRSTm9kZSwgY2hpbGQsIGluc2VydEluRnJvbnRPZiwgZmFsc2UpO1xuICAgICAgICAgICAgY29uc3QgdEljdSA9IGdldFRJY3UodFZpZXcsIHJlZklkeCk7XG4gICAgICAgICAgICBpZiAodEljdSAhPT0gbnVsbCAmJiB0eXBlb2YgdEljdSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgLy8gSWYgd2UganVzdCBhZGRlZCBhIGNvbW1lbnQgbm9kZSB3aGljaCBoYXMgSUNVIHRoZW4gdGhhdCBJQ1UgbWF5IGhhdmUgYWxyZWFkeSBiZWVuXG4gICAgICAgICAgICAgIC8vIHJlbmRlcmVkIGFuZCB0aGVyZWZvcmUgd2UgbmVlZCB0byByZS1hZGQgaXQgaGVyZS5cbiAgICAgICAgICAgICAgbmdEZXZNb2RlICYmIGFzc2VydFRJY3UodEljdSk7XG4gICAgICAgICAgICAgIGNvbnN0IGNhc2VJbmRleCA9IGdldEN1cnJlbnRJQ1VDYXNlSW5kZXgodEljdSwgbFZpZXcpO1xuICAgICAgICAgICAgICBpZiAoY2FzZUluZGV4ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgYXBwbHlNdXRhYmxlT3BDb2Rlcyh0VmlldywgdEljdS5jcmVhdGVbY2FzZUluZGV4XSwgbFZpZXcsIGxWaWV3W3RJY3UuYW5jaG9ySWR4XSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgSWN1Q3JlYXRlT3BDb2RlLkF0dHI6XG4gICAgICAgICAgY29uc3QgZWxlbWVudE5vZGVJbmRleCA9IG9wQ29kZSA+Pj4gSWN1Q3JlYXRlT3BDb2RlLlNISUZUX1JFRjtcbiAgICAgICAgICBjb25zdCBhdHRyTmFtZSA9IG11dGFibGVPcENvZGVzWysraV0gYXMgc3RyaW5nO1xuICAgICAgICAgIGNvbnN0IGF0dHJWYWx1ZSA9IG11dGFibGVPcENvZGVzWysraV0gYXMgc3RyaW5nO1xuICAgICAgICAgIC8vIFRoaXMgY29kZSBpcyB1c2VkIGZvciBJQ1UgZXhwcmVzc2lvbnMgb25seSwgc2luY2Ugd2UgZG9uJ3Qgc3VwcG9ydFxuICAgICAgICAgIC8vIGRpcmVjdGl2ZXMvY29tcG9uZW50cyBpbiBJQ1VzLCB3ZSBkb24ndCBuZWVkIHRvIHdvcnJ5IGFib3V0IGlucHV0cyBoZXJlXG4gICAgICAgICAgc2V0RWxlbWVudEF0dHJpYnV0ZShcbiAgICAgICAgICAgIHJlbmRlcmVyLFxuICAgICAgICAgICAgZ2V0TmF0aXZlQnlJbmRleChlbGVtZW50Tm9kZUluZGV4LCBsVmlldykgYXMgUkVsZW1lbnQsXG4gICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgIGF0dHJOYW1lLFxuICAgICAgICAgICAgYXR0clZhbHVlLFxuICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGlmIChuZ0Rldk1vZGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSdW50aW1lRXJyb3IoXG4gICAgICAgICAgICAgIFJ1bnRpbWVFcnJvckNvZGUuSU5WQUxJRF9JMThOX1NUUlVDVFVSRSxcbiAgICAgICAgICAgICAgYFVuYWJsZSB0byBkZXRlcm1pbmUgdGhlIHR5cGUgb2YgbXV0YXRlIG9wZXJhdGlvbiBmb3IgXCIke29wQ29kZX1cImAsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3dpdGNoIChvcENvZGUpIHtcbiAgICAgICAgY2FzZSBJQ1VfTUFSS0VSOlxuICAgICAgICAgIGNvbnN0IGNvbW1lbnRWYWx1ZSA9IG11dGFibGVPcENvZGVzWysraV0gYXMgc3RyaW5nO1xuICAgICAgICAgIGNvbnN0IGNvbW1lbnROb2RlSW5kZXggPSBtdXRhYmxlT3BDb2Rlc1srK2ldIGFzIG51bWJlcjtcbiAgICAgICAgICBpZiAobFZpZXdbY29tbWVudE5vZGVJbmRleF0gPT09IG51bGwpIHtcbiAgICAgICAgICAgIG5nRGV2TW9kZSAmJlxuICAgICAgICAgICAgICBhc3NlcnRFcXVhbChcbiAgICAgICAgICAgICAgICB0eXBlb2YgY29tbWVudFZhbHVlLFxuICAgICAgICAgICAgICAgICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGBFeHBlY3RlZCBcIiR7Y29tbWVudFZhbHVlfVwiIHRvIGJlIGEgY29tbWVudCBub2RlIHZhbHVlYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIG5nRGV2TW9kZSAmJiBuZ0Rldk1vZGUucmVuZGVyZXJDcmVhdGVDb21tZW50Kys7XG4gICAgICAgICAgICBuZ0Rldk1vZGUgJiYgYXNzZXJ0SW5kZXhJbkV4cGFuZG9SYW5nZShsVmlldywgY29tbWVudE5vZGVJbmRleCk7XG4gICAgICAgICAgICBjb25zdCBjb21tZW50Uk5vZGUgPSAobFZpZXdbY29tbWVudE5vZGVJbmRleF0gPSBfbG9jYXRlT3JDcmVhdGVOb2RlKFxuICAgICAgICAgICAgICBsVmlldyxcbiAgICAgICAgICAgICAgY29tbWVudE5vZGVJbmRleCxcbiAgICAgICAgICAgICAgY29tbWVudFZhbHVlLFxuICAgICAgICAgICAgICBOb2RlLkNPTU1FTlRfTk9ERSxcbiAgICAgICAgICAgICkpO1xuICAgICAgICAgICAgLy8gRklYTUUobWlza28pOiBBdHRhY2hpbmcgcGF0Y2ggZGF0YSBpcyBvbmx5IG5lZWRlZCBmb3IgdGhlIHJvb3QgKEFsc28gYWRkIHRlc3RzKVxuICAgICAgICAgICAgYXR0YWNoUGF0Y2hEYXRhKGNvbW1lbnRSTm9kZSwgbFZpZXcpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBFTEVNRU5UX01BUktFUjpcbiAgICAgICAgICBjb25zdCB0YWdOYW1lID0gbXV0YWJsZU9wQ29kZXNbKytpXSBhcyBzdHJpbmc7XG4gICAgICAgICAgY29uc3QgZWxlbWVudE5vZGVJbmRleCA9IG11dGFibGVPcENvZGVzWysraV0gYXMgbnVtYmVyO1xuICAgICAgICAgIGlmIChsVmlld1tlbGVtZW50Tm9kZUluZGV4XSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgbmdEZXZNb2RlICYmXG4gICAgICAgICAgICAgIGFzc2VydEVxdWFsKFxuICAgICAgICAgICAgICAgIHR5cGVvZiB0YWdOYW1lLFxuICAgICAgICAgICAgICAgICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGBFeHBlY3RlZCBcIiR7dGFnTmFtZX1cIiB0byBiZSBhbiBlbGVtZW50IG5vZGUgdGFnIG5hbWVgLFxuICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBuZ0Rldk1vZGUgJiYgbmdEZXZNb2RlLnJlbmRlcmVyQ3JlYXRlRWxlbWVudCsrO1xuICAgICAgICAgICAgbmdEZXZNb2RlICYmIGFzc2VydEluZGV4SW5FeHBhbmRvUmFuZ2UobFZpZXcsIGVsZW1lbnROb2RlSW5kZXgpO1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudFJOb2RlID0gKGxWaWV3W2VsZW1lbnROb2RlSW5kZXhdID0gX2xvY2F0ZU9yQ3JlYXRlTm9kZShcbiAgICAgICAgICAgICAgbFZpZXcsXG4gICAgICAgICAgICAgIGVsZW1lbnROb2RlSW5kZXgsXG4gICAgICAgICAgICAgIHRhZ05hbWUsXG4gICAgICAgICAgICAgIE5vZGUuRUxFTUVOVF9OT0RFLFxuICAgICAgICAgICAgKSk7XG4gICAgICAgICAgICAvLyBGSVhNRShtaXNrbyk6IEF0dGFjaGluZyBwYXRjaCBkYXRhIGlzIG9ubHkgbmVlZGVkIGZvciB0aGUgcm9vdCAoQWxzbyBhZGQgdGVzdHMpXG4gICAgICAgICAgICBhdHRhY2hQYXRjaERhdGEoZWxlbWVudFJOb2RlLCBsVmlldyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIG5nRGV2TW9kZSAmJlxuICAgICAgICAgICAgdGhyb3dFcnJvcihgVW5hYmxlIHRvIGRldGVybWluZSB0aGUgdHlwZSBvZiBtdXRhdGUgb3BlcmF0aW9uIGZvciBcIiR7b3BDb2RlfVwiYCk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQXBwbHkgYEkxOG5VcGRhdGVPcENvZGVzYCBPcENvZGVzXG4gKlxuICogQHBhcmFtIHRWaWV3IEN1cnJlbnQgYFRWaWV3YFxuICogQHBhcmFtIGxWaWV3IEN1cnJlbnQgYExWaWV3YFxuICogQHBhcmFtIHVwZGF0ZU9wQ29kZXMgT3BDb2RlcyB0byBwcm9jZXNzXG4gKiBAcGFyYW0gYmluZGluZ3NTdGFydEluZGV4IExvY2F0aW9uIG9mIHRoZSBmaXJzdCBgybXJtWkxOG5BcHBseWBcbiAqIEBwYXJhbSBjaGFuZ2VNYXNrIEVhY2ggYml0IGNvcnJlc3BvbmRzIHRvIGEgYMm1ybVpMThuRXhwYCAoQ291bnRpbmcgYmFja3dhcmRzIGZyb21cbiAqICAgICBgYmluZGluZ3NTdGFydEluZGV4YClcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5VXBkYXRlT3BDb2RlcyhcbiAgdFZpZXc6IFRWaWV3LFxuICBsVmlldzogTFZpZXcsXG4gIHVwZGF0ZU9wQ29kZXM6IEkxOG5VcGRhdGVPcENvZGVzLFxuICBiaW5kaW5nc1N0YXJ0SW5kZXg6IG51bWJlcixcbiAgY2hhbmdlTWFzazogbnVtYmVyLFxuKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdXBkYXRlT3BDb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgIC8vIGJpdCBjb2RlIHRvIGNoZWNrIGlmIHdlIHNob3VsZCBhcHBseSB0aGUgbmV4dCB1cGRhdGVcbiAgICBjb25zdCBjaGVja0JpdCA9IHVwZGF0ZU9wQ29kZXNbaV0gYXMgbnVtYmVyO1xuICAgIC8vIE51bWJlciBvZiBvcENvZGVzIHRvIHNraXAgdW50aWwgbmV4dCBzZXQgb2YgdXBkYXRlIGNvZGVzXG4gICAgY29uc3Qgc2tpcENvZGVzID0gdXBkYXRlT3BDb2Rlc1srK2ldIGFzIG51bWJlcjtcbiAgICBpZiAoY2hlY2tCaXQgJiBjaGFuZ2VNYXNrKSB7XG4gICAgICAvLyBUaGUgdmFsdWUgaGFzIGJlZW4gdXBkYXRlZCBzaW5jZSBsYXN0IGNoZWNrZWRcbiAgICAgIGxldCB2YWx1ZSA9ICcnO1xuICAgICAgZm9yIChsZXQgaiA9IGkgKyAxOyBqIDw9IGkgKyBza2lwQ29kZXM7IGorKykge1xuICAgICAgICBjb25zdCBvcENvZGUgPSB1cGRhdGVPcENvZGVzW2pdO1xuICAgICAgICBpZiAodHlwZW9mIG9wQ29kZSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHZhbHVlICs9IG9wQ29kZTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb3BDb2RlID09ICdudW1iZXInKSB7XG4gICAgICAgICAgaWYgKG9wQ29kZSA8IDApIHtcbiAgICAgICAgICAgIC8vIE5lZ2F0aXZlIG9wQ29kZSByZXByZXNlbnQgYGkxOG5FeHBgIHZhbHVlcyBvZmZzZXQuXG4gICAgICAgICAgICB2YWx1ZSArPSByZW5kZXJTdHJpbmdpZnkobFZpZXdbYmluZGluZ3NTdGFydEluZGV4IC0gb3BDb2RlXSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVJbmRleCA9IG9wQ29kZSA+Pj4gSTE4blVwZGF0ZU9wQ29kZS5TSElGVF9SRUY7XG4gICAgICAgICAgICBzd2l0Y2ggKG9wQ29kZSAmIEkxOG5VcGRhdGVPcENvZGUuTUFTS19PUENPREUpIHtcbiAgICAgICAgICAgICAgY2FzZSBJMThuVXBkYXRlT3BDb2RlLkF0dHI6XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvcE5hbWUgPSB1cGRhdGVPcENvZGVzWysral0gYXMgc3RyaW5nO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNhbml0aXplRm4gPSB1cGRhdGVPcENvZGVzWysral0gYXMgU2FuaXRpemVyRm4gfCBudWxsO1xuICAgICAgICAgICAgICAgIGNvbnN0IHROb2RlT3JUYWdOYW1lID0gdFZpZXcuZGF0YVtub2RlSW5kZXhdIGFzIFROb2RlIHwgc3RyaW5nO1xuICAgICAgICAgICAgICAgIG5nRGV2TW9kZSAmJiBhc3NlcnREZWZpbmVkKHROb2RlT3JUYWdOYW1lLCAnRXhwZXJ0aW5nIFROb2RlIG9yIHN0cmluZycpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdE5vZGVPclRhZ05hbWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAvLyBJRiB3ZSBkb24ndCBoYXZlIGEgYFROb2RlYCwgdGhlbiB3ZSBhcmUgYW4gZWxlbWVudCBpbiBJQ1UgKGFzIElDVSBjb250ZW50IGRvZXNcbiAgICAgICAgICAgICAgICAgIC8vIG5vdCBoYXZlIFROb2RlKSwgaW4gd2hpY2ggY2FzZSB3ZSBrbm93IHRoYXQgdGhlcmUgYXJlIG5vIGRpcmVjdGl2ZXMsIGFuZCBoZW5jZVxuICAgICAgICAgICAgICAgICAgLy8gd2UgdXNlIGF0dHJpYnV0ZSBzZXR0aW5nLlxuICAgICAgICAgICAgICAgICAgc2V0RWxlbWVudEF0dHJpYnV0ZShcbiAgICAgICAgICAgICAgICAgICAgbFZpZXdbUkVOREVSRVJdLFxuICAgICAgICAgICAgICAgICAgICBsVmlld1tub2RlSW5kZXhdLFxuICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgICAgICB0Tm9kZU9yVGFnTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgcHJvcE5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgICBzYW5pdGl6ZUZuLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgZWxlbWVudFByb3BlcnR5SW50ZXJuYWwoXG4gICAgICAgICAgICAgICAgICAgIHRWaWV3LFxuICAgICAgICAgICAgICAgICAgICB0Tm9kZU9yVGFnTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgbFZpZXcsXG4gICAgICAgICAgICAgICAgICAgIHByb3BOYW1lLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgbFZpZXdbUkVOREVSRVJdLFxuICAgICAgICAgICAgICAgICAgICBzYW5pdGl6ZUZuLFxuICAgICAgICAgICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIEkxOG5VcGRhdGVPcENvZGUuVGV4dDpcbiAgICAgICAgICAgICAgICBjb25zdCByVGV4dCA9IGxWaWV3W25vZGVJbmRleF0gYXMgUlRleHQgfCBudWxsO1xuICAgICAgICAgICAgICAgIHJUZXh0ICE9PSBudWxsICYmIHVwZGF0ZVRleHROb2RlKGxWaWV3W1JFTkRFUkVSXSwgclRleHQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSBJMThuVXBkYXRlT3BDb2RlLkljdVN3aXRjaDpcbiAgICAgICAgICAgICAgICBhcHBseUljdVN3aXRjaENhc2UodFZpZXcsIGdldFRJY3UodFZpZXcsIG5vZGVJbmRleCkhLCBsVmlldywgdmFsdWUpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIEkxOG5VcGRhdGVPcENvZGUuSWN1VXBkYXRlOlxuICAgICAgICAgICAgICAgIGFwcGx5SWN1VXBkYXRlQ2FzZSh0VmlldywgZ2V0VEljdSh0Vmlldywgbm9kZUluZGV4KSEsIGJpbmRpbmdzU3RhcnRJbmRleCwgbFZpZXcpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBvcENvZGUgPSB1cGRhdGVPcENvZGVzW2kgKyAxXSBhcyBudW1iZXI7XG4gICAgICBpZiAob3BDb2RlID4gMCAmJiAob3BDb2RlICYgSTE4blVwZGF0ZU9wQ29kZS5NQVNLX09QQ09ERSkgPT09IEkxOG5VcGRhdGVPcENvZGUuSWN1VXBkYXRlKSB7XG4gICAgICAgIC8vIFNwZWNpYWwgY2FzZSBmb3IgdGhlIGBpY3VVcGRhdGVDYXNlYC4gSXQgY291bGQgYmUgdGhhdCB0aGUgbWFzayBkaWQgbm90IG1hdGNoLCBidXRcbiAgICAgICAgLy8gd2Ugc3RpbGwgbmVlZCB0byBleGVjdXRlIGBpY3VVcGRhdGVDYXNlYCBiZWNhdXNlIHRoZSBjYXNlIGhhcyBjaGFuZ2VkIHJlY2VudGx5IGR1ZSB0b1xuICAgICAgICAvLyBwcmV2aW91cyBgaWN1U3dpdGNoQ2FzZWAgaW5zdHJ1Y3Rpb24uIChgaWN1U3dpdGNoQ2FzZWAgYW5kIGBpY3VVcGRhdGVDYXNlYCBhbHdheXMgY29tZSBpblxuICAgICAgICAvLyBwYWlycy4pXG4gICAgICAgIGNvbnN0IG5vZGVJbmRleCA9IG9wQ29kZSA+Pj4gSTE4blVwZGF0ZU9wQ29kZS5TSElGVF9SRUY7XG4gICAgICAgIGNvbnN0IHRJY3UgPSBnZXRUSWN1KHRWaWV3LCBub2RlSW5kZXgpITtcbiAgICAgICAgY29uc3QgY3VycmVudEluZGV4ID0gbFZpZXdbdEljdS5jdXJyZW50Q2FzZUxWaWV3SW5kZXhdO1xuICAgICAgICBpZiAoY3VycmVudEluZGV4IDwgMCkge1xuICAgICAgICAgIGFwcGx5SWN1VXBkYXRlQ2FzZSh0VmlldywgdEljdSwgYmluZGluZ3NTdGFydEluZGV4LCBsVmlldyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaSArPSBza2lwQ29kZXM7XG4gIH1cbn1cblxuLyoqXG4gKiBBcHBseSBPcENvZGVzIGFzc29jaWF0ZWQgd2l0aCB1cGRhdGluZyBhbiBleGlzdGluZyBJQ1UuXG4gKlxuICogQHBhcmFtIHRWaWV3IEN1cnJlbnQgYFRWaWV3YFxuICogQHBhcmFtIHRJY3UgQ3VycmVudCBgVEljdWBcbiAqIEBwYXJhbSBiaW5kaW5nc1N0YXJ0SW5kZXggTG9jYXRpb24gb2YgdGhlIGZpcnN0IGDJtcm1aTE4bkFwcGx5YFxuICogQHBhcmFtIGxWaWV3IEN1cnJlbnQgYExWaWV3YFxuICovXG5mdW5jdGlvbiBhcHBseUljdVVwZGF0ZUNhc2UodFZpZXc6IFRWaWV3LCB0SWN1OiBUSWN1LCBiaW5kaW5nc1N0YXJ0SW5kZXg6IG51bWJlciwgbFZpZXc6IExWaWV3KSB7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnRJbmRleEluUmFuZ2UobFZpZXcsIHRJY3UuY3VycmVudENhc2VMVmlld0luZGV4KTtcbiAgbGV0IGFjdGl2ZUNhc2VJbmRleCA9IGxWaWV3W3RJY3UuY3VycmVudENhc2VMVmlld0luZGV4XTtcbiAgaWYgKGFjdGl2ZUNhc2VJbmRleCAhPT0gbnVsbCkge1xuICAgIGxldCBtYXNrID0gY2hhbmdlTWFzaztcbiAgICBpZiAoYWN0aXZlQ2FzZUluZGV4IDwgMCkge1xuICAgICAgLy8gQ2xlYXIgdGhlIGZsYWcuXG4gICAgICAvLyBOZWdhdGl2ZSBudW1iZXIgbWVhbnMgdGhhdCB0aGUgSUNVIHdhcyBmcmVzaGx5IGNyZWF0ZWQgYW5kIHdlIG5lZWQgdG8gZm9yY2UgdGhlIHVwZGF0ZS5cbiAgICAgIGFjdGl2ZUNhc2VJbmRleCA9IGxWaWV3W3RJY3UuY3VycmVudENhc2VMVmlld0luZGV4XSA9IH5hY3RpdmVDYXNlSW5kZXg7XG4gICAgICAvLyAtMSBpcyBzYW1lIGFzIGFsbCBiaXRzIG9uLCB3aGljaCBzaW11bGF0ZXMgY3JlYXRpb24gc2luY2UgaXQgbWFya3MgYWxsIGJpdHMgZGlydHlcbiAgICAgIG1hc2sgPSAtMTtcbiAgICB9XG4gICAgYXBwbHlVcGRhdGVPcENvZGVzKHRWaWV3LCBsVmlldywgdEljdS51cGRhdGVbYWN0aXZlQ2FzZUluZGV4XSwgYmluZGluZ3NTdGFydEluZGV4LCBtYXNrKTtcbiAgfVxufVxuXG4vKipcbiAqIEFwcGx5IE9wQ29kZXMgYXNzb2NpYXRlZCB3aXRoIHN3aXRjaGluZyBhIGNhc2Ugb24gSUNVLlxuICpcbiAqIFRoaXMgaW52b2x2ZXMgdGVhcmluZyBkb3duIGV4aXN0aW5nIGNhc2UgYW5kIHRoYW4gYnVpbGRpbmcgdXAgYSBuZXcgY2FzZS5cbiAqXG4gKiBAcGFyYW0gdFZpZXcgQ3VycmVudCBgVFZpZXdgXG4gKiBAcGFyYW0gdEljdSBDdXJyZW50IGBUSWN1YFxuICogQHBhcmFtIGxWaWV3IEN1cnJlbnQgYExWaWV3YFxuICogQHBhcmFtIHZhbHVlIFZhbHVlIG9mIHRoZSBjYXNlIHRvIHVwZGF0ZSB0by5cbiAqL1xuZnVuY3Rpb24gYXBwbHlJY3VTd2l0Y2hDYXNlKHRWaWV3OiBUVmlldywgdEljdTogVEljdSwgbFZpZXc6IExWaWV3LCB2YWx1ZTogc3RyaW5nKSB7XG4gIC8vIFJlYnVpbGQgYSBuZXcgY2FzZSBmb3IgdGhpcyBJQ1VcbiAgY29uc3QgY2FzZUluZGV4ID0gZ2V0Q2FzZUluZGV4KHRJY3UsIHZhbHVlKTtcbiAgbGV0IGFjdGl2ZUNhc2VJbmRleCA9IGdldEN1cnJlbnRJQ1VDYXNlSW5kZXgodEljdSwgbFZpZXcpO1xuICBpZiAoYWN0aXZlQ2FzZUluZGV4ICE9PSBjYXNlSW5kZXgpIHtcbiAgICBhcHBseUljdVN3aXRjaENhc2VSZW1vdmUodFZpZXcsIHRJY3UsIGxWaWV3KTtcbiAgICBsVmlld1t0SWN1LmN1cnJlbnRDYXNlTFZpZXdJbmRleF0gPSBjYXNlSW5kZXggPT09IG51bGwgPyBudWxsIDogfmNhc2VJbmRleDtcbiAgICBpZiAoY2FzZUluZGV4ICE9PSBudWxsKSB7XG4gICAgICAvLyBBZGQgdGhlIG5vZGVzIGZvciB0aGUgbmV3IGNhc2VcbiAgICAgIGNvbnN0IGFuY2hvclJOb2RlID0gbFZpZXdbdEljdS5hbmNob3JJZHhdO1xuICAgICAgaWYgKGFuY2hvclJOb2RlKSB7XG4gICAgICAgIG5nRGV2TW9kZSAmJiBhc3NlcnREb21Ob2RlKGFuY2hvclJOb2RlKTtcbiAgICAgICAgYXBwbHlNdXRhYmxlT3BDb2Rlcyh0VmlldywgdEljdS5jcmVhdGVbY2FzZUluZGV4XSwgbFZpZXcsIGFuY2hvclJOb2RlKTtcbiAgICAgIH1cbiAgICAgIGNsYWltRGVoeWRyYXRlZEljdUNhc2UobFZpZXcsIHRJY3UuYW5jaG9ySWR4LCBjYXNlSW5kZXgpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEFwcGx5IE9wQ29kZXMgYXNzb2NpYXRlZCB3aXRoIHRlYXJpbmcgSUNVIGNhc2UuXG4gKlxuICogVGhpcyBpbnZvbHZlcyB0ZWFyaW5nIGRvd24gZXhpc3RpbmcgY2FzZSBhbmQgdGhhbiBidWlsZGluZyB1cCBhIG5ldyBjYXNlLlxuICpcbiAqIEBwYXJhbSB0VmlldyBDdXJyZW50IGBUVmlld2BcbiAqIEBwYXJhbSB0SWN1IEN1cnJlbnQgYFRJY3VgXG4gKiBAcGFyYW0gbFZpZXcgQ3VycmVudCBgTFZpZXdgXG4gKi9cbmZ1bmN0aW9uIGFwcGx5SWN1U3dpdGNoQ2FzZVJlbW92ZSh0VmlldzogVFZpZXcsIHRJY3U6IFRJY3UsIGxWaWV3OiBMVmlldykge1xuICBsZXQgYWN0aXZlQ2FzZUluZGV4ID0gZ2V0Q3VycmVudElDVUNhc2VJbmRleCh0SWN1LCBsVmlldyk7XG4gIGlmIChhY3RpdmVDYXNlSW5kZXggIT09IG51bGwpIHtcbiAgICBjb25zdCByZW1vdmVDb2RlcyA9IHRJY3UucmVtb3ZlW2FjdGl2ZUNhc2VJbmRleF07XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZW1vdmVDb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qgbm9kZU9ySWN1SW5kZXggPSByZW1vdmVDb2Rlc1tpXSBhcyBudW1iZXI7XG4gICAgICBpZiAobm9kZU9ySWN1SW5kZXggPiAwKSB7XG4gICAgICAgIC8vIFBvc2l0aXZlIG51bWJlcnMgYXJlIGBSTm9kZWBzLlxuICAgICAgICBjb25zdCByTm9kZSA9IGdldE5hdGl2ZUJ5SW5kZXgobm9kZU9ySWN1SW5kZXgsIGxWaWV3KTtcbiAgICAgICAgck5vZGUgIT09IG51bGwgJiYgbmF0aXZlUmVtb3ZlTm9kZShsVmlld1tSRU5ERVJFUl0sIHJOb2RlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5lZ2F0aXZlIG51bWJlcnMgYXJlIElDVXNcbiAgICAgICAgYXBwbHlJY3VTd2l0Y2hDYXNlUmVtb3ZlKHRWaWV3LCBnZXRUSWN1KHRWaWV3LCB+bm9kZU9ySWN1SW5kZXgpISwgbFZpZXcpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBjdXJyZW50IGNhc2Ugb2YgYW4gSUNVIGV4cHJlc3Npb24gZGVwZW5kaW5nIG9uIHRoZSBtYWluIGJpbmRpbmcgdmFsdWVcbiAqXG4gKiBAcGFyYW0gaWN1RXhwcmVzc2lvblxuICogQHBhcmFtIGJpbmRpbmdWYWx1ZSBUaGUgdmFsdWUgb2YgdGhlIG1haW4gYmluZGluZyB1c2VkIGJ5IHRoaXMgSUNVIGV4cHJlc3Npb25cbiAqL1xuZnVuY3Rpb24gZ2V0Q2FzZUluZGV4KGljdUV4cHJlc3Npb246IFRJY3UsIGJpbmRpbmdWYWx1ZTogc3RyaW5nKTogbnVtYmVyIHwgbnVsbCB7XG4gIGxldCBpbmRleCA9IGljdUV4cHJlc3Npb24uY2FzZXMuaW5kZXhPZihiaW5kaW5nVmFsdWUpO1xuICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgc3dpdGNoIChpY3VFeHByZXNzaW9uLnR5cGUpIHtcbiAgICAgIGNhc2UgSWN1VHlwZS5wbHVyYWw6IHtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWRDYXNlID0gZ2V0UGx1cmFsQ2FzZShiaW5kaW5nVmFsdWUsIGdldExvY2FsZUlkKCkpO1xuICAgICAgICBpbmRleCA9IGljdUV4cHJlc3Npb24uY2FzZXMuaW5kZXhPZihyZXNvbHZlZENhc2UpO1xuICAgICAgICBpZiAoaW5kZXggPT09IC0xICYmIHJlc29sdmVkQ2FzZSAhPT0gJ290aGVyJykge1xuICAgICAgICAgIGluZGV4ID0gaWN1RXhwcmVzc2lvbi5jYXNlcy5pbmRleE9mKCdvdGhlcicpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSBJY3VUeXBlLnNlbGVjdDoge1xuICAgICAgICBpbmRleCA9IGljdUV4cHJlc3Npb24uY2FzZXMuaW5kZXhPZignb3RoZXInKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBpbmRleCA9PT0gLTEgPyBudWxsIDogaW5kZXg7XG59XG4iXX0=