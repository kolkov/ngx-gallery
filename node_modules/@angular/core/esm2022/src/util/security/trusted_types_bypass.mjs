/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * @fileoverview
 * A module to facilitate use of a Trusted Types policy internally within
 * Angular specifically for bypassSecurityTrust* and custom sanitizers. It
 * lazily constructs the Trusted Types policy, providing helper utilities for
 * promoting strings to Trusted Types. When Trusted Types are not available,
 * strings are used as a fallback.
 * @security All use of this module is security-sensitive and should go through
 * security review.
 */
import { global } from '../global';
/**
 * The Trusted Types policy, or null if Trusted Types are not
 * enabled/supported, or undefined if the policy has not been created yet.
 */
let policy;
/**
 * Returns the Trusted Types policy, or null if Trusted Types are not
 * enabled/supported. The first call to this function will create the policy.
 */
function getPolicy() {
    if (policy === undefined) {
        policy = null;
        if (global.trustedTypes) {
            try {
                policy = global.trustedTypes.createPolicy('angular#unsafe-bypass', {
                    createHTML: (s) => s,
                    createScript: (s) => s,
                    createScriptURL: (s) => s,
                });
            }
            catch {
                // trustedTypes.createPolicy throws if called with a name that is
                // already registered, even in report-only mode. Until the API changes,
                // catch the error not to break the applications functionally. In such
                // cases, the code will fall back to using strings.
            }
        }
    }
    return policy;
}
/**
 * Unsafely promote a string to a TrustedHTML, falling back to strings when
 * Trusted Types are not available.
 * @security This is a security-sensitive function; any use of this function
 * must go through security review. In particular, it must be assured that it
 * is only passed strings that come directly from custom sanitizers or the
 * bypassSecurityTrust* functions.
 */
export function trustedHTMLFromStringBypass(html) {
    return getPolicy()?.createHTML(html) || html;
}
/**
 * Unsafely promote a string to a TrustedScript, falling back to strings when
 * Trusted Types are not available.
 * @security This is a security-sensitive function; any use of this function
 * must go through security review. In particular, it must be assured that it
 * is only passed strings that come directly from custom sanitizers or the
 * bypassSecurityTrust* functions.
 */
export function trustedScriptFromStringBypass(script) {
    return getPolicy()?.createScript(script) || script;
}
/**
 * Unsafely promote a string to a TrustedScriptURL, falling back to strings
 * when Trusted Types are not available.
 * @security This is a security-sensitive function; any use of this function
 * must go through security review. In particular, it must be assured that it
 * is only passed strings that come directly from custom sanitizers or the
 * bypassSecurityTrust* functions.
 */
