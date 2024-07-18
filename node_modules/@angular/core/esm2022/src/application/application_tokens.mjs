/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { InjectionToken } from '../di/injection_token';
import { getDocument } from '../render3/interfaces/document';
/**
 * A DI token representing a string ID, used
 * primarily for prefixing application attributes and CSS styles when
 * {@link ViewEncapsulation#Emulated} is being used.
 *
 * The token is needed in cases when multiple applications are bootstrapped on a page
 * (for example, using `bootstrapApplication` calls). In this case, ensure that those applications
 * have different `APP_ID` value setup. For example:
 *
 * ```
 * bootstrapApplication(ComponentA, {
 *   providers: [
 *     { provide: APP_ID, useValue: 'app-a' },
 *     // ... other providers ...
 *   ]
 * });
 *
 * bootstrapApplication(ComponentB, {
 *   providers: [
 *     { provide: APP_ID, useValue: 'app-b' },
 *     // ... other providers ...
 *   ]
 * });
 * ```
 *
 * By default, when there is only one application bootstrapped, you don't need to provide the
 * `APP_ID` token (the `ng` will be used as an app ID).
 *
 * @publicApi
 */
export const APP_ID = new InjectionToken(ngDevMode ? 'AppId' : '', {
    providedIn: 'root',
    factory: () => DEFAULT_APP_ID,
});
/** Default value of the `APP_ID` token. */
const DEFAULT_APP_ID = 'ng';
/**
 * A function that is executed when a platform is initialized.
 * @publicApi
 */
export const PLATFORM_INITIALIZER = new InjectionToken(ngDevMode ? 'Platform Initializer' : '');
/**
 * A token that indicates an opaque platform ID.
 * @publicApi
 */
export const PLATFORM_ID = new InjectionToken(ngDevMode ? 'Platform ID' : '', {
    providedIn: 'platform',
    factory: () => 'unknown', // set a default platform name, when none set explicitly
});
/**
 * A DI token that indicates the root directory of
 * the application
 * @publicApi
 * @deprecated
 */
export const PACKAGE_ROOT_URL = new InjectionToken(ngDevMode ? 'Application Packages Root URL' : '');
// We keep this token here, rather than the animations package, so that modules that only care
// about which animations module is loaded (e.g. the CDK) can retrieve it without having to
// include extra dependencies. See #44970 for more context.
/**
 * A [DI token](api/core/InjectionToken) that indicates which animations
 * module has been loaded.
 * @publicApi
 */
export const ANIMATION_MODULE_TYPE = new InjectionToken(ngDevMode ? 'AnimationModuleType' : '');
// TODO(crisbeto): link to CSP guide here.
/**
 * Token used to configure the [Content Security Policy](https://web.dev/strict-csp/) nonce that
 * Angular will apply when inserting inline styles. If not provided, Angular will look up its value
 * from the `ngCspNonce` attribute of the application root node.
 *
 * @publicApi
 */
