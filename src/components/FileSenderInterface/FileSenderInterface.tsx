import React, { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import FileInfoBox from "../FileInfoBox/FileInfoBox";
import "./FileSenderInterface.css";
import {
  FileTransmissionEnum,
  FilePacket,
  fileTransferrer
} from "../../utils/fileHandler";
import socketInstance from "../../connections/socketIO";
import cookieManager from "../../utils/cookieManager";
import CONSTANTS from "../../consts";
import { eventBus } from "../../utils/events";
import ProgressBar from "../ProgressBar/ProgressBar";

const FileSenderInterface = ({
  uniqueId,
  closeDialogBox,
  globalUtilStore,
}: {
  uniqueId: string;
  closeDialogBox: () => void;
  globalUtilStore?: {
    logToUI: (message: string) => void;
    queueMessagesForReloads: (message: string) => void;
    getUserId: () => string;
    isDebugMode: () => boolean;
  };
}) => {

  const shareableLink = `${
    process.env.REACT_APP_MODE === "dev"
      ? CONSTANTS.frontEndURLDev
      : CONSTANTS.frontEndURLProd
  }?id=${uniqueId}`;

  const [selectedFileIndex, updateSelectedFileIndex] = useState(0);
  const [joinedRoom, updateRoomState] = useState(false);
  const [inputUrlValue, updateInputUrlValue] = useState(shareableLink);
  const [socketIO] = useState(socketInstance.getSocketInstance());
  const [userStore, updateUserStore] = useState<{ [userId: string]: boolean }>({});
  const [percentageStore, updatePercentage] = useState<{ [identifier: string]: number}>({});
  const [didFileTransferStart, toggleFileTransferState] =
    useState<boolean>(false);
  const [elapsedTime, updateElapsedTime] = useState<number>(0);
  const [flag, toggleFlag] = useState(false);
  let timerInterval: NodeJS.Timer | null = null;

  const unloadFnRef = useRef((e: any) => {
    e.preventDefault();
    e.returnValue = "";
    const message = "Are you sure about leaving the page?";
    e.returnValue = message;
    return message;
  });

  const attackUnloadListener = () => {
    console.log("attached the unload listener!");
    window.addEventListener("beforeunload", unloadFnRef.current);
  };

  const removeUnloadListener = () => {
    console.log("removed the unload listener!");
    window.removeEventListener("beforeunload", unloadFnRef.current);
  };
  
  const forceUpdateState = () => {
    toggleFlag(!flag);
  }

  const getFormatedElapsedTimeString = () => {
    const format = (time: number) => {
      if (time < 1) {
        return "00";
      } else if (time < 10) {
        return "0" + time;
      } else {
        return time;
      }
    };
    const seconds = Math.floor(elapsedTime / 1000);
    const minutes = Math.floor(seconds / 60);
    return format(minutes % 60) + ":" + format(seconds % 60);
  }

  const updatePercentageInStore = ({ fileId, percentage, userId }: { fileId: number; percentage: number; userId?: string }) => {
    percentageStore[`${fileId}`] = percentage;
    if (userId) {
      percentageStore[userId] = percentage;
    }
    updatePercentage(percentageStore);
    forceUpdateState();
    if (percentage == 100) {
      reloadIfFileSendingDone();
    }
  };

  const reloadIfFileSendingDone = () => {
    if (Object.values(percentageStore).every((value) => value == 100)) {
      timerInterval && clearInterval(timerInterval);
      setTimeout(() => {
        globalUtilStore?.queueMessagesForReloads("File transfer successful!");
        socketIO.emit("deleteRoom", { roomId: uniqueId }); // Delete the room as it won't do us any good since, the transmission is already complete!
        cookieManager.delete(CONSTANTS.uniqueIdCookie);
        window.location.href = "/";
      }, 2000);
    }
  };

  useEffect(() => {
    if (fileTransferrer.doesAnyFileExceedFileSizeLimit) {
      globalUtilStore?.queueMessagesForReloads(
        "Only 1.5Gb of data transfer is permitted currently!"
      );
      window.location.href = "/";
    }
    fileTransferrer.registerSenderCallback((dataObject: FilePacket) => {
      if (!dataObject) {
        return;
      }
      console.log('sending packet for file: ', dataObject.fileName, " ", dataObject.isProcessing, " ", dataObject.percentageCompleted);
      socketIO.emit("sendFile", {
        ...dataObject,
        roomId: uniqueId,
      });
    });
    socketIO.on("connect", () => {
      console.log("connected!");
    });
    if (!joinedRoom) {
      socketIO.emit("create-room", {
        id: uniqueId,
        filesInfo: fileTransferrer.getEachFileInfo(),
      });
      updateRoomState(true);
    }
    socketIO.on(
      uniqueId + ":users",
      (data: { userCount: number; userId: string; userLeft?: boolean }) => {
        const users = userStore;
        if (data.userLeft) {
          delete users[data.userId];
        } else {
          console.log("updating current selected user!");
          users[data.userId] = true;
        }
        if (Object.keys(users).length == 0 && didFileTransferStart) {
          window.location.href = "/"; // exit if everybody left while file transfer was in progress!
        }
        updateUserStore(users);
        forceUpdateState(); 
      }
    );
    socketIO.on(
      "packet-acknowledged",
      (data: { percentage: number; userId: string; packetId: number, fileId: number }) => {
        console.log("~~ Received the packet-acknowledgement: ", data);
        eventBus.trigger(FileTransmissionEnum.RECEIVE);
        // The multi-file transfer mode currently supports only one user at a time - so maintaining percentages on the basis of files.
        updatePercentageInStore({ fileId: data.fileId, percentage: data.percentage, userId: data.userId });
      }
    );
    eventBus.on(FileTransmissionEnum.SEND, async () => {
      !didFileTransferStart && toggleFileTransferState(true);
      await fileTransferrer.send();
    });
    eventBus.on(FileTransmissionEnum.RECEIVE, () => {
      eventBus.trigger(FileTransmissionEnum.SEND);
    });
    return () => {
      socketIO.off("connect");
      socketIO.off(uniqueId + ":users");
      socketIO.off("recieveFile");
      socketIO.off("packet-acknowledged");
      eventBus.off(FileTransmissionEnum.SEND);
      eventBus.off(FileTransmissionEnum.RECEIVE);
      timerInterval && clearInterval(timerInterval);
    };
  }, [userStore, percentageStore, flag]);

  const userIds = Object.keys(userStore);
  return (
    <div className="main-parent">
      <div className="main-container-1">
        <FileInfoBox fileInfo={fileTransferrer.getFileInfo(selectedFileIndex)} />
        <div className="main-file-transmission-section">
          {!didFileTransferStart ? (
            <div className="main-file-link-handle">
              <h2>
                Scan the QRCode on the receiving device to start sharing...
              </h2>
              <QRCode
                value={shareableLink}
                size={256}
                style={{ margin: "5%" }}
              />
              <h2>Or, share this link...</h2>
              <input
                type="text"
                readOnly={true}
                value={inputUrlValue}
                style={{
                  color:
                    inputUrlValue === "Copied to clipboard!"
                      ? "green"
                      : "black",
                }}
                onClick={() => {
                  if (inputUrlValue === "Copied to clipboard!") {
                    return;
                  }
                  window.navigator.clipboard.writeText(inputUrlValue);
                  const url = inputUrlValue;
                  updateInputUrlValue("Copied to clipboard!");
                  setTimeout(() => {
                    updateInputUrlValue(url);
                  }, 1000);
                }}
              />
            </div>
          ) : <div className="progress-bar-list" style={{ overflowY: fileTransferrer.getEachFileInfo().length > 5 ? "scroll" : "hidden" }}>
                  {/* File Transfer UI differ for multi-file mode and single-file mode */}
                  {fileTransferrer.isMultiFileMode ? fileTransferrer.getEachFileInfo().map((fileObject, fileIndex) => {
                    return <ProgressBar
                            title={fileObject.name}
                            percentage={percentageStore[fileObject.fileId] || (percentageStore[fileObject.fileId] = 0)}
                            isSelected={fileIndex === selectedFileIndex}
                            onClickCallback={() => {
                              updateSelectedFileIndex(fileIndex);
                            }} />
                  }) : userIds.map((userId, index) => {
                    return <ProgressBar
                            title={`User ${index + 1}`}
                            percentage={percentageStore[userId] || (percentageStore[userId] = 0)}
                            isSelected={false}
                            onClickCallback={() => {}}
                            style={{ progressBar: { color: ['blue', 'purple', 'yellow'][index] } }}
                          />
                  })}
                </div>}
          <div className="main-file-send-cancel">
            <button
              disabled={userIds.length === 0 || didFileTransferStart}
              onClick={() => {
                const start = Date.now();
                timerInterval = setInterval(() => {
                  updateElapsedTime(Date.now() - start);
                }, 500);
                eventBus.trigger(FileTransmissionEnum.SEND); // Starting the file transmission chain!
              }}
            >
              Send File
            </button>
            <button
              onClick={() => {
                socketIO.emit("deleteRoom", { roomId: uniqueId });
                closeDialogBox();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
      <h3 id="userCount">
        {userIds.length === 0
          ? "No user is connected as of yet!"
          : `${userIds.length} user(s) are connected!`}
      </h3>
    </div>
  );
};

export default FileSenderInterface;
