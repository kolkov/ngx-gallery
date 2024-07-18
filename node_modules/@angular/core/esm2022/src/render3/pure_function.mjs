/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { assertIndexInRange } from '../util/assert';
import { bindingUpdated, bindingUpdated2, bindingUpdated3, bindingUpdated4, getBinding, updateBinding, } from './bindings';
import { getBindingRoot, getLView } from './state';
import { NO_CHANGE } from './tokens';
/**
 * Bindings for pure functions are stored after regular bindings.
 *
 * |-------decls------|---------vars---------|                 |----- hostVars (dir1) ------|
 * ------------------------------------------------------------------------------------------
 * | nodes/refs/pipes | bindings | fn slots  | injector | dir1 | host bindings | host slots |
 * ------------------------------------------------------------------------------------------
 *                    ^                      ^
 *      TView.bindingStartIndex      TView.expandoStartIndex
 *
 * Pure function instructions are given an offset from the binding root. Adding the offset to the
 * binding root gives the first index where the bindings are stored. In component views, the binding
 * root is the bindingStartIndex. In host bindings, the binding root is the expandoStartIndex +
 * any directive instances + any hostVars in directives evaluated before it.
 *
 * See VIEW_DATA.md for more information about host binding resolution.
 */
/**
 * If the value hasn't been saved, calls the pure function to store and return the
 * value. If it has been saved, returns the saved value.
 *
 * @param slotOffset the offset from binding root to the reserved slot
 * @param pureFn Function that returns a value
 * @param thisArg Optional calling context of pureFn
 * @returns value
 *
 * @codeGenApi
 */
export function ɵɵpureFunction0(slotOffset, pureFn, thisArg) {
    const bindingIndex = getBindingRoot() + slotOffset;
    const lView = getLView();
    return lView[bindingIndex] === NO_CHANGE
        ? updateBinding(lView, bindingIndex, thisArg ? pureFn.call(thisArg) : pureFn())
        : getBinding(lView, bindingIndex);
}
/**
 * If the value of the provided exp has changed, calls the pure function to return
 * an updated value. Or if the value has not changed, returns cached value.
 *
 * @param slotOffset the offset from binding root to the reserved slot
 * @param pureFn Function that returns an updated value
 * @param exp Updated expression value
 * @param thisArg Optional calling context of pureFn
 * @returns Updated or cached value
 *
 * @codeGenApi
 */
export function ɵɵpureFunction1(slotOffset, pureFn, exp, thisArg) {
    return pureFunction1Internal(getLView(), getBindingRoot(), slotOffset, pureFn, exp, thisArg);
}
/**
 * If the value of any provided exp has changed, calls the pure function to return
 * an updated value. Or if no values have changed, returns cached value.
 *
 * @param slotOffset the offset from binding root to the reserved slot
 * @param pureFn
 * @param exp1
 * @param exp2
 * @param thisArg Optional calling context of pureFn
 * @returns Updated or cached value
 *
 * @codeGenApi
 */
export function ɵɵpureFunction2(slotOffset, pureFn, exp1, exp2, thisArg) {
    return pureFunction2Internal(getLView(), getBindingRoot(), slotOffset, pureFn, exp1, exp2, thisArg);
}
/**
 * If the value of any provided exp has changed, calls the pure function to return
 * an updated value. Or if no values have changed, returns cached value.
 *
 * @param slotOffset the offset from binding root to the reserved slot
 * @param pureFn
 * @param exp1
 * @param exp2
 * @param exp3
 * @param thisArg Optional calling context of pureFn
 * @returns Updated or cached value
 *
 * @codeGenApi
 */
export function ɵɵpureFunction3(slotOffset, pureFn, exp1, exp2, exp3, thisArg) {
    return pureFunction3Internal(getLView(), getBindingRoot(), slotOffset, pureFn, exp1, exp2, exp3, thisArg);
}
/**
 * If the value of any provided exp has changed, calls the pure function to return
 * an updated value. Or if no values have changed, returns cached value.
 *
 * @param slotOffset the offset from binding root to the reserved slot
 * @param pureFn
 * @param exp1
 * @param exp2
 * @param exp3
 * @param exp4
 * @param thisArg Optional calling context of pureFn
 * @returns Updated or cached value
 *
 * @codeGenApi
 */
export function ɵɵpureFunction4(slotOffset, pureFn, exp1, exp2, exp3, exp4, thisArg) {
    return pureFunction4Internal(getLView(), getBindingRoot(), slotOffset, pureFn, exp1, exp2, exp3, exp4, thisArg);
}
/**
 * If the value of any provided exp has changed, calls the pure function to return
 * an updated value. Or if no values have changed, returns cached value.
 *
 * @param slotOffset the offset from binding root to the reserved slot
 * @param pureFn
 * @param exp1
 * @param exp2
 * @param exp3
 * @param exp4
 * @param exp5
 * @param thisArg Optional calling context of pureFn
 * @returns Updated or cached value
 *
 * @codeGenApi
 */
export function ɵɵpureFunction5(slotOffset, pureFn, exp1, exp2, exp3, exp4, exp5, thisArg) {
    const bindingIndex = getBindingRoot() + slotOffset;
    const lView = getLView();
    const different = bindingUpdated4(lView, bindingIndex, exp1, exp2, exp3, exp4);
    return bindingUpdated(lView, bindingIndex + 4, exp5) || different
        ? updateBinding(lView, bindingIndex + 5, thisArg
            ? pureFn.call(thisArg, exp1, exp2, exp3, exp4, exp5)
            : pureFn(exp1, exp2, exp3, exp4, exp5))
        : getBinding(lView, bindingIndex + 5);
}
/**
 * If the value of any provided exp has changed, calls the pure function to return
 * an updated value. Or if no values have changed, returns cached value.
 *
 * @param slotOffset the offset from binding root to the reserved slot
 * @param pureFn
 * @param exp1
 * @param exp2
 * @param exp3
 * @param exp4
 * @param exp5
 * @param exp6
 * @param thisArg Optional calling context of pureFn
 * @returns Updated or cached value
 *
 * @codeGenApi
 */
export function ɵɵpureFunction6(slotOffset, pureFn, exp1, exp2, exp3, exp4, exp5, exp6, thisArg) {
    const bindingIndex = getBindingRoot() + slotOffset;
    const lView = getLView();
    const different = bindingUpdated4(lView, bindingIndex, exp1, exp2, exp3, exp4);
    return bindingUpdated2(lView, bindingIndex + 4, exp5, exp6) || different
        ? updateBinding(lView, bindingIndex + 6, thisArg
            ? pureFn.call(thisArg, exp1, exp2, exp3, exp4, exp5, exp6)
            : pureFn(exp1, exp2, exp3, exp4, exp5, exp6))
        : getBinding(lView, bindingIndex + 6);
}
/**
 * If the value of any provided exp has changed, calls the pure function to return
 * an updated value. Or if no values have changed, returns cached value.
 *
 * @param slotOffset the offset from binding root to the reserved slot
 * @param pureFn
 * @param exp1
 * @param exp2
 * @param exp3
 * @param exp4
 * @param exp5
 * @param exp6
 * @param exp7
 * @param thisArg Optional calling context of pureFn
 * @returns Updated or cached value
 *
 * @codeGenApi
 */
export function ɵɵpureFunction7(slotOffset, pureFn, exp1, exp2, exp3, exp4, exp5, exp6, exp7, thisArg) {
    const bindingIndex = getBindingRoot() + slotOffset;
    const lView = getLView();
    let different = bindingUpdated4(lView, bindingIndex, exp1, exp2, exp3, exp4);
    return bindingUpdated3(lView, bindingIndex + 4, exp5, exp6, exp7) || different
        ? updateBinding(lView, bindingIndex + 7, thisArg
            ? pureFn.call(thisArg, exp1, exp2, exp3, exp4, exp5, exp6, exp7)
            : pureFn(exp1, exp2, exp3, exp4, exp5, exp6, exp7))
        : getBinding(lView, bindingIndex + 7);
}
/**
 * If the value of any provided exp has changed, calls the pure function to return
 * an updated value. Or if no values have changed, returns cached value.
 *
 * @param slotOffset the offset from binding root to the reserved slot
 * @param pureFn
 * @param exp1
 * @param exp2
 * @param exp3
 * @param exp4
 * @param exp5
 * @param exp6
 * @param exp7
 * @param exp8
 * @param thisArg Optional calling context of pureFn
 * @returns Updated or cached value
 *
 * @codeGenApi
 */
