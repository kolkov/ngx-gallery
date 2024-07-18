/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { getLView, getSelectedIndex } from '../state';
import { NO_CHANGE } from '../tokens';
import { interpolation1, interpolation2, interpolation3, interpolation4, interpolation5, interpolation6, interpolation7, interpolation8, interpolationV, } from './interpolation';
import { textBindingInternal } from './shared';
/**
 *
 * Update text content with a lone bound value
 *
 * Used when a text node has 1 interpolated value in it, an no additional text
 * surrounds that interpolated value:
 *
 * ```html
 * <div>{{v0}}</div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵtextInterpolate(v0);
 * ```
 * @returns itself, so that it may be chained.
 * @see textInterpolateV
 * @codeGenApi
 */
export function ɵɵtextInterpolate(v0) {
    ɵɵtextInterpolate1('', v0, '');
    return ɵɵtextInterpolate;
}
/**
 *
 * Update text content with single bound value surrounded by other text.
 *
 * Used when a text node has 1 interpolated value in it:
 *
 * ```html
 * <div>prefix{{v0}}suffix</div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵtextInterpolate1('prefix', v0, 'suffix');
 * ```
 * @returns itself, so that it may be chained.
 * @see textInterpolateV
 * @codeGenApi
 */
export function ɵɵtextInterpolate1(prefix, v0, suffix) {
    const lView = getLView();
    const interpolated = interpolation1(lView, prefix, v0, suffix);
    if (interpolated !== NO_CHANGE) {
        textBindingInternal(lView, getSelectedIndex(), interpolated);
    }
    return ɵɵtextInterpolate1;
}
/**
 *
 * Update text content with 2 bound values surrounded by other text.
 *
 * Used when a text node has 2 interpolated values in it:
 *
 * ```html
 * <div>prefix{{v0}}-{{v1}}suffix</div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵtextInterpolate2('prefix', v0, '-', v1, 'suffix');
 * ```
 * @returns itself, so that it may be chained.
 * @see textInterpolateV
 * @codeGenApi
 */
export function ɵɵtextInterpolate2(prefix, v0, i0, v1, suffix) {
    const lView = getLView();
    const interpolated = interpolation2(lView, prefix, v0, i0, v1, suffix);
    if (interpolated !== NO_CHANGE) {
        textBindingInternal(lView, getSelectedIndex(), interpolated);
    }
    return ɵɵtextInterpolate2;
}
/**
 *
 * Update text content with 3 bound values surrounded by other text.
 *
 * Used when a text node has 3 interpolated values in it:
 *
 * ```html
 * <div>prefix{{v0}}-{{v1}}-{{v2}}suffix</div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵtextInterpolate3(
 * 'prefix', v0, '-', v1, '-', v2, 'suffix');
 * ```
 * @returns itself, so that it may be chained.
 * @see textInterpolateV
 * @codeGenApi
 */
export function ɵɵtextInterpolate3(prefix, v0, i0, v1, i1, v2, suffix) {
    const lView = getLView();
    const interpolated = interpolation3(lView, prefix, v0, i0, v1, i1, v2, suffix);
    if (interpolated !== NO_CHANGE) {
        textBindingInternal(lView, getSelectedIndex(), interpolated);
    }
    return ɵɵtextInterpolate3;
}
/**
 *
 * Update text content with 4 bound values surrounded by other text.
 *
 * Used when a text node has 4 interpolated values in it:
 *
 * ```html
 * <div>prefix{{v0}}-{{v1}}-{{v2}}-{{v3}}suffix</div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵtextInterpolate4(
 * 'prefix', v0, '-', v1, '-', v2, '-', v3, 'suffix');
 * ```
 * @returns itself, so that it may be chained.
 * @see ɵɵtextInterpolateV
 * @codeGenApi
 */
export function ɵɵtextInterpolate4(prefix, v0, i0, v1, i1, v2, i2, v3, suffix) {
    const lView = getLView();
    const interpolated = interpolation4(lView, prefix, v0, i0, v1, i1, v2, i2, v3, suffix);
    if (interpolated !== NO_CHANGE) {
        textBindingInternal(lView, getSelectedIndex(), interpolated);
    }
    return ɵɵtextInterpolate4;
}
/**
 *
 * Update text content with 5 bound values surrounded by other text.
 *
 * Used when a text node has 5 interpolated values in it:
 *
 * ```html
 * <div>prefix{{v0}}-{{v1}}-{{v2}}-{{v3}}-{{v4}}suffix</div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵtextInterpolate5(
 * 'prefix', v0, '-', v1, '-', v2, '-', v3, '-', v4, 'suffix');
 * ```
 * @returns itself, so that it may be chained.
 * @see textInterpolateV
 * @codeGenApi
 */
