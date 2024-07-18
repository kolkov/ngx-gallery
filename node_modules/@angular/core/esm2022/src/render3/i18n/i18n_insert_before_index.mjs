/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { assertEqual } from '../../util/assert';
import { setI18nHandling } from '../node_manipulation';
import { getInsertInFrontOfRNodeWithI18n, processI18nInsertBefore } from '../node_manipulation_i18n';
/**
 * Add `tNode` to `previousTNodes` list and update relevant `TNode`s in `previousTNodes` list
 * `tNode.insertBeforeIndex`.
 *
 * Things to keep in mind:
 * 1. All i18n text nodes are encoded as `TNodeType.Element` and are created eagerly by the
 *    `ɵɵi18nStart` instruction.
 * 2. All `TNodeType.Placeholder` `TNodes` are elements which will be created later by
 *    `ɵɵelementStart` instruction.
 * 3. `ɵɵelementStart` instruction will create `TNode`s in the ascending `TNode.index` order. (So a
 *    smaller index `TNode` is guaranteed to be created before a larger one)
 *
 * We use the above three invariants to determine `TNode.insertBeforeIndex`.
 *
 * In an ideal world `TNode.insertBeforeIndex` would always be `TNode.next.index`. However,
 * this will not work because `TNode.next.index` may be larger than `TNode.index` which means that
 * the next node is not yet created and therefore we can't insert in front of it.
 *
 * Rule1: `TNode.insertBeforeIndex = null` if `TNode.next === null` (Initial condition, as we don't
 *        know if there will be further `TNode`s inserted after.)
 * Rule2: If `previousTNode` is created after the `tNode` being inserted, then
 *        `previousTNode.insertBeforeNode = tNode.index` (So when a new `tNode` is added we check
 *        previous to see if we can update its `insertBeforeTNode`)
 *
 * See `TNode.insertBeforeIndex` for more context.
 *
 * @param previousTNodes A list of previous TNodes so that we can easily traverse `TNode`s in
 *     reverse order. (If `TNode` would have `previous` this would not be necessary.)
 * @param newTNode A TNode to add to the `previousTNodes` list.
 */
