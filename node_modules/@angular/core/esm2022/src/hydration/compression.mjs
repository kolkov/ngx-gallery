/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { REFERENCE_NODE_BODY, REFERENCE_NODE_HOST } from './interfaces';
/**
 * Regexp that extracts a reference node information from the compressed node location.
 * The reference node is represented as either:
 *  - a number which points to an LView slot
 *  - the `b` char which indicates that the lookup should start from the `document.body`
 *  - the `h` char to start lookup from the component host node (`lView[HOST]`)
 */
const REF_EXTRACTOR_REGEXP = new RegExp(`^(\\d+)*(${REFERENCE_NODE_BODY}|${REFERENCE_NODE_HOST})*(.*)`);
/**
 * Helper function that takes a reference node location and a set of navigation steps
 * (from the reference node) to a target node and outputs a string that represents
 * a location.
 *
 * For example, given: referenceNode = 'b' (body) and path = ['firstChild', 'firstChild',
 * 'nextSibling'], the function returns: `bf2n`.
 */
export function compressNodeLocation(referenceNode, path) {
    const result = [referenceNode];
    for (const segment of path) {
        const lastIdx = result.length - 1;
        if (lastIdx > 0 && result[lastIdx - 1] === segment) {
            // An empty string in a count slot represents 1 occurrence of an instruction.
            const value = (result[lastIdx] || 1);
            result[lastIdx] = value + 1;
        }
        else {
            // Adding a new segment to the path.
            // Using an empty string in a counter field to avoid encoding `1`s
            // into the path, since they are implicit (e.g. `f1n1` vs `fn`), so
            // it's enough to have a single char in this case.
            result.push(segment, '');
        }
    }
    return result.join('');
}
/**
 * Helper function that reverts the `compressNodeLocation` and transforms a given
 * string into an array where at 0th position there is a reference node info and
 * after that it contains information (in pairs) about a navigation step and the
 * number of repetitions.
 *
 * For example, the path like 'bf2n' will be transformed to:
 * ['b', 'firstChild', 2, 'nextSibling', 1].
 *
 * This information is later consumed by the code that navigates the DOM to find
 * a given node by its location.
 */
