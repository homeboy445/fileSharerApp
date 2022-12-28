import React, { useState } from "react";
import FileSharerDialog from "./components/FileSharerInterface/main";
import FileSharerImage from "./assets/sendFiles.jpg";
import "./App.css";

const App = () => {
  const [showFileSharerDialog, toggleDialog] = useState(false);

  return (
    <div>
      <div className="container">
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
            <button id="choose-file">Choose File</button>
            <span> ----- OR ----- </span>
            <button id="recieve-file">Recieve File</button>
          </div>
        </div>
      </div>
      <FileSharerDialog />
    </div>
  );
};

export default App;
