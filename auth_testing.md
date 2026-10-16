# Housebakery Auth Testing
- Login with username `admin`, password `admin` at the frontend.
- Verify `POST /api/auth/login` returns a token and `GET /api/auth/me` succeeds with Bearer token.
- Verify invalid credentials return 401.