/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { getNullInjector } from '../di/r3_injector';
import { ComponentFactory } from './component_ref';
import { getComponentDef } from './definition';
import { assertComponentDef } from './errors';
/**
 * Creates a `ComponentRef` instance based on provided component type and a set of options.
 *
 * @usageNotes
 *
 * The example below demonstrates how the `createComponent` function can be used
 * to create an instance of a ComponentRef dynamically and attach it to an ApplicationRef,
 * so that it gets included into change detection cycles.
 *
 * Note: the example uses standalone components, but the function can also be used for
 * non-standalone components (declared in an NgModule) as well.
 *
 * ```typescript
 * @Component({
 *   standalone: true,
 *   template: `Hello {{ name }}!`
 * })
 * class HelloComponent {
 *   name = 'Angular';
 * }
 *
 * @Component({
 *   standalone: true,
 *   template: `<div id="hello-component-host"></div>`
 * })
 * class RootComponent {}
 *
 * // Bootstrap an application.
 * const applicationRef = await bootstrapApplication(RootComponent);
 *
 * // Locate a DOM node that would be used as a host.
 * const hostElement = document.getElementById('hello-component-host');
 *
 * // Get an `EnvironmentInjector` instance from the `ApplicationRef`.
 * const environmentInjector = applicationRef.injector;
 *
 * // We can now create a `ComponentRef` instance.
 * const componentRef = createComponent(HelloComponent, {hostElement, environmentInjector});
 *
 * // Last step is to register the newly created ref using the `ApplicationRef` instance
 * // to include the component view into change detection cycles.
 * applicationRef.attachView(componentRef.hostView);
 * componentRef.changeDetectorRef.detectChanges();
 * ```
 *
 * @param component Component class reference.
 * @param options Set of options to use:
 *  * `environmentInjector`: An `EnvironmentInjector` instance to be used for the component.
 *  * `hostElement` (optional): A DOM node that should act as a host node for the component. If not
 * provided, Angular creates one based on the tag name used in the component selector (and falls
 * back to using `div` if selector doesn't have tag name info).
 *  * `elementInjector` (optional): An `ElementInjector` instance, see additional info about it
 * [here](guide/di/hierarchical-dependency-injection#elementinjector).
 *  * `projectableNodes` (optional): A list of DOM nodes that should be projected through
 *                      [`<ng-content>`](api/core/ng-content) of the new component instance.
 * @returns ComponentRef instance that represents a given Component.
 *
 * @publicApi
 */
export function createComponent(component, options) {
    ngDevMode && assertComponentDef(component);
    const componentDef = getComponentDef(component);
    const elementInjector = options.elementInjector || getNullInjector();
    const factory = new ComponentFactory(componentDef);
    return factory.create(elementInjector, options.projectableNodes, options.hostElement, options.environmentInjector);
}
/**
 * Creates an object that allows to retrieve component metadata.
 *
 * @usageNotes
 *
 * The example below demonstrates how to use the function and how the fields
 * of the returned object map to the component metadata.
 *
 * ```typescript
 * @Component({
 *   standalone: true,
 *   selector: 'foo-component',
 *   template: `
 *     <ng-content></ng-content>
 *     <ng-content select="content-selector-a"></ng-content>
 *   `,
 * })
 * class FooComponent {
 *   @Input('inputName') inputPropName: string;
 *   @Output('outputName') outputPropName = new EventEmitter<void>();
 * }
 *
 * const mirror = reflectComponentType(FooComponent);
 * expect(mirror.type).toBe(FooComponent);
 * expect(mirror.selector).toBe('foo-component');
 * expect(mirror.isStandalone).toBe(true);
 * expect(mirror.inputs).toEqual([{propName: 'inputName', templateName: 'inputPropName'}]);
 * expect(mirror.outputs).toEqual([{propName: 'outputName', templateName: 'outputPropName'}]);
 * expect(mirror.ngContentSelectors).toEqual([
 *   '*',                 // first `<ng-content>` in a template, the selector defaults to `*`
 *   'content-selector-a' // second `<ng-content>` in a template
 * ]);
 * ```
 *
 * @param component Component class reference.
 * @returns An object that allows to retrieve component metadata.
 *
 * @publicApi
 */