export function ɵɵtextInterpolate5(prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, suffix) {
    const lView = getLView();
    const interpolated = interpolation5(lView, prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, suffix);
    if (interpolated !== NO_CHANGE) {
        textBindingInternal(lView, getSelectedIndex(), interpolated);
    }
    return ɵɵtextInterpolate5;
}
/**
 *
 * Update text content with 6 bound values surrounded by other text.
 *
 * Used when a text node has 6 interpolated values in it:
 *
 * ```html
 * <div>prefix{{v0}}-{{v1}}-{{v2}}-{{v3}}-{{v4}}-{{v5}}suffix</div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵtextInterpolate6(
 *    'prefix', v0, '-', v1, '-', v2, '-', v3, '-', v4, '-', v5, 'suffix');
 * ```
 *
 * @param i4 Static value used for concatenation only.
 * @param v5 Value checked for change. @returns itself, so that it may be chained.
 * @see textInterpolateV
 * @codeGenApi
 */
export function ɵɵtextInterpolate6(prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, i4, v5, suffix) {
    const lView = getLView();
    const interpolated = interpolation6(lView, prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, i4, v5, suffix);
    if (interpolated !== NO_CHANGE) {
        textBindingInternal(lView, getSelectedIndex(), interpolated);
    }
    return ɵɵtextInterpolate6;
}
/**
 *
 * Update text content with 7 bound values surrounded by other text.
 *
 * Used when a text node has 7 interpolated values in it:
 *
 * ```html
 * <div>prefix{{v0}}-{{v1}}-{{v2}}-{{v3}}-{{v4}}-{{v5}}-{{v6}}suffix</div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵtextInterpolate7(
 *    'prefix', v0, '-', v1, '-', v2, '-', v3, '-', v4, '-', v5, '-', v6, 'suffix');
 * ```
 * @returns itself, so that it may be chained.
 * @see textInterpolateV
 * @codeGenApi
 */
export function ɵɵtextInterpolate7(prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, i4, v5, i5, v6, suffix) {
    const lView = getLView();
    const interpolated = interpolation7(lView, prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, i4, v5, i5, v6, suffix);
    if (interpolated !== NO_CHANGE) {
        textBindingInternal(lView, getSelectedIndex(), interpolated);
    }
    return ɵɵtextInterpolate7;
}
/**
 *
 * Update text content with 8 bound values surrounded by other text.
 *
 * Used when a text node has 8 interpolated values in it:
 *
 * ```html
 * <div>prefix{{v0}}-{{v1}}-{{v2}}-{{v3}}-{{v4}}-{{v5}}-{{v6}}-{{v7}}suffix</div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵtextInterpolate8(
 *  'prefix', v0, '-', v1, '-', v2, '-', v3, '-', v4, '-', v5, '-', v6, '-', v7, 'suffix');
 * ```
 * @returns itself, so that it may be chained.
 * @see textInterpolateV
 * @codeGenApi
 */
export function ɵɵtextInterpolate8(prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, i4, v5, i5, v6, i6, v7, suffix) {
    const lView = getLView();
    const interpolated = interpolation8(lView, prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, i4, v5, i5, v6, i6, v7, suffix);
    if (interpolated !== NO_CHANGE) {
        textBindingInternal(lView, getSelectedIndex(), interpolated);
    }
    return ɵɵtextInterpolate8;
}
/**
 * Update text content with 9 or more bound values other surrounded by text.
 *
 * Used when the number of interpolated values exceeds 8.
 *
 * ```html
 * <div>prefix{{v0}}-{{v1}}-{{v2}}-{{v3}}-{{v4}}-{{v5}}-{{v6}}-{{v7}}-{{v8}}-{{v9}}suffix</div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵtextInterpolateV(
 *  ['prefix', v0, '-', v1, '-', v2, '-', v3, '-', v4, '-', v5, '-', v6, '-', v7, '-', v9,
 *  'suffix']);
 * ```
 *.
 * @param values The collection of values and the strings in between those values, beginning with
 * a string prefix and ending with a string suffix.
 * (e.g. `['prefix', value0, '-', value1, '-', value2, ..., value99, 'suffix']`)
 *
 * @returns itself, so that it may be chained.
 * @codeGenApi
 */
