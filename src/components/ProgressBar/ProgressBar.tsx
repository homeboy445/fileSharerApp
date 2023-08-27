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
  styleConfig,
}: {
  title: string;
  percentage: number;
  onClickCallback: () => void;
  isSelected: boolean;
  downloadMode?: { enabled: boolean; link: string | null; name: string }
  styleConfig?: { progressBar?: { color: string; }, borderEnabled?: boolean, css?: Record<string, string | number> }
}) => {

  const downloadRef = useRef<HTMLAnchorElement | null>(null);

  const trimLongStrings = (str: string) => {
    if (str.length < 40) {
      return str;
    } else {
      return str.substring(0, 40) + "...";
    }
  };

  // default settings!
  styleConfig = {
    progressBar: { color: "blue" },
    borderEnabled: true,
    ...styleConfig,
    css: {}
  };

  const progressBarColor = styleConfig ? styleConfig?.progressBar?.color : "blue";
  return (
    <div className="progress-bar-parent" key={v4()}>
    <div
      className="progress-bar-main"
      onClick={onClickCallback}
      style={{ border: styleConfig?.borderEnabled ? `2px solid ${isSelected ? progressBarColor : "black"}` : "none" }}
    >
      <div className="progress-title" style={(styleConfig?.css || {})}>
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
          style={{ border: styleConfig?.borderEnabled ? `2px solid ${isSelected ? progressBarColor : "black"}` : "none" }}
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
