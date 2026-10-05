CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY,                      -- generated in Node: crypto.randomUUID()
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,                   -- roads|streetlights|waste|water|parks|safety|other
  severity INT NOT NULL CHECK (severity BETWEEN 1 AND 5),
  severity_rationale TEXT,
  department TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reported',  -- reported|acknowledged|in_progress|resolved
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  photo_url TEXT,
  reporter_name TEXT NOT NULL DEFAULT 'Anonymous',
  priority_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  upvotes INT NOT NULL DEFAULT 0,
  is_sample BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS status_history (
  id UUID PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS upvotes (
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  voter_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, voter_key)
);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_category ON reports(category);
CREATE INDEX idx_reports_created ON reports(created_at DESC);
CREATE INDEX idx_reports_geo ON reports(latitude, longitude);
