/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { global } from '../util/global';
export * from './compiler_facade_interface';
export function getCompilerFacade(request) {
    const globalNg = global['ng'];
    if (globalNg && globalNg.ɵcompilerFacade) {
        return globalNg.ɵcompilerFacade;
    }
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
        // Log the type as an error so that a developer can easily navigate to the type from the
        // console.
        console.error(`JIT compilation failed for ${request.kind}`, request.type);
        let message = `The ${request.kind} '${request.type.name}' needs to be compiled using the JIT compiler, but '@angular/compiler' is not available.\n\n`;
        if (request.usage === 1 /* JitCompilerUsage.PartialDeclaration */) {
            message += `The ${request.kind} is part of a library that has been partially compiled.\n`;
            message += `However, the Angular Linker has not processed the library such that JIT compilation is used as fallback.\n`;
            message += '\n';
            message += `Ideally, the library is processed using the Angular Linker to become fully AOT compiled.\n`;
        }
        else {
            message += `JIT compilation is discouraged for production use-cases! Consider using AOT mode instead.\n`;
        }
        message += `Alternatively, the JIT compiler should be loaded by bootstrapping using '@angular/platform-browser-dynamic' or '@angular/platform-server',\n`;
        message += `or manually provide the compiler with 'import "@angular/compiler";' before bootstrapping.`;
        throw new Error(message);
    }
    else {
        throw new Error('JIT compiler unavailable');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXJfZmFjYWRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvY29tcGlsZXIvY29tcGlsZXJfZmFjYWRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUNILE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUV0QyxjQUFjLDZCQUE2QixDQUFDO0FBYTVDLE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxPQUFnQztJQUNoRSxNQUFNLFFBQVEsR0FBMkIsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3RELElBQUksUUFBUSxJQUFJLFFBQVEsQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUN6QyxPQUFPLFFBQVEsQ0FBQyxlQUFlLENBQUM7SUFDbEMsQ0FBQztJQUVELElBQUksT0FBTyxTQUFTLEtBQUssV0FBVyxJQUFJLFNBQVMsRUFBRSxDQUFDO1FBQ2xELHdGQUF3RjtRQUN4RixXQUFXO1FBQ1gsT0FBTyxDQUFDLEtBQUssQ0FBQyw4QkFBOEIsT0FBTyxDQUFDLElBQUksRUFBRSxFQUFFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUxRSxJQUFJLE9BQU8sR0FBRyxPQUFPLE9BQU8sQ0FBQyxJQUFJLEtBQUssT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLDhGQUE4RixDQUFDO1FBQ3RKLElBQUksT0FBTyxDQUFDLEtBQUssZ0RBQXdDLEVBQUUsQ0FBQztZQUMxRCxPQUFPLElBQUksT0FBTyxPQUFPLENBQUMsSUFBSSwyREFBMkQsQ0FBQztZQUMxRixPQUFPLElBQUksNEdBQTRHLENBQUM7WUFDeEgsT0FBTyxJQUFJLElBQUksQ0FBQztZQUNoQixPQUFPLElBQUksNEZBQTRGLENBQUM7UUFDMUcsQ0FBQzthQUFNLENBQUM7WUFDTixPQUFPLElBQUksNkZBQTZGLENBQUM7UUFDM0csQ0FBQztRQUNELE9BQU8sSUFBSSw4SUFBOEksQ0FBQztRQUMxSixPQUFPLElBQUksMkZBQTJGLENBQUM7UUFDdkcsTUFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUMzQixDQUFDO1NBQU0sQ0FBQztRQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMsMEJBQTBCLENBQUMsQ0FBQztJQUM5QyxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtnbG9iYWx9IGZyb20gJy4uL3V0aWwvZ2xvYmFsJztcbmltcG9ydCB7Q29tcGlsZXJGYWNhZGUsIEV4cG9ydGVkQ29tcGlsZXJGYWNhZGUsIFR5cGV9IGZyb20gJy4vY29tcGlsZXJfZmFjYWRlX2ludGVyZmFjZSc7XG5leHBvcnQgKiBmcm9tICcuL2NvbXBpbGVyX2ZhY2FkZV9pbnRlcmZhY2UnO1xuXG5leHBvcnQgY29uc3QgZW51bSBKaXRDb21waWxlclVzYWdlIHtcbiAgRGVjb3JhdG9yLFxuICBQYXJ0aWFsRGVjbGFyYXRpb24sXG59XG5cbmludGVyZmFjZSBKaXRDb21waWxlclVzYWdlUmVxdWVzdCB7XG4gIHVzYWdlOiBKaXRDb21waWxlclVzYWdlO1xuICBraW5kOiAnZGlyZWN0aXZlJyB8ICdjb21wb25lbnQnIHwgJ3BpcGUnIHwgJ2luamVjdGFibGUnIHwgJ05nTW9kdWxlJztcbiAgdHlwZTogVHlwZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENvbXBpbGVyRmFjYWRlKHJlcXVlc3Q6IEppdENvbXBpbGVyVXNhZ2VSZXF1ZXN0KTogQ29tcGlsZXJGYWNhZGUge1xuICBjb25zdCBnbG9iYWxOZzogRXhwb3J0ZWRDb21waWxlckZhY2FkZSA9IGdsb2JhbFsnbmcnXTtcbiAgaWYgKGdsb2JhbE5nICYmIGdsb2JhbE5nLsm1Y29tcGlsZXJGYWNhZGUpIHtcbiAgICByZXR1cm4gZ2xvYmFsTmcuybVjb21waWxlckZhY2FkZTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgbmdEZXZNb2RlID09PSAndW5kZWZpbmVkJyB8fCBuZ0Rldk1vZGUpIHtcbiAgICAvLyBMb2cgdGhlIHR5cGUgYXMgYW4gZXJyb3Igc28gdGhhdCBhIGRldmVsb3BlciBjYW4gZWFzaWx5IG5hdmlnYXRlIHRvIHRoZSB0eXBlIGZyb20gdGhlXG4gICAgLy8gY29uc29sZS5cbiAgICBjb25zb2xlLmVycm9yKGBKSVQgY29tcGlsYXRpb24gZmFpbGVkIGZvciAke3JlcXVlc3Qua2luZH1gLCByZXF1ZXN0LnR5cGUpO1xuXG4gICAgbGV0IG1lc3NhZ2UgPSBgVGhlICR7cmVxdWVzdC5raW5kfSAnJHtyZXF1ZXN0LnR5cGUubmFtZX0nIG5lZWRzIHRvIGJlIGNvbXBpbGVkIHVzaW5nIHRoZSBKSVQgY29tcGlsZXIsIGJ1dCAnQGFuZ3VsYXIvY29tcGlsZXInIGlzIG5vdCBhdmFpbGFibGUuXFxuXFxuYDtcbiAgICBpZiAocmVxdWVzdC51c2FnZSA9PT0gSml0Q29tcGlsZXJVc2FnZS5QYXJ0aWFsRGVjbGFyYXRpb24pIHtcbiAgICAgIG1lc3NhZ2UgKz0gYFRoZSAke3JlcXVlc3Qua2luZH0gaXMgcGFydCBvZiBhIGxpYnJhcnkgdGhhdCBoYXMgYmVlbiBwYXJ0aWFsbHkgY29tcGlsZWQuXFxuYDtcbiAgICAgIG1lc3NhZ2UgKz0gYEhvd2V2ZXIsIHRoZSBBbmd1bGFyIExpbmtlciBoYXMgbm90IHByb2Nlc3NlZCB0aGUgbGlicmFyeSBzdWNoIHRoYXQgSklUIGNvbXBpbGF0aW9uIGlzIHVzZWQgYXMgZmFsbGJhY2suXFxuYDtcbiAgICAgIG1lc3NhZ2UgKz0gJ1xcbic7XG4gICAgICBtZXNzYWdlICs9IGBJZGVhbGx5LCB0aGUgbGlicmFyeSBpcyBwcm9jZXNzZWQgdXNpbmcgdGhlIEFuZ3VsYXIgTGlua2VyIHRvIGJlY29tZSBmdWxseSBBT1QgY29tcGlsZWQuXFxuYDtcbiAgICB9IGVsc2Uge1xuICAgICAgbWVzc2FnZSArPSBgSklUIGNvbXBpbGF0aW9uIGlzIGRpc2NvdXJhZ2VkIGZvciBwcm9kdWN0aW9uIHVzZS1jYXNlcyEgQ29uc2lkZXIgdXNpbmcgQU9UIG1vZGUgaW5zdGVhZC5cXG5gO1xuICAgIH1cbiAgICBtZXNzYWdlICs9IGBBbHRlcm5hdGl2ZWx5LCB0aGUgSklUIGNvbXBpbGVyIHNob3VsZCBiZSBsb2FkZWQgYnkgYm9vdHN0cmFwcGluZyB1c2luZyAnQGFuZ3VsYXIvcGxhdGZvcm0tYnJvd3Nlci1keW5hbWljJyBvciAnQGFuZ3VsYXIvcGxhdGZvcm0tc2VydmVyJyxcXG5gO1xuICAgIG1lc3NhZ2UgKz0gYG9yIG1hbnVhbGx5IHByb3ZpZGUgdGhlIGNvbXBpbGVyIHdpdGggJ2ltcG9ydCBcIkBhbmd1bGFyL2NvbXBpbGVyXCI7JyBiZWZvcmUgYm9vdHN0cmFwcGluZy5gO1xuICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0pJVCBjb21waWxlciB1bmF2YWlsYWJsZScpO1xuICB9XG59XG4iXX0=