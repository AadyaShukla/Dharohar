/**
 * Bilingual localization dictionary (Hindi and English) for Dharohar Artist Experience.
 */

export const translations = {
  en: {
    // Top Navigation & Tabs
    app_title: "Dharohar",
    artist_dashboard_tab: "Artist Dashboard",
    onboarding_wizard_tab: "Artist Onboarding",
    operator_review_tab: "Operator Review Queue",
    coordinator_vouch_tab: "Coordinator Vouches",

    // Statuses & Stages
    status_draft: "Draft",
    status_pending_review: "Pending Review",
    status_live: "Live & Booking Ready",
    status_suspended: "Suspended",

    stage_registered: "Registered",
    stage_coordinator_vouched: "Coordinator Vouched",
    stage_video_reviewed: "Video Reviewed",
    stage_trusted: "Trusted Artist",

    // Onboarding Wizard Steps
    step_profile: "1. Profile Details",
    step_rules: "2. Performance Rules",
    step_availability: "3. Availability Calendar",
    step_media: "4. Audition Video & Photos",
    step_upi: "5. UPI Payment Account",
    step_review: "6. Review & Submit",

    // Wizard Controls
    btn_save_next: "Save & Next Step →",
    btn_prev: "← Previous Step",
    btn_save_draft: "Save Draft",
    btn_submit_for_review: "Submit for Verification & Go Live ★",
    btn_back_to_dashboard: "← Back to Dashboard",

    // Step 1: Profile
    label_troupe_name: "Artist / Troupe Name",
    label_art_form: "Authentic Folk Art Form",
    label_city: "Home City / Village",
    label_state: "State",
    label_bio: "Biography & Cultural Background",
    label_experience: "Years of Heritage Experience",
    label_group_size: "Troupe / Group Size",
    label_equipment: "Equipment / Instrument Setup Needed",
    label_languages: "Languages Spoken",

    // Step 2: Rules
    rules_title: "Your Performance Constraints & Guarantees",
    rules_subtitle: "Dharohar protects artists from underpayment. Set your non-negotiable minimum fee and travel boundaries.",
    label_min_fee: "Minimum Performance Fee (₹ INR)",
    label_travel_range: "Maximum Travel Distance (km)",
    label_min_duration: "Minimum Performance Duration (minutes)",
    label_max_group_size: "Maximum Troupe Members Allowed",

    // Step 3: Availability
    avail_title: "Blackout Dates & Regular Rest Days",
    avail_subtitle: "Mark days you are unavailable for festival or event bookings.",
    label_add_blackout_date: "Add Blackout Date (YYYY-MM-DD)",
    btn_add_date: "+ Add Blackout Date",
    label_recurring_days: "Regular Unavailable Days of the Week",

    // Step 4: Media & Live Prompt
    media_title: "Video Audition & Verification",
    media_subtitle: "To prevent identity fraud and showcase your real talent, record a short performance video.",
    live_prompt_title: "★ Required Live Challenge Phrase",
    live_prompt_desc: "You MUST recite this phrase clearly on camera in the first 5 seconds of your video:",
    btn_refresh_prompt: "↻ Generate New Challenge Phrase",
    label_select_video: "Select Audition Video (MP4 only, max 100MB)",
    btn_upload_video: "Upload Audition Video",
    label_select_photo: "Select Performance Photo (JPG/PNG, max 10MB)",
    btn_upload_photo: "Upload Photo",

    // Step 5: UPI
    upi_title: "Secure Payout Account Details",
    upi_subtitle: "All escrow payouts from completed bookings are transferred directly to this UPI ID.",
    label_upi_id: "UPI ID / VPA (e.g. 9876543210@okhdfcbank)",
    upi_security_note: "🔒 Your UPI ID is encrypted at rest using AES-256 Fernet cipher and never exposed publicly.",

    // Step 6: Review
    review_title: "Review Your Listing & Verification Checklist",
    review_subtitle: "Check what is complete and submit your profile to the cultural operator queue for review.",

    // Checklist
    check_profile: "Basic Profile Details",
    check_rules: "Performance Rules & Minimum Fee",
    check_calendar: "Availability Calendar",
    check_video: "Audition Video with Live Code",
    check_upi: "UPI Payout Account",
    check_vouch: "Cultural Coordinator Vouch",

    // Messages
    msg_saved_step: "✓ Step progress saved successfully.",
    msg_submitted: "★ Profile submitted! An operator will review your audition video shortly.",
  },

  hi: {
    // Top Navigation & Tabs
    app_title: "धरोहर",
    artist_dashboard_tab: "कलाकार डैशबोर्ड",
    onboarding_wizard_tab: "कलाकार पंजीकरण",
    operator_review_tab: "ऑपरेटर समीक्षा कतार",
    coordinator_vouch_tab: "समन्वयक प्रमाणन",

    // Statuses & Stages
    status_draft: "ड्राफ्ट (अपूर्ण)",
    status_pending_review: "समीक्षा लंबित",
    status_live: "लाइव एवं बुकिंग के लिए तैयार",
    status_suspended: "निलंबित",

    stage_registered: "पंजीकृत",
    stage_coordinator_vouched: "समन्वयक प्रमाणित",
    stage_video_reviewed: "वीडियो सत्यापित",
    stage_trusted: "विश्वसनीय लोक कलाकार (Trusted)",

    // Onboarding Wizard Steps
    step_profile: "१. प्रोफ़ाइल विवरण",
    step_rules: "२. प्रस्तुति नियम एवं शुल्क",
    step_availability: "३. उपलब्धता कैलेंडर",
    step_media: "४. ऑडिशन वीडियो व तस्वीरें",
    step_upi: "५. यूपीआई भुगतान खाता",
    step_review: "६. समीक्षा एवं सबमिट",

    // Wizard Controls
    btn_save_next: "सहेजें और आगे बढ़ें →",
    btn_prev: "← पिछला चरण",
    btn_save_draft: "ड्राफ्ट सहेजें",
    btn_submit_for_review: "सत्यापन हेतु सबमिट करें ★",
    btn_back_to_dashboard: "← डैशबोर्ड पर वापस",

    // Step 1: Profile
    label_troupe_name: "कलाकार अथवा मंडली का नाम",
    label_art_form: "पारंपरिक लोक कला विधा",
    label_city: "गृह नगर / गाँव",
    label_state: "राज्य",
    label_bio: "परिचय एवं सांस्कृतिक विरासत",
    label_experience: "अनुभव (वर्षों में)",
    label_group_size: "मंडली के सदस्यों की संख्या",
    label_equipment: "आवश्यक वाद्ययंत्र व ध्वनि उपकरण",
    label_languages: "बोली जाने वाली भाषाएँ",

    // Step 2: Rules
    rules_title: "आपकी प्रस्तुति नियम एवं न्यूनतम शुल्क",
    rules_subtitle: "धरोहर कलाकारों को कम भुगतान से सुरक्षित करता है। अपना न्यूनतम शुल्क और यात्रा सीमा तय करें।",
    label_min_fee: "न्यूनतम प्रस्तुति शुल्क (₹ रुपये में)",
    label_travel_range: "अधिकतम यात्रा सीमा (कि.मी.)",
    label_min_duration: "न्यूनतम प्रस्तुति समय (मिनट)",
    label_max_group_size: "अधिकतम कलाकार संख्या",

    // Step 3: Availability
    avail_title: "अनुपलब्ध तिथियाँ एवं विश्राम दिवस",
    avail_subtitle: "जिन तिथियों पर आप कार्यक्रम हेतु उपलब्ध नहीं हैं, उन्हें यहाँ जोड़ें।",
    label_add_blackout_date: "अनुपलब्ध तिथि जोड़ें (YYYY-MM-DD)",
    btn_add_date: "+ तिथि जोड़ें",
    label_recurring_days: "साप्ताहिक विश्राम दिवस (उदा. सोमवार)",

    // Step 4: Media & Live Prompt
    media_title: "ऑडिशन वीडियो एवं सत्यापन",
    media_subtitle: "अपनी वास्तविक कला प्रदर्शित करने हेतु एक लघु प्रस्तुति वीडियो अपलोड करें।",
    live_prompt_title: "★ लाइव सत्यापन वाक्यांश (अनिवार्य)",
    live_prompt_desc: "वीडियो के आरंभ में प्रथम ५ सेकंड में यह वाक्यांश स्पष्ट रूप से बोलें:",
    btn_refresh_prompt: "↻ नया वाक्यांश प्राप्त करें",
    label_select_video: "ऑडिशन वीडियो चुनें (केवल .mp4, अधिकतम 100MB)",
    btn_upload_video: "वीडियो अपलोड करें",
    label_select_photo: "कला प्रदर्शन तस्वीर चुनें (JPG/PNG, अधिकतम 10MB)",
    btn_upload_photo: "तस्वीर अपलोड करें",

    // Step 5: UPI
    upi_title: "सुरक्षित भुगतान (UPI) विवरण",
    upi_subtitle: "सफल कार्यक्रम समापन के उपरांत ट्रस्टपे एस्क्रो राशि सीधे इस यूपीआई आईडी पर भेजी जाएगी।",
    label_upi_id: "UPI ID / VPA (उदा. 9876543210@okhdfcbank)",
    upi_security_note: "🔒 आपकी यूपीआई आईडी डेटाबेस में AES-256 सिफर द्वारा पूर्णतः एन्क्रिप्टेड है।",

    // Step 6: Review
    review_title: "लिस्टिंग विवरण एवं सत्यापन चेकलिस्ट",
    review_subtitle: "अपनी जानकारी की समीक्षा करें और सत्यापन हेतु ऑपरेटर को प्रेषित करें।",

    // Checklist
    check_profile: "मूल प्रोफ़ाइल विवरण",
    check_rules: "प्रस्तुति नियम एवं न्यूनतम शुल्क",
    check_calendar: "उपलब्धता कैलेंडर",
    check_video: "ऑडिशन वीडियो व लाइव कोड",
    check_upi: "यूपीआई भुगतान खाता",
    check_vouch: "सांस्कृतिक समन्वयक प्रमाणन",

    // Messages
    msg_saved_step: "✓ चरण सफलतापूर्वक सहेजा गया।",
    msg_submitted: "★ प्रोफ़ाइल सबमिट हो गई! ऑपरेटर शीघ्र ही वीडियो समीक्षा करेंगे।",
  },
};

export function getTranslation(key, lang = 'hi') {
  const currentLang = lang in translations ? lang : 'hi';
  return translations[currentLang][key] || translations['en'][key] || key;
}
