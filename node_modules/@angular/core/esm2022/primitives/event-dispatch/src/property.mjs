/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/** All properties that are used by jsaction. */
export const Property = {
    /**
     * The parsed value of the jsaction attribute is stored in this
     * property on the DOM node. The parsed value is an Object. The
     * property names of the object are the events; the values are the
     * names of the actions. This property is attached even on nodes
     * that don't have a jsaction attribute as an optimization, because
     * property lookup is faster than attribute access.
     */
    JSACTION: '__jsaction',
    /**
     * The owner property references an a logical owner for a DOM node. JSAction
     * will follow this reference instead of parentNode when traversing the DOM
     * to find jsaction attributes. This allows overlaying a logical structure
     * over a document where the DOM structure can't reflect that structure.
     */
    OWNER: '__owner',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvcGVydHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3ByaW1pdGl2ZXMvZXZlbnQtZGlzcGF0Y2gvc3JjL3Byb3BlcnR5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILGdEQUFnRDtBQUNoRCxNQUFNLENBQUMsTUFBTSxRQUFRLEdBQUc7SUFDdEI7Ozs7Ozs7T0FPRztJQUNILFFBQVEsRUFBRSxZQUFxQjtJQUMvQjs7Ozs7T0FLRztJQUNILEtBQUssRUFBRSxTQUFrQjtDQUMxQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8qKiBBbGwgcHJvcGVydGllcyB0aGF0IGFyZSB1c2VkIGJ5IGpzYWN0aW9uLiAqL1xuZXhwb3J0IGNvbnN0IFByb3BlcnR5ID0ge1xuICAvKipcbiAgICogVGhlIHBhcnNlZCB2YWx1ZSBvZiB0aGUganNhY3Rpb24gYXR0cmlidXRlIGlzIHN0b3JlZCBpbiB0aGlzXG4gICAqIHByb3BlcnR5IG9uIHRoZSBET00gbm9kZS4gVGhlIHBhcnNlZCB2YWx1ZSBpcyBhbiBPYmplY3QuIFRoZVxuICAgKiBwcm9wZXJ0eSBuYW1lcyBvZiB0aGUgb2JqZWN0IGFyZSB0aGUgZXZlbnRzOyB0aGUgdmFsdWVzIGFyZSB0aGVcbiAgICogbmFtZXMgb2YgdGhlIGFjdGlvbnMuIFRoaXMgcHJvcGVydHkgaXMgYXR0YWNoZWQgZXZlbiBvbiBub2Rlc1xuICAgKiB0aGF0IGRvbid0IGhhdmUgYSBqc2FjdGlvbiBhdHRyaWJ1dGUgYXMgYW4gb3B0aW1pemF0aW9uLCBiZWNhdXNlXG4gICAqIHByb3BlcnR5IGxvb2t1cCBpcyBmYXN0ZXIgdGhhbiBhdHRyaWJ1dGUgYWNjZXNzLlxuICAgKi9cbiAgSlNBQ1RJT046ICdfX2pzYWN0aW9uJyBhcyBjb25zdCxcbiAgLyoqXG4gICAqIFRoZSBvd25lciBwcm9wZXJ0eSByZWZlcmVuY2VzIGFuIGEgbG9naWNhbCBvd25lciBmb3IgYSBET00gbm9kZS4gSlNBY3Rpb25cbiAgICogd2lsbCBmb2xsb3cgdGhpcyByZWZlcmVuY2UgaW5zdGVhZCBvZiBwYXJlbnROb2RlIHdoZW4gdHJhdmVyc2luZyB0aGUgRE9NXG4gICAqIHRvIGZpbmQganNhY3Rpb24gYXR0cmlidXRlcy4gVGhpcyBhbGxvd3Mgb3ZlcmxheWluZyBhIGxvZ2ljYWwgc3RydWN0dXJlXG4gICAqIG92ZXIgYSBkb2N1bWVudCB3aGVyZSB0aGUgRE9NIHN0cnVjdHVyZSBjYW4ndCByZWZsZWN0IHRoYXQgc3RydWN0dXJlLlxuICAgKi9cbiAgT1dORVI6ICdfX293bmVyJyBhcyBjb25zdCxcbn07XG5cbmRlY2xhcmUgZ2xvYmFsIHtcbiAgaW50ZXJmYWNlIE5vZGUge1xuICAgIFtQcm9wZXJ0eS5KU0FDVElPTl0/OiB7W2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkfTtcbiAgICBbUHJvcGVydHkuT1dORVJdPzogUGFyZW50Tm9kZTtcbiAgfVxufVxuIl19