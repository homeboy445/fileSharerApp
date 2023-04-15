import React, { useState, useRef, useEffect } from "react";
import FileSharerImage from "./assets/sendFiles.jpg";
import { v4 as uuidv4 } from "uuid";
import "./App.css";
import FileSenderInterface from "./components/FileSenderInterface/FileSenderInterface";
import FileRecieverInterface from "./components/FileRecieverInterface/FileRecieverInterface";
import MessageBox from "./components/PopUps/MessageBox/MessageBox";
import socketIO from "./connections/socketIO";
import { fetchIpAddress } from "./utils/util";
import cookieManager from "./utils/cookieManager";
import CONSTANTS from "./consts/index";

const idStore: { [props: string]: any } = {};
const uniqueUserId = uuidv4();

const App = () => {
  const [showFileSharerDialog, toggleDialog] = useState(false);
  const [fileObject, updateFileObject] = useState<File | null>(null);
  const [messagesToBeDisplayed, updateMessage] = useState<{ message: string; id: string }[]>([]);
  const [ipAddress, updateIpAddress] = useState<string | null>(cookieManager.get(CONSTANTS.ipAddressCookie));
  const fileRef = useRef(null);
  const queuedMessages: string[] = [];

  const getParamsObject = (): { id: string | null } => {
    const URL = window.location.href;
    const indexOfQueryStart = URL.indexOf("?");
    const queryParams = { id: null };
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

  const queryParams: { id: string | null } = getParamsObject();

  const logToUI = (message: string) => {
    const data = { message, id: uuidv4() };
    idStore[data.id] = true;
    updateMessage([ ...messagesToBeDisplayed, data ]);
  }

  const durationCompleteCallback = (id: string) => {
    delete idStore[id];
    if (Object.keys(idStore).length === 0) {
      setTimeout(() => updateMessage([]), 100); // to enable the animation in case of MessageBox component;
    }
  };

  const queueMessagesForReloads = (message: string) => {
    queuedMessages.push(message);
    localStorage.setItem(CONSTANTS.localStorageQueueMessageKey, JSON.stringify(queuedMessages));
  }

  const loadQueueMessagesAndLogThemtoUI = () => {
    const storedMsgs = localStorage.getItem(CONSTANTS.localStorageQueueMessageKey);
    if (storedMsgs) {
      JSON.parse(storedMsgs).forEach((message: string) => logToUI(message));
      localStorage.removeItem(CONSTANTS.localStorageQueueMessageKey);
    }
  }

  if (ipAddress) {
    socketIO.initialize({ ip: ipAddress });
  }

  useEffect(() => {
    if (ipAddress === null) {
      fetchIpAddress()
      .then((ip) => {
        updateIpAddress(ip);
        socketIO.initialize({ ip });
        cookieManager.set(CONSTANTS.ipAddressCookie, ip);
      });
    }
    loadQueueMessagesAndLogThemtoUI();
  }, []);

  return ipAddress === null ? <h1>Loading...</h1> : (
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
          opacity: showFileSharerDialog ? "0.4" : "1",
          pointerEvents: showFileSharerDialog ? "none" : "all",
          backdropFilter: showFileSharerDialog ? "none" : "blur(5%)",
        }}
      >
        <div className="msg-box-1">
          <h1>Welcome to FileSharer.io!!!</h1>
          <h2>
            Share your files with your peers in an instant without any hassle.
          </h2>
          <ul>
            <li>✅Share any file type</li>
            <li>✅Send upto 200Mb of data</li>
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
              onChange={(e) => {
                updateFileObject((e as any).target.files[0]);
                (window as any).file = (e as any).target.files[0];
                if ((e as any).target.files.length > 0) {
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
              onClick={() => {
                (fileRef as any).current.click();
              }}
            >
              Choose File
            </button>
          </div>
        </div>
      </div>
      {fileObject && !queryParams["id"] ? (
        <FileSenderInterface
          fileObject={fileObject as unknown as File}
          uniqueId={uuidv4()}
          closeDialogBox={function (): void {
            window.location.href = "/";
          }}
          globalUtilStore={{
            logToUI,
            queueMessagesForReloads,
            getUserId: () => uniqueUserId,
          }}
        />
      ) : null}
      {queryParams["id"] ? (
        <FileRecieverInterface
          uniqueId={queryParams["id"] || ""}
          closeDialogBox={() => {
            window.location.href = "/";
          }}
          globalUtilStore={{
            logToUI,
            queueMessagesForReloads,
            getUserId: () => uniqueUserId
          }}
        />
      ) : null}
    </div>
  );
};

export default App;
