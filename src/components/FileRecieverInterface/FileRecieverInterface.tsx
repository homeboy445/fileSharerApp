import React, { useEffect, useRef, useState } from "react";
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import FileInfoBox from "../FileInfoBox/FileInfoBox";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { FileReciever } from "../../utils/fileHandler";
import "./FileRecieverInterface.css";

const FileRecieverInterface = ({
  socketIO,
  uniqueId,
  closeDialogBox,
}: {
  socketIO: Record<string, any>;
  uniqueId: string;
  closeDialogBox: () => void;
}) => {
  const fileReceiverInstance = new FileReciever();

  const [joinedRoom, updateRoomState] = useState(false);
  const [objectLink, updateObjectLink] = useState<string | null>(null);
  const [currentFileName, updateCurrentFileName] = useState<string>("unknown");
  const [fileReceivedPercentage, updateFilePercentage] = useState(0);
  const [fileInfo, updateFileInfo] = useState({
    name: "",
    type: "",
    size: 0,
  });

  const uniqueUserId = uuidv4();

  const unloadFnRef = useRef((e: any) => {
    e.preventDefault();
    e.returnValue = "";
    const message = "Are you sure about leaving the page?";
    e.returnValue = message;
    return message;
  });

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

  const attackUnloadListener = () => {
    console.log("attached the unload listener!");
    window.addEventListener("beforeunload", unloadFnRef.current);
  };

  const removeUnloadListener = () => {
    console.log("removed the unload listener!");
    window.removeEventListener("beforeunload", unloadFnRef.current);
  };

  useEffect(() => {
    checkIfRoomValid();
    if (!joinedRoom) {
      socketIO.emit("join-room", { id: uniqueId, userId: uniqueUserId });
      updateRoomState(true);
    }
    socketIO.on(
      "recieveFile",
      (data: {
        percentageCompleted?: any;
        packetId?: any;
        totalPackets?: any;
        fileType?: any;
        fileName?: any;
        fileChunkArrayBuffer?: any;
        isProcessing?: any;
        uniqueID?: any;
      }) => {
        console.log("Received the file!", data);
        fileReceiverInstance.processReceivedChunk(
          data,
          (blobObj: Blob, fileData: { fileName: string }) => {
            updateObjectLink(URL.createObjectURL(blobObj));
            updateCurrentFileName(fileData.fileName);
          }
        );
        updateFilePercentage(data.percentageCompleted || 0);
        socketIO.emit("acknowledge", {
          roomId: uniqueId,
          percentage: data.percentageCompleted,
          userId: uniqueUserId,
        });
      }
    );
    socketIO.on("roomInvalidated", () => {
      window.location.href = "/";
    });
    return () => {
        socketIO.off('recieveFile');
        socketIO.off('roomInvalidated');
    };
  }, []);

  return (
    <div className="main-parent">
      <div className="main-container-1">
          <FileInfoBox fileInfo={fileInfo}/>
          <div className="main-file-transmission-section">
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
                value={fileReceivedPercentage}
                text={fileReceivedPercentage >= 100 ? "Done!" : `${fileReceivedPercentage}%`}
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
                  onClick={() => {
                    closeDialogBox();
                  }}
                >
                  Download File
                </a>
              ) : null}
            </div>
          </div>
        </div>
        <h3 id="userCount">Transmission hasn't started yet!</h3>
      </div>
  );
};

export default FileRecieverInterface;
