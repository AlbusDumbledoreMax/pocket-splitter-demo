# Pocket Splitter / FairShares

Pocket Splitter (FairShares) is a small web app to **split group expenses fairly**, track who paid for what, and suggest minimal “settle up” transfers between participants.

You can use it for trips, shared flats, team events, or any situation where multiple people are paying and you want a clean breakdown of who owes whom.

---

## Features

- Create and join **group sessions** with an invite code or link.
- Add **expenses** with:
  - Payer (who paid)
  - Amount
  - Description
  - Flexible percentage-based splits between participants.
- Track **per-person balances** (who owes vs who is owed).
- Generate **suggested settlements** that minimize the number of transfers.
- Add **receipt / proof images** to expenses (file upload).
- “Ad‑hoc n-people calculator” to simulate splits without saving anything.
- Built with:
  - **React + Vite** frontend
  - **FastAPI** backend
  - JSON over HTTP between frontend and backend

---

## Tech Stack

### Frontend

- React (Vite)
- React Router
- Axios for HTTP calls
- Deployed on Vercel

### Backend

- Python 3 + FastAPI
- Pydantic models for validation
- Uvicorn for local development
- SQLite (or in-memory / simple storage) for persistence
- Deployed separately (e.g., local, Render, Railway, etc.)

---

## Project Structure

High‑level layout (relevant parts):

```txt
pocket-splitter/
├─ backend/
│  ├─ main.py                # FastAPI app & routes
│  └─ ...                    # models, utils, etc.
├─ frontend/
│  ├─ index.html
│  ├─ vite.config.js
│  ├─ package.json
│  ├─ src/
│  │  ├─ App.jsx             # Main router & pages
│  │  ├─ App.css
│  │  ├─ components/
│  │  │  └─ ExpenseCard.jsx  # UI for a single expense (with proof upload)
│  │  └─ main.jsx            # React entry; wraps App in BrowserRouter
│  └─ ...
└─ README.md
```

---

## Backend API Overview

The frontend talks to the backend via HTTP JSON. Key endpoints:

- `POST /groups`
  - Create a new group.
  - Body: `{ "name": "Goa Trip" }`
  - Response: `{ "group_id": "...", "name": "...", "invite_url": "..." }`

- `GET /group/{invite_code}`
  - Load a group by invite code.
  - Used by the legacy home page flow.

- `GET /groups/{group_id}`
  - Load a group by ID, including members and expenses.

- `POST /groups/{group_id}/participants`
  - Join a session as a participant.
  - Body: `{ "name": "Alice", "email": "alice@example.com" }`

- `POST /groups/{group_id}/expenses`
  - Create a blank expense for a given participant.

- `PUT /expenses/{expense_id}`
  - Update an expense (name, amount, payer, splits).
  - Body example:
    ```json
    {
      "name": "Dinner",
      "paid_by": 1,
      "total_amount": 1200,
      "splits": [
        { "user_id": 1, "share": 0.4 },
        { "user_id": 2, "share": 0.3 },
        { "user_id": 3, "share": 0.3 }
      ]
    }
    ```

- `POST /expenses/{expense_id}/proof`
  - Upload receipt / proof image for an expense.
  - `multipart/form-data` with `file` field.
  - Response: `{ "receipt_url": "/path/to/stored/image.jpg" }`

- `GET /group/{group_id}/balances`
  - Returns per-user balances within a group.

- `GET /group/{group_id}/settlements/suggested`
  - Returns suggested settlement transactions.

- `POST /group/{group_id}/settle`
  - Records the final settlement in the backend.

- `POST /calc/settle`
  - Ad‑hoc n‑people calculator for custom scenarios.

(Exact responses may vary slightly depending on your backend version.)

---

## Local Development

### 1. Backend (FastAPI)

From the `backend/` folder:

```bash
cd backend
pip install -r requirements.txt  # or pip install fastapi uvicorn pydantic etc.
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Backend will be available at:

- `http://127.0.0.1:8000`

Make sure CORS is configured to allow the frontend origin (e.g. `http://localhost:5173`).

### 2. Frontend (Vite + React)

