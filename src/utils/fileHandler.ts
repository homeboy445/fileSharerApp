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

export type dataPacket = {
  fileChunkArrayBuffer: ArrayBuffer;
  packetId: number;
  isProcessing: boolean;
  totalPackets: number
  chunkSize: number
  fileName: string;
  fileType: string;
  uniqueID: string;
  percentageCompleted: number;
};

export class FileSender {
  private fileObject: File;

  private ALLOWED_PAYLOAD_SIZE: number;

  private totalPackets: number;

  private fileSenderCallback = (...args: any[]) => {};
  
  uniqueID: number;

  private packetSender: ({ pId }: { pId: number }) => any;

  constructor(file: any) {
    this.fileObject = file;
    this.ALLOWED_PAYLOAD_SIZE = 1024 * 100;
    this.totalPackets = Math.ceil(this.fileObject.size / this.ALLOWED_PAYLOAD_SIZE);
    this.uniqueID = Math.round(Math.random() * 100000);
    this.packetSender = this.getDataTransmissionIteratorCaller();
  }

  registerSenderCallback(callback: (dataObject: dataPacket) => void) {
    this.fileSenderCallback = callback;
  }

  getFileInfo() {
    return {
      name: this.fileObject.name,
      type: this.fileObject.type,
      size: this.fileObject.size
    };
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
        yield pId;
        // console.log("sending packet with id:", pId);
        const fileChunk = _this.fileObject.slice(start, end);
        const fileChunkArrayBuffer = FileHandlerUtil.compressPacket(await fileChunk.arrayBuffer());
        start = end;
        end = Math.min(end + _this.ALLOWED_PAYLOAD_SIZE, _this.fileObject.size);
        const dataPacket = {
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
        _this.fileSenderCallback(dataPacket);
      }
    }
    const iterator = iterateAndSendData();
    iterator.next();
    return (async () => { // will send 100 packets at a time!
      let packets_Sent = 0;
      for (let idx = 0; idx < 100; idx++) {
        let value = await iterator.next();
        if (value.done) {
          return false;
        }
        ++packets_Sent;
      }
      // console.log("packets sent: ", packets_Sent);
      return true;
    }).bind(this);
  }

  /**
   * This method returns the callback which when called sends a data packet to the sender callback registered.
   * Note: the callback returns true in case the packet was sent and returns false when the transmission is complete!
   * @returns callback
   */
  getPacketTransmitter() {
    return this.packetSender;
  }
}


export class FileReciever {

  fileBlob: Blob | null;

  constructor() {
    this.fileBlob = null;
  }

  appendToBlob(fileChunk: ArrayBuffer, type: string) {
    if (!this.fileBlob) {
      this.fileBlob = new Blob([fileChunk], { type });
    } else {
      this.fileBlob = new Blob([this.fileBlob, fileChunk], { type });
    }
  }

  processReceivedChunk(
    dataPacket: {
      packetId?: any;
      totalPackets?: any;
      fileType?: any;
      fileName?: any;
      fileChunkArrayBuffer?: any;
      isProcessing?: any;
      uniqueID?: any;
    },
    callback: (arg0: Blob, arg1: { fileName: any }) => any
  ) {
    // the callback will receive the blob file;
    const { fileChunkArrayBuffer, isProcessing, fileType, fileName } = dataPacket;
    this.appendToBlob(FileHandlerUtil.uncompressPacket(fileChunkArrayBuffer), fileType);
    if (isProcessing) {
      return false;
    }
    return callback((this.fileBlob as Blob), { fileName });
  }
}
