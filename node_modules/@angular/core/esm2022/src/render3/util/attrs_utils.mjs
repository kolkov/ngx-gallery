/**
 * Assigns all attribute values to the provided element via the inferred renderer.
 *
 * This function accepts two forms of attribute entries:
 *
 * default: (key, value):
 *  attrs = [key1, value1, key2, value2]
 *
 * namespaced: (NAMESPACE_MARKER, uri, name, value)
 *  attrs = [NAMESPACE_MARKER, uri, name, value, NAMESPACE_MARKER, uri, name, value]
 *
 * The `attrs` array can contain a mix of both the default and namespaced entries.
 * The "default" values are set without a marker, but if the function comes across
 * a marker value then it will attempt to set a namespaced value. If the marker is
 * not of a namespaced value then the function will quit and return the index value
 * where it stopped during the iteration of the attrs array.
 *
 * See [AttributeMarker] to understand what the namespace marker value is.
 *
 * Note that this instruction does not support assigning style and class values to
 * an element. See `elementStart` and `elementHostAttrs` to learn how styling values
 * are applied to an element.
 * @param renderer The renderer to be used
 * @param native The element that the attributes will be assigned to
 * @param attrs The attribute array of values that will be assigned to the element
 * @returns the index value that was last accessed in the attributes array
 */
export function setUpAttributes(renderer, native, attrs) {
    let i = 0;
    while (i < attrs.length) {
        const value = attrs[i];
        if (typeof value === 'number') {
            // only namespaces are supported. Other value types (such as style/class
            // entries) are not supported in this function.
            if (value !== 0 /* AttributeMarker.NamespaceURI */) {
                break;
            }
            // we just landed on the marker value ... therefore
            // we should skip to the next entry
            i++;
            const namespaceURI = attrs[i++];
            const attrName = attrs[i++];
            const attrVal = attrs[i++];
            ngDevMode && ngDevMode.rendererSetAttribute++;
            renderer.setAttribute(native, attrName, attrVal, namespaceURI);
        }
        else {
            // attrName is string;
            const attrName = value;
            const attrVal = attrs[++i];
            // Standard attributes
            ngDevMode && ngDevMode.rendererSetAttribute++;
            if (isAnimationProp(attrName)) {
                renderer.setProperty(native, attrName, attrVal);
            }
            else {
                renderer.setAttribute(native, attrName, attrVal);
            }
            i++;
        }
    }
    // another piece of code may iterate over the same attributes array. Therefore
    // it may be helpful to return the exact spot where the attributes array exited
    // whether by running into an unsupported marker or if all the static values were
    // iterated over.
    return i;
}
/**
 * Test whether the given value is a marker that indicates that the following
 * attribute values in a `TAttributes` array are only the names of attributes,
 * and not name-value pairs.
 * @param marker The attribute marker to test.
 * @returns true if the marker is a "name-only" marker (e.g. `Bindings`, `Template` or `I18n`).
 */
export function isNameOnlyAttributeMarker(marker) {
    return (marker === 3 /* AttributeMarker.Bindings */ ||
        marker === 4 /* AttributeMarker.Template */ ||
        marker === 6 /* AttributeMarker.I18n */);
}
export function isAnimationProp(name) {
    // Perf note: accessing charCodeAt to check for the first character of a string is faster as
    // compared to accessing a character at index 0 (ex. name[0]). The main reason for this is that
    // charCodeAt doesn't allocate memory to return a substring.
    return name.charCodeAt(0) === 64 /* CharCode.AT_SIGN */;
}
/**
 * Merges `src` `TAttributes` into `dst` `TAttributes` removing any duplicates in the process.
 *
 * This merge function keeps the order of attrs same.
 *
 * @param dst Location of where the merged `TAttributes` should end up.
 * @param src `TAttributes` which should be appended to `dst`
 */
