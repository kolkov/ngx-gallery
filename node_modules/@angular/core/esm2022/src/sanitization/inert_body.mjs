/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { trustedHTMLFromString } from '../util/security/trusted_types';
/**
 * This helper is used to get hold of an inert tree of DOM elements containing dirty HTML
 * that needs sanitizing.
 * Depending upon browser support we use one of two strategies for doing this.
 * Default: DOMParser strategy
 * Fallback: InertDocument strategy
 */
export function getInertBodyHelper(defaultDoc) {
    const inertDocumentHelper = new InertDocumentHelper(defaultDoc);
    return isDOMParserAvailable() ? new DOMParserHelper(inertDocumentHelper) : inertDocumentHelper;
}
/**
 * Uses DOMParser to create and fill an inert body element.
 * This is the default strategy used in browsers that support it.
 */
class DOMParserHelper {
    constructor(inertDocumentHelper) {
        this.inertDocumentHelper = inertDocumentHelper;
    }
    getInertBodyElement(html) {
        // We add these extra elements to ensure that the rest of the content is parsed as expected
        // e.g. leading whitespace is maintained and tags like `<meta>` do not get hoisted to the
        // `<head>` tag. Note that the `<body>` tag is closed implicitly to prevent unclosed tags
        // in `html` from consuming the otherwise explicit `</body>` tag.
        html = '<body><remove></remove>' + html;
        try {
            const body = new window.DOMParser().parseFromString(trustedHTMLFromString(html), 'text/html').body;
            if (body === null) {
                // In some browsers (e.g. Mozilla/5.0 iPad AppleWebKit Mobile) the `body` property only
                // becomes available in the following tick of the JS engine. In that case we fall back to
                // the `inertDocumentHelper` instead.
                return this.inertDocumentHelper.getInertBodyElement(html);
            }
            body.removeChild(body.firstChild);
            return body;
        }
        catch {
            return null;
        }
    }
}
/**
 * Use an HTML5 `template` element to create and fill an inert DOM element.
 * This is the fallback strategy if the browser does not support DOMParser.
 */
class InertDocumentHelper {
    constructor(defaultDoc) {
        this.defaultDoc = defaultDoc;
        this.inertDocument = this.defaultDoc.implementation.createHTMLDocument('sanitization-inert');
    }
    getInertBodyElement(html) {
        const templateEl = this.inertDocument.createElement('template');
        templateEl.innerHTML = trustedHTMLFromString(html);
        return templateEl;
    }
}
/**
 * We need to determine whether the DOMParser exists in the global context and
 * supports parsing HTML; HTML parsing support is not as wide as other formats, see
 * https://developer.mozilla.org/en-US/docs/Web/API/DOMParser#Browser_compatibility.
 *
 * @suppress {uselessCode}
 */
