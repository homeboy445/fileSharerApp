import { FileTransferModeEnum } from "./../transferModes/index";
import * as pako from "pako";
import p2pManager, { P2PEvents } from "./p2pManager";
import socketIO from "../connections/socketIO";
import { eventBus } from "./events";

class FileHandlerUtil {
  protected static concatArrayBuffers(arg1: unknown, arg2: unknown) {
    // Taken from https://gist.github.com/gogromat/446e962bde1122747cfe
    var buffers = Array.prototype.slice.call(arguments),
      buffersLengths = buffers.map(function (b) {
        return b.byteLength;
      }),
      totalBufferlength = buffersLengths.reduce(function (p, c) {
        return p + c;
      }, 0),
      unit8Arr = new Uint8Array(totalBufferlength);
    buffersLengths.reduce(function (p, c, i) {
      unit8Arr.set(new Uint8Array(buffers[i]), p);
      return p + c;
    }, 0);
    return unit8Arr.buffer;
  }

  protected static getBlobObjectFromArrayBuffer(
    arrayBuffer: BlobPart,
    type: any
  ) {
    const blobObject = new Blob([arrayBuffer], { type });
    return blobObject;
  }

  static compressPacket(packet: ArrayBuffer) {
    return pako.deflate(packet);
  }

  static uncompressPacket(packet: Uint8Array) {
    return pako.inflate(packet);
  }
}

export enum FileTransmissionEnum {
  SEND = "fl_send",
  RECEIVE = "fl_receive",
}

const FileSizeLimit = 1024 * 1024 * 2024; // roughly 1Gb!

export type FilePacket = {
  fileChunkArrayBuffer: Uint8Array;
  packetId: number;
  isProcessing: boolean;
  totalPackets: number;
  chunkSize: number;
  fileName: string;
  fileType: string;
  uniqueID: number;
  percentageCompleted: number;
};

export type StreamPacket = {
  stream: Uint8Array | undefined;
  isComplete: boolean;
};

export interface FilePacketAdditional extends FilePacket {
  senderId: string;
  roomId: string;
}

class FileSender {
  private fileObject: File;

  private ALLOWED_PAYLOAD_SIZE: number;

  private totalPackets: number;

  private uniqueID: number;

  private packetSender: AsyncGenerator<FilePacket, void, unknown>;

  public idealPacketSize: number;

  constructor(file: any) {
    this.fileObject = file;
    this.ALLOWED_PAYLOAD_SIZE = 1024 * 10;
    this.totalPackets = Math.ceil(
      this.fileObject.size / this.ALLOWED_PAYLOAD_SIZE
    );
    this.uniqueID = Math.round(
      Date.now() / 100000 + Math.round(Math.random() * 100000)
    );
    this.packetSender = this.getDataTransmissionIteratorCaller();
    this.idealPacketSize = 10 || this.calculatePacketsToBeSent();
  }

  private calculatePacketsToBeSent(): number {
    const fileSize = this.fileObject.size;
    const num = this.ALLOWED_PAYLOAD_SIZE / fileSize;
    let start = 0,
      end = fileSize;
    while (start < end) {
      // Using binary search to find the number dividing which by the fileSize will yield 1 (by flooring...);
      const mid = (end - start) / 2;
      const percentage = Math.floor(num * mid);
      if (percentage === 1) {
        return Math.ceil(mid);
      }
      if (percentage < 0) {
        return Math.ceil(mid) + 100;
      } else {
        end = mid - 1;
      }
    }
    return 100;
  }

  private getDataTransmissionIteratorCaller() {
    const _this = this;
    async function* iterateAndSendData() {
      // TODO: Consider using browser's inbuilt ReadableStream and WritableStream!
      for (
        let start = 0,
          end = Math.min(_this.ALLOWED_PAYLOAD_SIZE, _this.fileObject.size),
          pId = 0;
        start < _this.fileObject.size;
        pId++
      ) {
        const fileChunk = _this.fileObject.slice(start, end);
        // TODO: implement a basic encryption/decryption logic!
        const fileChunkArrayBuffer = FileHandlerUtil.compressPacket(
          await fileChunk.arrayBuffer()
        );
        start = end;
        end = Math.min(end + _this.ALLOWED_PAYLOAD_SIZE, _this.fileObject.size);
        const dataPacket: FilePacket = {
          fileChunkArrayBuffer,
          packetId: pId + 1,
          isProcessing: start < _this.fileObject.size ? true : false,
          totalPackets: _this.totalPackets,
          chunkSize: fileChunk.size,
          fileName: _this.fileObject.name,
          fileType: _this.fileObject.type,
          uniqueID: _this.uniqueID, // FIXME: This might not be necessary!
          percentageCompleted: Math.floor((end / _this.fileObject.size) * 100),
        };
        yield dataPacket;
      }
    }
    return iterateAndSendData();
  }

  getPacketTransmitter() {
    return this.packetSender;
  }

  getId(): number {
    return this.uniqueID;
  }

