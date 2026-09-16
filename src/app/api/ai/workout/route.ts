import { NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import type { AiWorkoutProposal, ExerciseLibraryEntry } from "@/lib/types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function buildSystemPrompt(exercises: ExerciseLibraryEntry[]): string {
  const exerciseList = exercises
    .map(
      (e) =>
        `- ID: ${e.id} | ${e.name} | Category: ${e.category} | Muscles: ${e.primary_muscles ?? "N/A"} | Equipment: ${e.equipment ?? "None"} | Type: ${e.exercise_type} | Default reps: ${e.default_repetitions ?? "N/A"} | Default duration: ${e.default_duration_seconds ? `${e.default_duration_seconds}s` : "N/A"}`,
    )
    .join("\n");

  return `You are a fitness workout builder inside a workout tracking app. Your job is to create workout plans based on the user's goals, equipment, and time constraints.

AVAILABLE EXERCISES (use these when possible — reference them by their exact ID):
${exerciseList}

RULES:
1. Prefer exercises from the list above. Use the exercise's exact "ID" value for exercise_library_id.
2. Only propose a new exercise (exercise_library_id: null) if nothing suitable exists in the list.
3. Match equipment constraints strictly — if the user says "no barbell", exclude barbell exercises.
4. Keep workout names short and descriptive.
5. Be concise in your message — speak like a trainer, not a chatbot.
6. For circuit workouts, exercises are done in sequence then repeated for the number of rounds.
7. For standard workouts, each exercise is completed with all its sets before moving on.

You MUST respond with valid JSON matching this exact structure:
{
  "workout": {
    "name": "string",
    "description": "string",
    "workout_type": "standard" or "circuit",
    "rounds": number,
    "estimated_duration_minutes": number,
    "exercises": [
      {
        "exercise_library_id": "uuid string or null",
        "name": "string",
        "sets": number or null,
        "repetitions": "string or null",
        "duration_seconds": number or null,
        "weight": number or null,
        "weight_unit": "lb" or "kg" or null,
        "rest_seconds": number or null,
        "notes": "string or null"
      }
    ]
  },
  "proposed_new_exercises": [
    {
      "name": "string",
      "category": "string",
      "description": "string",
      "form_instructions": "string",
      "primary_muscles": "string",
      "equipment": "string",
      "exercise_type": "bodyweight|barbell|dumbbell|machine|cable|other",
      "default_repetitions": "string or null",
      "default_duration_seconds": number or null
    }
  ],
  "message": "string (brief trainer-style response to the user)"
}`;
}