export const CSP_NONCE = new InjectionToken(ngDevMode ? 'CSP nonce' : '', {
    providedIn: 'root',
    factory: () => {
        // Ideally we wouldn't have to use `querySelector` here since we know that the nonce will be on
        // the root node, but because the token value is used in renderers, it has to be available
        // *very* early in the bootstrapping process. This should be a fairly shallow search, because
        // the app won't have been added to the DOM yet. Some approaches that were considered:
        // 1. Find the root node through `ApplicationRef.components[i].location` - normally this would
        // be enough for our purposes, but the token is injected very early so the `components` array
        // isn't populated yet.
        // 2. Find the root `LView` through the current `LView` - renderers are a prerequisite to
        // creating the `LView`. This means that no `LView` will have been entered when this factory is
        // invoked for the root component.
        // 3. Have the token factory return `() => string` which is invoked when a nonce is requested -
        // the slightly later execution does allow us to get an `LView` reference, but the fact that
        // it is a function means that it could be executed at *any* time (including immediately) which
        // may lead to weird bugs.
        // 4. Have the `ComponentFactory` read the attribute and provide it to the injector under the
        // hood - has the same problem as #1 and #2 in that the renderer is used to query for the root
        // node and the nonce value needs to be available when the renderer is created.
        return getDocument().body?.querySelector('[ngCspNonce]')?.getAttribute('ngCspNonce') || null;
    },
});
export const IMAGE_CONFIG_DEFAULTS = {
    breakpoints: [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    placeholderResolution: 30,
    disableImageSizeWarning: false,
    disableImageLazyLoadWarning: false,
};
/**
 * Injection token that configures the image optimized image functionality.
 * See {@link ImageConfig} for additional information about parameters that
 * can be used.
 *
 * @see {@link NgOptimizedImage}
 * @see {@link ImageConfig}
 * @publicApi
 */
export const IMAGE_CONFIG = new InjectionToken(ngDevMode ? 'ImageConfig' : '', {
    providedIn: 'root',
    factory: () => IMAGE_CONFIG_DEFAULTS,
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb25fdG9rZW5zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvYXBwbGljYXRpb24vYXBwbGljYXRpb25fdG9rZW5zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUNyRCxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFM0Q7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBNkJHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sTUFBTSxHQUFHLElBQUksY0FBYyxDQUFTLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7SUFDekUsVUFBVSxFQUFFLE1BQU07SUFDbEIsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLGNBQWM7Q0FDOUIsQ0FBQyxDQUFDO0FBRUgsMkNBQTJDO0FBQzNDLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQztBQUU1Qjs7O0dBR0c7QUFDSCxNQUFNLENBQUMsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLGNBQWMsQ0FDcEQsU0FBUyxDQUFDLENBQUMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUN4QyxDQUFDO0FBRUY7OztHQUdHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sV0FBVyxHQUFHLElBQUksY0FBYyxDQUFTLFNBQVMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7SUFDcEYsVUFBVSxFQUFFLFVBQVU7SUFDdEIsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLFNBQVMsRUFBRSx3REFBd0Q7Q0FDbkYsQ0FBQyxDQUFDO0FBRUg7Ozs7O0dBS0c7QUFDSCxNQUFNLENBQUMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLGNBQWMsQ0FDaEQsU0FBUyxDQUFDLENBQUMsQ0FBQywrQkFBK0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUNqRCxDQUFDO0FBRUYsOEZBQThGO0FBQzlGLDJGQUEyRjtBQUMzRiwyREFBMkQ7QUFFM0Q7Ozs7R0FJRztBQUNILE1BQU0sQ0FBQyxNQUFNLHFCQUFxQixHQUFHLElBQUksY0FBYyxDQUNyRCxTQUFTLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQ3ZDLENBQUM7QUFFRiwwQ0FBMEM7QUFDMUM7Ozs7OztHQU1HO0FBQ0gsTUFBTSxDQUFDLE1BQU0sU0FBUyxHQUFHLElBQUksY0FBYyxDQUFnQixTQUFTLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0lBQ3ZGLFVBQVUsRUFBRSxNQUFNO0lBQ2xCLE9BQU8sRUFBRSxHQUFHLEVBQUU7UUFDWiwrRkFBK0Y7UUFDL0YsMEZBQTBGO1FBQzFGLDZGQUE2RjtRQUM3RixzRkFBc0Y7UUFDdEYsOEZBQThGO1FBQzlGLDZGQUE2RjtRQUM3Rix1QkFBdUI7UUFDdkIseUZBQXlGO1FBQ3pGLCtGQUErRjtRQUMvRixrQ0FBa0M7UUFDbEMsK0ZBQStGO1FBQy9GLDRGQUE0RjtRQUM1RiwrRkFBK0Y7UUFDL0YsMEJBQTBCO1FBQzFCLDZGQUE2RjtRQUM3Riw4RkFBOEY7UUFDOUYsK0VBQStFO1FBQy9FLE9BQU8sV0FBVyxFQUFFLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxjQUFjLENBQUMsRUFBRSxZQUFZLENBQUMsWUFBWSxDQUFDLElBQUksSUFBSSxDQUFDO0lBQy9GLENBQUM7Q0FDRixDQUFDLENBQUM7QUFzQkgsTUFBTSxDQUFDLE1BQU0scUJBQXFCLEdBQWdCO0lBQ2hELFdBQVcsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztJQUM3RixxQkFBcUIsRUFBRSxFQUFFO0lBQ3pCLHVCQUF1QixFQUFFLEtBQUs7SUFDOUIsMkJBQTJCLEVBQUUsS0FBSztDQUNuQyxDQUFDO0FBRUY7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFNLENBQUMsTUFBTSxZQUFZLEdBQUcsSUFBSSxjQUFjLENBQWMsU0FBUyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtJQUMxRixVQUFVLEVBQUUsTUFBTTtJQUNsQixPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMscUJBQXFCO0NBQ3JDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0luamVjdGlvblRva2VufSBmcm9tICcuLi9kaS9pbmplY3Rpb25fdG9rZW4nO1xuaW1wb3J0IHtnZXREb2N1bWVudH0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL2RvY3VtZW50JztcblxuLyoqXG4gKiBBIERJIHRva2VuIHJlcHJlc2VudGluZyBhIHN0cmluZyBJRCwgdXNlZFxuICogcHJpbWFyaWx5IGZvciBwcmVmaXhpbmcgYXBwbGljYXRpb24gYXR0cmlidXRlcyBhbmQgQ1NTIHN0eWxlcyB3aGVuXG4gKiB7QGxpbmsgVmlld0VuY2Fwc3VsYXRpb24jRW11bGF0ZWR9IGlzIGJlaW5nIHVzZWQuXG4gKlxuICogVGhlIHRva2VuIGlzIG5lZWRlZCBpbiBjYXNlcyB3aGVuIG11bHRpcGxlIGFwcGxpY2F0aW9ucyBhcmUgYm9vdHN0cmFwcGVkIG9uIGEgcGFnZVxuICogKGZvciBleGFtcGxlLCB1c2luZyBgYm9vdHN0cmFwQXBwbGljYXRpb25gIGNhbGxzKS4gSW4gdGhpcyBjYXNlLCBlbnN1cmUgdGhhdCB0aG9zZSBhcHBsaWNhdGlvbnNcbiAqIGhhdmUgZGlmZmVyZW50IGBBUFBfSURgIHZhbHVlIHNldHVwLiBGb3IgZXhhbXBsZTpcbiAqXG4gKiBgYGBcbiAqIGJvb3RzdHJhcEFwcGxpY2F0aW9uKENvbXBvbmVudEEsIHtcbiAqICAgcHJvdmlkZXJzOiBbXG4gKiAgICAgeyBwcm92aWRlOiBBUFBfSUQsIHVzZVZhbHVlOiAnYXBwLWEnIH0sXG4gKiAgICAgLy8gLi4uIG90aGVyIHByb3ZpZGVycyAuLi5cbiAqICAgXVxuICogfSk7XG4gKlxuICogYm9vdHN0cmFwQXBwbGljYXRpb24oQ29tcG9uZW50Qiwge1xuICogICBwcm92aWRlcnM6IFtcbiAqICAgICB7IHByb3ZpZGU6IEFQUF9JRCwgdXNlVmFsdWU6ICdhcHAtYicgfSxcbiAqICAgICAvLyAuLi4gb3RoZXIgcHJvdmlkZXJzIC4uLlxuICogICBdXG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIEJ5IGRlZmF1bHQsIHdoZW4gdGhlcmUgaXMgb25seSBvbmUgYXBwbGljYXRpb24gYm9vdHN0cmFwcGVkLCB5b3UgZG9uJ3QgbmVlZCB0byBwcm92aWRlIHRoZVxuICogYEFQUF9JRGAgdG9rZW4gKHRoZSBgbmdgIHdpbGwgYmUgdXNlZCBhcyBhbiBhcHAgSUQpLlxuICpcbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGNvbnN0IEFQUF9JRCA9IG5ldyBJbmplY3Rpb25Ub2tlbjxzdHJpbmc+KG5nRGV2TW9kZSA/ICdBcHBJZCcgOiAnJywge1xuICBwcm92aWRlZEluOiAncm9vdCcsXG4gIGZhY3Rvcnk6ICgpID0+IERFRkFVTFRfQVBQX0lELFxufSk7XG5cbi8qKiBEZWZhdWx0IHZhbHVlIG9mIHRoZSBgQVBQX0lEYCB0b2tlbi4gKi9cbmNvbnN0IERFRkFVTFRfQVBQX0lEID0gJ25nJztcblxuLyoqXG4gKiBBIGZ1bmN0aW9uIHRoYXQgaXMgZXhlY3V0ZWQgd2hlbiBhIHBsYXRmb3JtIGlzIGluaXRpYWxpemVkLlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY29uc3QgUExBVEZPUk1fSU5JVElBTElaRVIgPSBuZXcgSW5qZWN0aW9uVG9rZW48UmVhZG9ubHlBcnJheTwoKSA9PiB2b2lkPj4oXG4gIG5nRGV2TW9kZSA/ICdQbGF0Zm9ybSBJbml0aWFsaXplcicgOiAnJyxcbik7XG5cbi8qKlxuICogQSB0b2tlbiB0aGF0IGluZGljYXRlcyBhbiBvcGFxdWUgcGxhdGZvcm0gSUQuXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBjb25zdCBQTEFURk9STV9JRCA9IG5ldyBJbmplY3Rpb25Ub2tlbjxPYmplY3Q+KG5nRGV2TW9kZSA/ICdQbGF0Zm9ybSBJRCcgOiAnJywge1xuICBwcm92aWRlZEluOiAncGxhdGZvcm0nLFxuICBmYWN0b3J5OiAoKSA9PiAndW5rbm93bicsIC8vIHNldCBhIGRlZmF1bHQgcGxhdGZvcm0gbmFtZSwgd2hlbiBub25lIHNldCBleHBsaWNpdGx5XG59KTtcblxuLyoqXG4gKiBBIERJIHRva2VuIHRoYXQgaW5kaWNhdGVzIHRoZSByb290IGRpcmVjdG9yeSBvZlxuICogdGhlIGFwcGxpY2F0aW9uXG4gKiBAcHVibGljQXBpXG4gKiBAZGVwcmVjYXRlZFxuICovXG5leHBvcnQgY29uc3QgUEFDS0FHRV9ST09UX1VSTCA9IG5ldyBJbmplY3Rpb25Ub2tlbjxzdHJpbmc+KFxuICBuZ0Rldk1vZGUgPyAnQXBwbGljYXRpb24gUGFja2FnZXMgUm9vdCBVUkwnIDogJycsXG4pO1xuXG4vLyBXZSBrZWVwIHRoaXMgdG9rZW4gaGVyZSwgcmF0aGVyIHRoYW4gdGhlIGFuaW1hdGlvbnMgcGFja2FnZSwgc28gdGhhdCBtb2R1bGVzIHRoYXQgb25seSBjYXJlXG4vLyBhYm91dCB3aGljaCBhbmltYXRpb25zIG1vZHVsZSBpcyBsb2FkZWQgKGUuZy4gdGhlIENESykgY2FuIHJldHJpZXZlIGl0IHdpdGhvdXQgaGF2aW5nIHRvXG4vLyBpbmNsdWRlIGV4dHJhIGRlcGVuZGVuY2llcy4gU2VlICM0NDk3MCBmb3IgbW9yZSBjb250ZXh0LlxuXG4vKipcbiAqIEEgW0RJIHRva2VuXShhcGkvY29yZS9JbmplY3Rpb25Ub2tlbikgdGhhdCBpbmRpY2F0ZXMgd2hpY2ggYW5pbWF0aW9uc1xuICogbW9kdWxlIGhhcyBiZWVuIGxvYWRlZC5cbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IGNvbnN0IEFOSU1BVElPTl9NT0RVTEVfVFlQRSA9IG5ldyBJbmplY3Rpb25Ub2tlbjwnTm9vcEFuaW1hdGlvbnMnIHwgJ0Jyb3dzZXJBbmltYXRpb25zJz4oXG4gIG5nRGV2TW9kZSA/ICdBbmltYXRpb25Nb2R1bGVUeXBlJyA6ICcnLFxuKTtcblxuLy8gVE9ETyhjcmlzYmV0byk6IGxpbmsgdG8gQ1NQIGd1aWRlIGhlcmUuXG4vKipcbiAqIFRva2VuIHVzZWQgdG8gY29uZmlndXJlIHRoZSBbQ29udGVudCBTZWN1cml0eSBQb2xpY3ldKGh0dHBzOi8vd2ViLmRldi9zdHJpY3QtY3NwLykgbm9uY2UgdGhhdFxuICogQW5ndWxhciB3aWxsIGFwcGx5IHdoZW4gaW5zZXJ0aW5nIGlubGluZSBzdHlsZXMuIElmIG5vdCBwcm92aWRlZCwgQW5ndWxhciB3aWxsIGxvb2sgdXAgaXRzIHZhbHVlXG4gKiBmcm9tIHRoZSBgbmdDc3BOb25jZWAgYXR0cmlidXRlIG9mIHRoZSBhcHBsaWNhdGlvbiByb290IG5vZGUuXG4gKlxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY29uc3QgQ1NQX05PTkNFID0gbmV3IEluamVjdGlvblRva2VuPHN0cmluZyB8IG51bGw+KG5nRGV2TW9kZSA/ICdDU1Agbm9uY2UnIDogJycsIHtcbiAgcHJvdmlkZWRJbjogJ3Jvb3QnLFxuICBmYWN0b3J5OiAoKSA9PiB7XG4gICAgLy8gSWRlYWxseSB3ZSB3b3VsZG4ndCBoYXZlIHRvIHVzZSBgcXVlcnlTZWxlY3RvcmAgaGVyZSBzaW5jZSB3ZSBrbm93IHRoYXQgdGhlIG5vbmNlIHdpbGwgYmUgb25cbiAgICAvLyB0aGUgcm9vdCBub2RlLCBidXQgYmVjYXVzZSB0aGUgdG9rZW4gdmFsdWUgaXMgdXNlZCBpbiByZW5kZXJlcnMsIGl0IGhhcyB0byBiZSBhdmFpbGFibGVcbiAgICAvLyAqdmVyeSogZWFybHkgaW4gdGhlIGJvb3RzdHJhcHBpbmcgcHJvY2Vzcy4gVGhpcyBzaG91bGQgYmUgYSBmYWlybHkgc2hhbGxvdyBzZWFyY2gsIGJlY2F1c2VcbiAgICAvLyB0aGUgYXBwIHdvbid0IGhhdmUgYmVlbiBhZGRlZCB0byB0aGUgRE9NIHlldC4gU29tZSBhcHByb2FjaGVzIHRoYXQgd2VyZSBjb25zaWRlcmVkOlxuICAgIC8vIDEuIEZpbmQgdGhlIHJvb3Qgbm9kZSB0aHJvdWdoIGBBcHBsaWNhdGlvblJlZi5jb21wb25lbnRzW2ldLmxvY2F0aW9uYCAtIG5vcm1hbGx5IHRoaXMgd291bGRcbiAgICAvLyBiZSBlbm91Z2ggZm9yIG91ciBwdXJwb3NlcywgYnV0IHRoZSB0b2tlbiBpcyBpbmplY3RlZCB2ZXJ5IGVhcmx5IHNvIHRoZSBgY29tcG9uZW50c2AgYXJyYXlcbiAgICAvLyBpc24ndCBwb3B1bGF0ZWQgeWV0LlxuICAgIC8vIDIuIEZpbmQgdGhlIHJvb3QgYExWaWV3YCB0aHJvdWdoIHRoZSBjdXJyZW50IGBMVmlld2AgLSByZW5kZXJlcnMgYXJlIGEgcHJlcmVxdWlzaXRlIHRvXG4gICAgLy8gY3JlYXRpbmcgdGhlIGBMVmlld2AuIFRoaXMgbWVhbnMgdGhhdCBubyBgTFZpZXdgIHdpbGwgaGF2ZSBiZWVuIGVudGVyZWQgd2hlbiB0aGlzIGZhY3RvcnkgaXNcbiAgICAvLyBpbnZva2VkIGZvciB0aGUgcm9vdCBjb21wb25lbnQuXG4gICAgLy8gMy4gSGF2ZSB0aGUgdG9rZW4gZmFjdG9yeSByZXR1cm4gYCgpID0+IHN0cmluZ2Agd2hpY2ggaXMgaW52b2tlZCB3aGVuIGEgbm9uY2UgaXMgcmVxdWVzdGVkIC1cbiAgICAvLyB0aGUgc2xpZ2h0bHkgbGF0ZXIgZXhlY3V0aW9uIGRvZXMgYWxsb3cgdXMgdG8gZ2V0IGFuIGBMVmlld2AgcmVmZXJlbmNlLCBidXQgdGhlIGZhY3QgdGhhdFxuICAgIC8vIGl0IGlzIGEgZnVuY3Rpb24gbWVhbnMgdGhhdCBpdCBjb3VsZCBiZSBleGVjdXRlZCBhdCAqYW55KiB0aW1lIChpbmNsdWRpbmcgaW1tZWRpYXRlbHkpIHdoaWNoXG4gICAgLy8gbWF5IGxlYWQgdG8gd2VpcmQgYnVncy5cbiAgICAvLyA0LiBIYXZlIHRoZSBgQ29tcG9uZW50RmFjdG9yeWAgcmVhZCB0aGUgYXR0cmlidXRlIGFuZCBwcm92aWRlIGl0IHRvIHRoZSBpbmplY3RvciB1bmRlciB0aGVcbiAgICAvLyBob29kIC0gaGFzIHRoZSBzYW1lIHByb2JsZW0gYXMgIzEgYW5kICMyIGluIHRoYXQgdGhlIHJlbmRlcmVyIGlzIHVzZWQgdG8gcXVlcnkgZm9yIHRoZSByb290XG4gICAgLy8gbm9kZSBhbmQgdGhlIG5vbmNlIHZhbHVlIG5lZWRzIHRvIGJlIGF2YWlsYWJsZSB3aGVuIHRoZSByZW5kZXJlciBpcyBjcmVhdGVkLlxuICAgIHJldHVybiBnZXREb2N1bWVudCgpLmJvZHk/LnF1ZXJ5U2VsZWN0b3IoJ1tuZ0NzcE5vbmNlXScpPy5nZXRBdHRyaWJ1dGUoJ25nQ3NwTm9uY2UnKSB8fCBudWxsO1xuICB9LFxufSk7XG5cbi8qKlxuICogQSBjb25maWd1cmF0aW9uIG9iamVjdCBmb3IgdGhlIGltYWdlLXJlbGF0ZWQgb3B0aW9ucy4gQ29udGFpbnM6XG4gKiAtIGJyZWFrcG9pbnRzOiBBbiBhcnJheSBvZiBpbnRlZ2VyIGJyZWFrcG9pbnRzIHVzZWQgdG8gZ2VuZXJhdGVcbiAqICAgICAgc3Jjc2V0cyBmb3IgcmVzcG9uc2l2ZSBpbWFnZXMuXG4gKiAtIGRpc2FibGVJbWFnZVNpemVXYXJuaW5nOiBBIGJvb2xlYW4gdmFsdWUuIFNldHRpbmcgdGhpcyB0byB0cnVlIHdpbGxcbiAqICAgICAgZGlzYWJsZSBjb25zb2xlIHdhcm5pbmdzIGFib3V0IG92ZXJzaXplZCBpbWFnZXMuXG4gKiAtIGRpc2FibGVJbWFnZUxhenlMb2FkV2FybmluZzogQSBib29sZWFuIHZhbHVlLiBTZXR0aW5nIHRoaXMgdG8gdHJ1ZSB3aWxsXG4gKiAgICAgIGRpc2FibGUgY29uc29sZSB3YXJuaW5ncyBhYm91dCBMQ1AgaW1hZ2VzIGNvbmZpZ3VyZWQgd2l0aCBgbG9hZGluZz1cImxhenlcImAuXG4gKiBMZWFybiBtb3JlIGFib3V0IHRoZSByZXNwb25zaXZlIGltYWdlIGNvbmZpZ3VyYXRpb24gaW4gW3RoZSBOZ09wdGltaXplZEltYWdlXG4gKiBndWlkZV0oZ3VpZGUvaW1hZ2Utb3B0aW1pemF0aW9uKS5cbiAqIExlYXJuIG1vcmUgYWJvdXQgaW1hZ2Ugd2FybmluZyBvcHRpb25zIGluIFt0aGUgcmVsYXRlZCBlcnJvciBwYWdlXShlcnJvcnMvTkcwOTEzKS5cbiAqIEBwdWJsaWNBcGlcbiAqL1xuZXhwb3J0IHR5cGUgSW1hZ2VDb25maWcgPSB7XG4gIGJyZWFrcG9pbnRzPzogbnVtYmVyW107XG4gIHBsYWNlaG9sZGVyUmVzb2x1dGlvbj86IG51bWJlcjtcbiAgZGlzYWJsZUltYWdlU2l6ZVdhcm5pbmc/OiBib29sZWFuO1xuICBkaXNhYmxlSW1hZ2VMYXp5TG9hZFdhcm5pbmc/OiBib29sZWFuO1xufTtcblxuZXhwb3J0IGNvbnN0IElNQUdFX0NPTkZJR19ERUZBVUxUUzogSW1hZ2VDb25maWcgPSB7XG4gIGJyZWFrcG9pbnRzOiBbMTYsIDMyLCA0OCwgNjQsIDk2LCAxMjgsIDI1NiwgMzg0LCA2NDAsIDc1MCwgODI4LCAxMDgwLCAxMjAwLCAxOTIwLCAyMDQ4LCAzODQwXSxcbiAgcGxhY2Vob2xkZXJSZXNvbHV0aW9uOiAzMCxcbiAgZGlzYWJsZUltYWdlU2l6ZVdhcm5pbmc6IGZhbHNlLFxuICBkaXNhYmxlSW1hZ2VMYXp5TG9hZFdhcm5pbmc6IGZhbHNlLFxufTtcblxuLyoqXG4gKiBJbmplY3Rpb24gdG9rZW4gdGhhdCBjb25maWd1cmVzIHRoZSBpbWFnZSBvcHRpbWl6ZWQgaW1hZ2UgZnVuY3Rpb25hbGl0eS5cbiAqIFNlZSB7QGxpbmsgSW1hZ2VDb25maWd9IGZvciBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIGFib3V0IHBhcmFtZXRlcnMgdGhhdFxuICogY2FuIGJlIHVzZWQuXG4gKlxuICogQHNlZSB7QGxpbmsgTmdPcHRpbWl6ZWRJbWFnZX1cbiAqIEBzZWUge0BsaW5rIEltYWdlQ29uZmlnfVxuICogQHB1YmxpY0FwaVxuICovXG5leHBvcnQgY29uc3QgSU1BR0VfQ09ORklHID0gbmV3IEluamVjdGlvblRva2VuPEltYWdlQ29uZmlnPihuZ0Rldk1vZGUgPyAnSW1hZ2VDb25maWcnIDogJycsIHtcbiAgcHJvdmlkZWRJbjogJ3Jvb3QnLFxuICBmYWN0b3J5OiAoKSA9PiBJTUFHRV9DT05GSUdfREVGQVVMVFMsXG59KTtcbiJdfQ==