  get(): File {
    return this.fileObject;
  }

  getFileInfo() {
    return {
      name: this.fileObject.name,
      type: this.fileObject.type,
      size: this.fileObject.size,
      fileId: this.uniqueID,
    };
  }
}

class FileReciever {
  private fileBlob: Blob | null;

  isComplete = false;

  constructor() {
    this.fileBlob = null;
  }

  private appendToBlob(fileChunk: ArrayBuffer, type: string) {
    if (!this.fileBlob) {
      this.fileBlob = new Blob([fileChunk], { type });
    } else {
      this.fileBlob = new Blob([this.fileBlob, fileChunk], { type });
    }
  }

  public getFileBlob(): Blob {
    if (!this.isComplete || this.fileBlob === null) {
      throw new Error("File transmission is not complete!");
    }
    return this.fileBlob;
  }

  public processReceivedChunk(dataPacket: FilePacket) {
    // the callback will receive the blob file;
    const { fileChunkArrayBuffer, isProcessing, fileType } = dataPacket;
    this.appendToBlob(
      FileHandlerUtil.uncompressPacket(fileChunkArrayBuffer),
      fileType
    );
    if (isProcessing) {
      return false;
    }
    this.isComplete = true;
    return true;
  }
}

export type p2pFilePacket = {
  name: string;
  type: string;
  size: number;
  fileId: number;
  initiator: boolean;
  isComplete: boolean;
  percentage: number;
};

const calcPercentage = (outOf: number, value: number): number => {
  const diff = Math.abs(outOf - value);
  return Math.round((diff / outOf) * 100);
}

class P2PFileHandler {

  private socketInstance = socketIO.getSocketInstance();
  peerFileDataStore: { [fileName: string]: { link: string } } = {};

  constructor() {
    this.handleFileReception();
  }

  private handleFileReception() {
    const currentFileInfo: Array<p2pFilePacket> = [];
    let fileBlob: Blob | null;
    const updatePercentage = (percentage: number) => eventBus.trigger(P2PEvents.PROGRESS, { ...currentFileInfo[0], percentage });
    let lastEncounteredPercentage = -1; // This will help us in preventing trigger the PROGRESS when not needed!
    this.socketInstance.on(
      "file-transfer-info-channel",
      (fileInfoObj: p2pFilePacket) => {
        // console.log("file transfer info received:", fileInfoObj, " ", fileBlob);
        updatePercentage(0);
        currentFileInfo.push(fileInfoObj);
        fileBlob = new Blob([], { type: fileInfoObj.type });
      }
    );
    p2pManager.on(P2PEvents.RECEIVE, (stream: Uint8Array): void => {
      if (fileBlob) {
        fileBlob = new Blob([fileBlob, stream], { type: currentFileInfo[0].type });
      }
      if (fileBlob && currentFileInfo[0].size === fileBlob.size) {
        const fileLink = URL.createObjectURL(fileBlob);
        updatePercentage(100);
        eventBus.trigger(P2PEvents.FILE_RECEIVED, { ...currentFileInfo[0], link: fileLink });
        this.socketInstance.emit("file-received", { ...currentFileInfo[0], roomId: socketIO.getCurrentRoomId() });
        currentFileInfo.splice(0, 1);
        fileBlob = null;
        lastEncounteredPercentage = -1;
      } else {
        const percentage = 100 - calcPercentage(currentFileInfo[0].size, fileBlob?.size || 0);
        if (lastEncounteredPercentage !== percentage) {
          updatePercentage(percentage);
          lastEncounteredPercentage = percentage;
        }
      }
    });
  }

  /**
   * This method will generate the file data in streams and will call the provided callback as soon as the stream gets available.
   * @param callback Function
   */
  private async generateFileStream(
    file: File,
    perStreamCallback: (dataObject: {
      stream: Uint8Array | undefined;
      isComplete: boolean;
    }) => Promise<void>
  ) {
    const stream = file.stream();
    const reader = stream.getReader();
    do {
      const { value, done } = await reader.read();
      await perStreamCallback({ stream: value, isComplete: done });
      if (done) {
        return;
      }
    } while (true);
  }

