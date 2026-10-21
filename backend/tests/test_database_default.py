import importlib
import os
import unittest


class DatabaseDefaultFallbackTests(unittest.TestCase):
    def test_defaults_to_sqlite_for_local_development(self):
        original_url = os.environ.get("DATABASE_URL")
        original_sqlite = os.environ.get("USE_SQLITE")

        try:
            for key in ["DATABASE_URL", "USE_SQLITE"]:
                os.environ.pop(key, None)

            import app.database as database_module
            importlib.reload(database_module)

            self.assertTrue(
                str(database_module.DATABASE_URL).startswith("sqlite"),
                msg=f"Expected SQLite fallback, got: {database_module.DATABASE_URL}",
            )
        finally:
            if original_url is not None:
                os.environ["DATABASE_URL"] = original_url
            else:
                os.environ.pop("DATABASE_URL", None)

            if original_sqlite is not None:
                os.environ["USE_SQLITE"] = original_sqlite
            else:
                os.environ.pop("USE_SQLITE", None)

            import app.database as database_module
            importlib.reload(database_module)


if __name__ == "__main__":
    unittest.main()