export function trustedScriptURLFromStringBypass(url) {
    return getPolicy()?.createScriptURL(url) || url;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJ1c3RlZF90eXBlc19ieXBhc3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy91dGlsL3NlY3VyaXR5L3RydXN0ZWRfdHlwZXNfYnlwYXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOzs7Ozs7Ozs7R0FTRztBQUVILE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFTakM7OztHQUdHO0FBQ0gsSUFBSSxNQUE0QyxDQUFDO0FBRWpEOzs7R0FHRztBQUNILFNBQVMsU0FBUztJQUNoQixJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUN6QixNQUFNLEdBQUcsSUFBSSxDQUFDO1FBQ2QsSUFBSSxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDeEIsSUFBSSxDQUFDO2dCQUNILE1BQU0sR0FBSSxNQUFNLENBQUMsWUFBeUMsQ0FBQyxZQUFZLENBQ3JFLHVCQUF1QixFQUN2QjtvQkFDRSxVQUFVLEVBQUUsQ0FBQyxDQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQzVCLFlBQVksRUFBRSxDQUFDLENBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDOUIsZUFBZSxFQUFFLENBQUMsQ0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2lCQUNsQyxDQUNGLENBQUM7WUFDSixDQUFDO1lBQUMsTUFBTSxDQUFDO2dCQUNQLGlFQUFpRTtnQkFDakUsdUVBQXVFO2dCQUN2RSxzRUFBc0U7Z0JBQ3RFLG1EQUFtRDtZQUNyRCxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSwyQkFBMkIsQ0FBQyxJQUFZO0lBQ3RELE9BQU8sU0FBUyxFQUFFLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQztBQUMvQyxDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSw2QkFBNkIsQ0FBQyxNQUFjO0lBQzFELE9BQU8sU0FBUyxFQUFFLEVBQUUsWUFBWSxDQUFDLE1BQU0sQ0FBQyxJQUFJLE1BQU0sQ0FBQztBQUNyRCxDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxnQ0FBZ0MsQ0FBQyxHQUFXO0lBQzFELE9BQU8sU0FBUyxFQUFFLEVBQUUsZUFBZSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQztBQUNsRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8qKlxuICogQGZpbGVvdmVydmlld1xuICogQSBtb2R1bGUgdG8gZmFjaWxpdGF0ZSB1c2Ugb2YgYSBUcnVzdGVkIFR5cGVzIHBvbGljeSBpbnRlcm5hbGx5IHdpdGhpblxuICogQW5ndWxhciBzcGVjaWZpY2FsbHkgZm9yIGJ5cGFzc1NlY3VyaXR5VHJ1c3QqIGFuZCBjdXN0b20gc2FuaXRpemVycy4gSXRcbiAqIGxhemlseSBjb25zdHJ1Y3RzIHRoZSBUcnVzdGVkIFR5cGVzIHBvbGljeSwgcHJvdmlkaW5nIGhlbHBlciB1dGlsaXRpZXMgZm9yXG4gKiBwcm9tb3Rpbmcgc3RyaW5ncyB0byBUcnVzdGVkIFR5cGVzLiBXaGVuIFRydXN0ZWQgVHlwZXMgYXJlIG5vdCBhdmFpbGFibGUsXG4gKiBzdHJpbmdzIGFyZSB1c2VkIGFzIGEgZmFsbGJhY2suXG4gKiBAc2VjdXJpdHkgQWxsIHVzZSBvZiB0aGlzIG1vZHVsZSBpcyBzZWN1cml0eS1zZW5zaXRpdmUgYW5kIHNob3VsZCBnbyB0aHJvdWdoXG4gKiBzZWN1cml0eSByZXZpZXcuXG4gKi9cblxuaW1wb3J0IHtnbG9iYWx9IGZyb20gJy4uL2dsb2JhbCc7XG5pbXBvcnQge1xuICBUcnVzdGVkSFRNTCxcbiAgVHJ1c3RlZFNjcmlwdCxcbiAgVHJ1c3RlZFNjcmlwdFVSTCxcbiAgVHJ1c3RlZFR5cGVQb2xpY3ksXG4gIFRydXN0ZWRUeXBlUG9saWN5RmFjdG9yeSxcbn0gZnJvbSAnLi90cnVzdGVkX3R5cGVfZGVmcyc7XG5cbi8qKlxuICogVGhlIFRydXN0ZWQgVHlwZXMgcG9saWN5LCBvciBudWxsIGlmIFRydXN0ZWQgVHlwZXMgYXJlIG5vdFxuICogZW5hYmxlZC9zdXBwb3J0ZWQsIG9yIHVuZGVmaW5lZCBpZiB0aGUgcG9saWN5IGhhcyBub3QgYmVlbiBjcmVhdGVkIHlldC5cbiAqL1xubGV0IHBvbGljeTogVHJ1c3RlZFR5cGVQb2xpY3kgfCBudWxsIHwgdW5kZWZpbmVkO1xuXG4vKipcbiAqIFJldHVybnMgdGhlIFRydXN0ZWQgVHlwZXMgcG9saWN5LCBvciBudWxsIGlmIFRydXN0ZWQgVHlwZXMgYXJlIG5vdFxuICogZW5hYmxlZC9zdXBwb3J0ZWQuIFRoZSBmaXJzdCBjYWxsIHRvIHRoaXMgZnVuY3Rpb24gd2lsbCBjcmVhdGUgdGhlIHBvbGljeS5cbiAqL1xuZnVuY3Rpb24gZ2V0UG9saWN5KCk6IFRydXN0ZWRUeXBlUG9saWN5IHwgbnVsbCB7XG4gIGlmIChwb2xpY3kgPT09IHVuZGVmaW5lZCkge1xuICAgIHBvbGljeSA9IG51bGw7XG4gICAgaWYgKGdsb2JhbC50cnVzdGVkVHlwZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHBvbGljeSA9IChnbG9iYWwudHJ1c3RlZFR5cGVzIGFzIFRydXN0ZWRUeXBlUG9saWN5RmFjdG9yeSkuY3JlYXRlUG9saWN5KFxuICAgICAgICAgICdhbmd1bGFyI3Vuc2FmZS1ieXBhc3MnLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGNyZWF0ZUhUTUw6IChzOiBzdHJpbmcpID0+IHMsXG4gICAgICAgICAgICBjcmVhdGVTY3JpcHQ6IChzOiBzdHJpbmcpID0+IHMsXG4gICAgICAgICAgICBjcmVhdGVTY3JpcHRVUkw6IChzOiBzdHJpbmcpID0+IHMsXG4gICAgICAgICAgfSxcbiAgICAgICAgKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyB0cnVzdGVkVHlwZXMuY3JlYXRlUG9saWN5IHRocm93cyBpZiBjYWxsZWQgd2l0aCBhIG5hbWUgdGhhdCBpc1xuICAgICAgICAvLyBhbHJlYWR5IHJlZ2lzdGVyZWQsIGV2ZW4gaW4gcmVwb3J0LW9ubHkgbW9kZS4gVW50aWwgdGhlIEFQSSBjaGFuZ2VzLFxuICAgICAgICAvLyBjYXRjaCB0aGUgZXJyb3Igbm90IHRvIGJyZWFrIHRoZSBhcHBsaWNhdGlvbnMgZnVuY3Rpb25hbGx5LiBJbiBzdWNoXG4gICAgICAgIC8vIGNhc2VzLCB0aGUgY29kZSB3aWxsIGZhbGwgYmFjayB0byB1c2luZyBzdHJpbmdzLlxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gcG9saWN5O1xufVxuXG4vKipcbiAqIFVuc2FmZWx5IHByb21vdGUgYSBzdHJpbmcgdG8gYSBUcnVzdGVkSFRNTCwgZmFsbGluZyBiYWNrIHRvIHN0cmluZ3Mgd2hlblxuICogVHJ1c3RlZCBUeXBlcyBhcmUgbm90IGF2YWlsYWJsZS5cbiAqIEBzZWN1cml0eSBUaGlzIGlzIGEgc2VjdXJpdHktc2Vuc2l0aXZlIGZ1bmN0aW9uOyBhbnkgdXNlIG9mIHRoaXMgZnVuY3Rpb25cbiAqIG11c3QgZ28gdGhyb3VnaCBzZWN1cml0eSByZXZpZXcuIEluIHBhcnRpY3VsYXIsIGl0IG11c3QgYmUgYXNzdXJlZCB0aGF0IGl0XG4gKiBpcyBvbmx5IHBhc3NlZCBzdHJpbmdzIHRoYXQgY29tZSBkaXJlY3RseSBmcm9tIGN1c3RvbSBzYW5pdGl6ZXJzIG9yIHRoZVxuICogYnlwYXNzU2VjdXJpdHlUcnVzdCogZnVuY3Rpb25zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJ1c3RlZEhUTUxGcm9tU3RyaW5nQnlwYXNzKGh0bWw6IHN0cmluZyk6IFRydXN0ZWRIVE1MIHwgc3RyaW5nIHtcbiAgcmV0dXJuIGdldFBvbGljeSgpPy5jcmVhdGVIVE1MKGh0bWwpIHx8IGh0bWw7XG59XG5cbi8qKlxuICogVW5zYWZlbHkgcHJvbW90ZSBhIHN0cmluZyB0byBhIFRydXN0ZWRTY3JpcHQsIGZhbGxpbmcgYmFjayB0byBzdHJpbmdzIHdoZW5cbiAqIFRydXN0ZWQgVHlwZXMgYXJlIG5vdCBhdmFpbGFibGUuXG4gKiBAc2VjdXJpdHkgVGhpcyBpcyBhIHNlY3VyaXR5LXNlbnNpdGl2ZSBmdW5jdGlvbjsgYW55IHVzZSBvZiB0aGlzIGZ1bmN0aW9uXG4gKiBtdXN0IGdvIHRocm91Z2ggc2VjdXJpdHkgcmV2aWV3LiBJbiBwYXJ0aWN1bGFyLCBpdCBtdXN0IGJlIGFzc3VyZWQgdGhhdCBpdFxuICogaXMgb25seSBwYXNzZWQgc3RyaW5ncyB0aGF0IGNvbWUgZGlyZWN0bHkgZnJvbSBjdXN0b20gc2FuaXRpemVycyBvciB0aGVcbiAqIGJ5cGFzc1NlY3VyaXR5VHJ1c3QqIGZ1bmN0aW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRydXN0ZWRTY3JpcHRGcm9tU3RyaW5nQnlwYXNzKHNjcmlwdDogc3RyaW5nKTogVHJ1c3RlZFNjcmlwdCB8IHN0cmluZyB7XG4gIHJldHVybiBnZXRQb2xpY3koKT8uY3JlYXRlU2NyaXB0KHNjcmlwdCkgfHwgc2NyaXB0O1xufVxuXG4vKipcbiAqIFVuc2FmZWx5IHByb21vdGUgYSBzdHJpbmcgdG8gYSBUcnVzdGVkU2NyaXB0VVJMLCBmYWxsaW5nIGJhY2sgdG8gc3RyaW5nc1xuICogd2hlbiBUcnVzdGVkIFR5cGVzIGFyZSBub3QgYXZhaWxhYmxlLlxuICogQHNlY3VyaXR5IFRoaXMgaXMgYSBzZWN1cml0eS1zZW5zaXRpdmUgZnVuY3Rpb247IGFueSB1c2Ugb2YgdGhpcyBmdW5jdGlvblxuICogbXVzdCBnbyB0aHJvdWdoIHNlY3VyaXR5IHJldmlldy4gSW4gcGFydGljdWxhciwgaXQgbXVzdCBiZSBhc3N1cmVkIHRoYXQgaXRcbiAqIGlzIG9ubHkgcGFzc2VkIHN0cmluZ3MgdGhhdCBjb21lIGRpcmVjdGx5IGZyb20gY3VzdG9tIHNhbml0aXplcnMgb3IgdGhlXG4gKiBieXBhc3NTZWN1cml0eVRydXN0KiBmdW5jdGlvbnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cnVzdGVkU2NyaXB0VVJMRnJvbVN0cmluZ0J5cGFzcyh1cmw6IHN0cmluZyk6IFRydXN0ZWRTY3JpcHRVUkwgfCBzdHJpbmcge1xuICByZXR1cm4gZ2V0UG9saWN5KCk/LmNyZWF0ZVNjcmlwdFVSTCh1cmwpIHx8IHVybDtcbn1cbiJdfQ==