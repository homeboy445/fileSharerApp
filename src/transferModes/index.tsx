import socketIO from "../connections/socketIO";
import { eventBus } from "../utils/events";
import {
  FilePacket,
  FilePacketAdditional,
  FileTransmissionEnum,
  fileTransferrer,
} from "../utils/fileHandler";

export enum FileTransferModeEnum {
  "P2P" = 1,
  "SERVER" = 2, // This mode is meant for backward compatibility!
}

class FileTransferFacilitator {
  current: FileTransferModeEnum = FileTransferModeEnum.P2P;
  socket = socketIO.getSocketInstance();
  registered = false;
  setMode(mode: FileTransferModeEnum) {
    this.current = mode;
  }
  listenToFileSenderEvents({
    sender,
    uniqueId,
    newUserCallback,
    packetAcknowledgeCallback,
  }: {
    sender: (dataObject: any) => void;
    uniqueId: string;
    newUserCallback: (data: {
      userCount: number;
      userId: string;
      userLeft?: boolean;
    }) => void;
    packetAcknowledgeCallback?: (data: {
      percentage: number;
      userId: string;
      packetId: number;
      fileId: number;
    }) => void;
  }): void {
    if (this.registered) {
      return;
    }
    this.registered = true;
    fileTransferrer.registerSenderCallback(sender);
    this.socket.on(uniqueId + ":users", newUserCallback);
    eventBus.on(FileTransmissionEnum.SEND, fileTransferrer.send.bind(fileTransferrer));
    if (this.current === FileTransferModeEnum.SERVER) {
      packetAcknowledgeCallback &&
        this.socket.on("packet-acknowledged", packetAcknowledgeCallback);
    }
  }
  listenToFileRecieveEvents({
    additionalData,
    onFileReceiveCallback,
    onRoomInvalidation,
    onRoomFullCallback,
  }: {
    additionalData:  { uniqueUserId: string },
    onFileReceiveCallback: (data: FilePacketAdditional) => void;
    onRoomInvalidation: (data: { fileTransferComplete: boolean }) => void;
    onRoomFullCallback: () => void;
  }) {
    if (this.registered) {
        return;
    }
    if (this.current === FileTransferModeEnum.P2P) {
    } else if (this.current === FileTransferModeEnum.SERVER) {
      this.registered = true;
      this.socket.on("recieveFile", onFileReceiveCallback);
    }
    this.socket.on("roomInvalidated", onRoomInvalidation);
    this.socket.on("roomFull:" + additionalData.uniqueUserId, onRoomFullCallback);
  }
}

export default new FileTransferFacilitator();
