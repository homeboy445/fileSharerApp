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

const arrayBufferStore: { [props: string]: any } = {};

class FileHandler extends FileHandlerUtil {
  fileObject: File;

  ALLOWED_PAYLOAD_SIZE: number;

  totalPackets: number;

  uniqueID: number;

  constructor(file: any) {
    super();
    this.fileObject = file;
    this.ALLOWED_PAYLOAD_SIZE = 1024 * 500;
    this.totalPackets = Math.ceil(this.fileObject.size / this.ALLOWED_PAYLOAD_SIZE);
    this.uniqueID = Math.round(Math.random() * 100000);
    if (this.fileObject.size > (1024 * 1024) * 101) {
      throw new Error("Only upto 100mb data upload is supported currently!");
    }
  }

  private static serializePackets(arrayBufferStore: any[]) {
    return arrayBufferStore.sort(
      (packet1: { pId: number }, packet2: { pId: number }) => {
        return packet1.pId > packet2.pId ? 1 : -1;
      }
    );
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
    updatePercentageCallback: (perc: number) => void // This callback should run on percentage update;
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
      console.log('pId: ', pId);
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
        uniqueID: this.uniqueID,
        percentageCompleted: parseInt(((end / this.fileObject.size) * 100).toFixed(1))
      };
      senderCallback(dataPacket);
      updatePercentageCallback(dataPacket.percentageCompleted);
    }
  }

  static processReceivedChunk(
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
    const { fileChunkArrayBuffer, isProcessing, uniqueID } = dataPacket;
    let arrayBufferStoreForUid = (arrayBufferStore[uniqueID] = arrayBufferStore[uniqueID] || []);
    arrayBufferStoreForUid.push({
      buffer: fileChunkArrayBuffer,
      pId: dataPacket.packetId,
    });
    if (isProcessing || dataPacket.totalPackets !== dataPacket.packetId) {
      console.log("receiving data...");
      return false;
    } else if (
      false &&
      dataPacket.totalPackets != arrayBufferStore.length
    ) {
      // FIXME: rework this...
      throw new Error("total package size doesn't match arraybufferstore size");
    }
    delete arrayBufferStore[uniqueID];
    arrayBufferStoreForUid = FileHandler.serializePackets(arrayBufferStoreForUid);
    const masterArrayBuffer = arrayBufferStoreForUid.reduce(
      (
        receivedBufferObject: { buffer: any },
        currentBufferObject: { buffer: any }
      ) => {
        return {
          buffer: FileHandler.concatArrayBuffers(
            receivedBufferObject.buffer,
            currentBufferObject.buffer
          ),
        };
      }
    );
    return callback(
      FileHandler.getBlobObjectFromArrayBuffer(
        masterArrayBuffer.buffer,
        dataPacket.fileType
      ),
      { fileName: dataPacket.fileName }
    );
  }
}

export default FileHandler;