export function ɵɵpureFunction8(slotOffset, pureFn, exp1, exp2, exp3, exp4, exp5, exp6, exp7, exp8, thisArg) {
    const bindingIndex = getBindingRoot() + slotOffset;
    const lView = getLView();
    const different = bindingUpdated4(lView, bindingIndex, exp1, exp2, exp3, exp4);
    return bindingUpdated4(lView, bindingIndex + 4, exp5, exp6, exp7, exp8) || different
        ? updateBinding(lView, bindingIndex + 8, thisArg
            ? pureFn.call(thisArg, exp1, exp2, exp3, exp4, exp5, exp6, exp7, exp8)
            : pureFn(exp1, exp2, exp3, exp4, exp5, exp6, exp7, exp8))
        : getBinding(lView, bindingIndex + 8);
}
/**
 * pureFunction instruction that can support any number of bindings.
 *
 * If the value of any provided exp has changed, calls the pure function to return
 * an updated value. Or if no values have changed, returns cached value.
 *
 * @param slotOffset the offset from binding root to the reserved slot
 * @param pureFn A pure function that takes binding values and builds an object or array
 * containing those values.
 * @param exps An array of binding values
 * @param thisArg Optional calling context of pureFn
 * @returns Updated or cached value
 *
 * @codeGenApi
 */
export function ɵɵpureFunctionV(slotOffset, pureFn, exps, thisArg) {
    return pureFunctionVInternal(getLView(), getBindingRoot(), slotOffset, pureFn, exps, thisArg);
}
/**
 * Results of a pure function invocation are stored in LView in a dedicated slot that is initialized
 * to NO_CHANGE. In rare situations a pure pipe might throw an exception on the very first
 * invocation and not produce any valid results. In this case LView would keep holding the NO_CHANGE
 * value. The NO_CHANGE is not something that we can use in expressions / bindings thus we convert
 * it to `undefined`.
 */
function getPureFunctionReturnValue(lView, returnValueIndex) {
    ngDevMode && assertIndexInRange(lView, returnValueIndex);
    const lastReturnValue = lView[returnValueIndex];
    return lastReturnValue === NO_CHANGE ? undefined : lastReturnValue;
}
/**
 * If the value of the provided exp has changed, calls the pure function to return
 * an updated value. Or if the value has not changed, returns cached value.
 *
 * @param lView LView in which the function is being executed.
 * @param bindingRoot Binding root index.
 * @param slotOffset the offset from binding root to the reserved slot
 * @param pureFn Function that returns an updated value
 * @param exp Updated expression value
 * @param thisArg Optional calling context of pureFn
 * @returns Updated or cached value
 */
export function pureFunction1Internal(lView, bindingRoot, slotOffset, pureFn, exp, thisArg) {
    const bindingIndex = bindingRoot + slotOffset;
    return bindingUpdated(lView, bindingIndex, exp)
        ? updateBinding(lView, bindingIndex + 1, thisArg ? pureFn.call(thisArg, exp) : pureFn(exp))
        : getPureFunctionReturnValue(lView, bindingIndex + 1);
}
/**
 * If the value of any provided exp has changed, calls the pure function to return
 * an updated value. Or if no values have changed, returns cached value.
 *
 * @param lView LView in which the function is being executed.
 * @param bindingRoot Binding root index.
 * @param slotOffset the offset from binding root to the reserved slot
 * @param pureFn
 * @param exp1
 * @param exp2
 * @param thisArg Optional calling context of pureFn
 * @returns Updated or cached value
 */
export function pureFunction2Internal(lView, bindingRoot, slotOffset, pureFn, exp1, exp2, thisArg) {
    const bindingIndex = bindingRoot + slotOffset;
    return bindingUpdated2(lView, bindingIndex, exp1, exp2)
        ? updateBinding(lView, bindingIndex + 2, thisArg ? pureFn.call(thisArg, exp1, exp2) : pureFn(exp1, exp2))
        : getPureFunctionReturnValue(lView, bindingIndex + 2);
}
/**
 * If the value of any provided exp has changed, calls the pure function to return
 * an updated value. Or if no values have changed, returns cached value.
 *
 * @param lView LView in which the function is being executed.
 * @param bindingRoot Binding root index.
 * @param slotOffset the offset from binding root to the reserved slot
 * @param pureFn
 * @param exp1
 * @param exp2
 * @param exp3
 * @param thisArg Optional calling context of pureFn
 * @returns Updated or cached value
 */
export function pureFunction3Internal(lView, bindingRoot, slotOffset, pureFn, exp1, exp2, exp3, thisArg) {
    const bindingIndex = bindingRoot + slotOffset;
    return bindingUpdated3(lView, bindingIndex, exp1, exp2, exp3)
        ? updateBinding(lView, bindingIndex + 3, thisArg ? pureFn.call(thisArg, exp1, exp2, exp3) : pureFn(exp1, exp2, exp3))
        : getPureFunctionReturnValue(lView, bindingIndex + 3);
}
/**
 * If the value of any provided exp has changed, calls the pure function to return
 * an updated value. Or if no values have changed, returns cached value.
 *
 * @param lView LView in which the function is being executed.
 * @param bindingRoot Binding root index.
 * @param slotOffset the offset from binding root to the reserved slot
 * @param pureFn
 * @param exp1
 * @param exp2
 * @param exp3
 * @param exp4
 * @param thisArg Optional calling context of pureFn
 * @returns Updated or cached value
 *
 */
export function pureFunction4Internal(lView, bindingRoot, slotOffset, pureFn, exp1, exp2, exp3, exp4, thisArg) {
    const bindingIndex = bindingRoot + slotOffset;
    return bindingUpdated4(lView, bindingIndex, exp1, exp2, exp3, exp4)
        ? updateBinding(lView, bindingIndex + 4, thisArg ? pureFn.call(thisArg, exp1, exp2, exp3, exp4) : pureFn(exp1, exp2, exp3, exp4))
        : getPureFunctionReturnValue(lView, bindingIndex + 4);
}
/**
 * pureFunction instruction that can support any number of bindings.
 *
 * If the value of any provided exp has changed, calls the pure function to return
 * an updated value. Or if no values have changed, returns cached value.
 *
 * @param lView LView in which the function is being executed.
 * @param bindingRoot Binding root index.
 * @param slotOffset the offset from binding root to the reserved slot
 * @param pureFn A pure function that takes binding values and builds an object or array
 * containing those values.
 * @param exps An array of binding values
 * @param thisArg Optional calling context of pureFn
 * @returns Updated or cached value
 */
