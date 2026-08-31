import React, { ReactNode } from 'react';

interface ViewportFrameProps {
  children: ReactNode;
}

export const ViewportFrame: React.FC<ViewportFrameProps> = ({ children }) => {
  return (
    <div className="phone-container">
      <div className="phone">
        <div className="phone-header-notch">
          <div className="notch-pill" />
        </div>
        {children}
      </div>
    </div>
  );
};
