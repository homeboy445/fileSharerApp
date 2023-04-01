import React, { useRef, useState } from "react";
import "./Hoverable.css";

const Hoverable = ({ element, text }: { element: any; text: string }) => {
  const [isHovering, toggleHover] = useState(false);
  const ref = useRef(null);
  return (
    <div
      className="hoverable"
      onMouseEnter={() => {
        !isHovering && setTimeout(() => toggleHover(true), 100);
      }}
      onMouseLeave={() => {
        toggleHover(false);
      }}
      ref={ref}
    >
      {element}
      <span
        className="tooltip"
        style={{ transform: isHovering ? "scale(1)" : "scale(0)" }}
      >
        {text}
      </span>
    </div>
  );
};

export default Hoverable;
