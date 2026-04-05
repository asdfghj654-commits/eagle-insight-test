-- Create app role enum matching existing user_role but for auth
CREATE TYPE public.app_role AS ENUM ('engineer', 'domain_chief', 'maintenance_chief', 'commander');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's role (for convenience)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Only commanders can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'commander'))
WITH CHECK (public.has_role(auth.uid(), 'commander'));

-- Drop existing insecure policies on tags
DROP POLICY IF EXISTS "Everyone can view tags" ON public.tags;
DROP POLICY IF EXISTS "Everyone can create tags" ON public.tags;
DROP POLICY IF EXISTS "Everyone can update tags" ON public.tags;

-- New secure RLS policies for tags
CREATE POLICY "Authenticated users can view tags"
ON public.tags
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create tags"
ON public.tags
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Tag creators and commanders can update"
ON public.tags
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()::text OR
  public.has_role(auth.uid(), 'commander') OR
  public.has_role(auth.uid(), 'domain_chief')
);

CREATE POLICY "Commanders can delete tags"
ON public.tags
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'commander'));

-- Drop existing insecure policies on insights
DROP POLICY IF EXISTS "Everyone can view insights" ON public.insights;
DROP POLICY IF EXISTS "Everyone can create insights" ON public.insights;
DROP POLICY IF EXISTS "Everyone can update insights" ON public.insights;

-- New secure RLS policies for insights
CREATE POLICY "Authenticated users can view insights"
ON public.insights
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create insights"
ON public.insights
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Domain chiefs and commanders can update insights"
ON public.insights
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'commander') OR
  public.has_role(auth.uid(), 'domain_chief') OR
  public.has_role(auth.uid(), 'maintenance_chief')
);

CREATE POLICY "Commanders can delete insights"
ON public.insights
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'commander'));