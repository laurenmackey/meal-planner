import { google } from "googleapis";
import pool from "../db";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(userId: number): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state: String(userId),
  });
}

export async function handleCallback(code: string, userId: number): Promise<void> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);

  await pool.query(
    `INSERT INTO google_tokens (user_id, access_token, refresh_token, expiry_date)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
     SET access_token = $2, refresh_token = $3, expiry_date = $4, updated_at = NOW()`,
    [userId, tokens.access_token, tokens.refresh_token, tokens.expiry_date || 0]
  );
}

export async function disconnect(userId: number): Promise<void> {
  await pool.query("DELETE FROM google_tokens WHERE user_id = $1", [userId]);
}

export async function isConnected(userId: number): Promise<boolean> {
  const result = await pool.query(
    "SELECT id FROM google_tokens WHERE user_id = $1",
    [userId]
  );
  return result.rows.length > 0;
}

async function getAuthenticatedClient(userId: number) {
  const result = await pool.query(
    "SELECT access_token, refresh_token, expiry_date FROM google_tokens WHERE user_id = $1",
    [userId]
  );
  if (result.rows.length === 0) {
    throw new Error("Google Calendar not connected");
  }

  const { access_token, refresh_token, expiry_date } = result.rows[0];
  const client = getOAuth2Client();
  client.setCredentials({
    access_token,
    refresh_token,
    expiry_date: Number(expiry_date),
  });

  // Refresh token if expired
  client.on("tokens", async (tokens) => {
    await pool.query(
      `UPDATE google_tokens
       SET access_token = $1, expiry_date = $2, updated_at = NOW()
       WHERE user_id = $3`,
      [tokens.access_token, tokens.expiry_date || 0, userId]
    );
  });

  return client;
}

async function findCalendarByName(auth: any, name: string): Promise<string> {
  const calendar = google.calendar({ version: "v3", auth });
  const list = await calendar.calendarList.list();
  const match = list.data.items?.find(
    (cal) => cal.summary?.toLowerCase() === name.toLowerCase()
  );
  return match?.id || "primary";
}

interface CalendarEvent {
  summary: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMinutes: number;
  eventId?: string;
}

export async function createCalendarEvents(
  userId: number,
  householdId: number,
  events: CalendarEvent[]
): Promise<{ created: number; eventIds: string[] }> {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = await findCalendarByName(auth, "Meals");

  // Get household members' emails to add as attendees
  const membersResult = await pool.query(
    "SELECT email FROM users WHERE household_id = $1 AND id != $2",
    [householdId, userId]
  );
  const attendees = membersResult.rows.map((r) => ({ email: r.email }));

  let created = 0;
  const eventIds: string[] = [];
  for (const event of events) {
    const startDateTime = new Date(`${event.date}T${event.startTime}:00`);
    const endDateTime = new Date(startDateTime.getTime() + event.durationMinutes * 60 * 1000);

    const body = {
      summary: event.summary,
      start: { dateTime: startDateTime.toISOString() },
      end: { dateTime: endDateTime.toISOString() },
      attendees,
    };

    if (event.eventId) {
      const result = await calendar.events.update({
        calendarId,
        eventId: event.eventId,
        requestBody: body,
      });
      eventIds.push(result.data.id!);
    } else {
      const result = await calendar.events.insert({
        calendarId,
        requestBody: body,
      });
      eventIds.push(result.data.id!);
      created++;
    }
  }

  return { created, eventIds };
}
