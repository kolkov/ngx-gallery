/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export function stringify(token) {
    if (typeof token === 'string') {
        return token;
    }
    if (Array.isArray(token)) {
        return '[' + token.map(stringify).join(', ') + ']';
    }
    if (token == null) {
        return '' + token;
    }
    if (token.overriddenName) {
        return `${token.overriddenName}`;
    }
    if (token.name) {
        return `${token.name}`;
    }
    const res = token.toString();
    if (res == null) {
        return '' + res;
    }
    const newLineIndex = res.indexOf('\n');
    return newLineIndex === -1 ? res : res.substring(0, newLineIndex);
}
/**
 * Concatenates two strings with separator, allocating new strings only when necessary.
 *
 * @param before before string.
 * @param separator separator string.
 * @param after after string.
 * @returns concatenated string.
 */
export function concatStringsWithSpace(before, after) {
    return before == null || before === ''
        ? after === null
            ? ''
            : after
        : after == null || after === ''
            ? before
            : before + ' ' + after;
}
/**
 * Ellipses the string in the middle when longer than the max length
 *
 * @param string
 * @param maxLength of the output string
 * @returns ellipsed string with ... in the middle
 */
export function truncateMiddle(str, maxLength = 100) {
    if (!str || maxLength < 1 || str.length <= maxLength)
        return str;
    if (maxLength == 1)
        return str.substring(0, 1) + '...';
    const halfLimit = Math.round(maxLength / 2);
    return str.substring(0, halfLimit) + '...' + str.substring(str.length - halfLimit);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RyaW5naWZ5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvdXRpbC9zdHJpbmdpZnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsTUFBTSxVQUFVLFNBQVMsQ0FBQyxLQUFVO0lBQ2xDLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDOUIsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDekIsT0FBTyxHQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDO0lBQ3JELENBQUM7SUFFRCxJQUFJLEtBQUssSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUNsQixPQUFPLEVBQUUsR0FBRyxLQUFLLENBQUM7SUFDcEIsQ0FBQztJQUVELElBQUksS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ3pCLE9BQU8sR0FBRyxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7SUFDbkMsQ0FBQztJQUVELElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2YsT0FBTyxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUN6QixDQUFDO0lBRUQsTUFBTSxHQUFHLEdBQUcsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBRTdCLElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO1FBQ2hCLE9BQU8sRUFBRSxHQUFHLEdBQUcsQ0FBQztJQUNsQixDQUFDO0lBRUQsTUFBTSxZQUFZLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN2QyxPQUFPLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQztBQUNwRSxDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxNQUFxQixFQUFFLEtBQW9CO0lBQ2hGLE9BQU8sTUFBTSxJQUFJLElBQUksSUFBSSxNQUFNLEtBQUssRUFBRTtRQUNwQyxDQUFDLENBQUMsS0FBSyxLQUFLLElBQUk7WUFDZCxDQUFDLENBQUMsRUFBRTtZQUNKLENBQUMsQ0FBQyxLQUFLO1FBQ1QsQ0FBQyxDQUFDLEtBQUssSUFBSSxJQUFJLElBQUksS0FBSyxLQUFLLEVBQUU7WUFDN0IsQ0FBQyxDQUFDLE1BQU07WUFDUixDQUFDLENBQUMsTUFBTSxHQUFHLEdBQUcsR0FBRyxLQUFLLENBQUM7QUFDN0IsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sVUFBVSxjQUFjLENBQUMsR0FBVyxFQUFFLFNBQVMsR0FBRyxHQUFHO0lBQ3pELElBQUksQ0FBQyxHQUFHLElBQUksU0FBUyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLFNBQVM7UUFBRSxPQUFPLEdBQUcsQ0FBQztJQUNqRSxJQUFJLFNBQVMsSUFBSSxDQUFDO1FBQUUsT0FBTyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUM7SUFFdkQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDNUMsT0FBTyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsR0FBRyxLQUFLLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQyxDQUFDO0FBQ3JGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHN0cmluZ2lmeSh0b2tlbjogYW55KTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiB0b2tlbiA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gdG9rZW47XG4gIH1cblxuICBpZiAoQXJyYXkuaXNBcnJheSh0b2tlbikpIHtcbiAgICByZXR1cm4gJ1snICsgdG9rZW4ubWFwKHN0cmluZ2lmeSkuam9pbignLCAnKSArICddJztcbiAgfVxuXG4gIGlmICh0b2tlbiA9PSBudWxsKSB7XG4gICAgcmV0dXJuICcnICsgdG9rZW47XG4gIH1cblxuICBpZiAodG9rZW4ub3ZlcnJpZGRlbk5hbWUpIHtcbiAgICByZXR1cm4gYCR7dG9rZW4ub3ZlcnJpZGRlbk5hbWV9YDtcbiAgfVxuXG4gIGlmICh0b2tlbi5uYW1lKSB7XG4gICAgcmV0dXJuIGAke3Rva2VuLm5hbWV9YDtcbiAgfVxuXG4gIGNvbnN0IHJlcyA9IHRva2VuLnRvU3RyaW5nKCk7XG5cbiAgaWYgKHJlcyA9PSBudWxsKSB7XG4gICAgcmV0dXJuICcnICsgcmVzO1xuICB9XG5cbiAgY29uc3QgbmV3TGluZUluZGV4ID0gcmVzLmluZGV4T2YoJ1xcbicpO1xuICByZXR1cm4gbmV3TGluZUluZGV4ID09PSAtMSA/IHJlcyA6IHJlcy5zdWJzdHJpbmcoMCwgbmV3TGluZUluZGV4KTtcbn1cblxuLyoqXG4gKiBDb25jYXRlbmF0ZXMgdHdvIHN0cmluZ3Mgd2l0aCBzZXBhcmF0b3IsIGFsbG9jYXRpbmcgbmV3IHN0cmluZ3Mgb25seSB3aGVuIG5lY2Vzc2FyeS5cbiAqXG4gKiBAcGFyYW0gYmVmb3JlIGJlZm9yZSBzdHJpbmcuXG4gKiBAcGFyYW0gc2VwYXJhdG9yIHNlcGFyYXRvciBzdHJpbmcuXG4gKiBAcGFyYW0gYWZ0ZXIgYWZ0ZXIgc3RyaW5nLlxuICogQHJldHVybnMgY29uY2F0ZW5hdGVkIHN0cmluZy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbmNhdFN0cmluZ3NXaXRoU3BhY2UoYmVmb3JlOiBzdHJpbmcgfCBudWxsLCBhZnRlcjogc3RyaW5nIHwgbnVsbCk6IHN0cmluZyB7XG4gIHJldHVybiBiZWZvcmUgPT0gbnVsbCB8fCBiZWZvcmUgPT09ICcnXG4gICAgPyBhZnRlciA9PT0gbnVsbFxuICAgICAgPyAnJ1xuICAgICAgOiBhZnRlclxuICAgIDogYWZ0ZXIgPT0gbnVsbCB8fCBhZnRlciA9PT0gJydcbiAgICAgID8gYmVmb3JlXG4gICAgICA6IGJlZm9yZSArICcgJyArIGFmdGVyO1xufVxuXG4vKipcbiAqIEVsbGlwc2VzIHRoZSBzdHJpbmcgaW4gdGhlIG1pZGRsZSB3aGVuIGxvbmdlciB0aGFuIHRoZSBtYXggbGVuZ3RoXG4gKlxuICogQHBhcmFtIHN0cmluZ1xuICogQHBhcmFtIG1heExlbmd0aCBvZiB0aGUgb3V0cHV0IHN0cmluZ1xuICogQHJldHVybnMgZWxsaXBzZWQgc3RyaW5nIHdpdGggLi4uIGluIHRoZSBtaWRkbGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRydW5jYXRlTWlkZGxlKHN0cjogc3RyaW5nLCBtYXhMZW5ndGggPSAxMDApOiBzdHJpbmcge1xuICBpZiAoIXN0ciB8fCBtYXhMZW5ndGggPCAxIHx8IHN0ci5sZW5ndGggPD0gbWF4TGVuZ3RoKSByZXR1cm4gc3RyO1xuICBpZiAobWF4TGVuZ3RoID09IDEpIHJldHVybiBzdHIuc3Vic3RyaW5nKDAsIDEpICsgJy4uLic7XG5cbiAgY29uc3QgaGFsZkxpbWl0ID0gTWF0aC5yb3VuZChtYXhMZW5ndGggLyAyKTtcbiAgcmV0dXJuIHN0ci5zdWJzdHJpbmcoMCwgaGFsZkxpbWl0KSArICcuLi4nICsgc3RyLnN1YnN0cmluZyhzdHIubGVuZ3RoIC0gaGFsZkxpbWl0KTtcbn1cbiJdfQ==