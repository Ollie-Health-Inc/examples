export type Flag = "normal" | "high" | "low" | "critical";

export type LabResult = {
  // Use the test's full name. The agent passes it on to the reference lookup, and full names match more often.
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: Flag;
};

export type SampleSet = {
  label: string;
  takenOn: string;
  results: LabResult[];
};

export const SAMPLE_SETS: SampleSet[] = [
  {
    label: "Blood sugar and vitamin D",
    takenOn: "10 November",
    results: [
      {
        name: "HbA1c",
        value: "6.1",
        unit: "%",
        referenceRange: "4.0-5.6",
        flag: "high",
      },
      {
        name: "LDL cholesterol",
        value: "2.9",
        unit: "mmol/L",
        referenceRange: "< 3.0",
        flag: "normal",
      },
      {
        name: "Vitamin D (25-OH)",
        value: "42",
        unit: "nmol/L",
        referenceRange: "50-125",
        flag: "low",
      },
    ],
  },
  {
    label: "Full blood count",
    takenOn: "3 November",
    results: [
      {
        name: "Haemoglobin",
        value: "118",
        unit: "g/L",
        referenceRange: "120-155",
        flag: "low",
      },
      {
        name: "White blood cell count",
        value: "6.2",
        unit: "x10^9/L",
        referenceRange: "4.0-11.0",
        flag: "normal",
      },
      {
        name: "Platelet count",
        value: "250",
        unit: "x10^9/L",
        referenceRange: "150-400",
        flag: "normal",
      },
    ],
  },
  {
    label: "Thyroid, all in range",
    takenOn: "28 October",
    results: [
      {
        name: "Thyroid stimulating hormone",
        value: "2.1",
        unit: "mIU/L",
        referenceRange: "0.4-4.0",
        flag: "normal",
      },
      {
        name: "Free thyroxine (T4)",
        value: "15",
        unit: "pmol/L",
        referenceRange: "12-22",
        flag: "normal",
      },
    ],
  },
  {
    label: "Critical potassium",
    takenOn: "12 November",
    results: [
      {
        name: "Potassium",
        value: "6.8",
        unit: "mmol/L",
        referenceRange: "3.5-5.1",
        flag: "critical",
      },
      {
        name: "Sodium",
        value: "139",
        unit: "mmol/L",
        referenceRange: "135-145",
        flag: "normal",
      },
    ],
  },
];

// One readable line per test. The agent asks for a unit or range that's missing, so leave them out when blank.
export function resultLine(result: LabResult) {
  const value = [result.value, result.unit].filter(Boolean).join(" ");
  const notes = [
    result.referenceRange && `reference range ${result.referenceRange}`,
    result.flag === "normal" ? "normal" : `flagged ${result.flag}`,
  ].filter(Boolean);
  return `- ${result.name}: ${value} (${notes.join(", ")})`;
}
