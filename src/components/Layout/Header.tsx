import React from 'react';
import { Smartphone, LayoutDashboard, Layers, Globe, Sparkles } from 'lucide-react';
import { Language } from '../../types/bill';

export type AppViewMode = 'phone' | 'dashboard' | 'spec';

interface HeaderProps {
  viewMode: AppViewMode;
  onViewModeChange: (mode: AppViewMode) => void;
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onViewModeChange,
  currentLanguage,
  onLanguageChange
}) => {
  const languages: { code: Language; label: string; native: string }[] = [
    { code: 'en', label: 'EN', native: 'English' },
    { code: 'hi', label: 'HI', native: 'हिंदी' },
    { code: 'ta', label: 'TA', native: 'தமிழ்' },
    { code: 'te', label: 'TE', native: 'తెలుగు' },
    { code: 'ml', label: 'ML', native: 'മലയാളം' }
  ];

  return (
    <header className="header-container">
      <div className="header-top">
        <div>
          <div className="kicker">
            <Sparkles size={14} />
            EXPLAIN MY BILL — PHASE 1 CONSUMER APP FOR INDIA
            <span className="kicker-badge">LIVE APP & SPEC</span>
          </div>
          <h1 className="header-title">Bills decoded in plain language.</h1>
          <p className="header-desc">
            Slab jumps, fake "0% No-Cost EMI" decoders, illegal restaurant service charges, and GST add-ons decoded line-by-line across Tamil Nadu, Kerala, and Telangana.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
          {/* View Mode Switcher */}
          <div className="mode-switcher" role="tablist" aria-label="View Mode">
            <button
              className={`mode-btn ${viewMode === 'phone' ? 'active' : ''}`}
              onClick={() => onViewModeChange('phone')}
              title="Interactive Mobile App Experience"
            >
              <Smartphone size={15} />
              <span>Mobile App</span>
            </button>
            <button
              className={`mode-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
              onClick={() => onViewModeChange('dashboard')}
              title="Full SaaS Web Dashboard"
            >
              <LayoutDashboard size={15} />
              <span>Full Web App</span>
            </button>
            <button
              className={`mode-btn ${viewMode === 'spec' ? 'active' : ''}`}
              onClick={() => onViewModeChange('spec')}
              title="5-Screen Spec Strip Flow"
            >
              <Layers size={15} />
              <span>5-Screen Spec</span>
            </button>
          </div>

          {/* Language Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={13} style={{ color: '#8E96AC' }} />
            <div className="lang-selector">
              {languages.map((l) => (
                <button
                  key={l.code}
                  className={`lang-btn ${currentLanguage === l.code ? 'active' : ''}`}
                  onClick={() => onLanguageChange(l.code)}
                  title={l.native}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