export function mergeHostAttrs(dst, src) {
    if (src === null || src.length === 0) {
        // do nothing
    }
    else if (dst === null || dst.length === 0) {
        // We have source, but dst is empty, just make a copy.
        dst = src.slice();
    }
    else {
        let srcMarker = -1 /* AttributeMarker.ImplicitAttributes */;
        for (let i = 0; i < src.length; i++) {
            const item = src[i];
            if (typeof item === 'number') {
                srcMarker = item;
            }
            else {
                if (srcMarker === 0 /* AttributeMarker.NamespaceURI */) {
                    // Case where we need to consume `key1`, `key2`, `value` items.
                }
                else if (srcMarker === -1 /* AttributeMarker.ImplicitAttributes */ ||
                    srcMarker === 2 /* AttributeMarker.Styles */) {
                    // Case where we have to consume `key1` and `value` only.
                    mergeHostAttribute(dst, srcMarker, item, null, src[++i]);
                }
                else {
                    // Case where we have to consume `key1` only.
                    mergeHostAttribute(dst, srcMarker, item, null, null);
                }
            }
        }
    }
    return dst;
}
/**
 * Append `key`/`value` to existing `TAttributes` taking region marker and duplicates into account.
 *
 * @param dst `TAttributes` to append to.
 * @param marker Region where the `key`/`value` should be added.
 * @param key1 Key to add to `TAttributes`
 * @param key2 Key to add to `TAttributes` (in case of `AttributeMarker.NamespaceURI`)
 * @param value Value to add or to overwrite to `TAttributes` Only used if `marker` is not Class.
 */
