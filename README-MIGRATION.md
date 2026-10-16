# HOUSEBAKERY POS — migration-ready source

Stack:
- Frontend: React 19 + Create React App/CRACO
- Backend: FastAPI + Motor
- Database: MongoDB

Important:
1. Copy `frontend/.env.example` to `frontend/.env`.
2. Copy `backend/.env.example` to `backend/.env`.
3. Never commit real `.env` files or credentials.
4. The MongoDB database is NOT included in this source ZIP. Existing products/orders must be exported and imported separately.
5. `frontend/node_modules`, build output, `.git`, caches, and Emergent workspace metadata were intentionally excluded.
6. Emergent-only visual-editing/overlay dependencies and browser analytics bootstrap were removed from the migration copy.

Local run (after installing dependencies):
- Backend: `cd backend && pip install -r requirements.txt && uvicorn server:app --host 0.0.0.0 --port 8000`
- Frontend: `cd frontend && yarn install && yarn start`

For production deployment, set the environment variables on the hosting provider rather than committing them.
