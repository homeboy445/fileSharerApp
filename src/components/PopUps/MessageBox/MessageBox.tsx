import React, { useEffect, useState } from "react";
import { v4 } from "uuid";
import "./MessageBox.css";

const MessageBox = ({
  messageObj,
  duration,
  durationCompleteCallback,
  messageBoxIndex,
}: {
  messageObj: { message: string, id: string };
  duration?: number;
  durationCompleteCallback: (id: string) => void;
  messageBoxIndex?: number;
}) => {
  const [messageDurationBar, updateMessageDurationBar] = useState<number>(0);

  useEffect(() => {
    if (messageDurationBar < 100) {
      setTimeout(() => {
        updateMessageDurationBar(messageDurationBar + 1);
      }, duration ?? 15);
    } else {
      durationCompleteCallback(messageObj.id);
    }
  }, [messageDurationBar]);

  return (
    <div
      className="message-box"
      style={{
        top: `${10 + (messageBoxIndex || 0) * 10}%`,
        transform: messageDurationBar < 100 ? "scale(1)" : "translateX(150%)",
      }}
    >
      <h3>{messageObj.message}</h3>
      <div
        className="msg-duration-bar"
        style={{ width: `${messageDurationBar}%` }}
      ></div>
    </div>
  );
};

export default MessageBox;
