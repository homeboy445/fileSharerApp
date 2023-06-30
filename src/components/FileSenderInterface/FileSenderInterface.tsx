import React, { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import FileInfoBox from "../FileInfoBox/FileInfoBox";
import "./FileSenderInterface.css";
import {
  FileSender,
  FileTransmissionEnum,
  dataPacket,
} from "../../utils/fileHandler";
import socketInstance from "../../connections/socketIO";
import cookieManager from "../../utils/cookieManager";
import CONSTANTS from "../../consts";
import { eventBus } from "../../utils/events";

const FileSenderInterface = ({
  fileObject,
  uniqueId,
  closeDialogBox,
  globalUtilStore,
}: {
  fileObject: File;
  uniqueId: string;
  closeDialogBox: () => void;
  globalUtilStore?: {
    logToUI: (message: string) => void;
    queueMessagesForReloads: (message: string) => void;
    getUserId: () => string;
    isDebugMode: () => boolean;
  };
}) => {
  const [fileHandlerInstance] = useState(new FileSender(fileObject));

  const shareableLink = `${
    process.env.REACT_APP_MODE === "dev"
      ? CONSTANTS.frontEndURLDev
      : CONSTANTS.frontEndURLProd
  }?id=${uniqueId}`;

  const [joinedRoom, updateRoomState] = useState(false);
  const [inputUrlValue, updateInputUrlValue] = useState(shareableLink);
  const [fileInfo] = useState(fileHandlerInstance.getFileInfo());
  const [socketIO] = useState(socketInstance.getSocketInstance());
  const [userCount, updateUserCount] = useState(0);
  const [connectedUsers, updateConnectedUsers] = useState<{ [userId: string]: { percentage: number; color: string }}>({});
  const [currentSelectedUser, updateSelectedUser] = useState("");
  const [didFileTransferStart, toggleFileTransferState] =
    useState<boolean>(false);
  const [tmpPercentageStore, updateTmpPercentageStore] = useState<number>(0);
  const [elapsedTime, updateElapsedTime] = useState<number>(0);
  const [debugString, updateDebugString] = useState<string>("");
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

  const updateUserPercentage = (
    userId: string,
    percentage: number,
    deleteUser = false
  ) => {
    const users = connectedUsers;
    if (deleteUser) {
      delete users[userId];
    } else {
      users[userId] = users[userId] || {};
      users[userId].percentage = percentage;
    }
    if (users[userId] && !users[userId].color) {
      const len = Object.keys(users).length;
      users[userId].color = len == 1 ? "blue" : len == 2 ? "red" : "green";
    }
    updateConnectedUsers(users);
    reloadIfFileSendingDone();
  };

  const reloadIfFileSendingDone = () => {
    let count = 0;
    const connectedUsersList = Object.keys(connectedUsers);
    connectedUsersList.forEach((key) => {
      if (connectedUsers[key].percentage >= 100) count++;
    });
    if (
      connectedUsersList.length !== 0 &&
      count === connectedUsersList.length
    ) {
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
    if (fileInfo.size >= 1024 * 1024 * 1624) {
      globalUtilStore?.queueMessagesForReloads(
        "Only 1.5Gb of data transfer is permitted currently!"
      );
      window.location.href = "/";
    }
    fileHandlerInstance.registerSenderCallback((dataObject: dataPacket) => {
      // console.log('sending packet!');
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
        fileInfo: {
          name: fileInfo?.name,
          type: fileInfo?.type,
          size: fileInfo?.size,
        },
      });
      updateRoomState(true);
    }
    socketIO.on(
      uniqueId + ":users",
      (data: { userCount: number; userId: string; userLeft?: boolean }) => {
        console.log("~~ user count got updated: ", data);
        updateUserCount(data.userCount);
        updateUserPercentage(data.userId, 0, data.userLeft);
        if (data.userLeft) {
          updateSelectedUser(Object.keys(connectedUsers)[0] || "");
        } else if (!currentSelectedUser) {
          console.log("updating current selected user!");
          updateSelectedUser(data.userId);
        }
      }
    );
    socketIO.on(
      "packet-acknowledged",
      (data: { percentage: number; userId: string; packetId: number }) => {
        // console.log("~~ Received the packet-acknowledgement: ", data);
        eventBus.trigger(FileTransmissionEnum.RECEIVE, { pId: data.packetId });
        updateTmpPercentageStore(data.percentage); // TODO: Remove this!
        updateUserPercentage(data.userId, data.percentage);
      }
    );
    eventBus.on(FileTransmissionEnum.SEND, async (dataObj: { pId: number }) => {
      !didFileTransferStart && toggleFileTransferState(true);
      await fileHandlerInstance.getPacketTransmitter()(dataObj);
    });
    eventBus.on(FileTransmissionEnum.RECEIVE, (dataObj: { pId: number }) => {
      eventBus.trigger(FileTransmissionEnum.SEND, dataObj);
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
  }, [currentSelectedUser, connectedUsers]);

  return (
    <div className="main-parent">
      {globalUtilStore?.isDebugMode() ? (
        <h2 style={{ marginBottom: "-5%" }}>{debugString}</h2>
      ) : null}
      <div className="main-container-1">
        <FileInfoBox fileInfo={fileInfo} />
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
          ) : (
            <div className="circular-progress-bar-wrapper">
              <CircularProgressbar
                value={connectedUsers[currentSelectedUser].percentage}
                text={
                  connectedUsers[currentSelectedUser].percentage >= 100
                    ? "Done!"
                    : `${connectedUsers[currentSelectedUser].percentage}%`
                }
                strokeWidth={1}
                styles={buildStyles({
                  pathColor: connectedUsers[currentSelectedUser].color,
                  textColor: "blue",
                  trailColor: "grey",
                })}
              />
              <div
                style={{
                  display: "flex",
                  marginTop: "4%",
                }}
              >
                {Object.keys(connectedUsers).map((userKey) => {
                  return (
                    <input
                      type="radio"
                      key={userKey}
                      checked={userKey === currentSelectedUser}
                      onChange={() => {
                        updateSelectedUser(userKey);
                      }}
                    />
                  );
                })}
              </div>
              <h1 id="elapsedTime">Elapsed time: {getFormatedElapsedTimeString()}</h1>
            </div>
          )}
          <div className="main-file-send-cancel">
            <button
              disabled={userCount === 0 || didFileTransferStart}
              onClick={() => {
                const start = Date.now();
                timerInterval = setInterval(() => {
                  updateElapsedTime(Date.now() - start);
                }, 500);
                eventBus.trigger(FileTransmissionEnum.SEND, { pId: 0 }); // Starting the file transmission chain!
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
        {userCount === 0
          ? "No user is connected as of yet!"
          : `${userCount} user(s) are connected!`}
      </h3>
    </div>
  );
};

export default FileSenderInterface;
