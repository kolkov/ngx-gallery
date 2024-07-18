/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { getLView } from '../state';
import { interpolation1, interpolation2, interpolation3, interpolation4, interpolation5, interpolation6, interpolation7, interpolation8, interpolationV, } from './interpolation';
import { ɵɵstyleMap } from './styling';
/**
 *
 * Update an interpolated style on an element with single bound value surrounded by text.
 *
 * Used when the value passed to a property has 1 interpolated value in it:
 *
 * ```html
 * <div style="key: {{v0}}suffix"></div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵstyleMapInterpolate1('key: ', v0, 'suffix');
 * ```
 *
 * @param prefix Static value used for concatenation only.
 * @param v0 Value checked for change.
 * @param suffix Static value used for concatenation only.
 * @codeGenApi
 */
export function ɵɵstyleMapInterpolate1(prefix, v0, suffix) {
    const lView = getLView();
    const interpolatedValue = interpolation1(lView, prefix, v0, suffix);
    ɵɵstyleMap(interpolatedValue);
}
/**
 *
 * Update an interpolated style on an element with 2 bound values surrounded by text.
 *
 * Used when the value passed to a property has 2 interpolated values in it:
 *
 * ```html
 * <div style="key: {{v0}}; key1: {{v1}}suffix"></div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵstyleMapInterpolate2('key: ', v0, '; key1: ', v1, 'suffix');
 * ```
 *
 * @param prefix Static value used for concatenation only.
 * @param v0 Value checked for change.
 * @param i0 Static value used for concatenation only.
 * @param v1 Value checked for change.
 * @param suffix Static value used for concatenation only.
 * @codeGenApi
 */
export function ɵɵstyleMapInterpolate2(prefix, v0, i0, v1, suffix) {
    const lView = getLView();
    const interpolatedValue = interpolation2(lView, prefix, v0, i0, v1, suffix);
    ɵɵstyleMap(interpolatedValue);
}
/**
 *
 * Update an interpolated style on an element with 3 bound values surrounded by text.
 *
 * Used when the value passed to a property has 3 interpolated values in it:
 *
 * ```html
 * <div style="key: {{v0}}; key2: {{v1}}; key2: {{v2}}suffix"></div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵstyleMapInterpolate3(
 *     'key: ', v0, '; key1: ', v1, '; key2: ', v2, 'suffix');
 * ```
 *
 * @param prefix Static value used for concatenation only.
 * @param v0 Value checked for change.
 * @param i0 Static value used for concatenation only.
 * @param v1 Value checked for change.
 * @param i1 Static value used for concatenation only.
 * @param v2 Value checked for change.
 * @param suffix Static value used for concatenation only.
 * @codeGenApi
 */
export function ɵɵstyleMapInterpolate3(prefix, v0, i0, v1, i1, v2, suffix) {
    const lView = getLView();
    const interpolatedValue = interpolation3(lView, prefix, v0, i0, v1, i1, v2, suffix);
    ɵɵstyleMap(interpolatedValue);
}
/**
 *
 * Update an interpolated style on an element with 4 bound values surrounded by text.
 *
 * Used when the value passed to a property has 4 interpolated values in it:
 *
 * ```html
 * <div style="key: {{v0}}; key1: {{v1}}; key2: {{v2}}; key3: {{v3}}suffix"></div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵstyleMapInterpolate4(
 *     'key: ', v0, '; key1: ', v1, '; key2: ', v2, '; key3: ', v3, 'suffix');
 * ```
 *
 * @param prefix Static value used for concatenation only.
 * @param v0 Value checked for change.
 * @param i0 Static value used for concatenation only.
 * @param v1 Value checked for change.
 * @param i1 Static value used for concatenation only.
 * @param v2 Value checked for change.
 * @param i2 Static value used for concatenation only.
 * @param v3 Value checked for change.
 * @param suffix Static value used for concatenation only.
 * @codeGenApi
 */
export function ɵɵstyleMapInterpolate4(prefix, v0, i0, v1, i1, v2, i2, v3, suffix) {
    const lView = getLView();
    const interpolatedValue = interpolation4(lView, prefix, v0, i0, v1, i1, v2, i2, v3, suffix);
    ɵɵstyleMap(interpolatedValue);
}
/**
 *
 * Update an interpolated style on an element with 5 bound values surrounded by text.
 *
 * Used when the value passed to a property has 5 interpolated values in it:
 *
 * ```html
 * <div style="key: {{v0}}; key1: {{v1}}; key2: {{v2}}; key3: {{v3}}; key4: {{v4}}suffix"></div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵstyleMapInterpolate5(
 *     'key: ', v0, '; key1: ', v1, '; key2: ', v2, '; key3: ', v3, '; key4: ', v4, 'suffix');
 * ```
 *
 * @param prefix Static value used for concatenation only.
 * @param v0 Value checked for change.
 * @param i0 Static value used for concatenation only.
 * @param v1 Value checked for change.
 * @param i1 Static value used for concatenation only.
 * @param v2 Value checked for change.
 * @param i2 Static value used for concatenation only.
 * @param v3 Value checked for change.
 * @param i3 Static value used for concatenation only.
 * @param v4 Value checked for change.
 * @param suffix Static value used for concatenation only.
 * @codeGenApi
 */
export function ɵɵstyleMapInterpolate5(prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, suffix) {
    const lView = getLView();
    const interpolatedValue = interpolation5(lView, prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, suffix);
    ɵɵstyleMap(interpolatedValue);
}
/**
 *
 * Update an interpolated style on an element with 6 bound values surrounded by text.
 *
 * Used when the value passed to a property has 6 interpolated values in it:
 *
 * ```html
 * <div style="key: {{v0}}; key1: {{v1}}; key2: {{v2}}; key3: {{v3}}; key4: {{v4}};
 *             key5: {{v5}}suffix"></div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵstyleMapInterpolate6(
 *    'key: ', v0, '; key1: ', v1, '; key2: ', v2, '; key3: ', v3, '; key4: ', v4, '; key5: ', v5,
 *    'suffix');
 * ```
 *
 * @param prefix Static value used for concatenation only.
 * @param v0 Value checked for change.
 * @param i0 Static value used for concatenation only.
 * @param v1 Value checked for change.
 * @param i1 Static value used for concatenation only.
 * @param v2 Value checked for change.
 * @param i2 Static value used for concatenation only.
 * @param v3 Value checked for change.
 * @param i3 Static value used for concatenation only.
 * @param v4 Value checked for change.
 * @param i4 Static value used for concatenation only.
 * @param v5 Value checked for change.
 * @param suffix Static value used for concatenation only.
 * @codeGenApi
 */
