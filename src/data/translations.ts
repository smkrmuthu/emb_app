import { Language } from '../types/bill';

export interface TranslationStrings {
  appName: string;
  tagline: string;
  scanBill: string;
  scanSub: string;
  recent: string;
  reading: string;
  breakdown: string;
  emiFlag: string;
  phase2Teaser: string;
  totalForCycle: string;
  isThisNormal: string;
  disputeBtn: string;
  copyDispute: string;
  notZeroCost: string;
  savingTip: string;
  minimumDueTrap: string;
  verifyBankTerms: string;
  shareFamily: string;
}

export const TRANSLATIONS: Record<Language, TranslationStrings> = {
  en: {
    appName: 'Explain My Bill',
    tagline: 'Plain-language bill decoding for India',
    scanBill: 'Scan a bill',
    scanSub: 'Photo, PDF, or select a sample bill',
    recent: 'RECENT BILLS',
    reading: 'Reading your bill…',
    breakdown: 'Bill Breakdown',
    emiFlag: 'No-Cost EMI Flag',
    phase2Teaser: 'Phase 2 Features',
    totalForCycle: 'Total for this cycle',
    isThisNormal: 'Is this normal?',
    disputeBtn: 'Draft Dispute Letter',
    copyDispute: 'Copy Letter Text',
    notZeroCost: 'NOT ZERO COST',
    savingTip: 'Actionable Savings Tip',
    minimumDueTrap: 'Minimum Due Trap Alert',
    verifyBankTerms: 'Verify against bank’s offer terms',
    shareFamily: 'Share Plain Summary with Family'
  },
  hi: {
    appName: 'मेरा बिल समझाओ',
    tagline: 'भारतीय बिलों का आसान और स्पष्ट विश्लेषण',
    scanBill: 'बिल स्कैन करें',
    scanSub: 'फोटो, पीडीएफ या नमूना बिल चुनें',
    recent: 'हाल के बिल',
    reading: 'आपका बिल पढ़ा जा रहा है…',
    breakdown: 'बिल का पूरा विवरण',
    emiFlag: 'नो-कॉस्ट ईएमआई की सच्चाई',
    phase2Teaser: 'आगामी सुविधाएं',
    totalForCycle: 'इस चक्र का कुल बिल',
    isThisNormal: 'क्या यह सामान्य है?',
    disputeBtn: 'शिकायत पत्र तैयार करें',
    copyDispute: 'पत्र कॉपी करें',
    notZeroCost: 'यह शून्य लागत नहीं है',
    savingTip: 'बचत की सलाह',
    minimumDueTrap: 'न्यूनतम देय राशि का जाल',
    verifyBankTerms: 'बैंक की शर्तों से मिलान करें',
    shareFamily: 'परिवार के साथ साझा करें'
  },
  ta: {
    appName: 'என் பில்லை விளக்குங்கள்',
    tagline: 'இந்திய கட்டண விவரங்களை எளிய தமிழில் புரிந்துகொள்ளுங்கள்',
    scanBill: 'பில் ஸ்கேன் செய்க',
    scanSub: 'புகைப்படம், PDF அல்லது மாதிரி பில் தேர்வு செய்க',
    recent: 'சமீபத்திய பில்கள்',
    reading: 'உங்கள் பில் வாசிக்கப்படுகிறது…',
    breakdown: 'கட்டண முழு விவரம்',
    emiFlag: 'நோ-காஸ்ட் EMI உண்மை நிலை',
    phase2Teaser: 'அடுத்த கட்ட வசதிகள்',
    totalForCycle: 'இந்த சுழற்சிக்கான மொத்த தொகை',
    isThisNormal: 'இது சரியான கட்டணமா?',
    disputeBtn: 'மறுப்பு கடிதம் உருவாக்குக',
    copyDispute: 'கடிதத்தை நகலெடுக்கவும்',
    notZeroCost: 'இது இலவச EMI அல்ல',
    savingTip: 'சேமிப்பு குறிப்பு',
    minimumDueTrap: 'குறைந்தபட்ச தொகை வலை',
    verifyBankTerms: 'வங்கி விதிமுறைகளுடன் சரிபார்க்கவும்',
    shareFamily: 'குடும்பத்தினருடன் பகிரவும்'
  },
  te: {
    appName: 'నా బిల్లును వివరించండి',
    tagline: 'భారతీయ బిల్లుల సరళమైన వివరణ',
    scanBill: 'బిల్లు స్కాన్ చేయండి',
    scanSub: 'ఫోటో, PDF లేదా నమూనా బిల్లును ఎంచుకోండి',
    recent: 'ఇటీవలి బిల్లులు',
    reading: 'మీ బిల్లును చదువుతోంది…',
    breakdown: 'బిల్లు పూర్తి వివరాలు',
    emiFlag: 'నో-కాస్ట్ EMI మోసం హెచ్చరిక',
    phase2Teaser: 'రాబోయే ఫీచర్లు',
    totalForCycle: 'ఈ సైకిల్ మొత్తం బిల్లు',
    isThisNormal: 'ఇది సాధారణమైనదేనా?',
    disputeBtn: 'ఫిర్యాదు లేఖను తయారు చేయండి',
    copyDispute: 'లేఖను కాపీ చేయండి',
    notZeroCost: 'ఇది ఉచితం కాదు',
    savingTip: 'ఆదా చేసుకునే చిట్కా',
    minimumDueTrap: 'కనీస బకాయి వల',
    verifyBankTerms: 'బ్యాంక్ నిబంధనలతో సరిచూడండి',
    shareFamily: 'కుటుంబంతో భాగస్వామ్యం చేయండి'
  },
  ml: {
    appName: 'എന്റെ ബിൽ വിശദീകരിക്കുക',
    tagline: 'ഇന്ത്യൻ ബില്ലുകളുടെ ലളിതമായ വിവരണം',
    scanBill: 'ബിൽ സ്കാൻ ചെയ്യുക',
    scanSub: 'ഫോട്ടോ, PDF അല്ലെങ്കിൽ സാമ്പിൾ ബിൽ നൽകുക',
    recent: 'സമീപകാല ബില്ലുകൾ',
    reading: 'ബിൽ പരിശോധിക്കുന്നു…',
    breakdown: 'ബിൽ വിശദാംശങ്ങൾ',
    emiFlag: 'നോ-കോസ്റ്റ് EMI യാഥാർത്ഥ്യം',
    phase2Teaser: 'പുതിയ ഫീച്ചറുകൾ',
    totalForCycle: 'ഈ മാസത്തെ ആകെ തുക',
    isThisNormal: 'ഇത് ശരിയായ തുകയാണോ?',
    disputeBtn: 'തർക്ക കത്ത് തയാറാക്കുക',
    copyDispute: 'കത്ത് കോപ്പി ചെയ്യുക',
    notZeroCost: 'ഇത് സൗജന്യമല്ല',
    savingTip: 'പണം ലാഭിക്കാനുള്ള നിർദ്ദേശം',
    minimumDueTrap: 'മിനിമം പേയ്മെന്റ് കെണി',
    verifyBankTerms: 'ബാങ്ക് വ്യവസ്ഥകളുമായി ഒത്തുനോക്കുക',
    shareFamily: 'കുടുംബവുമായി പങ്കിടുക'
  }
};
