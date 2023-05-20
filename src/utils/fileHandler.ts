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
}


export class FileSender {
  fileObject: File;

  ALLOWED_PAYLOAD_SIZE: number;

  totalPackets: number;

  uniqueID: number;

  constructor(file: any) {
    this.fileObject = file;
    this.ALLOWED_PAYLOAD_SIZE = 1024 * 100;
    this.totalPackets = Math.ceil(this.fileObject.size / this.ALLOWED_PAYLOAD_SIZE);
    this.uniqueID = Math.round(Math.random() * 100000);
    // if (this.fileObject.size > (1024 * 1024) * 200) {
    //   // throw new Error("Only upto 200Mb data upload is supported currently!");
    // }
  }

  getFileSize() {
    return this.fileObject.size;
  }

  async splitIntoChunksAndSendData(
    senderCallback: (arg0: {
      fileChunkArrayBuffer: any;
      packetId: number;
      isProcessing: boolean;
      totalPackets: any;
      fileName: any;
      fileType: any;
      uniqueID: any;
    }) => void,
    updatePercentageCallback: (perc: number) => void, // This callback should run on percentage update;
    dataTransmissionCompleteCallback: () => void
  ) {
    // TODO: check out writable streams for this...
    for (
      let start = 0,
        end = Math.min(this.ALLOWED_PAYLOAD_SIZE, this.fileObject.size),
        pId = 0;
      start < this.fileObject.size;
      pId++
    ) {
      const fileChunk = this.fileObject.slice(start, end);
      const fileChunkArrayBuffer = await fileChunk.arrayBuffer();
      start = end;
      end = Math.min(end + this.ALLOWED_PAYLOAD_SIZE, this.fileObject.size);
      const dataPacket = {
        fileChunkArrayBuffer,
        packetId: pId + 1,
        isProcessing: start < this.fileObject.size ? true : false,
        totalPackets: this.totalPackets,
        chunkSize: fileChunk.size,
        fileName: this.fileObject.name,
        fileType: this.fileObject.type,
        uniqueID: this.uniqueID, // FIXME: This might not be necessary!
        percentageCompleted: Math.floor((end / this.fileObject.size) * 100)
      };
      senderCallback(dataPacket);
      updatePercentageCallback(dataPacket.percentageCompleted);
    }
    dataTransmissionCompleteCallback();
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
    this.appendToBlob(fileChunkArrayBuffer, fileType);
    if (isProcessing) {
      return false;
    }
    return callback((this.fileBlob as Blob), { fileName });
  }
}