export function reflectComponentType(component) {
    const componentDef = getComponentDef(component);
    if (!componentDef)
        return null;
    const factory = new ComponentFactory(componentDef);
    return {
        get selector() {
            return factory.selector;
        },
        get type() {
            return factory.componentType;
        },
        get inputs() {
            return factory.inputs;
        },
        get outputs() {
            return factory.outputs;
        },
        get ngContentSelectors() {
            return factory.ngContentSelectors;
        },
        get isStandalone() {
            return componentDef.standalone;
        },
        get isSignal() {
            return componentDef.signals;
        },
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFzQixlQUFlLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUl2RSxPQUFPLEVBQUMsZ0JBQWdCLEVBQUMsTUFBTSxpQkFBaUIsQ0FBQztBQUNqRCxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBQzdDLE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLFVBQVUsQ0FBQztBQUU1Qzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQTBERztBQUNILE1BQU0sVUFBVSxlQUFlLENBQzdCLFNBQWtCLEVBQ2xCLE9BS0M7SUFFRCxTQUFTLElBQUksa0JBQWtCLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDM0MsTUFBTSxZQUFZLEdBQUcsZUFBZSxDQUFDLFNBQVMsQ0FBRSxDQUFDO0lBQ2pELE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyxlQUFlLElBQUksZUFBZSxFQUFFLENBQUM7SUFDckUsTUFBTSxPQUFPLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBSSxZQUFZLENBQUMsQ0FBQztJQUN0RCxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQ25CLGVBQWUsRUFDZixPQUFPLENBQUMsZ0JBQWdCLEVBQ3hCLE9BQU8sQ0FBQyxXQUFXLEVBQ25CLE9BQU8sQ0FBQyxtQkFBbUIsQ0FDNUIsQ0FBQztBQUNKLENBQUM7QUE4Q0Q7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBc0NHO0FBQ0gsTUFBTSxVQUFVLG9CQUFvQixDQUFJLFNBQWtCO0lBQ3hELE1BQU0sWUFBWSxHQUFHLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNoRCxJQUFJLENBQUMsWUFBWTtRQUFFLE9BQU8sSUFBSSxDQUFDO0lBRS9CLE1BQU0sT0FBTyxHQUFHLElBQUksZ0JBQWdCLENBQUksWUFBWSxDQUFDLENBQUM7SUFDdEQsT0FBTztRQUNMLElBQUksUUFBUTtZQUNWLE9BQU8sT0FBTyxDQUFDLFFBQVEsQ0FBQztRQUMxQixDQUFDO1FBQ0QsSUFBSSxJQUFJO1lBQ04sT0FBTyxPQUFPLENBQUMsYUFBYSxDQUFDO1FBQy9CLENBQUM7UUFDRCxJQUFJLE1BQU07WUFNUixPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUM7UUFDeEIsQ0FBQztRQUNELElBQUksT0FBTztZQUNULE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQztRQUN6QixDQUFDO1FBQ0QsSUFBSSxrQkFBa0I7WUFDcEIsT0FBTyxPQUFPLENBQUMsa0JBQWtCLENBQUM7UUFDcEMsQ0FBQztRQUNELElBQUksWUFBWTtZQUNkLE9BQU8sWUFBWSxDQUFDLFVBQVUsQ0FBQztRQUNqQyxDQUFDO1FBQ0QsSUFBSSxRQUFRO1lBQ1YsT0FBTyxZQUFZLENBQUMsT0FBTyxDQUFDO1FBQzlCLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0luamVjdG9yfSBmcm9tICcuLi9kaS9pbmplY3Rvcic7XG5pbXBvcnQge0Vudmlyb25tZW50SW5qZWN0b3IsIGdldE51bGxJbmplY3Rvcn0gZnJvbSAnLi4vZGkvcjNfaW5qZWN0b3InO1xuaW1wb3J0IHtUeXBlfSBmcm9tICcuLi9pbnRlcmZhY2UvdHlwZSc7XG5pbXBvcnQge0NvbXBvbmVudFJlZn0gZnJvbSAnLi4vbGlua2VyL2NvbXBvbmVudF9mYWN0b3J5JztcblxuaW1wb3J0IHtDb21wb25lbnRGYWN0b3J5fSBmcm9tICcuL2NvbXBvbmVudF9yZWYnO1xuaW1wb3J0IHtnZXRDb21wb25lbnREZWZ9IGZyb20gJy4vZGVmaW5pdGlvbic7XG5pbXBvcnQge2Fzc2VydENvbXBvbmVudERlZn0gZnJvbSAnLi9lcnJvcnMnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBgQ29tcG9uZW50UmVmYCBpbnN0YW5jZSBiYXNlZCBvbiBwcm92aWRlZCBjb21wb25lbnQgdHlwZSBhbmQgYSBzZXQgb2Ygb3B0aW9ucy5cbiAqXG4gKiBAdXNhZ2VOb3Rlc1xuICpcbiAqIFRoZSBleGFtcGxlIGJlbG93IGRlbW9uc3RyYXRlcyBob3cgdGhlIGBjcmVhdGVDb21wb25lbnRgIGZ1bmN0aW9uIGNhbiBiZSB1c2VkXG4gKiB0byBjcmVhdGUgYW4gaW5zdGFuY2Ugb2YgYSBDb21wb25lbnRSZWYgZHluYW1pY2FsbHkgYW5kIGF0dGFjaCBpdCB0byBhbiBBcHBsaWNhdGlvblJlZixcbiAqIHNvIHRoYXQgaXQgZ2V0cyBpbmNsdWRlZCBpbnRvIGNoYW5nZSBkZXRlY3Rpb24gY3ljbGVzLlxuICpcbiAqIE5vdGU6IHRoZSBleGFtcGxlIHVzZXMgc3RhbmRhbG9uZSBjb21wb25lbnRzLCBidXQgdGhlIGZ1bmN0aW9uIGNhbiBhbHNvIGJlIHVzZWQgZm9yXG4gKiBub24tc3RhbmRhbG9uZSBjb21wb25lbnRzIChkZWNsYXJlZCBpbiBhbiBOZ01vZHVsZSkgYXMgd2VsbC5cbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBAQ29tcG9uZW50KHtcbiAqICAgc3RhbmRhbG9uZTogdHJ1ZSxcbiAqICAgdGVtcGxhdGU6IGBIZWxsbyB7eyBuYW1lIH19IWBcbiAqIH0pXG4gKiBjbGFzcyBIZWxsb0NvbXBvbmVudCB7XG4gKiAgIG5hbWUgPSAnQW5ndWxhcic7XG4gKiB9XG4gKlxuICogQENvbXBvbmVudCh7XG4gKiAgIHN0YW5kYWxvbmU6IHRydWUsXG4gKiAgIHRlbXBsYXRlOiBgPGRpdiBpZD1cImhlbGxvLWNvbXBvbmVudC1ob3N0XCI+PC9kaXY+YFxuICogfSlcbiAqIGNsYXNzIFJvb3RDb21wb25lbnQge31cbiAqXG4gKiAvLyBCb290c3RyYXAgYW4gYXBwbGljYXRpb24uXG4gKiBjb25zdCBhcHBsaWNhdGlvblJlZiA9IGF3YWl0IGJvb3RzdHJhcEFwcGxpY2F0aW9uKFJvb3RDb21wb25lbnQpO1xuICpcbiAqIC8vIExvY2F0ZSBhIERPTSBub2RlIHRoYXQgd291bGQgYmUgdXNlZCBhcyBhIGhvc3QuXG4gKiBjb25zdCBob3N0RWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZWxsby1jb21wb25lbnQtaG9zdCcpO1xuICpcbiAqIC8vIEdldCBhbiBgRW52aXJvbm1lbnRJbmplY3RvcmAgaW5zdGFuY2UgZnJvbSB0aGUgYEFwcGxpY2F0aW9uUmVmYC5cbiAqIGNvbnN0IGVudmlyb25tZW50SW5qZWN0b3IgPSBhcHBsaWNhdGlvblJlZi5pbmplY3RvcjtcbiAqXG4gKiAvLyBXZSBjYW4gbm93IGNyZWF0ZSBhIGBDb21wb25lbnRSZWZgIGluc3RhbmNlLlxuICogY29uc3QgY29tcG9uZW50UmVmID0gY3JlYXRlQ29tcG9uZW50KEhlbGxvQ29tcG9uZW50LCB7aG9zdEVsZW1lbnQsIGVudmlyb25tZW50SW5qZWN0b3J9KTtcbiAqXG4gKiAvLyBMYXN0IHN0ZXAgaXMgdG8gcmVnaXN0ZXIgdGhlIG5ld2x5IGNyZWF0ZWQgcmVmIHVzaW5nIHRoZSBgQXBwbGljYXRpb25SZWZgIGluc3RhbmNlXG4gKiAvLyB0byBpbmNsdWRlIHRoZSBjb21wb25lbnQgdmlldyBpbnRvIGNoYW5nZSBkZXRlY3Rpb24gY3ljbGVzLlxuICogYXBwbGljYXRpb25SZWYuYXR0YWNoVmlldyhjb21wb25lbnRSZWYuaG9zdFZpZXcpO1xuICogY29tcG9uZW50UmVmLmNoYW5nZURldGVjdG9yUmVmLmRldGVjdENoYW5nZXMoKTtcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBjb21wb25lbnQgQ29tcG9uZW50IGNsYXNzIHJlZmVyZW5jZS5cbiAqIEBwYXJhbSBvcHRpb25zIFNldCBvZiBvcHRpb25zIHRvIHVzZTpcbiAqICAqIGBlbnZpcm9ubWVudEluamVjdG9yYDogQW4gYEVudmlyb25tZW50SW5qZWN0b3JgIGluc3RhbmNlIHRvIGJlIHVzZWQgZm9yIHRoZSBjb21wb25lbnQuXG4gKiAgKiBgaG9zdEVsZW1lbnRgIChvcHRpb25hbCk6IEEgRE9NIG5vZGUgdGhhdCBzaG91bGQgYWN0IGFzIGEgaG9zdCBub2RlIGZvciB0aGUgY29tcG9uZW50LiBJZiBub3RcbiAqIHByb3ZpZGVkLCBBbmd1bGFyIGNyZWF0ZXMgb25lIGJhc2VkIG9uIHRoZSB0YWcgbmFtZSB1c2VkIGluIHRoZSBjb21wb25lbnQgc2VsZWN0b3IgKGFuZCBmYWxsc1xuICogYmFjayB0byB1c2luZyBgZGl2YCBpZiBzZWxlY3RvciBkb2Vzbid0IGhhdmUgdGFnIG5hbWUgaW5mbykuXG4gKiAgKiBgZWxlbWVudEluamVjdG9yYCAob3B0aW9uYWwpOiBBbiBgRWxlbWVudEluamVjdG9yYCBpbnN0YW5jZSwgc2VlIGFkZGl0aW9uYWwgaW5mbyBhYm91dCBpdFxuICogW2hlcmVdKGd1aWRlL2RpL2hpZXJhcmNoaWNhbC1kZXBlbmRlbmN5LWluamVjdGlvbiNlbGVtZW50aW5qZWN0b3IpLlxuICogICogYHByb2plY3RhYmxlTm9kZXNgIChvcHRpb25hbCk6IEEgbGlzdCBvZiBET00gbm9kZXMgdGhhdCBzaG91bGQgYmUgcHJvamVjdGVkIHRocm91Z2hcbiAqICAgICAgICAgICAgICAgICAgICAgIFtgPG5nLWNvbnRlbnQ+YF0oYXBpL2NvcmUvbmctY29udGVudCkgb2YgdGhlIG5ldyBjb21wb25lbnQgaW5zdGFuY2UuXG4gKiBAcmV0dXJucyBDb21wb25lbnRSZWYgaW5zdGFuY2UgdGhhdCByZXByZXNlbnRzIGEgZ2l2ZW4gQ29tcG9uZW50LlxuICpcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudDxDPihcbiAgY29tcG9uZW50OiBUeXBlPEM+LFxuICBvcHRpb25zOiB7XG4gICAgZW52aXJvbm1lbnRJbmplY3RvcjogRW52aXJvbm1lbnRJbmplY3RvcjtcbiAgICBob3N0RWxlbWVudD86IEVsZW1lbnQ7XG4gICAgZWxlbWVudEluamVjdG9yPzogSW5qZWN0b3I7XG4gICAgcHJvamVjdGFibGVOb2Rlcz86IE5vZGVbXVtdO1xuICB9LFxuKTogQ29tcG9uZW50UmVmPEM+IHtcbiAgbmdEZXZNb2RlICYmIGFzc2VydENvbXBvbmVudERlZihjb21wb25lbnQpO1xuICBjb25zdCBjb21wb25lbnREZWYgPSBnZXRDb21wb25lbnREZWYoY29tcG9uZW50KSE7XG4gIGNvbnN0IGVsZW1lbnRJbmplY3RvciA9IG9wdGlvbnMuZWxlbWVudEluamVjdG9yIHx8IGdldE51bGxJbmplY3RvcigpO1xuICBjb25zdCBmYWN0b3J5ID0gbmV3IENvbXBvbmVudEZhY3Rvcnk8Qz4oY29tcG9uZW50RGVmKTtcbiAgcmV0dXJuIGZhY3RvcnkuY3JlYXRlKFxuICAgIGVsZW1lbnRJbmplY3RvcixcbiAgICBvcHRpb25zLnByb2plY3RhYmxlTm9kZXMsXG4gICAgb3B0aW9ucy5ob3N0RWxlbWVudCxcbiAgICBvcHRpb25zLmVudmlyb25tZW50SW5qZWN0b3IsXG4gICk7XG59XG5cbi8qKlxuICogQW4gaW50ZXJmYWNlIHRoYXQgZGVzY3JpYmVzIHRoZSBzdWJzZXQgb2YgY29tcG9uZW50IG1ldGFkYXRhXG4gKiB0aGF0IGNhbiBiZSByZXRyaWV2ZWQgdXNpbmcgdGhlIGByZWZsZWN0Q29tcG9uZW50VHlwZWAgZnVuY3Rpb24uXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbXBvbmVudE1pcnJvcjxDPiB7XG4gIC8qKlxuICAgKiBUaGUgY29tcG9uZW50J3MgSFRNTCBzZWxlY3Rvci5cbiAgICovXG4gIGdldCBzZWxlY3RvcigpOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBUaGUgdHlwZSBvZiBjb21wb25lbnQgdGhlIGZhY3Rvcnkgd2lsbCBjcmVhdGUuXG4gICAqL1xuICBnZXQgdHlwZSgpOiBUeXBlPEM+O1xuICAvKipcbiAgICogVGhlIGlucHV0cyBvZiB0aGUgY29tcG9uZW50LlxuICAgKi9cbiAgZ2V0IGlucHV0cygpOiBSZWFkb25seUFycmF5PHtcbiAgICByZWFkb25seSBwcm9wTmFtZTogc3RyaW5nO1xuICAgIHJlYWRvbmx5IHRlbXBsYXRlTmFtZTogc3RyaW5nO1xuICAgIHJlYWRvbmx5IHRyYW5zZm9ybT86ICh2YWx1ZTogYW55KSA9PiBhbnk7XG4gICAgcmVhZG9ubHkgaXNTaWduYWw6IGJvb2xlYW47XG4gIH0+O1xuICAvKipcbiAgICogVGhlIG91dHB1dHMgb2YgdGhlIGNvbXBvbmVudC5cbiAgICovXG4gIGdldCBvdXRwdXRzKCk6IFJlYWRvbmx5QXJyYXk8e3JlYWRvbmx5IHByb3BOYW1lOiBzdHJpbmc7IHJlYWRvbmx5IHRlbXBsYXRlTmFtZTogc3RyaW5nfT47XG4gIC8qKlxuICAgKiBTZWxlY3RvciBmb3IgYWxsIDxuZy1jb250ZW50PiBlbGVtZW50cyBpbiB0aGUgY29tcG9uZW50LlxuICAgKi9cbiAgZ2V0IG5nQ29udGVudFNlbGVjdG9ycygpOiBSZWFkb25seUFycmF5PHN0cmluZz47XG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoaXMgY29tcG9uZW50IGlzIG1hcmtlZCBhcyBzdGFuZGFsb25lLlxuICAgKiBOb3RlOiBhbiBleHRyYSBmbGFnLCBub3QgcHJlc2VudCBpbiBgQ29tcG9uZW50RmFjdG9yeWAuXG4gICAqL1xuICBnZXQgaXNTdGFuZGFsb25lKCk6IGJvb2xlYW47XG4gIC8qKlxuICAgKiAvLyBUT0RPKHNpZ25hbHMpOiBSZW1vdmUgaW50ZXJuYWwgYW5kIGFkZCBwdWJsaWMgZG9jdW1lbnRhdGlvblxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGdldCBpc1NpZ25hbCgpOiBib29sZWFuO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gb2JqZWN0IHRoYXQgYWxsb3dzIHRvIHJldHJpZXZlIGNvbXBvbmVudCBtZXRhZGF0YS5cbiAqXG4gKiBAdXNhZ2VOb3Rlc1xuICpcbiAqIFRoZSBleGFtcGxlIGJlbG93IGRlbW9uc3RyYXRlcyBob3cgdG8gdXNlIHRoZSBmdW5jdGlvbiBhbmQgaG93IHRoZSBmaWVsZHNcbiAqIG9mIHRoZSByZXR1cm5lZCBvYmplY3QgbWFwIHRvIHRoZSBjb21wb25lbnQgbWV0YWRhdGEuXG4gKlxuICogYGBgdHlwZXNjcmlwdFxuICogQENvbXBvbmVudCh7XG4gKiAgIHN0YW5kYWxvbmU6IHRydWUsXG4gKiAgIHNlbGVjdG9yOiAnZm9vLWNvbXBvbmVudCcsXG4gKiAgIHRlbXBsYXRlOiBgXG4gKiAgICAgPG5nLWNvbnRlbnQ+PC9uZy1jb250ZW50PlxuICogICAgIDxuZy1jb250ZW50IHNlbGVjdD1cImNvbnRlbnQtc2VsZWN0b3ItYVwiPjwvbmctY29udGVudD5cbiAqICAgYCxcbiAqIH0pXG4gKiBjbGFzcyBGb29Db21wb25lbnQge1xuICogICBASW5wdXQoJ2lucHV0TmFtZScpIGlucHV0UHJvcE5hbWU6IHN0cmluZztcbiAqICAgQE91dHB1dCgnb3V0cHV0TmFtZScpIG91dHB1dFByb3BOYW1lID0gbmV3IEV2ZW50RW1pdHRlcjx2b2lkPigpO1xuICogfVxuICpcbiAqIGNvbnN0IG1pcnJvciA9IHJlZmxlY3RDb21wb25lbnRUeXBlKEZvb0NvbXBvbmVudCk7XG4gKiBleHBlY3QobWlycm9yLnR5cGUpLnRvQmUoRm9vQ29tcG9uZW50KTtcbiAqIGV4cGVjdChtaXJyb3Iuc2VsZWN0b3IpLnRvQmUoJ2Zvby1jb21wb25lbnQnKTtcbiAqIGV4cGVjdChtaXJyb3IuaXNTdGFuZGFsb25lKS50b0JlKHRydWUpO1xuICogZXhwZWN0KG1pcnJvci5pbnB1dHMpLnRvRXF1YWwoW3twcm9wTmFtZTogJ2lucHV0TmFtZScsIHRlbXBsYXRlTmFtZTogJ2lucHV0UHJvcE5hbWUnfV0pO1xuICogZXhwZWN0KG1pcnJvci5vdXRwdXRzKS50b0VxdWFsKFt7cHJvcE5hbWU6ICdvdXRwdXROYW1lJywgdGVtcGxhdGVOYW1lOiAnb3V0cHV0UHJvcE5hbWUnfV0pO1xuICogZXhwZWN0KG1pcnJvci5uZ0NvbnRlbnRTZWxlY3RvcnMpLnRvRXF1YWwoW1xuICogICAnKicsICAgICAgICAgICAgICAgICAvLyBmaXJzdCBgPG5nLWNvbnRlbnQ+YCBpbiBhIHRlbXBsYXRlLCB0aGUgc2VsZWN0b3IgZGVmYXVsdHMgdG8gYCpgXG4gKiAgICdjb250ZW50LXNlbGVjdG9yLWEnIC8vIHNlY29uZCBgPG5nLWNvbnRlbnQ+YCBpbiBhIHRlbXBsYXRlXG4gKiBdKTtcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBjb21wb25lbnQgQ29tcG9uZW50IGNsYXNzIHJlZmVyZW5jZS5cbiAqIEByZXR1cm5zIEFuIG9iamVjdCB0aGF0IGFsbG93cyB0byByZXRyaWV2ZSBjb21wb25lbnQgbWV0YWRhdGEuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVmbGVjdENvbXBvbmVudFR5cGU8Qz4oY29tcG9uZW50OiBUeXBlPEM+KTogQ29tcG9uZW50TWlycm9yPEM+IHwgbnVsbCB7XG4gIGNvbnN0IGNvbXBvbmVudERlZiA9IGdldENvbXBvbmVudERlZihjb21wb25lbnQpO1xuICBpZiAoIWNvbXBvbmVudERlZikgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgZmFjdG9yeSA9IG5ldyBDb21wb25lbnRGYWN0b3J5PEM+KGNvbXBvbmVudERlZik7XG4gIHJldHVybiB7XG4gICAgZ2V0IHNlbGVjdG9yKCk6IHN0cmluZyB7XG4gICAgICByZXR1cm4gZmFjdG9yeS5zZWxlY3RvcjtcbiAgICB9LFxuICAgIGdldCB0eXBlKCk6IFR5cGU8Qz4ge1xuICAgICAgcmV0dXJuIGZhY3RvcnkuY29tcG9uZW50VHlwZTtcbiAgICB9LFxuICAgIGdldCBpbnB1dHMoKTogUmVhZG9ubHlBcnJheTx7XG4gICAgICBwcm9wTmFtZTogc3RyaW5nO1xuICAgICAgdGVtcGxhdGVOYW1lOiBzdHJpbmc7XG4gICAgICB0cmFuc2Zvcm0/OiAodmFsdWU6IGFueSkgPT4gYW55O1xuICAgICAgaXNTaWduYWw6IGJvb2xlYW47XG4gICAgfT4ge1xuICAgICAgcmV0dXJuIGZhY3RvcnkuaW5wdXRzO1xuICAgIH0sXG4gICAgZ2V0IG91dHB1dHMoKTogUmVhZG9ubHlBcnJheTx7cHJvcE5hbWU6IHN0cmluZzsgdGVtcGxhdGVOYW1lOiBzdHJpbmd9PiB7XG4gICAgICByZXR1cm4gZmFjdG9yeS5vdXRwdXRzO1xuICAgIH0sXG4gICAgZ2V0IG5nQ29udGVudFNlbGVjdG9ycygpOiBSZWFkb25seUFycmF5PHN0cmluZz4ge1xuICAgICAgcmV0dXJuIGZhY3RvcnkubmdDb250ZW50U2VsZWN0b3JzO1xuICAgIH0sXG4gICAgZ2V0IGlzU3RhbmRhbG9uZSgpOiBib29sZWFuIHtcbiAgICAgIHJldHVybiBjb21wb25lbnREZWYuc3RhbmRhbG9uZTtcbiAgICB9LFxuICAgIGdldCBpc1NpZ25hbCgpOiBib29sZWFuIHtcbiAgICAgIHJldHVybiBjb21wb25lbnREZWYuc2lnbmFscztcbiAgICB9LFxuICB9O1xufVxuIl19