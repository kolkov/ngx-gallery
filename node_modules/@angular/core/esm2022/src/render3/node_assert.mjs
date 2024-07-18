/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { assertDefined, throwError } from '../util/assert';
import { toTNodeTypeAsString } from './interfaces/node';
export function assertTNodeType(tNode, expectedTypes, message) {
    assertDefined(tNode, 'should be called with a TNode');
    if ((tNode.type & expectedTypes) === 0) {
        throwError(message ||
            `Expected [${toTNodeTypeAsString(expectedTypes)}] but got ${toTNodeTypeAsString(tNode.type)}.`);
    }
}
export function assertPureTNodeType(type) {
    if (!(type === 2 /* TNodeType.Element */ ||
        type === 1 /* TNodeType.Text */ ||
        type === 4 /* TNodeType.Container */ ||
        type === 8 /* TNodeType.ElementContainer */ ||
        type === 32 /* TNodeType.Icu */ ||
        type === 16 /* TNodeType.Projection */ ||
        type === 64 /* TNodeType.Placeholder */ ||
        type === 128 /* TNodeType.LetDeclaration */)) {
        throwError(`Expected TNodeType to have only a single type selected, but got ${toTNodeTypeAsString(type)}.`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZV9hc3NlcnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL25vZGVfYXNzZXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxhQUFhLEVBQUUsVUFBVSxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDekQsT0FBTyxFQUFtQixtQkFBbUIsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRXhFLE1BQU0sVUFBVSxlQUFlLENBQzdCLEtBQW1CLEVBQ25CLGFBQXdCLEVBQ3hCLE9BQWdCO0lBRWhCLGFBQWEsQ0FBQyxLQUFLLEVBQUUsK0JBQStCLENBQUMsQ0FBQztJQUN0RCxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxhQUFhLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUN2QyxVQUFVLENBQ1IsT0FBTztZQUNMLGFBQWEsbUJBQW1CLENBQUMsYUFBYSxDQUFDLGFBQWEsbUJBQW1CLENBQzdFLEtBQUssQ0FBQyxJQUFJLENBQ1gsR0FBRyxDQUNQLENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQztBQUVELE1BQU0sVUFBVSxtQkFBbUIsQ0FBQyxJQUFlO0lBQ2pELElBQ0UsQ0FBQyxDQUNDLElBQUksOEJBQXNCO1FBQzFCLElBQUksMkJBQW1CO1FBQ3ZCLElBQUksZ0NBQXdCO1FBQzVCLElBQUksdUNBQStCO1FBQ25DLElBQUksMkJBQWtCO1FBQ3RCLElBQUksa0NBQXlCO1FBQzdCLElBQUksbUNBQTBCO1FBQzlCLElBQUksdUNBQTZCLENBQ2xDLEVBQ0QsQ0FBQztRQUNELFVBQVUsQ0FDUixtRUFBbUUsbUJBQW1CLENBQ3BGLElBQUksQ0FDTCxHQUFHLENBQ0wsQ0FBQztJQUNKLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7YXNzZXJ0RGVmaW5lZCwgdGhyb3dFcnJvcn0gZnJvbSAnLi4vdXRpbC9hc3NlcnQnO1xuaW1wb3J0IHtUTm9kZSwgVE5vZGVUeXBlLCB0b1ROb2RlVHlwZUFzU3RyaW5nfSBmcm9tICcuL2ludGVyZmFjZXMvbm9kZSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRUTm9kZVR5cGUoXG4gIHROb2RlOiBUTm9kZSB8IG51bGwsXG4gIGV4cGVjdGVkVHlwZXM6IFROb2RlVHlwZSxcbiAgbWVzc2FnZT86IHN0cmluZyxcbik6IHZvaWQge1xuICBhc3NlcnREZWZpbmVkKHROb2RlLCAnc2hvdWxkIGJlIGNhbGxlZCB3aXRoIGEgVE5vZGUnKTtcbiAgaWYgKCh0Tm9kZS50eXBlICYgZXhwZWN0ZWRUeXBlcykgPT09IDApIHtcbiAgICB0aHJvd0Vycm9yKFxuICAgICAgbWVzc2FnZSB8fFxuICAgICAgICBgRXhwZWN0ZWQgWyR7dG9UTm9kZVR5cGVBc1N0cmluZyhleHBlY3RlZFR5cGVzKX1dIGJ1dCBnb3QgJHt0b1ROb2RlVHlwZUFzU3RyaW5nKFxuICAgICAgICAgIHROb2RlLnR5cGUsXG4gICAgICAgICl9LmAsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0UHVyZVROb2RlVHlwZSh0eXBlOiBUTm9kZVR5cGUpIHtcbiAgaWYgKFxuICAgICEoXG4gICAgICB0eXBlID09PSBUTm9kZVR5cGUuRWxlbWVudCB8fFxuICAgICAgdHlwZSA9PT0gVE5vZGVUeXBlLlRleHQgfHxcbiAgICAgIHR5cGUgPT09IFROb2RlVHlwZS5Db250YWluZXIgfHxcbiAgICAgIHR5cGUgPT09IFROb2RlVHlwZS5FbGVtZW50Q29udGFpbmVyIHx8XG4gICAgICB0eXBlID09PSBUTm9kZVR5cGUuSWN1IHx8XG4gICAgICB0eXBlID09PSBUTm9kZVR5cGUuUHJvamVjdGlvbiB8fFxuICAgICAgdHlwZSA9PT0gVE5vZGVUeXBlLlBsYWNlaG9sZGVyIHx8XG4gICAgICB0eXBlID09PSBUTm9kZVR5cGUuTGV0RGVjbGFyYXRpb25cbiAgICApXG4gICkge1xuICAgIHRocm93RXJyb3IoXG4gICAgICBgRXhwZWN0ZWQgVE5vZGVUeXBlIHRvIGhhdmUgb25seSBhIHNpbmdsZSB0eXBlIHNlbGVjdGVkLCBidXQgZ290ICR7dG9UTm9kZVR5cGVBc1N0cmluZyhcbiAgICAgICAgdHlwZSxcbiAgICAgICl9LmAsXG4gICAgKTtcbiAgfVxufVxuIl19