  protected async peerSend(files: FileSender[]) {
    if (!(await p2pManager.isConnected)) {
      console.warn("NOT CONNECTED!");
      // In case if the data transmission tries to happen before the connection is established!
      return;
    }
    const listenForFileReceivedCompletion = async () => {
      let cb: any = () => {}, timer: NodeJS.Timeout | null = null;
      const promise = new Promise((res) => { cb = res; timer = setTimeout(() => cb, 10000); });
      this.socketInstance.on("file-received", (fileInfo: any) => {
        cb();
        timer !== null && clearTimeout(timer);
      });
      return promise;
    };
    for (let idx = 0; idx < files.length; idx++) {
      const fileDataObject = {
        ...files[idx].getFileInfo(),
        initiator: true,
        isComplete: false,
        roomId: socketIO.getCurrentRoomId()
      };
      let sentDataChunkSize = 0;
      let initiateFileInfo = false;
      const updatePercentage = (percentage: number) => eventBus.trigger(P2PEvents.PROGRESS, { ...fileDataObject, percentage });
      // console.log("Sending file: ", fileDataObject);
      updatePercentage(0);
      await this.generateFileStream(files[idx].get(), async (data) => {
        if (!data.stream || data.isComplete) {
          return;
        }
        if (!initiateFileInfo) {
          initiateFileInfo = true;
          this.socketInstance.emit("file-transfer-info-channel", fileDataObject);
        }
        await p2pManager.sendData(data.stream);
        sentDataChunkSize += data.stream.length;
        const currentPercentage = 100 - calcPercentage(fileDataObject.size, sentDataChunkSize);
        updatePercentage(currentPercentage);
      });
      await listenForFileReceivedCompletion();
      // console.log("Sending file complete! ", fileDataObject);
      updatePercentage(100);
    }
  }
};

/**
 * A wrapper class for facilitating easy file transfer by encapsulating all the file transfering functionalities (sending, receiving).
 */
class FileTransmissionWrapper extends P2PFileHandler {
  private files: FileSender[] = [];
  private receivedFiles: { [fileId: string | number]: FileReciever } = {};

  private packetTransmitters: {
    [fileId: number]: AsyncGenerator<FilePacket, void, unknown>;
  } = {};

  private sender = (dataObject: FilePacket | StreamPacket) => {};
  private received = (dataObj: { fileId: string | number; blob: Blob }) => {};

  private readonly PACKETS_TO_BE_SENT_PER_SESSION = 100;

  totalFileCount = 0;
  isMultiFileMode = false;
  doesAnyFileExceedFileSizeLimit = false;

  /**
   * Initiates the file handling system.
   * @param files Files[]
   */
  initiate(files: File[]) {
    // Files with lower size should be give more priority!
    this.files = files
      .map((file: File) => {
        this.doesAnyFileExceedFileSizeLimit = file.size > FileSizeLimit;
        const fileSenderObject = new FileSender(file);
        this.packetTransmitters[fileSenderObject.getId()] =
          fileSenderObject.getPacketTransmitter();
        return fileSenderObject;
      })
      .sort((f1, f2) => {
        return f1.getFileInfo().size < f2.getFileInfo().size ? -1 : 1;
      });
    this.totalFileCount = this.files.length;
    this.isMultiFileMode = this.files.length > 1;
  }

  getFileInfo(index: number) {
    return this.files[index].getFileInfo();
  }

  getEachFileInfo(): {
    name: string;
    type: string;
    size: number;
    fileId: number;
  }[] {
    return this.files.map((file) => file.getFileInfo());
  }

  registerSenderCallback(
    callback: (dataObject: FilePacket | StreamPacket) => void
  ) {
    this.sender = callback;
  }

  onReceived(
    callback: (dataObj: { fileId: string | number; blob: Blob }) => void
  ): void {
    this.received = callback;
  }

  /**
   * This method will initiate the packets transfer. The default transfer mode is P2P.
   * @param mode 1 | 2 (1 for P2P, 2 for SERVER)
   * @returns void
   */
  async send(mode = FileTransferModeEnum.P2P) {
    if (mode === FileTransferModeEnum.P2P) {
      return this.peerSend(this.files);
    } else {
      for (let idx = 0; idx < this.files.length; idx++) {
        let shouldContinue = false;
        for (
          let packets = 0;
          packets <
          5 /**Math.max(this.PACKETS_TO_BE_SENT_PER_SESSION, this.files[idx].idealPacketSize) */;
          packets++
        ) {
          const { value, done } = await this.packetTransmitters[
            this.files[idx].getId()
          ].next();
          if (value) {
            this.sender(value);
          }
          if (done) {
            // we want to return from here, since packet sending will be a gradual process i.e we will first send the packet & will send another once we get the acknowledgement!
            shouldContinue = true;
            break;
          }
        }
        if (!shouldContinue) {
          // We want to send packets per file only! & would only proceed to other files if the current files is completly sent!
          return;
        }
      }
    }
  }

  /**
   * This receive Interface is for backward compatibility purposes only where the usual FilePacket will be received via
   * a socket connection.
   */
  receive(data: FilePacket): void {
    this.receivedFiles[data.uniqueID] =
      this.receivedFiles[data.uniqueID] || new FileReciever();
    const isTransferComplete =
      this.receivedFiles[data.uniqueID].processReceivedChunk(data);
    if (isTransferComplete) {
      this.received({
        fileId: data.uniqueID,
        blob: this.receivedFiles[data.uniqueID].getFileBlob(),
      });
    }
  }

  getFileDownloadLink(fileId: number): string | null {
    const file = this.receivedFiles[fileId];
    if (!file || !file.isComplete) {
      return null;
    }
    return URL.createObjectURL(file.getFileBlob());
  }
}

const fileTransferrer = new FileTransmissionWrapper();

export { fileTransferrer };
