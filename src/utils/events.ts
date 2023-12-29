
/**
 * This class will assist with any custom event listening and triggering.
 */
class EventBus {
    private store: { [eventName: string]: Array<(...args: any) => void> } = {};

    /**
     * Returns true if the event exists within the event bus.
     * @param eventName 
     * @returns 
     */
    isEvent(eventName: string | number): boolean {
        return !!(this.store[eventName] || []).length;
    }

    /**
     * Will attach a listener to the provided event.
     * Note: This will not attach the same callback more than once.
     * @param eventName string | number
     * @param callback Function
     */
    on(eventName: string | number, callback: any) { // FIXME: add the explicit function type here!
        if (this.isEvent(eventName)) {
            // In case the callback already exists within the eventBus, remove it!
            eventBus.off(eventName, callback);
        }
        this.store[eventName] = this.store[eventName] || [];
        this.store[eventName].push(callback);
    }

    /**
     * Removes the attached listerners if exists.
     * @param eventName string | number
     * @param callback Function
     */
    off(eventName: string | number, callback: (...args: any[]) => void): void {
        for (let i = 0; i < this.store[eventName].length; i++) {
            if (this.store[eventName][i] === callback) {
                this.store[eventName].splice(i, 1);
            }
        }
    }

    /**
     * Will trigger the provided event by executing the attached callbacks.
     * @param eventName string | number
     * @param data any
     */
    trigger(eventName: string | number, ...data: any[]) {
        if (!this.store[eventName]) {
            return;
        }
        this.store[eventName].forEach((callback) => {
            callback(...data);
        });
    }
}

const eventBus = new EventBus();

export { eventBus };
