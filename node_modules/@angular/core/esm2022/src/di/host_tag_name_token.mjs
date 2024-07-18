/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { RuntimeError } from '../errors';
import { getCurrentTNode } from '../render3/state';
import { InjectionToken } from './injection_token';
import { InjectFlags } from './interface/injector';
/**
 * A token that can be used to inject the tag name of the host node.
 *
 * @usageNotes
 * ### Injecting a tag name that is known to exist
 * ```typescript
 * @Directive()
 * class MyDir {
 *   tagName: string = inject(HOST_TAG_NAME);
 * }
 * ```
 *
 * ### Optionally injecting a tag name
 * ```typescript
 * @Directive()
 * class MyDir {
 *   tagName: string | null = inject(HOST_TAG_NAME, {optional: true});
 * }
 * ```
 * @publicApi
 */
export const HOST_TAG_NAME = new InjectionToken(ngDevMode ? 'HOST_TAG_NAME' : '');
// HOST_TAG_NAME should be resolved at the current node, similar to e.g. ElementRef,
// so we manually specify __NG_ELEMENT_ID__ here, instead of using a factory.
// tslint:disable-next-line:no-toplevel-property-access
HOST_TAG_NAME.__NG_ELEMENT_ID__ = (flags) => {
    const tNode = getCurrentTNode();
    if (tNode === null) {
        throw new RuntimeError(204 /* RuntimeErrorCode.INVALID_INJECTION_TOKEN */, ngDevMode &&
            'HOST_TAG_NAME can only be injected in directives and components ' +
                'during construction time (in a class constructor or as a class field initializer)');
    }
    if (tNode.type & 2 /* TNodeType.Element */) {
        return tNode.value;
    }
    if (flags & InjectFlags.Optional) {
        return null;
    }
    throw new RuntimeError(204 /* RuntimeErrorCode.INVALID_INJECTION_TOKEN */, ngDevMode &&
        `HOST_TAG_NAME was used on ${getDevModeNodeName(tNode)} which doesn't have an underlying element in the DOM. ` +
            `This is invalid, and so the dependency should be marked as optional.`);
};
function getDevModeNodeName(tNode) {
    if (tNode.type & 8 /* TNodeType.ElementContainer */) {
        return 'an <ng-container>';
    }
    else if (tNode.type & 4 /* TNodeType.Container */) {
        return 'an <ng-template>';
    }
    else if (tNode.type & 128 /* TNodeType.LetDeclaration */) {
        return 'an @let declaration';
    }
    else {
        return 'a node';
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG9zdF90YWdfbmFtZV90b2tlbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2RpL2hvc3RfdGFnX25hbWVfdG9rZW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFlBQVksRUFBbUIsTUFBTSxXQUFXLENBQUM7QUFFekQsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBRWpELE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUNqRCxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFFakQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBb0JHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sYUFBYSxHQUFHLElBQUksY0FBYyxDQUFTLFNBQVMsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUUxRixvRkFBb0Y7QUFDcEYsNkVBQTZFO0FBQzdFLHVEQUF1RDtBQUN0RCxhQUFxQixDQUFDLGlCQUFpQixHQUFHLENBQUMsS0FBa0IsRUFBRSxFQUFFO0lBQ2hFLE1BQU0sS0FBSyxHQUFHLGVBQWUsRUFBRSxDQUFDO0lBQ2hDLElBQUksS0FBSyxLQUFLLElBQUksRUFBRSxDQUFDO1FBQ25CLE1BQU0sSUFBSSxZQUFZLHFEQUVwQixTQUFTO1lBQ1Asa0VBQWtFO2dCQUNoRSxtRkFBbUYsQ0FDeEYsQ0FBQztJQUNKLENBQUM7SUFDRCxJQUFJLEtBQUssQ0FBQyxJQUFJLDRCQUFvQixFQUFFLENBQUM7UUFDbkMsT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDO0lBQ3JCLENBQUM7SUFDRCxJQUFJLEtBQUssR0FBRyxXQUFXLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDakMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0QsTUFBTSxJQUFJLFlBQVkscURBRXBCLFNBQVM7UUFDUCw2QkFBNkIsa0JBQWtCLENBQzdDLEtBQUssQ0FDTix3REFBd0Q7WUFDdkQsc0VBQXNFLENBQzNFLENBQUM7QUFDSixDQUFDLENBQUM7QUFFRixTQUFTLGtCQUFrQixDQUFDLEtBQVk7SUFDdEMsSUFBSSxLQUFLLENBQUMsSUFBSSxxQ0FBNkIsRUFBRSxDQUFDO1FBQzVDLE9BQU8sbUJBQW1CLENBQUM7SUFDN0IsQ0FBQztTQUFNLElBQUksS0FBSyxDQUFDLElBQUksOEJBQXNCLEVBQUUsQ0FBQztRQUM1QyxPQUFPLGtCQUFrQixDQUFDO0lBQzVCLENBQUM7U0FBTSxJQUFJLEtBQUssQ0FBQyxJQUFJLHFDQUEyQixFQUFFLENBQUM7UUFDakQsT0FBTyxxQkFBcUIsQ0FBQztJQUMvQixDQUFDO1NBQU0sQ0FBQztRQUNOLE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7UnVudGltZUVycm9yLCBSdW50aW1lRXJyb3JDb2RlfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IHtUTm9kZSwgVE5vZGVUeXBlfSBmcm9tICcuLi9yZW5kZXIzL2ludGVyZmFjZXMvbm9kZSc7XG5pbXBvcnQge2dldEN1cnJlbnRUTm9kZX0gZnJvbSAnLi4vcmVuZGVyMy9zdGF0ZSc7XG5cbmltcG9ydCB7SW5qZWN0aW9uVG9rZW59IGZyb20gJy4vaW5qZWN0aW9uX3Rva2VuJztcbmltcG9ydCB7SW5qZWN0RmxhZ3N9IGZyb20gJy4vaW50ZXJmYWNlL2luamVjdG9yJztcblxuLyoqXG4gKiBBIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gaW5qZWN0IHRoZSB0YWcgbmFtZSBvZiB0aGUgaG9zdCBub2RlLlxuICpcbiAqIEB1c2FnZU5vdGVzXG4gKiAjIyMgSW5qZWN0aW5nIGEgdGFnIG5hbWUgdGhhdCBpcyBrbm93biB0byBleGlzdFxuICogYGBgdHlwZXNjcmlwdFxuICogQERpcmVjdGl2ZSgpXG4gKiBjbGFzcyBNeURpciB7XG4gKiAgIHRhZ05hbWU6IHN0cmluZyA9IGluamVjdChIT1NUX1RBR19OQU1FKTtcbiAqIH1cbiAqIGBgYFxuICpcbiAqICMjIyBPcHRpb25hbGx5IGluamVjdGluZyBhIHRhZyBuYW1lXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBARGlyZWN0aXZlKClcbiAqIGNsYXNzIE15RGlyIHtcbiAqICAgdGFnTmFtZTogc3RyaW5nIHwgbnVsbCA9IGluamVjdChIT1NUX1RBR19OQU1FLCB7b3B0aW9uYWw6IHRydWV9KTtcbiAqIH1cbiAqIGBgYFxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY29uc3QgSE9TVF9UQUdfTkFNRSA9IG5ldyBJbmplY3Rpb25Ub2tlbjxzdHJpbmc+KG5nRGV2TW9kZSA/ICdIT1NUX1RBR19OQU1FJyA6ICcnKTtcblxuLy8gSE9TVF9UQUdfTkFNRSBzaG91bGQgYmUgcmVzb2x2ZWQgYXQgdGhlIGN1cnJlbnQgbm9kZSwgc2ltaWxhciB0byBlLmcuIEVsZW1lbnRSZWYsXG4vLyBzbyB3ZSBtYW51YWxseSBzcGVjaWZ5IF9fTkdfRUxFTUVOVF9JRF9fIGhlcmUsIGluc3RlYWQgb2YgdXNpbmcgYSBmYWN0b3J5LlxuLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLXRvcGxldmVsLXByb3BlcnR5LWFjY2Vzc1xuKEhPU1RfVEFHX05BTUUgYXMgYW55KS5fX05HX0VMRU1FTlRfSURfXyA9IChmbGFnczogSW5qZWN0RmxhZ3MpID0+IHtcbiAgY29uc3QgdE5vZGUgPSBnZXRDdXJyZW50VE5vZGUoKTtcbiAgaWYgKHROb2RlID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IFJ1bnRpbWVFcnJvcihcbiAgICAgIFJ1bnRpbWVFcnJvckNvZGUuSU5WQUxJRF9JTkpFQ1RJT05fVE9LRU4sXG4gICAgICBuZ0Rldk1vZGUgJiZcbiAgICAgICAgJ0hPU1RfVEFHX05BTUUgY2FuIG9ubHkgYmUgaW5qZWN0ZWQgaW4gZGlyZWN0aXZlcyBhbmQgY29tcG9uZW50cyAnICtcbiAgICAgICAgICAnZHVyaW5nIGNvbnN0cnVjdGlvbiB0aW1lIChpbiBhIGNsYXNzIGNvbnN0cnVjdG9yIG9yIGFzIGEgY2xhc3MgZmllbGQgaW5pdGlhbGl6ZXIpJyxcbiAgICApO1xuICB9XG4gIGlmICh0Tm9kZS50eXBlICYgVE5vZGVUeXBlLkVsZW1lbnQpIHtcbiAgICByZXR1cm4gdE5vZGUudmFsdWU7XG4gIH1cbiAgaWYgKGZsYWdzICYgSW5qZWN0RmxhZ3MuT3B0aW9uYWwpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFxuICAgIFJ1bnRpbWVFcnJvckNvZGUuSU5WQUxJRF9JTkpFQ1RJT05fVE9LRU4sXG4gICAgbmdEZXZNb2RlICYmXG4gICAgICBgSE9TVF9UQUdfTkFNRSB3YXMgdXNlZCBvbiAke2dldERldk1vZGVOb2RlTmFtZShcbiAgICAgICAgdE5vZGUsXG4gICAgICApfSB3aGljaCBkb2Vzbid0IGhhdmUgYW4gdW5kZXJseWluZyBlbGVtZW50IGluIHRoZSBET00uIGAgK1xuICAgICAgICBgVGhpcyBpcyBpbnZhbGlkLCBhbmQgc28gdGhlIGRlcGVuZGVuY3kgc2hvdWxkIGJlIG1hcmtlZCBhcyBvcHRpb25hbC5gLFxuICApO1xufTtcblxuZnVuY3Rpb24gZ2V0RGV2TW9kZU5vZGVOYW1lKHROb2RlOiBUTm9kZSkge1xuICBpZiAodE5vZGUudHlwZSAmIFROb2RlVHlwZS5FbGVtZW50Q29udGFpbmVyKSB7XG4gICAgcmV0dXJuICdhbiA8bmctY29udGFpbmVyPic7XG4gIH0gZWxzZSBpZiAodE5vZGUudHlwZSAmIFROb2RlVHlwZS5Db250YWluZXIpIHtcbiAgICByZXR1cm4gJ2FuIDxuZy10ZW1wbGF0ZT4nO1xuICB9IGVsc2UgaWYgKHROb2RlLnR5cGUgJiBUTm9kZVR5cGUuTGV0RGVjbGFyYXRpb24pIHtcbiAgICByZXR1cm4gJ2FuIEBsZXQgZGVjbGFyYXRpb24nO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiAnYSBub2RlJztcbiAgfVxufVxuIl19