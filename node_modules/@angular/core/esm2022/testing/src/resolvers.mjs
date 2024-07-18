/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Component, Directive, NgModule, Pipe, ɵReflectionCapabilities as ReflectionCapabilities, } from '@angular/core';
import { MetadataOverrider } from './metadata_overrider';
const reflection = new ReflectionCapabilities();
/**
 * Allows to override ivy metadata for tests (via the `TestBed`).
 */
class OverrideResolver {
    constructor() {
        this.overrides = new Map();
        this.resolved = new Map();
    }
    addOverride(type, override) {
        const overrides = this.overrides.get(type) || [];
        overrides.push(override);
        this.overrides.set(type, overrides);
        this.resolved.delete(type);
    }
    setOverrides(overrides) {
        this.overrides.clear();
        overrides.forEach(([type, override]) => {
            this.addOverride(type, override);
        });
    }
    getAnnotation(type) {
        const annotations = reflection.annotations(type);
        // Try to find the nearest known Type annotation and make sure that this annotation is an
        // instance of the type we are looking for, so we can use it for resolution. Note: there might
        // be multiple known annotations found due to the fact that Components can extend Directives (so
        // both Directive and Component annotations would be present), so we always check if the known
        // annotation has the right type.
        for (let i = annotations.length - 1; i >= 0; i--) {
            const annotation = annotations[i];
            const isKnownType = annotation instanceof Directive ||
                annotation instanceof Component ||
                annotation instanceof Pipe ||
                annotation instanceof NgModule;
            if (isKnownType) {
                return annotation instanceof this.type ? annotation : null;
            }
        }
        return null;
    }
    resolve(type) {
        let resolved = this.resolved.get(type) || null;
        if (!resolved) {
            resolved = this.getAnnotation(type);
            if (resolved) {
                const overrides = this.overrides.get(type);
                if (overrides) {
                    const overrider = new MetadataOverrider();
                    overrides.forEach((override) => {
                        resolved = overrider.overrideMetadata(this.type, resolved, override);
                    });
                }
            }
            this.resolved.set(type, resolved);
        }
        return resolved;
    }
}
export class DirectiveResolver extends OverrideResolver {
    get type() {
        return Directive;
    }
}
export class ComponentResolver extends OverrideResolver {
    get type() {
        return Component;
    }
}
export class PipeResolver extends OverrideResolver {
    get type() {
        return Pipe;
    }
}
export class NgModuleResolver extends OverrideResolver {
    get type() {
        return NgModule;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS90ZXN0aW5nL3NyYy9yZXNvbHZlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUNMLFNBQVMsRUFDVCxTQUFTLEVBQ1QsUUFBUSxFQUNSLElBQUksRUFFSix1QkFBdUIsSUFBSSxzQkFBc0IsR0FDbEQsTUFBTSxlQUFlLENBQUM7QUFHdkIsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFFdkQsTUFBTSxVQUFVLEdBQUcsSUFBSSxzQkFBc0IsRUFBRSxDQUFDO0FBV2hEOztHQUVHO0FBQ0gsTUFBZSxnQkFBZ0I7SUFBL0I7UUFDVSxjQUFTLEdBQUcsSUFBSSxHQUFHLEVBQW9DLENBQUM7UUFDeEQsYUFBUSxHQUFHLElBQUksR0FBRyxFQUF1QixDQUFDO0lBMERwRCxDQUFDO0lBdERDLFdBQVcsQ0FBQyxJQUFlLEVBQUUsUUFBNkI7UUFDeEQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2pELFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDekIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3BDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFFRCxZQUFZLENBQUMsU0FBa0Q7UUFDN0QsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUN2QixTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRTtZQUNyQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNuQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxhQUFhLENBQUMsSUFBZTtRQUMzQixNQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2pELHlGQUF5RjtRQUN6Riw4RkFBOEY7UUFDOUYsZ0dBQWdHO1FBQ2hHLDhGQUE4RjtRQUM5RixpQ0FBaUM7UUFDakMsS0FBSyxJQUFJLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDakQsTUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2xDLE1BQU0sV0FBVyxHQUNmLFVBQVUsWUFBWSxTQUFTO2dCQUMvQixVQUFVLFlBQVksU0FBUztnQkFDL0IsVUFBVSxZQUFZLElBQUk7Z0JBQzFCLFVBQVUsWUFBWSxRQUFRLENBQUM7WUFDakMsSUFBSSxXQUFXLEVBQUUsQ0FBQztnQkFDaEIsT0FBTyxVQUFVLFlBQVksSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUUsVUFBMkIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQy9FLENBQUM7UUFDSCxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsT0FBTyxDQUFDLElBQWU7UUFDckIsSUFBSSxRQUFRLEdBQWEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDO1FBRXpELElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNkLFFBQVEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3BDLElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQ2IsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzNDLElBQUksU0FBUyxFQUFFLENBQUM7b0JBQ2QsTUFBTSxTQUFTLEdBQUcsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO29CQUMxQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUU7d0JBQzdCLFFBQVEsR0FBRyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxRQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7b0JBQ3hFLENBQUMsQ0FBQyxDQUFDO2dCQUNMLENBQUM7WUFDSCxDQUFDO1lBQ0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3BDLENBQUM7UUFFRCxPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8saUJBQWtCLFNBQVEsZ0JBQTJCO0lBQ2hFLElBQWEsSUFBSTtRQUNmLE9BQU8sU0FBUyxDQUFDO0lBQ25CLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxpQkFBa0IsU0FBUSxnQkFBMkI7SUFDaEUsSUFBYSxJQUFJO1FBQ2YsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztDQUNGO0FBRUQsTUFBTSxPQUFPLFlBQWEsU0FBUSxnQkFBc0I7SUFDdEQsSUFBYSxJQUFJO1FBQ2YsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sZ0JBQWlCLFNBQVEsZ0JBQTBCO0lBQzlELElBQWEsSUFBSTtRQUNmLE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBDb21wb25lbnQsXG4gIERpcmVjdGl2ZSxcbiAgTmdNb2R1bGUsXG4gIFBpcGUsXG4gIFR5cGUsXG4gIMm1UmVmbGVjdGlvbkNhcGFiaWxpdGllcyBhcyBSZWZsZWN0aW9uQ2FwYWJpbGl0aWVzLFxufSBmcm9tICdAYW5ndWxhci9jb3JlJztcblxuaW1wb3J0IHtNZXRhZGF0YU92ZXJyaWRlfSBmcm9tICcuL21ldGFkYXRhX292ZXJyaWRlJztcbmltcG9ydCB7TWV0YWRhdGFPdmVycmlkZXJ9IGZyb20gJy4vbWV0YWRhdGFfb3ZlcnJpZGVyJztcblxuY29uc3QgcmVmbGVjdGlvbiA9IG5ldyBSZWZsZWN0aW9uQ2FwYWJpbGl0aWVzKCk7XG5cbi8qKlxuICogQmFzZSBpbnRlcmZhY2UgdG8gcmVzb2x2ZSBgQENvbXBvbmVudGAsIGBARGlyZWN0aXZlYCwgYEBQaXBlYCBhbmQgYEBOZ01vZHVsZWAuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmVzb2x2ZXI8VD4ge1xuICBhZGRPdmVycmlkZSh0eXBlOiBUeXBlPGFueT4sIG92ZXJyaWRlOiBNZXRhZGF0YU92ZXJyaWRlPFQ+KTogdm9pZDtcbiAgc2V0T3ZlcnJpZGVzKG92ZXJyaWRlczogQXJyYXk8W1R5cGU8YW55PiwgTWV0YWRhdGFPdmVycmlkZTxUPl0+KTogdm9pZDtcbiAgcmVzb2x2ZSh0eXBlOiBUeXBlPGFueT4pOiBUIHwgbnVsbDtcbn1cblxuLyoqXG4gKiBBbGxvd3MgdG8gb3ZlcnJpZGUgaXZ5IG1ldGFkYXRhIGZvciB0ZXN0cyAodmlhIHRoZSBgVGVzdEJlZGApLlxuICovXG5hYnN0cmFjdCBjbGFzcyBPdmVycmlkZVJlc29sdmVyPFQ+IGltcGxlbWVudHMgUmVzb2x2ZXI8VD4ge1xuICBwcml2YXRlIG92ZXJyaWRlcyA9IG5ldyBNYXA8VHlwZTxhbnk+LCBNZXRhZGF0YU92ZXJyaWRlPFQ+W10+KCk7XG4gIHByaXZhdGUgcmVzb2x2ZWQgPSBuZXcgTWFwPFR5cGU8YW55PiwgVCB8IG51bGw+KCk7XG5cbiAgYWJzdHJhY3QgZ2V0IHR5cGUoKTogYW55O1xuXG4gIGFkZE92ZXJyaWRlKHR5cGU6IFR5cGU8YW55Piwgb3ZlcnJpZGU6IE1ldGFkYXRhT3ZlcnJpZGU8VD4pIHtcbiAgICBjb25zdCBvdmVycmlkZXMgPSB0aGlzLm92ZXJyaWRlcy5nZXQodHlwZSkgfHwgW107XG4gICAgb3ZlcnJpZGVzLnB1c2gob3ZlcnJpZGUpO1xuICAgIHRoaXMub3ZlcnJpZGVzLnNldCh0eXBlLCBvdmVycmlkZXMpO1xuICAgIHRoaXMucmVzb2x2ZWQuZGVsZXRlKHR5cGUpO1xuICB9XG5cbiAgc2V0T3ZlcnJpZGVzKG92ZXJyaWRlczogQXJyYXk8W1R5cGU8YW55PiwgTWV0YWRhdGFPdmVycmlkZTxUPl0+KSB7XG4gICAgdGhpcy5vdmVycmlkZXMuY2xlYXIoKTtcbiAgICBvdmVycmlkZXMuZm9yRWFjaCgoW3R5cGUsIG92ZXJyaWRlXSkgPT4ge1xuICAgICAgdGhpcy5hZGRPdmVycmlkZSh0eXBlLCBvdmVycmlkZSk7XG4gICAgfSk7XG4gIH1cblxuICBnZXRBbm5vdGF0aW9uKHR5cGU6IFR5cGU8YW55Pik6IFQgfCBudWxsIHtcbiAgICBjb25zdCBhbm5vdGF0aW9ucyA9IHJlZmxlY3Rpb24uYW5ub3RhdGlvbnModHlwZSk7XG4gICAgLy8gVHJ5IHRvIGZpbmQgdGhlIG5lYXJlc3Qga25vd24gVHlwZSBhbm5vdGF0aW9uIGFuZCBtYWtlIHN1cmUgdGhhdCB0aGlzIGFubm90YXRpb24gaXMgYW5cbiAgICAvLyBpbnN0YW5jZSBvZiB0aGUgdHlwZSB3ZSBhcmUgbG9va2luZyBmb3IsIHNvIHdlIGNhbiB1c2UgaXQgZm9yIHJlc29sdXRpb24uIE5vdGU6IHRoZXJlIG1pZ2h0XG4gICAgLy8gYmUgbXVsdGlwbGUga25vd24gYW5ub3RhdGlvbnMgZm91bmQgZHVlIHRvIHRoZSBmYWN0IHRoYXQgQ29tcG9uZW50cyBjYW4gZXh0ZW5kIERpcmVjdGl2ZXMgKHNvXG4gICAgLy8gYm90aCBEaXJlY3RpdmUgYW5kIENvbXBvbmVudCBhbm5vdGF0aW9ucyB3b3VsZCBiZSBwcmVzZW50KSwgc28gd2UgYWx3YXlzIGNoZWNrIGlmIHRoZSBrbm93blxuICAgIC8vIGFubm90YXRpb24gaGFzIHRoZSByaWdodCB0eXBlLlxuICAgIGZvciAobGV0IGkgPSBhbm5vdGF0aW9ucy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgY29uc3QgYW5ub3RhdGlvbiA9IGFubm90YXRpb25zW2ldO1xuICAgICAgY29uc3QgaXNLbm93blR5cGUgPVxuICAgICAgICBhbm5vdGF0aW9uIGluc3RhbmNlb2YgRGlyZWN0aXZlIHx8XG4gICAgICAgIGFubm90YXRpb24gaW5zdGFuY2VvZiBDb21wb25lbnQgfHxcbiAgICAgICAgYW5ub3RhdGlvbiBpbnN0YW5jZW9mIFBpcGUgfHxcbiAgICAgICAgYW5ub3RhdGlvbiBpbnN0YW5jZW9mIE5nTW9kdWxlO1xuICAgICAgaWYgKGlzS25vd25UeXBlKSB7XG4gICAgICAgIHJldHVybiBhbm5vdGF0aW9uIGluc3RhbmNlb2YgdGhpcy50eXBlID8gKGFubm90YXRpb24gYXMgdW5rbm93biBhcyBUKSA6IG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmVzb2x2ZSh0eXBlOiBUeXBlPGFueT4pOiBUIHwgbnVsbCB7XG4gICAgbGV0IHJlc29sdmVkOiBUIHwgbnVsbCA9IHRoaXMucmVzb2x2ZWQuZ2V0KHR5cGUpIHx8IG51bGw7XG5cbiAgICBpZiAoIXJlc29sdmVkKSB7XG4gICAgICByZXNvbHZlZCA9IHRoaXMuZ2V0QW5ub3RhdGlvbih0eXBlKTtcbiAgICAgIGlmIChyZXNvbHZlZCkge1xuICAgICAgICBjb25zdCBvdmVycmlkZXMgPSB0aGlzLm92ZXJyaWRlcy5nZXQodHlwZSk7XG4gICAgICAgIGlmIChvdmVycmlkZXMpIHtcbiAgICAgICAgICBjb25zdCBvdmVycmlkZXIgPSBuZXcgTWV0YWRhdGFPdmVycmlkZXIoKTtcbiAgICAgICAgICBvdmVycmlkZXMuZm9yRWFjaCgob3ZlcnJpZGUpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmVkID0gb3ZlcnJpZGVyLm92ZXJyaWRlTWV0YWRhdGEodGhpcy50eXBlLCByZXNvbHZlZCEsIG92ZXJyaWRlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5yZXNvbHZlZC5zZXQodHlwZSwgcmVzb2x2ZWQpO1xuICAgIH1cblxuICAgIHJldHVybiByZXNvbHZlZDtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRGlyZWN0aXZlUmVzb2x2ZXIgZXh0ZW5kcyBPdmVycmlkZVJlc29sdmVyPERpcmVjdGl2ZT4ge1xuICBvdmVycmlkZSBnZXQgdHlwZSgpIHtcbiAgICByZXR1cm4gRGlyZWN0aXZlO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBDb21wb25lbnRSZXNvbHZlciBleHRlbmRzIE92ZXJyaWRlUmVzb2x2ZXI8Q29tcG9uZW50PiB7XG4gIG92ZXJyaWRlIGdldCB0eXBlKCkge1xuICAgIHJldHVybiBDb21wb25lbnQ7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBpcGVSZXNvbHZlciBleHRlbmRzIE92ZXJyaWRlUmVzb2x2ZXI8UGlwZT4ge1xuICBvdmVycmlkZSBnZXQgdHlwZSgpIHtcbiAgICByZXR1cm4gUGlwZTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgTmdNb2R1bGVSZXNvbHZlciBleHRlbmRzIE92ZXJyaWRlUmVzb2x2ZXI8TmdNb2R1bGU+IHtcbiAgb3ZlcnJpZGUgZ2V0IHR5cGUoKSB7XG4gICAgcmV0dXJuIE5nTW9kdWxlO1xuICB9XG59XG4iXX0=