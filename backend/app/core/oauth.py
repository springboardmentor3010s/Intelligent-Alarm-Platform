"""
OAuth2 social login — Google & GitHub (Module 1: OAuth2 login).

Standard authorization-code flow implemented directly with httpx (no extra
framework dependency). To activate a provider, set its CLIENT_ID/CLIENT_SECRET
env vars (see backend/.env.example) — until then `/auth/oauth/providers`
reports it as unconfigured and the login endpoint returns a clear 400 instead
of redirecting to a broken provider URL.
"""
from urllib.parse import urlencode

import httpx

from app.core.config import settings

PROVIDERS = {
    "google": {
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scope": "openid email profile",
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
    },
    "github": {
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "scope": "read:user user:email",
        "client_id": settings.GITHUB_CLIENT_ID,
        "client_secret": settings.GITHUB_CLIENT_SECRET,
        "redirect_uri": settings.GITHUB_REDIRECT_URI,
    },
}


def is_configured(provider: str) -> bool:
    cfg = PROVIDERS.get(provider)
    return bool(cfg and cfg["client_id"] and cfg["client_secret"])


def build_authorize_url(provider: str, state: str) -> str:
    cfg = PROVIDERS[provider]
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": cfg["redirect_uri"],
        "scope": cfg["scope"],
        "state": state,
        "response_type": "code",
    }
    if provider == "google":
        params["access_type"] = "online"
        params["prompt"] = "select_account"
    return f"{cfg['authorize_url']}?{urlencode(params)}"


async def fetch_profile(provider: str, code: str) -> dict:
    """Exchange the auth code for an access token, then fetch the user's profile.

    Returns: {"provider_id": str, "email": str | None, "name": str | None}
    """
    cfg = PROVIDERS[provider]
    async with httpx.AsyncClient(timeout=10) as client:
        token_resp = await client.post(
            cfg["token_url"],
            data={
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "code": code,
                "redirect_uri": cfg["redirect_uri"],
                "grant_type": "authorization_code",
            },
            headers={"Accept": "application/json"},
        )
        token_resp.raise_for_status()
        access_token = token_resp.json().get("access_token")
        if not access_token:
            raise ValueError(f"No access_token in {provider} token response")

        if provider == "google":
            user_resp = await client.get(
                cfg["userinfo_url"], headers={"Authorization": f"Bearer {access_token}"}
            )
            user_resp.raise_for_status()
            data = user_resp.json()
            return {
                "provider_id": data["sub"],
                "email": data.get("email"),
                "name": data.get("name") or data.get("email"),
            }

        # github
        headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"}
        user_resp = await client.get(cfg["userinfo_url"], headers=headers)
        user_resp.raise_for_status()
        data = user_resp.json()
        email = data.get("email")
        if not email:
            emails_resp = await client.get("https://api.github.com/user/emails", headers=headers)
            if emails_resp.status_code == 200:
                emails = emails_resp.json()
                primary = next((e for e in emails if e.get("primary") and e.get("verified")), None)
                chosen = primary or (emails[0] if emails else {})
                email = chosen.get("email")
        return {
            "provider_id": str(data["id"]),
            "email": email,
            "name": data.get("name") or data.get("login"),
        }
