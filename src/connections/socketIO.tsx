import { Socket, io } from "socket.io-client";
import CONSTANTS from "../consts/index";
import { DefaultEventsMap } from "@socket.io/component-emitter";

/**
 * This class helps maintain a single instance of the socketIO client.
 * NOTE: Make sure to call `initialize` before getting & using the socket instance via `getSocketInstance`. 
 */
class socket {
    private socketIO: Socket<DefaultEventsMap, DefaultEventsMap> | null;
    initializedWithParams: { ip: string; };
    constructor() {
        this.socketIO = null;
        this.initializedWithParams = { ip: '' };
    }
    initialize(params: { ip: string }) {
        let areAllSameParams = true;
        for (const param in this.initializedWithParams) {
            if (param != (params as any)[param]) {
                areAllSameParams = false;
            }
        }
        if (areAllSameParams) {
            return;
        }
        this.initializedWithParams.ip = params.ip;
        this.socketIO = io(CONSTANTS.serverURL, {
            query: params
        });
    }
    getSocketInstance() {
        if (this.socketIO === null) {
            throw new Error("Socket IO instance not initialized!");
        }
        return this.socketIO;
    }
}

export default new socket();
