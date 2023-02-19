import React, { useState, useRef, useEffect } from "react";
import FileSharerDialog from "./components/FileSharerInterface/FileSharerDialog";
import FileSharerImage from "./assets/sendFiles.jpg";
import FileHandler from "./utils/fileHandler";
import { v4 as uuidv4 } from 'uuid';
import "./App.css";

const App = () => {
  const [showFileSharerDialog, toggleDialog] = useState(false);
  const [fileObject, updateFileObject] = useState<File | null>(null);
  const fileRef = useRef(null);

  const getParamsObject = () => {
    const URL = window.location.href;
    const indexOfQueryStart = URL.indexOf("?");
    const queryParams = { id: null };
    if (indexOfQueryStart !== -1) {
      URL.slice(indexOfQueryStart + 1).split('&').reduce((prev, curr) => {
        const [name, value] = curr.split('=');
        (prev as any)[name] = value;
        return prev;
      }, queryParams);
    }
    return queryParams;
  }

  const queryParams = getParamsObject();

  useEffect(() => {
    console.log("qParams: ", queryParams['id']);
    if (!!queryParams['id'] && !showFileSharerDialog) {
      toggleDialog(true);
    }
  }, [showFileSharerDialog]);

  return (
    <div>
      <div
        className="container"
        style={{
          opacity: showFileSharerDialog ? "0.4" : "1",
          pointerEvents: showFileSharerDialog ? "none" : "all",
          backdropFilter: showFileSharerDialog ? 'none' : 'blur(5%)'
        }}
      >
        <div className="msg-box-1">
          <h1>Welcome, to FileSharer.io!!!</h1>
          <h2>
            Share your files with your peers in an instant without any hassle.
          </h2>
          <ul>
            <li>✅Share any file type</li>
            <li>✅Send upto 100Mb of data</li>
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
      {(showFileSharerDialog && fileObject !== null) || !!queryParams['id'] ? (
        <FileSharerDialog
          fileHandlerInstance={!fileObject ? null : new FileHandler(fileObject)}
          closeDialogBox={() => {
            window.location.href = "/";
            toggleDialog(false);
          }}
          uniqueId={queryParams['id'] ?? uuidv4()}
          recieveFile={!!queryParams['id']}
        />
      ) : null}
    </div>
  );
};

export default App;
