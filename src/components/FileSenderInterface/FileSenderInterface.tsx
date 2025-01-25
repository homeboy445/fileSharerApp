import React, { useContext, useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import FileInfoBox from "../FileInfoBox/FileInfoBox";
import "./FileSenderInterface.css";
import {
  FileTransmissionEnum,
  FilePacket,
  fileTransferrer,
  p2pFilePacket
} from "../../utils/fileHandler";
import socketInstance from "../../connections/socketIO";
import CONSTANTS from "../../consts";
import { eventBus } from "../../utils/events";
import ProgressBar from "../ProgressBar/ProgressBar";
import { apiWrapper } from "../../utils/util";
import { globalDataContext } from "../../contexts/context";
import fileTransferFacilitator from "../../transferModes";
import p2pManager, { P2PEvents } from "../../utils/p2pManager";

let timerInterval: NodeJS.Timer | null = null;
let didFileTransferBegin = () => false;
const FileSenderInterface = ({
  uniqueId,
  closeDialogBox,
}: {
  uniqueId: string;
  closeDialogBox: () => void;
}) => {
  const globalUtilStore = useContext(globalDataContext);

  const shareableLink = `${
    process.env.REACT_APP_MODE === "dev"
      ? CONSTANTS.frontEndURLDev
      : CONSTANTS.frontEndURLProd
  }?id=${uniqueId}`;

  const filesInfo = fileTransferrer.getEachFileInfo();
  const [selectedFileIndex, updateSelectedFileIndex] = useState(0);
  const [joinedRoom, updateRoomState] = useState(false); // TODO: Make 'joinedRoom' a useRef!
  const [inputUrlValue, updateInputUrlValue] = useState(shareableLink);
  const [socketIO] = useState(socketInstance.getSocketInstance());
  const [isPeerConnected, updatePeerConnectionStatus] = useState(false);
  const [userStore, updateUserStore] = useState<{ [userId: string]: boolean }>(
    {}
  );
  const [percentageStore, updatePercentage] = useState<{ [identifier: string]: number }>(
    filesInfo.reduce((accumulator: { [id: string]: number }, fileInfo) => {
      const { fileId } = fileInfo;
      accumulator[fileId] = accumulator[fileId] || 0;
      return accumulator;
    }, {})
  );
  const [didFileTransferStart, toggleFileTransferState] =
    useState<boolean>(false);
  const [fileTransferComplete, updateFileTransferStatus] = useState(false);
  const [elapsedTime, updateElapsedTime] = useState<number>(0);
  const sessionTimeout = useRef<NodeJS.Timeout[]>([]);
  const [fileDataReceivedInMb, updateFileDataReceived] = useState({});

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
  };

  const updatePercentageInStore = ({
    fileId,
    percentage,
    userId,
  }: {
    fileId: number;
    percentage: number;
    userId?: string;
  }) => {
    const percStore = Object.assign({}, percentageStore);
    percStore[`${fileId}`] = percentage;
    if (userId) {
      percStore[userId] = percentage;
    }
    updatePercentage(percStore);
    if (percentage === 100) {
      reloadIfFileSendingDone();
    }
  };

  const reloadIfFileSendingDone = () => {
    if (
      !fileTransferComplete &&
      Object.values(percentageStore).every((value) => value === 100)
    ) {
      timerInterval && clearInterval(timerInterval);
      globalUtilStore?.logToUI(
        "File transfer complete! Clearing the session in 15s!"
      );
      console.log("File transfer is complete!");
      updateFileTransferStatus(true);
      apiWrapper.selfClearingTimeOut(
        () => {
          // globalUtilStore?.queueMessagesForReloads("File transfer successful!");
          socketIO.emit("deleteRoom", { roomId: uniqueId }); // Delete the room as it won't do us any good since, the transmission is already complete!
          localStorage.removeItem(CONSTANTS.uniqueIdCookie);
          socketIO.disconnect();
          window.location.href = "/";
        },
        1000 * 15,
        2
      );
    }
  };

  function getOperationalButtons() {
    return (
      <div className="main-file-send-cancel">
        <button
          disabled={userIds.length === 0 || didFileTransferStart || !isPeerConnected}
          onClick={() => {
            eventBus.trigger(FileTransmissionEnum.SEND); // Starting the file transmission chain!
          }}
        >
          Send File
        </button>
        <button
          style={{ background: fileTransferComplete ? "green" : "red" }}
          onClick={() => {
            socketIO.emit("deleteRoom", {
              roomId: uniqueId,
              info: { fileTransferComplete },
            });
            closeDialogBox();
          }}
        >
          {fileTransferComplete ? "Done" : "Cancel"}
        </button>
      </div>
    );
  }

  // Initialised this function outside this component, so as to assign it a new function
  // on every re-render to maintain the closure variables!
  didFileTransferBegin = () => {
    return (didFileTransferStart || fileTransferComplete);
  }

  useEffect(() => {
    if (fileTransferrer.doesAnyFileExceedFileSizeLimit) {
      globalUtilStore?.queueMessagesForReloads(
        `Only ${fileTransferrer.getMaxAllowedSize()} of data transfer is permitted currently!`
      );
      socketIO.disconnect();
      window.location.href = "/";
    }
    socketInstance.setRoom(uniqueId);
    socketIO.on("connect", () => {
      console.log("connected!"); // TODO: Do something about the production console.logs!
    });
    if (!joinedRoom) {
      socketIO.emit("create-room", {
        id: uniqueId,
        filesInfo: fileTransferrer.getEachFileInfo(),
      });
      updateRoomState(true);
    }
    const transferModeToggle = () => {
      !didFileTransferStart && toggleFileTransferState(true);
    };
    eventBus.on(FileTransmissionEnum.SEND, transferModeToggle);
    fileTransferFacilitator.listenToFileSenderEvents({
      sender: ((dataObject: FilePacket) => {
          if (!dataObject) {
            return;
          }
          socketIO.emit("sendFile", {
            ...dataObject,
            roomId: uniqueId,
          });
      }),
      uniqueId,
      newUserCallback: (data: { userCount: number; userId: string; userLeft?: boolean }) => {
        const users = Object.assign({}, userStore);
        if (data.userLeft) {
          delete users[data.userId];
        } else {
          // console.log("updating current selected user!");
          users[data.userId] = true;
        }
        if (Object.keys(users).length === 0 && didFileTransferBegin()) {
          globalUtilStore.queueMessagesForReloads("Everyone left!");
          socketIO.disconnect();
          window.location.href = "/"; // exit if everybody left while file transfer was in progress!
        }
        p2pManager.makeSignalRequest();
        updateUserStore(users);
      },
      packetAcknowledgeCallback: (data: {
        percentage: number;
        userId: string;
        packetId: number;
        fileId: number;
      }) => {
        if (sessionTimeout.current.length > 0) {
          sessionTimeout.current.forEach((timeOut) => {
            clearTimeout(timeOut);
          });
          sessionTimeout.current = [];
        }
        eventBus.trigger(FileTransmissionEnum.SEND);
        // The multi-file transfer mode currently supports only one user at a time - so maintaining percentages on the basis of files.
        updatePercentageInStore({
          fileId: data.fileId,
          percentage: data.percentage,
          userId: data.userId,
        });
      }
    });
    return () => {
      socketIO.off("connect");
      timerInterval && clearInterval(timerInterval);
    };
  }, [userStore, percentageStore, fileTransferComplete, isPeerConnected]);

  const updatePercentageWrapper = ({ fileId, percentage }: p2pFilePacket, sentDataInMb: number) => {
    // TODO: Check if the listeners for this stacks up!
    updatePercentageInStore({ fileId, percentage, userId: Object.keys(userStore)[0] });
    updateFileDataReceived(Object.assign({ [fileId]: sentDataInMb }, fileDataReceivedInMb));
  };

  useEffect(() => {
    p2pManager.initiate(
      socketIO,
      {
        initiator: globalUtilStore.isInitiator,
        uuid: uniqueId,
      }
    );
    console.log('registered the listener!');
    p2pManager.on(P2PEvents.PROGRESS, updatePercentageWrapper);
    p2pManager.on(P2PEvents.CONNECTED, updatePeerConnectionStatus);
  }, [percentageStore, fileDataReceivedInMb]);

  const userIds = Object.keys(userStore);
  return (
    <div className="main-parent">
      {!globalUtilStore?.isNonDesktopDevice ? (
        <div className="main-container-1">
          <FileInfoBox
            fileInfo={fileTransferrer.getFileInfo(selectedFileIndex)}
            receivedInfoStore={fileDataReceivedInMb}
          />
          <div className="main-file-transmission-section">
            {!didFileTransferStart ? (
              <div className="main-file-link-handle">
                <h2>
                  Scan the QRCode on the receiving device to start sharing...
                </h2>
                <QRCode
                  value={shareableLink}
                  size={200}
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
            ) : (
              <div
                className="progress-bar-list"
                style={{
                  overflowY: filesInfo.length > 4 ? "scroll" : "hidden",
                }}
              >
                {/* File Transfer UI differ for multi-file mode and single-file mode */}
                {fileTransferrer.isMultiFileMode
                  ? filesInfo.map((fileObject, fileIndex) => {
                      return (
                        <ProgressBar
                          title={fileObject.name}
                          percentage={
                            percentageStore[fileObject.fileId] ||
                            (percentageStore[fileObject.fileId] = 0)
                          }
                          isSelected={fileIndex === selectedFileIndex}
                          onClickCallback={() => {
                            updateSelectedFileIndex(fileIndex);
                          }}
                        />
                      );
                    })
                  : userIds.map((userId, index) => {
                      return (
                        <ProgressBar
                          title={`User ${index + 1}`}
                          percentage={
                            percentageStore[userId] ||
                            (percentageStore[userId] = 0)
                          }
                          isSelected={false}
                          onClickCallback={() => {}}
                          styleConfig={{
                            progressBar: {
                              color: ["blue", "purple", "yellow"][index],
                            },
                          }}
                        />
                      );
                    })}
              </div>
            )}
            {getOperationalButtons()}
          </div>
        </div>
      ) : (
        <div className="main-container-mobile-1">
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
          ) : (
            <div className="mobile-sending-section-1">
              <div
                className="mobile-sending-button-1"
                style={
                  fileTransferrer.isMultiFileMode
                    ? {}
                    : {
                        visibility: "hidden",
                        marginTop: "5%",
                        marginBottom: "1%",
                      }
                }
              >
                <button
                  disabled={selectedFileIndex === 0}
                  onClick={() => {
                    updateSelectedFileIndex(selectedFileIndex - 1);
                  }}
                >
                  Prev.
                </button>
                <button
                  disabled={
                    selectedFileIndex + 1 === fileTransferrer.totalFileCount
                  }
                  onClick={() => {
                    updateSelectedFileIndex(selectedFileIndex + 1);
                  }}
                >
                  Next
                </button>
              </div>
              <FileInfoBox
                fileInfo={fileTransferrer.getFileInfo(selectedFileIndex)}
                receivedInfoStore={fileDataReceivedInMb}
              />
              <div style={{ marginTop: "10%" }}>
                {fileTransferrer.isMultiFileMode && filesInfo.length > 0 ? (
                  <ProgressBar
                    title={
                      (+percentageStore[filesInfo[selectedFileIndex].fileId] ||
                        0) < 100
                        ? "Sending..."
                        : "Done"
                    }
                    percentage={
                      percentageStore[filesInfo[selectedFileIndex].fileId] ||
                      (percentageStore[filesInfo[selectedFileIndex].fileId] = 0)
                    }
                    isSelected={false}
                    onClickCallback={() => {}}
                    styleConfig={{
                      borderEnabled: false,
                      css: { fontSize: "1rem" },
                    }}
                  />
                ) : (
                  userIds.map((userId, index) => {
                    return (
                      <ProgressBar
                        title={`User ${index + 1}`}
                        percentage={
                          percentageStore[userId] ||
                          (percentageStore[userId] = 0)
                        }
                        isSelected={false}
                        onClickCallback={() => {}}
                        styleConfig={{
                          progressBar: {
                            color: ["blue", "purple", "yellow"][index],
                          },
                          borderEnabled: true,
                          css: { fontSize: "1rem" },
                        }}
                      />
                    );
                  })
                )}
              </div>
            </div>
          )}
          {getOperationalButtons()}
        </div>
      )}
      <h3
        id="userCount"
      >
        {userIds.length === 0
          ? "No user is connected as of yet!"
          : `${userIds.length} user(s) are connected!`}
      </h3>
    </div>
  );
};

export default FileSenderInterface;
