import React, { useContext } from "react";
import ImageIcon from "../../assets/photo.png";
import VideoIcon from "../../assets/film.png";
import AudioIcon from "../../assets/music.png";
import ZipIcon from "../../assets/zip-file.png";
import DocumentIcon from "../../assets/document.png";

import Hoverable from "../Util/Hoverable";
import "./FileInfoBox.css";
import { globalDataContext } from "../../contexts/context";

const FileInfoBox = ({
  fileInfo,
  receivedInfoStore,
}: {
  fileInfo: {
    name: string;
    type: string;
    size: number;
    fileId?: string | number;
  };
  receivedInfoStore: { [fileId: string]: number };
}) => {
  const globalUtilStore = useContext(globalDataContext);

  const getFileIcon = (fileName: string): string => {
    const fileIcons: { [fileType: string]: string } = {
      image: ImageIcon,
      video: VideoIcon,
      audio: AudioIcon,
      zip: ZipIcon,
      document: DocumentIcon,
    };
    const extensions: { [fileType: string]: Array<string> } = {
      image: ["jpg", "jpeg", "png", "gif", "bmp", "svg"],
      video: ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm"],
      audio: ["mp3", "wav", "ogg", "flac", "aac"],
      zip: ["zip", "rar", "7z", "tar", "gz"],
      // document: ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt"],
    };

    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    if (!extension) {
      return DocumentIcon;
    }

    for (const type in extensions) {
      if (extensions[type].includes(extension)) {
        return fileIcons[type];
      }
    }

    return DocumentIcon;
  };

  const fileTypeInterceptedFromFileName = fileInfo.name.substring(
    fileInfo.name.lastIndexOf(".") + 1,
    fileInfo.name.length
  );
  const fileName = fileInfo.name || "loading...";
  const fileNameElement =
    fileName.length >= 45 && !globalUtilStore.isNonDesktopDevice ? (
      <Hoverable element={<span>{fileName}</span>} text={fileName} />
    ) : (
      fileName
    );
  console.log("fileinfo -> ", fileInfo);
  return (
    <div className="main-file-info-bx">
      <img src={getFileIcon(fileName)} alt="" />
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
            <td>
              {fileInfo.type || fileTypeInterceptedFromFileName || "loading..."}
            </td>
          </tr>
        </tbody>
        <tbody>
          <tr>
            <td>File Size:</td>
            <td>
              {(fileInfo.size / (1024 * 1024)).toFixed(2)}
              Mb
            </td>
          </tr>
        </tbody>
        {/* <tbody>
          <tr>
            <td>Data received:</td>
            <td>{receivedInfoStore[fileInfo.fileId || ""] || 0} Mb</td>
          </tr>
        </tbody> */}
      </table>
    </div>
  );
};

export default FileInfoBox;
