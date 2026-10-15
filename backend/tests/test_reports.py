"""
Reports & Export System tests (Module 12).
Run: cd backend && venv\\Scripts\\python.exe -m pytest tests/test_reports.py -v
"""


class TestReports:
    def test_pdf_report_requires_auth(self, client):
        r = client.get("/reports/habit/pdf")
        assert r.status_code == 401

    def test_pdf_report_generates(self, client, register_user):
        headers = register_user(email="pdfuser@example.com")
        r = client.get("/reports/habit/pdf", headers=headers)
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert len(r.content) > 100

    def test_xlsx_report_generates(self, client, register_user):
        headers = register_user(email="xlsxuser@example.com")
        r = client.get("/reports/habit/xlsx", headers=headers)
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers["content-type"]
        assert len(r.content) > 100

    def test_report_respects_days_param(self, client, register_user):
        headers = register_user(email="daysuser@example.com")
        r = client.get("/reports/habit/pdf?days=30", headers=headers)
        assert r.status_code == 200

    def test_report_rejects_invalid_days(self, client, register_user):
        headers = register_user(email="baddaysuser@example.com")
        r = client.get("/reports/habit/pdf?days=999", headers=headers)
        assert r.status_code == 422
