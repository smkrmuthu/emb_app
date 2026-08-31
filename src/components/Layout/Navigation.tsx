import React from 'react';
import { Home, ReceiptText, Percent, BellRing } from 'lucide-react';

export type AppTab = 'home' | 'breakdown' | 'emi' | 'phase2';

interface NavigationProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  hasActiveBill?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  hasActiveBill = false
}) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'breakdown', label: 'Breakdown', icon: ReceiptText, disabled: !hasActiveBill },
    { id: 'emi', label: 'EMI Flag', icon: Percent },
    { id: 'phase2', label: 'Reminders', icon: BellRing }
  ] as const;

  return (
    <nav className="app-navbar" aria-label="Bottom Navigation">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id as AppTab)}
            title={tab.label}
          >
            <div className="nav-dot" />
            <Icon size={16} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
