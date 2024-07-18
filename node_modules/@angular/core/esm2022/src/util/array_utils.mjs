/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { assertEqual, assertLessThanOrEqual } from './assert';
/**
 * Determines if the contents of two arrays is identical
 *
 * @param a first array
 * @param b second array
 * @param identityAccessor Optional function for extracting stable object identity from a value in
 *     the array.
 */
export function arrayEquals(a, b, identityAccessor) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++) {
        let valueA = a[i];
        let valueB = b[i];
        if (identityAccessor) {
            valueA = identityAccessor(valueA);
            valueB = identityAccessor(valueB);
        }
        if (valueB !== valueA) {
            return false;
        }
    }
    return true;
}
/**
 * Flattens an array.
 */
export function flatten(list) {
    return list.flat(Number.POSITIVE_INFINITY);
}
export function deepForEach(input, fn) {
    input.forEach((value) => (Array.isArray(value) ? deepForEach(value, fn) : fn(value)));
}
export function addToArray(arr, index, value) {
    // perf: array.push is faster than array.splice!
    if (index >= arr.length) {
        arr.push(value);
    }
    else {
        arr.splice(index, 0, value);
    }
}
export function removeFromArray(arr, index) {
    // perf: array.pop is faster than array.splice!
    if (index >= arr.length - 1) {
        return arr.pop();
    }
    else {
        return arr.splice(index, 1)[0];
    }
}
export function newArray(size, value) {
    const list = [];
    for (let i = 0; i < size; i++) {
        list.push(value);
    }
    return list;
}
/**
 * Remove item from array (Same as `Array.splice()` but faster.)
 *
 * `Array.splice()` is not as fast because it has to allocate an array for the elements which were
 * removed. This causes memory pressure and slows down code when most of the time we don't
 * care about the deleted items array.
 *
 * https://jsperf.com/fast-array-splice (About 20x faster)
 *
 * @param array Array to splice
 * @param index Index of element in array to remove.
 * @param count Number of items to remove.
 */
export function arraySplice(array, index, count) {
    const length = array.length - count;
    while (index < length) {
        array[index] = array[index + count];
        index++;
    }
    while (count--) {
        array.pop(); // shrink the array
    }
}
/**
 * Same as `Array.splice(index, 0, value)` but faster.
 *
 * `Array.splice()` is not fast because it has to allocate an array for the elements which were
 * removed. This causes memory pressure and slows down code when most of the time we don't
 * care about the deleted items array.
 *
 * @param array Array to splice.
 * @param index Index in array where the `value` should be added.
 * @param value Value to add to array.
 */
export function arrayInsert(array, index, value) {
    ngDevMode && assertLessThanOrEqual(index, array.length, "Can't insert past array end.");
    let end = array.length;
    while (end > index) {
        const previousEnd = end - 1;
        array[end] = array[previousEnd];
        end = previousEnd;
    }
    array[index] = value;
}
/**
 * Same as `Array.splice2(index, 0, value1, value2)` but faster.
 *
 * `Array.splice()` is not fast because it has to allocate an array for the elements which were
 * removed. This causes memory pressure and slows down code when most of the time we don't
 * care about the deleted items array.
 *
 * @param array Array to splice.
 * @param index Index in array where the `value` should be added.
 * @param value1 Value to add to array.
 * @param value2 Value to add to array.
 */
export function arrayInsert2(array, index, value1, value2) {
    ngDevMode && assertLessThanOrEqual(index, array.length, "Can't insert past array end.");
    let end = array.length;
    if (end == index) {
        // inserting at the end.
        array.push(value1, value2);
    }
    else if (end === 1) {
        // corner case when we have less items in array than we have items to insert.
        array.push(value2, array[0]);
        array[0] = value1;
    }
    else {
        end--;
        array.push(array[end - 1], array[end]);
        while (end > index) {
            const previousEnd = end - 2;
            array[end] = array[previousEnd];
            end--;
        }
        array[index] = value1;
        array[index + 1] = value2;
    }
}
/**
 * Get an index of an `value` in a sorted `array`.
 *
 * NOTE:
 * - This uses binary search algorithm for fast removals.
 *
 * @param array A sorted array to binary search.
 * @param value The value to look for.
 * @returns index of the value.
 *   - positive index if value found.
 *   - negative index if value not found. (`~index` to get the value where it should have been
 *     located)
 */
export function arrayIndexOfSorted(array, value) {
    return _arrayIndexOfSorted(array, value, 0);
}
/**
 * Set a `value` for a `key`.
 *
 * @param keyValueArray to modify.
 * @param key The key to locate or create.
 * @param value The value to set for a `key`.
 * @returns index (always even) of where the value vas set.
 */
