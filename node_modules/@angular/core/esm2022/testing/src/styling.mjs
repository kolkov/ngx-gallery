/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * Returns element classes in form of a stable (sorted) string.
 *
 * @param element HTML Element.
 * @returns Returns element classes in form of a stable (sorted) string.
 */
export function getSortedClassName(element) {
    const names = Object.keys(getElementClasses(element));
    names.sort();
    return names.join(' ');
}
/**
 * Returns element classes in form of a map.
 *
 * @param element HTML Element.
 * @returns Map of class values.
 */
export function getElementClasses(element) {
    const classes = {};
    if (element.nodeType === Node.ELEMENT_NODE) {
        const classList = element.classList;
        for (let i = 0; i < classList.length; i++) {
            const key = classList[i];
            classes[key] = true;
        }
    }
    return classes;
}
/**
 * Returns element styles in form of a stable (sorted) string.
 *
 * @param element HTML Element.
 * @returns Returns element styles in form of a stable (sorted) string.
 */
export function getSortedStyle(element) {
    const styles = getElementStyles(element);
    const names = Object.keys(styles);
    names.sort();
    let sorted = '';
    names.forEach((key) => {
        const value = styles[key];
        if (value != null && value !== '') {
            if (sorted !== '')
                sorted += ' ';
            sorted += key + ': ' + value + ';';
        }
    });
    return sorted;
}
/**
 * Returns element styles in form of a map.
 *
 * @param element HTML Element.
 * @returns Map of style values.
 */
