"""Integration tests for Authentication API endpoints."""

import pytest
from httpx import AsyncClient

from app.models.user import User


class TestAuthRegistrationAPI:
    """Registration endpoint tests."""

    @pytest.mark.asyncio
    async def test_register_new_user_success(self, client: AsyncClient) -> None:
        payload = {
            "email": "alex@example.com",
            "username": "alexdev",
            "password": "StrongPassword123!",
            "full_name": "Alex Developer",
        }
        response = await client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_register_duplicate_email_fails(self, client: AsyncClient) -> None:
        payload1 = {
            "email": "dup@example.com",
            "username": "userone",
            "password": "Password123!",
            "full_name": "User One",
        }
        await client.post("/api/v1/auth/register", json=payload1)

        payload2 = {
            "email": "dup@example.com",
            "username": "usertwo",
            "password": "Password123!",
            "full_name": "User Two",
        }
        response = await client.post("/api/v1/auth/register", json=payload2)
        assert response.status_code == 400


class TestAuthLoginAPI:
    """Login and refresh token endpoint tests."""

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, test_user: User) -> None:
        payload = {
            "email": "developer@example.com",
            "password": "password123",
        }
        response = await client.post("/api/v1/auth/login", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    @pytest.mark.asyncio
    async def test_login_wrong_password_fails(self, client: AsyncClient, test_user: User) -> None:
        payload = {
            "email": "developer@example.com",
            "password": "incorrectpassword",
        }
        response = await client.post("/api/v1/auth/login", json=payload)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_protected_route_unauthorized(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/users/me")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_protected_route_authorized(
        self, authenticated_client: tuple[AsyncClient, User]
    ) -> None:
        client, user = authenticated_client
        response = await client.get("/api/v1/users/me")
        assert response.status_code == 200
        assert response.json()["email"] == user.email
