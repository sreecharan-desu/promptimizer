from __future__ import annotations

from fastapi import Header, HTTPException

from app.core.sessions import ProviderSession, sessions


async def require_session(
    x_promptimizer_session: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> ProviderSession:
    session_id = x_promptimizer_session
    if not session_id and authorization and authorization.lower().startswith("bearer sess_"):
        session_id = authorization.split(" ", 1)[1].strip()
    if not session_id:
        raise HTTPException(
            status_code=401,
            detail="Missing session. Connect a provider with a valid API key.",
        )
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or unknown.")
    return session
