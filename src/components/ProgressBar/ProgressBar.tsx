import React, { useRef } from "react";
import { v4 } from "uuid";
import DownloadIcon from "../../assets/download.png";
import "./ProgressBar.css";

const ProgressBar = ({
  title,
  percentage,
  isSelected,
  onClickCallback,
  downloadMode,
  style,
}: {
  title: string;
  percentage: number;
  onClickCallback: () => void;
  isSelected: boolean;
  downloadMode?: { enabled: boolean; link: string | null; name: string }
  style?: { progressBar: { color: string; } }
}) => {

  const downloadRef = useRef<HTMLAnchorElement | null>(null);

  const trimLongStrings = (str: string) => {
    if (str.length < 40) {
      return str;
    } else {
      return str.substring(0, 40) + "...";
    }
  };

  const progressBarColor = style ? style.progressBar.color : "blue";
  return (
    <div className="progress-bar-parent">
    <div
      className="progress-bar-main"
      onClick={onClickCallback}
      style={{ border: `2px solid ${isSelected ? progressBarColor : "black"}` }}
      key={v4()}
    >
      <div className="progress-title">
        <p style={{ color: `${isSelected ? progressBarColor : "black"}` }}>
          {percentage}%
        </p>
        <p style={{ color: `${isSelected ? progressBarColor : "black"}` }}>
          {trimLongStrings(title)}
        </p>
      </div>
      <div className="progress-bar-holder">
        <div
          className="progress-bar-wrapper"
          style={{ border: `2px solid ${isSelected ? progressBarColor : "black"}` }}
        >
          <div
            className="progress-bar"
            style={{
              width: `${percentage}%`,
              background: `${isSelected ? "cyan" : progressBarColor}`,
            }}
          ></div>
        </div>
      </div>
    </div>
    {
        downloadMode?.enabled ?
        <>
            <img
             src={DownloadIcon}
             alt="download"
             className="image-link"
             style={{ opacity: downloadMode.link ? 1 : 0.4, cursor: downloadMode.link ? 'pointer' : 'default' }}
             onClick={() => {
                if (downloadMode.link) {
                    if (downloadRef != null) {
                        downloadRef?.current?.click?.();
                    }
                }
             }} />
            {
                downloadMode.link ?
                    <a href={downloadMode.link} download={downloadMode.name} ref={downloadRef}></a>
                : null
            }
        </>
        : null
    }
    </div>
  );
};

export default ProgressBar;
