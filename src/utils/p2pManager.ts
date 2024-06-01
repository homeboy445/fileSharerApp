import { Socket } from "socket.io-client";
import SimplePeer from "simple-peer";
import { DefaultEventsMap } from "@socket.io/component-emitter";
import { eventBus } from "./events";

const peerConfig: {
  signalData: Array<string>,
  signalSent: boolean
} = {
  signalData: [],
  signalSent: false
};

export enum P2PEvents {
  CONNECTED = "P2P_CONNECTION_ESTABLISHED",
  CONNECTION_CLOSED = "P2P_CONNECTION_CLOSED",
  SEND = "P2P_SEND",
  RECEIVE = "P2P_RECEIVE",
  FILE_INFO_RECEIVE = "P2P_FILE_INFO_RECEIVE",
  FILE_RECEIVED = "P2P_FILE_RECEIVED",
  ERROR = "P2P_ERROR",
  PROGRESS = "P2P_FILE_PROGRESS",
  FILE_SENDING_COMPLETE="P2P_FILE_SENDING_COMPLETE"
};

/**
 * Handles the whole P2P data transfer end to end.
 * Specs:
 * Fires `P2P_RECEIVE` when data is received!\
 * Consider attaching listener for the same via '.on'!
 */
class P2PManager {

  private CHUNK_SIZE_LIMIT = 65536;

  private peer: SimplePeer.Instance | null = null;

  private socketIO: Socket<DefaultEventsMap, DefaultEventsMap> | null = null;

  private roomId: string = "";

  private promiseResolver = { resolve: (value: unknown) => {}, reject: () => {} };

  private init = false;

  private isInitiator = false;

  isConnected = new Promise((resolve, reject) => {
    this.promiseResolver = { resolve, reject };
  });

  public initiate(
    socketInstance: Socket<DefaultEventsMap, DefaultEventsMap>,
    config: { uuid: string; initiator: boolean }
  ): void {
    if (this.init) {
      return;
    }
    this.init = true;
    this.roomId = config.uuid;
    this.peer = new SimplePeer(config);
    this.isInitiator = config.initiator;
    this.socketIO = socketInstance;
    this.generateSignal();
    this.attachSignalListeners();
    this.attachDataListeners();
    this.attachFileInfoReceiver();
    setTimeout(() => {
      this.promiseResolver.resolve(false);
    }, 30000);
  }

  public isWebRTCSupported(): boolean {
    return SimplePeer.WEBRTC_SUPPORT;
  }

  private generateSignal(): void {
    this?.peer?.on("signal", (signal: string) => {
      peerConfig.signalData.push(signal);
      if (peerConfig.signalSent || !this.isInitiator) {
        // In case some new signal is generated after we've sent previously generated signals!
        this.makeSignalRequest();
      }
    });
  }

  private attachSignalListeners() {
    this.socketIO?.on("receive-signal", ({ signalData }) => {
      // console.log("received signal data: ", signalData);
      this.peer?.signal(signalData);
    });
  }

  private attachDataListeners(): void {
    this.peer?.on("connect", () => {
      this.promiseResolver.resolve(true);
      console.log("Peer is connected!");
      eventBus.trigger(P2PEvents.CONNECTED, true);
      this.CHUNK_SIZE_LIMIT = (this.peer as any)?._channel?.bufferedAmountLowThreshold || this.CHUNK_SIZE_LIMIT;
      this?.peer?.on("data", (data: Uint8Array) => {
        eventBus.trigger(P2PEvents.RECEIVE, data);
      });
    });
    this.peer?.on("close", (reason: any) => {
      console.warn("peer connection closed!");
      eventBus.trigger(P2PEvents.CONNECTION_CLOSED, reason);
    });
    this.peer?.on("error", (reason: any) => {
      console.log(">> ", reason);
      eventBus.trigger(P2PEvents.ERROR, reason);
    });
  }

  private attachFileInfoReceiver() {
    this.socketIO?.on("file-transfer-info-channel", (data: any) => {
      eventBus.trigger(P2PEvents.PROGRESS, data);
    });
  }

  public on(event: P2PEvents, callback: (...data: any[]) => void): void {
    eventBus.on(event, callback);
  }

  public off(event: P2PEvents, callback: (...data: any[]) => void): void {
    eventBus.off(event, callback);
  }

  public makeSignalRequest(): void {
    if (!this.init || !peerConfig.signalData) {
      console.warn("Peer is not initialized properly!");
      return;
    }
    // console.log("Making signal request!");
    peerConfig.signalData.forEach((signal) => {
      this?.socketIO?.emit?.(`send-signal`, { signal, roomId: this.roomId });
    });
    peerConfig.signalSent = true;
    peerConfig.signalData = [];
  }

  public async sendData(data: Uint8Array) {
    if (!this.init) {
      console.warn("Peer init not done!");
      return;
    }
    let len = data.length, offset = 0;
    const RTCDataChannelInstance: RTCDataChannel = (this.peer as any)._channel;
    console.log("sending data via webRTC Channel!");
    do {
      const chunk = data.slice(offset, Math.min(data.length, offset + this.CHUNK_SIZE_LIMIT));
      // spreading the data array into shorter chunks!
      if (this.CHUNK_SIZE_LIMIT < RTCDataChannelInstance.bufferedAmount) {
        let cb = () => {};
        const promise = new Promise<void>((r) => { cb = r; });
        RTCDataChannelInstance.onbufferedamountlow = () => {
          cb();
        };
        await promise;
      }
      this.peer?.send(chunk);
      offset += this.CHUNK_SIZE_LIMIT;
      len -= this.CHUNK_SIZE_LIMIT;
    } while (len > 0);
    console.log("sending data via webRTC Channel complete!");
  }
}

export default new P2PManager();
