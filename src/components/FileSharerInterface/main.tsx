
import React from 'react';
import fileIcon from "../../assets/files.png";
import "./main.css";

const main = () => {
  return (
    <div className='main-container-1'>
      <div className='main-file-info-bx'>
        <img src={fileIcon} alt="" />
        <h2>File Info</h2>
        <ul>
          <li>File Name: Something.mp3</li>
          <li>File type: mp3</li>
          <li>File size: 1Mb</li>
        </ul>
      </div>
      <div className='main-file-transmission-section'>
        <div className='main-file-link-handle'>
          <div>QR CODE</div>
          <input type="text" />
        </div>
        <div className="main-file-send-cancel">
          <button>Send File</button>
          <button>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default main;
