import { Socket, io } from "socket.io-client";
import CONSTANTS from "../consts/index";
import { DefaultEventsMap } from "@socket.io/component-emitter";

/**
 * This class helps maintain a single instance of the socketIO client.
 * NOTE: Make sure to call `initialize` before getting & using the socket instance via `getSocketInstance`. 
 */
class socket {
    private socketIO: Socket<DefaultEventsMap, DefaultEventsMap> | null;
    constructor() {
        this.socketIO = null;
    }
    initialize(params: { uuid: string }) {
        this.socketIO = io(process.env.REACT_APP_MODE === "dev" ? CONSTANTS.devServerURL : CONSTANTS.serverURL, {
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
