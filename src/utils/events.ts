
/**
 * This class will assist with any custom event listening and triggering.
 */
class EventBus {
    private store: { [eventName: string]: Array<(...args: any) => void> } = {};

    private createEvent(eventName: string) {
        this.store[eventName] = [];
    }

    on(eventName: string, callback: any) { // FIXME: add the explicit function type here!
        if (!this.store[eventName]) {
            this.createEvent(eventName);
        }
        this.store[eventName].push(callback);
    }

    off(eventName: string) {
        delete this.store[eventName];
    }

    trigger(eventName: string, data?: any) {
        this.store[eventName].forEach((callback) => {
            callback(data);
        });
    }
}

const eventBus = new EventBus();

export { eventBus };