export function ɵɵtextInterpolateV(values) {
    const lView = getLView();
    const interpolated = interpolationV(lView, values);
    if (interpolated !== NO_CHANGE) {
        textBindingInternal(lView, getSelectedIndex(), interpolated);
    }
    return ɵɵtextInterpolateV;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dF9pbnRlcnBvbGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9pbnN0cnVjdGlvbnMvdGV4dF9pbnRlcnBvbGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUNILE9BQU8sRUFBQyxRQUFRLEVBQUUsZ0JBQWdCLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFDcEQsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUVwQyxPQUFPLEVBQ0wsY0FBYyxFQUNkLGNBQWMsRUFDZCxjQUFjLEVBQ2QsY0FBYyxFQUNkLGNBQWMsRUFDZCxjQUFjLEVBQ2QsY0FBYyxFQUNkLGNBQWMsRUFDZCxjQUFjLEdBQ2YsTUFBTSxpQkFBaUIsQ0FBQztBQUN6QixPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFFN0M7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FtQkc7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsRUFBTztJQUN2QyxrQkFBa0IsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQy9CLE9BQU8saUJBQWlCLENBQUM7QUFDM0IsQ0FBQztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FrQkc7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQ2hDLE1BQWMsRUFDZCxFQUFPLEVBQ1AsTUFBYztJQUVkLE1BQU0sS0FBSyxHQUFHLFFBQVEsRUFBRSxDQUFDO0lBQ3pCLE1BQU0sWUFBWSxHQUFHLGNBQWMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUMvRCxJQUFJLFlBQVksS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUMvQixtQkFBbUIsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsRUFBRSxZQUFzQixDQUFDLENBQUM7SUFDekUs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Q3pCLE1BQU0sWUFBWSxHQUFHLGNBQWMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDbkQsSUFBSSxZQUFZLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDL0IsbUJBQW1CLENBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLEVBQUUsWUFBc0IsQ0FBQyxDQUFDO0lBQ3pFLENBQUM7SUFDRCxPQUFPLGtCQUFrQixDQUFDO0FBQzVCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7Z2V0TFZpZXcsIGdldFNlbGVjdGVkSW5kZXh9IGZyb20gJy4uL3N0YXRlJztcbmltcG9ydCB7Tk9fQ0hBTkdFfSBmcm9tICcuLi90b2tlbnMnO1xuXG5pbXBvcnQge1xuICBpbnRlcnBvbGF0aW9uMSxcbiAgaW50ZXJwb2xhdGlvbjIsXG4gIGludGVycG9sYXRpb24zLFxuICBpbnRlcnBvbGF0aW9uNCxcbiAgaW50ZXJwb2xhdGlvbjUsXG4gIGludGVycG9sYXRpb242LFxuICBpbnRlcnBvbGF0aW9uNyxcbiAgaW50ZXJwb2xhdGlvbjgsXG4gIGludGVycG9sYXRpb25WLFxufSBmcm9tICcuL2ludGVycG9sYXRpb24nO1xuaW1wb3J0IHt0ZXh0QmluZGluZ0ludGVybmFsfSBmcm9tICcuL3NoYXJlZCc7XG5cbi8qKlxuICpcbiAqIFVwZGF0ZSB0ZXh0IGNvbnRlbnQgd2l0aCBhIGxvbmUgYm91bmQgdmFsdWVcbiAqXG4gKiBVc2VkIHdoZW4gYSB0ZXh0IG5vZGUgaGFzIDEgaW50ZXJwb2xhdGVkIHZhbHVlIGluIGl0LCBhbiBubyBhZGRpdGlvbmFsIHRleHRcbiAqIHN1cnJvdW5kcyB0aGF0IGludGVycG9sYXRlZCB2YWx1ZTpcbiAqXG4gKiBgYGBodG1sXG4gKiA8ZGl2Pnt7djB9fTwvZGl2PlxuICogYGBgXG4gKlxuICogSXRzIGNvbXBpbGVkIHJlcHJlc2VudGF0aW9uIGlzOlxuICpcbiAqIGBgYHRzXG4gKiDJtcm1dGV4dEludGVycG9sYXRlKHYwKTtcbiAqIGBgYFxuICogQHJldHVybnMgaXRzZWxmLCBzbyB0aGF0IGl0IG1heSBiZSBjaGFpbmVkLlxuICogQHNlZSB0ZXh0SW50ZXJwb2xhdGVWXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtXRleHRJbnRlcnBvbGF0ZSh2MDogYW55KTogdHlwZW9mIMm1ybV0ZXh0SW50ZXJwb2xhdGUge1xuICDJtcm1dGV4dEludGVycG9sYXRlMSgnJywgdjAsICcnKTtcbiAgcmV0dXJuIMm1ybV0ZXh0SW50ZXJwb2xhdGU7XG59XG5cbi8qKlxuICpcbiAqIFVwZGF0ZSB0ZXh0IGNvbnRlbnQgd2l0aCBzaW5nbGUgYm91bmQgdmFsdWUgc3Vycm91bmRlZCBieSBvdGhlciB0ZXh0LlxuICpcbiAqIFVzZWQgd2hlbiBhIHRleHQgbm9kZSBoYXMgMSBpbnRlcnBvbGF0ZWQgdmFsdWUgaW4gaXQ6XG4gKlxuICogYGBgaHRtbFxuICogPGRpdj5wcmVmaXh7e3YwfX1zdWZmaXg8L2Rpdj5cbiAqIGBgYFxuICpcbiAqIEl0cyBjb21waWxlZCByZXByZXNlbnRhdGlvbiBpczpcbiAqXG4gKiBgYGB0c1xuICogybXJtXRleHRJbnRlcnBvbGF0ZTEoJ3ByZWZpeCcsIHYwLCAnc3VmZml4Jyk7XG4gKiBgYGBcbiAqIEByZXR1cm5zIGl0c2VsZiwgc28gdGhhdCBpdCBtYXkgYmUgY2hhaW5lZC5cbiAqIEBzZWUgdGV4dEludGVycG9sYXRlVlxuICogQGNvZGVHZW5BcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybV0ZXh0SW50ZXJwb2xhdGUxKFxuICBwcmVmaXg6IHN0cmluZyxcbiAgdjA6IGFueSxcbiAgc3VmZml4OiBzdHJpbmcsXG4pOiB0eXBlb2YgybXJtXRleHRJbnRlcnBvbGF0ZTEge1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGludGVycG9sYXRlZCA9IGludGVycG9sYXRpb24xKGxWaWV3LCBwcmVmaXgsIHYwLCBzdWZmaXgpO1xuICBpZiAoaW50ZXJwb2xhdGVkICE9PSBOT19DSEFOR0UpIHtcbiAgICB0ZXh0QmluZGluZ0ludGVybmFsKGxWaWV3LCBnZXRTZWxlY3RlZEluZGV4KCksIGludGVycG9sYXRlZCBhcyBzdHJpbmcpO1xuICB9XG4gIHJldHVybiDJtcm1dGV4dEludGVycG9sYXRlMTtcbn1cblxuLyoqXG4gKlxuICogVXBkYXRlIHRleHQgY29udGVudCB3aXRoIDIgYm91bmQgdmFsdWVzIHN1cnJvdW5kZWQgYnkgb3RoZXIgdGV4dC5cbiAqXG4gKiBVc2VkIHdoZW4gYSB0ZXh0IG5vZGUgaGFzIDIgaW50ZXJwb2xhdGVkIHZhbHVlcyBpbiBpdDpcbiAqXG4gKiBgYGBodG1sXG4gKiA8ZGl2PnByZWZpeHt7djB9fS17e3YxfX1zdWZmaXg8L2Rpdj5cbiAqIGBgYFxuICpcbiAqIEl0cyBjb21waWxlZCByZXByZXNlbnRhdGlvbiBpczpcbiAqXG4gKiBgYGB0c1xuICogybXJtXRleHRJbnRlcnBvbGF0ZTIoJ3ByZWZpeCcsIHYwLCAnLScsIHYxLCAnc3VmZml4Jyk7XG4gKiBgYGBcbiAqIEByZXR1cm5zIGl0c2VsZiwgc28gdGhhdCBpdCBtYXkgYmUgY2hhaW5lZC5cbiAqIEBzZWUgdGV4dEludGVycG9sYXRlVlxuICogQGNvZGVHZW5BcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybV0ZXh0SW50ZXJwb2xhdGUyKFxuICBwcmVmaXg6IHN0cmluZyxcbiAgdjA6IGFueSxcbiAgaTA6IHN0cmluZyxcbiAgdjE6IGFueSxcbiAgc3VmZml4OiBzdHJpbmcsXG4pOiB0eXBlb2YgybXJtXRleHRJbnRlcnBvbGF0ZTIge1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGludGVycG9sYXRlZCA9IGludGVycG9sYXRpb24yKGxWaWV3LCBwcmVmaXgsIHYwLCBpMCwgdjEsIHN1ZmZpeCk7XG4gIGlmIChpbnRlcnBvbGF0ZWQgIT09IE5PX0NIQU5HRSkge1xuICAgIHRleHRCaW5kaW5nSW50ZXJuYWwobFZpZXcsIGdldFNlbGVjdGVkSW5kZXgoKSwgaW50ZXJwb2xhdGVkIGFzIHN0cmluZyk7XG4gIH1cbiAgcmV0dXJuIMm1ybV0ZXh0SW50ZXJwb2xhdGUyO1xufVxuXG4vKipcbiAqXG4gKiBVcGRhdGUgdGV4dCBjb250ZW50IHdpdGggMyBib3VuZCB2YWx1ZXMgc3Vycm91bmRlZCBieSBvdGhlciB0ZXh0LlxuICpcbiAqIFVzZWQgd2hlbiBhIHRleHQgbm9kZSBoYXMgMyBpbnRlcnBvbGF0ZWQgdmFsdWVzIGluIGl0OlxuICpcbiAqIGBgYGh0bWxcbiAqIDxkaXY+cHJlZml4e3t2MH19LXt7djF9fS17e3YyfX1zdWZmaXg8L2Rpdj5cbiAqIGBgYFxuICpcbiAqIEl0cyBjb21waWxlZCByZXByZXNlbnRhdGlvbiBpczpcbiAqXG4gKiBgYGB0c1xuICogybXJtXRleHRJbnRlcnBvbGF0ZTMoXG4gKiAncHJlZml4JywgdjAsICctJywgdjEsICctJywgdjIsICdzdWZmaXgnKTtcbiAqIGBgYFxuICogQHJldHVybnMgaXRzZWxmLCBzbyB0aGF0IGl0IG1heSBiZSBjaGFpbmVkLlxuICogQHNlZSB0ZXh0SW50ZXJwb2xhdGVWXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtXRleHRJbnRlcnBvbGF0ZTMoXG4gIHByZWZpeDogc3RyaW5nLFxuICB2MDogYW55LFxuICBpMDogc3RyaW5nLFxuICB2MTogYW55LFxuICBpMTogc3RyaW5nLFxuICB2MjogYW55LFxuICBzdWZmaXg6IHN0cmluZyxcbik6IHR5cGVvZiDJtcm1dGV4dEludGVycG9sYXRlMyB7XG4gIGNvbnN0IGxWaWV3ID0gZ2V0TFZpZXcoKTtcbiAgY29uc3QgaW50ZXJwb2xhdGVkID0gaW50ZXJwb2xhdGlvbjMobFZpZXcsIHByZWZpeCwgdjAsIGkwLCB2MSwgaTEsIHYyLCBzdWZmaXgpO1xuICBpZiAoaW50ZXJwb2xhdGVkICE9PSBOT19DSEFOR0UpIHtcbiAgICB0ZXh0QmluZGluZ0ludGVybmFsKGxWaWV3LCBnZXRTZWxlY3RlZEluZGV4KCksIGludGVycG9sYXRlZCBhcyBzdHJpbmcpO1xuICB9XG4gIHJldHVybiDJtcm1dGV4dEludGVycG9sYXRlMztcbn1cblxuLyoqXG4gKlxuICogVXBkYXRlIHRleHQgY29udGVudCB3aXRoIDQgYm91bmQgdmFsdWVzIHN1cnJvdW5kZWQgYnkgb3RoZXIgdGV4dC5cbiAqXG4gKiBVc2VkIHdoZW4gYSB0ZXh0IG5vZGUgaGFzIDQgaW50ZXJwb2xhdGVkIHZhbHVlcyBpbiBpdDpcbiAqXG4gKiBgYGBodG1sXG4gKiA8ZGl2PnByZWZpeHt7djB9fS17e3YxfX0te3t2Mn19LXt7djN9fXN1ZmZpeDwvZGl2PlxuICogYGBgXG4gKlxuICogSXRzIGNvbXBpbGVkIHJlcHJlc2VudGF0aW9uIGlzOlxuICpcbiAqIGBgYHRzXG4gKiDJtcm1dGV4dEludGVycG9sYXRlNChcbiAqICdwcmVmaXgnLCB2MCwgJy0nLCB2MSwgJy0nLCB2MiwgJy0nLCB2MywgJ3N1ZmZpeCcpO1xuICogYGBgXG4gKiBAcmV0dXJucyBpdHNlbGYsIHNvIHRoYXQgaXQgbWF5IGJlIGNoYWluZWQuXG4gKiBAc2VlIMm1ybV0ZXh0SW50ZXJwb2xhdGVWXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtXRleHRJbnRlcnBvbGF0ZTQoXG4gIHByZWZpeDogc3RyaW5nLFxuICB2MDogYW55LFxuICBpMDogc3RyaW5nLFxuICB2MTogYW55LFxuICBpMTogc3RyaW5nLFxuICB2MjogYW55LFxuICBpMjogc3RyaW5nLFxuICB2MzogYW55LFxuICBzdWZmaXg6IHN0cmluZyxcbik6IHR5cGVvZiDJtcm1dGV4dEludGVycG9sYXRlNCB7XG4gIGNvbnN0IGxWaWV3ID0gZ2V0TFZpZXcoKTtcbiAgY29uc3QgaW50ZXJwb2xhdGVkID0gaW50ZXJwb2xhdGlvbjQobFZpZXcsIHByZWZpeCwgdjAsIGkwLCB2MSwgaTEsIHYyLCBpMiwgdjMsIHN1ZmZpeCk7XG4gIGlmIChpbnRlcnBvbGF0ZWQgIT09IE5PX0NIQU5HRSkge1xuICAgIHRleHRCaW5kaW5nSW50ZXJuYWwobFZpZXcsIGdldFNlbGVjdGVkSW5kZXgoKSwgaW50ZXJwb2xhdGVkIGFzIHN0cmluZyk7XG4gIH1cbiAgcmV0dXJuIMm1ybV0ZXh0SW50ZXJwb2xhdGU0O1xufVxuXG4vKipcbiAqXG4gKiBVcGRhdGUgdGV4dCBjb250ZW50IHdpdGggNSBib3VuZCB2YWx1ZXMgc3Vycm91bmRlZCBieSBvdGhlciB0ZXh0LlxuICpcbiAqIFVzZWQgd2hlbiBhIHRleHQgbm9kZSBoYXMgNSBpbnRlcnBvbGF0ZWQgdmFsdWVzIGluIGl0OlxuICpcbiAqIGBgYGh0bWxcbiAqIDxkaXY+cHJlZml4e3t2MH19LXt7djF9fS17e3YyfX0te3t2M319LXt7djR9fXN1ZmZpeDwvZGl2PlxuICogYGBgXG4gKlxuICogSXRzIGNvbXBpbGVkIHJlcHJlc2VudGF0aW9uIGlzOlxuICpcbiAqIGBgYHRzXG4gKiDJtcm1dGV4dEludGVycG9sYXRlNShcbiAqICdwcmVmaXgnLCB2MCwgJy0nLCB2MSwgJy0nLCB2MiwgJy0nLCB2MywgJy0nLCB2NCwgJ3N1ZmZpeCcpO1xuICogYGBgXG4gKiBAcmV0dXJucyBpdHNlbGYsIHNvIHRoYXQgaXQgbWF5IGJlIGNoYWluZWQuXG4gKiBAc2VlIHRleHRJbnRlcnBvbGF0ZVZcbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1dGV4dEludGVycG9sYXRlNShcbiAgcHJlZml4OiBzdHJpbmcsXG4gIHYwOiBhbnksXG4gIGkwOiBzdHJpbmcsXG4gIHYxOiBhbnksXG4gIGkxOiBzdHJpbmcsXG4gIHYyOiBhbnksXG4gIGkyOiBzdHJpbmcsXG4gIHYzOiBhbnksXG4gIGkzOiBzdHJpbmcsXG4gIHY0OiBhbnksXG4gIHN1ZmZpeDogc3RyaW5nLFxuKTogdHlwZW9mIMm1ybV0ZXh0SW50ZXJwb2xhdGU1IHtcbiAgY29uc3QgbFZpZXcgPSBnZXRMVmlldygpO1xuICBjb25zdCBpbnRlcnBvbGF0ZWQgPSBpbnRlcnBvbGF0aW9uNShsVmlldywgcHJlZml4LCB2MCwgaTAsIHYxLCBpMSwgdjIsIGkyLCB2MywgaTMsIHY0LCBzdWZmaXgpO1xuICBpZiAoaW50ZXJwb2xhdGVkICE9PSBOT19DSEFOR0UpIHtcbiAgICB0ZXh0QmluZGluZ0ludGVybmFsKGxWaWV3LCBnZXRTZWxlY3RlZEluZGV4KCksIGludGVycG9sYXRlZCBhcyBzdHJpbmcpO1xuICB9XG4gIHJldHVybiDJtcm1dGV4dEludGVycG9sYXRlNTtcbn1cblxuLyoqXG4gKlxuICogVXBkYXRlIHRleHQgY29udGVudCB3aXRoIDYgYm91bmQgdmFsdWVzIHN1cnJvdW5kZWQgYnkgb3RoZXIgdGV4dC5cbiAqXG4gKiBVc2VkIHdoZW4gYSB0ZXh0IG5vZGUgaGFzIDYgaW50ZXJwb2xhdGVkIHZhbHVlcyBpbiBpdDpcbiAqXG4gKiBgYGBodG1sXG4gKiA8ZGl2PnByZWZpeHt7djB9fS17e3YxfX0te3t2Mn19LXt7djN9fS17e3Y0fX0te3t2NX19c3VmZml4PC9kaXY+XG4gKiBgYGBcbiAqXG4gKiBJdHMgY29tcGlsZWQgcmVwcmVzZW50YXRpb24gaXM6XG4gKlxuICogYGBgdHNcbiAqIMm1ybV0ZXh0SW50ZXJwb2xhdGU2KFxuICogICAgJ3ByZWZpeCcsIHYwLCAnLScsIHYxLCAnLScsIHYyLCAnLScsIHYzLCAnLScsIHY0LCAnLScsIHY1LCAnc3VmZml4Jyk7XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gaTQgU3RhdGljIHZhbHVlIHVzZWQgZm9yIGNvbmNhdGVuYXRpb24gb25seS5cbiAqIEBwYXJhbSB2NSBWYWx1ZSBjaGVja2VkIGZvciBjaGFuZ2UuIEByZXR1cm5zIGl0c2VsZiwgc28gdGhhdCBpdCBtYXkgYmUgY2hhaW5lZC5cbiAqIEBzZWUgdGV4dEludGVycG9sYXRlVlxuICogQGNvZGVHZW5BcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybV0ZXh0SW50ZXJwb2xhdGU2KFxuICBwcmVmaXg6IHN0cmluZyxcbiAgdjA6IGFueSxcbiAgaTA6IHN0cmluZyxcbiAgdjE6IGFueSxcbiAgaTE6IHN0cmluZyxcbiAgdjI6IGFueSxcbiAgaTI6IHN0cmluZyxcbiAgdjM6IGFueSxcbiAgaTM6IHN0cmluZyxcbiAgdjQ6IGFueSxcbiAgaTQ6IHN0cmluZyxcbiAgdjU6IGFueSxcbiAgc3VmZml4OiBzdHJpbmcsXG4pOiB0eXBlb2YgybXJtXRleHRJbnRlcnBvbGF0ZTYge1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGludGVycG9sYXRlZCA9IGludGVycG9sYXRpb242KFxuICAgIGxWaWV3LFxuICAgIHByZWZpeCxcbiAgICB2MCxcbiAgICBpMCxcbiAgICB2MSxcbiAgICBpMSxcbiAgICB2MixcbiAgICBpMixcbiAgICB2MyxcbiAgICBpMyxcbiAgICB2NCxcbiAgICBpNCxcbiAgICB2NSxcbiAgICBzdWZmaXgsXG4gICk7XG4gIGlmIChpbnRlcnBvbGF0ZWQgIT09IE5PX0NIQU5HRSkge1xuICAgIHRleHRCaW5kaW5nSW50ZXJuYWwobFZpZXcsIGdldFNlbGVjdGVkSW5kZXgoKSwgaW50ZXJwb2xhdGVkIGFzIHN0cmluZyk7XG4gIH1cbiAgcmV0dXJuIMm1ybV0ZXh0SW50ZXJwb2xhdGU2O1xufVxuXG4vKipcbiAqXG4gKiBVcGRhdGUgdGV4dCBjb250ZW50IHdpdGggNyBib3VuZCB2YWx1ZXMgc3Vycm91bmRlZCBieSBvdGhlciB0ZXh0LlxuICpcbiAqIFVzZWQgd2hlbiBhIHRleHQgbm9kZSBoYXMgNyBpbnRlcnBvbGF0ZWQgdmFsdWVzIGluIGl0OlxuICpcbiAqIGBgYGh0bWxcbiAqIDxkaXY+cHJlZml4e3t2MH19LXt7djF9fS17e3YyfX0te3t2M319LXt7djR9fS17e3Y1fX0te3t2Nn19c3VmZml4PC9kaXY+XG4gKiBgYGBcbiAqXG4gKiBJdHMgY29tcGlsZWQgcmVwcmVzZW50YXRpb24gaXM6XG4gKlxuICogYGBgdHNcbiAqIMm1ybV0ZXh0SW50ZXJwb2xhdGU3KFxuICogICAgJ3ByZWZpeCcsIHYwLCAnLScsIHYxLCAnLScsIHYyLCAnLScsIHYzLCAnLScsIHY0LCAnLScsIHY1LCAnLScsIHY2LCAnc3VmZml4Jyk7XG4gKiBgYGBcbiAqIEByZXR1cm5zIGl0c2VsZiwgc28gdGhhdCBpdCBtYXkgYmUgY2hhaW5lZC5cbiAqIEBzZWUgdGV4dEludGVycG9sYXRlVlxuICogQGNvZGVHZW5BcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybV0ZXh0SW50ZXJwb2xhdGU3KFxuICBwcmVmaXg6IHN0cmluZyxcbiAgdjA6IGFueSxcbiAgaTA6IHN0cmluZyxcbiAgdjE6IGFueSxcbiAgaTE6IHN0cmluZyxcbiAgdjI6IGFueSxcbiAgaTI6IHN0cmluZyxcbiAgdjM6IGFueSxcbiAgaTM6IHN0cmluZyxcbiAgdjQ6IGFueSxcbiAgaTQ6IHN0cmluZyxcbiAgdjU6IGFueSxcbiAgaTU6IHN0cmluZyxcbiAgdjY6IGFueSxcbiAgc3VmZml4OiBzdHJpbmcsXG4pOiB0eXBlb2YgybXJtXRleHRJbnRlcnBvbGF0ZTcge1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGludGVycG9sYXRlZCA9IGludGVycG9sYXRpb243KFxuICAgIGxWaWV3LFxuICAgIHByZWZpeCxcbiAgICB2MCxcbiAgICBpMCxcbiAgICB2MSxcbiAgICBpMSxcbiAgICB2MixcbiAgICBpMixcbiAgICB2MyxcbiAgICBpMyxcbiAgICB2NCxcbiAgICBpNCxcbiAgICB2NSxcbiAgICBpNSxcbiAgICB2NixcbiAgICBzdWZmaXgsXG4gICk7XG4gIGlmIChpbnRlcnBvbGF0ZWQgIT09IE5PX0NIQU5HRSkge1xuICAgIHRleHRCaW5kaW5nSW50ZXJuYWwobFZpZXcsIGdldFNlbGVjdGVkSW5kZXgoKSwgaW50ZXJwb2xhdGVkIGFzIHN0cmluZyk7XG4gIH1cbiAgcmV0dXJuIMm1ybV0ZXh0SW50ZXJwb2xhdGU3O1xufVxuXG4vKipcbiAqXG4gKiBVcGRhdGUgdGV4dCBjb250ZW50IHdpdGggOCBib3VuZCB2YWx1ZXMgc3Vycm91bmRlZCBieSBvdGhlciB0ZXh0LlxuICpcbiAqIFVzZWQgd2hlbiBhIHRleHQgbm9kZSBoYXMgOCBpbnRlcnBvbGF0ZWQgdmFsdWVzIGluIGl0OlxuICpcbiAqIGBgYGh0bWxcbiAqIDxkaXY+cHJlZml4e3t2MH19LXt7djF9fS17e3YyfX0te3t2M319LXt7djR9fS17e3Y1fX0te3t2Nn19LXt7djd9fXN1ZmZpeDwvZGl2PlxuICogYGBgXG4gKlxuICogSXRzIGNvbXBpbGVkIHJlcHJlc2VudGF0aW9uIGlzOlxuICpcbiAqIGBgYHRzXG4gKiDJtcm1dGV4dEludGVycG9sYXRlOChcbiAqICAncHJlZml4JywgdjAsICctJywgdjEsICctJywgdjIsICctJywgdjMsICctJywgdjQsICctJywgdjUsICctJywgdjYsICctJywgdjcsICdzdWZmaXgnKTtcbiAqIGBgYFxuICogQHJldHVybnMgaXRzZWxmLCBzbyB0aGF0IGl0IG1heSBiZSBjaGFpbmVkLlxuICogQHNlZSB0ZXh0SW50ZXJwb2xhdGVWXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtXRleHRJbnRlcnBvbGF0ZTgoXG4gIHByZWZpeDogc3RyaW5nLFxuICB2MDogYW55LFxuICBpMDogc3RyaW5nLFxuICB2MTogYW55LFxuICBpMTogc3RyaW5nLFxuICB2MjogYW55LFxuICBpMjogc3RyaW5nLFxuICB2MzogYW55LFxuICBpMzogc3RyaW5nLFxuICB2NDogYW55LFxuICBpNDogc3RyaW5nLFxuICB2NTogYW55LFxuICBpNTogc3RyaW5nLFxuICB2NjogYW55LFxuICBpNjogc3RyaW5nLFxuICB2NzogYW55LFxuICBzdWZmaXg6IHN0cmluZyxcbik6IHR5cGVvZiDJtcm1dGV4dEludGVycG9sYXRlOCB7XG4gIGNvbnN0IGxWaWV3ID0gZ2V0TFZpZXcoKTtcbiAgY29uc3QgaW50ZXJwb2xhdGVkID0gaW50ZXJwb2xhdGlvbjgoXG4gICAgbFZpZXcsXG4gICAgcHJlZml4LFxuICAgIHYwLFxuICAgIGkwLFxuICAgIHYxLFxuICAgIGkxLFxuICAgIHYyLFxuICAgIGkyLFxuICAgIHYzLFxuICAgIGkzLFxuICAgIHY0LFxuICAgIGk0LFxuICAgIHY1LFxuICAgIGk1LFxuICAgIHY2LFxuICAgIGk2LFxuICAgIHY3LFxuICAgIHN1ZmZpeCxcbiAgKTtcbiAgaWYgKGludGVycG9sYXRlZCAhPT0gTk9fQ0hBTkdFKSB7XG4gICAgdGV4dEJpbmRpbmdJbnRlcm5hbChsVmlldywgZ2V0U2VsZWN0ZWRJbmRleCgpLCBpbnRlcnBvbGF0ZWQgYXMgc3RyaW5nKTtcbiAgfVxuICByZXR1cm4gybXJtXRleHRJbnRlcnBvbGF0ZTg7XG59XG5cbi8qKlxuICogVXBkYXRlIHRleHQgY29udGVudCB3aXRoIDkgb3IgbW9yZSBib3VuZCB2YWx1ZXMgb3RoZXIgc3Vycm91bmRlZCBieSB0ZXh0LlxuICpcbiAqIFVzZWQgd2hlbiB0aGUgbnVtYmVyIG9mIGludGVycG9sYXRlZCB2YWx1ZXMgZXhjZWVkcyA4LlxuICpcbiAqIGBgYGh0bWxcbiAqIDxkaXY+cHJlZml4e3t2MH19LXt7djF9fS17e3YyfX0te3t2M319LXt7djR9fS17e3Y1fX0te3t2Nn19LXt7djd9fS17e3Y4fX0te3t2OX19c3VmZml4PC9kaXY+XG4gKiBgYGBcbiAqXG4gKiBJdHMgY29tcGlsZWQgcmVwcmVzZW50YXRpb24gaXM6XG4gKlxuICogYGBgdHNcbiAqIMm1ybV0ZXh0SW50ZXJwb2xhdGVWKFxuICogIFsncHJlZml4JywgdjAsICctJywgdjEsICctJywgdjIsICctJywgdjMsICctJywgdjQsICctJywgdjUsICctJywgdjYsICctJywgdjcsICctJywgdjksXG4gKiAgJ3N1ZmZpeCddKTtcbiAqIGBgYFxuICouXG4gKiBAcGFyYW0gdmFsdWVzIFRoZSBjb2xsZWN0aW9uIG9mIHZhbHVlcyBhbmQgdGhlIHN0cmluZ3MgaW4gYmV0d2VlbiB0aG9zZSB2YWx1ZXMsIGJlZ2lubmluZyB3aXRoXG4gKiBhIHN0cmluZyBwcmVmaXggYW5kIGVuZGluZyB3aXRoIGEgc3RyaW5nIHN1ZmZpeC5cbiAqIChlLmcuIGBbJ3ByZWZpeCcsIHZhbHVlMCwgJy0nLCB2YWx1ZTEsICctJywgdmFsdWUyLCAuLi4sIHZhbHVlOTksICdzdWZmaXgnXWApXG4gKlxuICogQHJldHVybnMgaXRzZWxmLCBzbyB0aGF0IGl0IG1heSBiZSBjaGFpbmVkLlxuICogQGNvZGVHZW5BcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybV0ZXh0SW50ZXJwb2xhdGVWKHZhbHVlczogYW55W10pOiB0eXBlb2YgybXJtXRleHRJbnRlcnBvbGF0ZVYge1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGludGVycG9sYXRlZCA9IGludGVycG9sYXRpb25WKGxWaWV3LCB2YWx1ZXMpO1xuICBpZiAoaW50ZXJwb2xhdGVkICE9PSBOT19DSEFOR0UpIHtcbiAgICB0ZXh0QmluZGluZ0ludGVybmFsKGxWaWV3LCBnZXRTZWxlY3RlZEluZGV4KCksIGludGVycG9sYXRlZCBhcyBzdHJpbmcpO1xuICB9XG4gIHJldHVybiDJtcm1dGV4dEludGVycG9sYXRlVjtcbn1cbiJdfQ==