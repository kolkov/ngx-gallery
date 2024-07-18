/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { EventContractContainer } from './event_contract_container';
/**
 * An `EventContractContainerManager` that supports multiple containers.
 */
export class EventContractMultiContainer {
    /**
     * @param stopPropagation Controls whether events can bubble between
     *    containers or not.
     */
    constructor(stopPropagation = false) {
        this.stopPropagation = stopPropagation;
        /** The list of containers. */
        this.containers = [];
        /** The list of nested containers. */
        this.nestedContainers = [];
        /** The list of event handler installers. */
        this.eventHandlerInstallers = [];
    }
    /**
     * Installs the provided installer on the element owned by this container,
     * and maintains a reference to resulting handler in order to remove it
     * later if desired.
     */
    addEventListener(eventType, getHandler) {
        const eventHandlerInstaller = (container) => {
            container.addEventListener(eventType, getHandler);
        };
        for (let i = 0; i < this.containers.length; i++) {
            eventHandlerInstaller(this.containers[i]);
        }
        this.eventHandlerInstallers.push(eventHandlerInstaller);
    }
    /**
     * Removes all the handlers installed on all containers.
     */
    cleanUp() {
        const allContainers = [...this.containers, ...this.nestedContainers];
        for (let i = 0; i < allContainers.length; i++) {
            allContainers[i].cleanUp();
        }
        this.containers = [];
        this.nestedContainers = [];
        this.eventHandlerInstallers = [];
    }
    /**
     * Adds a container to the `MultiEventContractContainer`.
     * Signs the event contract for a new container. All registered events
     * are enabled for this container too. Containers have to be kept disjoint,
     * so if the newly added container is a parent/child of existing containers,
     * they will be merged. If the container is already tracked by this
     * `EventContract`, then the previously registered `EventContractContainer`
     * will be returned.
     */
    addContainer(element) {
        // If the container is already registered, return.
        for (let i = 0; i < this.containers.length; i++) {
            if (element === this.containers[i].element) {
                return this.containers[i];
            }
        }
        const container = new EventContractContainer(element);
        if (this.stopPropagation) {
            // Events are not propagated, so containers can be considered independent.
            this.setUpContainer(container);
            this.containers.push(container);
        }
        else {
            if (this.isNestedContainer(container)) {
                // This container has an ancestor that is already a contract container.
                // Don't install event listeners on it in order to prevent an event from
                // being handled multiple times.
                this.nestedContainers.push(container);
                return container;
            }
            this.setUpContainer(container);
            this.containers.push(container);
            this.updateNestedContainers();
        }
        return container;
    }
    /**
     * Removes an already-added container from the contract.
     */
    removeContainer(container) {
        container.cleanUp();
        let removed = false;
        for (let i = 0; i < this.containers.length; ++i) {
            if (this.containers[i] === container) {
                this.containers.splice(i, 1);
                removed = true;
                break;
            }
        }
        if (!removed) {
            for (let i = 0; i < this.nestedContainers.length; ++i) {
                if (this.nestedContainers[i] === container) {
                    this.nestedContainers.splice(i, 1);
                    break;
                }
            }
        }
        if (this.stopPropagation) {
            return;
        }
        this.updateNestedContainers();
    }
    /**
     * Tested whether any current container is a parent of the new container.
     */
    isNestedContainer(container) {
        for (let i = 0; i < this.containers.length; i++) {
            if (containsNode(this.containers[i].element, container.element)) {
                return true;
            }
        }
        return false;
    }
    /** Installs all existing event handlers on a new container. */
    setUpContainer(container) {
        for (let i = 0; i < this.eventHandlerInstallers.length; i++) {
            this.eventHandlerInstallers[i](container);
        }
    }
    /**
     * Updates the list of nested containers after an add/remove operation. Only
     * containers that are not children of other containers are placed in the
     * containers list (and have event listeners on them). This is done in order
     * to prevent events from being handled multiple times when `stopPropagation`
     * is false.
     */
    updateNestedContainers() {
        const allContainers = [...this.nestedContainers, ...this.containers];
        const newNestedContainers = [];
        const newContainers = [];
        for (let i = 0; i < this.containers.length; ++i) {
            const container = this.containers[i];
            if (isNested(container, allContainers)) {
                newNestedContainers.push(container);
                // Remove the event listeners from the nested container.
                container.cleanUp();
            }
            else {
                newContainers.push(container);
            }
        }
        for (let i = 0; i < this.nestedContainers.length; ++i) {
            const container = this.nestedContainers[i];
            if (isNested(container, allContainers)) {
                newNestedContainers.push(container);
            }
            else {
                newContainers.push(container);
                // The container is no longer nested, add event listeners on it.
                this.setUpContainer(container);
            }
        }
        this.containers = newContainers;
        this.nestedContainers = newNestedContainers;
    }
}
/**
 * Checks whether the container is a child of any of the containers.
 */
