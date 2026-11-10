"""Authentication and authorization business logic."""

from datetime import timedelta
import secrets
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import BadRequestException, UnauthorizedException
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_oauth_state,
    hash_password,
    verify_oauth_state,
    verify_password,
)
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.schemas.auth import LoginRequest, PasswordChangeRequest, RegisterRequest, TokenResponse

settings = get_settings()


class AuthService:
    """Service handling authentication, password hashing, JWTs, and OAuth."""

    @staticmethod
    async def register(db: AsyncSession, data: RegisterRequest) -> TokenResponse:
        """Register a new user and return JWT tokens."""
        repo = UserRepository(db)
        
        # Check existing email
        existing_email = await repo.get_by_email(data.email)
        if existing_email:
            raise BadRequestException(detail="Email is already registered")
        
        # Check existing username
        existing_username = await repo.get_by_username(data.username)
        if existing_username:
            raise BadRequestException(detail="Username is already taken")
        
        # Create user
        hashed = hash_password(data.password)
        user = await repo.create_user({
            "email": data.email,
            "username": data.username,
            "hashed_password": hashed,
            "full_name": data.full_name,
            "is_active": True,
            "role": "user",
        })
        await db.commit()

        token_data = {"sub": str(user.id), "type": "access", "role": user.role}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token({"sub": str(user.id), "type": "refresh"})

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
        )

    @staticmethod
    async def login(db: AsyncSession, data: LoginRequest) -> TokenResponse:
        """Authenticate user by email and password."""
        repo = UserRepository(db)
        user = await repo.get_by_email(data.email)
        
        if not user or not user.hashed_password:
            raise UnauthorizedException(detail="Invalid email or password")
        
        if not verify_password(data.password, user.hashed_password):
            raise UnauthorizedException(detail="Invalid email or password")
        
        if not user.is_active:
            raise UnauthorizedException(detail="User account is disabled")

        token_data = {"sub": str(user.id), "type": "access", "role": user.role}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token({"sub": str(user.id), "type": "refresh"})

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
        )

    @staticmethod
    async def refresh_token(db: AsyncSession, refresh_token: str) -> TokenResponse:
        """Verify refresh token and issue a fresh access token."""
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise UnauthorizedException(detail="Invalid token type")

        user_id_str = payload.get("sub")
        if not user_id_str:
            raise UnauthorizedException(detail="Invalid token subject")

        repo = UserRepository(db)
        user = await repo.get(int(user_id_str))
        if not user or not user.is_active:
            raise UnauthorizedException(detail="User not found or inactive")

        token_data = {"sub": str(user.id), "type": "access", "role": user.role}
        new_access_token = create_access_token(token_data)
        new_refresh_token = create_refresh_token({"sub": str(user.id), "type": "refresh"})

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
        )

    @staticmethod
    def github_oauth_url() -> str:
        """Generate GitHub OAuth authorization URL with CSRF state."""
        state = generate_oauth_state()
        base_url = "https://github.com/login/oauth/authorize"
        params = (
            f"?client_id={settings.GITHUB_CLIENT_ID}"
            f"&redirect_uri={settings.GITHUB_REDIRECT_URI}"
            f"&scope=repo,read:user,user:email"
            f"&state={state}"
        )
        return f"{base_url}{params}"

    @staticmethod
    async def github_oauth_callback(
        db: AsyncSession, code: str, state: str | None = None
    ) -> TokenResponse:
        """Exchange GitHub OAuth code for access token and create/link user account."""
        if state and not verify_oauth_state(state):
            raise BadRequestException(detail="Invalid or expired OAuth state parameter (CSRF detected)")

        async with httpx.AsyncClient() as client:
            # 1. Exchange code for access token
            token_resp = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                json={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": settings.GITHUB_REDIRECT_URI,
                },
            )
            if token_resp.status_code != 200:
                raise BadRequestException(detail="Failed to exchange GitHub authorization code")
            
            token_json = token_resp.json()
            gh_access_token = token_json.get("access_token")
            if not gh_access_token:
                error_desc = token_json.get("error_description", "OAuth error from GitHub")
                raise BadRequestException(detail=f"GitHub OAuth error: {error_desc}")

            # 2. Fetch GitHub user profile
            user_resp = await client.get(
                f"{settings.GITHUB_API_BASE_URL}/user",
                headers={
                    "Authorization": f"Bearer {gh_access_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )
            if user_resp.status_code != 200:
                raise BadRequestException(detail="Failed to retrieve GitHub user details")

            gh_user = user_resp.json()
            github_id = gh_user.get("id")
            github_login = gh_user.get("login")
            avatar_url = gh_user.get("avatar_url")

            # 3. Fetch primary verified email if not public
            email = gh_user.get("email")
            if not email:
                emails_resp = await client.get(
                    f"{settings.GITHUB_API_BASE_URL}/user/emails",
                    headers={"Authorization": f"Bearer {gh_access_token}"},
                )
                if emails_resp.status_code == 200:
                    for email_entry in emails_resp.json():
                        if email_entry.get("primary") and email_entry.get("verified"):
                            email = email_entry.get("email")
                            break
            if not email:
                email = f"{github_login}@users.noreply.github.com"

        repo = UserRepository(db)
        
        # Check if user with email exists
        user = await repo.get_by_email(email)
        if not user:
            # Create user
            user = await repo.create_user({
                "email": email,
                "username": github_login,
                "hashed_password": None,
                "full_name": gh_user.get("name") or github_login,
                "avatar_url": avatar_url,
                "is_active": True,
                "role": "user",
            })
            await db.flush()

        # Check GitHub account link
        gh_account = await repo.get_github_account(user.id, github_id)
        if not gh_account:
            await repo.create_github_account({
                "user_id": user.id,
                "github_id": github_id,
                "github_username": github_login,
                "access_token": gh_access_token,
                "avatar_url": avatar_url,
                "token_scope": "repo,read:user,user:email",
            })
        else:
            gh_account.access_token = gh_access_token
            gh_account.avatar_url = avatar_url
            gh_account.github_username = github_login

        await db.commit()

        token_data = {"sub": str(user.id), "type": "access", "role": user.role}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token({"sub": str(user.id), "type": "refresh"})

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
        )

    @staticmethod
    async def change_password(
        db: AsyncSession, user_id: int, data: PasswordChangeRequest
    ) -> bool:
        """Change user password after verifying the old password."""
        repo = UserRepository(db)
        user = await repo.get(user_id)
        if not user:
            raise UnauthorizedException(detail="User not found")
        
        if user.hashed_password and not verify_password(data.old_password, user.hashed_password):
            raise BadRequestException(detail="Current password is incorrect")

        user.hashed_password = hash_password(data.new_password)
        await db.commit()
        return True
