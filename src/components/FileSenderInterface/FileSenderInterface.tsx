import React, { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import FileInfoBox from "../FileInfoBox/FileInfoBox";
import "./FileSenderInterface.css";
import { FileSender } from "../../utils/fileHandler";
import socketInstance from "../../connections/socketIO";
import cookieManager from "../../utils/cookieManager";
import CONSTANTS from "../../consts";

const FileSenderInterface = ({
  fileObject,
  uniqueId,
  closeDialogBox,
  globalUtilStore,
}: {
  fileObject: File;
  uniqueId: string;
  closeDialogBox: () => void;
  globalUtilStore?: { logToUI: (message: string) => void, queueMessagesForReloads: (message: string) => void, getUserId: () => string },
}) => {

  const [fileHandlerInstance] = useState(new FileSender(fileObject));

  const shareableLink = `${process.env.REACT_APP_MODE === "dev" ? CONSTANTS.frontEndURLDev : CONSTANTS.frontEndURLProd}?id=${uniqueId}`;

  const [joinedRoom, updateRoomState] = useState(false);
  const [inputUrlValue, updateInputUrlValue] = useState(shareableLink);
  const [fileInfo] = useState({
    name: fileHandlerInstance?.fileObject?.name,
    type: fileHandlerInstance?.fileObject?.type,
    size: fileHandlerInstance?.fileObject?.size,
  });
  const [socketIO] = useState(socketInstance.getSocketInstance());
  const [userCount, updateUserCount] = useState(0);
  const [connectedUsers, updateConnectedUsers] = useState<Record<string, number>>({});
  const [currentSelectedUser, updateSelectedUser] = useState('');
  const [didFileTransferStart, toggleFileTransferState] = useState<boolean>(false);
  const [tmpPercentageStore, updateTmpPercentageStore] = useState<number>(0);

  const unloadFnRef = useRef((e: any) => {
    e.preventDefault();
    e.returnValue = "";
    const message = "Are you sure about leaving the page?";
    e.returnValue = message;
    return message;
  });

  const attackUnloadListener = () => {
    console.log('attached the unload listener!');
    window.addEventListener('beforeunload', unloadFnRef.current);
  }

  const removeUnloadListener = () => {
    console.log('removed the unload listener!');
    window.removeEventListener('beforeunload', unloadFnRef.current);
  }

  const updateUserPercentage = (userId: string, percentage: number, deleteUser = false) => {
    const users = connectedUsers;
    if (deleteUser) {
      delete users[userId];
    } else {
      users[userId] = percentage;
    }
    updateConnectedUsers(users);
    reloadIfFileSendingDone();
  }

  const reloadIfFileSendingDone = () => {
    let count = 0;
    const connectedUsersList = Object.keys(connectedUsers);
    connectedUsersList.forEach((key) => {
      if (connectedUsers[key] >= 100) count++;
    });
    if (count === connectedUsersList.length) {
      setTimeout(() => {
        globalUtilStore?.queueMessagesForReloads("File transfer successful!");
        socketIO.emit("deleteRoom", { roomId: uniqueId }); // Delete the room as it won't do us any good since, the transmission is already complete!
        cookieManager.delete(CONSTANTS.uniqueIdCookie);
        window.location.href = "/";
      }, 2000);
    }
  }

  useEffect(() => {
    if (fileHandlerInstance.getFileSize() >= (1024 * 1024) * 200) {
      globalUtilStore?.queueMessagesForReloads("Only 200Mb of data transfer is permitted currently!");
      window.location.href = "/";
    }
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
    socketIO.on(uniqueId + ":users", (data: { userCount: number; userId: string; userLeft?: boolean }) => {
      console.log("~~ user count got updated: ", data);
      updateUserCount(data.userCount);
      updateUserPercentage(data.userId, 0, data.userLeft);
      !currentSelectedUser && updateSelectedUser(data.userId);
    });
    socketIO.on("packet-acknowledged", (data: { percentage: number; userId: string; }) => {
      updateTmpPercentageStore(data.percentage); // TODO: Remove this!
      updateUserPercentage(data.userId, data.percentage);
    });
    return () => {
      socketIO.off("connect");
      socketIO.off(uniqueId + ":users");
      socketIO.off("recieveFile");
      socketIO.off("packet-acknowledged");
    };
  }, [currentSelectedUser, connectedUsers]);

  return (
    <div className="main-parent">
      <div className="main-container-1">
        <FileInfoBox fileInfo={fileInfo} />
        <div className="main-file-transmission-section">
          {
            !didFileTransferStart ? (
              <div className="main-file-link-handle">
                <h2>
                  Scan the QRCode on the receiving device to start sharing...
                </h2>
                <QRCode value={shareableLink} size={256} style={{ margin: "5%" }} />
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
                  value={connectedUsers[currentSelectedUser]}
                  text={connectedUsers[currentSelectedUser] >= 100 ? "Done!" : `${connectedUsers[currentSelectedUser]}%`}
                  strokeWidth={1}
                  styles={buildStyles({
                    pathColor: "blue",
                    textColor: "blue",
                    trailColor: "grey"
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
              </div>
            )
          }
          <div className="main-file-send-cancel">
            <button
              disabled={userCount === 0 || didFileTransferStart}
              onClick={() => {
                fileHandlerInstance?.splitIntoChunksAndSendData(
                  (dataObject: any) => {
                    !didFileTransferStart && toggleFileTransferState(true);
                    socketIO.emit("sendFile", {
                      ...dataObject,
                      roomId: uniqueId,
                    });
                  },
                  (currentPercentage: number) => {
                  }, () => {
                    // this will be called when all the data packets have been dispatched!
                  }
                  );
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
