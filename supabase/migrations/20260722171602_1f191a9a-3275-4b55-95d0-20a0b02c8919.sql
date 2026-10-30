-- 1. Marketplace motifs
CREATE TABLE public.marketplace_motifs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_path TEXT NOT NULL,
  price_ore INTEGER NOT NULL CHECK (price_ore >= 4900 AND price_ore <= 999900),
  tags TEXT[] NOT NULL DEFAULT '{}',
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_motifs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.marketplace_motifs TO authenticated;
GRANT ALL ON public.marketplace_motifs TO service_role;
ALTER TABLE public.marketplace_motifs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view published motifs"
  ON public.marketplace_motifs FOR SELECT
  TO authenticated
  USING (published = true OR auth.uid() = artist_id);
CREATE POLICY "Artists create own motifs"
  ON public.marketplace_motifs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = artist_id);
CREATE POLICY "Artists update own motifs"
  ON public.marketplace_motifs FOR UPDATE
  TO authenticated USING (auth.uid() = artist_id);
CREATE POLICY "Artists delete own motifs"
  ON public.marketplace_motifs FOR DELETE
  TO authenticated USING (auth.uid() = artist_id);

CREATE TRIGGER marketplace_motifs_updated_at
  BEFORE UPDATE ON public.marketplace_motifs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Purchases
CREATE TABLE public.motif_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motif_id UUID NOT NULL REFERENCES public.marketplace_motifs(id) ON DELETE CASCADE,
  price_paid_ore INTEGER NOT NULL,
  stripe_session_id TEXT UNIQUE,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, motif_id)
);
GRANT SELECT ON public.motif_purchases TO authenticated;
GRANT ALL ON public.motif_purchases TO service_role;
ALTER TABLE public.motif_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own purchases"
  ON public.motif_purchases FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Artists view purchases of own motifs"
  ON public.motif_purchases FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.marketplace_motifs m WHERE m.id = motif_id AND m.artist_id = auth.uid())
  );

CREATE INDEX idx_motif_purchases_user ON public.motif_purchases(user_id);
CREATE INDEX idx_motif_purchases_motif ON public.motif_purchases(motif_id);

-- 3. Subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  price_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

-- 4. Storage policies for marketplace bucket
CREATE POLICY "Marketplace images readable by authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'marketplace');
CREATE POLICY "Artists upload own marketplace files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'marketplace' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Artists update own marketplace files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'marketplace' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Artists delete own marketplace files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'marketplace' AND (storage.foldername(name))[1] = auth.uid()::text);