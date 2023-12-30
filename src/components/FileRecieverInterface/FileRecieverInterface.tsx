import React, { useContext, useEffect, useRef, useState } from "react";
import FileInfoBox from "../FileInfoBox/FileInfoBox";
import axios from "axios";
import { FilePacketAdditional, fileTransferrer, p2pFilePacket } from "../../utils/fileHandler";
import "./FileRecieverInterface.css";
import socketInstance from "../../connections/socketIO";
import ProgressBar from "../ProgressBar/ProgressBar";
import { globalDataContext } from "../../contexts/context";
import p2pManager, { P2PEvents } from "../../utils/p2pManager";
import fileTransferFacilitator from "../../transferModes";

type FileInfo = { name: string; type: string; size: number; fileId: number; link?: string; };

const FileRecieverInterface = ({
  roomId,
}: {
  roomId: string;
}) => {

  const globalUtilStore = useContext(globalDataContext);

  const localStorageKey = "_fl_sharer_" + roomId;

  const downloadRef = useRef<HTMLAnchorElement | null>(null);

  const [joinedRoom, updateRoomState] = useState(false);
  const [socketIO] = useState(socketInstance.getSocketInstance());
  const [fileReceivedPercentage, updateFilePercentage] = useState<{ [fileId: string]: number }>({});
  const [filesInfo, updateFilesInfo] = useState<Array<FileInfo>>([]);
  const [madeRoomInfoRequest, updateRoomInfoRequest] = useState(false);
  const [selectedFileIndex, updateSelectedFileIndex] = useState(0);
  const [uniqueUserId] = useState(globalUtilStore?.getUserId());
  const [transmissionBegan, updateTransmissionStatus] = useState(false);
  const [fileTransferComplete, updateFileTransferStatus] = useState(false);
  const sessionTimeouts = useRef<NodeJS.Timeout[]>([]);

  const unloadFnRef = useRef((e: any) => {
    e.preventDefault();
    e.returnValue = "";
    const message = "Are you sure about leaving the page?";
    e.returnValue = message;
    return message;
  });

  const checkRoomValidityAndFetchInfo = () => {
    if (localStorage.getItem(localStorageKey) === roomId) { // TODO: Test this before merging!
      localStorage.removeItem(localStorageKey); // To prevent re-joining!
      globalUtilStore?.queueMessagesForReloads("Room Id invalid!");
      window.location.href = "/";
    }
    updateRoomInfoRequest(true);
    axios
      .post(
        globalUtilStore.serverUrl + "/isValidRoom",
        {
          roomId: roomId,
        }
      )
      .then(({ data }: { data: { status: boolean; filesInfo: FileInfo[] } }) => {
        if (!data.status || Object.keys(data?.filesInfo || {}).length === 0) {
          globalUtilStore?.queueMessagesForReloads("Room Id invalid!");
          window.location.href = "/";
        }
        updateFilesInfo(data.filesInfo);
        localStorage.setItem(localStorageKey, roomId);
      })
      .catch(() => {
        globalUtilStore?.queueMessagesForReloads("Some error occurred!");
        window.location.href = "/";
      });
  };

  const updatePercentage = (fileId: number, percentage: number) => {
    const percentageStore = Object.assign({}, fileReceivedPercentage);
    percentageStore[fileId] = percentage;
    updateFilePercentage(percentageStore);
  }

  const attackUnloadListener = () => {
    console.log("attached the unload listener!");
    window.addEventListener("beforeunload", unloadFnRef.current);
  };

  const removeUnloadListener = () => {
    console.log("removed the unload listener!");
    window.removeEventListener("beforeunload", unloadFnRef.current);
  };

  const isFileTransferComplete = (): boolean => {
    delete fileReceivedPercentage['-1'];
    return Object.values(fileReceivedPercentage).every(value => value === 100);
  }

  const p2pFileTransferComplete = (): boolean => {
    return filesInfo.every(fileInfo => !!fileInfo.link);
  }

  const p2pOnFileReceive = (dataObj: {
    name: string;
    type: string;
    size: number;
    link: string;
    fileId: number;
  }) => {
    console.log("File received: ", dataObj.name);
    let linkReceived = 0;
    for (let idx = 0; idx < filesInfo.length; idx++) {
      if (filesInfo[idx].fileId === dataObj.fileId) {
        filesInfo[idx].link = dataObj.link;
      }
      if (filesInfo[idx].link) {
        linkReceived++;
      }
    }
    updateFileTransferStatus(linkReceived === filesInfo.length);
    updateFilesInfo([ ...filesInfo ]);
  }

  const p2pOnProgress = (fileObject: p2pFilePacket) => {
    if (fileObject.fileId && fileObject.fileId !== -1 && filesInfo.length !== 0) {
      updatePercentage(fileObject.fileId, fileObject.percentage);
    }
  }

  const p2pOnConnectionClosed = () => {
    for (let idx = 0; idx < filesInfo.length; idx++) {
      if (!filesInfo[idx].link) { // TODO: Add a better handling!
        globalUtilStore.queueMessagesForReloads("Connection closed!");
        window.location.href = "/";
      }
    }
  };

  useEffect(() => {
    if (filesInfo.length === 0 && !madeRoomInfoRequest) {
      checkRoomValidityAndFetchInfo();
    }
    if (!joinedRoom) {
      socketIO.emit("join-room", { id: roomId, userId: uniqueUserId });
      updateRoomState(true);
    }
    socketInstance.setRoom(roomId);
    fileTransferFacilitator.listenToFileRecieveEvents({
      additionalData: { uniqueUserId },
      onFileReceiveCallback: async (data: FilePacketAdditional) => {
        sessionTimeouts.current.forEach((timeout) => clearTimeout(timeout));
        sessionTimeouts.current = [];
        if (!transmissionBegan) {
          updateTransmissionStatus(true);
        }
        if (data.percentageCompleted === 100) {
          updateFileTransferStatus(isFileTransferComplete());
        } else {
          sessionTimeouts.current.push(setTimeout(() => {
            globalUtilStore.queueMessagesForReloads("Session timedout!");
            socketIO.disconnect();
            window.location.href = "/";
          }, 15000));
        }
        fileTransferrer.receive(data);
        updatePercentage(data.uniqueID, data.percentageCompleted);
        socketIO.emit("acknowledge", {
          roomId: roomId,
          percentage: data.percentageCompleted,
          packetId: data.packetId,
          userId: uniqueUserId,
          senderId: data.senderId,
          fileId: data.uniqueID
        });
      },
      onRoomInvalidation: (data: { fileTransferComplete: boolean }) => {
        if (!(data.fileTransferComplete || fileTransferComplete || isFileTransferComplete() || p2pFileTransferComplete())) {
          // In case the transfer is not complete, then it makes sense to just reload!
          globalUtilStore?.queueMessagesForReloads(
            "Sender aborted the file transfer!"
          );
          window.location.href = "/";
        }
      },
      onRoomFullCallback: () => {
        // TODO: Implement this that when one user leaves the room, its gets one less!
        globalUtilStore?.queueMessagesForReloads("Room at capacity!");
        window.location.href = "/";
      }
    });
    return () => {
      // TODO: Confirm as when does it run exactly!
      socketIO.off("recieveFile");
      socketIO.off("roomInvalidated");
    };
  }, [filesInfo, fileReceivedPercentage]); // TODO: Study this phenomenon where removing this variable from this dependency array - the above socket callback was getting old values, I think it has something to do with the fact that on each state change I guess the whole function component reference is changed I think;

  useEffect(() => {
    p2pManager.initiate(socketIO, {
      uuid: roomId,
      initiator: globalUtilStore.isInitiator 
    });
    // eventBus now supports auto - off!
    p2pManager.on(P2PEvents.PROGRESS, p2pOnProgress);
    p2pManager.on(P2PEvents.FILE_RECEIVED, p2pOnFileReceive);
    p2pManager.on(P2PEvents.CONNECTION_CLOSED, p2pOnConnectionClosed);
  }, [filesInfo]);

  return (
    <div className="main-parent">
      {/* {
        !fileTransferComplete ? <h3 id="userCount">{transmissionBegan ? "Transmission ongoing..." : "Transmission hasn't started yet!"}</h3>
        : null
      } */}
      {
        filesInfo.length > 0 ?
          !globalUtilStore?.isNonDesktopDevice
          ?
          <>
            <div className="main-container-1">
              <FileInfoBox fileInfo={filesInfo[selectedFileIndex]} />
              <div
                className="progress-bar-list"
                style={{ overflowY: filesInfo.length > 4 ? "scroll" : "hidden" }}
              >
                {filesInfo.map((fileObject, fileIndex) => {
                  return (
                    <ProgressBar
                      title={fileObject.name}
                      percentage={fileReceivedPercentage[fileObject.fileId] || (fileReceivedPercentage[fileObject.fileId] = 0)}
                      isSelected={fileIndex === selectedFileIndex}
                      onClickCallback={() => {
                        updateSelectedFileIndex(fileIndex);
                      }}
                      downloadMode={{
                        enabled: true,
                        link: fileTransferrer.getFileDownloadLink(fileObject.fileId) || filesInfo[fileIndex].link,
                        name: fileObject.name
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <button className="cancel-button" style={{ background: fileTransferComplete ? "#000cee" : "#f51919" }} onClick={() => {
              window.location.href = "/";
            }}>
              {
                fileTransferComplete ? "Done" : "Cancel"
              }
            </button>
          </>
          :
          <div className="main-container-mobile-1">
          <div className="mobile-sending-section-1">
            <div className="mobile-sending-button-1" style={ filesInfo.length > 1 ? {} : { visibility: "hidden", marginTop: "5%", marginBottom: "1%" } }>
                <button disabled={selectedFileIndex === 0} onClick={() => {
                  updateSelectedFileIndex(selectedFileIndex - 1);
                }}>Prev.</button>
                <button disabled={selectedFileIndex + 1 === filesInfo.length} onClick={() => {
                  updateSelectedFileIndex(selectedFileIndex + 1);
                }}>Next</button>
            </div>
            <FileInfoBox fileInfo={filesInfo[selectedFileIndex]} />
            <div style={{ marginTop: "10%" }}>
                {
                  <ProgressBar
                    title={(+fileReceivedPercentage[filesInfo[selectedFileIndex].fileId] || 0) === 0 ? "Stand by" : (+fileReceivedPercentage[filesInfo[selectedFileIndex].fileId]) < 100 ? "Receiving..." : "Done"}
                    percentage={fileReceivedPercentage[filesInfo[selectedFileIndex].fileId] || (fileReceivedPercentage[filesInfo[selectedFileIndex].fileId] = 0)}
                    isSelected={false}
                    onClickCallback={() => {}}
                    styleConfig={{ borderEnabled: true, css: { fontSize: "1rem" } }}
                  />
                }
            </div>
            <div className="main-file-send-cancel" style={{ marginTop: "5%" }}>
              <button
                disabled={(+fileReceivedPercentage[filesInfo[selectedFileIndex]?.fileId] || 0) < 100}
                onClick={() => {
                  if (!downloadRef) {
                    return;
                  }
                  downloadRef.current?.click();
                }}
              >
                Download
              </button>
              <button
                style={{ background: fileTransferComplete ? "green" : "red" }}
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                {
                  fileTransferComplete ? "Done" : "Cancel"
                }
              </button>
              {
                // eslint-disable-next-line jsx-a11y/anchor-has-content
                <a href={`${fileTransferrer.getFileDownloadLink(filesInfo[selectedFileIndex].fileId) || filesInfo[selectedFileIndex].link}`}
                  download={true}
                  style={{display:"none"}}
                  ref={downloadRef}
                ></a>
              }
            </div>
          </div>
          </div>
        :
        <h1>Loading...</h1>
      }
    </div>
  );
};

export default FileRecieverInterface;
