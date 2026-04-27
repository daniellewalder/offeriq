import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { setStoredActiveAnalysisId } from '@/lib/activeAnalysis';

export default function NewAnalysis() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [listingPrice, setListingPrice] = useState('');
  const [propertyType, setPropertyType] = useState('Single Family');
  const [sellerGoals, setSellerGoals] = useState('');
  const [sellerNotes, setSellerNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, []);

  const createAndContinue = async () => {
    if (!userId) {
      toast({ title: 'Please sign in first', variant: 'destructive' });
      navigate('/auth');
      return;
    }
    if (!address.trim()) {
      toast({ title: 'Property address required', description: 'Enter the listing address before continuing.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { data: prop, error: propErr } = await supabase
        .from('properties')
        .insert({
          user_id: userId,
          address: address.trim() || 'Untitled property',
          city: city.trim() || null,
          listing_price: Number(listingPrice.replace(/[^0-9.]/g, '')) || null,
          property_type: propertyType,
          status: 'Active',
          seller_notes: sellerNotes,
          seller_goals: sellerGoals ? [sellerGoals] : [],
        })
        .select('id')
        .single();
      if (propErr) throw propErr;

      const { data: da, error: daErr } = await supabase
        .from('deal_analyses')
        .insert({
          user_id: userId,
          property_id: prop.id,
          name: address.trim() || 'New Analysis',
          status: 'in_progress',
        })
        .select('id')
        .single();
      if (daErr) throw daErr;

      // Pin this new analysis so subsequent uploads land in the right deal.
      setStoredActiveAnalysisId(da.id);

      toast({ title: 'Analysis created', description: 'Now upload your offer packages.' });
      navigate(`/offer-intake?analysis=${da.id}`);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not create analysis', description: e?.message ?? 'Try again.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-10 animate-fade-in">
        <div>
          <p className="text-[11px] tracking-[0.15em] uppercase text-muted-foreground font-body mb-3">New Analysis</p>
          <h1 className="heading-display text-3xl lg:text-4xl text-foreground">Start a New Analysis</h1>
          <p className="text-[13px] text-muted-foreground font-body mt-2">
            Tell us about the listing. Next step you'll upload offer packages and we'll extract terms.
          </p>
        </div>

        {/* Property Details */}
        <div className="card-elevated p-6 space-y-5">
          <h2 className="heading-display text-lg font-semibold">Property Details</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground font-body block mb-1.5">Property Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 2339 Lyric Ave, Los Angeles, CA" className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background font-body focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground font-body block mb-1.5">City / Region</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Los Angeles, CA 90027" className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background font-body focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground font-body block mb-1.5">Listing Price</label>
              <input value={listingPrice} onChange={(e) => setListingPrice(e.target.value)} placeholder="e.g. 2495000" className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background font-body focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground font-body block mb-1.5">Property Type</label>
              <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background font-body focus:outline-none focus:ring-2 focus:ring-ring">
                <option>Single Family</option><option>Condo</option><option>Townhouse</option><option>Multi-Family</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground font-body block mb-1.5">Seller Goals</label>
              <input value={sellerGoals} onChange={(e) => setSellerGoals(e.target.value)} placeholder="e.g. Maximize net, close in 30 days" className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background font-body focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground font-body block mb-1.5">Seller Notes</label>
            <textarea value={sellerNotes} onChange={(e) => setSellerNotes(e.target.value)} rows={3} placeholder="Anything the seller has told you about timing, leaseback, repairs, motivation…" className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background font-body focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={createAndContinue}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium font-body hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Continue to Upload Offers
          </button>
        </div>
      </div>
    </AppLayout>
  );
}