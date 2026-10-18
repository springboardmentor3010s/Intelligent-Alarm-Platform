import firebase_admin
from firebase_admin import credentials, messaging

cred = credentials.Certificate("firebase_service_account.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)


def send_fcm_notification(fcm_token, title, body):
    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            token=fcm_token,
        )

        response = messaging.send(message)

        print("FCM notification sent successfully:", response)

        return response

    except Exception as e:
        print("FCM notification error:", e)

        return None


if __name__ == "__main__":
    token = input("Paste your FCM token: ")

    send_fcm_notification(
        token,
        "Test Notification",
        "Firebase Cloud Messaging is working!"
    )