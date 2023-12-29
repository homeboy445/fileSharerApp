/// <reference path="./types/index.d.ts" />
import React, { useState, useRef, useEffect } from "react";
import "./setup";
import FileSharerImage from "./assets/sendFiles.jpg";
import { v4 as uuidv4 } from "uuid";
import "./App.css";
import FileSenderInterface from "./components/FileSenderInterface/FileSenderInterface";
import FileRecieverInterface from "./components/FileRecieverInterface/FileRecieverInterface";
import MessageBox from "./components/PopUps/MessageBox/MessageBox";
import socketIO from "./connections/socketIO";
import CONSTANTS from "./consts/index";
import { fileTransferrer } from "./utils/fileHandler";
import { globalDataContext } from "./contexts/context";
import { FileTransferModeEnum } from "./transferModes";
import p2pManager from "./utils/p2pManager";

type GenericObject = { [params: string]: any };

const idStore: { [props: string]: any } = {};
const uniqueUserId = (function () {
  let uuid: string = "";
  // The UUID should be loaded from cache only in the case of receiving a file!
  const cachedUUID = window.location.href.includes("?id=")
    ? localStorage.getItem(CONSTANTS.uniqueIdCookie)
    : (uuid = uuidv4());
  if (cachedUUID) {
    uuid = cachedUUID;
  } else {
    localStorage.setItem(CONSTANTS.uniqueIdCookie, uuid);
  }
  socketIO.initialize({ uuid });
  return uuid;
})();

if (process.env.REACT_APP_MODE !== 'dev') {
  var logStore: { logs: string[], warnings: string[], errors: string[] } = { logs: [], warnings: [], errors: [] };
  (window as any).fl_store = logStore;
  console.log = (...args: any[]) => { logStore.logs.push(...args); };
  console.warn = (...args: any[]) => { logStore.warnings.push(...args); };
  console.error = (...args: any[]) => { logStore.errors.push(...args); };
}

const App = () => {
  const [showFileSharerDialog, toggleDialog] = useState(false);
  const [messagesToBeDisplayed, updateMessage] = useState<
    { message: string; id: string }[]
  >([]);
  const [socketIoInstance] = useState(socketIO.getSocketInstance());
  const fileRef = useRef(null);
  const queuedMessages: string[] = [];
  const [width, setWidth] = useState<number>(window.innerWidth);
  const currentFileTransmissionMode = useRef(FileTransferModeEnum.P2P);
  const [appDisabled, toggleAppDisability] = useState(false);

  const handleWindowSizeChange = () => {
    setWidth(window.innerWidth);
  };

  useEffect(() => {
    window.addEventListener("resize", handleWindowSizeChange);
    return () => {
      window.removeEventListener("resize", handleWindowSizeChange);
    };
  }, []);

  const getParamsObject = (): GenericObject => {
    const URL = window.location.href;
    const indexOfQueryStart = URL.indexOf("?");
    const queryParams: GenericObject = { id: null };
    if (indexOfQueryStart !== -1) {
      URL.slice(indexOfQueryStart + 1)
        .split("&")
        .reduce((prev: Record<string, any>, curr: string) => {
          const [name, value] = curr.split("=");
          prev[name] = value;
          return prev;
        }, queryParams);
    }
    return queryParams;
  };

  const queryParams: GenericObject = getParamsObject();

  const logToUI = (message: string) => {
    const data = { message, id: uuidv4() };
    idStore[data.id] = true;
    updateMessage([...messagesToBeDisplayed, data]);
  };

  const durationCompleteCallback = (id: string) => {
    delete idStore[id];
    if (Object.keys(idStore).length === 0) {
      setTimeout(() => updateMessage([]), 100); // to enable the animation in case of MessageBox component;
    }
  };

  const queueMessagesForReloads = (message: string) => {
    queuedMessages.push(message);
    localStorage.setItem(
      CONSTANTS.localStorageQueueMessageKey,
      JSON.stringify(queuedMessages)
    );
  };

  const loadQueueMessagesAndLogThemtoUI = () => {
    const storedMsgs = localStorage.getItem(
      CONSTANTS.localStorageQueueMessageKey
    );
    if (storedMsgs) {
      JSON.parse(storedMsgs).forEach((message: string) => logToUI(message));
      localStorage.removeItem(CONSTANTS.localStorageQueueMessageKey);
    }
  };

  useEffect(() => {
    if (!p2pManager.isWebRTCSupported()) {
      logToUI("Error: WebRTC not supported!");
      toggleAppDisability(true);
    } else {
      socketIoInstance.on("error", (data) => {
        queueMessagesForReloads(data.message || "Some error occurred!");
        window.location.href = "/";
      });
      loadQueueMessagesAndLogThemtoUI();
      return () => {
        socketIoInstance.off("error");
      };
    }
  }, []);

  const isNonDesktopDevice = width < 1000;
  return (
    <div>
      {messagesToBeDisplayed.map((messageObj, index) => {
        return (
          <MessageBox
            key={uuidv4()}
            messageObj={messageObj}
            durationCompleteCallback={durationCompleteCallback}
            messageBoxIndex={index}
          />
        );
      })}
      <div
        className="container"
        style={{
          display: isNonDesktopDevice && (showFileSharerDialog || queryParams["id"]) ? "none" : "flex",
          opacity: showFileSharerDialog ? "0.4" : "1",
          pointerEvents: showFileSharerDialog ? "none" : "all",
          backdropFilter: showFileSharerDialog ? "none" : "blur(5%)",
        }}
      >
        <div className="msg-box-1">
          <h1>Welcome to FileSharer.io!</h1>
          <h2>
            Share your files with your peers in an instant without any hassle.
          </h2>
          <ul>
            <li>✅Share any file type</li>
            <li>✅Send upto {fileTransferrer.getMaxAllowedSize()} of data</li>
            <li>✅Peer to Peer transmission</li>
            <li>✅Secure Data Propagation</li>
          </ul>
        </div>
        <div className="file-upload-box-1">
          <div className="fl-sub-1">
            <img src={FileSharerImage} alt="" />
            <input
              type="file"
              ref={fileRef}
              multiple={true}
              onChange={(e: any) => {
                fileTransferrer.initiate(Object.values((e.target.files as { [fileIndex: number]: File })));
                if (e.target.files.length > 0) {
                  toggleDialog(true);
                }
              }}
              style={{
                visibility: "hidden",
                position: "absolute",
                pointerEvents: "none",
              }}
            />
            <button
              id="choose-file"
              disabled={appDisabled}
              onClick={() => {
                (fileRef as any).current.click();
              }}
            >
              Choose File
            </button>
          </div>
        </div>
      </div>
      <globalDataContext.Provider
        value={{
          logToUI,
          queueMessagesForReloads,
          getUserId: () => uniqueUserId,
          isDebugMode: () => !!queryParams["debugMode"],
          isNonDesktopDevice,
          serverUrl: (process.env.REACT_APP_MODE === "dev"
          ? CONSTANTS.devServerURL
          : CONSTANTS.serverURL),
          isInitiator: window.location.search.indexOf("?id=") > -1 ? false : true,
          currentTransmissionMode: currentFileTransmissionMode.current
        }}
      >
        {showFileSharerDialog && !queryParams["id"] ? (
          <FileSenderInterface
            uniqueId={uniqueUserId}
            closeDialogBox={function (): void {
              window.location.href = "/";
            }}
          />
        ) : null}
        {queryParams["id"] ? (
          <FileRecieverInterface
            roomId={queryParams["id"] || ""}
          />
        ) : null}
      </globalDataContext.Provider>
    </div>
  );
};

export default App;
