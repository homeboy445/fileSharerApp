import React, { useEffect, useRef, useState } from "react";
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import FileInfoBox from "../FileInfoBox/FileInfoBox";
import CONSTANTS from "../../consts/index";
import axios from "axios";
import { FileReciever } from "../../utils/fileHandler";
import "./FileRecieverInterface.css";
import socketInstance from "../../connections/socketIO";

const FileRecieverInterface = ({
  uniqueId,
  closeDialogBox,
  globalUtilStore
}: {
  uniqueId: string;
  closeDialogBox: () => void;
  globalUtilStore?: { logToUI: (message: string) => void, queueMessagesForReloads: (message: string) => void, getUserId: () => string },
}) => {
  const fileReceiverInstance = new FileReciever();
  const localStorageKey = "_fl_sharer_" + uniqueId;

  const [joinedRoom, updateRoomState] = useState(false);
  const [socketIO] = useState(socketInstance.getSocketInstance());
  const [objectLink, updateObjectLink] = useState<string | null>(null);
  const [currentFileName, updateCurrentFileName] = useState<string>("unknown");
  const [fileReceivedPercentage, updateFilePercentage] = useState(0);
  const [fileInfo, updateFileInfo] = useState({
    name: "",
    type: "",
    size: 0,
  });
  const [uniqueUserId] = useState(globalUtilStore?.getUserId());


  const unloadFnRef = useRef((e: any) => {
    e.preventDefault();
    e.returnValue = "";
    const message = "Are you sure about leaving the page?";
    e.returnValue = message;
    return message;
  });

  const checkIfRoomValid = () => {
    if (localStorage.getItem(localStorageKey)) {
      localStorage.removeItem(localStorageKey);
      globalUtilStore?.queueMessagesForReloads("Room Id invalid!");
      window.location.href = "/";
    }
    axios
      .post(CONSTANTS.serverURL + "/isValidRoom", {
        roomId: uniqueId,
      })
      .then(({ data }) => {
        if (!data.status) {
          globalUtilStore?.queueMessagesForReloads("Room Id invalid!");
          window.location.href = "/";
        }
        updateFileInfo({ ...data.fileInfo });
      })
      .catch((e) => {
        globalUtilStore?.queueMessagesForReloads("Some error occurred!");
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
    (fileReceivedPercentage < 100) && checkIfRoomValid();
    if (!joinedRoom) {
      socketIO.emit("join-room", { id: uniqueId, userId: uniqueUserId });
      updateRoomState(true);
    }
    socketIO.on(
      "recieveFile",
      async (data: {
        percentageCompleted?: any;
        packetId?: any;
        totalPackets?: any;
        fileType?: any;
        fileName?: any;
        fileChunkArrayBuffer?: any;
        isProcessing?: any;
        uniqueID?: any;
      }) => {
        console.log("Received the file!", data.packetId);
        fileReceiverInstance.processReceivedChunk(
          data,
          (blobObj: Blob, fileData: { fileName: string }) => {
            updateObjectLink(URL.createObjectURL(blobObj));
            updateCurrentFileName(fileData.fileName);
            globalUtilStore?.logToUI("File transfer successful!");
            localStorage.setItem(localStorageKey, "done");
          }
        );
        updateFilePercentage(data.percentageCompleted || 0);
        socketIO.emit("acknowledge", {
          roomId: uniqueId,
          percentage: data.percentageCompleted,
          packetId: data.packetId,
          userId: uniqueUserId,
        });
      }
    );
    socketIO.on("roomInvalidated", () => {
      if (fileReceivedPercentage < 100) { // In case the transfer is not complete, then it makes sense to just reload!
        globalUtilStore?.queueMessagesForReloads("Sender aborted the file transfer!");
        window.location.href = "/";
      }
    });
    socketIO.on("roomFull:" + uniqueUserId, () => { // TODO: Implement this that when one user leaves the room, its gets one less!
      globalUtilStore?.queueMessagesForReloads("Room at capacity!");
      window.location.href = "/";
    });
    return () => { // TODO: Confirm as when does it run exactly!
        socketIO.off('recieveFile');
        socketIO.off('roomInvalidated');
    };
  }, [objectLink]); // TODO: Study this phenomenon where removing this variable from this dependency array - the above socket callback was getting old values, I think it has something to do with the fact that on each state change I guess the whole function component reference is changed I think;


  return (
    <div className="main-parent">
      <div className="main-container-1">
          <FileInfoBox fileInfo={fileInfo}/>
            <div className="circular-progress-bar-wrapper">
              <CircularProgressbar
                value={fileReceivedPercentage}
                text={fileReceivedPercentage >= 100 ? "Done!" : `${fileReceivedPercentage}%`}
                strokeWidth={1}
                styles={buildStyles({
                  pathColor:
                    "blue",
                  textColor: "blue",
                  trailColor: "grey",
                })}
              />
              {objectLink != null ? (
                <a
                  href={objectLink}
                  id="downloadLink"
                  download={currentFileName}
                  onClick={() => {
                    // socketIO.emit("clientSatisfied", { roomId: uniqueId });
                    closeDialogBox();
                  }}
                >
                  Download File
                </a>
              ) : null}
            </div>
        </div>
        <h3 id="userCount">Transmission hasn't started yet!</h3>
      </div>
  );
};

export default FileRecieverInterface;