export function decompressNodeLocation(path) {
    const matches = path.match(REF_EXTRACTOR_REGEXP);
    const [_, refNodeId, refNodeName, rest] = matches;
    // If a reference node is represented by an index, transform it to a number.
    const ref = refNodeId ? parseInt(refNodeId, 10) : refNodeName;
    const steps = [];
    // Match all segments in a path.
    for (const [_, step, count] of rest.matchAll(/(f|n)(\d*)/g)) {
        const repeat = parseInt(count, 10) || 1;
        steps.push(step, repeat);
    }
    return [ref, ...steps];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHJlc3Npb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9oeWRyYXRpb24vY29tcHJlc3Npb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFxQixtQkFBbUIsRUFBRSxtQkFBbUIsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUUxRjs7Ozs7O0dBTUc7QUFDSCxNQUFNLG9CQUFvQixHQUFHLElBQUksTUFBTSxDQUNyQyxZQUFZLG1CQUFtQixJQUFJLG1CQUFtQixRQUFRLENBQy9ELENBQUM7QUFFRjs7Ozs7OztHQU9HO0FBQ0gsTUFBTSxVQUFVLG9CQUFvQixDQUFDLGFBQXFCLEVBQUUsSUFBMEI7SUFDcEYsTUFBTSxNQUFNLEdBQTJCLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDdkQsS0FBSyxNQUFNLE9BQU8sSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUMzQixNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNsQyxJQUFJLE9BQU8sR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUMsS0FBSyxPQUFPLEVBQUUsQ0FBQztZQUNuRCw2RUFBNkU7WUFDN0UsTUFBTSxLQUFLLEdBQUcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFXLENBQUM7WUFDL0MsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDLENBQUM7UUFDOUIsQ0FBQzthQUFNLENBQUM7WUFDTixvQ0FBb0M7WUFDcEMsa0VBQWtFO1lBQ2xFLG1FQUFtRTtZQUNuRSxrREFBa0Q7WUFDbEQsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDM0IsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDekIsQ0FBQztBQUVEOzs7Ozs7Ozs7OztHQVdHO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQixDQUNwQyxJQUFZO0lBRVosTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsQ0FBRSxDQUFDO0lBQ2xELE1BQU0sQ0FBQyxDQUFDLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxJQUFJLENBQUMsR0FBRyxPQUFPLENBQUM7SUFDbEQsNEVBQTRFO0lBQzVFLE1BQU0sR0FBRyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDO0lBQzlELE1BQU0sS0FBSyxHQUFvQyxFQUFFLENBQUM7SUFDbEQsZ0NBQWdDO0lBQ2hDLEtBQUssTUFBTSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDO1FBQzVELE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBMEIsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBQ0QsT0FBTyxDQUFDLEdBQUcsRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDO0FBQ3pCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtOb2RlTmF2aWdhdGlvblN0ZXAsIFJFRkVSRU5DRV9OT0RFX0JPRFksIFJFRkVSRU5DRV9OT0RFX0hPU1R9IGZyb20gJy4vaW50ZXJmYWNlcyc7XG5cbi8qKlxuICogUmVnZXhwIHRoYXQgZXh0cmFjdHMgYSByZWZlcmVuY2Ugbm9kZSBpbmZvcm1hdGlvbiBmcm9tIHRoZSBjb21wcmVzc2VkIG5vZGUgbG9jYXRpb24uXG4gKiBUaGUgcmVmZXJlbmNlIG5vZGUgaXMgcmVwcmVzZW50ZWQgYXMgZWl0aGVyOlxuICogIC0gYSBudW1iZXIgd2hpY2ggcG9pbnRzIHRvIGFuIExWaWV3IHNsb3RcbiAqICAtIHRoZSBgYmAgY2hhciB3aGljaCBpbmRpY2F0ZXMgdGhhdCB0aGUgbG9va3VwIHNob3VsZCBzdGFydCBmcm9tIHRoZSBgZG9jdW1lbnQuYm9keWBcbiAqICAtIHRoZSBgaGAgY2hhciB0byBzdGFydCBsb29rdXAgZnJvbSB0aGUgY29tcG9uZW50IGhvc3Qgbm9kZSAoYGxWaWV3W0hPU1RdYClcbiAqL1xuY29uc3QgUkVGX0VYVFJBQ1RPUl9SRUdFWFAgPSBuZXcgUmVnRXhwKFxuICBgXihcXFxcZCspKigke1JFRkVSRU5DRV9OT0RFX0JPRFl9fCR7UkVGRVJFTkNFX05PREVfSE9TVH0pKiguKilgLFxuKTtcblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdGhhdCB0YWtlcyBhIHJlZmVyZW5jZSBub2RlIGxvY2F0aW9uIGFuZCBhIHNldCBvZiBuYXZpZ2F0aW9uIHN0ZXBzXG4gKiAoZnJvbSB0aGUgcmVmZXJlbmNlIG5vZGUpIHRvIGEgdGFyZ2V0IG5vZGUgYW5kIG91dHB1dHMgYSBzdHJpbmcgdGhhdCByZXByZXNlbnRzXG4gKiBhIGxvY2F0aW9uLlxuICpcbiAqIEZvciBleGFtcGxlLCBnaXZlbjogcmVmZXJlbmNlTm9kZSA9ICdiJyAoYm9keSkgYW5kIHBhdGggPSBbJ2ZpcnN0Q2hpbGQnLCAnZmlyc3RDaGlsZCcsXG4gKiAnbmV4dFNpYmxpbmcnXSwgdGhlIGZ1bmN0aW9uIHJldHVybnM6IGBiZjJuYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXByZXNzTm9kZUxvY2F0aW9uKHJlZmVyZW5jZU5vZGU6IHN0cmluZywgcGF0aDogTm9kZU5hdmlnYXRpb25TdGVwW10pOiBzdHJpbmcge1xuICBjb25zdCByZXN1bHQ6IEFycmF5PHN0cmluZyB8IG51bWJlcj4gPSBbcmVmZXJlbmNlTm9kZV07XG4gIGZvciAoY29uc3Qgc2VnbWVudCBvZiBwYXRoKSB7XG4gICAgY29uc3QgbGFzdElkeCA9IHJlc3VsdC5sZW5ndGggLSAxO1xuICAgIGlmIChsYXN0SWR4ID4gMCAmJiByZXN1bHRbbGFzdElkeCAtIDFdID09PSBzZWdtZW50KSB7XG4gICAgICAvLyBBbiBlbXB0eSBzdHJpbmcgaW4gYSBjb3VudCBzbG90IHJlcHJlc2VudHMgMSBvY2N1cnJlbmNlIG9mIGFuIGluc3RydWN0aW9uLlxuICAgICAgY29uc3QgdmFsdWUgPSAocmVzdWx0W2xhc3RJZHhdIHx8IDEpIGFzIG51bWJlcjtcbiAgICAgIHJlc3VsdFtsYXN0SWR4XSA9IHZhbHVlICsgMTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQWRkaW5nIGEgbmV3IHNlZ21lbnQgdG8gdGhlIHBhdGguXG4gICAgICAvLyBVc2luZyBhbiBlbXB0eSBzdHJpbmcgaW4gYSBjb3VudGVyIGZpZWxkIHRvIGF2b2lkIGVuY29kaW5nIGAxYHNcbiAgICAgIC8vIGludG8gdGhlIHBhdGgsIHNpbmNlIHRoZXkgYXJlIGltcGxpY2l0IChlLmcuIGBmMW4xYCB2cyBgZm5gKSwgc29cbiAgICAgIC8vIGl0J3MgZW5vdWdoIHRvIGhhdmUgYSBzaW5nbGUgY2hhciBpbiB0aGlzIGNhc2UuXG4gICAgICByZXN1bHQucHVzaChzZWdtZW50LCAnJyk7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQuam9pbignJyk7XG59XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHRoYXQgcmV2ZXJ0cyB0aGUgYGNvbXByZXNzTm9kZUxvY2F0aW9uYCBhbmQgdHJhbnNmb3JtcyBhIGdpdmVuXG4gKiBzdHJpbmcgaW50byBhbiBhcnJheSB3aGVyZSBhdCAwdGggcG9zaXRpb24gdGhlcmUgaXMgYSByZWZlcmVuY2Ugbm9kZSBpbmZvIGFuZFxuICogYWZ0ZXIgdGhhdCBpdCBjb250YWlucyBpbmZvcm1hdGlvbiAoaW4gcGFpcnMpIGFib3V0IGEgbmF2aWdhdGlvbiBzdGVwIGFuZCB0aGVcbiAqIG51bWJlciBvZiByZXBldGl0aW9ucy5cbiAqXG4gKiBGb3IgZXhhbXBsZSwgdGhlIHBhdGggbGlrZSAnYmYybicgd2lsbCBiZSB0cmFuc2Zvcm1lZCB0bzpcbiAqIFsnYicsICdmaXJzdENoaWxkJywgMiwgJ25leHRTaWJsaW5nJywgMV0uXG4gKlxuICogVGhpcyBpbmZvcm1hdGlvbiBpcyBsYXRlciBjb25zdW1lZCBieSB0aGUgY29kZSB0aGF0IG5hdmlnYXRlcyB0aGUgRE9NIHRvIGZpbmRcbiAqIGEgZ2l2ZW4gbm9kZSBieSBpdHMgbG9jYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWNvbXByZXNzTm9kZUxvY2F0aW9uKFxuICBwYXRoOiBzdHJpbmcsXG4pOiBbc3RyaW5nIHwgbnVtYmVyLCAuLi4obnVtYmVyIHwgTm9kZU5hdmlnYXRpb25TdGVwKVtdXSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBwYXRoLm1hdGNoKFJFRl9FWFRSQUNUT1JfUkVHRVhQKSE7XG4gIGNvbnN0IFtfLCByZWZOb2RlSWQsIHJlZk5vZGVOYW1lLCByZXN0XSA9IG1hdGNoZXM7XG4gIC8vIElmIGEgcmVmZXJlbmNlIG5vZGUgaXMgcmVwcmVzZW50ZWQgYnkgYW4gaW5kZXgsIHRyYW5zZm9ybSBpdCB0byBhIG51bWJlci5cbiAgY29uc3QgcmVmID0gcmVmTm9kZUlkID8gcGFyc2VJbnQocmVmTm9kZUlkLCAxMCkgOiByZWZOb2RlTmFtZTtcbiAgY29uc3Qgc3RlcHM6IChudW1iZXIgfCBOb2RlTmF2aWdhdGlvblN0ZXApW10gPSBbXTtcbiAgLy8gTWF0Y2ggYWxsIHNlZ21lbnRzIGluIGEgcGF0aC5cbiAgZm9yIChjb25zdCBbXywgc3RlcCwgY291bnRdIG9mIHJlc3QubWF0Y2hBbGwoLyhmfG4pKFxcZCopL2cpKSB7XG4gICAgY29uc3QgcmVwZWF0ID0gcGFyc2VJbnQoY291bnQsIDEwKSB8fCAxO1xuICAgIHN0ZXBzLnB1c2goc3RlcCBhcyBOb2RlTmF2aWdhdGlvblN0ZXAsIHJlcGVhdCk7XG4gIH1cbiAgcmV0dXJuIFtyZWYsIC4uLnN0ZXBzXTtcbn1cbiJdfQ==