export function pureFunctionVInternal(lView, bindingRoot, slotOffset, pureFn, exps, thisArg) {
    let bindingIndex = bindingRoot + slotOffset;
    let different = false;
    for (let i = 0; i < exps.length; i++) {
        bindingUpdated(lView, bindingIndex++, exps[i]) && (different = true);
    }
    return different
        ? updateBinding(lView, bindingIndex, pureFn.apply(thisArg, exps))
        : getPureFunctionReturnValue(lView, bindingIndex);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVyZV9mdW5jdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3JlbmRlcjMvcHVyZV9mdW5jdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsa0JBQWtCLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUNsRCxPQUFPLEVBQ0wsY0FBYyxFQUNkLGVBQWUsRUFDZixlQUFlLEVBQ2YsZUFBZSxFQUNmLFVBQVUsRUFDVixhQUFhLEdBQ2QsTUFBTSxZQUFZLENBQUM7QUFFcEIsT0FBTyxFQUFDLGNBQWMsRUFBRSxRQUFRLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFDakQsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLFVBQVUsQ0FBQztBQUVuQzs7Ozs7Ozs7Ozs7Ozs7OztHQWdCRztBQUVIOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFNLFVBQVUsZUFBZSxDQUFJLFVBQWtCLEVBQUUsTUFBZSxFQUFFLE9BQWE7SUFDbkYsTUFBTSxZQUFZLEdBQUcsY0FBYyxFQUFFLEdBQUcsVUFBVSxDQUFDO0lBQ25ELE1BQU0sS0FBSyxHQUFHLFFBQVEsRUFBRSxDQUFDO0lBQ3pCLE9BQU8sS0FBSyxDQUFDLFlBQVksQ0FBQyxLQUFLLFNBQVM7UUFDdEMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsWUFBWSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDL0UsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDdEMsQ0FBQztBQUVEOzs7Ozs7Ozs7OztHQVdHO0FBQ0gsTUFBTSxVQUFVLGVBQWUsQ0FDN0IsVUFBa0IsRUFDbEIsTUFBdUIsRUFDdkIsR0FBUSxFQUNSLE9BQWE7SUFFYixPQUFP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RUFDNUIsSUFBVyxFQUNYLE9BQWE7SUFFYixJQUFJLFlBQVksR0FBRyxXQUFXLEdBQUcsVUFBVSxDQUFDO0lBQzVDLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQztJQUN0QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ3JDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsWUFBWSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLENBQUM7SUFDdkUsQ0FBQztJQUNELE9BQU8sU0FBUztRQUNkLENBQUMsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLFlBQVksRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNqRSxDQUFDLENBQUMsMEJBQTBCLENBQUMsS0FBSyxFQUFFLFlBQVksQ0FBQyxDQUFDO0FBQ3RELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHthc3NlcnRJbmRleEluUmFuZ2V9IGZyb20gJy4uL3V0aWwvYXNzZXJ0JztcbmltcG9ydCB7XG4gIGJpbmRpbmdVcGRhdGVkLFxuICBiaW5kaW5nVXBkYXRlZDIsXG4gIGJpbmRpbmdVcGRhdGVkMyxcbiAgYmluZGluZ1VwZGF0ZWQ0LFxuICBnZXRCaW5kaW5nLFxuICB1cGRhdGVCaW5kaW5nLFxufSBmcm9tICcuL2JpbmRpbmdzJztcbmltcG9ydCB7TFZpZXd9IGZyb20gJy4vaW50ZXJmYWNlcy92aWV3JztcbmltcG9ydCB7Z2V0QmluZGluZ1Jvb3QsIGdldExWaWV3fSBmcm9tICcuL3N0YXRlJztcbmltcG9ydCB7Tk9fQ0hBTkdFfSBmcm9tICcuL3Rva2Vucyc7XG5cbi8qKlxuICogQmluZGluZ3MgZm9yIHB1cmUgZnVuY3Rpb25zIGFyZSBzdG9yZWQgYWZ0ZXIgcmVndWxhciBiaW5kaW5ncy5cbiAqXG4gKiB8LS0tLS0tLWRlY2xzLS0tLS0tfC0tLS0tLS0tLXZhcnMtLS0tLS0tLS18ICAgICAgICAgICAgICAgICB8LS0tLS0gaG9zdFZhcnMgKGRpcjEpIC0tLS0tLXxcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogfCBub2Rlcy9yZWZzL3BpcGVzIHwgYmluZGluZ3MgfCBmbiBzbG90cyAgfCBpbmplY3RvciB8IGRpcjEgfCBob3N0IGJpbmRpbmdzIHwgaG9zdCBzbG90cyB8XG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICAgICAgICAgICAgICAgICAgICBeICAgICAgICAgICAgICAgICAgICAgIF5cbiAqICAgICAgVFZpZXcuYmluZGluZ1N0YXJ0SW5kZXggICAgICBUVmlldy5leHBhbmRvU3RhcnRJbmRleFxuICpcbiAqIFB1cmUgZnVuY3Rpb24gaW5zdHJ1Y3Rpb25zIGFyZSBnaXZlbiBhbiBvZmZzZXQgZnJvbSB0aGUgYmluZGluZyByb290LiBBZGRpbmcgdGhlIG9mZnNldCB0byB0aGVcbiAqIGJpbmRpbmcgcm9vdCBnaXZlcyB0aGUgZmlyc3QgaW5kZXggd2hlcmUgdGhlIGJpbmRpbmdzIGFyZSBzdG9yZWQuIEluIGNvbXBvbmVudCB2aWV3cywgdGhlIGJpbmRpbmdcbiAqIHJvb3QgaXMgdGhlIGJpbmRpbmdTdGFydEluZGV4LiBJbiBob3N0IGJpbmRpbmdzLCB0aGUgYmluZGluZyByb290IGlzIHRoZSBleHBhbmRvU3RhcnRJbmRleCArXG4gKiBhbnkgZGlyZWN0aXZlIGluc3RhbmNlcyArIGFueSBob3N0VmFycyBpbiBkaXJlY3RpdmVzIGV2YWx1YXRlZCBiZWZvcmUgaXQuXG4gKlxuICogU2VlIFZJRVdfREFUQS5tZCBmb3IgbW9yZSBpbmZvcm1hdGlvbiBhYm91dCBob3N0IGJpbmRpbmcgcmVzb2x1dGlvbi5cbiAqL1xuXG4vKipcbiAqIElmIHRoZSB2YWx1ZSBoYXNuJ3QgYmVlbiBzYXZlZCwgY2FsbHMgdGhlIHB1cmUgZnVuY3Rpb24gdG8gc3RvcmUgYW5kIHJldHVybiB0aGVcbiAqIHZhbHVlLiBJZiBpdCBoYXMgYmVlbiBzYXZlZCwgcmV0dXJucyB0aGUgc2F2ZWQgdmFsdWUuXG4gKlxuICogQHBhcmFtIHNsb3RPZmZzZXQgdGhlIG9mZnNldCBmcm9tIGJpbmRpbmcgcm9vdCB0byB0aGUgcmVzZXJ2ZWQgc2xvdFxuICogQHBhcmFtIHB1cmVGbiBGdW5jdGlvbiB0aGF0IHJldHVybnMgYSB2YWx1ZVxuICogQHBhcmFtIHRoaXNBcmcgT3B0aW9uYWwgY2FsbGluZyBjb250ZXh0IG9mIHB1cmVGblxuICogQHJldHVybnMgdmFsdWVcbiAqXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtXB1cmVGdW5jdGlvbjA8VD4oc2xvdE9mZnNldDogbnVtYmVyLCBwdXJlRm46ICgpID0+IFQsIHRoaXNBcmc/OiBhbnkpOiBUIHtcbiAgY29uc3QgYmluZGluZ0luZGV4ID0gZ2V0QmluZGluZ1Jvb3QoKSArIHNsb3RPZmZzZXQ7XG4gIGNvbnN0IGxWaWV3ID0gZ2V0TFZpZXcoKTtcbiAgcmV0dXJuIGxWaWV3W2JpbmRpbmdJbmRleF0gPT09IE5PX0NIQU5HRVxuICAgID8gdXBkYXRlQmluZGluZyhsVmlldywgYmluZGluZ0luZGV4LCB0aGlzQXJnID8gcHVyZUZuLmNhbGwodGhpc0FyZykgOiBwdXJlRm4oKSlcbiAgICA6IGdldEJpbmRpbmcobFZpZXcsIGJpbmRpbmdJbmRleCk7XG59XG5cbi8qKlxuICogSWYgdGhlIHZhbHVlIG9mIHRoZSBwcm92aWRlZCBleHAgaGFzIGNoYW5nZWQsIGNhbGxzIHRoZSBwdXJlIGZ1bmN0aW9uIHRvIHJldHVyblxuICogYW4gdXBkYXRlZCB2YWx1ZS4gT3IgaWYgdGhlIHZhbHVlIGhhcyBub3QgY2hhbmdlZCwgcmV0dXJucyBjYWNoZWQgdmFsdWUuXG4gKlxuICogQHBhcmFtIHNsb3RPZmZzZXQgdGhlIG9mZnNldCBmcm9tIGJpbmRpbmcgcm9vdCB0byB0aGUgcmVzZXJ2ZWQgc2xvdFxuICogQHBhcmFtIHB1cmVGbiBGdW5jdGlvbiB0aGF0IHJldHVybnMgYW4gdXBkYXRlZCB2YWx1ZVxuICogQHBhcmFtIGV4cCBVcGRhdGVkIGV4cHJlc3Npb24gdmFsdWVcbiAqIEBwYXJhbSB0aGlzQXJnIE9wdGlvbmFsIGNhbGxpbmcgY29udGV4dCBvZiBwdXJlRm5cbiAqIEByZXR1cm5zIFVwZGF0ZWQgb3IgY2FjaGVkIHZhbHVlXG4gKlxuICogQGNvZGVHZW5BcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybVwdXJlRnVuY3Rpb24xKFxuICBzbG90T2Zmc2V0OiBudW1iZXIsXG4gIHB1cmVGbjogKHY6IGFueSkgPT4gYW55LFxuICBleHA6IGFueSxcbiAgdGhpc0FyZz86IGFueSxcbik6IGFueSB7XG4gIHJldHVybiBwdXJlRnVuY3Rpb24xSW50ZXJuYWwoZ2V0TFZpZXcoKSwgZ2V0QmluZGluZ1Jvb3QoKSwgc2xvdE9mZnNldCwgcHVyZUZuLCBleHAsIHRoaXNBcmcpO1xufVxuXG4vKipcbiAqIElmIHRoZSB2YWx1ZSBvZiBhbnkgcHJvdmlkZWQgZXhwIGhhcyBjaGFuZ2VkLCBjYWxscyB0aGUgcHVyZSBmdW5jdGlvbiB0byByZXR1cm5cbiAqIGFuIHVwZGF0ZWQgdmFsdWUuIE9yIGlmIG5vIHZhbHVlcyBoYXZlIGNoYW5nZWQsIHJldHVybnMgY2FjaGVkIHZhbHVlLlxuICpcbiAqIEBwYXJhbSBzbG90T2Zmc2V0IHRoZSBvZmZzZXQgZnJvbSBiaW5kaW5nIHJvb3QgdG8gdGhlIHJlc2VydmVkIHNsb3RcbiAqIEBwYXJhbSBwdXJlRm5cbiAqIEBwYXJhbSBleHAxXG4gKiBAcGFyYW0gZXhwMlxuICogQHBhcmFtIHRoaXNBcmcgT3B0aW9uYWwgY2FsbGluZyBjb250ZXh0IG9mIHB1cmVGblxuICogQHJldHVybnMgVXBkYXRlZCBvciBjYWNoZWQgdmFsdWVcbiAqXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtXB1cmVGdW5jdGlvbjIoXG4gIHNsb3RPZmZzZXQ6IG51bWJlcixcbiAgcHVyZUZuOiAodjE6IGFueSwgdjI6IGFueSkgPT4gYW55LFxuICBleHAxOiBhbnksXG4gIGV4cDI6IGFueSxcbiAgdGhpc0FyZz86IGFueSxcbik6IGFueSB7XG4gIHJldHVybiBwdXJlRnVuY3Rpb24ySW50ZXJuYWwoXG4gICAgZ2V0TFZpZXcoKSxcbiAgICBnZXRCaW5kaW5nUm9vdCgpLFxuICAgIHNsb3RPZmZzZXQsXG4gICAgcHVyZUZuLFxuICAgIGV4cDEsXG4gICAgZXhwMixcbiAgICB0aGlzQXJnLFxuICApO1xufVxuXG4vKipcbiAqIElmIHRoZSB2YWx1ZSBvZiBhbnkgcHJvdmlkZWQgZXhwIGhhcyBjaGFuZ2VkLCBjYWxscyB0aGUgcHVyZSBmdW5jdGlvbiB0byByZXR1cm5cbiAqIGFuIHVwZGF0ZWQgdmFsdWUuIE9yIGlmIG5vIHZhbHVlcyBoYXZlIGNoYW5nZWQsIHJldHVybnMgY2FjaGVkIHZhbHVlLlxuICpcbiAqIEBwYXJhbSBzbG90T2Zmc2V0IHRoZSBvZmZzZXQgZnJvbSBiaW5kaW5nIHJvb3QgdG8gdGhlIHJlc2VydmVkIHNsb3RcbiAqIEBwYXJhbSBwdXJlRm5cbiAqIEBwYXJhbSBleHAxXG4gKiBAcGFyYW0gZXhwMlxuICogQHBhcmFtIGV4cDNcbiAqIEBwYXJhbSB0aGlzQXJnIE9wdGlvbmFsIGNhbGxpbmcgY29udGV4dCBvZiBwdXJlRm5cbiAqIEByZXR1cm5zIFVwZGF0ZWQgb3IgY2FjaGVkIHZhbHVlXG4gKlxuICogQGNvZGVHZW5BcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybVwdXJlRnVuY3Rpb24zKFxuICBzbG90T2Zmc2V0OiBudW1iZXIsXG4gIHB1cmVGbjogKHYxOiBhbnksIHYyOiBhbnksIHYzOiBhbnkpID0+IGFueSxcbiAgZXhwMTogYW55LFxuICBleHAyOiBhbnksXG4gIGV4cDM6IGFueSxcbiAgdGhpc0FyZz86IGFueSxcbik6IGFueSB7XG4gIHJldHVybiBwdXJlRnVuY3Rpb24zSW50ZXJuYWwoXG4gICAgZ2V0TFZpZXcoKSxcbiAgICBnZXRCaW5kaW5nUm9vdCgpLFxuICAgIHNsb3RPZmZzZXQsXG4gICAgcHVyZUZuLFxuICAgIGV4cDEsXG4gICAgZXhwMixcbiAgICBleHAzLFxuICAgIHRoaXNBcmcsXG4gICk7XG59XG5cbi8qKlxuICogSWYgdGhlIHZhbHVlIG9mIGFueSBwcm92aWRlZCBleHAgaGFzIGNoYW5nZWQsIGNhbGxzIHRoZSBwdXJlIGZ1bmN0aW9uIHRvIHJldHVyblxuICogYW4gdXBkYXRlZCB2YWx1ZS4gT3IgaWYgbm8gdmFsdWVzIGhhdmUgY2hhbmdlZCwgcmV0dXJucyBjYWNoZWQgdmFsdWUuXG4gKlxuICogQHBhcmFtIHNsb3RPZmZzZXQgdGhlIG9mZnNldCBmcm9tIGJpbmRpbmcgcm9vdCB0byB0aGUgcmVzZXJ2ZWQgc2xvdFxuICogQHBhcmFtIHB1cmVGblxuICogQHBhcmFtIGV4cDFcbiAqIEBwYXJhbSBleHAyXG4gKiBAcGFyYW0gZXhwM1xuICogQHBhcmFtIGV4cDRcbiAqIEBwYXJhbSB0aGlzQXJnIE9wdGlvbmFsIGNhbGxpbmcgY29udGV4dCBvZiBwdXJlRm5cbiAqIEByZXR1cm5zIFVwZGF0ZWQgb3IgY2FjaGVkIHZhbHVlXG4gKlxuICogQGNvZGVHZW5BcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybVwdXJlRnVuY3Rpb240KFxuICBzbG90T2Zmc2V0OiBudW1iZXIsXG4gIHB1cmVGbjogKHYxOiBhbnksIHYyOiBhbnksIHYzOiBhbnksIHY0OiBhbnkpID0+IGFueSxcbiAgZXhwMTogYW55LFxuICBleHAyOiBhbnksXG4gIGV4cDM6IGFueSxcbiAgZXhwNDogYW55LFxuICB0aGlzQXJnPzogYW55LFxuKTogYW55IHtcbiAgcmV0dXJuIHB1cmVGdW5jdGlvbjRJbnRlcm5hbChcbiAgICBnZXRMVmlldygpLFxuICAgIGdldEJpbmRpbmdSb290KCksXG4gICAgc2xvdE9mZnNldCxcbiAgICBwdXJlRm4sXG4gICAgZXhwMSxcbiAgICBleHAyLFxuICAgIGV4cDMsXG4gICAgZXhwNCxcbiAgICB0aGlzQXJnLFxuICApO1xufVxuXG4vKipcbiAqIElmIHRoZSB2YWx1ZSBvZiBhbnkgcHJvdmlkZWQgZXhwIGhhcyBjaGFuZ2VkLCBjYWxscyB0aGUgcHVyZSBmdW5jdGlvbiB0byByZXR1cm5cbiAqIGFuIHVwZGF0ZWQgdmFsdWUuIE9yIGlmIG5vIHZhbHVlcyBoYXZlIGNoYW5nZWQsIHJldHVybnMgY2FjaGVkIHZhbHVlLlxuICpcbiAqIEBwYXJhbSBzbG90T2Zmc2V0IHRoZSBvZmZzZXQgZnJvbSBiaW5kaW5nIHJvb3QgdG8gdGhlIHJlc2VydmVkIHNsb3RcbiAqIEBwYXJhbSBwdXJlRm5cbiAqIEBwYXJhbSBleHAxXG4gKiBAcGFyYW0gZXhwMlxuICogQHBhcmFtIGV4cDNcbiAqIEBwYXJhbSBleHA0XG4gKiBAcGFyYW0gZXhwNVxuICogQHBhcmFtIHRoaXNBcmcgT3B0aW9uYWwgY2FsbGluZyBjb250ZXh0IG9mIHB1cmVGblxuICogQHJldHVybnMgVXBkYXRlZCBvciBjYWNoZWQgdmFsdWVcbiAqXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtXB1cmVGdW5jdGlvbjUoXG4gIHNsb3RPZmZzZXQ6IG51bWJlcixcbiAgcHVyZUZuOiAodjE6IGFueSwgdjI6IGFueSwgdjM6IGFueSwgdjQ6IGFueSwgdjU6IGFueSkgPT4gYW55LFxuICBleHAxOiBhbnksXG4gIGV4cDI6IGFueSxcbiAgZXhwMzogYW55LFxuICBleHA0OiBhbnksXG4gIGV4cDU6IGFueSxcbiAgdGhpc0FyZz86IGFueSxcbik6IGFueSB7XG4gIGNvbnN0IGJpbmRpbmdJbmRleCA9IGdldEJpbmRpbmdSb290KCkgKyBzbG90T2Zmc2V0O1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGRpZmZlcmVudCA9IGJpbmRpbmdVcGRhdGVkNChsVmlldywgYmluZGluZ0luZGV4LCBleHAxLCBleHAyLCBleHAzLCBleHA0KTtcbiAgcmV0dXJuIGJpbmRpbmdVcGRhdGVkKGxWaWV3LCBiaW5kaW5nSW5kZXggKyA0LCBleHA1KSB8fCBkaWZmZXJlbnRcbiAgICA/IHVwZGF0ZUJpbmRpbmcoXG4gICAgICAgIGxWaWV3LFxuICAgICAgICBiaW5kaW5nSW5kZXggKyA1LFxuICAgICAgICB0aGlzQXJnXG4gICAgICAgICAgPyBwdXJlRm4uY2FsbCh0aGlzQXJnLCBleHAxLCBleHAyLCBleHAzLCBleHA0LCBleHA1KVxuICAgICAgICAgIDogcHVyZUZuKGV4cDEsIGV4cDIsIGV4cDMsIGV4cDQsIGV4cDUpLFxuICAgICAgKVxuICAgIDogZ2V0QmluZGluZyhsVmlldywgYmluZGluZ0luZGV4ICsgNSk7XG59XG5cbi8qKlxuICogSWYgdGhlIHZhbHVlIG9mIGFueSBwcm92aWRlZCBleHAgaGFzIGNoYW5nZWQsIGNhbGxzIHRoZSBwdXJlIGZ1bmN0aW9uIHRvIHJldHVyblxuICogYW4gdXBkYXRlZCB2YWx1ZS4gT3IgaWYgbm8gdmFsdWVzIGhhdmUgY2hhbmdlZCwgcmV0dXJucyBjYWNoZWQgdmFsdWUuXG4gKlxuICogQHBhcmFtIHNsb3RPZmZzZXQgdGhlIG9mZnNldCBmcm9tIGJpbmRpbmcgcm9vdCB0byB0aGUgcmVzZXJ2ZWQgc2xvdFxuICogQHBhcmFtIHB1cmVGblxuICogQHBhcmFtIGV4cDFcbiAqIEBwYXJhbSBleHAyXG4gKiBAcGFyYW0gZXhwM1xuICogQHBhcmFtIGV4cDRcbiAqIEBwYXJhbSBleHA1XG4gKiBAcGFyYW0gZXhwNlxuICogQHBhcmFtIHRoaXNBcmcgT3B0aW9uYWwgY2FsbGluZyBjb250ZXh0IG9mIHB1cmVGblxuICogQHJldHVybnMgVXBkYXRlZCBvciBjYWNoZWQgdmFsdWVcbiAqXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtXB1cmVGdW5jdGlvbjYoXG4gIHNsb3RPZmZzZXQ6IG51bWJlcixcbiAgcHVyZUZuOiAodjE6IGFueSwgdjI6IGFueSwgdjM6IGFueSwgdjQ6IGFueSwgdjU6IGFueSwgdjY6IGFueSkgPT4gYW55LFxuICBleHAxOiBhbnksXG4gIGV4cDI6IGFueSxcbiAgZXhwMzogYW55LFxuICBleHA0OiBhbnksXG4gIGV4cDU6IGFueSxcbiAgZXhwNjogYW55LFxuICB0aGlzQXJnPzogYW55LFxuKTogYW55IHtcbiAgY29uc3QgYmluZGluZ0luZGV4ID0gZ2V0QmluZGluZ1Jvb3QoKSArIHNsb3RPZmZzZXQ7XG4gIGNvbnN0IGxWaWV3ID0gZ2V0TFZpZXcoKTtcbiAgY29uc3QgZGlmZmVyZW50ID0gYmluZGluZ1VwZGF0ZWQ0KGxWaWV3LCBiaW5kaW5nSW5kZXgsIGV4cDEsIGV4cDIsIGV4cDMsIGV4cDQpO1xuICByZXR1cm4gYmluZGluZ1VwZGF0ZWQyKGxWaWV3LCBiaW5kaW5nSW5kZXggKyA0LCBleHA1LCBleHA2KSB8fCBkaWZmZXJlbnRcbiAgICA/IHVwZGF0ZUJpbmRpbmcoXG4gICAgICAgIGxWaWV3LFxuICAgICAgICBiaW5kaW5nSW5kZXggKyA2LFxuICAgICAgICB0aGlzQXJnXG4gICAgICAgICAgPyBwdXJlRm4uY2FsbCh0aGlzQXJnLCBleHAxLCBleHAyLCBleHAzLCBleHA0LCBleHA1LCBleHA2KVxuICAgICAgICAgIDogcHVyZUZuKGV4cDEsIGV4cDIsIGV4cDMsIGV4cDQsIGV4cDUsIGV4cDYpLFxuICAgICAgKVxuICAgIDogZ2V0QmluZGluZyhsVmlldywgYmluZGluZ0luZGV4ICsgNik7XG59XG5cbi8qKlxuICogSWYgdGhlIHZhbHVlIG9mIGFueSBwcm92aWRlZCBleHAgaGFzIGNoYW5nZWQsIGNhbGxzIHRoZSBwdXJlIGZ1bmN0aW9uIHRvIHJldHVyblxuICogYW4gdXBkYXRlZCB2YWx1ZS4gT3IgaWYgbm8gdmFsdWVzIGhhdmUgY2hhbmdlZCwgcmV0dXJucyBjYWNoZWQgdmFsdWUuXG4gKlxuICogQHBhcmFtIHNsb3RPZmZzZXQgdGhlIG9mZnNldCBmcm9tIGJpbmRpbmcgcm9vdCB0byB0aGUgcmVzZXJ2ZWQgc2xvdFxuICogQHBhcmFtIHB1cmVGblxuICogQHBhcmFtIGV4cDFcbiAqIEBwYXJhbSBleHAyXG4gKiBAcGFyYW0gZXhwM1xuICogQHBhcmFtIGV4cDRcbiAqIEBwYXJhbSBleHA1XG4gKiBAcGFyYW0gZXhwNlxuICogQHBhcmFtIGV4cDdcbiAqIEBwYXJhbSB0aGlzQXJnIE9wdGlvbmFsIGNhbGxpbmcgY29udGV4dCBvZiBwdXJlRm5cbiAqIEByZXR1cm5zIFVwZGF0ZWQgb3IgY2FjaGVkIHZhbHVlXG4gKlxuICogQGNvZGVHZW5BcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybVwdXJlRnVuY3Rpb243KFxuICBzbG90T2Zmc2V0OiBudW1iZXIsXG4gIHB1cmVGbjogKHYxOiBhbnksIHYyOiBhbnksIHYzOiBhbnksIHY0OiBhbnksIHY1OiBhbnksIHY2OiBhbnksIHY3OiBhbnkpID0+IGFueSxcbiAgZXhwMTogYW55LFxuICBleHAyOiBhbnksXG4gIGV4cDM6IGFueSxcbiAgZXhwNDogYW55LFxuICBleHA1OiBhbnksXG4gIGV4cDY6IGFueSxcbiAgZXhwNzogYW55LFxuICB0aGlzQXJnPzogYW55LFxuKTogYW55IHtcbiAgY29uc3QgYmluZGluZ0luZGV4ID0gZ2V0QmluZGluZ1Jvb3QoKSArIHNsb3RPZmZzZXQ7XG4gIGNvbnN0IGxWaWV3ID0gZ2V0TFZpZXcoKTtcbiAgbGV0IGRpZmZlcmVudCA9IGJpbmRpbmdVcGRhdGVkNChsVmlldywgYmluZGluZ0luZGV4LCBleHAxLCBleHAyLCBleHAzLCBleHA0KTtcbiAgcmV0dXJuIGJpbmRpbmdVcGRhdGVkMyhsVmlldywgYmluZGluZ0luZGV4ICsgNCwgZXhwNSwgZXhwNiwgZXhwNykgfHwgZGlmZmVyZW50XG4gICAgPyB1cGRhdGVCaW5kaW5nKFxuICAgICAgICBsVmlldyxcbiAgICAgICAgYmluZGluZ0luZGV4ICsgNyxcbiAgICAgICAgdGhpc0FyZ1xuICAgICAgICAgID8gcHVyZUZuLmNhbGwodGhpc0FyZywgZXhwMSwgZXhwMiwgZXhwMywgZXhwNCwgZXhwNSwgZXhwNiwgZXhwNylcbiAgICAgICAgICA6IHB1cmVGbihleHAxLCBleHAyLCBleHAzLCBleHA0LCBleHA1LCBleHA2LCBleHA3KSxcbiAgICAgIClcbiAgICA6IGdldEJpbmRpbmcobFZpZXcsIGJpbmRpbmdJbmRleCArIDcpO1xufVxuXG4vKipcbiAqIElmIHRoZSB2YWx1ZSBvZiBhbnkgcHJvdmlkZWQgZXhwIGhhcyBjaGFuZ2VkLCBjYWxscyB0aGUgcHVyZSBmdW5jdGlvbiB0byByZXR1cm5cbiAqIGFuIHVwZGF0ZWQgdmFsdWUuIE9yIGlmIG5vIHZhbHVlcyBoYXZlIGNoYW5nZWQsIHJldHVybnMgY2FjaGVkIHZhbHVlLlxuICpcbiAqIEBwYXJhbSBzbG90T2Zmc2V0IHRoZSBvZmZzZXQgZnJvbSBiaW5kaW5nIHJvb3QgdG8gdGhlIHJlc2VydmVkIHNsb3RcbiAqIEBwYXJhbSBwdXJlRm5cbiAqIEBwYXJhbSBleHAxXG4gKiBAcGFyYW0gZXhwMlxuICogQHBhcmFtIGV4cDNcbiAqIEBwYXJhbSBleHA0XG4gKiBAcGFyYW0gZXhwNVxuICogQHBhcmFtIGV4cDZcbiAqIEBwYXJhbSBleHA3XG4gKiBAcGFyYW0gZXhwOFxuICogQHBhcmFtIHRoaXNBcmcgT3B0aW9uYWwgY2FsbGluZyBjb250ZXh0IG9mIHB1cmVGblxuICogQHJldHVybnMgVXBkYXRlZCBvciBjYWNoZWQgdmFsdWVcbiAqXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtXB1cmVGdW5jdGlvbjgoXG4gIHNsb3RPZmZzZXQ6IG51bWJlcixcbiAgcHVyZUZuOiAodjE6IGFueSwgdjI6IGFueSwgdjM6IGFueSwgdjQ6IGFueSwgdjU6IGFueSwgdjY6IGFueSwgdjc6IGFueSwgdjg6IGFueSkgPT4gYW55LFxuICBleHAxOiBhbnksXG4gIGV4cDI6IGFueSxcbiAgZXhwMzogYW55LFxuICBleHA0OiBhbnksXG4gIGV4cDU6IGFueSxcbiAgZXhwNjogYW55LFxuICBleHA3OiBhbnksXG4gIGV4cDg6IGFueSxcbiAgdGhpc0FyZz86IGFueSxcbik6IGFueSB7XG4gIGNvbnN0IGJpbmRpbmdJbmRleCA9IGdldEJpbmRpbmdSb290KCkgKyBzbG90T2Zmc2V0O1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGRpZmZlcmVudCA9IGJpbmRpbmdVcGRhdGVkNChsVmlldywgYmluZGluZ0luZGV4LCBleHAxLCBleHAyLCBleHAzLCBleHA0KTtcbiAgcmV0dXJuIGJpbmRpbmdVcGRhdGVkNChsVmlldywgYmluZGluZ0luZGV4ICsgNCwgZXhwNSwgZXhwNiwgZXhwNywgZXhwOCkgfHwgZGlmZmVyZW50XG4gICAgPyB1cGRhdGVCaW5kaW5nKFxuICAgICAgICBsVmlldyxcbiAgICAgICAgYmluZGluZ0luZGV4ICsgOCxcbiAgICAgICAgdGhpc0FyZ1xuICAgICAgICAgID8gcHVyZUZuLmNhbGwodGhpc0FyZywgZXhwMSwgZXhwMiwgZXhwMywgZXhwNCwgZXhwNSwgZXhwNiwgZXhwNywgZXhwOClcbiAgICAgICAgICA6IHB1cmVGbihleHAxLCBleHAyLCBleHAzLCBleHA0LCBleHA1LCBleHA2LCBleHA3LCBleHA4KSxcbiAgICAgIClcbiAgICA6IGdldEJpbmRpbmcobFZpZXcsIGJpbmRpbmdJbmRleCArIDgpO1xufVxuXG4vKipcbiAqIHB1cmVGdW5jdGlvbiBpbnN0cnVjdGlvbiB0aGF0IGNhbiBzdXBwb3J0IGFueSBudW1iZXIgb2YgYmluZGluZ3MuXG4gKlxuICogSWYgdGhlIHZhbHVlIG9mIGFueSBwcm92aWRlZCBleHAgaGFzIGNoYW5nZWQsIGNhbGxzIHRoZSBwdXJlIGZ1bmN0aW9uIHRvIHJldHVyblxuICogYW4gdXBkYXRlZCB2YWx1ZS4gT3IgaWYgbm8gdmFsdWVzIGhhdmUgY2hhbmdlZCwgcmV0dXJucyBjYWNoZWQgdmFsdWUuXG4gKlxuICogQHBhcmFtIHNsb3RPZmZzZXQgdGhlIG9mZnNldCBmcm9tIGJpbmRpbmcgcm9vdCB0byB0aGUgcmVzZXJ2ZWQgc2xvdFxuICogQHBhcmFtIHB1cmVGbiBBIHB1cmUgZnVuY3Rpb24gdGhhdCB0YWtlcyBiaW5kaW5nIHZhbHVlcyBhbmQgYnVpbGRzIGFuIG9iamVjdCBvciBhcnJheVxuICogY29udGFpbmluZyB0aG9zZSB2YWx1ZXMuXG4gKiBAcGFyYW0gZXhwcyBBbiBhcnJheSBvZiBiaW5kaW5nIHZhbHVlc1xuICogQHBhcmFtIHRoaXNBcmcgT3B0aW9uYWwgY2FsbGluZyBjb250ZXh0IG9mIHB1cmVGblxuICogQHJldHVybnMgVXBkYXRlZCBvciBjYWNoZWQgdmFsdWVcbiAqXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtXB1cmVGdW5jdGlvblYoXG4gIHNsb3RPZmZzZXQ6IG51bWJlcixcbiAgcHVyZUZuOiAoLi4udjogYW55W10pID0+IGFueSxcbiAgZXhwczogYW55W10sXG4gIHRoaXNBcmc/OiBhbnksXG4pOiBhbnkge1xuICByZXR1cm4gcHVyZUZ1bmN0aW9uVkludGVybmFsKGdldExWaWV3KCksIGdldEJpbmRpbmdSb290KCksIHNsb3RPZmZzZXQsIHB1cmVGbiwgZXhwcywgdGhpc0FyZyk7XG59XG5cbi8qKlxuICogUmVzdWx0cyBvZiBhIHB1cmUgZnVuY3Rpb24gaW52b2NhdGlvbiBhcmUgc3RvcmVkIGluIExWaWV3IGluIGEgZGVkaWNhdGVkIHNsb3QgdGhhdCBpcyBpbml0aWFsaXplZFxuICogdG8gTk9fQ0hBTkdFLiBJbiByYXJlIHNpdHVhdGlvbnMgYSBwdXJlIHBpcGUgbWlnaHQgdGhyb3cgYW4gZXhjZXB0aW9uIG9uIHRoZSB2ZXJ5IGZpcnN0XG4gKiBpbnZvY2F0aW9uIGFuZCBub3QgcHJvZHVjZSBhbnkgdmFsaWQgcmVzdWx0cy4gSW4gdGhpcyBjYXNlIExWaWV3IHdvdWxkIGtlZXAgaG9sZGluZyB0aGUgTk9fQ0hBTkdFXG4gKiB2YWx1ZS4gVGhlIE5PX0NIQU5HRSBpcyBub3Qgc29tZXRoaW5nIHRoYXQgd2UgY2FuIHVzZSBpbiBleHByZXNzaW9ucyAvIGJpbmRpbmdzIHRodXMgd2UgY29udmVydFxuICogaXQgdG8gYHVuZGVmaW5lZGAuXG4gKi9cbmZ1bmN0aW9uIGdldFB1cmVGdW5jdGlvblJldHVyblZhbHVlKGxWaWV3OiBMVmlldywgcmV0dXJuVmFsdWVJbmRleDogbnVtYmVyKSB7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnRJbmRleEluUmFuZ2UobFZpZXcsIHJldHVyblZhbHVlSW5kZXgpO1xuICBjb25zdCBsYXN0UmV0dXJuVmFsdWUgPSBsVmlld1tyZXR1cm5WYWx1ZUluZGV4XTtcbiAgcmV0dXJuIGxhc3RSZXR1cm5WYWx1ZSA9PT0gTk9fQ0hBTkdFID8gdW5kZWZpbmVkIDogbGFzdFJldHVyblZhbHVlO1xufVxuXG4vKipcbiAqIElmIHRoZSB2YWx1ZSBvZiB0aGUgcHJvdmlkZWQgZXhwIGhhcyBjaGFuZ2VkLCBjYWxscyB0aGUgcHVyZSBmdW5jdGlvbiB0byByZXR1cm5cbiAqIGFuIHVwZGF0ZWQgdmFsdWUuIE9yIGlmIHRoZSB2YWx1ZSBoYXMgbm90IGNoYW5nZWQsIHJldHVybnMgY2FjaGVkIHZhbHVlLlxuICpcbiAqIEBwYXJhbSBsVmlldyBMVmlldyBpbiB3aGljaCB0aGUgZnVuY3Rpb24gaXMgYmVpbmcgZXhlY3V0ZWQuXG4gKiBAcGFyYW0gYmluZGluZ1Jvb3QgQmluZGluZyByb290IGluZGV4LlxuICogQHBhcmFtIHNsb3RPZmZzZXQgdGhlIG9mZnNldCBmcm9tIGJpbmRpbmcgcm9vdCB0byB0aGUgcmVzZXJ2ZWQgc2xvdFxuICogQHBhcmFtIHB1cmVGbiBGdW5jdGlvbiB0aGF0IHJldHVybnMgYW4gdXBkYXRlZCB2YWx1ZVxuICogQHBhcmFtIGV4cCBVcGRhdGVkIGV4cHJlc3Npb24gdmFsdWVcbiAqIEBwYXJhbSB0aGlzQXJnIE9wdGlvbmFsIGNhbGxpbmcgY29udGV4dCBvZiBwdXJlRm5cbiAqIEByZXR1cm5zIFVwZGF0ZWQgb3IgY2FjaGVkIHZhbHVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwdXJlRnVuY3Rpb24xSW50ZXJuYWwoXG4gIGxWaWV3OiBMVmlldyxcbiAgYmluZGluZ1Jvb3Q6IG51bWJlcixcbiAgc2xvdE9mZnNldDogbnVtYmVyLFxuICBwdXJlRm46ICh2OiBhbnkpID0+IGFueSxcbiAgZXhwOiBhbnksXG4gIHRoaXNBcmc/OiBhbnksXG4pOiBhbnkge1xuICBjb25zdCBiaW5kaW5nSW5kZXggPSBiaW5kaW5nUm9vdCArIHNsb3RPZmZzZXQ7XG4gIHJldHVybiBiaW5kaW5nVXBkYXRlZChsVmlldywgYmluZGluZ0luZGV4LCBleHApXG4gICAgPyB1cGRhdGVCaW5kaW5nKGxWaWV3LCBiaW5kaW5nSW5kZXggKyAxLCB0aGlzQXJnID8gcHVyZUZuLmNhbGwodGhpc0FyZywgZXhwKSA6IHB1cmVGbihleHApKVxuICAgIDogZ2V0UHVyZUZ1bmN0aW9uUmV0dXJuVmFsdWUobFZpZXcsIGJpbmRpbmdJbmRleCArIDEpO1xufVxuXG4vKipcbiAqIElmIHRoZSB2YWx1ZSBvZiBhbnkgcHJvdmlkZWQgZXhwIGhhcyBjaGFuZ2VkLCBjYWxscyB0aGUgcHVyZSBmdW5jdGlvbiB0byByZXR1cm5cbiAqIGFuIHVwZGF0ZWQgdmFsdWUuIE9yIGlmIG5vIHZhbHVlcyBoYXZlIGNoYW5nZWQsIHJldHVybnMgY2FjaGVkIHZhbHVlLlxuICpcbiAqIEBwYXJhbSBsVmlldyBMVmlldyBpbiB3aGljaCB0aGUgZnVuY3Rpb24gaXMgYmVpbmcgZXhlY3V0ZWQuXG4gKiBAcGFyYW0gYmluZGluZ1Jvb3QgQmluZGluZyByb290IGluZGV4LlxuICogQHBhcmFtIHNsb3RPZmZzZXQgdGhlIG9mZnNldCBmcm9tIGJpbmRpbmcgcm9vdCB0byB0aGUgcmVzZXJ2ZWQgc2xvdFxuICogQHBhcmFtIHB1cmVGblxuICogQHBhcmFtIGV4cDFcbiAqIEBwYXJhbSBleHAyXG4gKiBAcGFyYW0gdGhpc0FyZyBPcHRpb25hbCBjYWxsaW5nIGNvbnRleHQgb2YgcHVyZUZuXG4gKiBAcmV0dXJucyBVcGRhdGVkIG9yIGNhY2hlZCB2YWx1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcHVyZUZ1bmN0aW9uMkludGVybmFsKFxuICBsVmlldzogTFZpZXcsXG4gIGJpbmRpbmdSb290OiBudW1iZXIsXG4gIHNsb3RPZmZzZXQ6IG51bWJlcixcbiAgcHVyZUZuOiAodjE6IGFueSwgdjI6IGFueSkgPT4gYW55LFxuICBleHAxOiBhbnksXG4gIGV4cDI6IGFueSxcbiAgdGhpc0FyZz86IGFueSxcbik6IGFueSB7XG4gIGNvbnN0IGJpbmRpbmdJbmRleCA9IGJpbmRpbmdSb290ICsgc2xvdE9mZnNldDtcbiAgcmV0dXJuIGJpbmRpbmdVcGRhdGVkMihsVmlldywgYmluZGluZ0luZGV4LCBleHAxLCBleHAyKVxuICAgID8gdXBkYXRlQmluZGluZyhcbiAgICAgICAgbFZpZXcsXG4gICAgICAgIGJpbmRpbmdJbmRleCArIDIsXG4gICAgICAgIHRoaXNBcmcgPyBwdXJlRm4uY2FsbCh0aGlzQXJnLCBleHAxLCBleHAyKSA6IHB1cmVGbihleHAxLCBleHAyKSxcbiAgICAgIClcbiAgICA6IGdldFB1cmVGdW5jdGlvblJldHVyblZhbHVlKGxWaWV3LCBiaW5kaW5nSW5kZXggKyAyKTtcbn1cblxuLyoqXG4gKiBJZiB0aGUgdmFsdWUgb2YgYW55IHByb3ZpZGVkIGV4cCBoYXMgY2hhbmdlZCwgY2FsbHMgdGhlIHB1cmUgZnVuY3Rpb24gdG8gcmV0dXJuXG4gKiBhbiB1cGRhdGVkIHZhbHVlLiBPciBpZiBubyB2YWx1ZXMgaGF2ZSBjaGFuZ2VkLCByZXR1cm5zIGNhY2hlZCB2YWx1ZS5cbiAqXG4gKiBAcGFyYW0gbFZpZXcgTFZpZXcgaW4gd2hpY2ggdGhlIGZ1bmN0aW9uIGlzIGJlaW5nIGV4ZWN1dGVkLlxuICogQHBhcmFtIGJpbmRpbmdSb290IEJpbmRpbmcgcm9vdCBpbmRleC5cbiAqIEBwYXJhbSBzbG90T2Zmc2V0IHRoZSBvZmZzZXQgZnJvbSBiaW5kaW5nIHJvb3QgdG8gdGhlIHJlc2VydmVkIHNsb3RcbiAqIEBwYXJhbSBwdXJlRm5cbiAqIEBwYXJhbSBleHAxXG4gKiBAcGFyYW0gZXhwMlxuICogQHBhcmFtIGV4cDNcbiAqIEBwYXJhbSB0aGlzQXJnIE9wdGlvbmFsIGNhbGxpbmcgY29udGV4dCBvZiBwdXJlRm5cbiAqIEByZXR1cm5zIFVwZGF0ZWQgb3IgY2FjaGVkIHZhbHVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwdXJlRnVuY3Rpb24zSW50ZXJuYWwoXG4gIGxWaWV3OiBMVmlldyxcbiAgYmluZGluZ1Jvb3Q6IG51bWJlcixcbiAgc2xvdE9mZnNldDogbnVtYmVyLFxuICBwdXJlRm46ICh2MTogYW55LCB2MjogYW55LCB2MzogYW55KSA9PiBhbnksXG4gIGV4cDE6IGFueSxcbiAgZXhwMjogYW55LFxuICBleHAzOiBhbnksXG4gIHRoaXNBcmc/OiBhbnksXG4pOiBhbnkge1xuICBjb25zdCBiaW5kaW5nSW5kZXggPSBiaW5kaW5nUm9vdCArIHNsb3RPZmZzZXQ7XG4gIHJldHVybiBiaW5kaW5nVXBkYXRlZDMobFZpZXcsIGJpbmRpbmdJbmRleCwgZXhwMSwgZXhwMiwgZXhwMylcbiAgICA/IHVwZGF0ZUJpbmRpbmcoXG4gICAgICAgIGxWaWV3LFxuICAgICAgICBiaW5kaW5nSW5kZXggKyAzLFxuICAgICAgICB0aGlzQXJnID8gcHVyZUZuLmNhbGwodGhpc0FyZywgZXhwMSwgZXhwMiwgZXhwMykgOiBwdXJlRm4oZXhwMSwgZXhwMiwgZXhwMyksXG4gICAgICApXG4gICAgOiBnZXRQdXJlRnVuY3Rpb25SZXR1cm5WYWx1ZShsVmlldywgYmluZGluZ0luZGV4ICsgMyk7XG59XG5cbi8qKlxuICogSWYgdGhlIHZhbHVlIG9mIGFueSBwcm92aWRlZCBleHAgaGFzIGNoYW5nZWQsIGNhbGxzIHRoZSBwdXJlIGZ1bmN0aW9uIHRvIHJldHVyblxuICogYW4gdXBkYXRlZCB2YWx1ZS4gT3IgaWYgbm8gdmFsdWVzIGhhdmUgY2hhbmdlZCwgcmV0dXJucyBjYWNoZWQgdmFsdWUuXG4gKlxuICogQHBhcmFtIGxWaWV3IExWaWV3IGluIHdoaWNoIHRoZSBmdW5jdGlvbiBpcyBiZWluZyBleGVjdXRlZC5cbiAqIEBwYXJhbSBiaW5kaW5nUm9vdCBCaW5kaW5nIHJvb3QgaW5kZXguXG4gKiBAcGFyYW0gc2xvdE9mZnNldCB0aGUgb2Zmc2V0IGZyb20gYmluZGluZyByb290IHRvIHRoZSByZXNlcnZlZCBzbG90XG4gKiBAcGFyYW0gcHVyZUZuXG4gKiBAcGFyYW0gZXhwMVxuICogQHBhcmFtIGV4cDJcbiAqIEBwYXJhbSBleHAzXG4gKiBAcGFyYW0gZXhwNFxuICogQHBhcmFtIHRoaXNBcmcgT3B0aW9uYWwgY2FsbGluZyBjb250ZXh0IG9mIHB1cmVGblxuICogQHJldHVybnMgVXBkYXRlZCBvciBjYWNoZWQgdmFsdWVcbiAqXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwdXJlRnVuY3Rpb240SW50ZXJuYWwoXG4gIGxWaWV3OiBMVmlldyxcbiAgYmluZGluZ1Jvb3Q6IG51bWJlcixcbiAgc2xvdE9mZnNldDogbnVtYmVyLFxuICBwdXJlRm46ICh2MTogYW55LCB2MjogYW55LCB2MzogYW55LCB2NDogYW55KSA9PiBhbnksXG4gIGV4cDE6IGFueSxcbiAgZXhwMjogYW55LFxuICBleHAzOiBhbnksXG4gIGV4cDQ6IGFueSxcbiAgdGhpc0FyZz86IGFueSxcbik6IGFueSB7XG4gIGNvbnN0IGJpbmRpbmdJbmRleCA9IGJpbmRpbmdSb290ICsgc2xvdE9mZnNldDtcbiAgcmV0dXJuIGJpbmRpbmdVcGRhdGVkNChsVmlldywgYmluZGluZ0luZGV4LCBleHAxLCBleHAyLCBleHAzLCBleHA0KVxuICAgID8gdXBkYXRlQmluZGluZyhcbiAgICAgICAgbFZpZXcsXG4gICAgICAgIGJpbmRpbmdJbmRleCArIDQsXG4gICAgICAgIHRoaXNBcmcgPyBwdXJlRm4uY2FsbCh0aGlzQXJnLCBleHAxLCBleHAyLCBleHAzLCBleHA0KSA6IHB1cmVGbihleHAxLCBleHAyLCBleHAzLCBleHA0KSxcbiAgICAgIClcbiAgICA6IGdldFB1cmVGdW5jdGlvblJldHVyblZhbHVlKGxWaWV3LCBiaW5kaW5nSW5kZXggKyA0KTtcbn1cblxuLyoqXG4gKiBwdXJlRnVuY3Rpb24gaW5zdHJ1Y3Rpb24gdGhhdCBjYW4gc3VwcG9ydCBhbnkgbnVtYmVyIG9mIGJpbmRpbmdzLlxuICpcbiAqIElmIHRoZSB2YWx1ZSBvZiBhbnkgcHJvdmlkZWQgZXhwIGhhcyBjaGFuZ2VkLCBjYWxscyB0aGUgcHVyZSBmdW5jdGlvbiB0byByZXR1cm5cbiAqIGFuIHVwZGF0ZWQgdmFsdWUuIE9yIGlmIG5vIHZhbHVlcyBoYXZlIGNoYW5nZWQsIHJldHVybnMgY2FjaGVkIHZhbHVlLlxuICpcbiAqIEBwYXJhbSBsVmlldyBMVmlldyBpbiB3aGljaCB0aGUgZnVuY3Rpb24gaXMgYmVpbmcgZXhlY3V0ZWQuXG4gKiBAcGFyYW0gYmluZGluZ1Jvb3QgQmluZGluZyByb290IGluZGV4LlxuICogQHBhcmFtIHNsb3RPZmZzZXQgdGhlIG9mZnNldCBmcm9tIGJpbmRpbmcgcm9vdCB0byB0aGUgcmVzZXJ2ZWQgc2xvdFxuICogQHBhcmFtIHB1cmVGbiBBIHB1cmUgZnVuY3Rpb24gdGhhdCB0YWtlcyBiaW5kaW5nIHZhbHVlcyBhbmQgYnVpbGRzIGFuIG9iamVjdCBvciBhcnJheVxuICogY29udGFpbmluZyB0aG9zZSB2YWx1ZXMuXG4gKiBAcGFyYW0gZXhwcyBBbiBhcnJheSBvZiBiaW5kaW5nIHZhbHVlc1xuICogQHBhcmFtIHRoaXNBcmcgT3B0aW9uYWwgY2FsbGluZyBjb250ZXh0IG9mIHB1cmVGblxuICogQHJldHVybnMgVXBkYXRlZCBvciBjYWNoZWQgdmFsdWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHB1cmVGdW5jdGlvblZJbnRlcm5hbChcbiAgbFZpZXc6IExWaWV3LFxuICBiaW5kaW5nUm9vdDogbnVtYmVyLFxuICBzbG90T2Zmc2V0OiBudW1iZXIsXG4gIHB1cmVGbjogKC4uLnY6IGFueVtdKSA9PiBhbnksXG4gIGV4cHM6IGFueVtdLFxuICB0aGlzQXJnPzogYW55LFxuKTogYW55IHtcbiAgbGV0IGJpbmRpbmdJbmRleCA9IGJpbmRpbmdSb290ICsgc2xvdE9mZnNldDtcbiAgbGV0IGRpZmZlcmVudCA9IGZhbHNlO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cHMubGVuZ3RoOyBpKyspIHtcbiAgICBiaW5kaW5nVXBkYXRlZChsVmlldywgYmluZGluZ0luZGV4KyssIGV4cHNbaV0pICYmIChkaWZmZXJlbnQgPSB0cnVlKTtcbiAgfVxuICByZXR1cm4gZGlmZmVyZW50XG4gICAgPyB1cGRhdGVCaW5kaW5nKGxWaWV3LCBiaW5kaW5nSW5kZXgsIHB1cmVGbi5hcHBseSh0aGlzQXJnLCBleHBzKSlcbiAgICA6IGdldFB1cmVGdW5jdGlvblJldHVyblZhbHVlKGxWaWV3LCBiaW5kaW5nSW5kZXgpO1xufVxuIl19