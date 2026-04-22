-- 1776882398_create_admin_impersonation_tokens.sql

-- Tabuľka pre impersonation tokeny
CREATE TABLE IF NOT EXISTS admin_impersonation_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pre rýchle hľadanie tokenu
CREATE INDEX IF NOT EXISTS idx_impersonation_tokens_hash ON admin_impersonation_tokens(token_hash);

-- Tabuľka pre audit logy impersonácie
CREATE TABLE IF NOT EXISTS admin_impersonation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    token_id UUID REFERENCES admin_impersonation_tokens(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'created', 'used', 'returned'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS pre impersonation tabuľky (len pre adminov, ale budeme to spravovať cez service_role v API)
ALTER TABLE admin_impersonation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_impersonation_logs ENABLE ROW LEVEL SECURITY;

-- Politiky pre adminov (predpokladáme, že role='admin' v profiles)
CREATE POLICY "Admins can manage impersonation tokens" ON admin_impersonation_tokens
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can view impersonation logs" ON admin_impersonation_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