function validateProposal(
  data: unknown,
  validIds: Set<string>,
): { valid: true; proposal: AiWorkoutProposal } | { valid: false; error: string } {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "AI returned an invalid response." };
  }

  const obj = data as Record<string, unknown>;

  if (!obj.workout || typeof obj.workout !== "object") {
    return { valid: false, error: "AI response missing workout data." };
  }

  const workout = obj.workout as Record<string, unknown>;

  if (typeof workout.name !== "string" || !workout.name.trim()) {
    return { valid: false, error: "AI response has invalid workout name." };
  }

  const workoutType = workout.workout_type;
  if (workoutType !== "standard" && workoutType !== "circuit") {
    return { valid: false, error: "AI response has invalid workout type." };
  }

  const exercises = workout.exercises;
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return { valid: false, error: "AI response has no exercises." };
  }

  for (const ex of exercises) {
    if (typeof ex !== "object" || !ex) continue;
    const e = ex as Record<string, unknown>;
    if (typeof e.name !== "string" || !e.name.trim()) {
      return { valid: false, error: "AI response has an exercise without a name." };
    }
    if (e.exercise_library_id && typeof e.exercise_library_id === "string") {
      if (!validIds.has(e.exercise_library_id)) {
        e.exercise_library_id = null;
      }
    }
  }

  return {
    valid: true,
    proposal: {
      workout: {
        name: String(workout.name),
        description: String(workout.description ?? ""),
        workout_type: workoutType,
        rounds: Math.max(1, Number(workout.rounds) || 1),
        estimated_duration_minutes: Math.max(1, Number(workout.estimated_duration_minutes) || 30),
        exercises: (exercises as Record<string, unknown>[]).map((e) => ({
          exercise_library_id: (typeof e.exercise_library_id === "string" ? e.exercise_library_id : null),
          name: String(e.name),
          sets: typeof e.sets === "number" ? e.sets : null,
          repetitions: typeof e.repetitions === "string" ? e.repetitions : null,
          duration_seconds: typeof e.duration_seconds === "number" ? e.duration_seconds : null,
          weight: typeof e.weight === "number" ? e.weight : null,
          weight_unit: typeof e.weight_unit === "string" ? e.weight_unit : null,
          rest_seconds: typeof e.rest_seconds === "number" ? e.rest_seconds : null,
          notes: typeof e.notes === "string" ? e.notes : null,
        })),
      },
      proposed_new_exercises: Array.isArray(obj.proposed_new_exercises)
        ? (obj.proposed_new_exercises as Record<string, unknown>[]).map((e) => ({
            name: String(e.name ?? ""),
            category: String(e.category ?? "Other"),
            description: String(e.description ?? ""),
            form_instructions: String(e.form_instructions ?? ""),
            primary_muscles: String(e.primary_muscles ?? ""),
            equipment: String(e.equipment ?? ""),
            exercise_type: String(e.exercise_type ?? "other"),
            default_repetitions: typeof e.default_repetitions === "string" ? e.default_repetitions : null,
            default_duration_seconds: typeof e.default_duration_seconds === "number" ? e.default_duration_seconds : null,
          }))
        : [],
      message: String(obj.message ?? "Here's your workout."),
    },
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: keyRow } = await supabase
    .from("user_api_keys")
    .select("encrypted_key")
    .eq("user_id", user.id)
    .eq("provider", "openai")
    .maybeSingle();

  if (!keyRow?.encrypted_key) {
    return NextResponse.json(
      { error: "No OpenAI API key configured. Add your key in Settings." },
      { status: 400 },
    );
  }

  let apiKey: string;
  try {
    apiKey = decrypt(keyRow.encrypted_key);
  } catch {
    return NextResponse.json(
      { error: "Could not decrypt your API key. Try re-saving it in Settings." },
      { status: 500 },
    );
  }

  let body: { messages?: { role: string; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const userMessages = body.messages ?? [];
  if (userMessages.length === 0) {
    return NextResponse.json({ error: "No message provided." }, { status: 400 });
  }

  const { data: exercises } = await supabase
    .from("exercise_library")
    .select("id, name, category, primary_muscles, equipment, exercise_type, default_repetitions, default_duration_seconds")
    .order("name");

  const allExercises = (exercises as ExerciseLibraryEntry[]) ?? [];
  const validIds = new Set(allExercises.map((e) => e.id));
  const systemPrompt = buildSystemPrompt(allExercises);

  const openaiMessages = [
    { role: "system", content: systemPrompt },
    ...userMessages.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),
  ];

  let aiResponse: Response;
  try {
    aiResponse = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach OpenAI. Please try again." },
      { status: 502 },
    );
  }

  if (!aiResponse.ok) {
    const status = aiResponse.status;
    if (status === 401) {
      return NextResponse.json(
        { error: "Your OpenAI API key was rejected. Please verify it in Settings." },
        { status: 400 },
      );
    }
    if (status === 429) {
      return NextResponse.json(
        { error: "OpenAI rate limit reached. Please wait a moment and try again." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "AI workout generation failed. Please try again." },
      { status: 502 },
    );
  }

  let parsed: unknown;
  try {
    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json(
      { error: "AI returned an invalid response. Please try again." },
      { status: 502 },
    );
  }

  const result = validateProposal(parsed, validIds);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ proposal: result.proposal });
}