export function keyValueArraySet(keyValueArray, key, value) {
    let index = keyValueArrayIndexOf(keyValueArray, key);
    if (index >= 0) {
        // if we found it set it.
        keyValueArray[index | 1] = value;
    }
    else {
        index = ~index;
        arrayInsert2(keyValueArray, index, key, value);
    }
    return index;
}
/**
 * Retrieve a `value` for a `key` (on `undefined` if not found.)
 *
 * @param keyValueArray to search.
 * @param key The key to locate.
 * @return The `value` stored at the `key` location or `undefined if not found.
 */
export function keyValueArrayGet(keyValueArray, key) {
    const index = keyValueArrayIndexOf(keyValueArray, key);
    if (index >= 0) {
        // if we found it retrieve it.
        return keyValueArray[index | 1];
    }
    return undefined;
}
/**
 * Retrieve a `key` index value in the array or `-1` if not found.
 *
 * @param keyValueArray to search.
 * @param key The key to locate.
 * @returns index of where the key is (or should have been.)
 *   - positive (even) index if key found.
 *   - negative index if key not found. (`~index` (even) to get the index where it should have
 *     been inserted.)
 */
export function keyValueArrayIndexOf(keyValueArray, key) {
    return _arrayIndexOfSorted(keyValueArray, key, 1);
}
/**
 * Delete a `key` (and `value`) from the `KeyValueArray`.
 *
 * @param keyValueArray to modify.
 * @param key The key to locate or delete (if exist).
 * @returns index of where the key was (or should have been.)
 *   - positive (even) index if key found and deleted.
 *   - negative index if key not found. (`~index` (even) to get the index where it should have
 *     been.)
 */
export function keyValueArrayDelete(keyValueArray, key) {
    const index = keyValueArrayIndexOf(keyValueArray, key);
    if (index >= 0) {
        // if we found it remove it.
        arraySplice(keyValueArray, index, 2);
    }
    return index;
}
/**
 * INTERNAL: Get an index of an `value` in a sorted `array` by grouping search by `shift`.
 *
 * NOTE:
 * - This uses binary search algorithm for fast removals.
 *
 * @param array A sorted array to binary search.
 * @param value The value to look for.
 * @param shift grouping shift.
 *   - `0` means look at every location
 *   - `1` means only look at every other (even) location (the odd locations are to be ignored as
 *         they are values.)
 * @returns index of the value.
 *   - positive index if value found.
 *   - negative index if value not found. (`~index` to get the value where it should have been
 * inserted)
 */
