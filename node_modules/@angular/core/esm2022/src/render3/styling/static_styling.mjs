/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { concatStringsWithSpace } from '../../util/stringify';
import { assertFirstCreatePass } from '../assert';
import { getTView } from '../state';
/**
 * Compute the static styling (class/style) from `TAttributes`.
 *
 * This function should be called during `firstCreatePass` only.
 *
 * @param tNode The `TNode` into which the styling information should be loaded.
 * @param attrs `TAttributes` containing the styling information.
 * @param writeToHost Where should the resulting static styles be written?
 *   - `false` Write to `TNode.stylesWithoutHost` / `TNode.classesWithoutHost`
 *   - `true` Write to `TNode.styles` / `TNode.classes`
 */
export function computeStaticStyling(tNode, attrs, writeToHost) {
    ngDevMode &&
        assertFirstCreatePass(getTView(), 'Expecting to be called in first template pass only');
    let styles = writeToHost ? tNode.styles : null;
    let classes = writeToHost ? tNode.classes : null;
    let mode = 0;
    if (attrs !== null) {
        for (let i = 0; i < attrs.length; i++) {
            const value = attrs[i];
            if (typeof value === 'number') {
                mode = value;
            }
            else if (mode == 1 /* AttributeMarker.Classes */) {
                classes = concatStringsWithSpace(classes, value);
            }
            else if (mode == 2 /* AttributeMarker.Styles */) {
                const style = value;
                const styleValue = attrs[++i];
                styles = concatStringsWithSpace(styles, style + ': ' + styleValue + ';');
            }
        }
    }
    writeToHost ? (tNode.styles = styles) : (tNode.stylesWithoutHost = styles);
    writeToHost ? (tNode.classes = classes) : (tNode.classesWithoutHost = classes);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGljX3N0eWxpbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL3N0eWxpbmcvc3RhdGljX3N0eWxpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFDNUQsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sV0FBVyxDQUFDO0FBR2hELE9BQU8sRUFBQyxRQUFRLEVBQUMsTUFBTSxVQUFVLENBQUM7QUFFbEM7Ozs7Ozs7Ozs7R0FVRztBQUNILE1BQU0sVUFBVSxvQkFBb0IsQ0FDbEMsS0FBWSxFQUNaLEtBQXlCLEVBQ3pCLFdBQW9CO0lBRXBCLFNBQVM7UUFDUCxxQkFBcUIsQ0FBQyxRQUFRLEVBQUUsRUFBRSxvREFBb0QsQ0FBQyxDQUFDO0lBQzFGLElBQUksTUFBTSxHQUFrQixXQUFXLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUM5RCxJQUFJLE9BQU8sR0FBa0IsV0FBVyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDaEUsSUFBSSxJQUFJLEdBQXdCLENBQUMsQ0FBQztJQUNsQyxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUNuQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN2QixJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUM5QixJQUFJLEdBQUcsS0FBSyxDQUFDO1lBQ2YsQ0FBQztpQkFBTSxJQUFJLElBQUksbUNBQTJCLEVBQUUsQ0FBQztnQkFDM0MsT0FBTyxHQUFHLHNCQUFzQixDQUFDLE9BQU8sRUFBRSxLQUFlLENBQUMsQ0FBQztZQUM3RCxDQUFDO2lCQUFNLElBQUksSUFBSSxrQ0FBMEIsRUFBRSxDQUFDO2dCQUMxQyxNQUFNLEtBQUssR0FBRyxLQUFlLENBQUM7Z0JBQzlCLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBVyxDQUFDO2dCQUN4QyxNQUFNLEdBQUcsc0JBQXNCLENBQUMsTUFBTSxFQUFFLEtBQUssR0FBRyxJQUFJLEdBQUcsVUFBVSxHQUFHLEdBQUcsQ0FBQyxDQUFDO1lBQzNFLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUNELFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsR0FBRyxNQUFNLENBQUMsQ0FBQztJQUMzRSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLEdBQUcsT0FBTyxDQUFDLENBQUM7QUFDakYsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2NvbmNhdFN0cmluZ3NXaXRoU3BhY2V9IGZyb20gJy4uLy4uL3V0aWwvc3RyaW5naWZ5JztcbmltcG9ydCB7YXNzZXJ0Rmlyc3RDcmVhdGVQYXNzfSBmcm9tICcuLi9hc3NlcnQnO1xuaW1wb3J0IHtBdHRyaWJ1dGVNYXJrZXJ9IGZyb20gJy4uL2ludGVyZmFjZXMvYXR0cmlidXRlX21hcmtlcic7XG5pbXBvcnQge1RBdHRyaWJ1dGVzLCBUTm9kZX0gZnJvbSAnLi4vaW50ZXJmYWNlcy9ub2RlJztcbmltcG9ydCB7Z2V0VFZpZXd9IGZyb20gJy4uL3N0YXRlJztcblxuLyoqXG4gKiBDb21wdXRlIHRoZSBzdGF0aWMgc3R5bGluZyAoY2xhc3Mvc3R5bGUpIGZyb20gYFRBdHRyaWJ1dGVzYC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBjYWxsZWQgZHVyaW5nIGBmaXJzdENyZWF0ZVBhc3NgIG9ubHkuXG4gKlxuICogQHBhcmFtIHROb2RlIFRoZSBgVE5vZGVgIGludG8gd2hpY2ggdGhlIHN0eWxpbmcgaW5mb3JtYXRpb24gc2hvdWxkIGJlIGxvYWRlZC5cbiAqIEBwYXJhbSBhdHRycyBgVEF0dHJpYnV0ZXNgIGNvbnRhaW5pbmcgdGhlIHN0eWxpbmcgaW5mb3JtYXRpb24uXG4gKiBAcGFyYW0gd3JpdGVUb0hvc3QgV2hlcmUgc2hvdWxkIHRoZSByZXN1bHRpbmcgc3RhdGljIHN0eWxlcyBiZSB3cml0dGVuP1xuICogICAtIGBmYWxzZWAgV3JpdGUgdG8gYFROb2RlLnN0eWxlc1dpdGhvdXRIb3N0YCAvIGBUTm9kZS5jbGFzc2VzV2l0aG91dEhvc3RgXG4gKiAgIC0gYHRydWVgIFdyaXRlIHRvIGBUTm9kZS5zdHlsZXNgIC8gYFROb2RlLmNsYXNzZXNgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21wdXRlU3RhdGljU3R5bGluZyhcbiAgdE5vZGU6IFROb2RlLFxuICBhdHRyczogVEF0dHJpYnV0ZXMgfCBudWxsLFxuICB3cml0ZVRvSG9zdDogYm9vbGVhbixcbik6IHZvaWQge1xuICBuZ0Rldk1vZGUgJiZcbiAgICBhc3NlcnRGaXJzdENyZWF0ZVBhc3MoZ2V0VFZpZXcoKSwgJ0V4cGVjdGluZyB0byBiZSBjYWxsZWQgaW4gZmlyc3QgdGVtcGxhdGUgcGFzcyBvbmx5Jyk7XG4gIGxldCBzdHlsZXM6IHN0cmluZyB8IG51bGwgPSB3cml0ZVRvSG9zdCA/IHROb2RlLnN0eWxlcyA6IG51bGw7XG4gIGxldCBjbGFzc2VzOiBzdHJpbmcgfCBudWxsID0gd3JpdGVUb0hvc3QgPyB0Tm9kZS5jbGFzc2VzIDogbnVsbDtcbiAgbGV0IG1vZGU6IEF0dHJpYnV0ZU1hcmtlciB8IDAgPSAwO1xuICBpZiAoYXR0cnMgIT09IG51bGwpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGF0dHJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGF0dHJzW2ldO1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgbW9kZSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIGlmIChtb2RlID09IEF0dHJpYnV0ZU1hcmtlci5DbGFzc2VzKSB7XG4gICAgICAgIGNsYXNzZXMgPSBjb25jYXRTdHJpbmdzV2l0aFNwYWNlKGNsYXNzZXMsIHZhbHVlIGFzIHN0cmluZyk7XG4gICAgICB9IGVsc2UgaWYgKG1vZGUgPT0gQXR0cmlidXRlTWFya2VyLlN0eWxlcykge1xuICAgICAgICBjb25zdCBzdHlsZSA9IHZhbHVlIGFzIHN0cmluZztcbiAgICAgICAgY29uc3Qgc3R5bGVWYWx1ZSA9IGF0dHJzWysraV0gYXMgc3RyaW5nO1xuICAgICAgICBzdHlsZXMgPSBjb25jYXRTdHJpbmdzV2l0aFNwYWNlKHN0eWxlcywgc3R5bGUgKyAnOiAnICsgc3R5bGVWYWx1ZSArICc7Jyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHdyaXRlVG9Ib3N0ID8gKHROb2RlLnN0eWxlcyA9IHN0eWxlcykgOiAodE5vZGUuc3R5bGVzV2l0aG91dEhvc3QgPSBzdHlsZXMpO1xuICB3cml0ZVRvSG9zdCA/ICh0Tm9kZS5jbGFzc2VzID0gY2xhc3NlcykgOiAodE5vZGUuY2xhc3Nlc1dpdGhvdXRIb3N0ID0gY2xhc3Nlcyk7XG59XG4iXX0=