-- ─── BPRM Portal — Database Init Schema ────────────────────────────────────────
-- Runs automatically on first container startup via /docker-entrypoint-initdb.d/

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL CHECK (role IN ('stakeholder','ba','it','it_member')),
  name          VARCHAR(255),
  is_it_manager BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Auth logs
CREATE TABLE IF NOT EXISTS auth_logs (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),
  action     VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin audit logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id        SERIAL PRIMARY KEY,
  admin_id  VARCHAR(255),
  action    VARCHAR(100) NOT NULL,
  details   JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id  ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_timestamp ON admin_audit_logs(timestamp DESC);

-- Requests
CREATE TABLE IF NOT EXISTS requests (
  id              SERIAL PRIMARY KEY,
  req_number      VARCHAR(20) UNIQUE NOT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT NOT NULL,
  priority        VARCHAR(20) NOT NULL,
  category        VARCHAR(100) NOT NULL,
  status          VARCHAR(50) DEFAULT 'Submitted',
  assignment_mode VARCHAR(20) DEFAULT 'automatic',
  stakeholder_id  INTEGER REFERENCES users(id),
  assigned_ba_id  INTEGER REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_requests_ba          ON requests(assigned_ba_id);
CREATE INDEX IF NOT EXISTS idx_requests_stakeholder ON requests(stakeholder_id);

-- Request attachments (stores storage object key, not file bytes)
CREATE TABLE IF NOT EXISTS request_attachments (
  id            SERIAL PRIMARY KEY,
  request_id    INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  original_name VARCHAR(255) NOT NULL,
  mimetype      VARCHAR(100),
  size          INTEGER,
  s3_key        VARCHAR(500) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages per request
CREATE TABLE IF NOT EXISTS request_messages (
  id          SERIAL PRIMARY KEY,
  request_id  INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  sender_id   INTEGER REFERENCES users(id),
  message     TEXT NOT NULL,
  reply_to_id INTEGER REFERENCES request_messages(id) ON DELETE SET NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_messages_request ON request_messages(request_id, created_at);

-- Read receipts
CREATE TABLE IF NOT EXISTS request_read_receipts (
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  request_id   INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, request_id)
);
CREATE INDEX IF NOT EXISTS idx_read_receipts ON request_read_receipts(user_id, request_id);

-- Stream Chat channel membership mirror
CREATE TABLE IF NOT EXISTS channel_members (
  request_id  INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  stream_role VARCHAR(20) DEFAULT 'member',
  added_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (request_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);

-- Important messages for AI BRD key point generation
CREATE TABLE IF NOT EXISTS important_messages (
  id                SERIAL PRIMARY KEY,
  request_id        INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  stream_message_id VARCHAR(255) NOT NULL,
  message_text      TEXT,
  sender_name       VARCHAR(255),
  marked_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  marked_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(request_id, stream_message_id)
);
CREATE INDEX IF NOT EXISTS idx_important_messages_request ON important_messages(request_id);

-- BRD documents
CREATE TABLE IF NOT EXISTS brd_documents (
  id           SERIAL PRIMARY KEY,
  request_id   INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  doc_id       VARCHAR(100) NOT NULL,
  version      VARCHAR(10) DEFAULT '0.1',
  status       VARCHAR(50) DEFAULT 'Draft',
  content      JSONB NOT NULL,
  generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_brd_docs_request ON brd_documents(request_id);
CREATE INDEX IF NOT EXISTS idx_brd_docs_author  ON brd_documents(generated_by);

-- Stakeholder reviews per BRD
CREATE TABLE IF NOT EXISTS brd_reviews (
  id              SERIAL PRIMARY KEY,
  brd_document_id INTEGER REFERENCES brd_documents(id) ON DELETE CASCADE,
  reviewer_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reviewer_name   VARCHAR(255),
  status          VARCHAR(50) DEFAULT 'pending',
  comment         TEXT,
  reviewed_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brd_document_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_brd_reviews_doc ON brd_reviews(brd_document_id);

-- BRD posts to Stream channels
CREATE TABLE IF NOT EXISTS brd_channel_posts (
  id              SERIAL PRIMARY KEY,
  brd_document_id INTEGER REFERENCES brd_documents(id) ON DELETE CASCADE,
  request_id      INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  stream_message_id VARCHAR(255),
  posted_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  posted_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- BRD submissions to IT Manager
CREATE TABLE IF NOT EXISTS brd_it_submissions (
  id              SERIAL PRIMARY KEY,
  brd_document_id INTEGER REFERENCES brd_documents(id) ON DELETE CASCADE,
  submitted_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  it_manager_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitted_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_brd_it_submissions_brd ON brd_it_submissions(brd_document_id);

-- FRD documents
CREATE TABLE IF NOT EXISTS frd_documents (
  id              SERIAL PRIMARY KEY,
  brd_document_id INTEGER REFERENCES brd_documents(id) ON DELETE CASCADE,
  request_id      INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  doc_id          VARCHAR(100) NOT NULL,
  version         VARCHAR(10) DEFAULT '1.0',
  status          VARCHAR(50) DEFAULT 'Draft',
  content         JSONB NOT NULL,
  generated_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  generated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_frd_docs_brd     ON frd_documents(brd_document_id);
CREATE INDEX IF NOT EXISTS idx_frd_docs_request ON frd_documents(request_id);

-- Test case documents
CREATE TABLE IF NOT EXISTS test_case_documents (
  id              SERIAL PRIMARY KEY,
  frd_document_id INTEGER REFERENCES frd_documents(id) ON DELETE CASCADE,
  brd_document_id INTEGER REFERENCES brd_documents(id) ON DELETE CASCADE,
  request_id      INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  doc_id          VARCHAR(100) NOT NULL,
  version         VARCHAR(10) DEFAULT '1.0',
  status          VARCHAR(50) DEFAULT 'Draft',
  content         JSONB NOT NULL,
  generated_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  generated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tc_docs_frd     ON test_case_documents(frd_document_id);
CREATE INDEX IF NOT EXISTS idx_tc_docs_request ON test_case_documents(request_id);

-- SIT test results
CREATE TABLE IF NOT EXISTS sit_test_results (
  id             SERIAL PRIMARY KEY,
  tc_document_id INTEGER REFERENCES test_case_documents(id) ON DELETE CASCADE,
  test_case_id   VARCHAR(50) NOT NULL,
  status         VARCHAR(20) DEFAULT 'Pending'
                 CHECK (status IN ('Pending','In Progress','Pass','Fail','Blocked')),
  remarks        TEXT,
  updated_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tc_document_id, test_case_id)
);
CREATE INDEX IF NOT EXISTS idx_sit_results_doc ON sit_test_results(tc_document_id);

-- SIT releases
CREATE TABLE IF NOT EXISTS sit_releases (
  id             SERIAL PRIMARY KEY,
  tc_document_id INTEGER REFERENCES test_case_documents(id) ON DELETE CASCADE UNIQUE,
  pass_rate      DECIMAL(5,2) NOT NULL,
  released_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  released_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- UAT assignments
CREATE TABLE IF NOT EXISTS uat_assignments (
  id             SERIAL PRIMARY KEY,
  tc_document_id INTEGER REFERENCES test_case_documents(id) ON DELETE CASCADE,
  test_case_id   VARCHAR(50) NOT NULL,
  stakeholder_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  assigned_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status         VARCHAR(20) DEFAULT 'Pending'
                 CHECK (status IN ('Pending','In Progress','Pass','Fail')),
  test_mode      VARCHAR(20) DEFAULT 'manual'
                 CHECK (test_mode IN ('simulation','manual')),
  remarks        TEXT,
  manual_notes   TEXT,
  assigned_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tc_document_id, test_case_id, stakeholder_id)
);
CREATE INDEX IF NOT EXISTS idx_uat_assignments_doc  ON uat_assignments(tc_document_id);
CREATE INDEX IF NOT EXISTS idx_uat_assignments_user ON uat_assignments(stakeholder_id);

-- UAT config per tc_document
CREATE TABLE IF NOT EXISTS uat_config (
  tc_document_id INTEGER PRIMARY KEY REFERENCES test_case_documents(id) ON DELETE CASCADE,
  pass_threshold INTEGER DEFAULT 80,
  configured_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Approval requests
CREATE TABLE IF NOT EXISTS approval_requests (
  id             SERIAL PRIMARY KEY,
  tc_document_id INTEGER REFERENCES test_case_documents(id) ON DELETE CASCADE UNIQUE,
  request_id     INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  pass_rate      DECIMAL(5,2),
  status         VARCHAR(20) DEFAULT 'Pending'
                 CHECK (status IN ('Pending','Approved','Rejected')),
  submitted_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitted_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMP,
  comment        TEXT
);

-- Deployments
CREATE TABLE IF NOT EXISTS deployments (
  id              SERIAL PRIMARY KEY,
  tc_document_id  INTEGER REFERENCES test_case_documents(id) ON DELETE CASCADE,
  request_id      INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  environment     VARCHAR(20) NOT NULL CHECK (environment IN ('SIT','UAT','Production')),
  deployment_type VARCHAR(20) DEFAULT 'Full' CHECK (deployment_type IN ('Full','Partial')),
  status          VARCHAR(20) DEFAULT 'Pending'
                  CHECK (status IN ('Pending','In Progress','Deployed','Partial','Failed')),
  notes           TEXT,
  deployed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deployed_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tc_document_id, environment)
);
CREATE INDEX IF NOT EXISTS idx_deployments_request ON deployments(request_id);

-- Production defects
CREATE TABLE IF NOT EXISTS production_defects (
  id            SERIAL PRIMARY KEY,
  request_id    INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  deployment_id INTEGER REFERENCES deployments(id) ON DELETE SET NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  severity      VARCHAR(20) DEFAULT 'Medium'
                CHECK (severity IN ('Critical','High','Medium','Low')),
  status        VARCHAR(30) DEFAULT 'Open'
                CHECK (status IN ('Open','Acknowledged','In Progress','Resolved','Closed')),
  reported_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_to   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  remarks       TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_defects_request ON production_defects(request_id);

-- Production releases
CREATE TABLE IF NOT EXISTS production_releases (
  id                  SERIAL PRIMARY KEY,
  request_id          INTEGER REFERENCES requests(id) ON DELETE CASCADE UNIQUE,
  tc_document_id      INTEGER REFERENCES test_case_documents(id) ON DELETE CASCADE,
  deployment_id       INTEGER REFERENCES deployments(id) ON DELETE SET NULL,
  status              VARCHAR(50) DEFAULT 'Under Observation'
                      CHECK (status IN ('Under Observation','Completed')),
  marked_completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  marked_completed_at TIMESTAMP,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