export function isDOMParserAvailable() {
    try {
        return !!new window.DOMParser().parseFromString(trustedHTMLFromString(''), 'text/html');
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5lcnRfYm9keS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL3Nhbml0aXphdGlvbi9pbmVydF9ib2R5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBRXJFOzs7Ozs7R0FNRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FBQyxVQUFvQjtJQUNyRCxNQUFNLG1CQUFtQixHQUFHLElBQUksbUJBQW1CLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDaEUsT0FBTyxvQkFBb0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQztBQUNqRyxDQUFDO0FBU0Q7OztHQUdHO0FBQ0gsTUFBTSxlQUFlO0lBQ25CLFlBQW9CLG1CQUFvQztRQUFwQyx3QkFBbUIsR0FBbkIsbUJBQW1CLENBQWlCO0lBQUcsQ0FBQztJQUU1RCxtQkFBbUIsQ0FBQyxJQUFZO1FBQzlCLDJGQUEyRjtRQUMzRix5RkFBeUY7UUFDekYseUZBQXlGO1FBQ3pGLGlFQUFpRTtRQUNqRSxJQUFJLEdBQUcseUJBQXlCLEdBQUcsSUFBSSxDQUFDO1FBQ3hDLElBQUksQ0FBQztZQUNILE1BQU0sSUFBSSxHQUFHLElBQUksTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDLGVBQWUsQ0FDakQscUJBQXFCLENBQUMsSUFBSSxDQUFXLEVBQ3JDLFdBQVcsQ0FDWixDQUFDLElBQXVCLENBQUM7WUFDMUIsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQ2xCLHVGQUF1RjtnQkFDdkYseUZBQXlGO2dCQUN6RixxQ0FBcUM7Z0JBQ3JDLE9BQU8sSUFBSSxDQUFDLG1CQUFtQixDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzVELENBQUM7WUFDRCxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFXLENBQUMsQ0FBQztZQUNuQyxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFBQyxNQUFNLENBQUM7WUFDUCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLG1CQUFtQjtJQUd2QixZQUFvQixVQUFvQjtRQUFwQixlQUFVLEdBQVYsVUFBVSxDQUFVO1FBQ3RDLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsa0JBQWtCLENBQUMsb0JBQW9CLENBQUMsQ0FBQztJQUMvRixDQUFDO0lBRUQsbUJBQW1CLENBQUMsSUFBWTtRQUM5QixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoRSxVQUFVLENBQUMsU0FBUyxHQUFHLHFCQUFxQixDQUFDLElBQUksQ0FBVyxDQUFDO1FBQzdELE9BQU8sVUFBVSxDQUFDO0lBQ3BCLENBQUM7Q0FDRjtBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sVUFBVSxvQkFBb0I7SUFDbEMsSUFBSSxDQUFDO1FBQ0gsT0FBTyxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUMsZUFBZSxDQUM3QyxxQkFBcUIsQ0FBQyxFQUFFLENBQVcsRUFDbkMsV0FBVyxDQUNaLENBQUM7SUFDSixDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1AsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge3RydXN0ZWRIVE1MRnJvbVN0cmluZ30gZnJvbSAnLi4vdXRpbC9zZWN1cml0eS90cnVzdGVkX3R5cGVzJztcblxuLyoqXG4gKiBUaGlzIGhlbHBlciBpcyB1c2VkIHRvIGdldCBob2xkIG9mIGFuIGluZXJ0IHRyZWUgb2YgRE9NIGVsZW1lbnRzIGNvbnRhaW5pbmcgZGlydHkgSFRNTFxuICogdGhhdCBuZWVkcyBzYW5pdGl6aW5nLlxuICogRGVwZW5kaW5nIHVwb24gYnJvd3NlciBzdXBwb3J0IHdlIHVzZSBvbmUgb2YgdHdvIHN0cmF0ZWdpZXMgZm9yIGRvaW5nIHRoaXMuXG4gKiBEZWZhdWx0OiBET01QYXJzZXIgc3RyYXRlZ3lcbiAqIEZhbGxiYWNrOiBJbmVydERvY3VtZW50IHN0cmF0ZWd5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbmVydEJvZHlIZWxwZXIoZGVmYXVsdERvYzogRG9jdW1lbnQpOiBJbmVydEJvZHlIZWxwZXIge1xuICBjb25zdCBpbmVydERvY3VtZW50SGVscGVyID0gbmV3IEluZXJ0RG9jdW1lbnRIZWxwZXIoZGVmYXVsdERvYyk7XG4gIHJldHVybiBpc0RPTVBhcnNlckF2YWlsYWJsZSgpID8gbmV3IERPTVBhcnNlckhlbHBlcihpbmVydERvY3VtZW50SGVscGVyKSA6IGluZXJ0RG9jdW1lbnRIZWxwZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5lcnRCb2R5SGVscGVyIHtcbiAgLyoqXG4gICAqIEdldCBhbiBpbmVydCBET00gZWxlbWVudCBjb250YWluaW5nIERPTSBjcmVhdGVkIGZyb20gdGhlIGRpcnR5IEhUTUwgc3RyaW5nIHByb3ZpZGVkLlxuICAgKi9cbiAgZ2V0SW5lcnRCb2R5RWxlbWVudDogKGh0bWw6IHN0cmluZykgPT4gSFRNTEVsZW1lbnQgfCBudWxsO1xufVxuXG4vKipcbiAqIFVzZXMgRE9NUGFyc2VyIHRvIGNyZWF0ZSBhbmQgZmlsbCBhbiBpbmVydCBib2R5IGVsZW1lbnQuXG4gKiBUaGlzIGlzIHRoZSBkZWZhdWx0IHN0cmF0ZWd5IHVzZWQgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IGl0LlxuICovXG5jbGFzcyBET01QYXJzZXJIZWxwZXIgaW1wbGVtZW50cyBJbmVydEJvZHlIZWxwZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGluZXJ0RG9jdW1lbnRIZWxwZXI6IEluZXJ0Qm9keUhlbHBlcikge31cblxuICBnZXRJbmVydEJvZHlFbGVtZW50KGh0bWw6IHN0cmluZyk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gICAgLy8gV2UgYWRkIHRoZXNlIGV4dHJhIGVsZW1lbnRzIHRvIGVuc3VyZSB0aGF0IHRoZSByZXN0IG9mIHRoZSBjb250ZW50IGlzIHBhcnNlZCBhcyBleHBlY3RlZFxuICAgIC8vIGUuZy4gbGVhZGluZyB3aGl0ZXNwYWNlIGlzIG1haW50YWluZWQgYW5kIHRhZ3MgbGlrZSBgPG1ldGE+YCBkbyBub3QgZ2V0IGhvaXN0ZWQgdG8gdGhlXG4gICAgLy8gYDxoZWFkPmAgdGFnLiBOb3RlIHRoYXQgdGhlIGA8Ym9keT5gIHRhZyBpcyBjbG9zZWQgaW1wbGljaXRseSB0byBwcmV2ZW50IHVuY2xvc2VkIHRhZ3NcbiAgICAvLyBpbiBgaHRtbGAgZnJvbSBjb25zdW1pbmcgdGhlIG90aGVyd2lzZSBleHBsaWNpdCBgPC9ib2R5PmAgdGFnLlxuICAgIGh0bWwgPSAnPGJvZHk+PHJlbW92ZT48L3JlbW92ZT4nICsgaHRtbDtcbiAgICB0cnkge1xuICAgICAgY29uc3QgYm9keSA9IG5ldyB3aW5kb3cuRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKFxuICAgICAgICB0cnVzdGVkSFRNTEZyb21TdHJpbmcoaHRtbCkgYXMgc3RyaW5nLFxuICAgICAgICAndGV4dC9odG1sJyxcbiAgICAgICkuYm9keSBhcyBIVE1MQm9keUVsZW1lbnQ7XG4gICAgICBpZiAoYm9keSA9PT0gbnVsbCkge1xuICAgICAgICAvLyBJbiBzb21lIGJyb3dzZXJzIChlLmcuIE1vemlsbGEvNS4wIGlQYWQgQXBwbGVXZWJLaXQgTW9iaWxlKSB0aGUgYGJvZHlgIHByb3BlcnR5IG9ubHlcbiAgICAgICAgLy8gYmVjb21lcyBhdmFpbGFibGUgaW4gdGhlIGZvbGxvd2luZyB0aWNrIG9mIHRoZSBKUyBlbmdpbmUuIEluIHRoYXQgY2FzZSB3ZSBmYWxsIGJhY2sgdG9cbiAgICAgICAgLy8gdGhlIGBpbmVydERvY3VtZW50SGVscGVyYCBpbnN0ZWFkLlxuICAgICAgICByZXR1cm4gdGhpcy5pbmVydERvY3VtZW50SGVscGVyLmdldEluZXJ0Qm9keUVsZW1lbnQoaHRtbCk7XG4gICAgICB9XG4gICAgICBib2R5LnJlbW92ZUNoaWxkKGJvZHkuZmlyc3RDaGlsZCEpO1xuICAgICAgcmV0dXJuIGJvZHk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBVc2UgYW4gSFRNTDUgYHRlbXBsYXRlYCBlbGVtZW50IHRvIGNyZWF0ZSBhbmQgZmlsbCBhbiBpbmVydCBET00gZWxlbWVudC5cbiAqIFRoaXMgaXMgdGhlIGZhbGxiYWNrIHN0cmF0ZWd5IGlmIHRoZSBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgRE9NUGFyc2VyLlxuICovXG5jbGFzcyBJbmVydERvY3VtZW50SGVscGVyIGltcGxlbWVudHMgSW5lcnRCb2R5SGVscGVyIHtcbiAgcHJpdmF0ZSBpbmVydERvY3VtZW50OiBEb2N1bWVudDtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGRlZmF1bHREb2M6IERvY3VtZW50KSB7XG4gICAgdGhpcy5pbmVydERvY3VtZW50ID0gdGhpcy5kZWZhdWx0RG9jLmltcGxlbWVudGF0aW9uLmNyZWF0ZUhUTUxEb2N1bWVudCgnc2FuaXRpemF0aW9uLWluZXJ0Jyk7XG4gIH1cblxuICBnZXRJbmVydEJvZHlFbGVtZW50KGh0bWw6IHN0cmluZyk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gICAgY29uc3QgdGVtcGxhdGVFbCA9IHRoaXMuaW5lcnREb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZW1wbGF0ZScpO1xuICAgIHRlbXBsYXRlRWwuaW5uZXJIVE1MID0gdHJ1c3RlZEhUTUxGcm9tU3RyaW5nKGh0bWwpIGFzIHN0cmluZztcbiAgICByZXR1cm4gdGVtcGxhdGVFbDtcbiAgfVxufVxuXG4vKipcbiAqIFdlIG5lZWQgdG8gZGV0ZXJtaW5lIHdoZXRoZXIgdGhlIERPTVBhcnNlciBleGlzdHMgaW4gdGhlIGdsb2JhbCBjb250ZXh0IGFuZFxuICogc3VwcG9ydHMgcGFyc2luZyBIVE1MOyBIVE1MIHBhcnNpbmcgc3VwcG9ydCBpcyBub3QgYXMgd2lkZSBhcyBvdGhlciBmb3JtYXRzLCBzZWVcbiAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9ET01QYXJzZXIjQnJvd3Nlcl9jb21wYXRpYmlsaXR5LlxuICpcbiAqIEBzdXBwcmVzcyB7dXNlbGVzc0NvZGV9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0RPTVBhcnNlckF2YWlsYWJsZSgpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gISFuZXcgd2luZG93LkRPTVBhcnNlcigpLnBhcnNlRnJvbVN0cmluZyhcbiAgICAgIHRydXN0ZWRIVE1MRnJvbVN0cmluZygnJykgYXMgc3RyaW5nLFxuICAgICAgJ3RleHQvaHRtbCcsXG4gICAgKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG4iXX0=