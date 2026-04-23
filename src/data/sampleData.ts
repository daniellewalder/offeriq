export interface Offer {
  id: string;
  buyerName: string;
  agentName: string;
  agentBrokerage: string;
  offerPrice: number;
  financingType: string;
  downPayment: number;
  downPaymentPercent: number;
  earnestMoney: number;
  contingencies: string[];
  inspectionPeriod: string;
  appraisalTerms: string;
  closeTimeline: string;
  closeDays: number;
  leasebackRequest: string;
  concessions: string;
  proofOfFunds: boolean;
  preApproval: boolean;
  completeness: number;
  specialNotes: string;
  documents: DocumentItem[];
  scores: OfferScores;
  labels: string[];
}

export interface DocumentItem {
  name: string;
  category: string;
  status: 'verified' | 'pending' | 'missing';
  confidence: number;
}

export interface OfferScores {
  offerStrength: number;
  closeProbability: number;
  financialConfidence: number;
  contingencyRisk: number;
  timingRisk: number;
  packageCompleteness: number;
}

export interface Property {
  id: string;
  address: string;
  city: string;
  listingPrice: number;
  propertyType: string;
  status: string;
  offersCount: number;
  lastUpdated: string;
  topRecommendation: string;
  sellerNotes: string;
  sellerGoals: string[];
  offers: Offer[];
}

export const sampleProperty: Property = {
  id: 'prop-001',
  address: '1247 Stone Canyon Rd',
  city: 'Bel Air, CA 90077',
  listingPrice: 8750000,
  propertyType: 'Single Family',
  status: 'Active — Reviewing Offers',
  offersCount: 5,
  lastUpdated: '2 hours ago',
  topRecommendation: 'Offer B — Best Balance',
  sellerNotes: 'Seller prefers 30-day close, open to short leaseback. Motivated but wants strong terms.',
  sellerGoals: ['Maximize net proceeds', 'Close within 35 days', 'Minimize repair negotiations', 'Short leaseback if possible'],
  offers: [
    {
      id: 'offer-a',
      buyerName: 'The Nakamura Trust',
      agentName: 'Jessica Huang',
      agentBrokerage: 'Compass',
      offerPrice: 9100000,
      financingType: 'All Cash',
      downPayment: 9100000,
      downPaymentPercent: 100,
      earnestMoney: 275000,
      contingencies: ['Inspection (7 days)'],
      inspectionPeriod: '7 days',
      appraisalTerms: 'Waived',
      closeTimeline: '21 days',
      closeDays: 21,
      leasebackRequest: 'None',
      concessions: 'None',
      proofOfFunds: true,
      preApproval: false,
      completeness: 95,
      specialNotes: 'Buyer is relocating from Tokyo, represented by top LA luxury agent. Very motivated.',
      labels: ['Highest', 'Fastest'],
      documents: [
        { name: 'Purchase Agreement', category: 'Purchase Agreement', status: 'verified', confidence: 98 },
        { name: 'Proof of Funds — JPMorgan Private Bank', category: 'Proof of Funds', status: 'verified', confidence: 96 },
        { name: 'Buyer Verification Letter', category: 'Other', status: 'verified', confidence: 92 },
      ],
      scores: { offerStrength: 92, closeProbability: 94, financialConfidence: 98, contingencyRisk: 12, timingRisk: 8, packageCompleteness: 95 },
    },
    {
      id: 'offer-b',
      buyerName: 'David & Sarah Chen',
      agentName: 'Marcus Rivera',
      agentBrokerage: 'The Agency',
      offerPrice: 8900000,
      financingType: 'Conventional (20% Down)',
      downPayment: 1780000,
      downPaymentPercent: 20,
      earnestMoney: 200000,
      contingencies: ['Inspection (10 days)', 'Appraisal'],
      inspectionPeriod: '10 days',
      appraisalTerms: 'Standard appraisal contingency',
      closeTimeline: '30 days',
      closeDays: 30,
      leasebackRequest: '7-day rent-free leaseback',
      concessions: 'None',
      proofOfFunds: true,
      preApproval: true,
      completeness: 100,
      specialNotes: 'Pre-approved through First Republic. Clean financials. Flexible on leaseback terms.',
      labels: ['Best Balance', 'Safest'],
      documents: [
        { name: 'Purchase Agreement', category: 'Purchase Agreement', status: 'verified', confidence: 97 },
        { name: 'Pre-Approval Letter — First Republic', category: 'Pre-Approval', status: 'verified', confidence: 99 },
        { name: 'Proof of Funds', category: 'Proof of Funds', status: 'verified', confidence: 95 },
        { name: 'Proof of Income — Tax Returns', category: 'Proof of Income', status: 'verified', confidence: 94 },
        { name: 'Buyer Cover Letter', category: 'Other', status: 'verified', confidence: 88 },
      ],
      scores: { offerStrength: 88, closeProbability: 91, financialConfidence: 90, contingencyRisk: 28, timingRisk: 15, packageCompleteness: 100 },
    },
    {
      id: 'offer-c',
      buyerName: 'Westside Holdings LLC',
      agentName: 'Tanya Brooks',
      agentBrokerage: 'Hilton & Hyland',
      offerPrice: 8600000,
      financingType: 'All Cash',
      downPayment: 8600000,
      downPaymentPercent: 100,
      earnestMoney: 250000,
      contingencies: ['Inspection (14 days)'],
      inspectionPeriod: '14 days',
      appraisalTerms: 'Waived',
      closeTimeline: '14 days',
      closeDays: 14,
      leasebackRequest: 'None',
      concessions: '$50,000 credit for cosmetic updates',
      proofOfFunds: true,
      preApproval: false,
      completeness: 85,
      specialNotes: 'Entity buyer. Fast close but requesting concessions. LLC structure may need additional verification.',
      labels: ['Fastest', 'Cleanest'],
      documents: [
        { name: 'Purchase Agreement', category: 'Purchase Agreement', status: 'verified', confidence: 95 },
        { name: 'Proof of Funds — Goldman Sachs', category: 'Proof of Funds', status: 'verified', confidence: 93 },
        { name: 'LLC Operating Agreement', category: 'Other', status: 'pending', confidence: 72 },
      ],
      scores: { offerStrength: 78, closeProbability: 82, financialConfidence: 85, contingencyRisk: 22, timingRisk: 10, packageCompleteness: 85 },
    },
    {
      id: 'offer-d',
      buyerName: 'Robert Ashford III',
      agentName: 'Diane Caldwell',
      agentBrokerage: 'Sotheby\'s International Realty',
      offerPrice: 9250000,
      financingType: 'Jumbo Loan (30% Down)',
      downPayment: 2775000,
      downPaymentPercent: 30,
      earnestMoney: 150000,
      contingencies: ['Inspection (17 days)', 'Appraisal', 'Loan'],
      inspectionPeriod: '17 days',
      appraisalTerms: 'Standard appraisal contingency',
      closeTimeline: '45 days',
      closeDays: 45,
      leasebackRequest: '30-day leaseback at market rate',
      concessions: '$25,000 closing cost credit',
      proofOfFunds: true,
      preApproval: true,
      completeness: 88,
      specialNotes: 'Highest price but heavy on contingencies. Long close timeline. Leaseback adds complexity.',
      labels: ['Highest Price'],
      documents: [
        { name: 'Purchase Agreement', category: 'Purchase Agreement', status: 'verified', confidence: 96 },
        { name: 'Pre-Approval Letter — Wells Fargo Private', category: 'Pre-Approval', status: 'verified', confidence: 91 },
        { name: 'Proof of Funds', category: 'Proof of Funds', status: 'verified', confidence: 87 },
        { name: 'Addendum — Leaseback Terms', category: 'Addenda', status: 'pending', confidence: 78 },
      ],
      scores: { offerStrength: 74, closeProbability: 68, financialConfidence: 80, contingencyRisk: 55, timingRisk: 48, packageCompleteness: 88 },
    },
    {
      id: 'offer-e',
      buyerName: 'Priya & Arun Kapoor',
      agentName: 'Elena Vasquez',
      agentBrokerage: 'Douglas Elliman',
      offerPrice: 8800000,
      financingType: 'Conventional (25% Down)',
      downPayment: 2200000,
      downPaymentPercent: 25,
      earnestMoney: 180000,
      contingencies: ['Inspection (10 days)', 'Appraisal'],
      inspectionPeriod: '10 days',
      appraisalTerms: 'Appraisal gap coverage up to $200,000',
      closeTimeline: '28 days',
      closeDays: 28,
      leasebackRequest: '14-day rent-free leaseback',
      concessions: 'None',
      proofOfFunds: true,
      preApproval: true,
      completeness: 92,
      specialNotes: 'Strong financial profile. Appraisal gap coverage is a competitive advantage. Flexible on terms.',
      labels: ['Strong Financials'],
      documents: [
        { name: 'Purchase Agreement', category: 'Purchase Agreement', status: 'verified', confidence: 97 },
        { name: 'Pre-Approval Letter — Chase Private Client', category: 'Pre-Approval', status: 'verified', confidence: 95 },
        { name: 'Proof of Funds', category: 'Proof of Funds', status: 'verified', confidence: 94 },
        { name: 'Proof of Income', category: 'Proof of Income', status: 'verified', confidence: 91 },
      ],
      scores: { offerStrength: 85, closeProbability: 87, financialConfidence: 92, contingencyRisk: 25, timingRisk: 18, packageCompleteness: 92 },
    },
  ],
};

