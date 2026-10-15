import os

# The settings class needs a database password to be created; tests that do
# not touch the database only need any value.
os.environ.setdefault("DB_PASSWORD", "test-password")
os.environ.setdefault("ADMIN_JWT_SECRET", "test-secret-test-secret-test-secret-123")
