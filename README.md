# Explain My Bill (EMB) 📜🇮🇳

> **Phase 1 Consumer App for India** — Plain-language Indian bill decoding, slab-jump warnings, fake "No-Cost EMI" debunker, and illegal GST/service charge flags.

---

## 💡 The Problem
Electricity, credit card, EMI, restaurant, supermarket, and hotel bills in India are full of charges consumers don't understand — slab jumps, surcharges, "no cost" EMI that isn't free, and GST add-ons. No app in the Indian market currently explains a bill in plain language — existing apps only let you view or pay it.

## 🚀 Key Features (Phase 1)

1. **Electricity (EB) Bills**:
   - Slab-wise tariff breakdown and fixed vs. energy charges.
   - **Tamil Nadu (TANGEDCO/TNPDCL)**: Telescopic slab calculation, free tier subsidy, threshold alert (*"12 units over 500 mark -> saves ₹410"*).
   - **Kerala (KSEB)**: Telescopic vs non-telescopic penalty barrier at 250 units.
   - **Telangana (TSSPDCL / TSNPDCL)**: Group A, B, and C category audits.
   - **Interactive What-If Unit Simulator**: Live power reduction calculations.

2. **Credit Card & "No-Cost EMI" Debunker**:
   - Exposes how advertised "0% Interest" EMI carries a hidden **13.8% – 19.3% True APR** in India due to processing fees and mandatory 18% GST charged monthly on interest.
   - **"NOT ZERO COST"** red stamp reveal.
   - **Minimum Due Compounding Trap**: Visualizes how paying the 5% min-due keeps consumers in debt for years.
   - **Cross-Verification URL Input**: Paste bank/e-commerce offer links to verify terms.

3. **Restaurant Bills**:
   - Detects illegal mandatory service charge under **CCPA 2022 guidelines** vs 5% composite GST.
   - 1-click CCPA removal letter generator.

4. **Supermarket & Grocery Bills**:
   - Audits branded vs. loose staple GST slabs (0%, 5%, 18%) and MRP discounts.

5. **Hotel Stay Bills**:
   - Audits sub-₹7,500 (12%) vs luxury (18%) GST slabs and mini-bar markups.

6. **Gas Bills**:
   - Domestic PNG SCM consumption charges vs LPG GST.

7. **Multi-View Experience**:
   - **Mobile App Simulator**: Native phone frame with notch and tab navigation.
   - **Full Web App**: Expanded desktop SaaS workspace.
   - **5-Screen Spec Showcase**: Side-by-side interactive flow.

8. **Multi-Language Support**:
   - English, Hindi (हिंदी), Tamil (தமிழ்), Telugu (తెలుగు), and Malayalam (മലയാളം) with Web Speech API read-aloud.

---

## 🛠️ Tech Stack
- **Framework**: Vite + React 19 + TypeScript
- **Design System**: Bespoke Paper & Ink Editorial Design (`#1B2333`, `#E9E6D6`, `#1F2A3D`, `#B33A2E`, `#A9812E`)
- **Typography**: Google Fonts (*Fraunces*, *IBM Plex Sans*, *IBM Plex Mono*)
- **Icons**: Lucide React

---

## 🏁 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/smkrmuthu/emb_app.git
cd emb_app
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run development server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 4. Build for production
```bash
npm run build
npm run preview
```

---

## ⚖️ Legal Disclaimer
*Informational and educational tool only — not financial advice. Statutory references aligned with RBI, CCPA, CBIC, and SERC guidelines.*
