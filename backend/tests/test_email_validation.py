import unittest

from pydantic import ValidationError

from app.schemas.user import UserCreate, UserLogin


class EmailValidationTests(unittest.TestCase):
    def test_user_create_rejects_invalid_email(self):
        with self.assertRaises(ValidationError):
            UserCreate.model_validate({
                "name": "Sri",
                "email": "sri123@.com",
                "password": "testpass123",
            })

    def test_user_login_rejects_invalid_email(self):
        with self.assertRaises(ValidationError):
            UserLogin.model_validate({
                "email": "sri123@.com",
                "password": "testpass123",
            })


if __name__ == "__main__":
    unittest.main()