export function mergeHostAttribute(dst, marker, key1, key2, value) {
    let i = 0;
    // Assume that new markers will be inserted at the end.
    let markerInsertPosition = dst.length;
    // scan until correct type.
    if (marker === -1 /* AttributeMarker.ImplicitAttributes */) {
        markerInsertPosition = -1;
    }
    else {
        while (i < dst.length) {
            const dstValue = dst[i++];
            if (typeof dstValue === 'number') {
                if (dstValue === marker) {
                    markerInsertPosition = -1;
                    break;
                }
                else if (dstValue > marker) {
                    // We need to save this as we want the markers to be inserted in specific order.
                    markerInsertPosition = i - 1;
                    break;
                }
            }
        }
    }
    // search until you find place of insertion
    while (i < dst.length) {
        const item = dst[i];
        if (typeof item === 'number') {
            // since `i` started as the index after the marker, we did not find it if we are at the next
            // marker
            break;
        }
        else if (item === key1) {
            // We already have same token
            if (key2 === null) {
                if (value !== null) {
                    dst[i + 1] = value;
                }
                return;
            }
            else if (key2 === dst[i + 1]) {
                dst[i + 2] = value;
                return;
            }
        }
        // Increment counter.
        i++;
        if (key2 !== null)
            i++;
        if (value !== null)
            i++;
    }
    // insert at location.
    if (markerInsertPosition !== -1) {
        dst.splice(markerInsertPosition, 0, marker);
        i = markerInsertPosition + 1;
    }
    dst.splice(i++, 0, key1);
    if (key2 !== null) {
        dst.splice(i++, 0, key2);
    }
    if (value !== null) {
        dst.splice(i++, 0, value);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXR0cnNfdXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL3V0aWwvYXR0cnNfdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBY0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBMEJHO0FBQ0gsTUFBTSxVQUFVLGVBQWUsQ0FBQyxRQUFrQixFQUFFLE1BQWdCLEVBQUUsS0FBa0I7SUFDdEYsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ1YsT0FBTyxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3hCLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2QixJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzlCLHdFQUF3RTtZQUN4RSwrQ0FBK0M7WUFDL0MsSUFBSSxLQUFLLHlDQUFpQyxFQUFFLENBQUM7Z0JBQzNDLE1BQU07WUFDUixDQUFDO1lBRUQsbURBQW1EO1lBQ25ELG1DQUFtQztZQUNuQyxDQUFDLEVBQUUsQ0FBQztZQUVKLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBVyxDQUFDO1lBQzFDLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBVyxDQUFDO1lBQ3RDLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBVyxDQUFDO1lBQ3JDLFNBQVMsSUFBSSxTQUFTLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztZQUM5QyxRQUFRLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ2pFLENBQUM7YUFBTSxDQUFDO1lBQ04sc0JBQXNCO1lBQ3RCLE1BQU0sUUFBUSxHQUFHLEtBQWUsQ0FBQztZQUNqQyxNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMzQixzQkFBc0I7WUFDdEIsU0FBUyxJQUFJLFNBQVMsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1lBQzlDLElBQUksZUFBZSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7Z0JBQzlCLFFBQVEsQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUNsRCxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sUUFBUSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLE9BQWlCLENBQUMsQ0FBQztZQUM3RCxDQUFDO1lBQ0QsQ0FBQyxFQUFFLENBQUM7UUFDTixDQUFDO0lBQ0gsQ0FBQztJQUVELDhFQUE4RTtJQUM5RSwrRUFBK0U7SUFDL0UsaUZBQWlGO0lBQ2pGLGlCQUFpQjtJQUNqQixPQUFPLENBQUMsQ0FBQztBQUNYLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUseUJBQXlCLENBQUMsTUFBOEM7SUFDdEYsT0FBTyxDQUNMLE1BQU0scUNBQTZCO1FBQ25DLE1BQU0scUNBQTZCO1FBQ25DLE1BQU0saUNBQXlCLENBQ2hDLENBQUM7QUFDSixDQUFDO0FBRUQsTUFBTSxVQUFVLGVBQWUsQ0FBQyxJQUFZO0lBQzFDLDRGQUE0RjtJQUM1RiwrRkFBK0Y7SUFDL0YsNERBQTREO0lBQzVELE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsOEJBQXFCLENBQUM7QUFDakQsQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsY0FBYyxDQUM1QixHQUF1QixFQUN2QixHQUF1QjtJQUV2QixJQUFJLEdBQUcsS0FBSyxJQUFJLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUNyQyxhQUFhO0lBQ2YsQ0FBQztTQUFNLElBQUksR0FBRyxLQUFLLElBQUksSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQzVDLHNEQUFzRDtRQUN0RCxHQUFHLEdBQUcsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3BCLENBQUM7U0FBTSxDQUFDO1FBQ04sSUFBSSxTQUFTLDhDQUFzRCxDQUFDO1FBQ3BFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDcEMsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BCLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFLENBQUM7Z0JBQzdCLFNBQVMsR0FBRyxJQUFJLENBQUM7WUFDbkIsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLElBQUksU0FBUyx5Q0FBaUMsRUFBRSxDQUFDO29CQUMvQywrREFBK0Q7Z0JBQ2pFLENBQUM7cUJBQU0sSUFDTCxTQUFTLGdEQUF1QztvQkFDaEQsU0FBUyxtQ0FBMkIsRUFDcEMsQ0FBQztvQkFDRCx5REFBeUQ7b0JBQ3pELGtCQUFrQixDQUFDLEdBQUcsRUFBRSxTQUFTLEVBQUUsSUFBYyxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQVcsQ0FBQyxDQUFDO2dCQUMvRSxDQUFDO3FCQUFNLENBQUM7b0JBQ04sNkNBQTZDO29CQUM3QyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLElBQWMsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ2pFLENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUM7QUFFRDs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FDaEMsR0FBZ0IsRUFDaEIsTUFBdUIsRUFDdkIsSUFBWSxFQUNaLElBQW1CLEVBQ25CLEtBQW9CO0lBRXBCLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNWLHVEQUF1RDtJQUN2RCxJQUFJLG9CQUFvQixHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUM7SUFDdEMsMkJBQTJCO0lBQzNCLElBQUksTUFBTSxnREFBdUMsRUFBRSxDQUFDO1FBQ2xELG9CQUFvQixHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzVCLENBQUM7U0FBTSxDQUFDO1FBQ04sT0FBTyxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3RCLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzFCLElBQUksT0FBTyxRQUFRLEtBQUssUUFBUSxFQUFFLENBQUM7Z0JBQ2pDLElBQUksUUFBUSxLQUFLLE1BQU0sRUFBRSxDQUFDO29CQUN4QixvQkFBb0IsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDMUIsTUFBTTtnQkFDUixDQUFDO3FCQUFNLElBQUksUUFBUSxHQUFHLE1BQU0sRUFBRSxDQUFDO29CQUM3QixnRkFBZ0Y7b0JBQ2hGLG9CQUFvQixHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQzdCLE1BQU07Z0JBQ1IsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVELDJDQUEyQztJQUMzQyxPQUFPLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDdEIsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BCLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDN0IsNEZBQTRGO1lBQzVGLFNBQVM7WUFDVCxNQUFNO1FBQ1IsQ0FBQzthQUFNLElBQUksSUFBSSxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3pCLDZCQUE2QjtZQUM3QixJQUFJLElBQUksS0FBSyxJQUFJLEVBQUUsQ0FBQztnQkFDbEIsSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFLENBQUM7b0JBQ25CLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDO2dCQUNyQixDQUFDO2dCQUNELE9BQU87WUFDVCxDQUFDO2lCQUFNLElBQUksSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDL0IsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxLQUFNLENBQUM7Z0JBQ3BCLE9BQU87WUFDVCxDQUFDO1FBQ0gsQ0FBQztRQUNELHFCQUFxQjtRQUNyQixDQUFDLEVBQUUsQ0FBQztRQUNKLElBQUksSUFBSSxLQUFLLElBQUk7WUFBRSxDQUFDLEVBQUUsQ0FBQztRQUN2QixJQUFJLEtBQUssS0FBSyxJQUFJO1lBQUUsQ0FBQyxFQUFFLENBQUM7SUFDMUIsQ0FBQztJQUVELHNCQUFzQjtJQUN0QixJQUFJLG9CQUFvQixLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDaEMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxvQkFBb0IsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDNUMsQ0FBQyxHQUFHLG9CQUFvQixHQUFHLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBQ0QsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDekIsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDbEIsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDM0IsQ0FBQztJQUNELElBQUksS0FBSyxLQUFLLElBQUksRUFBRSxDQUFDO1FBQ25CLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzVCLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge0NoYXJDb2RlfSBmcm9tICcuLi8uLi91dGlsL2NoYXJfY29kZSc7XG5pbXBvcnQge0F0dHJpYnV0ZU1hcmtlcn0gZnJvbSAnLi4vaW50ZXJmYWNlcy9hdHRyaWJ1dGVfbWFya2VyJztcbmltcG9ydCB7VEF0dHJpYnV0ZXN9IGZyb20gJy4uL2ludGVyZmFjZXMvbm9kZSc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yfSBmcm9tICcuLi9pbnRlcmZhY2VzL3Byb2plY3Rpb24nO1xuaW1wb3J0IHtSZW5kZXJlcn0gZnJvbSAnLi4vaW50ZXJmYWNlcy9yZW5kZXJlcic7XG5pbXBvcnQge1JFbGVtZW50fSBmcm9tICcuLi9pbnRlcmZhY2VzL3JlbmRlcmVyX2RvbSc7XG5cbi8qKlxuICogQXNzaWducyBhbGwgYXR0cmlidXRlIHZhbHVlcyB0byB0aGUgcHJvdmlkZWQgZWxlbWVudCB2aWEgdGhlIGluZmVycmVkIHJlbmRlcmVyLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gYWNjZXB0cyB0d28gZm9ybXMgb2YgYXR0cmlidXRlIGVudHJpZXM6XG4gKlxuICogZGVmYXVsdDogKGtleSwgdmFsdWUpOlxuICogIGF0dHJzID0gW2tleTEsIHZhbHVlMSwga2V5MiwgdmFsdWUyXVxuICpcbiAqIG5hbWVzcGFjZWQ6IChOQU1FU1BBQ0VfTUFSS0VSLCB1cmksIG5hbWUsIHZhbHVlKVxuICogIGF0dHJzID0gW05BTUVTUEFDRV9NQVJLRVIsIHVyaSwgbmFtZSwgdmFsdWUsIE5BTUVTUEFDRV9NQVJLRVIsIHVyaSwgbmFtZSwgdmFsdWVdXG4gKlxuICogVGhlIGBhdHRyc2AgYXJyYXkgY2FuIGNvbnRhaW4gYSBtaXggb2YgYm90aCB0aGUgZGVmYXVsdCBhbmQgbmFtZXNwYWNlZCBlbnRyaWVzLlxuICogVGhlIFwiZGVmYXVsdFwiIHZhbHVlcyBhcmUgc2V0IHdpdGhvdXQgYSBtYXJrZXIsIGJ1dCBpZiB0aGUgZnVuY3Rpb24gY29tZXMgYWNyb3NzXG4gKiBhIG1hcmtlciB2YWx1ZSB0aGVuIGl0IHdpbGwgYXR0ZW1wdCB0byBzZXQgYSBuYW1lc3BhY2VkIHZhbHVlLiBJZiB0aGUgbWFya2VyIGlzXG4gKiBub3Qgb2YgYSBuYW1lc3BhY2VkIHZhbHVlIHRoZW4gdGhlIGZ1bmN0aW9uIHdpbGwgcXVpdCBhbmQgcmV0dXJuIHRoZSBpbmRleCB2YWx1ZVxuICogd2hlcmUgaXQgc3RvcHBlZCBkdXJpbmcgdGhlIGl0ZXJhdGlvbiBvZiB0aGUgYXR0cnMgYXJyYXkuXG4gKlxuICogU2VlIFtBdHRyaWJ1dGVNYXJrZXJdIHRvIHVuZGVyc3RhbmQgd2hhdCB0aGUgbmFtZXNwYWNlIG1hcmtlciB2YWx1ZSBpcy5cbiAqXG4gKiBOb3RlIHRoYXQgdGhpcyBpbnN0cnVjdGlvbiBkb2VzIG5vdCBzdXBwb3J0IGFzc2lnbmluZyBzdHlsZSBhbmQgY2xhc3MgdmFsdWVzIHRvXG4gKiBhbiBlbGVtZW50LiBTZWUgYGVsZW1lbnRTdGFydGAgYW5kIGBlbGVtZW50SG9zdEF0dHJzYCB0byBsZWFybiBob3cgc3R5bGluZyB2YWx1ZXNcbiAqIGFyZSBhcHBsaWVkIHRvIGFuIGVsZW1lbnQuXG4gKiBAcGFyYW0gcmVuZGVyZXIgVGhlIHJlbmRlcmVyIHRvIGJlIHVzZWRcbiAqIEBwYXJhbSBuYXRpdmUgVGhlIGVsZW1lbnQgdGhhdCB0aGUgYXR0cmlidXRlcyB3aWxsIGJlIGFzc2lnbmVkIHRvXG4gKiBAcGFyYW0gYXR0cnMgVGhlIGF0dHJpYnV0ZSBhcnJheSBvZiB2YWx1ZXMgdGhhdCB3aWxsIGJlIGFzc2lnbmVkIHRvIHRoZSBlbGVtZW50XG4gKiBAcmV0dXJucyB0aGUgaW5kZXggdmFsdWUgdGhhdCB3YXMgbGFzdCBhY2Nlc3NlZCBpbiB0aGUgYXR0cmlidXRlcyBhcnJheVxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0VXBBdHRyaWJ1dGVzKHJlbmRlcmVyOiBSZW5kZXJlciwgbmF0aXZlOiBSRWxlbWVudCwgYXR0cnM6IFRBdHRyaWJ1dGVzKTogbnVtYmVyIHtcbiAgbGV0IGkgPSAwO1xuICB3aGlsZSAoaSA8IGF0dHJzLmxlbmd0aCkge1xuICAgIGNvbnN0IHZhbHVlID0gYXR0cnNbaV07XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgIC8vIG9ubHkgbmFtZXNwYWNlcyBhcmUgc3VwcG9ydGVkLiBPdGhlciB2YWx1ZSB0eXBlcyAoc3VjaCBhcyBzdHlsZS9jbGFzc1xuICAgICAgLy8gZW50cmllcykgYXJlIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBmdW5jdGlvbi5cbiAgICAgIGlmICh2YWx1ZSAhPT0gQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgLy8gd2UganVzdCBsYW5kZWQgb24gdGhlIG1hcmtlciB2YWx1ZSAuLi4gdGhlcmVmb3JlXG4gICAgICAvLyB3ZSBzaG91bGQgc2tpcCB0byB0aGUgbmV4dCBlbnRyeVxuICAgICAgaSsrO1xuXG4gICAgICBjb25zdCBuYW1lc3BhY2VVUkkgPSBhdHRyc1tpKytdIGFzIHN0cmluZztcbiAgICAgIGNvbnN0IGF0dHJOYW1lID0gYXR0cnNbaSsrXSBhcyBzdHJpbmc7XG4gICAgICBjb25zdCBhdHRyVmFsID0gYXR0cnNbaSsrXSBhcyBzdHJpbmc7XG4gICAgICBuZ0Rldk1vZGUgJiYgbmdEZXZNb2RlLnJlbmRlcmVyU2V0QXR0cmlidXRlKys7XG4gICAgICByZW5kZXJlci5zZXRBdHRyaWJ1dGUobmF0aXZlLCBhdHRyTmFtZSwgYXR0clZhbCwgbmFtZXNwYWNlVVJJKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gYXR0ck5hbWUgaXMgc3RyaW5nO1xuICAgICAgY29uc3QgYXR0ck5hbWUgPSB2YWx1ZSBhcyBzdHJpbmc7XG4gICAgICBjb25zdCBhdHRyVmFsID0gYXR0cnNbKytpXTtcbiAgICAgIC8vIFN0YW5kYXJkIGF0dHJpYnV0ZXNcbiAgICAgIG5nRGV2TW9kZSAmJiBuZ0Rldk1vZGUucmVuZGVyZXJTZXRBdHRyaWJ1dGUrKztcbiAgICAgIGlmIChpc0FuaW1hdGlvblByb3AoYXR0ck5hbWUpKSB7XG4gICAgICAgIHJlbmRlcmVyLnNldFByb3BlcnR5KG5hdGl2ZSwgYXR0ck5hbWUsIGF0dHJWYWwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVuZGVyZXIuc2V0QXR0cmlidXRlKG5hdGl2ZSwgYXR0ck5hbWUsIGF0dHJWYWwgYXMgc3RyaW5nKTtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICB9XG4gIH1cblxuICAvLyBhbm90aGVyIHBpZWNlIG9mIGNvZGUgbWF5IGl0ZXJhdGUgb3ZlciB0aGUgc2FtZSBhdHRyaWJ1dGVzIGFycmF5LiBUaGVyZWZvcmVcbiAgLy8gaXQgbWF5IGJlIGhlbHBmdWwgdG8gcmV0dXJuIHRoZSBleGFjdCBzcG90IHdoZXJlIHRoZSBhdHRyaWJ1dGVzIGFycmF5IGV4aXRlZFxuICAvLyB3aGV0aGVyIGJ5IHJ1bm5pbmcgaW50byBhbiB1bnN1cHBvcnRlZCBtYXJrZXIgb3IgaWYgYWxsIHRoZSBzdGF0aWMgdmFsdWVzIHdlcmVcbiAgLy8gaXRlcmF0ZWQgb3Zlci5cbiAgcmV0dXJuIGk7XG59XG5cbi8qKlxuICogVGVzdCB3aGV0aGVyIHRoZSBnaXZlbiB2YWx1ZSBpcyBhIG1hcmtlciB0aGF0IGluZGljYXRlcyB0aGF0IHRoZSBmb2xsb3dpbmdcbiAqIGF0dHJpYnV0ZSB2YWx1ZXMgaW4gYSBgVEF0dHJpYnV0ZXNgIGFycmF5IGFyZSBvbmx5IHRoZSBuYW1lcyBvZiBhdHRyaWJ1dGVzLFxuICogYW5kIG5vdCBuYW1lLXZhbHVlIHBhaXJzLlxuICogQHBhcmFtIG1hcmtlciBUaGUgYXR0cmlidXRlIG1hcmtlciB0byB0ZXN0LlxuICogQHJldHVybnMgdHJ1ZSBpZiB0aGUgbWFya2VyIGlzIGEgXCJuYW1lLW9ubHlcIiBtYXJrZXIgKGUuZy4gYEJpbmRpbmdzYCwgYFRlbXBsYXRlYCBvciBgSTE4bmApLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNOYW1lT25seUF0dHJpYnV0ZU1hcmtlcihtYXJrZXI6IHN0cmluZyB8IEF0dHJpYnV0ZU1hcmtlciB8IENzc1NlbGVjdG9yKSB7XG4gIHJldHVybiAoXG4gICAgbWFya2VyID09PSBBdHRyaWJ1dGVNYXJrZXIuQmluZGluZ3MgfHxcbiAgICBtYXJrZXIgPT09IEF0dHJpYnV0ZU1hcmtlci5UZW1wbGF0ZSB8fFxuICAgIG1hcmtlciA9PT0gQXR0cmlidXRlTWFya2VyLkkxOG5cbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQW5pbWF0aW9uUHJvcChuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgLy8gUGVyZiBub3RlOiBhY2Nlc3NpbmcgY2hhckNvZGVBdCB0byBjaGVjayBmb3IgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiBhIHN0cmluZyBpcyBmYXN0ZXIgYXNcbiAgLy8gY29tcGFyZWQgdG8gYWNjZXNzaW5nIGEgY2hhcmFjdGVyIGF0IGluZGV4IDAgKGV4LiBuYW1lWzBdKS4gVGhlIG1haW4gcmVhc29uIGZvciB0aGlzIGlzIHRoYXRcbiAgLy8gY2hhckNvZGVBdCBkb2Vzbid0IGFsbG9jYXRlIG1lbW9yeSB0byByZXR1cm4gYSBzdWJzdHJpbmcuXG4gIHJldHVybiBuYW1lLmNoYXJDb2RlQXQoMCkgPT09IENoYXJDb2RlLkFUX1NJR047XG59XG5cbi8qKlxuICogTWVyZ2VzIGBzcmNgIGBUQXR0cmlidXRlc2AgaW50byBgZHN0YCBgVEF0dHJpYnV0ZXNgIHJlbW92aW5nIGFueSBkdXBsaWNhdGVzIGluIHRoZSBwcm9jZXNzLlxuICpcbiAqIFRoaXMgbWVyZ2UgZnVuY3Rpb24ga2VlcHMgdGhlIG9yZGVyIG9mIGF0dHJzIHNhbWUuXG4gKlxuICogQHBhcmFtIGRzdCBMb2NhdGlvbiBvZiB3aGVyZSB0aGUgbWVyZ2VkIGBUQXR0cmlidXRlc2Agc2hvdWxkIGVuZCB1cC5cbiAqIEBwYXJhbSBzcmMgYFRBdHRyaWJ1dGVzYCB3aGljaCBzaG91bGQgYmUgYXBwZW5kZWQgdG8gYGRzdGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlSG9zdEF0dHJzKFxuICBkc3Q6IFRBdHRyaWJ1dGVzIHwgbnVsbCxcbiAgc3JjOiBUQXR0cmlidXRlcyB8IG51bGwsXG4pOiBUQXR0cmlidXRlcyB8IG51bGwge1xuICBpZiAoc3JjID09PSBudWxsIHx8IHNyYy5sZW5ndGggPT09IDApIHtcbiAgICAvLyBkbyBub3RoaW5nXG4gIH0gZWxzZSBpZiAoZHN0ID09PSBudWxsIHx8IGRzdC5sZW5ndGggPT09IDApIHtcbiAgICAvLyBXZSBoYXZlIHNvdXJjZSwgYnV0IGRzdCBpcyBlbXB0eSwganVzdCBtYWtlIGEgY29weS5cbiAgICBkc3QgPSBzcmMuc2xpY2UoKTtcbiAgfSBlbHNlIHtcbiAgICBsZXQgc3JjTWFya2VyOiBBdHRyaWJ1dGVNYXJrZXIgPSBBdHRyaWJ1dGVNYXJrZXIuSW1wbGljaXRBdHRyaWJ1dGVzO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3JjLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gc3JjW2ldO1xuICAgICAgaWYgKHR5cGVvZiBpdGVtID09PSAnbnVtYmVyJykge1xuICAgICAgICBzcmNNYXJrZXIgPSBpdGVtO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHNyY01hcmtlciA9PT0gQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSkge1xuICAgICAgICAgIC8vIENhc2Ugd2hlcmUgd2UgbmVlZCB0byBjb25zdW1lIGBrZXkxYCwgYGtleTJgLCBgdmFsdWVgIGl0ZW1zLlxuICAgICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgIHNyY01hcmtlciA9PT0gQXR0cmlidXRlTWFya2VyLkltcGxpY2l0QXR0cmlidXRlcyB8fFxuICAgICAgICAgIHNyY01hcmtlciA9PT0gQXR0cmlidXRlTWFya2VyLlN0eWxlc1xuICAgICAgICApIHtcbiAgICAgICAgICAvLyBDYXNlIHdoZXJlIHdlIGhhdmUgdG8gY29uc3VtZSBga2V5MWAgYW5kIGB2YWx1ZWAgb25seS5cbiAgICAgICAgICBtZXJnZUhvc3RBdHRyaWJ1dGUoZHN0LCBzcmNNYXJrZXIsIGl0ZW0gYXMgc3RyaW5nLCBudWxsLCBzcmNbKytpXSBhcyBzdHJpbmcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIENhc2Ugd2hlcmUgd2UgaGF2ZSB0byBjb25zdW1lIGBrZXkxYCBvbmx5LlxuICAgICAgICAgIG1lcmdlSG9zdEF0dHJpYnV0ZShkc3QsIHNyY01hcmtlciwgaXRlbSBhcyBzdHJpbmcsIG51bGwsIG51bGwpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBkc3Q7XG59XG5cbi8qKlxuICogQXBwZW5kIGBrZXlgL2B2YWx1ZWAgdG8gZXhpc3RpbmcgYFRBdHRyaWJ1dGVzYCB0YWtpbmcgcmVnaW9uIG1hcmtlciBhbmQgZHVwbGljYXRlcyBpbnRvIGFjY291bnQuXG4gKlxuICogQHBhcmFtIGRzdCBgVEF0dHJpYnV0ZXNgIHRvIGFwcGVuZCB0by5cbiAqIEBwYXJhbSBtYXJrZXIgUmVnaW9uIHdoZXJlIHRoZSBga2V5YC9gdmFsdWVgIHNob3VsZCBiZSBhZGRlZC5cbiAqIEBwYXJhbSBrZXkxIEtleSB0byBhZGQgdG8gYFRBdHRyaWJ1dGVzYFxuICogQHBhcmFtIGtleTIgS2V5IHRvIGFkZCB0byBgVEF0dHJpYnV0ZXNgIChpbiBjYXNlIG9mIGBBdHRyaWJ1dGVNYXJrZXIuTmFtZXNwYWNlVVJJYClcbiAqIEBwYXJhbSB2YWx1ZSBWYWx1ZSB0byBhZGQgb3IgdG8gb3ZlcndyaXRlIHRvIGBUQXR0cmlidXRlc2AgT25seSB1c2VkIGlmIGBtYXJrZXJgIGlzIG5vdCBDbGFzcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlSG9zdEF0dHJpYnV0ZShcbiAgZHN0OiBUQXR0cmlidXRlcyxcbiAgbWFya2VyOiBBdHRyaWJ1dGVNYXJrZXIsXG4gIGtleTE6IHN0cmluZyxcbiAga2V5Mjogc3RyaW5nIHwgbnVsbCxcbiAgdmFsdWU6IHN0cmluZyB8IG51bGwsXG4pOiB2b2lkIHtcbiAgbGV0IGkgPSAwO1xuICAvLyBBc3N1bWUgdGhhdCBuZXcgbWFya2VycyB3aWxsIGJlIGluc2VydGVkIGF0IHRoZSBlbmQuXG4gIGxldCBtYXJrZXJJbnNlcnRQb3NpdGlvbiA9IGRzdC5sZW5ndGg7XG4gIC8vIHNjYW4gdW50aWwgY29ycmVjdCB0eXBlLlxuICBpZiAobWFya2VyID09PSBBdHRyaWJ1dGVNYXJrZXIuSW1wbGljaXRBdHRyaWJ1dGVzKSB7XG4gICAgbWFya2VySW5zZXJ0UG9zaXRpb24gPSAtMTtcbiAgfSBlbHNlIHtcbiAgICB3aGlsZSAoaSA8IGRzdC5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGRzdFZhbHVlID0gZHN0W2krK107XG4gICAgICBpZiAodHlwZW9mIGRzdFZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgICBpZiAoZHN0VmFsdWUgPT09IG1hcmtlcikge1xuICAgICAgICAgIG1hcmtlckluc2VydFBvc2l0aW9uID0gLTE7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gZWxzZSBpZiAoZHN0VmFsdWUgPiBtYXJrZXIpIHtcbiAgICAgICAgICAvLyBXZSBuZWVkIHRvIHNhdmUgdGhpcyBhcyB3ZSB3YW50IHRoZSBtYXJrZXJzIHRvIGJlIGluc2VydGVkIGluIHNwZWNpZmljIG9yZGVyLlxuICAgICAgICAgIG1hcmtlckluc2VydFBvc2l0aW9uID0gaSAtIDE7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBzZWFyY2ggdW50aWwgeW91IGZpbmQgcGxhY2Ugb2YgaW5zZXJ0aW9uXG4gIHdoaWxlIChpIDwgZHN0Lmxlbmd0aCkge1xuICAgIGNvbnN0IGl0ZW0gPSBkc3RbaV07XG4gICAgaWYgKHR5cGVvZiBpdGVtID09PSAnbnVtYmVyJykge1xuICAgICAgLy8gc2luY2UgYGlgIHN0YXJ0ZWQgYXMgdGhlIGluZGV4IGFmdGVyIHRoZSBtYXJrZXIsIHdlIGRpZCBub3QgZmluZCBpdCBpZiB3ZSBhcmUgYXQgdGhlIG5leHRcbiAgICAgIC8vIG1hcmtlclxuICAgICAgYnJlYWs7XG4gICAgfSBlbHNlIGlmIChpdGVtID09PSBrZXkxKSB7XG4gICAgICAvLyBXZSBhbHJlYWR5IGhhdmUgc2FtZSB0b2tlblxuICAgICAgaWYgKGtleTIgPT09IG51bGwpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgZHN0W2kgKyAxXSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAoa2V5MiA9PT0gZHN0W2kgKyAxXSkge1xuICAgICAgICBkc3RbaSArIDJdID0gdmFsdWUhO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIC8vIEluY3JlbWVudCBjb3VudGVyLlxuICAgIGkrKztcbiAgICBpZiAoa2V5MiAhPT0gbnVsbCkgaSsrO1xuICAgIGlmICh2YWx1ZSAhPT0gbnVsbCkgaSsrO1xuICB9XG5cbiAgLy8gaW5zZXJ0IGF0IGxvY2F0aW9uLlxuICBpZiAobWFya2VySW5zZXJ0UG9zaXRpb24gIT09IC0xKSB7XG4gICAgZHN0LnNwbGljZShtYXJrZXJJbnNlcnRQb3NpdGlvbiwgMCwgbWFya2VyKTtcbiAgICBpID0gbWFya2VySW5zZXJ0UG9zaXRpb24gKyAxO1xuICB9XG4gIGRzdC5zcGxpY2UoaSsrLCAwLCBrZXkxKTtcbiAgaWYgKGtleTIgIT09IG51bGwpIHtcbiAgICBkc3Quc3BsaWNlKGkrKywgMCwga2V5Mik7XG4gIH1cbiAgaWYgKHZhbHVlICE9PSBudWxsKSB7XG4gICAgZHN0LnNwbGljZShpKyssIDAsIHZhbHVlKTtcbiAgfVxufVxuIl19