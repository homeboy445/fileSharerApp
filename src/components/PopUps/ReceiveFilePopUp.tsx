import React from 'react';
import "./ReceiveFilePopUp.css";

const ReceiveFilePopUp = () => {
  return (
    <div className="receive-file-container-1">
        <h2>To start receiving the file, please enter the unique code below to start the transfer.</h2>
        <input type="text" />
        <button>Validate</button>
    </div>
  );
}

export default ReceiveFilePopUp;
