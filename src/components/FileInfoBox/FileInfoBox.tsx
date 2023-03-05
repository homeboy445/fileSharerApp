import React from 'react';
import fileIcon from "../../assets/files.png";
import "./FileInfoBox.css";

const FileInfoBox = ({ fileInfo }: { fileInfo: { name: string; type: string; size: number } }) => {
  return (
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
  )
}

export default FileInfoBox;
