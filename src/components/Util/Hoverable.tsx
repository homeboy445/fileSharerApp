import React, { useRef, useState } from "react";
import "./Hoverable.css";

const Hoverable = ({ element, text }: { element: any; text: string }) => {
  const [isHovering, toggleHover] = useState(false);
  const ref = useRef(null);
  const getBoundRect = ref.current !== null ? (ref.current as any).getBoundingClientRect() : {};

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
        style={{
          transform: isHovering ? "scale(1)" : "scale(0)",
          ...(ref.current != null
            ? {
                top:
                  Math.round(getBoundRect.top + 100) +
                  "px",
                left:
                  Math.round(getBoundRect.left - 200) +
                  "px",
              }
            : {}),
        }}
      >
        {text}
      </span>
    </div>
  );
};

export default Hoverable;
