import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // POST /boarding-event — record a boarding and notify the guardian
    if (req.method === "POST") {
      const body = await req.json();
      const { passenger_id, bus_id, lat, lng, type } = body as {
        passenger_id?: string;
        bus_id?: string;
        lat?: number;
        lng?: number;
        type?: "board" | "exit" | "arrival";
      };

      if (!passenger_id || !bus_id) {
        return new Response(
          JSON.stringify({ error: "passenger_id and bus_id are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const eventType = type ?? "board";
      const today = new Date().toISOString().slice(0, 10);

      // Fetch passenger + bus
      const { data: passenger } = await supabase
        .from("passengers")
        .select("*, guardian_id")
        .eq("id", passenger_id)
        .maybeSingle();
      if (!passenger) {
        return new Response(
          JSON.stringify({ error: "Passenger not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: bus } = await supabase
        .from("buses")
        .select("bus_number")
        .eq("id", bus_id)
        .maybeSingle();

      // Upsert attendance log
      const { data: existing } = await supabase
        .from("attendance_logs")
        .select("id, status")
        .eq("passenger_id", passenger_id)
        .eq("trip_date", today)
        .maybeSingle();

      let attendanceId: string | null = null;
      if (existing) {
        const update: Record<string, unknown> = { verified_method: "biometric" };
        if (eventType === "board") {
          update.status = "boarded";
          update.board_time = new Date().toISOString();
          update.board_lat = lat ?? null;
          update.board_lng = lng ?? null;
        } else if (eventType === "exit") {
          update.status = "exited";
          update.exit_time = new Date().toISOString();
          update.exit_lat = lat ?? null;
          update.exit_lng = lng ?? null;
        }
        await supabase.from("attendance_logs").update(update).eq("id", existing.id);
        attendanceId = existing.id;
      } else {
        const insert: Record<string, unknown> = {
          passenger_id,
          bus_id,
          trip_date: today,
          status: eventType === "exit" ? "exited" : "boarded",
          verified_method: "biometric",
        };
        if (eventType === "board") {
          insert.board_time = new Date().toISOString();
          insert.board_lat = lat ?? null;
          insert.board_lng = lng ?? null;
        } else {
          insert.exit_time = new Date().toISOString();
          insert.exit_lat = lat ?? null;
          insert.exit_lng = lng ?? null;
        }
        const { data: inserted } = await supabase
          .from("attendance_logs")
          .insert(insert)
          .select("id")
          .maybeSingle();
        attendanceId = inserted?.id ?? null;
      }

      // Notify guardian
      if (passenger.guardian_id) {
        const titles: Record<string, string> = {
          board: `${passenger.full_name} has boarded the bus`,
          exit: `${passenger.full_name} has exited the bus`,
          arrival: `${passenger.full_name} has arrived safely`,
        };
        const messages: Record<string, string> = {
          board: `${bus?.bus_number ?? "Bus"} picked up ${passenger.full_name}. Verified via fingerprint + face.`,
          exit: `${passenger.full_name} exited ${bus?.bus_number ?? "the bus"}.`,
          arrival: `${bus?.bus_number ?? "Bus"} reached the destination safely with ${passenger.full_name}.`,
        };
        await supabase.from("notifications").insert({
          user_id: passenger.guardian_id,
          passenger_id,
          type: eventType,
          title: titles[eventType],
          message: messages[eventType],
          lat: lat ?? null,
          lng: lng ?? null,
          read: false,
        });
      }

      return new Response(
        JSON.stringify({ ok: true, attendance_id: attendanceId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /health — simple health check
    if (req.method === "GET" && url.pathname.endsWith("/health")) {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
