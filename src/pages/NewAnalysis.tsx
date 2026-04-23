import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Plus, X, FileText } from 'lucide-react';
import AppLayout from '@/components/AppLayout';

const docCategories = ['Purchase Agreement', 'Proof of Funds', 'Pre-Approval', 'Proof of Income', 'Addenda', 'Disclosures', 'Other'];

interface UploadedFile { name: string; category: string; offer: string }

export default function NewAnalysis() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<UploadedFile[]>([
    { name: 'Nakamura_Purchase_Agreement.pdf', category: 'Purchase Agreement', offer: 'Offer A' },
    { name: 'Nakamura_Proof_of_Funds.pdf', category: 'Proof of Funds', offer: 'Offer A' },
    { name: 'Chen_Purchase_Agreement.pdf', category: 'Purchase Agreement', offer: 'Offer B' },
    { name: 'Chen_PreApproval.pdf', category: 'Pre-Approval', offer: 'Offer B' },
  ]);

  const grouped = files.reduce<Record<string, UploadedFile[]>>((acc, f) => {
    (acc[f.offer] ??= []).push(f);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
        <div>
          <h1 className="heading-display text-2xl lg:text-3xl font-semibold mb-1">New Deal Analysis</h1>
          <p className="text-muted-foreground font-body text-sm">Set up a new property and upload offer packages.</p>
        </div>

        {/* Property Details */}
        <div className="card-elevated p-6 space-y-5">
          <h2 className="heading-display text-lg font-semibold">Property Details</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground font-body block mb-1.5">Property Address</label>
              <input defaultValue="1247 Stone Canyon Rd, Bel Air, CA 90077" className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background font-body focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground font-body block mb-1.5">Listing Price</label>
              <input defaultValue="$8,750,000" className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background font-body focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground font-body block mb-1.5">Property Type</label>
              <select defaultValue="Single Family" className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background font-body focus:outline-none focus:ring-2 focus:ring-ring">
                <option>Single Family</option><option>Condo</option><option>Townhouse</option><option>Multi-Family</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground font-body block mb-1.5">Seller Goals</label>
              <input defaultValue="Maximize net, close in 35 days" className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background font-body focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground font-body block mb-1.5">Seller Notes</label>
            <textarea defaultValue="Seller prefers 30-day close, open to short leaseback. Motivated but wants strong terms." rows={3} className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background font-body focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
        </div>

        {/* Upload */}
        <div className="card-elevated p-6 space-y-5">
          <h2 className="heading-display text-lg font-semibold">Upload Offer Packages</h2>
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-gold/40 transition-colors cursor-pointer">
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground font-body mb-1">Drop files here or click to upload</p>
            <p className="text-xs text-muted-foreground font-body">PDF, DOCX, JPG — up to 50MB per file</p>
          </div>

          {/* Grouped Files */}
          {Object.entries(grouped).map(([offer, docs]) => (
            <div key={offer} className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm font-medium font-body">{offer}</span>
                <span className="text-xs text-muted-foreground font-body">{docs.length} documents</span>
              </div>
              <div className="divide-y divide-border">
                {docs.map((d, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-body">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge-info text-xs">{d.category}</span>
                      <button onClick={() => setFiles(f => f.filter((_, j) => !(f[j] === d)))} className="p-1 hover:bg-muted rounded">
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button className="flex items-center gap-2 text-sm text-gold font-medium font-body hover:underline">
            <Plus className="w-4 h-4" /> Add Another Offer Package
          </button>
        </div>

        <div className="flex justify-end gap-3">
          <button className="px-5 py-2.5 border border-border rounded-lg text-sm font-medium font-body hover:bg-muted transition-colors">
            Save Draft
          </button>
          <button
            onClick={() => navigate('/offer-intake')}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium font-body hover:opacity-90 transition-opacity"
          >
            Begin AI Analysis
          </button>
        </div>
      </div>
    </AppLayout>
  );
}