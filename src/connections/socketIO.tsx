import { Socket, io } from "socket.io-client";
import CONSTANTS from "../consts/index";
import { DefaultEventsMap } from "@socket.io/component-emitter";

/**
 * This class helps maintain a single instance of the socketIO client.
 * NOTE: Make sure to call `initialize` before getting & using the socket instance via `getSocketInstance`. 
 */
class socketManager {
    private socketIO: Socket<DefaultEventsMap, DefaultEventsMap> | null;
    private roomId = "";
    constructor() {
        this.socketIO = io(process.env.REACT_APP_MODE === "dev" ? CONSTANTS.devServerURL : CONSTANTS.serverURL);
    }
    setRoom(roomId: string) {
        this.roomId = roomId;
    }
    getCurrentRoomId() {
        return this.roomId;
    }
    initialize(params: { uuid: string }) {
        // this.socketIO = io(process.env.REACT_APP_MODE === "dev" ? CONSTANTS.devServerURL : CONSTANTS.serverURL, {
        //     query: params,
        // });
        // (window as any).socketIO = this.socketIO;
    }
    getSocketInstance() {
        if (this.socketIO === null) {
            throw new Error("Socket IO instance not initialized!");
        }
        return this.socketIO;
    }
}

export default new socketManager();