export const recentProperties: { id: string; address: string; offers: number; status: string; lastUpdated: string; topRec: string }[] = [
  { id: 'prop-001', address: '1247 Stone Canyon Rd, Bel Air', offers: 5, status: 'Reviewing Offers', lastUpdated: '2 hours ago', topRec: 'Offer B — Best Balance' },
  { id: 'prop-002', address: '815 N Rodeo Dr, Beverly Hills', offers: 3, status: 'Counter Sent', lastUpdated: '1 day ago', topRec: 'Offer A — Highest' },
  { id: 'prop-003', address: '22160 Pacific Coast Hwy, Malibu', offers: 6, status: 'Pending Review', lastUpdated: '3 hours ago', topRec: 'Offer C — Safest' },
  { id: 'prop-004', address: '430 N Maple Dr, Beverly Hills', offers: 4, status: 'Analysis Complete', lastUpdated: '5 days ago', topRec: 'Offer B — Best Balance' },
];

export const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const getScoreColor = (score: number) => {
  if (score >= 85) return 'text-success';
  if (score >= 70) return 'text-warning';
  return 'text-destructive';
};

export const getScoreBg = (score: number) => {
  if (score >= 85) return 'bg-success/10 border-success/20';
  if (score >= 70) return 'bg-warning/10 border-warning/20';
  return 'bg-destructive/10 border-destructive/20';
};

export const getRiskColor = (score: number) => {
  if (score <= 20) return 'text-success';
  if (score <= 40) return 'text-warning';
  return 'text-destructive';
};