export function addTNodeAndUpdateInsertBeforeIndex(previousTNodes, newTNode) {
    // Start with Rule1
    ngDevMode &&
        assertEqual(newTNode.insertBeforeIndex, null, 'We expect that insertBeforeIndex is not set');
    previousTNodes.push(newTNode);
    if (previousTNodes.length > 1) {
        for (let i = previousTNodes.length - 2; i >= 0; i--) {
            const existingTNode = previousTNodes[i];
            // Text nodes are created eagerly and so they don't need their `indexBeforeIndex` updated.
            // It is safe to ignore them.
            if (!isI18nText(existingTNode)) {
                if (isNewTNodeCreatedBefore(existingTNode, newTNode) &&
                    getInsertBeforeIndex(existingTNode) === null) {
                    // If it was created before us in time, (and it does not yet have `insertBeforeIndex`)
                    // then add the `insertBeforeIndex`.
                    setInsertBeforeIndex(existingTNode, newTNode.index);
                }
            }
        }
    }
}
function isI18nText(tNode) {
    return !(tNode.type & 64 /* TNodeType.Placeholder */);
}
function isNewTNodeCreatedBefore(existingTNode, newTNode) {
    return isI18nText(newTNode) || existingTNode.index > newTNode.index;
}
function getInsertBeforeIndex(tNode) {
    const index = tNode.insertBeforeIndex;
    return Array.isArray(index) ? index[0] : index;
}
function setInsertBeforeIndex(tNode, value) {
    const index = tNode.insertBeforeIndex;
    if (Array.isArray(index)) {
        // Array is stored if we have to insert child nodes. See `TNode.insertBeforeIndex`
        index[0] = value;
    }
    else {
        setI18nHandling(getInsertInFrontOfRNodeWithI18n, processI18nInsertBefore);
        tNode.insertBeforeIndex = value;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bl9pbnNlcnRfYmVmb3JlX2luZGV4LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9pMThuL2kxOG5faW5zZXJ0X2JlZm9yZV9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFOUMsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQ3JELE9BQU8sRUFBQywrQkFBK0IsRUFBRSx1QkFBdUIsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBRW5HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQTZCRztBQUNILE1BQU0sVUFBVSxrQ0FBa0MsQ0FBQyxjQUF1QixFQUFFLFFBQWU7SUFDekYsbUJBQW1CO0lBQ25CLFNBQVM7UUFDUCxXQUFXLENBQUMsUUFBUSxDQUFDLGlCQUFpQixFQUFFLElBQUksRUFBRSw2Q0FBNkMsQ0FBQyxDQUFDO0lBRS9GLGNBQWMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDOUIsSUFBSSxjQUFjLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQzlCLEtBQUssSUFBSSxDQUFDLEdBQUcsY0FBYyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ3BELE1BQU0sYUFBYSxHQUFHLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN4QywwRkFBMEY7WUFDMUYsNkJBQTZCO1lBQzdCLElBQUksQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQztnQkFDL0IsSUFDRSx1QkFBdUIsQ0FBQyxhQUFhLEVBQUUsUUFBUSxDQUFDO29CQUNoRCxvQkFBb0IsQ0FBQyxhQUFhLENBQUMsS0FBSyxJQUFJLEVBQzVDLENBQUM7b0JBQ0Qsc0ZBQXNGO29CQUN0RixvQ0FBb0M7b0JBQ3BDLG9CQUFvQixDQUFDLGFBQWEsRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3RELENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDO0FBRUQsU0FBUyxVQUFVLENBQUMsS0FBWTtJQUM5QixPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxpQ0FBd0IsQ0FBQyxDQUFDO0FBQy9DLENBQUM7QUFFRCxTQUFTLHVCQUF1QixDQUFDLGFBQW9CLEVBQUUsUUFBZTtJQUNwRSxPQUFPLFVBQVUsQ0FBQyxRQUFRLENBQUMsSUFBSSxhQUFhLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUM7QUFDdEUsQ0FBQztBQUVELFNBQVMsb0JBQW9CLENBQUMsS0FBWTtJQUN4QyxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsaUJBQWlCLENBQUM7SUFDdEMsT0FBTyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUNqRCxDQUFDO0FBRUQsU0FBUyxvQkFBb0IsQ0FBQyxLQUFZLEVBQUUsS0FBYTtJQUN2RCxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsaUJBQWlCLENBQUM7SUFDdEMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDekIsa0ZBQWtGO1FBQ2xGLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUM7SUFDbkIsQ0FBQztTQUFNLENBQUM7UUFDTixlQUFlLENBQUMsK0JBQStCLEVBQUUsdUJBQXVCLENBQUMsQ0FBQztRQUMxRSxLQUFLLENBQUMsaUJBQWlCLEdBQUcsS0FBSyxDQUFDO0lBQ2xDLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7YXNzZXJ0RXF1YWx9IGZyb20gJy4uLy4uL3V0aWwvYXNzZXJ0JztcbmltcG9ydCB7VE5vZGUsIFROb2RlVHlwZX0gZnJvbSAnLi4vaW50ZXJmYWNlcy9ub2RlJztcbmltcG9ydCB7c2V0STE4bkhhbmRsaW5nfSBmcm9tICcuLi9ub2RlX21hbmlwdWxhdGlvbic7XG5pbXBvcnQge2dldEluc2VydEluRnJvbnRPZlJOb2RlV2l0aEkxOG4sIHByb2Nlc3NJMThuSW5zZXJ0QmVmb3JlfSBmcm9tICcuLi9ub2RlX21hbmlwdWxhdGlvbl9pMThuJztcblxuLyoqXG4gKiBBZGQgYHROb2RlYCB0byBgcHJldmlvdXNUTm9kZXNgIGxpc3QgYW5kIHVwZGF0ZSByZWxldmFudCBgVE5vZGVgcyBpbiBgcHJldmlvdXNUTm9kZXNgIGxpc3RcbiAqIGB0Tm9kZS5pbnNlcnRCZWZvcmVJbmRleGAuXG4gKlxuICogVGhpbmdzIHRvIGtlZXAgaW4gbWluZDpcbiAqIDEuIEFsbCBpMThuIHRleHQgbm9kZXMgYXJlIGVuY29kZWQgYXMgYFROb2RlVHlwZS5FbGVtZW50YCBhbmQgYXJlIGNyZWF0ZWQgZWFnZXJseSBieSB0aGVcbiAqICAgIGDJtcm1aTE4blN0YXJ0YCBpbnN0cnVjdGlvbi5cbiAqIDIuIEFsbCBgVE5vZGVUeXBlLlBsYWNlaG9sZGVyYCBgVE5vZGVzYCBhcmUgZWxlbWVudHMgd2hpY2ggd2lsbCBiZSBjcmVhdGVkIGxhdGVyIGJ5XG4gKiAgICBgybXJtWVsZW1lbnRTdGFydGAgaW5zdHJ1Y3Rpb24uXG4gKiAzLiBgybXJtWVsZW1lbnRTdGFydGAgaW5zdHJ1Y3Rpb24gd2lsbCBjcmVhdGUgYFROb2RlYHMgaW4gdGhlIGFzY2VuZGluZyBgVE5vZGUuaW5kZXhgIG9yZGVyLiAoU28gYVxuICogICAgc21hbGxlciBpbmRleCBgVE5vZGVgIGlzIGd1YXJhbnRlZWQgdG8gYmUgY3JlYXRlZCBiZWZvcmUgYSBsYXJnZXIgb25lKVxuICpcbiAqIFdlIHVzZSB0aGUgYWJvdmUgdGhyZWUgaW52YXJpYW50cyB0byBkZXRlcm1pbmUgYFROb2RlLmluc2VydEJlZm9yZUluZGV4YC5cbiAqXG4gKiBJbiBhbiBpZGVhbCB3b3JsZCBgVE5vZGUuaW5zZXJ0QmVmb3JlSW5kZXhgIHdvdWxkIGFsd2F5cyBiZSBgVE5vZGUubmV4dC5pbmRleGAuIEhvd2V2ZXIsXG4gKiB0aGlzIHdpbGwgbm90IHdvcmsgYmVjYXVzZSBgVE5vZGUubmV4dC5pbmRleGAgbWF5IGJlIGxhcmdlciB0aGFuIGBUTm9kZS5pbmRleGAgd2hpY2ggbWVhbnMgdGhhdFxuICogdGhlIG5leHQgbm9kZSBpcyBub3QgeWV0IGNyZWF0ZWQgYW5kIHRoZXJlZm9yZSB3ZSBjYW4ndCBpbnNlcnQgaW4gZnJvbnQgb2YgaXQuXG4gKlxuICogUnVsZTE6IGBUTm9kZS5pbnNlcnRCZWZvcmVJbmRleCA9IG51bGxgIGlmIGBUTm9kZS5uZXh0ID09PSBudWxsYCAoSW5pdGlhbCBjb25kaXRpb24sIGFzIHdlIGRvbid0XG4gKiAgICAgICAga25vdyBpZiB0aGVyZSB3aWxsIGJlIGZ1cnRoZXIgYFROb2RlYHMgaW5zZXJ0ZWQgYWZ0ZXIuKVxuICogUnVsZTI6IElmIGBwcmV2aW91c1ROb2RlYCBpcyBjcmVhdGVkIGFmdGVyIHRoZSBgdE5vZGVgIGJlaW5nIGluc2VydGVkLCB0aGVuXG4gKiAgICAgICAgYHByZXZpb3VzVE5vZGUuaW5zZXJ0QmVmb3JlTm9kZSA9IHROb2RlLmluZGV4YCAoU28gd2hlbiBhIG5ldyBgdE5vZGVgIGlzIGFkZGVkIHdlIGNoZWNrXG4gKiAgICAgICAgcHJldmlvdXMgdG8gc2VlIGlmIHdlIGNhbiB1cGRhdGUgaXRzIGBpbnNlcnRCZWZvcmVUTm9kZWApXG4gKlxuICogU2VlIGBUTm9kZS5pbnNlcnRCZWZvcmVJbmRleGAgZm9yIG1vcmUgY29udGV4dC5cbiAqXG4gKiBAcGFyYW0gcHJldmlvdXNUTm9kZXMgQSBsaXN0IG9mIHByZXZpb3VzIFROb2RlcyBzbyB0aGF0IHdlIGNhbiBlYXNpbHkgdHJhdmVyc2UgYFROb2RlYHMgaW5cbiAqICAgICByZXZlcnNlIG9yZGVyLiAoSWYgYFROb2RlYCB3b3VsZCBoYXZlIGBwcmV2aW91c2AgdGhpcyB3b3VsZCBub3QgYmUgbmVjZXNzYXJ5LilcbiAqIEBwYXJhbSBuZXdUTm9kZSBBIFROb2RlIHRvIGFkZCB0byB0aGUgYHByZXZpb3VzVE5vZGVzYCBsaXN0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gYWRkVE5vZGVBbmRVcGRhdGVJbnNlcnRCZWZvcmVJbmRleChwcmV2aW91c1ROb2RlczogVE5vZGVbXSwgbmV3VE5vZGU6IFROb2RlKSB7XG4gIC8vIFN0YXJ0IHdpdGggUnVsZTFcbiAgbmdEZXZNb2RlICYmXG4gICAgYXNzZXJ0RXF1YWwobmV3VE5vZGUuaW5zZXJ0QmVmb3JlSW5kZXgsIG51bGwsICdXZSBleHBlY3QgdGhhdCBpbnNlcnRCZWZvcmVJbmRleCBpcyBub3Qgc2V0Jyk7XG5cbiAgcHJldmlvdXNUTm9kZXMucHVzaChuZXdUTm9kZSk7XG4gIGlmIChwcmV2aW91c1ROb2Rlcy5sZW5ndGggPiAxKSB7XG4gICAgZm9yIChsZXQgaSA9IHByZXZpb3VzVE5vZGVzLmxlbmd0aCAtIDI7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjb25zdCBleGlzdGluZ1ROb2RlID0gcHJldmlvdXNUTm9kZXNbaV07XG4gICAgICAvLyBUZXh0IG5vZGVzIGFyZSBjcmVhdGVkIGVhZ2VybHkgYW5kIHNvIHRoZXkgZG9uJ3QgbmVlZCB0aGVpciBgaW5kZXhCZWZvcmVJbmRleGAgdXBkYXRlZC5cbiAgICAgIC8vIEl0IGlzIHNhZmUgdG8gaWdub3JlIHRoZW0uXG4gICAgICBpZiAoIWlzSTE4blRleHQoZXhpc3RpbmdUTm9kZSkpIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGlzTmV3VE5vZGVDcmVhdGVkQmVmb3JlKGV4aXN0aW5nVE5vZGUsIG5ld1ROb2RlKSAmJlxuICAgICAgICAgIGdldEluc2VydEJlZm9yZUluZGV4KGV4aXN0aW5nVE5vZGUpID09PSBudWxsXG4gICAgICAgICkge1xuICAgICAgICAgIC8vIElmIGl0IHdhcyBjcmVhdGVkIGJlZm9yZSB1cyBpbiB0aW1lLCAoYW5kIGl0IGRvZXMgbm90IHlldCBoYXZlIGBpbnNlcnRCZWZvcmVJbmRleGApXG4gICAgICAgICAgLy8gdGhlbiBhZGQgdGhlIGBpbnNlcnRCZWZvcmVJbmRleGAuXG4gICAgICAgICAgc2V0SW5zZXJ0QmVmb3JlSW5kZXgoZXhpc3RpbmdUTm9kZSwgbmV3VE5vZGUuaW5kZXgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGlzSTE4blRleHQodE5vZGU6IFROb2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiAhKHROb2RlLnR5cGUgJiBUTm9kZVR5cGUuUGxhY2Vob2xkZXIpO1xufVxuXG5mdW5jdGlvbiBpc05ld1ROb2RlQ3JlYXRlZEJlZm9yZShleGlzdGluZ1ROb2RlOiBUTm9kZSwgbmV3VE5vZGU6IFROb2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiBpc0kxOG5UZXh0KG5ld1ROb2RlKSB8fCBleGlzdGluZ1ROb2RlLmluZGV4ID4gbmV3VE5vZGUuaW5kZXg7XG59XG5cbmZ1bmN0aW9uIGdldEluc2VydEJlZm9yZUluZGV4KHROb2RlOiBUTm9kZSk6IG51bWJlciB8IG51bGwge1xuICBjb25zdCBpbmRleCA9IHROb2RlLmluc2VydEJlZm9yZUluZGV4O1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShpbmRleCkgPyBpbmRleFswXSA6IGluZGV4O1xufVxuXG5mdW5jdGlvbiBzZXRJbnNlcnRCZWZvcmVJbmRleCh0Tm9kZTogVE5vZGUsIHZhbHVlOiBudW1iZXIpOiB2b2lkIHtcbiAgY29uc3QgaW5kZXggPSB0Tm9kZS5pbnNlcnRCZWZvcmVJbmRleDtcbiAgaWYgKEFycmF5LmlzQXJyYXkoaW5kZXgpKSB7XG4gICAgLy8gQXJyYXkgaXMgc3RvcmVkIGlmIHdlIGhhdmUgdG8gaW5zZXJ0IGNoaWxkIG5vZGVzLiBTZWUgYFROb2RlLmluc2VydEJlZm9yZUluZGV4YFxuICAgIGluZGV4WzBdID0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgc2V0STE4bkhhbmRsaW5nKGdldEluc2VydEluRnJvbnRPZlJOb2RlV2l0aEkxOG4sIHByb2Nlc3NJMThuSW5zZXJ0QmVmb3JlKTtcbiAgICB0Tm9kZS5pbnNlcnRCZWZvcmVJbmRleCA9IHZhbHVlO1xuICB9XG59XG4iXX0=