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
  const [objectLink, updateObjectLink] = useState<string | null>(null);
  const [currentFileName, updateCurrentFileName] = useState<string>("unknown");
  const [inputUrlValue, updateInputUrlValue] = useState(`http://localhost:3000?id=${uniqueId}`);

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
      socketIO.on("recieveFile", (data) => {
        console.log("Received the file!", data);
        FileHandler.processReceivedChunk(
          data,
          (blobObj: Blob, fileData: { fileName: string }) => {
            (window as any).info = { blobObj, fileData };
            updateObjectLink(URL.createObjectURL(blobObj));
            updateCurrentFileName(fileData.fileName);
          }
        );
        updateProgress(data.percentageCompleted || 0);
      });
      socketIO.on("roomInvalidated", () => {
        window.location.href = "/";
      });
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
        console.log("user connected!");
        updateUserCount(data.userCount);
      });
      socketIO.emit("sendFile", { data: "Hello there!", roomId: uniqueId });
    }
    return () => {
      socketIO.off("connect");
      socketIO.off(uniqueId + ":users");
      socketIO.off("recieveFile");
    };
  }, []);

  console.log("recievFile: ", recieveFile);
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
              <input
                type="text"
                readOnly={true}
                value={inputUrlValue}
                style={{ color: inputUrlValue === "Copied to clipboard!" ? "green" : "black" }}
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
              style={{
                width: "80%",
                height: "500px",
                padding: "5%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <CircularProgressbar
                value={sentPercentage}
                text={
                  sentPercentage === 101
                    ? "Done!"
                    : `${sentPercentage == -1 ? 0 : sentPercentage}%`
                }
                strokeWidth={1}
                styles={buildStyles({
                  pathColor:
                    "linear-gradient(to right, #1fa2ff, #12d8fa, #a6ffcb)",
                  textColor: "blue",
                })}
              />
              {objectLink != null ? (
                <a
                  href={objectLink}
                  id="downloadLink"
                  download={currentFileName}
                  onClick={closeDialogBox}
                >
                  Download File
                </a>
              ) : null}
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
              disabled={sentPercentage !== -1 || userCount === 0}
              onClick={() => {
                fileHandlerInstance?.splitIntoChunksAndSendData(
                  (dataObject) => {
                    console.log("-> sending data...");
                    socketIO.emit("sendFile", {
                      ...dataObject,
                      roomId: uniqueId,
                    });
                  },
                  (currentPercentage: number) => {
                    updateProgress(currentPercentage);
                  }
                );
              }}
            >
              Send File
            </button>
            <button onClick={() => {
              socketIO.emit("deleteRoom", { roomId: uniqueId });
              closeDialogBox();
            }}>Cancel</button>
          </div>
        </div>
      </div>
      {recieveFile ? (
        <h3 id="userCount">Transmission hasn't started yet!</h3>
      ) : (
        <h3 id="userCount">
          {userCount === 0
            ? "No user is connected as of yet!"
            : `${userCount} user(s) are connected!`}
        </h3>
      )}
    </div>
  );
};

export default FileSharerDialog;
