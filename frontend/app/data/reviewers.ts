export type Reviewer = {
  id: string;
  name: string;
  code: string;
  slug: string;
  stacks: string[];
};

export const reviewers: Reviewer[] = [
  { id: "1", name: "Vipin", code: "BR 64", slug: "br-64", stacks: [] },
  { id: "2", name: "Anwar", code: "BR 12", slug: "br-12", stacks: [] },
  { id: "3", name: "Sreejith", code: "BR 07", slug: "br-07", stacks: [] },
  { id: "4", name: "Rashid", code: "BR 45", slug: "br-45", stacks: [] },
  { id: "5", name: "Nizam", code: "BR 31", slug: "br-31", stacks: [] },
  { id: "6", name: "Faiz", code: "BR 19", slug: "br-19", stacks: [] },
  { id: "7", name: "Ajmal", code: "BR 53", slug: "br-53", stacks: [] },
  { id: "8", name: "Shameer", code: "BR 88", slug: "br-88", stacks: [] },
  { id: "9", name: "Noufal", code: "BR 22", slug: "br-22", stacks: [] },
  { id: "10", name: "Subin", code: "BR 76", slug: "br-76", stacks: [] },
  { id: "11", name: "Arun", code: "BR 03", slug: "br-03", stacks: [] },
  { id: "12", name: "Deepak", code: "BR 41", slug: "br-41", stacks: [] },
  { id: "13", name: "Jithin", code: "BR 58", slug: "br-58", stacks: [] },
  { id: "14", name: "Hafiz", code: "BR 35", slug: "br-35", stacks: [] },
  { id: "15", name: "Shibin", code: "BR 90", slug: "br-90", stacks: [] },
  { id: "16", name: "Riyas", code: "BR 14", slug: "br-14", stacks: [] },
  { id: "17", name: "Vineeth", code: "BR 67", slug: "br-67", stacks: [] },
  { id: "18", name: "Suhail", code: "BR 29", slug: "br-29", stacks: [] },
  { id: "19", name: "Ashiq", code: "BR 82", slug: "br-82", stacks: [] },
  { id: "20", name: "Nabeel", code: "BR 06", slug: "br-06", stacks: [] },
  {
    id: "test-reviewer",
    name: "Test Reviewer",
    code: "BR-TEST",
    slug: "br-test",
    stacks: ["React", "Node.js"]
  }
];
