# Campus Companion Backend

Node.js + Express + MongoDB/Mongoose + JWT backend for the Campus Companion React app.

## What changed

The backend is now designed around the actual Campus Companion behavior:

- Personal academic data belongs to the authenticated student.
- The supplied fake data is seeded for the development demo student.
- Campus events are global/readable by all students.
- Global seeded events are read-only; students can create their own events, which are private to them.
- New registrations automatically receive the supplied starter academic data during development, so the UI is not empty after signup.
- MongoDB is the source of truth for application data; React should no longer use localStorage for courses, assignments, exams, schedule, notes, or events.

## Requirements

- Node.js 18+
- MongoDB Atlas or local MongoDB

## Install

```bash
npm install
```

Create `.env` from `.env.example` and set your Atlas connection string:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/campus_companion?retryWrites=true&w=majority
JWT_SECRET=use_a_long_random_secret_here
```

Do not commit `.env` to Git.

## Seed the database

```bash
npm run seed
```

The default development demo account is:

```text
Email: menna@campuscompanion.test
Password: 123456
```

You can change the seed account through the `SEED_*` variables in `.env`.

The seed creates/reuses that user, replaces their personal starter data, and replaces only global events.

## Start the API

Development:

```bash
npm run dev
```

Production-style:

```bash
npm start
```

Health check:

```text
GET http://localhost:5000/api/health
```

Expected:

```json
{
  "status": "ok",
  "service": "Campus Companion API"
}
```

## Authentication

### Register

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "fullName": "New Student",
  "email": "student@example.com",
  "studentId": "CC-2026-002",
  "university": "Campus University",
  "password": "123456"
}
```

The response contains a JWT. During development, the new student also receives the starter courses, assignments, exams, schedule, and notes.

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "menna@campuscompanion.test",
  "password": "123456"
}
```

Response:

```json
{
  "user": { "id": "...", "fullName": "Menna Khaled", "email": "..." },
  "token": "JWT_TOKEN"
}
```

For protected endpoints send:

```http
Authorization: Bearer JWT_TOKEN
```

## Resource endpoints

All resource endpoints require authentication.

| Method | Endpoint | Behavior |
|---|---|---|
| GET | `/api/courses` | Current student's courses |
| POST | `/api/courses` | Create a course for current student |
| GET/PUT/DELETE | `/api/courses/:id` | Read/update/delete own course |
| GET | `/api/assignments` | Current student's assignments |
| POST | `/api/assignments` | Create own assignment |
| GET/PUT/DELETE | `/api/assignments/:id` | Read/update/delete own assignment |
| GET | `/api/exams` | Current student's exams |
| POST | `/api/exams` | Create own exam |
| GET/PUT/DELETE | `/api/exams/:id` | Read/update/delete own exam |
| GET | `/api/schedule` | Current student's schedule |
| POST | `/api/schedule` | Create own schedule item |
| GET/PUT/DELETE | `/api/schedule/:id` | Read/update/delete own schedule item |
| GET | `/api/notes` | Current student's notes |
| POST | `/api/notes` | Create own note |
| GET/PUT/DELETE | `/api/notes/:id` | Read/update/delete own note |
| GET | `/api/events` | Global events + current student's own events |
| POST | `/api/events` | Create a private event for current student |
| GET | `/api/events/:id` | Read a global event or own event |
| PUT/DELETE | `/api/events/:id` | Update/delete own event only |

Global seeded events have `owner: null` in MongoDB. They are visible to every authenticated student and cannot be edited/deleted by a student.

## Migration from the old localStorage frontend

The backend cannot directly read browser localStorage. If you already have important data in the old app, export the data first and send it to:

```http
POST /api/migration/import
Authorization: Bearer JWT_TOKEN
Content-Type: application/json
```

Payload:

```json
{
  "courses": [],
  "assignments": [],
  "exams": [],
  "schedule": [],
  "notes": [],
  "events": []
}
```

The import stores personal resources under the currently authenticated user. Imported events are stored as that user's own events; the built-in campus events remain global.

## Frontend connection

The React app already has Axios installed. Create a single API client:

```js
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("campus_companion_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
```

Then resource services can call:

```js
export const getCourses = async () => {
  const response = await api.get("/courses");
  return response.data.data;
};
```

Important: the JWT may temporarily be stored in localStorage during development, but application data should no longer be stored there. For a production app, use a secure httpOnly cookie-based authentication flow.

## v1.2 development fix: existing users with empty data

If you created a user before the starter-data backend was connected, logging in now checks whether that account has personal course data. If it has none, the starter courses, assignments, exams, schedule, and notes are seeded for that user once. This is intended for the current development/demo stage.

To verify which user the JWT belongs to and whether that user has data:

```http
GET http://localhost:5000/api/debug/data-status
Authorization: Bearer YOUR_TOKEN
```

This endpoint is for local development only and should be removed before production deployment.
