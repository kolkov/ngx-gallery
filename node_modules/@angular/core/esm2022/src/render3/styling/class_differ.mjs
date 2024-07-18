/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { assertNotEqual } from '../../util/assert';
/**
 * Returns an index of `classToSearch` in `className` taking token boundaries into account.
 *
 * `classIndexOf('AB A', 'A', 0)` will be 3 (not 0 since `AB!==A`)
 *
 * @param className A string containing classes (whitespace separated)
 * @param classToSearch A class name to locate
 * @param startingIndex Starting location of search
 * @returns an index of the located class (or -1 if not found)
 */
export function classIndexOf(className, classToSearch, startingIndex) {
    ngDevMode && assertNotEqual(classToSearch, '', 'can not look for "" string.');
    let end = className.length;
    while (true) {
        const foundIndex = className.indexOf(classToSearch, startingIndex);
        if (foundIndex === -1)
            return foundIndex;
        if (foundIndex === 0 || className.charCodeAt(foundIndex - 1) <= 32 /* CharCode.SPACE */) {
            // Ensure that it has leading whitespace
            const length = classToSearch.length;
            if (foundIndex + length === end ||
                className.charCodeAt(foundIndex + length) <= 32 /* CharCode.SPACE */) {
                // Ensure that it has trailing whitespace
                return foundIndex;
            }
        }
        // False positive, keep searching from where we left off.
        startingIndex = foundIndex + 1;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xhc3NfZGlmZmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9zdHlsaW5nL2NsYXNzX2RpZmZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFHakQ7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBTSxVQUFVLFlBQVksQ0FDMUIsU0FBaUIsRUFDakIsYUFBcUIsRUFDckIsYUFBcUI7SUFFckIsU0FBUyxJQUFJLGNBQWMsQ0FBQyxhQUFhLEVBQUUsRUFBRSxFQUFFLDZCQUE2QixDQUFDLENBQUM7SUFDOUUsSUFBSSxHQUFHLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQztJQUMzQixPQUFPLElBQUksRUFBRSxDQUFDO1FBQ1osTUFBTSxVQUFVLEdBQUcsU0FBUyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDbkUsSUFBSSxVQUFVLEtBQUssQ0FBQyxDQUFDO1lBQUUsT0FBTyxVQUFVLENBQUM7UUFDekMsSUFBSSxVQUFVLEtBQUssQ0FBQyxJQUFJLFNBQVMsQ0FBQyxVQUFVLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQywyQkFBa0IsRUFBRSxDQUFDO1lBQy9FLHdDQUF3QztZQUN4QyxNQUFNLE1BQU0sR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDO1lBQ3BDLElBQ0UsVUFBVSxHQUFHLE1BQU0sS0FBSyxHQUFHO2dCQUMzQixTQUFTLENBQUMsVUFBVSxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsMkJBQWtCLEVBQzNELENBQUM7Z0JBQ0QseUNBQXlDO2dCQUN6QyxPQUFPLFVBQVUsQ0FBQztZQUNwQixDQUFDO1FBQ0gsQ0FBQztRQUNELHlEQUF5RDtRQUN6RCxhQUFhLEdBQUcsVUFBVSxHQUFHLENBQUMsQ0FBQztJQUNqQyxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2Fzc2VydE5vdEVxdWFsfSBmcm9tICcuLi8uLi91dGlsL2Fzc2VydCc7XG5pbXBvcnQge0NoYXJDb2RlfSBmcm9tICcuLi8uLi91dGlsL2NoYXJfY29kZSc7XG5cbi8qKlxuICogUmV0dXJucyBhbiBpbmRleCBvZiBgY2xhc3NUb1NlYXJjaGAgaW4gYGNsYXNzTmFtZWAgdGFraW5nIHRva2VuIGJvdW5kYXJpZXMgaW50byBhY2NvdW50LlxuICpcbiAqIGBjbGFzc0luZGV4T2YoJ0FCIEEnLCAnQScsIDApYCB3aWxsIGJlIDMgKG5vdCAwIHNpbmNlIGBBQiE9PUFgKVxuICpcbiAqIEBwYXJhbSBjbGFzc05hbWUgQSBzdHJpbmcgY29udGFpbmluZyBjbGFzc2VzICh3aGl0ZXNwYWNlIHNlcGFyYXRlZClcbiAqIEBwYXJhbSBjbGFzc1RvU2VhcmNoIEEgY2xhc3MgbmFtZSB0byBsb2NhdGVcbiAqIEBwYXJhbSBzdGFydGluZ0luZGV4IFN0YXJ0aW5nIGxvY2F0aW9uIG9mIHNlYXJjaFxuICogQHJldHVybnMgYW4gaW5kZXggb2YgdGhlIGxvY2F0ZWQgY2xhc3MgKG9yIC0xIGlmIG5vdCBmb3VuZClcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsYXNzSW5kZXhPZihcbiAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gIGNsYXNzVG9TZWFyY2g6IHN0cmluZyxcbiAgc3RhcnRpbmdJbmRleDogbnVtYmVyLFxuKTogbnVtYmVyIHtcbiAgbmdEZXZNb2RlICYmIGFzc2VydE5vdEVxdWFsKGNsYXNzVG9TZWFyY2gsICcnLCAnY2FuIG5vdCBsb29rIGZvciBcIlwiIHN0cmluZy4nKTtcbiAgbGV0IGVuZCA9IGNsYXNzTmFtZS5sZW5ndGg7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgZm91bmRJbmRleCA9IGNsYXNzTmFtZS5pbmRleE9mKGNsYXNzVG9TZWFyY2gsIHN0YXJ0aW5nSW5kZXgpO1xuICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSkgcmV0dXJuIGZvdW5kSW5kZXg7XG4gICAgaWYgKGZvdW5kSW5kZXggPT09IDAgfHwgY2xhc3NOYW1lLmNoYXJDb2RlQXQoZm91bmRJbmRleCAtIDEpIDw9IENoYXJDb2RlLlNQQUNFKSB7XG4gICAgICAvLyBFbnN1cmUgdGhhdCBpdCBoYXMgbGVhZGluZyB3aGl0ZXNwYWNlXG4gICAgICBjb25zdCBsZW5ndGggPSBjbGFzc1RvU2VhcmNoLmxlbmd0aDtcbiAgICAgIGlmIChcbiAgICAgICAgZm91bmRJbmRleCArIGxlbmd0aCA9PT0gZW5kIHx8XG4gICAgICAgIGNsYXNzTmFtZS5jaGFyQ29kZUF0KGZvdW5kSW5kZXggKyBsZW5ndGgpIDw9IENoYXJDb2RlLlNQQUNFXG4gICAgICApIHtcbiAgICAgICAgLy8gRW5zdXJlIHRoYXQgaXQgaGFzIHRyYWlsaW5nIHdoaXRlc3BhY2VcbiAgICAgICAgcmV0dXJuIGZvdW5kSW5kZXg7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIEZhbHNlIHBvc2l0aXZlLCBrZWVwIHNlYXJjaGluZyBmcm9tIHdoZXJlIHdlIGxlZnQgb2ZmLlxuICAgIHN0YXJ0aW5nSW5kZXggPSBmb3VuZEluZGV4ICsgMTtcbiAgfVxufVxuIl19