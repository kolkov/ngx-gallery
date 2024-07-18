import { providersResolver } from '../di_setup';
/**
 * This feature resolves the providers of a directive (or component),
 * and publish them into the DI system, making it visible to others for injection.
 *
 * For example:
 * ```ts
 * class ComponentWithProviders {
 *   constructor(private greeter: GreeterDE) {}
 *
 *   static ɵcmp = defineComponent({
 *     type: ComponentWithProviders,
 *     selectors: [['component-with-providers']],
 *    factory: () => new ComponentWithProviders(directiveInject(GreeterDE as any)),
 *    decls: 1,
 *    vars: 1,
 *    template: function(fs: RenderFlags, ctx: ComponentWithProviders) {
 *      if (fs & RenderFlags.Create) {
 *        ɵɵtext(0);
 *      }
 *      if (fs & RenderFlags.Update) {
 *        ɵɵtextInterpolate(ctx.greeter.greet());
 *      }
 *    },
 *    features: [ɵɵProvidersFeature([GreeterDE])]
 *  });
 * }
 * ```
 *
 * @param definition
 *
 * @codeGenApi
 */
export function ɵɵProvidersFeature(providers, viewProviders = []) {
    return (definition) => {
        definition.providersResolver = (def, processProvidersFn) => {
            return providersResolver(def, //
            processProvidersFn ? processProvidersFn(providers) : providers, //
            viewProviders);
        };
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvdmlkZXJzX2ZlYXR1cmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL2ZlYXR1cmVzL3Byb3ZpZGVyc19mZWF0dXJlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVFBLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUc5Qzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQStCRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FBSSxTQUFxQixFQUFFLGdCQUE0QixFQUFFO0lBQ3pGLE9BQU8sQ0FBQyxVQUEyQixFQUFFLEVBQUU7UUFDckMsVUFBVSxDQUFDLGlCQUFpQixHQUFHLENBQzdCLEdBQW9CLEVBQ3BCLGtCQUE2QyxFQUM3QyxFQUFFO1lBQ0YsT0FBTyxpQkFBaUIsQ0FDdEIsR0FBRyxFQUFFLEVBQUU7WUFDUCxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxFQUFFO1lBQ2xFLGFBQWEsQ0FDZCxDQUFDO1FBQ0osQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtQcm9jZXNzUHJvdmlkZXJzRnVuY3Rpb24sIFByb3ZpZGVyfSBmcm9tICcuLi8uLi9kaS9pbnRlcmZhY2UvcHJvdmlkZXInO1xuaW1wb3J0IHtwcm92aWRlcnNSZXNvbHZlcn0gZnJvbSAnLi4vZGlfc2V0dXAnO1xuaW1wb3J0IHtEaXJlY3RpdmVEZWZ9IGZyb20gJy4uL2ludGVyZmFjZXMvZGVmaW5pdGlvbic7XG5cbi8qKlxuICogVGhpcyBmZWF0dXJlIHJlc29sdmVzIHRoZSBwcm92aWRlcnMgb2YgYSBkaXJlY3RpdmUgKG9yIGNvbXBvbmVudCksXG4gKiBhbmQgcHVibGlzaCB0aGVtIGludG8gdGhlIERJIHN5c3RlbSwgbWFraW5nIGl0IHZpc2libGUgdG8gb3RoZXJzIGZvciBpbmplY3Rpb24uXG4gKlxuICogRm9yIGV4YW1wbGU6XG4gKiBgYGB0c1xuICogY2xhc3MgQ29tcG9uZW50V2l0aFByb3ZpZGVycyB7XG4gKiAgIGNvbnN0cnVjdG9yKHByaXZhdGUgZ3JlZXRlcjogR3JlZXRlckRFKSB7fVxuICpcbiAqICAgc3RhdGljIMm1Y21wID0gZGVmaW5lQ29tcG9uZW50KHtcbiAqICAgICB0eXBlOiBDb21wb25lbnRXaXRoUHJvdmlkZXJzLFxuICogICAgIHNlbGVjdG9yczogW1snY29tcG9uZW50LXdpdGgtcHJvdmlkZXJzJ11dLFxuICogICAgZmFjdG9yeTogKCkgPT4gbmV3IENvbXBvbmVudFdpdGhQcm92aWRlcnMoZGlyZWN0aXZlSW5qZWN0KEdyZWV0ZXJERSBhcyBhbnkpKSxcbiAqICAgIGRlY2xzOiAxLFxuICogICAgdmFyczogMSxcbiAqICAgIHRlbXBsYXRlOiBmdW5jdGlvbihmczogUmVuZGVyRmxhZ3MsIGN0eDogQ29tcG9uZW50V2l0aFByb3ZpZGVycykge1xuICogICAgICBpZiAoZnMgJiBSZW5kZXJGbGFncy5DcmVhdGUpIHtcbiAqICAgICAgICDJtcm1dGV4dCgwKTtcbiAqICAgICAgfVxuICogICAgICBpZiAoZnMgJiBSZW5kZXJGbGFncy5VcGRhdGUpIHtcbiAqICAgICAgICDJtcm1dGV4dEludGVycG9sYXRlKGN0eC5ncmVldGVyLmdyZWV0KCkpO1xuICogICAgICB9XG4gKiAgICB9LFxuICogICAgZmVhdHVyZXM6IFvJtcm1UHJvdmlkZXJzRmVhdHVyZShbR3JlZXRlckRFXSldXG4gKiAgfSk7XG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gZGVmaW5pdGlvblxuICpcbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1UHJvdmlkZXJzRmVhdHVyZTxUPihwcm92aWRlcnM6IFByb3ZpZGVyW10sIHZpZXdQcm92aWRlcnM6IFByb3ZpZGVyW10gPSBbXSkge1xuICByZXR1cm4gKGRlZmluaXRpb246IERpcmVjdGl2ZURlZjxUPikgPT4ge1xuICAgIGRlZmluaXRpb24ucHJvdmlkZXJzUmVzb2x2ZXIgPSAoXG4gICAgICBkZWY6IERpcmVjdGl2ZURlZjxUPixcbiAgICAgIHByb2Nlc3NQcm92aWRlcnNGbj86IFByb2Nlc3NQcm92aWRlcnNGdW5jdGlvbixcbiAgICApID0+IHtcbiAgICAgIHJldHVybiBwcm92aWRlcnNSZXNvbHZlcihcbiAgICAgICAgZGVmLCAvL1xuICAgICAgICBwcm9jZXNzUHJvdmlkZXJzRm4gPyBwcm9jZXNzUHJvdmlkZXJzRm4ocHJvdmlkZXJzKSA6IHByb3ZpZGVycywgLy9cbiAgICAgICAgdmlld1Byb3ZpZGVycyxcbiAgICAgICk7XG4gICAgfTtcbiAgfTtcbn1cbiJdfQ==