/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { RuntimeError } from '../errors';
import { getTemplateLocationDetails } from '../render3/instructions/element_validation';
import { RENDERER } from '../render3/interfaces/view';
import { nativeRemoveNode } from '../render3/node_manipulation';
import { getLView, getSelectedTNode } from '../render3/state';
import { getNativeByTNode } from '../render3/util/view_utils';
import { trustedHTMLFromString } from '../util/security/trusted_types';
/**
 * Validation function invoked at runtime for each binding that might potentially
 * represent a security-sensitive attribute of an <iframe>.
 * See `IFRAME_SECURITY_SENSITIVE_ATTRS` in the
 * `packages/compiler/src/schema/dom_security_schema.ts` script for the full list
 * of such attributes.
 *
 * @codeGenApi
 */
export function ɵɵvalidateIframeAttribute(attrValue, tagName, attrName) {
    const lView = getLView();
    const tNode = getSelectedTNode();
    const element = getNativeByTNode(tNode, lView);
    // Restrict any dynamic bindings of security-sensitive attributes/properties
    // on an <iframe> for security reasons.
    if (tNode.type === 2 /* TNodeType.Element */ && tagName.toLowerCase() === 'iframe') {
        const iframe = element;
        // Unset previously applied `src` and `srcdoc` if we come across a situation when
        // a security-sensitive attribute is set later via an attribute/property binding.
        iframe.src = '';
        iframe.srcdoc = trustedHTMLFromString('');
        // Also remove the <iframe> from the document.
        nativeRemoveNode(lView[RENDERER], iframe);
        const errorMessage = ngDevMode &&
            `Angular has detected that the \`${attrName}\` was applied ` +
                `as a binding to an <iframe>${getTemplateLocationDetails(lView)}. ` +
                `For security reasons, the \`${attrName}\` can be set on an <iframe> ` +
                `as a static attribute only. \n` +
                `To fix this, switch the \`${attrName}\` binding to a static attribute ` +
                `in a template or in host bindings section.`;
        throw new RuntimeError(-910 /* RuntimeErrorCode.UNSAFE_IFRAME_ATTRS */, errorMessage);
    }
    return attrValue;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWZyYW1lX2F0dHJzX3ZhbGlkYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9zYW5pdGl6YXRpb24vaWZyYW1lX2F0dHJzX3ZhbGlkYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFlBQVksRUFBbUIsTUFBTSxXQUFXLENBQUM7QUFDekQsT0FBTyxFQUFDLDBCQUEwQixFQUFDLE1BQU0sNENBQTRDLENBQUM7QUFHdEYsT0FBTyxFQUFDLFFBQVEsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ3BELE9BQU8sRUFBQyxnQkFBZ0IsRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBQzlELE9BQU8sRUFBQyxRQUFRLEVBQUUsZ0JBQWdCLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUM1RCxPQUFPLEVBQUMsZ0JBQWdCLEVBQUMsTUFBTSw0QkFBNEIsQ0FBQztBQUM1RCxPQUFPLEVBQUMscUJBQXFCLEVBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVyRTs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sVUFBVSx5QkFBeUIsQ0FBQyxTQUFjLEVBQUUsT0FBZSxFQUFFLFFBQWdCO0lBQ3pGLE1BQU0sS0FBSyxHQUFHLFFBQVEsRUFBRSxDQUFDO0lBQ3pCLE1BQU0sS0FBSyxHQUFHLGdCQUFnQixFQUFHLENBQUM7SUFDbEMsTUFBTSxPQUFPLEdBQUcsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBd0IsQ0FBQztJQUV0RSw0RUFBNEU7SUFDNUUsdUNBQXVDO0lBQ3ZDLElBQUksS0FBSyxDQUFDLElBQUksOEJBQXNCLElBQUksT0FBTyxDQUFDLFdBQVcsRUFBRSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzNFLE1BQU0sTUFBTSxHQUFHLE9BQTRCLENBQUM7UUFFNUMsaUZBQWlGO1FBQ2pGLGlGQUFpRjtRQUNqRixNQUFNLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQztRQUNoQixNQUFNLENBQUMsTUFBTSxHQUFHLHFCQUFxQixDQUFDLEVBQUUsQ0FBc0IsQ0FBQztRQUUvRCw4Q0FBOEM7UUFDOUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRTFDLE1BQU0sWUFBWSxHQUNoQixTQUFTO1lBQ1QsbUNBQW1DLFFBQVEsaUJBQWlCO2dCQUMxRCw4QkFBOEIsMEJBQTBCLENBQUMsS0FBSyxDQUFDLElBQUk7Z0JBQ25FLCtCQUErQixRQUFRLCtCQUErQjtnQkFDdEUsZ0NBQWdDO2dCQUNoQyw2QkFBNkIsUUFBUSxtQ0FBbUM7Z0JBQ3hFLDRDQUE0QyxDQUFDO1FBQ2pELE1BQU0sSUFBSSxZQUFZLGtEQUF1QyxZQUFZLENBQUMsQ0FBQztJQUM3RSxDQUFDO0lBQ0QsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1J1bnRpbWVFcnJvciwgUnVudGltZUVycm9yQ29kZX0gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCB7Z2V0VGVtcGxhdGVMb2NhdGlvbkRldGFpbHN9IGZyb20gJy4uL3JlbmRlcjMvaW5zdHJ1Y3Rpb25zL2VsZW1lbnRfdmFsaWRhdGlvbic7XG5pbXBvcnQge1ROb2RlVHlwZX0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL25vZGUnO1xuaW1wb3J0IHtSQ29tbWVudCwgUkVsZW1lbnR9IGZyb20gJy4uL3JlbmRlcjMvaW50ZXJmYWNlcy9yZW5kZXJlcl9kb20nO1xuaW1wb3J0IHtSRU5ERVJFUn0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL3ZpZXcnO1xuaW1wb3J0IHtuYXRpdmVSZW1vdmVOb2RlfSBmcm9tICcuLi9yZW5kZXIzL25vZGVfbWFuaXB1bGF0aW9uJztcbmltcG9ydCB7Z2V0TFZpZXcsIGdldFNlbGVjdGVkVE5vZGV9IGZyb20gJy4uL3JlbmRlcjMvc3RhdGUnO1xuaW1wb3J0IHtnZXROYXRpdmVCeVROb2RlfSBmcm9tICcuLi9yZW5kZXIzL3V0aWwvdmlld191dGlscyc7XG5pbXBvcnQge3RydXN0ZWRIVE1MRnJvbVN0cmluZ30gZnJvbSAnLi4vdXRpbC9zZWN1cml0eS90cnVzdGVkX3R5cGVzJztcblxuLyoqXG4gKiBWYWxpZGF0aW9uIGZ1bmN0aW9uIGludm9rZWQgYXQgcnVudGltZSBmb3IgZWFjaCBiaW5kaW5nIHRoYXQgbWlnaHQgcG90ZW50aWFsbHlcbiAqIHJlcHJlc2VudCBhIHNlY3VyaXR5LXNlbnNpdGl2ZSBhdHRyaWJ1dGUgb2YgYW4gPGlmcmFtZT4uXG4gKiBTZWUgYElGUkFNRV9TRUNVUklUWV9TRU5TSVRJVkVfQVRUUlNgIGluIHRoZVxuICogYHBhY2thZ2VzL2NvbXBpbGVyL3NyYy9zY2hlbWEvZG9tX3NlY3VyaXR5X3NjaGVtYS50c2Agc2NyaXB0IGZvciB0aGUgZnVsbCBsaXN0XG4gKiBvZiBzdWNoIGF0dHJpYnV0ZXMuXG4gKlxuICogQGNvZGVHZW5BcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIMm1ybV2YWxpZGF0ZUlmcmFtZUF0dHJpYnV0ZShhdHRyVmFsdWU6IGFueSwgdGFnTmFtZTogc3RyaW5nLCBhdHRyTmFtZTogc3RyaW5nKSB7XG4gIGNvbnN0IGxWaWV3ID0gZ2V0TFZpZXcoKTtcbiAgY29uc3QgdE5vZGUgPSBnZXRTZWxlY3RlZFROb2RlKCkhO1xuICBjb25zdCBlbGVtZW50ID0gZ2V0TmF0aXZlQnlUTm9kZSh0Tm9kZSwgbFZpZXcpIGFzIFJFbGVtZW50IHwgUkNvbW1lbnQ7XG5cbiAgLy8gUmVzdHJpY3QgYW55IGR5bmFtaWMgYmluZGluZ3Mgb2Ygc2VjdXJpdHktc2Vuc2l0aXZlIGF0dHJpYnV0ZXMvcHJvcGVydGllc1xuICAvLyBvbiBhbiA8aWZyYW1lPiBmb3Igc2VjdXJpdHkgcmVhc29ucy5cbiAgaWYgKHROb2RlLnR5cGUgPT09IFROb2RlVHlwZS5FbGVtZW50ICYmIHRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2lmcmFtZScpIHtcbiAgICBjb25zdCBpZnJhbWUgPSBlbGVtZW50IGFzIEhUTUxJRnJhbWVFbGVtZW50O1xuXG4gICAgLy8gVW5zZXQgcHJldmlvdXNseSBhcHBsaWVkIGBzcmNgIGFuZCBgc3JjZG9jYCBpZiB3ZSBjb21lIGFjcm9zcyBhIHNpdHVhdGlvbiB3aGVuXG4gICAgLy8gYSBzZWN1cml0eS1zZW5zaXRpdmUgYXR0cmlidXRlIGlzIHNldCBsYXRlciB2aWEgYW4gYXR0cmlidXRlL3Byb3BlcnR5IGJpbmRpbmcuXG4gICAgaWZyYW1lLnNyYyA9ICcnO1xuICAgIGlmcmFtZS5zcmNkb2MgPSB0cnVzdGVkSFRNTEZyb21TdHJpbmcoJycpIGFzIHVua25vd24gYXMgc3RyaW5nO1xuXG4gICAgLy8gQWxzbyByZW1vdmUgdGhlIDxpZnJhbWU+IGZyb20gdGhlIGRvY3VtZW50LlxuICAgIG5hdGl2ZVJlbW92ZU5vZGUobFZpZXdbUkVOREVSRVJdLCBpZnJhbWUpO1xuXG4gICAgY29uc3QgZXJyb3JNZXNzYWdlID1cbiAgICAgIG5nRGV2TW9kZSAmJlxuICAgICAgYEFuZ3VsYXIgaGFzIGRldGVjdGVkIHRoYXQgdGhlIFxcYCR7YXR0ck5hbWV9XFxgIHdhcyBhcHBsaWVkIGAgK1xuICAgICAgICBgYXMgYSBiaW5kaW5nIHRvIGFuIDxpZnJhbWU+JHtnZXRUZW1wbGF0ZUxvY2F0aW9uRGV0YWlscyhsVmlldyl9LiBgICtcbiAgICAgICAgYEZvciBzZWN1cml0eSByZWFzb25zLCB0aGUgXFxgJHthdHRyTmFtZX1cXGAgY2FuIGJlIHNldCBvbiBhbiA8aWZyYW1lPiBgICtcbiAgICAgICAgYGFzIGEgc3RhdGljIGF0dHJpYnV0ZSBvbmx5LiBcXG5gICtcbiAgICAgICAgYFRvIGZpeCB0aGlzLCBzd2l0Y2ggdGhlIFxcYCR7YXR0ck5hbWV9XFxgIGJpbmRpbmcgdG8gYSBzdGF0aWMgYXR0cmlidXRlIGAgK1xuICAgICAgICBgaW4gYSB0ZW1wbGF0ZSBvciBpbiBob3N0IGJpbmRpbmdzIHNlY3Rpb24uYDtcbiAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFJ1bnRpbWVFcnJvckNvZGUuVU5TQUZFX0lGUkFNRV9BVFRSUywgZXJyb3JNZXNzYWdlKTtcbiAgfVxuICByZXR1cm4gYXR0clZhbHVlO1xufVxuIl19