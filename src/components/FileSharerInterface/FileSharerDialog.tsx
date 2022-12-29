import React, { useEffect, useState } from "react";
import fileIcon from "../../assets/files.png";
import QRCode from "react-qr-code";
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import "./FileSharerDialog.css";
import FileHandler from "../../utils/fileHandler";
import io from "socket.io-client";
import axios from "axios";

const FileSharerDialog = ({
  //FIXME: This is running twice;
  fileHandlerInstance,
  closeDialogBox,
  uniqueId,
  recieveFile,
}: {
  fileHandlerInstance: FileHandler | null;
  closeDialogBox: () => void;
  uniqueId: string;
  recieveFile: boolean;
}) => {
  const socketIO = io("http://localhost:3005");

  const [sentPercentage, updateProgress] = useState(-1);
  const [joinedRoom, updateRoomState] = useState(false);
  const [fileInfo, updateFileInfo] = useState({
    name: fileHandlerInstance?.fileObject?.name,
    type: fileHandlerInstance?.fileObject?.type,
    size: fileHandlerInstance?.fileObject?.size,
  });
  const [userCount, updateUserCount] = useState(0);

  const checkIfRoomValid = () => {
    axios
      .post("http://localhost:3005/isValidRoom", {
        roomId: uniqueId,
      })
      .then(({ data }) => {
        if (!data.status) {
          window.location.href = "/";
        }
        updateFileInfo({ ...data.fileInfo });
      })
      .catch(() => {
        window.location.href = "/";
      });
  };

  useEffect(() => {
    if (recieveFile) {
      checkIfRoomValid();
      if (!joinedRoom) {
        socketIO.emit("join-room", { id: uniqueId });
        updateRoomState(true);
      }
    } else {
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
      socketIO.on(uniqueId + ":users", (data) => {
        updateUserCount(data.userCount);
      });
    }
    return () => {
      socketIO.off("connect");
      socketIO.off(uniqueId + ":users");
    };
  }, [sentPercentage]);

  return (
    <div className="main-parent">
      <div className="main-container-1">
        <div className="main-file-info-bx">
          <img src={fileIcon} alt="" />
          <h2>File Info</h2>
          <ul>
            <li>
              File Name: <span>{fileInfo?.name || "loading..."}</span>
            </li>
            <li>
              File type: <span>{fileInfo?.type || "loading..."}</span>
            </li>
            <li>
              File size:{" "}
              <span>
                {((fileInfo?.size ?? 0) / (1024 * 1024)).toFixed(2)}
                Mb
              </span>
            </li>
          </ul>
        </div>
        <div className="main-file-transmission-section">
          {sentPercentage === -1 && !recieveFile ? (
            <div className="main-file-link-handle">
              <h2>
                Scan the QRCode on the receiving device to start sharing...
              </h2>
              <QRCode value={"testing"} size={256} style={{ margin: "5%" }} />
              <h2>Or, share this link...</h2>
              <input type="text" value={"Some xyz link"} />
            </div>
          ) : (
            <div style={{ width: "80%", height: "500px", padding: "5%" }}>
              <CircularProgressbar
                value={sentPercentage}
                text={sentPercentage === 101 ? "Done!" : `${sentPercentage}%`}
                strokeWidth={1}
                styles={buildStyles({
                  pathColor:
                    "linear-gradient(to right, #1fa2ff, #12d8fa, #a6ffcb)",
                  textColor: "blue",
                })}
              />
            </div>
          )}
          <div
            className="main-file-send-cancel"
            style={{
              visibility: recieveFile ? "hidden" : "visible",
              pointerEvents: recieveFile ? "none" : "all",
            }}
          >
            <button
              disabled={sentPercentage !== -1}
              onClick={() => {
                let counter = sentPercentage;
                let it = setInterval(() => {
                  counter += 1;
                  updateProgress(counter);
                  if (counter === 101) {
                    clearInterval(it);
                  }
                }, 100);
              }}
            >
              Send File
            </button>
            <button onClick={closeDialogBox}>Cancel</button>
          </div>
        </div>
      </div>
      {recieveFile ? (
        <h3>Transmission hasn't started yet!</h3>
      ) : (
        <h3>
          {userCount === 0
            ? "No user is connected as of yet!"
            : `${userCount} user(s) are connected!`}
        </h3>
      )}
    </div>
  );
};

export default FileSharerDialog;