function _arrayIndexOfSorted(array, value, shift) {
    ngDevMode && assertEqual(Array.isArray(array), true, 'Expecting an array');
    let start = 0;
    let end = array.length >> shift;
    while (end !== start) {
        const middle = start + ((end - start) >> 1); // find the middle.
        const current = array[middle << shift];
        if (value === current) {
            return middle << shift;
        }
        else if (current > value) {
            end = middle;
        }
        else {
            start = middle + 1; // We already searched middle so make it non-inclusive by adding 1
        }
    }
    return ~(end << shift);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJyYXlfdXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy91dGlsL2FycmF5X3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxXQUFXLEVBQUUscUJBQXFCLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFFNUQ7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxXQUFXLENBQUksQ0FBTSxFQUFFLENBQU0sRUFBRSxnQkFBd0M7SUFDckYsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxNQUFNO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDeEMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUNsQyxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEIsSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xCLElBQUksZ0JBQWdCLEVBQUUsQ0FBQztZQUNyQixNQUFNLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxDQUFRLENBQUM7WUFDekMsTUFBTSxHQUFHLGdCQUFnQixDQUFDLE1BQU0sQ0FBUSxDQUFDO1FBQzNDLENBQUM7UUFDRCxJQUFJLE1BQU0sS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUN0QixPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7SUFDSCxDQUFDO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsT0FBTyxDQUFDLElBQVc7SUFDakMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQzdDLENBQUM7QUFFRCxNQUFNLFVBQVUsV0FBVyxDQUFJLEtBQW9C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Q0FBQyxFQUFFLENBQUM7UUFDZiw0QkFBNEI7UUFDNUIsV0FBVyxDQUFDLGFBQWEsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7O0dBZ0JHO0FBQ0gsU0FBUyxtQkFBbUIsQ0FBQyxLQUFlLEVBQUUsS0FBYSxFQUFFLEtBQWE7SUFDeEUsU0FBUyxJQUFJLFdBQVcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO0lBQzNFLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztJQUNkLElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDO0lBQ2hDLE9BQU8sR0FBRyxLQUFLLEtBQUssRUFBRSxDQUFDO1FBQ3JCLE1BQU0sTUFBTSxHQUFHLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsbUJBQW1CO1FBQ2hFLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLENBQUM7UUFDdkMsSUFBSSxLQUFLLEtBQUssT0FBTyxFQUFFLENBQUM7WUFDdEIsT0FBTyxNQUFNLElBQUksS0FBSyxDQUFDO1FBQ3pCLENBQUM7YUFBTSxJQUFJLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQztZQUMzQixHQUFHLEdBQUcsTUFBTSxDQUFDO1FBQ2YsQ0FBQzthQUFNLENBQUM7WUFDTixLQUFLLEdBQUcsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLGtFQUFrRTtRQUN4RixDQUFDO0lBQ0gsQ0FBQztJQUNELE9BQU8sQ0FBQyxDQUFDLEdBQUcsSUFBSSxLQUFLLENBQUMsQ0FBQztBQUN6QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7YXNzZXJ0RXF1YWwsIGFzc2VydExlc3NUaGFuT3JFcXVhbH0gZnJvbSAnLi9hc3NlcnQnO1xuXG4vKipcbiAqIERldGVybWluZXMgaWYgdGhlIGNvbnRlbnRzIG9mIHR3byBhcnJheXMgaXMgaWRlbnRpY2FsXG4gKlxuICogQHBhcmFtIGEgZmlyc3QgYXJyYXlcbiAqIEBwYXJhbSBiIHNlY29uZCBhcnJheVxuICogQHBhcmFtIGlkZW50aXR5QWNjZXNzb3IgT3B0aW9uYWwgZnVuY3Rpb24gZm9yIGV4dHJhY3Rpbmcgc3RhYmxlIG9iamVjdCBpZGVudGl0eSBmcm9tIGEgdmFsdWUgaW5cbiAqICAgICB0aGUgYXJyYXkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcnJheUVxdWFsczxUPihhOiBUW10sIGI6IFRbXSwgaWRlbnRpdHlBY2Nlc3Nvcj86ICh2YWx1ZTogVCkgPT4gdW5rbm93bik6IGJvb2xlYW4ge1xuICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgIGxldCB2YWx1ZUEgPSBhW2ldO1xuICAgIGxldCB2YWx1ZUIgPSBiW2ldO1xuICAgIGlmIChpZGVudGl0eUFjY2Vzc29yKSB7XG4gICAgICB2YWx1ZUEgPSBpZGVudGl0eUFjY2Vzc29yKHZhbHVlQSkgYXMgYW55O1xuICAgICAgdmFsdWVCID0gaWRlbnRpdHlBY2Nlc3Nvcih2YWx1ZUIpIGFzIGFueTtcbiAgICB9XG4gICAgaWYgKHZhbHVlQiAhPT0gdmFsdWVBKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vKipcbiAqIEZsYXR0ZW5zIGFuIGFycmF5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZmxhdHRlbihsaXN0OiBhbnlbXSk6IGFueVtdIHtcbiAgcmV0dXJuIGxpc3QuZmxhdChOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVlcEZvckVhY2g8VD4oaW5wdXQ6IChUIHwgYW55W10pW10sIGZuOiAodmFsdWU6IFQpID0+IHZvaWQpOiB2b2lkIHtcbiAgaW5wdXQuZm9yRWFjaCgodmFsdWUpID0+IChBcnJheS5pc0FycmF5KHZhbHVlKSA/IGRlZXBGb3JFYWNoKHZhbHVlLCBmbikgOiBmbih2YWx1ZSkpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvQXJyYXkoYXJyOiBhbnlbXSwgaW5kZXg6IG51bWJlciwgdmFsdWU6IGFueSk6IHZvaWQge1xuICAvLyBwZXJmOiBhcnJheS5wdXNoIGlzIGZhc3RlciB0aGFuIGFycmF5LnNwbGljZSFcbiAgaWYgKGluZGV4ID49IGFyci5sZW5ndGgpIHtcbiAgICBhcnIucHVzaCh2YWx1ZSk7XG4gIH0gZWxzZSB7XG4gICAgYXJyLnNwbGljZShpbmRleCwgMCwgdmFsdWUpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVGcm9tQXJyYXkoYXJyOiBhbnlbXSwgaW5kZXg6IG51bWJlcik6IGFueSB7XG4gIC8vIHBlcmY6IGFycmF5LnBvcCBpcyBmYXN0ZXIgdGhhbiBhcnJheS5zcGxpY2UhXG4gIGlmIChpbmRleCA+PSBhcnIubGVuZ3RoIC0gMSkge1xuICAgIHJldHVybiBhcnIucG9wKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGFyci5zcGxpY2UoaW5kZXgsIDEpWzBdO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuZXdBcnJheTxUID0gYW55PihzaXplOiBudW1iZXIpOiBUW107XG5leHBvcnQgZnVuY3Rpb24gbmV3QXJyYXk8VD4oc2l6ZTogbnVtYmVyLCB2YWx1ZTogVCk6IFRbXTtcbmV4cG9ydCBmdW5jdGlvbiBuZXdBcnJheTxUPihzaXplOiBudW1iZXIsIHZhbHVlPzogVCk6IFRbXSB7XG4gIGNvbnN0IGxpc3Q6IFRbXSA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHNpemU7IGkrKykge1xuICAgIGxpc3QucHVzaCh2YWx1ZSEpO1xuICB9XG4gIHJldHVybiBsaXN0O1xufVxuXG4vKipcbiAqIFJlbW92ZSBpdGVtIGZyb20gYXJyYXkgKFNhbWUgYXMgYEFycmF5LnNwbGljZSgpYCBidXQgZmFzdGVyLilcbiAqXG4gKiBgQXJyYXkuc3BsaWNlKClgIGlzIG5vdCBhcyBmYXN0IGJlY2F1c2UgaXQgaGFzIHRvIGFsbG9jYXRlIGFuIGFycmF5IGZvciB0aGUgZWxlbWVudHMgd2hpY2ggd2VyZVxuICogcmVtb3ZlZC4gVGhpcyBjYXVzZXMgbWVtb3J5IHByZXNzdXJlIGFuZCBzbG93cyBkb3duIGNvZGUgd2hlbiBtb3N0IG9mIHRoZSB0aW1lIHdlIGRvbid0XG4gKiBjYXJlIGFib3V0IHRoZSBkZWxldGVkIGl0ZW1zIGFycmF5LlxuICpcbiAqIGh0dHBzOi8vanNwZXJmLmNvbS9mYXN0LWFycmF5LXNwbGljZSAoQWJvdXQgMjB4IGZhc3RlcilcbiAqXG4gKiBAcGFyYW0gYXJyYXkgQXJyYXkgdG8gc3BsaWNlXG4gKiBAcGFyYW0gaW5kZXggSW5kZXggb2YgZWxlbWVudCBpbiBhcnJheSB0byByZW1vdmUuXG4gKiBAcGFyYW0gY291bnQgTnVtYmVyIG9mIGl0ZW1zIHRvIHJlbW92ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFycmF5U3BsaWNlKGFycmF5OiBhbnlbXSwgaW5kZXg6IG51bWJlciwgY291bnQ6IG51bWJlcik6IHZvaWQge1xuICBjb25zdCBsZW5ndGggPSBhcnJheS5sZW5ndGggLSBjb3VudDtcbiAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgYXJyYXlbaW5kZXhdID0gYXJyYXlbaW5kZXggKyBjb3VudF07XG4gICAgaW5kZXgrKztcbiAgfVxuICB3aGlsZSAoY291bnQtLSkge1xuICAgIGFycmF5LnBvcCgpOyAvLyBzaHJpbmsgdGhlIGFycmF5XG4gIH1cbn1cblxuLyoqXG4gKiBTYW1lIGFzIGBBcnJheS5zcGxpY2UoaW5kZXgsIDAsIHZhbHVlKWAgYnV0IGZhc3Rlci5cbiAqXG4gKiBgQXJyYXkuc3BsaWNlKClgIGlzIG5vdCBmYXN0IGJlY2F1c2UgaXQgaGFzIHRvIGFsbG9jYXRlIGFuIGFycmF5IGZvciB0aGUgZWxlbWVudHMgd2hpY2ggd2VyZVxuICogcmVtb3ZlZC4gVGhpcyBjYXVzZXMgbWVtb3J5IHByZXNzdXJlIGFuZCBzbG93cyBkb3duIGNvZGUgd2hlbiBtb3N0IG9mIHRoZSB0aW1lIHdlIGRvbid0XG4gKiBjYXJlIGFib3V0IHRoZSBkZWxldGVkIGl0ZW1zIGFycmF5LlxuICpcbiAqIEBwYXJhbSBhcnJheSBBcnJheSB0byBzcGxpY2UuXG4gKiBAcGFyYW0gaW5kZXggSW5kZXggaW4gYXJyYXkgd2hlcmUgdGhlIGB2YWx1ZWAgc2hvdWxkIGJlIGFkZGVkLlxuICogQHBhcmFtIHZhbHVlIFZhbHVlIHRvIGFkZCB0byBhcnJheS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFycmF5SW5zZXJ0KGFycmF5OiBhbnlbXSwgaW5kZXg6IG51bWJlciwgdmFsdWU6IGFueSk6IHZvaWQge1xuICBuZ0Rldk1vZGUgJiYgYXNzZXJ0TGVzc1RoYW5PckVxdWFsKGluZGV4LCBhcnJheS5sZW5ndGgsIFwiQ2FuJ3QgaW5zZXJ0IHBhc3QgYXJyYXkgZW5kLlwiKTtcbiAgbGV0IGVuZCA9IGFycmF5Lmxlbmd0aDtcbiAgd2hpbGUgKGVuZCA+IGluZGV4KSB7XG4gICAgY29uc3QgcHJldmlvdXNFbmQgPSBlbmQgLSAxO1xuICAgIGFycmF5W2VuZF0gPSBhcnJheVtwcmV2aW91c0VuZF07XG4gICAgZW5kID0gcHJldmlvdXNFbmQ7XG4gIH1cbiAgYXJyYXlbaW5kZXhdID0gdmFsdWU7XG59XG5cbi8qKlxuICogU2FtZSBhcyBgQXJyYXkuc3BsaWNlMihpbmRleCwgMCwgdmFsdWUxLCB2YWx1ZTIpYCBidXQgZmFzdGVyLlxuICpcbiAqIGBBcnJheS5zcGxpY2UoKWAgaXMgbm90IGZhc3QgYmVjYXVzZSBpdCBoYXMgdG8gYWxsb2NhdGUgYW4gYXJyYXkgZm9yIHRoZSBlbGVtZW50cyB3aGljaCB3ZXJlXG4gKiByZW1vdmVkLiBUaGlzIGNhdXNlcyBtZW1vcnkgcHJlc3N1cmUgYW5kIHNsb3dzIGRvd24gY29kZSB3aGVuIG1vc3Qgb2YgdGhlIHRpbWUgd2UgZG9uJ3RcbiAqIGNhcmUgYWJvdXQgdGhlIGRlbGV0ZWQgaXRlbXMgYXJyYXkuXG4gKlxuICogQHBhcmFtIGFycmF5IEFycmF5IHRvIHNwbGljZS5cbiAqIEBwYXJhbSBpbmRleCBJbmRleCBpbiBhcnJheSB3aGVyZSB0aGUgYHZhbHVlYCBzaG91bGQgYmUgYWRkZWQuXG4gKiBAcGFyYW0gdmFsdWUxIFZhbHVlIHRvIGFkZCB0byBhcnJheS5cbiAqIEBwYXJhbSB2YWx1ZTIgVmFsdWUgdG8gYWRkIHRvIGFycmF5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXJyYXlJbnNlcnQyKGFycmF5OiBhbnlbXSwgaW5kZXg6IG51bWJlciwgdmFsdWUxOiBhbnksIHZhbHVlMjogYW55KTogdm9pZCB7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnRMZXNzVGhhbk9yRXF1YWwoaW5kZXgsIGFycmF5Lmxlbmd0aCwgXCJDYW4ndCBpbnNlcnQgcGFzdCBhcnJheSBlbmQuXCIpO1xuICBsZXQgZW5kID0gYXJyYXkubGVuZ3RoO1xuICBpZiAoZW5kID09IGluZGV4KSB7XG4gICAgLy8gaW5zZXJ0aW5nIGF0IHRoZSBlbmQuXG4gICAgYXJyYXkucHVzaCh2YWx1ZTEsIHZhbHVlMik7XG4gIH0gZWxzZSBpZiAoZW5kID09PSAxKSB7XG4gICAgLy8gY29ybmVyIGNhc2Ugd2hlbiB3ZSBoYXZlIGxlc3MgaXRlbXMgaW4gYXJyYXkgdGhhbiB3ZSBoYXZlIGl0ZW1zIHRvIGluc2VydC5cbiAgICBhcnJheS5wdXNoKHZhbHVlMiwgYXJyYXlbMF0pO1xuICAgIGFycmF5WzBdID0gdmFsdWUxO1xuICB9IGVsc2Uge1xuICAgIGVuZC0tO1xuICAgIGFycmF5LnB1c2goYXJyYXlbZW5kIC0gMV0sIGFycmF5W2VuZF0pO1xuICAgIHdoaWxlIChlbmQgPiBpbmRleCkge1xuICAgICAgY29uc3QgcHJldmlvdXNFbmQgPSBlbmQgLSAyO1xuICAgICAgYXJyYXlbZW5kXSA9IGFycmF5W3ByZXZpb3VzRW5kXTtcbiAgICAgIGVuZC0tO1xuICAgIH1cbiAgICBhcnJheVtpbmRleF0gPSB2YWx1ZTE7XG4gICAgYXJyYXlbaW5kZXggKyAxXSA9IHZhbHVlMjtcbiAgfVxufVxuXG4vKipcbiAqIEdldCBhbiBpbmRleCBvZiBhbiBgdmFsdWVgIGluIGEgc29ydGVkIGBhcnJheWAuXG4gKlxuICogTk9URTpcbiAqIC0gVGhpcyB1c2VzIGJpbmFyeSBzZWFyY2ggYWxnb3JpdGhtIGZvciBmYXN0IHJlbW92YWxzLlxuICpcbiAqIEBwYXJhbSBhcnJheSBBIHNvcnRlZCBhcnJheSB0byBiaW5hcnkgc2VhcmNoLlxuICogQHBhcmFtIHZhbHVlIFRoZSB2YWx1ZSB0byBsb29rIGZvci5cbiAqIEByZXR1cm5zIGluZGV4IG9mIHRoZSB2YWx1ZS5cbiAqICAgLSBwb3NpdGl2ZSBpbmRleCBpZiB2YWx1ZSBmb3VuZC5cbiAqICAgLSBuZWdhdGl2ZSBpbmRleCBpZiB2YWx1ZSBub3QgZm91bmQuIChgfmluZGV4YCB0byBnZXQgdGhlIHZhbHVlIHdoZXJlIGl0IHNob3VsZCBoYXZlIGJlZW5cbiAqICAgICBsb2NhdGVkKVxuICovXG5leHBvcnQgZnVuY3Rpb24gYXJyYXlJbmRleE9mU29ydGVkKGFycmF5OiBzdHJpbmdbXSwgdmFsdWU6IHN0cmluZyk6IG51bWJlciB7XG4gIHJldHVybiBfYXJyYXlJbmRleE9mU29ydGVkKGFycmF5LCB2YWx1ZSwgMCk7XG59XG5cbi8qKlxuICogYEtleVZhbHVlQXJyYXlgIGlzIGFuIGFycmF5IHdoZXJlIGV2ZW4gcG9zaXRpb25zIGNvbnRhaW4ga2V5cyBhbmQgb2RkIHBvc2l0aW9ucyBjb250YWluIHZhbHVlcy5cbiAqXG4gKiBgS2V5VmFsdWVBcnJheWAgcHJvdmlkZXMgYSB2ZXJ5IGVmZmljaWVudCB3YXkgb2YgaXRlcmF0aW5nIG92ZXIgaXRzIGNvbnRlbnRzLiBGb3Igc21hbGxcbiAqIHNldHMgKH4xMCkgdGhlIGNvc3Qgb2YgYmluYXJ5IHNlYXJjaGluZyBhbiBgS2V5VmFsdWVBcnJheWAgaGFzIGFib3V0IHRoZSBzYW1lIHBlcmZvcm1hbmNlXG4gKiBjaGFyYWN0ZXJpc3RpY3MgdGhhdCBvZiBhIGBNYXBgIHdpdGggc2lnbmlmaWNhbnRseSBiZXR0ZXIgbWVtb3J5IGZvb3RwcmludC5cbiAqXG4gKiBJZiB1c2VkIGFzIGEgYE1hcGAgdGhlIGtleXMgYXJlIHN0b3JlZCBpbiBhbHBoYWJldGljYWwgb3JkZXIgc28gdGhhdCB0aGV5IGNhbiBiZSBiaW5hcnkgc2VhcmNoZWRcbiAqIGZvciByZXRyaWV2YWwuXG4gKlxuICogU2VlOiBga2V5VmFsdWVBcnJheVNldGAsIGBrZXlWYWx1ZUFycmF5R2V0YCwgYGtleVZhbHVlQXJyYXlJbmRleE9mYCwgYGtleVZhbHVlQXJyYXlEZWxldGVgLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEtleVZhbHVlQXJyYXk8VkFMVUU+IGV4dGVuZHMgQXJyYXk8VkFMVUUgfCBzdHJpbmc+IHtcbiAgX19icmFuZF9fOiAnYXJyYXktbWFwJztcbn1cblxuLyoqXG4gKiBTZXQgYSBgdmFsdWVgIGZvciBhIGBrZXlgLlxuICpcbiAqIEBwYXJhbSBrZXlWYWx1ZUFycmF5IHRvIG1vZGlmeS5cbiAqIEBwYXJhbSBrZXkgVGhlIGtleSB0byBsb2NhdGUgb3IgY3JlYXRlLlxuICogQHBhcmFtIHZhbHVlIFRoZSB2YWx1ZSB0byBzZXQgZm9yIGEgYGtleWAuXG4gKiBAcmV0dXJucyBpbmRleCAoYWx3YXlzIGV2ZW4pIG9mIHdoZXJlIHRoZSB2YWx1ZSB2YXMgc2V0LlxuICovXG5leHBvcnQgZnVuY3Rpb24ga2V5VmFsdWVBcnJheVNldDxWPihcbiAga2V5VmFsdWVBcnJheTogS2V5VmFsdWVBcnJheTxWPixcbiAga2V5OiBzdHJpbmcsXG4gIHZhbHVlOiBWLFxuKTogbnVtYmVyIHtcbiAgbGV0IGluZGV4ID0ga2V5VmFsdWVBcnJheUluZGV4T2Yoa2V5VmFsdWVBcnJheSwga2V5KTtcbiAgaWYgKGluZGV4ID49IDApIHtcbiAgICAvLyBpZiB3ZSBmb3VuZCBpdCBzZXQgaXQuXG4gICAga2V5VmFsdWVBcnJheVtpbmRleCB8IDFdID0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgaW5kZXggPSB+aW5kZXg7XG4gICAgYXJyYXlJbnNlcnQyKGtleVZhbHVlQXJyYXksIGluZGV4LCBrZXksIHZhbHVlKTtcbiAgfVxuICByZXR1cm4gaW5kZXg7XG59XG5cbi8qKlxuICogUmV0cmlldmUgYSBgdmFsdWVgIGZvciBhIGBrZXlgIChvbiBgdW5kZWZpbmVkYCBpZiBub3QgZm91bmQuKVxuICpcbiAqIEBwYXJhbSBrZXlWYWx1ZUFycmF5IHRvIHNlYXJjaC5cbiAqIEBwYXJhbSBrZXkgVGhlIGtleSB0byBsb2NhdGUuXG4gKiBAcmV0dXJuIFRoZSBgdmFsdWVgIHN0b3JlZCBhdCB0aGUgYGtleWAgbG9jYXRpb24gb3IgYHVuZGVmaW5lZCBpZiBub3QgZm91bmQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBrZXlWYWx1ZUFycmF5R2V0PFY+KGtleVZhbHVlQXJyYXk6IEtleVZhbHVlQXJyYXk8Vj4sIGtleTogc3RyaW5nKTogViB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IGluZGV4ID0ga2V5VmFsdWVBcnJheUluZGV4T2Yoa2V5VmFsdWVBcnJheSwga2V5KTtcbiAgaWYgKGluZGV4ID49IDApIHtcbiAgICAvLyBpZiB3ZSBmb3VuZCBpdCByZXRyaWV2ZSBpdC5cbiAgICByZXR1cm4ga2V5VmFsdWVBcnJheVtpbmRleCB8IDFdIGFzIFY7XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBSZXRyaWV2ZSBhIGBrZXlgIGluZGV4IHZhbHVlIGluIHRoZSBhcnJheSBvciBgLTFgIGlmIG5vdCBmb3VuZC5cbiAqXG4gKiBAcGFyYW0ga2V5VmFsdWVBcnJheSB0byBzZWFyY2guXG4gKiBAcGFyYW0ga2V5IFRoZSBrZXkgdG8gbG9jYXRlLlxuICogQHJldHVybnMgaW5kZXggb2Ygd2hlcmUgdGhlIGtleSBpcyAob3Igc2hvdWxkIGhhdmUgYmVlbi4pXG4gKiAgIC0gcG9zaXRpdmUgKGV2ZW4pIGluZGV4IGlmIGtleSBmb3VuZC5cbiAqICAgLSBuZWdhdGl2ZSBpbmRleCBpZiBrZXkgbm90IGZvdW5kLiAoYH5pbmRleGAgKGV2ZW4pIHRvIGdldCB0aGUgaW5kZXggd2hlcmUgaXQgc2hvdWxkIGhhdmVcbiAqICAgICBiZWVuIGluc2VydGVkLilcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGtleVZhbHVlQXJyYXlJbmRleE9mPFY+KGtleVZhbHVlQXJyYXk6IEtleVZhbHVlQXJyYXk8Vj4sIGtleTogc3RyaW5nKTogbnVtYmVyIHtcbiAgcmV0dXJuIF9hcnJheUluZGV4T2ZTb3J0ZWQoa2V5VmFsdWVBcnJheSBhcyBzdHJpbmdbXSwga2V5LCAxKTtcbn1cblxuLyoqXG4gKiBEZWxldGUgYSBga2V5YCAoYW5kIGB2YWx1ZWApIGZyb20gdGhlIGBLZXlWYWx1ZUFycmF5YC5cbiAqXG4gKiBAcGFyYW0ga2V5VmFsdWVBcnJheSB0byBtb2RpZnkuXG4gKiBAcGFyYW0ga2V5IFRoZSBrZXkgdG8gbG9jYXRlIG9yIGRlbGV0ZSAoaWYgZXhpc3QpLlxuICogQHJldHVybnMgaW5kZXggb2Ygd2hlcmUgdGhlIGtleSB3YXMgKG9yIHNob3VsZCBoYXZlIGJlZW4uKVxuICogICAtIHBvc2l0aXZlIChldmVuKSBpbmRleCBpZiBrZXkgZm91bmQgYW5kIGRlbGV0ZWQuXG4gKiAgIC0gbmVnYXRpdmUgaW5kZXggaWYga2V5IG5vdCBmb3VuZC4gKGB+aW5kZXhgIChldmVuKSB0byBnZXQgdGhlIGluZGV4IHdoZXJlIGl0IHNob3VsZCBoYXZlXG4gKiAgICAgYmVlbi4pXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBrZXlWYWx1ZUFycmF5RGVsZXRlPFY+KGtleVZhbHVlQXJyYXk6IEtleVZhbHVlQXJyYXk8Vj4sIGtleTogc3RyaW5nKTogbnVtYmVyIHtcbiAgY29uc3QgaW5kZXggPSBrZXlWYWx1ZUFycmF5SW5kZXhPZihrZXlWYWx1ZUFycmF5LCBrZXkpO1xuICBpZiAoaW5kZXggPj0gMCkge1xuICAgIC8vIGlmIHdlIGZvdW5kIGl0IHJlbW92ZSBpdC5cbiAgICBhcnJheVNwbGljZShrZXlWYWx1ZUFycmF5LCBpbmRleCwgMik7XG4gIH1cbiAgcmV0dXJuIGluZGV4O1xufVxuXG4vKipcbiAqIElOVEVSTkFMOiBHZXQgYW4gaW5kZXggb2YgYW4gYHZhbHVlYCBpbiBhIHNvcnRlZCBgYXJyYXlgIGJ5IGdyb3VwaW5nIHNlYXJjaCBieSBgc2hpZnRgLlxuICpcbiAqIE5PVEU6XG4gKiAtIFRoaXMgdXNlcyBiaW5hcnkgc2VhcmNoIGFsZ29yaXRobSBmb3IgZmFzdCByZW1vdmFscy5cbiAqXG4gKiBAcGFyYW0gYXJyYXkgQSBzb3J0ZWQgYXJyYXkgdG8gYmluYXJ5IHNlYXJjaC5cbiAqIEBwYXJhbSB2YWx1ZSBUaGUgdmFsdWUgdG8gbG9vayBmb3IuXG4gKiBAcGFyYW0gc2hpZnQgZ3JvdXBpbmcgc2hpZnQuXG4gKiAgIC0gYDBgIG1lYW5zIGxvb2sgYXQgZXZlcnkgbG9jYXRpb25cbiAqICAgLSBgMWAgbWVhbnMgb25seSBsb29rIGF0IGV2ZXJ5IG90aGVyIChldmVuKSBsb2NhdGlvbiAodGhlIG9kZCBsb2NhdGlvbnMgYXJlIHRvIGJlIGlnbm9yZWQgYXNcbiAqICAgICAgICAgdGhleSBhcmUgdmFsdWVzLilcbiAqIEByZXR1cm5zIGluZGV4IG9mIHRoZSB2YWx1ZS5cbiAqICAgLSBwb3NpdGl2ZSBpbmRleCBpZiB2YWx1ZSBmb3VuZC5cbiAqICAgLSBuZWdhdGl2ZSBpbmRleCBpZiB2YWx1ZSBub3QgZm91bmQuIChgfmluZGV4YCB0byBnZXQgdGhlIHZhbHVlIHdoZXJlIGl0IHNob3VsZCBoYXZlIGJlZW5cbiAqIGluc2VydGVkKVxuICovXG5mdW5jdGlvbiBfYXJyYXlJbmRleE9mU29ydGVkKGFycmF5OiBzdHJpbmdbXSwgdmFsdWU6IHN0cmluZywgc2hpZnQ6IG51bWJlcik6IG51bWJlciB7XG4gIG5nRGV2TW9kZSAmJiBhc3NlcnRFcXVhbChBcnJheS5pc0FycmF5KGFycmF5KSwgdHJ1ZSwgJ0V4cGVjdGluZyBhbiBhcnJheScpO1xuICBsZXQgc3RhcnQgPSAwO1xuICBsZXQgZW5kID0gYXJyYXkubGVuZ3RoID4+IHNoaWZ0O1xuICB3aGlsZSAoZW5kICE9PSBzdGFydCkge1xuICAgIGNvbnN0IG1pZGRsZSA9IHN0YXJ0ICsgKChlbmQgLSBzdGFydCkgPj4gMSk7IC8vIGZpbmQgdGhlIG1pZGRsZS5cbiAgICBjb25zdCBjdXJyZW50ID0gYXJyYXlbbWlkZGxlIDw8IHNoaWZ0XTtcbiAgICBpZiAodmFsdWUgPT09IGN1cnJlbnQpIHtcbiAgICAgIHJldHVybiBtaWRkbGUgPDwgc2hpZnQ7XG4gICAgfSBlbHNlIGlmIChjdXJyZW50ID4gdmFsdWUpIHtcbiAgICAgIGVuZCA9IG1pZGRsZTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhcnQgPSBtaWRkbGUgKyAxOyAvLyBXZSBhbHJlYWR5IHNlYXJjaGVkIG1pZGRsZSBzbyBtYWtlIGl0IG5vbi1pbmNsdXNpdmUgYnkgYWRkaW5nIDFcbiAgICB9XG4gIH1cbiAgcmV0dXJuIH4oZW5kIDw8IHNoaWZ0KTtcbn1cbiJdfQ==