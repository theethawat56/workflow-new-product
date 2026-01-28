import { SHEETS_CONFIG } from "./schema"

export const SEED_TEMPLATES = [
    {
        template_id: "TMP-GENERAL",
        template_name: "General Launch",
        active: true,
    },
]

export const SEED_TEMPLATE_TASKS = [
    // 1. Order Sample Testing
    {
        template_id: "TMP-GENERAL",
        task_code: "OST1",
        task_name: "PI Sample Order",
        phase: "Order Sample Testing",
        default_owner_role: "Ops",
        offset_days: -40,
        duration_days: 5,
        depends_on: "",
        required_fields: "",
        input_type: "file" // Upload File
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "OST2",
        task_name: "Payment",
        phase: "Order Sample Testing",
        default_owner_role: "Finance",
        offset_days: -35,
        duration_days: 2,
        depends_on: "OST1",
        required_fields: "",
        input_type: "file" // Upload File
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "OST3",
        task_name: "Shipment",
        phase: "Order Sample Testing",
        default_owner_role: "Ops",
        offset_days: -33,
        duration_days: 7,
        depends_on: "OST2",
        required_fields: "",
        input_type: "standard"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "OST4",
        task_name: "Testing",
        phase: "Order Sample Testing",
        default_owner_role: "PM",
        offset_days: -26,
        duration_days: 5,
        depends_on: "OST3",
        required_fields: "",
        input_type: "standard"
    },

    // 2. Import Checking
    {
        template_id: "TMP-GENERAL",
        task_code: "IMP1",
        task_name: "HS-Code Checking",
        phase: "Import Checking",
        default_owner_role: "Ops",
        offset_days: -25,
        duration_days: 2,
        depends_on: "",
        required_fields: "",
        input_type: "note" // Noted
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "IMP2",
        task_name: "FDA",
        phase: "Import Checking",
        default_owner_role: "Ops",
        offset_days: -23,
        duration_days: 10,
        depends_on: "IMP1",
        required_fields: "",
        input_type: "standard"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "IMP3",
        task_name: "TISI",
        phase: "Import Checking",
        default_owner_role: "Ops",
        offset_days: -23,
        duration_days: 10,
        depends_on: "IMP1",
        required_fields: "",
        input_type: "standard"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "IMP4",
        task_name: "NBTC",
        phase: "Import Checking",
        default_owner_role: "Ops",
        offset_days: -23,
        duration_days: 10,
        depends_on: "IMP1",
        required_fields: "",
        input_type: "standard"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "IMP5",
        task_name: "DIT",
        phase: "Import Checking",
        default_owner_role: "Ops",
        offset_days: -23,
        duration_days: 10,
        depends_on: "IMP1",
        required_fields: "",
        input_type: "standard"
    },

    // 3. Ordering
    {
        template_id: "TMP-GENERAL",
        task_code: "ORD1",
        task_name: "Ordering and MOQ",
        phase: "Ordering",
        default_owner_role: "Ops",
        offset_days: -30,
        duration_days: 2,
        depends_on: "OST4", // After testing
        required_fields: "",
        input_type: "note"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "ORD2",
        task_name: "PI Ordering",
        phase: "Ordering",
        default_owner_role: "Ops",
        offset_days: -28,
        duration_days: 2,
        depends_on: "ORD1",
        required_fields: "",
        input_type: "file"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "ORD3",
        task_name: "Payment Deposit",
        phase: "Ordering",
        default_owner_role: "Finance",
        offset_days: -26,
        duration_days: 2,
        depends_on: "ORD2",
        required_fields: "",
        input_type: "file"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "ORD4",
        task_name: "Payment Full",
        phase: "Ordering",
        default_owner_role: "Finance",
        offset_days: -10, // Close to shipment
        duration_days: 2,
        depends_on: "ORD3",
        required_fields: "",
        input_type: "file"
    },

    // 4. Product Artwork
    {
        template_id: "TMP-GENERAL",
        task_code: "ART1",
        task_name: "Label",
        phase: "Product Artwork",
        default_owner_role: "Marketing",
        offset_days: -25,
        duration_days: 5,
        depends_on: "OST4",
        required_fields: "",
        input_type: "file"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "ART2",
        task_name: "Inner Box",
        phase: "Product Artwork",
        default_owner_role: "Marketing",
        offset_days: -25,
        duration_days: 5,
        depends_on: "OST4",
        required_fields: "",
        input_type: "file"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "ART3",
        task_name: "Outer Box",
        phase: "Product Artwork",
        default_owner_role: "Marketing",
        offset_days: -25,
        duration_days: 5,
        depends_on: "OST4",
        required_fields: "",
        input_type: "file"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "ART4",
        task_name: "Manual",
        phase: "Product Artwork",
        default_owner_role: "Marketing",
        offset_days: -20,
        duration_days: 5,
        depends_on: "OST4",
        required_fields: "",
        input_type: "file"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "ART5",
        task_name: "Warranty",
        phase: "Product Artwork",
        default_owner_role: "Marketing",
        offset_days: -20,
        duration_days: 5,
        depends_on: "OST4",
        required_fields: "",
        input_type: "file"
    },

    // 5. Shipment
    {
        template_id: "TMP-GENERAL",
        task_code: "SHP1",
        task_name: "ETA",
        phase: "Shipment",
        default_owner_role: "Ops",
        offset_days: -15,
        duration_days: 1,
        depends_on: "ORD3",
        required_fields: "",
        input_type: "standard"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "SHP2",
        task_name: "ETD",
        phase: "Shipment",
        default_owner_role: "Ops",
        offset_days: -14,
        duration_days: 1,
        depends_on: "SHP1",
        required_fields: "",
        input_type: "standard"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "SHP3",
        task_name: "Arrived to inventory",
        phase: "Shipment",
        default_owner_role: "Ops",
        offset_days: -2,
        duration_days: 1,
        depends_on: "SHP2",
        required_fields: "",
        input_type: "standard"
    },

    // 6. Take Sample for KOL
    {
        template_id: "TMP-GENERAL",
        task_code: "KOL1",
        task_name: "Sample Arrival (KOL)", // Renamed to avoid duplicate
        phase: "Take Sample for KOL",
        default_owner_role: "Marketing",
        offset_days: -2,
        duration_days: 1,
        depends_on: "SHP3",
        required_fields: "",
        input_type: "standard"
    },

    // 7. Quality and Claim
    {
        template_id: "TMP-GENERAL",
        task_code: "QC1",
        task_name: "Method Claim",
        phase: "Quality and Claim",
        default_owner_role: "AfterService",
        offset_days: -10,
        duration_days: 5,
        depends_on: "",
        required_fields: "",
        input_type: "note"
    },

    // 8. Content KOL
    {
        template_id: "TMP-GENERAL",
        task_code: "CNT1",
        task_name: "Posting KOL",
        phase: "Content KOL",
        default_owner_role: "Marketing",
        offset_days: 5, // After launch
        duration_days: 10,
        depends_on: "KOL1",
        required_fields: "",
        input_type: "standard"
    },

    // 9. Marketing Content
    {
        template_id: "TMP-GENERAL",
        task_code: "MKT1",
        task_name: "Feature Content",
        phase: "Marketing Content",
        default_owner_role: "Marketing",
        offset_days: -10,
        duration_days: 5,
        depends_on: "OST4", // Spec known
        required_fields: "",
        input_type: "file"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "MKT2",
        task_name: "Video Launch",
        phase: "Marketing Content",
        default_owner_role: "Marketing",
        offset_days: -5,
        duration_days: 5,
        depends_on: "MKT1",
        required_fields: "",
        input_type: "file"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "MKT3",
        task_name: "Video Using",
        phase: "Marketing Content",
        default_owner_role: "Marketing",
        offset_days: -5,
        duration_days: 5,
        depends_on: "MKT1",
        required_fields: "",
        input_type: "file"
    },

    // 10. Product Detail (Notes to be shown on details page)
    {
        template_id: "TMP-GENERAL",
        task_code: "DET1",
        task_name: "Key Feature",
        phase: "Product Detail",
        default_owner_role: "PM",
        offset_days: -30,
        duration_days: 5,
        depends_on: "OST4",
        required_fields: "",
        input_type: "note"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "DET2",
        task_name: "Target Customer",
        phase: "Product Detail",
        default_owner_role: "PM",
        offset_days: -30,
        duration_days: 5,
        depends_on: "OST4",
        required_fields: "",
        input_type: "note"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "DET3",
        task_name: "SpecSheet",
        phase: "Product Detail",
        default_owner_role: "PM",
        offset_days: -30,
        duration_days: 5,
        depends_on: "OST4",
        required_fields: "",
        input_type: "note"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "DET4",
        task_name: "In-Box items",
        phase: "Product Detail",
        default_owner_role: "PM",
        offset_days: -20,
        duration_days: 2,
        depends_on: "OST4",
        required_fields: "",
        input_type: "note"
    },
    {
        template_id: "TMP-GENERAL",
        task_code: "DET5",
        task_name: "Box Dimension",
        phase: "Product Detail",
        default_owner_role: "PM",
        offset_days: -20,
        duration_days: 1,
        depends_on: "ART2", // Inner box known
        required_fields: "",
        input_type: "note"
    },
]
