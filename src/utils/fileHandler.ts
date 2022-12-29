class FileHandlerUtil {
    protected static concatArrayBuffers(arg1: unknown, arg2: unknown) { // Taken from https://gist.github.com/gogromat/446e962bde1122747cfe
        var buffers = Array.prototype.slice.call(arguments),
            buffersLengths = buffers.map(function(b) { return b.byteLength; }),
            totalBufferlength = buffersLengths.reduce(function(p, c) { return p+c; }, 0),
            unit8Arr = new Uint8Array(totalBufferlength);
        buffersLengths.reduce(function (p, c, i) {
            unit8Arr.set(new Uint8Array(buffers[i]), p);
            return p+c;
        }, 0);
        return unit8Arr.buffer;
    }

    protected static getBlobObjectFromArrayBuffer(arrayBuffer: BlobPart, type: any) {
        const blobObject = new Blob([arrayBuffer], { type });
        return blobObject;
    }
}

class FileHandler extends FileHandlerUtil {

    fileObject: File;

    MB_SIZE: number;

    totalPackageSize: number;

    uniqueID: number;

    static arrayBufferStore: { [prop: string]: any };

    constructor(file: any) {
        super();
        this.fileObject = file;
        this.MB_SIZE = 1024 * 500;
        this.totalPackageSize = Math.ceil(this.fileObject.size / this.MB_SIZE);
        this.uniqueID = Math.round(Math.random() * 100000);
        FileHandler.arrayBufferStore = {};
        if (this.fileObject.size > this.MB_SIZE * 101) {
            throw new Error("Only upto 100mb data upload is supported currently!");
        }
    }

    private static serializePackets(arrayBufferStore: any[]) {
        return arrayBufferStore.sort((packet1: { pId: number; }, packet2: { pId: number; }) => {
            return packet1.pId > packet2.pId ? 1 : -1;
        });
    }

    async splitIntoChunksAndSendData(senderCallback: (arg0: { fileChunkArrayBuffer: any; packetId: number; isProcessing: boolean; totalPackageSize: any; fileName: any; fileType: any; uniqueID: any; }) => void) { // TODO: check out writable streams for this...
        for (let start = 0, end = Math.min(this.MB_SIZE, this.fileObject.size), pId = 0; end < this.fileObject.size; pId++) {
            const fileChunk = this.fileObject.slice(start, end);
            const fileChunkArrayBuffer = await fileChunk.arrayBuffer();
            start = end;
            end = Math.min(end + this.MB_SIZE, this.fileObject.size);
            const dataPacket = {
                fileChunkArrayBuffer,
                packetId: pId,
                isProcessing: this.fileObject.size !== end ? true : false,
                totalPackageSize: this.totalPackageSize,
                fileName: this.fileObject.name,
                fileType: this.fileObject.type,
                uniqueID: this.uniqueID
            };
            senderCallback(dataPacket);
        }
    }

    static processReceivedChunk(dataPacket: { packetId?: any; totalPackageSize?: any; fileType?: any; fileName?: any; fileChunkArrayBuffer?: any; isProcessing?: any; uniqueID?: any; }, callback: (arg0: Blob, arg1: { fileName: any; }) => any) { // the callback will receive the blob file;
        const { fileChunkArrayBuffer, isProcessing, uniqueID } = dataPacket;
        let arrayBufferStore = (FileHandler.arrayBufferStore[uniqueID] = FileHandler.arrayBufferStore[uniqueID] || []);
        arrayBufferStore.push({ buffer: fileChunkArrayBuffer, pId: dataPacket.packetId});
        if (isProcessing) {
            console.log("receiving data...");
            return false;
        } else if (false && dataPacket.totalPackageSize != arrayBufferStore.length) { // FIXME: rework this...
            throw new Error("total package size doesn't match arraybufferstore size");
        }
        delete arrayBufferStore[uniqueID];
        arrayBufferStore = FileHandler.serializePackets(arrayBufferStore);
        const masterArrayBuffer = arrayBufferStore.reduce((receivedBufferObject: { buffer: any; }, currentBufferObject: { buffer: any; }) => {
            return {buffer: FileHandler.concatArrayBuffers(receivedBufferObject.buffer, currentBufferObject.buffer)};
        });
        return callback(FileHandler.getBlobObjectFromArrayBuffer(masterArrayBuffer.buffer, dataPacket.fileType), { fileName: dataPacket.fileName });
    }
}

export default FileHandler;