export function getElementStyles(element) {
    const styles = {};
    if (element.nodeType === Node.ELEMENT_NODE) {
        const style = element.style;
        // reading `style.color` is a work around for a bug in Domino. The issue is that Domino has
        // stale value for `style.length`. It seems that reading a property from the element causes the
        // stale value to be updated. (As of Domino v 2.1.3)
        style.color;
        for (let i = 0; i < style.length; i++) {
            const key = style.item(i);
            const value = style.getPropertyValue(key);
            if (value !== '') {
                styles[key] = value;
            }
        }
    }
    return styles;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3R5bGluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvdGVzdGluZy9zcmMvc3R5bGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSDs7Ozs7R0FLRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FBQyxPQUFnQjtJQUNqRCxNQUFNLEtBQUssR0FBYSxNQUFNLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDaEUsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2IsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3pCLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxPQUFnQjtJQUNoRCxNQUFNLE9BQU8sR0FBMEIsRUFBRSxDQUFDO0lBQzFDLElBQUksT0FBTyxDQUFDLFFBQVEsS0FBSyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDM0MsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQztRQUNwQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQzFDLE1BQU0sR0FBRyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6QixPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQ3RCLENBQUM7SUFDSCxDQUFDO0lBQ0QsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLGNBQWMsQ0FBQyxPQUFnQjtJQUM3QyxNQUFNLE1BQU0sR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN6QyxNQUFNLEtBQUssR0FBYSxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzVDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNiLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNoQixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUU7UUFDcEIsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzFCLElBQUksS0FBSyxJQUFJLElBQUksSUFBSSxLQUFLLEtBQUssRUFBRSxFQUFFLENBQUM7WUFDbEMsSUFBSSxNQUFNLEtBQUssRUFBRTtnQkFBRSxNQUFNLElBQUksR0FBRyxDQUFDO1lBQ2pDLE1BQU0sSUFBSSxHQUFHLEdBQUcsSUFBSSxHQUFHLEtBQUssR0FBRyxHQUFHLENBQUM7UUFDckMsQ0FBQztJQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLGdCQUFnQixDQUFDLE9BQWdCO0lBQy9DLE1BQU0sTUFBTSxHQUE0QixFQUFFLENBQUM7SUFDM0MsSUFBSSxPQUFPLENBQUMsUUFBUSxLQUFLLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUMzQyxNQUFNLEtBQUssR0FBSSxPQUF1QixDQUFDLEtBQUssQ0FBQztRQUM3QywyRkFBMkY7UUFDM0YsK0ZBQStGO1FBQy9GLG9EQUFvRDtRQUNwRCxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQ1osS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUN0QyxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzFCLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUMxQyxJQUFJLEtBQUssS0FBSyxFQUFFLEVBQUUsQ0FBQztnQkFDakIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQztZQUN0QixDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8qKlxuICogUmV0dXJucyBlbGVtZW50IGNsYXNzZXMgaW4gZm9ybSBvZiBhIHN0YWJsZSAoc29ydGVkKSBzdHJpbmcuXG4gKlxuICogQHBhcmFtIGVsZW1lbnQgSFRNTCBFbGVtZW50LlxuICogQHJldHVybnMgUmV0dXJucyBlbGVtZW50IGNsYXNzZXMgaW4gZm9ybSBvZiBhIHN0YWJsZSAoc29ydGVkKSBzdHJpbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRTb3J0ZWRDbGFzc05hbWUoZWxlbWVudDogRWxlbWVudCk6IHN0cmluZyB7XG4gIGNvbnN0IG5hbWVzOiBzdHJpbmdbXSA9IE9iamVjdC5rZXlzKGdldEVsZW1lbnRDbGFzc2VzKGVsZW1lbnQpKTtcbiAgbmFtZXMuc29ydCgpO1xuICByZXR1cm4gbmFtZXMuam9pbignICcpO1xufVxuXG4vKipcbiAqIFJldHVybnMgZWxlbWVudCBjbGFzc2VzIGluIGZvcm0gb2YgYSBtYXAuXG4gKlxuICogQHBhcmFtIGVsZW1lbnQgSFRNTCBFbGVtZW50LlxuICogQHJldHVybnMgTWFwIG9mIGNsYXNzIHZhbHVlcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEVsZW1lbnRDbGFzc2VzKGVsZW1lbnQ6IEVsZW1lbnQpOiB7W2tleTogc3RyaW5nXTogdHJ1ZX0ge1xuICBjb25zdCBjbGFzc2VzOiB7W2tleTogc3RyaW5nXTogdHJ1ZX0gPSB7fTtcbiAgaWYgKGVsZW1lbnQubm9kZVR5cGUgPT09IE5vZGUuRUxFTUVOVF9OT0RFKSB7XG4gICAgY29uc3QgY2xhc3NMaXN0ID0gZWxlbWVudC5jbGFzc0xpc3Q7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjbGFzc0xpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGtleSA9IGNsYXNzTGlzdFtpXTtcbiAgICAgIGNsYXNzZXNba2V5XSA9IHRydWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBjbGFzc2VzO1xufVxuXG4vKipcbiAqIFJldHVybnMgZWxlbWVudCBzdHlsZXMgaW4gZm9ybSBvZiBhIHN0YWJsZSAoc29ydGVkKSBzdHJpbmcuXG4gKlxuICogQHBhcmFtIGVsZW1lbnQgSFRNTCBFbGVtZW50LlxuICogQHJldHVybnMgUmV0dXJucyBlbGVtZW50IHN0eWxlcyBpbiBmb3JtIG9mIGEgc3RhYmxlIChzb3J0ZWQpIHN0cmluZy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFNvcnRlZFN0eWxlKGVsZW1lbnQ6IEVsZW1lbnQpOiBzdHJpbmcge1xuICBjb25zdCBzdHlsZXMgPSBnZXRFbGVtZW50U3R5bGVzKGVsZW1lbnQpO1xuICBjb25zdCBuYW1lczogc3RyaW5nW10gPSBPYmplY3Qua2V5cyhzdHlsZXMpO1xuICBuYW1lcy5zb3J0KCk7XG4gIGxldCBzb3J0ZWQgPSAnJztcbiAgbmFtZXMuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBzdHlsZXNba2V5XTtcbiAgICBpZiAodmFsdWUgIT0gbnVsbCAmJiB2YWx1ZSAhPT0gJycpIHtcbiAgICAgIGlmIChzb3J0ZWQgIT09ICcnKSBzb3J0ZWQgKz0gJyAnO1xuICAgICAgc29ydGVkICs9IGtleSArICc6ICcgKyB2YWx1ZSArICc7JztcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gc29ydGVkO1xufVxuXG4vKipcbiAqIFJldHVybnMgZWxlbWVudCBzdHlsZXMgaW4gZm9ybSBvZiBhIG1hcC5cbiAqXG4gKiBAcGFyYW0gZWxlbWVudCBIVE1MIEVsZW1lbnQuXG4gKiBAcmV0dXJucyBNYXAgb2Ygc3R5bGUgdmFsdWVzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RWxlbWVudFN0eWxlcyhlbGVtZW50OiBFbGVtZW50KToge1trZXk6IHN0cmluZ106IHN0cmluZ30ge1xuICBjb25zdCBzdHlsZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIGlmIChlbGVtZW50Lm5vZGVUeXBlID09PSBOb2RlLkVMRU1FTlRfTk9ERSkge1xuICAgIGNvbnN0IHN0eWxlID0gKGVsZW1lbnQgYXMgSFRNTEVsZW1lbnQpLnN0eWxlO1xuICAgIC8vIHJlYWRpbmcgYHN0eWxlLmNvbG9yYCBpcyBhIHdvcmsgYXJvdW5kIGZvciBhIGJ1ZyBpbiBEb21pbm8uIFRoZSBpc3N1ZSBpcyB0aGF0IERvbWlubyBoYXNcbiAgICAvLyBzdGFsZSB2YWx1ZSBmb3IgYHN0eWxlLmxlbmd0aGAuIEl0IHNlZW1zIHRoYXQgcmVhZGluZyBhIHByb3BlcnR5IGZyb20gdGhlIGVsZW1lbnQgY2F1c2VzIHRoZVxuICAgIC8vIHN0YWxlIHZhbHVlIHRvIGJlIHVwZGF0ZWQuIChBcyBvZiBEb21pbm8gdiAyLjEuMylcbiAgICBzdHlsZS5jb2xvcjtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0eWxlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBrZXkgPSBzdHlsZS5pdGVtKGkpO1xuICAgICAgY29uc3QgdmFsdWUgPSBzdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKGtleSk7XG4gICAgICBpZiAodmFsdWUgIT09ICcnKSB7XG4gICAgICAgIHN0eWxlc1trZXldID0gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBzdHlsZXM7XG59XG4iXX0=