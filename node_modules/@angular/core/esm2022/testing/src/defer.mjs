/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ɵCONTAINER_HEADER_OFFSET as CONTAINER_HEADER_OFFSET, ɵDeferBlockState as DeferBlockState, ɵgetDeferBlocks as getDeferBlocks, ɵrenderDeferBlockState as renderDeferBlockState, ɵtriggerResourceLoading as triggerResourceLoading, } from '@angular/core';
/**
 * Represents an individual defer block for testing purposes.
 *
 * @publicApi
 */
export class DeferBlockFixture {
    /** @nodoc */
    constructor(block, componentFixture) {
        this.block = block;
        this.componentFixture = componentFixture;
    }
    /**
     * Renders the specified state of the defer fixture.
     * @param state the defer state to render
     */
    async render(state) {
        if (!hasStateTemplate(state, this.block)) {
            const stateAsString = getDeferBlockStateNameFromEnum(state);
            throw new Error(`Tried to render this defer block in the \`${stateAsString}\` state, ` +
                `but there was no @${stateAsString.toLowerCase()} block defined in a template.`);
        }
        if (state === DeferBlockState.Complete) {
            await triggerResourceLoading(this.block.tDetails, this.block.lView, this.block.tNode);
        }
        // If the `render` method is used explicitly - skip timer-based scheduling for
        // `@placeholder` and `@loading` blocks and render them immediately.
        const skipTimerScheduling = true;
        renderDeferBlockState(state, this.block.tNode, this.block.lContainer, skipTimerScheduling);
        this.componentFixture.detectChanges();
    }
    /**
     * Retrieves all nested child defer block fixtures
     * in a given defer block.
     */
    getDeferBlocks() {
        const deferBlocks = [];
        // An LContainer that represents a defer block has at most 1 view, which is
        // located right after an LContainer header. Get a hold of that view and inspect
        // it for nested defer blocks.
        const deferBlockFixtures = [];
        if (this.block.lContainer.length >= CONTAINER_HEADER_OFFSET) {
            const lView = this.block.lContainer[CONTAINER_HEADER_OFFSET];
            getDeferBlocks(lView, deferBlocks);
            for (const block of deferBlocks) {
                deferBlockFixtures.push(new DeferBlockFixture(block, this.componentFixture));
            }
        }
        return Promise.resolve(deferBlockFixtures);
    }
}
function hasStateTemplate(state, block) {
    switch (state) {
        case DeferBlockState.Placeholder:
            return block.tDetails.placeholderTmplIndex !== null;
        case DeferBlockState.Loading:
            return block.tDetails.loadingTmplIndex !== null;
        case DeferBlockState.Error:
            return block.tDetails.errorTmplIndex !== null;
        case DeferBlockState.Complete:
            return true;
        default:
            return false;
    }
}
function getDeferBlockStateNameFromEnum(state) {
    switch (state) {
        case DeferBlockState.Placeholder:
            return 'Placeholder';
        case DeferBlockState.Loading:
            return 'Loading';
        case DeferBlockState.Error:
            return 'Error';
        default:
            return 'Main';
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3Rlc3Rpbmcvc3JjL2RlZmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFDTCx3QkFBd0IsSUFBSSx1QkFBdUIsRUFFbkQsZ0JBQWdCLElBQUksZUFBZSxFQUNuQyxlQUFlLElBQUksY0FBYyxFQUNqQyxzQkFBc0IsSUFBSSxxQkFBcUIsRUFDL0MsdUJBQXVCLElBQUksc0JBQXNCLEdBQ2xELE1BQU0sZUFBZSxDQUFDO0FBSXZCOzs7O0dBSUc7QUFDSCxNQUFNLE9BQU8saUJBQWlCO0lBQzVCLGFBQWE7SUFDYixZQUNVLEtBQXdCLEVBQ3hCLGdCQUEyQztRQUQzQyxVQUFLLEdBQUwsS0FBSyxDQUFtQjtRQUN4QixxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQTJCO0lBQ2xELENBQUM7SUFFSjs7O09BR0c7SUFDSCxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQXNCO1FBQ2pDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDekMsTUFBTSxhQUFhLEdBQUcsOEJBQThCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDNUQsTUFBTSxJQUFJLEtBQUssQ0FDYiw2Q0FBNkMsYUFBYSxZQUFZO2dCQUNwRSxxQkFBcUIsYUFBYSxDQUFDLFdBQVcsRUFBRSwrQkFBK0IsQ0FDbEYsQ0FBQztRQUNKLENBQUM7UUFDRCxJQUFJLEtBQUssS0FBSyxlQUFlLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDdkMsTUFBTSxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3hGLENBQUM7UUFDRCw4RUFBOEU7UUFDOUUsb0VBQW9FO1FBQ3BFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDO1FBQ2pDLHFCQUFxQixDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBQzNGLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsQ0FBQztJQUN4QyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsY0FBYztRQUNaLE1BQU0sV0FBVyxHQUF3QixFQUFFLENBQUM7UUFDNUMsMkVBQTJFO1FBQzNFLGdGQUFnRjtRQUNoRiw4QkFBOEI7UUFDOUIsTUFBTSxrQkFBa0IsR0FBRyxFQUFFLENBQUM7UUFDOUIsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLElBQUksdUJBQXVCLEVBQUUsQ0FBQztZQUM1RCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1lBQzdELGNBQWMsQ0FBQyxLQUFLLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFDbkMsS0FBSyxNQUFNLEtBQUssSUFBSSxXQUFXLEVBQUUsQ0FBQztnQkFDaEMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksaUJBQWlCLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7WUFDL0UsQ0FBQztRQUNILENBQUM7UUFDRCxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUM3QyxDQUFDO0NBQ0Y7QUFFRCxTQUFTLGdCQUFnQixDQUFDLEtBQXNCLEVBQUUsS0FBd0I7SUFDeEUsUUFBUSxLQUFLLEVBQUUsQ0FBQztRQUNkLEtBQUssZUFBZSxDQUFDLFdBQVc7WUFDOUIsT0FBTyxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFvQixLQUFLLElBQUksQ0FBQztRQUN0RCxLQUFLLGVBQWUsQ0FBQyxPQUFPO1lBQzFCLE9BQU8sS0FBSyxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsS0FBSyxJQUFJLENBQUM7UUFDbEQsS0FBSyxlQUFlLENBQUMsS0FBSztZQUN4QixPQUFPLEtBQUssQ0FBQyxRQUFRLENBQUMsY0FBYyxLQUFLLElBQUksQ0FBQztRQUNoRCxLQUFLLGVBQWUsQ0FBQyxRQUFRO1lBQzNCLE9BQU8sSUFBSSxDQUFDO1FBQ2Q7WUFDRSxPQUFPLEtBQUssQ0FBQztJQUNqQixDQUFDO0FBQ0gsQ0FBQztBQUVELFNBQVMsOEJBQThCLENBQUMsS0FBc0I7SUFDNUQsUUFBUSxLQUFLLEVBQUUsQ0FBQztRQUNkLEtBQUssZUFBZSxDQUFDLFdBQVc7WUFDOUIsT0FBTyxhQUFhLENBQUM7UUFDdkIsS0FBSyxlQUFlLENBQUMsT0FBTztZQUMxQixPQUFPLFNBQVMsQ0FBQztRQUNuQixLQUFLLGVBQWUsQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sT0FBTyxDQUFDO1FBQ2pCO1lBQ0UsT0FBTyxNQUFNLENBQUM7SUFDbEIsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgybVDT05UQUlORVJfSEVBREVSX09GRlNFVCBhcyBDT05UQUlORVJfSEVBREVSX09GRlNFVCxcbiAgybVEZWZlckJsb2NrRGV0YWlscyBhcyBEZWZlckJsb2NrRGV0YWlscyxcbiAgybVEZWZlckJsb2NrU3RhdGUgYXMgRGVmZXJCbG9ja1N0YXRlLFxuICDJtWdldERlZmVyQmxvY2tzIGFzIGdldERlZmVyQmxvY2tzLFxuICDJtXJlbmRlckRlZmVyQmxvY2tTdGF0ZSBhcyByZW5kZXJEZWZlckJsb2NrU3RhdGUsXG4gIMm1dHJpZ2dlclJlc291cmNlTG9hZGluZyBhcyB0cmlnZ2VyUmVzb3VyY2VMb2FkaW5nLFxufSBmcm9tICdAYW5ndWxhci9jb3JlJztcblxuaW1wb3J0IHR5cGUge0NvbXBvbmVudEZpeHR1cmV9IGZyb20gJy4vY29tcG9uZW50X2ZpeHR1cmUnO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gaW5kaXZpZHVhbCBkZWZlciBibG9jayBmb3IgdGVzdGluZyBwdXJwb3Nlcy5cbiAqXG4gKiBAcHVibGljQXBpXG4gKi9cbmV4cG9ydCBjbGFzcyBEZWZlckJsb2NrRml4dHVyZSB7XG4gIC8qKiBAbm9kb2MgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBibG9jazogRGVmZXJCbG9ja0RldGFpbHMsXG4gICAgcHJpdmF0ZSBjb21wb25lbnRGaXh0dXJlOiBDb21wb25lbnRGaXh0dXJlPHVua25vd24+LFxuICApIHt9XG5cbiAgLyoqXG4gICAqIFJlbmRlcnMgdGhlIHNwZWNpZmllZCBzdGF0ZSBvZiB0aGUgZGVmZXIgZml4dHVyZS5cbiAgICogQHBhcmFtIHN0YXRlIHRoZSBkZWZlciBzdGF0ZSB0byByZW5kZXJcbiAgICovXG4gIGFzeW5jIHJlbmRlcihzdGF0ZTogRGVmZXJCbG9ja1N0YXRlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFoYXNTdGF0ZVRlbXBsYXRlKHN0YXRlLCB0aGlzLmJsb2NrKSkge1xuICAgICAgY29uc3Qgc3RhdGVBc1N0cmluZyA9IGdldERlZmVyQmxvY2tTdGF0ZU5hbWVGcm9tRW51bShzdGF0ZSk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBUcmllZCB0byByZW5kZXIgdGhpcyBkZWZlciBibG9jayBpbiB0aGUgXFxgJHtzdGF0ZUFzU3RyaW5nfVxcYCBzdGF0ZSwgYCArXG4gICAgICAgICAgYGJ1dCB0aGVyZSB3YXMgbm8gQCR7c3RhdGVBc1N0cmluZy50b0xvd2VyQ2FzZSgpfSBibG9jayBkZWZpbmVkIGluIGEgdGVtcGxhdGUuYCxcbiAgICAgICk7XG4gICAgfVxuICAgIGlmIChzdGF0ZSA9PT0gRGVmZXJCbG9ja1N0YXRlLkNvbXBsZXRlKSB7XG4gICAgICBhd2FpdCB0cmlnZ2VyUmVzb3VyY2VMb2FkaW5nKHRoaXMuYmxvY2sudERldGFpbHMsIHRoaXMuYmxvY2subFZpZXcsIHRoaXMuYmxvY2sudE5vZGUpO1xuICAgIH1cbiAgICAvLyBJZiB0aGUgYHJlbmRlcmAgbWV0aG9kIGlzIHVzZWQgZXhwbGljaXRseSAtIHNraXAgdGltZXItYmFzZWQgc2NoZWR1bGluZyBmb3JcbiAgICAvLyBgQHBsYWNlaG9sZGVyYCBhbmQgYEBsb2FkaW5nYCBibG9ja3MgYW5kIHJlbmRlciB0aGVtIGltbWVkaWF0ZWx5LlxuICAgIGNvbnN0IHNraXBUaW1lclNjaGVkdWxpbmcgPSB0cnVlO1xuICAgIHJlbmRlckRlZmVyQmxvY2tTdGF0ZShzdGF0ZSwgdGhpcy5ibG9jay50Tm9kZSwgdGhpcy5ibG9jay5sQ29udGFpbmVyLCBza2lwVGltZXJTY2hlZHVsaW5nKTtcbiAgICB0aGlzLmNvbXBvbmVudEZpeHR1cmUuZGV0ZWN0Q2hhbmdlcygpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyBhbGwgbmVzdGVkIGNoaWxkIGRlZmVyIGJsb2NrIGZpeHR1cmVzXG4gICAqIGluIGEgZ2l2ZW4gZGVmZXIgYmxvY2suXG4gICAqL1xuICBnZXREZWZlckJsb2NrcygpOiBQcm9taXNlPERlZmVyQmxvY2tGaXh0dXJlW10+IHtcbiAgICBjb25zdCBkZWZlckJsb2NrczogRGVmZXJCbG9ja0RldGFpbHNbXSA9IFtdO1xuICAgIC8vIEFuIExDb250YWluZXIgdGhhdCByZXByZXNlbnRzIGEgZGVmZXIgYmxvY2sgaGFzIGF0IG1vc3QgMSB2aWV3LCB3aGljaCBpc1xuICAgIC8vIGxvY2F0ZWQgcmlnaHQgYWZ0ZXIgYW4gTENvbnRhaW5lciBoZWFkZXIuIEdldCBhIGhvbGQgb2YgdGhhdCB2aWV3IGFuZCBpbnNwZWN0XG4gICAgLy8gaXQgZm9yIG5lc3RlZCBkZWZlciBibG9ja3MuXG4gICAgY29uc3QgZGVmZXJCbG9ja0ZpeHR1cmVzID0gW107XG4gICAgaWYgKHRoaXMuYmxvY2subENvbnRhaW5lci5sZW5ndGggPj0gQ09OVEFJTkVSX0hFQURFUl9PRkZTRVQpIHtcbiAgICAgIGNvbnN0IGxWaWV3ID0gdGhpcy5ibG9jay5sQ29udGFpbmVyW0NPTlRBSU5FUl9IRUFERVJfT0ZGU0VUXTtcbiAgICAgIGdldERlZmVyQmxvY2tzKGxWaWV3LCBkZWZlckJsb2Nrcyk7XG4gICAgICBmb3IgKGNvbnN0IGJsb2NrIG9mIGRlZmVyQmxvY2tzKSB7XG4gICAgICAgIGRlZmVyQmxvY2tGaXh0dXJlcy5wdXNoKG5ldyBEZWZlckJsb2NrRml4dHVyZShibG9jaywgdGhpcy5jb21wb25lbnRGaXh0dXJlKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoZGVmZXJCbG9ja0ZpeHR1cmVzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBoYXNTdGF0ZVRlbXBsYXRlKHN0YXRlOiBEZWZlckJsb2NrU3RhdGUsIGJsb2NrOiBEZWZlckJsb2NrRGV0YWlscykge1xuICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgY2FzZSBEZWZlckJsb2NrU3RhdGUuUGxhY2Vob2xkZXI6XG4gICAgICByZXR1cm4gYmxvY2sudERldGFpbHMucGxhY2Vob2xkZXJUbXBsSW5kZXggIT09IG51bGw7XG4gICAgY2FzZSBEZWZlckJsb2NrU3RhdGUuTG9hZGluZzpcbiAgICAgIHJldHVybiBibG9jay50RGV0YWlscy5sb2FkaW5nVG1wbEluZGV4ICE9PSBudWxsO1xuICAgIGNhc2UgRGVmZXJCbG9ja1N0YXRlLkVycm9yOlxuICAgICAgcmV0dXJuIGJsb2NrLnREZXRhaWxzLmVycm9yVG1wbEluZGV4ICE9PSBudWxsO1xuICAgIGNhc2UgRGVmZXJCbG9ja1N0YXRlLkNvbXBsZXRlOlxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXREZWZlckJsb2NrU3RhdGVOYW1lRnJvbUVudW0oc3RhdGU6IERlZmVyQmxvY2tTdGF0ZSkge1xuICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgY2FzZSBEZWZlckJsb2NrU3RhdGUuUGxhY2Vob2xkZXI6XG4gICAgICByZXR1cm4gJ1BsYWNlaG9sZGVyJztcbiAgICBjYXNlIERlZmVyQmxvY2tTdGF0ZS5Mb2FkaW5nOlxuICAgICAgcmV0dXJuICdMb2FkaW5nJztcbiAgICBjYXNlIERlZmVyQmxvY2tTdGF0ZS5FcnJvcjpcbiAgICAgIHJldHVybiAnRXJyb3InO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gJ01haW4nO1xuICB9XG59XG4iXX0=