function isNested(container, containers) {
    for (let i = 0; i < containers.length; ++i) {
        if (containsNode(containers[i].element, container.element)) {
            return true;
        }
    }
    return false;
}
/**
 * Checks whether parent contains child.
 * IE11 only supports the native `Node.contains` for HTMLElement.
 */
function containsNode(parent, child) {
    if (parent === child) {
        return false;
    }
    while (parent !== child && child.parentNode) {
        child = child.parentNode;
    }
    return parent === child;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRfY29udHJhY3RfbXVsdGlfY29udGFpbmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9wcmltaXRpdmVzL2V2ZW50LWRpc3BhdGNoL3NyYy9ldmVudF9jb250cmFjdF9tdWx0aV9jb250YWluZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLHNCQUFzQixFQUFnQyxNQUFNLDRCQUE0QixDQUFDO0FBRWpHOztHQUVHO0FBQ0gsTUFBTSxPQUFPLDJCQUEyQjtJQVF0Qzs7O09BR0c7SUFDSCxZQUE2QixrQkFBa0IsS0FBSztRQUF2QixvQkFBZSxHQUFmLGVBQWUsQ0FBUTtRQVhwRCw4QkFBOEI7UUFDdEIsZUFBVSxHQUE2QixFQUFFLENBQUM7UUFDbEQscUNBQXFDO1FBQzdCLHFCQUFnQixHQUE2QixFQUFFLENBQUM7UUFDeEQsNENBQTRDO1FBQ3BDLDJCQUFzQixHQUF1RCxFQUFFLENBQUM7SUFNakMsQ0FBQztJQUV4RDs7OztPQUlHO0lBQ0gsZ0JBQWdCLENBQUMsU0FBaUIsRUFBRSxVQUF3RDtRQUMxRixNQUFNLHFCQUFxQixHQUFHLENBQUMsU0FBaUMsRUFBRSxFQUFFO1lBQ2xFLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDcEQsQ0FBQyxDQUFDO1FBQ0YsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDaEQscUJBQXFCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFDRCxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7SUFDMUQsQ0FBQztJQUVEOztP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RSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO1FBQzNDLElBQUksWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDM0QsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO0lBQ0gsQ0FBQztJQUVELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVEOzs7R0FHRztBQUNILFNBQVMsWUFBWSxDQUFDLE1BQVksRUFBRSxLQUFXO0lBQzdDLElBQUksTUFBTSxLQUFLLEtBQUssRUFBRSxDQUFDO1FBQ3JCLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUNELE9BQU8sTUFBTSxLQUFLLEtBQUssSUFBSSxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDNUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUM7SUFDM0IsQ0FBQztJQUNELE9BQU8sTUFBTSxLQUFLLEtBQUssQ0FBQztBQUMxQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7RXZlbnRDb250cmFjdENvbnRhaW5lciwgRXZlbnRDb250cmFjdENvbnRhaW5lck1hbmFnZXJ9IGZyb20gJy4vZXZlbnRfY29udHJhY3RfY29udGFpbmVyJztcblxuLyoqXG4gKiBBbiBgRXZlbnRDb250cmFjdENvbnRhaW5lck1hbmFnZXJgIHRoYXQgc3VwcG9ydHMgbXVsdGlwbGUgY29udGFpbmVycy5cbiAqL1xuZXhwb3J0IGNsYXNzIEV2ZW50Q29udHJhY3RNdWx0aUNvbnRhaW5lciBpbXBsZW1lbnRzIEV2ZW50Q29udHJhY3RDb250YWluZXJNYW5hZ2VyIHtcbiAgLyoqIFRoZSBsaXN0IG9mIGNvbnRhaW5lcnMuICovXG4gIHByaXZhdGUgY29udGFpbmVyczogRXZlbnRDb250cmFjdENvbnRhaW5lcltdID0gW107XG4gIC8qKiBUaGUgbGlzdCBvZiBuZXN0ZWQgY29udGFpbmVycy4gKi9cbiAgcHJpdmF0ZSBuZXN0ZWRDb250YWluZXJzOiBFdmVudENvbnRyYWN0Q29udGFpbmVyW10gPSBbXTtcbiAgLyoqIFRoZSBsaXN0IG9mIGV2ZW50IGhhbmRsZXIgaW5zdGFsbGVycy4gKi9cbiAgcHJpdmF0ZSBldmVudEhhbmRsZXJJbnN0YWxsZXJzOiBBcnJheTwoY29udGFpbmVyOiBFdmVudENvbnRyYWN0Q29udGFpbmVyKSA9PiB2b2lkPiA9IFtdO1xuXG4gIC8qKlxuICAgKiBAcGFyYW0gc3RvcFByb3BhZ2F0aW9uIENvbnRyb2xzIHdoZXRoZXIgZXZlbnRzIGNhbiBidWJibGUgYmV0d2VlblxuICAgKiAgICBjb250YWluZXJzIG9yIG5vdC5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2UpIHt9XG5cbiAgLyoqXG4gICAqIEluc3RhbGxzIHRoZSBwcm92aWRlZCBpbnN0YWxsZXIgb24gdGhlIGVsZW1lbnQgb3duZWQgYnkgdGhpcyBjb250YWluZXIsXG4gICAqIGFuZCBtYWludGFpbnMgYSByZWZlcmVuY2UgdG8gcmVzdWx0aW5nIGhhbmRsZXIgaW4gb3JkZXIgdG8gcmVtb3ZlIGl0XG4gICAqIGxhdGVyIGlmIGRlc2lyZWQuXG4gICAqL1xuICBhZGRFdmVudExpc3RlbmVyKGV2ZW50VHlwZTogc3RyaW5nLCBnZXRIYW5kbGVyOiAoZWxlbWVudDogRWxlbWVudCkgPT4gKGV2ZW50OiBFdmVudCkgPT4gdm9pZCkge1xuICAgIGNvbnN0IGV2ZW50SGFuZGxlckluc3RhbGxlciA9IChjb250YWluZXI6IEV2ZW50Q29udHJhY3RDb250YWluZXIpID0+IHtcbiAgICAgIGNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKGV2ZW50VHlwZSwgZ2V0SGFuZGxlcik7XG4gICAgfTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuY29udGFpbmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgZXZlbnRIYW5kbGVySW5zdGFsbGVyKHRoaXMuY29udGFpbmVyc1tpXSk7XG4gICAgfVxuICAgIHRoaXMuZXZlbnRIYW5kbGVySW5zdGFsbGVycy5wdXNoKGV2ZW50SGFuZGxlckluc3RhbGxlcik7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyBhbGwgdGhlIGhhbmRsZXJzIGluc3RhbGxlZCBvbiBhbGwgY29udGFpbmVycy5cbiAgICovXG4gIGNsZWFuVXAoKSB7XG4gICAgY29uc3QgYWxsQ29udGFpbmVycyA9IFsuLi50aGlzLmNvbnRhaW5lcnMsIC4uLnRoaXMubmVzdGVkQ29udGFpbmVyc107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbGxDb250YWluZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBhbGxDb250YWluZXJzW2ldLmNsZWFuVXAoKTtcbiAgICB9XG4gICAgdGhpcy5jb250YWluZXJzID0gW107XG4gICAgdGhpcy5uZXN0ZWRDb250YWluZXJzID0gW107XG4gICAgdGhpcy5ldmVudEhhbmRsZXJJbnN0YWxsZXJzID0gW107XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhIGNvbnRhaW5lciB0byB0aGUgYE11bHRpRXZlbnRDb250cmFjdENvbnRhaW5lcmAuXG4gICAqIFNpZ25zIHRoZSBldmVudCBjb250cmFjdCBmb3IgYSBuZXcgY29udGFpbmVyLiBBbGwgcmVnaXN0ZXJlZCBldmVudHNcbiAgICogYXJlIGVuYWJsZWQgZm9yIHRoaXMgY29udGFpbmVyIHRvby4gQ29udGFpbmVycyBoYXZlIHRvIGJlIGtlcHQgZGlzam9pbnQsXG4gICAqIHNvIGlmIHRoZSBuZXdseSBhZGRlZCBjb250YWluZXIgaXMgYSBwYXJlbnQvY2hpbGQgb2YgZXhpc3RpbmcgY29udGFpbmVycyxcbiAgICogdGhleSB3aWxsIGJlIG1lcmdlZC4gSWYgdGhlIGNvbnRhaW5lciBpcyBhbHJlYWR5IHRyYWNrZWQgYnkgdGhpc1xuICAgKiBgRXZlbnRDb250cmFjdGAsIHRoZW4gdGhlIHByZXZpb3VzbHkgcmVnaXN0ZXJlZCBgRXZlbnRDb250cmFjdENvbnRhaW5lcmBcbiAgICogd2lsbCBiZSByZXR1cm5lZC5cbiAgICovXG4gIGFkZENvbnRhaW5lcihlbGVtZW50OiBFbGVtZW50KTogRXZlbnRDb250cmFjdENvbnRhaW5lciB7XG4gICAgLy8gSWYgdGhlIGNvbnRhaW5lciBpcyBhbHJlYWR5IHJlZ2lzdGVyZWQsIHJldHVybi5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuY29udGFpbmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGVsZW1lbnQgPT09IHRoaXMuY29udGFpbmVyc1tpXS5lbGVtZW50KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbnRhaW5lcnNbaV07XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGNvbnRhaW5lciA9IG5ldyBFdmVudENvbnRyYWN0Q29udGFpbmVyKGVsZW1lbnQpO1xuICAgIGlmICh0aGlzLnN0b3BQcm9wYWdhdGlvbikge1xuICAgICAgLy8gRXZlbnRzIGFyZSBub3QgcHJvcGFnYXRlZCwgc28gY29udGFpbmVycyBjYW4gYmUgY29uc2lkZXJlZCBpbmRlcGVuZGVudC5cbiAgICAgIHRoaXMuc2V0VXBDb250YWluZXIoY29udGFpbmVyKTtcbiAgICAgIHRoaXMuY29udGFpbmVycy5wdXNoKGNvbnRhaW5lcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0aGlzLmlzTmVzdGVkQ29udGFpbmVyKGNvbnRhaW5lcikpIHtcbiAgICAgICAgLy8gVGhpcyBjb250YWluZXIgaGFzIGFuIGFuY2VzdG9yIHRoYXQgaXMgYWxyZWFkeSBhIGNvbnRyYWN0IGNvbnRhaW5lci5cbiAgICAgICAgLy8gRG9uJ3QgaW5zdGFsbCBldmVudCBsaXN0ZW5lcnMgb24gaXQgaW4gb3JkZXIgdG8gcHJldmVudCBhbiBldmVudCBmcm9tXG4gICAgICAgIC8vIGJlaW5nIGhhbmRsZWQgbXVsdGlwbGUgdGltZXMuXG4gICAgICAgIHRoaXMubmVzdGVkQ29udGFpbmVycy5wdXNoKGNvbnRhaW5lcik7XG4gICAgICAgIHJldHVybiBjb250YWluZXI7XG4gICAgICB9XG4gICAgICB0aGlzLnNldFVwQ29udGFpbmVyKGNvbnRhaW5lcik7XG4gICAgICB0aGlzLmNvbnRhaW5lcnMucHVzaChjb250YWluZXIpO1xuICAgICAgdGhpcy51cGRhdGVOZXN0ZWRDb250YWluZXJzKCk7XG4gICAgfVxuICAgIHJldHVybiBjb250YWluZXI7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyBhbiBhbHJlYWR5LWFkZGVkIGNvbnRhaW5lciBmcm9tIHRoZSBjb250cmFjdC5cbiAgICovXG4gIHJlbW92ZUNvbnRhaW5lcihjb250YWluZXI6IEV2ZW50Q29udHJhY3RDb250YWluZXIpIHtcbiAgICBjb250YWluZXIuY2xlYW5VcCgpO1xuICAgIGxldCByZW1vdmVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNvbnRhaW5lcnMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGlmICh0aGlzLmNvbnRhaW5lcnNbaV0gPT09IGNvbnRhaW5lcikge1xuICAgICAgICB0aGlzLmNvbnRhaW5lcnMuc3BsaWNlKGksIDEpO1xuICAgICAgICByZW1vdmVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFyZW1vdmVkKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubmVzdGVkQ29udGFpbmVycy5sZW5ndGg7ICsraSkge1xuICAgICAgICBpZiAodGhpcy5uZXN0ZWRDb250YWluZXJzW2ldID09PSBjb250YWluZXIpIHtcbiAgICAgICAgICB0aGlzLm5lc3RlZENvbnRhaW5lcnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc3RvcFByb3BhZ2F0aW9uKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMudXBkYXRlTmVzdGVkQ29udGFpbmVycygpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRlc3RlZCB3aGV0aGVyIGFueSBjdXJyZW50IGNvbnRhaW5lciBpcyBhIHBhcmVudCBvZiB0aGUgbmV3IGNvbnRhaW5lci5cbiAgICovXG4gIHByaXZhdGUgaXNOZXN0ZWRDb250YWluZXIoY29udGFpbmVyOiBFdmVudENvbnRyYWN0Q29udGFpbmVyKTogYm9vbGVhbiB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNvbnRhaW5lcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChjb250YWluc05vZGUodGhpcy5jb250YWluZXJzW2ldLmVsZW1lbnQsIGNvbnRhaW5lci5lbGVtZW50KSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLyoqIEluc3RhbGxzIGFsbCBleGlzdGluZyBldmVudCBoYW5kbGVycyBvbiBhIG5ldyBjb250YWluZXIuICovXG4gIHByaXZhdGUgc2V0VXBDb250YWluZXIoY29udGFpbmVyOiBFdmVudENvbnRyYWN0Q29udGFpbmVyKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmV2ZW50SGFuZGxlckluc3RhbGxlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVySW5zdGFsbGVyc1tpXShjb250YWluZXIpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGVzIHRoZSBsaXN0IG9mIG5lc3RlZCBjb250YWluZXJzIGFmdGVyIGFuIGFkZC9yZW1vdmUgb3BlcmF0aW9uLiBPbmx5XG4gICAqIGNvbnRhaW5lcnMgdGhhdCBhcmUgbm90IGNoaWxkcmVuIG9mIG90aGVyIGNvbnRhaW5lcnMgYXJlIHBsYWNlZCBpbiB0aGVcbiAgICogY29udGFpbmVycyBsaXN0IChhbmQgaGF2ZSBldmVudCBsaXN0ZW5lcnMgb24gdGhlbSkuIFRoaXMgaXMgZG9uZSBpbiBvcmRlclxuICAgKiB0byBwcmV2ZW50IGV2ZW50cyBmcm9tIGJlaW5nIGhhbmRsZWQgbXVsdGlwbGUgdGltZXMgd2hlbiBgc3RvcFByb3BhZ2F0aW9uYFxuICAgKiBpcyBmYWxzZS5cbiAgICovXG4gIHByaXZhdGUgdXBkYXRlTmVzdGVkQ29udGFpbmVycygpIHtcbiAgICBjb25zdCBhbGxDb250YWluZXJzID0gWy4uLnRoaXMubmVzdGVkQ29udGFpbmVycywgLi4udGhpcy5jb250YWluZXJzXTtcbiAgICBjb25zdCBuZXdOZXN0ZWRDb250YWluZXJzID0gW107XG4gICAgY29uc3QgbmV3Q29udGFpbmVycyA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNvbnRhaW5lcnMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuY29udGFpbmVyc1tpXTtcbiAgICAgIGlmIChpc05lc3RlZChjb250YWluZXIsIGFsbENvbnRhaW5lcnMpKSB7XG4gICAgICAgIG5ld05lc3RlZENvbnRhaW5lcnMucHVzaChjb250YWluZXIpO1xuICAgICAgICAvLyBSZW1vdmUgdGhlIGV2ZW50IGxpc3RlbmVycyBmcm9tIHRoZSBuZXN0ZWQgY29udGFpbmVyLlxuICAgICAgICBjb250YWluZXIuY2xlYW5VcCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3Q29udGFpbmVycy5wdXNoKGNvbnRhaW5lcik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm5lc3RlZENvbnRhaW5lcnMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMubmVzdGVkQ29udGFpbmVyc1tpXTtcbiAgICAgIGlmIChpc05lc3RlZChjb250YWluZXIsIGFsbENvbnRhaW5lcnMpKSB7XG4gICAgICAgIG5ld05lc3RlZENvbnRhaW5lcnMucHVzaChjb250YWluZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3Q29udGFpbmVycy5wdXNoKGNvbnRhaW5lcik7XG4gICAgICAgIC8vIFRoZSBjb250YWluZXIgaXMgbm8gbG9uZ2VyIG5lc3RlZCwgYWRkIGV2ZW50IGxpc3RlbmVycyBvbiBpdC5cbiAgICAgICAgdGhpcy5zZXRVcENvbnRhaW5lcihjb250YWluZXIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuY29udGFpbmVycyA9IG5ld0NvbnRhaW5lcnM7XG4gICAgdGhpcy5uZXN0ZWRDb250YWluZXJzID0gbmV3TmVzdGVkQ29udGFpbmVycztcbiAgfVxufVxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIHRoZSBjb250YWluZXIgaXMgYSBjaGlsZCBvZiBhbnkgb2YgdGhlIGNvbnRhaW5lcnMuXG4gKi9cbmZ1bmN0aW9uIGlzTmVzdGVkKFxuICBjb250YWluZXI6IEV2ZW50Q29udHJhY3RDb250YWluZXIsXG4gIGNvbnRhaW5lcnM6IEV2ZW50Q29udHJhY3RDb250YWluZXJbXSxcbik6IGJvb2xlYW4ge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbnRhaW5lcnMubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoY29udGFpbnNOb2RlKGNvbnRhaW5lcnNbaV0uZWxlbWVudCwgY29udGFpbmVyLmVsZW1lbnQpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgcGFyZW50IGNvbnRhaW5zIGNoaWxkLlxuICogSUUxMSBvbmx5IHN1cHBvcnRzIHRoZSBuYXRpdmUgYE5vZGUuY29udGFpbnNgIGZvciBIVE1MRWxlbWVudC5cbiAqL1xuZnVuY3Rpb24gY29udGFpbnNOb2RlKHBhcmVudDogTm9kZSwgY2hpbGQ6IE5vZGUpOiBib29sZWFuIHtcbiAgaWYgKHBhcmVudCA9PT0gY2hpbGQpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgd2hpbGUgKHBhcmVudCAhPT0gY2hpbGQgJiYgY2hpbGQucGFyZW50Tm9kZSkge1xuICAgIGNoaWxkID0gY2hpbGQucGFyZW50Tm9kZTtcbiAgfVxuICByZXR1cm4gcGFyZW50ID09PSBjaGlsZDtcbn1cbiJdfQ==