From the `frontend/` folder:

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at:

- `http://localhost:5173/`

By default, the frontend expects the backend at `http://127.0.0.1:8000`.

---

## Environment Variables

For local development, the frontend uses:

```js
const API = import.meta.env.VITE_API || "http://127.0.0.1:8000"
```

To override the backend URL (especially in production):

1. In the frontend root (`frontend/`), create a `.env` file:

   ```env
   VITE_API=https://your-backend-host.com
   ```

2. Restart the dev server or re‑deploy for changes to take effect.

On Vercel:

- Go to **Project → Settings → Environment Variables**.
- Add `VITE_API` with your backend’s public URL.
- Trigger a new deployment.

[Note: Don’t commit `.env` with secrets to Git.]

---

## Frontend Behavior

### Home Page (`/`)

Legacy “classic” home page:

- Enter an **invite code** (e.g. `DEMO123`) and click **Load Group** to fetch a group from `GET /group/{invite_code}`.
- See **balances**, **suggested settlements**, and a form to **add expenses**.
- Includes an **ad‑hoc n-people calculator** at the bottom.

### Session Page (`/session/:groupId`)

Modern session flow:

- Created after `POST /groups` on the backend.
- Users join via a shared URL (the app remembers the participant in `localStorage`).
- Participants can:

  - Join the session by entering their name/email.
  - Add blank expenses.
  - Edit each expense via `ExpenseCard`:
    - Change title, amount, payer.
    - Adjust splits.
    - Upload a receipt/proof image.

#### ExpenseCard

`frontend/src/components/ExpenseCard.jsx` handles a single expense:

- `PUT /expenses/{id}` to save edits.
- `POST /expenses/{id}/proof` to upload receipt.
- After saving, it calls `onUpdated(expenseId, updatedExpense)` to update parent state.

---

## Deployment

### Deploy Frontend to Vercel

1. Push the repo to GitHub (if not already).
2. Go to [Vercel](https://vercel.com) and log in with GitHub.
3. Click **Add New → Project**, import your repo.
4. Vercel will detect Vite:
   - Build command: `npm run build`
   - Output directory: `dist`
5. Set the `VITE_API` env var to your FastAPI backend URL (under Project Settings).
6. Click **Deploy**.

Every push to the configured branch (`main` by default) will trigger a new deployment.

### Deploy Backend

You can deploy the FastAPI backend via:

- Render
- Railway
- Heroku (if available)
- A simple VPS with Uvicorn + Nginx

Make sure to:

- Expose FastAPI on HTTPS (or behind a proxy).
- Update `VITE_API` to this public URL in Vercel.

---

## Development Notes / Gotchas

- React Router:
  - Only **one** `<BrowserRouter>` in the app.
  - In this project, `main.jsx` wraps `<App />` with `<BrowserRouter>`, and `App.jsx` only defines `<Routes>`.
- File upload:
  - `ExpenseCard` uses a `<input type="file" accept="image/*">` and `FormData` to send the file under the `file` key.
  - Backend endpoint signature should use `UploadFile = File(...)` in FastAPI.
- Splits:
  - UI uses **percentages** (0–100).
  - Backend expects fractional shares (0–1), so the frontend divides by 100 before sending.

---

## Roadmap / Ideas

- Better UI for balances and settlements (less debug JSON).
- Category tags for expenses (food, travel, etc.).
- Export group summary to CSV/PDF.
- Authentication and persistent user accounts.
- Mobile-friendly layout.

---

## License

Choose a license that fits your needs (MIT is common for small projects). Example:

```text
MIT License

Copyright (c) 2026 ...

Permission is hereby granted, free of charge, to any person obtaining a copy...
```

(Replace with your preferred license or link to `LICENSE`.)

---

## Contributing

Pull requests and suggestions are welcome:

1. Fork the repo.
2. Create a feature branch:
   ```bash
   git checkout -b feature/my-change
   ```
3. Commit and push:
   ```bash
   git commit -am "Describe your change"
   git push origin feature/my-change
   ```
4. Open a PR with a short description of what you changed and why.