export function ɵɵstyleMapInterpolate6(prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, i4, v5, suffix) {
    const lView = getLView();
    const interpolatedValue = interpolation6(lView, prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, i4, v5, suffix);
    ɵɵstyleMap(interpolatedValue);
}
/**
 *
 * Update an interpolated style on an element with 7 bound values surrounded by text.
 *
 * Used when the value passed to a property has 7 interpolated values in it:
 *
 * ```html
 * <div style="key: {{v0}}; key1: {{v1}}; key2: {{v2}}; key3: {{v3}}; key4: {{v4}}; key5: {{v5}};
 *             key6: {{v6}}suffix"></div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵstyleMapInterpolate7(
 *    'key: ', v0, '; key1: ', v1, '; key2: ', v2, '; key3: ', v3, '; key4: ', v4, '; key5: ', v5,
 *    '; key6: ', v6, 'suffix');
 * ```
 *
 * @param prefix Static value used for concatenation only.
 * @param v0 Value checked for change.
 * @param i0 Static value used for concatenation only.
 * @param v1 Value checked for change.
 * @param i1 Static value used for concatenation only.
 * @param v2 Value checked for change.
 * @param i2 Static value used for concatenation only.
 * @param v3 Value checked for change.
 * @param i3 Static value used for concatenation only.
 * @param v4 Value checked for change.
 * @param i4 Static value used for concatenation only.
 * @param v5 Value checked for change.
 * @param i5 Static value used for concatenation only.
 * @param v6 Value checked for change.
 * @param suffix Static value used for concatenation only.
 * @codeGenApi
 */
export function ɵɵstyleMapInterpolate7(prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, i4, v5, i5, v6, suffix) {
    const lView = getLView();
    const interpolatedValue = interpolation7(lView, prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, i4, v5, i5, v6, suffix);
    ɵɵstyleMap(interpolatedValue);
}
/**
 *
 * Update an interpolated style on an element with 8 bound values surrounded by text.
 *
 * Used when the value passed to a property has 8 interpolated values in it:
 *
 * ```html
 * <div style="key: {{v0}}; key1: {{v1}}; key2: {{v2}}; key3: {{v3}}; key4: {{v4}}; key5: {{v5}};
 *             key6: {{v6}}; key7: {{v7}}suffix"></div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵstyleMapInterpolate8(
 *    'key: ', v0, '; key1: ', v1, '; key2: ', v2, '; key3: ', v3, '; key4: ', v4, '; key5: ', v5,
 *    '; key6: ', v6, '; key7: ', v7, 'suffix');
 * ```
 *
 * @param prefix Static value used for concatenation only.
 * @param v0 Value checked for change.
 * @param i0 Static value used for concatenation only.
 * @param v1 Value checked for change.
 * @param i1 Static value used for concatenation only.
 * @param v2 Value checked for change.
 * @param i2 Static value used for concatenation only.
 * @param v3 Value checked for change.
 * @param i3 Static value used for concatenation only.
 * @param v4 Value checked for change.
 * @param i4 Static value used for concatenation only.
 * @param v5 Value checked for change.
 * @param i5 Static value used for concatenation only.
 * @param v6 Value checked for change.
 * @param i6 Static value used for concatenation only.
 * @param v7 Value checked for change.
 * @param suffix Static value used for concatenation only.
 * @codeGenApi
 */
export function ɵɵstyleMapInterpolate8(prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, i4, v5, i5, v6, i6, v7, suffix) {
    const lView = getLView();
    const interpolatedValue = interpolation8(lView, prefix, v0, i0, v1, i1, v2, i2, v3, i3, v4, i4, v5, i5, v6, i6, v7, suffix);
    ɵɵstyleMap(interpolatedValue);
}
/**
 * Update an interpolated style on an element with 9 or more bound values surrounded by text.
 *
 * Used when the number of interpolated values exceeds 8.
 *
 * ```html
 * <div
 *  class="key: {{v0}}; key1: {{v1}}; key2: {{v2}}; key3: {{v3}}; key4: {{v4}}; key5: {{v5}};
 *         key6: {{v6}}; key7: {{v7}}; key8: {{v8}}; key9: {{v9}}suffix"></div>
 * ```
 *
 * Its compiled representation is:
 *
 * ```ts
 * ɵɵstyleMapInterpolateV(
 *    ['key: ', v0, '; key1: ', v1, '; key2: ', v2, '; key3: ', v3, '; key4: ', v4, '; key5: ', v5,
 *     '; key6: ', v6, '; key7: ', v7, '; key8: ', v8, '; key9: ', v9, 'suffix']);
 * ```
 *.
 * @param values The collection of values and the strings in-between those values, beginning with
 * a string prefix and ending with a string suffix.
 * (e.g. `['prefix', value0, '; key2: ', value1, '; key2: ', value2, ..., value99, 'suffix']`)
 * @codeGenApi
 */
