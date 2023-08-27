import React, { useRef, useState } from "react";
import "./Hoverable.css";

const Hoverable = ({ element, text }: { element: any; text: string }) => {
  const [isHovering, toggleHover] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const computeCoordinates = () => {
    if (ref == null) {
      return null;
    }
    const boundRecForElement = ref.current?.getBoundingClientRect();
    const elementParentBoundRect = ref.current?.parentElement?.getBoundingClientRect();
    if (!boundRecForElement || !elementParentBoundRect) {
      return null;
    }
    return {
      left: Math.abs(boundRecForElement.left - elementParentBoundRect.left)
    };
  };

  const computedCoordinatesForTip = computeCoordinates();
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
          ...(computedCoordinatesForTip != null
            ? {
                left:
                  computedCoordinatesForTip.left +
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
