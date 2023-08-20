import React from "react";
import fileIcon from "../../assets/files.png";
import Hoverable from "../Util/Hoverable";
import "./FileInfoBox.css";

const FileInfoBox = ({
  fileInfo,
}: {
  fileInfo: { name: string; type: string; size: number, fileId?: string | number };
}) => {
  const fileTypeInterceptedFromFileName = fileInfo?.name && fileInfo?.name.substring(
    (fileInfo?.name.lastIndexOf(".") + 1),
    fileInfo?.name.length
  );
  const fileName = fileInfo?.name || "loading...";
  const fileNameElement = fileName.length >= 45 ? <Hoverable element={<span>{fileName}</span>} text={fileName}/> : fileName;
  return (
    <div className="main-file-info-bx">
      <img src={fileIcon} alt="" />
      <h2>File Info</h2>
      <table cellPadding={"10%"}>
        <tbody>
          <tr>
            <td>File Name:</td>
            <td>{fileNameElement}</td>
          </tr>
        </tbody>
        <tbody>
          <tr>
            <td>File Type:</td>
            <td>{fileInfo?.type ||
                (fileTypeInterceptedFromFileName || "loading...")}</td>
          </tr>
        </tbody>
        <tbody>
          <tr>
          <td>File Size:</td>
          <td>{((fileInfo?.size ?? 0) / (1024 * 1024)).toFixed(2)}
              Mb</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default FileInfoBox;
