import * as pako from "pako";

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
  RECEIVE = "fl_receive"
};

const FileSizeLimit = 1024 * 1024 * 1624; // roughly 1.6GB

export type FilePacket = {
  fileChunkArrayBuffer: Uint8Array;
  packetId: number;
  isProcessing: boolean;
  totalPackets: number
  chunkSize: number
  fileName: string;
  fileType: string;
  uniqueID: number;
  percentageCompleted: number;
};

class FileSender {
  private fileObject: File;

  private ALLOWED_PAYLOAD_SIZE: number;

  private totalPackets: number;

  private uniqueID: number;

  private packetSender: AsyncGenerator<FilePacket, void, unknown>;

  constructor(file: any) {
    this.fileObject = file;
    this.ALLOWED_PAYLOAD_SIZE = 1024 * 100;
    this.totalPackets = Math.ceil(this.fileObject.size / this.ALLOWED_PAYLOAD_SIZE); 
    this.uniqueID = Math.round((Date.now() / 100000) + Math.round(Math.random() * 100000));
    this.packetSender = this.getDataTransmissionIteratorCaller();
  }

  private getDataTransmissionIteratorCaller() {
    const _this = this;
    async function *iterateAndSendData() {
      for (
        let start = 0,
          end = Math.min(_this.ALLOWED_PAYLOAD_SIZE, _this.fileObject.size),
          pId = 0;
        start < _this.fileObject.size;
        pId++
      ) {
        const fileChunk = _this.fileObject.slice(start, end);
        const fileChunkArrayBuffer = FileHandlerUtil.compressPacket(await fileChunk.arrayBuffer());
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
          percentageCompleted: Math.floor((end / _this.fileObject.size) * 100)
        };
        yield dataPacket;
      }
    }
    return iterateAndSendData();
  }

  getId(): number {
    return this.uniqueID;
  }

  getFileInfo() {
    return {
      name: this.fileObject.name,
      type: this.fileObject.type,
      size: this.fileObject.size,
      fileId: this.uniqueID
    };
  }

  // /**
  //  * This method returns the callback which when called sends a data packet to the sender callback registered.
  //  * Note: the callback returns true in case the packet was sent and returns false when the transmission is complete!
  //  * @returns callback
  //  */
  // getPacketTransmitter(senderCallback: (data: FilePacket) => void): { transmit: () => Promise<boolean> } {
  //   return { transmit: () => this.packetSender(senderCallback) };
  // }

  getPacketTransmitter() {
    return this.packetSender;
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
    const { fileChunkArrayBuffer, isProcessing, fileType, fileName } = dataPacket;
    this.appendToBlob(FileHandlerUtil.uncompressPacket(fileChunkArrayBuffer), fileType);
    if (isProcessing) {
      return false;
    }
    this.isComplete = true;
    return true;
  }
}

/**
 * A wrapper class for facilitating easy file transfer by encapsulating all the file transfer (sending, receiving).
 */
class FileTransmissionWrapper {

  private files: FileSender[] = [];
  private receivedFiles: { [fileId: string | number]: FileReciever } = {};

  private packetTransmitters: { [fileId: number]: AsyncGenerator<FilePacket, void, unknown> } = {};

  private sender = (dataObject: FilePacket) => {};
  private received = (dataObj: { fileId: string | number, blob: Blob }) => {};

  private readonly PACKETS_TO_BE_SENT_PER_SESSION = 100;

  isMultiFileMode = false;
  doesAnyFileExceedFileSizeLimit = false;


  initiate(files: File[]) { // Files with lower size should be give more priority!
    this.files = files.map(((file: File) => {
      this.doesAnyFileExceedFileSizeLimit = file.size > FileSizeLimit;
      const fileSenderObject = (new FileSender(file));
      this.packetTransmitters[fileSenderObject.getId()] = fileSenderObject.getPacketTransmitter();
      return fileSenderObject;
    }).bind(this)).sort((f1, f2) => {
      return f1.getFileInfo().size < f2.getFileInfo().size ? -1 : 1;
    });
    this.isMultiFileMode = this.files.length > 1;
  }

  getFileInfo(index: number) {
    if (index >= this.files.length) {
      throw new Error("File index of out range!");
    }
    return this.files[index].getFileInfo();
  }

  getEachFileInfo(): { name: string, type: string, size: number, fileId: number }[] {
    return this.files.map((file) => file.getFileInfo());
  }

  registerSenderCallback(callback: (dataObject: FilePacket) => void) {
    this.sender = callback;
  }

  onReceived(callback: (dataObj: { fileId: string | number, blob: Blob }) => void): void {
    this.received = callback;
  }

  async send() { // TODO: Add support for timeout!
    for (let idx = 0; idx < this.files.length; idx++) {
      let shouldContinue = false;
      for (let packets = 0; packets < this.PACKETS_TO_BE_SENT_PER_SESSION; packets++) {
        const { value, done } = await this.packetTransmitters[this.files[idx].getId()].next();
        if (value) {
          this.sender(value);
        }
        if (done) { // we want to return from here, since packet sending will be a gradual process i.e we will first send the packet & will send another once we get the acknowledgement!
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

  receive(data: FilePacket): void {
    this.receivedFiles[data.uniqueID] = this.receivedFiles[data.uniqueID] || new FileReciever();
    const isTransferComplete = this.receivedFiles[data.uniqueID].processReceivedChunk(data);
    if (isTransferComplete) {
      this.received({ fileId: data.uniqueID, blob: this.receivedFiles[data.uniqueID].getFileBlob() });
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
