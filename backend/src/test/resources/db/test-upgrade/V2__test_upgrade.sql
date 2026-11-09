-- Test-only upgrade proving a baselined database receives later migrations.
CREATE INDEX idx_test_history_analysis_id ON analysis_history (analysis_id);