export function ɵɵstyleMapInterpolateV(values) {
    const lView = getLView();
    const interpolatedValue = interpolationV(lView, values);
    ɵɵstyleMap(interpolatedValue);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGVfbWFwX2ludGVycG9sYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL2luc3RydWN0aW9ucy9zdHlsZV9tYXBfaW50ZXJwb2xhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsUUFBUSxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBQ2xDLE9BQU8sRUFDTCxjQUFjLEVBQ2QsY0FBYyxFQUNkLGNBQWMsRUFDZCxjQUFjLEVBQ2QsY0FBYyxFQUNkLGNBQWMsRUFDZCxjQUFjLEVBQ2QsY0FBYyxFQUNkLGNBQWMsR0FDZixNQUFNLGlCQUFpQixDQUFDO0FBQ3pCLE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFFckM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBb0JHO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQixDQUFDLE1BQWMsRUFBRSxFQUFPLEVBQUUsTUFBYztJQUM1RSxNQUFNLEtBQUssR0FBRyxRQUFRLEVBQUUsQ0FBQztJQUN6QixNQUFNLGlCQUFpQixHQUFHLGNBQWMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUNwRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FzQkc7QUFDSCxNQUFNLFVBQVUsc0JBQXNCLENBQ3BDLE1BQWMsRUFDZCxFQUFPLEVBQ1AsRUFBVSxFQUNWLEVBQU8sRUFDUCxNQUFjO0lBRWQsTUFBTSxLQUFLLEdBQUcsUUFBUSxFQUFFLENBQUM7SUFDekIsTUFBTSxpQkFBaUIsR0FBRyxjQUFjLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUM1RSxVQUFVLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0F5Qkc7QUFDSCxNQUFNLFVBQVUsc0JBQXNCLENBQ3BDLE1BQWMsRUFDZCxFQUFPLEVBQ1AsRUFBVSxFQUNWLEVBQU8sRUFDUCxFQUFVLEVBQ1YsRUFBTyxFQUNQLE1BQWM7SUFFZCxNQUFNLEtBQUssR0FBRyxRQUFRLEVBQUUsQ0FBQztJQUN6QixNQUFNLGlCQUFpQixHQUFHLGNBQWMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDcEYsVUFBVSxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFDaEMsQ0FBQztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0EyQkc7QUFDSCxNQUFNLFVBQVUsc0JBQXNCLENBQ3BDLE1BQWMsRUFDZCxFQUFPLEVBQ1AsRUFBVSxFQUNWLEVBQU8sRUFDUCxFQUFVLEVBQ1YsRUFBTyxFQUNQLEVBQVUsRUFDVixFQUFPLEVBQ1AsTUFBYztJQUVkLE1BQU0sS0FBSyxHQUFHLFFBQVEsRUFBRSxDQUFDO0lBQ3pCLE1BQU0saUJBQWlCLEdBQUcsY0FBYyxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQzVGLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQ2hDLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0E2Qkc7QUFDSCxNQUFNLFVBQVUsc0JBQXNCLENBQ3BDLE1BQWMsRUFDZCxFQUFPLEVBQ1AsRUFBVSxFQUNWLEVBQU8sRUFDUCxFQUFVLEVBQ1YsRUFBTyxFQUNQLEVBQVUsRUFDVixFQUFPLEVBQ1AsRUFBVSxFQUNWLEVBQU8sRUFDUCxNQUFjO0lBRWQsTUFBTSxLQUFLLEdBQUcsUUFBUSxFQUFFLENBQUM7SUFDekIsTUFBTSxpQkFBaUIsR0FBRyxjQUFjLENBQ3RDLEtBQUssRUFDTCxNQUFNLEVBQ04sRUFBRSxFQUNGLEVBQUUsRUFDRixFQUFFLEVBQ0YsRUFBRSxFQUNGLEVBQUUsRUFDRixFQUFFLEVBQ0YsRUFBRSxFQUNGLEVBQUUsRUFDRixFQUFFLEVBQ0YsTUFBTSxDQUNQLENBQUM7SUFDRixVQUFVLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQWlDRztBQUNILE1BQU0sVUFBVSxzQkFBc0IsQ0FDcEMsTUFBYyxFQUNkLEVBQU8sRUFDUCxFQUFVLEVBQ1YsRUFBTyxFQUNQLEVBQVUsRUFDVixFQUFPLEVBQ1AsRUFBVSxFQUNWLEVBQU8sRUFDUCxFQUFVLEVBQ1YsRUFBTyxFQUNQLEVBQVUsRUFDVixFQUFPLEVBQ1AsTUFBYztJQUVkLE1BQU0sS0FBSyxHQUFHLFFBQVEsRUFBRSxDQUFDO0lBQ3pCLE1BQU0saUJBQWlCLEdBQUcsY0FBYyxDQUN0QyxLQUFLLEVBQ0wsTUFBTSxFQUNOLEVBQUUsRUFDRixFQUFFLEVBQ0YsRUFBRSxFQUNGLEVBQUUsRUFDRixFQUFFLEVBQ0YsRUFBRSxFQUNGLEVBQUUsRUFDRixFQUFFLEVBQ0YsRUFBRSxFQUNGLEVBQUUsRUFDRixFQUFFLEVBQ0YsTUFBTSxDQUNQLENBQUM7SUFDRixVQUFVLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBbUNHO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQixDQUNwQyxNQUFjLEVBQ2QsRUFBTyxFQUNQLEVBQVUsRUFDVixFQUFPLEVBQ1AsRUFBVSxFQUNWLEVBQU8sRUFDUCxFQUFVLEVBQ1YsRUFBTyxFQUNQLEVBQVUsRUFDVixFQUFPLEVBQ1AsRUFBVSxFQUNWLEVBQU8sRUFDUCxFQUFVLEVBQ1YsRUFBTyxFQUNQLE1BQWM7SUFFZCxNQUFNLEtBQUssR0FBRyxRQUFRLEVBQUUsQ0FBQztJQUN6QixNQUFNLGlCQUFpQixHQUFHLGNBQWMsQ0FDdEMsS0FBSyxFQUNMLE1BQU0sRUFDTixFQUFFLEVBQ0YsRUFBRSxFQUNGLEVBQUUsRUFDRixFQUFFLEVBQ0YsRUFBRSxFQUNGLEVBQUUsRUFDRixFQUFFLEVBQ0YsRUFBRSxFQUNGLEVBQUUsRUFDRixFQUFFLEVBQ0YsRUFBRSxFQUNGLEVBQUUsRUFDRixFQUFFLEVBQ0YsTUFBTSxDQUNQLENBQUM7SUFDRixVQUFVLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FxQ0c7QUFDSCxNQUFNLFVBQVUsc0JBQXNCLENBQ3BDLE1BQWMsRUFDZCxFQUFPLEVBQ1AsRUFBVSxFQUNWLEVBQU8sRUFDUCxFQUFVLEVBQ1YsRUFBTyxFQUNQLEVBQVUsRUFDVixFQUFPLEVBQ1AsRUFBVSxFQUNWLEVBQU8sRUFDUCxFQUFVLEVBQ1YsRUFBTyxFQUNQLEVBQVUsRUFDVixFQUFPLEVBQ1AsRUFBVSxFQUNWLEVBQU8sRUFDUCxNQUFjO0lBRWQsTUFBTSxLQUFLLEdBQUcsUUFBUSxFQUFFLENBQUM7SUFDekIsTUFBTSxpQkFBaUIsR0FBRyxjQUFjLENBQ3RDLEtBQUssRUFDTCxNQUFNLEVBQ04sRUFBRSxFQUNGLEVBQUUsRUFDRixFQUFFLEVBQ0YsRUFBRSxFQUNGLEVBQUUsRUFDRixFQUFFLEVBQ0YsRUFBRSxFQUNGLEVBQUUsRUFDRixFQUFFLEVBQ0YsRUFBRSxFQUNGLEVBQUUsRUFDRixFQUFFLEVBQ0YsRUFBRSxFQUNGLEVBQUUsRUFDRixFQUFFLEVBQ0YsTUFBTSxDQUNQLENBQUM7SUFDRixVQUFVLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBdUJHO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQixDQUFDLE1BQWE7SUFDbEQsTUFBTSxLQUFLLEdBQUcsUUFBUSxFQUFFLENBQUM7SUFDekIsTUFBTSxpQkFBaUIsR0FBRyxjQUFjLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ3hELFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQ2hDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtnZXRMVmlld30gZnJvbSAnLi4vc3RhdGUnO1xuaW1wb3J0IHtcbiAgaW50ZXJwb2xhdGlvbjEsXG4gIGludGVycG9sYXRpb24yLFxuICBpbnRlcnBvbGF0aW9uMyxcbiAgaW50ZXJwb2xhdGlvbjQsXG4gIGludGVycG9sYXRpb241LFxuICBpbnRlcnBvbGF0aW9uNixcbiAgaW50ZXJwb2xhdGlvbjcsXG4gIGludGVycG9sYXRpb244LFxuICBpbnRlcnBvbGF0aW9uVixcbn0gZnJvbSAnLi9pbnRlcnBvbGF0aW9uJztcbmltcG9ydCB7ybXJtXN0eWxlTWFwfSBmcm9tICcuL3N0eWxpbmcnO1xuXG4vKipcbiAqXG4gKiBVcGRhdGUgYW4gaW50ZXJwb2xhdGVkIHN0eWxlIG9uIGFuIGVsZW1lbnQgd2l0aCBzaW5nbGUgYm91bmQgdmFsdWUgc3Vycm91bmRlZCBieSB0ZXh0LlxuICpcbiAqIFVzZWQgd2hlbiB0aGUgdmFsdWUgcGFzc2VkIHRvIGEgcHJvcGVydHkgaGFzIDEgaW50ZXJwb2xhdGVkIHZhbHVlIGluIGl0OlxuICpcbiAqIGBgYGh0bWxcbiAqIDxkaXYgc3R5bGU9XCJrZXk6IHt7djB9fXN1ZmZpeFwiPjwvZGl2PlxuICogYGBgXG4gKlxuICogSXRzIGNvbXBpbGVkIHJlcHJlc2VudGF0aW9uIGlzOlxuICpcbiAqIGBgYHRzXG4gKiDJtcm1c3R5bGVNYXBJbnRlcnBvbGF0ZTEoJ2tleTogJywgdjAsICdzdWZmaXgnKTtcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBwcmVmaXggU3RhdGljIHZhbHVlIHVzZWQgZm9yIGNvbmNhdGVuYXRpb24gb25seS5cbiAqIEBwYXJhbSB2MCBWYWx1ZSBjaGVja2VkIGZvciBjaGFuZ2UuXG4gKiBAcGFyYW0gc3VmZml4IFN0YXRpYyB2YWx1ZSB1c2VkIGZvciBjb25jYXRlbmF0aW9uIG9ubHkuXG4gKiBAY29kZUdlbkFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gybXJtXN0eWxlTWFwSW50ZXJwb2xhdGUxKHByZWZpeDogc3RyaW5nLCB2MDogYW55LCBzdWZmaXg6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGludGVycG9sYXRlZFZhbHVlID0gaW50ZXJwb2xhdGlvbjEobFZpZXcsIHByZWZpeCwgdjAsIHN1ZmZpeCk7XG4gIMm1ybVzdHlsZU1hcChpbnRlcnBvbGF0ZWRWYWx1ZSk7XG59XG5cbi8qKlxuICpcbiAqIFVwZGF0ZSBhbiBpbnRlcnBvbGF0ZWQgc3R5bGUgb24gYW4gZWxlbWVudCB3aXRoIDIgYm91bmQgdmFsdWVzIHN1cnJvdW5kZWQgYnkgdGV4dC5cbiAqXG4gKiBVc2VkIHdoZW4gdGhlIHZhbHVlIHBhc3NlZCB0byBhIHByb3BlcnR5IGhhcyAyIGludGVycG9sYXRlZCB2YWx1ZXMgaW4gaXQ6XG4gKlxuICogYGBgaHRtbFxuICogPGRpdiBzdHlsZT1cImtleToge3t2MH19OyBrZXkxOiB7e3YxfX1zdWZmaXhcIj48L2Rpdj5cbiAqIGBgYFxuICpcbiAqIEl0cyBjb21waWxlZCByZXByZXNlbnRhdGlvbiBpczpcbiAqXG4gKiBgYGB0c1xuICogybXJtXN0eWxlTWFwSW50ZXJwb2xhdGUyKCdrZXk6ICcsIHYwLCAnOyBrZXkxOiAnLCB2MSwgJ3N1ZmZpeCcpO1xuICogYGBgXG4gKlxuICogQHBhcmFtIHByZWZpeCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYwIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYxIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBzdWZmaXggU3RhdGljIHZhbHVlIHVzZWQgZm9yIGNvbmNhdGVuYXRpb24gb25seS5cbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1c3R5bGVNYXBJbnRlcnBvbGF0ZTIoXG4gIHByZWZpeDogc3RyaW5nLFxuICB2MDogYW55LFxuICBpMDogc3RyaW5nLFxuICB2MTogYW55LFxuICBzdWZmaXg6IHN0cmluZyxcbik6IHZvaWQge1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGludGVycG9sYXRlZFZhbHVlID0gaW50ZXJwb2xhdGlvbjIobFZpZXcsIHByZWZpeCwgdjAsIGkwLCB2MSwgc3VmZml4KTtcbiAgybXJtXN0eWxlTWFwKGludGVycG9sYXRlZFZhbHVlKTtcbn1cblxuLyoqXG4gKlxuICogVXBkYXRlIGFuIGludGVycG9sYXRlZCBzdHlsZSBvbiBhbiBlbGVtZW50IHdpdGggMyBib3VuZCB2YWx1ZXMgc3Vycm91bmRlZCBieSB0ZXh0LlxuICpcbiAqIFVzZWQgd2hlbiB0aGUgdmFsdWUgcGFzc2VkIHRvIGEgcHJvcGVydHkgaGFzIDMgaW50ZXJwb2xhdGVkIHZhbHVlcyBpbiBpdDpcbiAqXG4gKiBgYGBodG1sXG4gKiA8ZGl2IHN0eWxlPVwia2V5OiB7e3YwfX07IGtleTI6IHt7djF9fTsga2V5Mjoge3t2Mn19c3VmZml4XCI+PC9kaXY+XG4gKiBgYGBcbiAqXG4gKiBJdHMgY29tcGlsZWQgcmVwcmVzZW50YXRpb24gaXM6XG4gKlxuICogYGBgdHNcbiAqIMm1ybVzdHlsZU1hcEludGVycG9sYXRlMyhcbiAqICAgICAna2V5OiAnLCB2MCwgJzsga2V5MTogJywgdjEsICc7IGtleTI6ICcsIHYyLCAnc3VmZml4Jyk7XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gcHJlZml4IFN0YXRpYyB2YWx1ZSB1c2VkIGZvciBjb25jYXRlbmF0aW9uIG9ubHkuXG4gKiBAcGFyYW0gdjAgVmFsdWUgY2hlY2tlZCBmb3IgY2hhbmdlLlxuICogQHBhcmFtIGkwIFN0YXRpYyB2YWx1ZSB1c2VkIGZvciBjb25jYXRlbmF0aW9uIG9ubHkuXG4gKiBAcGFyYW0gdjEgVmFsdWUgY2hlY2tlZCBmb3IgY2hhbmdlLlxuICogQHBhcmFtIGkxIFN0YXRpYyB2YWx1ZSB1c2VkIGZvciBjb25jYXRlbmF0aW9uIG9ubHkuXG4gKiBAcGFyYW0gdjIgVmFsdWUgY2hlY2tlZCBmb3IgY2hhbmdlLlxuICogQHBhcmFtIHN1ZmZpeCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQGNvZGVHZW5BcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybVzdHlsZU1hcEludGVycG9sYXRlMyhcbiAgcHJlZml4OiBzdHJpbmcsXG4gIHYwOiBhbnksXG4gIGkwOiBzdHJpbmcsXG4gIHYxOiBhbnksXG4gIGkxOiBzdHJpbmcsXG4gIHYyOiBhbnksXG4gIHN1ZmZpeDogc3RyaW5nLFxuKTogdm9pZCB7XG4gIGNvbnN0IGxWaWV3ID0gZ2V0TFZpZXcoKTtcbiAgY29uc3QgaW50ZXJwb2xhdGVkVmFsdWUgPSBpbnRlcnBvbGF0aW9uMyhsVmlldywgcHJlZml4LCB2MCwgaTAsIHYxLCBpMSwgdjIsIHN1ZmZpeCk7XG4gIMm1ybVzdHlsZU1hcChpbnRlcnBvbGF0ZWRWYWx1ZSk7XG59XG5cbi8qKlxuICpcbiAqIFVwZGF0ZSBhbiBpbnRlcnBvbGF0ZWQgc3R5bGUgb24gYW4gZWxlbWVudCB3aXRoIDQgYm91bmQgdmFsdWVzIHN1cnJvdW5kZWQgYnkgdGV4dC5cbiAqXG4gKiBVc2VkIHdoZW4gdGhlIHZhbHVlIHBhc3NlZCB0byBhIHByb3BlcnR5IGhhcyA0IGludGVycG9sYXRlZCB2YWx1ZXMgaW4gaXQ6XG4gKlxuICogYGBgaHRtbFxuICogPGRpdiBzdHlsZT1cImtleToge3t2MH19OyBrZXkxOiB7e3YxfX07IGtleTI6IHt7djJ9fTsga2V5Mzoge3t2M319c3VmZml4XCI+PC9kaXY+XG4gKiBgYGBcbiAqXG4gKiBJdHMgY29tcGlsZWQgcmVwcmVzZW50YXRpb24gaXM6XG4gKlxuICogYGBgdHNcbiAqIMm1ybVzdHlsZU1hcEludGVycG9sYXRlNChcbiAqICAgICAna2V5OiAnLCB2MCwgJzsga2V5MTogJywgdjEsICc7IGtleTI6ICcsIHYyLCAnOyBrZXkzOiAnLCB2MywgJ3N1ZmZpeCcpO1xuICogYGBgXG4gKlxuICogQHBhcmFtIHByZWZpeCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYwIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYxIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMSBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYyIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMiBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYzIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBzdWZmaXggU3RhdGljIHZhbHVlIHVzZWQgZm9yIGNvbmNhdGVuYXRpb24gb25seS5cbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1c3R5bGVNYXBJbnRlcnBvbGF0ZTQoXG4gIHByZWZpeDogc3RyaW5nLFxuICB2MDogYW55LFxuICBpMDogc3RyaW5nLFxuICB2MTogYW55LFxuICBpMTogc3RyaW5nLFxuICB2MjogYW55LFxuICBpMjogc3RyaW5nLFxuICB2MzogYW55LFxuICBzdWZmaXg6IHN0cmluZyxcbik6IHZvaWQge1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGludGVycG9sYXRlZFZhbHVlID0gaW50ZXJwb2xhdGlvbjQobFZpZXcsIHByZWZpeCwgdjAsIGkwLCB2MSwgaTEsIHYyLCBpMiwgdjMsIHN1ZmZpeCk7XG4gIMm1ybVzdHlsZU1hcChpbnRlcnBvbGF0ZWRWYWx1ZSk7XG59XG5cbi8qKlxuICpcbiAqIFVwZGF0ZSBhbiBpbnRlcnBvbGF0ZWQgc3R5bGUgb24gYW4gZWxlbWVudCB3aXRoIDUgYm91bmQgdmFsdWVzIHN1cnJvdW5kZWQgYnkgdGV4dC5cbiAqXG4gKiBVc2VkIHdoZW4gdGhlIHZhbHVlIHBhc3NlZCB0byBhIHByb3BlcnR5IGhhcyA1IGludGVycG9sYXRlZCB2YWx1ZXMgaW4gaXQ6XG4gKlxuICogYGBgaHRtbFxuICogPGRpdiBzdHlsZT1cImtleToge3t2MH19OyBrZXkxOiB7e3YxfX07IGtleTI6IHt7djJ9fTsga2V5Mzoge3t2M319OyBrZXk0OiB7e3Y0fX1zdWZmaXhcIj48L2Rpdj5cbiAqIGBgYFxuICpcbiAqIEl0cyBjb21waWxlZCByZXByZXNlbnRhdGlvbiBpczpcbiAqXG4gKiBgYGB0c1xuICogybXJtXN0eWxlTWFwSW50ZXJwb2xhdGU1KFxuICogICAgICdrZXk6ICcsIHYwLCAnOyBrZXkxOiAnLCB2MSwgJzsga2V5MjogJywgdjIsICc7IGtleTM6ICcsIHYzLCAnOyBrZXk0OiAnLCB2NCwgJ3N1ZmZpeCcpO1xuICogYGBgXG4gKlxuICogQHBhcmFtIHByZWZpeCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYwIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYxIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMSBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYyIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMiBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYzIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMyBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHY0IFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBzdWZmaXggU3RhdGljIHZhbHVlIHVzZWQgZm9yIGNvbmNhdGVuYXRpb24gb25seS5cbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1c3R5bGVNYXBJbnRlcnBvbGF0ZTUoXG4gIHByZWZpeDogc3RyaW5nLFxuICB2MDogYW55LFxuICBpMDogc3RyaW5nLFxuICB2MTogYW55LFxuICBpMTogc3RyaW5nLFxuICB2MjogYW55LFxuICBpMjogc3RyaW5nLFxuICB2MzogYW55LFxuICBpMzogc3RyaW5nLFxuICB2NDogYW55LFxuICBzdWZmaXg6IHN0cmluZyxcbik6IHZvaWQge1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGludGVycG9sYXRlZFZhbHVlID0gaW50ZXJwb2xhdGlvbjUoXG4gICAgbFZpZXcsXG4gICAgcHJlZml4LFxuICAgIHYwLFxuICAgIGkwLFxuICAgIHYxLFxuICAgIGkxLFxuICAgIHYyLFxuICAgIGkyLFxuICAgIHYzLFxuICAgIGkzLFxuICAgIHY0LFxuICAgIHN1ZmZpeCxcbiAgKTtcbiAgybXJtXN0eWxlTWFwKGludGVycG9sYXRlZFZhbHVlKTtcbn1cblxuLyoqXG4gKlxuICogVXBkYXRlIGFuIGludGVycG9sYXRlZCBzdHlsZSBvbiBhbiBlbGVtZW50IHdpdGggNiBib3VuZCB2YWx1ZXMgc3Vycm91bmRlZCBieSB0ZXh0LlxuICpcbiAqIFVzZWQgd2hlbiB0aGUgdmFsdWUgcGFzc2VkIHRvIGEgcHJvcGVydHkgaGFzIDYgaW50ZXJwb2xhdGVkIHZhbHVlcyBpbiBpdDpcbiAqXG4gKiBgYGBodG1sXG4gKiA8ZGl2IHN0eWxlPVwia2V5OiB7e3YwfX07IGtleTE6IHt7djF9fTsga2V5Mjoge3t2Mn19OyBrZXkzOiB7e3YzfX07IGtleTQ6IHt7djR9fTtcbiAqICAgICAgICAgICAgIGtleTU6IHt7djV9fXN1ZmZpeFwiPjwvZGl2PlxuICogYGBgXG4gKlxuICogSXRzIGNvbXBpbGVkIHJlcHJlc2VudGF0aW9uIGlzOlxuICpcbiAqIGBgYHRzXG4gKiDJtcm1c3R5bGVNYXBJbnRlcnBvbGF0ZTYoXG4gKiAgICAna2V5OiAnLCB2MCwgJzsga2V5MTogJywgdjEsICc7IGtleTI6ICcsIHYyLCAnOyBrZXkzOiAnLCB2MywgJzsga2V5NDogJywgdjQsICc7IGtleTU6ICcsIHY1LFxuICogICAgJ3N1ZmZpeCcpO1xuICogYGBgXG4gKlxuICogQHBhcmFtIHByZWZpeCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYwIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYxIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMSBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYyIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMiBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYzIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMyBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHY0IFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpNCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHY1IFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBzdWZmaXggU3RhdGljIHZhbHVlIHVzZWQgZm9yIGNvbmNhdGVuYXRpb24gb25seS5cbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1c3R5bGVNYXBJbnRlcnBvbGF0ZTYoXG4gIHByZWZpeDogc3RyaW5nLFxuICB2MDogYW55LFxuICBpMDogc3RyaW5nLFxuICB2MTogYW55LFxuICBpMTogc3RyaW5nLFxuICB2MjogYW55LFxuICBpMjogc3RyaW5nLFxuICB2MzogYW55LFxuICBpMzogc3RyaW5nLFxuICB2NDogYW55LFxuICBpNDogc3RyaW5nLFxuICB2NTogYW55LFxuICBzdWZmaXg6IHN0cmluZyxcbik6IHZvaWQge1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGludGVycG9sYXRlZFZhbHVlID0gaW50ZXJwb2xhdGlvbjYoXG4gICAgbFZpZXcsXG4gICAgcHJlZml4LFxuICAgIHYwLFxuICAgIGkwLFxuICAgIHYxLFxuICAgIGkxLFxuICAgIHYyLFxuICAgIGkyLFxuICAgIHYzLFxuICAgIGkzLFxuICAgIHY0LFxuICAgIGk0LFxuICAgIHY1LFxuICAgIHN1ZmZpeCxcbiAgKTtcbiAgybXJtXN0eWxlTWFwKGludGVycG9sYXRlZFZhbHVlKTtcbn1cblxuLyoqXG4gKlxuICogVXBkYXRlIGFuIGludGVycG9sYXRlZCBzdHlsZSBvbiBhbiBlbGVtZW50IHdpdGggNyBib3VuZCB2YWx1ZXMgc3Vycm91bmRlZCBieSB0ZXh0LlxuICpcbiAqIFVzZWQgd2hlbiB0aGUgdmFsdWUgcGFzc2VkIHRvIGEgcHJvcGVydHkgaGFzIDcgaW50ZXJwb2xhdGVkIHZhbHVlcyBpbiBpdDpcbiAqXG4gKiBgYGBodG1sXG4gKiA8ZGl2IHN0eWxlPVwia2V5OiB7e3YwfX07IGtleTE6IHt7djF9fTsga2V5Mjoge3t2Mn19OyBrZXkzOiB7e3YzfX07IGtleTQ6IHt7djR9fTsga2V5NToge3t2NX19O1xuICogICAgICAgICAgICAga2V5Njoge3t2Nn19c3VmZml4XCI+PC9kaXY+XG4gKiBgYGBcbiAqXG4gKiBJdHMgY29tcGlsZWQgcmVwcmVzZW50YXRpb24gaXM6XG4gKlxuICogYGBgdHNcbiAqIMm1ybVzdHlsZU1hcEludGVycG9sYXRlNyhcbiAqICAgICdrZXk6ICcsIHYwLCAnOyBrZXkxOiAnLCB2MSwgJzsga2V5MjogJywgdjIsICc7IGtleTM6ICcsIHYzLCAnOyBrZXk0OiAnLCB2NCwgJzsga2V5NTogJywgdjUsXG4gKiAgICAnOyBrZXk2OiAnLCB2NiwgJ3N1ZmZpeCcpO1xuICogYGBgXG4gKlxuICogQHBhcmFtIHByZWZpeCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYwIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYxIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMSBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYyIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMiBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYzIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMyBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHY0IFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpNCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHY1IFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpNSBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHY2IFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBzdWZmaXggU3RhdGljIHZhbHVlIHVzZWQgZm9yIGNvbmNhdGVuYXRpb24gb25seS5cbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1c3R5bGVNYXBJbnRlcnBvbGF0ZTcoXG4gIHByZWZpeDogc3RyaW5nLFxuICB2MDogYW55LFxuICBpMDogc3RyaW5nLFxuICB2MTogYW55LFxuICBpMTogc3RyaW5nLFxuICB2MjogYW55LFxuICBpMjogc3RyaW5nLFxuICB2MzogYW55LFxuICBpMzogc3RyaW5nLFxuICB2NDogYW55LFxuICBpNDogc3RyaW5nLFxuICB2NTogYW55LFxuICBpNTogc3RyaW5nLFxuICB2NjogYW55LFxuICBzdWZmaXg6IHN0cmluZyxcbik6IHZvaWQge1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGludGVycG9sYXRlZFZhbHVlID0gaW50ZXJwb2xhdGlvbjcoXG4gICAgbFZpZXcsXG4gICAgcHJlZml4LFxuICAgIHYwLFxuICAgIGkwLFxuICAgIHYxLFxuICAgIGkxLFxuICAgIHYyLFxuICAgIGkyLFxuICAgIHYzLFxuICAgIGkzLFxuICAgIHY0LFxuICAgIGk0LFxuICAgIHY1LFxuICAgIGk1LFxuICAgIHY2LFxuICAgIHN1ZmZpeCxcbiAgKTtcbiAgybXJtXN0eWxlTWFwKGludGVycG9sYXRlZFZhbHVlKTtcbn1cblxuLyoqXG4gKlxuICogVXBkYXRlIGFuIGludGVycG9sYXRlZCBzdHlsZSBvbiBhbiBlbGVtZW50IHdpdGggOCBib3VuZCB2YWx1ZXMgc3Vycm91bmRlZCBieSB0ZXh0LlxuICpcbiAqIFVzZWQgd2hlbiB0aGUgdmFsdWUgcGFzc2VkIHRvIGEgcHJvcGVydHkgaGFzIDggaW50ZXJwb2xhdGVkIHZhbHVlcyBpbiBpdDpcbiAqXG4gKiBgYGBodG1sXG4gKiA8ZGl2IHN0eWxlPVwia2V5OiB7e3YwfX07IGtleTE6IHt7djF9fTsga2V5Mjoge3t2Mn19OyBrZXkzOiB7e3YzfX07IGtleTQ6IHt7djR9fTsga2V5NToge3t2NX19O1xuICogICAgICAgICAgICAga2V5Njoge3t2Nn19OyBrZXk3OiB7e3Y3fX1zdWZmaXhcIj48L2Rpdj5cbiAqIGBgYFxuICpcbiAqIEl0cyBjb21waWxlZCByZXByZXNlbnRhdGlvbiBpczpcbiAqXG4gKiBgYGB0c1xuICogybXJtXN0eWxlTWFwSW50ZXJwb2xhdGU4KFxuICogICAgJ2tleTogJywgdjAsICc7IGtleTE6ICcsIHYxLCAnOyBrZXkyOiAnLCB2MiwgJzsga2V5MzogJywgdjMsICc7IGtleTQ6ICcsIHY0LCAnOyBrZXk1OiAnLCB2NSxcbiAqICAgICc7IGtleTY6ICcsIHY2LCAnOyBrZXk3OiAnLCB2NywgJ3N1ZmZpeCcpO1xuICogYGBgXG4gKlxuICogQHBhcmFtIHByZWZpeCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYwIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYxIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMSBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYyIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMiBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHYzIFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpMyBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHY0IFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpNCBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHY1IFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpNSBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHY2IFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBpNiBTdGF0aWMgdmFsdWUgdXNlZCBmb3IgY29uY2F0ZW5hdGlvbiBvbmx5LlxuICogQHBhcmFtIHY3IFZhbHVlIGNoZWNrZWQgZm9yIGNoYW5nZS5cbiAqIEBwYXJhbSBzdWZmaXggU3RhdGljIHZhbHVlIHVzZWQgZm9yIGNvbmNhdGVuYXRpb24gb25seS5cbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1c3R5bGVNYXBJbnRlcnBvbGF0ZTgoXG4gIHByZWZpeDogc3RyaW5nLFxuICB2MDogYW55LFxuICBpMDogc3RyaW5nLFxuICB2MTogYW55LFxuICBpMTogc3RyaW5nLFxuICB2MjogYW55LFxuICBpMjogc3RyaW5nLFxuICB2MzogYW55LFxuICBpMzogc3RyaW5nLFxuICB2NDogYW55LFxuICBpNDogc3RyaW5nLFxuICB2NTogYW55LFxuICBpNTogc3RyaW5nLFxuICB2NjogYW55LFxuICBpNjogc3RyaW5nLFxuICB2NzogYW55LFxuICBzdWZmaXg6IHN0cmluZyxcbik6IHZvaWQge1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGludGVycG9sYXRlZFZhbHVlID0gaW50ZXJwb2xhdGlvbjgoXG4gICAgbFZpZXcsXG4gICAgcHJlZml4LFxuICAgIHYwLFxuICAgIGkwLFxuICAgIHYxLFxuICAgIGkxLFxuICAgIHYyLFxuICAgIGkyLFxuICAgIHYzLFxuICAgIGkzLFxuICAgIHY0LFxuICAgIGk0LFxuICAgIHY1LFxuICAgIGk1LFxuICAgIHY2LFxuICAgIGk2LFxuICAgIHY3LFxuICAgIHN1ZmZpeCxcbiAgKTtcbiAgybXJtXN0eWxlTWFwKGludGVycG9sYXRlZFZhbHVlKTtcbn1cblxuLyoqXG4gKiBVcGRhdGUgYW4gaW50ZXJwb2xhdGVkIHN0eWxlIG9uIGFuIGVsZW1lbnQgd2l0aCA5IG9yIG1vcmUgYm91bmQgdmFsdWVzIHN1cnJvdW5kZWQgYnkgdGV4dC5cbiAqXG4gKiBVc2VkIHdoZW4gdGhlIG51bWJlciBvZiBpbnRlcnBvbGF0ZWQgdmFsdWVzIGV4Y2VlZHMgOC5cbiAqXG4gKiBgYGBodG1sXG4gKiA8ZGl2XG4gKiAgY2xhc3M9XCJrZXk6IHt7djB9fTsga2V5MToge3t2MX19OyBrZXkyOiB7e3YyfX07IGtleTM6IHt7djN9fTsga2V5NDoge3t2NH19OyBrZXk1OiB7e3Y1fX07XG4gKiAgICAgICAgIGtleTY6IHt7djZ9fTsga2V5Nzoge3t2N319OyBrZXk4OiB7e3Y4fX07IGtleTk6IHt7djl9fXN1ZmZpeFwiPjwvZGl2PlxuICogYGBgXG4gKlxuICogSXRzIGNvbXBpbGVkIHJlcHJlc2VudGF0aW9uIGlzOlxuICpcbiAqIGBgYHRzXG4gKiDJtcm1c3R5bGVNYXBJbnRlcnBvbGF0ZVYoXG4gKiAgICBbJ2tleTogJywgdjAsICc7IGtleTE6ICcsIHYxLCAnOyBrZXkyOiAnLCB2MiwgJzsga2V5MzogJywgdjMsICc7IGtleTQ6ICcsIHY0LCAnOyBrZXk1OiAnLCB2NSxcbiAqICAgICAnOyBrZXk2OiAnLCB2NiwgJzsga2V5NzogJywgdjcsICc7IGtleTg6ICcsIHY4LCAnOyBrZXk5OiAnLCB2OSwgJ3N1ZmZpeCddKTtcbiAqIGBgYFxuICouXG4gKiBAcGFyYW0gdmFsdWVzIFRoZSBjb2xsZWN0aW9uIG9mIHZhbHVlcyBhbmQgdGhlIHN0cmluZ3MgaW4tYmV0d2VlbiB0aG9zZSB2YWx1ZXMsIGJlZ2lubmluZyB3aXRoXG4gKiBhIHN0cmluZyBwcmVmaXggYW5kIGVuZGluZyB3aXRoIGEgc3RyaW5nIHN1ZmZpeC5cbiAqIChlLmcuIGBbJ3ByZWZpeCcsIHZhbHVlMCwgJzsga2V5MjogJywgdmFsdWUxLCAnOyBrZXkyOiAnLCB2YWx1ZTIsIC4uLiwgdmFsdWU5OSwgJ3N1ZmZpeCddYClcbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1c3R5bGVNYXBJbnRlcnBvbGF0ZVYodmFsdWVzOiBhbnlbXSk6IHZvaWQge1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IGludGVycG9sYXRlZFZhbHVlID0gaW50ZXJwb2xhdGlvblYobFZpZXcsIHZhbHVlcyk7XG4gIMm1ybVzdHlsZU1hcChpbnRlcnBvbGF0ZWRWYWx1ZSk7XG59XG4iXX0=